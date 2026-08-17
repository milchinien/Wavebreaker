import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  // Fester Port fuer den Alltag; PORT setzt ihn um, damit zwei Sitzungen parallel
  // entwickeln koennen, ohne sich den Port wegzunehmen.
  server: { port: Number(process.env.PORT) || 5173, open: false },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
  },
  // Vite soll beim Start nur vom Spiel-Einstieg aus suchen und nicht den ganzen Baum
  // durchkaemmen. (Urspruenglich wegen des inzwischen entfernten Ordners "prototypes".)
  optimizeDeps: { entries: ['index.html'] },
})
