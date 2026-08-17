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
import type { UpgradeWindow } from '../data/upgrades.ts'
import {
  START_ABILITY_SLOTS,
  START_CORE_ID,
  START_GOLD,
  START_INVENTORY,
  START_LEAGUE,
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
  /**
   * Hoechste **effektive** Welle, die dieser Spielstand je gesehen hat.
   *
   * Effektiv und nicht angezeigt, weil Welle 50 in Liga 8 ungleich weiter ist als Welle 50
   * in Liga 1 - ein ligenblinder Bestwert waere kein Bestwert.
   */
  bestWaveEver: number
  /**
   * Hoechste freigeschaltete Liga (docs/liga-system.md Abschnitt 4.4).
   *
   * Sie liegt in `permanent` und nicht im Run: Muesste man die Ligen nach jedem Prestige
   * neu erklettern, waere die Liga eine zweite Prestige-Schleife - und wuerde die erste
   * verdraengen. **Wo** man spielt, ist eine Ortsfrage; **was** man besitzt, sagt der
   * Prestige-Baum.
   */
  leagueUnlocked: number
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
  /**
   * Die gerade gespielte Liga (docs/liga-system.md).
   *
   * Im Run und nicht in `permanent`: Nach dem Prestige steht ein frischer Bau in Liga 1,
   * und der haelt Liga 5 nicht aus. Was der Spieler behaelt, ist die **Erlaubnis**
   * (`permanent.leagueUnlocked`) - er darf sofort wieder hochwechseln, sobald der Bau es
   * traegt.
   */
  league: number
  /**
   * Hoechste in diesem Run erreichte Welle **je Liga** - Index `liga - 1`.
   *
   * Je Liga und nicht einmal fuer alles: Ein gemeinsamer Rekord machte die Skip-Grenze in
   * jeder hoeheren Liga sinnlos (man duerfte sofort auf Welle 50 springen), und der Rueckweg
   * in eine niedrige Liga setzte den Spieler auf Welle 1 statt dorthin, wo er dort stand.
   * Genau dieser Rueckweg ist aber die bleibende Rolle der niedrigen Ligen: sofort wieder
   * volles Einkommen, wenn man **jetzt** Gold braucht.
   *
   * Gelesen wird die Liste nie direkt, sondern ueber `waveRecord` und `raiseWaveRecord` -
   * sonst muesste jeder Aufrufer die Indexverschiebung und die Luecken selbst kennen.
   */
  waveRecords: number[]
  /**
   * Die Welle, auf der jede Liga **verlassen** wurde - Index `liga - 1`.
   *
   * Der Rueckweg soll dort ankommen, wo man war, und nicht auf Welle 1: Wer in Liga 1 auf
   * Welle 20 zurueckgegangen ist, um in Ruhe zu sammeln, will nach einem Abstecher genau
   * dort weitermachen. Der Rekord taugt dafuer nicht - er zeigt die tiefste Welle, nicht
   * die zuletzt gespielte.
   *
   * Fuer die **gerade gespielte** Liga steht die Wahrheit in `wave`; dieser Eintrag wird
   * erst beim Verlassen geschrieben (`enterLeague` in `sim/waves.ts`).
   */
  leagueWaves: number[]
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
  /**
   * Bei Upgrade-Ware das **benannte** Upgrade, das dahintersteht.
   *
   * Dieselbe Ueberlegung wie bei `perkId`, nur eine Etappe spaeter: Vorher verschenkte die
   * Ware "eine Stufe auf einem zufaelligen Pfad", und gewuerfelt wurde beim **Kauf**. Auf
   * der Karte stand damit eine Behauptung - man sah erst hinterher, was man bekommen hatte.
   * Seit E7 steht es beim Landen fest und auf der Karte.
   */
  upgradeId: string | null
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
   * Welches Upgrade-Fenster gerade offen ist (`docs/upgrade-umbau.md` Abschnitt 8.5).
   *
   * Es steht **neben** `view` und nicht darin, und das ist die Entscheidung, an der die
   * ganze Leiste haengt: Ein Wechsel zwischen zwei Fenstern ist **kein** Bereichswechsel.
   * Er tauscht die Kacheln unter dem Spielfeld aus, sonst nichts - keine Wanderung, kein
   * Neuaufbau der Anzeigen, kein Ruck an der Kamera. Waeren die vier Fenster vier `View`s,
   * bekaeme jeder Reiterklick die volle Bereichsbewegung (`ui/flip.ts`), und das Panel
   * spraenge bei jedem Blick in ein anderes Fenster.
   *
   * Nicht im Spielstand: Welcher Reiter offen war, ist Anzeigezustand.
   */
  upgradeWindow: UpgradeWindow
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
   * Der Hinweiszettel, der gerade am Rand steht - oder `null`.
   *
   * Er haelt den Platz: Was einmal steht, wird von keinem spaeteren Zettel abgeloest, bis
   * der Spieler es weggeklickt hat (`sim/hints.ts`). Ein Satz, den man zweimal anfangen
   * muss zu lesen, ist schlechter als keiner.
   *
   * Nicht im Spielstand, aus demselben Grund wie `announcedLevel`: **Was** gelesen wurde,
   * steht in `permanent.seenHints`; dass gerade einer offen liegt, ist Anzeigezustand und
   * ueberdauert keinen Programmstart.
   */
  hintId: string | null
  /**
   * Seit wann der Zettel oben am Rand steht - in gespielter Zeit
   * (`permanent.totalPlaySeconds`), gueltig nur solange `hintId` gesetzt ist.
   *
   * Der Platzhalter braucht eine Uhr, sonst haelt er ewig: Ein stehender Zettel wird von
   * keinem spaeteren abgeloest, und wer nie wegklickt, saehe damit genau einen der acht
   * Saetze. Nach `HINT_READ_SECONDS` legt `sim/hints.ts` ihn stumm ab und die Reihe geht
   * weiter.
   *
   * Gespielte Zeit und nicht Simulationszeit: Sie zaehlt echte Sekunden (`main.ts`), der
   * Zettel steht bei Tempo x4 also genauso lange wie bei x1 - Lesen wird nicht schneller,
   * nur weil die Wellen es werden.
   */
  hintSince: number
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
    leagueUnlocked: START_LEAGUE,
    prestigeCount: 0,
    totalPlaySeconds: 0,
  }
}

