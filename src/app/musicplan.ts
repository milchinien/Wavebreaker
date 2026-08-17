/**
 * Die Partitur: drei Lagen, ihre Mischung je Spiellage - und die Rechnung, die daraus
 * Abtastwerte macht.
 *
 * **Warum diese Datei getrennt von `app/musicbed.ts` steht.** Dieselbe Trennung wie bei
 * `soundplan.ts` gegen `audio.ts`: Dort der Apparat, der einen Browser braucht, hier die
 * Entscheidungen, die sich ohne Browser nachrechnen lassen. Was hier steht - welche Toene,
 * welche Laenge, welche Mischung, welche Ueberblendzeit - ist reine Arithmetik und wird im
 * Selbsttest gemessen (`selftest/suites/musik.ts`), nicht behauptet.
 *
 * Diese Datei macht **keinen Ton**. Sie liefert Zahlenreihen und eine Tabelle.
 *
 * ---
 *
 * **Warum gerechnete Musik und keine Datei.** Ein Musikbett als MP3 kostet Ladezeit, die im
 * Browser vor dem ersten Bild anfaellt, und es ist die eine Sorte Inhalt, die man nicht
 * einfach nimmt. Gerechnet kostet es null Bytes, passt zum Neon-Synth-Bild des Spiels - und
 * vor allem: Eine gerechnete Schleife kann **beweisbar** nahtlos sein, eine geschnittene ist
 * es nur, wenn der Schnitt gut war.
 *
 * **Die vier Regeln, nach denen die Partitur gebaut ist.**
 *
 * **1. Es gibt kein Stueck, es gibt Lagen.** Drei Schichten laufen dauernd und
 * phasengleich; was der Spieler hoert, ist ihre Mischung ({@link MIX}). Ein Bosskampf
 * schaltet keine andere Musik ein, er zieht eine Schicht auf und eine andere zurueck. Nur so
 * kann der Wechsel ueberblenden, statt zu schneiden - zwei getrennte Stuecke haetten
 * unterschiedliche Taktlagen, und jeder Wechsel waere ein Stolpern.
 *
 * **2. Jede Schleife ist nahtlos, und zwar rechnerisch.** Zwei Bauarten, beide periodisch
 * mit {@link LOOP_SECONDS}:
 *
 *   - **Flaechen** (Dauertoene) bestehen aus Teiltoenen, deren Frequenz auf ein Vielfaches
 *     der Schleifengrundfrequenz `1/LOOP_SECONDS` gerundet wird ({@link snapHz}). Ein
 *     solcher Teilton hat am Schleifenende exakt dieselbe Phase wie am Anfang.
 *   - **Pulse** (angeschlagene Toene) werden **im Kreis** geschrieben: Ein Ton, der ueber das
 *     Ende hinausklingt, landet am Anfang desselben Puffers. Damit ist das Ergebnis eine
 *     Funktion von `t mod LOOP_SECONDS` und periodisch, ganz gleich, welche Tonhoehe er hat.
 *
 * Weil das Ergebnis periodisch ist, gibt es an der Wiederholstelle **keinen Sprung**, sondern
 * einen ganz gewoehnlichen Abtastschritt - und der ist hoechstens so gross wie die groesste
 * Steigung des Signals geteilt durch die Abtastrate, also `2*PI/rate` mal
 * {@link slopeBudget}. Fuer eine Schicht aus lauter Flaechen ist die Naht damit ohne jede
 * Messung zugesichert; fuer die anderen ist dieselbe Rechnung eine sehr grosszuegige obere
 * Schranke, und dort zaehlt die Messung am fertigen Puffer. Beides steht im Selbsttest
 * (`selftest/suites/musik.ts`), gegen die Grenze 0,01 und bei beiden ueblichen Abtastraten.
 * Gemessen liegt die groesste Naht bei 4,3e-4 - und damit unter dem groessten
 * Abtastschritt, den dieselbe Schicht in ihrem Inneren macht.
 *
 * **3. Keine Lage ist je stumm.** Die Flaeche steht in **jeder** Mischung ueber 0,4. Eine
 * Ueberblendung, bei der beide Seiten gleichzeitig unter null gehen, waere ein Loch - und
 * ein Loch in der Musik hoert man deutlicher als jeden Wechsel.
 *
 * **4. Die Lage folgt dem Spiel, nicht dem Bereich.** Wer waehrend eines Bosskampfs in den
 * Upgrade-Bereich wechselt, hoert weiter das Bossthema: Der Kampf laeuft ja. Deshalb steht
 * in {@link MOOD_OF_EVENT} kein einziges `view.changed`.
 *
 * **5. Die Rechnung ist teilbar.** Gerechnete Musik kostet keine Ladezeit, aber sie kostet
 * Rechenzeit - und die faellt genau dann an, wenn der Spieler gerade gedrueckt hat. Deshalb
 * gibt es die Partitur nicht nur als fertiges Ergebnis ({@link renderScore}), sondern als
 * Liste kurzer Schritte ({@link planScore}), von denen jeder einzelne kurz genug ist, dass
 * kein Bild darauf warten muss. Beide Wege ergeben dieselben Abtastwerte - das ist keine
 * Absichtserklaerung, sondern eine Pruefung (`selftest/suites/musik.ts`).
 */

import { on, type EventName, type Unsubscribe } from '../core/events.ts'
import { createRng } from '../core/rng.ts'

/* === Mass und Takt ========================================================= */

