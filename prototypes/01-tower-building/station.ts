/**
 * Bauregeln. Reine Funktionen ueber den Zustand — die UI kennt keine Regeln.
 * Kennt weder DOM noch Canvas.
 */
import { attachTo, edgesOf, polygonAt, polygonsOverlap, sameEdge } from './geometry'
import type { Edge, Vec2 } from './geometry'
import { CORE_DEF, defOf, makeInstance, startingInventory } from './catalog'
import type { Station, TowerInstance } from './model'

export type FreeEdge = { ownerUid: string; edgeIndex: number; edge: Edge }

export type PlacementError =
  | 'overlap' // wuerde ein bestehendes Modul schneiden
  | 'no_slots' // Turmplatz-Limit erreicht
  | 'not_owned' // Turm nicht im Inventar
  | 'no_edge' // keine Andockkante getroffen

export type RemoveError =
  | 'not_placed' // Modul liegt gar nicht auf der Station
  | 'is_core' // der Hauptturm ist nicht entfernbar (GDD 04 §1)
  | 'would_disconnect' // Rest der Station wuerde zerfallen

export type ActionError = PlacementError | RemoveError

export const ERROR_TEXT: Record<ActionError, string> = {
  overlap: 'Kein Platz — wuerde ein Modul schneiden',
  no_slots: 'Alle Turmplaetze belegt',
  not_owned: 'Turm nicht im Inventar',
  no_edge: 'Keine Andockkante in der Naehe',
  not_placed: 'Modul ist nicht platziert',
  is_core: 'Der Hauptturm kann nicht entfernt werden',
  would_disconnect: 'Wuerde die Station zerteilen',
}

/**
 * Umgang mit dem Entfernen eines Moduls, das die Station zerteilen wuerde.
 * Im GDD nicht entschieden — genau das soll der Prototyp beantworten (offene Frage F2).
 */
export type RemovalRule =
  | 'block' // Variante A: Entfernen wird abgelehnt
  | 'return' // Variante B: abgetrennte Module wandern zurueck ins Inventar

/** Drehung des Hauptturms: Ecke oben, dadurch flache Kanten links und rechts. */
const CORE_ROTATION = Math.PI / 6

export function createStation(slots = 4): Station {
  const core = makeInstance(CORE_DEF.id, 'legendary')
  core.placement = { center: { x: 0, y: 0 }, rotation: CORE_ROTATION }
  core.poly = polygonAt(CORE_DEF.sides, core.placement.center, core.placement.rotation)
  return { core, placed: [], inventory: startingInventory(), slots }
}

/** Hauptturm und alle angebauten Module. */
export function allModules(st: Station): TowerInstance[] {
  return [st.core, ...st.placed]
}

export function findModule(st: Station, uid: string): TowerInstance | undefined {
  return allModules(st).find(m => m.uid === uid)
}

/** Belegte Turmplaetze — der Hauptturm zaehlt nicht mit (GDD 03 §6). */
export const usedSlots = (st: Station): number => st.placed.length

/**
 * Alle Kanten ohne deckungsgleiche Gegenkante. Das sind zugleich die moeglichen
 * Bauplaetze, die laut GDD 13 §12 hervorgehoben werden.
 */
export function freeEdges(st: Station, ignoreUid?: string): FreeEdge[] {
  const mods = allModules(st).filter(m => m.uid !== ignoreUid)
  const all: FreeEdge[] = []
  for (const m of mods) {
    edgesOf(m.poly).forEach((edge, edgeIndex) => all.push({ ownerUid: m.uid, edgeIndex, edge }))
  }
  return all.filter(
    fe => !all.some(other => other.ownerUid !== fe.ownerUid && sameEdge(other.edge, fe.edge)),
  )
}

/** Geometrie, die ein Modul an dieser Kante haette. */
export function previewPolygon(defId: string, at: FreeEdge): { poly: Vec2[]; center: Vec2; rotation: number } {
  const def = defOf(defId)
  const { center, rotation } = attachTo(def.sides, at.edge)
  return { poly: polygonAt(def.sides, center, rotation), center, rotation }
}

export function canPlace(
  st: Station,
  defId: string,
  at: FreeEdge,
  ignoreUid?: string,
): PlacementError | null {
  if (ignoreUid === undefined && usedSlots(st) >= st.slots) return 'no_slots'

  const { poly } = previewPolygon(defId, at)
  for (const m of allModules(st)) {
    if (m.uid === ignoreUid) continue
    if (polygonsOverlap(poly, m.poly)) return 'overlap'
  }
  return null
}

