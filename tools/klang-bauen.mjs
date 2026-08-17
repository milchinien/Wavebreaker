/**
 * Baut aus dem Rohklangpaket die Aufnahmen, die das Spiel wirklich laedt.
 *
 *   node tools/klang-bauen.mjs
 *
 * Quelle ist `Assets/raw` (96 kHz, 24 Bit, Stereo - je Klang sechs Aufnahmen), Ziel ist
 * `public/sfx` (32 kHz, 16 Bit, Mono, beschnitten und ausgesteuert). Der Unterschied ist
 * nicht klein: Eine Rohdatei wiegt rund zwei Megabyte, weil hinter dem Klang mehrere
 * Sekunden Stille stehen; dieselbe Aufnahme beschnitten wiegt zwanzig Kilobyte. Ein
 * Browserspiel, das beim Start zweihundert Megabyte zieht, ist kein Browserspiel.
 *
 * Fuenf Schritte je Datei:
 *
 *   1. **Mono.** Zwei Kanaele gemittelt. Die Klaenge sind ohnehin mittig, und ein
 *      Kampfgeraeusch, das auf einer Seite lauter ist als auf der anderen, waere falsch:
 *      Auf dem Feld steht der Gegner nicht links oder rechts, sondern rundherum.
 *   2. **Beschneiden.** Vorne und hinten alles weg, was leiser als -50 dB ist - mit etwas
 *      Vorlauf, damit der Anschlag nicht angeschnitten wird, und mit Nachlauf fuer den
 *      Ausklang. Das spart mehr als alles andere.
 *   3. **Kuerzen.** Jeder Klang hat eine Obergrenze. Eine Explosion, die zwei Sekunden
 *      nachhallt, deckt bei acht Gegnern je Sekunde alles andere zu.
 *   4. **Umrechnen** auf 32 kHz. Linear interpoliert - bei einem Faktor von drei und
 *      Klaengen dieser Laenge hoert man den Unterschied zu einem teureren Verfahren nicht.
 *   5. **Blenden und aussteuern**, in dieser Reihenfolge: erst eine kurze Ein- und
 *      Ausblendung gegen das Knacken an den Schnittkanten, dann der gemeinsame
 *      Spitzenwert. Andersherum zog die Blende die Spitze wieder herunter - siehe
 *      {@link shape}.
 *
 * Die Varianten bleiben erhalten: Sechs Aufnahmen desselben Klangs sind der Grund, warum
 * hundert eingesammelte Muenzen nicht wie ein Maschinengewehr klingen. `app/audio.ts` waehlt
 * bei jedem Ton eine andere.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'Assets', 'raw')
const TARGET = join(ROOT, 'public', 'sfx')

/** Zielabtastrate. Hoch genug fuer die zappeligen Hoehen dieses Pakets, halb so teuer wie 64. */
const RATE = 32000

/** Unter dieser Lautstaerke gilt ein Abschnitt als Stille. -50 dB. */
const SILENCE = 0.00316

/** Vorlauf vor dem ersten und Nachlauf nach dem letzten hoerbaren Abschnitt, in Sekunden. */
const LEAD = 0.004
const TAIL = 0.045

/** Gemeinsamer Spitzenwert. Knapp unter Vollaussteuerung - der Rest ist Kopfraum im Mischer. */
const PEAK = 0.89

/** Ein- und Ausblendung gegen Knacken, in Sekunden. */
const FADE_IN = 0.003
const FADE_OUT = 0.03

/**
 * Was gebaut wird.
 *
 * `quelle` ist der Dateiname ohne `_HY_PC-00N.wav`, `takes` die Anzahl der Varianten (das
 * Paket liefert immer sechs, mehr als drei bringen bei den seltenen Ereignissen nichts) und
 * `sekunden` die Obergrenze.
 *
 * Die Zuordnung ist **nach Bedeutung** gewaehlt, nicht nach Dateinamen: Ein Levelaufstieg
 * bekommt den Klang, der aufsteigt, ein Verlust den, der abbricht.
 */
