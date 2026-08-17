/**
 * Buff-System aus GDD 03 Abschnitt 9 - die Regeln, an denen der Prototyp gemessen hat,
 * dass Buff-Tuerme Voraussicht brauchen (F7).
 *
 * Die wichtigste Zusicherung hier ist die letzte: Ein Buff-Turm, der an eine fertige
 * Station angebaut wird, erreicht genau ein Modul. Genau darauf beruht die Aussage
 * "wer einen Buff-Turm nachruestet, macht immer einen Fehler".
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { BUFF_CAPS, RARITY_MULT, START_CORE_ID } from '../../data/balance.ts'
import { towerById } from '../../data/towers.ts'
import type { Rarity } from '../../data/types.ts'
import { buffLinks, categoryOf, computeBuffs } from '../../sim/buffs.ts'
import { moduleStats, theoreticalDps } from '../../sim/stats.ts'
import {
  CORE_UID,
  createStation,
  freeEdges,
  neighbors,
  newModule,
  place,
  stationModules,
  type FreeEdge,
  type Station,
} from '../../sim/station.ts'

function station(slots = 20): Station {
  return createStation(START_CORE_ID, slots)
}

function give(st: Station, defId: string, rarity: Rarity = 'common'): string {
  const module = newModule(st, defId, rarity)
  st.inventory.push(module)
  return module.uid
}

function coreEdge(st: Station, index: number): FreeEdge {
  return freeEdges(st).find((e) => e.ownerUid === CORE_UID && e.edgeIndex === index) as FreeEdge
}

/** Ein Autocannon am Kern, umgeben von `count` Amplifiern an seinen freien Kanten. */
function amplified(count: number, rarity: Rarity = 'common'): { st: Station; target: string } {
  const st = station()
  const target = give(st, 'autocannon')
  place(st, target, coreEdge(st, 0))

  for (let i = 0; i < count; i++) {
    const own = freeEdges(st).filter((e) => e.ownerUid === target)
    const spot = own.find((e) => place(st, give(st, 'amplifier', rarity), e) === null)
    if (!spot) throw new Error(`nur ${i} von ${count} Amplifiern passten an`)
  }
  return { st, target }
}

/** So viele Amplifier wie moeglich direkt an den Kern. */
function amplifiersOnCore(rarity: Rarity): { st: Station; count: number } {
  const st = station()
  let count = 0
  for (let index = 0; index < 6; index++) {
    const edge = freeEdges(st).find((e) => e.ownerUid === CORE_UID && e.edgeIndex === index)
    if (!edge) continue
    if (place(st, give(st, 'amplifier', rarity), edge) === null) count += 1
  }
  return { st, count }
}

