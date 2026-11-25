import '@/assets/highlighter.css';
import '@/assets/pages.css';
import './style.css';
import { browser } from 'wxt/browser';
import { translatePage } from '@/lib/i18n';
import { FEEDBACK_URL, KOFI_URL } from '@/lib/links';
import { mountEmailStatus } from '@/lib/pages/email-status-view';
import { mountQuickPrefs } from '@/lib/pages/prefs-form';
import { icon } from '@/lib/ui/content-ui';

translatePage();

const $ = (id: string) => document.getElementById(id) as HTMLElement;

$('bar-icon').append(icon('bell'));
$('coffee-icon').append(icon('cup'));
($('coffee') as HTMLAnchorElement).href = KOFI_URL;
($('feedback') as HTMLAnchorElement).href = FEEDBACK_URL;

mountEmailStatus($('email-status'));
void mountQuickPrefs($('prefs'));

const openGuide = async (section: string) => {
  await browser.tabs.create({ url: browser.runtime.getURL(`/options.html#${section}` as '/options.html') });
  window.close();
};
$('more-prefs').addEventListener('click', () => void openGuide('on-discogs'));
$('how').addEventListener('click', () => void openGuide('how'));
$('remove').addEventListener('click', () => void openGuide('remove'));
