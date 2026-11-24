import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { buildAlertName } from '../alert-name';
import {
  findReleaseAnchor,
  findWantlistButton,
  isLoggedOut,
  readRecordInfo,
  readWantlistState,
  type WantlistState,
} from '../discogs/selectors';
import { buildWantlisterUrl, loginUrl, notificationSettingsUrl } from '../discogs/urls';
import { t } from '../i18n';
import { emailStatusItem, getPrefs, pendingAlertItem } from '../store';
import { icon, openGuide } from '../ui/content-ui';
import { h, onDomChange, replaceChildren, waitFor } from '../ui/dom';
import { keepMounted } from './mount';

type View =
  | { name: 'logged-out' }
  | { name: 'add' }
  | { name: 'set'; justAdded: boolean }
  | { name: 'adding' }
  | { name: 'add-failed' }
  | { name: 'opening' };

/** The pink button under Discogs' "Add to Wantlist" button on every release page. */
export async function initReleasePage(ctx: ContentScriptContext, releaseId: number): Promise<void> {
  const anchor = await waitFor(() => findReleaseAnchor(), 15_000);
  const floating = !anchor;

  const ui = await createShadowRootUi(ctx, {
    name: 'crate-bell-release',
    position: 'inline',
    anchor: floating ? document.body : () => findReleaseAnchor() ?? document.body,
    append: floating ? 'last' : 'after',
    isolateEvents: true,
    onMount: (container) => new ReleaseCard(container, releaseId, floating),
    onRemove: (card) => card?.destroy(),
  });
  keepMounted(ctx, ui, () => (floating ? document.body : findReleaseAnchor()));
}

class ReleaseCard {
  private root: HTMLElement;
  private view: View = { name: 'add' };
  private lastState: WantlistState = 'unknown';
  private stopWatching: () => void;
  private emailOff = false;

  constructor(
    container: HTMLElement,
    private releaseId: number,
    floating: boolean,
  ) {
    this.root = h('section', {
      class: `cb-root cb-release${floating ? ' cb-floating' : ''}`,
      'aria-label': t('appName'),
    });
    container.appendChild(this.root);
    this.lastState = readWantlistState();
    this.view = this.viewFor(this.lastState, false);
    this.render();

    // Discogs updates its own button when the user clicks it: follow along.
    this.stopWatching = onDomChange(() => this.syncWithDiscogs());
    const unwatchEmail = emailStatusItem.watch((status) => {
      this.emailOff = status?.state === 'off';
      this.render();
    });
    const previousStop = this.stopWatching;
    this.stopWatching = () => {
      previousStop();
      unwatchEmail();
    };
    void emailStatusItem.getValue().then((status) => {
      this.emailOff = status?.state === 'off';
      this.render();
    });
  }

  destroy(): void {
    this.stopWatching();
  }

  private viewFor(state: WantlistState, justAdded: boolean): View {
    if (isLoggedOut()) return { name: 'logged-out' };
    if (state === 'not-in-wantlist') return { name: 'add' };
    return { name: 'set', justAdded };
  }

  private syncWithDiscogs(): void {
    if (this.view.name === 'adding' || this.view.name === 'opening') return;
    const state = readWantlistState();
    if (state === this.lastState) return;
    const justAdded = this.lastState === 'not-in-wantlist' && state === 'in-wantlist';
    this.lastState = state;
    this.view = this.viewFor(state, justAdded);
    this.render();
  }

  private async onPrimaryClick(): Promise<void> {
    if (this.view.name === 'add' || this.view.name === 'add-failed') {
      const button = findWantlistButton();
      if (!button) return this.setView({ name: 'add-failed' });
      this.setView({ name: 'adding' });
      button.click();
      const added = await waitFor(() => readWantlistState() === 'in-wantlist', 8_000);
      this.lastState = readWantlistState();
      if (!added) return this.setView({ name: 'add-failed' });
    }
    await this.openAlertPage();
  }

  private async openAlertPage(): Promise<void> {
    this.setView({ name: 'opening' });
    const prefs = await getPrefs();
    const info = readRecordInfo('release');
    const { url, releaseIds } = buildWantlisterUrl([this.releaseId], prefs);
    await pendingAlertItem.setValue({
      kind: 'release',
      releaseIds,
      name: buildAlertName(info.artists, info.title),
      frequency: prefs.frequency,
      createdAt: Date.now(),
    });
    window.location.assign(url);
  }

  private setView(view: View): void {
    this.view = view;
    this.render();
  }

  private render(): void {
    const v = this.view;
    if (v.name === 'logged-out') {
      replaceChildren(
        this.root,
        h(
          'a',
          { class: 'cb-btn cb-btn--secondary cb-btn--block', href: loginUrl(window.location.href) },
          icon('bell'),
          t('releaseLoggedOut'),
        ),
        this.footer(),
      );
      return;
    }

    const busy = v.name === 'adding' || v.name === 'opening';
    const label =
      v.name === 'adding'
        ? t('releaseAdding')
        : v.name === 'opening'
          ? t('releaseOpening')
          : v.name === 'set'
            ? t('releaseSetAlert')
            : t('releaseAddAndAlert');

    const help =
      v.name === 'set' && v.justAdded
        ? t('releaseHelpJustAdded')
        : v.name === 'set'
          ? t('releaseHelpSet')
          : v.name === 'add-failed'
            ? null
            : t('releaseHelpAdd');

    const button = h(
      'button',
      {
        type: 'button',
        class: `cb-btn cb-btn--primary cb-btn--block${v.name === 'set' && v.justAdded ? ' cb-nudge' : ''}`,
        'aria-disabled': busy ? 'true' : undefined,
        'aria-busy': busy ? 'true' : undefined,
        on: {
          click: () => {
            if (!busy) void this.onPrimaryClick();
          },
        },
      },
      icon('bell'),
      label,
    );

    replaceChildren(
      this.root,
      button,
      help
        ? h('p', { class: 'cb-release__help', role: v.name === 'set' && v.justAdded ? 'status' : undefined }, help)
        : null,
      v.name === 'add-failed'
        ? h(
            'div',
            { class: 'cb-notice cb-notice--error', role: 'alert' },
            icon('warning'),
            h('span', null, t('releaseAddFailed')),
          )
        : null,
      this.emailOff
        ? h(
            'div',
            { class: 'cb-notice', role: 'note' },
            icon('mail'),
            h(
              'span',
              null,
              `${t('emailOffShort')} `,
              h(
                'a',
                { class: 'cb-link', href: notificationSettingsUrl(), target: '_blank', rel: 'noopener' },
                t('emailOffFix'),
              ),
            ),
          )
        : null,
      this.footer(),
    );
  }

  private footer(): HTMLElement {
    return h(
      'div',
      { class: 'cb-release__footer' },
      h('span', { class: 'cb-brand' }, t('appName')),
      h('button', { type: 'button', class: 'cb-link', on: { click: () => openGuide('how') } }, t('howItWorks')),
    );
  }
}
