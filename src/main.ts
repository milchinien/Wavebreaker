/**
 * Einstieg: Zustand laden, Schleife starten, Bereiche verdrahten.
 *
 * Diese Datei kennt keine Regeln. Sie verbindet Schleife, Zustand, Zeichnen und Bedienung -
 * jede Entscheidung faellt in `sim/` und `app/`.
 */

import { createLoop, type SpeedFactor } from './core/loop.ts'
import { emit, on } from './core/events.ts'
import { formatDuration, formatNumber } from './core/format.ts'
import { TICK_RATE } from './data/balance.ts'
import { t } from './data/strings.ts'
import { mountAudio } from './app/audio.ts'
import { lastSavedAt, load, startAutosave } from './app/save.ts'
import { loadSettings, saveSettings } from './app/settings.ts'
import { createInitialState, markDirty } from './app/state.ts'
import { invalidateStationView, stationView } from './app/view.ts'
import { stepBattle, syncStation } from './sim/battle.ts'
import { resetHints, settleHints } from './sim/hints.ts'
import { simulateOffline } from './sim/offline.ts'
import { availableSpeeds, syncUnlocks } from './sim/prestige.ts'
import { startWave } from './sim/waves.ts'
import { mountBoot } from './ui/boot.ts'
import { mountCoinFlight } from './ui/coinflight.ts'
import { mountHints } from './ui/hints.ts'
import { mountHud } from './ui/hud.ts'
import { mountOutcome } from './ui/outcome.ts'
import { mountSurge } from './ui/surge.ts'
import {
  createCamera,
  pulseZoom,
  resetAuto,
  snapToTarget,
  step as stepCamera,
  viewZoom,
  zoomBy,
} from './render/camera.ts'
import { render as renderScene } from './render/scene.ts'
import { THEME } from './render/theme.ts'
import { attachInput } from './ui/input.ts'
import { toggleMute, type SettingsControls } from './ui/settings.ts'
import { mountShell, type ShellTargets } from './ui/shell.ts'
import { runSelfTests, summarize } from './selftest/index.ts'

const app = document.getElementById('app')
const stage = document.getElementById('stage') as HTMLCanvasElement | null
const overlay = document.getElementById('overlay')
const dock = document.getElementById('dock')

if (!app || !stage || !overlay || !dock) throw new Error('Buehne oder Bedienflaeche fehlt in index.html')

const query = new URLSearchParams(location.search)

if (query.has('selftest')) {
  showSelfTestReport(stage, app)
} else {
  boot(stage, { app, overlay, dock })
}

/**
 * Vor dem Spiel steht der Startbildschirm (`ui/boot.ts`).
 *
 * Er ist ein **Riegel**, keine Zwischenblende: `startGame` laeuft erst, wenn der Spieler
 * gedrueckt hat. Liefe die Schleife schon dahinter, verginge die erste Welle, waehrend das
 * Plakat noch steht - und die Abwesenheitsrechnung (`simulateOffline`) verbuchte eine Zeit,
 * die der Spieler gerade zusieht.
 *
 * Die Bewegungsdaempfung wird hier **vorgezogen**. Sie steht sonst erst in `startGame`, und
 * damit liefe der Startbildschirm als einziger Teil der Oberflaeche noch mit voller
 * Bewegung - bei jemandem, der sie abbestellt hat, ausgerechnet als erstes Bild.
 *
 * `?noboot` ueberspringt ihn. Das ist fuer die Entwicklung: Wer eine Zeile aendert und neu
 * laedt, will das Spiel sehen und nicht das Plakat - dieselbe Bauart wie `?debug`.
 */
function boot(canvas: HTMLCanvasElement, targets: ShellTargets): void {
  const settings = loadSettings()
  applyMotion(targets.app, settings.motion)
  applyEffects(targets.app, settings.effects)

  if (query.has('noboot')) {
    startGame(canvas, targets)
    return
  }

  mountBoot(targets.app, { onStart: () => startGame(canvas, targets) })
}

// ---------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------

