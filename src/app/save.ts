/**
 * Serialisierung, Version, Migration.
 *
 * Eine einzige Stelle (GDD 16 Abschnitt 8). Der Spielstand ist ein klar getrenntes,
 * versioniertes Datenobjekt - Voraussetzung fuer spaeteren Server-Abgleich und fuer die
 * Offline-Berechnung, die den Zeitstempel der letzten Sicherung braucht.
 *
 * Regel aus dem Implementierungsplan Abschnitt 9: Wer ein Feld hinzufuegt, erhoeht
 * `SAVE_VERSION` und traegt eine Migration in `MIGRATIONS` ein - auch waehrend der
 * Entwicklung. Der Selbsttest prueft, dass die Kette luckenlos ist.
 *
 * Abweichung von der Signatur im Plan: `serialize`/`save` bekommen die echte Uhrzeit
 * uebergeben, statt sie selbst zu holen. Sonst muesste diese Datei `Date.now()` aufrufen,
 * und die Zeitquelle waere nicht mehr allein `core/loop.ts`.
 */

import { emit } from '../core/events.ts'
import {
  AUTOSAVE_INTERVAL_SECONDS,
  GOLD_SCALE,
  START_CORE_ID,
  START_LEAGUE,
  START_TOWER_SLOTS,
  START_WAVE,
} from '../data/balance.ts'
import type { Loop } from '../core/loop.ts'
import { isKnownEvent } from '../data/events.ts'
import { clampLeague } from '../data/leagues.ts'
import { isKnownTower } from '../data/towers.ts'
import { isKnownTrait } from '../data/traits.ts'
import { isRarity } from '../data/types.ts'
import { isValidPod } from '../sim/events.ts'
import { isValidOffer } from '../sim/shop.ts'
import { isValidTrader } from '../sim/trader.ts'
import type { Coin } from '../sim/economy.ts'
import {
  createStation,
  sanitizeStation,
  type ModuleInstance,
  type Station,
} from '../sim/station.ts'
import {
  createInitialPermanent,
  createInitialRun,
  createInitialStation,
  createRuntime,
  syncRngState,
  type GameState,
  type PermanentState,
  type RunState,
} from './state.ts'

/**
 * Version 2 (E2): Hauptturm und Module wurden zur `station` zusammengefasst.
 * Version 3 (E7/E9): liegende Muenzen und der Auto-Wellen-Modus kamen dazu.
 * Version 4 (E10/E11): das offene Perk-Angebot sowie freigeschaltete und belegte
 *   Faehigkeiten kamen dazu.
 * Version 5 (E12/E13): Turm-Eigenschaften je Exemplar, Kaufzaehler und Turmangebot,
 *   insgesamt verdientes Gold als Grundlage des Prestiges.
 * Version 6 (E16): Versorgungskapseln im Feld, das offene Ereignis und die Welle, auf der
 *   das naechste faellig wird.
 * Version 7 (E16, nachgereicht): die Haendler-Drohne samt Sortiment und Restzeit.
 * Version 8: der Goldmassstab - kein neues Feld, sondern eine Umrechnung der vorhandenen
 *   Betraege (Kontostand, verdientes Gold, liegende Muenzen).
 * Version 9: der Upgrade-Katalog. Die gekauften Upgrades werden verworfen (die alten Pfade
 *   gibt es nicht mehr), und die Haendlerware bekommt ihr `upgradeId`.
 * Version 10: die Ligen. Der eine Wellenrekord wird zu einem je Liga, dazu die gespielte
 *   Liga im Run und die freigeschaltete in `permanent`. Verlustfrei - jeder alte Spielstand
 *   landet in Liga 1 mit genau dem Rekord, den er hatte.
 */
export const SAVE_VERSION = 10
export const STORAGE_KEY = 'wavebreaker.save'

/**
 * Platzierung als Tripel, gerundet auf drei Nachkommastellen. Am Prototyp bestaetigt:
 * 11 Module plus Inventar ergeben rund 1,4 KB, und die Rundung liegt Groessenordnungen
 * unter der Kantentoleranz - eine gemeinsame Kante kann dadurch nicht zerreissen.
 */
