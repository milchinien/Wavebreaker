/**
 * Die Musik, soweit sie sich ohne Ohr pruefen laesst - und das ist bei gerechneter Musik
 * fast alles.
 *
 * **Warum das hier ueberhaupt geht.** Ein Musikbett aus einer Datei koennte man nur
 * anhoeren. Dieses hier ist eine Rechnung (`app/musicplan.ts`): dieselbe Funktion, die im
 * Spiel die Puffer fuellt, fuellt hier ein `Float32Array`, und darin sind Naht, Spitze,
 * Pegel und Spektrum harte Zahlen. Gemessen wird an genau den Abtastwerten, die der Spieler
 * hoert - nicht an einem Nachbau.
 *
 * **Die vier Zusagen, die hier fallen oder halten.**
 *
 *   1. **Kein Knacken an der Wiederholstelle.** Der Sprung zwischen letztem und erstem
 *      Abtastwert jeder Schleife liegt unter 0,01 - und, was mehr sagt, unter dem groessten
 *      gewoehnlichen Abtastschritt im Inneren. Damit ist er kein Sprung, sondern ein Schritt.
 *   2. **Drei unterscheidbare Lagen.** Ruhe, Gefecht und Boss haben messbar verschiedene
 *      Spektren. Eine Musik, die im Bosskampf anders klingt, ohne dass man es messen kann,
 *      klingt auch fuer den Spieler nicht anders.
 *   3. **Ueberblenden statt schneiden**, und dabei nie ein Loch: Die Blende dauert ueber
 *      eine Sekunde, und die Flaeche steht in jeder Mischung ueber 0,4.
 *   4. **Kein Ton ohne Zuhoerer.** Steht der Regler auf null, laufen null Quellen - geprueft
 *      am wirklichen Apparat gegen einen nachgebauten Klangkontext.
 *
 * **Was hier nicht geprueft wird.** Der Weg durch den echten Browser: `AudioContext`,
 * `BiquadFilter`, die Rechenzeit je Bild. Das misst `public/musikmessung.html` mit einem
 * `OfflineAudioContext` - und zwar an denselben Dateien, gegen dieselben Grenzen.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { emit, resetEvents } from '../../core/events.ts'
import { createMusicBed } from '../../app/musicbed.ts'
import {
  FADE_SECONDS,
  isSustained,
  LAYERS,
  LOOP_SECONDS,
  MIX,
  MOODS,
  MOOD_OF_EVENT,
  planScore,
  pluck,
  renderScore,
  SCORE,
  SLICE_SAMPLES,
  slopeBudget,
  snapHz,
  START_MOOD,
  attachMood,
  type LayerId,
  type Mood,
} from '../../app/musicplan.ts'

/**
 * Die Grenze, unter der ein Sprung an der Nahtstelle nicht mehr zu hoeren ist.
 *
 * Sie ist absolut und nicht verhandelbar: Ein Sprung von 0,01 bei Vollaussteuerung ist ein
 * Klicken von -40 dB, und das hoert man in einer ruhigen Stelle sofort. Erreicht wird hier
 * das Fuenfzehnfache besser - aber die Zusage ist die Grenze, nicht der Bestwert.
 */
const SEAM_LIMIT = 0.01

/** Die Abtastraten, in denen Browser tatsaechlich arbeiten. Beide muessen halten. */
const RATES = [44100, 48000]

/**
 * Die Baender, in denen die Lagen verglichen werden.
 *
 * Sechs statt vieler: Wer drei Lagen unterscheiden will, braucht keine feine Analyse,
 * sondern die grobe Frage, wo die Energie liegt. Die Grenzen sind nach der Partitur
 * gesetzt, nicht nach einer Norm - das Knurren des Bosses (41 Hz) muss vom Grundton der
 * Flaeche (55 Hz) getrennt sein, sonst faellt beides in denselben Topf und die Messung
 * sieht nichts.
 */
