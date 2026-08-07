/**
 * Helfer (GDD 12 Teil B).
 *
 * Bisher gibt es genau einen: den **Goldsammler**. Er ist keine Kampfeinheit (GDD 12
 * Abschnitt 9) - er faehrt ueber das Feld und hebt Gold auf, das der Spieler sonst selbst
 * holen muesste. Er ersetzt damit keine Entscheidung, er nimmt Handarbeit ab; genau so
 * beschreibt es GDD 12 Abschnitt 13.
 *
 * **Die zweistufige Freischaltung ist das Wesentliche** (GDD 12 Abschnitt 10): Der
 * Prestige-Baum macht den Helfer *kaufbar*, gekauft wird er mit Gold im Upgrade-Menue.
 * Beides sind Datenabfragen - `isUnlocked(state, 'helper.collector')` und die Stufe des
 * Pfads `global.collector`. Im Code steht keine Verzweigung nach "hat der Spieler einen
 * Helfer".
 *
 * Wie die Drohnen sind Helfer **abgeleitet**: Ihre Anzahl folgt der gekauften Stufe, und
 * `stepHelpers` zieht die Liste je Takt nach. Ein Helfer, den es nicht mehr geben darf,
 * verschwindet damit von selbst - es gibt keinen Zustand, der auseinanderlaufen kann.
 * Anders als Drohnen behalten sie aber ihren Ort zwischen zwei Takten: Sie fahren, und
 * eine Fahrt ohne Ausgangspunkt waere ein Sprung.
 */

import {
  HELPER_BASE_RADIUS,
  HELPER_BASE_SPEED,
  HELPER_MAX_DISTANCE,
  HELPER_RADIUS_PER_LEVEL,
  HELPER_SPEED_PER_LEVEL,
} from '../data/balance.ts'
import type { GameState, Helper } from '../app/state.ts'
import { collectAt } from './economy.ts'
import { collectPodsAt } from './events.ts'
import { isUnlocked } from './prestige.ts'
import { CORE_CENTER } from './station.ts'
import { upgradeLevel } from './stats.ts'

/** Der Pfad, mit dem der Helfer im Upgrade-Menue gekauft wird (GDD 12 Abschnitt 10). */
export const COLLECTOR_PATH = 'global.collector'
/** Der Prestige-Knoten, der diesen Pfad ueberhaupt sichtbar macht. */
export const COLLECTOR_NODE = 'helper.collector'

/** Gekaufte Stufe des Goldsammlers. 0 heisst: nicht gekauft. */
export function collectorLevel(state: GameState): number {
  if (!isUnlocked(state, COLLECTOR_NODE)) return 0
  return upgradeLevel(state.run.upgrades, COLLECTOR_PATH)
}

/**
 * Wie viele Sammler unterwegs sind.
 *
 * Der erste kommt mit dem Kauf, jeder weitere ueber einen Prestige-Knoten (GDD 12
 * Abschnitt 11: "spaetere Upgrades ermoeglichen mehrere Helfer"). Die Knoten stehen im
 * Baum und nicht in der Kostenkurve des Upgrades, weil sie dort auch im GDD stehen.
 */
export function helperCount(state: GameState): number {
  if (collectorLevel(state) <= 0) return 0

  let count = 1
  if (isUnlocked(state, 'helper.fast')) count += 1
  if (isUnlocked(state, 'helper.elite')) count += 1
  return count
}

/** Sammelradius eines Helfers - waechst mit der gekauften Stufe. */
export function helperRadius(state: GameState): number {
  const level = collectorLevel(state)
  if (level <= 0) return 0
  const bonus = isUnlocked(state, 'helper.better') ? 2 : 1
  return (HELPER_BASE_RADIUS + HELPER_RADIUS_PER_LEVEL * (level - 1)) * bonus
}

