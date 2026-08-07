/**
 * Schaden, Tod und der Zustand eines Gefechts.
 *
 * Die Station hat **eine gemeinsame Lebensleiste** (GDD 03 Abschnitt 5): Es gibt keine
 * HP je Modul, kein Modul kann zerstoert werden, und jeder Treffer geht auf dieselbe
 * Leiste - unabhaengig davon, wo er ankam.
 *
 * Diese Datei importiert bewusst nur nach unten (`enemies`, `station`, `data`). Die
 * Orchestrierung eines Ticks steht in `sim/battle.ts`, damit hier kein Kreis entsteht.
 */

import { emit } from '../core/events.ts'
import type { Vec2 } from '../core/vec.ts'
import { BASE_STATION_HP, CRIT_MULTIPLIER, ENEMY_ATTACK_INTERVAL } from '../data/balance.ts'
import { grantReward } from '../app/rewards.ts'
import type { GameState } from '../app/state.ts'
import type { BuffResult } from './buffs.ts'
import { eliteById, enemyById } from '../data/enemies.ts'
import type { StatKey } from '../data/types.ts'
import { dropGold, goldValueFor } from './economy.ts'
import { releaseEnemy, type Enemy } from './enemies.ts'
import { maybeDropPod } from './events.ts'
import type { Drone } from './drones.ts'
import type { Projectile } from './projectiles.ts'
import type { PlacedModule } from './station.ts'
import { globalMultiplier } from './stats.ts'
// Nur der Typ - `towers` bindet `combat` ein, ein Wert von dort waere ein Kreis.
import type { RangeCircle } from './towers.ts'
import type { WavePlan } from './waves.ts'

/**
 * Kurzes Aufblitzen am Trefferort (GDD 13 Abschnitt 4).
 *
 * `life` steht in Simulationssekunden und traegt bereits das Spieltempo: Bei x4 laeuft die
 * Simulation viermal so schnell, also muss der Blitz viermal so lange Simulationszeit
 * brennen, um gleich lange zu leuchten.
 */
export type Hit = { pos: Vec2; age: number; life: number; kind: 'enemy' | 'station'; crit: boolean }

/** Lebensdauer eines Trefferblitzes bei Tempo x1, in Sekunden. */
export const HIT_LIFE = 0.35

/**
 * Lebensdauer eines Effekts in Simulationssekunden - gedehnt um das eingestellte Tempo.
 * Damit dauert jeder Effekt in **echter** Zeit immer gleich lang.
 */
function effectLife(state: GameState, base: number): number {
  return base * Math.max(1, state.runtime.speedFactor)
}

/**
 * Muendungsfeuer am schiessenden Modul. Reine Anzeige - der Schuss selbst steckt im
 * Geschoss.
 *
 * Fester Vorrat, der reihum ueberschrieben wird: Bei hohem Angriffstempo und mehreren
 * Tuermen darf kein Speicher je Schuss entstehen, und aelteste Blitze duerfen ohne
 * Aufraeumen verfallen.
 */
export type Muzzle = {
  pos: Vec2
  angle: number
  age: number
  life: number
  color: string
  active: boolean
}

/**
 * Rueckstoss eines Moduls. Ein Eintrag je Modul, der ueberschrieben statt neu angelegt
 * wird. `sinceFlash` duennt die Blitze aus: Bei Tempo x4 faellt jeder Tick viermal so oft
 * an, und ohne diese Sperre blitzte es viermal so schnell statt gleich schnell.
 */
export type Recoil = { angle: number; age: number; life: number; sinceFlash: number }

/**
 * Ein eben gesetztes Modul (GDD 13 Abschnitt 10: "Platzieren von Modulen").
 *
 * Es traegt nur sein Alter - was daraus wird, entscheidet die Zeichenebene. Ein Eintrag je
 * Modul, der verfaellt, sobald er ausgelaufen ist: Anders als beim Rueckstoss gibt es hier
 * nie viele gleichzeitig, weil man Module einzeln setzt.
 */
export type Placing = { age: number; life: number }

/** Wie lange ein Modul beim Andocken einrastet, bei Tempo x1. */
export const PLACING_LIFE = 0.42

/**
 * Woraus ein Splitter besteht. `muenze` traegt keine eigene Farbe - die holt sich die
 * Zeichenebene aus der Palette, weil die Simulation nur Farben kennt, die von einem
 * Gegner oder einem Turm stammen.
 */
export type ShardKind = 'truemmer' | 'muenze'

/**
 * Splitter eines zerfallenden Gegners.
 *
 * Truemmer tragen die Farbe ihres Gegners: Ein zerplatzter Schwarm sieht anders aus als
 * ein gefallener Boss, ohne dass irgendwo ein Text steht (GDD 07 Abschnitt 3).
 */
export type Shard = {
  pos: Vec2
  vel: Vec2
  age: number
  life: number
  radius: number
  color: string
  kind: ShardKind
  active: boolean
}

/**
 * Eine eingesammelte Muenze auf dem Weg zum Zeiger.
 *
 * Sie ist zum Zeitpunkt des Einsammelns bereits aus dem Spielstand verschwunden - der Flug
 * ist reine Nachschau und darf deshalb nichts mehr verrechnen.
 */
export type Pickup = {
  from: Vec2
  to: Vec2
  age: number
  life: number
  active: boolean
}

/**
 * Zucken der Station nach einem Treffer.
 *
 * Ein einziger Wert fuer die ganze Station - passend zur einen gemeinsamen Lebensleiste
 * (GDD 03 Abschnitt 5). Ein neuer Treffer setzt ihn zurueck, statt einen zweiten Zucker
 * daneben zu legen: Bei angedockten Gegnern schlaegt es sonst im Dauertakt.
 */
export type StationFlash = { age: number; life: number; active: boolean }

/** Wie lange das Leuchten des Kerns nach einem Treffer nachzittert, bei Tempo x1. */
export const STATION_FLASH_LIFE = 0.3

/** Dauer eines Bisses, bei Tempo x1. Kuerzer als der Schlagabstand, sonst kaut es durch. */
export const BITE_LIFE = 0.34

/**
 * Aufsteigende Zahl beim Einsammeln.
 *
 * Sie traegt nur den Betrag - den Text baut die Zeichenebene, weil jeder Spielertext aus
 * `data/strings.ts` kommen muss (GDD 16 Abschnitt 1).
 */
export type Gain = { pos: Vec2; value: number; age: number; life: number; active: boolean }

