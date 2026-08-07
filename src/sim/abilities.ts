/**
 * Aktive Faehigkeiten (GDD 09 Teil B).
 *
 * Drei Regeln bestimmen den Aufbau dieser Datei:
 *
 * **1. Die Abklingzeit laeuft in Simulationszeit, nicht an der Uhr.**
 * Das ist die Abnahmebedingung der Etappe: Bei Tempo x4 bekommt die Simulation viermal so
 * viele Takte je echter Sekunde, also vergeht eine Abklingzeit von 60 Sekunden in 15
 * echten. Das ist gewollt - schnelleres Spiel heisst schnellere Faehigkeiten, sonst waere
 * x4 eine Abwertung. Erreicht wird es dadurch, dass `stepAbilities` sein `dt` aus dem
 * Takt bekommt und nirgends eine Uhr befragt.
 *
 * **2. Die Wirkung wird geschrieben, nicht erfragt.**
 * Jeder Takt legt die drei abgeleiteten Zahlen in `runtime.combat` ab: Wertboni,
 * Schadensabwehr, Gegnertempo. Kampf und Werte lesen sie dort als fertige Zahlen. Wuerden
 * sie stattdessen hier nachfragen, entstuende ein Abhaengigkeitskreis zwischen
 * `combat.ts`, `stats.ts` und dieser Datei.
 *
 * **3. Sofortwirkung und Dauerwirkung sind dasselbe System.**
 * Eine Faehigkeit mit `duration: 0` wirkt beim Zuenden einmal und laeuft nicht mit. Sie
 * braucht deshalb keinen zweiten Weg - nur einen Eintrag weniger in `active`.
 */

import { emit } from '../core/events.ts'
import { abilityById, isKnownAbility, type AbilityDef } from '../data/abilities.ts'
import { MAX_ABILITY_SLOTS } from '../data/balance.ts'
import type { StatKey } from '../data/types.ts'
import { spendGold } from '../app/rewards.ts'
import { markDirty, type GameState } from '../app/state.ts'
import { blastEnemies } from './combat.ts'
import { CORE_CENTER } from './station.ts'

// ---------------------------------------------------------------------------
// Besitz und Belegung
// ---------------------------------------------------------------------------

export function isUnlocked(state: GameState, id: string): boolean {
  return state.run.abilities.includes(id)
}

export function isEquipped(state: GameState, id: string): boolean {
  return state.run.equipped.includes(id)
}

/** Wie viele Slots der Run hat - nie mehr als das Maximum aus GDD 09 Abschnitt 8. */
export function slotCount(state: GameState): number {
  const slots = state.run.abilitySlots
  if (!Number.isFinite(slots) || slots < 1) return 1
  return Math.min(MAX_ABILITY_SLOTS, Math.floor(slots))
}

/**
 * Freischalten gegen Gold (GDD 09 Abschnitt 7). Gibt `false` zurueck, wenn die Faehigkeit
 * unbekannt ist, schon freigeschaltet ist oder das Gold nicht reicht - dann aendert sich
 * nichts.
 */
export function unlockAbility(state: GameState, id: string): boolean {
  if (!isKnownAbility(id) || isUnlocked(state, id)) return false

  const def = abilityById(id)
  if (!spendGold(state, def.unlockCost)) return false

  state.run.abilities.push(id)
  // Der erste freigeschaltete Zauber wandert gleich auf einen freien Slot. Sonst haette
  // der Spieler etwas gekauft, das er erst noch irgendwo hinlegen muss, bevor es etwas tut.
  if (state.run.equipped.length < slotCount(state)) state.run.equipped.push(id)

  markDirty(state)
  emit('ability.unlocked', { id, cost: def.unlockCost })
  return true
}

/**
 * Eine freigeschaltete Faehigkeit auf einen Slot legen oder von ihm nehmen.
 *
 * Umbelegen geht **jederzeit ausserhalb des Kampfes** (GDD 09 Abschnitt 8) - begrenzt ist
 * die Anzahl, nicht die Wahl. Sind alle Slots belegt, weicht der aelteste Eintrag: Ein
 * Klick soll etwas tun und nicht mit "kein Platz" abgewiesen werden.
 */
export function toggleEquipped(state: GameState, id: string): boolean {
  if (!isUnlocked(state, id)) return false

  const at = state.run.equipped.indexOf(id)
  if (at >= 0) {
    state.run.equipped.splice(at, 1)
    markDirty(state)
    emit('ability.equipped', { id, slot: -1 })
    return true
  }

  if (state.run.equipped.length >= slotCount(state)) state.run.equipped.shift()
  state.run.equipped.push(id)
  markDirty(state)
  emit('ability.equipped', { id, slot: state.run.equipped.length - 1 })
  return true
}

/** Belegte Slots in ihrer Reihenfolge. Unbekannte Eintraege werden uebergangen. */
export function equippedAbilities(state: GameState): AbilityDef[] {
  return state.run.equipped
    .slice(0, slotCount(state))
    .filter((id) => isKnownAbility(id) && isUnlocked(state, id))
    .map(abilityById)
}

// ---------------------------------------------------------------------------
// Zuenden
// ---------------------------------------------------------------------------

/** Restliche Abklingzeit in Sekunden. 0 heisst bereit. */
export function cooldownLeft(state: GameState, id: string): number {
  return Math.max(0, state.runtime.abilities.cooldowns.get(id) ?? 0)
}

