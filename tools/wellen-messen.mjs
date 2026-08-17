/**
 * Wie weit kommt ein Anfaenger, der nichts kauft?
 *
 *   node tools/wellen-messen.mjs
 *
 * Startet einen frischen Lauf, ruehrt keinen Upgrade an, waehlt keinen Perk und laesst die
 * Station kaempfen, bis sie faellt. Ausgegeben wird die Welle, auf der Schluss war.
 *
 * **Es ist dieselbe Simulation wie im Spiel** - `stepBattle` in einer Schleife, genau wie
 * `sim/offline.ts` es macht. Eine zweite, nachgebaute Rechnung waere wertlos: Sie wuerde
 * messen, was der Messende glaubt, und nicht, was der Spieler erlebt.
 *
 * Gemessen wird mehrfach mit verschiedenen Wuerfeln. Ein einzelner Lauf sagt wenig - welche
 * Gegner in welcher Reihenfolge kommen und wie die kritischen Treffer fallen, streut.
 */

import { createInitialState } from '../src/app/state.ts'
import { invalidateStationView, stationView } from '../src/app/view.ts'
import { TICK_RATE } from '../src/data/balance.ts'
import { stepBattle, syncStation } from '../src/sim/battle.ts'
import { syncUnlocks } from '../src/sim/prestige.ts'
import { startWave } from '../src/sim/waves.ts'

/** Wie viele Laeufe je Messung. */
const RUNS = 24

/** Notbremse, falls ein Lauf gar nicht mehr haengenbleibt. */
const GIVE_UP_SECONDS = 900

/**
 * So oft darf dieselbe Welle verloren gehen, bevor sie als **Mauer** gilt.
 *
 * Der Grund fuer diese Zahl: Ein verlorener Anlauf beendet den Lauf nicht - die Station
 * steht wieder auf und die Welle faengt von vorn an (`sim/waves.ts`). "Wie weit kommt man"
 * ist deshalb nicht "wo faellt die Station", sondern "wo geht es nicht mehr weiter". Wer
 * dieselbe Welle fuenfmal verliert, kommt ohne staerkere Tuerme auch beim sechsten Mal
 * nicht durch - was ihn bisher noch durchbrachte, war Wuerfelglueck und nicht Koennen.
 */
const WALL_ATTEMPTS = 5

function run(seed) {
  // Den Wuerfel gleich beim Anlegen setzen: `createInitialState` baut daraus die Stroeme
  // des Laufs. Ein spaeter ueberschriebenes `run.seed` erreichte sie nicht mehr.
  const state = createInitialState(seed)
  syncUnlocks(state)
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
  startWave(state, state.run.wave)

  const step = 1 / TICK_RATE
  const limit = GIVE_UP_SECONDS * TICK_RATE
  let hoch = state.run.wave

  let ersterVerlust = 0

  for (let i = 0; i < limit; i++) {
    stepBattle(state, step)
    if (state.run.wave > hoch) hoch = state.run.wave

    const versuche = state.runtime.combat.lostAttempts
    if (versuche > 0 && ersterVerlust === 0) ersterVerlust = state.run.wave

    if (versuche >= WALL_ATTEMPTS) {
      return {
        mauer: state.run.wave,
        geschafft: state.run.wave - 1,
        ersterVerlust,
        sekunden: i / TICK_RATE,
      }
    }
  }
  return {
    mauer: 0,
    geschafft: hoch,
    ersterVerlust,
    sekunden: GIVE_UP_SECONDS,
  }
}

const ergebnisse = []
for (let i = 0; i < RUNS; i++) ergebnisse.push(run(0x1000 + i * 7919))

console.log('Lauf  geschafft bis  Mauer auf Welle  erster Verlust  Sekunden')
ergebnisse.forEach((e, i) => {
  console.log(
    String(i + 1).padStart(4),
    String(e.geschafft).padStart(14),
    String(e.mauer || '-').padStart(16),
    String(e.ersterVerlust || '-').padStart(15),
    e.sekunden.toFixed(0).padStart(9),
  )
})

const mauern = ergebnisse.map((e) => e.geschafft).sort((a, b) => a - b)
const mittel = mauern.reduce((a, b) => a + b, 0) / mauern.length
const median = mauern[Math.floor(mauern.length / 2)]
console.log(
  `\ngeschafft: ${mauern[0]} bis ${mauern[mauern.length - 1]}` +
    ` · Mittel ${mittel.toFixed(1)} · Median ${median}`,
)