/**
 * Laenge einer Schleife in Sekunden.
 *
 * Acht Sekunden sind vier Takte bei 120 Schlaegen je Minute - lang genug, dass eine
 * Akkordfolge hineinpasst und die Wiederholung nicht auf den Takt genau vorhersehbar ist,
 * kurz genug, dass drei Schichten im Speicher nichts kosten: 8 s mal 48 kHz mal zwei Kanaele
 * sind 3 MB je Schicht, und die entstehen erst bei der ersten Beruehrung der Seite.
 *
 * Die Zahl ist ausserdem die Grundfrequenz der ganzen Rechnung: Jeder Dauerton liegt auf
 * einem Vielfachen von 1/8 Hz, damit er am Schleifenende genau dort steht, wo er anfing.
 */
export const LOOP_SECONDS = 8

/**
 * Wie lange eine Ueberblendung dauert.
 *
 * Mehr als eine Sekunde, weil ein Lagenwechsel keine Quittung ist: Der Boss erscheint, und
 * die Musik **wird** bedrohlich - sie springt nicht um. Unter einer halben Sekunde ist der
 * Unterschied zu einem Schnitt nicht mehr zu hoeren; das ist die untere Grenze, die im
 * Selbsttest steht.
 */
export const FADE_SECONDS = 1.2

/** Fester Startwert fuer die Phasen der Teiltoene. Musik zieht nie am Wuerfel des Laufs. */
const SEED = 0x4d757a

/* === Die drei Lagen ======================================================== */

/** Die Spiellage, aus der sich die Mischung ergibt. */
export type Mood = 'ruhe' | 'gefecht' | 'boss'

export const MOODS = ['ruhe', 'gefecht', 'boss'] as const satisfies readonly Mood[]

/**
 * Die drei Schichten.
 *
 *   `grund`  Die Flaeche - tiefer Dauerklang, laeuft immer und traegt alles andere.
 *   `puls`   Der Antrieb - Bass und Arpeggio, kommt mit der Welle.
 *   `wucht`  Die Drohung - Knurren, Reibung, schwerer Schlag; nur beim Boss.
 */
export type LayerId = 'grund' | 'puls' | 'wucht'

export const LAYERS = ['grund', 'puls', 'wucht'] as const satisfies readonly LayerId[]

/**
 * Wie laut jede Schicht in welcher Lage steht.
 *
 * Die Flaeche faellt nie unter 0,4 - sie ist der Boden, ueber dem die anderen kommen und
 * gehen. Im Bosskampf bleibt der Puls hoerbar, statt ganz zu weichen: Der Kampf laeuft
 * weiter, und eine Musik, die den Antrieb wegnimmt, waehrend das Spiel schneller wird,
 * arbeitet gegen das Bild.
 */
export const MIX: Record<Mood, Record<LayerId, number>> = {
  ruhe: { grund: 1, puls: 0, wucht: 0 },
  gefecht: { grund: 0.8, puls: 1, wucht: 0 },
  boss: { grund: 0.45, puls: 0.42, wucht: 1 },
}

/* === Was ein Ton ist ======================================================= */

/** Ein Teilton: Vielfaches des Grundtons und sein Anteil an der Amplitude. */
export type Overtone = { multiple: number; gain: number }

/** Gemeinsames an beiden Bauarten. */
type VoiceBase = {
  /** Grundton in Hertz. */
  hz: number
  partials: readonly Overtone[]
  /** Amplitude dieser Stimme, bevor die Schicht gemischt wird. */
  gain: number
  /** Ort im Stereobild: -1 ganz links, 0 Mitte, +1 ganz rechts. */
  pan: number
}

/**
 * Ein Dauerton.
 *
 * `breath` ist die Zahl der Atemzuege je Schleife - eine ganze Zahl, sonst waere die
 * Huellkurve nicht periodisch und die Naht doch hoerbar. `depth` ist, wie weit der Atem
 * geht: 0 ist ein starrer Ton, 1 geht bis auf null herunter.
 */
export type DroneVoice = VoiceBase & { kind: 'flaeche'; breath: number; depth: number }

/**
 * Eine Folge angeschlagener Toene.
 *
 * `steps` ist das Raster ueber die ganze Schleife - die Laenge der Liste bestimmt, wie fein
 * es ist. Jeder Eintrag ist ein Halbtonabstand zum Grundton oder `null` fuer eine Pause.
 */
export type PulseVoice = VoiceBase & {
  kind: 'puls'
  steps: readonly (number | null)[]
  /** Anstieg in Sekunden - kurz, aber nie null: Ein Sprung von null auf voll knackt. */
  attack: number
  /** Abklingzeit in Sekunden (auf 1/e). */
  decay: number
}

export type Voice = DroneVoice | PulseVoice

/* === Die Partitur ========================================================== */

/*
 * Tonvorrat: a-Moll. Der Bass geht A - F - G - A, das Arpeggio folgt mit den Akkordtoenen.
 * Die Zahlen sind Halbtonabstaende zum jeweiligen Grundton der Stimme.
 */

/** Vier Takte Bass in Vierteln, ein Akkord je Takt: Am - F - G - Am. */
const BASS_STEPS: readonly (number | null)[] = [
  0, 0, 12, 0, //
  -4, -4, 8, -4,
  -2, -2, 10, -2,
  0, 0, 12, null,
]

