/**
 * Bauregeln. Reine Funktionen ueber die Station - die Bedienung kennt keine Regeln.
 * Kein DOM, kein Canvas.
 *
 * Neu geschrieben nach dem Vorbild aus Prototyp 01: Die Regeln sind dort ueber 34.708
 * Platzierungen vermessen worden, die Struktur hat sich bewaehrt.
 *
 * Zustandsmodell (GDD 16 Abschnitt 7): Die Wahrheit sind **Weltkoordinaten**
 * (Mittelpunkt + Drehung), kein Andock-Baum. Nachbarschaft wird rein geometrisch
 * bestimmt, dadurch bleibt Entfernen trivial. Das Vieleck wird aus der Platzierung
 * abgeleitet und nie gespeichert - so kann es gar nicht auseinanderlaufen.
 */

import {
  attachTo,
  edgesOf,
  polygonAt,
  polygonsOverlap,
  pointInPolygon,
  pointSegmentDistance,
  sameEdge,
  type Edge,
} from '../core/geometry.ts'
import type { Vec2 } from '../core/vec.ts'
import { coreById } from '../data/cores.ts'
import { towerById } from '../data/towers.ts'
import { FOOTPRINT_SIDES, type FootprintSides, type Rarity } from '../data/types.ts'

// ---------------------------------------------------------------------------
// Modell
// ---------------------------------------------------------------------------

export type Placement = { center: Vec2; rotation: number }

export type ModuleInstance = {
  uid: string
  defId: string
  rarity: Rarity
  /**
   * Zufaellige Eigenschaften dieses **einzelnen** Turms (GDD 06 Abschnitt 10).
   *
   * Sie sind das, was zwei Tuerme derselben Art und Raritaet unterscheidet - Upgrades tun
   * das nicht, die gelten je Turmart (GDD 08 Abschnitt 5.2). Ihre Anzahl kommt aus der
   * Raritaet, ihre Qualitaet aus dem Prestige-Baum.
   */
  traits: string[]
  /** null = im Inventar. Das Inventar ist unbegrenzt (GDD 03 Abschnitt 6). */
  placement: Placement | null
}

export type Station = {
  coreId: string
  /** Turmplaetze zusaetzlich zum Hauptturm (GDD 03 Abschnitt 6). */
  slots: number
  placed: ModuleInstance[]
  inventory: ModuleInstance[]
  /** Fortlaufende Kennung. Gehoert in den Spielstand, damit sie nach dem Laden weiterlaeuft. */
  nextUid: number
}

/** Der Hauptturm hat eine feste Kennung - es gibt genau einen je Run. */
export const CORE_UID = 'core'

/** Er steht immer im Zentrum (GDD 03 Abschnitt 2). */
export const CORE_CENTER: Vec2 = { x: 0, y: 0 }

/** Ecke oben, dadurch flache Kanten links und rechts - der Look aus Prototyp 01. */
export const CORE_ROTATION = Math.PI / 6

export type PlacedModule = {
  uid: string
  kind: 'core' | 'tower'
  defId: string
  /** Haupttuerme haben keine Raritaet (GDD 04 Abschnitt 2). */
  rarity: Rarity | null
  /** Eigenschaften dieses Exemplars. Der Hauptturm hat keine - er wird nicht gekauft. */
  traits: readonly string[]
  sides: FootprintSides
  center: Vec2
  rotation: number
  poly: Vec2[]
  /** Indizes der Kanten, die mit einem Nachbarn geteilt werden - die "Fugen". */
  sharedEdges: number[]
}

export type FreeEdge = { ownerUid: string; edgeIndex: number; edge: Edge }

export type PlacementError =
  | 'overlap' // wuerde ein bestehendes Modul schneiden
  | 'no_slots' // Turmplatz-Limit erreicht
  | 'not_owned' // Modul liegt nicht im Inventar
  | 'no_edge' // keine Andockkante getroffen

