/**
 * Beweis aus E12.
 *
 * Der Plan verlangt dreierlei: die Eigenschaftsanzahl je Raritaet, die Kostenkurve, und
 * dass geschmolzene Tuerme **endgueltig** weg sind und nirgends wieder auftauchen.
 *
 * Dazu kommt die Regel, die keine Funktion ist, sondern eine Abwesenheit: Es gibt **keinen
 * Verkauf gegen Gold** (GDD 06 Abschnitt 4). Geprueft wird sie als Wirkung - Schmelzen
 * bringt kein Gold, sondern einen Wurf.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { createRng } from '../../core/rng.ts'
import { MELT_COST, TOWER_BASE_COST, TOWER_COST_FACTOR } from '../../data/balance.ts'
import { RARITY_CHANCE, rarityWeights, TRAIT_SLOTS } from '../../data/rarities.ts'
import { traitById } from '../../data/traits.ts'
import { RARITIES, type Rarity } from '../../data/types.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState } from '../../sim/combat.ts'
import {
  discardTowerOffer,
  meltTowers,
  rollTowerOffer,
  rollTraits,
  startTowerPurchase,
  takeTowerOffer,
  towerCost,
} from '../../sim/shop.ts'
import { newModule } from '../../sim/station.ts'

function rig(gold = 100000): GameState {
  resetStationViewCache()
  const state = createInitialState(777)
  state.runtime.combat = createCombatState()
  state.run.gold = gold
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

/** Alles bis zu dieser Stufe freischalten - Raritaeten **und** Eigenschaften. */
function unlockUpTo(state: GameState, rarity: Rarity): void {
  const order: Rarity[] = ['rare', 'epic', 'legendary', 'mythic']
  for (const step of order) {
    state.permanent.prestigeNodes.push(`rarity.${step}`, `trait.${step}`)
    if (step === rarity) break
  }
}

function fillInventory(state: GameState, count: number): string[] {
  const uids: string[] = []
  for (let i = 0; i < count; i++) {
    const module = newModule(state.run.station, 'autocannon', 'common')
    state.run.station.inventory.push(module)
    uids.push(module.uid)
  }
  return uids
}

