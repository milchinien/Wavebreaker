/**
 * Beweis aus E0: "120 Ticks bei x2 in einer Sekunde, 60 bei x1 - als Test, nicht per
 * Augenmass." Moeglich wird das durch die austauschbare Bildquelle: der Test loest die
 * Bilder selbst aus und bestimmt, wie weit die Zeit springt.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { createLoop, createManualScheduler, type SpeedFactor } from '../../core/loop.ts'
import { TICK_RATE } from '../../data/balance.ts'

/** Eine Sekunde in zehn Bildern zu 100 ms - ohne Gleitkomma-Rest im Akkumulator. */
function ticksInOneSecond(speed: SpeedFactor): number {
  const scheduler = createManualScheduler()
  const loop = createLoop({ tickRate: TICK_RATE, scheduleFrame: scheduler })
  let ticks = 0
  loop.setSpeed(speed)
  loop.start(
    () => ticks++,
    () => {},
  )
  scheduler.advance(0) // Nullpunkt setzen
  scheduler.advanceBy(1000, 100)
  loop.stop()
  return ticks
}

export function loopSuite(): void {
  suite('core/loop')

  check('x1 ergibt 60 Ticks pro Sekunde', () => {
    assertEqual(ticksInOneSecond(1), 60)
  })

  check('x2 ergibt 120 Ticks pro Sekunde', () => {
    assertEqual(ticksInOneSecond(2), 120)
  })

  check('x4 ergibt 240 Ticks pro Sekunde', () => {
    assertEqual(ticksInOneSecond(4), 240)
  })

  check('60 unregelmaessige Bilder liefern 60 Ticks (+-1)', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler })
    let ticks = 0
    loop.start(
      () => ticks++,
      () => {},
    )
    scheduler.advance(0)
    scheduler.advanceBy(1000, 1000 / 60)
    loop.stop()
    assert(Math.abs(ticks - 60) <= 1, `erwartet 60 +-1, war ${ticks}`)
  })

  check('Schrittweite bleibt konstant, egal bei welcher Geschwindigkeit', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler })
    const steps = new Set<number>()
    loop.setSpeed(4)
    loop.start(
      (dt) => steps.add(dt),
      () => {},
    )
    scheduler.advance(0)
    scheduler.advanceBy(500, 100)
    loop.stop()
    assertEqual(steps.size, 1, 'x4 darf keine groesseren Schritte erzeugen')
    assertClose([...steps][0] ?? 0, 1 / TICK_RATE)
  })

  check('das erste Bild erzeugt keinen Zeitsprung', () => {
    const scheduler = createManualScheduler(123456)
    const loop = createLoop({ scheduleFrame: scheduler })
    let ticks = 0
    loop.start(
      () => ticks++,
      () => {},
    )
    scheduler.advance(0)
    assertEqual(ticks, 0)
  })

  check('now() entspricht der Anzahl Ticks', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler })
    loop.start(
      () => {},
      () => {},
    )
    scheduler.advance(0)
    scheduler.advanceBy(1000, 100)
    assertClose(loop.now(), loop.tickCount() / TICK_RATE, 1e-9)
    loop.stop()
  })

  check('ein langer Ausfall wird gedeckelt statt nachgeholt', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler, maxFrameSeconds: 0.25 })
    let ticks = 0
    loop.start(
      () => ticks++,
      () => {},
    )
    scheduler.advance(0)
    scheduler.advance(10_000) // Tab war zehn Sekunden weg
    loop.stop()
    assertEqual(ticks, 15, '0,25 s x 60 Ticks/s')
  })

  check('Ueberlast verwirft den Rest, statt sich aufzuschaukeln', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({
      scheduleFrame: scheduler,
      maxFrameSeconds: 10,
      maxTicksPerFrame: 20,
    })
    let ticks = 0
    loop.start(
      () => ticks++,
      () => {},
    )
    scheduler.advance(0)
    scheduler.advance(1000)
    scheduler.advance(16)
    loop.stop()
    assertEqual(ticks, 20, 'zweites Bild darf keinen Rueckstand nachholen')
  })

  check('render laeuft einmal je Bild, auch ohne Tick', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler })
    let frames = 0
    let ticks = 0
    loop.start(
      () => ticks++,
      () => frames++,
    )
    scheduler.advance(0)
    scheduler.advance(1) // zu kurz fuer einen Tick
    scheduler.advance(1)
    loop.stop()
    assertEqual(ticks, 0)
    assertEqual(frames, 2)
  })

  check('stop() haelt die Schleife an', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler })
    let ticks = 0
    loop.start(
      () => ticks++,
      () => {},
    )
    scheduler.advance(0)
    scheduler.advance(100)
    const before = ticks
    loop.stop()
    scheduler.advance(1000)
    assertEqual(ticks, before)
    assertEqual(loop.isRunning(), false)
  })

  check('wallClock ist von der Spielzeit unabhaengig', () => {
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler, wallClock: () => 1_700_000_000_000 })
    loop.setSpeed(4)
    loop.start(
      () => {},
      () => {},
    )
    scheduler.advance(0)
    scheduler.advanceBy(1000, 100)
    assertEqual(loop.wallClock(), 1_700_000_000_000)
    assertClose(loop.now(), 4, 1e-9, 'x4 laesst die Spielzeit vierfach laufen')
    loop.stop()
  })
}
