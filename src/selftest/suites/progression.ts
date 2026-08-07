/**
 * Beweis aus E10.
 *
 * Der Plan verlangt: "Perk-Effekte erscheinen in `effectiveTowerStats`, nicht als Sonderfall
 * im Kampfcode." Genau das prueft die Haelfte dieser Datei - ein Perk wird gewaehlt, und
 * danach muss der Wert **auf demselben Weg** herauskommen, den auch Upgrades und Buffs
 * nehmen. Waere er anderswo eingerechnet, ginge er bei jeder spaeteren Quelle (Prestige)
 * verloren, und niemand faende den Grund.
 *
 * Die andere Haelfte sichert die Entscheidung ab, dass Erfahrung **nie verbraucht** wird:
 * Die Stufe ist abgeleitet, `run.level` zaehlt nur die abgeholten Perks. Diese Trennung ist
 * die Stelle, an der die beiden Zahlen auseinanderlaufen koennten - also wird sie geprueft.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { MAX_LEVEL, PERK_CHOICES, XP_BASE } from '../../data/balance.ts'
import { PERKS, perkById } from '../../data/perks.ts'
import { takePerk } from '../../app/actions.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState } from '../../sim/combat.ts'
import {
  cumulativeXp,
  currentLevel,
  currentOffer,
  levelFromXp,
  levelProgress,
  offerPerks,
  pendingLevelUps,
  perkCount,
  perkStatBonus,
  xpForLevel,
} from '../../sim/progression.ts'
import { createRng } from '../../core/rng.ts'
import { effectiveTowerStats, globalMultiplier, maxStationHp } from '../../sim/stats.ts'
import { CORE_UID } from '../../sim/station.ts'

function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(4711)
  state.runtime.combat = createCombatState()
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

/** Erfahrung so weit hochsetzen, dass genau `count` Aufstiege offen sind. */
function raiseTo(state: GameState, level: number): void {
  state.run.xp = cumulativeXp(level)
}

