/**
 * Upgrade-Panel (GDD 08 Abschnitt 5, GDD 13 Abschnitt 6).
 *
 * Es sitzt dauerhaft unten in der Kampfansicht - Verbessern ist die Handlung, die der
 * Spieler waehrend einer Welle staendig ausfuehrt, und sie soll keinen Bereichswechsel
 * kosten.
 *
 * **Bilder statt Zeilen.** Vorher trug jede Kachel ihren Namen als Text, und weil vierzehn
 * Kategorien nicht nebeneinander passten, lagen darueber eine Reiterleiste und ein
 * Sektionsbalken: drei Ebenen Beschriftung fuer drei Zahlen. Jetzt ist ein Pfad **eine
 * Kachel** - Zeichen, Stufe, Preis - und alle Pfade stehen zugleich da. Was ein Pfad
 * genau tut, sagt der Hinweis unter dem Zeiger; auf der Kachel steht nur, was man zum
 * Entscheiden braucht.
 *
 * Zwei Zeichen tragen die Bedeutung:
 *   das grosse   **was** verbessert wird - Schaden, Tempo, Reichweite
 *   die Marke    **wessen** Wert das ist - Kern, Turmart, Station
 * Dazu die Leitfarbe der Gruppe, in der auch ihr Turm auf dem Feld leuchtet. Drei Kacheln
 * derselben Gruppe stehen eng beieinander, zwischen den Gruppen ist mehr Luft - so liest
 * man die Ordnung, ohne dass irgendwo eine Ueberschrift steht.
 *
 * Turm-Upgrades stehen bewusst **je Turmart** und nicht je Exemplar (GDD 08 Abschnitt 5.2):
 * Bei 15 Tuermen bliebe das Menue sonst nicht ueberschaubar, und die eigentliche
 * Entscheidung - in welchen Turmtyp investiere ich? - gaebe es gar nicht.
 *
 * Zwei Groessen, eine Liste:
 *   compact  drei Reihen unten in der Kampfansicht, der Rest rollt
 *   full     der ganze Satz im Bereich "Upgrades"
 *
 * Aufgebaut wird nur bei einem Wechsel der Groesse. Gold aendert sich mit jedem
 * eingesammelten Stapel - wuerde das Panel dabei neu entstehen, spraenge bei jedem Klick
 * die Bildlaufposition zurueck.
 */

import { formatNumber, formatPercent } from '../core/format.ts'
import { t } from '../data/strings.ts'
import { TOWERS } from '../data/towers.ts'
import {
  globalUpgrades,
  upgradesForCore,
  upgradesForTower,
  type UpgradeDef,
} from '../data/upgrades.ts'
import { buyUpgrade, nextUpgradeCost } from '../app/actions.ts'
import type { GameState } from '../app/state.ts'
import { isUnlocked } from '../sim/prestige.ts'
import { upgradeLevel } from '../sim/stats.ts'
import { PALETTE } from '../render/theme.ts'
import { GLOBAL_ICON, icon, STAT_ICON, towerIcon, type IconName } from './icons.ts'
import { hideTooltip, showTooltip } from './tooltip.ts'

/** Symbol eines Pfads: Kampfwerte tragen ihr Wertzeichen, globale ihr Wirkzeichen. */
function iconFor(def: UpgradeDef): IconName {
  if (def.stat) return STAT_ICON[def.stat]
  if (def.global) return GLOBAL_ICON[def.global]
  return 'upgrade'
}

export type UpgradeMode = 'compact' | 'full'

export type UpgradeMenu = {
  /** Pro Bild aufrufen - schreibt nur, wenn sich etwas geaendert hat. */
  update(): void
  setMode(mode: UpgradeMode): void
}

type Category = {
  id: string
  name: string
  /** Leitfarbe der Gruppe - dieselbe, in der der Turm auf dem Feld leuchtet. */
  accent: string
  /** Marke der Gruppe. Sie steht klein auf jeder ihrer Kacheln. */
  icon: IconName
  paths: readonly UpgradeDef[]
}

type Tile = {
  def: UpgradeDef
  card: HTMLButtonElement
  level: HTMLElement
  cost: HTMLElement
}

