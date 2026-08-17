/**
 * Overdrive (`sim/overdrive.ts`, `docs/upgrade-umbau.md` Abschnitt 6).
 *
 * Der Waechter `catalogWiringRule` prueft, dass jeder Katalogwert **gelesen** wird. Diese
 * Sammlung prueft das, was er nicht kann: dass er richtig gelesen wird.
 *
 * Drei der Regeln haben eine Grenze, die ihre eigentliche Aussage ist - und jede davon war
 * beim Entwurf eine bewusste Entscheidung, keine Zahl aus dem Bauch:
 *
 *   **Der Deckel der Chance.** `Redline` ist endlos; ohne Deckel waere Overdrive im spaeten
 *   Run der Normalzustand, und ein Zustand, der immer gilt, ist keiner.
 *   **Die Daempfung des Treffer-Ausloesers.** Eine Autocannon feuert sechsmal je Sekunde.
 *   Ungedaempft waere `Perpetual` kein Upgrade, sondern ein Schalter.
 *   **Einmal je Welle bei `Last Stand`.** Die Huelle schwankt um die Schwelle; ohne Sperre
 *   pulste der Zustand an genau dieser Kante, statt der Wendepunkt zu sein.
 *
 * Genau diese drei stehen unten als Pruefung. Wer eine davon herausnimmt, bekommt Rot.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { upgradeById } from '../../data/upgrades.ts'
import { buyUpgrade } from '../../app/actions.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState, damageStation } from '../../sim/combat.ts'
import {
  lastStandThreshold,
  overdriveActive,
  overdriveBonus,
  overdriveChance,
  overdriveDuration,
  overdriveOnHit,
  overdriveOnKill,
  overdrivePower,
  resetOverdrive,
  stepOverdrive,
  triggerOverdrive,
} from '../../sim/overdrive.ts'
import { moduleStats, upgradeLevel } from '../../sim/stats.ts'
import { CORE_UID, freeEdges, newModule, place, type FreeEdge } from '../../sim/station.ts'

function sync(state: GameState): void {
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
}

function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(4711)
  state.runtime.combat = createCombatState()
  state.run.gold = 1e12
  state.runtime.combat.maxStationHp = 1000
  state.runtime.combat.stationHp = 1000
  sync(state)
  return state
}

function build(state: GameState, defId: string): string {
  const station = state.run.station
  station.slots = Math.max(station.slots, station.placed.length + 1)
  const module = newModule(station, defId, 'common')
  station.inventory.push(module)
  place(station, module.uid, freeEdges(station)[0] as FreeEdge)
  sync(state)
  return module.uid
}

/** Der Station eine runde Huelle geben, damit sich Anteile im Kopf nachrechnen lassen. */
function arm(state: GameState, hp: number): void {
  state.runtime.combat.maxStationHp = hp
  state.runtime.combat.stationHp = hp
}

/**
 * Ein Upgrade samt seiner Vorbedingungen kaufen.
 *
 * Was bereits steht, wird **nicht noch einmal** gekauft: Ein Directive hat genau eine Stufe,
 * und ein zweiter Kauf waere kein Kauf, sondern ein Fehlschlag.
 */
function acquire(state: GameState, id: string, times = 1): void {
  const def = upgradeById(id)
  if (def.window >= 2) buyUpgrade(state, 'f1.secondarray')
  if (def.window >= 3) buyUpgrade(state, 'f2.thirdarray')
  if (def.requires !== undefined && upgradeLevel(state.run.upgrades, def.requires) === 0) {
    acquire(state, def.requires)
  }
  for (let i = 0; i < times; i++) {
    assert(buyUpgrade(state, id), `${id} liess sich nicht kaufen`)
  }
}

const SPARK = 'f1.firstspark'

