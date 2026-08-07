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
  START_CORE_ID,
  START_INVENTORY,
  START_TOWER_SLOTS,
} from '../data/balance.ts'
import type { Loop } from '../core/loop.ts'
import { isKnownTower } from '../data/towers.ts'
import { isKnownTrait } from '../data/traits.ts'
import type { Coin } from '../sim/economy.ts'
import { isValidOffer } from '../sim/shop.ts'
import type { Coin } from '../sim/economy.ts'
  newModule,
  sanitizeStation,
  type ModuleInstance,
  sanitizeStation,
} from '../sim/station.ts'
  type Station,
} from '../sim/station.ts'
  createInitialRun,
  createInitialPermanent,
  createInitialRun,
  createInitialStation,
  type GameState,
  type PermanentState,
  type GameState,
  type PermanentState,
  type RunState,
} from './state.ts'
 * Version 2 (E2): Hauptturm und Module wurden zur `station` zusammengefasst.
 * Version 3 (E7/E9): liegende Muenzen und der Auto-Wellen-Modus kamen dazu.
 * Version 2 (E2): Hauptturm und Module wurden zur `station` zusammengefasst.
 * Version 3 (E7/E9): liegende Muenzen und der Auto-Wellen-Modus kamen dazu.
 * Version 4 (E10/E11): das offene Perk-Angebot sowie freigeschaltete und belegte
 *   Faehigkeiten kamen dazu.
 * Version 5 (E12/E13): Turm-Eigenschaften je Exemplar, Kaufzaehler und Turmangebot,
 * Platzierung als Tripel, gerundet auf drei Nachkommastellen. Am Prototyp bestaetigt:
 * 11 Module plus Inventar ergeben rund 1,4 KB, und die Rundung liegt Groessenordnungen
 * unter der Kantentoleranz - eine gemeinsame Kante kann dadurch nicht zerreissen.
