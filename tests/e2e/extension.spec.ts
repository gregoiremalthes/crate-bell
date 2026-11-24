import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Our UI lives in shadow roots: Playwright's CSS locators pierce them. */
const card = (page: Page) => page.locator('crate-bell-release .cb-release');
const coach = (page: Page) => page.locator('crate-bell-coach');

async function expectVisibleText(locator: Locator, text: string | RegExp) {
  await expect(locator).toContainText(text);
}

test('release page: one button adds to the wantlist and guides the alert to the end', async ({ page }) => {
  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');

  // The card sits right after Discogs' own buttons.
  const host = page.locator('aside > .wrapper_QtM84 + crate-bell-release');
  await expect(host).toHaveCount(1);
  const button = card(page).getByRole('button', { name: "Alert me when it's for sale" });
  await expect(button).toBeVisible();

  await button.click();
  await page.waitForURL(/\/shop\/mywants\/\?release=3235$/);

  // Step "save": the coach points at Save Search.
  await expectVisibleText(coach(page), 'Almost there');
  await coach(page).getByRole('button', { name: 'Open the save form' }).click();

  // Step "drawer": name and frequency are pre-filled, never saved for the user.
  await expect(page.locator('#save-search-name')).toHaveValue('Daft Punk - Homework');
  await expect(page.locator('#realtime-notifications')).toBeChecked();
  await expectVisibleText(coach(page), 'Last step: click Save Search');

  await page.locator('[data-test="button-drawer-save-search"]').click();
  await expectVisibleText(coach(page), 'Your sale alert is set');
  await expectVisibleText(coach(page), 'Daft Punk - Homework');
  await expect(coach(page).getByRole('link', { name: 'Buy me a coffee' })).toHaveAttribute(
    'href',
    'https://ko-fi.com/gregoirep',
  );
});

test('release page: follows Discogs when the user adds to the wantlist with its own button', async ({ page }) => {
  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');
  await expect(card(page).getByRole('button', { name: "Alert me when it's for sale" })).toBeVisible();

  await page.locator('aside button', { hasText: 'Add to Wantlist' }).click();
  await expect(card(page).getByRole('button', { name: 'Set a sale alert' })).toBeVisible();
  await expectVisibleText(card(page), 'Added to your wantlist');
});

test('release page already in the wantlist opens the alert page directly', async ({ page }) => {
  await page.goto('https://www.discogs.com/release/3263269-Seiji-Seiji5');
  await card(page).getByRole('button', { name: 'Set a sale alert' }).click();
  await page.waitForURL(/\/shop\/mywants\/\?release=3263269$/);
  await expectVisibleText(coach(page), 'Almost there');
});

test('cancelling the save form brings the guide back to the first step', async ({ page }) => {
  await page.goto('https://www.discogs.com/release/3263269-Seiji-Seiji5');
  await card(page).getByRole('button', { name: 'Set a sale alert' }).click();
  await coach(page).getByRole('button', { name: 'Open the save form' }).click();
  // The name is already taken in the fixture: Crate Bell picks a unique one.
  await expect(page.locator('#save-search-name')).toHaveValue('Seiji - Seiji5 (2)');
  await page.locator('[data-slot="sheet-content"] button', { hasText: 'Cancel' }).click();
  await expectVisibleText(coach(page), 'Almost there');
});

test('master page: one alert for every pressing in the chosen formats', async ({ page }) => {
  await page.goto('https://www.discogs.com/master/26629-Daft-Punk-Homework');
  const master = page.locator('crate-bell-master');
  await expectVisibleText(master, 'Want any pressing of this album?');
  await expect(master.getByRole('button', { name: 'Vinyl (2)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(master.getByRole('button', { name: 'CD (1)' })).toHaveAttribute('aria-pressed', 'false');

  await master.getByRole('button', { name: 'CD (1)' }).click();
  await master.getByRole('button', { name: 'Set the alert for 3 pressings' }).click();
  await page.waitForURL(/\/shop\/mywants\//);
  // Oldest first, as Discogs lists the versions.
  expect(new URL(page.url()).searchParams.getAll('release')).toEqual(['2414200', '3235', '608487']);
  await expectVisibleText(coach(page), '3 pressings are selected');
});

test('Items I Want without a pending alert shows a small help button', async ({ page }) => {
  await page.goto('https://www.discogs.com/shop/mywants/');
  await coach(page).getByRole('button', { name: 'Crate Bell help' }).click();
  await coach(page).getByRole('button', { name: 'Delete a sale alert' }).click();
  await expectVisibleText(coach(page), 'Pick the alert in the Saved Searches list');
});

test('notification settings: the right line is pointed out and the state remembered', async ({ page, extensionId }) => {
  await page.goto('https://www.discogs.com/settings/notifications');
  await expectVisibleText(page.locator('crate-bell-settings'), 'It is on');
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expectVisibleText(page.locator('#email-status'), 'On');
});

test('guide page: translated, and preferences are saved', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Never miss a record you want');
  // No untranslated key left on the page.
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).not.toMatch(/\b(?:coach|master|release|faq|mock|nav|prefs)[A-Z][A-Za-z0-9_]*\b/);

  await page.getByLabel('Record condition').selectOption('VG+');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Record condition')).toHaveValue('VG+');
});

test('preferences are applied to the alert page URL', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByLabel('Record condition').selectOption('NM');
  await page.getByLabel('Germany').check();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.goto('https://www.discogs.com/release/3263269-Seiji-Seiji5');
  await card(page).getByRole('button', { name: 'Set a sale alert' }).click();
  await page.waitForURL(/\/shop\/mywants\//);
  const params = new URL(page.url()).searchParams;
  expect(params.getAll('mediaCondition')).toEqual(['Mint (M)', 'Near Mint (NM or M-)']);
  expect(params.getAll('shipsFrom')).toEqual(['Germany']);
});
