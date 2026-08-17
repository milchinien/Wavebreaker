/**
 * Die Station auf dem Startbildschirm - **echte Module, echter Zeichner**.
 *
 * Sie ersetzt die Bildebene `04-station.svg`, und der Unterschied ist kein optischer,
 * sondern ein grundsaetzlicher: Dort waren fuenf von Hand gezeichnete Sechsecke, die
 * ungefaehr aussahen wie eine Station. Hier steht eine **gebaute** Station - `createStation`
 * setzt den Kern, `place` dockt echte Turmmodule aus `data/towers.ts` an echte freie
 * Kanten, und gezeichnet wird mit `drawModules` aus `render/station.ts`, also mit genau dem
 * Code, der auch im Spiel laeuft.
 *
 * Das ist die Bedingung, an der sich der Bildschirm messen lassen muss: Wer auf "Start"
 * drueckt, sieht danach dieselben Formen, dieselben Embleme, dieselben Fugen und dieselben
 * Raritaetsrahmen wieder. Ein Plakat, das etwas anderes zeigt als das Spiel dahinter, ist
 * eine Behauptung - und beim ersten Bild eine, die sofort auffliegt.
 *
 * Drei Entscheidungen praegen die Datei:
 *
 * **Der Anflug ist die Aussage.** Der Kern steht von Anfang an; die Tuerme kommen gut eine
 * Sekunde spaeter von aussen hereingeflogen und rasten ein. Das erzaehlt in drei Sekunden,
 * worum es in diesem Spiel geht - eine Station, die aus Modulen **waechst**. Ein fertiges
 * Bild erzaehlte gar nichts.
 *
 * **Das Einrasten gehoert dem Spiel, nicht mir.** Der Aufschlag, das Ueberschiessen und der
 * Ring, der ueber die Nachbarn hinauslaeuft, sind `placings` - dieselbe Mechanik wie beim
 * Bauen in der Basis (GDD 13 Abschnitt 10). Ich reiche nur das Alter herein.
 *
 * **Kein Zufall ohne Saat.** Die Flugbahnen und die Partikel kommen aus `core/rng.ts` mit
 * fester Saat: Der Startbildschirm sieht bei jedem Aufruf gleich aus. Ein Plakat, das
 * jedesmal anders aussieht, ist kein Plakat.
 */

import { createRng } from '../core/rng.ts'
import type { Vec2 } from '../core/vec.ts'
import { START_CORE_ID, START_TOWER_SLOTS } from '../data/balance.ts'
import { createCamera, fitTo, snapToTarget, step as stepCamera } from '../render/camera.ts'
import { drawModules } from '../render/station.ts'
import { PALETTE } from '../render/theme.ts'
import {
  CORE_UID,
  createStation,
  freeEdges,
  newModule,
  place,
  stationModules,
  type PlacedModule,
  type Station,
} from '../sim/station.ts'
import type { Placing } from '../sim/combat.ts'
import type { Rarity } from '../data/types.ts'

export type BootStation = {
  /** Die Leinwand. Der Aufrufer haengt sie dort ein, wo die Bildebene lag. */
  node: HTMLCanvasElement
  detach(): void
}

export type BootStationOptions = {
  /**
   * Steht die Oberflaeche still (E18, GDD 13 Abschnitt 3)?
   *
   * Wird **je Bild** gefragt und nicht einmal beim Aufbau: Der Schalter kann waehrend des
   * Startbildschirms umgelegt werden. Steht sie still, ist die Station sofort fertig
   * gebaut - kein Anflug, keine Partikel, aber dasselbe Bild.
   */
  still(): boolean
}

/**
 * Womit die Station bestueckt ist.
 *
 * Die drei Starttypen des Spiels (GDD 14 Abschnitt 3) und einer doppelt, damit der Kranz
 * geschlossen wirkt. Die Raritaeten steigen nach aussen an: Das Plakat zeigt damit
 * nebenbei die Rahmenfarben, an denen der Spieler spaeter Wert erkennt - und die
 * mythische pulsiert von selbst (`lookOf` in `render/station.ts`).
 */
const FLEET: readonly { defId: string; rarity: Rarity }[] = [
  { defId: 'autocannon', rarity: 'legendary' },
  { defId: 'cannon', rarity: 'epic' },
  { defId: 'amplifier', rarity: 'mythic' },
  { defId: 'autocannon', rarity: 'rare' },
]

