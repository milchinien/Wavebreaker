/**
 * Fenster, die den Spieler um eine Entscheidung bitten (GDD 13 Abschnitt 6).
 *
 * Vier: die Perk-Auswahl beim Levelaufstieg, die Turmauswahl beim Kauf oder nach einem
 * Schmelzgang, das Ereignis (GDD 11 Abschnitt 3) und der Bericht ueber die Abwesenheit
 * (GDD 12 Abschnitt 5).
 *
 * Die ersten drei folgen derselben Form - grosse Karten, eine Entscheidung, kein Zurueck -,
 * weil sie dasselbe Ereignis sind: Der Spieler bekommt etwas und waehlt, was davon. Der
 * Bericht ist die Ausnahme; er verlangt keine Wahl, sondern nur Kenntnisnahme, und ist
 * deshalb eine Liste mit einem Knopf.
 *
 * Zwei Entscheidungen praegen dieses Fenster:
 *
 * **Die Simulation laeuft weiter.** Die Welle schreitet fort, Gegner laufen an, Gold faellt.
 * Das Spiel ist ein Idle-Spiel; ein Fenster, das die Uhr anhaelt, waere ein Fremdkoerper.
 * Was ruht, ist allein die Bedienung des Feldes: Der Schleier faengt Klicks ab, bis die
 * Karte gewaehlt ist. Die Entscheidung kostet einen Klick, nicht Aufmerksamkeit.
 *
 * **Es ist in jedem Bereich sichtbar.** Ein Aufstieg ist Fortschritt des Spielers, kein
 * Vorgang der Kampfansicht. Wer beim Bauen aufsteigt, soll seine Karten dort bekommen und
 * nicht erst beim Zurueckwechseln.
 */

import { formatDuration, formatNumber, formatPercent } from '../core/format.ts'
import { t } from '../data/strings.ts'
import type { EventChoice } from '../data/events.ts'
import { isKnownPerk, perkById, perkInfoKey, type PerkDef } from '../data/perks.ts'
import { towerById } from '../data/towers.ts'
import { traderStockById } from '../data/trader.ts'
import { isKnownTrait, traitById } from '../data/traits.ts'
import type { Rarity } from '../data/types.ts'
import {
  buyFromTraderAt,
  chooseEventOption,
  closeTrader,
  dropOffer,
  takeOffer,
  takePerk,
} from '../app/actions.ts'
import type { GameState, TowerOffer, TraderOffer } from '../app/state.ts'
import { currentEvent, dismissEvent } from '../sim/events.ts'
import { canAfford } from '../sim/trader.ts'
import {
  currentOffer,
  pendingLevelUps,
  perkCount,
  perkGlobalBonus,
  perkStatBonus,
} from '../sim/progression.ts'
import { RARITY_COLOR } from '../render/theme.ts'
import { moduleTile, towerIcon } from './icons.ts'
import { createMotes } from './motes.ts'
import { setSlideLabel } from './slide.ts'
import { hideTooltip, showTooltip } from './tooltip.ts'
import { createTypewriter } from './typewriter.ts'

export type Dialogs = {
  /** Pro Bild aufrufen - baut nur neu, wenn sich das Angebot geaendert hat. */
  update(): void
  detach(): void
}

