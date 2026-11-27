import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const shared = await readFile('extension/shared.js', 'utf8');
const content = await readFile('extension/content.js', 'utf8');

async function fixture(page: Page, site = 'linkedin', options: Record<string, unknown> = {}) {
  const cdn = site === 'linkedin' ? 'media.licdn.com' : 'scontent.fbcdn.net';
  await page.route(`https://${cdn}/**`, route => route.fulfill({ path: 'public/sample-coffee.jpg', contentType: 'image/jpeg' }));
  const card = site === 'linkedin' ? 'data-view-name="feed-full-update"' : 'role="article"';
  await page.route(`https://www.${site}.com/**`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0"><main><article ${card}><img id="photo" src="https://${cdn}/ai.jpg" style="width:500px;height:320px"></article><nav><img id="avatar" src="https://${cdn}/avatar.jpg" width="200" height="200"></nav></main></body></html>` }));
  await page.goto(`https://www.${site}.com/feed/`);
  await page.waitForFunction(() => (document.querySelector('#photo') as HTMLImageElement).naturalWidth > 0);
  await page.evaluate(options => {
    const state = window as any;
    state.calls = [];
    state.settings = { enabled: true, threshold: 80, mode: 'mark', ...options };
    state.handlers = [];
    state.chrome = {
      storage: { local: { get: async () => ({ settings: state.settings }) }, onChanged: { addListener: (fn: any) => state.handlers.push(fn) } },
      runtime: { sendMessage: async (message: any) => {
        state.calls.push(message.url);
        if (message.url.includes('error')) return { error: 'Testowy błąd serwera' };
        return { probability: message.url.includes('real') ? .2 : .8, model: 'fixture' };
      } },
    };
    state.applySettings = (settings: any) => {
      state.settings = { ...state.settings, ...settings };
      state.handlers.forEach((fn: any) => fn({ settings: { newValue: state.settings } }, 'local'));
    };
  }, options);
  await page.addScriptTag({ content: shared });
  await page.addScriptTag({ content });
}
for (const site of ['linkedin', 'facebook']) {
  test(`${site}: inclusive 80% threshold, hide, reveal, live options, restore`, async ({ page }) => {
    await fixture(page, site);
    await expect(page.locator('jev-image-filter')).toContainText('Możliwe AI · 80%');
    expect(await page.evaluate(() => (window as any).calls.length)).toBe(1);
    await page.evaluate(() => (window as any).applySettings({ mode: 'hide' }));
    await expect(page.locator('#photo')).toHaveCSS('visibility', 'hidden');
    await page.getByRole('button', { name: 'Pokaż obraz', exact: true }).click();
    await expect(page.locator('#photo')).toHaveCSS('visibility', 'visible');
    await page.getByRole('button', { name: 'Ukryj ponownie' }).click();
    await expect(page.locator('#photo')).toHaveCSS('visibility', 'hidden');
    await page.evaluate(() => (window as any).applySettings({ threshold: 81 }));
    await expect(page.locator('#photo')).toHaveCSS('visibility', 'visible');
    await expect(page.locator('jev-image-filter button')).toHaveCount(0);
    await page.evaluate(() => (window as any).applySettings({ threshold: 80 }));
    await expect(page.locator('#photo')).toHaveCSS('visibility', 'hidden');
    await page.evaluate(() => (window as any).applySettings({ enabled: false }));
    await expect(page.locator('#photo')).toHaveCSS('visibility', 'visible');
    expect(await page.evaluate(() => (window as any).calls.length)).toBe(1);
  });
}
test('dynamic posts, recycled images, lazy loading and errors', async ({ page }) => {
  await fixture(page, 'linkedin', { mode: 'hide' });
  await expect(page.locator('#photo')).toHaveCSS('visibility', 'hidden');
  await page.locator('#photo').evaluate((img: HTMLImageElement) => { img.src = 'https://media.licdn.com/real.jpg'; });
  await expect(page.locator('#photo')).toHaveCSS('visibility', 'visible');
  await expect.poll(() => page.evaluate(() => (window as any).calls.length)).toBe(2);
  await expect(page.locator('jev-image-filter button')).toHaveCount(0);
  await page.evaluate(() => {
    const card = document.createElement('article');
    card.setAttribute('data-view-name', 'feed-full-update');
    card.innerHTML = '<img id="new" src="https://media.licdn.com/error.jpg" style="width:500px;height:320px">';
    document.querySelector('main')!.append(card);
  });
  await expect(page.getByRole('button', { name: 'Ponów' })).toBeVisible();
  await expect(page.locator('#new')).toHaveCSS('visibility', 'visible');
  await page.getByRole('button', { name: 'Ponów' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).calls.length)).toBe(4);
});
test('offscreen images wait for scrolling and duplicate URLs reuse results', async ({ page }) => {
  await fixture(page);
  await expect(page.locator('jev-image-filter')).toContainText('80%');
  await page.evaluate(() => {
    const card = document.createElement('article');
    card.setAttribute('data-view-name', 'feed-full-update');
    card.style.marginTop = '2000px';
    card.innerHTML = '<img id="below" src="https://media.licdn.com/other.jpg" style="width:500px;height:320px">';
    document.querySelector('main')!.append(card);
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).calls.length)).toBe(1);
  await page.locator('#below').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as any).calls.length)).toBe(2);
  await page.locator('#below').evaluate((img: HTMLImageElement) => { img.src = 'https://media.licdn.com/ai.jpg'; });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).calls.length)).toBe(2);
});
test('options persist the threshold and action, and show backend readiness', async ({ page }) => {
  await page.route('http://127.0.0.1:3000/api/status', route => route.fulfill({ json: { configured: true } }));
  await page.route('http://jev-options.test/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/').pop() || 'options.html';
    await route.fulfill({ path: `extension/${file}` });
  });
  await page.addInitScript(() => {
    const state = window as any;
    state.chrome = { storage: { local: {
      get: async () => ({ settings: { enabled: true, threshold: 80, mode: 'mark' } }),
      set: async (value: any) => { state.saved = value; },
    } } };
  });
  await page.goto('http://jev-options.test/options.html');
  await expect(page.locator('#value')).toHaveText('80%');
  await expect(page.locator('#connection')).toHaveText('Serwer gotowy do analizy.');
  await page.locator('#threshold').fill('92');
  await expect(page.locator('#value')).toHaveText('92%');
  await page.locator('#mode').selectOption('hide');
  await page.getByRole('button', { name: 'Zapisz ustawienia' }).click();
  await expect(page.locator('#status')).toContainText('Zapisano');
  expect(await page.evaluate(() => (window as any).saved.settings)).toEqual({ enabled: true, threshold: 92, mode: 'hide' });
  await page.screenshot({ path: '/tmp/jev-image-options.png', fullPage: true });
});
