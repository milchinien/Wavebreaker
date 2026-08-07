/**
 * Maus- und Tastaturbedienung der Baufläche.
 *
 * Der Plan nennt fuer E3 keine eigene Eingabedatei; sie steht hier trotzdem, weil sonst
 * `ui/shell.ts` zugleich Bereichswechsel und Zeigerlogik traegt - und weil die Etappe eine
 * pruefbare Bedienung verlangt: Diese Datei ist der Angriffspunkt, an dem der Selbsttest
 * echte Zeigerereignisse abfeuert.
 *
 * Sie enthaelt **keine Regeln**. Jede Entscheidung faellt in `app/actions.ts` und `sim/`.
 */

import type { Vec2 } from '../core/vec.ts'
import { screenToWorld, type Camera } from '../render/camera.ts'
import { SNAP_RADIUS } from '../render/scene.ts'
import {
  cancelBuild,
  collectGoldAt,
  hoverEdge,
  hoverModule,
  moveModule,
  placeModule,
  removeModule,
  selectModule,
  startDrag,
} from '../app/actions.ts'
import { stationView } from '../app/view.ts'
import type { GameState } from '../app/state.ts'
import { moduleAt, nearestFreeEdge, type FreeEdge } from '../sim/station.ts'

/** Ab dieser Zeigerbewegung wird aus einem Klick ein Umsetzen. */
const DRAG_THRESHOLD = 6

export type InputOptions = {
  canvas: HTMLCanvasElement
  state: GameState
  camera: Camera
  size(): { width: number; height: number }
  /** Wird nach jeder Aenderung gerufen, damit die Panels neu zeichnen. */
  onChange(): void
}

export type InputHandle = {
  /** Zeigerposition in Bildschirmkoordinaten, oder null ausserhalb der Flaeche. */
  pointer(): Vec2 | null
  detach(): void
}

export function attachInput(options: InputOptions): InputHandle {
  const { canvas, state, camera } = options

  let pointer: Vec2 | null = null
  let pressedAt: Vec2 | null = null
  let pressedUid: string | null = null

  const toLocal = (event: PointerEvent | MouseEvent): Vec2 => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const toWorld = (point: Vec2): Vec2 => {
    const { width, height } = options.size()
    return screenToWorld(camera, point, width, height)
  }

  /** Kante, auf die die Vorschau gerade einrastet - beim Umsetzen ohne die eigenen Kanten. */
  const snapEdge = (point: Vec2): FreeEdge | null => {
    const view = stationView(state)
    const dragUid = state.runtime.dragUid
    const edges = dragUid
      ? view.freeEdges.filter((edge) => edge.ownerUid !== dragUid)
      : view.freeEdges
    return nearestFreeEdge(edges, toWorld(point), SNAP_RADIUS)
  }

  const onPointerMove = (event: PointerEvent): void => {
    pointer = toLocal(event)
    const world = toWorld(pointer)

    // Aus einem gehaltenen Klick wird ein Umsetzen, sobald der Zeiger weit genug wandert.
    if (
      pressedAt &&
      pressedUid &&
      !state.runtime.dragUid &&
      Math.hypot(pointer.x - pressedAt.x, pointer.y - pressedAt.y) > DRAG_THRESHOLD
    ) {
      startDrag(state, pressedUid)
      options.onChange()
    }

    // In der Kampfansicht sammelt die Mausbewegung Gold ein (GDD 08 Abschnitt 2).
    if (state.runtime.view === 'combat') {
      collectGoldAt(state, world)
      hoverModule(state, null)
      return
    }

    if (state.runtime.buildUid || state.runtime.dragUid) {
      hoverEdge(state, snapEdge(pointer))
      hoverModule(state, null)
      return
    }

    hoverModule(state, moduleAt(stationView(state).modules, world)?.uid ?? null)
  }

  const onPointerLeave = (): void => {
    pointer = null
    pressedAt = null
    pressedUid = null
    hoverModule(state, null)
    hoverEdge(state, null)
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    pointer = toLocal(event)

    // Im Bau-Modus setzt der Klick das Modul an die eingerastete Kante.
    if (state.runtime.buildUid) {
      const edge = snapEdge(pointer)
      if (edge) placeModule(state, state.runtime.buildUid, edge)
      options.onChange()
      return
    }

    const module = moduleAt(stationView(state).modules, toWorld(pointer))
    selectModule(state, module?.uid ?? null)

    // Der Hauptturm kann nicht bewegt werden (GDD 03 Abschnitt 2).
    if (module && module.kind === 'tower') {
      pressedAt = pointer
      pressedUid = module.uid
    }
    options.onChange()
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 0) return
    pointer = toLocal(event)

    if (state.runtime.dragUid) {
      const edge = snapEdge(pointer)
      // Ohne gueltiges Ziel bleibt das Modul, wo es war - ein Zug ist kein Abriss.
      if (edge) moveModule(state, state.runtime.dragUid, edge)
      cancelBuild(state)
      options.onChange()
    }

    pressedAt = null
    pressedUid = null
  }

  /** Rechtsklick entfernt ein Modul oder bricht den Bau ab. */
  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
    const point = toLocal(event)

    if (state.runtime.buildUid || state.runtime.dragUid) {
      cancelBuild(state)
      options.onChange()
      return
    }

    const module = moduleAt(stationView(state).modules, toWorld(point))
    if (module && module.kind === 'tower') {
      removeModule(state, module.uid)
      options.onChange()
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      cancelBuild(state)
      selectModule(state, null)
      options.onChange()
      return
    }
    if (event.key === 'Delete' && state.runtime.selectedUid) {
      removeModule(state, state.runtime.selectedUid)
      options.onChange()
    }
  }

  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)

  return {
    pointer: () => pointer,
    detach() {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
