/**
 * Das Mischpult: die Rechnung hinter der Bremse und die drei Pegel im Geraetespeicher.
 *
 * **Was hier nicht geprueft wird und warum.** Der eigentliche Beweis, dass die Summe unter
 * 1,0 bleibt, ist eine Messung mit `OfflineAudioContext` - und den gibt es nur im Browser.
 * Was hier steht, ist die Schicht darunter: Die Kennlinie des Formgebers ist reine
 * Arithmetik, und wenn sie ihre Zusage haelt, kann der `WaveShaper` sie nicht brechen. Er
 * klemmt jede Eingabe auf den Bereich der Kennlinie und interpoliert zwischen ihren
 * Stuetzstellen - beides kann keinen Wert erzeugen, der groesser ist als der groesste
 * Stuetzwert. Genau der wird hier gemessen.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import {
  BUSES,
  CEILING,
  clampLevel,
  defaultMix,
  isBus,
  softClip,
  softClipCurve,
  SOFT_KNEE,
} from '../../app/mixer.ts'
import { defaultSettings, loadSettings, SETTINGS_KEY } from '../../app/settings.ts'

/**
 * Die Pegel aller Stimmen, die bei einem Bosstod im vollen Schusswechsel zusammenkommen
 * koennen - der Groessenordnung nach aus dem Klangplan (`app/soundplan.ts`). Die genauen
 * Zahlen stehen dort; hier zaehlt nur, dass ihre Summe die Bremse wirklich fordert.
 *
 * Zusammen liegen sie deutlich ueber eins. Das ist keine Nachlaessigkeit, sondern der
 * Normalfall: Jeder einzelne Wert ist fuer sich richtig gewaehlt, und keine Auswahl von
 * Einzelwerten kann verhindern, dass sich zwoelf davon addieren. Dagegen hilft nur eine
 * Bremse hinter der Summe.
 */
const WORST_CASE = [0.6, 0.5, 0.5, 0.45, 0.45, 0.42, 0.42, 0.34, 0.32, 0.3, 0.26, 0.2]

/**
 * Ein Speicher fuer den Test - `localStorage` gibt es im headless-Lauf nicht.
 *
 * Er wird am Ende der Reihe wieder abgeraeumt ({@link dropStorage}): `app/save.ts` merkt
 * sich beim ersten Zugriff, welchen Speicher es gefunden hat, und duerfte diesen hier nie
 * zu fassen bekommen.
 */
