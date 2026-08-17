/**
 * Nachladen, Zielwahl, Schuss.
 *
 * Der Plan sieht diese Funktion in `sim/station.ts` vor. Sie steht hier, damit
 * `station.ts` bei den Bauregeln bleibt - und weil `station.ts` sonst `targeting` und
 * `projectiles` einbinden muesste, die ihrerseits die Station kennen.
 *
 * Der Hauptturm ist dabei kein Sonderfall: Er ist ein Modul mit eigenen Werten und
 * durchlaeuft dieselbe Schleife wie jeder Turm (GDD 04 Abschnitt 1).
 */

import { emit } from '../core/events.ts'
import { circumradius } from '../core/geometry.ts'
import { dist, type Vec2 } from '../core/vec.ts'
import type { GameState } from '../app/state.ts'
import { coreById } from '../data/cores.ts'
import { towerById, type TowerMechanic } from '../data/towers.ts'
import type { CombatStats } from '../data/types.ts'
import { categoryOf } from './buffs.ts'
import { applyChain, applyDamage, fireFlash, spawnBeam } from './combat.ts'

/**
 * Wie stark ein `Conduit`-Sprung gegenueber dem Treffer ist.
 *
 * Deutlich schwaecher als ein Tesla-Sprung (0,6): Der Kettenblitz ist die Identitaet dieses
 * Turms, und ein Directive soll sie nicht nebenbei an jede Energiewaffe verteilen.
 */
const CONDUIT_FALLOFF = 0.35
import type { Enemy } from './enemies.ts'
import { spawnProjectile } from './projectiles.ts'
import { coreRange, moduleStats, fireInterval, hasRule, specialValue } from './stats.ts'
import { CORE_CENTER, type PlacedModule } from './station.ts'
import { findTarget, type TargetMode } from './targeting.ts'

/** Zielprioritaet eines Moduls (GDD 05 Abschnitt 4). Abweichungen kommen mit E14. */
export function targetModeOf(module: PlacedModule): TargetMode {
  return module.kind === 'core' ? 'nearest' : (towerById(module.defId).targetMode ?? 'nearest')
}

function accentOf(module: PlacedModule): string {
  return module.kind === 'core' ? coreById(module.defId).accent : towerById(module.defId).accent
}

export function stepTowers(state: GameState, dt: number): void {
  const combat = state.runtime.combat
  const { cooldowns } = combat

  for (const module of combat.modules) {
    if (!canFire(module)) continue

    const stats = moduleStats(module, combat.buffs.get(module.uid), state).final
    if (!shoots(stats)) continue

    let remaining = (cooldowns.get(module.uid) ?? 0) - dt
    if (remaining > 0) {
      cooldowns.set(module.uid, remaining)
      continue
    }

    const interval = fireInterval(stats)
    const target = findTarget(combat.enemies, module.center, stats.range, targetModeOf(module))
    if (!target) {
      // Ohne Ziel bleibt der Turm geladen - er soll nicht bestraft werden, weil gerade
      // niemand in Reichweite war. Der Laser verliert dabei seinen Fokus: Was er aufgebaut
      // hatte, gilt fuer **dieses** Ziel und nicht fuer das naechste.
      cooldowns.set(module.uid, 0)
      combat.beamFocus.delete(module.uid)
      continue
    }

    const accent = accentOf(module)
    const angle = Math.atan2(target.pos.y - module.center.y, target.pos.x - module.center.x)

    const mechanic = mechanicOf(module)
    const ramp = beamRamp(state, module, target, dt)

    // Mehrere Schuesse pro Tick, falls das Angriffstempo hoeher ist als die Tickrate.
    let shots = 0
    while (remaining <= 0 && shots < 10) {
      const crit = state.runtime.rng.chance(stats.critChance)
      fireOnce(state, module, target, stats, mechanic, crit, accent, ramp)
      // Jeder Schuss wird gemeldet, auch wenn nur jeder n-te aufblitzt: Der Klang entscheidet
      // spaeter selbst, wie er sich ausduennt (GDD 13 Abschnitt 11).
      emit('tower.fired', { uid: module.uid, defId: module.defId, crit })
      remaining += interval
      shots += 1
    }

    if (shots > 0) fireFlash(state, module.uid, module.center, angle, accent)

    cooldowns.set(module.uid, remaining)
  }
}

