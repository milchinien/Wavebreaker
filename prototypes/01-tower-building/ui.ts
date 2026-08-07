/** Inventarliste, HUD und Debug-Panel. Kennt keine Bauregeln. */
import { defOf, RARITY_COLOR, RARITY_LABEL, RARITY_MULT } from './catalog'
import { SHAPE_GLYPH, SHAPE_NAME } from './shapes'
import { canRemove, ERROR_TEXT, usedSlots } from './station'
import type { RemovalRule } from './station'
import { STAT_KEYS, STAT_LABEL } from './buffs'
import type { StatKey } from './model'
import type { AppState } from './app'

export type UiActions = {
  pick(uid: string): void
  setSlots(n: number): void
  setRemovalRule(rule: RemovalRule): void
  removeModule(uid: string): void
  reset(): void
  grow(count: number): void
  clearSave(): void
  runTests(): void
}

const el = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!

/** Zahlendarstellung nach GDD 13 §8: ab 10.000 abgekuerzt, englische Konvention. */
export function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('de-DE', { maximumFractionDigits: abs < 10 ? 2 : 1 })
}

/** Prozentwerte immer als solche, nie als Multiplikator (GDD 13 §8). */
const pct = (v: number): string => `+${(v * 100).toFixed(v * 100 < 10 ? 1 : 0)} %`

function statValue(key: StatKey, v: number): string {
  if (key === 'critChance') return `${(v * 100).toFixed(1)} %`
  if (key === 'attackSpeed') return `${fmt(v)}/s`
  return fmt(v)
}

