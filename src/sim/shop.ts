/**
 * Turmerwerb und Schmelzen (GDD 06).
 *
 * Die praegende Regel steht in GDD 06 Abschnitt 1: **Der Spieler kauft keinen Turm, er
 * kauft einen Wurf.** Er bezahlt Gold, bekommt zwei ausgewuerfelte Karten und waehlt eine.
 * Das macht aus einer Ausgabe eine Entscheidung - und aus jedem Turm ein Einzelstueck,
 * weil Raritaet und Eigenschaften mitgewuerfelt werden.
 *
 * Die zweite Regel ist eine **Nicht**-Regel (GDD 06 Abschnitt 4): Tuerme lassen sich nicht
 * gegen Gold verkaufen. Der einzige Weg, ueberzaehlige loszuwerden, ist das Schmelzen. Ein
 * Verkauf gegen Gold wuerde das Schmelzsystem ueberfluessig machen, und mit ihm die
 * Entscheidung, welche drei Tuerme man aufgibt.
 *
 * Beide Angebote - Kauf und Schmelzgang - landen im **Spielstand**, nicht in den
 * Laufzeitdaten. Sonst wuerfelte ein Neuladen neue Karten, und eine Auswahl, die man
 * beliebig wiederholen kann, ist keine. Dieselbe Ueberlegung wie beim Perk-Angebot.
 */

import { emit } from '../core/events.ts'
import type { Rng } from '../core/rng.ts'
import {
  MELT_COST,
  TOWER_BASE_COST,
  TOWER_COST_FACTOR,
  TOWER_OFFER_SIZE,
} from '../data/balance.ts'
import { rarityRank, rarityWeights, TRAIT_SLOTS } from '../data/rarities.ts'
import { isKnownTower, TOWERS } from '../data/towers.ts'
import { traitsFor, type TraitDef } from '../data/traits.ts'
import { isRarity, type Category, type Rarity } from '../data/types.ts'
import { markDirty, type GameState, type TowerOffer } from '../app/state.ts'
import { spendGold } from '../app/rewards.ts'
import { isUnlocked, unlockedRarity, unlockedTraitTier } from './prestige.ts'
import { newModule } from './station.ts'

/**
 * Preis des naechsten Turms: `Grundpreis x 1,5^(bereits gekaufte)` (GDD 06 Abschnitt 2).
 *
 * Er steigt nach **jedem** Kauf, nicht je Turmart. Daraus entsteht die Kernentscheidung des
 * Spiels: noch ein Turm - oder das Gold in die vorhandenen stecken?
 */
export function towerCost(state: GameState): number {
  const bought = Math.max(0, Math.floor(state.run.towersBought))
  return Math.round(TOWER_BASE_COST * Math.pow(TOWER_COST_FACTOR, bought))
}

/**
 * Turmarten, die diesem Run ueberhaupt offenstehen (GDD 10, Bereich 4).
 *
 * Zwei Quellen, beide **Datenabfragen** und keine Verzweigungen (GDD 16 Abschnitt 2):
 * die Startausstattung in `permanent.unlockedTowers` und der Prestige-Knoten, den eine
 * Turmart in ihrem eigenen Datensatz nennt. Eine neue Turmart braucht damit einen Eintrag
 * in `data/towers.ts` und einen in `data/prestige.ts` - und sonst nichts.
 */
function availableTowers(state: GameState): string[] {
  const unlocked = new Set(state.permanent.unlockedTowers.filter(isKnownTower))
  for (const tower of TOWERS) {
    if (tower.unlock && isUnlocked(state, tower.unlock)) unlocked.add(tower.id)
  }
  return [...unlocked]
}

/** Aufgabe einer Turmart - entscheidet, welche Eigenschaften ueberhaupt passen. */
function categoryOf(defId: string): Category {
  return TOWERS.find((tower) => tower.id === defId)?.category ?? 'attack'
}

