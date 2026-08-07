/**
 * Beweis aus E1: `fitTo` mit vorgegebenen Vielecken liefert die erwarteten Zoomwerte,
 * und die Kamera naehert sich weich an, statt zu springen.
 *
 * Zusaetzlich haelt dieser Test die korrigierte Regel aus GDD 13 Abschnitt 4 fest:
 * Reichweiten gehen **nicht** in den Bildausschnitt ein. Der Test rechnet vor, warum -
 * mit den am Prototyp gemessenen Zahlen (F4).
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { circumradius, polygonAt } from '../../core/geometry.ts'
import { dist, type Vec2 } from '../../core/vec.ts'
import {
  createCamera,
  fitTo,
  FIT_MARGIN,
  MAX_ZOOM,
  MIN_ZOOM,
  resetAuto,
  screenToWorld,
  snapToTarget,
  step,
  worldToScreen,
  zoomBy,
} from '../../render/camera.ts'

const VIEW_W = 750
const VIEW_H = 680
const ORIGIN: Vec2 = { x: 0, y: 0 }

/** Zwei Hexagone nebeneinander - gross genug, dass der Zoom nicht an die Grenzen stoesst. */
function wideStation(): Vec2[][] {
  return [polygonAt(6, { x: -300, y: 0 }, 0), polygonAt(6, { x: 300, y: 0 }, 0)]
}