export type SavedModule = {
  uid: string
  defId: string
  rarity: string
  /** Eigenschaften dieses Exemplars (GDD 06 Abschnitt 10) - nur die Kennungen. */
  traits: string[]
  placement: [number, number, number] | null
}

export type SavedStation = {
  coreId: string
  slots: number
  nextUid: number
  modules: SavedModule[]
}

export type SavedRun = Omit<RunState, 'station'> & { station: SavedStation }

export type SaveData = {
  version: number
  /** Echte Uhrzeit in Millisekunden - Grundlage der Offline-Berechnung (E17). */
  savedAt: number
  permanent: PermanentState
  run: SavedRun
}

/** Weiter als das Spielfeld je reicht - schuetzt vor manipulierten Koordinaten. */
const MAX_COORDINATE = 100_000

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function saveStation(station: Station): SavedStation {
  const modules: SavedModule[] = []
  for (const module of [...station.placed, ...station.inventory]) {
    modules.push({
      uid: module.uid,
      defId: module.defId,
      rarity: module.rarity,
      traits: [...module.traits],
      placement: module.placement
        ? [
            round3(module.placement.center.x),
            round3(module.placement.center.y),
            round3(module.placement.rotation),
          ]
        : null,
    })
  }
  return { coreId: station.coreId, slots: station.slots, nextUid: station.nextUid, modules }
}

/**
 * Module, die es nicht mehr gibt oder deren Werte unbrauchbar sind, werden ausgelassen
 * statt den ganzen Spielstand zu verwerfen. Anschliessend raeumt `sanitizeStation` die
 * Folgen auf - etwa Module, die dadurch den Anschluss verloren haben.
 */
function readStation(raw: unknown): Station {
  // Fehlt der Block ganz, bekommt der Spieler dieselbe Station wie bei einem frischen
  // Spiel - nicht etwa eine leere. Eine leere `modules`-Liste dagegen ist ein gueltiger
  // Zustand und bleibt unangetastet.
  if (!isRecord(raw)) return createInitialStation()

  const coreId = readString(raw['coreId'], START_CORE_ID)
  const slots = Math.max(0, Math.floor(readNumber(raw['slots'], START_TOWER_SLOTS)))
  const station = createStation(coreId, slots)
  station.nextUid = Math.max(1, Math.floor(readNumber(raw['nextUid'], 1)))

  const modules = Array.isArray(raw['modules']) ? raw['modules'] : []
  for (const entry of modules) {
    const module = readModule(entry)
    if (!module) continue
    if (module.placement) station.placed.push(module)
    else station.inventory.push(module)
  }

  sanitizeStation(station)
  return station
}

function readModule(raw: unknown): ModuleInstance | null {
  if (!isRecord(raw)) return null

  const uid = raw['uid']
  const defId = raw['defId']
  const rarity = raw['rarity']
  if (typeof uid !== 'string' || uid.length === 0) return null
  if (typeof defId !== 'string' || !isKnownTower(defId)) return null
  if (!isRarity(rarity)) return null

  // Unbekannte Eigenschaften werden ausgelassen statt den Turm zu verwerfen: Ein Datensatz
  // kann verschwinden, der Turm ist trotzdem ein Turm.
  const traits = readStringArray(raw['traits'], []).filter(isKnownTrait)

  const placement = raw['placement']
  if (placement === null || placement === undefined) {
    return { uid, defId, rarity, traits, placement: null }
  }

  if (!Array.isArray(placement) || placement.length !== 3) return null
  const [cx, cy, rot] = placement
  for (const value of [cx, cy, rot]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
  }
  if (Math.abs(cx as number) > MAX_COORDINATE || Math.abs(cy as number) > MAX_COORDINATE) {
    return null
  }

  return {
    uid,
    defId,
    rarity,
    traits,
    placement: { center: { x: cx as number, y: cy as number }, rotation: rot as number },
  }
}

