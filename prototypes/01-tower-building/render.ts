/**
 * Canvas-Zeichnung. Der praegende Look entsteht aus den hellen Fugen zwischen den Modulen
 * (geteilte Kanten), nicht aus den Fuellflaechen — siehe Zielskizze.
 */
import { circumradius, edgesOf } from './geometry'
import type { Vec2 } from './geometry'
import { defOf, RARITY_COLOR } from './catalog'
import { drawEmblem } from './shapes'
import type { Category, Rarity, TowerInstance } from './model'
import { allModules, findModule } from './station'
import { buffLinks } from './buffs'
import type { AppState } from './app'
import { activeEdges } from './app'
import type { Camera } from './camera'
import { worldToScreen } from './camera'

const BG_TOP = '#0d1531'
const BG_BOTTOM = '#05080f'
const FILL_CORE = '#1d2a53'
const EDGE_SHARED = '#93a3e0'
const EDGE_FREE = '#2b3767'
const PLATE = '#0f1730'

/** Dezente Einfaerbung nach Aufgabe — soll die Formsignatur unterstuetzen, nicht ersetzen. */
const FILL_BY_CATEGORY: Record<Category, string> = {
  attack: '#161f3d',
  area: '#1d1c3b',
  special: '#132241',
  buff: '#16243a',
  support: '#191f45',
}

/** Leuchtstaerke nach Raritaet (GDD 13 §7: von "leichter Rand" bis "pulsierende Neonenergie"). */
const GLOW_BY_RARITY: Record<Rarity, number> = {
  common: 0,
  rare: 5,
  epic: 9,
  legendary: 14,
  mythic: 18,
}

function path(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
}

function toScreen(cam: Camera, poly: Vec2[], w: number, h: number): Vec2[] {
  return poly.map(p => worldToScreen(cam, p, w, h))
}

function inset(poly: Vec2[], factor: number): Vec2[] {
  const c = poly.reduce((s, p) => ({ x: s.x + p.x / poly.length, y: s.y + p.y / poly.length }), {
    x: 0,
    y: 0,
  })
  return poly.map(p => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }))
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, BG_TOP)
  g.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(120,150,255,0.04)'
  ctx.lineWidth = 1
  const step = 64
  ctx.beginPath()
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, h)
  }
  for (let y = 0; y < h; y += step) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(w, y + 0.5)
  }
  ctx.stroke()
}

