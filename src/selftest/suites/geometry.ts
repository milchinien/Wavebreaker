/**
 * Vektoren und regelmaessige Vielecke. Die Grundlage, auf der ab E2 das gesamte
 * Ansteck-System steht - Fehler hier sind spaeter kaum zu finden.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import {
  add,
  approach,
  dist,
  len,
  normalize,
  perp,
  samePoint,
  scale,
  sub,
  type Vec2,
} from '../../core/vec.ts'
import {
  apothem,
  boundsOf,
  centroid,
  circumradius,
  edgesOf,
  EPS,
  inset,
  MODULE_SIDE,
  polygonAt,
  signedArea,
} from '../../core/geometry.ts'
import { FOOTPRINT_SIDES } from '../../data/types.ts'

const ORIGIN: Vec2 = { x: 0, y: 0 }

/**
 * Die zugelassenen Formen werden **erfragt**, nicht aufgezaehlt: Sonst prueft diese Datei
 * nach dem Freigeben einer Form weiter die alte Liste, und das faellt niemandem auf.
 */
const SIDES = FOOTPRINT_SIDES

export function geometrySuite(): void {
  suite('core/vec')

  check('Grundrechnung', () => {
    assertClose(add({ x: 1, y: 2 }, { x: 3, y: 4 }).x, 4)
    assertClose(sub({ x: 3, y: 4 }, { x: 1, y: 2 }).y, 2)
    assertClose(scale({ x: 2, y: 3 }, 2).y, 6)
    assertClose(len({ x: 3, y: 4 }), 5)
    assertClose(dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
  })

  check('normalize liefert Laenge 1', () => {
    assertClose(len(normalize({ x: 7, y: -3 })), 1, 1e-12)
  })

  check('normalize des Nullvektors bleibt der Nullvektor', () => {
    assertEqual(len(normalize({ x: 0, y: 0 })), 0)
  })

  check('perp steht senkrecht und behaelt die Laenge', () => {
    const v = { x: 3, y: 4 }
    const p = perp(v)
    assertClose(v.x * p.x + v.y * p.y, 0, 1e-12)
    assertClose(len(p), len(v), 1e-12)
  })

  check('samePoint arbeitet mit Toleranz', () => {
    assertEqual(samePoint({ x: 0, y: 0 }, { x: EPS / 2, y: 0 }, EPS), true)
    assertEqual(samePoint({ x: 0, y: 0 }, { x: EPS * 2, y: 0 }, EPS), false)
  })

  check('approach naehert sich an, ohne zu ueberschiessen', () => {
    let value = 0
    for (let i = 0; i < 200; i++) {
      const next = approach(value, 100, 8, 1 / 60)
      assert(next >= value, 'darf nicht zurueckspringen')
      assert(next <= 100, `darf nicht ueberschiessen: ${next}`)
      value = next
    }
    assertClose(value, 100, 0.01)
  })

  check('approach ist rahmenratenunabhaengig', () => {
    // Dieselbe verstrichene Zeit muss dasselbe Ergebnis liefern, egal in wie vielen
    // Schritten sie vergeht. Sonst laeuft die Kamera bei 144 Hz anders als bei 60 Hz.
    let slow = 0
    for (let i = 0; i < 60; i++) slow = approach(slow, 100, 8, 1 / 60)

    let fast = 0
    for (let i = 0; i < 144; i++) fast = approach(fast, 100, 8, 1 / 144)

    assertClose(slow, fast, 0.01)
  })

  suite('core/geometry')

  check('jedes Vieleck hat die richtige Eckenzahl', () => {
    for (const sides of SIDES) {
      assertEqual(polygonAt(sides, ORIGIN, 0).length, sides)
    }
  })

  check('alle Seiten sind gleich lang - und zwar MODULE_SIDE', () => {
    for (const sides of SIDES) {
      for (const edge of edgesOf(polygonAt(sides, ORIGIN, 0))) {
        assertClose(dist(edge.a, edge.b), MODULE_SIDE, 1e-9, `${sides}-Eck`)
      }
    }
  })

  check('Inkreis- und Umkreisradius passen zur Seitenlaenge', () => {
    for (const sides of SIDES) {
      const poly = polygonAt(sides, ORIGIN, 0)
      for (const point of poly) {
        assertClose(dist(ORIGIN, point), circumradius(sides), 1e-9, `Umkreis ${sides}-Eck`)
      }
      for (const edge of edgesOf(poly)) {
        const middle = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 }
        assertClose(dist(ORIGIN, middle), apothem(sides), 1e-9, `Inkreis ${sides}-Eck`)
      }
    }
  })

  check('der Umkreis ist immer groesser als der Inkreis', () => {
    for (const sides of SIDES) {
      assert(circumradius(sides) > apothem(sides), `${sides}-Eck`)
    }
  })

  check('mehr Kanten bedeutet groessere Flaeche bei gleicher Seitenlaenge', () => {
    let previous = 0
    for (const sides of SIDES) {
      const area = signedArea(polygonAt(sides, ORIGIN, 0))
      assert(area > previous, `${sides}-Eck muss groesser sein als das vorherige`)
      previous = area
    }
  })

  check('Vielecke sind positiv orientiert', () => {
    for (const sides of SIDES) {
      // Die Orientierung ist die Voraussetzung dafuer, dass die Aussennormale einer
      // Kante nach aussen zeigt - daran haengt in E2 das gesamte Andocken.
      assert(signedArea(polygonAt(sides, ORIGIN, 0)) > 0, `${sides}-Eck`)
    }
  })

  check('Drehung aendert weder Flaeche noch Seitenlaengen', () => {
    for (const sides of SIDES) {
      const plain = signedArea(polygonAt(sides, ORIGIN, 0))
      const turned = signedArea(polygonAt(sides, ORIGIN, 0.7))
      assertClose(turned, plain, 1e-9, `${sides}-Eck`)
    }
  })

  check('Verschiebung wirkt auf den Schwerpunkt', () => {
    const poly = polygonAt(5, { x: 120, y: -40 }, 0.3)
    const c = centroid(poly)
    assertClose(c.x, 120, 1e-9)
    assertClose(c.y, -40, 1e-9)
  })

  check('edgesOf schliesst den Ring', () => {
    const poly = polygonAt(4, ORIGIN, 0)
    const edges = edgesOf(poly)
    assertEqual(edges.length, 4)
    assertEqual(edges[3]?.b, poly[0], 'letzte Kante endet an der ersten Ecke')
  })

  check('boundsOf umschliesst alle Vielecke', () => {
    const bounds = boundsOf([
      polygonAt(6, ORIGIN, 0),
      polygonAt(4, { x: 500, y: 0 }, 0),
    ])
    assert(bounds !== null, 'Bounds muessen existieren')
    assert(bounds.minX < -circumradius(6) + 1e-6, 'linke Kante')
    assert(bounds.maxX > 500, 'rechte Kante')
  })

  check('boundsOf ohne Vielecke liefert null', () => {
    assertEqual(boundsOf([]), null)
  })

  check('inset schrumpft zum Mittelpunkt, ohne ihn zu verschieben', () => {
    const poly = polygonAt(6, { x: 10, y: 20 }, 0)
    const smaller = inset(poly, 0.5)
    const c = centroid(smaller)
    assertClose(c.x, 10, 1e-9)
    assertClose(c.y, 20, 1e-9)
    assertClose(signedArea(smaller), signedArea(poly) * 0.25, 1e-6, 'Flaeche skaliert quadratisch')
  })
}
