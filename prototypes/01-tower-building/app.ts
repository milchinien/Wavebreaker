/** Zustand des Prototyps. Bewusst flach und ohne Framework. */
import type { Vec2 } from './geometry'
import type { Station } from './model'
import type { ActionError, FreeEdge, RemovalRule } from './station'
import { canRemove, createStation, detached, ERROR_TEXT, freeEdges, remove } from './station'
import { defOf } from './catalog'
import { computeStation } from './buffs'
import type { StationSummary } from './buffs'

export type Ghost = { poly: Vec2[]; error: ActionError | null }

export type AppState = {
  station: Station
  /** Cache der freien Kanten; nach jeder Aenderung ueber refresh() erneuert */
  free: FreeEdge[]
  /** Effektivwerte, Stations-HP und DPS; ebenfalls ueber refresh() erneuert */
  summary: StationSummary
  /** gewaehlte Inventar-Instanz = Bau-Modus aktiv */
  buildUid: string | null
  /** platziertes Modul, das gerade gezogen wird */
  dragUid: string | null
  /** freie Kanten OHNE das gezogene Modul — sonst koennte es an sich selbst andocken */
  dragFree: FreeEdge[]
  hoverEdge: FreeEdge | null
  ghost: Ghost | null
  selectedUid: string | null
  /** Modul unter dem Mauszeiger — Grundlage der Abriss-Vorschau */
  hoverUid: string | null
  /** Module, die beim Entfernen von hoverUid den Anschluss verlieren wuerden */
  detachPreview: string[]
  /** Umgang mit dem Zerteilen der Station beim Entfernen (offene Frage F2) */
  removalRule: RemovalRule
  /** Buff-Linien dauerhaft anzeigen (offene Frage F6) */
  showBuffLines: boolean
  /** Reichweitenkreise aller Module; das ausgewaehlte zeigt seinen immer */
  showRanges: boolean
  /** Dunkle Grundplatte unter der Station — bindet die Keile optisch ein (offene Frage F9) */
  showPlate: boolean
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
    summary: computeStation(station),
    buildUid: null,
    dragUid: null,
    dragFree: [],
    hoverEdge: null,
    ghost: null,
    selectedUid: null,
    hoverUid: null,
    detachPreview: [],
    removalRule: 'block',
    showBuffLines: true,
    showRanges: false,
    showPlate: false,
    showEdgeDebug: false,
    message: null,
    messageUntil: 0,
    time: 0,
  }
}

/** Nach jeder Zustandsaenderung aufrufen: freie Kanten und Effektivwerte neu bestimmen. */
export function refresh(app: AppState): void {
  app.free = freeEdges(app.station)
  app.summary = computeStation(app.station)
  setHover(app, app.hoverUid)
}

/**
 * Abriss-Vorschau: Beim Zeigen auf ein Modul wird sichtbar, welche Module den Anschluss
 * verlieren wuerden — unter Variante A der Grund fuer die Sperre, unter Variante B das,
 * was mitwandert. Antwort auf die Ueberraschung, die Variante B sonst erzeugt (F2).
 */
export function setHover(app: AppState, uid: string | null): void {
  app.hoverUid = uid
  app.detachPreview =
    uid && uid !== app.station.core.uid && app.station.placed.some(m => m.uid === uid)
      ? detached(app.station, uid).map(m => m.uid)
      : []
}

/** Beendet Bau- und Ziehvorgang, ohne die Station anzufassen. */
export function clearInteraction(app: AppState): void {
  app.buildUid = null
  app.dragUid = null
  app.dragFree = []
  app.hoverEdge = null
  app.ghost = null
}

/** Kanten, die gerade als Andockziel in Frage kommen. */
export const activeEdges = (app: AppState): FreeEdge[] =>
  app.buildUid ? app.free : app.dragUid ? app.dragFree : []

/**
 * Entfernt ein Modul nach der eingestellten Regel und meldet das Ergebnis.
 * Gibt zurueck, ob tatsaechlich entfernt wurde. Der Aufrufer sorgt fuer die Neuzeichnung.
 */
export function removeModule(app: AppState, uid: string): boolean {
  const err = canRemove(app.station, uid, app.removalRule)
  if (err) {
    notify(app, ERROR_TEXT[err])
    return false
  }

  const moved = remove(app.station, uid, app.removalRule)
  const name = defOf(moved[0]!.defId).name
  const extra = moved.length - 1
  notify(
    app,
    extra === 0
      ? `${name} entfernt`
      : extra === 1
        ? `${name} entfernt — 1 abgetrenntes Modul ist mitgewandert`
        : `${name} entfernt — ${extra} abgetrennte Module sind mitgewandert`,
  )

  if (app.selectedUid === uid) app.selectedUid = null
  clearInteraction(app)
  refresh(app)
  return true
}

export function notify(app: AppState, text: string, seconds = 2.5): void {
  app.message = text
  app.messageUntil = app.time + seconds
}
