import type { Vec2 } from './geometry'

/** Tatsaechliche Grundflaeche eines Moduls — bestimmt Geometrie UND Anzahl der Anschlusskanten. */
export type FootprintSides = 3 | 4 | 5 | 6

/** Zeichen im Inneren des Moduls. Reine Optik, dient der Wiedererkennung. */
export type Emblem = 'bars' | 'triangle' | 'circle' | 'ring' | 'star' | 'chevron' | 'shield' | 'core'

export type Category = 'attack' | 'area' | 'special' | 'buff' | 'support'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export type StatKey = 'damage' | 'attackSpeed' | 'range' | 'critChance' | 'projectileSpeed'
export type CombatStats = Record<StatKey, number>

export type TowerDef = {
  id: string
  /** Englisch — Spielsprache laut GDD 16 §1. */
  name: string
  sides: FootprintSides
  emblem: Emblem
  category: Category
  stats: CombatStats
  /** nur bei category 'buff': Wirkung auf kantenbenachbarte Nicht-Buff-Module */
  buffs?: { stat: StatKey; amount: number }[]
  /** nur bei category 'support': stationsweite Wirkung ohne Nachbarschaftsbezug */
  stationBonus?: { stationHp?: number }
  accent: string
  description: string
}

/** Platzierung in Weltkoordinaten, abgeleitet aus der Andockkante. */
export type Placement = { center: Vec2; rotation: number }

export type TowerInstance = {
  uid: string
  defId: string
  rarity: Rarity
  /** null = im Inventar */
  placement: Placement | null
  /** abgeleitet aus placement; leer, solange das Modul im Inventar liegt */
  poly: Vec2[]
}

export type Station = {
  core: TowerInstance
  placed: TowerInstance[]
  inventory: TowerInstance[]
  /** Turmplaetze; Start 4 laut GDD 03 §6. Der Hauptturm zaehlt nicht mit. */
  slots: number
}
