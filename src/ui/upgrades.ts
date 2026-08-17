/**
 * Das Upgrade-Panel (GDD 13 Abschnitt 6, `docs/upgrade-umbau.md` Abschnitt 8).
 *
 * **Auf der Kachel steht nichts ausser Bild und Rahmen.** Kein Wert, kein Preis, keine
 * Stufe. Das ist die Entscheidung, aus der alles andere hier folgt - und sie ist das
 * Gegenteil dessen, was die Vorgaengerfassung getan hat.
 *
 * Der Grund ist die Zahl der Kacheln: Zwanzig Stueck in zwei Reihen lassen einer Kachel bei
 * gewoehnlicher Fensterbreite rund achtzig Pixel Kante. Ein Name, ein Wert und ein Preis
 * darin waeren drei Zeilen Kleinstschrift nebeneinander - lesbar erst, wenn man nah
 * herangeht, und dann liest man ohnehin nur eine. Ein **Bild** dagegen ist auf achtzig
 * Pixeln genau richtig, und der Rahmen sagt in derselben Flaeche noch, ob man kaufen kann.
 *
 * Was dadurch verloren geht, holt der Hinweis zurueck - und zwar vollstaendig: Er ist die
 * einzige Stelle, an der Zahlen stehen, und er sagt bei **jeder** Kachel dasselbe
 * (`ui/upgradetext.ts`).
 *
 * Fuenf Zustaende traegt der Rahmen, und die Farbe ist die **Art** und nicht das Ziel: So
 * sieht man beim Ueberfliegen, wo die teuren Entscheidungen eines Fensters liegen - die
 * Auskunft, die man beim Ueberfliegen braucht.
 */

import { formatInt } from '../core/format.ts'
import { t } from '../data/strings.ts'
import {
  upgradeById,
  upgradeIcon,
  upgradesInWindow,
  WINDOW_SLOTS,
  type UpgradeDef,
  type UpgradeWindow,
} from '../data/upgrades.ts'
import { buyUpgrade, nextUpgradeCost, upgradeBlock } from '../app/actions.ts'
import type { GameState } from '../app/state.ts'
import { upgradeLevel } from '../sim/stats.ts'
import { mountReveal } from './reveal.ts'
import { hideTooltip, showTooltip } from './tooltip.ts'
import { amountText, kindName, totalText } from './upgradetext.ts'

export type UpgradeMode = 'compact' | 'full'

export type UpgradeMenu = {
  /** Pro Bild aufrufen - schreibt nur, wenn sich etwas geaendert hat. */
  update(): void
  setMode(mode: UpgradeMode): void
}

type Tile = {
  def: UpgradeDef
  node: HTMLButtonElement
}

export function mountUpgradeMenu(
  state: GameState,
  root: HTMLElement,
  onChange: () => void,
): UpgradeMenu {
  let mode: UpgradeMode = 'compact'
  let tiles: Tile[] = []
  /** Fuer welches Fenster das Raster gebaut wurde. */
  let builtFor: UpgradeWindow | null = null

  root.replaceChildren()

  const grid = document.createElement('div')
  grid.className = 'up-grid'
  root.appendChild(grid)

  // Die Punktmatrix unter dem Zeiger haengt am Raster und nicht an den Kacheln: `build`
  // wirft die Kacheln bei jedem Fensterwechsel weg (`ui/reveal.ts`).
  mountReveal(grid, '.up-tile')

  function build(): void {
    const window = state.runtime.upgradeWindow
    tiles = []
    grid.replaceChildren()
    builtFor = window

    for (const def of upgradesInWindow(window)) {
      const node = tileNode(def, state, onChange)
      tiles.push({ def, node })
      grid.appendChild(node)
    }

    /*
     * Leere Plaetze bis zwanzig auffuellen.
     *
     * Ein leerer Platz ist ein **sichtbar leerer Platz** und keine Luecke: Er sagt, dass das
     * Fenster noch Raum hat. Ohne ihn ruecken die vorhandenen Kacheln auseinander, und ein
     * Fenster mit achtzehn Eintraegen saehe anders aus als eines mit zwanzig - obwohl sich
     * nur der Inhalt unterscheidet, nicht das Raster.
     */
    for (let i = upgradesInWindow(window).length; i < WINDOW_SLOTS; i++) {
      const empty = document.createElement('div')
      empty.className = 'up-tile up-empty'
      grid.appendChild(empty)
    }

    last = ''
    update()
  }

  let last = ''

  function update(): void {
    if (builtFor !== state.runtime.upgradeWindow) {
      build()
      return
    }

    const signature = `${Math.floor(state.run.gold)}|${JSON.stringify(state.run.upgrades)}`
    if (signature === last) return
    last = signature

    for (const tile of tiles) paint(tile, state)
  }

  build()

  return {
    update,
    setMode(next) {
      if (next === mode) return
      mode = next
      root.classList.toggle('wide', mode === 'full')
    },
  }
}

/**
 * Der Zustand einer Kachel als ein Wort.
 *
 * Die Reihenfolge der Abfragen ist die Reihenfolge der Endgueltigkeit: Was ausgekauft ist,
 * bleibt ausgekauft; was hinter einem Prestige-Knoten oder einem Tor liegt, ist gesperrt,
 * egal wie viel Gold dasteht.
 */
