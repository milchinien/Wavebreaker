/**
 * Beweis aus E18: die acht einmaligen Hinweise (GDD 14 Abschnitt 4a).
 *
 * Die harte Bedingung des ganzen Vorhabens lautet, dass ein Mensch ohne Zugriff auf das
 * Design-Dokument allein aus dem Bild heraus bis Welle 10 kommt. Der Zettel am Rand ist
 * dafuer das einzige Wort, das das Spiel von sich aus an den Spieler richtet - und damit
 * traegt seine **Reihenfolge** dieselbe Last wie sein Wortlaut.
 *
 * Deshalb prueft diese Sammlung nicht nur einzelne Bedingungen, sondern ein Drehbuch: Ein
 * Run wird Schritt fuer Schritt durchgespielt, in jedem Bild wird mitgeschrieben, was am
 * Rand steht, und das Protokoll muss drei Dinge aushalten:
 *
 *   (a) Der erste Satz des Spiels ist `hint.collect`.
 *   (b) Die Folge der Kennungen ist **monoton**: Keine kehrt zurueck, nachdem eine andere
 *       dran war. Kein Pendeln zwischen zwei zusammenhanglosen Saetzen.
 *   (c) Kein Hinweis faellt, bevor die Dinge, von denen er spricht, im Bild waren.
 *
 * Punkt (b) ist der Grund fuer das zweite Drehbuch weiter unten: Ein Spieler, der **nie**
 * auf "Got it" klickt, ist der schaerfste Fall. Bei ihm steht der Zeiger still, und jeder
 * Fehler in der Auswahl wird sofort zum Flackern.
 *
 * Ein Drehbuch beweist aber nur, dass **ein** Weg funktioniert. Die schwerere Frage ist,
 * ob die Reihe auf irgendeinem Weg **stecken** bleiben kann - sie ist eine Warteschlange,
 * und eine Warteschlange, die auf einen Augenblick wartet, der nie kommt, steht fuer immer.
 * Genau das war der Fall: Solange ein Verstaerker im Lager lag und nichts angedockt war,
 * kam der Buff-Zettel weder dran noch weg, und die vier Saetze dahinter kamen mit ihm nie.
 * Dagegen stehen die Sammlungen weiter unten:
 *
 *   - **nichts bleibt stecken** - jeder der acht Zettel hat eine Verfallsbedingung, und
 *     jede greift ohne Zutun des Spielers, allein durch vergehende Spielzeit.
 *   - **Zufallslaeufe** - hunderte zufaellig gewuerfelte Spielverlaeufe, in jedem einzelnen
 *     muessen alle acht Zettel fallen, in der Reihenfolge der Liste.
 *   - **der stehende Zettel** und **geladene Spielstaende** - ein angefangener Satz wird
 *     nicht ersetzt, und ein Spielstand mit Vergangenheit bekommt die Reihe nicht neu.
 *
 * Und weil die Blockade sich einmal **verschoben** hat statt zu verschwinden, steht die
 * Sammlung **die Lesefrist** daneben. Der stehende Zettel war die zweite Warteschlange: Er
 * wird nicht abgeloest, also haelt er die Reihe an, solange er steht - und "bis der Spieler
 * ihn weggeklickt hat" ist wieder eine Handlung, die mancher nie ausfuehrt. Wer nie klickt,
 * sah damit genau einen der acht Saetze, fuer immer.
 *
 * Der Fuzz konnte das nicht sehen, und das ist der zweite Teil der Lehre: Seine
 * Klickwahrscheinlichkeit fing bei 0,02 an, also klickte jeder simulierte Spieler
 * irgendwann. Ein Test, der den schlimmsten Fall ausschliesst, bestaetigt nur sich selbst.
 * Deshalb wuerfelt `fuzzRun` heute ausdruecklich auch die **0**, und eine eigene Pruefung
 * haelt fest, dass diese Sorte Spieler in der Stichprobe vorkommt.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { createRng, type Rng } from '../../core/rng.ts'
import {
  BOSS_WAVE_INTERVAL,
  HINT_READ_SECONDS,
  MELT_COST,
  PRESTIGE_MIN_GOLD,
  upgradeStepCost,
} from '../../data/balance.ts'
import { t } from '../../data/strings.ts'
import { towerById } from '../../data/towers.ts'
import { upgradeById } from '../../data/upgrades.ts'
import { deserialize, serialize } from '../../app/save.ts'
import { createInitialState, raiseWaveRecord, type GameState } from '../../app/state.ts'
import { invalidateStationView, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import {
  HINTS,
  hintDeadline,
  hintExpired,
  markHintSeen,
  pendingHint,
  readTimeUp,
  resetHints,
  settleHints,
} from '../../sim/hints.ts'
import { cumulativeXp } from '../../sim/progression.ts'
import { towerCost } from '../../sim/shop.ts'
import { freeEdges, newModule, place } from '../../sim/station.ts'

/** Ein frischer Zustand mit stehender Station - genau das, was ein Erststart hat. */
function ready(seed = 18): GameState {
  const state = createInitialState(seed)
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  return state
}

/** Ein Modul aus dem Lager andocken - der erste Turm an der Station. */
function dock(state: GameState, defId: string): void {
  const station = state.run.station
  const module = station.inventory.find((entry) => entry.defId === defId)
  const edge = freeEdges(station)[0]
  assert(module !== undefined, `${defId} muss im Lager liegen`)
  assert(edge !== undefined, 'die Station muss eine freie Kante haben')
  assertEqual(place(station, module.uid, edge), null, 'das Andocken muss gelingen')
  invalidateStationView(state)
}

/**
 * Ein Spielstand mit Vergangenheit: Welle 40, zwei Prestiges, Verstaerker an der Station.
 *
 * Jede einzelne Zahl hier ist eine **Spur**, an der sich ablesen laesst, dass dieser
 * Spieler die Anfangsstrecke hinter sich hat - gekaufte Tuerme, gekaufte Upgrades, Stufe,
 * Wellenmarke. Genau daraus liest `settleHints`, was es nicht mehr zu erklaeren gibt.
 */
function veteran(): GameState {
  const state = ready(7)
  const run = state.run

  dock(state, 'autocannon')
  dock(state, 'amplifier')
  run.station.inventory.length = 0
  run.wave = 40
  run.waveRecords = [40]
  run.gold = 500
  run.goldEarned = 5000
  run.towersBought = 12
  run.upgrades['f1.hammerfall'] = 6
  run.xp = cumulativeXp(20)
  state.permanent.prestigeCount = 2
  state.permanent.bestWaveEver = 44
  state.permanent.totalPlaySeconds = 4 * 3600
  return state
}

