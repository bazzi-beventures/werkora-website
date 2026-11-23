#!/usr/bin/env python3
"""Baut die Seiten agb.html und avv.html aus den versionierten PDFs unter rechtliches/.

Gebrauch (im Wurzelverzeichnis der Website):
    python3 tools/rechtstexte.py            # beide Seiten neu bauen
    python3 tools/rechtstexte.py --pruefen  # nur prüfen, ob die Seiten aktuell sind

Welche Fassungen es gibt, steht in rechtliches/versionen.json. Die jeweils erste
Fassung in der Liste ist die aktuelle: Ihr Wortlaut wird aus dem PDF gelesen und als
HTML gesetzt, alle Fassungen erscheinen im Versionsverzeichnis der Seite. Ablauf für
eine neue Fassung: siehe rechtliches/README.md. Benötigt pdfplumber.

Die Erkennung stützt sich auf das Layout der Vorlagen (Schriftschnitt und -grösse,
Einzug, Zeilenabstand). Ändert sich die Vorlage stark, das Ergebnis gegen das PDF
prüfen: Der Wortlaut darf sich nicht verändern.
"""
import hashlib
import html
import json
import os
import re
import sys
from datetime import date

import pdfplumber

ITALIC_BULLETS = ("•", "")
# Titel der drei Teile der AGB in gemischter Schreibweise (im PDF in Versalien)
TEILE = {
    "A": "Allgemeine Bestimmungen",
    "B": "Besondere Bestimmungen für SaaS-Services",
    "C": "Besondere Bestimmungen für die Erbringung von Dienstleistungen",
}
KLEIN = {"und", "von", "der", "die", "in", "zur", "zum", "für", "betroffenen", "regelmässigen"}


def gemischt(text):
    """Überschrift in Versalien in gemischte Schreibweise bringen (nur Gross-/Kleinschreibung)."""
    if not text.isupper():
        return text
    words = []
    for n, w in enumerate(text.lower().split(" ")):
        if n > 0 and w.strip(",") in KLEIN:
            words.append(w)
        else:
            words.append("-".join(p[:1].upper() + p[1:] for p in w.split("-")))
    return " ".join(words)


ROMAN = re.compile(r"^\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s+")


def slug(text):
    s = text.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def style_of(char):
    name = char["fontname"].split("+")[-1]
    if "Bold" in name:
        return "b"
    if "Italic" in name:
        return "i"
    return ""


def line_html(line):
    """Zeile als HTML, kursive und fette Abschnitte bleiben erhalten."""
    out, cur, buf = [], None, []
    chars = line["chars"]
    # pdfplumber liefert Leerzeichen nicht immer als Zeichen: aus Abständen rekonstruieren
    text_chars = []
    prev = None
    for c in chars:
        if prev is not None and c["x0"] - prev["x1"] > c["size"] * 0.18 and c["text"] != " " and prev["text"] != " ":
            text_chars.append({"text": " ", "st": style_of(prev) if style_of(prev) == style_of(c) else ""})
        text_chars.append({"text": c["text"], "st": style_of(c)})
        prev = c

    def flush():
        if not buf:
            return
        t = html.escape("".join(buf), quote=False)
        if cur == "b":
            out.append(f"<strong>{t}</strong>")
        elif cur == "i":
            out.append(f"<em>{t}</em>")
        else:
            out.append(t)

    for tc in text_chars:
        st = tc["st"]
        if tc["text"] == " " and cur is not None:
            st = cur  # Leerzeichen dem laufenden Abschnitt zuschlagen
        if st != cur:
            flush()
            buf, cur = [], st
        buf.append(tc["text"])
    flush()
    s = "".join(out)
    s = re.sub(r"[  ]{2,}", " ", s).strip()
    s = s.replace("</strong> <strong>", " ").replace("</em> <em>", " ")
    return s


def plain(line):
    return re.sub(r"\s+", " ", line["text"]).strip()


def join(parts):
    """Zeilen zu einem Absatz verbinden; Trennstriche am Zeilenende bleiben stehen."""
    s = ""
    for p in parts:
        if not s:
            s = p
        elif re.search(r"[-‑]‍?(</(strong|em)>)?$", s) and not re.search(r"\s[-–]$", s):
            s += p
        else:
            s += " " + p
    return s


