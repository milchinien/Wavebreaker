/**
 * Zusicherungen fuer die reinen Funktionen — dort, wo Fehler still bleiben.
 * Kein Testframework: Aufruf ueber ?selftest in der Adresszeile oder den Knopf im Debug-Panel.
 */
import {
  apothem,
  attachTo,
  dist,
  edgesOf,
  EPS,
  polygonAt,
  polygonsOverlap,
  sameEdge,
  signedArea,
  SIDE,
} from './geometry'
import type { Vec2 } from './geometry'
import { BASE_STATION_HP, BUFF_CAPS, CORE_DEF, makeInstance } from './catalog'
import { buffLinks, computeStation, STAT_KEYS } from './buffs'
import { growRandom } from './devtools'
import { createCamera, fitTo } from './camera'
import type { Rarity } from './model'
import {
  adjacency,
  canMove,
  canPlace,
  canRemove,
  createStation,
  detached,
  findModule,
  freeEdges,
  isConnected,
  move,
  neighbors,
  place,
  previewPolygon,
  remove,
} from './station'
import { deserialize, serialize } from './persist'
import type { FreeEdge } from './station'
import type { Station } from './model'

export type TestResult = { name: string; ok: boolean; info?: string }

const results: TestResult[] = []

function check(name: string, fn: () => string | void): void {
  try {
    const info = fn()
    results.push({ name, ok: true, ...(info ? { info } : {}) })
  } catch (e) {
    results.push({ name, ok: false, info: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

const corePoly = (): Vec2[] => polygonAt(CORE_DEF.sides, { x: 0, y: 0 }, Math.PI / 6)

/** Modul der Groesse n an Kante `edgeIndex` des Hauptturms — reine Geometrie, ohne Station. */
function attachedTo(n: number, poly: Vec2[], edgeIndex: number): Vec2[] {
  const edge = edgesOf(poly)[edgeIndex]!
  const { center, rotation } = attachTo(n, edge)
  return polygonAt(n, center, rotation)
}

function give(st: Station, defId: string): string {
  const inst = makeInstance(defId, 'common')
  st.inventory.push(inst)
  return inst.uid
}

/**
 * Kette Core—B—A: A haengt an der vom Zentrum am weitesten entfernten Kante von B
 * und beruehrt den Hauptturm daher nicht. B ist damit ein Brueckenmodul.
 */
function chainStation(): { st: Station; a: string; b: string } {
  const st = createStation(9)
  const b = give(st, 'autocannon')
  place(st, b, freeEdges(st)[0]!)

  const own = freeEdges(st).filter(f => f.ownerUid === b)
  let far = own[0]!
  let farDist = -1
  for (const f of own) {
    const d = Math.hypot((f.edge.a.x + f.edge.b.x) / 2, (f.edge.a.y + f.edge.b.y) / 2)
    if (d > farDist) {
      farDist = d
      far = f
    }
  }

  const a = give(st, 'autocannon')
  place(st, a, far)
  return { st, a, b }
}

/** Ein Autocannon am Hauptturm, umgeben von `count` Rate Amplifiern an seinen freien Kanten. */
function amplifiedStation(count: number): { st: Station; target: string } {
  const st = createStation(20)
  const target = give(st, 'autocannon')
  place(st, target, freeEdges(st)[0]!)

  for (let i = 0; i < count; i++) {
    const own = freeEdges(st).filter(f => f.ownerUid === target)
    const fe = own.find(f => canPlace(st, 'rate_amplifier', f) === null)
    if (!fe) throw new Error(`nur ${i} von ${count} Amplifiern passten an`)
    place(st, give(st, 'rate_amplifier'), fe)
  }
  return { st, target }
}

export function runSelfTests(): TestResult[] {
  results.length = 0

  // --- Geometrie -----------------------------------------------------------

  check('apothem(6) = SIDE·√3/2', () => {
    assert(Math.abs(apothem(6) - (SIDE * Math.sqrt(3)) / 2) < 1e-9, `${apothem(6)}`)
  })

  check('polygonAt: alle Seiten haben Laenge SIDE (n=3..6)', () => {
    for (let n = 3; n <= 6; n++) {
      const poly = polygonAt(n, { x: 13, y: -7 }, 0.4)
      for (const e of edgesOf(poly)) {
        assert(Math.abs(dist(e.a, e.b) - SIDE) < 1e-9, `n=${n}: ${dist(e.a, e.b)}`)
      }
    }
  })

  check('polygonAt: positiv orientiert (n=3..6)', () => {
    for (let n = 3; n <= 6; n++) {
      assert(signedArea(polygonAt(n, { x: 0, y: 0 }, 1.1)) > 0, `n=${n}`)
    }
  })

  check('attachTo: angedocktes Modul enthaelt die Andockkante (n=3..6)', () => {
    const core = corePoly()
    const edge = edgesOf(core)[0]!
    for (let n = 3; n <= 6; n++) {
      const poly = attachedTo(n, core, 0)
      assert(edgesOf(poly).some(e => sameEdge(e, edge)), `n=${n}`)
    }
  })

  check('attachTo: Beruehrung zaehlt nicht als Ueberlappung (n=3..6)', () => {
    const core = corePoly()
    for (let n = 3; n <= 6; n++) {
      assert(!polygonsOverlap(attachedTo(n, core, 0), core), `n=${n}`)
    }
  })

  check('Zwei Hexagone an benachbarten Core-Kanten teilen selbst eine Kante', () => {
    const core = corePoly()
    const a = attachedTo(6, core, 0)
    const b = attachedTo(6, core, 1)
    assert(!polygonsOverlap(a, b), 'ueberlappen sich')
    assert(
      edgesOf(a).some(ea => edgesOf(b).some(eb => sameEdge(ea, eb))),
      'keine gemeinsame Kante gefunden',
    )
  })

  check('Zwei Vierecke an benachbarten Core-Kanten teilen nur eine Ecke', () => {
    const core = corePoly()
    const a = attachedTo(4, core, 0)
    const b = attachedTo(4, core, 1)
    assert(!polygonsOverlap(a, b), 'ueberlappen sich')
    assert(
      !edgesOf(a).some(ea => edgesOf(b).some(eb => sameEdge(ea, eb))),
      'duerfen keine Kante teilen',
    )
    assert(
      a.some(pa => b.some(pb => dist(pa, pb) < EPS)),
      'muessen eine Ecke teilen',
    )
  })

  check('Sechs Dreiecke an allen Core-Kanten ueberlappen nicht', () => {
    const core = corePoly()
    const tris = [0, 1, 2, 3, 4, 5].map(i => attachedTo(3, core, i))
    for (let i = 0; i < tris.length; i++) {
      for (let j = i + 1; j < tris.length; j++) {
        assert(!polygonsOverlap(tris[i]!, tris[j]!), `${i} und ${j} ueberlappen`)
      }
    }
  })

  // --- Bauregeln -----------------------------------------------------------

  check('Hauptturm hat anfangs genau 6 freie Kanten', () => {
    assert(freeEdges(createStation()).length === 6, `${freeEdges(createStation()).length}`)
  })

  check('Ein angedocktes n-Eck aendert die freien Kanten um n-2', () => {
    for (const [defId, n] of [
      ['marksman', 3],
      ['autocannon', 4],
      ['rate_amplifier', 5],
      ['bulwark', 6],
    ] as const) {
      const st = createStation(10)
      const before = freeEdges(st).length
      const uid = give(st, defId)
      const err = place(st, uid, freeEdges(st)[0]!)
      assert(err === null, `${defId}: ${err}`)
      const after = freeEdges(st).length
      assert(after === before + n - 2, `${defId}: ${before} -> ${after}, erwartet ${before + n - 2}`)
    }
  })

  check('Platzierung in einen zu engen Keil liefert "overlap"', () => {
    const st = createStation(10)
    // Zwei Vierecke an benachbarten Core-Kanten lassen einen 60°-Keil offen.
    place(st, give(st, 'autocannon'), freeEdges(st)[0]!)
    const edgeNextToCore = freeEdges(st).find(f => f.ownerUid === st.core.uid)!
    place(st, give(st, 'autocannon'), edgeNextToCore)
    // Ein Hexagon (120°) passt dort nicht mehr hinein.
    const blocked = freeEdges(st).filter(f => canPlace(st, 'bulwark', f) === 'overlap')
    assert(blocked.length > 0, 'keine einzige Kante wurde als overlap erkannt')
    return `${blocked.length} Kanten blockiert`
  })

  check('Platzlimit liefert "no_slots"', () => {
    const st = createStation(1)
    assert(place(st, give(st, 'autocannon'), freeEdges(st)[0]!) === null, 'erste Platzierung')
    assert(canPlace(st, 'autocannon', freeEdges(st)[0]!) === 'no_slots', 'zweite muss abgelehnt werden')
  })

  check('Platziertes Modul ist Kantennachbar des Hauptturms', () => {
    const st = createStation(4)
    const uid = give(st, 'autocannon')
    place(st, uid, freeEdges(st)[0]!)
    const nb = neighbors(st, uid)
    assert(nb.length === 1 && nb[0]!.uid === st.core.uid, `Nachbarn: ${nb.length}`)
  })

  check('Platziertes Modul verlaesst das Inventar genau einmal', () => {
    const st = createStation(4)
    const uid = give(st, 'autocannon')
    const before = st.inventory.length
    place(st, uid, freeEdges(st)[0]!)
    assert(st.inventory.length === before - 1, 'Inventarzahl')
    assert(!st.inventory.some(t => t.uid === uid), 'noch im Inventar')
    assert(st.placed.filter(t => t.uid === uid).length === 1, 'nicht genau einmal platziert')
  })

  // --- Entfernen und Verschieben (M4) ---------------------------------------

  check('Kette A—B—Core: Entfernen von B wird als Bruch erkannt', () => {
    const { st, a, b } = chainStation()
    assert(isConnected(st), 'vollstaendige Station muss zusammenhaengen')
    assert(!isConnected(st, b), 'ohne B muesste A abgetrennt sein')
    assert(isConnected(st, a), 'ohne A muss der Rest zusammenhaengen')
    const orphans = detached(st, b)
    assert(orphans.length === 1 && orphans[0]!.uid === a, `abgetrennt: ${orphans.length}`)
  })

  check('Variante A blockiert das Entfernen eines Brueckenmoduls', () => {
    const { st, a, b } = chainStation()
    assert(canRemove(st, b, 'block') === 'would_disconnect', 'B muss blockiert sein')
    assert(canRemove(st, a, 'block') === null, 'A muss entfernbar sein')
  })

  check('Variante B laesst abgetrennte Module zurueckwandern', () => {
    const { st, a, b } = chainStation()
    assert(canRemove(st, b, 'return') === null, 'darf nicht blockieren')
    const moved = remove(st, b, 'return')
    assert(moved.length === 2, `erwartet 2 zurueckgewanderte Module, waren ${moved.length}`)
    assert(st.placed.length === 0, `Station muesste leer sein, hat ${st.placed.length}`)
    assert(st.inventory.some(t => t.uid === a), 'A muss im Inventar liegen')
    assert(st.inventory.filter(t => t.uid === b).length === 1, 'B genau einmal im Inventar')
    assert(!st.inventory.some(t => t.poly.length > 0), 'zurueckgewanderte Module ohne Geometrie')
  })

  check('Der Hauptturm kann nicht entfernt werden', () => {
    const st = createStation(4)
    assert(canRemove(st, st.core.uid, 'block') === 'is_core', 'Variante A')
    assert(canRemove(st, st.core.uid, 'return') === 'is_core', 'Variante B')
  })

  check('Entfernen gibt den Turmplatz wieder frei', () => {
    const st = createStation(1)
    const uid = give(st, 'autocannon')
    place(st, uid, freeEdges(st)[0]!)
    assert(canPlace(st, 'autocannon', freeEdges(st)[0]!) === 'no_slots', 'Limit muss greifen')
    remove(st, uid, 'block')
    assert(st.placed.length === 0, 'nicht mehr platziert')
    assert(canPlace(st, 'autocannon', freeEdges(st)[0]!) === null, 'Platz wieder frei')
  })

  check('Entfernen stellt die urspruengliche Kantenzahl wieder her', () => {
    const st = createStation(9)
    const before = freeEdges(st).length
    const uid = give(st, 'rate_amplifier')
    place(st, uid, freeEdges(st)[0]!)
    remove(st, uid, 'block')
    assert(freeEdges(st).length === before, `${freeEdges(st).length} statt ${before}`)
  })

  check('Zielkanten beim Verschieben enthalten nie eigene Kanten des Moduls', () => {
    const st = createStation(9)
    const uid = give(st, 'autocannon')
    place(st, uid, freeEdges(st)[0]!)
    place(st, give(st, 'marksman'), freeEdges(st)[3]!)
    const targets = freeEdges(st, uid)
    assert(!targets.some((t: FreeEdge) => t.ownerUid === uid), 'Modul koennte an sich selbst andocken')
  })

  check('Verschieben aendert die Platzzahl nicht und setzt die Geometrie um', () => {
    const st = createStation(9)
    const uid = give(st, 'autocannon')
    place(st, uid, freeEdges(st)[0]!)
    const before = st.placed.length
    const from = st.placed.find(t => t.uid === uid)!.placement!.center

    const target = freeEdges(st, uid).find(t => t.ownerUid === st.core.uid && t.edgeIndex === 3)!
    assert(canMove(st, uid, target) === null, 'Zug muss erlaubt sein')
    move(st, uid, target)

    const to = st.placed.find(t => t.uid === uid)!.placement!.center
    assert(st.placed.length === before, 'Anzahl platzierter Module')
    assert(dist(from, to) > 1, 'Modul hat sich nicht bewegt')
    assert(st.placed.find(t => t.uid === uid)!.poly.length === 4, 'Geometrie nicht neu erzeugt')
    assert(isConnected(st), 'Station muss danach zusammenhaengen')
  })

  check('Ein Brueckenmodul kann nicht verschoben werden', () => {
    const { st, b } = chainStation()
    const target = freeEdges(st, b).find(t => t.ownerUid === st.core.uid)!
    assert(canMove(st, b, target) === 'would_disconnect', 'muss abgelehnt werden')
  })

  // --- Buff-System (M5) -----------------------------------------------------

  check('Modul ohne Buff-Nachbarn: effektiv = Basis', () => {
    const st = createStation(9)
    const uid = give(st, 'autocannon')
    place(st, uid, freeEdges(st)[0]!)
    const t = computeStation(st).towers.get(uid)!
    for (const k of STAT_KEYS) assert(t.final[k] === t.base[k], `${k} veraendert`)
    assert(t.sources.length === 0, 'unerwartete Buff-Quellen')
  })

  check('Zwei Amplifier auf dasselbe Modul stapeln additiv', () => {
    const { st, target } = amplifiedStation(2)
    const t = computeStation(st).towers.get(target)!
    const expected = 0.25 * 2
    assert(t.sources.length === 2, `Quellen: ${t.sources.length}`)
    assert(Math.abs((t.bonuses.attackSpeed ?? 0) - expected) < 1e-9, `${t.bonuses.attackSpeed}`)
    assert(Math.abs(t.final.attackSpeed - t.base.attackSpeed * 1.5) < 1e-9, 'Endwert falsch')
    return `+${(expected * 100).toFixed(0)} % Angriffstempo`
  })

  check('Amplifier neben Amplifier erzeugt keinen Bonus', () => {
    const st = createStation(9)
    const p1 = give(st, 'rate_amplifier')
    place(st, p1, freeEdges(st)[0]!)
    const p2 = give(st, 'rate_amplifier')
    place(st, p2, freeEdges(st).find(f => f.ownerUid === p1)!)

    const sum = computeStation(st)
    assert(neighbors(st, p1).some(m => m.uid === p2), 'die beiden muessen benachbart sein')
    for (const uid of [p1, p2]) {
      const t = sum.towers.get(uid)!
      assert(t.sources.length === 0, `${uid} hat Buff-Quellen`)
      assert(Object.keys(t.bonuses).length === 0, `${uid} hat Boni`)
    }
  })

  check('Nur eckberuehrende Module werden nicht gebufft', () => {
    const st = createStation(9)
    const amp = give(st, 'rate_amplifier')
    place(st, amp, freeEdges(st).find(f => f.ownerUid === st.core.uid && f.edgeIndex === 0)!)
    const gun = give(st, 'autocannon')
    place(st, gun, freeEdges(st).find(f => f.ownerUid === st.core.uid && f.edgeIndex === 1)!)

    assert(!neighbors(st, amp).some(m => m.uid === gun), 'duerfen keine Kante teilen')
    const t = computeStation(st).towers.get(gun)!
    assert(t.sources.length === 0, 'Bonus trotz blosser Eckberuehrung')
  })

  check('Ueber dem Deckel wird auf den Deckel begrenzt', () => {
    const st = createStation(20)
    for (let i = 0; i < 5; i++) {
      const uid = give(st, 'rate_amplifier')
      const fe = freeEdges(st).find(f => f.ownerUid === st.core.uid)!
      place(st, uid, fe)
    }
    const t = computeStation(st).towers.get(st.core.uid)!
    const raw = t.raw.attackSpeed ?? 0
    assert(raw > BUFF_CAPS.attackSpeed, `Rohsumme ${raw} muss ueber dem Deckel liegen`)
    assert(t.bonuses.attackSpeed === BUFF_CAPS.attackSpeed, `gedeckelt: ${t.bonuses.attackSpeed}`)
    assert(t.capped.includes('attackSpeed'), 'Deckel nicht vermerkt')
    assert(
      Math.abs(t.final.attackSpeed - t.base.attackSpeed * (1 + BUFF_CAPS.attackSpeed)) < 1e-9,
      'Endwert falsch',
    )
    return `Rohsumme +${(raw * 100).toFixed(0)} % → Deckel +${BUFF_CAPS.attackSpeed * 100} %`
  })

  check('Raritaet verstaerkt den Buff eines Amplifiers', () => {
    const build = (rarity: Rarity): number => {
      const st = createStation(9)
      const gun = give(st, 'autocannon')
      place(st, gun, freeEdges(st)[0]!)
      const amp = makeInstance('rate_amplifier', rarity)
      st.inventory.push(amp)
      place(st, amp.uid, freeEdges(st).find(f => f.ownerUid === gun)!)
      return computeStation(st).towers.get(gun)!.bonuses.attackSpeed ?? 0
    }
    const common = build('common')
    const legendary = build('legendary')
    assert(common > 0, 'Common muss wirken')
    assert(legendary > common, `${legendary} muss ueber ${common} liegen`)
  })

  check('Support wirkt stationsweit auf die Stations-HP', () => {
    const st = createStation(9)
    const before = computeStation(st).stationHp
    assert(before === BASE_STATION_HP, `Basis-HP ${before}`)
    const uid = give(st, 'bulwark')
    place(st, uid, freeEdges(st)[0]!)
    const after = computeStation(st).stationHp
    assert(after > before, `${after} muss ueber ${before} liegen`)
    assert(computeStation(st).towers.get(uid)!.sources.length === 0, 'Support ist kein Buff-Ziel')
  })

  check('Ein Amplifier hebt die Stations-DPS', () => {
    const st = createStation(9)
    const gun = give(st, 'autocannon')
    place(st, gun, freeEdges(st)[0]!)
    const before = computeStation(st).theoreticalDps
    const amp = give(st, 'power_amplifier')
    place(st, amp, freeEdges(st).find(f => f.ownerUid === gun)!)
    const after = computeStation(st).theoreticalDps
    assert(after > before, `${after} muss ueber ${before} liegen`)
    return `${before.toFixed(1)} → ${after.toFixed(1)}`
  })

  check('Buff-Module tragen selbst nichts zur DPS bei', () => {
    const st = createStation(9)
    const uid = give(st, 'rate_amplifier')
    place(st, uid, freeEdges(st)[0]!)
    const t = computeStation(st).towers.get(uid)!
    assert(t.final.damage === 0 && t.final.attackSpeed === 0, 'Buff-Modul hat Kampfwerte')
  })

  check('buffLinks liefert je Paar genau eine Verbindung', () => {
    const { st, target } = amplifiedStation(2)
    const links = buffLinks(computeStation(st))
    const toTarget = links.filter(l => l.to === target)
    assert(toTarget.length === 2, `erwartet 2 Linien, waren ${toTarget.length}`)
    assert(new Set(toTarget.map(l => l.from)).size === 2, 'Linien nicht von zwei Quellen')
  })

  // --- Darstellung und Werkzeuge (M6) ---------------------------------------

  check('growRandom baut die gewuenschte Modulanzahl und bleibt ueberlappungsfrei', () => {
    const st = createStation(4)
    const placed = growRandom(st, 25, 4711)
    assert(placed === 25, `nur ${placed} von 25 Modulen`)
    assert(st.placed.length === 25, `platziert: ${st.placed.length}`)

    const mods = [st.core, ...st.placed]
    for (let i = 0; i < mods.length; i++) {
      for (let j = i + 1; j < mods.length; j++) {
        assert(!polygonsOverlap(mods[i]!.poly, mods[j]!.poly), `${i} und ${j} ueberlappen`)
      }
    }
    assert(isConnected(st), 'Station muss zusammenhaengen')
  })

  check('Sichtbare Reichweiten lassen die Kamera weiter herausfahren', () => {
    const st = createStation(9)
    place(st, give(st, 'marksman'), freeEdges(st)[0]!)
    const polys = [st.core, ...st.placed].map(m => m.poly)

    const tight = createCamera()
    fitTo(tight, polys, 800, 600)
    const wide = createCamera()
    fitTo(wide, polys, 800, 600, 320)

    assert(wide.targetZoom < tight.targetZoom, `${wide.targetZoom} muss unter ${tight.targetZoom} liegen`)
    return `Zoom ${tight.targetZoom.toFixed(2)} → ${wide.targetZoom.toFixed(2)}`
  })

  // --- Persistenz (M7) ------------------------------------------------------

  check('Speichern → Laden erhaelt Geometrie und Nachbarschaft', () => {
    const st = createStation(9)
    growRandom(st, 12, 2024)

    const back = deserialize(JSON.parse(JSON.stringify(serialize(st))))
    assert(back !== null, 'Laden fehlgeschlagen')
    assert(back!.placed.length === st.placed.length, 'Modulanzahl')
    assert(back!.inventory.length === st.inventory.length, 'Inventarzahl')
    assert(back!.slots === st.slots, 'Turmplaetze')

    // Rundung auf 3 Nachkommastellen darf keine gemeinsame Kante zerreissen
    for (let i = 0; i < st.placed.length; i++) {
      const a = st.placed[i]!
      const b = back!.placed[i]!
      assert(a.defId === b.defId && a.rarity === b.rarity, `Modul ${i} vertauscht`)
      for (let k = 0; k < a.poly.length; k++) {
        assert(dist(a.poly[k]!, b.poly[k]!) < EPS, `Modul ${i}, Ecke ${k} verschoben`)
      }
    }

    const signature = (s: Station): string =>
      [...adjacency(s).entries()]
        .map(([uid, list]) => `${findModule(s, uid)!.defId}:${list.length}`)
        .sort()
        .join('|')
    assert(signature(back!) === signature(st), 'Nachbarschaftsstruktur weicht ab')
    assert(isConnected(back!), 'geladene Station haengt nicht zusammen')
  })

  check('Kaputte Spielstaende werden abgelehnt statt zu stuerzen', () => {
    const good = serialize(createStation(4))
    const broken: unknown[] = [
      null,
      42,
      'quatsch',
      { ...good, v: 99 },
      { ...good, placed: 'keine Liste' },
      { ...good, slots: Number.NaN },
      { ...good, placed: [{ defId: 'gibt_es_nicht', rarity: 'common', cx: 0, cy: 0, rot: 0 }] },
      { ...good, placed: [{ defId: 'autocannon', rarity: 'ultra', cx: 0, cy: 0, rot: 0 }] },
      { ...good, placed: [{ defId: 'autocannon', rarity: 'common', cx: Infinity, cy: 0, rot: 0 }] },
      { ...good, placed: [{ defId: 'autocannon', rarity: 'common', cx: 1e9, cy: 0, rot: 0 }] },
    ]
    for (const b of broken) {
      assert(deserialize(b) === null, `nicht abgelehnt: ${JSON.stringify(b).slice(0, 60)}`)
    }
    assert(deserialize(good) !== null, 'gueltiger Spielstand wurde abgelehnt')
    return `${broken.length} Varianten abgewiesen`
  })

  check('previewPolygon liefert dieselbe Geometrie wie die Platzierung', () => {
    const st = createStation(4)
    const uid = give(st, 'siege_cannon')
    const edge = freeEdges(st)[2]!
    const preview = previewPolygon('siege_cannon', edge).poly
    place(st, uid, edge)
    const placed = st.placed.find(t => t.uid === uid)!
    for (let i = 0; i < preview.length; i++) {
      assert(dist(preview[i]!, placed.poly[i]!) < 1e-9, `Ecke ${i} weicht ab`)
    }
  })

  return [...results]
}