/** Platz eines Hinweises in der Reihe - Grundlage der Monotonie-Pruefung. */
function orderOf(id: string): number {
  return HINTS.findIndex((hint) => hint.id === id)
}

/**
 * Ein Schritt im Drehbuch.
 *
 * `expect` ist, was **waehrend** dieses Schritts am Rand stehen muss - `null` heisst: nichts.
 * `dismiss` heisst, dass der Spieler am Ende des Schritts auf "Got it" klickt.
 */
type Step = {
  name: string
  act(state: GameState): void
  expect: string | null
  dismiss: boolean
}

/**
 * Das Drehbuch der ersten Minuten, in der Reihenfolge aus GDD 14 Abschnitt 2.
 *
 * Jeder Schritt setzt genau das im Zustand, was der Spieler in diesem Augenblick getan oder
 * erreicht hat - nicht mehr. Die Hinweise muessen daraus von selbst folgen.
 */
const SCRIPT: readonly Step[] = [
  {
    name: '0:00 - Welle 1 laeuft an, der Kern schiesst von allein',
    act: () => {},
    // Noch ist nichts geschehen, worueber sich reden liesse. Der Verstaerker liegt zwar ab
    // Sekunde null im Lager, aber "module" und "edge" hat der Spieler noch nie gesehen.
    expect: null,
    dismiss: false,
  },
  {
    name: '0:20 - die erste Muenze liegt im Feld',
    act: (state) => {
      state.run.coins.push({ x: 40, y: 0, value: 3, count: 1 })
    },
    expect: 'hint.collect',
    dismiss: false,
  },
  {
    name: '0:24 - die Muenze ist eingesammelt, der Zettel steht noch',
    act: (state) => {
      state.run.coins.length = 0
      state.run.goldEarned += 3
    },
    // Der eigentliche Fehler, gegen den diese Sammlung geschrieben ist: Frueher fiel der
    // Zettel hier auf den Buff-Hinweis zurueck und beim naechsten Abschuss wieder auf
    // diesen - im Sekundentakt.
    expect: 'hint.collect',
    dismiss: true,
  },
  {
    name: '0:40 - das erste Kern-Upgrade ist bezahlbar',
    act: (state) => {
      const def = upgradeById('f1.hammerfall')
      state.run.goldEarned = upgradeStepCost(def, 1)
      state.run.gold = state.run.goldEarned
    },
    expect: 'hint.upgrade',
    dismiss: true,
  },
  {
    name: '1:30 - der erste Turmkauf ist bezahlbar',
    act: (state) => {
      state.run.goldEarned = towerCost(state)
      state.run.gold = state.run.goldEarned
    },
    expect: 'hint.buyTower',
    dismiss: true,
  },
  {
    name: '2:00 - der erste Turm ist angedockt, der Verstaerker liegt noch im Lager',
    act: (state) => {
      dock(state, 'autocannon')
    },
    expect: 'hint.buff',
    dismiss: true,
  },
  {
    name: '4:00 - Stufe 4 erreicht',
    act: (state) => {
      state.run.xp = cumulativeXp(4)
    },
    expect: 'hint.level',
    dismiss: true,
  },
  {
    name: 'Welle 10 - der Boss steht im Feld',
    act: (state) => {
      state.run.wave = BOSS_WAVE_INTERVAL
      state.run.waveRecords = [BOSS_WAVE_INTERVAL]
      state.runtime.combat.bossId = 1
    },
    expect: 'hint.boss',
    dismiss: true,
  },
  {
    name: 'nach dem Boss - drei ueberzaehlige Tuerme liegen im Lager',
    act: (state) => {
      const station = state.run.station
      state.runtime.combat.bossId = null
      state.run.waveRecords = [BOSS_WAVE_INTERVAL + 1]
      while (station.inventory.length < MELT_COST) {
        station.inventory.push(newModule(station, 'cannon', 'common'))
      }
    },
    expect: 'hint.melt',
    dismiss: true,
  },
  {
    name: 'spaeter - Prestige ist erstmals moeglich',
    act: (state) => {
      state.run.goldEarned = PRESTIGE_MIN_GOLD
    },
    expect: 'hint.prestige',
    dismiss: true,
  },
]

/** Wie viele Bilder je Schritt abgefragt werden. Mehr als eins, um Flackern zu sehen. */
const FRAMES_PER_STEP = 6

type LogEntry = { step: string; frame: number; id: string | null }

/**
 * Das Drehbuch abspielen und mitschreiben, was in jedem Bild am Rand steht.
 *
 * `clicks` schaltet den Spieler zu, der auf "Got it" klickt. Ohne ihn bleibt der Zeiger
 * stehen - der schaerfere Fall.
 */
function play(clicks: boolean): { state: GameState; log: LogEntry[] } {
  const state = ready()
  const log: LogEntry[] = []

  for (const step of SCRIPT) {
    step.act(state)
    for (let frame = 0; frame < FRAMES_PER_STEP; frame++) {
      log.push({ step: step.name, frame, id: pendingHint(state)?.id ?? null })
    }
    if (clicks && step.dismiss) {
      const hint = pendingHint(state)
      if (hint) markHintSeen(state, hint.id)
    }
  }
  return { state, log }
}

/** Die Folge der Kennungen, Wiederholungen zusammengefasst und `null` ausgelassen. */
function shownIds(log: readonly LogEntry[]): string[] {
  const ids: string[] = []
  for (const entry of log) {
    if (entry.id === null) continue
    if (ids[ids.length - 1] === entry.id) continue
    ids.push(entry.id)
  }
  return ids
}

// ---------------------------------------------------------------------------
// Zufallslaeufe
// ---------------------------------------------------------------------------

/**
 * Wie viele zufaellige Spielverlaeufe geprueft werden. Jeder einzelne muss alle acht
 * Zettel zeigen - nicht der Durchschnitt, nicht die Mehrheit.
 */
const FUZZ_RUNS = 600
/**
 * Bilder je Lauf. Reichlich: Auch der Spieler, der **nie** wegklickt, muss durch die ganze
 * Reihe kommen, und bei ihm braucht jeder der acht Zettel seine volle Lesefrist.
 */
