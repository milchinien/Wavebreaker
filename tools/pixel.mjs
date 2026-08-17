// Liest Bildpunkte aus einem PNG — ohne Browser, ohne Fremdpaket.
//
// Warum: Die Standbilder liegen als Datei vor, und wer sie nachmessen will, sollte dafuer
// nicht den einen Browser-Tab belegen, an dem gerade jemand anders arbeitet. node:zlib
// bringt alles mit, was ein Canvas-PNG braucht (8 Bit, RGBA, Farbtyp 6).
//
//   node tools/pixel.mjs <bild.png> punkt 724,125 720,163 ...
//   node tools/pixel.mjs <bild.png> zeile 400
//   node tools/pixel.mjs <bild.png> gebiet 700,100,60,140
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

/** Entpackt ein PNG zu { breite, hoehe, daten } mit vier Bytes je Bildpunkt. */
export function lesePng (pfad) {
  const roh = readFileSync(pfad)
  if (roh.readUInt32BE(0) !== 0x89504e47) throw new Error('kein PNG')

  let pos = 8
  let breite = 0, hoehe = 0, tiefe = 0, farbtyp = 0
  const teile = []
  while (pos < roh.length) {
    const laenge = roh.readUInt32BE(pos)
    const art = roh.toString('ascii', pos + 4, pos + 8)
    const inhalt = roh.subarray(pos + 8, pos + 8 + laenge)
    if (art === 'IHDR') {
      breite = inhalt.readUInt32BE(0); hoehe = inhalt.readUInt32BE(4)
      tiefe = inhalt[8]; farbtyp = inhalt[9]
    } else if (art === 'IDAT') teile.push(inhalt)
    else if (art === 'IEND') break
    pos += 12 + laenge
  }
  if (tiefe !== 8 || farbtyp !== 6) throw new Error(`nur 8-Bit-RGBA, hier Tiefe ${tiefe} Farbtyp ${farbtyp}`)

  const roh2 = inflateSync(Buffer.concat(teile))
  const kanaele = 4
  const zeile = breite * kanaele
  const daten = Buffer.alloc(hoehe * zeile)

  // PNG legt vor jede Zeile ein Filterbyte; jede Zeile bezieht sich auf die Zeile darueber.
  for (let y = 0; y < hoehe; y++) {
    const filter = roh2[y * (zeile + 1)]
    const quelle = roh2.subarray(y * (zeile + 1) + 1, y * (zeile + 1) + 1 + zeile)
    const ziel = daten.subarray(y * zeile, (y + 1) * zeile)
    const oben = y > 0 ? daten.subarray((y - 1) * zeile, y * zeile) : null
    for (let i = 0; i < zeile; i++) {
      const a = i >= kanaele ? ziel[i - kanaele] : 0
      const b = oben ? oben[i] : 0
      const c = oben && i >= kanaele ? oben[i - kanaele] : 0
      let wert = quelle[i]
      if (filter === 1) wert += a
      else if (filter === 2) wert += b
      else if (filter === 3) wert += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        wert += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      ziel[i] = wert & 0xff
    }
  }
  return { breite, hoehe, daten }
}

export const punkt = (bild, x, y) => {
  const i = (y * bild.breite + x) * 4
  return { r: bild.daten[i], g: bild.daten[i + 1], b: bild.daten[i + 2], a: bild.daten[i + 3] }
}

/** Helligkeit nach Rec. 709 — dieselbe Groesse, mit der die Kritiker rechnen. */
export const helligkeit = (p) => 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b

/** Buntheit als max minus min: 0 heisst neutrales Grau. */
export const buntheit = (p) => Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b)

if (process.argv[1]?.endsWith('pixel.mjs')) {
  const [, , pfad, befehl, ...rest] = process.argv
  const bild = lesePng(pfad)
  if (befehl === 'punkt') {
    for (const eintrag of rest) {
      const [x, y] = eintrag.split(',').map(Number)
      const p = punkt(bild, x, y)
      console.log(`${x},${y}  rgb(${p.r},${p.g},${p.b}) a=${p.a}  L=${helligkeit(p).toFixed(1)}  Buntheit=${buntheit(p)}`)
    }
  } else if (befehl === 'zeile') {
    const y = Number(rest[0])
    const werte = []
    for (let x = 0; x < bild.breite; x++) werte.push(Math.round(helligkeit(punkt(bild, x, y))))
    console.log(`Zeile ${y}: Maximum ${Math.max(...werte)} bei x=${werte.indexOf(Math.max(...werte))}`)
    console.log(werte.join(','))
  } else if (befehl === 'gebiet') {
    const [x0, y0, w, h] = rest[0].split(',').map(Number)
    let hellster = { L: -1 }
    const zaehler = new Map()
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const p = punkt(bild, x, y), L = helligkeit(p)
      if (L > hellster.L) hellster = { L, x, y, p }
      if (L > 60) {
        const schluessel = `${Math.round(p.r / 32) * 32},${Math.round(p.g / 32) * 32},${Math.round(p.b / 32) * 32}`
        zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1)
      }
    }
    console.log(`hellster: ${hellster.x},${hellster.y} rgb(${hellster.p.r},${hellster.p.g},${hellster.p.b}) L=${hellster.L.toFixed(1)}`)
    console.log('haeufigste hellen Farben:', [...zaehler.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([f, n]) => `${f} x${n}`).join('  '))
  } else {
    console.log('Befehle: punkt x,y ...  |  zeile y  |  gebiet x,y,b,h')
  }
}
