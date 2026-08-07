/**
 * Basisansicht: Inventar und Moduldetails.
 *
 * Zwei Regeln aus GDD 13:
 *   Abschnitt 5 - das Inventar listet **jeden Turm einzeln**, nicht gestapelt. Zwei
 *     Autocannons unterschiedlicher Seltenheit sind zwei verschiedene Dinge.
 *   Abschnitt 9 - Werte werden als `Basis -> effektiv` gezeigt, mit der Quelle des
 *     Unterschieds. Ein Bonus ohne sichtbare Herkunft ist eine Behauptung.
 *
 * Diese Datei liest den Zustand und ruft `app/actions.ts` - sie aendert nie selbst etwas.
 */

import { formatNumber, formatPercent } from '../core/format.ts'
import { MELT_COST } from '../data/balance.ts'
import { towerById } from '../data/towers.ts'
import { isKnownTrait, traitById } from '../data/traits.ts'
import { STAT_KEYS, type Rarity, type StatKey } from '../data/types.ts'
import { t } from '../data/strings.ts'
import { buyTowerSlot, meltSelection, startBuild, towerPrice } from '../app/actions.ts'
import type { GameState } from '../app/state.ts'
import { stationView } from '../app/view.ts'
import { displayName } from '../sim/buffs.ts'
import { moduleStats } from '../sim/stats.ts'
import { usedSlots } from '../sim/station.ts'
import { RARITY_COLOR } from '../render/theme.ts'
import { moduleTile, towerIcon } from './icons.ts'
import { setSlideLabel, slideLabel } from './slide.ts'

export type BasePanels = { inventory: HTMLElement; detail: HTMLElement }

export function renderInventory(
  state: GameState,
  root: HTMLElement,
  melting: MeltSelection,
  onChange: () => void,
): void {
  const station = state.run.station
  root.replaceChildren()

  const header = document.createElement('header')
  header.innerHTML =
    `<h2>${t('base.inventory')}</h2>` +
    `<span class="slots">${t('base.slots', { used: usedSlots(station), total: station.slots })}</span>`
  root.appendChild(header)

  if (station.inventory.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'muted'
    empty.textContent = t('base.empty')
    root.appendChild(empty)
    return
  }

  const list = document.createElement('ul')
  list.className = 'inventory'

  // Jeder Turm als eigene Karte - bewusst nicht nach Art gestapelt (GDD 13 Abschnitt 5).
  for (const module of station.inventory) {
    const def = towerById(module.defId)
    const card = document.createElement('li')
    card.className = 'card'
    card.dataset['uid'] = module.uid
    if (state.runtime.buildUid === module.uid) card.classList.add('active')
    if (melting.chosen.has(module.uid)) card.classList.add('melting')
    card.style.setProperty('--rarity', RARITY_COLOR[module.rarity])

    // Rahmen in der Farbe der Seltenheit, darin das Zeichen der Turmart - dieselbe
    // Kombination, die auch auf dem Feld leuchtet (GDD 13 Abschnitt 7).
    card.innerHTML =
      moduleTile(towerIcon(module.defId, 'tower'), module.rarity) +
      `<span class="name">${def.name}</span>` +
      `<span class="rarity">${t(rarityKey(module.rarity))}</span>` +
      `<span class="shape">${traitLine(module.traits, def.sides)}</span>`

    card.addEventListener('click', () => {
      /*
       * Waehrend eines Schmelzgangs bedeutet ein Klick etwas anderes: Er waehlt aus,
       * statt zu bauen. Das ist der Grund, warum der Schmelzgang einen sichtbaren Zustand
       * hat - dieselbe Karte tut je nach Lage zwei verschiedene Dinge, und der Spieler muss
       * sehen, welche gerade gilt.
       */
      if (melting.active) {
        if (melting.chosen.has(module.uid)) melting.chosen.delete(module.uid)
        else if (melting.chosen.size < MELT_COST) melting.chosen.add(module.uid)
        onChange()
        return
      }

      // Nochmal auf dieselbe Karte klicken hebt den Bau-Modus auf.
      if (state.runtime.buildUid === module.uid) state.runtime.buildUid = null
      else startBuild(state, module.uid)
      onChange()
    })

    list.appendChild(card)
  }

  root.appendChild(list)

  const hint = document.createElement('p')
  hint.className = 'muted'
  hint.textContent = state.runtime.buildUid
    ? t('base.building', {
        name: towerById(
          station.inventory.find((m) => m.uid === state.runtime.buildUid)?.defId ?? '',
        ).name,
      })
    : t('base.placeHint')
  root.appendChild(hint)
}

