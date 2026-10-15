const { test, expect } = require('@playwright/test');

const residentOrigin = `http://localhost:${process.env.PHASE2_RESIDENT_PORT || '5173'}`;
const staffOrigin = `http://localhost:${process.env.PHASE2_STAFF_PORT || '5174'}`;
const apiOrigin = `http://localhost:${process.env.PHASE2_API_PORT || '3000'}`;

function dateInManila(daysFromNow) {
  const date = new Date(Date.now() + daysFromNow * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

test('resident request, staff processing, account controls, and public tracking work across the real API', async ({ browser }) => {
  const adminUsername = process.env.PHASE2_TEST_ADMIN_USERNAME;
  const adminPassword = process.env.PHASE2_TEST_ADMIN_PASSWORD;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const slug = `test-only-phase2-${suffix}`;
  const documentName = `TEST ONLY - Integration ${suffix}`;
  const residentName = `TEST ONLY Resident ${suffix}`;
  const processorUsername = `phase2.processor.${suffix}`;
  const processorPassword = `${adminPassword}#processor`;

  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  const observedWrites = [];
  let detailEtag;
  let queueSearchStatus;
  staff.on('request', (request) => {
    const url = request.url();
    if (!url.includes('/api/v1/staff/')) return;
    if (request.method() !== 'GET' && request.method() !== 'OPTIONS') {
      const headers = request.headers();
      observedWrites.push({
        origin: headers.origin,
        csrfPresent: Boolean(headers['x-csrf-token']),
        ifMatch: headers['if-match'],
      });
    }
  });
  staff.on('response', async (response) => {
    if (response.url().endsWith('/api/v1/staff/requests/search')) queueSearchStatus = response.status();
    if (response.request().method() === 'GET' && /\/api\/v1\/staff\/requests\/[0-9a-f-]+$/i.test(response.url())) {
      detailEtag = await response.headerValue('etag');
    }
  });

  await staff.goto(`${staffOrigin}/login`);
  await staff.getByLabel('Username').fill(adminUsername);
  await staff.getByLabel('Password').fill(adminPassword);
  await staff.getByRole('button', { name: 'Sign in' }).click();
  await expect(staff.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const staffCookieUrl = `${apiOrigin}/api/v1/staff/auth/me`;
  const sessionCookie = (await staffContext.cookies(staffCookieUrl)).find((cookie) => cookie.name === 'phase2_test_staff_session');
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(await staff.evaluate(() => document.cookie)).not.toContain('phase2_test_staff_session');
  expect(await staff.evaluate(() => `${localStorage.length}:${sessionStorage.length}`)).toBe('0:0');
  await staff.reload();
  await expect(staff.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await staff.getByRole('link', { name: 'Document catalog' }).click();
  await staff.getByRole('link', { name: 'Add document type' }).click();
  await staff.getByLabel('URL slug').fill(slug);
  await staff.getByLabel('Document name').fill(documentName);
  await staff.getByLabel('Description').fill('TEST ONLY: fictional integration data; not an official barangay requirement.');
  await staff.getByLabel('Requirements').fill('TEST ONLY: no real documents are needed.');

  const addField = staff.getByRole('button', { name: 'Add field' });
  await addField.click();
  let field = staff.locator('.field-editor').nth(0);
  await field.getByLabel('Field key').fill('purpose');
  await field.getByLabel('Field label').fill('TEST ONLY purpose');
  await field.getByRole('checkbox').check();

  await addField.click();
  field = staff.locator('.field-editor').nth(1);
  await field.getByLabel('Field key').fill('occasion');
  await field.getByLabel('Field label').fill('TEST ONLY occasion');
  await field.getByLabel('Field type').selectOption('select');
  await field.getByLabel('Options').fill('TEST ONLY personal\nTEST ONLY school');
  await field.getByRole('checkbox').check();

  await addField.click();
  field = staff.locator('.field-editor').nth(2);
  await field.getByLabel('Field key').fill('needed_by');
  await field.getByLabel('Field label').fill('TEST ONLY needed by');
  await field.getByLabel('Field type').selectOption('date');
  await staff.getByRole('button', { name: 'Create document' }).click();
  await expect(staff.getByRole('heading', { name: 'Document catalog' })).toBeVisible();
  const catalogCard = staff.locator('.catalog-item').filter({ hasText: documentName });
  await expect(catalogCard).toContainText('Active');
  await catalogCard.getByRole('button', { name: 'Deactivate' }).click();
  await expect(catalogCard).toContainText('Inactive');

  const residentContext = await browser.newContext();
  await residentContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: residentOrigin });
  const resident = await residentContext.newPage();
  await resident.setViewportSize({ width: 390, height: 844 });
  await resident.goto(`${residentOrigin}/documents`);
  await expect(resident.getByRole('heading', { name: documentName })).toHaveCount(0);
  await catalogCard.getByRole('button', { name: 'Activate' }).click();
  await expect(catalogCard).toContainText('Active');
  await resident.reload();
  await expect(resident.getByRole('heading', { name: documentName })).toBeVisible();
  const residentCard = resident.locator('.document-card').filter({ hasText: documentName });
  await residentCard.getByRole('link', { name: 'Request this document' }).click();
  await expect(resident).toHaveURL(new RegExp(`/documents/${slug}$`));
  await resident.locator('.detail-aside').getByRole('link', { name: 'Request this document' }).click();
  await expect(resident).toHaveURL(new RegExp(`/request/${slug}$`));
  await expect(resident.locator('input[name="fields.purpose"]')).toBeVisible();
  await expect(resident.locator('select[name="fields.occasion"]')).toBeVisible();
  await expect(resident.locator('input[name="fields.needed_by"]')).toBeVisible();

  await resident.getByLabel('Full name').fill(residentName);
  await resident.getByLabel('Contact number').fill('09170000000');
  await resident.getByLabel('Home address').fill('TEST ONLY address');
  await resident.locator('input[name="fields.needed_by"]').fill(dateInManila(5));
  await resident.getByRole('button', { name: 'Send request' }).click();
  await expect(resident.getByText('TEST ONLY purpose is required.')).toBeVisible();
  await resident.locator('input[name="fields.purpose"]').fill('TEST ONLY school application');
  await resident.locator('select[name="fields.occasion"]').selectOption('TEST ONLY school');

  const attempts = [];
  await resident.route(`${apiOrigin}/api/v1/requests`, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();
    const attempt = { body: request.postData(), key: request.headers()['idempotency-key'] };
    attempts.push(attempt);
    if (attempts.length === 1) {
      const committedResponse = await route.fetch();
      expect(committedResponse.status()).toBe(201);
      await committedResponse.dispose();
      await route.abort();
      return;
    }
    await route.fulfill({ response: await route.fetch() });
  });

  await resident.getByRole('button', { name: 'Send request' }).click();
  await expect(resident.getByRole('button', { name: 'Retry the same request' })).toBeVisible();
  const uncertaintyMarker = await resident.evaluate(() => Object.entries(sessionStorage));
  expect(uncertaintyMarker).toHaveLength(1);
  expect(uncertaintyMarker[0][0]).toBe('barangay-public-submission-uncertain-v1');
  expect(JSON.parse(uncertaintyMarker[0][1])).toEqual({ createdAt: expect.any(Number) });
  await resident.waitForTimeout(300);
  expect(attempts).toHaveLength(1);

  await resident.getByRole('button', { name: 'Retry the same request' }).click();
  await expect(resident).toHaveURL(/\/request\/submitted$/);
  await expect(resident.getByRole('heading', { name: 'Your request was submitted' })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(attempts[1].body).toBe(attempts[0].body);
  expect(await resident.evaluate(() => sessionStorage.length)).toBe(0);

  const credentialRows = resident.locator('.credential-row');
  const reference = (await credentialRows.nth(0).locator('code').innerText()).trim();
  const trackingCredential = (await credentialRows.nth(1).locator('code').innerText()).trim();
  await credentialRows.nth(1).getByRole('button', { name: 'Copy' }).click();
  await expect(credentialRows.nth(1).getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect(resident.evaluate(() => navigator.clipboard.readText())).resolves.toBe(trackingCredential);

  const confirmationPrivacy = await resident.evaluate(() => ({
    url: location.href,
    history: JSON.stringify(history.state),
    storage: `${localStorage.length}:${sessionStorage.length}`,
    cookies: document.cookie,
  }));
  for (const value of Object.values(confirmationPrivacy)) expect(value).not.toContain(trackingCredential);
  expect(confirmationPrivacy.storage).toBe('0:0');
  expect(confirmationPrivacy.cookies).toBe('');

  await resident.getByRole('link', { name: 'Track this request' }).click();
  await resident.getByLabel('Request reference').fill(reference);
  await resident.getByLabel('Private tracking credential').fill(trackingCredential);
  await resident.getByRole('button', { name: 'Check progress' }).click();
  await expect(resident.getByRole('heading', { name: 'Request progress' })).toBeVisible();
  expect(resident.url()).not.toContain(trackingCredential);
  const resultHistory = await resident.evaluate(() => JSON.stringify(history.state));
  expect(resultHistory).not.toContain(trackingCredential);
  expect(await resident.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await staff.locator('.side-nav a[href="/requests"]').click();
  await staff.getByLabel('Search requests').fill(residentName);
  await staff.getByRole('button', { name: 'Apply filters' }).click();
  await expect.poll(() => queueSearchStatus).toBe(200);
  await expect(staff.locator('tbody tr').filter({ hasText: residentName })).toBeVisible();
  await staff.getByRole('link', { name: reference }).click();
  await expect(staff.getByRole('heading', { name: reference })).toBeVisible();
  await expect.poll(() => detailEtag).toMatch(/^"\d+"$/);
  const initialDetailEtag = detailEtag;

  await staff.getByLabel('Expected date').fill(dateInManila(5));
  await staff.getByRole('button', { name: 'Set expected date' }).click();
  await expect(staff.getByText('Expected release date updated.')).toBeVisible();
  await staff.getByLabel('Expected date').fill(dateInManila(6));
  await staff.getByLabel('Reason for date change').fill('TEST ONLY: integration date revision.');
  await staff.getByRole('button', { name: 'Set expected date' }).click();
  await expect(staff.getByText('TEST ONLY: integration date revision.')).toBeVisible();

  const transitions = [
    ['UNDER_REVIEW', 'Under review'],
    ['PROCESSING', 'Processing'],
    ['READY_FOR_PICKUP', 'Ready for pickup'],
    ['RELEASED', 'Released'],
  ];
  const staleHeaders = [];
  const transitionUrl = /\/api\/v1\/staff\/requests\/[0-9a-f-]+\/transitions$/i;
  await staff.route(transitionUrl, async (route) => {
    const headers = await route.request().allHeaders();
    staleHeaders.push(headers['if-match']);
    if (staleHeaders.length === 1) {
      await route.continue({ headers: { ...headers, 'if-match': initialDetailEtag } });
      return;
    }
    await route.continue();
  });
  await staff.getByLabel('Choose next status').selectOption('UNDER_REVIEW');
  await staff.getByLabel('Message to resident').fill('TEST ONLY: stale version recovery check.');
  await staff.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => staleHeaders.length).toBe(1);
  expect(staleHeaders[0]).not.toBe(initialDetailEtag);
  await expect(staff.getByText('The latest request details have been loaded. Review them before trying again.')).toBeVisible();
  await expect(staff.getByText('The record changed or the requested action is no longer valid. Review the latest information.')).toBeVisible();
  await expect(staff.locator('.status-pill')).toHaveText('Submitted');
  await staff.unroute(transitionUrl);
  for (const [status, label] of transitions) {
    await staff.getByLabel('Choose next status').selectOption(status);
    await staff.getByLabel('Message to resident').fill(`TEST ONLY: ${label} update.`);
    if (status === 'UNDER_REVIEW') await staff.getByLabel('Private staff note').fill('TEST ONLY: private note must not be public.');
    await staff.getByRole('button', { name: 'Save changes' }).click();
    await expect(staff.locator('.status-pill')).toHaveText(label);
  }
  expect(observedWrites.some((write) => write.origin === staffOrigin && write.csrfPresent)).toBe(true);
  expect(observedWrites.some((write) => Boolean(write.ifMatch))).toBe(true);

  await resident.goto(`${residentOrigin}/track`);
  await resident.getByLabel('Request reference').fill(reference);
  await resident.getByLabel('Private tracking credential').fill(trackingCredential);
  await resident.getByRole('button', { name: 'Check progress' }).click();
  await expect(resident.locator('.status-banner')).toContainText('Released');
  await expect(resident.locator('.public-message')).toContainText('TEST ONLY: Released update.');
  await expect(resident.locator('body')).not.toContainText('private note must not be public');

  await resident.goto(`${residentOrigin}/request/submitted`);
  await expect(resident.getByText(/available only in the active tab/i)).toBeVisible();
  await resident.reload();
  await expect(resident.getByText(/available only in the active tab/i)).toBeVisible();

  await staff.getByRole('link', { name: 'Document catalog' }).click();
  await catalogCard.getByRole('link', { name: 'Edit' }).click();
  await staff.getByLabel('Description').fill('TEST ONLY: updated fictional description for version two.');
  await staff.getByRole('button', { name: 'Save changes' }).click();
  await expect(staff.locator('.catalog-item').filter({ hasText: documentName })).toContainText('v2');
  await staff.locator('.side-nav a[href="/requests"]').click();
  await staff.getByLabel('Search requests').fill(residentName);
  await staff.getByRole('button', { name: 'Apply filters' }).click();
  await staff.getByRole('link', { name: reference }).click();
  await expect(staff.locator('.detail-title .eyebrow')).toContainText(`${documentName} · v1`);
  await expect(staff.getByText('TEST ONLY purpose')).toBeVisible();

  await staff.getByRole('link', { name: 'Staff accounts' }).click();
  await staff.getByRole('button', { name: 'Add staff account' }).click();
  await staff.locator('.create-user-form').getByLabel('Username').fill(processorUsername);
  await staff.locator('.create-user-form').getByLabel('Role').selectOption('PROCESSOR');
  await staff.getByRole('button', { name: 'Create account' }).click();
  const temporaryPassword = (await staff.locator('.secret-panel code').innerText()).trim();
  expect(temporaryPassword.length).toBeGreaterThan(20);
  const staffStorage = await staff.evaluate(() => `${localStorage.length}:${sessionStorage.length}`);
  expect(staffStorage).toBe('0:0');
  await staff.getByRole('button', { name: 'Cancel' }).click();
  await expect(staff.locator('.secret-panel')).toHaveCount(0);

  const processorContext = await browser.newContext();
  const processor = await processorContext.newPage();
  await processor.goto(`${staffOrigin}/login`);
  await processor.getByLabel('Username').fill(processorUsername);
  await processor.getByLabel('Password').fill(temporaryPassword);
  await processor.getByRole('button', { name: 'Sign in' }).click();
  await expect(processor.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await processor.getByLabel('Current password').fill(temporaryPassword);
  await processor.locator('input[autocomplete="new-password"][minlength="12"]').fill(processorPassword);
  await processor.getByLabel('Confirm new password').fill(processorPassword);
  await processor.getByRole('button', { name: 'Update password' }).click();
  await expect(processor.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await processor.goto(`${staffOrigin}/catalog`);
  await expect(processor.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(processor.getByRole('heading', { name: 'Document catalog' })).toHaveCount(0);
  expect(await processor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await staff.getByRole('link', { name: 'Staff accounts' }).click();
  const processorRow = staff.locator('tr').filter({ hasText: processorUsername });
  await processorRow.getByRole('button', { name: 'Deactivate' }).click();
  await expect(processorRow).toContainText('Disabled');
  await processor.reload();
  await expect(processor.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  await processorRow.getByRole('button', { name: 'Activate' }).click();
  await expect(processorRow).toContainText('Active');
  pageOnceDialog(staff);
  await processorRow.getByRole('button', { name: 'Reset password' }).click();
  const resetPassword = (await staff.locator('.secret-panel code').innerText()).trim();
  await staff.getByRole('button', { name: 'Cancel' }).click();
  await processor.getByLabel('Username').fill(processorUsername);
  await processor.getByLabel('Password').fill(resetPassword);
  await processor.getByRole('button', { name: 'Sign in' }).click();
  await expect(processor.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await processor.getByLabel('Current password').fill(resetPassword);
  await processor.locator('input[autocomplete="new-password"][minlength="12"]').fill(processorPassword);
  await processor.getByLabel('Confirm new password').fill(processorPassword);
  await processor.getByRole('button', { name: 'Update password' }).click();
  await expect(processor.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await staff.getByRole('link', { name: 'Audit log' }).click();
  await expect(staff.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  await expect(staff.locator('.audit-event').first()).toBeVisible();

  await staff.getByRole('button', { name: 'Sign out' }).click();
  await expect(staff.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  expect((await staffContext.cookies(staffCookieUrl)).some((cookie) => cookie.name === 'phase2_test_staff_session')).toBe(false);

  await processorContext.close();
  await residentContext.close();
  await staffContext.close();
});

function pageOnceDialog(page) {
  page.once('dialog', (dialog) => dialog.accept());
}

test('session restoration distinguishes an unavailable API from an anonymous session', async ({ page }) => {
  await page.route(`${apiOrigin}/api/v1/staff/auth/me`, (route) => route.abort());
  await page.goto(`${staffOrigin}/dashboard`);
  await expect(page.getByText(/could not reach the service/i)).toBeVisible();
  await page.unroute(`${apiOrigin}/api/v1/staff/auth/me`);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
});
