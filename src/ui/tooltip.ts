/**
 * Hover-Informationen statt Dauertext (GDD 13 Abschnitt 9).
 *
 * Ein einziges Element, das umgehaengt wird - kein Element je Ziel.
 *
 * Zwei Arten, es zu setzen, und der Unterschied ist keine Geschmacksfrage:
 *
 *   **am Zeiger**   fuer alles, was unter dem Zeiger liegt und keine eigene Gestalt hat -
 *                   ein Punkt auf dem Feld, eine Zeile in einer Liste. Der Hinweis stellt
 *                   sich schraeg daneben, wie ein Zettel, den man haelt.
 *   **an der Kachel** fuer eine Karte oder Kachel, die man ansieht. Der Hinweis steht
 *                   mittig darunter und weicht dem Ziel aus, statt es zu verdecken - man
 *                   soll die Karte weiterlesen koennen, waehrend die Auskunft danebensteht.
 */

let element: HTMLDivElement | null = null

function ensure(): HTMLDivElement {
  if (element) return element
  element = document.createElement('div')
  element.hidden = true
  document.body.appendChild(element)
  return element
}

export type TooltipAnchor = { x: number; y: number }

export type TooltipPlacement = {
  /** Zusatzklasse fuer eine eigene Gestalt. */
  variant?: string
  /** Waagerecht am Punkt **mitteln** statt danebenstellen. */
  center?: boolean
  /**
   * Ein senkrechter Bereich, den der Hinweis freihaelt - das Rechteck des Ziels. Passt er
   * darunter nicht mehr aufs Bild, kippt er darueber.
   */
  clear?: { top: number; bottom: number }
}

/** Luft zwischen Hinweis und Ziel beziehungsweise Fensterkante. */
const GAP = 10
const EDGE = 8

export function showTooltip(
  anchor: TooltipAnchor,
  content: string,
  placement: TooltipPlacement = {},
): void {
  const node = ensure()
  node.className = placement.variant ? `tooltip ${placement.variant}` : 'tooltip'
  node.innerHTML = content
  node.hidden = false

  // Erst nach dem Setzen messen: Die Groesse haengt am Inhalt.
  const box = node.getBoundingClientRect()

  // Am Rand kippt der Hinweis auf die andere Seite, statt aus dem Bild zu laufen.
  const wanted = placement.center ? anchor.x - box.width / 2 : anchor.x + 14
  const left = Math.min(wanted, window.innerWidth - box.width - EDGE)

  const clear = placement.clear
  const below = clear ? clear.bottom + GAP : anchor.y + 16
  const fits = below + box.height <= window.innerHeight - EDGE
  const top = fits ? below : clear ? clear.top - GAP - box.height : window.innerHeight - EDGE - box.height

  node.style.left = `${Math.max(EDGE, left)}px`
  node.style.top = `${Math.max(EDGE, top)}px`
}

export function hideTooltip(): void {
  if (element) element.hidden = true
}

/**
 * Einem Bedienelement eine Beschreibung geben, die beim Darueberfahren erscheint.
 *
 * Das ist der allgemeine Weg fuer alles, was **keine** Karte ist: Anzeigen in der Kopfleiste,
 * Knoepfe der Navigation, Zahlen im HUD. Karten bringen ihre Auskunft auf der Rueckseite mit
 * (`ui/cards.ts`), Anzeigen koennen das nicht - eine Zahl hat keine zweite Seite.
 *
 * Warum nicht einfach `title`: Der native Hinweis des Browsers kommt nach gut einer Sekunde,
 * traegt die Schrift des Betriebssystems statt die des Spiels, laesst sich nicht gestalten
 * und erscheint auf einem Finger-Geraet ueberhaupt nicht. Er wird hier deshalb **entfernt** -
 * stuenden beide, saehe man nach einer Sekunde zwei Hinweise uebereinander.
 *
 * Der Text kommt entweder fest oder als Funktion. Die Funktion ist der Regelfall fuer alles,
 * was sich aendert: Sie wird beim Darueberfahren ausgewertet, nicht beim Anmelden, und zeigt
 * deshalb den Stand von jetzt statt den vom Aufbau des Bildschirms.
 *
 * Mehrfaches Anmelden am selben Knoten tauscht nur den Text - die Zuhoerer haengen einmal.
 * Das ist die Voraussetzung dafuer, dass eine Anzeige, die sich je Bild neu beschriftet,
 * nicht mit jedem Bild einen weiteren Zuhoerer ansammelt.
 */
const beschreibungen = new WeakMap<HTMLElement, () => string>()

export function describe(node: HTMLElement, text: string | (() => string)): void {
  const holen = typeof text === 'function' ? text : () => text
  const erstmals = !beschreibungen.has(node)
  beschreibungen.set(node, holen)

  /*
   * Der native Hinweis weicht - aber sein Text darf nicht verloren gehen. Traegt der Knoten
   * ohnehin sichtbaren Text, ist er schon benannt; eine Marke obendrauf wuerde die
   * Vorlesehilfe die Zahl darunter verschlucken lassen. Nur ein Knoten ohne eigenen Text
   * bekommt die Beschreibung als Marke.
   */
  if (node.title) {
    const stumm = node.textContent?.trim().length === 0
    if (stumm && !node.getAttribute('aria-label')) node.setAttribute('aria-label', node.title)
    node.removeAttribute('title')
  }

  if (!erstmals) return

  const zeigen = (): void => {
    const inhalt = beschreibungen.get(node)?.()
    if (!inhalt) return
    const box = node.getBoundingClientRect()
    showTooltip({ x: box.left + box.width / 2, y: box.bottom }, inhalt, {
      center: true,
      clear: { top: box.top, bottom: box.bottom },
    })
  }

  node.addEventListener('pointerenter', zeigen)
  node.addEventListener('pointerleave', hideTooltip)
  // Wer drueckt, hat sich entschieden - der Hinweis hat seine Arbeit getan und geht aus dem
  // Weg. Ohne das bliebe er nach einem Klick unter dem stehenden Zeiger liegen.
  node.addEventListener('pointerdown', hideTooltip)
  // Mit der Tastatur bedient bekommt dieselbe Auskunft, wer nie einen Zeiger bewegt.
  node.addEventListener('focus', zeigen)
  node.addEventListener('blur', hideTooltip)
}
