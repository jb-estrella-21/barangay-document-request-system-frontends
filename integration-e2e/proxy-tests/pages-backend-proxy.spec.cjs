const { test, expect } = require('@playwright/test');

const residentOrigin = `http://127.0.0.1:${process.env.PHASE5B_RESIDENT_PORT || 5273}`;
const staffOrigin = `http://127.0.0.1:${process.env.PHASE5B_STAFF_PORT || 5274}`;

test('staff login, first-party session cookie, CSRF, exact Origin, restoration, and logout pass through Pages', async ({ page, context }) => {
  await page.goto(staffOrigin);
  const credentials = {
    username: process.env.PHASE5B_TEST_ADMIN_USERNAME,
    password: process.env.PHASE5B_TEST_ADMIN_PASSWORD,
  };
  const login = await page.evaluate(async (value) => {
    const response = await fetch('/api/v1/staff/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    return { status: response.status, body: await response.json() };
  }, credentials);
  expect(login.status).toBe(201);
  expect(login.body.staff.username).toBe(credentials.username);
  expect(typeof login.body.csrfToken).toBe('string');

  const rootCookies = await context.cookies(staffOrigin);
  expect(rootCookies).toEqual([]);
  const staffCookies = await context.cookies(`${staffOrigin}/api/v1/staff/auth/me`);
  expect(staffCookies).toHaveLength(1);
  expect(staffCookies[0]).toMatchObject({
    name: 'phase5b_staff_session',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api/v1/staff',
  });

  const restored = await page.evaluate(async () => {
    const response = await fetch('/api/v1/staff/auth/me');
    return { status: response.status, body: await response.json() };
  });
  expect(restored.status).toBe(200);
  expect(restored.body.staff.username).toBe(credentials.username);
  expect(restored.body.csrfToken).toBe(login.body.csrfToken);

  const invalidCsrf = await page.evaluate(async () => {
    const response = await fetch('/api/v1/staff/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'invalid-test-token' },
      body: '{}',
    });
    return response.status;
  });
  expect(invalidCsrf).toBe(403);

  const invalidOrigin = await context.request.post(`${staffOrigin}/api/v1/staff/auth/logout`, {
    headers: { Origin: 'https://invalid.example', 'X-CSRF-Token': login.body.csrfToken },
    data: {},
  });
  expect(invalidOrigin.status()).toBe(403);

  const stillRestored = await page.evaluate(async () => (await fetch('/api/v1/staff/auth/me')).status);
  expect(stillRestored).toBe(200);
  const logout = await page.evaluate(async (csrfToken) => {
    const response = await fetch('/api/v1/staff/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: '{}',
    });
    return response.status;
  }, login.body.csrfToken);
  expect(logout).toBe(201);
  expect(await context.cookies(`${staffOrigin}/api/v1/staff/auth/me`)).toEqual([]);
});

test('resident idempotency, tracking, staff ETags, and visible status updates work through Pages', async ({ page, context }) => {
  await page.goto(residentOrigin);
  const result = await page.evaluate(async () => {
    const catalogResponse = await fetch('/api/v1/document-types');
    if (!catalogResponse.ok) return { stage: 'catalog', status: catalogResponse.status };
    const catalog = await catalogResponse.json();
    const type = catalog[0];
    if (!type) return { stage: 'catalog-empty', status: catalogResponse.status };
    const fields = Object.fromEntries((type.fields || []).map((field) => [
      field.key,
      field.type === 'select' ? (field.options || ['Demo value'])[0] : 'Phase 5B disposable integration check',
    ]));
    const body = JSON.stringify({
      documentTypeId: type.id,
      applicant: {
        fullName: 'Phase 5B Demo Applicant',
        contactNumber: '+639171234567',
        address: 'Fictional Test Address',
      },
      fields,
    });
    const key = `phase5b-${crypto.randomUUID()}`;
    const submit = () => fetch('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body,
    });
    const first = await submit();
    const firstBody = await first.json();
    const replay = await submit();
    const replayBody = await replay.json();
    window.__phase5bRequestReference = firstBody.reference;
    window.__phase5bTrackingCredential = firstBody.trackingCredential;
    const tracking = await fetch('/api/v1/requests/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: firstBody.reference, trackingCredential: firstBody.trackingCredential }),
    });
    const trackingBody = await tracking.json();
    return {
      firstStatus: first.status,
      replayStatus: replay.status,
      sameReference: firstBody.reference === replayBody.reference,
      sameCredential: firstBody.trackingCredential === replayBody.trackingCredential,
      trackingStatus: tracking.status,
      trackedReference: trackingBody.reference,
      initialStatus: trackingBody.status,
    };
  });
  expect(result.firstStatus).toBe(201);
  expect(result.replayStatus).toBe(201);
  expect(result.sameReference).toBe(true);
  expect(result.sameCredential).toBe(true);
  expect(result.trackingStatus).toBe(200);
  expect(result.trackedReference).toBeTruthy();
  expect(result.initialStatus).toBe('SUBMITTED');

  const staffPage = await context.newPage();
  await staffPage.goto(staffOrigin);
  const credentials = {
    username: process.env.PHASE5B_TEST_ADMIN_USERNAME,
    password: process.env.PHASE5B_TEST_ADMIN_PASSWORD,
  };
  const login = await staffPage.evaluate(async (value) => {
    const response = await fetch('/api/v1/staff/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    return { status: response.status, body: await response.json() };
  }, credentials);
  expect(login.status).toBe(201);

  const detail = await staffPage.evaluate(async ({ reference, csrfToken }) => {
    const search = await fetch('/api/v1/staff/requests/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ search: reference }),
    });
    const queue = await search.json();
    const item = queue.data.find((row) => row.reference === reference);
    if (!item) return { searchStatus: search.status, itemStatus: 404 };
    const response = await fetch(`/api/v1/staff/requests/${item.id}`);
    return { searchStatus: search.status, itemStatus: response.status, id: item.id, etag: response.headers.get('etag') };
  }, { reference: result.trackedReference, csrfToken: login.body.csrfToken });
  expect(detail.searchStatus).toBe(200);
  expect(detail.itemStatus).toBe(200);
  expect(detail.etag).toBeTruthy();

  const stale = await staffPage.evaluate(async ({ id, csrfToken }) => {
    const response = await fetch(`/api/v1/staff/requests/${id}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'If-Match': '"999"' },
      body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
    });
    return response.status;
  }, { id: detail.id, csrfToken: login.body.csrfToken });
  expect(stale).toBe(409);

  const transition = await staffPage.evaluate(async ({ id, etag, csrfToken }) => {
    const response = await fetch(`/api/v1/staff/requests/${id}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'If-Match': etag },
      body: JSON.stringify({ toStatus: 'UNDER_REVIEW' }),
    });
    return response.status;
  }, { id: detail.id, etag: detail.etag, csrfToken: login.body.csrfToken });
  expect(transition).toBe(201);

  const updatedTracking = await page.evaluate(async () => {
    const response = await fetch('/api/v1/requests/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference: window.__phase5bRequestReference,
        trackingCredential: window.__phase5bTrackingCredential,
      }),
    });
    const body = await response.json();
    delete window.__phase5bRequestReference;
    delete window.__phase5bTrackingCredential;
    return { status: response.status, requestStatus: body.status };
  });
  expect(updatedTracking).toEqual({ status: 200, requestStatus: 'UNDER_REVIEW' });

  const logout = await staffPage.evaluate(async (csrfToken) => {
    const response = await fetch('/api/v1/staff/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: '{}',
    });
    return response.status;
  }, login.body.csrfToken);
  expect(logout).toBe(201);
});
