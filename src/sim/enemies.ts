/**
 * Gegnerinstanzen, Bewegung und Andocken (GDD 07 Abschnitt 2).
 *
 * Zwei Regeln praegen alles hier:
 *   - Gegner laufen auf das **naechstgelegene Modul** zu, nicht auf den Mittelpunkt der
 *     Station. Erst dadurch wird die Platzierung eines Turms zu einer Entscheidung.
 *   - Wer die Station erreicht, **bleibt stehen und schlaegt weiter**, bis er zerstoert
 *     ist. Durchgekommene Gegner sammeln sich also an - das ist der Druck, aus dem eine
 *     Welle verloren geht.
 *
 * Gegner werden **wiederverwendet** statt neu erzeugt (GDD 16 Abschnitt 12): Bei
 * hunderten Gegnern pro Welle ist die Speicherbereinigung sonst im Bild sichtbar.
 */

import { boundsOf, edgesOf, pointInPolygon, pointSegmentDistance } from '../core/geometry.ts'
import { dist, type Vec2 } from '../core/vec.ts'
import {
  ENEMY_APPROACH_SPEED_FACTOR,
  ENEMY_BASE_DAMAGE,
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  MAX_ENEMIES,
  SPAWN_RING_MARGIN,
} from '../data/balance.ts'
import { emit } from '../core/events.ts'
import {
  bossForWave,
  ELITE_MODIFIERS,
  enemyById,
  type EliteModifier,
  type EnemyDef,
} from '../data/enemies.ts'
import {
  ELITE_CHANCE_GROWTH,
  ELITE_FROM_WAVE,
  ELITE_MAX_CHANCE,
  EMPOWER_CAP,
} from '../data/balance.ts'
import type { GameState } from '../app/state.ts'
import type { PlacedModule } from './station.ts'
// Nur der Typ: `towers` bindet diese Datei ein, ein Wert von dort waere ein Kreis. Die
// Kreise selbst liegen als fertige Liste im Kampfzustand (`combat.coverage`).
import type { RangeCircle } from './towers.ts'

/**
 * Die Zahlen der leichten Physik (siehe `stepCrowd`).
 *
 * Sie stehen hier und nicht in `data/balance.ts`, weil sie nichts entscheiden: Kein Gegner
 * wird davon schneller, zaeher oder gefaehrlicher. Sie sind Anmutung, und Anmutung gehoert
 * dorthin, wo sie wirkt.
 *
 * `CROWD_PUSH` ist der Stoss je Welteinheit Ueberlappung, in Welteinheiten je Sekunde -
 * dreifach heisst: Wer halb im anderen steckt, weicht mit rund einem Drittel seines
 * Lauftempos aus. Der Deckel haelt den Ausnahmefall im Zaum, wenn zwanzig Gegner auf
 * einem Fleck stehen; ohne ihn schoesse einer aus dem Pulk heraus wie aus einer Feder.
 */
const CROWD_PUSH = 3
const CROWD_PUSH_MAX = 45
/** Wie schnell ein Stoss ausklingt: je groesser, desto kuerzer der Nachlauf. */
const PUSH_DAMPING = 5

/**
 * Wie viel Drehung ein Streifen bringt, wie schnell sie ausklingt, wie stark die Ruhelage
 * zurueckholt und wie weit der Ausschlag hoechstens geht (0,35 rad sind rund 20 Grad).
 */
const SPIN_GAIN = 0.5
const SPIN_DAMPING = 3
const SPIN_RETURN = 6
/** Offen, weil der Selbsttest darauf besteht: Ueber diesem Ausschlag wird die Form falsch. */
export const SPIN_MAX = 0.35

