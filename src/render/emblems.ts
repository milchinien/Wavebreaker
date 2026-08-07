/**
 * Embleme: das Zeichen im Inneren eines Moduls. Reine Wiedererkennung, keine Mechanik -
 * die steckt in der Grundflaeche (Anzahl der Anschlusskanten, GDD 03 Abschnitt 7).
 *
 * Waechst mit den Inhalten. Die restlichen Zeichen kommen mit den Tuermen in E14.
 */

import type { Vec2 } from '../core/vec.ts'
import type { Emblem } from '../data/types.ts'

export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  emblem: Emblem,
  center: Vec2,
  radius: number,
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1, radius * 0.14)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (emblem) {
    case 'core': {
      // Zwei Ringe um einen vollen Kern - liest sich als Reaktor.
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 0.9, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 0.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 0.18, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'bars': {
      // Drei Laeufe - Schnellfeuer.
      const count = 3
      const gap = (radius * 1.5) / (count - 1)
      for (let i = 0; i < count; i++) {
        const x = center.x - radius * 0.75 + i * gap
        ctx.beginPath()
        ctx.moveTo(x, center.y - radius * 0.7)
        ctx.lineTo(x, center.y + radius * 0.7)
        ctx.stroke()
      }
      break
    }
    case 'chevron': {
      // Zwei Winkel - schweres Geschuetz.
      for (let i = 0; i < 2; i++) {
        const offset = -radius * 0.35 + i * radius * 0.7
        ctx.beginPath()
        ctx.moveTo(center.x - radius * 0.7, center.y + offset + radius * 0.3)
        ctx.lineTo(center.x, center.y + offset - radius * 0.3)
        ctx.lineTo(center.x + radius * 0.7, center.y + offset + radius * 0.3)
        ctx.stroke()
      }
      break
    }
    case 'star': {
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 4
        const r = i % 2 === 0 ? radius : radius * 0.4
        const point = { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) }
        if (i === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      }
      ctx.closePath()
      ctx.stroke()
      break
    }
  }

  ctx.restore()
}
