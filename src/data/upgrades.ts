/**
 * Der Upgrade-Katalog (`docs/upgrade-umbau.md`, GDD 08 Abschnitt 5).
 *
 * **Eine Liste von Hand, keine Schleife.** Das ist die eine Entscheidung, aus der alles
 * andere in dieser Datei folgt. Die Vorgaengerfassung (`data/upgrades-alt.ts`) erzeugte ihre
 * Pfade aus drei Kampfwerten mal Kern und jeder Turmart - und ein System, das seine Inhalte
 * generiert, kann keine Inhalte haben: Jedes Upgrade hiess "Damage", jedes wirkte
 * `base x (1 + Prozent x Stufe)`, jedes war von Anfang an da, und keines hatte etwas mit
 * einem anderen zu tun. Alle fuenf Maengel waren nicht Nachlaessigkeiten, sondern der Preis
 * der Schleife.
 *
 * Vier Begriffe tragen den Katalog:
 *
 *   Fenster    Tiefenstufe, kein Thema. Fenster 1 ist nicht "der Kern" und Fenster 2 nicht
 *              "die Tuerme" - jedes mischt Kern, Turrets, Klassen, Station und Overdrive.
 *              Was sich aendert, ist der Preis und wie weit ein Upgrade in die Zukunft greift.
 *   Art        Endless / Extension / Charge / Directive. Sie legt Wirkungsgroesse, Preis und
 *              Kostenkurve **gemeinsam** fest (`data/balance.ts`).
 *   Ziel       Kern, alle Turrets, eine Klasse, einzelne Turmarten oder die Station.
 *   Wirkung    flach, prozentual, eine Run-Groesse, ein Sonderwert oder eine **Regel**.
 *
 * **Ein Directive ist keine Zahl.** Ein Einmal-Upgrade, das +200 Schaden gibt, ist ein
 * Extension mit einer Stufe. Ein Directive aendert eine Regel: Der Kern verschiesst zwei
 * Projektile, Explosionen zuenden nach, Verstaerker reichen eine Kante weiter. Deshalb
 * traegt es `kind: 'rule'` und keinen Betrag - der Typ erzwingt es.
 *
 * **Flach, wo es einen festen Bezugswert gibt; Prozent, wo eine Gruppe gemeint ist.** Der
 * Grund ist rechnerisch: Nach `GLOBAL_DAMAGE_SCALE` macht die Autocannon 2,2 Schaden je
 * Schuss und der Marksman 61,6. "Alle Turrets +2 Schaden" verdoppelte die eine und liesse
 * den anderen kalt - eine flache Zahl auf eine gemischte Gruppe ist eine Luege ueber ihre
 * Wirkung. Auf den Kern, eine einzelne Turmart oder eine Groesse mit Einheit (Sekunden,
 * Meter, Spruenge, Drohnen, Plaetze) ist dieselbe Zahl exakt und nachpruefbar. Von den 60
 * Eintraegen tragen genau **vier** einen Prozentsatz auf eine Gruppe.
 *
 * **Position ist Reihenfolge.** `window` und `slot` stehen an keinem Eintrag: Sie entstehen
 * beim Bauen aus der Liste, in der der Eintrag steht. Ein doppelt belegter Platz und eine
 * Luecke im Raster sind damit keine Fehler, die man pruefen muesste, sondern Zustaende, die
 * es nicht geben kann.
 *
 * Namen und Beschreibungen stehen **im Datensatz**, nicht in `data/strings.ts` - dieselbe
 * Bauweise wie bei `data/perks.ts`, `data/trader.ts` und `data/prestige.ts`. Der Waechter
 * verbietet Spielertexte in `ui/` und `render/`, nicht in `data/`; und beim Justieren will
 * man Name, Betrag und Preis in einer Zeile sehen und nicht in zwei Dateien.
 */

import { towersOfClass, TOWERS } from './towers.ts'
import type { StatKey, TowerClass } from './types.ts'

// ---------------------------------------------------------------------------
// Vokabular
// ---------------------------------------------------------------------------

/**
 * Die vier Arten. Sie sind **Rollen**, keine Zahlen - was sie kosten und wie stark sie
 * wirken, folgt aus der Art (`data/balance.ts`, `UPGRADE_KIND_EXPONENT`).
 */
export type UpgradeKind =
  /** Unbegrenzt, klein, billig. Das, was man kauft, wenn nichts anderes geht. */
  | 'endless'
  /** 15 oder 20 Stufen, spuerbar, mittlerer Preis. Der Ruecken des Runs. */
  | 'extension'
  /** 3 oder 5 Stufen, grosser Sprung, teuer. Eine bewusste Investition. */
  | 'charge'
  /** Genau einmal - und es aendert eine **Regel**, keine Zahl. */
  | 'directive'

export const UPGRADE_KINDS: readonly UpgradeKind[] = [
  'endless',
  'extension',
  'charge',
  'directive',
]

export type UpgradeWindow = 1 | 2 | 3 | 4
export const UPGRADE_WINDOWS: readonly UpgradeWindow[] = [1, 2, 3, 4]

/**
 * Plaetze je Fenster - zwei Reihen zu zehn (GDD 13 Abschnitt 6).
 *
 * Das ist zugleich eine **Fessel fuer den Inhalt**: Wer ein 21. Upgrade erfinden will, muss
 * ein anderes streichen. Ueberschreitet eine Liste die Zahl, faellt das beim Programmstart
 * auf und nicht erst im Bild.
 */
export const WINDOW_SLOTS = 20

/** Worauf ein Upgrade wirkt. */
export type UpgradeTarget =
  /**
   * **Alles, was schiesst** - Kern und Turrets zugleich.
   *
   * Der Katalog benutzt es nicht: Ein Kaufpfad, der alles trifft, waere die eine Kachel, die
   * jede andere ueberfluessig macht. Perks dagegen sind genau das (GDD 09 Abschnitt 4) - sie
   * kommen aus dem Fortschritt und nicht aus dem Laden, und sie sollen den ganzen Build
   * heben. Seit E7 laufen sie durch dieselbe Union, und dies ist ihr Ziel.
   */
  | { kind: 'modules' }
  /** Der Turm in der Mitte. */
  | { kind: 'core' }
  /** Alle angebauten Tuerme, unabhaengig von ihrer Klasse. */
  | { kind: 'turrets' }
  /** Eine Turmklasse - Kinetic, Elemental oder Support (`data/types.ts`). */
  | { kind: 'class'; class: TowerClass }
  /** Einzelne Turmarten. Mehrere, weil "Deep Freeze" Cryo **und** Void meint. */
  | { kind: 'towers'; ids: readonly string[] }
  /** Die Station als Ganzes - Huelle, Gold, Plaetze. */
  | { kind: 'station' }

