/**
 * Der Prestige-Bereich (GDD 10, GDD 13 Abschnitt 6).
 *
 * Aufbau nach GDD 13: oben die Punkte, in der Mitte der Baum, und der Auslöser daneben.
 *
 * **Bilder statt Zeilen** - dieselbe Entscheidung wie im Upgrade-Menue (`ui/upgrades.ts`),
 * und aus demselben Grund. Vorher trug jeder der dreissig Knoten Namen, Beschreibung und
 * Preis als Text, verteilt auf sieben Abschnitte mit eigenem Balken: eine Seite Fliesstext
 * fuer dreissig Ja/Nein-Fragen, die man nur rollend ueberblicken konnte. Jetzt ist ein
 * Knoten **eine Kachel** - Zeichen, Rang, Preis - und der ganze Baum steht auf einem Bild.
 * Was ein Knoten genau tut, sagt der Hinweis unter dem Zeiger.
 *
 * Drei Dinge tragen die Ordnung, die vorher die Balken trugen:
 *   die Leitfarbe  welcher Bereich - Wirtschaft gold, Tuerme cyan, Technik violett
 *   die Marke      derselbe Bereich noch einmal als Zeichen, klein auf jeder Kachel
 *   die Kette      Knoten, die aufeinander aufbauen, haengen sichtbar aneinander
 * Die Kette ist dabei keine Handarbeit, sondern aus `requires` gerechnet - der Baum zeichnet
 * seine eigenen Aeste (siehe `chainsOfArea`).
 *
 * Der Zustand eines Knotens steht in **einer Farbe** (GDD 13 Abschnitt 6):
 *
 *   gesperrt    dunkel    - Voraussetzung fehlt
 *   verfuegbar  leuchtend - kaufbar, sobald die Punkte reichen
 *   gekauft     tuerkis   - dauerhaft
 *
 * Der wichtigste Teil ist nicht der Baum, sondern das **Bestaetigungsfenster**: Prestige
 * soll nie wie ein Verlust wirken (GDD 10 Abschnitt 1). Deshalb steht dort nebeneinander,
 * was es einbringt und was es kostet - einschliesslich des Hinweises auf Gold, das noch
 * herumliegt und mit verfaellt (GDD 10 Abschnitt 3).
 */

import { formatNumber } from '../core/format.ts'
import { PRESTIGE_MIN_GOLD } from '../data/balance.ts'
import {
  nodesOfArea,
  prestigeNodeById,
  type PrestigeArea,
  type PrestigeNode,
} from '../data/prestige.ts'
import { t } from '../data/strings.ts'
import type { Rarity } from '../data/types.ts'
import { buyPrestigeNode, performPrestige } from '../app/actions.ts'
import { waveRecord, type GameState } from '../app/state.ts'
import {
  canPrestige,
  goldLostOnPrestige,
  isAvailable,
  isUnlocked,
  prestigePoints,
} from '../sim/prestige.ts'
import { PALETTE, RARITY_COLOR } from '../render/theme.ts'
import { icon, prestigeIcon, type IconName } from './icons.ts'
import { setSlideLabel } from './slide.ts'
import { hideTooltip, showTooltip } from './tooltip.ts'

export type PrestigePanel = {
  /** Nach jeder Handlung aufrufen - baut neu, wenn sich Punkte oder Knoten geaendert haben. */
  update(): void
}

type Area = {
  id: PrestigeArea
  label:
    | 'area.economy'
    | 'area.towers'
    | 'area.speed'
    | 'area.rarity'
    | 'area.tech'
    | 'area.helpers'
    | 'area.traits'
  /** Leitfarbe des Bereichs - sie ersetzt den Sektionsbalken, der hier frueher stand. */
  accent: string
  /** Marke des Bereichs. Sie steht klein auf jeder seiner Kacheln. */
  icon: IconName
}

/**
 * Die Bereiche des Baums in ihrer Reihenfolge (GDD 10 Abschnitt 6).
 *
 * Sie steht hier und nicht in `data/prestige.ts`, weil sie eine Frage der Darstellung ist:
 * Wirtschaft zuerst, weil sie der Einstieg ist; Eigenschaften zuletzt, weil sie das
 * teuerste Ende sind. Ein Bereich, der in dieser Liste fehlt, ist im Baum nicht zu sehen -
 * deshalb ist sie gegen den Datensatz abgesichert (siehe `selftest/suites/prestige.ts`).
 *
 * Tuerkis fehlt mit Absicht: Es ist die Farbe von "gekauft" und darf keinem Bereich gehoeren,
 * sonst hiesse dieselbe Farbe an zwei Kacheln zweierlei.
 */
