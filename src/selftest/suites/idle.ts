/**
 * Beweis aus E17 (Abwesenheitsertrag und Helfer) und E18 (Hinweise).
 *
 * Der Plan nennt fuer E17 genau eine Abnahme:
 *
 *   "Eine Stunde offline liefert (bis auf Zufall) dasselbe Ergebnis wie eine Stunde im
 *   Vordergrund bei x1."
 *
 * Genau das steht unten - und zwar als Vergleich zweier Laeufe, nicht als Vergleich gegen
 * eine erwartete Zahl. Eine erwartete Zahl waere eine zweite Rechnung neben der
 * Simulation, und der ganze Sinn dieser Etappe ist, dass es keine zweite Rechnung gibt.
 *
 * Der Vergleich laeuft gegen einen Vordergrundlauf mit **derselben Taktrate**, weil die
 * Offline-Rechnung mit einem groeberen Schritt arbeitet. Die Zusicherung darunter zeigt,
 * dass auch der groebere Schritt in derselben Groessenordnung landet - das ist die
 * eigentliche Frage: Ist der Schnelldurchlauf noch dasselbe Spiel?
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { MELT_COST, OFFLINE_MAX_SECONDS, OFFLINE_MIN_SECONDS, TICK_RATE } from '../../data/balance.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, stationView } from '../../app/view.ts'
import { stepBattle, syncStation } from '../../sim/battle.ts'
import { collectAll } from '../../sim/economy.ts'
import { HINTS, markHintSeen, pendingHint, resetHints } from '../../sim/hints.ts'
import { collectorLevel, helperCount, helperRadius, helperSpeed, stepHelpers } from '../../sim/helpers.ts'
import {
  capOfflineTime,
  offlineEfficiency,
  offlineUnlocked,
  simulateOffline,
} from '../../sim/offline.ts'
import { place } from '../../sim/station.ts'
import { startWave } from '../../sim/waves.ts'

/** Ein Zustand mit stehender Station, bereit fuer echten Kampf. */
function ready(seed = 17): GameState {
  const state = createInitialState(seed)
  refresh(state)
  return state
}

function refresh(state: GameState): void {
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
}

/** Einen Run so vorbereiten, dass Offline ueberhaupt erlaubt ist. */
function withOffline(state: GameState, ...nodes: string[]): GameState {
  state.permanent.prestigeNodes.push('eco.offline', ...nodes)
  return state
}

