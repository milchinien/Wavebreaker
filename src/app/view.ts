/**
 * Abgeleitete Sicht auf die Station - Geometrie, freie Kanten, Nachbarschaft, Buffs.
 *
 * GDD 03 Abschnitt 10 verlangt zweierlei: **vollstaendig** neu rechnen statt fortschreiben,
 * aber **nur bei Aenderungen**, nicht pro Bild. Beides zusammen ergibt genau diese Datei:
 * eine Neuberechnung hinter einer Zaehlerpruefung. Am Prototyp gemessen kostet ein
 * Durchgang bei 21 Modulen 0,65 ms - inkrementelle Aktualisierung waere reiner Ballast
 * und eine bekannte Fehlerquelle.
 */

import { computeBuffs, type BuffResult } from '../sim/buffs.ts'
import { freeEdges, stationModules, type FreeEdge, type PlacedModule } from '../sim/station.ts'
import type { GameState } from './state.ts'

export type StationView = {
  modules: PlacedModule[]
  freeEdges: FreeEdge[]
  buffs: Map<string, BuffResult>
  /** Umriss aller Module - Grundlage des Auto-Zooms. */
  polys: (readonly { x: number; y: number }[])[]
}

let cachedRevision = -1
let cached: StationView | null = null

export function stationView(state: GameState): StationView {
  if (cached && cachedRevision === state.runtime.revision) return cached

  const modules = stationModules(state.run.station)
  cached = {
    modules,
    freeEdges: freeEdges(state.run.station),
    buffs: computeBuffs(state.run.station),
    polys: modules.map((module) => module.poly),
  }
  cachedRevision = state.runtime.revision
  return cached
}

/** Nach jeder Aenderung an der Station aufrufen. */
export function invalidateStationView(state: GameState): void {
  state.runtime.revision += 1
}

/** Fuer Selbsttests, damit ein frischer Zustand nicht auf einen alten Zaehler trifft. */
export function resetStationViewCache(): void {
  cachedRevision = -1
  cached = null
}
