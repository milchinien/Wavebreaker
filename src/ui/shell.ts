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
import { windowOpen, type UpgradeWindow } from '../data/upgrades.ts'
import { ensureOpenWindow, setUpgradeWindow, setView } from '../app/actions.ts'
import type { GameState, View } from '../app/state.ts'
import { mountAbilityPanel, type AbilityPanel } from './abilities.ts'
import { createMeltSelection, renderInventory, renderModuleDetail, renderShop } from './base.ts'
import { mountDialogs, type Dialogs } from './dialogs.ts'
import { mountCoreGauge } from './coregauge.ts'
import { createFlip } from './flip.ts'
import { icon, type IconName } from './icons.ts'
import { mountPrestigePanel, type PrestigePanel } from './prestige.ts'
import { mountSettings, type SettingsControls } from './settings.ts'
import { describe } from './tooltip.ts'
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
  /**
   * Pro Bild aufrufen - aktualisiert nur, was sich staendig aendert.
   *
   * `viewTime` ist die Zeit, mit der auch das Feld gezeichnet wird (`main.ts`): echte Zeit,
   * keine Simulationszeit. Nur das Kernfeld braucht sie, und es braucht **genau** diese -
   * sein Kern und der auf dem Feld sollen im selben Takt atmen.
   */
  update(viewTime: number): void
  /**
   * In einen Bereich wechseln - derselbe Weg wie ueber die Navileiste, samt Wanderung.
   *
   * Herausgereicht, weil auch **ausserhalb** der Navileiste Wege in einen Bereich fuehren:
   * Der freie Platz in der Faehigkeitenschiene fuehrt zu den Upgrades. Wer stattdessen
   * `setView` aufriefe, saesse mit gesetztem Zustand vor unveraendertem Bild - `data-view`
   * und die Panels haengen an `refresh`, nicht am Zustand.
   */
  goTo(view: View): void
  detach(): void
}

/**
 * Die Navileiste (`docs/upgrade-umbau.md` Abschnitt 8.5).
 *
 * Sechs Reiter, und sie sind **nicht alle dasselbe**: Zwei fuehren in einen Bereich, vier
 * tauschen die Kacheln unter dem Spielfeld aus. Das ist der Grund fuer die zwei Sorten
 * Eintrag - ein Fensterwechsel ist kein Bereichswechsel und bekommt deshalb auch nicht die
 * Bereichsbewegung (`ui/flip.ts`).
 *
 * Der eigene Knopf fuer den Kampf ist entfallen: Jeder der vier Upgrade-Reiter **ist** die
 * Kampfansicht, nur mit anderen Kacheln darunter. Ein sechster Knopf "Kampfansicht ohne
 * Upgrades" waere ein Reiter fuer nichts. Die Einstellungen sind aus demselben Grund
 * gewandert - als Zahnrad in die Ressourcenzeile (`ui/hud.ts`), weil man sie waehrend des
 * Spiels nie braucht.
 */
type NavEntry =
  | { kind: 'view'; id: View; icon: IconName; label: 'view.base' | 'view.prestige' }
  | {
      kind: 'window'
      window: UpgradeWindow
      icon: IconName
      label: 'upgrades.window1' | 'upgrades.window2' | 'upgrades.window3' | 'upgrades.window4'
    }

