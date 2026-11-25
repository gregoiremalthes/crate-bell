import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { buildAlertName } from '../alert-name';
import {
  findReleaseAnchor,
  findShopItemAnchor,
  findShopWantlistButton,
  findWantlistButton,
  isLoggedOut,
  type RecordInfo,
  readRecordInfo,
  readShopItemInfo,
  readShopItemReleaseId,
  readShopWantlistState,
  readWantlistState,
  type WantlistState,
} from '../discogs/selectors';
import { buildWantlisterUrl, loginUrl, notificationSettingsUrl, wantlisterHomeUrl } from '../discogs/urls';
import { t } from '../i18n';
import {
  alertsForRelease,
  deleteRequestItem,
  emailStatusItem,
  getPrefs,
  type KnownAlert,
  knownAlertsItem,
  savePendingAlert,
} from '../store';
import { icon, openGuide } from '../ui/content-ui';
import { h, onDomChange, renderKeepingFocus, replaceChildren, sleep, waitFor } from '../ui/dom';
import { keepMounted } from './mount';

type View =
  | { name: 'logged-out' }
  | { name: 'add' }
  | { name: 'set'; justAdded: boolean }
  | { name: 'adding' }
  | { name: 'add-failed' }
  | { name: 'opening' };

/** How the card reads a page that shows one record with Discogs' wantlist toggle. */
interface RecordPage {
  findButton: () => HTMLButtonElement | null;
  readState: () => WantlistState;
  readInfo: () => RecordInfo;
  /** Extra class to match the look of the page's own buttons. */
  variant?: string;
}

const RELEASE_PAGE: RecordPage = {
  findButton: () => findWantlistButton(),
  readState: () => readWantlistState(),
  readInfo: () => readRecordInfo('release'),
};

const SHOP_ITEM_PAGE: RecordPage = {
  findButton: () => findShopWantlistButton(),
  readState: () => readShopWantlistState(),
  readInfo: () => readShopItemInfo(),
  variant: 'cb-release--shop',
};

/** The alert button under Discogs' wantlist toggle on a marketplace listing (/shop/item/…). */
export async function initShopItemPage(ctx: ContentScriptContext): Promise<void> {
  const button = await waitFor(() => findShopWantlistButton(), 10_000);
  const releaseId = readShopItemReleaseId();
  if (!button || !releaseId) return;
  const ui = await createShadowRootUi(ctx, {
    name: 'crate-bell-release',
    position: 'inline',
    anchor: () => findShopItemAnchor() ?? document.body,
    append: 'after',
    isolateEvents: true,
    onMount: (container) => new ReleaseCard(container, releaseId, false, SHOP_ITEM_PAGE),
    onRemove: (card) => card?.destroy(),
  });
  keepMounted(ctx, ui, findShopItemAnchor);
}

/** The alert button under Discogs' "Add to Wantlist" button on every release page. */
export async function initReleasePage(ctx: ContentScriptContext, releaseId: number): Promise<void> {
  // Discogs' buttons appear after the page hydrates: wait for them before using a fallback place.
  await waitFor(() => findWantlistButton(), 8_000);
  const anchor = await waitFor(() => findReleaseAnchor(), 7_000);
  const floating = !anchor;

  const ui = await createShadowRootUi(ctx, {
    name: 'crate-bell-release',
    position: 'inline',
    anchor: floating ? document.body : () => findReleaseAnchor() ?? document.body,
    append: floating ? 'last' : 'after',
    isolateEvents: true,
    onMount: (container) => new ReleaseCard(container, releaseId, floating, RELEASE_PAGE),
    onRemove: (card) => card?.destroy(),
  });
  keepMounted(ctx, ui, () => (floating ? document.body : findReleaseAnchor()), floating ? 'last' : 'after');
}

class ReleaseCard {
  private root: HTMLElement;
  private view: View = { name: 'add' };
  private lastState: WantlistState = 'unknown';
  private stopWatching: () => void;
  private emailOff = false;
  /** Alerts Crate Bell knows for this record (see KnownAlert). */
  private alerts: KnownAlert[] = [];
  /** The user asked to set another alert although one exists. */
  private setAnyway = false;

  constructor(
    container: HTMLElement,
    private releaseId: number,
    floating: boolean,
    private page: RecordPage,
  ) {
    this.root = h('section', {
      class: `cb-root cb-release${floating ? ' cb-floating' : ''} ${page.variant ?? ''}`,
      'aria-label': t('appName'),
    });
    container.appendChild(this.root);
    this.lastState = this.page.readState();
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
    // Coming back with the browser's Back button can restore the page as it was ("Opening…").
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      this.lastState = this.page.readState();
      this.setView(this.viewFor(this.lastState, false));
    };
    window.addEventListener('pageshow', onPageShow);
    const stopBeforePageShow = this.stopWatching;
    this.stopWatching = () => {
      stopBeforePageShow();
      window.removeEventListener('pageshow', onPageShow);
    };
    void emailStatusItem.getValue().then((status) => {
      this.emailOff = status?.state === 'off';
      this.render();
    });

