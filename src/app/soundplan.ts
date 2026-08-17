/**
 * Der Klangplan: welches Ereignis wie klingt - und welches bewusst nicht.
 *
 * **Warum diese Datei getrennt von `app/audio.ts` steht.** `audio.ts` ist der Apparat: Es
 * baut den Klangkontext, holt die Aufnahmen und zaehlt die Stimmen. Ohne Browser laeuft
 * davon nichts, und pruefen laesst sich davon nichts. Die Entscheidungen dagegen - welches
 * Ereignis ueberhaupt zu hoeren ist, wie oft es hoechstens kommt, in welcher Gruppe es
 * haengt und wie laut es gegenueber dem steht, was es begleitet - sind reine Tabellen. Sie
 * stehen hier, damit sie im Selbsttest nachgerechnet werden koennen (`selftest/suites/klang.ts`),
 * ohne dass jemand zuhoert.
 *
 * Diese Datei macht **keinen Ton**. Sie haengt sich an den Ereignisbus und reicht weiter,
 * was zu spielen waere; was daraus wird, entscheidet der Rueckruf, den `audio.ts`
 * mitbringt. Faellt `audio.ts` weg, ruft niemand mehr {@link attachCues}, und es bleibt
 * still - ohne Fehler, wie zugesagt.
 *
 * ---
 *
 * **Die vier Regeln, nach denen der Plan gebaut ist.**
 *
 * **1. Jedes Ereignis ist entschieden.** Entweder es steht in {@link SOUND_PLAN} oder in
 * {@link SILENT_EVENTS}, und dort mit einem Satz, warum es stumm bleibt. Ein Ereignis, das
 * in keiner der beiden Listen steht, ist ein Uebersetzungsfehler
 * ({@link everyEventDecided}) - nicht, weil Stille schlimm waere, sondern weil
 * *unbeabsichtigte* Stille schlimm ist. Genau die war der Zustand vorher: sechsundzwanzig
 * Ereignisse ohne Zuhoerer, keines davon aus einem Grund.
 *
 * **2. Kein Klang ohne Wiederholsperre.** Jeder Eintrag nennt eine Klangart, und jede
 * Klangart steht in {@link THROTTLE}. Ereignisse kommen in Buendeln - drei Stufen in
 * einem Takt, vier Faehigkeiten gleichzeitig bereit, hundert Muenzen in einer Welle. Ohne
 * Sperre waere das kein Klang, sondern ein Rauschen.
 *
 * **3. Was zusammengehoert, teilt sich die Sperre.** Der Fall der Station und der Verlust
 * der Welle sind zwei Meldungen desselben Augenblicks (`sim/waves.ts`, `sim/combat.ts`).
 * Beide klingen - aber weil sie dieselbe Klangart tragen, kommt der Zusammenbruch genau
 * einmal, gleich welche der beiden Meldungen zuerst eintrifft. Dasselbe gilt fuer Schuss
 * und kritischen Schuss.
 *
 * **4. Die Quittung ist leiser als das, was sie quittiert.** Ein Kauf darf nicht lauter
 * sein als der Stufenaufstieg, auf den er hinarbeitet, und das Aufheben der Muenze nicht
 * lauter als der Abschuss, der sie fallen liess. Nachgerechnet wird das im Selbsttest;
 * hier stehen nur die Zahlen, an denen es haengt.
 */

import { EVENT_NAMES, on, type EventMap, type EventName, type Unsubscribe } from '../core/events.ts'
import type { Bus } from './mixer.ts'

/* === Was ein Klang ist ===================================================== */

/**
 * Der gerechnete Ersatz, falls die Aufnahme noch nicht da ist.
 *
 * `from`/`to` sind Tonhoehen in Hertz - ein Rutsch nach unten klingt nach Einschlag, einer
 * nach oben nach Belohnung. Das ist kein Entwurf, sondern ein Platzhalter fuer die ersten
 * Augenblicke nach dem Start: Ein fehlendes Geraeusch darf nie eine Fehlermeldung geben und
 * auch keine Stille an einer Stelle, an der etwas passiert ist.
 */
export type ToneSpec = {
  from: number
  to: number
  seconds: number
  peak: number
  type: OscillatorType
}

