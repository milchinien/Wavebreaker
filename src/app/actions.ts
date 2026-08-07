/**
 * Jede Spielerhandlung als eine Funktion.
 *
 * `render/` und `ui/` lesen den Zustand und rufen ausschliesslich hier an - sie aendern
 * nie direkt etwas (Implementierungsplan Abschnitt 2). Nur so laufen Offline-Simulation
 * und Selbsttests spaeter durch dieselbe Logik.
 *
 * Jede Handlung, die den Spielstand veraendert, meldet ein Ereignis und merkt die
 * Aenderung fuer die naechste Sicherung vor.
 */

import { emit } from '../core/events.ts'
import type { Vec2 } from '../core/vec.ts'
import { upgradeCost } from '../data/balance.ts'
import { isKnownUpgrade, upgradeById } from '../data/upgrades.ts'
import { activateAbility, toggleEquipped, unlockAbility } from '../sim/abilities.ts'
import { placeFlash, spawnGain, spawnPickups } from '../sim/combat.ts'
import { collectAt, collectRadius, meanCoinValue, type Coin } from '../sim/economy.ts'
import { collectPodsAt, resolveEvent } from '../sim/events.ts'
import { buyNode, doPrestige, isUnlocked } from '../sim/prestige.ts'
import { buyFromTrader, dismissTrader, reachTraderAt } from '../sim/trader.ts'
import { choosePerk } from '../sim/progression.ts'
import {
  discardTowerOffer,
  meltTowers,
  startTowerPurchase,
  takeTowerOffer,
  towerCost,
} from '../sim/shop.ts'
import { maxStationHp, upgradeLevel } from '../sim/stats.ts'
import { nextWave, previousWave, setAutoMode } from '../sim/waves.ts'
import { spendGold } from './rewards.ts'
import {
  canMove,
  canPlace,
  CORE_UID,
  findModule,
  move,
  place,
  remove,
  type ActionError,
  type FreeEdge,
} from '../sim/station.ts'
import { markDirty, type GameState, type View } from './state.ts'
import { invalidateStationView } from './view.ts'

export type ActionResult = ActionError | null

/** Bau-Modus starten: ein Modul aus dem Inventar haengt am Mauszeiger. */
export function startBuild(state: GameState, uid: string): ActionResult {
  const module = state.run.station.inventory.find((m) => m.uid === uid)
  if (!module) return 'not_owned'

  state.runtime.buildUid = uid
  state.runtime.dragUid = null
  state.runtime.selectedUid = null
  state.runtime.hoverEdge = null
  return null
}

export function cancelBuild(state: GameState): void {
  state.runtime.buildUid = null
  state.runtime.dragUid = null
  state.runtime.hoverEdge = null
}

/** Umsetzen beginnen: ein bereits platziertes Modul wird gezogen. */
export function startDrag(state: GameState, uid: string): ActionResult {
  if (!state.run.station.placed.some((m) => m.uid === uid)) return 'not_placed'

  state.runtime.dragUid = uid
  state.runtime.buildUid = null
  state.runtime.hoverEdge = null
  return null
}

export function placeModule(state: GameState, uid: string, at: FreeEdge): ActionResult {
  const module = state.run.station.inventory.find((m) => m.uid === uid)
  if (!module) return 'not_owned'

  const error = place(state.run.station, uid, at)
  if (error) return error

  state.runtime.buildUid = null
  state.runtime.hoverEdge = null
  state.runtime.selectedUid = uid
  // Bauen ist Fortschritt, der nie verloren gehen darf (GDD 16 Abschnitt 8).
  markDirty(state)
  invalidateStationView(state)
  // Erst neu rechnen, dann quittieren: Der Ring soll dort aufgehen, wo das Modul jetzt
  // sitzt, und seine Mitte steht erst nach der Neuberechnung fest.
  placeFlash(state, uid)
  emit('module.placed', { uid, defId: module.defId })
  return null
}

export function moveModule(state: GameState, uid: string, to: FreeEdge): ActionResult {
  const error = move(state.run.station, uid, to)
  if (error) return error

  state.runtime.dragUid = null
  state.runtime.hoverEdge = null
  state.runtime.selectedUid = uid
  markDirty(state)
  invalidateStationView(state)
  // Ein Modul, das an einer neuen Kante ankommt, ist fuer das Auge dasselbe Ereignis wie
  // ein neu gesetztes - also dieselbe Quittung.
  placeFlash(state, uid)
  emit('module.moved', { uid })
  return null
}