export type Enemy = {
  id: number
  defId: string
  pos: Vec2
  hp: number
  maxHp: number
  /** Welteinheiten pro Sekunde. */
  speed: number
  /** Schaden je Schlag an der Station. */
  damage: number
  radius: number
  /** Belohnung, die sein Tod ausschuettet - nicht das Gold des Spielers. */
  goldReward: number
  xpReward: number

  /*
   * Die leichte Physik eines Gegners (GDD 07 Abschnitt 3: Gegner sollen sich als Pulk
   * lesen, nicht als Reihe von Punkten auf derselben Linie).
   *
   * Drei Felder, kein Koerpermodell: Ein Gegner hat **kein** Gewicht, keinen Drehimpuls und
   * keine Beschleunigung. Er bekommt einen Stoss, der von selbst ausklingt, und eine
   * Drehung, die aus dem Streifen an einem Nachbarn entsteht. Mehr braucht es nicht, damit
   * ein Haufen wie ein Haufen wirkt - und alles darueber hinaus waere ein zweiter
   * Bewegungsapparat neben `stepEnemies`, der dessen Wegfindung staendig ueberstimmt.
   */

  /** Fahrtrichtung mal Tempo aus dem letzten Takt. Nur der Stoss braucht sie. */
  vel: Vec2
  /** Stoss aus Beruehrungen, in Welteinheiten je Sekunde. Klingt von selbst ab. */
  push: Vec2
  /** Eigendrehung als Winkel und Winkeltempo. Reine Anzeige, aber aus Beruehrungen gerechnet. */
  spin: number
  spinRate: number
  /** Kennung des Moduls, an dem er andockt. Angedockte Gegner stehen still. */
  dockedTo: string | null
  attackTimer: number
  /**
   * Der Biss: Alter und Dauer des Stosses zur Station hin, dazu seine Richtung.
   *
   * Reine Anzeige. Ein angedockter Gegner steht still und schlaegt zu - ohne diesen Stoss
   * unterscheidet ihn nichts von einem, der nur herumsteht, und man sieht der Station an,
   * *dass* sie Schaden nimmt, aber nicht *wer* ihn anrichtet.
   */
  bite: number
  biteLife: number
  biteDir: Vec2

  /*
   * Zustaende, die Tuerme und Faehigkeiten auf einem Gegner hinterlassen (E14) und die
   * Faehigkeiten, die er selbst mitbringt (E15).
   *
   * Sie stehen alle hier und nicht in eigenen Listen, weil ein Gegner aus einem Pool kommt:
   * Ein zweiter Speicher neben dem Pool muesste beim Zuruecklegen mit aufgeraeumt werden,
   * und genau das vergisst man. Ein Feld am Gegner verschwindet mit ihm.
   */

  /** Brandschaden je Sekunde und Restdauer (Flammenturm, GDD 05). */
  burnDps: number
  burnLeft: number
  /** Tempofaktor und Restdauer einer Verlangsamung (Eis- und Void-Turm). */
  chillFactor: number
  chillLeft: number

  /** Anteil des Schadens, den ein Energieschild abfaengt (GDD 07 Abschnitt 5). */
  shield: number
  /** Anteil des Schadens, der zurueckgeworfen wird - der Reflektor. */
  reflect: number
  /** Heilung je Sekunde, die dieser Gegner an sich selbst vornimmt (Elite: Regeneration). */
  regen: number
  /**
   * Wie stark er wird, je weniger Leben er hat (Berserker). 0 = gar nicht.
   * Der Zuschlag wirkt auf Schaden und Tempo und waechst linear mit dem fehlenden Leben.
   */
  berserk: number
  /** Sichtbarkeit einer Tarn-Einheit: unter 0 ist sie unsichtbar und kein Ziel. */
  cloak: number
  /** Uhr fuer alles, was in Abstaenden passiert - heilen, springen, beschwoeren. */
  abilityTimer: number
  /**
   * Wie weit ein Verstaerker diesen Gegner schon hochgezogen hat, als Faktor.
   *
   * Er wird **mitgefuehrt** und nicht aus dem aktuellen Schaden erschlossen: Ein Vergleich
   * gegen den eigenen Wert kann nie eine Grenze sein, weil er sich mit ihm verschiebt.
   * Genau dieser Fehler stand hier und liess zwei Verstaerker den Schaden ins Astronomische
   * treiben - gefunden vom Selbsttest, nicht am Bild.
   */
  empowered: number
  /** Gekaufte Elite-Modifikatoren. Nur fuer Anzeige und Selbsttest. */
  elite: string[]

  /** false = liegt im Pool und wird nicht simuliert. */
  active: boolean
}

function blankEnemy(id: number): Enemy {
  return {
    id,
    defId: '',
    pos: { x: 0, y: 0 },
    hp: 0,
    maxHp: 0,
    speed: 0,
    damage: 0,
    radius: 0,
    goldReward: 0,
    xpReward: 0,
    vel: { x: 0, y: 0 },
    push: { x: 0, y: 0 },
    spin: 0,
    spinRate: 0,
    dockedTo: null,
    attackTimer: 0,
    bite: 0,
    biteLife: 0,
    biteDir: { x: 0, y: 0 },
    burnDps: 0,
    burnLeft: 0,
    chillFactor: 1,
    chillLeft: 0,
    shield: 0,
    reflect: 0,
    regen: 0,
    berserk: 0,
    cloak: 1,
    abilityTimer: 0,
    empowered: 1,
    elite: [],
    active: false,
  }
}

