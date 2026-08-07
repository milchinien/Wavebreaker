/**
 * Die Haendler-Drohne (GDD 11 Abschnitt 7).
 *
 * "Waehrend eines Runs kann eine Haendler-Drohne erscheinen. Sie landet kurzzeitig in der
 * Arena und bietet zufaellige Angebote." Genau das steht hier - und praegend ist der Teil,
 * der im GDD nur nebenbei steht: **sie landet in der Arena**. Sie ist kein Menuepunkt,
 * sondern ein Gegenstand im Feld. Wer bei ihr kaufen will, muss hinfahren, waehrend die
 * Welle laeuft. Daraus wird aus einem Laden eine Entscheidung.
 *
 * Drei Regeln bestimmen den Aufbau:
 *
 * **1. Das Sortiment wird beim Landen gewuerfelt, nicht beim Klicken.** Was auf der Karte
 * steht, bekommt man auch - dieselbe Regel wie beim Turmangebot (GDD 06 Abschnitt 1). Auch
 * der Perk hinter "Field Retrofit" steht deshalb schon fest, bevor jemand hinsieht.
 *
 * **2. Die Uhr steht still, sobald der Spieler da ist.** Ein Laden, der waehrend des
 * Einkaufs abhebt, waere keine Gelegenheit, sondern eine Falle.
 *
 * **3. Diese Datei erfindet keine Wirkung.** Alle vier Warenarten aus GDD 11 Abschnitt 7
 * gibt es bereits: globales Upgrade (E8), zeitlich begrenzter Bonus (E16), Perk (E10),
 * Turmangebot (E12). Die Drohne legt sie an einer Theke zusammen - mehr nicht.
 */

import { emit } from '../core/events.ts'
import type { Rng } from '../core/rng.ts'
import {
  TRADER_DISTANCE_MAX,
  TRADER_DISTANCE_MIN,
  TRADER_REACH,
  TRADER_STAY_SECONDS,
  TRADER_STOCK_SIZE,
  TRADER_WAVE_MAX,
  TRADER_WAVE_MIN,
  eventRewardFor,
} from '../data/balance.ts'
import { PERKS } from '../data/perks.ts'
import {
  isKnownTraderStock,
  stockForWave,
  traderStockById,
  type TraderStockDef,
} from '../data/trader.ts'
import { globalUpgrades } from '../data/upgrades.ts'
import { spendGold } from '../app/rewards.ts'
import { markDirty, type GameState, type Trader, type TraderOffer } from '../app/state.ts'
import { addEventBoon } from './events.ts'
import { grantPerk } from './progression.ts'
import { rollTowerOffer } from './shop.ts'
import { upgradeLevel } from './stats.ts'

// ---------------------------------------------------------------------------
// Kommen und gehen
// ---------------------------------------------------------------------------

/** Die Drohne im Feld, oder `null`. */
export function currentTrader(state: GameState): Trader | null {
  return state.run.trader
}

function rollNextWave(from: number, rng: Rng): number {
  return Math.max(1, Math.floor(from) + rng.int(TRADER_WAVE_MIN, TRADER_WAVE_MAX))
}

/**
 * Einen Posten wuerfeln. Gewichtet, ohne Doppel - drei gleiche Karten waeren keine Wahl.
 * Dieselbe Ziehung wie beim Perk-Angebot (`offerPerks` in `sim/progression.ts`).
 */
function rollStock(state: GameState, rng: Rng): TraderOffer[] {
  const pool = stockForWave(state.run.wave)
  if (pool.length === 0) return []

  const base = eventRewardFor(state.run.wave)
  const offers: TraderOffer[] = []

  for (let i = 0; i < TRADER_STOCK_SIZE && pool.length > 0; i++) {
    let total = 0
    for (const entry of pool) total += entry.weight

    let roll = rng.next() * total
    let index = pool.length - 1
    for (let k = 0; k < pool.length; k++) {
      roll -= (pool[k] as TraderStockDef).weight
      if (roll <= 0) {
        index = k
        break
      }
    }

    const def = pool[index] as TraderStockDef
    pool.splice(index, 1)

    offers.push({
      defId: def.id,
      // Der Perk steht schon jetzt fest - sonst waere die Karte eine Behauptung.
      perkId: def.effect.kind === 'perk' ? rng.pick(PERKS).id : null,
      price: Math.max(1, Math.round(def.price * base)),
      sold: false,
    })
  }

  return offers
}

