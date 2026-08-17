/**
 * Module zeichnen: Flaechen, Fugen, Raritaetsrahmen, Embleme.
 *
 * Reihenfolge ist Absicht - erst alle Flaechen, dann alle Kanten. Wuerde jedes Modul
 * seine eigenen Kanten direkt nach seiner Flaeche zeichnen, uebermalte das naechste Modul
 * die Fuge des vorherigen, und der praegende Look ginge verloren.
 */

import { circumradius, edgesOf, inset } from '../core/geometry.ts'
import type { Vec2 } from '../core/vec.ts'
import { coreById } from '../data/cores.ts'
import { towerById } from '../data/towers.ts'
import type { Emblem } from '../data/types.ts'
import type { Placing, Recoil } from '../sim/combat.ts'
import type { PlacedModule } from '../sim/station.ts'
import { viewZoom, worldToScreen, type Camera } from './camera.ts'
import { drawEmblem } from './emblems.ts'
import {
  CORE_BREATH_RATE,
  CORE_GLOW_BASE,
  CORE_GLOW_PULSE,
  CORE_HIT_GLOW,
  FILL_BY_CATEGORY,
  RARITY_COLOR,
  RARITY_GLOW,
  THEME,
} from './theme.ts'

export type ModuleLook = { emblem: Emblem; accent: string; fill: string; frame: string; glow: number }

export type DrawOptions = {
  /** Modul, das gerade umgesetzt wird - es tritt hinter seine Vorschau zurueck. */
  dragUid?: string | null
  selectedUid?: string | null
  hoverUid?: string | null
  /**
   * Rueckstoss je Modul. Nur die Kampfansicht reicht ihn herein - in der Basis soll die
   * Station stillstehen, damit sich Kanten ruhig treffen lassen.
   */
  recoils?: Map<string, Recoil> | undefined
  /** Zucken der Station nach einem Treffer, 0 bis 1. Trifft nur den Kern. */
  flash?: number | undefined
  /**
   * Eben gesetzte Module (GDD 13 Abschnitt 10). Anders als der Rueckstoss wird das hier
   * **immer** hereingereicht - gerade in der Basis soll man sehen, dass etwas angedockt hat.
   */
  placings?: Map<string, Placing> | undefined
  /**
   * Module, die gerade im Overdrive sind (`sim/overdrive.ts`).
   *
   * Ohne sichtbaren Zustand existiert Overdrive fuer den Spieler nicht - er saehe nur, dass
   * die Zahlen ueber dem Feld manchmal groesser sind, und wuesste nie warum. Gereicht wird
   * die **Menge der Kennungen** und nicht der Zustand selbst: Die Zeichenebene muss wissen,
   * wer glueht, nicht wie lange noch.
   */
  overdrive?: ReadonlySet<string> | undefined
}

/**
 * Wie weit ein Modul beim Andocken ueber seine Groesse hinausschiesst.
 *
 * Es kommt zu gross herein und setzt sich - nicht umgekehrt. Von klein aufzuwachsen sieht
 * aus, als entstuende das Modul; von gross einzurasten sieht aus, als **kaeme** es an, und
 * genau das ist passiert.
 */
const PLACE_OVERSHOOT = 0.22

/** Zusaetzliches Leuchten des Rahmens im Augenblick des Andockens. */
const PLACE_GLOW = 22

/**
 * Von wo bis wohin der Andockring laeuft, in Welteinheiten.
 *
 * Er beginnt knapp am Modul und endet gut zwei Modulbreiten weiter - weit genug, dass er
 * die Nachbarn erreicht, kurz genug, dass er nicht als Explosion gelesen wird.
 */
const PLACE_RING_FROM = 18
const PLACE_RING_TO = 74

/** Wie weit ein Modul beim Schuss zurueckweicht, in Welteinheiten. */
const RECOIL_DISTANCE = 2.6

/**
 * Versatz eines Moduls durch den Rueckstoss, in Bildschirmpixeln.
 *
 * Quadratisch abklingend: Der Stoss sitzt sofort und kommt weich zurueck. Linear
 * abklingend saehe er aus wie ein Rutschen.
 */
