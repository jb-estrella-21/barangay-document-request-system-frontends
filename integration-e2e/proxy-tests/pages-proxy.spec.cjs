const { test, expect } = require('@playwright/test');
const { createHmac } = require('node:crypto');

const residentOrigin = `http://localhost:${process.env.PHASE5B_RESIDENT_PORT || 5273}`;
const staffOrigin = `http://localhost:${process.env.PHASE5B_STAFF_PORT || 5274}`;
const mockOrigin = `http://127.0.0.1:${process.env.PHASE5B_MOCK_API_PORT || 5299}`;

async function upstreamCount(request) {
  const response = await request.get(`${mockOrigin}/__stats`);
  return (await response.json()).apiRequests;
}

test('resident Pages site serves SPA routes and static assets without invoking its API Function', async ({ page, request }) => {
  const before = await upstreamCount(request);
  const htmlResponse = await request.get(residentOrigin);
  expect(htmlResponse.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(htmlResponse.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  await page.goto(`${residentOrigin}/track/result`);
  await expect(page.locator('#root')).toBeVisible();
  await page.reload();
  await expect(page.locator('#root')).toBeVisible();
  const after = await upstreamCount(request);
  expect(after).toBe(before);

  const scripts = await page.locator('script[src]').evaluateAll((elements) => elements.map((element) => element.getAttribute('src')));
  expect(scripts.length).toBeGreaterThan(0);
  const assetResponse = await request.get(`${residentOrigin}${scripts[0]}`);
  expect(assetResponse.ok()).toBeTruthy();
  expect(await upstreamCount(request)).toBe(before);
});

test('staff Pages project serves direct SPA routes and static assets without invoking its API Function', async ({ request }) => {
  const before = await upstreamCount(request);
  const routeResponse = await request.get(`${staffOrigin}/requests`);
  expect(routeResponse.ok()).toBeTruthy();
  expect(routeResponse.headers()['content-type']).toContain('text/html');
  expect(routeResponse.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(routeResponse.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(await routeResponse.text()).toContain('id="root"');
  const html = await request.get(`${staffOrigin}/`);
  const assetPath = (await html.text()).match(/<script[^>]+src="([^"]+)"/)?.[1];
  expect(assetPath).toBeTruthy();
  const asset = await request.get(`${staffOrigin}${assetPath}`);
  expect(asset.ok()).toBeTruthy();
  expect(await upstreamCount(request)).toBe(before);
});

test('both independent Pages projects include the same-origin API proxy', async ({ page }) => {
  for (const origin of [residentOrigin, staffOrigin]) {
    await page.goto(origin);
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/v1/_echo?check=pages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'test-csrf-value',
          'Idempotency-Key': 'test-idempotency-key',
          'If-Match': '"version-9"',
          'X-Forwarded-For': '203.0.113.99',
          'X-Real-IP': '203.0.113.98',
          'X-Forwarded-Port': '65535',
          'X-Forwarded-Prefix': '/attacker',
          'True-Client-IP': '203.0.113.97',
          'X-Proxy-Client-IP': '203.0.113.77',
          'X-Proxy-Client-IP-Timestamp': '1',
          'X-Proxy-Client-IP-Signature': 'forged',
          'CF-Connecting-IP': '198.51.100.55',
        },
        body: JSON.stringify({ test: 'payload' }),
      });
      return {
        status: response.status,
        cacheControl: response.headers.get('cache-control'),
        etag: response.headers.get('etag'),
        requestId: response.headers.get('x-request-id'),
        data: await response.json(),
      };
    });
    expect(result.status).toBe(200);
    expect(result.cacheControl).toBe('no-store');
    expect(result.etag).toBe('"proxy-echo-v4"');
    expect(result.requestId).toBe('phase5b-request-123');
    expect(result.data.method).toBe('PATCH');
    expect(result.data.url).toBe('/api/v1/_echo?check=pages');
    expect(result.data.body).toBe('{"test":"payload"}');
    expect(result.data.headers.origin).toBe(origin);
    expect(result.data.headers['x-csrf-token']).toBe('test-csrf-value');
    expect(result.data.headers['idempotency-key']).toBe('test-idempotency-key');
    expect(result.data.headers['if-match']).toBe('"version-9"');
    expect(result.data.headers['x-proxy-client-ip']).toBe('198.51.100.55');
    expect(result.data.headers['x-proxy-client-ip-signature']).toMatch(/^[a-f0-9]{64}$/);
    const signingKey = Buffer.alloc(32);
    const signedMessage = ['v1', result.data.headers['x-proxy-client-ip-timestamp'], '198.51.100.55', 'PATCH', '/api/v1/_echo'].join('\n');
    expect(result.data.headers['x-proxy-client-ip-signature']).toBe(createHmac('sha256', signingKey).update(signedMessage).digest('hex'));
    expect(result.data.headers['x-forwarded-for']).toBeNull();
    expect(result.data.headers['x-forwarded-port']).toBeNull();
    expect(result.data.headers['x-forwarded-prefix']).toBeNull();
    expect(result.data.headers.forwarded).toBeNull();
    expect(result.data.headers['x-real-ip']).toBeNull();
    expect(result.data.headers['true-client-ip']).toBeNull();
    expect(result.data.headers['cf-connecting-ip']).toBeNull();
  }

  await page.goto(residentOrigin);
  const malformedIp = await page.evaluate(async () => {
    const response = await fetch('/api/v1/_echo', {
      headers: { 'CF-Connecting-IP': 'not-an-ip', 'X-Proxy-Client-IP': '192.0.2.1', 'X-Proxy-Client-IP-Signature': 'forged' },
    });
    return response.json();
  });
  expect(malformedIp.headers['x-proxy-client-ip']).toBeNull();
  expect(malformedIp.headers['x-proxy-client-ip-signature']).toBeNull();
});

