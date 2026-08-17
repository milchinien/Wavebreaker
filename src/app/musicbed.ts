/**
 * Das Musikbett: drei Schleifen, die dauernd laufen, und eine Blende je Schicht.
 *
 * **Diese Datei wird angeschlossen, nicht eingebaut.** Sie kennt keine Spielregel und wird
 * von nichts eingebunden ausser `app/audio.ts`. Wer sie loescht, bekommt ein Spiel ohne
 * Musikbett und sonst nichts - keinen Fehler, keine Luecke im Ablauf. Genau wie beim Klang
 * ist Stille ein hinnehmbarer Zustand.
 *
 * **Was hier steht und was nicht.** Hier steht der Apparat: Puffer anlegen, Quellen starten,
 * Pegel fahren, Quellen wieder abraeumen. Welche Toene in welcher Schicht liegen, wie lang
 * die Schleife ist und welche Mischung zu welcher Spiellage gehoert, steht in
 * `app/musicplan.ts` - als Zahlen, die sich ohne Browser nachrechnen lassen.
 *
 * ---
 *
 * **Vier Regeln bestimmen den Aufbau.**
 *
 * **1. Drei Schleifen, nicht drei Stuecke.** Alle Schichten sind gleich lang, starten im
 * selben Augenblick und laufen dauernd durch. Ein Lagenwechsel ist deshalb nur eine
 * Pegelfahrt - die Schichten bleiben taktgleich, egal wie oft gewechselt wird. Zwei
 * getrennte Stuecke haetten bei jedem Wechsel eine andere Taktlage, und jeder Wechsel waere
 * ein Stolpern.
 *
 * **2. Es wird ueberblendet, nie geschnitten.** Jede Schicht haengt an ihrem eigenen
 * `GainNode`; ein Wechsel faehrt alle drei gleichzeitig ueber {@link FADE_SECONDS} auf ihre
 * neuen Werte. Weil die Flaeche in **jeder** Mischung ueber 0,4 steht (`app/musicplan.ts`),
 * kann dabei kein Loch entstehen.
 *
 * **3. Kein Ton laeuft, wenn niemand ihn hoert.** Steht der Musikregler auf null, werden die
 * Quellen nicht leise gestellt, sondern **angehalten und getrennt**. Ein stummer, aber
 * laufender Oszillator kostet auf jedem Geraet dieselbe Rechenzeit wie ein hoerbarer, und
 * das auf einem Telefon, dessen Besitzer den Ton gerade ausgemacht hat. {@link MusicBed.voices}
 * gibt die Zahl der wirklich laufenden Quellen zurueck - damit ist das nachpruefbar und
 * nicht nur behauptet.
 *
 * **4. Nichts geschieht je Bild.** Das Musikbett haengt an keiner Bildschleife und an keinem
 * Zeitgeber. Es tut etwas, wenn sich die Lage aendert - also ein paar Mal je Welle - und
 * sonst nie. Was die Schleifen wiederholt, ist der `loop`-Schalter der Quelle, und der laeuft
 * im Klangfaden des Browsers, nicht im Bild.
 *
 * **5. Der Aufbau haelt den Hauptfaden nicht an.** Die drei Schleifen zu rechnen kostet eine
 * gute Achtelsekunde, und sie faellt genau dann an, wenn der Spieler gerade gedrueckt hat -
 * also mitten in der Startblende. Am Stueck gerechnet waren das gemessen **223 ms** am Stueck
 * (`PerformanceObserver`, `longtask`) und damit rund ein Dutzend ausgefallener Bilder in dem
 * Augenblick, in dem der Spieler zum ersten Mal hinsieht. Deshalb rechnet {@link MusicBed.start}
 * nicht mehr selbst: Es nimmt den Plan aus `app/musicplan.ts` und arbeitet ihn in Portionen
 * von hoechstens `SLICE_SAMPLES` Abtastwerten ab, zwischen denen der Aufrufer das Bild
 * zeichnen kann ({@link Later}). Gemessen im laufenden Spiel sind das 54 Portionen, die
 * laengste 15 bis 33 ms je nachdem, wie beschaeftigt der Rechner sonst ist - und keine
 * einzige `longtask`-Meldung mehr. Die Quellen laufen an, wenn der Puffer steht: zwei bis
 * drei Sekunden nach dem Druck auf PRESS. Das merkt niemand, ein ausgefallenes Bild schon.
 *
 * Wer keinen Aufschub reicht, bekommt wie bisher die ganze Rechnung in einem Zug; das ist der
 * Weg fuer den Selbsttest und die Messseiten, wo niemand auf ein Bild wartet.
 */

