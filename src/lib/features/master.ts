import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { buildAlertName } from '../alert-name';
import { MAX_FILTERS_PER_ALERT } from '../discogs/constants';
import {
  defaultFormats,
  type FormatGroup,
  fetchMasterVersions,
  groupByFormat,
  type MasterVersion,
  selectVersionIds,
} from '../discogs/master';
import { findMasterAddAllButton, findMasterAnchor, isLoggedOut, readRecordInfo, SEL } from '../discogs/selectors';
import { buildWantlisterUrl, countFilterFacets, loginUrl } from '../discogs/urls';
import { t } from '../i18n';
import { getPrefs, type Prefs, savePendingAlert, updatePrefs } from '../store';
import { icon, openGuide, Spotlight } from '../ui/content-ui';
import { h, renderKeepingFocus, replaceChildren, waitFor } from '../ui/dom';
import { keepMounted } from './mount';

/** "Want any pressing of this album?" card on master release pages. */
export async function initMasterPage(ctx: ContentScriptContext, masterId: number): Promise<void> {
  const anchor = await waitFor(() => findMasterAnchor(), 15_000);
  if (!anchor) return;
  const ui = await createShadowRootUi(ctx, {
    name: 'crate-bell-master',
    position: 'inline',
    anchor: () => findMasterAnchor() ?? document.body,
    append: 'after',
    isolateEvents: true,
    onMount: (container, shadow) => new MasterCard(container, shadow, masterId),
    onRemove: (card) => card?.destroy(),
  });
  keepMounted(ctx, ui, findMasterAnchor);
}

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; versions: MasterVersion[]; groups: FormatGroup[] };

/** Versions are fetched once per page, even if Discogs makes us re-mount. */
const versionsCache = new Map<number, Promise<MasterVersion[]>>();

class MasterCard {
  private root: HTMLElement;
  private load: Load = { state: 'loading' };
  private selected: string[] = [];
  private prefs: Prefs | null = null;
  private spotlight: Spotlight;
  private showedWhere = false;
  private spotlightTimer = 0;

  constructor(
    container: HTMLElement,
    shadow: ShadowRoot,
    private masterId: number,
  ) {
    this.root = h('section', { class: 'cb-root cb-card', 'aria-label': t('appName') });
    container.appendChild(this.root);
    this.spotlight = new Spotlight(shadow.querySelector('body') ?? container);
    this.render();
    void this.start();
  }

  destroy(): void {
    clearTimeout(this.spotlightTimer);
    this.spotlight.destroy();
  }

  private async start(): Promise<void> {
    this.prefs = await getPrefs();
    try {
      let request = versionsCache.get(this.masterId);
      if (!request) {
        request = fetchMasterVersions(this.masterId);
        versionsCache.set(this.masterId, request);
      }
      const versions = await request;
      const groups = groupByFormat(versions);
      const remembered = this.prefs.masterFormats.filter((f) => groups.some((g) => g.format === f));
      this.selected = remembered.length ? remembered : defaultFormats(groups);
      this.load = { state: 'ready', versions, groups };
    } catch {
      versionsCache.delete(this.masterId);
      this.load = { state: 'error' };
    }
    this.render();
  }

  private toggle(format: string): void {
    const next = this.selected.includes(format)
      ? this.selected.filter((f) => f !== format)
      : [...this.selected, format];
    this.selected = next;
    void updatePrefs({ masterFormats: next });
    this.render();
  }

  private showWhere(): void {
    this.showedWhere = true;
    const target = findMasterAddAllButton() ?? document.querySelector(SEL.masterVersions);
    this.spotlight.show(target, t('masterSpotlightLabel'), true);
    clearTimeout(this.spotlightTimer);
    this.spotlightTimer = window.setTimeout(() => this.spotlight.hide(), 9_000);
    this.render();
  }

  private async setAlert(ids: number[]): Promise<void> {
    if (!this.prefs || !ids.length) return;
    const info = readRecordInfo('master');
    const { url, releaseIds, truncated } = buildWantlisterUrl(ids, this.prefs);
    const formats = this.selected.join(' / ');
    await savePendingAlert({
      kind: 'master',
      releaseIds,
      name: buildAlertName(info.artists, info.title, t('masterAlertSuffix', formats)),
      frequency: this.prefs.frequency,
      createdAt: Date.now(),
      truncated,
    });
    window.location.assign(url);
  }

