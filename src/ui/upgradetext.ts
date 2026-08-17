/**
 * Was ein Upgrade in Zahlen bedeutet - fuer den Hinweis an der Kachel.
 *
 * Auf der Kachel steht seit E5 **nichts** ausser Bild und Rahmen (GDD 13 Abschnitt 6). Alles
 * Lesbare wandert in den Hinweis, und damit stellt sich eine Frage, die es beim alten Menue
 * nicht gab: Wie zeigt man sechzig verschiedene Wirkungen in **einer** Form?
 *
 * Die Antwort ist, den **Zuwachs** zu zeigen und nicht den Endwert:
 *
 *   Per level   +2 dmg
 *   Total       +20 dmg
 *
 * Der Endwert waere ehrlicher gewesen und war es beim alten Menue auch ("467 HP"). Er ist
 * aber nur dort zu bilden, wo genau **ein** Wert gemeint ist. "Alle Kinetic-Tuerme +4 %"
 * hat keinen Endwert - es hat je Turm einen anderen -, und ein Hinweis, der bei einem
 * Drittel der Kacheln eine Zeile weglaesst, ist schlechter als einer, der ueberall dasselbe
 * sagt. Der Zuwachs dagegen ist bei jeder der sechzig Kacheln dieselbe Aussage.
 *
 * **Die Einheit kommt nicht aus einer zweiten Tabelle**, wo immer es geht: Ob ein Betrag ein
 * Anteil ist, beantwortet `isFactor` in `data/upgrades.ts` - dieselbe Auskunft, die auch die
 * Rechenkette benutzt. Nur die restlichen Einheiten (Sekunden, Spruenge, Drohnen) stehen
 * hier, denn die kann man einem Betrag nicht ansehen.
 */

import { formatInt, formatPercent } from '../core/format.ts'
import { t, type StringKey } from '../data/strings.ts'
import {
  isFactor,
  type GlobalKey,
  type SpecialKey,
  type UpgradeDef,
  type UpgradeEffect,
  type UpgradeKind,
} from '../data/upgrades.ts'
import type { StatKey } from '../data/types.ts'

/** Textbaustein je Einheit. `{value}` traegt die Zahl. */
type UnitKey = Extract<StringKey, `upgrades.unit${string}`>

const STAT_UNIT: Record<StatKey, UnitKey> = {
  damage: 'upgrades.unitDamage',
  attackSpeed: 'upgrades.unitRate',
  range: 'upgrades.unitRange',
  // Trefferchance steht in Prozentpunkten - `isFactor` faengt das schon ab, der Eintrag
  // hier ist der Rueckfall.
  critChance: 'upgrades.unitPlain',
  projectileSpeed: 'upgrades.unitSpeed',
}

/**
 * Einheiten der Zaehlwerte.
 *
 * Faktoren fehlen hier absichtlich: Sie beantwortet `isFactor`, und ein zweiter Eintrag
 * koennte ihm widersprechen. Was hier steht, ist ausschliesslich die Frage "Sekunden oder
 * Meter oder Drohnen?".
 */
const COUNT_UNIT: Partial<Record<GlobalKey | SpecialKey, UnitKey>> = {
  hullFlat: 'upgrades.unitHp',
  hullPerTurret: 'upgrades.unitHp',
  hullPerShield: 'upgrades.unitHp',
  collectRadiusFlat: 'upgrades.unitRange',
  blastRadius: 'upgrades.unitRange',
  goldPerKill: 'upgrades.unitGold',
  goldPerWave: 'upgrades.unitGold',
  hullRegen: 'upgrades.unitRegen',
  towerSlots: 'upgrades.unitSlots',
  overdriveDuration: 'upgrades.unitSeconds',
  burnDuration: 'upgrades.unitSeconds',
  chillDuration: 'upgrades.unitSeconds',
  chainHops: 'upgrades.unitHops',
  droneCount: 'upgrades.unitDrones',
  droneDamage: 'upgrades.unitDamage',
  beamRamp: 'upgrades.unitDamage',
  coreDamagePerTurret: 'upgrades.unitDamage',
  supportNeighbourDamage: 'upgrades.unitDamage',
  collectorLevel: 'upgrades.unitPlain',
}

const KIND_NAME: Record<UpgradeKind, StringKey> = {
  endless: 'upgrades.kindEndless',
  extension: 'upgrades.kindExtension',
  charge: 'upgrades.kindCharge',
  directive: 'upgrades.kindDirective',
}

export function kindName(kind: UpgradeKind): string {
  return t(KIND_NAME[kind])
}

/**
 * Ein Betrag mit seiner Einheit und Vorzeichen - "+2 dmg", "+8 %", "+1 hops".
 *
 * `null` bei Regeln und Toren: Sie haben keinen Betrag, und eine erfundene Null waere die
 * unehrlichste aller Angaben.
 */
export function amountText(effect: UpgradeEffect, factor = 1): string | null {
  if (effect.kind === 'rule' || effect.kind === 'window') return null

  const value = effect.amount * factor
  if (isFactor(effect)) return formatPercent(value, { sign: true, decimals: decimalsFor(value) })

  const unit =
    effect.kind === 'flat' || effect.kind === 'percent'
      ? STAT_UNIT[effect.stat]
      : (COUNT_UNIT[effect.key] ?? 'upgrades.unitPlain')

  const sign = value > 0 ? '+' : ''
  return `${sign}${t(unit, { value: numberText(value) })}`
}

/**
 * Wie viele Nachkommastellen ein Prozentwert braucht.
 *
 * Ein Prozent Trefferchance je Stufe waere als "0 %" keine Auskunft, sondern eine
 * Verneinung. Zwanzig Stufen davon sind glatte "20 %" und brauchen keine.
 */
function decimalsFor(value: number): number {
  const percent = Math.abs(value) * 100
  return percent > 0 && percent < 1 ? 1 : 0
}

/** Zaehlwerte ganzzahlig, ausser sie waeren dann null - "0,1/sec" ist eine Aussage. */
function numberText(value: number): string {
  if (Number.isInteger(value)) return formatInt(value)
  return Math.abs(value) < 1 ? String(Math.round(value * 100) / 100) : formatInt(value)
}

/** Was der Pfad **insgesamt** bringt, bei der aktuellen Stufe. `null` ohne Stufe. */
export function totalText(def: UpgradeDef, level: number): string | null {
  if (level <= 0) return null
  return amountText(def.effect, level)
}
