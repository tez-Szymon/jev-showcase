import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
test('Chrome package runs its content script, background bridge, and popup', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.route('https://www.youtube.com/**', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<html><body><h1>Production caching</h1><ytd-comment-thread-renderer><ytd-comment-view-model><div id="content-text">We deployed this architecture at 20M requests per day. Versioned keys prevented stale reads during rolling deploys.</div></ytd-comment-view-model></ytd-comment-thread-renderer></body></html>',
      }),
    );
    await page.goto('https://www.youtube.com/watch?v=fixture');
    await expect(page.locator('[data-yt-insight-analyzed]')).toHaveCount(1);
    await expect(page.locator('.yif-details')).toContainText('MOCK');
    await expect(page.locator('.yif-details summary')).toContainText('Wartościowy komentarz');
    await expect(page.locator('.yif-details summary')).toContainText('Własne doświadczenie');
    await page.locator('.yif-details summary').click();
    await page.evaluate(() => {
      document.documentElement.setAttribute('dark', '');
      document.body.style.background = '#0f0f0f';
      document.body.style.setProperty('--yt-spec-text-primary', '#0f0f0f');
    });
    await expect(page.locator('.yif-details summary')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('.yif-details pre')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await page.evaluate(() => document.documentElement.removeAttribute('dark'));
    await expect(page.locator('.yif-details summary')).toHaveCSS('color', 'rgb(15, 15, 15)');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.locator('h1')).toHaveText('YouTube Insight Filter');
    await popup.locator('#enabled').uncheck();
    await expect(page.locator('.yif-useful')).toHaveCount(0);
    await popup.locator('#enabled').check();
    await expect(page.locator('.yif-useful')).toHaveCount(1);
  } finally {
    await context.close();
  }
});
