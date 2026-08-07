/**
 * Hauptturm-Kerne (GDD 04).
 *
 * In E1 stehen nur Identitaet und Form - genug, damit der Hauptturm sichtbar wird. Die
 * Kampfwerte kommen in E6 dazu, die weiteren Kerne mit dem Prestige-Baum in E13.
 *
 * Der Kern ist laut GDD 04 Abschnitt 1 immer ein **Hexagon** im Zentrum, nicht entfernbar,
 * und liefert damit die ersten sechs Bauplaetze.
 */

import { makeStats, type CombatStats, type Emblem, type FootprintSides } from './types.ts'

export type CoreDef = {
  id: string
  /** Englisch - Spielsprache laut GDD 16 Abschnitt 1. */
  name: string
  sides: FootprintSides
  emblem: Emblem
  /** PLATZHALTER bis E6 - genug, damit der Kern buffbar und anzeigbar ist. */
  stats: CombatStats
  /**
   * Leitfarbe fuer Emblem und Leuchten. Der Kern traegt das helle Cyan des Panelrahmens
   * aus PALETTE (`render/theme.ts`) - die Station ist damit das hellste Objekt im Bild.
   */
  accent: string
  description: string
}

export const CORES: readonly CoreDef[] = [
  {
    id: 'sentinel',
    name: 'Sentinel Core',
    sides: 6,
    emblem: 'core',
    stats: makeStats(40, 1.6, 220, 0.1, 600),
    accent: '#7fd8ff',
    description: 'Balanced starting core. Always at the centre, cannot be removed.',
  },
]

export function coreById(id: string): CoreDef {
  const found = CORES.find((core) => core.id === id)
  if (!found) throw new Error(`Unbekannter Kern: ${id}`)
  return found
}
