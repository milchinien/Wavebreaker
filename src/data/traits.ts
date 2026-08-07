/**
 * Turm-Eigenschaften (GDD 06 Abschnitt 10).
 *
 * Sie sind das, was zwei Tuerme derselben Art und derselben Raritaet **unterschiedlich**
 * macht. Ohne sie waere ein zweites Legendary-Maschinengewehr nur eine Kopie des ersten,
 * und der Turmkauf verloere seinen Reiz.
 *
 * Zwei Achsen bestimmen, was ein Turm ziehen kann:
 *
 *   **Anzahl** aus der Raritaet - 0/1/2/3/4 (`TRAIT_SLOTS` in `data/rarities.ts`)
 *   **Qualitaet** aus dem Prestige-Baum - erst mit "Rare Eigenschaften" gibt es ueberhaupt
 *   welche, dann Epic, Legendary, Mythic (GDD 10, Bereich 6)
 *
 * Ein Legendary-Turm mit drei Plaetzen zieht also nur dann legendaere Effekte, wenn diese
 * Stufe freigeschaltet ist - sonst fuellt er seine Plaetze mit schwaecheren.
 *
 * **Es steht hier nur, was das Spiel heute auch wirklich tut.** GDD 06 Abschnitt 10 nennt
 * bei Legendary und Mythic ausdruecklich *Mechaniken*: explodierende Projektile,
 * Durchschuss, Spezialangriffe. Die brauchen `applyExplosion` und `applyChain` aus E14.
 * Bis dahin sind die hohen Stufen **grosse Werte** statt neuer Mechanik - das ist ehrlich
 * gestaffelt und wird spaeter zu weiteren Eintraegen in dieser Datei, nicht zu neuem Code.
 */

import type { Category, Rarity, StatKey } from './types.ts'

/** Qualitaetsstufen einer Eigenschaft. Common bringt keine mit (GDD 06 Abschnitt 10). */
export type TraitTier = Exclude<Rarity, 'common'>

/**
 * Was eine Eigenschaft tut.
 *
 * `buffPower` gibt es, weil Buff-Module **keine eigenen Kampfwerte haben**. Ein
 * Schadens-Bonus waere dort wirkungslos, und ein Turm mit wirkungslosen Eigenschaften ist
 * ein Fehler, kein Turm. Deshalb wirkt bei ihnen die Eigenschaft auf die Buffstaerke -
 * dieselbe Stelle, an der auch schon ihre Raritaet wirkt (`sim/buffs.ts`).
 */
export type TraitEffect =
  | { kind: 'stat'; stat: StatKey; amount: number }
  | { kind: 'buffPower'; amount: number }

export type TraitDef = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  label: string
  tier: TraitTier
  /** Auf welche Modulaufgaben die Eigenschaft passt. */
  categories: readonly Category[]
  effect: TraitEffect
}

/** Kampfwert-Eigenschaft. Passt auf alles, was selbst schiesst. */
function combat(
  id: string,
  label: string,
  tier: TraitTier,
  stat: StatKey,
  amount: number,
): TraitDef {
  return {
    id,
    label,
    tier,
    categories: ['attack', 'area', 'special', 'support'],
    effect: { kind: 'stat', stat, amount },
  }
}

/** Buff-Eigenschaft. Passt nur auf Verstaerker. */
function amplify(id: string, label: string, tier: TraitTier, amount: number): TraitDef {
  return { id, label, tier, categories: ['buff'], effect: { kind: 'buffPower', amount } }
}

/*
 * Die Betraege wachsen je Stufe grob um das Doppelte. GDD 06 Abschnitt 10 nennt als
 * Beispiele "+10 % Schaden" fuer Rare und "+20 % Schaden" fuer Epic - daran ist die
 * Staffelung ausgerichtet, und Legendary und Mythic setzen sie fort.
 */
export const TRAITS: readonly TraitDef[] = [
  // --- Rare: spuerbare Boni ---
  combat('trait.damage.r', 'Damage +10%', 'rare', 'damage', 0.1),
  combat('trait.rate.r', 'Attack rate +10%', 'rare', 'attackSpeed', 0.1),
  combat('trait.range.r', 'Range +10%', 'rare', 'range', 0.1),
  combat('trait.velocity.r', 'Projectile speed +15%', 'rare', 'projectileSpeed', 0.15),
  amplify('trait.power.r', 'Buff strength +10%', 'rare', 0.1),

  // --- Epic: starke Boni ---
  combat('trait.damage.e', 'Damage +20%', 'epic', 'damage', 0.2),
  combat('trait.rate.e', 'Attack rate +15%', 'epic', 'attackSpeed', 0.15),
  combat('trait.crit.e', 'Crit chance +8%', 'epic', 'critChance', 0.08),
  combat('trait.range.e', 'Range +18%', 'epic', 'range', 0.18),
  amplify('trait.power.e', 'Buff strength +22%', 'epic', 0.22),

  // --- Legendary: der Turm veraendert den Build ---
  combat('trait.damage.l', 'Damage +45%', 'legendary', 'damage', 0.45),
  combat('trait.rate.l', 'Attack rate +35%', 'legendary', 'attackSpeed', 0.35),
  combat('trait.crit.l', 'Crit chance +18%', 'legendary', 'critChance', 0.18),
  amplify('trait.power.l', 'Buff strength +45%', 'legendary', 0.45),

  // --- Mythic: aussergewoehnlich ---
  combat('trait.damage.m', 'Damage +90%', 'mythic', 'damage', 0.9),
  combat('trait.rate.m', 'Attack rate +70%', 'mythic', 'attackSpeed', 0.7),
  amplify('trait.power.m', 'Buff strength +90%', 'mythic', 0.9),
]

const BY_ID = new Map(TRAITS.map((trait) => [trait.id, trait]))

export function traitById(id: string): TraitDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekannte Eigenschaft: ${id}`)
  return def
}

export function isKnownTrait(id: string): boolean {
  return BY_ID.has(id)
}

/**
 * Welche Eigenschaften fuer diese Aufgabe und diesen Freischaltstand in Frage kommen.
 *
 * `unlocked` ist die hoechste freigeschaltete **Qualitaetsstufe** - alles darunter kommt
 * mit. Ohne jede Freischaltung ist die Liste leer, und ein Turm bekommt trotz freier
 * Plaetze keine Eigenschaften. Genau so steht es im GDD: Die Ebene der Eigenschaften ist
 * eine eigene Freischaltung, nicht ein Nebeneffekt der Raritaet.
 */
export function traitsFor(category: Category, unlocked: TraitTier | null): TraitDef[] {
  if (unlocked === null) return []
  const order: readonly TraitTier[] = ['rare', 'epic', 'legendary', 'mythic']
  const ceiling = order.indexOf(unlocked)
  return TRAITS.filter(
    (trait) => trait.categories.includes(category) && order.indexOf(trait.tier) <= ceiling,
  )
}

