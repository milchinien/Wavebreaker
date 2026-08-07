/**
 * Bereichswechsel als Bewegung **eines** Bildes statt als Wechsel zweier Bilder.
 *
 * Das Verfahren heisst FLIP und besteht aus vier Schritten:
 *
 *   First    jeden Knoten ausmessen, solange der alte Bereich steht
 *   Last     umschalten lassen und noch einmal ausmessen
 *   Invert   jeden Knoten per Transformation dorthin zuruecksetzen, wo er eben war
 *   Play     die Transformation auf null laufen lassen
 *
 * Der Umbau selbst geschieht dabei in einem einzigen Bild - das Fenster ist sofort fertig
 * gesetzt, das Canvas hat schon seine neue Groesse. Bewegt wird nur noch die **Optik**.
 * Genau das unterscheidet FLIP von einer Uebergangszeit: Es wird nichts verzoegert.
 *
 * Warum ueberhaupt:
 *
 * Vorher trat beim Wechsel alles Sichtbare ab und alles Neue fuhr auf - auch die Panels,
 * die in **beiden** Bereichen vorkommen. Zwischen Kampf und Upgrades verschwindet aber kein
 * einziges Panel; sie ruecken nur, weil die untere Leiste hoeher wird. Sie trotzdem
 * ausblenden und wieder einblenden zu lassen behauptet einen Wechsel, den es nicht gibt.
 * Jetzt wandern sie, und der Spieler verliert sie nicht aus dem Auge.
 *
 * Drei Entscheidungen praegen die Datei:
 *
 * **Es wird `translate` gesetzt, nicht `transform`.** Mehrere Panels tragen schon eine
 * eigene Verschiebung (`translateX(-50%)` bei allem Mittigen), und die Auftritte im
 * Stilblatt arbeiten ebenfalls mit `transform`. Die Einzeleigenschaft `translate` legt sich
 * davor, statt sie zu ueberschreiben - Wanderung und Auftritt kommen sich nicht ins Gehege.
 *
 * **Nur der Ort wandert, die Groesse springt.** Ein Panel, das seine Groesse aendert, liesse
 * sich per `scale` auf seine alte Flaeche zurueckholen - dann verzerrte aber seinen ganzen
 * Inhalt eine knappe halbe Sekunde lang. Im Spiel aendert genau **ein** Panel seine Groesse
 * (die Upgrade-Kacheln zwischen Kampf und Upgrades), und dessen Inhalt faehrt ohnehin
 * gestaffelt neu auf. Es wandert deshalb nur mit seiner oberen Kante nach oben in die schon
 * fertige Leiste hinein - wie eine Schublade, die aufgeht.
 *
 * **Der Abgang wird festgenagelt, nicht verzoegert.** Ein Panel, das der neue Bereich nicht
 * mehr zeigt, ist im Augenblick des Umschaltens auf `display: none` - es ist weg, bevor man
 * es gehen sieht. Es bekommt deshalb fuer die Dauer seines Abgangs seinen letzten Ort und
 * seine letzte Groesse fest eingetragen und wird aus dem Fluss genommen. Wie es geht, steht
 * weiterhin im Stilblatt (`[data-leaving]`) - die Richtung eines Abgangs ist Gestaltung,
 * keine Mechanik.
 *
 * Aus demselben Grund laesst sich die Wanderung im Stilblatt auch **abbestellen**
 * (`--flip: 0`). Nicht jeder gemessene Unterschied ist ein Weg: Eine mittig gesetzte
 * Ueberschrift ruecht schon dann zur Seite, wenn das naechste Wort ein paar Zeichen laenger
 * ist. Sie hat ihren Platz nicht gewechselt, nur ihre Breite.
 */

/** Was von einem Knoten gemessen wird. */
type Box = {
  left: number
  top: number
  width: number
  height: number
  /** Der Anzeigemodus zur Messzeit - der festgenagelte Abgang muss ihn zurueckholen. */
  display: string
  /** Darf dieser Knoten wandern? Abbestellt wird im Stilblatt ueber `--flip: 0`. */
  travels: boolean
}

export type FlipOptions = {
  /** Alle Knoten, die beim Wechsel bleiben, gehen oder kommen koennen. */
  nodes: () => Iterable<HTMLElement>
  /** Ist die Bewegung abgeschaltet? Dann wird nur umgeschaltet, ohne alles Weitere. */
  still: () => boolean
}

export type Flip = {
  /**
   * `swap` schaltet den Bereich um - und zwar vollstaendig und sofort. Alles davor und
   * danach macht diese Funktion.
   */
  run(swap: () => void): void
}

/** Dauer der Wanderung. Etwas laenger als ein Auftritt: Hier wird wirklich Weg zurueckgelegt. */
const MOVE_MS = 420
/**
 * Notbremse fuer den festgenagelten Abgang.
 *
 * Aufgeraeumt wird normalerweise, wenn die Bewegung im Stilblatt zu Ende ist. Hat ein Panel
 * dort gar keine Abgangsregel, kaeme dieses Ereignis nie - und der Knoten bliebe fuer immer
 * festgenagelt im Bild stehen. Der Zeitgeber ist der zweite Weg zum selben Ziel.
 */
const PIN_MS = 600
/** Ab wann ein Unterschied eine Bewegung wert ist, in Bildschirmpixeln. */
const EPSILON = 0.5

/** Was ein festgenagelter Abgang zurueckzugeben hat, wenn er zu Ende ist. */
type Pin = {
  /** Was vor dem Nageln im `style`-Attribut stand. `null`: gar nichts, es kommt wieder weg. */
  style: string | null
  /** Der Zuhoerer, der auf das Ende der Abgangsbewegung wartet. */
  done: (event: AnimationEvent) => void
}

