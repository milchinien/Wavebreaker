/**
 * Maus und Tastatur -> Aktionen.
 *
 * Kernentscheidung: Der Spieler zielt nicht auf eine Zelle, sondern auf eine KANTE.
 * Das Ghost-Modul springt von Kante zu Kante — dieses Springen ist das "Einrasten"
 * aus GDD 03 §4 und der wichtigste Punkt am Baugefuehl (offene Frage F1).
 */
import { pointInPolygon, pointSegmentDistance, SIDE } from './geometry'
import type { Vec2 } from './geometry'
import { defOf } from './catalog'
import { allModules, canMove, canPlace, ERROR_TEXT, freeEdges, move, place, previewPolygon } from './station'
import type { FreeEdge } from './station'
import type { AppState } from './app'
import { activeEdges, clearInteraction, notify, refresh, removeModule, setHover } from './app'
import type { Camera } from './camera'
import { resetAuto, screenToWorld, zoomBy } from './camera'

/** Maximale Entfernung des Zeigers zu einer Kante, bis zu der noch angedockt wird. */
const SNAP_RADIUS = SIDE * 2.5

function nearestFreeEdge(p: Vec2, edges: FreeEdge[]): FreeEdge | null {
  let best: FreeEdge | null = null
  let bestDist = SNAP_RADIUS
  for (const fe of edges) {
    const d = pointSegmentDistance(p, fe.edge)
    if (d < bestDist) {
      bestDist = d
      best = fe
    }
  }
  return best
}

/** Ghost fuer Bau- ODER Ziehvorgang. Der Unterschied liegt nur in Kantenmenge und Pruefung. */
function updateGhost(app: AppState, world: Vec2): void {
  const dragging = app.dragUid !== null
  const uid = app.dragUid ?? app.buildUid
  if (!uid) {
    app.hoverEdge = null
    app.ghost = null
    return
  }

  const inst = dragging
    ? app.station.placed.find(t => t.uid === uid)
    : app.station.inventory.find(t => t.uid === uid)
  if (!inst) {
    clearInteraction(app)
    return
  }

  const edge = nearestFreeEdge(world, activeEdges(app))
  app.hoverEdge = edge
  if (!edge) {
    app.ghost = null
    return
  }

  const { poly } = previewPolygon(inst.defId, edge)
  app.ghost = {
    poly,
    error: dragging ? canMove(app.station, uid, edge) : canPlace(app.station, inst.defId, edge),
  }
}