/**
 * Entfernen ist immer erlaubt. Module, die dadurch den Anschluss verlieren, wandern mit
 * ins Inventar zurueck (GDD 03 Abschnitt 4) - die Vorschau hat das vorher gezeigt.
 */
export function removeModule(state: GameState, uid: string): ActionResult {
  if (!state.run.station.placed.some((m) => m.uid === uid)) return 'not_placed'

  const moved = remove(state.run.station, uid)
  if (moved.length === 0) return 'not_placed'

  if (state.runtime.selectedUid === uid) state.runtime.selectedUid = null
  if (state.runtime.dragUid === uid) state.runtime.dragUid = null
  markDirty(state)
  invalidateStationView(state)
  emit('module.removed', { uid, alsoDetached: moved.length - 1 })
  return null
}

export function selectModule(state: GameState, uid: string | null): void {
  state.runtime.selectedUid = uid !== null && findModuleOrCore(state, uid) ? uid : null
}

export function hoverModule(state: GameState, uid: string | null): void {
  state.runtime.hoverUid = uid
}

export function hoverEdge(state: GameState, edge: FreeEdge | null): void {
  state.runtime.hoverEdge = edge
}

export function setView(state: GameState, view: View): void {
  if (state.runtime.view === view) return
  state.runtime.view = view
  cancelBuild(state)
  emit('view.changed', { view })
}

/** Kann an dieser Kante gebaut werden - und wenn nicht, warum? */
export function placementError(state: GameState, at: FreeEdge): ActionResult {
  const { buildUid, dragUid } = state.runtime
  const uid = buildUid ?? dragUid
  if (!uid) return null

  if (dragUid) return canMove(state.run.station, dragUid, at)

  const module = state.run.station.inventory.find((m) => m.uid === uid)
  if (!module) return 'not_owned'
  return canPlace(state.run.station, module.defId, at)
}

function findModuleOrCore(state: GameState, uid: string): boolean {
  return uid === CORE_UID || findModule(state.run.station, uid) !== undefined
}

// ---------------------------------------------------------------------------
// Upgrades (GDD 08)
// ---------------------------------------------------------------------------

/**
 * Kosten der naechsten Stufe eines Pfads. `null`, wenn das Maximum erreicht ist oder der
 * Pfad noch gar nicht freigeschaltet ist.
 *
 * Die Freischaltung wird **hier** geprueft und nicht nur im Menue: Ein Pfad, der im Menue
 * fehlt, waere sonst ueber einen anderen Weg trotzdem kaufbar. Die Regel gehoert an die
 * Handlung, nicht an ihre Darstellung.
 */
export function nextUpgradeCost(state: GameState, path: string): number | null {
  if (!isKnownUpgrade(path)) return null
  const def = upgradeById(path)
  if (def.unlock !== undefined && !isUnlocked(state, def.unlock)) return null
  const level = upgradeLevel(state.run.upgrades, path)
  if (level >= def.maxLevel) return null
  return upgradeCost(def.baseCost, level + 1)
}

/**
 * Ein Upgrade kaufen. Wirkt sofort - alle Werte laufen durch `sim/stats.ts`, es gibt
 * keinen zweiten Ort, an dem Kampfwerte entstehen.
 */
export function buyUpgrade(state: GameState, path: string): boolean {
  const cost = nextUpgradeCost(state, path)
  if (cost === null) return false
  if (!spendGold(state, cost)) return false

  const level = upgradeLevel(state.run.upgrades, path) + 1
  state.run.upgrades[path] = level

  // Mehr Stations-HP wirken sofort, nicht erst ab der naechsten Welle.
  const combat = state.runtime.combat
  const previousMax = combat.maxStationHp
  combat.maxStationHp = maxStationHp(state)
  if (combat.maxStationHp > previousMax) combat.stationHp += combat.maxStationHp - previousMax

  markDirty(state)
  emit('upgrade.bought', { path, level, cost })
  return true
}

// ---------------------------------------------------------------------------
// Level und Perks (GDD 09 Teil A)
// ---------------------------------------------------------------------------

