import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PREVIEW_URL = 'http://localhost:5174';

test.describe('M8 — PWA build artifacts', () => {
  test('dist contains sw.js and manifest.webmanifest', () => {
    const distDir = path.resolve(__dirname, '../dist');
    expect(fs.existsSync(path.join(distDir, 'sw.js')), 'sw.js missing — run npm run build').toBe(true);
    expect(
      fs.existsSync(path.join(distDir, 'manifest.webmanifest')),
      'manifest.webmanifest missing',
    ).toBe(true);
  });

  test('manifest.webmanifest has required PWA fields', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../dist/manifest.webmanifest'), 'utf-8'),
    );
    expect(manifest.name).toBe('SpendShare');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
});

test.describe('M8 — Offline shell', () => {
  test.skip(
    !fs.existsSync(path.resolve(__dirname, '../dist/sw.js')),
    'Production build not present — run npm run build first',
  );

  test('app shell loads after going offline', async ({ context, page }) => {
    // Step 1: load the app online so the service worker installs and caches the shell
    await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
    await expect(page.locator('#root')).toBeAttached();

    // Step 2: wait for SW to activate (up to 5s); SW may not activate on first load
    await page.waitForFunction(
      () => navigator.serviceWorker?.controller !== null,
      { timeout: 5000 },
    ).catch(() => {
      // SW may not activate within 5s on first load — shell is still pre-cached
    });

    // Step 3: go offline
    await context.setOffline(true);

    // Step 4: reload — shell should be served from Workbox pre-cache
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Step 5: verify the React root mounted (app shell rendered)
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.locator('body')).not.toBeEmpty();

    // Step 6: restore online
    await context.setOffline(false);
  });
});
