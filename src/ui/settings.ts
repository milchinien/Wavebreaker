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
 *   Lautstaerke  der Klanganschluss               (`app/audio.ts`)
 *   Hinweise     der Merkzettel im Spielstand     (`sim/hints.ts`)
 *
 * Eine Sprachwahl gibt es nicht: Es gibt nur eine Sprache. Sie kommt, wenn eine zweite
 * Tabelle in `data/strings.ts` steht - vorher waere sie ein Schalter mit einer Stellung.
 */

import type { SpeedFactor } from '../core/loop.ts'
import { t } from '../data/strings.ts'

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
  /** Lautstaerke von 0 bis 1. */
  volume(): number
  setVolume(value: number): void
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

/** Waehlbare Lautstaerken. Ein Schieberegler waere feiner, als der Ton es hergibt. */
const VOLUMES: readonly number[] = [0, 0.25, 0.5, 1]

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

  // --- Lautstaerke ---
  const volumeButtons: { button: HTMLButtonElement; value: number }[] = []
  const volumeRow = row(root, t('settings.volume'))
  for (const step of VOLUMES) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'chip'
    // Null heisst "stumm" und nicht "null Prozent": Der Spieler sucht einen Ausschalter,
    // keinen Wert am Ende einer Reihe.
    button.textContent =
      step === 0 ? t('settings.mute') : t('settings.volumeStep', { value: Math.round(step * 100) })
    button.addEventListener('click', () => {
      controls.setVolume(step)
      update()
    })
    volumeButtons.push({ button, value: step })
    volumeRow.appendChild(button)
  }

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

    const volume = controls.volume()
    for (const entry of volumeButtons) {
      entry.button.classList.toggle('active', Math.abs(entry.value - volume) < 0.01)
    }
  }

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
