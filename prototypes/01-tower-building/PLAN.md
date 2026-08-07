# Prototyp 01 — Turmbau: Umsetzungsplan

> Detailplan für das modulare Bausystem als isolierter Prototyp.
> Grundlage: [GDD 03](../../docs/gdd/03-modulare-basis-und-bauregeln.md),
> [GDD 05](../../docs/gdd/05-turm-system-und-turmtypen.md),
> [GDD 13](../../docs/gdd/13-ui-und-visuelles-design.md),
> [GDD 16](../../docs/gdd/16-technische-umsetzung.md)
> — sowie die Referenzskizze des Zielbilds (zentrales Hexagon, kantenbündig angesteckte Formen).

---

## 0. Wichtige Abweichung vom GDD — bitte zuerst lesen

Das GDD enthält an dieser Stelle **zwei widersprüchliche Aussagen**:

| Quelle | Aussage |
|---|---|
| [GDD 03 §2](../../docs/gdd/03-modulare-basis-und-bauregeln.md) | „Jedes Modul besitzt: feste Seitenlänge (bei allen Modulen identisch), definierte Form, Anschlussflächen. Dadurch passen alle Module geometrisch zusammen, rasten sauber ein …" |
| [GDD 03 §3](../../docs/gdd/03-modulare-basis-und-bauregeln.md) | „Alle Module belegen **genau eine Hex-Zelle** … Die Formen sind visuelle Signaturen innerhalb der Hex-Zelle, keine eigene Geometrie." |

Die Zielskizze zeigt eindeutig **§2**: ein zentrales Hexagon, an dessen Kanten Dreiecke, Vierecke
und Fünfecke *als echte Formen* andocken — mit gemeinsamen Kanten, unterschiedlichen Größen und
den dabei entstehenden Zwischenräumen.

**Dieser Prototyp setzt § 2 um: echte Polygone, Andockung über gemeinsame Kanten, kein Hex-Raster.**

Daraus folgen drei Konsequenzen, die nach dem Prototyp im GDD nachgezogen werden müssen:

1. **§ 3 (Hex-Raster) entfällt** und wird durch das Kantensystem ersetzt.
2. **Die Nachbarzahl ist nicht mehr fix 6**, sondern hängt von der Modulform ab
   (Dreieck 3, Viereck 4, Fünfeck 5, Hexagon 6). Das macht die Form zu einer *echten Mechanik*
   statt zu reiner Optik — besonders für Buff-Türme.
3. **„hinterlassen keine Lücken" ist geometrisch falsch.** Fünfecke kacheln die Ebene nicht;
   an vielen Ecken bleiben Keile offen (auch in der Zielskizze gut sichtbar). Lücken sind Teil des
   Looks, nicht ein Fehler.

---

## 1. Leitfrage

> **Fühlt sich das Anstecken verschiedener Turmformen an den Hauptturm und aneinander gut an —
> und bleibt eine gewachsene Station lesbar und baubar?**

Konkret muss der Prototyp vier Dinge zeigen:

1. **Einrasten** — dockt ein Modul beim Bauen zuverlässig und vorhersehbar an die gemeinte Kante an?
2. **Wachstum** — sieht eine Station mit 10–15 Modulen nach Maschine aus, oder nach Unfall?
3. **Lesbarkeit** — sind 6+ Turmarten anhand ihrer Form auf einen Blick unterscheidbar?
4. **Entscheidung** — ist die Formwahl (3 vs. 5 Nachbarkanten) bei nur 4 Turmplätzen interessant?

---

## 2. Abgrenzung

| Im Prototyp | Bewusst nicht im Prototyp |
|---|---|
| Polygon-Geometrie, Kantenandockung, Überlappungsprüfung | Gegner, Wellen, Projektile, Kampf |
| Mehrere Turmarten mit unterschiedlichen Formen | Gold, Kosten, Turmkauf, Schmelzen |
| Platzieren, Verschieben, Entfernen, Zusammenhang | Upgrade-Pfade, Level, Prestige |
| Buff-Nachbarschaft über gemeinsame Kanten | Raritäts-Auswürfelung (Raritäten sind fest gesetzt) |
| Reichweitenkreise, Auto-Zoom-Kamera | Offline-Fortschritt, Speicherstände, Audio |
| Theoretische Stations-DPS als Vergleichszahl | Echtes Balancing (nur relative Vergleiche) |

**Warum kein Kampf:** Die Frage lautet „fühlt sich Bauen gut an". Kampf würde den Prototyp
verdreifachen und die Antwort verwässern. Statt echtem Schaden liefert eine **theoretische
Stations-DPS-Kennzahl** (Abschnitt 5.4) den Vergleich zwischen zwei Builds. Kampf gehört in
einen späteren Prototyp 02.

---

## 3. Verbindliche Regeln aus dem GDD

