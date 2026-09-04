/**
 * Klang (GDD 13 Abschnitt 11).
 *
 * **Diese Datei wird angeschlossen, nicht eingebaut.** Sie kennt keine Spielregel und wird
 * von nichts eingebunden ausser `main.ts`: Sie haengt sich ueber `app/soundplan.ts` an den
 * Ereignisbus, der seit E0 jeden bedeutsamen Vorgang meldet, und macht daraus Toene. Wer
 * sie loescht, veraendert am Spiel nichts ausser der Stille. Genau dafuer gibt es den Bus
 * seit der ersten Etappe.
 *
 * **Was hier steht und was nicht.** Hier steht der Apparat: der Klangkontext, die
 * Aufnahmen, die Zaehlung der Stimmen. Welches Ereignis wie klingt, wie oft es hoechstens
 * kommt und in welcher Gruppe es haengt, steht in `app/soundplan.ts` - als Tabelle, die
 * sich ohne Browser nachrechnen laesst. Die Trennung ist der Grund, warum die Abdeckung
 * ueber **alle** Ereignisse im Selbsttest geprueft werden kann und nicht nur behauptet wird
 * (`selftest/suites/klang.ts`).
 *
 * Fuenf Regeln bestimmen den Aufbau:
 *
 * **1. Toene werden begrenzt, nicht gestapelt.** Ein Autocannon feuert sechs Schuss je
 * Sekunde, bei vier Tuermen sind das vierundzwanzig - und bei Tempo x4 knapp hundert. Ohne
 * Begrenzung waere das kein Klang, sondern ein Rauschen, das den Rest zudeckt. Jede
 * Klangart hat deshalb einen Mindestabstand, und wer zu frueh kommt, faellt aus (GDD 13
 * Abschnitt 11: "Ausduennen bei x2/x4"). Die Sperre selbst steht im Klangplan.
 *
 * **2. Der Ton kommt spaet.** Browser verbieten Klang, bevor der Nutzer die Seite
 * angefasst hat. Der Klangapparat entsteht deshalb erst bei der ersten Beruehrung; bis
 * dahin verfallen alle Meldungen still. Ein Fehler dabei schaltet den Klang ab und laesst
 * das Spiel unberuehrt weiterlaufen - Stille ist ein hinnehmbarer Zustand, ein Absturz
 * nicht.
 *
 * **3. Die Toene sind Aufnahmen, mit gerechnetem Ersatz.** Jedes Ereignis greift auf den
 * geschnittenen Klangsatz in `public/sfx` zu (gebaut von `tools/klang-bauen.mjs`, siehe
 * `docs/anlagen.md`). Solange eine Aufnahme noch laedt oder fehlt, springt ein gerechneter
 * Ton ein - ein fehlendes Geraeusch darf nie eine Fehlermeldung ergeben und auch keine
 * Stille an einer Stelle, an der etwas passiert ist.
 *
 * **4. Wiederholung wird gebrochen, nicht ertragen.** Jeder Klang liegt in mehreren
 * Aufnahmen vor, und jede Wiedergabe zieht eine andere - nie zweimal dieselbe hintereinander.
 * Die haeufigen Klaenge bekommen zusaetzlich eine leichte Streuung in der Tonhoehe. Ohne
 * beides klingen hundert eingesammelte Muenzen je Welle wie ein Maschinengewehr, und genau
 * daran erkennt man ein Spiel, dessen Klang nachtraeglich angeklebt wurde.
 *
 * **5. Nichts geht direkt an den Ausgang.** Jede Stimme haengt an einer von drei Gruppen,
 * und die drei laufen ueber eine gemeinsame Bremse - siehe `app/mixer.ts`. Welcher Klang in
 * welche Gruppe faellt, steht im Klangplan; wie die Gruppen zusammengefuehrt und begrenzt
 * werden, steht dort. Die Trennung ist keine Formsache: Die Pegel muessen auch lesbar
 * bleiben, wenn diese Datei fehlt.
 */

import type { Unsubscribe } from '../core/events.ts'
import { createRng } from '../core/rng.ts'
import { asset } from './assets.ts'
import {
  BUSES,
  clampLevel,
  createMixer,
  defaultMix,
  type Bus,
  type MixLevels,
  type Mixer,
} from './mixer.ts'
import { createMusicBed, type MusicBed } from './musicbed.ts'
import { attachMood } from './musicplan.ts'
import {
  attachCues,
  busOfCue,
  createGate,
  DETUNED,
  SAMPLES,
  toneOf,
  type SoundCue,
} from './soundplan.ts'

/**
 * Was der Anschluss von aussen hergibt: die drei Pegel und das Abhaengen.
 *
 * Zurueckgelesen wird hier nichts - die Wahrheit ueber die Reglerstellung sind die
 * Geraeteeinstellungen (`app/settings.ts`), und die ueberleben diese Datei. Ein zweiter
 * Weg, denselben Wert zu erfahren, waere ein zweiter Weg, ihn falsch zu haben.
 */