/**
 * Verwaltung rechts unten (GDD 13 Abschnitt 5).
 *
 * Zwei Handlungen, und beide sind Entscheidungen ueber knappe Dinge:
 *
 *   **Kaufen** kostet Gold, und der Preis steigt nach jedem Kauf. Bezahlt wird der Wurf,
 *   nicht der Turm - deshalb steht der Preis auf dem Knopf und nicht auf der Karte.
 *
 *   **Schmelzen** kostet drei Tuerme und bringt einen Wurf umsonst. Es ist der **einzige**
 *   Weg, ueberzaehlige Tuerme loszuwerden: Es gibt keinen Verkauf gegen Gold
 *   (GDD 06 Abschnitt 4), sonst waere die Frage "welche drei gebe ich auf?" keine.
 */
export function renderShop(
  state: GameState,
  root: HTMLElement,
  melting: MeltSelection,
  onChange: () => void,
): void {
  root.replaceChildren()

  const header = document.createElement('header')
  header.innerHTML = `<h2>${t('shop.title')}</h2>`
  root.appendChild(header)

  const price = towerPrice(state)
  const affordable = state.run.gold >= price

  const buy = document.createElement('button')
  buy.type = 'button'
  buy.className = 'wide-button'
  // Nur die Beschriftung rollt, der Preis bleibt stehen: Eine Zahl, die unter dem Zeiger
  // wegfaehrt, liest sich wie eine Aenderung des Preises.
  const tag = document.createElement('b')
  tag.textContent = t('shop.price', { amount: formatNumber(price) })
  buy.replaceChildren(slideLabel(t('shop.buyTower')), tag)
  buy.disabled = !affordable || melting.active
  buy.addEventListener('click', () => {
    if (!buyTowerSlot(state)) return
    onChange()
  })
  root.appendChild(buy)

  if (!affordable && !melting.active) {
    const poor = document.createElement('p')
    poor.className = 'muted'
    poor.textContent = t('shop.tooPoor')
    root.appendChild(poor)
  }

  // --- Schmelzen ---
  const enough = state.run.station.inventory.length >= MELT_COST

  const melt = document.createElement('button')
  melt.type = 'button'
  melt.className = 'wide-button'
  setSlideLabel(
    melt,
    melting.active
      ? t('shop.melt', { count: melting.chosen.size, need: MELT_COST })
      : t('shop.meltShort'),
  )
  melt.disabled = !enough
  melt.addEventListener('click', () => {
    if (!melting.active) {
      melting.active = true
      melting.chosen.clear()
      onChange()
      return
    }
    // Erst wenn genau drei gewaehlt sind, schmilzt der Gang - vorher ist der Knopf die
    // laufende Zaehlung und sagt, wie viele noch fehlen.
    if (melting.chosen.size !== MELT_COST) return
    if (meltSelection(state, [...melting.chosen])) {
      melting.active = false
      melting.chosen.clear()
      onChange()
    }
  })
  root.appendChild(melt)

  if (melting.active) {
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'chip'
    setSlideLabel(cancel, t('shop.cancel'))
    cancel.addEventListener('click', () => {
      melting.active = false
      melting.chosen.clear()
      onChange()
    })
    root.appendChild(cancel)

    const hint = document.createElement('p')
    hint.className = 'muted'
    hint.textContent = t('shop.meltHint')
    root.appendChild(hint)
  }
}

/**
 * Was der Spieler gerade zum Schmelzen ausgewaehlt hat.
 *
 * Reiner Anzeigezustand - er gehoert weder in den Spielstand noch in `sim/`. Ein
 * abgebrochener Schmelzgang darf nichts hinterlassen.
 */
export type MeltSelection = { active: boolean; chosen: Set<string> }

export function createMeltSelection(): MeltSelection {
  return { active: false, chosen: new Set() }
}

