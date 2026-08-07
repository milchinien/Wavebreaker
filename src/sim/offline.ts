/**
 * Abwesenheitsertrag (GDD 12 Teil A).
 *
 * **Die eine Regel dieser Datei: Es gibt keine zweite Simulation.** Sie ruft `stepBattle`
 * in einer Schleife auf - dasselbe `stepBattle`, das auch im Vordergrund laeuft. Wer den
 * Offline-Ertrag stattdessen aus einer Formel schaetzt, baut ein zweites Regelwerk, das mit
 * jedem neuen Turm und jedem neuen Gegner weiter auseinanderlaeuft. Genau deshalb steht
 * diese Etappe im Plan hinter dem gesamten Kampf und nicht davor.
 *
 * Drei Dinge unterscheiden den Schnelldurchlauf vom Vordergrund:
 *
 * **Der Schritt ist groeber.** 20 Takte je Sekunde statt 60. Das ist nachweislich harmlos:
 * Geschosse treffen, sobald sie ihr Ziel in diesem Schritt erreichen wuerden (sie koennen
 * also nicht daneben fliegen), und Tuerme feuern mehrfach je Takt, wenn ihr Angriffstempo
 * ueber der Taktrate liegt. Was sich aendert, ist die Rechenzeit - um zwei Drittel.
 *
 * **Nur ein Teil der Zeit wird angerechnet.** GDD 12 Abschnitt 7 verlangt, dass Offline nie
 * staerker ist als aktives Spielen. Der Abschlag sitzt an der **Zeit**, nicht an der
 * Belohnung: Dadurch faellt alles gleichmaessig geringer aus - Gold, Erfahrung,
 * Wellenfortschritt - und die Belohnungsrechnung braucht keinen zweiten Weg.
 *
 * **Das Gold wird gutgeschrieben.** Waehrend der Abwesenheit ist niemand da, der es
 * einsammelt (GDD 12 Abschnitt 3), also raeumt der Durchlauf das Feld zum Schluss ab. Die
 * Muenzen, die vorher schon dalagen, gehen dabei mit - sie sind auf dem Konto besser
 * aufgehoben als im Feld, und dem Spieler geht dadurch nichts verloren.
 */

import { emit } from '../core/events.ts'
import {
  OFFLINE_BASE_EFFICIENCY,
  OFFLINE_COLLECTOR_BONUS,
  OFFLINE_IMPROVED_BONUS,
  OFFLINE_MAX_EFFICIENCY,
  OFFLINE_MAX_SECONDS,
  OFFLINE_MIN_SECONDS,
  OFFLINE_TICK_RATE,
} from '../data/balance.ts'
import { markDirty, type GameState, type OfflineResult } from '../app/state.ts'
import { stepBattle, syncStation } from './battle.ts'
import { collectAll } from './economy.ts'
import { collectorLevel } from './helpers.ts'
import { isUnlocked } from './prestige.ts'
import { currentLevel } from './progression.ts'
import type { BuffResult } from './buffs.ts'
import type { PlacedModule } from './station.ts'

/** Der Prestige-Knoten, der den Abwesenheitsertrag ueberhaupt freischaltet. */
export const OFFLINE_NODE = 'eco.offline'

/** Ist der Abwesenheitsertrag freigeschaltet (GDD 12 Abschnitt 1)? */
export function offlineUnlocked(state: GameState): boolean {
  return isUnlocked(state, OFFLINE_NODE)
}

/**
 * Wie viel der Abwesenheit ueberhaupt zaehlt.
 *
 * Alles ueber der Obergrenze verfaellt (GDD 12 Abschnitt 7). Sehr kurze Abwesenheiten
 * werden verworfen: Ein Bericht ueber vierzig Sekunden waere ein Fenster ohne Inhalt.
 */
export function capOfflineTime(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < OFFLINE_MIN_SECONDS) return 0
  return Math.min(seconds, OFFLINE_MAX_SECONDS)
}

/**
 * Der Wirkungsgrad: welcher Anteil der Abwesenheit tatsaechlich simuliert wird.
 *
 * Grundwert aus `data/balance.ts`, angehoben durch "Verbesserte Simulation" (GDD 12
 * Abschnitt 1) und durch den Goldsammler (GDD 12 Abschnitt 11: "Offline erhoeht der
 * Goldsammler die Goldausbeute"). Der Deckel haelt ihn unter eins - aktives Spielen bleibt
 * immer besser.
 */
export function offlineEfficiency(state: GameState): number {
  let value = OFFLINE_BASE_EFFICIENCY
  if (isUnlocked(state, 'eco.offline2')) value += OFFLINE_IMPROVED_BONUS
  if (collectorLevel(state) > 0) value += OFFLINE_COLLECTOR_BONUS
  return Math.min(OFFLINE_MAX_EFFICIENCY, value)
}

/**
 * Die Abwesenheit verrechnen.
 *
 * `seconds` ist die echte verstrichene Zeit; gedeckelt und mit dem Wirkungsgrad
 * multipliziert ergibt sie die simulierte Zeit. Ist der Ertrag nicht freigeschaltet oder
 * die Abwesenheit zu kurz, gibt die Funktion `null` zurueck und **aendert nichts** - der
 * Spieler steht dann genau da, wo er aufgehoert hat.
 *
 * Die Simulation braucht dieselbe Vorbereitung wie ein Bild im Vordergrund: Geometrie und
 * Buffs muessen stehen, sonst schoesse kein Turm.
 */
export function simulateOffline(
  state: GameState,
  seconds: number,
  view: { modules: PlacedModule[]; buffs: Map<string, BuffResult> },
): OfflineResult | null {
  if (!offlineUnlocked(state)) return null

  const capped = capOfflineTime(seconds)
  if (capped <= 0) return null

  const simulated = capped * offlineEfficiency(state)
  if (simulated <= 0) return null

  const waveFrom = state.run.wave
  const goldBefore = state.run.gold
  const xpBefore = state.run.xp
  const levelBefore = currentLevel(state)
  let kills = 0

  syncStation(state, view.modules, view.buffs)

  const step = 1 / OFFLINE_TICK_RATE
  const ticks = Math.floor(simulated * OFFLINE_TICK_RATE)
  for (let i = 0; i < ticks; i++) {
    stepBattle(state, step)
    kills += 0 // siehe unten: gezaehlt wird ueber den Kampfzustand, nicht je Takt
  }

  // Gezaehlt wird am Ende ueber das Gold: Die Zahl der Kills je Takt abzugreifen hiesse,
  // in der heissesten Schleife des Spiels eine Zeile fuer die Anzeige zu haben. Der
  // Wellenzaehler des Gefechts weiss es ohnehin.
  kills = state.runtime.combat.killsThisWave

  // Niemand ist da, der einsammelt (GDD 12 Abschnitt 3) - das Feld wird abgeraeumt.
  collectAll(state)

  const result: OfflineResult = {
    seconds: capped,
    simulated,
    waveFrom,
    waveTo: state.run.wave,
    gold: Math.max(0, state.run.gold - goldBefore),
    xp: Math.max(0, state.run.xp - xpBefore),
    levels: Math.max(0, currentLevel(state) - levelBefore),
    kills,
  }

  markDirty(state)
  emit('offline.resolved', {
    seconds: result.seconds,
    gold: result.gold,
    xp: result.xp,
    waves: result.waveTo - result.waveFrom,
  })
  return result
}

