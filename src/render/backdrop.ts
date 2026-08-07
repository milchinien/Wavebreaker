/**
 * Lichtbahnen hinter den Menuebereichen (GDD 13 Abschnitt 2 und 10).
 *
 * In der Basis, im Prestige-Baum und in den Einstellungen laeuft kein Kampf: Nichts bewegt
 * sich auf dem Feld, und der Grund ist eine fast schwarze Flaeche mit einem Raster darauf.
 * Diese Ebene schiebt langsame, weit weichgezeichnete Lichtbahnen dahinter - dieselbe
 * Absicht wie beim Schein um die Station: Der Grund soll ein **Raum** sein und kein Papier.
 *
 * Drei Entscheidungen halten das zusammen:
 *
 *   - **Jede Bahn rechnet aus der Zeit, nicht aus dem letzten Bild.** Ort und Puls stehen
 *     als Formel ueber `time`. Damit gibt es nichts, was bei einer Groessenaenderung neu
 *     gewuerfelt werden muesste - die Bahnen bleiben dieselben, nur der Ausschnitt aendert
 *     sich. (Die Vorlage wuerfelt bei jedem `resize` neu; man sieht das Bild dabei springen.)
 *   - **Gezeichnet wird klein und hochgezogen.** Die Weichzeichnung, von der der ganze
 *     Effekt lebt, kostet auf der vollen Flaeche jedes Bild spuerbar Zeit. Auf einem Sechstel
 *     der Kantenlaenge kostet sie fast nichts, und das Hochziehen verwischt den Rest von
 *     selbst. Deshalb ist die Weichzeichnung hier kein Problem, sondern gratis.
 *   - **Die Ebene blendet auf und ab.** Ein Bereichswechsel ist eine Bewegung, kein Schnitt
 *     (siehe `ui/shell.ts`) - eine Ebene, die beim Umschalten erscheint, waere einer.
 *
 * **Regel wie beim uebrigen Hintergrund:** Man soll die Bahnen nicht sehen, sondern den
 * Grund als beleuchtet empfinden. Faellt eine einzelne Bahn auf, ist sie zu hell.
 */

import { createRng } from '../core/rng.ts'
import { RGB } from './theme.ts'

/** Anzahl der Bahnen. Mehr fuellen das Bild, statt es zu beleben. */
const COUNT = 14

/** Kantenteiler der Zwischenebene. Bei 4 bleibt von 1920 x 1080 ein Bild von 480 x 270. */
const SCALE = 4

/**
 * Weichzeichnung in echten Pixeln.
 *
 * Nachgemessen: Bei 40 laufen alle Bahnen zu einem Nebelfleck zusammen, und man sieht nur
 * noch, dass es links heller ist als rechts. Bei 26 bleibt jede Bahn als Bahn lesbar, ohne
 * dass irgendwo eine Kante steht.
 */
const BLUR = 26

/** Wie weit eine Bahn reicht, als Vielfaches der Bildhoehe. */
const LENGTH = 2.4

/** Auf- und Abblenden, als Anteil des verbleibenden Wegs je Sekunde. */
const FADE_RATE = 3.6

/** Ab hier gilt die Ebene als aus - darunter waere sie ohnehin nicht zu sehen. */
const FADE_FLOOR = 0.004

type Beam = {
  /** Startort quer zum Bild, als Anteil der Breite. Reicht bewusst ueber beide Raender. */
  x: number
  /** Wo die Bahn zum Zeitpunkt 0 auf ihrem Weg steht: 0 unten, 1 oben. */
  phase: number
  /** Breite in echten Pixeln. */
  width: number
  /** Tempo in echten Pixeln je Sekunde. */
  speed: number
  /** Neigung in Grad. Alle Bahnen laufen in dieselbe Richtung - sonst wird es ein Gitter. */
  angle: number
  /** Farbe zwischen Cyan (0) und Violett (1). */
  tint: number
  /** Deckkraft im Kern der Bahn. */
  opacity: number
  /** Versatz und Rate des Atmens, damit nicht alle Bahnen im Gleichschritt heller werden. */
  pulse: number
  pulseRate: number
}

const CYAN = channels(RGB.cyan)
const VIOLET = channels(RGB.violet)

/**
 * Die Bahnen stehen ein fuer alle Mal fest.
 *
 * Fester Startwert statt `Math.random()`: Zufall kommt im ganzen Spiel aus `core/rng.ts`
 * (Implementierungsplan Abschnitt 3). Hier hat das zusaetzlich einen sichtbaren Nutzen -
 * der Hintergrund sieht bei jedem Start gleich aus, also ist ein zu heller Wurf kein
 * Zufallsfund, sondern nachstellbar.
 */
const BEAMS: readonly Beam[] = createBeams()

