/**
 * Upgrade-Pfade (GDD 08 Abschnitt 5).
 *
 * Die wichtigste Regel steckt im Zuschnitt: **Turm-Upgrades gelten pro Turmtyp**, nicht
 * pro Einzelturm (GDD 08 Abschnitt 5.2). "Autocannon - Schaden +10 %" wirkt auf alle
 * Autocannons zugleich. Ohne das waere das Menue bei 15 Tuermen Mikromanagement, und die
 * Entscheidung "in welchen Turmtyp investiere ich?" gaebe es gar nicht.
 *
 * Verfuegbar sind zunaechst Schaden, Angriffstempo und HP (GDD 08 Abschnitt 8). Die
 * Spezialwerte je Turmart kommen mit den Tuermen in E14.
 */

import { TOWERS } from './towers.ts'
import type { StatKey } from './types.ts'

export type UpgradeScope = 'core' | 'tower' | 'global'

export type UpgradeDef = {
  /** Eindeutiger Pfad, z. B. `core.damage` oder `tower.autocannon.damage`. */
  id: string
  scope: UpgradeScope
  /** Bei `scope: 'tower'` die Turmart, auf die der Pfad wirkt. */
  defId?: string
  /** Bei Kampfwert-Upgrades der betroffene Wert. */
  stat?: StatKey
  /** Bei globalen Upgrades die Wirkung. */
  global?: 'stationHp' | 'goldBonus' | 'collectRadius'
  /**
   * Prestige-Knoten, der diesen Pfad sichtbar macht (GDD 12 Abschnitt 10).
   *
   * Ohne Angabe ist der Pfad immer da. Damit ist die zweistufige Freischaltung des Helfers
   * eine **Datenabfrage** und keine Fallunterscheidung im Menue: Der Baum macht kaufbar,
   * gekauft wird mit Gold.
   */
  unlock?: string
  label: string
  /** Zuwachs je Stufe, additiv auf den Multiplikator. 0.05 = +5 % je Stufe. */
  amount: number
  baseCost: number
  maxLevel: number
}

/** Kampfwerte, die es fuer den Kern und jede Turmart gibt. */
const COMBAT_PATHS: { stat: StatKey; label: string; amount: number; max: number }[] = [
  { stat: 'damage', label: 'Damage', amount: 0.05, max: 100 },
  { stat: 'attackSpeed', label: 'Attack rate', amount: 0.04, max: 60 },
  { stat: 'range', label: 'Range', amount: 0.03, max: 50 },
]

function buildUpgrades(): UpgradeDef[] {
  const list: UpgradeDef[] = []

  for (const path of COMBAT_PATHS) {
    list.push({
      id: `core.${path.stat}`,
      scope: 'core',
      stat: path.stat,
      label: path.label,
      amount: path.amount,
      baseCost: 80,
      maxLevel: path.max,
    })
  }

  for (const tower of TOWERS) {
    // Buff-Module haben keine eigenen Kampfwerte - Schaden und Tempo waeren dort wirkungslos.
    if (tower.category === 'buff') continue
    for (const path of COMBAT_PATHS) {
      list.push({
        id: `tower.${tower.id}.${path.stat}`,
        scope: 'tower',
        defId: tower.id,
        stat: path.stat,
        label: path.label,
        amount: path.amount,
        baseCost: 60,
        maxLevel: path.max,
      })
    }
  }

  list.push(
    {
      id: 'global.stationHp',
      scope: 'global',
      global: 'stationHp',
      label: 'Station HP',
      amount: 0.08,
      baseCost: 120,
      maxLevel: 100,
    },
    {
      id: 'global.goldBonus',
      scope: 'global',
      global: 'goldBonus',
      label: 'Gold bonus',
      amount: 0.06,
      baseCost: 150,
      maxLevel: 50,
    },
    {
      id: 'global.collectRadius',
      scope: 'global',
      global: 'collectRadius',
      label: 'Collect radius',
      amount: 0.1,
      baseCost: 100,
      maxLevel: 20,
    },
    /*
     * Der Goldsammler (GDD 12 Abschnitt 10 und 11).
     *
     * Er ist der einzige Pfad ohne `global`-Wirkung: Seine Stufe wird nicht in einen
     * Multiplikator gerechnet, sondern von `sim/helpers.ts` gelesen - Radius und Tempo des
     * Helfers haengen daran. Deshalb steht er trotzdem hier und nicht in einer eigenen
     * Liste: Fuer den Spieler ist es ein Upgrade wie jedes andere, und der Kauf laeuft
     * durch dieselbe Kostenkurve.
     */
    {
      id: 'global.collector',
      scope: 'global',
      unlock: 'helper.collector',
      label: 'Gold collector',
      amount: 0,
      baseCost: 500,
      maxLevel: 10,
    },
  )

  return list
}

export const UPGRADES: readonly UpgradeDef[] = buildUpgrades()

const BY_ID = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]))

export function upgradeById(id: string): UpgradeDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekannter Upgrade-Pfad: ${id}`)
  return def
}

export function isKnownUpgrade(id: string): boolean {
  return BY_ID.has(id)
}

export function upgradesForCore(): UpgradeDef[] {
  return UPGRADES.filter((upgrade) => upgrade.scope === 'core')
}

export function upgradesForTower(defId: string): UpgradeDef[] {
  return UPGRADES.filter((upgrade) => upgrade.scope === 'tower' && upgrade.defId === defId)
}

export function globalUpgrades(): UpgradeDef[] {
  return UPGRADES.filter((upgrade) => upgrade.scope === 'global')
}

