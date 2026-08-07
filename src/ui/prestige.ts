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
 * Der wichtigste Teil ist nicht der Baum, sondern das **Bestaetigungsfenster**: Prestige
 * soll nie wie ein Verlust wirken (GDD 10 Abschnitt 1). Deshalb steht dort nebeneinander,
 * was es einbringt und was es kostet - einschliesslich des Hinweises auf Gold, das noch
 *   die Marke      derselbe Bereich noch einmal als Zeichen, klein auf jeder Kachel
 *   die Kette      Knoten, die aufeinander aufbauen, haengen sichtbar aneinander
 * Die Kette ist dabei keine Handarbeit, sondern aus `requires` gerechnet - der Baum zeichnet
import { formatNumber } from '../core/format.ts'
import { PRESTIGE_MIN_GOLD } from '../data/balance.ts'
import { nodesOfArea, prestigeNodeById, type PrestigeArea } from '../data/prestige.ts'
import { t } from '../data/strings.ts'
import { buyPrestigeNode, performPrestige } from '../app/actions.ts'
 *   verfuegbar  leuchtend - kaufbar, sobald die Punkte reichen
 *   gekauft     tuerkis   - dauerhaft
  canPrestige,
 * Der wichtigste Teil ist nicht der Baum, sondern das **Bestaetigungsfenster**: Prestige
 * soll nie wie ein Verlust wirken (GDD 10 Abschnitt 1). Deshalb steht dort nebeneinander,
 * was es einbringt und was es kostet - einschliesslich des Hinweises auf Gold, das noch
 * herumliegt und mit verfaellt (GDD 10 Abschnitt 3).
} from '../sim/prestige.ts'
import { setSlideLabel } from './slide.ts'
import { formatNumber } from '../core/format.ts'
import { PRESTIGE_MIN_GOLD } from '../data/balance.ts'
  /** Nach jeder Handlung aufrufen - baut neu, wenn sich Punkte oder Knoten geaendert haben. */
  update(): void
  prestigeNodeById,
  type PrestigeArea,
  type PrestigeNode,
 * Die Bereiche des Baums in ihrer Reihenfolge (GDD 10 Abschnitt 6).
import { t } from '../data/strings.ts'
 * Sie steht hier und nicht in `data/prestige.ts`, weil sie eine Frage der Darstellung ist:
 * Wirtschaft zuerst, weil sie der Einstieg ist; Eigenschaften zuletzt, weil sie das
 * teuerste Ende sind. Ein Bereich, der in dieser Liste fehlt, ist im Baum nicht zu sehen -
 * deshalb ist sie gegen den Datensatz abgesichert (siehe `selftest/suites/prestige.ts`).
  canPrestige,
const AREAS: readonly {
  id: PrestigeArea
  isUnlocked,
    | 'area.economy'
} from '../sim/prestige.ts'
import { PALETTE, RARITY_COLOR } from '../render/theme.ts'
import { icon, prestigeIcon, type IconName } from './icons.ts'
import { setSlideLabel } from './slide.ts'
import { hideTooltip, showTooltip } from './tooltip.ts'
    | 'area.traits'
