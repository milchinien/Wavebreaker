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
import { allModules, canPlace, place, previewPolygon } from './station'
import type { FreeEdge } from './station'
import { ERROR_TEXT } from './station'
import type { AppState } from './app'
import { notify, refresh } from './app'
import type { Camera } from './camera'
import { resetAuto, screenToWorld, zoomBy } from './camera'
  move,
/** Maximale Entfernung des Zeigers zu einer Kante, bis zu der noch angedockt wird. */
const SNAP_RADIUS = SIDE * 2.5
  remove,
function nearestFreeEdge(p: Vec2, edges: FreeEdge[]): FreeEdge | null {
import type { FreeEdge } from './station'
import type { AppState } from './app'
import { activeEdges, clearInteraction, notify, refresh } from './app'
    const d = pointSegmentDistance(p, fe.edge)
import { resetAuto, screenToWorld, zoomBy } from './camera'
      bestDist = d
/** Maximale Entfernung des Zeigers zu einer Kante, bis zu der noch angedockt wird. */
const SNAP_RADIUS = SIDE * 2.5
  }
function nearestFreeEdge(p: Vec2, edges: FreeEdge[]): FreeEdge | null {
  let best: FreeEdge | null = null
  let bestDist = SNAP_RADIUS
function updateGhost(app: AppState, world: Vec2): void {
    const d = pointSegmentDistance(p, fe.edge)
    app.hoverEdge = null
    app.ghost = null
      best = fe
    }
  const inst = app.station.inventory.find(t => t.uid === app.buildUid)
  if (!inst) {
    app.buildUid = null
    app.hoverEdge = null
/** Ghost fuer Bau- ODER Ziehvorgang. Der Unterschied liegt nur in Kantenmenge und Pruefung. */
function updateGhost(app: AppState, world: Vec2): void {
  const dragging = app.dragUid !== null
  const uid = app.dragUid ?? app.buildUid
  const edge = nearestFreeEdge(world, app.free)
    app.hoverEdge = null
    app.ghost = null
    app.ghost = null
    return
  }
  const inst = dragging
  const { poly } = previewPolygon(inst.defId, edge)
  app.ghost = { poly, error: canPlace(app.station, inst.defId, edge) }
  if (!inst) {
    clearInteraction(app)
export function attachInput(
  canvas: HTMLCanvasElement,
  app: AppState,
  const edge = nearestFreeEdge(world, activeEdges(app))
  view: () => { w: number; h: number },
  onChange: () => void,
    app.ghost = null
  const worldAt = (ev: MouseEvent): Vec2 => {
    const rect = canvas.getBoundingClientRect()
    const { w, h } = view()
    return screenToWorld(cam, { x: ev.clientX - rect.left, y: ev.clientY - rect.top }, w, h)
  app.ghost = {
    poly,
    error: dragging ? canMove(app.station, uid, edge) : canPlace(app.station, inst.defId, edge),
  }
  canvas.addEventListener('mouseleave', () => {
    app.hoverEdge = null
function removeModule(app: AppState, uid: string, onChange: () => void): void {
  const err = canRemove(app.station, uid, app.removalRule)
  if (err) {
  canvas.addEventListener('click', ev => {
    const world = worldAt(ev)
    return
    if (app.buildUid) {
      updateGhost(app, world)
  const moved = remove(app.station, uid, app.removalRule)
  const name = defOf(moved[0]!.defId).name
        return
    app,
      if (app.ghost.error) {
      ? `${name} entfernt — ${moved.length - 1} abgetrennte Module sind mitgewandert`
      : `${name} entfernt`,
      }
      const inst = app.station.inventory.find(t => t.uid === app.buildUid)!
      const err = place(app.station, app.buildUid, app.hoverEdge)
      if (err) {
        notify(app, ERROR_TEXT[err])
        return
      }
      notify(app, `${defOf(inst.defId).name} angedockt`)
  canvas: HTMLCanvasElement,
      app.ghost = null
      app.hoverEdge = null
  view: () => { w: number; h: number },
  onChange: () => void,
      onChange()
  /** Unterdrueckt die Auswahl durch den Klick, der einen Zug beendet hat. */
  let justDragged = false

  const worldAt = (ev: MouseEvent): Vec2 => {
    const hit = allModules(app.station).find(m => pointInPolygon(world, m.poly))
    app.selectedUid = hit ? hit.uid : null
    return screenToWorld(cam, { x: ev.clientX - rect.left, y: ev.clientY - rect.top }, w, h)
  })

  const moduleAt = (world: Vec2) => allModules(app.station).find(m => pointInPolygon(world, m.poly))
    ev.preventDefault()
  canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 || app.buildUid) return
    const hit = moduleAt(worldAt(ev))
    if (!hit || hit.uid === app.station.core.uid) return
      notify(app, 'Bau-Modus verlassen')
    app.dragUid = hit.uid
    app.dragFree = freeEdges(app.station, hit.uid)
    app.selectedUid = hit.uid
    updateGhost(app, worldAt(ev))
  canvas.addEventListener(
    'wheel',
    ev => {
  canvas.addEventListener('mousemove', ev => updateGhost(app, worldAt(ev)))
      zoomBy(cam, ev.deltaY < 0 ? 1.12 : 1 / 1.12)
  canvas.addEventListener('mouseup', ev => {
    if (!app.dragUid) return
    const uid = app.dragUid
    updateGhost(app, worldAt(ev))
  window.addEventListener('keydown', ev => {
    if (app.ghost && !app.ghost.error && app.hoverEdge) {
      move(app.station, uid, app.hoverEdge)
      notify(app, `${defOf(app.station.placed.find(t => t.uid === uid)!.defId).name} umgesetzt`)
          app.buildUid = null
          app.ghost = null
    } else if (app.ghost?.error) {
      notify(app, ERROR_TEXT[app.ghost.error])
      justDragged = true
        break
      case 'e':
    app.dragUid = null
        app.showEdgeDebug = !app.showEdgeDebug
    app.ghost = null
    app.hoverEdge = null
      case 'f':
      case 'F':
        resetAuto(cam)
  canvas.addEventListener('mouseleave', () => {
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
    if (hit) removeModule(app, hit.uid, onChange)
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
          removeModule(app, app.selectedUid, onChange)
        }
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

