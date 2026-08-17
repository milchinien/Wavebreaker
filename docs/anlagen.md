# Anlagen — was benutzt wird und woher es kommt

> `assets/raw` ist die **unangetastete Quelle**. Was das Spiel wirklich lädt, liegt in
> `public/` — nur dorthin wird ausgeliefert.
> `assets/raw/_extracted` enthält die entpackten Archive und ist ebenfalls nur Quelle.

> **Zu den `_rettung/...`-Skripten unten:** Der Ordner `_rettung/` liegt nicht mehr im
> Arbeitsbaum. Er steckt vollständig in der Git-Historie — zuletzt in Commit `2b8f52c`.
> Wer eines der genannten Skripte braucht, holt es von dort:
> `git show 2b8f52c:_rettung/muenzen-bauen.ps1`

## Regel

Ein Bild wandert erst dann nach `public/`, wenn es an einer Stelle **wirklich gebraucht**
wird. Der Rest bleibt in der Quelle liegen. Zugeschnitten und skaliert wird beim Übernehmen,
nicht zur Laufzeit: Das Spiel lädt keine 4000 Pixel breite Datei, um daraus ein Symbol mit
24 Pixeln zu machen.

## Symbole (`public/icons/`)

**22 Strichzeichnungen, eigens für dieses Spiel gezeichnet** — kein geliefertes Paket.

Symbole werden als **Maske** benutzt, nicht als Bild — die Datei liefert die Form, die Farbe
kommt aus der Palette (`.pix` in `src/style.css`). Deshalb ist es gleichgültig, in welcher
Farbe die Vorlage gezeichnet ist.

Alle liegen als SVG auf demselben Raster: 24 × 24 Einheiten, Strichstärke 2, runde Enden
und Ecken. Das ist der Grund, warum sie sich mischen lassen, ohne dass eine Zeile unruhig
wird — vorher lagen hier Pixelbilder in 24, 28 und 56 Pixel Kantenlänge nebeneinander, und
zwei Zeichen derselben Zeile trugen sichtbar verschiedene Strichstärken.

| Datei | Wo im Spiel |
|---|---|
| `coin` | Goldanzeige oben links, Kosten, Goldfaktor |
| `gold` | Münzstapel — Prestige-Ast Wirtschaft |
| `prev` / `next` | Wellensteuerung |
| `combat` / `base` / `upgrade` / `crosshair` / `gear` | Navileiste (Kampf, Basis, Upgrades, Prestige, Einstellungen) |
| `settings` | Regler — Einstellungspanel |
| `turret` / `autocannon` / `cannon` / `amplifier` | Turmarten |
| `damage` / `rate` / `range` / `hull` / `radius` | Kampfwerte |
| `bullet` | Schaden des Hauptturms in der Rumpfleiste |
| `boss` | Bosse und Titanen |
| `modules` | Module und Lager |

### Warum gezeichnet und nicht übernommen

Der gelieferte Anlagensatz enthält **weder die Game-UI-Sammlung noch die Skillicons**, auf
die diese Datei ursprünglich verwies. Aus `Lucid V1.2` ließen sich acht Zeichen übernehmen
(Home, Gear, Grid, Up-Arrow, Clock, Previous, Next) — für die anderen vierzehn gibt es dort
nichts, das die Bedeutung trägt. Eine Lupe als Fadenkreuz oder ein Schloss als Rumpf wäre
geraten, nicht belegt.

Übernommen wurde deshalb keines: Ein Satz aus acht geborgten Pixelbildern und vierzehn
eigenen Zeichnungen sähe zusammengesucht aus, und die Oberfläche ringsherum ist glatte
Neonzeichnung und kein Pixelbild. Die acht Lucid-Zeichen sind entsprechend abgelöst.

## Oberflächenteile (`public/ui/`)

Ebenfalls gezeichnet, aus demselben Grund.

| Datei | Wo im Spiel |
|---|---|
| `frame-slot.svg` | Fassung der Navischaltflächen — Achteck mit Eckwinkeln |
| `bar-hatch.svg` | laufende Schraffur in Fortschritts- und Lebensleisten |

## Seltenheitsrahmen (`public/frames/`)

Fünf Stufen, jede in ihrer Farbe aus `src/render/theme.ts` (`RARITY_COLOR`). Anders als die
Symbole sind sie **Bilder** und tragen ihre Farbe selbst.

Die Ausstattung wächst mit der Stufe, damit sich die Seltenheit auch ohne Farbsehen ablesen
lässt: `common` nur die Fassung, `rare` zusätzlich Eckwinkel, `epic` eine zweite Innenlinie,
`legendary` Kerben an den Kanten, `mythic` obendrein die Marke oben.

