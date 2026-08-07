# WAVEBREAKER — Implementierungsplan

> Schritt-für-Schritt-Bauplan für das gesamte Spiel. Beschreibt **Reihenfolge, Dateien und
> Funktionen** — keinen fertigen Code.
>
> Regeln und Werte kommen aus dem [GDD](gdd/README.md). Dieser Plan wiederholt sie nicht, sondern
> verweist darauf. Wo der Plan eine technische Entscheidung trifft, die im GDD offen war, steht sie
> in Abschnitt 3 mit Begründung.

---

## Inhalt

| Teil | Inhalt |
|---|---|
| [1](#1-lesart) | Lesart: wie eine Etappe aufgebaut ist |
| [2](#2-projektstruktur) | Projektstruktur und Schichten |
| [3](#3-entscheidungen-die-vorab-feststehen-müssen) | Entscheidungen, die vorab feststehen müssen |
| [4](#4-etappenübersicht) | Etappenübersicht |
| [5](#5-phase-a--fundament-e0e3) | Phase A — Fundament (E0–E3) |
| [6](#6-phase-b--kampf-e4e9) | Phase B — Kampf (E4–E9) |
| [7](#7-phase-c--progression-e10e13) | Phase C — Progression (E10–E13) |
| [8](#8-phase-d--ausbau-e14e18) | Phase D — Ausbau (E14–E18) |
| [9](#9-querschnittsregeln) | Querschnittsregeln, die in jeder Etappe gelten |
| [10](#10-was-bewusst-nicht-früh-gebaut-wird) | Was bewusst *nicht* früh gebaut wird |

---

## 1. Lesart

Jede Etappe ist so geschnitten, dass sie **allein lauffähig** ist und am Ende etwas Sichtbares oder
Prüfbares liefert. Keine Etappe lässt Bauruinen zurück, die erst drei Schritte später Sinn ergeben.

Aufbau jeder Etappe:

| Feld | Bedeutung |
|---|---|
| **Ziel** | Was danach geht, was vorher nicht ging |
| **Funktionen** | Datei, Signatur, Zweck — die eigentliche Arbeitsliste |
| **Abnahme** | Woran man erkennt, dass die Etappe fertig ist |
| **Beweis** | Selbsttest oder sichtbarer Effekt, nicht „sieht gut aus" |

**Reihenfolge-Prinzip:** Zuerst die Dinge, die später teuer nachzurüsten wären (Zeitquelle,
Speicherformat, Belohnungsstelle, Ereignisbus). Dann der Kampf, weil er das Spielgefühl bestimmt.
Dann Fortschritt. Zuletzt Inhalte, die nur Datensätze sind.

---

## 2. Projektstruktur

```
src/
├── main.ts                Einstieg: Zustand laden, Schleife starten, Bereiche verdrahten
├── core/                  reine Werkzeuge — kein DOM, kein Canvas, kein Spielwissen
│   ├── loop.ts            feste Zeitschritte, Spielgeschwindigkeit, zentrale Zeitquelle
│   ├── events.ts          Ereignisbus (Anschlusspunkte für Audio und später Analytik)
│   ├── rng.ts             deterministischer Zufall mit Seed
│   ├── vec.ts             Vektorrechnung
│   ├── geometry.ts        Polygone, Andocken, Überlappung  ← aus Prototyp 01
│   ├── format.ts          Zahlen-, Prozent- und Zeitdarstellung
│   └── assert.ts          Zusicherungen für die Selbsttests
├── data/                  nur Datensätze und Kurven, keine Logik
│   ├── balance.ts         alle Kurven und Faktoren an einem Ort
│   ├── towers.ts          Turmarten
│   ├── cores.ts           Hauptturm-Kerne
│   ├── enemies.ts         Gegnerklassen, Elite-Modifikatoren, Bosse
│   ├── rarities.ts        Raritäten und Turm-Eigenschaften
│   ├── perks.ts           Level-Perks
│   ├── abilities.ts       aktive Fähigkeiten
│   ├── prestige.ts        Prestige-Baum
│   ├── events.ts          Ereignisse und Versorgungskapseln
│   └── strings.ts         alle Spielertexte (englisch, eine Datei)
├── sim/                   Spielregeln — kein DOM, kein Canvas
│   ├── station.ts         Bauregeln                      ← aus Prototyp 01
│   ├── buffs.ts           Buff-Nachbarschaft, Effektivwerte ← aus Prototyp 01
│   ├── stats.ts           Endwerte aus Basis × Rarität × Upgrades × Perks × Prestige × Buffs
│   ├── waves.ts           Wellenerzeugung und Wellenzustand
│   ├── enemies.ts         Gegnerinstanzen, Bewegung, Andocken
│   ├── projectiles.ts     Geschosse mit Wiederverwendung
│   ├── targeting.ts       Zielerfassung und Prioritäten
│   ├── combat.ts          Schaden, Tod, Belohnungsauslösung
│   ├── economy.ts         Gold, Drops, Stapel, Einsammeln
│   ├── progression.ts     XP, Level, Perk-Auswahl
│   ├── abilities.ts       Fähigkeiten und Abklingzeiten
│   ├── prestige.ts        Rücksetzung und Punkteberechnung
│   └── offline.ts         Schnelldurchlauf für Abwesenheit
├── app/                   Zustand und Handlungen
│   ├── state.ts           GameState — die eine Wahrheit
│   ├── save.ts            Serialisierung, Version, Migration
│   ├── rewards.ts         grantReward — zentrale Belohnungsstelle
│   └── actions.ts         jede Spielerhandlung als eine Funktion
├── render/                Canvas
│   ├── theme.ts           Farben, Linienstärken, Leuchtstärken
│   ├── camera.ts          Auto-Zoom, Welt ↔ Bildschirm
│   ├── scene.ts           Zeichenreihenfolge
│   ├── station.ts         Module, Fugen, Embleme, Raritätsrahmen
│   ├── combat.ts          Gegner, Geschosse, Treffer, Explosionen
│   └── overlays.ts        Bauhilfen, Buff-Linien, Reichweiten, Abriss-Vorschau
├── ui/                    HTML/CSS
│   ├── shell.ts           Bereichswechsel: Kampf · Basis · Upgrades · Prestige · Einstellungen
│   ├── hud.ts             obere Leiste, Wellensteuerung, Fähigkeitenleiste
│   ├── base.ts            Inventar, Baufläche-Panel, Verwaltung
│   ├── upgrades.ts        Upgrade-Menü
│   ├── prestige.ts        Prestige-Baum
│   ├── dialogs.ts         Turmkauf, Level-Up, Ereignisse, Rückkehr-Zusammenfassung
│   └── tooltip.ts         Hover-Informationen
└── selftest/
    └── index.ts           sammelt alle Zusicherungen, Aufruf über ?selftest
```

### Abhängigkeitsrichtung

```
core  ←  data  ←  sim  ←  app  ←  render / ui  ←  main
```

**Strikt einseitig.** `sim` kennt kein DOM und kein Canvas. `render` und `ui` lesen den Zustand und
rufen `app/actions.ts` auf — sie ändern nie direkt etwas. Das ist die Voraussetzung dafür, dass die
Offline-Simulation und die Selbsttests dieselbe Logik ohne Browser ausführen können.

---

## 3. Entscheidungen, die vorab feststehen müssen

Diese Punkte sind später nur mit Umbau nachrüstbar. Sie gehören deshalb in **E0**, nicht in eine
spätere Etappe.

| Thema | Entscheidung | Begründung |
|---|---|---|
| **Zahlentyp** | normales `number` | GDD 16 §15 ließ das offen. Bei einer Wellenskalierung von ×1,1 wird der Wertebereich eines Doubles (1,8·10³⁰⁸) erst um Welle **7.400** erreicht — weit jenseits jeder Spielzeit. Ein eigener Mantisse/Exponent-Typ verteuert jede Rechnung und jeden Aufruf für ein Problem, das nicht eintritt. Alle **Anzeigen** laufen trotzdem über `core/format.ts`, damit ein späterer Wechsel nur diese eine Datei berührt |
| **Zeit** | eine Quelle in `core/loop.ts`, niemand ruft `Date.now()` oder `performance.now()` direkt auf | Voraussetzung für Geschwindigkeit ×2/×4, Offline-Simulation und reproduzierbare Tests (GDD 16 §12) |
| **Simulationsschritt** | fest 60 Ticks/s, entkoppelt vom Zeichnen; ×2/×4 = mehr Ticks pro Bild, nie größere Schritte | GDD 16 §12 |
| **Zufall** | `core/rng.ts` mit Seed im Spielstand | reproduzierbare Fehlerberichte; ohne das ist ein Balancing-Fehler nicht nachstellbar |
| **Belohnungen** | ausschließlich über `grantReward()` | GDD 16 §2 — spätere Werbe-Belohnungen hängen sich dort an, ohne die Spiellogik anzufassen |
| **Spielstand** | ein versioniertes Objekt, eine `serialize`/`deserialize`-Stelle, Migration von Version zu Version | GDD 16 §2 und §8 |
| **Freischaltungen** | Daten (Flags/Mengen im Zustand), nie `if`-Zweige im Code | GDD 16 §2 |
| **Texte** | alle Spielertexte in `data/strings.ts`, Zugriff über einen Schlüssel | GDD 16 §1 — deutsche Fassung später ohne Codeänderung |
| **Ereignisse** | `core/events.ts`; jedes relevante Spielereignis wird gemeldet, auch wenn zunächst niemand zuhört | GDD 13 §11 — Audio wird später nur angeschlossen, nicht eingebaut |
| **Obergrenzen** | maximale gleichzeitige Gegner und Geschosse als Konstante in `data/balance.ts` | GDD 16 §12 |

---

## 4. Etappenübersicht

| # | Etappe | Ergebnis | Phase |
|---|---|---|---|
| **E0** | Gerüst und Fundament | leeres Spiel läuft, Schleife, Zustand, Speichern, Selbsttests | A |
| **E1** | Darstellung und Kamera | Hauptturm ist sichtbar, Kamera folgt der Station | A |
| **E2** | Station und Bauregeln | Bauen funktioniert im Code, vollständig getestet | A |
| **E3** | Basisansicht | Spieler kann Module setzen, ziehen, entfernen | A |
| **E4** | Gegner und Wellen | Gegner laufen an, docken an, Station verliert HP | B |
| **E5** | Türme schießen | Türme treffen und töten Gegner | B |
| **E6** | Hauptturm und Niederlage | Kern kämpft mit, Welle kann verloren und wiederholt werden | B |
| **E7** | Gold | Gegner lassen Gold fallen, Spieler sammelt es ein | B |
| **E8** | Upgrades | Gold wird in Stärke umgesetzt | B |
| **E9** | Wellensteuerung und Bosse | Auto-Modus, Skippen, Boss alle 10 Wellen → **MVP** | B |
| **E10** ✔ | Level und Perks | XP, Levelaufstieg, Auswahl bei jedem Level | C |
| **E11** ✔ | Fähigkeiten | aktive Fähigkeiten mit Abklingzeit | C |
| **E12** ✔ | Turmkauf, Raritäten, Schmelzen | Inventar wird zum eigenen Fortschrittssystem | C |
| **E13** ✔ | Prestige | Run zurücksetzen, dauerhaft stärker werden, Kern wählen | C |
| **E14** ✔ | Turminhalte | restliche Turmarten und Spezialtürme | D |
| **E15** ✔ | Gegnerinhalte | Gegnerklassen, Elite-Modifikatoren, Bossarten | D |
| **E16** | Ereignisse und Kapseln | Zufallsereignisse, Versorgungskapseln, Händler-Drohne | D |
| **E17** | Offline und Helfer | Abwesenheitsertrag, Rückkehr-Zusammenfassung, Helfer | D |
| **E18** | Politur | Effekte, Hinweise, Einstellungen, Audio-Anschluss | D |

**Empfohlener erster Abgabepunkt: nach E9.** Das entspricht dem MVP aus GDD 16 §11 und ist der
Punkt, an dem sich das Spiel zum ersten Mal wie ein Spiel anfühlt. Alles danach ist Ausbau.

---

## 5. Phase A — Fundament (E0–E3)

### E0 — Gerüst und Fundament

**Ziel:** Ein leeres, aber vollständiges Skelett: Schleife läuft, Zustand existiert, Speichern
funktioniert, Selbsttests laufen. Noch kein Spielinhalt.

| Datei | Funktion | Zweck |
|---|---|---|
| `core/loop.ts` | `createLoop(opts): Loop` | Schleife mit festem Schritt erzeugen |
| | `Loop.start(tick, render): void` | Simulations- und Zeichenrückruf anmelden |
| | `Loop.setSpeed(factor: 1 \| 2 \| 4): void` | mehr Ticks pro Bild, nicht größere Schritte |
| | `Loop.now(): number` | **die** Zeitquelle des Spiels, in Sekunden seit Start |
| | `Loop.wallClock(): number` | echte Uhrzeit, nur für Offline-Berechnung |
| `core/events.ts` | `emit(name: EventName, payload?): void` | Ereignis melden |
| | `on(name, handler): () => void` | zuhören, Rückgabe meldet ab |
| `core/rng.ts` | `createRng(seed: number): Rng` | deterministischer Generator |
| | `Rng.next(): number` · `Rng.int(min,max)` · `Rng.pick(arr)` · `Rng.chance(p)` | Grundoperationen |
| `core/format.ts` | `formatNumber(n): string` | abgekürzt ab 10.000 (GDD 13 §8) |
| | `formatPercent(v): string` · `formatDuration(s): string` | Prozent nie als Multiplikator |
| `core/assert.ts` | `check(name, fn): void` · `assert(cond, msg): void` | Selbsttest-Bausteine |
| `app/state.ts` | `createInitialState(): GameState` | Startzustand nach GDD 14 §1 |
| | `type GameState` | **Run-Daten** und **permanente Daten** getrennt (GDD 16 §8) |
| `app/save.ts` | `serialize(state): SaveData` · `deserialize(data): GameState \| null` | eine einzige Stelle |
| | `save(state): void` · `load(): GameState \| null` · `clearSave(): void` | localStorage |
| | `migrate(data, fromVersion): SaveData \| null` | Version zu Version, nie Sprünge |
| | `startAutosave(state, loop): void` | alle paar Sekunden, bei Ereignissen, beim Schließen |
| `app/rewards.ts` | `grantReward(state, reward: Reward): void` | **die** Stelle, an der Gold/XP/Punkte entstehen |
| `data/strings.ts` | `t(key: StringKey, params?): string` | alle Spielertexte |
| `data/balance.ts` | Konstanten | Kurven, Faktoren, Obergrenzen |
| `selftest/index.ts` | `runSelfTests(): TestResult[]` | Aufruf über `?selftest` |
| `main.ts` | — | lädt Zustand, startet Schleife |

**Abnahme**

- `npm run dev` zeigt eine leere Bühne, die Schleife läuft mit stabilen 60 Ticks/s
- Zustand überlebt einen Seiten-Neuladen
- `?selftest` läuft und meldet grün
- `npm run typecheck` ist sauber

**Beweis**

- Zeitquelle: 120 Ticks bei ×2 in einer Sekunde, 60 bei ×1 — als Test, nicht per Augenmaß
- Speicher-Rundlauf: `deserialize(serialize(x))` ist gleich `x`
- kaputte Spielstände liefern `null` statt eines Absturzes
- `grantReward` erhöht genau die genannte Ressource und meldet ein Ereignis

---

### E1 — Darstellung und Kamera

**Ziel:** Der Hauptturm steht sichtbar im Bild, die Kamera hält ihn zentriert und zoomt weich.

| Datei | Funktion | Zweck |
|---|---|---|
| `core/vec.ts` | `add` · `sub` · `scale` · `len` · `dist` · `normalize` | Grundrechnung |
| `core/geometry.ts` | `polygonAt(n, center, rotation): Vec2[]` | regelmäßiges Vieleck |
| | `apothem(n)` · `circumradius(n)` · `edgesOf(poly)` | Maße und Kanten |
| `render/theme.ts` | Farbkonstanten | GDD 13 §2 und §7 an einem Ort |
| `render/camera.ts` | `createCamera(): Camera` | Zustand |
| | `fitTo(cam, polys, viewW, viewH, extra?): void` | Station komplett im Bild (GDD 13 §4) |
| | `step(cam, dt): void` | weiche Annäherung, keine Sprünge |
| | `worldToScreen` / `screenToWorld` | Umrechnung |
| `render/scene.ts` | `render(ctx, state, cam, w, h): void` | Zeichenreihenfolge, eine Stelle |
| `render/station.ts` | `drawModules(ctx, state, cam, w, h): void` | Flächen, Fugen, Raritätsrahmen, Embleme |

**Abnahme**

- Hauptturm als Hexagon mittig, Fugen heller als Außenkanten (Look aus Prototyp 01)
- Fenstergröße ändern verzieht nichts
- Kamera zoomt weich, springt nie

**Beweis:** `fitTo` mit vorgegebenen Polygonen liefert erwartete Zoomwerte; Reichweiten-Zusatz
verkleinert den Zoom (GDD 13 §4).

---

### E2 — Station und Bauregeln

**Ziel:** Das Bausystem funktioniert vollständig im Code — noch ohne Bedienung. Portiert aus
Prototyp 01, **neu geschrieben, nicht kopiert**.

| Datei | Funktion | Zweck |
|---|---|---|
| `core/geometry.ts` | `attachTo(n, edge): { center, rotation }` | Kern des Andockens |
| | `sameEdge(a, b, eps?): boolean` | gemeinsame Kante mit Toleranz |
| | `polygonsOverlap(a, b): boolean` | Trennachsentest mit Schrumpfung |
| | `pointInPolygon(p, poly): boolean` · `pointSegmentDistance(p, edge): number` | Auswahl und Fangen |
| `sim/station.ts` | `createStation(coreId, slots): Station` | Kern im Zentrum |
| | `freeEdges(st, ignoreUid?): FreeEdge[]` | Bauplätze |
| | `previewPolygon(defId, at): { poly, center, rotation }` | Vorschau ohne Nebenwirkung |
| | `canPlace(st, defId, at, ignoreUid?): PlacementError \| null` | Prüfung |
| | `place(st, uid, at): PlacementError \| null` | Platzieren |
| | `canMove(st, uid, to): MoveError \| null` · `move(st, uid, to): void` | Umsetzen |
| | `canRemove(st, uid): RemoveError \| null` · `remove(st, uid): TowerInstance[]` | Entfernen samt Inseln |
| | `adjacency(st): Map<string, string[]>` | Kantennachbarschaft |
| | `detached(st, withoutUid?): TowerInstance[]` | Abriss-Vorschau (GDD 03 §4) |
| | `isConnected(st, withoutUid?): boolean` · `usedSlots(st): number` | Zusammenhang, Plätze |
| `sim/buffs.ts` | `computeBuffs(st): Map<string, BuffResult>` | additiv, dann gedeckelt (GDD 03 §9) |
| | `buffLinks(result): { from, to }[]` | für die Buff-Linien |
| `data/towers.ts` | `TOWERS: TowerDef[]` · `towerById(id): TowerDef` | Turmarten als Daten |

**Abnahme**

- alle Bauregeln aus GDD 03 sind im Code abgebildet
- keine Funktion in `sim/` fasst DOM oder Canvas an

**Beweis:** die 38 Zusicherungen aus Prototyp 01 laufen hier erneut — Andocken, Überlappung,
Nachbarschaft, Zusammenhang, Buff-Stapelung, Deckel, Buff-buffen-keine-Buffs, Kern wird gebufft.

---

### E3 — Basisansicht

**Ziel:** Der Spieler kann seine Station bauen. Erste echte Bedienung.

| Datei | Funktion | Zweck |
|---|---|---|
| `app/actions.ts` | `startBuild(state, uid): void` · `cancelBuild(state): void` | Bau-Modus |
| | `placeModule(state, uid, at): void` | platzieren, Ereignis melden, speichern |
| | `moveModule(state, uid, to): void` · `removeModule(state, uid): void` | umbauen |
| | `selectModule(state, uid \| null): void` · `hoverModule(state, uid \| null): void` | Auswahl und Vorschau |
| `ui/shell.ts` | `mountShell(state): void` | Bereichswechsel Kampf ↔ Basis |
| `ui/base.ts` | `renderInventory(state): void` | Liste je Turm, nicht gestapelt (GDD 13 §5) |
| | `renderModuleDetail(state): void` | `Basis → effektiv` mit Quelle, `Nachbarn n/m` |
| `render/overlays.ts` | `drawBuildHints(...)` · `drawGhost(...)` | freie Kanten, grün/rot |
| | `drawBuffLines(...)` · `drawDetachPreview(...)` | GDD 13 §12 |
| `ui/tooltip.ts` | `showTooltip(anchor, content)` · `hideTooltip()` | Hover statt Dauertext |

**Abnahme**

- Modul aus dem Inventar wählen, an eine leuchtende Kante setzen, ziehen, entfernen
- Abriss-Vorschau zeigt vor dem Klick, was mitgeht
- Buff-Linien und Effektivwerte stimmen mit `sim/buffs.ts` überein
- Layout überlebt einen Neuladen

**Beweis:** Bedienungsablauf als Skript über echte Maus-Ereignisse — platzieren, Platzlimit
ablehnen, verschieben, entfernen, Inseln wandern zurück.

---

## 6. Phase B — Kampf (E4–E9)

### E4 — Gegner und Wellen

**Ziel:** Gegner erscheinen rundum, laufen zur Station, docken an und beschädigen die
gemeinsame Stations-HP. Noch wehrt sich niemand.

| Datei | Funktion | Zweck |
|---|---|---|
| `data/enemies.ts` | `ENEMIES: EnemyDef[]` | Grundwerte je Klasse (GDD 07) |
| `sim/waves.ts` | `buildWave(waveNumber, rng): WavePlan` | dynamisch erzeugen, nicht einzeln definiert |
| | `startWave(state, waveNumber): void` | Welle beginnen, Station voll heilen |
| | `stepWave(state, dt): void` | gestaffeltes Erscheinen über die Welle |
| | `isWaveCleared(state): boolean` | alle Gegner tot, kein Zeitlimit |
| `sim/enemies.ts` | `spawnEnemy(state, defId, angle): Enemy` | aus zufälliger Richtung außerhalb des Bildes |
| | `stepEnemies(state, dt): void` | Bewegung zum nächsten Modul, dann Andocken |
| | `dockedDamage(state, dt): void` | angedockte Gegner schlagen weiter |
| | `releaseEnemy(state, e): void` | zurück in den Pool |
| `sim/combat.ts` | `damageStation(state, amount, atPos): void` | eine gemeinsame Leiste (GDD 03 §5) |
| `render/combat.ts` | `drawEnemies(...)` | Formen, Farben, HP-Balken bei starken Gegnern |

**Abnahme**

- Gegner erscheinen gestaffelt aus allen Richtungen
- sie laufen auf das *nächstgelegene Modul* zu, nicht auf den Mittelpunkt
- angedockte Gegner verursachen fortlaufend Schaden, Stations-HP sinkt
- Obergrenze gleichzeitiger Gegner wird eingehalten

**Beweis:** Welle 1 und Welle 50 erzeugen unterschiedliche, aber plausible Zusammensetzungen;
`buildWave` ist rein und mit festem Seed reproduzierbar.

---

### E5 — Türme schießen

**Ziel:** Der Kampf schließt sich: Türme wählen Ziele, schießen, treffen, töten.

| Datei | Funktion | Zweck |
|---|---|---|
| `sim/targeting.ts` | `findTarget(state, tower, mode): Enemy \| null` | Standard: nächster Gegner |
| | `TargetMode` | angedockte Gegner zuerst; Sniper stärkster, Raketen größte Gruppe, Laser Boss (GDD 05 §4) |
| `sim/projectiles.ts` | `spawnProjectile(state, from, target, spec): void` | aus dem Pool |
| | `stepProjectiles(state, dt): void` | Flug, Treffer, Durchschuss, Abpraller |
| | `releaseProjectile(state, p): void` | zurück in den Pool |
| `sim/combat.ts` | `applyDamage(state, enemy, amount, flags): void` | Krit, Elementeffekte, Widerstände |
| | `killEnemy(state, enemy): void` | Belohnung über `grantReward`, Ereignis melden |
| `sim/stats.ts` | `effectiveTowerStats(state, uid): CombatStats` | Basis × Rarität × Upgrades × Buffs |
| | `fireInterval(stats): number` | aus Angriffstempo |
| `sim/station.ts` | `stepTowers(state, dt): void` | Nachladen, Zielwahl, Schuss |
| `render/combat.ts` | `drawProjectiles(...)` · `drawHits(...)` | Geschosse und Treffer |

**Abnahme**

- Türme feuern selbstständig, nur auf Ziele in ihrer Reichweite
- Reichweite wird ab dem **eigenen Modul** gemessen (GDD 05 §4)
- Buffs wirken sichtbar auf Feuerrate und Schaden
- Gegner sterben, Ereignisse werden gemeldet

**Beweis:** ein Turm mit bekannten Werten tötet einen Gegner mit bekannter HP nach der berechneten
Zeit (±1 Tick); Pooling gibt alle Objekte zurück, kein Wachstum über die Zeit.

---

### E6 — Hauptturm und Niederlage

**Ziel:** Der Kern kämpft mit, und eine Welle kann verloren gehen — ohne Verlust von Fortschritt.

| Datei | Funktion | Zweck |
|---|---|---|
| `data/cores.ts` | `CORES: CoreDef[]` | zunächst nur Sentinel Core (GDD 04) |
| `sim/stats.ts` | `effectiveCoreStats(state): CombatStats` | eigene Werte und Upgrades |
| | `maxStationHp(state): number` | Kern + Support-Module + Upgrades + Perks |
| `sim/combat.ts` | `onStationDestroyed(state): void` | Welle verloren |
| `sim/waves.ts` | `restartWave(state): void` | Welle neu starten, nichts geht verloren (GDD 02) |
| | `healStationFull(state): void` | zu Beginn **jeder** Welle (GDD 07 §12) |
| `ui/hud.ts` | `renderStationHp(state)` · `renderWaveInfo(state)` | eine Leiste, keine HP je Modul |

**Abnahme**

- Kern schießt mit eigenen Werten
- Stations-HP auf 0 → Welle beginnt neu, Türme und Gold bleiben
- jede Welle startet mit voller HP

**Beweis:** Niederlage und Neustart verändern weder Inventar noch Gold noch Wellenrekord.

---

### E7 — Gold

**Ziel:** Gegner lassen Gold fallen, der Spieler sammelt es ein. Erste Belohnungsschleife.

| Datei | Funktion | Zweck |
|---|---|---|
| `sim/economy.ts` | `dropGold(state, pos, amount): void` | Münze auf dem Feld |
| | `mergeCoins(state): void` | dicht beieinander liegende zu Stapeln (GDD 08 §2) |
| | `collectAt(state, pos, radius): number` | Einsammeln per Hover |
| | `goldValueFor(state, enemy): number` | Wellen- und Bonusfaktoren |
| `app/rewards.ts` | `grantReward(state, { gold })` | bereits vorhanden, wird hier zuerst genutzt |
| `render/combat.ts` | `drawCoins(...)` | leuchtende Objekte, Stapel mit Gesamtwert |
| `ui/hud.ts` | `renderGold(state)` | oben rechts |

**Abnahme**

- Münzen bleiben unbegrenzt liegen, auch über Wellenwechsel
- dichte Münzen verschmelzen sichtbar zu Stapeln
- Hover sammelt ein, Zahl steigt sichtbar

**Beweis:** 500 Münzen über 20 Wellen verschmelzen auf eine handhabbare Zahl von Objekten; die
Summe des eingesammelten Goldes stimmt exakt mit der Summe der Drops überein.

---

### E8 — Upgrades

**Ziel:** Gold wird in Stärke umgesetzt. Ab hier gibt es eine Fortschrittsschleife.

| Datei | Funktion | Zweck |
|---|---|---|
| `data/balance.ts` | `upgradeCost(base, level): number` | `Basiswert × Level^1,15` (GDD 08) |
| `sim/stats.ts` | `upgradeLevel(state, path): number` | Stand je Pfad |
| | `applyUpgrades(base, levels): CombatStats` | eine Stelle für alle Multiplikatoren |
| `app/actions.ts` | `buyUpgrade(state, path): boolean` | prüft Gold, erhöht Stufe, meldet Ereignis |
| `ui/upgrades.ts` | `renderUpgradeMenu(state)` | Bereiche Hauptturm · Türme · später Fähigkeiten/Helfer |

**Wichtig:** Turm-Upgrades gelten **pro Turmtyp**, nicht pro Einzelturm (GDD 08 §5.2).

**Abnahme**

- Upgrades kosten Gold, wirken sofort und sichtbar
- Kosten steigen nach der Formel
- alle Werteberechnungen laufen durch `sim/stats.ts`, nirgends verstreut

**Beweis:** Kostenkurve stimmt mit der Formel überein; ein gekauftes Schadens-Upgrade erhöht die
Werte **aller** Türme dieses Typs.

---

### E9 — Wellensteuerung und Bosse → MVP

**Ziel:** Der Spieler steuert das Tempo. Bosse setzen Zäsuren.

| Datei | Funktion | Zweck |
|---|---|---|
| `sim/waves.ts` | `setAutoMode(state, on): void` | `(+)` im HUD |
| | `nextWave(state): void` · `previousWave(state): void` | vor und zurück |
| | `canSkipTo(state, wave): boolean` | begrenzt durch den Wellenrekord des Runs |
| | `isBossWave(wave): boolean` | alle 10 Wellen (GDD 07) |
| `sim/enemies.ts` | `spawnBoss(state, wave): Enemy` | eigene Werte und Leiste |
| `ui/hud.ts` | `renderWaveControls(state)` | `[(<) LEVEL 15 (+)(>)]` (GDD 13 §4) |
| | `renderBossBar(state)` | nur bei aktivem Boss |

**Abnahme**

- Auto-Modus startet die nächste Welle nach kurzer Pause; ausgeschaltet wartet das Spiel auf `(>)`
- Skip-Belohnungen richten sich nach der gespielten Welle, nicht nach dem Rekord
- alle 10 Wellen erscheint ein Boss mit eigener Leiste

**Beweis:** Skippen über den Rekord hinaus wird abgelehnt; Boss-Intervall stimmt über 100 Wellen.

> **Hier ist das MVP erreicht** (GDD 16 §11): Hauptturm, Wellen, automatische Angriffe, Gold,
> Upgrades, einfache Türme, Basis bauen. Ab hier lohnt sich echtes Spieltesten und das Justieren
> des Wellenfaktors gegen die 30–60-Minuten-Vorgabe (GDD 15 §3).

---

## 7. Phase C — Progression (E10–E13)

### E10 — Level und Perks ✔ erledigt

| Datei | Funktion | Zweck |
|---|---|---|
| `data/perks.ts` | `PERKS: PerkDef[]` · `perkById` | Auswahlmöglichkeiten je Levelaufstieg |
| `data/balance.ts` | `XP_BASE` · `XP_EXPONENT` · `MAX_LEVEL` · `PERK_CHOICES` | die Kurve an einem Ort |
| `sim/progression.ts` | `xpForLevel(level)` · `cumulativeXp(level)` | Kurve und Schwellen, gepuffert |
| | `levelFromXp(xp)` · `currentLevel(state)` | **abgeleitete** Stufe |
| | `pendingLevelUps(state)` · `levelProgress(state)` | offene Aufstiege, Leiste |
| | `offerPerks(rng)` · `currentOffer(state)` | drei Vorschläge, gewichtet, ohne Doppel |
| | `choosePerk(state, perkId)` · `stepProgression(state)` | annehmen, `level.up` melden |
| | `perkStatBonus` · `perkGlobalBonus` · `perkCount` | Wirkung |
| `sim/stats.ts` | `applyPerks(...)` · `globalMultiplier(state, key)` | Perks fließen in dieselbe Werte-Kette |
| `ui/dialogs.ts` | `mountDialogs(state, overlay, onChange)` | GDD 13 §6 |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| `grantXp` gibt es nicht | XP wurde bereits in E7 über `grantReward({ xp })` vergeben. Eine zweite Funktion daneben wäre ein zweiter Weg zu derselben Ressource — genau das, was `grantReward` verhindern soll. Der Perk-Bonus auf XP sitzt an der Kill-Stelle, weil er zum Töten gehört und nicht zu jeder Belohnung. |
| Stufe ist **abgeleitet**, XP wird nie verbraucht | `run.xp` ist die Gesamtsumme, `run.level` zählt nur die *abgeholten* Perks. Zwei Zahlen, die dasselbe wissen, laufen sonst auseinander: eine Belohnung, die den Aufstieg vergisst, ein Wellenneustart, der doppelt zählt. Nebenbei stapeln sich mehrere Aufstiege damit von selbst. |
| Das Angebot liegt im **Spielstand** | Läge es in den Laufzeitdaten, würfelte ein Neuladen neue Karten — eine Auswahl, die man beliebig wiederholen kann, ist keine. Dafür Speicherversion 4 samt Migration. |
| `globalMultiplier` nimmt den Zustand statt der Upgrade-Liste | Upgrades **und** Perks wirken auf dieselben globalen Größen. Prestige (E13) hängt sich an derselben Stelle an und nirgends sonst. |
| Perks ohne vorhandene Mechanik fehlen | Durchschuss, Abpraller, Verbrennung, Explosion und Kettenenergie (GDD 09 §3) brauchen `applyChain`/`applyBurn`/`applyExplosion` aus E14. Eine Karte anzubieten, die nichts tut, wäre schlimmer als eine kürzere Liste. Sie sind später **Einträge in `data/perks.ts`**, kein neuer Code. |

**Abnahme:** XP steigt durch Kills, Levelaufstieg öffnet die Auswahl, Perks wirken dauerhaft im Run. ✔
**Beweis:** `selftest/suites/progression.ts` — 24 Zusicherungen, darunter „ein Perk erscheint in
`effectiveTowerStats`, nicht als Sonderfall" und „gleiche Perks summieren sich additiv, nicht
multiplikativ".

---

### E11 — Fähigkeiten ✔ erledigt

| Datei | Funktion | Zweck |
|---|---|---|
| `data/abilities.ts` | `ABILITIES: AbilityDef[]` · `abilityById` | fünf Fähigkeiten mit vorhandener Mechanik |
| `sim/abilities.ts` | `unlockAbility(state, id)` | über Gold freigeschaltet (GDD 09 §7) |
| | `toggleEquipped(state, id)` · `slotCount(state)` | 1 Slot zu Beginn, maximal 3 |
| | `activateAbility(state, id)` · `canActivate` | nur Abklingzeit, kein Verbrauch |
| | `stepAbilities(state, dt)` | Simulationszeit, nicht Uhr |
| | `cooldownLeft` · `activeLeft` · `resetAbilities` | Anzeige und Rücksetzung |
| `sim/combat.ts` | `blastEnemies(state, center, radius, damage)` | Flächenschlag — ab E14 auch für Raketen |
| `ui/hud.ts` | Fähigkeitenleiste | Symbol, Abklingzeit, Bereitschaft |
| `ui/abilities.ts` | `mountAbilityPanel(...)` | Freischalten und Belegen im Upgrades-Bereich |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| `equipAbility(id, slot)` wurde `toggleEquipped(id)` | Ein Slot-Index als Parameter setzt eine Oberfläche voraus, die Slots einzeln anspricht. Die Karte hat einen Knopf, und der schaltet um. Sind alle Slots belegt, weicht der älteste — ein Klick soll etwas tun, statt „kein Platz" zu melden. |
| Wirkung wird **geschrieben, nicht erfragt** | `stepAbilities` legt drei fertige Zahlen in `runtime.combat`: Wertboni, Schadensabwehr, Gegnertempo. Würden `damageStation` und `stats.ts` bei den Fähigkeiten nachfragen, entstünde ein Abhängigkeitskreis zwischen drei Dateien. |
| Abklingzeiten sind **nicht** im Spielstand | Ein Cooldown über einen Programmstart hinweg mitzuführen hieße, ihn an die echte Uhr zu binden — genau das verbietet Abschnitt 3. Nach dem Laden beginnt die Welle ohnehin neu. |
| Drohnenschwarm und Plasmaexplosion fehlen | Drohnen als bewegliche Einheiten kommen laut Abschnitt E14 (`sim/drones.ts`). Die kernspezifischen Fähigkeiten aus GDD 09 §11 folgen mit den weiteren Kernen in E13. |
| Fähigkeits-**Stufen** (GDD 09 §9) fehlen noch | Freischalten, Belegen, Zünden und Abklingzeit stehen. Das Verbessern einzelner Stufen ist eine eigene Kostenkurve und gehört zum Turmkauf-/Upgrade-Ausbau — offener Punkt, siehe unten. |

**Abnahme:** Fähigkeit wirkt sofort und sichtbar, Abklingzeit läuft korrekt auch bei ×2/×4. ✔
**Beweis:** `selftest/suites/abilities.ts` — 17 Zusicherungen, darunter „die Abklingzeit läuft in
Simulationssekunden, nicht an der Uhr" und „gleiche Simulationszeit in verschieden großen Schritten
ergibt dasselbe".

---

### E12 — Turmkauf, Raritäten, Schmelzen ✔ erledigt

| Datei | Funktion | Zweck |
|---|---|---|
| `data/rarities.ts` | `TRAIT_SLOTS` · `RARITY_CHANCE` · `RARITY_RANGE` · `rarityWeights` | Fallchancen je Freischaltstand, Plätze je Stufe, Grenzen je Turmart |
| `data/traits.ts` | `TRAITS` · `traitsFor(category, tier)` | Eigenschaften nach Qualitätsstufe und Turmaufgabe |
| `sim/shop.ts` | `towerCost(state)` | Grundpreis × 1,5 je Kauf (GDD 06 §2) |
| | `rollTowerOffer(state, rng)` · `rollTraits(...)` | fertig gewürfelte Auswahlkarten |
| | `startTowerPurchase` · `takeTowerOffer` · `discardTowerOffer` | Wurf bezahlen, Karte annehmen, verwerfen |
| | `meltTowers(state, uids)` | einziger Weg, Türme abzustoßen (GDD 06 §4) |
| `sim/stats.ts` | `applyTraits(base, module)` | Eigenschaften in derselben Werte-Kette |
| `sim/buffs.ts` | `buffPowerOf(module)` | Eigenschaften eines Verstärkers wirken auf die Buffstärke |
| `ui/dialogs.ts` | Turmauswahl | große Auswahlkarten (GDD 13 §6) |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| Eigene Datei `sim/shop.ts` statt `sim/economy.ts` | `economy.ts` ist Gold **auf dem Feld** — fallen, verschmelzen, einsammeln. Der Turmkauf ist ein anderes Thema mit anderen Nachbarn (Raritäten, Eigenschaften, Prestige). Zusammen wären es zwei Systeme in einer Datei. |
| Karten sind **vor** der Wahl fertig gewürfelt | Würfelte erst der Klick, wäre die Karte eine Behauptung und die Wahl ein Blindkauf. Deshalb trägt `TowerOffer` bereits Art, Rarität und Eigenschaften — und liegt im Spielstand, damit ein Neuladen nicht neu würfelt. |
| Bezahlt wird der **Wurf**, nicht der Turm | Sonst sieht man sich Angebote an, bis eines gefällt. Der Preis steigt trotzdem erst mit der Annahme: Wer ein Angebot geworfen bekommt und das Spiel schließt, soll nicht den höheren Preis vorfinden. |
| `buffPower` als eigene Eigenschaftsart | Verstärker haben **keine eigenen Kampfwerte** — „+20 % Schaden" wäre bei ihnen wirkungslos, und ein Turm mit wirkungslosen Eigenschaften ist ein Fehler. Sie wirken deshalb dort, wo auch ihre Rarität wirkt: auf die Buffstärke. |
| Legendary und Mythic sind große Werte, keine Mechaniken | GDD 06 §10 nennt dort explodierende Projektile und Durchschuss. Beides braucht `applyExplosion`/`applyChain` aus E14. Später sind es weitere Einträge in `data/traits.ts`. |

**Abnahme:** Kauf, Rarität, Eigenschaften und Schmelzen greifen ineinander; kein Verkauf gegen Gold. ✔
**Beweis:** `selftest/suites/shop.ts` — 21 Zusicherungen, darunter „die Reihe entspricht der Tabelle
des GDD" (100/150/225/338), „die Anzahl der Eigenschaften folgt der Rarität", „ohne freigeschaltete
Eigenschaften bleiben die Plätze leer" und „geschmolzene Türme sind endgültig weg".

---

### E13 — Prestige ✔ erledigt

| Datei | Funktion | Zweck |
|---|---|---|
| `data/prestige.ts` | `PRESTIGE_NODES` · `nodesOfArea` | Baum mit Kosten und Voraussetzungen |
| `sim/prestige.ts` | `prestigePoints(state)` · `canPrestige(state)` | aus Wellenrekord und verdientem Gold |
| | `doPrestige(state, coreId?)` | Run **ersetzen**, permanente Daten behalten |
| | `buyNode(state, nodeId)` · `isAvailable` | Punkte ausgeben, Voraussetzungen prüfen |
| | `isUnlocked(state, id)` | **Datenabfrage**, keine Codeverzweigung |
| | `unlockedRarity` · `unlockedTraitTier` · `towerSlots` · `abilitySlots` · `availableSpeeds` | die eine Auskunftsstelle für Freischaltungen |
| | `prestigeGlobalBonus` · `syncUnlocks` | Faktoren in die Werte-Kette, Grenzen in den Run |
| `app/rewards.ts` | `spendPrestigePoints(state, amount)` | Gegenstück zu `spendGold` |
| `ui/prestige.ts` | `mountPrestigePanel(...)` | gesperrt/verfügbar/gekauft über Farbe |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| `doPrestige` **ersetzt** `run`, statt Feld für Feld zurückzusetzen | Eine Liste zurückzusetzender Felder müsste bei jedem neuen Feld gepflegt werden — und genau das vergisst man. Was neu entsteht, kann nicht vergessen werden. Dasselbe gilt für `runtime`. |
| `applyPrestige` wurde `prestigeGlobalBonus` | Der Baum verändert heute keine Kampfwerte einzelner Türme, sondern globale Größen (Gold, XP) und Grenzen (Slots, Tempo). Eine Funktion, die Kampfwerte anfasst, gäbe es also ohne Wirkung. Kommt sie, hängt sie an derselben Stelle wie Perks. |
| Punkte laufen über `grantReward` / `spendPrestigePoints` | Der Querschnittstest hat es beim ersten Lauf gemeldet: Prestige-Punkte sind eine Ressource wie Gold. Jetzt gibt es genau eine Datei, in der sich Ressourcen ändern. |
| Kernwahl fehlt | Es gibt bisher genau **einen** Kern (Sentinel). Eine Auswahl mit einer Karte wäre eine Zwischenseite ohne Entscheidung. `doPrestige` nimmt den Kern bereits als Parameter, das Fenster kommt mit den weiteren Kernen in E14. |
| Bereiche Spezialtürme, Haupttürme, Helfer, Basis fehlen | Sie schalten Inhalte frei, die es noch nicht gibt (E14, E17). Ein Knoten, der Punkte kostet und nichts freischaltet, wäre Betrug am Spieler. |

**Abnahme:** Prestige setzt genau die Run-Daten zurück (GDD 16 §8), Punkte und Freischaltungen bleiben. ✔
**Beweis:** `selftest/suites/prestige.ts` — 19 Zusicherungen. Die beiden Kernabsicherungen gehen
**Feld für Feld** durch `run` und `permanent` und prüfen jedes einzeln gegen „wird zurückgesetzt"
bzw. „bleibt" — nicht stichprobenartig. Dazu kommt: die Laufzeitdaten gehen mit dem Run, der
Bestwert fällt nie, und gekaufte Turmplätze überleben das Zurücksetzen.

---

## 8. Phase D — Ausbau (E14–E18)

Ab hier ist die Architektur fertig. Die meisten Schritte sind **neue Datensätze**, kein neuer Code —
genau das war das Ziel von GDD 16 §5.

### E14 — Turminhalte ✔ erledigt

Zehn neue Turmarten aus GDD 05: Marksman, Rocket Battery, Laser Lance, Tesla Coil, Flame Projector,
Cryo Emitter, Shield Generator, Plasma Cannon, Void Sphere, Drone Bay.

| Datei | Funktion | Zweck |
|---|---|---|
| `data/towers.ts` | `TowerMechanic` | die Spezialmechanik als Datensatzfeld — ohne Angabe: gewöhnliches Geschoss |
| `sim/combat.ts` | `applyExplosion(state, center, radius, damage, except?)` | Rakete, Plasma, Volatile-Elite |
| | `applyChain(state, from, hops, falloff, damage, range)` | Tesla |
| | `applyBurn(state, enemy, dps, duration)` | Flammen |
| | `applyChill(state, enemy, factor, duration)` | Eis und Void |
| | `spawnBeam(...)` · `stepEnemyStates(...)` | Dauerstrahl, Altern von Brand und Frost |
| `sim/projectiles.ts` | `ProjectilePayload` · `impact(...)` | das Geschoss trägt mit, was beim Einschlag passiert |
| `sim/drones.ts` | `stepDrones(state, dt)` | belegen keinen Platz, sind nicht angreifbar (GDD 03 §6) |
| `sim/stats.ts` | `hullFromModules(state)` | der Schildgenerator, der als einziger nicht schießt |
| `data/prestige.ts` | Bereich `tech` | Raketen 150, Laser 250, Tesla 500, Drohnen 2.000, Plasma 10.000 |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| `spawnDrone` gibt es nicht — Drohnen sind **abgeleitet** | Gespeicherte Drohnen müssten bei jedem Umbau mit der Station abgeglichen werden, und genau dort entstehen Karteileichen. `stepDrones` zieht sie je Takt aus den vorhandenen Modulen nach: Modul weg, Drohnen weg. Es gibt keinen Zustand, der auseinanderlaufen kann. |
| Die Wirkung hängt am **Geschoss**, nicht am Turm | Wenn eine Rakete einschlägt, kann ihr Turm längst abgerissen sein. Ein Geschoss trägt deshalb seine Explosion selbst mit — dieselbe Überlegung wie bei Schaden und Farbe. |
| Der Laser trifft sofort statt mit Geschoss | Ein „Dauerstrahl" mit Flugzeit wäre ein Widerspruch. Er wird als kurzlebige Linie abgelegt; bei sechs Schuss je Sekunde ergibt das den durchgehenden Strahl aus dem GDD. |
| Element-Türme sind keine eigene Kategorie | GDD 05 nennt Feuer, Eis, Blitz, Plasma. Alle vier sind vorhandene Mechaniken mit anderen Zahlen — Feuer = `burn`, Eis = `chill`, Blitz = `chain`, Plasma = `explosive`. Sie wären reine Datensätze und stehen deshalb erst an, wenn sie sich von den bestehenden Türmen unterscheiden. |
| Legendary-Eigenschaften bleiben große Werte | Durchschuss und explodierende Projektile aus GDD 06 §10 wären jetzt möglich — sie brauchen aber einen Eigenschaftstyp, der eine Mechanik anhängt statt einen Wert. Offener Punkt, siehe unten. |

**Abnahme:** jede neue Turmart ist über einen Datensatz plus höchstens eine Mechanikfunktion erledigt. ✔
**Beweis:** `selftest/suites/content.ts` — der Marksman ist der Beleg: extreme Reichweite, eigene
Zielpriorität, **keine** Mechanikfunktion. Dazu Zusicherungen je Mechanik, darunter „das getroffene
Ziel bekommt den Flächenschaden nicht doppelt" und „ein Kettenblitz trifft niemanden zweimal".

---

### E15 — Gegnerinhalte ✔ erledigt

Acht Spezialgegner, zwei Belohnungsgegner, sechs Elite-Modifikatoren und vier weitere Bosse.

| Datei | Funktion | Zweck |
|---|---|---|
| `data/enemies.ts` | `EnemyAbility` | Schild, Reflektor, Berserker, Heiler, Verstärker, Tarnung, Teleport, Beschwörung |
| | `ELITE_MODIFIERS` · `eliteById` | Swift, Reinforced, Regenerating, Volatile, Bullion, Archive |
| | `bossForWave(wave)` | der höchste zuständige Boss löst seinen Vorgänger ab |
| `sim/enemies.ts` | `stepEnemyAbilities(state, dt)` | **eine** Schleife für alle Fähigkeiten |
| | `maybeMakeElite` · `applyEliteModifier` · `eliteChance` | Chance steigt mit der Welle, ab Welle 50 |
| `sim/combat.ts` | Schild und Reflektor in `applyDamage`, `berserkFactor` in `dockedDamage` | Verteidigung als Feld, nicht als Fallunterscheidung |
| `sim/targeting.ts` | eine Zeile für die Tarnung | wer getarnt ist, ist kein Ziel |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| Eine gemeinsame Uhr je Gegner statt einer je Fähigkeit | Zwei Uhren wären zwei Felder mehr im Pool und ein Fehler mehr beim Zurücklegen. Ein Gegner mit zwei getakteten Fähigkeiten führt sie im Gleichschritt aus — bei höchstens drei Fähigkeiten je Gegner ist das nicht zu bemerken. |
| Getarnte Gegner werden durchscheinend, nicht unsichtbar | Regelgetreu wäre unsichtbar, spielbar ist es nicht: Der Spieler sähe einen Gegner aus dem Nichts an seiner Station stehen. Ein Schemen sagt „der ist da, deine Türme sehen ihn nicht" — und **die Türme** ignorieren ihn wirklich. |
| Bosse werden keine Elites | Ein Boss ist bereits die Zäsur der Welle. Ihn zusätzlich zu verstärken macht ihn nicht interessanter, nur länger. |
| Flieger fehlen | GDD 07 §5 nennt sie „bewegt sich unabhängig vom Boden". Es gibt keinen Boden — alle Gegner laufen frei auf die Station zu. Der Gegner wäre von einer Standard-Drohne nicht zu unterscheiden. |

**Abnahme:** neue Gegner erfordern keine Änderung am Kampfkern. ✔
**Beweis:** `selftest/suites/content.ts` — 30 Zusicherungen. Darunter der wichtigste Fall: „ein
Gegner aus dem Pool erbt nichts von seinem Vorgänger". Der Test zum Verstärker hat außerdem einen
echten Fehler gefunden — die Deckelung verglich den Schaden gegen sich selbst und war damit nie
wirksam; zwei Verstärker trieben den Schaden ins Astronomische.

---

### E16 — Ereignisse und Versorgungskapseln ✔ erledigt

Vier Ereignisse aus GDD 11 §5 und §6, fünf Kapselarten aus §8.

| Datei | Funktion | Zweck |
|---|---|---|
| `data/events.ts` | `EVENTS` · `PODS` | Risiko- und Entscheidungsereignisse, Kapselarten |
| | `EventEffect` | vier Wirkungsarten: Belohnung, Bonus, Verstärkung, zusätzliche Gegner |
| `sim/events.ts` | `maybeTriggerEvent(state, rng)` | alle 15–25 Wellen, Abstand gewürfelt |
| | `resolveEvent(state, choiceId)` | Belohnung über `grantReward`, Wirkungen in Datensatzreihenfolge |
| | `stepEvents(state, dt)` | Wirkungen altern, `eventBonus` und `enemyPower` neu aufbauen |
| | `dropPod` · `collectPod` · `collectPodsAt` · `maybeDropPod` | Kapseln |
| `data/trader.ts` | `TRADER_STOCK` | zehn Warenposten, aus denen drei gezogen werden |
| `sim/trader.ts` | `maybeSendTrader` · `stepTrader` · `reachTraderAt` | landen, Frist, erreichen |
| | `buyFromTrader` · `dismissTrader` | kaufen und weiterschicken |
| `sim/combat.ts` | `maybeDropPod` in `killEnemy` | Drop-Chance am Gegner, nicht an der Welle |
| `sim/shop.ts` | `rollTowerOffer(..., floor?)` | die seltene Turmkapsel hebt die Untergrenze |
| `sim/progression.ts` | `grantPerk(state, perkId)` | ein Perk ohne Aufstieg — die Drohne verkauft ihn |
| `render/combat.ts` | `drawPods(...)` · `drawTrader(...)` | Sechseck bzw. Raute mit Fristring |
| `ui/dialogs.ts` | Ereignis- und Händlerfenster | Entscheidung mit klaren Folgen |

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| Ereignisse werden aus `sim/battle.ts` ausgelöst, nicht aus `sim/waves.ts` | `sim/events.ts` braucht `spawnEnemy` und die Wellenzahl; riefe die Wellensteuerung ihrerseits die Ereignisse, entstünde ein Kreis. `battle.ts` bindet ohnehin alles zusammen und wird von niemandem in `sim/` eingebunden — es ist der einzige Ort, der beide kennen darf. |
| Ereignisse schreiben **eigene** Felder (`eventBonus`, `enemyPower`) statt in die der Fähigkeiten | Ein Feld darf nur einen Schreiber haben. Beide Systeme bauen ihre Zahlen je Takt neu auf; schrieben sie dasselbe Feld, überschriebe der spätere den früheren, und welcher gewinnt, hinge an der Reihenfolge in `battle.ts`. Getrennt geschrieben, in `sim/stats.ts` gemeinsam gelesen — die beiden Quellen setzen dort nacheinander auf, so wie Buffs auf Upgrades. |
| Die Verstärkung wirkt beim **Erscheinen**, nicht laufend | Ein Gegner, dessen Lebenspunkte sich mitten im Kampf ändern, ist nicht zu lesen — seine Leiste spränge. |
| Der Wert einer Kapsel entsteht beim **Einsammeln**, nicht beim Fallen | Sonst wäre eine liegen gebliebene Kapsel eine Falle, und der Spieler müsste jede sofort holen. Genau das soll das freie Einsammeln nicht sein (GDD 08 §2). |
| Die Händler-Drohne **landet in der Arena** und ist kein Menüpunkt | GDD 11 §7 sagt es nebenbei, und es ist das Prägende: Wer bei ihr kaufen will, muss hinfahren, während die Welle läuft. Aus einem Laden wird dadurch eine Entscheidung. |
| Ihre Uhr steht still, sobald der Spieler sie erreicht | Ein Laden, der während des Einkaufs abhebt, wäre keine Gelegenheit, sondern eine Falle. |
| Sie erfindet **keine** Wirkung | Alle vier Warenarten aus GDD 11 §7 gibt es schon: globales Upgrade (E8), zeitlich begrenzter Bonus (E16), Perk (E10), Turmangebot (E12). Genau deshalb war sie vorher ein offener Punkt und ist jetzt ein Datensatz — früher hätte sie vier eigene Mechaniken gebraucht. |
| Sie steht neben dem Turmkauf, statt ihn zu ersetzen | Der Turmkauf verkauft **einen Wurf** zu einem Preis, der mit jedem Kauf steigt; die Frage ist "noch ein Turm oder Gold in die vorhandenen?". Die Drohne verkauft **fertige Ware** zu einem Preis, der mit der Welle steigt, und nicht nur Türme; die Frage ist "was von diesen drei Dingen brauche ich gerade?". Zwei verschiedene Entscheidungen — beide dürfen stehen. |
| Ein gekaufter Bonus läuft über **dieselbe** Leiste wie ein Ereignis-Bonus | Zwei Systeme mit eigenen Boni hätten zwei Uhren, zwei Ablaufregeln und zwei Stellen, an denen einer hängen bleiben kann. |

**Abnahme:** ein neues Ereignis ist ein Datensatz. ✔
**Beweis:** `selftest/suites/encounters.ts` — die wichtigsten Zusicherungen laufen über die
**vollständige** Tabelle: *jede* Option *jedes* Ereignisses wird gewählt und muss durchgehen,
und *jede* Warenart der Drohne muss die Größe verändern, die sie verspricht. Ein neuer Eintrag
ist damit automatisch mitgeprüft, ohne dass jemand einen Test schreibt.

---

### E17 — Offline-Fortschritt und Helfer ✔ erledigt

| Datei | Funktion | Zweck |
|---|---|---|
| `sim/offline.ts` | `simulateOffline(state, seconds, view)` | **dieselbe** Logik im Schnelldurchlauf |
| | `capOfflineTime(seconds)` · `offlineEfficiency(state)` | Obergrenze und Wirkungsgrad |
| `sim/helpers.ts` | `stepHelpers(state, dt)` | Goldsammler (GDD 12 §11) |
| | `collectorLevel` · `helperCount` · `helperRadius` · `helperSpeed` | zweistufige Freischaltung als Datenabfrage |
| `sim/economy.ts` | `collectAll(state)` | das Feld abräumen — nur für die Abwesenheit |
| `data/prestige.ts` | Bereiche `economy` und `helpers` | Offline 100/500, Sammler 500/2.000/5.000/15.000 |
| `data/upgrades.ts` | `unlock?` am Pfad | der Sammler erscheint erst nach dem Prestige-Knoten |
| `ui/dialogs.ts` | Rückkehr-Zusammenfassung | Zeit, Wellen, Gegner, Gold, XP, Level |

**Warum das erst hier geht:** Die Offline-Simulation setzt voraus, dass die gesamte Kampf- und
Wirtschaftslogik ohne Browser lauffähig ist. Wer das früher baut, baut eine zweite, abweichende
Simulation — der klassische Fehler in Idle-Spielen.

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| Der Wirkungsgrad sitzt an der **Zeit**, nicht an der Belohnung | GDD 12 §7 verlangt, dass Offline nie stärker ist als aktives Spielen. Kürzt man die Zeit, fällt alles gleichmäßig geringer aus — Gold, Erfahrung, Wellenfortschritt — und die Belohnungsrechnung braucht keinen zweiten Weg. Kürzt man die Belohnung, muss jede künftige Ertragsart daran denken. |
| Der Takt ist gröber (20 Hz statt 60) | Nachweislich harmlos: Geschosse treffen, sobald sie ihr Ziel im Schritt erreichen *würden* — sie können nicht daneben fliegen —, und Türme feuern mehrfach je Takt, wenn ihr Tempo über der Taktrate liegt. Gemessen laufen 60 Hz und 20 Hz über zehn Minuten um höchstens eine Welle auseinander; das ist als Zusicherung festgehalten. |
| Ein **Taktbudget** statt unbegrenzter Rechnung | Die Rechnung läuft vor dem ersten Bild. Reicht das Budget nicht, wird der Schritt gröber statt die Zeit gekürzt: Der Spieler bekommt seine ganze Abwesenheit angerechnet, ungenauer wird nur die Auflösung. Andersherum bekäme er weniger und merkte es nicht einmal. |
| Offline entstehen **keine optischen Effekte**, und Gold wird direkt gutgeschrieben | Beides steht so im GDD (12 §3), und beides ist zugleich der Unterschied zwischen zwei Sekunden und vierzig: Zehntausende Gegner erzeugten sonst je sechs Splitter, eine Druckwelle, zwei Goldfunken und eine Münze, die mit allen anderen verdichtet werden will. Der Schalter dafür heißt `observed` und wird im `finally` zwingend zurückgenommen. |
| Die Obergrenze steht bei **vier** Stunden, nicht acht | An der Messung entstanden, nicht am Gefühl: Ein voller Deckel kostet 1,9 bis 2,7 Sekunden, in denen das Fenster steht. Acht Stunden wären das Doppelte — und vier Sekunden Stillstand vor dem ersten Bild sind keine Belohnung mehr. |
| Nur **ein** Helfer | GDD 12 §12 nennt Reparatur-, Wartungs- und Forschungsdrohne als „weitere mögliche". Der Goldsammler ist der einzige, den das GDD ausführt; die anderen sind Ideen ohne Zahlen. Sie sind später Einträge in `sim/helpers.ts` und im Baum. |
| Helfer sind abgeleitet wie Drohnen, behalten aber ihren Ort | Ihre Anzahl folgt der gekauften Stufe und wird je Takt nachgezogen — ein Helfer, den es nicht mehr geben darf, verschwindet von selbst. Der Ort dagegen muss bleiben: Eine Fahrt ohne Ausgangspunkt wäre ein Sprung. |

**Abnahme:** eine Stunde offline liefert (bis auf Zufall) dasselbe Ergebnis wie eine Stunde im
Vordergrund bei ×1. ✔
**Beweis:** `selftest/suites/idle.ts` — verglichen wird gegen einen **Vordergrundlauf**, nicht
gegen eine erwartete Zahl. Eine erwartete Zahl wäre eine zweite Rechnung neben der Simulation,
und der ganze Sinn dieser Etappe ist, dass es keine zweite gibt. Eine eigene Zeile stellt
sicher, dass der Vergleich nicht vergleicht, dass beide Seiten nichts getan haben.

---

### E18 — Politur ✔ erledigt

| Bereich | Umsetzung |
|---|---|
| Effekte | standen bereits (E4–E15): Mündungsfeuer, Rückstoß, Splitter, Druckwellen, Laser, Buff-Linien, Trefferblitze. E18 hat sie **abschaltbar** gemacht und die beiden fehlenden ergänzt |
| Prestige | `surgeStation` in `sim/combat.ts` (sechs gestaffelte Ringe im Feld) plus `ui/surge.ts` (ein Blitz über dem ganzen Fenster) |
| Platzieren | `placeFlash` in `sim/combat.ts` vermerkt den Augenblick, `render/station.ts` macht daraus das Einrasten des Moduls und einen auslaufenden Ring |
| Hinweise | `sim/hints.ts` + `ui/hints.ts` — die acht Hinweise aus GDD 14 §4a, wegklickbar, ohne Pause, zurücksetzbar |
| Einstellungen | `app/settings.ts` + `ui/settings.ts` — Tempo, Buff-Linien, Effekte, Bewegung, Lautstärke, Hinweise, Kamera |
| Audio | `app/audio.ts` — ein Zuhörer am Ereignisbus, 18 Ereignisse, Mindestabstand je Klangart, höchstens 16 Stimmen |
| Leistung | gemessen, Ergebnis samt Tabelle in `data/balance.ts` bei den Obergrenzen |

**Die Leistungsmessung** (60 Simulationssekunden je Welle, volle Station aus sieben mythischen
Türmen, Upgrades am Anschlag):

| Welle | Gegner | Geschosse | Münzen | je Takt |
|---|---|---|---|---|
| 50 | 43 | 28 | 67 | 37 µs |
| 200 | 57 | 48 | 0 | 36 µs |
| 500 | 98 | 44 | 0 | 42 µs |
| 1.000 | 178 | 43 | 0 | 52 µs |

Der **Gegnerdeckel** ist der einzige, der wirklich greift — auf Welle 1.000 stauen sich 178
Gegner an der Station. Genau dafür ist er da; er bleibt bei 200. Der **Geschossdeckel** ist mit
600 gegen gemessene 48 reichlich bemessen und bleibt trotzdem stehen: Er kostet nichts und fängt
eine spätere Station mit mehr Turmplätzen ab. Bei Tempo ×4 kostet die Simulation 9 bis 13 ms je
Sekunde — sie ist also auch im schlimmsten gemessenen Fall nicht der Flaschenhals.

**Abweichungen vom Plan, mit Begründung**

| Punkt | Entscheidung |
|---|---|
| Klänge sind **gerechnet**, nicht geladen — bis auf zwei | Ein Klangapparat aus Oszillatoren braucht keine Dateien und keine Ladezeit und lässt sich in Tonhöhe und Länge genau an das Ereignis anpassen. Die Ausnahme sind die beiden Aufhebe-Klänge aus dem mitgelieferten Münzpaket: Es ist der Ton, den der Spieler hundertmal je Welle hört, und ein gerechneter Piepton wird dort schnell lästig. |
| Keine Sprachwahl | Es gibt genau eine Sprache. Ein Schalter mit einer Stellung wäre schlimmer als keiner. Sie kommt, wenn eine zweite Tabelle in `data/strings.ts` steht. |
| Einstellungen liegen **nicht** im Spielstand | Lautstärke, Effektstufe und Bewegungsdämpfung sagen etwas über das Gerät aus, nicht über den Fortschritt. Ein Spielstand, der später auf ein anderes Gerät wandert, soll dessen Regler nicht überschreiben. Eigene Ablage in `app/settings.ts`. |
| „Effekte aus" schaltet nur Zierde ab, nicht Auskunft | Trefferblitze, Gegner, Geschosse, Münzen und Kapseln bleiben in jedem Fall. Ein Schalter, der die Spielsicht beschneidet statt sie zu beruhigen, wäre ein Nachteil und keine Einstellung. |
| Die Prestige-Animation liegt auf **zwei** Ebenen | Ein Prestige setzt nicht die Station zurück, sondern den Run — und der Run ist alles, was man sieht. Deshalb laufen Ringe über das Feld *und* ein Blitz über die Oberfläche. Nur eines von beidem wäre die halbe Aussage. |
| Sie wird **nach** dem Zurücksetzen ausgelöst | `doPrestige` ersetzt die Laufzeitdaten vollständig. Ein Ring, den man vorher hineinlegte, wäre mit ihnen verworfen — und der Fehler fiele am Bild nicht auf, weil das Bild dann eben leer ist. Eine eigene Zusicherung hält das fest. |
| Das Modul rastet **von groß** ein, nicht von klein | Von klein aufzuwachsen sieht aus, als entstünde das Modul; von groß einzurasten sieht aus, als **käme** es an — und genau das ist passiert. Der Ring läuft dabei linear aus, während das Modul quadratisch einrastet: So verlässt er es sichtbar, statt mit ihm zusammen stehen zu bleiben. |
| Der Andockring liegt **nicht** im Vorrat der Druckwellen | Er passte dort hinein, aber Druckwellen werden nur gezeichnet, wo der Kampf zu sehen ist — und gebaut wird in der Basis. Ein Ring, den man beim Bauen nicht sieht, ist kein Bauring. |

**Nebenbefund 1:** Der Prestige-Baum zeigte die Bereiche **Spezialtürme** (aus E14) gar nicht an —
die Bereichsliste in `ui/prestige.ts` war seit E13 unverändert. Fünf gekaufte Knoten waren damit
unerreichbar. Die Liste ist jetzt vollständig und im Selbsttest gegen den Datensatz abgesichert.

**Nebenbefund 2 — der teuerste Fehler dieser Etappe:** Der Prestige-Blitz liegt als Schleier über
der ganzen Fläche und hatte `pointer-events: none` sauber im Stilblatt stehen. Wirkungslos: Die
Regel `#overlay > *` zählt als Kennung (1-0-0) und schlägt jede Klassenregel (0-1-0). Ab da
schluckte ein unsichtbarer Schleier jede Zeigerbewegung, und **das Einsammeln von Gold war tot** —
die zentrale aktive Handlung des Spiels (GDD 08 §2).

Am Bild ist so etwas nicht zu finden: Alles sieht richtig aus, und im Stilblatt steht die richtige
Zeile. Der Sammelwähler heißt jetzt `:where(#overlay) > *` und zählt damit null — er wirkt
weiterhin auf jedes Kind, lässt sich aber von einer gewöhnlichen Klassenregel überschreiben, also
genau so, wie es jeder erwartet, der eine neue Anzeige dazulegt. Eine **Querschnittsregel** in
`selftest/guards.ts` hält das fest; sie hätte den Fehler gefunden, bevor er das Spiel erreicht.

---

## 9. Querschnittsregeln

Diese gelten in **jeder** Etappe und sind Teil der Abnahme:

| Regel | Prüfung |
|---|---|
| `sim/` und `core/` fassen kein DOM und kein Canvas an | Suche nach `document`/`canvas` in beiden Ordnern muss leer sein |
| Kein direkter Zugriff auf `Date.now()`/`performance.now()` außerhalb von `core/loop.ts` | Suche |
| Kein `Math.random()` außerhalb von `core/rng.ts` | Suche |
| Belohnungen entstehen nur in `grantReward` | Suche nach `state.gold +=` außerhalb von `app/rewards.ts` |
| Zahlen im Code stehen in `data/`, nicht in `sim/` | Sichtprüfung beim Durchgang |
| Jeder Spielertext kommt aus `data/strings.ts` | Suche nach Zeichenketten in `ui/` |
| Die Overlay-Ebene reißt den Zeiger nicht an sich | `:where(#overlay) > *` statt `#overlay > *` — sonst schlägt der Sammelwähler jede Klassenregel, und eine ganzflächige Anzeige schluckt das Einsammeln von Gold |
| Neue Regeln bekommen eine Zusicherung im Selbsttest | Test läuft mit |
| Nach jeder Etappe: `typecheck` sauber, Selbsttests grün, Spielstand lädt noch | vor dem nächsten Schritt |

**Spielstand-Migration:** Ab E0 hat jeder Spielstand eine Version. Wer ein Feld hinzufügt, erhöht
die Version und schreibt eine Migration — auch während der Entwicklung. Sonst ist jeder Testspielstand
nach jeder Etappe wertlos, und man testet nur noch mit frischen Spielständen.

---

## 10. Was bewusst *nicht* früh gebaut wird

| Nicht früh | Warum |
|---|---|
| Eigener Zahlentyp (Mantisse/Exponent) | löst ein Problem, das erst um Welle 7.400 einträte (Abschnitt 3) |
| Offline-Simulation | braucht die fertige Kampflogik, sonst entsteht eine zweite abweichende Simulation (E17) — **hat sich bestätigt:** `sim/offline.ts` ruft `stepBattle` und ist 130 Zeilen lang, weil die Logik schon dastand |
| Audio | nur Anschlusspunkte ab E0, Klänge zuletzt (GDD 13 §11) — **hat sich bestätigt:** `app/audio.ts` hängt sich an 18 vorhandene Ereignisse und ändert an der Spiellogik keine Zeile |
| Viele Turm- und Gegnerarten | erst wenn ein Datensatz genügt; vorher wird jede Variante dreimal umgebaut |
| Sparsame Neuberechnung von Buffs | vollständige Neuberechnung kostet unter 1 ms und ist fehlerfrei (GDD 03 §10) |
| Weltkarte, Menüstruktur über das Nötige hinaus | GDD 13 §3 sieht feste Bereiche vor, mehr braucht es nicht |
| Monetarisierung | nur die Vorkehrungen aus GDD 16 §2, nichts Sichtbares |

---

## Offene Punkte, die dieser Plan nicht entscheidet

| Punkt | Wann zu klären |
|---|---|
| Wellenfaktor, Turm-Basiswerte, XP-Kurve, Prestige-Formel, Drop-Chancen | nach E9 am laufenden Spiel (GDD 15 §16) |
| Fähigkeits-Stufen (GDD 09 §9): eigene Kostenkurve oder Pfade im Upgrade-Menü? | offen geblieben — der Turmkauf hat die Frage nicht mit beantwortet, weil er keine Stufen kennt |
| Wie oft ein Levelaufstieg fallen darf, ohne zu stören | beim Justieren der XP-Kurve — das Auswahlfenster hält die Bedienung des Feldes an |
| Prestige-Punkteformel gegen die Wellenkurve | mit dem Balancing nach E9. Heute: Welle 500 ergibt 123 Punkte, das GDD nennt 50–100 |
| Kernwahl und weitere Haupttürme (GDD 04, GDD 10 Bereich 5) | offen geblieben — E14 hat nur Türme gebracht, keine Kerne. Es gibt weiterhin genau einen |
| Eigenschaften, die eine **Mechanik** anhängen (GDD 06 §10: Durchschuss, explodierende Projektile) | jetzt möglich, da die Mechaniken stehen. Braucht einen zweiten `TraitEffect`-Typ |
| Werte der neuen Türme und Gegner gegeneinander | mit dem Balancing nach E9 — bisher sind es begründete Annahmen, kein gemessenes Kräfteverhältnis |
| ~~Zeichenbudget: maximale Gegner und Geschosse~~ | **erledigt in E18** — gemessen, Tabelle steht in `data/balance.ts`. Der Gegnerdeckel greift ab Welle 1.000, der Geschossdeckel ist reichlich |
| ~~Händler-Drohne (GDD 11 §7)~~ | **erledigt** — die Frage war, worin sich ihr Sortiment vom Turmkauf unterscheidet. Antwort: Sie verkauft nicht nur Türme, sondern fertige Ware aus vier vorhandenen Systemen, und ihr Preis hängt an der Welle statt an der Zahl gekaufter Türme |
| Weitere Helfer (GDD 12 §12: Reparatur, Wartung, Forschung) | offen geblieben — das GDD führt nur den Goldsammler aus, die anderen sind Ideen ohne Zahlen |
| ~~Prestige-Animation (GDD 13 §10)~~ | **erledigt** — `surgeStation` im Feld plus `ui/surge.ts` über dem Fenster |
| ~~Platzierungsanimation (GDD 13 §10)~~ | **erledigt** — das Modul rastet von groß ein, ein Ring läuft über die Nachbarn hinweg. Damit ist die Effektliste aus GDD 13 §10 vollständig |
| Balancing der Ereignis-, Kapsel- und Handelswerte | mit dem Balancing nach E9. Heute hängt alles drei an `EVENT_REWARD_BASE` und wächst mit derselben Kurve wie die Gegnerbelohnung — begründet, aber nicht gemessen. Besonders offen: ob die Drohne mit dem Turmkauf um dasselbe Gold konkurrieren darf |
| Zweite Sprache | die Sprachwahl in den Einstellungen fehlt bewusst, solange es nur eine Tabelle in `data/strings.ts` gibt |
| Baugefühl, Formunterscheidbarkeit, Buff-Linien, Wirkung der Keile | Urteil am Bild — offen aus [Prototyp 01](../prototypes/01-tower-building/README.md#ergebnis) |
