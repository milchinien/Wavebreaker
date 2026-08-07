/**
 * Deterministischer Zufall.
 *
 * Regel aus dem Implementierungsplan (Abschnitt 3 und 9): `Math.random()` kommt im
 * ganzen Spiel nur in dieser Datei vor, und zwar ausschliesslich zum Ziehen eines
 * Startwerts fuer einen neuen Run. Alles andere laeuft ueber einen Generator mit Seed,
 * dessen Zustand im Spielstand liegt - sonst ist ein Balancing-Fehler nicht nachstellbar.
 *
 * Verfahren: mulberry32. Ein einziger 32-Bit-Zustand, damit der Spielstand ihn als
 * eine Zahl mitfuehren kann.
 */

export type Rng = {
  /** Gleichverteilt in [0, 1). */
  next(): number
  /** Ganze Zahl von `min` bis `max`, **beide Grenzen eingeschlossen**. */
  int(min: number, max: number): number
  /** Gleitkommazahl in [min, max). */
  range(min: number, max: number): number
  /** Ein Element der Liste. Wirft bei leerer Liste. */
  pick<T>(items: readonly T[]): T
  /** `true` mit Wahrscheinlichkeit `p` (0..1). */
  chance(p: number): boolean
  /** Liste an Ort und Stelle mischen (Fisher-Yates). Gibt dieselbe Liste zurueck. */
  shuffle<T>(items: T[]): T[]
  /** Aktueller Zustand - gehoert in den Spielstand. */
  state(): number
  /** Zustand setzen, z. B. beim Laden. */
  setState(state: number): void
  /**
   * Abgeleiteter Generator. Wichtig, damit unabhaengige Systeme (Wellenaufbau,
   * Raritaeten, Ereignisse) sich nicht gegenseitig die Zahlenfolge verschieben.
   */
  fork(salt: number): Rng
}

const UINT32 = 4294967296

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / UINT32
  }

  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) [min, max] = [max, min]
      const lo = Math.ceil(min)
      const hi = Math.floor(max)
      if (hi < lo) return lo
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    range(min, max) {
      return min + next() * (max - min)
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: leere Liste')
      const item = items[Math.floor(next() * items.length)]
      // Der Index liegt immer im Bereich; die Pruefung beruhigt nur den Typpruefer.
      return item as (typeof items)[number]
    },
    chance(p) {
      if (p <= 0) return false
      if (p >= 1) return true
      return next() < p
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const a = items[i] as (typeof items)[number]
        const b = items[j] as (typeof items)[number]
        items[i] = b
        items[j] = a
      }
      return items
    },
    state: () => state,
    setState(value) {
      state = value >>> 0
    },
    fork(salt) {
      return createRng((state ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0)
    },
  }

  return rng
}

/**
 * Startwert fuer einen neuen Run. Die **einzige** erlaubte Verwendung von
 * `Math.random()` im Spiel.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * UINT32) >>> 0
}