/** Platziert eine Instanz aus dem Inventar. Ruft KEINE Pruefung auf — vorher `canPlace`. */
export function place(st: Station, uid: string, at: FreeEdge): PlacementError | null {
  const idx = st.inventory.findIndex(t => t.uid === uid)
  if (idx < 0) return 'not_owned'
  const inst = st.inventory[idx]!

  const err = canPlace(st, inst.defId, at)
  if (err) return err

  const { poly, center, rotation } = previewPolygon(inst.defId, at)
  inst.placement = { center, rotation }
  inst.poly = poly
  st.inventory.splice(idx, 1)
  st.placed.push(inst)
  return null
}

// --- Nachbarschaft und Zusammenhang ---------------------------------------

/**
 * Wer teilt mit wem eine Kante. Nur ganze gemeinsame Kanten zaehlen — Module, die sich
 * bloss in einer Ecke beruehren, sind KEINE Nachbarn (praegt spaeter das Buff-System).
 */
export function adjacency(st: Station, excludeUid?: string): Map<string, string[]> {
  const mods = allModules(st).filter(m => m.uid !== excludeUid)
  const cache = mods.map(m => ({ uid: m.uid, edges: edgesOf(m.poly) }))
  const map = new Map<string, string[]>(mods.map(m => [m.uid, []]))

  for (let i = 0; i < cache.length; i++) {
    for (let j = i + 1; j < cache.length; j++) {
      const a = cache[i]!
      const b = cache[j]!
      if (a.edges.some(ea => b.edges.some(eb => sameEdge(ea, eb)))) {
        map.get(a.uid)!.push(b.uid)
        map.get(b.uid)!.push(a.uid)
      }
    }
  }
  return map
}

/** Kantennachbarn eines Moduls — Grundlage des Buff-Systems (ab M5). */
export function neighbors(st: Station, uid: string): TowerInstance[] {
  const ids = adjacency(st).get(uid) ?? []
  return ids.map(id => findModule(st, id)!).filter(Boolean)
}

/**
 * Module, die ohne `withoutUid` keine Kantenverbindung mehr zum Hauptturm haetten.
 * Breitensuche ab dem Hauptturm — bei <= 20 Modulen vernachlaessigbar teuer.
 */
export function detached(st: Station, withoutUid?: string): TowerInstance[] {
  const adj = adjacency(st, withoutUid)
  const seen = new Set<string>([st.core.uid])
  const queue = [st.core.uid]

  while (queue.length) {
    for (const next of adj.get(queue.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return st.placed.filter(m => m.uid !== withoutUid && !seen.has(m.uid))
}

export const isConnected = (st: Station, withoutUid?: string): boolean =>
  detached(st, withoutUid).length === 0

// --- Entfernen -------------------------------------------------------------

export function canRemove(st: Station, uid: string, rule: RemovalRule): RemoveError | null {
  if (uid === st.core.uid) return 'is_core'
  if (!st.placed.some(m => m.uid === uid)) return 'not_placed'
  if (rule === 'block' && !isConnected(st, uid)) return 'would_disconnect'
  return null
}

/**
 * Entfernt ein Modul und gibt alle Module zurueck, die dabei ins Inventar gewandert sind —
 * bei Variante 'return' also inklusive der abgetrennten Inseln. Vorher `canRemove` pruefen.
 */
export function remove(st: Station, uid: string, rule: RemovalRule): TowerInstance[] {
  const target = st.placed.find(m => m.uid === uid)
  if (!target) return []

  const moved = [target, ...(rule === 'return' ? detached(st, uid) : [])]
  const ids = new Set(moved.map(m => m.uid))
  st.placed = st.placed.filter(m => !ids.has(m.uid))

  for (const m of moved) {
    m.placement = null
    m.poly = []
    st.inventory.push(m)
  }
  return moved
}

// --- Verschieben -----------------------------------------------------------

export type MoveError = ActionError

/**
 * Ein Zug ist kein Abriss: Der Rest der Station muss auch ohne das bewegte Modul
 * zusammenhaengen — unabhaengig von der Entfern-Regel. Wer ein Brueckenmodul umsetzen will,
 * entfernt es bewusst und baut neu.
 */
export function canMove(st: Station, uid: string, to: FreeEdge): MoveError | null {
  const inst = st.placed.find(m => m.uid === uid)
  if (!inst) return uid === st.core.uid ? 'is_core' : 'not_placed'
  if (!isConnected(st, uid)) return 'would_disconnect'
  return canPlace(st, inst.defId, to, uid)
}

/** Setzt ein platziertes Modul an eine andere Kante um. Vorher `canMove` pruefen. */
export function move(st: Station, uid: string, to: FreeEdge): void {
  const inst = st.placed.find(m => m.uid === uid)
  if (!inst) return
  const { poly, center, rotation } = previewPolygon(inst.defId, to)
  inst.placement = { center, rotation }
  inst.poly = poly
}