/** Ein Klang, wie ihn der Apparat spielen soll. */
export type SoundCue = {
  /**
   * Die Klangart - der Schluessel der Wiederholsperre. Zwei Klaenge mit derselben Art
   * lassen sich gegenseitig aus; das ist gewollt, wo sie denselben Vorgang beschreiben.
   */
  kind: string
  /** Der Name der Aufnahme in `public/sfx`, ohne Nummer der Variante. */
  sample: string
  /** Pegel dieser Stimme, bevor der Gruppenregler daraufkommt. */
  gain: number
  /** Ersatz, solange die Aufnahme fehlt. Ohne Angabe entscheidet die Gruppe. */
  tone?: ToneSpec
}

/**
 * Ein Eintrag im Plan: fester Klang oder einer, der von der Nutzlast abhaengt.
 *
 * Abhaengig ist genau ein Fall - der kritische Schuss. Dafuer eine eigene Liste zu fuehren
 * waere mehr Umstand als die Funktion hier.
 */
export type CueFor<K extends EventName> = SoundCue | ((payload: EventMap[K]) => SoundCue)

export type SoundPlan = { [K in EventName]?: CueFor<K> }

/* === Wiederholsperren ====================================================== */

/**
 * Kuerzester Abstand zwischen zwei Toenen derselben Art, in echten Sekunden.
 *
 * Sie stehen hier und nicht in `data/balance.ts`, weil sie keine Spielregel sind: Wer sie
 * aendert, veraendert kein Kraefteverhaeltnis, sondern nur, wie voll es klingt.
 *
 * Die Werte sind nach der Herkunft der Buendel gestaffelt:
 *
 *   - **Dauertakt** (Schuss, Abschuss, Muenze): unter einer Zehntelsekunde. Sie sollen sich
 *     ueberlagern duerfen, nur nicht verschmelzen.
 *   - **Handgriffe** (Bauen, Kaufen, Waehlen, Bereichswechsel): rund eine Zehntelsekunde.
 *     Schneller kann ein Mensch nicht zweimal dasselbe wollen - was schneller kommt, ist
 *     ein Doppelklick oder eine Kette, die die Oberflaeche selbst ausgeloest hat.
 *   - **Zaesuren** (Welle, Boss, Stufe, Niederlage, Prestige): eine halbe Sekunde und mehr.
 *     Drei Stufen in einem Takt sind ein Aufstieg, nicht drei - und `level.up` meldet sich
 *     je Stufe einzeln (`core/events.ts`).
 */
export const THROTTLE: Record<string, number> = {
  // Dauertakt
  shot: 0.07,
  kill: 0.06,
  coin: 0.09,
  pod: 0.1,
  damage: 0.12,
  ability: 0.15,
  // Handgriffe
  click: 0.1,
  view: 0.15,
  build: 0.1,
  buy: 0.12,
  pick: 0.12,
  ready: 0.2,
  melt: 0.3,
  hail: 0.3,
  deny: 0.3,
  wipe: 0.5,
  // Zaesuren
  event: 0.3,
  wave: 0.4,
  trader: 0.4,
  boss: 0.5,
  level: 0.6,
  prestige: 1,
  lost: 1.5,
}

/**
 * Die Sperre als eigener kleiner Apparat - damit sie sich messen laesst.
 *
 * Es ist genau dieselbe Funktion, die im Spiel entscheidet. Eine zweite, nachgebaute
 * Rechnung im Test wuerde messen, was der Messende glaubt, und nicht, was der Spieler
 * hoert.
 */
export type Gate = {
  /** Darf jetzt ein Ton dieser Art kommen? Ein `true` verbraucht den Platz sofort. */
  allow(kind: string, now: number): boolean
}

export function createGate(): Gate {
  /** Zeitpunkt des letzten durchgelassenen Tons je Art, in Sekunden. */
  const lastAt = new Map<string, number>()

  return {
    allow(kind, now) {
      const gap = THROTTLE[kind] ?? 0
      const last = lastAt.get(kind)
      if (last !== undefined && now - last < gap) return false
      lastAt.set(kind, now)
      return true
    },
  }
}