/**
 * Schiesst dieses Modul ueberhaupt?
 *
 * Buff- und Support-Module nicht, und auch nicht, wessen Mechanik gar kein Schiessen ist -
 * ein Drohnenmodul startet Drohnen, es feuert nicht selbst.
 *
 * Die Frage steht als eigene Funktion da und nicht als Bedingung in der Schleife, weil sie
 * an **zwei** Stellen dieselbe Antwort geben muss: hier beim Schiessen und beim
 * Reichweitenkreis um die Station (`stationRange`). Ein Kreis, der etwas anderes verspricht,
 * als der Kampf haelt, ist schlimmer als gar keiner.
 */
export function canFire(module: PlacedModule): boolean {
  const category = categoryOf(module)
  if (category === 'buff' || category === 'support') return false

  const kind = mechanicOf(module)?.kind
  return kind !== 'drones' && kind !== 'hull'
}

/** Werte, mit denen wirklich geschossen wird. Ohne Schaden oder Tempo faellt kein Schuss. */
function shoots(stats: CombatStats): boolean {
  return stats.damage > 0 && stats.attackSpeed > 0
}

/** Ein Wirkungskreis: um welchen Punkt, wie weit. */
export type RangeCircle = { center: Vec2; range: number }

/**
 * Die Wirkungskreise der Station - einer je Modul, das wirklich schiesst.
 *
 * **Jeder Turm hat seinen eigenen Kreis um seinen eigenen Standort.** Genau so rechnet der
 * Kampf: `findTarget` misst ab `module.center`, nicht ab dem Kern. Ein Turm, der zwei Ringe
 * weit oben angebaut ist, reicht deshalb um diesen Abstand weiter nach oben als der Kern -
 * und im Rueckn nicht weiter.
 *
 * Was der Spieler sieht, ist die **Vereinigung** dieser Kreise (`render/combat.ts`), nicht
 * ihre Aussengrenze als Scheibe. Der Unterschied ist keine Feinheit: Eine Scheibe um die
 * groesste Reichweite verspraeche Deckung auf der Gegenseite, wo kein Turm steht.
 *
 * Der Kern ist dabei kein Sonderfall - er ist ein Modul mit eigenen Werten und liefert
 * seinen Kreis wie jeder Turm.
 */
export function rangeCircles(state: GameState): RangeCircle[] {
  const combat = state.runtime.combat
  const circles: RangeCircle[] = []

  for (const module of combat.modules) {
    if (!canFire(module)) continue

    const stats = moduleStats(module, combat.buffs.get(module.uid), state).final
    if (!shoots(stats)) continue

    circles.push({ center: module.center, range: stats.range })
  }

  // Vor dem ersten Takt kennt die Simulation noch keine Module. Dann gilt der Grundwert des
  // Kerns, damit der Kreis schon im allerersten Bild steht statt aufzuspringen.
  if (circles.length === 0) circles.push({ center: CORE_CENTER, range: coreRange(state) })

  return circles
}

/**
 * Die Aussengrenze einer fertigen Kreisliste: weiter als so weit trifft nichts mehr.
 *
 * Nimmt die Kreise entgegen, statt sie selbst zu holen. Der Zeichenpfad braucht **beides**
 * je Bild - die Liste fuer den Wirkungsbereich, die Zahl fuer den Bildausschnitt - und
 * `rangeCircles` ist nicht billig: Es rechnet fuer jedes Modul die volle Werte-Kette durch
 * und legt dabei je Modul sechs Zwischenobjekte an. Zweimal je Bild war das doppelte Arbeit
 * und doppelter Muell fuer den Speicherbereiniger, dessen Aufraeumen man als Ruckler sieht.
 */
export function outerReach(circles: readonly RangeCircle[]): number {
  let reach = 0
  for (const circle of circles) {
    reach = Math.max(reach, dist(CORE_CENTER, circle.center) + circle.range)
  }
  return reach
}