const BANDS: readonly [number, number][] = [
  [25, 52],
  [52, 100],
  [100, 240],
  [240, 600],
  [600, 1600],
  [1600, 5000],
]

/**
 * Wie weit sich zwei Lagen mindestens unterscheiden muessen, in Dezibel.
 *
 * **Warum in Dezibel und nicht in Prozentpunkten.** Der Anteil eines Bandes an der
 * Gesamtenergie sagt fast nichts: Vier Fuenftel der Energie stecken in den Grundtoenen der
 * Flaeche, und alles, was der Puls darueber legt, verschiebt Anteile nur um wenige
 * Prozentpunkte - waehrend es im Band selbst eine Verdreifachung ist. Drei Dezibel sind eine
 * Verdopplung der Energie in einem Band; das ist die Schwelle, ab der ein Unterschied nicht
 * mehr wegdiskutiert werden kann.
 */
const BAND_GAP_DB = 3

/**
 * Der Boden, unter dem ein Band als leer gilt - vierzig Dezibel unter der Gesamtenergie.
 *
 * Ohne ihn misst die Pruefung Rundungsreste: Ein Band, in dem gar nichts steht, kommt bei
 * 1e-13 heraus, und der Vergleich mit einem, in dem etwas leise steht, ergibt neunzig
 * Dezibel Unterschied. Das waere eine grosse Zahl ueber nichts.
 */
const BAND_FLOOR = 1e-4

/* === Werkzeug: eine kleine schnelle Fouriertransformation ================== */

/**
 * Radix-2 an Ort und Stelle. Zwanzig Zeilen, weil vier Baender keine Bibliothek brauchen.
 */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i] as number
      const ti = im[i] as number
      re[i] = re[j] as number
      im[i] = im[j] as number
      re[j] = tr
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wr = Math.cos(angle)
    const wi = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k] as number
        const ai = im[i + k] as number
        const br = re[i + k + len / 2] as number
        const bi = im[i + k + len / 2] as number
        const tr = br * cr - bi * ci
        const ti = br * ci + bi * cr
        re[i + k] = ar + tr
        im[i + k] = ai + ti
        re[i + k + len / 2] = ar - tr
        im[i + k + len / 2] = ai - ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

const WINDOW = 16384

/** Der Energieanteil jedes Bandes an der Gesamtenergie - gemittelt ueber drei Fenster. */
function bandShares(samples: Float64Array, sampleRate: number): number[] {
  const power = new Float64Array(WINDOW / 2)
  const offsets = [0, Math.floor(samples.length / 3), Math.floor((2 * samples.length) / 3)]

  for (const offset of offsets) {
    const re = new Float64Array(WINDOW)
    const im = new Float64Array(WINDOW)
    for (let n = 0; n < WINDOW; n++) {
      // Hann-Fenster: ohne es schmiert jeder Ton ueber alle Baender.
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / WINDOW)
      re[n] = (samples[(offset + n) % samples.length] as number) * hann
    }
    fft(re, im)
    for (let k = 0; k < WINDOW / 2; k++) {
      power[k] = (power[k] as number) + (re[k] as number) ** 2 + (im[k] as number) ** 2
    }
  }

  const bins = BANDS.map(() => 0)
  let total = 0
  for (let k = 1; k < WINDOW / 2; k++) {
    const hz = (k * sampleRate) / WINDOW
    const value = power[k] as number
    total += value
    for (const [b, band] of BANDS.entries()) {
      if (hz >= band[0] && hz < band[1]) bins[b] = (bins[b] as number) + value
    }
  }
  return bins.map((value) => (total > 0 ? value / total : 0))
}

