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
import { LEAGUES } from '../data/leagues.ts'
import { STRINGS } from '../data/strings.ts'
import { upgradeIcon, UPGRADES, WINDOW_SLOTS } from '../data/upgrades.ts'

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
    name: 'der Gedraenge-Halbmesser bleibt im Gedraenge',
    folders: ['core', 'sim', 'app', 'data', 'render', 'ui'],
    pattern: /\bcrowdRadius\b/,
    allow: ['sim/enemies.ts'],
    hint: 'Er ist der gezeichnete Umriss, nicht der Koerper - wer damit trifft, zielt, andockt oder Reichweite misst, macht aus einer Frage der Darstellung eine Regel.',
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
  const results: TestResult[] = [
    textRule(),
    burstLayerRule(),
    hpBarLayerRule(),
    effectGlowRule(),
    overlayPointerRule(),
    catalogWiringRule(),
    upgradeIconRule(),
    upgradeTileRule(),
    leagueRowRule(),
    hintSettleRule(),
    ...resourceBarRules(),
  ]

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

/**
 * Ein geladener Spielstand wird mit der Hinweisreihe abgeglichen.
 *
 * `settleHints` ist die einzige Stelle, an der die Reihe erfaehrt, dass dieser Spielstand
 * schon etwas hinter sich hat - und sie wird von genau einer Zeile in `main.ts` gerufen.
 * Faellt die Zeile weg, faellt nichts aus, nichts wird rot, und niemand merkt es: Das Spiel
 * laeuft weiter und spielt einem Spielstand auf Welle 40 die Anfaengerreihe von vorn vor.
 * Genau solche stummen Verluste sind der Grund fuer diese Regeln.
 */
function hintSettleRule(): TestResult {
  const name = 'ein geladener Spielstand loest die Hinweisreihe nicht neu aus'
  let source = ''
  try {
    source = stripComments(readFileSync(join(SRC, 'main.ts'), 'utf8'))
  } catch {
    return { suite: 'querschnittsregeln', name, ok: false, message: 'src/main.ts ist nicht lesbar' }
  }

  const ok = /\bsettleHints\s*\(/.test(source)
  return {
    suite: 'querschnittsregeln',
    name,
    ok,
    ...(ok
      ? {}
      : {
          message:
            'In main.ts fehlt der Aufruf von settleHints nach dem Laden. Ohne ihn beginnt die\n' +
            '      Reihe bei jedem alten Spielstand von vorn (sim/hints.ts).',
        }),
  }
}

/*
 * === Die Ressourcenzeile ===================================================
 *
 * Sie ist die einzige Anzeige, die keinem Bereich gehoert (`.resource-bar`, siehe
 * `ui/hud.ts` und `style.css`): Gold, Stufe und Prestige sind das, womit bezahlt wird, und
 * bezahlt wird in jedem Bereich. Vorher stand das Gold nur im Kampf und in den Upgrades und
 * die Prestigepunkte nur in ihrem eigenen Panel - wer kaufen wollte, verliess genau den
 * Bereich, in dem der Kontostand stand.
 *
 * Warum das eine Regel und kein Kommentar ist: Der Rueckfall kostet **eine Zeile**. Ein
 * `#app[data-view='combat'] .resource-bar` an der falschen Stelle, ein zweites `top:` in
 * einer Medienabfrage, zwei Ressourcen in derselben Farbe - nichts davon wird rot, nichts
 * davon faellt beim Spielen im eigenen Bereich auf. Auffallen wuerde es erst dem Spieler,
 * der wechselt.
 *
 * Geprueft wird deshalb genau das, was die Zusage ausmacht:
 *
 *   1. Keine Regel macht die Zeile von einem Bereich abhaengig oder blendet sie aus.
 *   2. Ihr Ort steht an **einer** Stelle - kein zweites Regelwerk verschiebt sie irgendwo.
 *   3. Jede Ressource traegt ihre eigene Farbe, und keine zwei teilen sich eine.
 */

/** Die drei Ressourcen der Zeile: Klasse im Stilblatt, Farbrolle daneben. */
const RESOURCES = [
  { name: 'level', color: '--res-level' },
  { name: 'gold', color: '--res-gold' },
  { name: 'prestige', color: '--res-prestige' },
]

/** Was den Ort eines Knotens festlegt. Zweimal gesetzt heisst: zwei moegliche Orte. */
const PLACEMENT = /(^|;)\s*(position|top|left|right|bottom|transform)\s*:/

type CssRule = { selector: string; body: string }

/**
 * Das Stilblatt in seine **innersten** Regeln zerlegen.
 *
 * Der Waehler darf keine geschweifte Klammer enthalten, der Rumpf auch nicht - damit passt
 * das Muster nie auf `@media`, sondern immer nur auf die Regeln darin. Genau das ist hier
 * gewollt: Eine Regel in einer Medienabfrage zaehlt wie jede andere.
 */
function cssRules(source: string): CssRule[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const rules: CssRule[] = []
  for (const hit of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: (hit[1] ?? '').trim(), body: hit[2] ?? '' })
  }
  return rules
}

