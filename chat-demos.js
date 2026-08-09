/*
 * Animierte Chat-Demos für werkora.ch (Startseite)
 *
 * Spielt die Nachbildungen des Rapport-Chats und des Hilfe-Assistenten als
 * Schleife ab — Nachrichten erscheinen nacheinander, Antworten werden Wort
 * für Wort "gestreamt". Es wird nichts an einen Server geschickt; alle
 * Inhalte sind Beispieldaten aus dem HTML bzw. diesem Script.
 *
 * Läuft unabhängig vom React-Runtime in support.js: Das Script wartet, bis
 * die Seite fertig gerendert ist, und greift dann direkt auf das DOM zu.
 * Ohne JavaScript (oder mit prefers-reduced-motion) bleibt die statische
 * Nachbildung stehen — die Animation ist reine Zugabe.
 */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var CSS = [
    '@keyframes wkCdIn{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}',
    '@keyframes wkCdDot{0%,60%,100%{transform:none;opacity:.4}30%{transform:translateY(-3px);opacity:1}}',
    '@keyframes wkCdBlink{0%,100%{opacity:.15}50%{opacity:1}}',
    '.wk-cd-in{animation:wkCdIn 380ms cubic-bezier(0.16,1,0.3,1) both}',
    '.wk-cd-fade{transition:opacity 380ms ease;opacity:0}',
    '.wk-cd-dots{display:inline-flex;gap:4px;padding:2px 0}',
    '.wk-cd-dots span{width:6px;height:6px;border-radius:50%;background:#8A929E;animation:wkCdDot 1.1s infinite}',
    '.wk-cd-dots span:nth-child(2){animation-delay:.15s}',
    '.wk-cd-dots span:nth-child(3){animation-delay:.3s}',
    '.wk-hilfe-chip{transition:background 250ms,color 250ms,transform 250ms,border-color 250ms}',
    '.wk-hilfe-chip.wk-cd-aktiv{background:#3D5A80 !important;border-color:#3D5A80 !important;color:#FFFFFF !important;transform:scale(1.03)}',
    '.wk-cd-caret::after{content:"";display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:#3D5A80;animation:wkCdBlink 800ms infinite}'
  ].join('');

  var styleEingefuegt = false;
  function stilSicherstellen() {
    if (styleEingefuegt) return;
    styleEingefuegt = true;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function warten(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* Liefert eine Funktion, die auflöst, sobald das Element im Viewport ist.
   * So pausieren die Schleifen, solange niemand hinschaut. */
  function sichtbarkeit(el) {
    var sichtbar = false;
    var warteliste = [];
    if (!('IntersectionObserver' in window)) {
      return function () { return Promise.resolve(); };
    }
    var io = new IntersectionObserver(function (eintraege) {
      sichtbar = eintraege[0].isIntersecting;
      if (sichtbar) warteliste.splice(0).forEach(function (fn) { fn(); });
    }, { threshold: 0.3 });
    io.observe(el);
    return function () {
      return sichtbar ? Promise.resolve() : new Promise(function (r) { warteliste.push(r); });
    };
  }

  function einblenden(ziel, knoten) {
    knoten.classList.add('wk-cd-in');
    ziel.appendChild(knoten);
    return knoten;
  }

  /* Tipp-Indikator (drei hüpfende Punkte) im Stil einer Bot-Nachricht. */
  function tippBubble() {
    var b = document.createElement('div');
    b.style.cssText = 'max-width:60%;align-self:flex-start;background:#FFFFFF;border-radius:14px;border-top-left-radius:5px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,20,28,0.06)';
    b.innerHTML = '<span class="wk-cd-dots"><span></span><span></span><span></span></span>';
    return b;
  }

  /* ---------- Rapport-Chat (Sektion "KI im Einsatz") ---------- */

  function rapportStart() {
    var thread = document.getElementById('wk-rapport-thread');
    if (!thread || thread.children.length < 3) return false;
    stilSicherstellen();

    var vorlagen = [].slice.call(thread.children).map(function (n) { return n.cloneNode(true); });
    // Höhe der statischen Nachbildung festhalten, damit die Seite beim
    // Leeren und Wiederaufbauen nicht springt.
    thread.style.minHeight = thread.getBoundingClientRect().height + 'px';
    var wennSichtbar = sichtbarkeit(thread);

    (async function schleife() {
      for (;;) {
        // Falls das Runtime die Seite neu aufgebaut hat: sauber neu ansetzen.
        if (!thread.isConnected) { anlauf(rapportStart); return; }
        await wennSichtbar();
        thread.innerHTML = '';
        await warten(700);

        var tipp = einblenden(thread, tippBubble());
        await wennSichtbar(); await warten(1100);
        tipp.remove();
        einblenden(thread, vorlagen[0].cloneNode(true)); // Begrüssung
        await warten(1500);

        await wennSichtbar();
        einblenden(thread, vorlagen[1].cloneNode(true)); // Sprachnachricht
        await warten(1000);

        tipp = einblenden(thread, tippBubble());
        await wennSichtbar(); await warten(1600);
        tipp.remove();
        einblenden(thread, vorlagen[2].cloneNode(true)); // Zusammenfassung
        await warten(5200);

        thread.classList.add('wk-cd-fade');
        await warten(400);
        thread.innerHTML = '';
        thread.classList.remove('wk-cd-fade');
      }
    })();
    return true;
  }

  /* ---------- Hilfe-Assistent (Sektion "Eingebaute Hilfe") ---------- */

  var ANTWORTEN = {
    'Wie erstelle ich eine neue Offerte?':
      'Im Bereich Offerten wählen Sie «Neue Offerte», danach Kunde und Projekt. Die Positionen übernehmen die Preise aus Ihren Preisregeln; Varianten und optionale Positionen sind möglich. Beim Versand erzeugt Werkora das PDF mit Ihrem Branding.',
    'Wo sehe ich meine Ferientage?':
      'Ihr Feriensaldo steht im Bereich Absenzen: Anspruch, bezogene Tage und Restsaldo. Beantragte, noch nicht freigegebene Ferien sind separat ausgewiesen — so sehen Sie jederzeit, was noch pendent ist.',
    'Wie funktioniert die Zeitkorrektur?':
      'Sie stellen einen Antrag mit Datum, korrigierter Zeit und Begründung. Die Leitung prüft den Antrag und gibt ihn frei — erst dann wird das Zeitkonto angepasst. Den Status sehen Sie jederzeit in der Übersicht.',
    'Wie melde ich eine Abwesenheit?':
      'Im Bereich Absenzen wählen Sie Art und Zeitraum — etwa Ferien oder Krankheit — und reichen den Antrag ein. Nach der Freigabe durch die Leitung erscheint die Abwesenheit automatisch in der Einsatzplanung.'
  };

  function frageBubble(text) {
    var b = document.createElement('div');
    b.style.cssText = 'max-width:88%;align-self:flex-end;background:#3D5A80;border-radius:14px;border-top-right-radius:5px;padding:10px 13px;font-size:13px;line-height:1.55;color:#F2F6FB';
    b.textContent = text;
    return b;
  }

  function antwortBubble() {
    var b = document.createElement('div');
    b.style.cssText = 'max-width:92%;align-self:flex-start;background:#F1F3F6;border-radius:14px;border-top-left-radius:5px;padding:11px 13px;font-size:13px;line-height:1.55;color:#2A323D';
    return b;
  }

  function denktBubble() {
    var b = antwortBubble();
    b.style.fontStyle = 'italic';
    b.style.color = '#8A929E';
    b.textContent = 'denkt nach…';
    return b;
  }

  function hilfeStart() {
    var karte = document.getElementById('wk-hilfe');
    var thread = document.getElementById('wk-hilfe-thread');
    if (!karte || !thread) return false;
    stilSicherstellen();

    var intro = thread.querySelector('#wk-hilfe-intro');
    var chipsBox = thread.querySelector('#wk-hilfe-chips');
    var chips = [].slice.call(thread.querySelectorAll('.wk-hilfe-chip'));
    if (!intro || !chipsBox || !chips.length) return false;
    var wennSichtbar = sichtbarkeit(karte);
    var i = 0;

    function startzustand() {
      [].slice.call(thread.children).forEach(function (kind) {
        if (kind !== intro && kind !== chipsBox) kind.remove();
      });
      intro.style.display = '';
      chipsBox.style.display = '';
      intro.classList.add('wk-cd-in');
      chipsBox.classList.add('wk-cd-in');
      chips.forEach(function (c) { c.classList.remove('wk-cd-aktiv'); });
    }

    (async function schleife() {
      for (;;) {
        if (!thread.isConnected) { anlauf(hilfeStart); return; }
        await wennSichtbar();
        await warten(1300);

        var chip = chips[i % chips.length];
        var frage = chip.textContent.trim();
        var antwort = ANTWORTEN[frage] || '';
        i++;

        // Chip "anklicken", dann Intro und Chips ausblenden
        chip.classList.add('wk-cd-aktiv');
        await warten(650);
        intro.classList.add('wk-cd-fade');
        chipsBox.classList.add('wk-cd-fade');
        await warten(380);
        intro.style.display = 'none';
        chipsBox.style.display = 'none';
        intro.classList.remove('wk-cd-fade', 'wk-cd-in');
        chipsBox.classList.remove('wk-cd-fade', 'wk-cd-in');

        einblenden(thread, frageBubble(frage));
        await warten(700);

        var denkt = einblenden(thread, denktBubble());
        await wennSichtbar(); await warten(1600);
        denkt.remove();

        // Antwort Wort für Wort einstreamen
        var bubble = einblenden(thread, antwortBubble());
        var textSpan = document.createElement('span');
        textSpan.className = 'wk-cd-caret';
        bubble.appendChild(textSpan);
        var woerter = antwort.split(' ');
        for (var w = 0; w < woerter.length; w++) {
          textSpan.textContent += (w ? ' ' : '') + woerter[w];
          await warten(36);
        }
        textSpan.classList.remove('wk-cd-caret');
        await warten(4800);

        await wennSichtbar();
        thread.classList.add('wk-cd-fade');
        await warten(400);
        startzustand();
        thread.classList.remove('wk-cd-fade');
      }
    })();
    return true;
  }

  /* ---------- Start, sobald das Runtime fertig gerendert hat ---------- */

  function anlauf(startFn) {
    var versuche = 0;
    (function pruefen() {
      if (startFn()) return;
      if (++versuche > 100) return; // nach ~10 s aufgeben (Element existiert nicht)
      setTimeout(pruefen, 100);
    })();
  }

  function los() {
    // Kurze Schonfrist: support.js rendert nach DOMContentLoaded und kann die
    // Seite direkt danach noch einmal neu aufbauen.
    setTimeout(function () {
      anlauf(rapportStart);
      anlauf(hilfeStart);
    }, 500);
  }

  if (document.readyState === 'complete') los();
  else window.addEventListener('load', los);
})();
