/**
 * Rollende Knopfbeschriftung (GDD 13 Abschnitt 10).
 *
 * Unter dem Zeiger faehrt die Beschriftung nach oben aus dem Rahmen heraus, waehrend
 * dieselbe Beschriftung von unten nachrueckt. Danach steht auf dem Knopf, was vorher darauf
 * stand - die Bewegung **ist** die ganze Antwort.
 *
 * Warum nicht einfach heller werden? Farbe ist in dieser Oberflaeche schon vergeben: Sie
 * sagt "gewaehlt" (`.active`) und "gesperrt" (`:disabled`). Eine Bewegung stellt sich nicht
 * in diese Reihe - sie sagt nur "hier kannst du druecken" und nimmt keiner Farbe ihre
 * Bedeutung weg.
 *
 * **Zwei Huellen, weil eine nicht reicht:** Die aeussere faehrt, die innere blendet ab.
 * Beides an derselben Huelle ginge nicht, denn Durchsichtigkeit vererbt sich auf die
 * Zweitfassung - der Knopf waere in der Mitte der Bewegung leer.
 *
 * **Die Zweitfassung steht in `data-slide`, nicht im Dokument.** Das Stilblatt zieht sie
 * ueber `content: attr(...)` heran. Dadurch steht der Text an genau einer Stelle im Baum,
 * und ein Vorleser liest ihn nicht doppelt.
 */

/** Eine Beschriftung, die beim Beruehren durchrollt. */
export function slideLabel(text: string): HTMLSpanElement {
  const outer = document.createElement('span')
  outer.className = 'slide'
  outer.dataset['slide'] = text

  const inner = document.createElement('span')
  inner.textContent = text
  outer.appendChild(inner)
  return outer
}

/**
 * Setzt die Beschriftung eines Knopfes neu.
 *
 * Fuer alle Knoepfe, deren Text sich im Betrieb aendert: Ein schlichtes `textContent = ...`
 * wuerde die beiden Huellen wegwerfen, und der Knopf verloere die Bewegung stillschweigend.
 */
export function setSlideLabel(button: HTMLElement, text: string): void {
  button.replaceChildren(slideLabel(text))
}
