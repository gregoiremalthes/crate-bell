// Builds the Chrome Web Store images from store-assets/templates (HTML) and store-assets/raw (screenshots).
// Run `pnpm build` first. Live Discogs screenshots in raw/ are taken by hand, with personal details blurred.
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

execSync('pnpm exec playwright test --config scripts/playwright.capture.config.ts', { stdio: 'inherit' });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const sizes = { 'promo-small': [440, 280], 'promo-marquee': [1400, 560] };
for (const file of readdirSync('store-assets/templates').filter((f) => f.endsWith('.html'))) {
  const name = file.replace('.html', '');
  const [width, height] = sizes[name] ?? [1280, 800];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`file://${resolve('store-assets/templates', file)}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `store-assets/${name}.png` });
  await page.close();
}
await browser.close();
console.log('Store assets written to store-assets/');
