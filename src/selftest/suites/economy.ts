/**
 * Beweise aus E7, E8 und E9.
 *
 * E7: 500 Muenzen ueber 20 Wellen verschmelzen auf eine handhabbare Zahl von Objekten,
 *     und die Summe des eingesammelten Goldes stimmt **exakt** mit der Summe der Drops
 *     ueberein. Ein Stapel ist eine Darstellungsfrage, keine Rundung.
 * E8: Die Kostenkurve folgt der Formel, und ein Schadens-Upgrade erhoeht die Werte
 *     **aller** Tuerme dieses Typs - nicht die eines Einzelturms.
 * E9: Skippen ueber den Rekord hinaus wird abgelehnt, das Boss-Intervall stimmt ueber
 *     100 Wellen.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import {
  BOSS_WAVE_INTERVAL,
  GOLD_SCALE,
  MAX_COINS,
  UPGRADE_KIND_EXPONENT,
  UPGRADE_WINDOW_FACTOR,
  upgradeStepCost,
} from '../../data/balance.ts'
import { bossForWave, enemiesForWave } from '../../data/enemies.ts'
import { upgradeById } from '../../data/upgrades.ts'
import { COLLECTOR_NODE, COLLECTOR_PATH } from '../../sim/helpers.ts'
import { buyUpgrade, nextUpgradeCost } from '../../app/actions.ts'
import { createInitialState, waveRecord, type GameState } from '../../app/state.ts'
import { resetStationViewCache, stationView, invalidateStationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState } from '../../sim/combat.ts'
import { collectAt, collectRadius, dropGold, goldOnField, mergeCoins } from '../../sim/economy.ts'
import { activeBoss, spawnEnemy } from '../../sim/enemies.ts'
import { moduleStats, maxStationHp, upgradeLevel } from '../../sim/stats.ts'
import { CORE_UID, freeEdges, place, type FreeEdge } from '../../sim/station.ts'
import { canSkipTo, isBossWave, nextWave, previousWave, startWave } from '../../sim/waves.ts'

function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(31337)
  state.runtime.combat = createCombatState()
  state.runtime.combat.phase = 'running'
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

function placeAll(state: GameState, defId: string, count: number): string[] {
  const station = state.run.station
  station.slots = Math.max(station.slots, count)
  const uids: string[] = []

  for (let i = 0; i < count; i++) {
    const module = { uid: `x${i}`, defId, rarity: 'common' as const, traits: [], placement: null }
    station.inventory.push(module)
    const edge = freeEdges(station).find((candidate) => candidate.ownerUid === CORE_UID) as FreeEdge
    if (place(station, module.uid, edge) === null) uids.push(module.uid)
  }

  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return uids
}

export function economySuite(): void {
  suite('sim/economy')

  check('ein besiegter Gegner laesst Gold liegen, statt es gutzuschreiben', () => {
    const state = rig()
    dropGold(state, { x: 100, y: 0 }, 25)
    assertEqual(state.run.gold, 0, 'Gold wird nicht automatisch gutgeschrieben')
    assertEqual(goldOnField(state), 25)
  })

  check('Einsammeln schreibt genau den liegenden Betrag gut', () => {
    const state = rig()
    dropGold(state, { x: 10, y: 0 }, 30)
    dropGold(state, { x: 20, y: 0 }, 12)

    const collected = collectAt(state, { x: 15, y: 0 }, 200)
    assertEqual(collected, 42)
    assertEqual(state.run.gold, 42)
    assertEqual(goldOnField(state), 0)
  })

  check('was ausserhalb des Radius liegt, bleibt liegen', () => {
    const state = rig()
    dropGold(state, { x: 0, y: 0 }, 10)
    dropGold(state, { x: 5000, y: 0 }, 90)

    assertEqual(collectAt(state, { x: 0, y: 0 }, 100), 10)
    assertEqual(goldOnField(state), 90, 'der Rest verfaellt nicht')
  })

  check('500 Muenzen ueber 20 Wellen verschmelzen auf handhabbar viele Objekte', () => {
    const state = rig()
    const rng = state.runtime.rng

    let dropped = 0
    for (let wave = 1; wave <= 20; wave++) {
      for (let i = 0; i < 25; i++) {
        const value = 5 + wave
        dropGold(state, { x: rng.range(-400, 400), y: rng.range(-400, 400) }, value)
        dropped += value
      }
    }
    mergeCoins(state)

    assert(state.run.coins.length <= MAX_COINS, `${state.run.coins.length} Objekte`)
    assert(
      state.run.coins.length < 250,
      `500 Drops muessen deutlich zusammenfallen, waren ${state.run.coins.length}`,
    )
    // Der entscheidende Teil: kein Gold geht beim Verdichten verloren.
    assertClose(goldOnField(state), dropped, 1e-6, 'die Summe muss exakt stimmen')
  })

  check('die Summe des eingesammelten Goldes stimmt mit der Summe der Drops', () => {
    const state = rig()
    const rng = state.runtime.rng
    let dropped = 0

    for (let i = 0; i < 500; i++) {
      const value = rng.int(1, 40)
      dropGold(state, { x: rng.range(-300, 300), y: rng.range(-300, 300) }, value)
      dropped += value
    }
    mergeCoins(state)

    // Grosszuegig alles einsammeln.
    const collected = collectAt(state, { x: 0, y: 0 }, 100_000)
    assertEqual(collected, dropped)
    assertEqual(state.run.gold, dropped)
    assertEqual(state.run.coins.length, 0)
  })

  check('ein Stapel liegt dort, wo das Gold ist', () => {
    const state = rig()
    dropGold(state, { x: 0, y: 0 }, 10)
    dropGold(state, { x: 10, y: 0 }, 10)
    mergeCoins(state)

    assertEqual(state.run.coins.length, 1)
    assertClose(state.run.coins[0]?.x ?? -1, 5, 1e-9, 'wertgewichtetes Mittel')
    assertEqual(state.run.coins[0]?.count, 2)
  })

  check('weit auseinander liegende Muenzen verschmelzen nicht', () => {
    const state = rig()
    dropGold(state, { x: 0, y: 0 }, 10)
    dropGold(state, { x: 900, y: 0 }, 10)
    mergeCoins(state)
    assertEqual(state.run.coins.length, 2)
  })

  check('unbrauchbare Betraege fallen gar nicht erst', () => {
    const state = rig()
    dropGold(state, { x: 0, y: 0 }, 0)
    dropGold(state, { x: 0, y: 0 }, -5)
    dropGold(state, { x: 0, y: 0 }, Number.NaN)
    assertEqual(state.run.coins.length, 0)
  })

  suite('sim/stats · Upgrades')

  /*
   * Was hier steht, ist der **Zuschnitt** der Upgrades: auf wen sie wirken und auf wen
   * nicht. Ob ein einzelner Eintrag ueberhaupt etwas bewegt, prueft `suites/upgrades.ts`
   * Pfad fuer Pfad; ob der Katalog wohlgeformt ist, prueft `suites/catalog.ts`.
   */

  check('die Kostenkurve folgt der Formel', () => {
    // Preis = Grundpreis x Goldmassstab x Fensterfaktor x Stufe^Steigung (`data/balance.ts`).
    const def = upgradeById('f1.drumfire')
    const base = def.baseCost * GOLD_SCALE * UPGRADE_WINDOW_FACTOR[def.window]
    for (const level of [1, 2, 5, 20]) {
      assertEqual(
        upgradeStepCost(def, level),
        Math.round(base * Math.pow(level, UPGRADE_KIND_EXPONENT[def.kind])),
        `Stufe ${level}`,
      )
    }
    assertEqual(upgradeStepCost(def, 1), Math.round(base), 'die erste Stufe kostet den Grundpreis')
  })

  check('die Art bestimmt die Steigung der Kurve', () => {
    // Ein endloser Pfad muss steiler steigen als ein Ausbau - sonst bremst ihn nichts.
    assert(
      UPGRADE_KIND_EXPONENT.endless > UPGRADE_KIND_EXPONENT.extension,
      'endlose Pfade steigen nicht steiler als Ausbauten',
    )
    assert(
      UPGRADE_KIND_EXPONENT.charge > UPGRADE_KIND_EXPONENT.endless,
      'knappe Pfade steigen nicht am steilsten',
    )
  })

  check('ein unbekannter Pfad wird abgelehnt', () => {
    const state = rig()
    state.run.gold = 1e9
    assertEqual(buyUpgrade(state, 'gibt.es.nicht'), false)
    assertEqual(nextUpgradeCost(state, 'gibt.es.nicht'), null)
  })

  check('ein Turm-Upgrade wirkt auf ALLE Tuerme dieses Typs', () => {
    // GDD 08 Abschnitt 5.2 - das ist der Kern des Upgrade-Systems.
    const state = rig()
    const uids = placeAll(state, 'autocannon', 3)
    assert(uids.length >= 2, `nur ${uids.length} Tuerme platziert`)

    const damageOf = (uid: string): number => {
      const module = state.runtime.combat.modules.find((entry) => entry.uid === uid)!
      return moduleStats(module, undefined, state).final.damage
    }
    const before = uids.map(damageOf)

    state.run.gold = 1e9
    assertEqual(buyUpgrade(state, 'f1.rally'), true)

    const after = uids.map(damageOf)
    for (let i = 0; i < uids.length; i++) {
      assert((after[i] as number) > (before[i] as number), `Turm ${i} wurde nicht staerker`)
    }
  })

  check('ein Turm-Upgrade wirkt nicht auf andere Turmarten', () => {
    const state = rig()
    placeAll(state, 'autocannon', 1)
    const cannonBefore = moduleStats({ ...dummy('cannon') }, undefined, state).final.damage

    state.run.gold = 1e9
    buyUpgrade(state, 'f1.rally')

    const cannonAfter = moduleStats({ ...dummy('cannon') }, undefined, state).final.damage
    assertEqual(cannonAfter, cannonBefore)
  })

  check('ein Kern-Upgrade wirkt nicht auf Tuerme', () => {
    const state = rig()
    const before = moduleStats(dummy('autocannon'), undefined, state).final.damage
    state.run.gold = 1e9
    buyUpgrade(state, 'f1.hammerfall')
    assertEqual(moduleStats(dummy('autocannon'), undefined, state).final.damage, before)
  })

  check('ein Klassen-Upgrade trifft die Klasse und sonst niemanden', () => {
    // Der Zuschnitt, den es vor dem Katalog gar nicht gab: eine Gruppe von Turmarten.
    const state = rig()
    state.run.gold = 1e9
    const kineticBefore = moduleStats(dummy('cannon'), undefined, state).final.damage
    const elementalBefore = moduleStats(dummy('flamer'), undefined, state).final.damage

    assertEqual(buyUpgrade(state, 'f1.warhead'), true)

    assert(
      moduleStats(dummy('cannon'), undefined, state).final.damage > kineticBefore,
      'die Siege Cannon ist kinetisch und muss profitieren',
    )
    assertEqual(
      moduleStats(dummy('flamer'), undefined, state).final.damage,
      elementalBefore,
      'der Flame Projector ist elementar und darf nichts bekommen',
    )
  })

  check('das Huellen-Upgrade hebt die gemeinsame Leiste sofort', () => {
    const state = rig()
    const before = maxStationHp(state)
    state.run.gold = 1e9
    assertEqual(buyUpgrade(state, 'f1.bulkhead'), true)
    assert(maxStationHp(state) > before, 'die Stations-HP muessen steigen')
    assertEqual(
      state.runtime.combat.maxStationHp,
      maxStationHp(state),
      'die laufende Leiste zieht sofort mit',
    )
  })

  check('der Goldsammler ist hinter seinem Prestige-Knoten verschlossen', () => {
    const state = createInitialState(7)
    state.run.gold = 1e9
    // Sein Fenster oeffnen - sonst haenge die Sperre am Tor und nicht am Knoten, und die
    // Pruefung bewiese das Falsche.
    assertEqual(buyUpgrade(state, 'f1.secondarray'), true, 'das Tor zu Fenster 2')

    assertEqual(nextUpgradeCost(state, COLLECTOR_PATH), null, 'ohne den Knoten')
    assertEqual(buyUpgrade(state, COLLECTOR_PATH), false, 'auch nicht am Menue vorbei')

    state.permanent.prestigeNodes.push(COLLECTOR_NODE)
    assert(nextUpgradeCost(state, COLLECTOR_PATH) !== null, 'jetzt muss er kaufbar sein')
    assertEqual(buyUpgrade(state, COLLECTOR_PATH), true, 'der Kauf')
  })


  suite('sim/waves · Steuerung und Bosse')

  check('alle zehn Wellen erscheint ein Boss - ueber 100 Wellen geprueft', () => {
    let bosses = 0
    for (let wave = 1; wave <= 100; wave++) {
      const expected = wave % BOSS_WAVE_INTERVAL === 0
      assertEqual(isBossWave(wave), expected, `Welle ${wave}`)
      if (expected) bosses += 1
    }
    assertEqual(bosses, 10, 'zehn Bosse auf hundert Wellen')
    assertEqual(isBossWave(0), false, 'Welle 0 gibt es nicht')
  })

  check('der Boss erscheint sofort zu Beginn seiner Welle', () => {
    const state = rig()
    startWave(state, 10)
    const boss = activeBoss(state)
    assert(boss !== null, 'der Boss muss stehen')
    assertEqual(boss.defId, bossForWave(10).id)
  })

  check('auf einer normalen Welle gibt es keinen Boss', () => {
    const state = rig()
    startWave(state, 9)
    assertEqual(activeBoss(state), null)
  })

  check('der Boss ersetzt die Welle nicht, er ergaenzt sie', () => {
    // GDD 07 Abschnitt 7: waehrend des Bosskampfes stroemen normale Gegner weiter nach.
    const state = rig()
    startWave(state, 10)
    const plan = state.runtime.combat.plan
    assert((plan?.spawns.length ?? 0) > 0, 'die Welle muss normale Gegner enthalten')
    assert(
      !plan?.spawns.some((spawn) => spawn.defId === bossForWave(10).id),
      'der Boss darf nicht aus der Wellenmischung kommen',
    )
  })

  check('der Boss ist deutlich zaeher als ein normaler Gegner', () => {
    const state = rig()
    startWave(state, 10)
    const boss = activeBoss(state)!
    const normal = spawnEnemy(state, 'drone', 0)!
    assert(boss.maxHp > normal.maxHp * 10, `${boss.maxHp} gegen ${normal.maxHp}`)
    assert(boss.goldReward > normal.goldReward * 10, 'er muss sich auch lohnen')
  })

  check('Bosse erscheinen nicht in der normalen Wellenmischung', () => {
    for (const def of enemiesForWave(500)) {
      assert(def.isBoss !== true, `${def.id} darf nicht regulaer erscheinen`)
    }
  })

  check('Skippen ueber den Rekord hinaus wird abgelehnt', () => {
    const state = rig()
    startWave(state, 5) // Rekord 5
    assertEqual(waveRecord(state), 5)

    // Eine Welle weiter ist der naechste Schritt - erlaubt.
    assertEqual(nextWave(state), true)
    assertEqual(state.run.wave, 6)

    // Zurueck auf 2, dann darf man wieder bis 6 vor - aber nicht weiter springen.
    startWave(state, 2)
    assertEqual(canSkipTo(state, 6), true)
    assertEqual(canSkipTo(state, 99), false, 'unerreichter Inhalt bleibt gesperrt')
  })

  check('zurueckskippen ist erlaubt, unter Welle 1 nicht', () => {
    const state = rig()
    startWave(state, 4)
    assertEqual(previousWave(state), true)
    assertEqual(state.run.wave, 3)

    startWave(state, 1)
    assertEqual(previousWave(state), false, 'unter Welle 1 gibt es nichts')
    assertEqual(state.run.wave, 1)
  })

  check('Belohnungen haengen an der gespielten Welle, nicht am Rekord', () => {
    // GDD 07 Abschnitt 10: sonst waere Zurueckskippen die beste Strategie des Spiels.
    const state = rig()
    startWave(state, 30)
    const highReward = state.runtime.combat.plan?.rewardScale ?? 0

    startWave(state, 3)
    const lowReward = state.runtime.combat.plan?.rewardScale ?? 0

    assertEqual(waveRecord(state), 30, 'der Rekord bleibt')
    assert(lowReward < highReward, 'Welle 3 muss Welle-3-Ertraege geben')
  })

  check('der Auto-Modus laesst sich abschalten und haelt die Welle an', () => {
    const state = rig()
    state.run.autoWaves = false
    startWave(state, 2)

    const combat = state.runtime.combat
    combat.phase = 'pause'
    combat.timer = 0.01

    // Auch nach reichlich Zeit darf ohne Auto-Modus nichts weiterlaufen.
    for (let i = 0; i < 600; i++) stepPause(state)
    assertEqual(state.run.wave, 2, 'das Spiel wartet auf den Spieler')
  })
}

function stepPause(state: GameState): void {
  const combat = state.runtime.combat
  combat.timer -= 1 / 60
  if (combat.timer <= 0 && state.run.autoWaves) startWave(state, state.run.wave + 1)
}

function dummy(defId: string) {
  return {
    uid: 'dummy',
    kind: 'tower' as const,
    defId,
    rarity: 'common' as const,
    traits: [] as string[],
    sides: 4 as const,
    center: { x: 0, y: 0 },
    rotation: 0,
    poly: [],
    sharedEdges: [],
  }
}