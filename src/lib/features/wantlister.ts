import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { makeUnique } from '../alert-name';
import { MAX_DAILY_DIGEST_ALERTS, MAX_SAVED_ALERTS } from '../discogs/constants';
import {
  type DrawerError,
  findDeleteButton,
  findDeleteConfirmBox,
  findOpenDrawer,
  findSavedSearchesSelect,
  findSaveSearchButton,
  isDefaultAlertName,
  isSavedSearchListComplete,
  isWantlisterDown,
  readDrawerEmailCheckbox,
  readDrawerError,
  readSavedSearches,
  readSavedSearchNames,
  readSelectedSavedSearch,
  SEL,
  selectSavedSearch,
  setNativeInputValue,
} from '../discogs/selectors';
import { releaseIdsFromSearch } from '../discogs/urls';
import { type MessageKey, t } from '../i18n';
import { KOFI_URL } from '../links';
import {
  alertsSetItem,
  clearPendingAlert,
  type DeleteRequest,
  deleteRequestItem,
  type Frequency,
  findPendingAlert,
  forgetAlert,
  isPendingFresh,
  type PendingAlert,
  rememberAlert,
  syncKnownAlerts,
} from '../store';
import { icon, openGuide, Spotlight } from '../ui/content-ui';
import { h, onDomChange, renderKeepingFocus, replaceChildren } from '../ui/dom';

/** How long after the save form closes we keep looking for the new alert in Discogs' list. */
const SAVE_CONFIRM_WINDOW_MS = 8_000;
/** How long we show "Checking…" before pointing at Save Search again (after a Cancel, say). */
const CHECKING_DISPLAY_MS = 2_500;

type Step =
  | { name: 'help-closed' }
  | { name: 'help-open'; topic: 'menu' | 'delete' }
  | { name: 'down' }
  | { name: 'save' }
  | { name: 'drawer'; error: DrawerError | null; emailOff: boolean }
  | { name: 'checking' }
  | { name: 'done'; alertName: string; frequency: Frequency | 'no' }
  | { name: 'delete'; alertName: string; phase: 'pick' | 'confirm' }
  | { name: 'deleted'; alertName: string }
  | { name: 'delete-missing'; alertName: string };

/**
 * The guide shown on Discogs' "Items I Want" page: it points at "Save Search", fills in the
 * name and email frequency, and confirms when the alert is saved. It never clicks "Save" itself:
 * the user stays in control of their account.
 */
export async function initWantlisterPage(ctx: ContentScriptContext): Promise<ShadowRootContentScriptUi<Coach>> {
  const ui = await createShadowRootUi(ctx, {
    name: 'crate-bell-coach',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    isolateEvents: true,
    onMount: (container) => new Coach(container),
    onRemove: (coach) => coach?.destroy(),
  });
  ui.mount();
  return ui;
}

class Coach {
  private root: HTMLElement;
  private spotlight: Spotlight;
  private step: Step = { name: 'help-closed' };
  private pending: PendingAlert | null = null;
  private stop: () => void = () => undefined;
  private dismissed = false;

  // Save form bookkeeping
  private drawer: Element | null = null;
  private drawerCleanup: () => void = () => undefined;
  /** Saved alert names before the form opened: a success is a name that was not there. */
  private namesBefore = new Set<string>();
  /** The name in the form, as last typed or filled in. */
  private formName: string | null = null;
  private nameWasFilled = false;
  private closedAt = 0;
  /** Frequency radio checked when the user pressed Save. */
  private formFrequency: Frequency | 'no' | null = null;

  // Delete flow
  private deleteRequest: DeleteRequest | null = null;
  private deleteTargetId: string | null = null;

  // Keeping Crate Bell's list of alerts in step with Discogs' menu
  private lastSyncKey = '';
  private learnTimer = 0;
  private learnedSelection = '';
  private timers: number[] = [];

  constructor(container: HTMLElement) {
    this.root = h('div', { class: 'cb-root' });
    container.appendChild(this.root);
    this.spotlight = new Spotlight(container);
    void this.start();
  }

  destroy(): void {
    this.stop();
    this.drawerCleanup();
    this.clearTimers();
    clearTimeout(this.learnTimer);
    this.spotlight.destroy();
  }