/*
 * Kurzformen fuer die Listen unten.
 *
 * Fuer `turrets` und die Klasse `support` steht hier bewusst **keine**: Der Katalog braucht
 * beide nicht. Support-Module haben keine Kampfwerte (`NO_STATS` in `data/towers.ts`) - ein
 * Schadenszuschlag auf sie waere null mal einem Aufschlag. Was sie staerker macht, sind
 * Sonderwerte (`buffPower`, `hullPerShield`, `droneCount`), und die brauchen kein Ziel.
 *
 * Die Union kennt beide Faelle trotzdem, und `targetTowers` loest sie auf: Perks wirken auf
 * **alle** Module zugleich (GDD 09 Abschnitt 4) und werden in E7 genau darueber ausgedrueckt.
 */
const CORE: UpgradeTarget = { kind: 'core' }
const KINETIC: UpgradeTarget = { kind: 'class', class: 'kinetic' }
const ELEMENTAL: UpgradeTarget = { kind: 'class', class: 'elemental' }
const towers = (...ids: string[]): UpgradeTarget => ({ kind: 'towers', ids })

/**
 * Groessen des Runs, die kein Kampfwert eines Moduls sind.
 *
 * Die ersten vier gibt es schon (`sim/stats.ts::globalMultiplier`, `data/perks.ts`) und sie
 * sind **Faktoren**; alles darunter ist neu und **flach**. Der Unterschied steht in der
 * Benennung: Was auf `Flat` endet oder mit `per` beginnt, wird addiert.
 */
export type GlobalKey =
  // Vorhandene Faktoren - Perks und Prestige haengen an denselben Namen.
  | 'stationHp'
  | 'goldBonus'
  | 'collectRadius'
  | 'xpBonus'
  // Neu, flach.
  /** Huelle als fester Betrag, vor dem Faktor. */
  | 'hullFlat'
  /** Huelle je gebautem Turret. */
  | 'hullPerTurret'
  /** Sammelradius in Metern, vor dem Faktor. */
  | 'collectRadiusFlat'
  /** Gold obendrauf je besiegtem Gegner. */
  | 'goldPerKill'
  /** Gold obendrauf je abgeschlossener Welle. */
  | 'goldPerWave'
  /** Faktor auf Gold von Bossen und Eliten. */
  | 'bossGold'
  /** Huelle, die je Sekunde von selbst zurueckkommt. */
  | 'hullRegen'
  | 'towerSlots'

/**
 * Sonderwerte einzelner Mechaniken.
 *
 * Jeder Schluessel braucht **genau eine** Leseseite in `sim/` - sonst entstuende wieder ein
 * Upgrade, das Gold nimmt und nichts tut. `selftest/suites/upgrades.ts` prueft das ab E9
 * Schluessel fuer Schluessel.
 */
export type SpecialKey =
  /** Aufschlag auf den Kritmultiplikator. */
  | 'critDamage'
  // --- Overdrive (`sim/overdrive.ts` ab E3) ---
  | 'overdriveChance'
  | 'overdriveDuration'
  | 'overdrivePower'
  /** Um wie viel frueher `Last Stand` anschlaegt. */
  | 'lastStandThreshold'
  // --- Turmmechaniken (`sim/combat.ts`, `sim/drones.ts`, `sim/buffs.ts`) ---
  | 'burnDuration'
  | 'chillDuration'
  | 'chillFactor'
  | 'chainHops'
  | 'blastRadius'
  | 'blastShare'
  | 'buffPower'
  | 'hullPerShield'
  | 'droneCount'
  | 'droneDamage'
  /** Zuwachs des Laserstrahls, solange er dasselbe Ziel haelt. */
  | 'beamRamp'
  /** Aufschlag des Marksman gegen das staerkste Ziel. */
  | 'strongestBonus'
  /** Schaden, den jedes gebaute Turret dem Kern gibt. */
  | 'coreDamagePerTurret'
  /** Schaden, den ein Support-Modul jedem Kantennachbarn gibt. */
  | 'supportNeighbourDamage'
  /** Ausbaustufe des Goldsammlers - `sim/helpers.ts` liest daraus Radius und Tempo. */
  | 'collectorLevel'

/**
 * Die Regeln, die ein Directive umlegt.
 *
 * Eine geschlossene Aufzaehlung, und das ist Absicht: Im Kampfcode steht kein
 * `if (upgradeLevel(...) > 0)`, sondern `hasRule(state, 'twinBarrel')` - dieselbe Bauweise
 * wie `isUnlocked` im Prestige-Baum. Wer eine Regel dazulegt, sieht am Typ, dass sie eine
 * Leseseite braucht.
 */
export type RuleId =
  | 'twinBarrel'
  | 'firstSpark'
  | 'sympatheticDetonation'
  | 'wideChorus'
  | 'secondWind'
  | 'contagion'
  | 'lastStand'
  | 'ashfall'
  | 'shatterpoint'
  | 'conduit'
  | 'ironDoctrine'
  | 'stormDoctrine'
  | 'vanguard'
  | 'endlessSpring'
  | 'perpetual'
  | 'ascendant'

export type UpgradeEffect =
  /** Fester Betrag auf einen Kampfwert. Wirkt **vor** allen Prozenten. */
  | { kind: 'flat'; target: UpgradeTarget; stat: StatKey; amount: number }
  /** Anteil auf einen Kampfwert. Nur dort, wo eine Gruppe gemeint ist. */
  | { kind: 'percent'; target: UpgradeTarget; stat: StatKey; amount: number }
  /** Eine Groesse des Runs. */
  | { kind: 'global'; key: GlobalKey; amount: number }
  /** Ein Sonderwert einer Mechanik. */
  | { kind: 'special'; key: SpecialKey; amount: number }
  /** Eine Regel - ohne Betrag, das ist der Punkt. */
  | { kind: 'rule'; id: RuleId }
  /** Oeffnet ein weiteres Upgrade-Fenster (`docs/upgrade-umbau.md` Abschnitt 4.1). */
  | { kind: 'window'; opens: UpgradeWindow }

