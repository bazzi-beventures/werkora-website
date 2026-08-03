/*
 * Cookie-Hinweis für werkora.ch
 *
 * Der Hinweis informiert über den Einsatz von Cookies (technisch notwendige
 * Speicherung sowie Reichweitenmessung, siehe Datenschutzerklärung). Die
 * Bestätigung wird lokal im Browser gespeichert, damit der Hinweis nicht bei
 * jedem Aufruf erscheint.
 *
 * Läuft bewusst unabhängig vom React-Runtime in support.js, damit der Hinweis
 * auch dann erscheint, wenn das Rendering der Seite scheitert.
 */
(function () {
  'use strict';

  var KEY = 'wk-cookie-hinweis';

  function gespeichert() {
    try {
      return window.localStorage.getItem(KEY) === 'ok';
    } catch (e) {
      // localStorage kann im privaten Modus gesperrt sein — dann Hinweis zeigen.
      return false;
    }
  }

  function merken() {
    try {
      window.localStorage.setItem(KEY, 'ok');
    } catch (e) {
      /* ohne localStorage erscheint der Hinweis beim nächsten Aufruf erneut */
    }
  }

  var CSS = [
    '.wk-cc{position:fixed;left:0;right:0;bottom:0;z-index:2000;display:flex;justify-content:center;',
    'padding:16px 16px calc(16px + env(safe-area-inset-bottom));pointer-events:none}',
    '.wk-cc-box{pointer-events:auto;width:100%;max-width:760px;display:flex;flex-wrap:wrap;align-items:center;',
    'gap:16px 24px;background:#FFFFFF;border:1px solid #E4E7EB;border-radius:18px;padding:20px 22px;',
    'box-shadow:0 18px 50px rgba(16,20,28,0.16);font-family:"DM Sans",system-ui,sans-serif;',
    'animation:wkCcUp 320ms cubic-bezier(0.16,1,0.3,1) both}',
    '.wk-cc-text{flex:1 1 320px;min-width:0;font-size:14px;line-height:1.6;color:#5A6270;margin:0}',
    '.wk-cc-text a{color:#A9711A;text-decoration:underline}',
    '.wk-cc-btn{flex:none;background:#E9A227;color:#1B2028;border:none;border-radius:999px;',
    'padding:13px 26px;font:600 15px/1 "DM Sans",system-ui,sans-serif;cursor:pointer}',
    '.wk-cc-btn:hover{background:#F4BC55}',
    '.wk-cc-btn:active{transform:scale(0.97)}',
    '@keyframes wkCcUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
    '@media (max-width:760px){',
    '.wk-cc{padding:12px 12px calc(12px + env(safe-area-inset-bottom))}',
    '.wk-cc-box{padding:18px;gap:14px}',
    '.wk-cc-btn{flex:1 1 100%;padding:14px 20px}}',
    '@media (prefers-reduced-motion:reduce){.wk-cc-box{animation:none}}'
  ].join('');

  function zeigen() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'wk-cc';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Hinweis zu Cookies');

    var box = document.createElement('div');
    box.className = 'wk-cc-box';

    var text = document.createElement('p');
    text.className = 'wk-cc-text';
    text.innerHTML = 'Diese Website verwendet Cookies für den Betrieb der Seite und ' +
      'zur Reichweitenmessung. Mehr dazu in der ' +
      '<a href="./datenschutz.html">Datenschutzerklärung</a>.';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wk-cc-btn';
    btn.textContent = 'Verstanden';
    btn.addEventListener('click', function () {
      merken();
      wrap.remove();
    });

    box.appendChild(text);
    box.appendChild(btn);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  }

  if (gespeichert()) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', zeigen);
  } else {
    zeigen();
  }
})();
