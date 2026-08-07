/**
 * Ereignisse und Versorgungskapseln als Datensatz (GDD 11).
 *
 * Beide sind bewusst **getrennte Mechanismen** (GDD 11 Abschnitt 2), und die Trennung ist
 * keine Laune: Kapseln sollen sich wie ein Gluecksfall im laufenden Kampf anfuehlen - dafuer
 * eignet sich eine Drop-Chance. Ereignisse unterbrechen den Ablauf und verlangen eine
 * Entscheidung; sie brauchen Abstand, damit sie ein Moment bleiben, und haengen deshalb an
 * der Welle.
 *
 * **Die Wirkung eines Ereignisses ist ein Datensatz, kein Code.** Es gibt genau vier
 * Wirkungsarten, und jede beschreibt etwas, das das Spiel ohnehin schon kann: Belohnung,
 * zeitlich begrenzter Wertbonus, zeitlich begrenzte Verstaerkung der Gegner, zusaetzliche
 * Gegner. Ein fuenftes Ereignis ist damit ein Eintrag in dieser Datei - so wie ein neuer
 * Turm einer in `data/towers.ts` ist.
 *
 * Spielsprache ist Englisch (GDD 16 Abschnitt 1); die Texte stehen wie bei Perks und
 * Prestige-Knoten direkt am Datensatz und nicht in `data/strings.ts`, weil sie **zum
 * Datensatz gehoeren** und mit ihm zusammen gelesen werden muessen.
 */

import type { Rarity, StatKey } from './types.ts'

// ---------------------------------------------------------------------------
// Ereignisse (GDD 11 Abschnitt 4 bis 6)
// ---------------------------------------------------------------------------

/**
 * Was eine gewaehlte Option bewirkt.
 *
 * `gold` und `xp` sind **Vielfache der Wellenbelohnung** (`eventRewardFor` in
 * `data/balance.ts`), keine festen Betraege. Ein fester Betrag waere auf Welle 5 ein
 * Vermoegen und auf Welle 500 nicht der Rede wert - und genau dann waeren Ereignisse
 * entweder staerker als gute Planung oder wertlos (GDD 11 Abschnitt 9).
 */
export type EventEffect =
  | { kind: 'reward'; gold?: number; xp?: number }
  | { kind: 'boon'; stats: Partial<Record<StatKey, number>>; duration: number }
  | { kind: 'hazard'; power: number; duration: number }
  | { kind: 'spawn'; defId: string; count: number; elite?: readonly string[] }

export type EventChoice = {
  id: string
  label: string
  /** Was die Wahl kostet oder riskiert - steht auf der Karte, bevor geklickt wird. */
  detail: string
  effects: readonly EventEffect[]
}

export type EventKind = 'risk' | 'choice'

export type GameEventDef = {
  id: string
  kind: EventKind
  title: string
  description: string
  /** Fruehestens ab dieser Welle. Ein Risiko-Ereignis auf Welle 3 waere kein Risiko. */
  minWave: number
  choices: readonly EventChoice[]
}

/*
 * Die vier Ereignisse aus GDD 11 Abschnitt 5 und 6, samt ihren Optionen.
 *
 * Jede Option hat eine **klare Folge**: Wer ein Risiko eingeht, sieht vorher, worin es
 * besteht. Ein Ereignis, dessen Optionen sich nur in der Belohnung unterscheiden, waere
 * keine Entscheidung, sondern eine Rechenaufgabe.
 *
 * Die sichere Option ist nie leer. "Ignorieren" bringt die normale Belohnung (GDD 11
 * Abschnitt 5) - sonst waere sie die Option, die man nie waehlt, und das Ereignis haette
 * in Wahrheit eine Option weniger.
 */
export const EVENTS: readonly GameEventDef[] = [
  {
    id: 'singularity',
    kind: 'risk',
    title: 'Unstable Singularity',
    description: 'A collapsing star has opened near the station. Its energy can be harvested.',
    minWave: 10,
    choices: [
      {
        id: 'stabilise',
        label: 'Stabilise',
        detail: 'Seal the rift. Nothing changes.',
        effects: [{ kind: 'reward', gold: 1 }],
      },
      {
        id: 'absorb',
        label: 'Absorb',
        detail: 'Enemies grow stronger for a while — much more gold and experience.',
        effects: [
          { kind: 'hazard', power: 1.5, duration: 60 },
          { kind: 'reward', gold: 6, xp: 6 },
        ],
      },
      {
        id: 'overload',
        label: 'Overload',
        detail: 'Something comes through. A large payout if you survive it.',
        effects: [
          { kind: 'spawn', defId: 'titan', count: 1, elite: ['elite.tough', 'elite.rich'] },
          { kind: 'reward', gold: 10 },
        ],
      },
    ],
  },
  {
    id: 'powersurge',
    kind: 'risk',
    title: 'Overloaded Power Source',
    description: 'An unknown reactor drifted into range. It can be tapped safely — or not.',
    minWave: 15,
    choices: [
      {
        id: 'safe',
        label: 'Draw safely',
        detail: 'A small, certain payout.',
        effects: [{ kind: 'reward', gold: 2 }],
      },
      {
        id: 'surge',
        label: 'Overcharge',
        detail: '+50% attack rate — but enemies hit 50% harder while it lasts.',
        effects: [
          { kind: 'boon', stats: { attackSpeed: 0.5 }, duration: 45 },
          { kind: 'hazard', power: 1.5, duration: 45 },
          { kind: 'reward', gold: 4, xp: 4 },
        ],
      },
    ],
  },
  {
    id: 'alientech',
    kind: 'choice',
    title: 'Alien Technology',
    description: 'A derelict module was recovered intact. Your crew asks what to do with it.',
    minWave: 5,
    choices: [
      {
        id: 'analyse',
        label: 'Analyse',
        detail: 'Study it for experience.',
        effects: [{ kind: 'reward', xp: 6 }],
      },
      {
        id: 'sell',
        label: 'Sell',
        detail: 'Trade it away for gold.',
        effects: [{ kind: 'reward', gold: 6 }],
      },
      {
        id: 'install',
        label: 'Install',
        detail: '+35% damage and +20% range for 90 seconds.',
        effects: [{ kind: 'boon', stats: { damage: 0.35, range: 0.2 }, duration: 90 }],
      },
    ],
  },
  {
    id: 'mutation',
    kind: 'choice',
    title: 'Enemy Mutation',
    description: 'Scans show an irregular cluster forming beyond the perimeter.',
    minWave: 20,
    choices: [
      {
        id: 'ignore',
        label: 'Ignore',
        detail: 'Let it pass. Nothing changes.',
        effects: [{ kind: 'reward', gold: 1 }],
      },
      {
        id: 'engage',
        label: 'Engage',
        detail: 'Pull the whole cluster in — more enemies, more experience.',
        effects: [
          { kind: 'spawn', defId: 'swarm', count: 10 },
          { kind: 'reward', xp: 5 },
        ],
      },
      {
        id: 'hunt',
        label: 'Hunt',
        detail: 'Draw out what is leading them. A heavy payout.',
        effects: [
          { kind: 'spawn', defId: 'behemoth', count: 1, elite: ['elite.rich'] },
          { kind: 'reward', gold: 9 },
        ],
      },
    ],
  },
]

