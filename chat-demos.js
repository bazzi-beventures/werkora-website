/*
 * Animierte Chat-Demos für werkora.ch (Startseite)
 *
 * Spielt die Nachbildungen des Rapport-Chats, des Hilfe-Assistenten, des
 * Kennzahlen-Assistenten und des Mail AI Agents als Schleife ab —
 * Nachrichten erscheinen nacheinander, Antworten werden Wort
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
    '.wk-cd-caret::after{content:"";display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:#3D5A80;animation:wkCdBlink 800ms infinite}',
    '@keyframes wkCdGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
    '.wk-cd-grow{transform-box:fill-box;transform-origin:bottom;animation:wkCdGrow 700ms cubic-bezier(0.16,1,0.3,1) both}',
    '.wk-kpi-chip{transition:background 250ms,color 250ms,transform 250ms,border-color 250ms}',
    '.wk-kpi-chip.wk-cd-aktiv{background:#3D5A80 !important;border-color:#3D5A80 !important;color:#FFFFFF !important;transform:scale(1.03)}',
    '#wk-kpi-push.wk-cd-zeigen{opacity:1 !important;transform:none !important}',
    '#wk-mail-push.wk-cd-zeigen{opacity:1 !important;transform:none !important}',
    '.wk-mail-item{transition:border-color 300ms,background 300ms}',
    '.wk-mail-item.wk-cd-offen{border-color:#9DB2C6 !important;background:#F6F8FB !important}',
    '.wk-mail-senden{transition:background 250ms,transform 250ms}',
    '.wk-mail-senden.wk-cd-aktiv{background:#15803D !important;transform:scale(0.96)}'
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

  /* ---------- Kennzahlen-Assistent (Sektion "Kennzahlen-Assistent") ----------
   *
   * Ablauf: Montags-Push → Wochenanalyse → Vorschlagsfrage wird angetippt →
   * Antwort läuft ein, das Diagramm wächst, die Reiter-Knöpfe erscheinen →
   * zweite Frage mit Liste der überfälligen Rechnungen. Die statische
   * Nachbildung im HTML (Analyse, Vorschläge, Frage 1, Antwort 1) dient als
   * Vorlage; Frage und Antwort 2 entstehen hier. Alles Beispieldaten.
   */

  var KPI_RECHNUNGEN = [
    ['Muster Immobilien AG', 'RE-2026-212', 'CHF 12’400', '48 Tage'],
    ['Familie Keller, Seuzach', 'RE-2026-219', 'CHF 8’950', '41 Tage'],
    ['Wohnbau Seen AG', 'RE-2026-231', 'CHF 6’720', '33 Tage']
  ];

  function kpiKnopf(text) {
    var k = document.createElement('span');
    k.style.cssText = 'font-size:11.5px;font-weight:600;color:#A9711A;background:#FDF3DF;border-radius:8px;padding:3px 8px';
    k.textContent = text;
    return k;
  }

  function kpiRechnungsliste() {
    var box = document.createElement('div');
    box.style.cssText = 'margin-top:6px';
    KPI_RECHNUNGEN.forEach(function (r, i) {
      var zeile = document.createElement('div');
      zeile.style.cssText = 'display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12.5px' +
        (i ? ';border-top:1px dashed #DCE0E6' : '');
      function spalte(stil, oben, obenStil, unten, untenStil) {
        var s = document.createElement('div');
        s.style.cssText = stil;
        var a = document.createElement('div');
        a.style.cssText = obenStil;
        a.textContent = oben;
        var b = document.createElement('div');
        b.style.cssText = untenStil;
        b.textContent = unten;
        s.appendChild(a);
        s.appendChild(b);
        return s;
      }
      zeile.appendChild(spalte('min-width:0', r[0], '', r[1], 'font-family:\'DM Mono\',monospace;font-size:11px;color:#8A929E'));
      zeile.appendChild(spalte('text-align:right;flex:none', r[2], 'font-weight:600;color:#12161D', r[3], 'font-size:11px;color:#B42318'));
      zeile.classList.add('wk-cd-in');
      box.appendChild(zeile);
    });
    return box;
  }

  async function einstreamen(ziel, text) {
    ziel.textContent = '';
    ziel.classList.add('wk-cd-caret');
    var woerter = text.split(' ');
    for (var w = 0; w < woerter.length; w++) {
      ziel.textContent += (w ? ' ' : '') + woerter[w];
      await warten(34);
    }
    ziel.classList.remove('wk-cd-caret');
  }

  function kpiStart() {
    var karte = document.getElementById('wk-kpi');
    var thread = document.getElementById('wk-kpi-thread');
    var push = document.getElementById('wk-kpi-push');
    if (!karte || !thread || !push || thread.children.length < 4) return false;
    stilSicherstellen();

    var vorlagen = [].slice.call(thread.children).map(function (n) { return n.cloneNode(true); });
    var analyse = vorlagen[0], vorschlaege = vorlagen[1], frage1 = vorlagen[2], antwort1 = vorlagen[3];
    var antwortText = (antwort1.querySelector('.wk-kpi-text') || {}).textContent || '';
    var wennSichtbar = sichtbarkeit(karte);

    (async function schleife() {
      for (;;) {
        if (!thread.isConnected) { anlauf(kpiStart); return; }
        await wennSichtbar();
        await warten(900);
        thread.classList.add('wk-cd-fade');
        await warten(400);
        thread.innerHTML = '';
        thread.classList.remove('wk-cd-fade');

        // Montag 08:00: die Push kommt rein
        push.classList.add('wk-cd-zeigen');
        await warten(2600);
        push.classList.remove('wk-cd-zeigen');
        await warten(500);

        var tipp = einblenden(thread, tippBubble());
        await wennSichtbar(); await warten(1000);
        tipp.remove();
        einblenden(thread, analyse.cloneNode(true));
        await warten(1800);

        var chips = einblenden(thread, vorschlaege.cloneNode(true));
        await warten(1500);
        var chip = chips.querySelector('.wk-kpi-chip');
        if (chip) chip.classList.add('wk-cd-aktiv');
        await warten(650);
        chips.classList.add('wk-cd-fade');
        await warten(380);
        chips.remove();

        einblenden(thread, frage1.cloneNode(true));
        await warten(600);
        tipp = einblenden(thread, tippBubble());
        await wennSichtbar(); await warten(1400);
        tipp.remove();

        // Antwort 1: Text einstreamen, dann Diagramm wachsen lassen
        var a1 = antwort1.cloneNode(true);
        var text = a1.querySelector('.wk-kpi-text');
        var diagramm = a1.querySelector('.wk-kpi-chart');
        var knoepfe = a1.querySelector('.wk-kpi-knoepfe');
        if (diagramm) diagramm.style.display = 'none';
        if (knoepfe) knoepfe.style.display = 'none';
        einblenden(thread, a1);
        if (text) await einstreamen(text, antwortText);
        await warten(250);
        if (diagramm) {
          [].slice.call(diagramm.querySelectorAll('.wk-kpi-bar')).forEach(function (bar, i) {
            bar.style.animationDelay = (Math.floor(i / 2) * 90) + 'ms';
            bar.classList.add('wk-cd-grow');
          });
          diagramm.style.display = '';
          diagramm.classList.add('wk-cd-in');
        }
        await warten(1000);
        if (knoepfe) { knoepfe.style.display = ''; knoepfe.classList.add('wk-cd-in'); }
        await warten(3600);

        // Frage 2: überfällige Rechnungen
        await wennSichtbar();
        einblenden(thread, frageBubble('Welche Rechnungen sind überfällig?'));
        await warten(600);
        tipp = einblenden(thread, tippBubble());
        await warten(1200);
        tipp.remove();
        var a2 = einblenden(thread, antwortBubble());
        a2.style.alignSelf = 'stretch';
        a2.style.maxWidth = 'none';
        var t2 = document.createElement('div');
        a2.appendChild(t2);
        await einstreamen(t2, '5 Rechnungen sind überfällig, zusammen CHF 41’860. Die drei ältesten:');
        a2.appendChild(kpiRechnungsliste());
        await warten(700);
        var reihe = document.createElement('div');
        reihe.style.cssText = 'display:flex;gap:6px;margin-top:8px';
        reihe.appendChild(kpiKnopf('Rechnungen →'));
        reihe.classList.add('wk-cd-in');
        a2.appendChild(reihe);
        await warten(6000);
      }
    })();
    return true;
  }

  /* ---------- Mail AI Agent (Sektion "Mail AI Agent") ----------
   *
   * Ablauf: Drei Mails treffen nacheinander ein, der Agent liest jede (bei der
   * Lieferanten-Mail den Anhang) und blendet Anliegen und Zuordnung ein →
   * Push "Antwortentwurf wartet" → die Reklamation wird geöffnet, der Entwurf
   * läuft ein → "Freigeben & senden" wird angetippt. Die statische Nachbildung
   * im HTML (drei Mails mit Ergebnis, Entwurf) dient als Vorlage.
   * Alles Beispieldaten.
   */

  function mailLeseZeile(text) {
    var z = document.createElement('div');
    z.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:8px;border-top:1px dashed #E4E7EB;font-size:11.5px;font-style:italic;color:#8A929E';
    var t = document.createElement('span');
    t.textContent = text;
    var punkte = document.createElement('span');
    punkte.className = 'wk-cd-dots';
    punkte.innerHTML = '<span></span><span></span><span></span>';
    z.appendChild(t);
    z.appendChild(punkte);
    return z;
  }

  function mailStart() {
    var karte = document.getElementById('wk-mail');
    var thread = document.getElementById('wk-mail-thread');
    var push = document.getElementById('wk-mail-push');
    if (!karte || !thread || !push) return false;
    var items = thread.querySelectorAll('.wk-mail-item');
    var entwurf = thread.querySelector('.wk-mail-entwurf');
    if (items.length < 3 || !entwurf) return false;
    stilSicherstellen();

    var mailVorlagen = [].slice.call(items).map(function (n) { return n.cloneNode(true); });
    var entwurfVorlage = entwurf.cloneNode(true);
    var absaetze = [].slice.call(entwurf.querySelectorAll('.wk-mail-text > div')).map(function (d) {
      return d.textContent.replace(/\s+/g, ' ').trim();
    });
    var wennSichtbar = sichtbarkeit(karte);

    (async function schleife() {
      for (;;) {
        if (!thread.isConnected) { anlauf(mailStart); return; }
        await wennSichtbar();
        await warten(900);
        thread.classList.add('wk-cd-fade');
        await warten(400);
        thread.innerHTML = '';
        thread.classList.remove('wk-cd-fade');
        await warten(500);

        // Die Mails treffen ein, der Agent liest und ordnet zu
        var letzte = null;
        for (var m = 0; m < mailVorlagen.length; m++) {
          await wennSichtbar();
          var mail = mailVorlagen[m].cloneNode(true);
          var ki = mail.querySelector('.wk-mail-ki');
          var lesen = null;
          if (ki) {
            ki.style.display = 'none';
            lesen = mailLeseZeile(ki.getAttribute('data-lesen') || 'liest Mail…');
            mail.appendChild(lesen);
          }
          einblenden(thread, mail);
          await warten(m === 1 ? 1700 : 1200); // der Anhang braucht etwas länger
          if (ki) {
            lesen.remove();
            ki.style.display = 'flex';
            ki.classList.add('wk-cd-in');
          }
          letzte = mail;
          await warten(1100);
        }

        // Push: Entwurf wartet auf Freigabe
        push.classList.add('wk-cd-zeigen');
        await warten(2600);
        push.classList.remove('wk-cd-zeigen');
        await warten(400);

        // Reklamation öffnen, Entwurf einstreamen
        if (letzte) letzte.classList.add('wk-cd-offen');
        await warten(500);
        var e = entwurfVorlage.cloneNode(true);
        var textBox = e.querySelector('.wk-mail-text');
        var knoepfe = e.querySelector('.wk-mail-knoepfe');
        var teile = textBox ? [].slice.call(textBox.children) : [];
        teile.forEach(function (t) { t.textContent = ''; });
        if (knoepfe) knoepfe.style.display = 'none';
        einblenden(thread, e);
        await wennSichtbar();
        for (var a = 0; a < teile.length; a++) {
          await einstreamen(teile[a], absaetze[a] || '');
        }
        await warten(300);
        if (knoepfe) { knoepfe.style.display = 'flex'; knoepfe.classList.add('wk-cd-in'); }
        await warten(2200);

        // Freigabe: "Freigeben & senden" wird angetippt
        await wennSichtbar();
        var senden = e.querySelector('.wk-mail-senden');
        if (senden) senden.classList.add('wk-cd-aktiv');
        await warten(700);
        if (knoepfe) {
          var bestaetigt = document.createElement('div');
          bestaetigt.style.cssText = 'display:flex;align-items:center;gap:7px;margin-top:11px;padding:9px 0 1px;font-size:12.5px;font-weight:600;color:#15803D';
          bestaetigt.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
          var bt = document.createElement('span');
          bt.textContent = 'Nach Freigabe gesendet · 07:51';
          bestaetigt.appendChild(bt);
          bestaetigt.classList.add('wk-cd-in');
          knoepfe.replaceWith(bestaetigt);
        }
        await warten(5200);
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
      anlauf(kpiStart);
      anlauf(mailStart);
    }, 500);
  }

  if (document.readyState === 'complete') los();
  else window.addEventListener('load', los);
})();
