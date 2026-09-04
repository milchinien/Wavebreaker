/**
 * Der Startbildschirm: erst laden, dann "PRESS TO START" (GDD 13 Abschnitt 4).
 *
 * Er liegt **vor** dem Spiel, nicht darueber: Solange dieser Bildschirm steht, ist die
 * Schleife nicht gestartet, kein Spielstand geladen und keine Welle unterwegs. Erst der
 * Druck des Spielers ruft `onStart`. Das ist keine Kleinigkeit, sondern der Grund, warum es
 * ihn gibt - ein Spiel, das hinter einem Vorhang schon laeuft, verliert dem Spieler seine
 * erste Welle, waehrend er noch hinsieht.
 *
 * Der Aufbau ist der eines Filmplakats, das sich zusammensetzt: Fuenf Bildebenen liegen
 * deckungsgleich uebereinander, jede startet vergroessert und faehrt gemeinsam mit den
 * anderen auf ihr Mass zurueck. Weil die vorderen weiter aussen anfangen, ziehen sie
 * schneller durchs Bild als die hinteren - daraus entsteht die Tiefe. Darueber blendet jede
 * Ebene zu ihrer eigenen Zeit ein, von hinten nach vorn, und der Schriftzug kommt zuletzt.
 * Die Vorlage ist der GTA-VI-Plakateffekt; dort ist das React mit einer Animationsbibliothek,
 * hier sind es zwei Zahlen je Ebene und der Rest steht im Stilblatt.
 *
 * Vier Entscheidungen praegen die Datei:
 *
 * **Das Laden ist echt.** Der Balken zaehlt die tatsaechlich geladenen Bildebenen, nicht
 * eine erfundene Dauer. Eine Ebene, die erst mitten im Aufbau eintrifft, platzt sonst ins
 * fertige Bild. Weil fuenf kleine Dateien auf einem warmen Cache in wenigen Millisekunden da
 * sind, gibt es zusaetzlich eine **Untergrenze**: Ein Ladebalken, der nur aufblitzt, sieht
 * kaputt aus. Und eine Obergrenze, damit eine haengende Leitung den Start nicht verhindert -
 * eine fehlende Bildebene ist ein hinnehmbarer Zustand, genau wie ein fehlendes Geraeusch.
 *
 * **Bewegt wird im Stilblatt.** Von hier kommen je Ebene nur zwei Werte (`--from`,
 * `--delay`), alles andere - Dauern, Kurven, der Wischer des Schriftzugs - steht bei
 * `.boot` in `src/style.css`. Damit haengt der Effekt an derselben Stelle wie jede andere
 * Bewegung der Oberflaeche und faellt bei abgeschalteter Bewegung von selbst weg.
 *
 * **Jeder Druck zaehlt, und zwar frueh.** Angenommen wird ab dem Augenblick, in dem der
 * Aufbau beginnt - nicht erst, wenn die Aufforderung dasteht. Wer das Spiel zum zwanzigsten
 * Mal oeffnet, will nicht drei Sekunden Plakat sehen. Die Aufforderung ist die Einladung,
 * nicht die Freigabe.
 *
 * **Er raeumt sich weg.** Nach dem Abgang wird der Knoten aus dem Baum genommen, bevor
 * `onStart` laeuft. Ein Startbildschirm, der unsichtbar liegenbleibt, ist eine Flaeche, die
 * spaeter irgendwann Klicks schluckt - dieselbe Falle wie beim Prestige-Blitz (siehe die
 * Overlay-Regel in `selftest/guards.ts`).
 */

import { t } from '../data/strings.ts'
import { asset } from '../app/assets.ts'
import { mountBootStation, type BootStation } from './bootstation.ts'
import { mountStrokeText, strokeFillSeconds } from './stroketext.ts'
import { createTypewriter } from './typewriter.ts'

export type Boot = {
  detach(): void
}

export type BootOptions = {
  /** Laeuft, wenn der Spieler gedrueckt hat und der Bildschirm abgeraeumt ist. */
  onStart(): void
}

/** Wo die Bildebenen liegen. Alle im selben Ordner, damit ein Austausch dort stattfindet. */
const FOLDER = asset('boot/')

