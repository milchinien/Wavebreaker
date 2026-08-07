/**
 * Rahmen der Oberflaeche: Bereiche, Navileiste, Panels (GDD 13 Abschnitt 3 und 4).
 *
 * Der Aufbau folgt den Entwurfsbildern:
 *
 *   Kampf                              Basis
 *   +--------------------------+       +--------------------------+
 *   |  Gold        Wellenkarte |       |       |        |  Welle   |
 *   |        Spielfeld         |       | Lager |  Feld  |  Detail  |
 *   |         Rumpfleiste      |       |       |        |  Kaufen  |
 *   +--------------------------+       +--------------------------+
 *   | Navi | Upgrade-Kacheln   |       | Navi                     |
 *   +--------------------------+       +--------------------------+
 *
 * Drei Regeln halten das zusammen:
 *   - **Der Bereich steht am `#app`**, nicht in jedem Knoten. Was sichtbar ist, entscheidet
 *     das Stilblatt ueber `[data-view]`. Deshalb muss hier nichts ein- und ausgeblendet
 *     werden, und die HUD-Anzeigen koennen stumpf weiterrechnen.
 *   - **Panels bauen sich nur auf Anforderung neu.** `refresh()` nach einer Handlung,
 *     `update()` pro Bild - sonst spraenge bei jedem eingesammelten Goldstapel die
 *     Bildlaufposition zurueck.
 *   - **Ein Bereichswechsel ist eine Bewegung, kein Schnitt** (siehe `goTo`).
 */

import { t } from '../data/strings.ts'
import { setView } from '../app/actions.ts'
import type { GameState, View } from '../app/state.ts'
import { mountAbilityPanel, type AbilityPanel } from './abilities.ts'
import { createMeltSelection, renderInventory, renderModuleDetail, renderShop } from './base.ts'
import { mountDialogs, type Dialogs } from './dialogs.ts'
import { createFlip } from './flip.ts'
import { icon, type IconName } from './icons.ts'
import { mountPrestigePanel, type PrestigePanel } from './prestige.ts'
import { mountSettings, type SettingsControls } from './settings.ts'
import { createTypewriter } from './typewriter.ts'
import { mountUpgradeMenu, type UpgradeMenu } from './upgrades.ts'

export type ShellTargets = {
  /** Traegt `data-view` - daran haengt die gesamte Sichtbarkeit. */
  app: HTMLElement
  /** Schwebende Anzeigen ueber dem Spielfeld. */
  overlay: HTMLElement
  /** Untere Leiste: Navileiste und Upgrade-Panel. */
  dock: HTMLElement
}

export type Shell = {
  /** Panels neu aufbauen. Nach jeder Handlung aufrufen, nicht pro Bild. */
  refresh(): void
  /** Pro Bild aufrufen - aktualisiert nur, was sich staendig aendert. */
  update(): void
  detach(): void
}

const NAV: readonly {
  id: View
  icon: IconName
  label: 'view.combat' | 'view.base' | 'view.upgrades' | 'view.prestige' | 'view.settings'
}[] = [
  { id: 'base', icon: 'base', label: 'view.base' },
  { id: 'combat', icon: 'combat', label: 'view.combat' },
  { id: 'upgrades', icon: 'upgrade', label: 'view.upgrades' },
  { id: 'prestige', icon: 'crosshair', label: 'view.prestige' },
  { id: 'settings', icon: 'gear', label: 'view.settings' },
]

/**
 * Was beim Bereichswechsel vermessen wird.
 *
 * Jedes Panel, dessen Sichtbarkeit an `[data-view]` haengt, plus die Navileiste - die ist
 * zwar immer da, rueckt aber mit, wenn die untere Leiste ihre Hoehe aendert.
 *
 * Nicht dabei ist alles, was seine eigene Sichtbarkeit mitbringt: die Boss-Leiste, der
 * Wellenname, der Ausgang einer Welle, die Faehigkeitenleiste. Sie kommen und gehen nach
 * ihren eigenen Regeln, nicht nach dem Bereich - eine Wanderung an ihnen waere eine Aussage
 * ueber einen Wechsel, den es fuer sie nicht gibt.
 */
const MOVING = [
  '.resource-bar',
  '.wave-card',
  '.hull-bar',
  '.speed-control',
  '.upgrade-panel',
  '.nav',
  '.meta-card',
  '.inventory-panel',
  '.rail',
  '.settings-panel',
  '.prestige-panel',
  '.view-title',
].join(',')