/** Wann der erste Turm losfliegt und wie weit der naechste dahinter liegt, in Sekunden. */
const DOCK_DELAY = 1.2
const DOCK_STAGGER = 0.24

/** Wie lange ein Turm unterwegs ist. */
const DOCK_FLIGHT = 0.62

/**
 * Aus welcher Entfernung er kommt, als Vielfaches seines Abstands zum Kern.
 *
 * Weit genug, dass er zu Beginn ausserhalb des Bildes steht, und nah genug, dass die
 * Bewegung noch als Anflug lesbar ist statt als Einblendung von irgendwoher.
 */
const DOCK_FROM = 7

/** Wie lange das Einrasten nachwirkt - Ueberschiessen und Ring (`Placing.life`). */
const SETTLE_LIFE = 0.5

/** So viele Partikel treiben im Grund. */
const MOTES = 70

/**
 * Der Startbildschirm zeigt die Station ruhig, nicht im Kampf: Sie dreht sich langsam um
 * ihre Mitte. Ein Grad in gut sieben Sekunden - man sieht es nicht, man spuert es.
 */
const SPIN_RATE = 0.055

export function mountBootStation(options: BootStationOptions): BootStation {
  const node = document.createElement('canvas')
  node.className = 'boot-station'

  const context = node.getContext('2d')
  const station = buildStation()
  const modules = stationModules(station)
  const core = modules.find((module) => module.uid === CORE_UID)
  const towers = modules.filter((module) => module.uid !== CORE_UID)

  const camera = createCamera()
  const rng = createRng(0x57a71014)

  /**
   * Die treibenden Partikel (GDD 13 Abschnitt 10).
   *
   * Sie liegen in **Bruchteilen** der Flaeche und nicht in Pixeln: Der Startbildschirm
   * fuellt das Fenster, und ein Partikelfeld in festen Koordinaten waere auf einem breiten
   * Bild links geklumpt. `depth` ist ihre Tiefe - sie bestimmt Groesse, Helligkeit und
   * Tempo zugleich, damit ferne Partikel auch wie ferne aussehen.
   */
  const motes = Array.from({ length: MOTES }, () => ({
    x: rng.next(),
    y: rng.next(),
    depth: rng.range(0.25, 1),
    drift: rng.range(-0.012, 0.012),
    rise: rng.range(0.004, 0.03),
    phase: rng.range(0, Math.PI * 2),
    tone: rng.pick([PALETTE.cyan, PALETTE.edge, PALETTE.teal, PALETTE.violet]),
  }))

  let frame = 0
  /** Zeitstempel des ersten Bildes. Alles rechnet als Abstand dazu - siehe `draw`. */
  let origin = -1
  let width = 0
  let height = 0

  function resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    width = node.clientWidth
    height = node.clientHeight
    if (width < 1 || height < 1 || !context) return
    node.width = Math.round(width * ratio)
    node.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    /*
     * Der Ausschnitt wird bei jeder Groessenaenderung neu gefasst und **hart** gesetzt: Auf
     * dem Startbildschirm gibt es keine Kamerafahrt, in die er sich einpassen koennte.
     *
     * Gefasst wird auf die **ganze Leinwand** - und die endet dort, wo der Schriftzug
     * anfaengt. Das ist Absicht: Wo die Buehne aufhoert, steht im Stilblatt an genau einer
     * Stelle (`--boot-stage`), und Leinwand wie Schriftzug haengen beide daran. Wuerde ich
     * hier einen Anteil hineinrechnen, gaebe es zwei Zahlen fuer dieselbe Kante, und die
     * zweite waere irgendwann falsch.
     */
    fitTo(camera, modules.map((module) => module.poly), width, height, 40)
    snapToTarget(camera)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(node)

  /**
   * Ein Bild.
   *
   * `now` ist der Zeitstempel des Browsers in Millisekunden. Er kommt aus `requestAnimation-
   * Frame` und nicht aus einer Uhr - das ist kein Zufall, sondern die Regel des Hauses:
   * Zeit wird nicht erfragt (siehe `selftest/guards.ts`), sie wird gereicht.
   */
  function draw(now: number): void {
    frame = window.requestAnimationFrame(draw)
    if (!context) return

    /*
     * Die Groesse wird **hier** nachgezogen und nicht nur beim Beobachter.
     *
     * Das ist aus einem echten Fehler entstanden: Der Aufrufer haengt die Leinwand erst
     * ein, nachdem er sie bekommen hat - beim Aufbau steht sie also noch ausserhalb des
     * Baums und hat keine Groesse. Ein `resize()` von dort traf eine Leinwand von 0 Pixeln,
     * und ohne diese Zeile blieb sie auf ihrem Standardmass von 300 x 150 stehen und malte
     * das Bild grob vergroessert.
     *
     * Der Beobachter allein reicht nicht: Er meldet sich erst zum naechsten Bildaufbau, und
     * bis dahin waere mindestens ein Bild falsch. Der Vergleich kostet nichts.
     */
    if (node.clientWidth !== width || node.clientHeight !== height) resize()
    if (width < 1 || height < 1) return

    if (origin < 0) origin = now
    const still = options.still()
    // Steht die Bewegung, ist die Station vom ersten Bild an fertig - der Anflug faellt weg,
    // nicht sein Ergebnis.
    const time = still ? 99 : (now - origin) / 1000

    stepCamera(camera, 1 / 60)
    context.clearRect(0, 0, width, height)

    drawBackdrop(context, width, height, time, still)
    if (!still) drawMotes(context, motes, width, height, time)

    // Der Kern steht von Anfang an. Er ist das, woran angedockt wird - er kann nicht selbst
    // angeflogen kommen.
    const shown: PlacedModule[] = core ? [core] : []
    const placings = new Map<string, Placing>()
    const flying: { module: PlacedModule; offset: Vec2 }[] = []

    towers.forEach((module, index) => {
      const start = DOCK_DELAY + index * DOCK_STAGGER
      const done = (time - start) / DOCK_FLIGHT

      if (done <= 0) return
      if (done < 1) {
        flying.push({ module, offset: approachOffset(module, 1 - done) })
        return
      }

      shown.push(module)
      const age = time - (start + DOCK_FLIGHT)
      if (age < SETTLE_LIFE) placings.set(module.uid, { age, life: SETTLE_LIFE })
    })

    const spin = still ? 0 : time * SPIN_RATE

    context.save()
    context.translate(width / 2, height / 2)
    context.rotate(spin)
    context.translate(-width / 2, -height / 2)

    drawModules(context, shown, camera, width, height, time, { placings })

    // Die Anfliegenden einzeln und versetzt. Sie gehoeren noch nicht zur Station, also
    // duerfen sie auch nicht mit ihr zusammen gezeichnet werden - ihre Fugen entstehen
    // erst beim Andocken.
    for (const { module, offset } of flying) {
      context.save()
      context.translate(offset.x, offset.y)
      drawModules(context, [module], camera, width, height, time)
      context.restore()
    }

    context.restore()
  }

  frame = window.requestAnimationFrame(draw)

  return {
    node,
    detach() {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      node.remove()
    },
  }
}

