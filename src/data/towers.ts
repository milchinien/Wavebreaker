/**
 * Turmarten als Datensaetze (GDD 05, GDD 16 Abschnitt 5).
 *
 * Ein neuer Turm soll allein durch einen Eintrag hier entstehen - kein neuer Code, solange
 * keine neue **Mechanik** dazukommt. Die restlichen Turmarten folgen in E14.
 *
 * Die Grundflaeche ist eine Balance-Entscheidung, keine Optik (GDD 03 Abschnitt 7): Ein
 * Buff-Turm als Fuenfeck erreicht bis zu 5 Module, als Dreieck nur 3 - bei gleichem
 * Turmplatz-Preis.
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
 * Zur Reichweite: Sie ist bei **allen** Tuermen auf 70 % ihres urspruenglichen Wertes
 * gekuerzt (2026-08-04).
 *
 * Der Grund liegt nicht am einzelnen Turm, sondern an der Summe. Was der Spieler sieht, ist
 * die Vereinigung aller Wirkungskreise (`rangeCircles` in `sim/towers.ts`), und ein Turm
 * bringt seinen Anbauabstand mit: Er sitzt rund 65 bis 97 Einheiten vor dem Kern und legt
 * seine Reichweite **dort** an. Der Marksman kam damit auf 485 Einheiten ab der Mitte,
 * mehr als das Doppelte des Kerns (220) - die Station verschwand in ihrem eigenen
 * Wirkungsbereich, und weil der Bildausschnitt ihn mit einrechnet, wurde sie im Bild
 * entsprechend klein.
 *
 * Gekuerzt wurde **anteilig und ausnahmslos**, nicht turmweise nachjustiert: Jeder Abstand
 * zwischen zwei Tuermen bleibt damit genau erhalten, der Marksman reicht weiter als der
 * Laser und der Flamer bleibt der kuerzeste. Ein Deckel haette dieselbe Zahl fuer mehrere
 * Tuerme erzwungen und ihre Rangfolge eingeebnet - und "Reichweite: sehr hoch" aus GDD 05
 * meint einen Vergleich unter Tuermen, keinen festen Wert.
 */
export const TOWERS: readonly TowerDef[] = [
  {
    id: 'autocannon',
    name: 'Autocannon',
    sides: 4,
    emblem: 'bars',
    category: 'attack',
    stats: makeStats(8, 6, 100, 0.05, 520),
    accent: '#46c8ff',
    description: 'Rapid fire. Low damage per shot, very high rate.',
  },
  {
    id: 'cannon',
    name: 'Siege Cannon',
    sides: 4,
    emblem: 'chevron',
    category: 'attack',
    stats: makeStats(90, 0.6, 140, 0.1, 300),
    accent: '#ffcc33',
    description: 'Heavy gun. High damage, slow, good range.',
  },
  {
    /**
     * Der Buff-Turm. Fuenfeck, weil er damit bis zu 5 Module erreicht - die Schwelle
     * b > 1/k aus GDD 03 Abschnitt 9 ist sonst nicht zu halten.
     */
    id: 'amplifier',
    name: 'Power Amplifier',
    sides: 5,
    emblem: 'star',
    category: 'buff',
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
   * sind (GDD 05, Hinweis zur Form). Ein Dreieck erreicht drei, ein Hexagon sechs.
   *
   * "Spezialtuerme sind keine besseren Tuerme" (GDD 05 Abschnitt 6): Jeder von ihnen kann
   * etwas, das kein anderer kann - und bezahlt dafuer an anderer Stelle.
   */
  {
    /** Dreieck: sehr weit, sehr langsam - dafuer nur drei Nachbarn. */
    id: 'sniper',
    name: 'Marksman',
    sides: 3,
    emblem: 'chevron',
    category: 'attack',
    stats: makeStats(220, 0.35, 295, 0.25, 900),
    // Keine eigene Mechanik - seine Identitaet ist die Zielwahl. Genau so soll ein neuer
    // Turm im Regelfall aussehen: ein Datensatz.
    targetMode: 'strongest',
    accent: '#7fd8ff',
    description: 'Extreme range and damage, very slow. Always shoots the strongest target.',
  },
  {
    id: 'rocket',
    name: 'Rocket Battery',
    sides: 3,
    emblem: 'chevron',
    category: 'area',
    stats: makeStats(55, 0.8, 160, 0.05, 260),
    mechanic: { kind: 'explosive', radius: 90, share: 0.7 },
    unlock: 'tech.rocket',
    accent: '#ff9a3c',
    description: 'Explosive rockets. Strong against groups, slow against single targets.',
  },
  {
    /** Der Dauerstrahl: trifft ohne Flugzeit, dafuer immer nur eines. */
    id: 'laser',
    name: 'Laser Lance',
    sides: 3,
    emblem: 'bars',
    category: 'special',
    stats: makeStats(34, 6, 180, 0.08, 0),
    mechanic: { kind: 'beam' },
    unlock: 'tech.laser',
    accent: '#2ee0c0',
    description: 'A continuous beam that never misses. Best against bosses and tanks.',
    targetMode: 'boss',
  },
  {
    id: 'tesla',
    name: 'Tesla Coil',
    sides: 6,
    emblem: 'star',
    category: 'special',
    stats: makeStats(26, 2.2, 135, 0.05, 700),
    mechanic: { kind: 'chain', hops: 3, falloff: 0.6 },
    unlock: 'tech.tesla',
    accent: '#b45cff',
    description: 'Lightning jumps between enemies. Strong against groups, weak on bosses.',
  },
  {
    id: 'flamer',
    name: 'Flame Projector',
    sides: 3,
    emblem: 'bars',
    category: 'area',
    stats: makeStats(9, 5, 85, 0.02, 420),
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
    stats: makeStats(14, 1.6, 140, 0.03, 480),
    mechanic: { kind: 'chill', factor: 0.55, duration: 2.5 },
    accent: '#7fd8ff',
    description: 'Slows what it hits. Buys the other towers time.',
  },
  {
    /** Kein Schuss - er macht die gemeinsame Huelle dicker (GDD 03 Abschnitt 5). */
    id: 'bulwark',
    name: 'Shield Generator',
    sides: 6,
    emblem: 'core',
    category: 'support',
    stats: NO_STATS,
    mechanic: { kind: 'hull', amount: 320 },
    accent: '#2ee0c0',
    description: 'Does not shoot. Adds hull to the whole station.',
  },
  {
    id: 'plasma',
    name: 'Plasma Cannon',
    sides: 5,
    emblem: 'star',
    category: 'area',
    stats: makeStats(140, 0.7, 175, 0.12, 320),
    mechanic: { kind: 'explosive', radius: 130, share: 0.85 },
    unlock: 'tech.plasma',
    accent: '#ff2d78',
    description: 'Unstable plasma. Huge explosions, endgame firepower.',
  },
  {
    id: 'void',
    name: 'Void Sphere',
    sides: 5,
    emblem: 'core',
    category: 'special',
    stats: makeStats(70, 1.1, 170, 0.1, 300),
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
    stats: NO_STATS,
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
