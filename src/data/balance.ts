/**
 * Alle Kurven, Faktoren und Obergrenzen an einem Ort.
 *
 * Regel (Implementierungsplan Abschnitt 9): Zahlen stehen hier, nicht in `sim/`.
 * Balance wird ueber Werte geaendert, nicht ueber Code (GDD 16 Abschnitt 5).
 *
 * ACHTUNG - PLATZHALTER: Wellenfaktor, Turm-Basiswerte, XP-Kurve, Prestige-Formel und
 * Drop-Chancen sind laut GDD 15 Abschnitt 16 noch offen. Sie werden nach E9 am laufenden
 * Spiel gegen die 30-60-Minuten-Vorgabe justiert. Alles, was hier mit PLATZHALTER
 * markiert ist, ist eine begruendete Annahme, kein abgestimmter Wert.
 */

import type { Rarity, StatKey } from './types.ts'

// ---------------------------------------------------------------------------
// Simulation und Leistung
// ---------------------------------------------------------------------------

/** Simulationsschritte pro Sekunde (GDD 16 Abschnitt 12). */
export const TICK_RATE = 60

/** Waehlbare Spielgeschwindigkeiten. x2/x4 werden ueber Prestige freigeschaltet. */
export const SPEED_FACTORS = [1, 2, 4] as const

/**
 * Obergrenzen fuer das Zeichenbudget (GDD 16 Abschnitt 12).
 *
 * **In E18 gemessen** - sechzig Simulationssekunden je Welle, volle Station aus sieben
 * mythischen Tuermen, Upgrades am Anschlag:
 *
 *   Welle   Gegner  Geschosse  Muenzen   je Takt
 *      50       43         28       67     37 us
 *     200       57         48        0     36 us
 *     500       98         44        0     42 us
 *   1.000      178         43        0     52 us
 *
 * Was die Messung sagt:
 *
 * **Der Gegnerdeckel ist der einzige, der wirklich greift.** Auf Welle 1.000 stehen 178
 * Gegner gleichzeitig - nicht weil so viele erscheinen, sondern weil sie sich an der
 * Station stauen, wenn die Feuerkraft nicht mehr reicht. Genau das ist der Fall, fuer den
 * der Deckel da ist. Er bleibt bei 200: Die Welle verliert dadurch keinen Gegner, er
 * erscheint nur spaeter (GDD 16 Abschnitt 12).
 *
 * **Der Geschossdeckel ist reichlich bemessen** - gemessen sind 48 gegen 600. Er bleibt
 * trotzdem stehen: Er kostet nichts und faengt eine spaetere Station mit deutlich mehr
 * Turmplaetzen ab, ohne dass jemand ihn dann erst suchen muss.
 *
 * **Die Zeit je Takt liegt bei 37 bis 52 Mikrosekunden.** Bei Tempo x4 sind das 240 Takte
 * je Sekunde und damit 9 bis 13 Millisekunden - das Zeichnen hat davon unabhaengig seine
 * eigenen 16,7. Die Simulation ist also auch im schlimmsten gemessenen Fall nicht der
 * Flaschenhals.
 */
export const MAX_ENEMIES = 200
export const MAX_PROJECTILES = 600
export const MAX_COINS = 250

// ---------------------------------------------------------------------------
// Speichern
// ---------------------------------------------------------------------------

/** Abstand der Hintergrund-Sicherung in Sekunden Spielzeit (GDD 16 Abschnitt 8). */
export const AUTOSAVE_INTERVAL_SECONDS = 5

// ---------------------------------------------------------------------------
// Startzustand (GDD 14 Abschnitt 3)
// ---------------------------------------------------------------------------

export const START_CORE_ID = 'sentinel'
export const START_TOWER_IDS = ['autocannon', 'cannon', 'amplifier'] as const
/** Turmplaetze zusaetzlich zum Hauptturm. */
export const START_TOWER_SLOTS = 4
export const START_ABILITY_SLOTS = 1
export const MAX_ABILITY_SLOTS = 3
export const START_WAVE = 1
export const START_GOLD = 0
export const START_LEVEL = 1

