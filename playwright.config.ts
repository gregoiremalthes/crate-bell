import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests load the built extension in Chromium and serve copies of Discogs pages
 * (tests/fixtures) on www.discogs.com through request routing: no network, no Discogs account.
 * Build first: `pnpm build && pnpm test:e2e`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