const EVENT_BY_ID = new Map(EVENTS.map((event) => [event.id, event]))

export function eventById(id: string): GameEventDef {
  const event = EVENT_BY_ID.get(id)
  if (!event) throw new Error(`Unbekanntes Ereignis: ${id}`)
  return event
}

export function isKnownEvent(id: string): boolean {
  return EVENT_BY_ID.has(id)
}

/** Ereignisse, die auf dieser Welle ueberhaupt erscheinen duerfen. */
export function eventsForWave(wave: number): GameEventDef[] {
  return EVENTS.filter((event) => wave >= event.minWave)
}

// ---------------------------------------------------------------------------
// Versorgungskapseln (GDD 11 Abschnitt 8)
// ---------------------------------------------------------------------------

/**
 * Was in einer Kapsel steckt.
 *
 * `gold` und `xp` sind - wie bei Ereignissen - Vielfache der Wellenbelohnung. `upgrade`
 * verschenkt eine Stufe auf einem der globalen Pfade, `tower` ein kostenloses Turmangebot;
 * `floor` hebt dabei die **Untergrenze** der Raritaet an, statt die Chancen neu zu wuerfeln
 * (die "seltene Turm-Kapsel" aus GDD 11 Abschnitt 8).
 */
export type PodEffect =
  | { kind: 'gold'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'upgrade' }
  | { kind: 'tower'; floor?: Rarity }

export type PodDef = {
  id: string
  label: string
  /** Faerbt das Leuchten der Kapsel im Feld (GDD 11 Abschnitt 8: Optik nach Seltenheit). */
  rarity: Rarity
  weight: number
  minWave: number
  effect: PodEffect
}

/*
 * Die fuenf Kapselarten aus GDD 11 Abschnitt 8.
 *
 * Die Gewichte fallen mit dem Wert: Gold ist der Alltag, die seltene Turmkapsel der
 * Gluecksfall. Turmkapseln erscheinen erst spaeter - vor Welle 20 hat der Spieler noch
 * kaum Turmplaetze, und eine Kapsel, deren Inhalt man nicht unterbringen kann, ist keine
 * Belohnung.
 */
export const PODS: readonly PodDef[] = [
  {
    id: 'pod.gold',
    label: 'Gold Pod',
    rarity: 'common',
    weight: 46,
    minWave: 1,
    effect: { kind: 'gold', amount: 3 },
  },
  {
    id: 'pod.xp',
    label: 'Data Pod',
    rarity: 'rare',
    weight: 28,
    minWave: 1,
    effect: { kind: 'xp', amount: 3 },
  },
  {
    id: 'pod.upgrade',
    label: 'Upgrade Pod',
    rarity: 'epic',
    weight: 14,
    minWave: 8,
    effect: { kind: 'upgrade' },
  },
  {
    id: 'pod.tower',
    label: 'Tower Pod',
    rarity: 'legendary',
    weight: 9,
    minWave: 20,
    effect: { kind: 'tower' },
  },
  {
    id: 'pod.towerRare',
    label: 'Prototype Pod',
    rarity: 'mythic',
    weight: 3,
    minWave: 40,
    effect: { kind: 'tower', floor: 'epic' },
  },
]

const POD_BY_ID = new Map(PODS.map((pod) => [pod.id, pod]))

export function podById(id: string): PodDef {
  const pod = POD_BY_ID.get(id)
  if (!pod) throw new Error(`Unbekannte Kapselart: ${id}`)
  return pod
}

export function isKnownPod(id: string): boolean {
  return POD_BY_ID.has(id)
}

/** Kapselarten, die auf dieser Welle fallen koennen. */
export function podsForWave(wave: number): PodDef[] {
  return PODS.filter((pod) => wave >= pod.minWave)
}