export const STORAGE_KEY = 'wavebreaker.save'
export type SavedModule = {
  uid: string
 * Platzierung als Tripel, gerundet auf drei Nachkommastellen. Am Prototyp bestaetigt:
 * 11 Module plus Inventar ergeben rund 1,4 KB, und die Rundung liegt Groessenordnungen
 * unter der Kantentoleranz - eine gemeinsame Kante kann dadurch nicht zerreissen.
 */
export type SavedModule = {
export type SavedStation = {
  coreId: string
  rarity: string
  /** Eigenschaften dieses Exemplars (GDD 06 Abschnitt 10) - nur die Kennungen. */
  modules: SavedModule[]
  placement: [number, number, number] | null
}
export type SavedRun = Omit<RunState, 'station'> & { station: SavedStation }
export type SavedStation = {
export type SaveData = {
  version: number
  /** Echte Uhrzeit in Millisekunden - Grundlage der Offline-Berechnung (E17). */
  modules: SavedModule[]
  permanent: PermanentState
  run: SavedRun
export type SavedRun = Omit<RunState, 'station'> & { station: SavedStation }

/** Weiter als das Spielfeld je reicht - schuetzt vor manipulierten Koordinaten. */
const MAX_COORDINATE = 100_000
  /** Echte Uhrzeit in Millisekunden - Grundlage der Offline-Berechnung (E17). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
  run: SavedRun
}
function saveStation(station: Station): SavedStation {
/** Weiter als das Spielfeld je reicht - schuetzt vor manipulierten Koordinaten. */
  for (const module of [...station.placed, ...station.inventory]) {
    modules.push({
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
      rarity: module.rarity,
      placement: module.placement
function saveStation(station: Station): SavedStation {
            round3(module.placement.center.x),
  for (const module of [...station.placed, ...station.inventory]) {
            round3(module.placement.rotation),
      uid: module.uid,
      defId: module.defId,
      rarity: module.rarity,
      traits: [...module.traits],
  return { coreId: station.coreId, slots: station.slots, nextUid: station.nextUid, modules }
        ? [
            round3(module.placement.center.x),
            round3(module.placement.center.y),
 * Module, die es nicht mehr gibt oder deren Werte unbrauchbar sind, werden ausgelassen
 * statt den ganzen Spielstand zu verwerfen. Anschliessend raeumt `sanitizeStation` die
 * Folgen auf - etwa Module, die dadurch den Anschluss verloren haben.
    })
function readStation(raw: unknown): Station {
  return { coreId: station.coreId, slots: station.slots, nextUid: station.nextUid, modules }
  // Spiel - nicht etwa eine leere. Eine leere `modules`-Liste dagegen ist ein gueltiger
  // Zustand und bleibt unangetastet.
  if (!isRecord(raw)) return createInitialStation()
 * Module, die es nicht mehr gibt oder deren Werte unbrauchbar sind, werden ausgelassen
 * statt den ganzen Spielstand zu verwerfen. Anschliessend raeumt `sanitizeStation` die
  const slots = Math.max(0, Math.floor(readNumber(raw['slots'], START_TOWER_SLOTS)))
  const station = createStation(coreId, slots)
  station.nextUid = Math.max(1, Math.floor(readNumber(raw['nextUid'], 1)))
  // Fehlt der Block ganz, bekommt der Spieler dieselbe Station wie bei einem frischen
  // Spiel - nicht etwa eine leere. Eine leere `modules`-Liste dagegen ist ein gueltiger
  // Zustand und bleibt unangetastet.
  if (!isRecord(raw)) return createInitialStation()
    if (!module) continue
  const coreId = readString(raw['coreId'], START_CORE_ID)
  const slots = Math.max(0, Math.floor(readNumber(raw['slots'], START_TOWER_SLOTS)))
  const station = createStation(coreId, slots)
  station.nextUid = Math.max(1, Math.floor(readNumber(raw['nextUid'], 1)))
  sanitizeStation(station)
  const modules = Array.isArray(raw['modules']) ? raw['modules'] : []
  for (const entry of modules) {
    const module = readModule(entry)
function readModule(raw: unknown): ModuleInstance | null {
    if (module.placement) station.placed.push(module)
    else station.inventory.push(module)
  const uid = raw['uid']
  const defId = raw['defId']
  const rarity = raw['rarity']
  if (typeof uid !== 'string' || uid.length === 0) return null
  if (typeof defId !== 'string' || !isKnownTower(defId)) return null
  if (!isRarity(rarity)) return null
function readModule(raw: unknown): ModuleInstance | null {
  const placement = raw['placement']
  if (placement === null || placement === undefined) {
    return { uid, defId, rarity, placement: null }
  const defId = raw['defId']
  const rarity = raw['rarity']
  if (!Array.isArray(placement) || placement.length !== 3) return null
  if (typeof defId !== 'string' || !isKnownTower(defId)) return null
  for (const value of [cx, cy, rot]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
  // Unbekannte Eigenschaften werden ausgelassen statt den Turm zu verwerfen: Ein Datensatz
  if (Math.abs(cx as number) > MAX_COORDINATE || Math.abs(cy as number) > MAX_COORDINATE) {
  const traits = readStringArray(raw['traits'], []).filter(isKnownTrait)
  }
  const placement = raw['placement']
  if (placement === null || placement === undefined) {
    return { uid, defId, rarity, traits, placement: null }
    defId,
    rarity,
    placement: { center: { x: cx as number, y: cy as number }, rotation: rot as number },
  const [cx, cy, rot] = placement
  for (const value of [cx, cy, rot]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
// ---------------------------------------------------------------------------
  if (Math.abs(cx as number) > MAX_COORDINATE || Math.abs(cy as number) > MAX_COORDINATE) {
// ---------------------------------------------------------------------------
  }
export type SaveStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
    rarity,
    traits,
    placement: { center: { x: cx as number, y: cy as number }, rotation: rot as number },
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
// ---------------------------------------------------------------------------
    removeItem: (key) => void map.delete(key),
// ---------------------------------------------------------------------------
}
export type SaveStorage = {
let storage: SaveStorage | null = null
  setItem(key: string, value: string): void
function resolveStorage(): SaveStorage {
  if (storage) return storage
  try {
    if (typeof localStorage !== 'undefined') {
      // Probeschreiben: im privaten Modus existiert localStorage, wirft aber beim Schreiben.
      localStorage.setItem('wavebreaker.probe', '1')
      localStorage.removeItem('wavebreaker.probe')
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    }
  } catch {
    // faellt unten auf den Speicher im Arbeitsspeicher zurueck
let storage: SaveStorage | null = null
  storage = createMemoryStorage()
function resolveStorage(): SaveStorage {
  if (storage) return storage
  try {
/** Ablage ersetzen - fuer Selbsttests und den headless-Lauf. */
      // Probeschreiben: im privaten Modus existiert localStorage, wirft aber beim Schreiben.
      localStorage.setItem('wavebreaker.probe', '1')
      localStorage.removeItem('wavebreaker.probe')
      storage = localStorage
// ---------------------------------------------------------------------------
// Serialisieren und Pruefen
// ---------------------------------------------------------------------------
    // faellt unten auf den Speicher im Arbeitsspeicher zurueck
export function serialize(state: GameState, nowMs: number): SaveData {
  storage = createMemoryStorage()
  return storage
    version: SAVE_VERSION,
    savedAt: nowMs,
/** Ablage ersetzen - fuer Selbsttests und den headless-Lauf. */
export function setStorage(next: SaveStorage | null): void {
      prestigeNodes: [...state.permanent.prestigeNodes],
      unlockedTowers: [...state.permanent.unlockedTowers],
      unlockedCores: [...state.permanent.unlockedCores],
// ---------------------------------------------------------------------------
      bestWaveEver: state.permanent.bestWaveEver,
// ---------------------------------------------------------------------------
      totalPlaySeconds: state.permanent.totalPlaySeconds,
export function serialize(state: GameState, nowMs: number): SaveData {
  syncRngState(state)
      seed: state.run.seed,
      rngState: state.run.rngState,
      station: saveStation(state.run.station),
      wave: state.run.wave,
      prestigePoints: state.permanent.prestigePoints,
      prestigeNodes: [...state.permanent.prestigeNodes],
      unlockedTowers: [...state.permanent.unlockedTowers],
      unlockedCores: [...state.permanent.unlockedCores],
      seenHints: [...state.permanent.seenHints],
      bestWaveEver: state.permanent.bestWaveEver,
      prestigeCount: state.permanent.prestigeCount,
      totalPlaySeconds: state.permanent.totalPlaySeconds,
      level: state.run.level,
      xp: state.run.xp,
      abilitySlots: state.run.abilitySlots,
      rngState: state.run.rngState,
      station: saveStation(state.run.station),
      autoWaves: state.run.autoWaves,
      waveRecord: state.run.waveRecord,
      gold: state.run.gold,
      goldEarned: state.run.goldEarned,
      towersBought: state.run.towersBought,
export function deserialize(data: unknown): GameState | null {
  if (!isRecord(data)) return null
        rarity: offer.rarity,
        traits: [...offer.traits],
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null
  // Ein Spielstand aus einer neueren Fassung wird nicht geraten, sondern abgelehnt.
  if (version > SAVE_VERSION) return null
        y: round3(coin.y),
  const migrated = version === SAVE_VERSION ? data : migrate(data, version)
  if (!migrated) return null
      })),
  if (!isRecord(migrated['permanent']) || !isRecord(migrated['run'])) return null
      xp: state.run.xp,
  const permanent = readPermanent(migrated['permanent'])
  const run = readRun(migrated['run'])
      perkOffer: [...state.run.perkOffer],
  return { permanent, run, runtime: createRuntime(run) }
      equipped: [...state.run.equipped],
      upgrades: { ...state.run.upgrades },
      autoWaves: state.run.autoWaves,
 * Fehlende oder kaputte Einzelfelder werden mit dem Startwert aufgefuellt, statt den
 * ganzen Spielstand zu verwerfen. Die Migrationskette bleibt trotzdem Pflicht - sie ist
 * der geplante Weg, das hier ist nur das Netz darunter.
 */
function readPermanent(raw: Record<string, unknown>): PermanentState {
  const base = createInitialPermanent()
  return {
    prestigePoints: readNumber(raw['prestigePoints'], base.prestigePoints),
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null
  // Ein Spielstand aus einer neueren Fassung wird nicht geraten, sondern abgelehnt.
    unlockedCores: readStringArray(raw['unlockedCores'], base.unlockedCores),
    seenHints: readStringArray(raw['seenHints'], base.seenHints),
  const migrated = version === SAVE_VERSION ? data : migrate(data, version)
    prestigeCount: readNumber(raw['prestigeCount'], base.prestigeCount),
    totalPlaySeconds: readNumber(raw['totalPlaySeconds'], base.totalPlaySeconds),
  if (!isRecord(migrated['permanent']) || !isRecord(migrated['run'])) return null
}
  const permanent = readPermanent(migrated['permanent'])
function readRun(raw: Record<string, unknown>): RunState {
  const base = createInitialRun(readNumber(raw['seed'], 1))
  return { permanent, run, runtime: createRuntime(run) }
    seed: base.seed,
    rngState: readNumber(raw['rngState'], base.rngState),
    station: readStation(raw['station']),
 * Fehlende oder kaputte Einzelfelder werden mit dem Startwert aufgefuellt, statt den
 * ganzen Spielstand zu verwerfen. Die Migrationskette bleibt trotzdem Pflicht - sie ist
 * der geplante Weg, das hier ist nur das Netz darunter.
    coins: readCoins(raw['coins']),
function readPermanent(raw: Record<string, unknown>): PermanentState {
    xp: readNumber(raw['xp'], base.xp),
    abilitySlots: readNumber(raw['abilitySlots'], base.abilitySlots),
    prestigePoints: readNumber(raw['prestigePoints'], base.prestigePoints),
    prestigeNodes: readStringArray(raw['prestigeNodes'], base.prestigeNodes),
    autoWaves: typeof raw['autoWaves'] === 'boolean' ? raw['autoWaves'] : base.autoWaves,
    unlockedCores: readStringArray(raw['unlockedCores'], base.unlockedCores),
    seenHints: readStringArray(raw['seenHints'], base.seenHints),
    bestWaveEver: readNumber(raw['bestWaveEver'], base.bestWaveEver),
/** Eine unbrauchbare Muenze wird ausgelassen - der Rest des Goldes bleibt liegen. */
    totalPlaySeconds: readNumber(raw['totalPlaySeconds'], base.totalPlaySeconds),
  if (!Array.isArray(raw)) return []
}
  const coins: Coin[] = []
function readRun(raw: Record<string, unknown>): RunState {
  const base = createInitialRun(readNumber(raw['seed'], 1))
    const x = entry['x']
    const y = entry['y']
    rngState: readNumber(raw['rngState'], base.rngState),
    if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > MAX_COORDINATE) continue
    if (typeof y !== 'number' || !Number.isFinite(y) || Math.abs(y) > MAX_COORDINATE) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    gold: readNumber(raw['gold'], base.gold),
    goldEarned: readNumber(raw['goldEarned'], base.goldEarned),
    coins.push({ x, y, value, count: typeof count === 'number' && count >= 1 ? count : 1 })
    towerOffer: Array.isArray(raw['towerOffer'])
      ? raw['towerOffer'].filter(isValidOffer).map((offer) => ({ ...offer, traits: [...offer.traits] }))
      : base.towerOffer,
    coins: readCoins(raw['coins']),
// ---------------------------------------------------------------------------
    xp: readNumber(raw['xp'], base.xp),
// ---------------------------------------------------------------------------
    perks: readStringArray(raw['perks'], base.perks),
type Migration = (data: Record<string, unknown>) => Record<string, unknown>
    abilities: readStringArray(raw['abilities'], base.abilities),
    equipped: readStringArray(raw['equipped'], base.equipped),
 * Schluessel `n` fuehrt von Version `n` auf `n + 1`. Immer Schritt fuer Schritt, nie
    autoWaves: typeof raw['autoWaves'] === 'boolean' ? raw['autoWaves'] : base.autoWaves,
 */
const MIGRATIONS: Record<number, Migration> = {
  /**
   * 1 -> 2 (E2): `coreId` und `towerSlots` lagen frueher direkt in den Run-Daten. Sie
   * gehoeren zur Station, die es in Version 1 noch nicht gab. Ein Spielstand aus E0/E1
   * hat noch keine Module, also entsteht eine leere Station mit dem Startinventar.
   */
  const coins: Coin[] = []
    const run = isRecord(data['run']) ? data['run'] : {}
    const station = createStation(
      readString(run['coreId'], START_CORE_ID),
      readNumber(run['towerSlots'], START_TOWER_SLOTS),
    const value = entry['value']
    if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > MAX_COORDINATE) continue
    if (typeof y !== 'number' || !Number.isFinite(y) || Math.abs(y) > MAX_COORDINATE) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
      station.inventory.push(newModule(station, entry.defId, entry.rarity))
    const count = entry['count']
    coins.push({ x, y, value, count: typeof count === 'number' && count >= 1 ? count : 1 })
    delete migrated['coreId']
    delete migrated['towerSlots']
    return { ...data, run: migrated }
  },
// ---------------------------------------------------------------------------
// Migration
   * 2 -> 3 (E7/E9): Liegende Muenzen und der Auto-Wellen-Modus. Ein alter Spielstand
   * hatte beides noch nicht - er startet ohne Muenzen und mit eingeschaltetem Auto-Modus,
type Migration = (data: Record<string, unknown>) => Record<string, unknown>
   */
  2: (data) => {
 * Schluessel `n` fuehrt von Version `n` auf `n + 1`. Immer Schritt fuer Schritt, nie
    return { ...data, run: { ...run, coins: [], autoWaves: true } }
  },
const MIGRATIONS: Record<number, Migration> = {
  /**
export function migrate(data: Record<string, unknown>, fromVersion: number): SaveData | null {
   * gehoeren zur Station, die es in Version 1 noch nicht gab. Ein Spielstand aus E0/E1
   * hat noch keine Module, also entsteht eine leere Station mit dem Startinventar.
    const step = MIGRATIONS[v]
    if (!step) return null
    const run = isRecord(data['run']) ? data['run'] : {}
    const station = createStation(
      readString(run['coreId'], START_CORE_ID),
      readNumber(run['towerSlots'], START_TOWER_SLOTS),
    )
    // Dieselben Startmodule wie ein frisches Spiel - sonst stuende ein alter Spielstand
/** Fuer den Selbsttest: ist die Kette von Version 1 bis heute lueckenlos? */
export function migrationChainComplete(): boolean {
      station.inventory.push(newModule(station, entry.defId, entry.rarity))
    if (!MIGRATIONS[v]) return false
    const migrated: Record<string, unknown> = { ...run, station: saveStation(station) }
    delete migrated['coreId']
    delete migrated['towerSlots']
    return { ...data, run: migrated }
// ---------------------------------------------------------------------------
// localStorage
// ---------------------------------------------------------------------------
   * 2 -> 3 (E7/E9): Liegende Muenzen und der Auto-Wellen-Modus. Ein alter Spielstand
   * hatte beides noch nicht - er startet ohne Muenzen und mit eingeschaltetem Auto-Modus,
  const data = serialize(state, nowMs)
  const text = JSON.stringify(data)
  2: (data) => {
    const run = isRecord(data['run']) ? data['run'] : {}
    return { ...data, run: { ...run, coins: [], autoWaves: true } }
    // Speicher voll oder gesperrt - das Spiel laeuft weiter, nur ohne Sicherung.
    return false
  /**
   * 3 -> 4 (E10/E11): Perk-Angebot und Faehigkeiten.
  emit('save.written', { bytes: text.length })
   * Alle drei Listen starten leer. Das Angebot wird beim naechsten offenen Aufstieg neu
   * gezogen; Erfahrung und Stufe standen schon vorher im Spielstand, ein alter Spielstand
   * behaelt also seinen Fortschritt und bekommt seine faelligen Auswahlen sofort angeboten.
export function load(): GameState | null {
  let text: string | null = null
    const run = isRecord(data['run']) ? data['run'] : {}
    return { ...data, run: { ...run, perkOffer: [], abilities: [], equipped: [] } }
  } catch {
    text = null
  /**
   * 4 -> 5 (E12/E13): Eigenschaften, Kaufzaehler und verdientes Gold.
   *
   * Bestehende Tuerme bekommen **keine** Eigenschaften nachtraeglich zugewuerfelt: Sie sind
   * vor der Freischaltung entstanden, und ein Turm, der sich beim Laden veraendert, waere
   * eine unangenehme Ueberraschung.
  } catch {
   * `goldEarned` wird aus dem aktuellen Kontostand geschaetzt - genauer geht es nicht, die
   * Zahl gab es vorher nicht. Sie faellt damit zu niedrig aus, wenn schon etwas ausgegeben
   * wurde; das ist die richtige Richtung, denn so verschenkt niemand ein Prestige, das er
   * sich nicht erspielt hat.
  const state = deserialize(parsed)
  4: (data) => {
    emit('save.corrupt', { reason: 'unbekannte Fassung oder kaputte Struktur' })
    return null
      ...data,
  return state
        ...run,
        goldEarned: readNumber(run['gold'], 0),
/** Zeitstempel der letzten Sicherung, ohne den Spielstand zu laden (Offline-Rechnung, E17). */
export function lastSavedAt(): number | null {
      },
    const text = resolveStorage().getItem(STORAGE_KEY)
    if (text === null) return null
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed)) return null
export function migrate(data: Record<string, unknown>, fromVersion: number): SaveData | null {
    return typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : null
  for (let v = fromVersion; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) return null
    current = step(current)
    current['version'] = v + 1
export function clearSave(): void {
  return current as unknown as SaveData
    resolveStorage().removeItem(STORAGE_KEY)
  } catch {
/** Fuer den Selbsttest: ist die Kette von Version 1 bis heute lueckenlos? */
export function migrationChainComplete(): boolean {
  for (let v = 1; v < SAVE_VERSION; v++) {
    if (!MIGRATIONS[v]) return false
  }
// ---------------------------------------------------------------------------
// Automatische Sicherung
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
export type Autosave = {
// ---------------------------------------------------------------------------
  tick(): void
  /** Sofort sichern, z. B. nach einem Kauf oder Wellenwechsel. */
  const data = serialize(state, nowMs)
  const text = JSON.stringify(data)
  try {
    resolveStorage().setItem(STORAGE_KEY, text)
  } catch {
 * Sichert alle paar Sekunden Spielzeit und beim Schliessen des Tabs (GDD 16 Abschnitt 8).
 * Der Zeitstempel beim Schliessen ist zugleich der Nullpunkt der Offline-Berechnung.
  }
 * Ereignisgesteuerte Sicherungen (Kauf, Levelaufstieg, Wellenwechsel, Prestige) haengen
 * sich ab E7 an `saveNow()` - die Ereignisse dafuer gibt es in E0 noch nicht.
  return true
export function startAutosave(state: GameState, loop: Loop): Autosave {
  const saveNow = (): void => {
export function load(): GameState | null {
    state.runtime.lastSaveAt = loop.now()
  try {
    text = resolveStorage().getItem(STORAGE_KEY)
  const onLeave = (): void => saveNow()
  const onVisibility = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') saveNow()
  if (text === null) return null

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onLeave)
    window.addEventListener('pagehide', onLeave)
  } catch {
    emit('save.corrupt', { reason: 'kein gueltiges JSON' })
    document.addEventListener('visibilitychange', onVisibility)
  }

  const state = deserialize(parsed)
  if (!state) {
    emit('save.corrupt', { reason: 'unbekannte Fassung oder kaputte Struktur' })
      if (loop.now() - state.runtime.lastSaveAt < AUTOSAVE_INTERVAL_SECONDS) return
      saveNow()
  return state
    saveNow,
    stop() {
/** Zeitstempel der letzten Sicherung, ohne den Spielstand zu laden (Offline-Rechnung, E17). */
        window.removeEventListener('beforeunload', onLeave)
        window.removeEventListener('pagehide', onLeave)
    const text = resolveStorage().getItem(STORAGE_KEY)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
    if (!isRecord(parsed)) return null
    const savedAt = parsed['savedAt']
    return typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : null
  } catch {
    return null
// ---------------------------------------------------------------------------
// Lesehilfen
// ---------------------------------------------------------------------------
export function clearSave(): void {
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
  } catch {
    // nichts zu tun
function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

// ---------------------------------------------------------------------------
  return typeof value === 'string' ? value : fallback
// ---------------------------------------------------------------------------

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  return value.filter((entry): entry is string => typeof entry === 'string')
  /** Sofort sichern, z. B. nach einem Kauf oder Wellenwechsel. */
  saveNow(): void
function readNumberRecord(value: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!isRecord(value)) return { ...fallback }
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value)) {
 * Sichert alle paar Sekunden Spielzeit und beim Schliessen des Tabs (GDD 16 Abschnitt 8).
 * Der Zeitstempel beim Schliessen ist zugleich der Nullpunkt der Offline-Berechnung.
  return result
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

function readNumberRecord(value: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!isRecord(value)) return { ...fallback }
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'number' && Number.isFinite(entry)) result[key] = entry
  }
  return result
}

