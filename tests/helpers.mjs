// Helpers for game tests: import { press, ... } from '../../tests/helpers.mjs'
import { expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function listGames() {
  return readdirSync(path.join(ROOT, 'games'), { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => ({ id: d.name, ...JSON.parse(readFileSync(path.join(ROOT, 'games', d.name, 'game.json'), 'utf8')) }));
}

// Tap on touch screens, click with the mouse elsewhere: a test written with press() checks both
export async function press(locator, hasTouch) {
  if (hasTouch) await locator.tap();
  else await locator.click();
}

// Drags a finger from one element to another with real touch events (Chromium only: use
// test.skip(browserName !== 'chromium') around it). Playwright has no touch drag of its own.
export async function touchDrag(page, from, to, steps = 12) {
  const center = async loc => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  await from.scrollIntoViewIfNeeded();
  const a = await center(from), b = await center(to);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  await touch('touchStart', a);
  for (let i = 1; i <= steps; i++) await touch('touchMove', { x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps });
  await touch('touchEnd');
  await cdp.detach();
}

// Collects uncaught exceptions and console errors of the page. External resources (fonts) are
// allowed to fail: the game has to work without them.
export function watchErrors(page) {
  const errors = [];
  const own = url => !url || url.startsWith('http://localhost');
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && own(msg.location().url)) errors.push(msg.text());
  });
  page.on('requestfailed', req => {
    if (own(req.url()) && !/ERR_ABORTED|cancelled/i.test(req.failure()?.errorText || '')) errors.push(`не загрузилось: ${req.url()}`);
  });
  page.on('response', res => {
    if (own(res.url()) && res.status() >= 400) errors.push(`${res.status()}: ${res.url()}`);
  });
  return errors;
}

export async function expectFitsScreen(page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, 'страница шире экрана — появится горизонтальная прокрутка').toBeLessThanOrEqual(width + 1);
}

// Saves a screenshot to screenshots/<screen>/<name>.png (uploaded by CI for every pull request)
export async function screenshot(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(ROOT, 'screenshots', testInfo.project.name, name + '.png');
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, animations: 'disabled' });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
}