function recoilOffset(module: PlacedModule, camera: Camera, options: DrawOptions): Vec2 {
  const recoil = options.recoils?.get(module.uid)
  if (!recoil) return { x: 0, y: 0 }

  const left = Math.max(0, 1 - recoil.age / recoil.life)
  const kick = RECOIL_DISTANCE * left * left * viewZoom(camera)
  return { x: -Math.cos(recoil.angle) * kick, y: -Math.sin(recoil.angle) * kick }
}

/**
 * Aussehen eines Moduls in diesem Bild.
 *
 * `flash` ist das Zucken der Station nach einem Treffer (0 bis 1). Es trifft nur den Kern:
 * Die Station hat eine gemeinsame Lebensleiste, und ihr Herz soll zeigen, dass es getroffen
 * wurde - nicht jedes einzelne Modul.
 */
export function lookOf(module: PlacedModule, time: number, flash = 0): ModuleLook {
  if (module.kind === 'core') {
    const def = coreById(module.defId)
    // Der Hauptturm hat keine Raritaet und atmet stattdessen (GDD 13 Abschnitt 10).
    const breath = 0.5 + 0.5 * Math.sin(time * CORE_BREATH_RATE)
    return {
      emblem: def.emblem,
      accent: def.accent,
      fill: THEME.fillCore,
      frame: def.accent,
      // Das Zucken faellt quadratisch ab - es schlaegt auf und beruhigt sich, statt
      // gleichmaessig abzuklingen.
      glow: CORE_GLOW_BASE + CORE_GLOW_PULSE * breath + CORE_HIT_GLOW * flash * flash,
    }
  }

  const def = towerById(module.defId)
  const rarity = module.rarity ?? 'common'
  // Mythic pulsiert (GDD 13 Abschnitt 7).
  const pulse = 0.5 + 0.5 * Math.sin(time * 3)
  const glow = rarity === 'mythic' ? RARITY_GLOW[rarity] * (0.6 + 0.6 * pulse) : RARITY_GLOW[rarity]

  return {
    emblem: def.emblem,
    accent: def.accent,
    fill: FILL_BY_CATEGORY[def.category],
    frame: RARITY_COLOR[rarity],
    glow,
  }
}

