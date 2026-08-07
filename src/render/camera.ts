/**
 * Auto-Zoom: Die Station bleibt immer vollstaendig im Bild (GDD 13 Abschnitt 4). Der
 * Spieler soll seine Basis jederzeit als Ganzes sehen - das ist der Kern der Spielfantasie.
 *
 * **Reichweiten gehen nicht in den Bildausschnitt ein.** Am Prototyp gemessen: Nimmt die
 * Kamera die volle Reichweite eines Scharfschuetzen auf, faellt der Zoom von 1,19 auf 0,43
 * und die Embleme schrumpfen auf 11 px - die Station ist dann nicht mehr lesbar. Der
 * Parameter `extra` bleibt fuer einen spaeteren **Bruchteil** der Reichweite erhalten,
 * bekommt aber nie die volle (GDD 13 Abschnitt 4, korrigiert nach Prototyp 01 / F4).
 *
 * Der Zoom springt nie, sondern naehert sich exponentiell an - rahmenratenunabhaengig,
 * damit 144 Hz und 60 Hz dieselbe Bewegung zeigen.
 */

import { approach, type Vec2 } from '../core/vec.ts'
import { boundsOf } from '../core/geometry.ts'

export type Camera = {
  center: Vec2
  zoom: number
  targetCenter: Vec2
  targetZoom: number
  /** true, sobald der Spieler selbst gezoomt hat - dann kein Auto-Fit mehr bis `resetAuto`. */
  manual: boolean
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2.2
/** Fester Rand um die Station, in Welteinheiten. */
export const FIT_MARGIN = 90
/** Geschwindigkeit der Annaeherung. Groesser = strammer. */
export const FOLLOW_RATE = 8

export function createCamera(): Camera {
  return {
    center: { x: 0, y: 0 },
    zoom: 1,
    targetCenter: { x: 0, y: 0 },
    targetZoom: 1,
    manual: false,
  }
}

/**
 * Zielausschnitt setzen, sodass alle uebergebenen Vielecke samt Rand hineinpassen.
 * Bewegt die Kamera nicht selbst - das macht `step`.
 */
export function fitTo(
  camera: Camera,
  polys: readonly (readonly Vec2[])[],
  viewWidth: number,
  viewHeight: number,
  extra = 0,
  margin = FIT_MARGIN,
): void {
  if (camera.manual || viewWidth < 1 || viewHeight < 1) return

  const bounds = boundsOf(polys)
  if (!bounds) return

  const padding = (margin + extra) * 2
  const width = bounds.maxX - bounds.minX + padding
  const height = bounds.maxY - bounds.minY + padding

  camera.targetCenter = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
  camera.targetZoom = clampZoom(Math.min(viewWidth / width, viewHeight / height))
}

/**
 * `dt` ist **echte** Zeit, nicht Simulationszeit: Die Kamera bewegt sich bei x4 nicht
 * viermal so schnell, sondern gleich weich.
 */
export function step(camera: Camera, dt: number): void {
  camera.center.x = approach(camera.center.x, camera.targetCenter.x, FOLLOW_RATE, dt)
  camera.center.y = approach(camera.center.y, camera.targetCenter.y, FOLLOW_RATE, dt)
  camera.zoom = approach(camera.zoom, camera.targetZoom, FOLLOW_RATE, dt)
}

/** Kamera ohne Bewegung auf ihr Ziel setzen. Fuer den ersten Bildaufbau nach dem Laden. */
export function snapToTarget(camera: Camera): void {
  camera.center = { ...camera.targetCenter }
  camera.zoom = camera.targetZoom
}

export function zoomBy(camera: Camera, factor: number): void {
  camera.manual = true
  camera.targetZoom = clampZoom(camera.targetZoom * factor)
}

/** Zurueck zum automatischen Ausschnitt. */
export function resetAuto(camera: Camera): void {
  camera.manual = false
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export const worldToScreen = (
  camera: Camera,
  point: Vec2,
  viewWidth: number,
  viewHeight: number,
): Vec2 => ({
  x: (point.x - camera.center.x) * camera.zoom + viewWidth / 2,
  y: (point.y - camera.center.y) * camera.zoom + viewHeight / 2,
})

export const screenToWorld = (
  camera: Camera,
  point: Vec2,
  viewWidth: number,
  viewHeight: number,
): Vec2 => ({
  x: (point.x - viewWidth / 2) / camera.zoom + camera.center.x,
  y: (point.y - viewHeight / 2) / camera.zoom + camera.center.y,
})