/** Ring, auf dem Gegner erscheinen: um die Station herum, ausserhalb des Bildes. */
export function spawnRadius(modules: readonly PlacedModule[]): number {
  const bounds = boundsOf(modules.map((module) => module.poly))
  if (!bounds) return SPAWN_RING_MARGIN

  const half = Math.max(
    Math.abs(bounds.maxX),
    Math.abs(bounds.minX),
    Math.abs(bounds.maxY),
    Math.abs(bounds.minY),
  )
  return half + SPAWN_RING_MARGIN
}

/**
 * Erzeugt einen Gegner aus dem Pool. Gibt `null` zurueck, wenn die Obergrenze erreicht
 * ist - die Welle verliert dadurch keinen Gegner, er erscheint nur spaeter.
 */
export function spawnEnemy(state: GameState, defId: string, angle: number): Enemy | null {
  const combat = state.runtime.combat
  if (combat.enemies.length >= MAX_ENEMIES) return null

  const def = enemyById(defId)
  const plan = combat.plan
  const hpScale = plan?.hpScale ?? 1
  const damageScale = plan?.damageScale ?? 1
  const speedScale = plan?.speedScale ?? 1
  const rewardScale = plan?.rewardScale ?? 1

  const enemy = combat.enemyPool.pop() ?? blankEnemy(combat.nextId++)
  const radius = spawnRadius(combat.modules)
  /*
   * Zuschlag aus einem laufenden Ereignis (GDD 11 Abschnitt 5: "Gegner werden staerker").
   *
   * Er wirkt beim **Erscheinen** und nicht laufend: Ein Gegner, dessen Lebenspunkte sich
   * mitten im Kampf aendern, waere nicht zu lesen - seine Leiste spraenge. Die Zahl steht
   * fertig im Kampfzustand; `sim/events.ts` schreibt sie, hier wird nur gelesen.
   */
  const power = Number.isFinite(combat.enemyPower) && combat.enemyPower > 0 ? combat.enemyPower : 1

  enemy.defId = def.id
  enemy.pos = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  enemy.maxHp = def.hp * ENEMY_BASE_HP * hpScale * power
  enemy.hp = enemy.maxHp
  enemy.speed = def.speed * ENEMY_BASE_SPEED * speedScale
  enemy.damage = def.damage * ENEMY_BASE_DAMAGE * damageScale * power
  enemy.radius = def.size
  enemy.goldReward = def.gold * rewardScale
  enemy.xpReward = def.xp * rewardScale
  enemy.dockedTo = null
  enemy.attackTimer = 0
  // Aus dem Pool geholt: Der Biss des Vorgaengers darf nicht mitkommen.
  enemy.bite = 0
  enemy.biteLife = 0

  // Ebenso wenig sein Schwung und seine Drehung. Ein Gegner, der mit dem Stoss seines
  // Vorgaengers erscheint, driftet im ersten Takt sichtbar zur Seite.
  enemy.vel.x = 0
  enemy.vel.y = 0
  enemy.push.x = 0
  enemy.push.y = 0
  enemy.spin = 0
  enemy.spinRate = 0

  // Ebenso wenig seine Zustaende und Faehigkeiten. Zuruecksetzen **vor** dem Anwenden der
  // eigenen Datenwerte, sonst erbte ein Schwarmkruemel den Schild eines Bosses.
  enemy.burnDps = 0
  enemy.burnLeft = 0
  enemy.chillFactor = 1
  enemy.chillLeft = 0
  enemy.shield = 0
  enemy.reflect = 0
  enemy.regen = 0
  enemy.berserk = 0
  enemy.cloak = 1
  enemy.abilityTimer = 0
  enemy.empowered = 1
  enemy.elite = []

  applyAbilities(enemy, def)
  enemy.active = true

  combat.enemies.push(enemy)
  return enemy
}

/**
 * Die Faehigkeiten aus dem Datensatz auf den Gegner uebertragen (GDD 07 Abschnitt 5).
 *
 * Was hier steht, ist bewusst nur ein Uebertrag - **kein Verhalten**. Das Verhalten liegt
 * in `stepAbilities` und in `applyDamage`, und beide kennen nur die Felder am Gegner, nicht
 * die Gegnerart. Genau das ist die Abnahmebedingung von E15: Ein neuer Gegner ist ein
 * Datensatz, kein Eingriff in den Kampfkern.
 */
