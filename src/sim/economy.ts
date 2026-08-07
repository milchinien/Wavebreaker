/**
 * Gold auf dem Feld (GDD 08 Abschnitt 2).
 *
 * Gold wird **nicht automatisch** gutgeschrieben. Besiegte Gegner lassen leuchtende
 * Muenzen fallen, die liegen bleiben, bis der Spieler sie einsammelt. Daraus entsteht die
 * zentrale aktive Entscheidung des Spiels: in der Basis optimieren oder zurueck ins
 * Gefecht und einsammeln?
 *
 * **Muenzen verfallen nie** - auch nicht ueber Wellenwechsel und verlorene Wellen hinweg.
 * Begrenzt wird deshalb nicht ihr Wert, sondern die Zahl der Objekte: dicht beieinander
 * liegende Muenzen verschmelzen zu einem Stapel mit dem Gesamtwert.
 */

import { dist, type Vec2 } from '../core/vec.ts'
import {
  COIN_MERGE_RADIUS,
  COIN_MERGE_THRESHOLD,
  COLLECT_RADIUS,
  MAX_COINS,
} from '../data/balance.ts'
import { grantReward } from '../app/rewards.ts'
import type { GameState } from '../app/state.ts'
import type { Enemy } from './enemies.ts'
import { globalMultiplier } from './stats.ts'

export type Coin = {
  x: number
  y: number
  value: number
  /** Anzahl zusammengefasster Muenzen - nur fuer die Anzeige des Stapels. */
  count: number
}

/** Wie viel Gold ein Gegner faellen laesst - samt globalem Gold-Bonus (GDD 08 Abschnitt 5.3). */
export function goldValueFor(state: GameState, enemy: Enemy): number {
  return enemy.goldReward * globalMultiplier(state.run.upgrades, 'goldBonus')
}

/** Sammelradius samt globalem Upgrade. */
export function collectRadius(state: GameState): number {
  return COLLECT_RADIUS * globalMultiplier(state.run.upgrades, 'collectRadius')
}

export function dropGold(state: GameState, pos: Vec2, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return

  const coins = state.run.coins
  coins.push({ x: pos.x, y: pos.y, value: amount, count: 1 })

  // Erst verdichten, wenn es sich lohnt - nicht bei jedem einzelnen Gegner.
  if (coins.length > COIN_MERGE_THRESHOLD) mergeCoins(state)
}

/**
 * Dicht beieinander liegende Muenzen zu Stapeln zusammenfassen. Der Gesamtwert bleibt
 * dabei **exakt** erhalten - ein Stapel ist eine Darstellungsfrage, keine Rundung.
 *
 * Wird der Deckel trotzdem erreicht, wachsen die verbleibenden Stapel im Wert weiter,
 * statt dass Gold verloren geht.
 */
export function mergeCoins(state: GameState): void {
  const coins = state.run.coins
  if (coins.length < 2) return

  const merged: Coin[] = []
  for (const coin of coins) {
    let target: Coin | null = null
    for (const candidate of merged) {
      if (Math.hypot(candidate.x - coin.x, candidate.y - coin.y) <= COIN_MERGE_RADIUS) {
        target = candidate
        break
      }
    }

    if (!target) {
      merged.push({ ...coin })
      continue
    }

    // Der Stapel wandert zum wertgewichteten Mittel - so bleibt er dort, wo das Gold ist.
    const total = target.value + coin.value
    target.x = (target.x * target.value + coin.x * coin.value) / total
    target.y = (target.y * target.value + coin.y * coin.value) / total
    target.value = total
    target.count += coin.count
  }

  // Notbremse: Ist die Obergrenze weiterhin ueberschritten, wandert der Ueberschuss in
  // den naechstgelegenen Stapel. Es geht kein Gold verloren.
  while (merged.length > MAX_COINS) {
    const extra = merged.pop()
    if (!extra) break
    const host = nearest(merged, extra)
    if (!host) break
    const total = host.value + extra.value
    host.x = (host.x * host.value + extra.x * extra.value) / total
    host.y = (host.y * host.value + extra.y * extra.value) / total
    host.value = total
    host.count += extra.count
  }

  state.run.coins = merged
}

function nearest(coins: readonly Coin[], to: Coin): Coin | null {
  let best: Coin | null = null
  let bestDistance = Infinity
  for (const coin of coins) {
    const distance = Math.hypot(coin.x - to.x, coin.y - to.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = coin
    }
  }
  return best
}

/**
 * Alles einsammeln, was im Umkreis liegt. Gibt den eingesammelten Betrag zurueck -
 * die Gutschrift laeuft ueber `grantReward` (GDD 16 Abschnitt 2).
 */
export function collectAt(
  state: GameState,
  pos: Vec2,
  radius: number,
  taken?: Vec2[],
): number {
  const coins = state.run.coins
  if (coins.length === 0) return 0

  let collected = 0
  const remaining: Coin[] = []

  for (const coin of coins) {
    if (dist(pos, { x: coin.x, y: coin.y }) <= radius) {
      collected += coin.value
      // Die Orte gehen an die Anzeige, damit die Muenzen sichtbar zum Zeiger fliegen
      // koennen. Die Simulation selbst braucht sie nicht.
      taken?.push({ x: coin.x, y: coin.y })
    } else remaining.push(coin)
  }

  if (collected <= 0) return 0

  state.run.coins = remaining
  grantReward(state, { gold: collected }, 'coin.collected')
  return collected
}

/**
 * Gesamtwert des Goldes im Umkreis eines Punktes - ohne es einzusammeln.
 *
 * Reine Auskunft fuer die Anzeige: Der Sammelradius soll anziehen, sobald etwas darin
 * liegt. Eingesammelt wird weiterhin ausschliesslich ueber `collectAt`.
 */
export function goldInRange(state: GameState, pos: Vec2, radius: number): number {
  let total = 0
  for (const coin of state.run.coins) {
    if (dist(pos, { x: coin.x, y: coin.y }) <= radius) total += coin.value
  }
  return total
}

/** Gesamtwert des Goldes, das noch auf dem Feld liegt. */
export function goldOnField(state: GameState): number {
  let total = 0
  for (const coin of state.run.coins) total += coin.value
  return total
}