export type UpgradeDef = {
  /** `f1.hammerfall` - Fenster und Name, damit die Kennung von selbst einmalig ist. */
  id: string
  window: UpgradeWindow
  /** Platz im Raster, 0 bis 19. Entsteht aus der Reihenfolge der Liste. */
  slot: number
  kind: UpgradeKind
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. Einmalig im ganzen Katalog. */
  name: string
  /** Ein Satz. Er steht im Hinweis, nicht auf der Kachel. */
  info: string
  effect: UpgradeEffect
  /** `Infinity` bei Endless, `1` bei Directive. */
  maxLevel: number
  /** Vor `GOLD_SCALE` und Fensterfaktor (`data/balance.ts`). */
  baseCost: number
  /** Muss gekauft sein, sonst bleibt die Kachel gesperrt. */
  requires?: string
  /** Ist das gekauft, ist dieses hier fuer immer gesperrt - und umgekehrt. */
  excludes?: string
  /**
   * Prestige-Knoten, der diese Kachel ueberhaupt erst kaufbar macht (GDD 12 Abschnitt 10).
   *
   * Der Unterschied zu `requires` ist die **Dauer**: Ein `requires` verweist auf ein
   * Upgrade desselben Runs und verfaellt mit ihm, ein `requiresNode` auf etwas Dauerhaftes.
   * Deshalb sind es zwei Felder und nicht eines - der Katalog kennt den Prestige-Baum nicht
   * und soll ihn auch nicht kennen; geprueft wird der Knoten dort, wo der Zustand liegt
   * (`app/actions.ts`).
   */
  requiresNode?: string
  /** Abweichender Bildname. Ohne Angabe der Namensteil der Kennung. */
  icon?: string
}

/** Ein Eintrag, wie er in den Listen unten steht - Fenster und Platz kommen beim Bauen. */
type Entry = Omit<UpgradeDef, 'window' | 'slot'>

// ---------------------------------------------------------------------------
// Fenster 1 - Foundation
// ---------------------------------------------------------------------------

/*
 * Was in den ersten zwanzig Minuten wirkt. Preisfaktor x1.
 *
 * Genau **zwei** Eintraege treffen auch Tuerme, die man zu Beginn nicht hat (Warhead und
 * Iron Rain wirken auf Marksman und Rocket Battery mit) - die Vorgabe lautet *weniger*,
 * nicht *keine*. Der Verstaerker fehlt hier ganz, obwohl er im Startlager liegt: Sein
 * Upgrade steht in Fenster 2, weil es erst zaehlt, wenn die Station gebaut ist. `Rally` ist
 * das einzige Upgrade auf eine einzelne Turmart, und es trifft die Autocannon - den einen
 * Turm, den jeder Spieler ab Sekunde null hat.
 */
const FOUNDATION: Entry[] = [
  {
    id: 'f1.hammerfall',
    kind: 'endless',
    name: 'Hammerfall',
    info: 'Every core shot lands heavier. Cheap, small, and it never runs out.',
    effect: { kind: 'flat', target: CORE, stat: 'damage', amount: 2 },
    maxLevel: Infinity,
    baseCost: 30,
  },
  {
    id: 'f1.drumfire',
    kind: 'extension',
    name: 'Drumfire',
    info: 'The core fires faster.',
    effect: { kind: 'flat', target: CORE, stat: 'attackSpeed', amount: 0.1 },
    maxLevel: 20,
    baseCost: 120,
  },
  {
    id: 'f1.longsight',
    kind: 'extension',
    name: 'Longsight',
    info: 'The core reaches further out, so enemies are met sooner.',
    effect: { kind: 'flat', target: CORE, stat: 'range', amount: 8 },
    maxLevel: 15,
    baseCost: 100,
  },
  {
    id: 'f1.bulkhead',
    kind: 'endless',
    name: 'Bulkhead',
    info: 'Plating on the shared hull. Never runs out.',
    effect: { kind: 'global', key: 'hullFlat', amount: 25 },
    maxLevel: Infinity,
    baseCost: 40,
  },
  {
    id: 'f1.magnetglove',
    kind: 'extension',
    name: 'Magnet Glove',
    info: 'Coins jump to your cursor from further away.',
    effect: { kind: 'global', key: 'collectRadiusFlat', amount: 20 },
    maxLevel: 15,
    baseCost: 110,
  },
  {
    id: 'f1.tithe',
    kind: 'endless',
    name: 'Tithe',
    info: 'Every kill leaves one more coin behind.',
    effect: { kind: 'global', key: 'goldPerKill', amount: 1 },
    maxLevel: Infinity,
    baseCost: 50,
  },
  {
    id: 'f1.scrapperseye',
    kind: 'charge',
    name: "Scrapper's Eye",
    info: 'You see worth in wreckage. All gold is multiplied.',
    effect: { kind: 'global', key: 'goldBonus', amount: 0.08 },
    maxLevel: 5,
    baseCost: 500,
  },
  {
    id: 'f1.hairtrigger',
    kind: 'extension',
    name: 'Hair Trigger',
    info: 'The core lands critical hits more often.',
    effect: { kind: 'flat', target: CORE, stat: 'critChance', amount: 0.01 },
    maxLevel: 20,
    baseCost: 130,
  },
  {
    id: 'f1.killingblow',
    kind: 'charge',
    name: 'Killing Blow',
    info: 'Critical hits bite far deeper.',
    effect: { kind: 'special', key: 'critDamage', amount: 0.25 },
    maxLevel: 5,
    baseCost: 550,
  },
  {
    id: 'f1.twinbarrel',
    kind: 'directive',
    name: 'Twin Barrel',
    info: 'The core fires two projectiles instead of one.',
    effect: { kind: 'rule', id: 'twinBarrel' },
    maxLevel: 1,
    baseCost: 3000,
  },
  {
    id: 'f1.warhead',
    kind: 'extension',
    name: 'Warhead',
    info: 'Heavier payloads on every kinetic turret.',
    effect: { kind: 'percent', target: KINETIC, stat: 'damage', amount: 0.04 },
    maxLevel: 20,
    baseCost: 140,
  },
  {
    id: 'f1.ironrain',
    kind: 'extension',
    name: 'Iron Rain',
    info: 'Kinetic turrets cycle faster.',
    effect: { kind: 'percent', target: KINETIC, stat: 'attackSpeed', amount: 0.03 },
    maxLevel: 15,
    baseCost: 120,
  },
  {
    id: 'f1.firstspark',
    kind: 'directive',
    name: 'First Spark',
    info: 'Turrets can enter OVERDRIVE on a kill — briefly firing much harder.',
    effect: { kind: 'rule', id: 'firstSpark' },
    maxLevel: 1,
    baseCost: 1500,
  },
  {
    id: 'f1.redline',
    kind: 'endless',
    name: 'Redline',
    info: 'Overdrive triggers more often. Never runs out.',
    effect: { kind: 'special', key: 'overdriveChance', amount: 0.01 },
    maxLevel: Infinity,
    baseCost: 60,
    requires: 'f1.firstspark',
  },
  {
    id: 'f1.afterburn',
    kind: 'charge',
    name: 'Afterburn',
    info: 'Overdrive lasts longer.',
    effect: { kind: 'special', key: 'overdriveDuration', amount: 1 },
    maxLevel: 5,
    baseCost: 600,
    requires: 'f1.firstspark',
  },
  {
    id: 'f1.foreman',
    kind: 'charge',
    name: 'Foreman',
    info: 'One more docking point on the station.',
    effect: { kind: 'global', key: 'towerSlots', amount: 1 },
    maxLevel: 3,
    baseCost: 900,
  },
  {
    /*
     * Es hiess zuerst "die Huelle flickt sich zwischen zwei Wellen" - und war damit
     * wirkungslos: `healStationFull` in `sim/waves.ts` setzt sie ohnehin nach **jeder**
     * Welle auf den Hoechstwert, auch nach einer verlorenen. Es gab schlicht keinen
     * Augenblick, in dem die Reparatur etwas zu tun gehabt haette.
     *
     * Als laufende Regeneration wirkt sie dagegen genau dort, wo es zaehlt: waehrend des
     * Gefechts, gegen den Schaden angedockter Gegner.
     */
    id: 'f1.fieldrepair',
    kind: 'extension',
    name: 'Field Repair',
    info: 'The hull mends itself while you fight.',
    effect: { kind: 'global', key: 'hullRegen', amount: 1 },
    maxLevel: 20,
    baseCost: 130,
  },
  {
    id: 'f1.packmule',
    kind: 'endless',
    name: 'Pack Mule',
    info: 'Every docked turret carries a little armour of its own.',
    effect: { kind: 'global', key: 'hullPerTurret', amount: 3 },
    maxLevel: Infinity,
    baseCost: 45,
  },
  {
    id: 'f1.rally',
    kind: 'extension',
    name: 'Rally',
    info: 'Autocannons hit harder — your first turret stays useful.',
    effect: { kind: 'flat', target: towers('autocannon'), stat: 'damage', amount: 2 },
    maxLevel: 20,
    baseCost: 90,
  },
  {
    id: 'f1.secondarray',
    kind: 'directive',
    name: 'Second Array',
    info: 'Brings the SYSTEMS array online — a second set of upgrades.',
    effect: { kind: 'window', opens: 2 },
    maxLevel: 1,
    baseCost: 4000,
  },
]

