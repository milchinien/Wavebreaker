import { readFileSync, writeFileSync } from 'node:fs'

const ENTRY = [
  '- **Licht hinter den Menüs** (2026-08-03) — In Basis, Prestige und Einstellungen ziehen jetzt',
  '  vierzehn weit weichgezeichnete Bahnen in Cyan bis Violett schräg durch den Grund, mit 14 bis',
  '  30 Pixeln je Sekunde. Sie blenden beim Bereichswechsel auf und ab statt zu erscheinen, hängen',
  '  am Effekt-Schalter und werden auf einem Viertel der Kantenlänge gezeichnet und hochgezogen —',
  '  die Weichzeichnung, von der der Effekt lebt, kostet dadurch fast nichts.',
  '  Wo kein Kampf läuft, stand vorher ein Standbild: dunkle Fläche, Raster, fertig. Jetzt ist der',
  '  Grund ein Raum, in dem Licht steht. Im Kampf bleibt er unberührt — dort wären dieselben Bahnen',
  '  eine zweite Bewegung neben der, auf die man achten soll.',
  '',
]

const target = process.argv[2]
const source = readFileSync(target, 'utf8')
const eol = source.includes('\r\n') ? '\r\n' : '\n'
const marker = `## Erledigt${eol}${eol}`
const at = source.indexOf(marker)

if (at < 0) throw new Error(`Marke "## Erledigt" fehlt in ${target}`)
if (source.includes('Licht hinter den Menüs')) throw new Error(`Eintrag steht schon in ${target}`)

const head = source.slice(0, at + marker.length)
const rest = source.slice(at + marker.length)
writeFileSync(target, head + ENTRY.join(eol) + eol + rest, 'utf8')
console.log('eingetragen in', target)