| Regel | Quelle |
|---|---|
| Hauptturm liegt fest im Zentrum, nicht entfernbar, Form Hexagon | 03 §2, 04 §1 |
| Alle Module haben **dieselbe Seitenlänge** und definierte Anschlussflächen | 03 §2 |
| Anbau direkt am Hauptturm **oder an bereits platzierten Türmen** | 03 §2 |
| Platzieren kostet **kein Gold**; Voraussetzung ist nur Besitz | 03 §4 |
| Jederzeit platzieren, verschieben, entfernen; Module rasten ein | 03 §4 |
| Entfernte Türme wandern zurück ins Inventar, gehen nie verloren | 03 §12 |
| **4 Turmplätze** zum Start, Zielspanne 8–15 | 03 §6 |
| Buff- und Support-Türme belegen einen vollen Turmplatz | 03 §6 |
| Inventar ist unbegrenzt | 03 §6 |
| Buff wirkt nur auf **direkt angrenzende** Module, Buffs stapeln, **Buff-Türme buffen keine Buff-Türme**, jeder Buff hat eine Obergrenze | 03 §9 |
| Eine gemeinsame Stations-HP, Module unzerstörbar | 03 §5 |
| Reichweite ist ein Kreis um das **eigene** Modul, kein Schussfeld | 05 §4 |
| Mögliche Bauplätze hervorheben, Buff-Verbindungen als leuchtende Linien, Reichweitenkreis bei Auswahl | 13 §12 |
| Kamera zoomt automatisch heraus, Station bleibt komplett sichtbar | 13 §4 |
| Formzuordnung: Hexagon = Hauptturm/Spezial, Quadrat = Standard, Dreieck = spezialisiert, Pentagon = Buff, Kreis = autonom | 03 §7 |
| Feste Zeitschritte, Rendering entkoppelt | 16 §12 |
| Inhalte über Daten, nicht im Code verdrahtet | 16 §5 |
| Code-Bezeichner englisch, Doku deutsch | 16 §1 |

---

## 4. Technische Grundlage

### 4.1 Das Andocksystem in einem Satz

> Jedes Modul ist ein **regelmäßiges Polygon mit einheitlicher Seitenlänge `L`**. Ein neues Modul
> wird an eine **freie Kante** eines bereits platzierten Moduls gesetzt; Position und Drehung
> ergeben sich vollständig aus dieser Kante.

Der Spieler wählt also nur zwei Dinge: **welches Modul** und **an welche Kante**. Es gibt keine
freie Drehung und keine Feinpositionierung — deshalb rastet immer alles sauber ein.

```
                    Kante 2 (frei)
                   ╱          ╲
        Pentagon ─┤   HEXAGON   ├─ Dreieck
                   ╲   (Core)  ╱
                    └──────────┘
                       Viereck
```

**Warum eine Kante genügt:** Ein regelmäßiges n-Eck ist rotationssymmetrisch. Legt man eine seiner
Kanten auf eine vorgegebene Kante, ist das Ergebnis unabhängig davon, *welche* seiner Kanten man
nimmt. Es gibt pro freier Kante genau **eine** mögliche Platzierung — keine Rotationsauswahl,
keine Spiegelung, keine Mehrdeutigkeit.

### 4.2 Geometrie (`geometry.ts`)

Reine Funktionen ohne DOM- oder Canvas-Bezug — testbar und später 1:1 ins Spiel übertragbar.

```ts
export type Vec2 = { x: number; y: number }
export type Edge = { a: Vec2; b: Vec2 }   // gerichtet, Polygon liegt links (CCW)

/** Einheitliche Seitenlänge aller Module. */
export const SIDE = 56

/** Abstand Mittelpunkt → Kantenmitte. */
export const apothem = (n: number): number => SIDE / (2 * Math.tan(Math.PI / n))

/** Abstand Mittelpunkt → Ecke. */
export const circumradius = (n: number): number => SIDE / (2 * Math.sin(Math.PI / n))

/** Eckpunkte gegen den Uhrzeigersinn, Kante i verläuft von v[i] nach v[(i+1) % n]. */
export function polygonAt(n: number, center: Vec2, rotation: number): Vec2[]

/** Kern des Bausystems: n-Eck so setzen, dass eine seiner Kanten auf `edge` liegt
 *  — und zwar auf der Außenseite des Moduls, zu dem `edge` gehört. */
export function attachTo(n: number, edge: Edge): { center: Vec2; rotation: number }
```

**`attachTo` — die zentrale Rechnung:**

1. Kantenmitte `m = (a + b) / 2`
2. Kantenrichtung `d = normalize(b - a)`
3. Außennormale bei CCW-Polygonen: `nOut = (d.y, -d.x)`
4. Mittelpunkt des neuen Moduls: `center = m + nOut * apothem(n)`
5. Drehung: das neue Modul muss dieselbe Kante *rückwärts* enthalten (Kante `b → a`), damit es
   selbst wieder CCW ist. Also `rotation = atan2(a.y - center.y, a.x - center.x)`, danach die
   Ecken bei `rotation + k * 2π/n` erzeugen.