/** Dieselben vier Takte in Achteln: Grundton, Terz, Quinte, Terz - auf und ab. */
const ARP_STEPS: readonly (number | null)[] = [
  0, 3, 7, 3, 12, 7, 3, 0,
  -4, 0, 3, 0, 8, 3, 0, -4,
  -2, 2, 5, 2, 10, 5, 2, -2,
  0, 3, 7, 3, 12, 7, 3, null,
]

/** Dasselbe Raster, um vier Achtel versetzt - das ergibt das Hin und Her im Stereobild. */
const ARP_ECHO: readonly (number | null)[] = [
  ...ARP_STEPS.slice(4),
  ...ARP_STEPS.slice(0, 4),
]

/** Der schwere Schlag des Bosses: jede Sekunde einer, jeder zweite betont. */
const HIT_STEPS: readonly (number | null)[] = [0, null, -5, null, 0, null, -7, null]

/**
 * Die Stimmen jeder Schicht.
 *
 * Die Pegel sind so gewaehlt, dass die Summe aller drei Schichten in ihrer lautesten
 * Mischung deutlich unter der Vollaussteuerung bleibt - was danach kommt, ist der Musikbus
 * (Startwert 0,5) und die Bremse am Summenpunkt (`app/mixer.ts`). Musik, die den
 * Schusswechsel zudeckt, ist keine Musik, sondern ein Fehler.
 */
export const SCORE: Record<LayerId, readonly Voice[]> = {
  /* --- Flaeche: laeuft immer -------------------------------------------- */
  grund: [
    // Der Grundton A1, mit Oktave und Quinte darueber. Fast alle Energie liegt hier.
    {
      kind: 'flaeche',
      hz: 55,
      partials: [
        { multiple: 1, gain: 0.55 },
        { multiple: 2, gain: 0.22 },
        { multiple: 3, gain: 0.08 },
        { multiple: 5, gain: 0.03 },
      ],
      gain: 0.3,
      breath: 1,
      depth: 0.25,
      pan: -0.2,
    },
    // Die Quinte E2 - sie macht aus dem Grundton einen Klang statt eines Brummens.
    {
      kind: 'flaeche',
      hz: 82.41,
      partials: [
        { multiple: 1, gain: 0.45 },
        { multiple: 2, gain: 0.16 },
        { multiple: 3, gain: 0.06 },
      ],
      gain: 0.2,
      breath: 2,
      depth: 0.3,
      pan: 0.25,
    },
    // Zwei leise Lagen weiter oben, damit die Flaeche nicht dumpf bleibt. Ihre Atemzuege
    // laufen verschieden schnell - dadurch steht das Bild nie still, obwohl sich alle acht
    // Sekunden dasselbe wiederholt.
    {
      kind: 'flaeche',
      hz: 220,
      partials: [
        { multiple: 1, gain: 0.35 },
        { multiple: 2, gain: 0.08 },
      ],
      gain: 0.1,
      breath: 3,
      depth: 0.55,
      pan: -0.35,
    },
    {
      kind: 'flaeche',
      hz: 329.63,
      partials: [{ multiple: 1, gain: 0.3 }],
      gain: 0.07,
      breath: 5,
      depth: 0.65,
      pan: 0.4,
    },
  ],

  /* --- Puls: kommt mit der Welle ---------------------------------------- */
  puls: [
    // Bass in Vierteln, kurz angerissen.
    {
      kind: 'puls',
      hz: 110,
      partials: [
        { multiple: 1, gain: 0.5 },
        { multiple: 2, gain: 0.25 },
        { multiple: 3, gain: 0.12 },
      ],
      gain: 0.28,
      steps: BASS_STEPS,
      attack: 0.006,
      decay: 0.11,
      pan: 0,
    },
    // Arpeggio in Achteln, links.
    {
      kind: 'puls',
      hz: 220,
      partials: [
        { multiple: 1, gain: 0.4 },
        { multiple: 2, gain: 0.12 },
        { multiple: 3, gain: 0.05 },
      ],
      gain: 0.14,
      steps: ARP_STEPS,
      attack: 0.004,
      decay: 0.09,
      pan: -0.45,
    },
    // Dasselbe eine Oktave hoeher, versetzt und leiser, rechts - das Echo.
    {
      kind: 'puls',
      hz: 440,
      partials: [
        { multiple: 1, gain: 0.32 },
        { multiple: 2, gain: 0.08 },
      ],
      gain: 0.07,
      steps: ARP_ECHO,
      attack: 0.004,
      decay: 0.07,
      pan: 0.45,
    },
  ],

  /* --- Wucht: nur beim Boss --------------------------------------------- */
  wucht: [
    // Zwei tiefe Toene, ein halbes Hertz auseinander. Sie schweben gegeneinander - das ist
    // das Knurren, und es kostet keinen einzigen zusaetzlichen Rechenschritt.
    {
      kind: 'flaeche',
      hz: 41.2,
      partials: [
        { multiple: 1, gain: 0.5 },
        { multiple: 2, gain: 0.3 },
        { multiple: 3, gain: 0.15 },
        { multiple: 4, gain: 0.07 },
      ],
      gain: 0.19,
      breath: 1,
      depth: 0.2,
      pan: -0.3,
    },
    {
      kind: 'flaeche',
      hz: 41.7,
      partials: [
        { multiple: 1, gain: 0.5 },
        { multiple: 2, gain: 0.3 },
        { multiple: 3, gain: 0.15 },
        { multiple: 4, gain: 0.07 },
      ],
      gain: 0.19,
      breath: 1,
      depth: 0.2,
      pan: 0.3,
    },
    // Die Reibung: A gegen B - eine kleine Sekunde, der schaerfste Abstand, den es gibt.
    // Sie schwillt viermal je Schleife an und wieder ab.
    {
      kind: 'flaeche',
      hz: 110,
      partials: [
        { multiple: 1, gain: 0.4 },
        { multiple: 2, gain: 0.1 },
      ],
      gain: 0.07,
      breath: 4,
      depth: 0.85,
      pan: 0.5,
    },
    {
      kind: 'flaeche',
      hz: 116.54,
      partials: [
        { multiple: 1, gain: 0.4 },
        { multiple: 2, gain: 0.1 },
      ],
      gain: 0.07,
      breath: 4,
      depth: 0.85,
      pan: -0.5,
    },
    // Der Schlag. Lange Abklingzeit, damit er nachhallt statt zu klopfen.
    {
      kind: 'puls',
      hz: 55,
      partials: [
        { multiple: 1, gain: 0.6 },
        { multiple: 2, gain: 0.2 },
        { multiple: 3, gain: 0.06 },
      ],
      gain: 0.26,
      steps: HIT_STEPS,
      attack: 0.008,
      decay: 0.34,
      pan: 0,
    },
  ],
}

