/**
 * Overdrive - der dynamische Zustand der Station (`docs/upgrade-umbau.md` Abschnitt 6).
 *
 * Ein Turret, das einen Gegner toetet, kann kurz in Overdrive gehen: Fuer einige Sekunden
 * feuert es sichtbar haerter. Vier Eigenschaften machen ihn zu dem, was das Upgrade-System
 * gebraucht hat:
 *
 *   **selbstausloesend** - man kauft keine Wirkung, sondern eine *Chance*.
 *   **kurz** - er laeuft ab, es gibt nichts zu verwalten.
 *   **sichtbar** - das Modul glueht; ohne das existiert er fuer den Spieler nicht.
 *   **verzweigt** - Ausloeser, Dauer, Staerke, Stapeln und Ausbreitung sind fuenf
 *   verschiedene Upgrades in drei verschiedenen Fenstern.
 *
 * Ein einziger Zustand traegt damit zwoelf Kacheln, und keine davon ist "+5 % Schaden".
 *
 * **Er existiert erst nach `First Spark`.** Vorher gibt es ihn im Spiel nicht - kein
 * Glimmen, keine Anzeige, kein grauer Balken. Das ist der Grund, warum `active()` ganz oben
 * in jeder Funktion dieser Datei steht.
 *
 * Der Zustand liegt in `runtime.combat` und **nicht** im Spielstand: Nach dem Laden beginnt
 * die Welle ohnehin neu, und eine Restzeit in Simulationssekunden ueber einen Programmstart
 * mitzufuehren hiesse, sie an die echte Uhr zu binden - dieselbe Ueberlegung wie bei den
 * Abklingzeiten der Faehigkeiten.
 */

import { ruleActive, specialSum } from '../data/upgrades.ts'
import type { GameState } from '../app/state.ts'
import { adjacency } from './station.ts'

/** Was ein Modul im Overdrive mitfuehrt. */
export type Overdrive = {
  /** Restzeit in Simulationssekunden. */
  left: number
  /** Wie oft der Zustand aufeinanderliegt - 1, mit `Second Wind` bis 2. */
  stacks: number
}

/** Grundwerte, bevor irgendein Upgrade darauf einzahlt. */
const BASE_DURATION = 4
const BASE_CHANCE = 0.05
const BASE_POWER = 0.5

/**
 * Deckel der Auslsoesechance.
 *
 * `Redline` ist endlos; ohne Deckel waere Overdrive ab Stufe 95 der Normalzustand - und ein
 * Zustand, der immer gilt, ist keiner, sondern ein Bonus mit Umweg.
 */
const MAX_CHANCE = 0.5

/**
 * Wie stark der Treffer-Ausloeser gegenueber dem Kill-Ausloeser gedaempft ist.
 *
 * Eine Autocannon feuert sechsmal je Sekunde. Ungedaempft waere `Perpetual` kein Upgrade,
 * sondern ein Schalter fuer "Overdrive immer an".
 */
const HIT_DAMPING = 3

/** Gibt es Overdrive in diesem Run ueberhaupt? */
export function overdriveActive(state: GameState): boolean {
  return ruleActive(state.run.upgrades, 'firstSpark')
}

export function overdriveChance(state: GameState): number {
  return Math.min(MAX_CHANCE, BASE_CHANCE + specialSum(state.run.upgrades, 'overdriveChance'))
}

export function overdriveDuration(state: GameState): number {
  return BASE_DURATION + specialSum(state.run.upgrades, 'overdriveDuration')
}

/** Zuschlag auf Schaden **und** Feuerrate, als Anteil. */
export function overdrivePower(state: GameState): number {
  return BASE_POWER + specialSum(state.run.upgrades, 'overdrivePower')
}

export function maxStacks(state: GameState): number {
  return ruleActive(state.run.upgrades, 'secondWind') ? 2 : 1
}

/**
 * Ab welchem Huellenanteil `Last Stand` anschlaegt.
 *
 * 30 % zu Beginn, mit `Brink` je Stufe zehn Punkte frueher. Ohne das Directive gibt es die
 * Schwelle nicht - dann steht hier 0 und nichts loest je aus.
 */
export function lastStandThreshold(state: GameState): number {
  if (!ruleActive(state.run.upgrades, 'lastStand')) return 0
  return 0.3 + specialSum(state.run.upgrades, 'lastStandThreshold')
}

/** Der Zuschlag, den dieses Modul gerade traegt. 0, wenn es nicht im Overdrive ist. */
export function overdriveBonus(state: GameState, uid: string): number {
  const entry = state.runtime.combat.overdrive.get(uid)
  if (!entry || entry.left <= 0) return 0
  return overdrivePower(state) * entry.stacks
}

