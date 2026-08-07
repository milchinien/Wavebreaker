/**
 * Gegnerklassen als Datensaetze (GDD 07 Abschnitt 4).
 *
 * Die Werte sind **Vielfache** des Standard-Gegners, nicht absolute Zahlen: Der
 * Standard-Gegner ist per Definition 100 %. Damit laesst sich die gesamte Kurve ueber
 * `ENEMY_BASE_*` in `data/balance.ts` verschieben, ohne jede Gegnerart anzufassen.
 *
 * Der Spieler soll **ohne Text** erkennen, was auf ihn zukommt (GDD 07 Abschnitt 3):
 * Form, Farbe und Groesse zeigen die Rolle. Deshalb hat jede Art eine feste Farbe.
 *
 * Die Farben stammen aus PALETTE in `render/theme.ts` und stehen hier als Wert, weil `data/`
 * nichts aus `render/` zieht. Gegner bleiben in der Magenta-Familie, damit sie sich als
 * Bedrohung von der cyanfarbenen Station und dem goldenen Gold abheben; die Helligkeit
 * traegt dabei die Aussage: blass = schwach, satt = Standard, dunkel = zaeh.
 *
 * Spezialgegner, Elite-Modifikatoren und Bosse kommen in E15 dazu - sie sind weitere
 * Eintraege hier, kein neuer Code im Kampfkern.
 */

import {
  BOSS_DAMAGE_MULT,
  BOSS_GOLD_MULT,
  BOSS_HP_MULT,
  BOSS_SPEED_MULT,
  BOSS_XP_MULT,
} from './balance.ts'

export type EnemyShape = 'square' | 'triangle' | 'hexagon' | 'pentagon' | 'diamond'

/**
 * Was ein Gegner **kann** (GDD 07 Abschnitt 5).
 *
 * Jede Faehigkeit ist ein Datensatz, kein Sonderfall im Kampfkern. `sim/enemies.ts`
 * uebertraegt sie beim Erscheinen auf Felder am Gegner, `stepEnemyAbilities` laesst sie
 * laufen - und beide kennen nur die Felder, nicht die Gegnerart. Das ist die
 * Abnahmebedingung von E15: Ein neuer Gegner erfordert keine Aenderung am Kampfkern.
 */
export type EnemyAbility =
  /** Energieschild: faengt einen Anteil jedes Treffers ab. */
  | { kind: 'shield'; reduction: number }
  /** Reflektor: wirft einen Anteil des Schadens an die Station zurueck. */
  | { kind: 'reflect'; share: number }
  /** Berserker: wird staerker, je weniger Leben er hat. */
  | { kind: 'berserk'; maxBonus: number }
  /** Heiler: heilt andere Gegner im Umkreis. */
  | { kind: 'heal'; amount: number; radius: number; interval: number }
  /** Verstaerker: erhoeht Schaden und Tempo anderer Gegner im Umkreis. */
  | { kind: 'empower'; radius: number; damage: number; speed: number; interval: number }
  /** Tarn-Einheit: wechselt zwischen sichtbar und unsichtbar. */
  | { kind: 'cloak'; visible: number; hidden: number }
  /** Teleporter: ueberspringt in Abstaenden ein Stueck Weg zur Station hin. */
  | { kind: 'teleport'; distance: number; interval: number }
  /** Beschwoerer: erzeugt in Abstaenden weitere Gegner. */
  | { kind: 'spawn'; defId: string; count: number; interval: number }

