/**
 * Turmarten als Datensaetze (GDD 05, GDD 16 Abschnitt 5).
 *
 * Ein neuer Turm soll allein durch einen Eintrag hier entstehen - kein neuer Code, solange
 * keine neue **Mechanik** dazukommt. Die restlichen Turmarten folgen in E14.
 *
 * Die Grundflaeche ist eine Balance-Entscheidung, keine Optik (GDD 03 Abschnitt 7): Ein
 * Buff-Turm als Sechseck erreicht bis zu 6 Module, als Dreieck nur 3 - bei gleichem
 * Turmplatz-Preis. Welche Formen es ueberhaupt gibt und warum es genau diese drei sind,
 * steht bei `FootprintSides` in `data/types.ts`; welcher Turm welche bekommt, steht bei
 * `TOWERS` weiter unten.
 *
 * ACHTUNG - PLATZHALTER: Die Kampfwerte sind aus Prototyp 01 uebernommen und dienen nur
 * dazu, dass ueberhaupt gerechnet werden kann. Verbindlich werden sie erst beim Justieren
 * nach E9 (GDD 15 Abschnitt 16).
 */

import type { TargetMode } from '../sim/targeting.ts'
import {
  makeStats,
  NO_STATS,
  type Category,
  type CombatStats,
  type Emblem,
  type FootprintSides,
  type StatKey,
  type TowerClass,
} from './types.ts'

/**
 * Die Spezialmechanik eines Turms (GDD 05 Abschnitt 2).
 *
 * **Ein Turm, eine Mechanik.** Genau das war die Abnahmebedingung von E14: Jede neue
 * Turmart ist ein Datensatz plus hoechstens eine Mechanikfunktion. Die Funktionen liegen in
 * `sim/combat.ts` (`applyExplosion`, `applyChain`, `applyBurn`, `applyChill`) und in
 * `sim/drones.ts` - keine von ihnen kennt einen Turm.
 *
 * Fehlt der Eintrag, verschiesst der Turm ein gewoehnliches Geschoss.
 */
export type TowerMechanic =
  /** Der Laser trifft **sofort**, ohne Flugzeit - dafuer immer nur ein Ziel. */
  | { kind: 'beam' }
  /** Rakete und Plasma: Der Einschlag reisst einen Umkreis mit. */
  | { kind: 'explosive'; radius: number; share: number }
  /** Tesla: Der Blitz springt weiter und verliert dabei an Kraft. */
  | { kind: 'chain'; hops: number; falloff: number }
  /** Flammen: Der Treffer brennt nach. */
  | { kind: 'burn'; dps: number; duration: number }
  /** Eis und Void: Der Treffer verlangsamt. */
  | { kind: 'chill'; factor: number; duration: number }
  /** Schildgenerator: kein Schuss, sondern mehr gemeinsame Huelle (GDD 03 Abschnitt 5). */
  | { kind: 'hull'; amount: number }
  /** Drohnenmodul: eigene bewegliche Einheiten (GDD 05, GDD 03 Abschnitt 6). */
  | { kind: 'drones'; count: number; damage: number; range: number; interval: number }

