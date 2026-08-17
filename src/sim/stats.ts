/**
 * Endwerte aus Basis x Raritaet x Upgrades x Perks x Buffs.
 *
 * Die eine Stelle, an der Kampfwerte entstehen. Jede Quelle haengt sich an dieselbe Kette,
 * und die Reihenfolge folgt der **Dauer**: Je kurzfristiger eine Quelle wirkt, desto spaeter
 * setzt sie auf.
 *
 *   Grundwert x Raritaet x Eigenschaften
 *     + flache Upgrades
 *     x (1 + prozentuale Upgrades + Perks + Prestige)
 *     x (1 + Faehigkeiten) x (1 + Ereignisse)
 *     x (1 + Buffs)
 *
 * **Flach vor Prozent** ist die wichtigste Zeile dieser Datei. Andernfalls waeren die
 * endlosen Ein-Punkt-Upgrades des Katalogs im Spaetspiel wertlos; so sind sie die Grundlage,
 * die alles andere vervielfacht. Ein Spieler, der zwanzig Stufen `Hammerfall` gekauft hat,
 * bekommt von `Overclock` mehr als einer, der es nicht hat - und genau diese Verzahnung ueber
 * die Fenster hinweg ist der Zweck des Katalogs (`docs/upgrade-umbau.md`).
 *
 * **Ein flacher Zuschlag trifft nie einen Wert, der null ist.** Ein Schildgenerator und ein
 * Verstaerker haben `NO_STATS`; ohne diese Regel machte `Vanguard` aus ihnen Geschuetze, weil
 * es auf **alle** Turrets wirkt. Null mal einem Aufschlag bleibt null - null **plus** einem
 * Aufschlag nicht, und darin liegt der Unterschied zur vorherigen Fassung.
 *
 * Gelesen werden nur die **gekauften** Pfade (`state.run.upgrades`), nicht der ganze Katalog:
 * Diese Funktionen laufen je Turm und Takt, und frueh im Run stehen dort drei Eintraege statt
 * sechzig. Unbekannte Pfade aus alten Spielstaenden fallen dabei von selbst heraus.
 */

import {
  BASE_STATION_HP,
  GLOBAL_DAMAGE_SCALE,
  GLOBAL_RATE_SCALE,
  RARITY_MULT,
} from '../data/balance.ts'
import { coreById } from '../data/cores.ts'
import { towerById } from '../data/towers.ts'
import type { PerkGlobal } from '../data/perks.ts'
import { isKnownTrait, traitById } from '../data/traits.ts'
import {
  globalSum,
  isKnownUpgrade,
  levelOf,
  ruleActive,
  specialSum,
  upgradeById,
  type GlobalKey,
  type RuleId,
  type SpecialKey,
  type UpgradeTarget,
} from '../data/upgrades.ts'
import { STAT_KEYS, type CombatStats, type Rarity, type StatKey } from '../data/types.ts'
import type { GameState } from '../app/state.ts'
import type { BuffResult } from './buffs.ts'
import { overdriveBonus } from './overdrive.ts'
import { prestigeGlobalBonus } from './prestige.ts'
import { perkGlobalBonus, perkStatBonus } from './progression.ts'
import { CORE_UID, type PlacedModule } from './station.ts'

/**
 * Grundwerte eines Moduls samt Seltenheitsfaktor.
 *
 * Hier greifen auch die beiden globalen Faktoren auf Schaden und Feuerrate
 * (`data/balance.ts`). Sie sitzen bewusst **hier** und nicht in `data/towers.ts`: Diese
 * Funktion ist die eine Stelle, durch die jedes Modul laeuft - Kern wie Turm, und jeder
 * Turm, der noch dazukommt. Wer stattdessen die Grundwerte in der Turmtabelle senkt,
 * verschiebt das Verhaeltnis der Tuerme zueinander und muss es bei jedem neuen Turm von
 * Hand wieder treffen.
 */
export function baseStats(defId: string, kind: 'core' | 'tower', rarity: Rarity | null): CombatStats {
  const stats = kind === 'core' ? coreById(defId).stats : towerById(defId).stats
  // Der Hauptturm hat keine Raritaet (GDD 04 Abschnitt 2), also auch keinen Faktor.
  const multiplier = rarity ? RARITY_MULT[rarity] : 1

  const result = {} as CombatStats
  for (const key of STAT_KEYS) result[key] = stats[key] * multiplier
  result.damage *= GLOBAL_DAMAGE_SCALE
  result.attackSpeed *= GLOBAL_RATE_SCALE
  return result
}

export type UpgradeLevels = Record<string, number>

