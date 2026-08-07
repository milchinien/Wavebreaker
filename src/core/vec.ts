/**
 * Vektorrechnung. Reine Mathematik ohne Spielwissen.
 *
 * Uebernommen aus Prototyp 01 - dort ueber 34.708 Platzierungen erprobt und im Spiel
 * unveraendert gueltig.
 */

export type Vec2 = { x: number; y: number }

export const vec = (x: number, y: number): Vec2 => ({ x, y })

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Vec2, factor: number): Vec2 => ({ x: a.x * factor, y: a.y * factor })
export const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

export function normalize(a: Vec2): Vec2 {
  const length = len(a)
  return length < 1e-12 ? { x: 0, y: 0 } : { x: a.x / length, y: a.y / length }
}

/** Senkrechte nach rechts. Bei positiv orientierten Polygonen zeigt sie nach aussen. */
export const perp = (a: Vec2): Vec2 => ({ x: a.y, y: -a.x })

export const samePoint = (a: Vec2, b: Vec2, epsilon: number): boolean => dist(a, b) < epsilon

/**
 * Rahmenratenunabhaengige Annaeherung. `rate` ist die Geschwindigkeit der Annaeherung;
 * das Ergebnis haengt nur von der verstrichenen Zeit ab, nicht von der Anzahl Schritte.
 */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt)
  return current + (target - current) * k
}
