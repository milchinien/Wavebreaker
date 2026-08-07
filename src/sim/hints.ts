/**
 * Einmalige Hinweise (GDD 14 Abschnitt 4a).
 *
 * Es gibt **kein gefuehrtes Tutorial**. Das Spiel erklaert sich ueber die Reihenfolge
 * seiner Freischaltungen; ein Hinweis ist nur der Fingerzeig im Augenblick, in dem ein
 * System zum ersten Mal gebraucht wird.
 *
 * Die Regeln aus dem GDD stehen hier als Bauart und nicht als Vorsatz:
 *   - **Genau einmal.** `permanent.seenHints` merkt sich, was schon gezeigt wurde; die
 *     Liste ueberlebt jedes Prestige, weil das Gelernte es auch tut.
 *   - **Im Moment der Relevanz.** Jeder Hinweis traegt seine Bedingung selbst. Sie wird
 *     gegen den Zustand geprueft, nicht gegen einen Fortschrittsschritt - dadurch kann ein
 *     Hinweis nicht "verpasst" werden.
 *   - **Kein Anhalten.** Diese Datei entscheidet nur, *was* faellig ist. Sie zeigt nichts
 *     an und haelt nichts an; das Fenster in `ui/hints.ts` ist ein Zettel am Rand.
 *
 * Der Text steht in `data/strings.ts` wie jeder Spielertext (GDD 16 Abschnitt 1), die
 * Bedingung hier - sie ist eine Abfrage auf den Spielzustand und gehoert damit in `sim/`.
 */

import type { StringKey } from '../data/strings.ts'
import { MELT_COST } from '../data/balance.ts'
import { towerById } from '../data/towers.ts'
import type { GameState } from '../app/state.ts'
import { canPrestige } from './prestige.ts'
import { currentLevel } from './progression.ts'
import { towerCost } from './shop.ts'
import { nextUpgradeCost } from './stats.ts'

export type HintDef = {
  id: string
  key: StringKey
  when(state: GameState): boolean
}

/*
 * Die acht Hinweise aus der Tabelle in GDD 14 Abschnitt 4a, in der Reihenfolge, in der sie
 * im Spiel fruehestens fallen koennen. Bei mehreren faelligen gewinnt der erste - so kommt
 * nie ein Stapel Zettel auf einmal.
 *
 * Der Hinweis zum Buff-Turm nennt ausdruecklich den **Zeitpunkt**: Das GDD bezeichnet ihn
 * als groesstes Verstaendnisrisiko des Spiels, weil derselbe Turm zuletzt gesetzt wie ein
 * Fehlkauf wirkt und frueh gesetzt der staerkste Zug im Build ist.
 */
export const HINTS: readonly HintDef[] = [
  {
    id: 'hint.collect',
    key: 'hint.collect',
    when: (state) => state.run.coins.length > 0,
  },
  {
    id: 'hint.upgrade',
    key: 'hint.upgrade',
    when: (state) => {
      const cost = nextUpgradeCost(state, 'core.damage')
      return cost !== null && state.run.gold >= cost
    },
  },
  {
    id: 'hint.buyTower',
    key: 'hint.buyTower',
    when: (state) => state.run.gold >= towerCost(state),
  },
  {
    id: 'hint.buff',
    key: 'hint.buff',
    when: (state) =>
      state.run.station.inventory.some((module) => towerById(module.defId).category === 'buff'),
  },
  {
    id: 'hint.level',
    key: 'hint.level',
    when: (state) => currentLevel(state) >= 4,
  },
  {
    id: 'hint.boss',
    key: 'hint.boss',
    when: (state) => state.runtime.combat.bossId !== null,
  },
  {
    id: 'hint.melt',
    key: 'hint.melt',
    when: (state) => state.run.station.inventory.length >= MELT_COST,
  },
  {
    id: 'hint.prestige',
    key: 'hint.prestige',
    when: (state) => canPrestige(state),
  },
]

/**
 * Der naechste faellige Hinweis, oder `null`.
 *
 * Wird pro Bild aufgerufen und laeuft ueber hoechstens acht Eintraege - der Aufwand liegt
 * unter dem einer einzigen gezeichneten Muenze. Ein Zwischenspeicher waere hier teurer als
 * die Rechnung, weil er beim Wegklicken und beim Zuruecksetzen mitgepflegt werden muesste.
 */
export function pendingHint(state: GameState): HintDef | null {
  const seen = state.permanent.seenHints
  for (const hint of HINTS) {
    if (seen.includes(hint.id)) continue
    if (hint.when(state)) return hint
  }
  return null
}

/** Einen Hinweis als gesehen ablegen. Er kommt danach nicht wieder. */
export function markHintSeen(state: GameState, id: string): boolean {
  if (!HINTS.some((hint) => hint.id === id)) return false
  if (state.permanent.seenHints.includes(id)) return false
  state.permanent.seenHints.push(id)
  return true
}

/** Alle Hinweise wieder zeigen (GDD 14 Abschnitt 4a: "in den Einstellungen zuruecksetzbar"). */
export function resetHints(state: GameState): void {
  state.permanent.seenHints.length = 0
}

