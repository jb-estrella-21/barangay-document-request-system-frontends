const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const residentOrigin = `http://127.0.0.1:${process.env.UI_RESIDENT_PORT || 5273}`;
const staffOrigin = `http://127.0.0.1:${process.env.UI_STAFF_PORT || 5274}`;
const languageStorageKey = 'barangay-ui-language-v1';
const viewports = [
  { width: 320, height: 780 },
  { width: 375, height: 812 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
];
const crossBrowserViewports = [
  { width: 320, height: 780 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
];

const documentTypes = [{
  id: 'ui-test-document-id',
  slug: 'ui-test-clearance',
  documentTypeVersionId: 'ui-test-document-version',
  version: 1,
  isActive: true,
  name: 'Clearance for testing',
  description: 'A fictional document used only in the mocked UI test.',
  requirements: ['Fictional test requirement'],
  fields: [
    { key: 'purpose', label: 'Purpose', type: 'text', required: true },
    { key: 'needed_by', label: 'Date needed', type: 'date', required: false },
    { key: 'category', label: 'Category', type: 'select', required: true, options: ['Personal', 'Work'] },
  ],
}];

const queuedRequest = {
  id: 'ui-test-request-id',
  reference: 'UI-TEST-0001',
  status: 'PROCESSING',
  fullName: 'Test Resident',
  contactNumber: '09170000000',
  expectedReleaseDate: '2026-10-22',
  readyAt: null,
  createdAt: '2026-10-15T01:00:00.000Z',
  version: 1,
  documentTypeVersion: { name: 'Clearance for testing', version: 1, documentTypeId: documentTypes[0].id },
};

const requestDetail = {
  ...queuedRequest,
  address: 'Fictional test address',
  applicantFields: { purpose: 'Test only', needed_by: '2026-10-20', category: 'Personal' },
  releasedAt: null,
  publicStatusMessage: 'Test-only public update.',
  updatedAt: '2026-10-15T01:00:00.000Z',
  documentTypeVersion: {
    id: 'ui-test-document-version',
    documentTypeId: documentTypes[0].id,
    version: 1,
    name: 'Clearance for testing',
    description: 'Fictional test document.',
    requirements: ['Fictional test requirement'],
    fieldDefinitions: documentTypes[0].fields,
    createdAt: '2026-10-14T01:00:00.000Z',
  },
  history: [{
    id: 'ui-test-history-id',
    eventType: 'STATUS_CHANGED',
    fromStatus: 'UNDER_REVIEW',
    toStatus: 'PROCESSING',
    oldReleaseDate: null,
    newReleaseDate: null,
    publicMessage: 'Test-only public update.',
    reason: 'Test only',
    internalNote: 'Mock data only',
    createdAt: '2026-10-15T01:00:00.000Z',
    actor: { username: 'test-processor', role: 'PROCESSOR' },
  }],
};

async function assertAccessible(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));
  expect(summary, `${label} axe violations: ${JSON.stringify(summary)}`).toEqual([]);
}

function viewportsFor(testInfo) {
  return testInfo.project.name === 'chromium' ? viewports : crossBrowserViewports;
}

