/**
 * Prototyp 01 — Turmbau, Etappen M0–M3.
 *
 * Enthalten: Geometrie, Katalog, Inventar, Andocken an freie Kanten.
 * Noch nicht enthalten: Entfernen/Verschieben (M4), Buffs (M5), Politur (M6), Persistenz (M7).
 * Enthalten: Geometrie, Katalog, Inventar, Andocken, Umbauen, Buff-System.
 * Noch nicht enthalten: Politur (M6), Persistenz und Auswertung (M7).
import { createCamera, fitTo, step } from './camera'
import { clearInteraction, createApp, notify, refresh, removeModule } from './app'
import { createCamera, fitTo, step } from './camera'
import { allModules } from './station'
import { mountUI, showTestResults, updateToast } from './ui'
import { runSelfTests } from './selftest'
import { createStation } from './station'

const TICK_HZ = 60
const TICK_MS = 1000 / TICK_HZ
const MAX_CATCHUP_TICKS = 5

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const ctx = canvas.getContext('2d')!

let viewW = 0
let viewH = 0

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  viewW = canvas.clientWidth
  viewH = canvas.clientHeight
  canvas.width = Math.round(viewW * dpr)
  canvas.height = Math.round(viewH * dpr)
  canvas.height = Math.round(viewH * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
const app = createApp()
const cam = createCamera()
const cam = createCamera()
const update = mountUI(app, {
const update = mountUI(app, {
    app.buildUid = app.buildUid === uid ? null : uid
    const next = app.buildUid === uid ? null : uid
    clearInteraction(app)
    app.buildUid = next
    update()
  setSlots(n) {
    app.station.slots = n
    app.station.slots = n
    update()
  reset() {
    const slots = app.station.slots
    app.station = createStation(slots)
    notify(app, rule === 'block' ? 'Variante A: Entfernen blockieren' : 'Variante B: Inseln wandern zurueck')
    app.selectedUid = null
    app.ghost = null
    app.hoverEdge = null
    removeModule(app, uid)
    notify(app, 'Station zurueckgesetzt')
    update()
  grow(count) {
    app.station = createStation(count)
    const placed = growRandom(app.station, count, count * 7919)
    app.selectedUid = null
    clearInteraction(app)
    refresh(app)
    notify(app, placed < count ? `Nur ${placed} von ${count} Modulen passten an` : `${placed} Module aufgebaut`)
    update()
window.addEventListener('resize', resize)
  reset() {
    const slots = app.station.slots
if (location.search.includes('selftest')) {
  const results = runSelfTests()
  showTestResults(results)
  const failed = results.filter(r => !r.ok)
  console.log(`Selbsttests: ${results.length - failed.length}/${results.length} bestanden`)
  for (const f of failed) console.error(`✗ ${f.name} — ${f.info}`)
  },
  clearSave() {
// --- Schleife: feste Zeitschritte, Rendering entkoppelt (GDD 16 §12) -------
    notify(app, 'Spielstand geloescht — beim naechsten Laden wieder Startzustand')
let lastFrame = performance.now()
let accumulator = 0

function tick(dt: number): void {
  app.time += dt
  fitTo(cam, allModules(app.station).map(m => m.poly), viewW, viewH)
  step(cam, dt)
}

function frame(now: number): void {
  accumulator += now - lastFrame
  lastFrame = now

  let ticks = 0
  while (accumulator >= TICK_MS && ticks < MAX_CATCHUP_TICKS) {
    tick(TICK_MS / 1000)
    accumulator -= TICK_MS
    ticks++
  }
  if (ticks === MAX_CATCHUP_TICKS) accumulator = 0

  render(ctx, app, cam, viewW, viewH)
  updateToast(app)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

