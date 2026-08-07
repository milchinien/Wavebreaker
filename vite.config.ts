import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  server: { port: 5173, open: false },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
  },
  // Der Ordner "prototypes" ist ein eigenes, abgeschlossenes Projekt und gehoert
  // nicht zum Spiel. Ohne diese Einschraenkung durchsucht Vite ihn beim Start mit.
  optimizeDeps: { entries: ['index.html'] },
})

