// Shared by every game: <script src="../../shared/game-kit.js" defer></script>
// - adds a "back to all games" button unless the page already has its own element with data-home
//   (put it in the HTML or render it before the page finishes loading);
//   pick a corner with data-home-position="top-left|top-right|bottom-left|bottom-right" on this script tag;
// - registers the offline service worker, so a game opened by a direct link also works offline later;
// - turns off double-tap zoom, which otherwise fires on quick repeated taps on iPhone and iPad.
(() => {
  const script = document.currentScript;
  const root = new URL('../', script.src);

  const style = document.createElement('style');
  style.textContent = `
:where(html){touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}
.gk-home{position:fixed;z-index:2147483000;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;
  background:rgba(24,24,32,.62);color:#fff;text-decoration:none;box-shadow:0 2px 12px rgba(0,0,0,.25);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);-webkit-tap-highlight-color:transparent}
.gk-home:focus-visible{outline:2px solid #fff;outline-offset:2px}
.gk-home svg{width:22px;height:22px}
.gk-top-left,.gk-top-right{top:calc(env(safe-area-inset-top,0px) + 10px)}
.gk-bottom-left,.gk-bottom-right{bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}
.gk-top-left,.gk-bottom-left{left:calc(env(safe-area-inset-left,0px) + 10px)}
.gk-top-right,.gk-bottom-right{right:calc(env(safe-area-inset-right,0px) + 10px)}
@media print{.gk-home{display:none}}`;
  document.head.appendChild(style);

  function addHomeButton() {
    if (document.querySelector('[data-home]')) return;
    const corner = script.dataset.homePosition || 'top-left';
    const a = document.createElement('a');
    a.href = root.href;
    a.className = 'gk-home gk-' + corner;
    a.dataset.home = '';
    a.title = 'Все игры';
    a.setAttribute('aria-label', 'Все игры');
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addHomeButton);
  else addHomeButton();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname }).catch(() => {});
  }
})();
