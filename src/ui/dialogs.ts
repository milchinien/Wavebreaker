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
import { on } from '../core/events.ts'
import { LEAGUE_REWARD_BONUS, LEAGUE_WAVE_OFFSET, WAVE_SCALING } from '../data/balance.ts'
import { leagueByIndex } from '../data/leagues.ts'
import { t } from '../data/strings.ts'
import type { EventChoice, EventEffect } from '../data/events.ts'
import {
  isKnownPerk,
  perkById,
  perkInfoKey,
  type PerkDef,
  type PerkGlobal,
} from '../data/perks.ts'
import { towerById } from '../data/towers.ts'
import { traderStockById, type TraderStockDef } from '../data/trader.ts'
import { isKnownUpgrade, upgradeById } from '../data/upgrades.ts'
import { isKnownTrait, traitById } from '../data/traits.ts'
import type { Rarity } from '../data/types.ts'
import {
  buyFromTraderAt,
  chooseEventOption,
  closeTrader,
  dropOffer,
  goToLeague,
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
import { LEAGUE_TINT, PALETTE, RARITY_COLOR } from '../render/theme.ts'
import { choiceCard } from './cards.ts'
import { eventIcon, moduleTile, perkIcon, towerIcon, tradeIcon, type IconName } from './icons.ts'
import { createMotes } from './motes.ts'
import { setSlideLabel } from './slide.ts'
import { hideTooltip } from './tooltip.ts'
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
  cards.className = 'choice-grid perk-grid'
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
  towerCards.className = 'choice-grid tower-grid'
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
  eventCards.className = 'choice-grid event-grid'
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
  traderCards.className = 'choice-grid trade-grid'
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

  // --- Aufstieg in die naechste Liga (docs/liga-system.md Abschnitt 6.2) ---
  const leagueBackdrop = document.createElement('div')
  leagueBackdrop.className = 'levelup-backdrop'
  leagueBackdrop.hidden = true

  const leaguePanel = document.createElement('section')
  leaguePanel.className = 'panel levelup-panel league-panel'
  const leagueTitle = document.createElement('h2')
  const leagueName = document.createElement('p')
  leagueName.className = 'league-panel-name'
  const leagueText = document.createElement('p')
  leagueText.className = 'muted'
  const leagueButtons = document.createElement('div')
  leagueButtons.className = 'league-panel-buttons'

  const leagueEnter = document.createElement('button')
  leagueEnter.type = 'button'
  leagueEnter.className = 'chip active'
  setSlideLabel(leagueEnter, t('league.enter'))
  leagueEnter.addEventListener('click', () => answerLeague(true))

  const leagueStay = document.createElement('button')
  leagueStay.type = 'button'
  leagueStay.className = 'chip'
  setSlideLabel(leagueStay, t('league.stay'))
  leagueStay.addEventListener('click', () => answerLeague(false))

  leagueButtons.append(leagueEnter, leagueStay)
  leaguePanel.append(leagueTitle, leagueName, leagueText, leagueButtons)
  leagueBackdrop.appendChild(leaguePanel)
  overlay.appendChild(leagueBackdrop)

  /**
   * Um wie viel eine Liga die Gegner anhebt - einmal gerechnet, nicht je Bild.
   *
   * Aus den Balancewerten und nicht als Zahl im Text: Wer am Versatz dreht, soll den Satz
   * nicht nachziehen muessen. Ein Fenster, das eine veraltete Zahl behauptet, ist schlimmer
   * als eines ohne Zahl.
   */
  const leaguePower = Math.pow(WAVE_SCALING, LEAGUE_WAVE_OFFSET).toFixed(1)

  /** Die Liga, deren Freischaltung noch anzusagen ist - oder `null`. */
  let pendingLeague: number | null = null
  let shownLeague: number | null = null
  const stopLeagueUnlock = on('league.unlocked', ({ league }) => {
    pendingLeague = league
  })

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
  const leagueWriter = createTypewriter()

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
      // Gesperrt wird ueber eine Klasse und nicht ueber `disabled`. Ein gesperrter Knopf
      // bekommt keine Zeigerereignisse mehr - die Karte wuerde sich dann weder neigen noch
      // umdrehen, und genau das braucht man bei einem Posten, den man sich noch nicht
      // leisten kann: nachsehen, was das ueberhaupt ist. Der Kauf selbst prueft ohnehin
      // (`buyFromTraderAt`), ein Klick geht also ins Leere statt daneben.
      row.card.setAttribute('aria-disabled', String(!affordable || offer.sold))
      row.card.classList.toggle('locked', !affordable && !offer.sold)
      row.card.classList.toggle('spent', offer.sold)
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

  /**
   * Das Aufstiegsfenster (docs/liga-system.md Abschnitt 6.2).
   *
   * Es haengt am **Ereignis** und nicht an einem gespeicherten Zustand: Die Freischaltung
   * ist eine Nachricht, und eine Nachricht meldet man, wenn sie eintrifft. Beim naechsten
   * Laden ist sie keine mehr - die Liga steht dann in der Ligazeile und wartet dort, so
   * lange der Spieler will.
   *
   * **Es haelt nichts an.** Beide Antworten schalten die Liga frei; der Knopf entscheidet
   * nur, ob jetzt gewechselt wird. Deshalb ist auch keine der beiden die "richtige" - wer
   * bleibt, verliert nichts (GDD 02 Abschnitt 6).
   */
  function updateLeague(): void {
    const target = pendingLeague
    leagueBackdrop.hidden = target === null
    if (target === null || target === shownLeague) return
    shownLeague = target

    const def = leagueByIndex(target)
    leaguePanel.style.setProperty('--league-tint', LEAGUE_TINT[def.tint])
    leagueWriter.write(
      { node: leagueTitle, text: t('league.title') },
      { node: leagueName, text: t(def.id) },
      {
        node: leagueText,
        text: t('league.hint', {
          power: leaguePower,
          reward: LEAGUE_REWARD_BONUS.toFixed(1),
        }),
      },
    )
  }

  function answerLeague(enter: boolean): void {
    const target = pendingLeague
    pendingLeague = null
    shownLeague = null
    leagueBackdrop.hidden = true
    leagueWriter.reset()
    if (enter && target !== null) goToLeague(state, target)
    onChange()
  }

  function update(): void {
    updateTowerOffer()
    updateEvent()
    updateTrader()
    updateReturn()
    updateLeague()

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
      stopLeagueUnlock()
      for (const writer of [
        levelWriter,
        offerWriter,
        eventWriter,
        traderWriter,
        returnWriter,
        leagueWriter,
      ]) {
        writer.reset()
      }
      backdrop.remove()
      towerBackdrop.remove()
      eventBackdrop.remove()
      traderBackdrop.remove()
      returnBackdrop.remove()
      leagueBackdrop.remove()
    },
  }
}

