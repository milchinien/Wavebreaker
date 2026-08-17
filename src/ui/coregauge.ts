/**
 * Das Kernfeld: der Hauptturm als Instrument, die Erfahrung als seine Flaeche.
 *
 * Es sitzt in der **Fuge** der unteren Leiste - zwischen Reiterleiste und Kachelwand, dort,
 * wo bisher nichts stand (`.dock-row` im Stilblatt). Das ist der Grund, warum diese Anzeige
 * die Regel aus `ui/shell.ts` ("die Leiste traegt nur, was man anfasst") nicht bricht: Sie
 * macht die Leiste um **keinen Pixel** hoeher. Sie fuellt einen Platz, den das Raster
 * ohnehin frei laesst, sobald das Fenster breit genug ist - und wo er nicht frei ist, gibt
 * es sie nicht.
 *
 * Zwei Dinge stehen darin, und beide sagen dasselbe ueber den Fortschritt:
 *
 *   Der Kern    gezeichnet mit derselben Routine wie auf dem Feld (`render/station.ts`).
 *               Kein Piktogramm: Ein gesetztes Symbol waere ein Bild **vom** Kern, und beim
 *               zweiten Kern (GDD 10) haette es niemand mitgedreht. `lookOf` liefert Farbe,
 *               Fuellung und Leuchten des Kerns, den dieser Run wirklich hat - samt Atem im
 *               selben Takt wie im Feld, weil beide dieselbe Zeit bekommen.
 *   Die Flaeche dahinter der Ladestand bis zur naechsten Stufe.
 *
 * **Die Erfahrung ist hierher gewandert**, aus der Ressourcenzeile oben (`ui/hud.ts`). Dort
 * war sie eine zwei Pixel hohe Linie unter der Stufenzahl - ablesbar nur, wenn man sie
 * suchte, und der Aufstieg kam damit immer aus dem Nichts. Hier ist sie eine Flaeche, die
 * hinter dem Kern steigt: Man sieht sie im Augenwinkel, ohne hinzusehen, und sie sagt
 * nebenbei, **wem** dieser Fortschritt gehoert - der Station.
 *
 * Die Fuellung ist DOM und nicht Canvas, obwohl der Kern darueber gezeichnet wird. Sie
 * braucht genau zwei Dinge, die das Stilblatt geschenkt mitbringt und die auf dem Canvas
 * beide Handarbeit waeren: einen weichen Uebergang beim Steigen und eine scharfe Oberkante,
 * die dabei nicht mitgestaucht wird.
 */

import { formatNumber } from '../core/format.ts'
import { circumradius, inset } from '../core/geometry.ts'
import { t } from '../data/strings.ts'
import type { GameState } from '../app/state.ts'
import { levelProgress } from '../sim/progression.ts'
import { coreModule, type PlacedModule } from '../sim/station.ts'
import { drawEmblem } from '../render/emblems.ts'
import { stationFlash } from '../render/scene.ts'
import { lookOf, trace } from '../render/station.ts'
import { THEME } from '../render/theme.ts'
import { describe } from './tooltip.ts'

export type CoreGauge = {
  /**
   * Pro Bild aufrufen. `viewTime` ist dieselbe echte Zeit, mit der das Feld gezeichnet wird
   * (`main.ts`) - nur so atmen der Kern dort und der Kern hier im Gleichschritt. Mit
   * Simulationszeit atmete das Instrument bei Tempo x4 viermal so schnell wie sein Vorbild.
   */
  update(viewTime: number): void
  detach(): void
}

/**
 * Umkreisradius des Kerns als Anteil der Feldkante.
 *
 * Knapp ein Drittel: Der Kern soll die Mitte besetzen, aber die Flaeche dahinter muss als
 * Flaeche lesbar bleiben. Bei 0.4 fuellte das Sechseck das Feld fast aus, und der Ladestand
 * war nur noch ein Rand um ein Bild.
 */
const CORE_RADIUS_FACTOR = 0.3

/** Geraetepixel je CSS-Pixel, gedeckelt wie beim grossen Canvas (`main.ts`). */
const MAX_PIXEL_RATIO = 2

