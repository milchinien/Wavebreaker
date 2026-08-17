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
import { globalMultiplier, globalValue } from './stats.ts'

export type Coin = {
  x: number
  y: number
  value: number
  /** Anzahl zusammengefasster Muenzen - nur fuer die Anzeige des Stapels. */
  count: number
}

/**
 * Wie viel Gold ein Gegner faellen laesst (GDD 08 Abschnitt 2 und 5.3).
 *
 * `Tithe` legt einen festen Betrag je Gegner obendrauf, `Scrapper's Eye` vervielfacht das
 * Ganze - flach vor Faktor, dieselbe Reihenfolge wie bei den Kampfwerten. Fuer den Spieler
 * heisst das: Der feste Betrag traegt die ersten Wellen, in denen ein Gegner ohnehin kaum
 * etwas bringt, und der Faktor uebernimmt spaeter.
 */
export function goldValueFor(state: GameState, enemy: Enemy): number {
  const flat = enemy.goldReward + globalValue(state, 'goldPerKill')

  /*
   * `Tribute`: Bosse und Elites zahlen besser.
   *
   * Gefragt wird der **Gegner**, nicht die Welle: Ein Elite kann auf jeder Welle erscheinen,
   * und ein Boss ist auf seiner Welle nicht der einzige Gegner. Der Faktor setzt hinter dem
   * allgemeinen Goldbonus auf - er ist ein Aufschlag auf den Fund, nicht auf die Wirtschaft.
   */
  const special = enemy.elite.length > 0 || state.runtime.combat.bossId === enemy.id
  const tribute = special ? 1 + globalValue(state, 'bossGold') : 1

  return flat * globalMultiplier(state, 'goldBonus') * tribute
}

/** Sammelradius: Grundwert plus `Magnet Glove`, das Ganze mal den Faktoren aus Perks. */
export function collectRadius(state: GameState): number {
  const flat = COLLECT_RADIUS + globalValue(state, 'collectRadiusFlat')
  return flat * globalMultiplier(state, 'collectRadius')
}

export function dropGold(state: GameState, pos: Vec2, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return

  /*
   * Waehrend der Abwesenheit sieht niemand zu, und niemand faehrt mit dem Zeiger ueber das
   * Feld. Das Gold wird deshalb **direkt gutgeschrieben** - so steht es in GDD 12
   * Abschnitt 3, und es ist die einzige Stelle, an der die Regel "Gold wird eingesammelt"
   * eine Ausnahme kennt.
   *
   * Der Nebeneffekt ist erheblich: Ohne diese Zeile lagen nach acht Stunden zehntausende
   * Muenzen im Feld, die bei jedem weiteren Fund neu verdichtet werden wollten. Das war
   * der weitaus groesste Posten der ganzen Rechnung.
   */
  if (!state.runtime.combat.observed) {
    grantReward(state, { gold: amount }, 'offline')
    return
  }

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
  taken?: Coin[],
): number {
  const coins = state.run.coins
  if (coins.length === 0) return 0

  let collected = 0
  const remaining: Coin[] = []

  for (const coin of coins) {
    if (dist(pos, { x: coin.x, y: coin.y }) <= radius) {
      collected += coin.value
      /*
       * Die aufgehobenen Muenzen gehen **vollstaendig** an die Anzeige, damit sie sichtbar
       * zum Zeiger fliegen koennen. Die Simulation selbst braucht sie nicht.
       *
       * Vollstaendig heisst: samt Wert. Vorher ging nur der Ort heraus - `spawnPickups`
       * las dann `coin.value` als `undefined`, und `coinLook` rechnete daraus einen
       * Radius von NaN. Die aufgehobene Muenze flog also unsichtbar zum Zeiger. Dass es
       * durchging, liegt an der Kovarianz von Feldern in TypeScript: Ein `Coin[]` laesst
       * sich als `Vec2[]` uebergeben, und was danach hineingelegt wird, prueft niemand
       * mehr. Deshalb steht hier jetzt `Coin` und nicht `Vec2`.
       */
      taken?.push({ ...coin })
    } else remaining.push(coin)
  }

  if (collected <= 0) return 0

  state.run.coins = remaining
  grantReward(state, { gold: collected }, 'coin.collected')
  return collected
}

/**
 * Das ganze Feld abraeumen.
 *
 * Nur fuer den Abwesenheitsertrag (GDD 12 Abschnitt 3): Waehrend niemand da ist, gibt es
 * auch niemanden, der mit dem Zeiger ueber das Feld faehrt. Im laufenden Spiel gibt es
 * diese Abkuerzung nicht - dort ist das Einsammeln die zentrale aktive Handlung.
 *
 * Laeuft ueber `collectAt` mit unendlichem Radius statt ueber einen eigenen Weg, damit
 * Gold auch hier nur an einer einzigen Stelle vom Feld in die Kasse kommt.
 */
export function collectAll(state: GameState): number {
  return collectAt(state, { x: 0, y: 0 }, Infinity)
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

/**
 * [REKONSTRUIERT] Der Rumpf dieser Funktion ist in keiner Sitzung erfasst - belegt sind
 * nur ihre Signatur und ihr Ort (Suchlauf ueber `src/sim/economy.ts`, Zeile 209).
 *
 * Durchschnittlicher Wert der uebergebenen Muenzen.
 *
 * Die Groesse einer Muenze nennt ihr **Vielfaches des Durchschnitts**, nicht ihren Betrag
 * (siehe `coinLook` in `render/combat.ts`): Was in Welle 3 ein Vermoegen ist, ist in
 * Welle 300 Staub. Der Bezugswert gehoert deshalb zum Zustand des Feldes und nicht zur
 * Zeichenebene - sonst muesste ihn jede Ebene neu bilden, und zwei koennten sich
 * widersprechen.
 *
 * Ohne Muenzen ist er 0. Die Zeichenebene faengt das ab und rechnet dann mit dem
 * Einfachen, statt hier durch null zu teilen.
 */
export function meanCoinValue(coins: readonly Coin[]): number {
  if (coins.length === 0) return 0
  let total = 0
  for (const coin of coins) total += coin.value
  return total / coins.length
}
