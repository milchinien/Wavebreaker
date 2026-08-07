/**
 * Wellenerzeugung und Wellenzustand (GDD 07).
 *
 * Wellen werden **dynamisch erzeugt**, nicht einzeln definiert (GDD 16 Abschnitt 6).
 * `buildWave` ist dabei eine reine Funktion: gleiche Welle plus gleicher Seed ergibt
 * dieselbe Welle. Ohne das waere ein Balancing-Fehler nicht nachstellbar.
 *
 * Der gesamte Ablauf einer Welle steckt im Plan, auch die Richtung, aus der jeder Gegner
 * kommt - der Zufall wird also **einmal** gezogen und nicht ueber die Welle verteilt.
 */

import { emit } from '../core/events.ts'
import type { Rng } from '../core/rng.ts'
import { markDirty, type GameState } from '../app/state.ts'
import {
  BOSS_WAVE_INTERVAL,
  MAX_SPEED_SCALE,
  REWARD_SCALING,
  WAVE_BASE_COUNT,
  WAVE_COUNT_GROWTH,
  WAVE_DAMAGE_SCALING,
  WAVE_PAUSE_SECONDS,
  WAVE_SCALING,
  WAVE_SPAWN_WINDOW_SECONDS,
  WAVE_SPEED_SCALING,
} from '../data/balance.ts'
import { enemiesForWave, type EnemyDef } from '../data/enemies.ts'
import { collapseStation } from './combat.ts'
import { maybeMakeElite, releaseEnemy, spawnBoss, spawnEnemy } from './enemies.ts'
import { releaseProjectile } from './projectiles.ts'
import { maxStationHp } from './stats.ts'

export type WaveSpawn = {
  defId: string
  /** Zeitpunkt innerhalb der Welle, in Sekunden. */
  at: number
  /** Richtung auf dem Ring rund um die Station, im Bogenmass. */
  angle: number
}

export type WavePlan = {
  wave: number
  spawns: WaveSpawn[]
  /** Faktoren, mit denen die Grundwerte der Gegnerarten multipliziert werden. */
  hpScale: number
  damageScale: number
  speedScale: number
  rewardScale: number
}

/** Anzahl Gegner einer Welle. Waechst linear - die Haerte kommt aus den Werten. */
export function enemyCount(wave: number): number {
  return Math.max(1, Math.round(WAVE_BASE_COUNT + (wave - 1) * WAVE_COUNT_GROWTH))
}

/**
 * Wachstum je Welle. Bewusst nicht linear (GDD 07 Abschnitt 12): fruehe Wellen steigen
 * langsam, spaete extrem.
 */
export function scaleFor(wave: number, factor: number): number {
  return Math.pow(factor, Math.max(0, wave - 1))
}

/**
 * Erzeugt den vollstaendigen Ablauf einer Welle. Rein - keine Nebenwirkung, kein Zugriff
 * auf den Spielzustand.
 */
export function buildWave(wave: number, rng: Rng): WavePlan {
  const available = enemiesForWave(wave)
  const count = enemyCount(wave)
  const spawns: WaveSpawn[] = []

  // Gleichmaessig ueber das Zeitfenster verteilt, mit leichtem Versatz - es soll nie
  // Leerlauf entstehen, aber auch kein Gleichschritt (GDD 07 Abschnitt 2).
  const step = WAVE_SPAWN_WINDOW_SECONDS / count
  for (let i = 0; i < count; i++) {
    const def = pickWeighted(available, rng)
    spawns.push({
      defId: def.id,
      at: i * step + rng.range(0, step * 0.6),
      angle: rng.range(0, Math.PI * 2),
    })
  }
  spawns.sort((a, b) => a.at - b.at)

  return {
    wave,
    spawns,
    hpScale: scaleFor(wave, WAVE_SCALING),
    damageScale: scaleFor(wave, WAVE_DAMAGE_SCALING),
    speedScale: Math.min(MAX_SPEED_SCALE, scaleFor(wave, WAVE_SPEED_SCALING)),
    rewardScale: scaleFor(wave, REWARD_SCALING),
  }
}

function pickWeighted(candidates: readonly EnemyDef[], rng: Rng): EnemyDef {
  if (candidates.length === 0) throw new Error('Keine Gegnerart fuer diese Welle')

  let total = 0
  for (const candidate of candidates) total += candidate.weight

  let roll = rng.range(0, total)
  for (const candidate of candidates) {
    roll -= candidate.weight
    if (roll <= 0) return candidate
  }
  return candidates[candidates.length - 1] as EnemyDef
}

// ---------------------------------------------------------------------------
// Wellenzustand
// ---------------------------------------------------------------------------

/**
 * Eine Welle beginnen. Das Feld wird geleert und die Station **vollstaendig geheilt** -
 * jede Welle ist eine in sich abgeschlossene Pruefung (GDD 07 Abschnitt 13).
 *
 * Der Zufall wird aus dem Hauptstrom **abgeleitet**, nicht aus ihm gezogen: Damit ergibt
 * dieselbe Welle bei demselben Spielstand immer dieselbe Zusammensetzung - auch beim
 * Zurueckskippen (GDD 07 Abschnitt 10).
 */
