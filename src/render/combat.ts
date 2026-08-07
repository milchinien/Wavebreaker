/**
 * Gegner, Geschosse und Treffer.
 *
 * Der Spieler soll **ohne Text** erkennen, was auf ihn zukommt (GDD 07 Abschnitt 3):
 * Form, Farbe und Groesse zeigen die Rolle. Ein Lebensbalken erscheint nur bei Gegnern,
 * die ihn brauchen - bei jedem Gegner waere er Rauschen.
 */

import { formatNumber } from '../core/format.ts'
import { t } from '../data/strings.ts'
import { dist, type Vec2 } from '../core/vec.ts'
import { enemyById, type EnemyShape } from '../data/enemies.ts'
import { podById } from '../data/events.ts'
import { TRADER_STAY_SECONDS } from '../data/balance.ts'
import type { Helper, Pod, Trader } from '../app/state.ts'
import type { Beam, Burst, Gain, Hit, Muzzle, Pickup, Shard } from '../sim/combat.ts'
import type { Drone } from '../sim/drones.ts'
import { meanCoinValue, type Coin } from '../sim/economy.ts'
import type { Enemy } from '../sim/enemies.ts'
import type { Projectile } from '../sim/projectiles.ts'
import type { RangeCircle } from '../sim/towers.ts'
import { viewZoom, worldToScreen, type Camera } from './camera.ts'
import { drawFrame, SPRITES } from './sprites.ts'
import { PALETTE, RARITY_COLOR, RGB, THEME } from './theme.ts'

/** Ab dieser Lebensmenge lohnt ein Balken - darunter stirbt der Gegner ohnehin sofort. */
const HP_BAR_FROM_MAX_HP = 60

/** Abstand des Muendungsfeuers von der Modulmitte, in Welteinheiten. */
const MUZZLE_OFFSET = 13
const MUZZLE_LENGTH = 16

/**
 * Wie viel Flugzeit der Schweif eines Geschosses zeigt.
 *
 * In Sekunden, nicht in Einheiten: Ein langsames Geschoss zieht dadurch einen kurzen
 * Schweif, ein schnelles einen langen - die Laenge sagt etwas ueber das Tempo.
 */
const TRAIL_SECONDS = 0.05

/** Abstand der Randmarke vom Bildrand, ihre Groesse und ihr Deckel, in Bildschirmpixeln. */
const APPROACH_INSET = 13
const APPROACH_SIZE = 9
/** Ab dieser Entfernung ausserhalb des Bildes ist die Marke verschwunden. */
const APPROACH_FADE = 210
/** Mehr Marken als das braucht niemand - der Rand soll kein Zeichenkranz werden. */
const APPROACH_MAX = 24

/** Wie weit die eingesammelte Zahl aufsteigt, in Welteinheiten. */
const GAIN_RISE = 26

/** Deckkraft des liegenden Goldes ausserhalb der Kampfansicht. */
const COIN_DIM_IDLE = 0.45

/**
 * Groesse einer Muenze in Welteinheiten: Grundwert plus Zuschlag nach ihrem Anteil.
 *
 * Der Grundwert haelt auch den kleinsten Krumen sichtbar, die Spanne haelt den groessten
 * Stapel klein genug, dass er die Station nicht zudeckt (GDD 13 Abschnitt 10).
 */
const COIN_RADIUS_BASE = 6
const COIN_RADIUS_SPAN = 9

/**
 * Ab dem Wievielfachen des Durchschnitts eine Muenze ihre volle Groesse erreicht.
 *
 * Rund zehnfach (die Wurzel aus 10 ist 3,2): Ein Stapel, der zehnmal so schwer ist wie der
 * Durchschnitt, ist der dickste Brocken auf dem Feld - darueber muss nichts mehr wachsen.
 */
const COIN_SIZE_SPREAD = 3.2

/**
 * Wertstufen der Muenzbilder: Reihe 0 bronze, 1 silber, 2 gold (`docs/anlagen.md`).
 *
 * Die Schwellen sind Vielfache des Durchschnitts, nicht feste Betraege - dieselbe Regel wie
 * bei der Groesse. Was in Welle 3 ein Vermoegen ist, ist in Welle 300 Staub; ein fester
 * Grenzwert faerbte spaeter jede Muenze gold und saegte die Aussage wieder ab.
 */
const COIN_TIER_SILVER = 0.8
const COIN_TIER_GOLD = 2.2

/**
 * Die Landung einer eingesammelten Muenze auf dem Zeiger.
 *
 * `PICKUP_LANDING` ist die Strecke, auf der sie schrumpft und verblasst - gemessen in ihren
 * eigenen Radien, damit ein Krumen und ein Stapel gleich weit vor dem Zeiger anfangen zu
 * verschwinden. `PICKUP_MIN_SCALE` ist, was am Zeiger uebrig bleibt: nicht null, sonst
 * verschwindet die Muenze in einem Punkt, statt in der Anzeige anzukommen.
 *
 * `PICKUP_POP` ist der Stupser im Augenblick des Aufhebens, `PICKUP_POP_SHARE` sein Anteil
 * an der Flugzeit.
 */
const PICKUP_LANDING = 2.6
const PICKUP_MIN_SCALE = 0.45
const PICKUP_POP = 0.22
const PICKUP_POP_SHARE = 0.3

/**
 * Der Glanzlauf einer Muenze: `GLINT_PERIOD` Sekunden Ruhe, dann ein kurzer Lauf ueber alle
 * Bilder. Der Versatz kommt aus dem Ort der Muenze - dieselbe Muenze glaenzt immer gleich,
 * zwei nebeneinander aber nie im Takt. Ein Feld voller Gold soll leben, nicht blinken.
 */
const GLINT_PERIOD = 3.4
const GLINT_FPS = 14

/**
 * Der Wirkungsbereich um die Station.
 *
 * Er atmet langsam - sichtbar genug, dass man ihn als Anzeige liest, ruhig genug, dass er
 * nicht mit den Gegnern um Aufmerksamkeit streitet.
 */
const RANGE_RING_BREATH = 0.9
const RANGE_RING_ALPHA = 0.3
const RANGE_RING_FILL = 0.05
/**
 * Wie viele Strahlen den Umriss abtasten. 180 heisst: alle zwei Grad ein Punkt - fein genug,
 * dass zusammen mit der Kurvenglaettung keine Kante zu sehen ist, und grob genug, dass es
 * in jedem Bild bezahlbar bleibt.
 */