/* === Aufnahmen und Gruppen ================================================= */

/**
 * Der Klangsatz: Name der Aufnahme und wie viele Varianten davon liegen.
 *
 * Die Namen sind die der **Bedeutung**, nicht die der Quelldatei - welches Rohmaterial
 * dahintersteckt, steht in `tools/klang-bauen.mjs` und in `docs/anlagen.md`. Diese Datei
 * soll wissen, **wann** etwas klingt, nicht **woher** es kommt.
 *
 * Die Anzahl der Varianten folgt der Haeufigkeit: Das Aufheben von Gold hoert der Spieler
 * hundertmal je Welle und bekommt alle sechs, ein Prestige einmal je Lauf und bekommt zwei.
 */
export const SAMPLES: Record<string, number> = {
  // Feld
  coin: 6,
  pod: 3,
  poddrop: 3,
  shot: 4,
  crit: 3,
  kill: 4,
  hurt: 3,
  ability: 3,
  // Zaesuren
  bossin: 2,
  bossdown: 2,
  lost: 2,
  wavein: 2,
  waveout: 2,
  level: 2,
  prestige: 2,
  event: 2,
  // Bedienung
  ready: 2,
  buy: 3,
  build: 2,
  trade: 2,
  trader: 2,
  click: 3,
  swipe: 3,
  lift: 2,
  scrap: 2,
  melt: 2,
  deal: 3,
  pick: 3,
  unlock: 2,
  equip: 2,
  deny: 2,
  wipe: 2,
  hail: 2,
  depart: 2,
}

/**
 * Wie laut eine Aufnahme wirklich ist - gemessen, nicht geschaetzt.
 *
 * **Warum es diese Tabelle geben muss.** Der Bauplan steuert jede Aufnahme auf dieselbe
 * Spitze aus: 0,89, bei allen sechsundfuenfzig. Ein Pegel, der gegen die Spitze gesetzt
 * wird, ist damit gegen eine Konstante gesetzt und sagt ueber die Lautstaerke gar nichts.
 * Der Klick der Oberflaeche (0,18 s) und der Abflug der Drohne (1,40 s) haben dieselbe
 * Spitze und liegen zehn Dezibel auseinander. Genau daran ist die vierte Regel weiter unten
 * bis hierher vorbeigegangen: Sie stand in der Datei, sie stand im Test - und der Test
 * konnte sie nicht sehen, weil er `gain` mit `gain` verglich.
 *
 * **Was die Zahl ist.** Der Effektivwert im lautesten 400-ms-Fenster, gemittelt ueber die
 * Varianten eines Klangs - die Momentanlautheit nach dem Fenster aus ITU-R BS.1770,
 * unbewertet. Gemessen von `tools/klang-messen.mjs`, dort steht die Rechnung und dort steht
 * auch, warum ohne Frequenzbewertung gemessen wird.
 *
 * **Wie sie hierher kommt.** `node tools/klang-messen.mjs --schreiben` ersetzt den Block
 * zwischen den beiden Marken. Von Hand aendern hiesse, eine Messung zu erfinden.
 *
 * **Wofuer sie da ist.** Damit `gain` mal Lautheit gerechnet werden kann - das ist die
 * Zahl, die der Spieler hoert, und die einzige, in der sich die vierte Regel pruefen laesst
 * (`selftest/suites/klang.ts`). Der Klangapparat benutzt sie **nicht**: Er spielt `gain`,
 * wie er es immer getan hat. Diese Tabelle ist die Messlatte, an der `gain` gesetzt wurde,
 * kein zweiter Regler im Signalweg.
 */
/* gemessen: tools/klang-messen.mjs --schreiben */
export const LOUDNESS: Record<string, number> = {
  ability: 0.1409,
  bossdown: 0.1537,
  bossin: 0.1202,
  build: 0.1773,
  buy: 0.0575,
  click: 0.0719,
  coin: 0.0764,
  crit: 0.2197,
  deal: 0.2115,
  deny: 0.0999,
  depart: 0.2362,
  equip: 0.2031,
  event: 0.1937,
  hail: 0.2071,
  hurt: 0.2214,
  kill: 0.1758,
  level: 0.1240,
  lift: 0.1052,
  lost: 0.2432,
  melt: 0.0698,
  pick: 0.0573,
  pod: 0.1510,
  poddrop: 0.0904,
  prestige: 0.1628,
  ready: 0.1666,
  scrap: 0.1730,
  shot: 0.1575,
  swipe: 0.1419,
  trade: 0.1407,
  trader: 0.2062,
  unlock: 0.0544,
  wavein: 0.2117,
  waveout: 0.1804,
  wipe: 0.0744,
}
/* Ende der gemessenen Tabelle */