// ---------------------------------------------------------------------------
// Kurven - PLATZHALTER bis nach E9
// ---------------------------------------------------------------------------

/** Kosten der Upgrade-Stufe: Basiswert x Stufe^1,15 (GDD 08). */
export const UPGRADE_COST_EXPONENT = 1.15

/**
 * Turmkauf (GDD 06 Abschnitt 2).
 *
 * `Preis = TOWER_BASE_COST x TOWER_COST_FACTOR^(bereits gekaufte Tuerme)`. Das GDD nennt
 * die Reihe 100 / 150 / 225 / 337 und stellt ausdruecklich klar, dass **der Faktor 1,5
 * verbindlich** ist und die genaue Kurve ein Tuning-Wert - ein frueherer Entwurf hatte eine
 * steilere Reihe (100 / 250 / 600 / 1500).
 *
 * Daraus entsteht die Kernentscheidung des Spiels: neuer Turm oder Gold in die vorhandenen?
 */
export const TOWER_BASE_COST = 100
export const TOWER_COST_FACTOR = 1.5

/** Wie viele Tuerme beim Kauf zur Wahl stehen (GDD 06 Abschnitt 1). */
export const TOWER_OFFER_SIZE = 2

/** Wie viele Tuerme ein Schmelzgang verlangt (GDD 06 Abschnitt 5). */
export const MELT_COST = 3

/** PLATZHALTER - zentralster Balancing-Wert, GDD 15 Abschnitt 16. */
export const WAVE_SCALING = 1.1

/** PLATZHALTER - Boss alle n Wellen (GDD 07). */
export const BOSS_WAVE_INTERVAL = 10

// ---------------------------------------------------------------------------
// Station, Raritaeten und Buffs
// ---------------------------------------------------------------------------

/** PLATZHALTER - gemeinsame Stations-HP ohne Support-Module (GDD 03 Abschnitt 5). */
export const BASE_STATION_HP = 1000

/** PLATZHALTER - Faktor auf Kampfwerte und Buffstaerke je Seltenheitsstufe. */
export const RARITY_MULT: Record<Rarity, number> = {
  common: 1.0,
  rare: 1.15,
  epic: 1.35,
  legendary: 1.6,
  mythic: 2.0,
}

/**
 * Obergrenzen je Wert (GDD 03 Abschnitt 9 nennt +100 % Angriffstempo als Beispiel).
 * Der Deckel greift **nach** dem Aufsummieren - das ist der Grund, warum Buffs additiv
 * stapeln muessen: multiplikativ waere die Grenze wirkungslos.
 */
export const BUFF_CAPS: Record<StatKey, number> = {
  attackSpeed: 1.0,
  damage: 1.0,
  range: 0.5,
  critChance: 0.25,
  projectileSpeed: 1.0,
}

/**
 * PLATZHALTER bis E12: Startmodule, damit ueberhaupt gebaut werden kann. Laut GDD 14
 * Abschnitt 3 sind zu Beginn nur die **Turmarten** freigeschaltet; die Exemplare kauft der
 * Spieler ab E12 mit Gold. Bis dahin bekommt er hier eines je Art.
 */
export const START_INVENTORY: readonly { defId: string; rarity: Rarity }[] = [
  { defId: 'autocannon', rarity: 'common' },
  { defId: 'cannon', rarity: 'common' },
  { defId: 'amplifier', rarity: 'common' },
]

// ---------------------------------------------------------------------------
// Gegner und Wellen (GDD 07) - alles PLATZHALTER bis zum Justieren nach E9
// ---------------------------------------------------------------------------

