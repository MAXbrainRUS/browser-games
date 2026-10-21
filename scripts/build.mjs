#!/usr/bin/env node
// Builds the static site into dist/: checks every games/<id>/ folder, renders the catalog page
// from games/*/game.json and writes a service worker that precaches everything for offline play.
// No dependencies, so GitHub Actions can run it with plain Node.
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');
const SITE = path.join(ROOT, 'site');
const GAMES = path.join(ROOT, 'games');

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GAME_KEYS = new Set(['title', 'description', 'tags', 'icon']);
// Root-absolute URLs break on GitHub Pages, where the site lives under /<repo>/
const ABSOLUTE_URL_RE = /(?:\b(?:src|href|action|poster)\s*=\s*["']?|url\(\s*["']?)\/(?!\/)/i;
const KIT_RE = /<script\b[^>]*\bsrc=["']?\.\.\/\.\.\/shared\/game-kit\.js["']?/i;

// Files in a game folder that are for development only and are not published
const isPrivate = name => name.startsWith('.') || /\.md$/i.test(name) || /\.(spec|test)\.[cm]?[jt]s$/i.test(name);

export class BuildError extends Error {
  constructor(problems) {
    super('Сборка остановлена:\n' + problems.map(p => '  • ' + p).join('\n'));
    this.problems = problems;
  }
}

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

// Reads and checks games/*/game.json. Throws BuildError listing every problem at once.
export async function loadGames() {
  const problems = [];
  const games = [];
  const dirs = (await readdir(GAMES, { withFileTypes: true })).filter(d => d.isDirectory() && !d.name.startsWith('.'));
  for (const { name: id } of dirs) {
    const where = `games/${id}`;
    const bad = msg => problems.push(`${where}: ${msg}`);
    if (!ID_RE.test(id)) { bad('имя папки — только латиница в нижнем регистре, цифры и дефисы (например, my-game)'); continue; }

    let meta;
    try {
      meta = JSON.parse(await readFile(path.join(GAMES, id, 'game.json'), 'utf8'));
    } catch (e) {
      bad(e.code === 'ENOENT' ? 'нет файла game.json' : 'game.json — не JSON: ' + e.message);
      continue;
    }
    for (const key of Object.keys(meta)) if (!GAME_KEYS.has(key)) bad(`game.json: неизвестное поле «${key}» (можно: ${[...GAME_KEYS].join(', ')})`);
    if (typeof meta.title !== 'string' || !meta.title.trim()) bad('game.json: нужно поле title — название игры');
    if (typeof meta.description !== 'string' || !meta.description.trim()) bad('game.json: нужно поле description — одна-две фразы для каталога');
    if (meta.tags !== undefined && !(Array.isArray(meta.tags) && meta.tags.every(t => typeof t === 'string' && t.trim()))) bad('game.json: tags — список строк');
    const icon = meta.icon ?? 'icon.svg';
    if (typeof icon !== 'string' || icon.includes('..') || icon.startsWith('/')) bad('game.json: icon — имя файла внутри папки игры');

    const files = (await walk(path.join(GAMES, id))).filter(f => !f.split('/').some(isPrivate));
    if (!files.includes('index.html')) { bad('нет index.html'); continue; }
    const hasIcon = files.includes(icon);
    if (meta.icon !== undefined && !hasIcon) bad(`game.json: нет файла иконки ${icon}`);

    const html = await readFile(path.join(GAMES, id, 'index.html'), 'utf8');
    if (!/<meta\b[^>]*name=["']?viewport[^>]*width=device-width/i.test(html)) bad('index.html: нужен <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    if (!/<title>[^<]+<\/title>/i.test(html)) bad('index.html: нужен <title>');
    if (!KIT_RE.test(html)) bad('index.html: подключите общий скрипт <script src="../../shared/game-kit.js" defer></script>');
    for (const f of files.filter(f => /\.(html|css|js|mjs|svg)$/i.test(f))) {
      const text = f === 'index.html' ? html : await readFile(path.join(GAMES, id, f), 'utf8');
      const line = text.split('\n').findIndex(l => ABSOLUTE_URL_RE.test(l));
      if (line >= 0) bad(`${f}:${line + 1}: путь начинается с «/» — на GitHub Pages он не откроется, используйте относительный (например, ./img.png)`);
    }

    games.push({
      id,
      title: String(meta.title ?? '').trim(),
      description: String(meta.description ?? '').trim(),
      tags: Array.isArray(meta.tags) ? meta.tags.map(t => String(t).trim()) : [],
      icon: hasIcon ? icon : null,
      files,
    });
  }
  if (!games.length && !problems.length) problems.push('games/: нет ни одной игры');
  if (problems.length) throw new BuildError(problems);
  return games.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

function cardHTML(g) {
  const hue = [...g.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const icon = g.icon
    ? `<img class="card-icon" src="games/${g.id}/${esc(g.icon)}" alt="" width="72" height="72" loading="lazy" decoding="async">`
    : `<span class="card-icon card-icon--letter" style="--hue:${hue}" aria-hidden="true">${esc([...g.title][0].toUpperCase())}</span>`;
  const tags = g.tags.length ? `<span class="card-tags">${g.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : '';
  return `<li><a class="card" href="games/${g.id}/">${icon}<span class="card-body"><span class="card-title">${esc(g.title)}</span><span class="card-desc">${esc(g.description)}</span>${tags}</span></a></li>`;
}

function renderCatalog(template, games) {
  const built = new Date();
  const sha = (process.env.GITHUB_SHA || '').slice(0, 7);
  const vars = {
    GAMES: games.map(cardHTML).join('\n      '),
    COUNT: `${games.length} ${plural(games.length, 'игра', 'игры', 'игр')}`,
    BUILT_ISO: built.toISOString(),
    BUILT: built.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    COMMIT: sha ? ` · <code>${sha}</code>` : '',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export async function build({ outDir = DIST, quiet = false } = {}) {
  const games = await loadGames();
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await cp(SITE, outDir, { recursive: true });
  await writeFile(path.join(outDir, 'index.html'), renderCatalog(await readFile(path.join(SITE, 'index.html'), 'utf8'), games));
  for (const g of games) {
    for (const f of g.files) {
      await mkdir(path.dirname(path.join(outDir, 'games', g.id, f)), { recursive: true });
      await cp(path.join(GAMES, g.id, f), path.join(outDir, 'games', g.id, f));
    }
  }

  // Precache list: pages are cached under their folder URL, the one people actually open
  const files = (await walk(outDir)).filter(f => f !== 'sw.js');
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(await readFile(path.join(outDir, f)));
  const urls = files.map(f => (f === 'index.html' ? './' : f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f));
  const sw = (await readFile(path.join(SITE, 'sw.js'), 'utf8'))
    .replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
    .replace('__FILES__', JSON.stringify(urls, null, 2));
  await writeFile(path.join(outDir, 'sw.js'), sw);

  if (!quiet) console.log(`Собрано в ${path.relative(ROOT, outDir) || '.'}/: ${games.length} ${plural(games.length, 'игра', 'игры', 'игр')} (${games.map(g => g.id).join(', ')})`);
  return games;
}

// Cheap fingerprint of the sources, so the dev server rebuilds only after something changed
export async function sourceSignature() {
  const parts = [];
  for (const dir of [SITE, GAMES]) {
    for (const f of await walk(dir)) {
      const s = await stat(path.join(dir, f));
      parts.push(`${dir}/${f}:${s.size}:${s.mtimeMs}`);
    }
  }
  return parts.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(e => {
    console.error(e instanceof BuildError ? e.message : e);
    process.exit(1);
  });
}