const RANGE_RING_RAYS = 180
/**
 * Wie breit die Ecken zwischen zwei Reichweitenkreisen verrundet werden - als Anteil des
 * **Vollkreises**, nicht als Abstand. Eine Ecke ist ein Winkelknick; wie weit sie im Bild
 * ausladet, haengt vom Zoom ab, ihre Breite in Grad nicht.
 *
 * 0,04 sind rund 15 Grad zu jeder Seite. Genug, dass keine Spitze stehen bleibt, und wenig
 * genug, dass eine Beule ihre Hoehe behaelt - geglaettet wird auch das Maximum.
 */
const RANGE_RING_ROUNDING = 0.04

/**
 * Die Kapsel: Groesse in Welteinheiten, dazu Weite und Tempo ihres Schwebens.
 *
 * Deutlich groesser als die groesste Muenze - sie ist ein Gegenstand und kein Krumen, und
 * der Spieler soll sie ueber das halbe Feld hinweg sehen.
 */
const POD_RADIUS = 13
const POD_BOB = 3.5
const POD_BOB_SPEED = 2.2

/** Groesse eines Goldsammlers in Welteinheiten. */
const HELPER_SIZE = 6

/**
 * Groesse der Haendler-Drohne in Welteinheiten.
 *
 * Deutlich groesser als eine Kapsel: Sie ist die seltenste Gelegenheit im Feld und muss
 * ueber die ganze Arena hinweg auffallen, auch wenn gerade fuenfzig Gegner anlaufen.
 */
