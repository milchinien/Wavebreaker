/**
 * Selbsttests ohne Browser: `npm run selftest`.
 *
 * Der Weg ueber `?selftest` im Spiel bleibt der eigentliche, hier laeuft derselbe Code
 * nur schneller und zusaetzlich mit den Regelpruefungen aus `guards.ts`. Dass das
 * ueberhaupt geht, ist der Beweis, dass `core/` und `sim/` ohne Browser lauffaehig sind -
 * die Voraussetzung fuer die Offline-Simulation in E17.
 */

import { setEventErrorReporter } from '../core/events.ts'
import { runGuards } from './guards.ts'
import { runSelfTests, summarize } from './index.ts'

// Erwartete Fehler aus dem Ereignis-Test sollen die Ausgabe nicht fluten.
setEventErrorReporter(() => {})

const results = [...runSelfTests(), ...runGuards()]
const summary = summarize(results)

let lastSuite = ''
for (const result of results) {
  if (result.suite !== lastSuite) {
    console.log(`\n  ${result.suite}`)
    lastSuite = result.suite
  }
  const mark = result.ok ? '  ok  ' : ' FAIL '
  console.log(`   ${mark} ${result.name}`)
  if (!result.ok && result.message) console.log(`         ${result.message}`)
}

console.log(
  `\n  ${summary.passed}/${summary.total} bestanden` +
    (summary.failed > 0 ? `, ${summary.failed} fehlgeschlagen` : '') +
    '\n',
)

process.exit(summary.ok ? 0 : 1)
