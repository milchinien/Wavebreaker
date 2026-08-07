/**
 * Level-Perks als Datensaetze (GDD 09 Teil A).
 *
 * Ein Perk ist eine **Verbesserung fuer den laufenden Run**, die auf die gesamte Basis
 * wirkt und beim Prestige verschwindet (GDD 09 Abschnitt 3 und 5). Damit ist er das
 * Gegenstueck zum Turm-Upgrade: gekauft gegen gewaehlt, ein Turmtyp gegen alle Tuerme.
 *
 * **Es steht hier nur, was das Spiel heute auch wirklich tut.** GDD 09 Abschnitt 3 listet
 * daneben Durchschuss, Abpraller, Verbrennung, Explosion und Kettenenergie. Alle fuenf
 * brauchen eine Mechanik, die es noch nicht gibt - sie kommt laut Implementierungsplan
 * mit E14 (`applyChain`, `applyBurn`, `applyExplosion`). Sie hier schon anzubieten hiesse,
 * dem Spieler eine Wahl zu geben, die nichts bewirkt; das waere schlimmer als eine kuerzere
 * Liste. Sobald die Mechanik steht, sind es weitere Eintraege in dieser Datei und kein
 * neuer Code.
 *
 * Ein Perk kann **mehrfach** gezogen werden. Die Betraege summieren sich - deshalb tragen
 * sie kleine Zahlen und keine Verdopplungen.
 */

import type { Rarity, StatKey } from './types.ts'

/** Worauf ein Perk wirkt, das nicht ein einzelner Kampfwert ist. */
export type PerkGlobal = 'stationHp' | 'goldBonus' | 'collectRadius' | 'xpBonus'

/**
 * Wirkung eines Perks. Zwei Formen, mehr braucht es nicht:
 *
 *   `stat`    ein Kampfwert **aller** Module - fliesst in `sim/stats.ts` in dieselbe
 *             Kette wie Upgrades und Buffs
 *   `global`  eine Groesse des Runs - Stations-HP, Gold, Sammelradius, Erfahrung
 */
export type PerkEffect =
  | { kind: 'stat'; stat: StatKey; amount: number }
  | { kind: 'global'; global: PerkGlobal; amount: number }

export type PerkDef = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  label: string
  /**
   * Seltenheit. Dieselben fuenf Stufen wie bei Tuermen (GDD 13 Abschnitt 7), damit die
   * Farbe im Auswahlfenster dasselbe bedeutet wie ueberall sonst.
   */
  rarity: Rarity
  /** Relatives Gewicht in der Auswahl. Groesser = haeufiger. */
  weight: number
  effect: PerkEffect
}

/**
 * Ein Kampfwert-Perk. Kurzform, weil sich sonst dieselben fuenf Zeilen einundzwanzigmal
 * wiederholen und man die eigentliche Aussage - Wert, Betrag, Haeufigkeit - nicht mehr sieht.
 */
function stat(
  id: string,
  label: string,
  rarity: Rarity,
  weight: number,
  key: StatKey,
  amount: number,
): PerkDef {
  return { id, label, rarity, weight, effect: { kind: 'stat', stat: key, amount } }
}

function global(
  id: string,
  label: string,
  rarity: Rarity,
  weight: number,
  key: PerkGlobal,
  amount: number,
): PerkDef {
  return { id, label, rarity, weight, effect: { kind: 'global', global: key, amount } }
}

/*
 * Die Gewichte fallen mit der Seltenheit steil ab: Ein episches Angebot ist rund siebenmal
 * seltener als ein gewoehnliches, ein legendaeres rund fuenfundzwanzigmal. Damit bleibt ein
 * legendaerer Perk das, was GDD 09 Abschnitt 3 von ihm verlangt - etwas, das den ganzen
 * Build veraendert und an das man sich erinnert.
 */
export const PERKS: readonly PerkDef[] = [
  // --- Offensiv ---
  stat('perk.damage.1', 'Damage +8%', 'common', 100, 'damage', 0.08),
  stat('perk.damage.2', 'Damage +18%', 'rare', 44, 'damage', 0.18),
  stat('perk.damage.3', 'Damage +35%', 'epic', 14, 'damage', 0.35),
  stat('perk.damage.4', 'Damage +80%', 'legendary', 4, 'damage', 0.8),
  stat('perk.crit.1', 'Crit chance +4%', 'common', 70, 'critChance', 0.04),
  stat('perk.crit.2', 'Crit chance +9%', 'rare', 30, 'critChance', 0.09),

  // --- Angriffstempo ---
  stat('perk.rate.1', 'Attack rate +7%', 'common', 100, 'attackSpeed', 0.07),
  stat('perk.rate.2', 'Attack rate +16%', 'rare', 44, 'attackSpeed', 0.16),
  stat('perk.rate.3', 'Attack rate +30%', 'epic', 14, 'attackSpeed', 0.3),
  stat('perk.rate.4', 'Attack rate +70%', 'legendary', 4, 'attackSpeed', 0.7),

  // --- Projektil ---
  stat('perk.projectile.1', 'Projectile speed +12%', 'common', 60, 'projectileSpeed', 0.12),
  stat('perk.projectile.2', 'Projectile speed +25%', 'rare', 24, 'projectileSpeed', 0.25),

  // --- Reichweite ---
  stat('perk.range.1', 'Range +6%', 'common', 70, 'range', 0.06),
  stat('perk.range.2', 'Range +14%', 'rare', 28, 'range', 0.14),

  // --- Defensiv ---
  global('perk.hull.1', 'Station hull +10%', 'common', 90, 'stationHp', 0.1),
  global('perk.hull.2', 'Station hull +22%', 'rare', 38, 'stationHp', 0.22),
  global('perk.hull.3', 'Station hull +45%', 'epic', 12, 'stationHp', 0.45),

  // --- Wirtschaft ---
  global('perk.gold.1', 'Gold +10%', 'common', 80, 'goldBonus', 0.1),
  global('perk.gold.2', 'Gold +22%', 'rare', 32, 'goldBonus', 0.22),
  global('perk.xp.1', 'Experience +12%', 'common', 70, 'xpBonus', 0.12),
  global('perk.radius.1', 'Collect radius +15%', 'common', 55, 'collectRadius', 0.15),
]

/**
 * Der Textschluessel zur ausfuehrlichen Auskunft ueber einen Perk.
 *
 * Er wird aus der **Wirkung** gebildet, nicht aus der Kennung: "Damage +8%" und
 * "Damage +80%" tun dasselbe, nur verschieden stark - sie brauchen deshalb einen
 * Erklaerungstext und nicht einundzwanzig. Ein neuer Betrag kostet damit keine Zeile in
 * `data/strings.ts`, eine neue **Wirkung** genau eine.
 *
 * Steht hier und nicht in `ui/dialogs.ts`, weil das Wissen "welche Wirkungen gibt es"
 * dieser Datei gehoert. Der Selbsttest prueft von hier aus, dass zu jeder Wirkung ein Text
 * existiert - sonst faende man die Luecke erst im Fenster, als roher Schluessel.
 */
export type PerkInfoKey = `perk.info.${StatKey | PerkGlobal}`

export function perkInfoKey(effect: PerkEffect): PerkInfoKey {
  return `perk.info.${effect.kind === 'stat' ? effect.stat : effect.global}`
}

const BY_ID = new Map(PERKS.map((perk) => [perk.id, perk]))

export function perkById(id: string): PerkDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekannter Perk: ${id}`)
  return def
}

export function isKnownPerk(id: string): boolean {
  return BY_ID.has(id)
}
