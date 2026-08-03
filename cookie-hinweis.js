/*
 * Cookie-Einwilligung für werkora.ch
 *
 * Die Reichweitenmessung (Google Analytics) wird erst geladen, wenn die
 * Besucherin oder der Besucher aktiv zustimmt. Ohne Entscheidung und bei
 * Ablehnung wird kein Analyse-Skript eingebunden und kein Analyse-Cookie
 * gesetzt. Die Entscheidung wird lokal im Browser gespeichert und lässt sich
 * über den Link «Cookie-Einstellungen» im Footer jederzeit ändern.
 *
 * Läuft bewusst unabhängig vom React-Runtime in support.js, damit die Abfrage
 * auch dann erscheint, wenn das Rendering der Seite scheitert.
 */
(function () {
  'use strict';

  // Mess-ID von Google Analytics eintragen, z. B. 'G-XXXXXXXXXX'.
  // Solange sie leer ist, wird auch nach einer Zustimmung nichts geladen.
  var GA_ID = '';

  var KEY = 'wk-cookie-consent';
  var JA = 'analytics';
  var NEIN = 'notwendig';
  var ALT_KEY = 'wk-cookie-hinweis'; // frühere reine Kenntnisnahme, gilt nicht als Einwilligung

  function entscheidung() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (e) {
      // localStorage kann im privaten Modus gesperrt sein — dann erneut fragen.
      return null;
    }
  }

  function merken(wert) {
    try {
      window.localStorage.setItem(KEY, wert);
      window.localStorage.removeItem(ALT_KEY);
    } catch (e) {
      /* ohne localStorage erscheint die Abfrage beim nächsten Aufruf erneut */
    }
  }

  /* ---------- Google Analytics ---------- */

  var geladen = false;

  function analyticsLaden() {
    if (geladen || !GA_ID) return;
    geladen = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;

    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  // Nach einem Widerruf die bereits gesetzten Analytics-Cookies entfernen.
  function analyticsCookiesLoeschen() {
    var namen = document.cookie.split(';').map(function (c) {
      return c.split('=')[0].trim();
    }).filter(function (n) {
      return n.indexOf('_ga') === 0 || n.indexOf('_gid') === 0 || n.indexOf('_gat') === 0;
    });
    if (!namen.length) return false;

    var host = window.location.hostname;
    var domains = ['', host, '.' + host];
    var punkt = host.indexOf('.');
    if (punkt > -1) domains.push('.' + host.slice(punkt + 1));

    namen.forEach(function (name) {
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' +
          (d ? '; domain=' + d : '');
      });
    });
    return true;
  }

  /* ---------- Abfrage ---------- */

  var CSS = [
    '.wk-cc{position:fixed;left:0;right:0;bottom:0;z-index:2000;display:flex;justify-content:center;',
    'padding:16px 16px calc(16px + env(safe-area-inset-bottom));pointer-events:none}',
    '.wk-cc-box{pointer-events:auto;width:100%;max-width:760px;display:flex;flex-wrap:wrap;align-items:center;',
    'gap:16px 24px;background:#FFFFFF;border:1px solid #E4E7EB;border-radius:18px;padding:20px 22px;',
    'box-shadow:0 18px 50px rgba(16,20,28,0.16);font-family:"DM Sans",system-ui,sans-serif;',
    'animation:wkCcUp 320ms cubic-bezier(0.16,1,0.3,1) both}',
    '.wk-cc-text{flex:1 1 320px;min-width:0;font-size:14px;line-height:1.6;color:#5A6270;margin:0}',
    '.wk-cc-text a{color:#A9711A;text-decoration:underline}',
    '.wk-cc-akt{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
    '.wk-cc-btn{flex:none;background:#E9A227;color:#1B2028;border:1px solid #E9A227;border-radius:999px;',
    'padding:13px 26px;font:600 15px/1 "DM Sans",system-ui,sans-serif;cursor:pointer}',
    '.wk-cc-btn:hover{background:#F4BC55;border-color:#F4BC55}',
    '.wk-cc-btn:active{transform:scale(0.97)}',
    '.wk-cc-btn-2{background:#FFFFFF;color:#5A6270;border-color:#D8DCE2}',
    '.wk-cc-btn-2:hover{background:#F1F3F6;border-color:#C6CBD3;color:#1B2028}',
    '.wk-cc-btn:focus-visible{outline:2px solid #1B2028;outline-offset:2px}',
    '@keyframes wkCcUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
    '@media (max-width:760px){',
    '.wk-cc{padding:12px 12px calc(12px + env(safe-area-inset-bottom))}',
    '.wk-cc-box{padding:18px;gap:14px}',
    '.wk-cc-akt{flex:1 1 100%;gap:8px}',
    '.wk-cc-btn{flex:1 1 0;padding:14px 12px}}',
    '@media (prefers-reduced-motion:reduce){.wk-cc-box{animation:none}}'
  ].join('');

  var offen = null;

  function stilEinbinden() {
    if (document.getElementById('wk-cc-style')) return;
    var style = document.createElement('style');
    style.id = 'wk-cc-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function zeigen(fokussieren) {
    if (offen) return;
    stilEinbinden();

    var wrap = document.createElement('div');
    wrap.className = 'wk-cc';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie-Einstellungen');

    var box = document.createElement('div');
    box.className = 'wk-cc-box';

    var text = document.createElement('p');
    text.className = 'wk-cc-text';
    text.innerHTML = 'Wir verwenden technisch notwendige Cookies für den Betrieb der ' +
      'Seite. Für die Reichweitenmessung mit Google Analytics brauchen wir Ihre ' +
      'Einwilligung — Sie können sie jederzeit widerrufen. Mehr dazu in der ' +
      '<a href="./datenschutz.html">Datenschutzerklärung</a>.';

    var akt = document.createElement('div');
    akt.className = 'wk-cc-akt';

    var nein = knopf('Ablehnen', 'wk-cc-btn wk-cc-btn-2', function () {
      merken(NEIN);
      schliessen();
      // War Analytics in dieser Sitzung bereits aktiv, Cookies entfernen und neu laden.
      if (analyticsCookiesLoeschen() || geladen) window.location.reload();
    });

    var ja = knopf('Akzeptieren', 'wk-cc-btn', function () {
      merken(JA);
      schliessen();
      analyticsLaden();
    });

    akt.appendChild(nein);
    akt.appendChild(ja);
    box.appendChild(text);
    box.appendChild(akt);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    offen = wrap;

    if (fokussieren) ja.focus();
  }

  function knopf(beschriftung, klasse, aktion) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = klasse;
    b.textContent = beschriftung;
    b.addEventListener('click', aktion);
    return b;
  }

  function schliessen() {
    if (!offen) return;
    offen.remove();
    offen = null;
  }

  /* ---------- Start ---------- */

  // Link «Cookie-Einstellungen» im Footer — delegiert, damit er auch nach einem
  // erneuten Rendern der Seite funktioniert.
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href$="#cookie-einstellungen"]') : null;
    if (!a) return;
    ev.preventDefault();
    zeigen(true);
  });

  var gewaehlt = entscheidung();
  if (gewaehlt === JA) {
    analyticsLaden();
  } else if (gewaehlt !== NEIN) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { zeigen(false); });
    } else {
      zeigen(false);
    }
  }
})();