/**
 * Die Drohne schicken, wenn ihre Welle erreicht ist.
 *
 * Gibt sie zurueck oder `null`. Steht schon eine im Feld, passiert nichts - zwei Laeden
 * nebeneinander waeren kein Ereignis, sondern ein Marktplatz.
 */
export function maybeSendTrader(state: GameState, rng: Rng): Trader | null {
  const run = state.run

  // Erster Aufruf eines Runs: Der Abstand wird von der aktuellen Welle aus gewuerfelt.
  if (run.nextTraderWave <= 0) {
    run.nextTraderWave = rollNextWave(run.wave, rng)
    return null
  }

  if (run.trader !== null) return null
  if (run.wave < run.nextTraderWave) return null

  // Auch dann weitersetzen, wenn nichts zu verkaufen ist - sonst haengt der Zaehler fest
  // und prueft von da an in jedem Takt.
  run.nextTraderWave = rollNextWave(run.wave, rng)

  const stock = rollStock(state, rng)
  if (stock.length === 0) return null

  const angle = rng.range(0, Math.PI * 2)
  const distance = rng.range(TRADER_DISTANCE_MIN, TRADER_DISTANCE_MAX)
  const trader: Trader = {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    left: TRADER_STAY_SECONDS,
    visited: false,
    stock,
  }

  run.trader = trader
  markDirty(state)
  emit('trader.arrived', { wave: run.wave, count: stock.length })
  return trader
}

/**
 * Die Uhr laufen lassen. Eine erreichte Drohne wartet - siehe Regel 2 im Kopf dieser Datei.
 */
export function stepTrader(state: GameState, dt: number): void {
  const trader = state.run.trader
  if (!trader || trader.visited) return

  trader.left -= dt
  if (trader.left > 0) return

  state.run.trader = null
  markDirty(state)
  emit('trader.left', { bought: 0 })
}

/**
 * Der Zeiger hat die Drohne erreicht. Ab jetzt wartet sie, und die Oberflaeche oeffnet das
 * Fenster. Gibt `true` zurueck, wenn dieser Aufruf sie geoeffnet hat.
 */
export function reachTraderAt(
  state: GameState,
  pos: { x: number; y: number },
  reach = TRADER_REACH,
): boolean {
  const trader = state.run.trader
  if (!trader || trader.visited) return false
  if (Math.hypot(trader.x - pos.x, trader.y - pos.y) > reach) return false

  trader.visited = true
  markDirty(state)
  emit('trader.opened', { count: trader.stock.length })
  return true
}

/**
 * Die Drohne fliegt weiter. Der Spieler schliesst das Fenster - **einmal besucht ist
 * besucht**: Sie kommt nicht zurueck, damit die Gelegenheit eine bleibt und nicht zu einem
 * dauerhaft erreichbaren Laden wird.
 */
export function dismissTrader(state: GameState): void {
  const trader = state.run.trader
  if (!trader) return

  const bought = trader.stock.filter((offer) => offer.sold).length
  state.run.trader = null
  markDirty(state)
  emit('trader.left', { bought })
}

// ---------------------------------------------------------------------------
// Kaufen
// ---------------------------------------------------------------------------

/**
 * Einen Posten kaufen. Gibt `false` zurueck, wenn er unbekannt, schon verkauft oder zu
 * teuer ist - dann aendert sich nichts.
 *
 * Bezahlt wird ueber `app/rewards.ts`, wie jede Ausgabe im Spiel. Verkauft wird der Posten
 * **vor** der Wirkung: Eine Wirkung, die ihrerseits etwas ausloest (ein Turmangebot), darf
 * keinen halb bezahlten Posten im Regal vorfinden.
 */