type Layer = {
  file: string
  /** Start-Zoom von Hand, statt der gestaffelten Verteilung unten. */
  scale?: number
  /** Wann diese Ebene einblendet, in Millisekunden - statt der gestaffelten Verteilung. */
  delay?: number
  /**
   * Ganz einpassen statt formatfuellend zeigen.
   *
   * Fuer alles, was nicht angeschnitten werden darf. Eine formatfuellende Ebene deckt jedes
   * Fensterformat, verliert dabei aber links und rechts (oder oben und unten) etwas - bei
   * einem Hintergrund egal, bei einem Schriftzug nicht.
   */
  contain?: boolean
  /**
   * Der Auftritt statt des Einblendens: Die Ebene **wischt von oben auf** und legt dabei
   * ihre Unschaerfe ab. Gedacht fuer den Schriftzug, und dort auch nur fuer ihn - zwei
   * Wischer im selben Bild nehmen einander die Wirkung.
   */
  hero?: boolean
  /**
   * Keine Bilddatei, sondern eine **lebende** Ebene: das Spiel selbst.
   *
   * Bisher war die Station hier ein von Hand gezeichnetes SVG - fuenf Sechsecke, die
   * ungefaehr aussahen wie eine Station. Sie ist jetzt eine echte, gebaute Station mit
   * echten Turmmodulen, gezeichnet von dem Code, der auch im Spiel laeuft
   * (`ui/bootstation.ts`). Das Plakat zeigt damit nicht mehr eine Vorstellung vom Spiel,
   * sondern das Spiel.
   *
   * Fuer den Aufbau ringsherum aendert das nichts: Die Ebene bekommt dieselbe Klasse,
   * denselben Start-Zoom und dieselbe Einblendzeit wie jede andere und liegt an derselben
   * Stelle im Stapel. Nur geladen wird sie nicht - sie ist sofort da.
   */
  live?: boolean
  /**
   * Die zweite lebende Ebene: der **Schriftzug**, der sich selbst schreibt
   * (`ui/stroketext.ts`).
   *
   * Auch er war einmal eine Bilddatei und ist jetzt gesetzter Text - mit demselben Gewinn
   * wie bei der Station: Er kennt keine feste Aufloesung mehr, er kann seinen Wortlaut aus
   * `data/strings.ts` nehmen, und er tritt nicht auf, sondern **entsteht**.
   *
   * Er blendet deshalb auch nicht ein wie die uebrigen Ebenen (`--delay` bleibt hier ohne
   * Wirkung auf die Deckkraft): Solange nichts gezeichnet ist, ist ohnehin nichts zu sehen.
   * Das Zeichnen ist der Auftritt.
   */
  text?: boolean
}

/**
 * Vorlauf bis zum ersten Strich der Wortmarke, in Millisekunden.
 *
 * Er steht ausserhalb der Ebenentabelle, weil die Aufforderung ihn ebenfalls braucht - sie
 * kommt, wenn der Name fertig geschrieben ist, und muss dafuer wissen, wann er anfaengt.
 */
const TITLE_DELAY_MS = 1200

/**
 * Die Ebenen von hinten nach vorn. Die Reihenfolge ist die Stapelordnung: Was hier weiter
 * unten steht, liegt im Bild weiter vorn.
 *
 * Ersetzen heisst: dieselbe Leinwandgroesse, durchsichtiger Grund, jedes Element schon an
 * seiner endgueltigen Stelle. Die Ebenen liegen deckungsgleich uebereinander - sie sind
 * keine Ausschnitte, die hier zusammengesetzt werden, sondern fertige Bilder, von denen
 * jedes nur seinen Teil zeigt.
 */
