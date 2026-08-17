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
import { catalogSuite } from './suites/catalog.ts'
import { coinflightSuite } from './suites/coinflight.ts'
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
import { hintsSuite } from './suites/hints.ts'
import { leaguesSuite } from './suites/leagues.ts'
import { loopSuite } from './suites/loop.ts'
import { klangSuite } from './suites/klang.ts'
import { mixerSuite } from './suites/mixer.ts'
import { overdriveSuite } from './suites/overdrive.ts'
import { musikSuite } from './suites/musik.ts'
import { prestigeSuite } from './suites/prestige.ts'
import { progressionSuite } from './suites/progression.ts'
import { rewardsSuite } from './suites/rewards.ts'
import { shopSuite } from './suites/shop.ts'
import { rngSuite } from './suites/rng.ts'
import { saveSuite } from './suites/save.ts'
import { stationSuite } from './suites/station.ts'
import { stringsSuite } from './suites/strings.ts'
import { upgradesSuite } from './suites/upgrades.ts'

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
  // Die Ligen liegen quer zu allem, was danach kommt - Wellen, Wirtschaft, Spielstand.
  // Deshalb stehen sie vor dem Kampf und nicht am Ende: Faellt der Versatz, faellt der Rest
  // aus Gruenden, die man dann erst suchen muesste.
  leaguesSuite()
  combatSuite()
  // Die Flugbahn der Muenzen ist reine Rechnung und braucht kein DOM - sie steht deshalb
  // hier und nicht in `interaction.ts`, das nur im Browser laeuft.
  coinflightSuite()
  economySuite()
  progressionSuite()
  abilitiesSuite()
  shopSuite()
  prestigeSuite()
  contentSuite()
  encountersSuite()
  idleSuite()
  hintsSuite()
  cameraSuite()
  upgradesSuite()
  // Der neue Katalog (`docs/upgrade-umbau.md`). Er wird noch von niemandem gelesen - geprueft
  // wird er trotzdem, denn eine Handliste mit 60 Eintraegen hat andere Fehler als eine
  // Schleife, und keiner davon faellt beim Spielen auf.
  catalogSuite()
  overdriveSuite()
  // Der Klangapparat braucht einen Browser; was hier laeuft, ist alles davor: der Plan
  // (welches Ereignis klingt, welches begruendet nicht), die Wiederholsperren, die Rechnung
  // hinter der Bremse und die Ablage der drei Pegel.
  klangSuite()
  mixerSuite()
  // Die Musik ist gerechnet und damit fast vollstaendig ohne Ohr pruefbar: Naht, Spitze,
  // Spektrum und Lagenwechsel sind Zahlen im selben `Float32Array`, das im Spiel klingt.
  musikSuite()
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