/**
 * Klaenge, die im Dauertakt kommen und deshalb zusaetzlich in der Tonhoehe streuen.
 *
 * Nur diese: Eine Zaesur soll jedes Mal gleich klingen, sonst wird aus dem Wiedererkennen
 * ein Raten. Ein Schuss dagegen darf jedes Mal ein wenig anders sitzen. Der Klick der
 * Oberflaeche gehoert ausdruecklich **nicht** dazu - ein Knopf, der jedes Mal anders
 * klingt, fuehlt sich kaputt an und nicht lebendig.
 */
export const DETUNED: ReadonlySet<string> = new Set(['coin', 'shot', 'kill', 'hurt', 'crit'])

/**
 * In welche Gruppe ein Klang faellt.
 *
 * Die Zuordnung folgt nicht der Technik, sondern der Frage, die sich der Spieler beim
 * Regler stellt. "Zu laut" heisst fast nie "alles zu laut", sondern eines von dreien:
 *
 *   `music`  Die Zaesuren - Wellenanfang und -ende, das Bossmotiv, Stufenaufstieg,
 *            Niederlage, Prestige. Sie liegen ueber dem durchlaufenden Musikbett
 *            (`app/musicbed.ts`), das an demselben Regler haengt: Was hier steht, sind die
 *            Ausrufezeichen der Partitur, nicht die Partitur selbst.
 *   `sfx`    Das Feld: Schuss, kritischer Treffer, Tod, Einschlag, Muenze, Kapsel,
 *            Faehigkeit. Das ist der Dauerton, und der ist es, den man leiser dreht.
 *   `ui`     Was der Spieler selbst anfasst: Bauen, Umsetzen, Abreissen, Kaufen, Waehlen,
 *            Handeln, Bereichswechsel. Diese Klaenge sind Quittungen - wer sie abschaltet,
 *            verliert eine Rueckmeldung und keine Stimmung.
 *
 * Der Schluessel ist der Name der Aufnahme **und** der Name der Sperre - beide zeigen auf
 * dieselbe Gruppe, damit der gerechnete Ersatzton nicht in einem anderen Bus landet als die
 * Aufnahme, die er vertritt. Was hier fehlt, faellt auf `sfx`: die Gruppe, in der ein
 * unbekannter Klang am wenigsten stoert.
 */
export const BUS_OF: Record<string, Bus> = {
  // --- Partitur ---
  wave: 'music',
  wavein: 'music',
  waveout: 'music',
  boss: 'music',
  bossin: 'music',
  bossdown: 'music',
  lost: 'music',
  level: 'music',
  prestige: 'music',
  // --- Feld ---
  shot: 'sfx',
  crit: 'sfx',
  kill: 'sfx',
  damage: 'sfx',
  hurt: 'sfx',
  coin: 'sfx',
  pod: 'sfx',
  poddrop: 'sfx',
  ability: 'sfx',
  // --- Bedienung ---
  ui: 'ui',
  buy: 'ui',
  build: 'ui',
  trade: 'ui',
  trader: 'ui',
  ready: 'ui',
  event: 'ui',
  click: 'ui',
  view: 'ui',
  swipe: 'ui',
  lift: 'ui',
  scrap: 'ui',
  melt: 'ui',
  deal: 'ui',
  pick: 'ui',
  unlock: 'ui',
  equip: 'ui',
  deny: 'ui',
  wipe: 'ui',
  hail: 'ui',
  depart: 'ui',
}

/** Unbekanntes faellt auf `sfx` - ein fehlender Eintrag darf nie Stille bedeuten. */
export function busOf(name: string, kind: string): Bus {
  return BUS_OF[name] ?? BUS_OF[kind] ?? 'sfx'
}

