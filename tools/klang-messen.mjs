/**
 * Was in `public/sfx` wirklich liegt - in Zahlen.
 *
 *   node tools/klang-messen.mjs              alle Klaenge
 *   node tools/klang-messen.mjs click deny   nur diese
 *   node tools/klang-messen.mjs --schreiben  Lautheitstabelle nach src/app/soundplan.ts
 *
 * Der Klangsatz wird gebaut, eingebunden und danach geglaubt. Diese Messung ist der
 * Gegenbeweis zum Glauben: Sie sagt, ob eine Aufnahme das ist, wofuer sie eingesetzt wird.
 *
 * Fuenf Zahlen je Klang, und jede beantwortet eine Frage, die man sonst nur ahnt:
 *
 *   **Laenge**    Wie lange deckt dieser Klang alles andere zu? Ein Bedienklang von einer
 *                 Sekunde ist keine Quittung mehr, sondern ein Vorgang.
 *   **Spitze**    Steht sie unter eins? Der Bauplan steuert auf 0,89 aus; deutlich weniger
 *                 heisst, dass der Zuschnitt den Anschlag abgeschnitten hat.
 *   **Lautheit**  Siehe {@link loudness} - die einzige der fuenf Zahlen, die etwas darueber
 *                 sagt, wie **laut** eine Aufnahme ankommt.
 *   **Anschlag**  Wieviel Prozent der Energie liegen in den ersten 30 ms? Ueber 50 % ist ein
 *                 Schlag, unter 15 % ein Anschwellen. Ein Klick, der anschwillt, kommt zu
 *                 spaet - er sitzt nicht auf dem Zeigerdruck, sondern daneben.
 *   **Schwerpunkt** Wo liegt die Energie im Spektrum? Zwei Klaenge, die sich im selben
 *                 Band draengen, verdecken einander; die Bedienung soll ueber dem Kampf
 *                 liegen, nicht in ihm.
 *
 * Es wird nichts bewertet und nichts durchgewunken - hier stehen Zahlen, und die
 * Entscheidung faellt danach.
 *
 * ---
 *
 * **Warum die Lautheit dazugekommen ist.** Die Spitze ist hier bei **jeder** Aufnahme 0,89 -
 * der Bauplan steuert genau darauf aus. Ein Pegel im Klangplan, der gegen die Spitze gesetzt
 * wird, ist damit gegen eine Konstante gesetzt und sagt ueber die Lautstaerke nichts aus. Ein
 * Klick von 0,18 s und eine Drohne von 1,60 s haben dieselbe Spitze und liegen trotzdem
 * zwoelf Dezibel auseinander. Genau daran ist die Zusage "die Quittung bleibt leiser als das,
 * was sie quittiert" bis hierher vorbeigegangen: Sie stand in der Datei, sie stand im Test -
 * und sie war gemessen falsch.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SFX = join(ROOT, 'public', 'sfx')
const PLAN = join(ROOT, 'src', 'app', 'soundplan.ts')

/** Fenster fuer den Anschlag, in Sekunden. */
const ATTACK = 0.03

/**
 * Fenster der Momentanlautheit, in Sekunden.
 *
 * Vierhundert Millisekunden, wie in ITU-R BS.1770 fuer die Momentanlautheit: Das ist die
 * Zeit, ueber die das Ohr Schallereignisse zu **einer** Lautheit zusammenzieht. Kuerzer
 * gemessen gewinnt jeder Anschlag, laenger gemessen gewinnt jeder Nachhall.
 */
const WINDOW = 0.4

/** Schrittweite, mit der das Fenster ueber die Aufnahme wandert. */
const HOP = 0.01

