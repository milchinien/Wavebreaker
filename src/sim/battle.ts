/**
 * Ein Simulationsschritt des Gefechts - die Reihenfolge an einer Stelle.
 *
 * Diese Datei bindet die Teile zusammen und wird selbst von niemandem in `sim/`
 * eingebunden. Dadurch bleibt der Abhaengigkeitsgraph kreisfrei, obwohl sich die
 * Bestandteile gegenseitig brauchen.
 *
 * Die Reihenfolge ist Absicht:
 *   1. Geometrie und Buffs des Ticks bereitstellen
 *   2. zeitlich begrenzte Wirkungen altern: Ereignisse, Faehigkeiten
 *   3. Welle voranschreiten lassen (Erscheinen, Pause, naechste Welle)
 *   4. Gegner bewegen und andocken
 *   5. angedockte Gegner schlagen zu  -> kann die Welle verlieren
 *   6. Tuerme laden, zielen, schiessen
 *   7. Geschosse fliegen und treffen  -> kann Gegner toeten
 *   8. Helfer sammeln auf, was gefallen ist
 *   9. Optisches altern: Trefferblitze, Muendungsfeuer, Rueckstoss
 *
 * Schritt 4 vor 5: Wer die Station erreicht hat, richtet in diesem Tick Schaden an,
 * bevor er sterben kann. Sonst waere Andocken folgenlos, solange genug Feuerkraft steht.
 */

import type { GameState } from '../app/state.ts'
import { stepAbilities } from './abilities.ts'
import { dockedDamage, stepEffects, stepEnemyStates } from './combat.ts'
import { releaseStaleDocks, stepEnemies, stepEnemyAbilities } from './enemies.ts'
import { maybeTriggerEvent, stepEvents } from './events.ts'
import { stepDrones } from './drones.ts'
import { stepHelpers } from './helpers.ts'
import { stepProgression } from './progression.ts'
import { stepProjectiles } from './projectiles.ts'
import { pruneCooldowns, stepTowers } from './towers.ts'
import { maybeSendTrader, stepTrader } from './trader.ts'
import { restartWave, stepWave } from './waves.ts'
import type { BuffResult } from './buffs.ts'
import type { PlacedModule } from './station.ts'

/**
 * Die abgeleitete Sicht auf die Station fuer diesen Tick setzen. Wird von aussen mit dem
 * bereits berechneten Ergebnis versorgt, damit weder Geometrie noch Buffs pro Tick neu
 * bestimmt werden (GDD 03 Abschnitt 10).
 */
export function syncStation(
  state: GameState,
  modules: PlacedModule[],
  buffs: Map<string, BuffResult>,
): void {
  const combat = state.runtime.combat
  if (combat.modules === modules) return

  combat.modules = modules
  combat.buffs = buffs
  // Nach einem Umbau mitten im Kampf zeigen Gegner und Nachladezeiten ins Leere.
  releaseStaleDocks(state)
  pruneCooldowns(state)
}

export function stepBattle(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  // Ereignisse zuerst: Ihre Wirkungen altern hier, und eine abgelaufene soll noch in
  // diesem Takt verschwinden. Faehigkeiten und Ereignisse schreiben verschiedene Felder -
  // ihre Reihenfolge zueinander macht deshalb nichts aus.
  stepEvents(state, dt)

  // Wirkungen und Abklingzeiten laufen **vor** dem Kampf: Wer in diesem Takt eine
  // Faehigkeit zuendet, soll sie noch in diesem Takt spueren und nicht erst im naechsten.
  stepAbilities(state, dt)

  // Ein Ereignis wird faellig, sobald seine Welle erreicht ist (GDD 11 Abschnitt 2). Der
  // Kampf laeuft dabei normal weiter - das Fenster haelt nur die Bedienung des Feldes an.
  maybeTriggerEvent(state, state.runtime.rng)

  // Die Haendler-Drohne kommt auf ihrer eigenen Welle und geht nach ihrer eigenen Uhr
  // (GDD 11 Abschnitt 7). Sie haelt nichts an - sie steht nur da und wartet.
  maybeSendTrader(state, state.runtime.rng)
  stepTrader(state, dt)

  stepWave(state, dt)
  // Erst was der Gegner **kann**, dann wohin er geht: Ein Teleporter soll in demselben
  // Takt springen, in dem er sich sonst bewegt hätte, nicht einen später.
  stepEnemyAbilities(state, dt)
  stepEnemies(state, dt)
  // Brand und Frost altern, bevor jemand zuschlaegt - ein Gegner, den die Verbrennung in
  // diesem Takt toetet, soll die Station nicht mehr treffen.
  stepEnemyStates(state, dt)
  dockedDamage(state, dt)

  // Faellt die Stations-HP auf 0, beginnt dieselbe Welle erneut - ohne Verlust von
  // Tuermen oder Fortschritt (GDD 07 Abschnitt 13). Kein Game Over.
  if (combat.stationHp <= 0) {
    restartWave(state)
    return
  }

  stepTowers(state, dt)
  stepDrones(state, dt)
  stepProjectiles(state, dt)
  // Helfer nach dem Kampf: Sie heben auf, was in diesem Takt gefallen ist, statt einen
  // Takt daneben zu stehen (GDD 12 Abschnitt 11).
  stepHelpers(state, dt)
  stepEffects(state, dt)

  // Zum Schluss: Erst jetzt steht fest, was dieser Takt an Erfahrung gebracht hat.
  stepProgression(state)
}