/** Die Gruppe, in der ein Klang landet. */
export function busOfCue(cue: SoundCue): Bus {
  return busOf(cue.sample, cue.kind)
}

/**
 * Der Ersatzton einer Gruppe, wenn der Eintrag keinen eigenen nennt.
 *
 * Drei Platzhalter statt neununddreissig: Solange eine Aufnahme fehlt, soll man hoeren
 * **dass** etwas passiert ist und in welcher Ecke - nicht was. Ein ausgearbeiteter
 * Ersatzton fuer jeden Eintrag waere ein zweiter Klangsatz, den niemand pflegt und fast
 * niemand hoert.
 */
const BUS_TONE: Record<Bus, ToneSpec> = {
  music: { from: 220, to: 660, seconds: 0.4, peak: 0.1, type: 'triangle' },
  sfx: { from: 620, to: 300, seconds: 0.08, peak: 0.05, type: 'square' },
  ui: { from: 700, to: 980, seconds: 0.09, peak: 0.05, type: 'triangle' },
}

export function toneOf(cue: SoundCue): ToneSpec {
  return cue.tone ?? BUS_TONE[busOfCue(cue)]
}

/* === Der Plan ============================================================== */

/**
 * Was klingt, und wie laut.
 *
 * **Der Pegel allein sagt nichts.** Ein `gain` von 0,34 auf `depart` ist zehn Dezibel lauter
 * als derselbe `gain` auf `click` - beide Aufnahmen haben die Spitze 0,89, aber die eine
 * traegt 1,40 Sekunden und die andere 0,18. Wer die Pegel gegeneinander liest, liest die
 * falsche Zahl. Gelesen wird `gain` mal {@link LOUDNESS}; das ist, was ankommt.
 *
 * **Die Bedienung steht in drei Stufen.** Nicht in Pegeln, sondern in Lautheiten - deshalb
 * sehen die Zahlen daneben ungleich aus, obwohl das Ergebnis gleich ist. `unlock` braucht
 * 0,70, um dort zu landen, wo `trader` mit 0,24 steht:
 *
 *   - **stark** rund 0,050: was das Feld veraendert und selten kommt - bauen, abreissen,
 *     einschmelzen, ein Ereignis, die Ankunft der Drohne, eine Meldung ueber den Spielstand.
 *   - **mittel** rund 0,038: die gewoehnliche Quittung - kaufen, anbieten, handeln, waehlen,
 *     freischalten, bereitmelden.
 *   - **leise** rund 0,026: was nebenher passiert - Bereichswechsel, Umsetzen, Schalter,
 *     Ausruesten.
 *   - **der Hinweis** 0,011, allein und ganz unten. Er wird einmal weggeklickt und nie
 *     wieder; er ist der leiseste Klang des Spiels und bleibt es (`selftest/suites/klang.ts`).
 *
 * **Feld** 0,018 bis 0,093 in Lautheit, gestaffelt nach Haeufigkeit - je oefter, desto
 * leiser. Die Muenze ist der leiseste Dauerklang, der Einschlag in die Station der lauteste.
 *
 * **Zaesur** ab 0,062. Das ist keine gewaehlte Grenze, sondern eine gemessene: Die leiseste
 * Zaesur ist der Stufenaufstieg, und ueber ihm darf keine Quittung liegen. Der Abstand zur
 * lautesten Bedienung betraegt 1,8 dB.
 */