export type PrestigePanel = {
  /** Nach jeder Handlung aufrufen - baut neu, wenn sich Punkte oder Knoten geaendert haben. */
  { id: 'towers', label: 'area.towers' },
  { id: 'speed', label: 'area.speed' },
  { id: 'rarity', label: 'area.rarity' },
  { id: 'tech', label: 'area.tech' },
  { id: 'helpers', label: 'area.helpers' },
  { id: 'traits', label: 'area.traits' },
    | 'area.economy'
    | 'area.towers'
/** Fuer den Selbsttest: welche Bereiche der Baum ueberhaupt zeigt. */
export const SHOWN_AREAS: readonly PrestigeArea[] = AREAS.map((area) => area.id)
    | 'area.tech'
export function mountPrestigePanel(
  root: HTMLElement,
  /** Leitfarbe des Bereichs - sie ersetzt den Sektionsbalken, der hier frueher stand. */
  onChange: () => void,
  /** Marke des Bereichs. Sie steht klein auf jeder seiner Kacheln. */
  icon: IconName
}
  function update(): void {
    const signature = [
 * Die Bereiche des Baums in ihrer Reihenfolge (GDD 10 Abschnitt 6).
      state.permanent.prestigeNodes.join(','),
 * Sie steht hier und nicht in `data/prestige.ts`, weil sie eine Frage der Darstellung ist:
 * Wirtschaft zuerst, weil sie der Einstieg ist; Eigenschaften zuletzt, weil sie das
 * teuerste Ende sind. Ein Bereich, der in dieser Liste fehlt, ist im Baum nicht zu sehen -
 * deshalb ist sie gegen den Datensatz abgesichert (siehe `selftest/suites/prestige.ts`).
    if (signature === last) return
 * Tuerkis fehlt mit Absicht: Es ist die Farbe von "gekauft" und darf keinem Bereich gehoeren,
 * sonst hiesse dieselbe Farbe an zwei Kacheln zweierlei.
    root.replaceChildren()
    root.appendChild(head(state))
  { id: 'economy', label: 'area.economy', accent: PALETTE.gold, icon: 'coin' },
  { id: 'towers', label: 'area.towers', accent: PALETTE.cyan, icon: 'base' },
  { id: 'speed', label: 'area.speed', accent: PALETTE.lime, icon: 'rate' },
  { id: 'rarity', label: 'area.rarity', accent: PALETTE.edge, icon: 'modules' },
  { id: 'tech', label: 'area.tech', accent: PALETTE.violet, icon: 'turret' },
  { id: 'helpers', label: 'area.helpers', accent: PALETTE.edge, icon: 'radius' },
  { id: 'traits', label: 'area.traits', accent: PALETTE.violet, icon: 'amplifier' },
]
      const grid = document.createElement('div')
/** Fuer den Selbsttest: welche Bereiche der Baum ueberhaupt zeigt. */
export const SHOWN_AREAS: readonly PrestigeArea[] = AREAS.map((area) => area.id)
        grid.appendChild(nodeCard(state, node.id, onChange))
export function mountPrestigePanel(
      root.appendChild(grid)
  state: GameState,
  onChange: () => void,
): PrestigePanel {
  let last = ''
  return { update }
  function update(): void {
    const signature = [
/** Punktestand und wie oft schon zurueckgesetzt wurde. */
function head(state: GameState): HTMLElement {
  const box = document.createElement('div')
      Math.floor(state.run.goldEarned),
      state.run.waveRecord,
  const points = document.createElement('div')
  points.className = 'prestige-points'
  points.innerHTML =
    `<span>${t('prestige.points')}</span>` +
    // Der Hinweis haengt an einer Kachel, die es gleich nicht mehr gibt - stehen bliebe er
    // ueber dem neuen Baum und zeigte den alten Preis.
  const count = document.createElement('span')
  count.className = 'muted'
    root.replaceChildren(head(state), reset(state, onChange), wall(state, onChange))
  }
  box.append(points, count)
  return box
  return { update }
}
/**
/** Punktestand und wie oft schon zurueckgesetzt wurde. */
function head(state: GameState): HTMLElement {
 * Bewusst zweistufig: Ein Klick zeigt, was passiert, der zweite tut es. Prestige ist die
 * einzige Handlung im Spiel, die Fortschritt vernichtet - sie darf nicht aus Versehen
 * geschehen.
  const points = document.createElement('div')
function reset(state: GameState, onChange: () => void): HTMLElement {
  const box = document.createElement('section')
    `<span>${t('prestige.points')}</span>` +
    `<b>${formatNumber(state.permanent.prestigePoints)}</b>`
  const ready = canPrestige(state)
  const count = document.createElement('span')
  count.className = 'muted'
  count.textContent = t('prestige.count', { count: state.permanent.prestigeCount })
  title.textContent = t('prestige.title')
  box.append(points, count)
  return box
  const line = document.createElement('p')
  line.className = ready ? 'prestige-earn' : 'muted'
  line.textContent = ready
    ? t('prestige.earn', { points: formatNumber(earned) })
    : t('prestige.locked', { amount: formatNumber(PRESTIGE_MIN_GOLD) })
 * Bewusst zweistufig: Ein Klick zeigt, was passiert, der zweite tut es. Prestige ist die
 * einzige Handlung im Spiel, die Fortschritt vernichtet - sie darf nicht aus Versehen
  if (ready) {
    // Der Hinweis auf liegendes Gold - "damit niemand versehentlich Ertrag verschenkt"
function reset(state: GameState, onChange: () => void): HTMLElement {
  const box = document.createElement('section')
  box.className = 'panel prestige-reset'
      const warn = document.createElement('p')
  const ready = canPrestige(state)
      warn.textContent = t('prestige.warnGold', { amount: formatNumber(Math.floor(lost)) })
      box.appendChild(warn)
  const title = document.createElement('h2')
  title.textContent = t('prestige.title')
    for (const key of ['prestige.resets', 'prestige.keeps'] as const) {
      const note = document.createElement('p')
  const line = document.createElement('p')
  line.className = ready ? 'prestige-earn' : 'muted'
      box.appendChild(note)
    ? t('prestige.earn', { points: formatNumber(earned) })
    : t('prestige.locked', { amount: formatNumber(PRESTIGE_MIN_GOLD) })
  box.appendChild(line)
  const button = document.createElement('button')
  button.type = 'button'
    // Der Hinweis auf liegendes Gold - "damit niemand versehentlich Ertrag verschenkt"
  setSlideLabel(button, t('prestige.confirm'))
    const lost = goldLostOnPrestige(state)
  button.addEventListener('click', () => {
    if (!button.classList.contains('armed')) {
      button.classList.add('armed')
      warn.textContent = t('prestige.warnGold', { amount: formatNumber(Math.floor(lost)) })
      box.appendChild(warn)
    if (performPrestige(state)) onChange()
  })
    for (const key of ['prestige.resets', 'prestige.keeps'] as const) {
      const note = document.createElement('p')
      note.className = 'muted small'
      note.textContent = t(key)
      box.appendChild(note)
function nodeCard(state: GameState, nodeId: string, onChange: () => void): HTMLElement {
  const node = prestigeNodeById(nodeId)
  const bought = isUnlocked(state, nodeId)
  const button = document.createElement('button')
  const affordable = state.permanent.prestigePoints >= node.cost
  button.className = 'wide-button danger'
  const button = document.createElement('button')
  button.disabled = !ready
  button.addEventListener('click', () => {
    if (!button.classList.contains('armed')) {
  button.classList.toggle('available', available)
  // Gesperrt heisst: Die Voraussetzung fehlt. Zu teuer ist etwas anderes - der Knoten bleibt
  // sichtbar leuchtend, nur der Klick greift nicht. Sonst waere nicht zu erkennen, worauf
    if (performPrestige(state)) onChange()
  button.disabled = bought || !available || !affordable
  box.appendChild(button)
  const name = document.createElement('span')
  name.className = 'node-name'
  name.textContent = node.label

  const text = document.createElement('span')
  text.className = 'node-text'
  text.textContent = node.description
 * Ein Bereich bleibt beim Umbruch zusammen, seine Ketten stehen darin nebeneinander. Die
 * groessere Luft zwischen den Bereichen ist damit die einzige Ueberschrift, die es hier noch
 * gibt - genau wie in der Kachelwand der Upgrades.
  cost.textContent = bought
function wall(state: GameState, onChange: () => void): HTMLElement {
  const box = document.createElement('div')
      ? formatNumber(node.cost)
      : t('prestige.blocked')
  for (const area of AREAS) {
    const group = document.createElement('div')
  button.addEventListener('click', () => {
    group.style.setProperty('--accent', area.accent)
    onChange()
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
 * Freigehalten wird die **Kachelreihe**, nicht die Kachel: In einer Wand liegt unter jeder
 * Kachel die naechste, und ein Hinweis, der sie verdeckt, verhindert genau den Vergleich,
 * fuer den man ihn aufschlaegt. Anders als bei den Upgrades weicht er nur der eigenen Zeile
 * aus und nicht dem ganzen Panel: Der Baum fuellt hier den halben Bildschirm, und ein
 * Hinweis, der bis an dessen Rand springt, stuende weit weg von dem, was er erklaert.
 */
function pointAt(card: HTMLElement, content: string): void {
  const box = card.getBoundingClientRect()
  const row = card.closest('.node-chain')?.getBoundingClientRect() ?? box

  showTooltip({ x: box.left + box.width / 2, y: row.top }, content, {
    center: true,
    clear: { top: row.top, bottom: row.bottom },
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

