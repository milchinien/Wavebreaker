/**
 * Prestige: zuruecksetzen, um dauerhaft staerker zu werden (GDD 10).
 *
 * Diese Datei ist die **einzige Auskunftsstelle fuer Freischaltungen**. Wer wissen will, ob
 * Rare-Tuerme fallen duerfen, ob Tempo x4 erlaubt ist oder wie viele Turmplaetze es gibt,
 * fragt hier - und die Antwort ist immer eine Abfrage auf `permanent.prestigeNodes`, nie
 * eine Verzweigung im Code (GDD 16 Abschnitt 2).
 *
 * **Die gefaehrlichste Stelle des ganzen Spiels** ist `doPrestige`. Ein Feld, das faelschlich
 * zurueckgesetzt wird, kostet den Spieler dauerhaften Fortschritt; ein Feld, das faelschlich
 * bleibt, macht das Zuruecksetzen sinnlos. Deshalb steht die Trennung nicht in dieser Datei,
 * sondern in `app/state.ts`: `permanent` bleibt, `run` entsteht neu. `doPrestige` ersetzt
 * den ganzen `run`-Block, statt Feld fuer Feld zurueckzusetzen - was nicht aufgezaehlt wird,
 * kann auch nicht vergessen werden. Der Selbsttest prueft beide Feldlisten.
 */

import { emit } from '../core/events.ts'
import { randomSeed } from '../core/rng.ts'
import {
  GOLD_PER_PRESTIGE_POINT,
  MAX_ABILITY_SLOTS,
  PRESTIGE_MIN_GOLD,
  PRESTIGE_WAVE_DIVISOR,
  PRESTIGE_WAVE_EXPONENT,
  START_ABILITY_SLOTS,
  START_TOWER_SLOTS,
} from '../data/balance.ts'
import { isKnownPrestigeNode, prestigeNodeById } from '../data/prestige.ts'
import type { TraitTier } from '../data/traits.ts'
import type { Rarity } from '../data/types.ts'
import { grantReward, spendPrestigePoints } from '../app/rewards.ts'
import { createInitialRun, createRuntime, markDirty, type GameState } from '../app/state.ts'
import { surgeStation } from './combat.ts'

// ---------------------------------------------------------------------------
// Freischaltungen - die eine Auskunftsstelle
// ---------------------------------------------------------------------------

/** Ist dieser Knoten gekauft? **Datenabfrage**, keine Codeverzweigung (GDD 16 Abschnitt 2). */
export function isUnlocked(state: GameState, nodeId: string): boolean {
  return state.permanent.prestigeNodes.includes(nodeId)
}

/** Sind alle Voraussetzungen erfuellt? Ein Knoten ohne Voraussetzungen ist immer verfuegbar. */
export function isAvailable(state: GameState, nodeId: string): boolean {
  if (!isKnownPrestigeNode(nodeId)) return false
  if (isUnlocked(state, nodeId)) return false
  return prestigeNodeById(nodeId).requires.every((required) => isUnlocked(state, required))
}

/**
 * Die hoechste freigeschaltete Raritaet. Sie entscheidet, was beim Turmkauf ueberhaupt
 * fallen kann (GDD 06 Abschnitt 8).
 */
export function unlockedRarity(state: GameState): Rarity {
  if (isUnlocked(state, 'rarity.mythic')) return 'mythic'
  if (isUnlocked(state, 'rarity.legendary')) return 'legendary'
  if (isUnlocked(state, 'rarity.epic')) return 'epic'
  if (isUnlocked(state, 'rarity.rare')) return 'rare'
  return 'common'
}

/**
 * Die hoechste freigeschaltete Eigenschafts-Qualitaet, oder `null`.
 *
 * `null` heisst: Tuerme bekommen **gar keine** Eigenschaften, auch wenn ihre Raritaet
 * Plaetze dafuer oeffnet. Das ist gewollt - die Ebene der Eigenschaften ist eine eigene
 * Freischaltung (GDD 06 Abschnitt 10).
 */
export function unlockedTraitTier(state: GameState): TraitTier | null {
  if (isUnlocked(state, 'trait.mythic')) return 'mythic'
  if (isUnlocked(state, 'trait.legendary')) return 'legendary'
  if (isUnlocked(state, 'trait.epic')) return 'epic'
  if (isUnlocked(state, 'trait.rare')) return 'rare'
  return null
}

