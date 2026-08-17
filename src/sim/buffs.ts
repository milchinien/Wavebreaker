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
  /**
   * Fester Schadenszuschlag aus der Nachbarschaft (`Relay`).
   *
   * Er steht **neben** `applied` und nicht darin, weil er anders wirkt: `applied` sind
   * Anteile und werden multipliziert, dies ist ein Betrag und wird addiert - und zwar
   * **vor** den Anteilen, wie ueberall sonst in der Kette. Ohne das eigene Feld muesste
   * `applyBuffs` raten, was eine Zahl bedeutet.
   *
   * Er kommt nicht vom Verstaerker, sondern von **jedem** Support-Modul: Schildgenerator und
   * Drohnenbucht geben ihn ebenso. Genau das macht `Relay` zu einem Upgrade, das die
   * Bauform belohnt statt eines Turms.
   */
  flatDamage: number
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

/**
 * Was der Upgrade-Katalog zu den Buffs beitraegt (`docs/upgrade-umbau.md` Abschnitt 9.3).
 *
 * Bewusst ein **schmaler Satz Zahlen** und nicht der `GameState`: Diese Datei rechnet
 * Geometrie und hat mit einem laufenden Run nichts zu tun. Die Selbsttests bauen Stationen
 * ohne Spielstand, und das soll so bleiben - wer hier den ganzen Zustand hereinreicht, macht
 * aus einer Geometriefunktion eine Spielfunktion.
 */
export type BuffContext = {
  /** `Choir`: Zuschlag auf die Staerke jedes Verstaerkers, additiv zu seinen Eigenschaften. */
  power: number
  /** `Wide Chorus`: Verstaerker erreichen auch die Nachbarn ihrer Nachbarn. */
  wide: boolean
  /** `Relay`: fester Schaden, den jedes Support-Modul jedem Nachbar-Turret gibt. */
  relay: number
}

const NO_CONTEXT: BuffContext = { power: 0, wide: false, relay: 0 }

/**
 * Wen ein Verstaerker erreicht.
 *
 * Ohne `Wide Chorus` sind das seine Kantennachbarn - die Regel aus GDD 03 Abschnitt 9, an
 * der sich die ganze Bauform entscheidet. Mit dem Directive kommen deren Nachbarn dazu,
 * aber **nicht weiter**: Eine Reichweite, die sich durch die ganze Station fortsetzt, waere
 * am Bild nicht mehr ablesbar, und die Bauform verloere ihren Sinn.
 */
function reachOf(adj: Map<string, string[]>, uid: string, wide: boolean): string[] {
  const direct = adj.get(uid) ?? []
  if (!wide) return direct

  const reached = new Set(direct)
  for (const neighbour of direct) {
    for (const second of adj.get(neighbour) ?? []) {
      if (second !== uid) reached.add(second)
    }
  }
  return [...reached]
}

export function computeBuffs(
  station: Station,
  ctx: BuffContext = NO_CONTEXT,
): Map<string, BuffResult> {
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
      flatDamage: 0,
    })
  }

  /*
   * `Relay` (`data/upgrades.ts`): Jedes **Support-Modul** gibt jedem Kantennachbarn, der
   * kein Support-Modul ist, festen Schaden.
   *
   * Es laeuft ueber die Kategorie und nicht ueber die Turmklasse: Gefragt ist, was auf dem
   * Feld steht und nicht schiesst - Verstaerker, Schildgenerator, Drohnenbucht. Genau
   * dieselbe Abgrenzung benutzt der Buff selbst eine Schleife weiter unten.
   */
  if (ctx.relay > 0) {
    for (const module of modules) {
      const category = categoryOf(module)
      if (category !== 'buff' && category !== 'support') continue
      for (const targetUid of adj.get(module.uid) ?? []) {
        const target = modules.find((m) => m.uid === targetUid)
        if (!target || categoryOf(target) === 'buff' || categoryOf(target) === 'support') continue
        const result = results.get(targetUid)
        if (result) result.flatDamage += ctx.relay
      }
    }
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
      (module.rarity ? RARITY_MULT[module.rarity] : 1) * (1 + buffPowerOf(module) + ctx.power)
    let boosted = 0

    for (const targetUid of reachOf(adj, module.uid, ctx.wide)) {
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
