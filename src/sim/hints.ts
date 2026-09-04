/**
 * Einmalige Hinweise (GDD 14 Abschnitt 4a).
 *
 * Es gibt **kein gefuehrtes Tutorial**. Das Spiel erklaert sich ueber die Reihenfolge
 * seiner Freischaltungen; ein Hinweis ist nur der Fingerzeig im Augenblick, in dem ein
 * System zum ersten Mal gebraucht wird.
 *
 * Die Regeln aus dem GDD stehen hier als Bauart und nicht als Vorsatz:
 *   - **Genau einmal.** `permanent.seenHints` merkt sich, was schon gezeigt wurde; die
 *     Liste ueberlebt jedes Prestige, weil das Gelernte es auch tut.
 *   - **Im Moment der Relevanz.** Jeder Hinweis traegt seine Bedingung selbst. Sie wird
 *     gegen den Zustand geprueft, nicht gegen einen Fortschrittsschritt - dadurch kann ein
 *     Hinweis nicht "verpasst" werden.
 *   - **Kein Anhalten.** Diese Datei entscheidet nur, *was* faellig ist. Sie zeigt nichts
 *     an und haelt nichts an; das Fenster in `ui/hints.ts` ist ein Zettel am Rand.
 *
 * Dazu kommen zwei Regeln, ohne die die drei oberen sich selbst im Weg stehen:
 *
 *   - **Die Liste ist eine Reihe, kein Suchlauf.** Faellig ist immer genau der naechste
 *     ungesehene Zettel - nie ein spaeterer, dessen Bedingung zufaellig frueher zutrifft.
 *     Ohne diese Regel gewaenne, sobald der erste Verstaerker im Lager liegt, dessen
 *     Hinweis gegen jeden frueheren, dessen Augenblick gerade nicht zutrifft: Der Satz
 *     spraeche von "module" und "edge", bevor der Spieler die Basis gesehen hat, und
 *     pendelte danach im Sekundentakt zwischen zwei zusammenhanglosen Saetzen.
 *     Als Reihe gelesen ist die Folge der gezeigten Kennungen **monoton**: Keine kehrt
 *     zurueck, nachdem eine andere dran war.
 *
 *   - **Eine Bedingung beschreibt Geschehenes, nicht einen Augenblick.** "Die erste Muenze
 *     ist gefallen" bleibt wahr, auch wenn sie schon eingesammelt ist. Sonst verschwaende
 *     der Zettel unter der Hand des Lesers, sobald der Zustand kippt, den er beschreibt.
 *
 * Eine Reihe hat eine Eigenschaft, die eine blosse Liste nicht hat: Sie kann **stecken
 * bleiben**. Wartet der Zeiger auf einen Augenblick, der bei diesem Spieler nie kommt,
 * steht die ganze Reihe dahinter still - und mit ihr das einzige Wort, das das Spiel von
 * sich aus an ihn richtet. Dagegen stehen drei Regeln, und sie sind der Kern dieser Datei:
 *
 *   - **Ein Zettel kann vorzeitig aussteigen.** `gone` sagt, dass sein Augenblick vorbei
 *     ist: Der Gegenstand, von dem er spricht, ist weg, oder der Spieler hat die Sache
 *     nachweislich hinter sich. Ein solcher Zettel wird stumm abgelegt, der Zeiger geht
 *     weiter. Die Angabe steht nur dort, wo der Spielstand eine ehrliche Spur dafuer
 *     hergibt - beim Einschmelzen gibt es keine, und geraten wird nicht.
 *
 *   - **Und jeder Zettel hat eine Frist.** `gone` haengt an Handlungen, und wer eine
 *     Handlung nie ausfuehrt, bei dem trifft es nie zu - der Verstaerker, der ewig im
 *     Lager liegt, weil nie ein Modul angedockt wird, ist genau dieser Fall. Deshalb
 *     bekommt jeder Zettel zusaetzlich eine Frist in **gespielter Zeit** (`hintDeadline`).
 *     Gespielte Zeit vergeht immer, in jedem Spielverlauf, ohne Zutun - damit ist bewiesen,
 *     dass die Reihe unter keinem Verlauf ewig steht.
 *
 *   - **Der Augenblick zaehlt mehr als der Verfall.** Trifft beides zugleich zu, wird der
 *     Zettel gezeigt. Sonst verloere ihn ausgerechnet der Spieler, der zoegert: Wer die
 *     ersten Zettel lange stehen laesst, erreicht die spaeteren erst, wenn ihre Frist
 *     laengst laeuft - und bekaeme sie dann nie zu sehen.
 *
 * Genau umgekehrt beim **Laden** eines Spielstands (`settleHints`): Dort zaehlt der Verfall
 * mehr, denn ein Spielstand sagt nicht, wann etwas geschehen ist. Wer auf Welle 40 steht,
 * hat das Einsammeln von Gold hinter sich, auch wenn die Bedingung dafuer noch zutrifft -
 * ihm die Anfaengerreihe neu vorzuspielen waere die schlechtere Wahl.
 *
 * Und weil ein Hinweis gelesen werden soll: **Ein stehender Zettel wird nicht ersetzt.**
 * Was einmal am Rand steht, bleibt dort - auch wenn inzwischen ein spaeterer faellig waere
 * (`runtime.hintId`).
 *
 * Diese Regel ist selbst eine Warteschlange und damit derselben Gefahr ausgesetzt wie die
 * Reihe: **Der stehende Zettel hat deshalb ebenfalls eine Frist** (`HINT_READ_SECONDS`,
 * gemessen ab `runtime.hintSince`). Ohne sie waere die Zusage von oben wertlos - ein Zettel,
 * der nicht abgeloest wird, haelt die ganze Reihe an, solange er steht, und "bis der Spieler
 * ihn weggeklickt hat" ist wieder eine Handlung, die mancher Spieler nie ausfuehrt. Wer nie
 * auf "Got it" klickt, saehe genau einen der acht Saetze, fuer immer. Nach der Lesefrist wird
 * der Zettel deshalb stumm abgelegt und die Reihe geht weiter; die Zahl selbst ist in
 * `data/balance.ts` aus der Laenge des laengsten Textes hergeleitet, damit die Frist nie
 * kuerzer ist als das Lesen dauert.
 *
 * Der Text steht in `data/strings.ts` wie jeder Spielertext (GDD 16 Abschnitt 1), die
 * Bedingung hier - sie ist eine Abfrage auf den Spielzustand und gehoert damit in `sim/`.
 */