export function mountCoreGauge(root: HTMLElement, state: GameState): CoreGauge {
  /*
   * Zwei Lagen, und die Reihenfolge ist die Aussage: Der Ladestand liegt **hinter** dem
   * Kern. Andersherum verdeckte eine volle Leiste den Kern und das Feld haette bei jedem
   * Aufstieg kurz etwas anderes gezeigt.
   */
  const charge = document.createElement('i')
  charge.className = 'charge'

  const canvas = document.createElement('canvas')
  canvas.className = 'core-view'

  root.append(charge, canvas)

  const ctx = canvas.getContext('2d')

  /** Kantenlaenge in CSS-Pixeln. Null heisst: Das Feld steht gerade nicht im Bild. */
  let size = 0

  const resize = (): void => {
    if (!ctx) return
    // Dasselbe Verfahren wie beim Spielfeld: echte Geraetepixel im Puffer, gezeichnet wird
    // in CSS-Pixeln. Eine Groessenaenderung verzieht damit nichts.
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    size = canvas.clientWidth
    canvas.width = Math.round(size * ratio)
    canvas.height = Math.round(size * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  resize()
  /*
   * Das Feld aendert seine Groesse nicht nur mit dem Fenster: Unterhalb der Umbruchbreite
   * gibt es die Fuge nicht, und dann steht es auf `display: none`. Ohne diese Beobachtung
   * behielte das Canvas seinen alten Puffer und zeichnete beim Wiederauftauchen in einer
   * Aufloesung, die nicht mehr zur Kante passt.
   */
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  /*
   * Der Kern wird gebaut, nicht gesucht: `coreModule` erzeugt ihn aus der Kennung im
   * Spielstand, ohne die gesetzten Module durchzugehen. Gemerkt wird er trotzdem - er ist
   * fuer die ganze Laufzeit derselbe, und ein neues Polygon je Bild waere Muell fuer nichts.
   */
  let coreId = ''
  let core: PlacedModule | null = null

  /** Letzter geschriebener Stand - ohne ihn schriebe jedes Bild dieselben Zeichenketten. */
  let shown = ''

  function draw(viewTime: number): void {
    if (!ctx || !core || size <= 0) return

    ctx.clearRect(0, 0, size, size)

    // Der Treffer trifft beide Kerne: Zuckt die Station im Feld, zuckt sie auch hier. Ohne
    // das waere das Instrument ein Bild neben dem Spiel statt eine Anzeige darueber.
    const look = lookOf(core, viewTime, stationFlash(state))
    const center = { x: size / 2, y: size / 2 }
    const radius = size * CORE_RADIUS_FACTOR
    const scale = radius / circumradius(core.sides)
    const points = core.poly.map((point) => ({
      x: center.x + point.x * scale,
      y: center.y + point.y * scale,
    }))

    ctx.save()

    trace(ctx, points)
    ctx.fillStyle = look.fill
    ctx.fill()

    // Rahmen nach innen versetzt - dieselbe Fassung wie im Feld (`render/station.ts`).
    // Die Fugen fehlen, und zwar mit Absicht: Hier steht der Kern allein, und eine helle
    // Kante ohne Nachbarn dahinter waere eine Zusage auf ein Modul, das es nicht gibt.
    trace(ctx, inset(points, THEME.frameInset))
    ctx.strokeStyle = look.frame
    ctx.lineWidth = THEME.frameWidthCore
    ctx.shadowColor = look.frame
    ctx.shadowBlur = look.glow
    ctx.stroke()

    ctx.restore()

    drawEmblem(ctx, look.emblem, center, radius * THEME.emblemRadiusFactor, look.accent)
  }

  function update(viewTime: number): void {
    if (state.run.station.coreId !== coreId) {
      coreId = state.run.station.coreId
      core = coreModule(coreId)
    }

    const progress = levelProgress(state)
    const signature = `${coreId}|${progress.level}|${progress.fraction.toFixed(3)}`
    if (signature !== shown) {
      shown = signature
      root.style.setProperty('--xp', progress.fraction.toFixed(3))

      /*
       * Die Zahlen stehen im Hinweis und nicht im Feld.
       *
       * Auf der Flaeche haetten sie zwei Nachteile auf einmal: Sie stuenden auf einem
       * Untergrund, der sich staendig aendert, und sie machten aus einer Anzeige, die man
       * im Augenwinkel liest, eine, die man lesen muss. Wer den genauen Stand will, faehrt
       * darueber - dieselbe Regel wie beim liegenden Gold in der Ressourcenzeile.
       */
      const label = t('hud.level', { level: progress.level })
      const detail =
        progress.need > 0
          ? t('hud.xp', {
              into: formatNumber(Math.floor(progress.into)),
              need: formatNumber(progress.need),
            })
          : t('hud.xpMax')
      root.setAttribute('aria-label', `${label} - ${detail}`)
      describe(root, `<b>${label}</b><br>${detail}`)
    }

    draw(viewTime)
  }

  return {
    update,
    detach() {
      observer.disconnect()
      root.replaceChildren()
    },
  }
}