const PLAN = [
  /*
   * Das Aufheben - der haeufigste Klang im Spiel, deshalb alle sechs Varianten.
   *
   * **Nicht `Coin Toss`**, obwohl der Name danach klingt. Nachgemessen ist der 1,62 s lang,
   * hat seinen spektralen Schwerpunkt bei 320 Hz und traegt nur 3 % seiner Energie in den
   * ersten 30 ms - also ein langes, dumpfes Anschwellen. Das ist der Wurf einer Muenze durch
   * die Luft, nicht das Aufheben. Auf 0,7 s geschnitten blieb davon der Anlauf ohne den
   * Schluss uebrig, und genau so klang es dann auch.
   *
   * `Coin Impact` traegt 68 % seiner Energie in den ersten 30 ms - ein metallischer Schlag
   * mit Ausklang. Das ist der Klang, den man als Muenze erkennt, und er sitzt sofort statt
   * erst nach einer halben Sekunde. Geschnitten auf 0,42 s bleibt der Schlag samt Ausklang
   * und faellt trotzdem nicht mit sich selbst zusammen, wenn zehn Muenzen je Sekunde kommen.
   */
  { name: 'coin', quelle: 'DSGNTonl_SKILL IMPACT-Coin Impact', takes: 6, sekunden: 0.42 },
  { name: 'pod', quelle: 'DSGNTonl_USABLE-Magic Coin', takes: 3, sekunden: 1.0 },
  { name: 'poddrop', quelle: 'DSGNTonl_USABLE-Tonal Item', takes: 3, sekunden: 0.6 },

  // Kampf. Schuss und Abschuss laufen im Dauertakt und sind deshalb kurz gehalten.
  { name: 'shot', quelle: 'DSGNMisc_PROJECTILE-Laser Shot', takes: 4, sekunden: 0.45 },
  { name: 'crit', quelle: 'DSGNMisc_SKILL IMPACT-Critical Strike', takes: 3, sekunden: 0.6 },
  { name: 'kill', quelle: 'DSGNImpt_EXPLOSION-Small Flare', takes: 4, sekunden: 0.7 },
  { name: 'hurt', quelle: 'DSGNMisc_HIT-Mecha Armor Piercer', takes: 3, sekunden: 0.7 },

  // Zaesuren. Sie kommen selten und duerfen deshalb lang und breit sein.
  { name: 'bossin', quelle: 'MAGSpel_CAST-Sharp Summon', takes: 2, sekunden: 1.6 },
  { name: 'bossdown', quelle: 'DSGNImpt_EXPLOSION-Eruption', takes: 2, sekunden: 1.8 },
  { name: 'lost', quelle: 'DSGNImpt_EXPLOSION-Forced Shutdown', takes: 2, sekunden: 2.0 },
  { name: 'wavein', quelle: 'MAGSpel_CAST-Energy Riser', takes: 2, sekunden: 1.4 },
  { name: 'waveout', quelle: 'DSGNSynth_BUFF-Stats Up', takes: 2, sekunden: 1.1 },
  { name: 'level', quelle: 'DSGNSynth_BUFF-Mecha Level Up', takes: 2, sekunden: 1.4 },
  { name: 'prestige', quelle: 'MAGSpel_CAST-Complex Rise', takes: 2, sekunden: 2.4 },
  { name: 'event', quelle: 'DSGNTonl_SKILL IMPACT-Magic Sparkles', takes: 2, sekunden: 1.2 },

  // Faehigkeiten.
  { name: 'ability', quelle: 'DSGNSynth_CAST-Mecha Energy Gathering', takes: 3, sekunden: 1.2 },
  { name: 'ready', quelle: 'DSGNMisc_INTERFACE-Zap Select', takes: 2, sekunden: 0.5 },

  // Bedienung. Kurz, trocken, ohne Nachhall - sie kommen unter dem Kampf und duerfen ihn
  // nicht zudecken.
  { name: 'buy', quelle: 'UIClick_INTERFACE-Positive Click', takes: 3, sekunden: 0.4 },
  { name: 'build', quelle: 'DSGNSynth_BUFF-Mecha Lock In', takes: 2, sekunden: 0.9 },
  { name: 'trade', quelle: 'DSGNTonl_USABLE-Mecha Upgrade Equip', takes: 2, sekunden: 0.9 },
  { name: 'trader', quelle: 'WHSH_MOVEMENT-Mecha Ship Passby', takes: 2, sekunden: 1.6 },

  /*
   * Der Bedienklang.
   *
   * Bis hierher hatte das Spiel Klaenge fuer alles, was ihm zustiess, und keinen einzigen
   * fuer das, was der Spieler tut: Bauen, Umsetzen, Abreissen, Waehlen, Wechseln. Das ist
   * der Unterschied zwischen einem Programm und einem Geraet.
   *
   * Alle kurz und trocken geschnitten - sie kommen unter dem Kampf und duerfen ihn nicht
   * zudecken. Welches Ereignis welchen davon bekommt, steht in `src/app/soundplan.ts`.
   */
  { name: 'click', quelle: 'UIClick_INTERFACE-Metallic Click', takes: 3, sekunden: 0.3 },
  { name: 'swipe', quelle: 'DSGNMisc_INTERFACE-Phasey Swipe', takes: 3, sekunden: 0.45 },
  { name: 'lift', quelle: 'DSGNMisc_MOVEMENT-Phase Swish', takes: 2, sekunden: 0.4 },
  /*
   * Abreissen: ein tiefer Schlag, keine Explosion. Ein Modul wird abgehaengt, nicht
   * gesprengt - das Sprengen kommt eine Zeile tiefer beim Einschmelzen.
   *
   * Zuerst stand hier `Noise Decay` - dem Namen nach genau das, ein zerfallendes Rauschen.
   * Nachgemessen traegt der aber nur **1 %** seiner Energie in den ersten 30 ms: Er schwillt
   * an, statt zuzuschlagen, und kam damit nach dem Handgriff statt auf ihm. `Thud` traegt
   * **37 %** und liegt mit 2,2 kHz tief genug, um sich vom hellen Klickvolk zu trennen.
   */
  { name: 'scrap', quelle: 'DSGNImpt_EXPLOSION-Thud', takes: 2, sekunden: 0.55 },
  // Einschmelzen ist endgueltig - das darf brennen.
  { name: 'melt', quelle: 'DSGNImpt_EXPLOSION-Scorched', takes: 2, sekunden: 1.1 },
  { name: 'deal', quelle: 'DSGNTonl_USABLE-Magic Swipe', takes: 3, sekunden: 0.55 },
  // Waehlen. Auch hier entschied die Messung: `Mecha Selection` traegt 7 % seiner Energie
  // im Anschlag, `Mecha Generic Short` 54 % - eine Wahl ist ein Griff und kein Verlauf.
  { name: 'pick', quelle: 'DSGNSynth_BUFF-Mecha Generic Short', takes: 3, sekunden: 0.6 },
  { name: 'unlock', quelle: 'UIMisc_INTERFACE-Zap Select', takes: 2, sekunden: 0.55 },
  { name: 'equip', quelle: 'DSGNMisc_USABLE-Mecha Weapon Equip', takes: 2, sekunden: 0.6 },
  // Der Spielstand war nicht zu lesen. Das einzige "Nein" im ganzen Satz.
  { name: 'deny', quelle: 'UIMisc_INTERFACE-Denied', takes: 2, sekunden: 0.55 },
  { name: 'wipe', quelle: 'DSGNTonl_SKILL RELEASE-Mind Eraser', takes: 2, sekunden: 1.1 },
  // Die Drohne meldet sich, wenn man sie erreicht - und fliegt danach wieder weg.
  { name: 'hail', quelle: 'DSGNTonl_USABLE-Chirps', takes: 2, sekunden: 0.6 },
  { name: 'depart', quelle: 'WHSH_MOVEMENT-Mecha Cruiser Passby', takes: 2, sekunden: 1.4 },
]

