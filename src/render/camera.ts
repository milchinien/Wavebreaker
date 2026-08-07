/**
 * Auto-Zoom: Die Station bleibt immer vollstaendig im Bild (GDD 13 Abschnitt 4). Der
 * Spieler soll seine Basis jederzeit als Ganzes sehen - das ist der Kern der Spielfantasie.
 *
 * **Die volle Reichweite geht nicht in den Bildausschnitt ein, ein Bruchteil schon.** Am
 * Prototyp gemessen: Nimmt die Kamera die volle Reichweite eines Scharfschuetzen auf, faellt
 * der Zoom von 1,19 auf 0,43 und die Embleme schrumpfen auf 11 px - die Station ist dann
 * nicht mehr lesbar. Ohne jeden Zuschlag klebt der Ausschnitt dagegen so eng an der Station,
 * dass Gegner erst im letzten Augenblick ins Bild laufen und alles riesig wirkt. `fitTo`
 * nimmt deshalb einen gedeckelten Anteil auf (`rangeAllowance`), nie die ganze Reichweite
 * (GDD 13 Abschnitt 4, korrigiert nach Prototyp 01 / F4).
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
  /**
   * Kurzer Stupser auf den Zoom, rein optisch. Ein Bereichswechsel setzt ihn auf einen Wert
   * knapp unter 1; er laeuft von selbst auf 1 zurueck. Das Bild tritt dabei einen Wimpernschlag
   * zurueck und kommt wieder - dieselbe Bewegung, die die Panels machen (GDD 13 Abschnitt 10).
   */
  pulse: number
}

export const MIN_ZOOM = 0.25
/**
 * Obergrenze des Zooms.
 *
 * Frueher 2,2 - dabei fuellte eine Station aus nur einem Hexagon das halbe Bild, und ein
 * Gegner mit Radius 14 wurde 31 Pixel gross. Bei 1,35 bleibt ein Modul mit 56 Einheiten
 * Kantenlaenge 76 Pixel breit: gross genug zum Anfassen, klein genug, dass Kampfraum bleibt.
 */
export const MAX_ZOOM = 1.35
/** Fester Rand um die Station, in Welteinheiten. */
export const FIT_MARGIN = 70
/** Geschwindigkeit der Annaeherung. Groesser = strammer. */
export const FOLLOW_RATE = 8

/**
 * Anteil der Reichweite, der in den Bildausschnitt eingeht, und sein Deckel.
 *
 * Der Anteil sorgt dafuer, dass der Angriffskreis der Station mit ins Bild passt - er ist
 * das, was der Spieler beim Zielen liest. Der Deckel verhindert, dass ein spaeter
 * Reichweiten-Ausbau das Bild leerzieht: Ab 260 Einheiten waechst der Ausschnitt nicht mehr
 * mit, die zusaetzliche Reichweite ragt dann eben ueber den Rand hinaus.
 */
export const RANGE_FIT_SHARE = 0.9
export const RANGE_FIT_CAP = 260

/** Wie viel Reichweite in den Rand eingeht - immer nur ein gedeckelter Bruchteil. */
export function rangeAllowance(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 0
  return Math.min(range * RANGE_FIT_SHARE, RANGE_FIT_CAP)
}

/** Wie schnell der Stupser aus dem Bereichswechsel wieder abklingt. */
const PULSE_RATE = 6

export function createCamera(): Camera {
  return {
    center: { x: 0, y: 0 },
    zoom: 1,
    targetCenter: { x: 0, y: 0 },
    targetZoom: 1,
    manual: false,
    pulse: 1,
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
  camera.pulse = approach(camera.pulse, 1, PULSE_RATE, dt)
}

/**
 * Zoom fuer dieses Bild - Ziel mal Stupser.
 *
 * Der Stupser steckt bewusst **nicht** in `camera.zoom`: Sonst zoege ihn `step` gegen
 * `targetZoom` und der Auto-Fit rechnete dagegen an. So bleibt er, was er ist - eine rein
 * optische Zutat auf einem Zoom, der seine eigene Wahrheit behaelt.
 */
export function viewZoom(camera: Camera): number {
  return camera.zoom * camera.pulse
}

/** Den Stupser anstossen. `amount` unter 1 tritt zurueck, ueber 1 kommt heran. */
export function pulseZoom(camera: Camera, amount: number): void {
  camera.pulse = amount
}

/** Kamera ohne Bewegung auf ihr Ziel setzen. Fuer den ersten Bildaufbau nach dem Laden. */
export function snapToTarget(camera: Camera): void {
  camera.center = { ...camera.targetCenter }
  camera.zoom = camera.targetZoom
  camera.pulse = 1
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

/*
 * Beide Umrechnungen benutzen `viewZoom`, nicht `camera.zoom` - also einschliesslich des
 * Stupsers. Sonst zeigte das Bild waehrend eines Bereichswechsels einen anderen Ausschnitt,
 * als der Zeiger trifft, und ein Klick landete bis zu anderthalb Prozent daneben. Weil
 * beide Richtungen denselben Faktor nehmen, bleibt Hin und Zurueck exakt.
 */
export const worldToScreen = (
  camera: Camera,
  point: Vec2,
  viewWidth: number,
  viewHeight: number,
): Vec2 => ({
  x: (point.x - camera.center.x) * viewZoom(camera) + viewWidth / 2,
  y: (point.y - camera.center.y) * viewZoom(camera) + viewHeight / 2,
})

export const screenToWorld = (
  camera: Camera,
  point: Vec2,
  viewWidth: number,
  viewHeight: number,
): Vec2 => ({
  x: (point.x - viewWidth / 2) / viewZoom(camera) + camera.center.x,
  y: (point.y - viewHeight / 2) / viewZoom(camera) + camera.center.y,
})
