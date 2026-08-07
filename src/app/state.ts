/**
 * GameState - die eine Wahrheit.
 *
 * Die Aufteilung ist die wichtigste Entscheidung dieser Datei und laut GDD 16 Abschnitt 8
 * spaeter nur mit Umbau zu aendern:
 *
 *   permanent  ueberlebt Prestige   - Punkte, Freischaltungen, Statistik
 *   run        wird bei Prestige zurueckgesetzt - Welle, Gold, Station, Upgrades, Level
 *   runtime    wird **nie** gespeichert - Generator, Auswahl, Bau-Modus, Anzeigezustand
 *
 * Fuer E13 (Prestige) ist genau diese Trennung die fehleranfaelligste Stelle des Spiels.
 * Deshalb steht sie ab E0 und wird im Selbsttest gegen eine Feldliste geprueft.
 */

import { createRng, randomSeed, type Rng } from '../core/rng.ts'
import type { Vec2 } from '../core/vec.ts'
import type { Rarity } from '../data/types.ts'
import {
  START_ABILITY_SLOTS,
  START_CORE_ID,
  START_GOLD,
  START_INVENTORY,
  START_LEVEL,
  START_TOWER_IDS,
  START_TOWER_SLOTS,
  START_WAVE,
} from '../data/balance.ts'
import { createCombatState, type CombatState } from '../sim/combat.ts'
import type { Coin } from '../sim/economy.ts'
import {
  createStation,
  newModule,
  type FreeEdge,
  type Station,
} from '../sim/station.ts'

/** Ueberlebt Prestige. */
export type PermanentState = {
  prestigePoints: number
  /** Gekaufte Knoten im Prestige-Baum. */
  prestigeNodes: string[]
  unlockedTowers: string[]
  unlockedCores: string[]
  /** Einmalige Hinweise, die der Spieler schon gesehen hat (GDD 14 Abschnitt 4a). */
  seenHints: string[]
  bestWaveEver: number
  prestigeCount: number
  totalPlaySeconds: number
}

