/**
 * Symbole und Raritaetsrahmen der Oberflaeche.
 *
 * Quelle sind die Pixel-Symbole aus `assets/raw` - benutzt werden sie aber **als Maske**,
 * nicht als Bild: Die Datei liefert nur die Form, die Farbe kommt aus der Palette. Damit
 * traegt ein Symbol immer genau die Farbe seiner Bedeutung (Kern cyan, Station gold,
 * Verstaerker violett) und nicht die Farbe, die der Zeichner zufaellig gewaehlt hat.
 *
 * Die Raritaetsrahmen dagegen kommen unveraendert aus dem Rahmensatz - sie sind bereits in
 * den fuenf Stufenfarben gezeichnet (GDD 13 Abschnitt 7).
 *
 * Benutzte Dateien liegen in `public/`, damit sie der Auslieferung beiliegen. `assets/raw`
 * bleibt die unangetastete Quelle.
 */

import { TOWERS } from '../data/towers.ts'
import type { Rarity, StatKey } from '../data/types.ts'
import { PALETTE, RARITY_COLOR } from '../render/theme.ts'

export type IconName =
  | 'turret'
  | 'modules'
  | 'upgrade'
  | 'settings'
  | 'damage'
  | 'rate'
  | 'range'
  | 'hull'
  | 'gold'
  | 'radius'
  | 'autocannon'
  | 'cannon'
  | 'amplifier'
  | 'boss'
  // Aus der Game-UI-Sammlung (`docs/anlagen.md`) - klare Linienzeichen, die auch gross
  // sauber bleiben. Die Pixel-Skillicons daneben zerfallen ueber 32 Pixel.
  | 'coin'
  | 'prev'
  | 'next'
  | 'combat'
  | 'base'
  | 'gear'
  | 'crosshair'
  | 'bullet'

/**
 * Symbole, die aus der Game-UI-Sammlung stammen. Sie sind aus Vektoren gerechnet und
 * duerfen deshalb jede Groesse annehmen - die Pixel-Skillicons duerfen das nicht.
 */
const SMOOTH: ReadonlySet<IconName> = new Set<IconName>([
  'coin',
  'prev',
  'next',
  'combat',
  'base',
  'gear',
  'crosshair',
  'bullet',
])

/**
 * Ein Symbol als Baustein fuer `innerHTML`.
 *
 * Die Pixelvorlagen sind 32 Pixel breit; jede Groesse dazwischen zerlegt das Raster und
 * macht die Kanten weich. Deshalb rasten sie auf 16 oder 32 ein. Die glatten Zeichen aus
 * der Game-UI-Sammlung haben dieses Problem nicht und nehmen die Groesse, die dasteht.
 */
export function icon(name: IconName, size = 16): string {
  const exact = SMOOTH.has(name) ? size : size >= 24 ? 32 : 16
  return `<i class="pix" style="--icon:url('/icons/${name}.png');--pix-size:${exact}px"></i>`
}

/**
 * Kachel aus Raritaetsrahmen und Symbol - so steht ein Turm im Lager.
 * Der Hauptturm hat keine Seltenheit (GDD 04 Abschnitt 2) und bekommt den schlichtesten
 * Rahmen, aber die Leitfarbe der Station.
 */
export function moduleTile(
  name: IconName,
  rarity: Rarity | null,
  size = 16,
  /**
   * Eigene Leitfarbe statt der Raritaetsfarbe. Fuer alles, was ueberhaupt keine Seltenheit
   * hat und trotzdem eine Farbe traegt - eine Ereignisoption etwa ist sicher oder riskant,
   * und das ist ihre Farbe.
   */
  tone?: string,
): string {
  const frame = rarity ?? 'common'
  const color = tone ?? (rarity ? RARITY_COLOR[rarity] : PALETTE.edge)
  return (
    `<span class="tile" style="--frame:url('/frames/${frame}.png');color:${color}">` +
    `${icon(name, size)}</span>`
  )
}

