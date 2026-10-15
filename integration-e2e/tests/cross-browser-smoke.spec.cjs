const { test, expect } = require('@playwright/test');

const residentOrigin = `http://localhost:${process.env.PHASE2_RESIDENT_PORT || '5173'}`;
const staffOrigin = `http://localhost:${process.env.PHASE2_STAFF_PORT || '5174'}`;
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1365, height: 900 },
];

test('@cross-browser-smoke resident navigation and tracking form fit representative viewports', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${residentOrigin}/documents`);
    await expect(page.getByRole('link', { name: 'Track a request' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto(`${residentOrigin}/track`);
    await expect(page.getByLabel('Request reference')).toBeVisible();
    await expect(page.getByLabel('Private tracking credential')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${viewport.name} viewport should not create page-level horizontal overflow`).toBe(true);
  }
});

test('@cross-browser-smoke staff sign-in, session restore, and queue navigation fit representative viewports', async ({ page }) => {
  const username = process.env.PHASE2_TEST_ADMIN_USERNAME;
  const password = process.env.PHASE2_TEST_ADMIN_PASSWORD;
  if (!username || !password) throw new Error('Disposable browser-test administrator credentials are required.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${staffOrigin}/login`);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${staffOrigin}/requests`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${viewport.name} viewport should not create page-level horizontal overflow`).toBe(true);
  }
});