export function mountUI(app: AppState, actions: UiActions): () => void {
  const invList = el<HTMLDivElement>('#invList')
  const hud = el<HTMLDivElement>('#hud')
  const detail = el<HTMLDivElement>('#detail')
  const slotsInput = el<HTMLInputElement>('#slots')
  const slotsValue = el<HTMLSpanElement>('#slotsValue')

  const ruleSelect = el<HTMLSelectElement>('#removeRule')

  slotsInput.value = String(app.station.slots)
  slotsInput.addEventListener('input', () => actions.setSlots(Number(slotsInput.value)))
  ruleSelect.value = app.removalRule
  ruleSelect.addEventListener('change', () => actions.setRemovalRule(ruleSelect.value as RemovalRule))
  el<HTMLButtonElement>('#reset').addEventListener('click', () => actions.reset())
  el<HTMLButtonElement>('#selftest').addEventListener('click', () => actions.runTests())

  const growInput = el<HTMLInputElement>('#grow')
  const growValue = el<HTMLSpanElement>('#growValue')
  growInput.addEventListener('input', () => (growValue.textContent = growInput.value))
  el<HTMLButtonElement>('#growBtn').addEventListener('click', () => actions.grow(Number(growInput.value)))
  el<HTMLButtonElement>('#clearSave').addEventListener('click', () => actions.clearSave())

  function renderInventory(): void {
    invList.innerHTML = ''
    if (app.station.inventory.length === 0) {
      invList.innerHTML = '<p class="empty">Inventar leer</p>'
      return
    }

    for (const inst of app.station.inventory) {
      const def = defOf(inst.defId)
      const card = document.createElement('button')
      card.className = 'invCard' + (app.buildUid === inst.uid ? ' active' : '')
      card.style.setProperty('--rarity', RARITY_COLOR[inst.rarity])
      card.innerHTML = `
        <span class="glyph" style="color:${def.accent}">${SHAPE_GLYPH[def.sides]}</span>
        <span class="body">
          <span class="name">${def.name}</span>
          <span class="meta">${RARITY_LABEL[inst.rarity]} · ${SHAPE_NAME[def.sides]} · ${def.sides} Kanten</span>
        </span>`
      card.title = def.description
      card.addEventListener('click', () => actions.pick(inst.uid))
      invList.appendChild(card)
    }
  }

  function renderDetail(): void {
    const uid = app.selectedUid
    if (!uid) {
      detail.innerHTML = '<p class="empty">Kein Modul ausgewaehlt</p>'
      return
    }
    const inst = [app.station.core, ...app.station.placed].find(m => m.uid === uid)
    if (!inst) {
      detail.innerHTML = '<p class="empty">Kein Modul ausgewaehlt</p>'
      return
    }
    const def = defOf(inst.defId)
    const eff = app.summary.towers.get(uid)!

    // Werte, die das Modul ueberhaupt besitzt oder die gerade gebufft werden
    const rows = STAT_KEYS.filter(k => eff.base[k] > 0 || eff.bonuses[k] !== undefined)
      .map(k => {
        const bonus = eff.bonuses[k]
        if (bonus === undefined) return `<dt>${STAT_LABEL[k]}</dt><dd>${statValue(k, eff.base[k])}</dd>`
        const raw = eff.raw[k]!
        const capped = eff.capped.includes(k)
        return `<dt>${STAT_LABEL[k]}</dt><dd>
          <span class="was">${statValue(k, eff.base[k])}</span> →
          <b>${statValue(k, eff.final[k])}</b>
          <span class="bonus${capped ? ' capped' : ''}"
                title="${capped ? `Summe ${pct(raw)} liegt ueber dem Deckel` : ''}">${pct(bonus)}${capped ? ' ⛔' : ''}</span>
        </dd>`
      })
      .join('')

    const buffOut = def.buffs
      ? `<p class="buffOut">Verstaerkt <b>${eff.boosted}</b> von ${eff.neighborCount} Nachbarn:<br>
           ${def.buffs.map(b => `${pct(b.amount * RARITY_MULT[inst.rarity])} ${STAT_LABEL[b.stat]}`).join(' · ')}</p>`
      : ''

    const incoming = eff.sources.length
      ? `<h3>Aktive Buffs</h3><ul class="sources">${eff.sources
          .map(s => `<li>${pct(s.amount)} ${STAT_LABEL[s.stat]} <span class="meta">← ${s.fromName}</span></li>`)
          .join('')}</ul>`
      : '<p class="hint">Keine Buffs — kein Buff-Modul an einer gemeinsamen Kante.</p>'

    detail.innerHTML = `
      <div class="detailHead" style="--rarity:${RARITY_COLOR[inst.rarity]}">
        <span class="glyph" style="color:${def.accent}">${SHAPE_GLYPH[def.sides]}</span>
        <span>
          <strong>${def.name}</strong><br>
          <span class="meta">${RARITY_LABEL[inst.rarity]} · ${SHAPE_NAME[def.sides]}</span>
        </span>
      </div>
      <p class="desc">${def.description}</p>
      <dl>
        <dt>Nachbarn</dt><dd>${eff.neighborCount} / ${def.sides}</dd>
        ${rows}
      </dl>
      ${buffOut}
      ${def.stationBonus?.stationHp ? `<p class="buffOut">+${fmt(def.stationBonus.stationHp * RARITY_MULT[inst.rarity])} Stations-HP</p>` : ''}
      ${incoming}
      <button id="removeBtn" type="button">Entfernen</button>`

    const btn = detail.querySelector<HTMLButtonElement>('#removeBtn')!
    const blocked = canRemove(app.station, uid, app.removalRule)
    btn.disabled = blocked !== null
    if (blocked) btn.title = ERROR_TEXT[blocked]
    btn.addEventListener('click', () => actions.removeModule(uid))
  }

  function renderHud(): void {
    const st = app.station
    const mode = app.buildUid
      ? `Bau-Modus: ${defOf(st.inventory.find(t => t.uid === app.buildUid)!.defId).name}`
      : app.dragUid
        ? 'Modul wird umgesetzt'
        : 'Auswahl-Modus'
    hud.innerHTML = `
      <span>Plaetze <b>${usedSlots(st)}/${st.slots}</b></span>
      <span>Module <b>${st.placed.length + 1}</b></span>
      <span>freie Kanten <b>${app.free.length}</b></span>
      <span>Stations-HP <b>${fmt(app.summary.stationHp)}</b></span>
      <span title="Theoretischer Vergleichswert, kein Balancing">DPS <b>${fmt(app.summary.theoreticalDps)}</b></span>
      <span class="mode">${mode}</span>`
  }

  function update(): void {
    slotsValue.textContent = String(app.station.slots)
    ruleSelect.value = app.removalRule
    renderInventory()
    renderDetail()
    renderHud()
    updateToast(app)
  }

  update()
  return update
}

/** Wird jeden Frame aufgerufen, damit Meldungen von selbst verschwinden. */
export function updateToast(app: AppState): void {
  const toast = el<HTMLDivElement>('#toast')
  const active = app.message !== null && app.time < app.messageUntil
  const text = active ? app.message! : ''
  if (toast.textContent !== text) toast.textContent = text
  toast.classList.toggle('visible', active)
}

export function showTestResults(results: { name: string; ok: boolean; info?: string }[]): void {
  const out = el<HTMLDivElement>('#testOut')
  const failed = results.filter(r => !r.ok)
  out.innerHTML =
    `<p class="${failed.length ? 'bad' : 'good'}">${results.length - failed.length}/${results.length} bestanden</p>` +
    results
      .map(r => `<div class="${r.ok ? 'good' : 'bad'}">${r.ok ? '✓' : '✗'} ${r.name}${r.info ? ` — ${r.info}` : ''}</div>`)
      .join('')
}
