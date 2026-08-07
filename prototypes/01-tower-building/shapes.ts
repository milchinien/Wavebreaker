/**
 * Trennung von Grundflaeche und Optik:
 *  - Footprint (3/4/5/6 Kanten) = Geometrie und Anzahl der Anschlusskanten, echte Mechanik
 *  - Emblem                     = Zeichen im Inneren, reine Wiedererkennung
 *
 * Damit lassen sich die GDD-Formen "Kreis" und "Spezialform" darstellen, ohne die
 * Ansteck-Geometrie zu brechen (siehe PLAN.md, Abschnitt 4.3).
 */
import type { Emblem, FootprintSides } from './model'
import type { Vec2 } from './geometry'

export const SHAPE_GLYPH: Record<FootprintSides, string> = {
  3: '▲',
  4: '■',
  5: '⬟',
  6: '⬢',
}

export const SHAPE_NAME: Record<FootprintSides, string> = {
  3: 'Dreieck',
  4: 'Viereck',
  5: 'Fuenfeck',
  6: 'Hexagon',
}

export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  emblem: Emblem,
  c: Vec2,
  r: number,
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1, r * 0.14)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (emblem) {
    case 'bars': {
      const n = 3
      const gap = (r * 1.5) / (n - 1)
      for (let i = 0; i < n; i++) {
        const x = c.x - r * 0.75 + i * gap
        ctx.beginPath()
        ctx.moveTo(x, c.y - r * 0.7)
        ctx.lineTo(x, c.y + r * 0.7)
        ctx.stroke()
      }
      break
    }
    case 'triangle': {
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / 3
        const p = { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'circle': {
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.75, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'ring': {
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.75, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const t = -Math.PI / 2 + (i * Math.PI) / 4
        const rad = i % 2 === 0 ? r : r * 0.4
        const p = { x: c.x + rad * Math.cos(t), y: c.y + rad * Math.sin(t) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'chevron': {
      for (let i = 0; i < 2; i++) {
        const dy = -r * 0.35 + i * r * 0.7
        ctx.beginPath()
        ctx.moveTo(c.x - r * 0.7, dy + c.y + r * 0.3)
        ctx.lineTo(c.x, dy + c.y - r * 0.3)
        ctx.lineTo(c.x + r * 0.7, dy + c.y + r * 0.3)
        ctx.stroke()
      }
      break
    }
    case 'shield': {
      ctx.beginPath()
      ctx.moveTo(c.x, c.y - r)
      ctx.lineTo(c.x + r * 0.8, c.y - r * 0.45)
      ctx.lineTo(c.x + r * 0.8, c.y + r * 0.25)
      ctx.lineTo(c.x, c.y + r)
      ctx.lineTo(c.x - r * 0.8, c.y + r * 0.25)
      ctx.lineTo(c.x - r * 0.8, c.y - r * 0.45)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'core': {
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.9, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.18, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
  ctx.restore()
}