export const SOUND_PLAN = {
  /* --- Bedienung: jeder Handgriff bekommt seine Quittung ------------------ */

  // leise: der Bereichswechsel ist eine Bewegung, keine Handlung an einem Ding.
  'view.changed': { kind: 'view', sample: 'swipe', gain: 0.18 },
  // Tempo und Selbstlauf sind Schalter. Derselbe Klick fuer beide - es ist dieselbe Art
  // von Handlung, und zwei Klaenge waeren zwei Vokabeln fuer eine Sache.
  'loop.speedChanged': { kind: 'click', sample: 'click', gain: 0.36 },
  'wave.autoModeChanged': { kind: 'click', sample: 'click', gain: 0.36 },
  // Der leiseste Klang im Spiel: Ein Hinweis wird einmal weggeklickt und nie wieder. Dass
  // er der leiseste **bleibt**, prueft `selftest/suites/klang.ts` - und zwar an der
  // Lautheit, nicht am Pegel: Derselbe 0,15 auf einer laengeren Aufnahme waere dreimal so
  // laut, und die Zusage waere still gebrochen.
  'hint.seen': { kind: 'click', sample: 'click', gain: 0.15 },

  // Bauen, Umsetzen, Abreissen - dieselbe Hand, deshalb dieselbe Sperre. Wer ein Modul
  // absetzt und im selben Zehntel ein zweites aufnimmt, hat nicht zweimal gebaut.
  // Absetzen und Abreissen veraendern das Feld und stehen stark; das blosse Aufnehmen zum
  // Umsetzen tut es nicht und steht leise.
  'module.placed': { kind: 'build', sample: 'build', gain: 0.28 },
  'module.moved': { kind: 'build', sample: 'lift', gain: 0.25 },
  'module.removed': { kind: 'build', sample: 'scrap', gain: 0.29 },

  // Der Wurf ist bezahlt, die Karte ist genommen (GDD 06 §1) - zwei Schritte, zwei Klaenge,
  // eine Sperre: Sie koennen nie im selben Zehntel passieren, und wenn doch, war es einer.
  // 0,18 gegen 0,66 fuer dieselbe Lautheit: `deal` traegt 0,55 s, `buy` nur 0,28 s.
  'tower.offered': { kind: 'buy', sample: 'deal', gain: 0.18 },
  'tower.bought': { kind: 'buy', sample: 'buy', gain: 0.66 },
  'upgrade.bought': { kind: 'buy', sample: 'buy', gain: 0.66 },
  'trader.bought': { kind: 'buy', sample: 'trade', gain: 0.27 },
  // Einschmelzen ist endgueltig und soll sich auch so anhoeren - trotzdem eine Quittung.
  // 0,70 ist die Obergrenze des Bandes; lauter kommt `melt` nicht, die Aufnahme gibt es
  // nicht her (-23,1 dB, die drittleiseste des Satzes).
  'tower.melted': { kind: 'melt', sample: 'melt', gain: 0.7 },

  // Waehlen: Perk, Ereignisentscheidung, Faehigkeit. Alles derselbe Griff.
  // Die Perkwahl faellt im selben Augenblick wie der Stufenaufstieg, der sie oeffnet -
  // deshalb steht sie in Hoerweite darunter (4,3 dB) und nicht acht Dezibel tiefer, wie
  // sie es tat, solange der Pegel gegen die Spitze gesetzt war.
  'perk.chosen': { kind: 'pick', sample: 'pick', gain: 0.66 },
  'event.resolved': { kind: 'pick', sample: 'pick', gain: 0.45 },
  'ability.unlocked': { kind: 'pick', sample: 'unlock', gain: 0.7 },
  'ability.equipped': { kind: 'pick', sample: 'equip', gain: 0.13 },
  'prestige.nodeBought': { kind: 'pick', sample: 'unlock', gain: 0.7 },

  // Mehrere Abklingzeiten laufen gleichzeitig ab - die Sperre macht daraus eine Meldung.
  'ability.ready': { kind: 'ready', sample: 'ready', gain: 0.23 },

  // Die Drohne: Ankunft, Begruessung, Abflug. Ankunft und Abflug teilen sich die Sperre -
  // sie kann nicht abfliegen und im selben Augenblick wieder landen. Die drei Aufnahmen
  // sind die laengsten der Bedienung (1,60 s / 1,40 s / 0,57 s) und brauchen deshalb die
  // kleinsten Pegel des Plans; mit 0,40 und 0,34 war die Drohne bisher lauter als der
  // Stufenaufstieg.
  'trader.arrived': { kind: 'trader', sample: 'trader', gain: 0.24 },
  'trader.left': { kind: 'trader', sample: 'depart', gain: 0.16 },
  'trader.opened': { kind: 'hail', sample: 'hail', gain: 0.18 },

  // Ein Ereignis haelt das Spiel an und verlangt eine Entscheidung.
  'event.triggered': { kind: 'event', sample: 'event', gain: 0.26 },

  // Zwei Meldungen aus dem Spielstand, die den Spieler wirklich angehen: Der Speicher ist
  // geloescht, oder er war nicht zu lesen. Beides passiert selten und muss ankommen.
  'save.cleared': { kind: 'wipe', sample: 'wipe', gain: 0.67 },
  'save.corrupt': { kind: 'deny', sample: 'deny', gain: 0.5 },

  /* --- Feld: der Dauerton, gestaffelt nach Haeufigkeit -------------------- */

  // Der kritische Treffer bekommt eine eigene Aufnahme, teilt sich aber die Sperre mit dem
  // gewoehnlichen Schuss: Es ist derselbe Vorgang, und zwei getrennte Sperren liessen bei
  // hoher Kritchance doppelt so viel durch wie gewollt.
  'tower.fired': (payload: EventMap['tower.fired']): SoundCue =>
    payload.crit
      ? { kind: 'shot', sample: 'crit', gain: 0.32 }
      : { kind: 'shot', sample: 'shot', gain: 0.2 },
  'enemy.killed': { kind: 'kill', sample: 'kill', gain: 0.28 },
  // Leiser als der Abschuss, der sie fallen liess: Die Muenze ist die Quittung, nicht die Tat.
  'gold.collected': { kind: 'coin', sample: 'coin', gain: 0.24 },
  'pod.dropped': { kind: 'pod', sample: 'poddrop', gain: 0.34 },
  'pod.collected': { kind: 'pod', sample: 'pod', gain: 0.5 },
  'station.damaged': { kind: 'damage', sample: 'hurt', gain: 0.42 },
  // Gemessen 0,049 - dieselbe Lautheit wie der Abschuss. Eine gezuendete Faehigkeit ist
  // eine Handlung des Spielers mitten im Feld und darf sich neben ihm behaupten.
  'ability.activated': { kind: 'ability', sample: 'ability', gain: 0.35 },

  /* --- Zaesuren: die Partitur dieses Spiels ------------------------------- */

  'wave.started': { kind: 'wave', sample: 'wavein', gain: 0.42 },
  'wave.cleared': { kind: 'wave', sample: 'waveout', gain: 0.44 },
  // Der Fall der Station und der Verlust der Welle sind derselbe Augenblick: `restartWave`
  // laeuft im selben Takt, in dem die HP auf null gehen (`sim/battle.ts`). Beide melden
  // sich, beide klingen - und weil sie dieselbe Klangart tragen, kommt der Zusammenbruch
  // genau einmal, gleich welche Meldung zuerst da ist.
  'station.destroyed': { kind: 'lost', sample: 'lost', gain: 0.6 },
  'wave.lost': { kind: 'lost', sample: 'lost', gain: 0.6 },
  'boss.spawned': { kind: 'boss', sample: 'bossin', gain: 0.55 },
  'boss.killed': { kind: 'boss', sample: 'bossdown', gain: 0.6 },
  'level.up': { kind: 'level', sample: 'level', gain: 0.5 },
  // Eine neue Liga steht offen - die zweitgroesste Zaesur nach dem Prestige und die
  // seltenste ueberhaupt: neunmal im ganzen Spiel. Sie leiht sich den Prestige-Klang, weil
  // beide dasselbe sagen ("von hier an ist es ein anderes Spiel") und ein eigener Ton fuer
  // neun Augenblicke eine Aufnahme waere, die niemand wiedererkennt.
  'league.unlocked': { kind: 'prestige', sample: 'prestige', gain: 0.55 },
  'prestige.done': { kind: 'prestige', sample: 'prestige', gain: 0.6 },
} satisfies SoundPlan