function resourceBarRules(): TestResult[] {
  const suite = 'querschnittsregeln'
  let css = ''
  let hud = ''
  try {
    css = readFileSync(join(SRC, 'style.css'), 'utf8')
    hud = readFileSync(join(SRC, 'ui/hud.ts'), 'utf8')
  } catch {
    return [
      {
        suite,
        name: 'die Ressourcenzeile steht in jedem Bereich',
        ok: false,
        message: 'src/style.css oder src/ui/hud.ts ist nicht lesbar',
      },
    ]
  }

  const rules = cssRules(css)
  const own = rules.filter((rule) =>
    rule.selector.split(',').some((part) => /\.resource-bar\b/.test(part)),
  )

  // --- 1. An keinem Bereich, und nirgends ausgeblendet ---------------------
  const bound: string[] = []
  for (const rule of own) {
    for (const part of rule.selector.split(',')) {
      if (!/\.resource-bar\b/.test(part)) continue
      if (/\[data-view/.test(part)) bound.push(`an einen Bereich gebunden: ${part.trim()}`)
    }
    if (/(^|;)\s*display\s*:\s*none/.test(rule.body)) {
      bound.push(`ausgeblendet: ${rule.selector}`)
    }
  }
  // Auch der umgekehrte Weg: eine Sammelregel, die sie zusammen mit den Bereichspanels
  // ausblendet, traegt den Waehler in einer Liste - oben schon erfasst - oder gar nicht.
  if (own.length === 0) bound.push('im Stilblatt steht keine einzige Regel fuer .resource-bar')

  // --- 2. Ein Ort, an einer Stelle gesetzt --------------------------------
  const places = own.filter(
    (rule) => rule.selector.replace(/\s+/g, ' ').trim() === '.resource-bar' && PLACEMENT.test(rule.body),
  )

  // --- 3. Eine Farbe je Ressource ----------------------------------------
  const colors: string[] = []
  const missing: string[] = []
  for (const resource of RESOURCES) {
    const declared = css.match(new RegExp(`${resource.color}\\s*:\\s*(#[0-9a-fA-F]{3,8})`))
    if (!declared || !declared[1]) {
      missing.push(`${resource.color} steht nicht in :root`)
    } else {
      colors.push(declared[1].toLowerCase())
    }

    const segment = own.find(
      (rule) => rule.selector.replace(/\s+/g, ' ').trim() === `.resource-bar .res.${resource.name}`,
    )
    if (!segment || !new RegExp(`--res\\s*:\\s*var\\(\\s*${resource.color}\\s*\\)`).test(segment.body)) {
      missing.push(`.resource-bar .res.${resource.name} holt seine Farbe nicht aus ${resource.color}`)
    }

    // Die Klasse muss auch wirklich an einem Segment haengen, sonst faerbt die Regel nichts.
    if (!new RegExp(`'${resource.name}'`).test(hud)) {
      missing.push(`ui/hud.ts baut kein Segment mit der Klasse ${resource.name}`)
    }
  }

  const shared = colors.length !== new Set(colors).size
  const segments = own.find((rule) => rule.selector.replace(/\s+/g, ' ').trim() === '.resource-bar .res')
  if (!segments || !/color\s*:\s*var\(\s*--res\s*\)/.test(segments.body)) {
    missing.push('.resource-bar .res nimmt seine Textfarbe nicht aus --res')
  }

  return [
    {
      suite,
      name: 'die Ressourcenzeile haengt an keinem Bereich',
      ok: bound.length === 0,
      ...(bound.length > 0
        ? {
            message:
              'Wer im Prestige-Baum kauft, muss sehen, was er hat (GDD 13 Abschnitt 4).\n      ' +
              bound.join('\n      '),
          }
        : {}),
    },
    {
      suite,
      name: 'die Ressourcenzeile hat genau einen Ort',
      ok: places.length === 1,
      ...(places.length === 1
        ? {}
        : {
            message:
              `${places.length} Regeln setzen den Ort von .resource-bar. Zwei Orte heissen: In\n` +
              '      einem Bereich steht sie anders als im naechsten, und der Wechsel ruckt.',
          }),
    },
    {
      suite,
      name: 'jede Ressource traegt ihre eigene Farbe',
      ok: missing.length === 0 && !shared,
      ...(missing.length === 0 && !shared
        ? {}
        : {
            message:
              'An der Farbe findet man seine Zahl, bevor man das Zeichen daneben ansieht.\n      ' +
              [...missing, ...(shared ? [`zwei Ressourcen teilen sich eine Farbe: ${colors.join(' ')}`] : [])].join(
                '\n      ',
              ),
          }),
    },
  ]
}

/**
 * Der Abschuss liegt ueber den lebenden Gegnern.
 *
 * Die Regel steht hier und nicht im Auge des Betrachters, weil sie am fertigen Bild nur im
 * Gedraenge auffaellt - und wer eine Ebene verschiebt, sieht sich das leere Feld an. Lagen
 * Druckwelle und Splitter hinter dem Pulk, verschwand der Abschuss genau dann, wenn es voll
 * wurde, also genau dann, wenn er zaehlte.
 *
 * Geprueft wird die Reihenfolge in `render/scene.ts`, weil dort die einzige Stelle ist, an
 * der sie steht (siehe Kopf jener Datei).
 */
function burstLayerRule(): TestResult {
  const source = stripComments(readFileSync(join(SRC, 'render/scene.ts'), 'utf8'))
  const at = (name: string): number => source.indexOf(`${name}(ctx`)
  const enemies = at('drawEnemies')
  const bursts = at('drawBursts')
  const shards = at('drawShards')

  const found = enemies >= 0 && bursts >= 0 && shards >= 0
  const ok = found && bursts > enemies && shards > enemies

  return {
    suite: 'querschnittsregeln',
    name: 'der Abschuss liegt ueber den lebenden Gegnern',
    ok,
    ...(ok
      ? {}
      : {
          message:
            'Druckwelle und Splitter werden nach den Gegnern gezeichnet, sonst deckt der Pulk\n      ' +
            'den Augenblick zu, auf den das ganze Bild hinarbeitet (GDD 13 Abschnitt 10).\n      ' +
            `gefunden: drawEnemies@${enemies} drawBursts@${bursts} drawShards@${shards}`,
        }),
  }
}

/**
 * Der Lebensbalken liegt ueber jedem Effekt und unter den Zahlen.
 *
 * Er ist die einzige dauerhafte Auskunft im Feld, die einem einzelnen Gegner gehoert, und
 * damit der einzige Strich, den kein Effekt anfassen darf. Am leeren Feld sieht man davon
 * nichts - dort liegt ueber einem Balken ohnehin selten etwas. Erst im Pulk zeigte sich der
 * Schaden: Ein einzelner Trefferblitz auf dem richtigen Fleck loeschte einen Balken
 * vollstaendig aus, gemessen 0 von 54 Bildpunkten. Ausgerechnet der Trefferblitz - er
 * erscheint dort, wo Schaden entsteht, also an dem Gegner, dessen Balken sich gerade aendert.
 *
 * Nach oben ist die Ebene genauso begrenzt: ueber den Schadenszahlen hat der Balken nichts
 * verloren. Die Zahl ist fluechtig und steigt aus dem Bild, der Balken bleibt liegen - eine
 * bleibende Flaeche ueber einer fluechtigen Schrift frisst diese auf.
 *
 * Geprueft wird in `render/scene.ts`, weil dort die einzige Stelle ist, an der die
 * Reihenfolge steht (siehe Kopf jener Datei).
 */
function hpBarLayerRule(): TestResult {
  const source = stripComments(readFileSync(join(SRC, 'render/scene.ts'), 'utf8'))
  const at = (name: string): number => source.indexOf(`${name}(ctx`)
  const bars = at('drawHpBars')
  const hits = at('drawHits')
  const numbers = at('drawDamageNumbers')

  const found = bars >= 0 && hits >= 0 && numbers >= 0
  const ok = found && bars > hits && bars < numbers

  return {
    suite: 'querschnittsregeln',
    name: 'der Lebensbalken liegt ueber jedem Effekt und unter den Zahlen',
    ok,
    ...(ok
      ? {}
      : {
          message:
            'Die Lebensbalken werden nach dem letzten Effekt und vor den Schadenszahlen\n      ' +
            'gezeichnet, sonst loescht ein Trefferblitz die Anzeige des Gegners, den er\n      ' +
            'gerade trifft (GDD 13 Abschnitt 10).\n      ' +
            `gefunden: drawHits@${hits} drawHpBars@${bars} drawDamageNumbers@${numbers}`,
        }),
  }
}

/**
 * Jeder kurzlebige Kampfeffekt traegt einen Hof.
 *
 * Das Feld ist ein Bild aus brennenden Neonroehren. Ein Effekt ohne Streuung ist darin kein
 * schwaecherer Effekt, sondern ein **anderes Material**: ein mit dem Lineal gezogener Strich
 * zwischen lauter leuchtenden Koerpern. Und er ist vor allem duenn - ein Haarstrich traegt
 * ein paar Dutzend Bildpunkte, ein Hof traegt die Flaeche darum mit.
 *
 * Die Regel steht hier, weil genau das schon zweimal passiert ist: `drawHits` war einmal der
 * matte Strich, danach war es `drawBursts`. Nachgemessen hob der ganze Zerfall ohne Hof 42
 * Bildpunkte ueber Helligkeit 150 - weniger als eine einzelne herumliegende Muenze mit 97.
 * Der Abschuss war damit weniger wert als Kleingeld, das niemand aufgehoben hat.
 *
 * Geprueft wird der Rumpf jeder genannten Funktion in `render/combat.ts` auf `shadowBlur`.
 * Ob der Wert gross genug ist, entscheidet das Auge am Standbild - dass er ueberhaupt
 * gesetzt wird, entscheidet diese Regel.
 */
function effectGlowRule(): TestResult {
  const source = stripComments(readFileSync(join(SRC, 'render/combat.ts'), 'utf8'))
  // Der Rumpf reicht von der Signatur bis zur naechsten Funktion auf oberster Ebene.
  const parts = source.split(/\nexport function (\w+)/)
  const bodies = new Map<string, string>()
  for (let i = 1; i < parts.length; i += 2) {
    bodies.set(parts[i] as string, parts[i + 1] as string)
  }

  const required = ['drawHits', 'drawBursts', 'drawShards', 'drawMuzzles']
  const offenders = required.filter((name) => !(bodies.get(name) ?? '').includes('shadowBlur'))

  return {
    suite: 'querschnittsregeln',
    name: 'jeder Kampfeffekt traegt einen Hof',
    ok: offenders.length === 0,
    ...(offenders.length > 0
      ? {
          message:
            'Ohne Streuung ist der Effekt ein matter Strich und verschwindet im Pulk\n      ' +
            '(GDD 13 Abschnitt 10). Fehlt in: ' +
            offenders.join(', '),
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

/*
 * === Hier fehlt eine Regel: die Breite der Upgrade-Kachel ====================
 *
 * An dieser Stelle stand bis zum Upgrade-Umbau (Etappe E2, `docs/upgrade-umbau.md`) die
 * Regel `upgradeGridRule` - der aufwendigste Waechter des Projekts. Sie rechnete fuer jede
 * Fensterbreite von 320 bis 3840 px nach, wie breit eine Kachel wird, und hielt das Ergebnis
 * gegen die Zeichen, die in ihr Wertfeld passen mussten.
 *
 * Sie ist **entfallen, weil es beides nicht mehr gibt**: kein Wertfeld auf der Kachel und
 * keine Gruppen, unter denen eine Spaltenbreite aufgeteilt wird. Jede einzelne Zahl, mit der
 * sie rechnete, beschrieb ein Panel, das in E5 durch ein festes 2x10-Raster ersetzt wird.
 * Eine Regel stehenzulassen, die etwas anderes nachmisst als das, was gebaut ist, waere
 * schlimmer als keine - genau das war ihre eigene Lehre: "Ein Waechter, der den schlimmsten
 * Fall nicht kennt, ist schlimmer als keiner - er sagt, es sei nachgesehen worden."
 *
 * **Was sie ersetzen muss, steht schon fest** (`docs/upgrade-umbau.md` Abschnitt 8.4): Die
 * Kachel ist quadratisch, es sind immer zehn je Reihe, und sie darf 44 px nicht
 * unterschreiten; darunter rutscht die Navileiste unter das Panel. Das ist eine einfachere
 * Rechnung als die alte, und sie gehoert wieder hierher, sobald das Raster in E5 steht.
 *
 * Bis dahin ist dies die einzige Zusage des Projekts, die vorsaetzlich ungeprueft ist.
 */

/*
 * === Jeder Katalogwert wird auch gelesen =====================================
 *
 * Der teuerste Fehler, den ein Upgrade-Katalog machen kann, ist ein Eintrag, der Gold nimmt
 * und nichts bewirkt. Bei der alten Schleifenfassung war er praktisch ausgeschlossen - dort
 * hatte jeder Pfad denselben Effekt. Bei sechzig von Hand geschriebenen Eintraegen mit
 * eigenen Schluesseln ist er der wahrscheinlichste ueberhaupt: Der Datensatz steht, der
 * Preis stimmt, die Kachel erscheint - nur liest den Wert niemand.
 *
 * `selftest/suites/upgrades.ts` prueft, dass sich die **Summe** bewegt. Dass diese Summe
 * irgendwo **ankommt**, kann nur eine Suche im Quelltext beantworten, und deshalb steht die
 * Regel hier.
 *
 * **Die Ausnahmeliste ist der Fahrplan.** Sie zaehlt die Schluessel auf, deren Mechanik noch
 * aussteht, und schrumpft mit jeder Etappe. Zwei Dinge macht sie unmoeglich, und beide sind
 * der Grund fuer ihre Form: Ein **neuer** toter Schluessel faellt sofort auf, weil er nicht
 * in der Liste steht. Und ein Schluessel, der laengst verdrahtet ist, faellt ebenso auf -
 * die Regel meldet auch die Eintraege, die hier ueberfluessig geworden sind. Eine
 * Ausnahmeliste, die man nur ergaenzen und nie leeren kann, waere in einem Jahr eine
 * Sammlung von Behauptungen.
 */

/**
 * Schluessel, deren Leseseite in der Simulation noch fehlt.
 *
 * **Seit Etappe E3 ist sie leer**, und das ist die Abnahme dieser Etappe: Jeder Sonderwert
 * und jede Regel des Katalogs wird irgendwo gelesen. Sie bleibt trotzdem stehen - wer einen
 * neuen Schluessel anlegt, dessen Mechanik noch aussteht, traegt ihn hier ein und sieht am
 * Eintrag selbst, dass noch etwas zu tun ist.
 */
const UNWIRED: readonly string[] = []

function catalogWiringRule(): TestResult {
  const name = 'jeder Sonderwert und jede Regel des Katalogs wird irgendwo gelesen'
  const suite = 'querschnittsregeln'

  // Gesucht wird in allem, was den Katalog auswerten darf. `data/` ist bewusst nicht dabei:
  // Dort steht der Schluessel selbst, und die Liste faende sich immer.
  let haystack = ''
  for (const folder of ['sim', 'app', 'render', 'ui']) {
    for (const file of listFiles(folder)) {
      haystack += stripComments(readFileSync(file, 'utf8'))
    }
  }

  const keys = new Set<string>()
  for (const def of UPGRADES) {
    const effect = def.effect
    if (effect.kind === 'special') keys.add(effect.key)
    else if (effect.kind === 'rule') keys.add(effect.id)
  }

  const missing: string[] = []
  for (const key of keys) {
    if (haystack.includes(`'${key}'`)) continue
    if (UNWIRED.includes(key)) continue
    missing.push(key)
  }

  // Die Gegenrichtung: Ausnahmen, die es nicht mehr braucht.
  const stale = UNWIRED.filter((key) => haystack.includes(`'${key}'`))

  const problems: string[] = []
  if (missing.length > 0) {
    problems.push(
      `Diese Werte nimmt der Katalog entgegen, aber niemand liest sie: ${missing.join(', ')}`,
    )
  }
  if (stale.length > 0) {
    problems.push(
      `Diese stehen als "noch offen" in UNWIRED, sind aber laengst verdrahtet: ${stale.join(', ')}`,
    )
  }

  return {
    suite,
    name,
    ok: problems.length === 0,
    ...(problems.length > 0
      ? {
          message:
            'Ein Upgrade, das Gold nimmt und nichts bewirkt, faellt beim Spielen nie auf.\n      ' +
            problems.join('\n      '),
        }
      : {}),
  }
}

/*
 * === Jede Kachel hat ihr Bild ================================================
 *
 * Seit E5 steht auf der Kachel nichts als das Bild. Ein fehlendes ist damit nicht mehr ein
 * fehlendes Zeichen neben einem Namen, sondern eine **leere Kachel** - und leere Kacheln
 * sehen aus wie freie Plaetze. Der Fehler waere also nicht bloss haesslich, sondern
 * irrefuehrend: Er behauptet, das Fenster habe noch Raum.
 */
function upgradeIconRule(): TestResult {
  const name = 'jedes Upgrade hat sein Bild'
  const missing: string[] = []

  for (const def of UPGRADES) {
    const file = join(SRC, '..', 'public', 'icons', 'upgrades', `${upgradeIcon(def)}.svg`)
    try {
      readFileSync(file)
    } catch {
      missing.push(`${def.id} -> icons/upgrades/${upgradeIcon(def)}.svg`)
    }
  }

  return {
    suite: 'querschnittsregeln',
    name,
    ok: missing.length === 0,
    ...(missing.length > 0
      ? {
          message:
            'Eine Kachel ohne Bild sieht aus wie ein freier Platz.\n      ' +
            missing.join('\n      '),
        }
      : {}),
  }
}

/*
 * === Die Kachel bleibt gross genug ===========================================
 *
 * Der Nachfolger der alten `upgradeGridRule` - und viel einfacher als sie, weil das Raster
 * es ist. Zehn Spalten stehen fest; was mitgeht, ist die Kachelgroesse. Damit haengt die
 * Rechnung nur noch an einer Zahl, die woanders steht: der Spaltenzahl im Stilblatt.
 *
 * Geprueft wird die Untergrenze von 44 px. Darunter ist die Zeichnung in der Kachel nicht
 * mehr als Zeichnung zu erkennen - und ein Menue aus Bildern, deren Bild man nicht erkennt,
 * ist schlechter als eines aus Namen.
 */

/** Schmalste Kachel, bei der ein 24er-Zeichen noch als Zeichen lesbar ist. */
const MIN_TILE = 44
/**
 * Was zwischen Fensterkante und Kachelwand liegt, solange die Navileiste daneben steht.
 *
 * Die Leiste waechst inzwischen in die Breite, die das gedeckelte Panel uebrig laesst
 * (`--panel-max` im Stilblatt) - hier steht deshalb ihr **schmalstes** Mass. Das ist die
 * richtige Zahl fuer diese Rechnung: Wo die Leiste breiter wird, ist das Panel gedeckelt,
 * und den Deckel bringt `panelWidth` unten selbst ins Spiel.
 */
const DOCK_OVERHEAD = 470
/** Dasselbe, wenn die Leiste darunter steht. */
const STACKED_OVERHEAD = 40

/**
 * Mittlere Zeichenbreite der Pixelschrift, als Anteil der Schriftgroesse.
 *
 * Grobe, aber **konservative** Schaetzung fuer Grossbuchstaben: Die Schrift ist nicht
 * dicktengleich, und ein Mittelwert schaetzt bei "SHATTERED BELT" eher zu niedrig als zu
 * hoch. Deshalb ist der Wert oben angesetzt - diese Regel soll melden, bevor es klemmt.
 */
const PIXEL_CHAR_RATIO = 0.62

/**
 * Der laengste Liganame passt in die Ligazeile der Wellenkarte.
 *
 * Die Zeile hat, anders als das Upgrade-Raster, eine **feste** Breite - sie kann also nicht
 * mit dem Fenster mitwachsen, und ein zu langer Name wird schlicht mit Ellipse gekappt. Ein
 * Ligaabzeichen, das "SHATTERED BE..." zeigt, ist keine Auskunft mehr, sondern ein Raetsel;
 * und weil elf der zwoelf Ligen kuerzer heissen, faellt es beim Spielen erst spaet auf.
 *
 * Gerechnet wird aus dem Stilblatt und aus den echten Namen, nicht aus Erinnerung: Wer eine
 * elfte Liga mit einem langen Namen eintraegt oder die Karte schmaler macht, bekommt es
 * hier gesagt und nicht im Bild.
 */
function leagueRowRule(): TestResult {
  const name = 'der laengste Liganame passt in die Ligazeile'
  const fail = (message: string): TestResult => ({
    suite: 'querschnittsregeln',
    name,
    ok: false,
    message,
  })

  let source = ''
  try {
    source = readFileSync(join(SRC, 'style.css'), 'utf8')
  } catch {
    return fail('src/style.css ist nicht lesbar')
  }
  const css = source.replace(/\/\*[\s\S]*?\*\//g, ' ')

  const cardWidth = css.match(/\.wave-card\s*\{[^{}]*width:\s*(\d+)px/)
  if (!cardWidth) return fail('in style.css legt .wave-card keine feste Breite fest')

  const cardPad = css.match(/\.wave-card\s*\{[^{}]*padding:\s*[\d.]+px\s+([\d.]+)px/)
  if (!cardPad) return fail('in style.css hat .wave-card keine seitliche Polsterung')

  const rowGap = css.match(/\.league-row\s*\{[^{}]*gap:\s*([\d.]+)px/)
  if (!rowGap) return fail('in style.css hat .league-row keinen Abstand')

  const buttonWidth = css.match(/\.league-row button\s*\{[^{}]*width:\s*([\d.]+)px/)
  if (!buttonWidth) return fail('in style.css haben die Pfeile der Ligazeile keine Breite')

  const nameSize = css.match(/\.league-name\s*\{[^{}]*font-size:\s*([\d.]+)px/)
  const nameSpacing = css.match(/\.league-name\s*\{[^{}]*letter-spacing:\s*([\d.]+)em/)
  if (!nameSize || !nameSpacing) return fail('in style.css hat .league-name keine Schriftmasse')

  const rankSize = css.match(/\.league-rank\s*\{[^{}]*font-size:\s*([\d.]+)px/)
  if (!rankSize) return fail('in style.css hat .league-rank keine Schriftgroesse')

  const size = Number(nameSize[1])
  const perChar = size * (PIXEL_CHAR_RATIO + Number(nameSpacing[1]))

  // Vier Abstaende: Pfeil | Name | Rang | Pfeil.
  const available =
    Number(cardWidth[1]) -
    2 * Number(cardPad[1]) -
    2 * Number(buttonWidth[1]) -
    3 * Number(rowGap[1]) -
    // Der Rang ist am laengsten bei zweistelligen Ligen ("L10").
    3 * Number(rankSize[1]) * PIXEL_CHAR_RATIO

  const offenders: string[] = []
  for (const league of LEAGUES) {
    const label = STRINGS[league.id]
    const needed = label.length * perChar
    if (needed > available + 1e-9) {
      offenders.push(
        `${label} braucht ${needed.toFixed(1)}px, die Zeile bietet ${available.toFixed(1)}px`,
      )
    }
  }

  return {
    suite: 'querschnittsregeln',
    name,
    ok: offenders.length === 0,
    ...(offenders.length > 0
      ? {
          message:
            'Ein abgeschnittener Liganame ist keine Auskunft mehr.\n      ' +
            offenders.join('\n      '),
        }
      : {}),
  }
}

function upgradeTileRule(): TestResult {
  const name = 'die Upgrade-Kachel bleibt bei jeder Fensterbreite erkennbar'
  const fail = (message: string): TestResult => ({
    suite: 'querschnittsregeln',
    name,
    ok: false,
    message,
  })

  let source = ''
  try {
    source = readFileSync(join(SRC, 'style.css'), 'utf8')
  } catch {
    return fail('src/style.css ist nicht lesbar')
  }
  const css = source.replace(/\/\*[\s\S]*?\*\//g, ' ')

  // Die Spaltenzahl kommt aus dem Stilblatt und nicht aus dem Kopf - genau daran ist die
  // Vorgaengerregel zweimal gescheitert.
  const columns = css.match(/\.up-grid\s*\{[^{}]*grid-template-columns:\s*repeat\((\d+),/)
  if (!columns) return fail('in style.css legt .up-grid seine Spaltenzahl nicht mit repeat() fest')
  const cols = Number(columns[1])
  if (cols !== WINDOW_SLOTS / 2) {
    return fail(`.up-grid hat ${cols} Spalten, das Raster fasst ${WINDOW_SLOTS} in zwei Reihen`)
  }

  /*
   * Die zweite Spaltenzahl fuer schmale Fenster.
   *
   * Sie muss existieren, und das ist die eigentliche Aussage dieser Zeile: Zehn Spalten sind
   * unter rund 660 px Fensterbreite nicht mehr erkennbar zu zeichnen - diese Regel hat es
   * gemeldet, bevor es jemand gesehen hat. Ein Raster ohne Ausweichform waere auf einem
   * schmalen Fenster eine Wand aus 20-px-Punkten.
   */
  const narrow = css.match(
    /@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*\.up-grid\s*\{[^{}]*grid-template-columns:\s*repeat\((\d+),/,
  )
  if (!narrow) return fail('in style.css hat .up-grid keine Ausweichform fuer schmale Fenster')
  const narrowAt = Number(narrow[1])
  const narrowCols = Number(narrow[2])

  const gapMatch = css.match(/\.up-grid\s*\{[^{}]*gap:\s*([\d.]+)px/)
  if (!gapMatch) return fail('in style.css hat .up-grid keinen Abstand')
  const gap = Number(gapMatch[1])

  const padMatch = css.match(/\.upgrade-panel\s*\{[^{}]*padding:\s*[\d.]+px\s+([\d.]+)px/)
  if (!padMatch) return fail('in style.css hat .upgrade-panel keine seitliche Polsterung')
  const pad = Number(padMatch[1])

  /*
   * Der Deckel, ab dem das Panel nicht mehr mitwaechst.
   *
   * Er gehoert in diese Rechnung, weil er sie **umdreht**: Unterhalb von ihm bestimmt die
   * Fensterbreite die Kachel, oberhalb steht sie still. Ohne ihn rechnete diese Regel auf
   * einem breiten Bild mit einem Panel, das es gar nicht gibt - und meldete Ruhe, wo sie
   * gar nichts geprueft haette.
   */
  const capMatch = css.match(/--panel-max:\s*([\d.]+)px/)
  if (!capMatch) return fail('in style.css hat .dock-row keinen Deckel (--panel-max) fuer das Panel')
  const panelMax = Number(capMatch[1])

  // Wo die Navileiste unter das Panel rutscht - ab da rechnet es mit der vollen Breite.
  const stack = css.match(/@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*#dock\s*\{/)
  if (!stack) return fail('in style.css steht kein Umbruchpunkt, an dem die Navileiste rutscht')
  const stackAt = Number(stack[1])

  const offenders: string[] = []
  for (let width = 320; width <= 3840; width++) {
    // Zwei Schwellen, und sie liegen **nicht** aufeinander: Das Raster bricht bei 1000 px
    // auf fuenf Spalten um, die Navileiste rutscht erst bei 780 px unter das Panel.
    // Dazwischen gilt beides einzeln, und genau dieser Bereich war der Fehler.
    const overhead = width <= stackAt ? STACKED_OVERHEAD : DOCK_OVERHEAD
    // Untereinander gibt es keinen Deckel - dort ist das Panel aber ohnehin schmaler als er.
    const panel = Math.min(width - overhead, panelMax)
    const columnsNow = width <= narrowAt ? narrowCols : cols
    const tile = (panel - 2 * pad - (columnsNow - 1) * gap) / columnsNow
    if (tile + 1e-9 < MIN_TILE) {
      offenders.push(
        `${width}px: ${columnsNow} Spalten -> Kachel ${tile.toFixed(1)}px, Minimum ${MIN_TILE}px`,
      )
      if (offenders.length > 4) break
    }
  }

  return {
    suite: 'querschnittsregeln',
    name,
    ok: offenders.length === 0,
    ...(offenders.length > 0
      ? {
          message:
            'Ein Menue aus Bildern braucht Bilder, die man erkennt.\n      ' +
            offenders.join('\n      '),
        }
      : {}),
  }
}