const NAV: readonly NavEntry[] = [
  { kind: 'view', id: 'base', icon: 'base', label: 'view.base' },
  { kind: 'window', window: 1, icon: 'upgrade', label: 'upgrades.window1' },
  { kind: 'window', window: 2, icon: 'modules', label: 'upgrades.window2' },
  { kind: 'window', window: 3, icon: 'combat', label: 'upgrades.window3' },
  { kind: 'window', window: 4, icon: 'gear', label: 'upgrades.window4' },
  { kind: 'view', id: 'prestige', icon: 'crosshair', label: 'view.prestige' },
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
 *
 * Ebenfalls nicht dabei, und aus dem umgekehrten Grund: die **Ressourcenzeile** und das
 * **Kernfeld**. Beide stehen in allen fuenf Bereichen an derselben Stelle und haben damit
 * nichts, wohin sie wandern koennten. Sie sind die Fixpunkte, gegen die man die Bewegung
 * der anderen sieht - eine Kopfleiste, die beim Wechsel mitzuckt, waere kein Fixpunkt mehr,
 * und ein Kern, der bei jedem Reiterdruck einmal huepft, waere kein Instrument.
 */
const MOVING = [
  '.wave-card',
  '.hull-bar',
  '.speed-control',
  '.upgrade-panel',
  '.action-panel',
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
  // Sie traegt, was man anfasst. Alle Zahlen stehen ueber dem Feld (siehe `ui/hud.ts`) -
  // vorher lagen sie hier und machten die Leiste doppelt so hoch.
  const dockRow = element('div', 'dock-row')
  const nav = element('nav', 'nav')
  const upgrades = element('section', 'panel', 'upgrade-panel')

  /*
   * Das Kernfeld in der Fuge zwischen Reiterleiste und Kachelwand (`ui/coregauge.ts`).
   *
   * Es ist die eine Ausnahme von der Regel oben, und es ist eine echte: Es traegt keine
   * Zahl, sondern eine Flaeche, die steigt - und es macht die Leiste um keinen Pixel hoeher,
   * weil es den Platz nimmt, den das Raster zwischen den beiden ohnehin frei laesst. Wo es
   * den nicht gibt, gibt es auch das Feld nicht; das entscheidet allein das Stilblatt.
   */
  const coreGauge = element('div', 'core-gauge')

  /*
   * Derselbe Platz wie die Kachelwand - fuer die Bereiche, die keine haben.
   *
   * Basis und Prestige haben je **eine** Handlung, um die sich alles dreht: einen Turm kaufen
   * und den Run zuruecksetzen. Beide standen bisher als schmaler Knopf in einem Panel am
   * rechten Rand, zwischen Ueberschriften und Hinweiszeilen - und die halbe untere Leiste
   * stand daneben leer. Jetzt steht die Handlung dort, wo im Kampf gekauft wird: Der Platz
   * unten rechts heisst in jedem Bereich "hier gibst du etwas aus".
   *
   * Zwei Faecher statt eines, je Bereich eines. Ein gemeinsames muesste beim Wechsel geleert
   * und neu gefuellt werden, und wer es versaeumt, hat den Kaufknopf im Prestige stehen.
   */
  const action = element('section', 'panel', 'action-panel')
  const buySlot = element('div', 'action-slot', 'action-buy')
  const prestigeSlot = element('div', 'action-slot', 'action-prestige')
  action.append(buySlot, prestigeSlot)

  dockRow.append(nav, coreGauge, upgrades, action)
  dock.append(dockRow)

  // Die Faehigkeitenverwaltung haengt im Upgrades-Bereich (GDD 13 Abschnitt 6) und liegt
  // deshalb im selben Panel, unterhalb der Upgrade-Kacheln.
  const abilityBlock = element('div', 'ability-block')

  const navButtons: { entry: NavEntry; node: HTMLButtonElement }[] = []
  for (const entry of NAV) {
    const button = document.createElement('button')
    button.type = 'button'
    const slug = entry.kind === 'view' ? entry.id : `window${entry.window}`
    button.className = `nav-button nav-${slug}`
    button.setAttribute('aria-label', t(entry.label))
    // Name UND Aufgabe. Sechs Piktogramme ohne ein Wort sind fuer einen Neuling sechsmal
    // dasselbe Raetsel - und hinter einem davon liegt die einzige Bauanleitung des Spiels.
    describe(button, `<b>${t(entry.label)}</b><br>${t(`${entry.label}.about`)}`)
    /*
     * Das Bild des Reiters - eine hochkante Tafel im Format 1:2 (`public/nav/`).
     *
     * Es steht als Wert und nicht als Knoten, weil das Stilblatt es als **eine von drei
     * Lagen** hinter der Fassung zeichnet (`.nav-button`). Fehlt die Datei, bleibt die Lage
     * leer und darunter steht der gezeichnete Reiter mit seinem Zeichen: Ein fehlendes Bild
     * darf nie einen leeren Reiter ergeben - dieselbe Regel wie im Upgrade-Raster.
     */
    button.style.setProperty('--art', `url('/nav/${slug}.png')`)
    button.innerHTML = icon(entry.icon, 30)
    button.addEventListener('click', () => {
      if (entry.kind === 'view') {
        goTo(entry.id)
        return
      }
      /*
       * Ein Fensterwechsel ist **kein** Bereichswechsel: Er tauscht die Kacheln und sonst
       * nichts. Deshalb laeuft er nicht durch `goTo` - und deshalb ruckt weder die Kamera
       * noch wandert ein Panel, wenn man zwischen zwei Fenstern blaettert.
       *
       * Steht der Spieler gerade woanders, bringt der Reiter ihn allerdings zurueck: Er
       * zeigt Kacheln, und Kacheln gibt es nur unter dem Spielfeld.
       */
      if (!setUpgradeWindow(state, entry.window)) return
      if (state.runtime.view !== 'combat' && state.runtime.view !== 'upgrades') {
        goTo('combat')
        return
      }
      refresh()
    })
    navButtons.push({ entry, node: button })
    nav.appendChild(button)
  }

  const gauge = mountCoreGauge(coreGauge, state)
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
    // Ein Prestige nimmt die Tore zurueck - dann darf der Reiter nicht auf einem Fenster
    // stehen bleiben, das dieser Run erst wieder freischalten muss.
    ensureOpenWindow(state)

    const heading = t(titleKey(view))
    if (heading !== shownTitle) {
      shownTitle = heading
      title.classList.remove('swap')
      void title.offsetWidth
      title.classList.add('swap')
      titleWriter.write({ node: title, text: heading })
    }

    /*
     * Welcher Reiter leuchtet - und welcher ein Schloss traegt.
     *
     * Gesperrte Fenster stehen **sichtbar** in der Leiste. Was man noch nicht hat, muss man
     * sehen koennen, sonst ist das Tor keine Belohnung, sondern eine Ueberraschung.
     */
    const fighting = view === 'combat' || view === 'upgrades'
    for (const { entry, node } of navButtons) {
      if (entry.kind === 'view') {
        node.classList.toggle('active', view === entry.id)
        continue
      }
      const open = windowOpen(state.run.upgrades, entry.window)
      node.classList.toggle('active', fighting && state.runtime.upgradeWindow === entry.window)
      node.classList.toggle('sealed', !open)
      node.setAttribute('aria-disabled', String(!open))
    }

    // Nur der sichtbare Bereich wird aufgebaut - alles zugleich waere Arbeit fuer nichts.
    if (view === 'base') {
      renderInventory(state, inventory, melting, refresh)
      renderModuleDetail(state, detail)
      renderShop(state, shop, melting, refresh, buySlot)
    } else if (view === 'prestige') {
      if (!prestigePanel) prestigePanel = mountPrestigePanel(prestige, state, refresh, prestigeSlot)
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
    goTo,
    update(viewTime) {
      const view = state.runtime.view
      if (view === 'combat' || view === 'upgrades') menu?.update()
      // Das Kernfeld laeuft in **jedem** Bereich mit: Die Stufe steigt auch, waehrend man
      // baut oder im Prestige-Baum liest, und der Kern atmet dort wie im Kampf.
      gauge.update(viewTime)
      // Der Punktestand aendert sich nur durch Handlungen - der Baum darf trotzdem
      // mitlaufen, weil `update` selbst prueft, ob sich etwas geaendert hat.
      if (view === 'prestige') prestigePanel?.update()
      // Der Aufstieg kann in **jedem** Bereich fallen - das Fenster gehoert dem Spieler,
      // nicht der Kampfansicht.
      dialogs.update()
    },
    detach() {
      dialogs.detach()
      gauge.detach()
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