export function buyFromTrader(state: GameState, index: number): boolean {
  const trader = state.run.trader
  if (!trader) return false

  const offer = trader.stock[index]
  if (!offer || offer.sold) return false
  if (!isKnownTraderStock(offer.defId)) return false
  if (!spendGold(state, offer.price)) return false

  offer.sold = true
  applyPurchase(state, offer)

  markDirty(state)
  emit('trader.bought', { defId: offer.defId, price: offer.price })
  return true
}

/** Ist dieser Posten gerade bezahlbar? Nur fuer die Anzeige. */
export function canAfford(state: GameState, offer: TraderOffer): boolean {
  return !offer.sold && state.run.gold >= offer.price
}

function applyPurchase(state: GameState, offer: TraderOffer): void {
  const effect = traderStockById(offer.defId).effect

  switch (effect.kind) {
    case 'upgrade':
      for (let i = 0; i < effect.levels; i++) grantFreeUpgrade(state)
      return

    case 'boon':
      addEventBoon(state, offer.defId, { ...effect.stats }, effect.duration)
      return

    case 'perk':
      if (offer.perkId) grantPerk(state, offer.perkId)
      return

    case 'tower':
      // Ein offenes Angebot wird nicht ueberschrieben - dieselbe Regel wie bei der
      // Turmkapsel. Der Posten bleibt dann unverkaeuflich, statt Gold zu verschlucken.
      if (state.run.towerOffer.length > 0) return
      state.run.towerOffer = rollTowerOffer(state, state.runtime.rng, undefined, effect.floor)
      return
  }
}

/**
 * Eine kostenlose Stufe auf einem zufaelligen globalen Pfad.
 *
 * Steht hier und nicht in `sim/events.ts`, obwohl die Kapsel dasselbe tut: Die beiden
 * Aufrufer sollen nicht voneinander abhaengen, und die Funktion ist vier Zeilen lang. Ein
 * gemeinsamer Ort waere eine Datei mehr fuer weniger Text.
 */
function grantFreeUpgrade(state: GameState): void {
  const open = globalUpgrades().filter(
    (def) => upgradeLevel(state.run.upgrades, def.id) < def.maxLevel,
  )
  if (open.length === 0) return

  const def = state.runtime.rng.pick(open)
  state.run.upgrades[def.id] = upgradeLevel(state.run.upgrades, def.id) + 1
  emit('upgrade.bought', { path: def.id, level: state.run.upgrades[def.id] as number, cost: 0 })
}

// ---------------------------------------------------------------------------
// Spielstand
// ---------------------------------------------------------------------------

/** Fuer den Spielstand: eine gelesene Drohne pruefen, statt ihr zu vertrauen. */
export function isValidTrader(value: unknown): value is Trader {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>

  for (const key of ['x', 'y', 'left']) {
    const number = entry[key]
    if (typeof number !== 'number' || !Number.isFinite(number)) return false
  }
  if (typeof entry['visited'] !== 'boolean') return false
  if (!Array.isArray(entry['stock'])) return false

  // Ein Posten, den es nicht mehr gibt, macht die ganze Drohne unbrauchbar: Sie soll nicht
  // mit einem Loch im Regal dastehen, in dem vorher etwas war.
  return entry['stock'].every(isValidOffer)
}

function isValidOffer(value: unknown): value is TraderOffer {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  if (typeof entry['defId'] !== 'string' || !isKnownTraderStock(entry['defId'])) return false
  if (typeof entry['price'] !== 'number' || !Number.isFinite(entry['price'])) return false
  if (typeof entry['sold'] !== 'boolean') return false
  const perkId = entry['perkId']
  return perkId === null || typeof perkId === 'string'
}
