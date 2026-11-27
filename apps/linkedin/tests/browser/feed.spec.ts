import { test, expect } from '@playwright/test';
test('viewport batching, deduplication, controls, changed text and inserted posts', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/analyze')) sent.push(...r.postDataJSON().posts);
  });
  await page.goto('/');
  await expect(page.locator('article')).toHaveCount(12);
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
  expect(sent.length).toBeLessThan(12);
  await page.locator('linkedin-bs-meter summary').first().click();
  await expect(page.getByText('Konkretne informacje').first()).toBeVisible();
  const initial = sent.length;
  await page.locator('#reanalyze').click();
  await page.waitForTimeout(650);
  expect(sent.length).toBe(initial);
  await page.locator('#sensitivity').fill('90');
  await page.waitForTimeout(450);
  expect(sent.length).toBe(initial);
  await page.locator('#enabled').uncheck();
  await expect(page.locator('linkedin-bs-meter')).toHaveCount(0);
  await page.locator('#enabled').check();
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
  expect(sent.length).toBe(initial);
  await page.evaluate(() => {
    const copy = document.querySelector('article')!.cloneNode(true) as HTMLElement;
    copy.querySelector('linkedin-bs-meter')?.remove();
    delete copy.dataset.bsRendered;
    document.getElementById('feed')!.prepend(copy);
  });
  await expect(page.locator('article').first().locator('linkedin-bs-meter')).toHaveCount(1);
  expect(sent.length).toBe(initial);
  await page
    .locator('article')
    .first()
    .locator('[data-post-text]')
    .evaluate((el) => {
      el.textContent =
        'We measured 30 requests and compared latency before the index. First check the query plan, then test with 200 users. This experiment failed because the sample was too small. Unique edited text.';
    });
  await expect.poll(() => sent.length).toBe(initial + 1);
  await page.locator('#load-more').click();
  await page.locator('article').last().scrollIntoViewIfNeeded();
  await expect(page.locator('article').last().locator('linkedin-bs-meter')).toBeVisible();
  expect(sent.some((t) => t.startsWith('Update 1:'))).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  expect(new Set(sent).size).toBe(sent.length);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/feed-${test.info().project.name}.png`,
    fullPage: false,
  });
});
test('offline failure is visible and retry recovers', async ({ page }) => {
  await page.route('**/analyze', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test unavailable' }),
    }),
  );
  await page.goto('/');
  await expect(page.locator('.bs-status').first()).toBeVisible();
  await page.unroute('**/analyze');
  await page.locator('.bs-status').first().click();
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
});
test('mobile layout and origin boundary', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('article').first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  const forbidden = await request.post('/analyze', {
    headers: { Origin: 'https://untrusted.example' },
    data: { posts: ['hello'] },
  });
  expect(forbidden.status()).toBe(403);
  const bad = await request.post('/analyze', { data: { posts: [] } });
  expect(bad.status()).toBe(400);
});
test('SDUI keyed paragraph and list items work during continuous mutations', async ({ page }) => {
  const sent: string[] = [];
  await page.route('**/analyze', async (route) => {
    sent.push(...route.request().postDataJSON().posts);
    await route.fulfill({
      json: {
        results: route
          .request()
          .postDataJSON()
          .posts.map(() => ({
            scores: { concreteness: 4, actionable: 4, selfPromotion: 1, platitudes: 1 },
            confidence: { concreteness: 0.8, actionable: 0.8, selfPromotion: 0.8, platitudes: 0.8 },
            insight: 0.9,
            mode: 'MOCK',
          })),
      },
    });
  });
  // Shape supplied by the user, with synthetic prose; no author/profile data retained.
  await page.route('**/demo/linkedin-fixture.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><main>
 <div id="ticker"></div><div id="feed">
 <p class="m6fmff m6fmeh m6flzx" componentkey="synthetic-uuid"><span class="m6fmsj m6fmly" tabindex="-1" data-testid="expandable-text-box">We measured 500 requests before adding the index.<br><strong>Then compare latency and check write throughput.</strong> The test took 30 minutes; use a sample of real traffic and verify the rollback before deployment.<button aria-hidden="true" data-testid="expandable-text-button">… więcej</button></span></p>
 <div role="listitem"><div>AUTHOR MUST NOT BE SENT</div><p><span data-testid="expandable-text-box">First check the database query plan. Then run a test with 200 requests and compare latency before and after the index. We measured a 20% improvement, but writes were 5% slower.</span></p><div componentkey="comment-commentary-123"><span data-testid="expandable-text-box">COMMENT MUST NOT BE SENT</span></div></div>
 </div></main><aside><span data-testid="expandable-text-box">SIDEBAR MUST NOT BE SENT</span></aside><script src="/content.js"></script></body></html>`,
    }),
  );
  await page.goto('/demo/linkedin-fixture.html');
  await page.evaluate(() => {
    (window as unknown as { ticker: number }).ticker = window.setInterval(() => {
      document.getElementById('ticker')!.textContent = String(Date.now());
    }, 30);
  });
  await expect(page.locator('linkedin-bs-meter')).toHaveCount(2);
  expect(sent).toHaveLength(2);
  expect(sent.join(' ')).not.toMatch(/więcej|MUST NOT BE SENT/);
  await page.waitForTimeout(700);
  expect(sent).toHaveLength(2);
  await page.evaluate(() => {
    document.querySelector('linkedin-bs-meter')!.remove();
  });
  // A subsequent host mutation should restore a meter LinkedIn removed, from cache.
  await expect(page.locator('linkedin-bs-meter')).toHaveCount(2);
  expect(sent).toHaveLength(2);
  await page.evaluate(() => {
    clearInterval((window as unknown as { ticker: number }).ticker);
  });
});
