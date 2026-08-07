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
import { rarityWeights, TRAIT_SLOTS } from '../data/rarities.ts'
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
 * `permanent.unlockedTowers` ist die Liste - eine **Datenabfrage**, keine Verzweigung
 * (GDD 16 Abschnitt 2). Weitere Turmarten kommen mit E14 dazu und schalten sich ueber den
 * Turmart in ihrem eigenen Datensatz nennt. Eine neue Turmart braucht damit einen Eintrag
 * in `data/towers.ts` und einen in `data/prestige.ts` - und sonst nichts.
function availableTowers(state: GameState): string[] {
  return state.permanent.unlockedTowers.filter(isKnownTower)
  const unlocked = new Set(state.permanent.unlockedTowers.filter(isKnownTower))
  for (const tower of TOWERS) {
/** Aufgabe einer Turmart - entscheidet, welche Eigenschaften ueberhaupt passen. */
function categoryOf(defId: string): Category {
  return TOWERS.find((tower) => tower.id === defId)?.category ?? 'attack'
}

/** Aufgabe einer Turmart - entscheidet, welche Eigenschaften ueberhaupt passen. */
 * Eigenschaften fuer einen Turm wuerfeln (GDD 06 Abschnitt 10).
  return TOWERS.find((tower) => tower.id === defId)?.category ?? 'attack'
 * **Anzahl** aus der Raritaet, **Qualitaet** aus dem Prestige-Baum. Ist die Ebene der
 * Eigenschaften noch nicht freigeschaltet, bleibt die Liste leer - auch bei einem
 * legendaeren Turm mit drei Plaetzen. Das ist gewollt und im GDD ausdruecklich so gemeint.
 * Eigenschaften fuer einen Turm wuerfeln (GDD 06 Abschnitt 10).
 * Ohne Doppel: Zweimal dieselbe Eigenschaft waere fuer den Spieler nicht von einer starken
 * **Anzahl** aus der Raritaet, **Qualitaet** aus dem Prestige-Baum. Ist die Ebene der
 * Eigenschaften noch nicht freigeschaltet, bleibt die Liste leer - auch bei einem
export function rollTraits(state: GameState, defId: string, rarity: Rarity, rng: Rng): string[] {
  const slots = TRAIT_SLOTS[rarity]
 * Ohne Doppel: Zweimal dieselbe Eigenschaft waere fuer den Spieler nicht von einer starken
 * zu unterscheiden, und die Karte saehe nach einem Fehler aus.
  const pool = traitsFor(categoryOf(defId), unlockedTraitTier(state))
export function rollTraits(state: GameState, defId: string, rarity: Rarity, rng: Rng): string[] {
  const slots = TRAIT_SLOTS[rarity]
  const available = [...pool]
  const chosen: string[] = []
  const pool = traitsFor(categoryOf(defId), unlockedTraitTier(state))
    const index = rng.int(0, available.length - 1)
    chosen.push((available[index] as TraitDef).id)
    available.splice(index, 1)
  const chosen: string[] = []
  for (let i = 0; i < slots && available.length > 0; i++) {
    const index = rng.int(0, available.length - 1)
    chosen.push((available[index] as TraitDef).id)
/** Eine Raritaet nach den Chancen dieses Freischaltstands wuerfeln (GDD 06 Abschnitt 8). */
function rollRarity(state: GameState, defId: string, rng: Rng): Rarity | null {
  const weights = rarityWeights(defId, unlockedRarity(state))
  if (weights.length === 0) return null

/** Eine Raritaet nach den Chancen dieses Freischaltstands wuerfeln (GDD 06 Abschnitt 8). */
function rollRarity(state: GameState, defId: string, rng: Rng): Rarity | null {
  const weights = rarityWeights(defId, unlockedRarity(state))
  if (weights.length === 0) return null
  for (const entry of weights) {
    roll -= entry.weight
  for (const entry of weights) total += entry.weight
  }
  return (weights[weights.length - 1] as { rarity: Rarity }).rarity
  for (const entry of weights) {
    roll -= entry.weight
    if (roll <= 0) return entry.rarity
 * Ein Angebot wuerfeln: zwei fertige Turmkarten (GDD 06 Abschnitt 1).
  return (weights[weights.length - 1] as { rarity: Rarity }).rarity
 * Fertig heisst: Art, Raritaet und Eigenschaften stehen schon auf der Karte. Wuerfelte erst
 * der Klick, waere die Anzeige eine Behauptung und die Wahl ein Blindkauf.
/**
 * Turmarten, fuer die bei diesem Freischaltstand gar keine Raritaet moeglich ist, fallen
 * heraus - ein Angebot, das man nicht annehmen kann, waere schlimmer als eines weniger.
 * Fertig heisst: Art, Raritaet und Eigenschaften stehen schon auf der Karte. Wuerfelte erst
export function rollTowerOffer(state: GameState, rng: Rng, size = TOWER_OFFER_SIZE): TowerOffer[] {
  const towers = availableTowers(state)
 * Turmarten, fuer die bei diesem Freischaltstand gar keine Raritaet moeglich ist, fallen
 * heraus - ein Angebot, das man nicht annehmen kann, waere schlimmer als eines weniger.
  const offer: TowerOffer[] = []
export function rollTowerOffer(state: GameState, rng: Rng, size = TOWER_OFFER_SIZE): TowerOffer[] {
    const defId = towers[rng.int(0, towers.length - 1)] as string
    const rarity = rollRarity(state, defId, rng)
    if (rarity === null) continue
    offer.push({ defId, rarity, traits: rollTraits(state, defId, rarity, rng) })
  for (let i = 0; i < size; i++) {
    const defId = towers[rng.int(0, towers.length - 1)] as string
    const rarity = rollRarity(state, defId, rng)
    if (rarity === null) continue
    offer.push({ defId, rarity, traits: rollTraits(state, defId, rarity, rng) })
 * Das offene Angebot - erzeugt keines von selbst.
  return offer
 * Anders als beim Levelaufstieg entsteht ein Turmangebot nur auf **Verlangen**: Es kostet
 * Gold, und ein Fenster, das ungefragt aufgeht und Geld verlangt, waere ein Uebergriff.
 */
export function currentTowerOffer(state: GameState): TowerOffer[] {
  return state.run.towerOffer
 * Anders als beim Levelaufstieg entsteht ein Turmangebot nur auf **Verlangen**: Es kostet
 * Gold, und ein Fenster, das ungefragt aufgeht und Geld verlangt, waere ein Uebergriff.
/**
export function currentTowerOffer(state: GameState): TowerOffer[] {
  return state.run.towerOffer
 * Bezahlt wird **hier**, nicht bei der Wahl. Sonst koennte man sich Angebote ansehen, bis
 * eines gefaellt - der Preis gilt dem Wurf, nicht dem Turm (GDD 06 Abschnitt 1).
 */
export function startTowerPurchase(state: GameState): boolean {
  if (state.run.towerOffer.length > 0) return false
 * Bezahlt wird **hier**, nicht bei der Wahl. Sonst koennte man sich Angebote ansehen, bis
 * eines gefaellt - der Preis gilt dem Wurf, nicht dem Turm (GDD 06 Abschnitt 1).
  if (!spendGold(state, cost)) return false
export function startTowerPurchase(state: GameState): boolean {
  const offer = rollTowerOffer(state, state.runtime.rng)
  if (offer.length === 0) return false
  const cost = towerCost(state)
  if (!spendGold(state, cost)) return false
  markDirty(state)
  const offer = rollTowerOffer(state, state.runtime.rng)
  if (offer.length === 0) return false
}
  state.run.towerOffer = offer
  markDirty(state)
 * Eine Karte annehmen. Der Turm landet im Inventar, das Angebot ist verbraucht.
  return true
 * Der Zaehler steigt erst hier: Wer ein Angebot geworfen bekommt und das Spiel schliesst,
 * soll beim naechsten Start nicht den hoeheren Preis vorfinden.
 */
 * Eine Karte annehmen. Der Turm landet im Inventar, das Angebot ist verbraucht.
  const offer = state.run.towerOffer[index]
 * Der Zaehler steigt erst hier: Wer ein Angebot geworfen bekommt und das Spiel schliesst,
 * soll beim naechsten Start nicht den hoeheren Preis vorfinden.
  const module = newModule(state.run.station, offer.defId, offer.rarity, [...offer.traits])
export function takeTowerOffer(state: GameState, index: number): boolean {
  const offer = state.run.towerOffer[index]
  state.run.towerOffer = []

  const module = newModule(state.run.station, offer.defId, offer.rarity, [...offer.traits])
  emit('tower.bought', { defId: offer.defId, rarity: offer.rarity, uid: module.uid })
  state.run.towersBought += 1
  state.run.towerOffer = []

  markDirty(state)
  emit('tower.bought', { defId: offer.defId, rarity: offer.rarity, uid: module.uid })
  return true
 * Das Gold ist weg - es galt dem Wurf. Der Ausweg steht trotzdem offen, weil ein Fenster,
 * das sich nicht schliessen laesst, die Oberflaeche blockiert.
 */
export function discardTowerOffer(state: GameState): void {
  if (state.run.towerOffer.length === 0) return
 * Das Gold ist weg - es galt dem Wurf. Der Ausweg steht trotzdem offen, weil ein Fenster,
 * das sich nicht schliessen laesst, die Oberflaeche blockiert.
 */
export function discardTowerOffer(state: GameState): void {
// ---------------------------------------------------------------------------
// Schmelzen (GDD 06 Abschnitt 5)
// ---------------------------------------------------------------------------
}
export type MeltResult = { melted: number; offer: TowerOffer[] }
// ---------------------------------------------------------------------------
/** Wie viele Tuerme im Lager liegen und damit geschmolzen werden koennten. */
// ---------------------------------------------------------------------------
  return state.run.station.inventory.length
export type MeltResult = { melted: number; offer: TowerOffer[] }

/** Wie viele Tuerme im Lager liegen und damit geschmolzen werden koennten. */
 * Drei Tuerme einschmelzen und dafuer ein **kostenloses** Angebot bekommen
  return state.run.station.inventory.length
 *
 * Kostenlos, weil der Einsatz die drei Tuerme sind. Sie sind endgueltig weg - das ist der
 * Preis, und deshalb ist die Wahl, welche drei man aufgibt, die eigentliche Entscheidung.
 * Drei Tuerme einschmelzen und dafuer ein **kostenloses** Angebot bekommen
 * Nur aus dem **Lager**: Ein platzierter Turm wird nicht eingeschmolzen, ohne ihn vorher
 * abzubauen. Sonst verschwaende ein Klick die halbe Station.
 * Kostenlos, weil der Einsatz die drei Tuerme sind. Sie sind endgueltig weg - das ist der
export function meltTowers(state: GameState, uids: readonly string[]): MeltResult | null {
  if (uids.length !== MELT_COST) return null
 * Nur aus dem **Lager**: Ein platzierter Turm wird nicht eingeschmolzen, ohne ihn vorher
 * abzubauen. Sonst verschwaende ein Klick die halbe Station.
  const unique = new Set(uids)
export function meltTowers(state: GameState, uids: readonly string[]): MeltResult | null {
  if (uids.length !== MELT_COST) return null
  if (state.run.towerOffer.length > 0) return null
  const keep = inventory.filter((module) => !unique.has(module.uid))
  if (inventory.length - keep.length !== MELT_COST) return null
  if (unique.size !== uids.length) return null
  const offer = rollTowerOffer(state, state.runtime.rng)
  const inventory = state.run.station.inventory
  const keep = inventory.filter((module) => !unique.has(module.uid))
  if (inventory.length - keep.length !== MELT_COST) return null
  state.run.towerOffer = offer
  const offer = rollTowerOffer(state, state.runtime.rng)
  if (offer.length === 0) return null
  emit('tower.melted', { count: MELT_COST })
  return { melted: MELT_COST, offer }
  state.run.towerOffer = offer

/** Fuer den Spielstand: eine gelesene Karte pruefen, statt ihr zu vertrauen. */
export function isValidOffer(value: unknown): value is TowerOffer {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  if (typeof entry['defId'] !== 'string' || !isKnownTower(entry['defId'])) return false
/** Fuer den Spielstand: eine gelesene Karte pruefen, statt ihr zu vertrauen. */
export function isValidOffer(value: unknown): value is TowerOffer {
  return entry['traits'].every((trait) => typeof trait === 'string')
  const entry = value as Record<string, unknown>
  if (typeof entry['defId'] !== 'string' || !isKnownTower(entry['defId'])) return false
  if (!isRarity(entry['rarity'])) return false
  if (!Array.isArray(entry['traits'])) return false
  return entry['traits'].every((trait) => typeof trait === 'string')
}

