/**
 * Das Mischpult: drei Busse und eine Bremse am Summenpunkt.
 *
 * **Warum diese Datei getrennt von `app/audio.ts` steht.** `audio.ts` ist ein Anschluss und
 * darf jederzeit geloescht werden - dann wird es still, sonst passiert nichts. Die Regler
 * und ihre Werte ueberleben das: Sie stehen in den Geraeteeinstellungen und muessen dort
 * gelesen werden koennen, auch wenn nie ein Ton entsteht. Deshalb liegen hier die Namen der
 * Busse und die Rechnung der Bremse, und `audio.ts` benutzt sie nur.
 *
 * Diese Datei kennt keine Spielregel, keinen Spielstand und kein DOM ausser dem
 * Klangapparat selbst.
 *
 * ---
 *
 * **Warum drei Busse und nicht ein Regler.** Ein einziger Lautstaerkeregler zwingt zu einer
 * Entscheidung, die niemand treffen will: Wer die Schuesse leiser haben moechte, verliert
 * die Zaesur am Wellenende gleich mit. Drei Gruppen decken ab, wofuer Spieler wirklich
 * greifen:
 *
 *   `music`  Die Partitur - das durchlaufende Musikbett aus `app/musicbed.ts` und die
 *            Zaesuren darueber: Wellenanfang und -ende, das Bossmotiv, Stufenaufstieg,
 *            Niederlage, Prestige. Beides haengt an diesem einen Regler, und wer ihn auf
 *            null zieht, haelt das Bett nicht nur leise, sondern an.
 *   `sfx`    Was im Feld passiert: Schuss, Treffer, Tod, Muenze, Kapsel, Faehigkeit.
 *   `ui`     Was der Spieler selbst anfasst: Kauf, Bau, Handel, Bereitmeldung, Ereignis.
 *
 * **Warum eine Bremse und nicht nur Disziplin.** Bis zu sechzehn Stimmen laufen gleichzeitig,
 * jede mit ihrem eigenen Pegel zwischen 0,2 und 0,6. Faellt ein Boss mitten in einem vollen
 * Schusswechsel, addieren sich zehn und mehr davon - gemessen mit `OfflineAudioContext`
 * ergibt der Fall eine Spitze von **1,176**, also 1,4 dB ueber dem Rand. Eine Summe ueber
 * 1,0 ist keine laute Stelle, sondern ein Knacken, und Uebersteuerung ist das eine
 * Klangproblem, das man ohne jede Vorbildung sofort als billig hoert.
 *
 * **Warum ein Formgeber und kein `DynamicsCompressorNode`.** Der naheliegende Weg waere der
 * eingebaute Kompressor. Er wurde eingebaut, gemessen und wieder ausgebaut: Chrome legt auf
 * ihn eine feste Aufholverstaerkung von **+4,33 dB**, und zwar unabhaengig vom Pegel - ein
 * Sinus mit Amplitude 0,001 kommt mit 0,00165 wieder heraus, weit unter jeder Schwelle. Ein
 * Knoten, der leise Stellen um zwei Drittel lauter macht, verbraucht genau die Reserve, die
 * er schuetzen soll, und er verschiebt jeden Reglerwert um einen Betrag, der nicht im
 * Standard steht und im naechsten Browser anders ausfaellt.
 *
 * Also ein `WaveShaper` mit einer selbst gerechneten Kennlinie. Der ist im Standard
 * vollstaendig festgelegt und in jedem Browser derselbe:
 *
 *   - Unter {@link SOFT_KNEE} ist die Kennlinie die Identitaet. Ein einzelner Schuss geht
 *     unveraendert durch - der Limiter ist nicht zu hoeren, solange er nichts zu tun hat.
 *   - Darueber biegt sie weich gegen {@link CEILING} ab und ueberschreitet ihn nie.
 *   - Der Browser klemmt jede Eingabe ausserhalb von -1..1 auf die **Endpunkte** der
 *     Kennlinie und interpoliert dazwischen linear. Beides kann keinen Wert erzeugen, der
 *     ueber dem groessten Stuetzwert liegt. Die Begrenzung ist damit rechnerisch zugesagt
 *     und nicht erfahrungsgemaess: Es gibt kein Eingangssignal, das sie bricht.
 *
 * Gemessen: Derselbe Fall wie oben kommt nach dem Umbau bei **0,921** heraus - das ist
 * `softClip(1)`, denn ab Vollaussteuerung am Eingang klemmt der Browser auf den Endpunkt
 * der Kennlinie. Und bei halb aufgedrehten Reglern misst man vorher wie nachher **0,588**:
 * Wo nichts zu bremsen ist, bremst nichts. Nachzurechnen mit
 * `public/mischpult-messung.html`.
 */

/** Die drei Gruppen, in die jeder Klang faellt. */
export type Bus = 'music' | 'sfx' | 'ui'

/** In dieser Reihenfolge stehen sie auch in den Einstellungen: laut, mittel, leise. */
export const BUSES: readonly Bus[] = ['music', 'sfx', 'ui']

/** Ein Pegel je Bus, jeweils 0 bis 1. */
export type MixLevels = Record<Bus, number>

/**
 * Startwerte.
 *
 * Die Haelfte und nicht voll: Ein Spiel, das beim ersten Start in Zimmerlautstaerke
 * losbruellt, wird stummgeschaltet und nie wieder angeschaltet. Nach oben ist Platz.
 */