/** Turmplaetze: Startwert plus jeder gekaufte Platz-Knoten (GDD 10, Bereich 2). */
export function towerSlots(state: GameState): number {
  let slots = START_TOWER_SLOTS
  for (const id of ['towers.slot1', 'towers.slot2', 'towers.slot3']) {
    if (isUnlocked(state, id)) slots += 1
  }
  return slots
}

/** Faehigkeitenslots: einer zu Beginn, zwei weitere ueber den Baum (GDD 09 Abschnitt 8). */
export function abilitySlots(state: GameState): number {
  let slots = START_ABILITY_SLOTS
  if (isUnlocked(state, 'towers.ability2')) slots += 1
  if (isUnlocked(state, 'towers.ability3')) slots += 1
  return Math.min(MAX_ABILITY_SLOTS, slots)
}

/**
 * Waehlbare Spielgeschwindigkeiten (GDD 10, Bereich 2b).
 *
 * Das Spiel startet mit fester Geschwindigkeit. x2 und x4 sind Freischaltungen - laut GDD
 * eine der befriedigendsten des Spiels, weil sich das Spieltempo sofort spuerbar aendert.
 */
export function availableSpeeds(state: GameState): (1 | 2 | 4)[] {
  const speeds: (1 | 2 | 4)[] = [1]
  if (isUnlocked(state, 'speed.x2')) speeds.push(2)
  if (isUnlocked(state, 'speed.x4')) speeds.push(4)
  return speeds
}

/**
 * Dauerhafte Faktoren aus dem Baum. Sie haengen sich in `sim/stats.ts` an dieselbe Kette
 * wie Upgrades und Perks - deshalb gibt es hier nur die Summe, nicht die Anwendung.
 */
export function prestigeGlobalBonus(state: GameState, key: string): number {
  let total = 0
  if (key === 'goldBonus') {
    if (isUnlocked(state, 'eco.gold1')) total += 0.1
    if (isUnlocked(state, 'eco.gold2')) total += 0.25
    if (isUnlocked(state, 'eco.gold3')) total += 0.5
  } else if (key === 'xpBonus') {
    if (isUnlocked(state, 'eco.xp1')) total += 0.25
  }
  return total
}

// ---------------------------------------------------------------------------
// Punkte und Voraussetzung
// ---------------------------------------------------------------------------

/**
 * Punkte fuer den aktuellen Run (GDD 10 Abschnitt 5).
 *
 * Grundprinzip des GDD: "je weiter der Spieler kommt, desto ueberproportional mehr Punkte".
 * Deshalb steht die Welle im Quadrat und das Gold nur linear - Gold waechst ohnehin mit der
 * Welle, und beides ueberproportional zu nehmen liesse die Kurve zweimal dasselbe belohnen.
 *
 * Nachgerechnet gegen die Richtwerte aus GDD 10 Abschnitt 5 (ohne Goldanteil):
 *
 *   Welle    Richtwert     Formel
 *   100      5 bis 10      4
 *   500      50 bis 100    123
 *   1.000    500           493
 *
 * Zwei von drei liegen im oder am Zielbereich, der dritte um ein Fuenftel darueber. Das GDD
 * nennt die Formel ausdruecklich einen Balancing-Wert; sie wird mit der Wellenkurve zusammen
 * justiert (GDD 15 Abschnitt 16).
 *
 * Gezaehlt wird der **Wellenrekord dieses Runs**, nicht die gerade gespielte Welle: Wer
 * zurueckspult, um Gold zu sammeln, soll dafuer nicht bestraft werden.
 */
export function prestigePoints(state: GameState): number {
  const wave = Math.max(0, state.run.waveRecord)
  const fromWave = Math.pow(wave / PRESTIGE_WAVE_DIVISOR, PRESTIGE_WAVE_EXPONENT)
  const fromGold = Math.max(0, state.run.goldEarned) / GOLD_PER_PRESTIGE_POINT
  return Math.floor(fromWave + fromGold)
}

/**
 * Voraussetzung: mindestens 1.000 **insgesamt gesammeltes** Gold (GDD 10 Abschnitt 3).
 *
 * Gemessen wird `goldEarned`, nicht der aktuelle Kontostand - sonst koennte man sich das
 * Prestige durch Sparen erschleichen oder sich durch Ausgeben darum bringen.
 */
export function canPrestige(state: GameState): boolean {
  return state.run.goldEarned >= PRESTIGE_MIN_GOLD
}

/** Gold, das beim Prestige mit verfaellt - das Bestaetigungsfenster weist darauf hin. */
export function goldLostOnPrestige(state: GameState): number {
  let onField = 0
  for (const coin of state.run.coins) onField += coin.value
  return state.run.gold + onField
}