/** Werte eines Standard-Gegners auf Welle 1. Alle Gegnerarten sind Vielfache davon. */
export const ENEMY_BASE_HP = 20
export const ENEMY_BASE_DAMAGE = 4
/** Welteinheiten pro Sekunde. Eine Modulkante ist 56 Einheiten lang. */
export const ENEMY_BASE_SPEED = 40
/** Abstand zwischen zwei Schlaegen eines angedockten Gegners, in Sekunden. */
export const ENEMY_ATTACK_INTERVAL = 1

/**
 * Tempozuschlag, solange ein Gegner ausserhalb **jedes** Wirkungskreises laeuft
 * (GDD 07 Abschnitt 2).
 *
 * Der Erscheinungsring liegt `SPAWN_RING_MARGIN` = 420 Einheiten vor der Station, ein
 * Standardgegner braucht dafuer ueber zehn Sekunden - Zeit, in der nichts geschieht, weil
 * ihn ohnehin kein Turm erreicht. Der Anmarsch ist keine Spielentscheidung, also darf er
 * schnell sein; interessant wird es erst innerhalb der Reichweite.
 *
 * Die Grenze ist **dieselbe**, an der auch die Zielwahl greift (`sim/targeting.ts`): Sobald
 * der Gegner einen Wirkungskreis beruehrt, faellt er auf sein normales Tempo zurueck. Damit
 * bedeutet der gezeichnete Bereich genau eine Sache - "hier kann geschossen werden" -, und
 * der Spieler sieht den Wechsel an derselben Linie, an der die ersten Schuesse fallen.
 */
export const ENEMY_APPROACH_SPEED_FACTOR = 2

/** Gegneranzahl je Welle: Grundmenge plus Zuwachs je Welle. */
export const WAVE_BASE_COUNT = 8
export const WAVE_COUNT_GROWTH = 1.5

/**
 * Wachstum je Welle als `Faktor^(Welle-1)` - bewusst nicht linear (GDD 07 Abschnitt 12).
 * `WAVE_SCALING` ist der zentralste Balancing-Wert des Spiels (GDD 15 Abschnitt 16).
 */
export const WAVE_DAMAGE_SCALING = 1.07
export const WAVE_SPEED_SCALING = 1.01
/** Obergrenze des Tempozuwachses, damit spaete Gegner nicht durch die Station fliegen. */
export const MAX_SPEED_SCALE = 3
export const REWARD_SCALING = 1.06

/** Wie weit ausserhalb der Station die Gegner erscheinen, in Welteinheiten. */
export const SPAWN_RING_MARGIN = 420

/**
 * Elite-Gegner (GDD 07 Abschnitt 6).
 *
 * **Vor Welle 50 gibt es keine** - das steht so im GDD und ist keine Bequemlichkeit: Der
 * Spieler soll erst die Grundgegner kennen, bevor Varianten dazukommen. Danach waechst die
 * Chance je Welle und wird gedeckelt; eine Welle, in der jeder Gegner ein Elite ist, waere
 * keine Steigerung mehr, sondern nur eine andere Grundschwierigkeit.
 *
 * PLATZHALTER - die konkreten Prozentwerte sind Tuning-Werte (GDD 07 Abschnitt 6,
 * GDD 15 Abschnitt 16). Nachgerechnet: Welle 100 ergibt 5 %, Welle 300 ergibt 25 %,
 * ab Welle 550 greift der Deckel von 45 %.
 */
export const ELITE_FROM_WAVE = 50
export const ELITE_CHANCE_GROWTH = 0.001
export const ELITE_MAX_CHANCE = 0.45

/**
 * Obergrenze, bis zu der ein Verstaerker denselben Gegner hochziehen darf.
 *
 * Ohne sie schaukeln sich zwei Verstaerker im Umkreis gegenseitig hoch, und zwar in **jedem
 * Takt** - nach einer Minute stuende dort ein Gegner mit astronomischen Werten. Der Deckel
 * ist keine Balance-Entscheidung, sondern die Absicherung einer Rueckkopplung.
 */
export const EMPOWER_CAP = 3