    const showAlerts = (all: KnownAlert[] | null) => {
      this.alerts = alertsForRelease(all ?? [], this.releaseId).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
      this.render();
    };
    void knownAlertsItem.getValue().then(showAlerts);
    const unwatchAlerts = knownAlertsItem.watch(showAlerts);
    const stopBeforeAlerts = this.stopWatching;
    this.stopWatching = () => {
      stopBeforeAlerts();
      unwatchAlerts();
    };
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
    const state = this.page.readState();
    if (state === this.lastState) return;
    const justAdded = this.lastState === 'not-in-wantlist' && state === 'in-wantlist';
    this.lastState = state;
    this.view = this.viewFor(state, justAdded);
    this.render();
  }

  private async onPrimaryClick(): Promise<void> {
    if (this.view.name === 'add' || this.view.name === 'add-failed') {
      const button = this.page.findButton();
      if (!button) return this.setView({ name: 'add-failed' });
      this.setView({ name: 'adding' });
      button.click();
      const added = await waitFor(() => this.page.readState() === 'in-wantlist', 8_000);
      // Discogs updates its button before its server confirms: give it a moment to undo a failure.
      if (added) await sleep(1_200);
      this.lastState = this.page.readState();
      if (this.lastState !== 'in-wantlist') {
        this.setView({ name: 'add-failed' });
        return;
      }
    }
    await this.openAlertPage();
  }

  private async openAlertPage(): Promise<void> {
    this.setView({ name: 'opening' });
    const prefs = await getPrefs();
    const info = this.page.readInfo();
    const { url, releaseIds } = buildWantlisterUrl([this.releaseId], prefs);
    await savePendingAlert({
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
    renderKeepingFocus(this.root, () => this.draw());
  }

  private async deleteAlert(alert: KnownAlert): Promise<void> {
    await deleteRequestItem.setValue({ name: alert.name, savedSearchId: alert.savedSearchId, createdAt: Date.now() });
    window.location.assign(wantlisterHomeUrl());
  }

  /** "Sale alert on" (or "paused" when the record left the wantlist), in place of the button. */
  private drawAlertStatus(alert: KnownAlert): void {
    const paused = this.lastState === 'not-in-wantlist';
    const busy = this.view.name === 'adding';
    const frequencyText =
      alert.frequency === 'realtime'
        ? t('alertOnRealtime')
        : alert.frequency === 'digest'
          ? t('alertOnDigest')
          : alert.frequency === 'no'
            ? t('alertOnNoEmail')
            : t('alertOnUnknown');
    const details = [`“${alert.name}”`];
    if (alert.savedAt) {
      details.push(t('alertSetOn', new Intl.DateTimeFormat(t('lang'), { dateStyle: 'medium' }).format(alert.savedAt)));
    }
    if (alert.releaseIds.length > 1) details.push(t('alertCovers', String(alert.releaseIds.length)));
    if (this.alerts.length > 1) details.push(t('alertMore', String(this.alerts.length - 1)));

    const deleteButton = h(
      'button',
      {
        type: 'button',
        class: 'cb-btn cb-btn--secondary cb-btn--sm',
        dataset: { focusKey: 'delete' },
        on: { click: () => void this.deleteAlert(alert) },
      },
      icon('trash'),
      paused ? t('alertDeleteIt') : t('alertDelete'),
    );

    replaceChildren(
      this.root,
      h(
        'div',
        { class: `cb-alert-status${paused ? ' cb-alert-status--paused' : ''}`, role: 'status' },
        h(
          'p',
          { class: 'cb-alert-status__title' },
          icon(paused ? 'warning' : 'bell'),
          paused ? t('alertPausedTitle') : t('alertOnTitle'),
        ),
        h('p', { class: 'cb-alert-status__text' }, paused ? t('alertPausedText') : frequencyText),
        h('p', { class: 'cb-small cb-muted' }, details.join(' · ')),
      ),
      paused
        ? h(
            'div',
            { class: 'cb-release__actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'cb-btn cb-btn--primary cb-btn--sm',
                dataset: { focusKey: 'primary' },
                'aria-busy': busy ? 'true' : undefined,
                on: {
                  click: () => {
                    if (busy) return;
                    const button = this.page.findButton();
                    if (!button) return;
                    this.setView({ name: 'adding' });
                    button.click();
                    void waitFor(() => this.page.readState() === 'in-wantlist', 8_000).then(() => {
                      this.lastState = this.page.readState();
                      this.setView(this.viewFor(this.lastState, false));
                    });
                  },
                },
              },
              busy ? t('releaseAdding') : t('alertPutBack'),
            ),
            deleteButton,
          )
        : h('div', { class: 'cb-release__actions' }, deleteButton),
      this.emailOff && !paused ? this.emailNotice() : null,
      h(
        'div',
        { class: 'cb-release__footer' },
        h('span', { class: 'cb-brand' }, t('appName')),
        h(
          'button',
          {
            type: 'button',
            class: 'cb-link',
            dataset: { focusKey: 'set-anyway' },
            on: {
              click: () => {
                this.setAnyway = true;
                this.render();
              },
            },
          },
          t('alertSetAnother'),
        ),
      ),
    );
  }

  private emailNotice(): HTMLElement {
    return h(
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
    );
  }

  private draw(): void {
    const v = this.view;
    const alert = this.alerts[0];
    if (alert && !this.setAnyway && v.name !== 'logged-out' && v.name !== 'opening') {
      this.drawAlertStatus(alert);
      return;
    }
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
        dataset: { focusKey: 'primary' },
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
      this.emailOff ? this.emailNotice() : null,
      this.footer(),
    );
  }

  private footer(): HTMLElement {
    return h(
      'div',
      { class: 'cb-release__footer' },
      h('span', { class: 'cb-brand' }, t('appName')),
      h(
        'button',
        { type: 'button', class: 'cb-link', dataset: { focusKey: 'how' }, on: { click: () => openGuide('how') } },
        t('howItWorks'),
      ),
    );
  }
}