def collect_lines(pdf, kind):
    lines = []
    for pi, page in enumerate(pdf.pages):
        for l in page.extract_text_lines(return_chars=True):
            t = plain(l)
            if not t:
                continue
            if l["top"] < 45 or l["top"] > 780:
                continue  # Kopf- und Fusszeilen
            if t == "Werkora.ch" and l["top"] < 60:
                continue
            size = round(max(c["size"] for c in l["chars"]))
            fonts = {style_of(c) for c in l["chars"] if c["text"].strip()}
            lines.append({
                "page": pi, "x0": round(l["x0"], 1), "x1": round(l["x1"], 1),
                "top": l["top"], "bottom": l["bottom"], "size": size, "fonts": fonts,
                "text": t, "html": line_html(l), "raw": l,
            })
    return lines


def convert(kind, path):
    pdf = pdfplumber.open(path)
    lines = collect_lines(pdf, kind)
    body_size = 9
    out = []
    toc = []
    para = []          # Zeilen des laufenden Absatzes
    list_items = None  # (tag, [items]) einer laufenden Aufzählung
    item = None
    prev = None
    in_table = False

    def close_para():
        nonlocal para
        if para:
            out.append("<p>" + join(para) + "</p>")
            para = []

    def close_item():
        nonlocal item
        if item is not None:
            list_items[1].append(join(item))
            item = None

    def close_list():
        nonlocal list_items
        close_item()
        if list_items:
            tag, items = list_items
            cls = ' class="roman"' if tag == "ol" else ""
            out.append(f"<{tag}{cls}>" + "".join(f"<li>{i}</li>" for i in items) + f"</{tag}>")
            list_items = None

    def close_all():
        close_para()
        close_list()

    i = 0
    while i < len(lines):
        l = lines[i]
        t = l["text"]

        if t.replace(" ", "") == "*****":  # Schlusszeichen der AGB
            prev = l
            i += 1
            continue

        # Anhänge der AVV: "Anhang N zur" / "Auftragsverarbeitungsvereinbarung" / Untertitel
        if kind == "avv" and l["size"] >= 20 and t.startswith("Anhang"):
            close_all()
            num = re.match(r"Anhang (\d+)", t).group(1)
            sub = []
            j = i + 1
            while j < len(lines) and lines[j]["size"] >= 12:
                if lines[j]["size"] < 20:
                    sub.append(lines[j]["text"])
                j += 1
            title = f"Anhang {num} zur Auftragsverarbeitungsvereinbarung"
            aid = f"anhang-{num}"
            toc.append((aid, f"Anhang {num}", " ".join(sub), 1))
            out.append(f'<h2 class="annex" id="{aid}"><span>Anhang {num}</span> zur Auftrags&shy;verarbeitungs&shy;vereinbarung</h2>')
            if sub:
                out.append('<p class="annex-sub">' + html.escape(" ".join(sub)) + "</p>")
            in_table = num == "3"
            prev = lines[j - 1]
            i = j
            continue

        # Titelblock (grosse Schrift) wird im Seitenkopf gesetzt, nicht im Fragment
        if l["size"] >= 16:
            prev = l
            i += 1
            continue

        # Tabelle der Unterauftragsverarbeiter wird von Hand gesetzt
        if in_table and (l["fonts"] == {"b"} or l["size"] >= 10 and not t.startswith("Zum Zweck")):
            close_all()
            out.append("<!-- TABELLE-UNTERAUFTRAGSVERARBEITER -->")
            break

        is_bold_line = l["fonts"] == {"b"}

        # Überschriften AGB
        if kind == "agb" and is_bold_line and l["size"] >= 10:
            close_all()
            m = re.match(r"^([A-C])\s+(.+)$", t)
            m2 = re.match(r"^([A-C]\.\d+\.)\s*(.+)$", t)
            if m2:
                hid = slug(m2.group(1))
                toc.append((hid, m2.group(1), m2.group(2), 2))
                out.append(f'<h3 id="{hid}"><span class="num">{m2.group(1)}</span> {html.escape(m2.group(2))}</h3>')
            elif m:
                hid = "teil-" + m.group(1).lower()
                title = TEILE.get(m.group(1), m.group(2))
                toc.append((hid, m.group(1), title, 1))
                out.append(f'<h2 id="{hid}"><span class="num">{m.group(1)}</span> {html.escape(title)}</h2>')
            prev = l
            i += 1
            continue

        # Überschriften AVV: "1. PRÄAMBEL ..." bzw. "15.1 Vereinbarungsinhalt"
        if kind == "avv" and is_bold_line:
            close_all()
            m = re.match(r"^(\d+)\.\s+(.+)$", t)
            m2 = re.match(r"^(\d+\.\d+)\s+(.+)$", t)
            if m2:
                hid = "ziff-" + m2.group(1).replace(".", "-")
                if not any(x[0] == hid for x in toc):
                    toc_entry = (hid, m2.group(1), gemischt(m2.group(2)), 2)
                    toc.append(toc_entry)
                out.append(f'<h3 id="{hid}"><span class="num">{m2.group(1)}</span> {html.escape(m2.group(2))}</h3>')
            elif m:
                annex = next((x[0] for x in reversed(toc) if x[0].startswith("anhang-")), None)
                hid = (annex + "-" if annex else "ziff-") + m.group(1)
                if annex is None:
                    toc.append((hid, m.group(1) + ".", gemischt(m.group(2)), 1))
                tag = "h3" if annex else "h2"
                title = gemischt(m.group(2))
                out.append(f'<{tag} id="{hid}"><span class="num">{m.group(1)}.</span> {html.escape(title)}</{tag}>')
            prev = l
            i += 1
            continue

        # Buchstaben-Unterpunkte in den Anhängen: "a) Zugangskontrolle"
        mm = re.match(r"^([a-z])\)\s+(.*)$", t)
        if kind == "avv" and mm and l["x0"] < 95:
            close_all()
            h = line_html(l["raw"])
            h = re.sub(r"^(<em>)?([a-z])\)\s*", r"\1", h)
            if re.match(r"^(<em>)?Name:", h):
                out.append(f"<p>{mm.group(1)}) {h}</p>")
                prev = l
                i += 1
                continue
            out.append(f'<h4><span class="num">{mm.group(1)})</span> {h}</h4>')
            prev = l
            i += 1
            continue

        # Gap zur vorherigen Zeile: neuer Absatz?
        new_block = True
        if prev is not None:
            if prev["page"] == l["page"]:
                gap = l["top"] - prev["bottom"]
                new_block = gap > 4.0
            else:
                new_block = prev["x1"] < 528  # letzte Zeile der Seite endete kurz
        h = l["html"]

        bullet = t[0] in ITALIC_BULLETS
        roman = ROMAN.match(t)
        if bullet or roman:
            close_para()
            close_item()
            if bullet:
                h = re.sub(r"^\s*(<[^>]+>)?[•]\s*(</[^>]+>)?\s*", "", h)
                tag = "ul"
            else:
                h = re.sub(r"^\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s*", "", h)
                tag = "ol"
            if list_items is None or list_items[0] != tag:
                close_list()
                list_items = (tag, [])
            item = [h]
            item_x0 = l["x0"]
        elif item is not None and l["x0"] > item_x0 + 3 and not new_block:
            item.append(h)
        elif item is not None and l["x0"] > item_x0 + 3 and new_block and prev["page"] != l["page"]:
            item.append(h)
        else:
            if list_items is not None:
                close_list()
            if new_block:
                close_para()
            para.append(h)
        prev = l
        i += 1

    close_all()
    return toc, "\n".join(out)