const LAYERS: readonly Layer[] = [
  { file: '01-sky.svg' },
  { file: '02-grid.svg' },
  { file: '03-swarm.svg' },
  // Die Station ist keine Datei mehr - siehe `live`. Der Name bleibt als Platz im Stapel
  // stehen, damit die Reihenfolge der Ebenen weiter zu lesen ist.
  { file: '04-station', live: true },
  /*
   * Der Schriftzug kommt zuletzt und deutlich nach den anderen: Er ist die Pointe, und eine
   * Pointe faellt nicht mitten in den Satz.
   *
   * Auch er ist keine Bilddatei mehr (`live`), und zwar aus zwei Gruenden. Der eine steht in
   * der abgeloesten Datei selbst: **Ein SVG in einem `<img>` laedt keine Schriftdateien
   * nach.** Der Schriftzug stand dort deshalb in einer Systemschrift - dieselbe Zeile, die
   * das Spiel nirgends sonst benutzt, und entsprechend fremd sah sie aus. Als Text im
   * Dokument nimmt er die Pixelschrift des Spiels und passt damit zum Rest.
   *
   * Der andere: Er lag als Bild **deckungsgleich** ueber der Station - der Schriftzug sass
   * quer ueber ihrer Mitte, weil beide Ebenen die volle Leinwand fuellen und beide mittig
   * gesetzt waren. Als Textblock hat er einen eigenen Platz im unteren Drittel, und die
   * Station rueckt ihm aus dem Weg.
   *
   * Er **schreibt sich** inzwischen (`text`, siehe `ui/stroketext.ts`) und wischt nicht mehr
   * auf. Deshalb steht hier kein `hero` mehr: Der Wischer und der laufende Strich sind zwei
   * Auftritte fuer denselben Augenblick, und zwei Auftritte sind keiner. `delay` ist jetzt
   * der Vorlauf bis zum ersten Buchstaben.
   */
  { file: '05-title', text: true, delay: TITLE_DELAY_MS },
]

/**
 * Start-Zoom der hintersten und der vordersten Ebene.
 *
 * Dazwischen wird **geometrisch** verteilt, nicht linear: Jede Ebene startet um denselben
 * *Faktor* weiter aussen als ihre Vorgaengerin, und nur so liest sich der Abstand zwischen
 * je zwei Ebenen als gleich tief. Bei linearer Verteilung draengen sich die vorderen.
 *
 * Der Vorteil der gerechneten Werte: Eine Ebene mehr oder weniger braucht keine neue
 * Abstimmung - die Verteilung ordnet sich selbst neu.
 */
const FAR_SCALE = 1.18
const NEAR_SCALE = 2.3

/** Wann die erste Ebene einblendet und wie weit die naechste dahinter liegt. */
const FIRST_DELAY_MS = 380
const STAGGER_MS = 190

/**
 * Wie lange die Wortmarke schreibt und wie lange sie danach wartet, in Sekunden.
 *
 * Sie stehen hier oben, weil drei Stellen sie brauchen: der Schriftzug selbst, die Zeile
 * darunter, die auf ihn wartet, und die Aufforderung, die auf beide wartet. Die Dauer der
 * Fuellung leitet sich daraus ab (`strokeFillSeconds`) - eine vierte Zahl waere eine, die
 * irgendwann nicht mehr passt.
 */
const DRAW_SECONDS = 1.6
const FILL_DELAY_SECONDS = 0.2

/**
 * Wann die Aufforderung erscheint.
 *
 * Nach dem Schriftzug, nicht mit ihm: Zwei Dinge, die im selben Augenblick auftauchen,
 * teilen sich den Blick. Die Kamerafahrt laeuft danach noch weiter - sie ist der ruhige
 * Grund, auf dem "PRESS TO START" steht, und muss nicht zu Ende sein, damit man druecken
 * darf.
 *
 * Der Wert ist gerechnet und nicht geraten: Vorlauf der Schriftzugebene, Schreiben, Pause,
 * Fuellen - und dann ist der Name da. Wer an der Schreibdauer dreht, verschiebt die
 * Aufforderung von selbst mit. Und wer nicht warten will, drueckt einfach frueher; angenommen
 * wird ab dem ersten Augenblick des Aufbaus.
 */
const PRESS_MS =
  TITLE_DELAY_MS + (DRAW_SECONDS + FILL_DELAY_SECONDS + strokeFillSeconds(DRAW_SECONDS)) * 1000

/** Untergrenze und Obergrenze des Ladens. Siehe den Kopf der Datei. */
const MIN_LOAD_MS = 900
const MAX_LOAD_MS = 6000

/** Dauer des Abgangs. Muss zu `.boot.out` im Stilblatt passen. */
const OUT_MS = 620