const FUZZ_FRAMES = 2500
/**
 * Spielzeit je Bild.
 *
 * Das Produkt aus beiden Zahlen (1000 Sekunden) liegt **unter** der ersten Frist der Reihe
 * (20 Minuten). Damit ist dieser Test frei von der Notbremse: Was hier gezeigt wird, wird
 * gezeigt, weil sein Augenblick gekommen ist - nicht, weil ein Zettel davor abgelaufen ist.
 * Die **Lesefrist** dagegen darf und soll hier greifen; sie ist der Weg des Nicht-Klickers.
 */
const FUZZ_SECONDS_PER_FRAME = 0.4

/** Was ein zufaelliger Spieler kauft. Der Verstaerker steht schon im Startlager. */
const FUZZ_TOWERS = ['autocannon', 'cannon', 'sniper'] as const

/**
 * Ein Bild aus dem Leben eines zufaelligen Spielers.
 *
 * Bewusst **keine** Simulation des Gefechts: Geprueft wird die Reihe, und die liest nur
 * den Zustand. Was hier gewuerfelt wird, ist die Reihenfolge und der Zeitpunkt der
 * Handlungen - also genau das, was zwischen zwei Spielern verschieden ist.
 *
 * Einschmelzen fehlt mit Absicht: Es ist die einzige Handlung, die einem Zettel seinen
 * Gegenstand **nimmt**, und dieser Fall gehoert zu den Verfallstests weiter oben, wo er
 * einzeln nachweisbar ist.
 */
function fuzzFrame(state: GameState, rng: Rng): void {
  const run = state.run
  const station = run.station
  const roll = rng.next()

  if (roll < 0.3) {
    // Gold verdienen und einsammeln. Manchmal bleibt eine Muenze liegen.
    const value = rng.range(1, 8)
    run.gold += value
    run.goldEarned += value
    if (rng.chance(0.2)) run.coins.push({ x: rng.range(-200, 200), y: rng.range(-200, 200), value, count: 1 })
    else run.coins.length = 0
    return
  }
  if (roll < 0.45) {
    run.xp += rng.range(5, 60)
    return
  }
  if (roll < 0.55) {
    run.wave += 1
    raiseWaveRecord(state, run.wave)
    state.runtime.combat.bossId = run.wave % BOSS_WAVE_INTERVAL === 0 ? run.wave : null
    return
  }
  if (roll < 0.68) {
    const def = upgradeById('f1.hammerfall')
    const level = run.upgrades['f1.hammerfall'] ?? 0
    const cost = upgradeStepCost(def, level + 1)
    if (run.gold >= cost) {
      run.gold -= cost
      run.upgrades['f1.hammerfall'] = level + 1
    }
    return
  }
  if (roll < 0.82) {
    const cost = towerCost(state)
    if (run.gold >= cost) {
      run.gold -= cost
      run.towersBought += 1
      station.inventory.push(newModule(station, rng.pick(FUZZ_TOWERS), 'common'))
    }
    return
  }
  if (roll < 0.94) {
    // Andocken - welches Modul zuerst, entscheidet der Wuerfel. Auch der Verstaerker.
    if (station.inventory.length === 0 || station.placed.length >= station.slots) return
    const module = rng.pick(station.inventory)
    const edges = freeEdges(station)
    if (edges.length === 0) return
    place(station, module.uid, rng.pick(edges))
    invalidateStationView(state)
    return
  }
  // Sonst: zusehen. Ein Idle-Spiel besteht zum guten Teil daraus.
}

type FuzzRun = {
  seed: number
  /** Wie klickfreudig dieser Spieler war. `0` heisst: gar nicht. */
  dismiss: number
  /** Die Kennungen in der Reihenfolge, in der sie am Rand standen. */
  shown: string[]
  /** Der erste Verstoss gegen "ein stehender Zettel wird nicht ersetzt", oder `null`. */
  replaced: string | null
  /** Die kuerzeste Standzeit eines Zettels in diesem Lauf, in gespielten Sekunden. */
  shortestStand: number
  /** Gespielte Sekunden am Ende - zum Beleg, dass keine Frist der Reihe gegriffen hat. */
  seconds: number
}

/** Einen Spielverlauf wuerfeln und mitschreiben, was am Rand stand. */
function fuzzRun(seed: number): FuzzRun {
  const rng = createRng(seed)
  const state = ready(seed)
  /*
   * Wie schnell dieser Spieler wegklickt. Drei Sorten, und die dritte ist der Grund, warum
   * diese Zahl ueberhaupt gewuerfelt wird:
   *
   *   1.0        - der Dauerklicker aus der Messung von Runde 1.
   *   0.02..0.4  - der Zauderer, der einen Satz lange stehen laesst.
   *   0          - der Spieler, der **nie** klickt.
   *
   * Der dritte Fall fehlte in Runde 2, und das war der eigentliche Fehler dort: Eine
   * Untergrenze von 0,02 heisst, dass jeder simulierte Spieler irgendwann klickt - der Test
   * schloss damit genau den Fall aus, an dem die Loesung scheiterte, und bestaetigte nur
   * sich selbst. Bei einer Wahrscheinlichkeit von exakt 0 traegt allein die Lesefrist.
   */
  const dismiss = rng.chance(0.25) ? 0 : rng.chance(0.3) ? 1 : rng.range(0.02, 0.4)

  const shown: string[] = []
  let standing: string | null = null
  /** Seit wann der aktuelle Zettel steht - Grundlage beider Messungen unten. */
  let since = 0
  let replaced: string | null = null
  let shortestStand = Number.POSITIVE_INFINITY

  for (let frame = 0; frame < FUZZ_FRAMES; frame++) {
    fuzzFrame(state, rng)
    state.permanent.totalPlaySeconds += FUZZ_SECONDS_PER_FRAME
    const now = state.permanent.totalPlaySeconds

    const id = pendingHint(state)?.id ?? null
    if (standing !== null && id !== standing) {
      // Weggeklickt wurde er nicht (das setzt `standing` weiter unten selbst auf `null`),
      // also hat ihn die Lesefrist abgeraeumt. Zwei Dinge muessen dabei stimmen: Er darf
      // nicht **vor** der Frist gegangen sein, und die kuerzeste Standzeit des ganzen Laufs
      // ist die Zahl, an der sich "man konnte ihn lesen" messen laesst.
      const stood = now - since
      shortestStand = Math.min(shortestStand, stood)
      if (replaced === null && stood <= HINT_READ_SECONDS) {
        replaced = `Bild ${frame}: ${standing} stand nur ${stood.toFixed(1)}s und wurde durch ${id} ersetzt`
      }
    }
    if (id !== null && shown[shown.length - 1] !== id) shown.push(id)
    if (id !== standing) {
      standing = id
      since = now
    }

    if (id !== null && rng.chance(dismiss)) {
      markHintSeen(state, id)
      standing = null
    }
    if (state.permanent.seenHints.length === HINTS.length) break
  }

  return { seed, dismiss, shown, replaced, shortestStand, seconds: state.permanent.totalPlaySeconds }
}

