/**
 * Bauregeln aus GDD 03. Der Beweis fuer E2: die Zusicherungen aus Prototyp 01 laufen hier
 * erneut - Andocken, Ueberlappung, Nachbarschaft, Zusammenhang, Entfernen, Verschieben.
 *
 * Sie sind bewusst gegen die **Regel** formuliert, nicht gegen die Umsetzung: Wer die
 * Datenstruktur austauscht, muss diese Datei nicht anfassen.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import {
  apothem,
  attachTo,
  circumradius,
  edgesOf,
  EPS,
  interiorAngle,
  MAX_MODULE_SIDES,
  MODULE_SIDE,
  pointInPolygon,
  polygonAt,
  polygonsOverlap,
  sameEdge,
  signedArea,
  type Edge,
} from '../../core/geometry.ts'
import { dist, type Vec2 } from '../../core/vec.ts'
import { START_CORE_ID, START_TOWER_SLOTS } from '../../data/balance.ts'
import { CORES, coreById } from '../../data/cores.ts'
import { RARITY_RANGE, rarityRank } from '../../data/rarities.ts'
import { TOWERS, towerById } from '../../data/towers.ts'
import { FOOTPRINT_SIDES, type Rarity } from '../../data/types.ts'
import {
  adjacency,
  canMove,
  canPlace,
  canRemove,
  coreModule,
  CORE_UID,
  createStation,
  detached,
  fittingShapes,
  freeEdges,
  isConnected,
  moduleAt,
  move,
  nearestFreeEdge,
  neighbors,
  newModule,
  notchShapes,
  place,
  previewPolygon,
  remove,
  sanitizeStation,
  stationModules,
  usedSlots,
  type FreeEdge,
  type Station,
} from '../../sim/station.ts'

const ORIGIN: Vec2 = { x: 0, y: 0 }

/** Erfragt statt aufgezaehlt - siehe die gleichlautende Stelle in `suites/geometry.ts`. */
const SIDES = FOOTPRINT_SIDES

function station(slots = 9): Station {
  return createStation(START_CORE_ID, slots)
}