export type RemoveError =
  | 'not_placed' // Modul liegt gar nicht auf der Station
  | 'is_core' // der Hauptturm ist nicht entfernbar (GDD 04 Abschnitt 1)

export type MoveError = PlacementError | RemoveError | 'would_disconnect'

export type ActionError = PlacementError | RemoveError | 'would_disconnect'

// ---------------------------------------------------------------------------
// Erzeugen und Nachschlagen
// ---------------------------------------------------------------------------

export function createStation(coreId: string, slots: number): Station {
  return { coreId, slots, placed: [], inventory: [], nextUid: 1 }
}

export function newModule(
  station: Station,
  defId: string,
  rarity: Rarity,
  traits: string[] = [],
): ModuleInstance {
  const module: ModuleInstance = {
    uid: `m${station.nextUid}`,
    defId,
    rarity,
    traits,
    placement: null,
  }
  station.nextUid += 1
  return module
}

/** Kantenzahl eines Moduls - fuer den Kern aus `data/cores.ts`, sonst aus `data/towers.ts`. */
export function sidesOf(defId: string, kind: 'core' | 'tower'): FootprintSides {
  return kind === 'core' ? coreById(defId).sides : towerById(defId).sides
}

export function coreModule(coreId: string): PlacedModule {
  const def = coreById(coreId)
  return {
    uid: CORE_UID,
    kind: 'core',
    defId: def.id,
    rarity: null,
    traits: [],
    sides: def.sides,
    center: CORE_CENTER,
    rotation: CORE_ROTATION,
    poly: polygonAt(def.sides, CORE_CENTER, CORE_ROTATION),
    sharedEdges: [],
  }
}

function toPlaced(module: ModuleInstance): PlacedModule | null {
  if (!module.placement) return null
  const def = towerById(module.defId)
  return {
    uid: module.uid,
    kind: 'tower',
    defId: def.id,
    rarity: module.rarity,
    traits: module.traits,
    sides: def.sides,
    center: module.placement.center,
    rotation: module.placement.rotation,
    poly: polygonAt(def.sides, module.placement.center, module.placement.rotation),
    sharedEdges: [],
  }
}

/**
 * Alle Module der Station in Weltkoordinaten, Hauptturm zuerst, samt gefuellter
 * `sharedEdges`. Das ist die eine Stelle, an der aus dem Spielstand Geometrie wird.
 */
export function stationModules(station: Station): PlacedModule[] {
  const modules: PlacedModule[] = [coreModule(station.coreId)]
  for (const module of station.placed) {
    const placed = toPlaced(module)
    if (placed) modules.push(placed)
  }
  markSharedEdges(modules)
  return modules
}

/** Fuer jedes Modul vermerken, welche seiner Kanten von einem Nachbarn belegt sind. */
function markSharedEdges(modules: PlacedModule[]): void {
  const edges = modules.map((module) => edgesOf(module.poly))

  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const a = edges[i] as Edge[]
      const b = edges[j] as Edge[]
      for (let ai = 0; ai < a.length; ai++) {
        for (let bi = 0; bi < b.length; bi++) {
          if (sameEdge(a[ai] as Edge, b[bi] as Edge)) {
            ;(modules[i] as PlacedModule).sharedEdges.push(ai)
            ;(modules[j] as PlacedModule).sharedEdges.push(bi)
          }
        }
      }
    }
  }
}

export function findModule(station: Station, uid: string): ModuleInstance | undefined {
  return station.placed.find((m) => m.uid === uid) ?? station.inventory.find((m) => m.uid === uid)
}

/** Belegte Turmplaetze. Der Hauptturm zaehlt nicht mit (GDD 03 Abschnitt 6). */
export function usedSlots(station: Station): number {
  return station.placed.length
}

// ---------------------------------------------------------------------------
// Freie Kanten und Vorschau
// ---------------------------------------------------------------------------

/**
 * Alle Kanten ohne deckungsgleiche Gegenkante - zugleich die Bauplaetze, die beim Bauen
 * hervorgehoben werden (GDD 13 Abschnitt 12).
 */