// ---------------------------------------------------------------------------
// Ablage
// ---------------------------------------------------------------------------

export type SaveStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function createMemoryStorage(): SaveStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

let storage: SaveStorage | null = null

function resolveStorage(): SaveStorage {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') {
      // Probeschreiben: im privaten Modus existiert localStorage, wirft aber beim Schreiben.
      localStorage.setItem('wavebreaker.probe', '1')
      localStorage.removeItem('wavebreaker.probe')
      storage = localStorage
      return storage
    }
  } catch {
    // faellt unten auf den Speicher im Arbeitsspeicher zurueck
  }
  storage = createMemoryStorage()
  return storage
}

/** Ablage ersetzen - fuer Selbsttests und den headless-Lauf. */
export function setStorage(next: SaveStorage | null): void {
  storage = next
}

// ---------------------------------------------------------------------------
// Serialisieren und Pruefen
// ---------------------------------------------------------------------------

export function serialize(state: GameState, nowMs: number): SaveData {
  syncRngState(state)
  return {
    version: SAVE_VERSION,
    savedAt: nowMs,
    permanent: {
      prestigePoints: state.permanent.prestigePoints,
      prestigeNodes: [...state.permanent.prestigeNodes],
      unlockedTowers: [...state.permanent.unlockedTowers],
      unlockedCores: [...state.permanent.unlockedCores],
      seenHints: [...state.permanent.seenHints],
      bestWaveEver: state.permanent.bestWaveEver,
      leagueUnlocked: state.permanent.leagueUnlocked,
      prestigeCount: state.permanent.prestigeCount,
      totalPlaySeconds: state.permanent.totalPlaySeconds,
    },
    run: {
      seed: state.run.seed,
      rngState: state.run.rngState,
      station: saveStation(state.run.station),
      wave: state.run.wave,
      league: state.run.league,
      waveRecords: [...state.run.waveRecords],
      leagueWaves: [...state.run.leagueWaves],
      gold: state.run.gold,
      goldEarned: state.run.goldEarned,
      towersBought: state.run.towersBought,
      towerOffer: state.run.towerOffer.map((offer) => ({
        defId: offer.defId,
        rarity: offer.rarity,
        traits: [...offer.traits],
      })),
      coins: state.run.coins.map((coin) => ({
        x: round3(coin.x),
        y: round3(coin.y),
        value: coin.value,
        count: coin.count,
      })),
      level: state.run.level,
      xp: state.run.xp,
      abilitySlots: state.run.abilitySlots,
      perks: [...state.run.perks],
      perkOffer: [...state.run.perkOffer],
      abilities: [...state.run.abilities],
      equipped: [...state.run.equipped],
      upgrades: { ...state.run.upgrades },
      autoWaves: state.run.autoWaves,
      pods: state.run.pods.map((pod) => ({
        id: pod.id,
        defId: pod.defId,
        x: round3(pod.x),
        y: round3(pod.y),
      })),
      eventId: state.run.eventId,
      nextEventWave: state.run.nextEventWave,
      trader: state.run.trader
        ? {
            x: round3(state.run.trader.x),
            y: round3(state.run.trader.y),
            left: round3(state.run.trader.left),
            visited: state.run.trader.visited,
            stock: state.run.trader.stock.map((offer) => ({ ...offer })),
          }
        : null,
      nextTraderWave: state.run.nextTraderWave,
    },
  }
}

export function deserialize(data: unknown): GameState | null {
  if (!isRecord(data)) return null

  const version = data['version']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null
  // Ein Spielstand aus einer neueren Fassung wird nicht geraten, sondern abgelehnt.
  if (version > SAVE_VERSION) return null

  const migrated = version === SAVE_VERSION ? data : migrate(data, version)
  if (!migrated) return null

  if (!isRecord(migrated['permanent']) || !isRecord(migrated['run'])) return null

  const permanent = readPermanent(migrated['permanent'])
  const run = readRun(migrated['run'])

  // Die einzige Stelle, die **beide** Bloecke sieht - und deshalb die einzige, die pruefen
  // kann, ob die gespielte Liga ueberhaupt freigeschaltet ist. Ein Spielstand aus fremder
  // Hand kaeme sonst mit `league: 10` und `leagueUnlocked: 1` durch.
  run.league = Math.min(run.league, permanent.leagueUnlocked)

  return { permanent, run, runtime: createRuntime(run) }
}