export function mountDialogs(
  state: GameState,
  overlay: HTMLElement,
  onChange: () => void,
): Dialogs {
  const backdrop = document.createElement('div')
  backdrop.className = 'levelup-backdrop'
  backdrop.hidden = true

  const panel = document.createElement('section')
  panel.className = 'panel levelup-panel'

  const title = document.createElement('h2')
  const hint = document.createElement('p')
  hint.className = 'muted'
  const cards = document.createElement('div')
  cards.className = 'perk-grid'
  const more = document.createElement('p')
  more.className = 'levelup-more'

  // Die Funken liegen **vor** dem Fenster in der Baumreihenfolge und damit dahinter im
  // Bild (`ui/motes.ts`). Nur der Aufstieg bekommt sie: Er ist der eine Augenblick, in dem
  // der Spieler etwas gewinnt - beim Haendler oder beim Bericht waeren sie Zierrat.
  const motes = createMotes()

  panel.append(title, hint, cards, more)
  backdrop.append(motes.node, panel)
  overlay.appendChild(backdrop)

  // --- Turmauswahl (GDD 06 Abschnitt 1) ---
  const towerBackdrop = document.createElement('div')
  towerBackdrop.className = 'levelup-backdrop'
  towerBackdrop.hidden = true

  const towerPanel = document.createElement('section')
  towerPanel.className = 'panel levelup-panel offer-panel'
  const towerTitle = document.createElement('h2')
  /* [REKONSTRUIERT] Die Erzeugung dieses Knotens fehlte, obwohl er weiter unten
     beschriftet wird (`offer.hint`). Aufbau nach dem gleichlaufenden Hinweis im
     Stufenaufstieg-Fenster weiter oben: ein `p` mit der Klasse `muted`. */
  const towerHint = document.createElement('p')
  towerHint.className = 'muted'
  const towerCards = document.createElement('div')
  towerCards.className = 'offer-grid'
  const discard = document.createElement('button')
  discard.type = 'button'
  discard.className = 'chip'
  setSlideLabel(discard, t('offer.discard'))
  discard.addEventListener('click', () => {
    dropOffer(state)
    onChange()
  })

  towerPanel.append(towerTitle, towerHint, towerCards, discard)
  towerBackdrop.appendChild(towerPanel)
  overlay.appendChild(towerBackdrop)

  // --- Ereignis (GDD 11 Abschnitt 3) ---
  const eventBackdrop = document.createElement('div')
  eventBackdrop.className = 'levelup-backdrop'
  eventBackdrop.hidden = true

  const eventPanel = document.createElement('section')
  eventPanel.className = 'panel levelup-panel event-panel'
  const eventTitle = document.createElement('h2')
  const eventText = document.createElement('p')
  eventText.className = 'muted'
  const eventCards = document.createElement('div')
  eventCards.className = 'offer-grid'
  const eventSkip = document.createElement('button')
  eventSkip.type = 'button'
  eventSkip.className = 'chip'
  setSlideLabel(eventSkip, t('event.dismiss'))
  eventSkip.addEventListener('click', () => {
    dismissEvent(state)
    onChange()
  })

  eventPanel.append(eventTitle, eventText, eventCards, eventSkip)
  eventBackdrop.appendChild(eventPanel)
  overlay.appendChild(eventBackdrop)

  // --- Haendler-Drohne (GDD 11 Abschnitt 7) ---
  const traderBackdrop = document.createElement('div')
  traderBackdrop.className = 'levelup-backdrop'
  traderBackdrop.hidden = true

  const traderPanel = document.createElement('section')
  traderPanel.className = 'panel levelup-panel trader-panel'
  const traderTitle = document.createElement('h2')
  const traderText = document.createElement('p')
  traderText.className = 'muted'
  const traderCards = document.createElement('div')
  traderCards.className = 'offer-grid'
  const traderLeave = document.createElement('button')
  traderLeave.type = 'button'
  traderLeave.className = 'chip'
  setSlideLabel(traderLeave, t('trader.leave'))
  traderLeave.addEventListener('click', () => {
    closeTrader(state)
    onChange()
  })

  traderPanel.append(traderTitle, traderText, traderCards, traderLeave)
  traderBackdrop.appendChild(traderPanel)
  overlay.appendChild(traderBackdrop)

  // --- Rueckkehr-Zusammenfassung (GDD 12 Abschnitt 5) ---
  const returnBackdrop = document.createElement('div')
  returnBackdrop.className = 'levelup-backdrop'
  returnBackdrop.hidden = true

  const returnPanel = document.createElement('section')
  returnPanel.className = 'panel levelup-panel return-panel'
  const returnTitle = document.createElement('h2')
  const returnList = document.createElement('dl')
  returnList.className = 'return-list'
  const returnClose = document.createElement('button')
  returnClose.type = 'button'
  returnClose.className = 'chip active'
  setSlideLabel(returnClose, t('offline.close'))
  returnClose.addEventListener('click', () => {
    state.runtime.returnSummary = null
    onChange()
  })

  returnPanel.append(returnTitle, returnList, returnClose)
  returnBackdrop.appendChild(returnPanel)
  overlay.appendChild(returnBackdrop)

  /*
   * Die Anrede jedes Fensters schreibt sich (`ui/typewriter.ts`).
   *
   * Ein Fenster faehrt auf, und in dem Augenblick steht alles fertig da: Ueberschrift, Satz,
   * drei Karten. Der Blick geht sofort auf die Karten - dort wird geklickt -, und der Satz
   * darueber, der sagt, **warum** man gerade waehlt, wird ueberlesen. Der Anschlag dreht das
   * um: Er nimmt den Blick fuer eine knappe Sekunde nach oben, bevor unten etwas zu holen
   * ist. Beim Ereignis ist das der ganze Sinn der Sache - seine Beschreibung ist die einzige
   * Erzaehlung des Spiels und stuende sonst als Kleingedrucktes ueber den Optionen.
   *
   * **Die Karten selbst tippen nicht.** Drei Karten, die gleichzeitig losschreiben, sind
   * kein Anschlag mehr, sondern Flimmern - und man liest sie nicht der Reihe nach, sondern
   * vergleicht sie. Sie fahren auf wie bisher.
   *
   * Je Fenster ein eigener Anschlag: Zwei Fenster koennen uebereinanderliegen (das Ereignis
   * wartet unter dem Aufstieg), und ein gemeinsamer Anschlag schriebe dann in beiden.
   */
  const levelWriter = createTypewriter()
  const offerWriter = createTypewriter()
  const eventWriter = createTypewriter()
  const traderWriter = createTypewriter()
  const returnWriter = createTypewriter()

  /**
   * Woran erkannt wird, dass sich etwas geaendert hat.
   *
   * Die Karten duerfen nicht in jedem Bild neu entstehen - sonst setzt der Browser die
   * Auftrittsbewegung staendig neu an, und ein Klick traefe eine Schaltflaeche, die es im
   * naechsten Augenblick nicht mehr gibt.
   */
  let last = ''
  let lastOffer = ''
  let lastEvent = ''
  let lastSummary = false
  let lastTrader = ''
  /** Karten des Sortiments in ihrer Reihenfolge - fuer die Preisanzeige je Bild. */
  let traderRows: { index: number; card: HTMLButtonElement; price: HTMLElement }[] = []

  function updateTowerOffer(): void {
    const offer = state.run.towerOffer
    const signature = offer.map((entry) => `${entry.defId}:${entry.rarity}:${entry.traits.join('+')}`).join('|')
    if (signature === lastOffer) return
    lastOffer = signature

    towerBackdrop.hidden = offer.length === 0
    if (offer.length === 0) {
      towerCards.replaceChildren()
      offerWriter.reset()
      return
    }

    offerWriter.write(
      { node: towerTitle, text: t('offer.title') },
      { node: towerHint, text: t('offer.hint') },
    )
    towerCards.replaceChildren()
    offer.forEach((entry, index) => {
      towerCards.appendChild(offerCard(entry, index, onChange, state))
    })
  }

  /**
   * Das offene Ereignis.
   *
   * Es steht **vor** dem Levelaufstieg in der Reihenfolge, aber nicht ueber ihm: Beide
   * Schleier liegen uebereinander, und der zuletzt gezeichnete gewinnt. Der Aufstieg ist
   * der Fortschritt des Spielers und darf deshalb obenauf liegen; das Ereignis wartet.
   */
  function updateEvent(): void {
    const event = currentEvent(state)
    const signature = event?.id ?? ''
    if (signature === lastEvent) return
    lastEvent = signature

    eventBackdrop.hidden = event === null
    if (!event) {
      eventCards.replaceChildren()
      eventWriter.reset()
      return
    }

    // Erst der Name des Ereignisses, dann seine Beschreibung - ein Anschlag ueber zwei
    // Zeilen, nicht zwei Anschlaege nebeneinander.
    eventWriter.write(
      { node: eventTitle, text: event.title },
      { node: eventText, text: event.description },
    )
    eventCards.replaceChildren()
    for (const choice of event.choices) {
      eventCards.appendChild(eventCard(state, choice, onChange))
    }
  }

  /**
   * Das Sortiment der Haendler-Drohne.
   *
   * Es geht erst auf, wenn der Spieler sie **erreicht** hat - die Drohne landet in der
   * Arena, und dorthin muss man fahren (GDD 11 Abschnitt 7). Ein Fenster, das von selbst
   * aufginge, machte aus dem Weg dorthin eine Formalie.
   *
   * Anders als bei den anderen Fenstern werden die Karten nicht bei jeder Aenderung neu
   * gebaut: Wer einen Posten kauft, soll die anderen an ihrem Platz wiederfinden. Neu
   * gebaut wird nur bei einer **anderen** Drohne; Preis und Zustand schreibt `update`.
   */
  function updateTrader(): void {
    const trader = state.run.trader
    const open = trader !== null && trader.visited
    const signature = open ? trader.stock.map((offer) => offer.defId).join('|') : ''

    if (signature !== lastTrader) {
      lastTrader = signature
      traderBackdrop.hidden = !open
      traderRows = []
      traderCards.replaceChildren()

      if (!open) traderWriter.reset()

      if (trader && open) {
        traderWriter.write(
          { node: traderTitle, text: t('trader.title') },
          { node: traderText, text: t('trader.hint') },
        )
        trader.stock.forEach((offer, index) => {
          const row = traderCard(state, offer, index, onChange)
          traderRows.push(row)
          traderCards.appendChild(row.card)
        })
      }
    }

    if (!trader || !open) return

    // Gold aendert sich mit jedem eingesammelten Stapel - der Preis muss deshalb je Bild
    // nachziehen, ohne dass die Karte neu entsteht.
    for (const row of traderRows) {
      const offer = trader.stock[row.index]
      if (!offer) continue
      const affordable = canAfford(state, offer)
      row.card.disabled = !affordable
      row.card.classList.toggle('affordable', affordable)
      row.card.classList.toggle('sold', offer.sold)
      row.price.textContent = offer.sold
        ? t('trader.sold')
        : t('hud.costs', { amount: formatNumber(offer.price) })
    }
  }

  /** Der Bericht ueber die Abwesenheit. Er steht genau einmal, dann ist er weg. */
  function updateReturn(): void {
    const summary = state.runtime.returnSummary
    const shown = summary !== null
    if (shown === lastSummary) return
    lastSummary = shown

    returnBackdrop.hidden = !shown
    if (!summary) {
      returnList.replaceChildren()
      returnWriter.reset()
      return
    }

    returnWriter.write({ node: returnTitle, text: t('offline.title') })
    returnList.replaceChildren()
    entry(returnList, t('offline.time'), formatDuration(summary.seconds))
    entry(returnList, t('offline.counted'), formatDuration(summary.simulated))
    entry(
      returnList,
      t('hud.waveShort'),
      t('offline.waves', { from: summary.waveFrom, to: summary.waveTo }),
    )
    entry(returnList, t('offline.kills'), formatNumber(summary.kills))
    entry(returnList, t('offline.gold'), `+${formatNumber(summary.gold)}`)
    entry(returnList, t('offline.xp'), `+${formatNumber(summary.xp)}`)
    // Nur wenn wirklich etwas zu waehlen ist: Die Perks der offline gefallenen Aufstiege
    // waehlt der Spieler weiterhin selbst (GDD 12 Abschnitt 5), und darauf soll der
    // Bericht hinweisen - aber nicht mit einer Null danebenstehen.
    if (summary.levels > 0) {
      entry(returnList, t('offline.level'), t('offline.levels', { count: summary.levels }))
    }
  }

  function update(): void {
    updateTowerOffer()
    updateEvent()
    updateTrader()
    updateReturn()

    const pending = pendingLevelUps(state)
    const offer = pending > 0 ? currentOffer(state) : []
    const signature = `${pending}|${offer.map((perk) => perk.id).join(',')}`
    if (signature === last) return
    last = signature

    backdrop.hidden = pending === 0
    if (pending === 0) {
      cards.replaceChildren()
      motes.setTones([])
      levelWriter.reset()
      // Der Hinweis haengt an der Karte, nicht am Fenster - ohne diese Zeile stuende er
      // nach einem Klick weiter im Bild, waehrend seine Karte laengst weg ist.
      hideTooltip()
      return
    }

    // Die Funken nehmen die Farben der ausliegenden Karten an: Bei einem legendaeren
    // Angebot liegt Gold in der Luft, bevor man gelesen hat, was daraufsteht.
    motes.setTones(offer.map((perk) => RARITY_COLOR[perk.rarity]))
    hideTooltip()

    // Die erreichte Stufe ist die, fuer die gerade gewaehlt wird - also die naechste nach
    // der zuletzt abgeholten, nicht die hoechste erreichte. Sonst stuende bei drei offenen
    // Aufstiegen dreimal dieselbe Zahl.
    levelWriter.write(
      { node: title, text: t('levelup.title', { level: state.run.level + 1 }) },
      { node: hint, text: t('levelup.hint') },
    )
    more.textContent = pending > 1 ? t('levelup.more', { count: pending - 1 }) : ''

    cards.replaceChildren()
    for (const perk of offer) cards.appendChild(card(state, perk, onChange))
  }

  update()

  return {
    update,
    detach() {
      hideTooltip()
      for (const writer of [levelWriter, offerWriter, eventWriter, traderWriter, returnWriter]) {
        writer.reset()
      }
      backdrop.remove()
      towerBackdrop.remove()
      eventBackdrop.remove()
      traderBackdrop.remove()
      returnBackdrop.remove()
    },
  }
}