/**
 * Ein Laserstrahl (GDD 05: Laser-Turm).
 *
 * Reine Anzeige - der Schaden ist im selben Augenblick schon angekommen. Er lebt einen
 * Wimpernschlag, weil ein Dauerstrahl bei sechs Schuessen je Sekunde ohnehin als
 * durchgehende Linie erscheint.
 */
export type Beam = { from: Vec2; to: Vec2; age: number; life: number; color: string; active: boolean }

/** Druckwelle am Ort des Todes - ein Ring, der einmal kurz aufgeht. */
export type Burst = {
  pos: Vec2
  age: number
  life: number
  radius: number
  color: string
  active: boolean
}

/** So viele Muendungsfeuer koennen gleichzeitig brennen. Darueber verfaellt das aelteste. */
const MUZZLE_SLOTS = 32
/**
 * Vorrat an Splittern und Druckwellen. Beides sind Ringspeicher: Bei einer Welle mit 200
 * Gegnern darf kein Speicher je Tod entstehen, und der aelteste Splitter darf ohne
 * Aufraeumen verfallen.
 */
const SHARD_SLOTS = 72
const BURST_SLOTS = 16
const PICKUP_SLOTS = 24
const GAIN_SLOTS = 12
export const GAIN_LIFE = 0.85
/**
 * Kommt innerhalb dieser Zeit weiteres Gold dazu, waechst die letzte Zahl weiter, statt
 * dass eine zweite daneben steht. Wer den Zeiger ueber ein Feld voller Muenzen zieht,
 * sieht sonst ein Dutzend Zahlen uebereinander statt einer, die hochlaeuft.
 */
const GAIN_MERGE_WINDOW = 0.25
export const SHARD_LIFE = 0.42
export const BURST_LIFE = 0.26
/** Goldfunken laufen laenger aus als Splitter - sie sollen ausrollen, nicht zerstieben. */
export const SPILL_LIFE = 0.55
export const PICKUP_LIFE = 0.3
/** Wie schnell Splitter auslaufen. Groesser = kuerzerer Flug. */
const SHARD_DRAG = 3.4
/** Kuerzester Abstand zwischen zwei Blitzen desselben Moduls, in Sekunden. */
const MUZZLE_INTERVAL = 0.05
export const MUZZLE_LIFE = 0.09
export const RECOIL_LIFE = 0.14

/** Laserstrahlen: gleich viele Plaetze wie Muendungsfeuer, und ebenso kurzlebig. */
const BEAM_SLOTS = 32
export const BEAM_LIFE = 0.1

export type CombatPhase = 'pause' | 'running'

export type CombatState = {
  phase: CombatPhase
  /** In der Pause die Restzeit, in der Welle die verstrichene Zeit - beides in Sekunden. */
  timer: number
  plan: WavePlan | null
  /** Wie viele Eintraege des Plans bereits erschienen sind. */
  spawnIndex: number

  enemies: Enemy[]
  enemyPool: Enemy[]
  projectiles: Projectile[]
  projectilePool: Projectile[]
  /** Restliche Nachladezeit je Modul, in Sekunden. */
  cooldowns: Map<string, number>

  stationHp: number
  maxStationHp: number

  /**
   * Geometrie der Station fuer diesen Tick. Wird einmal je Tick gesetzt, statt in jeder
   * Funktion neu berechnet - bei 200 Gegnern waere das sonst der teuerste Posten.
   */
  modules: PlacedModule[]
  buffs: Map<string, BuffResult>
  /**
   * Die Wirkungskreise dieses Ticks - einer je Modul, das wirklich schiesst.
   *
   * Sie stehen als **fertige Liste** hier, weil `sim/enemies.ts` sie fuer das Anmarschtempo
   * braucht (GDD 07 Abschnitt 2) und die Tuerme nicht kennen darf: `sim/towers.ts` bindet
   * `enemies` ein, umgekehrt entstuende ein Kreis. `sim/battle.ts` fuellt sie je Tick, alle
   * anderen lesen nur - dieselbe Bauart wie `enemySpeedFactor`.
   *
   * Leer heisst "kein Turm deckt irgendetwas ab", nicht "noch nicht berechnet". Wer
   * `stepEnemies` ausserhalb von `stepBattle` aufruft, bekommt deshalb ungedeckte Gegner -
   * und damit genau das, was die leere Liste behauptet.
   */
  coverage: RangeCircle[]
  hits: Hit[]
  /** Fester Vorrat an Muendungsfeuern; `active` sagt, welche gerade brennen. */
  muzzles: Muzzle[]
  /** Naechster Platz, der ueberschrieben wird. */
  muzzleCursor: number
  /** Rueckstoss je Modul. Eintraege verfallen, sobald der Stoss ausgelaufen ist. */
  recoils: Map<string, Recoil>
  /** Eben gesetzte Module. Wie der Rueckstoss: Eintraege verfallen von selbst. */
  placings: Map<string, Placing>
  /** Fester Vorrat an Splittern und Druckwellen samt Schreibzeiger. */
  shards: Shard[]
  shardCursor: number
  bursts: Burst[]
  burstCursor: number
  /** Muenzen auf dem Weg zum Zeiger. */
  pickups: Pickup[]
  pickupCursor: number
  /** Aufsteigende Betraege beim Einsammeln. */
  gains: Gain[]
  gainCursor: number
  /** Nachzittern des Kerns nach einem Treffer auf die Station. */
  stationFlash: StationFlash
  nextId: number

  killsThisWave: number
  /** Wie oft die aktuelle Welle bereits verloren ging. Nur Anzeige. */
  lostAttempts: number
  /** Kennung des aktiven Bosses, falls einer lebt - fuer die eigene Leiste im HUD. */
  bossId: number | null

  /*
   * Wirkung der laufenden Faehigkeiten, je Takt von `sim/abilities.ts` neu gesetzt.
   *
   * Sie stehen als **fertige Zahlen** hier und nicht als Aufruf dort, damit die Abhaengigkeit
   * einseitig bleibt: `abilities` schreibt, Kampf und Werte lesen. Wuerde `damageStation`
   * bei den Faehigkeiten nachfragen, entstuende ein Kreis - und Kreise sind in diesem
   * Projekt die Stelle, an der die Reihenfolge unauffindbar wird.
   */

  /**
   * Kampfdrohnen (GDD 05). **Abgeleitet**, nicht gespeichert: `stepDrones` zieht sie je
   * Takt mit den vorhandenen Drohnenmodulen gleich. Deshalb kann ein Umbau mitten im Kampf
   * hier nichts kaputt machen.
   */
  drones: Drone[]
  /** Fester Vorrat an Laserstrahlen samt Schreibzeiger - wie Muendungsfeuer. */
  beams: Beam[]
  beamCursor: number

  /** Additive Boni auf Kampfwerte aller Module. */
  abilityBonus: Partial<Record<StatKey, number>>
  /** Anteil des Stationsschadens, der abgefangen wird (0 = keiner, 1 = aller). */
  damageReduction: number
  /** Faktor auf das Tempo aller Gegner. 1 = normal, kleiner = langsamer. */
  enemySpeedFactor: number

  /*
   * Dieselbe Bauart fuer Ereignisse (E16), aber in **eigenen** Feldern.
   *
   * Sie liegen bewusst neben `abilityBonus` und nicht darin: Ein Feld darf nur einen
   * Schreiber haben. Zwei Systeme, die dieselbe Zahl je Takt neu aufbauen, ueberschreiben
   * sich gegenseitig - und welcher gewinnt, haengt dann an der Reihenfolge in `battle.ts`.
   * Getrennt geschrieben, gemeinsam gelesen: `sim/stats.ts` legt beide Faktoren
   * nacheinander auf, so wie Buffs auf Upgrades aufsetzen.
   */

  /** Additive Boni aus laufenden Ereignis-Wirkungen. */
  eventBonus: Partial<Record<StatKey, number>>
  /**
   * Faktor auf Lebenspunkte und Schaden **neu erscheinender** Gegner (GDD 11 Abschnitt 5:
   * "Gegner werden staerker"). 1 = keine Wirkung.
   *
   * Er wirkt beim Erscheinen und nicht laufend: Ein Gegner, dessen Lebenspunkte sich mitten
   * im Kampf aendern, waere fuer den Spieler nicht zu lesen - seine Leiste spraenge.
   */
  enemyPower: number

  /**
   * Sieht gerade jemand zu?
   *
   * `false` heisst: Der Kampf laeuft im Schnelldurchlauf der Abwesenheitsrechnung (E17).
   * Dann entstehen **keine optischen Effekte** - keine Splitter, keine Druckwellen, keine
   * Trefferblitze, kein Muendungsfeuer. Sie sind reine Anzeige, und ohne Zuschauer waere
   * jeder einzelne davon Arbeit fuer den Papierkorb.
   *
   * Zugleich wird Gold **direkt gutgeschrieben** statt als Muenze abgelegt - genau das
   * verlangt GDD 12 Abschnitt 3, weil niemand da ist, der es einsammelt.
   *
   * Beides zusammen ist keine Bequemlichkeit, sondern der Unterschied zwischen zwei
   * Sekunden und vierzig: Bei acht Stunden fallen zehntausende Gegner, und jeder einzelne
   * erzeugte sonst sechs Splitter, eine Druckwelle, zwei Goldfunken und eine Muenze, die
   * mit allen anderen verdichtet werden will.
   */
  observed: boolean
}

