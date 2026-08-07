/**
 * Der Zufall muss reproduzierbar sein, sonst ist ein Balancing-Fehler nicht nachstellbar
 * (Implementierungsplan Abschnitt 3).
 */

import { assert, assertDeepEqual, assertEqual, assertThrows, check, suite } from '../../core/assert.ts'
import { createRng } from '../../core/rng.ts'

function take(seed: number, count: number): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => rng.next())
}

export function rngSuite(): void {
  suite('core/rng')

  check('gleicher Seed liefert gleiche Folge', () => {
    assertDeepEqual(take(42, 20), take(42, 20))
  })

  check('anderer Seed liefert andere Folge', () => {
    const a = take(1, 10)
    const b = take(2, 10)
    assert(a.some((value, i) => value !== b[i]), 'Folgen duerfen nicht identisch sein')
  })

  check('next() liegt in [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 5000; i++) {
      const value = rng.next()
      assert(value >= 0 && value < 1, `ausserhalb des Bereichs: ${value}`)
    }
  })

  check('int() schliesst beide Grenzen ein', () => {
    const rng = createRng(9)
    const seen = new Set<number>()
    for (let i = 0; i < 6000; i++) {
      const value = rng.int(1, 6)
      assert(Number.isInteger(value), 'muss ganzzahlig sein')
      assert(value >= 1 && value <= 6, `ausserhalb 1..6: ${value}`)
      seen.add(value)
    }
    assertEqual(seen.size, 6, 'alle sechs Werte muessen vorkommen')
  })

  check('int() mit gleicher Ober- und Untergrenze', () => {
    assertEqual(createRng(3).int(5, 5), 5)
  })

  check('int() vertauschte Grenzen werden gedreht', () => {
    const value = createRng(3).int(9, 2)
    assert(value >= 2 && value <= 9, `ausserhalb 2..9: ${value}`)
  })

  check('chance(0) und chance(1) sind eindeutig', () => {
    const rng = createRng(11)
    for (let i = 0; i < 100; i++) {
      assertEqual(rng.chance(0), false)
      assertEqual(rng.chance(1), true)
    }
  })

  check('chance(0.25) trifft ungefaehr ein Viertel', () => {
    const rng = createRng(13)
    let hits = 0
    const rounds = 20_000
    for (let i = 0; i < rounds; i++) if (rng.chance(0.25)) hits++
    const ratio = hits / rounds
    assert(Math.abs(ratio - 0.25) < 0.02, `erwartet ~0,25, war ${ratio}`)
  })

  check('pick() wirft bei leerer Liste', () => {
    assertThrows(() => createRng(1).pick([]))
  })

  check('pick() liefert nur Elemente der Liste', () => {
    const rng = createRng(5)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 500; i++) {
      assert(items.includes(rng.pick(items)), 'fremdes Element')
    }
  })

  check('shuffle() ist eine echte Umordnung', () => {
    const rng = createRng(17)
    const source = Array.from({ length: 50 }, (_, i) => i)
    const shuffled = rng.shuffle([...source])
    assertEqual(shuffled.length, source.length)
    assertDeepEqual([...shuffled].sort((a, b) => a - b), source)
  })

  check('Zustand laesst sich sichern und wiederherstellen', () => {
    const rng = createRng(99)
    for (let i = 0; i < 37; i++) rng.next()
    const saved = rng.state()
    const expected = Array.from({ length: 10 }, () => rng.next())

    const restored = createRng(0)
    restored.setState(saved)
    assertDeepEqual(
      Array.from({ length: 10 }, () => restored.next()),
      expected,
    )
  })

  check('fork() erzeugt einen eigenen, aber reproduzierbaren Strom', () => {
    const a = createRng(21)
    const forkA = a.fork(1)
    const b = createRng(21)
    const forkB = b.fork(1)
    assertDeepEqual(
      Array.from({ length: 10 }, () => forkA.next()),
      Array.from({ length: 10 }, () => forkB.next()),
    )
  })

  check('fork() verschiebt den Strom des Erzeugers nicht', () => {
    const rng = createRng(31)
    const before = rng.state()
    rng.fork(7)
    assertEqual(rng.state(), before)
  })

  check('verschiedene Salze liefern verschiedene Stroeme', () => {
    const rng = createRng(31)
    const one = rng.fork(1).next()
    const two = rng.fork(2).next()
    assert(one !== two, 'Salz muss wirken')
  })
}