/**
 * Ein Modul in den Overdrive setzen.
 *
 * Die Dauer wird **neu gesetzt** und nicht addiert: Zwei Ausloeser kurz hintereinander
 * sollen den Zustand frisch halten, nicht auf eine Minute aufsummieren. Was sich stapelt,
 * ist die Staerke - und nur, wenn `Second Wind` gekauft ist.
 */
export function triggerOverdrive(state: GameState, uid: string, spread = true): void {
  if (!overdriveActive(state)) return

  const combat = state.runtime.combat
  const entry = combat.overdrive.get(uid)
  const duration = overdriveDuration(state)

  if (entry && entry.left > 0) {
    entry.left = duration
    entry.stacks = Math.min(maxStacks(state), entry.stacks + 1)
  } else {
    combat.overdrive.set(uid, { left: duration, stacks: 1 })
  }

  /*
   * `Contagion`: Der Zustand springt auf **ein** Kantennachbarmodul ueber, mit halber
   * Restdauer - und von dort **nicht weiter** (`spread: false`). Eine Kettenreaktion ueber
   * eine dicht gebaute Station waere nicht mehr zu lesen und in einem Zug flaechendeckend.
   */
  if (spread && ruleActive(state.run.upgrades, 'contagion')) {
    const neighbour = (adjacency(state.run.station).get(uid) ?? [])[0]
    if (neighbour !== undefined) {
      const carried = combat.overdrive.get(neighbour)
      const half = duration / 2
      if (!carried || carried.left < half) combat.overdrive.set(neighbour, { left: half, stacks: 1 })
    }
  }
}

/** Ein Turret hat getoetet. */
export function overdriveOnKill(state: GameState, uid: string): void {
  if (!overdriveActive(state)) return
  if (!state.runtime.rng.chance(overdriveChance(state))) return
  triggerOverdrive(state, uid)
}

/** Ein Turret hat getroffen, ohne zu toeten - zaehlt nur mit `Perpetual`. */
export function overdriveOnHit(state: GameState, uid: string): void {
  if (!overdriveActive(state)) return
  if (!ruleActive(state.run.upgrades, 'perpetual')) return
  if (!state.runtime.rng.chance(overdriveChance(state) / HIT_DAMPING)) return
  triggerOverdrive(state, uid)
}

/**
 * `Last Stand`: Faellt die Huelle unter die Schwelle, geht die **ganze Station** in
 * Overdrive - einmal je Welle.
 *
 * Einmal je Welle, weil die Huelle um die Schwelle herum schwankt: Ohne die Sperre pulste
 * der Zustand an genau dieser Kante, statt der Wendepunkt zu sein, fuer den man das
 * Directive gekauft hat.
 */
export function checkLastStand(state: GameState): void {
  if (!overdriveActive(state)) return

  const combat = state.runtime.combat
  if (combat.lastStandDone) return

  const threshold = lastStandThreshold(state)
  if (threshold <= 0 || combat.maxStationHp <= 0) return
  if (combat.stationHp / combat.maxStationHp > threshold) return

  combat.lastStandDone = true
  // Ohne Ausbreitung: Es sind ohnehin schon alle dabei.
  for (const module of combat.modules) triggerOverdrive(state, module.uid, false)
}

/** Restzeiten altern lassen. */
export function stepOverdrive(state: GameState, dt: number): void {
  const combat = state.runtime.combat
  if (combat.overdrive.size === 0) return

  /*
   * `Endless Spring`: Solange ein Boss lebt, laeuft die Uhr nicht.
   *
   * Gefragt wird der Kampfzustand und nicht die Welle: Ein Boss, der auf einer Bosswelle
   * bereits tot ist, soll den Zustand nicht weiter offenhalten.
   */
  if (combat.bossId !== null && ruleActive(state.run.upgrades, 'endlessSpring')) return

  for (const [uid, entry] of combat.overdrive) {
    entry.left -= dt
    if (entry.left <= 0) combat.overdrive.delete(uid)
  }
}

/** Nach einem Umbau: Zustaende von Modulen vergessen, die es nicht mehr gibt. */
export function pruneOverdrive(state: GameState): void {
  const combat = state.runtime.combat
  const alive = new Set(combat.modules.map((module) => module.uid))
  for (const uid of [...combat.overdrive.keys()]) {
    if (!alive.has(uid)) combat.overdrive.delete(uid)
  }
}

/** Beim Start einer Welle: alles zurueck auf Anfang. */
export function resetOverdrive(state: GameState): void {
  const combat = state.runtime.combat
  combat.overdrive.clear()
  combat.lastStandDone = false
}