function applyAbilities(enemy: Enemy, def: EnemyDef): void {
  for (const ability of def.abilities ?? []) {
    switch (ability.kind) {
      case 'shield':
        enemy.shield = ability.reduction
        break
      case 'reflect':
        enemy.reflect = ability.share
        break
      case 'berserk':
        enemy.berserk = ability.maxBonus
        break
      case 'cloak':
      case 'heal':
      case 'teleport':
      case 'spawn':
      case 'empower':
        // Alles, was in Abstaenden passiert, braucht nur die laufende Uhr - die Werte
        // liest `stepAbilities` bei jedem Takt aus dem Datensatz.
        break
    }
  }
}

/**
 * Boss zu Beginn seiner Welle. Er **ersetzt** die Welle nicht, er ergaenzt sie: Waehrend
 * des Kampfes stroemen die normalen Gegner weiter nach (GDD 07 Abschnitt 7).
 */
export function spawnBoss(state: GameState, wave: number): Enemy | null {
  const def = bossForWave(wave)
  const angle = state.runtime.rng.fork(wave * 31 + 7).range(0, Math.PI * 2)
  const boss = spawnEnemy(state, def.id, angle)
  if (boss) {
    state.runtime.combat.bossId = boss.id
    emit('boss.spawned', { wave })
  }
  return boss
}

/**
 * Einen Gegner beim Erscheinen zum Elite machen (GDD 07 Abschnitt 6).
 *
 * Die Chance steigt mit der Welle und ist **vor Welle 50 null** - bis dahin sind Elites
 * laut GDD noch nicht eingefuehrt. Danach waechst sie langsam und wird gedeckelt: Eine
 * Welle, in der jeder Gegner ein Elite ist, waere keine Steigerung mehr, sondern nur eine
 * andere Grundschwierigkeit.
 *
 * Bosse bleiben aussen vor. Ein Boss ist bereits die Zaesur der Welle; ihn zusaetzlich zu
 * verstaerken macht ihn nicht interessanter, nur laenger.
 */
export function maybeMakeElite(state: GameState, enemy: Enemy, wave: number): void {
  if (enemyById(enemy.defId).isBoss) return

  const chance = eliteChance(wave)
  if (chance <= 0) return

  const rng = state.runtime.rng
  // Mehrere Modifikatoren auf einem Gegner sind erst in spaeten Wellen moeglich - das ist
  // die "teils mehrere Modifikatoren pro Gegner" aus GDD 07 Abschnitt 6.
  const rolls = wave >= 300 ? 2 : 1
  for (let i = 0; i < rolls; i++) {
    if (!rng.chance(chance)) continue
    const modifier = rng.pick(ELITE_MODIFIERS)
    if (enemy.elite.includes(modifier.id)) continue
    applyEliteModifier(enemy, modifier)
  }
}

/** Chance, dass ein Gegner dieser Welle ein Elite wird. */
export function eliteChance(wave: number): number {
  if (wave < ELITE_FROM_WAVE) return 0
  const over = wave - ELITE_FROM_WAVE
  return Math.min(ELITE_MAX_CHANCE, over * ELITE_CHANCE_GROWTH)
}

/**
 * Einen Modifikator anwenden. Rein multiplikativ auf das, was schon da ist - dadurch
 * stapeln sich zwei Modifikatoren sinnvoll, ohne dass die Funktion sie kennen muss.
 */
export function applyEliteModifier(enemy: Enemy, modifier: EliteModifier): void {
  enemy.maxHp *= modifier.hp ?? 1
  enemy.hp = enemy.maxHp
  enemy.speed *= modifier.speed ?? 1
  enemy.damage *= modifier.damage ?? 1
  enemy.goldReward *= modifier.gold ?? 1
  enemy.xpReward *= modifier.xp ?? 1
  if (modifier.regen) enemy.regen += enemy.maxHp * modifier.regen
  enemy.elite.push(modifier.id)
}

/** Der aktive Boss, falls es einen gibt. */
export function activeBoss(state: GameState): Enemy | null {
  const combat = state.runtime.combat
  if (combat.bossId === null) return null
  return combat.enemies.find((enemy) => enemy.id === combat.bossId) ?? null
}