export type Audio = {
  /** Pegel einer Gruppe setzen, 0 bis 1. */
  setLevel(bus: Bus, value: number): void
  /**
   * Wie viele Musikschleifen gerade wirklich laufen.
   *
   * Die einzige Auskunft, die dieser Anschluss nach aussen gibt - und sie ist keine
   * Bequemlichkeit, sondern die Zusage aus `app/musicbed.ts` in nachpruefbarer Form: Steht
   * der Musikregler auf null, ist diese Zahl null, und zwar weil die Quellen angehalten
   * wurden und nicht nur leise stehen. Ohne sie waere das eine Behauptung.
   */
  musicVoices(): number
  detach(): void
}

/** Wie viele Stimmen hoechstens gleichzeitig klingen duerfen. */
const MAX_VOICES = 16

/** Wie weit die Tonhoehe der haeufigen Klaenge streut - plus/minus vier Prozent. */
const DETUNE = 0.04

/**
 * Fester Startwert fuer die Auswahl der Variante und die Streuung der Tonhoehe.
 *
 * Ein eigener Strom, damit der Klang nicht am Wuerfel des Laufs zieht: Zwei Spielstaende mit
 * demselben Seed muessen dieselbe Beute auswerfen, und ob dabei die dritte oder die fuenfte
 * Muenzaufnahme lief, darf daran nichts aendern.
 */
const SEED = 0x5c01d

/**
 * Hat der Nutzer die Seite schon angefasst?
 *
 * Ein `AudioContext`, der vor der ersten Beruehrung entsteht, bleibt angehalten - und
 * Chrome schreibt eine Warnung in die Konsole. Beides ist unnoetig: Es gibt jetzt Zuhoerer
 * fuer Ereignisse, die frueh fallen koennen, und ein Klang, den ohnehin niemand hoert,
 * muss keinen Apparat aufbauen. Kennt der Browser die Auskunft nicht, wird wie bisher
 * verfahren - lieber ein Versuch zu viel als eine Stille, die niemand erklaeren kann.
 */
function pageWasTouched(): boolean {
  if (typeof navigator === 'undefined') return false
  const activation = (navigator as { userActivation?: { hasBeenActive?: boolean } }).userActivation
  if (!activation || typeof activation.hasBeenActive !== 'boolean') return true
  return activation.hasBeenActive
}

/**
 * Spaetestens nach so vielen Millisekunden muss ein Haeppchen des Musikaufbaus drankommen.
 *
 * Ohne Obergrenze koennte eine dauernd beschaeftigte Seite den Aufbau beliebig lange
 * hinausschieben - und beschaeftigt ist sie hier: Der Startbildschirm faehrt eine
 * Kamerafahrt, das Spiel baut sich auf, echten Leerlauf gibt es dabei kaum. Gemessen im
 * laufenden Spiel, vom Druck auf PRESS bis zum ersten Ton des Musikbetts: 3,5 s bei einer
 * Frist von 60 ms, 3,4 s bei 25 ms, 2,4 bis 3,2 s bei 10 ms.
 *
 * Weiter herunter waere kein Aufschub mehr. Der naheliegende Schritt - eine gewoehnliche
 * Zeitschaltung mit null Millisekunden - brauchte gerechnet eine halbe Sekunde, legt seine
 * Portionen aber **in** die Bilder statt zwischen sie, und genau das ist der Ruckler, um den
 * es hier geht. Zwei Sekunden ohne Musikbett merkt niemand; ein Bild, das ausfaellt, schon.
 */
const IDLE_TIMEOUT_MS = 10

/**
 * Das naechste Haeppchen des Musikaufbaus einplanen.
 *
 * `requestIdleCallback`, wo es ihn gibt: Er legt die Arbeit in die Luecke **nach** dem Bild
 * und nimmt damit keinem Zeichenschritt Zeit weg. Die Frist sorgt dafuer, dass er auch dann
 * faellt, wenn es nie eine Luecke gibt. Wo es ihn nicht gibt (Safari), ist eine gewoehnliche
 * Zeitschaltung der naechstbeste Weg: Sie unterbricht den Bildlauf ebenso wenig, sie liegt
 * nur nicht so guenstig.
 *
 * Was hier **nicht** steht, ist eine Bildschleife. Der Klang haengt an keiner, und eine
 * eigene aufzumachen, nur um einen Puffer zu rechnen, waere genau die Kopplung, die diese
 * Datei nicht haben soll.
 */
function nextSlice(again: () => void): void {
  const idle = (
    globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void }
  ).requestIdleCallback
  if (typeof idle === 'function') idle(() => again(), { timeout: IDLE_TIMEOUT_MS })
  else setTimeout(again, 0)
}

