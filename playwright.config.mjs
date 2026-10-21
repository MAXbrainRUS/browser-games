// Tests: `npm test`. Every game runs on a desktop with a mouse, iPhone (portrait and landscape)
// and iPad with touch — in Chromium, and also in WebKit (the Safari engine) when it is installed.
// Shared checks live in tests/, a game's own checks in games/<id>/*.spec.mjs.
import { defineConfig, devices, webkit } from '@playwright/test';
import { existsSync } from 'node:fs';

const PORT = 4173;
const hasWebkit = (() => { try { return existsSync(webkit.executablePath()); } catch { return false; } })();

const screens = {
  desktop: { viewport: { width: 1280, height: 800 } },
  iphone: devices['iPhone 15'],
  'iphone-landscape': devices['iPhone 15 landscape'],
  ipad: devices['iPad Pro 11 landscape'],
};
const projects = Object.entries(screens).map(([name, use]) => ({ name, use: { ...use, browserName: 'chromium' } }));
if (hasWebkit) {
  projects.push(
    { name: 'safari-iphone', use: { ...devices['iPhone 15'], browserName: 'webkit' } },
    { name: 'safari-ipad', use: { ...devices['iPad Pro 11 landscape'], browserName: 'webkit' } },
  );
}

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.spec.mjs', 'games/*/*.spec.mjs'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/browser-games/`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    // Building first makes a broken game.json fail the run with a readable message
    command: `node scripts/build.mjs && node scripts/serve.mjs --port ${PORT} --quiet`,
    url: `http://localhost:${PORT}/browser-games/`,
    reuseExistingServer: !process.env.CI,
  },
  projects,
});
