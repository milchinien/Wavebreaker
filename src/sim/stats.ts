/**
 * Endwerte aus Basis x Raritaet x Buffs.
 *
 * Die eine Stelle, an der Kampfwerte entstehen. Der Plan sieht diese Datei erst fuer E5
 * vor - sie kommt hier frueher, weil die Basisansicht in E3 bereits "Basis -> effektiv"
 * anzeigen muss. Was fehlt, kommt spaeter dazu, ohne dass sich hier etwas verschiebt:
 * Upgrades (E8), Perks (E10) und Prestige (E13) haengen sich als weitere Faktoren an
 * dieselbe Kette.
 *
 *   Basis x Raritaet  ->  [ + Upgrades ]  ->  [ + Perks ]  ->  [ + Faehigkeiten ]  ->  x (1 + Buffs)
 *
 * Prestige haengt sich in E13 zwischen Perks und Faehigkeiten - die Reihenfolge folgt der
 * Dauer: Je kurzfristiger eine Quelle wirkt, desto spaeter setzt sie auf.
 *
 * Perks haengen seit E10 in dieser Kette - nicht als Sonderfall im Kampfcode. Das ist die
 * Abnahmebedingung der Etappe: Ein Perk-Effekt muss in `effectiveTowerStats` auftauchen,
 * sonst muesste jede Stelle, die Schaden rechnet, ihn kennen.
 */

import { BASE_STATION_HP, RARITY_MULT } from '../data/balance.ts'
import { coreById } from '../data/cores.ts'
import { towerById } from '../data/towers.ts'
import type { PerkGlobal } from '../data/perks.ts'
import { isKnownTrait, traitById } from '../data/traits.ts'
import { isKnownUpgrade, upgradeById } from '../data/upgrades.ts'
import { STAT_KEYS, type CombatStats, type Rarity, type StatKey } from '../data/types.ts'
import type { GameState } from '../app/state.ts'
import type { BuffResult } from './buffs.ts'
import { prestigeGlobalBonus } from './prestige.ts'
import { perkGlobalBonus, perkStatBonus } from './progression.ts'
import { CORE_UID, type PlacedModule } from './station.ts'

/** Grundwerte eines Moduls samt Seltenheitsfaktor. */
export function baseStats(defId: string, kind: 'core' | 'tower', rarity: Rarity | null): CombatStats {
  const stats = kind === 'core' ? coreById(defId).stats : towerById(defId).stats
  // Der Hauptturm hat keine Raritaet (GDD 04 Abschnitt 2), also auch keinen Faktor.
  const multiplier = rarity ? RARITY_MULT[rarity] : 1

  const result = {} as CombatStats
  for (const key of STAT_KEYS) result[key] = stats[key] * multiplier
  return result
}

/** Stand eines Upgrade-Pfads. Unbekannte Pfade zaehlen als Stufe 0. */
export function upgradeLevel(upgrades: UpgradeLevels, path: string): number {
  const level = upgrades[path]
  return typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0
}

export type UpgradeLevels = Record<string, number>

/**
 * Gekaufte Upgrades anwenden. Sie gelten **pro Turmtyp**, nicht pro Einzelturm
 * (GDD 08 Abschnitt 5.2) - der Pfad haengt deshalb an `defId`, nicht an `uid`.
 */
export function applyUpgrades(
  base: CombatStats,
  module: PlacedModule,
  upgrades: UpgradeLevels,
): CombatStats {
  const prefix = module.kind === 'core' ? 'core' : `tower.${module.defId}`
  const result = { ...base }

  for (const key of STAT_KEYS) {
    const level = upgradeLevel(upgrades, `${prefix}.${key}`)
    if (level === 0) continue
    const def = isKnownUpgrade(`${prefix}.${key}`) ? upgradeById(`${prefix}.${key}`) : null
    if (!def) continue
    result[key] = base[key] * (1 + def.amount * level)
  }
  return result
}

/**
 * Eigenschaften dieses **einzelnen** Turms anwenden (GDD 06 Abschnitt 10).
 *
 * Sie sitzen direkt hinter den Grundwerten und vor allem Gekauften: Eigenschaften gehoeren
 * zum Turm selbst, so wie seine Raritaet. Ein Upgrade verbessert danach, was da ist - und
 * profitiert damit von einem guten Wurf, statt ihn zu ersetzen.
 *
 * Buff-Module bekommen hier nichts ab: Ihre Eigenschaften wirken auf die Buffstaerke und
 * damit in `sim/buffs.ts`, weil sie selbst keine Kampfwerte haben.
 */