export function mountBoot(root: HTMLElement, options: BootOptions): Boot {
  const node = document.createElement('div')
  node.className = 'boot'

  const poster = document.createElement('div')
  poster.className = 'boot-poster'
  node.appendChild(poster)

  const foot = document.createElement('div')
  foot.className = 'boot-foot'

  const load = document.createElement('div')
  load.className = 'boot-load'
  const loadLabel = document.createElement('span')
  loadLabel.className = 'boot-label'
  loadLabel.textContent = t('boot.loading')
  const bar = document.createElement('div')
  bar.className = 'boot-bar'
  bar.appendChild(document.createElement('i'))
  load.append(loadLabel, bar)

  /*
   * Eine echte Schaltflaeche und kein beschrifteter Bereich: Damit ist die Aufforderung mit
   * der Tastatur erreichbar, wird als Bedienelement vorgelesen und beantwortet Enter und
   * Leertaste von selbst. Dass daneben **jeder** Druck zaehlt, ist die Bequemlichkeit
   * obendrauf - nicht der einzige Weg hinein.
   */
  const press = document.createElement('button')
  press.type = 'button'
  press.className = 'boot-press'
  const pressLabel = document.createElement('span')
  press.appendChild(pressLabel)

  foot.append(load, press)
  node.appendChild(foot)
  root.appendChild(node)

  /** Laufende Zeitschaltung. 0 heisst: keine. */
  let timer = 0
  /** Steht der Abgang schon? Jeder weitere Druck laeuft dann ins Leere. */
  let leaving = false
  /** Nimmt der Bildschirm ueberhaupt schon einen Druck an? */
  let armed = false

  function stopTimer(): void {
    if (timer !== 0) window.clearTimeout(timer)
    timer = 0
  }

  /** Steht die Oberflaeche still? `--motion` ist die eine Quelle - siehe `ui/typewriter.ts`. */
  function still(): boolean {
    return getComputedStyle(node).getPropertyValue('--motion').trim() === '0'
  }

  const writer = createTypewriter({ caret: 'keep' })

  // -------------------------------------------------------------------------
  // Bildebenen
  // -------------------------------------------------------------------------

  /** Wie viele Ebenen fertig geladen sind - der Stand des Balkens. */
  let arrived = 0
  /** Beide muessen erfuellt sein, bevor der Aufbau beginnt: Bilder da **und** Mindestdauer um. */
  let imagesDone = false
  let floorDone = false

  function scaleFor(index: number): number {
    const span = LAYERS.length > 1 ? index / (LAYERS.length - 1) : 0
    return FAR_SCALE * Math.pow(NEAR_SCALE / FAR_SCALE, span)
  }

  function settle(): void {
    arrived += 1
    load.style.setProperty('--fill', `${Math.round((arrived / LAYERS.length) * 100)}%`)
    if (arrived < LAYERS.length) return
    imagesDone = true
    begin()
  }

  /** Die lebenden Ebenen, solange es sie gibt - beide muessen beim Abgang abgeraeumt werden. */
  let live: BootStation | null = null
  let title: BootTitle | null = null

  for (const [index, layer] of LAYERS.entries()) {
    const from = String(layer.scale ?? scaleFor(index))
    const delayMs = layer.delay ?? FIRST_DELAY_MS + index * STAGGER_MS

    if (layer.live || layer.text) {
      // Der Schriftzug ist ein Textblock, die Station eine Leinwand - beide sind Ebenen
      // wie jede andere und unterscheiden sich nur darin, was in ihnen steht.
      let element: HTMLElement
      if (layer.text) {
        // Der Vorlauf wandert in den Schriftzug hinein: Bei ihm ist `delay` nicht mehr die
        // Zeit, zu der er einblendet, sondern die, zu der der erste Strich ansetzt.
        title = mountTitle(still, delayMs / 1000)
        element = title.node
        element.classList.add('text')
      } else {
        live = mountBootStation({ still })
        element = live.node
      }
      element.classList.add('boot-layer')
      element.style.setProperty('--from', from)
      element.style.setProperty('--delay', `${delayMs}ms`)
      poster.appendChild(element)
      // Sie hat nichts zu laden und ist damit sofort angekommen. Sie trotzdem mitzuzaehlen
      // ist wichtig: Der Balken zaehlt Ebenen, nicht Dateien - eine Ebene, die nie meldet,
      // liesse ihn bei achtzig Prozent stehen, bis die Notbremse greift.
      settle()
      continue
    }

    const delay = `${delayMs}ms`

    const image = document.createElement('img')
    image.className = layer.hero ? 'boot-layer hero' : 'boot-layer'
    image.draggable = false
    // Der Startbildschirm hat einen Text, und das ist die Aufforderung. Die Bildebenen sind
    // Schmuck und tragen deshalb keine Beschriftung - vorgelesen waere jede von ihnen eine
    // Unterbrechung auf dem Weg zum einzigen Bedienelement.
    image.alt = ''
    if (layer.contain) image.classList.add('fit')
    image.style.setProperty('--from', from)
    image.style.setProperty('--delay', delay)

    let counted = false
    const once = (): void => {
      if (counted) return
      counted = true
      settle()
    }
    image.addEventListener('load', once)
    // Eine Ebene, die nicht kommt, haelt den Start nicht auf. Sie fehlt dann im Bild, und
    // das ist die kleinere Stoerung.
    image.addEventListener('error', once)

    image.src = FOLDER + layer.file
    poster.appendChild(image)

    // Aus dem Cache kann ein Bild schon fertig sein, bevor irgendein Ereignis faellt.
    if (image.complete) once()
  }

  // -------------------------------------------------------------------------
  // Ablauf
  // -------------------------------------------------------------------------

  /** Der Aufbau beginnt - aber nur, wenn beide Bedingungen stehen. */
  function begin(): void {
    if (!imagesDone || !floorDone || leaving) return
    if (node.classList.contains('on')) return

    stopTimer()
    node.classList.add('on')
    // Ab hier zaehlt jeder Druck, auch mitten im Aufbau.
    armed = true

    // Der Schriftzug setzt an. Er haengt nicht an einer Klasse wie die uebrigen Ebenen,
    // sondern wird angestossen: Seine Folge hat ein Dutzend gestaffelter Verzoegerungen, und
    // die duerfen erst dann loslaufen, wenn der Aufbau wirklich beginnt - nicht schon beim
    // Einhaengen, waehrend der Ladebalken noch zaehlt.
    title?.play()

    if (still()) {
      prompt()
      return
    }
    timer = window.setTimeout(prompt, PRESS_MS)
  }

  /** Die Aufforderung tritt auf und schreibt sich an. */
  function prompt(): void {
    timer = 0
    if (leaving) return
    node.classList.add('ready')
    writer.write({ node: pressLabel, text: t('boot.press') })
    // Erst jetzt den Fokus holen: Vorher stuende der Ring auf einer Schaltflaeche, die noch
    // gar nicht zu sehen ist.
    press.focus({ preventScroll: true })
  }

  function leave(): void {
    if (leaving || !armed) return
    leaving = true
    armed = false

    stopTimer()
    detachInput()
    writer.reset()

    // Vor dem Entfernen lesen: Ein Knoten ausserhalb des Baumes hat keine berechneten Werte.
    const out = still() ? 0 : OUT_MS
    node.classList.add('out')
    timer = window.setTimeout(() => {
      timer = 0
      // Erst die lebende Ebene abstellen, dann den Knoten nehmen: Ihre Bildschleife laeuft
      // sonst hinter einem Bildschirm weiter, den es nicht mehr gibt - und zwar fuer den
      // Rest der Sitzung, neben dem Spiel, das gerade anfaengt.
      live?.detach()
      live = null
      title?.detach()
      title = null
      node.remove()
      options.onStart()
    }, out)
  }

  // -------------------------------------------------------------------------
  // Bedienung
  // -------------------------------------------------------------------------

  function onPointerDown(): void {
    leave()
  }

  function onKeyDown(event: KeyboardEvent): void {
    // Tastenkuerzel des Browsers sind kein Druck auf den Startbildschirm: Wer F5 oder
    // Strg+R tippt, will neu laden, und wer Alt+Tab haelt, will hier gar nichts.
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key.length !== 1 && !ACCEPTED_KEYS.has(event.key)) return
    leave()
  }

  function detachInput(): void {
    node.removeEventListener('pointerdown', onPointerDown)
    press.removeEventListener('click', onPointerDown)
    window.removeEventListener('keydown', onKeyDown)
  }

  node.addEventListener('pointerdown', onPointerDown)
  /*
   * Die Schaltflaeche zusaetzlich an ihrem eigenen Ereignis.
   *
   * `pointerdown` deckt Maus, Stift und Finger ab - aber nicht jede Betaetigung geht ueber
   * einen Zeiger: Eine Vorlesehilfe loest eine Schaltflaeche mit einem blossen `click` aus,
   * ohne dass je ein Zeiger im Spiel war. Ohne diese Zeile waere der einzige Weg ins Spiel
   * fuer sie die Tastatur.
   */
  press.addEventListener('click', onPointerDown)
  window.addEventListener('keydown', onKeyDown)

  // Die Mindestdauer laeuft ab dem Aufbau der Flaeche, nicht ab dem ersten geladenen Bild -
  // sonst waere sie bei warmem Cache ein zweites Warten hinter dem ersten.
  timer = window.setTimeout(() => {
    timer = 0
    floorDone = true
    begin()
  }, MIN_LOAD_MS)

  // Die Notbremse. Sie greift nur, wenn eine Ebene gar nicht eintrifft.
  const rescue = window.setTimeout(() => {
    imagesDone = true
    floorDone = true
    begin()
  }, MAX_LOAD_MS)

  return {
    detach() {
      stopTimer()
      window.clearTimeout(rescue)
      detachInput()
      writer.reset()
      live?.detach()
      live = null
      title?.detach()
      title = null
      node.remove()
    },
  }
}

