/**
 * Einstellungen (GDD 13 Abschnitt 3).
 *
 * Hier steht **nur, was es wirklich gibt** - ein Regler ohne Wirkung waere schlimmer als
 * ein fehlender. Mit E18 sind Effekte, Bewegung, Lautstaerke und das Zuruecksetzen der
 * Hinweise dazugekommen; jeder dieser Schalter greift an genau einer Stelle:
 *
 *   Tempo        die Schleife                     (`core/loop.ts`)
 *   Buff-Linien  die Bauflaeche                   (`render/overlays.ts`)
 *   Effekte      die Kampfebene                   (`render/scene.ts`)
 *   Bewegung     das Stilblatt ueber `data-motion` (`src/style.css`)
 *   Lautstaerke  drei Busse des Mischpults        (`app/mixer.ts`)
 *   Hinweise     der Merkzettel im Spielstand     (`sim/hints.ts`)
 *
 * Eine Sprachwahl gibt es nicht: Es gibt nur eine Sprache. Sie kommt, wenn eine zweite
 * Tabelle in `data/strings.ts` steht - vorher waere sie ein Schalter mit einer Stellung.
 */

import { BUSES, defaultMix, type Bus } from '../app/mixer.ts'
import type { SpeedFactor } from '../core/loop.ts'
import { t, type StringKey } from '../data/strings.ts'

export type SettingsControls = {
  speed(): SpeedFactor
  setSpeed(factor: SpeedFactor): void
  /**
   * Welche Stufen dieser Spielstand ueberhaupt waehlen darf (GDD 10, Bereich 2b).
   *
   * x2 und x4 sind Freischaltungen aus dem Prestige-Baum. Die Oberflaeche fragt danach,
   * statt die Liste zu kennen - sonst stuende die Regel an zwei Orten.
   */
  speeds(): readonly SpeedFactor[]
  buffLines(): boolean
  setBuffLines(on: boolean): void
  /** Kampfeffekte zeichnen: Splitter, Druckwellen, Muendungsfeuer (GDD 13 Abschnitt 10). */
  effects(): boolean
  setEffects(on: boolean): void
  /** Bewegte Uebergaenge zwischen den Bereichen. */
  motion(): boolean
  setMotion(on: boolean): void
  /**
   * Pegel einer Klanggruppe, 0 bis 1 (`app/mixer.ts`).
   *
   * Drei Regler statt einem, weil "zu laut" fast nie "alles zu laut" heisst: Wer die
   * Schuesse daempfen will, moechte die Zaesur am Wellenende behalten.
   */
  busLevel(bus: Bus): number
  setBusLevel(bus: Bus, value: number): void
  /** Alle einmaligen Hinweise wieder zeigen (GDD 14 Abschnitt 4a). */
  resetHints(): void
  resetCamera(): void
  /**
   * Das Bild bei einem Bereichswechsel kurz zuruecktreten lassen.
   *
   * Steht hier und nicht in `ui/shell.ts`, weil die Kamera der Schleife gehoert: Die
   * Oberflaeche fragt an, sie greift nicht selbst hinein - dieselbe Regel wie beim Tempo.
   */
  nudgeCamera(): void
}

export type SettingsPanel = {
  /** Nach jedem Bereichswechsel aufrufen - der Zustand kann sich per Tastatur geaendert haben. */
  update(): void
}

/** Die Beschriftung je Bus. Reihenfolge und Namen kommen aus `app/mixer.ts`. */
const BUS_LABEL: Record<Bus, StringKey> = {
  music: 'settings.busMusic',
  sfx: 'settings.busSfx',
  ui: 'settings.busUi',
}

/**
 * Die Schrittweite des Reglers, in Prozent.
 *
 * Ein Prozent - fein genug, dass sich der Regler stufenlos anfuehlt, und grob genug, dass
 * die Anzeige daneben eine ganze Zahl bleibt. Wer mit der Tastatur zieht, kommt so mit
 * gedrueckter Pfeiltaste in ein bis zwei Sekunden von 0 auf 100.
 */
const STEP_PERCENT = 1

/**
 * Was vor dem Stummschalten eingestellt war.
 *
 * Ohne diese Notiz waere Stummschalten eine Einbahnstrasse: Drei Regler auf null zu ziehen
 * ist ein Griff, sie danach wieder dorthin zu stellen, wo sie waren, ist Raten. Die Notiz
 * lebt nur so lange wie die Seite - was gespeichert wird, ist immer der Zustand, den man
 * hoert, nicht der, den man einmal hatte.
 */
