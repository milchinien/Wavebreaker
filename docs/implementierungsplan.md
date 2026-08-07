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

### E10 — Level und Perks

| Datei | Funktion | Zweck |
|---|---|---|
| `data/perks.ts` | `PERKS: PerkDef[]` | Auswahlmöglichkeiten je Levelaufstieg |
| `sim/progression.ts` | `grantXp(state, amount): void` | über `grantReward` |
| | `xpForLevel(level): number` | Kurve aus `data/balance.ts` |
| | `pendingLevelUps(state): number` | mehrere Aufstiege stapeln sich |
| | `offerPerks(state, rng): PerkDef[]` | drei Vorschläge |
| | `choosePerk(state, perkId): void` | anwenden und vermerken |
| `sim/stats.ts` | `applyPerks(...)` | Perks fließen in dieselbe Werte-Kette |
| `ui/dialogs.ts` | `showLevelUpDialog(state, options)` | GDD 13 §6 |

**Abnahme:** XP steigt durch Kills, Levelaufstieg öffnet die Auswahl, Perks wirken dauerhaft im Run.
**Beweis:** Perk-Effekte erscheinen in `effectiveTowerStats`, nicht als Sonderfall im Kampfcode.

---

### E11 — Fähigkeiten

| Datei | Funktion | Zweck |
|---|---|---|
| `data/abilities.ts` | `ABILITIES: AbilityDef[]` | allgemeine plus kernspezifische |
| `sim/abilities.ts` | `unlockAbility(state, id): void` | über Gold-Upgrade freigeschaltet |
| | `equipAbility(state, id, slot): void` | 1 Slot zu Beginn, maximal 3 |
| | `activateAbility(state, id): boolean` | nur Abklingzeit, kein Verbrauch (GDD 09 §7) |
| | `stepCooldowns(state, dt): void` | laufen mit der Simulationszeit, nicht mit der Uhr |
| `ui/hud.ts` | `renderAbilityBar(state)` | Symbol, Abklingzeit, Bereitschaft |

**Abnahme:** Fähigkeit wirkt sofort und sichtbar, Abklingzeit läuft korrekt auch bei ×2/×4.
**Beweis:** Abklingzeit in Simulationssekunden, nicht in Echtzeit — bei ×4 vergeht sie viermal so schnell.

---

### E12 — Turmkauf, Raritäten, Schmelzen

| Datei | Funktion | Zweck |
|---|---|---|
| `data/rarities.ts` | `RARITIES` · `TRAITS` | Farben, Multiplikatoren, Eigenschaften |
| `sim/economy.ts` | `towerCost(state): number` | Grundpreis × 1,5 je Kauf (GDD 06) |
| | `rollTowerOffer(state, rng): TowerOffer[]` | Auswahlkarten statt Zufallszuteilung |
| | `buyTower(state, offerIndex): boolean` | erzeugt Instanz mit Rarität und Eigenschaften |
| | `rollTraits(defId, rarity, rng): Trait[]` | 0/1/2/3/4 nach Rarität (GDD 06 §10) |
| | `meltTowers(state, uids): MeltResult` | einziger Weg, Türme abzustoßen (GDD 06 §4) |
| `ui/dialogs.ts` | `showTowerPurchase(state, offers)` | große Auswahlkarten (GDD 13 §6) |

**Abnahme:** Kauf, Rarität, Eigenschaften und Schmelzen greifen ineinander; kein Verkauf gegen Gold.
**Beweis:** Eigenschaftsanzahl je Rarität stimmt; Kostenkurve stimmt; geschmolzene Türme sind
endgültig weg und tauchen nirgends wieder auf.

---

### E13 — Prestige

