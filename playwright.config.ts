import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL: 'http://127.0.0.1:4198',
    viewport: {width: 390, height: 844},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:4198',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{name: 'mobile-chromium', use: {...devices['Desktop Chrome'], viewport: {width: 390, height: 844}}}],
});