/** Zurueck in den Pool. Der Gegner behaelt seine Kennung, damit Ereignisse zuordenbar bleiben. */
export function releaseEnemy(state: GameState, enemy: Enemy): void {
  const combat = state.runtime.combat
  const index = combat.enemies.indexOf(enemy)
  if (index >= 0) combat.enemies.splice(index, 1)

  enemy.active = false
  enemy.dockedTo = null
  combat.enemyPool.push(enemy)
}

/** Modul, das einem Punkt am naechsten liegt - gemessen am Mittelpunkt des Moduls. */
export function nearestModule(
  modules: readonly PlacedModule[],
  point: Vec2,
): PlacedModule | null {
  let best: PlacedModule | null = null
  let bestDistance = Infinity

  for (const module of modules) {
    const distance = dist(point, module.center)
    if (distance < bestDistance) {
      bestDistance = distance
      best = module
    }
  }
  return best
}

/** Abstand eines Punktes zur Aussenkante eines Moduls - ohne Vorzeichen. */
export function distanceToModule(module: PlacedModule, point: Vec2): number {
  let closest = Infinity
  for (const edge of edgesOf(module.poly)) {
    const distance = pointSegmentDistance(point, edge)
    if (distance < closest) closest = distance
  }
  return closest
}

/** Beruehrt ein Kreis um `point` das Modul - oder liegt er darin? */
export function touchesModule(module: PlacedModule, point: Vec2, radius: number): boolean {
  return pointInPolygon(point, module.poly) || distanceToModule(module, point) <= radius
}

/**
 * Steht dieser Gegner in irgendeinem Wirkungskreis - kann ihn also ueberhaupt jemand
 * treffen?
 *
 * Die Bedingung ist wortgleich mit der in `sim/targeting.ts`: `range + enemy.radius`. Das
 * ist kein Zufall und darf keiner bleiben - laege die Tempogrenze auch nur ein paar
 * Einheiten daneben, gaebe es einen Streifen, in dem ein Gegner schon langsam laeuft, aber
 * noch kein Turm schiesst (oder schlimmer: umgekehrt).
 */
export function inCoverage(circles: readonly RangeCircle[], enemy: Enemy): boolean {
  for (const circle of circles) {
    if (dist(circle.center, enemy.pos) <= circle.range + enemy.radius) return true
  }
  return false
}

/**
 * Was Gegner **koennen** (GDD 07 Abschnitt 5).
 *
 * Eine Schleife fuer alle Faehigkeiten, gesteuert allein durch den Datensatz. Ein neuer
 * Gegner mit einer vorhandenen Faehigkeit ist damit ein Eintrag in `data/enemies.ts` und
 * beruehrt diese Funktion nicht - genau das verlangt die Abnahme von E15.
 *
 * Alles, was in Abstaenden passiert, teilt sich **eine** Uhr je Gegner. Ein Gegner mit zwei
 * getakteten Faehigkeiten fuehrt sie damit im Gleichschritt aus; das ist gewollt, denn zwei
 * Uhren je Gegner waeren zwei Felder mehr im Pool und ein Fehler mehr beim Zuruecksetzen.
 */