export function attachInput(
  canvas: HTMLCanvasElement,
  app: AppState,
  cam: Camera,
  view: () => { w: number; h: number },
  onChange: () => void,
): void {
  /** Unterdrueckt die Auswahl durch den Klick, der einen Zug beendet hat. */
  let justDragged = false

  const worldAt = (ev: MouseEvent): Vec2 => {
    const rect = canvas.getBoundingClientRect()
    const { w, h } = view()
    return screenToWorld(cam, { x: ev.clientX - rect.left, y: ev.clientY - rect.top }, w, h)
  }

  const moduleAt = (world: Vec2) => allModules(app.station).find(m => pointInPolygon(world, m.poly))

  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || app.buildUid) return
    const hit = moduleAt(worldAt(ev))
    if (!hit || hit.uid === app.station.core.uid) return

    app.dragUid = hit.uid
    app.dragFree = freeEdges(app.station, hit.uid)
    app.selectedUid = hit.uid
    updateGhost(app, worldAt(ev))
    onChange()
  })

  canvas.addEventListener('mousemove', ev => {
    const world = worldAt(ev)
    updateGhost(app, world)

    // Abriss-Vorschau nur im Auswahl-Modus; sie wird auf dem Canvas gezeichnet,
    // loest also bewusst kein Neuaufbauen der HTML-Oberflaeche aus.
    if (app.buildUid || app.dragUid) {
      if (app.hoverUid) setHover(app, null)
      return
    }
    const hit = moduleAt(world)
    const uid = hit ? hit.uid : null
    if (uid !== app.hoverUid) setHover(app, uid)
  })

  canvas.addEventListener('mouseup', ev => {
    if (!app.dragUid) return
    const uid = app.dragUid
    updateGhost(app, worldAt(ev))

    if (app.ghost && !app.ghost.error && app.hoverEdge) {
      move(app.station, uid, app.hoverEdge)
      notify(app, `${defOf(app.station.placed.find(t => t.uid === uid)!.defId).name} umgesetzt`)
      justDragged = true
      refresh(app)
    } else if (app.ghost?.error) {
      notify(app, ERROR_TEXT[app.ghost.error])
      justDragged = true
    }

    app.dragUid = null
    app.dragFree = []
    app.ghost = null
    app.hoverEdge = null
    onChange()
  })

  canvas.addEventListener('mouseleave', () => {
    setHover(app, null)
    if (app.dragUid) {
      app.dragUid = null
      app.dragFree = []
      onChange()
    }
    app.hoverEdge = null
    app.ghost = null
  })

  canvas.addEventListener('click', ev => {
    if (justDragged) {
      justDragged = false
      return
    }
    const world = worldAt(ev)

    if (app.buildUid) {
      updateGhost(app, world)
      if (!app.hoverEdge || !app.ghost) {
        notify(app, ERROR_TEXT.no_edge)
        onChange()
        return
      }
      if (app.ghost.error) {
        notify(app, ERROR_TEXT[app.ghost.error])
        onChange()
        return
      }
      const inst = app.station.inventory.find(t => t.uid === app.buildUid)!
      const err = place(app.station, app.buildUid, app.hoverEdge)
      if (err) {
        notify(app, ERROR_TEXT[err])
        onChange()
        return
      }
      notify(app, `${defOf(inst.defId).name} angedockt`)
      clearInteraction(app)
      app.selectedUid = inst.uid
      refresh(app)
      onChange()
      return
    }

    const hit = moduleAt(world)
    app.selectedUid = hit ? hit.uid : null
    onChange()
  })

  canvas.addEventListener('contextmenu', ev => {
    ev.preventDefault()
    if (app.buildUid || app.dragUid) {
      clearInteraction(app)
      notify(app, 'Abgebrochen')
      onChange()
      return
    }
    const hit = moduleAt(worldAt(ev))
    if (hit) {
      removeModule(app, hit.uid)
      onChange()
    }
  })

  canvas.addEventListener(
    'wheel',
    ev => {
      ev.preventDefault()
      zoomBy(cam, ev.deltaY < 0 ? 1.12 : 1 / 1.12)
    },
    { passive: false },
  )

  window.addEventListener('keydown', ev => {
    switch (ev.key) {
      case 'Escape':
        if (app.buildUid || app.dragUid) {
          clearInteraction(app)
          onChange()
        }
        break
      case 'Delete':
      case 'Backspace':
        if (app.selectedUid) {
          ev.preventDefault()
          removeModule(app, app.selectedUid)
          onChange()
        }
        break
      case 'b':
      case 'B':
        app.showBuffLines = !app.showBuffLines
        notify(app, app.showBuffLines ? 'Buff-Linien dauerhaft' : 'Buff-Linien nur bei Auswahl')
        onChange()
        break
      case 'r':
      case 'R':
        app.showRanges = !app.showRanges
        notify(app, app.showRanges ? 'Reichweiten sichtbar — Zoom passt sich an' : 'Reichweiten aus')
        onChange()
        break
      case 'p':
      case 'P':
        app.showPlate = !app.showPlate
        notify(app, app.showPlate ? 'Grundplatte an' : 'Grundplatte aus — Keile offen')
        onChange()
        break
      case 'e':
      case 'E':
        app.showEdgeDebug = !app.showEdgeDebug
        onChange()
        break
      case 'f':
      case 'F':
        resetAuto(cam)
        notify(app, 'Auto-Zoom aktiv')
        break
    }
  })
}
