/**
 * Beweis aus E11.
 *
 * Der Plan nennt genau eine Abnahmebedingung: "Abklingzeit in Simulationssekunden, nicht in
 * Echtzeit - bei x4 vergeht sie viermal so schnell." Das ist die erste Pruefung hier, und
 * sie ist wichtiger, als sie aussieht: Ein Cooldown an der Wanduhr waere bei x4 eine
 * Abwertung des Tempos, und beim Offline-Fortschritt (E17) waere er gar nicht mehr
 * nachvollziehbar.
 *
 * Daneben steht die zweite Entscheidung dieser Etappe: Die Wirkung einer Faehigkeit wird
 * **geschrieben, nicht erfragt** - `sim/abilities.ts` legt sie als Zahl in den
 * Kampfzustand, Kampf und Werte lesen sie dort ab. Deshalb wird geprueft, dass genau diese
 * Zahlen stimmen und dass sie wieder verschwinden, wenn die Wirkung ausgelaufen ist.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { abilityById } from '../../data/abilities.ts'
import { MAX_ABILITY_SLOTS } from '../../data/balance.ts'
import { buyAbility, fireAbility, toggleAbilitySlot } from '../../app/actions.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import {
  abilityUnlockCost,
  activateAbility,
  canActivate,
  cooldownLeft,
  equippedAbilities,
  isEquipped,
  isUnlocked,
  resetAbilities,
  stepAbilities,
  unlockAbility,
} from '../../sim/abilities.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState, damageStation } from '../../sim/combat.ts'
import { spawnEnemy } from '../../sim/enemies.ts'
import { effectiveTowerStats, maxStationHp } from '../../sim/stats.ts'
import { CORE_UID } from '../../sim/station.ts'

function rig(gold = 100000): GameState {
  resetStationViewCache()
  const state = createInitialState(2024)
  state.runtime.combat = createCombatState()
  state.runtime.combat.phase = 'running'
  state.runtime.combat.maxStationHp = maxStationHp(state)
  state.runtime.combat.stationHp = state.runtime.combat.maxStationHp
  state.run.gold = gold
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

/** Freischalten und sicherstellen, dass die Faehigkeit auch auf einem Slot liegt. */
function ready(state: GameState, id: string): void {
  unlockAbility(state, id)
  if (!isEquipped(state, id)) toggleAbilitySlot(state, id)
}

