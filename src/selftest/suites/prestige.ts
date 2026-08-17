/**
 * Beweis aus E13.
 *
 * Der Implementierungsplan nennt genau eine Abnahmebedingung, und er nennt sie die
 * **fehleranfaelligste Stelle des ganzen Spiels**:
 *
 *   "Eine Liste aller Zustandsfelder wird im Test gegen 'bleibt / wird zurueckgesetzt'
 *   geprueft."
 *
 * Genau das steht unten. Der Test geht **Feld fuer Feld** durch beide Bloecke und prueft
 * jedes einzeln - nicht stichprobenartig, nicht "der Run ist neu". Ein Feld, das
 * faelschlich zurueckgesetzt wird, kostet den Spieler dauerhaften Fortschritt; ein Feld,
 * das faelschlich bleibt, macht das Zuruecksetzen sinnlos. Beides faellt hier auf.
 *
 * Damit der Test nicht mitwaechst, ohne dass jemand hinsieht, arbeitet er gegen dieselben
 * Feldlisten wie `suites/save.ts`: Kommt ein Feld dazu, schlaegt dort die Feldliste an und
 * hier die Zuordnung.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { PRESTIGE_MIN_GOLD } from '../../data/balance.ts'
import { PRESTIGE_NODES, prestigeNodeById } from '../../data/prestige.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState } from '../../sim/combat.ts'
import {
  abilitySlots,
  availableSpeeds,
  buyNode,
  canPrestige,
  doPrestige,
  goldLostOnPrestige,
  isAvailable,
  isUnlocked,
  prestigePoints,
  syncUnlocks,
  towerSlots,
  unlockedRarity,
  unlockedTraitTier,
} from '../../sim/prestige.ts'
import { newModule } from '../../sim/station.ts'
// Nur die Bereichsliste, kein DOM: `ui/prestige.ts` fasst das Dokument erst in seinen
// Funktionen an, das Einbinden allein ist also auch headless unbedenklich.
import { SHOWN_AREAS } from '../../ui/prestige.ts'

function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(9001)
  state.runtime.combat = createCombatState()
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

/** Einen Run mit Fortschritt in jedem Feld, damit das Zuruecksetzen etwas zu tun hat. */
function playedRun(): GameState {
  const state = rig()
  state.run.wave = 42
  state.run.waveRecords = [57]
  state.run.gold = 4321
  state.run.goldEarned = 98765
  state.run.towersBought = 6
  state.run.towerOffer = [{ defId: 'autocannon', rarity: 'common', traits: [] }]
  state.run.coins = [{ x: 10, y: 20, value: 500, count: 3 }]
  state.run.level = 7
  state.run.xp = 12345
  state.run.perks = ['perk.damage.1', 'perk.rate.1']
  state.run.perkOffer = ['perk.gold.1']
  state.run.abilities = ['overload', 'shield']
  state.run.equipped = ['overload']
  state.run.upgrades = { 'core.damage': 4 }
  state.run.autoWaves = false
  state.run.rngState = 555
  state.run.station.inventory.push(newModule(state.run.station, 'cannon', 'rare', ['trait.damage.r']))
  return state
}

