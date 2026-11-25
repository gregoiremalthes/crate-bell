import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { findEmailSettingRow, parseEmailSetting } from '../discogs/selectors';
import { t } from '../i18n';
import { emailStatusItem } from '../store';
import { icon } from '../ui/content-ui';
import { h, waitFor } from '../ui/dom';

/**
 * On Discogs' notification settings page: point at the one box sale alerts need,
 * and remember whether it is ticked (as saved, not as currently clicked).
 */
export async function initSettingsPage(ctx: ContentScriptContext): Promise<void> {
  const row = await waitFor(() => findEmailSettingRow(), 10_000);
  if (!row) return;

  const state = parseEmailSetting(document);
  if (state === 'on' || state === 'off') {
    await emailStatusItem.setValue({ state, checkedAt: Date.now() });
  }

  const cell = row.querySelector('td:last-child') ?? row;
  const highlight = (row as HTMLElement).style;
  highlight.outline = '2px solid #f05fa3';
  highlight.outlineOffset = '1px';

  const ui = await createShadowRootUi(ctx, {
    name: 'crate-bell-settings',
    position: 'inline',
    anchor: cell,
    append: 'last',
    onMount: (container) => {
      container.appendChild(
        h(
          'div',
          { class: 'cb-root cb-settings-hint', role: 'note' },
          icon(state === 'on' ? 'check' : 'arrowRight'),
          h('span', null, state === 'on' ? t('settingsHintOn') : t('settingsHintOff')),
        ),
      );
    },
  });
  ui.mount();
  if (state !== 'on') row.scrollIntoView({ block: 'center' });
}