/** Eine WAV-Datei (16 Bit, Mono, wie `klang-bauen.mjs` sie schreibt) in Werte aufloesen. */
function readWav(path) {
  const buf = readFileSync(path)
  let rate = 0
  let bits = 0
  let channels = 1
  let data = null

  let at = 12
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4)
    const size = buf.readUInt32LE(at + 4)
    const body = at + 8
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2)
      rate = buf.readUInt32LE(body + 4)
      bits = buf.readUInt16LE(body + 14)
    } else if (id === 'data') {
      data = buf.subarray(body, body + size)
    }
    at = body + size + (size % 2)
  }
  if (!data || bits !== 16) throw new Error(`${path}: kein 16-Bit-PCM`)

  const count = Math.floor(data.length / 2 / channels)
  const samples = new Float32Array(count)
  for (let i = 0; i < count; i++) samples[i] = data.readInt16LE(i * 2 * channels) / 32768
  return { samples, rate }
}

/**
 * Der spektrale Schwerpunkt, ueber eine grobe Fourier-Zerlegung.
 *
 * Grob genug ist hier reichlich: Gefragt ist die Groessenordnung - dumpf, mittig, hell -,
 * nicht die dritte Stelle. Gerechnet wird auf 512 Punkten in der lautesten Stelle des
 * Klangs, weil dort steht, was man hoert.
 */
function centroid(samples, rate) {
  const size = 512
  let start = 0
  let best = 0
  for (let i = 0; i + size <= samples.length; i += size) {
    let energy = 0
    for (let k = 0; k < size; k++) energy += samples[i + k] * samples[i + k]
    if (energy > best) {
      best = energy
      start = i
    }
  }

  let sum = 0
  let weight = 0
  for (let bin = 1; bin < size / 2; bin++) {
    let real = 0
    let imag = 0
    for (let k = 0; k < size; k++) {
      // Von-Hann-Fenster gegen die Kanten des Ausschnitts.
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (size - 1))
      const angle = (-2 * Math.PI * bin * k) / size
      const value = (samples[start + k] ?? 0) * window
      real += value * Math.cos(angle)
      imag += value * Math.sin(angle)
    }
    const magnitude = Math.sqrt(real * real + imag * imag)
    sum += magnitude * ((bin * rate) / size)
    weight += magnitude
  }
  return weight > 0 ? sum / weight : 0
}

/**
 * Die Momentanlautheit: der Effektivwert im lautesten 400-ms-Fenster.
 *
 * Geteilt wird **immer** durch die volle Fensterlaenge, auch wenn die Aufnahme kuerzer ist
 * als das Fenster. Das ist keine Nachlaessigkeit, sondern der Kern der Sache: Ein Klick von
 * 0,26 s fuellt das Fenster zu zwei Dritteln mit Stille, und genau so laut kommt er auch an -
 * neben einem Ton, der die vollen 400 ms traegt, ist er der leisere, obwohl beide dieselbe
 * Spitze haben. Wer statt dessen durch die tatsaechliche Laenge teilte, bekaeme fuer den
 * Klick denselben Wert wie fuer eine Sirene und haette wieder nichts gemessen.
 *
 * Ohne Frequenzbewertung. Die K-Bewertung aus BS.1770 hebt alles ueber 2 kHz um vier
 * Dezibel an; bei einem Klangsatz, dessen Schwerpunkte zwischen 1,3 und 10,7 kHz liegen,
 * verschiebt das die Rangfolge nach Helligkeit statt nach Lautstaerke. Verglichen werden
 * hier Klaenge desselben Spiels ueber denselben Regler - dafuer ist der unbewertete
 * Effektivwert die ehrlichere Zahl, weil in ihr nichts steckt, was nicht gemessen wurde.
 */
function loudness(samples, rate) {
  const window = Math.round(WINDOW * rate)
  const hop = Math.round(HOP * rate)
  let best = 0
  for (let start = 0; start === 0 || start < samples.length; start += hop) {
    let sum = 0
    const end = Math.min(start + window, samples.length)
    for (let i = start; i < end; i++) sum += samples[i] * samples[i]
    best = Math.max(best, sum / window)
  }
  return Math.sqrt(best)
}

function measure(path) {
  const { samples, rate } = readWav(path)
  let peak = 0
  let total = 0
  let head = 0
  const headEnd = Math.round(ATTACK * rate)
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i]
    peak = Math.max(peak, Math.abs(value))
    const energy = value * value
    total += energy
    if (i < headEnd) head += energy
  }
  return {
    seconds: samples.length / rate,
    peak,
    loudness: loudness(samples, rate),
    attack: total > 0 ? head / total : 0,
    centroid: centroid(samples, rate),
  }
}

