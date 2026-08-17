// Nimmt Standbilder aus dem Browser entgegen und legt sie auf die Platte.
//
// Warum ueberhaupt: Der Browser darf nicht schreiben, und das Bild als Text durch die
// Werkzeugkette zu reichen kostet Megabyte je Aufnahme. Also schickt die Seite das PNG
// hierher, und der Kritiker liest anschliessend eine Datei.
//
//   node tools/bildserver.mjs <zielordner> [port]
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ZIEL = resolve(process.argv[2] ?? 'standbilder')
const PORT = Number(process.argv[3] ?? 57900)

await mkdir(ZIEL, { recursive: true })

const server = createServer((anfrage, antwort) => {
  antwort.setHeader('access-control-allow-origin', '*')
  antwort.setHeader('access-control-allow-headers', '*')
  antwort.setHeader('access-control-allow-methods', 'POST, OPTIONS')

  if (anfrage.method === 'OPTIONS') { antwort.writeHead(204).end(); return }
  if (anfrage.method !== 'POST') { antwort.writeHead(405).end('nur POST'); return }

  const teile = []
  anfrage.on('data', (stueck) => teile.push(stueck))
  anfrage.on('end', async () => {
    try {
      const { name, bild } = JSON.parse(Buffer.concat(teile).toString('utf8'))
      // Nur einfache Namen: kein Pfadwechsel, keine Endung von aussen.
      const sauber = String(name).replace(/[^a-zA-Z0-9._-]/g, '_')
      const roh = Buffer.from(String(bild).replace(/^data:image\/png;base64,/, ''), 'base64')
      const pfad = resolve(ZIEL, `${sauber}.png`)
      await writeFile(pfad, roh)
      console.log(`${pfad}  ${roh.length} B`)
      antwort.writeHead(200, { 'content-type': 'application/json' })
      antwort.end(JSON.stringify({ pfad, bytes: roh.length }))
    } catch (fehler) {
      console.log(`fehler: ${fehler.message}`)
      antwort.writeHead(400).end(fehler.message)
    }
  })
})

// Dieser Dienst darf nicht sterben, waehrend Kritiker auf ihn zaehlen: Faellt er aus, misst
// niemand mehr etwas, und die Ursache steht in einem Protokoll, das keiner liest. Deshalb
// ueberlebt er einzelne Fehlschlaege lautstark, statt still zu verschwinden.
server.on('error', (fehler) => console.log(`Serverfehler: ${fehler.message}`))
server.on('clientError', (fehler, verbindung) => {
  console.log(`Verbindungsfehler: ${fehler.message}`)
  if (verbindung.writable) verbindung.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})
process.on('uncaughtException', (fehler) => console.log(`Unbehandelt: ${fehler.stack ?? fehler.message}`))
process.on('unhandledRejection', (grund) => console.log(`Unbehandeltes Versprechen: ${grund}`))

server.listen(PORT, '127.0.0.1', () => console.log(`Bildserver auf http://127.0.0.1:${PORT} -> ${ZIEL}`))