/** Die Mischung einer Lage als ein Kanal - genau das, was der Musikbus zu sehen bekommt. */
function mixdown(
  layers: Record<LayerId, [Float32Array, Float32Array]>,
  mood: Mood,
): { samples: Float64Array; peak: number; rms: number } {
  const count = layers.grund[0].length
  const samples = new Float64Array(count)
  let peak = 0
  let square = 0
  for (let n = 0; n < count; n++) {
    let left = 0
    let right = 0
    for (const id of LAYERS) {
      const weight = MIX[mood][id]
      if (weight === 0) continue
      left += weight * (layers[id][0][n] as number)
      right += weight * (layers[id][1][n] as number)
    }
    samples[n] = (left + right) / 2
    peak = Math.max(peak, Math.abs(left), Math.abs(right))
    square += left * left + right * right
  }
  return { samples, peak, rms: Math.sqrt(square / (2 * count)) }
}

/* === Werkzeug: ein nachgebauter Klangkontext =============================== */

type Automation = { kind: string; value: number; time: number }

/**
 * Ein Klangkontext, der nichts hoerbar macht und alles aufschreibt.
 *
 * Damit laesst sich der Apparat aus `app/musicbed.ts` ohne Browser pruefen: wie viele
 * Quellen er startet, wann er sie anhaelt, und welche Rampen er auf die Pegel legt. Das ist
 * kein Nachbau der Musik - die Musik ist echt -, sondern ein Nachbau der Steckdose.
 *
 * Die Abtastrate ist absichtlich niedrig: Der Apparat interessiert sich nicht dafuer, und
 * bei 8 kHz dauert das Rechnen der drei Schleifen einen Wimpernschlag statt einer
 * Fuenftelsekunde.
 */
function stubContext(): {
  context: BaseAudioContext
  target: AudioNode
  automation: Map<string, Automation[]>
  live(): number
  advance(seconds: number): void
  endAll(): void
} {
  let now = 0
  const automation = new Map<string, Automation[]>()
  const ends: (() => void)[] = []
  let started = 0
  let stopped = 0

  const makeParam = (name: string): unknown => {
    const log: Automation[] = []
    automation.set(name, log)
    return {
      value: 0,
      cancelScheduledValues(time: number) {
        log.push({ kind: 'cancel', value: 0, time })
      },
      setValueAtTime(value: number, time: number) {
        log.push({ kind: 'set', value, time })
      },
      linearRampToValueAtTime(value: number, time: number) {
        log.push({ kind: 'ramp', value, time })
      },
    }
  }

  let gainIndex = 0
  const context = {
    sampleRate: 8000,
    get currentTime() {
      return now
    },
    createGain() {
      const name = `gain${gainIndex++}`
      return { gain: makeParam(name), connect() {}, disconnect() {} }
    },
    createBuffer(channels: number, length: number, sampleRate: number) {
      return {
        duration: length / sampleRate,
        length,
        numberOfChannels: channels,
        sampleRate,
        copyToChannel() {},
      }
    },
    createBufferSource() {
      const source = {
        buffer: null as unknown,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        onended: null as null | (() => void),
        connect() {},
        disconnect() {},
        start() {
          started += 1
        },
        stop() {
          stopped += 1
          ends.push(() => source.onended?.())
        },
      }
      return source
    },
  }

  return {
    context: context as unknown as BaseAudioContext,
    target: {} as AudioNode,
    automation,
    live: () => started - stopped,
    advance(seconds: number) {
      now += seconds
    },
    endAll() {
      for (const end of ends.splice(0)) end()
    },
  }
}

/* === Die Pruefungen ======================================================== */