const args = process.argv.slice(2)
const writeTable = args.includes('--schreiben')
const wanted = args.filter((name) => !name.startsWith('--'))
const files = readdirSync(SFX)
  .filter((name) => name.endsWith('.wav'))
  .filter((name) => wanted.length === 0 || wanted.some((pick) => name.startsWith(`${pick}-`)))
  .sort()

/** Nach Klang zusammengefasst: Die Varianten eines Klangs muessen sich gleichen. */
const groups = new Map()
for (const file of files) {
  const name = file.replace(/-\d+\.wav$/, '')
  const result = measure(join(SFX, file))
  const list = groups.get(name) ?? []
  list.push(result)
  groups.set(name, list)
}

/** Die Lautheit eines Klangs ist das Mittel seiner Varianten - gespielt wird eine davon. */
const loud = new Map()
for (const [name, list] of groups) {
  loud.set(name, list.reduce((sum, entry) => sum + entry.loudness, 0) / list.length)
}

console.log('Klang       Varianten  Laenge     Spitze  Lautheit       dB  Anschlag  Schwerpunkt')
for (const [name, list] of [...groups].sort()) {
  const mean = (pick) => list.reduce((sum, entry) => sum + pick(entry), 0) / list.length
  const span = (pick) => `${Math.min(...list.map(pick)).toFixed(2)}-${Math.max(...list.map(pick)).toFixed(2)}`
  console.log(
    `${name.padEnd(12)}${String(list.length).padStart(5)}` +
      `${span((entry) => entry.seconds).padStart(13)}s` +
      `${mean((entry) => entry.peak).toFixed(2).padStart(8)}` +
      `${loud.get(name).toFixed(4).padStart(10)}` +
      `${(20 * Math.log10(loud.get(name))).toFixed(1).padStart(9)}` +
      `${(mean((entry) => entry.attack) * 100).toFixed(0).padStart(9)}%` +
      `${mean((entry) => entry.centroid).toFixed(0).padStart(11)} Hz`,
  )
}

/* === Die Tabelle in den Klangplan schreiben ================================ */

/**
 * `--schreiben` traegt die gemessene Lautheit als `LOUDNESS` in `src/app/soundplan.ts` ein.
 *
 * Warum die Zahlen kopiert werden und nicht zur Laufzeit entstehen: Der Selbsttest laeuft
 * ohne Browser und ohne die 56 WAV-Dateien; er braucht die Lautheit als Wert, nicht als
 * Versprechen. Und ein Wert, der im Quelltext steht, faellt beim Lesen auf - einer, der
 * beim Start gerechnet wird, nie.
 *
 * Ersetzt wird ausschliesslich der Block zwischen den beiden Marken. Alles davor und
 * dahinter - Kommentar, Begruendung, Handarbeit - bleibt unberuehrt.
 */
const BEGIN = '/* gemessen: tools/klang-messen.mjs --schreiben */'
const END = '/* Ende der gemessenen Tabelle */'

if (writeTable) {
  if (wanted.length > 0) {
    console.error('\n--schreiben braucht alle Klaenge - ohne Auswahl aufrufen.')
    process.exit(1)
  }
  const source = readFileSync(PLAN, 'utf8')
  const from = source.indexOf(BEGIN)
  const to = source.indexOf(END)
  if (from < 0 || to < 0) {
    console.error(`\nDie Marken fehlen in ${PLAN} - nichts geschrieben.`)
    process.exit(1)
  }
  const rows = [...loud]
    .sort()
    .map(([name, value]) => `  ${name}: ${value.toFixed(4)},`)
    .join('\n')
  const block = `${BEGIN}\nexport const LOUDNESS: Record<string, number> = {\n${rows}\n}\n${END}`
  writeFileSync(PLAN, source.slice(0, from) + block + source.slice(to + END.length))
  console.log(`\n${loud.size} Lautheiten nach src/app/soundplan.ts geschrieben.`)
}
