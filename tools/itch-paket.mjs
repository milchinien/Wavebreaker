/**
 * Schnuert aus `dist/` das Zip, das itch.io haben will.
 *
 *   npm run itch          bauen und packen
 *   node tools/itch-paket.mjs   nur packen, aus dem vorhandenen dist/
 *
 * itch.io nimmt ein Zip, in dem die `index.html` **ganz oben** liegt - nicht in einem
 * Unterordner. Genau das entsteht hier: der Inhalt von `dist/`, ohne den Ordner selbst.
 *
 * Zwei Dinge macht das Werkzeug ueber das blosse Packen hinaus:
 *
 *   - **Die Messseiten bleiben draussen.** In `public/` liegen vier Werkzeugseiten und zwei
 *     Ordner, die zur Entwicklung gehoeren und nicht zum Spiel (`klangmessung.html`,
 *     `probe/` und die anderen). Vite kopiert alles aus `public/` mit; hier faellt es
 *     wieder heraus. Das ist rund ein Viertel des Pakets.
 *   - **Es sagt, was drin ist.** Zahl der Dateien und die Groesse, damit man nach dem
 *     Packen nicht raten muss, ob das Richtige drin gelandet ist.
 *
 * Geschrieben wird das Zip von Hand aus `node:zlib` - dieselbe Linie wie `tools/pixel.mjs`:
 * Ein Format, das aus drei Bloecken besteht, ist kein Grund fuer ein Fremdpaket.
 */

import { createWriteStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateRawSync } from 'node:zlib'

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUELLE = join(WURZEL, 'dist')
const ZIEL = join(WURZEL, 'wavebreaker-itch.zip')

/**
 * Was zur Entwicklung gehoert und nicht zum Spiel. Pfade relativ zur Wurzel des Pakets,
 * ein Ordnername trifft auch alles darunter.
 */
const DRAUSSEN = new Set([
  'klangmessung.html',
  'klangprobe.html',
  'mischpult-messung.html',
  'musikmessung.html',
  'probe',
  'politur',
])

/**
 * Feste Uhrzeit statt der echten: Dieselbe `dist` soll dasselbe Zip ergeben. Sonst
 * unterscheiden sich zwei Pakete desselben Standes in jedem Zeitstempel, und ein Vergleich
 * sagt nichts mehr. 1. Januar 2024, 00:00 in der DOS-Schreibweise des Formats.
 */
const DOS_ZEIT = 0
const DOS_DATUM = ((2024 - 1980) << 9) | (1 << 5) | 1

async function dateien(ordner, vorsatz = '') {
  const gefunden = []
  for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
    const pfad = vorsatz ? `${vorsatz}/${eintrag.name}` : eintrag.name
    if (DRAUSSEN.has(pfad)) continue
    if (eintrag.isDirectory()) gefunden.push(...(await dateien(join(ordner, eintrag.name), pfad)))
    else gefunden.push(pfad)
  }
  return gefunden
}

/** Ein Eintrag: oertlicher Kopf plus Daten, dazu die Zeile fuers Verzeichnis am Ende. */
function eintrag(name, roh, versatz) {
  const daten = deflateRawSync(roh, { level: 9 })
  const pruefsumme = crc32(roh)
  const nameBytes = Buffer.from(name, 'utf8')

  const kopf = Buffer.alloc(30)
  kopf.writeUInt32LE(0x04034b50, 0)
  kopf.writeUInt16LE(20, 4) // benoetigte Fassung
  kopf.writeUInt16LE(0x0800, 6) // Namen sind UTF-8
  kopf.writeUInt16LE(8, 8) // Verfahren: deflate
  kopf.writeUInt16LE(DOS_ZEIT, 10)
  kopf.writeUInt16LE(DOS_DATUM, 12)
  kopf.writeUInt32LE(pruefsumme, 14)
  kopf.writeUInt32LE(daten.length, 18)
  kopf.writeUInt32LE(roh.length, 22)
  kopf.writeUInt16LE(nameBytes.length, 26)
  kopf.writeUInt16LE(0, 28) // kein Zusatzfeld

  const verzeichnis = Buffer.alloc(46)
  verzeichnis.writeUInt32LE(0x02014b50, 0)
  verzeichnis.writeUInt16LE(20, 4) // erzeugende Fassung
  verzeichnis.writeUInt16LE(20, 6)
  verzeichnis.writeUInt16LE(0x0800, 8)
  verzeichnis.writeUInt16LE(8, 10)
  verzeichnis.writeUInt16LE(DOS_ZEIT, 12)
  verzeichnis.writeUInt16LE(DOS_DATUM, 14)
  verzeichnis.writeUInt32LE(pruefsumme, 16)
  verzeichnis.writeUInt32LE(daten.length, 20)
  verzeichnis.writeUInt32LE(roh.length, 24)
  verzeichnis.writeUInt16LE(nameBytes.length, 28)
  verzeichnis.writeUInt32LE(versatz, 42)

  return {
    stueck: [kopf, nameBytes, daten],
    verzeichnis: [verzeichnis, nameBytes],
    laenge: kopf.length + nameBytes.length + daten.length,
  }
}

async function main() {
  try {
    await stat(join(QUELLE, 'index.html'))
  } catch {
    console.error('Kein dist/index.html - erst "npm run build" laufen lassen.')
    process.exitCode = 1
    return
  }

  const namen = (await dateien(QUELLE)).sort()
  const stuecke = []
  const verzeichnis = []
  let versatz = 0

  for (const name of namen) {
    const roh = await readFile(join(QUELLE, name))
    const e = eintrag(name, roh, versatz)
    stuecke.push(...e.stueck)
    verzeichnis.push(...e.verzeichnis)
    versatz += e.laenge
  }

  const verzeichnisLaenge = verzeichnis.reduce((summe, teil) => summe + teil.length, 0)
  const schluss = Buffer.alloc(22)
  schluss.writeUInt32LE(0x06054b50, 0)
  schluss.writeUInt16LE(namen.length, 8)
  schluss.writeUInt16LE(namen.length, 10)
  schluss.writeUInt32LE(verzeichnisLaenge, 12)
  schluss.writeUInt32LE(versatz, 16)

  const paket = Buffer.concat([...stuecke, ...verzeichnis, schluss])
  await new Promise((fertig, fehler) => {
    const strom = createWriteStream(ZIEL)
    strom.on('error', fehler)
    strom.on('finish', fertig)
    strom.end(paket)
  })

  const mb = (paket.length / 1024 / 1024).toFixed(1)
  console.log(`${relative(WURZEL, ZIEL)}  ${namen.length} Dateien, ${mb} MB`)
  console.log(`index.html liegt oben: ${namen.includes('index.html') ? 'ja' : 'NEIN'}`)
}

await main()