/**
 * Die Aussengrenze der Station - dieselbe Zahl, aber selbst geholt.
 *
 * Eine einzelne Zahl, und deshalb bewusst **nicht** das, was gezeichnet wird - sie sagt
 * nichts darueber, in welche Richtung diese Reichweite gilt. Fuer Aufrufer, die nur die Zahl
 * brauchen und keine Kreise in der Hand halten.
 */
export function stationRange(state: GameState): number {
  return outerReach(rangeCircles(state))
}

/** Die Spezialmechanik eines Moduls. Der Hauptturm hat keine. */
function mechanicOf(module: PlacedModule): TowerMechanic | null {
  if (module.kind === 'core') return null
  return towerById(module.defId).mechanic ?? null
}

/**
 * `Focal Lens`: Der Laserstrahl bohrt sich tiefer, je laenger er dasselbe Ziel haelt.
 *
 * Der einzige Katalogwert, der einen **eigenen Zustand** braucht - alle anderen sind Summen
 * ueber gekaufte Stufen. Gemerkt wird deshalb nur das Noetigste: welches Ziel und wie lange.
 * Ein Zielwechsel setzt beides zurueck, und genau darin liegt die Entscheidung, die das
 * Upgrade stellt: Der Laser ist gegen einen Boss stark und gegen eine Traube schwach
 * (GDD 05: "Best against bosses and tanks").
 */
function beamRamp(state: GameState, module: PlacedModule, target: Enemy, dt: number): number {
  const perSecond = specialValue(state, 'beamRamp')
  if (perSecond <= 0 || mechanicOf(module)?.kind !== 'beam') return 0

  const focus = state.runtime.combat.beamFocus
  const held = focus.get(module.uid)
  if (!held || held.targetId !== target.id) {
    focus.set(module.uid, { targetId: target.id, seconds: 0 })
    return 0
  }

  held.seconds += dt
  return perSecond * held.seconds
}

/**
 * Ein einzelner Schuss - hier faechert sich die Mechanik auf (GDD 05 Abschnitt 2).
 *
 * Jeder Zweig ist **eine Zeile Wirkung**: Die Mechaniken selbst liegen in `sim/combat.ts`
 * und kennen keinen Turm. Ein neuer Turm mit vorhandener Mechanik faellt deshalb in einen
 * bestehenden Zweig und beruehrt diese Funktion nicht - genau das ist die Abnahme von E14.
 *
 * **Seit dem Upgrade-Katalog holt jeder Zweig seinen Zuschlag hier** und nicht im Datensatz
 * des Turms: `mechanic.radius` ist der Grundwert der Turmart, `specialValue(...)` das, was
 * der Spieler dazugekauft hat. Der Datensatz bleibt damit die Beschreibung des Turms, und
 * der Run bleibt der Run - ein Turm ist nicht deshalb anders, weil jemand ein Upgrade
 * gekauft hat.
 */
