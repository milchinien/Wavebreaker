# Anlagen — was benutzt wird und woher es kommt

> `assets/raw` ist die **unangetastete Quelle**. Was das Spiel wirklich lädt, liegt in
> `public/` — nur dorthin wird ausgeliefert.
> `assets/raw/_extracted` enthält die entpackten Archive und ist ebenfalls nur Quelle.

## Regel

Ein Bild wandert erst dann nach `public/`, wenn es an einer Stelle **wirklich gebraucht**
wird. Der Rest bleibt in der Quelle liegen. Zugeschnitten und skaliert wird beim Übernehmen,
nicht zur Laufzeit: Das Spiel lädt keine 4000 Pixel breite Datei, um daraus ein Symbol mit
24 Pixeln zu machen.

## Symbole (`public/icons/`)

Symbole werden als **Maske** benutzt, nicht als Bild — die Datei liefert die Form, die Farbe
kommt aus der Palette (`.pix` in `src/style.css`). Deshalb ist es gleichgültig, in welcher
Farbe die Vorlage gezeichnet ist.

| Datei | Quelle | Wo im Spiel |
|---|---|---|
| `coin.png` | Game UI collection · Icons · Asset 5 | Goldanzeige oben links, Kosten |
| `prev.png` / `next.png` | Game UI collection · Icons · Asset 25 / 26 | Wellensteuerung |
| `combat.png` | Game UI collection · Icons · Asset 13 | Navileiste: Kampf |
| `base.png` | Game UI collection · Icons · Asset 39 | Navileiste: Basis |
| `gear.png` | Cyan Blue Neon Arcade UI Pack · Settings_icon | Navileiste: Einstellungen |
| `crosshair.png` | Game UI collection · Icons · Asset 27 | Reichweite |
| `bullet.png` | Game UI collection · Icons · Asset 19 | Schaden |
| `damage`, `hull`, `rate`, `range`, `radius`, `gold`, `turret`, `modules`, `upgrade`, `settings`, `autocannon`, `cannon`, `amplifier`, `boss` | Craftpix Skillicons (`1 Icons`) | Kachel- und Werteanzeigen |

## Oberflächenteile (`public/ui/`)

| Datei | Quelle | Wo im Spiel |
|---|---|---|
| `frame-slot.png` | Game UI collection · button/Blue · Asset 19 | Navischaltflächen, Upgrade-Kacheln |
| `frame-box.png` | Game UI collection · button/Blue · Asset 16 | Panelrahmen (9-Schnitt über `border-image`) |
| `bar-hatch.png` | Game UI collection · Bars/Blue · Asset 10 | Schraffur in Fortschritts- und Lebensleisten |
| `corner.png` | Game UI collection · Bars/Blue · Asset 5 | Eckwinkel am Spielfeldrand |
| `plate.png` | Game UI collection · Button with border/Blue · Asset 8 | Schild unter Beschriftungen |
| `arrow-left.png` / `arrow-right.png` | Craftpix `2 Frames` | (abgelöst durch `prev`/`next`) |

## Münzen (`public/coins/`)

| Datei | Quelle | Aufbau |
|---|---|---|
| `coins.png` | `coins-chests-etc-2-0.png`, Block COINS | 112 × 48 — drei Wertstufen (bronze, silber, gold) zu je sieben Bildern à 16 px |

Die sieben Bilder sind ein **Glanzlauf**: Bild 0 ist die ruhende Münze, 1 bis 6 ziehen ein
Licht darüber. Jede Münze bekommt ihren Versatz aus ihrem Ort, damit nicht das ganze Feld im
Takt blinkt.

## Effekte (`public/fx/`)

Alle drei sind waagerechte Streifen mit gleich breiten Einzelbildern.

| Datei | Quelle | Aufbau | Ereignis |
|---|---|---|---|
| `impact.png` | Super Pixel Effects Gigapack · Impacts · symmetrical_impact_002 (small, blue) | 10 × 48 px | Einschlag am Gegner |
| `death.png` | Super Pixel Effects Gigapack · Explosions · stylized_explosion_002 (small, violet) | 10 × 48 px | Gegner zerstört |
| `spark.png` | Super Pixel Effects Gigapack · Sci-fi · scifi_spark_burst_001 (small, yellow) | 12 × 64 px | Gold fällt |

Die Farben sind **absichtlich** so gewählt: Blau für eigenen Schaden, Violett für den
zerfallenden Gegner, Gold für die Belohnung — dieselbe Aufteilung wie in der Palette
(`src/render/theme.ts`).

## Schrift (`public/fonts/`)

`monogram.ttf` — Pixelschrift für alle Zahlen auf Feld und Oberfläche. Nur ab 14 px
verwenden, darunter zerfällt sie.

## Lizenzen

| Paket | Lizenz |
|---|---|
| Craftpix (Skillicons, Frames, Effektpakete) | https://craftpix.net/file-licenses/ |
| Game UI collection FREE version | SunGraphica, gamedevmarket.net |
| Cyan Blue Neon Arcade UI Pack | Uryon Games / Sophie Wodey — Nutzung frei, Weitergabe der Rohdateien nicht |
| Super Pixel Effects Gigapack (Free) | Craftpix-Lizenz |
| monogram | siehe `assets/raw/monogram/credits.txt` |

**Wichtig:** Die Rohpakete dürfen nicht weitergegeben werden. Deshalb liegt in `public/`
immer nur der zugeschnittene Ausschnitt, der im Spiel auch erscheint.