export function createFlip(options: FlipOptions): Flip {
  /** Wer gerade festgenagelt abtritt. Leer, sobald alle Abgaenge durch sind. */
  const pinned = new Map<HTMLElement, Pin>()

  /** Die einzige Stelle, an der ein Abgang aufgeraeumt wird - egal, was ihn beendet hat. */
  function release(node: HTMLElement): void {
    const pin = pinned.get(node)
    if (!pin) return
    pinned.delete(node)

    node.removeEventListener('animationend', pin.done)
    delete node.dataset['leaving']
    if (pin.style === null) node.removeAttribute('style')
    else node.setAttribute('style', pin.style)
  }

  /**
   * Den Knoten an seinen letzten Ort nageln.
   *
   * `position: fixed` nimmt ihn aus dem Fluss - er schiebt nichts mehr, waehrend er geht.
   * `getBoundingClientRect` misst gegen das Fenster, also passen die Werte ohne Umrechnung.
   * Der Zeiger geht durch ihn hindurch: Ein abtretendes Panel darf keinen Klick mehr fangen.
   */
  function depart(node: HTMLElement, from: Box): void {
    if (!pinned.has(node)) {
      // Aufgeraeumt wird, sobald die Bewegung im Stilblatt zu Ende ist - und andernfalls
      // spaetestens nach `PIN_MS`. Die Pruefung auf das Ziel ist noetig, weil auch die
      // Kacheln **innerhalb** des Panels ihre eigenen Bewegungen hier heraufmelden.
      const done = (event: AnimationEvent): void => {
        if (event.target === node) release(node)
      }
      pinned.set(node, { style: node.getAttribute('style'), done })
      node.addEventListener('animationend', done)
      window.setTimeout(() => release(node), PIN_MS)
    }

    const style = node.style
    style.setProperty('position', 'fixed')
    style.setProperty('display', from.display)
    style.setProperty('left', `${from.left}px`)
    style.setProperty('top', `${from.top}px`)
    style.setProperty('width', `${from.width}px`)
    style.setProperty('height', `${from.height}px`)
    style.setProperty('margin', '0')
    style.setProperty('pointer-events', 'none')
    node.dataset['leaving'] = ''
  }

  /**
   * Den Weg zwischen zwei Messungen zuruecklegen.
   *
   * Erst wird der Knoten dorthin zurueckgesetzt, wo er eben noch war, dann laeuft die
   * Verschiebung auf null. Eine noch laufende Wanderung wird abgebrochen und nicht
   * ueberlagert - gemessen wurde eben ihr **aktueller** Ort, die neue setzt genau dort an.
   */
  function travel(node: HTMLElement, from: Box, to: Box, ease: string): void {
    if (!from.travels) return

    const dx = from.left - to.left
    const dy = from.top - to.top
    if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) return

    for (const running of node.getAnimations()) {
      if (running.id === 'flip') running.cancel()
    }

    const animation = node.animate(
      [{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }],
      { duration: MOVE_MS, easing: ease },
    )
    animation.id = 'flip'
  }

  return {
    run(swap) {
      /*
       * Ein noch laufender Abgang wird zuerst zu Ende gebracht. Sonst stuende ein
       * festgenagelter Knoten in der Messung - an seinem alten Ort und in voller Groesse,
       * obwohl er dort laengst nicht mehr hingehoert.
       */
      for (const node of [...pinned.keys()]) release(node)

      // Ohne Bewegung wird nur umgeschaltet. Eine auf eine Millisekunde gekuerzte Wanderung
      // waere kein ruhigeres Bild, sondern ein Zucken.
      if (options.still()) {
        swap()
        return
      }

      const before = measure(options.nodes())
      swap()
      const after = measure(options.nodes())
      const ease = easeOut()

      for (const [node, from] of before) {
        const to = after.get(node)
        if (to) travel(node, from, to, ease)
        else depart(node, from)
      }
    },
  }
}

/**
 * Die Kurve der Wanderung - aus dem Stilblatt geholt, nicht hier hingeschrieben.
 *
 * `--ease-out` traegt im ganzen Spiel jede Bewegung, die etwas transportiert. Stuende sie
 * hier ein zweites Mal als Zahlenreihe, gaebe es zwei Wahrheiten, und die eine liesse sich
 * aendern, ohne dass die andere mitginge. Ohne Stilblatt bleibt die eingebaute Kurve - dann
 * fehlt der Feinschliff, aber nicht die Bewegung.
 */
function easeOut(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()
  return value.length > 0 ? value : 'ease-out'
}

/**
 * Alle sichtbaren Knoten ausmessen.
 *
 * Was keine Flaeche hat, ist nicht da: `display: none` liefert lauter Nullen, und ein Knoten
 * mit Nullflaeche laesst sich weder sinnvoll verschieben noch skalieren. Er faellt damit von
 * selbst in die richtige Gruppe - fehlt er vorher, ist er ein Auftritt; fehlt er nachher,
 * ein Abgang.
 */
function measure(nodes: Iterable<HTMLElement>): Map<HTMLElement, Box> {
  const shot = new Map<HTMLElement, Box>()

  for (const node of nodes) {
    const box = node.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) continue

    const style = getComputedStyle(node)
    shot.set(node, {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      display: style.display,
      travels: style.getPropertyValue('--flip').trim() !== '0',
    })
  }

  return shot
}