/**
 * Stand eines Upgrade-Pfads. Unbekannte Pfade zaehlen als Stufe 0.
 *
 * Die Rechnung selbst steht in `data/upgrades.ts` - dort, wo auch der Katalog liegt. Hier
 * steht nur der Name, unter dem sie seit E8 im ganzen Spiel bekannt ist.
 */
export { levelOf as upgradeLevel } from '../data/upgrades.ts'

// ---------------------------------------------------------------------------
// Der Zugriff auf den Katalog
// ---------------------------------------------------------------------------

/*
 * Drei duenne Huellen um `data/upgrades.ts`. Sie packen den Spielzustand aus und sonst
 * nichts - die Rechnung liegt beim Katalog, damit auch `sim/prestige.ts` sie benutzen kann,
 * ohne dass sich die beiden Dateien gegenseitig importieren.
 */

/**
 * Gilt diese Regel? **Die** Abfrage fuer alle Directives.
 *
 * Im Kampfcode steht kein `if (upgradeLevel(state.run.upgrades, 'f1.twinbarrel') > 0)`,
 * sondern `hasRule(state, 'twinBarrel')` - dieselbe Bauweise wie `isUnlocked` beim
 * Prestige-Baum (GDD 16 Abschnitt 2). Wer ein Directive an einen anderen Platz legt oder
 * umbenennt, aendert damit keine einzige Zeile im Kampf.
 */
export function hasRule(state: GameState, id: RuleId): boolean {
  return ruleActive(state.run.upgrades, id)
}

/**
 * Summe eines Sonderwerts ueber alle Pfade, die darauf einzahlen.
 *
 * Meist ist das genau einer. `overdrivePower` hat zwei - `Runaway` in Fenster 2 und
 * `Warlord` in Fenster 3 -, und sie addieren sich. Das ist Absicht: Ein Wert, auf den zwei
 * Fenster einzahlen, verbindet sie.
 */
export function specialValue(state: GameState, key: SpecialKey): number {
  return specialSum(state.run.upgrades, key)
}

/** Summe einer Run-Groesse ueber alle Pfade, die darauf einzahlen. */
export function globalValue(state: GameState, key: GlobalKey): number {
  return globalSum(state.run.upgrades, key)
}

/** Die vier Groessen, an denen auch Perks und der Prestige-Baum drehen. */
const PERK_GLOBALS: readonly PerkGlobal[] = ['stationHp', 'goldBonus', 'collectRadius', 'xpBonus']

function isPerkGlobal(key: GlobalKey): key is PerkGlobal {
  return (PERK_GLOBALS as readonly string[]).includes(key)
}

/**
 * Wirkung auf eine Groesse des Runs als **Faktor** - 1 bedeutet "keine Wirkung".
 *
 * Hier laufen alle drei Quellen zusammen: gekaufte Upgrades, gewaehlte Perks und der
 * Prestige-Baum. Perks und Baum kennen nur die vier Groessen aus `PERK_GLOBALS`; alles
 * andere im Katalog ist ein Zaehlwert und laeuft ueber `globalValue`.
 */
export function globalMultiplier(state: GameState, key: GlobalKey): number {
  const fromUpgrades = globalValue(state, key)
  if (!isPerkGlobal(key)) return 1 + fromUpgrades
  return 1 + fromUpgrades + perkGlobalBonus(state, key) + prestigeGlobalBonus(state, key)
}

// ---------------------------------------------------------------------------
// Upgrades auf ein Modul anwenden
// ---------------------------------------------------------------------------

/** Trifft dieses Ziel dieses Modul? Der eine Ort, an dem ein Ziel entschieden wird. */
function hits(target: UpgradeTarget, module: PlacedModule): boolean {
  switch (target.kind) {
    // Alles, was schiesst - das Ziel der Perks (GDD 09 Abschnitt 4).
    case 'modules':
      return true
    case 'core':
      return module.kind === 'core'
    case 'turrets':
      return module.kind === 'tower'
    case 'class':
      return module.kind === 'tower' && towerById(module.defId).class === target.class
    case 'towers':
      return module.kind === 'tower' && target.ids.includes(module.defId)
    // Die Station ist kein Modul - ihre Groessen laufen ueber `globalValue`.
    case 'station':
      return false
  }
}

type Sums = Partial<Record<StatKey, number>>

function add(sums: Sums, key: StatKey, amount: number): void {
  sums[key] = (sums[key] ?? 0) + amount
}