| Datei | Funktion | Zweck |
|---|---|---|
| `data/prestige.ts` | `PRESTIGE_NODES: PrestigeNode[]` | Baum mit Kosten und Voraussetzungen |
| `sim/prestige.ts` | `prestigePoints(state): number` | aus dem Run-Fortschritt |
| | `canPrestige(state): boolean` | ab 1.000 gesammeltem Gold (GDD 10) |
| | `doPrestige(state, coreId): void` | Run-Daten zurücksetzen, permanente behalten |
| | `buyNode(state, nodeId): boolean` | Punkte ausgeben |
| | `isUnlocked(state, id): boolean` | **Datenabfrage**, keine Codeverzweigung |
| `sim/stats.ts` | `applyPrestige(...)` | fließt in dieselbe Werte-Kette |
| `ui/prestige.ts` | `renderPrestigeTree(state)` | gesperrt/verfügbar/gekauft über Farbe |
| `ui/dialogs.ts` | `showCoreSelection(state)` | Kernwahl nach jedem Prestige (GDD 04 §2) |

**Abnahme:** Prestige setzt genau die Run-Daten zurück (GDD 16 §8), Punkte und Freischaltungen bleiben.
**Beweis:** eine Liste aller Zustandsfelder wird im Test gegen „bleibt/wird zurückgesetzt" geprüft —
das ist die fehleranfälligste Stelle des ganzen Spiels.

---

## 8. Phase D — Ausbau (E14–E18)

Ab hier ist die Architektur fertig. Die meisten Schritte sind **neue Datensätze**, kein neuer Code —
genau das war das Ziel von GDD 16 §5.

### E14 — Turminhalte

Restliche Turmarten aus GDD 05: Sniper, Laser, Raketen, Tesla, Flammen, Element-Türme, Drohnen-Modul,
Schildgenerator, Plasma, Void.

Neuer Code nur dort, wo eine **Mechanik** fehlt: Kettenblitz (Tesla), Dauerstrahl (Laser),
Flächenexplosion (Raketen/Plasma), Verbrennung über Zeit (Flammen), Drohnen als bewegliche Einheiten.

| Datei | Funktion |
|---|---|
| `sim/combat.ts` | `applyChain(state, from, hops, falloff)` · `applyBurn(state, enemy, dps, duration)` · `applyExplosion(state, pos, radius, damage)` |
| `sim/drones.ts` | `spawnDrone` · `stepDrones` — belegen keinen Platz, sind nicht angreifbar (GDD 03 §6) |

**Abnahme:** jede neue Turmart ist über einen Datensatz plus höchstens eine Mechanikfunktion erledigt.

---

### E15 — Gegnerinhalte

Gegnerklassen, Spezialgegner (Schild, Heilung, Teleport, Tarnung, Beschwörung), Elite-Modifikatoren,
Bossarten aus GDD 07.

| Datei | Funktion |
|---|---|
| `data/enemies.ts` | Datensätze je Klasse, Modifikator und Boss |
| `sim/enemies.ts` | `applyEliteModifier(enemy, mod)` — Chance steigt mit der Welle |
| `sim/combat.ts` | Widerstände und Schildlogik in `applyDamage` |

**Abnahme:** neue Gegner erfordern keine Änderung am Kampfkern.

---

### E16 — Ereignisse und Versorgungskapseln

| Datei | Funktion | Zweck |
|---|---|---|
| `data/events.ts` | `EVENTS` · `PODS` | Risiko- und Entscheidungsereignisse, Kapselarten |
| `sim/events.ts` | `maybeTriggerEvent(state, rng): GameEvent \| null` | alle 15–25 Wellen (GDD 11) |
| | `resolveEvent(state, choiceId): void` | Belohnung über `grantReward` |
| | `dropPod(state, pos, kind): void` · `collectPod(state, id): void` | Kapseln |
| `ui/dialogs.ts` | `showEventDialog(state, event)` | Entscheidung mit klaren Folgen |

---

### E17 — Offline-Fortschritt und Helfer

