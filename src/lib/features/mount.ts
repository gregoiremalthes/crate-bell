import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { onDomChange } from '../ui/dom';

/**
 * Discogs is a React app: it can re-render the column we sit in and drop our element, and its
 * buttons can appear after we first placed the card. This puts the UI back right after the anchor
 * whenever it is missing or no longer next to it.
 */
export function keepMounted<T>(
  ctx: ContentScriptContext,
  ui: ShadowRootContentScriptUi<T>,
  anchor: () => Element | null,
  placement: 'after' | 'last' = 'after',
): void {
  const inPlace = (target: Element) =>
    placement === 'after' ? ui.shadowHost.previousElementSibling === target : ui.shadowHost.parentElement === target;
  const ensure = () => {
    const target = anchor();
    if (!target) return;
    if (ui.shadowHost.isConnected && inPlace(target)) return;
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
