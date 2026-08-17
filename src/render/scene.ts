/**
 * Zeichenreihenfolge - eine Stelle.
 *
 * Wer eine neue Ebene hinzufuegt (Gegner in E4, Geschosse in E5, Muenzen in E7), traegt
 * sie hier ein und nirgends sonst. Damit bleibt die Reihenfolge nachlesbar, statt sich aus
 * Aufrufreihenfolgen quer durch die Dateien zu ergeben.
 */

import { MODULE_SIDE } from '../core/geometry.ts'
import { screenToWorld } from './camera.ts'
import type { GameState } from '../app/state.ts'
import { stationView } from '../app/view.ts'
import { detached, nearestFreeEdge, previewPolygon } from '../sim/station.ts'
import { placementError } from '../app/actions.ts'
import { drawLightBeams } from './backdrop.ts'
import { fitTo, rangeAllowance, type Camera } from './camera.ts'
import { CORE_CENTER } from '../sim/station.ts'
import { outerReach, rangeCircles } from '../sim/towers.ts'
import {
  drawApproach,
  drawBeams,
  drawBursts,
  drawCoins,
  drawDamageNumbers,
  drawDrones,
  drawEnemies,
  drawGains,
  drawHelpers,
  drawHits,
  drawHpBars,
  drawMuzzles,
  drawPickups,
  drawPods,
  drawProjectiles,
  drawRangeRing,
  drawShards,
  drawTrader,
} from './combat.ts'
import { helperRadius } from '../sim/helpers.ts'
import { drawBuffLines, drawBuildHints, drawDetachPreview, drawGhost } from './overlays.ts'
import { drawScreenFilter } from './post.ts'
import { drawModules } from './station.ts'
import { THEME } from './theme.ts'

/** Fangradius der Bauvorschau, in Welteinheiten. Aus Prototyp 01 uebernommen. */
export const SNAP_RADIUS = MODULE_SIDE * 2.5

export type SceneInput = {
  /** Mauszeiger in Bildschirmkoordinaten, oder null wenn er die Flaeche verlassen hat. */
  pointer: { x: number; y: number } | null
  /** Buff-Linien dauerhaft zeigen, nicht nur bei Auswahl. */
  showBuffLines: boolean
  /**
   * Kampfeffekte zeichnen (GDD 13 Abschnitt 10, E18).
   *
   * Aus heisst: kein Zerfall, keine Druckwellen, kein Muendungsfeuer, keine aufsteigenden
   * Zahlen. Was **Auskunft** ist, bleibt in jedem Fall - Gegner, Geschosse, Treffer,
   * Muenzen und Kapseln. Ein Schalter, der die Spielsicht beschneidet statt sie zu
   * beruhigen, waere ein Nachteil und keine Einstellung.
   */
  showEffects: boolean
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  input: SceneInput = { pointer: null, showBuffLines: true, showEffects: true },
): void {
  drawScene(ctx, state, camera, width, height, time, input)

  /*
   * Ganz zum Schluss der Filter (`render/post.ts`) - die einzige Ebene, die nicht zeichnet,
   * sondern das Gezeichnete aufnimmt.
   *
   * Deshalb steht sie hier und nicht im Rumpf: Der Rumpf verlaesst sich mitten im Kampfteil
   * (`return` nach den Zahlen), und eine Nachbearbeitung, die im Kampf uebersprungen wird,
   * waere ausgerechnet dort weg, wo das meiste leuchtet.
   *
   * Am Effekt-Schalter, wie die Lichtbahnen: Der Filter macht helle Stellen heller und alle
   * Zeilen gleich viel dunkler, traegt also keine Auskunft. Wer ihn abstellt, verliert nur
   * Zierde - und spart die einzige Rechnung im Zeichenweg, die mit der Bildflaeche waechst.
   */
  if (input.showEffects) drawScreenFilter(ctx, width, height)
}