// ---------------------------------------------------------------------------
// Fenster 2 - Systems
// ---------------------------------------------------------------------------

/*
 * Verknuepfung. Preisfaktor x3.
 *
 * Hier steht zum ersten Mal etwas, das ein anderes Modul staerker macht statt sich selbst
 * (`Relay`, `Choir`, `Wide Chorus`) - und der halbe Overdrive-Ausbau. Sechs Directives
 * gegen drei in Fenster 1: Ab hier faengt das Menue an, Entscheidungen zu stellen.
 */
const SYSTEMS: Entry[] = [
  {
    id: 'f2.resonance',
    kind: 'extension',
    name: 'Resonance',
    info: 'Energy weapons across the station strike in tune.',
    effect: { kind: 'percent', target: ELEMENTAL, stat: 'damage', amount: 0.05 },
    maxLevel: 20,
    baseCost: 150,
  },
  {
    id: 'f2.wildfire',
    kind: 'extension',
    name: 'Wildfire',
    info: 'Fire keeps burning after the shot.',
    effect: { kind: 'special', key: 'burnDuration', amount: 1 },
    maxLevel: 15,
    baseCost: 130,
  },
  {
    /*
     * Der Goldsammler (GDD 12 Abschnitt 10 und 11) - der einzige Eintrag mit `requiresNode`.
     *
     * Seine zweistufige Freischaltung ist das Wesentliche: Der Prestige-Baum macht ihn
     * **kaufbar**, gekauft wird er mit Gold. Vor dem Umbau war er der einzige Pfad mit einem
     * `unlock`-Feld; ohne einen Platz im Katalog waere der Knoten `helper.collector` fuer
     * 500 Prestigepunkte ins Leere gelaufen.
     *
     * Er steht in Fenster 2, weil sein Knoten ohnehin spaeteres Spiel ist - und an dem
     * Platz, an dem zuvor ein zweites Flammen-Upgrade stand. Zwei Pfade fuer denselben Turm
     * in einem Fenster waren die schwaechere Verwendung des Platzes.
     */
    id: 'f2.collector',
    kind: 'endless',
    name: 'Gold Collector',
    info: 'A drone that picks up gold for you. Each level makes it faster and wider.',
    effect: { kind: 'special', key: 'collectorLevel', amount: 1 },
    maxLevel: Infinity,
    baseCost: 90,
    requiresNode: 'helper.collector',
  },
  {
    id: 'f2.deepfreeze',
    kind: 'extension',
    name: 'Deep Freeze',
    info: 'Anything you slow stays slow for longer.',
    effect: { kind: 'special', key: 'chillDuration', amount: 1 },
    maxLevel: 15,
    baseCost: 130,
  },
  {
    id: 'f2.arccascade',
    kind: 'charge',
    name: 'Arc Cascade',
    info: 'Lightning finds one more body to jump to.',
    effect: { kind: 'special', key: 'chainHops', amount: 1 },
    maxLevel: 3,
    baseCost: 700,
  },
  {
    id: 'f2.fragmentation',
    kind: 'extension',
    name: 'Fragmentation',
    info: 'Blasts reach wider.',
    effect: { kind: 'special', key: 'blastRadius', amount: 15 },
    maxLevel: 20,
    baseCost: 160,
  },
  {
    id: 'f2.sympathetic',
    kind: 'directive',
    name: 'Sympathetic Detonation',
    info: 'Every explosion sets off a second one, half as strong.',
    effect: { kind: 'rule', id: 'sympatheticDetonation' },
    maxLevel: 1,
    baseCost: 2200,
  },
  {
    id: 'f2.choir',
    kind: 'extension',
    name: 'Choir',
    info: 'Amplifiers push their neighbours harder.',
    effect: { kind: 'special', key: 'buffPower', amount: 0.06 },
    maxLevel: 20,
    baseCost: 170,
  },
  {
    id: 'f2.widechorus',
    kind: 'directive',
    name: 'Wide Chorus',
    info: 'Amplifiers reach one edge further — not just their direct neighbours.',
    effect: { kind: 'rule', id: 'wideChorus' },
    maxLevel: 1,
    baseCost: 2500,
  },
  {
    id: 'f2.aegis',
    kind: 'endless',
    name: 'Aegis',
    info: 'Every shield generator carries more hull. Never runs out.',
    effect: { kind: 'special', key: 'hullPerShield', amount: 25 },
    maxLevel: Infinity,
    baseCost: 65,
  },
  {
    id: 'f2.swarm',
    kind: 'charge',
    name: 'Swarm',
    info: 'One more drone leaves every bay.',
    effect: { kind: 'special', key: 'droneCount', amount: 1 },
    maxLevel: 3,
    baseCost: 800,
  },
  {
    id: 'f2.huntingpack',
    kind: 'endless',
    name: 'Hunting Pack',
    info: 'Drones bite harder. Never runs out.',
    effect: { kind: 'special', key: 'droneDamage', amount: 3 },
    maxLevel: Infinity,
    baseCost: 55,
  },
  {
    id: 'f2.relay',
    kind: 'extension',
    name: 'Relay',
    info: 'Support modules feed damage to every turret they touch.',
    effect: { kind: 'special', key: 'supportNeighbourDamage', amount: 2 },
    maxLevel: 20,
    baseCost: 180,
  },
  {
    id: 'f2.secondwind',
    kind: 'directive',
    name: 'Second Wind',
    info: 'Overdrive can stack twice on the same turret.',
    effect: { kind: 'rule', id: 'secondWind' },
    maxLevel: 1,
    baseCost: 2400,
    requires: 'f1.firstspark',
  },
  {
    id: 'f2.contagion',
    kind: 'directive',
    name: 'Contagion',
    info: 'Overdrive spreads to one neighbouring module.',
    effect: { kind: 'rule', id: 'contagion' },
    maxLevel: 1,
    baseCost: 2000,
    requires: 'f1.firstspark',
  },
  {
    id: 'f2.runaway',
    kind: 'extension',
    name: 'Runaway',
    info: 'Overdrive hits harder while it lasts.',
    effect: { kind: 'special', key: 'overdrivePower', amount: 0.04 },
    maxLevel: 20,
    baseCost: 160,
    requires: 'f1.firstspark',
  },
  {
    id: 'f2.laststand',
    kind: 'directive',
    name: 'Last Stand',
    info: 'Below 30% hull the whole station goes into Overdrive. Once per wave.',
    effect: { kind: 'rule', id: 'lastStand' },
    maxLevel: 1,
    baseCost: 2600,
    requires: 'f1.firstspark',
  },
  {
    id: 'f2.brink',
    kind: 'charge',
    name: 'Brink',
    info: 'Last Stand answers sooner — at 40%, then 50%, then 60% hull.',
    effect: { kind: 'special', key: 'lastStandThreshold', amount: 0.1 },
    maxLevel: 3,
    baseCost: 900,
    requires: 'f2.laststand',
  },
  {
    id: 'f2.pathfinder',
    kind: 'charge',
    name: 'Pathfinder',
    info: 'One more docking point on the station.',
    effect: { kind: 'global', key: 'towerSlots', amount: 1 },
    maxLevel: 3,
    baseCost: 1000,
  },
  {
    id: 'f2.thirdarray',
    kind: 'directive',
    name: 'Third Array',
    info: 'Brings the DOCTRINE array online — the deepest set of upgrades.',
    effect: { kind: 'window', opens: 3 },
    maxLevel: 1,
    baseCost: 8000,
  },
]