/**
 * Was **bewusst** stumm bleibt - und warum.
 *
 * Ein Satz je Ereignis, und der Satz muss eine Begruendung sein und keine Beschreibung.
 * Diese Liste ist der eigentliche Ertrag der Aufraeumung: Vorher war stumm, woran niemand
 * gedacht hatte; jetzt ist stumm, was stumm sein soll.
 */
export const SILENT_EVENTS = {
  'league.changed':
    'Der Ligenwechsel loest unmittelbar `wave.started` aus - und der klingt bereits. Ein ' +
    'eigener Ton davor waere derselbe Augenblick zweimal, und zwar bei einer Handlung, die ' +
    'folgenlos und beliebig oft wiederholbar ist.',
  'reward.granted':
    'Die Sammelmeldung jeder Belohnung - was in ihr steckt, klingt bereits an seiner Stelle ' +
    '(gold.collected, level.up, prestige.nodeBought). Ein Ton hier waere jede Belohnung zweimal.',
  'gold.spent':
    'Jede Art, Gold auszugeben, hat ihren eigenen, genaueren Klang (tower.offered, ' +
    'upgrade.bought, ability.unlocked, trader.bought). Ein zweiter Ton daneben macht aus ' +
    'jedem Kauf ein Doppel.',
  'prestige.spent':
    'Dasselbe eine Ebene hoeher: Bezahlt wird immer fuer einen Knoten, und der meldet sich ' +
    'selbst (prestige.nodeBought).',
  'enemy.damaged':
    'Der Schuss davor und der Abschuss danach fassen den Treffer bereits ein. Ein dritter ' +
    'Ton dazwischen traegt keine neue Auskunft und kommt je Geschoss - bei zwanzig Tuermen ' +
    'waere er der lauteste Klang des Spiels.',
  'save.written':
    'Der Spielstand schreibt sich von selbst, im Hintergrund, ohne Zutun des Spielers. Ein ' +
    'Klang dafuer waere ein Klang fuer nichts, was jemand getan hat.',
  'save.loaded':
    'Faellt beim Start, bevor die Seite beruehrt wurde - da verbietet der Browser jeden Ton. ' +
    'Ein Zuhoerer hier waere einer, den nie etwas erreicht.',
  'offline.resolved':
    'Die Abwesenheit wird verrechnet, bevor der Klang ueberhaupt angeschlossen ist ' +
    '(`main.ts`: erst die Nachholrechnung, dann `mountAudio`) - sonst meldete der ' +
    'Schnelldurchlauf zehntausend Treffer auf einmal.',
} satisfies Partial<Record<EventName, string>>

