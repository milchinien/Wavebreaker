/**
 * Beweis aus E16 (Ereignisse und Versorgungskapseln).
 *
 * Die Abnahmebedingung der Etappe ist dieselbe wie bei Tuermen und Gegnern: **Ein neues
 * Ereignis ist ein Datensatz.** Diese Datei prueft deshalb nicht, ob ein bestimmtes
 * Ereignis das Richtige tut, sondern ob der Weg vom Datensatz zur Wirkung fuer **jedes**
 * Ereignis und **jede** Option traegt. Dafuer laufen die wichtigsten Zusicherungen ueber
 * die vollstaendige Tabelle statt ueber ein Beispiel.
 *
 * Der zweite Schwerpunkt ist der Rhythmus: Ereignisse duerfen sich nicht stauen und nicht
 * ausbleiben, und ein Neuladen darf keines neu wuerfeln.
 *
 * Achtung bei der Namensgleichheit: `core/events.ts` ist der Ereignisbus des Programms,
 * `data/events.ts` sind die Spielereignisse. Dieser Test meint die zweiten - der Bus hat
 * seine eigene Suite in `suites/format.ts`.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { createRng } from '../../core/rng.ts'
import {
  EVENT_WAVE_MAX,
  EVENT_WAVE_MIN,
  MAX_PODS,
  POD_DROP_CHANCE,
  POD_DROP_CHANCE_BOSS,
  POD_DROP_CHANCE_ELITE,
  eventRewardFor,
} from '../../data/balance.ts'
import { EVENTS, PODS, eventsForWave, podsForWave } from '../../data/events.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import {
  boonLeft,
  collectPod,
  collectPodsAt,
  currentEvent,
  dismissEvent,
  dropPod,
  isValidPod,
  maybeTriggerEvent,
  podChanceFor,
  resetBoons,
  resolveEvent,
  rollPodKind,
  stepEvents,
} from '../../sim/events.ts'
import { spawnEnemy } from '../../sim/enemies.ts'
import { startWave } from '../../sim/waves.ts'

/** Ein Zustand mit stehender Station - Ereignisse, die Gegner erscheinen lassen, brauchen sie. */
function ready(seed = 11): GameState {
  const state = createInitialState(seed)
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

export function eventsSuite(): void {
  suite('sim/events · Ereignisse')

  check('jedes Ereignis hat mindestens zwei Optionen', () => {
    // Ein Ereignis mit einer Option ist keine Entscheidung, sondern eine Meldung
    // (GDD 11 Abschnitt 4).
    for (const event of EVENTS) {
      assert(event.choices.length >= 2, `${event.id} hat nur ${event.choices.length} Optionen`)
    }
  })

  check('jede Option hat eine Wirkung und einen Text dazu', () => {
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        assert(choice.effects.length > 0, `${event.id}/${choice.id} bewirkt nichts`)
        assert(choice.detail.length > 0, `${event.id}/${choice.id} nennt seine Folge nicht`)
      }
    }
  })

  check('Optionskennungen sind innerhalb eines Ereignisses eindeutig', () => {
    for (const event of EVENTS) {
      const ids = new Set(event.choices.map((choice) => choice.id))
      assertEqual(ids.size, event.choices.length, `${event.id} hat doppelte Optionen`)
    }
  })

  check('jede Option laesst sich waehlen und schliesst das Ereignis', () => {
    // Der Durchlauf ueber **alle** Optionen ist die eigentliche Abnahme: Ein neuer
    // Datensatz muss ohne neuen Code funktionieren.
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        const state = ready()
        startWave(state, Math.max(1, event.minWave))
        state.run.eventId = event.id

        assertEqual(resolveEvent(state, choice.id), true, `${event.id}/${choice.id}`)
        assertEqual(state.run.eventId, null)
        assertEqual(currentEvent(state), null)
      }
    }
  })

  check('eine unbekannte Option aendert nichts', () => {
    const state = ready()
    state.run.eventId = 'alientech'
    assertEqual(resolveEvent(state, 'gibtesnicht'), false)
    assertEqual(state.run.eventId, 'alientech')
  })

  check('ohne offenes Ereignis laesst sich nichts waehlen', () => {
    const state = ready()
    assertEqual(resolveEvent(state, 'sell'), false)
  })

  check('eine Belohnungsoption zahlt aus, und zwar wellenabhaengig', () => {
    const early = ready()
    startWave(early, 5)
    early.run.eventId = 'alientech'
    resolveEvent(early, 'sell')

    const late = ready()
    startWave(late, 60)
    late.run.eventId = 'alientech'
    resolveEvent(late, 'sell')

    assert(early.run.gold > 0, 'auf Welle 5 muss etwas herauskommen')
    assert(
      late.run.gold > early.run.gold * 5,
      'auf Welle 60 muss deutlich mehr herauskommen - sonst ist das Ereignis spaeter wertlos',
    )
    assertEqual(early.run.gold, eventRewardFor(5) * 6)
  })

  check('ein Bonus wirkt auf die Kampfwerte und laeuft ab', () => {
    const state = ready()
    state.run.eventId = 'powersurge'
    resolveEvent(state, 'surge')

    // Die Wirkung steht als fertige Zahl im Kampfzustand - Werte und Kampf lesen sie dort.
    assertEqual(state.runtime.combat.eventBonus.attackSpeed, 0.5)
    assertEqual(state.runtime.combat.enemyPower, 1.5)
    assert(boonLeft(state, 'powersurge') > 0, 'die Wirkung muss laufen')

    // Nach Ablauf muessen **beide** Zahlen zurueckgenommen sein. Genau hier faellt ein
    // fortgeschriebener statt neu aufgebauter Wert auf.
    stepEvents(state, 46)
    assertEqual(state.runtime.combat.eventBonus.attackSpeed, undefined)
    assertEqual(state.runtime.combat.enemyPower, 1)
    assertEqual(boonLeft(state, 'powersurge'), 0)
  })

  check('dasselbe Ereignis zweimal verlaengert, statt sich zu verdoppeln', () => {
    const state = ready()
    state.run.eventId = 'powersurge'
    resolveEvent(state, 'surge')
    stepEvents(state, 20)

    state.run.eventId = 'powersurge'
    resolveEvent(state, 'surge')

    assertEqual(state.runtime.combat.eventBonus.attackSpeed, 0.5, 'nicht 1.0')
    assertEqual(state.runtime.combat.enemyPower, 1.5, 'nicht 2.25')
  })

  check('ein staerkerer Gegner erscheint wirklich', () => {
    const state = ready()
    startWave(state, 30)
    const before = state.runtime.combat.enemies.length

    state.run.eventId = 'mutation'
    resolveEvent(state, 'engage')

    assertEqual(state.runtime.combat.enemies.length, before + 10)
  })

  check('ein verstaerkter Gegner erscheint staerker als ohne Ereignis', () => {
    const plain = ready()
    startWave(plain, 20)
    const normal = spawnEnemy(plain, 'drone', 0)

    const hazard = ready()
    startWave(hazard, 20)
    hazard.run.eventId = 'singularity'
    resolveEvent(hazard, 'absorb')
    const stronger = spawnEnemy(hazard, 'drone', 0)

    assert(normal !== null && stronger !== null, 'beide Gegner muessen erscheinen')
    assertEqual(stronger.maxHp, normal.maxHp * 1.5)
    assertEqual(stronger.damage, normal.damage * 1.5)
  })

  check('resetBoons nimmt jede laufende Wirkung zurueck', () => {
    const state = ready()
    state.run.eventId = 'alientech'
    resolveEvent(state, 'install')
    assert(state.runtime.boons.length > 0, 'es muss eine Wirkung laufen')

    resetBoons(state)
    assertEqual(state.runtime.boons.length, 0)
    assertEqual(state.runtime.combat.eventBonus.damage, undefined)
    assertEqual(state.runtime.combat.enemyPower, 1)
  })

  check('verwerfen schliesst das Ereignis ohne Belohnung', () => {
    const state = ready()
    startWave(state, 10)
    state.run.eventId = 'alientech'
    const gold = state.run.gold

    dismissEvent(state)
    assertEqual(state.run.eventId, null)
    assertEqual(state.run.gold, gold)
  })

  suite('sim/events · Rhythmus')

  check('das erste Ereignis liegt 15 bis 25 Wellen voraus', () => {
    const state = ready()
    const rng = createRng(3)

    startWave(state, 40)
    maybeTriggerEvent(state, rng)

    const gap = state.run.nextEventWave - 40
    assert(
      gap >= EVENT_WAVE_MIN && gap <= EVENT_WAVE_MAX,
      `Abstand ${gap} liegt ausserhalb von ${EVENT_WAVE_MIN}..${EVENT_WAVE_MAX}`,
    )
    assertEqual(state.run.eventId, null, 'der erste Aufruf setzt nur den Termin')
  })

  check('auf der faelligen Welle faellt genau ein Ereignis', () => {
    const state = ready()
    const rng = createRng(5)

    startWave(state, 40)
    state.run.nextEventWave = 40

    const event = maybeTriggerEvent(state, rng)
    assert(event !== null, 'es muss ein Ereignis fallen')
    assertEqual(state.run.eventId, event.id)

    // Ein zweiter Aufruf darf das offene Ereignis nicht ueberschreiben - zwei Fenster
    // uebereinander waeren ein Stau und keine Abwechslung.
    assertEqual(maybeTriggerEvent(state, rng), null)
    assertEqual(state.run.eventId, event.id)
  })

  check('der Termin wird auch dann weitergesetzt, wenn kein Ereignis passt', () => {
    const state = ready()
    const rng = createRng(9)

    // Welle 1: Kein Ereignis hat eine so niedrige Mindestwelle.
    startWave(state, 1)
    state.run.nextEventWave = 1
    assertEqual(eventsForWave(1).length, 0, 'Voraussetzung dieses Tests')

    assertEqual(maybeTriggerEvent(state, rng), null)
    assert(state.run.nextEventWave > 1, 'sonst prueft der naechste Takt sofort wieder')
  })

  check('ein Ereignis erscheint nie vor seiner Mindestwelle', () => {
    const rng = createRng(21)
    for (let wave = 1; wave <= 30; wave++) {
      for (const event of eventsForWave(wave)) {
        assert(wave >= event.minWave, `${event.id} auf Welle ${wave}`)
      }
    }
    // Und der Wurf zieht wirklich nur aus dieser Menge.
    const state = ready()
    startWave(state, 12)
    state.run.nextEventWave = 12
    const event = maybeTriggerEvent(state, rng)
    assert(event !== null && event.minWave <= 12, 'gewuerfelt wurde ein zu fruehes Ereignis')
  })

  suite('sim/events · Versorgungskapseln')

  check('Bosse lassen immer eine Kapsel fallen, Elites deutlich haeufiger', () => {
    const state = ready()
    startWave(state, 60)
    const enemy = spawnEnemy(state, 'drone', 0)
    assert(enemy !== null, 'Gegner muss erscheinen')

    assertEqual(podChanceFor(enemy, false), POD_DROP_CHANCE)
    enemy.elite.push('elite.swift')
    assertEqual(podChanceFor(enemy, false), POD_DROP_CHANCE_ELITE)
    assertEqual(podChanceFor(enemy, true), POD_DROP_CHANCE_BOSS)
  })

  check('eine Kapselart erscheint nie vor ihrer Mindestwelle', () => {
    const rng = createRng(13)
    for (const wave of [1, 5, 10, 25, 50]) {
      for (let i = 0; i < 50; i++) {
        const pod = rollPodKind(wave, rng)
        assert(pod !== null, `Welle ${wave} muss eine Kapselart hergeben`)
        assert(wave >= pod.minWave, `${pod.id} auf Welle ${wave}`)
      }
    }
  })

  check('jede Kapselart hat ein Gewicht und eine Wirkung', () => {
    for (const pod of PODS) {
      assert(pod.weight > 0, `${pod.id} kann nie fallen`)
      assert(pod.minWave >= 1, `${pod.id} hat eine unsinnige Mindestwelle`)
    }
    assert(podsForWave(1).length > 0, 'auf Welle 1 muss etwas fallen koennen')
  })

  check('eine Goldkapsel zahlt beim Einsammeln aus, nicht beim Fallen', () => {
    const state = ready()
    startWave(state, 10)

    const pod = dropPod(state, { x: 40, y: 0 }, 'pod.gold')
    assert(pod !== null, 'die Kapsel muss entstehen')
    assertEqual(state.run.gold, 0, 'das Fallen selbst darf nichts einbringen')

    assertEqual(collectPod(state, pod.id), true)
    assertEqual(state.run.gold, eventRewardFor(10) * 3)
    assertEqual(state.run.pods.length, 0)
  })

  check('der Wert richtet sich nach der Welle des Einsammelns', () => {
    const state = ready()
    startWave(state, 5)
    const pod = dropPod(state, { x: 0, y: 0 }, 'pod.gold')
    assert(pod !== null, 'die Kapsel muss entstehen')

    // Liegen lassen, weiterspielen, dann aufheben: Eine Kapsel darf keine Falle sein.
    startWave(state, 45)
    collectPod(state, pod.id)
    assertEqual(state.run.gold, eventRewardFor(45) * 3)
  })

  check('eine Upgrade-Kapsel verschenkt genau eine Stufe', () => {
    const state = ready()
    startWave(state, 10)
    const before = Object.values(state.run.upgrades).reduce((sum, level) => sum + level, 0)

    const pod = dropPod(state, { x: 0, y: 0 }, 'pod.upgrade')
    assert(pod !== null, 'die Kapsel muss entstehen')
    collectPod(state, pod.id)

    const after = Object.values(state.run.upgrades).reduce((sum, level) => sum + level, 0)
    assertEqual(after, before + 1)
  })

  check('eine Turmkapsel legt ein Angebot vor - und ueberschreibt keines', () => {
    const state = ready()
    startWave(state, 40)

    const first = dropPod(state, { x: 0, y: 0 }, 'pod.tower')
    assert(first !== null, 'die Kapsel muss entstehen')
    collectPod(state, first.id)
    assert(state.run.towerOffer.length > 0, 'es muss ein Angebot vorliegen')

    // Die zweite Kapsel darf das laufende Angebot nicht wegwerfen - der Spieler hat es
    // sonst verloren, ohne gewaehlt zu haben.
    const signature = JSON.stringify(state.run.towerOffer)
    const gold = state.run.gold
    const second = dropPod(state, { x: 0, y: 0 }, 'pod.tower')
    assert(second !== null, 'die zweite Kapsel muss entstehen')
    collectPod(state, second.id)

    assertEqual(JSON.stringify(state.run.towerOffer), signature)
    assert(state.run.gold > gold, 'stattdessen muss sie in Gold auszahlen')
  })

  check('die seltene Turmkapsel hebt die Untergrenze der Raritaet', () => {
    const state = ready()
    startWave(state, 50)
    // Ohne freigeschaltete Raritaeten kann sie nichts anheben - dann muss sie trotzdem
    // etwas liefern statt leer aufzugehen.
    const pod = dropPod(state, { x: 0, y: 0 }, 'pod.towerRare')
    assert(pod !== null, 'die Kapsel muss entstehen')
    collectPod(state, pod.id)
    assert(state.run.towerOffer.length > 0, 'auch bei Common muss ein Angebot herauskommen')

    // Mit freigeschalteten Raritaeten liegt jede Karte mindestens auf Epic.
    const rich = ready(4)
    startWave(rich, 50)
    rich.permanent.prestigeNodes.push('rarity.rare', 'rarity.epic', 'rarity.legendary')
    const better = dropPod(rich, { x: 0, y: 0 }, 'pod.towerRare')
    assert(better !== null, 'die Kapsel muss entstehen')
    collectPod(rich, better.id)
    for (const offer of rich.run.towerOffer) {
      assert(
        offer.rarity === 'epic' || offer.rarity === 'legendary' || offer.rarity === 'mythic',
        `${offer.defId} kam als ${offer.rarity}`,
      )
    }
  })

  check('Kapseln lassen sich mit dem Zeiger aufheben - aber nur in Reichweite', () => {
    const state = ready()
    startWave(state, 10)
    dropPod(state, { x: 0, y: 0 }, 'pod.gold')

    assertEqual(collectPodsAt(state, { x: 500, y: 500 }), 0, 'zu weit weg')
    assertEqual(state.run.pods.length, 1)

    assertEqual(collectPodsAt(state, { x: 0, y: 0 }), 1)
    assertEqual(state.run.pods.length, 0)
  })

  check('mehr als die Obergrenze liegt nie im Feld', () => {
    const state = ready()
    for (let i = 0; i < MAX_PODS + 8; i++) dropPod(state, { x: i * 40, y: 0 }, 'pod.gold')
    assertEqual(state.run.pods.length, MAX_PODS)
  })

  check('eine unbekannte Kapselart entsteht gar nicht erst', () => {
    const state = ready()
    assertEqual(dropPod(state, { x: 0, y: 0 }, 'pod.gibtesnicht'), null)
    assertEqual(state.run.pods.length, 0)
  })

  check('eine gelesene Kapsel wird geprueft, nicht geglaubt', () => {
    assertEqual(isValidPod({ id: 1, defId: 'pod.gold', x: 0, y: 0 }), true)
    assertEqual(isValidPod({ id: 1, defId: 'pod.weg', x: 0, y: 0 }), false)
    assertEqual(isValidPod({ id: 1, defId: 'pod.gold', x: 'nein', y: 0 }), false)
    assertEqual(isValidPod(null), false)
  })
}