/**
 * Ein Posten im Sortiment der Drohne.
 *
 * Sie sieht aus wie eine Turmkarte und trägt dieselbe Raritätsfarbe - denn sie ist
 * dasselbe: etwas, das man sich ansieht und dann nimmt. Der Unterschied steht unten rechts,
 * wo bei der Turmkarte nichts steht: **der Preis**. Hier wird gekauft, nicht gewählt.
 */
function traderCard(
  state: GameState,
  offer: TraderOffer,
  index: number,
  onChange: () => void,
): { index: number; card: HTMLButtonElement; price: HTMLElement } {
  const def = traderStockById(offer.defId)

  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'offer-card trade-card'
  card.style.setProperty('--rarity', RARITY_COLOR[def.rarity])

  const head = document.createElement('span')
  head.className = 'offer-head'
  const name = document.createElement('b')
  name.textContent = def.label
  head.appendChild(name)

  const text = document.createElement('span')
  text.className = 'offer-text'
  // Perk-Ware nennt ihren Perk beim Namen: Was auf der Karte steht, muss man bekommen -
  // "eine Verbesserung" wäre eine Behauptung.
  text.textContent =
    offer.perkId && isKnownPerk(offer.perkId)
      ? t('trader.perk', { name: perkById(offer.perkId).label })
      : def.description

  const price = document.createElement('span')
  price.className = 'trade-price'

  card.append(head, text, price)
  card.addEventListener('click', () => {
    if (!buyFromTraderAt(state, index)) return
    onChange()
  })

  return { index, card, price }
}