function drawModule(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
  inst: TowerInstance,
  isCore: boolean,
): void {
  const def = defOf(inst.defId)
  const pts = toScreen(cam, inst.poly, w, h)
  const center = worldToScreen(cam, inst.placement!.center, w, h)

  // Das gezogene Modul bleibt sichtbar, tritt aber hinter seine Vorschau zurueck.
  ctx.save()
  if (app.dragUid === inst.uid) ctx.globalAlpha = 0.3

  path(ctx, pts)
  ctx.fillStyle = isCore ? FILL_CORE : FILL_BY_CATEGORY[def.category]
  ctx.fill()

  // Raritaetsrahmen leicht nach innen versetzt, damit die Fugen davon unberuehrt bleiben.
  // Mythic pulsiert, der Hauptturm atmet dezent (GDD 13 §7 und §10).
  const pulse = 0.5 + 0.5 * Math.sin(app.time * 3)
  let glow = GLOW_BY_RARITY[inst.rarity]
  if (inst.rarity === 'mythic') glow *= 0.6 + 0.6 * pulse
  if (isCore) glow = Math.max(glow, 12 + 6 * pulse)

  path(ctx, inset(pts, 0.86))
  ctx.strokeStyle = RARITY_COLOR[inst.rarity]
  ctx.lineWidth = isCore ? 2.2 : 1.4
  ctx.shadowColor = RARITY_COLOR[inst.rarity]
  ctx.shadowBlur = glow
  ctx.stroke()
  ctx.shadowBlur = 0

  // Modul unter dem Mauszeiger dezent hervorheben
  if (app.hoverUid === inst.uid && !app.buildUid && !app.dragUid) {
    path(ctx, pts)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  const r = circumradius(def.sides) * cam.zoom * 0.32
  drawEmblem(ctx, def.emblem, center, r, def.accent)

  if (app.selectedUid === inst.uid) {
    path(ctx, inset(pts, 0.95))
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

/** Kanten aller Module: geteilte hell (Fuge), freie dunkel (Aussenkontur). */
function drawEdges(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  const freeKeys = new Set(app.free.map(f => `${f.ownerUid}:${f.edgeIndex}`))

  for (const m of allModules(app.station)) {
    edgesOf(m.poly).forEach((e, i) => {
      const isFree = freeKeys.has(`${m.uid}:${i}`)
      const a = worldToScreen(cam, e.a, w, h)
      const b = worldToScreen(cam, e.b, w, h)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = isFree ? EDGE_FREE : EDGE_SHARED
      ctx.lineWidth = isFree ? 1.2 : 2
      if (!isFree) {
        ctx.shadowColor = 'rgba(147,163,224,0.7)'
        ctx.shadowBlur = 6
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    })
  }
}

function drawBuildHints(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(app.time * 4)

  for (const fe of activeEdges(app)) {
    const a = worldToScreen(cam, fe.edge.a, w, h)
    const b = worldToScreen(cam, fe.edge.b, w, h)
    const active = app.hoverEdge?.ownerUid === fe.ownerUid && app.hoverEdge.edgeIndex === fe.edgeIndex
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = active ? '#7cf3ff' : `rgba(124,243,255,${0.18 + 0.22 * pulse})`
    ctx.lineWidth = active ? 3.5 : 2
    ctx.setLineDash(active ? [] : [7, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (app.ghost) {
    const pts = toScreen(cam, app.ghost.poly, w, h)
    const ok = app.ghost.error === null
    path(ctx, pts)
    ctx.fillStyle = ok ? 'rgba(61,220,132,0.16)' : 'rgba(255,59,107,0.16)'
    ctx.fill()
    ctx.strokeStyle = ok ? '#3ddc84' : '#ff3b6b'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

/**
 * Dunkle Grundplatte: jedes Modul wird mit dicker, rund abgeschlossener Linie nachgezogen.
 * Die Ueberlagerung bildet eine gemeinsame Silhouette und bindet die Keile zwischen den
 * Modulen optisch ein, statt den Hintergrund durchscheinen zu lassen (offene Frage F9).
 */
function drawPlate(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  if (!app.showPlate) return
  ctx.save()
  ctx.fillStyle = PLATE
  ctx.strokeStyle = PLATE
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = 18 * cam.zoom
  for (const m of allModules(app.station)) {
    path(ctx, toScreen(cam, m.poly, w, h))
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** Reichweite ist ein Kreis um das EIGENE Modul, kein Schussfeld (GDD 05 §4). */
function drawRanges(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  ctx.save()
  for (const m of allModules(app.station)) {
    const selected = app.selectedUid === m.uid
    if (!app.showRanges && !selected) continue

    const range = app.summary.towers.get(m.uid)?.final.range ?? 0
    if (range <= 0 || !m.placement) continue

    const c = worldToScreen(cam, m.placement.center, w, h)
    ctx.beginPath()
    ctx.arc(c.x, c.y, range * cam.zoom, 0, Math.PI * 2)
    ctx.strokeStyle = defOf(m.defId).accent
    ctx.globalAlpha = selected ? 0.55 : 0.16
    ctx.lineWidth = selected ? 1.6 : 1
    ctx.setLineDash(selected ? [] : [5, 6])
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

/** Leuchtende Linie von jedem Buff-Modul zu jedem Modul, das es tatsaechlich verstaerkt. */
function drawBuffLines(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  for (const link of buffLinks(app.summary)) {
    const involved = app.selectedUid === link.from || app.selectedUid === link.to
    if (!app.showBuffLines && !involved) continue

    const from = findModule(app.station, link.from)
    const to = findModule(app.station, link.to)
    if (!from?.placement || !to?.placement) continue

    const a = worldToScreen(cam, from.placement.center, w, h)
    const b = worldToScreen(cam, to.placement.center, w, h)
    const color = defOf(from.defId).accent

    ctx.save()
    ctx.globalAlpha = involved ? 1 : 0.55
    ctx.strokeStyle = color
    ctx.lineWidth = involved ? 2.6 : 1.8
    ctx.shadowColor = color
    ctx.shadowBlur = 9
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()

    // Kleiner Punkt am Ziel zeigt die Wirkrichtung
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(b.x, b.y, involved ? 4 : 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/**
 * Abriss-Vorschau: Zeigt beim Zeigen auf ein Modul, welche Module den Anschluss verlieren
 * wuerden. Rot = Variante A wuerde blockieren, Bernstein = Variante B nimmt sie mit.
 */
function drawDetachPreview(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  if (app.detachPreview.length === 0) return

  const blocking = app.removalRule === 'block'
  const warn = blocking ? '#ff3b6b' : '#ffb347'
  const pulse = 0.5 + 0.5 * Math.sin(app.time * 5)

  ctx.save()
  for (const uid of app.detachPreview) {
    const m = findModule(app.station, uid)
    if (!m) continue
    const pts = toScreen(cam, m.poly, w, h)

    path(ctx, pts)
    ctx.globalAlpha = 0.12 + 0.1 * pulse
    ctx.fillStyle = warn
    ctx.fill()

    ctx.globalAlpha = 0.6 + 0.4 * pulse
    ctx.strokeStyle = warn
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Das angezeigte Modul selbst markieren
  const hovered = app.hoverUid ? findModule(app.station, app.hoverUid) : null
  if (hovered) {
    path(ctx, toScreen(cam, hovered.poly, w, h))
    ctx.globalAlpha = 1
    ctx.strokeStyle = warn
    ctx.lineWidth = 2.4
    ctx.stroke()
  }

  const n = app.detachPreview.length
  const text = blocking
    ? `Entfernen blockiert — ${n} ${n === 1 ? 'Modul wuerde' : 'Module wuerden'} abreissen`
    : `Entfernen nimmt ${n} ${n === 1 ? 'weiteres Modul' : 'weitere Module'} mit`

  ctx.globalAlpha = 1
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const tw = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(12,19,41,0.92)'
  ctx.fillRect(w / 2 - tw / 2 - 12, 14, tw + 24, 26)
  ctx.strokeStyle = warn
  ctx.lineWidth = 1
  ctx.strokeRect(w / 2 - tw / 2 - 12, 14, tw + 24, 26)
  ctx.fillStyle = warn
  ctx.fillText(text, w / 2, 19)
  ctx.restore()
}

function drawEdgeDebug(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  ctx.font = '10px monospace'
  ctx.fillStyle = '#7cf3ff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const fe of app.free) {
    const m = { x: (fe.edge.a.x + fe.edge.b.x) / 2, y: (fe.edge.a.y + fe.edge.b.y) / 2 }
    const s = worldToScreen(cam, m, w, h)
    ctx.fillText(String(fe.edgeIndex), s.x, s.y)
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  app: AppState,
  cam: Camera,
  w: number,
  h: number,
): void {
  drawBackground(ctx, w, h)
  drawRanges(ctx, app, cam, w, h)
  drawPlate(ctx, app, cam, w, h)

  for (const m of allModules(app.station)) {
    drawModule(ctx, app, cam, w, h, m, m.uid === app.station.core.uid)
  }
  drawEdges(ctx, app, cam, w, h)
  drawBuffLines(ctx, app, cam, w, h)

  if (app.buildUid || app.dragUid) drawBuildHints(ctx, app, cam, w, h)
  else drawDetachPreview(ctx, app, cam, w, h)
  if (app.showEdgeDebug) drawEdgeDebug(ctx, app, cam, w, h)
}