export function applyTraits(base: CombatStats, module: PlacedModule): CombatStats {
  if (module.traits.length === 0) return base

  const bonus: Partial<Record<StatKey, number>> = {}
  for (const id of module.traits) {
    if (!isKnownTrait(id)) continue
    const effect = traitById(id).effect
    // Additiv wie ueberall sonst: Zwei Eigenschaften zu je zehn Prozent sind zwanzig,
    // nicht einundzwanzig.
    if (effect.kind === 'stat') bonus[effect.stat] = (bonus[effect.stat] ?? 0) + effect.amount
  }

  const result = { ...base }
  for (const key of STAT_KEYS) {
    const amount = bonus[key]
    if (amount !== undefined && amount !== 0) result[key] = base[key] * (1 + amount)
  }
  return result
}

/**
 * Perks anwenden. Sie wirken auf **alle** Module zugleich (GDD 09 Abschnitt 4) - deshalb
 * braucht diese Funktion kein Modul, nur den Run.
 *
 * Die Summe ist additiv und ungedeckelt: Anders als Buffs kommen Perks nicht aus der
 * Bauflaeche, sondern aus dem Fortschritt des Runs. Ein Deckel darauf wuerde spaete
 * Aufstiege wertlos machen, und genau die sollen den Build tragen (GDD 09 Abschnitt 13).
 */
export function applyPerks(base: CombatStats, state: GameState): CombatStats {
  const result = { ...base }
  for (const key of STAT_KEYS) {
    const bonus = perkStatBonus(state, key)
    if (bonus !== 0) result[key] = base[key] * (1 + bonus)
  }
  return result
}

/**
 * Alles zeitlich Begrenzte anwenden: laufende Faehigkeiten (GDD 09 Teil B) und laufende
 * Ereignis-Wirkungen (GDD 11 Abschnitt 5).
 *
 * Beide Betraege kommen als fertige Zahlen aus `runtime.combat` - `sim/abilities.ts` und
 * `sim/events.ts` legen sie dort je Takt ab. Diese Datei fragt keinen von beiden, sie liest
 * nur ab; sonst entstuende ein Kreis zwischen Werten, Kampf, Faehigkeiten und Ereignissen.
 *
 * Die beiden Quellen setzen **nacheinander** auf, nicht in derselben Summe: Innerhalb einer
 * Quelle stapeln Boni additiv (zwei Faehigkeiten zu je zehn Prozent sind zwanzig), zwischen
 * zwei Quellen multiplikativ - so wie Buffs auf Upgrades aufsetzen. Getrennt gerechnet
 * bleibt auch getrennt geschrieben: Zwei Systeme, die dieselbe Zahl je Takt neu aufbauen,
 * ueberschrieben sich sonst gegenseitig.
 *
 * Sie stehen **nach** den Perks und vor den Buffs: Eine Faehigkeit ist die kurzfristigste
 * aller Quellen, und was zuletzt dazukommt, soll auf allem anderen aufsetzen.
 */
export function applyTimed(base: CombatStats, state: GameState): CombatStats {
  const combat = state.runtime.combat
  const result = { ...base }

  for (const bonus of [combat.abilityBonus, combat.eventBonus]) {
    for (const key of STAT_KEYS) {
      const amount = bonus[key]
      if (amount !== undefined && amount !== 0) result[key] = result[key] * (1 + amount)
    }
  }
  return result
}

/** Buffs anwenden: Endwert = Wert x (1 + gedeckelte Summe). */
export function applyBuffs(base: CombatStats, buffs: BuffResult | undefined): CombatStats {
  const result = { ...base }
  if (!buffs) return result

  for (const key of STAT_KEYS) {
    const bonus = buffs.applied[key]
    if (bonus !== undefined) result[key] = base[key] * (1 + bonus)
  }
  return result
}

export type ModuleStats = {
  base: CombatStats
  /** Nach Upgrades **und Perks**, vor Buffs - fuer die Anzeige "Basis -> effektiv". */
  upgraded: CombatStats
  final: CombatStats
}

/**
 * Werte eines Moduls.
 *
 * `state` ist freiwillig: Ohne ihn kommen nur Grundwerte und Buffs heraus. Das braucht
 * `theoreticalDps`, das zwei Bauvarianten **untereinander** vergleicht - dort wuerden
 * Upgrades und Perks auf beiden Seiten denselben Faktor addieren und die Aussage nicht
 * veraendern, aber die Funktion an einen Run binden, den sie gar nicht meint.
 */
export function moduleStats(
  module: PlacedModule,
  buffs: BuffResult | undefined,
  state?: GameState,
): ModuleStats {
  // Eigenschaften gehoeren zum Turm und nicht zum Run - sie gelten deshalb auch ohne
  // Zustand, etwa im Vergleich zweier Bauvarianten.
  const base = applyTraits(baseStats(module.defId, module.kind, module.rarity), module)
  const upgraded = state
    ? applyTimed(applyPerks(applyUpgrades(base, module, state.run.upgrades), state), state)
    : base
  return { base, upgraded, final: applyBuffs(upgraded, buffs) }
}