let beforeMute: Record<Bus, number> | null = null

/**
 * Die Regler, die gerade im Bild stehen - je Wurzelknoten einer.
 *
 * Der Grund ist ein Fehler, der beim Nachmessen aufgefallen ist: Die Taste `M` wird in
 * `main.ts` abgefangen und geht am Bereich vorbei. Ohne diese Liste schaltet sie den Ton
 * richtig stumm, die drei Regler daneben stehen aber weiter auf ihren alten Prozentzahlen -
 * und ein Regler, der etwas anderes anzeigt als er tut, ist schlimmer als gar keiner.
 *
 * Als `Map` und nicht als `Set`: `mountSettings` raeumt seine Wurzel aus und baut neu auf.
 * Der Eintrag wird dabei ersetzt statt verdoppelt, und niemand haelt einen abgeraeumten
 * Knoten fest.
 */
const livePanels = new Map<HTMLElement, () => void>()

/** Sind alle drei Gruppen stumm? */
function muted(controls: SettingsControls): boolean {
  return BUSES.every((bus) => controls.busLevel(bus) <= 0)
}

/**
 * Alles stumm - oder zurueck auf das, was vorher stand.
 *
 * Steht hier und nicht in `main.ts`, obwohl die Taste `M` dort abgefangen wird: Der
 * Schalter im Bereich und die Taste muessen dasselbe tun, und "dasselbe" ist genau dann
 * gesichert, wenn es nur einmal geschrieben steht.
 */
export function toggleMute(controls: SettingsControls): void {
  if (muted(controls)) {
    // Ohne Notiz - der Spieler hat alle drei selbst auf null gezogen - kommt der Startwert
    // zurueck. Irgendwohin muss der Schalter fuehren, und stumm bleiben waere keine
    // Umschaltung.
    const restore = beforeMute ?? defaultMix()
    beforeMute = null
    for (const bus of BUSES) controls.setBusLevel(bus, restore[bus])
  } else {
    const kept = {} as Record<Bus, number>
    for (const bus of BUSES) kept[bus] = controls.busLevel(bus)
    beforeMute = kept
    for (const bus of BUSES) controls.setBusLevel(bus, 0)
  }
  for (const refresh of livePanels.values()) refresh()
}

export function mountSettings(root: HTMLElement, controls: SettingsControls): SettingsPanel {
  root.replaceChildren()

  const header = document.createElement('header')
  const title = document.createElement('h2')
  title.textContent = t('view.settings')
  header.appendChild(title)
  root.appendChild(header)

  // --- Tempo ---
  const speedButtons = new Map<SpeedFactor, HTMLButtonElement>()
  const speedRow = row(root, t('settings.speed'))
  for (const factor of controls.speeds()) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    button.textContent = t('hud.speedShort', { factor })
    button.addEventListener('click', () => {
      controls.setSpeed(factor)
      update()
    })
    speedButtons.set(factor, button)
    speedRow.appendChild(button)
  }

  // --- Umschalter: Buff-Linien, Effekte, Bewegung ---
  const buffButton = toggle(root, t('settings.buffLines'), controls.buffLines, (on) => {
    controls.setBuffLines(on)
    update()
  })
  const effectButton = toggle(root, t('settings.effects'), controls.effects, (on) => {
    controls.setEffects(on)
    update()
  })
  const motionButton = toggle(root, t('settings.motion'), controls.motion, (on) => {
    controls.setMotion(on)
    update()
  })

  // --- Klang: drei Busse, drei Regler ---
  //
  // Der Ausschalter steht in derselben Zeile wie die Ueberschrift und nicht als vierte
  // Stellung an einem der Regler: Stummschalten ist eine Handlung, kein Pegel. Wer den Ton
  // schnell weghaben will, sucht einen Knopf und keine Null am Ende einer Skala.
  const muteButton = document.createElement('button')
  muteButton.type = 'button'
  muteButton.className = 'chip'
  // Kein `update()` daneben: Das erledigt `toggleMute` fuer alle Regler im Bild, damit
  // Knopf und Taste `M` nicht nur dasselbe tun, sondern auch dasselbe anzeigen.
  muteButton.addEventListener('click', () => toggleMute(controls))
  row(root, t('settings.volume')).appendChild(muteButton)

  const sliders = BUSES.map((bus) =>
    slider(root, t(BUS_LABEL[bus]), () => controls.busLevel(bus), (value) => {
      controls.setBusLevel(bus, value)
      update()
    }),
  )

  // --- Hinweise ---
  const hintButton = document.createElement('button')
  hintButton.type = 'button'
  hintButton.className = 'chip'
  hintButton.textContent = t('settings.reset')
  hintButton.addEventListener('click', () => {
    controls.resetHints()
    // Eine Quittung, weil das Zuruecksetzen sonst nichts Sichtbares tut: Der erste Hinweis
    // erscheint erst, wenn seine Bedingung wieder zutrifft.
    hintButton.textContent = t('settings.hintsDone')
  })
  row(root, t('settings.hints')).appendChild(hintButton)

  // --- Kamera ---
  const cameraButton = document.createElement('button')
  cameraButton.type = 'button'
  cameraButton.className = 'chip'
  cameraButton.textContent = t('settings.reset')
  cameraButton.addEventListener('click', () => controls.resetCamera())
  row(root, t('settings.camera')).appendChild(cameraButton)

  const hint = document.createElement('p')
  hint.className = 'muted'
  hint.textContent = t('settings.hint')
  root.appendChild(hint)

  function update(): void {
    const current = controls.speed()
    for (const [factor, button] of speedButtons) button.classList.toggle('active', factor === current)

    setToggle(buffButton, controls.buffLines())
    setToggle(effectButton, controls.effects())
    setToggle(motionButton, controls.motion())

    const off = muted(controls)
    muteButton.textContent = off ? t('settings.unmute') : t('settings.mute')
    muteButton.classList.toggle('active', off)

    for (const entry of sliders) entry.sync()
  }

  livePanels.set(root, update)
  update()
  return { update }
}

