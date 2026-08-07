/**
 * Klang (GDD 13 Abschnitt 11).
 *
 * **Diese Datei wird angeschlossen, nicht eingebaut.** Sie kennt keine Spielregel und wird
 * von nichts eingebunden ausser `main.ts`: Sie haengt sich an den Ereignisbus, der seit E0
 * jeden bedeutsamen Vorgang meldet, und macht daraus Toene. Wer sie loescht, veraendert am
 * Spiel nichts ausser der Stille. Genau dafuer gibt es den Bus seit der ersten Etappe.
 *
 * Drei Regeln bestimmen den Aufbau:
 *
 * **1. Toene werden begrenzt, nicht gestapelt.** Ein Autocannon feuert sechs Schuss je
 * Sekunde, bei vier Tuermen sind das vierundzwanzig - und bei Tempo x4 knapp hundert. Ohne
 * Begrenzung waere das kein Klang, sondern ein Rauschen, das den Rest zudeckt. Jede
 * Klangart hat deshalb einen Mindestabstand, und wer zu frueh kommt, faellt aus (GDD 13
 * Abschnitt 11: "Ausduennen bei x2/x4").
 *
 * **2. Der Ton kommt spaet.** Browser verbieten Klang, bevor der Nutzer die Seite
 * angefasst hat. Der Klangapparat entsteht deshalb erst bei der ersten Beruehrung; bis
 * dahin verfallen alle Meldungen still. Ein Fehler dabei schaltet den Klang ab und laesst
 * das Spiel unberuehrt weiterlaufen - Stille ist ein hinnehmbarer Zustand, ein Absturz
 * nicht.
 *
 * **3. Die Toene sind gerechnet, nicht geladen** - mit einer Ausnahme. Ein Klangapparat
 * aus Oszillatoren braucht keine Dateien und keine Ladezeit, und er trifft die Neon-Optik
 * besser als ein Sammelsurium aus fremden Aufnahmen. Nur das Einsammeln von Gold benutzt
 * die mitgelieferte Aufnahme (`public/sfx/coin.ogg`, siehe `docs/anlagen.md`): Es ist der
 * eine Klang, den der Spieler hundertmal je Welle hoert, und ein gerechneter Piepton wuerde
 * dort schnell laestig.
 */

import { on, type Unsubscribe } from '../core/events.ts'

export type Audio = {
  /** Lautstaerke von 0 bis 1. */
  setVolume(value: number): void
  volume(): number
  detach(): void
}

/**
 * Kuerzester Abstand zwischen zwei Toenen derselben Art, in echten Sekunden.
 *
 * Sie stehen hier und nicht in `data/balance.ts`, weil sie keine Spielregel sind: Wer sie
 * aendert, veraendert kein Kraefteverhaeltnis, sondern nur, wie voll es klingt.
 */
const THROTTLE: Record<string, number> = {
  shot: 0.07,
  hit: 0.05,
  kill: 0.06,
  coin: 0.09,
  damage: 0.12,
}

/** Wie viele Stimmen hoechstens gleichzeitig klingen duerfen. */
const MAX_VOICES = 16

/**
 * Die mitgelieferten Aufnahmen (`docs/anlagen.md`).
 *
 * Nur zwei, und beide fuer dasselbe: das Aufheben von etwas. Es ist der Klang, den der
 * Spieler am haeufigsten hoert, und ein gerechneter Piepton wuerde dort schnell laestig.
 */
const SAMPLES: Record<string, string> = {
  coin: '/sfx/coin.ogg',
  pod: '/sfx/pod.ogg',
}

type Voice = { osc: OscillatorNode; gain: GainNode }

