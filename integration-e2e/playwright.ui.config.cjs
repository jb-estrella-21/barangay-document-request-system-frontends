const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '..');
const residentPort = Number(process.env.UI_RESIDENT_PORT || 5273);
const staffPort = Number(process.env.UI_STAFF_PORT || 5274);
if (![residentPort, staffPort].every((port) => Number.isInteger(port) && port >= 1024 && port <= 65535) || residentPort === staffPort) {
  throw new Error('UI_RESIDENT_PORT and UI_STAFF_PORT must be distinct unprivileged TCP ports.');
}

const residentOrigin = `http://127.0.0.1:${residentPort}`;
const staffOrigin = `http://127.0.0.1:${staffPort}`;
const mockApiOrigin = 'http://127.0.0.1:5299/api/v1';
const safeServerEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  CI: process.env.CI,
  VITE_API_BASE_URL: mockApiOrigin,
};

module.exports = defineConfig({
  testDir: './ui-tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'line',
  preserveOutput: 'never',
  outputDir: '/tmp/barangay-phase4-ui-results',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 10_000,
  },
  webServer: [
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${residentPort} --strictPort`,
      cwd: path.join(repositoryRoot, 'frontend-website'),
      url: residentOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: safeServerEnv,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${staffPort} --strictPort`,
      cwd: path.join(repositoryRoot, 'frontend-admin'),
      url: staffOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: safeServerEnv,
    },
  ],
});
