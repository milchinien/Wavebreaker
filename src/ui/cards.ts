/**
 * Auswahlkarten - die Karten, zwischen denen der Spieler waehlt (GDD 13 Abschnitt 6).
 *
 * Sie tragen zwei Fenster: den Levelaufstieg und die Turmauswahl. Beide stellen dieselbe
 * Frage - "nimm eins davon" -, und deshalb ist die Karte hier **ein** Baustein und nicht
 * zweimal derselbe in zwei Dateien.
 *
 * Der Unterschied zu einer Schaltflaeche mit Rahmen ist, dass diese Karte **zwei Seiten**
 * hat. Vorne steht, was es ist: Zeichen, Name, Rang - so viel, wie man im Vorbeisehen
 * aufnimmt. Hinten steht, was es tut, mit Zahlen. Wer den Zeiger daraufstellt, dreht sie
 * um; wer sie kennt, klickt sofort und liest die Rueckseite nie.
 *
 * Das loest ein Problem, das die Karten vorher hatten: Der ausfuehrliche Text lag in einem
 * Hinweisfenster, das erst nach drei Sekunden Stehenbleiben aufging. Drei Sekunden sind
 * lang genug, dass man sie nie abwartet - die Auskunft war da, aber sie fand niemand. Auf
 * der Rueckseite steht sie dort, wo man ohnehin hinsieht.
 *
 * Drei Entscheidungen praegen die Datei:
 *
 * **Das Drehen steht im Stilblatt, nicht hier.** Es haengt an `:hover` und `:focus-visible`
 * und braucht dafuer kein Skript. Was hier steht, ist nur, was CSS nicht weiss: wo der
 * Zeiger auf der Karte liegt. Daraus entstehen die Neigung und der Lichtfleck, der ihm
 * folgt - beides ueber zwei Eigenschaften am Knoten (`--tilt-*`, `--px`/`--py`).
 *
 * **Die Neigung wird nicht gemessen, wenn sie nicht laeuft.** Wer die Bewegung abgestellt
 * hat (E18, GDD 13 Abschnitt 3), bekommt eine ruhige Karte, die nur umschlaegt. Gelesen
 * wird `--motion` - derselbe Wert wie beim Bereichswechsel (`ui/flip.ts`), damit es nicht
 * zwei Antworten auf dieselbe Frage gibt.
 *
 * **Ein Finger schwebt nicht.** Auf dem Tablet gibt es kein `:hover`, mit dem sich eine
 * Karte umdrehen liesse, und ein Tippen ist bereits die Wahl. Die Rueckseite haengt dort
 * an einem eigenen kleinen Zeichen in der Ecke - dem einzigen Fleck der Karte, der nicht
 * auswaehlt.
 */

import type { Rarity } from '../data/types.ts'
import { icon } from './icons.ts'

/** Der staerkste Ausschlag der Neigung, in Grad. */
const TILT_DEG = 9

/**
 * Welche Stufen die Folie tragen (GDD 13 Abschnitt 7).
 *
 * Common bewusst nicht, und das ist der ganze Sinn der Sache: Der Glanz ist die Auskunft
 * "das hier ist selten". Eine Auskunft, die auf jeder Karte steht, ist keine mehr - und ein
 * gewoehnlicher Turm ist die reine Basisversion seines Typs, da gibt es nichts zu feiern.
 *
 * Wie **stark** eine Stufe glaenzt, steht nicht hier, sondern im Stilblatt: Das ist eine
 * Frage der Gestaltung, und sie soll sich aendern lassen, ohne dass jemand Code anfasst.
 */
const FOILED: readonly Rarity[] = ['rare', 'epic', 'legendary', 'mythic']

/**
 * So viele Ringe pulsen hinter dem Zeichen.
 *
 * Sie sind der Grund, warum die Vorderseite lebt, ohne etwas zu behaupten: ein Herzschlag
 * in der Farbe der Seltenheit. Sechs sind genug, dass immer einer sichtbar ist, und wenig
 * genug, dass sie nicht zur Flaeche verschmelzen.
 */
const RINGS = 6

export type ChoiceFront = {
  /** Kachel aus Rahmen und Zeichen, fertig als HTML-Baustein (`ui/icons.ts`). */
  tile: string
  name: string
  /** Der Rang in Worten - "Episch". Traegt die Leitfarbe. */
  rank: string
  /**
   * Eine Zeile Kleingedrucktes unter dem Rang, etwa "schon zweimal genommen".
   *
   * Wahlweise als fertiger Knoten. Das braucht genau einer: Der Preis der Haendler-Drohne
   * wird zu "Gekauft", sobald der Posten weg ist, und ihre Karten duerfen dafuer nicht neu
   * entstehen (`ui/dialogs.ts`). Wer den Knoten mitbringt, behaelt ihn und beschriftet ihn
   * spaeter selbst.
   */
  note?: string | HTMLElement
}