/** Wird bei Prestige zurueckgesetzt. */
export type RunState = {
  /** Startwert des Generators fuer diesen Run - macht Fehlerberichte nachstellbar. */
  seed: number
  /** Fortgeschriebener Zustand des Generators. */
  rngState: number
  /** Hauptturm, platzierte Module, Inventar und Turmplaetze. */
  station: Station
  wave: number
  /** Hoechste in diesem Run erreichte Welle - begrenzt das Vorspulen (E9). */
  waveRecord: number
  gold: number
  /**
   * Alles Gold, das dieser Run **insgesamt** eingebracht hat - unabhaengig davon, was davon
   * schon ausgegeben ist.
   *
   * Grundlage der Prestige-Voraussetzung und der Punkte (GDD 10 Abschnitt 3 und 5). Der
   * Kontostand taugt dafuer nicht: Sonst erschliche man sich das Prestige durch Sparen und
   * braechte sich durch Ausgeben darum.
   */
  goldEarned: number
  /** Wie viele Tuerme dieser Run schon gekauft hat - Grundlage der Preiskurve (GDD 06 §2). */
  towersBought: number
  /**
   * Die Turmkarten, die gerade zur Wahl stehen (GDD 06 Abschnitt 1).
   *
   * Im Spielstand und nicht in den Laufzeitdaten - dieselbe Begruendung wie beim
   * Perk-Angebot: Ein Neuladen darf keine neuen Karten wuerfeln.
   */
  towerOffer: TowerOffer[]
  /**
   * Muenzen, die noch auf dem Feld liegen. Sie verfallen nie (GDD 08 Abschnitt 2) -
   * deshalb gehoeren sie in den Spielstand und nicht in die Laufzeitdaten. Wer das Spiel
   * schliesst, findet sein Gold beim naechsten Mal wieder.
   */
  coins: Coin[]
  /**
   * Bis hierhin ist der Perk eines Aufstiegs **abgeholt** - nicht die erreichte Stufe.
   * Die ergibt sich aus `xp` (siehe `sim/progression.ts`). Die Differenz sind die offenen
   * Auswahlen; dadurch koennen die beiden Zahlen nicht auseinanderlaufen.
   */
  level: number
  /** Summe aller je erhaltenen Erfahrungspunkte. Wird nie verbraucht. */
  xp: number
  abilitySlots: number
  /** Gewaehlte Perks, in der Reihenfolge der Wahl. Ein Perk kann mehrfach vorkommen. */
  perks: string[]
  /**
   * Die drei Karten, die gerade zur Wahl stehen. Im Spielstand und nicht in den
   * Laufzeitdaten, damit ein Neuladen kein neues Angebot wuerfelt (GDD 09 Abschnitt 2).
   */
  perkOffer: string[]
  /** Freigeschaltete Faehigkeiten (GDD 09 Abschnitt 7) - gekauft mit Gold. */
  abilities: string[]
  /** Belegte Faehigkeitenslots in ihrer Reihenfolge. Nie laenger als `abilitySlots`. */
  equipped: string[]
  /** Upgrade-Pfad -> gekaufte Stufe. */
  upgrades: Record<string, number>
  /** Auto-Wellen-Modus: nach der Pause startet die naechste Welle von selbst. */
  autoWaves: boolean
  /**
   * Kapseln, die noch auf dem Feld liegen (GDD 11 Abschnitt 8).
   *
   * Im Spielstand aus demselben Grund wie die Muenzen: Sie sind ein Gegenstand im Feld und
   * verfallen nicht. Wer das Spiel schliesst, findet seine Kapsel beim naechsten Mal wieder.
   */
  pods: Pod[]
  /**
   * Das Ereignis, das gerade auf eine Entscheidung wartet - oder `null`.
   *
   * Im Spielstand und nicht in den Laufzeitdaten, dieselbe Begruendung wie beim Perk- und
   * Turmangebot: Ein Neuladen darf kein neues Ereignis wuerfeln. Sonst waere die
   * Entscheidung, die den Kern des Ereignisses ausmacht, beliebig wiederholbar.
   */
  eventId: string | null
  /** Welle, auf der das naechste Ereignis faellig wird (GDD 11 Abschnitt 2). */
  nextEventWave: number
  /**
   * Die Haendler-Drohne, solange sie im Feld steht (GDD 11 Abschnitt 7).
   *
   * Im Spielstand, obwohl sie eine Uhr mitfuehrt - anders als eine Abklingzeit gehoert sie
   * zum Run und nicht zum Programmlauf: Ihr Sortiment ist gewuerfelt, und ein Neuladen
   * duerfte es weder neu wuerfeln noch die Gelegenheit vernichten.
   */
  trader: Trader | null
  /** Welle, auf der die naechste Drohne kommt. */
  nextTraderWave: number
}

/**
 * Die Haendler-Drohne im Feld.
 *
 * Sie traegt ihren Ort, ihre Restzeit und ihr gewuerfeltes Sortiment. `visited` heisst: Der
 * Spieler hat sie erreicht - ab da laeuft die Uhr nicht weiter, denn ein Laden, der waehrend
 * des Einkaufs abhebt, waere keine Gelegenheit, sondern eine Falle.
 */
export type Trader = {
  x: number
  y: number
  /** Restzeit in Simulationssekunden. */
  left: number
  visited: boolean
  stock: TraderOffer[]
}

/**
 * Ein Posten im Sortiment.
 *
 * `perkId` steht nur bei Perk-Ware und wird schon beim Landen gewuerfelt - sonst stuende
 * auf der Karte "eine Verbesserung" und im Regal etwas anderes. Dieselbe Ueberlegung wie
 * beim Turmangebot: Was auf der Karte steht, muss man auch bekommen.
 */
export type TraderOffer = {
  defId: string
  perkId: string | null
  price: number
  sold: boolean
}

