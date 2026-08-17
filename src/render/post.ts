/**
 * Nachbearbeitung des fertigen Bildes: Glanzschleier und Rasterzeilen (GDD 13 Abschnitt 2).
 *
 * Diese Ebene zeichnet **nichts Neues**. Sie nimmt das Bild, das die uebrigen Ebenen gerade
 * hinterlassen haben, und legt zwei Lagen darueber, die beide nur von dem leben, was schon
 * da ist:
 *
 *   - **Der Glanzschleier.** Das Feld besteht aus wenigen hellen Neontoenen auf fast
 *     schwarzem Grund - genau die Sorte Bild, bei der eine Roehre, ein Objektiv und jedes
 *     Auge Licht ueber die Kante hinaus tragen. Ohne ihn sitzt jede Farbe genau in ihrem
 *     Vieleck und hoert dort hart auf; das sieht nach Vektorgrafik aus und nicht nach
 *     Leuchten. Der Schleier nimmt die hellen Stellen, verwischt sie weit und **addiert** sie
 *     zurueck: Kanten, Geschosse und Treffer bekommen einen Hof, ohne dass irgendwo eine
 *     zweite Zeichnung entstuende.
 *   - **Die Rasterzeilen.** Jede dritte Bildzeile eine Spur dunkler. Sie geben dem Feld die
 *     Oberflaeche eines Geraets - dieselbe Erzaehlung wie die Pixelschrift der Zahlen und der
 *     Startbildschirm. Ausserdem brechen sie die grossen Verlaeufe des Hintergrunds auf, die
 *     auf manchen Bildschirmen sonst in sichtbaren Stufen liegen.
 *
 * **Regel wie beim uebrigen Hintergrund (siehe `drawBackground`):** Man soll den Filter nicht
 * sehen, sondern das Bild fuer leuchtender halten. Faellt der Schleier als Schleier auf oder
 * lassen sich die Rasterzeilen zaehlen, ohne dass man die Nase an den Bildschirm haelt, ist
 * er zu stark.
 *
 * **Er verschiebt nichts und deckt nichts zu.** Der Schleier addiert nur - er kann eine
 * Auskunft heller machen, aber keine ausloeschen. Die Rasterzeilen nehmen ueberall gleich
 * viel weg, also bleibt jeder Helligkeitsunterschied ein Unterschied. Damit ist der Filter
 * reine Zierde und haengt am Effekt-Schalter (E18), genau wie die Lichtbahnen.
 *
 * Gerechnet wird in **echten Geraetepixeln**, nicht in CSS-Pixeln: Beide Lagen sind
 * Bildpunktarbeit. Eine Rasterzeile, die der Zeichenmatrix ueberlassen wird, faellt auf einem
 * Bildschirm mit doppelter Punktdichte zwischen zwei Punkte und wird zum grauen Schleier
 * statt zur Linie.
 */

/**
 * Kantenteiler der Zwischenebene fuer den Schleier. Bei 4 bleibt von 1920 x 1080 ein Bild
 * von 480 x 270 - dieselbe Ueberlegung wie bei den Lichtbahnen: Weichzeichnen kostet auf
 * einem Sechzehntel der Flaeche fast nichts, und das Hochziehen verwischt den Rest von
 * selbst.
 */
const SCALE = 4

/**
 * Weichzeichnung des Schleiers, in Pixeln der Zwischenebene.
 *
 * Vier ist hier viel: hochgezogen sind es sechzehn Bildpunkte. Genau das ist gewollt - ein
 * enger Hof sieht aus wie ein unscharfer Strich, erst ein weiter sieht aus wie Licht.
 */
const BLUR = 4

/**
 * Deckkraft des Schleiers.
 *
 * Er wird **addiert**, also zaehlt jeder Zehntel doppelt: Bei 0,8 laufen die hellen Kanten
 * der Station ineinander und die Fugen verlieren ihre Zeichnung - dann ist der Effekt kein
 * Leuchten mehr, sondern Nebel. Bei 0,45 bleibt jede Kante eine Kante und hat trotzdem einen
 * Hof.
 */
const GLOW = 0.45

/**
 * Abstand der Rasterzeilen in Geraetepixeln, bei einfacher Punktdichte.
 *
 * Drei ist die kleinste Zahl, die noch eine Zeile ergibt: zwei helle Punkte, ein dunkler.
 * Bei zwei waere die Haelfte des Bildes dunkel - das ist kein Raster mehr, sondern eine
 * Abdunklung. Bei vier und mehr wandert das Muster ins Bewusstsein, und dann sieht man
 * Streifen statt eines Geraets.
 */
const LINE_SPACING = 3

/**
 * Wie viel eine Rasterzeile wegnimmt.
 *
 * Reines Schwarz mit dieser Deckkraft, nicht das dunkle Blau des Grundes: Die Zeile muss
 * ueber der Station genauso liegen wie ueber dem leeren Feld. Schwarz mit geringer Deckkraft
 * ist eine gleichmaessige Abdunklung aller drei Kanaele - der Farbton bleibt also, wo er war.
 * Ein blaustichiger Streifen wuerde ueber einer goldenen Muenze zum Farbfehler.
 */
const LINE_ALPHA = 0.055

type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

/**
 * Die beiden Zwischenebenen: erst die hellen Stellen, dann dieselben weichgezeichnet.
 *
 * Zwei statt einer, und das ist keine Umstaendlichkeit, sondern der Unterschied zwischen
 * teuer und billig. Weichgezeichnet wird **in der kleinen Ebene** und nicht beim Hochziehen:
 * Nachgemessen kostete der Schleier 1,06 ms je Bild, als die Weichzeichnung auf der vollen
 * Flaeche lag - mehr als das ganze uebrige Bild (0,50 ms). In der kleinen Ebene arbeitet
 * dieselbe Weichzeichnung auf einem Sechzehntel der Punkte.
 *
 * Je eine fuer die ganze Anwendung; sie halten nur ein Bild und wachsen mit dem Fenster.
 */
