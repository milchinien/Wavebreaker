/**
 * Beweis aus E14 und E15.
 *
 * Beide Etappen haben dieselbe Abnahmebedingung, nur einmal fuer Tuerme und einmal fuer
 * Gegner formuliert:
 *
 *   E14: "jede neue Turmart ist ueber einen Datensatz plus hoechstens eine Mechanikfunktion
 *         erledigt"
 *   E15: "neue Gegner erfordern keine Aenderung am Kampfkern"
 *
 * Eine Bedingung ueber **Code** laesst sich nicht direkt pruefen. Was sich pruefen laesst,
 * ist ihre Folge: Jede Mechanik muss fuer sich funktionieren, ohne dass der Aufrufer sie
 * kennt - und jeder Datensatz muss allein durch seine Felder wirken. Genau das steht unten.
 * Schlaegt hier etwas fehl, ist eine Mechanik an ihren Turm gebunden statt an ihre Wirkung.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { ELITE_FROM_WAVE } from '../../data/balance.ts'
import {
  bossForWave,
  ELITE_MODIFIERS,
  eliteById,
  ENEMIES,
  enemyById,
} from '../../data/enemies.ts'
import { RARITY_RANGE } from '../../data/rarities.ts'
import { TOWERS, towerById } from '../../data/towers.ts'
import { PRESTIGE_NODES } from '../../data/prestige.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import {
  applyBurn,
  applyChain,
  applyChill,
  applyDamage,
  applyExplosion,
  berserkFactor,
  createCombatState,
  killEnemy,
  stepEnemyStates,
} from '../../sim/combat.ts'
import { stepDrones } from '../../sim/drones.ts'
import {
  applyEliteModifier,
  eliteChance,
  spawnEnemy,
  stepEnemyAbilities,
} from '../../sim/enemies.ts'
import { freeEdges, newModule, place, type FreeEdge } from '../../sim/station.ts'
import { maxStationHp } from '../../sim/stats.ts'
import { findTarget } from '../../sim/targeting.ts'

function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(1234)
  state.runtime.combat = createCombatState()
  state.runtime.combat.phase = 'running'
  sync(state)
  return state
}

function sync(state: GameState): void {
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
}

/** Einen Gegner an eine feste Stelle setzen, mit bekannter Lebensmenge. */
function put(state: GameState, defId: string, x: number, y: number, hp = 100000) {
  const enemy = spawnEnemy(state, defId, 0)
  assert(enemy !== null, `${defId} muss erscheinen`)
  enemy.pos.x = x
  enemy.pos.y = y
  enemy.maxHp = hp
  enemy.hp = hp
  return enemy
}

/** Einen Turm an den Kern setzen und die Sicht gleichziehen. */
function build(state: GameState, defId: string): string {
  const station = state.run.station
  station.slots = Math.max(station.slots, station.placed.length + 1)
  const module = newModule(station, defId, 'common')
  station.inventory.push(module)
  const edge = freeEdges(station).find((candidate) => candidate.ownerUid === 'core') as FreeEdge
  place(station, module.uid, edge)
  sync(state)
  return module.uid
}

