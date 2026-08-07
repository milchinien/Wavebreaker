/**
 * Der Prestige-Baum als Datensatz (GDD 10 Abschnitt 6).
 *
 * **Jede Freischaltung ist ein Knoten, und jede Abfrage danach ist eine Datenabfrage.**
 * Das ist die Regel aus GDD 16 Abschnitt 2 und Abschnitt 3 des Implementierungsplans: Im
 * ganzen Spiel steht kein `if (spielerHatRare)`, sondern `isUnlocked(state, 'rarity.rare')`.
 * Nur so bleibt der Baum erweiterbar, ohne dass an zehn Stellen Code dazukommt.
 *
 * **Es steht hier nur, was das Spiel heute auch wirklich tut.** Die Bereiche Spezialtuerme
 * (E14), Abwesenheitsertrag und Helfer (E17) sind dazugekommen, weil es die Systeme jetzt
 * gibt. Offen bleiben Haupttuerme (es gibt bisher einen einzigen Kern) und
 * Basisverbesserungen. Einen Knoten anzubieten, der Punkte kostet und nichts freischaltet,
 * waere Betrug am Spieler. Sie sind spaeter **Eintraege in dieser Datei**, kein neuer Code.
 */

export type PrestigeArea =
  | 'economy'
  | 'towers'
  | 'speed'
  | 'rarity'
  | 'traits'
  | 'tech'
  | 'helpers'

export type PrestigeNode = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  label: string
  area: PrestigeArea
  cost: number
  /** Alle Voraussetzungen muessen gekauft sein, sonst bleibt der Knoten gesperrt. */
  requires: readonly string[]
  description: string
}

/*
 * Die Kosten stammen aus GDD 10 - Bereich fuer Bereich uebernommen. Wo das GDD keine Zahl
 * nennt (XP-Bonus), ist sie zwischen die Nachbarn gesetzt.
 *
 * Die Voraussetzungen bilden die Ketten des GDD ab: Raritaeten und Eigenschaften bauen
 * jeweils aufeinander auf, die Tempostufen ebenso. Wirtschaft und Turmplaetze stehen frei -
 * sie sind der Einstieg, und ein Baum, dessen erste Knoten schon Voraussetzungen haben,
 * waere keine Wahl (GDD 10 Abschnitt 8: es soll verschiedene Wege geben).
 */
