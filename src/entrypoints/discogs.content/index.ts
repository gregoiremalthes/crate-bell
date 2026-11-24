import '@/assets/highlighter.css';
import '@/assets/content.css';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { parseDiscogsPage } from '@/lib/discogs/urls';
import { refreshEmailStatusIfStale } from '@/lib/email-status';
import { initMasterPage } from '@/lib/features/master';
import { initReleasePage } from '@/lib/features/release';
import { initSettingsPage } from '@/lib/features/settings';
import { initWantlisterPage } from '@/lib/features/wantlister';
import { injectFontFaces } from '@/lib/ui/content-ui';

/**
 * One content script for www.discogs.com that routes by page.
 * Only release, master, "Items I Want" and notification settings pages get any UI.
 */
export default defineContentScript({
  matches: ['https://www.discogs.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Discogs' shop is a single-page app: "Items I Want" can be reached without a page load.
    let coachStarted = false;
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (!coachStarted && parseDiscogsPage(newUrl.pathname).kind === 'wantlister') {
        coachStarted = true;
        injectFontFaces();
        void initWantlisterPage(ctx);
      }
    });

    const page = parseDiscogsPage(window.location.pathname);
    if (page.kind === 'other') return;
    if (page.kind === 'wantlister') coachStarted = true;

    injectFontFaces();
    // Keep the "are sale alert emails on?" answer fresh (at most every few hours).
    if (page.kind !== 'notification-settings') void refreshEmailStatusIfStale();

    switch (page.kind) {
      case 'release':
        return initReleasePage(ctx, page.id);
      case 'master':
        return initMasterPage(ctx, page.id);
      case 'wantlister':
        return initWantlisterPage(ctx);
      case 'notification-settings':
        return initSettingsPage(ctx);
    }
  },
});