/**
 * Die beiden Doktrinen aus Fenster 3 (`docs/upgrade-umbau.md` Abschnitt 5.3).
 *
 * Sie stehen hier und nicht bei den Prozent-Upgrades, weil sie **zwei** Klassen zugleich
 * anfassen - die eine hoch, die andere herunter. Als Datensatz waeren das zwei Effekte an
 * einem Upgrade, und die Union kennt bewusst nur einen: Ein Upgrade, das an zwei Stellen
 * zieht, ist eine Regel und keine Zahl.
 *
 * Sie schliessen einander aus (`excludes` im Katalog), es kann also nie beides gelten.
 */
function doctrineBonus(state: GameState, module: PlacedModule): number {
  if (module.kind !== 'tower') return 0
  const towerClass = towerById(module.defId).class
  if (towerClass === 'support') return 0

  if (hasRule(state, 'ironDoctrine')) return towerClass === 'kinetic' ? 0.4 : -0.15
  if (hasRule(state, 'stormDoctrine')) return towerClass === 'elemental' ? 0.4 : -0.15
  return 0
}

/**
 * Gekaufte Upgrades anwenden.
 *
 * Drei Dinge passieren hier, die frueher nicht noetig waren:
 *
 *   1. **Flach und prozentual werden getrennt gesammelt** und in dieser Reihenfolge
 *      angewandt (siehe Kopf).
 *   2. **`Vanguard`** gibt jedem Turret ein Viertel dessen, was der Kern an flachen
 *      Zuschlaegen bekommen hat. Deshalb werden die Kern-Betraege auch dann mitgezaehlt,
 *      wenn gerade ein Turret gerechnet wird.
 *   3. **`Crown`** dreht die Richtung um: Jedes gebaute Turret gibt dem Kern Schaden. Das
 *      ist der einzige Zuschlag, der von der Groesse der Station abhaengt.
 */
