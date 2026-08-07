import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

const dir = 'C:/Users/michi/AppData/Local/Temp/claude/E--spiele-Desktop-The-Tower/8fccefee-fea8-4ba3-9a8c-205fe35c5336/scratchpad'

createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200, { 'access-control-allow-origin': '*' })
    res.end('ok')
    return
  }
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    const name = (req.url || '/shot').replace(/[^a-z0-9-]/gi, '') || 'shot'
    const base64 = body.slice(body.indexOf(',') + 1)
    writeFileSync(`${dir}/${name}.png`, Buffer.from(base64, 'base64'))
    console.log('geschrieben:', name, body.length)
    res.writeHead(200, { 'access-control-allow-origin': '*' })
    res.end('ok')
  })
}).listen(45997, () => console.log('bereit auf 45997'))

