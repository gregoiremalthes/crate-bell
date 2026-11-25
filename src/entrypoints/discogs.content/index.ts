import '@/assets/highlighter.css';
import '@/assets/content.css';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { parseDiscogsPage } from '@/lib/discogs/urls';
import { refreshEmailStatusIfStale } from '@/lib/email-status';
import { initMasterPage } from '@/lib/features/master';
import { initReleasePage, initShopItemPage } from '@/lib/features/release';
import { initSettingsPage } from '@/lib/features/settings';
import { initWantlistPage } from '@/lib/features/wantlist';
import { initWantlisterPage } from '@/lib/features/wantlister';
import { getPrefs } from '@/lib/store';
import { injectFontFaces } from '@/lib/ui/content-ui';

/**
 * One content script for www.discogs.com that routes by page.
 * Only release, master, wantlist, "Items I Want" and notification settings pages get any UI.
 */
export default defineContentScript({
  matches: ['https://www.discogs.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Discogs' shop is a single-page app: "Items I Want" can be reached, and left, without a page load.
    let coach: Awaited<ReturnType<typeof initWantlisterPage>> | null = null;
    let coachStarting = false;
    const startCoach = async () => {
      if (coach || coachStarting) return;
      coachStarting = true;
      injectFontFaces();
      coach = await initWantlisterPage(ctx);
      coachStarting = false;
    };
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (parseDiscogsPage(newUrl.pathname).kind === 'wantlister') {
        void getPrefs().then(({ features }) => {
          if (features.guide) void startCoach();
        });
      } else if (coach) {
        coach.remove();
        coach = null;
      }
    });

    const page = parseDiscogsPage(window.location.pathname);
    if (page.kind === 'other') return;
    const { features } = await getPrefs();

    injectFontFaces();
    // Keep the "are sale alert emails on?" answer fresh (at most every few hours).
    if (page.kind !== 'notification-settings') void refreshEmailStatusIfStale();

    switch (page.kind) {
      case 'release':
        return features.release ? initReleasePage(ctx, page.id) : undefined;
      case 'master':
        return features.master ? initMasterPage(ctx, page.id) : undefined;
      case 'wantlister':
        return features.guide ? startCoach() : undefined;
      case 'notification-settings':
        return initSettingsPage(ctx);
      case 'shop-item':
        return features.release ? initShopItemPage(ctx) : undefined;
      case 'wantlist':
        return features.wantlist ? initWantlistPage(ctx) : undefined;
    }
  },
});