export function createCombatState(): CombatState {
  return {
    phase: 'pause',
    timer: 0,
    plan: null,
    spawnIndex: 0,
    enemies: [],
    enemyPool: [],
    projectiles: [],
    projectilePool: [],
    cooldowns: new Map(),
    stationHp: BASE_STATION_HP,
    maxStationHp: BASE_STATION_HP,
    modules: [],
    buffs: new Map(),
    coverage: [],
    hits: [],
    muzzles: Array.from({ length: MUZZLE_SLOTS }, () => ({
      pos: { x: 0, y: 0 },
      angle: 0,
      age: 0,
      life: MUZZLE_LIFE,
      color: '',
      active: false,
    })),
    muzzleCursor: 0,
    recoils: new Map(),
    placings: new Map(),
    shards: Array.from({ length: SHARD_SLOTS }, () => ({
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      age: 0,
      life: SHARD_LIFE,
      radius: 2,
      color: '',
      kind: 'truemmer' as const,
      active: false,
    })),
    shardCursor: 0,
    bursts: Array.from({ length: BURST_SLOTS }, () => ({
      pos: { x: 0, y: 0 },
      age: 0,
      life: BURST_LIFE,
      radius: 8,
      color: '',
      active: false,
    })),
    burstCursor: 0,
    pickups: Array.from({ length: PICKUP_SLOTS }, () => ({
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      age: 0,
      life: PICKUP_LIFE,
      active: false,
    })),
    pickupCursor: 0,
    gains: Array.from({ length: GAIN_SLOTS }, () => ({
      pos: { x: 0, y: 0 },
      value: 0,
      age: 0,
      life: GAIN_LIFE,
      active: false,
    })),
    gainCursor: 0,
    stationFlash: { age: 0, life: STATION_FLASH_LIFE, active: false },
    nextId: 1,
    killsThisWave: 0,
    lostAttempts: 0,
    bossId: null,
    drones: [],
    beams: Array.from({ length: BEAM_SLOTS }, () => ({
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      age: 0,
      life: BEAM_LIFE,
      color: '',
      active: false,
    })),
    beamCursor: 0,
    abilityBonus: {},
    damageReduction: 0,
    enemySpeedFactor: 1,
    eventBonus: {},
    enemyPower: 1,
    observed: true,
  }
}

// ---------------------------------------------------------------------------
// Muendungsfeuer und Rueckstoss
// ---------------------------------------------------------------------------

/**
 * Ein Modul hat geschossen: Rueckstoss setzen und - hoechstens alle `MUZZLE_INTERVAL` -
 * einen Blitz entzuenden.
 *
 * Der Rueckstoss folgt **jedem** Schuss, der Blitz nicht. Bei sechs Schuss je Sekunde
 * saehe man ohnehin nur ein Dauerleuchten, und bei x4 waere daraus ein Flackern geworden.
 */
export function fireFlash(
  state: GameState,
  uid: string,
  from: Vec2,
  angle: number,
  color: string,
): void {
  const combat = state.runtime.combat
  const interval = effectLife(state, MUZZLE_INTERVAL)

  let recoil = combat.recoils.get(uid)
  if (!recoil) {
    recoil = { angle, age: 0, life: effectLife(state, RECOIL_LIFE), sinceFlash: interval }
    combat.recoils.set(uid, recoil)
  }
  recoil.angle = angle
  recoil.age = 0
  recoil.life = effectLife(state, RECOIL_LIFE)

  if (recoil.sinceFlash < interval) return
  recoil.sinceFlash = 0

  const slot = combat.muzzles[combat.muzzleCursor] as Muzzle
  combat.muzzleCursor = (combat.muzzleCursor + 1) % combat.muzzles.length
  slot.pos.x = from.x
  slot.pos.y = from.y
  slot.angle = angle
  slot.color = color
  slot.age = 0
  slot.life = effectLife(state, MUZZLE_LIFE)
  slot.active = true
}