/** Pause zwischen zwei Wellen - Zeit zum Umbauen und Einsammeln (GDD 07 Abschnitt 10). */
export const WAVE_PAUSE_SECONDS = 3

/** Zeitraum, ueber den die Gegner einer Welle gestaffelt erscheinen. */
export const WAVE_SPAWN_WINDOW_SECONDS = 20

// ---------------------------------------------------------------------------
// Geschosse (GDD 05)
// ---------------------------------------------------------------------------

/** Nach dieser Flugzeit verfaellt ein Geschoss, falls es sein Ziel nie erreicht. */
export const PROJECTILE_MAX_LIFETIME = 4

/** Zusatzschaden eines kritischen Treffers. */
export const CRIT_MULTIPLIER = 2

// ---------------------------------------------------------------------------
// Gold auf dem Feld (GDD 08 Abschnitt 2)
// ---------------------------------------------------------------------------

/**
 * Sammelradius beim Ueberfahren, in Welteinheiten. Ausbaubar ueber globale Upgrades.
 *
 * Bewusst so gross wie ein Stapel (`COIN_MERGE_RADIUS`) und nicht groesser: Ein Zug mit der
 * Maus soll **einen** Haufen aufnehmen, nicht das halbe Feld. Vorher standen hier 90 - fast
 * das Dreifache; das Gold sprang dann schon in die Anzeige, bevor man ueberhaupt hinzeigte,
 * und das Einsammeln, das laut GDD 08 Abschnitt 2 die zentrale aktive Handlung ist, kostete
 * nichts mehr. Der Kreis dazu wird nicht mehr gezeichnet - was der Zeiger erreicht, merkt
 * man daran, dass Muenzen losfliegen.
 */
export const COLLECT_RADIUS = 34

/** Muenzen naeher beieinander als dies verschmelzen zu einem Stapel. */
export const COIN_MERGE_RADIUS = 34

/**
 * Ab dieser Zahl liegender Muenzen wird verdichtet. Muenzen verfallen nie, also muss die
 * Zahl der Objekte begrenzt bleiben - nicht ihr Wert.
 */
export const COIN_MERGE_THRESHOLD = 60

// ---------------------------------------------------------------------------
// Wellensteuerung und Bosse (GDD 07 Abschnitt 7 und 10)
// ---------------------------------------------------------------------------

/** Vielfaches der Grundwerte fuer einen Boss auf seiner Welle. */
export const BOSS_HP_MULT = 40
export const BOSS_DAMAGE_MULT = 4
export const BOSS_SPEED_MULT = 0.45
export const BOSS_GOLD_MULT = 100
export const BOSS_XP_MULT = 60

// ---------------------------------------------------------------------------
// Level und Perks (GDD 09 Teil A)
// ---------------------------------------------------------------------------

/**
 * XP fuer den Aufstieg **von** Stufe `n` auf `n + 1`: `XP_BASE x n^XP_EXPONENT`.
 *
 * GDD 09 Abschnitt 2 nennt drei Richtwerte: Level 1 = 100, Level 10 = 5.000,
 * Level 50 = 100.000. Ein reines Potenzgesetz kann alle drei nicht zugleich treffen -
 * Level 10 verlangt den Exponenten 1,699, Level 50 verlangt 1,766. Nachgerechnet:
 *
 *   Exponent   Level 1   Level 10          Level 50
 *   1,70       100       5.012  (+0,2 %)   77.312  (-22,7 %)
 *   1,74       100       5.495  (+9,9 %)   90.408  ( -9,6 %)
 *   1,766      100       5.834 (+16,7 %)  100.088  ( +0,1 %)
 *
 * Gewaehlt ist 1,74: Level 1 stimmt exakt, die beiden anderen liegen beide unter zehn
 * Prozent daneben statt einer exakt und einer um ein Fuenftel. Die Werte sind laut GDD
 * ausdruecklich Richtwerte, und die Kurve wird ohnehin nach E9 am laufenden Spiel justiert
 * (GDD 15 Abschnitt 16).
 */
