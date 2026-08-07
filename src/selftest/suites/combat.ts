/**
 * Beweise aus E4, E5 und E6.
 *
 * Der Kern ist die Zusicherung "ein Turm mit bekannten Werten toetet einen Gegner mit
 * bekannter HP nach der berechneten Zeit". Damit sie ueberhaupt formulierbar ist, wird der
 * Zufall im Test ausgeschaltet - genau dafuer laeuft er ueber `core/rng.ts` und nicht
 * ueber `Math.random()`.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { MODULE_SIDE } from '../../core/geometry.ts'
import { dist, type Vec2 } from '../../core/vec.ts'
import {
  ENEMY_ATTACK_INTERVAL,
  ENEMY_BASE_DAMAGE,
  ENEMY_BASE_HP,
  MAX_ENEMIES,
  TICK_RATE,
} from '../../data/balance.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { stepBattle, syncStation } from '../../sim/battle.ts'
import { placeModule } from '../../app/actions.ts'
import { createCombatState, damageStation, stepEffects, PLACING_LIFE } from '../../sim/combat.ts'
import {
  nearestModule,
  spawnEnemy,
  stepEnemies,
  touchesModule,
  type Enemy,
} from '../../sim/enemies.ts'
import { spawnProjectile, stepProjectiles } from '../../sim/projectiles.ts'
import { fireInterval, moduleStats } from '../../sim/stats.ts'
import {
  CORE_CENTER,
  CORE_UID,
  freeEdges,
  place,
  type FreeEdge,
  type PlacedModule,
} from '../../sim/station.ts'
import { findTarget } from '../../sim/targeting.ts'
import { rangeCircles, stationRange, stepTowers } from '../../sim/towers.ts'
import { rangeOutline } from '../../render/combat.ts'
import { clearField, healStationFull, startWave } from '../../sim/waves.ts'

const STEP = 1 / TICK_RATE

/**
 * Ein Spielstand ohne Zufall: Kritische Treffer sind ausgeschaltet, damit Schaden und
 * Zeit exakt vorhersagbar sind.
 */
function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(2024)
  state.runtime.combat = createCombatState()
  state.runtime.rng = { ...state.runtime.rng, chance: () => false }
  // Neutral: ohne Plan schreitet die Welle nicht voran. Sonst wuerde die anfaengliche
  // Pause beim ersten Tick die naechste Welle starten und das Feld leerraeumen.
  state.runtime.combat.phase = 'running'
  refresh(state)
  healStationFull(state)
  return state
}

function refresh(state: GameState): void {
  invalidateStationView(state)
  const view = stationView(state)
  // syncStation vergleicht ueber die Objektgleichheit; nach invalidate ist das Feld neu.
  syncStation(state, view.modules, view.buffs)
}

function placeFirst(state: GameState, defId: string, edgeIndex = 0): string {
  const station = state.run.station
  const module = station.inventory.find((m) => m.defId === defId)
  if (!module) throw new Error(`${defId} liegt nicht im Inventar`)
  const edge = freeEdges(station).find(
    (candidate) => candidate.ownerUid === CORE_UID && candidate.edgeIndex === edgeIndex,
  ) as FreeEdge
  place(station, module.uid, edge)
  refresh(state)
  return module.uid
}

/** Einen unbeweglichen Gegner an eine feste Stelle setzen. */
function planted(state: GameState, at: Vec2, hp: number): Enemy {
  const enemy = spawnEnemy(state, 'drone', 0)
  if (!enemy) throw new Error('Gegner konnte nicht erzeugt werden')
  enemy.pos = { ...at }
  enemy.maxHp = hp
  enemy.hp = hp
  enemy.speed = 0
  return enemy
}

function runTicks(state: GameState, ticks: number, fn: (state: GameState) => void): void {
  for (let i = 0; i < ticks; i++) fn(state)
}