function fireOnce(
  state: GameState,
  module: PlacedModule,
  target: Enemy,
  stats: CombatStats,
  mechanic: TowerMechanic | null,
  crit: boolean,
  accent: string,
  /** Zuschlag des Laserstrahls, solange er dasselbe Ziel haelt (`Focal Lens`). */
  ramp = 0,
): void {
  // `Executioner`: Der Marksman schlaegt haerter zu, weil er ohnehin immer das staerkste
  // Ziel nimmt (GDD 05 Abschnitt 4). Der Zuschlag haengt deshalb an der Zielwahl und nicht
  // an der Turmart - ein zweiter Turm mit derselben Zielwahl bekommt ihn von selbst.
  const focus =
    targetModeOf(module) === 'strongest' ? 1 + specialValue(state, 'strongestBonus') : 1
  const damage = (stats.damage + ramp) * focus

  // Wie weit dieses Modul um seine Mitte herum reicht. Das Geschoss traegt es mit, damit
  // sein Schweif vor dem Turm endet statt ueber ihn hinweg (siehe `Projectile.reach`).
  const reach = circumradius(module.sides)
  const common = {
    damage,
    speed: stats.projectileSpeed,
    crit,
    color: accent,
    reach,
    sourceUid: module.uid,
  }

  /*
   * `Conduit`: Energiewaffen springen auf **einen** nahen Gegner ueber.
   *
   * Umgesetzt als Kettensprung, weil es genau das ist - und weil die Mechanik dafuer schon
   * steht (`applyChain`). Ein Turm, der ohnehin springt (Tesla), bekommt einen Sprung mehr;
   * einer, der es nicht tut, bekommt seinen ersten. Beides ist derselbe Satz.
   */
  const arcs =
    module.kind === 'tower' &&
    towerById(module.defId).class === 'elemental' &&
    hasRule(state, 'conduit')
      ? 1
      : 0
  const arc =
    arcs > 0 ? { chain: { hops: arcs, falloff: CONDUIT_FALLOFF, range: stats.range } } : {}

  switch (mechanic?.kind) {
    case 'beam':
      // Der Laser trifft ohne Flugzeit. Der Strahl selbst ist reine Anzeige und wird in
      // `sim/combat.ts` als kurzlebige Linie abgelegt.
      spawnBeam(state, module.center, target, accent)
      applyDamage(state, target, damage, { crit, sourceUid: module.uid })
      // Er hat kein Geschoss, das eine Nutzlast tragen koennte - der Sprung muss deshalb
      // hier von Hand angestossen werden.
      if (arcs > 0) {
        applyChain(state, target, arcs, CONDUIT_FALLOFF, damage, stats.range)
      }
      return

    case 'explosive': {
      // Erst der Einschlag, dann der Umkreis. Das Ziel selbst bekommt den Flaechenschaden
      // **nicht** zusaetzlich - sonst waere ein Raketenturm auch gegen Einzelziele der
      // staerkste (GDD 05 Abschnitt 6).
      spawnProjectile(state, module.center, target, {
        ...common,
        ...arc,
        explode: {
          radius: mechanic.radius + specialValue(state, 'blastRadius'),
          damage: damage * (mechanic.share + specialValue(state, 'blastShare')),
        },
      })
      return
    }

    case 'chain':
      spawnProjectile(state, module.center, target, {
        ...common,
        chain: {
          hops: mechanic.hops + specialValue(state, 'chainHops') + arcs,
          falloff: mechanic.falloff,
          range: stats.range,
        },
      })
      return

    case 'burn':
      spawnProjectile(state, module.center, target, {
        ...common,
        ...arc,
        burn: {
          dps: mechanic.dps,
          duration: mechanic.duration + specialValue(state, 'burnDuration'),
        },
      })
      return

    case 'chill':
      spawnProjectile(state, module.center, target, {
        ...common,
        ...arc,
        chill: {
          // Kleiner heisst langsamer: `Riftwalk` **senkt** den Faktor. Der Deckel liegt in
          // `applyChill` - ein stehender Gegner waere kein Gegner mehr.
          factor: mechanic.factor - specialValue(state, 'chillFactor'),
          duration: mechanic.duration + specialValue(state, 'chillDuration'),
        },
      })
      return

    default:
      spawnProjectile(state, module.center, target, { ...common, ...arc })
      /*
       * `Twin Barrel`: Der Kern verschiesst zwei Geschosse statt einem.
       *
       * Nur hier im gewoehnlichen Zweig, und das ist keine Auslassung: Der Kern hat gar
       * keine Mechanik (`mechanicOf` gibt fuer ihn `null`), er faellt also immer hierher.
       * Das zweite Geschoss ist ein volles - genau das macht es zu einem Directive und
       * nicht zu einem Ausbau.
       */
      if (module.kind === 'core' && hasRule(state, 'twinBarrel')) {
        spawnProjectile(state, module.center, target, common)
      }
  }
}

/** Nachladezeiten von Modulen vergessen, die es nicht mehr gibt. */
export function pruneCooldowns(state: GameState): void {
  const combat = state.runtime.combat
  const alive = new Set(combat.modules.map((module) => module.uid))

  for (const uid of [...combat.cooldowns.keys()]) {
    if (!alive.has(uid)) combat.cooldowns.delete(uid)
  }
}
