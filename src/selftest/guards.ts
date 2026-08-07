/**
 * Die Querschnittsregeln aus Abschnitt 9 des Implementierungsplans, als Pruefung statt
 * als Vorsatz. Sie gehoeren zur Abnahme **jeder** Etappe.
 *
 * Braucht das Dateisystem und laeuft deshalb nur im headless-Lauf (`npm run selftest`),
 * nicht im Browser. Kommentare werden vor der Suche entfernt - sonst schlaegt jede Regel
 * an, die irgendwo erklaert wird.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestResult } from '../core/assert.ts'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type Rule = {
  name: string
  /** Ordner unterhalb von `src/`, die geprueft werden. */
  folders: string[]
  pattern: RegExp
  /** Pfade (relativ zu `src/`), an denen das Muster erlaubt ist. */
  allow: string[]
  hint: string
}

const RULES: Rule[] = [
  {
    name: 'sim/ und core/ fassen kein DOM und kein Canvas an',
    folders: ['core', 'sim'],
    pattern: /\b(document|getElementById|querySelector|HTMLCanvasElement|getContext)\b/,
    allow: [],
    hint: 'Die Offline-Simulation und die Selbsttests muessen ohne Browser laufen.',
  },
  {
    name: 'Zeit kommt nur aus core/loop.ts',
    folders: ['core', 'sim', 'app', 'data', 'render', 'ui'],
    pattern: /\b(Date\.now|performance\.now)\s*\(/,
    allow: ['core/loop.ts'],
    hint: 'Voraussetzung fuer x2/x4, Offline-Berechnung und reproduzierbare Tests.',
  },
  {
    name: 'Zufall kommt nur aus core/rng.ts',
    folders: ['core', 'sim', 'app', 'data', 'render', 'ui'],
    pattern: /\bMath\.random\s*\(/,
    allow: ['core/rng.ts'],
    hint: 'Ohne Seed ist ein Balancing-Fehler nicht nachstellbar.',
  },
  {
    name: 'Belohnungen entstehen nur in app/rewards.ts',
    folders: ['core', 'sim', 'app', 'data', 'render', 'ui'],
    pattern: /\.\s*(gold|xp|prestigePoints)\s*(\+=|-=|=[^=])/,
    allow: ['app/rewards.ts'],
    hint: 'Spaetere Werbe-Belohnungen haengen sich an grantReward (GDD 16 Abschnitt 2).',
  },
]

/**
 * Zeilen, in denen eine Zeichenkette technisch ist und kein Spielertext sein kann -
 * Klassennamen, Ereignisnamen, Stilangaben, Auswahlpfade.
 */
const TECHNICAL_LINE =
  /className|classList|class=|dataset|style\.|setProperty|addEventListener|removeEventListener|createElement|getElementById|querySelector|\.type =|dispatchEvent|[Ff]ont/

/**
 * Sucht Spielertexte, die im Code stehen statt in `data/strings.ts` (Plan Abschnitt 9).
 *
 * Heuristik: eine Zeichenkette, aus der nach Abzug von HTML-Auszeichnung und
 * Platzhaltern noch mindestens zwei Woerter uebrig bleiben. Ein Fehlalarm ist hier kein
 * Schaden - er ist die Aufforderung, kurz hinzusehen.
 */
function findHardcodedText(source: string): string[] {
  const found: string[] = []

  for (const [index, line] of source.split('\n').entries()) {
    if (TECHNICAL_LINE.test(line)) continue
    if (/^\s*(import|export)\b/.test(line)) continue

    for (const match of line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const raw = match[2] ?? ''
      // Modulpfade und Schluessel wie 'stat.damage' sind keine Spielertexte.
      if (raw.includes('/') || raw.startsWith('.')) continue

      const text = raw
        .replace(/\$\{[^}]*\}/g, '') // Platzhalter
        .replace(/<[^>]*>/g, '') // HTML-Auszeichnung
        .replace(/&\w+;/g, '')
        .trim()

      // Schluessel wie 'detail.none' enthalten nie ein Leerzeichen, Saetze immer.
      if (!/\s/.test(text)) continue

      const words = text.match(/[A-Za-z]{3,}/g) ?? []
      if (words.length >= 2) found.push(`${index + 1}  ${text}`)
    }
  }

  return found
}

function listFiles(folder: string): string[] {
  const root = join(SRC, folder)
  const found: string[] = []
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return found // Ordner gibt es in dieser Etappe noch nicht
  }
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) found.push(...listFiles(join(folder, entry.name)))
    else if (entry.name.endsWith('.ts')) found.push(full)
  }
  return found
}

