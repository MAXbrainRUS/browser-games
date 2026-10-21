// Checks every game gets for free: it opens without errors on each screen, fits the screen,
// leads back to the catalog, and works offline. A screenshot of each game lands in screenshots/.
import { expect, test } from '@playwright/test';
import { expectFitsScreen, listGames, press, screenshot, watchErrors } from './helpers.mjs';

const games = listGames();
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'достаточно проверить один раз');

test.describe('каталог', () => {
  test('показывает все игры', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto('./');
    await expect(page.locator('a.card')).toHaveCount(games.length);
    for (const g of games) await expect(page.locator(`a.card[href="games/${g.id}/"]`)).toContainText(g.title);
    await expectFitsScreen(page);
    await screenshot(page, testInfo, '_catalog');
    expect(errors).toEqual([]);
  });

  test('ставится на экран «Домой»: манифест и иконки на месте', async ({ page, request }) => {
    desktopOnly();
    await page.goto('./');
    const manifestUrl = new URL(await page.locator('link[rel=manifest]').getAttribute('href'), page.url());
    const manifest = await (await request.get(manifestUrl.href)).json();
    expect(manifest.start_url).toBe('./');
    const icons = [...manifest.icons.map(i => new URL(i.src, manifestUrl)), new URL(await page.locator('link[rel=apple-touch-icon]').getAttribute('href'), page.url())];
    for (const icon of icons) expect((await request.get(icon.href)).ok(), icon.href).toBe(true);
  });

  test('после первого открытия всё работает без интернета', async ({ browser, baseURL }) => {
    desktopOnly();
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    for (const g of games) {
      await page.goto(`${baseURL}games/${g.id}/`);
      await expect(page.locator('[data-home]').first()).toBeAttached();
    }
    await page.goto(baseURL);
    await expect(page.locator('a.card')).toHaveCount(games.length);
    await context.close();
  });
});

for (const g of games) {
  test.describe(`${g.id}`, () => {
    test('открывается без ошибок и помещается на экран', async ({ page }, testInfo) => {
      const errors = watchErrors(page);
      await page.goto(`games/${g.id}/`);
      await page.waitForLoadState('load');
      const controls = page.locator('button, input, select, textarea, canvas, svg, [role=button], [tabindex], a[href]:not([data-home])');
      await expect(controls.filter({ visible: true }).first(), 'на экране нет ни одного элемента игры').toBeVisible();
      await expectFitsScreen(page);
      await screenshot(page, testInfo, g.id);
      expect(errors, 'ошибки на странице').toEqual([]);
    });

    test('возвращает в каталог', async ({ page, hasTouch }) => {
      await page.goto(`games/${g.id}/`);
      const home = page.locator('[data-home]').first();
      await expect(home, 'нет ссылки «Все игры» (элемент с data-home)').toBeVisible();
      await press(home, hasTouch);
      await expect(page).toHaveURL(/\/browser-games\/$/);
      await expect(page.locator('a.card').first()).toBeVisible();
    });
  });
}
