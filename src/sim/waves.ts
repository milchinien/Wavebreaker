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
import { grantReward } from '../app/rewards.ts'
import {
  leagueWaveOf,
  markDirty,
  raiseWaveRecord,
  rememberLeagueWave,
  waveRecord,
  type GameState,
} from '../app/state.ts'
import {
  BOSS_WAVE_INTERVAL,
  effectiveWave,
  LEAGUE_ADVANCE_WAVE,
  MAX_SPEED_SCALE,
  rewardScaleFor,
  WAVE_BASE_COUNT,
  WAVE_COUNT_GROWTH,
  WAVE_DAMAGE_SCALING,
  WAVE_PAUSE_SECONDS,
  WAVE_SCALING,
  WAVE_SPAWN_WINDOW_SECONDS,
  WAVE_SPEED_SCALING,
} from '../data/balance.ts'
import { enemiesForWave, type EnemyDef } from '../data/enemies.ts'
import { MAX_LEAGUE } from '../data/leagues.ts'
import { collapseStation } from './combat.ts'
import { maybeMakeElite, releaseEnemy, spawnBoss, spawnEnemy } from './enemies.ts'
import { resetOverdrive } from './overdrive.ts'
import { releaseProjectile } from './projectiles.ts'
import { globalValue, maxStationHp } from './stats.ts'

export type WaveSpawn = {
  defId: string
  /** Zeitpunkt innerhalb der Welle, in Sekunden. */
  at: number
  /** Richtung auf dem Ring rund um die Station, im Bogenmass. */
  angle: number
}