type BootTitle = {
  node: HTMLElement
  play(): void
  detach(): void
}

/**
 * Der Schriftzug: Wortmarke und Zeile darunter.
 *
 * Die Wortmarke **schreibt sich selbst** - erst die Kontur Buchstabe fuer Buchstabe, dann
 * die Fuellung (`ui/stroketext.ts`). Das ist die letzte Stufe derselben Bewegung, die
 * diesen Bildschirm ausmacht: Der Grund faehrt zurueck, die Station wird gebaut, und der
 * Name wird geschrieben. Nichts davon ist einfach da.
 *
 * Die Zeile darunter kommt erst, wenn die Wortmarke steht - waehrend sich ueber ihr etwas
 * schreibt, liest sie niemand.
 *
 * Die Werte sind die der Vorlage (`StrokeText`), mit zwei Abweichungen, und beide betreffen
 * die Schrift: Sie nimmt die des Spiels statt einer fremden, und deren Schnitt gibt es nur
 * einfach - `fontWeight: 800` waere ein gerechneter Fettdruck, und ein gerechneter Fettdruck
 * mit einer Kontur aussen herum ist ein Brei. Wer den Satz aus der Vorlage buchstabengetreu
 * will, setzt hier `fontFamily: 'var(--font)'` und `fontWeight: 800`.
 */
