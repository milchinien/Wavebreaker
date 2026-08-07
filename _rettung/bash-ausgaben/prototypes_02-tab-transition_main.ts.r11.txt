/**
 * Prototyp 02 - Bereichswechsel mit `createLayout` aus anime.js.
 *
 * Leitfrage: Kann ein Panel, das es in zwei Bereichen gibt, beim Wechsel an seinen neuen
 * Platz **fahren**, statt abzutreten und neu aufzufahren?
 *
 * Das Spiel macht heute das Zweite: `data-leaving` laesst alles Sichtbare abtreten, danach
 * wechselt der Bereich, danach faehrt alles Neue gestaffelt auf (`ui/shell.ts`). Das sieht
 * gut aus, hat aber eine Luecke - ein Panel, das **bleibt**, weiss davon nichts. Die
 * Goldanzeige verschwindet oben links und erscheint oben rechts wieder; dass es dieselbe
 * Anzeige ist, muss der Spieler sich denken.
 *
 * `createLayout` ist ein FLIP-Verfahren: Es misst vorher, laesst den Wechsel geschehen,
 * misst nachher und animiert die Differenz. Ein bleibendes Panel behaelt dabei seinen
 * Knoten und wandert sichtbar. Was neu dazukommt, bekommt `enterFrom`, was verschwindet,
 * `leaveTo`.
 *
 * Beide Verfahren liegen hier nebeneinander und lassen sich im Kopf umschalten.
 *
 * Regel dieses Ordners: kein Import aus `../src`. Alles hier ist Kopie oder Neubau.
 */

import { createLayout, stagger, utils } from 'animejs'

type View = 'combat' | 'base' | 'upgrades' | 'prestige' | 'settings'
type Mode = 'layout' | 'classic'

/** Reihenfolge der Navileiste. Sie bestimmt, ob ein Wechsel nach rechts oder links geht. */
const ORDER: readonly View[] = ['combat', 'base', 'upgrades', 'prestige', 'settings']

/** Dauer der Layout-Bewegung. Laenger als der Abtritt im Spiel, weil hier wirklich Weg zurueckgelegt wird. */
const DURATION = 520
/** Abstand zwischen zwei benachbarten Panels der Staffel. */
const STEP = 38
/** Dauer des Abtritts im Vergleichsverfahren - derselbe Wert wie `LEAVE_MS` im Spiel. */
const LEAVE_MS = 160

const $app = document.getElementById('app') as HTMLElement
const $field = document.getElementById('field') as HTMLElement
const $readout = document.getElementById('readout') as HTMLElement
const $slow = document.getElementById('slow') as HTMLInputElement
const navButtons = utils.$('#nav button') as HTMLButtonElement[]
const modeButtons = utils.$('#mode button') as HTMLButtonElement[]

let view: View = 'combat'
let mode: Mode = 'layout'
let busy = false
/** Zuletzt gestartete Layout-Bewegung - nur fuer den Pruefgriff am Ende der Datei. */
let lastTimeline: ReturnType<typeof layout.update> | null = null

/**
 * Der Layout-Motor. Wurzel ist das Feld, nicht `#app`: Kopfleiste und Navileiste sollen
 * sich nicht mitvermessen lassen, sonst wandert bei jedem Wechsel auch der Rahmen.
 */
const layout = createLayout($field, { ease: 'outExpo' })

// ---------------------------------------------------------------------------
// Wechsel
// ---------------------------------------------------------------------------

function goTo(next: View): void {
  if (next === view || busy) return

  // Nach rechts durch die Leiste heisst: die Staffel laeuft von vorn, nach links von
  // hinten. Genau der Griff aus der anime.js-Vorlage, nur dass das Vorzeichen hier aus
  // der Navigation kommt statt aus einer Klasse.
  const forward = ORDER.indexOf(next) > ORDER.indexOf(view)
  const factor = $slow.checked ? 4 : 1

  view = next
  for (const button of navButtons) button.classList.toggle('active', button.dataset['view'] === next)

  if (mode === 'layout') switchByLayout(forward, factor)
  else switchByClass(forward, factor)
}

/**
 * Verfahren A - anime.js `createLayout`.
 *
 * `update` misst vor dem Rueckruf, fuehrt ihn aus (hier: ein einziges Attribut umschreiben,
 * den Rest macht das Stilblatt) und misst danach. Alles, was sich verschoben oder in der
 * Groesse geaendert hat, bekommt eine Bewegung.
 */
function switchByLayout(forward: boolean, factor: number): void {
  busy = true
  const started = performance.now()

  const timeline = (lastTimeline = layout.update(
    () => {
      $app.dataset['view'] = view
    },
    {
      duration: DURATION * factor,
      delay: stagger(STEP * factor, { from: forward ? 'first' : 'last' }),
      // Was es vorher nicht gab, kommt aus der Tiefe - dieselbe Geste wie im Spiel.
      enterFrom: { opacity: 0, scale: 0.94, y: 14 },
      // Was geht, faellt nicht einfach weg. Kuerzer als der Auftritt: Abschied darf
      // schneller sein als Ankunft, sonst wartet man auf etwas, das man nicht mehr braucht.
      leaveTo: { opacity: 0, scale: 0.97, y: 10, duration: 260 * factor },
    },
  ))

  report(forward)

  timeline.then(() => {
    busy = false
    $readout.textContent += `  ·  ${Math.round(performance.now() - started)} ms`
  })
}