const AREAS: readonly Area[] = [
  { id: 'economy', label: 'area.economy', accent: PALETTE.gold, icon: 'coin' },
  { id: 'towers', label: 'area.towers', accent: PALETTE.cyan, icon: 'base' },
  { id: 'speed', label: 'area.speed', accent: PALETTE.lime, icon: 'rate' },
  { id: 'rarity', label: 'area.rarity', accent: PALETTE.edge, icon: 'modules' },
  { id: 'tech', label: 'area.tech', accent: PALETTE.violet, icon: 'turret' },
  { id: 'helpers', label: 'area.helpers', accent: PALETTE.edge, icon: 'radius' },
  { id: 'traits', label: 'area.traits', accent: PALETTE.violet, icon: 'amplifier' },
]

/** Fuer den Selbsttest: welche Bereiche der Baum ueberhaupt zeigt. */
export const SHOWN_AREAS: readonly PrestigeArea[] = AREAS.map((area) => area.id)

export function mountPrestigePanel(
  root: HTMLElement,
  state: GameState,
  onChange: () => void,
  /**
   * Das Fach in der unteren Leiste, an dem im Kampf die Kachelwand steht (`ui/shell.ts`).
   *
   * Der Ausloeser steht **dort** und nicht mehr im Panel. Er ist die einzige Handlung des
   * Bereichs - alles andere hier ist Auskunft darueber, was sie kostet und was sie bringt -,
   * und im Panel stand er am Ende einer Spalte aus Hinweiszeilen, wo man ihn suchen musste.
   */
  action: HTMLElement,
): PrestigePanel {
  let last = ''

  function update(): void {
    const signature = [
      state.permanent.prestigePoints,
      state.permanent.prestigeNodes.join(','),
      state.permanent.prestigeCount,
      Math.floor(state.run.goldEarned),
      waveRecord(state),
    ].join('|')
    if (signature === last) return
    last = signature

    // Der Hinweis haengt an einer Kachel, die es gleich nicht mehr gibt - stehen bliebe er
    // ueber dem neuen Baum und zeigte den alten Preis.
    hideTooltip()

    root.replaceChildren(head(state), reset(state), wall(state, onChange))
    action.replaceChildren(trigger(state, onChange))
  }

  update()
  return { update }
}

/** Punktestand und wie oft schon zurueckgesetzt wurde. */
function head(state: GameState): HTMLElement {
  const box = document.createElement('div')
  box.className = 'prestige-head'

  const points = document.createElement('div')
  points.className = 'prestige-points'
  points.innerHTML =
    `<span>${t('prestige.points')}</span>` +
    `<b>${formatNumber(state.permanent.prestigePoints)}</b>`

  const count = document.createElement('span')
  count.className = 'muted'
  count.textContent = t('prestige.count', { count: state.permanent.prestigeCount })

  box.append(points, count)
  return box
}

/**
 * Was das Zuruecksetzen kostet und was es bringt - der Knopf dazu steht woanders.
 *
 * Die Trennung ist die Aussage: Hier steht die **Rechnung**, unten in der Leiste die
 * **Handlung**. Vorher stand beides in derselben Spalte, und der Knopf war die letzte von
 * sechs Zeilen - man las drei Hinweise, bevor man das fand, weswegen man hergekommen war.
 */
function reset(state: GameState): HTMLElement {
  const box = document.createElement('section')
  box.className = 'panel prestige-reset'

  const ready = canPrestige(state)
  const earned = prestigePoints(state)

  const title = document.createElement('h2')
  title.textContent = t('prestige.title')
  box.appendChild(title)

  const line = document.createElement('p')
  line.className = ready ? 'prestige-earn' : 'muted'
  line.textContent = ready
    ? t('prestige.earn', { points: formatNumber(earned) })
    : t('prestige.locked', { amount: formatNumber(PRESTIGE_MIN_GOLD) })
  box.appendChild(line)

  if (ready) {
    // Der Hinweis auf liegendes Gold - "damit niemand versehentlich Ertrag verschenkt"
    // (GDD 10 Abschnitt 3).
    const lost = goldLostOnPrestige(state)
    if (lost > 0) {
      const warn = document.createElement('p')
      warn.className = 'warn'
      warn.textContent = t('prestige.warnGold', { amount: formatNumber(Math.floor(lost)) })
      box.appendChild(warn)
    }

    for (const key of ['prestige.resets', 'prestige.keeps'] as const) {
      const note = document.createElement('p')
      note.className = 'muted small'
      note.textContent = t(key)
      box.appendChild(note)
    }
  }

  return box
}

