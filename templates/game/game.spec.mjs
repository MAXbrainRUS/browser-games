// The game's own checks: run with `npm test -- -g {{ID}}`. press() taps on phones and tablets and clicks on desktop.
import { expect, test } from '@playwright/test';
import { press } from '../../tests/helpers.mjs';

test('счёт растёт от нажатий и сохраняется после перезагрузки', async ({ page, hasTouch }) => {
  await page.goto('games/{{ID}}/');
  for (let i = 0; i < 3; i++) await press(page.locator('#tap'), hasTouch);
  await expect(page.locator('#count')).toHaveText('3');
  await page.reload();
  await expect(page.locator('#count')).toHaveText('3');
});

test('играется с клавиатуры', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'клавиатура — на компьютере');
  await page.goto('games/{{ID}}/');
  await page.locator('#tap').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expect(page.locator('#count')).toHaveText('2');
});