// ---------------------------------------------------------------------------
// Fenster 3 - Doctrine
// ---------------------------------------------------------------------------

/*
 * Endspiel. Preisfaktor x8.
 *
 * Neun Directives von zwanzig - und das ist die Aussage dieses Fensters: In Fenster 1 kauft
 * man Zahlen, hier trifft man Entscheidungen. Das Herzstueck sind `Iron Doctrine` und
 * `Storm Doctrine`: zwei Directives, die einander **ausschliessen**. Wer eines kauft, kann
 * das andere in diesem Run nie mehr kaufen. Es ist die erste Stelle des Spiels, an der ein
 * Upgrade eine Entscheidung ist statt einer Ausgabe - und sie steht dort, wo der Spieler
 * seine Station laengst kennt.
 *
 * `Overclock` ist das **einzige** Prozent-Upgrade auf den Kern und ein bewusster Bruch der
 * Regel oben. Es gibt ihn, um `Drumfire` zu belohnen: Was Fenster 1 zwanzig Stufen lang
 * addiert hat, vervielfacht Fenster 3 in fuenf. Genau diese Verzahnung ueber die Fenster
 * hinweg ist der Zweck der Aufteilung.
 */
const DOCTRINE: Entry[] = [
  {
    id: 'f3.focallens',
    kind: 'extension',
    name: 'Focal Lens',
    info: 'The beam bores deeper the longer it holds one target.',
    effect: { kind: 'special', key: 'beamRamp', amount: 8 },
    maxLevel: 20,
    baseCost: 180,
  },
  {
    id: 'f3.executioner',
    kind: 'extension',
    name: 'Executioner',
    info: 'Marksmen punish whatever is strongest on the field.',
    effect: { kind: 'special', key: 'strongestBonus', amount: 0.06 },
    maxLevel: 15,
    baseCost: 170,
  },
  {
    id: 'f3.overpressure',
    kind: 'charge',
    name: 'Overpressure',
    info: 'Plasma blasts carry more of the hit outward.',
    effect: { kind: 'special', key: 'blastShare', amount: 0.05 },
    maxLevel: 5,
    baseCost: 1200,
  },
  {
    id: 'f3.riftwalk',
    kind: 'extension',
    name: 'Riftwalk',
    info: 'Void spheres drag everything they touch down further.',
    effect: { kind: 'special', key: 'chillFactor', amount: 0.03 },
    maxLevel: 20,
    baseCost: 170,
  },
  {
    id: 'f3.ashfall',
    kind: 'directive',
    name: 'Ashfall',
    info: 'Burning enemies take 20% more damage from every source.',
    effect: { kind: 'rule', id: 'ashfall' },
    maxLevel: 1,
    baseCost: 3000,
  },
  {
    id: 'f3.shatterpoint',
    kind: 'directive',
    name: 'Shatterpoint',
    info: 'Slowed enemies take 50% more critical damage.',
    effect: { kind: 'rule', id: 'shatterpoint' },
    maxLevel: 1,
    baseCost: 3000,
  },
  {
    id: 'f3.conduit',
    kind: 'directive',
    name: 'Conduit',
    info: 'Energy weapons arc onward to one nearby enemy.',
    effect: { kind: 'rule', id: 'conduit' },
    maxLevel: 1,
    baseCost: 3500,
  },
  {
    id: 'f3.irondoctrine',
    kind: 'directive',
    name: 'Iron Doctrine',
    info: 'Commit to metal: kinetic turrets +40%, energy weapons -15%.',
    effect: { kind: 'rule', id: 'ironDoctrine' },
    maxLevel: 1,
    baseCost: 4000,
    excludes: 'f3.stormdoctrine',
  },
  {
    id: 'f3.stormdoctrine',
    kind: 'directive',
    name: 'Storm Doctrine',
    info: 'Commit to energy: energy weapons +40%, kinetic turrets -15%.',
    effect: { kind: 'rule', id: 'stormDoctrine' },
    maxLevel: 1,
    baseCost: 4000,
    excludes: 'f3.irondoctrine',
  },
  {
    id: 'f3.vanguard',
    kind: 'directive',
    name: 'Vanguard',
    info: 'The core shares a quarter of its flat upgrades with every turret.',
    effect: { kind: 'rule', id: 'vanguard' },
    maxLevel: 1,
    baseCost: 4500,
  },
  {
    id: 'f3.crown',
    kind: 'extension',
    name: 'Crown',
    info: 'Every docked turret lends the core some of its strength.',
    effect: { kind: 'special', key: 'coreDamagePerTurret', amount: 2 },
    maxLevel: 20,
    baseCost: 190,
  },
  {
    id: 'f3.overclock',
    kind: 'charge',
    name: 'Overclock',
    info: 'The core runs past its rated cycle — multiplying everything you built into it.',
    effect: { kind: 'percent', target: CORE, stat: 'attackSpeed', amount: 0.08 },
    maxLevel: 5,
    baseCost: 1300,
  },
  {
    id: 'f3.endlessspring',
    kind: 'directive',
    name: 'Endless Spring',
    info: 'Overdrive never runs down while a boss is alive.',
    effect: { kind: 'rule', id: 'endlessSpring' },
    maxLevel: 1,
    baseCost: 3200,
    requires: 'f1.firstspark',
  },
  {
    id: 'f3.perpetual',
    kind: 'directive',
    name: 'Perpetual',
    info: 'Overdrive can trigger on any hit, not only on a kill.',
    effect: { kind: 'rule', id: 'perpetual' },
    maxLevel: 1,
    baseCost: 3600,
    requires: 'f1.firstspark',
  },
  {
    id: 'f3.warlord',
    kind: 'endless',
    name: 'Warlord',
    info: 'Overdrive grows stronger with every level. Never runs out.',
    effect: { kind: 'special', key: 'overdrivePower', amount: 0.02 },
    maxLevel: Infinity,
    baseCost: 70,
    requires: 'f1.firstspark',
  },
  {
    id: 'f3.bastion',
    kind: 'extension',
    name: 'Bastion',
    info: 'The whole hull is multiplied — plating, shields and all.',
    effect: { kind: 'global', key: 'stationHp', amount: 0.05 },
    maxLevel: 20,
    baseCost: 180,
  },
  {
    id: 'f3.tollofwar',
    kind: 'endless',
    name: 'Toll of War',
    info: 'Every wave you finish pays out. Never runs out.',
    effect: { kind: 'global', key: 'goldPerWave', amount: 5 },
    maxLevel: Infinity,
    baseCost: 60,
  },
  {
    id: 'f3.architect',
    kind: 'charge',
    name: 'Architect',
    info: 'One more docking point on the station.',
    effect: { kind: 'global', key: 'towerSlots', amount: 1 },
    maxLevel: 3,
    baseCost: 1400,
  },
  {
    /*
     * Das einzige Upgrade im ganzen Katalog, das die Faehigkeiten anfasst.
     *
     * Es hiess zuerst "+1 Faehigkeitenslot" - und war damit falsch gebaut, gleich zweifach:
     * Ein Slot ist ein Betrag und keine Regel, also waere es ein Ausbau mit einer Stufe
     * gewesen; und die Slots sind bei drei gedeckelt und werden bereits vom Prestige-Baum
     * vergeben (`towers.ability2`, `towers.ability3`). Wer beide Knoten hat, haette hier
     * Gold fuer nichts ausgegeben. Eine halbierte Abklingzeit hat dieses Problem nicht: Sie
     * wirkt immer, und sie wirkt auf das, was der Spieler ohnehin schon ausgesucht hat.
     */
    id: 'f3.ascendant',
    kind: 'directive',
    name: 'Ascendant',
    info: 'Your abilities come back twice as fast.',
    effect: { kind: 'rule', id: 'ascendant' },
    maxLevel: 1,
    baseCost: 5000,
  },
  {
    id: 'f3.tribute',
    kind: 'extension',
    name: 'Tribute',
    info: 'Bosses and elites pay far better.',
    effect: { kind: 'global', key: 'bossGold', amount: 0.1 },
    maxLevel: 15,
    baseCost: 160,
  },
]