/**
 * Der Ausloeser samt Bestaetigung.
 *
 * Bewusst zweistufig: Ein Klick zeigt, was passiert, der zweite tut es. Prestige ist die
 * einzige Handlung im Spiel, die Fortschritt vernichtet - sie darf nicht aus Versehen
 * geschehen. Der Knopf traegt die Warnfarbe und liegt gross im Fach unten rechts, wo im
 * Kampf gekauft wird: Es ist derselbe Griff, nur teurer.
 */
function trigger(state: GameState, onChange: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'wide-button danger action-button'
  setSlideLabel(button, t('prestige.confirm'))
  button.disabled = !canPrestige(state)
  button.addEventListener('click', () => {
    if (!button.classList.contains('armed')) {
      button.classList.add('armed')
      return
    }
    if (performPrestige(state)) onChange()
  })
  return button
}

/**
 * Der Baum als Kachelwand.
 *
 * Ein Bereich bleibt beim Umbruch zusammen, seine Ketten stehen darin nebeneinander. Die
 * groessere Luft zwischen den Bereichen ist damit die einzige Ueberschrift, die es hier noch
 * gibt - genau wie in der Kachelwand der Upgrades.
 */
function wall(state: GameState, onChange: () => void): HTMLElement {
  const box = document.createElement('div')
  box.className = 'node-wall'

  for (const area of AREAS) {
    const group = document.createElement('div')
    group.className = 'node-area'
    group.style.setProperty('--accent', area.accent)

    for (const chain of chainsOfArea(area.id)) {
      const row = document.createElement('div')
      row.className = 'node-chain'
      for (const [index, node] of chain.entries()) {
        // Der Rang steht nur dort, wo es einen zu unterscheiden gibt. Eine "1" auf einem
        // alleinstehenden Knoten waere Rauschen.
        const rank = chain.length > 1 ? index + 1 : 0
        row.appendChild(nodeCard(state, area, node, rank, onChange))
      }
      group.appendChild(row)
    }

    box.appendChild(group)
  }

  return box
}

/**
 * Die Aeste eines Bereichs, aus `requires` gerechnet.
 *
 * Eine Kette ist ein Weg: Jeder Knoten haengt an dem, der vor ihm steht. Trifft ein Knoten
 * auf das Ende einer Kette seines Bereichs, wird er ihr neues Ende; sonst beginnt er eine
 * eigene. So stehen "Gold I - II - III" nebeneinander und "Abwesenheitsertrag" daneben,
 * ohne dass die Reihenfolge irgendwo noch einmal von Hand steht.
 *
 * Voraussetzungen aus **anderen** Bereichen unterbrechen die Kette bewusst nicht - die
 * Eigenschaften haengen an den Raritaeten und blieben sonst ein Haufen Einzelkacheln. Der
 * Hinweis nennt die fehlende Voraussetzung beim Namen.
 */
function chainsOfArea(area: PrestigeArea): PrestigeNode[][] {
  const chains: PrestigeNode[][] = []
  /** Welche Kette gerade auf welchem Knoten endet. */
  const tails = new Map<string, PrestigeNode[]>()

  for (const node of nodesOfArea(area)) {
    let chain: PrestigeNode[] | undefined
    for (const required of node.requires) {
      chain = tails.get(required)
      if (chain) {
        tails.delete(required)
        break
      }
    }
    if (!chain) {
      chain = []
      chains.push(chain)
    }
    chain.push(node)
    tails.set(node.id, chain)
  }

  return chains
}

/**
 * Die Farbe einer Kachel.
 *
 * Normalerweise die Leitfarbe ihres Bereichs. Knoten, die eine **Seltenheitsstufe**
 * freischalten, tragen aber deren Farbe: Grün, Cyan, Gold und Magenta bedeuten im ganzen
 * Spiel dasselbe - am Rahmen eines Turms im Lager wie hier. Vier gleich violette Kacheln
 * wuessten dagegen nur, dass sie zusammengehoeren, und nicht, welche davon die legendaere ist.
 */
function accentOf(node: PrestigeNode, area: Area): string {
  const tier = node.id.split('.')[1]
  if (tier && tier in RARITY_COLOR) return RARITY_COLOR[tier as Rarity]
  return area.accent
}

