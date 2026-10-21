#!/usr/bin/env node
// Local preview: `npm run dev`. Rebuilds dist/ whenever games/ or site/ change and serves it
// under /browser-games/, the same sub-path GitHub Pages uses, so root-absolute links fail here too.
// The printed Wi-Fi address opens the site on a phone or tablet in the same network.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { build, BuildError, DIST, sourceSignature } from './build.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const PORT = Number(opt('--port') || process.env.PORT || 8080);
const QUIET = args.includes('--quiet');
const BASE = '/browser-games/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

let signature = null;
let failure = null;
let pending = Promise.resolve();

// Builds are queued so concurrent requests never see a half-written dist/
function ensureBuilt() {
  pending = pending.then(async () => {
    const sig = await sourceSignature();
    if (sig === signature) return;
    signature = sig;
    try {
      await build({ quiet: QUIET });
      failure = null;
    } catch (e) {
      failure = e;
      console.error(e instanceof BuildError ? e.message : e);
    }
  });
  return pending;
}

const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { Location: BASE });
    return res.end();
  }
  await ensureBuilt();
  if (failure) {
    const text = failure instanceof BuildError ? failure.message : String(failure.stack || failure);
    return send(res, 500, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ошибка сборки</title><body style="font:15px/1.5 system-ui;padding:16px"><h1>Ошибка сборки</h1><pre style="white-space:pre-wrap">${esc(text)}</pre><p>Исправьте и обновите страницу.</p>`);
  }

  let rel;
  try { rel = decodeURIComponent(url.pathname.slice(BASE.length)); } catch { return send(res, 400, 'Bad request', 'text/plain'); }
  let file = path.join(DIST, rel);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { Location: url.pathname + '/' + url.search });
      return res.end();
    }
    file = path.join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) return send(res, 404, `<!doctype html><meta charset="utf-8"><title>Не найдено</title><p style="font:15px system-ui;padding:16px">Нет такой страницы. <a href="${BASE}">К каталогу</a></p>`);

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Порт ${PORT} занят. Запустите с другим: npm run dev -- --port 8081` : e);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', async () => {
  await ensureBuilt();
  if (QUIET) return;
  const lan = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`\nКаталог:  http://localhost:${PORT}${BASE}`);
  for (const ip of lan) console.log(`С телефона в той же Wi-Fi сети:  http://${ip}:${PORT}${BASE}`);
  console.log('Изменения в games/ и site/ подхватываются при обновлении страницы. Остановить: Ctrl+C\n');
});