/**
 * Die Station bauen.
 *
 * Ueber `place` und nicht ueber gesetzte Koordinaten: Damit gelten dieselben Regeln wie im
 * Spiel - ein Modul sitzt an einer echten freien Kante oder gar nicht. Wenn hier je etwas
 * schieflaeuft, dann weil die Bauregeln sich geaendert haben, und dann soll es hier
 * auffallen und nicht erst beim Spieler.
 *
 * Die Kanten werden **gemischt gewaehlt**, aber mit fester Saat: So sitzt der Kranz nicht
 * stur im Uhrzeigersinn, sieht aber bei jedem Start gleich aus.
 */
function buildStation(): Station {
  const station = createStation(START_CORE_ID, Math.max(START_TOWER_SLOTS, FLEET.length))
  const rng = createRng(0x5741e2b0)

  for (const entry of FLEET) {
    const module = newModule(station, entry.defId, entry.rarity)
    station.inventory.push(module)

    // Nur die Kanten des Kerns: Ein Kranz um die Mitte liest sich als Station, eine Kette
    // nach aussen als Wurm. Reicht das nicht, darf jede freie Kante herhalten.
    const edges = freeEdges(station)
    const atCore = edges.filter((edge) => edge.ownerUid === CORE_UID)
    for (const edge of rng.shuffle([...(atCore.length > 0 ? atCore : edges)])) {
      if (place(station, module.uid, edge) === null) break
    }
  }

  return station
}

