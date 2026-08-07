/**
 * Faehigkeiten verwalten (GDD 09 Teil B, GDD 13 Abschnitt 6).
 *
 * Der Bereich sitzt im Upgrades-Menue, weil GDD 13 Abschnitt 6 dort ausdruecklich die
 * Bereiche "Hauptturm · Tuerme · Faehigkeiten · Helfer" vorsieht - und weil Freischalten
 * ein Kauf mit Gold ist, also dieselbe Handlung wie ein Upgrade.
 *
 * Eine Karte kann drei Zustaende haben, und der Knopf sagt genau, welcher gilt:
 *
 *   gesperrt   Preis - ein Klick schaltet frei
 *   belegt     "Equipped" - ein Klick nimmt sie vom Slot
 *   frei       "Equip" - ein Klick legt sie auf einen Slot
 *
 * Zuenden geht hier **nicht**. Das ist Sache der Kampfansicht (GDD 09 Abschnitt 7) - die
 * Basis bleibt Verwaltungsbereich, auch wenn der Kampf dort weiterlaeuft.
 */

import { formatNumber } from '../core/format.ts'
import { ABILITIES, type AbilityDef } from '../data/abilities.ts'
import { t } from '../data/strings.ts'
import { buyAbility, toggleAbilitySlot } from '../app/actions.ts'
import type { GameState } from '../app/state.ts'
import { isEquipped, isUnlocked, slotCount } from '../sim/abilities.ts'
import { abilityIcon, icon } from './icons.ts'

export type AbilityPanel = {
  /** Nach jeder Handlung aufrufen - baut neu, wenn sich Besitz oder Belegung geaendert hat. */
  update(): void
}

export function mountAbilityPanel(
  root: HTMLElement,
  state: GameState,
  onChange: () => void,
): AbilityPanel {
  let last = ''

  function update(): void {
    const equipped = state.run.equipped.join(',')
    const owned = state.run.abilities.join(',')
    const signature = `${owned}|${equipped}|${Math.floor(state.run.gold)}`
    if (signature === last) return
    last = signature

    root.replaceChildren()

    const bar = document.createElement('div')
    bar.className = 'section-bar'
    bar.textContent = t('upgrades.section', { name: t('abilities.title') })
    root.appendChild(bar)

    const slots = document.createElement('p')
    slots.className = 'ability-slots'
    slots.textContent = t('abilities.slots', {
      used: state.run.equipped.length,
      total: slotCount(state),
    })
    root.appendChild(slots)

    const grid = document.createElement('div')
    grid.className = 'ability-grid'

    for (const ability of ABILITIES) {
      grid.appendChild(card(state, ability, onChange))
    }

    root.appendChild(grid)
  }

  update()
  return { update }
}

function card(state: GameState, ability: AbilityDef, onChange: () => void): HTMLElement {
  const id = ability.id
  const unlocked = isUnlocked(state, id)
  const equipped = isEquipped(state, id)
  const affordable = state.run.gold >= ability.unlockCost

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ability-card'
  button.style.setProperty('--accent', ability.accent)
  button.classList.toggle('locked', !unlocked)
  button.classList.toggle('equipped', equipped)
  // Gesperrt und zu teuer: Der Knopf bleibt sichtbar, aber tot - der Preis ist die
  // Auskunft, die der Spieler braucht, nicht das Verschwinden der Karte.
  button.disabled = !unlocked && !affordable

  const head = document.createElement('span')
  head.className = 'ability-head'
  head.innerHTML = `${icon(abilityIcon(id), 20)}<b>${ability.name}</b>`

  const text = document.createElement('span')
  text.className = 'ability-text'
  text.textContent = ability.description

  const foot = document.createElement('span')
  foot.className = 'ability-foot'
  foot.textContent = unlocked
    ? equipped
      ? t('abilities.equipped')
      : t('abilities.equip')
    : t('hud.costs', { amount: formatNumber(ability.unlockCost) })

  button.append(head, text, foot)
  button.addEventListener('click', () => {
    const changed = unlocked ? toggleAbilitySlot(state, id) : buyAbility(state, id)
    if (changed) onChange()
  })

  return button
}

}

