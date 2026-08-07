/**
 * Auto-Zoom: Die Station bleibt immer komplett im Bild (GDD 13 §4).
 * Der Zoom springt nicht, sondern naehert sich exponentiell an.
 */
import type { Vec2 } from './geometry'

export type Camera = {
  center: Vec2
  zoom: number
  targetCenter: Vec2
  targetZoom: number
  /** true, sobald der Spieler manuell gezoomt hat — dann kein Auto-Fit mehr, bis F gedrueckt wird */
  manual: boolean
}

export const createCamera = (): Camera => ({
  center: { x: 0, y: 0 },
  zoom: 1,
  targetCenter: { x: 0, y: 0 },
  targetZoom: 1,
  manual: false,
})

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.2

/**
 * Station komplett im Bild halten (GDD 13 §4). `extra` erweitert die Box um die groesste
 * Turmreichweite, damit bei sichtbaren Reichweitenkreisen auch der Kampfraum passt.
 */
export function fitTo(
  cam: Camera,
  polys: Vec2[][],
  viewW: number,
  viewH: number,
  extra = 0,
  margin = 90,
): void {
  if (cam.manual || polys.length === 0 || viewW < 1 || viewH < 1) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of polys) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }

  const w = maxX - minX + (margin + extra) * 2
  const h = maxY - minY + (margin + extra) * 2
  cam.targetCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  cam.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(viewW / w, viewH / h)))
}

export function step(cam: Camera, dt: number): void {
  const k = 1 - Math.exp(-8 * dt) // rahmenratenunabhaengige Annaeherung
  cam.center.x += (cam.targetCenter.x - cam.center.x) * k
  cam.center.y += (cam.targetCenter.y - cam.center.y) * k
  cam.zoom += (cam.targetZoom - cam.zoom) * k
}

export function zoomBy(cam: Camera, factor: number): void {
  cam.manual = true
  cam.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.targetZoom * factor))
}

export function resetAuto(cam: Camera): void {
  cam.manual = false
}

export const worldToScreen = (cam: Camera, p: Vec2, viewW: number, viewH: number): Vec2 => ({
  x: (p.x - cam.center.x) * cam.zoom + viewW / 2,
  y: (p.y - cam.center.y) * cam.zoom + viewH / 2,
})

export const screenToWorld = (cam: Camera, p: Vec2, viewW: number, viewH: number): Vec2 => ({
  x: (p.x - viewW / 2) / cam.zoom + cam.center.x,
  y: (p.y - viewH / 2) / cam.zoom + cam.center.y,
})