/**
 * Ein Modul ist angedockt (GDD 13 Abschnitt 10).
 *
 * Vermerkt wird nur der **Augenblick** - was daraus wird, entscheidet die Zeichenebene
 * (`render/station.ts`): Das Modul rastet ein, und ein Ring geht darum auf.
 *
 * Der Ring liegt bewusst **nicht** im Vorrat der Druckwellen, obwohl er dort hineinpasste:
 * Druckwellen werden nur gezeichnet, wo der Kampf zu sehen ist - und gebaut wird in der
 * Basis. Er haengt deshalb an derselben Kennung wie das Einrasten und wird mit dem Modul
 * zusammen gezeichnet, also ueberall dort, wo das Modul selbst zu sehen ist.
 *
 * Gilt auch fuers Umsetzen: Ein Modul, das an einer neuen Kante ankommt, ist fuer das Auge
 * dasselbe Ereignis wie ein neu gesetztes.
 */
export function placeFlash(state: GameState, uid: string): void {
  const combat = state.runtime.combat
  if (!combat.observed) return
  combat.placings.set(uid, { age: 0, life: effectLife(state, PLACING_LIFE) })
}

/**
 * Ein Gegner zerfaellt: Splitter in seiner Farbe, dazu eine kurze Druckwelle.
 *
 * Die Zahl der Splitter sinkt mit dem Tempo - bei x4 sterben viermal so viele Gegner je
 * echter Sekunde, und aus dem Zerfall wuerde sonst ein Teppich, der die Station zudeckt
 * (GDD 13 Abschnitt 10).
 *
 * Der Zufall kommt aus dem **Optikstrom**: Weil hier je nach Tempo unterschiedlich viele
 * Zahlen gezogen werden, duerfte er den Spielzufall nicht verschieben.
 */
export function burstEnemy(state: GameState, enemy: Enemy, color: string): void {
  const combat = state.runtime.combat
  const rng = state.runtime.fxRng
  const speed = Math.max(1, state.runtime.speedFactor)
  const count = Math.max(2, Math.round(6 / Math.sqrt(speed)))

  for (let i = 0; i < count; i++) {
    const shard = combat.shards[combat.shardCursor] as Shard
    combat.shardCursor = (combat.shardCursor + 1) % combat.shards.length

    const angle = rng.range(0, Math.PI * 2)
    const push = rng.range(26, 72)
    shard.pos.x = enemy.pos.x
    shard.pos.y = enemy.pos.y
    shard.vel.x = Math.cos(angle) * push
    shard.vel.y = Math.sin(angle) * push
    shard.age = 0
    shard.life = effectLife(state, SHARD_LIFE * rng.range(0.7, 1.15))
    shard.radius = enemy.radius * rng.range(0.14, 0.26)
    shard.color = color
    shard.kind = 'truemmer'
    shard.active = true
  }

  const burst = combat.bursts[combat.burstCursor] as Burst
  combat.burstCursor = (combat.burstCursor + 1) % combat.bursts.length
  burst.pos.x = enemy.pos.x
  burst.pos.y = enemy.pos.y
  burst.age = 0
  burst.life = effectLife(state, BURST_LIFE)
  burst.radius = enemy.radius
  burst.color = color
  burst.active = true
}

/**
 * Die Station ist gefallen.
 *
 * Derselbe Zucker wie bei einem Treffer, nur dreimal so lang: Der Kern schlaegt auf und
 * beruhigt sich sichtbar langsamer. Mehr braucht es nicht - der verlorene Anlauf kostet
 * nichts ausser Zeit (GDD 02), und ein Trauermarsch waere fuer einen Neuversuch zu viel.
 */
export function collapseStation(state: GameState): void {
  const flash = state.runtime.combat.stationFlash
  flash.age = 0
  flash.life = effectLife(state, STATION_FLASH_LIFE * 3)
  flash.active = true
}

/**
 * Die Energiewelle eines Prestiges (GDD 13 Abschnitt 10: "Prestige eine grosse
 * Energieanimation").
 *
 * Dieselbe Bauart wie der Nachhall eines Bosses, nur in einer anderen Groessenordnung:
 * sechs Ringe statt drei, bis zur zehnfachen Weite, und deutlich laenger. Das ist Absicht -
 * ein Prestige ist die groesste Zaesur des Spiels, und eine Zaesur muss man an ihrer
 * **Dauer** erkennen, nicht nur an ihrer Helligkeit.
 *
 * Sie wird **nach** dem Zuruecksetzen ausgeloest, also in den frischen Laufzeitdaten: Der
 * alte Kampfzustand ist zu diesem Zeitpunkt schon verworfen, und ein Ring, den man vorher
 * hineinlegte, waere mit ihm verschwunden.
 *
 * Der Ring ist der eine Effekt, dem es nichts ausmacht, dass die Station gerade neu ist -
 * er geht von der Mitte aus, und die Mitte steht immer.
 */
export function surgeStation(state: GameState): void {
  const combat = state.runtime.combat

  for (let i = 0; i < 6; i++) {
    const burst = combat.bursts[combat.burstCursor] as Burst
    combat.burstCursor = (combat.burstCursor + 1) % combat.bursts.length
    burst.pos.x = 0
    burst.pos.y = 0
    burst.age = 0
    // Jeder Ring laeuft laenger und weiter als der vorige - so entsteht ein Nachschwingen
    // statt sechs gleichzeitiger Kreise.
    burst.life = effectLife(state, BURST_LIFE * (5 + i * 3))
    burst.radius = 60 + i * 150
    // Abwechselnd die beiden Leitfarben: Der Kern gibt ab, der Baum nimmt auf.
    burst.color = i % 2 === 0 ? PALETTE_BLAST : PALETTE_CHAIN
    burst.active = true
  }

  // Der Kern zittert dabei so lange nach wie bei einem Fall - er wird ja auch ersetzt.
  const flash = combat.stationFlash
  flash.age = 0
  flash.life = effectLife(state, STATION_FLASH_LIFE * 6)
  flash.active = true
}

