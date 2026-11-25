import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';

const EXTENSION = resolve('.output/chrome-mv3');
const FIXTURES = resolve('tests/fixtures');

const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

/** Plays the part of Discogs' React code: buttons change state when clicked. */
const SIMULATOR = readFileSync(resolve('tests/e2e/discogs-simulator.js'), 'utf8');
const withSimulator = (html: string) => html.replace('</body>', `<script>${SIMULATOR}</script></body>`);

/** The "Items I Want" page as it first loads: save drawer closed. */
function wantlisterPage(): string {
  const html = read('wantlister.html');
  const start = html.indexOf('<div role="dialog"');
  const end = html.indexOf('</div>', start) + '</div>'.length;
  const drawer = html.slice(start, end);
  return withSimulator(html.slice(0, start) + `<template id="drawer-template">${drawer}</template>` + html.slice(end));
}

const MASTER_VERSIONS = {
  pagination: { pages: 1, items: 4 },
  versions: [
    { id: 2414200, released: '1996', major_formats: ['Vinyl'] },
    { id: 3235, released: '1997', major_formats: ['CD'] },
    { id: 608487, released: '1997', major_formats: ['Vinyl'] },
    { id: 17026089, released: '1996', major_formats: ['Cassette'] },
  ],
};

async function routeDiscogs(context: BrowserContext): Promise<void> {
  await context.route('https://www.discogs.com/**', (route) => {
    const { pathname } = new URL(route.request().url());
    const html = (body: string) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    if (/^\/release\/3235/.test(pathname)) return html(withSimulator(read('release-not-in-wantlist.html')));
    if (/^\/release\/3263269/.test(pathname)) return html(withSimulator(read('release-in-wantlist.html')));
    if (/^\/master\//.test(pathname)) return html(withSimulator(read('master.html')));
    if (/^\/shop\/mywants/.test(pathname)) return html(wantlisterPage());
    if (/^\/settings\/notifications/.test(pathname)) return html(read('settings-notifications.html'));
    if (/^\/shop\/item\//.test(pathname)) return html(withSimulator(read('shop-item.html')));
    if (/^\/mywantlist/.test(pathname)) {
      const big = new URL(route.request().url()).searchParams.get('layout') === 'big';
      return html(read(big ? 'wantlist-cards.html' : 'wantlist.html'));
    }
    return html('<!doctype html><html><body><header></header><p>Discogs</p></body></html>');
  });
  await context.route('https://api.discogs.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(MASTER_VERSIONS),
    }),
  );
}

export const test = base.extend<{ context: BrowserContext; extensionId: string; serviceWorker: Worker }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      // Extensions need full Chromium (not the headless shell): channel 'chromium', or a Chrome for Testing path.
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chromium' }),
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--lang=en-US'],
    });
    await routeDiscogs(context);
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