// ---------------------------------------------------------------------------
// Wellenrekord je Liga (docs/liga-system.md Abschnitt 7.4)
// ---------------------------------------------------------------------------

/**
 * Der Wellenrekord der **gerade gespielten** Liga.
 *
 * Diese drei Funktionen sind die einzige Auskunftsstelle ueber `run.waveRecords`. Sie
 * stehen hier, weil die Datei das Feld definiert - wer die Form kennt, kennt auch die
 * Indexverschiebung und die Luecken.
 */
export function waveRecord(state: GameState): number {
  return waveRecordOf(state.run, state.run.league)
}

/**
 * Der Wellenrekord einer beliebigen Liga.
 *
 * `START_WAVE` fuer jede Liga, in der noch nichts gespielt wurde - sie ist damit sofort
 * betretbar, aber nur auf Welle 1.
 */
export function waveRecordOf(run: RunState, league: number): number {
  return run.waveRecords[league - 1] ?? START_WAVE
}

/**
 * Den Platz dieser Liga in einer der beiden Listen sichern.
 *
 * Das Auffuellen ist kein Schoenheitsschritt: Ein Sprung in Liga 4, waehrend die Liste nur
 * einen Eintrag hat, hinterliesse sonst Loecher an 1 und 2 - und `JSON.stringify` macht aus
 * einem Loch `null`, das beim Laden als Zahl durchginge.
 */
function slotFor(list: number[], league: number): number {
  const index = Math.max(0, league - 1)
  while (list.length <= index) list.push(START_WAVE)
  return index
}

/** Rekord der gespielten Liga anheben. Senken kann er sich nie. */
export function raiseWaveRecord(state: GameState, wave: number): void {
  const list = state.run.waveRecords
  const index = slotFor(list, state.run.league)
  if (wave > (list[index] as number)) list[index] = wave
}

/** Merken, auf welcher Welle die gespielte Liga gerade steht - vor dem Verlassen. */
export function rememberLeagueWave(state: GameState): void {
  const list = state.run.leagueWaves
  list[slotFor(list, state.run.league)] = state.run.wave
}

/** Auf welcher Welle diese Liga zuletzt verlassen wurde. Nie betreten: Welle 1. */
export function leagueWaveOf(run: RunState, league: number): number {
  return run.leagueWaves[league - 1] ?? START_WAVE
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
    league: START_LEAGUE,
    waveRecords: [START_WAVE],
    leagueWaves: [START_WAVE],
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
    upgradeWindow: 1,
    speedFactor: 1,
    buildUid: null,
    dragUid: null,
    selectedUid: null,
    hoverUid: null,
    hoverEdge: null,
    pointer: null,
    revision: 0,
    announcedLevel: -1,
    hintId: null,
    hintSince: 0,
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