/**
 * Nachhall eines gefallenen Bosses: mehrere Ringe, die verschieden schnell aufgehen.
 *
 * Ein einzelner Ring waere nur ein groesserer Gegnertod. Gestaffelte Laufzeiten machen
 * daraus ein Nachschwingen - die Zaesur, die ein Boss laut GDD 07 Abschnitt 7 setzt.
 */
export function echoBoss(state: GameState, boss: Enemy, color: string): void {
  const combat = state.runtime.combat

  for (let i = 0; i < 3; i++) {
    const burst = combat.bursts[combat.burstCursor] as Burst
    combat.burstCursor = (combat.burstCursor + 1) % combat.bursts.length
    burst.pos.x = boss.pos.x
    burst.pos.y = boss.pos.y
    burst.age = 0
    // Jeder Ring laeuft laenger und weiter als der vorige.
    burst.life = effectLife(state, BURST_LIFE * (1.6 + i * 0.9))
    burst.radius = boss.radius * (1 + i * 0.55)
    burst.color = color
    burst.active = true
  }
}

/**
 * Gold springt aus dem zerstoerten Gegner heraus und rollt aus.
 *
 * Die Muenze selbst liegt schon an ihrem Platz - diese Funken sind das, was man **sieht**:
 * Sie fliegen langsamer und laenger als die Splitter, damit der Wurf ausrollt, statt zu
 * zerstieben. Zwei Funken je Tod reichen; bei hohem Tempo nur einer.
 */
export function spillGold(state: GameState, at: Vec2): void {
  const combat = state.runtime.combat
  const rng = state.runtime.fxRng
  const count = state.runtime.speedFactor >= 4 ? 1 : 2

  for (let i = 0; i < count; i++) {
    const shard = combat.shards[combat.shardCursor] as Shard
    combat.shardCursor = (combat.shardCursor + 1) % combat.shards.length

    const angle = rng.range(0, Math.PI * 2)
    const push = rng.range(14, 38)
    shard.pos.x = at.x
    shard.pos.y = at.y
    shard.vel.x = Math.cos(angle) * push
    shard.vel.y = Math.sin(angle) * push
    shard.age = 0
    shard.life = effectLife(state, SPILL_LIFE * rng.range(0.8, 1.2))
    shard.radius = rng.range(1.6, 2.8)
    shard.color = ''
    shard.kind = 'muenze'
    shard.active = true
  }
}

/**
 * Eingesammelte Muenzen fliegen zum Zeiger.
 *
 * Der Zielpunkt wird beim Start festgehalten: Der Flug dauert eine knappe Drittelsekunde,
 * und eine Muenze, die dem Zeiger hinterherliefe, wirkte wie ein Verfolger statt wie
 * etwas, das man aufgehoben hat.
 */
/**
 * Der eingesammelte Betrag steigt am Zeiger auf.
 *
 * Kommt kurz darauf mehr dazu, waechst dieselbe Zahl weiter, statt dass eine zweite
 * daneben steht: Beim Ziehen ueber ein Feld voller Muenzen zaehlt so **eine** Zahl hoch -
 * das ist die Belohnung, nicht ein Stapel aus Ziffern.
 */
export function spawnGain(state: GameState, at: Vec2, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return

  const combat = state.runtime.combat
  if (!combat.observed) return
  const previous = combat.gains[(combat.gainCursor + combat.gains.length - 1) % combat.gains.length]

  if (previous && previous.active && previous.age < effectLife(state, GAIN_MERGE_WINDOW)) {
    previous.value += amount
    previous.age = 0
    previous.pos.x = at.x
    previous.pos.y = at.y
    return
  }

  const gain = combat.gains[combat.gainCursor] as Gain
  combat.gainCursor = (combat.gainCursor + 1) % combat.gains.length
  gain.pos.x = at.x
  gain.pos.y = at.y
  gain.value = amount
  gain.age = 0
  gain.life = effectLife(state, GAIN_LIFE)
  gain.active = true
}

export function spawnPickups(state: GameState, from: readonly Vec2[], to: Vec2): void {
  const combat = state.runtime.combat

  for (const start of from) {
    const pickup = combat.pickups[combat.pickupCursor] as Pickup
    combat.pickupCursor = (combat.pickupCursor + 1) % combat.pickups.length
    pickup.from.x = start.x
    pickup.from.y = start.y
    pickup.to.x = to.x
    pickup.to.y = to.y
    pickup.age = 0
    pickup.life = effectLife(state, PICKUP_LIFE)
    pickup.active = true
  }
}

