/**
 * Startvorlage fuer neue Prototypen.
 *
 * Enthaelt nur das, was jeder Prototyp braucht:
 *  - Canvas mit korrekter Aufloesung (devicePixelRatio)
 *  - Simulationsschleife mit FESTEN Zeitschritten, entkoppelt vom Rendering
 *    (siehe GDD 16, Abschnitt 12 — Voraussetzung fuer x2/x4 und Offline-Simulation)
 *
 * Regel: Dieser Ordner importiert niemals aus dem Spielprojekt.
 */

const TICK_HZ = 60
const TICK_MS = 1000 / TICK_HZ
const MAX_CATCHUP_TICKS = 5

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!
const ctx = canvas.getContext('2d')!
const hud = document.querySelector<HTMLDivElement>('#hud')!

let viewWidth = 0
let viewHeight = 0

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  viewWidth = canvas.clientWidth
  viewHeight = canvas.clientHeight
  canvas.width = Math.round(viewWidth * dpr)
  canvas.height = Math.round(viewHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

window.addEventListener('resize', resize)
resize()

// --- Simulation ------------------------------------------------------------

let elapsed = 0

function update(dt: number): void {
  elapsed += dt
}

// --- Rendering -------------------------------------------------------------

function render(): void {
  ctx.clearRect(0, 0, viewWidth, viewHeight)

  ctx.strokeStyle = '#35e0ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(viewWidth / 2, viewHeight / 2, 60, 0, Math.PI * 2)
  ctx.stroke()

  hud.textContent = `t = ${elapsed.toFixed(1)}s`
}

// --- Schleife --------------------------------------------------------------

let lastFrame = performance.now()
let accumulator = 0

function frame(now: number): void {
  accumulator += now - lastFrame
  lastFrame = now

  let ticks = 0
  while (accumulator >= TICK_MS && ticks < MAX_CATCHUP_TICKS) {
    update(TICK_MS / 1000)
    accumulator -= TICK_MS
    ticks++
  }
  if (ticks === MAX_CATCHUP_TICKS) accumulator = 0

  render()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