function fakeStorage(entry: string | null): void {
  const store = new Map<string, string>()
  if (entry !== null) store.set(SETTINGS_KEY, entry)
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

function dropStorage(): void {
  delete (globalThis as { localStorage?: unknown }).localStorage
}

export function mixerSuite(): void {
  suite('app/mixer')

  check('unterhalb des Knies bleibt das Signal unangetastet', () => {
    // Ein einzelner Schuss darf nicht deshalb anders klingen, weil ein Limiter im Haus ist.
    for (const x of [0, 0.05, 0.2, 0.5, SOFT_KNEE]) {
      assertClose(softClip(x), x, 1e-12, `${x} wurde verbogen`)
      assertClose(softClip(-x), -x, 1e-12, `${-x} wurde verbogen`)
    }
  })

  check('der Uebergang am Knie ist knickfrei', () => {
    // Ein Knick erzeugt Obertoene genau dort, wo es ohnehin schon voll ist. Geprueft wird
    // die Steigung links und rechts des Knies - sie muss auf beiden Seiten 1 sein.
    const h = 1e-6
    const left = (softClip(SOFT_KNEE) - softClip(SOFT_KNEE - h)) / h
    const right = (softClip(SOFT_KNEE + h) - softClip(SOFT_KNEE)) / h
    assertClose(left, 1, 1e-4, 'links vom Knie')
    assertClose(right, 1, 1e-4, 'rechts vom Knie')
  })

  check('kein Eingang bringt den Ausgang ueber die Decke', () => {
    // Der Tangens hyperbolicus naehert sich der Eins und erreicht sie in echter Rechnung
    // nie - in Gleitkommarechnung schon, ab etwa x = 19. Deshalb ist die Zusage "hoechstens
    // die Decke" und nicht "unter der Decke"; die Decke selbst liegt unter eins, und darauf
    // kommt es an.
    for (const x of [1, 2, 10, 1000, 1e9, Number.MAX_SAFE_INTEGER]) {
      assert(softClip(x) <= CEILING, `${x} ergab ${softClip(x)}`)
      assert(softClip(x) < 1, `${x} ergab ${softClip(x)}`)
      assert(softClip(-x) >= -CEILING, `${-x} ergab ${softClip(-x)}`)
    }
    // Auch Unfug darf nichts kaputt machen - ein fehlender Ton ist hinnehmbar, ein NaN im
    // Ausgangspuffer nicht: Es macht die ganze Wiedergabe stumm.
    assertEqual(softClip(Number.NaN), 0)
    assertEqual(softClip(Number.POSITIVE_INFINITY), 0)
  })

  check('die Kennlinie ist streng monoton, punktsymmetrisch und trifft die Null', () => {
    const curve = softClipCurve(4097)
    assertEqual(curve.length, 4097)
    // Genau die Mitte: Bei gerader Punktzahl laege dort ein Gleichanteil, und ein
    // Gleichanteil ist ein Knacken beim Ein- und Ausschalten.
    assertEqual(curve[2048], 0)
    for (let i = 1; i < curve.length; i++) {
      assert((curve[i] ?? 0) > (curve[i - 1] ?? 0), `nicht monoton bei ${i}`)
    }
    for (let i = 0; i < 2048; i++) {
      assertClose(curve[i] ?? 0, -(curve[4096 - i] ?? 0), 1e-7, `unsymmetrisch bei ${i}`)
    }
  })

  check('der groesste Stuetzwert der Kennlinie liegt unter 1,0', () => {
    // Das ist die ganze Zusage der Bremse, und sie steht und faellt mit dieser Zahl.
    // Das ist die harte Zusage: Der WaveShaper klemmt jede Eingabe auf den Bereich der
    // Kennlinie und interpoliert linear zwischen ihren Punkten. Beides kann nichts
    // erzeugen, was groesser ist als der groesste Punkt.
    const curve = softClipCurve()
    let peak = 0
    for (const value of curve) peak = Math.max(peak, Math.abs(value))
    assert(peak < 1, `Spitze der Kennlinie: ${peak}`)
    assert(peak < CEILING, `Spitze der Kennlinie: ${peak}, Decke ${CEILING}`)
  })

  check('der schlimmste gleichzeitige Fall bleibt unter 1,0', () => {
    // Bosstod plus elf weitere Stimmen, alle bei vollem Pegel und alle in derselben
    // Richtung - schlimmer geht es rechnerisch nicht.
    const sum = WORST_CASE.reduce((total, gain) => total + gain, 0)
    assert(sum > 1, `die Summe muss ueberhaupt erst gefaehrlich sein, ist aber ${sum}`)
    assert(softClip(sum) < 1, `${sum} ergab ${softClip(sum)}`)
  })

  check('Pegel werden auf 0 bis 1 gestutzt', () => {
    assertEqual(clampLevel(0.42, 0), 0.42)
    assertEqual(clampLevel(-3, 0), 0)
    assertEqual(clampLevel(7, 0), 1)
    assertEqual(clampLevel(Number.NaN, 0.5), 0.5)
    assertEqual(clampLevel(undefined, 0.5), 0.5)
    assertEqual(clampLevel('laut', 0.5), 0.5)
  })

  check('es gibt genau drei Busse', () => {
    assertEqual(BUSES.length, 3)
    assertEqual(new Set(BUSES).size, 3)
    for (const bus of BUSES) assertEqual(isBus(bus), true)
    assertEqual(isBus('master'), false)
    assertEqual(isBus(null), false)
    // Jeder Bus hat einen Startwert, und keiner startet stumm oder voll aufgedreht.
    const mix = defaultMix()
    for (const bus of BUSES) {
      assert((mix[bus] ?? -1) > 0, `${bus} startet stumm`)
      assert((mix[bus] ?? 2) < 1, `${bus} startet voll aufgedreht`)
    }
  })

  suite('app/settings')

  check('die drei Pegel ueberstehen das Speichern und Laden', () => {
    fakeStorage(
      JSON.stringify({
        buffLines: false,
        effects: true,
        motion: false,
        mix: { music: 0.13, sfx: 0.87, ui: 0 },
      }),
    )
    const loaded = loadSettings()
    assertEqual(loaded.mix.music, 0.13)
    assertEqual(loaded.mix.sfx, 0.87)
    assertEqual(loaded.mix.ui, 0)
    assertEqual(loaded.buffLines, false)
    assertEqual(loaded.motion, false)
  })

  check('ein alter Eintrag mit einer einzigen Lautstaerke geht nicht verloren', () => {
    // Wer vor den Bussen leise gestellt hat, darf nach der Aktualisierung nicht ungefragt
    // wieder volle Lautstaerke bekommen. Das macht genau einmal einen sehr schlechten
    // Eindruck - und danach ist der Ton fuer immer aus.
    fakeStorage(JSON.stringify({ buffLines: true, effects: true, motion: true, volume: 0.25 }))
    const loaded = loadSettings()
    for (const bus of BUSES) assertEqual(loaded.mix[bus], 0.25, bus)
  })

  check('der neue Eintrag schlaegt den alten', () => {
    fakeStorage(JSON.stringify({ volume: 1, mix: { music: 0.1, sfx: 0.2, ui: 0.3 } }))
    const loaded = loadSettings()
    assertEqual(loaded.mix.music, 0.1)
    assertEqual(loaded.mix.sfx, 0.2)
    assertEqual(loaded.mix.ui, 0.3)
  })

  check('kaputte Pegel fallen auf den Startwert zurueck, einzeln', () => {
    const base = defaultSettings().mix
    fakeStorage(JSON.stringify({ mix: { music: 'laut', sfx: 0.4, ui: null } }))
    const loaded = loadSettings()
    assertEqual(loaded.mix.music, base.music)
    assertEqual(loaded.mix.sfx, 0.4)
    assertEqual(loaded.mix.ui, base.ui)
  })

  check('ohne gespeicherte Einstellungen stehen die Startwerte da', () => {
    fakeStorage(null)
    const loaded = loadSettings()
    assertEqual(loaded.mix.music, defaultSettings().mix.music)
    fakeStorage('{kein json')
    assertEqual(loadSettings().mix.sfx, defaultSettings().mix.sfx)
    dropStorage()
  })
}
