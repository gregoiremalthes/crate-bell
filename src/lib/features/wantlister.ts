import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { makeUnique } from '../alert-name';
import { MAX_DAILY_DIGEST_ALERTS, MAX_SAVED_ALERTS } from '../discogs/constants';
import {
  type DrawerError,
  findOpenDrawer,
  findSavedSearchesSelect,
  findSaveSearchButton,
  isDefaultAlertName,
  isWantlisterDown,
  readDrawerEmailCheckbox,
  readDrawerError,
  readSavedSearchNames,
  SEL,
  setNativeInputValue,
} from '../discogs/selectors';
import { releaseIdsFromSearch } from '../discogs/urls';
import { type MessageKey, t } from '../i18n';
import { KOFI_URL } from '../links';
import { alertsSetItem, isPendingFresh, type PendingAlert, pendingAlertItem, pendingMatchesPage } from '../store';
import { icon, openGuide, Spotlight } from '../ui/content-ui';
import { h, onDomChange, replaceChildren } from '../ui/dom';

/** How long after the save form closes we keep looking for the new alert in Discogs' list. */
const SAVE_CONFIRM_WINDOW_MS = 8_000;

type Step =
  | { name: 'help-closed' }
  | { name: 'help-open'; topic: 'menu' | 'delete' }
  | { name: 'down' }
  | { name: 'save' }
  | { name: 'drawer'; error: DrawerError | null; emailOff: boolean }
  | { name: 'done'; alertName: string; frequency: PendingAlert['frequency'] };

/**
 * The guide shown on Discogs' "Items I Want" page: it points at "Save Search", fills in the
 * name and email frequency, and confirms when the alert is saved. It never clicks "Save" itself:
 * the user stays in control of their account.
 */
export async function initWantlisterPage(ctx: ContentScriptContext): Promise<void> {
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
}

class Coach {
  private root: HTMLElement;
  private spotlight: Spotlight;
  private step: Step = { name: 'help-closed' };
  private pending: PendingAlert | null = null;
  private stop: () => void = () => undefined;
  private filledDrawer: Element | null = null;
  private dismissed = false;
  private lastFilledName: string | null = null;
  private savedCountBefore = 0;
  private closedAt = 0;

  constructor(container: HTMLElement) {
    this.root = h('div', { class: 'cb-root' });
    container.appendChild(this.root);
    this.spotlight = new Spotlight(container);
    void this.start();
  }

  destroy(): void {
    this.stop();
    this.spotlight.destroy();
  }

  private async start(): Promise<void> {
    const pending = await pendingAlertItem.getValue();
    const pageIds = releaseIdsFromSearch(window.location.search);
    if (isPendingFresh(pending) && pendingMatchesPage(pending, pageIds)) {
      this.pending = pending;
      this.step = { name: 'save' };
    } else if (pending && !isPendingFresh(pending)) {
      await pendingAlertItem.setValue(null);
    }
    this.render();
    this.stop = onDomChange(() => this.update());
    this.update();
  }

  /** Re-evaluates where the user is in the flow after every change on the page. */
  private update(): void {
    if (this.dismissed) return;
    this.go(this.nextStep());
  }