export function defaultMix(): MixLevels {
  return { music: 0.5, sfx: 0.5, ui: 0.5 }
}

export function isBus(value: unknown): value is Bus {
  return typeof value === 'string' && (BUSES as readonly string[]).includes(value)
}

/** Alles ausserhalb von 0..1 - und alles, was keine Zahl ist - faellt auf den Ersatzwert. */
export function clampLevel(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

/* === Die Bremse ============================================================ */

/**
 * Hoechster Wert, den der Formgeber ausgeben kann.
 *
 * Knapp unter eins und nicht genau eins: Was danach noch kommt - die Umrechnung auf die
 * Ausgabetiefe der Soundkarte - rundet, und eine Rundung auf genau 1,0 ist bereits der
 * Rand.
 */
export const CEILING = 0.98

/**
 * Bis hierher bleibt die Kennlinie eine Gerade.
 *
 * Alles unterhalb geht unveraendert durch - ein einzelner Schuss soll nicht deshalb anders
 * klingen, weil ein Limiter im Haus ist. Erst darueber beginnt das Nachgeben.
 */
export const SOFT_KNEE = 0.7

/**
 * Die Kennlinie der Bremse.
 *
 * Unter {@link SOFT_KNEE} die Identitaet, darueber ein Tangens hyperbolicus, der sich
 * {@link CEILING} naehert und ihn nie ueberschreitet - in Gleitkommarechnung erreicht er
 * ihn ab etwa dem Neunzehnfachen der Vollaussteuerung genau. Der Uebergang ist knickfrei: Bei
 * `SOFT_KNEE` ist die Steigung auf beiden Seiten genau 1, weil `tanh'(0) = 1` ist. Ein
 * Knick waere hoerbar - er erzeugt Obertoene genau dort, wo es ohnehin schon voll ist.
 */
export function softClip(x: number): number {
  if (!Number.isFinite(x)) return 0
  const magnitude = Math.abs(x)
  if (magnitude <= SOFT_KNEE) return x
  const span = CEILING - SOFT_KNEE
  const bent = SOFT_KNEE + span * Math.tanh((magnitude - SOFT_KNEE) / span)
  return x < 0 ? -bent : bent
}

/**
 * Anzahl der Stuetzstellen der Kennlinie.
 *
 * Ungerade, damit die Null **exakt** getroffen wird: Bei gerader Anzahl liegt zwischen den
 * beiden mittleren Punkten interpoliert eine winzige Verschiebung, und die haette das
 * Ruhesignal auf einen Gleichanteil gehoben.
 */
const CURVE_POINTS = 4097

/** Die Kennlinie als Wertetabelle fuer den `WaveShaper`, von -1 bis +1. */
export function softClipCurve(points: number = CURVE_POINTS): Float32Array<ArrayBuffer> {
  const count = Math.max(3, points | 1)
  const curve = new Float32Array(new ArrayBuffer(count * 4))
  for (let i = 0; i < count; i++) curve[i] = softClip((i / (count - 1)) * 2 - 1)
  return curve
}

/* === Der Aufbau ============================================================ */

export type Mixer = {
  /** Der Eingang einer Gruppe. Hier haengt sich jede Stimme ein. */
  bus(name: Bus): GainNode
  setLevel(name: Bus, value: number): void
  disconnect(): void
}

/**
 * Das Pult aufbauen und an ein Ziel haengen.
 *
 * `context` darf ein `OfflineAudioContext` sein - genau so wird der Aufbau nachgerechnet,
 * ohne dass jemand zuhoeren muss. Das ist kein Zugestaendnis an den Test: Wenn dieselbe
 * Funktion die Messung baut wie das Spiel, kann die Messung nicht am Spiel vorbeimessen.
 */
export function createMixer(
  context: BaseAudioContext,
  levels: MixLevels,
  destination: AudioNode = context.destination,
): Mixer {
  const sum = context.createGain()
  sum.gain.value = 1

  const limiter = context.createWaveShaper()
  limiter.curve = softClipCurve()
  // Ohne Ueberabtastung. Die Filter der Ueberabtastung schwingen ueber und koennten die
  // Zusage der Kennlinie um ein Haar verletzen - und genau diese Zusage ist der Zweck.
  limiter.oversample = 'none'

  sum.connect(limiter)
  limiter.connect(destination)

  // Als festes Feld und nicht als `Map`: `BUSES` deckt den Typ vollstaendig ab, also gibt
  // es hier keinen "unbekannten Bus" und damit auch keinen Fehlerzweig, den niemand je
  // erreicht. Wo nichts fehlschlagen kann, muss auch nichts geworfen werden.
  const gains = {} as Record<Bus, GainNode>
  for (const name of BUSES) {
    const gain = context.createGain()
    gain.gain.value = clampLevel(levels[name], 0)
    gain.connect(sum)
    gains[name] = gain
  }

  return {
    bus: (name) => gains[name],
    setLevel(name, value) {
      // Nicht hart setzen: Ein Sprung im Pegel ist ein Knacken. Zwanzig Millisekunden sind
      // zu kurz, um als Blende aufzufallen, und lang genug, um die Flanke zu brechen.
      const gain = gains[name].gain
      const now = context.currentTime
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(gain.value, now)
      gain.linearRampToValueAtTime(clampLevel(value, 0), now + 0.02)
    },
    disconnect() {
      for (const name of BUSES) gains[name].disconnect()
      sum.disconnect()
      limiter.disconnect()
    },
  }
}