export const XP_BASE = 100
export const XP_EXPONENT = 1.74

/**
 * Sicherheitsgrenze fuer die Stufensuche, **keine** Spielregel.
 *
 * `levelFromXp` zaehlt Stufen hoch, bis die Erfahrung nicht mehr reicht. Bei einem
 * manipulierten oder kaputten Spielstand mit absurd viel XP liefe diese Schleife sonst
 * praktisch endlos. Erreichbar ist die Grenze nicht: Stufe 1000 verlangt ueber 10^8 XP -
 * ein Vielfaches dessen, was in einem Run je zusammenkommt.
 */
export const MAX_LEVEL = 1000

/** Wie viele Perks bei einem Aufstieg zur Auswahl stehen (GDD 09 Abschnitt 2). */
export const PERK_CHOICES = 3

// ---------------------------------------------------------------------------
// Prestige (GDD 10)
// ---------------------------------------------------------------------------

/** Voraussetzung fuer ein Prestige: so viel Gold muss der Run insgesamt gebracht haben. */
export const PRESTIGE_MIN_GOLD = 1000

/**
 * Punkteformel: `(Wellenrekord / DIVISOR)^EXPONENT + Gold / GOLD_PER_POINT`.
 *
 * Die Welle steht im Quadrat, weil GDD 10 Abschnitt 5 "ueberproportional mehr Punkte"
 * verlangt; das Gold nur linear, weil es ohnehin mit der Welle waechst und beides
 * ueberproportional dieselbe Leistung zweimal belohnen wuerde. Die Herleitung samt Abgleich
 * gegen die Richtwerte steht bei `prestigePoints` in `sim/prestige.ts`.
 *
 * PLATZHALTER wie die Wellenkurve: wird nach E9 am laufenden Spiel justiert (GDD 15 §16).
 */
export const PRESTIGE_WAVE_DIVISOR = 45
export const PRESTIGE_WAVE_EXPONENT = 2
export const GOLD_PER_PRESTIGE_POINT = 25000

// ---------------------------------------------------------------------------
// Ereignisse und Versorgungskapseln (GDD 11)
// ---------------------------------------------------------------------------

/**
 * Wellenabstand zwischen zwei Ereignissen (GDD 11 Abschnitt 2: Richtwert 15 bis 25 Wellen).
 *
 * Der Abstand wird **gewuerfelt**, nicht fest gesetzt: Ein Ereignis, das verlaesslich alle
 * zwanzig Wellen kommt, ist ein Termin und kein Moment.
 */
export const EVENT_WAVE_MIN = 15
export const EVENT_WAVE_MAX = 25

/**
 * Grundbetrag einer Ereignis- oder Kapselbelohnung auf dieser Welle.
 *
 * Er waechst mit derselben Kurve wie die Gegnerbelohnung, weil er dasselbe messen soll:
 * was eine Welle auf dieser Hoehe wert ist. Ein fester Betrag waere fruh ein Vermoegen und
 * spaet nicht der Rede wert - und ein Ereignis darf beides nicht sein (GDD 11 Abschnitt 9).
 *
 * Der Grundwert entspricht ungefaehr dem Gold, das ein Dutzend Standardgegner faellen
 * laesst. PLATZHALTER wie alle Kurven - justiert wird nach E9 am laufenden Spiel.
 */
export const EVENT_REWARD_BASE = 120

export function eventRewardFor(wave: number): number {
  return Math.round(EVENT_REWARD_BASE * Math.pow(REWARD_SCALING, Math.max(0, wave - 1)))
}

/**
 * Chance, dass ein besiegter Gegner eine Versorgungskapsel fallen laesst
 * (GDD 11 Abschnitt 2).
 *
 * Klein bei normalen Gegnern, deutlich hoeher bei Elites und Bossen - genau das steht im
 * GDD. Bei rund 150 Gegnern je Welle ergibt ein halbes Prozent etwa eine Kapsel pro Welle;
 * mehr wuerde aus dem Gluecksfall eine Grundversorgung machen.
 */
