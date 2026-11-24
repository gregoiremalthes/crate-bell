import { notificationSettingsUrl } from '../discogs/urls';
import { checkEmailSetting } from '../email-status';
import { t } from '../i18n';
import { type EmailStatus, emailStatusItem } from '../store';
import { icon } from '../ui/content-ui';
import { h, replaceChildren } from '../ui/dom';

/** "Sale alert emails: on / off / not checked yet", with the one action that fixes it. */
export function mountEmailStatus(container: HTMLElement): () => void {
  let checking = false;

  const render = (status: EmailStatus | null) => {
    const state = status?.state ?? 'unknown';
    const kind = state === 'on' ? 'on' : state === 'off' ? 'off' : 'unknown';
    const title =
      state === 'on'
        ? t('emailOnTitle')
        : state === 'off'
          ? t('emailOffTitle')
          : state === 'logged-out'
            ? t('emailLoggedOutTitle')
            : t('emailUnknownTitle');
    const text =
      state === 'on'
        ? t('emailOnText')
        : state === 'off'
          ? t('emailOffText')
          : state === 'logged-out'
            ? t('emailLoggedOutText')
            : t('emailUnknownText');

    const settingsLink = h(
      'a',
      {
        class: `cb-btn ${state === 'on' ? 'cb-btn--secondary' : 'cb-btn--primary'} cb-btn--sm`,
        href: notificationSettingsUrl(),
        target: '_blank',
        rel: 'noopener',
      },
      state === 'on' ? t('emailOpenSettings') : t('emailTurnOn'),
      icon('external'),
    );
    const checkButton = h(
      'button',
      {
        type: 'button',
        class: 'cb-btn cb-btn--ghost cb-btn--sm',
        'aria-busy': checking ? 'true' : undefined,
        on: {
          click: async () => {
            if (checking) return;
            checking = true;
            render(status);
            const next = await checkEmailSetting();
            checking = false;
            render(next);
          },
        },
      },
      checking ? t('emailChecking') : t('emailCheckAgain'),
    );

    replaceChildren(
      container,
      h(
        'div',
        { class: `cb-status cb-status--${kind}`, role: 'status', 'aria-live': 'polite' },
        h(
          'span',
          { class: 'cb-status__dot', 'aria-hidden': 'true' },
          icon(kind === 'on' ? 'check' : kind === 'off' ? 'warning' : 'mail'),
        ),
        h(
          'div',
          null,
          h('p', { class: 'cb-status__title' }, title),
          h('p', { class: 'cb-small' }, text),
          h('div', { class: 'cb-status__actions' }, settingsLink, checkButton),
        ),
      ),
    );
  };

  void emailStatusItem.getValue().then(async (status) => {
    render(status);
    if (!status || status.state === 'unknown') render(await checkEmailSetting());
  });
  return emailStatusItem.watch((status) => render(status));
}
