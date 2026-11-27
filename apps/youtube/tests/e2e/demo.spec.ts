import { test, expect } from '@playwright/test';
test('fixture batches, caches, observes insertions, filters, themes, and scrolls', async ({
  page,
  request,
}) => {
  const sizes: number[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/analyze')) sizes.push(r.postDataJSON().comments.length);
  });
  await page.goto('/');
  await expect(page.locator('#analyzed')).toHaveText('32');
  expect(sizes.length).toBeLessThan(32);
  expect(Math.max(...sizes)).toBeGreaterThan(1);
  await expect(page.locator('#engine-mode')).toHaveText('MOCK');
  const before = await request.get('/health').then((r) => r.json());
  await page.locator('#load-more').click();
  await expect(page.locator('#analyzed')).toHaveText('40');
  const after = await request.get('/health').then((r) => r.json());
  expect(after.evaluated - before.evaluated).toBeLessThan(8);
  await page.locator('#top button').first().click();
  await expect(page.locator('.comment:focus')).toHaveCount(1);
  await page.locator('#theme').click();
  await expect(page.locator('body')).toHaveClass('dark');
  await page.screenshot({ path: 'test-results/demo-dark.png', fullPage: false });
  await page.locator('#theme').click();
  await page.screenshot({ path: 'test-results/demo-light.png', fullPage: false });
  await page.locator('#mode').selectOption('only');
  await expect(page.locator('.yif-collapse').first()).toBeHidden();
  await page.locator('#enabled').uncheck();
  await expect(page.locator('.yif-collapse')).toHaveCount(0);
  await expect(page.locator('.yif-useful')).toHaveCount(0);
  await page.locator('#enabled').check();
  await page.locator('#debug').check();
  await page.locator('.yif-details summary').first().click();
  await expect(page.locator('.yif-details').first()).toContainText('DANE WEJŚCIOWE JEV');
});
test('offline proxy leaves comments readable and retry recovers', async ({ page }) => {
  await page.route('**/analyze', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#engine-mode')).toHaveText('BRAK POŁĄCZENIA');
  await expect(page.locator('[data-demo-comment]')).toHaveCount(32);
  await expect(page.locator('.yif-collapse')).toHaveCount(0);
  await page.unroute('**/analyze');
  await page.locator('#retry').click();
  await expect(page.locator('#analyzed')).toHaveText('32');
});
