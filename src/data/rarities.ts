/**
 * Raritaeten: wie oft sie fallen und was sie mitbringen (GDD 06 Abschnitt 6 bis 10).
 *
 * Die Stufen selbst stehen in `data/types.ts` - sie sind eine Vokabel des ganzen Spiels.
 * Hier steht nur, was sie **wert** sind: wie wahrscheinlich sie beim Turmkauf erscheinen und
 * wie viele Eigenschaftsplaetze sie oeffnen.
 *
 * Die entscheidende Regel steht in GDD 06 Abschnitt 7: **Raritaeten sind nicht von Anfang an
 * verfuegbar.** Was fallen kann, haengt daran, wie weit der Prestige-Baum ausgebaut ist -
 * und das ist eine **Datenabfrage**, keine Verzweigung im Code (GDD 16 Abschnitt 2).
 */

import type { Rarity } from './types.ts'

/**
 * Wie viele zufaellige Eigenschaften eine Stufe oeffnet (GDD 06 Abschnitt 10).
 *
 * Common bekommt bewusst **null**: Ein gewoehnlicher Turm ist die reine Basisversion seines
 * Typs. Der Spieler lernt damit zuerst die Turmarten selbst kennen, und die Ebene der
 * Eigenschaften kommt erst mit der ersten Rare-Freischaltung dazu. Jede weitere Stufe legt
 * genau einen Platz drauf, wodurch der Sprung zwischen zwei Stufen sofort spuerbar ist.
 */
export const TRAIT_SLOTS: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
}

/**
 * Fallchancen je nachdem, bis wohin der Prestige-Baum die Raritaeten geoeffnet hat
 * (GDD 06 Abschnitt 8). Die Tabelle steht hier als Prozentwerte, genau wie im GDD.
 *
 * Mythic fehlt in der Tabelle des GDD mit der Bemerkung, es solle "extrem selten" bleiben
 * und ein besonderes Ereignis darstellen. Ein Prozent ist die Auslegung davon: Bei einem
 * Turmkauf alle paar Minuten sieht ein Spieler in einer langen Sitzung vielleicht einen.
 */
export const RARITY_CHANCE: Record<Rarity, Partial<Record<Rarity, number>>> = {
  common: { common: 100 },
  rare: { common: 80, rare: 20 },
  epic: { common: 65, rare: 25, epic: 10 },
  legendary: { common: 55, rare: 25, epic: 15, legendary: 5 },
  mythic: { common: 54, rare: 25, epic: 15, legendary: 5, mythic: 1 },
}

/**
 * Raritaetsgrenzen je Turmart (GDD 06 Abschnitt 9). Spezialtuerme bleiben selten - ein
 * Laser als Common gaebe es nicht.
 *
 * Eintraege fehlen absichtlich fuer Turmarten, die es noch nicht gibt: Sie kommen mit E14
 * dazu, und dann ist das hier eine Zeile und kein neuer Code. Wer nicht in der Tabelle
 * steht, darf die volle Spanne haben.
 */
export const RARITY_RANGE: Record<string, { min: Rarity; max: Rarity }> = {
  autocannon: { min: 'common', max: 'mythic' },
  cannon: { min: 'common', max: 'legendary' },
  amplifier: { min: 'common', max: 'mythic' },
  // Spezialtuerme bleiben selten (GDD 06 Abschnitt 9): Ein Laser als Common gaebe es nicht.
  sniper: { min: 'common', max: 'legendary' },
  rocket: { min: 'rare', max: 'mythic' },
  flamer: { min: 'rare', max: 'mythic' },
  cryo: { min: 'rare', max: 'mythic' },
  laser: { min: 'epic', max: 'mythic' },
  tesla: { min: 'epic', max: 'mythic' },
  bulwark: { min: 'epic', max: 'mythic' },
  dronebay: { min: 'legendary', max: 'mythic' },
  plasma: { min: 'legendary', max: 'mythic' },
  void: { min: 'mythic', max: 'mythic' },
}

/** Reihenfolge der Stufen - Grundlage jedes Vergleichs "mindestens" und "hoechstens". */
const ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

export function rarityRank(rarity: Rarity): number {
  return ORDER.indexOf(rarity)
}

/** Die hoechste der beiden Stufen. */
export function maxRarity(a: Rarity, b: Rarity): Rarity {
  return rarityRank(a) >= rarityRank(b) ? a : b
}

/**
 * Welche Stufen fuer diese Turmart und diesen Freischaltstand ueberhaupt in Frage kommen,
 * samt Gewicht. Die Gewichte kommen aus `RARITY_CHANCE` und werden auf die zulaessige
 * Spanne der Turmart beschnitten.
 *
 * Faellt dabei alles weg - etwa ein Turm, der mindestens Epic verlangt, waehrend nur
 * Common freigeschaltet ist -, gibt die Funktion eine leere Liste zurueck. Der Aufrufer
 * darf diesen Turm dann gar nicht erst anbieten; ein Angebot, das man nicht annehmen kann,
 * waere schlimmer als eines weniger.
 */
export function rarityWeights(
  defId: string,
  unlocked: Rarity,
): { rarity: Rarity; weight: number }[] {
  const range = RARITY_RANGE[defId] ?? { min: 'common' as Rarity, max: 'mythic' as Rarity }
  const table = RARITY_CHANCE[unlocked]

  const result: { rarity: Rarity; weight: number }[] = []
  for (const rarity of ORDER) {
    if (rarityRank(rarity) < rarityRank(range.min)) continue
    if (rarityRank(rarity) > rarityRank(range.max)) continue
    const weight = table[rarity]
    if (weight === undefined || weight <= 0) continue
    result.push({ rarity, weight })
  }
  return result
}
