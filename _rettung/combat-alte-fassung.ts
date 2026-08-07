/**
 * Gegner, Geschosse und Treffer.
 *
 * Der Spieler soll **ohne Text** erkennen, was auf ihn zukommt (GDD 07 Abschnitt 3):
 * Form, Farbe und Groesse zeigen die Rolle. Ein Lebensbalken erscheint nur bei Gegnern,
 * die ihn brauchen - bei jedem Gegner waere er Rauschen.
 */

import { formatNumber } from '../core/format.ts'
import { t } from '../data/strings.ts'
import type { Vec2 } from '../core/vec.ts'
import { enemyById, type EnemyShape } from '../data/enemies.ts'
import { podById } from '../data/events.ts'
import { TRADER_STAY_SECONDS } from '../data/balance.ts'
import type { Helper, Pod, Trader } from '../app/state.ts'
import type { Beam, Burst, Gain, Hit, Muzzle, Pickup, Shard } from '../sim/combat.ts'
import type { Drone } from '../sim/drones.ts'
import type { Coin } from '../sim/economy.ts'
import type { Enemy } from '../sim/enemies.ts'
import type { Projectile } from '../sim/projectiles.ts'
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
 * Der Glanzlauf einer Muenze: `GLINT_PERIOD` Sekunden Ruhe, dann ein kurzer Lauf ueber alle
 * Bilder. Der Versatz kommt aus dem Ort der Muenze - dieselbe Muenze glaenzt immer gleich,
 * zwei nebeneinander aber nie im Takt. Ein Feld voller Gold soll leben, nicht blinken.
 */
const GLINT_PERIOD = 3.4
const GLINT_FPS = 14

/**
 * Der Angriffskreis um die Station.
 *
 * Er atmet langsam - sichtbar genug, dass man ihn als Anzeige liest, ruhig genug, dass er
 * nicht mit den Gegnern um Aufmerksamkeit streitet.
 */