/**
 * Eine Option eines Ereignisses (GDD 11 Abschnitt 3).
 *
 * Sie traegt ihre Folge im Klartext: "Gegner werden staerker", "ein besonderer Gegner
 * erscheint". Ein Ereignis, dessen Optionen sich nur in der Belohnung unterscheiden, waere
 * keine Entscheidung - deshalb steht die Folge gleich gross neben dem Namen und nicht als
 * Kleingedrucktes darunter.
 */
function eventCard(state: GameState, choice: EventChoice, onChange: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'offer-card'

  const head = document.createElement('span')
  head.className = 'offer-head'
  const name = document.createElement('b')
  name.textContent = choice.label
  head.appendChild(name)

  const text = document.createElement('span')
  text.className = 'offer-text'
  text.textContent = choice.detail

  button.append(head, text)
  button.addEventListener('click', () => {
    if (!chooseEventOption(state, choice.id)) return
    onChange()
  })

  return button
}

/** Eine Zeile im Abwesenheitsbericht: Beschriftung links, Zahl rechts. */
function entry(list: HTMLElement, label: string, value: string): void {
  const term = document.createElement('dt')
  term.textContent = label
  const data = document.createElement('dd')
  data.textContent = value
  list.append(term, data)
}

/**
 * Eine Turmkarte im Kaufangebot (GDD 13 Abschnitt 6: grosse Auswahlkarten).
 *
 * Sie zeigt alles, was den Turm ausmacht: Art, Raritaet und seine gewuerfelten
 * Eigenschaften. Der Spieler soll bewusst entscheiden - dafuer muss auf der Karte stehen,
 * was er bekommt, und nicht nur, welcher Turm es ist.
 */
