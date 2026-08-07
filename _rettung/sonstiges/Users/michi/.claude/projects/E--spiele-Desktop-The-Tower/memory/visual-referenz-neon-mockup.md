---
name: visual-referenz-neon-mockup
description: "Verbindliches Look-and-Feel-Referenzbild (Screenshot eines Neon-Tower-Defense im Hochformat), an dem sich Farben und Stil des Spiels exakt orientieren sollen"
metadata: 
  node_type: memory
  type: project
  originSessionId: ec7265fa-98c0-4350-afee-e65edd2ea958
  modified: 2026-08-02T22:10:03.672Z
---

Der Nutzer hat am 2026-08-03 einen Screenshot als **verbindliche visuelle Referenz** geliefert:
"genau so soll das Spiel aussehen von den Farben und dem Style her". Das Bild liegt nicht im Repo,
deshalb hier die Beschreibung.

**Gesamteindruck:** Hochformat (Handy), fast schwarzer Blauton als Hintergrund, alles in dünnen
Neon-Outlines mit farbigem Glow, keine Flächenfüllungen im Spielfeld. Kräftige, runde, sehr fette
Sans-Serif (Richtung Baloo/Nunito ExtraBold) in Weiß mit leichtem Leuchten.

**Farbpalette (Näherung aus dem Bild):**

| Rolle | Wert |
|---|---|
| Hintergrund | `#0a0d1a` (sehr dunkles Marineblau/Schwarz) |
| Panel-Füllung | `#122354` – `#0f1b40` (dunkles Blau, deckend, nicht transparent) |
| Panel-Rahmen | Weiß bis Hellcyan `#7fd8ff`, ca. 2–3 px, mit Außenglow |
| Cyan-Akzent (Angriff, Hauptturm, Kosten) | `#46c8ff` |
| Türkis (Fortschrittsbalken) | `#2ee0c0` |
| Grün/Lime (Speed-Buttons, Gold-Popup) | `#7fe83f` |
| Magenta/Pink (Gegner, Leben, Defense) | `#ff2d78` |
| Gold/Gelb (Münzen, Utility, Legendary) | `#ffcc33` |
| Sektionsbalken | kräftiges Blau `#29a3f5` volle Breite, weißer Großbuchstaben-Text |

**Aufbau von oben nach unten:**

1. **Oben links:** große weiße Werte `$ 5` und `© 9` (Münz-Icon: goldener Kreis mit C).
   Oben rechts: Zahnrad als weißes Icon in abgerundetem Rahmen.
2. **Spielfeld (obere Hälfte):** dünner Reichweitenkreis in gedämpftem Blaugrau, zentral das
   **Sechseck** als Hauptturm in leuchtendem Cyan (nur Outline). Gegner sind **kleine Quadrate als
   reine Outlines** in Pink und Gelb. Geschoss = kleiner Cyan-Kreis mit violettem Bewegungs-Trail.
   Tod = Wolke kleiner pinker Ringe. Gold-Drop als grüne Zahl `$1`.
3. **Geschwindigkeit:** `−` / `+` als lime-grüne Rahmenbuttons, dazwischen `x1.0` in Weiß.
4. **Zwei Statuskarten nebeneinander:** links Schaden (Schwert), Regeneration (Herz), Münzmultiplikator
   plus türkis gefüllte Leiste `10 / 10` mit dunkler Beschriftung; rechts `Wave 4` groß, rechtsbündig
   Schwert-/Herz-Werte, darunter türkise Fortschrittsleiste auf dunkler Spur.
5. **Sektionsbalken** `ATTACK UPGRADES`: durchgehend blauer Balken über die volle Breite.
6. **Upgrade-Kacheln** im 2er-Raster: dunkles Panel mit hellem Rahmen, Bezeichnung links weiß,
   rechts ein eigener eingerahmter Block mit Wert oben (weiß) und Kosten darunter (cyan, `$ 24`).
7. **Untere Reiterleiste:** drei Rahmenbuttons mit Innen-Streifenmuster — Angriff (cyan, Schwert),
   Verteidigung (magenta, Schild), Utility (gold, Stern). Der aktive Reiter leuchtet stärker.

**Anwendung:** Diese Palette und dieser Stil gehen vor die aktuellen Werte in `src/style.css`
und `render/theme.ts` (dort heute blasseres Cyan `#47d5ff` auf `#060a14`, halbtransparente Panels).
Zu GDD 13 (`docs/gdd/13-ui-und-visuelles-design.md`) passt das Bild grundsätzlich — es macht dessen
"dunkel, neonbeleuchtet" konkret: kräftigere, gesättigtere Neonfarben, deckende Panels mit hellem
Rahmen, sehr fette runde Schrift, Gegner als reine Outline-Formen.

