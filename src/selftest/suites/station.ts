/**
 * Der Hauptturm steht fest: Hexagon, Zentrum, sechs Anschlusskanten (GDD 04 Abschnitt 1).
 * erneut - Andocken, Ueberlappung, Nachbarschaft, Zusammenhang, Entfernen, Verschieben.
 */
 * Sie sind bewusst gegen die **Regel** formuliert, nicht gegen die Umsetzung: Wer die
import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { edgesOf, MODULE_SIDE, signedArea } from '../../core/geometry.ts'
import { dist } from '../../core/vec.ts'
import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { START_CORE_ID } from '../../data/balance.ts'
import { coreModule, CORE_UID, stationModules } from '../../sim/station.ts'
  attachTo,
export function stationSuite(): void {
  suite('sim/station')
  EPS,
  check('der Startkern ist in den Daten hinterlegt', () => {
    const core = coreById(START_CORE_ID)
    assertEqual(core.name, 'Sentinel Core')
  polygonsOverlap,
  sameEdge,
  check('ein unbekannter Kern faellt sofort auf', () => {
    let threw = false
} from '../../core/geometry.ts'
import { dist, type Vec2 } from '../../core/vec.ts'
import { START_CORE_ID, START_TOWER_SLOTS } from '../../data/balance.ts'
import { CORES, coreById } from '../../data/cores.ts'
import { TOWERS, towerById } from '../../data/towers.ts'
    assert(threw, 'ein Tippfehler in einer Kern-Kennung darf nicht still durchgehen')
import {
  adjacency,
  check('jeder Kern ist ein Hexagon mit sechs Anschlusskanten', () => {
    for (const core of CORES) {
      assertEqual(core.sides, 6, core.name)
  coreModule,
  CORE_UID,
  createStation,
  check('der Hauptturm steht im Zentrum', () => {
    const core = coreModule(START_CORE_ID)
    assertEqual(core.center.x, 0)
    assertEqual(core.center.y, 0)
  move,
  nearestFreeEdge,
  check('sein Vieleck hat sechs gleich lange Kanten', () => {
    const core = coreModule(START_CORE_ID)
    assertEqual(core.poly.length, 6)
    for (const edge of edgesOf(core.poly)) {
      assertClose(dist(edge.a, edge.b), MODULE_SIDE, 1e-9)
  sanitizeStation,
  stationModules,
  usedSlots,
  check('sein Vieleck ist positiv orientiert', () => {
    assert(signedArea(coreModule(START_CORE_ID).poly) > 0)
} from '../../sim/station.ts'

  check('der Hauptturm hat keine Raritaet (GDD 04 Abschnitt 2)', () => {
    assertEqual(coreModule(START_CORE_ID).rarity, null)
  })
function station(slots = 9): Station {
  check('in E1 hat er noch keine Nachbarn, also keine Fugen', () => {
    assertEqual(coreModule(START_CORE_ID).sharedEdges.length, 0)
  })
/** Modul ins Inventar legen und die Kennung zurueckgeben. */
function give(st: Station, defId: string, rarity: Rarity = 'common'): string {
    const modules = stationModules(START_CORE_ID)
    assertEqual(modules.length, 1)
    assertEqual(modules[0]?.uid, CORE_UID)
    assertEqual(modules[0]?.kind, 'core')
  })
function corePoly(): Vec2[] {
  return coreModule(START_CORE_ID).poly
}

/** n-Eck an Kante `edgeIndex` eines Vielecks - reine Geometrie, ohne Station. */
function attachedTo(sides: number, poly: Vec2[], edgeIndex: number): Vec2[] {
  const edge = edgesOf(poly)[edgeIndex] as Edge
  const { center, rotation } = attachTo(sides, edge)
  return polygonAt(sides, center, rotation)
}

function coreEdge(st: Station, index: number): FreeEdge {
  const edge = freeEdges(st).find((e) => e.ownerUid === CORE_UID && e.edgeIndex === index)
  if (!edge) throw new Error(`Kernkante ${index} ist nicht frei`)
  return edge
}

/**
 * Kette Kern-B-A: A haengt an der vom Zentrum am weitesten entfernten Kante von B und
 * beruehrt den Kern daher nicht. B ist damit ein Brueckenmodul.
 */
function chainStation(): { st: Station; a: string; b: string } {
  const st = station()
  const b = give(st, 'autocannon')
  place(st, b, coreEdge(st, 0))

  const own = freeEdges(st).filter((e) => e.ownerUid === b)
  let far = own[0] as FreeEdge
  let farthest = -1
  for (const candidate of own) {
    const distance = Math.hypot(
      (candidate.edge.a.x + candidate.edge.b.x) / 2,
      (candidate.edge.a.y + candidate.edge.b.y) / 2,
    )
    if (distance > farthest) {
      farthest = distance
      far = candidate
    }
  }

  const a = give(st, 'autocannon')
  place(st, a, far)
  return { st, a, b }
}

export function stationSuite(): void {
  suite('sim/station · Daten')

  check('der Startkern ist hinterlegt und ein Hexagon', () => {
    assertEqual(coreById(START_CORE_ID).name, 'Sentinel Core')
    for (const core of CORES) assertEqual(core.sides, 6, core.name)
  })

  check('ein unbekannter Kern oder Turm faellt sofort auf', () => {
    let cores = false
    let towers = false
    try {
      coreById('gibt-es-nicht')
    } catch {
      cores = true
    }
    try {
      towerById('gibt-es-nicht')
    } catch {
      towers = true
    }
    assert(cores && towers, 'ein Tippfehler in einer Kennung darf nicht still durchgehen')
  })

  check('Buff-Tuerme haben mehr Kanten als Kampftuerme', () => {
    // GDD 03 Abschnitt 7: die Formzuordnung ist eine Balance-Entscheidung. Ein Buff-Turm
    // muss viele Module erreichen koennen, sonst reisst er die Schwelle b > 1/k nie.
    for (const tower of TOWERS) {
      if (tower.category !== 'buff') continue
      assert(tower.sides >= 5, `${tower.name} hat nur ${tower.sides} Kanten`)
    }
  })

  suite('core/geometry · Andocken')

  check('apothem(6) entspricht der Formel', () => {
    assertClose(apothem(6), (MODULE_SIDE * Math.sqrt(3)) / 2, 1e-9)
  })

  check('ein angedocktes Modul enthaelt die Andockkante (n = 3..6)', () => {
    const core = corePoly()
    const edge = edgesOf(core)[0] as Edge
    for (const sides of SIDES) {
      const poly = attachedTo(sides, core, 0)
      assert(
        edgesOf(poly).some((candidate) => sameEdge(candidate, edge)),
        `${sides}-Eck teilt die Andockkante nicht`,
      )
    }
  })

  check('ein angedocktes Modul ist positiv orientiert (n = 3..6)', () => {
    const core = corePoly()
    for (const sides of SIDES) {
      assert(signedArea(attachedTo(sides, core, 0)) > 0, `${sides}-Eck`)
    }
  })

  check('Beruehrung zaehlt nicht als Ueberlappung (n = 3..6)', () => {
    const core = corePoly()
    for (const sides of SIDES) {
      assert(!polygonsOverlap(attachedTo(sides, core, 0), core), `${sides}-Eck`)
    }
  })

  check('das angedockte Modul liegt aussen, nicht innen', () => {
    const core = corePoly()
    for (const sides of SIDES) {
      const poly = attachedTo(sides, core, 0)
      const centre = poly.reduce(
        (sum, p) => ({ x: sum.x + p.x / poly.length, y: sum.y + p.y / poly.length }),
        ORIGIN,
      )
      assert(!pointInPolygon(centre, core), `${sides}-Eck liegt im Kern`)
    }
  })

  check('zwei Hexagone an benachbarten Kernkanten teilen selbst eine Kante', () => {
    const core = corePoly()
    const a = attachedTo(6, core, 0)
    const b = attachedTo(6, core, 1)
    assert(!polygonsOverlap(a, b), 'sie duerfen sich nicht ueberlappen')
    assert(
      edgesOf(a).some((ea) => edgesOf(b).some((eb) => sameEdge(ea, eb))),
      'keine gemeinsame Kante gefunden',
    )
  })

  check('zwei Vierecke an benachbarten Kernkanten teilen nur eine Ecke', () => {
    // Das ist der Fall, der das Buff-System praegt: Eckberuehrung ist keine Nachbarschaft.
    const core = corePoly()
    const a = attachedTo(4, core, 0)
    const b = attachedTo(4, core, 1)
    assert(!polygonsOverlap(a, b), 'sie duerfen sich nicht ueberlappen')
    assert(
      !edgesOf(a).some((ea) => edgesOf(b).some((eb) => sameEdge(ea, eb))),
      'sie duerfen keine Kante teilen',
    )
    assert(
      a.some((pa) => b.some((pb) => dist(pa, pb) < EPS)),
      'sie muessen eine Ecke teilen',
    )
  })

  check('sechs Dreiecke an allen Kernkanten ueberlappen nicht', () => {
    const core = corePoly()
    const triangles = [0, 1, 2, 3, 4, 5].map((index) => attachedTo(3, core, index))
    for (let i = 0; i < triangles.length; i++) {
      for (let j = i + 1; j < triangles.length; j++) {
        assert(
          !polygonsOverlap(triangles[i] as Vec2[], triangles[j] as Vec2[]),
          `${i} und ${j} ueberlappen`,
        )
      }
    }
  })

  check('ein Modul ueberlappt sich mit sich selbst', () => {
    // Gegenprobe: der Trennachsentest darf nicht alles durchwinken.
    const core = corePoly()
    assert(polygonsOverlap(core, core), 'identische Vielecke muessen ueberlappen')
  })

  suite('sim/station · Bauen')

  check('der Hauptturm hat anfangs genau sechs freie Kanten', () => {
    assertEqual(freeEdges(station()).length, 6)
  })

  check('ein angedocktes n-Eck aendert die Zahl der freien Kanten um n-2', () => {
    for (const defId of ['autocannon', 'amplifier']) {
      const st = station(10)
      const before = freeEdges(st).length
      const error = place(st, give(st, defId), coreEdge(st, 0))
      assertEqual(error, null, defId)
      const sides = towerById(defId).sides
      assertEqual(freeEdges(st).length, before + sides - 2, defId)
    }
  })

  check('previewPolygon liefert dieselbe Geometrie wie die Platzierung', () => {
    const st = station()
    const uid = give(st, 'cannon')
    const edge = coreEdge(st, 2)
    const preview = previewPolygon('cannon', edge).poly
    place(st, uid, edge)

    const placed = stationModules(st).find((m) => m.uid === uid)
    assert(placed !== undefined, 'Modul muss platziert sein')
    for (let i = 0; i < preview.length; i++) {
      assert(dist(preview[i] as Vec2, placed.poly[i] as Vec2) < 1e-9, `Ecke ${i} weicht ab`)
    }
  })

  check('eine Platzierung in einen zu engen Keil wird abgelehnt', () => {
    const st = station(10)
    place(st, give(st, 'autocannon'), coreEdge(st, 0))
    place(st, give(st, 'autocannon'), coreEdge(st, 1))
    // In den entstandenen Keil passt kein Fuenfeck mehr.
    const blocked = freeEdges(st).filter((e) => canPlace(st, 'amplifier', e) === 'overlap')
    assert(blocked.length > 0, 'keine einzige Kante wurde als overlap erkannt')
  })

  check('das Platzlimit greift', () => {
    const st = station(1)
    assertEqual(place(st, give(st, 'autocannon'), coreEdge(st, 0)), null)
    assertEqual(canPlace(st, 'autocannon', coreEdge(st, 2)), 'no_slots')
    assertEqual(usedSlots(st), 1)
  })

  check('ein Modul, das nicht im Inventar liegt, kann nicht platziert werden', () => {
    const st = station()
    assertEqual(place(st, 'gibt-es-nicht', coreEdge(st, 0)), 'not_owned')
  })

  check('ein platziertes Modul verlaesst das Inventar genau einmal', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    const before = st.inventory.length
    place(st, uid, coreEdge(st, 0))

    assertEqual(st.inventory.length, before - 1)
    assert(!st.inventory.some((m) => m.uid === uid), 'liegt noch im Inventar')
    assertEqual(st.placed.filter((m) => m.uid === uid).length, 1)
  })

  check('eine abgelehnte Platzierung veraendert nichts', () => {
    const st = station(0)
    const uid = give(st, 'autocannon')
    const inventoryBefore = st.inventory.length
    assertEqual(place(st, uid, coreEdge(st, 0)), 'no_slots')
    assertEqual(st.placed.length, 0)
    assertEqual(st.inventory.length, inventoryBefore)
  })

  suite('sim/station · Nachbarschaft')

  check('ein platziertes Modul ist Kantennachbar des Hauptturms', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))
    const list = neighbors(st, uid)
    assertEqual(list.length, 1)
    assertEqual(list[0], CORE_UID)
  })

  check('Nachbarschaft ist gegenseitig', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))
    const map = adjacency(st)
    assert(map.get(CORE_UID)?.includes(uid) === true, 'Kern kennt das Modul nicht')
    assert(map.get(uid)?.includes(CORE_UID) === true, 'Modul kennt den Kern nicht')
  })

  check('geteilte Kanten werden als Fugen vermerkt', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))

    const modules = stationModules(st)
    const core = modules.find((m) => m.uid === CORE_UID)
    const tower = modules.find((m) => m.uid === uid)
    assertEqual(core?.sharedEdges.length, 1, 'der Kern hat genau eine Fuge')
    assertEqual(tower?.sharedEdges.length, 1, 'das Modul hat genau eine Fuge')
  })

  check('ohne Nachbarn gibt es keine Fugen', () => {
    assertEqual(stationModules(station())[0]?.sharedEdges.length, 0)
  })

  suite('sim/station · Entfernen und Verschieben')

  check('eine Kette erkennt das Brueckenmodul', () => {
    const { st, a, b } = chainStation()
    assert(isConnected(st), 'die vollstaendige Station muss zusammenhaengen')
    assert(!isConnected(st, b), 'ohne B muesste A abgetrennt sein')
    assert(isConnected(st, a), 'ohne A muss der Rest zusammenhaengen')

    const orphans = detached(st, b)
    assertEqual(orphans.length, 1)
    assertEqual(orphans[0]?.uid, a)
  })

  check('Entfernen ist immer erlaubt - auch beim Brueckenmodul', () => {
    // GDD 03 Abschnitt 4: blockieren wuerde bei 15 Modulen jedes zweite festnageln.
    const { st, b } = chainStation()
    assertEqual(canRemove(st, b), null)
  })

  check('abgetrennte Module wandern mit ins Inventar zurueck', () => {
    const { st, a, b } = chainStation()
    const moved = remove(st, b)

    assertEqual(moved.length, 2, 'B und das abgetrennte A')
    assertEqual(st.placed.length, 0)
    assert(st.inventory.some((m) => m.uid === a), 'A muss im Inventar liegen')
    assertEqual(st.inventory.filter((m) => m.uid === b).length, 1)
    assert(
      !st.inventory.some((m) => m.placement !== null),
      'zurueckgewanderte Module duerfen keine Platzierung behalten',
    )
  })

  check('der Hauptturm kann nicht entfernt werden', () => {
    assertEqual(canRemove(station(), CORE_UID), 'is_core')
  })

  check('ein nicht platziertes Modul kann nicht entfernt werden', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    assertEqual(canRemove(st, uid), 'not_placed')
  })

  check('Entfernen gibt den Turmplatz wieder frei', () => {
    const st = station(1)
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))
    assertEqual(canPlace(st, 'autocannon', coreEdge(st, 2)), 'no_slots')

    remove(st, uid)
    assertEqual(st.placed.length, 0)
    assertEqual(canPlace(st, 'autocannon', coreEdge(st, 2)), null)
  })

  check('Entfernen stellt die urspruengliche Kantenzahl wieder her', () => {
    const st = station()
    const before = freeEdges(st).length
    const uid = give(st, 'amplifier')
    place(st, uid, coreEdge(st, 0))
    remove(st, uid)
    assertEqual(freeEdges(st).length, before)
  })

  check('Zielkanten beim Verschieben enthalten nie die eigenen Kanten', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))
    const targets = freeEdges(st, uid)
    assert(!targets.some((e) => e.ownerUid === uid), 'das Modul koennte an sich selbst andocken')
  })

  check('Verschieben aendert die Platzzahl nicht und setzt die Geometrie um', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))

    const before = st.placed.length
    const from = st.placed.find((m) => m.uid === uid)?.placement?.center as Vec2
    const target = freeEdges(st, uid).find(
      (e) => e.ownerUid === CORE_UID && e.edgeIndex === 3,
    ) as FreeEdge

    assertEqual(canMove(st, uid, target), null)
    assertEqual(move(st, uid, target), null)

    const to = st.placed.find((m) => m.uid === uid)?.placement?.center as Vec2
    assertEqual(st.placed.length, before)
    assert(dist(from, to) > 1, 'das Modul hat sich nicht bewegt')
    assert(isConnected(st), 'die Station muss danach zusammenhaengen')
  })

  check('ein Brueckenmodul kann nicht verschoben werden', () => {
    // Ein Zug ist kein Abriss (GDD 03 Abschnitt 4).
    const { st, b } = chainStation()
    const target = freeEdges(st, b).find((e) => e.ownerUid === CORE_UID) as FreeEdge
    assertEqual(canMove(st, b, target), 'would_disconnect')
  })

  check('der Hauptturm kann nicht verschoben werden', () => {
    const st = station()
    assertEqual(canMove(st, CORE_UID, coreEdge(st, 0)), 'is_core')
  })

  check('Verschieben belegt keinen zusaetzlichen Turmplatz', () => {
    const st = station(1)
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))
    const target = freeEdges(st, uid).find(
      (e) => e.ownerUid === CORE_UID && e.edgeIndex === 3,
    ) as FreeEdge
    assertEqual(canMove(st, uid, target), null, 'ein voller Platz darf ein Umsetzen nicht sperren')
  })

  suite('sim/station · Treffer und Aufraeumen')

  check('moduleAt findet das Modul unter einem Punkt', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))
    const modules = stationModules(st)

    assertEqual(moduleAt(modules, ORIGIN)?.uid, CORE_UID)
    const tower = modules.find((m) => m.uid === uid)
    assertEqual(moduleAt(modules, tower?.center as Vec2)?.uid, uid)
    assertEqual(moduleAt(modules, { x: 5000, y: 5000 }), null)
  })

  check('nearestFreeEdge rastet nur innerhalb des Fangradius ein', () => {
    const st = station()
    const edges = freeEdges(st)
    const target = edges[0] as FreeEdge
    const middle = {
      x: (target.edge.a.x + target.edge.b.x) / 2,
      y: (target.edge.a.y + target.edge.b.y) / 2,
    }

    assertEqual(nearestFreeEdge(edges, middle, 10)?.edgeIndex, target.edgeIndex)
    assertEqual(nearestFreeEdge(edges, { x: 9000, y: 9000 }, 140), null)
  })

  check('sanitizeStation holt zu viele Module zurueck ins Inventar', () => {
    const st = station(4)
    for (let i = 0; i < 4; i++) place(st, give(st, 'autocannon'), coreEdge(st, i))
    assertEqual(st.placed.length, 4)

    st.slots = 2
    sanitizeStation(st)
    assertEqual(st.placed.length, 2)
    assertEqual(st.inventory.length, 2)
  })

  check('sanitizeStation holt abgetrennte Module zurueck', () => {
    const { st, a, b } = chainStation()
    // Das Brueckenmodul von Hand herausreissen, wie es ein kaputter Spielstand taete.
    st.placed = st.placed.filter((m) => m.uid !== b)

    sanitizeStation(st)
    assertEqual(st.placed.length, 0, 'A darf nicht in der Luft haengen')
    assert(st.inventory.some((m) => m.uid === a), 'A muss im Inventar liegen')
  })

  check('sanitizeStation haelt die Kennung ueber allem Bestehenden', () => {
    const st = station()
    give(st, 'autocannon')
    give(st, 'autocannon')
    st.nextUid = 1
    sanitizeStation(st)
    assert(st.nextUid > 2, `nextUid ${st.nextUid} wuerde eine Kennung doppelt vergeben`)
  })

  check('Standardwerte: vier Turmplaetze zusaetzlich zum Hauptturm', () => {
    // GDD 03 Abschnitt 6. Der Hauptturm zaehlt nicht mit.
    const st = createStation(START_CORE_ID, START_TOWER_SLOTS)
    assertEqual(st.slots, 4)
    assertEqual(usedSlots(st), 0)
  })

  check('der Umkreis waechst mit der Kantenzahl', () => {
    let previous = 0
    for (const sides of SIDES) {
      const radius = circumradius(sides)
      assert(radius > previous, `${sides}-Eck`)
      previous = radius
    }
  })
}