/**
 * Wie weit ein Modul in diesem Bild noch von seinem Platz entfernt ist, in Bildschirmpixeln.
 *
 * Es kommt **radial** herein - auf der Linie vom Kern durch seinen spaeteren Platz nach
 * aussen. Jede andere Bahn saehe aus, als suche es seinen Platz; diese sieht aus, als
 * kenne es ihn.
 *
 * `left` ist der Rest des Weges (1 am Start, 0 im Ziel) und wird **kubisch** gewichtet: Der
 * Turm ist die erste Haelfte der Zeit noch weit draussen und schiesst dann heran. Linear
 * gewichtet schwebte er gleichmaessig herein wie ein Fahrstuhl.
 */
function approachOffset(module: PlacedModule, left: number): Vec2 {
  const eased = left * left * left
  return {
    x: module.center.x * DOCK_FROM * eased,
    y: module.center.y * DOCK_FROM * eased,
  }
}

/**
 * Der Grund, auf dem die Station steht.
 *
 * Zwei Scheine uebereinander: ein weiter, kalter, der die ganze Flaeche traegt, und ein
 * enger im Herzen der Station, der **atmet**. Der Verlauf laeuft nach aussen ins Nichts,
 * nicht in eine Farbe - eine Kante am Rand des Scheins liesse ihn als Scheibe lesen.
 *
 * Er ist dunkel gehalten, und das ist Absicht: Das Leuchten dieses Spiels entsteht aus dem
 * Kontrast zu fast schwarzem Marineblau. Ein heller Grund nimmt jeder Kante ihr Licht.
 */
function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  still: boolean,
): void {
  const cx = width / 2
  const cy = height / 2
  const breath = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.7)

  const wide = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.62)
  wide.addColorStop(0, withAlpha(PALETTE.cyan, 0.13))
  wide.addColorStop(0.45, withAlpha(PALETTE.violet, 0.06))
  wide.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = wide
  ctx.fillRect(0, 0, width, height)

  const near = Math.min(width, height) * (0.2 + 0.02 * breath)
  const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, near)
  heart.addColorStop(0, withAlpha(PALETTE.edge, 0.2 + 0.07 * breath))
  heart.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = heart
  ctx.fillRect(0, 0, width, height)
}

type Mote = {
  x: number
  y: number
  depth: number
  drift: number
  rise: number
  phase: number
  tone: string
}

/**
 * Die treibenden Partikel.
 *
 * Sie steigen langsam und schwanken dabei seitlich - Staub in einem Luftzug, nicht Schnee.
 * Wer oben herauslaeuft, kommt unten wieder herein (`wrap`); dadurch braucht das Feld
 * weder Nachschub noch Aufraeumen und bleibt ueber jede Laufzeit gleich dicht.
 *
 * Gezeichnet wird jeder als kleiner Schein und nicht als Punkt: Ein harter Punkt auf
 * dunklem Grund liest sich als toter Pixel, ein weicher als Licht.
 */
function drawMotes(
  ctx: CanvasRenderingContext2D,
  motes: readonly Mote[],
  width: number,
  height: number,
  time: number,
): void {
  ctx.save()
  for (const mote of motes) {
    const y = wrap(mote.y - time * mote.rise * mote.depth)
    const x = wrap(mote.x + Math.sin(time * 0.35 + mote.phase) * 0.02 + time * mote.drift * 0.1)

    const px = x * width
    const py = y * height
    const radius = 0.7 + mote.depth * 2.1
    // Fern heisst schwach: Die Tiefe bestimmt Groesse und Helligkeit zugleich, sonst
    // draengten sich kleine helle und grosse blasse Partikel in derselben Ebene.
    const alpha = 0.1 + mote.depth * 0.4

    const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 3.4)
    glow.addColorStop(0, withAlpha(mote.tone, alpha))
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(px, py, radius * 3.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Auf [0, 1) zurueckholen - auch fuer negative Werte, die `%` allein falsch beantwortet. */
function wrap(value: number): number {
  return ((value % 1) + 1) % 1
}

/**
 * Eine Farbe der Palette mit Deckkraft versehen.
 *
 * Die Palette liegt als `#rrggbb` vor, und `globalAlpha` waere hier das falsche Werkzeug:
 * Es traefe auch die Verlaufsstopps, die schon durchsichtig sind, und multiplizierte sich
 * mit ihnen.
 */
function withAlpha(color: string, alpha: number): string {
  const red = parseInt(color.slice(1, 3), 16)
  const green = parseInt(color.slice(3, 5), 16)
  const blue = parseInt(color.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
