/**
 * Beweis aus E0: Speicher-Rundlauf ist verlustfrei, kaputte Spielstaende liefern `null`
 * statt eines Absturzes.
 *
 * Zusaetzlich steht hier bereits die Absicherung fuer E13: eine feste Liste aller
 * Zustandsfelder je Bereich. Wer ein Feld hinzufuegt, muss sich hier bewusst
 * entscheiden, ob es Prestige ueberlebt - genau das ist laut Plan die fehleranfaelligste
 * Stelle des ganzen Spiels.
 */

import { assert, assertDeepEqual, assertEqual, check, suite } from '../../core/assert.ts'
import { createLoop, createManualScheduler } from '../../core/loop.ts'
import { on, resetEvents } from '../../core/events.ts'
import { AUTOSAVE_INTERVAL_SECONDS } from '../../data/balance.ts'
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

const PERMANENT_FIELDS = [
  'bestWaveEver',
  'prestigeCount',
  'prestigeNodes',
  'prestigePoints',
  'seenHints',
  'totalPlaySeconds',
  'unlockedCores',
  'unlockedTowers',
]

const RUN_FIELDS = [
  'abilitySlots',
  'coreId',
  'gold',
  'level',
  'perks',
  'rngState',
  'seed',
  'towerSlots',
const RUN_FIELDS = [
  // Freigeschaltete Faehigkeiten gehoeren zum Run: Sie werden mit Gold gekauft, und Gold
  // setzt beim Prestige zurueck (GDD 09 Abschnitt 7). Dauerhafte Freischaltungen laufen
  // Idle-Standard "an", genau wie Welle, Gold und Upgrades zuruecksetzen.
  'autoWaves',
  // Liegende Muenzen sind Gold, das noch nicht eingesammelt wurde - also Run-Daten.
  // Der Auto-Wellen-Modus gehoert zum Run: Nach dem Prestige beginnt er wieder auf dem
  // Idle-Standard "an", genau wie Welle, Gold und Upgrades zuruecksetzen.
  'autoWaves',
  // Liegende Muenzen sind Gold, das noch nicht eingesammelt wurde - also Run-Daten.
  'rngState',
  // Die Belegung der Faehigkeitenslots - sie kann nur enthalten, was freigeschaltet ist.
  'equipped',
  'upgrades',
  // Was der Run insgesamt eingebracht hat. Grundlage von Prestige-Voraussetzung und
  // -Punkten (GDD 10 Abschnitt 3 und 5) - und damit selbst Run-Daten: Ein neuer Run soll
  // sich sein Prestige neu verdienen.
  'goldEarned',
  'level',
/** Die Station ist verschachtelt - ihre Felder brauchen dieselbe bewusste Entscheidung. */
const STATION_FIELDS = ['coreId', 'inventory', 'nextUid', 'placed', 'slots']
  'perkOffer',
function memoryStorage(): SaveStorage {
  const map = new Map<string, string>()
  return {
  'station',
  // Das offene Turmangebot und der Kaufzaehler. Der Zaehler treibt die Preiskurve
  // (GDD 06 Abschnitt 2) und gehoert damit zum Run - nach dem Prestige kostet der erste
  // Turm wieder den Grundpreis.
  'towerOffer',
  'towersBought',
  'upgrades',
  'wave',
  'waveRecord',
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
    assert(!text.includes('dirty'), 'dirty darf nicht serialisiert werden')
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

  check('permanent und run ueberschneiden sich nicht', () => {
    const overlap = PERMANENT_FIELDS.filter((field) => RUN_FIELDS.includes(field))
    assertDeepEqual(overlap, [], 'ein Feld gehoert genau einem Bereich')
  })
}