| Datei | Funktion | Zweck |
|---|---|---|
| `sim/offline.ts` | `simulateOffline(state, seconds): OfflineResult` | **dieselbe** Logik im Schnelldurchlauf |
| | `capOfflineTime(seconds): number` | Obergrenze aus `data/balance.ts` |
| `sim/helpers.ts` | `stepHelpers(state, dt)` | Goldsammler und weitere (GDD 12) |
Ab hier ist die Architektur fertig. Die meisten Schritte sind **neue Datensätze**, kein neuer Code —
genau das war das Ziel von GDD 16 §5.
**Warum das erst hier geht:** Die Offline-Simulation setzt voraus, dass die gesamte Kampf- und
Wirtschaftslogik ohne Browser lauffähig ist. Wer das früher baut, baut eine zweite, abweichende
Simulation — der klassische Fehler in Idle-Spielen.
Zehn neue Turmarten aus GDD 05: Marksman, Rocket Battery, Laser Lance, Tesla Coil, Flame Projector,
**Beweis:** eine Stunde offline liefert (bis auf Zufall) dasselbe Ergebnis wie eine Stunde im
Vordergrund bei ×1.
| Datei | Funktion | Zweck |
|---|---|---|
| `data/towers.ts` | `TowerMechanic` | die Spezialmechanik als Datensatzfeld — ohne Angabe: gewöhnliches Geschoss |
| `sim/combat.ts` | `applyExplosion(state, center, radius, damage, except?)` | Rakete, Plasma, Volatile-Elite |
| | `applyChain(state, from, hops, falloff, damage, range)` | Tesla |
| | `applyBurn(state, enemy, dps, duration)` | Flammen |
| | `applyChill(state, enemy, factor, duration)` | Eis und Void |
| Effekte | Schüsse, Treffer, Explosionen, Laser, Buff-Anzeigen, Platzierungsanimation, Prestige-Animation (GDD 13 §10) |
| Hinweise | einmalige Hinweise je neuem System, wegklickbar, ohne Pause (GDD 14 §4a) — inklusive des Hinweises zum **Zeitpunkt** des Buff-Turms |
| `sim/drones.ts` | `stepDrones(state, dt)` | belegen keinen Platz, sind nicht angreifbar (GDD 03 §6) |
| Audio | `core/events.ts` bekommt einen Zuhörer, der Klänge abspielt. Begrenzung pro Zeitfenster, Ausdünnen bei ×2/×4 (GDD 13 §11) |
| `data/prestige.ts` | Bereich `tech` | Raketen 150, Laser 250, Tesla 500, Drohnen 2.000, Plasma 10.000 |