/** Restliche Wirkdauer in Sekunden. 0 heisst: wirkt gerade nicht. */
export function activeLeft(state: GameState, id: string): number {
  return Math.max(0, state.runtime.abilities.active.get(id) ?? 0)
}

export function canActivate(state: GameState, id: string): boolean {
  return isEquipped(state, id) && isUnlocked(state, id) && cooldownLeft(state, id) <= 0
}

/**
 * Eine Faehigkeit zuenden.
 *
 * Der Einsatz kostet nichts (GDD 09 Abschnitt 7) - geprueft wird allein die Abklingzeit.
 * Sofortwirkungen schlagen hier zu; Dauerwirkungen tragen sich in `active` ein und werden
 * ab dem naechsten `stepAbilities` in die Kampfzahlen gerechnet.
 */
export function activateAbility(state: GameState, id: string): boolean {
  if (!canActivate(state, id)) return false

  const def = abilityById(id)
  const runtime = state.runtime.abilities

  runtime.cooldowns.set(id, def.cooldown)
  if (def.duration > 0) runtime.active.set(id, def.duration)

  applyInstant(state, def)
  // Damit die Dauerwirkung schon in diesem Takt zaehlt und nicht erst im naechsten.
  refreshDerived(state)

  emit('ability.activated', { id, x: CORE_CENTER.x, y: CORE_CENTER.y })
  return true
}

/** Was sofort passiert - Heilung und Flaechenschlag. */
function applyInstant(state: GameState, def: AbilityDef): void {
  const combat = state.runtime.combat

  if (def.effect.kind === 'heal') {
    // Nie ueber die volle Huelle hinaus. Geheilt wird ein Anteil des Maximums, nicht des
    // Fehlenden - sonst waere die Faehigkeit bei fast voller Station wertlos und bei fast
    // leerer uebermaechtig.
    const amount = combat.maxStationHp * def.effect.fraction
    combat.stationHp = Math.min(combat.maxStationHp, combat.stationHp + amount)
    return
  }

  if (def.effect.kind === 'blast') {
    blastEnemies(state, CORE_CENTER, def.effect.radius, def.effect.damage)
  }
}

// ---------------------------------------------------------------------------
// Takt
// ---------------------------------------------------------------------------

/**
 * Abklingzeiten und Wirkdauern altern lassen, danach die abgeleiteten Zahlen setzen.
 *
 * `dt` ist **Simulationszeit**. Bei Tempo x4 kommen viermal so viele Takte je echter
 * Sekunde, also laeuft eine Abklingzeit viermal so schnell ab - genau wie die Welle.
 */
export function stepAbilities(state: GameState, dt: number): void {
  const runtime = state.runtime.abilities

  for (const [id, left] of runtime.cooldowns) {
    const next = left - dt
    if (next <= 0) {
      runtime.cooldowns.delete(id)
      // Nur melden, was der Spieler auch besitzt - ein Eintrag kann aus einem Run stammen,
      // dessen Faehigkeit inzwischen nicht mehr belegt ist.
      if (isUnlocked(state, id)) emit('ability.ready', { id })
    } else {
      runtime.cooldowns.set(id, next)
    }
  }

  for (const [id, left] of runtime.active) {
    const next = left - dt
    if (next <= 0) runtime.active.delete(id)
    else runtime.active.set(id, next)
  }

  refreshDerived(state)
}

/**
 * Die drei Zahlen setzen, die Kampf und Werte lesen.
 *
 * Sie werden **jedes Mal neu aufgebaut** statt fortgeschrieben. Fortschreiben hiesse, beim
 * Ablaufen einer Wirkung genau den Betrag wieder abzuziehen, den man beim Zuenden addiert
 * hat - und das geht bei jeder Rundung und jedem verpassten Takt schief. Neu aufbauen
 * kostet einen Durchlauf ueber hoechstens drei Eintraege.
 */
function refreshDerived(state: GameState): void {
  const combat = state.runtime.combat
  const runtime = state.runtime.abilities

  const bonus: Partial<Record<StatKey, number>> = {}
  let reduction = 0
  let slow = 1

  for (const id of runtime.active.keys()) {
    if (!isKnownAbility(id)) continue
    const effect = abilityById(id).effect

    if (effect.kind === 'stat') {
      for (const [key, amount] of Object.entries(effect.stats)) {
        const stat = key as StatKey
        bonus[stat] = (bonus[stat] ?? 0) + (amount ?? 0)
      }
    } else if (effect.kind === 'shield') {
      // Mehrere Schilde stapeln sich **restlich**: Zwei zu je 60 Prozent lassen zusammen
      // 16 Prozent durch, nie null. Additiv waeren zwei Schilde Unverwundbarkeit.
      reduction = 1 - (1 - reduction) * (1 - effect.reduction)
    } else if (effect.kind === 'slow') {
      // Dieselbe Regel fuer die Verlangsamung - sie kann nie zum Stillstand fuehren.
      slow *= effect.factor
    }
  }

  combat.abilityBonus = bonus
  combat.damageReduction = reduction
  combat.enemySpeedFactor = slow
}

/**
 * Alles zuruecksetzen. Beim Laden eines Spielstands und beim Prestige (E13): Eine
 * Abklingzeit ist kein Fortschritt, und eine laufende Wirkung darf einen Programmstart
 * nicht ueberdauern.
 */
export function resetAbilities(state: GameState): void {
  state.runtime.abilities.cooldowns.clear()
  state.runtime.abilities.active.clear()
  refreshDerived(state)
}