export type TowerDef = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  name: string
  sides: FootprintSides
  emblem: Emblem
  category: Category
  /**
   * Turmklasse - wovon dieser Turm im Upgrade-Menue mitprofitiert (`data/types.ts`).
   *
   * Sie steht **neben** `category` und nicht statt ihr: `category` ist die Buff-Regel,
   * `class` der Name der Gruppe. Ein Turm gehoert genau einer Klasse an; ohne sie waere er
   * von jedem Gruppen-Upgrade ausgenommen, ohne dass es auffiele.
   */
  class: TowerClass
  stats: CombatStats
  /** Spezialmechanik. Ohne Angabe: gewoehnliches Geschoss. */
  mechanic?: TowerMechanic
  /**
   * Prestige-Knoten, der diese Turmart freischaltet (GDD 10, Bereich 4). Ohne Angabe steht
   * sie von Anfang an zur Verfuegung.
   */
  unlock?: string
  /** Nur bei `category: 'buff'`: Wirkung auf kantenbenachbarte Nicht-Buff-Module. */
  buffs?: { stat: StatKey; amount: number }[]
  /**
   * Abweichende Zielprioritaet (GDD 05 Abschnitt 4). Ohne Angabe: naechster Gegner.
   * Angedockte Gegner haben immer Vorrang, unabhaengig davon.
   */
  targetMode?: TargetMode
  /**
   * Leitfarbe fuer Emblem, Reichweitenkreis und Buff-Linien. Werte aus PALETTE
   * (`render/theme.ts`), hier ausgeschrieben, weil `data/` nichts aus `render/` zieht.
   * Angriffstuerme bleiben in der Cyan-Gold-Achse, Buff-Tuerme sind violett - so ist eine
   * Buff-Linie nie mit einer Bauhilfe zu verwechseln.
   */
  accent: string
  description: string
}

/**
 * **Die Kantenzahl folgt der Staerke.**
 *
 * Vorher war die Form frei gewaehlt und hat der Wirkung gefolgt: wenige Kanten fuer harte
 * Einzelziel-Tuerme, viele fuer Streuung und Unterstuetzung. Das war schluessig, aber der
 * Spieler konnte es nicht lesen - ein Dreieck sagte ihm nichts darueber, was er in der Hand
 * hat. Jetzt sagt es das Wichtigste: **Mehr Kanten heisst staerkerer Turm.**
 *
 * Der Massstab dafuer ist nicht geschaetzt, sondern die Raritaetsuntergrenze aus
 * `data/rarities.ts` - die einzige Zahl im Spiel, die "wie stark ist diese Turmart" schon
 * beantwortet, und dieselbe, die der Spieler als Rahmenfarbe ohnehin vor sich hat:
 *
 *   Common -> Dreieck    Rare -> Quadrat    Epic -> Quadrat    Legendary/Mythic -> Sechseck
 *
 * Drei Formen auf fuenf Stufen, weil es nur drei zugelassene Formen gibt (Herleitung bei
 * `FootprintSides` in `data/types.ts`). Gaebe man das Zwoelfeck frei, bekaeme Mythic seine
 * eigene Stufe. `selftest/suites/station.ts` haelt die Leiter nach: Eine seltenere Turmart
 * darf **nie** weniger Kanten haben als eine haeufigere.
 *
 * Was mehr Kanten wirklich einbringen, und warum das ein Preis fuer Seltenheit sein darf:
 * mehr Nachbarn (also mehr Buff-Verbindungen), mehr eigene freie Kanten (also mehr Raum zum
 * Weiterbauen), und eine groessere Grundflaeche, die den Turm weiter nach aussen setzt - was
 * seine Reichweite ab Stationsmitte verlaengert, siehe unten. Alles drei ist Vorteil; bezahlt
 * wird er dadurch, dass die Turmart selten faellt und der Turmpreis mit jedem Kauf steigt.
 *
 * **Die eine Ausnahme sind Buff-Tuerme.** Bei ihnen sind die Kanten nicht Staerke, sondern
 * Funktion: Ein Verstaerker, der nur drei Module erreicht, reisst die Schwelle b > 1/k aus
 * GDD 03 Abschnitt 9 nie. Der Verstaerker ist deshalb ein Sechseck, obwohl er ab Common
 * faellt - und seine 20 % halten dort die Schwelle 1/6 = 16,7 %.
 *
 * ---
 *
 * Zur Reichweite: Der Massstab ist **nicht** die Zahl beim Turm, sondern wie weit er ab der
 * **Stationsmitte** reicht - und damit der Kern mit seinen 220 (`data/cores.ts`).
 *
 * Ein Turm legt seine Reichweite an seinem eigenen Modul an (GDD 05 Abschnitt 4), und das
 * sitzt am ersten Ring 65 bis 97 Einheiten vor der Mitte: Dreieck 64,7 - Quadrat 76,5 -
 * Sechseck 97,0 (Kern-Apothem 48,5 plus das des Turms, `MODULE_SIDE` = 56). Was zaehlt, ist
 * die Summe aus beidem.
 *
 * Genau daran scheiterte die vorherige Fassung: Sie hatte alle Reichweiten anteilig auf 70 %
 * gekuerzt (2026-08-04), weil die Vereinigung aller Wirkungskreise die Station optisch
 * erschlagen hatte. Das Ergebnis war ein Autocannon mit 100 - ab Mitte also 176, **innerhalb**
 * der 220 des Kerns. Sein Kreis lag vollstaendig im Kernkreis, er schoss auf nichts, worauf
 * der Kern nicht ohnehin schon schoss, und ein Turmplatz brachte sichtbar nichts. Dasselbe
 * galt fuer Kanone und Cryo (216) und den Flamer (150).
 *
 * Die Kuerzung ist deshalb zurueckgenommen, aber **nicht anteilig**: Anteilig haette den
 * Marksman auf 700 ab Mitte gehoben, weiter als der Erscheinungsring der Gegner
 * (`spawnRadius` in `sim/enemies.ts`, rund 520 bei kleiner Station) - er haette dann schon
 * beim Erscheinen geschossen und den Anmarsch als Spielphase gestrichen. Stattdessen ist der
 * **Boden angehoben** und die Spitze nur moderat: Jeder Angriffsturm reicht ab Mitte ueber
 * den Kern hinaus, der Marksman kommt auf 405 und laesst dem Anmarsch Luft.
 *
 * Die Rangfolge ist dabei unveraendert - Flamer bleibt der kuerzeste, der Marksman reicht
 * weiter als der Laser (GDD 05: "Reichweite: sehr hoch" meint einen Vergleich unter Tuermen,
 * keinen festen Wert). Ab Mitte am ersten Ring, nachgerechnet mit den neuen Formen:
 *
 *   Flamer 246 - Autocannon 250 - Tesla 271 - Cannon 280 - Cryo 281 - Rocket 301 -
 *   Laser 326 - Void 332 - Plasma 342 - Drohnen 349 - Marksman 405
 *
 * Die Formleiter hat diese Liste verschoben, ohne eine ihrer Regeln zu brechen: Der Flamer
 * ist weiter der kuerzeste, der Marksman reicht weiter als der Laser, und der niedrigste
 * Wert (246) liegt weiter ueber den 220 des Kerns. Die `range`-Zahlen in den Datensaetzen
 * sind deshalb unangetastet - verschoben hat sich nur, wie weit aussen das Modul sitzt.
 *
 * Fuer den Bildausschnitt ist das folgenlos: `rangeAllowance` (`render/camera.ts`) nimmt
 * ohnehin nur einen gedeckelten Anteil auf (260), und den erreicht bereits ein einzelner
 * gebauter Turm.
 */
