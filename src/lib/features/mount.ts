import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { onDomChange } from '../ui/dom';

/**
 * Discogs is a React app: it can re-render the column we sit in and drop our element.
 * This puts the UI back whenever that happens, as long as the anchor still exists.
 */
export function keepMounted<T>(
  ctx: ContentScriptContext,
  ui: ShadowRootContentScriptUi<T>,
  anchor: () => Element | null,
): void {
  const ensure = () => {
    if (ui.shadowHost.isConnected) return;
    if (!anchor()) return;
    ui.remove();
    ui.mount();
  };
  ui.mount();
  const stop = onDomChange(ensure);
  ctx.onInvalidated(() => {
    stop();
    ui.remove();
  });
}