/** Ereignisse, ueber die weder Klang noch Stille entschieden wurde. Im Idealfall keine. */
type UndecidedEvent = Exclude<EventName, keyof typeof SOUND_PLAN | keyof typeof SILENT_EVENTS>

/**
 * Die Vollstaendigkeit als Zuweisung: Kommt ein neues Ereignis dazu, ohne dass jemand ueber
 * seinen Klang entschieden hat, nennt der Uebersetzer seinen Namen.
 */
const everyEventDecided: UndecidedEvent extends never
  ? true
  : { ohneKlangentscheidung: UndecidedEvent } = true
void everyEventDecided

/* === Der Anschluss ========================================================= */

/**
 * Den Plan an den Ereignisbus haengen.
 *
 * `play` bekommt, was zu spielen waere. Was daraus wird, weiss diese Datei nicht - im
 * Spiel ist es ein Ton, im Selbsttest ein Strich auf einem Zettel. Genau deshalb laesst
 * sich die Abdeckung ohne Klangapparat pruefen.
 */
export function attachCues(play: (cue: SoundCue, name: EventName) => void): Unsubscribe[] {
  const plan: SoundPlan = SOUND_PLAN
  const stops: Unsubscribe[] = []

  for (const name of EVENT_NAMES) {
    const entry = plan[name]
    if (!entry) continue
    // Ueber die Schleife laeuft der Zusammenhang zwischen Ereignis und Nutzlast nicht mit -
    // er steht in `SoundPlan` und ist dort geprueft. Hier ist die Nutzlast nur
    // durchzureichen, und `unknown` ist die ehrliche Angabe dafuer.
    const pick = entry as SoundCue | ((payload: unknown) => SoundCue)
    stops.push(
      on(name, (payload: unknown) => {
        play(typeof pick === 'function' ? pick(payload) : pick, name)
      }),
    )
  }

  return stops
}

/** Wie viele Ereignisse einen Klang haben - die Zahl, an der die Abdeckung haengt. */
export function plannedEventCount(): number {
  return Object.keys(SOUND_PLAN).length
}