/** Kommentare entfernen, damit erklaerender Text keine Regel ausloest. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

export function runGuards(): TestResult[] {
  const results: TestResult[] = [textRule(), overlayPointerRule()]

  for (const rule of RULES) {
    const offenders: string[] = []

    for (const folder of rule.folders) {
      for (const file of listFiles(folder)) {
        const relativePath = relative(SRC, file).replace(/\\/g, '/')
        if (rule.allow.includes(relativePath)) continue

        const lines = stripComments(readFileSync(file, 'utf8')).split('\n')
        lines.forEach((line, index) => {
          if (rule.pattern.test(line)) offenders.push(`${relativePath}:${index + 1}  ${line.trim()}`)
        })
      }
    }

    results.push({
      suite: 'querschnittsregeln',
      name: rule.name,
      ok: offenders.length === 0,
      ...(offenders.length > 0 ? { message: `${rule.hint}\n      ${offenders.join('\n      ')}` } : {}),
    })
  }

  return results
}

/**
 * Die Overlay-Ebene darf den Zeiger nicht pauschal an sich reissen.
 *
 * Diese Regel ist aus einem echten Fehler entstanden, und zwar einem besonders unangenehmen:
 * Der Prestige-Blitz (`.surge`) liegt ueber der ganzen Flaeche und hatte `pointer-events:
 * none` sauber im Stilblatt stehen. Wirkungslos - denn `#overlay > *` zaehlt als Kennung
 * (1-0-0) und schlaegt jede Klassenregel (0-1-0). Ab da schluckte ein unsichtbarer Schleier
 * jede Zeigerbewegung, und **das Einsammeln von Gold war tot** - die zentrale aktive
 * Handlung des Spiels (GDD 08 Abschnitt 2).
 *
 * Am Bild ist so etwas nicht zu finden: Es sieht alles richtig aus, und im Stilblatt steht
 * die richtige Zeile. Deshalb steht die Regel hier und nicht im Kommentar.
 *
 * Geprueft wird die **Staerke**, nicht die Wirkung: Ein Waehler, der alle Kinder der Ebene
 * anschaltet, muss in `:where()` stehen und damit null zaehlen. Dann kann ihn jede
 * gewoehnliche Klassenregel wieder abschalten - so, wie es jeder erwartet, der eine neue
 * Anzeige dazulegt.
 */
function overlayPointerRule(): TestResult {
  const offenders: string[] = []

  let source = ''
  try {
    source = readFileSync(join(SRC, 'style.css'), 'utf8')
  } catch {
    return {
      suite: 'querschnittsregeln',
      name: 'die Overlay-Ebene reisst den Zeiger nicht an sich',
      ok: false,
      message: 'src/style.css ist nicht lesbar',
    }
  }

  // Kommentare heraus, sonst schlaegt die Regel auf ihrer eigenen Erklaerung an - genau
  // wie bei den Suchregeln oben. Die Zeilennummern bleiben dabei erhalten.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))

  for (const [index, line] of stripped.split('\n').entries()) {
    // Ein Sammelwaehler auf die Kinder der Ebene - mit `:where()` unbedenklich, ohne nicht.
    if (!/#overlay\s*>\s*\*/.test(line)) continue
    if (/:where\s*\(\s*#overlay\s*\)/.test(line)) continue
    offenders.push(`style.css:${index + 1}  ${line.trim()}`)
  }

  return {
    suite: 'querschnittsregeln',
    name: 'die Overlay-Ebene reisst den Zeiger nicht an sich',
    ok: offenders.length === 0,
    ...(offenders.length > 0
      ? {
          message:
            'Ein Waehler dieser Staerke schlaegt jede Klassenregel. Eine Anzeige, die sich mit\n' +
            '      `pointer-events: none` aus dem Weg nehmen will, bleibt wirkungslos und schluckt\n' +
            '      jede Zeigerbewegung darunter. Schreib `:where(#overlay) > *`.\n      ' +
            offenders.join('\n      '),
        }
      : {}),
  }
}

/** Jeder Spielertext kommt aus data/strings.ts - geprueft in `ui/` und `render/`. */
function textRule(): TestResult {
  const offenders: string[] = []

  for (const folder of ['ui', 'render']) {
    for (const file of listFiles(folder)) {
      const relativePath = relative(SRC, file).replace(/\\/g, '/')
      const source = stripComments(readFileSync(file, 'utf8'))
      for (const hit of findHardcodedText(source)) {
        offenders.push(`${relativePath}:${hit}`)
      }
    }
  }

  return {
    suite: 'querschnittsregeln',
    name: 'jeder Spielertext kommt aus data/strings.ts',
    ok: offenders.length === 0,
    ...(offenders.length > 0
      ? {
          message:
            'Eine deutsche Fassung soll spaeter ohne Codeaenderung moeglich sein (GDD 16 Abschnitt 1).\n      ' +
            offenders.join('\n      '),
        }
      : {}),
  }
}