import { emit } from '../core/events.ts'
import type { StringKey } from '../data/strings.ts'
import {
  BOSS_WAVE_INTERVAL,
  HINT_GRACE_SECONDS,
  HINT_READ_SECONDS,
  MELT_COST,
  upgradeStepCost,
} from '../data/balance.ts'
import { towerById } from '../data/towers.ts'
import { upgradeById } from '../data/upgrades.ts'

/**
 * Der Pfad, der stellvertretend fuer "das erste Upgrade ist bezahlbar" steht.
 *
 * `Hammerfall` ist das billigste Upgrade des ganzen Katalogs und sitzt auf dem ersten Platz
 * von Fenster 1 - wer ueberhaupt eines kaufen kann, kann dieses. Frueher stand hier
 * `core.damage`; die Rolle ist dieselbe geblieben, nur der Name hat sich mit dem Katalog
 * geaendert (`docs/upgrade-umbau.md`).
 */
const FIRST_UPGRADE = 'f1.hammerfall'
import { markDirty, waveRecord, type GameState } from '../app/state.ts'
import { canPrestige } from './prestige.ts'
import { currentLevel } from './progression.ts'
import { towerCost } from './shop.ts'

export type HintDef = {
  id: string
  key: StringKey
  /** Sein Augenblick ist da. Bleibt wahr, solange er nicht weggeklickt wurde. */
  when(state: GameState): boolean
  /**
   * Sein Augenblick ist **vorbei** - es gibt nichts mehr zu erklaeren.
   *
   * Zwei Faelle, und beide sind Aussagen ueber den Spieler, nicht ueber die Anzeige: Der
   * Gegenstand ist weg (der Verstaerker ist eingeschmolzen), oder die Sache ist erledigt
   * (es sind schon Upgrades gekauft).
   *
   * Der **frueh**e Ausstieg, und nur der, ist hier freiwillig: Die Frist hat jeder Zettel
   * ohnehin (`hintExpired`), sie ist die Zusage. Wo es im Spielstand keine ehrliche Spur
   * gibt, die "das kennt er schon" sagt, bleibt die Angabe deshalb weg - eine geratene
   * waere schlimmer als keine. Sie muss ausserdem "**vorbei**" heissen und nicht "noch
   * nicht": Ein Lager, das gerade nur zwei Tuerme zaehlt, fuellt sich wieder.
   */
  gone?(state: GameState): boolean
}