// ---------------------------------------------------------------------------
// Aufbau und Zugriff
// ---------------------------------------------------------------------------

/**
 * Fenster und Platz vergeben.
 *
 * Der Platz **ist** die Position in der Liste - deshalb steht er an keinem Eintrag. Ein
 * doppelt belegter Platz und eine Luecke im Raster koennen damit nicht entstehen; was
 * bleibt, ist die Obergrenze, und die faellt beim Programmstart auf.
 */
function build(window: UpgradeWindow, entries: Entry[]): UpgradeDef[] {
  if (entries.length > WINDOW_SLOTS) {
    throw new Error(
      `Fenster ${window} hat ${entries.length} Upgrades, das Raster fasst ${WINDOW_SLOTS}`,
    )
  }
  return entries.map((entry, slot) => ({ ...entry, window, slot }))
}

export const UPGRADES: readonly UpgradeDef[] = [
  ...build(1, FOUNDATION),
  ...build(2, SYSTEMS),
  ...build(3, DOCTRINE),
]

const BY_ID = new Map(UPGRADES.map((upgrade) => [upgrade.id, upgrade]))

export function upgradeById(id: string): UpgradeDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`Unbekanntes Upgrade: ${id}`)
  return def
}

export function isKnownUpgrade(id: string): boolean {
  return BY_ID.has(id)
}