function startGame(canvas: HTMLCanvasElement, targets: ShellTargets): void {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas-Kontext nicht verfuegbar')

  const loaded = load()
  const state = loaded ?? createInitialState()
  emit('save.loaded', { fresh: loaded === null, version: 1 })

  // Turmplaetze und Faehigkeitenslots stehen im Run, kommen aber aus dem Prestige-Baum.
  // Nach dem Laden werden beide Sichten einmal gleichgezogen - ein Spielstand aus der Zeit
  // vor E13 kennt seine Freischaltungen sonst nicht.
  syncUnlocks(state)

  // Dieselbe Bewegung fuer die Hinweisreihe: Was dieser Spielstand nachweislich hinter sich
  // hat, gilt als gelernt. Ohne diese Zeile bekaeme ein Spielstand aus der Zeit vor den
  // Hinweisen - oder einer mit leerem Merkzettel - auf Welle 40 die Anfaengerreihe von
  // vorn vorgespielt. Nur nach dem Laden, nie im laufenden Spiel (siehe `settleHints`).
  if (loaded) settleHints(state)

  const loop = createLoop({ tickRate: TICK_RATE })

  /*
   * Die Abwesenheit wird verrechnet, **bevor** irgendetwas anderes laeuft (GDD 12
   * Abschnitt 4).
   *
   * Vor dem Klang: Der Schnelldurchlauf meldet zehntausende Treffer, und ohne Zuhoerer
   * kosten sie nichts. Vor der Schleife: Sonst liefen Vordergrund und Nachholrechnung
   * gleichzeitig auf demselben Zustand. Und vor der ersten Welle, weil er selbst eine
   * startet.
   */
  const awaySeconds = secondsAway(loaded, loop.wallClock())
  if (awaySeconds > 0) {
    invalidateStationView(state)
    state.runtime.returnSummary = simulateOffline(state, awaySeconds, stationView(state))
  }
  const autosave = startAutosave(state, loop)
  const camera = createCamera()

  /*
   * Die Regler des Geraets (E18).
   *
   * Sie liegen in einer eigenen Ablage und nicht im Spielstand - siehe `app/settings.ts`.
   * Jede Aenderung schreibt sofort zurueck: Ein Regler, der erst beim Schliessen des Tabs
   * gesichert wird, ist der Regler, der bei einem Absturz verloren geht.
   */
  const preferences = loadSettings()
  const audio = mountAudio(preferences.mix)
  applyMotion(targets.app, preferences.motion)
  applyEffects(targets.app, preferences.effects)

  const remember = (): void => saveSettings(preferences)

  // Die Bedienelemente der Oberflaeche greifen nicht selbst in die Schleife - sie fragen
  // hier nach. Damit bleibt die Schleife die einzige Stelle, die Tempo und Kamera kennt.
  const controls: SettingsControls = {
    speed: () => loop.getSpeed(),
    // Welche Stufen der Spielstand hergibt, entscheidet der Prestige-Baum - die Oberflaeche
    // fragt nur nach (GDD 10, Bereich 2b).
    speeds: () => availableSpeeds(state),
    setSpeed(factor) {
      loop.setSpeed(factor)
      // Die Simulation bekommt bei x4 viermal so viele Takte je echter Sekunde. Optische
      // Effekte messen in Simulationszeit und brauchen den Faktor, um gleich lange zu
      // dauern und gleich haeufig zu erscheinen (GDD 13 Abschnitt 10).
      state.runtime.speedFactor = factor
      emit('loop.speedChanged', { factor })
    },
    buffLines: () => preferences.buffLines,
    setBuffLines(on) {
      preferences.buffLines = on
      remember()
    },
    effects: () => preferences.effects,
    setEffects(on) {
      preferences.effects = on
      applyEffects(targets.app, on)
      remember()
    },
    motion: () => preferences.motion,
    setMotion(on) {
      preferences.motion = on
      applyMotion(targets.app, on)
      remember()
    },
    busLevel: (bus) => preferences.mix[bus],
    setBusLevel(bus, value) {
      preferences.mix = { ...preferences.mix, [bus]: value }
      audio.setLevel(bus, value)
      remember()
    },
    resetHints: () => resetHints(state),
    resetCamera: () => resetAuto(camera),
    // Knapp unter 1: Das Bild tritt einen Wimpernschlag zurueck und kommt von selbst
    // wieder. Mehr waere ein Zoom, weniger waere nicht zu sehen.
    nudgeCamera: () => pulseZoom(camera, 0.97),
  }

  const shell = mountShell(state, targets, controls)
  // Der freie Platz in der Faehigkeitenschiene fuehrt dorthin, wo belegt wird. Den Weg
  // kennt die Huelle, nicht das HUD - deshalb wird er hier gereicht.
  const hud = mountHud(
    state,
    {
      overlay: targets.overlay,
      manageAbilities: () => shell.goTo('upgrades'),
      openSettings: () => shell.goTo('settings'),
    },
    controls,
  )
  const hints = mountHints(state, targets.overlay)
  // Der Weg der Muenze endet erst im Goldschild, nicht unter dem Zeiger. Ziel und Einschlag
  // werden beide gereicht statt gesucht - siehe `Hud.goldTarget` und `Hud.goldArrived`.
  mountCoinFlight(
    targets.overlay,
    hud.goldTarget,
    canvas.parentElement ?? targets.overlay,
    hud.goldArrived,
  )
  // Hängt sich an `prestige.done` und tut sonst nichts - wie der Klang ein Anschluss,
  // kein Einbau.
  mountSurge(targets.overlay)
  // Dasselbe für den Ausgang einer Welle: VICTORY oder DEFEAT, groß in der Mitte. Ob sich
  // der Schriftzug schreibt, fragt er selbst am Stilblatt nach (`--motion`) - so hört er
  // auch auf die Einstellung des Betriebssystems und nicht nur auf den Schalter im Spiel.
  mountOutcome(targets.overlay)

  // Seit es das echte HUD gibt, ist die Entwickleranzeige nur noch auf Anforderung da -
  // im normalen Bild hat sie nichts verloren.
  const debug = new URLSearchParams(location.search).has('debug')
  const devbar = createDevbar(targets.overlay, debug)

  // Der Kampf beginnt sofort. Die Wellensteuerung - Auto-Modus, vor und zurueck -
  // kommt in E9; bis dahin folgt auf jede geschaffte Welle nach kurzer Pause die naechste.
  syncStation(state, stationView(state).modules, stationView(state).buffs)
  startWave(state, state.run.wave)

  let viewWidth = 0
  let viewHeight = 0

  const resize = (): void => {
    // Das Canvas bekommt echte Geraetepixel, gezeichnet wird trotzdem in CSS-Pixeln.
    // Deshalb verzieht eine Groessenaenderung nichts - sie aendert nur den Ausschnitt.
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    viewWidth = canvas.clientWidth
    viewHeight = canvas.clientHeight
    canvas.width = Math.round(viewWidth * ratio)
    canvas.height = Math.round(viewHeight * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  // Das Feld aendert seine Hoehe auch ohne Fensteraenderung: In der Basis entfallen
  // Statuskarten und Upgrade-Panel, die untere Leiste wird flacher. Ohne diese Beobachtung
  // behielte das Canvas seine alte Aufloesung und das Bild wuerde verzogen.
  new ResizeObserver(resize).observe(canvas)

  const input = attachInput({
    canvas,
    state,
    camera,
    size: () => ({ width: viewWidth, height: viewHeight }),
    onChange: () => shell.refresh(),
  })

  // Bauen ist Fortschritt - er wird sofort gesichert, nicht erst beim naechsten Takt
  // (GDD 16 Abschnitt 8).
  for (const event of ['module.placed', 'module.moved', 'module.removed'] as const) {
    on(event, () => autosave.saveNow())
  }

  // Dieselben Schalter wie im Bereich "Einstellungen" - nur schneller erreichbar. Und
  // deshalb auch **denselben** Freischaltungen unterworfen: Eine Tastenkuerzel-Abkuerzung
  // um den Prestige-Baum herum waere eine Luecke, keine Bequemlichkeit.
  window.addEventListener('keydown', (event) => {
    const factor = Number(event.key)
    if ((controls.speeds() as readonly number[]).includes(factor)) {
      controls.setSpeed(factor as SpeedFactor)
      return
    }
    if (event.key === 'b' || event.key === 'B') controls.setBuffLines(!controls.buffLines())
    if (event.key === 'm' || event.key === 'M') toggleMute(controls)
    if (event.key === 'f' || event.key === 'F') controls.resetCamera()
    if (event.key === '+') zoomBy(camera, 1.15)
    if (event.key === '-') zoomBy(camera, 1 / 1.15)
  })

  // Gespielte Zeit ist eine Aussage ueber den Spieler, nicht ueber die Simulation:
  // sie zaehlt echte Sekunden. Bei x4 vergehen je Tick nur ein Viertel davon.
  let untracked = 0
  /** Echte Sekunden seit dem Start - Grundlage aller rein optischen Bewegungen. */
  let viewTime = 0

  loop.start(
    (dt) => {
      untracked += dt / loop.getSpeed()
      if (untracked >= 1) {
        const whole = Math.floor(untracked)
        state.permanent.totalPlaySeconds += whole
        untracked -= whole
        markDirty(state)
      }

      // Die abgeleitete Sicht ist gepuffert - dieser Aufruf kostet nur dann etwas,
      // wenn der Spieler seit dem letzten Tick gebaut hat.
      const view = stationView(state)
      syncStation(state, view.modules, view.buffs)
      stepBattle(state, dt)

      autosave.tick()
    },
    (_alpha, frameSeconds) => {
      // Alles rein Optische rechnet mit echter Zeit, nicht mit Simulationszeit: Die
      // Kamera faehrt bei x4 gleich weich, das Leuchten pulsiert gleich schnell.
      viewTime += frameSeconds
      renderScene(context, state, camera, viewWidth, viewHeight, viewTime, {
        pointer: input.pointer(),
        showBuffLines: preferences.buffLines,
        showEffects: preferences.effects,
      })
      stepCamera(camera, frameSeconds)
      hud.update(frameSeconds)
      shell.update(viewTime)
      hints.update()

      devbar.update(
        `<b>${t('game.title')}</b>  ${loop.tickRate} Hz\n` +
          `Speed   <b>x${loop.getSpeed()}</b>\n` +
          `Ticks   ${formatNumber(loop.tickCount())}\n` +
          `Sim     ${formatDuration(loop.now())}\n` +
          `Bilder  ${loop.fps().toFixed(0)}/s\n` +
          `Zoom    ${viewZoom(camera).toFixed(2)}${camera.manual ? ' (manuell)' : ''}\n` +
          `<span class="hint">Linksklick setzt · Ziehen setzt um · Rechtsklick entfernt</span>\n` +
          `<span class="hint">1/2/4 Tempo · B Buff-Linien · +/- Zoom · F Auto · ?selftest</span>`,
      )
    },
  )

  // Das Canvas loest kein Nachladen einer Schrift aus - es zeichnet mit dem, was da ist.
  // Ohne diesen Anstoss traegt der erste Muenzstapel die Ersatzschrift, bis das DOM die
  // Pixelschrift geholt hat. Fehlt die Schnittstelle, bleibt es bei der Ersatzschrift.
  //
  // Der Fehlschlag wird **abgefangen**: Liegt die Schriftdatei nicht vor, meldet der Browser
  // einen Netzfehler, und ein unbehandeltes Versprechen faerbt die Entwicklerkonsole rot -
  // bei jedem Start und ohne dass irgendetwas kaputt waere. Eine fehlende Schrift ist ein
  // hinnehmbarer Zustand, genau wie ein fehlendes Geraeusch (`app/audio.ts`).
  void document.fonts?.load(`16px ${THEME.numberFont.split(',')[0]}`).catch(() => {})

  // Erster Bildaufbau ohne Fahrt: die Station steht sofort richtig im Bild.
  invalidateStationView(state)
  renderScene(context, state, camera, viewWidth, viewHeight, 0)
  snapToTarget(camera)

  // Entwicklerzugang, nur mit ?debug in der Adresszeile. Damit lassen sich Kamera und
  // Zustand von aussen betrachten, ohne dass das laufende Spiel etwas davon mitbekommt.
  if (new URLSearchParams(location.search).has('debug')) {
    ;(window as unknown as Record<string, unknown>)['wavebreaker'] = {
      state,
      camera,
      loop,
      // Nur wegen `musicVoices()`: Ob mit Musik auf null wirklich nichts mehr laeuft, muss
      // sich am **laufenden Spiel** nachsehen lassen und nicht nur an einer Messseite
      // (`public/musikmessung.html`).
      audio,
      shell,
      hud,
      size: () => ({ width: viewWidth, height: viewHeight }),
    }
  }
}

/**
 * Die Bewegungsdaempfung an das Stilblatt weiterreichen.
 *
 * Ein einziges Merkmal am Wurzelknoten, an dem alle Uebergaenge haengen - dieselbe Bauart
 * wie bei `data-view`. Die Alternative waere, in jeder Regel eine Bedingung zu fuehren, und
 * dann bliebe irgendwo eine Bewegung stehen.
 */
function applyMotion(app: HTMLElement, on: boolean): void {
  if (on) delete app.dataset['motion']
  else app.dataset['motion'] = 'off'
}

/**
 * Die Effektstufe ebenfalls an das Stilblatt weiterreichen (`#app::before`, `src/style.css`).
 *
 * Der Schalter steuerte bisher nur, was das Canvas zeichnet - Splitter, Druckwellen,
 * Glanzschleier, Rasterzeilen (`showEffects` unten in der Zeichenschleife). Der
 * Roehrenfilter liegt aber ueber dem **ganzen** Bild und damit auch ueber der Bedienleiste,
 * und die kennt kein Canvas. Er haengt deshalb an einem Merkmal am Wurzelknoten, genau wie
 * die Bewegungsdaempfung.
 *
 * Zwei Wege fuer eine Einstellung, und das ist kein Bruch: Der Schalter sagt "keine
 * Zierde", und beide Wege setzen dasselbe um - jeder dort, wo er zustaendig ist.
 */
function applyEffects(app: HTMLElement, on: boolean): void {
  if (on) delete app.dataset['effects']
  else app.dataset['effects'] = 'off'
}

/**
 * Wie lange der Spieler weg war, in Sekunden.
 *
 * Der Zeitstempel kommt aus dem Spielstand - er ist die einzige Spur, die eine geschlossene
 * Seite hinterlaesst. Ohne Spielstand (erster Start) gibt es keine Abwesenheit; eine Uhr,
 * die rueckwaerts gelaufen ist, ergibt ebenfalls keine (Zeitumstellung, manipulierte
 * Systemzeit).
 */
function secondsAway(loaded: unknown, nowMs: number): number {
  if (loaded === null) return 0
  const savedAt = lastSavedAt()
  if (savedAt === null) return 0
  return Math.max(0, (nowMs - savedAt) / 1000)
}

function createDevbar(root: HTMLElement, enabled: boolean): { update(html: string): void } {
  if (!enabled) return { update() {} }

  const element = document.createElement('pre')
  element.className = 'devbar'
  root.appendChild(element)

  let last = ''
  let frames = 0
  return {
    update(html) {
      // Nur jedes 15. Bild neu setzen - die Anzeige darf die Messung nicht stoeren.
      frames += 1
      if (frames % 15 !== 0) return
      if (html === last) return
      last = html
      element.innerHTML = html
    },
  }
}

// ---------------------------------------------------------------------------
// Selbsttests
// ---------------------------------------------------------------------------

function showSelfTestReport(canvas: HTMLCanvasElement, root: HTMLElement): void {
  canvas.style.display = 'none'

  const summary = summarize(runSelfTests())
  const report = document.createElement('div')
  report.className = 'report'

  const parts: string[] = [
    `<h1>${t('game.title')} · Selbsttests</h1>`,
    `<div class="summary ${summary.ok ? 'ok' : 'fail'}">` +
      `${summary.passed}/${summary.total} bestanden` +
      (summary.failed > 0 ? ` · ${summary.failed} fehlgeschlagen` : '') +
      `</div>`,
  ]

  let currentSuite = ''
  for (const result of summary.results) {
    if (result.suite !== currentSuite) {
      if (currentSuite !== '') parts.push('</ul>')
      currentSuite = result.suite
      parts.push(`<h2>${escapeHtml(currentSuite)}</h2><ul>`)
    }
    parts.push(`<li class="${result.ok ? 'ok' : 'fail'}">${escapeHtml(result.name)}</li>`)
    if (!result.ok && result.message) parts.push(`<pre>${escapeHtml(result.message)}</pre>`)
  }
  if (currentSuite !== '') parts.push('</ul>')

  report.innerHTML = parts.join('')
  root.appendChild(report)

  document.title = `${summary.ok ? 'OK' : 'FEHLER'} · Selbsttests`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char)
}