export function freeEdges(station: Station, ignoreUid?: string): FreeEdge[] {
  const modules = stationModules(station).filter((m) => m.uid !== ignoreUid)
  const all: FreeEdge[] = []
  for (const module of modules) {
    edgesOf(module.poly).forEach((edge, edgeIndex) => {
      all.push({ ownerUid: module.uid, edgeIndex, edge })
    })
  }
  return all.filter(
    (candidate) =>
      !all.some(
        (other) => other.ownerUid !== candidate.ownerUid && sameEdge(other.edge, candidate.edge),
      ),
  )
}

/** Die Geometrie, die ein Modul an dieser Kante haette. Ohne Nebenwirkung. */
export function previewPolygon(
  defId: string,
  at: FreeEdge,
): { poly: Vec2[]; center: Vec2; rotation: number } {
  const def = towerById(defId)
  const { center, rotation } = attachTo(def.sides, at.edge)
  return { poly: polygonAt(def.sides, center, rotation), center, rotation }
}

/**
 * Fuer jede freie Kante: welche Grundflaechen sich dort ansetzen lassen.
 *
 * **Ohne Ruecksicht auf Turmplaetze.** Gefragt ist die Form, nicht der Platz - ob noch ein
 * Slot frei ist, ist eine andere Auskunft und steht in `canPlace`.
 */
function shapesPerEdge(station: Station): FootprintSides[][] {
  const modules = stationModules(station)
  return freeEdges(station).map((at) =>
    FOOTPRINT_SIDES.filter((sides) => {
      const { center, rotation } = attachTo(sides, at.edge)
      const poly = polygonAt(sides, center, rotation)
      return modules.every((module) => !polygonsOverlap(poly, module.poly))
    }),
  )
}

/**
 * Welche Grundflaechen an dieser Station ueberhaupt noch irgendwohin passen.
 *
 * Das Sicherheitsnetz: Solange hier eine Form drinsteht, gibt es fuer sie einen Platz. Ein
 * Angebot aus lauter Formen, die nirgends hingehen, ist der schlechteste Zustand, den ein
 * Angebot haben kann - das Gold ist beim Wurf schon weg (`sim/shop.ts`).
 */
export function fittingShapes(station: Station): Set<FootprintSides> {
  const result = new Set<FootprintSides>()
  for (const shapes of shapesPerEdge(station)) {
    for (const sides of shapes) result.add(sides)
  }
  return result
}

/**
 * Welche Grundflaechen in eine **Luecke** passen - die eigentliche Frage.
 *
 * Eine Luecke ist eine freie Kante, an der **nicht** jede Form Platz hat: der Keil zwischen
 * zwei Quadraten, in den genau ein Dreieck geht, oder die Nische, die ein Sechseck nicht
 * mehr nimmt. Sie ist der Grund, warum das Bauen ueberhaupt eine Entscheidung ist, und der
 * Moment, in dem eine Station nach Konstruktion aussieht statt nach Anbau.
 *
 * Warum das nicht dasselbe ist wie `fittingShapes`: Solange eine Station irgendwo nach
 * aussen offen ist, passt ein Sechseck **irgendwohin** - und damit haelt `fittingShapes`
 * jedes Angebot fuer brauchbar, waehrend der Keil offen bleibt und der Spieler nichts hat,
 * was hineingeht. Erst diese Funktion beantwortet, was er gerade braucht.
 *
 * Leer heisst: keine Luecke, jede Kante nimmt alles - dann gibt es nichts zu bevorzugen.
 */
export function notchShapes(station: Station): Set<FootprintSides> {
  const result = new Set<FootprintSides>()
  for (const shapes of shapesPerEdge(station)) {
    if (shapes.length === 0 || shapes.length === FOOTPRINT_SIDES.length) continue
    for (const sides of shapes) result.add(sides)
  }
  return result
}

