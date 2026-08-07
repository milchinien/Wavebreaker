/**
 * Beweis aus E4: Welle 1 und Welle 50 erzeugen unterschiedliche, aber plausible
 * Zusammensetzungen - und `buildWave` ist rein und mit festem Seed reproduzierbar.
 *
 * Reproduzierbarkeit ist hier kein Selbstzweck: Ohne sie laesst sich ein Balancing-Fehler
 * nicht nachstellen, und beim Zurueckskippen auf Welle 20 waere nicht mehr dieselbe
 * Welle 20 (GDD 07 Abschnitt 10).
 */

import { assert, assertClose, assertDeepEqual, assertEqual, check, suite } from '../../core/assert.ts'
import { createRng } from '../../core/rng.ts'
import {
  MAX_SPEED_SCALE,
  WAVE_SCALING,
  WAVE_SPAWN_WINDOW_SECONDS,
} from '../../data/balance.ts'
import { ENEMIES, enemiesForWave } from '../../data/enemies.ts'
import { buildWave, enemyCount, scaleFor } from '../../sim/waves.ts'

function plan(wave: number, seed = 1) {
  return buildWave(wave, createRng(seed))
}

function kinds(wave: number, seed = 1): string[] {
  return [...new Set(plan(wave, seed).spawns.map((spawn) => spawn.defId))].sort()
}

export function wavesSuite(): void {
  suite('sim/waves')

  check('gleiche Welle und gleicher Seed ergeben dieselbe Welle', () => {
    assertDeepEqual(plan(17, 4711), plan(17, 4711))
  })

  check('ein anderer Seed ergibt eine andere Welle', () => {
    const a = plan(17, 1)
    const b = plan(17, 2)
    assert(
      a.spawns.some((spawn, i) => spawn.defId !== b.spawns[i]?.defId || spawn.at !== b.spawns[i]?.at),
      'die Wellen duerfen nicht identisch sein',
    )
  })

  check('buildWave hat keine Nebenwirkung auf den Generator', () => {
    // Rein heisst: zweimal aufrufen aendert nichts an der Welt.
    const rng = createRng(7)
    const before = rng.state()
    buildWave(5, createRng(7))
    assertEqual(rng.state(), before)
  })

  check('Welle 1 enthaelt nur die Gegnerarten, die es dort gibt', () => {
    // GDD 07 Abschnitt 11: neue Gegner erscheinen stufenweise, nicht alle auf einmal.
    assertDeepEqual(kinds(1), ['drone'])
  })

  check('spaetere Wellen mischen mehr Arten', () => {
    const early = kinds(1)
    const late = kinds(60, 3)
    assert(late.length > early.length, `Welle 60 hatte nur ${late.join(', ')}`)
    for (const id of late) {
      assert(
        enemiesForWave(60).some((def) => def.id === id),
        `${id} darf auf Welle 60 nicht vorkommen`,
      )
    }
  })

  check('keine Gegnerart erscheint vor ihrer Freischaltwelle', () => {
    for (const def of ENEMIES) {
      if (def.fromWave <= 1) continue
      const before = kinds(def.fromWave - 1, 9)
      assert(!before.includes(def.id), `${def.id} erschien schon auf Welle ${def.fromWave - 1}`)
    }
  })

  check('die Gegnerzahl waechst mit der Welle', () => {
    assert(enemyCount(50) > enemyCount(10), 'Welle 50 muss mehr Gegner haben als Welle 10')
    assert(enemyCount(10) > enemyCount(1), 'Welle 10 muss mehr Gegner haben als Welle 1')
    assertEqual(plan(1).spawns.length, enemyCount(1))
    assertEqual(plan(50).spawns.length, enemyCount(50))
  })

  check('die Skalierung ist nicht linear', () => {
    // Der Zuwachs von Welle 40 auf 50 muss groesser sein als der von 1 auf 11.
    const early = scaleFor(11, WAVE_SCALING) - scaleFor(1, WAVE_SCALING)
    const late = scaleFor(50, WAVE_SCALING) - scaleFor(40, WAVE_SCALING)
    assert(late > early, `spaeter Zuwachs ${late} muss ueber frueherem ${early} liegen`)
  })

  check('Welle 1 hat den Faktor 1', () => {
    assertClose(plan(1).hpScale, 1, 1e-12)
    assertClose(plan(1).damageScale, 1, 1e-12)
    assertClose(plan(1).rewardScale, 1, 1e-12)
  })

  check('das Tempo ist gedeckelt, damit Gegner nie durch die Station fliegen', () => {
    assertEqual(plan(5000).speedScale, MAX_SPEED_SCALE)
  })

  check('die Gegner erscheinen gestaffelt, nicht auf einmal', () => {
    const spawns = plan(20, 5).spawns
    const times = spawns.map((spawn) => spawn.at)

    assert(times[0] !== undefined && times[0] < 2, 'die Welle muss sofort beginnen')
    assert(
      (times[times.length - 1] as number) > WAVE_SPAWN_WINDOW_SECONDS * 0.5,
      'sie darf nicht in Sekunden durch sein',
    )
    for (let i = 1; i < times.length; i++) {
      assert((times[i] as number) >= (times[i - 1] as number), 'die Liste muss sortiert sein')
    }
    assert(new Set(times).size > 1, 'nicht alle zur gleichen Zeit')
  })

  check('die Gegner kommen aus allen Richtungen', () => {
    // GDD 07 Abschnitt 2: rundum, nicht aus festen Korridoren.
    const quadrants = new Set(
      plan(30, 8).spawns.map((spawn) => Math.floor(((spawn.angle % (Math.PI * 2)) / Math.PI) * 2)),
    )
    assertEqual(quadrants.size, 4, 'alle vier Himmelsrichtungen muessen vorkommen')
  })

  check('jede Richtung liegt im vollen Kreis', () => {
    for (const spawn of plan(12, 2).spawns) {
      assert(spawn.angle >= 0 && spawn.angle < Math.PI * 2, `Winkel ${spawn.angle}`)
    }
  })
}