**Wichtig:** Audio wird **angeschlossen**, nicht eingebaut. Wenn die Ereignispunkte ab E0 gemeldet
werden, ist das hier ein Nachmittag statt einer Woche.
| Punkt | Entscheidung |
|---|---|
| `spawnDrone` gibt es nicht — Drohnen sind **abgeleitet** | Gespeicherte Drohnen müssten bei jedem Umbau mit der Station abgeglichen werden, und genau dort entstehen Karteileichen. `stepDrones` zieht sie je Takt aus den vorhandenen Modulen nach: Modul weg, Drohnen weg. Es gibt keinen Zustand, der auseinanderlaufen kann. |
| Die Wirkung hängt am **Geschoss**, nicht am Turm | Wenn eine Rakete einschlägt, kann ihr Turm längst abgerissen sein. Ein Geschoss trägt deshalb seine Explosion selbst mit — dieselbe Überlegung wie bei Schaden und Farbe. |
| Der Laser trifft sofort statt mit Geschoss | Ein „Dauerstrahl" mit Flugzeit wäre ein Widerspruch. Er wird als kurzlebige Linie abgelegt; bei sechs Schuss je Sekunde ergibt das den durchgehenden Strahl aus dem GDD. |
| Element-Türme sind keine eigene Kategorie | GDD 05 nennt Feuer, Eis, Blitz, Plasma. Alle vier sind vorhandene Mechaniken mit anderen Zahlen — Feuer = `burn`, Eis = `chill`, Blitz = `chain`, Plasma = `explosive`. Sie wären reine Datensätze und stehen deshalb erst an, wenn sie sich von den bestehenden Türmen unterscheiden. |
| Legendary-Eigenschaften bleiben große Werte | Durchschuss und explodierende Projektile aus GDD 06 §10 wären jetzt möglich — sie brauchen aber einen Eigenschaftstyp, der eine Mechanik anhängt statt einen Wert. Offener Punkt, siehe unten. |
| Regel | Prüfung |
**Abnahme:** jede neue Turmart ist über einen Datensatz plus höchstens eine Mechanikfunktion erledigt. ✔
| `sim/` und `core/` fassen kein DOM und kein Canvas an | Suche nach `document`/`canvas` in beiden Ordnern muss leer sein |
| Kein direkter Zugriff auf `Date.now()`/`performance.now()` außerhalb von `core/loop.ts` | Suche |
Ziel bekommt den Flächenschaden nicht doppelt" und „ein Kettenblitz trifft niemanden zweimal".
| Belohnungen entstehen nur in `grantReward` | Suche nach `state.gold +=` außerhalb von `app/rewards.ts` |
| Zahlen im Code stehen in `data/`, nicht in `sim/` | Sichtprüfung beim Durchgang |
| Jeder Spielertext kommt aus `data/strings.ts` | Suche nach Zeichenketten in `ui/` |
| Neue Regeln bekommen eine Zusicherung im Selbsttest | Test läuft mit |
| Nach jeder Etappe: `typecheck` sauber, Selbsttests grün, Spielstand lädt noch | vor dem nächsten Schritt |
Acht Spezialgegner, zwei Belohnungsgegner, sechs Elite-Modifikatoren und vier weitere Bosse.
**Spielstand-Migration:** Ab E0 hat jeder Spielstand eine Version. Wer ein Feld hinzufügt, erhöht
die Version und schreibt eine Migration — auch während der Entwicklung. Sonst ist jeder Testspielstand
nach jeder Etappe wertlos, und man testet nur noch mit frischen Spielständen.
| `data/enemies.ts` | `EnemyAbility` | Schild, Reflektor, Berserker, Heiler, Verstärker, Tarnung, Teleport, Beschwörung |
| | `ELITE_MODIFIERS` · `eliteById` | Swift, Reinforced, Regenerating, Volatile, Bullion, Archive |
| | `bossForWave(wave)` | der höchste zuständige Boss löst seinen Vorgänger ab |
| `sim/enemies.ts` | `stepEnemyAbilities(state, dt)` | **eine** Schleife für alle Fähigkeiten |
| | `maybeMakeElite` · `applyEliteModifier` · `eliteChance` | Chance steigt mit der Welle, ab Welle 50 |
| `sim/combat.ts` | Schild und Reflektor in `applyDamage`, `berserkFactor` in `dockedDamage` | Verteidigung als Feld, nicht als Fallunterscheidung |
| `sim/targeting.ts` | eine Zeile für die Tarnung | wer getarnt ist, ist kein Ziel |
| Eigener Zahlentyp (Mantisse/Exponent) | löst ein Problem, das erst um Welle 7.400 einträte (Abschnitt 3) |
| Offline-Simulation | braucht die fertige Kampflogik, sonst entsteht eine zweite abweichende Simulation (E17) |
| Audio | nur Anschlusspunkte ab E0, Klänge zuletzt (GDD 13 §11) |
| Viele Turm- und Gegnerarten | erst wenn ein Datensatz genügt; vorher wird jede Variante dreimal umgebaut |
| Sparsame Neuberechnung von Buffs | vollständige Neuberechnung kostet unter 1 ms und ist fehlerfrei (GDD 03 §10) |
| Eine gemeinsame Uhr je Gegner statt einer je Fähigkeit | Zwei Uhren wären zwei Felder mehr im Pool und ein Fehler mehr beim Zurücklegen. Ein Gegner mit zwei getakteten Fähigkeiten führt sie im Gleichschritt aus — bei höchstens drei Fähigkeiten je Gegner ist das nicht zu bemerken. |
| Getarnte Gegner werden durchscheinend, nicht unsichtbar | Regelgetreu wäre unsichtbar, spielbar ist es nicht: Der Spieler sähe einen Gegner aus dem Nichts an seiner Station stehen. Ein Schemen sagt „der ist da, deine Türme sehen ihn nicht" — und **die Türme** ignorieren ihn wirklich. |
| Bosse werden keine Elites | Ein Boss ist bereits die Zäsur der Welle. Ihn zusätzlich zu verstärken macht ihn nicht interessanter, nur länger. |
| Flieger fehlen | GDD 07 §5 nennt sie „bewegt sich unabhängig vom Boden". Es gibt keinen Boden — alle Gegner laufen frei auf die Station zu. Der Gegner wäre von einer Standard-Drohne nicht zu unterscheiden. |