def render(kind, path):
    toc, body = convert(kind, path)
    # Sonderfälle der Silbentrennung im Original
    body = body.replace("-ver- stösse", "-verstösse").replace("-ver-stösse", "-verstösse")
    body = re.sub(r"(\s)-\u200d?\s+(?=[a-zäöü])", r"\1-", body)
    nav = ['<nav class="lx-toc" aria-label="Inhalt"><div class="lx-toc-title">Inhalt</div><ol>']
    for hid, num, title, level in toc:
        if level == 1:
            nav.append(f'<li class="l1"><a href="#{hid}"><span class="num">{html.escape(num)}</span> {html.escape(gemischt(title))}</a></li>')
        else:
            label = gemischt(title)
            nav.append(f'<li class="l2"><a href="#{hid}"><span class="num">{html.escape(num)}</span> {html.escape(label)}</a></li>')
    nav.append("</ol></nav>")
    return "\n".join(nav) + '\n<div class="lx-body">\n' + body + "\n</div>"


# ---------------------------------------------------------------------------
# Seiten bauen
# ---------------------------------------------------------------------------

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOKUMENTE = {
    "agb": {
        "seite": "agb.html",
        "titel": "Allgemeine Geschäftsbedingungen",
        "untertitel": "für Werkora.ch und weitere Dienstleistungen",
        "kurz": "AGB",
        "beschreibung": "Allgemeine Geschäftsbedingungen der Bazzi Ventures GmbH für Werkora.ch und weitere Dienstleistungen, mit allen Fassungen als PDF.",
        "einleitung": "Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung von Werkora.ch und für weitere Dienstleistungen der Bazzi Ventures GmbH. Zusammen mit der Bestellung und der <a href=\"./avv.html\">Auftragsverarbeitungsvereinbarung (AVV)</a> bilden sie den Vertrag.",
        "partner": ("avv.html", "Auftragsverarbeitungsvereinbarung (AVV)"),
    },
    "avv": {
        "seite": "avv.html",
        "titel": "Auftragsverarbeitungsvereinbarung",
        "titel_html": "Auftrags&shy;verarbeitungs&shy;vereinbarung",
        "untertitel": "(AVV) für Werkora.ch",
        "kurz": "AVV",
        "beschreibung": "Auftragsverarbeitungsvereinbarung (AVV) der Bazzi Ventures GmbH für Werkora.ch, mit allen Fassungen als PDF.",
        "einleitung": "Die Auftragsverarbeitungsvereinbarung regelt, wie die Bazzi Ventures GmbH Personendaten im Auftrag ihrer Kunden verarbeitet. Sie ist Bestandteil der <a href=\"./agb.html\">Allgemeinen Geschäftsbedingungen</a>.",
        "partner": ("agb.html", "Allgemeine Geschäftsbedingungen (AGB)"),
    },
}

MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
          "September", "Oktober", "November", "Dezember"]


def datum_lang(iso):
    d = date.fromisoformat(iso)
    return f"{d.day}. {MONATE[d.month - 1]} {d.year}"


def datum_kurz(iso):
    d = date.fromisoformat(iso)
    return f"{d.day:02d}.{d.month:02d}.{d.year}"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()


CSS = """
  .lx-meta { margin-top: 36px; border: 1px solid #E4E7EB; border-radius: 18px; padding: 22px 24px; display: flex; flex-wrap: wrap; gap: 18px 36px; align-items: center; justify-content: space-between; }
  .lx-meta dl { margin: 0; display: flex; flex-wrap: wrap; gap: 14px 36px; }
  .lx-meta dt { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #8A929E; }
  .lx-meta dd { margin: 6px 0 0; font-size: 15px; font-weight: 500; color: #12161D; }
  .lx-badge { display: inline-block; margin-left: 8px; padding: 2px 9px; border-radius: 999px; background: #FBF1DE; color: #8A5A12; font-size: 12px; font-weight: 600; vertical-align: 1px; }
  .lx-btn { display: inline-flex; align-items: center; gap: 9px; padding: 11px 18px; border-radius: 999px; background: #12161D; color: #FFFFFF !important; font-size: 14px; font-weight: 600; }
  .lx-btn:hover { background: #2A303B; }
  .lx-toc { margin-top: 40px; background: #F7F8FA; border-radius: 18px; padding: 24px 26px; }
  .lx-toc-title { font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #A9711A; }
  .lx-toc ol { list-style: none; margin: 14px 0 0; padding: 0; columns: 2; column-gap: 32px; }
  .lx-toc li { break-inside: avoid; padding: 4px 0; font-size: 14px; line-height: 1.45; }
  .lx-toc li.l1 { font-weight: 600; padding-top: 10px; }
  .lx-toc li.l1:first-child { padding-top: 4px; }
  .lx-toc a { color: #3E4552; }
  .lx-toc a:hover { color: #A9711A; }
  .lx-toc .num { font-family: 'DM Mono', monospace; font-size: 12px; color: #A9711A; margin-right: 6px; }
  .lx-body { margin-top: 24px; }
  .lx-body h2, .lx-body h3, .lx-body h4 { scroll-margin-top: 100px; overflow-wrap: break-word; }
  .lx-body p, .lx-body li, .lx-table td { overflow-wrap: break-word; }
  .lx-body h2 { font-family: 'Bitter', serif; margin: 52px 0 0; padding-top: 26px; border-top: 1px solid #E4E7EB; font-size: 22px; line-height: 1.3; font-weight: 600; color: #12161D; }
  .lx-body h2.annex { margin-top: 72px; border-top: 2px solid #12161D; font-size: 24px; }
  .lx-body h2.annex span { display: block; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #A9711A; margin-bottom: 8px; font-weight: 500; }
  .lx-body .annex-sub { font-family: 'Bitter', serif; font-size: 18px; color: #3E4552; margin-top: 8px; }
  .lx-body h3 { font-family: 'Bitter', serif; margin: 34px 0 0; font-size: 18px; line-height: 1.35; font-weight: 600; color: #12161D; }
  .lx-body h4 { margin: 24px 0 0; font-size: 15.5px; line-height: 1.5; font-weight: 600; color: #12161D; }
  .lx-body h4 em { font-style: normal; }
  .lx-body .num { font-family: 'DM Mono', monospace; font-weight: 500; color: #A9711A; margin-right: 4px; }
  .lx-body h2 .num { font-size: 0.8em; }
  .lx-body p, .lx-body li { font-size: 15.5px; line-height: 1.75; color: #3E4552; }
  .lx-body p { margin: 12px 0 0; }
  .lx-body strong { font-weight: 600; color: #12161D; }
  .lx-body ul, .lx-body ol { margin: 12px 0 0; padding-left: 24px; }
  .lx-body li + li { margin-top: 6px; }
  .lx-body ol.roman { list-style: none; counter-reset: rz; padding-left: 40px; }
  .lx-body ol.roman > li { counter-increment: rz; position: relative; }
  .lx-body ol.roman > li::before { content: "(" counter(rz, lower-roman) ")"; position: absolute; left: -40px; color: #8A929E; }
  .lx-table { width: 100%; margin-top: 18px; border-collapse: collapse; font-size: 14px; line-height: 1.55; color: #3E4552; }
  .lx-table th { text-align: left; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; color: #8A929E; padding: 0 12px 10px 0; border-bottom: 1px solid #D5DAE1; }
  .lx-table td { vertical-align: top; padding: 14px 12px 14px 0; border-bottom: 1px solid #E4E7EB; }
  .lx-table td:first-child { font-weight: 600; color: #12161D; }
  .lx-versions { margin-top: 72px; padding-top: 26px; border-top: 2px solid #12161D; }
  .lx-versions h2 { font-family: 'Bitter', serif; margin: 0; font-size: 22px; font-weight: 600; color: #12161D; }
  .lx-versions p { margin: 12px 0 0; font-size: 15px; line-height: 1.7; color: #5A6270; }
  .lx-versions .lx-table td:first-child { font-family: 'DM Mono', monospace; font-weight: 500; }
  .lx-hash { font-family: 'DM Mono', monospace; font-size: 11px; color: #8A929E; word-break: break-all; }
  @media (max-width: 760px) {
    .lx-toc ol { columns: 1; }
    .lx-meta { padding: 20px; }
    .lx-table thead { display: none; }
    .lx-table tr { display: block; padding: 12px 0; border-bottom: 1px solid #E4E7EB; }
    .lx-table td { display: block; padding: 3px 0; border: none; }
    .lx-table td[data-label]::before { content: attr(data-label); display: block; font-family: 'DM Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #8A929E; margin-top: 6px; }
  }
  @media print {
    .wk-header, footer, .lx-toc, .lx-btn { display: none !important; }
    .lx-body h2, .lx-body h3 { break-after: avoid; }
  }
"""


