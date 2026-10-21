import { expect, test } from '@playwright/test';
import { press, touchDrag } from '../../tests/helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('games/purple-shades/');
});

test('нажатиями «слово → цвет» раскладывается всё верно', async ({ page, hasTouch }) => {
  const colors = await page.evaluate(() => COLORS);
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(colors.length);
  for (let i = 0; i < colors.length; i++) {
    const hex = await cards.nth(i).locator('.hex').textContent();
    const name = colors.find(c => c.hex === hex).n;
    await press(page.locator('#bank .chip', { hasText: new RegExp(`^${name}$`) }), hasTouch);
    await press(cards.nth(i), hasTouch);
    await expect(cards.nth(i).locator('.chip')).toHaveText(name);
  }
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(page.locator('#result')).toHaveText(`Все ${colors.length} верно!`);
});

test('слово перетаскивается мышью или пальцем и остаётся после перезагрузки', async ({ page, hasTouch, browserName }) => {
  test.skip(hasTouch && browserName !== 'chromium', 'касания пальцем умеем имитировать только в Chromium');
  const chip = page.locator('#bank .chip').first();
  const word = await chip.textContent();
  const card = page.locator('.card').first();
  if (hasTouch) await touchDrag(page, chip, card);
  else await chip.dragTo(card);
  await expect(card.locator('.chip')).toHaveText(word);
  await expect(page.locator('#bank .chip')).toHaveCount(7);

  await page.reload();
  await expect(page.locator('.card').first().locator('.chip')).toHaveText(word);
});