export const POD_DROP_CHANCE = 0.005
export const POD_DROP_CHANCE_ELITE = 0.04
export const POD_DROP_CHANCE_BOSS = 1

/** Mehr Kapseln als das duerfen nicht gleichzeitig liegen - dieselbe Regel wie bei Muenzen. */
export const MAX_PODS = 12

/** Sammelradius einer Kapsel. Groesser als bei Muenzen: Sie ist ein Gegenstand, kein Krumen. */
export const POD_COLLECT_RADIUS = 44

// ---------------------------------------------------------------------------
// Haendler-Drohne (GDD 11 Abschnitt 7)
// ---------------------------------------------------------------------------

/**
 * Wellenabstand zwischen zwei Besuchen.
 *
 * Haeufiger als ein Ereignis (15 bis 25) und aus einem klaren Grund: Ein Ereignis stellt
 * sich vor den Spieler und verlangt eine Entscheidung, die Drohne stellt sich **daneben**
 * und wartet. Wer keine Zeit hat, laesst sie stehen - sie kostet nichts als die Gelegenheit.
 */
export const TRADER_WAVE_MIN = 8
export const TRADER_WAVE_MAX = 14

/**
 * Wie lange sie bleibt, in Simulationssekunden ("landet **kurzzeitig**", GDD 11 §7).
 *
 * Lang genug, um eine Welle zu Ende zu spielen und dann hinzufahren; kurz genug, dass es
 * eine Entscheidung bleibt, ob man das Feld dafuer verlaesst. Sobald der Spieler sie
 * erreicht hat, laeuft die Zeit nicht weiter - ein Laden, der waehrend des Einkaufs
 * abhebt, waere kein Angebot, sondern eine Falle.
 */
export const TRADER_STAY_SECONDS = 50

/** Wie viele Posten sie mitbringt. Drei - dieselbe Breite wie ein Perk-Angebot. */
export const TRADER_STOCK_SIZE = 3

/** Wie nah der Zeiger kommen muss, damit sie oeffnet. Weiter als bei einer Kapsel. */
export const TRADER_REACH = 60

/** Wie weit von der Station entfernt sie landet, in Welteinheiten. */
export const TRADER_DISTANCE_MIN = 190
export const TRADER_DISTANCE_MAX = 330

// ---------------------------------------------------------------------------
// Offline-Fortschritt (GDD 12 Teil A)
// ---------------------------------------------------------------------------

/**
 * Obergrenze der Abwesenheit, die angerechnet wird (GDD 12 Abschnitt 7: "Richtwert:
 * mehrere Stunden").
 *
 * Vier Stunden. Der Wert ist **an der Messung entstanden**, nicht am Gefuehl: Die Rechnung
 * laeuft beim Zurueckkommen vor dem ersten Bild, und sie kostet Zeit, die der Spieler als
 * haengendes Fenster erlebt. Gemessen (E18, volle Station) kostet ein voller Deckel 1,9 bis
 * 2,7 Sekunden. Acht Stunden waeren das Doppelte gewesen - und vier Sekunden Stillstand vor
 * dem ersten Bild sind keine Belohnung mehr, sondern ein Fehler.
 */
export const OFFLINE_MAX_SECONDS = 4 * 3600

/** Kuerzere Abwesenheiten lohnen die Rechnung nicht und werden verworfen. */
export const OFFLINE_MIN_SECONDS = 60

/**
 * Takte je Sekunde in der Offline-Rechnung.
 *
 * Es ist **dieselbe** Simulation, nur mit groesserem Schritt - der Plan verlangt
 * ausdruecklich keine zweite Logik. Der groebere Schritt ist unbedenklich: Geschosse
 * treffen, sobald sie ihr Ziel in diesem Schritt erreichen wuerden (nie daneben), und
 * Tuerme feuern mehrfach je Takt, wenn ihr Tempo hoeher liegt als die Taktrate.
 *
 * 20 Hz statt 60 Hz drittelt die Rechenzeit. Bei acht Stunden und halber Effizienz sind es
 * rund 290.000 Takte - das laeuft in wenigen Sekunden durch, waehrend das Fenster noch die
 * Rueckkehr-Zusammenfassung aufbaut.
 */