/** Der Rumpf: alle Ebenen, die tatsaechlich etwas ins Bild setzen. */
function drawScene(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  input: SceneInput,
): void {
  const view = stationView(state)
  const { buildUid, dragUid, selectedUid, hoverUid } = state.runtime

  /*
   * Wo der Kampf zu sehen ist.
   *
   * Nicht nur in der Kampfansicht: Der Upgrades-Bereich zeigt dasselbe Feld in voller
   * Groesse und tauscht nur die untere Leiste. Zeichnete man dort keine Gegner, kaufte man
   * Verbesserungen vor einer eingefrorenen Station, waehrend die Welle weiterlaeuft - und
   * saehe von der Wirkung des eben gekauften Upgrades nichts.
   *
   * Die Basis bleibt aussen vor: Dort liegen die Bauhilfen, und beides zugleich waere
   * unlesbar (GDD 13 Abschnitt 3).
   */
  const fighting = state.runtime.view === 'combat' || state.runtime.view === 'upgrades'

  /*
   * Der Ausschnitt richtet sich nach der Station plus festem Rand, plus einem **gedeckelten
   * Bruchteil** der Reichweite des Hauptturms (GDD 13 Abschnitt 4).
   *
   * Die volle Reichweite darf nicht eingehen - am Prototyp gemessen faellt der Zoom dabei
   * auf 0,43 und die Station wird unlesbar. Gar kein Zuschlag ist aber genauso falsch: Dann
   * klebt der Ausschnitt an der Station, der Angriffskreis liegt zur Haelfte ausserhalb des
   * Bildes, und Gegner erscheinen erst im letzten Augenblick. Der Bruchteil ist die Mitte -
   * er haelt genau den Raum im Bild, in dem tatsaechlich gekaempft wird.
   */
  // Einmal je Bild geholt, zweimal gebraucht: hier als Zahl fuer den Ausschnitt, unten als
  // Liste fuer den Wirkungsbereich. `rangeCircles` rechnet fuer jedes Modul die volle
  // Werte-Kette durch - das zweimal je Bild zu tun war reine Doppelarbeit.
  const circles = rangeCircles(state)

  fitTo(camera, view.polys, width, height, rangeAllowance(outerReach(circles)))

  drawBackground(ctx, width, height)

  /*
   * Lichtbahnen hinter den Menuebereichen.
   *
   * Genau dort, wo **kein** Kampf zu sehen ist: In der Basis, im Prestige-Baum und in den
   * Einstellungen steht das Feld still, und ein stehendes Bild wirkt schnell wie ein
   * Standbild. Im Kampf waeren dieselben Bahnen dagegen eine zweite Bewegung neben der,
   * auf die man achten soll.
   *
   * Sie haengen am Effekt-Schalter (E18): Was reine Zierde ist, muss abschaltbar sein.
   * Auskunft steckt in ihnen keine, also geht nichts verloren.
   */
  drawLightBeams(ctx, width, height, time, !fighting && input.showEffects ? 1 : 0)

  // Der Wirkungsbereich liegt ganz unten - er ist der Boden, auf dem alles andere steht,
  // und darf nie ueber einem Gegner oder einer Muenze liegen.
  drawRangeRing(ctx, CORE_CENTER, circles, camera, width, height)

  // Liegendes Gold gehoert **unter** die Station. Ein an der Station gefallener Gegner
  // laesst seine Muenze direkt an der Modulkante fallen; laege sie darueber, deckten
  // Goldpunkte genau das zu, was man sehen soll (GDD 13 Abschnitt 10). Sichtbar bleibt
  // sie trotzdem: Gegner docken an der Aussenkante an, die Muenze liegt also am Rand.
  //
  // In jedem Bereich, nicht nur im Kampf: Muenzen verfallen nie, sie liegen also auch
  // beim Bauen da. Ausserhalb des Kampfes gedaempft - dort sind sie Auskunft, nicht
  // Aufforderung.
  drawCoins(ctx, state.run.coins, camera, width, height, time, state.runtime.view === 'combat')

  // Kapseln liegen **ueber** der Station und nicht darunter wie die Muenzen: Sie sind
  // selten und ein Gegenstand, und eine Kapsel, die halb unter einem Modul verschwindet,
  // wuerde uebersehen. Wie das Gold sind sie in jedem Bereich zu sehen - sie verfallen
  // nicht, also liegen sie auch beim Bauen da.
  drawPods(ctx, state.run.pods, camera, width, height, time, state.runtime.view === 'combat')

  drawModules(ctx, view.modules, camera, width, height, time, {
    dragUid,
    selectedUid,
    hoverUid,
    // Ueberall, wo der Kampf zu sehen ist, weicht ein Modul beim Schuss zurueck. Nur in
    // der Basis nicht: Dort wird gebaut, und nichts darf zucken, was man gerade an einer
    // Kante ausrichtet.
    recoils: fighting ? state.runtime.combat.recoils : undefined,
    // Das Einrasten dagegen **immer**: Gebaut wird in der Basis, und genau dort soll man
    // sehen, dass ein Modul angedockt hat (GDD 13 Abschnitt 10).
    placings: state.runtime.combat.placings,
    flash: stationFlash(state),
    // Nur wo der Kampf zu sehen ist: In der Basis steht die Station still, und ein
    // pulsierender Umriss waere dort eine Bewegung ohne Anlass.
    overdrive: fighting
      ? new Set(state.runtime.combat.overdrive.keys())
      : undefined,
  })
  drawBuffLines(
    ctx,
    view.modules,
    view.buffs,
    camera,
    width,
    height,
    selectedUid,
    input.showBuffLines,
    time,
  )

  if (fighting) {
    const combat = state.runtime.combat
    // Fliegende Muenzen dagegen liegen oben: Sie sind Bewegung zum Zeiger, keine Kulisse.
    drawPickups(ctx, combat.pickups, camera, width, height, time)
    drawEnemies(ctx, combat.enemies, camera, width, height)
    // Wer noch ausserhalb laeuft, bekommt eine Marke am Rand statt gar nichts.
    drawApproach(ctx, combat.enemies, camera, width, height)

    /*
     * Der Zerfall liegt **ueber** den lebenden Gegnern.
     *
     * Hier stand vorher "Was tot ist, tritt zurueck" - eine schoene Regel fuer einen
     * Friedhof und eine falsche fuer ein Spiel. Der Abschuss ist der Augenblick, auf den
     * das ganze Bild hinarbeitet: Alles davor - Zielen, Schiessen, Aufbauen - hat nur den
     * Zweck, ihn herbeizufuehren. Lag er hinter dem Pulk, verschwand er genau dann, wenn es
     * voll wurde, also genau dann, wenn er zaehlte: In der spaeten Welle schoss man in
     * einen Teppich, in dem nichts mehr passierte.
     *
     * Ueber den Gegnern und **unter** allem, was dem Spieler gehoert (Drohnen, Haendler,
     * Strahlen, Muendungsfeuer, Zahlen): Die Druckwelle darf den lebenden Nachbarn
     * ueberdecken, den sie zerreisst - aber nicht die Station, die sie erzeugt hat.
     */
    if (input.showEffects) {
      drawBursts(ctx, combat.bursts, camera, width, height)
      drawShards(ctx, combat.shards, camera, width, height)
    }

    drawProjectiles(ctx, combat.projectiles, camera, width, height)
    // Drohnen fliegen ueber dem Geschehen - sie gehoeren dem Spieler und sollen nicht
    // zwischen Gegnern verschwinden.
    drawDrones(ctx, combat.drones, camera, width, height, time)
    // Helfer fliegen auf derselben Ebene wie die Kampfdrohnen: Beide gehoeren dem Spieler
    // und sollen nicht zwischen Gegnern verschwinden.
    drawHelpers(ctx, state.runtime.helpers, helperRadius(state), camera, width, height, time)
    // Die Haendler-Drohne liegt ueber allem im Feld: Sie ist die seltenste Gelegenheit des
    // Runs und laeuft auf einer Frist - sie darf hinter keinem Gegner verschwinden.
    drawTrader(ctx, state.run.trader, camera, width, height, time)
    // Der Laserstrahl liegt ueber allem, was er durchquert - er ist eine Linie zwischen
    // zwei Punkten und wuerde von jedem Gegner dazwischen zerschnitten.
    drawBeams(ctx, combat.beams, camera, width, height)
    // Muendungsfeuer ueber den Modulen, aber unter den Trefferblitzen: Der Schuss geht vom
    // Turm aus, der Einschlag liegt darueber.
    if (input.showEffects) drawMuzzles(ctx, combat.muzzles, camera, width, height)
    // Trefferblitze bleiben auch bei ausgeschalteten Effekten: Sie sind die Rueckmeldung,
    // ob ueberhaupt getroffen wird, und damit Auskunft statt Zierde.
    drawHits(ctx, combat.hits, camera, width, height)

    /*
     * Die Lebensbalken liegen ueber JEDEM Effekt.
     *
     * Vorgemerkt werden sie in `drawEnemies`, gezeichnet erst hier - und das ist der ganze
     * Zweck der Trennung. Zwischen den beiden Zeilen liegen zehn Ebenen: Anmarschmarken,
     * Druckwelle, Splitter, Geschosse, Drohnen, Helfer, Haendler, Strahlen, Muendungsfeuer,
     * Trefferblitze. Jede einzelne davon hat den Balken frueher uebermalt; nachgemessen im
     * Pulk trug ein Balken 0 von 54 Bildpunkten, weil ein Trefferblitz genau darauf lag.
     *
     * Ausgerechnet der Trefferblitz ist dabei der schlimmste Fall: Er erscheint dort, wo
     * gerade Schaden entsteht, also genau an dem Gegner, dessen Lebensstand sich in
     * derselben Sekunde aendert. Die Anzeige verschwand also immer im Augenblick ihrer
     * groessten Aussagekraft.
     *
     * Nicht ueber den Zahlen: Die Zahl ist die Quittung eines Augenblicks und steigt aus dem
     * Bild, der Balken bleibt liegen. Zwei Dauerflaechen ueber einer fluechtigen Schrift
     * waeren eine Anzeige, die die andere frisst.
     */
    drawHpBars(ctx)

    // Die Zahlen liegen ueber allem - sie sind die Quittung und duerfen nicht verdeckt
    // werden. Erst der Schaden, dann der Gewinn: Wo beides zusammenfaellt, gehoert der
    // eingesammelte Betrag nach oben. Er ist das, was der Spieler behaelt.
    if (input.showEffects) {
      drawDamageNumbers(ctx, combat.damages, camera, width, height)
      drawGains(ctx, combat.gains, camera, width, height)
    }
    return
  }

  const building = buildUid ?? dragUid
  if (building) {
    drawBuildTools(ctx, state, camera, width, height, time, input, building)
  } else if (hoverUid) {
    drawRemovalPreview(ctx, state, camera, width, height, time, hoverUid)
  }
}