/**
 * Eigenschaften fuer einen Turm wuerfeln (GDD 06 Abschnitt 10).
 *
 * **Anzahl** aus der Raritaet, **Qualitaet** aus dem Prestige-Baum. Ist die Ebene der
 * Eigenschaften noch nicht freigeschaltet, bleibt die Liste leer - auch bei einem
 * legendaeren Turm mit drei Plaetzen. Das ist gewollt und im GDD ausdruecklich so gemeint.
 *
 * Ohne Doppel: Zweimal dieselbe Eigenschaft waere fuer den Spieler nicht von einer starken
 * zu unterscheiden, und die Karte saehe nach einem Fehler aus.
 */
export function rollTraits(state: GameState, defId: string, rarity: Rarity, rng: Rng): string[] {
  const slots = TRAIT_SLOTS[rarity]
  if (slots <= 0) return []

  const pool = traitsFor(categoryOf(defId), unlockedTraitTier(state))
  if (pool.length === 0) return []

  const available = [...pool]
  const chosen: string[] = []
  for (let i = 0; i < slots && available.length > 0; i++) {
    const index = rng.int(0, available.length - 1)
    chosen.push((available[index] as TraitDef).id)
    available.splice(index, 1)
  }
  return chosen
}

/**
 * Eine Raritaet nach den Chancen dieses Freischaltstands wuerfeln (GDD 06 Abschnitt 8).
 *
 * `floor` hebt die **Untergrenze** an - das ist die seltene Turmkapsel aus GDD 11
 * Abschnitt 8. Sie wuerfelt nicht mit anderen Chancen, sie streicht nur die unteren Stufen
 * weg; dadurch bleibt die Rangfolge der Stufen zueinander erhalten, und ein Turm, dessen
 * Spanne die Untergrenze gar nicht hergibt, faellt nicht heraus, sondern gibt sein Bestes.
 */
function rollRarity(state: GameState, defId: string, rng: Rng, floor?: Rarity): Rarity | null {
  const all = rarityWeights(defId, unlockedRarity(state))
  if (all.length === 0) return null

  const limited = floor
    ? all.filter((entry) => rarityRank(entry.rarity) >= rarityRank(floor))
    : all
  // Streicht die Untergrenze alles weg, bleibt die hoechste erreichbare Stufe. Eine Kapsel
  // darf nie leer aufgehen, nur weil ihr Anspruch ueber dem Freischaltstand liegt.
  const weights = limited.length > 0 ? limited : [all[all.length - 1] as { rarity: Rarity; weight: number }]

  let total = 0
  for (const entry of weights) total += entry.weight

  let roll = rng.next() * total
  for (const entry of weights) {
    roll -= entry.weight
    if (roll <= 0) return entry.rarity
  }
  return (weights[weights.length - 1] as { rarity: Rarity }).rarity
}

/**
 * Ein Angebot wuerfeln: zwei fertige Turmkarten (GDD 06 Abschnitt 1).
 *
 * Fertig heisst: Art, Raritaet und Eigenschaften stehen schon auf der Karte. Wuerfelte erst
 * der Klick, waere die Anzeige eine Behauptung und die Wahl ein Blindkauf.
 *
 * Turmarten, fuer die bei diesem Freischaltstand gar keine Raritaet moeglich ist, fallen
 * heraus - ein Angebot, das man nicht annehmen kann, waere schlimmer als eines weniger.
 */
export function rollTowerOffer(
  state: GameState,
  rng: Rng,
  size = TOWER_OFFER_SIZE,
  floor?: Rarity,
): TowerOffer[] {
  const towers = availableTowers(state)
  if (towers.length === 0) return []

  const offer: TowerOffer[] = []
  for (let i = 0; i < size; i++) {
    const defId = towers[rng.int(0, towers.length - 1)] as string
    const rarity = rollRarity(state, defId, rng, floor)
    if (rarity === null) continue
    offer.push({ defId, rarity, traits: rollTraits(state, defId, rarity, rng) })
  }
  return offer
}

/**
 * Das offene Angebot - erzeugt keines von selbst.
 *
 * Anders als beim Levelaufstieg entsteht ein Turmangebot nur auf **Verlangen**: Es kostet
 * Gold, und ein Fenster, das ungefragt aufgeht und Geld verlangt, waere ein Uebergriff.
 */
export function currentTowerOffer(state: GameState): TowerOffer[] {
  return state.run.towerOffer
}