/* === Die Rechnung ========================================================== */

/**
 * Eine Frequenz auf das Raster der Schleife legen.
 *
 * Das Raster ist `1/LOOP_SECONDS` = 0,125 Hz fein; ein Ton verschiebt sich dadurch um
 * hoechstens 0,0625 Hz, also um weniger als ein Tausendstel Halbton. Zu hoeren ist das
 * nicht - zu messen schon: Nach der Rundung passt in eine Schleife eine ganze Zahl von
 * Schwingungen, und genau daran haengt die Nahtlosigkeit der Flaechen.
 */
export function snapHz(hz: number): number {
  return Math.max(1, Math.round(hz * LOOP_SECONDS)) / LOOP_SECONDS
}

/** Halbtonabstand in einen Faktor auf die Frequenz. */
export function semitone(steps: number): number {
  return Math.pow(2, steps / 12)
}

/**
 * Die groesste Steigung, die eine Schicht ueberhaupt erreichen kann - Summe aus
 * `Amplitude mal Frequenz` ueber alle Teiltoene.
 *
 * **Warum das die Zahl ist, an der die Naht haengt.** Das gerechnete Signal ist periodisch,
 * also gibt es an der Wiederholstelle keinen Sprung, sondern nur einen ganz gewoehnlichen
 * Abtastschritt. Dessen Groesse ist hoechstens `max|f'| / rate`, und `max|f'|` ist
 * `2*PI` mal diese Summe. Fuer eine Schicht aus lauter Flaechen ({@link isSustained}) ist
 * die Naht damit **ohne jede Messung** zugesichert.
 *
 * Fuer Pulsstimmen ist dieselbe Schranke sehr grosszuegig: Sie rechnet mit der vollen
 * Amplitude eines frisch angeschlagenen Tons, waehrend an der Nahtstelle nur der Ausklang
 * steht - gemessen liegt der Sprung dort bei einem Fuenfzigstel der Schranke. Die Zusage
 * fuer diese Schichten ist deshalb die Messung am fertigen Puffer, nicht diese Zahl.
 */
export function slopeBudget(id: LayerId): number {
  let sum = 0
  for (const voice of SCORE[id]) {
    const top = voice.kind === 'puls' ? highestHz(voice) : voice.hz
    for (const partial of voice.partials) {
      sum += voice.gain * partial.gain * snapHz(top * partial.multiple)
    }
  }
  return sum
}

/** Besteht die Schicht ausschliesslich aus Dauertoenen? Dann traegt {@link slopeBudget}. */
export function isSustained(id: LayerId): boolean {
  return SCORE[id].every((voice) => voice.kind === 'flaeche')
}

/** Der hoechste Grundton, den eine Pulsstimme in ihrem Raster erreicht. */
function highestHz(voice: PulseVoice): number {
  let top = voice.hz
  for (const step of voice.steps) {
    if (step === null) continue
    top = Math.max(top, voice.hz * semitone(step))
  }
  return top
}