/**
 * Turmart -> Symbol. Der Hauptturm ist der Geschuetzturm selbst.
 *
 * Die Tuerme aus E14 borgen sich das Zeichen, das ihrer Aufgabe am naechsten kommt - eigene
 * Zeichnungen kommen mit der Politur. Eine unbekannte Turmart bekommt den Geschuetzturm
 * statt eines Fehlers: Ein fehlendes Bild darf nie eine leere Kachel ergeben.
 */
const TOWER_ICON: Record<string, IconName> = {
  autocannon: 'autocannon',
  cannon: 'cannon',
  amplifier: 'amplifier',
  sniper: 'range',
  rocket: 'damage',
  laser: 'rate',
  tesla: 'amplifier',
  flamer: 'damage',
  cryo: 'radius',
  bulwark: 'hull',
  plasma: 'boss',
  void: 'crosshair',
  dronebay: 'modules',
}

export function towerIcon(defId: string, kind: 'core' | 'tower'): IconName {
  if (kind === 'core') return 'turret'
  return TOWER_ICON[defId] ?? 'turret'
}

/** Kampfwert -> Symbol. Reichweite als Fadenkreuz, Tempo als Doppelpfeil. */
export const STAT_ICON: Record<StatKey, IconName> = {
  damage: 'damage',
  attackSpeed: 'rate',
  range: 'range',
  critChance: 'damage',
  projectileSpeed: 'rate',
}

/** Globale Upgrades -> Symbol. Gold traegt dieselbe Muenze wie die Anzeige oben links. */
export const GLOBAL_ICON: Record<'stationHp' | 'goldBonus' | 'collectRadius', IconName> = {
  stationHp: 'hull',
  goldBonus: 'coin',
  collectRadius: 'radius',
}

/**
 * Faehigkeit -> Symbol (GDD 09 Abschnitt 10).
 *
 * Die Zuordnung steht hier und nicht in `data/abilities.ts`, weil `data/` nichts aus `ui/`
 * zieht - dieselbe Regel, aus der auch die Farben dort als Zeichenketten stehen. Eine
 * unbekannte Faehigkeit bekommt das allgemeine Verbesserungszeichen statt eines Fehlers:
 * Ein fehlendes Bild darf nie eine leere Schaltflaeche ergeben.
 */
const ABILITY_ICON: Record<string, IconName> = {
  overload: 'rate',
  shield: 'hull',
  orbital: 'crosshair',
  timewarp: 'radius',
  repair: 'amplifier',
}

export function abilityIcon(id: string): IconName {
  return ABILITY_ICON[id] ?? 'upgrade'
}

/**
 * Warenart der Drohne -> Symbol (GDD 11 Abschnitt 7).
 *
 * Vier Arten, vier Zeichen - der Spieler soll an der Kachel erkennen, **was** er kauft,
 * bevor er den Namen liest. Die Zuordnung steht aus demselben Grund hier wie die der
 * Faehigkeiten: `data/` zieht nichts aus `ui/`.
 */
const TRADE_ICON: Record<string, IconName> = {
  upgrade: 'upgrade',
  boon: 'rate',
  perk: 'amplifier',
  tower: 'modules',
}

export function tradeIcon(kind: string): IconName {
  return TRADE_ICON[kind] ?? 'upgrade'
}

/**
 * Worauf ein Perk wirkt -> Symbol (GDD 09 Abschnitt 4).
 *
 * Kampfwert-Perks borgen sich das Zeichen des Werts, den sie anheben - ein Schaden-Perk
 * traegt dasselbe Zeichen wie die Schadenszeile im Moduldetail. Nur die Run-Groessen
 * brauchen eigene Eintraege; `xpBonus` hat noch kein eigenes Bild und nimmt das allgemeine
 * Verbesserungszeichen.
 */
const PERK_GLOBAL_ICON: Record<string, IconName> = {
  stationHp: 'hull',
  goldBonus: 'coin',
  collectRadius: 'radius',
  xpBonus: 'upgrade',
}

export function perkIcon(kind: 'stat' | 'global', key: string): IconName {
  if (kind === 'stat') return STAT_ICON[key as StatKey] ?? 'upgrade'
  return PERK_GLOBAL_ICON[key] ?? 'upgrade'
}