/**
 * Ein Posten im Sortiment der Drohne.
 *
 * Er sieht aus wie eine Turmkarte und traegt dieselbe Raritaetsfarbe - denn er ist
 * dasselbe: etwas, das man sich ansieht und dann nimmt. Der Unterschied steht vorn unter
 * dem Rang, wo bei der Turmkarte nichts steht: **der Preis**. Hier wird gekauft, nicht
 * gewaehlt, und drei Preise nebeneinander muss man vergleichen koennen, ohne jede Karte
 * einzeln umzudrehen.
 *
 * Der Preis kommt deshalb als fertiger Knoten in die Karte und bleibt hier: Er wird zu
 * "Gekauft", sobald der Posten weg ist, und die Karte darf dafuer nicht neu entstehen.
 */
function traderCard(
  state: GameState,
  offer: TraderOffer,
  index: number,
  onChange: () => void,
): { index: number; card: HTMLButtonElement; price: HTMLElement } {
  const def = traderStockById(offer.defId)

  const text = document.createElement('span')
  text.className = 'choice-text'
  /*
   * Perk- und Upgrade-Ware nennen ihren Inhalt **beim Namen**.
   *
   * Was auf der Karte steht, muss man bekommen - "eine Verbesserung" waere eine Behauptung.
   * Bei den Upgrades ist das seit E7 moeglich: Vorher wuerfelte erst der Kauf, welcher Pfad
   * gemeint war, und die Karte konnte gar nichts versprechen.
   */
  if (offer.perkId && isKnownPerk(offer.perkId)) {
    text.textContent = t('trader.perk', { name: perkById(offer.perkId).label })
  } else if (offer.upgradeId && isKnownUpgrade(offer.upgradeId)) {
    text.textContent = t('trader.upgrade', {
      levels: effectLevels(def),
      name: upgradeById(offer.upgradeId).name,
    })
  } else {
    text.textContent = def.description
  }

  const price = document.createElement('span')
  price.className = 'trade-price'

  const card = choiceCard({
    tone: RARITY_COLOR[def.rarity],
    rarity: def.rarity,
    front: {
      tile: moduleTile(tradeIcon(def.effect.kind), def.rarity, 18),
      name: def.label,
      rank: t(rarityKey(def.rarity)),
      note: price,
    },
    back: [text],
    action: t('trader.buy'),
    onPick() {
      if (!buyFromTraderAt(state, index)) return
      onChange()
    },
  })

  return { index, card, price }
}