import {
  FADE_SECONDS,
  LAYERS,
  LOOP_SECONDS,
  MIX,
  planScore,
  type LayerId,
  type Mood,
  type ScoreJob,
} from './musicplan.ts'

/**
 * Ein Aufschub: "ruf das gleich noch einmal auf, aber nicht jetzt".
 *
 * Das ist die ganze Schnittstelle zum Aufrufer, und sie ist mit Absicht so schmal. Ob das
 * naechste Haeppchen in einer Leerlaufzeit des Browsers, im naechsten Bild oder in einer
 * Zeitschaltung faellt, entscheidet `app/audio.ts` - hier steht nur, dass zwischen zwei
 * Haeppchen etwas anderes drankommen darf. Wer nichts reicht, bekommt die ganze Rechnung in
 * einem Zug.
 */
export type Later = (again: () => void) => void

export type MusicBed = {
  /**
   * Die Schleifen anwerfen. Laufen sie schon, geschieht nichts.
   *
   * Steht der Puffer noch nicht und ist ein {@link Later} im Spiel, kehrt der Aufruf sofort
   * zurueck und die Quellen laufen an, sobald gerechnet ist - {@link MusicBed.voices} ist bis
   * dahin null. Ohne Aufschub wird gerechnet und gestartet, bevor der Aufruf zurueckkehrt.
   *
   * `when` gibt es fuer die Messung im `OfflineAudioContext`: Dort steht `currentTime` beim
   * Aufbau auf null, und alles muss von Hand auf die Zeitachse gelegt werden. Es wirkt nur
   * auf dem ungeteilten Weg - ein Zeitpunkt, der vor dem Ende der Rechnung liegt, waere
   * hinterher ohnehin Vergangenheit.
   */
  start(when?: number): void
  /** Die Lage wechseln - ueberblendet ueber {@link FADE_SECONDS}. */
  setMood(mood: Mood, when?: number): void
  mood(): Mood
  /** Wie viele Quellen gerade wirklich laufen. Null heisst: kein Ton, keine Rechenzeit. */
  voices(): number
  /** Ausblenden und abraeumen. Danach ist {@link MusicBed.voices} null. */
  stop(when?: number): void
  /** Endgueltig - auch die Puffer werden losgelassen. */
  dispose(): void
}

/**
 * Wie schnell das Bett verschwindet, wenn der Regler auf null geht.
 *
 * Kuerzer als eine Ueberblendung: Hier geht es nicht um einen Uebergang, sondern darum,
 * dass ein Abschalten nicht knackt. Ein Viertel einer Sekunde ist zu kurz, um als Blende
 * aufzufallen, und lang genug, um die Flanke zu brechen.
 */
const STOP_SECONDS = 0.25