export const OFFLINE_TICK_RATE = 20

/**
 * Obergrenze an Takten fuer **eine** Offline-Rechnung.
 *
 * Sie ist keine Balance-Entscheidung, sondern eine Zusage an den Spieler: Der Bildaufbau
 * beim Zurueckkommen darf nicht spuerbar haengen.
 *
 * Reicht die Grenze fuer die angerechnete Zeit nicht, wird der **Schritt groeber** statt
 * die Zeit gekuerzt. Der Spieler bekommt so die volle Abwesenheit angerechnet; ungenauer
 * wird nur die Aufloesung, mit der sie nachgespielt wird. Beim vollen Deckel landet der
 * Schritt bei rund einer Sechstelsekunde - ein Gegner wandert darin sieben Welteinheiten,
 * also weniger als sein eigener Durchmesser.
 *
 * Andersherum - Zeit kuerzen, Aufloesung halten - haette der Spieler weniger bekommen und
 * es nicht einmal gemerkt.
 */
export const OFFLINE_MAX_TICKS = 60_000

/**
 * Wie viel von der Abwesenheit tatsaechlich simuliert wird.
 *
 * GDD 12 Abschnitt 7: Offline **darf nie staerker sein als aktives Spielen**. Der Abschlag
 * sitzt an der Zeit und nicht an der Belohnung - dadurch faellt alles gleichmaessig
 * geringer aus (Gold, Erfahrung, Wellenfortschritt), und es braucht keinen zweiten Weg
 * durch die Belohnungsrechnung.
 *
 * Der Prestige-Knoten "Verbesserte Simulation" und der Goldsammler heben den Wert an
 * (GDD 12 Abschnitt 11: "Offline erhoeht der Goldsammler die Goldausbeute").
 */
export const OFFLINE_BASE_EFFICIENCY = 0.4
export const OFFLINE_IMPROVED_BONUS = 0.3
export const OFFLINE_COLLECTOR_BONUS = 0.1
export const OFFLINE_MAX_EFFICIENCY = 0.9

// ---------------------------------------------------------------------------
// Helfer (GDD 12 Teil B)
// ---------------------------------------------------------------------------

/**
 * Der Goldsammler (GDD 12 Abschnitt 11).
 *
 * Er ist **keine Kampfeinheit** (GDD 12 Abschnitt 9): Er faehrt ueber das Feld und hebt
 * Gold auf, das der Spieler sonst selbst holen muesste. Sein Radius und sein Tempo wachsen
 * mit der gekauften Stufe, seine Anzahl mit den Prestige-Knoten.
 */
export const HELPER_BASE_SPEED = 120
export const HELPER_SPEED_PER_LEVEL = 14
export const HELPER_BASE_RADIUS = 30
export const HELPER_RADIUS_PER_LEVEL = 5
/** Wie weit ein Helfer sich von der Station entfernt - er soll nicht ins Nichts fahren. */
export const HELPER_MAX_DISTANCE = 900

// ---------------------------------------------------------------------------
// Upgrades (GDD 08 Abschnitt 6)
// ---------------------------------------------------------------------------

/**
 * `Kosten = Basiswert x Stufe^1,15` (GDD 08 Abschnitt 6). Das GDD nennt daneben eine
 * Beispielkurve (100/150/225/...), die einer Verdopplung naeher kaeme - verbindlich ist
 * ausdruecklich die Formel, die Kurve ist ein Tuning-Wert.
 */
export function upgradeCost(base: number, nextLevel: number): number {
  return Math.round(base * Math.pow(Math.max(1, nextLevel), UPGRADE_COST_EXPONENT))
}