export function mountShell(
  state: GameState,
  targets: ShellTargets,
  controls: SettingsControls,
): Shell {
  const { app, overlay, dock } = targets

  // --- Ueber dem Spielfeld ---
  const title = element('h1', 'view-title')
  const inventory = element('section', 'panel', 'inventory-panel')
  const rail = element('div', 'rail')
  const detail = element('section', 'panel', 'detail-panel')
  const shop = element('section', 'panel', 'shop-panel')
  const settings = element('section', 'panel', 'settings-panel')
  const prestige = element('section', 'panel', 'prestige-panel')

  // Die Wellen- und Goldkarte der Basis gehoert dem HUD - sie traegt laufende Zahlen und
  // haengt deshalb direkt in der Overlay-Ebene, nicht in dieser Spalte.
  rail.append(detail, shop)
  overlay.append(title, inventory, rail, settings, prestige)

  // --- Untere Leiste ---
  // Sie traegt nur noch, was man anfasst. Alle Zahlen stehen ueber dem Feld (siehe
  // `ui/hud.ts`) - vorher lagen sie hier und machten die Leiste doppelt so hoch.
  const dockRow = element('div', 'dock-row')
  const nav = element('nav', 'nav')
  const upgrades = element('section', 'panel', 'upgrade-panel')

  dockRow.append(nav, upgrades)
  dock.append(dockRow)

  // Die Faehigkeitenverwaltung haengt im Upgrades-Bereich (GDD 13 Abschnitt 6) und liegt
  // deshalb im selben Panel, unterhalb der Upgrade-Kacheln.
  const abilityBlock = element('div', 'ability-block')

  const buttons = new Map<View, HTMLButtonElement>()
  for (const entry of NAV) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `nav-button nav-${entry.id}`
    button.title = t(entry.label)
    button.setAttribute('aria-label', t(entry.label))
    button.innerHTML = icon(entry.icon, 30)
    button.addEventListener('click', () => goTo(entry.id))
    buttons.set(entry.id, button)
    nav.appendChild(button)
  }

  const settingsPanel = mountSettings(settings, controls)
  const dialogs: Dialogs = mountDialogs(state, overlay, () => refresh())
  const melting = createMeltSelection()
  let menu: UpgradeMenu | null = null
  let abilityPanel: AbilityPanel | null = null
  let prestigePanel: PrestigePanel | null = null

  /**
   * Bereichswechsel als Bewegung.
   *
   * Der Wechsel selbst passiert **sofort und ganz** - in dem Augenblick, in dem der Klick
   * ankommt, steht der neue Bereich, hat das Canvas seine neue Groesse und sind alle Panels
   * gesetzt. Bewegt wird danach nur noch die Optik (`ui/flip.ts`):
   *
   *   1. Der Knopf quittiert im selben Bild, sonst fuehlt sich der Klick taub an, egal wie
   *      schoen der Rest wird.
   *   2. Panels, die es in **beiden** Bereichen gibt, **wandern** von ihrem alten an ihren
   *      neuen Platz, statt zu verschwinden und wiederzukommen. Zwischen Kampf und Upgrades
   *      verschwindet gar nichts - dort ruecken alle nur, weil die Leiste hoeher wird.
   *   3. Was der neue Bereich nicht mehr zeigt, tritt festgenagelt ab; was neu ist, faehrt
   *      auf. Beides steht im Stilblatt - die Richtung eines Auf- oder Abtritts ist
   *      Gestaltung, keine Mechanik.
   *   4. Gleichzeitig tritt das Spielfeld einen Wimpernschlag zurueck (`nudgeCamera`) und
   *      kommt von selbst wieder heran. Dadurch bewegt sich auch die Ebene, die bei einem
   *      Bereichswechsel eigentlich stehen bleibt, und das Ganze wirkt wie **eine**
   *      Maschine, die umschaltet, statt wie zwei Bilder.
   *
   * Ein zweiter Klick waehrend der Bewegung braucht keine Sonderbehandlung mehr: Er wechselt
   * einfach wieder, und die neue Messung setzt dort an, wo die laufende Wanderung gerade
   * steht. Vorher lag zwischen Klick und Wechsel eine Abtrittszeit, und wer in ihr noch
   * einmal tippte, musste eigens abgefangen werden.
   */
  const flip = createFlip({
    nodes: () => app.querySelectorAll<HTMLElement>(MOVING),
    // Ob Bewegung laeuft, beantwortet das Stilblatt - fuer den Schalter im Spiel und fuer
    // die Einstellung des Betriebssystems dieselbe Stelle (`--motion`). Die Wanderung
    // laeuft ueber WAAPI und bekaeme von den CSS-Regeln sonst nichts mit.
    still: () => getComputedStyle(app).getPropertyValue('--motion').trim() === '0',
  })

  function goTo(view: View): void {
    if (state.runtime.view === view) return

    controls.nudgeCamera()
    flip.run(() => {
      setView(state, view)
      refresh()
    })
  }

  /*
   * Die Ueberschrift bleibt zwischen Basis, Prestige und Einstellungen stehen - sie wandert
   * nicht, weil sie ueberall an derselben Stelle sitzt. Nur ihr Text wechselt, und der taete
   * das ohne eigenen Anstoss schlagartig: Ausgerechnet die Stelle, die den Bereich benennt,
   * bekaeme als einzige keinen Uebergang.
   *
   * Sie bekommt ihn jetzt zweifach, und die beiden Teile sagen Verschiedenes: Die Klasse
   * `swap` laesst die Ueberschrift **ankommen** (sie faehrt aus der Unschaerfe herein und
   * raeumt sich selbst wieder weg), der Anschlag schreibt **den neuen Namen**. Der Vorlauf
   * ist laenger als sonst, damit der erste Buchstabe faellt, wenn die Unschaerfe weg ist -
   * getippte Zeichen hinter einem Weichzeichner liest niemand.
   */
  title.addEventListener('animationend', () => title.classList.remove('swap'))
  const titleWriter = createTypewriter({ delay: 220 })
  /** Der zuletzt angesagte Name. Nicht `title.textContent` - waehrend des Anschlags steht dort ein Bruchstueck. */
  let shownTitle = ''

  function refresh(): void {
    const view = state.runtime.view
    app.dataset['view'] = view

    const heading = t(titleKey(view))
    if (heading !== shownTitle) {
      shownTitle = heading
      title.classList.remove('swap')
      void title.offsetWidth
      title.classList.add('swap')
      titleWriter.write({ node: title, text: heading })
    }

    for (const [id, button] of buttons) button.classList.toggle('active', view === id)

    // Nur der sichtbare Bereich wird aufgebaut - alles zugleich waere Arbeit fuer nichts.
    if (view === 'base') {
      renderInventory(state, inventory, melting, refresh)
      renderModuleDetail(state, detail)
      renderShop(state, shop, melting, refresh)
    } else if (view === 'prestige') {
      if (!prestigePanel) prestigePanel = mountPrestigePanel(prestige, state, refresh)
      prestigePanel.update()
    } else if (view === 'combat' || view === 'upgrades') {
      if (!menu) menu = mountUpgradeMenu(state, upgrades, refresh)
      menu.setMode(view === 'upgrades' ? 'full' : 'compact')
      menu.update()

      // Faehigkeiten stehen nur in der vollen Ansicht: In der Kampfansicht ist das Panel
      // eine Handbreit hoch, und Karten mit Beschreibungstext haetten dort keinen Platz.
      if (view === 'upgrades') {
        if (!abilityPanel) abilityPanel = mountAbilityPanel(abilityBlock, state, refresh)
        abilityPanel.update()
        if (abilityBlock.parentElement !== upgrades) upgrades.appendChild(abilityBlock)
      } else {
        abilityBlock.remove()
      }
    } else if (view === 'settings') {
      settingsPanel.update()
    }

    dialogs.update()
  }

  refresh()

  return {
    refresh,
    update() {
      const view = state.runtime.view
      if (view === 'combat' || view === 'upgrades') menu?.update()
      // Der Punktestand aendert sich nur durch Handlungen - der Baum darf trotzdem
      // mitlaufen, weil `update` selbst prueft, ob sich etwas geaendert hat.
      if (view === 'prestige') prestigePanel?.update()
      // Der Aufstieg kann in **jedem** Bereich fallen - das Fenster gehoert dem Spieler,
      // nicht der Kampfansicht.
      dialogs.update()
    },
    detach() {
      dialogs.detach()
      titleWriter.reset()
      for (const node of [title, inventory, rail, settings, prestige, dockRow]) node.remove()
    },
  }
}

/**
 * Ueberschrift eines Bereichs. Nur die Bereiche ohne Spielfeld tragen eine - im Kampf
 * stuende sie ueber der Station und verdeckte genau das, was man sehen soll.
 */
function titleKey(view: View): 'view.base' | 'view.prestige' | 'view.settings' {
  if (view === 'base') return 'view.base'
  if (view === 'prestige') return 'view.prestige'
  return 'view.settings'
}

/**
 * Knoten mit Klassen. Bewusst als Liste statt als eine Zeichenkette: Der Selbsttest
 * durchsucht `ui/` nach Spielertexten im Code, und "panel upgrade-panel" liest sich fuer
 * ihn wie ein Satz. Einzelne Woerter sind eindeutig technisch.
 */
function element(tag: string, ...classes: string[]): HTMLElement {
  const node = document.createElement(tag)
  node.classList.add(...classes)
  return node
}