/** Ein Ein/Aus-Schalter samt Zeile. */
function toggle(
  root: HTMLElement,
  label: string,
  read: () => boolean,
  write: (on: boolean) => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'chip'
  button.addEventListener('click', () => write(!read()))
  row(root, label).appendChild(button)
  return button
}

/**
 * Ein stufenloser Regler von 0 bis 100 Prozent, mit seinem Wert daneben.
 *
 * Der Wert steht **immer** da, nicht nur beim Ziehen. Ein Regler ohne Zahl laesst sich
 * nicht wiederfinden: Wer die Effekte gestern auf 40 hatte, sieht heute einen Griff
 * irgendwo links der Mitte und weiss nichts.
 *
 * Geschrieben wird bei `input`, also waehrend des Ziehens - der Spieler hoert seine
 * Aenderung, waehrend er sie macht, und nicht erst beim Loslassen. Genau deshalb reicht der
 * Regler auch bis null: Stumm ist eine gueltige Stellung und braucht keinen zweiten Weg.
 */
function slider(
  root: HTMLElement,
  label: string,
  read: () => number,
  write: (value: number) => void,
): { sync(): void } {
  const input = document.createElement('input')
  input.type = 'range'
  input.min = '0'
  input.max = '100'
  input.step = String(STEP_PERCENT)
  input.setAttribute('aria-label', label)
  // Das Stilblatt gehoert nicht dieser Datei; die zwei Angaben, ohne die der Regler in der
  // Zeile falsch sitzt, stehen deshalb hier.
  input.style.width = '150px'
  input.style.accentColor = 'var(--accent)'

  const readout = document.createElement('span')
  readout.className = 'label'
  // Feste Breite, sonst wandert der Regler bei jedem Prozentschritt um ein Zeichen.
  readout.style.minWidth = '42px'
  readout.style.textAlign = 'right'
  readout.style.fontVariantNumeric = 'tabular-nums'

  function sync(): void {
    const percent = Math.round(read() * 100)
    input.value = String(percent)
    readout.textContent = t('settings.volumeStep', { value: percent })
  }

  input.addEventListener('input', () => write(Number(input.value) / 100))

  const line = row(root, label)
  line.style.alignItems = 'center'
  line.append(input, readout)
  sync()
  return { sync }
}

function setToggle(button: HTMLButtonElement, on: boolean): void {
  button.textContent = on ? t('settings.on') : t('settings.off')
  button.classList.toggle('active', on)
}

/** Eine Zeile aus Beschriftung links und Bedienelementen rechts. */
function row(root: HTMLElement, label: string): HTMLElement {
  const line = document.createElement('div')
  line.className = 'setting'

  const name = document.createElement('span')
  name.className = 'label'
  name.textContent = label

  const controls = document.createElement('span')
  controls.className = 'chips'

  line.append(name, controls)
  root.appendChild(line)
  return controls
}
