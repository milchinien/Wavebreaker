import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  /*
   * Relative Adressen im Bau, statt alles an der Wurzel der Domain zu suchen.
   *
   * itch.io serviert ein Browserspiel aus einem Unterordner (`.../html/<nummer>/`). Mit
   * dem sonst ueblichen `/` verwiese die gebaute `index.html` auf `/assets/index.js` -
   * und das liegt dort nicht. Mit `./` steht alles neben der `index.html`, und damit
   * laeuft dasselbe Paket auf itch.io, in einem Unterordner und an der Wurzel.
   *
   * Fuer Bilder und Klaenge aus `public/` reicht das allein nicht: Adressen, die als
   * Zeichenkette im Code stehen, sieht Vite nicht. Die gehen ueber `app/assets.ts`.
   */
  base: './',
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