Damit liegt das neue Modul exakt kantenbündig an, auf der freien Seite, ohne Lücke oder Überlappung
an dieser Kante.

**Weitere benötigte Funktionen:**

| Funktion | Zweck |
|---|---|
| `weld(points)` | Ecken, die näher als `SIDE * 1e-3` beieinanderliegen, auf denselben Wert ziehen — verhindert Gleitkomma-Drift und macht gemeinsame Kanten exakt identisch |
| `sameEdge(e1, e2)` | zwei Kanten gelten als geteilt, wenn ihre Endpunkte (in beliebiger Richtung) innerhalb der Toleranz übereinstimmen |
| `polygonsOverlap(p1, p2)` | SAT-Test; beide Polygone werden vorher um 0,3 % zu ihrem Mittelpunkt geschrumpft, damit *Berührung* nicht als Überlappung zählt. Vorprüfung über Umkreisradien |
| `pointInPolygon(p, poly)` | Auswahl per Maus |
| `nearestFreeEdge(p, edges, maxDist)` | Kante unter dem Mauszeiger für die Bau-Vorschau |

### 4.3 Modulformen (`shapes.ts`)

**Trennung von Grundfläche und Optik.** Die GDD-Formliste (03 §7) enthält mit „Kreis" und
„Spezialform" zwei Formen, die geometrisch nicht andocken können. Lösung:

| Begriff | Bedeutung |
|---|---|
| **Footprint** | die tatsächliche Grundfläche: `3` (Dreieck), `4` (Viereck), `5` (Fünfeck), `6` (Hexagon) — bestimmt Geometrie und **Anzahl der Nachbarkanten** |
| **Emblem** | das Zeichen im Inneren: Kreis, Stern, Balken, Ring … — reine Optik, bestimmt die Wiedererkennung |

