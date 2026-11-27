import { chromium, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const health = await fetch('http://127.0.0.1:4317/health').then((r) => r.json());
if (health.mode !== 'MOCK')
  throw new Error('Extension tests require a MOCK backend to avoid live API calls.');
const profile = await mkdtemp(resolve(tmpdir(), 'bs-extension-'));
const path = resolve('dist/chrome');
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
});
try {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  // Disable the fixture's standalone bundle so only the actual installed extension can analyze.
  await page.route('**/content.js', (r) => r.abort());
  await page.goto('http://127.0.0.1:4317');
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
  // Exercise extension injection on the real matched URL, using local synthetic markup.
  await page.route('https://www.linkedin.com/feed/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><main><p componentkey="test-key"><span data-testid="expandable-text-box">First run the database query on 500 rows. Then measure latency before and after adding an index. Check the sample and compare writes too: our writes became 6% slower.</span></p></main></body></html>',
    }),
  );
  await page.goto('https://www.linkedin.com/feed/');
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
  const diagnostics = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    return chrome.tabs.sendMessage(tabs[0].id!, { type: 'feed-status' });
  });
  expect(diagnostics).toMatchObject({
    version: '1.0.2',
    ready: true,
    cards: 1,
    readable: 1,
    rendered: 1,
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await expect(popup.locator('#mode')).toHaveText('Jev: DEMO (MOCK)');
  await popup.locator('#enabled').uncheck();
  await expect(page.locator('linkedin-bs-meter')).toHaveCount(0);
  await popup.locator('#enabled').check();
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
  await popup.locator('#details').uncheck();
  await page.locator('linkedin-bs-meter summary').first().click();
  await expect(page.getByText('Konkretne informacje')).toHaveCount(0);
  await popup.locator('#details').check();
  await popup.reload();
  await expect(popup.locator('#details')).toBeChecked();
  await expect(page.locator('linkedin-bs-meter').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/extension-chrome.png' });
  console.log(
    'Installed Chrome MV3 extension: messaging, popup, settings persistence, rendering PASS',
  );
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