export function stepEnemyAbilities(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  for (const enemy of [...combat.enemies]) {
    if (!enemy.active) continue
    const def = enemyById(enemy.defId)
    if (!def.abilities || def.abilities.length === 0) continue

    enemy.abilityTimer += dt

    for (const ability of def.abilities) {
      switch (ability.kind) {
        case 'cloak': {
          // Ein Sinus zwischen sichtbar und unsichtbar, aus der eigenen Uhr. Kein
          // Zufall, kein zweiter Zaehler - dieselbe Tarnung sieht immer gleich aus.
          const cycle = ability.visible + ability.hidden
          const phase = enemy.abilityTimer % cycle
          enemy.cloak = phase < ability.visible ? 1 : -1
          break
        }
        case 'heal': {
          if (enemy.abilityTimer < ability.interval) break
          for (const other of combat.enemies) {
            if (!other.active || other === enemy || other.hp >= other.maxHp) continue
            if (Math.hypot(other.pos.x - enemy.pos.x, other.pos.y - enemy.pos.y) > ability.radius) {
              continue
            }
            other.hp = Math.min(other.maxHp, other.hp + ability.amount)
          }
          break
        }
        case 'empower': {
          if (enemy.abilityTimer < ability.interval) break
          for (const other of combat.enemies) {
            if (!other.active || other === enemy) continue
            if (Math.hypot(other.pos.x - enemy.pos.x, other.pos.y - enemy.pos.y) > ability.radius) {
              continue
            }
            // Gedeckelt ueber den **mitgefuehrten** Faktor. Gegen den eigenen Schaden zu
            // pruefen waere keine Grenze: Der Vergleichswert waechst mit.
            if (other.empowered >= EMPOWER_CAP) continue
            other.empowered *= 1 + ability.damage
            other.damage *= 1 + ability.damage
            other.speed *= 1 + ability.speed
          }
          break
        }
        case 'teleport': {
          if (enemy.abilityTimer < ability.interval) break
          if (enemy.dockedTo !== null) break
          // Zur Station hin, nie darueber hinaus: Ein Sprung mitten in die Station waere
          // kein Ueberspringen, sondern ein Durchbruch.
          const length = Math.hypot(enemy.pos.x, enemy.pos.y)
          if (length > ability.distance) {
            const step = Math.min(ability.distance, length)
            enemy.pos.x -= (enemy.pos.x / length) * step
            enemy.pos.y -= (enemy.pos.y / length) * step
          }
          break
        }
        case 'spawn': {
          if (enemy.abilityTimer < ability.interval) break
          for (let i = 0; i < ability.count; i++) {
            const angle = Math.atan2(enemy.pos.y, enemy.pos.x)
            const child = spawnEnemy(state, ability.defId, angle)
            // Direkt neben den Erzeuger statt auf den Erscheinungsring - sonst waere die
            // Brut naeher an ihrem Ursprung als am Ort, an dem sie erscheinen soll.
            if (child) {
              child.pos.x = enemy.pos.x + state.runtime.fxRng.range(-24, 24)
              child.pos.y = enemy.pos.y + state.runtime.fxRng.range(-24, 24)
            }
          }
          break
        }
        case 'shield':
        case 'reflect':
        case 'berserk':
          // Dauerhafte Eigenschaften - sie stehen als Feld am Gegner und wirken dort, wo
          // Schaden entsteht. Hier ist nichts zu tun.
          break
      }
    }

    // Die Uhr laeuft fuer alle getakteten Faehigkeiten gemeinsam zurueck.
    const interval = shortestInterval(def)
    if (interval > 0 && enemy.abilityTimer >= interval) enemy.abilityTimer -= interval
  }
}

/** Kuerzester Takt unter den Faehigkeiten - er bestimmt, wann die gemeinsame Uhr umbricht. */
function shortestInterval(def: EnemyDef): number {
  let shortest = 0
  for (const ability of def.abilities ?? []) {
    if (!('interval' in ability)) continue
    if (shortest === 0 || ability.interval < shortest) shortest = ability.interval
  }
  return shortest
}