function createBeams(): Beam[] {
  const rng = createRng(0x57a4e)
  const beams: Beam[] = []

  for (let i = 0; i < COUNT; i++) {
    beams.push({
      // Gleichmaessig verteilt und dann leicht verschoben: rein zufaellige Orte lassen
      // regelmaessig zwei Bahnen aufeinanderfallen und daneben eine leere Haelfte.
      x: -0.15 + (1.3 * (i + rng.range(0.15, 0.85))) / COUNT,
      phase: rng.next(),
      width: rng.range(60, 150),
      speed: rng.range(14, 30),
      angle: rng.range(-38, -28),
      tint: rng.next(),
      opacity: rng.range(0.05, 0.13),
      pulse: rng.range(0, Math.PI * 2),
      pulseRate: rng.range(0.12, 0.3),
    })
  }

  return beams
}

/** Aktuelle Staerke der Ebene und der Zeitpunkt des letzten Bildes - fuer das Blenden. */
let level = 0
let lastTime = 0

/** Die kleine Zwischenebene. Eine fuer die ganze Anwendung, sie haelt nur ein Bild. */
let layer: HTMLCanvasElement | null = null
let layerCtx: CanvasRenderingContext2D | null = null

/**
 * Die Bahnen zeichnen. `target` ist 1, wo die Ebene hingehoert, und sonst 0 - das Blenden
 * dazwischen macht diese Funktion selbst.
 *
 * `time` sind echte Sekunden seit dem Start, keine Simulationszeit: Der Hintergrund zieht
 * bei Tempo x4 nicht viermal so schnell durch.
 */
export function drawLightBeams(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  target: number,
): void {
  // Der erste Aufruf nach dem Start liefert `time` = 0 und darf keinen Sprung ergeben; ein
  // Tabwechsel liefert eine grosse Luecke und darf die Ebene nicht schlagartig aufblenden.
  const step = Math.min(Math.max(time - lastTime, 0), 0.1)
  lastTime = time
  level += (target - level) * Math.min(1, step * FADE_RATE)

  if (level < FADE_FLOOR || width <= 0 || height <= 0) return

  const small = prepareLayer(width, height)
  if (!small) return

  const w = small.canvas.width
  const h = small.canvas.height
  const length = h * LENGTH
  // Der Weg reicht von "Ursprung an der Unterkante" bis "Bahn vollstaendig oberhalb". An
  // beiden Enden ist nichts zu sehen, also entsteht beim Umlauf kein Aufblitzen.
  const span = h + length

  small.clearRect(0, 0, w, h)
  small.filter = `blur(${BLUR / SCALE}px)`
  // Licht addiert sich: Wo zwei Bahnen sich kreuzen, wird es heller, statt dass die vordere
  // die hintere verdeckt.
  small.globalCompositeOperation = 'lighter'

  for (const beam of BEAMS) {
    const travelled = beam.phase + (time * beam.speed) / SCALE / span
    const y = h - wrap01(travelled) * span
    const alpha = beam.opacity * (0.8 + 0.2 * Math.sin(beam.pulse + time * beam.pulseRate))
    const color = mix(CYAN, VIOLET, beam.tint)

    small.save()
    small.translate(beam.x * w, y)
    small.rotate((beam.angle * Math.PI) / 180)

    // Laengsverlauf: an beiden Enden nichts, in der Mitte voll. Quer wird die Bahn erst
    // durch die Weichzeichnung weich - eine harte Kante gibt es nach ihr nicht mehr.
    const gradient = small.createLinearGradient(0, 0, 0, length)
    gradient.addColorStop(0, `rgba(${color}, 0)`)
    gradient.addColorStop(0.15, `rgba(${color}, ${alpha * 0.5})`)
    gradient.addColorStop(0.5, `rgba(${color}, ${alpha})`)
    gradient.addColorStop(0.85, `rgba(${color}, ${alpha * 0.5})`)
    gradient.addColorStop(1, `rgba(${color}, 0)`)

    small.fillStyle = gradient
    small.fillRect(-beam.width / SCALE / 2, 0, beam.width / SCALE, length)
    small.restore()
  }

  ctx.save()
  ctx.globalAlpha = level
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(small.canvas, 0, 0, width, height)
  ctx.restore()
}

/** Die Zwischenebene in der passenden Groesse. `null`, wenn es keinen Kontext gibt. */
function prepareLayer(width: number, height: number): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width / SCALE))
  const h = Math.max(1, Math.ceil(height / SCALE))

  if (!layer) {
    layer = document.createElement('canvas')
    layerCtx = layer.getContext('2d')
  }
  if (!layerCtx) return null

  if (layer.width !== w || layer.height !== h) {
    layer.width = w
    layer.height = h
  }

  return layerCtx
}

/** Anteil auf dem Weg, immer in [0, 1) - auch weit hinter dem Start. */
function wrap01(value: number): number {
  return ((value % 1) + 1) % 1
}

/** "70, 200, 255" als Zahlen. Die Farben stehen in `theme.ts` und nur dort. */
function channels(value: string): [number, number, number] {
  const [r, g, b] = value.split(',').map((part) => Number(part.trim()))
  return [r ?? 0, g ?? 0, b ?? 0]
}

/** Mischfarbe als "r, g, b" - fertig fuer `rgba(...)`. */
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const blue = Math.round(a[2] + (b[2] - a[2]) * t)
  return `${r}, ${g}, ${blue}`
}
