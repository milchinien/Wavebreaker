/**
 * Die Zeitquelle des Spiels.
 *
 * Regel aus dem Implementierungsplan (Abschnitt 3): Niemand ausserhalb dieser Datei
 * ruft `Date.now()` oder `performance.now()` auf. Alles, was Zeit braucht, bekommt sie
 * als `dt` in den Tick gereicht oder fragt `Loop.now()`.
 *
 * Die Simulation laeuft mit festen Schritten (Standard 60/s), entkoppelt vom Zeichnen.
 * Geschwindigkeit x2/x4 bedeutet **mehr Ticks pro Bild**, niemals groessere Schritte
 * (GDD 16 Abschnitt 12).
 */

export type SpeedFactor = 1 | 2 | 4

export type TickFn = (dt: number) => void
/**
 * `alpha` ist der Rest im Akkumulator, 0..1 - fuer weiche Zwischenbilder.
 * `frameSeconds` ist die **echte** vergangene Zeit seit dem letzten Bild, unabhaengig von
 * der Spielgeschwindigkeit. Alles rein Optische (Kamerafahrt, Einblendungen) rechnet damit,
 * damit es bei x4 nicht viermal so schnell laeuft.
 */
export type RenderFn = (alpha: number, frameSeconds: number) => void

/**
 * Quelle fuer Einzelbilder. Im Browser `requestAnimationFrame`, im Test ein
 * handgesteuerter Ersatz. Der Zeitstempel kommt aus dem Aufruf, damit die Schleife
 * selbst keine Uhr befragen muss.
 */
export type FrameScheduler = {
  request(callback: (timestampMs: number) => void): number
  cancel(handle: number): void
}

export type LoopOptions = {
  /** Simulationsschritte pro Sekunde. Standard 60. */
  tickRate?: number
  /**
   * Groesste Zeitspanne, die ein einzelnes Bild nachholen darf. Schuetzt davor, dass
   * ein weggeschalteter Tab beim Zurueckkommen tausende Ticks am Stueck ausloest.
   */
  maxFrameSeconds?: number
  /** Harte Obergrenze an Ticks je Bild. Verhindert die Todesspirale bei Ueberlast. */
  maxTicksPerFrame?: number
  scheduleFrame?: FrameScheduler
  /** Echte Uhrzeit in Millisekunden. Nur fuer die Offline-Berechnung. */
  wallClock?: () => number
}

export type Loop = {
  start(tick: TickFn, render: RenderFn): void
  stop(): void
  isRunning(): boolean
  setSpeed(factor: SpeedFactor): void
  getSpeed(): SpeedFactor
  /** Die Spielzeit in Sekunden seit Start der Schleife. Steigt mit der Geschwindigkeit. */
  now(): number
  /** Echte Uhrzeit in Millisekunden. Ausschliesslich fuer Abwesenheitsberechnung. */
  wallClock(): number
  /** Anzahl ausgefuehrter Simulationsschritte seit Start. */
  tickCount(): number
  /** Gemessene Bilder pro Sekunde, gleitend. */
  fps(): number
  /** Laenge eines Simulationsschritts in Sekunden. */
  readonly stepSeconds: number
  readonly tickRate: number
}

const DEFAULT_TICK_RATE = 60
const DEFAULT_MAX_FRAME_SECONDS = 0.25
const DEFAULT_MAX_TICKS_PER_FRAME = 300

function browserScheduler(): FrameScheduler {
  return {
    request: (cb) => requestAnimationFrame(cb),
    cancel: (handle) => cancelAnimationFrame(handle),
  }
}

export function createLoop(options: LoopOptions = {}): Loop {
  const tickRate = options.tickRate ?? DEFAULT_TICK_RATE
  const stepSeconds = 1 / tickRate
  const maxFrameSeconds = options.maxFrameSeconds ?? DEFAULT_MAX_FRAME_SECONDS
  const maxTicksPerFrame = options.maxTicksPerFrame ?? DEFAULT_MAX_TICKS_PER_FRAME
  const scheduler = options.scheduleFrame ?? browserScheduler()
  const clock = options.wallClock ?? (() => Date.now())

  let speed: SpeedFactor = 1
  let simTime = 0
  let ticks = 0
  let accumulator = 0
  let running = false
  let handle = 0
  let lastTimestamp: number | null = null
  let smoothedFps = 0

  let onTick: TickFn = () => {}
  let onRender: RenderFn = () => {}

  function frame(timestampMs: number): void {
    if (!running) return

    // Das erste Bild setzt nur den Nullpunkt - es darf keinen Sprung erzeugen.
    if (lastTimestamp === null) {
      lastTimestamp = timestampMs
      handle = scheduler.request(frame)
      return
    }

    const rawSeconds = (timestampMs - lastTimestamp) / 1000
    lastTimestamp = timestampMs

    if (rawSeconds > 0) {
      const instantFps = 1 / rawSeconds
      smoothedFps = smoothedFps === 0 ? instantFps : smoothedFps * 0.9 + instantFps * 0.1
    }

    const frameSeconds = Math.min(Math.max(rawSeconds, 0), maxFrameSeconds)
    accumulator += frameSeconds * speed

    let ticksThisFrame = 0
    while (accumulator >= stepSeconds) {
      if (ticksThisFrame >= maxTicksPerFrame) {
        // Ueberlast: den Rest verwerfen statt ihn vor sich herzuschieben.
        accumulator = 0
        break
      }
      accumulator -= stepSeconds
      simTime += stepSeconds
      ticks += 1
      ticksThisFrame += 1
      onTick(stepSeconds)
    }

    onRender(accumulator / stepSeconds, frameSeconds)
    handle = scheduler.request(frame)
  }

  return {
    start(tick, render) {
      if (running) return
      onTick = tick
      onRender = render
      running = true
      lastTimestamp = null
      handle = scheduler.request(frame)
    },
    stop() {
      if (!running) return
      running = false
      scheduler.cancel(handle)
      lastTimestamp = null
    },
    isRunning: () => running,
    setSpeed(factor) {
      speed = factor
    },
    getSpeed: () => speed,
    now: () => simTime,
    wallClock: () => clock(),
    tickCount: () => ticks,
    fps: () => smoothedFps,
    stepSeconds,
    tickRate,
  }
}

/**
 * Bildquelle fuer Tests: Bilder werden von Hand ausgeloest, die Zeit springt genau so
 * weit, wie der Test es vorgibt. Damit ist "60 Ticks pro Sekunde" pruefbar statt
 * geschaetzt.
 */
export type ManualScheduler = FrameScheduler & {
  /** Ein einzelnes Bild, `deltaMs` nach dem vorherigen. */
  advance(deltaMs: number): void
  /** Mehrere gleich lange Bilder hintereinander. */
  advanceBy(totalMs: number, frameMs: number): void
  timestamp(): number
}

export function createManualScheduler(startMs = 0): ManualScheduler {
  let time = startMs
  let pending: ((timestampMs: number) => void) | null = null
  let nextHandle = 1

  return {
    request(callback) {
      pending = callback
      return nextHandle++
    },
    cancel() {
      pending = null
    },
    advance(deltaMs) {
      time += deltaMs
      const callback = pending
      pending = null
      callback?.(time)
    },
    advanceBy(totalMs, frameMs) {
      const frames = Math.round(totalMs / frameMs)
      for (let i = 0; i < frames; i++) this.advance(frameMs)
    },
    timestamp: () => time,
  }
}