export function createMusicBed(
  context: BaseAudioContext,
  destination: AudioNode,
  later?: Later,
): MusicBed {
  /** Die Schleifen. Sie entstehen erst beim ersten Anwerfen - vorher hoert sie ohnehin niemand. */
  let buffers: Record<LayerId, AudioBuffer> | null = null

  const gains = {} as Record<LayerId, GainNode>
  for (const id of LAYERS) {
    const gain = context.createGain()
    gain.gain.value = 0
    gain.connect(destination)
    gains[id] = gain
  }

  /**
   * Was auf einem Pegel gerade laeuft - eine Rampe von `from` nach `to`, ab `at`, ueber
   * `seconds`.
   *
   * **Warum das Bett mitschreibt, statt den Browser zu fragen.** Der naheliegende Weg waere
   * `AudioParam.cancelAndHoldAtTime`: Er soll die laufende Rampe an einer Stelle festhalten,
   * damit die naechste dort ansetzt. Er wurde eingebaut, gemessen und wieder ausgebaut -
   * Chrome haelt nichts fest, sondern faehrt die neue Rampe vom **letzten gesetzten Wert**
   * los. Gemessen mit `public/musikmessung.html`: Ein Wechsel bei Sekunde 6 auf eine Blende
   * von 1,2 s ergab eine Blende von 6,2 s, die bei Sekunde 0 begann - also genau das
   * Gegenteil eines Uebergangs, naemlich eine Fahrt ueber das halbe Stueck.
   *
   * Der andere naheliegende Weg, `gain.value` zu lesen, geht auch nicht: In einem
   * `OfflineAudioContext` steht die Uhr beim Aufbau auf null, und der abgelesene Wert
   * gehoert dann zu einem Augenblick, der mit dem geplanten nichts zu tun hat.
   *
   * Also rechnet das Bett selbst. Es weiss, was es angeordnet hat - das ist die einzige
   * Auskunft, die in beiden Kontexten dasselbe bedeutet.
   */
  type Ramp = { from: number; to: number; at: number; seconds: number }
  const ramps = {} as Record<LayerId, Ramp>
  for (const id of LAYERS) ramps[id] = { from: 0, to: 0, at: 0, seconds: 0 }

  let sources: Record<LayerId, AudioBufferSourceNode> | null = null
  let running = 0
  let current: Mood = 'ruhe'
  let dead = false

  /*
   * Der Stand der Rechnung.
   *
   * `job` ist der Plan aus `app/musicplan.ts`, `cursor` der naechste Schritt darin. `wanted`
   * ist die Frage, die waehrend der Rechnung offen bleibt: Will der Spieler ueberhaupt noch
   * Musik? Wer den Regler waehrend des Aufbaus wieder auf null zieht, bekommt am Ende keine
   * Quelle - sonst faengt das Bett eine Sekunde nach dem Abschalten von selbst an.
   *
   * `handed` merkt sich, ob unterwegs wirklich abgegeben wurde. Nur dann startet das Bett am
   * Ende von sich aus; lief alles in einem Zug durch, tut das der Aufruf von `start` selbst -
   * und zwar mit dem Zeitpunkt, den er bekommen hat.
   */
  let job: ScoreJob | null = null
  let cursor = 0
  let wanted = false
  let handed = false
  /** Laeuft gerade eine Rechnung? Ein zweiter Reglerzug soll keine zweite anwerfen. */
  let busy = false

  /**
   * Die Rechnung anstossen. Ohne {@link Later} laeuft sie hier zu Ende.
   *
   * Mit Aufschub geschieht hier **nichts** ausser dem Aufschub selbst: Auch das Planen legt
   * schon zwoelf Megabyte an, und das ist der Aufruf, der im Spiel aus einem Klangereignis
   * heraus faellt - also aus einem Bild, das gerade gezeichnet wird.
   */
  function begin(): void {
    if (dead || buffers || busy) return
    busy = true
    handed = false
    if (later) {
      handed = true
      later(makePlan)
      return
    }
    makePlan()
  }

  /** Die Puffer anlegen und die Schrittliste bauen. Rechnet noch keinen Abtastwert. */
  function makePlan(): void {
    if (dead || buffers) return
    try {
      job = planScore(context.sampleRate)
    } catch {
      // Kein Speicher fuer die Puffer - dann eben kein Musikbett.
      dead = true
      busy = false
      return
    }
    cursor = 0
    if (later) later(pump)
    else pump()
  }

  /**
   * Eine Portion rechnen - und dann abgeben, falls es jemanden gibt, an den abzugeben ist.
   *
   * Wie gross eine Portion ist, entscheidet die Partitur (`ScoreJob.slice`), nicht diese
   * Datei: Dort steht der Aufwand jedes Schritts in Abtastwerten, und dort laesst er sich
   * auch nachrechnen. Hier steht nur die Abfolge.
   */
  function pump(): void {
    const plan = job
    if (dead || !plan) return
    try {
      while (cursor < plan.size) {
        cursor = plan.slice(cursor)
        if (cursor < plan.size && later) {
          handed = true
          later(pump)
          return
        }
      }
    } catch {
      // Eine Rechnung, die scheitert, ist ein fehlendes Geraeusch und kein Fehler.
      dead = true
      job = null
      busy = false
      return
    }
    finish(plan)
  }

  /** Aus den fertigen Abtastwerten Klangpuffer machen - und, wenn noetig, anlaufen. */
  function finish(plan: ScoreJob): void {
    job = null
    busy = false
    const rendered = plan.result()
    try {
      const made = {} as Record<LayerId, AudioBuffer>
      for (const id of LAYERS) {
        const [left, right] = rendered[id]
        const buffer = context.createBuffer(2, left.length, context.sampleRate)
        buffer.copyToChannel(left, 0)
        buffer.copyToChannel(right, 1)
        made[id] = buffer
      }
      buffers = made
    } catch {
      // Kein Puffer - dann eben kein Musikbett. Ein fehlender Klang ist nie ein Fehler.
      dead = true
      return
    }
    // Nur wenn unterwegs abgegeben wurde: Sonst wartet der Aufruf von `start` noch auf uns
    // und legt die Quellen gleich selbst auf seinen Zeitpunkt.
    if (handed && wanted && !sources) launch(context.currentTime)
  }

  /** Wo eine Rampe zu einem Zeitpunkt steht. */
  function valueAt(ramp: Ramp, time: number): number {
    if (time <= ramp.at) return ramp.from
    if (ramp.seconds <= 0 || time >= ramp.at + ramp.seconds) return ramp.to
    return ramp.from + ((ramp.to - ramp.from) * (time - ramp.at)) / ramp.seconds
  }

  /**
   * Den Pegel einer Schicht auf einen Wert fahren, ohne Sprung.
   *
   * Der Wert, bei dem die neue Rampe ansetzt, ist der, an dem die alte zu diesem Zeitpunkt
   * steht - selbst gerechnet, siehe {@link Ramp}. Wer mitten in einer Blende die Lage
   * wechselt, bekommt damit eine Blende von dort, wo es gerade ist, und keinen Sprung.
   */
  function ride(id: LayerId, target: number, at: number, seconds: number): void {
    const gain = gains[id].gain
    const held = valueAt(ramps[id], at)
    gain.cancelScheduledValues(at)
    gain.setValueAtTime(held, at)
    gain.linearRampToValueAtTime(target, at + seconds)
    ramps[id] = { from: held, to: target, at, seconds }
  }

  /** Die Quellen wirklich anwerfen. Setzt fertige Puffer voraus. */
  function launch(at: number): void {
    const made = buffers
    if (dead || sources || !made) return

    // Die Schleife laeuft weiter, auch wenn gerade keine Quelle daran haengt: Wer den
    // Regler kurz auf null zieht und wieder hoch, soll dort einsteigen, wo das Stueck
    // inzwischen stuende - und nicht das Bett von vorn beginnen hoeren.
    const offset = at % LOOP_SECONDS

    const started = {} as Record<LayerId, AudioBufferSourceNode>
    for (const id of LAYERS) {
      const source = context.createBufferSource()
      source.buffer = made[id]
      source.loop = true
      source.loopStart = 0
      source.loopEnd = made[id].duration
      source.connect(gains[id])
      source.onended = () => {
        running = Math.max(0, running - 1)
      }
      source.start(at, offset)
      started[id] = source
      running += 1

      // Von null herauf: Der erste Ton des Spiels soll nicht mit voller Breite einsetzen.
      ramps[id] = { from: 0, to: 0, at, seconds: 0 }
      ride(id, MIX[current][id], at, FADE_SECONDS)
    }
    sources = started
  }

  return {
    start(when) {
      if (dead || sources) return
      wanted = true
      if (!buffers) {
        begin()
        // Steht der Puffer immer noch nicht, wird gerade gerechnet: Dann laufen die Quellen
        // in `finish` an, nicht hier.
        if (!buffers) return
      }
      launch(when ?? context.currentTime)
    },

    setMood(mood, when) {
      current = mood
      if (!sources) return
      const at = when ?? context.currentTime
      for (const id of LAYERS) ride(id, MIX[mood][id], at, FADE_SECONDS)
    },

    mood: () => current,
    voices: () => running,

    stop(when) {
      // Auch wenn noch gar nichts laeuft: Wer waehrend des Aufbaus abschaltet, darf nicht
      // eine Sekunde spaeter von der fertig gerechneten Musik ueberrascht werden.
      wanted = false
      if (!sources) return
      const at = when ?? context.currentTime
      for (const id of LAYERS) ride(id, 0, at, STOP_SECONDS)
      for (const id of LAYERS) sources[id].stop(at + STOP_SECONDS)
      sources = null
    },

    dispose() {
      // Zuerst: Eine laufende Rechnung darf nach dem Abraeumen keinen Schritt mehr tun. Der
      // naechste Aufschub kommt vielleicht noch an - er findet dann `dead` vor und kehrt um.
      wanted = false
      busy = false
      job = null
      if (sources) {
        for (const id of LAYERS) {
          try {
            sources[id].stop()
          } catch {
            // War schon angehalten - das ist kein Fehler, sondern der Normalfall.
          }
          sources[id].disconnect()
        }
        sources = null
      }
      // Auch wenn schon `stop` gelaufen war: Nach dem Abraeumen ist jede Quelle angehalten,
      // und die Zaehlung darf nicht auf ein `onended` warten, das an einem getrennten Knoten
      // haengt.
      running = 0
      for (const id of LAYERS) gains[id].disconnect()
      buffers = null
      dead = true
    },
  }
}
