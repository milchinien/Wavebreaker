/**
 * Sammelstelle aller Zusicherungen. Aufruf im Spiel ueber `?selftest`, headless ueber
 * `npm run selftest`.
 *
 * Diese Datei bleibt frei von DOM und Dateisystem, damit beide Wege durch denselben Code
 * laufen. Die Regelpruefungen aus Abschnitt 9 des Plans brauchen das Dateisystem und
 * stehen deshalb in `guards.ts`, das nur der headless-Lauf einbindet.
 */

import { takeResults, type TestResult } from '../core/assert.ts'
import { abilitiesSuite } from './suites/abilities.ts'
import { buffsSuite } from './suites/buffs.ts'
import { cameraSuite } from './suites/camera.ts'
import { combatSuite } from './suites/combat.ts'
import { contentSuite } from './suites/content.ts'
import { economySuite } from './suites/economy.ts'
import { encountersSuite } from './suites/encounters.ts'
import { wavesSuite } from './suites/waves.ts'
import { idleSuite } from './suites/idle.ts'
import { interactionSuite } from './suites/interaction.ts'
import { eventsSuite } from './suites/events.ts'
import { formatSuite } from './suites/format.ts'
import { geometrySuite } from './suites/geometry.ts'
import { loopSuite } from './suites/loop.ts'
import { prestigeSuite } from './suites/prestige.ts'
import { progressionSuite } from './suites/progression.ts'
import { rewardsSuite } from './suites/rewards.ts'
import { shopSuite } from './suites/shop.ts'
import { rngSuite } from './suites/rng.ts'
import { saveSuite } from './suites/save.ts'
import { stationSuite } from './suites/station.ts'
import { stringsSuite } from './suites/strings.ts'

export type TestSummary = {
  results: TestResult[]
  total: number
  passed: number
  failed: number
  ok: boolean
}

export function runSelfTests(): TestResult[] {
  takeResults() // Reste eines frueheren Laufs verwerfen

  loopSuite()
  rngSuite()
  formatSuite()
  eventsSuite()
  geometrySuite()
  stringsSuite()
  rewardsSuite()
  saveSuite()
  stationSuite()
  buffsSuite()
  wavesSuite()
  combatSuite()
  economySuite()
  progressionSuite()
  abilitiesSuite()
  shopSuite()
  prestigeSuite()
  contentSuite()
  encountersSuite()
  idleSuite()
  cameraSuite()
  // Braucht ein DOM und laeuft deshalb nur im Browser. Der headless-Lauf hat dafuer die
  // Regelpruefungen aus guards.ts - beide Wege pruefen zusammen alles.
  interactionSuite()

  return takeResults()
}

export function summarize(results: TestResult[]): TestSummary {
  const failed = results.filter((result) => !result.ok).length
  return {
    results,
    total: results.length,
    passed: results.length - failed,
    failed,
    ok: failed === 0,
  }
}