/**
 * Fehlende oder kaputte Einzelfelder werden mit dem Startwert aufgefuellt, statt den
 * ganzen Spielstand zu verwerfen. Die Migrationskette bleibt trotzdem Pflicht - sie ist
 * der geplante Weg, das hier ist nur das Netz darunter.
 */
function readPermanent(raw: Record<string, unknown>): PermanentState {
  const base = createInitialPermanent()
  return {
    prestigePoints: readNumber(raw['prestigePoints'], base.prestigePoints),
    prestigeNodes: readStringArray(raw['prestigeNodes'], base.prestigeNodes),
    unlockedTowers: readStringArray(raw['unlockedTowers'], base.unlockedTowers),
    unlockedCores: readStringArray(raw['unlockedCores'], base.unlockedCores),
    seenHints: readStringArray(raw['seenHints'], base.seenHints),
    bestWaveEver: readNumber(raw['bestWaveEver'], base.bestWaveEver),
    leagueUnlocked: clampLeague(readNumber(raw['leagueUnlocked'], base.leagueUnlocked)),
    prestigeCount: readNumber(raw['prestigeCount'], base.prestigeCount),
    totalPlaySeconds: readNumber(raw['totalPlaySeconds'], base.totalPlaySeconds),
  }
}

function readRun(raw: Record<string, unknown>): RunState {
  const base = createInitialRun(readNumber(raw['seed'], 1))
  return {
    seed: base.seed,
    rngState: readNumber(raw['rngState'], base.rngState),
    station: readStation(raw['station']),
    wave: readNumber(raw['wave'], base.wave),
    league: clampLeague(readNumber(raw['league'], base.league)),
    waveRecords: readWaveRecords(raw['waveRecords'], base.waveRecords),
    leagueWaves: readWaveRecords(raw['leagueWaves'], base.leagueWaves),
    gold: readNumber(raw['gold'], base.gold),
    goldEarned: readNumber(raw['goldEarned'], base.goldEarned),
    towersBought: readNumber(raw['towersBought'], base.towersBought),
    towerOffer: Array.isArray(raw['towerOffer'])
      ? raw['towerOffer'].filter(isValidOffer).map((offer) => ({ ...offer, traits: [...offer.traits] }))
      : base.towerOffer,
    coins: readCoins(raw['coins']),
    level: readNumber(raw['level'], base.level),
    xp: readNumber(raw['xp'], base.xp),
    abilitySlots: readNumber(raw['abilitySlots'], base.abilitySlots),
    perks: readStringArray(raw['perks'], base.perks),
    perkOffer: readStringArray(raw['perkOffer'], base.perkOffer),
    abilities: readStringArray(raw['abilities'], base.abilities),
    equipped: readStringArray(raw['equipped'], base.equipped),
    upgrades: readNumberRecord(raw['upgrades'], base.upgrades),
    autoWaves: typeof raw['autoWaves'] === 'boolean' ? raw['autoWaves'] : base.autoWaves,
    // Eine unbrauchbare Kapsel wird ausgelassen, nicht der ganze Spielstand verworfen -
    // dieselbe Regel wie bei Muenzen und Modulen.
    pods: Array.isArray(raw['pods'])
      ? raw['pods'].filter(isValidPod).map((pod) => ({ ...pod }))
      : base.pods,
    // Ein Ereignis, das es nicht mehr gibt, faellt weg. Der Spieler bekommt dann eben
    // frueher das naechste, statt vor einem Fenster ohne Optionen zu stehen.
    eventId:
      typeof raw['eventId'] === 'string' && isKnownEvent(raw['eventId']) ? raw['eventId'] : null,
    nextEventWave: readNumber(raw['nextEventWave'], base.nextEventWave),
    // Eine unbrauchbare Drohne fliegt weiter, statt mit einem Loch im Regal dazustehen.
    trader: isValidTrader(raw['trader'])
      ? { ...raw['trader'], stock: raw['trader'].stock.map((offer) => ({ ...offer })) }
      : null,
    nextTraderWave: readNumber(raw['nextTraderWave'], base.nextTraderWave),
  }
}

