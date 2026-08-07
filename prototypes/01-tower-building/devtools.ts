/**
 * Werkzeuge nur fuer die Auswertung — kein Teil der Spielregeln.
 * Dient vor allem der Lesbarkeitspruefung (offene Frage F4): grosse Stationen auf Knopfdruck.
 */
import { makeInstance, TOWERS } from './catalog'
import type { Rarity, Station } from './model'
import { canPlace, freeEdges, place } from './station'

const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

/** Kleiner deterministischer Zufall — `Math.random` waere nicht reproduzierbar. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Baut die Station auf `count` Module aus, indem zufaellig gueltige Andockstellen gewaehlt werden.
 * Gibt zurueck, wie viele Module tatsaechlich Platz fanden.
 */
export function growRandom(st: Station, count: number, seed = 1): number {
  const rnd = makeRng(seed)
  let placed = 0

  while (st.placed.length < count) {
    const options: { defId: string; edgeIndex: number; ownerUid: string }[] = []
    const edges = freeEdges(st)
    for (const fe of edges) {
      for (const def of TOWERS) {
        if (canPlace(st, def.id, fe, 'devtools') === null) {
          options.push({ defId: def.id, edgeIndex: fe.edgeIndex, ownerUid: fe.ownerUid })
        }
      }
    }
    if (options.length === 0) break

    const pick = options[Math.floor(rnd() * options.length)]!
    const target = edges.find(f => f.ownerUid === pick.ownerUid && f.edgeIndex === pick.edgeIndex)!
    const inst = makeInstance(pick.defId, RARITIES[Math.floor(rnd() * RARITIES.length)]!)
    st.inventory.push(inst)
    if (place(st, inst.uid, target) === null) placed++
  }
  return placed
}