  private async start(): Promise<void> {
    const deleteRequest = await deleteRequestItem.getValue();
    if (deleteRequest && isPendingFresh(deleteRequest)) {
      this.deleteRequest = deleteRequest;
      this.step = { name: 'delete', alertName: deleteRequest.name, phase: 'pick' };
    } else {
      this.pending = await findPendingAlert(releaseIdsFromSearch(window.location.search));
      if (this.pending) this.step = { name: 'save' };
    }
    this.render();
    if (this.pending || this.deleteRequest) this.focusTitle();
    this.stop = onDomChange(() => this.update());
    this.update();
  }

  private update(): void {
    this.syncWithDiscogsList();
    if (this.dismissed) return;
    this.go(this.nextStep());
  }

  /**
   * Keeps Crate Bell's list of alerts true to Discogs' "Saved Searches" menu: forgets deleted
   * alerts, and learns the records of a saved search the user opens.
   */
  private syncWithDiscogsList(): void {
    if (isSavedSearchListComplete()) {
      const listed = readSavedSearches();
      const key = JSON.stringify(listed);
      if (key !== this.lastSyncKey) {
        this.lastSyncKey = key;
        void syncKnownAlerts(listed);
      }
    }
    const selected = readSelectedSavedSearch();
    const selectionKey = selected ? `${selected.id}|${selected.name}` : '';
    if (selectionKey && selectionKey !== this.learnedSelection) {
      // Wait until Discogs has applied the saved search's filters to the address.
      clearTimeout(this.learnTimer);
      this.learnTimer = window.setTimeout(() => {
        const now = readSelectedSavedSearch();
        const ids = releaseIdsFromSearch(window.location.search);
        if (!now || `${now.id}|${now.name}` !== selectionKey || !ids.length) return;
        this.learnedSelection = selectionKey;
        void rememberAlert({ name: now.name, savedSearchId: now.id, releaseIds: ids, source: 'discogs' });
      }, 1_000);
    }
  }

