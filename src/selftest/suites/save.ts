/**
 * Beweis aus E0: Speicher-Rundlauf ist verlustfrei, kaputte Spielstaende liefern `null`
 * statt eines Absturzes.
 *
 * Zusaetzlich steht hier bereits die Absicherung fuer E13: eine feste Liste aller
 * Zustandsfelder je Bereich. Wer ein Feld hinzufuegt, muss sich hier bewusst
 * entscheiden, ob es Prestige ueberlebt - genau das ist laut Plan die fehleranfaelligste
 * Stelle des ganzen Spiels.
 */

import { assert, assertClose, assertDeepEqual, assertEqual, check, suite } from '../../core/assert.ts'
import { createLoop, createManualScheduler } from '../../core/loop.ts'
import { on, resetEvents } from '../../core/events.ts'
import {
  AUTOSAVE_INTERVAL_SECONDS,
  GOLD_SCALE,
  START_CORE_ID,
  START_TOWER_SLOTS,
} from '../../data/balance.ts'
import {
  clearSave,
  deserialize,
  lastSavedAt,
  load,
  migrationChainComplete,
  save,
  serialize,
  setStorage,
  startAutosave,
  STORAGE_KEY,
  SAVE_VERSION,
  type SaveStorage,
} from '../../app/save.ts'
import { createInitialPermanent, createInitialRun, createInitialState } from '../../app/state.ts'
import { EPS } from '../../core/geometry.ts'
import { dist, type Vec2 } from '../../core/vec.ts'
import {
  freeEdges,
  isConnected,
  place,
  stationModules,
  type FreeEdge,
} from '../../sim/station.ts'

const PERMANENT_FIELDS = [
  'bestWaveEver',
  // Die hoechste freigeschaltete Liga gehoert zu `permanent` und nicht zum Run: Muesste man
  // die Ligen nach jedem Prestige neu erklettern, waere die Liga eine zweite
  // Prestige-Schleife und verdraengte die erste (docs/liga-system.md Abschnitt 4.4).
  'leagueUnlocked',
  'prestigeCount',
  'prestigeNodes',
  'prestigePoints',
  'seenHints',
  'totalPlaySeconds',
  'unlockedCores',
  'unlockedTowers',
]