export function progressionSuite(): void {
  suite('sim/progression')

  check('die Kurve trifft den Richtwert fuer Stufe 1 (GDD 09 Abschnitt 2)', () => {
    assertEqual(xpForLevel(1), XP_BASE)
  })

  check('jede Stufe kostet mehr als die vorige', () => {
    for (let level = 1; level < 60; level++) {
      assert(
        xpForLevel(level + 1) > xpForLevel(level),
        `Stufe ${level + 1} muss teurer sein als ${level}`,
      )
    }
  })

  check('die Richtwerte fuer Stufe 10 und 50 liegen unter zehn Prozent daneben', () => {
    // GDD 09 Abschnitt 2 nennt 5.000 und 100.000 ausdruecklich als Richtwerte. Ein reines
    // Potenzgesetz kann beide nicht exakt treffen - der gewaehlte Exponent verteilt den
    // Fehler, statt einen Wert exakt zu nehmen und den anderen um ein Fuenftel zu verfehlen.
    assert(Math.abs(xpForLevel(10) - 5000) / 5000 < 0.1, `Stufe 10: ${xpForLevel(10)}`)
    assert(Math.abs(xpForLevel(50) - 100000) / 100000 < 0.1, `Stufe 50: ${xpForLevel(50)}`)
  })

  check('die Summe der Schwellen ist die Schwelle der Summe', () => {
    let sum = 0
    for (let level = 1; level <= 40; level++) {
      assertEqual(cumulativeXp(level), sum, `bis Stufe ${level}`)
      sum += xpForLevel(level)
    }
  })

  check('Stufe 1 kostet nichts - dort beginnt jeder Run', () => {
    assertEqual(cumulativeXp(1), 0)
    assertEqual(levelFromXp(0), 1)
  })

  check('die Stufe folgt der Erfahrung, genau an der Schwelle', () => {
    for (const level of [2, 3, 7, 12, 25]) {
      const need = cumulativeXp(level)
      assertEqual(levelFromXp(need - 1), level - 1, `knapp unter Stufe ${level}`)
      assertEqual(levelFromXp(need), level, `genau auf Stufe ${level}`)
    }
  })

  check('kaputte Erfahrung bringt die Suche nicht zum Stehen', () => {
    // Eine Sicherheitsgrenze, keine Spielregel: Ohne sie liefe die Schleife bei einem
    // manipulierten Spielstand praktisch endlos.
    assertEqual(levelFromXp(Number.MAX_VALUE), MAX_LEVEL)
    assertEqual(levelFromXp(Number.NaN), 1)
    assertEqual(levelFromXp(-5), 1)
  })

  check('Erfahrung wird nie verbraucht - die Stufe ist abgeleitet', () => {
    const state = rig()
    raiseTo(state, 4)
    const before = state.run.xp

    assertEqual(currentLevel(state), 4)
    assertEqual(pendingLevelUps(state), 3, 'drei Aufstiege warten auf ihre Auswahl')

    const offer = currentOffer(state)
    assert(takePerk(state, (offer[0] as { id: string }).id), 'die erste Wahl muss greifen')

    assertEqual(state.run.xp, before, 'die Wahl kostet keine Erfahrung')
    assertEqual(currentLevel(state), 4, 'die erreichte Stufe bleibt')
    assertEqual(pendingLevelUps(state), 2, 'ein Aufstieg ist abgeholt')
  })

  check('mehrere Aufstiege stapeln sich (GDD 09 Abschnitt 2)', () => {
    const state = rig()
    raiseTo(state, 6)
    assertEqual(pendingLevelUps(state), 5)

    for (let i = 0; i < 5; i++) {
      const offer = currentOffer(state)
      assertEqual(offer.length, PERK_CHOICES, `Angebot ${i + 1}`)
      takePerk(state, (offer[0] as { id: string }).id)
    }
    assertEqual(pendingLevelUps(state), 0)
    assertEqual(state.run.perks.length, 5)
  })

  check('ohne offenen Aufstieg gibt es kein Angebot und keine Wahl', () => {
    const state = rig()
    assertEqual(pendingLevelUps(state), 0)
    assertDeepEqualLength(currentOffer(state), 0)
    assertEqual(takePerk(state, PERKS[0]!.id), false, 'ohne Aufstieg keine Wahl')
    assertEqual(state.run.perks.length, 0)
  })

  check('nur was im Angebot steht, kann gewaehlt werden', () => {
    const state = rig()
    raiseTo(state, 2)
    const offer = currentOffer(state).map((perk) => perk.id)
    const outside = PERKS.find((perk) => !offer.includes(perk.id))

    assert(outside !== undefined, 'es muss einen Perk ausserhalb des Angebots geben')
    assertEqual(takePerk(state, outside.id), false, 'ausserhalb des Angebots wird abgelehnt')
    assertEqual(pendingLevelUps(state), 1, 'der Aufstieg bleibt offen')
  })

  check('das Angebot bleibt stehen, bis gewaehlt wurde', () => {
    const state = rig()
    raiseTo(state, 2)
    const first = currentOffer(state).map((perk) => perk.id)
    const second = currentOffer(state).map((perk) => perk.id)
    assertEqual(first.join(','), second.join(','), 'zweimal fragen wuerfelt nicht neu')
    assertEqual(state.run.perkOffer.join(','), first.join(','), 'es steht im Spielstand')
  })

  check('ein Angebot enthaelt keine Doppel', () => {
    const rng = createRng(9)
    for (let round = 0; round < 200; round++) {
      const offer = offerPerks(rng)
      assertEqual(offer.length, PERK_CHOICES)
      assertEqual(new Set(offer.map((perk) => perk.id)).size, PERK_CHOICES, `Runde ${round}`)
    }
  })

  check('seltene Perks erscheinen seltener als gewoehnliche', () => {
    const rng = createRng(1234)
    let common = 0
    let legendary = 0
    for (let round = 0; round < 4000; round++) {
      for (const perk of offerPerks(rng, 1)) {
        if (perk.rarity === 'common') common += 1
        if (perk.rarity === 'legendary') legendary += 1
      }
    }
    assert(common > legendary * 5, `gewoehnlich ${common} gegen legendaer ${legendary}`)
    assert(legendary > 0, 'legendaer darf nicht unmoeglich sein')
  })

  // -------------------------------------------------------------------------
  // Wirkung - die eigentliche Abnahmebedingung der Etappe
  // -------------------------------------------------------------------------

  check('ein Perk erscheint in effectiveTowerStats, nicht als Sonderfall', () => {
    const state = rig()
    const before = effectiveTowerStats(state, CORE_UID)
    assert(before !== null, 'der Kern muss Werte haben')

    // Direkt gesetzt statt gewaehlt: Der Test prueft die **Wirkung**, nicht den Weg dorthin.
    state.run.perks.push('perk.damage.1')

    const after = effectiveTowerStats(state, CORE_UID)
    assert(after !== null, 'der Kern muss weiterhin Werte haben')
    assertClose(
      after.damage,
      before.damage * (1 + perkById('perk.damage.1').effect.amount),
      1e-9,
      'der Schaden muss durch dieselbe Kette laufen',
    )
  })

  check('Perks wirken auf alle Module, nicht auf eine Turmart', () => {
    const state = rig()
    state.run.perks.push('perk.rate.1')
    assertClose(perkStatBonus(state, 'attackSpeed'), 0.07, 1e-9)
    assertEqual(perkStatBonus(state, 'damage'), 0, 'ein Tempo-Perk ruehrt den Schaden nicht an')
  })

  check('gleiche Perks summieren sich additiv, nicht multiplikativ', () => {
    const state = rig()
    for (let i = 0; i < 10; i++) state.run.perks.push('perk.damage.1')
    // Zehnmal acht Prozent sind +80 %, nicht +116 % (1,08^10). Additiv, wie bei Buffs.
    assertClose(perkStatBonus(state, 'damage'), 0.8, 1e-9)
    assertEqual(perkCount(state, 'perk.damage.1'), 10)
  })

  check('ein Huellen-Perk vergroessert die Lebensleiste', () => {
    const state = rig()
    const before = maxStationHp(state)
    state.run.perks.push('perk.hull.1')
    assertClose(maxStationHp(state), Math.round(before * 1.1), 0.51)
  })

  check('globale Perks und globale Upgrades laufen zusammen', () => {
    const state = rig()
    assertEqual(globalMultiplier(state, 'goldBonus'), 1, 'ohne beides gibt es keine Wirkung')

    state.run.perks.push('perk.gold.1')
    assertClose(globalMultiplier(state, 'goldBonus'), 1.1, 1e-9)

    state.run.upgrades['global.goldBonus'] = 1
    // Additiv aus beiden Quellen - Perk 10 % plus Upgrade 6 % ergibt 16 %.
    assertClose(globalMultiplier(state, 'goldBonus'), 1.16, 1e-9)
  })

  check('Erfahrungsbonus gibt es nur als Perk und trotzdem ueber dieselbe Abfrage', () => {
    const state = rig()
    assertEqual(globalMultiplier(state, 'xpBonus'), 1)
    state.run.perks.push('perk.xp.1')
    assertClose(globalMultiplier(state, 'xpBonus'), 1.12, 1e-9)
  })

  check('unbekannte Perks im Spielstand werden uebergangen', () => {
    const state = rig()
    state.run.perks.push('perk.gibtsnicht')
    state.run.perks.push('perk.damage.1')
    // Kein Absturz, und der gueltige Eintrag wirkt weiter.
    assertClose(perkStatBonus(state, 'damage'), 0.08, 1e-9)
  })

  check('der Fortschritt in der Stufe stimmt mit der Kurve ueberein', () => {
    const state = rig()
    state.run.xp = cumulativeXp(5) + xpForLevel(5) / 2

    const progress = levelProgress(state)
    assertEqual(progress.level, 5)
    assertEqual(progress.need, xpForLevel(5))
    assertClose(progress.fraction, 0.5, 1e-6)
  })
}

/** Kleine Hilfe, damit die Absicht in der Zeile steht und nicht im Ausdruck. */
function assertDeepEqualLength(list: readonly unknown[], expected: number): void {
  assertEqual(list.length, expected)
}
