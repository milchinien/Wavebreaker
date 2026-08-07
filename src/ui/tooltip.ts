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