  /** Works out which step the user is at, from what is on the page right now. */
  private nextStep(): Step {
    if (isWantlisterDown()) return { name: 'down' };
    if (!this.pending) return this.step.name === 'down' ? { name: 'help-closed' } : this.step;
    if (this.step.name === 'done') return this.step;

    const drawer = findOpenDrawer();
    if (drawer) {
      if (this.filledDrawer !== drawer) {
        this.filledDrawer = drawer;
        this.fillDrawer(drawer, this.pending);
      }
      // Follow what the user types, to recognise the alert once saved.
      const input = drawer.querySelector<HTMLInputElement>(SEL.drawerNameInput);
      if (input?.value.trim()) this.lastFilledName = input.value.trim();
      return {
        name: 'drawer',
        error: readDrawerError(drawer),
        emailOff: readDrawerEmailCheckbox(drawer) === false,
      };
    }

    if (this.filledDrawer) {
      // The form just closed: saved, or cancelled? Discogs may refresh its list a moment later.
      this.filledDrawer = null;
      this.closedAt = Date.now();
    }
    if (this.closedAt && Date.now() - this.closedAt < SAVE_CONFIRM_WINDOW_MS) {
      const saved = this.findSavedName();
      if (saved) {
        this.closedAt = 0;
        void pendingAlertItem.setValue(null);
        void alertsSetItem.getValue().then((n) => alertsSetItem.setValue(n + 1));
        return { name: 'done', alertName: saved, frequency: this.pending.frequency };
      }
    }
    return { name: 'save' };
  }

  /** After saving, Discogs adds the new alert to its "Saved Searches" list. */
  private findSavedName(): string | null {
    if (!this.pending) return null;
    const expected = this.lastFilledName?.toLowerCase();
    const names = readSavedSearchNames();
    if (expected) {
      const match = names.find((n) => n.toLowerCase() === expected);
      if (match) return match;
    }
    const select = findSavedSearchesSelect();
    const selected = select?.selectedOptions[0];
    if (select && selected && selected.value !== '-1' && names.length > this.savedCountBefore) {
      return selected.text.trim();
    }
    return null;
  }

  private fillDrawer(drawer: Element, pending: PendingAlert): void {
    this.savedCountBefore = readSavedSearchNames().length;
    const input = drawer.querySelector<HTMLInputElement>(SEL.drawerNameInput);
    if (input && isDefaultAlertName(input.value)) {
      const name = makeUnique(pending.name, readSavedSearchNames());
      setNativeInputValue(input, name);
      this.lastFilledName = name;
    } else {
      this.lastFilledName = input?.value ?? null;
    }
    const radio = drawer.querySelector<HTMLInputElement>(SEL.frequencyRadio(pending.frequency));
    if (radio && !radio.checked) radio.click();
  }

  private go(step: Step): void {
    const same = JSON.stringify(step) === JSON.stringify(this.step);
    this.step = step;
    if (!same) this.render();
    this.point();
  }

  /** Moves the pink ring to whatever the user should click next. */
  private point(): void {
    const s = this.step;
    if (s.name === 'save') {
      this.spotlight.show(findSaveSearchButton(), t('coachRingSave'), true);
    } else if (s.name === 'drawer') {
      const drawer = findOpenDrawer();
      if (s.emailOff) {
        const link = drawer?.querySelector('a[href*="notification"]') ?? null;
        this.spotlight.show(link, '');
      } else {
        this.spotlight.show(drawer?.querySelector(SEL.drawerSaveButton) ?? null, t('coachRingSave'));
      }
    } else if (s.name === 'help-open' && s.topic === 'delete') {
      this.spotlight.show(findSavedSearchesSelect(), t('coachRingSavedSearches'), true);
    } else {
      this.spotlight.hide();
    }
  }

  private close(): void {
    this.dismissed = true;
    this.spotlight.hide();
    if (this.pending) void pendingAlertItem.setValue(null);
    this.pending = null;
    replaceChildren(this.root);
  }