/** Freie Kante, die einem Weltpunkt am naechsten liegt. `maxDistance` ist der Fangradius. */
export function nearestFreeEdge(
  edges: readonly FreeEdge[],
  point: Vec2,
  maxDistance: number,
): FreeEdge | null {
  let best: FreeEdge | null = null
  let bestDistance = maxDistance
  for (const candidate of edges) {
    const distance = pointSegmentDistance(point, candidate.edge)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

/** Modul unter einem Weltpunkt. Spaetere Module liegen oben, deshalb rueckwaerts. */
export function moduleAt(modules: readonly PlacedModule[], point: Vec2): PlacedModule | null {
  for (let i = modules.length - 1; i >= 0; i--) {
    const module = modules[i] as PlacedModule
    if (pointInPolygon(point, module.poly)) return module
  }
  return null
}

// ---------------------------------------------------------------------------
// Platzieren
// ---------------------------------------------------------------------------

export function canPlace(
  station: Station,
  defId: string,
  at: FreeEdge,
  ignoreUid?: string,
): PlacementError | null {
  // Beim Umsetzen wird kein zusaetzlicher Platz belegt - deshalb nur ohne `ignoreUid`.
  if (ignoreUid === undefined && usedSlots(station) >= station.slots) return 'no_slots'

  const { poly } = previewPolygon(defId, at)
  for (const module of stationModules(station)) {
    if (module.uid === ignoreUid) continue
    if (polygonsOverlap(poly, module.poly)) return 'overlap'
  }
  return null
}

/** Platziert ein Modul aus dem Inventar. Prueft selbst - ein Fehler aendert nichts. */
export function place(station: Station, uid: string, at: FreeEdge): PlacementError | null {
  const index = station.inventory.findIndex((m) => m.uid === uid)
  if (index < 0) return 'not_owned'
  const module = station.inventory[index] as ModuleInstance

  const error = canPlace(station, module.defId, at)
  if (error) return error

  const { center, rotation } = previewPolygon(module.defId, at)
  module.placement = { center, rotation }
  station.inventory.splice(index, 1)
  station.placed.push(module)
  return null
}

// ---------------------------------------------------------------------------
// Nachbarschaft und Zusammenhang
// ---------------------------------------------------------------------------

/**
 * Wer teilt mit wem eine ganze Kante. Module, die sich nur in einer **Ecke** beruehren,
 * sind keine Nachbarn - daran haengt das gesamte Buff-System (GDD 03 Abschnitt 9).
 */
export function adjacency(station: Station, excludeUid?: string): Map<string, string[]> {
  const modules = stationModules(station).filter((m) => m.uid !== excludeUid)
  const edges = modules.map((m) => edgesOf(m.poly))
  const map = new Map<string, string[]>(modules.map((m) => [m.uid, []]))

  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const a = edges[i] as Edge[]
      const b = edges[j] as Edge[]
      if (a.some((ea) => b.some((eb) => sameEdge(ea, eb)))) {
        const uidA = (modules[i] as PlacedModule).uid
        const uidB = (modules[j] as PlacedModule).uid
        map.get(uidA)?.push(uidB)
        map.get(uidB)?.push(uidA)
      }
    }
  }
  return map
}

export function neighbors(station: Station, uid: string): string[] {
  return adjacency(station).get(uid) ?? []
}

/**
 * Module, die ohne `withoutUid` keine Kantenverbindung mehr zum Hauptturm haetten.
 * Breitensuche ab dem Kern - das ist die Abriss-Vorschau aus GDD 03 Abschnitt 4.
 */