/** Gleichleistungs-Panorama: links und rechts, Summe der Quadrate immer 1. */
function panGains(pan: number): [number, number] {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

/**
 * Die Huellkurve eines angeschlagenen Tons.
 *
 * Anstieg linear, Ausklang exponentiell - und am Ende eine kurze Rampe auf **exakt** null.
 * Die Rampe ist kein Feinschliff: Ohne sie endet der Ton bei einem winzigen, aber von null
 * verschiedenen Wert, und wo er im Kreis geschrieben wird, waere das ein echter Sprung.
 */
export function pluck(seconds: number, attack: number, decay: number, tail: number): number {
  if (seconds < 0 || seconds >= tail) return 0
  const rise = seconds < attack ? seconds / attack : 1
  const fall = Math.exp(-Math.max(0, seconds - attack) / decay)
  const release = 0.02
  const out = seconds > tail - release ? (tail - seconds) / release : 1
  return rise * fall * out
}

/** Wie lange ein angeschlagener Ton insgesamt dauert, bevor er sicher null ist. */
function tailSeconds(voice: PulseVoice): number {
  return Math.min(LOOP_SECONDS, voice.attack + 6 * voice.decay + 0.02)
}

/*
 * Die Sinustabelle ueber genau eine Schleifenlaenge - gebaut in {@link planScore}.
 *
 * **Warum eine Tabelle und keine Naeherung.** Jeder Teilton liegt auf einem ganzzahligen
 * Vielfachen der Schleifengrundfrequenz - `sin(2*PI*k*n/N)` ist damit `tabelle[(k*n) mod N]`,
 * und das ist kein aehnlicher Wert, sondern derselbe. Die Tabelle spart also nichts an
 * Genauigkeit, nur an Zeit: Aus Millionen Aufrufen von `Math.sin` je Schicht wird einmal
 * `N`. Gemessen faellt der Aufbau aller drei Schichten dadurch von 560 ms auf gut 120 ms.
 *
 * **Warum einfache Genauigkeit.** Der Klangpuffer ist am Ende ein `Float32Array`; in
 * doppelter Genauigkeit zu rechnen, um dann auf einfache zu runden, kostet die doppelte
 * Speicherbandbreite fuer nichts. Nachgemessen: Die Naht der drei Schichten aendert sich
 * dadurch in keiner der sechs Stellen, die gemessen werden - der Rundungsfehler liegt bei
 * 1e-7, die Naht bei 4e-4.
 */

/**
 * Zwei Kanaele, links und rechts.
 *
 * Der eigene Puffer im Typ ist kein Zierrat: `AudioBuffer.copyToChannel` nimmt nur einen
 * `Float32Array` ueber einem gewoehnlichen `ArrayBuffer` - ein geteilter Speicher waere
 * nebenlaeufig veraenderbar, und das darf ein Klangpuffer nicht sein.
 */
export type Channels = [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>]

/**
 * Die ganze Rechnung, in Haeppchen zerlegt.
 *
 * **Warum es das gibt.** Die drei Schleifen zu rechnen kostet auf einem gewoehnlichen Rechner
 * eine gute Achtelsekunde - gemessen im Browser 167 ms kalt, 77 ms warm bei 44,1 kHz. Am
 * Stueck gerechnet ist das kein Aufwand, sondern ein **Ruckler**: Der Klangapparat entsteht
 * beim ersten Ereignis nach dem Druck auf PRESS, also mitten in der Startblende, und ein
 * Hauptfaden, der dort 200 ms nicht antwortet, laesst rund ein Dutzend Bilder ausfallen -
 * genau in dem Augenblick, in dem der Spieler zum ersten Mal hinsieht. Gemessen mit einem
 * `PerformanceObserver` auf `longtask` war das eine einzige Meldung ueber 223 ms.
 *
 * Deshalb liefert diese Datei die Rechnung nicht mehr nur als fertiges Ergebnis, sondern als
 * **Liste kurzer Schritte**. Ein Schritt ist ein Durchgang ueber die Abtastwerte - ein
 * Teilton einer Flaeche, die Mischung einer Stimme, ein Anschlag eines Pulses. Keiner davon
 * dauert laenger als wenige Millisekunden, und der Aufrufer entscheidet, wie viele er je
 * Gelegenheit rechnet ({@link ScoreJob.step}). Bis der Puffer steht, laeuft das Spiel eine
 * knappe Sekunde ohne Musikbett - das faellt niemandem auf, ein Ruckler von 200 ms schon.
 *
 * **Die Zerlegung aendert das Ergebnis nicht.** Die Schritte laufen in derselben Reihenfolge
 * und auf denselben Puffern wie die ungeteilte Rechnung; die Phasen werden beim Planen
 * gezogen, also in derselben Folge wie zuvor. `renderScore` ist deshalb nichts weiter als
 * "alle Schritte hintereinander", und der Selbsttest misst, dass beide Wege **Abtastwert fuer
 * Abtastwert** dasselbe ergeben.
 */
export type ScoreJob = {
  /** Wie viele Schritte es insgesamt sind. */
  readonly size: number
  /**
   * Was ein Schritt anfasst, in Abtastwerten - das Mass, in dem portioniert wird.
   *
   * **Warum in Abtastwerten und nicht in Millisekunden.** Eine Uhr gibt es in diesem Haus nur
   * in `core/loop.ts`, und das aus gutem Grund: Was sich nach der Uhr richtet, laesst sich
   * nicht mehr nachrechnen. Die Zahl der angefassten Abtastwerte ist der Aufwand selbst - sie
   * steht schon beim Planen fest, sie ist auf jedem Geraet dieselbe, und der Selbsttest kann
   * sie pruefen, statt eine Stoppuhr zu befragen. Dass sie zur Rechenzeit proportional ist,
   * ist keine Annahme, sondern die Bauart: Jeder Schritt ist eine gerade Schleife ueber genau
   * so viele Werte.
   */
  cost(index: number): number
  /** Einen Schritt rechnen. Ein Index ausserhalb der Liste tut nichts. */
  step(index: number): void
  /**
   * Eine Portion rechnen: Schritte ab `from`, solange {@link SLICE_SAMPLES} reicht.
   *
   * Ein Schritt wird nur begonnen, wenn er noch **ganz** hineinpasst - sonst bleibt er fuer
   * die naechste Portion liegen. Damit ist der Aufwand einer Portion nicht ungefaehr
   * begrenzt, sondern genau: hoechstens {@link SLICE_SAMPLES} Abtastwerte, und nur ein
   * einzelner Schritt, der von sich aus breiter waere, darf darueber hinausgehen - denn
   * sonst kaeme die Rechnung nie voran.
   *
   * Zurueck kommt der naechste offene Schritt. Ist er gleich {@link ScoreJob.size}, ist alles
   * gerechnet.
   */
  slice(from: number): number
  /** Die Puffer. Vollstaendig, sobald alle Schritte gelaufen sind - vorher halb gefuellt. */
  result(): Record<LayerId, Channels>
}

/**
 * Wie viele Abtastwerte eine Portion hoechstens anfasst.
 *
 * Der Wert ist nicht gegriffen, sondern von unten und von oben eingeklemmt.
 *
 * **Von unten** durch den breitesten einzelnen Schritt: Der schwere Schlag des Bosses klingt
 * gut zwei Sekunden nach und kostet damit bei 48 kHz 496 320 Werte. Waere die Portion
 * kleiner, muesste dieser eine Schritt sie sprengen duerfen - und dann waere die Zusage
 * keine mehr.
 *
 * **Von oben** durch den Ruckler, um den es hier geht. Gemessen im Browser kostet die ganze
 * Partitur 147 ms warm bei 44,1 kHz und fasst dabei rund elf Millionen Werte an, also gut
 * 13 ns je Wert - eine halbe Million Werte sind damit **rund 7 ms**, und selbst das Dreifache
 * auf einem langsamen Telefon bleibt weit unter den fuenfzig Millisekunden, ab denen der
 * Browser eine Aufgabe als "long task" meldet.
 *
 * Und von unten noch durch die Geduld: Die Partitur zerfaellt damit in gut fuenfzig
 * Portionen, und weil zwischen zweien ein Bild liegen soll, steht das Musikbett zwei bis drei
 * Sekunden nach dem Druck auf PRESS. Wer hier halbiert, wartet doppelt so lange auf den
 * ersten Ton.
 */
export const SLICE_SAMPLES = 500_000

/**
 * In wie viele Haeppchen die Sinustabelle zerfaellt.
 *
 * Sie ist der einzige Posten, der vor allen Stimmen fertig sein muss, und mit einer
 * Viertelmillion Aufrufen von `Math.sin` auch der einzige, der von sich aus zu gross waere.
 */
const TABLE_CHUNKS = 8

/** Ein Schritt des Plans: was er tut und was er dabei anfasst. */
type Chunk = { cost: number; run: () => void }

/**
 * Alle drei Schichten - als Plan, nicht als Ergebnis.
 *
 * Die Sinustabelle ist fuer alle drei dieselbe und wird einmal gebaut statt dreimal. Danach
 * faellt sie weg - sie ist Werkzeug, kein Vorrat.
 */
export function planScore(sampleRate: number): ScoreJob {
  const count = Math.round(sampleRate * LOOP_SECONDS)
  const table = new Float32Array(count)
  const chunks: Chunk[] = []

  // Erst die Tabelle, in Haeppchen: Ohne sie kann keine Stimme rechnen.
  const stride = Math.ceil(count / TABLE_CHUNKS)
  const angle = (2 * Math.PI) / count
  for (let from = 0; from < count; from += stride) {
    const to = Math.min(count, from + stride)
    chunks.push({
      cost: to - from,
      run: () => {
        for (let n = from; n < to; n++) table[n] = Math.sin(angle * n)
      },
    })
  }

  const out = {} as Record<LayerId, Channels>
  for (const id of LAYERS) {
    const left = new Float32Array(new ArrayBuffer(count * 4))
    const right = new Float32Array(new ArrayBuffer(count * 4))
    out[id] = [left, right]
    planLayer(id, sampleRate, table, left, right, chunks)
  }

  const size = chunks.length

  return {
    size,
    cost: (index) => chunks[index]?.cost ?? 0,
    step(index) {
      chunks[index]?.run()
    },
    slice(from) {
      let index = Math.max(0, from)
      let spent = 0
      while (index < size) {
        const chunk = chunks[index] as Chunk
        // Passt er nicht mehr ganz, bleibt er liegen - ausser die Portion ist noch leer.
        if (spent > 0 && spent + chunk.cost > SLICE_SAMPLES) break
        chunk.run()
        spent += chunk.cost
        index += 1
      }
      return index
    },
    result: () => out,
  }
}

/**
 * Alle drei Schichten auf einmal, am Stueck gerechnet.
 *
 * Der Weg fuer alles, was ohnehin nicht auf ein Bild warten muss: der Selbsttest und die
 * Messseiten. Im Spiel selbst nimmt der Klangapparat den Plan (`app/musicbed.ts`).
 */
export function renderScore(sampleRate: number): Record<LayerId, Channels> {
  const job = planScore(sampleRate)
  for (let index = 0; index < job.size; index++) job.step(index)
  return job.result()
}

/**
 * Die Schritte einer Schicht anhaengen.
 *
 * Die Phasen werden **hier** gezogen und nicht im Schritt selbst: Ein Schritt muss beliebig
 * spaet laufen duerfen, ohne dass sich dadurch aendert, was er rechnet. Gezogen wird in
 * derselben Reihenfolge wie in der ungeteilten Rechnung - deshalb klingt das Ergebnis nicht
 * nur aehnlich, sondern ist dasselbe.
 */
function planLayer(
  id: LayerId,
  sampleRate: number,
  table: Float32Array,
  left: Float32Array,
  right: Float32Array,
  chunks: Chunk[],
): void {
  const count = left.length
  const rng = createRng(SEED)
  // Ein Rechenblatt, das sich alle Dauertoene teilen: Jede Stimme summiert erst ihre
  // Teiltoene hier hinein und legt das Ergebnis dann in einem Zug auf die beiden Kanaele.
  const scratch = new Float32Array(count)

  let index = 0
  for (const voice of SCORE[id]) {
    // Ein eigener Strom je Stimme: Wer eine Stimme dazwischenschiebt, soll nicht die Phasen
    // aller folgenden verschieben - sonst klingt nach jeder Aenderung alles ein wenig anders.
    const phases = rng.fork(index * 7919 + 13)
    const [panL, panR] = panGains(voice.pan)
    if (voice.kind === 'flaeche') planDrone(voice, phases, panL, panR, left, right, table, scratch, chunks)
    else planPulse(voice, phases, panL, panR, left, right, table, sampleRate, chunks)
    index += 1
  }
}

/**
 * Wie viele volle Schwingungen ein Teilton in eine Schleife legt.
 *
 * Immer eine ganze Zahl - das ist die Rundung aus {@link snapHz}, nur in der Einheit, in der
 * die Tabelle indiziert wird.
 */
function cycles(hz: number): number {
  return Math.max(1, Math.round(hz * LOOP_SECONDS))
}

function planDrone(
  voice: DroneVoice,
  rng: { int(min: number, max: number): number },
  panL: number,
  panR: number,
  left: Float32Array,
  right: Float32Array,
  table: Float32Array,
  scratch: Float32Array,
  chunks: Chunk[],
): void {
  const count = left.length

  /*
   * Ein Teilton je Durchgang, nicht alle Teiltoene je Abtastwert.
   *
   * Rechnerisch ist es dasselbe - die Summe aendert sich nicht durch die Reihenfolge. Fuer
   * den Uebersetzer im Browser ist es aber ein anderer Text: Die innere Schleife liest hier
   * genau zwei Felder mit festem Schritt statt vier mit wechselndem Index. Gemessen faellt
   * der Aufbau aller drei Schichten dadurch von 200 ms auf gut die Haelfte.
   *
   * Und weil ein Durchgang genau ein Haeppchen ist, ist derselbe Umbau auch der, der den
   * Aufbau teilbar macht: Ein Teilton ueber acht Sekunden kostet ein bis zwei Millisekunden,
   * und mehr darf ein einzelner Schritt nicht dauern.
   *
   * Die Phasen stehen fest, aber nicht auf null: Laegen alle Teiltoene bei null, traefen sie
   * sich einmal je Schleife in einer gemeinsamen Flanke - und die waere genau das Ticken,
   * das hier nicht vorkommen darf. Als ganzzahliger Tabellenversatz, damit auch die Phase
   * auf dem Raster der Schleife liegt.
   */
  for (const [index, partial] of voice.partials.entries()) {
    const cycle = cycles(voice.hz * partial.multiple)
    const level = partial.gain
    // Der Zeiger schlaegt am Ende der Tabelle um - dasselbe wie eine Modulorechnung, nur
    // ohne Division. Bei Millionen Zugriffen je Schicht ist das der ganze Unterschied.
    const from = rng.int(0, count - 1)
    // Das Rechenblatt gehoert der ganzen Schicht und wird von Stimme zu Stimme
    // weitergereicht. Es zu leeren ist deshalb Sache des **ersten** Teiltons dieser Stimme -
    // und zwar in seinem eigenen Schritt, damit kein Zwischenstand ueberlebt, wenn zwischen
    // zwei Schritten ein Bild liegt.
    const first = index === 0
    chunks.push({
      cost: count,
      run: () => {
        if (first) scratch.fill(0)
        let cursor = from
        for (let n = 0; n < count; n++) {
          scratch[n] = (scratch[n] as number) + level * (table[cursor] as number)
          cursor += cycle
          if (cursor >= count) cursor -= count
        }
      },
    })
  }

  const breathCycle = Math.max(0, Math.round(voice.breath))
  const breathFrom = rng.int(0, count - 1)
  const floor = 1 - voice.depth
  const swingGain = voice.depth * 0.5

  chunks.push({
    cost: count,
    run: () => {
      let breathCursor = breathFrom
      for (let n = 0; n < count; n++) {
        const breath = floor + swingGain * (1 + (table[breathCursor] as number))
        breathCursor += breathCycle
        if (breathCursor >= count) breathCursor -= count

        const value = (scratch[n] as number) * voice.gain * breath
        left[n] = (left[n] as number) + value * panL
        right[n] = (right[n] as number) + value * panR
      }
    },
  })
}

function planPulse(
  voice: PulseVoice,
  rng: { int(min: number, max: number): number },
  panL: number,
  panR: number,
  left: Float32Array,
  right: Float32Array,
  table: Float32Array,
  sampleRate: number,
  chunks: Chunk[],
): void {
  const count = left.length
  const tail = tailSeconds(voice)
  const tailCount = Math.min(count, Math.round(tail * sampleRate))

  // Die Huellkurve haengt nur davon ab, wie lange der Ton schon klingt - also einmal
  // rechnen und fuer jeden Anschlag wiederverwenden. Sie steht in einem Behaelter, weil sie
  // in einem frueheren Schritt entsteht als die Schritte, die sie brauchen.
  const envelope: { of: Float32Array } = { of: new Float32Array(0) }
  chunks.push({
    cost: tailCount,
    run: () => {
      const made = new Float32Array(tailCount)
      for (let u = 0; u < tailCount; u++) made[u] = pluck(u / sampleRate, voice.attack, voice.decay, tail)
      envelope.of = made
    },
  })

  const size = voice.partials.length
  const gain = new Float64Array(size)
  const phase = new Int32Array(size)
  for (let p = 0; p < size; p++) {
    gain[p] = (voice.partials[p] as Overtone).gain
    phase[p] = rng.int(0, count - 1)
  }

  // Zwei Anschlaege desselben Tons klingen gleich - der zweite wird kopiert, nicht gerechnet.
  // Im Arpeggio kommen einunddreissig Anschlaege auf zehn verschiedene Toene.
  const shapes = new Map<number, Float32Array>()

  for (let step = 0; step < voice.steps.length; step++) {
    const semi = voice.steps[step]
    if (semi === null || semi === undefined) continue
    const at = step

    chunks.push({
      // Der schlimmste Fall: Der Ton kommt zum ersten Mal vor, also wird seine Gestalt erst
      // gerechnet (ein Durchgang je Teilton, einer fuer die Huellkurve) und dann gesetzt. Wer
      // ihn wiederholt, kommt billiger davon - eine Portion darf sich verschaetzen, aber nur
      // nach unten.
      cost: tailCount * (size + 2),
      run: () => {
        let shape = shapes.get(semi)
        if (!shape) {
          shape = new Float32Array(tailCount)
          const env = envelope.of
          for (let p = 0; p < size; p++) {
            const cycle = cycles(voice.hz * semitone(semi) * (voice.partials[p] as Overtone).multiple)
            const level = (gain[p] as number) * voice.gain
            let cursor = phase[p] as number
            for (let u = 0; u < tailCount; u++) {
              shape[u] = (shape[u] as number) + level * (table[cursor] as number)
              cursor += cycle
              if (cursor >= count) cursor -= count
            }
          }
          for (let u = 0; u < tailCount; u++) shape[u] = (shape[u] as number) * (env[u] as number)
          shapes.set(semi, shape)
        }

        // Im Kreis: Was ueber das Ende hinausklingt, steht am Anfang derselben Schleife.
        // Genau das macht den Puffer periodisch, ganz gleich, welche Tonhoehe der Ton traegt -
        // und es sind zwei gerade Laeufe, kein Rest je Abtastwert.
        const start = Math.round((at * count) / voice.steps.length)
        const bisEnde = Math.min(tailCount, count - start)
        for (let u = 0; u < bisEnde; u++) {
          const value = shape[u] as number
          const n = start + u
          left[n] = (left[n] as number) + value * panL
          right[n] = (right[n] as number) + value * panR
        }
        for (let u = bisEnde; u < tailCount; u++) {
          const value = shape[u] as number
          const n = u - bisEnde
          left[n] = (left[n] as number) + value * panL
          right[n] = (right[n] as number) + value * panR
        }
      },
    })
  }
}

/* === Die Lage folgt dem Spiel ============================================== */

/**
 * Welches Ereignis welche Lage einschaltet.
 *
 * Bewusst kurz. Musik, die auf jedes Ereignis reagiert, reagiert auf keines - der Spieler
 * lernt die drei Lagen nur, wenn sie an drei klaren Punkten umschalten. Ein `view.changed`
 * steht hier nicht: Wer im Bosskampf in die Upgrades wechselt, ist immer noch im Bosskampf.
 *
 * `station.destroyed` und `wave.lost` melden denselben Augenblick (`sim/battle.ts`) und
 * fuehren beide auf `ruhe` - welche der beiden Meldungen zuerst kommt, ist gleichgueltig.
 */
export const MOOD_OF_EVENT = {
  'wave.started': 'gefecht',
  'wave.cleared': 'ruhe',
  'wave.lost': 'ruhe',
  'station.destroyed': 'ruhe',
  'boss.spawned': 'boss',
  'boss.killed': 'gefecht',
  'prestige.done': 'ruhe',
} as const satisfies Partial<Record<EventName, Mood>>

/** Mit welcher Lage begonnen wird, solange noch nichts passiert ist. */
export const START_MOOD: Mood = 'ruhe'

export type MoodWatch = {
  /** Die Lage, die gerade gelten soll - auch wenn noch gar kein Klangapparat da ist. */
  current(): Mood
  stops: readonly Unsubscribe[]
}

/**
 * Die Lage am Ereignisbus mitfuehren.
 *
 * Der Rueckruf laeuft nur, wenn sich wirklich etwas aendert: Drei Wellen hintereinander
 * melden dreimal `wave.started`, und dreimal dieselbe Ueberblendung anzustossen hiesse, die
 * laufende jedes Mal von vorn zu beginnen.
 *
 * {@link MoodWatch.current} gibt es, weil der Klangapparat erst bei der ersten Beruehrung
 * der Seite entsteht (`app/audio.ts`). Bis dahin sind hier schon Wellen gestartet - und die
 * Musik muss dann in der Lage einsetzen, in der das Spiel steht, nicht in der Ruhe.
 */
export function attachMood(onChange: (mood: Mood) => void): MoodWatch {
  let mood: Mood = START_MOOD
  const stops: Unsubscribe[] = []

  for (const [name, next] of Object.entries(MOOD_OF_EVENT) as [EventName, Mood][]) {
    stops.push(
      on(name, () => {
        if (next === mood) return
        mood = next
        onChange(next)
      }),
    )
  }

  return { current: () => mood, stops }
}