export function renderModuleDetail(state: GameState, root: HTMLElement): void {
  root.replaceChildren()

  const uid = state.runtime.selectedUid
  const view = stationView(state)
  const module = uid ? view.modules.find((m) => m.uid === uid) : undefined

  if (!module) {
    const empty = document.createElement('p')
    empty.className = 'muted'
    empty.textContent = t('detail.none')
    root.appendChild(empty)
    return
  }

  const buffs = view.buffs.get(module.uid)
  const { base, final } = moduleStats(module, buffs, state)

  const header = document.createElement('header')
  const rarityLabel = module.rarity ? t(rarityKey(module.rarity)) : ''
  header.innerHTML =
    moduleTile(towerIcon(module.defId, module.kind), module.rarity) +
    `<h2>${displayName(module)}</h2>` +
    (rarityLabel
      ? `<span class="rarity" style="--rarity:${RARITY_COLOR[module.rarity as Rarity]}">${rarityLabel}</span>`
      : '')
  root.appendChild(header)

  const meta = document.createElement('p')
  meta.className = 'muted'
  meta.textContent = t('detail.neighbours', {
    count: buffs?.neighborCount ?? 0,
    max: module.sides,
  })
  root.appendChild(meta)

  const table = document.createElement('table')
  table.className = 'stats'
  for (const key of STAT_KEYS) {
    if (base[key] === 0 && final[key] === 0) continue
    const row = document.createElement('tr')
    const changed = Math.abs(final[key] - base[key]) > 1e-9
    const isCapped = buffs?.capped.includes(key) ?? false

    row.innerHTML =
      `<th>${t(statKey(key))}</th>` +
      `<td class="base">${formatStat(key, base[key])}</td>` +
      (changed
        ? `<td class="arrow">&rarr;</td><td class="final">${formatStat(key, final[key])}` +
          (isCapped ? ` <em>${t('detail.capped')}</em>` : '') +
          `</td>`
        : `<td class="arrow"></td><td class="final"></td>`)
    table.appendChild(row)
  }
  if (table.childElementCount > 0) root.appendChild(table)

  // Buff-Modul: wie viele Module erreicht es gerade? Das ist die Zahl, an der laut
  // GDD 03 Abschnitt 9 haengt, ob es sich ueberhaupt lohnt (b > 1/k).
  if (module.kind === 'tower' && towerById(module.defId).category === 'buff') {
    const boosted = buffs?.boosted ?? 0
    const note = document.createElement('p')
    note.className = boosted === 0 ? 'warn' : 'muted'
    note.textContent =
      boosted === 0 ? t('detail.boostingNone') : t('detail.boosting', { count: boosted })
    root.appendChild(note)
  }

  /*
   * Die Eigenschaften dieses Exemplars (GDD 06 Abschnitt 10).
   *
   * Sie stehen **vor** den Buffs, weil sie zum Turm gehoeren und nicht zu seiner Lage auf
   * der Bauflaeche: Ein Turm behaelt sie, wenn man ihn versetzt, ein Buff nicht.
   */
  const traits = module.traits.filter(isKnownTrait)
  if (traits.length > 0) {
    const heading = document.createElement('h3')
    heading.textContent = t('detail.traits')
    root.appendChild(heading)

    const list = document.createElement('ul')
    list.className = 'sources traits'
    for (const id of traits) {
      const trait = traitById(id)
      const item = document.createElement('li')
      item.style.setProperty('--rarity', RARITY_COLOR[trait.tier])
      item.textContent = trait.label
      list.appendChild(item)
    }
    root.appendChild(list)
  }

  // Herkunft der Boni - ohne sie ist ein Bonus nur eine Behauptung.
  if (buffs && buffs.sources.length > 0) {
    const heading = document.createElement('h3')
    heading.textContent = t('detail.sources')
    root.appendChild(heading)

    const list = document.createElement('ul')
    list.className = 'sources'
    for (const source of buffs.sources) {
      const item = document.createElement('li')
      item.textContent = `${source.fromName}: ${t(statKey(source.stat))} ${formatPercent(source.amount, { sign: true })}`
      list.appendChild(item)
    }
    root.appendChild(list)
  }

  if (module.kind === 'core') {
    const note = document.createElement('p')
    note.className = 'muted'
    note.textContent = t('detail.core')
    root.appendChild(note)
  }
}

/**
 * Die Zeile unter dem Namen im Lager.
 *
 * Sie zeigt die **Eigenschaften**, wenn es welche gibt, sonst die Kantenzahl. Was einen
 * Turm im Lager von einem anderen derselben Art unterscheidet, sind laut GDD 06 Abschnitt 4
 * ausschliesslich Raritaet und Eigenschaften - und die Raritaet steht schon daneben.
 */
function traitLine(traits: readonly string[], sides: number): string {
  const known = traits.filter(isKnownTrait)
  if (known.length === 0) return t('base.edges', { count: sides })
  return known.map((id) => traitById(id).label).join(' · ')
}

function formatStat(key: StatKey, value: number): string {
  return key === 'critChance' ? formatPercent(value) : formatNumber(value)
}

function statKey(key: StatKey): 'stat.damage' | 'stat.attackSpeed' | 'stat.range' | 'stat.critChance' | 'stat.projectileSpeed' {
  return `stat.${key}` as const
}

function rarityKey(
  rarity: Rarity,
): 'rarity.common' | 'rarity.rare' | 'rarity.epic' | 'rarity.legendary' | 'rarity.mythic' {
  return `rarity.${rarity}` as const
}
