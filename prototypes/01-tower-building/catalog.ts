/**
 * Der einzige Ort mit Zahlen (GDD 16 §5). Ein neuer Turm ist ein Datensatz, kein Code.
 * Alle Werte sind Prototyp-Platzhalter — echtes Balancing gehoert nach GDD 15.
 */
import type { CombatStats, Rarity, StatKey, TowerDef, TowerInstance } from './model'

const stats = (
  damage: number,
  attackSpeed: number,
  range: number,
  critChance: number,
  projectileSpeed: number,
): CombatStats => ({ damage, attackSpeed, range, critChance, projectileSpeed })

const NONE = stats(0, 0, 0, 0, 0)

/** Der Hauptturm. Steht fest im Zentrum, ist nicht entfernbar (GDD 04 §1). */
export const CORE_DEF: TowerDef = {
  id: 'sentinel_core',
  name: 'Sentinel Core',
  sides: 6,
  emblem: 'core',
  category: 'attack',
  stats: stats(40, 1.6, 220, 0.1, 600),
  accent: '#7cf3ff',
  description: 'Ausgewogener Startkern. Steht immer im Zentrum und kann nicht entfernt werden.',
}

export const TOWERS: TowerDef[] = [
  {
    id: 'autocannon',
    name: 'Autocannon',
    sides: 4,
    emblem: 'bars',
    category: 'attack',
    stats: stats(8, 6, 140, 0.05, 520),
    accent: '#5ad2ff',
    description: 'Schnellfeuer. Wenig Schaden pro Schuss, sehr hohes Tempo.',
  },
  {
    id: 'siege_cannon',
    name: 'Siege Cannon',
    sides: 4,
    emblem: 'chevron',
    category: 'attack',
    stats: stats(90, 0.6, 200, 0.1, 300),
    accent: '#ff9d4a',
    description: 'Schweres Geschuetz. Hoher Schaden, langsam, gute Reichweite.',
  },
  {
    id: 'marksman',
    name: 'Marksman',
    sides: 3,
    emblem: 'triangle',
    category: 'attack',
    stats: stats(160, 0.35, 320, 0.25, 900),
    accent: '#c58bff',
    description: 'Langstrecke. Sehr hoher Einzelzielschaden, sehr langsam.',
  },
  {
    id: 'flamespire',
    name: 'Flamespire',
    sides: 3,
    emblem: 'ring',
    category: 'area',
    stats: stats(14, 3, 100, 0, 200),
    accent: '#ff6a4a',
    description: 'Flaechenschaden auf kurze Distanz.',
  },
  {
    id: 'rate_amplifier',
    name: 'Rate Amplifier',
    sides: 5,
    emblem: 'ring',
    category: 'buff',
    stats: NONE,
    buffs: [{ stat: 'attackSpeed', amount: 0.25 }],
    accent: '#3ddc84',
    description: 'Grundwert +25 % Angriffstempo fuer kantenbenachbarte Kampfmodule; Raritaet erhoeht ihn.',
  },
  {
    id: 'power_amplifier',
    name: 'Power Amplifier',
    sides: 5,
    emblem: 'star',
    category: 'buff',
    stats: NONE,
    buffs: [{ stat: 'damage', amount: 0.2 }],
    accent: '#ffd24a',
    description: 'Grundwert +20 % Schaden fuer kantenbenachbarte Kampfmodule; Raritaet erhoeht ihn.',
  },
  {
    id: 'bulwark',
    name: 'Bulwark Array',
    sides: 6,
    emblem: 'shield',
    category: 'support',
    stats: NONE,
    stationBonus: { stationHp: 400 },
    accent: '#8fa6ff',
    description: 'Erhoeht die gemeinsame Stations-HP. Kein Nachbarbuff.',
  },
  {
    id: 'drone_bay',
    name: 'Drone Bay',
    sides: 6,
    emblem: 'circle',
    category: 'special',
    stats: stats(12, 2, 160, 0.05, 260),
    accent: '#4affd0',
    description: 'Autonomes System. Im Prototyp nur Optik und Platzverbrauch.',
  },
]

export const TOWER_BY_ID = new Map<string, TowerDef>(TOWERS.map(t => [t.id, t]))

export function defOf(id: string): TowerDef {
  if (id === CORE_DEF.id) return CORE_DEF
  const def = TOWER_BY_ID.get(id)
  if (!def) throw new Error(`Unbekannte Turmart: ${id}`)
  return def
}

/** Gemeinsame Stations-HP ohne Support-Module (GDD 03 §5). Platzhalterwert. */
export const BASE_STATION_HP = 1000

/** Obergrenzen je Wert (GDD 03 §9 nennt +100 % Angriffstempo als Beispiel). */
export const BUFF_CAPS: Record<StatKey, number> = {
  attackSpeed: 1.0,
  damage: 1.0,
  range: 0.5,
  critChance: 0.25,
  projectileSpeed: 1.0,
}

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1.0,
  rare: 1.15,
  epic: 1.35,
  legendary: 1.6,
  mythic: 2.0,
}

/** Neonfarben laut GDD 13 §7. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa4bf',
  rare: '#3ddc84',
  epic: '#4aa3ff',
  legendary: '#ffc34a',
  mythic: '#ff3b6b',
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
}

let uidCounter = 0
export const nextUid = (): string => `t${++uidCounter}`

export function makeInstance(defId: string, rarity: Rarity): TowerInstance {
  return { uid: nextUid(), defId, rarity, placement: null, poly: [] }
}

/**
 * Startinventar. Feste Raritaeten statt Auswuerfeln — der Prototyp testet Bauen,
 * nicht Drop-Chancen. Bewusst mehr Module als Turmplaetze, damit die Auswahl wehtut.
 */
export function startingInventory(): TowerInstance[] {
  const spec: [string, Rarity][] = [
    ['autocannon', 'common'],
    ['autocannon', 'rare'],
    ['autocannon', 'epic'],
    ['siege_cannon', 'rare'],
    ['siege_cannon', 'legendary'],
    ['marksman', 'epic'],
    ['marksman', 'common'],
    ['flamespire', 'rare'],
    ['rate_amplifier', 'rare'],
    ['rate_amplifier', 'epic'],
    ['power_amplifier', 'legendary'],
    ['bulwark', 'epic'],
    ['drone_bay', 'mythic'],
  ]
  return spec.map(([id, rarity]) => makeInstance(id, rarity))
}