/** Eine unbrauchbare Muenze wird ausgelassen - der Rest des Goldes bleibt liegen. */
function readCoins(raw: unknown): Coin[] {
  if (!Array.isArray(raw)) return []

  const coins: Coin[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const x = entry['x']
    const y = entry['y']
    const value = entry['value']
    if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > MAX_COORDINATE) continue
    if (typeof y !== 'number' || !Number.isFinite(y) || Math.abs(y) > MAX_COORDINATE) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue

    const count = entry['count']
    coins.push({ x, y, value, count: typeof count === 'number' && count >= 1 ? count : 1 })
  }
  return coins
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

/**
 * Schluessel `n` fuehrt von Version `n` auf `n + 1`. Immer Schritt fuer Schritt, nie
 * ein Sprung ueber mehrere Fassungen.
 */
const MIGRATIONS: Record<number, Migration> = {
  /**
   * 1 -> 2 (E2): `coreId` und `towerSlots` lagen frueher direkt in den Run-Daten. Sie
   * gehoeren zur Station, die es in Version 1 noch nicht gab. Ein Spielstand aus E0/E1 hat
   * noch keine Module, also entsteht eine leere Station.
   *
   * Hier wurden einmal drei Module hineingelegt - dieselben, die ein frisches Spiel
   * verschenkte, weil es den Turmkauf (E12) noch nicht gab. Beides ist weg: Das Lager
   * beginnt leer, und ein alter Spielstand faengt damit genauso an wie ein neuer.
   */
  1: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    const station = createStation(
      readString(run['coreId'], START_CORE_ID),
      readNumber(run['towerSlots'], START_TOWER_SLOTS),
    )
    const migrated: Record<string, unknown> = { ...run, station: saveStation(station) }
    delete migrated['coreId']
    delete migrated['towerSlots']
    return { ...data, run: migrated }
  },

  /**
   * 2 -> 3 (E7/E9): Liegende Muenzen und der Auto-Wellen-Modus. Ein alter Spielstand
   * hatte beides noch nicht - er startet ohne Muenzen und mit eingeschaltetem Auto-Modus,
   * genau wie ein frisches Spiel.
   */
  2: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    return { ...data, run: { ...run, coins: [], autoWaves: true } }
  },

  /**
   * 3 -> 4 (E10/E11): Perk-Angebot und Faehigkeiten.
   *
   * Alle drei Listen starten leer. Das Angebot wird beim naechsten offenen Aufstieg neu
   * gezogen; Erfahrung und Stufe standen schon vorher im Spielstand, ein alter Spielstand
   * behaelt also seinen Fortschritt und bekommt seine faelligen Auswahlen sofort angeboten.
   */
  3: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    return { ...data, run: { ...run, perkOffer: [], abilities: [], equipped: [] } }
  },

  /**
   * 4 -> 5 (E12/E13): Eigenschaften, Kaufzaehler und verdientes Gold.
   *
   * Bestehende Tuerme bekommen **keine** Eigenschaften nachtraeglich zugewuerfelt: Sie sind
   * vor der Freischaltung entstanden, und ein Turm, der sich beim Laden veraendert, waere
   * eine unangenehme Ueberraschung.
   *
   * `goldEarned` wird aus dem aktuellen Kontostand geschaetzt - genauer geht es nicht, die
   * Zahl gab es vorher nicht. Sie faellt damit zu niedrig aus, wenn schon etwas ausgegeben
   * wurde; das ist die richtige Richtung, denn so verschenkt niemand ein Prestige, das er
   * sich nicht erspielt hat.
   */
  4: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    return {
      ...data,
      run: {
        ...run,
        goldEarned: readNumber(run['gold'], 0),
        towersBought: 0,
        towerOffer: [],
      },
    }
  },

  /**
   * 5 -> 6 (E16): Versorgungskapseln und Ereignisse.
   *
   * Das Feld startet ohne Kapseln, und es steht kein Ereignis offen: Beides waere sonst
   * eine Belohnung, die der Spieler nie erspielt hat. `nextEventWave` bleibt auf 0 - das
   * heisst "noch offen", und der erste Takt wuerfelt den Abstand von der aktuellen Welle
   * aus. Ein fester Wert hier laege bei einem Spielstand auf Welle 400 laengst in der
   * Vergangenheit und feuerte sofort.
   */
  5: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    return { ...data, run: { ...run, pods: [], eventId: null, nextEventWave: 0 } }
  },

  /**
   * 6 -> 7 (E16, nachgereicht): die Haendler-Drohne.
   *
   * Es steht keine im Feld, und `nextTraderWave` bleibt auf 0 - dasselbe "noch offen" wie
   * beim Ereignis. Der erste Takt wuerfelt den Abstand von der aktuellen Welle aus; eine
   * feste Zahl laege bei einem Spielstand auf Welle 400 in der Vergangenheit und liesse die
   * Drohne sofort erscheinen.
   */
  6: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    return { ...data, run: { ...run, trader: null, nextTraderWave: 0 } }
  },

  /**
   * 7 -> 8: der Goldmassstab (`GOLD_SCALE` in `data/balance.ts`).
   *
   * Die einzige Migration, die kein Feld hinzufuegt, sondern **vorhandene umrechnet**. Sie
   * muss sein, weil der Massstab beide Seiten der Wirtschaft zugleich verschoben hat: Ein
   * Spielstand mit Betraegen im alten Massstab traefe auf Preise im neuen und waere damit
   * schlagartig fuenfmal so reich - der Spieler haette alles sofort und nichts mehr zu
   * entscheiden.
   *
   * Umgerechnet wird jeder Betrag, der im Spielstand steht: Kontostand, das insgesamt
   * Verdiente (Grundlage der Prestige-Voraussetzung) und jede Muenze, die noch im Feld
   * liegt. Was nicht in Gold gerechnet ist - Erfahrung, Prestige-Punkte, Upgrade-Stufen,
   * der Kaufzaehler - bleibt unberuehrt: Der Massstab hat die Wirtschaft nicht
   * umgestellt, nur ihre Zahlen.
   *
   * `towersBought` ist der wichtigste dieser unberuehrten Werte: Der Turmpreis waechst aus
   * ihm, und weil `towerCost` den Massstab selbst einrechnet, steht der naechste Preis
   * ohne Zutun richtig da.
   */
  7: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    const coins = Array.isArray(run['coins']) ? run['coins'] : []
    return {
      ...data,
      run: {
        ...run,
        gold: readNumber(run['gold'], 0) * GOLD_SCALE,
        goldEarned: readNumber(run['goldEarned'], 0) * GOLD_SCALE,
        // Eine unbrauchbare Muenze wird hier nicht aussortiert - das tut `readCoins`
        // ohnehin danach. Sie wird nur nicht angefasst.
        coins: coins.map((coin) =>
          isRecord(coin) && typeof coin['value'] === 'number'
            ? { ...coin, value: coin['value'] * GOLD_SCALE }
            : coin,
        ),
      },
    }
  },

  /**
   * 8 -> 9: Der Upgrade-Katalog (`docs/upgrade-umbau.md`).
   *
   * **Die gekauften Upgrades werden verworfen**, und zwar vollstaendig. Die alten Pfade
   * (`core.damage`, `tower.autocannon.range`, `global.stationHp`) gibt es nicht mehr; jeder
   * von ihnen ist durch einen benannten Eintrag ersetzt worden, und keiner laesst sich
   * eindeutig zuordnen - `core.damage` verteilt sich auf `Hammerfall` und `Overclock`, die
   * verschieden wirken und verschieden viel kosten. Eine Umrechnung waere eine Schaetzung,
   * die man nie ganz richtig hinbekommt.
   *
   * Sie stehenzulassen waere schlimmer als sie zu verwerfen: `applyUpgrades` ignoriert
   * unbekannte Pfade, sie wuerden also mitgespeichert, nichts bewirken und beim naechsten
   * Blick in den Spielstand wie ein Fehler aussehen.
   *
   * **Alles andere bleibt**: Prestigepunkte, Freischaltungen, Statistik, Station, Inventar,
   * Level und Perks. Was verloren geht, ist ausgegebenes Gold eines laufenden Runs - laut
   * GDD 08 Abschnitt 9 ohnehin die vergaenglichste Schicht des Spiels.
   *
   * Dazu das neue Feld `upgradeId` an der Haendlerware: Ein alter Posten wusste noch nicht,
   * welches Upgrade er verschenkt (gewuerfelt wurde erst beim Kauf). `null` heisst hier
   * "keines" - der Posten laesst sich kaufen und tut dann nichts. Das ist die eine Stelle,
   * an der dieser Umbau einen alten Spielstand um eine Kleinigkeit aermer macht, und sie
   * betrifft hoechstens die eine Drohne, die gerade im Feld steht.
   */
  8: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    const trader = isRecord(run['trader']) ? run['trader'] : null
    const stock = trader && Array.isArray(trader['stock']) ? trader['stock'] : null

    return {
      ...data,
      run: {
        ...run,
        upgrades: {},
        ...(trader
          ? {
              trader: {
                ...trader,
                ...(stock
                  ? {
                      stock: stock.map((offer) =>
                        isRecord(offer) ? { ...offer, upgradeId: null } : offer,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
      },
    }
  },

  /**
   * 9 -> 10: die Ligen (docs/liga-system.md).
   *
   * Aus dem einen `waveRecord` wird der erste Eintrag einer Liste je Liga, dazu kommen die
   * gespielte Liga im Run und die freigeschaltete in `permanent`. Beide beginnen bei 1.
   *
   * **Verlustfrei.** Jeder alte Spielstand landet genau dort, wo er heute steht: in Liga 1,
   * mit seinem Rekord, mit allem an Tuermen, Gold, Level und Upgrades. Die Ligen sind kein
   * Umbau der Wirtschaft, sondern eine zweite Achse daneben - und die beginnt fuer einen
   * bestehenden Run bei ihrem Anfang.
   *
   * Das alte Feld wird **geloescht** und nicht liegengelassen: Ein `waveRecord`, das
   * mitgespeichert wuerde und niemanden mehr interessiert, saehe beim naechsten Blick in
   * den Spielstand wie die Wahrheit aus.
   */
  9: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    const record = readNumber(run['waveRecord'], START_WAVE)

    const migrated: Record<string, unknown> = {
      ...run,
      league: START_LEAGUE,
      waveRecords: [Math.max(START_WAVE, Math.floor(record))],
      leagueWaves: [Math.max(START_WAVE, Math.floor(readNumber(run['wave'], START_WAVE)))],
    }
    delete migrated['waveRecord']

    const result: Record<string, unknown> = { ...data, run: migrated }
    // `permanent` wird **ergaenzt, nicht erschaffen**: Ein Spielstand ohne diesen Block ist
    // kaputt, und `deserialize` weist ihn ab. Wuerde die Migration ihn hier nebenbei
    // anlegen, kaeme ein Fragment durch die Pruefung, das nie ein Spielstand war - der
    // Selbsttest "kaputte Eingaben liefern null" faengt genau diesen Fall.
    if (isRecord(data['permanent'])) {
      result['permanent'] = { ...data['permanent'], leagueUnlocked: START_LEAGUE }
    }
    return result
  },
}

export function migrate(data: Record<string, unknown>, fromVersion: number): SaveData | null {
  let current = data
  for (let v = fromVersion; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) return null
    current = step(current)
    current['version'] = v + 1
  }
  return current as unknown as SaveData
}

/** Fuer den Selbsttest: ist die Kette von Version 1 bis heute lueckenlos? */
export function migrationChainComplete(): boolean {
  for (let v = 1; v < SAVE_VERSION; v++) {
    if (!MIGRATIONS[v]) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------

export function save(state: GameState, nowMs: number): boolean {
  const data = serialize(state, nowMs)
  const text = JSON.stringify(data)
  try {
    resolveStorage().setItem(STORAGE_KEY, text)
  } catch {
    // Speicher voll oder gesperrt - das Spiel laeuft weiter, nur ohne Sicherung.
    return false
  }
  state.runtime.dirty = false
  emit('save.written', { bytes: text.length })
  return true
}

export function load(): GameState | null {
  let text: string | null = null
  try {
    text = resolveStorage().getItem(STORAGE_KEY)
  } catch {
    text = null
  }
  if (text === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    emit('save.corrupt', { reason: 'kein gueltiges JSON' })
    return null
  }

  const state = deserialize(parsed)
  if (!state) {
    emit('save.corrupt', { reason: 'unbekannte Fassung oder kaputte Struktur' })
    return null
  }
  return state
}

/** Zeitstempel der letzten Sicherung, ohne den Spielstand zu laden (Offline-Rechnung, E17). */
export function lastSavedAt(): number | null {
  try {
    const text = resolveStorage().getItem(STORAGE_KEY)
    if (text === null) return null
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed)) return null
    const savedAt = parsed['savedAt']
    return typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : null
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    resolveStorage().removeItem(STORAGE_KEY)
  } catch {
    // nichts zu tun
  }
  emit('save.cleared', {})
}

// ---------------------------------------------------------------------------
// Automatische Sicherung
// ---------------------------------------------------------------------------

export type Autosave = {
  /** Aus dem Tick der Hauptschleife aufrufen. */
  tick(): void
  /** Sofort sichern, z. B. nach einem Kauf oder Wellenwechsel. */
  saveNow(): void
  stop(): void
}

/**
 * Sichert alle paar Sekunden Spielzeit und beim Schliessen des Tabs (GDD 16 Abschnitt 8).
 * Der Zeitstempel beim Schliessen ist zugleich der Nullpunkt der Offline-Berechnung.
 *
 * Ereignisgesteuerte Sicherungen (Kauf, Levelaufstieg, Wellenwechsel, Prestige) haengen
 * sich ab E7 an `saveNow()` - die Ereignisse dafuer gibt es in E0 noch nicht.
 */
export function startAutosave(state: GameState, loop: Loop): Autosave {
  const saveNow = (): void => {
    save(state, loop.wallClock())
    state.runtime.lastSaveAt = loop.now()
  }

  const onLeave = (): void => saveNow()
  const onVisibility = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') saveNow()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  return {
    tick() {
      if (!state.runtime.dirty) return
      if (loop.now() - state.runtime.lastSaveAt < AUTOSAVE_INTERVAL_SECONDS) return
      saveNow()
    },
    saveNow,
    stop() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', onLeave)
        window.removeEventListener('pagehide', onLeave)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Lesehilfen
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Die Wellenrekorde je Liga (`run.waveRecords`).
 *
 * Ein unbrauchbarer Eintrag wird auf `START_WAVE` gesetzt statt ausgelassen: Die Liste ist
 * **positionsgebunden** - Index `liga - 1` -, und ein ausgelassener Eintrag verschoebe alle
 * dahinter um eine Liga. Dieselbe Ueberlegung, aus der die Muenzenliste umgekehrt verfaehrt
 * (dort ist die Position bedeutungslos, also faellt eine kaputte Muenze weg).
 */
function readWaveRecords(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length === 0) return [...fallback]
  return value.map((entry) =>
    typeof entry === 'number' && Number.isFinite(entry) && entry >= START_WAVE
      ? Math.floor(entry)
      : START_WAVE,
  )
}

function readNumberRecord(value: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!isRecord(value)) return { ...fallback }
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry)) result[key] = entry
  }
  return result
}