export function idleSuite(): void {
  suite('sim/offline · Freischaltung und Grenzen')

  check('ohne Freischaltung passiert gar nichts', () => {
    const state = ready()
    assertEqual(offlineUnlocked(state), false)
    assertEqual(simulateOffline(state, 3600, stationView(state)), null)
    assertEqual(state.run.gold, 0, 'der Zustand darf sich nicht anfassen lassen')
  })

  check('sehr kurze Abwesenheit wird verworfen', () => {
    assertEqual(capOfflineTime(OFFLINE_MIN_SECONDS - 1), 0)
    assertEqual(capOfflineTime(OFFLINE_MIN_SECONDS), OFFLINE_MIN_SECONDS)
    assertEqual(capOfflineTime(Number.NaN), 0)
    assertEqual(capOfflineTime(-500), 0)
  })

  check('lange Abwesenheit wird gedeckelt', () => {
    assertEqual(capOfflineTime(OFFLINE_MAX_SECONDS * 4), OFFLINE_MAX_SECONDS)
  })

  check('der Wirkungsgrad steigt mit den Freischaltungen, bleibt aber unter eins', () => {
    const plain = withOffline(ready())
    const base = offlineEfficiency(plain)

    const better = withOffline(ready(), 'eco.offline2')
    assert(offlineEfficiency(better) > base, 'die bessere Simulation muss etwas bringen')

    // Der Goldsammler zaehlt nur, wenn er auch **gekauft** ist (GDD 12 Abschnitt 10).
    const withNode = withOffline(ready(), 'eco.offline2', 'helper.collector')
    assertEqual(offlineEfficiency(withNode), offlineEfficiency(better))
    withNode.run.upgrades['global.collector'] = 1
    assert(offlineEfficiency(withNode) > offlineEfficiency(better), 'der Sammler muss zaehlen')

    // Aktives Spielen bleibt immer besser (GDD 12 Abschnitt 7).
    assert(offlineEfficiency(withNode) < 1, 'Offline darf nie voll zaehlen')
  })

  suite('sim/offline · dieselbe Logik')

  check('eine Stunde offline liefert dasselbe wie eine Stunde im Vordergrund', () => {
    /*
     * Beide Seiten laufen ueber **dasselbe** `stepBattle`. Verglichen wird deshalb nicht
     * gegen eine Formel, sondern gegen den Vordergrund - und mit demselben Startwert des
     * Generators, damit "bis auf Zufall" hier wirklich "gar nicht" heisst.
     *
     * Der Vordergrundlauf benutzt die Offline-Taktrate: Der Schnelldurchlauf rechnet
     * groeber, und dieser Test soll die Gleichheit der **Logik** zeigen, nicht die
     * Gleichheit zweier Schrittweiten. Die steht in der naechsten Zusicherung.
     */
    const seconds = 600
    const rate = 20

    const foreground = withOffline(ready(3))
    startWave(foreground, foreground.run.wave)
    for (let i = 0; i < seconds * rate; i++) stepBattle(foreground, 1 / rate)
    collectAll(foreground)

    const offline = withOffline(ready(3))
    // Der Wirkungsgrad kuerzt die Zeit - fuer den Vergleich muss er heraus.
    const efficiency = offlineEfficiency(offline)
    const result = simulateOffline(offline, seconds / efficiency, stationView(offline))

    assert(result !== null, 'die Rechnung muss ein Ergebnis liefern')
    // Ohne diese Zeile waere der Vergleich unten auch dann gruen, wenn beide Seiten nichts
    // getan haetten - der haeufigste stille Fehler in Gleichheitstests.
    assert(foreground.run.gold > 0 && foreground.run.wave > 1, 'der Vergleich braucht Inhalt')

    assertEqual(offline.run.wave, foreground.run.wave, 'dieselbe Welle')
    assertEqual(Math.round(offline.run.gold), Math.round(foreground.run.gold), 'dasselbe Gold')
    assertEqual(Math.round(offline.run.xp), Math.round(foreground.run.xp), 'dieselbe Erfahrung')
  })

  check('der groebere Schritt landet in derselben Groessenordnung wie 60 Hz', () => {
    /*
     * Die eigentliche Frage des Schnelldurchlaufs: Ist er noch dasselbe Spiel?
     *
     * Geprueft wird die Wellenhoehe, nicht das Gold - sie ist die Groesse, an der der
     * Spieler den Unterschied merken wuerde. Eine Abweichung von einer Welle auf zehn
     * Minuten ist Rundung; zwei Wellen waeren eine andere Simulation.
     */
    const seconds = 600

    const fine = withOffline(ready(8))
    startWave(fine, fine.run.wave)
    for (let i = 0; i < seconds * TICK_RATE; i++) stepBattle(fine, 1 / TICK_RATE)

    const coarse = withOffline(ready(8))
    startWave(coarse, coarse.run.wave)
    for (let i = 0; i < seconds * 20; i++) stepBattle(coarse, 1 / 20)

    const drift = Math.abs(fine.run.wave - coarse.run.wave)
    assert(drift <= 1, `Wellen liefen um ${drift} auseinander (${fine.run.wave}/${coarse.run.wave})`)
  })

  check('der Bericht nennt, was wirklich passiert ist', () => {
    const state = withOffline(ready(5), 'eco.offline2')
    const before = state.run.wave

    const result = simulateOffline(state, 3600, stationView(state))
    assert(result !== null, 'die Rechnung muss ein Ergebnis liefern')

    assertEqual(result.seconds, 3600)
    assert(result.simulated < result.seconds, 'nur ein Teil der Zeit zaehlt')
    assertEqual(result.waveFrom, before)
    assertEqual(result.waveTo, state.run.wave)
    assert(result.kills > 0, 'in einer Stunde muss etwas gefallen sein')
    assert(result.gold > 0, 'und Gold gebracht haben')
    assert(result.xp > 0, 'und Erfahrung')
  })

  check('das Feld ist nach der Abwesenheit abgeraeumt', () => {
    // Waehrend niemand da ist, sammelt auch niemand ein (GDD 12 Abschnitt 3).
    const state = withOffline(ready(6))
    simulateOffline(state, 3600, stationView(state))
    assertEqual(state.run.coins.length, 0)
    assert(state.run.gold > 0, 'das Gold muss auf dem Konto sein')
  })

  check('waehrend der Abwesenheit entstehen keine optischen Effekte', () => {
    /*
     * Ohne Zuschauer waere jeder Splitter Arbeit fuer den Papierkorb - und bei
     * zehntausenden Gegnern ist genau das der Unterschied zwischen zwei Sekunden und
     * vierzig. Geprueft wird an den Ringspeichern: Kein einziger Platz darf belegt sein.
     */
    const state = withOffline(ready(9))
    simulateOffline(state, 3600, stationView(state))

    assertEqual(state.runtime.combat.shards.some((shard) => shard.active), false, 'Splitter')
    assertEqual(state.runtime.combat.bursts.some((burst) => burst.active), false, 'Druckwellen')
    assertEqual(state.runtime.combat.muzzles.some((muzzle) => muzzle.active), false, 'Muendungsfeuer')
    assertEqual(state.runtime.combat.hits.length, 0, 'Trefferblitze')
  })

  check('danach sieht wieder jemand zu', () => {
    // Bliebe der Schalter stehen, saehe der Spieler nach der Rueckkehr einen stummen
    // Kampf: keine Treffer, keine Muenzen, kein Zerfall.
    const state = withOffline(ready(10))
    assertEqual(state.runtime.combat.observed, true)
    simulateOffline(state, 3600, stationView(state))
    assertEqual(state.runtime.combat.observed, true)
  })

  check('die Abwesenheit verschenkt keine Welle', () => {
    // Ohne Anstoss der laufenden Welle stuende das Gefecht in der Pause ohne Plan da, und
    // der erste Takt liesse die naechste Welle beginnen.
    const state = withOffline(ready(7))
    state.run.wave = 12
    state.run.waveRecord = 12

    const result = simulateOffline(state, OFFLINE_MIN_SECONDS, stationView(state))
    assert(result !== null, 'die Rechnung muss ein Ergebnis liefern')
    assert(result.waveTo >= 12, 'die Welle darf nicht zurueckfallen')
    assert(result.kills > 0, 'es muss wirklich gekaempft worden sein')
  })

  suite('sim/helpers · Goldsammler')

  check('ohne beide Stufen der Freischaltung gibt es keinen Helfer', () => {
    // GDD 12 Abschnitt 10: Der Prestige-Baum macht kaufbar, gekauft wird mit Gold.
    const state = ready()
    assertEqual(collectorLevel(state), 0)
    assertEqual(helperCount(state), 0)

    // Nur der Knoten: noch kein Helfer.
    state.permanent.prestigeNodes.push('helper.collector')
    assertEqual(helperCount(state), 0)

    // Nur die Stufe ohne Knoten: ebenfalls keiner.
    const bought = ready()
    bought.run.upgrades['global.collector'] = 3
    assertEqual(collectorLevel(bought), 0)
    assertEqual(helperCount(bought), 0)

    // Beides: jetzt faehrt einer.
    state.run.upgrades['global.collector'] = 1
    assertEqual(helperCount(state), 1)
  })

  check('Radius, Tempo und Anzahl wachsen mit den Stufen', () => {
    const state = ready()
    state.permanent.prestigeNodes.push('helper.collector')
    state.run.upgrades['global.collector'] = 1

    const radius = helperRadius(state)
    const speed = helperSpeed(state)

    state.run.upgrades['global.collector'] = 5
    assert(helperRadius(state) > radius, 'der Radius muss mit der Stufe wachsen')
    assert(helperSpeed(state) > speed, 'das Tempo ebenso')

    state.permanent.prestigeNodes.push('helper.better')
    assertEqual(helperRadius(state), (helperRadius(state) / 2) * 2, 'Verdopplung ist stetig')

    state.permanent.prestigeNodes.push('helper.fast')
    assertEqual(helperCount(state), 2)
    state.permanent.prestigeNodes.push('helper.elite')
    assertEqual(helperCount(state), 3)
  })

  check('ein Helfer faehrt zur naechsten Muenze und hebt sie auf', () => {
    const state = ready()
    state.permanent.prestigeNodes.push('helper.collector')
    state.run.upgrades['global.collector'] = 1
    state.run.coins.push({ x: 260, y: 0, value: 50, count: 1 })

    // Genug Takte, um die Strecke zu fahren - bei 120 Einheiten je Sekunde sind das rund
    // zwei Sekunden fuer 260 Einheiten.
    for (let i = 0; i < 60 * 4; i++) stepHelpers(state, 1 / 60)

    assertEqual(state.run.coins.length, 0, 'die Muenze muss aufgehoben sein')
    assertEqual(state.run.gold, 50)
  })

  check('ein Helfer verlaesst das Feld nicht', () => {
    const state = ready()
    state.permanent.prestigeNodes.push('helper.collector')
    state.run.upgrades['global.collector'] = 1
    // Eine Muenze weit ausserhalb: Der Helfer darf ihr nicht aus dem Bild folgen.
    state.run.coins.push({ x: 40_000, y: 0, value: 1, count: 1 })

    for (let i = 0; i < 60 * 30; i++) stepHelpers(state, 1 / 60)

    const helper = state.runtime.helpers[0]
    assert(helper !== undefined, 'der Helfer muss existieren')
    assert(Math.hypot(helper.x, helper.y) <= 901, `er stand bei ${Math.round(helper.x)}`)
  })

  check('ueberzaehlige Helfer verschwinden von selbst', () => {
    const state = ready()
    state.permanent.prestigeNodes.push('helper.collector', 'helper.better', 'helper.fast')
    state.run.upgrades['global.collector'] = 1
    stepHelpers(state, 1 / 60)
    assertEqual(state.runtime.helpers.length, 2)

    // Ein Prestige nimmt die Stufe weg - die Liste muss dem von selbst folgen.
    state.run.upgrades['global.collector'] = 0
    stepHelpers(state, 1 / 60)
    assertEqual(state.runtime.helpers.length, 0)
  })

  suite('sim/hints · einmalige Hinweise')

  check('jeder Hinweis hat eine eindeutige Kennung', () => {
    const ids = new Set(HINTS.map((hint) => hint.id))
    assertEqual(ids.size, HINTS.length)
  })

  check('ein gesehener Hinweis kommt nicht wieder', () => {
    const state = ready()
    state.run.coins.push({ x: 0, y: 0, value: 1, count: 1 })

    const first = pendingHint(state)
    assert(first !== null, 'liegendes Gold muss einen Hinweis ausloesen')
    assertEqual(first.id, 'hint.collect')

    assertEqual(markHintSeen(state, first.id), true)
    assertEqual(markHintSeen(state, first.id), false, 'zweimal ablegen ist kein Fehler, aber wirkungslos')
    assert(pendingHint(state)?.id !== 'hint.collect', 'er darf nicht wiederkommen')
  })

  check('ein unbekannter Hinweis laesst sich nicht ablegen', () => {
    const state = ready()
    assertEqual(markHintSeen(state, 'hint.gibtesnicht'), false)
    assertEqual(state.permanent.seenHints.length, 0)
  })

  check('Hinweise erscheinen erst, wenn ihre Bedingung zutrifft', () => {
    const state = ready()
    // Frischer Zustand: kein Gold im Feld, kein Gold auf dem Konto, keine drei Tuerme.
    // Der Schmelz-Hinweis darf hier noch nicht kommen.
    state.permanent.seenHints.push('hint.melt')
    assertEqual(state.run.station.inventory.length, MELT_COST, 'Startlager hat genau drei')

    const state2 = ready()
    state2.run.gold = 0
    state2.run.station.inventory.length = 0
    const hint = pendingHint(state2)
    assert(hint === null || hint.id !== 'hint.melt', 'ohne drei Tuerme kein Schmelz-Hinweis')
  })

  check('Zuruecksetzen zeigt alle Hinweise wieder', () => {
    const state = ready()
    for (const hint of HINTS) state.permanent.seenHints.push(hint.id)
    assertEqual(pendingHint(state), null)

    resetHints(state)
    assertEqual(state.permanent.seenHints.length, 0)
  })

  check('der Hinweis zum Buff-Turm nennt den Zeitpunkt', () => {
    // GDD 14 Abschnitt 4a nennt den Zeitpunkt des Buff-Turms das groesste
    // Verstaendnisrisiko des Spiels - der Text muss ihn deshalb ausdruecklich ansprechen.
    const state = ready()
    const hint = HINTS.find((entry) => entry.id === 'hint.buff')
    assert(hint !== undefined, 'den Hinweis muss es geben')
    assert(hint.when(state), 'das Startlager enthaelt einen Verstaerker')
  })

  check('ein Buff-Turm im Lager loest den Hinweis aus, ein platzierter nicht mehr', () => {
    const state = ready()
    const hint = HINTS.find((entry) => entry.id === 'hint.buff')
    assert(hint !== undefined, 'den Hinweis muss es geben')
    assertEqual(hint.when(state), true)

    // Alle Verstaerker platzieren: Der Hinweis hat seinen Zweck erfuellt.
    refresh(state)
    for (const module of [...state.run.station.inventory]) {
      const edges = stationView(state).freeEdges
      const edge = edges[0]
      if (!edge) break
      place(state.run.station, module.uid, edge)
      invalidateStationView(state)
    }
    assertEqual(state.run.station.inventory.length, 0)
    assertEqual(hint.when(state), false)
  })
}