async function assertNoPageOverflow(page, viewport) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(sizes.page, `page overflow at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(sizes.viewport + 1);
}

async function mockResidentApi(page, mode = {}) {
  await page.route('http://127.0.0.1:5299/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/document-types')) return json(mode.emptyCatalog ? [] : documentTypes);
    if (path.endsWith('/requests/track')) {
      if (mode.trackError) return json({ title: 'Mock internal detail that must stay hidden', requestId: 'UI-SUPPORT-123' }, 503, { 'X-Request-Id': 'UI-SUPPORT-123' });
      return json({
      reference: 'UI-TEST-0001',
      documentName: 'Clearance for testing',
      status: 'PROCESSING',
      submittedAt: '2026-10-15T01:00:00.000Z',
      expectedReleaseDate: '2026-10-22',
      readyAt: null,
      releasedAt: null,
      statusMessage: 'Test-only public update.',
      });
    }
    if (path.endsWith('/requests') && request.method() === 'POST') return json({
      reference: 'UI-TEST-0001',
      trackingCredential: 'ui-test-credential-not-real-phase-four-only-123456',
      message: 'Test-only response.',
    }, 201);
    return json({ title: 'Not found' }, 404);
  });
}

async function mockStaffApi(page, role = 'ADMINISTRATOR', mode = {}) {
  let loggedIn = false;
  const staff = { id: 'ui-test-staff-id', username: 'test.staff', role, mustChangePassword: false, isActive: true };
  await page.route('http://127.0.0.1:5299/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200, headers = {}) => route.fulfill({ status, headers: { 'Access-Control-Expose-Headers': 'X-Request-Id', ...headers }, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/staff/auth/me')) {
      if (loggedIn) return json({ staff, csrfToken: 'mock-only-csrf-token' });
      if (mode.meUnavailable) return json({ title: 'Mock internal detail that must stay hidden' }, 503);
      return json({ title: 'Unauthorized' }, 401);
    }
    if (path.endsWith('/staff/auth/login')) {
      loggedIn = true;
      return json({
      staff,
      csrfToken: 'mock-only-csrf-token',
      expiresAt: '2026-10-16T01:00:00.000Z',
      });
    }
    if (path.endsWith('/staff/summary')) return json({ pending: 1, processing: 1, ready: 1, overdue: 0 });
    if (path.endsWith('/staff/document-types')) return json(documentTypes);
    if (path.endsWith('/document-types')) return json(documentTypes.map(({ isActive, ...doc }) => doc));
    if (path.endsWith('/staff/requests/search') || path.endsWith('/staff/requests')) return json({ data: mode.emptyQueue ? [] : [queuedRequest], nextCursor: null });
    if (path.endsWith(`/staff/requests/${queuedRequest.id}`)) return json(requestDetail, 200, { ETag: '"1"' });
    if (path.endsWith('/staff/users')) return json([{ id: 'ui-test-account', username: 'test.processor', role: 'PROCESSOR', mustChangePassword: false, isActive: true }]);
    if (path.endsWith('/staff/audit-events')) return json({ data: [{
      id: 'ui-test-audit-id', actorId: 'ui-test-staff-id', action: 'REQUEST_STATUS_CHANGED', targetType: 'Request',
      targetId: queuedRequest.id, before: { status: 'UNDER_REVIEW' }, after: { status: 'PROCESSING' },
      createdAt: '2026-10-15T01:00:00.000Z', actor: { username: 'test.staff', role },
    }], nextCursor: null });
    return json({ title: 'Not found' }, 404);
  });
}

async function signInStaff(page) {
  await page.goto(`${staffOrigin}/login`);
  await page.getByLabel('Username').fill('test.staff');
  await page.getByLabel('Password').fill('mock-only-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('resident journey stays usable and private across responsive sizes and language reloads', async ({ page }, testInfo) => {
  await mockResidentApi(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${residentOrigin}/`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await assertAccessible(page, 'resident home in English');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedTransition = await page.getByRole('link', { name: 'Browse documents' }).evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration));
  expect(reducedTransition).toBeLessThan(0.001);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.getByRole('button', { name: /Change language/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  await expect(page).toHaveTitle('Mga Dokumento ng Barangay');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  expect(await page.evaluate((key) => [localStorage.length, localStorage.getItem(key)], languageStorageKey)).toEqual([1, 'fil']);
  await assertAccessible(page, 'resident home in Filipino');

  for (const viewport of viewportsFor(testInfo)) {
    await page.setViewportSize(viewport);
    await assertNoPageOverflow(page, viewport);
    await page.goto(`${residentOrigin}/documents`);
    await expect(page.getByRole('heading', { name: 'Mga dokumentong maaaring hilingin' })).toBeVisible();
    await assertNoPageOverflow(page, viewport);
  }

  await page.goto(`${residentOrigin}/documents`);
  await page.getByRole('link', { name: 'Humiling ng dokumentong ito' }).click();
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('link', { name: 'Humiling ng dokumentong ito' }).click();
  await expect(page.getByLabel('Buong pangalan')).toBeVisible();
  await expect(page.locator('input[name="fields.purpose"]')).toBeVisible();
  await expect(page.locator('select[name="fields.category"]')).toBeVisible();
  await assertAccessible(page, 'resident dynamic request form in Filipino');

  await page.getByLabel('Buong pangalan').fill('Test Resident');
  await page.getByLabel('Numero ng telepono').fill('09170000000');
  await page.getByLabel('Tirahan').fill('Fictional test address');
  await page.locator('input[name="fields.purpose"]').fill('Test only');
  await page.locator('select[name="fields.category"]').selectOption('Personal');
  await page.getByRole('button', { name: 'Ipadala ang kahilingan' }).click();
  await expect(page).toHaveURL(/\/request\/submitted$/);
  await expect(page.getByRole('heading', { name: 'Naipadala ang iyong kahilingan' })).toBeVisible();
  await assertAccessible(page, 'resident confirmation in Filipino');

  const credential = 'ui-test-credential-not-real-phase-four-only-123456';
  const privacy = await page.evaluate(() => ({
    url: location.href,
    history: JSON.stringify(history.state),
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    cookies: document.cookie,
  }));
  expect(JSON.stringify(privacy)).not.toContain(credential);
  expect(privacy.url).not.toContain(credential);
  expect(privacy.history).not.toContain(credential);
  expect(privacy.localStorage).toEqual([[languageStorageKey, 'fil']]);
  expect(privacy.sessionStorage).toEqual([]);
  expect(privacy.cookies).toBe('');

  await page.reload();
  await expect(page.getByText(/Makikita lamang ang kumpirmasyong ito sa aktibong tab/)).toBeVisible();
  await expect(page.getByText(credential)).toHaveCount(0);
  await page.goto(`${residentOrigin}/track`);
  await page.getByLabel('Reference ng kahilingan').fill('UI-TEST-0001');
  await page.getByLabel('Pribadong tracking credential').fill(credential);
  await page.getByRole('button', { name: 'Tingnan ang progreso' }).click();
  await expect(page.getByRole('heading', { name: 'Progreso ng kahilingan' })).toBeVisible();
  await assertAccessible(page, 'resident tracking result in Filipino');

  expect(pageErrors).toEqual([]);
});

