/**
 * Bildstreifen aus dem Anlagensatz (`docs/anlagen.md`).
 *
 * Alle benutzten Effekt- und Muenzbilder liegen als **waagerechter Streifen** vor: gleich
 * breite Einzelbilder nebeneinander, optional mehrere Reihen fuer Varianten. Diese Datei
 * kennt genau diese eine Form und sonst nichts.
 *
 * Drei Regeln halten das Zeichnen ruhig:
 *
 *   - **Nie auf ein Bild warten.** Solange eine Datei nicht geladen ist, meldet `ready`
 *     false und der Aufrufer zeichnet seine gezeichnete Fassung. Ein fehlendes Bild darf
 *     nie ein leeres Feld ergeben.
 *   - **Nichts beim Laden der Datei anlegen.** Die Selbsttests laufen ohne Browser
 *     (`npm run selftest`) und ziehen dabei auch `render/` herein. Ein `new Image()` auf
 *     Modulebene liesse den ganzen Lauf abstuerzen - deshalb entsteht das Bild erst beim
 *     ersten Zeichnen, und ohne Browser entsteht es nie.
 *   - **Pixelbilder bleiben Pixelbilder.** Beim Zeichnen wird die Glaettung abgeschaltet
 *     und auf ganze Pixel gesetzt, sonst verwaschen 16 Pixel grosse Muenzen zu Flecken.
 */

export type Strip = {
  /** Anzahl der Einzelbilder je Reihe. */
  frames: number
  /** Anzahl der Reihen - Varianten desselben Effekts, etwa Wertstufen einer Muenze. */
  rows: number
  /** true, sobald die Datei da ist. Vorher zeichnet der Aufrufer seine Ersatzform. */
  ready(): boolean
  /** Das geladene Bild, oder null solange es keines gibt. Nur `drawFrame` braucht das. */
  bitmap(): HTMLImageElement | null
}

/**
 * Einen Streifen anmelden. Laedt beim ersten Gebrauch im Hintergrund und blockiert nichts.
 *
 * `frames` und `rows` stehen hier und nicht in der Datei, weil eine PNG ihre Rasterung
 * nicht mitliefert. Sie sind in `docs/anlagen.md` festgehalten - wer eine Datei tauscht,
 * traegt sie dort und hier nach.
 */
export function loadStrip(src: string, frames: number, rows = 1): Strip {
  let image: HTMLImageElement | null = null
  let loaded = false

  /** Ohne Browser gibt es kein Bild - dann bleibt der Streifen fuer immer leer. */
  function ensure(): HTMLImageElement | null {
    if (image) return image
    if (typeof Image === 'undefined') return null
    image = new Image()
    image.addEventListener('load', () => {
      loaded = true
    })
    image.src = src
    return image
  }

  return {
    frames,
    rows,
    ready() {
      const node = ensure()
      return loaded && node !== null && node.naturalWidth > 0
    },
    bitmap: () => (loaded ? image : null),
  }
}

/**
 * Ein Einzelbild mittig auf einen Punkt zeichnen.
 *
 * `size` ist die gewuenschte Kantenlaenge auf dem Bildschirm, nicht in der Vorlage - der
 * Aufrufer rechnet also in Bildschirmpixeln und muss die Groesse der Datei nicht kennen.
 *
 * Der Bildindex wird umgebrochen statt geklemmt: Ein Effekt, der ueber sein Ende
 * hinauslaeuft, faengt von vorn an, statt auf dem letzten Bild zu kleben.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  strip: Strip,
  frame: number,
  row: number,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const image = strip.bitmap()
  if (!image || size < 0.5) return

  const fw = image.naturalWidth / strip.frames
  const fh = image.naturalHeight / strip.rows
  if (fw <= 0 || fh <= 0) return

  const index = ((Math.floor(frame) % strip.frames) + strip.frames) % strip.frames
  const line = ((Math.floor(row) % strip.rows) + strip.rows) % strip.rows
  const height = (size * fh) / fw

  // Auf ganze Pixel setzen und ohne Glaettung zeichnen - beides zusammen haelt die
  // Pixelkanten scharf. Fehlt eines davon, franst eine 16-Pixel-Muenze aus.
  const previous = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    image,
    index * fw,
    line * fh,
    fw,
    fh,
    Math.round(centerX - size / 2),
    Math.round(centerY - height / 2),
    Math.round(size),
    Math.round(height),
  )
  ctx.imageSmoothingEnabled = previous
}

/**
 * Die Streifen des Spiels. Aufbau und Herkunft stehen in `docs/anlagen.md`.
 *
 * Angemeldet wird hier, geladen erst beim ersten Zeichnen - siehe `loadStrip`.
 */
export const SPRITES = {
  /** Drei Wertstufen zu je sieben Glanzbildern, 16 px. */
  coins: loadStrip('/coins/coins.png', 7, 3),
  /** Einschlag am Gegner - zehn Bilder, blau. */
  impact: loadStrip('/fx/impact.png', 10),
  /** Zerfall eines Gegners - zehn Bilder, violett. */
  death: loadStrip('/fx/death.png', 10),
  /** Funkenwurf bei einem kritischen Treffer - zehn Bilder, gold. */
  spark: loadStrip('/fx/spark.png', 10),
} as const
