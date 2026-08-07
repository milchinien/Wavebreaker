/**
 * Geometrie des Ansteck-Systems. Kennt weder DOM noch Canvas.
 *
 * Uebernommen aus Prototyp 01 (GDD 16 Abschnitt 7). E1 braucht nur die Erzeugung und
 * Vermessung regelmaessiger Vielecke; das Andocken, die Ueberlappungspruefung und die
 * Kantennachbarschaft kommen in E2 dazu.
 *
 * Konvention: Alle Module sind regelmaessige n-Ecke mit **einheitlicher Seitenlaenge**
 * und positiv orientierten Ecken (Flaeche > 0). Kante i verlaeuft von v[i] nach
 * v[(i+1) % n]; die Aussennormale einer solchen Kante ist (d.y, -d.x).
 */

import { add, dist, mid, normalize, perp, samePoint, scale, sub, type Vec2 } from './vec.ts'

/**
 * Einheitliche Seitenlaenge aller Module in Welteinheiten.
 *
 * Keine Balance-Groesse, sondern die Systemkonstante, auf der das ganze Ansteck-System
 * beruht: Weil alle Vielecke dieselbe Seitenlaenge haben, passt jede Form an jede Kante.
 * Reichweiten und Geschwindigkeiten in `data/balance.ts` sind Vielfache hiervon.
 */
export const MODULE_SIDE = 56

/** Toleranz fuer Kanten- und Punktvergleiche. Die Gleitkomma-Drift liegt weit darunter. */
export const EPS = MODULE_SIDE * 1e-3

export type Edge = { a: Vec2; b: Vec2 }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

/** Abstand Mittelpunkt -> Kantenmitte. */
export const apothem = (sides: number): number => MODULE_SIDE / (2 * Math.tan(Math.PI / sides))

/** Abstand Mittelpunkt -> Ecke. */
export const circumradius = (sides: number): number => MODULE_SIDE / (2 * Math.sin(Math.PI / sides))

/** Ecken eines n-Ecks. Die erste Ecke liegt bei `rotation`, die weiteren im Winkel steigend. */
export function polygonAt(sides: number, center: Vec2, rotation: number): Vec2[] {
  const r = circumradius(sides)
  const points: Vec2[] = []
  for (let k = 0; k < sides; k++) {
    const angle = rotation + (k * 2 * Math.PI) / sides
    points.push({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) })
  }
  return points
}

export function edgesOf(poly: readonly Vec2[]): Edge[] {
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] as Vec2 }))
}

export function centroid(poly: readonly Vec2[]): Vec2 {
  let x = 0
  let y = 0
  for (const point of poly) {
    x += point.x
    y += point.y
  }
  return { x: x / poly.length, y: y / poly.length }
}