export function overdriveSuite(): void {
  suite('sim/overdrive')

  // -------------------------------------------------------------------------
  // Es gibt ihn erst, wenn man ihn gekauft hat
  // -------------------------------------------------------------------------

  check('ohne First Spark gibt es keinen Overdrive', () => {
    const state = rig()
    assertEqual(overdriveActive(state), false, 'der Zustand')

    // Auch nicht ueber einen Umweg: Weder ein Kill noch ein Anstoss von Hand.
    overdriveOnKill(state, CORE_UID)
    triggerOverdrive(state, CORE_UID)
    assertEqual(state.runtime.combat.overdrive.size, 0, 'niemand ist im Overdrive')
    assertEqual(overdriveBonus(state, CORE_UID), 0, 'der Zuschlag')
  })

  check('die abhaengigen Kacheln sind ohne First Spark gesperrt', () => {
    const state = rig()
    // `Redline`, `Afterburn` und die Overdrive-Directives setzen ihn voraus - sonst koennte
    // man eine Chance auf einen Zustand kaufen, den es nicht gibt.
    assertEqual(buyUpgrade(state, 'f1.redline'), false, 'Redline')
    assertEqual(buyUpgrade(state, 'f1.afterburn'), false, 'Afterburn')
  })

  // -------------------------------------------------------------------------
  // Die Wirkung
  // -------------------------------------------------------------------------

  check('ein Modul im Overdrive schiesst haerter und schneller', () => {
    const state = rig()
    acquire(state, SPARK)

    const core = state.runtime.combat.modules.find((m) => m.uid === CORE_UID)
    assert(core !== undefined, 'der Kern fehlt')
    const before = moduleStats(core, undefined, state).final

    triggerOverdrive(state, CORE_UID)
    const after = moduleStats(core, undefined, state).final

    const power = overdrivePower(state)
    assertEqual(Math.round(after.damage * 1e6), Math.round(before.damage * (1 + power) * 1e6), 'Schaden')
    assertEqual(
      Math.round(after.attackSpeed * 1e6),
      Math.round(before.attackSpeed * (1 + power) * 1e6),
      'Feuerrate',
    )
  })

  check('der Zustand laeuft ab', () => {
    const state = rig()
    acquire(state, SPARK)
    triggerOverdrive(state, CORE_UID)

    const duration = overdriveDuration(state)
    stepOverdrive(state, duration - 0.1)
    assert(overdriveBonus(state, CORE_UID) > 0, 'kurz vor Schluss muss er noch gelten')

    stepOverdrive(state, 0.2)
    assertEqual(overdriveBonus(state, CORE_UID), 0, 'danach nicht mehr')
    assertEqual(state.runtime.combat.overdrive.size, 0, 'der Eintrag ist weg')
  })

  check('Afterburn verlaengert, Runaway und Warlord verstaerken', () => {
    const plain = rig()
    acquire(plain, SPARK)

    const longer = rig()
    acquire(longer, SPARK)
    acquire(longer, 'f1.afterburn', 3)
    assertEqual(overdriveDuration(longer), overdriveDuration(plain) + 3, 'die Dauer')

    const stronger = rig()
    acquire(stronger, SPARK)
    acquire(stronger, 'f2.runaway', 5)
    assert(overdrivePower(stronger) > overdrivePower(plain), 'Runaway')

    // Beide zahlen auf denselben Wert ein - das ist die Verbindung zwischen Fenster 2 und 3.
    const both = rig()
    acquire(both, SPARK)
    acquire(both, 'f2.runaway', 5)
    acquire(both, 'f3.warlord', 5)
    assert(overdrivePower(both) > overdrivePower(stronger), 'Warlord legt auf Runaway drauf')
  })

  // -------------------------------------------------------------------------
  // Stapeln
  // -------------------------------------------------------------------------

  check('ohne Second Wind stapelt nichts', () => {
    const state = rig()
    acquire(state, SPARK)

    triggerOverdrive(state, CORE_UID)
    const single = overdriveBonus(state, CORE_UID)
    triggerOverdrive(state, CORE_UID)
    assertEqual(overdriveBonus(state, CORE_UID), single, 'der zweite Anstoss aendert nichts')
  })

  check('Second Wind stapelt genau zweifach', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f2.secondwind')

    triggerOverdrive(state, CORE_UID)
    const single = overdriveBonus(state, CORE_UID)
    triggerOverdrive(state, CORE_UID)
    assertEqual(overdriveBonus(state, CORE_UID), single * 2, 'zweifach')
    triggerOverdrive(state, CORE_UID)
    assertEqual(overdriveBonus(state, CORE_UID), single * 2, 'und nicht dreifach')
  })

  check('ein neuer Anstoss setzt die Dauer neu, statt sie zu addieren', () => {
    const state = rig()
    acquire(state, SPARK)

    triggerOverdrive(state, CORE_UID)
    stepOverdrive(state, 3)
    triggerOverdrive(state, CORE_UID)

    const entry = state.runtime.combat.overdrive.get(CORE_UID)
    assertEqual(entry?.left, overdriveDuration(state), 'die volle Dauer, nicht mehr')
  })

  // -------------------------------------------------------------------------
  // Die Ausloeser
  // -------------------------------------------------------------------------

  check('die Chance ist gedeckelt, egal wie viele Stufen Redline stehen', () => {
    const state = rig()
    acquire(state, SPARK)
    const base = overdriveChance(state)

    acquire(state, 'f1.redline', 10)
    assert(overdriveChance(state) > base, 'zehn Stufen muessen etwas bringen')

    acquire(state, 'f1.redline', 200)
    assertEqual(overdriveChance(state), 0.5, 'der Deckel')
  })

  check('Kills loesen ungefaehr so oft aus wie die Chance sagt', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f1.redline', 45) // 0,05 + 0,45 = 0,50, also der Deckel
    assertEqual(overdriveChance(state), 0.5, 'die Chance')

    let hits = 0
    for (let i = 0; i < 2000; i++) {
      state.runtime.combat.overdrive.clear()
      overdriveOnKill(state, CORE_UID)
      if (state.runtime.combat.overdrive.size > 0) hits += 1
    }
    // Bei 2000 Wuerfen und p = 0,5 liegt die Standardabweichung bei rund 22 - eine Spanne
    // von 900 bis 1100 ist damit sehr weit und faengt trotzdem jeden Vorzeichenfehler.
    assert(hits > 900 && hits < 1100, `${hits} von 2000 Kills - erwartet rund 1000`)
  })

  check('ohne Perpetual loest ein blosser Treffer nie aus', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f1.redline', 45)

    for (let i = 0; i < 500; i++) overdriveOnHit(state, CORE_UID)
    assertEqual(state.runtime.combat.overdrive.size, 0, 'kein einziger Treffer')
  })

  check('mit Perpetual loest ein Treffer aus - aber deutlich seltener als ein Kill', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f1.redline', 45)
    acquire(state, 'f3.perpetual')

    let hits = 0
    for (let i = 0; i < 3000; i++) {
      state.runtime.combat.overdrive.clear()
      overdriveOnHit(state, CORE_UID)
      if (state.runtime.combat.overdrive.size > 0) hits += 1
    }
    // Ein Drittel von 0,5 sind rund 500 von 3000. Die Daempfung ist der Punkt: Ohne sie
    // stuenden hier 1500, und eine Autocannon haette Overdrive dauerhaft.
    assert(hits > 400 && hits < 600, `${hits} von 3000 Treffern - erwartet rund 500`)
  })

  // -------------------------------------------------------------------------
  // Last Stand
  // -------------------------------------------------------------------------

  check('ohne Last Stand gibt es keine Schwelle', () => {
    const state = rig()
    acquire(state, SPARK)
    assertEqual(lastStandThreshold(state), 0, 'die Schwelle')

    damageStation(state, 950, { x: 0, y: 0 })
    assertEqual(state.runtime.combat.overdrive.size, 0, 'niemand geht in Overdrive')
  })

  check('Last Stand setzt die ganze Station in Overdrive - einmal je Welle', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f2.laststand')
    build(state, 'autocannon')
    build(state, 'cannon')
    // **Nach** den Kaeufen: `buyUpgrade` zieht den Huellen-Hoechstwert nach, wie es soll -
    // eine vorher gesetzte Zahl waere danach nicht mehr die, gegen die gerechnet wird.
    arm(state, 1000)

    assertEqual(lastStandThreshold(state), 0.3, 'die Schwelle')

    // Ueber der Schwelle passiert nichts.
    damageStation(state, 500, { x: 0, y: 0 })
    assertEqual(state.runtime.combat.overdrive.size, 0, 'bei 50 % Huelle noch nicht')

    damageStation(state, 250, { x: 0, y: 0 })
    const count = state.runtime.combat.overdrive.size
    assertEqual(count, state.runtime.combat.modules.length, 'alle Module')

    // Und danach nicht noch einmal: Die Huelle schwankt um die Schwelle, ohne die Sperre
    // pulste der Zustand an dieser Kante.
    state.runtime.combat.overdrive.clear()
    damageStation(state, 50, { x: 0, y: 0 })
    assertEqual(state.runtime.combat.overdrive.size, 0, 'kein zweites Mal in derselben Welle')
  })

  check('Brink laesst Last Stand frueher anschlagen', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f2.laststand')
    acquire(state, 'f2.brink', 3)
    assertEqual(Math.round(lastStandThreshold(state) * 100), 60, 'drei Stufen: 30 % + 30 %')
  })

  check('eine neue Welle macht Last Stand wieder scharf', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f2.laststand')
    arm(state, 1000)

    damageStation(state, 800, { x: 0, y: 0 })
    assert(state.runtime.combat.lastStandDone, 'er hat ausgeloest')

    resetOverdrive(state)
    assertEqual(state.runtime.combat.lastStandDone, false, 'nach dem Wellenwechsel wieder scharf')
    assertEqual(state.runtime.combat.overdrive.size, 0, 'und niemand mehr im Overdrive')
  })

  // -------------------------------------------------------------------------
  // Die beiden Directives, die den Ablauf aendern
  // -------------------------------------------------------------------------

  check('Endless Spring haelt den Zustand offen, solange ein Boss lebt', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f3.endlessspring')
    triggerOverdrive(state, CORE_UID)

    state.runtime.combat.bossId = 42
    stepOverdrive(state, 60)
    assert(overdriveBonus(state, CORE_UID) > 0, 'mit Boss laeuft die Uhr nicht')

    state.runtime.combat.bossId = null
    stepOverdrive(state, 60)
    assertEqual(overdriveBonus(state, CORE_UID), 0, 'ohne Boss laeuft sie wieder')
  })

  check('Contagion springt auf einen Nachbarn ueber - mit halber Dauer und nicht weiter', () => {
    const state = rig()
    acquire(state, SPARK)
    acquire(state, 'f2.contagion')
    const gun = build(state, 'autocannon')

    triggerOverdrive(state, CORE_UID)

    const combat = state.runtime.combat
    assert(combat.overdrive.has(gun), 'der Nachbar wurde nicht angesteckt')
    const carried = combat.overdrive.get(gun)
    assertEqual(carried?.left, overdriveDuration(state) / 2, 'halbe Restdauer')

    // Der Angesteckte steckt niemanden weiter an: Sonst waere eine dichte Station in einem
    // Zug vollstaendig im Overdrive.
    assertEqual(combat.overdrive.size, 2, 'genau zwei Module')
  })
}
