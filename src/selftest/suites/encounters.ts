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
 * Die Datei heisst `encounters` und nicht `events`, weil `suites/events.ts` schon vergeben
 * ist - an den Ereignis**bus** des Programms. Zwei Dinge mit demselben Namen sind in diesem
 * Projekt sonst nirgends, und hier waere die Verwechslung besonders teuer.
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
import {
  TRADER_STAY_SECONDS,
  TRADER_STOCK_SIZE,
  TRADER_WAVE_MAX,
  TRADER_WAVE_MIN,
} from '../../data/balance.ts'
import { TRADER_STOCK, stockForWave, traderStockById } from '../../data/trader.ts'
import { createInitialState, type GameState, type Trader } from '../../app/state.ts'
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
import {
  buyFromTrader,
  dismissTrader,
  isValidTrader,
  maybeSendTrader,
  reachTraderAt,
  stepTrader,
} from '../../sim/trader.ts'
import { startWave } from '../../sim/waves.ts'

/** Ein Zustand mit stehender Station - Ereignisse, die Gegner erscheinen lassen, brauchen sie. */
function ready(seed = 11): GameState {
  const state = createInitialState(seed)
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

export function encountersSuite(): void {
  suite('sim/events · Ereignisse')

  check('jedes Ereignis hat mindestens zwei Optionen', () => {
    // Ein Ereignis mit einer Option ist keine Entscheidung, sondern eine Meldung
    // (GDD 11 Abschnitt 4).
    for (const event of EVENTS) {
      assert(event.choices.length >= 2, `${event.id} hat nur ${event.choices.length} Optionen`)
    }
  })

  check('jede Option hat eine Wirkung und nennt ihre Folge', () => {
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
      'auf Welle 60 muss deutlich mehr herauskommen - sonst ist das Ereignis spaet wertlos',
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

  check('zusaetzliche Gegner erscheinen wirklich', () => {
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
    for (let wave = 1; wave <= 30; wave++) {
      for (const event of eventsForWave(wave)) {
        assert(wave >= event.minWave, `${event.id} auf Welle ${wave}`)
      }
    }

    // Und der Wurf zieht wirklich nur aus dieser Menge.
    const state = ready()
    const rng = createRng(21)
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

  check('jede Kapselart hat ein Gewicht und eine sinnvolle Mindestwelle', () => {
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

    // Die zweite Kapsel darf das laufende Angebot nicht wegwerfen - der Spieler haette es
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
    // Ohne freigeschaltete Raritaeten kann sie nichts anheben - dann muss sie trotzdem
    // etwas liefern statt leer aufzugehen.
    const state = ready()
    startWave(state, 50)
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
    assert(rich.run.towerOffer.length > 0, 'es muss ein Angebot herauskommen')
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

  suite('sim/trader · Haendler-Drohne')

  /** Eine gelandete Drohne mit vollem Sortiment auf dieser Welle. */
  function landed(state: GameState, wave: number): Trader {
    startWave(state, wave)
    state.run.nextTraderWave = wave
    const trader = maybeSendTrader(state, state.runtime.rng)
    if (!trader) throw new Error('die Drohne muss landen')
    return trader
  }

  check('jede Ware hat Preis, Gewicht und eine Beschreibung', () => {
    for (const entry of TRADER_STOCK) {
      assert(entry.price > 0, `${entry.id} ist umsonst`)
      assert(entry.weight > 0, `${entry.id} kann nie erscheinen`)
      assert(entry.description.length > 0, `${entry.id} sagt nicht, was es tut`)
      assert(entry.minWave >= 1, `${entry.id} hat eine unsinnige Mindestwelle`)
    }
    assert(stockForWave(1).length > 0, 'auf Welle 1 muss etwas zu kaufen sein')
  })

  check('der Abstand liegt zwischen den Grenzen', () => {
    const state = ready()
    const rng = createRng(31)
    startWave(state, 20)

    maybeTriggerEvent(state, rng) // stoert nicht, teilt sich aber den Generator
    maybeSendTrader(state, rng)
    const gap = state.run.nextTraderWave - 20
    assert(
      gap >= TRADER_WAVE_MIN && gap <= TRADER_WAVE_MAX,
      `Abstand ${gap} liegt ausserhalb von ${TRADER_WAVE_MIN}..${TRADER_WAVE_MAX}`,
    )
  })

  check('sie landet mit vollem Sortiment und in Reichweite der Station', () => {
    const state = ready()
    const trader = landed(state, 25)

    assertEqual(trader.stock.length, TRADER_STOCK_SIZE)
    assertEqual(trader.visited, false)
    assertEqual(trader.left, TRADER_STAY_SECONDS)

    const distance = Math.hypot(trader.x, trader.y)
    assert(distance >= 150 && distance <= 400, `sie landete ${Math.round(distance)} weit weg`)
  })

  check('ihr Sortiment hat keine Doppel', () => {
    // Drei gleiche Karten waeren keine Wahl - dieselbe Regel wie beim Perk-Angebot.
    for (let seed = 1; seed <= 20; seed++) {
      const state = ready(seed)
      const trader = landed(state, 45)
      const ids = new Set(trader.stock.map((offer) => offer.defId))
      assertEqual(ids.size, trader.stock.length, `Seed ${seed} hat Doppel`)
    }
  })

  check('sie bietet nie Ware an, die es auf dieser Welle noch nicht gibt', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = ready(seed)
      const trader = landed(state, 3)
      for (const offer of trader.stock) {
        assert(traderStockById(offer.defId).minWave <= 3, `${offer.defId} auf Welle 3`)
      }
    }
  })

  check('zwei Drohnen stehen nie gleichzeitig im Feld', () => {
    const state = ready()
    const first = landed(state, 30)
    state.run.nextTraderWave = 30
    assertEqual(maybeSendTrader(state, state.runtime.rng), null)
    assertEqual(state.run.trader, first)
  })

  check('sie fliegt nach ihrer Frist weiter', () => {
    const state = ready()
    landed(state, 30)

    stepTrader(state, TRADER_STAY_SECONDS - 1)
    assert(state.run.trader !== null, 'kurz vorher steht sie noch da')

    stepTrader(state, 2)
    assertEqual(state.run.trader, null)
  })

  check('erreicht wartet sie - die Uhr laeuft nicht weiter', () => {
    // Ein Laden, der waehrend des Einkaufs abhebt, waere keine Gelegenheit, sondern eine
    // Falle. Das ist die wichtigste Zusicherung dieses Abschnitts.
    const state = ready()
    const trader = landed(state, 30)

    assertEqual(reachTraderAt(state, { x: trader.x, y: trader.y }), true)
    assertEqual(trader.visited, true)

    stepTrader(state, TRADER_STAY_SECONDS * 5)
    assertEqual(state.run.trader, trader, 'sie muss stehen bleiben')
  })

  check('sie oeffnet nur, wenn der Zeiger sie wirklich erreicht', () => {
    const state = ready()
    const trader = landed(state, 30)

    assertEqual(reachTraderAt(state, { x: trader.x + 500, y: trader.y }), false)
    assertEqual(trader.visited, false)
    assertEqual(reachTraderAt(state, { x: trader.x, y: trader.y }), true)
    // Ein zweiter Aufruf oeffnet nicht noch einmal - sonst blitzte das Fenster bei jeder
    // Zeigerbewegung neu auf.
    assertEqual(reachTraderAt(state, { x: trader.x, y: trader.y }), false)
  })

  check('ohne Gold laesst sich nichts kaufen', () => {
    const state = ready()
    const trader = landed(state, 30)
    state.run.gold = 0

    assertEqual(buyFromTrader(state, 0), false)
    assertEqual(trader.stock[0]?.sold, false)
  })

  check('ein Posten laesst sich genau einmal kaufen', () => {
    const state = ready()
    const trader = landed(state, 30)
    state.run.gold = 1e9

    assertEqual(buyFromTrader(state, 0), true)
    assertEqual(trader.stock[0]?.sold, true)
    assertEqual(buyFromTrader(state, 0), false, 'ein zweites Mal nicht')
  })

  check('jede Warenart wirkt wirklich', () => {
    /*
     * Der Durchlauf ueber die **vollstaendige** Tabelle ist die Abnahme: Eine neue Ware
     * muss ohne neuen Code wirken. Geprueft wird je Art die Groesse, die sie veraendert.
     */
    for (const def of TRADER_STOCK) {
      const state = ready(3)
      const trader = landed(state, Math.max(def.minWave, 45))
      state.run.gold = 1e9

      // Das gewuerfelte Sortiment gegen genau diese eine Ware tauschen.
      trader.stock = [
        {
          defId: def.id,
          perkId: def.effect.kind === 'perk' ? 'perk.damage.1' : null,
          upgradeId: def.effect.kind === 'upgrade' ? 'f1.hammerfall' : null,
          price: 1,
          sold: false,
        },
      ]

      const before = {
        upgrades: Object.values(state.run.upgrades).reduce((sum, level) => sum + level, 0),
        boons: state.runtime.boons.length,
        perks: state.run.perks.length,
        offer: state.run.towerOffer.length,
      }

      assertEqual(buyFromTrader(state, 0), true, def.id)

      switch (def.effect.kind) {
        case 'upgrade': {
          const after = Object.values(state.run.upgrades).reduce((sum, level) => sum + level, 0)
          assertEqual(after, before.upgrades + def.effect.levels, def.id)
          // Und zwar auf **dem** Pfad, der auf der Karte stand (E7): Vorher wuerfelte erst
          // der Kauf, und die Karte konnte gar nichts versprechen.
          assertEqual(
            state.run.upgrades['f1.hammerfall'],
            def.effect.levels,
            `${def.id} liefert nicht das benannte Upgrade`,
          )
          break
        }
        case 'boon':
          assertEqual(state.runtime.boons.length, before.boons + 1, def.id)
          break
        case 'perk':
          assertEqual(state.run.perks.length, before.perks + 1, def.id)
          break
        case 'tower':
          assert(state.run.towerOffer.length > before.offer, def.id)
          break
      }
    }
  })

  check('ein gekaufter Bonus laeuft ueber dieselbe Leiste wie ein Ereignis', () => {
    // Zwei Systeme mit eigenen Boni haetten zwei Uhren und zwei Stellen, an denen einer
    // haengen bleiben kann.
    const state = ready()
    const trader = landed(state, 30)
    state.run.gold = 1e9
    trader.stock = [{ defId: 'trade.boonDamage', perkId: null, upgradeId: null, price: 1, sold: false }]

    buyFromTrader(state, 0)
    assertEqual(state.runtime.combat.eventBonus.damage, 0.4)

    stepEvents(state, 121)
    assertEqual(state.runtime.combat.eventBonus.damage, undefined)
  })

  check('eine Turmware ueberschreibt kein offenes Angebot', () => {
    const state = ready()
    const trader = landed(state, 45)
    state.run.gold = 1e9
    state.run.towerOffer = [{ defId: 'autocannon', rarity: 'common', traits: [] }]
    trader.stock = [{ defId: 'trade.tower', perkId: null, upgradeId: null, price: 1, sold: false }]

    const before = JSON.stringify(state.run.towerOffer)
    buyFromTrader(state, 0)
    assertEqual(JSON.stringify(state.run.towerOffer), before)
  })

  check('weggeschickt kommt sie nicht zurueck', () => {
    const state = ready()
    landed(state, 30)
    dismissTrader(state)
    assertEqual(state.run.trader, null)

    // Und der Termin steht bereits in der Zukunft - der naechste Takt holt sie nicht sofort.
    assert(state.run.nextTraderWave > 30, 'sonst landete gleich die naechste')
  })

  check('eine gelesene Drohne wird geprueft, nicht geglaubt', () => {
    const good = {
      x: 1,
      y: 2,
      left: 10,
      visited: false,
      stock: [{ defId: 'trade.upgrade1', perkId: null, price: 5, sold: false }],
    }
    assertEqual(isValidTrader(good), true)
    assertEqual(isValidTrader({ ...good, stock: [{ ...good.stock[0], defId: 'trade.weg' }] }), false)
    assertEqual(isValidTrader({ ...good, left: 'bald' }), false)
    assertEqual(isValidTrader({ ...good, visited: 1 }), false)
    assertEqual(isValidTrader(null), false)
  })
}