const TRADER_RADIUS = 17

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: readonly Enemy[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  // Runde Ecken: Die breite Schein-Linie stellt sonst an jeder Spitze einen Zacken auf,
  // der laenger ist als der halbe Gegner.
  ctx.lineJoin = 'round'
  for (const enemy of enemies) {
    const def = enemyById(enemy.defId)
    const center = worldToScreen(camera, enemy.pos, width, height)
    const radius = enemy.radius * viewZoom(camera)

    // Der Biss: ein Stoss zum Modul hin und zurueck. Ein Sinusbogen geht weich hin und
    // weich zurueck - der Gegner beisst, er springt nicht.
    if (enemy.biteLife > 0) {
      const lunge =
        Math.min(6, enemy.radius * 0.35) *
        Math.sin(Math.PI * Math.min(1, enemy.bite / enemy.biteLife)) *
        viewZoom(camera)
      center.x += enemy.biteDir.x * lunge
      center.y += enemy.biteDir.y * lunge
    }

    // Ausserhalb des Bildes gar nicht erst zeichnen.
    if (center.x < -radius || center.y < -radius || center.x > width + radius || center.y > height + radius) {
      continue
    }

    /*
     * Eine getarnte Einheit wird durchscheinend statt unsichtbar (GDD 07 Abschnitt 5).
     *
     * Ganz zu verschwinden waere regelgetreu, aber unspielbar: Der Spieler saehe einen
     * Gegner, der aus dem Nichts an seiner Station steht, und haette keine Erklaerung.
     * Ein Schemen sagt "der ist da, aber deine Tuerme sehen ihn nicht" - und genau das
     * ist die Aussage.
     */
    const hidden = enemy.cloak < 0
    const alpha = hidden ? 0.28 : 1

    /*
     * Gegner sind leuchtende Umrisse, keine gefuellten Klumpen: Die Fuellung deutet den
     * Koerper nur an, die Aussage traegt die Kante. So bleiben auch dichte Wellen lesbar,
     * und der Blick faellt weiter auf die helle Station statt auf den Gegnerteppich.
     *
     * Die Kante wird deshalb **zweimal** gezogen: einmal breit und blass als Schein, einmal
     * schmal und voll als Linie. Das ist der Unterschied zwischen einem Koerper, der von
     * innen glimmt, und einer Roehre, die brennt - und nur die Roehre ist Neon. Vorher trug
     * die Fuellung ein Siebtel Deckkraft und die Kante einen einzigen Strich; ein Pulk sah
     * dadurch aus wie ein Feld heller Flecken, in dem die Formen untergingen.
     */
    tracePolygon(ctx, def.shape, center, radius, enemy.dockedTo !== null, enemy.spin)
    ctx.fillStyle = def.color
    ctx.globalAlpha = 0.06 * alpha
    ctx.fill()

    const elite = enemy.elite.length > 0
    ctx.strokeStyle = def.color
    ctx.shadowColor = def.color

    // Der Schein. Er sitzt unter der Linie, damit die Kante scharf bleibt.
    ctx.globalAlpha = (elite ? 0.4 : 0.28) * alpha
    ctx.lineWidth = elite ? 6 : 4.5
    // Ein Elite traegt einen zusaetzlichen Neon-Effekt und bleibt sonst er selbst -
    // "verstaerkter Tank", nicht neuer Gegnertyp (GDD 07 Abschnitt 6).
    ctx.shadowBlur = elite ? 22 : enemy.dockedTo !== null ? 16 : 11
    ctx.stroke()

    // Die Linie.
    ctx.globalAlpha = alpha
    ctx.lineWidth = elite ? 2.4 : 1.6
    ctx.shadowBlur = elite ? 10 : 6
    ctx.stroke()
    ctx.shadowBlur = 0

    // Ein Schild liegt als zweiter Ring aussen herum - man soll sehen, warum die Treffer
    // wenig bewirken, statt es an der Lebensleiste zu erraten.
    if (enemy.shield > 0) {
      ctx.globalAlpha = 0.4 * alpha
      ctx.strokeStyle = PALETTE.cyan
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 1.35, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Brennt er, glimmt er von innen.
    if (enemy.burnLeft > 0) {
      ctx.globalAlpha = 0.35 * alpha
      ctx.fillStyle = PALETTE.gold
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ist er verlangsamt, legt sich ein kalter Schleier darueber.
    if (enemy.chillLeft > 0) {
      ctx.globalAlpha = 0.3 * alpha
      ctx.fillStyle = PALETTE.edge
      tracePolygon(ctx, def.shape, center, radius, enemy.dockedTo !== null, enemy.spin)
      ctx.fill()
    }

    ctx.globalAlpha = alpha
    if (enemy.maxHp >= HP_BAR_FROM_MAX_HP) {
      drawHpBar(ctx, center, radius, enemy.hp / enemy.maxHp, def.color, viewZoom(camera))
    }
  }
  ctx.restore()
}

/**
 * Laserstrahlen (GDD 05: Laser-Turm).
 *
 * Ein heller Kern in einem breiteren Schein - so liest sich eine Linie als Energie und
 * nicht als gezogener Strich. Sie leben einen Wimpernschlag; bei sechs Schuessen je Sekunde
 * ergibt das den Dauerstrahl, den das GDD beschreibt.
 */
export function drawBeams(
  ctx: CanvasRenderingContext2D,
  beams: readonly Beam[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'

  for (const beam of beams) {
    if (!beam.active) continue

    const fade = Math.max(0, 1 - beam.age / beam.life)
    const from = worldToScreen(camera, beam.from, width, height)
    const to = worldToScreen(camera, beam.to, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))

    ctx.strokeStyle = beam.color
    ctx.shadowColor = beam.color

    ctx.globalAlpha = 0.35 * fade
    ctx.shadowBlur = 12
    ctx.lineWidth = 6 * zoom
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()

    ctx.globalAlpha = fade
    ctx.shadowBlur = 6
    ctx.lineWidth = 2 * zoom
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Kampfdrohnen (GDD 05: Drohnen-Modul).
 *
 * Kleine leuchtende Rauten auf ihrer Kreisbahn. Bewusst schlicht: Sie sind zu dritt bis zu
 * sechst gleichzeitig unterwegs, und alles Aufwendigere waere in dieser Groesse Rauschen.
 */
export function drawDrones(
  ctx: CanvasRenderingContext2D,
  drones: readonly Drone[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (drones.length === 0) return
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  for (const drone of drones) {
    const center = worldToScreen(camera, drone.pos, width, height)
    // Ein leichtes Pulsen aus der eigenen Bahnlage - so blinken nicht alle im Takt.
    const pulse = 0.75 + 0.25 * Math.sin(time * 5 + drone.angle * 3)
    const size = 4.2 * zoom

    ctx.globalAlpha = pulse
    ctx.fillStyle = drone.color
    ctx.shadowColor = drone.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(center.x, center.y - size)
    ctx.lineTo(center.x + size, center.y)
    ctx.lineTo(center.x, center.y + size)
    ctx.lineTo(center.x - size, center.y)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Versorgungskapseln im Feld (GDD 11 Abschnitt 8).
 *
 * Sie sollen sich vom Gold **auf den ersten Blick** unterscheiden: Gold ist rund und liegt,
 * eine Kapsel ist kantig und schwebt. Deshalb ein Sechseck statt einer Scheibe, ein
 * langsames Auf und Ab statt einer festen Lage, und ein Ring darum, den es beim Gold nicht
 * gibt.
 *
 * Die Farbe kommt aus der Seltenheit der Kapsel - dieselbe Sprache wie bei Tuermen und
 * Perks (GDD 13 Abschnitt 7). Ein blaues Leuchten ist die normale Kapsel, ein goldenes die
 * seltene, ein magentafarbenes der Gluecksfall.
 */
export function drawPods(
  ctx: CanvasRenderingContext2D,
  pods: readonly Pod[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
  active = true,
): void {
  if (pods.length === 0) return

  const zoom = Math.max(0.6, viewZoom(camera))
  const dim = active ? 1 : COIN_DIM_IDLE

  ctx.save()
  ctx.lineJoin = 'round'

  for (const pod of pods) {
    const color = RARITY_COLOR[podById(pod.defId).rarity]
    const center = worldToScreen(camera, { x: pod.x, y: pod.y }, width, height)
    const size = POD_RADIUS * zoom

    if (
      center.x < -size * 2 ||
      center.y < -size * 2 ||
      center.x > width + size * 2 ||
      center.y > height + size * 2
    ) {
      continue
    }

    // Der Versatz kommt aus dem Ort, nicht aus einem Zufall: Dieselbe Kapsel schwebt immer
    // gleich, zwei nebeneinander aber nie im Takt - genau wie beim Glanz der Muenzen.
    const phase = time * POD_BOB_SPEED + pod.x * 0.02 + pod.y * 0.02
    const y = center.y + Math.sin(phase) * POD_BOB * zoom
    const pulse = 0.72 + 0.28 * Math.sin(phase * 1.7)

    ctx.globalAlpha = dim
    ctx.shadowColor = color
    ctx.shadowBlur = 16 * pulse

    // Der Koerper: ein stehendes Sechseck.
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
      const px = center.x + Math.cos(angle) * size
      const py = y + Math.sin(angle) * size
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = PALETTE.panelDeep
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    // Der Kern - er traegt die Farbe voll, der Rahmen nur als Kante.
    ctx.globalAlpha = dim * pulse
    ctx.beginPath()
    ctx.arc(center.x, y, size * 0.36, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Der Ring darunter sagt "hier liegt etwas" - er atmet mit und macht die Kapsel auch
    // dann sichtbar, wenn Gegner darueber laufen.
    ctx.globalAlpha = dim * 0.3 * pulse
    ctx.beginPath()
    ctx.arc(center.x, center.y + size * 0.9, size * (1.1 + 0.25 * pulse), 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Die Haendler-Drohne (GDD 11 Abschnitt 7).
 *
 * Sie muss **drei Dinge auf einen Blick** sagen, und jedes hat seine eigene Form:
 *
 *   *hier ist etwas zu holen*      ein deutlich groesserer Koerper als bei einer Kapsel,
 *                                  in Gold - der Farbe des Handels
 *   *es eilt*                      ein Ring, der sich leert. Eine Zahl waere genauer und
 *                                  schlechter: Man liest sie, statt sie zu sehen
 *   *du hast sie erreicht*         der Ring wird voll und ruhig, das Blinken hoert auf
 *
 * Ohne den leerlaufenden Ring waere die Drohne ein Gegenstand, der irgendwann verschwindet -
 * und ein Verschwinden ohne Ankuendigung liest sich als Fehler, nicht als Frist.
 */
export function drawTrader(
  ctx: CanvasRenderingContext2D,
  trader: Trader | null,
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (!trader) return

  const zoom = Math.max(0.6, viewZoom(camera))
  const center = worldToScreen(camera, { x: trader.x, y: trader.y }, width, height)
  const size = TRADER_RADIUS * zoom

  // Eine erreichte Drohne wartet - also hoert sie auch auf zu draengen.
  const share = trader.visited ? 1 : Math.max(0, Math.min(1, trader.left / TRADER_STAY_SECONDS))
  // Je knapper die Zeit, desto schneller das Pochen. Unter einem Viertel wird es dringlich.
  const urgency = trader.visited ? 1.4 : 1.4 + (1 - share) * 7
  const pulse = 0.7 + 0.3 * Math.sin(time * urgency)

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Der Fristring. Er laeuft von oben aus im Uhrzeigersinn ab, wie jede Uhr.
  ctx.globalAlpha = 0.85
  ctx.strokeStyle = PALETTE.gold
  ctx.lineWidth = 3
  ctx.shadowColor = PALETTE.gold
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(center.x, center.y, size * 1.7, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2)
  ctx.stroke()

  // Der Koerper: eine liegende Raute mit Ladeflaeche - deutlich anders als das Sechseck
  // der Kapsel und der Ring des Goldsammlers.
  const bob = Math.sin(time * 1.8) * 2.5 * zoom
  const y = center.y + bob

  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(center.x, y - size)
  ctx.lineTo(center.x + size * 1.35, y)
  ctx.lineTo(center.x, y + size)
  ctx.lineTo(center.x - size * 1.35, y)
  ctx.closePath()
  ctx.fillStyle = PALETTE.panelDeep
  ctx.fill()
  ctx.lineWidth = 2
  ctx.stroke()

  // Die Ladung im Inneren - sie pulst, solange die Drohne wartet.
  ctx.globalAlpha = pulse
  ctx.fillStyle = PALETTE.gold
  ctx.beginPath()
  ctx.arc(center.x, y, size * 0.34, 0, Math.PI * 2)
  ctx.fill()

  // Zwei Triebwerke unter der Raute: Sie machen aus einem Zeichen ein Fahrzeug.
  ctx.globalAlpha = 0.45 * pulse
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(center.x + side * size * 0.8, y + size * 0.72, size * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Goldsammler (GDD 12 Abschnitt 14: "kleine schwebende Drohnen mit Neonbeleuchtung").
 *
 * Sie tragen die Goldfarbe und nicht die Leitfarbe der Station: Was ein Helfer tut, ist
 * Gold aufheben, und der Spieler soll ohne Text erkennen, wofuer die Drohne da ist. Die
 * Form ist bewusst ein anderes Zeichen als bei den Kampfdrohnen - ein Ring statt einer
 * Raute -, damit man beide nicht verwechselt.
 */
export function drawHelpers(
  ctx: CanvasRenderingContext2D,
  helpers: readonly Helper[],
  radius: number,
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (helpers.length === 0) return

  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  for (const [index, helper] of helpers.entries()) {
    const center = worldToScreen(camera, { x: helper.x, y: helper.y }, width, height)
    const pulse = 0.7 + 0.3 * Math.sin(time * 3 + index * 2)
    const size = HELPER_SIZE * zoom

    // Der Sammelradius als sehr blasse Scheibe - er erklaert, warum Muenzen verschwinden,
    // ohne mit dem Angriffskreis der Station um Aufmerksamkeit zu streiten.
    ctx.globalAlpha = 0.1 * pulse
    ctx.fillStyle = PALETTE.gold
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius * zoom, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.strokeStyle = PALETTE.gold
    ctx.shadowColor = PALETTE.gold
    ctx.shadowBlur = 10
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.arc(center.x, center.y, size, 0, Math.PI * 2)
    ctx.stroke()

    // Ein kurzer Strich in Fahrtrichtung: Er sagt, wohin der Helfer gerade unterwegs ist.
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(center.x + Math.cos(helper.angle) * size * 1.9, center.y + Math.sin(helper.angle) * size * 1.9)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Marken am Bildrand fuer Gegner, die noch ausserhalb laufen.
 *
 * Der Erscheinungsring liegt immer ausserhalb des Bildausschnitts - nachgemessen liegt er
 * bei 476 bis 555 Einheiten, sichtbar sind je nach Fenster 138 bis 436. Gegner erscheinen
 * also grundsaetzlich ungesehen und tauchen unvermittelt am Rand auf. Die Marke schliesst
 * diese Luecke: Sie zeigt die Richtung, aus der etwas kommt, in der Farbe dessen, was
 * kommt (GDD 07 Abschnitt 3).
 *
 * Dezent bleibt sie durch die Entfernung: Je weiter ein Gegner draussen ist, desto blasser
 * und kleiner steht seine Marke. Wer eben erscheint, ist kaum zu sehen; wer gleich eintritt,
 * ist deutlich. Damit wird aus zwanzig Gegnern am Ring kein Kranz aus Zeichen.
 */
export function drawApproach(
  ctx: CanvasRenderingContext2D,
  enemies: readonly Enemy[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const centerX = width / 2
  const centerY = height / 2
  let drawn = 0

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const enemy of enemies) {
    if (drawn >= APPROACH_MAX) break

    const point = worldToScreen(camera, enemy.pos, width, height)
    const radius = enemy.radius * viewZoom(camera)
    const inside =
      point.x >= -radius && point.y >= -radius && point.x <= width + radius && point.y <= height + radius
    if (inside) continue

    const x = Math.min(width - APPROACH_INSET, Math.max(APPROACH_INSET, point.x))
    const y = Math.min(height - APPROACH_INSET, Math.max(APPROACH_INSET, point.y))
    const fade = 1 - Math.min(1, Math.hypot(point.x - x, point.y - y) / APPROACH_FADE)
    if (fade <= 0.02) continue

    // Der Gegner laeuft auf die Station zu, also zeigt die Marke ins Bild hinein.
    const dx = centerX - x
    const dy = centerY - y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const size = APPROACH_SIZE * (0.6 + 0.4 * fade)

    const color = enemyById(enemy.defId).color
    ctx.globalAlpha = 0.25 + 0.55 * fade
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 6 * fade
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - ux * size * 0.4 - uy * size * 0.7, y - uy * size * 0.4 + ux * size * 0.7)
    ctx.lineTo(x + ux * size * 0.6, y + uy * size * 0.6)
    ctx.lineTo(x - ux * size * 0.4 + uy * size * 0.7, y - uy * size * 0.4 - ux * size * 0.7)
    ctx.stroke()

    drawn += 1
  }

  ctx.restore()
}

/**
 * Mittig gesetzte Zahl auf ganzen Pixeln.
 *
 * Eine Pixelschrift verwischt, sobald sie auf gebrochenen Koordinaten sitzt - und die
 * kommen aus jeder Weltumrechnung. Gerundet wird die **linke Kante**, nicht der Mittelpunkt:
 * Bei mittiger Ausrichtung landet eine ungerade Textbreite sonst wieder auf einem halben
 * Pixel.
 *
 * `measureText` ist hier bezahlbar, weil nur wenige Zahlen gleichzeitig stehen - beschriftet
 * wird ein Zwoelftel der Muenzen, und Beträge gibt es hoechstens zwoelf. Gemessen kostet
 * ein Aufruf rund zwei Mikrosekunden.
 */
function writePixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
): void {
  const width = ctx.measureText(text).width
  ctx.fillText(text, Math.round(centerX - width / 2), Math.round(centerY))
}

/**
 * Der Umriss eines Gegners.
 *
 * `spin` ist sein Wanken aus den Beruehrungen mit Nachbarn (`sim/enemies.ts`). Es kommt
 * **auf** die feste Lage der Form obendrauf und ist dort auf rund 20 Grad begrenzt: Die Form
 * nennt die Gegnerart (GDD 07 Abschnitt 3), und ein Quadrat, das sich frei drehen duerfte,
 * waere bei 45 Grad eine Raute - also eine andere Art.
 */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  center: Vec2,
  radius: number,
  docked: boolean,
  spin = 0,
): void {
  const sides = sidesOfShape(shape)
  // Angedockte Gegner stehen still - eine leichte Drehung macht sie trotzdem lesbar.
  // Die Raute ist ein gedrehtes Quadrat - daher der feste Versatz.
  const rotation = (docked ? Math.PI / sides : 0) + (shape === 'diamond' ? Math.PI / 4 : 0) + spin

  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides - Math.PI / 2
    const point = { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
    if (i === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  }
  ctx.closePath()
}

/** Kantenzahl einer Gegnerform. Die Raute ist ein Quadrat, nur gedreht. */
function sidesOfShape(shape: EnemyShape): number {
  switch (shape) {
    case 'triangle':
      return 3
    case 'square':
    case 'diamond':
      return 4
    case 'pentagon':
      return 5
    case 'hexagon':
      return 6
  }
}

/**
 * Lebensbalken eines Gegners.
 *
 * Er spricht dieselbe Sprache wie alles andere auf dem Feld: runde Enden, ein dunkles
 * Bett, ein leuchtender Faden darin. Die Fuellung traegt **seine** Farbe, nicht eine
 * eigene - so gehoert der Balken sichtbar zu ihm und nicht zur Oberflaeche.
 *
 * Gezeichnet als zwei Striche statt zweier Rechtecke: Das gibt die runden Enden ohne
 * eigenen Pfad und passt zu den Leisten im HUD.
 */
function drawHpBar(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  fraction: number,
  color: string,
  zoom: number,
): void {
  const barWidth = Math.max(16, radius * 2.2)
  const thickness = Math.max(3, 4 * zoom)
  const left = center.x - barWidth / 2
  const right = center.x + barWidth / 2
  const y = center.y - radius - thickness * 2
  const filled = Math.max(0, Math.min(1, fraction))

  ctx.save()
  ctx.lineCap = 'round'
  ctx.globalAlpha = 1

  ctx.strokeStyle = PALETTE.inkDeep
  ctx.lineWidth = thickness
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(right, y)
  ctx.stroke()

  if (filled > 0) {
    ctx.strokeStyle = color
    ctx.lineWidth = thickness * 0.62
    ctx.shadowColor = color
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(left + barWidth * filled, y)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Geschosse mit Schweif.
 *
 * Ohne ihn ist ein schneller Schuss nur ein Punkt, der zwischen zwei Bildern springt: Bei
 * 520 Einheiten je Sekunde legt er in einem Bild fast neun Einheiten zurueck, und das Auge
 * sieht keine Bahn, sondern ein Flackern. Der Schweif ist die Strecke der letzten 50
 * Millisekunden - er schliesst die Luecke zwischen Muendungsfeuer und Einschlag.
 *
 * Er waechst aus dem Rohr heraus: Am Anfang ist er hoechstens so lang wie die bereits
 * geflogene Strecke, sonst ragte er im ersten Bild hinter den Turm.
 */
export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: readonly Projectile[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'

  for (const projectile of projectiles) {
    const center = worldToScreen(camera, projectile.pos, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))
    const radius = (projectile.crit ? 3.4 : 2.2) * zoom

    const trail = Math.min(projectile.speed * TRAIL_SECONDS, projectile.speed * projectile.life)
    if (trail > 1) {
      ctx.globalAlpha = projectile.crit ? 0.55 : 0.4
      ctx.strokeStyle = projectile.color
      ctx.shadowColor = projectile.color
      ctx.shadowBlur = 0
      ctx.lineWidth = radius * 1.1
      ctx.beginPath()
      ctx.moveTo(center.x, center.y)
      ctx.lineTo(center.x - projectile.dir.x * trail * zoom, center.y - projectile.dir.y * trail * zoom)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = projectile.color
    ctx.shadowColor = projectile.color
    ctx.shadowBlur = projectile.crit ? 10 : 5
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Liegendes Gold (GDD 08 Abschnitt 2). Muenzen verfallen nie, deshalb sind sie dauerhaft
 * sichtbar.
 *
 * Sie tragen **keine Zahl**. Der Wert steht in drei Dingen, die man ohne Lesen erfasst:
 * Groesse, Metall (bronze, silber, gold) und - solange man hinsieht - der Glanzlauf. Eine
 * aufgedruckte Zahl auf einer 14 Pixel grossen Scheibe war ohnehin nur bei wenigen lesbar
 * und machte aus liegendem Gold eine Tabelle.
 */
export function drawCoins(
  ctx: CanvasRenderingContext2D,
  coins: readonly Coin[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
  active = true,
): void {
  if (coins.length === 0) return

  const mean = meanCoinValue(coins)

  // Ausserhalb des Kampfes ist Gold Auskunft, keine Aufforderung: Es liegt weiter da
  // (GDD 08 Abschnitt 2), aufheben laesst es sich aber nur im Kampf. Gedaempft tritt es
  // hinter die Bauhilfen zurueck, statt mit ihnen um Aufmerksamkeit zu streiten.
  const dim = active ? 1 : COIN_DIM_IDLE
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  ctx.globalAlpha = dim

  for (const coin of coins) {
    const center = worldToScreen(camera, { x: coin.x, y: coin.y }, width, height)
    const { radius, tier } = coinLook(coin.value, mean, zoom)

    if (
      center.x < -radius ||
      center.y < -radius ||
      center.x > width + radius ||
      center.y > height + radius
    ) {
      continue
    }

    if (SPRITES.coins.ready()) {
      drawFrame(ctx, SPRITES.coins, glintFrame(time, coin.x, coin.y), tier, center.x, center.y, radius * 2)
    } else {
      // Bis das Bild da ist, bleibt die gezeichnete Scheibe. Ein fehlendes Bild darf nie
      // ein leeres Feld ergeben.
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = PALETTE.gold
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Wie eine Muenze aussieht: Groesse und Metall - beide aus **einem** Mass.
 *
 * Das Mass ist das Vielfache des Durchschnitts auf dem Feld, nicht der absolute Wert und
 * nicht der Anteil an der Summe.
 *
 * Ein absolutes Mass braucht einen Deckel, sonst deckt ein spaeter Stapel die halbe Station
 * zu - und ueber dem Deckel sehen wieder alle gleich aus. Der Anteil an der Summe wiederum
 * waechst, waehrend man einsammelt: Von zehn gleichen Muenzen wuchs die letzte von Radius
 * 6,2 auf 11, obwohl sich an ihr nichts geaendert hatte.
 *
 * Das Vielfache des Durchschnitts ist gegen beides fest. Gleich schwere Muenzen bleiben
 * gleich gross, egal wie viele davon noch liegen, und ein Stapel, der zehnmal so schwer ist
 * wie der Durchschnitt, sieht auf jeder Wellenhoehe gleich aus.
 *
 * Die Wurzel spreizt das untere Ende: Ein Krumen unter vielen bleibt sichtbar, statt auf den
 * Grundwert zusammenzufallen.
 *
 * Groesse und Metall kommen aus **derselben** Zahl und koennen sich deshalb nicht
 * widersprechen. Und sie stehen an einer Stelle, weil zwei Ebenen sie brauchen: das
 * liegende Gold und die aufgehobene Muenze auf ihrem Flug zum Zeiger.
 */
function coinLook(value: number, mean: number, zoom: number): { radius: number; tier: number } {
  const times = mean > 0 ? value / mean : 1
  const radius =
    (COIN_RADIUS_BASE + COIN_RADIUS_SPAN * Math.min(1, Math.sqrt(times) / COIN_SIZE_SPREAD)) * zoom
  const tier = times >= COIN_TIER_GOLD ? 2 : times >= COIN_TIER_SILVER ? 1 : 0
  return { radius, tier }
}

/**
 * Welches Bild des Glanzlaufs eine Muenze gerade zeigt.
 *
 * Der Versatz kommt aus ihrem Ort und braucht deshalb weder Zufall noch gespeicherten
 * Zustand. Ausserhalb des Laufs steht Bild 0 - die ruhende Muenze.
 */
function glintFrame(time: number, x: number, y: number): number {
  const offset = Math.abs(Math.sin(x * 0.013 + y * 0.017)) * GLINT_PERIOD
  const phase = (time + offset) % GLINT_PERIOD
  const frame = Math.floor(phase * GLINT_FPS)
  return frame < SPRITES.coins.frames ? frame : 0
}

/**
 * Der Wirkungsbereich der Station (GDD 13 Abschnitt 4).
 *
 * Er ersetzt den frueher gezeigten Sammelradius am Zeiger. Das ist ein Tausch von zwei
 * Anzeigen, die beide "Reichweite" hiessen und Verschiedenes meinten: Der Sammelradius
 * haftete am Zeiger und sagte etwas ueber die Maus, dieser Umriss haftet an der Station und
 * sagt, wohin sie schiesst. Nur der zweite ist eine Aussage ueber das Spiel.
 *
 * **Es ist kein Kreis, sondern die Vereinigung vieler Kreise** - je einer um jeden Turm, der
 * schiesst (`rangeCircles` in `sim/towers.ts`). Ein einzelner Kreis um den Kern waere in
 * beide Richtungen falsch: Nimmt er die kleinste Reichweite, sterben Gegner sichtbar
 * ausserhalb; nimmt er die groesste, verspricht er Deckung auf der Seite, wo gar kein Turm
 * steht. Solange ein Turm nicht weiter reicht als der Rest, sieht man von ihm nichts - erst
 * wenn er ueber den bestehenden Umriss hinausragt, waechst dort eine Beule.
 *
 * Abgetastet wird radial: Fuer jeden Strahl vom Kern nach aussen zaehlt der am weitesten
 * entfernte Kreisdurchstoss. Dabei entstehen an den Schnittstellen zweier Kreise Spitzen,
 * und Spitzen sehen nach Fehler aus, nicht nach Reichweite - deshalb laeuft das Maximum
 * ueber `softMax` und rundet sie ab (dasselbe Verfahren wie bei einer weichen Vereinigung
 * von Abstandsfeldern).
 *
 * Gezeichnet als sehr blasse Flaeche mit einer klaren Kante: Die Flaeche macht den Bereich
 * als Raum lesbar, die Kante nennt die Grenze. Beides zusammen bleibt weit hinter Gegnern
 * und Station zurueck - der Umriss ist Kulisse, kein Gegenstand.
 */
export function drawRangeRing(
  ctx: CanvasRenderingContext2D,
  origin: Vec2,
  circles: readonly RangeCircle[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (circles.length === 0) return

  // Die weiteste Ecke des Umrisses. Sie entscheidet, ob ueberhaupt gezeichnet wird, und ist
  // der Bezug fuer Rundung und Farbverlauf - beide sollen mit dem Bild mitwachsen.
  let outer = 0
  for (const circle of circles) {
    outer = Math.max(outer, dist(origin, circle.center) + circle.range)
  }

  const zoom = viewZoom(camera)
  if (outer * zoom < 8) return

  const point = worldToScreen(camera, origin, width, height)
  const breath = 0.85 + 0.15 * Math.sin(time * RANGE_RING_BREATH)

  const reaches = cachedOutline(origin, circles)
  const outline = projectOutline(reaches, point, zoom)

  ctx.save()

  traceLoop(ctx, outline)

  // Die Flaeche laeuft von innen nach aussen auf, damit die Station nicht in einem
  // gleichmaessigen Schleier steht - innen soll es dunkel bleiben.
  const radius = outer * zoom
  const fill = ctx.createRadialGradient(point.x, point.y, radius * 0.35, point.x, point.y, radius)
  fill.addColorStop(0, `rgba(${RGB.cyan},0)`)
  fill.addColorStop(1, `rgba(${RGB.cyan},${RANGE_RING_FILL * breath})`)
  ctx.fillStyle = fill
  ctx.fill()

  ctx.globalAlpha = RANGE_RING_ALPHA * breath
  ctx.strokeStyle = PALETTE.cyan
  ctx.lineWidth = 1.5
  ctx.shadowColor = PALETTE.cyan
  ctx.shadowBlur = 12
  ctx.stroke()

  ctx.restore()
}

/*
 * Zwischenspeicher des Umrisses.
 *
 * `rangeOutline` rechnet **rein in Weltkoordinaten** - kein Zoom, keine Kamera, keine Zeit
 * gehen ein. Sein Ergebnis aendert sich also nur, wenn sich die Kreise aendern: wenn gebaut
 * wird, ein Reichweiten-Upgrade faellt oder ein Buff an- oder ausgeht. Trotzdem lief es in
 * **jedem** Bild: 180 Strahlen gegen jeden Kreis, dazu die Glaettung und zwei frische
 * Felder. Bei fuenfzehn Modulen sind das 2700 Kreisdurchstoesse je Bild fuer ein Ergebnis,
 * das minutenlang dasselbe bleibt.
 *
 * Der Schluessel ist die Kreisliste selbst - Ursprung, Ort und Reichweite je Kreis, flach
 * hintereinander. Ihn Zahl fuer Zahl zu vergleichen kostet drei Vergleiche je Kreis; das ist
 * gegen die Neurechnung nichts. Eine Zeichenkette als Schluessel waere kuerzer zu schreiben
 * und wuerde je Bild eine neue anlegen - genau die Art Muell, die hier weg soll.
 */
let outlineKey: number[] = []
let outlineValue: number[] = []

function cachedOutline(origin: Vec2, circles: readonly RangeCircle[]): number[] {
  let same = outlineKey.length === circles.length * 3 + 2
  if (same) same = outlineKey[0] === origin.x && outlineKey[1] === origin.y
  for (let i = 0; same && i < circles.length; i++) {
    const circle = circles[i] as RangeCircle
    same =
      outlineKey[2 + i * 3] === circle.center.x &&
      outlineKey[3 + i * 3] === circle.center.y &&
      outlineKey[4 + i * 3] === circle.range
  }
  if (same) return outlineValue

  outlineKey = [origin.x, origin.y]
  for (const circle of circles) {
    outlineKey.push(circle.center.x, circle.center.y, circle.range)
  }
  outlineValue = rangeOutline(origin, circles, RANGE_RING_ROUNDING)
  return outlineValue
}

/**
 * Den Umriss auf den Bildschirm rechnen.
 *
 * Schreibt in ein wiederverwendetes Feld statt in ein neues. Der Umriss hat 180 Punkte, und
 * 180 frische Objekte je Bild sind Muell, den der Speicherbereiniger spaeter in einem Stueck
 * wegraeumt - und dieses eine Stueck sieht man als Ruckler. Das Feld wird sofort gezeichnet
 * und nirgends aufgehoben, also darf es dasselbe bleiben.
 */
const outlineScratch: Vec2[] = []

function projectOutline(reaches: readonly number[], point: Vec2, zoom: number): Vec2[] {
  while (outlineScratch.length < reaches.length) outlineScratch.push({ x: 0, y: 0 })
  outlineScratch.length = reaches.length

  for (let i = 0; i < reaches.length; i++) {
    const angle = (i / reaches.length) * Math.PI * 2
    const reach = (reaches[i] as number) * zoom
    const target = outlineScratch[i] as Vec2
    target.x = point.x + Math.cos(angle) * reach
    target.y = point.y + Math.sin(angle) * reach
  }
  return outlineScratch
}

/**
 * Der Umriss als Reichweite je Strahl, gegen den Uhrzeigersinn ab Winkel null.
 *
 * Zwei Schritte: erst die **echte** Vereinigung abtasten, dann die fertige Kurve glaetten.
 *
 * Diese Reihenfolge ist der ganze Trick. Der naheliegende Weg - das Maximum der Kreise
 * gleich weich zu nehmen (`smax` aus der Abstandsfeld-Rechnerei) - rundet die Ecke zwar
 * auch, aber er beult dabei **ueber** beide Kreise hinaus. Ein Turm, der gar nichts
 * erweitert, weil seine Scheibe ganz in der des Kerns liegt, liesse den Umriss dann trotzdem
 * wachsen: nachgemessen um zehn von 220 Einheiten. Genau das soll er nicht - unsichtbar
 * bleiben, bis er wirklich weiter reicht.
 *
 * Ein Mittelwertfilter kann das nicht: Er kommt nie ueber das oertliche Maximum hinaus, und
 * ueber einem gleichbleibenden Stueck aendert er gar nichts. Ein Kreis bleibt ein Kreis,
 * eine Beule bekommt runde Schultern.
 *
 * Rein rechnerisch und ohne Kamera - deshalb liegt die Funktion offen und wird im
 * Selbsttest geprueft. Was gezeichnet wird, ist eine Aussage ueber das Spiel; sie darf
 * nicht nur gut aussehen, sie muss stimmen.
 *
 * `rounding` ist ein Anteil des Vollkreises, kein Abstand: Die Ecke ist ein Winkelknick,
 * und wie weit sie im Bild ausladet, haengt vom Zoom ab.
 */
export function rangeOutline(
  origin: Vec2,
  circles: readonly RangeCircle[],
  rounding: number,
  rays: number = RANGE_RING_RAYS,
): number[] {
  const exact: number[] = []
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2
    exact.push(reachAlong(origin, circles, Math.cos(angle), Math.sin(angle)))
  }
  return smoothLoop(exact, Math.round(rays * rounding))
}

/**
 * Wie weit die Vereinigung entlang eines Strahls reicht.
 *
 * Je Kreis der **hintere** Durchstosspunkt des Strahls - das ist die Stelle, an der man
 * diesen Kreis wieder verlaesst. Ein Kreis, den der Strahl gar nicht trifft, traegt nichts
 * bei; er liegt seitlich und hat in dieser Richtung nichts zu sagen.
 */
function reachAlong(
  origin: Vec2,
  circles: readonly RangeCircle[],
  dx: number,
  dy: number,
): number {
  let reach = 0

  for (const circle of circles) {
    const ox = circle.center.x - origin.x
    const oy = circle.center.y - origin.y

    // Abstand des Mittelpunkts laengs und quer zum Strahl. Quer entscheidet, ob getroffen
    // wird, laengs, wo.
    const along = ox * dx + oy * dy
    const across = ox * dy - oy * dx
    const half = circle.range * circle.range - across * across
    if (half <= 0) continue

    const hit = along + Math.sqrt(half)
    if (hit > reach) reach = hit
  }

  return reach
}

/**
 * Geschlossene Zahlenreihe glaetten - Dreiecksfenster, damit die Mitte am meisten zaehlt.
 *
 * Geschlossen heisst: Der letzte Wert ist Nachbar des ersten. Ohne das bekaeme der Umriss
 * an Winkel null eine Naht, und ausgerechnet dort faellt sie auf, weil sie stehen bleibt,
 * waehrend sich alles andere dreht.
 */
function smoothLoop(values: readonly number[], radius: number): number[] {
  if (radius < 1) return [...values]

  const count = values.length
  const smoothed: number[] = []

  for (let i = 0; i < count; i++) {
    let sum = 0
    let weight = 0
    for (let offset = -radius; offset <= radius; offset++) {
      const w = radius + 1 - Math.abs(offset)
      sum += (values[(i + offset + count) % count] as number) * w
      weight += w
    }
    smoothed.push(sum / weight)
  }

  return smoothed
}

/**
 * Geschlossener Linienzug mit weichen Uebergaengen.
 *
 * Die Kurve laeuft nicht durch die Abtastpunkte, sondern durch die **Mitten** zwischen je
 * zwei benachbarten; der Punkt dazwischen wird zum Kontrollpunkt. Das ist der uebliche
 * Griff fuer eine glatte geschlossene Kurve und kostet nichts - ohne ihn zeigte der Umriss
 * bei starkem Zoom seine Ecken.
 */
function traceLoop(ctx: CanvasRenderingContext2D, points: readonly Vec2[]): void {
  const count = points.length
  if (count < 3) return

  const first = points[0] as Vec2
  const last = points[count - 1] as Vec2

  ctx.beginPath()
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let i = 0; i < count; i++) {
    const current = points[i] as Vec2
    const next = points[(i + 1) % count] as Vec2
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2)
  }
  ctx.closePath()
}

/**
 * Eingesammelte Muenzen auf dem Weg zum Zeiger.
 *
 * Sie bleiben **dieselbe Muenze**: dasselbe Bild, dasselbe Metall, dieselbe Groesse wie
 * eben noch im Feld (`coinLook`). Vorher flog hier ein kleiner goldener Punkt los, der
 * sofort zu schrumpfen begann - das sah aus, als loese sich das Gold auf, und nicht, als
 * hebe man es auf.
 *
 * Wohin sie fliegt, entscheidet die Simulation (`sim/combat.ts`): Sie faehrt dem Zeiger
 * nach und bleibt dabei erst zurueck. Diese Ebene zeichnet nur noch die **Landung** - auf
 * den letzten Pixeln vor dem Zeiger schrumpft die Muenze und verblasst. Das Schrumpfen
 * haengt am Abstand und nicht am Alter: Eine Muenze, die frueh ankommt, soll auch frueh
 * verschwinden, und eine, die lange hinterherfliegt, soll dabei nicht unterwegs zerfallen.
 */
export function drawPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly Pickup[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  for (const pickup of pickups) {
    if (!pickup.active) continue

    const center = worldToScreen(camera, pickup.pos, width, height)
    const { radius, tier } = coinLook(pickup.value, pickup.mean, zoom)

    // Wie weit die Muenze noch vom Zeiger weg ist, gemessen in ihren eigenen Radien: Eine
    // dicke Muenze darf spaeter schrumpfen als ein Krumen, sonst zerfaellt der Krumen
    // gefuehlt schon auf halber Strecke.
    const gap = dist(pickup.pos, pickup.to) * zoom
    const landing = Math.min(1, gap / (radius * PICKUP_LANDING))

    // Ein kurzer Stupser beim Aufheben. Er sagt nichts ueber den Wert - er trifft jede
    // Muenze gleich und ist nach einem Wimpernschlag vorbei -, also stoert er die Regel
    // nicht, dass die Groesse einer Muenze ihr Vielfaches des Durchschnitts nennt.
    const pop = 1 + PICKUP_POP * Math.max(0, 1 - pickup.age / (pickup.life * PICKUP_POP_SHARE))
    const size = radius * 2 * pop * (PICKUP_MIN_SCALE + (1 - PICKUP_MIN_SCALE) * landing)
    if (size < 1) continue

    ctx.globalAlpha = landing
    if (SPRITES.coins.ready()) {
      // Derselbe Glanzlauf wie im Liegen, gerechnet aus dem **Fundort**: Das Bild springt
      // beim Aufheben nicht um, sondern laeuft weiter.
      drawFrame(
        ctx,
        SPRITES.coins,
        glintFrame(time, pickup.from.x, pickup.from.y),
        tier,
        center.x,
        center.y,
        size,
      )
    } else {
      ctx.fillStyle = PALETTE.gold
      ctx.shadowColor = PALETTE.gold
      ctx.shadowBlur = 9 * landing
      ctx.beginPath()
      ctx.arc(center.x, center.y, size / 2, 0, Math.PI * 2)
      /* [REKONSTRUIERT] Ab hier war die Datei in keiner Sitzung erfasst - die letzte
         Leseausgabe endete bei Zeile 1207. Nachgebaut nach dem gleichlaufenden
         Ersatzzweig fuer liegende Muenzen (siehe `drawCoins`, Zeile 854 ff.). */
      ctx.fill()
    }
  }
  ctx.restore()
}