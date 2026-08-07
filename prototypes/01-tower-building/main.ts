/**
 * Prototyp 01 — Turmbau, vollstaendig (M0–M7).
 *
 * Geometrie, Katalog, Inventar, Andocken, Umbauen, Buff-System, Darstellung, Persistenz.
 * Ergebnis und offene Urteilsfragen: README.md
 */
import { clearInteraction, createApp, notify, refresh, removeModule } from './app'
import { createCamera, fitTo, step } from './camera'
import { attachInput } from './input'
import { render } from './render'
import { allModules } from './station'
import { mountUI, showTestResults, updateToast } from './ui'
import { runSelfTests } from './selftest'
import { growRandom } from './devtools'
import { clear as clearSaved, load as loadSaved, save } from './persist'
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

const app = createApp()
const cam = createCamera()

// Fortlaufendes Laden/Speichern wie im Spiel vorgesehen (GDD 16 §8): kein Speichern-Knopf.
const restored = loadSaved()
if (restored) {
  app.station = restored
  refresh(app)
}

const renderUi = mountUI(app, {
  pick(uid) {
    const next = app.buildUid === uid ? null : uid
    clearInteraction(app)
    app.buildUid = next
    update()
  },
  setSlots(n) {
    app.station.slots = n
    update()
  },
  setRemovalRule(rule) {
    app.removalRule = rule
    notify(app, rule === 'block' ? 'Variante A: Entfernen blockieren' : 'Variante B: Inseln wandern zurueck')
    update()
  },
  removeModule(uid) {
    removeModule(app, uid)
    update()
  },
  grow(count) {
    app.station = createStation(count)
    const placed = growRandom(app.station, count, count * 7919)
    app.selectedUid = null
    clearInteraction(app)
    refresh(app)
    notify(app, placed < count ? `Nur ${placed} von ${count} Modulen passten an` : `${placed} Module aufgebaut`)
    update()
  },
  reset() {
    const slots = app.station.slots
    app.station = createStation(slots)
    app.selectedUid = null
    clearInteraction(app)
    refresh(app)
    notify(app, 'Station zurueckgesetzt')
    update()
  },
  clearSave() {
    app.station = createStation(4)
    app.selectedUid = null
    clearInteraction(app)
    refresh(app)
    clearSaved()
    notify(app, 'Spielstand geloescht und Startzustand hergestellt')
    // Bewusst renderUi statt update: sonst schriebe das Autosave den Stand sofort wieder.
    renderUi()
  },
  runTests() {
    showTestResults(runSelfTests())
  },
})

/** Jede Zustandsaenderung zeichnet die Oberflaeche neu und sichert den Stand. */
function update(): void {
  renderUi()
  save(app.station)
}

if (restored) notify(app, `Layout wiederhergestellt — ${restored.placed.length} Module`)
update()

attachInput(canvas, app, cam, () => ({ w: viewW, h: viewH }), update)

window.addEventListener('resize', resize)
resize()

if (location.search.includes('selftest')) {
  const results = runSelfTests()
  showTestResults(results)
  const failed = results.filter(r => !r.ok)
  console.log(`Selbsttests: ${results.length - failed.length}/${results.length} bestanden`)
  for (const f of failed) console.error(`✗ ${f.name} — ${f.info}`)
}

// --- Schleife: feste Zeitschritte, Rendering entkoppelt (GDD 16 §12) -------

let lastFrame = performance.now()
let accumulator = 0

function tick(dt: number): void {
  app.time += dt

  // Bei sichtbaren Reichweitenkreisen zoomt die Kamera weiter heraus (GDD 13 §4)
  let extra = 0
  if (app.showRanges) {
    for (const t of app.summary.towers.values()) extra = Math.max(extra, t.final.range)
  }
  fitTo(cam, allModules(app.station).map(m => m.poly), viewW, viewH, extra)
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