/**
 * Eine Versorgungskapsel im Feld.
 *
 * Sie traegt nur ihre Art und ihren Ort - was drinsteckt, steht im Datensatz. Der Wert
 * entsteht erst beim Einsammeln aus der Welle, auf der sie **eingesammelt** wird: Eine
 * Kapsel, die zwanzig Wellen liegen bleibt, ist damit mehr wert, und niemand muss sie
 * horten oder sich beeilen.
 */
export type Pod = {
  id: number
  defId: string
  x: number
  y: number
}

/**
 * Eine Turmkarte im Kaufangebot.
 *
 * Sie traegt bereits **alles Ausgewuerfelte**: Art, Raritaet und Eigenschaften. Nur so
 * zeigt die Karte, was man wirklich bekommt - wuerfelte erst der Klick, waere die Auswahl
 * eine Behauptung (GDD 06 Abschnitt 1).
 */
export type TowerOffer = {
  defId: string
  rarity: Rarity
  traits: string[]
}

/** Bereiche der Oberflaeche (GDD 13 Abschnitt 3). Waechst mit den Etappen. */
export type View = 'combat' | 'base' | 'upgrades' | 'prestige' | 'settings'

/** Existiert nur zur Laufzeit. Nichts hiervon geht in den Spielstand. */
export type RuntimeState = {
  rng: Rng
  /**
   * Eigener Strom fuer alles rein Optische - Splitterrichtungen, Streuung, Groessen.
   *
   * Er ist **abgeleitet**, nicht derselbe: Effekte werden bei hohem Tempo ausgeduennt,
   * ziehen also unterschiedlich viele Zahlen. Laegen sie im Hauptstrom, haetten dieselbe
   * Welle und derselbe Spielstand je nach eingestelltem Tempo verschiedene kritische
   * Treffer - ein Balancing-Fehler waere dann nicht mehr nachstellbar.
   */
  fxRng: Rng
  /** Spielzeit der letzten Sicherung, in Sekunden. */
  lastSaveAt: number
  /** Es gibt ungesicherte Aenderungen. */
  dirty: boolean
  view: View
  /**
   * Eingestelltes Spieltempo. Es steht hier, weil die Simulation bei x4 viermal so viele
   * Takte je echter Sekunde bekommt: Optische Effekte messen ihre Lebensdauer in
   * Simulationszeit und waeren sonst viermal so kurz und viermal so haeufig. Mit diesem
   * Faktor werden sie **ausgeduennt statt beschleunigt** (GDD 13 Abschnitt 10).
   * Auf die Spielregeln hat er keinen Einfluss.
   */
  speedFactor: number
  /** Modul aus dem Inventar, das gerade gesetzt werden soll. */
  buildUid: string | null
  /** Platziertes Modul, das gerade umgesetzt wird. */
  dragUid: string | null
  selectedUid: string | null
  hoverUid: string | null
  /** Kante, auf die die Vorschau gerade einrastet. */
  hoverEdge: FreeEdge | null
  /**
   * Wo der Zeiger steht, in Weltkoordinaten - oder `null`, wenn er die Flaeche verlassen
   * hat.
   *
   * Er steht hier neben `hoverUid` und `hoverEdge`, weil er dasselbe ist: eine Aussage
   * ueber die Bedienung, die mehrere Ebenen brauchen. Eingesammelte Muenzen fahren ihm nach
   * (`sim/combat.ts`) und muessen dafuer wissen, wo er **jetzt** ist - nicht, wo er beim
   * Aufheben war.
   */
  pointer: Vec2 | null
  /**
   * Das laufende Gefecht. Bewusst **nicht** im Spielstand: Uebrig gebliebene Gegner
   * werden nicht uebernommen (GDD 07 Abschnitt 9), und jede Welle beginnt ohnehin mit
   * voller HP. Nach dem Laden startet die aktuelle Welle also neu.
   */
  combat: CombatState
  /**
   * Zaehler, der bei jeder Aenderung an der Station steigt. Er ist der Ausloeser fuer die
   * Neuberechnung in `app/view.ts` - so wird vollstaendig, aber nur bei Bedarf gerechnet.
   */
  revision: number
  /**
   * Bis zu welcher Stufe der Aufstieg bereits **gemeldet** wurde (`level.up`).
   *
   * Nicht im Spielstand: Ein Ereignis ist kein Zustand. `-1` heisst "noch unbekannt" - der
   * erste Takt nach dem Laden setzt den Wert stumm auf die erreichte Stufe. Ohne diesen
   * Zwischenwert feuerte ein Spielstand auf Stufe 20 beim Laden zwanzig Meldungen ab, und
   * spaeter zwanzig Klaenge.
   */
  announcedLevel: number
  /**
   * Laufende und abklingende Faehigkeiten (GDD 09 Teil B).
   *
   * Ebenfalls nicht im Spielstand: Nach dem Laden beginnt die aktuelle Welle ohnehin neu
   * (siehe `combat`), und eine Abklingzeit ueber einen Programmstart hinweg mitzufuehren
   * hiesse, sie an die echte Uhr zu binden - genau das verbietet der Plan.
   */
  abilities: AbilityRuntime
  /**
   * Laufende Wirkungen aus Ereignissen (GDD 11 Abschnitt 5 und 6).
   *
   * Nicht im Spielstand - aus demselben Grund wie die Abklingzeiten: Eine Wirkung, die in
   * Simulationssekunden misst, ueber einen Programmstart hinweg mitzufuehren hiesse, sie an
   * die echte Uhr zu binden. Die **Entscheidung** ueberdauert (`run.eventId`), ihre
   * zeitlich begrenzte Folge nicht.
   */
  boons: Boon[]
  /**
   * Goldsammler auf dem Feld (GDD 12 Abschnitt 11).
   *
   * Ihre Anzahl folgt der gekauften Stufe, ihr Ort entsteht beim Fahren. Beides gehoert
   * nicht in den Spielstand: Die Stufe steht in `run.upgrades`, und wo ein Helfer gerade
   * steht, ist keine Auskunft, die einen Programmstart ueberdauern muss.
   */
  helpers: Helper[]
  /**
   * Was die Abwesenheit erbracht hat, bis der Spieler es weggeklickt hat (GDD 12
   * Abschnitt 5). Ein Bericht ist kein Zustand und wird deshalb nicht gesichert.
   */
  returnSummary: OfflineResult | null
}