**Abnahme:** neue Gegner erfordern keine Änderung am Kampfkern. ✔
**Beweis:** `selftest/suites/content.ts` — 30 Zusicherungen. Darunter der wichtigste Fall: „ein
Gegner aus dem Pool erbt nichts von seinem Vorgänger". Der Test zum Verstärker hat außerdem einen
echten Fehler gefunden — die Deckelung verglich den Schaden gegen sich selbst und war damit nie
| Wellenfaktor, Turm-Basiswerte, XP-Kurve, Prestige-Formel, Drop-Chancen | nach E9 am laufenden Spiel (GDD 15 §16) |
| Zeichenbudget: maximale Gegner und Geschosse | Messung in E18, Obergrenze steht ab E4 als Konstante |
| Baugefühl, Formunterscheidbarkeit, Buff-Linien, Wirkung der Keile | Urteil am Bild — offen aus [Prototyp 01](../prototypes/01-tower-building/README.md#ergebnis) |

### E16 — Ereignisse und Versorgungskapseln

| Datei | Funktion | Zweck |
|---|---|---|
| `data/events.ts` | `EVENTS` · `PODS` | Risiko- und Entscheidungsereignisse, Kapselarten |
| `sim/events.ts` | `maybeTriggerEvent(state, rng): GameEvent \| null` | alle 15–25 Wellen (GDD 11) |
| | `resolveEvent(state, choiceId): void` | Belohnung über `grantReward` |
| | `dropPod(state, pos, kind): void` · `collectPod(state, id): void` | Kapseln |
| `ui/dialogs.ts` | `showEventDialog(state, event)` | Entscheidung mit klaren Folgen |

---

### E17 — Offline-Fortschritt und Helfer

| Datei | Funktion | Zweck |
|---|---|---|
| `sim/offline.ts` | `simulateOffline(state, seconds): OfflineResult` | **dieselbe** Logik im Schnelldurchlauf |
| | `capOfflineTime(seconds): number` | Obergrenze aus `data/balance.ts` |
| `sim/helpers.ts` | `stepHelpers(state, dt)` | Goldsammler und weitere (GDD 12) |
| `ui/dialogs.ts` | `showReturnSummary(state, result)` | Rückkehr-Zusammenfassung |

**Warum das erst hier geht:** Die Offline-Simulation setzt voraus, dass die gesamte Kampf- und
Wirtschaftslogik ohne Browser lauffähig ist. Wer das früher baut, baut eine zweite, abweichende
Simulation — der klassische Fehler in Idle-Spielen.

**Beweis:** eine Stunde offline liefert (bis auf Zufall) dasselbe Ergebnis wie eine Stunde im
Vordergrund bei ×1.

---

### E18 — Politur

| Bereich | Inhalt |
|---|---|
| Effekte | Schüsse, Treffer, Explosionen, Laser, Buff-Anzeigen, Platzierungsanimation, Prestige-Animation (GDD 13 §10) |
| Hinweise | einmalige Hinweise je neuem System, wegklickbar, ohne Pause (GDD 14 §4a) — inklusive des Hinweises zum **Zeitpunkt** des Buff-Turms |
| Einstellungen | Grafik, Effekte, Animationen, Lautstärke, Sprache |
| Audio | `core/events.ts` bekommt einen Zuhörer, der Klänge abspielt. Begrenzung pro Zeitfenster, Ausdünnen bei ×2/×4 (GDD 13 §11) |
| Leistung | Messung: gleichzeitige Gegner und Geschosse, Zeichenbudget (GDD 16 §15) |

**Wichtig:** Audio wird **angeschlossen**, nicht eingebaut. Wenn die Ereignispunkte ab E0 gemeldet
werden, ist das hier ein Nachmittag statt einer Woche.

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
| Offline-Simulation | braucht die fertige Kampflogik, sonst entsteht eine zweite abweichende Simulation (E17) |
| Audio | nur Anschlusspunkte ab E0, Klänge zuletzt (GDD 13 §11) |
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
| Zeichenbudget: maximale Gegner und Geschosse | Messung in E18, Obergrenze steht ab E4 als Konstante |
| Baugefühl, Formunterscheidbarkeit, Buff-Linien, Wirkung der Keile | Urteil am Bild — offen aus [Prototyp 01](../prototypes/01-tower-building/README.md#ergebnis) |

/* ### FEHLENDE ZEILE 771 ### */
/* ### FEHLENDE ZEILE 772 ### */
/* ### FEHLENDE ZEILE 773 ### */
/* ### FEHLENDE ZEILE 774 ### */
/* ### FEHLENDE ZEILE 775 ### */
/* ### FEHLENDE ZEILE 776 ### */
/* ### FEHLENDE ZEILE 777 ### */
/* ### FEHLENDE ZEILE 778 ### */
/* ### FEHLENDE ZEILE 779 ### */
/* ### FEHLENDE ZEILE 780 ### */
/* ### FEHLENDE ZEILE 781 ### */
/* ### FEHLENDE ZEILE 782 ### */
/* ### FEHLENDE ZEILE 783 ### */
/* ### FEHLENDE ZEILE 784 ### */
/* ### FEHLENDE ZEILE 785 ### */
/* ### FEHLENDE ZEILE 786 ### */
/* ### FEHLENDE ZEILE 787 ### */
/* ### FEHLENDE ZEILE 788 ### */
/* ### FEHLENDE ZEILE 789 ### */
/* ### FEHLENDE ZEILE 790 ### */
/* ### FEHLENDE ZEILE 791 ### */
/* ### FEHLENDE ZEILE 792 ### */
/* ### FEHLENDE ZEILE 793 ### */
/* ### FEHLENDE ZEILE 794 ### */
/* ### FEHLENDE ZEILE 795 ### */
/* ### FEHLENDE ZEILE 796 ### */
/* ### FEHLENDE ZEILE 797 ### */
/* ### FEHLENDE ZEILE 798 ### */
/* ### FEHLENDE ZEILE 799 ### */
/* ### FEHLENDE ZEILE 800 ### */
/* ### FEHLENDE ZEILE 801 ### */
/* ### FEHLENDE ZEILE 802 ### */
/* ### FEHLENDE ZEILE 803 ### */
/* ### FEHLENDE ZEILE 804 ### */
/* ### FEHLENDE ZEILE 805 ### */
/* ### FEHLENDE ZEILE 806 ### */
/* ### FEHLENDE ZEILE 807 ### */
nach jeder Etappe wertlos, und man testet nur noch mit frischen Spielständen.

---

## 10. Was bewusst *nicht* früh gebaut wird

| Nicht früh | Warum |
|---|---|
| Eigener Zahlentyp (Mantisse/Exponent) | löst ein Problem, das erst um Welle 7.400 einträte (Abschnitt 3) |
| Offline-Simulation | braucht die fertige Kampflogik, sonst entsteht eine zweite abweichende Simulation (E17) |
| Audio | nur Anschlusspunkte ab E0, Klänge zuletzt (GDD 13 §11) |
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
| Zeichenbudget: maximale Gegner und Geschosse | Messung in E18, Obergrenze steht ab E4 als Konstante |
| Baugefühl, Formunterscheidbarkeit, Buff-Linien, Wirkung der Keile | Urteil am Bild — offen aus [Prototyp 01](../prototypes/01-tower-building/README.md#ergebnis) |