/**
 * Kern, jede Turmart mit eigenen Pfaden, zuletzt die Station.
 *
 * Gesperrte Pfade fallen heraus - der Helfer erscheint erst, wenn der Prestige-Baum ihn
 * kaufbar gemacht hat (GDD 12 Abschnitt 10). Das ist eine **Datenabfrage** am Datensatz,
 * keine Fallunterscheidung nach "Helfer": Ein zweiter Helfer braucht hier keine Zeile.
 */
function categories(state: GameState): Category[] {
  const list: Category[] = [
    {
      id: 'core',
      name: t('upgrades.core'),
      accent: PALETTE.edge,
      icon: towerIcon('core', 'core'),
      paths: upgradesForCore(),
    },
  ]

  for (const tower of TOWERS) {
    const paths = upgradesForTower(tower.id)
    if (paths.length === 0) continue
    list.push({
      id: tower.id,
      name: tower.name,
      accent: tower.accent,
      icon: towerIcon(tower.id, 'tower'),
      paths,
    })
  }

  list.push({
    id: 'global',
    name: t('upgrades.global'),
    accent: PALETTE.gold,
    icon: 'base',
    paths: globalUpgrades().filter(
      (def) => def.unlock === undefined || isUnlocked(state, def.unlock),
    ),
  })
  return list
}

export function mountUpgradeMenu(
  state: GameState,
  root: HTMLElement,
  onChange: () => void,
): UpgradeMenu {
  let mode: UpgradeMode = 'compact'
  let tiles: Tile[] = []

  root.replaceChildren()

  // Gerollt wird innen, nicht am Panel: Aussen haengt in der vollen Ansicht noch die
  // Faehigkeitenverwaltung, und die soll nicht mit den Kacheln davonfahren.
  const body = document.createElement('div')
  body.className = 'cat-body'
  const grid = document.createElement('div')
  grid.className = 'upgrade-grid'
  body.appendChild(grid)
  root.appendChild(body)

  function build(): void {
    tiles = []
    grid.replaceChildren()

    // Neu einlesen: Ein eben gekaufter Prestige-Knoten macht einen Pfad sichtbar, und das
    // soll nicht erst beim naechsten Programmstart zu sehen sein.
    for (const group of categories(state)) {
      grid.appendChild(groupNode(group, state, tiles, onChange))
    }

    last = ''
    update()
  }

  let last = ''

  function update(): void {
    const signature = `${Math.floor(state.run.gold)}|${JSON.stringify(state.run.upgrades)}`
    if (signature === last) return
    last = signature

    for (const tile of tiles) {
      const level = upgradeLevel(state.run.upgrades, tile.def.id)
      const cost = nextUpgradeCost(state, tile.def.id)

      // Eine Null auf jeder ungekauften Kachel waere Rauschen. Die Stufe steht erst da,
      // wenn es eine gibt - und genau daran sieht man auf einen Blick, wo schon Gold liegt.
      tile.level.textContent = level > 0 ? String(level) : ''
      tile.cost.textContent = cost === null ? t('upgrades.max') : formatNumber(cost)

      // Kein `disabled`: Ein gesperrter Knopf bekommt keine Zeigerereignisse mehr, und
      // damit faende ausgerechnet der Pfad keinen Hinweis, den man sich noch nicht leisten
      // kann. Der Klick greift trotzdem nicht - `buyUpgrade` prueft selbst.
      const affordable = cost !== null && state.run.gold >= cost
      tile.card.classList.toggle('affordable', affordable)
      tile.card.classList.toggle('locked', !affordable)
      tile.card.setAttribute('aria-disabled', String(!affordable))
    }
  }

  build()

  return {
    update,
    setMode(next) {
      if (next === mode) return
      mode = next
      root.classList.toggle('wide', mode === 'full')
      build()
    },
  }
}

/** Eine Gruppe: ihre Kacheln stehen eng zusammen und wandern beim Umbruch gemeinsam. */
function groupNode(
  group: Category,
  state: GameState,
  tiles: Tile[],
  onChange: () => void,
): HTMLElement {
  const node = document.createElement('div')
  node.className = 'cat-group'
  node.style.setProperty('--accent', group.accent)
  for (const def of group.paths) node.appendChild(tile(group, def, state, tiles, onChange))
  return node
}