/**
 * Eine zeitlich begrenzte Wirkung aus einem Ereignis.
 *
 * Sie traegt ihre Wirkung **als Kopie** mit und nicht als Verweis auf das Ereignis: Die
 * Wirkung laeuft weiter, auch wenn das Ereignis laengst entschieden und aus dem Spielstand
 * verschwunden ist.
 */
export type Boon = {
  /** Herkunft - nur fuer Anzeige und Selbsttest. */
  sourceId: string
  stats: Partial<Record<string, number>>
  /** Faktor auf Lebenspunkte und Schaden neu erscheinender Gegner. 1 = keine Wirkung. */
  power: number
  /** Restlaufzeit in Simulationssekunden. */
  left: number
}

/** Ein Goldsammler. Reine Laufzeitdaten - siehe `RuntimeState.helpers`. */
export type Helper = {
  x: number
  y: number
  /** Blickrichtung, nur fuer die Anzeige. */
  angle: number
}

/**
 * Ertrag einer Abwesenheit (GDD 12 Abschnitt 5).
 *
 * Steht hier und nicht in `sim/offline.ts`, weil `RuntimeState` ihn traegt und `app/` nicht
 * aus `sim/` liest - dieselbe Richtung wie ueberall sonst.
 */
export type OfflineResult = {
  /** Echte Abwesenheit in Sekunden, bereits gedeckelt. */
  seconds: number
  /** Davon tatsaechlich simuliert - der Wirkungsgrad aus GDD 12 Abschnitt 7. */
  simulated: number
  waveFrom: number
  waveTo: number
  kills: number
  gold: number
  xp: number
  /** Wie viele Stufen dabei gefallen sind. Die Perks waehlt der Spieler weiterhin selbst. */
  levels: number
}

