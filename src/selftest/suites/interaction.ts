/**
 * Beweis aus E3: der Bedienungsablauf als Skript ueber **echte** Zeigerereignisse -
 * auswaehlen, platzieren, Platzlimit ablehnen, verschieben, entfernen, Inseln wandern
 * zurueck.
 *
 * Diese Suite braucht ein DOM und laeuft deshalb nur im Browser (`?selftest`), nicht im
 * headless-Lauf. Sie feuert dieselben Ereignisse ab, die auch eine echte Maus ausloest,
 * und prueft danach den Zustand - kein Aufruf einer Handlung von Hand.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { createCamera, snapToTarget } from '../../render/camera.ts'
import { fitTo, worldToScreen } from '../../render/camera.ts'
import { attachInput, type InputHandle } from '../../ui/input.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { startBuild } from '../../app/actions.ts'
import type { Camera } from '../../render/camera.ts'
import type { Vec2 } from '../../core/vec.ts'
import { CORE_UID, freeEdges, newModule, type FreeEdge } from '../../sim/station.ts'
import { dropGold } from '../../sim/economy.ts'

const WIDTH = 900
const HEIGHT = 600

type Rig = {
  state: GameState
  camera: Camera
  canvas: HTMLCanvasElement
  input: InputHandle
  /** Weltpunkt -> Zeigerereignis an dieser Stelle. */
  at(point: Vec2): { clientX: number; clientY: number }
  edgeMiddle(edge: FreeEdge): Vec2
  dispose(): void
}

function createRig(slots = 4): Rig {
  resetStationViewCache()

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  canvas.style.position = 'fixed'
  canvas.style.left = '0'
  canvas.style.top = '0'
  canvas.style.width = `${WIDTH}px`
  canvas.style.height = `${HEIGHT}px`
  // Muss im Dokument haengen, sonst liefert getBoundingClientRect nur Nullen.
  document.body.appendChild(canvas)

  const state = createInitialState(1234)
  state.run.station.slots = slots
  /*
   * Drei Module ins Lager - dieselben drei, die frueher das Startinventar mitbrachte.
   *
   * Geschenkt bekommt sie niemand mehr (`START_INVENTORY`), gekauft werden sie gewuerfelt.
   * Diese Suite prueft aber das **Setzen** mit dem Zeiger und nicht den Laden: Sie braucht
   * einen bekannten Lagerinhalt in bekannter Reihenfolge, und den legt sie sich deshalb
   * selbst hin, statt ihn zu ziehen.
   */
  for (const defId of ['autocannon', 'cannon', 'amplifier']) {
    state.run.station.inventory.push(newModule(state.run.station, defId, 'common'))
  }
  // Gebaut wird in der Basisansicht; in der Kampfansicht sammelt der Zeiger Gold ein
  // (GDD 13 Abschnitt 3 und 5).
  state.runtime.view = 'base'
  invalidateStationView(state)

  const camera = createCamera()
  fitTo(camera, stationView(state).polys, WIDTH, HEIGHT)
  snapToTarget(camera)

  const input = attachInput({
    canvas,
    state,
    camera,
    size: () => ({ width: WIDTH, height: HEIGHT }),
    onChange: () => {},
  })

  const rect = canvas.getBoundingClientRect()

  return {
    state,
    camera,
    canvas,
    input,
    at(point) {
      const screen = worldToScreen(camera, point, WIDTH, HEIGHT)
      return { clientX: rect.left + screen.x, clientY: rect.top + screen.y }
    },
    edgeMiddle(edge) {
      return { x: (edge.edge.a.x + edge.edge.b.x) / 2, y: (edge.edge.a.y + edge.edge.b.y) / 2 }
    },
    dispose() {
      input.detach()
      canvas.remove()
      resetStationViewCache()
    },
  }
}

function pointer(rig: Rig, type: string, world: Vec2, button = 0): void {
  const { clientX, clientY } = rig.at(world)
  rig.canvas.dispatchEvent(
    new PointerEvent(type, { clientX, clientY, button, bubbles: true, cancelable: true }),
  )
}

function rightClick(rig: Rig, world: Vec2): void {
  const { clientX, clientY } = rig.at(world)
  rig.canvas.dispatchEvent(
    new MouseEvent('contextmenu', { clientX, clientY, button: 2, bubbles: true, cancelable: true }),
  )
}

/** Freie Kante des Kerns mit dem angegebenen Index. */
function coreEdge(rig: Rig, index: number): FreeEdge {
  return freeEdges(rig.state.run.station).find(
    (edge) => edge.ownerUid === CORE_UID && edge.edgeIndex === index,
  ) as FreeEdge
}

/** Ein Modul aus dem Inventar an eine Kernkante setzen - ueber Zeigerereignisse. */
function placeViaPointer(rig: Rig, uid: string, edgeIndex: number): void {
  startBuild(rig.state, uid)
  const target = rig.edgeMiddle(coreEdge(rig, edgeIndex))
  pointer(rig, 'pointermove', target)
  pointer(rig, 'pointerdown', target)
  pointer(rig, 'pointerup', target)
}