/** Steht ein Verstaerker an der Station? */
function buffPlaced(state: GameState): boolean {
  return state.run.station.placed.some((module) => towerById(module.defId).category === 'buff')
}

/** Wurde ueberhaupt schon ein Upgrade gekauft? */
function boughtUpgrade(state: GameState): boolean {
  return Object.values(state.run.upgrades).some((level) => level > 0)
}

/*
 * Die acht Hinweise aus der Tabelle in GDD 14 Abschnitt 4a, in ihrer Reihenfolge - und weil
 * die Liste eine Reihe ist, ist das zugleich die Reihenfolge, in der sie erscheinen.
 *
 * Der Hinweis zum Buff-Turm nennt ausdruecklich den **Zeitpunkt**: Das GDD bezeichnet ihn
 * als groesstes Verstaendnisrisiko des Spiels, weil derselbe Turm zuletzt gesetzt wie ein
 * Fehlkauf wirkt und frueh gesetzt der staerkste Zug im Build ist.
 */
export const HINTS: readonly HintDef[] = [
  {
    id: 'hint.collect',
    key: 'hint.collect',
    // "Erstes Gold liegt im Feld." Der zweite Teil ist der Nachklang: Wer die Muenze schon
    // aufgesammelt hat, darf den Satz trotzdem zu Ende lesen.
    when: (state) => state.run.coins.length > 0 || state.run.goldEarned > 0,
    // Wer gekauft hat, hat eingesammelt - anders kommt kein Gold auf das Konto. Der Satz
    // erklaert dann eine Handlung, die der Spieler laengst beherrscht.
    gone: (state) => state.run.towersBought > 0 || boughtUpgrade(state),
  },
  {
    id: 'hint.upgrade',
    key: 'hint.upgrade',
    when: (state) => {
      // Der Schadenspfad des Kerns ist der erste Kauf, den jeder Spieler taetigt - er
      // steht stellvertretend fuer "genug Gold fuer das erste Upgrade". Gemessen wird das
      // **verdiente** Gold: Bezahlbar war das Upgrade ab dieser Zahl, und daran aendert
      // auch eine spaetere Ausgabe nichts mehr.
      const def = upgradeById(FIRST_UPGRADE)
      return state.run.goldEarned >= upgradeStepCost(def, 1)
    },
    // Es steht schon eine Stufe im Konto: Der Spieler hat das Menue gefunden.
    gone: boughtUpgrade,
  },
  {
    id: 'hint.buyTower',
    key: 'hint.buyTower',
    // Gleiche Ueberlegung wie beim Upgrade - und wer schon gekauft hat, hat es ohnehin
    // erreicht: Der Preis steigt mit jedem Kauf, das verdiente Gold holt ihn erst wieder ein.
    when: (state) => state.run.towersBought > 0 || state.run.goldEarned >= towerCost(state),
    // Gekauft **und** angedockt - beide Haelften des Satzes sind getan.
    gone: (state) => state.run.towersBought > 0 && state.run.station.placed.length > 0,
  },
  {
    id: 'hint.buff',
    key: 'hint.buff',
    /*
     * GDD 14 Abschnitt 2 setzt ihn hinter den ersten angedockten Turm. Erst dann sind
     * "module" und "edge" ueberhaupt im Bild gewesen - vorher spraeche der Satz von Dingen,
     * die der Spieler noch nie gesehen hat. Das ist die **ganze** Bedingung.
     *
     * Hier stand zusaetzlich "und er besitzt einen Verstaerker". Das war richtig, solange
     * einer im Startlager lag: Dann traf es vom ersten Turm an zu. Gekauft wird der
     * Verstaerker aber gewuerfelt, und damit waere der Satz an einen Zufall geknuepft
     * gewesen, der bei manchem Spieler erst nach der Frist eintritt - er saehe ihn nie.
     *
     * Ohne die Haelfte ist er ausserdem **frueher** dran, und das ist der Punkt: Er erklaert
     * den Zeitpunkt ("place them early"). Wer ihn liest, bevor der erste Verstaerker aus dem
     * Laden kommt, erkennt ihn, wenn er kommt. Wer ihn erst danach liest, hat ihn womoeglich
     * schon an die falsche Kante gesetzt.
     */
    when: (state) => state.run.station.placed.length > 0,
    /*
     * Vorbei ist der Satz genau dann, wenn ein Verstaerker **steht** - dann hat der Spieler
     * die Frage hinter sich, um die es geht.
     *
     * Hier stand einmal auch "er besitzt gar keinen mehr": Das Startlager enthielt einen
     * Verstaerker, und wer keinen mehr hatte, hatte ihn eingeschmolzen - eine ehrliche Spur.
     * Seit das Lager leer beginnt (`START_INVENTORY`), heisst derselbe Ausdruck etwas ganz
     * anderes, naemlich "noch keinen gekauft", und das ist der Normalzustand der ersten
     * Minuten. Der Zettel waere ab Sekunde null abgeraeumt gewesen und **nie** erschienen.
     *
     * Dass die Reihe deswegen nicht stehen bleibt, traegt die Frist (`hintDeadline`) - genau
     * der Fall, fuer den es sie gibt.
     */
    gone: buffPlaced,
  },
  {
    id: 'hint.level',
    key: 'hint.level',
    // Die Stufe folgt der Erfahrung, und Erfahrung wird nie verbraucht - die Bedingung
    // kann also nicht wieder falsch werden.
    when: (state) => currentLevel(state) >= 4,
    // Wer auf Stufe 8 steht, hat die Auswahl viermal vor sich gehabt.
    gone: (state) => currentLevel(state) >= 8,
  },
  {
    id: 'hint.boss',
    key: 'hint.boss',
    // Solange der Boss im Feld steht; und danach die Wellenmarke, die beweist, dass einer
    // da war. Ohne den zweiten Teil verschwaende der Zettel mit dem Boss, den er erklaert.
    when: (state) =>
      state.runtime.combat.bossId !== null || waveRecord(state) > BOSS_WAVE_INTERVAL,
    // Der zweite Boss ist ebenfalls vorbei - erklaert werden muss da nichts mehr.
    gone: (state) => waveRecord(state) > 2 * BOSS_WAVE_INTERVAL,
  },
  {
    id: 'hint.melt',
    key: 'hint.melt',
    // "Genug ueberzaehlige Tuerme im Lager": Das Startlager hat genau drei, aber die sind
    // zum Andocken da und nicht zum Einschmelzen. Ueberzaehlig sind sie erst, wenn die
    // Station schon steht.
    when: (state) =>
      state.run.station.placed.length > 0 && state.run.station.inventory.length >= MELT_COST,
    // Kein frueher Ausstieg - mit Absicht, und der Verzicht ist selbst geprueft.
    //
    // Es gibt im Spielstand keine Spur, die "er kennt das Einschmelzen" sagt: Ein
    // Schmelzgang hinterlaesst kein Feld, nur einen Turm mehr und drei weniger. Jeder
    // Ersatz, der sich anbot, hiess in Wahrheit "noch nicht" statt "vorbei" - "im Lager
    // liegen gerade weniger als drei" trifft auf jeden zu, der eben erst angedockt hat, und
    // haette den Zettel ausgerechnet dem weggenommen, dessen Lager sich gleich wieder
    // fuellt. Ein zufaelliger Spielverlauf hat genau das aufgedeckt. Also traegt hier
    // allein die Frist.
  },
  {
    id: 'hint.prestige',
    key: 'hint.prestige',
    when: (state) => canPrestige(state),
    // Einmal zurueckgesetzt - was Prestige tut, hat der Spieler dann gesehen.
    gone: (state) => state.permanent.prestigeCount > 0,
  },
]