def versionsverzeichnis(kind, fassungen):
    zeilen = []
    for n, f in enumerate(fassungen):
        status = "aktuell" if n == 0 else f"bis {datum_kurz(fassungen[n - 1]['veroeffentlicht'])}"
        datei = f["datei"]
        zeilen.append(
            "<tr>"
            f'<td data-label="Version">{html.escape(f["version"])}</td>'
            f'<td data-label="Veröffentlicht">{datum_kurz(f["veroeffentlicht"])}</td>'
            f'<td data-label="Status">{status}</td>'
            f'<td data-label="Dokument"><a href="./{datei}" download>PDF herunterladen</a>'
            f'<div class="lx-hash">SHA-256 {f["sha256"]}</div></td>'
            "</tr>"
        )
    return (
        '<section class="lx-versions" id="versionen">'
        '<h2>Versionen</h2>'
        f'<p>Jede veröffentlichte Fassung der {DOKUMENTE[kind]["kurz"]} bleibt hier unverändert als PDF abrufbar. '
        'Die Prüfsumme (SHA-256) zeigt, dass eine Datei seit ihrer Veröffentlichung nicht verändert wurde.</p>'
        '<table class="lx-table"><thead><tr><th>Version</th><th>Veröffentlicht</th><th>Status</th><th>Dokument</th></tr></thead>'
        f'<tbody>{"".join(zeilen)}</tbody></table>'
        '</section>'
    )


