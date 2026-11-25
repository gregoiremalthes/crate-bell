// Captures the extension UI (from fixtures) for the store screenshots: `pnpm store-assets`.
import { expect, test } from '../tests/e2e/fixtures';

const OUT = 'store-assets/raw';

test('capture UI pieces', async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('https://www.discogs.com/master/26629-Daft-Punk-Homework');
  const master = page.locator('crate-bell-master .cb-card');
  await expect(master.locator('.cb-chip').first()).toBeVisible();
  await page.addStyleTag({ content: 'aside{width:360px;display:block}' });
  await page.waitForTimeout(300);
  await master.screenshot({ path: `${OUT}/master-card.png`, scale: 'device' });

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/guide-top.png` });
  await page.locator('#preferences').scrollIntoViewIfNeeded();
  await page.locator('#preferences').screenshot({ path: `${OUT}/guide-preferences.png` });

  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForTimeout(400);
  await page.locator('main').screenshot({ path: `${OUT}/popup.png` });
});
