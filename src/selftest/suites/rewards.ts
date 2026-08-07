/**
 * Beweis aus E0: `grantReward` erhoeht genau die genannte Ressource und meldet ein
 * Ereignis. Das ist der Haken, an dem spaeter Werbe-Belohnungen haengen (GDD 16
 * Abschnitt 2) - er muss von Anfang an dicht sein.
 */

import { assertDeepEqual, assertEqual, check, suite } from '../../core/assert.ts'
import { on, resetEvents } from '../../core/events.ts'
import { grantReward } from '../../app/rewards.ts'
import { createInitialState } from '../../app/state.ts'

export function rewardsSuite(): void {
  suite('app/rewards')

  check('Gold landet in den Run-Daten', () => {
    const state = createInitialState(1)
    grantReward(state, { gold: 250 }, 'test')
    assertEqual(state.run.gold, 250)
    assertEqual(state.run.xp, 0, 'nur die genannte Ressource steigt')
    assertEqual(state.permanent.prestigePoints, 0)
  })

  check('XP landet in den Run-Daten', () => {
    const state = createInitialState(1)
    grantReward(state, { xp: 40 }, 'test')
    assertEqual(state.run.xp, 40)
    assertEqual(state.run.gold, 0)
  })

  check('Prestige-Punkte landen in den permanenten Daten', () => {
    const state = createInitialState(1)
    grantReward(state, { prestigePoints: 3 }, 'test')
    assertEqual(state.permanent.prestigePoints, 3)
    assertEqual(state.run.gold, 0)
  })

  check('mehrere Ressourcen auf einmal', () => {
    const state = createInitialState(1)
    grantReward(state, { gold: 10, xp: 5, prestigePoints: 1 }, 'test')
    assertEqual(state.run.gold, 10)
    assertEqual(state.run.xp, 5)
    assertEqual(state.permanent.prestigePoints, 1)
  })

  check('Belohnungen summieren sich', () => {
    const state = createInitialState(1)
    grantReward(state, { gold: 10 }, 'test')
    grantReward(state, { gold: 15 }, 'test')
    assertEqual(state.run.gold, 25)
  })

  check('unbrauchbare Betraege vernichten keinen Fortschritt', () => {
    const state = createInitialState(1)
    state.run.gold = 100
    grantReward(state, { gold: -50 }, 'test')
    grantReward(state, { gold: Number.NaN }, 'test')
    grantReward(state, { gold: Number.POSITIVE_INFINITY }, 'test')
    grantReward(state, { gold: 0 }, 'test')
    assertEqual(state.run.gold, 100)
  })

  check('jede Belohnung meldet ein Ereignis mit Herkunft', () => {
    resetEvents()
    const state = createInitialState(1)
    const seen: unknown[] = []
    on('reward.granted', (payload) => seen.push(payload))
    grantReward(state, { gold: 7 }, 'enemy.kill')
    assertDeepEqual(seen, [{ reward: { gold: 7, xp: 0, prestigePoints: 0 }, source: 'enemy.kill' }])
    resetEvents()
  })

  check('eine leere Belohnung meldet nichts', () => {
    resetEvents()
    const state = createInitialState(1)
    let calls = 0
    on('reward.granted', () => calls++)
    grantReward(state, {}, 'test')
    grantReward(state, { gold: 0, xp: 0 }, 'test')
    assertEqual(calls, 0)
    resetEvents()
  })

  check('eine Belohnung merkt die Aenderung fuer die Sicherung vor', () => {
    const state = createInitialState(1)
    assertEqual(state.runtime.dirty, false)
    grantReward(state, { gold: 1 }, 'test')
    assertEqual(state.runtime.dirty, true)
  })
}
