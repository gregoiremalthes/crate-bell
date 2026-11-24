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

test('typing an existing name, then cancelling, never claims the alert is set', async ({ page }) => {
  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');
  await card(page).getByRole('button', { name: "Alert me when it's for sale" }).click();
  await page.waitForURL(/\/shop\/mywants\//);
  await coach(page).getByRole('button', { name: 'Open the save form' }).click();
  await page.locator('#save-search-name').fill('Seiji - Seiji5');
  await page.locator('[data-slot="sheet-content"] button', { hasText: 'Cancel' }).click();
  await expectVisibleText(coach(page), 'Almost there');
  await expect(coach(page)).not.toContainText('Your sale alert is set');
});

test('keyboard focus stays on the control the user pressed', async ({ page }) => {
  await page.goto('https://www.discogs.com/master/26629-Daft-Punk-Homework');
  const chip = page.locator('crate-bell-master').getByRole('button', { name: 'CD (1)' });
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toBeFocused();
});

test('after saving, the record page says the alert is on, and guides its deletion', async ({ page }) => {
  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');
  await card(page).getByRole('button', { name: "Alert me when it's for sale" }).click();
  await page.waitForURL(/\/shop\/mywants\//);
  await coach(page).getByRole('button', { name: 'Open the save form' }).click();
  await page.locator('[data-test="button-drawer-save-search"]').click();
  await expectVisibleText(coach(page), 'Your sale alert is set');

  // Back on the record: no more button, the alert's status instead. The page copy shows the record
  // out of the wantlist (as after a purchase), so the alert is shown as paused.
  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');
  const status = page.locator('crate-bell-release');
  await expectVisibleText(status, 'Sale alert paused');
  await expectVisibleText(status, '“Daft Punk - Homework”');
  await expect(status.getByRole('button', { name: "Alert me when it's for sale" })).toHaveCount(0);

  // Delete: Crate Bell opens the alert in Discogs' menu and points at Delete; the user confirms.
  await status.getByRole('button', { name: 'Delete the alert' }).click();
  await page.waitForURL(/\/shop\/mywants\//);
  await expectVisibleText(coach(page), 'Delete this alert');
  await expect(page.locator('[data-test="saved-searches"]')).toHaveValue('999999');
  await page
    .locator('[data-test="desktop-layout"] button', { hasText: /^Delete$/ })
    .first()
    .click();
  await expectVisibleText(coach(page), 'Click Delete again');
  await page.getByText('Are you sure').locator('..').getByRole('button', { name: 'Delete' }).click();
  await expectVisibleText(coach(page), 'Alert deleted');

  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');
  await expect(card(page).getByRole('button', { name: "Alert me when it's for sale" })).toBeVisible();
});

test("an alert opened in Discogs' Saved Searches menu is learned", async ({ page }) => {
  await page.goto('https://www.discogs.com/shop/mywants/');
  await page.locator('[data-test="saved-searches"]').selectOption('383573');
  await page.waitForTimeout(1_500);
  await page.goto('https://www.discogs.com/release/3263269-Seiji-Seiji5');
  const status = page.locator('crate-bell-release');
  await expectVisibleText(status, 'Sale alert on');
  await expectVisibleText(status, 'Saved on your Discogs account.');
  // Escape hatch when the memory is out of date.
  await status.getByRole('button', { name: 'Set a different alert' }).click();
  await expect(card(page).getByRole('button', { name: 'Set a sale alert' })).toBeVisible();
});

test('known alert: "on" on the record page, a tag on the wantlist, a button elsewhere', async ({
  page,
  serviceWorker,
}) => {
  await serviceWorker.evaluate(() =>
    // biome-ignore lint/suspicious/noExplicitAny: the chrome global only exists inside the extension
    (globalThis as any).chrome.storage.local.set({
      knownAlerts: [{ name: 'Seiji - Seiji5', releaseIds: [3263269], source: 'crate-bell', frequency: 'realtime' }],
    }),
  );
  await page.goto('https://www.discogs.com/release/3263269-Seiji-Seiji5');
  await expectVisibleText(page.locator('crate-bell-release'), 'Sale alert on');
  await expectVisibleText(page.locator('crate-bell-release'), 'Discogs emails you as soon as a copy is listed.');

  await page.goto('https://www.discogs.com/mywantlist');
  const seiji = page.locator('tr.wantlist_r3263269 crate-bell-row');
  const homework = page.locator('tr.wantlist_r3235 crate-bell-row');
  await expect(seiji).toContainText('Alert on');
  await expect(homework.getByRole('button', { name: 'Set a sale alert for Homework' })).toBeVisible();

  // Clicking our button must not trigger Discogs' "open the record" on the row.
  await homework.getByRole('button').click();
  await page.waitForURL(/\/shop\/mywants\/\?release=3235$/);
  await expectVisibleText(coach(page), 'Almost there');
  await coach(page).getByRole('button', { name: 'Open the save form' }).click();
  await expect(page.locator('#save-search-name')).toHaveValue('Daft Punk - Homework');
});

test('wantlist page, large cards layout', async ({ page }) => {
  await page.goto('https://www.discogs.com/mywantlist?layout=big');
  await expect(
    page.locator('li.card crate-bell-row').getByRole('button', { name: 'Set a sale alert for Seiji5' }),
  ).toBeVisible();
});

test('features can be switched off from the guide page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/options.html#preferences`);
  await expect(page.getByRole('link', { name: 'My wantlist on Discogs' })).toHaveAttribute(
    'href',
    'https://www.discogs.com/mywantlist',
  );
  await page.getByLabel('Wantlist page').uncheck();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.goto('https://www.discogs.com/mywantlist');
  await page.waitForTimeout(800);
  await expect(page.locator('crate-bell-row')).toHaveCount(0);
  await page.goto('https://www.discogs.com/release/3235-Daft-Punk-Homework');
  await expect(card(page).getByRole('button', { name: "Alert me when it's for sale" })).toBeVisible();
});