/** Die Kacheln eines Fensters, in Rasterreihenfolge. */
export function upgradesInWindow(window: UpgradeWindow): UpgradeDef[] {
  return UPGRADES.filter((upgrade) => upgrade.window === window)
}

/**
 * Das Upgrade, das dieses Fenster oeffnet - oder `null` fuer Fenster 1.
 *
 * Erfragt statt aufgezaehlt: Wer das Tor an einen anderen Platz legt, aendert damit nichts
 * an dieser Funktion. Fenster 4 hat bewusst keines (`docs/upgrade-umbau.md` Abschnitt 4.1).
 */
export function windowGate(window: UpgradeWindow): UpgradeDef | null {
  if (window === 1) return null
  return (
    UPGRADES.find(
      (upgrade) => upgrade.effect.kind === 'window' && upgrade.effect.opens === window,
    ) ?? null
  )
}

/*
 * === Umkehrtabellen ==========================================================
 *
 * Der Kampfcode fragt nicht "welche Upgrades hat der Spieler", sondern "gilt Regel X" und
 * "wie hoch ist Wert Y" - und er fragt das oft: `hasRule` steht in der Schussrechnung, also
 * mehrmals je Turm und Takt. Eine Suche ueber die gekauften Pfade waere dort eine Schleife
 * in einer Schleife.
 *
 * Die drei Tabellen unten drehen den Katalog deshalb einmal beim Programmstart um. Sie sind
 * **abgeleitet und nicht gepflegt**: Wer ein Upgrade hinzufuegt, bekommt seinen Eintrag
 * geschenkt, und wer eines entfernt, verliert ihn. Eine Tabelle von Hand waere genau die
 * Sorte Nebenbuchhaltung, die beim ersten Vergessen still danebenliegt.
 */

/** Regel -> der Pfad, der sie umlegt. Je Regel genau einer. */
const PATH_BY_RULE = new Map<RuleId, string>()
/** Sonderwert -> alle Pfade, die darauf einzahlen. `overdrivePower` hat zwei. */
const PATHS_BY_SPECIAL = new Map<SpecialKey, string[]>()
/** Run-Groesse -> alle Pfade, die darauf einzahlen. Turmplaetze haben drei. */
const PATHS_BY_GLOBAL = new Map<GlobalKey, string[]>()

for (const def of UPGRADES) {
  const effect = def.effect
  if (effect.kind === 'rule') {
    const seen = PATH_BY_RULE.get(effect.id)
    // Zwei Upgrades fuer dieselbe Regel waeren nicht zu unterscheiden: Das zweite koennte
    // nichts mehr bewirken, und der Spieler haette es trotzdem bezahlt.
    if (seen) throw new Error(`Die Regel ${effect.id} steht an ${seen} und an ${def.id}`)
    PATH_BY_RULE.set(effect.id, def.id)
  } else if (effect.kind === 'special') {
    PATHS_BY_SPECIAL.set(effect.key, [...(PATHS_BY_SPECIAL.get(effect.key) ?? []), def.id])
  } else if (effect.kind === 'global') {
    PATHS_BY_GLOBAL.set(effect.key, [...(PATHS_BY_GLOBAL.get(effect.key) ?? []), def.id])
  }
}

/** Der Pfad, der diese Regel umlegt - oder `null`, wenn es ihn (noch) nicht gibt. */
export function rulePath(id: RuleId): string | null {
  return PATH_BY_RULE.get(id) ?? null
}

/*
 * === Auskunft ueber gekaufte Stufen ==========================================
 *
 * Die vier Funktionen unten nehmen die **Upgrade-Tabelle** und nicht den Spielzustand -
 * `state.run.upgrades` ist alles, was sie brauchen. Das ist kein Geiz, sondern das, was den
 * Kreis verhindert: `sim/stats.ts` zieht aus `sim/prestige.ts` (die Prestige-Faktoren), und
 * `sim/prestige.ts` braucht seinerseits die Turmplaetze aus dem Katalog. Naehme diese
 * Auskunft den `GameState`, muesste sie in `sim/` liegen, und die beiden Dateien lieferen
 * sich gegenseitig an.
 *
 * `sim/stats.ts` legt darum nur noch eine duenne Huelle darueber, die den Zustand auspackt.
 */

/** Stand eines Pfads. Unbekannte, kaputte und negative Eintraege zaehlen als 0. */
export function levelOf(upgrades: Record<string, number>, path: string): number {
  const level = upgrades[path]
  return typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0
}

/** Ist diese Regel gekauft? */
export function ruleActive(upgrades: Record<string, number>, id: RuleId): boolean {
  const path = rulePath(id)
  return path !== null && levelOf(upgrades, path) > 0
}

/** Summe eines Sonderwerts ueber alle Pfade, die darauf einzahlen. */
export function specialSum(upgrades: Record<string, number>, key: SpecialKey): number {
  let total = 0
  for (const path of specialPaths(key)) {
    const level = levelOf(upgrades, path)
    if (level === 0) continue
    const effect = upgradeById(path).effect
    if (effect.kind === 'special') total += effect.amount * level
  }
  return total
}

/** Summe einer Run-Groesse ueber alle Pfade, die darauf einzahlen. */
export function globalSum(upgrades: Record<string, number>, key: GlobalKey): number {
  let total = 0
  for (const path of globalPaths(key)) {
    const level = levelOf(upgrades, path)
    if (level === 0) continue
    const effect = upgradeById(path).effect
    if (effect.kind === 'global') total += effect.amount * level
  }
  return total
}

