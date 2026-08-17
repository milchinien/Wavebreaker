/**
 * Schrift, die sich selbst zeichnet: erst die Kontur, dann die Fuellung.
 *
 * Die Vorlage ist die React-Komponente `StrokeText` (GSAP + ScrollTrigger). Der Effekt ist
 * dort wie hier derselbe, und er beruht auf einem einzigen Kunstgriff: Buchstaben werden
 * **zweimal** gesetzt. Einmal als blosse Kontur - `fill: none`, ein Strich aussen herum -,
 * einmal gefuellt und deckungsgleich darueber. Die Kontur haengt an einer gestrichelten
 * Linie, deren Strich so lang ist wie der ganze Umriss; wird der Versatz dieser Strichelung
 * von "ganz weg" auf null gefahren, laeuft der Strich am Buchstaben entlang, als schriebe
 * ihn jemand. Danach kommt die Fuellung dazu.
 *
 * Umgesetzt ist das mit gewoehnlichen CSS-Uebergaengen. Was in der Vorlage eine
 * GSAP-Zeitleiste macht, machen hier drei Angaben je Buchstabe: Dauer, Kurve, Verzoegerung.
 * Die Staffelung (`stagger`) ist nichts anderes als eine Verzoegerung, die je Buchstabe um
 * denselben Betrag waechst - dafuer braucht es keine Bibliothek, und dieses Projekt hat
 * weder React noch GSAP (dieselbe Ueberlegung wie bei `ui/reveal.ts`).
 *
 * Vier Entscheidungen praegen die Datei:
 *
 * **Die Regler heissen wie in der Vorlage.** `drawDuration`, `fillDelay`, `stagger`,
 * `fillMode`, `reverse` - und `ease` nimmt sogar die GSAP-Namen entgegen (`power2.out`), die
 * unten in die entsprechende Bezierkurve uebersetzt werden. Wer die Vorlage kennt, kann die
 * Werte von dort abschreiben; das ist der Sinn einer Portierung.
 *
 * **Gemessen wird nach der Schrift, nicht davor.** Der Ausschnitt (`viewBox`) kommt aus dem
 * tatsaechlichen Umriss des gesetzten Textes. Wird er berechnet, bevor die Schriftdatei da
 * ist, misst er die Ersatzschrift - und der Schriftzug sitzt dauerhaft schief. Deshalb wird
 * nach `document.fonts.ready` ein zweites Mal gemessen. Genau das tut die Vorlage auch.
 *
 * **Die Konturlaenge wird geschaetzt, nicht ermittelt.** Ein `<text>` hat keine
 * `getTotalLength()`; was ein "M" an Umriss hat und was ein "I", weiss niemand. Die Vorlage
 * rechnet mit `fontSize * 7` und faehrt gut damit: Ist der Strich laenger als der Umriss,
 * beginnt der Buchstabe eben ein wenig spaeter zu erscheinen - sichtbar ist das nicht, weil
 * alle Buchstaben denselben Wert bekommen und die Ungenauigkeit dadurch zum Rhythmus wird.
 *
 * **Der Anstoss kommt von aussen.** Die Vorlage kennt `trigger="mount"`, `"hover"`,
 * `"scroll"` und `"loop"`; hier gibt es `play()`. Auf einer Seite ohne Rollbalken ist
 * `scroll` sinnlos, und auf einem Startbildschirm ohne Zeiger auch `hover` - der Aufrufer
 * weiss besser als diese Datei, wann der Schriftzug an der Reihe ist. Fuer den
 * gebraeuchlichen Fall gibt es `trigger: 'mount'`, dann laeuft er von selbst los.
 */

import { t, type StringKey } from '../data/strings.ts'

export type StrokeTextFillMode = 'wipe' | 'fade' | 'none'