/** Wie viele Stufen eine Upgrade-Ware verschenkt. Andere Waren zaehlen als eine. */
function effectLevels(def: TraderStockDef): number {
  return def.effect.kind === 'upgrade' ? def.effect.levels : 1
}

/**
 * Eine Option eines Ereignisses (GDD 11 Abschnitt 3).
 *
 * Sie traegt ihre Folge im Klartext: "Gegner werden staerker", "ein besonderer Gegner
 * erscheint". Ein Ereignis, dessen Optionen sich nur in der Belohnung unterscheiden, waere
 * keine Entscheidung - deshalb steht die Folge auf der Rueckseite, und was fuer eine Art
 * von Folge es ist, schon vorn.
 *
 * Denn eine Ereignisoption hat keine Seltenheit, und der Platz, an dem bei den anderen
 * Karten der Rang steht, waere sonst leer. Dort steht deshalb ihre **Art** - Auszahlung,
 * Verstaerkung, Risiko, Hinterhalt - in der Farbe, die im ganzen Spiel dafuer steht: Gold
 * fuer Gold, Tuerkis fuer einen Bonus, Magenta fuer Gefahr, Violett fuer den Boss. Der
 * Spieler sieht damit die sichere und die riskante Karte auseinander, bevor er liest.
 */
function eventCard(state: GameState, choice: EventChoice, onChange: () => void): HTMLElement {
  const kind = heaviestEffect(choice)

  const text = document.createElement('span')
  text.className = 'choice-text'
  text.textContent = choice.detail

  return choiceCard({
    tone: EVENT_TONE[kind],
    front: {
      tile: moduleTile(eventIcon(kind), null, 18, EVENT_TONE[kind]),
      name: choice.label,
      rank: t(eventKindKey(kind)),
    },
    back: [text],
    action: t('event.choose'),
    onPick() {
      if (!chooseEventOption(state, choice.id)) return
      onChange()
    },
  })
}

/**
 * Wie schwer eine Wirkung wiegt - je groesser, desto schwerer.
 *
 * Eine Option kann mehrere Wirkungen haben, und die Karte zeigt nur **eine** Farbe. Sie
 * zeigt die schwerste: Wer Gold bekommt und dabei einen Titanen ruft, waehlt einen
 * Hinterhalt und keine Auszahlung. Faerbte die erste Wirkung die Karte, waere die Farbe
 * eine Falle statt einer Auskunft.
 */