/** Modul ins Inventar legen und die Kennung zurueckgeben. */
function give(st: Station, defId: string, rarity: Rarity = 'common'): string {
  const module = newModule(st, defId, rarity)
  st.inventory.push(module)
  return module.uid
}

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

  /*
   * Die Formleiter: mehr Kanten heisst staerkerer Turm (`data/towers.ts`).
   *
   * Geprueft wird sie gegen die Raritaetsuntergrenze, weil das die einzige Zahl im Spiel
   * ist, die "wie stark ist diese Turmart" schon beantwortet - und die, die der Spieler als
   * Rahmenfarbe vor sich hat. Buff-Tuerme sind ausgenommen: bei ihnen sind Kanten keine
   * Staerke, sondern Funktion, und der Verstaerker faellt ab Common.
   */
  check('eine seltenere Turmart hat nie weniger Kanten als eine haeufigere', () => {
    const ladder = TOWERS.filter((tower) => tower.category !== 'buff')
    for (const rarer of ladder) {
      for (const common of ladder) {
        const floorRare = RARITY_RANGE[rarer.id]?.min
        const floorCommon = RARITY_RANGE[common.id]?.min
        if (!floorRare || !floorCommon) continue
        if (rarityRank(floorRare) <= rarityRank(floorCommon)) continue
        assert(
          rarer.sides >= common.sides,
          `${rarer.name} (${floorRare}+, ${rarer.sides} Kanten) hat weniger Kanten als ` +
            `${common.name} (${floorCommon}+, ${common.sides} Kanten)`,
        )
      }
    }
  })

  check('jede zugelassene Form liegt im 30-Grad-Raster', () => {
    for (const sides of FOOTPRINT_SIDES) {
      const angle = interiorAngle(sides)
      assertClose(angle % 30, 0, 1e-9, `${sides}-Eck hat ${angle} Grad Innenwinkel`)
    }
  })

  check('keine Form ist groesser als MAX_MODULE_SIDES', () => {
    // Sonst nimmt die Grobpruefung in `polygonsOverlap` einen zu kleinen Umkreis an und
    // laesst Module ineinander bauen, ohne dass irgendwo ein Fehler auftritt.
    for (const sides of FOOTPRINT_SIDES) {
      assert(sides <= MAX_MODULE_SIDES, `${sides}-Eck ist groesser als ${MAX_MODULE_SIDES}`)
    }
  })

  /*
   * Der eigentliche Beweis hinter der Formauswahl (Herleitung bei `FootprintSides`).
   *
   * Eine Ecke der Station schliesst sich, wenn die Innenwinkel der anliegenden Module 360
   * Grad ergeben. Der Test baut alle Winkelsummen auf, die um einen Punkt herum ueberhaupt
   * entstehen koennen, und fragt fuer jede: Laesst sich der Rest bis 360 aus denselben
   * Formen wieder zusammensetzen?
   *
   * Bei 3, 4 und 6 lautet die Antwort ueberall ja - mit **einer** Ausnahme, den 30 Grad aus
   * Quadrat neben Sechseck neben Sechseck (90 + 120 + 120 = 330). Diesem Rest kann der
   * Spieler ausweichen. Kommt hier eine Form dazu, die das Raster verlaesst - ein Fuenfeck
   * mit 108 Grad etwa -, wird aus der einen Ausnahme eine lange Liste, und der Test nennt
   * sie. Genau das war der Zustand, in dem eine Station Restluecken hatte, an denen jede
   * Karte die Sperrfarbe bekam.
   */
  check('nur eine einzige Restluecke bleibt unfuellbar - die 30 Grad', () => {
    const angles = FOOTPRINT_SIDES.map(interiorAngle)

    const reachable = new Set<number>([0])
    let frontier = [0]
    while (frontier.length > 0) {
      const next: number[] = []
      for (const sum of frontier) {
        for (const angle of angles) {
          const total = sum + angle
          if (total > 360 || reachable.has(total)) continue
          reachable.add(total)
          next.push(total)
        }
      }
      frontier = next
    }

    const unfillable = new Set<number>()
    for (const sum of reachable) {
      if (sum >= 360) continue
      if (!reachable.has(360 - sum)) unfillable.add(360 - sum)
    }

    const listed = [...unfillable].sort((a, b) => a - b).join(', ')
    assertEqual(
      listed,
      '30',
      'unfuellbare Restluecken (Grad) - jede davon ist eine Ecke, in die der Spieler ' +
        'nichts mehr setzen kann',
    )
  })

  check('an einer frischen Station passt jede Form und es gibt keine Luecke', () => {
    const st = station()
    const shapes = fittingShapes(st)
    for (const sides of FOOTPRINT_SIDES) {
      assert(shapes.has(sides), `${sides}-Eck passt nicht einmal an den nackten Kern`)
    }
    assertEqual(notchShapes(st).size, 0, 'am nackten Kern nimmt jede Kante alles')
  })

  /*
   * Die Luecke, um die es beim Bauen geht - und der Beweis, dass es sie wirklich gibt.
   *
   * Zwei Quadrate an benachbarte Kernkanten: An der geteilten Ecke stehen 120 + 90 + 90 =
   * 300 Grad, es bleiben genau 60. Das ist der Innenwinkel des Dreiecks, also passt dort ein
   * Dreieck **exakt** - und sonst nichts. Genau diese Lage soll sich gut anfuehlen, und
   * genau sie beantwortet `notchShapes`.
   */
  check('zwischen zwei Quadraten bleibt ein Keil, in den nur ein Dreieck geht', () => {
    const st = station()
    place(st, give(st, 'cryo'), coreEdge(st, 0))
    place(st, give(st, 'cryo'), coreEdge(st, 1))

    assertEqual(towerById('cryo').sides, 4, 'der Test braucht ein Quadrat')
    assertEqual([...notchShapes(st)].join(', '), '3', 'in den 60-Grad-Keil geht nur das Dreieck')
  })

  check('was fittingShapes zusagt, laesst canPlace auch zu', () => {
    const st = station(12)
    // Erst eckig werden lassen - an einer nackten Station passt trivial alles.
    for (const defId of ['amplifier', 'autocannon', 'cannon', 'cryo']) {
      const module = newModule(st, defId, 'common')
      st.inventory.push(module)
      const spot = freeEdges(st).find((edge) => canPlace(st, defId, edge) === null)
      if (spot) place(st, module.uid, spot)
    }

    for (const sides of fittingShapes(st)) {
      const def = TOWERS.find((tower) => tower.sides === sides)
      assert(def !== undefined, `keine Turmart mit ${sides} Kanten`)
      assert(
        freeEdges(st).some((edge) => canPlace(st, def.id, edge) === null),
        `${sides}-Eck gilt als passend, canPlace laesst es nirgends zu`,
      )
    }
  })

  suite('core/geometry · Andocken')

  check('apothem(6) entspricht der Formel', () => {
    assertClose(apothem(6), (MODULE_SIDE * Math.sqrt(3)) / 2, 1e-9)
  })

  check('ein angedocktes Modul enthaelt die Andockkante (n = 3, 4, 6)', () => {
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

  check('ein angedocktes Modul ist positiv orientiert (n = 3, 4, 6)', () => {
    const core = corePoly()
    for (const sides of SIDES) {
      assert(signedArea(attachedTo(sides, core, 0)) > 0, `${sides}-Eck`)
    }
  })

  check('Beruehrung zaehlt nicht als Ueberlappung (n = 3, 4, 6)', () => {
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
    /*
     * Der Keil aus zwei Quadraten an benachbarten Kernkanten: 120 + 90 + 90 = 300 Grad, es
     * bleiben 60. Ein Sechseck braucht 120 und muss deshalb abgelehnt werden.
     *
     * Vorher stand hier dieselbe Lage mit zwei Autokanonen und einem Verstaerker. Die Lage
     * gibt es nicht mehr: Die Autokanone ist heute ein Dreieck, damit bleiben 240 Grad, und
     * das Sechseck passt hinein. Der Test hat also nicht die Ablehnung verloren - die Lage
     * war nur keine enge mehr.
     */
    const st = station(10)
    place(st, give(st, 'cryo'), coreEdge(st, 0))
    place(st, give(st, 'cryo'), coreEdge(st, 1))

    const blocked = freeEdges(st).filter((e) => canPlace(st, 'amplifier', e) === 'overlap')
    assert(blocked.length > 0, 'keine einzige Kante wurde als overlap erkannt')

    // Gegenprobe, und der eigentliche Sinn der Sache: Das Dreieck geht genau dort hinein.
    assert(
      blocked.some((e) => canPlace(st, 'autocannon', e) === null),
      'in den 60-Grad-Keil muss ein Dreieck passen',
    )
  })

  /*
   * Was mit einem Spielstand von **vor** der Formumstellung passiert.
   *
   * Das Vieleck wird aus `sides` abgeleitet und nie gespeichert (Zustandsmodell im Kopf von
   * `sim/station.ts`). Gespeichert ist nur Mittelpunkt und Drehung - und die stammen aus der
   * alten Form: Der Verstaerker sass als Fuenfeck apothem(5) = 38,5 vor der Kernkante, als
   * Sechseck braucht er 48,5. Sein Vieleck teilt die Andockkante damit nicht mehr, das Modul
   * haengt an nichts, und `sanitizeStation` legt es zurueck ins Lager.
   *
   * Das gilt fuer **jede** geaenderte Turmart, weil sich mit der Kantenzahl immer auch das
   * Apothem aendert: Ein alter Spielstand verliert seine Anordnung, aber keinen Turm. Und
   * weil jedes geaenderte Modul zurueckgelegt wird, kann auch keine Ueberlappung
   * ueberleben - die uebrigen Module sind unveraendert und waren vorher gueltig.
   */
  check('ein Spielstand mit alter Grundflaeche heilt sich beim Laden', () => {
    const st = station()
    const at = coreEdge(st, 0)
    const uid = give(st, 'amplifier')
    assertEqual(place(st, uid, at), null, 'erst regulaer setzen')

    const module = st.placed.find((m) => m.uid === uid)
    assert(module !== undefined, 'das Modul muss platziert sein')
    module.placement = attachTo(5, at.edge) // die alte Fuenfeck-Lage

    sanitizeStation(st)
    assertEqual(st.placed.length, 0, 'das Modul muss den Verbund verlassen')
    assert(
      st.inventory.some((m) => m.uid === uid),
      'und im Lager wieder auftauchen, nicht verschwinden',
    )
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