/**
 * Prestige-Knoten -> Symbol (GDD 10 Abschnitt 6).
 *
 * Die Regel dahinter: **Ein Knoten traegt das Zeichen dessen, was er freischaltet.** Eine
 * Technologie zeigt deshalb den Turm, der danach im Handel steht - dasselbe Zeichen, unter
 * dem er hinterher im Lager und im Upgrade-Menue liegt. Das steht nicht in der Tabelle,
 * sondern wird an `data/towers.ts` **erfragt**: Ein neuer Spezialturm bringt sein Zeichen
 * mit, ohne dass hier eine Zeile dazukommt.
 *
 * In der Tabelle steht nur, was nichts Sichtbares freischaltet, sondern eine Zahl anhebt.
 * Fehlt ein Knoten auch dort, bekommt er das Zeichen seines Bereichs - `data/prestige.ts`
 * verspricht, dass ein neuer Knoten ein Eintrag dort ist und kein neuer Code, und ein
 * fehlendes Bild darf dieses Versprechen nicht brechen.
 */
const PRESTIGE_ICON: Record<string, IconName> = {
  'eco.gold1': 'coin',
  'eco.gold2': 'coin',
  'eco.gold3': 'coin',
  'eco.xp1': 'upgrade',
  // Die Station kaempft weiter, waehrend man weg ist - und die bessere Simulation laesst
  // dieselbe Zeit mehr zaehlen, also schneller laufen.
  'eco.offline': 'combat',
  'eco.offline2': 'rate',
  'towers.slot1': 'base',
  'towers.slot2': 'base',
  'towers.slot3': 'base',
  'towers.ability2': 'amplifier',
  'towers.ability3': 'amplifier',
  'speed.x2': 'rate',
  'speed.x4': 'rate',
  'rarity.rare': 'modules',
  'rarity.epic': 'modules',
  'rarity.legendary': 'modules',
  'rarity.mythic': 'modules',
  // Der Sammler und seine Ausbaustufen: erst hebt er Gold auf, dann weiter, dann schneller,
  // zuletzt zu dritt.
  'helper.collector': 'coin',
  'helper.better': 'radius',
  'helper.fast': 'rate',
  'helper.elite': 'modules',
  'trait.rare': 'amplifier',
  'trait.epic': 'amplifier',
  'trait.legendary': 'amplifier',
  'trait.mythic': 'amplifier',
}

export function prestigeIcon(id: string, fallback: IconName): IconName {
  const own = PRESTIGE_ICON[id]
  if (own) return own
  const tower = TOWERS.find((entry) => entry.unlock === id)
  return tower ? towerIcon(tower.id, 'tower') : fallback
}

/**
 * Was eine Ereignisoption bewirkt -> Symbol (GDD 11 Abschnitt 4).
 *
 * Gezeigt wird das Zeichen der **schwersten** Wirkung, nicht der ersten: Eine Option, die
 * Gold bringt und dabei einen Titanen ruft, ist ein Hinterhalt und keine Auszahlung.
 */
const EVENT_ICON: Record<string, IconName> = {
  reward: 'coin',
  boon: 'rate',
  hazard: 'crosshair',
  spawn: 'boss',
}

export function eventIcon(kind: string): IconName {
  return EVENT_ICON[kind] ?? 'coin'
}

/**
 * Bereich des Prestige-Baums -> Symbol (GDD 10 Abschnitt 6).
 *
 * Im Baum steht kein Text an den Knoten, nur das Zeichen. Es muss deshalb den **Ast**
 * benennen und nicht den einzelnen Knoten: Wer eine Muenze sieht, weiss, dass er in der
 * Wirtschaft ist, ohne den Hinweis zu lesen.
 */
const AREA_ICON: Record<string, IconName> = {
  economy: 'coin',
  towers: 'modules',
  speed: 'rate',
  rarity: 'amplifier',
  tech: 'upgrade',
  helpers: 'turret',
  traits: 'crosshair',
}

export function areaIcon(area: string): IconName {
  return AREA_ICON[area] ?? 'upgrade'
}