function offerCard(
  offer: TowerOffer,
  index: number,
  onChange: () => void,
  state: GameState,
): HTMLElement {
  const def = towerById(offer.defId)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'offer-card'
  button.style.setProperty('--rarity', RARITY_COLOR[offer.rarity])

  const head = document.createElement('span')
  head.className = 'offer-head'
  head.innerHTML = `${moduleTile(towerIcon(offer.defId, 'tower'), offer.rarity)}<b>${def.name}</b>`

  const rarity = document.createElement('span')
  rarity.className = 'perk-rarity'
  rarity.textContent = t(rarityKey(offer.rarity))

  const text = document.createElement('span')
  text.className = 'offer-text'
  text.textContent = def.description

  const traits = document.createElement('ul')
  traits.className = 'offer-traits'
  const known = offer.traits.filter(isKnownTrait)
  if (known.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'muted'
    empty.textContent = t('offer.noTraits')
    traits.appendChild(empty)
  } else {
    for (const id of known) {
      const trait = traitById(id)
      const item = document.createElement('li')
      item.style.setProperty('--rarity', RARITY_COLOR[trait.tier])
      item.textContent = trait.label
      traits.appendChild(item)
    }
  }

  button.append(head, rarity, text, traits)
  button.addEventListener('click', () => {
    if (!takeOffer(state, index)) return
    onChange()
  })

  return button
}

