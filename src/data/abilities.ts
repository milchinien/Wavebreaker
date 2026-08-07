/**
 * Aktive Faehigkeiten als Datensaetze (GDD 09 Teil B).
 *
 * Der Grundgedanke aus GDD 09 Abschnitt 6: Das Spiel laeuft automatisch, aber der Spieler
 * soll den **richtigen Augenblick** nutzen koennen. Deshalb kostet der Einsatz nichts -
 * weder Gold noch eine Energieleiste (GDD 09 Abschnitt 7). Gold kostet nur das einmalige
 * Freischalten. Wer eine bereitstehende Faehigkeit ungenutzt laesst, verschenkt sie; es
 * gibt keinen Grund zu horten, und genau das ist die Absicht.
 *
 * **Es steht hier nur, was das Spiel heute auch wirklich tut.** GDD 09 Abschnitt 10 nennt
 * daneben Drohnenschwarm und Plasmaexplosion. Beide brauchen Mechanik, die es noch nicht
 * gibt - Drohnen als bewegliche Einheiten kommen laut Implementierungsplan mit E14. Die
 * kernspezifischen Faehigkeiten aus Abschnitt 11 folgen mit den weiteren Kernen in E13.
 */

import type { StatKey } from './types.ts'

/**
 * Was eine Faehigkeit tut. Fuenf Formen, passend zu den fuenf Kategorien des GDD:
 *
 *   `stat`    offensive Verstaerkung - Kampfwerte aller Module, solange sie laeuft
 *   `shield`  Verteidigung - Anteil des Schadens, der an der Station nicht ankommt
 *   `slow`    Gegnerkontrolle - Faktor auf das Tempo aller Gegner
 *   `heal`    Unterstuetzung - sofortige Heilung, Anteil der vollen Huelle
 *   `blast`   Flaechenschaden - sofortiger Schlag um die Station
 */
export type AbilityEffect =
  | { kind: 'stat'; stats: Partial<Record<StatKey, number>> }
  | { kind: 'shield'; reduction: number }
  | { kind: 'slow'; factor: number }
  | { kind: 'heal'; fraction: number }
  | { kind: 'blast'; damage: number; radius: number }

export type AbilityDef = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  name: string
  /** Wirkdauer in Sekunden. **0 bedeutet: wirkt sofort und einmalig.** */
  duration: number
  /** Abklingzeit in Sekunden, gemessen in **Simulationszeit** (GDD 09, Abnahme E11). */
  cooldown: number
  /** Einmalige Freischaltung mit Gold (GDD 09 Abschnitt 7). */
  unlockCost: number
  /**
   * Leitfarbe. Werte aus PALETTE (`render/theme.ts`), hier ausgeschrieben, weil `data/`
   * nichts aus `render/` zieht - dieselbe Regel wie bei Tuermen und Gegnern.
   */
  accent: string
  description: string
  effect: AbilityEffect
}

export const ABILITIES: readonly AbilityDef[] = [
  {
    /** Die Faehigkeit des Sentinel Core (GDD 09 Abschnitt 11). */
    id: 'overload',
    name: 'Energy Overload',
    duration: 10,
    cooldown: 60,
    unlockCost: 400,
    accent: '#46c8ff',
    description: 'Attack rate and damage of every module surge for a short burst.',
    effect: { kind: 'stat', stats: { attackSpeed: 0.5, damage: 0.25 } },
  },
  {
    id: 'shield',
    name: 'Energy Shield',
    duration: 15,
    cooldown: 90,
    unlockCost: 500,
    accent: '#2ee0c0',
    description: 'A barrier absorbs most of the damage reaching the station.',
    effect: { kind: 'shield', reduction: 0.6 },
  },
  {
    id: 'orbital',
    name: 'Orbital Strike',
    duration: 0,
    cooldown: 45,
    unlockCost: 350,
    accent: '#ffcc33',
    description: 'A satellite hits the ring around the station. Best against swarms.',
    effect: { kind: 'blast', damage: 420, radius: 190 },
  },
  {
    id: 'timewarp',
    name: 'Time Warp',
    duration: 12,
    cooldown: 70,
    unlockCost: 450,
    accent: '#b45cff',
    description: 'A distortion field slows every enemy on the field.',
    effect: { kind: 'slow', factor: 0.45 },
  },
  {
    id: 'repair',
    name: 'Repair Pulse',
    duration: 0,
    cooldown: 80,
    unlockCost: 400,
    accent: '#7fe83f',
    description: 'Drones restore part of the station hull at once.',
    effect: { kind: 'heal', fraction: 0.3 },
  },
]

const BY_ID = new Map(ABILITIES.map((ability) => [ability.id, ability]))

export function abilityById(id: string): AbilityDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekannte Faehigkeit: ${id}`)
  return def
}

export function isKnownAbility(id: string): boolean {
  return BY_ID.has(id)
}