export function drawModules(
  ctx: CanvasRenderingContext2D,
  modules: readonly PlacedModule[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
  options: DrawOptions = {},
): void {
  for (const module of modules) drawFill(ctx, module, camera, width, height, time, options)
  for (const module of modules) drawEdges(ctx, module, camera, width, height, options)
  for (const module of modules) drawSymbol(ctx, module, camera, width, height, time, options)
  // Zuletzt: Der Andockring läuft über seine Nachbarn hinweg und wäre sonst halb verdeckt.
  for (const module of modules) drawPlaceRing(ctx, module, camera, width, height, time, options)
  for (const module of modules) drawOverdrive(ctx, module, camera, width, height, time, options)
}

/** Der Ton, in dem ein Modul im Overdrive glüht. */
const OVERDRIVE_TONE = '#ff6a2d'
const OVERDRIVE_PULSE_RATE = 9

/**
 * Ein Modul im Overdrive glüht (`docs/upgrade-umbau.md` Abschnitt 6.5).
 *
 * Gezeichnet als **pulsierender Umriss** und nicht als Fläche: Die Fläche sagt bereits, was
 * für ein Modul es ist (Kategorie) und wie selten (Rahmenfarbe). Ein zweiter Farbauftrag
 * darüber machte beides unlesbar; eine Kontur darüber nicht.
 *
 * Das Pulsieren ist schnell — deutlich schneller als das Atmen des Kerns. Der Zustand hält
 * nur wenige Sekunden, und was kurz gilt, muss auch kurzatmig aussehen.
 */
function drawOverdrive(
  ctx: CanvasRenderingContext2D,
  module: PlacedModule,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  options: DrawOptions,
): void {
  if (!options.overdrive?.has(module.uid)) return

  const pulse = 0.55 + 0.45 * Math.sin(time * OVERDRIVE_PULSE_RATE)
  const points = toScreen(camera, module.poly, width, height)

  ctx.save()
  ctx.globalAlpha = alphaFor(module, options) * (0.5 + 0.5 * pulse)
  trace(ctx, points)
  ctx.strokeStyle = OVERDRIVE_TONE
  ctx.lineWidth = 2 + 1.5 * pulse
  ctx.shadowColor = OVERDRIVE_TONE
  ctx.shadowBlur = 10 + 14 * pulse
  ctx.stroke()
  ctx.restore()
}

/**
 * Der Ring, der beim Andocken aufgeht (GDD 13 Abschnitt 10).
 *
 * Er sagt etwas anderes als das Einrasten des Moduls: Das Einrasten heisst "hier sitzt es
 * jetzt", der Ring heisst "die Station ist gewachsen". Deshalb laeuft er ueber die
 * Nachbarn hinaus statt am Modul zu enden.
 *
 * Er liegt hier und nicht im Vorrat der Druckwellen, obwohl er dort hineinpasste:
 * Druckwellen werden nur gezeichnet, wo der Kampf zu sehen ist - und gebaut wird in der
 * Basis. Ein Ring, den man beim Bauen nicht sieht, ist kein Bauring.
 */
function drawPlaceRing(
  ctx: CanvasRenderingContext2D,
  module: PlacedModule,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  options: DrawOptions,
): void {
  const placing = options.placings?.get(module.uid)
  if (!placing || placing.life <= 0) return

  // Der Ring laeuft **linear** auf, waehrend das Modul quadratisch einrastet: So verlaesst
  // er das Modul sichtbar, statt mit ihm zusammen stehen zu bleiben.
  const done = Math.min(1, placing.age / placing.life)
  if (done >= 1) return

  const center = worldToScreen(camera, module.center, width, height)
  const zoom = viewZoom(camera)
  const radius = (PLACE_RING_FROM + (PLACE_RING_TO - PLACE_RING_FROM) * done) * zoom

  ctx.save()
  ctx.globalAlpha = (1 - done) * (1 - done)
  ctx.strokeStyle = lookOf(module, time).accent
  ctx.shadowColor = ctx.strokeStyle
  ctx.shadowBlur = 14
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/**
 * Wie weit ein Modul in diesem Bild noch einrastet - 1 im Augenblick des Andockens, 0 danach.
 *
 * Quadratisch abklingend, dieselbe Kurve wie beim Rueckstoss: Der Wert sitzt sofort und
 * kommt weich zurueck. Linear abklingend saehe das Einrasten aus wie ein Schrumpfen.
 */
function placingAmount(module: PlacedModule, options: DrawOptions): number {
  const placing = options.placings?.get(module.uid)
  if (!placing || placing.life <= 0) return 0
  const left = Math.max(0, 1 - placing.age / placing.life)
  return left * left
}

/**
 * Die Ecken eines Moduls um seine Mitte skalieren.
 *
 * Um die **eigene** Mitte, nicht um die der Station: Sonst wanderte ein Modul am Rand beim
 * Einrasten quer durch das Bild, statt an seinem Platz aufzuploppen.
 */
function scaleAround(points: readonly Vec2[], center: Vec2, factor: number): Vec2[] {
  if (factor === 1) return [...points]
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  }))
}

export function toScreen(
  camera: Camera,
  poly: readonly Vec2[],
  width: number,
  height: number,
): Vec2[] {
  return poly.map((point) => worldToScreen(camera, point, width, height))
}

export function trace(ctx: CanvasRenderingContext2D, points: readonly Vec2[]): void {
  ctx.beginPath()
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.closePath()
}

/** Das gezogene Modul bleibt sichtbar, tritt aber hinter seine Vorschau zurueck. */
function alphaFor(module: PlacedModule, options: DrawOptions): number {
  return options.dragUid === module.uid ? 0.3 : 1
}