function rarityKey(
  rarity: Rarity,
): 'rarity.common' | 'rarity.rare' | 'rarity.epic' | 'rarity.legendary' | 'rarity.mythic' {
  return `rarity.${rarity}` as const
}

/**
 * Wie lange der Zeiger auf einer Karte stehen muss, bis die ausfuehrliche Auskunft kommt.
 *
 * Drei Sekunden sind bewusst lang. Der Aufstieg haelt das Spiel nicht an - wer die Karten
 * schon kennt, faehrt ueber sie hinweg und will nicht bei jeder Bewegung ein Fenster
 * aufgehen sehen. Wer stehenbleibt, hat gefragt.
 *
 * Die Karte macht das Warten sichtbar: Derselbe Wert setzt die Fuellzeit des Streifens an
 * ihrem unteren Rand (`--probe`). Ohne ihn waeren drei Sekunden ununterscheidbar von
 * "hier passiert nichts", und die Auskunft fuende nie jemand.
 */
const INFO_DELAY_MS = 3000

/**
 * Eine Perk-Karte.
 *
 * Der Rahmen traegt die Farbe der Seltenheit - dieselbe Sprache wie bei Tuermen im Lager
 * und auf der Bauflaeche (GDD 13 Abschnitt 7). Ein legendaerer Perk ist damit schon zu
 * erkennen, bevor man seinen Text gelesen hat.
 *
 * Auf der Karte selbst steht weiterhin nur der Betrag. Sie ist eine Handbreit gross und
 * steht neben zwei gleichrangigen - ein Absatz Fliesstext darauf machte aus der Auswahl
 * eine Leseaufgabe. Was der Wert **tut**, kommt deshalb erst auf Nachfrage (`perkInfo`).
 */