/** Die Laeufe einmal wuerfeln und fuer alle drei Pruefungen aufheben. */
let runsCache: FuzzRun[] | null = null
function fuzzRuns(): FuzzRun[] {
  if (!runsCache) {
    runsCache = []
    for (let seed = 1; seed <= FUZZ_RUNS; seed++) runsCache.push(fuzzRun(seed))
  }
  return runsCache
}

export function hintsSuite(): void {
  suite('sim/hints · die Reihe')

  check('jeder Hinweis hat eine eindeutige Kennung', () => {
    const ids = new Set(HINTS.map((hint) => hint.id))
    assertEqual(ids.size, HINTS.length)
  })

  check('beim allerersten Start steht nichts am Rand', () => {
    // Der Verstaerker liegt im Startlager, drei Module auch - beides darf nicht reichen.
    const state = ready()
    assertEqual(state.run.station.inventory.length, MELT_COST, 'Startlager hat genau drei')
    assert(
      state.run.station.inventory.some((m) => towerById(m.defId).category === 'buff'),
      'und darunter einen Verstaerker',
    )
    assertEqual(pendingHint(state), null, 'trotzdem faellt noch kein Hinweis')
  })

  check('der erste Satz des Spiels ist der Muenz-Hinweis', () => {
    const { log } = play(true)
    const ids = shownIds(log)
    assert(ids.length > 0, 'irgendetwas muss gefallen sein')
    assertEqual(ids[0], 'hint.collect')
  })

  check('das Drehbuch zeigt in jedem Schritt genau den erwarteten Hinweis', () => {
    const state = ready()
    for (const step of SCRIPT) {
      step.act(state)
      for (let frame = 0; frame < FRAMES_PER_STEP; frame++) {
        const id = pendingHint(state)?.id ?? null
        assertEqual(id, step.expect, `${step.name} (Bild ${frame + 1})`)
      }
      if (step.dismiss) {
        const hint = pendingHint(state)
        assert(hint !== null, `${step.name}: es muss etwas zum Wegklicken geben`)
        assertEqual(markHintSeen(state, hint.id), true)
      }
    }
  })

  check('die Folge der Hinweise ist monoton - keiner kehrt zurueck', () => {
    const { log } = play(true)
    const ids = shownIds(log)
    const seen = new Set<string>()
    let last = -1

    for (const id of ids) {
      assert(!seen.has(id), `${id} kam zurueck, nachdem ein anderer dran war: ${ids.join(' -> ')}`)
      const index = orderOf(id)
      assert(index > last, `${id} steht vor seinem Vorgaenger: ${ids.join(' -> ')}`)
      seen.add(id)
      last = index
    }
  })

  check('das Drehbuch bringt alle acht Hinweise, in der Reihenfolge der Liste', () => {
    const { log } = play(true)
    assertEqual(shownIds(log).join(','), HINTS.map((hint) => hint.id).join(','))
  })

  check('wer nie wegklickt, sieht nur einen einzigen Satz', () => {
    // Der schaerfste Fall: Der Zeiger steht, und trotzdem darf nichts pendeln - auch nicht,
    // wenn im Drehbuch spaeter Bedingungen zutreffen, die weiter hinten in der Liste stehen.
    const { log } = play(false)
    const ids = shownIds(log)
    assertEqual(ids.join(','), 'hint.collect')
  })

  check('ein Hinweis verschwindet nicht unter der Hand des Lesers', () => {
    // Jede Bedingung beschreibt Geschehenes: Ist ein Zettel einmal faellig, bleibt er es,
    // bis er weggeklickt wurde. Sonst muesste man ihn zweimal anfangen zu lesen.
    const state = ready()
    let current: string | null = null

    for (const step of SCRIPT) {
      step.act(state)
      const id = pendingHint(state)?.id ?? null
      if (current !== null) {
        assertEqual(id, current, `${step.name}: der stehende Zettel darf nicht verschwinden`)
      }
      current = id
    }
  })

  suite('sim/hints · Merkzettel und Ausnahmen')

  check('ein gesehener Hinweis kommt nicht wieder', () => {
    const state = ready()
    state.run.coins.push({ x: 0, y: 0, value: 1, count: 1 })

    const first = pendingHint(state)
    assert(first !== null, 'liegendes Gold muss einen Hinweis ausloesen')
    assertEqual(first.id, 'hint.collect')

    assertEqual(markHintSeen(state, first.id), true)
    assertEqual(
      markHintSeen(state, first.id),
      false,
      'zweimal ablegen ist kein Fehler, aber wirkungslos',
    )
    assert(pendingHint(state)?.id !== 'hint.collect', 'er darf nicht wiederkommen')
  })

  check('ein unbekannter Hinweis laesst sich nicht ablegen', () => {
    const state = ready()
    assertEqual(markHintSeen(state, 'hint.gibtesnicht'), false)
    assertEqual(state.permanent.seenHints.length, 0)
  })

  check('ein Hinweis ohne Gegenstand blockiert die Reihe nicht', () => {
    // Wer seinen Verstaerker einschmilzt, bekommt nie etwas ueber Verstaerker zu lesen -
    // aber alles danach muss trotzdem kommen.
    const state = ready()
    state.permanent.seenHints.push('hint.collect', 'hint.upgrade', 'hint.buyTower')
    state.run.station.inventory.length = 0
    state.run.xp = cumulativeXp(4)

    assertEqual(pendingHint(state)?.id, 'hint.level')
    assert(
      state.permanent.seenHints.includes('hint.buff'),
      'der uebersprungene Zettel muss abgelegt sein, sonst kaeme er zurueck',
    )
  })

  check('ein Verstaerker loest den Hinweis aus - auch ein schon angedockter', () => {
    // Der Satz erklaert den **Zeitpunkt** ("place them early"). Wer den Verstaerker
    // zufaellig als erstes angedockt hat, weiss deswegen noch nicht, warum das gut war -
    // und frueher fiel der Zettel bei ihm stumm unter den Tisch, weil "im Lager" die
    // Bedingung war.
    const state = ready()
    const hint = HINTS.find((entry) => entry.id === 'hint.buff')
    assert(hint !== undefined, 'den Hinweis muss es geben')

    dock(state, 'autocannon')
    assertEqual(hint.when(state), true, 'die Station steht, der Verstaerker liegt im Lager')

    dock(state, 'amplifier')
    assertEqual(hint.when(state), true, 'angedockt - der Zeitpunkt bleibt erklaerungswuerdig')
  })

  check('ohne Verstaerker gibt es nichts zu sagen, und die Reihe laeuft weiter', () => {
    const state = ready()
    const hint = HINTS.find((entry) => entry.id === 'hint.buff')
    assert(hint !== undefined, 'den Hinweis muss es geben')

    dock(state, 'autocannon')
    // Eingeschmolzen: Der Gegenstand des Satzes existiert nicht mehr.
    state.run.station.inventory = state.run.station.inventory.filter(
      (module) => towerById(module.defId).category !== 'buff',
    )
    assertEqual(hint.when(state), false, 'es gibt keinen Verstaerker mehr')
    assertEqual(hint.gone?.(state), true, 'und die Reihe darf weiter')
  })

  check('der Hinweis zum Buff-Turm nennt den Zeitpunkt', () => {
    // GDD 14 Abschnitt 4a nennt den Zeitpunkt des Buff-Turms das groesste
    // Verstaendnisrisiko des Spiels - der Text muss ihn deshalb ausdruecklich ansprechen
    // und nicht nur die Wirkung beschreiben.
    const text = t('hint.buff').toLowerCase()
    assert(text.includes('early'), `der Zeitpunkt fehlt im Text: ${t('hint.buff')}`)
  })

  check('Zuruecksetzen zeigt alle Hinweise wieder', () => {
    const state = ready()
    for (const hint of HINTS) state.permanent.seenHints.push(hint.id)
    assertEqual(pendingHint(state), null)

    resetHints(state)
    assertEqual(state.permanent.seenHints.length, 0)

    state.run.coins.push({ x: 0, y: 0, value: 1, count: 1 })
    assertEqual(pendingHint(state)?.id, 'hint.collect', 'die Reihe beginnt von vorn')
  })

  // -------------------------------------------------------------------------
  suite('sim/hints · nichts bleibt stecken')
  // -------------------------------------------------------------------------

  check('jeder Hinweis hat eine Verfallsbedingung, die von selbst greift', () => {
    // Der Kern der ganzen Sammlung: Keine Verfallsbedingung darf allein an einer Handlung
    // haengen. Wer sie nie ausfuehrt, liesse die Reihe sonst fuer immer stehen - beim
    // Verstaerker im Lager war genau das der Fall. Gespielte Zeit vergeht dagegen in jedem
    // Spielverlauf, ohne dass der Spieler irgendetwas tun muesste.
    for (const [index, hint] of HINTS.entries()) {
      const deadline = hintDeadline(index)
      assert(Number.isFinite(deadline) && deadline > 0, `${hint.id} hat keine endliche Frist`)

      const state = ready()
      assertEqual(hint.gone?.(state) === true, false, `${hint.id}: beim Erststart ist nichts vorbei`)
      assertEqual(hintExpired(state, index), false, `${hint.id} verfaellt schon beim Start`)

      state.permanent.totalPlaySeconds = deadline + 1
      assertEqual(hintExpired(state, index), true, `${hint.id} verfaellt nie von selbst`)
    }
  })

  check('vor ihrer Frist verfaellt keine', () => {
    // Die Gegenprobe: Die Notbremse darf nicht frueh greifen, sonst verlaere sie Saetze,
    // deren Augenblick noch kommt.
    const state = ready()
    for (const [index, hint] of HINTS.entries()) {
      state.permanent.totalPlaySeconds = hintDeadline(index)
      assertEqual(hintExpired(state, index), false, `${hint.id} verfaellt eine Sekunde zu frueh`)
    }
  })

  check('die Fristen liegen hintereinander, nicht uebereinander', () => {
    // Weil die Reihe eine Warteschlange ist, kann der n-te Zettel erst drankommen, wenn die
    // n davor erledigt sind. Also braucht er sein Fenster **nach** ihnen.
    for (let index = 1; index < HINTS.length; index++) {
      assert(
        hintDeadline(index) > hintDeadline(index - 1),
        `die Frist von ${HINTS[index]?.id} liegt nicht hinter der ihres Vorgaengers`,
      )
    }
  })

  check('ein Augenblick, der nie kommt, haelt die Reihe nicht auf', () => {
    // Fuer jeden Platz in der Reihe: Der Spieler kommt bis hierher und tut dann nie mehr
    // das, worauf dieser Zettel wartet. Die Reihe muss trotzdem weiterlaufen.
    for (const [index, hint] of HINTS.entries()) {
      const state = ready()
      for (const earlier of HINTS.slice(0, index)) state.permanent.seenHints.push(earlier.id)

      assertEqual(pendingHint(state), null, `${hint.id}: die Reihe wartet - das ist richtig`)
      assert(
        !state.permanent.seenHints.includes(hint.id),
        `${hint.id} wurde abgelegt, bevor seine Frist ueberhaupt lief`,
      )

      state.permanent.totalPlaySeconds = hintDeadline(index) + 1
      assertEqual(pendingHint(state), null, `${hint.id}: danach kommt hier nichts mehr`)
      assert(state.permanent.seenHints.includes(hint.id), `${hint.id} blockiert die Reihe`)
      assertEqual(
        state.permanent.seenHints.length,
        index + 1,
        `${hint.id}: es wurde mehr abgeraeumt als abgelaufen war`,
      )
    }
  })

  check('der Verstaerker im Lager blockiert die Reihe nicht mehr', () => {
    // Der gemessene Fall aus der Pruefung von Runde 1, Zeile fuer Zeile: `when` ist falsch,
    // weil nichts angedockt ist, und `gone` war falsch, weil der Verstaerker noch im Lager
    // liegt. Frueher stand die Reihe hier fuer immer - und mit ihr die vier Saetze dahinter.
    const state = ready()
    const buff = HINTS[3]
    assert(buff !== undefined && buff.id === 'hint.buff', 'der Buff-Zettel steht an vierter Stelle')
    state.permanent.seenHints.push('hint.collect', 'hint.upgrade', 'hint.buyTower')

    assertEqual(buff.when(state), false, 'nichts angedockt')
    assertEqual(buff.gone?.(state), false, 'der Verstaerker liegt noch im Lager')
    assertEqual(pendingHint(state), null, 'die Reihe wartet auf ihn')

    state.permanent.totalPlaySeconds = hintDeadline(3) + 1
    state.run.xp = cumulativeXp(4)
    assertEqual(pendingHint(state)?.id, 'hint.level', 'nach der Frist geht es weiter')
    assert(state.permanent.seenHints.includes('hint.buff'), 'und er ist abgelegt')
  })

  check('ohne jede Handlung ist die Reihe nach acht Fenstern durch', () => {
    // Der Spieler, der nichts tut - das schaerfste Gegenbeispiel. Die Zusage ist eine Zahl:
    // Nach `HINTS.length` Fenstern gespielter Zeit ist die Reihe in **jedem** Verlauf
    // abgearbeitet.
    const state = ready()
    state.permanent.totalPlaySeconds = hintDeadline(HINTS.length - 1) + 1

    assertEqual(pendingHint(state), null)
    assertEqual(state.permanent.seenHints.length, HINTS.length, 'alle acht sind erledigt')
  })

  // -------------------------------------------------------------------------
  suite('sim/hints · Zufallslaeufe')
  // -------------------------------------------------------------------------

  check('die Zufallslaeufe enthalten Spieler, die nie auf "Got it" klicken', () => {
    // Der Test des Tests. Ein Fuzz, dessen Klickwahrscheinlichkeit bei 0,02 anfaengt, laesst
    // jeden simulierten Spieler irgendwann klicken und schliesst damit den einen Fall aus,
    // um den es geht. Diese Pruefung haelt die Untergrenze bei **exakt 0** fest - faellt sie
    // heraus, faellt es hier auf, und nicht erst beim Spieler.
    const never = fuzzRuns().filter((run) => run.dismiss === 0)
    assert(never.length > 0, 'kein einziger Lauf mit Klickwahrscheinlichkeit 0')
    assert(
      never.length >= FUZZ_RUNS / 10,
      `nur ${never.length} von ${FUZZ_RUNS} Laeufen klicken nie - zu wenig, um etwas zu beweisen`,
    )
  })

  check(`${FUZZ_RUNS} zufaellige Spielverlaeufe zeigen jeder alle acht Hinweise`, () => {
    // Die Messlatte aus der Pruefung: Nicht der Durchschnitt zaehlt, sondern der
    // schlechteste Lauf. Gewuerfelt werden Reihenfolge und Zeitpunkt der Handlungen und
    // wie schnell der Spieler wegklickt - alles, was zwischen zwei Spielern verschieden ist.
    const expected = HINTS.map((hint) => hint.id).join(',')
    for (const run of fuzzRuns()) {
      assertEqual(run.shown.join(','), expected, `Lauf ${run.seed} (Klickrate ${run.dismiss})`)
    }
  })

  check('auch die Laeufe ohne einen einzigen Klick zeigen alle acht', () => {
    // Dieselbe Latte, nur fuer die schaerfste Teilmenge - ausdruecklich, damit sie nicht in
    // der Menge untergeht, falls die Pruefung darueber je aufgeweicht wird.
    const expected = HINTS.map((hint) => hint.id).join(',')
    for (const run of fuzzRuns()) {
      if (run.dismiss !== 0) continue
      assertEqual(run.shown.join(','), expected, `Lauf ${run.seed} klickt nie`)
      assertEqual(run.replaced, null, `Lauf ${run.seed}: zu frueh abgeraeumt`)
    }
  })

  check('in keinem Lauf wird ein stehender Zettel vor seiner Lesefrist ersetzt', () => {
    for (const run of fuzzRuns()) {
      assertEqual(run.replaced, null, `Lauf ${run.seed}`)
    }
  })

  check('in keinem Lauf stand ein Zettel kuerzer, als das Lesen dauert', () => {
    // Die Gegenprobe zur Lesefrist: Sie darf die Reihe antreiben, aber niemandem den Satz
    // unter der Hand wegnehmen.
    for (const run of fuzzRuns()) {
      assert(
        run.shortestStand > HINT_READ_SECONDS,
        `Lauf ${run.seed}: kuerzeste Standzeit ${run.shortestStand}s`,
      )
    }
  })

  check('kein Lauf braucht die Frist der Reihe - die Augenblicke allein tragen sie', () => {
    // Die 20-Minuten-Frist ist die Notbremse, nicht der Weg. Bliebe ein Lauf unter der Latte
    // und wuerde nur durch Verfall fertig, waere dieser Test eine Selbsttaeuschung. Die
    // **Lesefrist** ist davon unberuehrt: Sie ist bei einem Spieler, der nie klickt, der
    // vorgesehene Weg und nicht die Notbremse.
    for (const run of fuzzRuns()) {
      assert(
        run.seconds < hintDeadline(0),
        `Lauf ${run.seed} lief ${run.seconds}s und damit in die erste Frist`,
      )
    }
  })

  // -------------------------------------------------------------------------
  suite('sim/hints · der stehende Zettel')
  // -------------------------------------------------------------------------

  check('ein stehender Zettel wird nicht vom naechsten abgeloest', () => {
    const state = ready()
    // Die Uhr steht **vor** dem Zettel auf ihrem Endwert und ruehrt sich danach nicht mehr:
    // Geprueft wird hier die Verdraengung durch spaetere Zettel, nicht die Lesefrist. Die
    // hat ihre eigene Sammlung weiter unten.
    state.permanent.totalPlaySeconds = hintDeadline(HINTS.length - 1) + 1
    state.run.coins.push({ x: 40, y: 0, value: 3, count: 1 })
    assertEqual(pendingHint(state)?.id, 'hint.collect')

    // Auf einen Schlag trifft alles zu, was danach kaeme - der Spieler liest aber noch.
    state.run.goldEarned = PRESTIGE_MIN_GOLD
    state.run.gold = PRESTIGE_MIN_GOLD
    state.run.xp = cumulativeXp(9)
    state.run.wave = 3 * BOSS_WAVE_INTERVAL
    state.run.waveRecords = [3 * BOSS_WAVE_INTERVAL]
    state.run.towersBought = 5
    state.run.upgrades['f1.hammerfall'] = 4
    dock(state, 'autocannon')

    const collect = HINTS[0]
    assert(collect !== undefined, 'den ersten Zettel muss es geben')
    assertEqual(collect.gone?.(state), true, 'sein Augenblick ist streng genommen vorbei')

    for (let frame = 0; frame < 20; frame++) {
      assertEqual(pendingHint(state)?.id, 'hint.collect', `Bild ${frame + 1}`)
    }

    assertEqual(markHintSeen(state, 'hint.collect'), true)
    assertEqual(pendingHint(state)?.id, 'hint.upgrade', 'erst danach kommt der naechste')
  })

  check('auch wenn sein Gegenstand verschwindet, bleibt er stehen', () => {
    // Der Fall, der ohne diese Regel am unangenehmsten waere: Der Spieler docht waehrend
    // des Lesens den Verstaerker an oder schmilzt ihn ein - und der Satz, der ihm gerade
    // erklaeren wollte, warum das wichtig ist, ist mitten im Wort weg.
    const state = ready()
    state.permanent.seenHints.push('hint.collect', 'hint.upgrade', 'hint.buyTower')
    dock(state, 'autocannon')
    assertEqual(pendingHint(state)?.id, 'hint.buff')

    state.run.station.inventory = state.run.station.inventory.filter(
      (module) => towerById(module.defId).category !== 'buff',
    )
    const buff = HINTS[3]
    assert(buff !== undefined, 'den Buff-Zettel muss es geben')
    assertEqual(buff.gone?.(state), true, 'der Gegenstand des Satzes ist weg')

    for (let frame = 0; frame < 10; frame++) {
      assertEqual(pendingHint(state)?.id, 'hint.buff', `Bild ${frame + 1}`)
    }
    assertEqual(markHintSeen(state, 'hint.buff'), true, 'gelesen wird er trotzdem')
  })

  // -------------------------------------------------------------------------
  suite('sim/hints · die Lesefrist')
  // -------------------------------------------------------------------------

  check('die Lesefrist reicht fuer den laengsten der acht Texte', () => {
    /*
     * Die Mindeststandzeit ist eine Zahl mit Herkunft, und die Herkunft ist die Textlaenge.
     * Der laengste Zettel bestimmt sie; wird er je laenger geschrieben, faellt dieser Test.
     *
     * Drei Posten, alle am laengsten Text gemessen:
     *   Anschlag - der Zettel schreibt sich Buchstabe fuer Buchstabe (`ui/typewriter.ts`,
     *              68 ms Grundtakt, im Mittel das 1,05-Fache davon). Vorher steht der Satz
     *              nicht einmal ganz da.
     *   Lesen    - bei 100 Woertern je Minute. Die Haelfte des ueblichen Lesetempos, weil
     *              nebenher das Feld laeuft.
     *   Bemerken - der Zettel kommt ungefragt und faellt mitten in eine Handlung; bis der
     *              Blick vom Feld an den Rand wandert, vergeht Zeit.
     */
    const TYPE_SECONDS_PER_CHAR = 0.068 * 1.05
    const READING_WORDS_PER_SECOND = 100 / 60
    const NOTICE_SECONDS = 15

    let longest = ''
    for (const hint of HINTS) {
      const text = t(hint.key)
      if (text.length > longest.length) longest = text
    }
    assert(longest.length > 0, 'die Texte muessen da sein')

    const words = longest.split(/\s+/).filter((word) => /[a-z]/i.test(word)).length
    const typed = longest.length * TYPE_SECONDS_PER_CHAR
    const read = words / READING_WORDS_PER_SECOND
    const needed = typed + read + NOTICE_SECONDS

    assert(
      HINT_READ_SECONDS >= needed,
      `${longest.length} Zeichen, ${words} Woerter: ${typed.toFixed(1)}s Anschlag + ` +
        `${read.toFixed(1)}s Lesen + ${NOTICE_SECONDS}s Bemerken = ${needed.toFixed(1)}s, ` +
        `die Lesefrist gibt nur ${HINT_READ_SECONDS}s`,
    )
  })

  check('vor ihrem Ablauf nimmt die Lesefrist keinem den Satz weg', () => {
    // Sekunde fuer Sekunde: Solange die Frist laeuft, steht der Zettel - und zwar auch dann,
    // wenn alles, was danach kaeme, laengst zutrifft.
    const state = ready()
    state.run.coins.push({ x: 40, y: 0, value: 3, count: 1 })
    assertEqual(pendingHint(state)?.id, 'hint.collect')

    state.run.goldEarned = PRESTIGE_MIN_GOLD
    state.run.gold = PRESTIGE_MIN_GOLD
    state.run.towersBought = 5
    dock(state, 'autocannon')

    for (let second = 0; second <= HINT_READ_SECONDS; second++) {
      state.permanent.totalPlaySeconds = second
      assertEqual(readTimeUp(state), false, `Sekunde ${second}: die Frist laeuft noch`)
      assertEqual(pendingHint(state)?.id, 'hint.collect', `Sekunde ${second}`)
    }

    state.permanent.totalPlaySeconds = HINT_READ_SECONDS + 1
    assertEqual(readTimeUp(state), true, 'eine Sekunde spaeter ist sie um')
    assertEqual(pendingHint(state)?.id, 'hint.upgrade', 'und die Reihe geht weiter')
  })

  check('ein abgelaufener Zettel wird stumm abgelegt und kommt nicht wieder', () => {
    // Stumm: kein `hint.seen`-Ereignis, denn gelesen hat ihn niemand. Abgelegt: sonst kaeme
    // er beim naechsten Bild zurueck, weil seine Bedingung ja weiter zutrifft - und die
    // Reihenfolge waere nicht mehr monoton.
    const state = ready()
    state.run.coins.push({ x: 40, y: 0, value: 3, count: 1 })
    assertEqual(pendingHint(state)?.id, 'hint.collect')

    state.permanent.totalPlaySeconds = HINT_READ_SECONDS + 1
    pendingHint(state)
    assert(state.permanent.seenHints.includes('hint.collect'), 'er muss abgelegt sein')
    assertEqual(state.runtime.hintId, null, 'der Platz am Rand ist frei')

    for (let frame = 0; frame < 10; frame++) {
      assert(pendingHint(state)?.id !== 'hint.collect', `Bild ${frame + 1}: er ist zurueck`)
    }
  })

  check('wer NIE auf "Got it" klickt, sieht trotzdem alle acht Saetze', () => {
    /*
     * Die Messlatte dieses Stuecks, als einzelner Beweis.
     *
     * Gespielt wird dasselbe Drehbuch wie oben - nur klickt dieser Spieler kein einziges Mal.
     * Statt seiner treibt die Uhr die Reihe: je Schritt zwei Lesefristen, damit der Nachweis
     * an der Frist haengt und nicht daran, wie lang ein Schritt zufaellig ist.
     *
     * Die Gesamtzeit bleibt dabei unter der ersten Frist der Reihe (20 Minuten). Das ist der
     * Kern: Was hier zu sehen ist, zeigt die **Lesefrist**, nicht die Notbremse - haette man
     * nur die Notbremse, saehe der Spieler den ersten Satz bis zum Ende dieses Tests.
     */
    const state = ready()
    const shown: string[] = []
    const secondsPerStep = 2 * HINT_READ_SECONDS

    for (const step of SCRIPT) {
      step.act(state)
      for (let second = 0; second < secondsPerStep; second++) {
        const id = pendingHint(state)?.id ?? null
        if (id !== null && shown[shown.length - 1] !== id) shown.push(id)
        state.permanent.totalPlaySeconds += 1
      }
    }

    assertEqual(
      shown.join(','),
      HINTS.map((hint) => hint.id).join(','),
      'alle acht, in der Reihenfolge der Liste',
    )
    assertEqual(state.permanent.seenHints.length, HINTS.length, 'und alle acht sind erledigt')
    assert(
      state.permanent.totalPlaySeconds < hintDeadline(0),
      `der Lauf brauchte ${state.permanent.totalPlaySeconds}s und damit die Notbremse`,
    )
  })

  check('ohne einen einzigen Klick pendelt trotzdem nichts', () => {
    // Die Kehrseite: Eine Frist, die zu frueh greift, macht aus der Reihe ein Flackern.
    // Jede Kennung darf genau einmal am Rand stehen, und jede muss ihre Frist voll bekommen.
    const state = ready()
    const stands: { id: string; seconds: number }[] = []

    for (const step of SCRIPT) {
      step.act(state)
      for (let second = 0; second < 2 * HINT_READ_SECONDS; second++) {
        const id = pendingHint(state)?.id ?? null
        const last = stands[stands.length - 1]
        if (id !== null) {
          if (last && last.id === id) last.seconds += 1
          else stands.push({ id, seconds: 1 })
        }
        state.permanent.totalPlaySeconds += 1
      }
    }

    const ids = stands.map((entry) => entry.id)
    assertEqual(new Set(ids).size, ids.length, `eine Kennung stand zweimal: ${ids.join(' -> ')}`)
    for (const entry of stands) {
      assert(
        entry.seconds > HINT_READ_SECONDS,
        `${entry.id} stand nur ${entry.seconds}s statt ${HINT_READ_SECONDS}s`,
      )
    }
  })

  // -------------------------------------------------------------------------
  suite('sim/hints · geladene Spielstaende')
  // -------------------------------------------------------------------------

  check('ein alter Spielstand loest die Reihe nicht neu aus', () => {
    // Ein Spielstand aus einer Fassung ohne Merkzettel: Welle 40, zwei Prestiges, volle
    // Station - und `seenHints` leer. Ohne Abgleich bekaeme dieser Spieler "Fahre mit der
    // Maus ueber Muenzen" zu lesen.
    const state = veteran()
    state.permanent.seenHints.length = 0

    const restored = deserialize(serialize(state, 0))
    assert(restored !== null, 'der Spielstand muss lesbar sein')
    assertEqual(
      pendingHint(restored)?.id,
      'hint.collect',
      'ohne Abgleich faengt die Reihe von vorn an - genau das ist der Fehler',
    )

    const loaded = deserialize(serialize(state, 0))
    assert(loaded !== null, 'der Spielstand muss lesbar sein')
    settleHints(loaded)
    assertEqual(loaded.permanent.seenHints.length, HINTS.length, 'alles gilt als gelernt')
    for (let frame = 0; frame < 10; frame++) {
      assertEqual(pendingHint(loaded), null, `Bild ${frame + 1}: der Rand bleibt leer`)
    }
  })

  check('was ein Spielstand hinter sich hat, steht in seinen Spuren', () => {
    // Die Gegenprobe zum Test darueber: Dort haette auch die blosse Uhr genuegt. Hier steht
    // sie auf null, und trotzdem muss sich an den Spuren ablesen lassen, was dieser Spieler
    // hinter sich hat - gekaufte Tuerme, gekaufte Upgrades, Stufe, Wellenmarke, Prestige.
    //
    // Ausser bei einem: Das Einschmelzen hinterlaesst keine Spur im Spielstand, und eine
    // geratene waere schlimmer als keine (siehe `sim/hints.ts`). Diese eine Ausnahme steht
    // hier ausdruecklich, damit sie nicht stillschweigend auf andere uebergreift.
    const state = veteran()
    state.permanent.totalPlaySeconds = 0

    for (const hint of HINTS) {
      const expected = hint.id !== 'hint.melt'
      assertEqual(hint.gone?.(state) === true, expected, `${hint.id}: Spur im Spielstand`)
    }
  })

  check('ein Spielstand mitten in der Reihe behaelt, was ihm noch bevorsteht', () => {
    // Der Abgleich ist kein Kahlschlag: Er hoert am ersten Zettel auf, dessen Augenblick
    // noch aussteht. Dieser Spieler hat gekauft, aufgeruestet und angedockt - vom
    // Verstaerker weiss er noch nichts.
    const state = ready()
    state.run.goldEarned = 60
    state.run.gold = 20
    state.run.towersBought = 1
    state.run.upgrades['f1.hammerfall'] = 1
    state.run.wave = 3
    state.run.waveRecords = [3]
    dock(state, 'autocannon')

    const loaded = deserialize(serialize(state, 0))
    assert(loaded !== null, 'der Spielstand muss lesbar sein')
    settleHints(loaded)

    assertEqual(
      loaded.permanent.seenHints.join(','),
      'hint.collect,hint.upgrade,hint.buyTower',
      'nur die drei erledigten',
    )
    assertEqual(pendingHint(loaded)?.id, 'hint.buff', 'der naechste steht ihm noch bevor')
  })

  check('ein Anfaenger-Spielstand behaelt seine ganze Reihe', () => {
    // Die wichtigste Gegenprobe: Wer nach zwei Minuten den Tab schliesst und wiederkommt,
    // darf nicht ohne ein einziges Wort dastehen.
    const state = ready()
    state.run.goldEarned = 2
    state.run.gold = 2

    const loaded = deserialize(serialize(state, 0))
    assert(loaded !== null, 'der Spielstand muss lesbar sein')
    settleHints(loaded)

    assertEqual(loaded.permanent.seenHints.length, 0, 'nichts wurde abgeraeumt')
    assertEqual(pendingHint(loaded)?.id, 'hint.collect', 'die Reihe beginnt wie beim ersten Mal')
  })
}