export function combatSuite(): void {
  suite('sim/enemies')

  check('Gegner erscheinen ausserhalb der Station', () => {
    const state = rig()
    const enemy = spawnEnemy(state, 'drone', 0)
    assert(enemy !== null, 'Gegner muss erzeugt werden')
    const core = state.runtime.combat.modules[0]
    assert(
      dist(enemy.pos, core!.center) > MODULE_SIDE * 4,
      'ein Gegner darf nicht mitten in der Station erscheinen',
    )
  })

  check('Gegner laufen auf das naechstgelegene Modul zu, nicht auf den Mittelpunkt', () => {
    // Der Turm sitzt am Rand. Ein Gegner direkt vor ihm muss ihn ansteuern, nicht den Kern.
    const state = rig()
    placeFirst(state, 'autocannon', 0)
    const tower = state.runtime.combat.modules.find((m) => m.uid !== CORE_UID)
    assert(tower !== undefined, 'der Turm muss stehen')

    const outward = {
      x: tower.center.x * 4,
      y: tower.center.y * 4,
    }
    assertEqual(nearestModule(state.runtime.combat.modules, outward)?.uid, tower.uid)
  })

  check('ein Gegner naehert sich der Station', () => {
    const state = rig()
    const enemy = spawnEnemy(state, 'drone', 0) as Enemy
    const before = dist(enemy.pos, { x: 0, y: 0 })
    runTicks(state, 60, (s) => stepEnemies(s, STEP))
    assert(dist(enemy.pos, { x: 0, y: 0 }) < before, 'er muss naeher gekommen sein')
  })

  check('er dockt an, sobald er die Aussenkante beruehrt', () => {
    const state = rig()
    const enemy = spawnEnemy(state, 'drone', 0) as Enemy
    // Grosszuegig viele Ticks - der Ring liegt weit draussen.
    runTicks(state, 60 * 60, (s) => stepEnemies(s, STEP))

    assert(enemy.dockedTo !== null, 'er muesste angedockt sein')
    const target = state.runtime.combat.modules.find((m) => m.uid === enemy.dockedTo)
    assert(target !== undefined, 'das Andockziel muss existieren')
    assert(
      touchesModule(target, enemy.pos, enemy.radius + 1),
      'er muss die Aussenkante beruehren',
    )
  })

  check('ein angedockter Gegner bleibt stehen', () => {
    const state = rig()
    const enemy = planted(state, { x: 0, y: 0 }, 100)
    enemy.speed = 200
    stepEnemies(state, STEP)
    assert(enemy.dockedTo !== null, 'im Kern stehend muss er andocken')

    const at = { ...enemy.pos }
    runTicks(state, 60, (s) => stepEnemies(s, STEP))
    assertClose(dist(at, enemy.pos), 0, 1e-9, 'er darf sich nicht mehr bewegen')
  })

  check('angedockte Gegner senken die Stations-HP fortlaufend', () => {
    const state = rig()
    const enemy = planted(state, { x: 0, y: 0 }, 1e9)
    stepEnemies(state, STEP)
    assert(enemy.dockedTo !== null, 'er muss angedockt sein')

    const full = state.runtime.combat.stationHp
    // Vier Angriffsintervalle - Tuerme schiessen hier nicht, weil der Kern das Ziel toetet.
    state.runtime.combat.modules = []
    runTicks(state, Math.round(4 * ENEMY_ATTACK_INTERVAL * TICK_RATE), (s) => stepBattle(s, STEP))

    const lost = full - state.runtime.combat.stationHp
    assertClose(lost, 4 * ENEMY_BASE_DAMAGE, ENEMY_BASE_DAMAGE, 'rund vier Schlaege')
  })

  check('die Obergrenze gleichzeitiger Gegner wird eingehalten', () => {
    const state = rig()
    for (let i = 0; i < MAX_ENEMIES + 50; i++) spawnEnemy(state, 'drone', i * 0.1)
    assertEqual(state.runtime.combat.enemies.length, MAX_ENEMIES)
  })

  check('Gegner werden wiederverwendet statt neu erzeugt', () => {
    const state = rig()
    const combat = state.runtime.combat
    for (let i = 0; i < 30; i++) spawnEnemy(state, 'drone', i)
    const created = combat.nextId

    clearField(state)
    assertEqual(combat.enemies.length, 0)
    assertEqual(combat.enemyPool.length, 30)

    for (let i = 0; i < 30; i++) spawnEnemy(state, 'drone', i)
    assertEqual(combat.nextId, created, 'der Pool muss ausgereicht haben')
  })

  suite('sim/targeting')

    planted(state, { x: 60, y: 0 }, 100)
    const docked = planted(state, { x: 200, y: 0 }, 100)
    docked.dockedTo = CORE_UID

    assertEqual(findTarget(state.runtime.combat.enemies, { x: 0, y: 0 }, 400)?.id, docked.id)
  })

  check('die Sniper-Prioritaet waehlt den staerksten Gegner', () => {
    const state = rig()
    planted(state, { x: 80, y: 0 }, 100)
    const strong = planted(state, { x: 200, y: 0 }, 900)
    assertEqual(
      findTarget(state.runtime.combat.enemies, { x: 0, y: 0 }, 400, 'strongest')?.id,
      strong.id,
    )
  })

  check('die Reichweite wird ab dem eigenen Modul gemessen', () => {
    // GDD 05 Abschnitt 4: ein Kreis um das eigene Modul, nicht um das Zentrum.
    const state = rig()
    placeFirst(state, 'autocannon', 0)
    const tower = state.runtime.combat.modules.find((m) => m.uid !== CORE_UID)!
    const core = state.runtime.combat.modules[0]!

    // Ein Gegner knapp ausserhalb der Reichweite des Kerns, aber nahe am Turm.
    const stats = moduleStats(tower, undefined).final
    const outward = Math.hypot(tower.center.x, tower.center.y)
    const at = {
      x: (tower.center.x / outward) * (outward + stats.range * 0.5),
      y: (tower.center.y / outward) * (outward + stats.range * 0.5),
    }
    planted(state, at, 100)

    assert(
      findTarget(state.runtime.combat.enemies, tower.center, stats.range) !== null,
      'der Turm muss ihn erreichen',
    )
    assertEqual(
      findTarget(state.runtime.combat.enemies, core.center, stats.range),
      null,
      'vom Zentrum aus waere er ausser Reichweite',
    )
  })

  suite('sim/projectiles')

  check('ein Geschoss trifft und richtet genau seinen Schaden an', () => {
    const state = rig()
    const enemy = planted(state, { x: 150, y: 0 }, 1000)
    spawnProjectile(state, { x: 0, y: 0 }, enemy, {
      damage: 250,
      speed: 600,
      crit: false,
      color: '#fff',
    })

    runTicks(state, 60, (s) => stepProjectiles(s, STEP))
    assertClose(enemy.hp, 750, 1e-9)
    assertEqual(state.runtime.combat.projectiles.length, 0, 'das Geschoss ist verbraucht')
  })

  check('Geschosse werden wiederverwendet', () => {
    const state = rig()
    const combat = state.runtime.combat
    const enemy = planted(state, { x: 150, y: 0 }, 1e9)

    for (let i = 0; i < 40; i++) {
      spawnProjectile(state, { x: 0, y: 0 }, enemy, { damage: 1, speed: 600, crit: false, color: '#fff' })
    }
    const created = combat.nextId
    runTicks(state, 120, (s) => stepProjectiles(s, STEP))
    assertEqual(combat.projectiles.length, 0, 'alle muessen angekommen sein')

    for (let i = 0; i < 40; i++) {
      spawnProjectile(state, { x: 0, y: 0 }, enemy, { damage: 1, speed: 600, crit: false, color: '#fff' })
    }
    assertEqual(combat.nextId, created, 'kein Wachstum ueber die Zeit')
  })

  check('ein Geschoss auf ein totes Ziel verfaellt', () => {
    const state = rig()
    const enemy = planted(state, { x: 300, y: 0 }, 10)
    spawnProjectile(state, { x: 0, y: 0 }, enemy, { damage: 1, speed: 20, crit: false, color: '#fff' })
    enemy.active = false

    stepProjectiles(state, STEP)
    assertEqual(state.runtime.combat.projectiles.length, 0)
  })

  suite('sim/towers')

  check('ein Turm toetet einen Gegner nach der berechneten Zeit', () => {
    const state = rig()
    const core = state.runtime.combat.modules[0]!
    const stats = moduleStats(core, undefined).final
    const distance = 150
    const hp = stats.damage * 3 - 1 // drei Schuesse noetig

    const enemy = planted(state, { x: distance, y: 0 }, hp)
    enemy.dockedTo = CORE_UID // still stehen lassen, ohne den Kern zu beschaedigen

    const interval = fireInterval(stats)
    const expected = 2 * interval + distance / stats.projectileSpeed

    let ticks = 0
    while (enemy.active && ticks < TICK_RATE * 30) {
      stepTowers(state, STEP)
      stepProjectiles(state, STEP)
      ticks += 1
    }

    assert(!enemy.active, 'der Gegner muss sterben')
    const actual = ticks * STEP
    assert(
      Math.abs(actual - expected) <= 2 * STEP,
      `erwartet ${expected.toFixed(3)} s, war ${actual.toFixed(3)} s`,
    )
  })

  check('Buffs erhoehen sichtbar den Schaden eines Turms', () => {
    const state = rig()
    const amp = placeFirst(state, 'amplifier', 0)
    const core = state.runtime.combat.modules[0]!
    const buffed = moduleStats(core, state.runtime.combat.buffs.get(CORE_UID)).final
    const plain = moduleStats(core, undefined).final

    assert(amp.length > 0, 'der Amplifier muss stehen')
    assert(buffed.damage > plain.damage, `${buffed.damage} muss ueber ${plain.damage} liegen`)
  })

  check('Buff-Module schiessen nicht', () => {
    const state = rig()
    placeFirst(state, 'amplifier', 0)
    planted(state, { x: 60, y: 0 }, 1e9)

    // Nur das Buff-Modul betrachten - der Kern wuerde sonst mitschiessen.
    state.runtime.combat.modules = state.runtime.combat.modules.filter((m) => m.uid !== CORE_UID)
    runTicks(state, 120, (s) => stepTowers(s, STEP))
    assertEqual(state.runtime.combat.projectiles.length, 0)
  })

  check('ein Turm ohne Ziel bleibt geladen', () => {
    // Er soll nicht bestraft werden, weil gerade niemand in Reichweite war.
    const state = rig()
    runTicks(state, 300, (s) => stepTowers(s, STEP))

    planted(state, { x: 60, y: 0 }, 1e9)
    stepTowers(state, STEP)
    assert(state.runtime.combat.projectiles.length > 0, 'der erste Schuss muss sofort fallen')
  })

  suite('sim/combat · Hauptturm und Niederlage')

  check('der Hauptturm kaempft mit eigenen Werten', () => {
    const state = rig()
    const core = state.runtime.combat.modules[0]!
    assert(moduleStats(core, undefined).final.damage > 0, 'der Kern muss Schaden haben')

    const enemy = planted(state, { x: 120, y: 0 }, 10)
    enemy.dockedTo = CORE_UID
    runTicks(state, TICK_RATE * 5, (s) => {
      stepTowers(s, STEP)
      stepProjectiles(s, STEP)
    })
    assert(!enemy.active, 'der Kern allein muss den Gegner toeten')
  })

  check('jede Welle beginnt mit voller Stations-HP', () => {
    const state = rig()
    damageStation(state, 400, { x: 0, y: 0 })
    assert(state.runtime.combat.stationHp < state.runtime.combat.maxStationHp, 'Schaden muss wirken')

    startWave(state, 3)
    assertEqual(state.runtime.combat.stationHp, state.runtime.combat.maxStationHp)
  })

  check('Stations-HP auf 0 startet dieselbe Welle erneut', () => {
    const state = rig()
    startWave(state, 5)
    const gold = state.run.gold
    const record = state.run.waveRecord
    const inventory = state.run.station.inventory.length
    const placed = state.run.station.placed.length

    damageStation(state, state.runtime.combat.maxStationHp, { x: 0, y: 0 })
    assertEqual(state.runtime.combat.stationHp, 0)

    stepBattle(state, STEP)

    assertEqual(state.run.wave, 5, 'dieselbe Welle, kein Rueckschritt')
    assertEqual(state.runtime.combat.stationHp, state.runtime.combat.maxStationHp, 'volle HP')
    assertEqual(state.run.gold, gold, 'Gold bleibt')
    assertEqual(state.run.waveRecord, record, 'der Wellenrekord bleibt')
    assertEqual(state.run.station.inventory.length, inventory, 'das Inventar bleibt')
    assertEqual(state.run.station.placed.length, placed, 'die Tuerme bleiben stehen')
  })

  check('eine Niederlage laesst das Feld leer zurueck', () => {
    const state = rig()
    startWave(state, 2)
    for (let i = 0; i < 10; i++) spawnEnemy(state, 'drone', i)
    assert(state.runtime.combat.enemies.length > 0, 'es muessen Gegner stehen')

    damageStation(state, state.runtime.combat.maxStationHp, { x: 0, y: 0 })
    stepBattle(state, STEP)

    assertEqual(state.runtime.combat.enemies.length, 0, 'kein Uebertrag in den neuen Versuch')
  })

  check('die Niederlage wird gezaehlt, die geschaffte Welle setzt zurueck', () => {
    const state = rig()
    startWave(state, 2)
    damageStation(state, state.runtime.combat.maxStationHp, { x: 0, y: 0 })
    stepBattle(state, STEP)
    assertEqual(state.runtime.combat.lostAttempts, 1)
  })

  check('Schaden unter null wird ignoriert', () => {
    const state = rig()
    const before = state.runtime.combat.stationHp
    damageStation(state, -50, { x: 0, y: 0 })
    damageStation(state, Number.NaN, { x: 0, y: 0 })
    assertEqual(state.runtime.combat.stationHp, before)
  })

  check('eine geschaffte Welle geht in die Pause und dann weiter', () => {
    const state = rig()
    startWave(state, 1)
    const combat = state.runtime.combat
    // Alles erscheinen lassen und sofort raeumen - so ist die Welle geschafft.
    combat.spawnIndex = combat.plan?.spawns.length ?? 0
    clearField(state)

    stepBattle(state, STEP)
    assertEqual(combat.phase, 'pause')

    runTicks(state, TICK_RATE * 5, (s) => stepBattle(s, STEP))
    assertEqual(state.run.wave, 2, 'nach der Pause folgt die naechste Welle')
    assertEqual(combat.phase, 'running')
  })

  check('der Wellenrekord steigt mit, der Bestwert ebenfalls', () => {
    const state = rig()
    startWave(state, 12)
    assertEqual(state.run.waveRecord, 12)
    assertEqual(state.permanent.bestWaveEver, 12)

    startWave(state, 4)
    assertEqual(state.run.waveRecord, 12, 'ein Rueckschritt senkt den Rekord nicht')
  })

  check('ein Gegner mit voller HP hat die Werte seiner Welle', () => {
    const state = rig()
    startWave(state, 1)
    const enemy = spawnEnemy(state, 'drone', 0) as Enemy
    assertClose(enemy.maxHp, ENEMY_BASE_HP, 1e-9, 'Welle 1 ist der Grundwert')

    startWave(state, 11)
    const later = spawnEnemy(state, 'drone', 0) as Enemy
    assert(later.maxHp > enemy.maxHp * 2, 'Welle 11 muss deutlich haerter sein')
  })
}

