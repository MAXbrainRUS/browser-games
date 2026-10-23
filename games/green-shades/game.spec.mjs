import { expect, test } from '@playwright/test';
import { press, touchDrag } from '../../tests/helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('games/green-shades/');
});

// Name of the shade shown on the i-th card
const nameOn = async (page, i) => {
  const hex = await page.locator('.card').nth(i).locator('.hex').textContent();
  return page.evaluate(h => POOL.find(c => c.hex === h).n, hex);
};
const bankChip = (page, name) => page.locator('#bank .chip', { hasText: new RegExp(`^${name}$`) });

test('нажатиями «слово → цвет» раскладывается всё верно', async ({ page, hasTouch }) => {
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(8);
  for (let i = 0; i < 8; i++) {
    const name = await nameOn(page, i);
    await press(bankChip(page, name), hasTouch);
    await press(cards.nth(i), hasTouch);
    await expect(cards.nth(i).locator('.chip')).toHaveText(name);
  }
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(page.locator('#result')).toHaveText('Все 8 верно!');
});

test('ошибка подсвечивается, показывает верное название и немецкое, её можно исправить', async ({ page, hasTouch }) => {
  const cards = page.locator('.card');
  const [a, b] = [await nameOn(page, 0), await nameOn(page, 1)];
  await press(bankChip(page, b), hasTouch);
  await press(cards.nth(0), hasTouch);
  await press(bankChip(page, a), hasTouch);
  await press(cards.nth(1), hasTouch);
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(cards.nth(0)).toHaveClass(/bad/);
  const de = await page.evaluate(n => POOL.find(c => c.n === n).de, a);
  await expect(cards.nth(0).locator('.pill')).toContainText(a);
  await expect(cards.nth(0).locator('.pill')).toContainText(de);
  await expect(page.locator('#result')).toHaveText('Верно 0 из 8, пустых: 6. Красные можно поправить и проверить снова.');

  // swap the two words right on the cards
  await press(cards.nth(0).locator('.chip'), hasTouch);
  await press(cards.nth(1).locator('.chip'), hasTouch);
  await expect(cards.nth(0).locator('.chip')).toHaveText(a);
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(cards.nth(0)).toHaveClass(/ok/);
  await expect(page.locator('#result')).toHaveText('Верно 2 из 8, пустых: 6. Красные можно поправить и проверить снова.');
});

test('«Заново» берёт новые 8 оттенков из 16, простого «Зелёного» среди них нет', async ({ page, hasTouch }) => {
  const pool = await page.evaluate(() => POOL.map(c => c.n));
  expect(pool).toHaveLength(16);
  expect(new Set(pool).size).toBe(16);
  expect(pool.filter(n => /^зел[её]ный$/i.test(n))).toEqual([]);

  const sets = new Set();
  for (let round = 0; round < 4; round++) {
    const words = await page.locator('#bank .chip').allTextContents();
    expect(words).toHaveLength(8);
    expect(words.every(w => pool.includes(w))).toBe(true);
    const shown = await Promise.all([...Array(8).keys()].map(i => nameOn(page, i)));
    expect([...shown].sort()).toEqual([...words].sort());
    sets.add([...words].sort().join());
    await press(page.getByRole('button', { name: 'Заново' }), hasTouch);
  }
  // four random rounds drawing the same 8 of 16 every time: chance 1 in 2.4 billion
  expect(sets.size).toBeGreaterThan(1);
});

test('слово перетаскивается мышью или пальцем и остаётся после перезагрузки', async ({ page, hasTouch, browserName }) => {
  test.skip(hasTouch && browserName !== 'chromium', 'касания пальцем умеем имитировать только в Chromium');
  const chip = page.locator('#bank .chip').first();
  const word = await chip.textContent();
  const card = page.locator('.card').first();
  const hex = await card.locator('.hex').textContent();
  if (hasTouch) await touchDrag(page, chip, card);
  else await chip.dragTo(card);
  await expect(card.locator('.chip')).toHaveText(word);
  await expect(page.locator('#bank .chip')).toHaveCount(7);

  await page.reload();
  await expect(page.locator('.card').first().locator('.hex')).toHaveText(hex);
  await expect(page.locator('.card').first().locator('.chip')).toHaveText(word);
});

test('испорченное сохранение не ломает игру', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('green-shades.v1', JSON.stringify({ ids: [0, 0, 1], slots: [], placed: [], bank: [] })));
  await page.reload();
  await expect(page.locator('.card')).toHaveCount(8);
  await expect(page.locator('#bank .chip')).toHaveCount(8);
});