export type EnemyDef = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  name: string
  shape: EnemyShape
  color: string
  /** Vielfaches der Standardwerte. Standard-Gegner = 1. */
  hp: number
  speed: number
  damage: number
  /** Radius in Welteinheiten. */
  size: number
  /** Gold auf Welle 1 (GDD 07 Abschnitt 4). Skaliert mit der Welle. */
  gold: number
  xp: number
  /** Ab welcher Welle diese Art ueberhaupt vorkommt (GDD 07 Abschnitt 11). */
  fromWave: number
  /** Relatives Gewicht in der Wellenmischung. 0 = erscheint nie regulaer. */
  weight: number
  /** Bosse ersetzen die Welle nicht, sie ergaenzen sie (GDD 07 Abschnitt 7). */
  isBoss?: boolean
  /** Ab welcher Welle dieser Boss der zustaendige ist. Nur bei `isBoss`. */
  bossFrom?: number
  /** Faehigkeiten dieser Art. Fehlt der Eintrag, ist es ein reiner Kampfgegner. */
  abilities?: readonly EnemyAbility[]
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'drone',
    name: 'Drone',
    shape: 'square',
    /** Magenta - der Standard, an dem sich alles andere misst. */
    color: '#ff2d78',
    hp: 1,
    speed: 1,
    damage: 1,
    size: 11,
    gold: 5,
    xp: 3,
    fromWave: 1,
    weight: 10,
  },
  {
    id: 'runner',
    name: 'Runner',
    shape: 'square',
    /** Gold - faellt aus der Magenta-Familie heraus, weil Tempo sofort auffallen muss. */
    color: '#ffcc33',
    hp: 0.4,
    speed: 2,
    damage: 0.7,
    size: 8,
    gold: 7,
    xp: 4,
    fromWave: 3,
    weight: 5,
  },
  {
    id: 'heavy',
    name: 'Heavy Unit',
    shape: 'hexagon',
    /** Dunkles Magenta - dieselbe Familie, aber schwerer. */
    color: '#c8215c',
    hp: 5,
    speed: 0.5,
    damage: 2,
    size: 17,
    gold: 25,
    xp: 14,
    fromWave: 8,
    weight: 2,
  },
  {
    /** Testet Flaechenschaden - deshalb erst, wenn es ihn gibt (GDD 07 Abschnitt 11). */
    id: 'swarm',
    name: 'Swarm Unit',
    shape: 'triangle',
    /** Blasses Magenta - einzeln ungefaehrlich, gefaehrlich nur in Menge. */
    color: '#ff7aa8',
    hp: 0.2,
    speed: 1,
    damage: 0.4,
    size: 6,
    gold: 1,
    xp: 1,
    fromWave: 50,
    weight: 14,
  },
  // -------------------------------------------------------------------------
  // Spezialgegner (GDD 07 Abschnitt 5)
  //
  // Sie kommen stufenweise dazu (GDD 07 Abschnitt 11): erst Schwaerme und Schilde, dann
  // Tarnung und Teleporter, zuletzt die Kombinationen. Jeder von ihnen stellt eine Frage
  // an den Build - "mein Build hat eine Schwaeche", nicht "ich brauche mehr Schaden".
  // -------------------------------------------------------------------------
  {
    id: 'shielded',
    name: 'Shield Unit',
    shape: 'hexagon',
    /** Blau - Energie und Schild (GDD 07 Abschnitt 3). */
    color: '#46c8ff',
    hp: 2.5,
    speed: 0.8,
    damage: 1.2,
    size: 14,
    gold: 18,
    xp: 10,
    fromWave: 55,
    weight: 4,
    // Konter laut GDD: hohe Einzelangriffe, Laser, Durchschuss - also Kanone und Laser
    // statt Maschinengewehr. Der Schild macht viele kleine Treffer wertlos.
    abilities: [{ kind: 'shield', reduction: 0.55 }],
  },
  {
    id: 'healer',
    name: 'Repair Node',
    shape: 'pentagon',
    /** Gruen - Heilung und Gift. */
    color: '#7fe83f',
    hp: 1.6,
    speed: 0.7,
    damage: 0.5,
    size: 12,
    gold: 22,
    xp: 14,
    fromWave: 70,
    weight: 3,
    abilities: [{ kind: 'heal', amount: 14, radius: 130, interval: 1.4 }],
  },
  {
    id: 'phantom',
    name: 'Phantom',
    shape: 'triangle',
    /** Violett - Spezialgegner. */
    color: '#b45cff',
    hp: 1.1,
    speed: 1.4,
    damage: 1.1,
    size: 10,
    gold: 20,
    xp: 12,
    fromWave: 210,
    weight: 4,
    // Konter: groessere Reichweite. Wer nur kurz reicht, verliert sie aus dem Ziel.
    abilities: [{ kind: 'cloak', visible: 1.6, hidden: 1.1 }],
  },
  {
    id: 'blink',
    name: 'Blink Drone',
    shape: 'diamond',
    color: '#8f7dff',
    hp: 0.9,
    speed: 1.1,
    damage: 1,
    size: 9,
    gold: 18,
    xp: 11,
    fromWave: 230,
    weight: 4,
    abilities: [{ kind: 'teleport', distance: 150, interval: 2.6 }],
  },
  {
    id: 'spawner',
    name: 'Hive Carrier',
    shape: 'square',
    /** Orange - Schwarm und Elite. */
    color: '#ff9a3c',
    hp: 4,
    speed: 0.45,
    damage: 1.4,
    size: 19,
    gold: 40,
    xp: 24,
    fromWave: 120,
    weight: 2,
    // Konter: Flaechenschaden. Wer ihn stehen laesst, bekommt seine Brut dazu - und die
    // zaehlt fuer den Wellenabschluss mit (GDD 07 Abschnitt 9).
    abilities: [{ kind: 'spawn', defId: 'swarm', count: 2, interval: 4.5 }],
  },
  {
    id: 'reflector',
    name: 'Reflector',
    shape: 'hexagon',
    /** Silber - Reflektoren. */
    color: '#c8d4e8',
    hp: 3,
    speed: 0.6,
    damage: 0.9,
    size: 15,
    gold: 30,
    xp: 18,
    fromWave: 260,
    weight: 2,
    abilities: [{ kind: 'reflect', share: 0.12 }],
  },
  {
    id: 'empowerer',
    name: 'Overseer',
    shape: 'pentagon',
    /** Gelb-Gruen - Verstaerker. */
    color: '#c8e83f',
    hp: 2.2,
    speed: 0.7,
    damage: 0.8,
    size: 13,
    gold: 28,
    xp: 18,
    fromWave: 150,
    weight: 2,
    abilities: [{ kind: 'empower', radius: 150, damage: 0.15, speed: 0.1, interval: 2 }],
  },
  {
    id: 'berserker',
    name: 'Berserker',
    shape: 'triangle',
    /** Rot-Schwarz - er kommt aus der Magenta-Familie, aber dunkler. */
    color: '#a01340',
    hp: 3.2,
    speed: 0.9,
    damage: 1.6,
    size: 16,
    gold: 26,
    xp: 16,
    fromWave: 90,
    weight: 3,
    abilities: [{ kind: 'berserk', maxBonus: 1.5 }],
  },

  // --- Belohnungsgegner (GDD 07 Abschnitt 5) ---
  {
    id: 'bullion',
    name: 'Bullion Unit',
    shape: 'square',
    /** Gold - seltene Belohnungsgegner. */
    color: '#ffcc33',
    hp: 6,
    speed: 0.6,
    damage: 0.6,
    size: 13,
    gold: 220,
    xp: 20,
    fromWave: 40,
    weight: 1,
  },
  {
    id: 'datacore',
    name: 'Data Core',
    shape: 'diamond',
    /** Hellblau - der leuchtende Erfahrungskern. */
    color: '#7fd8ff',
    hp: 1.2,
    speed: 0.9,
    damage: 0.4,
    size: 11,
    gold: 12,
    xp: 160,
    fromWave: 40,
    weight: 1,
  },

  // -------------------------------------------------------------------------
  // Bosse (GDD 07 Abschnitt 7)
  //
  // Sie erscheinen nicht ueber die Wellenmischung, sondern werden zu Beginn ihrer Welle
  // gesetzt - deshalb ueberall Gewicht 0. Welcher zustaendig ist, entscheidet `bossFrom`:
  // Der hoechste, dessen Schwelle erreicht ist, uebernimmt.
  // -------------------------------------------------------------------------
  {
    id: 'titan',
    name: 'Titan Core',
    shape: 'hexagon',
    /** Violett - verlaesst die Familie ganz, weil ein Boss keine Verwechslung erlaubt. */
    color: '#b45cff',
    hp: BOSS_HP_MULT,
    speed: BOSS_SPEED_MULT,
    damage: BOSS_DAMAGE_MULT,
    size: 40,
    gold: BOSS_GOLD_MULT,
    xp: BOSS_XP_MULT,
    fromWave: 10,
    bossFrom: 10,
    weight: 0,
    isBoss: true,
  },
  {
    /** Swarm Mother: erzeugt kleine Gegner - Konter ist Flaechenschaden. */
    id: 'swarmmother',
    name: 'Swarm Mother',
    shape: 'square',
    color: '#ff9a3c',
    hp: BOSS_HP_MULT * 1.4,
    speed: BOSS_SPEED_MULT * 1.1,
    damage: BOSS_DAMAGE_MULT,
    size: 44,
    gold: BOSS_GOLD_MULT * 1.5,
    xp: BOSS_XP_MULT * 1.5,
    fromWave: 50,
    bossFrom: 50,
    weight: 0,
    isBoss: true,
    abilities: [{ kind: 'spawn', defId: 'swarm', count: 3, interval: 3 }],
  },
  {
    /** Behemoth: Energieschild und hoher Schaden - Konter ist hoher Einzelschaden. */
    id: 'behemoth',
    name: 'Plasma Behemoth',
    shape: 'triangle',
    color: '#46c8ff',
    hp: BOSS_HP_MULT * 2,
    speed: BOSS_SPEED_MULT,
    damage: BOSS_DAMAGE_MULT * 1.6,
    size: 46,
    gold: BOSS_GOLD_MULT * 2,
    xp: BOSS_XP_MULT * 2,
    fromWave: 100,
    bossFrom: 100,
    weight: 0,
    isBoss: true,
    abilities: [{ kind: 'shield', reduction: 0.5 }],
  },
  {
    /** Void Entity: teleportiert sich - Konter ist Reichweite. */
    id: 'voidentity',
    name: 'Void Entity',
    shape: 'diamond',
    color: '#8f7dff',
    hp: BOSS_HP_MULT * 3,
    speed: BOSS_SPEED_MULT * 0.9,
    damage: BOSS_DAMAGE_MULT * 1.8,
    size: 44,
    gold: BOSS_GOLD_MULT * 3,
    xp: BOSS_XP_MULT * 3,
    fromWave: 200,
    bossFrom: 200,
    weight: 0,
    isBoss: true,
    abilities: [{ kind: 'teleport', distance: 220, interval: 4 }],
  },
  {
    /** Overlord: kombiniert mehrere Effekte - Konter ist ein angepasster Build. */
    id: 'overlord',
    name: 'Overlord Machine',
    shape: 'hexagon',
    color: '#ff2d78',
    hp: BOSS_HP_MULT * 5,
    speed: BOSS_SPEED_MULT * 0.8,
    damage: BOSS_DAMAGE_MULT * 2.2,
    size: 52,
    gold: BOSS_GOLD_MULT * 5,
    xp: BOSS_XP_MULT * 5,
    fromWave: 400,
    bossFrom: 400,
    weight: 0,
    isBoss: true,
    abilities: [
      { kind: 'shield', reduction: 0.35 },
      { kind: 'berserk', maxBonus: 1 },
      { kind: 'spawn', defId: 'drone', count: 2, interval: 5 },
    ],
  },
]