// ---------------------------------------------------------------------------
// Kaufen und Zuruecksetzen
// ---------------------------------------------------------------------------

/**
 * Einen Knoten kaufen. Gibt `false` zurueck, wenn er unbekannt, schon gekauft, nicht
 * verfuegbar oder zu teuer ist - dann aendert sich nichts.
 *
 * Wirkt **sofort**, nicht erst im naechsten Run: Ein gekaufter Turmplatz ist sofort da, ein
 * freigeschaltetes Tempo sofort waehlbar. Alles andere waere eine Wartezeit ohne Grund.
 */
export function buyNode(state: GameState, nodeId: string): boolean {
  if (!isAvailable(state, nodeId)) return false

  const node = prestigeNodeById(nodeId)
  // Ausgegeben wird ueber `app/rewards.ts` - dort und nur dort aendern sich die Ressourcen
  // des Spielers (GDD 16 Abschnitt 2). Reicht es nicht, aendert sich nichts.
  if (!spendPrestigePoints(state, node.cost)) return false

  state.permanent.prestigeNodes.push(nodeId)
  syncUnlocks(state)

  markDirty(state)
  emit('prestige.nodeBought', { nodeId, cost: node.cost })
  return true
}

/**
 * Abgeleitete Grenzen in den Run schreiben.
 *
 * Turmplaetze und Faehigkeitenslots **koennten** jederzeit aus dem Baum gerechnet werden -
 * sie stehen trotzdem im Run, weil `canPlace` und `sanitizeStation` nur die Station
 * bekommen und nicht den ganzen Zustand. Diese Funktion ist die eine Stelle, die beide
 * Sichten gleichzieht: nach einem Kauf, nach einem Prestige und nach dem Laden.
 */
export function syncUnlocks(state: GameState): void {
  state.run.station.slots = towerSlots(state)
  state.run.abilitySlots = abilitySlots(state)

  // Ein Slot kann durch einen frueheren Spielstand ueber der neuen Grenze liegen - dann
  // faellt die Belegung entsprechend zurueck, statt heimlich mehr zuzulassen.
  if (state.run.equipped.length > state.run.abilitySlots) {
    state.run.equipped.length = state.run.abilitySlots
  }
}

/**
 * Den Run zuruecksetzen und dauerhaft staerker zurueckkommen (GDD 10 Abschnitt 3 und 4).
 *
 * `run` wird **komplett ersetzt**, nicht Feld fuer Feld geleert. Das ist Absicht: Eine
 * Liste zurueckzusetzender Felder muesste bei jedem neuen Feld gepflegt werden, und genau
 * das vergisst man. Was neu entsteht, kann nicht vergessen werden.
 *
 * `permanent` wird nur ergaenzt - Punkte dazu, Zaehler hoch, Bestwert nachziehen.
 */
export function doPrestige(state: GameState, coreId?: string): boolean {
  if (!canPrestige(state)) return false

  const earned = prestigePoints(state)
  const wave = state.run.waveRecord

  // Die Punkte sind eine Belohnung wie Gold und XP und laufen deshalb durch dieselbe eine
  // Stelle - noch **vor** dem Zuruecksetzen, solange der alte Run und seine Laufzeitdaten
  // noch stehen.
  grantReward(state, { prestigePoints: earned }, 'prestige')
  state.permanent.prestigeCount += 1
  state.permanent.bestWaveEver = Math.max(state.permanent.bestWaveEver, wave)

  // Der neue Run bekommt einen frischen Startwert - zwei Runs nacheinander sollen sich
  // nicht gleich anfuehlen.
  const run = createInitialRun(randomSeed())
  if (coreId !== undefined && state.permanent.unlockedCores.includes(coreId)) {
    run.station.coreId = coreId
  }

  state.run = run
  // Die Laufzeitdaten gehoeren zum Run: laufende Abklingzeiten, angesagte Stufe, das
  // ganze Gefecht. Sie werden mit ihm neu erzeugt statt einzeln geleert.
  state.runtime = createRuntime(run)
  syncUnlocks(state)

  // Die Energiewelle (GDD 13 Abschnitt 10) - **nach** dem Zuruecksetzen, weil sie in den
  // frischen Laufzeitdaten liegen muss. In den alten gelegt waere sie mit ihnen verworfen.
  surgeStation(state)

  markDirty(state)
  emit('prestige.done', { points: earned, wave, coreId: run.station.coreId })
  return true
}