/** Eine Kachel: Stufe oben, Zeichen in der Mitte, Marke und Preis unten. */
function tile(
  group: Category,
  def: UpgradeDef,
  state: GameState,
  tiles: Tile[],
  onChange: () => void,
): HTMLButtonElement {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'upgrade-card'
  card.setAttribute('aria-label', t('upgrades.tipTitle', { group: group.name, path: def.label }))

  const level = document.createElement('b')
  level.className = 'lv'

  const symbol = document.createElement('span')
  symbol.className = 'sym'
  symbol.innerHTML = icon(iconFor(def), 32)

  const mark = document.createElement('span')
  mark.className = 'mark'
  mark.innerHTML = icon(group.icon, 16)

  const cost = document.createElement('span')
  cost.className = 'cost'

  const foot = document.createElement('span')
  foot.className = 'foot'
  foot.append(mark, cost)

  card.append(level, symbol, foot)

  card.addEventListener('click', () => {
    if (!buyUpgrade(state, def.id)) return
    // Neu anstossen, falls zweimal schnell hintereinander gekauft wird: Ohne den
    // Zwischenschritt bleibt die laufende Bewegung stehen und die zweite Quittung fehlt.
    card.classList.remove('bought')
    void card.offsetWidth
    card.classList.add('bought')
    // Der Hinweis steht noch offen und zeigt den alten Preis - er wird sofort nachgezogen.
    pointAt(card, describe(state, group, def))
    onChange()
  })
  // Die Quittung raeumt sich selbst weg - dafuer braucht es keine Uhr.
  card.addEventListener('animationend', () => card.classList.remove('bought'))

  // Der Text, der frueher auf der Kachel stand, steht jetzt hier - aber nur, wenn man
  // ihn braucht.
  card.addEventListener('pointerenter', () => {
    pointAt(card, describe(state, group, def))
  })
  card.addEventListener('pointerleave', () => hideTooltip())

  tiles.push({ def, card, level, cost })
  return card
}

/**
 * Der Hinweis haengt an der Kachel, nicht am Zeiger - sonst zittert er beim Bewegen.
 *
 * Freigehalten wird nicht die Kachel, sondern das **ganze Panel**. Eine Kachelwand hat
 * keinen Platz zwischen ihren Zeilen: Wer nur der Kachel selbst ausweicht, legt den Hinweis
 * ueber ihre Nachbarn, und ein Hinweis, der die naechste Kachel verdeckt, verhindert genau
 * den Vergleich, fuer den man ihn aufschlaegt. So steht er ueber der Leiste im freien Feld.
 */
function pointAt(card: HTMLElement, content: string): void {
  const box = card.getBoundingClientRect()
  const panel = card.closest('.upgrade-panel')?.getBoundingClientRect() ?? box

  showTooltip({ x: box.left + box.width / 2, y: panel.top }, content, {
    center: true,
    clear: { top: panel.top, bottom: panel.bottom },
  })
}

/** Was auf der Kachel keinen Platz hat: voller Name, Wirkung, Stufe, Preis. */
function describe(state: GameState, group: Category, def: UpgradeDef): string {
  const level = upgradeLevel(state.run.upgrades, def.id)
  const cost = nextUpgradeCost(state, def.id)

  // Pfade ohne prozentuale Wirkung - bisher nur der Goldsammler - zeigen ihre Stufe.
  // Ein "+0 %" waere dort schlicht falsch.
  const effect =
    def.amount === 0
      ? t('upgrades.level', { level })
      : formatPercent(def.amount * level, { sign: true })

  return (
    `<b>${t('upgrades.tipTitle', { group: group.name, path: def.label })}</b>` +
    `<br>${effect} · ${t('upgrades.tipLevel', { level, max: def.maxLevel })}` +
    `<br>${cost === null ? t('upgrades.max') : t('hud.costs', { amount: formatNumber(cost) })}`
  )
}
