/**
 * Kampfdrohnen (GDD 05: Drohnen-Modul, GDD 03 Abschnitt 6).
 *
 * Drohnen sind die einzigen beweglichen Einheiten des Spielers. Zwei Regeln aus dem GDD
 * bestimmen alles Weitere:
 *
 *   **Sie belegen keinen Bauplatz** - das Modul, das sie startet, belegt einen. Die Drohnen
 *   selbst sind kein Teil der Station und tauchen deshalb nirgends in `sim/station.ts` auf.
 *
 *   **Sie sind nicht angreifbar.** Gegner laufen die Station an, nicht die Drohnen. Damit
 *   entfallen HP, Tod und Wiederbeschaffung - eine Drohne existiert, solange ihr Modul
 *   existiert, und verschwindet mit ihm.
 *
 * Daraus folgt die Bauform: Drohnen sind **abgeleitet**, nicht gespeichert. Sie werden je
 * Takt aus den vorhandenen Drohnenmodulen erzeugt und wieder eingesammelt; es gibt keinen
 * Zustand, der mit der Station auseinanderlaufen koennte, und nichts, was ein Umbau mitten
 * im Kampf inkonsistent machen kann.
 *
 * Sie kreisen um ihr Modul und schiessen selbstaendig auf das, was in ihre Reichweite
 * kommt. Der Kreis ist Absicht: Eine Drohne, die frei umherfliegt, waere im Bild nicht mehr
 * ihrem Modul zuzuordnen, und der Spieler koennte nicht sehen, was sein Modul ihm bringt.
 */

import type { Vec2 } from '../core/vec.ts'
import { towerById } from '../data/towers.ts'
import type { GameState } from '../app/state.ts'
import { applyDamage } from './combat.ts'
import { specialValue } from './stats.ts'
import { findTarget } from './targeting.ts'
import type { PlacedModule } from './station.ts'

export type Drone = {
  /** Modul, zu dem sie gehoert - sie verschwindet mit ihm. */
  ownerUid: string
  pos: Vec2
  /** Winkel auf ihrer Kreisbahn, im Bogenmass. */
  angle: number
  /** Restliche Nachladezeit in Sekunden. */
  cooldown: number
  color: string
}

/** Abstand der Kreisbahn vom eigenen Modul, in Welteinheiten. */
const ORBIT_RADIUS = 62
/** Umlaufgeschwindigkeit im Bogenmass je Sekunde. */
const ORBIT_SPEED = 1.5

/**
 * Drohnen mit den vorhandenen Drohnenmodulen gleichziehen und fliegen lassen.
 *
 * Der Abgleich laeuft ueber die Modulkennung: Neue Module bekommen ihre Drohnen, entfernte
 * verlieren sie. Das ist billiger als es klingt - es gibt hoechstens eine Handvoll Module,
 * und die Pruefung laeuft nur ueber deren Kennungen.
 */
export function stepDrones(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  syncDrones(state)
  if (combat.drones.length === 0) return

  for (const drone of combat.drones) {
    const owner = combat.modules.find((module) => module.uid === drone.ownerUid)
    if (!owner) continue

    const spec = droneSpecOf(owner)
    if (!spec) continue

    // Kreisen: Der Winkel laeuft weiter, der Ort folgt daraus. Kein Verfolgen, kein Ziel -
    // eine Drohne bleibt bei ihrem Modul.
    drone.angle += ORBIT_SPEED * dt
    drone.pos.x = owner.center.x + Math.cos(drone.angle) * ORBIT_RADIUS
    drone.pos.y = owner.center.y + Math.sin(drone.angle) * ORBIT_RADIUS

    drone.cooldown -= dt
    if (drone.cooldown > 0) continue

    // Gemessen wird ab der **Drohne**, nicht ab ihrem Modul: Sie ist der Schuetze, und
    // ihre Kreisbahn ist genau der Grund, warum sie mal die eine und mal die andere Seite
    // abdeckt.
    const target = findTarget(combat.enemies, drone.pos, spec.range)
    if (!target) {
      drone.cooldown = 0
      continue
    }

    // Sofortiger Treffer statt Geschoss: Eine Drohne auf Kreisbahn wuerde ihr Geschoss
    // ohnehin ueber eine kurze Strecke schicken, und ein weiterer Geschosstyp im Pool
    // brachte nichts als Aufwand.
    // `Hunting Pack` legt auf jeden Biss drauf. Die Drohne ist die Schuetzin, ihr Modul der
    // Halter - fuer den Overdrive zaehlt deshalb das Modul, denn es traegt die Kachel.
    applyDamage(state, target, spec.damage + specialValue(state, 'droneDamage'), {
      sourceUid: drone.ownerUid,
    })
    drone.cooldown = spec.interval
  }
}

/** Die Drohnenliste an die vorhandenen Module anpassen. */
function syncDrones(state: GameState): void {
  const combat = state.runtime.combat

  // Wie viele Drohnen jedes Modul haben soll.
  const wanted = new Map<string, { count: number; color: string }>()
  for (const module of combat.modules) {
    const spec = droneSpecOf(module)
    // `Swarm`: eine Drohne mehr je Bucht. Die Liste zieht von selbst nach - sie wird je
    // Takt gegen diese Zahl abgeglichen, es gibt keinen Zustand, der auseinanderlaufen kann.
    if (spec) {
      wanted.set(module.uid, {
        count: spec.count + specialValue(state, 'droneCount'),
        color: accentOf(module),
      })
    }
  }

  // Zu viel weg: Drohnen ohne Modul und ueberzaehlige desselben Moduls.
  const seen = new Map<string, number>()
  combat.drones = combat.drones.filter((drone) => {
    const entry = wanted.get(drone.ownerUid)
    if (!entry) return false
    const already = seen.get(drone.ownerUid) ?? 0
    if (already >= entry.count) return false
    seen.set(drone.ownerUid, already + 1)
    return true
  })

  // Zu wenig auffuellen. Der Startwinkel verteilt sie gleichmaessig auf der Bahn, damit
  // sie nicht als Klumpen fliegen.
  for (const [uid, entry] of wanted) {
    const already = seen.get(uid) ?? 0
    for (let i = already; i < entry.count; i++) {
      combat.drones.push({
        ownerUid: uid,
        pos: { x: 0, y: 0 },
        angle: (i / entry.count) * Math.PI * 2,
        cooldown: 0,
        color: entry.color,
      })
    }
  }
}

/** Die Drohnenwerte eines Moduls, falls es welche startet. */
function droneSpecOf(
  module: PlacedModule,
): { count: number; damage: number; range: number; interval: number } | null {
  if (module.kind !== 'tower') return null
  const mechanic = towerById(module.defId).mechanic
  if (!mechanic || mechanic.kind !== 'drones') return null
  return mechanic
}

function accentOf(module: PlacedModule): string {
  return module.kind === 'tower' ? towerById(module.defId).accent : '#7fd8ff'
}