export type StrokeTextOptions = {
  /** Was geschrieben wird. Ein Schluessel aus `data/strings.ts`, kein fertiger Text. */
  key: StringKey
  strokeColor?: string
  fillColor?: string
  strokeWidth?: number
  /** Wie lange ein einzelner Buchstabe zum Schreiben braucht, in Sekunden. */
  drawDuration?: number
  /** Pause zwischen fertiger Kontur und Fuellung, in Sekunden. */
  fillDelay?: number
  /** Abstand zwischen zwei Buchstaben, in Sekunden. */
  stagger?: number
  /** Kurve. Nimmt die GSAP-Namen der Vorlage an (`power2.out`) oder eine CSS-Kurve. */
  ease?: string
  /**
   * Wie die Fuellung kommt.
   *
   *   `wipe` - eine Blende faehrt von links nach rechts ueber das Wort. Ein Vorgang.
   *   `fade` - jeder Buchstabe blendet fuer sich auf, wieder gestaffelt.
   *   `none` - gar keine. Der Schriftzug bleibt eine Kontur.
   */
  fillMode?: StrokeTextFillMode
  /**
   * Die Schriftgroesse - und damit vor allem der **Massstab der Zeichnung**.
   *
   * Sie legt den Ausschnitt fest, in dem gezeichnet wird, und das Verhaeltnis von Strich zu
   * Buchstabe. Wie gross der Schriftzug am Ende auf dem Schirm steht, entscheidet dagegen
   * die Breite, die ihm das Stilblatt gibt: Der Ausschnitt wird hineinskaliert. Ein
   * groesserer Wert hier macht den Strich also **feiner**, nicht das Wort groesser.
   */
  fontSize?: number
  fontWeight?: number | string
  fontFamily?: string
  letterSpacing?: number
  /** Von hinten nach vorn schreiben. */
  reverse?: boolean
  /** Vorlauf vor dem ersten Buchstaben, in Sekunden. */
  delay?: number
  /** Laeuft die Folge sofort los, oder wartet sie auf `play()`? */
  trigger?: 'mount' | 'manual'
  /**
   * Steht die Oberflaeche still (E18, GDD 13 Abschnitt 3)?
   *
   * Wird bei `play()` gefragt. Steht sie still, steht der Schriftzug sofort fertig da -
   * dasselbe Bild, nur ohne den Weg dorthin.
   */
  still?(): boolean
}