export type ChoiceSpec = {
  /** Leitfarbe der Karte, ueblicherweise die der Seltenheit. */
  tone: string
  /**
   * Die Stufe selbst - nicht nur ihre Farbe.
   *
   * Sie steht neben `tone`, weil die Farbe eine Zeichenkette ist und damit nichts darueber
   * sagt, **wie selten** die Karte ist. Ohne die Stufe koennte das Stilblatt nicht zwischen
   * "selten" und "sagenhaft" unterscheiden, und die Folie waere auf beiden gleich.
   */
  rarity?: Rarity
  front: ChoiceFront
  /** Die Rueckseite baut der Aufrufer: Was dort steht, weiss nur er. */
  back: HTMLElement[]
  /** Beschriftung der Handlungszeile am unteren Rand der Rueckseite. */
  action: string
  onPick: () => void
}

/**
 * Eine Auswahlkarte.
 *
 * Der Aufbau ist eine Schachtel je Aufgabe, und keine davon ist entbehrlich: Die Karte
 * selbst spannt den Raum auf (`perspective`), die erste Huelle neigt sich zum Zeiger, die
 * zweite schlaegt um, und darin liegen die beiden Seiten uebereinander. Zwei getrennte
 * Huellen deshalb, weil Neigung und Umschlag verschieden schnell sind - eine Neigung
 * folgt dem Zeiger sofort, ein Umschlag braucht seine halbe Sekunde. In einer einzigen
 * Transformation muessten sich beide auf dieselbe Dauer einigen.
 */
export function choiceCard(spec: ChoiceSpec): HTMLButtonElement {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'choice'
  card.style.setProperty('--rarity', spec.tone)

  // Die Stufe als Merkmal am Knoten, nicht als Klasse: Sie ist ein **Wert** aus fuenf
  // moeglichen und keine Eigenschaft, die man an- und abschaltet. Das Stilblatt greift sie
  // mit `[data-rarity='mythic']` ab und staffelt daran die Staerke der Folie.
  const foil = spec.rarity !== undefined && FOILED.includes(spec.rarity)
  if (spec.rarity !== undefined) card.dataset['rarity'] = spec.rarity

  const tilt = document.createElement('span')
  tilt.className = 'choice-tilt'
  const turn = document.createElement('span')
  turn.className = 'choice-turn'

  turn.append(frontFace(spec.front, foil), backFace(spec.front.name, spec.back, spec.action, foil))
  tilt.appendChild(turn)
  card.appendChild(tilt)

  bindMotion(card)

  card.addEventListener('click', spec.onPick)
  return card
}

function frontFace(front: ChoiceFront, foil: boolean): HTMLElement {
  const face = document.createElement('span')
  face.className = 'choice-face choice-front'

  const glow = document.createElement('span')
  glow.className = 'choice-glow'

  // Das Zeichen sitzt im Auge des Pulses, nicht daneben: Die Ringe gehen von ihm aus.
  const art = document.createElement('span')
  art.className = 'choice-art'
  const rings = document.createElement('span')
  rings.className = 'choice-rings'
  for (let i = 0; i < RINGS; i += 1) {
    const ring = document.createElement('i')
    ring.style.setProperty('--delay', `${(i * 3) / RINGS}s`)
    rings.appendChild(ring)
  }
  const tile = document.createElement('span')
  tile.className = 'choice-tile'
  tile.innerHTML = front.tile
  art.append(rings, tile)

  const name = document.createElement('span')
  name.className = 'choice-name'
  name.textContent = front.name

  const rank = document.createElement('span')
  rank.className = 'choice-rank'
  rank.textContent = front.rank

  face.append(glow, art, name, rank)

  if (typeof front.note === 'string' && front.note.length > 0) {
    const note = document.createElement('span')
    note.className = 'choice-note'
    note.textContent = front.note
    face.appendChild(note)
  } else if (front.note instanceof HTMLElement) {
    front.note.classList.add('choice-note')
    face.appendChild(front.note)
  }

  // Die Folie liegt **ueber** dem Aufdruck, wie bei einer echten Sammelkarte - erst danach
  // kommen Zeichen und Streifen, die bedienbar bleiben muessen.
  if (foil) face.appendChild(sheen())
  face.append(badge(), line())
  return face
}

/**
 * Die Rueckseite.
 *
 * Sie wiederholt den Namen von der Vorderseite. Das sieht nach Doppelung aus, ist aber
 * keine: Wer eine Karte umgedreht hat, sieht die Vorderseite nicht mehr, und drei Karten
 * nebeneinander tragen dieselbe Art von Zahlen. Ohne den Namen stuende auf der Rueckseite
 * eine Rechnung, ohne dass dabeistuende, wozu.
 */
