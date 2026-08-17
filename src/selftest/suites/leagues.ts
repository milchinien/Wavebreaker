/**
 * Das Ligensystem (docs/liga-system.md), Etappen E1 bis E3.
 *
 * Der Kern des Systems ist eine einzige Behauptung, und sie ist die erste Pruefung hier:
 * **Liga L Welle w ist dieselbe Welt wie Liga 1 Welle `w + 25(L-1)`** - bis auf die
 * Gegnerzahl und die Belohnung, und beide Ausnahmen sind gewollt. Faellt diese Pruefung,
 * ist aus der einen Schwierigkeitskurve wieder eine je Liga geworden, und das Justieren
 * von `WAVE_SCALING` traefe nur noch einen Teil des Spiels.
 */

import { assert, assertClose, assertDeepEqual, assertEqual, check, suite } from '../../core/assert.ts'
import { deserialize, migrationChainComplete, serialize, SAVE_VERSION } from '../../app/save.ts'
import {
  createInitialPermanent,
  createInitialRun,
  createInitialState,
  raiseWaveRecord,
  waveRecord,
  waveRecordOf,
} from '../../app/state.ts'
import { createRng } from '../../core/rng.ts'
import {
  effectiveWave,
  ELITE_FROM_WAVE,
  LEAGUE_ADVANCE_WAVE,
  LEAGUE_REWARD_BONUS,
  LEAGUE_WAVE_OFFSET,
  leagueRewardFactor,
  PRESTIGE_MIN_GOLD,
  rewardScaleFor,
} from '../../data/balance.ts'
import { bossForWave, enemiesForWave } from '../../data/enemies.ts'
import { clampLeague, isKnownLeague, leagueByIndex, LEAGUES, MAX_LEAGUE } from '../../data/leagues.ts'
import { hasString } from '../../data/strings.ts'
import { LEAGUE_TINT, PALETTE } from '../../render/theme.ts'
import { eliteChance } from '../../sim/enemies.ts'
import { doPrestige, prestigePoints } from '../../sim/prestige.ts'
import {
  buildWave,
  canEnterLeague,
  canSkipTo,
  enemyCount,
  enterLeague,
  startWave,
} from '../../sim/waves.ts'