function drawFill(
  ctx: CanvasRenderingContext2D,
  module: PlacedModule,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  options: DrawOptions,
): void {
  const look = lookOf(module, time, options.flash ?? 0)
  const kick = recoilOffset(module, camera, options)
  const settle = placingAmount(module, options)

  const center = worldToScreen(camera, module.center, width, height)
  const points = scaleAround(
    toScreen(camera, module.poly, width, height),
    center,
    1 + PLACE_OVERSHOOT * settle,
  )

  ctx.save()
  ctx.translate(kick.x, kick.y)
  ctx.globalAlpha = alphaFor(module, options)

  trace(ctx, points)
  ctx.fillStyle = look.fill
  ctx.fill()

  // Rahmen nach innen versetzt, damit er die Fugen nicht beruehrt.
  trace(ctx, inset(points, THEME.frameInset))
  ctx.strokeStyle = look.frame
  ctx.lineWidth = module.kind === 'core' ? THEME.frameWidthCore : THEME.frameWidthModule
  ctx.shadowColor = look.frame
  // Beim Andocken glueht der Rahmen kurz auf - sonst waere das Einrasten eine Bewegung
  // ohne Licht, und die Station leuchtet sonst bei jedem Ereignis.
  ctx.shadowBlur = look.glow + PLACE_GLOW * settle
  ctx.stroke()
  ctx.restore()
}

/** Geteilte Kanten hell und leuchtend (Fugen), freie Kanten dunkel (Aussenkontur). */
function drawEdges(
  ctx: CanvasRenderingContext2D,
  module: PlacedModule,
  camera: Camera,
  width: number,
  height: number,
  options: DrawOptions,
): void {
  const shared = new Set(module.sharedEdges)
  const kick = recoilOffset(module, camera, options)
  // Dieselbe Skalierung wie bei der Flaeche - sonst wuechse das Modul aus seinen Kanten
  // heraus, und die Fugen stuenden einen Wimpernschlag lang daneben.
  const settle = placingAmount(module, options)
  const factor = 1 + PLACE_OVERSHOOT * settle
  const center = worldToScreen(camera, module.center, width, height)
  const grow = (point: Vec2): Vec2 => ({
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  })

  ctx.save()
  ctx.translate(kick.x, kick.y)
  ctx.globalAlpha = alphaFor(module, options)
  edgesOf(module.poly).forEach((edge, index) => {
    const isShared = shared.has(index)
    const a = grow(worldToScreen(camera, edge.a, width, height))
    const b = grow(worldToScreen(camera, edge.b, width, height))

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = isShared ? THEME.edgeShared : THEME.edgeFree
    ctx.lineWidth = isShared ? THEME.edgeSharedWidth : THEME.edgeFreeWidth
    ctx.shadowColor = isShared ? THEME.edgeSharedGlow : 'transparent'
    ctx.shadowBlur = isShared ? THEME.edgeSharedBlur : 0
    ctx.stroke()
  })
  ctx.restore()
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  module: PlacedModule,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  options: DrawOptions,
): void {
  const look = lookOf(module, time, options.flash ?? 0)
  const center = worldToScreen(camera, module.center, width, height)
  const kick = recoilOffset(module, camera, options)
  const settle = placingAmount(module, options)
  const factor = 1 + PLACE_OVERSHOOT * settle
  const points = scaleAround(toScreen(camera, module.poly, width, height), center, factor)

  ctx.save()
  ctx.translate(kick.x, kick.y)
  ctx.globalAlpha = alphaFor(module, options)
  drawEmblem(
    ctx,
    look.emblem,
    center,
    // Das Zeichen waechst mit: Ein Modul, das einrastet, waehrend sein Emblem stillsteht,
    // sieht aus wie zwei Dinge uebereinander statt wie eines.
    circumradius(module.sides) * viewZoom(camera) * THEME.emblemRadiusFactor * factor,
    look.accent,
  )

  // Modul unter dem Mauszeiger dezent hervorheben.
  if (options.hoverUid === module.uid && !options.dragUid) {
    trace(ctx, points)
    ctx.strokeStyle = THEME.hoverOutline
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  if (options.selectedUid === module.uid) {
    trace(ctx, inset(points, 0.95))
    ctx.strokeStyle = THEME.selectOutline
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}