function card(state: GameState, perk: PerkDef, onChange: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'perk-card'
  button.style.setProperty('--rarity', RARITY_COLOR[perk.rarity])
  button.style.setProperty('--probe', `${INFO_DELAY_MS}ms`)

  const name = document.createElement('span')
  name.className = 'perk-name'
  name.textContent = perk.label

  const rarity = document.createElement('span')
  rarity.className = 'perk-rarity'
  rarity.textContent = t(rarityKey(perk.rarity))

  button.append(name, rarity)

  // Wie oft man diesen Perk schon hat. Bei einem Angebot, das sich wiederholen darf, ist
  // das die Auskunft, die den Unterschied zwischen "neu" und "noch mehr davon" macht.
  const owned = perkCount(state, perk.id)
  if (owned > 0) {
    const taken = document.createElement('span')
    taken.className = 'perk-taken'
    taken.textContent = t('levelup.taken', { count: owned })
    button.appendChild(taken)
  }

  // --- Nachfrage durch Stehenbleiben ---
  let timer = 0

  function forget(): void {
    if (timer !== 0) {
      window.clearTimeout(timer)
      timer = 0
    }
    button.classList.remove('probing')
    hideTooltip()
  }

  button.addEventListener('pointerenter', (event) => {
    // Ein Finger schwebt nicht. Auf dem Tablet gaebe `pointerenter` beim Tippen sonst den
    // Startschuss fuer eine Auskunft, die im selben Augenblick mit der Karte verschwindet.
    if (event.pointerType === 'touch') return
    forget()
    button.classList.add('probing')
    timer = window.setTimeout(() => {
      timer = 0
      const box = button.getBoundingClientRect()
      showTooltip({ x: box.left + box.width / 2, y: box.bottom }, perkInfo(state, perk), {
        variant: 'perk-info',
        center: true,
        clear: { top: box.top, bottom: box.bottom },
      })
    }, INFO_DELAY_MS)
  })

  button.addEventListener('pointerleave', forget)
  // Die Karte verschwindet beim Klick, `pointerleave` kommt dann nicht mehr.
  button.addEventListener('click', () => {
    forget()
    if (!takePerk(state, perk.id)) return
    onChange()
  })

  return button
}

/**
 * Die ausfuehrliche Auskunft zu einer Perk-Karte.
 *
 * Sie beantwortet drei Fragen, und zwar in dieser Reihenfolge, weil das die Reihenfolge
 * ist, in der man sie stellt:
 *
 *   1. **Was tut das ueberhaupt?** Ein Satz zur Wirkung, aus `data/strings.ts` ueber den
 *      Effekt des Perks - nicht ueber seine Kennung (siehe `perkInfoKey`).
 *   2. **Wo stehe ich?** Der Betrag, den man aus dieser Richtung bereits hat.
 *   3. **Wo staende ich danach?** Derselbe Wert plus diese Karte.
 *
 * Punkt 2 und 3 sind der eigentliche Grund fuer das Fenster. "Damage +8%" sagt nichts
 * darueber, ob das viel ist - neben einem bereits stehenden "+120%" ist es wenig, als
 * erster Schadensperk ist es der Anfang von allem. Perks sind additiv (GDD 03 Abschnitt 9),
 * also laesst sich das ausrechnen und muss nicht geschaetzt werden.
 */
function perkInfo(state: GameState, perk: PerkDef): string {
  const effect = perk.effect
  const now =
    effect.kind === 'stat'
      ? perkStatBonus(state, effect.stat)
      : perkGlobalBonus(state, effect.global)
  const after = now + effect.amount
  const owned = perkCount(state, perk.id)

  const head = `<b class="tip-name" style="color: ${RARITY_COLOR[perk.rarity]}">${perk.label}</b>`
  const rarity = `<span class="tip-rarity">${t(rarityKey(perk.rarity))}</span>`
  const text = `<p class="tip-text">${t(perkInfoKey(effect))}</p>`
  const rows =
    `<dl class="tip-rows">` +
    `<dt>${t('perk.info.now')}</dt><dd>${formatPercent(now, { sign: true })}</dd>` +
    `<dt>${t('perk.info.after')}</dt><dd class="up">${formatPercent(after, { sign: true })}</dd>` +
    `</dl>`
  const foot = `<p class="tip-foot">${owned > 0 ? t('perk.info.stacks', { count: owned }) : t('perk.info.first')}</p>`

  return head + rarity + text + rows + foot
}

