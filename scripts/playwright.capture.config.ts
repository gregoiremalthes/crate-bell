import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'capture-ui.spec.ts',
  workers: 1,
  timeout: 60_000,
  use: { deviceScaleFactor: 2 },
});