function stateOf(def: UpgradeDef, state: GameState): string {
  const block = upgradeBlock(state, def.id)
  if (block === 'max') return 'maxed'
  if (block !== null) return 'locked'

  const cost = nextUpgradeCost(state, def.id)
  return cost !== null && state.run.gold >= cost ? 'ready' : 'unaffordable'
}

function paint(tile: Tile, state: GameState): void {
  const level = upgradeLevel(state.run.upgrades, tile.def.id)
  const status = stateOf(tile.def, state)

  tile.node.dataset['state'] = status
  // Der Fortschritt als Anteil - das Stilblatt macht daraus die Kerben am Rand. Endlose
  // Pfade haben keinen: Ein Anteil an Unendlich ist keine Auskunft.
  const share = Number.isFinite(tile.def.maxLevel) ? level / tile.def.maxLevel : 0
  tile.node.style.setProperty('--fill', String(share))
  tile.node.classList.toggle('has-level', level > 0)

  tile.node.setAttribute('aria-disabled', String(status !== 'ready'))
}

function tileNode(def: UpgradeDef, state: GameState, onChange: () => void): HTMLButtonElement {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = 'up-tile'
  node.dataset['kind'] = def.kind
  node.setAttribute('aria-label', def.name)

  const art = document.createElement('i')
  art.className = 'up-art'
  art.style.setProperty('--icon', `url('/icons/upgrades/${upgradeIcon(def)}.svg')`)
  node.appendChild(art)

  node.addEventListener('click', () => {
    if (!buyUpgrade(state, def.id)) return
    node.classList.remove('bought')
    void node.offsetWidth
    node.classList.add('bought')
    // Der Hinweis steht noch offen und zeigt den alten Preis - er wird sofort nachgezogen.
    pointAt(node, describe(state, def))
    onChange()
  })
  node.addEventListener('animationend', () => node.classList.remove('bought'))

  node.addEventListener('pointerenter', () => pointAt(node, describe(state, def)))
  node.addEventListener('pointerleave', () => hideTooltip())

  return node
}

/**
 * Der Hinweis haengt an der Kachel, wird aber ueber dem **ganzen Panel** freigehalten.
 *
 * Eine Kachelwand hat keinen Platz zwischen ihren Zeilen: Wer nur der Kachel selbst
 * ausweicht, legt den Hinweis ueber ihre Nachbarn - und ein Hinweis, der die naechste Kachel
 * verdeckt, verhindert genau den Vergleich, fuer den man ihn aufschlaegt.
 */
function pointAt(node: HTMLElement, content: string): void {
  const box = node.getBoundingClientRect()
  const panel = node.closest('.upgrade-panel')?.getBoundingClientRect() ?? box

  showTooltip({ x: box.left + box.width / 2, y: panel.top }, content, {
    center: true,
    clear: { top: panel.top, bottom: panel.bottom },
  })
}

/**
 * Alles, was von der Kachel verschwunden ist - und bei jeder Kachel in derselben Form.
 *
 * Die letzte Zeile ist die wichtigste: Sie sagt **warum** nicht gekauft werden kann. Ein
 * Katalog mit Voraussetzungen und Ausschluessen hat Kacheln, die aus fuenf verschiedenen
 * Gruenden stillstehen, und "kein Preis" nennt keinen davon. `Brink` ohne `Last Stand` saehe
 * sonst genauso aus wie `Storm Doctrine` nach dem Kauf von `Iron Doctrine` - dabei wartet
 * das eine auf einen Kauf und das andere ist fuer diesen Run endgueltig verloren.
 */
function describe(state: GameState, def: UpgradeDef): string {
  const level = upgradeLevel(state.run.upgrades, def.id)
  const cost = nextUpgradeCost(state, def.id)
  const block = upgradeBlock(state, def.id)

  const rows: string[] = []

  const per = amountText(def.effect)
  if (per !== null) rows.push(row(t('upgrades.perLevel'), per))

  const total = totalText(def, level)
  if (total !== null) rows.push(row(t('upgrades.total'), total))

  rows.push(row(t('upgrades.levelRow'), levelText(def, level)))

  let foot: string
  if (cost !== null) foot = t('hud.costs', { amount: formatInt(cost) })
  else if (block === 'max') foot = t('upgrades.max')
  else if (block === 'requires' && def.requires !== undefined) {
    foot = t('upgrades.needs', { name: upgradeById(def.requires).name })
  } else if (block === 'excluded' && def.excludes !== undefined) {
    foot = t('upgrades.blocked', { name: upgradeById(def.excludes).name })
  } else if (block === 'node') foot = t('upgrades.sealed')
  else foot = t('upgrades.locked')
  rows.push(row(t('upgrades.costRow'), foot))

  return (
    `<b>${def.name}</b> <em>${kindName(def.kind)}</em>` +
    `<br>${def.info}` +
    `<table class="tip-rows">${rows.join('')}</table>`
  )
}

function row(label: string, value: string): string {
  return `<tr><th>${label}</th><td>${value}</td></tr>`
}

/** Endlose Pfade haben kein Maximum - "3 / Infinity" waere keine Auskunft. */
function levelText(def: UpgradeDef, level: number): string {
  if (!Number.isFinite(def.maxLevel)) return t('upgrades.level', { level })
  return t('upgrades.tipLevel', { level, max: def.maxLevel })
}