export function abilitiesSuite(): void {
  suite('sim/abilities')

  // -------------------------------------------------------------------------
  // Besitz und Belegung
  // -------------------------------------------------------------------------

  check('Freischalten kostet Gold und passiert genau einmal', () => {
    const state = rig(500)
    // Der Preis kommt aus `abilityUnlockCost`, nicht aus `def.unlockCost`: Der Rohwert im
    // Datensatz steht vor dem Goldmassstab, abgebucht wird der gerechnete Betrag.
    const cost = abilityUnlockCost(abilityById('overload'))

    assertEqual(unlockAbility(state, 'overload'), true)
    assertEqual(state.run.gold, 500 - cost)
    assertEqual(isUnlocked(state, 'overload'), true)

    assertEqual(unlockAbility(state, 'overload'), false, 'ein zweites Mal geht nicht')
    assertEqual(state.run.gold, 500 - cost, 'und kostet auch nichts')
  })

  check('ohne genug Gold aendert sich nichts', () => {
    const state = rig(1)
    assert(abilityUnlockCost(abilityById('shield')) > 1, 'sonst prueft der Fall nichts')
    assertEqual(unlockAbility(state, 'shield'), false)
    assertEqual(state.run.gold, 1)
    assertEqual(isUnlocked(state, 'shield'), false)
  })

  check('die erste freigeschaltete Faehigkeit landet gleich auf einem Slot', () => {
    const state = rig()
    unlockAbility(state, 'orbital')
    assertEqual(isEquipped(state, 'orbital'), true, 'sonst haette man etwas gekauft, das nichts tut')
  })

  check('mehr Slots als erlaubt gibt es nicht (GDD 09 Abschnitt 8)', () => {
    const state = rig()
    state.run.abilitySlots = 99
    for (const id of ['overload', 'shield', 'orbital', 'timewarp', 'repair']) {
      unlockAbility(state, id)
    }
    assert(
      equippedAbilities(state).length <= MAX_ABILITY_SLOTS,
      `hoechstens ${MAX_ABILITY_SLOTS}, war ${equippedAbilities(state).length}`,
    )
  })

  check('bei vollen Slots weicht der aelteste Eintrag', () => {
    const state = rig()
    state.run.abilitySlots = 1
    unlockAbility(state, 'overload')
    unlockAbility(state, 'shield')

    // Beide sind freigeschaltet, aber nur einer passt auf den einen Slot.
    assertEqual(state.run.equipped.length, 1)
    toggleAbilitySlot(state, 'shield')
    assertEqual(isEquipped(state, 'shield'), true, 'der Klick tut etwas, statt abzuweisen')
    assertEqual(isEquipped(state, 'overload'), false, 'der aeltere Eintrag weicht')
  })

  check('nur Freigeschaltetes kann belegt werden', () => {
    const state = rig()
    assertEqual(toggleAbilitySlot(state, 'repair'), false)
    assertEqual(isEquipped(state, 'repair'), false)
  })

  // -------------------------------------------------------------------------
  // Abklingzeit - die Abnahmebedingung der Etappe
  // -------------------------------------------------------------------------

  check('die Abklingzeit laeuft in Simulationssekunden, nicht an der Uhr', () => {
    const state = rig()
    ready(state, 'overload')
    const def = abilityById('overload')

    assertEqual(activateAbility(state, 'overload'), true)
    assertClose(cooldownLeft(state, 'overload'), def.cooldown, 1e-9)

    // Zehn Simulationssekunden - unabhaengig davon, wie viele echte Sekunden das waren.
    // Genau darin liegt der Unterschied zu einer Wanduhr: Bei Tempo x4 kommen dieselben
    // zehn Simulationssekunden in zweieinhalb echten zusammen.
    for (let i = 0; i < 600; i++) stepAbilities(state, 1 / 60)
    assertClose(cooldownLeft(state, 'overload'), def.cooldown - 10, 1e-6)
  })

  check('gleiche Simulationszeit in verschieden grossen Schritten ergibt dasselbe', () => {
    const fine = rig()
    const coarse = rig()
    ready(fine, 'orbital')
    ready(coarse, 'orbital')
    activateAbility(fine, 'orbital')
    activateAbility(coarse, 'orbital')

    for (let i = 0; i < 240; i++) stepAbilities(fine, 1 / 60)
    for (let i = 0; i < 60; i++) stepAbilities(coarse, 1 / 15)

    assertClose(cooldownLeft(fine, 'orbital'), cooldownLeft(coarse, 'orbital'), 1e-6)
  })

  check('waehrend der Abklingzeit geht kein zweiter Einsatz', () => {
    const state = rig()
    ready(state, 'orbital')

    assertEqual(activateAbility(state, 'orbital'), true)
    assertEqual(canActivate(state, 'orbital'), false)
    assertEqual(activateAbility(state, 'orbital'), false)

    // Bis kurz vor Schluss bleibt sie gesperrt, danach steht sie bereit.
    stepAbilities(state, abilityById('orbital').cooldown - 0.01)
    assertEqual(canActivate(state, 'orbital'), false)
    stepAbilities(state, 0.02)
    assertEqual(canActivate(state, 'orbital'), true)
  })

  check('nicht belegte Faehigkeiten lassen sich nicht zuenden', () => {
    const state = rig()
    unlockAbility(state, 'overload')
    toggleAbilitySlot(state, 'overload')
    assertEqual(isEquipped(state, 'overload'), false)
    assertEqual(activateAbility(state, 'overload'), false, 'Besitz allein genuegt nicht')
  })

  check('zuenden geht nur in der Kampfansicht (GDD 09 Abschnitt 7)', () => {
    const state = rig()
    ready(state, 'orbital')

    state.runtime.view = 'base'
    assertEqual(fireAbility(state, 'orbital'), false, 'die Basis bleibt Verwaltungsbereich')

    state.runtime.view = 'combat'
    assertEqual(fireAbility(state, 'orbital'), true)
  })

  // -------------------------------------------------------------------------
  // Wirkung
  // -------------------------------------------------------------------------

  check('eine Verstaerkung erscheint in effectiveTowerStats und verschwindet wieder', () => {
    const state = rig()
    ready(state, 'overload')

    const before = effectiveTowerStats(state, CORE_UID)
    assert(before !== null, 'der Kern muss Werte haben')

    activateAbility(state, 'overload')
    const during = effectiveTowerStats(state, CORE_UID)
    assert(during !== null, 'der Kern muss weiterhin Werte haben')
    assertClose(during.attackSpeed, before.attackSpeed * 1.5, 1e-9, 'waehrend der Wirkung')

    // Bis nach dem Ende der Wirkdauer laufen lassen.
    stepAbilities(state, abilityById('overload').duration + 0.1)
    const after = effectiveTowerStats(state, CORE_UID)
    assert(after !== null, 'der Kern muss danach Werte haben')
    assertClose(after.attackSpeed, before.attackSpeed, 1e-9, 'nach der Wirkung')
  })

  check('ein Schild faengt einen Anteil des Schadens ab', () => {
    const state = rig()
    ready(state, 'shield')
    const combat = state.runtime.combat

    const full = combat.stationHp
    damageStation(state, 100, { x: 0, y: 0 })
    const withoutShield = full - combat.stationHp
    assertClose(withoutShield, 100, 1e-9)

    combat.stationHp = full
    activateAbility(state, 'shield')
    damageStation(state, 100, { x: 0, y: 0 })
    const withShield = full - combat.stationHp
    assertClose(withShield, 100 * (1 - 0.6), 1e-9, 'sechzig Prozent bleiben draussen')
  })

  check('eine Verlangsamung bremst, haelt aber nie an', () => {
    const state = rig()
    ready(state, 'timewarp')

    assertEqual(state.runtime.combat.enemySpeedFactor, 1)
    activateAbility(state, 'timewarp')
    const factor = state.runtime.combat.enemySpeedFactor
    assert(factor > 0 && factor < 1, `Faktor muss zwischen 0 und 1 liegen, war ${factor}`)

    stepAbilities(state, abilityById('timewarp').duration + 0.1)
    assertEqual(state.runtime.combat.enemySpeedFactor, 1, 'danach wieder normal')
  })

  check('eine Heilung wirkt sofort und nie ueber die volle Huelle hinaus', () => {
    const state = rig()
    ready(state, 'repair')
    const combat = state.runtime.combat

    combat.stationHp = combat.maxStationHp * 0.2
    activateAbility(state, 'repair')
    assertClose(
      combat.stationHp,
      combat.maxStationHp * 0.5,
      1e-6,
      'dreissig Prozent des Maximums dazu',
    )

    // Aus der Abklingzeit heraus und bei fast voller Huelle noch einmal.
    stepAbilities(state, abilityById('repair').cooldown + 0.1)
    combat.stationHp = combat.maxStationHp - 1
    activateAbility(state, 'repair')
    assertEqual(combat.stationHp, combat.maxStationHp, 'nie darueber hinaus')
  })

  check('ein Flaechenschlag trifft, was im Umkreis steht', () => {
    const state = rig()
    ready(state, 'orbital')
    const combat = state.runtime.combat

    // Einer dicht an der Station, einer weit draussen.
    const near = spawnEnemy(state, 'drone', 0)
    assert(near !== null, 'der nahe Gegner muss erscheinen')
    near.pos.x = 60
    near.pos.y = 0
    near.hp = 10000
    near.maxHp = 10000

    const far = spawnEnemy(state, 'drone', Math.PI)
    assert(far !== null, 'der ferne Gegner muss erscheinen')
    far.pos.x = 4000
    far.pos.y = 0
    far.hp = 10000
    far.maxHp = 10000

    const nearBefore = near.hp
    const farBefore = far.hp
    activateAbility(state, 'orbital')

    assert(near.hp < nearBefore, 'der nahe Gegner muss Schaden nehmen')
    assertEqual(far.hp, farBefore, 'der ferne bleibt unberuehrt')
    assert(combat.enemies.length >= 1, 'die Liste bleibt in Ordnung')
  })

  check('zuruecksetzen raeumt Abklingzeiten und Wirkungen weg', () => {
    const state = rig()
    ready(state, 'overload')
    activateAbility(state, 'overload')

    resetAbilities(state)
    assertEqual(cooldownLeft(state, 'overload'), 0)
    assertEqual(state.runtime.combat.damageReduction, 0)
    assertEqual(state.runtime.combat.enemySpeedFactor, 1)
    assertEqual(Object.keys(state.runtime.combat.abilityBonus).length, 0)
  })

  check('eine gekaufte Faehigkeit ueberlebt den Spielstand, ihre Abklingzeit nicht', () => {
    const state = rig()
    ready(state, 'shield')
    activateAbility(state, 'shield')

    // Was gespeichert wird, sind Besitz und Belegung - nicht der laufende Zustand.
    assert(state.run.abilities.includes('shield'), 'Besitz gehoert in den Spielstand')
    assert(state.run.equipped.includes('shield'), 'Belegung auch')
    assert(cooldownLeft(state, 'shield') > 0, 'die Abklingzeit dagegen ist Laufzeit')
  })

  check('das Freischalten laeuft ueber dieselbe Handlung wie im Spiel', () => {
    const state = rig()
    assertEqual(buyAbility(state, 'timewarp'), true)
    assertEqual(isUnlocked(state, 'timewarp'), true)
  })
}