/**
 * Was eine Kapsel oder die Haendler-Drohne verschenken darf.
 *
 * Drei Einschraenkungen, und jede hat einen Grund:
 *
 *   **Nur offene Fenster.** Ein geschenktes Upgrade aus einem Fenster, das der Spieler noch
 *   nicht bezahlt hat, waere ein Blick hinter eine Tuer, die er selbst oeffnen soll.
 *   **Keine Directives.** Sie aendern eine Regel; per Zufall verteilt waere das kein
 *   Geschenk, sondern ein anderer Run. Das schliesst die Tore mit ein - ein verschenktes
 *   Fenster nimmt der Progression ihren einzigen Meilenstein.
 *   **Nichts Gesperrtes.** `requires` unerfuellt oder `excludes` schon gekauft heisst: Der
 *   Spieler hat sich dagegen entschieden oder ist noch nicht so weit.
 *
 * Steht hier und nicht bei einem der beiden Aufrufer, weil sie sonst dieselbe Auswahl
 * zweimal treffen muessten - und beim naechsten Zusatz einmal davon vergessen wuerde.
 */
export function giftableUpgrades(upgrades: Record<string, number>): UpgradeDef[] {
  return UPGRADES.filter((def) => {
    if (def.kind === 'directive') return false
    // Was an einem Prestige-Knoten haengt, wird nicht verschenkt: Diese Auswahl kennt den
    // dauerhaften Fortschritt nicht, und ein verschenkter Helfer waere ohnehin seltsam.
    if (def.requiresNode !== undefined) return false
    if (!windowOpen(upgrades, def.window)) return false
    if (def.requires !== undefined && levelOf(upgrades, def.requires) === 0) return false
    if (def.excludes !== undefined && levelOf(upgrades, def.excludes) > 0) return false
    return levelOf(upgrades, def.id) < def.maxLevel
  })
}

/**
 * Ist dieses Fenster offen?
 *
 * Fenster 1 immer, 2 und 3 nach dem Kauf ihres Tors, 4 nie (`docs/upgrade-umbau.md`
 * Abschnitt 4.1). Weil das Tor selbst ein Upgrade in `run.upgrades` ist, wird die
 * Freischaltung beim Prestige von allein zurueckgesetzt - ohne ein eigenes Feld im
 * Spielstand.
 */
export function windowOpen(upgrades: Record<string, number>, window: UpgradeWindow): boolean {
  if (window === 1) return true
  const gate = windowGate(window)
  return gate !== null && levelOf(upgrades, gate.id) > 0
}

/** Alle Pfade, die auf diesen Sonderwert einzahlen. */
export function specialPaths(key: SpecialKey): readonly string[] {
  return PATHS_BY_SPECIAL.get(key) ?? []
}

/** Alle Pfade, die auf diese Run-Groesse einzahlen. */
export function globalPaths(key: GlobalKey): readonly string[] {
  return PATHS_BY_GLOBAL.get(key) ?? []
}

/** Bildname einer Kachel. Ohne eigenen Eintrag der Namensteil der Kennung. */
export function upgradeIcon(def: UpgradeDef): string {
  return def.icon ?? def.id.slice(def.id.indexOf('.') + 1)
}

/**
 * Die Turmarten, die dieses Ziel meint - der eine Ort, an dem ein Ziel aufgeloest wird.
 *
 * `core` und `station` liefern nichts: Der Kern ist keine Turmart, und die Station ist gar
 * kein Modul. Wer beides mitzaehlen wollte, muesste hier eine Sonderregel unterbringen, die
 * jeder Aufrufer wieder auseinandernehmen muss.
 */
/*
 * === Anteil oder Zaehlwert ===================================================
 *
 * Diese Unterscheidung wird an **zwei** Stellen gebraucht, und deshalb steht sie hier und
 * nicht an einer davon:
 *
 *   Rechnen    `sim/stats.ts` (ab E2) muss wissen, ob ein Betrag addiert oder multipliziert
 *              wird. `goldPerKill` ist ein Summand, `goldBonus` ein Faktor - der Name sagt
 *              es, aber eine Namenskonvention ist keine Zusicherung.
 *   Anzeigen   Der Hinweis auf einer Kachel (ab E5) schreibt "+15 m" oder "+8 %". Welches
 *              von beidem, haengt an genau dieser Frage.
 *
 * Ein Anteil erkennt man **nicht** daran, dass sein Betrag kleiner als eins ist: `blastShare`
 * ist ein Anteil und steht bei 0,05, `chillDuration` ist Sekunden und koennte es auch. Die
 * Liste ist deshalb ausgeschrieben, und der Typ erzwingt, dass ein neuer Schluessel hier
 * eine Entscheidung bekommt.
 */

/** Schluessel, deren Betrag ein **Anteil** ist - alles andere ist ein Zaehlwert mit Einheit. */
export const FACTOR_KEYS: ReadonlySet<GlobalKey | SpecialKey> = new Set<GlobalKey | SpecialKey>([
  'stationHp',
  'goldBonus',
  'collectRadius',
  'xpBonus',
  'bossGold',
  'critDamage',
  'overdriveChance',
  'overdrivePower',
  'lastStandThreshold',
  'chillFactor',
  'blastShare',
  'buffPower',
  'strongestBonus',
])

/**
 * Wirkt dieser Effekt anteilig?
 *
 * Regeln und Fenster haben gar keinen Betrag und sind deshalb weder das eine noch das
 * andere - sie zaehlen als "nicht anteilig", weil die Frage bei ihnen nicht gestellt wird.
 *
 * `flat` ist immer ein Zaehlwert, auch bei `critChance`: Dort steht der Betrag in
 * Prozentpunkten (0,01 ist "ein Prozentpunkt mehr Trefferchance"), und der Spieler liest
 * "+1 %". Ein Anteil waere es, wenn er die vorhandene Chance vervielfachte.
 */
export function isFactor(effect: UpgradeEffect): boolean {
  if (effect.kind === 'percent') return true
  if (effect.kind === 'global' || effect.kind === 'special') return FACTOR_KEYS.has(effect.key)
  return false
}

export function targetTowers(target: UpgradeTarget): string[] {
  switch (target.kind) {
    case 'modules':
    case 'turrets':
      return TOWERS.map((tower) => tower.id)
    case 'class':
      return towersOfClass(target.class).map((tower) => tower.id)
    case 'towers':
      return [...target.ids]
    case 'core':
    case 'station':
      return []
  }
}
