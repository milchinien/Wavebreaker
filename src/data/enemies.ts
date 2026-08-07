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

export type EnemyShape = 'square' | 'triangle' | 'hexagon'

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
  {
    /**
     * Titan Core (GDD 07 Abschnitt 7): riesiges Hexagon, extrem viel HP, langsam.
     * Er erscheint nicht ueber die Wellenmischung, sondern wird zu Beginn seiner Welle
     * gesetzt - deshalb Gewicht 0.
     */
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
    weight: 0,
    isBoss: true,
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

/** Der Boss dieser Welle. Aktuell gibt es genau einen; weitere folgen in E15. */
export function bossForWave(wave: number): EnemyDef {
  const bosses = ENEMIES.filter((enemy) => enemy.isBoss && wave >= enemy.fromWave)
  const chosen = bosses[bosses.length - 1]
  if (!chosen) throw new Error(`Kein Boss fuer Welle ${wave}`)
  return chosen
}

