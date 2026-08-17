/**
 * Punktmatrix, die unter dem Zeiger aufblendet (GDD 13 Abschnitt 10).
 *
 * Die Vorlage ist der „Canvas Reveal Effect" von Aceternity: ein Raster feiner Punkte, die
 * in zufaelliger Reihenfolge auftauchen, beim Auftauchen kurz heller blitzen und danach
 * langsam weiterflackern. Dort ist das ein WebGL-Shader in React; hier ist es dieselbe
 * Rechnung auf einem gewoehnlichen 2D-Canvas, weil dieses Projekt weder React noch three.js
 * kennt und ein Hover-Effekt kein Grund ist, beides einzuziehen.
 *
 * Vier Entscheidungen:
 *
 * **Ein Canvas fuer alle Kacheln.** Unter dem Zeiger kann immer nur **eine** Flaeche liegen.
 * Vierzig Upgrade-Kacheln bekaemen also vierzig Canvas, von denen neununddreissig nichts
 * tun - dieselbe Rechnung, aus der die Vorlage in ihrer Demo mit drei Karten davonkommt und
 * ein Menue nicht. Das eine Canvas wird stattdessen in die Kachel **umgehaengt**, ueber der
 * der Zeiger steht. Damit wandert und rollt es mit ihr mit, ohne dass hier jemand Koordinaten
 * nachfuehren muesste.
 *
 * **Die Farbe kommt von der Kachel.** Gelesen wird `--accent`, also die Farbe, in der die
 * Kategorie ohnehin schon leuchtet. Ein fester Farbwert wuerde die Zuordnung zerreissen, die
 * das Menue mit seinen Farben gerade aufbaut.
 *
 * **Der Browser gibt den Takt.** Wie bei den Funken (`ui/motes.ts`) und dem Muenzflug
 * (`ui/coinflight.ts`): Ein Effekt unter dem Zeiger gehoert dem Spieler, nicht der Welle, und
 * darf bei Tempo x4 nicht viermal so schnell laufen.
 *
 * **Bei abgeschalteter Bewegung bleibt es aus.** Das Stilblatt fuehrt `--motion`, und dort
 * haengt auch die Einstellung des Betriebssystems mit drin. Ein Effekt, der nur schmueckt,
 * fragt danach - genau wie der Schriftzug am Wellenende.
 */

import { createRng } from '../core/rng.ts'

export type Reveal = {
  detach(): void
}

/**
 * Kantenlaenge einer Rasterzelle in CSS-Pixeln.
 *
 * Vier und nicht sechs, und das haengt an der Flaeche: Eine Upgrade-Kachel misst rund
 * 33 x 69 Pixel. Bei sechs Pixeln je Zelle blieben davon fuenf Spalten uebrig - das liest
 * sich als ein paar verstreute Punkte, nicht als Raster. Bei vier sind es acht Spalten und
 * siebzehn Zeilen, und erst damit entsteht die Textur, um die es geht.
 */
const CELL = 4

/** Radius eines Punktes. Knapp unter der halben Zelle - sonst beruehren sie sich. */
const DOT = 0.9

/**
 * Wie lange das Aufblenden dauert, in Sekunden.
 *
 * Es ist die Zeit, bis der spaeteste Punkt da ist. Die Vorlage rechnet umgekehrt mit einer
 * `animationSpeed`; eine Dauer ist hier die ehrlichere Angabe, weil daneben schon zwei
 * andere Dauern in Sekunden stehen.
 */
const FILL_SECONDS = 0.55

/** Wie lange der kurze Blitz dauert, mit dem ein Punkt auftaucht, und wie hell er ist. */
const FLASH_SECONDS = 0.09
const FLASH_GAIN = 1.6

/** Abstand zwischen zwei Wuerfen der Punkthelligkeit - das langsame Weiterflackern. */
const TWINKLE_SECONDS = 1.1

/**
 * Die Helligkeitsstufen, aus denen ein Punkt seine bekommt.
 *
 * Ungleich verteilt, und das mit Absicht: Die dunklen Stufen stehen mehrfach drin, damit die
 * Flaeche als **Textur** liest und nicht als gleichmaessiges Raster. Dieselbe Verteilung
 * benutzt die Vorlage.
 */