/**
 * Einen der drei angebotenen Perks annehmen.
 *
 * Die Pruefung - steht ueberhaupt ein Aufstieg offen, gehoert der Perk zum Angebot - liegt
 * in `sim/progression.ts`. Hier steht nur, was danach passiert: Mehr Stations-HP sollen
 * sofort wirken, nicht erst ab der naechsten Welle, genau wie bei einem Upgrade.
 */
export function takePerk(state: GameState, perkId: string): boolean {
  if (!choosePerk(state, perkId)) return false
  applyStationHpChange(state)
  markDirty(state)
  return true
}

// ---------------------------------------------------------------------------
// Faehigkeiten (GDD 09 Teil B)
// ---------------------------------------------------------------------------

/** Eine Faehigkeit mit Gold freischalten. */
export function buyAbility(state: GameState, id: string): boolean {
  return unlockAbility(state, id)
}

/** Eine freigeschaltete Faehigkeit auf einen Slot legen oder von ihm nehmen. */
export function toggleAbilitySlot(state: GameState, id: string): boolean {
  return toggleEquipped(state, id)
}

/**
 * Eine Faehigkeit zuenden.
 *
 * **Nur in der Kampfansicht** (GDD 09 Abschnitt 7): Die Basis bleibt Verwaltungsbereich,
 * auch wenn der Kampf dort weiterlaeuft. Die Regel steht hier und nicht in `sim/`, weil
 * sie von der Ansicht abhaengt - und Ansichten kennt die Simulation nicht.
 */
export function fireAbility(state: GameState, id: string): boolean {
  if (state.runtime.view !== 'combat') return false
  return activateAbility(state, id)
}

/**
 * Die Huelle an einen neuen Hoechstwert anpassen.
 *
 * Wird der Hoechstwert groesser, waechst die aktuelle Huelle um denselben Betrag mit -
 * sonst kaufte man sich mehr Leben und stuende trotzdem gleich knapp da. Wird er kleiner,
 * bleibt die aktuelle Huelle stehen und `healStationFull` zieht sie bei der naechsten
 * Welle nach.
 */
function applyStationHpChange(state: GameState): void {
  const combat = state.runtime.combat
  const previousMax = combat.maxStationHp
  combat.maxStationHp = maxStationHp(state)
  if (combat.maxStationHp > previousMax) combat.stationHp += combat.maxStationHp - previousMax
}

// ---------------------------------------------------------------------------
// Turmkauf und Schmelzen (GDD 06)
// ---------------------------------------------------------------------------

/** Preis des naechsten Turms. Steigt nach jedem Kauf (GDD 06 Abschnitt 2). */
export function towerPrice(state: GameState): number {
  return towerCost(state)
}

/** Gold ausgeben und zwei Karten wuerfeln. Bezahlt wird der Wurf, nicht der Turm. */
export function buyTowerSlot(state: GameState): boolean {
  return startTowerPurchase(state)
}

/** Eine der angebotenen Karten annehmen - der Turm landet im Lager. */
export function takeOffer(state: GameState, index: number): boolean {
  return takeTowerOffer(state, index)
}

/** Das Angebot verwerfen, ohne zu waehlen. Das Gold bleibt ausgegeben. */
export function dropOffer(state: GameState): void {
  discardTowerOffer(state)
}

/**
 * Drei Tuerme aus dem Lager einschmelzen (GDD 06 Abschnitt 5).
 *
 * Der einzige Weg, ueberzaehlige Tuerme loszuwerden - es gibt **keinen Verkauf gegen Gold**
 * (GDD 06 Abschnitt 4). Nach dem Schmelzen steht ein kostenloses Angebot.
 */
export function meltSelection(state: GameState, uids: readonly string[]): boolean {
  return meltTowers(state, uids) !== null
}

// ---------------------------------------------------------------------------
// Prestige (GDD 10)
// ---------------------------------------------------------------------------

/** Einen Knoten des Prestige-Baums kaufen. Wirkt sofort, nicht erst im naechsten Run. */
export function buyPrestigeNode(state: GameState, nodeId: string): boolean {
  return buyNode(state, nodeId)
}

/**
 * Den Run zuruecksetzen und dauerhaft staerker zurueckkommen.
 *
 * Danach steht der Spieler wieder in der Kampfansicht: Ein Prestige beginnt einen neuen
 * Run, und der beginnt dort, wo jeder Run beginnt.
 */