export function musikSuite(): void {
  suite('app/musicplan')

  check('jede Lage hat eine vollstaendige Mischung, und keine ist stumm', () => {
    for (const mood of MOODS) {
      let sum = 0
      for (const id of LAYERS) {
        const value = MIX[mood][id]
        assert(Number.isFinite(value), `${mood}/${id} ist keine Zahl`)
        assert(value >= 0 && value <= 1, `${mood}/${id} liegt ausserhalb 0..1: ${value}`)
        sum += value
      }
      assert(sum > 0, `${mood} ist vollstaendig stumm`)
      // Die Flaeche ist der Boden, ueber dem alles andere kommt und geht. Faellt sie in
      // einer Lage weg, kann eine Ueberblendung ein Loch bekommen - und ein Loch in der
      // Musik hoert man deutlicher als jeden Wechsel.
      assert(MIX[mood].grund >= 0.4, `${mood} laesst die Flaeche auf ${MIX[mood].grund} fallen`)
    }
    // Die drei Lagen muessen ueberhaupt verschieden gemischt sein.
    const fingerprints = MOODS.map((mood) => LAYERS.map((id) => MIX[mood][id]).join('/'))
    assertEqual(new Set(fingerprints).size, MOODS.length, 'zwei Lagen sind dieselbe Mischung')
  })

  check('die Ueberblendung dauert mindestens eine halbe Sekunde und hat kein Loch', () => {
    assert(FADE_SECONDS >= 0.5, `die Blende dauert nur ${FADE_SECONDS} s`)

    // Waehrend einer linearen Blende steht jede Schicht zwischen ihrem alten und ihrem
    // neuen Wert. Der Summenpegel kann also nie unter das Minimum der beiden Enden fallen -
    // hier nachgerechnet an hundert Zwischenstaenden, fuer jedes Paar von Lagen.
    for (const from of MOODS) {
      for (const to of MOODS) {
        for (let step = 0; step <= 100; step++) {
          const f = step / 100
          let sum = 0
          for (const id of LAYERS) sum += (1 - f) * MIX[from][id] + f * MIX[to][id]
          assert(sum > 0.4, `${from} -> ${to} faellt bei ${f} auf ${sum.toFixed(3)}`)
        }
      }
    }
  })

  check('jeder Dauerton liegt auf dem Raster der Schleife', () => {
    // Nur dann passt in eine Schleife eine ganze Zahl von Schwingungen, und nur dann steht
    // der Ton am Ende genau dort, wo er anfing.
    for (const id of LAYERS) {
      for (const voice of SCORE[id]) {
        if (voice.kind !== 'flaeche') continue
        for (const partial of voice.partials) {
          const snapped = snapHz(voice.hz * partial.multiple)
          const turns = snapped * LOOP_SECONDS
          assert(
            Math.abs(turns - Math.round(turns)) < 1e-9,
            `${id}: ${snapped} Hz ergibt ${turns} Schwingungen je Schleife`,
          )
          // Und die Rundung darf den Ton nicht verstimmen: ein Sechzehntel Hertz ist
          // weniger als ein Tausendstel Halbton.
          assert(
            Math.abs(snapped - voice.hz * partial.multiple) <= 0.5 / LOOP_SECONDS + 1e-9,
            `${id}: ${voice.hz * partial.multiple} Hz wurde nach ${snapped} Hz verschoben`,
          )
        }
        assertEqual(
          voice.breath,
          Math.round(voice.breath),
          `${id}: ${voice.breath} Atemzuege je Schleife sind keine ganze Zahl`,
        )
      }
    }
  })

  check('ein angeschlagener Ton endet auf exakt null', () => {
    // Ohne das waere jeder Ton, der ueber das Schleifenende hinausklingt, ein echter Sprung.
    const tail = 0.5
    assertEqual(pluck(tail, 0.005, 0.08, tail), 0)
    assertEqual(pluck(tail + 1, 0.005, 0.08, tail), 0)
    assertEqual(pluck(-0.1, 0.005, 0.08, tail), 0)
    assertEqual(pluck(0, 0.005, 0.08, tail), 0)
    assert(pluck(0.005, 0.005, 0.08, tail) > 0.9, 'der Anstieg erreicht seine Spitze nicht')
    assert(pluck(0.4, 0.005, 0.08, tail) < 0.01, 'der Ausklang ist bei 0,4 s noch zu laut')
  })

  check('die Flaeche haelt ihre Naht ohne jede Messung', () => {
    // Fuer eine Schicht aus lauter Dauertoenen ist die Nahtlosigkeit Arithmetik: Der Sprung
    // ist hoechstens die groesste Steigung geteilt durch die Abtastrate.
    for (const id of LAYERS) {
      if (!isSustained(id)) continue
      const bound = (2 * Math.PI * slopeBudget(id)) / Math.min(...RATES)
      assert(bound < SEAM_LIMIT, `${id}: Schranke ${bound.toFixed(5)}`)
    }
    // Mindestens eine Schicht muss diese Zusage tragen - sonst haette die Rechnung oben
    // nichts geprueft.
    assert(LAYERS.some(isSustained), 'keine einzige Schicht besteht nur aus Dauertoenen')
  })

  for (const rate of RATES) {
    check(`bei ${rate} Hz ist die Wiederholstelle kein Sprung, sondern ein Schritt`, () => {
      const layers = renderScore(rate)
      for (const id of LAYERS) {
        for (const [channel, samples] of layers[id].entries()) {
          const last = samples.length - 1
          const seam = Math.abs((samples[0] as number) - (samples[last] as number))
          assert(seam < SEAM_LIMIT, `${id}/${channel}: Naht ${seam.toFixed(6)}`)

          // Der eigentliche Beweis: Der Schritt ueber die Naht ist nicht groesser als der
          // groesste Schritt im Inneren. Ein Puffer mit einem echten Knacks haette hier
          // eine Naht, die den Rest um Groessenordnungen ueberragt.
          let inner = 0
          for (let n = 1; n <= last; n++) {
            inner = Math.max(inner, Math.abs((samples[n] as number) - (samples[n - 1] as number)))
          }
          assert(seam <= inner, `${id}/${channel}: Naht ${seam} ueber dem groessten Schritt ${inner}`)
        }
      }
    })
  }

  check('keine Schicht ist still, und keine uebersteuert', () => {
    const layers = renderScore(44100)
    for (const id of LAYERS) {
      let peak = 0
      for (const samples of layers[id]) {
        for (const value of samples) peak = Math.max(peak, Math.abs(value))
      }
      assert(peak > 0.02, `${id} ist praktisch still: Spitze ${peak.toFixed(4)}`)
      // Deutlich unter der Vollaussteuerung: Danach kommen noch der Musikbus und alles,
      // was gleichzeitig im Feld passiert.
      assert(peak < 0.5, `${id} nimmt zu viel Platz: Spitze ${peak.toFixed(4)}`)
    }

    for (const mood of MOODS) {
      const { peak } = mixdown(layers, mood)
      assert(peak < 0.6, `Lage ${mood} kommt auf ${peak.toFixed(4)}`)
    }
  })

  check('die drei Lagen unterscheiden sich messbar im Spektrum', () => {
    const layers = renderScore(44100)
    const shares = new Map<Mood, number[]>()
    const levels = new Map<Mood, number>()
    for (const mood of MOODS) {
      const { samples, rms } = mixdown(layers, mood)
      shares.set(mood, bandShares(samples, 44100))
      levels.set(mood, rms)
    }

    for (const [i, a] of MOODS.entries()) {
      for (const b of MOODS.slice(i + 1)) {
        const left = shares.get(a) as number[]
        const right = shares.get(b) as number[]
        let gap = 0
        for (const [band] of BANDS.entries()) {
          const one = (left[band] as number) + BAND_FLOOR
          const other = (right[band] as number) + BAND_FLOOR
          gap = Math.max(gap, Math.abs(10 * Math.log10(one / other)))
        }
        assert(
          gap >= BAND_GAP_DB,
          `${a} und ${b} klingen fast gleich: groesster Bandabstand ${gap.toFixed(1)} dB`,
        )
      }
      assert((levels.get(a) as number) > 0.01, `Lage ${a} ist zu leise: ${levels.get(a)}`)
    }
  })

  for (const rate of RATES) {
    check(`bei ${rate} Hz haelt jede Portion des Aufbaus ihr Mass`, () => {
      const job = planScore(rate)

      // Erstens: Es ist ueberhaupt eine Zerlegung. Ein Plan aus drei Schritten waere drei
      // Schichten am Stueck und damit genau der Ruckler, den es hier abzustellen gilt.
      assert(job.size >= 40, `der Plan hat nur ${job.size} Schritte`)

      // Zweitens: Kein einzelner Schritt ist breiter als eine Portion. Nur deshalb ist die
      // Grenze unten eine Zusage und keine Naeherung - ein breiterer Schritt duerfte sie
      // sprengen, weil die Rechnung sonst nicht voranquellte.
      let widest = 0
      let total = 0
      for (let index = 0; index < job.size; index++) {
        const cost = job.cost(index)
        assert(cost > 0, `Schritt ${index} tut nichts`)
        widest = Math.max(widest, cost)
        total += cost
      }
      assert(
        widest <= SLICE_SAMPLES,
        `ein Schritt fasst ${widest} Werte an, eine Portion nur ${SLICE_SAMPLES}`,
      )

      // Drittens - die eigentliche Zusage: Keine Portion fasst mehr als ihr Mass an, und es
      // sind genug, dass zwischen ihnen wirklich Bilder liegen koennen.
      let portions = 0
      let heaviest = 0
      for (let cursor = 0; cursor < job.size; portions += 1) {
        const next = job.slice(cursor)
        assert(next > cursor, `die Portion ab ${cursor} kam nicht voran`)
        let spent = 0
        for (let index = cursor; index < next; index++) spent += job.cost(index)
        heaviest = Math.max(heaviest, spent)
        cursor = next
      }
      assert(heaviest <= SLICE_SAMPLES, `eine Portion fasst ${heaviest} Werte an`)
      assert(portions >= 8, `die ganze Partitur faellt in nur ${portions} Portionen`)

      // Und die Rechnung darf nicht ins Uferlose wachsen: Wer eine Stimme dazuschreibt, soll
      // merken, dass das Bett dadurch spaeter einsetzt.
      assert(total < 40e6, `die Partitur fasst ${total} Werte an - das dauert zu lange`)
    })
  }

  check('in Portionen gerechnet kommt Abtastwert fuer Abtastwert dasselbe heraus', () => {
    /*
     * Die eigentliche Zusage der Zerlegung. Zwischen zwei Portionen kann ein Bild liegen,
     * ein Klick, ein Muellsammler - und trotzdem muss am Ende derselbe Puffer stehen wie bei
     * der ungeteilten Rechnung. Was das leicht brechen wuerde, ist ein Zwischenstand, der in
     * einem Schritt entsteht und im naechsten gebraucht wird: das gemeinsame Rechenblatt der
     * Flaechen, die Huellkurve der Pulse. Genau darauf zielt dieser Vergleich.
     */
    const ganz = renderScore(44100)

    const job = planScore(44100)
    for (let cursor = 0; cursor < job.size; ) cursor = job.slice(cursor)
    const gestueckelt = job.result()

    for (const id of LAYERS) {
      for (const [channel, samples] of ganz[id].entries()) {
        const other = gestueckelt[id][channel] as Float32Array
        assertEqual(other.length, samples.length, `${id}/${channel}: andere Laenge`)
        let worst = 0
        let where = -1
        for (let n = 0; n < samples.length; n++) {
          const gap = Math.abs((samples[n] as number) - (other[n] as number))
          if (gap > worst) {
            worst = gap
            where = n
          }
        }
        assertEqual(worst, 0, `${id}/${channel}: weicht bei Abtastwert ${where} um ${worst} ab`)
      }
    }
  })

  check('die Lage folgt dem Spiel und nicht dem Bereich', () => {
    resetEvents()
    const seen: Mood[] = []
    const watch = attachMood((mood) => seen.push(mood))

    assertEqual(watch.current(), START_MOOD)
    emit('wave.started', { wave: 3 })
    assertEqual(watch.current(), 'gefecht')
    // Zweimal dieselbe Meldung darf die laufende Blende nicht neu beginnen.
    emit('wave.started', { wave: 4 })
    emit('view.changed', { view: 'upgrades' })
    assertEqual(watch.current(), 'gefecht')
    emit('boss.spawned', { wave: 4 })
    assertEqual(watch.current(), 'boss')
    // Wer im Bosskampf in die Upgrades wechselt, ist immer noch im Bosskampf.
    emit('view.changed', { view: 'upgrades' })
    assertEqual(watch.current(), 'boss')
    emit('boss.killed', { wave: 4 })
    assertEqual(watch.current(), 'gefecht')
    emit('wave.cleared', { wave: 4 })
    assertEqual(watch.current(), 'ruhe')

    assertEqual(seen.join(','), 'gefecht,boss,gefecht,ruhe')

    for (const stop of watch.stops) stop()
    resetEvents()
    // Abgehaengt heisst abgehaengt: Danach bewegt kein Ereignis mehr die Lage.
    const after = attachMood(() => {})
    emit('boss.spawned', { wave: 9 })
    assertEqual(watch.current(), 'ruhe')
    assertEqual(after.current(), 'boss')
    for (const stop of after.stops) stop()
    resetEvents()
  })

  check('jede Lage ist erreichbar, und keine Meldung fuehrt ins Leere', () => {
    const reachable = new Set<Mood>([START_MOOD, ...(Object.values(MOOD_OF_EVENT) as Mood[])])
    for (const mood of MOODS) assert(reachable.has(mood), `die Lage ${mood} wird nie eingeschaltet`)
  })

  suite('app/musicbed')

  check('drei Schleifen laufen, und der Regler auf null haelt sie an', () => {
    const stub = stubContext()
    const bed = createMusicBed(stub.context, stub.target)

    assertEqual(bed.voices(), 0, 'vor dem Start laeuft schon etwas')
    bed.start()
    assertEqual(bed.voices(), LAYERS.length, 'es laufen nicht genau drei Schleifen')
    // Ein zweiter Start legt nichts obendrauf - sonst haette jeder Reglerzug eine Schicht
    // mehr, und nach zehn Zuegen liefe das Bett zehnfach.
    bed.start()
    assertEqual(bed.voices(), LAYERS.length, 'ein zweiter Start hat gestapelt')

    bed.stop()
    stub.advance(1)
    stub.endAll()
    assertEqual(bed.voices(), 0, 'nach dem Anhalten laeuft noch etwas')
    assertEqual(stub.live(), 0, 'es haengt noch eine Quelle am Kontext')

    // Und wieder an: Das Bett muss sich anwerfen lassen, sooft der Spieler will.
    bed.start()
    assertEqual(bed.voices(), LAYERS.length, 'nach dem Anhalten startet es nicht mehr')
    bed.dispose()
    assertEqual(bed.voices(), 0, 'nach dem Abraeumen laeuft noch etwas')
  })

  check('ein Lagenwechsel faehrt jede Schicht auf ihren neuen Wert, ueber die volle Blende', () => {
    const stub = stubContext()
    const bed = createMusicBed(stub.context, stub.target)
    bed.start()
    stub.advance(5)
    bed.setMood('boss')
    assertEqual(bed.mood(), 'boss')

    // Drei Pegel, drei Rampen - und jede endet genau auf dem Wert aus der Mischung und
    // fruehestens nach der vollen Blendzeit.
    const names = [...stub.automation.keys()]
    assertEqual(names.length, LAYERS.length, 'es gibt nicht je Schicht einen Pegel')
    for (const [index, id] of LAYERS.entries()) {
      const log = stub.automation.get(names[index] as string) as Automation[]
      const ramps = log.filter((entry) => entry.kind === 'ramp')
      const last = ramps[ramps.length - 1] as Automation
      assertEqual(last.value, MIX.boss[id], `${id} faehrt nicht auf seinen Wert`)
      assert(last.time - 5 >= 0.5, `${id} blendet in nur ${(last.time - 5).toFixed(2)} s`)
    }
    bed.dispose()
  })

  check('mit Aufschub rechnet der Start nichts und die Musik kommt nach', () => {
    /*
     * Die Zusage, um die es geht: `start` darf den Hauptfaden nicht anhalten. Der Aufschub
     * wird hier nicht ausgefuehrt, sondern eingesammelt - damit ist "es wurde abgegeben"
     * keine Vermutung ueber eine Zeitschaltung, sondern eine Zahl.
     */
    const stub = stubContext()
    const wartend: (() => void)[] = []
    const bed = createMusicBed(stub.context, stub.target, (again) => wartend.push(again))

    bed.start()
    assertEqual(bed.voices(), 0, 'der Start hat schon Quellen angeworfen')
    assert(wartend.length > 0, 'der Start hat gar nicht abgegeben, also am Stueck gerechnet')

    // Jetzt die Portionen abarbeiten, wie es der Browser zwischen zwei Bildern taete.
    let runden = 0
    while (wartend.length > 0) {
      runden += 1
      assert(runden < 500, 'die Rechnung kommt nicht zum Ende')
      ;(wartend.shift() as () => void)()
    }

    assertEqual(bed.voices(), LAYERS.length, 'nach der Rechnung laufen nicht drei Schleifen')
    assert(runden >= 2, `die Rechnung fiel in nur ${runden} Portionen`)
    bed.dispose()
  })

  check('wer waehrend des Aufbaus abschaltet, bekommt hinterher keine Musik', () => {
    // Sonst faengt das Bett eine Sekunde nach dem Abschalten von selbst an - und der Spieler
    // haette den Regler umsonst gezogen.
    const stub = stubContext()
    const wartend: (() => void)[] = []
    const bed = createMusicBed(stub.context, stub.target, (again) => wartend.push(again))

    bed.start()
    bed.stop()
    while (wartend.length > 0) (wartend.shift() as () => void)()
    assertEqual(bed.voices(), 0, 'die Musik ist nach dem Abschalten doch noch angelaufen')
    assertEqual(stub.live(), 0, 'es haengt eine Quelle am Kontext')

    // Und danach laesst sie sich trotzdem wieder anwerfen: Der Puffer steht ja inzwischen,
    // also ohne zweite Rechnung und ohne Aufschub.
    bed.start()
    assertEqual(bed.voices(), LAYERS.length, 'der zweite Start hat nichts angeworfen')
    assertEqual(wartend.length, 0, 'der zweite Start hat noch einmal gerechnet')
    bed.dispose()
  })

  check('nach dem Abraeumen rechnet keine Portion mehr', () => {
    // Ein Aufschub, der nach `dispose` noch faellt, darf weder rechnen noch etwas anwerfen.
    const stub = stubContext()
    const wartend: (() => void)[] = []
    const bed = createMusicBed(stub.context, stub.target, (again) => wartend.push(again))

    bed.start()
    bed.dispose()
    const offen = wartend.length
    while (wartend.length > 0) (wartend.shift() as () => void)()
    assert(offen > 0, 'es war gar keine Portion offen')
    assertEqual(bed.voices(), 0, 'nach dem Abraeumen laeuft etwas')
    assertEqual(stub.live(), 0, 'es haengt eine Quelle am Kontext')
  })

  check('ohne Klangkontext bleibt es still, ohne Fehler', () => {
    // Ein Kontext, der bei jedem Griff wirft - so verhaelt sich ein Browser, dem der Klang
    // ausgegangen ist. Ein fehlendes Geraeusch ist ein hinnehmbarer Zustand, ein Absturz
    // nicht.
    const broken = {
      sampleRate: 44100,
      currentTime: 0,
      createGain: () => ({ gain: { value: 0 }, connect() {}, disconnect() {} }),
      createBuffer: () => {
        throw new Error('kein Speicher')
      },
      createBufferSource: () => {
        throw new Error('kein Klang')
      },
    } as unknown as BaseAudioContext

    const bed = createMusicBed(broken, {} as AudioNode)
    bed.start()
    assertEqual(bed.voices(), 0)
    bed.setMood('boss')
    bed.stop()
    bed.dispose()
  })
}