/** Platz eines Hinweises in der Reihe, oder `-1`. */
function hintIndex(id: string): number {
  return HINTS.findIndex((hint) => hint.id === id)
}

/**
 * Wie weit die Reihe schon abgearbeitet ist.
 *
 * Der Zeiger steht hinter dem hoechsten abgelegten Zettel - nicht auf dem ersten
 * ungesehenen. Beides ist im Normalfall dasselbe; bei einem Spielstand aus einer aelteren
 * Fassung, in dem nur ein spaeterer Hinweis vermerkt ist, gilt das Frueheste als gelernt.
 * Der Zeiger kann dadurch nie zurueckfallen, und genau das ist seine Aufgabe.
 */
function cursorOf(state: GameState): number {
  let cursor = 0
  for (const id of state.permanent.seenHints) {
    const index = hintIndex(id)
    if (index >= cursor) cursor = index + 1
  }
  return cursor
}

/**
 * Die Frist eines Hinweises, in gespielten Sekunden.
 *
 * Jeder Zettel bekommt ein eigenes Zeitfenster, und weil die Reihe eine Warteschlange ist,
 * kann der `index`-te ueberhaupt erst an der Reihe sein, wenn die `index` davor erledigt
 * sind - die Fenster liegen also hintereinander statt uebereinander. Daraus folgt die
 * Zusage, um die es geht: **Spaetestens nach `HINTS.length` Fenstern ist die Reihe durch**,
 * in jedem Spielverlauf, ohne dass der Spieler irgendetwas Bestimmtes tun muesste.
 *
 * Gemessen wird gespielte Zeit aus `permanent` und nicht die Welle: Wellen setzt das
 * Prestige zurueck, und ein Spieler, der bei Welle 1 stehen bleibt, haette gar keine Uhr.
 */