/** Freie Kanten, eingerastete Kante und Vorschau des Moduls. */
function drawBuildTools(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  input: SceneInput,
  buildingUid: string,
): void {
  const { dragUid } = state.runtime
  const view = stationView(state)

  // Beim Umsetzen darf das Modul nicht an sich selbst andocken.
  const edges = dragUid
    ? view.freeEdges.filter((edge) => edge.ownerUid !== dragUid)
    : view.freeEdges

  const active = input.pointer
    ? nearestFreeEdge(edges, screenToWorld(camera, input.pointer, width, height), SNAP_RADIUS)
    : state.runtime.hoverEdge

  drawBuildHints(ctx, camera, width, height, { edges, activeEdge: active, time })
  if (!active) return

  const module =
    state.run.station.inventory.find((m) => m.uid === buildingUid) ??
    state.run.station.placed.find((m) => m.uid === buildingUid)
  if (!module) return

  const { poly } = previewPolygon(module.defId, active)
  drawGhost(ctx, poly, camera, width, height, placementError(state, active) === null)
}

/** Was wuerde mitgehen, wenn dieses Modul entfernt wird (GDD 03 Abschnitt 4). */
function drawRemovalPreview(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  width: number,
  height: number,
  time: number,
  hoverUid: string,
): void {
  if (!state.run.station.placed.some((m) => m.uid === hoverUid)) return

  const view = stationView(state)
  const uids = detached(state.run.station, hoverUid).map((m) => m.uid)
  if (uids.length === 0) return

  drawDetachPreview(ctx, view.modules, hoverUid, uids, camera, width, height, time)
}