export type WavePlan = {
  /** Die **angezeigte** Welle - die Zahl, die im HUD steht. */
  wave: number
  /** Die Liga, in der diese Welle laeuft. */
  league: number
  /**
   * Die Welle, mit der gerechnet wurde (`wave + Ligaversatz`).
   *
   * Steht im Plan, statt bei Bedarf neu gerechnet zu werden: Jeder, der eine Welle
   * bewertet - Elitewurf, Ereignisbetrag, Bestwert -, braucht dieselbe Zahl, und zwei
   * Rechenwege fuer denselben Wert sind ein Wert zu viel.
   */
  effectiveWave: number
  spawns: WaveSpawn[]
  /** Faktoren, mit denen die Grundwerte der Gegnerarten multipliziert werden. */
  hpScale: number
  damageScale: number
  speedScale: number
  /** Enthaelt bereits den Ligafaktor - Gold und XP brauchen keinen zweiten Multiplikator. */
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
 *
 * Gerechnet wird mit der **effektiven** Welle (`data/balance.ts`), angezeigt die kleine.
 * Liga 3 Welle 1 ergibt deshalb dieselben Skalen und dieselbe Gegnerauswahl wie Liga 1
 * Welle 51 - bis auf zwei gewollte Ausnahmen:
 *
 *   - `enemyCount` folgt der **angezeigten** Welle. Sonst begaenne Liga 3 mit 83 Gegnern
 *     statt mit 8, und die Welle 1 einer neuen Liga waere kein Anfang.
 *   - `rewardScale` traegt zusaetzlich den Ligafaktor - er ist der einzige Grund
 *     aufzusteigen (docs/liga-system.md Abschnitt 2.1).
 */
export function buildWave(wave: number, league: number, rng: Rng): WavePlan {
  const effective = effectiveWave(wave, league)
  const available = enemiesForWave(effective)
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
    league,
    effectiveWave: effective,
    spawns,
    hpScale: scaleFor(effective, WAVE_SCALING),
    damageScale: scaleFor(effective, WAVE_DAMAGE_SCALING),
    speedScale: Math.min(MAX_SPEED_SCALE, scaleFor(effective, WAVE_SPEED_SCALING)),
    rewardScale: rewardScaleFor(effective, league),
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
  const league = state.run.league
  const effective = effectiveWave(wave, league)

  state.run.wave = wave
  raiseWaveRecord(state, wave)
  // Der Bestwert zaehlt **effektiv**: Welle 50 in Liga 8 ist ungleich weiter als Welle 50
  // in Liga 1, und ein ligenblinder Bestwert waere keiner.
  if (effective > state.permanent.bestWaveEver) state.permanent.bestWaveEver = effective
  checkLeagueUnlock(state)

  clearField(state)
  /*
   * Der Zufall wird aus der **effektiven** Welle abgeleitet, nicht aus der angezeigten.
   *
   * Aus der angezeigten haetten Liga 1 Welle 12 und Liga 7 Welle 12 dieselbe
   * Zusammensetzung und dieselben Anflugwinkel - bei gleichem Gegnervorrat (bis Welle 50
   * gibt es ohnehin nur drei Arten) waere ein Ligenwechsel derselbe Kampf mit groesseren
   * Zahlen.
   *
   * Aus der effektiven folgt beides richtig: Jede Liga wuerfelt eigene Wellen, und Liga 1
   * bleibt Zeichen fuer Zeichen die von heute (`effectiveWave(w, 1) === w`) - ein
   * bestehender Spielstand findet seine Wellen unveraendert vor. Dass Liga 2 Welle 1
   * dieselbe Zusammensetzung hat wie Liga 1 Welle 26, ist kein Nebeneffekt, sondern genau
   * die Aussage des Systems: Es **ist** dieselbe Welle.
   */
  combat.plan = buildWave(wave, league, state.runtime.rng.fork(effective))
  combat.spawnIndex = 0
  combat.timer = 0
  combat.phase = 'running'
  combat.killsThisWave = 0
  combat.bossId = null
  healStationFull(state)
  // Jede Welle beginnt ohne laufenden Overdrive, und `Last Stand` darf wieder anschlagen.
  resetOverdrive(state)

  // Der Boss erscheint sofort, waehrend die normalen Gegner weiter nachstroemen.
  if (isBossWave(wave)) spawnBoss(state, wave, effective)

  markDirty(state)
  emit('wave.started', { wave })
}

// ---------------------------------------------------------------------------
// Ligensteuerung (docs/liga-system.md)
// ---------------------------------------------------------------------------

/*
 * Die Liga steht hier und nicht in einer eigenen Datei, weil sie **die zweite Achse
 * derselben Steuerung** ist: Welle vor und zurueck, Liga hoch und runter. Dieselben Regeln
 * gelten fuer beide - vorwaerts nur bis zum Erreichten, zurueck immer.
 *
 * Eine eigene `sim/leagues.ts` haette `startWave` gebraucht und `startWave` sie - ein Kreis
 * zwischen zwei Dateien fuer einen Begriff, der ohnehin hierher gehoert.
 */

/**
 * Darf der Spieler diese Liga betreten?
 *
 * Die Antwort ist eine **Datenabfrage** auf `permanent.leagueUnlocked` und keine
 * Verzweigung im Code (GDD 16 Abschnitt 2) - dieselbe Bauart wie `isUnlocked` im
 * Prestige-Baum.
 */
export function canEnterLeague(state: GameState, league: number): boolean {
  if (!Number.isInteger(league)) return false
  return league >= 1 && league <= Math.min(MAX_LEAGUE, state.permanent.leagueUnlocked)
}

/**
 * Auf welcher Welle diese Liga wieder beginnt.
 *
 * Nicht auf Welle 1, ausser man war nie dort: Ein Rueckweg, der einen bei Welle 1 absetzt,
 * waere eine Strafe fuer das Zurueckgehen - und genau das soll es nicht sein
 * (docs/liga-system.md Abschnitt 4.3).
 */
export function resumeWave(state: GameState, league: number): number {
  if (league === state.run.league) return state.run.wave
  return leagueWaveOf(state.run, league)
}

/**
 * Die Liga wechseln (docs/liga-system.md Abschnitt 4.1).
 *
 * **Kein Reset, sondern ein Ortswechsel.** Tuerme, Lager, Gold, Level, Upgrades und
 * Faehigkeiten bleiben unangetastet; nur die Welle beginnt neu. Deshalb steht hier auch
 * keine Kostenrechnung und keine Sperre: Der Wechsel ist folgenlos und darf sich auch so
 * anfuehlen.
 *
 * Selbstbegrenzend ist er trotzdem - wer zu hoch einsteigt, toetet nichts und bekommt
 * folglich nichts. Eine Regel, die das verboete, waere eine Regel zuviel.
 */
export function enterLeague(state: GameState, league: number): boolean {
  if (!canEnterLeague(state, league)) return false
  const from = state.run.league
  if (league === from) return false

  // Erst merken, wo man geht - danach kennt `run.wave` nur noch die neue Liga.
  rememberLeagueWave(state)
  state.run.league = league

  const wave = leagueWaveOf(state.run, league)
  startWave(state, wave)
  emit('league.changed', { from, to: league, wave })
  return true
}

/**
 * Die naechste Liga freischalten, sobald die Schwelle faellt.
 *
 * Zwei Bedingungen, und beide sind noetig:
 *
 *   - Der Rekord **dieser** Liga hat `LEAGUE_ADVANCE_WAVE` erreicht.
 *   - Gespielt wird gerade die **hoechste** freigeschaltete Liga. Sonst schaltete ein Run
 *     in Liga 2 die Liga 3 frei, obwohl der Spieler in Liga 5 laengst weiter ist - die
 *     Leiter waere keine Leiter mehr.
 *
 * Freigeschaltet wird **einmal und dauerhaft** (`permanent`). Ob der Spieler wechselt,
 * entscheidet er danach; diese Funktion oeffnet nur die Tuer.
 */
export function checkLeagueUnlock(state: GameState): boolean {
  const league = state.run.league
  if (league !== state.permanent.leagueUnlocked) return false
  if (league >= MAX_LEAGUE) return false
  if (waveRecord(state) < LEAGUE_ADVANCE_WAVE) return false

  state.permanent.leagueUnlocked = league + 1
  markDirty(state)
  emit('league.unlocked', { league: league + 1 })
  return true
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
 * Vorwaerts nur bis zur hoechsten **in dieser Liga und in diesem Run** erreichten Welle -
 * kein Sprung in unerreichten Inhalt. Zurueck ist immer erlaubt: Es ist eine
 * Sicherheitsoption, keine Abkuerzung, denn die Belohnungen haengen an der gespielten
 * Welle, nicht am Rekord.
 *
 * Je Liga, weil ein gemeinsamer Rekord den Sprung in einer neuen Liga sofort bis Welle 50
 * erlaubte - also genau in den unerreichten Inhalt, den diese Regel fernhaelt.
 */
export function canSkipTo(state: GameState, wave: number): boolean {
  return wave >= 1 && wave <= waveRecord(state)
}

export function nextWave(state: GameState): boolean {
  const target = state.run.wave + 1
  // Eine Welle weiter als der Rekord ist genau der naechste, noch ungespielte Schritt -
  // er ist erlaubt, sonst kaeme der Run nie voran.
  if (target > waveRecord(state) + 1) return false
  startWave(state, target)
  return true
}

export function previousWave(state: GameState): boolean {
  const target = state.run.wave - 1
  if (!canSkipTo(state, target)) return false
  startWave(state, target)
  return true
}

/**
 * Auf eine beliebige Welle springen, statt sich Schritt fuer Schritt hinzuklicken.
 *
 * Die Erlaubnis ist **dieselbe** wie beim Schritt zurueck (`canSkipTo`) und nicht etwa eine
 * grosszuegigere: Ein Sprung geht auf jede Welle, die dieser Run schon erreicht hat, und auf
 * keine dahinter. Wer bei Rekord 40 steht, waehlt jede Zahl bis 40; die 41 gibt es nur,
 * indem er die 40 spielt. Damit ist der Sprung genau das, was der Rueckweg auch ist - eine
 * **Abkuerzung durch Bekanntes**, keine Abkuerzung in unbekannten Inhalt.
 *
 * Der Sonderfall "dieselbe Welle" wird abgewiesen und nicht durchgereicht. `startWave` heilt
 * die Station voll, und ein Sprung auf die Zahl, die ohnehin dasteht, waere sonst eine
 * Vollheilung mitten in der laufenden Welle - dafuer gibt es den Weg ueber die Nachbarwelle
 * schon lange, aber er kostet wenigstens die Welle.
 */
export function skipToWave(state: GameState, wave: number): boolean {
  if (!Number.isFinite(wave)) return false
  const target = Math.floor(wave)
  if (target === state.run.wave) return false
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
    maybeMakeElite(state, enemy, plan.effectiveWave)
    combat.spawnIndex += 1
  }

  if (isWaveCleared(state)) {
    combat.phase = 'pause'
    combat.timer = WAVE_PAUSE_SECONDS
    combat.lostAttempts = 0

    /*
     * `Toll of War`: Eine geschaffte Welle zahlt aus (`data/upgrades.ts`).
     *
     * Direkt gutgeschrieben statt als Muenze ins Feld gelegt: Es ist kein Gegner gefallen,
     * an dessen Stelle sie liegen koennte, und eine Muenze in der Mitte des leeren Feldes
     * waere eine Behauptung ueber ein Ereignis, das es nicht gab.
     */
    const toll = globalValue(state, 'goldPerWave')
    if (toll > 0) grantReward(state, { gold: toll }, 'wave.cleared')

    markDirty(state)
    emit('wave.cleared', { wave: state.run.wave })
  }
}