export type StrokeText = {
  /** Der Knoten. Der Aufrufer haengt ihn ein, wo er ihn braucht. */
  node: HTMLElement
  /** Schreibt los. Ein zweiter Aufruf setzt neu an. */
  play(): void
  detach(): void
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Wie lange die Fuellung braucht, abgeleitet aus der Schreibdauer.
 *
 * Halb so lang wie die Kontur, aber nie unter vier Zehnteln - dieselbe Rechnung wie in der
 * Vorlage. Sie steht als Funktion und nicht als Zahl, weil ein Aufrufer wissen muss, **wann**
 * der Schriftzug fertig ist: Was danach kommt, haengt daran. Zweimal dieselbe Formel waere
 * zweimal dieselbe Aenderung, und beim zweiten Mal vergisst sie jemand.
 */
export function strokeFillSeconds(drawDuration: number): number {
  return Math.max(0.4, drawDuration * 0.5)
}

/**
 * Die Kurven von GSAP als Bezierkurven.
 *
 * `power1` bis `power4` sind dort die Potenzen zwei bis fuenf - dieselben Kurven, die
 * anderswo `quad`, `cubic`, `quart` und `quint` heissen. Die Werte sind die gebraeuchlichen
 * Naeherungen; sie stimmen nicht auf die dritte Stelle, aber sie stimmen im Empfinden, und
 * darum geht es bei einer Kurve.
 *
 * Was hier nicht steht, wird unveraendert durchgereicht - eine eigene Kurve in
 * CSS-Schreibweise geht also genauso.
 *
 * Ohne Leerzeichen geschrieben, und das ist kein Geschmack: Der Waechter in
 * `selftest/guards.ts` sucht nach Spielertexten, die im Code stehen statt in
 * `data/strings.ts`, und haelt jede Zeichenkette aus mehreren Woertern fuer verdaechtig.
 * Ein Wert ohne Leerzeichen ist erkennbar keiner - CSS ist das gleich.
 */
const CURVES: Record<string, string> = {
  none: 'linear',
  linear: 'linear',
  'power1.in': 'cubic-bezier(0.55,0.085,0.68,0.53)',
  'power1.out': 'cubic-bezier(0.25,0.46,0.45,0.94)',
  'power1.inOut': 'cubic-bezier(0.455,0.03,0.515,0.955)',
  'power2.in': 'cubic-bezier(0.55,0.055,0.675,0.19)',
  'power2.out': 'cubic-bezier(0.215,0.61,0.355,1)',
  'power2.inOut': 'cubic-bezier(0.645,0.045,0.355,1)',
  'power3.in': 'cubic-bezier(0.895,0.03,0.685,0.22)',
  'power3.out': 'cubic-bezier(0.165,0.84,0.44,1)',
  'power3.inOut': 'cubic-bezier(0.77,0,0.175,1)',
  'power4.in': 'cubic-bezier(0.755,0.05,0.855,0.06)',
  'power4.out': 'cubic-bezier(0.23,1,0.32,1)',
  'power4.inOut': 'cubic-bezier(0.86,0,0.07,1)',
}

/**
 * Fortlaufende Nummer fuer die Kennung der Blende.
 *
 * Zwei Schriftzuege auf derselben Seite braeuchten sonst dieselbe Kennung, und die zweite
 * Blende schnitte die erste mit. Ein Zufallswert waere hier das Naheliegende und ist genau
 * das, was die Querschnittsregel nicht zulaesst (`selftest/guards.ts`) - eine Nummer tut es
 * ohnehin besser, weil sie nachstellbar ist.
 */
let serial = 0

export function mountStrokeText(options: StrokeTextOptions): StrokeText {
  const text = t(options.key)
  const characters = Array.from(text)

  const strokeColor = options.strokeColor ?? 'var(--edge)'
  const fillColor = options.fillColor ?? 'var(--text)'
  const strokeWidth = options.strokeWidth ?? 1.4
  const drawDuration = options.drawDuration ?? 1.6
  const fillDelay = options.fillDelay ?? 0.2
  const stagger = options.stagger ?? 0.05
  const ease = CURVES[options.ease ?? 'power2.out'] ?? options.ease ?? 'ease-out'
  const fillMode = options.fillMode ?? 'wipe'
  const fontSize = options.fontSize ?? 128
  const fontWeight = options.fontWeight ?? 800
  const fontFamily = options.fontFamily ?? 'var(--font)'
  const letterSpacing = options.letterSpacing ?? -4
  const lead = options.delay ?? 0

  /** Wie lang der Strich ist, mit dem gezeichnet wird - siehe den Kopf der Datei. */
  const dash = Math.max(fontSize * 7, 200)
  /** Die Fuellung ist schneller als die Kontur, aber nie hastig. Wie in der Vorlage. */
  const fillDuration = strokeFillSeconds(drawDuration)

  serial += 1
  const clipId = `stroke-text-wipe-${serial}`

  // -------------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------------

  const node = document.createElement('span')
  node.className = 'stroke-text'
  // Zwei Textebenen und ein Haufen Pfade - vorgelesen waere das Buchstabensalat. Nach aussen
  // ist der Schriftzug **ein Bild mit einer Beschriftung**, und die ist das Wort selbst.
  node.setAttribute('role', 'img')
  node.setAttribute('aria-label', text)

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'stroke-text-svg')
  // `preserveAspectRatio` bleibt weg: Die Vorlage setzt dort `xMidYMid meet`, und genau das
  // ist der Vorgabewert - mittig einpassen, nichts abschneiden.
  svg.setAttribute('aria-hidden', 'true')
  // Ein vorlaeufiger Ausschnitt, damit vor der ersten Messung nichts springt.
  svg.setAttribute('viewBox', `0 ${-fontSize} ${fontSize * characters.length} ${fontSize * 1.3}`)

  const defs = document.createElementNS(SVG_NS, 'defs')
  const clip = document.createElementNS(SVG_NS, 'clipPath')
  clip.setAttribute('id', clipId)
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse')
  const wipe = document.createElementNS(SVG_NS, 'rect')
  wipe.setAttribute('x', '0')
  wipe.setAttribute('y', '0')
  wipe.setAttribute('width', '0')
  wipe.setAttribute('height', '0')
  clip.appendChild(wipe)
  defs.appendChild(clip)
  svg.appendChild(defs)

  /** Setzt Schriftschnitt und Laufweite an eine der beiden Textebenen. */
  function dress(element: SVGTextElement): void {
    element.setAttribute('x', '0')
    element.setAttribute('y', '0')
    element.style.fontSize = `${fontSize}px`
    element.style.fontWeight = String(fontWeight)
    element.style.fontFamily = fontFamily
    element.style.letterSpacing = `${letterSpacing}px`
  }

  /** Eine Textebene mit einem `<tspan>` je Zeichen - die Zeichen sind die Ziele der Folge. */
  function layer(className: string): { element: SVGTextElement; parts: SVGTSpanElement[] } {
    const element = document.createElementNS(SVG_NS, 'text')
    element.setAttribute('class', className)
    dress(element)

    const parts: SVGTSpanElement[] = []
    for (const character of characters) {
      const part = document.createElementNS(SVG_NS, 'tspan')
      // Leerzeichen wuerden am Zeilenanfang zusammenfallen - `xml:space` haelt sie.
      part.setAttribute('xml:space', 'preserve')
      part.textContent = character
      element.appendChild(part)
      parts.push(part)
    }

    return { element, parts }
  }

  const outline = layer('stroke-text-stroke')
  outline.element.style.fill = 'none'
  outline.element.style.stroke = strokeColor
  outline.element.style.strokeWidth = String(strokeWidth)
  outline.element.style.strokeLinejoin = 'round'
  outline.element.style.strokeLinecap = 'round'

  const solid = layer('stroke-text-fill')
  solid.element.style.fill = fillColor
  solid.element.style.stroke = 'none'
  if (fillMode === 'wipe') solid.element.style.clipPath = `url(#${clipId})`

  svg.append(outline.element, solid.element)
  node.appendChild(svg)

  /*
   * Die Reihenfolge der Verzoegerungen.
   *
   * `reverse` dreht sie um - in der Vorlage ist das `from: 'end'`. Der letzte Buchstabe
   * faengt dann an, und das Wort schreibt sich rueckwaerts zusammen.
   */
  function order(index: number): number {
    return options.reverse === true ? characters.length - 1 - index : index
  }

  for (const [index, part] of outline.parts.entries()) {
    part.style.strokeDasharray = String(dash)
    part.style.strokeDashoffset = String(dash)
    part.style.transition = `stroke-dashoffset ${drawDuration}s ${ease} ${lead + order(index) * stagger}s`
  }

  const fillStart = lead + drawDuration + fillDelay

  for (const [index, part] of solid.parts.entries()) {
    // Bei der Blende ist die Fuellung von Anfang an da und wird nur nicht gezeigt; beim
    // Aufblenden ist sie da und durchsichtig. Ohne Fuellung bleibt sie ganz weg.
    part.style.opacity = fillMode === 'wipe' ? '1' : '0'
    if (fillMode === 'fade') {
      part.style.transition = `opacity ${fillDuration}s ${CURVES['power2.out']} ${fillStart + order(index) * stagger}s`
    }
  }

  wipe.style.transition = `width ${fillDuration}s ${CURVES['power2.inOut']} ${fillStart}s`

  // -------------------------------------------------------------------------
  // Messen
  // -------------------------------------------------------------------------

  /** Die gemessene Breite des Wortes in Zeichenkoordinaten - 0, solange nicht gemessen. */
  let width = 0
  /** Wartet ein `play()` darauf, dass gemessen wurde? */
  let pending = false
  let detached = false

  /**
   * Ausschnitt und Blende auf den tatsaechlichen Umriss setzen.
   *
   * Der Rand ringsherum ist noetig, weil der **Strich** ueber den Umriss hinaussteht: Ohne
   * ihn schnitte der Ausschnitt genau an der Aussenkante der Buchstaben ab und der Strich
   * waere an den Raendern halbiert.
   */
  function measure(): void {
    if (detached) return

    let box: DOMRect
    try {
      box = outline.element.getBBox()
    } catch {
      // Ein Knoten ohne Darstellung hat keinen Umriss. Kein Fehler - nur noch nichts zu tun.
      return
    }
    if (box.width === 0) return

    const pad = Math.max(strokeWidth, fontSize * 0.1)
    width = box.width + pad * 2

    svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${width} ${box.height + pad * 2}`)
    wipe.setAttribute('x', String(box.x - pad))
    wipe.setAttribute('y', String(box.y - pad))
    wipe.setAttribute('height', String(box.height + pad * 2))

    if (pending) {
      pending = false
      play()
    }
  }

  // Zweimal messen: jetzt mit dem, was da ist, und noch einmal, sobald die Schriften stehen.
  // Der Fehlschlag wird abgefangen - eine fehlende Schriftdatei ist ein hinnehmbarer
  // Zustand, genau wie ein fehlendes Geraeusch (`app/audio.ts`).
  measure()
  void document.fonts?.ready.then(measure).catch(() => {})

  // -------------------------------------------------------------------------
  // Ablauf
  // -------------------------------------------------------------------------

  /** Alles auf einmal in den Endzustand - fuer die stillgestellte Oberflaeche. */
  function finish(): void {
    for (const part of outline.parts) {
      part.style.transition = 'none'
      part.style.strokeDashoffset = '0'
    }
    for (const part of solid.parts) {
      part.style.transition = 'none'
      part.style.opacity = fillMode === 'none' ? '0' : '1'
    }
    wipe.style.transition = 'none'
    wipe.setAttribute('width', fillMode === 'none' ? '0' : String(width))
  }

  function play(): void {
    if (detached) return

    /*
     * Notfalls hier nachmessen.
     *
     * Beim Aufbau haengt der Knoten noch **nicht** im Dokument - der Aufrufer bekommt ihn ja
     * erst zurueck und haengt ihn dann ein. Ein Element ausserhalb des Baumes hat keine
     * Darstellung und damit keinen Umriss; die Messung von oben liefert dort nichts. Beim
     * Abspielen ist er sicher drin.
     */
    if (width === 0) measure()

    // Ohne Mass keine Blende: Die Breite steht erst nach der Messung fest, und eine Blende
    // ueber null Breite zeigt nie etwas. Der Wunsch wird gemerkt und nachgeholt.
    if (width === 0) {
      pending = true
      return
    }

    if (options.still?.() === true) {
      finish()
      return
    }

    for (const part of outline.parts) part.style.strokeDashoffset = '0'
    if (fillMode === 'fade') for (const part of solid.parts) part.style.opacity = '1'
    if (fillMode === 'wipe') wipe.setAttribute('width', String(width))
  }

  if (options.trigger === 'mount') play()

  return {
    node,
    play,
    detach() {
      detached = true
      node.remove()
    },
  }
}