Das Drohnen-Modul („Kreis") ist damit ein **Hexagon-Footprint mit Kreis-Emblem**, der Plasma-Turm
(„Spezialform") ein **Fünfeck mit Stern-Emblem**. Die GDD-Formsprache bleibt erhalten, die
Geometrie bleibt schlüssig.

**Der Footprint ist eine echte Spielmechanik**, keine Dekoration:

| Footprint | Kanten | Bedeutung im Spiel |
|---|---|---|
| Dreieck | 3 | wenig Anschluss, kompakt, günstige „Randbebauung" |
| Viereck | 4 | ausgewogen |
| Fünfeck | 5 | viel Anschluss — die natürliche Form für Buff-Türme |
| Hexagon | 6 | maximaler Anschluss, Hauptturm und Spezialmodule |

Ein Fünfeck-Amplifier kann bis zu **5** Nachbarn verstärken, ein Dreieck-Amplifier nur **3**.
Damit entsteht eine Abwägung, die es im Hex-Raster gar nicht geben konnte.

**Innenwinkel und Lücken** — wichtig fürs Verständnis des Aussehens:

| Form | Innenwinkel |
|---|---|
| Dreieck | 60° |
| Viereck | 90° |
| Fünfeck | 108° |
| Hexagon | 120° |

Um eine gemeinsame Ecke müssen sich 360° schließen. Lückenlos geht das z. B. mit 6 × 60°,
4 × 90°, 3 × 120° oder 120° + 120° + 60° + 60°. Jede Kombination mit einem Fünfeck (108°) lässt
einen Keil offen. **Das ist gewollt und Teil des Looks** — die Zielskizze zeigt genau solche Keile.

### 4.4 Datenmodell (`model.ts`)

```ts
export type FootprintSides = 3 | 4 | 5 | 6
export type Emblem = 'bars' | 'triangle' | 'circle' | 'ring' | 'star' | 'chevron' | 'shield'
export type Category = 'attack' | 'area' | 'special' | 'buff' | 'support'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type StatKey = 'damage' | 'attackSpeed' | 'range' | 'critChance' | 'projectileSpeed'
export type CombatStats = Record<StatKey, number>

export type TowerDef = {
  id: string
  name: string                       // englisch (Spielsprache)
  sides: FootprintSides
  emblem: Emblem
  category: Category
  stats: CombatStats
  buffs?: { stat: StatKey; amount: number }[]      // nur category 'buff'
  stationBonus?: { stationHp?: number }            // nur category 'support'
  accent: string
  description: string
}

/** Platzierung: Weltkoordinaten, abgeleitet aus der Andockkante. */
export type Placement = { center: Vec2; rotation: number }

export type TowerInstance = {
  uid: string
  defId: string
  rarity: Rarity
  placement: Placement | null        // null = im Inventar
  poly: Vec2[]                       // abgeleitet, bei Änderung neu berechnet
}

export type Station = {
  core: TowerInstance                // fest bei (0,0), sides = 6
  placed: TowerInstance[]
  inventory: TowerInstance[]
  slots: number                      // Start 4
}
```

**Warum `center + rotation` als Wahrheit und nicht die Andockkante:** Ein Andock-Baum
(„Modul X hängt an Kante 3 von Modul Y") wäre kompakter, macht aber das Entfernen eines mittleren
Moduls kompliziert — alle Kinder müssten neu verhängt werden. Mit Weltkoordinaten ist Entfernen
trivial, und die Nachbarschaft wird ohnehin rein geometrisch bestimmt. Die Andockkante ist nur
das *Eingabeverfahren*, nicht der gespeicherte Zustand.

### 4.5 Bauregeln (`station.ts`)

Reine Funktionen über den Zustand — die UI kennt keine Regeln.

```ts
export type FreeEdge = { ownerUid: string; edgeIndex: number; edge: Edge }

export type PlacementError =
  | 'overlap'        // würde ein bestehendes Modul schneiden
  | 'no_slots'       // Turmplatz-Limit erreicht
  | 'not_owned'      // Turm nicht im Inventar
  | 'no_edge'        // keine Andockkante getroffen

export function freeEdges(st: Station, ignoreUid?: string): FreeEdge[]
export function canPlace(st: Station, defId: string, at: FreeEdge): PlacementError | null
export function place(st: Station, uid: string, at: FreeEdge): void
export function move(st: Station, uid: string, to: FreeEdge): PlacementError | null
export function remove(st: Station, uid: string): void
export function neighbors(st: Station, uid: string): TowerInstance[]   // gemeinsame Kante
export function isConnected(st: Station, withoutUid?: string): boolean
export function usedSlots(st: Station): number                          // Core zählt nicht
```

**Freie Kanten** sind alle Kanten aller platzierten Module (inkl. Hauptturm), zu denen es keine
deckungsgleiche Kante eines anderen Moduls gibt. Zu Beginn hat der Hauptturm 6 freie Kanten.
Sie sind gleichzeitig die Bauplatz-Hervorhebung aus GDD 13 §12.

**Überlappungsprüfung ist Pflicht.** Anders als beim Raster kann eine geometrisch korrekte
Andockung trotzdem in ein anderes Modul hineinragen — etwa ein Hexagon in einem 60°-Keil zwischen
zwei bestehenden Modulen. Jede Platzierung wird deshalb gegen alle bestehenden Polygone geprüft
(bei ≤ 20 Modulen mit Umkreis-Vorprüfung praktisch kostenlos).

**Verschieben** = Entfernen + Platzieren, wobei die freien Kanten **ohne** das bewegte Modul
berechnet werden (`ignoreUid`). Sonst könnte ein Modul an seine eigene Kante andocken.

**Zusammenhang beim Entfernen** — der interessanteste offene Regelfall. Die Anbauregel garantiert
Zusammenhang nur beim *Bauen*; das Entfernen eines mittleren Moduls kann die Station zerreißen:

```
    [A]—[Core]—[B]        B entfernen  →  Rest bleibt verbunden   ✓
    [A]—[B]—[Core]        B entfernen  →  A wird zur Insel        ✗
```

Beide Auflösungen werden implementiert und umschaltbar gemacht:

| Variante | Verhalten |
|---|---|
| **A (Standard)** | Entfernen wird blockiert, wenn `isConnected(st, uid)` fehlschlägt; das betroffene Modul blinkt rot |
| **B (Alternative)** | Entfernen erlaubt; abgetrennte Module wandern per Breitensuche ab dem Hauptturm automatisch ins Inventar zurück |

Welche sich besser anfühlt, ist offene Frage **F2**.

### 4.6 Turm-Katalog (`catalog.ts`)

Der **einzige** Ort mit Zahlen (GDD 16 §5). Ein neuer Turm ist ein Datensatz, kein Code.

| id | Name | Footprint | Emblem | Kategorie | Rolle im Prototyp |
|---|---|---|---|---|---|
| `autocannon` | Autocannon | Viereck (4) | bars | attack | wenig Schaden, sehr hohes Tempo |
| `siege_cannon` | Siege Cannon | Viereck (4) | chevron | attack | hoher Schaden, langsam, hohe Reichweite |
| `marksman` | Marksman | Dreieck (3) | triangle | attack | sehr hohe Reichweite, sehr langsam |
| `flamer` | Flamespire | Dreieck (3) | ring | area | Flächenschaden, kurze Reichweite |
| `rate_amplifier` | Rate Amplifier | Fünfeck (5) | ring | buff | +25 % Angriffstempo für Nachbarn |
| `power_amplifier` | Power Amplifier | Fünfeck (5) | star | buff | +20 % Schaden für Nachbarn |
| `bulwark` | Bulwark Array | Hexagon (6) | shield | support | +Stations-HP, **kein** Nachbarbuff |
| `drone_bay` | Drone Bay | Hexagon (6) | circle | special | belegt Platz, im Prototyp nur Optik |

Zwei Buff-Arten sind das Minimum, um Stapelung zu zeigen. Beide Dreiecke und beide Vierecke
existieren paarweise, damit sich prüfen lässt, ob **gleiche Form + anderes Emblem** noch
unterscheidbar ist (offene Frage **F4**).

Ebenfalls im Katalog, getrennt von den Turmarten:

```ts
export const BUFF_CAPS: Record<StatKey, number> = {
  attackSpeed: 1.00,   // max. +100 % (GDD 03 §9 nennt genau dieses Beispiel)
  damage: 1.00, range: 0.50, critChance: 0.25, projectileSpeed: 1.00,
}

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1.0, rare: 1.15, epic: 1.35, legendary: 1.6, mythic: 2.0,
}

export const RARITY_COLOR: Record<Rarity, string> = {   // GDD 13 §7
  common: '#9aa4bf', rare: '#3ddc84', epic: '#4aa3ff',
  legendary: '#ffc34a', mythic: '#ff3b6b',
}
```

Die Multiplikatoren sind Prototyp-Platzhalter. Echtes Balancing gehört nach GDD 15.

---

## 5. Buff-System (`buffs.ts`)

```ts
export type EffectiveTower = {
  instance: TowerInstance
  def: TowerDef
  base: CombatStats
  bonuses: Partial<Record<StatKey, number>>          // gedeckelte Summen
  final: CombatStats
  sources: { fromUid: string; stat: StatKey; amount: number }[]
}

export function computeStation(st: Station): {
  towers: Map<string, EffectiveTower>
  stationHp: number
  theoreticalDps: number
}
```

**Ablauf** (entspricht dem Diagramm in GDD 03 §10):

1. Basiswerte je platziertem Modul: `def.stats × RARITY_MULT[rarity]`
2. Für jeden Buff-Turm: alle Module bestimmen, die eine **gemeinsame Kante** mit ihm haben
3. Nachbarn mit `category === 'buff'` **überspringen** (GDD 16 §7)
4. Boni je Wert **addieren**, Quelle vermerken
5. Summe je Wert auf `BUFF_CAPS[stat]` deckeln
6. `final = base × (1 + gedeckelte Summe)`
7. Support-Boni (`bulwark`) getrennt auf die Stations-HP addieren

**Nur gemeinsame Kanten zählen, keine gemeinsamen Ecken.** Zwei Module, die sich nur in einem Punkt
berühren (typisch: zwei Vierecke an benachbarten Hexagon-Kanten, dazwischen ein 60°-Keil), sind
**keine** Nachbarn. Diese Regel ist im Spiel sichtbar, weil die Buff-Linie dann fehlt.

**Warum additiv:** Multiplikatives Stapeln explodiert bei mehreren Buff-Türmen und macht die
Obergrenze aus GDD 03 §9 unbrauchbar. Additiv + Deckel ist vorhersagbar und im Detailpanel
erklärbar („+20 % +25 % = +45 %").

**Vollständige Neuberechnung bei jeder Änderung.** Kein Cache, keine Invalidierung — bei ≤ 20
Modulen liegt das weit unter einer Millisekunde, und inkrementelle Buff-Updates sind eine der
klassischen Fehlerquellen. Das ist zugleich die Empfehlung fürs Spiel.

**Theoretische Stations-DPS** — der Vergleichswert, der den Kampf ersetzt:

```
dps = Σ über alle Angriffs-/Flächenmodule:  final.damage × final.attackSpeed × (1 + critChance × 0.5)
```

Steht im HUD und erlaubt die entscheidende Messung: *Ab wie vielen Nachbarn schlägt ein
Fünfeck-Amplifier einen zusätzlichen Kampfturm?* (offene Frage **F7**).

---

## 6. Darstellung und Bedienung

### 6.1 Rendering (`render.ts`, `camera.ts`)

Zeichenreihenfolge, von hinten nach vorn:

| Ebene | Inhalt |
|---|---|
| 1 | Hintergrund: dunkelblau, dezente technische Linien (GDD 13 §2) |
| 2 | Modulflächen: dunkle Füllung, minimal heller als der Hintergrund (wie in der Zielskizze) |
| 3 | **Geteilte Kanten**: hell leuchtende Linie — sie zeigen die Verbindungsstruktur der Station |
| 4 | **Freie Außenkanten**: dünner, dunkler — dadurch wirkt die Station als geschlossener Körper |
| 5 | Raritätsrahmen: Neon-Umrandung des Moduls in der Raritätsfarbe |
| 6 | Emblem mittig im Modul, ca. 45 % des Inkreisdurchmessers |
| 7 | Hauptturm: größere Linienstärke, hellerer Kern, dezenter Puls |
| 8 | Buff-Verbindungen: leuchtende Linie zwischen den Mittelpunkten benachbarter Module |
| 9 | Reichweitenkreis des ausgewählten Moduls (um dessen **eigenen** Mittelpunkt) |
| 10 | Bau-Modus: freie Kanten pulsierend markiert + Ghost-Polygon (grün gültig / rot ungültig) |

Der Look der Zielskizze entsteht vor allem aus Ebene 3: **die hellen Fugen zwischen den Modulen**
sind das prägende Merkmal, nicht die Füllflächen.

**Kamera:** Bounding-Box aller Polygone + Rand → Zielzoom; der tatsächliche Zoom nähert sich pro
Tick exponentiell an (kein Sprung). Sind Reichweitenkreise sichtbar, geht die größte Reichweite in
die Box ein (GDD 13 §4).

### 6.2 Bedienung (`input.ts`)

| Eingabe | Wirkung |
|---|---|
| Klick auf Inventarkarte | Bau-Modus mit dieser Instanz starten |
| Maus über die Baufläche | die **nächstgelegene freie Kante** wird gewählt, das Ghost-Polygon rastet dort ein |
| Linksklick | Platzieren (nur wenn gültig) |
| `Esc` / Rechtsklick | Bau-Modus verlassen |
| Linksklick auf Modul | Auswählen: Reichweitenkreis + Detailpanel |
| Ziehen eines Moduls | Verschieben; Ziel ist wieder die nächste freie Kante |
| Rechtsklick auf Modul / `Entf` | Entfernen → zurück ins Inventar |
| Mausrad | Zoom manuell; `F` stellt Auto-Zoom wieder her |
| `B` | Buff-Linien dauerhaft an/aus (**F6**) |
| `R` | Reichweitenkreise aller Module an/aus |
| `E` | Debug: freie Kanten und Kantennummern einblenden |

**Kernentscheidung der Bedienung:** Der Spieler zielt nicht auf eine Zelle, sondern auf eine
**Kante**. Das Ghost-Modul springt beim Bewegen von Kante zu Kante — dieses Springen ist das
„Einrasten" aus GDD 03 §4 und der wichtigste Punkt am Bau-Gefühl. Ob es sich gut anfühlt oder
zappelig wirkt, ist offene Frage **F1**.

### 6.3 HTML-Oberfläche (`ui.ts`)

Dreiteilig wie das Basis-Menü aus GDD 13 §5, aber reduziert:

```
┌──────────────┬────────────────────────────┬───────────────┐
│ INVENTAR     │   BAUFLÄCHE (Canvas)       │  DETAILS      │
│              │                            │               │
│ Autocannon#1 │        ⬢ Core              │  Name/Rarität │
│  Rare  ■4    │      + Module              │  Basis → eff. │
│ Marksman#1   │                            │  aktive Buffs │
│  Epic  ▲3    │                            │  Nachbarn 3/5 │
│ …            │                            │               │
├──────────────┴────────────────────────────┴───────────────┤
│ Plätze 3/4 · Module 4 · Stations-HP 1.240 · DPS 3.4K  [⚙] │
└───────────────────────────────────────────────────────────┘
```

Jede Inventarkarte zeigt **Form und Kantenzahl** (`▲3`, `■4`, `⬟5`, `⬢6`), weil das jetzt eine
Spielinformation ist. Das Detailpanel zeigt pro Wert `Basis → effektiv` samt Herkunft jedes Bonus
(`+25 % Angriffstempo ← Rate Amplifier #1`) sowie `Nachbarn 3/5` — belegte von möglichen Kanten.
Damit wird die Buff-Regel sichtbar, statt erklärt zu werden (GDD 13 §12).

Das **Debug-Panel** (`⚙`): Turmplätze 4–20, Entfern-Regel A/B, Buff-Deckel an/aus, Inventar
auffüllen, Layout speichern/laden/zurücksetzen, Selbsttests ausführen, Zufallsstation mit N Modulen
erzeugen (für die Lesbarkeitsprüfung F4).

### 6.4 Persistenz (`persist.ts`)

`localStorage`, Schlüssel `proto:01-tower-building:layout`:

```ts
{ v: 1, slots: 4,
  placed:    [{ uid, defId, rarity, cx, cy, rot }],
  inventory: [{ uid, defId, rarity }] }
```

Beim Laden werden die Polygone neu erzeugt und die Ecken **neu verschweißt**, damit gemeinsame
Kanten trotz gerundeter Speicherwerte exakt erkannt werden. Zweck ist nicht das Speichern selbst,
sondern die Prüfung, ob das Datenmodell serialisierbar ist — das Speicherformat des Spiels wird
davon abgeleitet (GDD 16 §8).

---

## 7. Dateien

```
01-tower-building/
├── PLAN.md        ← dieses Dokument
├── README.md      ← Leitfrage, Bedienung, Ergebnis
├── index.html
├── style.css
├── main.ts        Einstieg: Zustand, feste Zeitschritte, Verdrahtung
├── geometry.ts    Vektoren, Polygone, attachTo, Überlappung, Schweißen  (rein)
├── shapes.ts      Footprints, Embleme, Emblem-Pfade
├── model.ts       Typen
├── catalog.ts     Turmdaten, Raritäten, Buff-Deckel — einziger Ort mit Zahlen
├── station.ts     Bauregeln: freeEdges / canPlace / place / move / remove / isConnected
├── buffs.ts       Nachbarschaft, Buff-Berechnung, effektive Werte, DPS-Kennzahl
├── camera.ts      Auto-Zoom, Welt ↔ Bildschirm
├── render.ts      Canvas-Zeichnung
├── input.ts       Maus/Tastatur → Aktionen
├── ui.ts          Inventar, Detailpanel, HUD, Debug-Panel
├── persist.ts     localStorage, Serialisierung des Datenmodells
├── devtools.ts    Zufallsstationen für die Auswertung — kein Teil der Spielregeln
└── selftest.ts    Zusicherungen für geometry / station / buffs / persist
```

**Abhängigkeitsrichtung** — strikt einseitig, damit die Regelschicht ohne Browser lauffähig bleibt:

```
geometry ← shapes ← model ← catalog ← station ← buffs
                                                  ↑
                    camera ← render ← main → input → ui → persist
```

`geometry`, `station` und `buffs` kennen weder DOM noch Canvas. Genau diese drei sind der Teil,
der später ins Spiel übernommen wird.

---

## 8. Umsetzung in Etappen

Jede Etappe endet mit einem sichtbaren, bedienbaren Stand.

| # | Etappe | Inhalt | Fertig, wenn … |
|---|---|---|---|
| **M0** | Gerüst | `_template` kopiert, Canvas + feste Zeitschritte, HUD | Der Hauptturm liegt als Hexagon sichtbar mittig im Bild |
| **M1** | Geometrie | `geometry.ts` + `shapes.ts` komplett, `attachTo`, Schweißen, Überlappungstest | Ein fest verdrahtetes Testlayout (Skizze nachgebaut: Pentagon, 3 Dreiecke, Viereck am Core) wird korrekt und lückenbündig gezeichnet. Selbsttests grün |
| **M2** | Daten & Inventar | `model.ts`, `catalog.ts` mit allen 8 Turmarten, Inventarliste mit Form + Kantenzahl | Alle Turmarten stehen mit Form, Emblem, Farbe und Rarität in der Liste |
| **M3** | Andocken | `station.ts` (`freeEdges`, `canPlace`, `place`), Kanten-Hervorhebung, Ghost, Platzlimit | Module lassen sich nur an freie Kanten setzen, Überlappung wird abgelehnt, bei 4 belegten Plätzen wird sauber blockiert |
| **M4** | Umbauen | Entfernen, Verschieben, `isConnected`, Regelvariante A/B umschaltbar | Umbauen ohne Neuladen; keine Insel-Module (A) bzw. Inseln wandern zurück (B) |
| **M5** | Buffs | `buffs.ts`, Kanten-Nachbarschaft, Buff-Linien, Detailpanel `Basis → effektiv`, DPS im HUD | Zwei Amplifier an einem Autocannon zeigen gestapelte Boni; Amplifier neben Amplifier zeigt **keinen** Effekt; zwei nur eckberührende Module zeigen **keine** Buff-Linie |
| **M6** | Optik | Fugen-Rendering, Raritätsrahmen, Embleme, Auto-Zoom, Reichweitenkreise | Eine Station mit 15 Modulen sieht aus wie die Zielskizze und ist auf einen Blick lesbar — oder nachweislich nicht |
| **M7** | Auswertung | `persist.ts`, Debug-Panel, Messungen zu F1–F8, `README.md` mit Ergebnis | Alle offenen Fragen aus Abschnitt 10 sind mit Begründung beantwortet |

**Empfohlener Abbruchpunkt:** Nach **M3** ist bereits klar, ob sich das Andocken gut anfühlt —
das ist die teuerste Erkenntnis und kommt damit früh. Nach **M5** ist die Leitfrage im Kern
beantwortet; M6/M7 lohnen nur, wenn das Bauen bis dahin überzeugt.

---

## 9. Prüfung ohne Testframework

Keine Testabhängigkeit. Stattdessen `selftest.ts`: Zusicherungen, die per `?selftest` in der
Adresszeile laufen und in Konsole und Debug-Panel schreiben. Geprüft werden nur die reinen
Funktionen — dort, wo Fehler still bleiben.

| Bereich | Zusicherung |
|---|---|
| `geometry` | `apothem(6) × 2 / SIDE = √3` und entsprechende bekannte Werte für n = 3,4,5 |
| `geometry` | `polygonAt` liefert n Ecken mit exakt Seitenlänge `SIDE` (Toleranz 1e-9) |
| `geometry` | Ein an Kante `e` angedocktes Modul enthält `e` als eigene Kante (nach Schweißen deckungsgleich) |
| `geometry` | Angedocktes Modul überlappt das Ausgangsmodul **nicht** (Berührung ≠ Überlappung) |
| `geometry` | Zwei Hexagone an benachbarten Kanten eines Hexagons teilen ihrerseits eine Kante |
| `geometry` | Zwei Vierecke an benachbarten Kanten eines Hexagons teilen **nur eine Ecke**, keine Kante |
| `geometry` | Sechs Dreiecke um eine Ecke schließen exakt (Winkelsumme 360°, keine Überlappung) |
| `station` | Der Hauptturm hat anfangs genau 6 freie Kanten |
| `station` | Ein angedocktes n-Eck ohne weitere Berührung ändert die Zahl freier Kanten um genau `n − 2` (Andockkante wird belegt, `n − 1` kommen hinzu); jede zusätzliche Berührung senkt sie um weitere 2 |
| `station` | Eine Platzierung, die ein bestehendes Modul schneiden würde, liefert `'overlap'` |
| `station` | Platzlimit liefert `'no_slots'`, nicht platziert |
| `station` | Verschieben auf eine Kante, die nur durch das bewegte Modul selbst existiert, wird abgelehnt |
| `station` | `isConnected` erkennt die Kette `A—B—Core` beim Entfernen von `B` als Bruch |
| `station` | Entferntes Modul ist danach genau einmal im Inventar und nicht mehr platziert |
| `buffs` | Zwei Amplifier auf denselben Turm ergeben die Summe beider Boni |
| `buffs` | Amplifier neben Amplifier erzeugt keinen Bonus |
| `buffs` | Über dem Deckel wird auf den Deckel begrenzt |
| `buffs` | Nur eckberührende Module gelten nicht als Nachbarn |
| `buffs` | Ein Modul ohne Buff-Nachbarn hat `final === base` |
| `persist` | Speichern → Laden ergibt dieselbe Nachbarschaftsstruktur (Rundlauf) |

---

## 10. Offene Fragen, die der Prototyp beantworten soll

Das ist der eigentliche Ertrag. Jede Frage bekommt im `README.md` eine Antwort mit Begründung.

| # | Frage | Wie gemessen |
|---|---|---|
| **F1** | Fühlt sich das Einrasten an Kanten gut an oder zappelig? | Bei dicht bebauter Station gezielt an eine bestimmte Kante bauen — wie oft landet das Modul woanders? Braucht es einen Mindestabstand zum Kantenwechsel? |
| **F2** | Entfernen, das die Station zerteilt: blockieren (A) oder Module zurückgeben (B)? | Denselben Umbau in beiden Varianten durchspielen |
| **F3** | Wie stark begrenzt die Geometrie den Bau? | Bei 15 Modulen zählen, wie viele freie Kanten wegen Überlappung unbrauchbar sind. Über ~30 % wäre frustrierend |
| **F4** | Bleiben Module bei automatischem Zoom unterscheidbar? | Ab welcher Modulanzahl kippt die Lesbarkeit? Reicht Form + Emblem, oder braucht jede Turmart eine eigene Farbe? |
| **F5** | Ist die Formwahl eine interessante Entscheidung? | Fünfeck-Amplifier (5 Kanten) gegen Dreieck-Turm (3 Kanten): entstehen dadurch erkennbar verschiedene Bauformen? |
| **F6** | Buff-Linien dauerhaft oder nur bei Auswahl/Hover? | Dauerhaft bei 15 Modulen — Informationsgewinn oder Liniensalat? |
| **F7** | Ab wie vielen Nachbarn schlägt ein Buff-Turm einen weiteren Kampfturm? | DPS-Kennzahl mit Amplifier bei 1/2/3/4/5 Nachbarn gegen einen zusätzlichen Autocannon |
| **F8** | Ist die vollständige Neuberechnung schnell genug? | Zeit für `computeStation` + `freeEdges` bei 20 Modulen messen (Erwartung: deutlich unter 1 ms) |
| **F9** | Sind die entstehenden Lücken schön oder wirken sie kaputt? | Station mit vielen Fünfecken bauen und ansehen. Falls störend: Lücken dunkel füllen statt offen lassen |
| **F10** | Soll der **Hauptturm** selbst Buffs von angrenzenden Amplifiern erhalten? | Im Prototyp umgesetzt: ja. Das macht die sechs Kernkanten zum wertvollsten Bauplatz. Prüfen, ob dadurch jeder Build gleich aussieht („immer Amplifier an den Kern") — dann wäre die Antwort nein |

F2, F5, F9 und F10 sind **GDD-relevant** und müssen anschließend in
[GDD 03](../../docs/gdd/03-modulare-basis-und-bauregeln.md) nachgetragen werden — zusammen mit der
Ersetzung von § 3 (siehe Abschnitt 0).

---

## 11. Übernahme ins Spiel

Nach Abschluss wird **nicht** gemerged. Übernommen wird:

| Was | Wie |
|---|---|
| `geometry.ts` | praktisch unverändert — reine Mathematik, im Spiel identisch |
| `station.ts`, `buffs.ts` | als Vorlage; im Spiel neu geschrieben gegen den echten Zustand |
| Katalogstruktur (Footprint + Emblem) | Struktur ja, Werte nein — Balancing kommt aus GDD 15 |
| Rendering, Eingabe, UI | nur als Referenz; im Spiel gegen die echte Kampfansicht neu gebaut |
| Antworten auf F1–F9 | als Änderung ins GDD, insbesondere Ersatz von 03 § 3 |

Der Prototyp bleibt danach unverändert liegen und wird nicht gepflegt.
