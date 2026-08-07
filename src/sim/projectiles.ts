/**
 * Geschosse mit Wiederverwendung (GDD 16 Abschnitt 12).
 *
 * Geschosse sind die haeufigsten Objekte im Spiel - ein Autocannon allein erzeugt sechs
 * pro Sekunde. Sie werden deshalb aus einem Pool geholt und dorthin zurueckgegeben,
 * nicht laufend neu erzeugt.
 *
 * Sie fliegen ihrem Ziel nach. Stirbt das Ziel unterwegs, verfaellt das Geschoss - der
 * Schaden geht verloren. Das ist Absicht: Ueberschuss bei hoher Feuerrate ist ein echter
 * Nachteil schneller Tuerme und gehoert zum Kraefteverhaeltnis der Turmarten.
 */

import type { Vec2 } from '../core/vec.ts'
import { MAX_PROJECTILES, PROJECTILE_MAX_LIFETIME } from '../data/balance.ts'
import type { GameState } from '../app/state.ts'
import { applyBurn, applyChain, applyChill, applyDamage, applyExplosion } from './combat.ts'
import type { Enemy } from './enemies.ts'

export type Projectile = {
  id: number
  pos: Vec2
  /**
   * Flugrichtung, auf Laenge 1. Sie faellt beim Verfolgen ohnehin an - festgehalten wird
   * sie, damit die Zeichenebene den Schweif legen kann, ohne die Bewegung nachzurechnen.
   */
  dir: Vec2
  /** Kennung des verfolgten Gegners. */
  targetId: number
  speed: number
  damage: number
  crit: boolean
  color: string
  /** Bisherige Flugzeit in Sekunden. */
  life: number
  /**
   * Was beim Einschlag zusaetzlich passiert (E14).
   *
   * Es haengt am **Geschoss** und nicht am Turm: Wenn es einschlaegt, kann der Turm laengst
   * abgerissen oder umgesetzt sein. Ein Geschoss traegt also alles mit, was es tun soll -
   * dieselbe Ueberlegung wie bei Schaden und Farbe.
   */
  payload: ProjectilePayload | null
  active: boolean
}

/** Wirkung eines Einschlags jenseits des reinen Schadens. */
export type ProjectilePayload = {
  explode?: { radius: number; damage: number }
  chain?: { hops: number; falloff: number; range: number }
  burn?: { dps: number; duration: number }
  chill?: { factor: number; duration: number }
}

export type ProjectileSpec = {
  damage: number
  speed: number
  crit: boolean
  color: string
} & ProjectilePayload

function blankProjectile(id: number): Projectile {
  return {
    id,
    pos: { x: 0, y: 0 },
    dir: { x: 0, y: 0 },
    targetId: -1,
    speed: 0,
    damage: 0,
    crit: false,
    color: '#ffffff',
    life: 0,
    payload: null,
    active: false,
  }
}

export function spawnProjectile(
  state: GameState,
  from: Vec2,
  target: Enemy,
  spec: ProjectileSpec,
): Projectile | null {
  const combat = state.runtime.combat
  if (combat.projectiles.length >= MAX_PROJECTILES) return null

  const projectile = combat.projectilePool.pop() ?? blankProjectile(combat.nextId++)
  // In den vorhandenen Vektor schreiben statt einen neuen zu legen - das ist der Sinn des
  // Pools, und bei sechs Schuessen je Sekunde und Turm faellt es ins Gewicht.
  projectile.pos.x = from.x
  projectile.pos.y = from.y

  // Startrichtung, damit schon das erste Bild einen Schweif in der richtigen Lage hat.
  const toTarget = Math.hypot(target.pos.x - from.x, target.pos.y - from.y) || 1
  projectile.dir.x = (target.pos.x - from.x) / toTarget
  projectile.dir.y = (target.pos.y - from.y) / toTarget

  projectile.targetId = target.id
  projectile.speed = spec.speed
  projectile.damage = spec.damage
  projectile.crit = spec.crit
  projectile.color = spec.color
  projectile.life = 0
  // Nur anlegen, wenn es etwas zu tragen gibt - der weitaus haeufigste Schuss im Spiel ist
  // ein gewoehnlicher, und der soll kein Objekt je Schuss kosten.
  projectile.payload =
    spec.explode || spec.chain || spec.burn || spec.chill
      ? {
          ...(spec.explode ? { explode: spec.explode } : {}),
          ...(spec.chain ? { chain: spec.chain } : {}),
          ...(spec.burn ? { burn: spec.burn } : {}),
          ...(spec.chill ? { chill: spec.chill } : {}),
        }
      : null
  projectile.active = true

  combat.projectiles.push(projectile)
  return projectile
}

export function releaseProjectile(state: GameState, projectile: Projectile): void {
  const combat = state.runtime.combat
  const index = combat.projectiles.indexOf(projectile)
  if (index >= 0) combat.projectiles.splice(index, 1)

  projectile.active = false
  projectile.targetId = -1
  // Sonst traegt der naechste Schuss aus dem Pool die Explosion seines Vorgaengers mit.
  projectile.payload = null
  combat.projectilePool.push(projectile)
}

/**
 * Der Einschlag: erst der Schaden, dann was das Geschoss mitgebracht hat.
 *
 * Die Reihenfolge ist wichtig. Brand und Frost werden **vor** dem Schaden gesetzt, damit
 * sie auch dann noch am Gegner stehen, wenn der Treffer ihn nicht toetet; Explosion und
 * Kettenblitz laufen **nach** ihm, weil sie den Ort des Einschlags brauchen und der Gegner
 * dabei sterben darf.
 */
function impact(state: GameState, projectile: Projectile, target: Enemy): void {
  const payload = projectile.payload
  const at = { x: target.pos.x, y: target.pos.y }

  if (payload?.burn) applyBurn(state, target, payload.burn.dps, payload.burn.duration)
  if (payload?.chill) applyChill(state, target, payload.chill.factor, payload.chill.duration)

  applyDamage(state, target, projectile.damage, { crit: projectile.crit })

  if (payload?.explode) {
    applyExplosion(state, at, payload.explode.radius, payload.explode.damage, target)
  }
  if (payload?.chain) {
    applyChain(
      state,
      target,
      payload.chain.hops,
      payload.chain.falloff,
      projectile.damage,
      payload.chain.range,
    )
  }
}

export function stepProjectiles(state: GameState, dt: number): void {
  const combat = state.runtime.combat
  if (combat.projectiles.length === 0) return

  const byId = new Map<number, Enemy>()
  for (const enemy of combat.enemies) byId.set(enemy.id, enemy)

  // Rueckwaerts, weil getroffene Geschosse aus der Liste entfernt werden.
  for (let i = combat.projectiles.length - 1; i >= 0; i--) {
    const projectile = combat.projectiles[i] as Projectile
    projectile.life += dt

    const target = byId.get(projectile.targetId)
    if (!target || !target.active || projectile.life > PROJECTILE_MAX_LIFETIME) {
      releaseProjectile(state, projectile)
      continue
    }

    const dx = target.pos.x - projectile.pos.x
    const dy = target.pos.y - projectile.pos.y
    const distance = Math.hypot(dx, dy)
    const stride = projectile.speed * dt

    // Treffer, sobald das Geschoss den Gegner in diesem Schritt erreichen wuerde.
    if (distance <= stride + target.radius) {
      impact(state, projectile, target)
      releaseProjectile(state, projectile)
      continue
    }

    projectile.dir.x = dx / distance
    projectile.dir.y = dy / distance
    projectile.pos.x += projectile.dir.x * stride
    projectile.pos.y += projectile.dir.y * stride
  }
}