export function detached(station: Station, withoutUid?: string): ModuleInstance[] {
  const adj = adjacency(station, withoutUid)
  const seen = new Set<string>([CORE_UID])
  const queue: string[] = [CORE_UID]

  while (queue.length > 0) {
    const current = queue.pop() as string
    for (const next of adj.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }

  return station.placed.filter((m) => m.uid !== withoutUid && !seen.has(m.uid))
}

export function isConnected(station: Station, withoutUid?: string): boolean {
  return detached(station, withoutUid).length === 0
}

// ---------------------------------------------------------------------------
// Entfernen
// ---------------------------------------------------------------------------

/**
 * Entfernen ist **immer** erlaubt (GDD 03 Abschnitt 4). Die Alternative - blockieren,
 * solange die Station zerfiele - wurde am Prototyp vermessen: Bei 15 Modulen waeren rund
 * 50 % aller Module dauerhaft festgenagelt. Das widerspricht "komplette Umbauten sind
 * erwuenscht". Pflicht dazu ist die Vorschau, siehe `detached`.
 */
export function canRemove(station: Station, uid: string): RemoveError | null {
  if (uid === CORE_UID) return 'is_core'
  if (!station.placed.some((m) => m.uid === uid)) return 'not_placed'
  return null
}

/**
 * Entfernt ein Modul und gibt alle Module zurueck, die dabei ins Inventar gewandert sind -
 * einschliesslich der abgetrennten Inseln.
 */
export function remove(station: Station, uid: string): ModuleInstance[] {
  const target = station.placed.find((m) => m.uid === uid)
  if (!target) return []

  const moved = [target, ...detached(station, uid)]
  const ids = new Set(moved.map((m) => m.uid))
  station.placed = station.placed.filter((m) => !ids.has(m.uid))

  for (const module of moved) {
    module.placement = null
    station.inventory.push(module)
  }
  return moved
}

// ---------------------------------------------------------------------------
// Verschieben
// ---------------------------------------------------------------------------

/**
 * Verschieben ist strenger als Entfernen: Ein Brueckenmodul laesst sich nicht umsetzen,
 * denn ein Zug ist kein Abriss (GDD 03 Abschnitt 4). Wer es versetzen will, entfernt es
 * bewusst - und sieht dabei in der Vorschau, was mitgeht.
 */
export function canMove(station: Station, uid: string, to: FreeEdge): MoveError | null {
  if (uid === CORE_UID) return 'is_core'
  const module = station.placed.find((m) => m.uid === uid)
  if (!module) return 'not_placed'
  if (!isConnected(station, uid)) return 'would_disconnect'
  return canPlace(station, module.defId, to, uid)
}

/** Setzt ein platziertes Modul an eine andere Kante um. Prueft selbst. */
export function move(station: Station, uid: string, to: FreeEdge): MoveError | null {
  const error = canMove(station, uid, to)
  if (error) return error

  const module = station.placed.find((m) => m.uid === uid) as ModuleInstance
  const { center, rotation } = previewPolygon(module.defId, to)
  module.placement = { center, rotation }
  return null
}

// ---------------------------------------------------------------------------
// Aufraeumen
// ---------------------------------------------------------------------------

/**
 * Stellt die Invarianten der Station wieder her. Wird nach dem Laden aufgerufen, denn ein
 * Spielstand kann aus einer Fassung stammen, in der eine Turmart noch existierte oder mehr
 * Turmplaetze freigeschaltet waren. Module gehen dabei nie verloren - sie wandern ins
 * Inventar, das unbegrenzt ist (GDD 03 Abschnitt 6).
 */
export function sanitizeStation(station: Station): void {
  // Zu viele platzierte Module: die ueberzaehligen zurueck ins Inventar.
  while (station.placed.length > station.slots) {
    const module = station.placed.pop()
    if (!module) break
    module.placement = null
    station.inventory.push(module)
  }

  // Module ohne Kantenverbindung zum Hauptturm ebenfalls zurueck.
  let orphans = detached(station)
  while (orphans.length > 0) {
    const ids = new Set(orphans.map((m) => m.uid))
    station.placed = station.placed.filter((m) => !ids.has(m.uid))
    for (const module of orphans) {
      module.placement = null
      station.inventory.push(module)
    }
    orphans = detached(station)
  }

  // Die Kennung muss ueber allem liegen, was es schon gibt.
  let highest = 0
  for (const module of [...station.placed, ...station.inventory]) {
    const parsed = Number.parseInt(module.uid.slice(1), 10)
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed
  }
  if (station.nextUid <= highest) station.nextUid = highest + 1
}
