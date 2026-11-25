import '@/assets/highlighter.css';
import '@/assets/pages.css';
import './style.css';
import { wantlisterHomeUrl } from '@/lib/discogs/urls';
import { translatePage } from '@/lib/i18n';
import { FEEDBACK_URL, ISSUES_URL, KOFI_URL, PRIVACY_URL, REPO_URL } from '@/lib/links';
import { mountEmailStatus } from '@/lib/pages/email-status-view';
import { hasCustomFilters, mountFeatureToggles, mountFullPrefs, summarizeFilters } from '@/lib/pages/prefs-form';
import { getPrefs } from '@/lib/store';
import { icon } from '@/lib/ui/content-ui';
import { svg } from '@/lib/ui/dom';
import { ICONS, RECORD_BELL_ILLUSTRATION } from '@/lib/ui/icons';

translatePage();

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const link = (id: string, href: string) => (($(id) as HTMLAnchorElement).href = href);

$('top-icon').append(icon('bell'));
$('hero-disc').append(svg(RECORD_BELL_ILLUSTRATION));
$('master-disc').append(svg(ICONS.crate));
$('coffee-disc').append(icon('cup'));

link('coffee', KOFI_URL);
link('issues', ISSUES_URL);
link('privacy', PRIVACY_URL);
link('source', REPO_URL);
link('open-wantlister', wantlisterHomeUrl());
link('link-saved', wantlisterHomeUrl());
link('link-wantlist', 'https://www.discogs.com/mywantlist');

mountEmailStatus($('email-status'));
link('feedback', FEEDBACK_URL);
link('feedback-foot', FEEDBACK_URL);
void mountFeatureToggles($('features'));

// "Your usual filters" folds away once filled in, with a one-line summary.
const fold = $('filters-fold') as HTMLDetailsElement;
const showSummary = (prefs: Awaited<ReturnType<typeof getPrefs>>) => {
  $('filters-summary').textContent = summarizeFilters(prefs);
};
void getPrefs().then((prefs) => {
  showSummary(prefs);
  fold.open = !hasCustomFilters(prefs) || location.hash === '#preferences';
});
void mountFullPrefs($('prefs'), showSummary);

// Open the matching FAQ entry or scroll to the section asked for (#how, #remove…).
if (location.hash) {
  requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
}
