const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '..');
const residentPort = Number(process.env.PHASE5B_RESIDENT_PORT || 5273);
const staffPort = Number(process.env.PHASE5B_STAFF_PORT || 5274);
const mockPort = Number(process.env.PHASE5B_MOCK_API_PORT || 5299);
const stageRoot = process.env.PHASE5B_PAGES_STAGE_ROOT;
const configuredApiOrigin = process.env.PHASE5B_API_ORIGIN;
const mockMode = !configuredApiOrigin;
const apiOrigin = configuredApiOrigin || `http://127.0.0.1:${mockPort}`;
if (!stageRoot) throw new Error('Build the isolated Pages staging projects before running proxy tests.');
if (![residentPort, staffPort, mockPort].every((port) => Number.isInteger(port) && port >= 1024 && port <= 65535) ||
    new Set([residentPort, staffPort, mockPort]).size !== 3) {
  throw new Error('Phase 5B proxy test ports must be distinct unprivileged ports.');
}
const apiUrl = new URL(apiOrigin);
if (apiUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(apiUrl.hostname)) {
  throw new Error('Phase 5B proxy tests may use only a local HTTP API origin.');
}
if (!mockMode && (!process.env.PHASE5B_TEST_ADMIN_USERNAME || !process.env.PHASE5B_TEST_ADMIN_PASSWORD)) {
  throw new Error('Local backend-proxy tests require disposable test-admin credentials in the environment.');
}

const residentOrigin = `http://127.0.0.1:${residentPort}`;
const staffOrigin = `http://127.0.0.1:${staffPort}`;
const testSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const wrangler = path.join(repositoryRoot, 'integration-e2e/node_modules/.bin/wrangler');
const safeEnv = { ...process.env, PHASE5B_MOCK_API_PORT: String(mockPort) };
delete safeEnv.PHASE5B_TEST_ADMIN_PASSWORD;
delete safeEnv.PHASE5B_TEST_ADMIN_USERNAME;

function pagesCommand(port) {
  return `${JSON.stringify(wrangler)} pages dev --port ${port} --ip 127.0.0.1 ` +
    `--binding API_ORIGIN=${apiOrigin} ` +
    `--binding CLIENT_IP_HMAC_SECRET=${testSecret} --binding ALLOW_HTTP_LOCAL_UPSTREAM=true`;
}

module.exports = defineConfig({
  testDir: './proxy-tests',
  testMatch: mockMode ? '**/pages-proxy.spec.cjs' : '**/pages-backend-proxy.spec.cjs',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: 'line',
  preserveOutput: 'never',
  outputDir: '/tmp/barangay-phase5b-proxy-results',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    ...(mockMode ? [{
      command: 'node integration-e2e/scripts/mock-pages-upstream.cjs',
      cwd: repositoryRoot,
      url: `http://127.0.0.1:${mockPort}/__stats`,
      timeout: 10_000,
      reuseExistingServer: false,
      env: safeEnv,
    }] : []),
    {
      command: pagesCommand(residentPort),
      cwd: path.join(stageRoot, 'resident'),
      url: residentOrigin,
      timeout: 60_000,
      reuseExistingServer: false,
      env: safeEnv,
    },
    {
      command: pagesCommand(staffPort),
      cwd: path.join(stageRoot, 'staff'),
      url: staffOrigin,
      timeout: 60_000,
      reuseExistingServer: false,
      env: safeEnv,
    },
  ],
});
