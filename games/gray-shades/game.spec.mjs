import { expect, test } from '@playwright/test';
import { press, touchDrag } from '../../tests/helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('games/gray-shades/');
});

// Name of the shade shown on the i-th card
const nameOn = async (page, i) => {
  const hex = await page.locator('.card').nth(i).locator('.hex').textContent();
  return page.evaluate(h => COLORS.find(c => c.hex === h).n, hex);
};
const bankChip = (page, name) => page.locator('#bank .chip', { hasText: new RegExp(`^${name}$`) });

test('нажатиями «слово → цвет» раскладывается всё верно', async ({ page, hasTouch }) => {
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(9);
  for (let i = 0; i < 9; i++) {
    const name = await nameOn(page, i);
    await press(bankChip(page, name), hasTouch);
    await press(cards.nth(i), hasTouch);
    await expect(cards.nth(i).locator('.chip')).toHaveText(name);
  }
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(page.locator('#result')).toHaveText('Все 9 верно!');
});

test('ошибка подсвечивается, показывает верное название, её можно исправить', async ({ page, hasTouch }) => {
  const cards = page.locator('.card');
  const [a, b] = [await nameOn(page, 0), await nameOn(page, 1)];
  await press(bankChip(page, b), hasTouch);
  await press(cards.nth(0), hasTouch);
  await press(bankChip(page, a), hasTouch);
  await press(cards.nth(1), hasTouch);
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(cards.nth(0)).toHaveClass(/bad/);
  await expect(cards.nth(0).locator('.pill')).toHaveText(a);
  await expect(page.locator('#result')).toHaveText('Верно 0 из 9, пустых: 7. Красные можно поправить и проверить снова.');

  // swap the two words right on the cards
  await press(cards.nth(0).locator('.chip'), hasTouch);
  await press(cards.nth(1).locator('.chip'), hasTouch);
  await expect(cards.nth(0).locator('.chip')).toHaveText(a);
  await press(page.getByRole('button', { name: 'Проверить' }), hasTouch);
  await expect(cards.nth(0)).toHaveClass(/ok/);
  await expect(cards.nth(0).locator('.pill')).toHaveCount(0);
  await expect(page.locator('#result')).toHaveText('Верно 2 из 9, пустых: 7. Красные можно поправить и проверить снова.');
});

test('всегда одни и те же 9 оттенков, простого «Серого» нет; «Заново» снимает слова с карточек', async ({ page, hasTouch }) => {
  const names = await page.evaluate(() => COLORS.map(c => c.n));
  expect([...names].sort()).toEqual(['Гранит', 'Графитовый', 'Маренго', 'Мокрый асфальт', 'Мокрый камень', 'Оловянный', 'Серебристый', 'Стальной', 'Угольный']);

  await press(page.locator('#bank .chip').first(), hasTouch);
  await press(page.locator('.card').first(), hasTouch);
  await expect(page.locator('#bank .chip')).toHaveCount(8);
  await press(page.getByRole('button', { name: 'Заново' }), hasTouch);
  await expect(page.locator('.card .chip')).toHaveCount(0);
  expect((await page.locator('#bank .chip').allTextContents()).sort()).toEqual([...names].sort());
  const shown = await Promise.all(names.map((_, i) => nameOn(page, i)));
  expect(shown.sort()).toEqual([...names].sort());
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
  await expect(page.locator('#bank .chip')).toHaveCount(8);

  await page.reload();
  await expect(page.locator('.card').first().locator('.hex')).toHaveText(hex);
  await expect(page.locator('.card').first().locator('.chip')).toHaveText(word);
});

test('испорченное сохранение не ломает игру', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('gray-shades.v1', JSON.stringify({ slots: [0, 0, 1], placed: [], bank: [] })));
  await page.reload();
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.locator('#bank .chip')).toHaveCount(9);
});

test('на планшете и компьютере все девять цветов видны сразу, над лотком с названиями', async ({ page }) => {
  const { width, height } = page.viewportSize();
  test.skip(width < 760 || height < 600, 'на телефоне карточки прокручиваются');
  const trayTop = (await page.locator('#tray').boundingBox()).y;
  for (const card of await page.locator('.card').all()) {
    const box = await card.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(trayTop);
  }
});
