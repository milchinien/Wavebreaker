/**
 * Gemeinsame Vokabeln von Kernen und Tuermen.
 *
 * Trennung aus Prototyp 01 (PLAN.md Abschnitt 4.3), die sich bewaehrt hat:
 *   Grundflaeche (3-6 Kanten) = Geometrie **und** Anzahl der Anschlusskanten, echte Mechanik
 *   Emblem                    = Zeichen im Inneren, reine Wiedererkennung
 *
 * Damit lassen sich die im GDD genannten Formen "Kreis" und "Spezialform" darstellen, ohne
 * die Ansteck-Geometrie zu brechen (GDD 03 Abschnitt 3).
 */

/** Tatsaechliche Grundflaeche eines Moduls. Bestimmt zugleich die Zahl der Bauplaetze. */
export type FootprintSides = 3 | 4 | 5 | 6

/** Zeichen im Inneren eines Moduls. Waechst mit den Inhalten. */
export type Emblem = 'core' | 'bars' | 'chevron' | 'star'

/** Seltenheitsstufen (GDD 13 Abschnitt 7). Haupttuerme haben keine Raritaet (GDD 04 Abschnitt 2). */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && (RARITIES as readonly string[]).includes(value)
}

/**
 * Aufgabe eines Moduls. Bestimmt, ob es gebufft wird und ob es selbst bufft -
 * Buff-Tuerme verstaerken keine Buff-Tuerme (GDD 03 Abschnitt 9).
 */
export type Category = 'attack' | 'area' | 'special' | 'buff' | 'support'

export type StatKey = 'damage' | 'attackSpeed' | 'range' | 'critChance' | 'projectileSpeed'

export const STAT_KEYS: readonly StatKey[] = [
  'damage',
  'attackSpeed',
  'range',
  'critChance',
  'projectileSpeed',
]

export type CombatStats = Record<StatKey, number>

export function makeStats(
  damage: number,
  attackSpeed: number,
  range: number,
  critChance: number,
  projectileSpeed: number,
): CombatStats {
  return { damage, attackSpeed, range, critChance, projectileSpeed }
}

export const NO_STATS: CombatStats = makeStats(0, 0, 0, 0, 0)