export function shopSuite(): void {
  suite('sim/shop')

  // -------------------------------------------------------------------------
  // Kostenkurve (GDD 06 Abschnitt 2)
  // -------------------------------------------------------------------------

  check('der Preis folgt Grundpreis x 1,5 je gekauftem Turm', () => {
    const state = rig()
    for (const bought of [0, 1, 2, 3, 8]) {
      state.run.towersBought = bought
      assertEqual(
        towerCost(state),
        Math.round(TOWER_BASE_COST * Math.pow(TOWER_COST_FACTOR, bought)),
        `nach ${bought} Kaeufen`,
      )
    }
  })

  check('die Reihe entspricht der Tabelle des GDD', () => {
    // GDD 06 Abschnitt 2 nennt 100 / 150 / 225 / 337.
    const state = rig()
    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      state.run.towersBought = i
      seen.push(towerCost(state))
    }
    assertEqual(seen.join(','), '100,150,225,338', 'die letzte Stelle rundet auf statt ab')
  })

  check('der Preis steigt erst mit der Annahme, nicht mit dem Angebot', () => {
    const state = rig()
    const before = towerCost(state)

    assertEqual(startTowerPurchase(state), true)
    assertEqual(towerCost(state), before, 'ein offenes Angebot aendert den Preis nicht')

    takeTowerOffer(state, 0)
    assert(towerCost(state) > before, 'erst die Annahme verteuert den naechsten')
  })

  check('bezahlt wird der Wurf, nicht der Turm', () => {
    const state = rig(150)
    const cost = towerCost(state)

    assertEqual(startTowerPurchase(state), true)
    assertEqual(state.run.gold, 150 - cost, 'das Gold ist beim Wuerfeln weg')

    discardTowerOffer(state)
    assertEqual(state.run.gold, 150 - cost, 'verwerfen gibt nichts zurueck')
    assertEqual(state.run.station.inventory.length, 3, 'und bringt keinen Turm')
  })

  check('ohne genug Gold aendert sich nichts', () => {
    const state = rig(10)
    assertEqual(startTowerPurchase(state), false)
    assertEqual(state.run.gold, 10)
    assertEqual(state.run.towerOffer.length, 0)
  })

  // -------------------------------------------------------------------------
  // Raritaet und Eigenschaften (GDD 06 Abschnitt 8 und 10)
  // -------------------------------------------------------------------------

  check('ohne Freischaltung faellt nur Common', () => {
    const state = rig()
    const rng = createRng(5)
    for (let i = 0; i < 200; i++) {
      for (const offer of rollTowerOffer(state, rng)) {
        assertEqual(offer.rarity, 'common', 'ohne Prestige gibt es nichts anderes')
      }
    }
  })

  check('freigeschaltete Stufen erscheinen, hoehere nicht', () => {
    const state = rig()
    unlockUpTo(state, 'epic')
    const rng = createRng(11)

    const seen = new Set<string>()
    for (let i = 0; i < 800; i++) {
      for (const offer of rollTowerOffer(state, rng)) seen.add(offer.rarity)
    }

    assert(seen.has('common') && seen.has('rare') && seen.has('epic'), `gesehen: ${[...seen]}`)
    assert(!seen.has('legendary'), 'Legendary ist nicht freigeschaltet')
    assert(!seen.has('mythic'), 'Mythic ist nicht freigeschaltet')
  })

  check('die Chancen entsprechen der Tabelle des GDD', () => {
    // GDD 06 Abschnitt 8: bei Rare-Freischaltung 80 % Common, 20 % Rare.
    const state = rig()
    unlockUpTo(state, 'rare')
    const rng = createRng(23)

    let common = 0
    let rare = 0
    const rounds = 20000
    for (let i = 0; i < rounds; i++) {
      for (const offer of rollTowerOffer(state, rng, 1)) {
        if (offer.rarity === 'common') common += 1
        if (offer.rarity === 'rare') rare += 1
      }
    }
    // Grosszuegige Schranke: Der Test sichert die Groessenordnung, nicht den Generator.
    assertClose(rare / (common + rare), 0.2, 0.02, `gemessen ${rare}/${common + rare}`)
  })

  check('die Raritaetsgrenze einer Turmart wird eingehalten', () => {
    // Die Kanone reicht laut GDD 06 Abschnitt 9 nur bis Legendary.
    const weights = rarityWeights('cannon', 'mythic')
    assert(
      weights.every((entry) => entry.rarity !== 'mythic'),
      'die Kanone darf nicht mythisch werden',
    )
    assert(
      rarityWeights('autocannon', 'mythic').some((entry) => entry.rarity === 'mythic'),
      'das Maschinengewehr dagegen schon',
    )
  })

  check('jede Stufe der Chancentabelle summiert sich auf hundert', () => {
    for (const rarity of RARITIES) {
      let total = 0
      for (const value of Object.values(RARITY_CHANCE[rarity])) total += value ?? 0
      assertEqual(total, 100, `Stufe ${rarity}`)
    }
  })

  check('die Anzahl der Eigenschaften folgt der Raritaet (GDD 06 Abschnitt 10)', () => {
    const state = rig()
    unlockUpTo(state, 'mythic')
    const rng = createRng(31)

    for (const rarity of RARITIES) {
      const traits = rollTraits(state, 'autocannon', rarity, rng)
      assertEqual(traits.length, TRAIT_SLOTS[rarity], `Stufe ${rarity}`)
    }
    assertEqual(TRAIT_SLOTS.common, 0, 'Common ist die reine Basisversion')
  })

  check('ohne freigeschaltete Eigenschaften bleiben die Plaetze leer', () => {
    const state = rig()
    // Nur die Raritaet, nicht die Eigenschaften: genau der Fall aus GDD 06 Abschnitt 10.
    state.permanent.prestigeNodes.push('rarity.rare', 'rarity.epic', 'rarity.legendary')
    const traits = rollTraits(state, 'autocannon', 'legendary', createRng(3))
    assertEqual(traits.length, 0, 'die Ebene der Eigenschaften ist eine eigene Freischaltung')
  })

  check('ein Turm zieht keine Eigenschaft doppelt', () => {
    const state = rig()
    unlockUpTo(state, 'mythic')
    const rng = createRng(41)
    for (let i = 0; i < 500; i++) {
      const traits = rollTraits(state, 'autocannon', 'mythic', rng)
      assertEqual(new Set(traits).size, traits.length, `Runde ${i}`)
    }
  })

  check('ein Verstaerker zieht nur Verstaerker-Eigenschaften', () => {
    const state = rig()
    unlockUpTo(state, 'mythic')
    const rng = createRng(53)
    for (let i = 0; i < 200; i++) {
      for (const id of rollTraits(state, 'amplifier', 'legendary', rng)) {
        assertEqual(
          traitById(id).effect.kind,
          'buffPower',
          'ein Schadensbonus waere bei ihm wirkungslos',
        )
      }
    }
  })

  check('eine Karte traegt ihre Eigenschaften schon vor der Wahl', () => {
    const state = rig()
    unlockUpTo(state, 'legendary')
    assertEqual(startTowerPurchase(state), true)

    const offer = state.run.towerOffer[0]
    assert(offer !== undefined, 'es muss eine Karte geben')
    assertEqual(offer.traits.length, TRAIT_SLOTS[offer.rarity], 'die Karte ist fertig gewuerfelt')

    const before = state.run.station.inventory.length
    takeTowerOffer(state, 0)
    const module = state.run.station.inventory[before]
    assert(module !== undefined, 'der Turm muss im Lager liegen')
    assertEqual(module.rarity, offer.rarity, 'was auf der Karte stand, kommt auch heraus')
    assertEqual(module.traits.join(','), offer.traits.join(','))
  })

  // -------------------------------------------------------------------------
  // Schmelzen (GDD 06 Abschnitt 5)
  // -------------------------------------------------------------------------

  check('drei Tuerme ergeben ein kostenloses Angebot', () => {
    const state = rig(0)
    const uids = fillInventory(state, 3)
    const before = state.run.station.inventory.length

    const result = meltTowers(state, uids)
    assert(result !== null, 'der Schmelzgang muss greifen')
    assertEqual(result.melted, MELT_COST)
    assertEqual(state.run.gold, 0, 'Schmelzen bringt kein Gold, sondern einen Wurf')
    assertEqual(state.run.station.inventory.length, before - MELT_COST)
    assert(state.run.towerOffer.length > 0, 'und ein Angebot')
  })

  check('geschmolzene Tuerme sind endgueltig weg', () => {
    const state = rig()
    const uids = fillInventory(state, 3)
    meltTowers(state, uids)
    takeTowerOffer(state, 0)

    const station = state.run.station
    for (const uid of uids) {
      assert(
        !station.inventory.some((module) => module.uid === uid),
        `${uid} darf nicht im Lager sein`,
      )
      assert(
        !station.placed.some((module) => module.uid === uid),
        `${uid} darf nicht auf der Station sein`,
      )
    }
  })

  check('weniger oder mehr als drei schmilzt nicht', () => {
    const state = rig()
    const uids = fillInventory(state, 4)
    assertEqual(meltTowers(state, uids.slice(0, 2)), null, 'zwei sind zu wenig')
    assertEqual(meltTowers(state, uids), null, 'vier sind zu viel')
    assertEqual(state.run.station.inventory.length, 3 + 4, 'nichts ist verschwunden')
  })

  check('derselbe Turm zaehlt nicht dreimal', () => {
    const state = rig()
    const uids = fillInventory(state, 3)
    const twice = [uids[0] as string, uids[0] as string, uids[1] as string]
    assertEqual(meltTowers(state, twice), null, 'ein Turm ist ein Turm')
  })

  check('platzierte Tuerme lassen sich nicht einschmelzen', () => {
    const state = rig()
    const uids = fillInventory(state, 3)
    // Einen davon so tun lassen, als staende er auf der Station.
    const module = state.run.station.inventory.find((entry) => entry.uid === uids[0])
    assert(module !== undefined, 'der Turm muss existieren')
    state.run.station.inventory = state.run.station.inventory.filter((entry) => entry !== module)
    state.run.station.placed.push(module)

    assertEqual(meltTowers(state, uids), null, 'nur aus dem Lager')
  })

  check('bei offenem Angebot wird nicht geschmolzen', () => {
    const state = rig()
    const uids = fillInventory(state, 3)
    startTowerPurchase(state)
    assertEqual(meltTowers(state, uids), null, 'sonst ueberschriebe der Gang das Angebot')
  })
}