/**
 * Wirkung auf eine Groesse des Runs als Faktor - 1 bedeutet "keine Wirkung".
 *
 * Hier laufen **beide** Quellen zusammen: gekaufte globale Upgrades und gewaehlte Perks.
 * Deshalb nimmt die Funktion den ganzen Zustand statt nur der Upgrade-Liste - jede weitere
 * Quelle (Prestige in E13) haengt sich an genau dieser Stelle an und nirgends sonst.
 *
 * `xpBonus` gibt es nur als Perk und nicht als Upgrade; die Abfrage laeuft trotzdem durch
 * dieselbe Funktion, damit der Aufrufer den Unterschied nicht kennen muss.
 */
export function globalMultiplier(state: GameState, key: PerkGlobal): number {
  const path = `global.${key}`
  const fromUpgrades = isKnownUpgrade(path)
    ? upgradeById(path).amount * upgradeLevel(state.run.upgrades, path)
    : 0
  return 1 + fromUpgrades + perkGlobalBonus(state, key) + prestigeGlobalBonus(state, key)
}

/**
 * Endwerte eines Moduls im laufenden Gefecht. Liest die Geometrie und die Buffs, die der
 * Tick bereits berechnet hat - hier wird nichts neu bestimmt.
 */
export function effectiveTowerStats(state: GameState, uid: string): CombatStats | null {
  const combat = state.runtime.combat
  const module = combat.modules.find((entry) => entry.uid === uid)
  if (!module) return null
  return moduleStats(module, combat.buffs.get(uid), state).final
}

/** Abstand zwischen zwei Schuessen, in Sekunden. */
export function fireInterval(stats: CombatStats): number {
  return stats.attackSpeed > 0 ? 1 / stats.attackSpeed : Infinity
}

/**
 * Reichweite des Hauptturms - der Kreis, den der Spieler um seine Station sieht.
 *
 * Er ist die eine Reichweite, die dauerhaft angezeigt wird: Sie gehoert zum Kern, und der
 * Kern steht immer da. Reichweiten einzelner Tuerme bleiben transient (GDD 13 Abschnitt 4).
 *
 * Vor dem ersten Takt kennt die Simulation noch keine Module - dann gilt der Grundwert des
 * Kerns, damit der Kreis schon im allerersten Bild richtig steht statt aufzuspringen.
 */
export function coreRange(state: GameState): number {
  const live = effectiveTowerStats(state, CORE_UID)
  if (live) return live.range
  return coreById(state.run.station.coreId).stats.range
}

/**
 * Die gemeinsame Lebensleiste der Station (GDD 03 Abschnitt 5). Support-Module,
 * Upgrades (E8), Perks (E10) und Prestige (E13) haengen sich hier an - es bleibt
 * eine einzige Leiste.
 */
export function maxStationHp(state: GameState): number {
  return Math.round(
    (BASE_STATION_HP + hullFromModules(state)) * globalMultiplier(state, 'stationHp'),
  )
}

/**
 * Zuschlag der Schildgeneratoren (GDD 05: Schildgenerator, GDD 03 Abschnitt 5).
 *
 * Sie sind der einzige Turm, der nicht schiesst: Ihr Beitrag ist die gemeinsame Huelle.
 * Er wird **vor** dem globalen Faktor addiert, damit ein Prestige-Bonus auf Stations-HP
 * auch auf ihn wirkt - sonst waere ein Schildgenerator im spaeten Spiel wertlos.
 *
 * Gelesen wird aus dem Kampfzustand, weil dort die Geometrie dieses Takts liegt. Vor dem
 * ersten Takt gibt es keine Module und damit keinen Zuschlag - dann steht ohnehin nur der
 * Grundwert zur Debatte.
 */
function hullFromModules(state: GameState): number {
  let total = 0
  for (const module of state.runtime.combat.modules) {
    if (module.kind !== 'tower') continue
    const mechanic = towerById(module.defId).mechanic
    if (mechanic?.kind !== 'hull') continue
    // Die Raritaet wirkt auch hier - sonst waere sie bei diesem Turm das Einzige ohne
    // Wirkung, genau wie beim Verstaerker (siehe `sim/buffs.ts`).
    total += mechanic.amount * (module.rarity ? RARITY_MULT[module.rarity] : 1)
  }
  return total
}

/**
 * Vergleichszahl fuer zwei Bauvarianten, bis es echten Kampf gibt (ab E5).
 * Bewertet nur Schaden pro Sekunde - taugt fuer den **relativen** Vergleich, nicht fuer
 * die Turmauswahl (Einschraenkung aus Prototyp 01, F7).
 */
export function theoreticalDps(
  modules: readonly PlacedModule[],
  buffs: Map<string, BuffResult>,
  isBuffModule: (module: PlacedModule) => boolean,
): number {
  let total = 0
  for (const module of modules) {
    if (isBuffModule(module)) continue
    const { final } = moduleStats(module, buffs.get(module.uid))
    total += final.damage * final.attackSpeed * (1 + final.critChance * 0.5)
  }
  return total
}