const RUN_FIELDS = [
  // Freigeschaltete Faehigkeiten gehoeren zum Run: Sie werden mit Gold gekauft, und Gold
  // setzt beim Prestige zurueck (GDD 09 Abschnitt 7). Dauerhafte Freischaltungen laufen
  // ueber den Prestige-Baum und liegen deshalb in `permanent`.
  'abilities',
  'abilitySlots',
  // Der Auto-Wellen-Modus gehoert zum Run: Nach dem Prestige beginnt er wieder auf dem
  // Idle-Standard "an", genau wie Welle, Gold und Upgrades zuruecksetzen.
  'autoWaves',
  // Liegende Muenzen sind Gold, das noch nicht eingesammelt wurde - also Run-Daten.
  'coins',
  // Die Belegung der Faehigkeitenslots - sie kann nur enthalten, was freigeschaltet ist.
  'equipped',
  // Das offene Ereignis und die Welle, auf der das naechste faellig wird (GDD 11
  // Abschnitt 2). Beides gehoert zum Run: Nach dem Prestige beginnt der Rhythmus neu, und
  // eine offene Entscheidung darf ein Zuruecksetzen nicht ueberdauern. Es liegt im
  // Spielstand und nicht in den Laufzeitdaten, weil ein Neuladen sonst ein neues Ereignis
  // wuerfelte - dieselbe Begruendung wie beim Perk- und Turmangebot.
  'eventId',
  'gold',
  // Was der Run insgesamt eingebracht hat. Grundlage von Prestige-Voraussetzung und
  // -Punkten (GDD 10 Abschnitt 3 und 5) - und damit selbst Run-Daten: Ein neuer Run soll
  // sich sein Prestige neu verdienen.
  'goldEarned',
  // Die **gespielte** Liga gehoert zum Run: Nach dem Prestige steht ein frischer Bau in
  // Liga 1. Was der Spieler behaelt, ist die Erlaubnis in `permanent`, nicht der Ort.
  'league',
  // Wo jede Liga verlassen wurde. Der Rueckweg soll dort ankommen, wo man war, und nicht
  // auf Welle 1 - der Rekord daneben taugt dafuer nicht, er zeigt die tiefste Welle.
  'leagueWaves',
  'level',
  'nextEventWave',
  'nextTraderWave',
  // Das offene Perk-Angebot liegt im Spielstand und nicht in den Laufzeitdaten, sonst
  // wuerfelte ein Neuladen neue Karten (GDD 09 Abschnitt 2).
  'perkOffer',
  'perks',
  // Kapseln, die noch im Feld liegen - dieselbe Ueberlegung wie bei den Muenzen: Sie sind
  // ein Gegenstand im Feld, verfallen nicht, und verschwinden beim Prestige mit dem Feld.
  'pods',
  'rngState',
  'seed',
  'station',
  // Das offene Turmangebot und der Kaufzaehler. Der Zaehler treibt die Preiskurve
  // (GDD 06 Abschnitt 2) und gehoert damit zum Run - nach dem Prestige kostet der erste
  // Turm wieder den Grundpreis.
  'towerOffer',
  'towersBought',
  // Die Haendler-Drohne samt Sortiment und Restzeit (GDD 11 Abschnitt 7). Sie gehoert zum
  // Run: Nach dem Prestige beginnt ihr Rhythmus neu, und ein Sortiment aus dem alten Run
  // waere Gold aus einer Wirtschaft, die es nicht mehr gibt. Sie liegt im Spielstand und
  // nicht in den Laufzeitdaten, weil ein Neuladen sonst ihr Angebot neu wuerfelte - und
  // weil eine Gelegenheit nicht daran scheitern soll, dass jemand die Seite neu laedt.
  'trader',
  'upgrades',
  'wave',
  // Ein Rekord **je Liga**, Index `liga - 1`. Ein gemeinsamer Rekord machte die Skip-Grenze
  // in jeder hoeheren Liga sinnlos und setzte den Rueckweg in eine niedrige Liga auf
  // Welle 1 zurueck - genau das, was die niedrige Liga als Rueckfallebene taugen laesst.
  'waveRecords',
  'xp',
]

/** Die Station ist verschachtelt - ihre Felder brauchen dieselbe bewusste Entscheidung. */
const STATION_FIELDS = ['coreId', 'inventory', 'nextUid', 'placed', 'slots']

function memoryStorage(): SaveStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