def seite(kind, fassungen, vorlage):
    d = DOKUMENTE[kind]
    aktuell = fassungen[0]
    pdf = os.path.join(WURZEL, aktuell["datei"])
    inhalt = render(kind, pdf)
    if "<!-- TABELLE-UNTERAUFTRAGSVERARBEITER -->" in inhalt:
        tabelle = os.path.join(WURZEL, aktuell["datei"].replace(".pdf", ".anhang-3.html"))
        with open(tabelle, encoding="utf-8") as f:
            inhalt = inhalt.replace("<!-- TABELLE-UNTERAUFTRAGSVERARBEITER -->", f.read().strip())
    partner_url, partner_name = d["partner"]
    meta = (
        '<div class="lx-meta">'
        '<dl>'
        f'<div><dt>Version</dt><dd>{html.escape(aktuell["version"])}<span class="lx-badge">aktuell</span></dd></div>'
        f'<div><dt>Veröffentlicht</dt><dd>{datum_lang(aktuell["veroeffentlicht"])}</dd></div>'
        '<div><dt>Anbieterin</dt><dd>Bazzi Ventures GmbH</dd></div>'
        '</dl>'
        f'<a class="lx-btn" href="./{aktuell["datei"]}" download>'
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
        'PDF herunterladen</a>'
        '</div>'
    )
    hinweis = (
        '<p style="margin:18px 0 0;font-size:14px;line-height:1.65;color:#8A929E">'
        f'Massgebend ist der Wortlaut des PDF. Frühere Fassungen finden Sie unter <a href="#versionen">Versionen</a>. '
        f'Siehe auch: <a href="./{partner_url}">{partner_name}</a>.</p>'
    )
    hauptteil = (
        f'  <section lang="de-CH" class="wk-pad wk-tight" data-screen-label="{d["kurz"]}" style="max-width:820px;margin:0 auto;padding:88px 40px 96px">\n'
        '    <div style="font-family:\'DM Mono\',monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#A9711A">Rechtliches</div>\n'
        f'    <h1 style="font-family:\'Bitter\',serif;margin:22px 0 0;font-size:clamp(32px,4.2vw,48px);line-height:1.1;font-weight:600;letter-spacing:-0.02em;color:#12161D;overflow-wrap:break-word">{d.get("titel_html", d["titel"])}</h1>\n'
        f'    <div style="margin-top:10px;font-family:\'Bitter\',serif;font-size:clamp(19px,2.2vw,24px);line-height:1.3;color:#5A6270">{d["untertitel"]}</div>\n'
        f'    <p style="margin:24px 0 0;font-size:17px;line-height:1.7;color:#5A6270">{d["einleitung"]}</p>\n'
        f'    {meta}\n    {hinweis}\n'
        '<!-- RECHTSTEXT:START (erzeugt von tools/rechtstexte.py – nicht von Hand bearbeiten) -->\n'
        f'{inhalt}\n'
        f'{versionsverzeichnis(kind, fassungen)}\n'
        '<!-- RECHTSTEXT:ENDE -->\n'
        '  </section>\n'
    )
    url = f'https://werkora.ch/{d["seite"]}'
    titel = f'{d["titel"]} · Werkora'
    out = vorlage
    out = out.replace("{{TITEL}}", html.escape(titel)).replace("{{BESCHREIBUNG}}", html.escape(d["beschreibung"]))
    out = out.replace("{{URL}}", url).replace("{{CSS}}", CSS.strip("\n")).replace("{{HAUPTTEIL}}", hauptteil)
    return out