export function startWave(state: GameState, wave: number): void {
  const combat = state.runtime.combat

  state.run.wave = wave
  if (wave > state.run.waveRecord) state.run.waveRecord = wave
  if (wave > state.permanent.bestWaveEver) state.permanent.bestWaveEver = wave

  clearField(state)
  combat.plan = buildWave(wave, state.runtime.rng.fork(wave))
  combat.spawnIndex = 0
  combat.timer = 0
  combat.phase = 'running'
  combat.killsThisWave = 0
  combat.bossId = null
  healStationFull(state)

  // Der Boss erscheint sofort, waehrend die normalen Gegner weiter nachstroemen.
  if (isBossWave(wave)) spawnBoss(state, wave)

  markDirty(state)
  emit('wave.started', { wave })
}

// ---------------------------------------------------------------------------
// Wellensteuerung (GDD 07 Abschnitt 10)
// ---------------------------------------------------------------------------

/** Alle zehn Wellen erscheint ein Boss (GDD 07 Abschnitt 7). */
export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % BOSS_WAVE_INTERVAL === 0
}

export function setAutoMode(state: GameState, on: boolean): void {
  if (state.run.autoWaves === on) return
  state.run.autoWaves = on
  markDirty(state)
  emit('wave.autoModeChanged', { on })
}

/**
 * Vorwaerts nur bis zur hoechsten **in diesem Run** erreichten Welle - kein Sprung in
 * unerreichten Inhalt. Zurueck ist immer erlaubt: Es ist eine Sicherheitsoption, keine
 * Abkuerzung, denn die Belohnungen haengen an der gespielten Welle, nicht am Rekord.
 */
export function canSkipTo(state: GameState, wave: number): boolean {
  return wave >= 1 && wave <= state.run.waveRecord
}

export function nextWave(state: GameState): boolean {
  const target = state.run.wave + 1
  // Eine Welle weiter als der Rekord ist genau der naechste, noch ungespielte Schritt -
  // er ist erlaubt, sonst kaeme der Run nie voran.
  if (target > state.run.waveRecord + 1) return false
  startWave(state, target)
  return true
}

export function previousWave(state: GameState): boolean {
  const target = state.run.wave - 1
  if (!canSkipTo(state, target)) return false
  startWave(state, target)
  return true
}

/** Dieselbe Welle erneut - ohne Verlust von Tuermen, Gold oder Fortschritt (GDD 02). */
export function restartWave(state: GameState): void {
  const combat = state.runtime.combat
  const attempts = combat.lostAttempts + 1

  // Der Fall der Station ist die groesste Zaesur des Kampfes und war bisher die einzige,
  // die spurlos passierte: Feld leer, HP wieder voll, weiter geht es. Das Nachzittern des
  // Kerns dauert hier deutlich laenger als bei einem einzelnen Treffer.
  collapseStation(state)
  emit('wave.lost', { wave: state.run.wave, attempt: attempts })
  startWave(state, state.run.wave)
  combat.lostAttempts = attempts
}

/** Nach jeder Welle volle HP - angesammelter Schaden zieht den Run nicht nach unten. */
export function healStationFull(state: GameState): void {
  const combat = state.runtime.combat
  combat.maxStationHp = maxStationHp(state)
  combat.stationHp = combat.maxStationHp
}

/** Alle Gegner und Geschosse zurueck in ihre Pools. Es gibt keinen Uebertrag. */
export function clearField(state: GameState): void {
  const combat = state.runtime.combat
  for (const enemy of [...combat.enemies]) releaseEnemy(state, enemy)
  for (const projectile of [...combat.projectiles]) releaseProjectile(state, projectile)
  combat.hits.length = 0
}

/**
 * Eine Welle ist geschafft, wenn alle ihre Gegner erschienen **und** zerstoert sind.
 * Es gibt kein Zeitlimit - eine zaehe Welle dauert eben laenger (GDD 07 Abschnitt 9).
 */
export function isWaveCleared(state: GameState): boolean {
  const combat = state.runtime.combat
  if (!combat.plan) return false
  return combat.spawnIndex >= combat.plan.spawns.length && combat.enemies.length === 0
}

/**
 * Laesst die Welle voranschreiten: gestaffeltes Erscheinen, danach die Pause.
 * Ist die Obergrenze gleichzeitiger Gegner erreicht, wartet der naechste Eintrag -
 * die Welle verliert dadurch keinen Gegner (GDD 16 Abschnitt 12).
 */
export function stepWave(state: GameState, dt: number): void {
  const combat = state.runtime.combat

  if (combat.phase === 'pause') {
    combat.timer -= dt
    // Ist der Auto-Modus aus, wartet das Spiel auf den Spieler (GDD 07 Abschnitt 10).
    if (combat.timer <= 0 && state.run.autoWaves) startWave(state, state.run.wave + 1)
    return
  }

  const plan = combat.plan
  if (!plan) return

  combat.timer += dt
  while (combat.spawnIndex < plan.spawns.length) {
    const next = plan.spawns[combat.spawnIndex] as WaveSpawn
    if (next.at > combat.timer) break

    const enemy = spawnEnemy(state, next.defId, next.angle)
    if (!enemy) break // Obergrenze erreicht

    // **Jeder** normale Gegner kann beim Erscheinen zum Elite werden (GDD 07 Abschnitt 6).
    // Deshalb steht das hier und nicht in der Wellenerzeugung: Der Plan sagt, *was*
    // erscheint, der Wurf entscheidet erst beim Erscheinen, *wie stark*.
    maybeMakeElite(state, enemy, plan.wave)
    combat.spawnIndex += 1
  }

  if (isWaveCleared(state)) {
    combat.phase = 'pause'
    combat.timer = WAVE_PAUSE_SECONDS
    combat.lostAttempts = 0
    markDirty(state)
    emit('wave.cleared', { wave: state.run.wave })
  }
}
