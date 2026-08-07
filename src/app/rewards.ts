/**
 * Die eine Stelle, an der Gold, XP und Prestige-Punkte entstehen.
 *
 * GDD 16 Abschnitt 2 und Implementierungsplan Abschnitt 3: Belohnungen laufen
 * ausschliesslich hier durch. Eine spaetere Werbe-Belohnung ("doppelter Ertrag") haengt
 * sich an diese Funktion, ohne die Spiellogik anzufassen. Deshalb gibt es im ganzen
 * Spiel kein `state.run.gold +=` ausserhalb dieser Datei - der Selbsttest prueft das.
 */

import { emit, type RewardPayload } from '../core/events.ts'
import { markDirty, type GameState } from './state.ts'

export type Reward = RewardPayload

/**
 * Ungueltige Werte werden verworfen statt zugeteilt. Belohnungen sind ihrer Natur nach
 * additiv und nie negativ - ein negativer Betrag ist immer ein Fehler an der Aufrufstelle
 * und darf keinen Fortschritt vernichten.
 */
function usable(value: number | undefined): number {
  if (value === undefined) return 0
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

/**
 * Gold ausgeben. Das Gegenstueck zu `grantReward` und aus demselben Grund hier: Jede
 * Aenderung an den Ressourcen des Spielers laeuft durch diese Datei, damit sich spaeter
 * Boni, Rabatte und Kaufvalidierung an genau einer Stelle anhaengen lassen.
 *
 * Gibt `false` zurueck, wenn das Gold nicht reicht - dann aendert sich nichts.
 */
export function spendGold(state: GameState, amount: number): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false
  if (state.run.gold < amount) return false

  state.run.gold -= amount
  markDirty(state)
  emit('gold.spent', { amount })
  return true
}

export function grantReward(state: GameState, reward: Reward, source = 'unknown'): void {
 * Prestige-Punkte ausgeben. Aus demselben Grund hier wie `spendGold`: Es gibt genau eine
 * Datei, in der sich die Ressourcen des Spielers aendern.
  const prestigePoints = usable(reward.prestigePoints)
 * Prestige-Punkte sind **permanent** (GDD 10 Abschnitt 2) - sie liegen deshalb in
 * `permanent`, nicht im Run, und ueberleben jedes Zuruecksetzen.
 */
export function spendPrestigePoints(state: GameState, amount: number): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false
  if (state.permanent.prestigePoints < amount) return false

  state.permanent.prestigePoints -= amount
  emit('reward.granted', { reward: { gold, xp, prestigePoints }, source })
  emit('prestige.spent', { amount })
  return true
}

export function grantReward(state: GameState, reward: Reward, source = 'unknown'): void {
  const gold = usable(reward.gold)
  const xp = usable(reward.xp)
  const prestigePoints = usable(reward.prestigePoints)

  if (gold === 0 && xp === 0 && prestigePoints === 0) return

  state.run.gold += gold
  // Was der Run insgesamt eingebracht hat - unabhaengig davon, was davon schon ausgegeben
  // ist. Grundlage der Prestige-Voraussetzung und der Punkte (GDD 10 Abschnitt 3 und 5).
  // Es steht hier und nicht an der Ausgabestelle, weil hier **jedes** Gold entsteht.
  state.run.goldEarned += gold
  state.run.xp += xp
  state.permanent.prestigePoints += prestigePoints

  markDirty(state)
  emit('reward.granted', { reward: { gold, xp, prestigePoints }, source })
}