let bright: Layer | null = null
let soft: Layer | null = null

/** Die Kachel der Rasterzeilen samt der Punktdichte, fuer die sie gebaut wurde. */
let lines: CanvasPattern | null = null
let linesRatio = 0

/**
 * Beide Lagen ueber das fertige Bild legen.
 *
 * `width` und `height` sind die Flaeche in CSS-Pixeln - dieselben Zahlen, mit denen alle
 * anderen Ebenen zeichnen. Die Punktdichte holt sich diese Datei aus dem Verhaeltnis von
 * Bildspeicher zu Flaeche; sie ist die einzige Stelle im Zeichenweg, die sie ueberhaupt
 * braucht.
 */
export function drawScreenFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return

  const canvas = ctx.canvas
  const ratio = canvas.width / width
  if (!Number.isFinite(ratio) || ratio <= 0) return

  ctx.save()
  // Ab hier zaehlt der Bildspeicher und nicht die Zeichenmatrix - siehe Kopf der Datei.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawGlow(ctx, canvas)
  drawScanlines(ctx, canvas, ratio)
  ctx.restore()
}

/**
 * Der Glanzschleier: helle Stellen heraustrennen, weichzeichnen, addieren.
 *
 * Das Heraustrennen ist ein Trick statt einer Rechnung: Das Bild wird **zweimal**
 * uebereinander in die Zwischenebene gezeichnet, das zweite Mal multiplizierend. Damit steht
 * dort jeder Farbwert im Quadrat. Der fast schwarze Grund (7 von 255) faellt dabei auf 0,2
 * und ist weg, eine helle Fuge (216) behaelt 183. Eine Schwelle waere nur mit
 * `getImageData` zu haben - und das holt jedes Bild den gesamten Bildspeicher aus der
 * Grafikkarte zurueck in den Hauptspeicher, also genau das, was man in einer Zeichenschleife
 * nie tun darf.
 *
 * Quadrieren statt Abschneiden hat ausserdem einen Nebeneffekt, den eine harte Schwelle
 * nicht haette: Der Uebergang ist stetig. Ein Gegner, der beim Treffer kurz durchbrennt,
 * bekommt seinen Hof allmaehlich und nicht ab einer bestimmten Helligkeit schlagartig.
 */
function drawGlow(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement): void {
  const w = Math.max(1, Math.ceil(source.width / SCALE))
  const h = Math.max(1, Math.ceil(source.height / SCALE))

  bright = prepareLayer(bright, w, h)
  soft = prepareLayer(soft, w, h)
  if (!bright || !soft) return

  // `copy` statt `clearRect` davor: dasselbe Ergebnis in einem Schritt.
  bright.ctx.globalCompositeOperation = 'copy'
  bright.ctx.drawImage(source, 0, 0, w, h)
  bright.ctx.globalCompositeOperation = 'multiply'
  bright.ctx.drawImage(source, 0, 0, w, h)

  soft.ctx.globalCompositeOperation = 'copy'
  soft.ctx.filter = `blur(${BLUR}px)`
  soft.ctx.drawImage(bright.canvas, 0, 0)

  // Licht addiert sich. Deshalb kann der Schleier nichts verdecken: Er macht heller, wo
  // schon etwas hell war, und laesst alles andere, wie es ist. Das Hochziehen verwischt
  // ausserdem noch einmal von selbst - deshalb genuegt drueben eine kleine Weichzeichnung.
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = GLOW
  ctx.drawImage(soft.canvas, 0, 0, source.width, source.height)

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

/** Jede dritte Zeile eine Spur dunkler - als Kachel, damit es ein Fuellvorgang bleibt. */
function drawScanlines(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ratio: number,
): void {
  const pattern = prepareLines(ctx, ratio)
  if (!pattern) return

  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

/** Eine Zwischenebene in der passenden Groesse. `null`, wenn es keinen Kontext gibt. */
function prepareLayer(existing: Layer | null, w: number, h: number): Layer | null {
  let target = existing
  if (!target) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    target = { canvas, ctx }
  }

  if (target.canvas.width !== w || target.canvas.height !== h) {
    target.canvas.width = w
    target.canvas.height = h
  }

  return target
}

/**
 * Die Kachel der Rasterzeilen: so hoch wie ein Abstand, unten die dunkle Zeile.
 *
 * Sie haengt an der Punktdichte und sonst an nichts - bei doppelter Dichte ist sie doppelt
 * so hoch und ihre Zeile doppelt so dick, damit das Muster auf jedem Bildschirm gleich fein
 * **aussieht** statt gleich viele Punkte zu belegen. Neu gebaut wird sie nur, wenn sich die
 * Dichte aendert, also beim Umzug auf einen anderen Bildschirm.
 */
function prepareLines(ctx: CanvasRenderingContext2D, ratio: number): CanvasPattern | null {
  if (lines && linesRatio === ratio) return lines

  const step = Math.max(2, Math.round(LINE_SPACING * ratio))
  const thickness = Math.max(1, Math.round(ratio))

  const tile = document.createElement('canvas')
  tile.width = 1
  tile.height = step
  const tileCtx = tile.getContext('2d')
  if (!tileCtx) return null

  tileCtx.fillStyle = `rgba(0, 0, 0, ${LINE_ALPHA})`
  tileCtx.fillRect(0, step - thickness, 1, thickness)

  lines = ctx.createPattern(tile, 'repeat')
  linesRatio = ratio
  return lines
}