def vorlage_aus(datenschutz_html):
    """Kopf, Navigation und Fuss aus datenschutz.html übernehmen, damit alle Seiten gleich aussehen."""
    s = datenschutz_html
    s = re.sub(r"<title>.*?</title>", "<title>{{TITEL}}</title>", s, count=1)
    s = re.sub(r'(<meta name="description" content=")[^"]*', r"\1{{BESCHREIBUNG}}", s, count=1)
    s = re.sub(r'(<meta property="og:description" content=")[^"]*', r"\1{{BESCHREIBUNG}}", s, count=1)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*', r"\1{{TITEL}}", s, count=1)
    s = s.replace("https://werkora.ch/datenschutz.html", "{{URL}}")
    s = s.replace("</style>\n</helmet>", "{{CSS}}\n</style>\n</helmet>", 1)
    a = s.index('  <section class="wk-pad wk-tight" data-screen-label="Datenschutz"')
    b = s.index("  </section>", a) + len("  </section>\n")
    s = s[:a] + "{{HAUPTTEIL}}" + s[b:]
    # In der Fusszeile von datenschutz.html fehlt der Link auf die Datenschutzerklärung selbst
    if 'href="./datenschutz.html" style' not in s:
        s = s.replace(
            '        <a href="./impressum.html" style="font-size:14px;color:#5A6270">Impressum</a>\n',
            '        <a href="./impressum.html" style="font-size:14px;color:#5A6270">Impressum</a>\n'
            '        <a href="./datenschutz.html" style="font-size:14px;color:#5A6270">Datenschutz</a>\n', 1)
    return s


def main(argv):
    pruefen = "--pruefen" in argv
    with open(os.path.join(WURZEL, "rechtliches", "versionen.json"), encoding="utf-8") as f:
        versionen = json.load(f)
    with open(os.path.join(WURZEL, "datenschutz.html"), encoding="utf-8") as f:
        vorlage = vorlage_aus(f.read())
    fehler = 0
    for kind, fassungen in versionen.items():
        if kind.startswith("_"):
            continue
        for fas in fassungen:
            ist = sha256(os.path.join(WURZEL, fas["datei"]))
            if ist != fas["sha256"]:
                print(f"FEHLER: {fas['datei']} wurde verändert (SHA-256 {ist}). "
                      "Veröffentlichte Fassungen dürfen nicht überschrieben werden.", file=sys.stderr)
                fehler += 1
        ziel = os.path.join(WURZEL, DOKUMENTE[kind]["seite"])
        neu = seite(kind, fassungen, vorlage)
        alt = open(ziel, encoding="utf-8").read() if os.path.exists(ziel) else ""
        if pruefen:
            if alt != neu:
                print(f"{DOKUMENTE[kind]['seite']} ist nicht aktuell – tools/rechtstexte.py ausführen.", file=sys.stderr)
                fehler += 1
        elif alt != neu:
            with open(ziel, "w", encoding="utf-8") as f:
                f.write(neu)
            print(f"{DOKUMENTE[kind]['seite']} geschrieben (Version {fassungen[0]['version']}).")
        else:
            print(f"{DOKUMENTE[kind]['seite']} unverändert.")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
