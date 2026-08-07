/** Inventarliste, HUD und Debug-Panel. Kennt keine Bauregeln. */
import { defOf, RARITY_COLOR, RARITY_LABEL } from './catalog'
import { SHAPE_GLYPH, SHAPE_NAME } from './shapes'
import { neighbors, usedSlots } from './station'
import type { AppState } from './app'

export type UiActions = {
  pick(uid: string): void
  setSlots(n: number): void
  reset(): void
  runTests(): void
}

const el = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!

export function mountUI(app: AppState, actions: UiActions): () => void {
  const invList = el<HTMLDivElement>('#invList')
  const hud = el<HTMLDivElement>('#hud')
  const detail = el<HTMLDivElement>('#detail')
  const toast = el<HTMLDivElement>('#toast')
  const slotsInput = el<HTMLInputElement>('#slots')
  const slotsValue = el<HTMLSpanElement>('#slotsValue')

  slotsInput.value = String(app.station.slots)
  slotsInput.addEventListener('input', () => actions.setSlots(Number(slotsInput.value)))
  el<HTMLButtonElement>('#reset').addEventListener('click', () => actions.reset())
  el<HTMLButtonElement>('#selftest').addEventListener('click', () => actions.runTests())

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
    const nb = neighbors(app.station, uid)
    detail.innerHTML = `
      <div class="detailHead" style="--rarity:${RARITY_COLOR[inst.rarity]}">
        <span class="glyph" style="color:${def.accent}">${SHAPE_GLYPH[def.sides]}</span>
        <span>
          <span class="name">${def.name}</span>
          <span class="meta">${RARITY_LABEL[inst.rarity]} · ${SHAPE_NAME[def.sides]} · ${def.sides} Kanten</span>
        </span>`
      card.title = def.description
      card.addEventListener('click', () => actions.pick(inst.uid))
      invList.appendChild(card)
        <dt>Nachbarn</dt><dd>${nb.length} / ${def.sides}</dd>
        <dt>Schaden</dt><dd>${def.stats.damage}</dd>
        <dt>Angriffstempo</dt><dd>${def.stats.attackSpeed}/s</dd>
        <dt>Reichweite</dt><dd>${def.stats.range}</dd>
    const uid = app.selectedUid
      <p class="hint">Effektivwerte und Buffs folgen in M5.</p>`
      detail.innerHTML = '<p class="empty">Kein Modul ausgewaehlt</p>'
      return
  function renderHud(): void {
    const inst = [app.station.core, ...app.station.placed].find(m => m.uid === uid)
    const mode = app.buildUid
      ? `Bau-Modus: ${defOf(st.inventory.find(t => t.uid === app.buildUid)!.defId).name}`
      : 'Auswahl-Modus'
    hud.innerHTML = `
      <span>Plaetze <b>${usedSlots(st)}/${st.slots}</b></span>
      <span>Module <b>${st.placed.length + 1}</b></span>
      <span>freie Kanten <b>${app.free.length}</b></span>
      <div class="detailHead" style="--rarity:${RARITY_COLOR[inst.rarity]}">
        <span class="glyph" style="color:${def.accent}">${SHAPE_GLYPH[def.sides]}</span>
        <span>
          <strong>${def.name}</strong><br>
          <span class="meta">${RARITY_LABEL[inst.rarity]} · ${SHAPE_NAME[def.sides]}</span>
    const active = app.message !== null && app.time < app.messageUntil
    toast.textContent = active ? app.message! : ''
    toast.classList.toggle('visible', active)
      <dl>
        <dt>Nachbarn</dt><dd>${nb.length} / ${def.sides}</dd>
        <dt>Schaden</dt><dd>${def.stats.damage}</dd>
        <dt>Angriffstempo</dt><dd>${def.stats.attackSpeed}/s</dd>
        <dt>Reichweite</dt><dd>${def.stats.range}</dd>
    renderDetail()
      <p class="hint">Effektivwerte und Buffs folgen in M5.</p>
      <button id="removeBtn" type="button">Entfernen</button>`
  }
    const btn = detail.querySelector<HTMLButtonElement>('#removeBtn')!
    const blocked = canRemove(app.station, uid, app.removalRule)
    btn.disabled = blocked !== null
    if (blocked) btn.title = ERROR_TEXT[blocked]
    btn.addEventListener('click', () => actions.removeModule(uid))
export function showTestResults(results: { name: string; ok: boolean; info?: string }[]): void {
  const out = el<HTMLDivElement>('#testOut')
  const failed = results.filter(r => !r.ok)
    const st = app.station
    `<p class="${failed.length ? 'bad' : 'good'}">${results.length - failed.length}/${results.length} bestanden</p>` +
    results
      .map(r => `<div class="${r.ok ? 'good' : 'bad'}">${r.ok ? '✓' : '✗'} ${r.name}${r.info ? ` — ${r.info}` : ''}</div>`)
      .join('')
}