const LEVELS = [0.28, 0.28, 0.28, 0.45, 0.45, 0.62, 0.72, 0.85, 1]

/** Fester Startwert - der Zufall ist reine Optik und zieht nicht am Wuerfel des Laufs. */
const SEED = 0x9e10a5

type Cell = {
  x: number
  y: number
  /** Ab wann dieser Punkt da ist, als Anteil von `FILL_SECONDS`. */
  intro: number
  /** Wuerfel fuer die Helligkeit - je Flackerschritt neu gemischt. */
  roll: number
  /** Hellere Beimischung: ein Teil der Punkte traegt die aufgehellte Farbe. */
  light: boolean
}

export function mountReveal(
  /**
   * Flaeche, auf der gehorcht wird. Die Ereignisse werden **an ihr** abgefangen und nicht an
   * jeder Kachel: Das Menue baut seine Kacheln bei jeder Freischaltung neu auf, und ein
   * Zuhoerer je Kachel waere danach an Knoten geheftet, die es nicht mehr gibt.
   */
  root: HTMLElement,
  /** Woran eine Kachel zu erkennen ist. */
  selector: string,
): Reveal {
  const canvas = document.createElement('canvas')
  canvas.className = 'reveal'
  canvas.setAttribute('aria-hidden', 'true')

  const ctx = canvas.getContext('2d')
  const rng = createRng(SEED)

  let cells: Cell[] = []
  let host: HTMLElement | null = null
  let frame = 0
  /**
   * Startzeit des laufenden Aufblendens, in Millisekunden der Bildschirmuhr - `null`, solange
   * das erste Bild aussteht.
   *
   * Gesetzt wird sie aus dem Zeitstempel, den `requestAnimationFrame` selbst mitliefert, und
   * nicht aus `performance.now()`. Das ist keine Feinheit: Die Querschnittsregel laesst Zeit
   * nur aus `core/loop.ts` kommen, und der Selbsttest prueft das. Der Zeitstempel des Bildes
   * ist ohnehin der genauere Bezug - er liegt auf dem Bild, das gezeichnet wird.
   */
  let started: number | null = null
  let color = '255,255,255'
  let colorLight = '255,255,255'

  /** Laeuft die Oberflaeche ueberhaupt mit Bewegung? */
  function animates(): boolean {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--motion')
    return value.trim() !== '0'
  }

  /**
   * Die Leitfarbe der Kachel als `r,g,b`.
   *
   * Gelesen wird der **berechnete** Wert: `--accent` steht an der Gruppe, nicht an der
   * Kachel, und nur der berechnete Wert kennt die Vererbung. Was dabei herauskommt, ist je
   * nach Browser `rgb(...)` oder ein Farbwort - deshalb wird nicht geparst, sondern gemalt:
   * ein Pixel in dieser Farbe, ausgelesen. Das kann jeder Browser, und es kann jede Farbe.
   */
  function toneOf(node: HTMLElement): { base: string; light: string } {
    const raw = getComputedStyle(node).getPropertyValue('--accent').trim()
    const probe = ctx
    if (!probe || raw === '') return { base: '255,255,255', light: '255,255,255' }

    probe.save()
    probe.fillStyle = '#ffffff'
    probe.fillStyle = raw
    const painted = probe.fillStyle
    probe.restore()

    // `fillStyle` gibt immer `#rrggbb` oder `rgba(...)` zurueck, nie ein Farbwort.
    let r = 255
    let g = 255
    let b = 255
    if (painted.startsWith('#') && painted.length >= 7) {
      r = parseInt(painted.slice(1, 3), 16)
      g = parseInt(painted.slice(3, 5), 16)
      b = parseInt(painted.slice(5, 7), 16)
    } else {
      const parts = painted.match(/\d+(\.\d+)?/g)
      if (parts && parts.length >= 3) {
        r = Number(parts[0])
        g = Number(parts[1])
        b = Number(parts[2])
      }
    }

    // Die Aufhellung mischt zu Weiss - so bekommt die Flaeche zwei Toene wie in der Vorlage,
    // ohne dass irgendwo eine zweite Farbe gepflegt werden muesste.
    const lift = (value: number): number => Math.round(value + (255 - value) * 0.55)
    return { base: `${r},${g},${b}`, light: `${lift(r)},${lift(g)},${lift(b)}` }
  }

  /** Das Raster fuer die aktuelle Groesse neu wuerfeln. */
  function layout(width: number, height: number): void {
    cells = []
    for (let y = CELL / 2; y < height; y += CELL) {
      for (let x = CELL / 2; x < width; x += CELL) {
        cells.push({
          x,
          y,
          intro: rng.next(),
          roll: rng.next(),
          // Jeder vierte Punkt traegt den helleren Ton.
          light: rng.next() < 0.25,
        })
      }
    }
  }

  function draw(now: number): void {
    if (!ctx || !host) return
    if (started === null) started = now

    const elapsed = (now - started) / 1000
    const fill = Math.min(1, elapsed / FILL_SECONDS)
    const twinkle = Math.floor(elapsed / TWINKLE_SECONDS)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const cell of cells) {
      if (cell.intro > fill) continue

      // Der kurze Blitz beim Auftauchen. Er ist der Grund, warum die Flaeche **einschlaegt**
      // statt einzublenden - ohne ihn sieht dasselbe Raster nach einer Ueberblendung aus.
      const since = elapsed - cell.intro * FILL_SECONDS
      const flash = since < FLASH_SECONDS ? 1 + FLASH_GAIN * (1 - since / FLASH_SECONDS) : 1

      // Die Helligkeit wird je Flackerschritt neu gemischt. Der Wurf kommt aus Zellwurf und
      // Schrittzaehler, ist also fuer dieselbe Zelle im selben Schritt immer derselbe - ein
      // frischer Zufall je Bild waere Rauschen, kein Flackern.
      const mixed = (cell.roll * 7919 + twinkle * 104729) % 1
      const level = LEVELS[Math.floor(mixed * LEVELS.length)] ?? 1

      ctx.fillStyle = `rgba(${cell.light ? colorLight : color},${Math.min(1, level * flash)})`
      ctx.beginPath()
      ctx.arc(cell.x, cell.y, DOT, 0, Math.PI * 2)
      ctx.fill()
    }

    frame = requestAnimationFrame(draw)
  }

  function start(node: HTMLElement): void {
    if (!ctx || node === host) return
    if (!animates()) return

    stop()
    host = node

    const width = node.clientWidth
    const height = node.clientHeight
    if (width <= 0 || height <= 0) {
      host = null
      return
    }

    // Echte Geraetepixel, gezeichnet wird in CSS-Pixeln - dieselbe Rechnung wie beim
    // Spielfeld, damit die Punkte auf einem hochaufloesenden Schirm nicht ausfransen.
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

    const tone = toneOf(node)
    color = tone.base
    colorLight = tone.light

    layout(width, height)

    // Vorne einhaengen: Die Punkte liegen damit **unter** Stufe, Zeichen und Preis, ohne dass
    // an deren Regeln eine Stapelordnung dazukommt. Die Reihenfolge im Baum entscheidet.
    node.prepend(canvas)
    started = null
    frame = requestAnimationFrame(draw)
  }

  function stop(): void {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    canvas.remove()
    host = null
  }

  function onOver(event: PointerEvent): void {
    const target = (event.target as Element | null)?.closest(selector)
    if (target instanceof HTMLElement) start(target)
  }

  function onOut(event: PointerEvent): void {
    // `pointerout` feuert auch beim Wechsel zwischen zwei Kindern derselben Kachel. Nur wenn
    // der Zeiger die Kachel wirklich verlaesst, ist Schluss.
    const to = event.relatedTarget
    if (to instanceof Node && host?.contains(to)) return
    stop()
  }

  root.addEventListener('pointerover', onOver)
  root.addEventListener('pointerout', onOut)
  // Rollt die Liste unter dem Zeiger weg, steht der Effekt sonst auf einer Kachel, die gar
  // nicht mehr dort liegt.
  root.addEventListener('scroll', stop, { passive: true })

  return {
    detach() {
      stop()
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerout', onOut)
      root.removeEventListener('scroll', stop)
    },
  }
}
