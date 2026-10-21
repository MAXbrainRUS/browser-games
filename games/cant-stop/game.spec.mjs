import { expect, test } from '@playwright/test';
import { press } from '../../tests/helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('games/cant-stop/');
});

test('ход: кубики, пара, «Стоп» — и партия переживает перезагрузку', async ({ page, hasTouch }) => {
  await press(page.getByRole('button', { name: 'Начать партию' }), hasTouch);
  await expect(page.locator('.turn h2')).toHaveText('Игрок 1');

  for (let i = 0; i < 4; i++) await press(page.getByRole('button', { name: 'Кубик 1', exact: true }), hasTouch);
  const pair = page.locator('button.opt').first();
  await expect(pair).toContainText('два шага по колонке 2');
  await press(pair, hasTouch);
  await expect(page.locator('.runner')).toHaveCount(1);

  await press(page.locator('[data-act="stop"]'), hasTouch);
  await expect(page.locator('.turn h2')).toHaveText('Игрок 2');
  await expect(page.locator('.flash')).toContainText('Игрок 1: шаги закреплены');

  await page.reload();
  await expect(page.locator('.turn h2')).toHaveText('Игрок 2');
  await press(page.locator('[data-act="undo"]'), hasTouch);
  await expect(page.locator('.turn h2')).toHaveText('Игрок 1');
});

test('кубики можно вводить с клавиатуры', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'клавиатура — на компьютере');
  await page.getByRole('button', { name: 'Начать партию' }).click();
  await page.keyboard.press('3');
  await page.keyboard.press('4');
  await page.keyboard.press('5');
  await expect(page.locator('.slotd.filled')).toHaveCount(3);
  await page.keyboard.press('Backspace');
  await expect(page.locator('.slotd.filled')).toHaveCount(2);
  await page.keyboard.press('6');
  await page.keyboard.press('6');
  await expect(page.locator('button.opt').first()).toBeVisible();
});
