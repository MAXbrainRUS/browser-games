#!/usr/bin/env node
// Creates games/<id>/ from templates/game: `npm run new -- my-game "Моя игра"`
import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './build.mjs';

const [id, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();
if (!id || !title) {
  console.error('Как запустить: npm run new -- <папка> "<Название>"\nНапример:    npm run new -- memory "Найди пару"');
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error(`«${id}» не подходит: только латиница в нижнем регистре, цифры и дефисы (например, find-pair)`);
  process.exit(1);
}
const dest = path.join(ROOT, 'games', id);
if (await stat(dest).catch(() => null)) {
  console.error(`games/${id} уже есть — выберите другое имя`);
  process.exit(1);
}

const xml = s => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const json = s => JSON.stringify(s).slice(1, -1);
const letter = [...title][0].toUpperCase();

await cp(path.join(ROOT, 'templates', 'game'), dest, { recursive: true });
for (const f of await readdir(dest)) {
  const file = path.join(dest, f);
  const quote = f.endsWith('.json') ? json : xml;
  const text = (await readFile(file, 'utf8'))
    .replaceAll('{{ID}}', id)
    .replaceAll('{{TITLE}}', quote(title))
    .replaceAll('{{LETTER}}', quote(letter));
  await writeFile(file, text);
}

console.log(`Готово: games/${id}/
  index.html      — сама игра (сейчас там пример-счётчик, замените его)
  game.json       — название, описание и метки для каталога
  icon.svg        — иконка в каталоге
  game.spec.mjs   — проверки игры

Дальше: npm run dev — посмотреть, npm test -- -g ${id} — проверить.`);