/**
 * Verfahren B - das, was im Spiel heute passiert.
 *
 * Erst abtreten lassen, dann den Bereich wechseln, dann gestaffelt auffahren. Der Unterschied
 * zu A steckt nicht im Aussehen der einzelnen Bewegung, sondern darin, dass hier **niemand**
 * weiss, welches Panel bleibt.
 */
function switchByClass(forward: boolean, factor: number): void {
  busy = true
  const started = performance.now()

  $app.dataset['leaving'] = view
  $field.style.setProperty('--step', `${STEP * factor}ms`)
  $field.style.setProperty('--enter', `${380 * factor}ms`)

  window.setTimeout(() => {
    delete $app.dataset['leaving']
    $app.dataset['view'] = view

    // Die Staffel muss hier von Hand vergeben werden - das Stilblatt kennt keine
    // Reihenfolge. Genau diese Buchhaltung nimmt `stagger` in Verfahren A ab.
    const visible = utils.$('#field .panel').filter(
      (node) => getComputedStyle(node as HTMLElement).display !== 'none',
    ) as HTMLElement[]

    visible.forEach((node, index) => {
      const step = forward ? index : visible.length - 1 - index
      node.style.setProperty('--i', String(step))
    })

    report(forward)
    window.setTimeout(
      () => {
        busy = false
        $readout.textContent += `  ·  ${Math.round(performance.now() - started)} ms`
      },
      380 * factor + visible.length * STEP * factor,
    )
  }, LEAVE_MS * factor)
}

/**
 * Was der Wechsel bewegt hat.
 *
 * Die drei Zahlen sind die eigentliche Antwort des Prototyps: `bleibt` ist die Menge, die
 * Verfahren B verschenkt. Sie kommen aus dem Layout-Motor selbst, auch im Vergleichsmodus -
 * dort wird nur gemessen, nicht animiert.
 *
 * Zwei Filter sind noetig, damit die Zahl stimmt. Der Motor fuehrt **jeden** Knoten unter
 * der Wurzel - auch jedes Kaestchen in einem Panel; und in `animating` stehen auch die
 * Panels, die in beiden Bereichen unsichtbar sind. Gezaehlt wird deshalb nur, was ein Panel
 * **und** gerade sichtbar ist.
 */
function report(forward: boolean): void {
  const arrow = forward ? '→' : '←'

  if (mode !== 'layout') {
    $readout.textContent = `${arrow}  alles neu aufgebaut: ${countVisible()}`
    return
  }

  const stays = countPanels(layout.animating, true)
  const entered = countPanels(layout.entering, false)
  const left = countPanels(layout.leaving, false)
  $readout.textContent = `${arrow}  bleibt ${stays}  ·  neu ${entered}  ·  weg ${left}`
}

function countPanels(nodes: readonly unknown[], visibleOnly: boolean): number {
  return nodes.filter((node) => {
    if (!(node instanceof HTMLElement) || !node.classList.contains('panel')) return false
    return !visibleOnly || getComputedStyle(node).display !== 'none'
  }).length
}

function countVisible(): number {
  return utils.$('#field .panel').filter(
    (node) => getComputedStyle(node as HTMLElement).display !== 'none',
  ).length
}

// ---------------------------------------------------------------------------
// Bedienung
// ---------------------------------------------------------------------------

for (const button of navButtons) {
  button.addEventListener('click', () => goTo(button.dataset['view'] as View))
}

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    mode = button.dataset['mode'] as Mode
    $app.dataset['mode'] = mode
    for (const other of modeButtons) other.classList.toggle('active', other === button)
    $readout.textContent = '—'
  })
}

// Pfeiltasten laufen die Leiste ab - so sieht man beide Staffelrichtungen schnell
// hintereinander, ohne den Zeiger zu bewegen.
window.addEventListener('keydown', (event) => {
  const index = ORDER.indexOf(view)
  if (event.key === 'ArrowRight') goTo(ORDER[Math.min(ORDER.length - 1, index + 1)] as View)
  if (event.key === 'ArrowLeft') goTo(ORDER[Math.max(0, index - 1)] as View)
  const digit = Number(event.key)
  if (digit >= 1 && digit <= ORDER.length) goTo(ORDER[digit - 1] as View)
})

/**
 * Pruefgriff.
 *
 * `seek` haelt die Bewegung an einer bestimmten Stelle an, statt sie laufen zu lassen.
 * Damit laesst sich der Weg eines Panels **abmessen**, statt ihn anzusehen - notwendig
 * ueberall dort, wo kein Bild entsteht (Kopfloser Lauf, Aufnahme, Fernpruefung), und
 * nebenbei die einzige Art, eine Bewegung zu belegen statt zu behaupten.
 */
;(window as unknown as Record<string, unknown>)['proto'] = {
  layout,
  goTo,
  timeline: () => lastTimeline,
  /** Rechteck eines Panels an einer Stelle der Bewegung, in Prozent der Gesamtdauer. */
  sample(selector: string, fraction: number) {
    const line = lastTimeline
    if (!line) return null
    line.seek(line.duration * fraction)
    const box = document.querySelector(selector)?.getBoundingClientRect()
    return box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null
  },
}