export function mountAudio(mix: MixLevels): Audio {
  const rng = createRng(SEED)

  let context: AudioContext | null = null
  let mixer: Mixer | null = null
  let music: MusicBed | null = null
  /**
   * Die Pegel, auch bevor es einen Klangapparat gibt.
   *
   * Der Apparat entsteht erst bei der ersten Beruehrung der Seite - die Regler stehen aber
   * schon vorher irgendwo. Diese Kopie ist die Wahrheit; das Pult bekommt sie beim Anlegen
   * gereicht und wird danach mitgefuehrt.
   */
  const levels: MixLevels = { ...defaultMix() }
  for (const bus of BUSES) levels[bus] = clampLevel(mix?.[bus], 0)
  let broken = false
  let voices = 0

  /** Die Wiederholsperren, eine je Klangart. Die Rechnung dahinter steht im Klangplan. */
  const gate = createGate()

  /**
   * Die Aufnahmen, je Klang eine Liste seiner Varianten.
   *
   * Geholt werden sie beim Anlegen des Apparats - also bei der ersten Beruehrung der Seite
   * und nicht beim Laden. Das ist Absicht: Der Klang darf den Start nicht aufhalten, und
   * bis zur ersten Beruehrung darf ohnehin nichts klingen.
   */
  const buffers = new Map<string, AudioBuffer[]>()

  /** Welche Variante zuletzt lief - damit nie zweimal dieselbe hintereinander kommt. */
  const lastTake = new Map<string, number>()

  /**
   * Den Klangapparat holen, notfalls anlegen.
   *
   * `touched` sagt: Der Aufrufer weiss aus eigener Anschauung, dass der Nutzer die Seite
   * angefasst hat - ein Zug am Regler ist so ein Fall. Ohne diese Auskunft wird der Browser
   * gefragt, und vor der ersten Beruehrung entsteht gar nichts.
   */
  function ensure(touched = false): AudioContext | null {
    if (broken) return null
    if (context) {
      // Ein angehaltener Apparat (Tab war weg) muss wieder anlaufen.
      if (context.state === 'suspended') void context.resume()
      return context
    }
    // Vor der ersten Beruehrung entsteht kein Apparat. Das ist keine Sparsamkeit, sondern
    // die Vermeidung einer Warnung ueber etwas, das gar nicht gewollt war: Mit `?noboot`
    // faellt der Startbildschirm weg, und dann meldet das Spiel seine ersten Ereignisse,
    // bevor irgendjemand geklickt hat.
    if (!touched && !pageWasTouched()) return null

    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        broken = true
        return null
      }
      context = new Ctor()
      // Drei Busse und die Bremse am Summenpunkt. Ab hier geht keine Stimme mehr direkt an
      // den Ausgang - das ist die ganze Zusage von `app/mixer.ts`.
      mixer = createMixer(context, levels)
      // Das Musikbett haengt am Musikbus wie jede andere Stimme auch. Es startet in der
      // Lage, in der das Spiel **jetzt** steht: Bis hierher ist die erste Welle laengst
      // gelaufen, und mit der Ruhelage einzusetzen waere schlicht falsch.
      //
      // Der dritte Wert ist der Grund, warum dieser Aufruf nichts kostet: Das Bett rechnet
      // seine Schleifen in Haeppchen und gibt zwischendurch ab (`app/musicbed.ts`). Diese
      // Stelle hier laeuft in der Startblende, also in dem Augenblick, in dem der Spieler
      // zum ersten Mal hinsieht - eine Achtelsekunde am Stueck waere hier ein Dutzend
      // ausgefallener Bilder.
      music = createMusicBed(context, mixer.bus('music'), nextSlice)
      music.setMood(mood.current())
      if (levels.music > 0) music.start()
      for (const [name, takes] of Object.entries(SAMPLES)) {
        for (let take = 1; take <= takes; take++) loadSample(context, name, take)
      }
      return context
    } catch {
      // Kein Klangapparat verfuegbar - das Spiel laeuft weiter, nur stumm.
      broken = true
      return null
    }
  }

  function loadSample(ctx: AudioContext, name: string, take: number): void {
    void fetch(asset(`sfx/${name}-${take}.wav`))
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(response.status)))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        const list = buffers.get(name)
        if (list) list.push(buffer)
        else buffers.set(name, [buffer])
      })
      .catch(() => {
        // Fehlt die Datei, bleibt es beim gerechneten Ton. Ein fehlendes Geraeusch darf nie
        // eine Fehlermeldung ergeben.
      })
  }

  /**
   * Ein kurzer gerechneter Ton - der Ersatz, solange eine Aufnahme fehlt.
   *
   * Er nimmt Klangart und Gruppe des Klangs, den er vertritt: Sonst laege der Ersatz an
   * einem anderen Regler als das Original und rutschte durch eine Sperre, die fuer ihn
   * nicht gedacht war.
   */
  function tone(cue: SoundCue): void {
    const ctx = ensure()
    if (!ctx || !mixer) return
    const bus = busOfCue(cue)
    // Ein stummer Bus baut auch keine Stimme auf. Das ist nicht nur sparsam: Die Zaehlung
    // der Stimmen ist gemeinsam, und eine unhoerbare wuerde einer hoerbaren den Platz
    // wegnehmen.
    if (levels[bus] <= 0) return
    if (voices >= MAX_VOICES) return
    if (!gate.allow(cue.kind, ctx.currentTime)) return

    const spec = toneOf(cue)
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = spec.type
    osc.frequency.setValueAtTime(spec.from, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), now + spec.seconds)

    // Sehr kurzer Anstieg, langer Ausklang: Das ist die Huellkurve, die einen Ton als
    // Schlag lesbar macht statt als Piepen.
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.peak), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.seconds)

    osc.connect(gain)
    gain.connect(mixer.bus(bus))
    osc.start(now)
    osc.stop(now + spec.seconds)

    voices += 1
    osc.onended = () => {
      voices -= 1
      gain.disconnect()
    }
  }

  /** Eine Aufnahme abspielen, sonst den gerechneten Ersatz. */
  function play(cue: SoundCue): void {
    const ctx = ensure()
    if (!ctx || !mixer) return
    const bus = busOfCue(cue)
    if (levels[bus] <= 0) return

    const takes = buffers.get(cue.sample)
    if (!takes || takes.length === 0) {
      // Noch nicht geladen oder nicht vorhanden: Der gerechnete Ton springt ein, damit im
      // ersten Augenblick nach dem Start nichts stumm bleibt.
      tone(cue)
      return
    }
    if (!gate.allow(cue.kind, ctx.currentTime)) return
    if (voices >= MAX_VOICES) return

    // Eine andere als beim letzten Mal. Bei nur einer Variante bleibt es notgedrungen bei
    // ihr - dann traegt die Streuung der Tonhoehe die Abwechslung allein.
    let index = rng.int(0, takes.length - 1)
    const previous = lastTake.get(cue.sample)
    if (takes.length > 1 && index === previous) index = (index + 1) % takes.length
    lastTake.set(cue.sample, index)

    const buffer = takes[index]
    if (!buffer) return

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    if (DETUNED.has(cue.sample)) source.playbackRate.value = rng.range(1 - DETUNE, 1 + DETUNE)
    gain.gain.value = cue.gain
    source.connect(gain)
    gain.connect(mixer.bus(bus))
    source.start()

    voices += 1
    source.onended = () => {
      voices -= 1
      gain.disconnect()
    }
  }

  /*
   * Die Spiellage - dieselbe Bauart wie beim Klangplan.
   *
   * Welches Ereignis welche Lage einschaltet, entscheidet `app/musicplan.ts`. Hier wird nur
   * weitergereicht, und zwar auch dann, wenn es noch gar keinen Klangapparat gibt: Die Lage
   * wird trotzdem mitgefuehrt, damit die Musik spaeter richtig einsetzt.
   */
  const mood = attachMood((next) => music?.setMood(next))

  /*
   * Der Anschluss selbst - eine einzige Zeile.
   *
   * Welches Ereignis dabei einen Zuhoerer bekommt, entscheidet der Klangplan und nichts
   * hier. Das ist der Punkt: Solange die Liste dort und die Anmeldung hier dieselbe Schleife
   * sind, kann die gepruefte Abdeckung nicht von der wirklichen abweichen.
   */
  const stops: Unsubscribe[] = attachCues(play)

  return {
    setLevel(bus, value) {
      levels[bus] = clampLevel(value, 0)
      // Der Apparat entsteht erst bei der ersten Beruehrung. Ein Zug am Regler ist eine -
      // also darf hier angelegt werden, und der Spieler hoert die Aenderung sofort.
      if (levels[bus] > 0) ensure(true)
      mixer?.setLevel(bus, levels[bus])
      // Stumme Musik laeuft nicht leise mit, sie laeuft gar nicht: Drei Schleifen, die
      // niemand hoert, kosten auf einem Telefon dieselbe Rechenzeit wie drei, die jemand
      // hoert. Das ist die Zusage aus `app/musicbed.ts`, hier ist ihr Schalter.
      if (bus === 'music') {
        if (levels.music > 0) music?.start()
        else music?.stop()
      }
    },
    musicVoices: () => music?.voices() ?? 0,
    detach() {
      for (const stop of stops) stop()
      for (const stop of mood.stops) stop()
      music?.dispose()
      music = null
      mixer?.disconnect()
      try {
        void context?.close()
      } catch {
        // schon geschlossen
      }
      context = null
      mixer = null
    },
  }
}