/** Einen Laserstrahl ablegen. Ringspeicher wie beim Muendungsfeuer - der aelteste weicht. */
export function spawnBeam(state: GameState, from: Vec2, target: Enemy, color: string): void {
  const combat = state.runtime.combat
  const beam = combat.beams[combat.beamCursor] as Beam
  combat.beamCursor = (combat.beamCursor + 1) % combat.beams.length

  beam.from.x = from.x
  beam.from.y = from.y
  beam.to.x = target.pos.x
  beam.to.y = target.pos.y
  beam.age = 0
  beam.life = effectLife(state, BEAM_LIFE)
  beam.color = color
  beam.active = true
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

/**
 * Ein Schlag auf die Flaeche: alles im Umkreis nimmt denselben Schaden.
 *
 * Steht hier und nicht in `sim/abilities.ts`, damit die Abhaengigkeit einseitig bleibt -
 * Faehigkeiten rufen den Kampf, der Kampf ruft keine Faehigkeiten. Ab E14 benutzt auch
 * `applyExplosion` fuer Raketen und Plasma dieselbe Funktion; sie ist bewusst allgemein
 * gehalten und weiss nichts von Faehigkeiten.
 *
 * Ueber eine Kopie der Liste, weil ein Tod den Gegner aus `enemies` entfernt - ohne die
 * Kopie uebersprungen wir bei jedem Kill den naechsten Eintrag.
 */
export function blastEnemies(
  state: GameState,
  center: Vec2,
  radius: number,
  damage: number,
): number {
  const combat = state.runtime.combat
  if (radius <= 0 || damage <= 0) return 0

  let hit = 0
  for (const enemy of [...combat.enemies]) {
    if (!enemy.active) continue
    // Der Radius misst bis zur **Aussenkante** des Gegners - ein Titan mit 40 Einheiten
    // Radius soll nicht danebenliegen, nur weil sein Mittelpunkt knapp draussen steht.
    if (Math.hypot(enemy.pos.x - center.x, enemy.pos.y - center.y) > radius + enemy.radius) {
      continue
    }
    applyDamage(state, enemy, damage)
    hit += 1
  }

  // Eine Druckwelle in der Mitte macht den Schlag sichtbar, auch wenn er nichts trifft.
  const burst = combat.bursts[combat.burstCursor] as Burst
  combat.burstCursor = (combat.burstCursor + 1) % combat.bursts.length
  burst.pos.x = center.x
  burst.pos.y = center.y
  burst.age = 0
  burst.life = effectLife(state, BURST_LIFE * 3)
  burst.radius = radius * 0.5
  burst.color = PALETTE_BLAST
  burst.active = true

  return hit
}

/**
 * Farbe der Druckwelle einer Faehigkeit. Ausgeschrieben, weil `sim/` nichts aus `render/`
 * zieht - derselbe Wert wie `PALETTE.edge` in `render/theme.ts`.
 */
const PALETTE_BLAST = '#7fd8ff'

/**
 * Flaechenexplosion (GDD 05: Raketen, Plasma, Kanone).
 *
 * Dasselbe wie `blastEnemies`, nur mit dem Namen aus dem Implementierungsplan - und mit
 * einer Ausnahme: Das getroffene Ziel selbst bekommt den Explosionsschaden **nicht**
 * zusaetzlich. Es hat den Treffer schon abbekommen; doppelt zu zaehlen machte einen
 * Raketenturm gegen Einzelziele so stark wie gegen Gruppen, und genau das soll er nicht sein
 * (GDD 05 Abschnitt 6).
 */
export function applyExplosion(
  state: GameState,
  center: Vec2,
  radius: number,
  damage: number,
  except?: Enemy,
): number {
  const combat = state.runtime.combat
  if (radius <= 0 || damage <= 0) return 0

  let hit = 0
  for (const enemy of [...combat.enemies]) {
    if (!enemy.active || enemy === except) continue
    if (Math.hypot(enemy.pos.x - center.x, enemy.pos.y - center.y) > radius + enemy.radius) {
      continue
    }
    applyDamage(state, enemy, damage)
    hit += 1
  }

  ring(state, center, radius * 0.5, PALETTE_BLAST, BURST_LIFE * 2)
  return hit
}

/**
 * Kettenblitz (GDD 05: Tesla).
 *
 * Springt vom getroffenen Gegner zum jeweils naechsten, der noch nicht getroffen wurde, und
 * verliert dabei je Sprung an Kraft. `hops` ist die Zahl der **weiteren** Ziele - der erste
 * Treffer selbst kommt aus dem Geschoss.
 *
 * Die Suche geht immer vom zuletzt getroffenen Gegner aus, nicht vom Turm: Nur so folgt der
 * Blitz einer Kette und trifft nicht dreimal dieselbe Traube um den Turm herum.
 */
export function applyChain(
  state: GameState,
  from: Enemy,
  hops: number,
  falloff: number,
  damage: number,
  range: number,
): number {
  const combat = state.runtime.combat
  const hitAlready = new Set<number>([from.id])
  let current = from
  let power = damage
  let jumps = 0

  for (let i = 0; i < hops; i++) {
    power *= falloff
    if (power <= 0) break

    let next: Enemy | null = null
    let bestDistance = Infinity
    for (const enemy of combat.enemies) {
      if (!enemy.active || hitAlready.has(enemy.id)) continue
      const distance = Math.hypot(enemy.pos.x - current.pos.x, enemy.pos.y - current.pos.y)
      if (distance > range || distance >= bestDistance) continue
      next = enemy
      bestDistance = distance
    }
    if (!next) break

    hitAlready.add(next.id)
    // Der Bogen wird als kurzer Ring am Ziel sichtbar - eine eigene Blitzlinie waere ein
    // zweites Zeichensystem fuer einen Effekt, der einen Wimpernschlag dauert.
    ring(state, next.pos, next.radius * 1.6, PALETTE_CHAIN, BURST_LIFE)
    applyDamage(state, next, power)
    current = next
    jumps += 1
  }

  return jumps
}

/**
 * Verbrennung ueber Zeit (GDD 05: Flammen).
 *
 * Neu gesetzt statt aufaddiert: Ein zweiter Treffer verlaengert die Verbrennung und nimmt
 * den staerkeren der beiden Werte, statt beide zu stapeln. Sonst waere ein Flammenturm mit
 * hoher Feuerrate nicht "Schaden ueber Zeit", sondern der staerkste Einzelzielturm im Spiel.
 */
export function applyBurn(state: GameState, enemy: Enemy, dps: number, duration: number): void {
  if (!enemy.active || dps <= 0 || duration <= 0) return
  enemy.burnDps = Math.max(enemy.burnDps, dps)
  enemy.burnLeft = Math.max(enemy.burnLeft, effectLife(state, duration))
}

/**
 * Verlangsamung eines einzelnen Gegners (GDD 05: Eis- und Void-Turm).
 *
 * Derselbe Gedanke wie bei der Verbrennung - der staerkere Wert gewinnt, die Dauer wird
 * verlaengert. Ein Deckel bei einem Zehntel verhindert, dass eine Traube Void-Tuerme
 * Gegner vollstaendig anhaelt: Ein stehender Gegner waere kein Gegner mehr.
 */
export function applyChill(
  state: GameState,
  enemy: Enemy,
  factor: number,
  duration: number,
): void {
  if (!enemy.active || factor >= 1 || duration <= 0) return
  enemy.chillFactor = Math.max(0.1, Math.min(enemy.chillFactor, factor))
  enemy.chillLeft = Math.max(enemy.chillLeft, effectLife(state, duration))
}

/** Farbe eines Kettenblitzes - derselbe Wert wie `PALETTE.violet` in `render/theme.ts`. */
const PALETTE_CHAIN = '#b45cff'

/** Eine Druckwelle in den Ringspeicher legen. Die eine Stelle, an der Ringe entstehen. */
function ring(
  state: GameState,
  at: Vec2,
  radius: number,
  color: string,
  life: number,
): void {
  const combat = state.runtime.combat
  const burst = combat.bursts[combat.burstCursor] as Burst
  combat.burstCursor = (combat.burstCursor + 1) % combat.bursts.length
  burst.pos.x = at.x
  burst.pos.y = at.y
  burst.age = 0
  burst.life = effectLife(state, life)
  burst.radius = radius
  burst.color = color
  burst.active = true
}

/**
 * Anhaltende Zustaende altern lassen: Verbrennung und Verlangsamung.
 *
 * Die Verbrennung toetet ueber `applyDamage` und nicht direkt - so laufen Belohnung, Tod
 * und Zerfall durch dieselbe Stelle wie jeder andere Schaden auch.
 */
export function stepEnemyStates(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  for (const enemy of [...combat.enemies]) {
    if (!enemy.active) continue

    if (enemy.burnLeft > 0) {
      enemy.burnLeft -= dt
      applyDamage(state, enemy, enemy.burnDps * dt)
      if (enemy.burnLeft <= 0) {
        enemy.burnLeft = 0
        enemy.burnDps = 0
      }
    }

    if (enemy.chillLeft > 0) {
      enemy.chillLeft -= dt
      if (enemy.chillLeft <= 0) {
        enemy.chillLeft = 0
        enemy.chillFactor = 1
      }
    }

    // Regeneration eines Elite-Gegners - nie ueber sein Maximum hinaus.
    if (enemy.regen > 0 && enemy.active && enemy.hp > 0) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen * dt)
    }
  }
}

