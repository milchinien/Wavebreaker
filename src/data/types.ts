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

/**
 * Tatsaechliche Grundflaeche eines Moduls. Bestimmt zugleich die Zahl der Bauplaetze.
 *
 * **Warum 3, 4 und 6 - und ausdruecklich nicht 5.**
 *
 * Eine Ecke der Station schliesst sich, wenn die Innenwinkel der dort anliegenden Module
 * 360 Grad ergeben. Der Innenwinkel eines regelmaessigen n-Ecks ist `180 - 360/n`
 * (`interiorAngle` in `core/geometry.ts`):
 *
 *   Dreieck 60 - Quadrat 90 - Fuenfeck 108 - Sechseck 120 - Siebeneck 128,57 - Achteck 135
 *
 * Damit aus mehreren Winkeln je 360 werden koennen, muessen sie ein gemeinsames Raster
 * haben. Es gibt genau ein brauchbares: 30 Grad. `180 - 360/n` ist ein Vielfaches von 30
 * genau dann, wenn `360/n` eines ist, also fuer **n aus 3, 4, 6, 12** - und fuer nichts
 * sonst. Das Fuenfeck mit seinen 108 Grad liegt daneben, und zwar unheilbar: Es gibt keine
 * Kombination aus irgendwelchen Modulen, die zusammen mit einem Fuenfeck auf 360 kommt.
 *
 * Das war kein theoretisches Problem, sondern ein sichtbarer Fehler im Spiel. Der Verstaerker
 * war ein Fuenfeck, und das GDD empfiehlt, ihn **zuerst** zu setzen und darum herum zu bauen
 * (GDD 05 Abschnitt 5). An der Ecke, wo Kern und Verstaerker und ein Quadrat zusammenkamen,
 * standen damit 120 + 108 + 90 = 318 Grad - ein Rest von 42 Grad, in den nichts mehr passte,
 * weil die kleinste Form 60 braucht. Der Spieler sah eine Lueckeform, hielt ein Dreieck davor
 * und bekam die Sperrfarbe. Jede Station hatte solche Reste, und keiner davon war seine
 * Schuld.
 *
 * Mit 3, 4 und 6 ist jeder Rest ein Vielfaches von 30, und alle bis auf einen lassen sich
 * fuellen: 60 = Dreieck, 90 = Quadrat, 120 = Sechseck oder zwei Dreiecke, und so weiter.
 * **Der einzige unfuellbare Rest ist 30 Grad**, und er entsteht nur in einer Lage - Quadrat
 * neben Sechseck neben Sechseck (90 + 120 + 120 = 330). Der Spieler kann ihm ausweichen; das
 * Fuenfeck liess ihm die Wahl nicht. `selftest/suites/station.ts` rechnet das nach und
 * schlaegt Alarm, sobald hier eine Form dazukommt, die das Raster verlaesst.
 *
 * Erweiterbar ist die Liste nur um die **12**: 150 Grad, und 150 + 120 + 90 sind genau 360.
 * Sieben- und Achteck sind es nicht - ein Achteck am Sechseck-Kern laesst 105 Grad stehen.
 * Wer 12 freigibt, muss `MAX_MODULE_SIDES` (`core/geometry.ts`) mitziehen.
 */
export type FootprintSides = 3 | 4 | 6

/**
 * Alle zugelassenen Grundflaechen, aufsteigend.
 *
 * Sie wird **erfragt** und nicht an jeder Stelle neu aufgezaehlt: Das Turmangebot prueft
 * damit, welche Form ueberhaupt noch irgendwohin passt (`sim/shop.ts`), und die Selbsttests
 * rechnen damit den Winkelsatz von oben nach. Eine neue Form ist damit diese Zeile plus die
 * Typzeile darueber.
 */
export const FOOTPRINT_SIDES: readonly FootprintSides[] = [3, 4, 6]

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

/**
 * Turmklasse - die **Vokabel des Spielers** (GDD 05, `docs/upgrade-umbau.md` Abschnitt 2.2).
 *
 * Sie steht neben `Category` und ist ausdruecklich **nicht dasselbe**. Der Unterschied ist
 * die wichtigste Zeile dieser Datei, seit es beide gibt:
 *
 *   `Category`   ist eine **Kampfregel**. `sim/buffs.ts` entscheidet damit, wer buffen darf
 *                und wer gebufft wird (GDD 03 Abschnitt 9). Sie zu aendern aendert das Spiel.
 *   `TowerClass` ist ein **Name fuer eine Gruppe**. Sie steht in Upgrades und Hinweisen -
 *                "All Elemental turrets: +5 % damage" - und sonst nirgends.
 *
 * Wer beides zusammenlegt, aendert eine Balanceregel, sobald er ein Upgrade umbenennt.
 * Genau deshalb sind es zwei Felder an `TowerDef` und nicht eines; `selftest/suites/content.ts`
 * haelt die Trennung nach.
 *
 * Drei Klassen, und jeder Turm gehoert **genau einer** an - eine Turmart ohne Klasse waere
 * von jedem Gruppen-Upgrade ausgenommen, ohne dass es irgendwo auffiele.
 */
export type TowerClass =
  /** Verschiesst Materie: Autocannon, Siege Cannon, Marksman, Rocket Battery. */
  | 'kinetic'
  /** Verschiesst Energie: Laser, Tesla, Flammen, Cryo, Plasma, Void. */
  | 'elemental'
  /** Schiesst gar nicht: Verstaerker, Schildgenerator, Drohnenmodul. */
  | 'support'

export const TOWER_CLASSES: readonly TowerClass[] = ['kinetic', 'elemental', 'support']

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
