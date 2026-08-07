/**
 * Zielerfassung und Prioritaeten (GDD 05 Abschnitt 4).
 *
 * Zwei Regeln:
 *   - Reichweite ist ein Kreis um das **eigene Modul**, nicht um das Zentrum der
 *     Station. Erst dadurch wird die Position eines Turms zu einer Entscheidung.
 *   - **Angedockte Gegner werden bevorzugt.** Sie verursachen fortlaufend Schaden und
 *     stehen still, sind also das dringendste und einfachste Ziel. Ohne diese Regel
 *     entstehen Todesspiralen, weil die Tuerme auf Nachrueckende schiessen, waehrend die
 *     Station zerlegt wird (GDD 07 Abschnitt 2).
 *
 * Abweichung von der Signatur im Plan: `findTarget` bekommt Position und Reichweite statt
 * eines Turmobjekts. Dadurch ist die Zielwahl fuer sich pruefbar und der Kern kann
 * dieselbe Funktion nutzen wie jeder Turm.
 */

import { dist, type Vec2 } from '../core/vec.ts'
import type { Enemy } from './enemies.ts'

export type TargetMode =
  | 'nearest' // Standard
  | 'strongest' // Sniper: staerkster Gegner zuerst
  | 'boss' // Laser: Boss-Fokus, sonst der staerkste

export function findTarget(
  enemies: readonly Enemy[],
  from: Vec2,
  range: number,
  mode: TargetMode = 'nearest',
): Enemy | null {
  if (range <= 0) return null

  // Erst unter den angedockten suchen. Nur wenn dort niemand ist, zaehlt der Rest.
  return bestOf(enemies, from, range, mode, true) ?? bestOf(enemies, from, range, mode, false)
}

function bestOf(
  enemies: readonly Enemy[],
  from: Vec2,
  range: number,
  mode: TargetMode,
  dockedOnly: boolean,
): Enemy | null {
  let best: Enemy | null = null
  let bestScore = -Infinity

  for (const enemy of enemies) {
    if (!enemy.active) continue
    if (dockedOnly && enemy.dockedTo === null) continue
    /*
     * Eine getarnte Einheit ist kein Ziel (GDD 07 Abschnitt 5).
     *
     * Das ist ihre ganze Mechanik, und sie steht genau hier - eine Zeile in der Zielwahl,
     * kein Sonderfall irgendwo sonst. Der Konter aus dem GDD ergibt sich von selbst: Wer
     * weiter reicht, hat sie laenger im Blick, wenn sie wieder auftaucht.
     */
    if (enemy.cloak < 0) continue

    const distance = dist(from, enemy.pos)
    if (distance > range + enemy.radius) continue

    const score = scoreFor(enemy, distance, mode)
    if (score > bestScore) {
      best = enemy
      bestScore = score
    }
  }

  return best
}

function scoreFor(enemy: Enemy, distance: number, mode: TargetMode): number {
  switch (mode) {
    case 'nearest':
      // Naeher ist besser, deshalb negativ.
      return -distance
    case 'strongest':
    case 'boss':
      return enemy.maxHp
  }
}

/** Wie viele Gegner in Reichweite sind - Grundlage fuer die Raketen-Prioritaet in E14. */
export function countInRange(enemies: readonly Enemy[], from: Vec2, range: number): number {
  let count = 0
  for (const enemy of enemies) {
    if (enemy.active && dist(from, enemy.pos) <= range + enemy.radius) count += 1
  }
  return count
}