// ---------------------------------------------------------------------------
// Schaden an der Station
// ---------------------------------------------------------------------------

/** Ein Treffer auf die Station. `atPos` dient nur dem Aufblitzen an der Trefferstelle. */
export function damageStation(state: GameState, amount: number, atPos: Vec2): void {
  const combat = state.runtime.combat
  if (!Number.isFinite(amount) || amount <= 0) return
  if (combat.stationHp <= 0) return

  // Ein laufendes Schild faengt einen Anteil ab (GDD 09 Abschnitt 10). Der Wert kommt
  // fertig aus `sim/abilities.ts` - hier wird nicht nachgefragt, nur gelesen.
  const taken = amount * (1 - clamp01(combat.damageReduction))
  if (taken <= 0) return

  combat.stationHp = Math.max(0, combat.stationHp - taken)

  if (combat.observed) {
    // Der Kern zuckt. Ein neuer Treffer setzt das Zittern zurueck, statt es zu stapeln.
    combat.stationFlash.age = 0
    combat.stationFlash.life = effectLife(state, STATION_FLASH_LIFE)
    combat.stationFlash.active = true

    combat.hits.push({
      pos: { ...atPos },
      age: 0,
      life: effectLife(state, HIT_LIFE),
      kind: 'station',
      crit: false,
    })
  }
  // Gemeldet wird, was **angekommen** ist, nicht was geworfen wurde: Die Anzeige und
  // spaeter der Klang sollen die Wirkung des Schildes zeigen, nicht sie verschweigen.
  emit('station.damaged', { amount: taken, remaining: combat.stationHp })

  if (combat.stationHp === 0) emit('station.destroyed', { wave: state.run.wave })
}

/**
 * Angedockte Gegner schlagen fortlaufend zu, bis sie zerstoert sind (GDD 07 Abschnitt 2).
 * Sie stehen dabei still - deshalb sind sie zugleich das bevorzugte Ziel der Tuerme.
 */
export function dockedDamage(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  for (const enemy of combat.enemies) {
    if (enemy.dockedTo === null) continue

    enemy.attackTimer -= dt
    if (enemy.attackTimer > 0) continue

    enemy.attackTimer += ENEMY_ATTACK_INTERVAL

    // Der Stoss geht auf das Modul zu, an dem er haengt - nicht auf die Stationsmitte.
    // Bei einer gewachsenen Station liegt die weit weg, und der Biss ginge ins Leere.
    const module = combat.modules.find((entry) => entry.uid === enemy.dockedTo)
    if (module) {
      const dx = module.center.x - enemy.pos.x
      const dy = module.center.y - enemy.pos.y
      const length = Math.hypot(dx, dy) || 1
      enemy.biteDir.x = dx / length
      enemy.biteDir.y = dy / length
      enemy.bite = 0
      enemy.biteLife = effectLife(state, BITE_LIFE)
    }

    damageStation(state, enemy.damage * berserkFactor(enemy), enemy.pos)
  }
}

/**
 * Der Zuschlag eines Berserkers: Er wird staerker, je weniger Leben er hat
 * (GDD 07 Abschnitt 5).
 *
 * Linear mit dem fehlenden Leben - bei halbem Leben also die Haelfte des Zuschlags. Das
 * macht ihn genau dann gefaehrlich, wenn man ihn fast erledigt hat, und belohnt schnellen
 * hohen Schaden statt langem Dauerfeuer, so wie der Konter im GDD lautet.
 *
 * Ohne die Faehigkeit ist der Faktor 1 - eine Fallunterscheidung braucht es nicht.
 */
export function berserkFactor(enemy: Enemy): number {
  if (enemy.berserk <= 0 || enemy.maxHp <= 0) return 1
  const missing = Math.max(0, Math.min(1, 1 - enemy.hp / enemy.maxHp))
  return 1 + enemy.berserk * missing
}

// ---------------------------------------------------------------------------
// Schaden an Gegnern
// ---------------------------------------------------------------------------

export type DamageFlags = { crit?: boolean }

/** Schaden auf einen Gegner. Toetet ihn, wenn seine HP auf null fallen. */
export function applyDamage(
  state: GameState,
  enemy: Enemy,
  amount: number,
  flags: DamageFlags = {},
): void {
  if (!enemy.active || amount <= 0) return

  /*
   * Die Verteidigung des Gegners (GDD 07 Abschnitt 5). Beides sind **Felder am Gegner**,
   * keine Fallunterscheidung nach Gegnerart: Ein neuer Gegner mit Schild ist ein Datensatz,
   * und diese Zeilen bleiben unveraendert.
   *
   * Der Schild ist gedeckelt, damit kein Gegner unverwundbar wird - ein Gegner, den man
   * nicht toeten kann, ist kein Gegner, sondern ein Hindernis.
   */
  const blocked = Math.max(0, Math.min(0.9, enemy.shield))
  const dealt = (flags.crit ? amount * CRIT_MULTIPLIER : amount) * (1 - blocked)
  if (dealt <= 0) return

  enemy.hp -= dealt

  // Der Reflektor gibt einen Anteil an die Station zurueck (GDD 07 Abschnitt 5). Er trifft
  // dort, wo er steht - der Blitz soll am Reflektor sichtbar sein, nicht in der Mitte.
  if (enemy.reflect > 0) {
    damageStation(state, dealt * enemy.reflect, enemy.pos)
  }
  // Der kritische Treffer traegt sein Kennzeichen mit: Er blitzt groesser auf, damit man
  // den Unterschied sieht, statt ihn nur in der Lebensleiste abzulesen.
  if (state.runtime.combat.observed) {
    state.runtime.combat.hits.push({
      pos: { ...enemy.pos },
      age: 0,
      life: effectLife(state, HIT_LIFE),
      kind: 'enemy',
      crit: flags.crit === true,
    })
  }

  if (enemy.hp <= 0) killEnemy(state, enemy)
}