const RANGE_RING_BREATH = 0.9
const RANGE_RING_ALPHA = 0.3
const RANGE_RING_FILL = 0.05

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
    const radius = enemy.radius * camera.zoom

    // Der Biss: ein Stoss zum Modul hin und zurueck. Ein Sinusbogen geht weich hin und
    // weich zurueck - der Gegner beisst, er springt nicht.
    if (enemy.biteLife > 0) {
      const lunge =
        Math.min(6, enemy.radius * 0.35) *
        Math.sin(Math.PI * Math.min(1, enemy.bite / enemy.biteLife)) *
        camera.zoom
      center.x += enemy.biteDir.x * lunge
      center.y += enemy.biteDir.y * lunge
    }

    // Ausserhalb des Bildes gar nicht erst zeichnen.
    if (center.x < -radius || center.y < -radius || center.x > width + radius || center.y > height + radius) {
      continue
    }

    // Gegner sind leuchtende Umrisse, keine gefuellten Klumpen: Die Fuellung deutet den
    // Koerper nur an, die Aussage traegt die Kante. So bleiben auch dichte Wellen lesbar,
    // und der Blick faellt weiter auf die helle Station statt auf den Gegnerteppich.
    tracePolygon(ctx, def.shape, center, radius, enemy.dockedTo !== null)
    ctx.fillStyle = def.color
    ctx.globalAlpha = 0.14
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.strokeStyle = def.color
    ctx.lineWidth = 2
    ctx.shadowColor = def.color
    ctx.shadowBlur = enemy.dockedTo !== null ? 12 : 7
    ctx.stroke()
    ctx.shadowBlur = 0

    if (enemy.maxHp >= HP_BAR_FROM_MAX_HP) {
      drawHpBar(ctx, center, radius, enemy.hp / enemy.maxHp, def.color, camera.zoom)
    }
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
    const radius = enemy.radius * camera.zoom
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
    const zoom = Math.max(0.6, camera.zoom)
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

  let onField = 0
  for (const coin of coins) onField += coin.value
  const mean = onField / coins.length

  // Ausserhalb des Kampfes ist Gold Auskunft, keine Aufforderung: Es liegt weiter da
  // (GDD 08 Abschnitt 2), aufheben laesst es sich aber nur im Kampf. Gedaempft tritt es
  // hinter die Bauhilfen zurueck, statt mit ihnen um Aufmerksamkeit zu streiten.
  const dim = active ? 1 : COIN_DIM_IDLE
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  ctx.globalAlpha = dim

  for (const coin of coins) {
    const center = worldToScreen(camera, { x: coin.x, y: coin.y }, width, height)

    /*
     * Die Groesse folgt dem **Vielfachen des Durchschnitts**, nicht dem absoluten Wert und
     * nicht dem Anteil an der Summe.
     *
     * Ein absolutes Mass braucht einen Deckel, sonst deckt ein spaeter Stapel die halbe
     * Station zu - und ueber dem Deckel sehen wieder alle gleich aus. Der Anteil an der
     * Summe wiederum waechst, waehrend man einsammelt: Von zehn gleichen Muenzen wuchs die
     * letzte von Radius 6,2 auf 11, obwohl sich an ihr nichts geaendert hatte.
     *
     * Das Vielfache des Durchschnitts ist gegen beides fest. Gleich schwere Muenzen bleiben
     * gleich gross, egal wie viele davon noch liegen, und ein Stapel, der zehnmal so schwer
     * ist wie der Durchschnitt, sieht auf jeder Wellenhoehe gleich aus.
     *
     * Die Wurzel spreizt das untere Ende: Ein Krumen unter vielen bleibt sichtbar, statt
     * auf den Grundwert zusammenzufallen.
     */
    const times = mean > 0 ? coin.value / mean : 1
    const radius =
      (COIN_RADIUS_BASE + COIN_RADIUS_SPAN * Math.min(1, Math.sqrt(times) / COIN_SIZE_SPREAD)) *
      zoom

    if (
      center.x < -radius ||
      center.y < -radius ||
      center.x > width + radius ||
      center.y > height + radius
    ) {
      continue
    }

    // Dasselbe Vielfache entscheidet ueber das Metall - Groesse und Farbe sagen damit
    // dasselbe und koennen sich nicht widersprechen.
    const tier = times >= COIN_TIER_GOLD ? 2 : times >= COIN_TIER_SILVER ? 1 : 0

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
 * Der Angriffskreis um die Station (GDD 13 Abschnitt 4).
 *
 * Er ersetzt den frueher gezeigten Sammelradius am Zeiger. Das ist ein Tausch von zwei
 * Anzeigen, die beide "Reichweite" hiessen und Verschiedenes meinten: Der Sammelradius
 * haftete am Zeiger und sagte etwas ueber die Maus, dieser Kreis haftet an der Station und
 * sagt, wohin sie schiesst. Nur der zweite ist eine Aussage ueber das Spiel.
 *
 * Gezeichnet als sehr blasse Flaeche mit einer klaren Kante: Die Flaeche macht den Bereich
 * als Raum lesbar, die Kante nennt die Grenze. Beides zusammen bleibt weit hinter Gegnern
 * und Station zurueck - der Kreis ist Kulisse, kein Gegenstand.
 */
export function drawRangeRing(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  range: number,
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  const radius = range * viewZoom(camera)
  if (radius < 8) return

  const point = worldToScreen(camera, center, width, height)
  const breath = 0.85 + 0.15 * Math.sin(time * RANGE_RING_BREATH)

  ctx.save()

  // Die Flaeche laeuft von innen nach aussen auf, damit die Station nicht in einem
  // gleichmaessigen Schleier steht - innen soll es dunkel bleiben.
  const fill = ctx.createRadialGradient(point.x, point.y, radius * 0.35, point.x, point.y, radius)
  fill.addColorStop(0, `rgba(${RGB.cyan},0)`)
  fill.addColorStop(1, `rgba(${CYAN_RGB}, ${RANGE_RING_FILL * breath})`)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = RANGE_RING_ALPHA * breath
  ctx.strokeStyle = PALETTE.cyan
  ctx.lineWidth = 1.5
  ctx.shadowColor = PALETTE.cyan
  ctx.shadowBlur = 12
  ctx.stroke()

  ctx.restore()
}

/**
 * Eingesammelte Muenzen auf dem Weg zum Zeiger.
 *
 * Sie starten schnell und kommen langsam an: So liest sich die Bewegung als Aufheben und
 * nicht als Wegfliegen. Am Ziel schrumpfen sie auf null - der Wert steht dann schon in der
 * Goldanzeige, die im selben Moment pulst.
 */
export function drawPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly Pickup[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  for (const pickup of pickups) {
    if (!pickup.active) continue

    const progress = Math.min(1, pickup.age / pickup.life)
    const eased = 1 - Math.pow(1 - progress, 3)
    const world = {
      x: pickup.from.x + (pickup.to.x - pickup.from.x) * eased,
      y: pickup.from.y + (pickup.to.y - pickup.from.y) * eased,
    }
    const center = worldToScreen(camera, world, width, height)
    const radius = 4.5 * (1 - progress) * Math.max(0.6, camera.zoom)
    if (radius < 0.4) continue

    ctx.globalAlpha = 1 - progress * progress
    ctx.fillStyle = PALETTE.gold
    ctx.shadowColor = PALETTE.gold
    ctx.shadowBlur = 9 * (1 - progress)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Der eingesammelte Betrag steigt auf und verblasst.
 *
 * Er steht dort, wo eingesammelt wurde, und wandert nach oben aus dem Geschehen heraus -
 * so verdeckt er nichts, was gerade wichtig ist. Die Bewegung ist am Anfang schnell und
 * wird langsamer: Die Zahl springt ins Auge und legt sich dann hin.
 */
export function drawGains(
  ctx: CanvasRenderingContext2D,
  gains: readonly Gain[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const zoom = Math.max(0.6, camera.zoom)

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(18 * zoom)}px ${THEME.numberFont}`

  for (const gain of gains) {
    if (!gain.active) continue

    const progress = Math.min(1, gain.age / gain.life)
    const rise = GAIN_RISE * (1 - (1 - progress) * (1 - progress))
    const point = worldToScreen(camera, { x: gain.pos.x, y: gain.pos.y - rise }, width, height)

    ctx.globalAlpha = 1 - progress * progress
    ctx.fillStyle = PALETTE.gold
    ctx.shadowColor = PALETTE.gold
    ctx.shadowBlur = 8 * (1 - progress)
    writePixelText(ctx, t('hud.gain', { amount: formatNumber(Math.floor(gain.value)) }), point.x, point.y)
  }

  ctx.restore()
}

/**
 * Der Zerfall eines Gegners.
 *
 * Zwei Ebenen: das Explosionsbild aus dem Anlagensatz und darunter die Druckwelle in
 * **seiner** Farbe. Das Bild gibt dem Tod Koerper, der Ring sagt, wen es getroffen hat -
 * ein zerplatzter Schwarm sieht damit weiter anders aus als ein gefallener Boss, obwohl
 * beide dasselbe Bild benutzen (GDD 07 Abschnitt 3).
 *
 * Liegt das Bild noch nicht vor, bleibt der Ring allein stehen und wird kraeftiger - so
 * fehlt nie der ganze Effekt, nur seine Fuellung.
 */
export function drawBursts(
  ctx: CanvasRenderingContext2D,
  bursts: readonly Burst[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const hasSprite = SPRITES.death.ready()

  ctx.save()
  for (const burst of bursts) {
    if (!burst.active) continue

    const progress = Math.min(1, burst.age / burst.life)
    const center = worldToScreen(camera, burst.pos, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))
    // Schnell auf, langsam aus: Die Welle soll schlagen, nicht wachsen.
    const radius = burst.radius * (1 + 1.8 * Math.sqrt(progress)) * zoom

    ctx.globalAlpha = (1 - progress) * (hasSprite ? 0.5 : 0.85)
    ctx.strokeStyle = burst.color
    ctx.lineWidth = Math.max(1, 2.4 * (1 - progress) * zoom)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    if (hasSprite) {
      // Das Bild laeuft ueber seine Lebensdauer genau einmal durch - es ist der Zerfall
      // selbst, nicht eine Schleife, die zufaellig endet.
      ctx.globalAlpha = 1
      drawFrame(
        ctx,
        SPRITES.death,
        progress * SPRITES.death.frames,
        0,
        center.x,
        center.y,
        burst.radius * 4.5 * zoom,
      )
    }
  }
  ctx.restore()
}

export function drawShards(
  ctx: CanvasRenderingContext2D,
  shards: readonly Shard[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  for (const shard of shards) {
    if (!shard.active) continue

    const progress = Math.min(1, shard.age / shard.life)
    const center = worldToScreen(camera, shard.pos, width, height)
    const zoom = Math.max(0.6, camera.zoom)
    const radius = shard.radius * (1 - 0.45 * progress) * zoom
    if (radius < 0.4) continue

    // Goldfunken holen ihre Farbe aus der Palette - die Simulation kennt keine Farben,
    // die nicht von einem Gegner oder einem Turm kommen.
    const color = shard.kind === 'muenze' ? PALETTE.gold : shard.color

    ctx.globalAlpha = 1 - progress * progress
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, 1.4 * zoom)
    ctx.shadowColor = color
    ctx.shadowBlur = 6 * (1 - progress)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Muendungsfeuer: ein kurzer Strich, der aus der Modulkante in Schussrichtung schlaegt.
 *
 * Er beginnt bewusst **ausserhalb** der Flaeche - laege der Anfang in der Mitte, malte der
 * Blitz das Modul zu, und genau das Modul ist der Teil, den man sehen soll.
 */
export function drawMuzzles(
  ctx: CanvasRenderingContext2D,
  muzzles: readonly Muzzle[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'

  for (const muzzle of muzzles) {
    if (!muzzle.active) continue

    const fade = Math.max(0, 1 - muzzle.age / muzzle.life)
    const dx = Math.cos(muzzle.angle)
    const dy = Math.sin(muzzle.angle)
    const start = worldToScreen(
      camera,
      { x: muzzle.pos.x + dx * MUZZLE_OFFSET, y: muzzle.pos.y + dy * MUZZLE_OFFSET },
      width,
      height,
    )
    const length = MUZZLE_LENGTH * Math.max(0.6, camera.zoom) * fade

    ctx.globalAlpha = fade
    ctx.strokeStyle = muzzle.color
    ctx.shadowColor = muzzle.color
    ctx.shadowBlur = 10 * fade
    ctx.lineWidth = Math.max(1.4, 3.2 * Math.max(0.6, camera.zoom) * fade)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(start.x + dx * length, start.y + dy * length)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Kurzes Aufblitzen dort, wo Schaden ankam.
 *
 * Drei Faelle, drei Bilder - der Spieler soll am Einschlag sehen, was passiert ist, ohne
 * auf eine Leiste zu schauen:
 *
 *   Treffer am Gegner   blauer Einschlag  - eigener Schaden
 *   kritischer Treffer  goldener Funken   - der Ausreisser nach oben
 *   Treffer an der Station  magenta Ring  - Schaden am eigenen Haus
 *
 * Die Station behaelt bewusst die gezeichnete Fassung: Magenta ist die Farbe der Bedrohung,
 * und beide Bilder aus dem Anlagensatz sind blau und gold - sie wuerden einen Treffer auf
 * die eigene Station wie einen Erfolg aussehen lassen.
 */
export function drawHits(
  ctx: CanvasRenderingContext2D,
  hits: readonly Hit[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  for (const hit of hits) {
    const progress = Math.min(1, hit.age / hit.life)
    const center = worldToScreen(camera, hit.pos, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))

    const strip = hit.crit ? SPRITES.spark : SPRITES.impact
    if (hit.kind === 'enemy' && strip.ready()) {
      ctx.globalAlpha = 1
      drawFrame(
        ctx,
        strip,
        progress * strip.frames,
        0,
        center.x,
        center.y,
        (hit.crit ? 46 : 30) * zoom,
      )
      continue
    }

    const scale = hit.crit ? 1.7 : 1
    const radius = (4 + progress * 12) * scale * zoom
    const color = hit.kind === 'station' ? THEME.hitStation : THEME.hitEnemy

    ctx.globalAlpha = 1 - progress
    ctx.strokeStyle = color
    ctx.lineWidth = hit.crit ? 3 : 2
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Der Kern verlischt schneller als der Ring - der Einschlag hat dadurch einen Anfang.
    if (progress < 0.45) {
      ctx.globalAlpha = (1 - progress / 0.45) * 0.9
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(center.x, center.y, (hit.crit ? 3.4 : 2.2) * zoom, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}