export function saveSuite(): void {
  suite('app/save')

  check('deserialize(serialize(x)) ist gleich x', () => {
    const state = createInitialState(4242)
    state.run.gold = 1234
    state.run.wave = 17
    state.run.upgrades['core.damage'] = 3
    state.permanent.prestigePoints = 9
    state.permanent.seenHints.push('hint.gold')

    const first = serialize(state, 1000)
    const restored = deserialize(first)
    assert(restored !== null, 'Spielstand muss lesbar sein')
    assertDeepEqual(serialize(restored, 1000), first)
  })

  check('der Zufall laeuft nach dem Laden weiter, statt von vorn', () => {
    const state = createInitialState(777)
    for (let i = 0; i < 25; i++) state.runtime.rng.next()
    const expected = Array.from({ length: 5 }, () => state.runtime.rng.next())

    const state2 = createInitialState(777)
    for (let i = 0; i < 25; i++) state2.runtime.rng.next()
    const restored = deserialize(serialize(state2, 0))
    assert(restored !== null, 'Spielstand muss lesbar sein')
    assertDeepEqual(
      Array.from({ length: 5 }, () => restored.runtime.rng.next()),
      expected,
    )
  })

  check('Laufzeitdaten landen nie im Spielstand', () => {
    const text = JSON.stringify(serialize(createInitialState(1), 0))
    for (const field of [
      'runtime',
      'dirty',
      'buildUid',
      'selectedUid',
      'revision',
      'hoverEdge',
      'combat',
      'stationHp',
      'enemies',
    ]) {
      assert(!text.includes(field), `${field} darf nicht serialisiert werden`)
    }
  })

  check('die gebaute Station ueberlebt Speichern und Laden', () => {
    const state = createInitialState(99)
    const station = state.run.station
    station.slots = 6
    const first = station.inventory[0]?.uid as string
    place(station, first, freeEdges(station)[0] as FreeEdge)
    place(station, station.inventory[0]?.uid as string, freeEdges(station)[0] as FreeEdge)

    const before = stationModules(station)
    const restored = deserialize(serialize(state, 0))
    assert(restored !== null, 'Spielstand muss lesbar sein')
    const after = stationModules(restored.run.station)

    assertEqual(after.length, before.length, 'Modulanzahl')
    // Die Rundung auf drei Nachkommastellen darf keine gemeinsame Kante zerreissen.
    for (let i = 0; i < before.length; i++) {
      const a = before[i] as (typeof before)[number]
      const b = after[i] as (typeof after)[number]
      assertEqual(a.defId, b.defId, `Modul ${i}`)
      assertDeepEqual(a.sharedEdges, b.sharedEdges, `Fugen von Modul ${i}`)
      for (let k = 0; k < a.poly.length; k++) {
        assert(dist(a.poly[k] as Vec2, b.poly[k] as Vec2) < EPS, `Modul ${i}, Ecke ${k}`)
      }
    }
    assert(isConnected(restored.run.station), 'die geladene Station muss zusammenhaengen')
  })

  check('ein Modul mit unbrauchbaren Werten wird ausgelassen, nicht der Spielstand', () => {
    const state = createInitialState(5)
    const raw = serialize(state, 0) as unknown as Record<string, unknown>
    const run = raw['run'] as Record<string, unknown>
    const station = run['station'] as Record<string, unknown>

    station['modules'] = [
      { uid: 'm1', defId: 'gibt-es-nicht', rarity: 'common', placement: null },
      { uid: 'm2', defId: 'autocannon', rarity: 'ultra', placement: null },
      { uid: 'm3', defId: 'autocannon', rarity: 'common', placement: [Infinity, 0, 0] },
      { uid: 'm4', defId: 'autocannon', rarity: 'common', placement: [1e9, 0, 0] },
      { uid: 'm5', defId: 'autocannon', rarity: 'common', placement: null },
    ]

    const restored = deserialize(raw)
    assert(restored !== null, 'der Spielstand darf nicht verworfen werden')
    assertEqual(restored.run.station.inventory.length, 1, 'nur das gueltige Modul bleibt')
    assertEqual(restored.run.station.inventory[0]?.uid, 'm5')
  })

  check('ein fehlender Stationsblock ergibt die Startstation, nicht nichts', () => {
    /*
     * Frueher hiess der Test "ergibt die Startmodule": Das Lager begann mit drei
     * geschenkten Tuermen, und ihr Fehlen war die sichtbarste Folge eines verlorenen
     * Blocks. Geschenkt wird nichts mehr (`START_INVENTORY`), und damit ist die Zusage die
     * dahinterliegende geworden - **eine spielbare Station** statt `null` oder einer
     * Station ohne Kern und ohne Platz.
     */
    const raw = serialize(createInitialState(3), 0) as unknown as Record<string, unknown>
    delete (raw['run'] as Record<string, unknown>)['station']

    const restored = deserialize(raw)
    assert(restored !== null, 'der Spielstand darf nicht verworfen werden')
    assertEqual(restored.run.station.coreId, START_CORE_ID, 'ohne Kern gibt es kein Spiel')
    assertEqual(restored.run.station.slots, START_TOWER_SLOTS, 'und ohne Platz nichts zu bauen')
    assertEqual(restored.run.station.placed.length, 0)
  })

  check('eine leere Modulliste bleibt leer', () => {
    // Gegenprobe: Wer alle Module eingeschmolzen hat (ab E12), bekommt keine geschenkt.
    const raw = serialize(createInitialState(3), 0) as unknown as Record<string, unknown>
    const station = (raw['run'] as Record<string, unknown>)['station'] as Record<string, unknown>
    station['modules'] = []

    const restored = deserialize(raw)
    assertEqual(restored?.run.station.inventory.length, 0)
    assertEqual(restored?.run.station.placed.length, 0)
  })

  check('ein Spielstand aus Version 1 wird migriert', () => {
    const old = {
      version: 1,
      savedAt: 0,
      permanent: createInitialPermanent(),
      run: {
        seed: 7,
        rngState: 7,
        coreId: 'sentinel',
        wave: 4,
        waveRecord: 4,
        gold: 250,
        level: 2,
        xp: 10,
        towerSlots: 5,
        abilitySlots: 1,
        perks: [],
        upgrades: {},
      },
    }

    const restored = deserialize(old)
    assert(restored !== null, 'die Migration muss greifen')
    // Der Betrag steht danach im Goldmassstab (Migration 7 -> 8): Erhalten bleibt die
    // Kaufkraft, nicht die Zahl - die Preise sind denselben Weg gegangen.
    assertClose(restored.run.gold, 250 * GOLD_SCALE, 1e-9, 'Fortschritt bleibt erhalten')
    assertEqual(restored.run.station.coreId, 'sentinel', 'der Kern wandert in die Station')
    assertEqual(restored.run.station.slots, 5, 'die Turmplaetze wandern mit')
    // Das Lager bleibt leer - genau wie bei einem frischen Spiel. Ein Spielstand aus
    // Version 1 kannte noch keine Module, und geschenkt bekommt sie heute niemand mehr.
    assertEqual(restored.run.station.inventory.length, 0, 'Lager wie bei einem frischen Spiel')
  })

  check('der Goldmassstab rechnet einen alten Spielstand vollstaendig um', () => {
    /*
     * Der Beweis fuer Migration 7 -> 8. Sie ist die einzige, die vorhandene Werte
     * **aendert** statt Felder zu ergaenzen - deshalb wird sie hier Feld fuer Feld
     * geprueft, samt der Gegenprobe: Was nicht in Gold gerechnet ist, muss stehen bleiben.
     */
    const old = {
      version: 7,
      savedAt: 0,
      permanent: createInitialPermanent(),
      run: {
        ...serialize(createInitialState(1), 0).run,
        gold: 1000,
        goldEarned: 4000,
        towersBought: 3,
        xp: 800,
        coins: [{ x: 10, y: 20, value: 300, count: 2 }],
      },
    }

    const restored = deserialize(old)
    assert(restored !== null, 'die Migration muss greifen')
    assertClose(restored.run.gold, 1000 * GOLD_SCALE, 1e-9, 'der Kontostand')
    assertClose(restored.run.goldEarned, 4000 * GOLD_SCALE, 1e-9, 'das insgesamt Verdiente')
    assertClose(restored.run.coins[0]?.value ?? 0, 300 * GOLD_SCALE, 1e-9, 'liegende Muenzen')
    assertEqual(restored.run.coins[0]?.count, 2, 'die Stapelgroesse ist kein Betrag')
    assertEqual(restored.run.xp, 800, 'Erfahrung ist kein Gold')
    assertEqual(restored.run.towersBought, 3, 'der Kaufzaehler traegt den Preis, nicht ihn selbst')
  })

  check('kaputte Eingaben liefern null statt eines Absturzes', () => {
    const broken: unknown[] = [
      null,
      undefined,
      'nein',
      42,
      [],
      {},
      { version: 0 },
      { version: -1 },
      { version: 1.5 },
      { version: 1 }, // permanent und run fehlen
      { version: 1, permanent: 'kaputt', run: {} },
      { version: SAVE_VERSION + 1, permanent: {}, run: {} }, // aus der Zukunft
    ]
    for (const input of broken) {
      assertEqual(deserialize(input), null, `haette null liefern muessen: ${JSON.stringify(input)}`)
    }
  })

  check('einzelne kaputte Felder werden aufgefuellt, nicht verworfen', () => {
    const restored = deserialize({
      version: SAVE_VERSION,
      savedAt: 0,
      permanent: { prestigePoints: 'viel', unlockedTowers: ['autocannon', 7, 'cannon'] },
      run: { gold: Number.NaN, wave: 12, upgrades: { 'core.damage': 2, kaputt: 'x' } },
    })
    assert(restored !== null, 'darf nicht verworfen werden')
    assertEqual(restored.permanent.prestigePoints, 0, 'Startwert statt Text')
    assertDeepEqual(restored.permanent.unlockedTowers, ['autocannon', 'cannon'])
    assertEqual(restored.run.gold, 0, 'NaN faellt auf den Startwert zurueck')
    assertEqual(restored.run.wave, 12, 'gueltige Felder bleiben erhalten')
    assertDeepEqual(restored.run.upgrades, { 'core.damage': 2 })
  })

  check('unbekannte Zusatzfelder stoeren nicht', () => {
    const restored = deserialize({
      version: SAVE_VERSION,
      savedAt: 0,
      zukunft: { irgendwas: true },
      permanent: { ...createInitialPermanent(), zusatz: 1 },
      run: { ...createInitialRun(5), zusatz: 1 },
    })
    assert(restored !== null, 'darf nicht verworfen werden')
  })

  /*
   * Der Beweis fuer Migration 8 -> 9 (der Upgrade-Katalog).
   *
   * Sie ist die erste, die etwas **wegnimmt**, und genau deshalb steht sie hier: Was sie
   * loescht, muss die eine Sache sein, die nicht mehr passt - und alles andere muss
   * unberuehrt bleiben. Ein Spielstand, der beim Umbau seine Prestigepunkte verliert, waere
   * ein Datenverlust, kein Umbau.
   */
  check('der Katalog-Umbau verwirft nur die alten Upgrades', () => {
    const old = {
      version: 8,
      savedAt: 0,
      permanent: {
        ...createInitialPermanent(),
        prestigePoints: 4200,
        prestigeNodes: ['eco.gold1', 'helper.collector'],
        bestWaveEver: 88,
      },
      run: {
        ...serialize(createInitialState(3), 0).run,
        wave: 40,
        gold: 500,
        // Die alten Pfade - keiner davon existiert im Katalog.
        upgrades: { 'core.damage': 12, 'tower.autocannon.range': 4, 'global.stationHp': 7 },
      },
    }

    const restored = deserialize(old)
    assert(restored !== null, 'die Migration muss greifen')

    assertEqual(Object.keys(restored.run.upgrades).length, 0, 'die alten Pfade sind weg')
    // Und alles, was nicht am Katalog haengt, steht noch.
    assertEqual(restored.permanent.prestigePoints, 4200, 'die Prestigepunkte')
    assertEqual(restored.permanent.prestigeNodes.length, 2, 'die Freischaltungen')
    assertEqual(restored.permanent.bestWaveEver, 88, 'die Statistik')
    assertEqual(restored.run.wave, 40, 'die Welle')
    assertEqual(restored.run.gold, 500, 'das Gold auf dem Konto')
  })

  check('eine alte Haendlerware bekommt ihr leeres Upgrade-Feld', () => {
    const old = {
      version: 8,
      savedAt: 0,
      permanent: createInitialPermanent(),
      run: {
        ...serialize(createInitialState(3), 0).run,
        trader: {
          x: 100,
          y: 0,
          left: 30,
          visited: false,
          // So sah ein Posten vor E7 aus: ohne `upgradeId`.
          stock: [{ defId: 'trade.upgrade1', perkId: null, price: 5, sold: false }],
        },
      },
    }

    const restored = deserialize(old)
    assert(restored !== null, 'die Migration muss greifen')
    const offer = restored.run.trader?.stock[0]
    assert(offer !== undefined, 'die Ware muss den Spielstand ueberleben')
    assertEqual(offer.upgradeId, null, 'das neue Feld steht auf null')
  })

  check('die Migrationskette ist lueckenlos', () => {
    assert(
      migrationChainComplete(),
      `es fehlt eine Migration unterhalb von Version ${SAVE_VERSION}`,
    )
  })

  check('Rundlauf ueber die Ablage', () => {
    setStorage(memoryStorage())
    const state = createInitialState(2024)
    state.run.gold = 555
    assertEqual(save(state, 1_700_000_000_000), true)
    const loaded = load()
    assert(loaded !== null, 'Spielstand muss geladen werden')
    assertEqual(loaded.run.gold, 555)
    assertEqual(lastSavedAt(), 1_700_000_000_000)
    setStorage(null)
  })

  check('Speichern loescht die Aenderungsmarke', () => {
    setStorage(memoryStorage())
    const state = createInitialState(1)
    state.runtime.dirty = true
    save(state, 0)
    assertEqual(state.runtime.dirty, false)
    setStorage(null)
  })

  check('kaputter Text in der Ablage meldet sich und liefert null', () => {
    resetEvents()
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{ das ist kein json')
    setStorage(storage)
    let reported = 0
    on('save.corrupt', () => reported++)
    assertEqual(load(), null)
    assertEqual(reported, 1)
    resetEvents()
    setStorage(null)
  })

  check('clearSave entfernt den Spielstand', () => {
    setStorage(memoryStorage())
    save(createInitialState(1), 0)
    clearSave()
    assertEqual(load(), null)
    assertEqual(lastSavedAt(), null)
    setStorage(null)
  })

  check('ohne Spielstand liefert load() null, ohne Fehlermeldung', () => {
    resetEvents()
    setStorage(memoryStorage())
    let reported = 0
    on('save.corrupt', () => reported++)
    assertEqual(load(), null)
    assertEqual(reported, 0, 'ein leerer Speicher ist kein Fehler')
    resetEvents()
    setStorage(null)
  })

  check('die automatische Sicherung wartet auf Abstand und Aenderung', () => {
    setStorage(memoryStorage())
    const scheduler = createManualScheduler()
    const loop = createLoop({ scheduleFrame: scheduler })
    const state = createInitialState(1)
    const autosave = startAutosave(state, loop)

    let written = 0
    resetEvents()
    on('save.written', () => written++)

    loop.start(
      () => autosave.tick(),
      () => {},
    )
    scheduler.advance(0)

    scheduler.advanceBy((AUTOSAVE_INTERVAL_SECONDS + 1) * 1000, 100)
    assertEqual(written, 0, 'ohne Aenderung wird nicht gesichert')

    state.runtime.dirty = true
    scheduler.advanceBy(1000, 100)
    assertEqual(written, 1, 'nach einer Aenderung wird gesichert')

    state.runtime.dirty = true
    scheduler.advanceBy(1000, 100)
    assertEqual(written, 1, 'der Abstand wird eingehalten')

    scheduler.advanceBy(AUTOSAVE_INTERVAL_SECONDS * 1000, 100)
    assertEqual(written, 2)

    loop.stop()
    autosave.stop()
    resetEvents()
    setStorage(null)
  })

  check('die Feldliste von permanent ist unveraendert (E13-Absicherung)', () => {
    assertDeepEqual(Object.keys(createInitialPermanent()).sort(), PERMANENT_FIELDS)
  })

  check('die Feldliste von run ist unveraendert (E13-Absicherung)', () => {
    assertDeepEqual(Object.keys(createInitialRun(1)).sort(), RUN_FIELDS)
  })

  check('die Feldliste der Station ist unveraendert (E13-Absicherung)', () => {
    assertDeepEqual(Object.keys(createInitialRun(1).station).sort(), STATION_FIELDS)
  })

  check('permanent und run ueberschneiden sich nicht', () => {
    const overlap = PERMANENT_FIELDS.filter((field) => RUN_FIELDS.includes(field))
    assertDeepEqual(overlap, [], 'ein Feld gehoert genau einem Bereich')
  })
}