  private panel(content: HTMLElement[], options: { passive?: boolean; closable?: boolean } = {}): HTMLElement {
    return h(
      'section',
      {
        class: `cb-coach${options.passive ? ' cb-coach--passive' : ''}`,
        role: 'dialog',
        'aria-modal': 'false',
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
              { type: 'button', class: 'cb-btn', 'aria-label': t('close'), on: { click: () => this.close() } },
              icon('close'),
            ),
      ),
      h('div', { class: 'cb-coach__content' }, content),
    );
  }

  private render(): void {
    const s = this.step;
    const title = (text: string) => h('h2', { class: 'cb-coach__title', id: 'cb-coach-title' }, text);
    const text = (value: string) => h('p', { class: 'cb-coach__text' }, value);

    switch (s.name) {
      case 'help-closed':
        replaceChildren(
          this.root,
          h(
            'button',
            { type: 'button', class: 'cb-pill', on: { click: () => this.go({ name: 'help-open', topic: 'menu' }) } },
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
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'cb-btn cb-btn--secondary cb-btn--block',
                        on: { click: () => this.go({ name: 'help-open', topic: 'delete' }) },
                      },
                      icon('trash'),
                      t('coachHelpDelete'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'cb-btn cb-btn--secondary cb-btn--block',
                        on: { click: () => openGuide('how') },
                      },
                      icon('bell'),
                      t('coachHelpNew'),
                    ),
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
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'cb-btn cb-btn--ghost',
                        on: { click: () => this.go({ name: 'help-closed' }) },
                      },
                      t('done'),
                    ),
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
              h(
                'button',
                { type: 'button', class: 'cb-btn cb-btn--primary', on: { click: () => window.location.reload() } },
                t('reload'),
              ),
            ),
          ]),
        );
        return;

      case 'save': {
        const pending = this.pending;
        replaceChildren(
          this.root,
          this.panel(
            [
              title(t('coachSaveTitle')),
              text(
                pending?.kind === 'master'
                  ? t('coachSaveTextMaster', String(pending.releaseIds.length))
                  : t('coachSaveText'),
              ),
              pending?.truncated
                ? h('div', { class: 'cb-notice cb-notice--info' }, icon('info'), h('span', null, t('coachTruncated')))
                : null,
              h(
                'div',
                { class: 'cb-coach__actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'cb-btn cb-btn--primary',
                    on: { click: () => findSaveSearchButton()?.click() },
                  },
                  t('coachOpenForm'),
                  icon('arrowRight'),
                ),
                h(
                  'button',
                  { type: 'button', class: 'cb-btn cb-btn--ghost', on: { click: () => this.close() } },
                  t('cancel'),
                ),
              ),
            ].filter(Boolean) as HTMLElement[],
          ),
        );
        return;
      }

      case 'drawer': {
        const frequency =
          this.pending?.frequency === 'digest' ? t('frequencyDigestShort') : t('frequencyRealtimeShort');
        const content: HTMLElement[] = [
          title(t('coachDrawerTitle')),
          text(t('coachDrawerText', [this.lastFilledName ?? '', frequency])),
        ];
        if (s.emailOff) {
          content.push(
            h('div', { class: 'cb-notice', role: 'alert' }, icon('mail'), h('span', null, t('coachEmailOff'))),
          );
        }
        if (s.error) {
          content.push(
            h(
              'div',
              { class: 'cb-notice cb-notice--error', role: 'alert' },
              icon('warning'),
              h('span', null, t(`coachError_${s.error.replace(/-/g, '_')}` as MessageKey)),
            ),
          );
        }
        content.push(h('p', { class: 'cb-small cb-muted' }, t('coachDrawerNote')));
        replaceChildren(this.root, this.panel(content, { passive: true, closable: false }));
        return;
      }

      case 'done':
        replaceChildren(
          this.root,
          this.panel([
            h(
              'div',
              { class: 'cb-notice cb-notice--success', role: 'status' },
              icon('check'),
              h('strong', null, t('coachDoneTitle')),
            ),
            text(
              s.frequency === 'digest'
                ? t('coachDoneTextDigest', s.alertName)
                : t('coachDoneTextRealtime', s.alertName),
            ),
            text(t('coachDoneRemove')),
            h(
              'div',
              { class: 'cb-coach__actions' },
              h(
                'button',
                { type: 'button', class: 'cb-btn cb-btn--primary', on: { click: () => this.close() } },
                t('gotIt'),
              ),
              h(
                'button',
                { type: 'button', class: 'cb-btn cb-btn--ghost', on: { click: () => history.back() } },
                t('coachBackToRecord'),
              ),
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
