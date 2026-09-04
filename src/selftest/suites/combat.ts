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
  ENEMY_APPROACH_SPEED_FACTOR,
  ENEMY_ATTACK_INTERVAL,
  ENEMY_BASE_DAMAGE,
  ENEMY_BASE_HP,
  MAX_ENEMIES,
  TICK_RATE,
} from '../../data/balance.ts'
import { createInitialState, waveRecord, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { stepBattle, syncStation } from '../../sim/battle.ts'
import { placeModule } from '../../app/actions.ts'
import {
  applyDamage,
  applyBurn,
  createCombatState,
  damageStation,
  stepEffects,
  stepEnemyStates,
  DAMAGE_LIFE,
  ENEMY_FLASH_LIFE,
  PLACING_LIFE,
} from '../../sim/combat.ts'
import { formatNumber } from '../../core/format.ts'
import {
  inCoverage,
  nearestModule,
  spawnEnemy,
  stepEnemies,
  touchesModule,
  SPIN_MAX,
  type Enemy,
} from '../../sim/enemies.ts'
import { rangeBlobs } from '../../render/combat.ts'
import { spawnProjectile, stepProjectiles } from '../../sim/projectiles.ts'
import { rangeCircles, stationRange, type RangeCircle } from '../../sim/towers.ts'
import { fireInterval, moduleStats } from '../../sim/stats.ts'
import {
  CORE_UID,
  freeEdges,
  newModule,
  place,
  type FreeEdge,
  type ModuleInstance,
} from '../../sim/station.ts'
import { findTarget } from '../../sim/targeting.ts'
import { stepTowers } from '../../sim/towers.ts'
import { clearField, healStationFull, skipToWave, startWave } from '../../sim/waves.ts'

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

/**
 * Ein Modul ins Lager legen - im Spiel tut das der Kauf (`sim/shop.ts`).
 *
 * Das Startlager ist leer (`START_INVENTORY`), seit die drei geschenkten Module weg sind.
 * Ein Pruefstand, der etwas anbauen will, besorgt sich seine Module deshalb selbst - und
 * den Platz dafuer gleich mit: Die Station beginnt mit **einem** Turmplatz, und eine
 * Aufstellung aus drei Tuermen wuerde sonst an einer Regel scheitern, die dieser Test gar
 * nicht prueft.
 */
function stock(state: GameState, defId: string): ModuleInstance {
  const station = state.run.station
  const module = newModule(station, defId, 'common')
  station.inventory.push(module)
  station.slots = Math.max(station.slots, station.placed.length + station.inventory.length)
  return module
}

function placeFirst(state: GameState, defId: string, edgeIndex = 0): string {
  const station = state.run.station
  const module = station.inventory.find((m) => m.defId === defId) ?? stock(state, defId)
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

  check('ausserhalb jeder Reichweite marschiert er schneller an', () => {
    const state = rig()
    const combat = state.runtime.combat
    combat.coverage = rangeCircles(state)
    const reach = stationRange(state)

    // Beide auf derselben Achse, weit genug auseinander, dass sie sich nicht anstossen.
    const drinnen = spawnEnemy(state, 'drone', 0) as Enemy
    drinnen.pos = { x: reach - 20, y: 0 }
    const draussen = spawnEnemy(state, 'drone', 0) as Enemy
    draussen.pos = { x: reach + 200, y: 0 }

    const vorher = { drinnen: drinnen.pos.x, draussen: draussen.pos.x }
    stepEnemies(state, STEP)

    const nah = vorher.drinnen - drinnen.pos.x
    const fern = vorher.draussen - draussen.pos.x
    assert(nah > 0, 'beide muessen sich zur Station bewegen')
    assertClose(
      fern,
      nah * ENEMY_APPROACH_SPEED_FACTOR,
      1e-9,
      'ungedeckt genau um den Anmarschfaktor weiter',
    )
  })

  check('die Tempogrenze ist dieselbe wie die der Zielwahl', () => {
    const state = rig()
    const combat = state.runtime.combat
    combat.coverage = rangeCircles(state)
    const circle = combat.coverage[0] as RangeCircle
    const enemy = spawnEnemy(state, 'drone', 0) as Enemy

    // Genau so weit draussen, dass sein Rand den Kreis noch beruehrt.
    enemy.pos = { x: circle.center.x + circle.range + enemy.radius, y: circle.center.y }
    assert(inCoverage(combat.coverage, enemy), 'beruehrt reicht - er laeuft normal')
    assertEqual(
      findTarget([enemy], circle.center, circle.range),
      enemy,
      'und genau hier findet ihn auch ein Turm',
    )

    // Eine Einheit weiter: keiner von beiden mehr.
    enemy.pos.x += 1
    assert(!inCoverage(combat.coverage, enemy), 'einen Schritt weiter ist er ungedeckt')
    assertEqual(findTarget([enemy], circle.center, circle.range), null, 'und kein Ziel mehr')
  })

  check('eine Verlangsamung wirkt auch im Anmarsch', () => {
    const state = rig()
    const combat = state.runtime.combat
    combat.coverage = rangeCircles(state)

    const enemy = spawnEnemy(state, 'drone', 0) as Enemy
    enemy.pos = { x: stationRange(state) + 200, y: 0 }
    enemy.chillFactor = 0.5

    const before = enemy.pos.x
    stepEnemies(state, STEP)
    const moved = before - enemy.pos.x
    assertClose(
      moved,
      enemy.speed * 0.5 * ENEMY_APPROACH_SPEED_FACTOR * STEP,
      1e-9,
      'Frost multipliziert mit dem Anmarsch, statt von ihm ueberschrieben zu werden',
    )
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

  check('zwei Gegner auf demselben Fleck schieben sich auseinander', () => {
    // Der Fall ist kein Gedankenspiel: Eine Brut erscheint auf ihrem Erzeuger.
    const state = rig()
    const a = planted(state, { x: 400, y: 0 }, 100)
    const b = planted(state, { x: 400, y: 0 }, 100)

    runTicks(state, 60, (s) => stepEnemies(s, STEP))
    assert(dist(a.pos, b.pos) > 1, 'sie duerfen nicht deckungsgleich stehen bleiben')
    // Der Massstab ist der **Gedraenge**-Halbmesser, nicht der Koerper: Zwei Marschierende
    // halten seit `crowdRadius` den Abstand ihrer gezeichneten Umrisse, nicht den ihrer
    // Trefferflaechen. Mit `radius` gemessen behauptete diese Zeile, ein Pulk duerfe enger
    // stehen, als er aussieht - genau der Fehler, den das Feld beseitigt.
    // Aber eben nicht auseinandergeschossen: Der Stoss klingt ab, bevor sie sich verlieren.
    assert(dist(a.pos, b.pos) < a.crowdRadius + b.crowdRadius, 'sie bleiben ein Pulk')
    assert(a.crowdRadius > a.radius, 'der Gedraenge-Halbmesser deckt den Umriss, nicht den Koerper')
  })

  check('wer mittig geschoben wird, dreht sich nicht', () => {
    // Der Stoss laeuft durch beide Mittelpunkte - dabei kann nichts kippen. Genau das
    // trennt Schieben von Streifen.
    const state = rig()
    const standing = planted(state, { x: 400, y: 0 }, 100)
    const runner = spawnEnemy(state, 'drone', 0) as Enemy
    runner.pos = { x: 400 + standing.radius, y: 0 }

    runTicks(state, 30, (s) => stepEnemies(s, STEP))
    assertClose(standing.spin, 0, 1e-9, 'der Stehende bleibt in seiner Lage')
    assertClose(runner.spin, 0, 1e-9, 'und der Laufende auch')
  })

  check('wer seitlich streift, dreht sich - und beide gegeneinander', () => {
    const state = rig()
    const standing = planted(state, { x: 400, y: 0 }, 100)
    const runner = spawnEnemy(state, 'drone', 0) as Enemy
    // Versetzt: Der Laufende erwischt ihn an der Schulter, nicht mittig.
    runner.pos = { x: 400 + standing.radius, y: standing.radius * 0.7 }

    runTicks(state, 30, (s) => stepEnemies(s, STEP))
    assert(Math.abs(standing.spin) > 1e-4, 'der Gestreifte muss sich drehen')
    assert(standing.spin * runner.spin < 0, 'und beide gegeneinander, wie zwei Zahnraeder')
    assert(
      Math.abs(standing.spin) <= SPIN_MAX + 1e-9 && Math.abs(runner.spin) <= SPIN_MAX + 1e-9,
      'nie so weit, dass die Form eine andere Gegnerart behauptet',
    )
  })

  check('ein angedockter Gegner wird nicht weggeschoben', () => {
    /*
     * Sonst risse ihn das Gedraengel von seinem Modul los, er dockte im naechsten Takt
     * erneut an - und die Station naehme Schaden im Takt des Gedraengels statt im Takt
     * seiner Schlaege.
     */
    const state = rig()
    const docked = planted(state, { x: 400, y: 0 }, 100)
    docked.dockedTo = CORE_UID
    const at = { ...docked.pos }

    const runner = spawnEnemy(state, 'drone', 0) as Enemy
    runner.pos = { x: 400 + docked.radius, y: 2 }

    runTicks(state, 60, (s) => stepEnemies(s, STEP))
    assertClose(dist(at, docked.pos), 0, 1e-9, 'er steht, wo er steht')
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

  check('ohne Ziel in Reichweite wird nicht geschossen', () => {
    const state = rig()
    planted(state, { x: 5000, y: 0 }, 100)
    assertEqual(findTarget(state.runtime.combat.enemies, { x: 0, y: 0 }, 200), null)
  })

  check('der naechste Gegner ist das Standardziel', () => {
    const state = rig()
    const far = planted(state, { x: 180, y: 0 }, 100)
    const near = planted(state, { x: 90, y: 0 }, 100)
    assertEqual(findTarget(state.runtime.combat.enemies, { x: 0, y: 0 }, 400)?.id, near.id)
    assert(far.id !== near.id, 'zwei verschiedene Gegner')
  })

  check('angedockte Gegner werden bevorzugt, auch wenn andere naeher sind', () => {
    // Ohne diese Regel schiessen die Tuerme auf Nachrueckende, waehrend die Station
    // zerlegt wird (GDD 07 Abschnitt 2).
    const state = rig()
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
      x: (tower.center.x / outward) * (outward + stats.range * 0.9),
      y: (tower.center.y / outward) * (outward + stats.range * 0.9),
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

  // ---------------------------------------------------------------------------
  // Der gezeichnete Wirkungsbereich
  // ---------------------------------------------------------------------------

  suite('render/wirkungsbereich')

  /*
   * `rangeBlobs` zeichnet nicht, es rechnet - deshalb steht es hier und nicht nur im Bild.
   * Der Umriss ist eine **Zusage an den Spieler**: Wo Flaeche liegt, wird geschossen. Was
   * die Tests festhalten, ist genau der Preis dieser Zusage - der weiche Zusammenschluss
   * darf den Bereich um hoechstens `merge / 4` groesser aussehen lassen, als er ist.
   */
  const MERGE = 44
  const CELL = 12
  /** Spielraum fuer die Gitterweite: Der Umriss liegt auf Gitterkanten, nicht exakt. */
  const GRID_SLACK = 3

  const circle = (x: number, y: number, range: number): RangeCircle => ({
    center: { x, y },
    range,
  })

  /** Der Abstand zur **echten** Vereinigung: negativ innerhalb, null auf dem Rand. */
  function unionDistance(circles: readonly RangeCircle[], x: number, y: number): number {
    let closest = Infinity
    for (const entry of circles) {
      const gap = Math.hypot(x - entry.center.x, y - entry.center.y) - entry.range
      if (gap < closest) closest = gap
    }
    return closest
  }

  check('ein einzelner Kreis ergibt einen Umriss auf seinem Rand', () => {
    const circles = [circle(0, 0, 200)]
    const loops = rangeBlobs(circles, MERGE, CELL)
    assertEqual(loops.length, 1, 'ein Kreis, eine Schleife')

    const loop = loops[0] as number[]
    assert(loop.length / 2 > 20, 'und die Schleife braucht genug Punkte fuer eine Rundung')
    for (let i = 0; i < loop.length; i += 2) {
      assertClose(
        Math.hypot(loop[i] as number, loop[i + 1] as number),
        200,
        GRID_SLACK,
        'jeder Punkt liegt auf dem Kreisrand',
      )
    }
  })

  check('ein Kreis im Inneren eines anderen veraendert den Umriss nicht', () => {
    // Der Grund, warum hier ein **weiches** Minimum steht und kein weiches Maximum: Ein
    // Turm, der nichts erweitert, soll unsichtbar bleiben. Sein Rand liegt 80 Einheiten
    // hinter dem grossen - weiter als `merge`, also ruehrt er ihn nicht an.
    const circles = [circle(0, 0, 200), circle(40, 0, 80)]
    const loops = rangeBlobs(circles, MERGE, CELL)
    assertEqual(loops.length, 1, 'der innere Kreis stiftet keine eigene Schleife')

    const loop = loops[0] as number[]
    for (let i = 0; i < loop.length; i += 2) {
      assertClose(
        Math.hypot(loop[i] as number, loop[i + 1] as number),
        200,
        GRID_SLACK,
        'der Umriss bleibt der des grossen Kreises',
      )
    }
  })

  check('zwei Tropfen verbinden sich erst, wenn sie sich nahe kommen', () => {
    // 15 Einheiten Luft zwischen den Raendern: Der Hals traegt bis `merge / 4` von jeder
    // Seite, das reicht - eine Form.
    assertEqual(rangeBlobs([circle(0, 0, 100), circle(215, 0, 100)], MERGE, CELL).length, 1)

    // 40 Einheiten sind zu viel, obwohl sie unter `merge` liegen: Getragen wird von beiden
    // Seiten je ein Viertel, zusammen also die halbe Spanne.
    assertEqual(rangeBlobs([circle(0, 0, 100), circle(240, 0, 100)], MERGE, CELL).length, 2)
  })

  check('der Umriss verspricht nie mehr als merge/4 ueber die echte Reichweite', () => {
    // Eine Station, wie sie wirklich dasteht: Kern in der Mitte, Tuerme ringsum am ersten
    // Ring, einer davon deutlich weiter.
    const circles = [
      circle(0, 0, 220),
      circle(76, 0, 185),
      circle(-38, 66, 215),
      circle(-38, -66, 340),
      circle(0, 97, 195),
    ]
    const loops = rangeBlobs(circles, MERGE, CELL)
    assert(loops.length === 1, 'eine zusammenhaengende Station ergibt einen Koerper')

    let worst = 0
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i += 2) {
        const gap = unionDistance(circles, loop[i] as number, loop[i + 1] as number)
        assert(
          gap > -GRID_SLACK,
          `der Umriss darf nicht in die Station hineinschneiden (${gap.toFixed(1)})`,
        )
        if (gap > worst) worst = gap
      }
    }
    assert(
      worst <= MERGE / 4 + GRID_SLACK,
      `hoechstens ${MERGE / 4} Einheiten Auftrag, gemessen ${worst.toFixed(1)}`,
    )
  })

  check('ohne Kreise gibt es keinen Umriss', () => {
    assertEqual(rangeBlobs([], MERGE, CELL).length, 0)
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
      reach: 0,
      sourceUid: CORE_UID,
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
      spawnProjectile(state, { x: 0, y: 0 }, enemy, { damage: 1, speed: 600, crit: false, color: '#fff', reach: 0, sourceUid: CORE_UID })
    }
    const created = combat.nextId
    runTicks(state, 120, (s) => stepProjectiles(s, STEP))
    assertEqual(combat.projectiles.length, 0, 'alle muessen angekommen sein')

    for (let i = 0; i < 40; i++) {
      spawnProjectile(state, { x: 0, y: 0 }, enemy, { damage: 1, speed: 600, crit: false, color: '#fff', reach: 0, sourceUid: CORE_UID })
    }
    assertEqual(combat.nextId, created, 'kein Wachstum ueber die Zeit')
  })

  check('ein Geschoss auf ein totes Ziel verfaellt', () => {
    const state = rig()
    const enemy = planted(state, { x: 300, y: 0 }, 10)
    spawnProjectile(state, { x: 0, y: 0 }, enemy, { damage: 1, speed: 20, crit: false, color: '#fff', reach: 0, sourceUid: CORE_UID })
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

    // Der toedliche Schuss ist der dritte. Er faellt nach zwei Nachladezeiten und braucht
    // danach die Flugzeit - gemessen bis zum Rand des Gegners, nicht bis zu seinem Zentrum.
    const interval = fireInterval(stats)
    const expected = 2 * interval + (distance - enemy.radius) / stats.projectileSpeed

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
    const record = waveRecord(state)
    const inventory = state.run.station.inventory.length
    const placed = state.run.station.placed.length

    damageStation(state, state.runtime.combat.maxStationHp, { x: 0, y: 0 })
    assertEqual(state.runtime.combat.stationHp, 0)

    stepBattle(state, STEP)

    assertEqual(state.run.wave, 5, 'dieselbe Welle, kein Rueckschritt')
    assertEqual(state.runtime.combat.stationHp, state.runtime.combat.maxStationHp, 'volle HP')
    assertEqual(state.run.gold, gold, 'Gold bleibt')
    assertEqual(waveRecord(state), record, 'der Wellenrekord bleibt')
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
    assertEqual(waveRecord(state), 12)
    assertEqual(state.permanent.bestWaveEver, 12)

    startWave(state, 4)
    assertEqual(waveRecord(state), 12, 'ein Rueckschritt senkt den Rekord nicht')
  })

  /*
   * Der Sprung darf **nicht weiter** als der Rekord.
   *
   * Das ist die ganze Regel, und sie ist die einzige Bremse, die dieses Bedienelement hat:
   * Ohne sie waere ein Feld, in das man eine Zahl tippt, die Abkuerzung an allem vorbei -
   * man schriebe 200 hinein und stuende im Endspiel. Geprueft wird deshalb beides, das
   * Erlaubte und das Verbotene, und dass ein verbotener Sprung die Welle **nicht anfasst**.
   */
  check('der Sprung geht bis zum Rekord und keinen Schritt weiter', () => {
    const state = rig()
    startWave(state, 12)
    startWave(state, 3)
    assertEqual(waveRecord(state), 12)

    assert(skipToWave(state, 12), 'der Rekord selbst ist erlaubt')
    assertEqual(state.run.wave, 12)

    assert(skipToWave(state, 1), 'zurueck ist immer erlaubt')
    assertEqual(state.run.wave, 1)

    assert(!skipToWave(state, 13), 'ein Schritt hinter den Rekord ist verboten')
    assert(!skipToWave(state, 200), 'und ein Sprung ins Endspiel erst recht')
    assert(!skipToWave(state, 0), 'unter Welle 1 gibt es nichts')
    assert(!skipToWave(state, Number.NaN), 'keine Zahl ist keine Welle')
    assertEqual(state.run.wave, 1, 'ein abgewiesener Sprung laesst die Welle stehen')

    assert(!skipToWave(state, 1), 'die Welle, auf der man steht, ist kein Sprung')
  })

  check('die naechste Welle oeffnet sich, sobald man die eigene gespielt hat', () => {
    const state = rig()
    startWave(state, 12)
    assert(!skipToWave(state, 14), 'zwei Schritte weiter bleibt zu')

    // Die 13 zu spielen ist der Weg dorthin - danach ist sie Rekord und damit Sprungziel.
    startWave(state, 13)
    startWave(state, 5)
    assert(skipToWave(state, 13), 'gespielt heisst erreichbar')
    assertEqual(state.run.wave, 13)
  })

  suite('app/actions · Platzierungsquittung')

  check('ein gesetztes Modul rastet ein - und der Vermerk verfaellt von selbst', () => {
    /*
     * GDD 13 Abschnitt 10: "Platzieren von Modulen" gehoert zu den Dingen, die sichtbar
     * sein muessen. Geprueft wird der **Vermerk**, nicht das Bild: dass er beim Andocken
     * entsteht, dass er dem richtigen Modul gehoert, und - das ist der eigentliche Punkt -
     * dass er wieder verschwindet. Ein Eintrag, der liegen bleibt, waere ein Modul, das
     * fuer immer aufleuchtet, und ein Speicher, der mit jedem Bau waechst.
     */
    const state = rig()
    const combat = state.runtime.combat
    const module = stock(state, 'autocannon')

    invalidateStationView(state)
    const edge = stationView(state).freeEdges[0]
    assert(edge !== undefined, 'die Station muss eine freie Kante haben')

    assertEqual(combat.placings.size, 0)
    assertEqual(placeModule(state, module.uid, edge), null)
    assertEqual(combat.placings.size, 1)
    assert(combat.placings.has(module.uid), 'der Vermerk gehoert dem gesetzten Modul')

    // Kurz danach steht er noch, spaeter nicht mehr.
    stepEffects(state, PLACING_LIFE * 0.5)
    assert(combat.placings.has(module.uid), 'nach der halben Zeit muss er noch stehen')
    stepEffects(state, PLACING_LIFE)
    assertEqual(combat.placings.size, 0, 'danach muss er verfallen sein')
  })

  check('waehrend der Abwesenheit entsteht keine Quittung', () => {
    // Sie ist reine Anzeige. Ohne Zuschauer waere sie Arbeit fuer den Papierkorb - dieselbe
    // Regel wie bei Splittern und Druckwellen.
    const state = rig()
    state.runtime.combat.observed = false

    const module = stock(state, 'autocannon')
    invalidateStationView(state)
    const edge = stationView(state).freeEdges[0]
    assert(edge !== undefined, 'die Station muss eine freie Kante haben')

    placeModule(state, module.uid, edge)
    assertEqual(state.runtime.combat.placings.size, 0)
  })

  check('ein Gegner mit voller HP hat die Werte seiner Welle', () => {
    const state = rig()
    startWave(state, 1)
    // Den Wert festhalten statt den Gegner: `startWave` raeumt das Feld, der Gegner
    // wandert in den Pool - und der naechste Spawn ist dasselbe Objekt.
    const early = (spawnEnemy(state, 'drone', 0) as Enemy).maxHp
    assertClose(early, ENEMY_BASE_HP, 1e-9, 'Welle 1 ist der Grundwert')

    startWave(state, 11)
    const later = (spawnEnemy(state, 'drone', 0) as Enemy).maxHp
    assert(later > early * 2, `Welle 11 muss deutlich haerter sein: ${later} gegen ${early}`)
  })

  suite('sim/combat · Schadenszahlen')

  check('jeder Treffer legt eine Zahl ab - der Vorrat traegt eine dichte Welle', () => {
    /*
     * Die Zahl ueber dem Gegner ist die Quittung des Schusses (GDD 13 Abschnitt 10). Zwei
     * Dinge muessen stimmen, und beide sind Zahlen und keine Meinung: Es entsteht **je
     * Treffer** eine, und der Vorrat ist gross genug, dass eine dichte Welle nicht die
     * eigenen frischen Zahlen ueberschreibt, bevor man sie gesehen hat.
     */
    const state = rig()
    const combat = state.runtime.combat
    assert(
      combat.damages.length >= 48,
      `der Ringspeicher muss eine dichte Welle tragen, hat aber ${combat.damages.length} Plaetze`,
    )

    const enemy = planted(state, { x: 200, y: 0 }, 1e9)
    for (let i = 0; i < 12; i++) applyDamage(state, enemy, 37)

    const aktiv = combat.damages.filter((entry) => entry.active)
    assertEqual(aktiv.length, 12, 'zwoelf Treffer, zwoelf Zahlen')
    for (const entry of aktiv) assertClose(entry.value, 37, 1e-9)

    // Und sie verfallen von selbst - ein Vorrat, der voll bleibt, waere ein Ziffernteppich.
    stepEffects(state, DAMAGE_LIFE * 1.1)
    assertEqual(combat.damages.filter((entry) => entry.active).length, 0)
  })

  check('ein getroffener Gegner blitzt auf und verlischt wieder', () => {
    /*
     * Die Trefferquittung am Gegner (GDD 13 Abschnitt 10).
     *
     * Ohne sie zeigt der Einschlag nur auf eine Stelle und nicht auf ein Ziel: Im dichten
     * Pulk stehen mehrere Gegner in derselben Handbreit, und wer getroffen wurde, waere
     * nicht zu sehen.
     */
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1e9)
    assertEqual(enemy.flashLife, 0, 'ein unbehelligter Gegner leuchtet nicht')

    applyDamage(state, enemy, 25)
    assert(enemy.flashLife > 0, 'der Treffer hellt den Getroffenen auf')
    assertClose(enemy.flash, 0, 1e-9, 'die Quittung faengt bei null an')

    // Ein zweiter Treffer setzt sie zurueck, statt sie zu verlaengern: zweimal aufblitzen,
    // nicht einmal doppelt so lang leuchten.
    stepEffects(state, ENEMY_FLASH_LIFE * 0.5)
    assert(enemy.flash > 0, 'sie altert')
    applyDamage(state, enemy, 25)
    assertClose(enemy.flash, 0, 1e-9, 'der naechste Treffer beginnt von vorn')

    // Und sie verlischt von selbst - ein Gegner, der leuchten bleibt, meldet einen Treffer,
    // den es nicht mehr gibt.
    stepEffects(state, ENEMY_FLASH_LIFE * 1.2)
    assertEqual(enemy.flashLife, 0, 'nach ihrer Zeit ist sie aus')
  })

  check('Brandschaden hellt den Gegner nicht auf', () => {
    /*
     * Die Verbrennung trifft sechzigmal je Sekunde. Eine Aufhellung je Takt waere kein
     * Aufblitzen mehr, sondern ein zweiter Anstrich - und der brennende Gegner traegt mit
     * seinem Glimmen bereits seinen eigenen Zustand.
     */
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1e9)

    applyDamage(state, enemy, 5, { overTime: true })
    assertEqual(enemy.flashLife, 0, 'Schaden je Takt quittiert nicht')
  })

  check('ein Gegner aus dem Pool bringt keine fremde Trefferquittung mit', () => {
    // Gegner kommen aus einem Pool. Erschiene einer mit dem Aufblitzen seines Vorgaengers,
    // meldete das Bild einen Treffer, den es nie gab.
    const state = rig()
    const erster = planted(state, { x: 200, y: 0 }, 1e9)
    applyDamage(state, erster, 25)
    assert(erster.flashLife > 0, 'der erste traegt seine Quittung')

    erster.hp = 0
    applyDamage(state, erster, 1)
    assertEqual(erster.active, false, 'er ist gefallen und liegt im Pool')

    const zweiter = spawnEnemy(state, erster.defId, 0)
    assert(zweiter !== null, 'der Pool gibt ihn wieder her')
    assertEqual(zweiter.flashLife, 0, 'der Nachfolger erscheint dunkel')
    assertEqual(zweiter.flash, 0)
  })

  check('die laufende Nummer ordnet die Zahlen nach Alter', () => {
    // Die Zeichenebene liest daraus, welche zwei Zahlen die frischen sind. Zwei Treffer im
    // selben Takt haben dasselbe Alter, aber nie dieselbe Nummer - genau deshalb gibt es
    // sie.
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1e9)

    applyDamage(state, enemy, 10)
    applyDamage(state, enemy, 20)
    const [erste, zweite] = state.runtime.combat.damages.filter((entry) => entry.active)
    assert(erste !== undefined && zweite !== undefined, 'zwei Treffer, zwei Zahlen')
    assert(zweite.seq > erste.seq, 'die spaetere Zahl traegt die groessere Nummer')
    assertClose(erste.age, zweite.age, 1e-9, 'gleicher Takt heisst gleiches Alter')
  })

  check('aufeinanderfolgende Zahlen weichen zu verschiedenen Seiten aus', () => {
    /*
     * Ein Turm mit acht Schuessen je Sekunde setzt acht Zahlen an denselben Gegner. Wuerfelte
     * jede ihre Seite selbst aus, faellt in der Haelfte aller Faelle zweimal hintereinander
     * dieselbe - und dann stehen zwei Zahlen uebereinander statt nebeneinander. Der Wechsel
     * haengt deshalb an der laufenden Nummer und nicht am Wurf; ausgewuerfelt wird nur, wie
     * weit es zur Seite geht, damit keine zwei geraden Reihen entstehen.
     */
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1e9)

    for (let i = 0; i < 8; i++) applyDamage(state, enemy, 12)
    const drifts = state.runtime.combat.damages
      .filter((entry) => entry.active)
      .sort((a, b) => a.seq - b.seq)
      .map((entry) => entry.drift)

    assertEqual(drifts.length, 8, 'acht Treffer, acht Zahlen')
    for (let i = 1; i < drifts.length; i++) {
      const vorher = drifts[i - 1] as number
      const jetzt = drifts[i] as number
      assert(
        vorher * jetzt < 0,
        `Zahl ${i} weicht zur selben Seite aus wie ihre Vorgaengerin (${vorher} / ${jetzt})`,
      )
      assert(Math.abs(jetzt) >= 0.45, 'der Ausschlag meidet die Null')
    }
  })

  check('bei Tempo x4 wird ausgeduennt, nicht beschleunigt', () => {
    /*
     * Hausregel fuer jeden Effekt: Bei hohem Tempo faellt viermal so viel Schaden je echter
     * Sekunde an. Gezeigt wird jede vierte Zahl - sonst waere aus der Auskunft ein Teppich
     * geworden. Gezaehlt werden trotzdem alle: Die Nummer ordnet, sie duennt nicht aus.
     */
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1e9)

    state.runtime.speedFactor = 4
    for (let i = 0; i < 16; i++) applyDamage(state, enemy, 5)

    const combat = state.runtime.combat
    assertEqual(combat.damageSeq, 16, 'gemeldet werden alle Treffer')
    assertEqual(combat.damages.filter((entry) => entry.active).length, 4, 'gezeigt jeder vierte')
  })

  check('Verbrennung tickt ohne eigene Zahl', () => {
    // Sechzig Takte je Sekunde mit einem Sechzigstel der Wirkung: Als Zahl waere das ein
    // Zaehlwerk statt eines Treffers. Der Schaden selbst kommt trotzdem an.
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1000)

    applyBurn(state, enemy, 60, 1)
    runTicks(state, 30, (s) => stepEnemyStates(s, STEP))

    assert(enemy.hp < 1000, 'die Verbrennung muss Schaden anrichten')
    assertEqual(
      state.runtime.combat.damages.filter((entry) => entry.active).length,
      0,
      'aber keine einzige Zahl hinterlassen',
    )
  })

  check('keine Schadenszahl wird laenger als sieben Zeichen', () => {
    /*
     * Die Zeichenebene setzt die Zahl ueber `formatNumber` (`core/format.ts`) und nirgends
     * sonst. Das ist der Grund, warum zwanzig Zahlen gleichzeitig im Bild stehen koennen:
     * Ein ausgeschriebener Betrag der spaeten Wellen waere breiter als die Station.
     */
    for (const wert of [0, 7, 99, 9999, 10_000, 111_570, 7_970_000, 4.384e9, 1e14, 1e120]) {
      const text = formatNumber(Math.round(wert))
      assert(text.length <= 7, `"${text}" ist ${text.length} Zeichen lang`)
    }
  })

  check('ohne Zuschauer entsteht keine Schadenszahl', () => {
    // Dieselbe Regel wie bei Splittern und Druckwellen: Waehrend der Abwesenheitsrechnung
    // fallen zehntausende Treffer, und jede Zahl davon waere Arbeit fuer den Papierkorb.
    const state = rig()
    const enemy = planted(state, { x: 200, y: 0 }, 1e9)
    state.runtime.combat.observed = false

    applyDamage(state, enemy, 42)
    assertEqual(state.runtime.combat.damages.filter((entry) => entry.active).length, 0)
  })
}
