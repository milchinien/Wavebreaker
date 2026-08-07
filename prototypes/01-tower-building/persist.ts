/**
 * Persistenz. Zweck ist nicht das Speichern selbst, sondern der Nachweis, dass das Datenmodell
 * serialisierbar ist — das Speicherformat des Spiels wird davon abgeleitet (GDD 16 §8).
 *
 * Gespeichert werden Weltkoordinaten, bewusst gerundet: Beim Laden werden die Polygone neu
 * erzeugt, und die Kantenerkennung arbeitet mit einer Toleranz von SIDE * 1e-3 = 0,056.
 * Drei Nachkommastellen liegen weit darunter — der Rundungsfehler kann keine gemeinsame
 * Kante zerreissen.
 */
import { polygonAt, SIDE } from './geometry'
import { defOf, makeInstance, RARITY_COLOR } from './catalog'
import type { Rarity, Station, TowerInstance } from './model'
import { createStation } from './station'

const KEY = 'proto:01-tower-building:layout'
const VERSION = 1

type SavedPlaced = { defId: string; rarity: Rarity; cx: number; cy: number; rot: number }
type SavedStock = { defId: string; rarity: Rarity }

export type Saved = {
  v: number
  slots: number
  placed: SavedPlaced[]
  inventory: SavedStock[]
}

const round = (n: number): number => Math.round(n * 1000) / 1000

export function serialize(st: Station): Saved {
  return {
    v: VERSION,
    slots: st.slots,
    placed: st.placed.map(m => ({
      defId: m.defId,
      rarity: m.rarity,
      cx: round(m.placement!.center.x),
      cy: round(m.placement!.center.y),
      rot: round(m.placement!.rotation),
    })),
    inventory: st.inventory.map(m => ({ defId: m.defId, rarity: m.rarity })),
  }
}

const isRarity = (v: unknown): v is Rarity => typeof v === 'string' && v in RARITY_COLOR

/** Gibt `null` zurueck, statt bei kaputten Daten zu stuerzen. */
export function deserialize(data: unknown): Station | null {
  try {
    const d = data as Saved
    if (!d || d.v !== VERSION) return null
    if (!Array.isArray(d.placed) || !Array.isArray(d.inventory)) return null
    if (typeof d.slots !== 'number' || !Number.isFinite(d.slots)) return null

    const st = createStation(d.slots)
    st.inventory = []

    for (const s of d.inventory) {
      defOf(s.defId)
      if (!isRarity(s.rarity)) return null
      st.inventory.push(makeInstance(s.defId, s.rarity))
    }

    const placed: TowerInstance[] = []
    for (const s of d.placed) {
      const def = defOf(s.defId)
      if (!isRarity(s.rarity)) return null
      if (![s.cx, s.cy, s.rot].every(Number.isFinite)) return null
      // Grober Plausibilitaetsrahmen: eine Station waechst nicht beliebig weit vom Kern weg
      if (Math.hypot(s.cx, s.cy) > SIDE * 200) return null

      const inst = makeInstance(s.defId, s.rarity)
      inst.placement = { center: { x: s.cx, y: s.cy }, rotation: s.rot }
      inst.poly = polygonAt(def.sides, inst.placement.center, inst.placement.rotation)
      placed.push(inst)
    }
    st.placed = placed
    return st
  } catch {
    return null
  }
}

export function save(st: Station): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(st)))
  } catch {
    /* Speicher voll oder gesperrt — im Prototyp bewusst folgenlos */
  }
}

export function load(): Station | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? deserialize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* egal */
  }
}
