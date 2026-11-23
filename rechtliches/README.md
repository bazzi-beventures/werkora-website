# Rechtstexte (AGB und AVV)

Die AGB und die Auftragsverarbeitungsvereinbarung (AVV) von Werkora.ch werden versioniert veröffentlicht:

| Seite | Inhalt |
|---|---|
| [`agb.html`](../agb.html) | aktuelle AGB als Webseite + Verzeichnis aller Fassungen |
| [`avv.html`](../avv.html) | aktuelle AVV als Webseite + Verzeichnis aller Fassungen |
| `agb/werkora-agb-JJJJ-MM.pdf` | jede veröffentlichte AGB-Fassung (massgebender Wortlaut) |
| `avv/werkora-avv-JJJJ-MM.pdf` | jede veröffentlichte AVV-Fassung (massgebender Wortlaut) |
| `versionen.json` | Verzeichnis der Fassungen mit Datum und SHA-256-Prüfsumme |

## Grundsätze

- **Veröffentlichte PDFs werden nie überschrieben oder gelöscht.** Eine neue Fassung bekommt eine neue Datei.
  Kunden müssen jederzeit nachlesen können, welche Fassung sie vereinbart haben.
- Die Prüfsumme in `versionen.json` belegt, dass eine Datei unverändert ist. `tools/rechtstexte.py`
  bricht mit einem Fehler ab, wenn eine veröffentlichte Datei verändert wurde.
- Massgebend ist das PDF. Die Webseite wird aus dem PDF erzeugt und nicht von Hand bearbeitet.
- Die Git-Historie dieses Repositorys dokumentiert zusätzlich, wann welche Fassung online ging.

## Erste veröffentlichte Fassungen (online seit 23. November 2026)

- **AGB 09/2026:** unverändert gegenüber der Vorlage.
- **AVV 11/2026:** Vorlage, die zusammen mit den AGB 09/2026 verwendet wurde, ohne Google Cloud EMEA
  Limited (Google Workspace) in Anhang 3. Google Workspace wird nur für Tests genutzt und ist kein
  Unterauftragsverarbeiter. Die Zeile wurde aus dem PDF entfernt, alle übrigen Seiten sind unverändert.
  Die AVV-Vorlage trägt selbst keine Versionsangabe.

## AVV 12/2026

Anhang 3 ergänzt um GitHub, Inc. (Auslieferung der App-Dateien) und Google Maps Platform
(Distanzberechnung zur Objektadresse). Erzeugt aus der Word-Vorlage der AVV (Stand 18.09.2026) mit
LibreOffice. Der Text ist bis auf die zwei neuen Tabellenzeilen identisch mit 11/2026. Microsoft 365
ist nicht aufgeführt: Der Mailzugriff läuft über das Konto des Kunden.

## Neue Fassung veröffentlichen

1. Das neue PDF ablegen, z. B. `rechtliches/agb/werkora-agb-2027-03.pdf`. Es darf nur die AGB bzw.
   nur die AVV enthalten, keine kundenspezifischen Vertragsseiten.
2. Prüfsumme berechnen:

   ```bash
   sha256sum rechtliches/agb/werkora-agb-2027-03.pdf
   ```

3. In `versionen.json` einen neuen Eintrag **zuoberst** in der Liste einfügen (Version, Veröffentlichungsdatum,
   Datei und Prüfsumme). Die bisherigen Einträge bleiben stehen.
4. Nur AVV: Hat die neue Fassung einen Anhang 3 (Unterauftragsverarbeiter), die Tabelle als
   `werkora-avv-JJJJ-MM.anhang-3.html` neben das PDF legen (Vorlage: Datei der Vorgängerversion).
5. Seiten neu bauen (benötigt `pip install pdfplumber`):

   ```bash
   python3 tools/rechtstexte.py
   ```

6. Die Seite im Browser mit dem PDF vergleichen. Der Wortlaut muss übereinstimmen. Die Erkennung von
   Überschriften und Absätzen beruht auf dem Layout der bisherigen Vorlage.
7. `sitemap.xml` (`lastmod`) nachführen, committen und veröffentlichen.

Kunden mit laufendem Vertrag über Änderungen informieren (für die AVV siehe Ziff. 15.2 AVV).
