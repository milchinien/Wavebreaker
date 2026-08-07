/**
 * Das Sortiment der Haendler-Drohne (GDD 11 Abschnitt 7).
 *
 * GDD 11 nennt vier Warenarten: Gold-Upgrades, temporaere Boni, seltene Verbesserungen und
 * spezielle Turmangebote. **Alle vier gibt es im Spiel schon** - als globales Upgrade (E8),
 * als Ereignis-Wirkung (E16), als Perk (E10) und als Turmangebot (E12). Genau deshalb steht
 * die Drohne erst jetzt hier: Frueher haette sie eigene Mechaniken gebraucht, heute ist sie
 * ein Datensatz, der vier vorhandene an einer Theke zusammenlegt.
 *
 * **Worin sie sich vom Turmkauf unterscheidet** - die Frage, die diesen Bereich lange offen
 * gehalten hat: Der Turmkauf verkauft **einen Wurf**, immer denselben, zu einem Preis, der
 * mit jedem Kauf steigt. Die Drohne verkauft **fertige Ware** zu einem Preis, der mit der
 * Welle steigt, und sie verkauft nicht nur Tuerme. Beim Turmkauf ist die Frage "noch ein
 * Turm oder Gold in die vorhandenen?"; hier ist sie "was von diesen drei Dingen brauche ich
 * gerade?". Das sind zwei verschiedene Entscheidungen, und deshalb duerfen beide stehen.
 *
 * Preise sind **Vielfache der Wellenbelohnung** (`eventRewardFor` in `data/balance.ts`),
 * nicht feste Betraege - dieselbe Regel wie bei Ereignissen und Kapseln. Ein fester Betrag
 * waere auf Welle 5 unbezahlbar und auf Welle 500 geschenkt.
 */

import type { Rarity, StatKey } from './types.ts'

/** Was ein Posten liefert. Vier Formen - je eine je Warenart aus GDD 11 Abschnitt 7. */
export type TraderEffect =
  /** Kostenlose Stufen auf einem zufaelligen globalen Upgrade-Pfad. */
  | { kind: 'upgrade'; levels: number }
  /** Ein zeitlich begrenzter Wertbonus - dieselbe Wirkung wie aus einem Ereignis. */
  | { kind: 'boon'; stats: Partial<Record<StatKey, number>>; duration: number }
  /** Ein Perk fuer den laufenden Run. Welcher, steht schon beim Landen fest. */
  | { kind: 'perk' }
  /** Ein Turmangebot, wahlweise mit angehobener Untergrenze der Raritaet. */
  | { kind: 'tower'; floor?: Rarity }

export type TraderStockDef = {
  id: string
  label: string
  description: string
  /** Faerbt die Karte - dieselbe Sprache wie bei Tuermen und Perks (GDD 13 Abschnitt 7). */
  rarity: Rarity
  weight: number
  minWave: number
  /** Preis als Vielfaches der Wellenbelohnung. */
  price: number
  effect: TraderEffect
}

/*
 * Zehn Posten, aus denen drei gezogen werden.
 *
 * Die Preise steigen mit dem Nutzen, die Gewichte fallen mit ihm - Alltagsware ist billig
 * und haeufig, der Gluecksgriff teuer und selten. Turmangebote kommen erst spaeter: Vor
 * Welle 20 hat der Spieler kaum Turmplaetze, und eine Ware, die man nicht unterbringen
 * kann, ist keine.
 */
export const TRADER_STOCK: readonly TraderStockDef[] = [
  {
    id: 'trade.upgrade1',
    label: 'Surplus Parts',
    description: 'One free level on a station upgrade.',
    rarity: 'common',
    weight: 26,
    minWave: 1,
    price: 2,
    effect: { kind: 'upgrade', levels: 1 },
  },
  {
    id: 'trade.upgrade3',
    label: 'Salvage Crate',
    description: 'Three free levels on a station upgrade.',
    rarity: 'rare',
    weight: 14,
    minWave: 10,
    price: 5,
    effect: { kind: 'upgrade', levels: 3 },
  },
  {
    id: 'trade.boonDamage',
    label: 'Overtuned Rounds',
    description: '+40% damage for 120 seconds.',
    rarity: 'rare',
    weight: 18,
    minWave: 1,
    price: 3,
    effect: { kind: 'boon', stats: { damage: 0.4 }, duration: 120 },
  },
  {
    id: 'trade.boonRate',
    label: 'Coolant Charge',
    description: '+40% attack rate for 120 seconds.',
    rarity: 'rare',
    weight: 18,
    minWave: 1,
    price: 3,
    effect: { kind: 'boon', stats: { attackSpeed: 0.4 }, duration: 120 },
  },
  {
    id: 'trade.boonAll',
    label: 'Combat Stimulant',
    description: '+25% damage, attack rate and range for 90 seconds.',
    rarity: 'epic',
    weight: 9,
    minWave: 12,
    price: 6,
    effect: {
      kind: 'boon',
      stats: { damage: 0.25, attackSpeed: 0.25, range: 0.25 },
      duration: 90,
    },
  },
  {
    id: 'trade.perk',
    label: 'Field Retrofit',
    description: 'A permanent upgrade for this run.',
    rarity: 'epic',
    weight: 12,
    minWave: 5,
    price: 7,
    effect: { kind: 'perk' },
  },
  {
    id: 'trade.tower',
    label: 'Tower Consignment',
    description: 'Two towers to choose from — no draw fee.',
    rarity: 'legendary',
    weight: 8,
    minWave: 20,
    price: 8,
    effect: { kind: 'tower' },
  },
  {
    id: 'trade.towerRare',
    label: 'Prototype Consignment',
    description: 'Two towers, epic or better.',
    rarity: 'mythic',
    weight: 3,
    minWave: 40,
    price: 16,
    effect: { kind: 'tower', floor: 'epic' },
  },
]

const BY_ID = new Map(TRADER_STOCK.map((entry) => [entry.id, entry]))

export function traderStockById(id: string): TraderStockDef {
  const entry = BY_ID.get(id)
  if (!entry) throw new Error(`Unbekannte Handelsware: ${id}`)
  return entry
}

export function isKnownTraderStock(id: string): boolean {
  return BY_ID.has(id)
}

/** Ware, die auf dieser Welle ueberhaupt angeboten werden darf. */
export function stockForWave(wave: number): TraderStockDef[] {
  return TRADER_STOCK.filter((entry) => wave >= entry.minWave)
}