function backFace(
  name: string,
  body: HTMLElement[],
  action: string,
  foil: boolean,
): HTMLElement {
  const face = document.createElement('span')
  face.className = 'choice-face choice-back'

  const glow = document.createElement('span')
  glow.className = 'choice-glow'

  const title = document.createElement('span')
  title.className = 'choice-title'
  title.textContent = name

  const inner = document.createElement('span')
  inner.className = 'choice-body'
  inner.append(...body)

  // Die Handlungszeile sieht aus wie ein Knopf, ist aber keiner - die ganze Karte ist der
  // Knopf. Sie steht da, damit die Rueckseite nicht in einer Sackgasse endet: Wer sie zu
  // Ende gelesen hat, sieht als Letztes, dass ein Klick sie nimmt.
  const act = document.createElement('span')
  act.className = 'choice-act'
  const label = document.createElement('span')
  label.textContent = action
  act.appendChild(label)
  act.insertAdjacentHTML('beforeend', icon('next', 12))

  // Auch hinten. Das ist keine Verdopplung, sondern die Bedingung dafuer, dass man die
  // Folie ueberhaupt spielen sieht: Unter dem Zeiger **schlaegt die Karte um**, und ohne
  // Folie auf der Rueckseite waere der Glanz genau in dem Augenblick weg, in dem der Zeiger
  // ihn zu bewegen anfaengt.
  if (foil) face.appendChild(sheen())
  face.append(glow, title, inner, act, line())
  return face
}

/**
 * Die Folie: der prismatische Schimmer seltener Karten.
 *
 * Ein leerer Knoten - alles daran steht im Stilblatt. Er bekommt hier trotzdem seinen
 * eigenen Bauschritt und liegt nicht auf einem Pseudoelement, weil die beiden Seiten ihre
 * beiden schon vergeben haben (fester Schimmer und Wischer) und die Folie selbst noch eins
 * fuer ihre zweite Lage braucht.
 */
function sheen(): HTMLElement {
  const node = document.createElement('span')
  node.className = 'choice-foil'
  return node
}

/**
 * Das Zeichen in der Ecke: "diese Karte hat eine Rueckseite".
 *
 * Am Rechner ist es reine Auskunft - dort dreht der Zeiger die Karte, und ein Klick darauf
 * soll waehlen wie ueberall sonst. Am Finger ist es die einzige Stelle, die **nicht**
 * waehlt, sondern umdreht (siehe `hover: none` im Stilblatt).
 */
function badge(): HTMLElement {
  const node = document.createElement('span')
  node.className = 'choice-badge'
  node.innerHTML = icon('flip', 12)
  // Am Rechner kommt dieser Zuhoerer nie zum Zug: Das Zeichen ist dort `pointer-events:
  // none`, der Klick geht durch es hindurch an die Karte.
  node.addEventListener('click', (event) => {
    const card = node.closest('.choice')
    if (!(card instanceof HTMLElement)) return
    event.stopPropagation()
    card.classList.toggle('flipped')
  })
  return node
}

/** Der Streifen, der beim Beruehren am unteren Rand entlanglaeuft. */
function line(): HTMLElement {
  const node = document.createElement('span')
  node.className = 'choice-line'
  return node
}

/**
 * Neigung und Lichtfleck an den Zeiger haengen.
 *
 * Gemessen wird **einmal je Beruehrung**, nicht je Bewegung: `getBoundingClientRect` zwingt
 * den Browser zur Neuberechnung des Layouts, und bei einem Zeiger, der ueber die Karte
 * faehrt, waeren das hunderte Male je Sekunde. Waehrend eine Karte beruehrt wird, bewegt
 * sich in diesen Fenstern nichts - der einmal gemessene Rahmen bleibt gueltig.
 */
function bindMotion(card: HTMLButtonElement): void {
  let box: DOMRect | null = null

  function rest(): void {
    box = null
    card.style.removeProperty('--tilt-x')
    card.style.removeProperty('--tilt-y')
    card.style.removeProperty('--px')
    card.style.removeProperty('--py')
  }

  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return
    // Steht die Bewegung still, bleibt die Karte flach. Sie schlaegt weiterhin um - das
    // ist keine Zierde, sondern der Weg zur Rueckseite -, aber sie kippt nicht mehr.
    if (getComputedStyle(card).getPropertyValue('--motion').trim() === '0') return
    box = card.getBoundingClientRect()
  })

  card.addEventListener('pointermove', (event) => {
    if (box === null) return
    const nx = (event.clientX - box.left) / box.width
    const ny = (event.clientY - box.top) / box.height
    card.style.setProperty('--px', `${nx * 100}%`)
    card.style.setProperty('--py', `${ny * 100}%`)
    card.style.setProperty('--tilt-x', `${(0.5 - ny) * 2 * TILT_DEG}deg`)
    card.style.setProperty('--tilt-y', `${(nx - 0.5) * 2 * TILT_DEG}deg`)
  })

  card.addEventListener('pointerleave', rest)
  // Die Karte verschwindet beim Klick - `pointerleave` kommt dann nicht mehr, und die
  // naechste Karte an derselben Stelle erbte sonst die letzte Neigung dieser hier.
  card.addEventListener('click', rest)
}