/** Vorzeichenbehaftete Flaeche. Positiv bei korrekter Orientierung. */
export function signedArea(poly: readonly Vec2[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec2
    const b = poly[(i + 1) % poly.length] as Vec2
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/** Umschliessendes Rechteck mehrerer Vielecke. Grundlage des Auto-Zooms. */
export function boundsOf(polys: readonly (readonly Vec2[])[]): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const poly of polys) {
    for (const point of poly) {
      if (point.x < minX) minX = point.x
      if (point.y < minY) minY = point.y
      if (point.x > maxX) maxX = point.x
      if (point.y > maxY) maxY = point.y
    }
  }

  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/** Vieleck zum Mittelpunkt hin schrumpfen. Fuer Innenrahmen und die Ueberlappungspruefung. */
export function inset(poly: readonly Vec2[], factor: number): Vec2[] {
  const c = centroid(poly)
  return poly.map((point) => add(c, scale(sub(point, c), factor)))
}

// ---------------------------------------------------------------------------
// Andocken
// ---------------------------------------------------------------------------

/**
 * Der Kern des Bausystems: ein n-Eck so setzen, dass eine seiner Kanten genau auf `edge`
 * liegt - und zwar auf der **Aussenseite** des Moduls, zu dem `edge` gehoert.
 *
 * Weil ein regelmaessiges n-Eck rotationssymmetrisch ist, gibt es pro Kante genau **eine**
 * moegliche Lage. Deshalb muss der Spieler nie drehen und nie feinpositionieren, und
 * deshalb rastet immer alles sauber ein (GDD 03 Abschnitt 3).
 */
export function attachTo(sides: number, edge: Edge): { center: Vec2; rotation: number } {
  const direction = normalize(sub(edge.b, edge.a))
  const outward = perp(direction)
  const center = add(mid(edge.a, edge.b), scale(outward, apothem(sides)))
  // Das neue Modul muss dieselbe Kante rueckwaerts enthalten (b -> a), damit es selbst
  // positiv orientiert ist. Also liegt b auf seiner ersten Ecke.
  return { center, rotation: Math.atan2(edge.b.y - center.y, edge.b.x - center.x) }
}

/**
 * Zwei Kanten gelten als geteilt, wenn ihre Endpunkte uebereinstimmen - Richtung egal.
 * Ein Verschweissen der Ecken ist nicht noetig: Die Toleranz liegt Groessenordnungen
 * ueber der Gleitkomma-Drift.
 */
export function sameEdge(a: Edge, b: Edge, epsilon = EPS): boolean {
  return (
    (samePoint(a.a, b.a, epsilon) && samePoint(a.b, b.b, epsilon)) ||
    (samePoint(a.a, b.b, epsilon) && samePoint(a.b, b.a, epsilon))
  )
}

export function pointSegmentDistance(point: Vec2, edge: Edge): number {
  const ab = sub(edge.b, edge.a)
  const lengthSquared = ab.x * ab.x + ab.y * ab.y
  if (lengthSquared < 1e-12) return dist(point, edge.a)
  let t = ((point.x - edge.a.x) * ab.x + (point.y - edge.a.y) * ab.y) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return dist(point, add(edge.a, scale(ab, t)))
}

// ---------------------------------------------------------------------------
// Ueberlappung und Treffer
// ---------------------------------------------------------------------------

/**
 * Schrumpffaktor fuer die Ueberlappungspruefung. Kantenbuendig angesteckte Module
 * beruehren sich per Konstruktion - ohne diese 0,3 % waere jede korrekte Andockung
 * zugleich eine Ueberlappung.
 */
const ERODE = 0.997

function projectionRange(poly: readonly Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const point of poly) {
    const value = point.x * axis.x + point.y * axis.y
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min, max }
}

/**
 * Trennachsentest fuer konvexe Vielecke.
 *
 * Am Prototyp vermessen: 0 von 34.708 freigegebenen Platzierungen hatte eine echte
 * Ueberlappung, und alle 14.244 blockierten hatten tatsaechlich Schnittflaeche.
 */
export function polygonsOverlap(first: readonly Vec2[], second: readonly Vec2[]): boolean {
  // Grobpruefung ueber die Umkreise. Die Seitenlaenge ist bei allen Modulen gleich,
  // der groesste Umkreis ist der des Sechsecks.
  if (dist(centroid(first), centroid(second)) > 2 * circumradius(6) + EPS) return false

  const a = inset(first, ERODE)
  const b = inset(second, ERODE)

  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i] as Vec2
      const q = poly[(i + 1) % poly.length] as Vec2
      const axis = normalize({ x: -(q.y - p.y), y: q.x - p.x })
      const rangeA = projectionRange(a, axis)
      const rangeB = projectionRange(b, axis)
      if (rangeA.max < rangeB.min || rangeB.max < rangeA.min) return false
    }
  }
  return true
}

/** Punkt in konvexem, positiv orientiertem Vieleck. */
export function pointInPolygon(point: Vec2, poly: readonly Vec2[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec2
    const b = poly[(i + 1) % poly.length] as Vec2
    if ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) < 0) return false
  }
  return true
}