## Münzen (`public/coins/`)

| Datei | Quelle | Aufbau |
|---|---|---|
| `coins.png` | `coins-chests-etc-2-0.png`, Block COINS | 112 × 48 — drei Wertstufen (bronze, silber, gold) zu je sieben Bildern à 16 px |

Gemessenes Raster der Vorlage (`_rettung/muenzraster.ps1`): Der Glanzlauf steht in der
rechten Gruppe des COINS-Blocks, Spalten ab x = 176 im Abstand von 16 px, Farbreihen bei
y = 17 (gold), 33 (hellsilber), 49 (stahlblau), 65 (kupfer). Übernommen werden Kupfer,
Hellsilber und Gold — in dieser Reihenfolge, weil `coinLook` die Stufen 0, 1, 2 als
bronze, silber, gold liest. Die stahlblaue Reihe bleibt liegen: Sie wäre vom Hellsilber
kaum zu unterscheiden. Geschnitten von `_rettung/muenzen-bauen.ps1`.

Die sieben Bilder sind ein **Glanzlauf**: Bild 0 ist die ruhende Münze, 1 bis 6 ziehen ein
Licht darüber. Jede Münze bekommt ihren Versatz aus ihrem Ort, damit nicht das ganze Feld im
Takt blinkt.

## Effekte (`public/fx/`)

Alle drei sind waagerechte Streifen mit gleich breiten Einzelbildern.

| Datei | Quelle | Aufbau | Ereignis |
|---|---|---|---|
| `impact.png` | `PNG/Explosion_blue_circle` (10 × 256 px) | 10 × 48 px | Einschlag am Gegner |
| `death.png` | `PNG/Explosion_blue_oval` (10 × 256 px), Farbton +64° | 10 × 48 px | Gegner zerstört |
| `spark.png` | `PNG/Circle_explosion` (10 × 256 px) | 10 × 64 px | Gold fällt |

Die Farben sind **absichtlich** so gewählt: Blau für eigenen Schaden, Violett für den
zerfallenden Gegner, Gold für die Belohnung — dieselbe Aufteilung wie in der Palette
(`src/render/theme.ts`).

### Nachtrag 07.08.2026 — neuer Anlagensatz

Die ursprünglich genannten Quellen (Super Pixel Effects Gigapack, Einzelnamen wie
`symmetrical_impact_002`) sind im gelieferten Paket nicht enthalten. Ersetzt durch die
Folgen aus `assets/raw/PNG`, gebaut von `_rettung/fx-bauen.ps1`.

Die Zuordnung beruht auf **Messung**, nicht auf Dateinamen: Von jeder Folge wurde der
mittlere Farbton bestimmt (`_rettung/farben-messen.ps1`).

| Folge | gemessener Farbton | Verwendung |
|---|---:|---|
| `Explosion_blue_circle` | 208° | blau → `impact` |
| `Explosion_blue_oval` | 204° | Grundlage für `death` |
| `Circle_explosion` | 48° | gold → `spark` (Palette `GOLD` liegt bei 45°) |

**Violett fehlt im Paket.** `death.png` entsteht deshalb aus der ovalen blauen Folge,
gedreht um +64° auf 268° — der Palettenwert `VIOLET` (`#b45cff`) liegt bei 272°. Die
ovale statt der runden Folge, damit sich Einschlag und Tod auch in der **Form**
unterscheiden und nicht nur in der Farbe. Graue Pixel (Rauch) bleiben ungefärbt.

`spark.png` hat **zehn** statt zwölf Bildern — die Quelle gibt nicht mehr her.
`src/render/sprites.ts` ist entsprechend nachgezogen.

## Schrift (`public/fonts/`)

`monogram.ttf` — Pixelschrift für alle Zahlen auf Feld und Oberfläche. Nur ab 14 px
verwenden, darunter zerfällt sie.

## Klang (`public/sfx/`)

Gebaut von `tools/klang-bauen.mjs` aus dem Rohpaket in `Assets/raw` (2100 WAV, 96 kHz,
24 Bit, Stereo, je Klang sechs Aufnahmen). Ziel sind 32 kHz, 16 Bit, Mono, vorn und hinten
beschnitten, gekürzt und auf einen gemeinsamen Spitzenwert ausgesteuert — aus zwei Megabyte
je Datei werden zwanzig bis hundert Kilobyte. Neu bauen:

```
node tools/klang-bauen.mjs
```