/** Fahrtempo eines Helfers, in Welteinheiten je Sekunde. */
export function helperSpeed(state: GameState): number {
  const level = collectorLevel(state)
  if (level <= 0) return 0
  const bonus = isUnlocked(state, 'helper.fast') ? 1.6 : 1
  return (HELPER_BASE_SPEED + HELPER_SPEED_PER_LEVEL * (level - 1)) * bonus
}

/**
 * Ein Takt der Helfer: Liste nachziehen, fahren, aufheben.
 *
 * Sie fahren auf das **naechstliegende** Gold zu (GDD 12 Abschnitt 11: "Sammelprioritaet").
 * Liegt nichts da, kehren sie zur Station zurueck, statt stehen zu bleiben - ein Helfer,
 * der mitten im Feld parkt, sieht aus wie ein Fehler.
 */
export function stepHelpers(state: GameState, dt: number): void {
  const helpers = state.runtime.helpers
  const wanted = helperCount(state)

  // Liste nachziehen. Neue starten an der Station, ueberzaehlige verschwinden.
  while (helpers.length > wanted) helpers.pop()
  while (helpers.length < wanted) {
    // Gleichmaessig um die Station verteilt - zwei Helfer sollen nicht uebereinander stehen.
    const angle = (helpers.length / Math.max(1, wanted)) * Math.PI * 2
    helpers.push({
      x: CORE_CENTER.x + Math.cos(angle) * 80,
      y: CORE_CENTER.y + Math.sin(angle) * 80,
      angle,
    })
  }
  if (helpers.length === 0) return

  const speed = helperSpeed(state)
  const radius = helperRadius(state)

  for (const helper of helpers) {
    const target = nearestTarget(state, helper)
    const dx = target.x - helper.x
    const dy = target.y - helper.y
    const distance = Math.hypot(dx, dy)

    if (distance > 1) {
      helper.angle = Math.atan2(dy, dx)
      const stride = Math.min(distance, speed * dt)
      helper.x += (dx / distance) * stride
      helper.y += (dy / distance) * stride
    }

    // Nie zu weit hinaus: Ein Helfer, der einer Muenze am Rand des Erscheinungsrings
    // hinterherfaehrt, waere aus dem Bild und damit fuer den Spieler verschwunden.
    const out = Math.hypot(helper.x - CORE_CENTER.x, helper.y - CORE_CENTER.y)
    if (out > HELPER_MAX_DISTANCE) {
      const scale = HELPER_MAX_DISTANCE / out
      helper.x = CORE_CENTER.x + (helper.x - CORE_CENTER.x) * scale
      helper.y = CORE_CENTER.y + (helper.y - CORE_CENTER.y) * scale
    }

    // Aufheben laeuft ueber dieselbe Funktion wie beim Spieler - es gibt nur einen Weg,
    // auf dem Gold vom Feld in die Kasse kommt.
    collectAt(state, { x: helper.x, y: helper.y }, radius)
    collectPodsAt(state, { x: helper.x, y: helper.y }, radius)
  }
}

/**
 * Wohin ein Helfer faehrt: zur naechsten Muenze, sonst zur naechsten Kapsel, sonst zurueck
 * zur Station.
 *
 * Kapseln stehen hinter Muenzen, weil sie seltener sind und laenger liegen duerfen - wer
 * sie selbst holen will, hat dazu Zeit. Wichtiger ist, dass der Helfer das Feld raeumt.
 */
function nearestTarget(state: GameState, helper: Helper): { x: number; y: number } {
  let best: { x: number; y: number } | null = null
  let bestDistance = Infinity

  for (const coin of state.run.coins) {
    const distance = Math.hypot(coin.x - helper.x, coin.y - helper.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { x: coin.x, y: coin.y }
    }
  }
  if (best) return best

  for (const pod of state.run.pods) {
    const distance = Math.hypot(pod.x - helper.x, pod.y - helper.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = { x: pod.x, y: pod.y }
    }
  }

  return best ?? CORE_CENTER
}
