/** Zustand des Prototyps. Bewusst flach und ohne Framework. */
import type { Vec2 } from './geometry'
import type { Station } from './model'
import type { FreeEdge, PlacementError } from './station'
import { createStation, freeEdges } from './station'

export type Ghost = { poly: Vec2[]; error: PlacementError | null }

export type AppState = {
  station: Station
  /** Cache der freien Kanten; nach jeder Aenderung ueber refresh() erneuert */
  free: FreeEdge[]
  /** gewaehlte Inventar-Instanz = Bau-Modus aktiv */
  buildUid: string | null
  hoverEdge: FreeEdge | null
  ghost: Ghost | null
  selectedUid: string | null
  showEdgeDebug: boolean
  message: string | null
  messageUntil: number
  time: number
}

export function createApp(): AppState {
  const station = createStation(4)
  return {
    station,
    free: freeEdges(station),
    buildUid: null,
    hoverEdge: null,
    ghost: null,
    selectedUid: null,
    showEdgeDebug: false,
    message: null,
    messageUntil: 0,
    time: 0,
  }
}

/** Nach jeder Zustandsaenderung aufrufen: freie Kanten neu bestimmen. */
export function refresh(app: AppState): void {
  app.free = freeEdges(app.station)
}

export function notify(app: AppState, text: string, seconds = 2.5): void {
  app.message = text
  app.messageUntil = app.time + seconds
}