export function hintDeadline(index: number): number {
  return (index + 1) * HINT_GRACE_SECONDS
}

/**
 * Sein Augenblick ist vorbei - fachlich (`gone`) oder abgelaufen (Frist).
 *
 * `index` ist der Platz in der Reihe; die Frist waechst mit ihm.
 */
export function hintExpired(state: GameState, index: number): boolean {
  const hint = HINTS[index]
  if (!hint) return false
  return hint.gone?.(state) === true || state.permanent.totalPlaySeconds > hintDeadline(index)
}

/** Stumm ablegen: Der Zettel ist abgelaufen, gelesen hat ihn niemand. */
function retire(state: GameState, id: string): void {
  state.permanent.seenHints.push(id)
  markDirty(state)
}

/**
 * Der naechste faellige Hinweis, oder `null`.
 *
 * Wird pro Bild aufgerufen und schaut auf **einen** Eintrag - der Aufwand liegt unter dem
 * einer einzigen gezeichneten Muenze.
 *
 * Zwei Faelle, in denen die Abfrage etwas veraendert: Ein Zettel, dessen Augenblick vorbei
 * ist, wird abgelegt - das muss hier geschehen und nicht erst beim Anzeigen, sonst kaeme er
 * wieder, sobald seine Bedingung erneut zutrifft, und die Reihenfolge waere nicht mehr
 * monoton. Und ein Zettel, der faellig wird, wird **festgehalten**: Ab da steht er am Rand
 * und wird von keinem spaeteren abgeloest - bis der Spieler ihn weggeklickt hat oder seine
 * Lesefrist um ist. Das "oder" ist der Punkt: Ohne es haengt die ganze Reihe an einem Klick,
 * und wer nie klickt, saehe genau einen der acht Saetze.
 */
