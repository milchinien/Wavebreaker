/**
 * Reine Geometrie des Ansteck-Systems. Kennt weder DOM noch Canvas.
 *
 * Konvention: Alle Polygone sind regelmaessige n-Ecke mit der EINHEITLICHEN Seitenlaenge SIDE
 * und werden mit positiv orientierten Ecken erzeugt (Shoelace-Flaeche > 0). Kante i verlaeuft
 * von v[i] nach v[(i+1) % n]; die Aussennormale einer solchen Kante ist (d.y, -d.x).
 */

export type Vec2 = { x: number; y: number }
export type Edge = { a: Vec2; b: Vec2 }

/** Einheitliche Seitenlaenge aller Module. */
export const SIDE = 56

/** Toleranz fuer Kanten- und Punktvergleiche. Gleitkomma-Drift liegt um Groessenordnungen darunter. */
export const EPS = SIDE * 1e-3

// --- Vektoren --------------------------------------------------------------

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, f: number): Vec2 => ({ x: a.x * f, y: a.y * f })
export const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

export function normalize(a: Vec2): Vec2 {
  const l = len(a)
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

export const samePoint = (a: Vec2, b: Vec2, eps = EPS): boolean => dist(a, b) < eps

// --- Regelmaessige Polygone ------------------------------------------------

/** Abstand Mittelpunkt -> Kantenmitte. */
export const apothem = (n: number): number => SIDE / (2 * Math.tan(Math.PI / n))

/** Abstand Mittelpunkt -> Ecke. */
export const circumradius = (n: number): number => SIDE / (2 * Math.sin(Math.PI / n))

/** Ecken eines n-Ecks, erste Ecke bei `rotation`, danach im Winkel steigend. */
export function polygonAt(n: number, center: Vec2, rotation: number): Vec2[] {
  const r = circumradius(n)
  const out: Vec2[] = []
  for (let k = 0; k < n; k++) {
    const t = rotation + (k * 2 * Math.PI) / n
    out.push({ x: center.x + r * Math.cos(t), y: center.y + r * Math.sin(t) })
  }
  return out
}

export function edgesOf(poly: Vec2[]): Edge[] {
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length]! }))
}

export function centroid(poly: Vec2[]): Vec2 {
  let x = 0
  let y = 0
  for (const p of poly) {
    x += p.x
    y += p.y
  }
  return { x: x / poly.length, y: y / poly.length }
}

/**
 * Kern des Bausystems: ein n-Eck so setzen, dass eine seiner Kanten exakt auf `edge` liegt —
 * und zwar auf der Aussenseite des Moduls, zu dem `edge` gehoert.
 *
 * Weil ein regelmaessiges n-Eck rotationssymmetrisch ist, gibt es pro Kante genau EINE
 * moegliche Platzierung. Deshalb muss der Spieler nie drehen oder feinpositionieren.
 */
export function attachTo(n: number, edge: Edge): { center: Vec2; rotation: number } {
  const d = normalize(sub(edge.b, edge.a))
  const outward: Vec2 = { x: d.y, y: -d.x }
  const center = add(mid(edge.a, edge.b), scale(outward, apothem(n)))
  // Das neue Modul muss dieselbe Kante rueckwaerts enthalten (b -> a), damit es selbst
  // positiv orientiert ist. Also liegt b auf der ersten Ecke.
  const rotation = Math.atan2(edge.b.y - center.y, edge.b.x - center.x)
  return { center, rotation }
}

// --- Kanten ----------------------------------------------------------------

/** Zwei Kanten gelten als geteilt, wenn ihre Endpunkte uebereinstimmen — Richtung egal. */
export function sameEdge(e1: Edge, e2: Edge, eps = EPS): boolean {
  return (
    (samePoint(e1.a, e2.a, eps) && samePoint(e1.b, e2.b, eps)) ||
    (samePoint(e1.a, e2.b, eps) && samePoint(e1.b, e2.a, eps))
  )
}

export function pointSegmentDistance(p: Vec2, e: Edge): number {
  const ab = sub(e.b, e.a)
  const l2 = ab.x * ab.x + ab.y * ab.y
  if (l2 < 1e-12) return dist(p, e.a)
  let t = ((p.x - e.a.x) * ab.x + (p.y - e.a.y) * ab.y) / l2
  t = Math.max(0, Math.min(1, t))
  return dist(p, add(e.a, scale(ab, t)))
}

// --- Ueberlappung und Treffer ----------------------------------------------

/** Polygon zum Mittelpunkt hin schrumpfen, damit Beruehrung nicht als Ueberlappung zaehlt. */
function erode(poly: Vec2[], factor = 0.997): Vec2[] {
  const c = centroid(poly)
  return poly.map(p => add(c, scale(sub(p, c), factor)))
}

function projectionRange(poly: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const p of poly) {
    const v = p.x * axis.x + p.y * axis.y
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

/**
 * Separating-Axis-Test fuer konvexe Polygone. Beide werden zuvor minimal geschrumpft:
 * kantenbuendig angesteckte Module beruehren sich, ueberlappen aber nicht.
 */
export function polygonsOverlap(p1: Vec2[], p2: Vec2[]): boolean {
  const c1 = centroid(p1)
  const c2 = centroid(p2)
  // Grobpruefung ueber Umkreise: SIDE ist fuer alle gleich, der groesste Umkreis ist der des 6-Ecks.
  if (dist(c1, c2) > 2 * circumradius(6) + EPS) return false

  const a = erode(p1)
  const b = erode(p2)

  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!
      const q = poly[(i + 1) % poly.length]!
      const axis = normalize({ x: -(q.y - p.y), y: q.x - p.x })
      const ra = projectionRange(a, axis)
      const rb = projectionRange(b, axis)
      if (ra.max < rb.min || rb.max < ra.min) return false
    }
  }
  return true
}

/** Punkt-in-Polygon fuer konvexe, positiv orientierte Polygone. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross < 0) return false
  }
  return true
}

/** Vorzeichenbehaftete Flaeche — positiv bei korrekter Orientierung. Nur fuer Selbsttests. */
export function signedArea(poly: Vec2[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