| Name | Quelle (`Assets/raw`) | Ereignis |
|---|---|---|
| `coin` ×6 | `DSGNTonl_USABLE-Coin Toss` | `gold.collected` |
| `pod` ×3 | `DSGNTonl_USABLE-Magic Coin` | `pod.collected` |
| `poddrop` ×3 | `DSGNTonl_SKILL IMPACT-Coin Impact` | `pod.dropped` |
| `shot` ×4 | `DSGNMisc_PROJECTILE-Laser Shot` | `tower.fired` |
| `crit` ×3 | `DSGNMisc_SKILL IMPACT-Critical Strike` | `tower.fired` (kritisch) |
| `kill` ×4 | `DSGNImpt_EXPLOSION-Small Flare` | `enemy.killed` |
| `hurt` ×3 | `DSGNMisc_HIT-Mecha Armor Piercer` | `station.damaged` |
| `bossin` ×2 | `MAGSpel_CAST-Sharp Summon` | `boss.spawned` |
| `bossdown` ×2 | `DSGNImpt_EXPLOSION-Eruption` | `boss.killed` |
| `lost` ×2 | `DSGNImpt_EXPLOSION-Forced Shutdown` | `station.destroyed` |
| `wavein` ×2 | `MAGSpel_CAST-Energy Riser` | `wave.started` |
| `waveout` ×2 | `DSGNSynth_BUFF-Stats Up` | `wave.cleared` |
| `level` ×2 | `DSGNSynth_BUFF-Mecha Level Up` | `level.up` |
| `prestige` ×2 | `MAGSpel_CAST-Complex Rise` | `prestige.done` |
| `event` ×2 | `DSGNTonl_SKILL IMPACT-Magic Sparkles` | `event.triggered` |
| `ability` ×3 | `DSGNSynth_CAST-Mecha Energy Gathering` | `ability.activated` |
| `ready` ×2 | `DSGNMisc_INTERFACE-Zap Select` | `ability.ready` |
| `buy` ×3 | `UIClick_INTERFACE-Positive Click` | `upgrade.bought` |
| `build` ×2 | `DSGNSynth_BUFF-Mecha Lock In` | `tower.bought` |
| `trade` ×2 | `DSGNTonl_USABLE-Mecha Upgrade Equip` | `trader.bought` |
| `trader` ×2 | `WHSH_MOVEMENT-Mecha Ship Passby` | `trader.arrived` |

Zusammen 56 Dateien, 3,2 MB. Geholt werden sie **bei der ersten Berührung der Seite**, nicht
beim Laden: Der Klang darf den Start nicht aufhalten, und vorher darf der Browser ohnehin
nichts abspielen.

**Warum mehrere Aufnahmen je Klang.** Sie sind der Grund, warum hundert eingesammelte Münzen
je Welle nicht klingen wie ein Maschinengewehr. `app/audio.ts` zieht bei jedem Ton eine
andere als beim letzten Mal und streut bei den häufigen Klängen zusätzlich die Tonhöhe um
±4 %. Die Anzahl folgt der Häufigkeit: Das Aufheben von Gold bekommt alle sechs, ein
Prestige zwei.

Die gerechneten Töne aus Oszillatoren sind geblieben — aber als **Ersatz**, nicht als
Regel: Solange eine Aufnahme lädt oder fehlt, springt der zugehörige Ton ein. Eine fehlende
Datei darf nie eine Fehlermeldung ergeben und auch keine Stille an einer Stelle, an der
etwas passiert ist.

### Was fehlt

Die Schrift `monogram` (`public/fonts/monogram.ttf`) liegt dem Anlagensatz **nicht** bei.
Alle Zahlen laufen deshalb in der Ersatzschrift (`ui-monospace`). Das Spiel läuft davon
unbeeindruckt; die Pixeloptik der Zahlen fehlt aber.

## Lizenzen

| Paket | Lizenz |
|---|---|
| Craftpix (Skillicons, Frames, Effektpakete) | https://craftpix.net/file-licenses/ |
| Super Pixel Effects Gigapack (Free) | Craftpix-Lizenz |
| Lucid V1.2 (Symbolsatz, nicht mehr verwendet) | siehe Beilage des Pakets in `Assets/raw` |
| Klangpaket (`DSGN*`, `MAG*`, `UI*`, `WHSH*`, `FGHT*`) | siehe Beilage des Pakets in `Assets/raw` |
| Münz- und Effektbilder | siehe Beilage der Pakete in `Assets/raw` |
| Symbole, Rahmen, Oberflächenteile in `public/icons`, `public/frames`, `public/ui` | eigene Zeichnungen, gehören zum Projekt |

**Wichtig:** Die Rohpakete dürfen nicht weitergegeben werden. Deshalb liegt in `public/`
immer nur der zugeschnittene Ausschnitt, der im Spiel auch erscheint.
