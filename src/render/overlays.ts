/**
 * Bauhilfen, Buff-Linien und Abriss-Vorschau (GDD 13 Abschnitt 12).
 *
 * Diese Ebene erklaert die Regeln, statt sie zu behaupten:
 *   - freie Kanten leuchten, damit sichtbar ist, wo ueberhaupt gebaut werden kann
 *   - ungueltige Ziele werden **rot markiert, nicht versteckt** - sonst wirkt die
 *     Geometriebeschraenkung aus GDD 03 Abschnitt 3 wie ein Fehler
 *   - die Abriss-Vorschau zeigt vor dem Klick, was mitgeht. Ohne sie waere die
 *     Entfern-Regel eine Falle (GDD 03 Abschnitt 4)
 *   - Buff-Linien machen die Kantenregel sichtbar und sind laut GDD 03 Abschnitt 9 das
 *     wichtigste Mittel, um Buff-Tuerme ueberhaupt verstaendlich zu machen
 */

import type { Vec2 } from '../core/vec.ts'
import { towerById } from '../data/towers.ts'
import type { BuffResult } from '../sim/buffs.ts'
import { buffLinks } from '../sim/buffs.ts'
import type { FreeEdge, PlacedModule } from '../sim/station.ts'
import { viewZoom, worldToScreen, type Camera } from './camera.ts'
import { toScreen, trace } from './station.ts'
import { THEME } from './theme.ts'

export type BuildHintOptions = {
  edges: readonly FreeEdge[]
  activeEdge: FreeEdge | null
  time: number
}

/** Freie Kanten hervorheben; die eingerastete kraeftig, die uebrigen pulsierend gestrichelt. */
export function drawBuildHints(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  options: BuildHintOptions,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(options.time * 4)

  ctx.save()
  for (const candidate of options.edges) {
    const active =
      options.activeEdge?.ownerUid === candidate.ownerUid &&
      options.activeEdge.edgeIndex === candidate.edgeIndex

    const a = worldToScreen(camera, candidate.edge.a, width, height)
    const b = worldToScreen(camera, candidate.edge.b, width, height)

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = active
      ? THEME.buildEdge
      : `rgba(${THEME.buildEdgeRgb}, ${0.18 + 0.22 * pulse})`
    ctx.lineWidth = active ? 3.5 : 2
    ctx.setLineDash(active ? [] : [7, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}

/** Vorschau des Moduls an der eingerasteten Kante. Gruen gueltig, rot abgelehnt. */
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  poly: readonly Vec2[],
  camera: Camera,
  width: number,
  height: number,
  allowed: boolean,
): void {
  const points = toScreen(camera, poly, width, height)

  ctx.save()
  trace(ctx, points)
  ctx.fillStyle = allowed ? THEME.ghostFillOk : THEME.ghostFillBlocked
  ctx.fill()
  ctx.strokeStyle = allowed ? THEME.ghostOk : THEME.ghostBlocked
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

/** Laenge von Strich und Luecke der fliessenden Energie, in Bildschirmpixeln bei Zoom 1. */
const FLOW_DASH = 7
const FLOW_GAP = 11
/** Wie schnell die Energie laeuft, in Pixeln je Sekunde. */
const FLOW_SPEED = 34

/**
 * Leuchtende Linie von jedem Buff-Modul zu jedem Modul, das es tatsaechlich verstaerkt.
 *
 * Auf der ruhigen Grundlinie laeuft **Energie vom Verstaerker zum Ziel**. Das ist nicht
 * Zierde: Die Nachbarschaftsregel aus GDD 03 Abschnitt 9 ist eine gerichtete Aussage -
 * dieser Turm verstaerkt jenen, nicht umgekehrt. Ein starrer Strich zeigt nur, dass es
 * eine Verbindung gibt; die Laufrichtung zeigt, wer wem hilft.
 *
 * `time` ist echte Zeit, keine Simulationszeit: Der Fluss laeuft bei x4 gleich schnell.
 */
export function drawBuffLines(
  ctx: CanvasRenderingContext2D,
  modules: readonly PlacedModule[],
  buffs: Map<string, BuffResult>,
  camera: Camera,
  width: number,
  height: number,
  selectedUid: string | null,
  showAll: boolean,
  time: number,
): void {
  const byUid = new Map(modules.map((module) => [module.uid, module]))
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  ctx.lineCap = 'butt'

  let index = 0
  for (const link of buffLinks(buffs)) {
    const involved = selectedUid === link.from || selectedUid === link.to
    index += 1
    if (!showAll && !involved) continue

    const from = byUid.get(link.from)
    const to = byUid.get(link.to)
    if (!from || !to) continue

    const a = worldToScreen(camera, from.center, width, height)
    const b = worldToScreen(camera, to.center, width, height)
    const color = from.kind === 'tower' ? towerById(from.defId).accent : THEME.buildEdge
    const strength = involved ? 1 : 0.55

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)

    // Grundlinie: gedaempft und ununterbrochen. Sie sagt, dass die Verbindung besteht.
    ctx.globalAlpha = strength * 0.34
    ctx.strokeStyle = color
    ctx.lineWidth = involved ? 2.6 : 1.8
    ctx.shadowColor = color
    ctx.shadowBlur = 9
    ctx.stroke()

    // Darueber die Energie. Ein fallender Versatz laesst die Striche von a nach b wandern;
    // der Versatz je Linie verhindert, dass alle Verbindungen im Gleichschritt laufen.
    ctx.globalAlpha = strength
    ctx.lineWidth = involved ? 3.2 : 2.2
    ctx.setLineDash([FLOW_DASH * zoom, FLOW_GAP * zoom])
    ctx.lineDashOffset = -(time * FLOW_SPEED * zoom + index * 13)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0

    // Punkt am Ziel - dort kommt die Energie an.
    ctx.shadowBlur = 0
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(b.x, b.y, involved ? 4 : 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Zeigt beim Zeigen auf ein Modul, welche Module den Anschluss verlieren wuerden.
 * Bernstein statt rot: Es geht nichts verloren, die Module wandern nur ins Inventar.
 */
export function drawDetachPreview(
  ctx: CanvasRenderingContext2D,
  modules: readonly PlacedModule[],
  hoveredUid: string,
  detachedUids: readonly string[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 5)
  const affected = new Set(detachedUids)

  ctx.save()
  for (const module of modules) {
    if (!affected.has(module.uid)) continue
    const points = toScreen(camera, module.poly, width, height)

    trace(ctx, points)
    ctx.globalAlpha = 0.12 + 0.1 * pulse
    ctx.fillStyle = THEME.detachWarn
    ctx.fill()

    ctx.globalAlpha = 0.6 + 0.4 * pulse
    ctx.strokeStyle = THEME.detachWarn
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  const hovered = modules.find((module) => module.uid === hoveredUid)
  if (hovered) {
    trace(ctx, toScreen(camera, hovered.poly, width, height))
    ctx.globalAlpha = 1
    ctx.strokeStyle = THEME.detachWarn
    ctx.lineWidth = 2.4
    ctx.stroke()
  }
  ctx.restore()
}