  /** Works out which step the user is at, from what is on the page right now. */
  private nextStep(): Step {
    if (isWantlisterDown()) return { name: 'down' };
    if (this.deleteRequest) return this.deleteStep(this.deleteRequest);
    if (!this.pending) return this.step.name === 'down' ? { name: 'help-closed' } : this.step;
    if (this.step.name === 'done') return this.step;

    const drawer = findOpenDrawer();
    if (drawer) {
      if (this.drawer !== drawer) this.attachToDrawer(drawer, this.pending);
      return { name: 'drawer', error: readDrawerError(drawer), emailOff: readDrawerEmailCheckbox(drawer) === false };
    }

    if (this.drawer) {
      // The form just closed: saved or cancelled? Discogs may refresh its list a moment later.
      this.detachFromDrawer();
      this.closedAt = Date.now();
      this.clearTimers();
      for (const delay of [CHECKING_DISPLAY_MS, SAVE_CONFIRM_WINDOW_MS]) {
        this.timers.push(window.setTimeout(() => this.update(), delay + 50));
      }
    }
    const sinceClose = Date.now() - this.closedAt;
    if (this.closedAt && sinceClose < SAVE_CONFIRM_WINDOW_MS) {
      const saved = this.findNewAlert();
      if (saved) return this.succeed(saved);
      if (sinceClose < CHECKING_DISPLAY_MS) return { name: 'checking' };
    }
    return { name: 'save' };
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  private succeed(alertName: string): Step {
    this.clearTimers();
    this.closedAt = 0;
    const pending = this.pending as PendingAlert;
    const frequency = this.formFrequency ?? pending.frequency;
    void clearPendingAlert(pending.releaseIds);
    void alertsSetItem.getValue().then((n) => alertsSetItem.setValue(n + 1));
    const listed = readSavedSearches().find((s) => s.name.toLowerCase() === alertName.toLowerCase());
    void rememberAlert({
      name: alertName,
      savedSearchId: listed?.id,
      releaseIds: pending.releaseIds,
      frequency,
      savedAt: Date.now(),
      source: 'crate-bell',
    });
    return { name: 'done', alertName, frequency };
  }

  /** Guides the deletion of one alert, asked for from a record page. Discogs asks to confirm. */
  private deleteStep(request: DeleteRequest): Step {
    const s = this.step;
    if (s.name === 'deleted' || s.name === 'delete-missing') return s;
    const listed = readSavedSearches();
    const target =
      listed.find((x) => request.savedSearchId && x.id === request.savedSearchId) ??
      listed.find((x) => x.name.toLowerCase() === request.name.toLowerCase());

    if (!target) {
      // Gone from the menu: deleted just now (we had it selected), or already deleted before.
      if (this.deleteTargetId || isSavedSearchListComplete()) {
        void forgetAlert({ name: request.name, savedSearchId: request.savedSearchId });
        void deleteRequestItem.setValue(null);
        return this.deleteTargetId
          ? { name: 'deleted', alertName: request.name }
          : { name: 'delete-missing', alertName: request.name };
      }
      return { name: 'delete', alertName: request.name, phase: 'pick' };
    }
    if (this.deleteTargetId !== target.id) {
      this.deleteTargetId = target.id;
      selectSavedSearch(target.id);
    }
    return { name: 'delete', alertName: target.name, phase: findDeleteConfirmBox() ? 'confirm' : 'pick' };
  }

  /** A saved alert that did not exist before the form opened: the one the user just saved. */
  private findNewAlert(): string | null {
    const added = readSavedSearchNames().filter((n) => !this.namesBefore.has(n.toLowerCase()));
    if (!added.length) return null;
    const expected = this.formName?.toLowerCase();
    return added.find((n) => n.toLowerCase() === expected) ?? (added.length === 1 ? (added[0] as string) : null);
  }

  private attachToDrawer(drawer: Element, pending: PendingAlert): void {
    this.detachFromDrawer();
    this.drawer = drawer;
    this.namesBefore = new Set(readSavedSearchNames().map((n) => n.toLowerCase()));

    const input = drawer.querySelector<HTMLInputElement>(SEL.drawerNameInput);
    this.nameWasFilled = false;
    if (input && isDefaultAlertName(input.value)) {
      setNativeInputValue(input, makeUnique(pending.name, readSavedSearchNames()));
      this.nameWasFilled = true;
    }
    this.formName = input?.value.trim() || null;

    const radio = drawer.querySelector<HTMLInputElement>(SEL.frequencyRadio(pending.frequency));
    if (radio && !radio.checked) radio.click();

    // Follow what the user types, and read the final name when they press Save.
    const readName = () => {
      if (input?.value.trim()) this.formName = input.value.trim();
      const checked = drawer.querySelector<HTMLInputElement>('input[name="notification-preference"]:checked');
      if (checked?.value === 'realtime' || checked?.value === 'digest' || checked?.value === 'no') {
        this.formFrequency = checked.value;
      }
    };
    input?.addEventListener('input', readName);
    const save = drawer.querySelector(SEL.drawerSaveButton);
    save?.addEventListener('click', readName, { capture: true });
    this.drawerCleanup = () => {
      input?.removeEventListener('input', readName);
      save?.removeEventListener('click', readName, { capture: true });
    };
  }

  private detachFromDrawer(): void {
    this.drawerCleanup();
    this.drawerCleanup = () => undefined;
    this.drawer = null;
  }

  private go(step: Step): void {
    const changed = JSON.stringify(step) !== JSON.stringify(this.step);
    const stepChanged = step.name !== this.step.name;
    this.step = step;
    if (changed) this.render();
    // Bring keyboard and screen reader users to the new step (not while Discogs' form has focus).
    if (stepChanged && step.name !== 'drawer' && step.name !== 'help-closed' && step.name !== 'checking') {
      this.focusTitle();
    }
    this.point();
  }

  private focusTitle(): void {
    this.root.querySelector<HTMLElement>('#cb-coach-title')?.focus({ preventScroll: true });
  }

  /** Moves the pink ring to whatever the user should click next. */
  private point(): void {
    const s = this.step;
    if (s.name === 'save') {
      this.spotlight.show(findSaveSearchButton(), t('coachRingSave'), true);
    } else if (s.name === 'drawer') {
      const drawer = findOpenDrawer();
      if (s.emailOff) {
        this.spotlight.show(drawer?.querySelector('a[href*="notification"]') ?? null, '');
      } else {
        this.spotlight.show(drawer?.querySelector(SEL.drawerSaveButton) ?? null, t('coachRingSave'));
      }
    } else if (s.name === 'delete') {
      this.spotlight.show(findDeleteButton(), t('coachRingSave'), true);
    } else if (s.name === 'help-open' && s.topic === 'delete') {
      this.spotlight.show(findSavedSearchesSelect(), t('coachRingSavedSearches'), true);
    } else {
      this.spotlight.hide();
    }
  }

  private close(): void {
    this.dismissed = true;
    this.spotlight.hide();
    this.clearTimers();
    if (this.pending) void clearPendingAlert(this.pending.releaseIds);
    if (this.deleteRequest) void deleteRequestItem.setValue(null);
    this.deleteRequest = null;
    this.pending = null;
    replaceChildren(this.root);
  }

  private panel(content: (HTMLElement | null)[], options: { passive?: boolean; closable?: boolean } = {}): HTMLElement {
    return h(
      'section',
      {
        class: `cb-coach${options.passive ? ' cb-coach--passive' : ''}`,
        role: 'region',
        'aria-labelledby': 'cb-coach-title',
      },
      h(
        'div',
        { class: 'cb-coach__bar' },
        h('span', { class: 'cb-disc cb-disc--xs' }, icon('bell')),
        h('span', { class: 'cb-grow' }, t('appName')),
        options.closable === false
          ? null
          : h(
              'button',
              {
                type: 'button',
                class: 'cb-btn',
                'aria-label': t('close'),
                dataset: { focusKey: 'close' },
                on: { click: () => this.close() },
              },
              icon('close'),
            ),
      ),
      h('div', { class: 'cb-coach__content' }, content),
    );
  }

  private render(): void {
    renderKeepingFocus(this.root, () => this.draw());
  }

  private draw(): void {
    const s = this.step;
    const title = (text: string) => h('h2', { class: 'cb-coach__title', id: 'cb-coach-title', tabindex: '-1' }, text);
    const text = (value: string) => h('p', { class: 'cb-coach__text' }, value);
    const button = (key: string, label: string, onClick: () => void, variant = 'secondary', ...extra: Node[]) =>
      h(
        'button',
        { type: 'button', class: `cb-btn cb-btn--${variant}`, dataset: { focusKey: key }, on: { click: onClick } },
        ...extra,
        label,
      );

    switch (s.name) {
      case 'help-closed':
        replaceChildren(
          this.root,
          h(
            'button',
            {
              type: 'button',
              class: 'cb-pill',
              dataset: { focusKey: 'pill' },
              on: { click: () => this.go({ name: 'help-open', topic: 'menu' }) },
            },
            h('span', { class: 'cb-disc cb-disc--xs' }, icon('bell')),
            t('coachHelpPill'),
          ),
        );
        return;

      case 'help-open':
        replaceChildren(
          this.root,
          this.panel(
            s.topic === 'menu'
              ? [
                  title(t('coachHelpTitle')),
                  h(
                    'div',
                    { class: 'cb-coach__actions' },
                    button(
                      'delete',
                      t('coachHelpDelete'),
                      () => this.go({ name: 'help-open', topic: 'delete' }),
                      'secondary cb-btn--block',
                      icon('trash'),
                    ),
                    button('new', t('coachHelpNew'), () => openGuide('how'), 'secondary cb-btn--block', icon('bell')),
                  ),
                  h(
                    'p',
                    { class: 'cb-small cb-muted' },
                    t('coachHelpLimits', [String(MAX_SAVED_ALERTS), String(MAX_DAILY_DIGEST_ALERTS)]),
                  ),
                ]
              : [
                  title(t('coachDeleteTitle')),
                  h(
                    'ol',
                    { class: 'cb-steps' },
                    [t('coachDelete1'), t('coachDelete2'), t('coachDelete3')].map((line, i) =>
                      h(
                        'li',
                        { class: `cb-step${i === 0 ? ' cb-step--current' : ''}` },
                        h('span', { class: 'cb-step__num', 'aria-hidden': 'true' }, String(i + 1)),
                        h('p', { class: 'cb-step__text' }, line),
                      ),
                    ),
                  ),
                  text(t('coachDeleteNote')),
                  h(
                    'div',
                    { class: 'cb-coach__actions' },
                    button('done', t('done'), () => this.go({ name: 'help-closed' }), 'ghost'),
                  ),
                ],
          ),
        );
        return;

      case 'down':
        replaceChildren(
          this.root,
          this.panel([
            title(t('coachDownTitle')),
            text(t('coachDownText')),
            h(
              'div',
              { class: 'cb-coach__actions' },
              button('reload', t('reload'), () => window.location.reload(), 'primary'),
            ),
          ]),
        );
        return;

      case 'save': {
        const pending = this.pending;
        const count = pending?.releaseIds.length ?? 0;
        const intro =
          pending?.kind === 'master'
            ? count === 1
              ? t('coachSaveTextMasterOne')
              : t('coachSaveTextMaster', String(count))
            : t('coachSaveText');
        replaceChildren(
          this.root,
          this.panel([
            title(t('coachSaveTitle')),
            text(intro),
            pending?.truncated
              ? h('div', { class: 'cb-notice cb-notice--info' }, icon('info'), h('span', null, t('coachTruncated')))
              : null,
            h(
              'div',
              { class: 'cb-coach__actions' },
              button(
                'open-form',
                t('coachOpenForm'),
                () => findSaveSearchButton()?.click(),
                'primary',
                icon('arrowRight'),
              ),
              button('cancel', t('cancel'), () => this.close(), 'ghost'),
            ),
          ]),
        );
        return;
      }

      case 'drawer': {
        const frequency =
          this.pending?.frequency === 'digest' ? t('frequencyDigestShort') : t('frequencyRealtimeShort');
        replaceChildren(
          this.root,
          this.panel(
            [
              title(t('coachDrawerTitle')),
              text(
                this.nameWasFilled
                  ? t('coachDrawerText', [this.formName ?? '', frequency])
                  : t('coachDrawerTextKept', frequency),
              ),
              s.emailOff ? h('div', { class: 'cb-notice' }, icon('mail'), h('span', null, t('coachEmailOff'))) : null,
              s.error
                ? h(
                    'div',
                    { class: 'cb-notice cb-notice--error' },
                    icon('warning'),
                    h('span', null, t(`coachError_${s.error.replace(/-/g, '_')}` as MessageKey)),
                  )
                : null,
              h('p', { class: 'cb-small cb-muted' }, t('coachDrawerNote')),
            ],
            { passive: true, closable: false },
          ),
        );
        return;
      }

      case 'delete':
        replaceChildren(
          this.root,
          this.panel([
            title(t('coachDeleteOneTitle')),
            text(s.phase === 'confirm' ? t('coachDeleteOneConfirm') : t('coachDeleteOnePick', s.alertName)),
            h('p', { class: 'cb-small cb-muted' }, t('coachDeleteNote')),
            h(
              'div',
              { class: 'cb-coach__actions' },
              button('cancel', t('cancel'), () => this.close(), 'ghost'),
            ),
          ]),
        );
        return;

      case 'deleted':
      case 'delete-missing':
        replaceChildren(
          this.root,
          this.panel([
            title(s.name === 'deleted' ? t('coachDeletedTitle') : t('coachDeleteMissingTitle')),
            text(s.name === 'deleted' ? t('coachDeletedText', s.alertName) : t('coachDeleteMissingText', s.alertName)),
            h(
              'div',
              { class: 'cb-coach__actions' },
              button('got-it', t('gotIt'), () => this.close(), 'primary'),
              button('back', t('coachBackToRecord'), () => history.back(), 'ghost'),
            ),
          ]),
        );
        return;

      case 'checking':
        replaceChildren(
          this.root,
          this.panel([
            title(t('coachCheckingTitle')),
            h('p', { class: 'cb-coach__text', role: 'status' }, t('coachCheckingText')),
          ]),
        );
        return;

      case 'done':
        replaceChildren(
          this.root,
          this.panel([
            title(t('coachDoneTitle')),
            h(
              'div',
              { class: 'cb-notice cb-notice--success' },
              icon('check'),
              h(
                'span',
                null,
                s.frequency === 'digest'
                  ? t('coachDoneTextDigest', s.alertName)
                  : s.frequency === 'no'
                    ? t('coachDoneTextNoEmail', s.alertName)
                    : t('coachDoneTextRealtime', s.alertName),
              ),
            ),
            text(t('coachDoneRemove')),
            h(
              'div',
              { class: 'cb-coach__actions' },
              button('got-it', t('gotIt'), () => this.close(), 'primary'),
              button('back', t('coachBackToRecord'), () => history.back(), 'ghost'),
            ),
            h(
              'p',
              { class: 'cb-coach__coffee' },
              icon('cup'),
              h(
                'span',
                null,
                `${t('coffeeLine')} `,
                h('a', { class: 'cb-link', href: KOFI_URL, target: '_blank', rel: 'noopener' }, t('coffeeLink')),
              ),
            ),
          ]),
        );
        return;
    }
  }
}
