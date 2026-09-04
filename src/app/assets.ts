/**
 * Wo die Dateien aus `public/` im Netz liegen.
 *
 * Ein fest geschriebenes `/icons/gold.svg` sucht die Datei an der **Wurzel der Domain**.
 * Das stimmt genau so lange, wie das Spiel dort auch liegt - und auf itch.io tut es das
 * nicht: Dort steht es in einem Unterordner (`.../html/<nummer>/`), und jede solche Adresse
 * ginge ins Leere. Der Fehler waere dazu ein stiller: Ein Bild, das 404 sagt, sagt nichts,
 * es bleibt einfach leer.
 *
 * Also fragt niemand mehr die Domain, sondern diesen Ort - und der steht an genau einer
 * Stelle, naemlich `base` in `vite.config.ts`. Im Entwicklungsbetrieb ist er `/`, im Bau
 * `./`, also **neben der `index.html`**, wo immer die auch liegt.
 */

/**
 * `import.meta.env` gibt es nur unter Vite. Der Selbsttest laeuft in node und zieht `ui/`
 * und `render/` mit herein; ein Absturz beim Laden dieses Moduls waere dort kein
 * Fehlerbericht, sondern ein fehlender Test.
 */
const BASE = import.meta.env?.BASE_URL ?? '/'

/**
 * Adresse einer Datei aus `public/` - **ohne** fuehrenden Schraegstrich:
 * `asset('icons/gold.svg')`.
 */
export function asset(path: string): string {
  return BASE + path
}