export function stepEnemies(state: GameState, dt: number): void {
  const combat = state.runtime.combat
  const modules = combat.modules
  if (modules.length === 0) return

  for (const enemy of combat.enemies) {
    if (enemy.dockedTo !== null) {
      // Wer steht, hat keinen Schwung mehr. Ohne das behielte ein angedockter Gegner die
      // Fahrtrichtung von eben und schoebe seine Nachbarn ewig in die Station.
      enemy.vel.x = 0
      enemy.vel.y = 0
      continue
    }

    const target = nearestModule(modules, enemy.pos)
    if (!target) continue

    // Andocken, sobald die Aussenkante beruehrt wird. Der Test auf "im Modul" ist kein
    // Sonderfall fuer die Optik: Ein sehr schneller Gegner kann in einem einzigen Schritt
    // ueber die Kante hinweg im Modul landen - ohne ihn wuerde er dort ewig kreisen.
    if (touchesModule(target, enemy.pos, enemy.radius)) {
      enemy.dockedTo = target.uid
      enemy.attackTimer = 0
      enemy.vel.x = 0
      enemy.vel.y = 0
      continue
    }

    const dx = target.center.x - enemy.pos.x
    const dy = target.center.y - enemy.pos.y
    const length = Math.hypot(dx, dy)
    if (length < 1e-6) continue

    // In den vorhandenen Vektor schreiben statt einen neuen zu legen - bei 200 Gegnern
    // und 60 Takten waeren das sonst zwoelftausend Objekte je Sekunde gegen den Pool.
    //
    // Der Faktor kommt aus einer laufenden Verlangsamung (GDD 09 Abschnitt 10) und steht
    // als fertige Zahl im Kampfzustand - `sim/abilities.ts` setzt ihn je Takt.
    // Vier Faktoren auf dasselbe Tempo: sein eigenes, die Verlangsamung durch eine
    // Faehigkeit (E11), die durch einen Turm (E14) und der Anmarsch. Alle vier
    // multiplizieren, keiner kennt die anderen.
    //
    // Der Anmarsch gilt, solange ihn **kein** Turm erreicht (GDD 07 Abschnitt 2): Wer
    // ausserhalb aller Wirkungskreise laeuft, legt eine Strecke zurueck, auf der ohnehin
    // nichts geschieht. Beruehrt er einen Kreis auch nur, faellt er im selben Takt auf sein
    // normales Tempo - und zwar an genau der Linie, an der die ersten Schuesse fallen.
    // Eine Verlangsamung bleibt dabei wirksam: Sie multipliziert mit, statt ersetzt zu
    // werden, sonst waere ein Frosttreffer knapp ausserhalb der Reichweite wirkungslos.
    const approach = inCoverage(combat.coverage, enemy) ? 1 : ENEMY_APPROACH_SPEED_FACTOR
    const stride = enemy.speed * combat.enemySpeedFactor * enemy.chillFactor * approach * dt
    enemy.pos.x += (dx / length) * stride
    enemy.pos.y += (dy / length) * stride

    // Die gefahrene Geschwindigkeit merken - das Streifen an einem Nachbarn braucht sie,
    // und sie hier abzugreifen ist genauer als sie dort aus Tempo und Richtung neu
    // zusammenzusetzen: Verlangsamung und Wellenfaktor stecken schon drin.
    enemy.vel.x = ((dx / length) * stride) / dt
    enemy.vel.y = ((dy / length) * stride) / dt
  }

  stepCrowd(combat.enemies, dt)
}

/**
 * Gegner stossen sich an, statt sich zu durchdringen (Politur).
 *
 * Vorher liefen Gegner voreinander her wie Zeichen auf einer Linie: Zwei auf demselben Kurs
 * lagen deckungsgleich uebereinander, ein dritter fuhr mitten durch sie hindurch. Ein Pulk
 * sah deshalb nach Liste aus und nicht nach Menge.
 *
 * Es ist bewusst **keine** Kollisionsaufloesung. Ein Gegner wird nicht aus dem anderen
 * herausgeschoben, er bekommt nur einen Stoss in seine Richtung, und der Stoss klingt von
 * selbst ab. Der Unterschied ist der ganze Punkt:
 *
 *   - Harte Aufloesung wuerde die Wegfindung ueberstimmen. Ein Ring angedockter Gegner
 *     waere eine Mauer, hinter der die halbe Welle haengen bliebe - das Spiel ist auf
 *     durchkommende Gegner ausgelegt (GDD 07 Abschnitt 2), nicht auf einen Stau.
 *   - Ein weicher Stoss bleibt eine Aussage ueber Enge: Es wird gedraengelt, aber niemand
 *     wird aufgehalten.
 *
 * Die Drehung kommt **nicht** aus dem Stoss. Der laeuft immer durch beide Mittelpunkte und
 * kann deshalb per Definition nichts drehen. Sie kommt aus dem *Streifen*: Wer einen
 * Nachbarn schraeg erwischt, schert an ihm ab, und beide drehen sich gegeneinander weg -
 * wie zwei Zahnraeder. Genau das heisst "an bestimmten Stellen": mittig treffen heisst
 * schieben, seitlich treffen heisst drehen.
 *
 * Alle Paare gegeneinander. Bei `MAX_ENEMIES` sind das nicht ganz 20 000 Abstaende je Takt,
 * und ein Abstand ist hier eine Multiplikation und ein Vergleich - ohne Wurzel, solange sich
 * nichts beruehrt. Ein Raster daneben waere schneller und ein zweiter Ort, an dem Gegner
 * verwaltet werden; es lohnt erst, wenn die Obergrenze steigt.
 */