export function applyUpgrades(
  base: CombatStats,
  module: PlacedModule,
  state: GameState,
): CombatStats {
  const flat: Sums = {}
  const percent: Sums = {}
  /** Was der Kern an flachen Zuschlaegen bekommt - nur fuer `Vanguard`. */
  const coreFlat: Sums = {}
  const isTurret = module.kind === 'tower'

  for (const path of Object.keys(state.run.upgrades)) {
    if (!isKnownUpgrade(path)) continue
    const level = levelOf(state.run.upgrades, path)
    if (level === 0) continue

    const effect = upgradeById(path).effect
    if (effect.kind === 'flat') {
      if (hits(effect.target, module)) add(flat, effect.stat, effect.amount * level)
      if (isTurret && effect.target.kind === 'core') {
        add(coreFlat, effect.stat, effect.amount * level)
      }
    } else if (effect.kind === 'percent' && hits(effect.target, module)) {
      add(percent, effect.stat, effect.amount * level)
    }
  }

  if (isTurret && hasRule(state, 'vanguard')) {
    for (const key of STAT_KEYS) {
      const shared = coreFlat[key]
      if (shared !== undefined) add(flat, key, shared * 0.25)
    }
  }

  if (module.kind === 'core') {
    const perTurret = specialValue(state, 'coreDamagePerTurret')
    if (perTurret > 0) add(flat, 'damage', perTurret * state.run.station.placed.length)
  }

  const doctrine = doctrineBonus(state, module)
  if (doctrine !== 0) add(percent, 'damage', doctrine)

  const result = { ...base }
  for (const key of STAT_KEYS) {
    // Ein flacher Zuschlag auf einen Wert, den das Modul gar nicht hat, machte aus einem
    // Schildgenerator ein Geschuetz. Prozente haben das Problem nicht - null mal etwas
    // bleibt null -, deshalb steht die Bedingung nur hier.
    const bonus = base[key] > 0 ? (flat[key] ?? 0) : 0
    result[key] = (base[key] + bonus) * (1 + (percent[key] ?? 0))
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

  const bonus: Sums = {}
  for (const id of module.traits) {
    if (!isKnownTrait(id)) continue
    const effect = traitById(id).effect
    // Additiv wie ueberall sonst: Zwei Eigenschaften zu je zehn Prozent sind zwanzig,
    // nicht einundzwanzig.
    if (effect.kind === 'stat') add(bonus, effect.stat, effect.amount)
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
 * Quelle stapeln Boni additiv, zwischen zwei Quellen multiplikativ - so wie Buffs auf
 * Upgrades aufsetzen.
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

/**
 * Buffs anwenden: Endwert = (Wert + fester Zuschlag) x (1 + gedeckelte Summe).
 *
 * Flach vor Prozent, wie in der ganzen Kette. Der feste Zuschlag kommt von `Relay` und
 * trifft - wie jeder flache Zuschlag - keinen Wert, den das Modul gar nicht hat: Ein
 * Support-Modul neben einem Support-Modul bekommt nichts, und ein Schildgenerator faengt
 * durch einen Nachbarn nicht an zu schiessen.
 */
export function applyBuffs(base: CombatStats, buffs: BuffResult | undefined): CombatStats {
  const result = { ...base }
  if (!buffs) return result

  if (buffs.flatDamage > 0 && base.damage > 0) result.damage = base.damage + buffs.flatDamage

  for (const key of STAT_KEYS) {
    const bonus = buffs.applied[key]
    if (bonus !== undefined) result[key] = result[key] * (1 + bonus)
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
    ? applyTimed(applyPerks(applyUpgrades(base, module, state), state), state)
    : base
  const buffed = applyBuffs(upgraded, buffs)
  return { base, upgraded, final: state ? applyOverdrive(buffed, module, state) : buffed }
}

/**
 * Overdrive - die **letzte** Schicht der Kette (`sim/overdrive.ts`).
 *
 * Sie sitzt ganz am Ende, und zwar aus derselben Regel, die diese Datei durchzieht: Je
 * kurzfristiger eine Quelle wirkt, desto spaeter setzt sie auf. Vier Sekunden sind das
 * Kuerzeste, was es im Spiel gibt.
 *
 * Sie steht **nicht** in `applyTimed` bei den Faehigkeiten und Ereignissen, obwohl sie
 * ebenso zeitlich begrenzt ist: Die beiden liegen als fertige Zahl fuer die ganze Station in
 * `runtime.combat`, Overdrive gilt je Modul. Nur hier ist bekannt, um welches es geht.
 */
function applyOverdrive(
  base: CombatStats,
  module: PlacedModule,
  state: GameState,
): CombatStats {
  const bonus = overdriveBonus(state, module.uid)
  if (bonus === 0) return base

  // Auf Schaden **und** Feuerrate: Ein Turm im Overdrive soll anders klingen und anders
  // aussehen, nicht nur haerter rechnen.
  const result = { ...base }
  result.damage = base.damage * (1 + bonus)
  result.attackSpeed = base.attackSpeed * (1 + bonus)
  return result
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
 * Die gemeinsame Lebensleiste der Station (GDD 03 Abschnitt 5).
 *
 * Vier Quellen laufen hier zusammen, und die Reihenfolge ist dieselbe wie bei den
 * Kampfwerten - erst alles Flache, dann der Faktor:
 *
 *   Grundwert + Schildgeneratoren + `Bulkhead` + `Pack Mule` je Turret,
 *   das Ganze mal `Bastion`, Perks und Prestige.
 *
 * Dass die flachen Zuschlaege **vor** dem Faktor stehen, ist derselbe Gedanke wie oben: Ein
 * spaeter gekaufter Faktor soll belohnen, was vorher aufgebaut wurde.
 */
export function maxStationHp(state: GameState): number {
  const flat =
    BASE_STATION_HP +
    hullFromModules(state) +
    globalValue(state, 'hullFlat') +
    globalValue(state, 'hullPerTurret') * state.run.station.placed.length
  return Math.round(flat * globalMultiplier(state, 'stationHp'))
}

/**
 * Zuschlag der Schildgeneratoren (GDD 05: Schildgenerator, GDD 03 Abschnitt 5).
 *
 * Sie sind der einzige Turm, der nicht schiesst: Ihr Beitrag ist die gemeinsame Huelle.
 * `Aegis` aus Fenster 2 haengt sich hier an und nicht an den Faktor - es ist ein Zuschlag
 * **je Generator**, gilt also nur, wenn auch einer gebaut ist.
 *
 * Gelesen wird aus dem Kampfzustand, weil dort die Geometrie dieses Takts liegt. Vor dem
 * ersten Takt gibt es keine Module und damit keinen Zuschlag.
 */
function hullFromModules(state: GameState): number {
  const perShield = specialValue(state, 'hullPerShield')
  let total = 0
  for (const module of state.runtime.combat.modules) {
    if (module.kind !== 'tower') continue
    const mechanic = towerById(module.defId).mechanic
    if (mechanic?.kind !== 'hull') continue
    // Die Raritaet wirkt auch hier - sonst waere sie bei diesem Turm das Einzige ohne
    // Wirkung, genau wie beim Verstaerker (siehe `sim/buffs.ts`).
    total += (mechanic.amount + perShield) * (module.rarity ? RARITY_MULT[module.rarity] : 1)
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