test('staff cookie path, HttpOnly, Secure, SameSite and multiple Set-Cookie values survive the proxy', async ({ page, context }) => {
  await page.goto(staffOrigin);
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/v1/_cookies');
    return { status: result.status, cacheControl: result.headers.get('cache-control') };
  });
  expect(response).toEqual({ status: 200, cacheControl: 'no-store' });

  expect(await context.cookies(staffOrigin)).toEqual([]);
  const cookies = await context.cookies(`${staffOrigin}/api/v1/staff`);
  const first = cookies.find((cookie) => cookie.name === 'phase5b_http_only');
  const second = cookies.find((cookie) => cookie.name === 'phase5b_secure');
  expect(first).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api/v1/staff' });
  expect(second).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/api/v1/staff' });
  const echo = await page.evaluate(async () => {
    const response = await fetch('/api/v1/staff/_echo');
    return response.json();
  });
  expect(echo.headers.cookie).toContain('phase5b_http_only=first');
});

test('upstream API errors are not cached and proxy transport failures return safe errors', async ({ page }) => {
  await page.goto(residentOrigin);
  const apiResponse = await page.evaluate(async () => {
    const result = await fetch('/api/v1/_failure');
    return { status: result.status, headers: result.headers.get('cache-control'), body: await result.text() };
  });
  expect(apiResponse.status).toBe(500);
  expect(apiResponse.headers).toBe('no-store');
  expect(apiResponse.body).toContain('phase5b-safe-error-id');
  expect(apiResponse.body).not.toContain('Sensitive internal failure');
  expect(apiResponse.body).not.toContain('do not expose this value');

  const transportResponse = await page.evaluate(async () => {
    const result = await fetch('/api/v1/_drop');
    return { status: result.status, headers: result.headers.get('cache-control'), body: await result.text() };
  });
  expect(transportResponse.status).toBe(502);
  expect(transportResponse.headers).toBe('no-store');
  expect(transportResponse.body).not.toContain('Sensitive internal failure');
  expect(transportResponse.body).not.toContain('do not expose this value');
});