export const TOWERS: readonly TowerDef[] = [
  {
    /** Dreieck: der guenstigste Turm im Spiel - und damit der Universal-Fuellstein. */
    id: 'autocannon',
    name: 'Autocannon',
    sides: 3,
    emblem: 'bars',
    category: 'attack',
    class: 'kinetic',
    stats: makeStats(8, 6, 185, 0.05, 520),
    accent: '#46c8ff',
    description: 'Rapid fire. Low damage per shot, very high rate.',
  },
  {
    id: 'cannon',
    name: 'Siege Cannon',
    sides: 3,
    emblem: 'chevron',
    category: 'attack',
    class: 'kinetic',
    stats: makeStats(90, 0.6, 215, 0.1, 300),
    accent: '#ffcc33',
    description: 'Heavy gun. High damage, slow, good range.',
  },
  {
    /**
     * Der Buff-Turm - und die **eine Ausnahme** von der Formleiter: Er faellt ab Common und
     * ist trotzdem die groesste Form. Bei ihm sind Kanten keine Staerke, sondern Funktion.
     *
     * Sechseck, weil er damit bis zu 6 Module erreicht und die Schwelle b > 1/k aus GDD 03
     * Abschnitt 9 sonst nicht zu halten ist - bei 6 Kanten sind das 16,7 %, seine 20 %
     * liegen darueber.
     *
     * Er war ein Fuenfeck, und das war der schlimmste Platz fuer diese Form: Das GDD
     * empfiehlt, ihn **zuerst** zu setzen und darum herum zu bauen. Jede Station begann
     * damit mit den 108 Grad, die keine Ecke schliessen (Herleitung bei `FootprintSides`),
     * und der Spieler bekam beim Fuellen der Restluecke die Sperrfarbe.
     */
    id: 'amplifier',
    name: 'Power Amplifier',
    sides: 6,
    emblem: 'star',
    category: 'buff',
    class: 'support',
    stats: NO_STATS,
    buffs: [{ stat: 'damage', amount: 0.2 }],
    accent: '#b45cff',
    description: 'Boosts damage of every module sharing an edge. Place it first, build around it.',
  },

  /*
   * Ab hier die Tuerme aus E14 (GDD 05 Abschnitt 5).
   *
   * Die **Form ist keine Optik**, sondern eine Balance-Entscheidung: Sie legt fest, wie
   * viele Nachbarn ein Turm haben kann und damit, wie viele Buff-Verbindungen moeglich
   * sind (GDD 05, Hinweis zur Form). Ein Dreieck erreicht drei, ein Sechseck sechs - und
   * weil sie der Raritaetsuntergrenze folgt, liest der Spieler an der Form ab, wie stark
   * die Turmart ist.
   *
   * "Spezialtuerme sind keine besseren Tuerme" (GDD 05 Abschnitt 6): Jeder von ihnen kann
   * etwas, das kein anderer kann - und bezahlt dafuer an anderer Stelle.
   */
  {
    /** Dreieck: faellt ab Common - sehr weit und sehr langsam, aber kein seltener Turm. */
    id: 'sniper',
    name: 'Marksman',
    sides: 3,
    emblem: 'chevron',
    category: 'attack',
    class: 'kinetic',
    stats: makeStats(220, 0.35, 340, 0.25, 900),
    // Keine eigene Mechanik - seine Identitaet ist die Zielwahl. Genau so soll ein neuer
    // Turm im Regelfall aussehen: ein Datensatz.
    targetMode: 'strongest',
    accent: '#7fd8ff',
    description: 'Extreme range and damage, very slow. Always shoots the strongest target.',
  },
  {
    id: 'rocket',
    name: 'Rocket Battery',
    sides: 4,
    emblem: 'chevron',
    category: 'area',
    class: 'kinetic',
    stats: makeStats(55, 0.8, 225, 0.05, 260),
    mechanic: { kind: 'explosive', radius: 90, share: 0.7 },
    unlock: 'tech.rocket',
    accent: '#ff9a3c',
    description: 'Explosive rockets. Strong against groups, slow against single targets.',
  },
  {
    /** Der Dauerstrahl: trifft ohne Flugzeit, dafuer immer nur eines. */
    id: 'laser',
    name: 'Laser Lance',
    sides: 4,
    emblem: 'bars',
    category: 'special',
    class: 'elemental',
    stats: makeStats(34, 6, 250, 0.08, 0),
    mechanic: { kind: 'beam' },
    unlock: 'tech.laser',
    accent: '#2ee0c0',
    description: 'A continuous beam that never misses. Best against bosses and tanks.',
    targetMode: 'boss',
  },
  {
    id: 'tesla',
    name: 'Tesla Coil',
    sides: 4,
    emblem: 'star',
    category: 'special',
    class: 'elemental',
    stats: makeStats(26, 2.2, 195, 0.05, 700),
    mechanic: { kind: 'chain', hops: 3, falloff: 0.6 },
    unlock: 'tech.tesla',
    accent: '#b45cff',
    description: 'Lightning jumps between enemies. Strong against groups, weak on bosses.',
  },
  {
    id: 'flamer',
    name: 'Flame Projector',
    sides: 4,
    emblem: 'bars',
    category: 'area',
    class: 'elemental',
    stats: makeStats(9, 5, 170, 0.02, 420),
    mechanic: { kind: 'burn', dps: 26, duration: 3 },
    accent: '#ff6a2d',
    description: 'Short range, sets enemies on fire. The burn keeps working after the shot.',
  },
  {
    id: 'cryo',
    name: 'Cryo Emitter',
    sides: 4,
    emblem: 'star',
    category: 'special',
    class: 'elemental',
    stats: makeStats(14, 1.6, 205, 0.03, 480),
    mechanic: { kind: 'chill', factor: 0.55, duration: 2.5 },
    accent: '#7fd8ff',
    description: 'Slows what it hits. Buys the other towers time.',
  },
  {
    /** Kein Schuss - er macht die gemeinsame Huelle dicker (GDD 03 Abschnitt 5). */
    id: 'bulwark',
    name: 'Shield Generator',
    sides: 4,
    emblem: 'core',
    category: 'support',
    class: 'support',
    stats: NO_STATS,
    mechanic: { kind: 'hull', amount: 320 },
    accent: '#2ee0c0',
    description: 'Does not shoot. Adds hull to the whole station.',
  },
  {
    id: 'plasma',
    name: 'Plasma Cannon',
    sides: 6,
    emblem: 'star',
    category: 'area',
    class: 'elemental',
    stats: makeStats(140, 0.7, 245, 0.12, 320),
    mechanic: { kind: 'explosive', radius: 130, share: 0.85 },
    unlock: 'tech.plasma',
    accent: '#ff2d78',
    description: 'Unstable plasma. Huge explosions, endgame firepower.',
  },
  {
    id: 'void',
    name: 'Void Sphere',
    sides: 6,
    emblem: 'core',
    category: 'special',
    class: 'elemental',
    stats: makeStats(70, 1.1, 235, 0.1, 300),
    mechanic: { kind: 'chill', factor: 0.4, duration: 3.5 },
    accent: '#8f7dff',
    description: 'Black energy spheres that slow everything they touch.',
  },
  {
    /**
     * Drohnen belegen keinen Bauplatz und sind nicht angreifbar (GDD 03 Abschnitt 6) -
     * das Modul selbst schon.
     */
    id: 'dronebay',
    name: 'Drone Bay',
    sides: 6,
    emblem: 'star',
    category: 'special',
    class: 'support',
    stats: NO_STATS,
    // Die Drohne misst ab sich selbst, nicht ab ihrem Modul (`sim/drones.ts`): Zum
    // Anbauabstand kommt ihre Kreisbahn (62). Ab Mitte sind das 349 - deshalb steht hier
    // eine kleinere Zahl als bei Tuermen, die vergleichbar weit reichen.
    mechanic: { kind: 'drones', count: 3, damage: 26, range: 190, interval: 0.8 },
    unlock: 'tech.drone',
    accent: '#46c8ff',
    description: 'Launches combat drones that circle the station and fire on their own.',
  },
]

const BY_ID = new Map(TOWERS.map((tower) => [tower.id, tower]))

export function towerById(id: string): TowerDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekannte Turmart: ${id}`)
  return def
}

export function isKnownTower(id: string): boolean {
  return BY_ID.has(id)
}

/**
 * Alle Turmarten einer Klasse (`data/types.ts`).
 *
 * Der eine Zugang, ueber den Gruppen-Upgrades ihre Ziele finden. Er wird **erfragt** und
 * steht nicht als Liste in `data/upgrades.ts`: Ein neuer Turm bringt seine Klasse mit und
 * ist damit sofort von allen Upgrades seiner Gruppe erfasst, ohne dass dort eine Zeile
 * dazukommt. Genau das ist der Unterschied zu einer aufgezaehlten Turmliste, die bei jedem
 * neuen Turm nachgepflegt werden muesste - und beim ersten Vergessen still danebenliegt.
 */
export function towersOfClass(towerClass: TowerClass): TowerDef[] {
  return TOWERS.filter((tower) => tower.class === towerClass)
}
