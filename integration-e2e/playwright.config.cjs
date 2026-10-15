const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
function assertPortAvailable(port, name) {
  // Probe by briefly binding a local socket, never by sending HTTP to a possibly unrelated service.
  const probe = "const net=require('node:net');const server=net.createServer();server.once('error',()=>process.exit(1));server.listen({host:'127.0.0.1',port:Number(process.argv.at(-1)),exclusive:true},()=>server.close(()=>process.exit(0)));";
  const result = spawnSync(process.execPath, ['-e', probe, port], { stdio: 'ignore', timeout: 3000 });
  if (result.status !== 0) throw new Error(`${name} port ${port} is unavailable; choose a free port with the PHASE2_*_PORT variables.`);
}
const apiPort = configuredPort(process.env.PHASE2_API_PORT, '3000', 'PHASE2_API_PORT');
const residentPort = configuredPort(process.env.PHASE2_RESIDENT_PORT, '5173', 'PHASE2_RESIDENT_PORT');
const staffPort = configuredPort(process.env.PHASE2_STAFF_PORT, '5174', 'PHASE2_STAFF_PORT');
if (new Set([apiPort, residentPort, staffPort]).size !== 3) throw new Error('The API and frontend test ports must be distinct.');
// Playwright loads this config again inside workers after starting webServer processes.
if (process.env.TEST_WORKER_INDEX === undefined) {
  assertPortAvailable(apiPort, 'API');
  assertPortAvailable(residentPort, 'Resident frontend');
  assertPortAvailable(staffPort, 'Staff frontend');
}
const apiOrigin = `http://localhost:${apiPort}`;
const residentOrigin = `http://localhost:${residentPort}`;
const staffOrigin = `http://localhost:${staffPort}`;
const browserName = process.env.PHASE3_BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(browserName)) throw new Error('PHASE3_BROWSER must be chromium, firefox, or webkit.');

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
const inheritedChildEnv = { ...process.env };
delete inheritedChildEnv.PHASE2_TEST_ADMIN_USERNAME;
delete inheritedChildEnv.PHASE2_TEST_ADMIN_PASSWORD;
const backendEnv = {
  ...inheritedChildEnv,
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
    browserName,
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
      env: { ...inheritedChildEnv, VITE_API_BASE_URL: `${apiOrigin}/api/v1` },
    },
    {
      cwd: path.join(repositoryRoot, 'frontend-admin'),
      command: `npm run dev -- --host localhost --port ${staffPort} --strictPort`,
      url: staffOrigin,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...inheritedChildEnv, VITE_API_BASE_URL: `${apiOrigin}/api/v1` },
    },
  ],
});
