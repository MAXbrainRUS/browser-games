// Catalog page: offline support, the "add to Home Screen" hint and the local build time
(() => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  const built = document.getElementById('built');
  const date = new Date(built.dateTime);
  if (!isNaN(date)) built.textContent = date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Install hint: iPhone and iPad need the Share menu, Chrome and Edge offer a real install prompt
  const HIDE_KEY = 'catalog.install-hint-hidden';
  const box = document.getElementById('install');
  const text = document.getElementById('install-text');
  const go = document.getElementById('install-go');
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  let hidden = false;
  try { hidden = localStorage.getItem(HIDE_KEY) === '1'; } catch {}
  if (standalone || hidden) return;

  const SHARE = '<svg class="share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  if (ios) {
    text.innerHTML = 'Чтобы открывать игры как приложение, нажмите ' + SHARE + ' «Поделиться», затем «На экран „Домой“».';
    box.hidden = false;
  }
  let prompt = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    prompt = e;
    text.textContent = 'Игротеку можно установить как приложение.';
    go.hidden = false;
    box.hidden = false;
  });
  go.addEventListener('click', async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    prompt = null;
    box.hidden = true;
  });
  document.getElementById('install-close').addEventListener('click', () => {
    box.hidden = true;
    try { localStorage.setItem(HIDE_KEY, '1'); } catch {}
  });
})();