export function leaguesSuite(): void {
  // -------------------------------------------------------------------------
  suite('data/ligen · Katalog (E1)')

  check('eine Liga ist ein Wellenvorsprung', () => {
    assertEqual(effectiveWave(1, 1), 1, 'Liga 1 verschiebt nichts')
    assertEqual(effectiveWave(12, 1), 12)
    assertEqual(effectiveWave(1, 3), 1 + 2 * LEAGUE_WAVE_OFFSET)
    assertEqual(effectiveWave(50, 4), 50 + 3 * LEAGUE_WAVE_OFFSET)
  })

  check('der Belohnungsfaktor waechst geometrisch und beginnt bei eins', () => {
    assertEqual(leagueRewardFactor(1), 1, 'Liga 1 bekommt keinen Zuschlag')
    assertClose(leagueRewardFactor(3), LEAGUE_REWARD_BONUS ** 2)
    assertClose(leagueRewardFactor(10), LEAGUE_REWARD_BONUS ** 9)
  })

  check('zehn Ligen, lueckenlos durchnummeriert', () => {
    assertEqual(LEAGUES.length, MAX_LEAGUE)
    LEAGUES.forEach((league, i) => assertEqual(league.index, i + 1, `Liga an Stelle ${i}`))
    assertEqual(new Set(LEAGUES.map((league) => league.id)).size, LEAGUES.length, 'Kennungen')
  })

  check('jede Liga hat einen Namen, und der laeuft durch t()', () => {
    for (const league of LEAGUES) {
      assert(hasString(league.id), `Liga ${league.index} hat keinen Text unter ${league.id}`)
    }
  })

  check('jeder Ligafarbton loest auf, und keiner ist die Farbe des Lebensbalkens', () => {
    for (const league of LEAGUES) {
      const colour = LEAGUE_TINT[league.tint]
      assert(typeof colour === 'string' && colour.length > 0, `Liga ${league.index} ohne Farbe`)
      // Der Grund darf nie den Ton tragen, an dem der Spieler Lebensbalken erkennt -
      // sonst waere der Abstand dahin, den `LIFE` in `render/theme.ts` erkauft.
      assert(colour !== PALETTE.life, `Liga ${league.index} traegt die Lebensfarbe`)
    }
  })

  check('die Intensitaet des Grundes steigt streng monoton', () => {
    // Waere sie das nicht, gaebe es eine Liga, die sich schwaecher anfuehlt als die
    // darunter - und der Aufstieg verloere sein Bild.
    for (let i = 1; i < LEAGUES.length; i++) {
      const previous = LEAGUES[i - 1]!
      const current = LEAGUES[i]!
      assert(current.glow > previous.glow, `Schein faellt bei Liga ${current.index}`)
      assert(current.grid >= previous.grid, `Raster faellt bei Liga ${current.index}`)
      assert(current.bands >= previous.bands, `Bahnen fallen bei Liga ${current.index}`)
    }
  })

  check('ein Ligaindex aus fremder Hand wird gezogen, nicht geglaubt', () => {
    assertEqual(clampLeague(0), 1)
    assertEqual(clampLeague(-4), 1)
    assertEqual(clampLeague(999), MAX_LEAGUE)
    assertEqual(clampLeague(Number.NaN), 1)
    assertEqual(clampLeague(3.7), 3)
    assertEqual(isKnownLeague(MAX_LEAGUE + 1), false)
    assertEqual(leagueByIndex(2).index, 2)
  })

  // -------------------------------------------------------------------------
  suite('app/state · Wellenrekord je Liga (E2)')

  check('ein frischer Run steht in Liga 1 auf Welle 1', () => {
    const run = createInitialRun(1)
    assertEqual(run.league, 1)
    assertDeepEqual(run.waveRecords, [1])
    assertEqual(createInitialPermanent().leagueUnlocked, 1)
  })

  check('der Rekord steigt und faellt nie', () => {
    const state = createInitialState(1)
    raiseWaveRecord(state, 12)
    assertEqual(waveRecord(state), 12)
    raiseWaveRecord(state, 4)
    assertEqual(waveRecord(state), 12, 'ein kleinerer Wert senkt ihn nicht')
  })

  check('jede Liga fuehrt ihren eigenen Rekord', () => {
    const state = createInitialState(1)
    raiseWaveRecord(state, 40)

    state.run.league = 3
    assertEqual(waveRecord(state), 1, 'eine unbetretene Liga beginnt bei Welle 1')
    raiseWaveRecord(state, 7)

    assertEqual(waveRecordOf(state.run, 1), 40, 'Liga 1 behaelt ihren Rekord')
    assertEqual(waveRecordOf(state.run, 3), 7)

    // Genau das macht die niedrige Liga zur Rueckfallebene: Wer zurueckwechselt, steht
    // sofort wieder in der Tiefe, die er dort erreicht hatte.
    state.run.league = 1
    assertEqual(waveRecord(state), 40)
  })

  check('ein Sprung ueber Ligen hinterlaesst kein Loch in der Liste', () => {
    // Ein Loch waere im Spielstand ein `null`, und `null` ginge beim Laden als Zahl durch.
    const state = createInitialState(1)
    state.run.league = 4
    raiseWaveRecord(state, 9)

    assertEqual(state.run.waveRecords.length, 4)
    for (const entry of state.run.waveRecords) {
      assertEqual(typeof entry, 'number', 'jeder Eintrag ist eine Zahl')
    }
    assert(!JSON.stringify(state.run.waveRecords).includes('null'), 'kein null im Spielstand')
  })

  // -------------------------------------------------------------------------
  suite('app/save · Migration auf die Ligen (E2)')

  check('die Migrationskette ist lueckenlos', () => {
    assertEqual(SAVE_VERSION, 10)
    assert(migrationChainComplete(), 'jede Stufe von 1 bis heute muss besetzt sein')
  })

  check('ein Spielstand der Fassung 9 landet in Liga 1 und behaelt seinen Rekord', () => {
    const state = createInitialState(3)
    const old = serialize(state, 0) as unknown as Record<string, unknown>
    const run = { ...(old['run'] as Record<string, unknown>) }
    // Der Stand von gestern: ein Rekord, keine Ligen.
    run['waveRecord'] = 37
    delete run['league']
    delete run['waveRecords']
    const permanent = { ...(old['permanent'] as Record<string, unknown>) }
    delete permanent['leagueUnlocked']

    const restored = deserialize({ ...old, version: 9, run, permanent })
    assert(restored !== null, 'die Migration muss greifen')
    assertEqual(restored.run.league, 1)
    assertDeepEqual(restored.run.waveRecords, [37], 'der Rekord wandert unveraendert mit')
    assertEqual(restored.permanent.leagueUnlocked, 1)
  })

  check('eine gespielte Liga ohne Freischaltung wird zurueckgezogen', () => {
    // Ein Spielstand aus fremder Hand kaeme sonst mit Liga 10 und der Erlaubnis fuer eine.
    const state = createInitialState(5)
    state.run.league = 6
    state.run.waveRecords = [12, 1, 1, 1, 1, 3]

    const restored = deserialize(serialize(state, 0))
    assert(restored !== null, 'der Spielstand muss lesbar sein')
    assertEqual(restored.run.league, 1, 'gespielt wird hoechstens, was freigeschaltet ist')
  })

  check('Liga und Rekorde ueberstehen Speichern und Laden', () => {
    const state = createInitialState(9)
    state.permanent.leagueUnlocked = 4
    state.run.league = 3
    state.run.waveRecords = [52, 44, 18]

    const restored = deserialize(serialize(state, 0))
    assert(restored !== null, 'der Spielstand muss lesbar sein')
    assertEqual(restored.permanent.leagueUnlocked, 4)
    assertEqual(restored.run.league, 3)
    assertDeepEqual(restored.run.waveRecords, [52, 44, 18])
  })

  // -------------------------------------------------------------------------
  suite('sim/waves · die Welt rechnet mit der Liga (E3)')

  check('Liga 3 Welle 1 ist dieselbe Welt wie Liga 1 Welle 51', () => {
    const high = buildWave(1, 3, createRng(1))
    const low = buildWave(1 + 2 * LEAGUE_WAVE_OFFSET, 1, createRng(1))

    assertEqual(high.effectiveWave, low.effectiveWave, 'dieselbe effektive Welle')
    assertClose(high.hpScale, low.hpScale, 1e-6, 'dieselbe Lebensenergie')
    assertClose(high.damageScale, low.damageScale, 1e-6, 'derselbe Schaden')
    assertClose(high.speedScale, low.speedScale, 1e-6, 'dasselbe Tempo')

    /*
     * Verglichen wird der **Vorrat**, nicht die Ziehung.
     *
     * Die gezogenen Arten koennen gar nicht uebereinstimmen: Die hohe Liga zieht achtmal,
     * die niedrige dreiundachtzigmal, und wer achtmal zieht, sieht seltene Arten nicht.
     * Gleich ist, woraus gezogen wird - und genau das ist die Behauptung.
     */
    const pool = new Set(enemiesForWave(high.effectiveWave).map((def) => def.id))
    for (const spawn of high.spawns) {
      assert(pool.has(spawn.defId), `${spawn.defId} steht nicht im Vorrat dieser Welle`)
    }
    for (const spawn of low.spawns) {
      assert(pool.has(spawn.defId), `${spawn.defId} steht nicht im Vorrat dieser Welle`)
    }
  })

  check('zwei Dinge weichen ab, und beide mit Absicht', () => {
    const high = buildWave(1, 3, createRng(1))
    const low = buildWave(1 + 2 * LEAGUE_WAVE_OFFSET, 1, createRng(1))

    // Die Gegnerzahl folgt der **angezeigten** Welle: Welle 1 einer neuen Liga soll ein
    // Anfang sein und keine Wand aus 83 Gegnern.
    assertEqual(high.spawns.length, enemyCount(1))
    assertEqual(low.spawns.length, enemyCount(1 + 2 * LEAGUE_WAVE_OFFSET))
    assert(high.spawns.length < low.spawns.length, 'die hohe Liga beginnt kleiner')

    // Die Belohnung traegt zusaetzlich den Ligafaktor - der einzige Grund aufzusteigen.
    assertClose(high.rewardScale, low.rewardScale * leagueRewardFactor(3), 1e-6)
  })

  check('der Ligafaktor steckt im Wellenplan und nicht daneben', () => {
    // Gold und XP je Gegner lesen ausschliesslich `rewardScale` (`sim/enemies.ts`). Steht
    // der Faktor dort, braucht keine zweite Stelle ihn - und keine kann ihn vergessen.
    assertEqual(buildWave(5, 1, createRng(2)).rewardScale > 0, true)
    const one = buildWave(5, 1, createRng(2)).rewardScale
    const two = buildWave(5, 2, createRng(2)).rewardScale
    assertClose(two / one, LEAGUE_REWARD_BONUS * 1.1 ** 0 * 1.06 ** LEAGUE_WAVE_OFFSET, 1e-6)
  })

  check('eine hohe Liga bringt ihre Gegner und ihren Boss mit', () => {
    // Der gebaute, aber unerreichbare Inhalt wird ueber den Versatz erreichbar - ohne eine
    // einzige neue Gegnerart (docs/liga-system.md Abschnitt 1.3).
    const early = enemiesForWave(effectiveWave(1, 1)).map((def) => def.id)
    const late = enemiesForWave(effectiveWave(1, 5)).map((def) => def.id)
    assert(late.length > early.length, 'Liga 5 kennt mehr Gegnerarten als Liga 1')

    assert(
      bossForWave(effectiveWave(10, 5)).id !== bossForWave(effectiveWave(10, 1)).id,
      'Welle 10 in Liga 5 faengt nicht wieder beim ersten Boss an',
    )
  })

  check('Elitegegner ruecken mit der Liga nach vorn', () => {
    // Nicht als Sonderfall, sondern weil `eliteChance` die effektive Welle liest.
    assertEqual(eliteChance(effectiveWave(1, 1)), 0, 'Liga 1 Welle 1 hat keine Elites')
    assertEqual(eliteChance(effectiveWave(ELITE_FROM_WAVE, 1)), 0, 'genau an der Schwelle noch nicht')
    assert(eliteChance(effectiveWave(1, 4)) > 0, 'Liga 4 hat sie ab Welle 1')
    assert(
      eliteChance(effectiveWave(1, 6)) > eliteChance(effectiveWave(1, 4)),
      'und weiter oben haeufiger',
    )
  })

  check('startWave fuehrt Rekord und Bestwert richtig', () => {
    const state = createInitialState(1)
    state.run.league = 2
    startWave(state, 8)

    assertEqual(waveRecord(state), 8, 'der Rekord zaehlt die angezeigte Welle')
    assertEqual(
      state.permanent.bestWaveEver,
      effectiveWave(8, 2),
      'der Bestwert zaehlt effektiv - sonst waere er ligenblind',
    )
  })

  check('die Aufstiegsschwelle liegt vor dem Ende der Wellenleiter', () => {
    // Eine Schwelle oberhalb dessen, was eine Liga hergibt, waere eine Sackgasse.
    assert(LEAGUE_ADVANCE_WAVE > LEAGUE_WAVE_OFFSET, 'sonst gaebe es keinen echten Zuwachs')
  })

  // -------------------------------------------------------------------------
  suite('sim/waves · wechseln und aufsteigen (E4)')

  check('nur freigeschaltete Ligen sind betretbar', () => {
    const state = createInitialState(1)
    assertEqual(canEnterLeague(state, 1), true)
    assertEqual(canEnterLeague(state, 2), false, 'ohne Freischaltung geht es nicht hoch')
    assertEqual(canEnterLeague(state, 0), false)
    assertEqual(canEnterLeague(state, 1.5), false, 'keine halben Ligen')

    state.permanent.leagueUnlocked = 3
    assertEqual(canEnterLeague(state, 3), true)
    assertEqual(canEnterLeague(state, 4), false)
    assertEqual(canEnterLeague(state, MAX_LEAGUE + 1), false)
  })

  check('die Schwelle schaltet die naechste Liga frei - einmal und dauerhaft', () => {
    const state = createInitialState(1)
    startWave(state, LEAGUE_ADVANCE_WAVE - 1)
    assertEqual(state.permanent.leagueUnlocked, 1, 'eine Welle davor noch nicht')

    startWave(state, LEAGUE_ADVANCE_WAVE)
    assertEqual(state.permanent.leagueUnlocked, 2, 'an der Schwelle faellt sie')

    // Ein Rueckschritt nimmt sie nicht wieder weg.
    startWave(state, 3)
    assertEqual(state.permanent.leagueUnlocked, 2)
  })

  check('nur die hoechste Liga schaltet weiter frei', () => {
    // Sonst schaltete ein Abstecher nach Liga 1 die Liga 2 frei, waehrend der Spieler in
    // Liga 4 laengst weiter ist - die Leiter waere keine Leiter mehr.
    const state = createInitialState(1)
    state.permanent.leagueUnlocked = 4
    state.run.league = 1
    startWave(state, LEAGUE_ADVANCE_WAVE)
    assertEqual(state.permanent.leagueUnlocked, 4, 'die Erlaubnis bleibt, wo sie war')
  })

  check('ueber die letzte Liga hinaus schaltet nichts mehr frei', () => {
    const state = createInitialState(1)
    state.permanent.leagueUnlocked = MAX_LEAGUE
    state.run.league = MAX_LEAGUE
    startWave(state, LEAGUE_ADVANCE_WAVE)
    assertEqual(state.permanent.leagueUnlocked, MAX_LEAGUE)
  })

  check('der Wechsel nimmt alles mit und setzt nur die Welle', () => {
    const state = createInitialState(1)
    state.permanent.leagueUnlocked = 2
    state.run.gold = 4321
    state.run.goldEarned = 9876
    state.run.xp = 500
    state.run.towersBought = 7
    const inventory = state.run.station.inventory.length

    assertEqual(enterLeague(state, 2), true)
    assertEqual(state.run.league, 2)
    assertEqual(state.run.wave, 1, 'die neue Liga beginnt bei Welle 1')
    assertEqual(state.run.gold, 4321, 'Gold bleibt')
    assertEqual(state.run.goldEarned, 9876, 'auch das verdiente Gold')
    assertEqual(state.run.xp, 500, 'Erfahrung bleibt')
    assertEqual(state.run.towersBought, 7, 'die Preiskurve bleibt')
    assertEqual(state.run.station.inventory.length, inventory, 'das Lager bleibt')
  })

  check('der Rueckweg kommt dort an, wo man war', () => {
    const state = createInitialState(1)
    state.permanent.leagueUnlocked = 2

    // In Liga 1 tief gewesen, dann zum Sammeln zurueck auf Welle 12.
    startWave(state, 30)
    startWave(state, 12)
    assertEqual(waveRecord(state), 30)

    enterLeague(state, 2)
    startWave(state, 4)

    assertEqual(enterLeague(state, 1), true)
    assertEqual(state.run.wave, 12, 'nicht Welle 1 und nicht der Rekord, sondern Welle 12')
    assertEqual(waveRecord(state), 30, 'der Rekord von Liga 1 steht weiter')

    assertEqual(enterLeague(state, 2), true)
    assertEqual(state.run.wave, 4, 'und Liga 2 ebenso, wo man sie verlassen hat')
  })

  check('ein Wechsel auf dieselbe oder eine gesperrte Liga tut nichts', () => {
    const state = createInitialState(1)
    startWave(state, 6)

    assertEqual(enterLeague(state, 1), false, 'dieselbe Liga ist kein Wechsel')
    assertEqual(enterLeague(state, 2), false, 'gesperrt bleibt gesperrt')
    assertEqual(state.run.wave, 6, 'und die laufende Welle wird dabei nicht angefasst')
  })

  check('die Skip-Grenze gilt je Liga', () => {
    const state = createInitialState(1)
    state.permanent.leagueUnlocked = 2
    startWave(state, 30)

    enterLeague(state, 2)
    assertEqual(canSkipTo(state, 20), false, 'der Rekord aus Liga 1 gilt hier nicht')
    assertEqual(canSkipTo(state, 1), true)
  })

  // -------------------------------------------------------------------------
  suite('sim/prestige · Punkte je Liga (E5)')

  check('dieselbe Welle bringt in einer hoeheren Liga mehr Punkte', () => {
    const state = createInitialState(1)
    state.run.goldEarned = 0
    const at = (league: number): number => {
      state.run.league = league
      state.run.waveRecords = Array.from({ length: league }, () => LEAGUE_ADVANCE_WAVE)
      return prestigePoints(state)
    }
    assert(at(5) > at(1), `Liga 5 (${at(5)}) muss ueber Liga 1 (${at(1)}) liegen`)
    assert(at(10) > at(5), `Liga 10 (${at(10)}) muss ueber Liga 5 (${at(5)}) liegen`)
  })

  check('der Goldanteil ist ligenneutral', () => {
    /*
     * Zwei Runs, die **dasselbe geleistet** haben: gleiche effektive Welle, und in beiden
     * genau so viel Gold, wie diese Welle dort hergibt. Sie muessen denselben Goldanteil
     * ergeben - sonst zaehlte die Liga zweimal, einmal im Wellenterm und einmal hier.
     */
    const goldOf = (league: number, wave: number): number => {
      const state = createInitialState(1)
      state.run.league = league
      state.run.waveRecords = Array.from({ length: league }, () => wave)
      const effective = effectiveWave(wave, league)
      state.run.goldEarned = 1000 * rewardScaleFor(effective, league)
      // Nur der Goldanteil: der Wellenterm ist in beiden Faellen derselbe und faellt weg.
      return prestigePoints(state) - Math.pow(effective / 45, 2)
    }
    assertClose(goldOf(1, 51), goldOf(3, 1), 1.0, 'gleiche Leistung, gleicher Goldanteil')
  })

  check('das Prestige behaelt die Erlaubnis und raeumt den Ort', () => {
    const state = createInitialState(1)
    state.permanent.leagueUnlocked = 4
    state.run.league = 3
    startWave(state, 20)
    state.run.goldEarned = PRESTIGE_MIN_GOLD

    assertEqual(doPrestige(state), true)
    assertEqual(state.permanent.leagueUnlocked, 4, 'die Ligen bleiben freigeschaltet')
    assertEqual(state.run.league, 1, 'gespielt wird wieder in Liga 1')
    assertDeepEqual(state.run.waveRecords, [1], 'die Rekorde beginnen neu')
    assertDeepEqual(state.run.leagueWaves, [1])
  })
}
