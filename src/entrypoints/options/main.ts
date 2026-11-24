import '@/assets/highlighter.css';
import '@/assets/pages.css';
import './style.css';
import { wantlisterHomeUrl } from '@/lib/discogs/urls';
import { translatePage } from '@/lib/i18n';
import { ISSUES_URL, KOFI_URL, PRIVACY_URL, REPO_URL } from '@/lib/links';
import { mountEmailStatus } from '@/lib/pages/email-status-view';
import { mountFullPrefs } from '@/lib/pages/prefs-form';
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
void mountFullPrefs($('prefs'));

// Open the matching FAQ entry or scroll to the section asked for (#how, #remove…).
if (location.hash) {
  requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
}