export function contentSuite(): void {
  suite('data/inhalte')

  // -------------------------------------------------------------------------
  // Die Datensaetze selbst
  // -------------------------------------------------------------------------

  check('jede Turmart hat eine Raritaetsspanne (GDD 06 Abschnitt 9)', () => {
    for (const tower of TOWERS) {
      const range = RARITY_RANGE[tower.id]
      assert(range !== undefined, `${tower.id} fehlt in RARITY_RANGE`)
    }
  })

  check('jede Freischaltung eines Turms zeigt auf einen echten Knoten', () => {
    for (const tower of TOWERS) {
      if (!tower.unlock) continue
      assert(
        PRESTIGE_NODES.some((node) => node.id === tower.unlock),
        `${tower.id} verlangt ${tower.unlock}, das es nicht gibt`,
      )
    }
  })

  check('kein Turm ist nur eine staerkere Version eines anderen (GDD 05 Abschnitt 1)', () => {
    // Zwei Tuerme derselben Kategorie duerfen nicht in **allen** Kampfwerten schlechter
    // beziehungsweise besser sein - dann waere einer davon ueberfluessig.
    for (const a of TOWERS) {
      for (const b of TOWERS) {
        if (a === b || a.category !== b.category) continue
        const worse =
          a.stats.damage <= b.stats.damage &&
          a.stats.attackSpeed <= b.stats.attackSpeed &&
          a.stats.range <= b.stats.range
        const different = a.mechanic?.kind !== b.mechanic?.kind
        assert(
          !worse || different || a.stats.damage === b.stats.damage,
          `${a.id} ist in allem schlechter als ${b.id} und hat dieselbe Mechanik`,
        )
      }
    }
  })

  check('ein Beschwoerer beschwoert nur, was es gibt', () => {
    for (const enemy of ENEMIES) {
      for (const ability of enemy.abilities ?? []) {
        if (ability.kind !== 'spawn') continue
        assert(
          ENEMIES.some((candidate) => candidate.id === ability.defId),
          `${enemy.id} beschwoert ${ability.defId}, das es nicht gibt`,
        )
      }
    }
  })

  check('der zustaendige Boss loest seinen Vorgaenger ab (GDD 07 Abschnitt 7)', () => {
    assertEqual(bossForWave(10).id, 'titan')
    assertEqual(bossForWave(40).id, 'titan')
    assertEqual(bossForWave(50).id, 'swarmmother')
    assertEqual(bossForWave(150).id, 'behemoth')
    assertEqual(bossForWave(1000).id, 'overlord')
  })

  // -------------------------------------------------------------------------
  // Mechaniken (E14)
  // -------------------------------------------------------------------------

  check('eine Explosion trifft den Umkreis, nicht das ganze Feld', () => {
    const state = rig()
    const near = put(state, 'drone', 40, 0)
    const far = put(state, 'drone', 900, 0)

    const hit = applyExplosion(state, { x: 0, y: 0 }, 120, 500)
    assertEqual(hit, 1, 'genau einer stand im Umkreis')
    assert(near.hp < near.maxHp, 'der nahe nimmt Schaden')
    assertEqual(far.hp, far.maxHp, 'der ferne nicht')
  })

  check('das getroffene Ziel bekommt den Flaechenschaden nicht doppelt', () => {
    const state = rig()
    const target = put(state, 'drone', 40, 0)
    const other = put(state, 'drone', 60, 0)

    applyExplosion(state, target.pos, 120, 500, target)
    assertEqual(target.hp, target.maxHp, 'das Ziel ist ausgenommen')
    assert(other.hp < other.maxHp, 'der Nachbar nicht')
  })

  check('ein Kettenblitz springt weiter und verliert dabei Kraft', () => {
    const state = rig()
    const first = put(state, 'drone', 0, 0)
    const second = put(state, 'drone', 60, 0)
    const third = put(state, 'drone', 120, 0)

    const jumps = applyChain(state, first, 3, 0.5, 1000, 100)
    assertEqual(jumps, 2, 'zwei weitere Ziele in Reichweite')
    assertEqual(first.hp, first.maxHp, 'der Ausgangsgegner bekommt nichts ab')
    assertClose(second.maxHp - second.hp, 500, 1e-6, 'erster Sprung: halbe Kraft')
    assertClose(third.maxHp - third.hp, 250, 1e-6, 'zweiter Sprung: nochmal halbiert')
  })

  check('ein Kettenblitz trifft niemanden zweimal', () => {
    const state = rig()
    const first = put(state, 'drone', 0, 0)
    const second = put(state, 'drone', 30, 0)

    applyChain(state, first, 5, 1, 100, 200)
    assertClose(second.maxHp - second.hp, 100, 1e-6, 'genau ein Treffer')
  })

  check('eine Verbrennung wirkt ueber Zeit und laeuft aus', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0)

    applyBurn(state, enemy, 50, 2)
    stepEnemyStates(state, 1)
    assertClose(enemy.maxHp - enemy.hp, 50, 1e-6, 'eine Sekunde, fuenfzig Schaden')

    stepEnemyStates(state, 1)
    assertClose(enemy.maxHp - enemy.hp, 100, 1e-6, 'zwei Sekunden, hundert')

    stepEnemyStates(state, 1)
    assertClose(enemy.maxHp - enemy.hp, 100, 1e-6, 'danach nichts mehr')
    assertEqual(enemy.burnDps, 0, 'und die Verbrennung ist weg')
  })

  check('zwei Verbrennungen stapeln nicht, die staerkere gewinnt', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0)

    applyBurn(state, enemy, 50, 2)
    applyBurn(state, enemy, 20, 5)
    assertEqual(enemy.burnDps, 50, 'der staerkere Wert')
    assert(enemy.burnLeft >= 5, 'die laengere Dauer')
  })

  check('eine Verlangsamung bremst und haelt nie an', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0)

    applyChill(state, enemy, 0.5, 2)
    assertEqual(enemy.chillFactor, 0.5)

    // Auch ein absurder Wert kann keinen Stillstand erzeugen.
    applyChill(state, enemy, 0, 2)
    assert(enemy.chillFactor >= 0.1, `Faktor war ${enemy.chillFactor}`)

    stepEnemyStates(state, 3)
    assertEqual(enemy.chillFactor, 1, 'danach wieder normal')
  })

  check('ein Schildgenerator vergroessert die gemeinsame Huelle', () => {
    const state = rig()
    const before = maxStationHp(state)
    build(state, 'bulwark')
    assert(maxStationHp(state) > before, `${maxStationHp(state)} gegen ${before}`)
  })

  check('ein Drohnenmodul startet seine Drohnen und nimmt sie wieder mit', () => {
    const state = rig()
    const uid = build(state, 'dronebay')
    const spec = towerById('dronebay').mechanic
    assert(spec?.kind === 'drones', 'das Modul muss Drohnen haben')

    stepDrones(state, 0.1)
    assertEqual(state.runtime.combat.drones.length, spec.count, 'so viele wie im Datensatz')

    // Modul entfernen - die Drohnen muessen mitgehen.
    state.run.station.placed = state.run.station.placed.filter((module) => module.uid !== uid)
    sync(state)
    stepDrones(state, 0.1)
    assertEqual(state.runtime.combat.drones.length, 0, 'ohne Modul keine Drohnen')
  })

  check('Drohnen kreisen um ihr Modul und schiessen von dort', () => {
    const state = rig()
    build(state, 'dronebay')
    stepDrones(state, 0.1)

    const drone = state.runtime.combat.drones[0]
    assert(drone !== undefined, 'es muss eine Drohne geben')
    const first = { x: drone.pos.x, y: drone.pos.y }

    stepDrones(state, 0.5)
    assert(
      Math.hypot(drone.pos.x - first.x, drone.pos.y - first.y) > 1,
      'sie muss sich bewegt haben',
    )

    const enemy = put(state, 'drone', drone.pos.x + 20, drone.pos.y)
    stepDrones(state, 1)
    assert(enemy.hp < enemy.maxHp, 'und treffen, was in ihre Reichweite kommt')
  })

  // -------------------------------------------------------------------------
  // Gegnerfaehigkeiten (E15)
  // -------------------------------------------------------------------------

  check('ein Schild faengt einen Anteil jedes Treffers ab', () => {
    const state = rig()
    const plain = put(state, 'drone', 0, 0)
    const shielded = put(state, 'shielded', 40, 0)

    applyDamage(state, plain, 100)
    applyDamage(state, shielded, 100)

    assertClose(plain.maxHp - plain.hp, 100, 1e-6)
    const taken = shielded.maxHp - shielded.hp
    assert(taken > 0 && taken < 100, `der Schild muss abfangen, war ${taken}`)
  })

  check('kein Schild macht unverwundbar', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0)
    enemy.shield = 5 // absurd hoch - der Deckel muss greifen
    applyDamage(state, enemy, 100)
    assert(enemy.hp < enemy.maxHp, 'es muss Schaden ankommen')
  })

  check('ein Reflektor gibt einen Anteil an die Station zurueck', () => {
    const state = rig()
    const combat = state.runtime.combat
    combat.maxStationHp = 10000
    combat.stationHp = 10000

    const enemy = put(state, 'reflector', 40, 0)
    applyDamage(state, enemy, 1000)
    assert(combat.stationHp < 10000, 'die Station muss etwas abbekommen haben')
  })

  check('ein Berserker wird staerker, je weniger Leben er hat', () => {
    const state = rig()
    const enemy = put(state, 'berserker', 40, 0, 1000)

    assertClose(berserkFactor(enemy), 1, 1e-9, 'bei vollem Leben kein Zuschlag')
    enemy.hp = 500
    assertClose(berserkFactor(enemy), 1 + 1.5 * 0.5, 1e-9, 'bei halbem Leben halber Zuschlag')
    enemy.hp = 1
    assert(berserkFactor(enemy) > 2, 'kurz vor dem Tod am gefaehrlichsten')
  })

  check('ein gewoehnlicher Gegner hat keinen Zuschlag', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0, 1000)
    enemy.hp = 1
    assertEqual(berserkFactor(enemy), 1, 'ohne die Faehigkeit passiert nichts')
  })

  check('ein Heiler heilt andere, nicht sich selbst', () => {
    const state = rig()
    const healer = put(state, 'healer', 0, 0, 1000)
    const hurt = put(state, 'drone', 50, 0, 1000)
    hurt.hp = 100
    healer.hp = 100

    stepEnemyAbilities(state, 2)
    assert(hurt.hp > 100, 'der Verletzte muss geheilt werden')
    assertEqual(healer.hp, 100, 'der Heiler selbst nicht')
  })

  check('ein Heiler erreicht nur seinen Umkreis', () => {
    const state = rig()
    put(state, 'healer', 0, 0)
    const far = put(state, 'drone', 5000, 0, 1000)
    far.hp = 100

    stepEnemyAbilities(state, 2)
    assertEqual(far.hp, 100, 'weit weg bleibt verletzt')
  })

  check('eine Tarn-Einheit ist zeitweise kein Ziel', () => {
    const state = rig()
    const phantom = put(state, 'phantom', 40, 0)

    // Sichtbar zu Beginn.
    stepEnemyAbilities(state, 0.1)
    assert(
      findTarget([phantom], { x: 0, y: 0 }, 500) !== null,
      'sichtbar muss sie ein Ziel sein',
    )

    // Weit genug in den Zyklus hinein, dass sie verschwunden ist.
    stepEnemyAbilities(state, 2)
    assertEqual(phantom.cloak < 0, true, 'jetzt ist sie getarnt')
    assertEqual(
      findTarget([phantom], { x: 0, y: 0 }, 500),
      null,
      'und damit kein Ziel',
    )
  })

  check('ein Teleporter springt zur Station hin, nie darueber hinaus', () => {
    const state = rig()
    const blink = put(state, 'blink', 800, 0)

    stepEnemyAbilities(state, 3)
    assert(blink.pos.x < 800, 'er muss naeher gekommen sein')
    assert(blink.pos.x > 0, 'aber nicht durch die Station hindurch')
  })

  check('ein Beschwoerer erzeugt weitere Gegner', () => {
    const state = rig()
    put(state, 'spawner', 300, 0)
    const before = state.runtime.combat.enemies.length

    stepEnemyAbilities(state, 5)
    assert(
      state.runtime.combat.enemies.length > before,
      `${state.runtime.combat.enemies.length} gegen ${before}`,
    )
  })

  check('ein Verstaerker hebt die Nachbarn, aber nicht ins Unendliche', () => {
    const state = rig()
    put(state, 'empowerer', 0, 0)
    const other = put(state, 'drone', 50, 0)
    const base = other.damage

    for (let i = 0; i < 200; i++) stepEnemyAbilities(state, 2.1)
    assert(other.damage > base, 'er muss wirken')
    assert(other.damage < base * 100, `aber gedeckelt bleiben, war ${other.damage / base}x`)
  })

  // -------------------------------------------------------------------------
  // Elite-Gegner (E15)
  // -------------------------------------------------------------------------

  check('vor Welle 50 gibt es keine Elites (GDD 07 Abschnitt 6)', () => {
    for (const wave of [1, 10, 49]) assertEqual(eliteChance(wave), 0, `Welle ${wave}`)
    assert(eliteChance(ELITE_FROM_WAVE + 100) > 0, 'danach schon')
  })

  check('die Elite-Chance steigt mit der Welle und ist gedeckelt', () => {
    assert(eliteChance(200) > eliteChance(100), 'sie muss steigen')
    assert(eliteChance(100000) <= 0.5, `der Deckel muss greifen, war ${eliteChance(100000)}`)
  })

  check('ein Modifikator verstaerkt und laesst den Gegner er selbst bleiben', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0, 100)
    const before = { hp: enemy.maxHp, defId: enemy.defId }

    applyEliteModifier(enemy, eliteById('elite.tough'))
    assert(enemy.maxHp > before.hp, 'mehr Leben')
    assertEqual(enemy.hp, enemy.maxHp, 'und voll geheilt')
    assertEqual(enemy.defId, before.defId, 'aber derselbe Gegnertyp')
    assertEqual(enemy.elite.join(','), 'elite.tough')
  })

  check('zwei Modifikatoren stapeln sich', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0, 100)
    const base = enemy.maxHp

    applyEliteModifier(enemy, eliteById('elite.tough'))
    applyEliteModifier(enemy, eliteById('elite.regen'))

    const tough = eliteById('elite.tough').hp ?? 1
    const regen = eliteById('elite.regen').hp ?? 1
    assertClose(enemy.maxHp, base * tough * regen, 1e-6)
    assert(enemy.regen > 0, 'und die Regeneration ist dazugekommen')
  })

  check('ein Volatile-Elite explodiert beim Tod', () => {
    const state = rig()
    const bomb = put(state, 'drone', 0, 0, 100)
    applyEliteModifier(bomb, eliteById('elite.volatile'))
    bomb.damage = 100

    const neighbour = put(state, 'drone', 60, 0)
    killEnemy(state, bomb)

    assert(neighbour.hp < neighbour.maxHp, 'der Nachbar muss etwas abbekommen')
  })

  check('jeder Modifikator ist auffindbar', () => {
    for (const modifier of ELITE_MODIFIERS) {
      assertEqual(eliteById(modifier.id).id, modifier.id)
    }
  })

  check('Regeneration heilt, aber nie ueber das Maximum', () => {
    const state = rig()
    const enemy = put(state, 'drone', 0, 0, 1000)
    enemy.hp = 500
    enemy.regen = 100

    stepEnemyStates(state, 1)
    assertClose(enemy.hp, 600, 1e-6)

    stepEnemyStates(state, 100)
    assertEqual(enemy.hp, enemy.maxHp, 'nie darueber hinaus')
  })

  check('ein Gegner aus dem Pool erbt nichts von seinem Vorgaenger', () => {
    const state = rig()
    const first = put(state, 'shielded', 0, 0)
    applyEliteModifier(first, eliteById('elite.tough'))
    applyBurn(state, first, 50, 5)
    killEnemy(state, first)

    // Derselbe Platz, andere Art - nichts darf mitkommen.
    const second = spawnEnemy(state, 'drone', 0)
    assert(second !== null, 'der zweite muss erscheinen')
    assertEqual(second.shield, 0, 'kein geerbter Schild')
    assertEqual(second.burnDps, 0, 'keine geerbte Verbrennung')
    assertEqual(second.elite.length, 0, 'kein geerbter Modifikator')
    assertEqual(enemyById(second.defId).id, 'drone')
  })
}