/** Eine Kachel: Rang oben, Zeichen in der Mitte, Marke und Preis unten. */
function nodeCard(
  state: GameState,
  area: Area,
  node: PrestigeNode,
  rank: number,
  onChange: () => void,
): HTMLElement {
  const bought = isUnlocked(state, node.id)
  // `isAvailable` schliesst gekaufte Knoten aus - die beiden Zustaende koennen sich hier
  // also nicht ueberlagern.
  const available = isAvailable(state, node.id)
  const affordable = state.permanent.prestigePoints >= node.cost

  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'node-card'
  card.style.setProperty('--accent', accentOf(node, area))
  card.classList.toggle('bought', bought)
  card.classList.toggle('available', available)
  // Zu teuer ist **kein** eigener Zustand: Der Knoten leuchtet weiter, nur der Preis tritt
  // zurueck. Sonst waere nicht zu erkennen, worauf man sparen soll.
  card.classList.toggle('poor', available && !affordable)
  // Kein `disabled`: Ein gesperrter Knopf bekommt keine Zeigerereignisse mehr - und damit
  // faende ausgerechnet der Knoten keinen Hinweis, dessen Voraussetzung man sucht. Seit
  // Name und Beschreibung von der Kachel in den Hinweis gewandert sind, waere er dann
  // vollstaendig stumm. Der Klick greift trotzdem nicht: `buyNode` prueft selbst.
  card.setAttribute('aria-disabled', String(!available || !affordable))
  card.setAttribute(
    'aria-label',
    t('prestige.tipTitle', { area: t(area.label), node: node.label }),
  )

  if (rank > 0) {
    const step = document.createElement('b')
    step.className = 'lv'
    step.textContent = String(rank)
    card.appendChild(step)
  }

  const symbol = document.createElement('span')
  symbol.className = 'sym'
  symbol.innerHTML = icon(prestigeIcon(node.id, area.icon), 32)

  const mark = document.createElement('span')
  mark.className = 'mark'
  mark.innerHTML = icon(area.icon, 16)

  const cost = document.createElement('span')
  cost.className = 'cost'
  // Ein gekaufter Knoten kostet nichts mehr - an seiner Stelle steht der tuerkise Punkt aus
  // dem Stilblatt. Ein Preis, den man nicht mehr zahlen kann, waere nur noch Erinnerung.
  cost.textContent = bought ? '' : formatNumber(node.cost)

  const foot = document.createElement('span')
  foot.className = 'foot'
  foot.append(mark, cost)

  card.append(symbol, foot)

  card.addEventListener('click', () => {
    if (!buyPrestigeNode(state, node.id)) return
    onChange()
  })
  card.addEventListener('pointerenter', () => pointAt(card, describe(state, area, node)))
  card.addEventListener('pointerleave', () => hideTooltip())

  return card
}

/**
 * Der Hinweis haengt an der Kachel, nicht am Zeiger - sonst zittert er beim Bewegen.
 *
 * Freigehalten wird nicht die Kachel, sondern die **ganze Wand** - dieselbe Loesung wie bei
 * den Upgrades und aus demselben Grund: Eine Kachelwand hat keinen Platz zwischen ihren
 * Zeilen. Wer nur der Kachel oder ihrer Zeile ausweicht, legt den Hinweis ueber die Zeile
 * darunter, und ein Hinweis, der die naechsten Knoten verdeckt, verhindert genau den
 * Vergleich, fuer den man ihn aufschlaegt. Unter der Wand ist Platz, weil der Baum seit den
 * Kacheln nur noch drei Zeilen hoch ist.
 */
function pointAt(card: HTMLElement, content: string): void {
  const box = card.getBoundingClientRect()
  const wall = card.closest('.node-wall')?.getBoundingClientRect() ?? box

  showTooltip({ x: box.left + box.width / 2, y: wall.top }, content, {
    center: true,
    clear: { top: wall.top, bottom: wall.bottom },
  })
}

/** Was auf der Kachel keinen Platz hat: voller Name, Wirkung, und was noch fehlt. */
function describe(state: GameState, area: Area, node: PrestigeNode): string {
  const missing = node.requires
    .filter((id) => !isUnlocked(state, id))
    .map((id) => prestigeNodeById(id).label)

  const status = isUnlocked(state, node.id)
    ? t('prestige.bought')
    : missing.length > 0
      ? t('prestige.needs', { names: missing.join(', ') })
      : t('prestige.cost', { amount: formatNumber(node.cost) })

  return (
    `<b>${t('prestige.tipTitle', { area: t(area.label), node: node.label })}</b>` +
    `<br>${node.description}` +
    `<br>${status}`
  )
}
