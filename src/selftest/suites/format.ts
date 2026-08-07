/**
 * Zahlendarstellung nach GDD 13 Abschnitt 8. Diese Datei ist zugleich die Absicherung
 * fuer die Entscheidung "normales `number`": Wenn spaeter doch ein eigener Zahlentyp
 * kommt, muessen diese Erwartungen unveraendert gelten.
 */

import { assertEqual, check, suite } from '../../core/assert.ts'
import {
  formatDuration,
  formatDurationCoarse,
  formatNumber,
  formatPercent,
} from '../../core/format.ts'

export function formatSuite(): void {
  suite('core/format')

  check('bis 9.999 vollstaendig mit Tausendertrennung', () => {
    assertEqual(formatNumber(0), '0')
    assertEqual(formatNumber(7), '7')
    assertEqual(formatNumber(999), '999')
    assertEqual(formatNumber(4250), '4,250')
    assertEqual(formatNumber(9999), '9,999')
  })

  check('ab 10.000 abgekuerzt mit einer Nachkommastelle', () => {
    assertEqual(formatNumber(10_000), '10.0K')
    assertEqual(formatNumber(12_500), '12.5K')
    assertEqual(formatNumber(3_800_000), '3.8M')
    assertEqual(formatNumber(1_200_000_000), '1.2B')
    assertEqual(formatNumber(1e12), '1.0T')
  })

  check('die Abkuerzung springt sauber in die naechste Stufe', () => {
    assertEqual(formatNumber(999_949), '999.9K', 'darf nie "1000.0K" ergeben')
    assertEqual(formatNumber(1_000_000), '1.0M')
  })

  check('sehr grosse Werte wissenschaftlich', () => {
    assertEqual(formatNumber(1e15), '1.0e15')
    assertEqual(formatNumber(4.19e18), '4.1e18')
  })

  check('negative Werte behalten das Vorzeichen', () => {
    assertEqual(formatNumber(-4250), '-4,250')
    assertEqual(formatNumber(-12_500), '-12.5K')
  })

  check('gebrochene Werte bekommen eine Nachkommastelle', () => {
    assertEqual(formatNumber(0.5), '0.5')
    assertEqual(formatNumber(12.34), '12.3')
  })

  check('unbrauchbare Werte stuerzen nicht ab', () => {
    assertEqual(formatNumber(Number.NaN), '-')
    assertEqual(formatNumber(Number.POSITIVE_INFINITY), '-')
  })

  check('Prozent nie als Multiplikator', () => {
    assertEqual(formatPercent(0.15), '15%')
    assertEqual(formatPercent(0.15, { sign: true }), '+15%')
    assertEqual(formatPercent(-0.2, { sign: true }), '-20%')
    assertEqual(formatPercent(0.075, { decimals: 1 }), '7.5%')
    assertEqual(formatPercent(1), '100%')
  })

  check('Dauer als Spielzeit', () => {
    assertEqual(formatDuration(0), '0s')
    assertEqual(formatDuration(8), '8s')
    assertEqual(formatDuration(65), '1:05')
    assertEqual(formatDuration(8043), '2:14:03')
    assertEqual(formatDuration(-1), '-')
  })

  check('grobe Dauer fuer die Rueckkehr-Zusammenfassung', () => {
    assertEqual(formatDurationCoarse(30), '30s')
    assertEqual(formatDurationCoarse(2700), '45m')
    assertEqual(formatDurationCoarse(8043), '2h 14m')
    assertEqual(formatDurationCoarse(7200), '2h')
  })
}