export function cameraSuite(): void {
  suite('render/camera')

  check('der Zoom fuellt die Ansicht in der engeren Richtung genau aus', () => {
    const camera = createCamera()
    fitTo(camera, wideStation(), VIEW_W, VIEW_H)

    // Breite: 2 x 300 Versatz + 2 x Umkreisradius + 2 x Rand
    const spanX = 600 + 2 * circumradius(6)
    const expected = VIEW_W / (spanX + 2 * FIT_MARGIN)
    assertClose(camera.targetZoom, expected, 1e-9)
  })

  check('der Ausschnitt wird auf die Station zentriert', () => {
    const camera = createCamera()
    fitTo(camera, [polygonAt(6, { x: 200, y: -80 }, 0)], VIEW_W, VIEW_H)
    assertClose(camera.targetCenter.x, 200, 1e-9)
    assertClose(camera.targetCenter.y, -80, 1e-9)
  })

  check('eine groessere Station bekommt einen kleineren Zoom', () => {
    const small = createCamera()
    const large = createCamera()
    fitTo(small, [polygonAt(6, ORIGIN, 0)], VIEW_W, VIEW_H)
    fitTo(large, wideStation(), VIEW_W, VIEW_H)
    assert(large.targetZoom < small.targetZoom, 'die groessere Station muss weiter herauszoomen')
  })

  check('der Zoom bleibt zwischen den Grenzen', () => {
    const near = createCamera()
    fitTo(near, [polygonAt(6, ORIGIN, 0)], VIEW_W, VIEW_H)
    assertEqual(near.targetZoom, MAX_ZOOM, 'eine winzige Station darf nicht beliebig gross werden')

    const far = createCamera()
    fitTo(far, [polygonAt(6, { x: -5000, y: 0 }, 0), polygonAt(6, { x: 5000, y: 0 }, 0)], VIEW_W, VIEW_H)
    assertEqual(far.targetZoom, MIN_ZOOM, 'eine riesige Station darf nicht beliebig klein werden')
  })

  check('ohne Angabe geht kein Reichweiten-Zuschlag ein (GDD 13 Abschnitt 4)', () => {
    const ohne = createCamera()
    const mitNull = createCamera()
    fitTo(ohne, wideStation(), VIEW_W, VIEW_H)
    fitTo(mitNull, wideStation(), VIEW_W, VIEW_H, 0)
    assertEqual(ohne.targetZoom, mitNull.targetZoom)
  })

  check('warum Reichweiten draussen bleiben: der Zoom wuerde sich halbieren', () => {
    // Ein Marksman erreicht bei Epic 432 Einheiten (gemessen in Prototyp 01, F4).
    const normal = createCamera()
    const mitReichweite = createCamera()
    fitTo(normal, wideStation(), VIEW_W, VIEW_H)
    fitTo(mitReichweite, wideStation(), VIEW_W, VIEW_H, 432)

    assert(
      mitReichweite.targetZoom < normal.targetZoom * 0.55,
      `die Station wuerde auf unter die Haelfte schrumpfen: ${mitReichweite.targetZoom} statt ${normal.targetZoom}`,
    )
  })

  check('die Kamera naehert sich an, statt zu springen', () => {
    const camera = createCamera()
    fitTo(camera, wideStation(), VIEW_W, VIEW_H)
    const distance = Math.abs(camera.targetZoom - camera.zoom)

    step(camera, 1 / 60)
    const remaining = Math.abs(camera.targetZoom - camera.zoom)

    assert(remaining < distance, 'sie muss sich bewegen')
    assert(remaining > distance * 0.5, 'ein einzelner Schritt darf kein Sprung sein')
  })

  check('die Kamera erreicht ihr Ziel und schiesst nicht darueber hinaus', () => {
    const camera = createCamera()
    camera.targetCenter = { x: 400, y: -250 }
    camera.targetZoom = 0.6

    let previous = Infinity
    for (let i = 0; i < 600; i++) {
      step(camera, 1 / 60)
      const remaining = dist(camera.center, camera.targetCenter)
      assert(remaining <= previous + 1e-9, 'darf sich nie wieder entfernen')
      previous = remaining
    }

    assertClose(camera.center.x, 400, 0.01)
    assertClose(camera.center.y, -250, 0.01)
    assertClose(camera.zoom, 0.6, 0.001)
  })

  check('die Fahrt haengt an der Zeit, nicht an der Bildrate', () => {
    const slow = createCamera()
    const fast = createCamera()
    slow.targetZoom = 0.5
    fast.targetZoom = 0.5

    for (let i = 0; i < 60; i++) step(slow, 1 / 60)
    for (let i = 0; i < 144; i++) step(fast, 1 / 144)

    assertClose(slow.zoom, fast.zoom, 0.001, '60 Hz und 144 Hz muessen gleich weit kommen')
  })

  check('snapToTarget setzt ohne Fahrt', () => {
    const camera = createCamera()
    fitTo(camera, wideStation(), VIEW_W, VIEW_H)
    snapToTarget(camera)
    assertEqual(camera.zoom, camera.targetZoom)
    assertEqual(camera.center.x, camera.targetCenter.x)
  })

  check('nach eigenem Zoom uebernimmt der Spieler, bis er zuruecksetzt', () => {
    const camera = createCamera()
    fitTo(camera, wideStation(), VIEW_W, VIEW_H)
    const automatisch = camera.targetZoom

    zoomBy(camera, 1.5)
    assert(camera.manual, 'eigener Zoom schaltet den Auto-Ausschnitt ab')
    fitTo(camera, [polygonAt(6, ORIGIN, 0)], VIEW_W, VIEW_H)
    assert(camera.targetZoom !== automatisch, 'fitTo darf jetzt nichts mehr aendern')

    resetAuto(camera)
    fitTo(camera, wideStation(), VIEW_W, VIEW_H)
    assertClose(camera.targetZoom, automatisch, 1e-9)
  })

  check('Welt und Bildschirm rechnen ineinander um', () => {
    const camera = createCamera()
    camera.center = { x: 120, y: -60 }
    camera.zoom = 0.75

    const world = { x: 333, y: 77 }
    const screen = worldToScreen(camera, world, VIEW_W, VIEW_H)
    const back = screenToWorld(camera, screen, VIEW_W, VIEW_H)

    assertClose(back.x, world.x, 1e-9)
    assertClose(back.y, world.y, 1e-9)
  })

  check('der Kameramittelpunkt liegt in der Bildmitte', () => {
    const camera = createCamera()
    camera.center = { x: 40, y: 90 }
    const screen = worldToScreen(camera, camera.center, VIEW_W, VIEW_H)
    assertClose(screen.x, VIEW_W / 2, 1e-9)
    assertClose(screen.y, VIEW_H / 2, 1e-9)
  })

  check('eine Aenderung der Fenstergroesse verzieht nichts', () => {
    // Ein Quadrat in der Welt muss auf dem Bildschirm ein Quadrat bleiben - bei jedem
    // Seitenverhaeltnis. Der Zoom wirkt auf x und y gleich.
    const camera = createCamera()
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]

    for (const [w, h] of [
      [400, 900],
      [1920, 400],
      [800, 800],
    ] as const) {
      fitTo(camera, [polygonAt(6, ORIGIN, 0)], w, h)
      const screen = square.map((point) => worldToScreen(camera, point, w, h))
      const top = dist(screen[0] as Vec2, screen[1] as Vec2)
      const right = dist(screen[1] as Vec2, screen[2] as Vec2)
      assertClose(top, right, 1e-9, `Seitenverhaeltnis ${w}x${h}`)
    }
  })

  check('eine leere Station laesst die Kamera in Ruhe', () => {
    const camera = createCamera()
    const before = camera.targetZoom
    fitTo(camera, [], VIEW_W, VIEW_H)
    assertEqual(camera.targetZoom, before)
  })

  check('eine Ansicht ohne Flaeche laesst die Kamera in Ruhe', () => {
    const camera = createCamera()
    const before = camera.targetZoom
    fitTo(camera, wideStation(), 0, 0)
    assertEqual(camera.targetZoom, before)
  })
}