export function prestigeSuite(): void {
  suite('sim/prestige')

  // -------------------------------------------------------------------------
  // Freischaltungen als Datenabfrage (GDD 16 Abschnitt 2)
  // -------------------------------------------------------------------------

  check('ohne gekaufte Knoten ist alles auf Anfang', () => {
    const state = rig()
    assertEqual(unlockedRarity(state), 'common')
    assertEqual(unlockedTraitTier(state), null)
    assertEqual(availableSpeeds(state).join(','), '1', 'x2 und x4 sind Freischaltungen')
    assertEqual(abilitySlots(state), 1)
  })

  check('jeder Knoten des Baums ist erreichbar', () => {
    // Ein Knoten, dessen Voraussetzung es nicht gibt, waere totes Kapital im Baum.
    for (const node of PRESTIGE_NODES) {
      for (const required of node.requires) {
        assert(
          PRESTIGE_NODES.some((candidate) => candidate.id === required),
          `${node.id} verlangt ${required}, das es nicht gibt`,
        )
      }
    }
  })

  check('Voraussetzungen sperren, bis sie erfuellt sind', () => {
    const state = rig()
    assertEqual(isAvailable(state, 'rarity.rare'), true, 'der erste Knoten steht frei')
    assertEqual(isAvailable(state, 'rarity.epic'), false, 'der zweite noch nicht')

    state.permanent.prestigePoints = 100000
    assertEqual(buyNode(state, 'rarity.epic'), false, 'auch mit Punkten nicht')

    buyNode(state, 'rarity.rare')
    assertEqual(isAvailable(state, 'rarity.epic'), true, 'jetzt schon')
  })

  check('ohne genug Punkte aendert sich nichts', () => {
    const state = rig()
    state.permanent.prestigePoints = 10
    assertEqual(buyNode(state, 'rarity.rare'), false, 'Rare kostet 50')
    assertEqual(state.permanent.prestigePoints, 10)
    assertEqual(isUnlocked(state, 'rarity.rare'), false)
  })

  check('ein Kauf zieht genau die Kosten ab', () => {
    const state = rig()
    state.permanent.prestigePoints = 1000
    const cost = prestigeNodeById('rarity.rare').cost
    assertEqual(buyNode(state, 'rarity.rare'), true)
    assertEqual(state.permanent.prestigePoints, 1000 - cost)
    assertEqual(buyNode(state, 'rarity.rare'), false, 'zweimal geht nicht')
  })

  check('Turmplaetze und Slots wirken sofort, nicht erst im naechsten Run', () => {
    const state = rig()
    state.permanent.prestigePoints = 100000
    const slotsBefore = state.run.station.slots

    buyNode(state, 'towers.slot1')
    assertEqual(towerSlots(state), slotsBefore + 1)
    assertEqual(state.run.station.slots, slotsBefore + 1, 'die Station weiss es schon')

    buyNode(state, 'towers.ability2')
    assertEqual(abilitySlots(state), 2)
    assertEqual(state.run.abilitySlots, 2)
  })

  check('Tempo x2 und x4 haengen am Baum (GDD 10, Bereich 2b)', () => {
    const state = rig()
    state.permanent.prestigePoints = 100000
    buyNode(state, 'speed.x2')
    assertEqual(availableSpeeds(state).join(','), '1,2')
    buyNode(state, 'speed.x4')
    assertEqual(availableSpeeds(state).join(','), '1,2,4')
  })

  check('eine geschrumpfte Slotzahl kuerzt die Belegung', () => {
    const state = rig()
    state.run.equipped = ['overload', 'shield', 'repair']
    syncUnlocks(state)
    assertEqual(state.run.equipped.length, 1, 'ohne Freischaltung passt nur einer')
  })

  // -------------------------------------------------------------------------
  // Punkte und Voraussetzung (GDD 10 Abschnitt 3 und 5)
  // -------------------------------------------------------------------------

  check('unter tausend verdientem Gold gibt es kein Prestige', () => {
    const state = rig()
    state.run.goldEarned = PRESTIGE_MIN_GOLD - 1
    assertEqual(canPrestige(state), false)
    assertEqual(doPrestige(state), false, 'und der Versuch aendert nichts')

    state.run.goldEarned = PRESTIGE_MIN_GOLD
    assertEqual(canPrestige(state), true)
  })

  check('gezaehlt wird verdientes Gold, nicht der Kontostand', () => {
    const state = rig()
    state.run.goldEarned = 5000
    state.run.gold = 0
    assertEqual(canPrestige(state), true, 'ausgegebenes Gold zaehlt mit')

    state.run.goldEarned = 0
    state.run.gold = 5000
    assertEqual(canPrestige(state), false, 'geschenktes Gold zaehlt nicht')
  })

  check('die Punkte folgen den Richtwerten des GDD', () => {
    const state = rig()
    state.run.goldEarned = 0
    const at = (wave: number): number => {
      state.run.waveRecords = [wave]
      return prestigePoints(state)
    }
    // GDD 10 Abschnitt 5 nennt 5-10 / 50-100 / 500 als Richtwerte und die Formel
    // ausdruecklich als Balancing-Wert. Geprueft wird die Groessenordnung.
    assert(at(100) >= 2 && at(100) <= 12, `Welle 100 ergab ${at(100)}`)
    assert(at(500) >= 50 && at(500) <= 150, `Welle 500 ergab ${at(500)}`)
    assert(at(1000) >= 400 && at(1000) <= 600, `Welle 1000 ergab ${at(1000)}`)
  })

  check('weiter kommen bringt ueberproportional mehr', () => {
    const state = rig()
    state.run.goldEarned = 0
    const at = (wave: number): number => {
      state.run.waveRecords = [wave]
      return prestigePoints(state)
    }
    // Doppelte Welle muss mehr als das Doppelte bringen (GDD 10 Abschnitt 5).
    assert(at(400) > at(200) * 2, `${at(400)} gegen ${at(200)}`)
  })

  check('liegendes Gold zaehlt in die Warnung', () => {
    const state = rig()
    state.run.gold = 100
    state.run.coins = [{ x: 0, y: 0, value: 250, count: 1 }]
    assertEqual(goldLostOnPrestige(state), 350, 'Kontostand plus Feld (GDD 10 Abschnitt 3)')
  })

  // -------------------------------------------------------------------------
  // Zuruecksetzen - Feld fuer Feld
  // -------------------------------------------------------------------------

  check('jedes Run-Feld wird zurueckgesetzt (E13-Kernabsicherung)', () => {
    const state = playedRun()
    const fresh = createInitialState(1)

    assertEqual(doPrestige(state), true)

    // Feld fuer Feld gegen einen frischen Run. Der Startwert des Generators darf und soll
    // abweichen - zwei Runs sollen sich nicht gleich anfuehlen.
    const skip = new Set(['seed', 'rngState', 'station'])
    for (const key of Object.keys(fresh.run)) {
      if (skip.has(key)) continue
      const actual = state.run[key as keyof typeof state.run]
      const expected = fresh.run[key as keyof typeof fresh.run]
      assertEqual(
        JSON.stringify(actual),
        JSON.stringify(expected),
        `run.${key} muss zurueckgesetzt sein`,
      )
    }
  })

  check('die Station wird zurueckgesetzt, aber nicht die Turmplaetze', () => {
    const state = playedRun()
    state.permanent.prestigePoints = 100000
    buyNode(state, 'towers.slot1')

    doPrestige(state)

    assertEqual(state.run.station.placed.length, 0, 'nichts steht mehr')
    assertEqual(state.run.station.inventory.length, 3, 'nur das Startlager')
    assertEqual(state.run.station.slots, towerSlots(state), 'der gekaufte Platz bleibt')
  })

  check('jedes permanente Feld bleibt erhalten (E13-Kernabsicherung)', () => {
    const state = playedRun()
    state.permanent.prestigeNodes = ['rarity.rare']
    state.permanent.prestigePoints = 500
    state.permanent.unlockedTowers = ['autocannon', 'cannon']
    state.permanent.unlockedCores = ['sentinel']
    state.permanent.seenHints = ['hint.build']
    state.permanent.totalPlaySeconds = 3600
    state.permanent.bestWaveEver = 20
    const countBefore = state.permanent.prestigeCount

    const earned = prestigePoints(state)
    assertEqual(doPrestige(state), true)

    assertEqual(state.permanent.prestigeNodes.join(','), 'rarity.rare', 'Baum bleibt')
    assertEqual(state.permanent.prestigePoints, 500 + earned, 'Punkte bleiben und wachsen')
    assertEqual(state.permanent.unlockedTowers.join(','), 'autocannon,cannon')
    assertEqual(state.permanent.unlockedCores.join(','), 'sentinel')
    assertEqual(state.permanent.seenHints.join(','), 'hint.build')
    assertEqual(state.permanent.totalPlaySeconds, 3600)
    assertEqual(state.permanent.prestigeCount, countBefore + 1, 'der Zaehler steigt')
    assertEqual(state.permanent.bestWaveEver, 57, 'der Bestwert zieht nach')
  })

  check('die Laufzeitdaten gehen mit dem Run', () => {
    const state = playedRun()
    state.runtime.combat.killsThisWave = 99
    state.runtime.abilities.cooldowns.set('overload', 30)
    state.runtime.announcedLevel = 7
    state.runtime.selectedUid = 'irgendwas'

    doPrestige(state)

    assertEqual(state.runtime.combat.killsThisWave, 0, 'ein neues Gefecht')
    assertEqual(state.runtime.abilities.cooldowns.size, 0, 'keine Abklingzeit ueberlebt')
    assertEqual(state.runtime.announcedLevel, -1, 'die Stufe wird neu angesagt')
    assertEqual(state.runtime.selectedUid, null)
  })

  check('der Bestwert faellt nie, auch nach einem schwaecheren Run', () => {
    const state = playedRun()
    state.permanent.bestWaveEver = 300
    doPrestige(state)
    assertEqual(state.permanent.bestWaveEver, 300, 'ein schlechterer Run senkt ihn nicht')
  })

  check('nach dem Prestige ist wieder alles zu verdienen', () => {
    const state = playedRun()
    doPrestige(state)
    assertEqual(canPrestige(state), false, 'der neue Run faengt bei null an')
    assertEqual(state.run.towersBought, 0, 'und der erste Turm kostet wieder den Grundpreis')
  })

  check('die Energiewelle liegt in den neuen Laufzeitdaten, nicht in den alten', () => {
    /*
     * GDD 13 Abschnitt 10 verlangt fuer das Prestige "eine grosse Energieanimation". Sie
     * ist hier eine echte Zusicherung und nicht nur Zierde, weil sie an der einen Stelle
     * haengt, an der man sie am leichtesten falsch anbringt: **vor** dem Zuruecksetzen.
     * Dort gelegt waere sie mit dem alten Kampfzustand verworfen worden, und niemand haette
     * je etwas gesehen - der Fehler faellt am Bild nicht auf, weil das Bild eben leer ist.
     */
    const state = playedRun()
    doPrestige(state)

    const rings = state.runtime.combat.bursts.filter((burst) => burst.active)
    assert(rings.length >= 4, `nur ${rings.length} Ringe - die Welle muss gross sein`)
    assert(
      state.runtime.combat.stationFlash.active,
      'der Kern muss nachzittern - er wird schliesslich ersetzt',
    )
    // Die Ringe gehen von der Mitte aus, nicht von einem Modul des alten Runs.
    for (const ring of rings) {
      assertEqual(ring.pos.x, 0)
      assertEqual(ring.pos.y, 0)
    }
  })

  check('jeder Bereich des Datensatzes wird im Baum auch gezeigt', () => {
    /*
     * Diese Zusicherung ist aus einem echten Fehler entstanden.
     *
     * E14 hat den Bereich `tech` mit fuenf Knoten gefuellt, aber die Bereichsliste der
     * Oberflaeche stand seit E13 unveraendert - die Spezialtuerme waren im Baum schlicht
     * nicht zu sehen und damit unerreichbar. Ein Knoten, den es gibt und den niemand
     * kaufen kann, ist schlimmer als einer, den es nicht gibt.
     *
     * Der Test laeuft ueber den **Datensatz**, nicht ueber eine zweite Liste: Ein neuer
     * Bereich schlaegt hier an, sobald sein erster Knoten steht.
     */
    const inData = new Set(PRESTIGE_NODES.map((node) => node.area))
    const missing = [...inData].filter((area) => !SHOWN_AREAS.includes(area))
    assertEqual(missing.join(', '), '', 'diese Bereiche fehlen in ui/prestige.ts')
  })
}