const BY_ID = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]))

export function enemyById(id: string): EnemyDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekannte Gegnerart: ${id}`)
  return def
}

/** Gegnerarten, die auf dieser Welle regulaer erscheinen duerfen - ohne Bosse. */
export function enemiesForWave(wave: number): EnemyDef[] {
  return ENEMIES.filter((enemy) => wave >= enemy.fromWave && enemy.weight > 0)
}

/**
 * Der Boss dieser Welle (GDD 07 Abschnitt 7).
 *
 * Zustaendig ist der **hoechste**, dessen Schwelle erreicht ist. Damit loest ein neuer Boss
 * seinen Vorgaenger ab, sobald der Spieler weit genug ist - und ein neuer Eintrag in dieser
 * Datei genuegt, um die Reihe zu verlaengern.
 */
export function bossForWave(wave: number): EnemyDef {
  let chosen: EnemyDef | null = null
  for (const enemy of ENEMIES) {
    if (!enemy.isBoss) continue
    const from = enemy.bossFrom ?? enemy.fromWave
    if (wave < from) continue
    if (!chosen || from >= (chosen.bossFrom ?? chosen.fromWave)) chosen = enemy
  }
  if (!chosen) throw new Error(`Kein Boss fuer Welle ${wave}`)
  return chosen
}

/**
 * Elite-Modifikatoren (GDD 07 Abschnitt 6).
 *
 * Ein Elite ist **kein neuer Gegnertyp**: Er behaelt Form und Farbe seines Grundtyps und
 * bekommt nur einen Zuschlag. Der Spieler soll "verstaerkter Tank" erkennen, nicht einen
 * fremden Gegner - deshalb stehen hier Faktoren und keine Datensaetze.
 */
export type EliteModifier = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  label: string
  hp?: number
  speed?: number
  damage?: number
  gold?: number
  xp?: number
  /** Heilung je Sekunde als Anteil der maximalen Lebensmenge. */
  regen?: number
  /** Explodiert beim Tod: Radius und Schaden als Anteil seines eigenen Schadens. */
  explodeRadius?: number
  explodeDamage?: number
}

export const ELITE_MODIFIERS: readonly EliteModifier[] = [
  { id: 'elite.swift', label: 'Swift', speed: 1.5, gold: 1.2 },
  { id: 'elite.tough', label: 'Reinforced', hp: 2.5, gold: 1.4 },
  { id: 'elite.regen', label: 'Regenerating', hp: 1.4, regen: 0.04, gold: 1.3 },
  { id: 'elite.volatile', label: 'Volatile', hp: 1.3, explodeRadius: 110, explodeDamage: 3 },
  { id: 'elite.rich', label: 'Bullion', hp: 1.6, gold: 4 },
  { id: 'elite.wise', label: 'Archive', hp: 1.6, xp: 4 },
]

const ELITE_BY_ID = new Map(ELITE_MODIFIERS.map((modifier) => [modifier.id, modifier]))

export function eliteById(id: string): EliteModifier {
  const modifier = ELITE_BY_ID.get(id)
  if (!modifier) throw new Error(`Unbekannter Elite-Modifikator: ${id}`)
  return modifier
}