/**
 * Einen Kauf beginnen: Gold ausgeben, Karten wuerfeln.
 *
 * Bezahlt wird **hier**, nicht bei der Wahl. Sonst koennte man sich Angebote ansehen, bis
 * eines gefaellt - der Preis gilt dem Wurf, nicht dem Turm (GDD 06 Abschnitt 1).
 */
export function startTowerPurchase(state: GameState): boolean {
  if (state.run.towerOffer.length > 0) return false

  const cost = towerCost(state)
  if (!spendGold(state, cost)) return false

  const offer = rollTowerOffer(state, state.runtime.rng)
  if (offer.length === 0) return false

  state.run.towerOffer = offer
  markDirty(state)
  emit('tower.offered', { cost, count: offer.length })
  return true
}

/**
 * Eine Karte annehmen. Der Turm landet im Inventar, das Angebot ist verbraucht.
 *
 * Der Zaehler steigt erst hier: Wer ein Angebot geworfen bekommt und das Spiel schliesst,
 * soll beim naechsten Start nicht den hoeheren Preis vorfinden.
 */
export function takeTowerOffer(state: GameState, index: number): boolean {
  const offer = state.run.towerOffer[index]
  if (!offer) return false

  const module = newModule(state.run.station, offer.defId, offer.rarity, [...offer.traits])
  state.run.station.inventory.push(module)
  state.run.towersBought += 1
  state.run.towerOffer = []

  markDirty(state)
  emit('tower.bought', { defId: offer.defId, rarity: offer.rarity, uid: module.uid })
  return true
}

/**
 * Ein Angebot verwerfen, ohne zu waehlen.
 *
 * Das Gold ist weg - es galt dem Wurf. Der Ausweg steht trotzdem offen, weil ein Fenster,
 * das sich nicht schliessen laesst, die Oberflaeche blockiert.
 */
export function discardTowerOffer(state: GameState): void {
  if (state.run.towerOffer.length === 0) return
  state.run.towerOffer = []
  markDirty(state)
}

// ---------------------------------------------------------------------------
// Schmelzen (GDD 06 Abschnitt 5)
// ---------------------------------------------------------------------------

export type MeltResult = { melted: number; offer: TowerOffer[] }

/** Wie viele Tuerme im Lager liegen und damit geschmolzen werden koennten. */
export function meltableCount(state: GameState): number {
  return state.run.station.inventory.length
}

/**
 * Drei Tuerme einschmelzen und dafuer ein **kostenloses** Angebot bekommen
 * (GDD 06 Abschnitt 5).
 *
 * Kostenlos, weil der Einsatz die drei Tuerme sind. Sie sind endgueltig weg - das ist der
 * Preis, und deshalb ist die Wahl, welche drei man aufgibt, die eigentliche Entscheidung.
 *
 * Nur aus dem **Lager**: Ein platzierter Turm wird nicht eingeschmolzen, ohne ihn vorher
 * abzubauen. Sonst verschwaende ein Klick die halbe Station.
 */
export function meltTowers(state: GameState, uids: readonly string[]): MeltResult | null {
  if (uids.length !== MELT_COST) return null
  if (state.run.towerOffer.length > 0) return null

  const unique = new Set(uids)
  if (unique.size !== uids.length) return null

  const inventory = state.run.station.inventory
  const keep = inventory.filter((module) => !unique.has(module.uid))
  if (inventory.length - keep.length !== MELT_COST) return null

  const offer = rollTowerOffer(state, state.runtime.rng)
  if (offer.length === 0) return null

  state.run.station.inventory = keep
  state.run.towerOffer = offer

  markDirty(state)
  emit('tower.melted', { count: MELT_COST })
  return { melted: MELT_COST, offer }
}

/** Fuer den Spielstand: eine gelesene Karte pruefen, statt ihr zu vertrauen. */
export function isValidOffer(value: unknown): value is TowerOffer {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  if (typeof entry['defId'] !== 'string' || !isKnownTower(entry['defId'])) return false
  if (!isRarity(entry['rarity'])) return false
  if (!Array.isArray(entry['traits'])) return false
  return entry['traits'].every((trait) => typeof trait === 'string')
}