/**
 * Gold faellt als Muenze auf das Feld und wird **nicht** automatisch gutgeschrieben
 * (GDD 08 Abschnitt 2) - XP dagegen schon (GDD 08 Abschnitt 3). Beides laeuft am Ende
 * durch `grantReward`, die einzige Stelle, an der Ressourcen entstehen.
 */
export function killEnemy(state: GameState, enemy: Enemy): void {
  if (!enemy.active) return

  const combat = state.runtime.combat
  const color = enemyById(enemy.defId).color
  combat.killsThisWave += 1

  // Zerfallen, bevor er in den Pool zurueckgeht - danach steht seine Position nicht mehr.
  burstEnemy(state, enemy, color)

  const isBoss = combat.bossId === enemy.id
  // Der Boss bekommt zusaetzlich seinen Nachhall und eine eigene Meldung: Sein Tod ist
  // eine Zaesur, kein Gegner weniger (GDD 07 Abschnitt 7).
  if (isBoss) {
    echoBoss(state, enemy, color)
    emit('boss.killed', { wave: state.run.wave })
  }

  /*
   * Ein "Volatile"-Elite explodiert beim Tod (GDD 07 Abschnitt 6).
   *
   * **Vor** der Belohnung und noch bevor er in den Pool zurueckgeht: Die Explosion kann
   * weitere Gegner toeten, und deren Belohnung soll auf demselben Weg entstehen wie seine.
   * Sie trifft ihn selbst nicht mehr - er ist bereits tot.
   */
  for (const id of enemy.elite) {
    const modifier = eliteById(id)
    if (!modifier.explodeRadius || !modifier.explodeDamage) continue
    applyExplosion(
      state,
      { ...enemy.pos },
      modifier.explodeRadius,
      enemy.damage * modifier.explodeDamage,
      enemy,
    )
  }

  dropGold(state, enemy.pos, goldValueFor(state, enemy))
  spillGold(state, enemy.pos)

  // Die Versorgungskapsel haengt an der **Drop-Chance des Gegners** und nicht an der Welle
  // (GDD 11 Abschnitt 2) - deshalb steht sie hier, an der einen Stelle, an der ein Gegner
  // stirbt, und nicht in der Wellensteuerung.
  maybeDropPod(state, enemy, isBoss)

  // Der Erfahrungsbonus aus Perks wirkt hier und nicht in `grantReward`: Dort landen auch
  // Belohnungen, die keinen Bonus bekommen sollen (spaetere Ereignisse, Kapseln). Der
  // Bonus gehoert zum Toeten, also steht er beim Toeten.
  const xp = enemy.xpReward * globalMultiplier(state, 'xpBonus')
  grantReward(state, { xp }, 'enemy.kill')
  emit('enemy.killed', {
    defId: enemy.defId,
    gold: enemy.goldReward,
    xp,
    x: enemy.pos.x,
    y: enemy.pos.y,
  })

  releaseEnemy(state, enemy)
}

/**
 * Alles rein Optische altern lassen: Trefferblitze, Muendungsfeuer, Rueckstoss.
 *
 * Ausgebrannte Blitze werden nicht geloescht, sondern abgeschaltet - ihr Platz wird beim
 * naechsten Schuss wieder ueberschrieben. Rueckstoss-Eintraege dagegen verfallen, sonst
 * behielte die Karte jedes Modul, das jemals geschossen hat.
 */
export function stepEffects(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  for (let i = combat.hits.length - 1; i >= 0; i--) {
    const hit = combat.hits[i] as Hit
    hit.age += dt
    if (hit.age > hit.life) combat.hits.splice(i, 1)
  }

  for (const muzzle of combat.muzzles) {
    if (!muzzle.active) continue
    muzzle.age += dt
    if (muzzle.age > muzzle.life) muzzle.active = false
  }

  for (const beam of combat.beams) {
    if (!beam.active) continue
    beam.age += dt
    if (beam.age > beam.life) beam.active = false
  }

  for (const [uid, recoil] of combat.recoils) {
    recoil.age += dt
    recoil.sinceFlash += dt
    if (recoil.age > recoil.life) combat.recoils.delete(uid)
  }

  // Genauso das Einrasten: Der Eintrag verfaellt, statt liegen zu bleiben - sonst behielte
  // die Karte jedes Modul, das jemals gesetzt wurde.
  for (const [uid, placing] of combat.placings) {
    placing.age += dt
    if (placing.age > placing.life) combat.placings.delete(uid)
  }

  // Der Bremsfaktor haengt nur an der Schrittweite - einmal je Takt statt je Splitter.
  const drag = Math.exp(-dt * SHARD_DRAG)
  for (const shard of combat.shards) {
    if (!shard.active) continue
    shard.age += dt
    if (shard.age > shard.life) {
      shard.active = false
      continue
    }
    shard.vel.x *= drag
    shard.vel.y *= drag
    shard.pos.x += shard.vel.x * dt
    shard.pos.y += shard.vel.y * dt
  }

  for (const burst of combat.bursts) {
    if (!burst.active) continue
    burst.age += dt
    if (burst.age > burst.life) burst.active = false
  }

  for (const pickup of combat.pickups) {
    if (!pickup.active) continue
    pickup.age += dt
    if (pickup.age > pickup.life) pickup.active = false
  }

  for (const gain of combat.gains) {
    if (!gain.active) continue
    gain.age += dt
    if (gain.age > gain.life) gain.active = false
  }

  const flash = combat.stationFlash
  if (flash.active) {
    flash.age += dt
    if (flash.age > flash.life) flash.active = false
  }

  // Der Biss altert am Gegner selbst - er gehoert zu ihm und nicht in einen Vorrat.
  for (const enemy of combat.enemies) {
    if (enemy.biteLife <= 0) continue
    enemy.bite += dt
    if (enemy.bite > enemy.biteLife) enemy.biteLife = 0
  }
}