/** Zustand der Faehigkeiten fuer diesen Programmlauf. */
export type AbilityRuntime = {
  /** Restliche Abklingzeit je Faehigkeit, in Simulationssekunden. */
  cooldowns: Map<string, number>
  /** Restlaufzeit der Wirkung je Faehigkeit, in Simulationssekunden. */
  active: Map<string, number>
}

export function createAbilityRuntime(): AbilityRuntime {
  return { cooldowns: new Map(), active: new Map() }
}

export type GameState = {
  permanent: PermanentState
  run: RunState
  runtime: RuntimeState
}

export function createInitialPermanent(): PermanentState {
  return {
    prestigePoints: 0,
    prestigeNodes: [],
    unlockedTowers: [...START_TOWER_IDS],
    unlockedCores: [START_CORE_ID],
    seenHints: [],
    bestWaveEver: 0,
    prestigeCount: 0,
    totalPlaySeconds: 0,
  }
}

export function createInitialStation(): Station {
  const station = createStation(START_CORE_ID, START_TOWER_SLOTS)
  for (const entry of START_INVENTORY) {
    station.inventory.push(newModule(station, entry.defId, entry.rarity))
  }
  return station
}

export function createInitialRun(seed: number = randomSeed()): RunState {
  return {
    seed,
    rngState: seed,
    station: createInitialStation(),
    wave: START_WAVE,
    waveRecord: START_WAVE,
    gold: START_GOLD,
    goldEarned: 0,
    towersBought: 0,
    towerOffer: [],
    coins: [],
    level: START_LEVEL,
    xp: 0,
    abilitySlots: START_ABILITY_SLOTS,
    perks: [],
    perkOffer: [],
    abilities: [],
    equipped: [],
    upgrades: {},
    autoWaves: true,
    pods: [],
    eventId: null,
    // Das erste Ereignis wird beim ersten Takt gewuerfelt. `0` heisst "noch offen" - eine
    // feste Zahl hier waere fuer jeden Run dieselbe und damit kein Zufall.
    nextEventWave: 0,
    trader: null,
    nextTraderWave: 0,
  }
}

export function createInitialState(seed: number = randomSeed()): GameState {
  const run = createInitialRun(seed)
  return {
    permanent: createInitialPermanent(),
    run,
    runtime: createRuntime(run),
  }
}

export function createRuntime(run: RunState): RuntimeState {
  const rng = createRng(run.seed)
  rng.setState(run.rngState)
  return {
    rng,
    // Fester Salzwert: Derselbe Spielstand sieht immer gleich aus, ohne den Hauptstrom
    // anzufassen. Der Zustand dieses Stroms gehoert nicht in den Spielstand.
    fxRng: createRng(run.seed).fork(0xf7),
    lastSaveAt: 0,
    dirty: false,
    // Der Kampf laeuft von selbst weiter - er ist der Ausgangspunkt (GDD 02).
    view: 'combat',
    speedFactor: 1,
    buildUid: null,
    dragUid: null,
    selectedUid: null,
    hoverUid: null,
    hoverEdge: null,
    pointer: null,
    revision: 0,
    announcedLevel: -1,
    abilities: createAbilityRuntime(),
    boons: [],
    helpers: [],
    returnSummary: null,
    combat: createCombatState(),
  }
}

/**
 * Den fortgeschriebenen Generatorzustand in die Run-Daten zurueckschreiben. Muss vor
 * jedem Speichern passieren, sonst laeuft der Zufall nach dem Laden von vorn.
 */
export function syncRngState(state: GameState): void {
  state.run.rngState = state.runtime.rng.state()
}

/** Aenderung vormerken, damit die naechste Sicherung sie mitnimmt. */
export function markDirty(state: GameState): void {
  state.runtime.dirty = true
}