function stepCrowd(enemies: readonly Enemy[], dt: number): void {
  const count = enemies.length

  for (let i = 0; i < count; i++) {
    const a = enemies[i] as Enemy

    for (let j = i + 1; j < count; j++) {
      const b = enemies[j] as Enemy

      const reach = a.radius + b.radius
      let dx = b.pos.x - a.pos.x
      let dy = b.pos.y - a.pos.y
      const square = dx * dx + dy * dy
      if (square >= reach * reach) continue

      let length = Math.sqrt(square)
      if (length < 1e-4) {
        // Zwei Gegner genau aufeinander - das passiert, wenn eine Brut auf ihrem Erzeuger
        // erscheint. Die Richtung kommt aus ihren Kennungen und nicht aus dem Zufall:
        // Derselbe Fall muss immer gleich ausgehen, sonst laeuft der Selbsttest zweimal
        // verschieden.
        dx = (a.id + b.id) % 2 === 0 ? 1 : 0
        dy = 1 - dx
        length = 1
      }

      const nx = dx / length
      const ny = dy / length

      /*
       * Wer weicht wie weit? Nach Flaeche, nicht nach Anzahl: Ein Boss schiebt einen
       * Schwarmkruemel beiseite, umgekehrt kommt er kaum vom Kurs ab. Ein angedockter
       * Gegner steht fest - er hat sein Ziel erreicht und darf nicht wieder losgerissen
       * werden, sonst dockte er im naechsten Takt erneut an und die Station naehme Schaden
       * im Takt des Gedraengels statt im Takt der Schlaege.
       */
      const fixedA = a.dockedTo !== null
      const fixedB = b.dockedTo !== null
      const massA = a.radius * a.radius
      const massB = b.radius * b.radius
      const shareA = fixedA ? 0 : fixedB ? 1 : massB / (massA + massB)
      const shareB = fixedB ? 0 : fixedA ? 1 : 1 - shareA

      const force = Math.min(CROWD_PUSH_MAX, (reach - length) * CROWD_PUSH)
      a.push.x -= nx * force * shareA * dt
      a.push.y -= ny * force * shareA * dt
      b.push.x += nx * force * shareB * dt
      b.push.y += ny * force * shareB * dt

      // Der Anteil der Bewegung **quer** zur Beruehrung: Das ist das Abscheren.
      const slip = (a.vel.x - b.vel.x) * -ny + (a.vel.y - b.vel.y) * nx
      a.spinRate -= (slip / Math.max(1, a.radius)) * SPIN_GAIN * dt
      b.spinRate += (slip / Math.max(1, b.radius)) * SPIN_GAIN * dt
    }
  }

  /*
   * Stoss und Drehung altern.
   *
   * Beide klingen ueber `1 / (1 + k*dt)` ab statt ueber `1 - k*dt`. Der zweite Ausdruck
   * wird bei grossen Schritten negativ und kehrt die Bewegung um - und grosse Schritte gibt
   * es hier: Der Zeitraffer laeuft mit bis zu vierfachem Tempo, und ein Takt nach einem
   * Fensterwechsel ist noch laenger.
   *
   * Die Drehung haengt zusaetzlich an einer Feder zurueck in die Ruhelage und ist gedeckelt.
   * Beides ist keine Physik, sondern Lesbarkeit: Form zeigt die Rolle (GDD 07 Abschnitt 3),
   * und ein frei rotierendes Quadrat waere bei 45 Grad eine Raute - also ein anderer Gegner.
   * Ein Ausschlag von rund 20 Grad ist als Wanken zu sehen und nie als andere Form.
   */
  const pushKeep = 1 / (1 + PUSH_DAMPING * dt)
  const spinKeep = 1 / (1 + SPIN_DAMPING * dt)

  for (const enemy of enemies) {
    if (enemy.dockedTo === null) {
      enemy.pos.x += enemy.push.x * dt
      enemy.pos.y += enemy.push.y * dt
    }
    enemy.push.x *= pushKeep
    enemy.push.y *= pushKeep

    enemy.spinRate -= enemy.spin * SPIN_RETURN * dt
    enemy.spinRate *= spinKeep
    enemy.spin += enemy.spinRate * dt
    if (enemy.spin > SPIN_MAX) enemy.spin = SPIN_MAX
    else if (enemy.spin < -SPIN_MAX) enemy.spin = -SPIN_MAX
  }
}

/**
 * Module, an denen niemand mehr andocken kann, weil sie nicht mehr existieren - etwa
 * nachdem der Spieler mitten im Kampf umgebaut hat. Die Gegner suchen sich neu ein Ziel.
 */
export function releaseStaleDocks(state: GameState): void {
  const combat = state.runtime.combat
  const alive = new Set(combat.modules.map((module) => module.uid))

  for (const enemy of combat.enemies) {
    if (enemy.dockedTo !== null && !alive.has(enemy.dockedTo)) enemy.dockedTo = null
  }
}