export function interactionSuite(): void {
  if (typeof document === 'undefined') return

  suite('ui/input · Bedienung')

  check('Zeigen auf ein Modul hebt es hervor', () => {
    const rig = createRig()
    try {
      pointer(rig, 'pointermove', { x: 0, y: 0 })
      assertEqual(rig.state.runtime.hoverUid, CORE_UID)

      pointer(rig, 'pointermove', { x: 4000, y: 4000 })
      assertEqual(rig.state.runtime.hoverUid, null)
    } finally {
      rig.dispose()
    }
  })

  check('Klick auf den Hauptturm waehlt ihn aus', () => {
    const rig = createRig()
    try {
      pointer(rig, 'pointerdown', { x: 0, y: 0 })
      assertEqual(rig.state.runtime.selectedUid, CORE_UID)

      pointer(rig, 'pointerdown', { x: 4000, y: 4000 })
      assertEqual(rig.state.runtime.selectedUid, null, 'Klick ins Leere hebt die Auswahl auf')
    } finally {
      rig.dispose()
    }
  })

  check('im Bau-Modus rastet die Vorschau auf die naechste freie Kante ein', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      startBuild(rig.state, uid)

      const edge = coreEdge(rig, 0)
      pointer(rig, 'pointermove', rig.edgeMiddle(edge))
      assertEqual(rig.state.runtime.hoverEdge?.edgeIndex, edge.edgeIndex)
      assertEqual(rig.state.runtime.hoverEdge?.ownerUid, CORE_UID)
    } finally {
      rig.dispose()
    }
  })

  check('ein Klick setzt das Modul an die eingerastete Kante', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      const before = rig.state.run.station.inventory.length

      placeViaPointer(rig, uid, 0)

      assertEqual(rig.state.run.station.placed.length, 1)
      assertEqual(rig.state.run.station.inventory.length, before - 1)
      assertEqual(rig.state.runtime.buildUid, null, 'der Bau-Modus endet nach dem Setzen')
      assertEqual(rig.state.runtime.selectedUid, uid, 'das gesetzte Modul ist ausgewaehlt')
    } finally {
      rig.dispose()
    }
  })

  check('das gesetzte Modul ist Nachbar des Hauptturms', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      placeViaPointer(rig, uid, 0)

      const modules = stationView(rig.state).modules
      assertEqual(modules.length, 2)
      assert(
        (modules.find((m) => m.uid === uid)?.sharedEdges.length ?? 0) === 1,
        'es muss genau eine Fuge geben',
      )
    } finally {
      rig.dispose()
    }
  })

  check('das Platzlimit lehnt weitere Module ab', () => {
    const rig = createRig(1)
    try {
      const [first, second] = rig.state.run.station.inventory
      placeViaPointer(rig, first?.uid as string, 0)
      placeViaPointer(rig, second?.uid as string, 2)

      assertEqual(rig.state.run.station.placed.length, 1, 'der zweite Platz existiert nicht')
    } finally {
      rig.dispose()
    }
  })

  check('Ziehen setzt ein Modul um', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      placeViaPointer(rig, uid, 0)

      const from = rig.state.run.station.placed[0]?.placement?.center as Vec2
      const target = rig.edgeMiddle(coreEdge(rig, 3))

      pointer(rig, 'pointerdown', from)
      // Erst die Bewegung ueber die Schwelle macht aus dem Klick ein Umsetzen.
      pointer(rig, 'pointermove', target)
      assertEqual(rig.state.runtime.dragUid, uid, 'das Umsetzen muss begonnen haben')
      pointer(rig, 'pointerup', target)

      const to = rig.state.run.station.placed[0]?.placement?.center as Vec2
      assert(Math.hypot(to.x - from.x, to.y - from.y) > 1, 'das Modul hat sich nicht bewegt')
      assertEqual(rig.state.run.station.placed.length, 1, 'kein zusaetzliches Modul')
      assertEqual(rig.state.runtime.dragUid, null)
    } finally {
      rig.dispose()
    }
  })

  check('ein kurzer Klick ohne Bewegung setzt nichts um', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      placeViaPointer(rig, uid, 0)
      const before = rig.state.run.station.placed[0]?.placement?.center as Vec2

      pointer(rig, 'pointerdown', before)
      pointer(rig, 'pointerup', before)

      const after = rig.state.run.station.placed[0]?.placement?.center as Vec2
      assertEqual(after.x, before.x)
      assertEqual(after.y, before.y)
    } finally {
      rig.dispose()
    }
  })

  check('Rechtsklick entfernt ein Modul', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      placeViaPointer(rig, uid, 0)
      const centre = rig.state.run.station.placed[0]?.placement?.center as Vec2

      rightClick(rig, centre)

      assertEqual(rig.state.run.station.placed.length, 0)
      assert(
        rig.state.run.station.inventory.some((m) => m.uid === uid),
        'das Modul muss zurueck ins Inventar',
      )
    } finally {
      rig.dispose()
    }
  })

  check('der Hauptturm laesst sich weder ziehen noch entfernen', () => {
    const rig = createRig()
    try {
      pointer(rig, 'pointerdown', { x: 0, y: 0 })
      pointer(rig, 'pointermove', { x: 200, y: 200 })
      assertEqual(rig.state.runtime.dragUid, null, 'der Kern darf nicht gezogen werden')

      rightClick(rig, { x: 0, y: 0 })
      assertEqual(stationView(rig.state).modules[0]?.uid, CORE_UID, 'der Kern bleibt stehen')
    } finally {
      rig.dispose()
    }
  })

  check('Rechtsklick bricht den Bau-Modus ab, statt zu entfernen', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      startBuild(rig.state, uid)
      rightClick(rig, { x: 0, y: 0 })

      assertEqual(rig.state.runtime.buildUid, null)
      assertEqual(rig.state.run.station.placed.length, 0)
    } finally {
      rig.dispose()
    }
  })

  check('abgetrennte Module wandern beim Entfernen mit zurueck', () => {
    const rig = createRig(4)
    try {
      const [first, second] = rig.state.run.station.inventory
      const bridge = first?.uid as string
      placeViaPointer(rig, bridge, 0)

      // Das zweite Modul an die vom Kern am weitesten entfernte Kante des ersten.
      const own = freeEdges(rig.state.run.station).filter((edge) => edge.ownerUid === bridge)
      let far = own[0] as FreeEdge
      let farthest = -1
      for (const candidate of own) {
        const middle = rig.edgeMiddle(candidate)
        const distance = Math.hypot(middle.x, middle.y)
        if (distance > farthest) {
          farthest = distance
          far = candidate
        }
      }

      startBuild(rig.state, second?.uid as string)
      pointer(rig, 'pointermove', rig.edgeMiddle(far))
      pointer(rig, 'pointerdown', rig.edgeMiddle(far))
      assertEqual(rig.state.run.station.placed.length, 2, 'beide Module muessen stehen')

      const bridgeCentre = rig.state.run.station.placed.find((m) => m.uid === bridge)?.placement
        ?.center as Vec2
      rightClick(rig, bridgeCentre)

      assertEqual(rig.state.run.station.placed.length, 0, 'die Insel muss mitgewandert sein')
      assertEqual(rig.state.run.station.inventory.length, 3)
    } finally {
      rig.dispose()
    }
  })

  check('Esc bricht ab und hebt die Auswahl auf', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      startBuild(rig.state, uid)
      pointer(rig, 'pointerdown', { x: 0, y: 0 })

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

      assertEqual(rig.state.runtime.buildUid, null)
      assertEqual(rig.state.runtime.selectedUid, null)
    } finally {
      rig.dispose()
    }
  })

  check('in der Kampfansicht sammelt die Mausbewegung Gold ein', () => {
    // Beweis aus E7: Hover sammelt ein, die Zahl steigt sichtbar (GDD 08 Abschnitt 2).
    const rig = createRig()
    try {
      rig.state.runtime.view = 'combat'
      dropGold(rig.state, { x: 120, y: 40 }, 55)
      assertEqual(rig.state.run.gold, 0, 'Gold wird nicht automatisch gutgeschrieben')

      pointer(rig, 'pointermove', { x: 120, y: 40 })

      assertEqual(rig.state.run.gold, 55)
      assertEqual(rig.state.run.coins.length, 0)
    } finally {
      rig.dispose()
    }
  })

  check('weit entfernte Muenzen bleiben liegen', () => {
    const rig = createRig()
    try {
      rig.state.runtime.view = 'combat'
      dropGold(rig.state, { x: 3000, y: 0 }, 40)
      pointer(rig, 'pointermove', { x: 0, y: 0 })

      assertEqual(rig.state.run.gold, 0)
      assertEqual(rig.state.run.coins.length, 1, 'sie verfallen nicht')
    } finally {
      rig.dispose()
    }
  })

  check('in der Kampfansicht baut der Zeiger nichts', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      startBuild(rig.state, uid)
      rig.state.runtime.view = 'combat'

      const target = rig.edgeMiddle(coreEdge(rig, 0))
      pointer(rig, 'pointermove', target)
      assertEqual(rig.state.runtime.hoverEdge, null, 'keine Bauvorschau im Kampf')
    } finally {
      rig.dispose()
    }
  })

  check('Entf entfernt das ausgewaehlte Modul', () => {
    const rig = createRig()
    try {
      const uid = rig.state.run.station.inventory[0]?.uid as string
      placeViaPointer(rig, uid, 0)
      assertEqual(rig.state.runtime.selectedUid, uid)

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))

      assertEqual(rig.state.run.station.placed.length, 0)
      assertEqual(rig.state.runtime.selectedUid, null)
    } finally {
      rig.dispose()
    }
  })
}
