/**
 * Buff-System. Nachbarschaft entsteht ausschliesslich ueber GETEILTE KANTEN — Module, die sich
 * nur in einer Ecke beruehren, verstaerken sich nicht (GDD 03 §9).
 *
 * Bewusst vollstaendige Neuberechnung bei jeder Aenderung: kein Cache, keine Invalidierung.
 * Bei <= 20 Modulen kostet das nichts, und inkrementelle Buff-Updates sind eine der
 * klassischen Fehlerquellen.
 */
import { BASE_STATION_HP, BUFF_CAPS, defOf, RARITY_MULT } from './catalog'
import type { CombatStats, Station, StatKey, TowerDef, TowerInstance } from './model'
import { adjacency, allModules } from './station'

export const STAT_KEYS: StatKey[] = [
  'damage',
  'attackSpeed',
  'range',
  'critChance',
  'projectileSpeed',
]

export const STAT_LABEL: Record<StatKey, string> = {
  damage: 'Schaden',
  attackSpeed: 'Angriffstempo',
  range: 'Reichweite',
  critChance: 'Krit-Chance',
  projectileSpeed: 'Projektiltempo',
}

export type BuffSource = { fromUid: string; fromName: string; stat: StatKey; amount: number }

export type EffectiveTower = {
  instance: TowerInstance
  def: TowerDef
  base: CombatStats
  /** aufsummierte Boni VOR dem Deckel */
  raw: Partial<Record<StatKey, number>>
  /** tatsaechlich wirksame Boni NACH dem Deckel */
  bonuses: Partial<Record<StatKey, number>>
  /** Werte, die am Deckel haengen — fuer die Anzeige */
  capped: StatKey[]
  final: CombatStats
  sources: BuffSource[]
  neighborCount: number
  /** nur bei Buff-Modulen: wie viele Module es gerade verstaerkt */
  boosted: number
}

export type StationSummary = {
  towers: Map<string, EffectiveTower>
  stationHp: number
  theoreticalDps: number
}

export function computeStation(st: Station): StationSummary {
  const adj = adjacency(st)
  const mods = allModules(st)
  const towers = new Map<string, EffectiveTower>()

  // 1) Basiswerte aus Katalog x Raritaet
  for (const m of mods) {
    const def = defOf(m.defId)
    const mult = RARITY_MULT[m.rarity]
    const base = {} as CombatStats
    for (const k of STAT_KEYS) base[k] = def.stats[k] * mult
    towers.set(m.uid, {
      instance: m,
      def,
      base,
      raw: {},
      bonuses: {},
      capped: [],
      final: { ...base },
      sources: [],
      neighborCount: (adj.get(m.uid) ?? []).length,
      boosted: 0,
    })
  }

  // 2)–4) Buffs an Kantennachbarn verteilen. Buff-Module buffen keine Buff-Module.
  for (const m of mods) {
    const def = defOf(m.defId)
    if (def.category !== 'buff' || !def.buffs) continue

    // Bei Buff-Modulen wirkt die Raritaet auf die Buffstaerke — sie haben keine eigenen Kampfwerte.
    const strength = RARITY_MULT[m.rarity]
    let boosted = 0

    for (const targetUid of adj.get(m.uid) ?? []) {
      const target = towers.get(targetUid)!
      if (target.def.category === 'buff') continue
      boosted++
      for (const b of def.buffs) {
        const amount = b.amount * strength
        target.raw[b.stat] = (target.raw[b.stat] ?? 0) + amount
        target.sources.push({ fromUid: m.uid, fromName: def.name, stat: b.stat, amount })
      }
    }
    towers.get(m.uid)!.boosted = boosted
  }

  // 5)–6) Deckeln und anwenden. Additiv, damit der Deckel aus GDD 03 §9 ueberhaupt greifen kann.
  for (const t of towers.values()) {
    for (const k of STAT_KEYS) {
      const rawSum = t.raw[k]
      if (rawSum === undefined) continue
      const applied = Math.min(rawSum, BUFF_CAPS[k])
      t.bonuses[k] = applied
      if (rawSum > BUFF_CAPS[k] + 1e-9) t.capped.push(k)
      t.final[k] = t.base[k] * (1 + applied)
    }
  }

  // 7) Support wirkt stationsweit, ohne Nachbarschaftsbezug
  let stationHp = BASE_STATION_HP
  for (const m of mods) {
    const bonus = defOf(m.defId).stationBonus?.stationHp
    if (bonus) stationHp += bonus * RARITY_MULT[m.rarity]
  }

  // Vergleichszahl statt echtem Kampf (siehe PLAN.md, Abschnitt 5)
  let theoreticalDps = 0
  for (const t of towers.values()) {
    if (t.def.category === 'buff' || t.def.category === 'support') continue
    theoreticalDps += t.final.damage * t.final.attackSpeed * (1 + t.final.critChance * 0.5)
  }

  return { towers, stationHp, theoreticalDps }
}

/** Verbindungen Buff-Modul -> verstaerktes Modul, je Paar nur einmal (fuer die Buff-Linien). */
export function buffLinks(summary: StationSummary): { from: string; to: string }[] {
  const seen = new Set<string>()
  const links: { from: string; to: string }[] = []
  for (const t of summary.towers.values()) {
    for (const s of t.sources) {
      const key = `${s.fromUid}>${t.instance.uid}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ from: s.fromUid, to: t.instance.uid })
    }
  }
  return links
}