  private render(): void {
    renderKeepingFocus(this.root, () => this.draw());
  }

  private draw(): void {
    const head = h(
      'div',
      { class: 'cb-card__head' },
      h('span', { class: 'cb-disc' }, icon('crate')),
      h('h2', { class: 'cb-card__title' }, t('masterTitle')),
    );
    const intro = h('p', { class: 'cb-card__body' }, t('masterIntro'));

    if (isLoggedOut()) {
      replaceChildren(
        this.root,
        head,
        intro,
        h(
          'a',
          { class: 'cb-btn cb-btn--secondary cb-btn--block', href: loginUrl(location.href) },
          t('releaseLoggedOut'),
        ),
      );
      return;
    }

    if (this.load.state === 'loading') {
      replaceChildren(
        this.root,
        head,
        intro,
        h('p', { class: 'cb-card__body cb-muted', role: 'status' }, t('masterLoading')),
      );
      return;
    }
    if (this.load.state === 'error') {
      replaceChildren(
        this.root,
        head,
        intro,
        h(
          'div',
          { class: 'cb-notice cb-notice--error', role: 'alert' },
          icon('warning'),
          h('span', null, t('masterLoadError')),
        ),
      );
      return;
    }

    const { versions, groups } = this.load;
    const ids = selectVersionIds(versions, this.selected);
    const room = Math.max(1, MAX_FILTERS_PER_ALERT - (this.prefs ? countFilterFacets(this.prefs) : 0));
    const truncated = ids.length > room;

    const chips = h(
      'div',
      { class: 'cb-chips', role: 'group', 'aria-label': t('masterFormatsLabel') },
      groups.map((g) =>
        h(
          'button',
          {
            type: 'button',
            class: 'cb-chip',
            'aria-pressed': this.selected.includes(g.format) ? 'true' : 'false',
            dataset: { focusKey: `chip-${g.format}` },
            on: { click: () => this.toggle(g.format) },
          },
          icon('check'),
          `${g.format} (${g.count})`,
        ),
      ),
    );

    const steps = h(
      'ol',
      { class: 'cb-steps' },
      h(
        'li',
        { class: `cb-step${this.showedWhere ? ' cb-step--done' : ' cb-step--current'}` },
        h('span', { class: 'cb-step__num', 'aria-hidden': 'true' }, '1'),
        h(
          'div',
          null,
          h('p', { class: 'cb-step__title' }, t('masterStep1Title')),
          h('p', { class: 'cb-step__text' }, t('masterStep1Text')),
          h(
            'button',
            {
              type: 'button',
              class: 'cb-btn cb-btn--secondary cb-btn--sm',
              dataset: { focusKey: 'where' },
              on: { click: () => this.showWhere() },
            },
            t('masterShowWhere'),
          ),
        ),
      ),
      h(
        'li',
        { class: `cb-step${this.showedWhere ? ' cb-step--current' : ''}` },
        h('span', { class: 'cb-step__num', 'aria-hidden': 'true' }, '2'),
        h(
          'div',
          null,
          h('p', { class: 'cb-step__title' }, t('masterStep2Title')),
          h('p', { class: 'cb-step__text' }, t('masterStep2Text')),
          h(
            'button',
            {
              type: 'button',
              class: 'cb-btn cb-btn--primary cb-btn--block',
              'aria-disabled': ids.length ? undefined : 'true',
              dataset: { focusKey: 'set-alert' },
              on: {
                click: () => {
                  if (ids.length) void this.setAlert(ids);
                },
              },
            },
            icon('bell'),
            ids.length === 0
              ? t('masterPickFormat')
              : ids.length === 1
                ? t('masterSetAlertOne')
                : t('masterSetAlert', String(Math.min(ids.length, room))),
          ),
        ),
      ),
    );

    replaceChildren(
      this.root,
      head,
      intro,
      h('div', null, h('p', { class: 'cb-card__label' }, t('masterFormatsLabel')), chips),
      steps,
      truncated
        ? h(
            'div',
            { class: 'cb-notice cb-notice--info', role: 'note' },
            icon('info'),
            h('span', null, t('masterTruncated', [String(room), String(ids.length)])),
          )
        : null,
      h(
        'div',
        { class: 'cb-release__footer' },
        h('span', { class: 'cb-brand' }, t('appName')),
        h('button', { type: 'button', class: 'cb-link', on: { click: () => openGuide('master') } }, t('howItWorks')),
      ),
    );
  }
}