/**
 * Wie stark der Kern gerade nachzittert - 1 im Augenblick des Treffers, 0 danach.
 *
 * Auch in der Basis: Wer dort baut, waehrend die Station getroffen wird, soll es sehen.
 * Das Zittern sitzt im Leuchten und verschiebt nichts, stoert also kein Ausrichten.
 *
 * Herausgereicht, weil der Kern seit dem Kernfeld an **zwei** Stellen gezeichnet wird
 * (`ui/coregauge.ts`). Die Rechnung dort zu wiederholen hiesse, dass ein spaeter geaenderter
 * Abklingverlauf an einer der beiden Stellen stehen bleibt - und niemand saehe es, weil
 * beide fuer sich richtig aussehen.
 */
export function stationFlash(state: GameState): number {
  const flash = state.runtime.combat.stationFlash
  if (!flash.active || flash.life <= 0) return 0
  return Math.max(0, 1 - flash.age / flash.life)
}

/**
 * Der Grund, auf dem alles steht (GDD 13 Abschnitt 2).
 *
 * Vier Lagen, von hinten nach vorn: Verlauf, Raster, Schein um die Mitte, Abdunklung zu den
 * Ecken. Jede einzelne soll man nicht bemerken - zusammen ergeben sie den Unterschied
 * zwischen einer schwarzen Flaeche und einem Raum, in dem etwas leuchtet.
 *
 * **Regel:** Der Hintergrund darf nur auffallen, wenn man bewusst darauf achtet. Deshalb
 * liegen alle vier Lagen bei sehr geringer Deckkraft - der hellste Punkt des Scheins traegt
 * ein Zehntel.
 */
function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, THEME.bgTop)
  gradient.addColorStop(1, THEME.bgBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const spacing = THEME.gridSpacing
  ctx.strokeStyle = THEME.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x < width; x += spacing) {
    ctx.moveTo(Math.round(x) + 0.5, 0)
    ctx.lineTo(Math.round(x) + 0.5, height)
  }
  for (let y = 0; y < height; y += spacing) {
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(width, Math.round(y) + 0.5)
  }
  ctx.stroke()

  const centerX = width / 2
  const centerY = height / 2
  const reach = Math.min(width, height) * THEME.glowRadius

  // Der Schein um die Mitte - die Station steht in ihrem eigenen Licht.
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, reach)
  glow.addColorStop(0, THEME.glowCore)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  // Die Abdunklung zu den Ecken. Sie beginnt erst jenseits der halben Diagonale, damit sie
  // dem Spielfeld nichts wegnimmt und wirklich nur die Ecken schliesst.
  const corner = Math.hypot(centerX, centerY)
  const shade = ctx.createRadialGradient(centerX, centerY, corner * 0.55, centerX, centerY, corner)
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)')
  shade.addColorStop(1, THEME.vignette)
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, width, height)
}