const EVENT_WEIGHT: Record<EventEffect['kind'], number> = {
  reward: 0,
  boon: 1,
  hazard: 2,
  spawn: 3,
}

/** Die Leitfarbe je Wirkungsart - dieselbe Sprache wie ueberall (GDD 13 Abschnitt 7). */
const EVENT_TONE: Record<EventEffect['kind'], string> = {
  reward: PALETTE.gold,
  boon: PALETTE.teal,
  hazard: PALETTE.magenta,
  spawn: PALETTE.violet,
}

function heaviestEffect(choice: EventChoice): EventEffect['kind'] {
  let worst: EventEffect['kind'] = 'reward'
  for (const effect of choice.effects) {
    if (EVENT_WEIGHT[effect.kind] > EVENT_WEIGHT[worst]) worst = effect.kind
  }
  return worst
}

function eventKindKey(
  kind: EventEffect['kind'],
): 'event.kind.reward' | 'event.kind.boon' | 'event.kind.hazard' | 'event.kind.spawn' {
  return `event.kind.${kind}` as const
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
 *
 * Das teilt sich auf die beiden Seiten (`ui/cards.ts`) nach einer einfachen Frage: **Was
 * unterscheidet die drei ausliegenden Karten voneinander?** Art und Seltenheit tun das und
 * stehen vorn; die Beschreibung der Turmart und ihre gewuerfelten Eigenschaften sind die
 * Begruendung und stehen hinten. Wer den Turm kennt, waehlt ihn nach dem Rahmen.
 */
function offerCard(
  offer: TowerOffer,
  index: number,
  onChange: () => void,
  state: GameState,
): HTMLElement {
  const def = towerById(offer.defId)

  const text = document.createElement('span')
  text.className = 'choice-text'
  text.textContent = def.description

  const traits = document.createElement('ul')
  traits.className = 'choice-traits'
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

  return choiceCard({
    tone: RARITY_COLOR[offer.rarity],
    rarity: offer.rarity,
    front: {
      tile: moduleTile(towerIcon(offer.defId, 'tower'), offer.rarity, 18),
      name: def.name,
      rank: t(rarityKey(offer.rarity)),
    },
    back: [text, traits],
    action: t('offer.take'),
    onPick() {
      if (!takeOffer(state, index)) return
      onChange()
    },
  })
}

function rarityKey(
  rarity: Rarity,
): 'rarity.common' | 'rarity.rare' | 'rarity.epic' | 'rarity.legendary' | 'rarity.mythic' {
  return `rarity.${rarity}` as const
}

/**
 * Eine Perk-Karte.
 *
 * Der Rahmen traegt die Farbe der Seltenheit - dieselbe Sprache wie bei Tuermen im Lager
 * und auf der Bauflaeche (GDD 13 Abschnitt 7). Ein legendaerer Perk ist damit schon zu
 * erkennen, bevor man seinen Text gelesen hat.
 *
 * Vorn steht nur der Betrag. Die Karte ist eine Handbreit gross und steht neben zwei
 * gleichrangigen - ein Absatz Fliesstext darauf machte aus der Auswahl eine Leseaufgabe.
 * Was der Wert **tut**, steht auf der Rueckseite (`perkDetail`), und die kommt beim
 * Beruehren.
 *
 * Frueher lag dieselbe Auskunft in einem Hinweisfenster, das erst nach drei Sekunden
 * Stehenbleiben aufging. Sie steht jetzt an der Stelle, an der man ohnehin hinsieht - und
 * kostet keine drei Sekunden mehr.
 */
function card(state: GameState, perk: PerkDef, onChange: () => void): HTMLElement {
  // Wie oft man diesen Perk schon hat. Bei einem Angebot, das sich wiederholen darf, ist
  // das die Auskunft, die den Unterschied zwischen "neu" und "noch mehr davon" macht - und
  // sie gehoert nach vorn, weil sie die drei ausliegenden Karten unterscheidet.
  const owned = perkCount(state, perk.id)

  return choiceCard({
    tone: RARITY_COLOR[perk.rarity],
    rarity: perk.rarity,
    front: {
      tile: moduleTile(perkTile(perk), perk.rarity, 18),
      name: perk.label,
      rank: t(rarityKey(perk.rarity)),
      note: owned > 0 ? t('levelup.taken', { count: owned }) : undefined,
    },
    back: perkDetail(state, perk),
    action: t('levelup.take'),
    onPick() {
      if (!takePerk(state, perk.id)) return
      onChange()
    },
  })
}

/** Worauf der Perk wirkt, als Zeichen - dasselbe wie an der Wertzeile im Moduldetail. */
function perkTile(perk: PerkDef): IconName {
  const effect = perk.effect
  if (effect.kind === 'percent' || effect.kind === 'flat') return perkIcon('stat', effect.stat)
  if (effect.kind === 'global') return perkIcon('global', effect.key)
  // Seit E7 kann ein Perk grundsaetzlich jede Wirkung des Katalogs tragen; die heutige Liste
  // nutzt nur zwei davon. Ein fehlendes Bild darf trotzdem nie eine leere Karte ergeben.
  return perkIcon('global', 'xpBonus')
}

/**
 * Die Rueckseite einer Perk-Karte.
 *
 * Sie beantwortet drei Fragen, und zwar in dieser Reihenfolge, weil das die Reihenfolge
 * ist, in der man sie stellt:
 *
 *   1. **Was tut das ueberhaupt?** Ein Satz zur Wirkung, aus `data/strings.ts` ueber den
 *      Effekt des Perks - nicht ueber seine Kennung (siehe `perkInfoKey`).
 *   2. **Wo stehe ich?** Der Betrag, den man aus dieser Richtung bereits hat.
 *   3. **Wo staende ich danach?** Derselbe Wert plus diese Karte.
 *
 * Punkt 2 und 3 sind der eigentliche Grund fuer die Rueckseite. "Damage +8%" sagt nichts
 * darueber, ob das viel ist - neben einem bereits stehenden "+120%" ist es wenig, als
 * erster Schadensperk ist es der Anfang von allem. Perks sind additiv (GDD 03 Abschnitt 9),
 * also laesst sich das ausrechnen und muss nicht geschaetzt werden.
 */
function perkDetail(state: GameState, perk: PerkDef): HTMLElement[] {
  const effect = perk.effect
  // Der Stand aus derselben Richtung - je nachdem, ob der Perk einen Kampfwert oder eine
  // Groesse des Runs hebt.
  let now = 0
  if (effect.kind === 'percent' || effect.kind === 'flat') now = perkStatBonus(state, effect.stat)
  else if (effect.kind === 'global') now = perkGlobalBonus(state, effect.key as PerkGlobal)
  const step = effect.kind === 'rule' || effect.kind === 'window' ? 0 : effect.amount
  const after = now + step

  const text = document.createElement('p')
  text.className = 'choice-text'
  text.textContent = t(perkInfoKey(effect))

  const rows = document.createElement('dl')
  rows.className = 'choice-rows'
  row(rows, t('perk.info.now'), formatPercent(now, { sign: true }), false)
  row(rows, t('perk.info.after'), formatPercent(after, { sign: true }), true)

  return [text, rows]
}

/** Eine Zeile der Rueckseite: Frage links, Zahl rechts. `up` faerbt den besseren Wert. */
function row(list: HTMLElement, label: string, value: string, up: boolean): void {
  const term = document.createElement('dt')
  term.textContent = label
  const data = document.createElement('dd')
  if (up) data.className = 'up'
  data.textContent = value
  list.append(term, data)
}

