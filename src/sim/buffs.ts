/**
 * Buff-System (GDD 03 Abschnitt 9).
 *
 * Nachbarschaft entsteht ausschliesslich ueber **geteilte Kanten**. Module, die sich nur
 * in einer Ecke beruehren, verstaerken sich nicht - sonst waere die Regel am Bild nicht
 * ablesbar, denn dann fehlt auch die Buff-Linie.
 *
 * Ablauf: Nachbarschaft bestimmen, Boni je Wert **addieren**, danach **deckeln**.
 * Additiv, weil multiplikatives Stapeln die Obergrenze wirkungslos macht und explodiert,
 * sobald mehrere Buff-Tuerme an einem Modul haengen.
 *
 * Bewusst **vollstaendige Neuberechnung** bei jeder Aenderung: kein Cache, keine
 * Invalidierung. Am Prototyp gemessen 0,29 ms bei 21 Modulen, und sie laeuft nur bei
 * Aenderungen, nicht pro Bild. Inkrementelle Buff-Updates sind eine klassische Fehlerquelle.
 */

import { BUFF_CAPS, RARITY_MULT } from '../data/balance.ts'
import { coreById } from '../data/cores.ts'
import { isKnownTrait, traitById } from '../data/traits.ts'
import { towerById } from '../data/towers.ts'
import { STAT_KEYS, type Category, type StatKey } from '../data/types.ts'
import { adjacency, stationModules, type PlacedModule, type Station } from './station.ts'

/**
 * Zuschlag auf die Buffstaerke aus den Eigenschaften dieses Moduls (GDD 06 Abschnitt 10).
 *
 * Ein Verstaerker hat keine eigenen Kampfwerte - eine Eigenschaft "+20 % Schaden" waere bei
 * ihm wirkungslos. Deshalb tragen Verstaerker eigene Eigenschaften, und die wirken hier.
 */
function buffPowerOf(module: PlacedModule): number {
  let total = 0
  for (const id of module.traits) {
    if (!isKnownTrait(id)) continue
    const effect = traitById(id).effect
    if (effect.kind === 'buffPower') total += effect.amount
  }
  return total
}

export type BuffSource = {
  fromUid: string
  /** Name der Quelle - fuer "Basis -> effektiv mit Quelle" im Detailfenster. */
  fromName: string
  stat: StatKey
  amount: number
}

export type BuffResult = {
  uid: string
  /** Aufsummierte Boni **vor** dem Deckel. */
  raw: Partial<Record<StatKey, number>>
  /** Tatsaechlich wirksame Boni **nach** dem Deckel. */
  applied: Partial<Record<StatKey, number>>
  /** Werte, die am Deckel haengen - die Anzeige soll das zeigen. */
  capped: StatKey[]
  sources: BuffSource[]
  /** Kantennachbarn insgesamt. */
  neighborCount: number
  /** Wie viele Kanten das Modul hat - "Nachbarn n/m" im Detailfenster. */
  edgeCount: number
  /** Nur bei Buff-Modulen: wie viele Module es gerade tatsaechlich verstaerkt. */
  boosted: number
}

/** Der Hauptturm ist ein ganz normales Kampfmodul - er wird gebufft, bufft aber nicht. */
export function categoryOf(module: PlacedModule): Category {
  return module.kind === 'core' ? 'attack' : towerById(module.defId).category
}

export function displayName(module: PlacedModule): string {
  return module.kind === 'core' ? coreById(module.defId).name : towerById(module.defId).name
}

export function computeBuffs(station: Station): Map<string, BuffResult> {
  const modules = stationModules(station)
  const adj = adjacency(station)
  const results = new Map<string, BuffResult>()

  for (const module of modules) {
    results.set(module.uid, {
      uid: module.uid,
      raw: {},
      applied: {},
      capped: [],
      sources: [],
      neighborCount: (adj.get(module.uid) ?? []).length,
      edgeCount: module.sides,
      boosted: 0,
    })
  }

  // Buff-Module wirken auf ihre Kantennachbarn - aber nie auf andere Buff-Module.
  for (const module of modules) {
    if (categoryOf(module) !== 'buff') continue
    const def = towerById(module.defId)
    if (!def.buffs) continue

    // Buff-Module haben keine eigenen Kampfwerte. Ohne diese Regel waeren Raritaet und
    // Eigenschaften bei ihnen wirkungslos - deshalb wirken beide hier auf die Buffstaerke.
    // Die Raritaet als Faktor, die Eigenschaften additiv obendrauf: dieselbe Ordnung wie
    // bei Kampfwerten, wo die Raritaet die Grundwerte skaliert und alles Weitere aufsetzt.
    const strength =
      (module.rarity ? RARITY_MULT[module.rarity] : 1) * (1 + buffPowerOf(module))
    let boosted = 0

    for (const targetUid of adj.get(module.uid) ?? []) {
      const target = modules.find((m) => m.uid === targetUid)
      if (!target || categoryOf(target) === 'buff') continue

      const result = results.get(targetUid)
      if (!result) continue

      boosted += 1
      for (const buff of def.buffs) {
        const amount = buff.amount * strength
        result.raw[buff.stat] = (result.raw[buff.stat] ?? 0) + amount
        result.sources.push({
          fromUid: module.uid,
          fromName: def.name,
          stat: buff.stat,
          amount,
        })
      }
    }

    const own = results.get(module.uid)
    if (own) own.boosted = boosted
  }

  // Erst jetzt deckeln - die Obergrenze greift auf die Summe, nicht auf jede Quelle.
  for (const result of results.values()) {
    for (const key of STAT_KEYS) {
      const sum = result.raw[key]
      if (sum === undefined) continue
      const cap = BUFF_CAPS[key]
      const applied = Math.min(sum, cap)
      result.applied[key] = applied
      if (sum > cap + 1e-9) result.capped.push(key)
    }
  }

  return results
}

/** Verbindungen Buff-Modul -> verstaerktes Modul, je Paar nur einmal. Fuer die Buff-Linien. */
export function buffLinks(results: Map<string, BuffResult>): { from: string; to: string }[] {
  const seen = new Set<string>()
  const links: { from: string; to: string }[] = []

  for (const result of results.values()) {
    for (const source of result.sources) {
      const key = `${source.fromUid}>${result.uid}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ from: source.fromUid, to: result.uid })
    }
  }
  return links
}