export function mountAudio(volume: number): Audio {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let level = clamp01(volume)
  let broken = false
  let voices = 0

  /** Zeitpunkt des letzten Tons je Art, in Sekunden der Audio-Uhr. */
  const lastAt = new Map<string, number>()

  /**
   * Die mitgelieferten Aufnahmen. Sie werden beim Anlegen des Apparats geholt und bleiben
   * dann im Speicher - zusammen sechzig Kilobyte fuer die beiden Klaenge, die der Spieler
   * am haeufigsten hoert.
   */
  const buffers = new Map<string, AudioBuffer>()

  function ensure(): AudioContext | null {
    if (broken) return null
    if (context) {
      // Ein angehaltener Apparat (Tab war weg) muss wieder anlaufen.
      if (context.state === 'suspended') void context.resume()
      return context
    }

    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        broken = true
        return null
      }
      context = new Ctor()
      master = context.createGain()
      master.gain.value = level
      master.connect(context.destination)
      for (const [name, path] of Object.entries(SAMPLES)) loadSample(context, name, path)
      return context
    } catch {
      // Kein Klangapparat verfuegbar - das Spiel laeuft weiter, nur stumm.
      broken = true
      return null
    }
  }

  function loadSample(ctx: AudioContext, name: string, path: string): void {
    void fetch(path)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(response.status)))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(name, buffer)
      })
      .catch(() => {
        // Fehlt die Datei, bleibt es beim gerechneten Ton. Ein fehlendes Geraeusch darf nie
        // eine Fehlermeldung ergeben.
      })
  }

  /** Darf jetzt ein Ton dieser Art kommen, oder war der letzte zu kurz her? */
  function allow(kind: string, now: number): boolean {
    const gap = THROTTLE[kind] ?? 0
    const last = lastAt.get(kind)
    if (last !== undefined && now - last < gap) return false
    lastAt.set(kind, now)
    return true
  }

  /**
   * Ein kurzer Ton. `from`/`to` sind die Tonhoehen in Hertz - ein Rutsch nach unten klingt
   * nach Einschlag, einer nach oben nach Belohnung.
   */
  function tone(
    kind: string,
    from: number,
    to: number,
    seconds: number,
    peak: number,
    type: OscillatorType = 'triangle',
  ): void {
    const ctx = ensure()
    if (!ctx || !master) return
    if (level <= 0) return
    if (voices >= MAX_VOICES) return
    if (!allow(kind, ctx.currentTime)) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(from, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + seconds)

    // Sehr kurzer Anstieg, langer Ausklang: Das ist die Huellkurve, die einen Ton als
    // Schlag lesbar macht statt als Piepen.
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)

    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + seconds)

    voices += 1
    const voice: Voice = { osc, gain }
    osc.onended = () => {
      voices -= 1
      voice.gain.disconnect()
    }
  }

  /** Eine mitgelieferte Aufnahme, sonst ein gerechneter Ersatz. */
  function sample(kind: string, name: string, gainValue: number): void {
    const ctx = ensure()
    if (!ctx || !master || level <= 0) return

    const buffer = buffers.get(name)
    if (!buffer) {
      // Noch nicht geladen oder nicht vorhanden: Der gerechnete Ton springt ein, damit im
      // ersten Augenblick nach dem Start nichts stumm bleibt.
      tone(kind, 880, 1500, 0.08, 0.1, 'square')
      return
    }
    if (!allow(kind, ctx.currentTime)) return

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = gainValue
    source.connect(gain)
    gain.connect(master)
    source.start()
    source.onended = () => gain.disconnect()
  }

  /*
   * Der Anschluss selbst. Jede Zeile ist ein Ereignis, das es seit seiner Etappe gibt -
   * hier wird nichts gemeldet, nur zugehoert.
   */
  const stops: Unsubscribe[] = [
    on('tower.fired', (payload) => {
      // Ein kritischer Treffer klingt hoeher und kuerzer - dieselbe Aussage wie der
      // groessere Blitz auf dem Feld.
      if (payload.crit) tone('shot', 900, 420, 0.07, 0.05, 'square')
      else tone('shot', 620, 300, 0.06, 0.035, 'square')
    }),
    on('enemy.killed', () => tone('kill', 340, 120, 0.12, 0.05, 'sawtooth')),
    on('boss.killed', () => tone('boss', 220, 60, 0.9, 0.14, 'sawtooth')),
    on('boss.spawned', () => tone('boss', 90, 200, 0.7, 0.12, 'sawtooth')),
    on('station.damaged', () => tone('damage', 180, 70, 0.16, 0.09, 'square')),
    on('station.destroyed', () => tone('lost', 240, 40, 1.1, 0.16, 'sawtooth')),
    on('gold.collected', () => sample('coin', 'coin', 0.35)),
    on('pod.collected', () => sample('pod', 'pod', 0.5)),
    on('pod.dropped', () => tone('pod', 700, 420, 0.2, 0.07)),
    on('upgrade.bought', () => tone('ui', 520, 780, 0.12, 0.08)),
    on('tower.bought', () => tone('ui', 440, 880, 0.2, 0.1)),
    on('level.up', () => tone('level', 520, 1040, 0.35, 0.12)),
    on('ability.activated', () => tone('ability', 300, 900, 0.3, 0.12)),
    on('ability.ready', () => tone('ui', 780, 980, 0.1, 0.06)),
    on('wave.started', () => tone('wave', 180, 320, 0.28, 0.07)),
    on('wave.cleared', () => tone('wave', 620, 880, 0.22, 0.08)),
    on('event.triggered', () => tone('event', 260, 660, 0.45, 0.12)),
    // Die Drohne meldet sich beim Landen - sie steht am Rand, und ohne Ton uebersieht man
    // sie, waehrend vorne die Welle laeuft.
    on('trader.arrived', () => tone('trader', 400, 700, 0.5, 0.11)),
    on('trader.bought', () => tone('ui', 480, 820, 0.16, 0.09)),
    on('prestige.done', () => tone('prestige', 160, 900, 1.2, 0.16)),
  ]

  return {
    setVolume(value) {
      level = clamp01(value)
      if (master) master.gain.value = level
      // Der Apparat entsteht erst bei der ersten Beruehrung. Ein Zug am Regler ist eine -
      // also darf hier angelegt werden, und der Spieler hoert die Aenderung sofort.
      if (level > 0) ensure()
    },
    volume: () => level,
    detach() {
      for (const stop of stops) stop()
      try {
        void context?.close()
      } catch {
        // schon geschlossen
      }
      context = null
      master = null
    },
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