test('processor navigation remains role-limited and accessible at supported sizes', async ({ page }, testInfo) => {
  await mockStaffApi(page, 'PROCESSOR');
  await signInStaff(page);
  await expect(page.getByRole('link', { name: 'Document catalog' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Staff accounts' })).toHaveCount(0);
  await page.goto(`${staffOrigin}/staff-users`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await assertAccessible(page, 'processor dashboard');

  for (const viewport of viewportsFor(testInfo)) {
    await page.setViewportSize(viewport);
    await page.goto(`${staffOrigin}/requests`);
    await expect(page.getByRole('heading', { name: 'Request queue' })).toBeVisible();
    await assertNoPageOverflow(page, viewport);
  }
});

test('administrator workflows expose accessible queue, detail, catalog, account, and audit controls', async ({ page }, testInfo) => {
  await mockStaffApi(page, 'ADMINISTRATOR');
  await signInStaff(page);
  await assertAccessible(page, 'staff dashboard in English');
  await page.getByRole('button', { name: /Change language/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  expect(await page.evaluate((key) => localStorage.getItem(key), languageStorageKey)).toBe('fil');

  for (const viewport of viewportsFor(testInfo)) {
    await page.setViewportSize(viewport);
    await page.goto(`${staffOrigin}/requests`);
    await expect(page.getByRole('heading', { name: 'Mga kahilingan' })).toBeVisible();
    await assertNoPageOverflow(page, viewport);
  }

  await page.goto(`${staffOrigin}/requests`);
  await expect(page.getByRole('link', { name: 'UI-TEST-0001' })).toBeVisible();
  await assertAccessible(page, 'staff request queue in Filipino');
  await page.getByRole('link', { name: 'UI-TEST-0001' }).first().click();
  await expect(page.getByRole('heading', { name: 'UI-TEST-0001' })).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
  await assertAccessible(page, 'staff request details in Filipino');

  await page.goto(`${staffOrigin}/catalog`);
  await expect(page.getByRole('heading', { name: 'Mga dokumento' })).toBeVisible();
  await assertAccessible(page, 'staff catalog in Filipino');
  await page.getByRole('link', { name: /Magdagdag ng dokumento/ }).click();
  await page.getByRole('button', { name: /Magdagdag ng field/ }).click();
  await expect(page.getByRole('button', { name: /Alisin ang field/ })).toBeVisible();
  await assertAccessible(page, 'staff catalog editor with dynamic field in Filipino');

  await page.goto(`${staffOrigin}/staff-users`);
  await expect(page.getByRole('heading', { name: 'Mga kawani' })).toBeVisible();
  await assertAccessible(page, 'staff accounts in Filipino');
  const addAccount = page.getByRole('button', { name: /Magdagdag ng kawani/ });
  await addAccount.click();
  await expect(addAccount).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('form', { name: 'Form para gumawa ng account ng kawani' })).toBeVisible();
  await assertAccessible(page, 'staff account creation form in Filipino');

  await page.goto(`${staffOrigin}/audit`);
  await expect(page.getByRole('heading', { name: 'Talaan ng aktibidad' })).toBeVisible();
  await assertAccessible(page, 'staff audit log in Filipino');

  expect(await page.evaluate((key) => Object.entries(localStorage), languageStorageKey)).toEqual([[languageStorageKey, 'fil']]);
});

test('resident empty catalog and safe tracking errors are accessible in both languages', async ({ page }) => {
  const mode = { emptyCatalog: true, trackError: true };
  await mockResidentApi(page, mode);
  await page.goto(`${residentOrigin}/documents`);
  await expect(page.getByText('No documents are currently available. Please check again later.')).toBeVisible();
  await assertAccessible(page, 'empty resident catalog in English');

  await page.getByRole('button', { name: /Change language/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fil');
  await expect(page.getByText('Walang dokumentong maaaring hilingin sa ngayon. Pakibalik muli mamaya.')).toBeVisible();
  mode.emptyCatalog = false;
  await page.goto(`${residentOrigin}/track`);
  await assertAccessible(page, 'resident tracking form in Filipino');
  await page.getByLabel('Reference ng kahilingan').fill('UI-TEST-0001');
  await page.getByLabel('Pribadong tracking credential').fill('ui-test-private-value-that-is-long-enough-123');
  await page.getByRole('button', { name: 'Tingnan ang progreso' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('UI-SUPPORT-123');
  await expect(alert).not.toContainText('Mock internal detail');
  await assertAccessible(page, 'resident tracking error in Filipino');
});

test('staff session outage offers retry and queue empty state remains accessible', async ({ page }) => {
  const mode = { meUnavailable: true, emptyQueue: true };
  await mockStaffApi(page, 'ADMINISTRATOR', mode);
  await page.goto(`${staffOrigin}/login`);
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await assertAccessible(page, 'staff session outage');

  mode.meUnavailable = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  await assertAccessible(page, 'staff sign in in English');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await signInStaff(page);
  await page.goto(`${staffOrigin}/requests`);
  await expect(page.getByText('No requests match these filters.')).toBeVisible();
  await assertAccessible(page, 'empty staff request queue in English');
});