export function pendingHint(state: GameState): HintDef | null {
  // Was schon am Rand steht, bleibt stehen - aber nicht laenger als die Lesefrist. Ohne
  // Ruecksicht auf `when` und `gone`: Beides beschreibt, wann ein Satz **anfaengt**, faellig
  // zu sein - nicht, wie lange man zum Lesen hat. Der Verstaerker, den man waehrend des
  // Lesens andockt, nimmt einem sonst mitten im Satz den Zettel weg.
  const standing = state.runtime.hintId
  if (standing !== null) {
    const held = HINTS.find((hint) => hint.id === standing)
    if (held && !state.permanent.seenHints.includes(standing)) {
      if (!readTimeUp(state)) return held
      // Die Lesefrist ist um: Der Zettel stand lange genug, um gelesen zu werden, und
      // niemand hat ihn weggeklickt. Er wird stumm abgelegt - genau wie ein abgelaufener
      // Zettel weiter unten, und aus demselben Grund: Er darf nicht wiederkommen, sonst
      // waere die Reihenfolge nicht mehr monoton.
      retire(state, standing)
    }
    state.runtime.hintId = null
  }

  let index = cursorOf(state)
  while (index < HINTS.length) {
    const hint = HINTS[index] as HintDef
    // Der Augenblick zaehlt mehr als der Verfall - siehe die dritte Regel im Kopf.
    if (hint.when(state)) {
      hold(state, hint.id)
      return hint
    }
    if (!hintExpired(state, index)) return null

    retire(state, hint.id)
    index += 1
  }
  return null
}

/** Einen Zettel an den Rand stellen und die Lesefrist anlaufen lassen. */
function hold(state: GameState, id: string): void {
  state.runtime.hintId = id
  state.runtime.hintSince = state.permanent.totalPlaySeconds
}

/**
 * Steht der Zettel laenger am Rand, als zum Lesen noetig ist?
 *
 * Die Zahl steht in `HINT_READ_SECONDS` und ist dort aus der Textlaenge hergeleitet. Hier
 * zaehlt nur, dass ueberhaupt gezaehlt wird: Gespielte Zeit vergeht in jedem Spielverlauf
 * ohne Zutun, also faellt jeder stehende Zettel irgendwann - auch bei einem Spieler, der
 * **nie** auf "Got it" klickt.
 */
export function readTimeUp(state: GameState): boolean {
  return state.permanent.totalPlaySeconds - state.runtime.hintSince > HINT_READ_SECONDS
}

/**
 * Beim Laden eines Spielstands: Was dieser Spielstand nachweislich hinter sich hat, gilt
 * als gelernt.
 *
 * Hier zaehlt der Verfall mehr als der Augenblick, und nur hier. Der Grund steht im Kopf
 * der Datei: Ein Spielstand sagt, **was** ist, aber nicht, wann es geschehen ist. "Erstes
 * Gold liegt im Feld" trifft auf Welle 40 genauso zu wie auf Welle 1 - einem Spielstand,
 * der zwei Bosse hinter sich hat, deswegen die Anfaengerreihe von vorn vorzuspielen, waere
 * die schlechtere von zwei Wahlmoeglichkeiten.
 *
 * Abgelegt wird nur, was **vorn** in der Reihe steht: Am ersten Zettel, dessen Augenblick
 * noch aussteht, hoert der Abgleich auf. So verliert ein Spielstand mitten in der Reihe
 * nur die Saetze, die er hinter sich hat, und behaelt die, die ihm noch bevorstehen.
 */
export function settleHints(state: GameState): void {
  let index = cursorOf(state)
  while (index < HINTS.length && hintExpired(state, index)) {
    retire(state, (HINTS[index] as HintDef).id)
    index += 1
  }
}

/** Einen Hinweis als gesehen ablegen. Er kommt danach nicht wieder. */
export function markHintSeen(state: GameState, id: string): boolean {
  if (!HINTS.some((hint) => hint.id === id)) return false
  // Der Platz am Rand wird frei, auch wenn der Zettel schon abgelegt war.
  if (state.runtime.hintId === id) state.runtime.hintId = null
  if (state.permanent.seenHints.includes(id)) return false

  state.permanent.seenHints.push(id)
  markDirty(state)
  emit('hint.seen', { id })
  return true
}

/** Alle Hinweise wieder zeigen (GDD 14 Abschnitt 4a: "in den Einstellungen zuruecksetzbar"). */
export function resetHints(state: GameState): void {
  state.permanent.seenHints.length = 0
  state.runtime.hintId = null
  markDirty(state)
}
