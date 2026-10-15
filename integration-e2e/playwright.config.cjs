const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '..');
const backendDirectory = process.env.PHASE2_BACKEND_DIR || path.resolve(repositoryRoot, '..', 'barangay-document-request-system-backend');
const databaseUrl = process.env.PHASE2_TEST_DATABASE_URL;
const expectedDatabaseName = process.env.PHASE2_TEST_DATABASE_NAME;
const confirmation = process.env.PHASE2_CONFIRM_TEST_DATABASE;
function configuredPort(value, fallback, name) {
  const port = Number(value || fallback);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`${name} must be an available unprivileged TCP port.`);
  return String(port);
}
const apiPort = configuredPort(process.env.PHASE2_API_PORT, '3000', 'PHASE2_API_PORT');
const residentPort = configuredPort(process.env.PHASE2_RESIDENT_PORT, '5173', 'PHASE2_RESIDENT_PORT');
const staffPort = configuredPort(process.env.PHASE2_STAFF_PORT, '5174', 'PHASE2_STAFF_PORT');
if (new Set([apiPort, residentPort, staffPort]).size !== 3) throw new Error('The API and frontend test ports must be distinct.');
const apiOrigin = `http://localhost:${apiPort}`;
const residentOrigin = `http://localhost:${residentPort}`;
const staffOrigin = `http://localhost:${staffPort}`;

if (!databaseUrl || !expectedDatabaseName || confirmation !== expectedDatabaseName) {
  throw new Error('Set PHASE2_TEST_DATABASE_URL, PHASE2_TEST_DATABASE_NAME, and PHASE2_CONFIRM_TEST_DATABASE for the disposable browser-test database.');
}

let databaseName = '';
try {
  const url = new URL(databaseUrl);
  databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error();
} catch {
  throw new Error('PHASE2_TEST_DATABASE_URL must be a PostgreSQL URL for the disposable browser-test database.');
}
if (!/^[a-zA-Z0-9_]+_test$/.test(expectedDatabaseName) || databaseName !== expectedDatabaseName) {
  throw new Error('The browser-test database name must match the URL database and end in _test.');
}
if (!process.env.PHASE2_TEST_ADMIN_USERNAME || !process.env.PHASE2_TEST_ADMIN_PASSWORD) {
  throw new Error('Set the bootstrapped disposable administrator credentials in PHASE2_TEST_ADMIN_USERNAME and PHASE2_TEST_ADMIN_PASSWORD.');
}

const corsOrigins = `${residentOrigin},${staffOrigin}`;
const backendEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: apiPort,
  DATABASE_URL: databaseUrl,
  CORS_ORIGINS: corsOrigins,
  COOKIE_SECURE: 'false',
  COOKIE_SAME_SITE: 'lax',
  SESSION_COOKIE_NAME: 'phase2_test_staff_session',
  TRUST_PROXY: 'false',
  LOG_LEVEL: 'silent',
  IDEMPOTENCY_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
};

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.cjs',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: 'line',
  preserveOutput: 'never',
  outputDir: '/tmp/barangay-phase2-playwright-results',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1365, height: 900 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 15_000,
  },
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: backendDirectory,
      url: `${apiOrigin}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: backendEnv,
    },
    {
      cwd: path.join(repositoryRoot, 'frontend-website'),
      command: `npm run dev -- --host localhost --port ${residentPort} --strictPort`,
      url: residentOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...process.env, VITE_API_BASE_URL: `${apiOrigin}/api/v1` },
    },
    {
      cwd: path.join(repositoryRoot, 'frontend-admin'),
      command: `npm run dev -- --host localhost --port ${staffPort} --strictPort`,
      url: staffOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...process.env, VITE_API_BASE_URL: `${apiOrigin}/api/v1` },
    },
  ],
});
