// Baut aus vielen kleinen PNGs (Farbtyp 3, 8 Bit) eine Uebersichtsgrafik.
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

function decode(file) {
  const buf = fs.readFileSync(file)
  let pos = 8
  let width = 0, height = 0, palette = null, alpha = null
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4) }
    if (type === 'PLTE') palette = data
    if (type === 'tRNS') alpha = data
    if (type === 'IDAT') idat.push(data)
    pos += len + 12
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(width)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    const line = Buffer.from(raw.subarray(p, p + width))
    p += width
    for (let x = 0; x < width; x++) {
      const a = x >= 1 ? line[x - 1] : 0
      const b = prev[x]
      const c = x >= 1 ? prev[x - 1] : 0
      if (filter === 1) line[x] = (line[x] + a) & 255
      else if (filter === 2) line[x] = (line[x] + b) & 255
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        line[x] = (line[x] + pred) & 255
      }
    }
    for (let x = 0; x < width; x++) {
      const idx = line[x]
      const o = (y * width + x) * 4
      out[o] = palette[idx * 3]
      out[o + 1] = palette[idx * 3 + 1]
      out[o + 2] = palette[idx * 3 + 2]
      out[o + 3] = alpha && idx < alpha.length ? alpha[idx] : 255
    }
    prev = line
  }
  return { width, height, data: out }
}

function encode(width, height, data) {
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const chunks = []
  function chunk(type, body) {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length)
    const head = Buffer.concat([Buffer.from(type, 'ascii'), body])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(head) >>> 0)
    chunks.push(len, head, crc)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6
  chunk('IHDR', ihdr)
  chunk('IDAT', zlib.deflateSync(raw))
  chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks])
}

let table = null
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return c ^ -1
}

// --- Zusammensetzen ---
const root = process.argv[2]
const target = process.argv[3]
const cell = 34
const folders = fs.readdirSync(root).sort((a, b) => Number(a) - Number(b))
const cols = Math.max(...folders.map((f) => fs.readdirSync(path.join(root, f)).length))
const W = cols * cell, H = folders.length * cell
const canvas = Buffer.alloc(W * H * 4)
// Dunkler Grund, damit die Umrisse sichtbar sind.
for (let i = 0; i < W * H; i++) { canvas[i * 4] = 10; canvas[i * 4 + 1] = 13; canvas[i * 4 + 2] = 26; canvas[i * 4 + 3] = 255 }

folders.forEach((folder, row) => {
  fs.readdirSync(path.join(root, folder)).sort().forEach((file, col) => {
    const img = decode(path.join(root, folder, file))
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const s = (y * img.width + x) * 4
        const a = img.data[s + 3] / 255
        if (a === 0) continue
        const dx = col * cell + 1 + x, dy = row * cell + 1 + y
        if (dx >= W || dy >= H) continue
        const d = (dy * W + dx) * 4
        for (let k = 0; k < 3; k++) canvas[d + k] = Math.round(img.data[s + k] * a + canvas[d + k] * (1 - a))
      }
    }
  })
})

fs.writeFileSync(target, encode(W, H, canvas))
console.log(`${W} x ${H}`, target)