// ---------------------------------------------------------------------------
// WAV lesen und schreiben
// ---------------------------------------------------------------------------

/**
 * Eine WAV-Datei in Mono-Gleitkommawerte aufloesen.
 *
 * Die Bloecke werden **durchlaufen** und nicht an festen Stellen erwartet: Die Dateien
 * dieses Pakets tragen zwischen `fmt ` und `data` einen `bext`-Block mit der Beschreibung
 * des Klangs, und ein Leser, der `data` bei Byte 36 vermutet, liest davon Rauschen.
 */
function readWav(path) {
  const buf = readFileSync(path)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: keine WAV-Datei`)
  }

  let format = null
  let data = null

  let at = 12
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4)
    const size = buf.readUInt32LE(at + 4)
    const body = at + 8

    if (id === 'fmt ') {
      format = {
        tag: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length))
    }

    // Bloecke stehen auf geraden Grenzen: Eine ungerade Laenge zieht ein Fuellbyte nach.
    at = body + size + (size % 2)
  }

  if (!format || !data) throw new Error(`${path}: fmt oder data fehlt`)
  if (format.tag !== 1) throw new Error(`${path}: nur unkomprimiertes PCM, nicht ${format.tag}`)

  const bytes = format.bits / 8
  const frames = Math.floor(data.length / (bytes * format.channels))
  const mono = new Float32Array(frames)

  for (let frame = 0; frame < frames; frame++) {
    let sum = 0
    for (let channel = 0; channel < format.channels; channel++) {
      const at = (frame * format.channels + channel) * bytes
      sum += readSample(data, at, format.bits)
    }
    mono[frame] = sum / format.channels
  }

  return { samples: mono, rate: format.rate }
}

/** Ein einzelner Abtastwert als -1 bis 1. Das Paket liefert 24 Bit; 16 und 32 gehen mit. */
function readSample(data, at, bits) {
  if (bits === 16) return data.readInt16LE(at) / 32768
  if (bits === 24) {
    const raw = data[at] | (data[at + 1] << 8) | (data[at + 2] << 16)
    // Das oberste Bit ist das Vorzeichen - ohne diese Zeile wird jeder negative Wert riesig.
    return (raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608
  }
  if (bits === 32) return data.readInt32LE(at) / 2147483648
  throw new Error(`${bits} Bit werden nicht gelesen`)
}

/** Mono-Gleitkommawerte als 16-Bit-WAV. */
function writeWav(path, samples, rate) {
  const body = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    body.writeInt16LE(Math.round(value * 32767), i * 2)
  }

  const head = Buffer.alloc(44)
  head.write('RIFF', 0, 'ascii')
  head.writeUInt32LE(36 + body.length, 4)
  head.write('WAVE', 8, 'ascii')
  head.write('fmt ', 12, 'ascii')
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(rate, 24)
  head.writeUInt32LE(rate * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36, 'ascii')
  head.writeUInt32LE(body.length, 40)

  writeFileSync(path, Buffer.concat([head, body]))
  return head.length + body.length
}

// ---------------------------------------------------------------------------
// Bearbeiten
// ---------------------------------------------------------------------------

/** Stille vorn und hinten abschneiden, mit Vorlauf und Nachlauf. */
function trim(samples, rate) {
  let first = 0
  while (first < samples.length && Math.abs(samples[first]) < SILENCE) first++
  if (first >= samples.length) return samples.subarray(0, 0)

  let last = samples.length - 1
  while (last > first && Math.abs(samples[last]) < SILENCE) last--

  const from = Math.max(0, first - Math.round(LEAD * rate))
  const to = Math.min(samples.length, last + Math.round(TAIL * rate))
  return samples.subarray(from, to)
}

/** Neue Abtastrate, linear zwischen den beiden Nachbarn interpoliert. */
function resample(samples, from, to) {
  if (from === to) return samples
  const length = Math.max(1, Math.round((samples.length * to) / from))
  const out = new Float32Array(length)
  const step = (samples.length - 1) / Math.max(1, length - 1)

  for (let i = 0; i < length; i++) {
    const at = i * step
    const left = Math.floor(at)
    const right = Math.min(samples.length - 1, left + 1)
    const share = at - left
    out[i] = samples[left] * (1 - share) + samples[right] * share
  }
  return out
}

/**
 * Die Schnittkanten weich machen und danach auf den gemeinsamen Spitzenwert bringen.
 *
 * **Die Reihenfolge ist der ganze Punkt.** Zuerst ausgesteuert und dann geblendet, hat die
 * Blende den Spitzenwert wieder heruntergezogen - und zwar genau bei den Klaengen, bei
 * denen es weh tut: Ein Klick hat seine Spitze in den ersten zwei Millisekunden, also
 * mitten in der drei Millisekunden langen Einblendung. Nachgemessen mit
 * `tools/klang-messen.mjs` kam `click` mit **0,61** heraus statt mit 0,89, `unlock` mit
 * 0,65, `ability` mit 0,69 - ein Drittel des Pegels, verloren an eine Blende, die nur das
 * Knacken an der Schnittkante verhindern soll.
 *
 * Das ist kein kleiner Schoenheitsfehler: Wenn die Aufnahmen unterschiedlich weit
 * ausgesteuert sind, sagt der Pegel im Klangplan nichts mehr darueber aus, was lauter ist.
 * Erst gleiche Aussteuerung macht die Zahlen dort vergleichbar.
 *
 * Umgekehrt kann die Blende die Spitze nicht mehr verschieben: Sie zieht das Signal nur
 * herunter, nie herauf, und was danach gemessen wird, ist der Wert, der wirklich
 * herauskommt.
 */
function shape(samples, rate) {
  const fadeIn = Math.min(Math.round(FADE_IN * rate), Math.floor(samples.length / 2))
  const fadeOut = Math.min(Math.round(FADE_OUT * rate), Math.floor(samples.length / 2))
  const out = new Float32Array(samples.length)

  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    let level = 1
    if (i < fadeIn) level *= i / fadeIn
    const left = samples.length - 1 - i
    if (left < fadeOut) level *= left / fadeOut
    out[i] = samples[i] * level
    peak = Math.max(peak, Math.abs(out[i]))
  }

  const gain = peak > 0 ? PEAK / peak : 1
  for (let i = 0; i < out.length; i++) out[i] *= gain
  return out
}

// ---------------------------------------------------------------------------
// Lauf
// ---------------------------------------------------------------------------

mkdirSync(TARGET, { recursive: true })

let files = 0
let bytes = 0
const missing = []

for (const entry of PLAN) {
  for (let take = 1; take <= entry.takes; take++) {
    const source = join(SOURCE, `${entry.quelle}_HY_PC-${String(take).padStart(3, '0')}.wav`)
    if (!existsSync(source)) {
      missing.push(source)
      continue
    }

    const { samples, rate } = readWav(source)
    let work = trim(samples, rate)

    const limit = Math.round(entry.sekunden * rate)
    if (work.length > limit) work = work.subarray(0, limit)

    work = resample(work, rate, RATE)
    work = shape(work, RATE)

    const out = join(TARGET, `${entry.name}-${take}.wav`)
    const size = writeWav(out, work, RATE)
    files += 1
    bytes += size

    const seconds = (work.length / RATE).toFixed(2)
    console.log(`${entry.name}-${take}  ${seconds}s  ${(size / 1024).toFixed(0)} kB`)
  }
}

console.log(`\n${files} Dateien, ${(bytes / 1024 / 1024).toFixed(2)} MB in public/sfx`)
if (missing.length > 0) {
  console.log(`\nNicht gefunden (${missing.length}):`)
  for (const path of missing) console.log(`  ${path}`)
  process.exitCode = 1
}