export const PRESTIGE_NODES: readonly PrestigeNode[] = [
  // --- Bereich 1: Wirtschaft ---
  {
    id: 'eco.gold1',
    label: 'Gold Amplification',
    area: 'economy',
    cost: 10,
    requires: [],
    description: '+10% gold from enemies.',
  },
  {
    id: 'eco.xp1',
    label: 'Combat Telemetry',
    area: 'economy',
    cost: 40,
    requires: [],
    description: '+25% experience from kills.',
  },
  {
    id: 'eco.gold2',
    label: 'Advanced Economy',
    area: 'economy',
    cost: 50,
    requires: ['eco.gold1'],
    description: '+25% gold from enemies.',
  },
  {
    id: 'eco.gold3',
    label: 'Wealth System',
    area: 'economy',
    cost: 250,
    requires: ['eco.gold2'],
    description: '+50% gold from enemies.',
  },
  /*
   * Der Abwesenheitsertrag (GDD 12 Abschnitt 1 und GDD 10, Bereich 1). Beide Zahlen stehen
   * so im GDD: 100 fuer die Freischaltung, 500 fuer die bessere Simulation.
   *
   * Er steht ohne Voraussetzung da: Es ist die Freischaltung, die aus dem Spiel ein
   * Idle-Spiel macht, und der Weg dorthin soll nicht erst durch die Goldkette fuehren.
   */
  {
    id: 'eco.offline',
    label: 'Offline Production',
    area: 'economy',
    cost: 100,
    requires: [],
    description: 'The station keeps fighting while you are away.',
  },
  {
    id: 'eco.offline2',
    label: 'Improved Simulation',
    area: 'economy',
    cost: 500,
    requires: ['eco.offline'],
    description: 'Offline time counts for much more.',
  },

  // --- Bereich 2: Tuerme und Slots ---
  {
    id: 'towers.slot1',
    label: 'Extra Tower Slot',
    area: 'towers',
    cost: 100,
    requires: [],
    description: '+1 tower slot.',
  },
  {
    id: 'towers.slot2',
    label: 'Reinforced Frame',
    area: 'towers',
    cost: 400,
    requires: ['towers.slot1'],
    description: '+1 tower slot.',
  },
  {
    id: 'towers.slot3',
    label: 'Expanded Base',
    area: 'towers',
    cost: 1500,
    requires: ['towers.slot2'],
    description: '+1 tower slot.',
  },
  {
    id: 'towers.ability2',
    label: 'Ability Slot II',
    area: 'towers',
    cost: 400,
    requires: [],
    description: 'Unlocks the second ability slot.',
  },
  {
    id: 'towers.ability3',
    label: 'Ability Slot III',
    area: 'towers',
    cost: 2000,
    requires: ['towers.ability2'],
    description: 'Unlocks the third and last ability slot.',
  },

  // --- Bereich 2b: Spielgeschwindigkeit ---
  {
    id: 'speed.x2',
    label: 'Acceleration I',
    area: 'speed',
    cost: 300,
    requires: [],
    description: 'Unlocks game speed x2.',
  },
  {
    id: 'speed.x4',
    label: 'Acceleration II',
    area: 'speed',
    cost: 3000,
    requires: ['speed.x2'],
    description: 'Unlocks game speed x4.',
  },

  // --- Bereich 3: Raritaeten ---
  {
    id: 'rarity.rare',
    label: 'Rare Towers',
    area: 'rarity',
    cost: 50,
    requires: [],
    description: 'Rare towers can appear.',
  },
  {
    id: 'rarity.epic',
    label: 'Epic Towers',
    area: 'rarity',
    cost: 250,
    requires: ['rarity.rare'],
    description: 'Epic towers can appear.',
  },
  {
    id: 'rarity.legendary',
    label: 'Legendary Towers',
    area: 'rarity',
    cost: 1000,
    requires: ['rarity.epic'],
    description: 'Legendary towers can appear.',
  },
  {
    id: 'rarity.mythic',
    label: 'Mythic Towers',
    area: 'rarity',
    cost: 5000,
    requires: ['rarity.legendary'],
    description: 'Mythic towers can appear.',
  },

  /*
   * --- Bereich 4: Spezialtuerme (GDD 10, Bereich 4) ---
   *
   * Die Kosten stammen aus GDD 05 und GDD 10 - beide nennen dieselben Zahlen. Diese Tuerme
   * "erscheinen erst nach Freischaltung im normalen Turmkauf": Der Knoten setzt sie auf
   * `permanent.unlockedTowers`, und `sim/shop.ts` bietet nur an, was dort steht.
   *
   * Sie sind **keine besseren Tuerme** (GDD 05 Abschnitt 6), sondern andere - deshalb
   * stehen sie nebeneinander und nicht in einer Kette. Wer Raketen will, muss nicht erst
   * den Laser kaufen.
   */
  {
    id: 'tech.rocket',
    label: 'Rocket Technology',
    area: 'tech',
    cost: 150,
    requires: [],
    description: 'Rocket batteries appear in the tower shop.',
  },
  {
    id: 'tech.laser',
    label: 'Laser Technology',
    area: 'tech',
    cost: 250,
    requires: [],
    description: 'Laser lances appear in the tower shop.',
  },
  {
    id: 'tech.tesla',
    label: 'Tesla Technology',
    area: 'tech',
    cost: 500,
    requires: [],
    description: 'Tesla coils appear in the tower shop.',
  },
  {
    id: 'tech.drone',
    label: 'Drone Technology',
    area: 'tech',
    cost: 2000,
    requires: [],
    description: 'Drone bays appear in the tower shop.',
  },
  {
    id: 'tech.plasma',
    label: 'Plasma Technology',
    area: 'tech',
    cost: 10000,
    requires: ['tech.laser'],
    description: 'Plasma cannons appear in the tower shop.',
  },

  /*
   * --- Bereich 7: Helfer (GDD 10, Bereich 7 und GDD 12 Abschnitt 10) ---
   *
   * Die Kosten stammen aus GDD 10. Der erste Knoten macht den Helfer **kaufbar** und
   * aktiviert ihn ausdruecklich nicht - gekauft wird er mit Gold im Upgrade-Menue. Genau
   * darum ist es eine Kette: Wer den Sammler nicht gekauft hat, hat von einem schnelleren
   * Sammler nichts, und der Baum soll keine Knoten anbieten, die ins Leere laufen.
   */
  {
    id: 'helper.collector',
    label: 'Gold Collector',
    area: 'helpers',
    cost: 500,
    requires: [],
    description: 'A collector drone becomes purchasable in the upgrade menu.',
  },
  {
    id: 'helper.better',
    label: 'Improved Collector',
    area: 'helpers',
    cost: 2000,
    requires: ['helper.collector'],
    description: 'Doubles the collector pickup radius.',
  },
  {
    id: 'helper.fast',
    label: 'Fast Collector',
    area: 'helpers',
    cost: 5000,
    requires: ['helper.better'],
    description: 'A second collector, and both move much faster.',
  },
  {
    id: 'helper.elite',
    label: 'Elite Collector',
    area: 'helpers',
    cost: 15000,
    requires: ['helper.fast'],
    description: 'A third collector joins the field.',
  },

  // --- Bereich 6: Turm-Eigenschaften ---
  {
    id: 'trait.rare',
    label: 'Rare Modifiers',
    area: 'traits',
    cost: 200,
    requires: ['rarity.rare'],
    description: 'Towers can roll rare modifiers.',
  },
  {
    id: 'trait.epic',
    label: 'Epic Modifiers',
    area: 'traits',
    cost: 1000,
    requires: ['trait.rare'],
    description: 'Towers can roll epic modifiers.',
  },
  {
    id: 'trait.legendary',
    label: 'Legendary Modifiers',
    area: 'traits',
    cost: 5000,
    requires: ['trait.epic'],
    description: 'Towers can roll legendary modifiers.',
  },
  {
    id: 'trait.mythic',
    label: 'Mythic Modifiers',
    area: 'traits',
    cost: 25000,
    requires: ['trait.legendary'],
    description: 'Towers can roll mythic modifiers.',
  },
]

const BY_ID = new Map(PRESTIGE_NODES.map((node) => [node.id, node]))

export function prestigeNodeById(id: string): PrestigeNode {
  const node = BY_ID.get(id)
  if (!node) throw new Error(`Unbekannter Prestige-Knoten: ${id}`)
  return node
}

export function isKnownPrestigeNode(id: string): boolean {
  return BY_ID.has(id)
}

export function nodesOfArea(area: PrestigeArea): PrestigeNode[] {
  return PRESTIGE_NODES.filter((node) => node.area === area)
}