function mountTitle(still: () => boolean, delay: number): BootTitle {
  const node = document.createElement('div')
  node.className = 'boot-title'

  const word = mountStrokeText({
    key: 'game.title',
    strokeColor: 'var(--edge)',
    fillColor: 'var(--text)',
    strokeWidth: 1.4,
    drawDuration: DRAW_SECONDS,
    fillDelay: FILL_DELAY_SECONDS,
    stagger: 0.05,
    ease: 'power2.out',
    fillMode: 'wipe',
    fontSize: 128,
    fontWeight: 400,
    fontFamily: 'var(--font-pixel)',
    // Die Sperrung der abgeloesten Fassung, in die Masseinheit der Vorlage umgerechnet:
    // 0.06em bei 128 Pixeln sind knapp acht Pixel.
    letterSpacing: 8,
    reverse: false,
    delay,
    trigger: 'manual',
    still,
  })

  const tagline = document.createElement('span')
  tagline.className = 'boot-tagline'
  tagline.textContent = t('boot.tagline')

  // Wann die Zeile und die Linie darunter kommen duerfen: wenn die Fuellung durch ist, also
  // nach Vorlauf, Kontur, Pause und Fuellung. Der Wert steht am Block und gilt fuer beide -
  // sie gehoeren zusammen und sollen nicht nacheinander eintrudeln.
  const written = delay + DRAW_SECONDS + FILL_DELAY_SECONDS + strokeFillSeconds(DRAW_SECONDS)
  node.style.setProperty('--sub-delay', `${written}s`)

  node.append(word.node, tagline)

  return {
    node,
    play() {
      word.play()
      // Die Zeile haengt an der Klasse statt an einer eigenen Zeitschaltung - eine Uhr
      // weniger, die beim Abgang abgestellt werden muesste.
      node.classList.add('written')
    },
    detach() {
      word.detach()
      node.remove()
    },
  }
}

/**
 * Tasten ohne Zeichen, die trotzdem als Druck gelten.
 *
 * Alles mit einem Zeichen zaehlt ohnehin (`event.key.length === 1`) - das deckt Buchstaben,
 * Ziffern und die Leertaste ab. Hier stehen die uebrigen, die jemand erwartungsgemaess
 * druecken wuerde, ohne dass die Liste zum Tastaturtreiber wird.
 */
const ACCEPTED_KEYS: ReadonlySet<string> = new Set([
  'Enter',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])
