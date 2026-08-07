import { readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

/**
 * Jeder Unterordner mit einer index.html ist ein eigener Prototyp und wird
 * automatisch als Build-Einstiegspunkt registriert. Ordner mit fuehrendem "_"
 * (z. B. _template) werden ignoriert.
 */
function prototypeEntries(): Record<string, string> {
  const entries: Record<string, string> = { hub: resolve(root, 'index.html') }

  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    if (dir.name.startsWith('_') || dir.name.startsWith('.') || dir.name === 'node_modules') continue

    const html = resolve(root, dir.name, 'index.html')
    if (existsSync(html)) entries[dir.name] = html
  }

  return entries
}

export default defineConfig({
  root,
  server: { port: 5174, open: true },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: prototypeEntries() },
  },
})