export function buffsSuite(): void {
  suite('sim/buffs')

  check('ohne Buff-Nachbarn ist effektiv gleich Basis', () => {
    const st = station()
    const uid = give(st, 'autocannon')
    place(st, uid, coreEdge(st, 0))

    const buffs = computeBuffs(st)
    const module = stationModules(st).find((m) => m.uid === uid)
    const { base, final } = moduleStats(module!, buffs.get(uid))

    assertEqual(buffs.get(uid)?.sources.length, 0)
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      assertEqual(final[key], base[key], key)
    }
  })

  check('ein Amplifier verstaerkt seinen Kantennachbarn', () => {
    const { st, target } = amplified(1)
    const result = computeBuffs(st).get(target)
    const expected = towerById('amplifier').buffs?.[0]?.amount ?? 0

    assertEqual(result?.sources.length, 1)
    assertClose(result?.applied.damage ?? 0, expected, 1e-9)
  })

  check('zwei Amplifier stapeln additiv, nicht multiplikativ', () => {
    // +20 % und +20 % ergeben +40 %, nicht +44 % (GDD 03 Abschnitt 9).
    const { st, target } = amplified(2)
    const result = computeBuffs(st).get(target)
    const single = towerById('amplifier').buffs?.[0]?.amount ?? 0

    assertEqual(result?.sources.length, 2)
    assertClose(result?.applied.damage ?? 0, single * 2, 1e-9)
  })

  check('der Endwert ist Basis mal (1 + Summe)', () => {
    const { st, target } = amplified(2)
    const buffs = computeBuffs(st)
    const module = stationModules(st).find((m) => m.uid === target)
    const { base, final } = moduleStats(module!, buffs.get(target))
    const single = towerById('amplifier').buffs?.[0]?.amount ?? 0

    assertClose(final.damage, base.damage * (1 + single * 2), 1e-9)
  })

  check('ein Amplifier neben einem Amplifier erzeugt keinen Bonus', () => {
    const st = station()
    const first = give(st, 'amplifier')
    place(st, first, coreEdge(st, 0))
    const second = give(st, 'amplifier')
    const spot = freeEdges(st).find((e) => e.ownerUid === first) as FreeEdge
    place(st, second, spot)

    assert(neighbors(st, first).includes(second), 'die beiden muessen benachbart sein')
    const buffs = computeBuffs(st)
    for (const uid of [first, second]) {
      assertEqual(buffs.get(uid)?.sources.length, 0, uid)
      assertEqual(Object.keys(buffs.get(uid)?.applied ?? {}).length, 0, uid)
    }
  })

  check('blosse Eckberuehrung erzeugt keinen Bonus', () => {
    // Zwei Vierecke an benachbarten Kernkanten teilen nur eine Ecke - dann fehlt auch die
    // Buff-Linie, und die Regel ist am Bild ablesbar.
    const st = station()
    const amp = give(st, 'amplifier')
    place(st, amp, coreEdge(st, 0))
    const gun = give(st, 'autocannon')
    const far = freeEdges(st).find(
      (e) => e.ownerUid === CORE_UID && e.edgeIndex === 3,
    ) as FreeEdge
    place(st, gun, far)

    assert(!neighbors(st, amp).includes(gun), 'sie duerfen keine Kante teilen')
    assertEqual(computeBuffs(st).get(gun)?.sources.length, 0)
  })

  check('der Hauptturm wird mitgebufft', () => {
    // Ohne diese Regel waere ein Amplifier in kleinen Basen rechnerisch wertlos
    // (GDD 04 Abschnitt 1, Prototyp 01 / F10).
    const st = station()
    place(st, give(st, 'amplifier'), coreEdge(st, 0))
    const result = computeBuffs(st).get(CORE_UID)

    assert((result?.applied.damage ?? 0) > 0, 'der Kern muss einen Bonus bekommen')
  })

  check('ueber dem Deckel wird auf den Deckel begrenzt', () => {
    const { st, count } = amplifiersOnCore('legendary')
    assert(count >= 4, `nur ${count} Amplifier passten an den Kern`)

    const result = computeBuffs(st).get(CORE_UID)
    const raw = result?.raw.damage ?? 0
    assert(raw > BUFF_CAPS.damage, `Rohsumme ${raw} muss ueber dem Deckel liegen`)
    assertEqual(result?.applied.damage, BUFF_CAPS.damage)
    assert(result?.capped.includes('damage') === true, 'der Deckel muss vermerkt sein')
  })

  check('unterhalb des Deckels wird nichts vermerkt', () => {
    const { st, target } = amplified(1)
    assertEqual(computeBuffs(st).get(target)?.capped.length, 0)
  })

  check('Raritaet verstaerkt den Buff eines Amplifiers', () => {
    // Buff-Module haben keine eigenen Kampfwerte - ohne diese Regel waere Raritaet dort
    // wirkungslos.
    const strength = (rarity: Rarity): number => {
      const { st, target } = amplified(1, rarity)
      return computeBuffs(st).get(target)?.applied.damage ?? 0
    }

    const common = strength('common')
    const legendary = strength('legendary')
    assert(common > 0, 'Common muss wirken')
    assertClose(legendary, common * RARITY_MULT.legendary, 1e-9)
  })

  check('Raritaet verstaerkt die Kampfwerte eines Kampfturms', () => {
    const base = moduleStats(
      { ...dummyModule(), rarity: 'common' },
      undefined,
    ).base
    const epic = moduleStats({ ...dummyModule(), rarity: 'epic' }, undefined).base
    assertClose(epic.damage, base.damage * RARITY_MULT.epic, 1e-9)
  })

  check('der Hauptturm hat keinen Raritaetsfaktor', () => {
    const st = station()
    const core = stationModules(st)[0]
    const { base } = moduleStats(core!, undefined)
    assert(base.damage > 0, 'der Kern muss Kampfwerte haben')
  })

  check('ein Buff-Modul zaehlt, wie viele Module es verstaerkt', () => {
    const { st, count } = amplifiersOnCore('common')
    assert(count >= 1, 'mindestens ein Amplifier muss passen')

    const amplifierUid = st.placed[0]?.uid as string
    const result = computeBuffs(st).get(amplifierUid)
    assertEqual(result?.boosted, 1, 'am Rand erreicht er nur den Kern')
  })

  check('am Rand angebaut erreicht ein Buff-Turm genau ein Modul', () => {
    // Der wichtigste Befund aus Prototyp 01 (F7): Ein neu angestecktes Modul teilt per
    // Konstruktion genau eine Kante mit der Station. Wer einen Buff-Turm nachruestet,
    // faehrt deshalb immer schlechter als mit einem weiteren Kampfturm.
    const st = station()
    place(st, give(st, 'autocannon'), coreEdge(st, 0))
    place(st, give(st, 'autocannon'), coreEdge(st, 2))

    const spot = freeEdges(st).find(
      (e) => e.ownerUid !== CORE_UID && place(st, give(st, 'amplifier'), e) === null,
    )
    assert(spot !== undefined, 'ein Anbauplatz muss existieren')

    const amplifierUid = st.placed[st.placed.length - 1]?.uid as string
    assertEqual(computeBuffs(st).get(amplifierUid)?.boosted, 1)
  })

  check('zuerst gesetzt und umbaut erreicht derselbe Buff-Turm mehr', () => {
    // Die Gegenprobe: Amplifier zuerst an den Kern, dann Kampftuerme an seine Kanten.
    const st = station()
    const amp = give(st, 'amplifier')
    place(st, amp, coreEdge(st, 0))

    let built = 0
    for (const edge of freeEdges(st).filter((e) => e.ownerUid === amp)) {
      if (place(st, give(st, 'autocannon'), edge) === null) built += 1
    }

    const boosted = computeBuffs(st).get(amp)?.boosted ?? 0
    assert(boosted >= 2, `erwartet mindestens 2 verstaerkte Module, waren ${boosted}`)
    assert(boosted === built + 1, 'der Kern muss mitgezaehlt werden')
  })

  check('die Schwelle b > 1/k ist mit dieser Grundflaeche erreichbar', () => {
    // GDD 03 Abschnitt 9: Ein Buff-Turm unter 1/k ist rechnerisch tot. Bei einem Sechseck
    // sind bis zu 6 Ziele moeglich, die Schwelle liegt dann bei 16,7 %.
    //
    // Die Pruefung rechnet mit `def.sides` und nicht mit einer Zahl - genau deshalb hat sie
    // den Wechsel vom Fuenfeck aufs Sechseck ueberlebt, ohne angefasst zu werden.
    const def = towerById('amplifier')
    const amount = def.buffs?.[0]?.amount ?? 0
    assert(
      amount >= 1 / def.sides,
      `+${amount * 100} % reicht bei ${def.sides} Kanten nicht an 1/k heran`,
    )
  })

  check('ein Amplifier hebt die Stations-DPS', () => {
    const before = station()
    const gun = give(before, 'autocannon')
    place(before, gun, coreEdge(before, 0))
    const dpsBefore = dps(before)

    const { st } = amplified(1)
    assert(dps(st) > dpsBefore, 'die Vergleichszahl muss steigen')
  })

  check('Buff-Module tragen selbst nichts zur DPS bei', () => {
    const st = station()
    const uid = give(st, 'amplifier')
    place(st, uid, coreEdge(st, 0))
    const module = stationModules(st).find((m) => m.uid === uid)
    const { final } = moduleStats(module!, computeBuffs(st).get(uid))
    assertEqual(final.damage, 0)
    assertEqual(final.attackSpeed, 0)
  })

  check('buffLinks liefert je Paar genau eine Verbindung', () => {
    const { st, target } = amplified(2)
    const links = buffLinks(computeBuffs(st))
    const toTarget = links.filter((link) => link.to === target)

    assertEqual(toTarget.length, 2)
    assertEqual(new Set(toTarget.map((link) => link.from)).size, 2)
  })

  check('ohne Buff-Modul gibt es keine Linien', () => {
    const st = station()
    place(st, give(st, 'autocannon'), coreEdge(st, 0))
    assertEqual(buffLinks(computeBuffs(st)).length, 0)
  })

  check('der Kern zaehlt als Kampfmodul, nicht als Buff-Modul', () => {
    const core = stationModules(station())[0]
    assertEqual(categoryOf(core!), 'attack')
  })
}

function dummyModule() {
  return {
    uid: 'x',
    kind: 'tower' as const,
    defId: 'autocannon',
    rarity: 'common' as Rarity,
    // Ohne Eigenschaften: Diese Tests messen die Wirkung der **Raritaet**, und ein
    // zufaelliger Zuschlag darauf machte die Zahl unbrauchbar.
    traits: [] as string[],
    sides: 4 as const,
    center: { x: 0, y: 0 },
    rotation: 0,
    poly: [],
    sharedEdges: [],
  }
}

function dps(st: Station): number {
  return theoreticalDps(
    stationModules(st),
    computeBuffs(st),
    (module) => categoryOf(module) === 'buff' || categoryOf(module) === 'support',
  )
}