export function performPrestige(state: GameState, coreId?: string): boolean {
  if (!doPrestige(state, coreId)) return false
  setView(state, 'combat')
  return true
}

// ---------------------------------------------------------------------------
// Wellensteuerung (GDD 07 Abschnitt 10)
// ---------------------------------------------------------------------------

export function toggleAutoWaves(state: GameState): void {
  setAutoMode(state, !state.run.autoWaves)
}

export function goToNextWave(state: GameState): boolean {
  return nextWave(state)
}

export function goToPreviousWave(state: GameState): boolean {
  return previousWave(state)
}

// ---------------------------------------------------------------------------
// Gold einsammeln (GDD 08 Abschnitt 2)
// ---------------------------------------------------------------------------

/**
 * Melden, wo der Zeiger steht - in Weltkoordinaten, oder `null` ausserhalb der Flaeche.
 *
 * Eine Meldung, keine Handlung: Sie aendert nichts am Spielstand und merkt deshalb auch
 * nichts fuer die Sicherung vor. Eingesammelte Muenzen fahren dem Zeiger nach und brauchen
 * ihn laufend; ohne diese Zeile kennte die Simulation nur den Ort des letzten Aufhebens.
 */
export function aimAt(state: GameState, pos: Vec2 | null): void {
  state.runtime.pointer = pos
}

/**
 * Alles einsammeln, was im Sammelradius um diesen Weltpunkt liegt.
 *
 * Die eingesammelten Muenzen werden mitgenommen, damit sie sichtbar zum Zeiger fliegen
 * koennen - im Spielstand sind sie in derselben Zeile bereits verschwunden.
 */
export function collectGoldAt(state: GameState, pos: { x: number; y: number }): number {
  // Kapseln liegen im selben Feld und werden auf demselben Weg aufgehoben (GDD 11
  // Abschnitt 8: "muessen manuell eingesammelt werden"). Sie haben nur einen groesseren
  // Radius, weil sie ein Gegenstand sind und kein Krumen.
  collectPodsAt(state, pos)
  // Und auf demselben Weg erreicht der Spieler die Haendler-Drohne: Sie landet in der
  // Arena, also fasst man sie dort an und nicht in einem Menue (GDD 11 Abschnitt 7).
  reachTraderAt(state, pos)

  // Der Durchschnitt des Feldes **vor** dem Einsammeln: Er bestimmt, wie gross eine Muenze
  // aussieht, und die aufgehobene soll auf ihrem Flug genau so gross bleiben, wie sie eben
  // noch dalag (GDD 13 Abschnitt 10).
  const mean = meanCoinValue(state.run.coins)

  const taken: Coin[] = []
  const collected = collectAt(state, pos, collectRadius(state), taken)
  if (collected <= 0) return 0

  spawnPickups(state, taken, pos, mean)
  spawnGain(state, pos, collected)
  emit('gold.collected', { amount: collected })
  return collected
}

// ---------------------------------------------------------------------------
// Ereignisse (GDD 11)
// ---------------------------------------------------------------------------

/**
 * Eine Option des offenen Ereignisses waehlen.
 *
 * Anders als beim Zuenden einer Faehigkeit gibt es hier **keine** Bindung an die
 * Kampfansicht: Ein Ereignis gehoert dem Spieler und faellt auch, waehrend er baut - genau
 * wie ein Levelaufstieg.
 */
export function chooseEventOption(state: GameState, choiceId: string): boolean {
  return resolveEvent(state, choiceId)
}

/**
 * Einen Posten bei der Haendler-Drohne kaufen (GDD 11 Abschnitt 7).
 *
 * **Nur in der Kampfansicht**, aus demselben Grund wie beim Zuenden einer Faehigkeit: Die
 * Drohne steht in der Arena, und wer sie erreicht hat, steht dort auch. In der Basis waere
 * sie ein Menuepunkt - und genau das soll sie nicht sein.
 */
export function buyFromTraderAt(state: GameState, index: number): boolean {
  if (state.runtime.view !== 'combat') return false
  return buyFromTrader(state, index)
}

/** Die Drohne weiterschicken. Einmal besucht ist besucht - sie kommt nicht zurueck. */
export function closeTrader(state: GameState): void {
  dismissTrader(state)
}
