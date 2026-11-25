import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { GOODBYE_URL } from '@/lib/links';

type Message = { type: 'open-guide'; section?: string };

export default defineBackground(() => {
  // First install: open the guide so people see the one setting sale alerts need.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void openGuide('welcome');
  });

  // Optional one-question goodbye page. No data is attached to the URL.
  void browser.runtime.setUninstallURL(GOODBYE_URL).catch(() => undefined);

  browser.runtime.onMessage.addListener((message: Message) => {
    if (message?.type === 'open-guide') void openGuide(message.section);
    return undefined;
  });
});

async function openGuide(section?: string): Promise<void> {
  const url = browser.runtime.getURL(`/options.html${section ? `#${section}` : ''}`);
  await browser.tabs.create({ url });
}
