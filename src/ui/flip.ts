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
 * **Es wird `translate` und `scale` gesetzt, nicht `transform`.** Mehrere Panels tragen
 * schon eine eigene Verschiebung (`translateX(-50%)` bei allem Mittigen). Die
 * Einzeleigenschaften legen sich davor, statt sie zu ueberschreiben.
 *
 * **Groesse wird nur skaliert, wo der Knoten nichts eigenes vorhat.** Ein mittig gesetztes
 * Panel wuerde seine eigene Zentrierung mitskalieren und dabei aus der Mitte laufen.
 *
 * **Der Abgang wird festgenagelt, nicht verzoegert.** Ein Panel, das der neue Bereich nicht
 * mehr zeigt, ist im Augenblick des Umschaltens auf `display: none` - es ist weg, bevor man
 * es gehen sieht. Es bekommt deshalb fuer die Dauer seines Abgangs seinen letzten Ort und
 * seine letzte Groesse fest eingetragen und wird aus dem Fluss genommen. Wie es geht, steht
 * weiterhin im Stilblatt (`[data-leaving]`) - die Richtung eines Abgangs ist Gestaltung,
 * keine Mechanik.
 */

/** Was von einem Knoten gemessen wird. */
type Box = {
  left: number
  top: number
  width: number
  height: number
  /** Der Anzeigemodus zur Messzeit - der festgenagelte Abgang muss ihn zurueckholen. */
  display: string
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

export function createFlip(options: FlipOptions): Flip {
  /**
   * Wer gerade festgenagelt abtritt - und was vorher in seinem `style`-Attribut stand.
   * `null` heisst: gar nichts, das Attribut kommt beim Aufraeumen wieder weg.
   */
  const pinned = new Map<HTMLElement, string | null>()

  function release(node: HTMLElement): void {
    if (!pinned.has(node)) return
    const style = pinned.get(node) ?? null
    pinned.delete(node)
    delete node.dataset['leaving']
    if (style === null) node.removeAttribute('style')
    else node.setAttribute('style', style)
  }

  /**
   * Den Knoten an seinen letzten Ort nageln.
   *
   * `position: fixed` nimmt ihn aus dem Fluss - er schiebt nichts mehr, waehrend er geht.
   * `getBoundingClientRect` misst gegen das Fenster, also passen die Werte ohne Umrechnung.
   * Der Zeiger geht durch ihn hindurch: Ein abtretendes Panel darf keinen Klick mehr fangen.
   */
  function depart(node: HTMLElement, from: Box): void {
    if (!pinned.has(node)) pinned.set(node, node.getAttribute('style'))

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

    // Aufgeraeumt wird, sobald die Bewegung im Stilblatt zu Ende ist - und andernfalls
    // spaetestens nach `PIN_MS`. Die Pruefung auf das Ziel ist noetig, weil auch die
    // Kacheln **innerhalb** des Panels ihre eigenen Bewegungen haben und melden.
    node.addEventListener('animationend', function done(event) {
      if (event.target !== node) return
      node.removeEventListener('animationend', done)
      release(node)
    })
    window.setTimeout(() => release(node), PIN_MS)
  }

  /**
   * Den Weg zwischen zwei Messungen zuruecklegen.
   *
   * Erst wird der Knoten dorthin zurueckgesetzt, wo er eben noch war, dann laeuft die
   * Verschiebung auf null. Eine noch laufende Wanderung wird abgebrochen und nicht
   * ueberlagert - gemessen wurde eben ihr **aktueller** Ort, die neue setzt genau dort an.
   */
  function travel(node: HTMLElement, from: Box, to: Box, ease: string): void {
    const dx = from.left - to.left
    const dy = from.top - to.top
    const moved = Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON
    const resized =
      Math.abs(from.width - to.width) > EPSILON || Math.abs(from.height - to.height) > EPSILON

    // Ein Knoten, der schon eine eigene Transformation traegt (alles mittig Gesetzte), wird
    // nicht skaliert: Seine Zentrierung skalierte mit und liefe aus der Mitte.
    const scalable = resized && to.width > 0 && to.height > 0 && !hasOwnTransform(node)
    if (!moved && !scalable) return

    for (const running of node.getAnimations()) {
      if (running.id === 'flip') running.cancel()
    }

    const start: Keyframe = { translate: `${dx}px ${dy}px` }
    const end: Keyframe = { translate: '0px 0px' }
    if (scalable) {
      start['scale'] = `${from.width / to.width} ${from.height / to.height}`
      end['scale'] = '1 1'
      // Ohne die Ecke oben links als Bezug waechst der Knoten in alle Richtungen zugleich
      // und deckt sich dabei nicht mehr mit seiner alten Flaeche.
      start['transformOrigin'] = '0 0'
      end['transformOrigin'] = '0 0'
    }

    const animation = node.animate([start, end], { duration: MOVE_MS, easing: ease })
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
    shot.set(node, {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      display: getComputedStyle(node).display,
    })
  }

  return shot
}

function hasOwnTransform(node: HTMLElement): boolean {
  return getComputedStyle(node).transform !== 'none'
}

