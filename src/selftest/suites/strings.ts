/**
 * Alle Spielertexte laufen ueber `t()` (GDD 16 Abschnitt 1). Der Test sichert die
 * Platzhalter-Ersetzung ab - sie ist die Stelle, an der eine spaetere deutsche Fassung
 * bricht, wenn sie unsauber ist.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { hasString, STRINGS, t } from '../../data/strings.ts'

export function stringsSuite(): void {
  suite('data/strings')

  check('Text ohne Platzhalter kommt unveraendert', () => {
    assertEqual(t('game.title'), 'WAVEBREAKER')
  })

  check('Platzhalter werden ersetzt', () => {
    assertEqual(t('hud.wave', { wave: 12 }), 'Wave 12')
    assertEqual(t('hud.speed', { factor: 4 }), 'Speed x4')
  })

  check('fehlende Werte bleiben sichtbar stehen, statt zu verschwinden', () => {
    assertEqual(t('hud.wave', {}), 'Wave {wave}')
  })

  check('jeder Text ist englisch und nicht leer', () => {
    for (const [key, value] of Object.entries(STRINGS)) {
      assert(value.trim().length > 0, `leerer Text: ${key}`)
      assert(
        !/[äöüßÄÖÜ]/.test(value),
        `Spielsprache ist Englisch, "${key}" enthaelt deutsche Zeichen`,
      )
    }
  })

  check('hasString erkennt unbekannte Schluessel', () => {
    assertEqual(hasString('game.title'), true)
    assertEqual(hasString('gibt.es.nicht'), false)
  })
}
