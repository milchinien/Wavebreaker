/**
 * Alle laufenden Zahlen der Oberflaeche (GDD 13 Abschnitt 4).
 *
 * Verteilt auf mehrere Stellen, aber bewusst in **einer** Datei: Sie alle lesen denselben
 * Zustand und muessen im selben Bild dasselbe zeigen.
 *
 *   Goldschild    oben links ueber dem Feld - Gold und liegendes Gold
 *   Wellenkarte   oben rechts - Welle, Wellenwerte, Fortschritt, Wellensteuerung
 *   Boss-Leiste   oben mittig, nur solange ein Boss lebt (GDD 07 Abschnitt 7)
 *   Rumpfleiste   unten, direkt ueber der Bedienleiste - Stations-HP samt Kampfwerten
 *   Tempo         unten links im Feld
 *   Wellenkarte der Basis  oben rechts, wo kein Kampf zu sehen ist
 *
 * **Alles schwebt ueber dem Feld, nichts steht mehr in der unteren Leiste.** Vorher trugen
 * zwei grosse Karten in der Leiste dieselben Zahlen; zusammen mit dem Upgrade-Panel nahm
 * die Leiste damit 44 Prozent der Bildhoehe ein, und vom Spielfeld blieb ein Streifen. Die
 * Zahlen sind jetzt duenne Schilder ueber dem Feld - sie verdecken ein paar Prozent statt
 * die Haelfte, und die Leiste traegt nur noch das, was man anfasst.
 *
 * **Eine** Lebensleiste fuer die gesamte Station, keine HP je Modul (GDD 03 Abschnitt 5).
 * Das ist keine Vereinfachung der Anzeige, sondern die Spielregel: Module koennen nicht
 * zerstoert werden, und der Schaden geht immer auf dieselbe Leiste.
 *
 * Geschrieben wird nur, wenn sich etwas geaendert hat - die Signatur unten vergleicht alles
 * Sichtbare auf einmal. Ohne sie schriebe jedes Bild dieselben Zeichenketten neu.
 */

import { on } from '../core/events.ts'
import { asset } from '../app/assets.ts'
import { formatNumber } from '../core/format.ts'
import type { SpeedFactor } from '../core/loop.ts'
import { WAVE_PAUSE_SECONDS } from '../data/balance.ts'
import { t } from '../data/strings.ts'
import {
  fireAbility,
  goToNextLeague,
  goToNextWave,
  goToPreviousLeague,
  goToPreviousWave,
  toggleAutoWaves,
} from '../app/actions.ts'
import { waveRecord, type GameState } from '../app/state.ts'
import { enemyById } from '../data/enemies.ts'
import { leagueByIndex } from '../data/leagues.ts'
import { LEAGUE_TINT } from '../render/theme.ts'
import { activeBoss } from '../sim/enemies.ts'
import { cooldownLeft, equippedAbilities, slotCount } from '../sim/abilities.ts'
import { goldOnField } from '../sim/economy.ts'
import { levelProgress } from '../sim/progression.ts'
import { CORE_UID } from '../sim/station.ts'
import { effectiveTowerStats, globalMultiplier } from '../sim/stats.ts'
import { canEnterLeague, canSkipTo, isBossWave, upcomingWave } from '../sim/waves.ts'
import { abilityIcon, icon, type IconName } from './icons.ts'
import type { SettingsControls } from './settings.ts'
import { setSlideLabel } from './slide.ts'
import { describe } from './tooltip.ts'
import { createTypewriter } from './typewriter.ts'

/**
 * Takt und Vorlauf des Wellen-Schriftzugs (siehe die Erklaerung bei `bannerWriter`).
 *
 * Beide Zahlen haengen an `@keyframes wave-banner` im Stilblatt und muessen mit ihm
 * zusammen wandern: Der Vorlauf ist die Zeit, bis die Unschaerfe weg ist, und die laengste
 * Meldung ("Wave 999 lost — try 12", 22 Zeichen) muss stehen, bevor das Verblassen anfaengt.
 * Bei 1800 ms Gesamtdauer sind das 234 ms bis scharf und 1296 ms bis zum Verblassen.
 *
 * Der Takt ist mit Absicht **schneller als noetig** gewaehlt, und zwar weil die beiden
 * Fehler nicht gleich viel kosten: Ein Anschlag, der zu frueh fertig ist, laesst den
 * Schriftzug nur laenger stehen - das faellt niemandem auf. Einer, der zu spaet fertig ist,
 * schreibt noch, waehrend der Schriftzug schon verblasst, und die Meldung ist nie
 * vollstaendig zu lesen gewesen.
 *
 * Rechnen laesst sich das nur ungefaehr: Auf dem Papier ergibt die Streuung im Mittel gut
 * einen Grundtakt je Zeichen, aber `setTimeout` wird neben Schleife und Bild nicht auf die
 * Millisekunde aufgerufen, und wie weit es sich streckt, haengt am Geraet. Nachgemessen
 * unter Last waren es rund anderthalb Grundtakte. 28 ms traegt die laengste Meldung auch
 * dann noch rechtzeitig ins Ziel; bei 34 ms war sie erst nach dem Beginn des Verblassens da.
 */
const BANNER_TYPE_MS = 28
const BANNER_LEAD_MS = 240

/**
 * Name der Schlussbewegung der Goldzahl (`style.css`).
 *
 * Er steht hier, weil die Zahl **zwei** Bewegungen kennt: das endlose Glaenzen waehrend des
 * Hochlaufens und diesen einen Schlag, wenn sie steht. `animationend` meldet nur die
 * zweite - die erste laeuft endlos und meldet nie ein Ende -, aber gemeldet wird der Name,
 * und ohne den Vergleich raeumte irgendeine kuenftige dritte Bewegung die Klasse weg.
 */
const GOLD_SETTLE = 'gold-settle'

export type HudTargets = {
  /** Schwebende Anzeigen ueber dem Spielfeld. Die einzige Ebene, die das HUD benutzt. */
  overlay: HTMLElement
  /**
   * In den Bereich wechseln, in dem Faehigkeiten belegt werden - daran haengt der freie
   * Platz in der Faehigkeitenschiene.
   *
   * Als Rueckruf und nicht als `setView`-Aufruf: Ein Bereichswechsel ist hier eine
   * **Bewegung** (siehe `ui/shell.ts`), und wer nur den Zustand umsetzt, bekommt weder die
   * Wanderung der Panels noch das neu gesetzte `data-view`. Das HUD kennt den Weg dorthin
   * nicht - es sagt nur, dass es dorthin will.
   */
  manageAbilities(): void
  /**
   * In die Einstellungen wechseln - aus demselben Grund ein Rueckruf wie oben.
   *
   * Sie sind mit dem Umbau der Navileiste (E5) hierher gewandert: Sechs Reiter tragen jetzt
   * Bereiche und Upgrade-Fenster, und ein siebter fuer etwas, das man waehrend des Spiels
   * nie braucht, waere der schlechteste Platz der ganzen Leiste. In der Ressourcenzeile
   * steht das Zahnrad dagegen in **jedem** Bereich an derselben Stelle.
   */
  openSettings(): void
}

export type Hud = {
  /**
   * Pro Bild aufrufen - schreibt nur, wenn sich etwas geaendert hat. `frameSeconds` ist
   * echte Zeit, keine Simulationszeit: Bei Tempo x4 laufen die Zahlen gleich schnell hoch.
   */
  update(frameSeconds: number): void
  /**
   * Das Muenzsymbol im Goldschild - das Ziel der eingesammelten Muenzen (`ui/coinflight.ts`).
   *
   * Es wird herausgereicht statt gesucht: Wo dieser Knoten steht, weiss diese Datei, und ein
   * Waehler von aussen wuerde beim naechsten Umbau des Schilds stillschweigend ins Leere
   * greifen - die Muenzen floegen dann irgendwohin, ohne dass etwas kaputt aussieht.
   */
  goldTarget: HTMLElement
  /**
   * Eine Muenze ist im Goldschild angekommen (`ui/coinflight.ts` ruft es beim Einschlag).
   *
   * Der Stupser der Zeile hing frueher an `gold.collected`, also am **Aufheben**. Zwischen
   * Aufheben und Ankunft liegen aber gut acht Zehntelsekunden: Uebergabe an die Flugebene,
   * dann der Flug selbst. Die Zeile quittierte damit etwas, das noch unterwegs war - und
   * war ausgerechnet dann still, wenn die Muenze wirklich einschlug.
   *
   * Wann etwas ankommt, weiss nur die Flugebene; was die Anzeige daraufhin tut, nur diese
   * Datei. Deshalb der Rueckruf und kein Ereignis.
   */
  goldArrived(): void
  detach(): void
}

export function mountHud(state: GameState, targets: HudTargets, controls: SettingsControls): Hud {
  const { overlay, manageAbilities } = targets

  /*
   * --- Ressourcenzeile, oben in der Mitte ---
   *
   * **Eine** Pille aus drei Segmenten, und sie steht in **allen fuenf** Bereichen an
   * derselben Stelle. Das ist der ganze Punkt dieser Anzeige: Vorher war das Gold nur im
   * Kampf und in den Upgrades zu sehen, die Prestigepunkte nur in ihrem eigenen Panel - wer
   * kaufen wollte, verliess den Bereich, in dem der Kontostand stand. Eine Waehrung, die
   * beim Blick auf den Laden verschwindet, ist keine Waehrung, sondern eine Erinnerung.
   *
   * Drei Regeln halten die Zeile zusammen, und alle drei stehen im Stilblatt:
   *
   *   - Sie haengt an **keinem** `[data-view]`. Es gibt keine Regel, die sie ein- oder
   *     ausschaltet; sie ist immer da. Jede Ueberlagerung ersetzt nur die Flaeche darunter.
   *   - Je Segment nur **Zeichen und Zahl**, kein Wort. Was die Zahl bedeutet, sagt das
   *     Piktogramm - drei Woerter nebeneinander waeren eine Zeile Text und kein Instrument.
   *   - Jede Ressource traegt ihre **eigene** Farbe (`--res-*` im Stilblatt). Man liest die
   *     Zahl, die man sucht, an der Farbe, bevor man das Zeichen daneben ansieht.
   *
   * Die Reihenfolge ist die des Fortschritts: Stufe (was der Run aus dem Spieler gemacht
   * hat), Gold (was er gerade ausgeben kann), Prestige (was den Run ueberlebt).
   */
  const resources = div('plate', 'resource-bar')
  const level = figure('upgrade', 18, 'res', 'level')
  const gold = figure('coin', 18, 'res', 'gold')
  const prestige = figure('crosshair', 18, 'res', 'prestige')
  gold.node.setAttribute('aria-label', t('hud.gold'))
  prestige.node.setAttribute('aria-label', t('prestige.points'))
  describe(prestige.node, t('prestige.points'))

  /*
   * Die Erfahrung steht **nicht** mehr in dieser Zeile.
   *
   * Sie lief hier als zwei Pixel hohe Linie unter der Stufenzahl mit - kein zweites Segment
   * und keine zweite Zahl, und das war richtig gedacht: Sie ist Auskunft und keine
   * Aufforderung. Nur war sie als Linie unter einer Zahl schlicht zu klein, um im Augenwinkel
   * gelesen zu werden; der Aufstieg kam damit jedes Mal aus dem Nichts. Sie steigt jetzt als
   * Flaeche hinter dem Kern in der unteren Leiste (`ui/coregauge.ts`) - dort hat sie Platz,
   * und sie sagt nebenbei, wem der Fortschritt gehoert.
   *
   * Was hier bleibt, ist die **Zahl** der Stufe und ihr Hinweis mit dem genauen Stand: Die
   * Zeile ist die Ablesung des Fortschritts, und die Stufe ist sein Ergebnis.
   */

  /*
   * Das Zahnrad ganz rechts in der Pille.
   *
   * Es steht bewusst **hinter** den drei Zahlen: Die Reihenfolge der Zeile ist die des
   * Fortschritts (Stufe, Gold, Prestige), und die Einstellungen sind kein Fortschritt. Sie
   * sind das, was man einmal sucht und dann nie wieder - und genau dafuer ist der Platz am
   * Rand richtig.
   */
  const settings = document.createElement('button')
  settings.type = 'button'
  settings.className = 'res res-settings'
  settings.setAttribute('aria-label', t('view.settings'))
  settings.innerHTML = icon('gear', 18)
  describe(settings, `<b>${t('view.settings')}</b><br>${t('view.settings.about')}`)
  settings.addEventListener('click', () => targets.openSettings())

  resources.append(level.node, gold.node, prestige.node, settings)

  // --- Boss, oben mittig ---
  // Name, aktuelle und maximale HP (GDD 13 Abschnitt 4). Die Marke sagt, *dass* es ein
  // Boss ist, der Name sagt, *welcher* - beides braucht es, sobald es mehrere gibt (E15).
  const bossBar = div('boss-bar')
  bossBar.hidden = true
  const bossTag = document.createElement('span')
  bossTag.className = 'tag'
  bossTag.textContent = t('hud.boss')
  const bossName = document.createElement('span')
  bossName.className = 'name'
  const bossOuter = div('boss-hp')
  const bossFill = document.createElement('i')
  const bossText = document.createElement('span')
  bossOuter.append(bossFill, bossText)
  bossBar.append(bossTag, bossName, bossOuter)

  // --- Tempo, unten links im Feld ---
  const speedBar = div('speed-control')
  const slower = stepButton('-', t('settings.speed'), () => stepSpeed(-1))
  const speedValue = document.createElement('span')
  speedValue.className = 'speed-value'
  const faster = stepButton('+', t('settings.speed'), () => stepSpeed(1))
  speedBar.append(slower, speedValue, faster)

  // --- Wellenwechsel, gross ueber dem Feld ---
  const banner = div('wave-banner')

  /*
   * --- Wellenkarte, oben rechts ---
   *
   * Alles zur Welle in einem Schild: wie weit sie ist, wie hart sie zuschlaegt, und die
   * drei Knoepfe, mit denen man sie steuert. Vorher lag dieselbe Auskunft als breite Karte
   * unten in der Leiste, weit weg von allem anderen, was oben stand.
   */
  const waveCard = div('plate', 'wave-card')

  /*
   * Die Ligazeile - die **zweite Achse derselben Steuerung** (docs/liga-system.md §6.1).
   *
   * Sie steht in derselben Karte wie die Welle und nicht in einer eigenen: Beide Achsen
   * beantworten dieselbe Frage ("wo spiele ich gerade"), und zwei Karten uebereinander
   * behaupteten zwei Themen, wo eines ist. Oben die Liga, darunter die Welle - grob nach
   * fein, wie auf jeder Landkarte.
   *
   * **Sie erscheint erst, wenn es etwas zu wechseln gibt.** Vor der ersten Freischaltung
   * waere sie eine Zeile mit zwei toten Pfeilen um einen Namen, den niemand gewaehlt hat -
   * dieselbe Ueberlegung wie beim Sprunggriff der Wellennummer, der bei Rekord 1 verschwindet
   * (GDD 14 Abschnitt 4a: nichts steht da, bevor es gebraucht wird).
   */
  const leagueRow = div('league-row')
  const leagueDown = iconButton('prev', t('hud.prevLeague'), () => goToPreviousLeague(state))
  const leagueName = document.createElement('span')
  leagueName.className = 'league-name'
  const leagueRank = document.createElement('span')
  leagueRank.className = 'league-rank'
  const leagueUp = iconButton('next', t('hud.nextLeague'), () => goToNextLeague(state))
  leagueRow.append(leagueDown, leagueName, leagueRank, leagueUp)

  const waveHead = div('head')
  /*
   * Die Wellennummer ist eine **Anzeige** und kein Griff.
   *
   * Sie war einmal eine Schaltflaeche, die eine Sprungzeile mit Zahlenfeld aufklappte. Das
   * Feld war das einzige Eingabefeld der ganzen Oberflaeche - eine Formularzeile mitten in
   * einem Geraet, das sonst nur aus Knoepfen besteht -, und es stand fuer eine Handlung, die
   * die beiden Pfeile darunter ohnehin erledigen. Was bleibt, ist die Zahl.
   */
  const waveLabel = document.createElement('span')
  waveLabel.className = 'wave-label'
  const scales = div('scales', 'enemy')
  const waveDamage = figure('damage', 18, 'fig')
  const waveHp = figure('hull', 18, 'fig')
  describe(waveDamage.node, t('status.waveDamage'))
  describe(waveHp.node, t('status.waveHp'))
  scales.append(waveDamage.node, waveHp.node)
  waveHead.append(waveLabel, scales)

  const progress = bar('progress')

  const waveControls = div('wave-controls')
  const previous = iconButton('prev', t('hud.prevWave'), () => goToPreviousWave(state))
  const auto = stepButton(t('hud.auto'), t('hud.autoOn'), () => toggleAutoWaves(state))
  auto.classList.add('auto-button')
  const next = iconButton('next', t('hud.nextWave'), () => goToNextWave(state))
  waveControls.append(previous, auto, next)

  waveCard.append(leagueRow, waveHead, progress.node, waveControls)

  /*
   * --- Rumpfleiste, unten ueber der Bedienleiste ---
   *
   * Die eine Lebensleiste der Station, geklemmt zwischen Feld und Leiste, und links und
   * rechts davon die zwei Zahlen, an denen man ablesen soll, ob ein Upgrade etwas gebracht
   * hat: Schaden des Hauptturms und Goldfaktor.
   *
   * Sie sitzt dort, weil das die Kante zwischen "Spiel" und "Bedienung" ist: Man sieht sie
   * beim Blick nach unten auf die Upgrades, ohne dass sie ins Feld ragt.
   */
  const hullBar = div('hull-bar')
  const damage = figure('bullet', 16, 'fig')
  const goldFactor = figure('coin', 16, 'fig', 'gold')
  const hp = bar('hp')
  hullBar.append(damage.node, hp.node, goldFactor.node)

  /*
   * --- Faehigkeitenschiene, links am Feld (GDD 13 Abschnitt 4) ---
   *
   * Sie steht senkrecht an der linken Kante, mittig auf der Hoehe der Station. Vorher lag
   * sie als flache Reihe unten rechts, und dort war sie die meiste Zeit **gar nicht zu
   * sehen**: Wer noch nichts belegt hatte, sah eine leere Ecke und erfuhr nie, dass es
   * Faehigkeiten gibt. Links hat sie eine eigene Flaeche, die auch dann etwas sagt, wenn
   * noch nichts darin liegt.
   *
   * Deshalb zeigt sie jetzt **jeden** Slot, den der Run hat, nicht nur die belegten: Ein
   * leerer Platz ist hier keine Luecke, sondern die Einladung, einen zu fuellen - ein Klick
   * darauf wechselt in den Upgrades-Bereich, wo belegt wird. Genau das war vorher der
   * Einwand gegen Platzhalter, und er faellt weg, sobald der Platzhalter etwas tut.
   *
   * Die Knoepfe entstehen nur neu, wenn sich Belegung oder Slotzahl aendern; Abklingzeit und
   * Bereitschaft werden in jedem Bild nur **beschrieben**. Sonst spraenge der Zeiger bei
   * jedem Bild von einer neuen Schaltflaeche.
   */
  const abilityRail = document.createElement('aside')
  abilityRail.className = 'ability-rail'
  abilityRail.setAttribute('aria-label', t('abilities.title'))

  // Kopfzierde: Leiterbahnen und das Kuerzel darunter. Sie sagt nichts, was man lesen muss -
  // sie sagt, dass diese Flaeche zur Maschine gehoert und nicht ins Feld gefallen ist.
  const railHead = div('rail-head')
  railHead.innerHTML =
    `<i class="pix trace" style="--icon:url('${asset('ui/circuit.svg')}')"></i>` +
    `<b>${t('abilities.short')}</b>`
  const railSlots = div('rail-slots')
  abilityRail.append(railHead, railSlots)

  type AbilitySlot = {
    id: string
    /** Volle Abklingzeit - der Nenner des Schleiers. */
    cooldown: number
    node: HTMLButtonElement
    sweep: HTMLElement
    left: HTMLElement
  }
  let abilitySlots: AbilitySlot[] = []
  let abilitySignature = ''

  function buildAbilityRail(): void {
    const equipped = equippedAbilities(state)
    const total = slotCount(state)
    const signature = `${equipped.map((ability) => ability.id).join(',')}|${total}`
    if (signature === abilitySignature) return
    abilitySignature = signature

    abilitySlots = []
    railSlots.replaceChildren()

    for (const ability of equipped) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ability-slot filled'
      button.style.setProperty('--accent', ability.accent)
      button.setAttribute('aria-label', ability.name)
      // Name UND Wirkung: Auf dem Platz steht nur ein Zeichen, und ein Name allein sagt
      // nicht, was der Druck darauf ausloest.
      describe(button, `<b>${ability.name}</b><br>${ability.description}`)

      // Der Schleier laeuft von unten leer, waehrend die Abklingzeit ablaeuft - man liest
      // die Bereitschaft am Fuellstand, ohne die Zahl zu lesen.
      const sweep = document.createElement('i')
      sweep.className = 'sweep'
      const left = document.createElement('span')
      left.className = 'left'

      const symbol = document.createElement('span')
      symbol.className = 'symbol'
      symbol.innerHTML = icon(abilityIcon(ability.id), 24)

      button.append(sweep, symbol, left)
      button.addEventListener('click', () => {
        if (fireAbility(state, ability.id)) restart(button, 'fired')
      })
      button.addEventListener('animationend', () => button.classList.remove('fired'))

      railSlots.appendChild(button)
      abilitySlots.push({ id: ability.id, cooldown: ability.cooldown, node: button, sweep, left })
    }

    // Die freien Plaetze. Sie fuehren dorthin, wo sie gefuellt werden - ein Platzhalter,
    // der nur dasteht, waere genau der Kranz grauer Kaesten, den es hier nicht geben soll.
    for (let index = equipped.length; index < total; index += 1) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ability-slot empty'
      button.setAttribute('aria-label', t('abilities.empty'))
      describe(button, t('abilities.empty'))
      button.addEventListener('click', () => manageAbilities())
      railSlots.appendChild(button)
    }
  }

  // --- Wellenkarte der Basis, oben rechts ---
  // Sie traegt auch die Stations-HP: Der Kampf laeuft in der Basis weiter (GDD 02), und
  // wer dort baut, soll nicht erst beim Zurueckwechseln merken, dass die Station faellt.
  //
  // Das Gold stand hier frueher ein zweites Mal. Seit die Ressourcenzeile in **jedem**
  // Bereich steht, waere das derselbe Kontostand zweimal im selben Bild - in zwei Groessen
  // und zwei Farben. Zwei Anzeigen derselben Zahl sind eine Anzeige zu viel.
  const metaCard = div('panel', 'meta-card')
  const metaWave = metaRow(metaCard, t('hud.waveShort'))
  const metaHp = bar('hp')
  describe(metaHp.node, t('status.stationHp'))
  metaCard.appendChild(metaHp.node)

  overlay.append(resources, waveCard, bossBar, speedBar, banner, hullBar, abilityRail, metaCard)

  function stepSpeed(direction: number): void {
    // Nur die freigeschalteten Stufen - der Knopf soll nichts anbieten, was der Prestige-
    // Baum noch nicht hergibt (GDD 10, Bereich 2b).
    const available = controls.speeds()
    const index = available.indexOf(controls.speed())
    const target = available[Math.min(available.length - 1, Math.max(0, index + direction))]
    if (target !== undefined) controls.setSpeed(target as SpeedFactor)
  }

  /*
   * Der Stupser der Goldzeile - jetzt am Einschlag statt am Aufheben.
   *
   * Er haengt an keinem Ereignis mehr, sondern an `goldArrived` weiter unten: `gold.collected`
   * meldet den Augenblick, in dem der Spieler die Muenze **anfasst**, und der liegt gut eine
   * halbe Sekunde vor dem, in dem sie oben ankommt. Die Klasse raeumt das Ende der Bewegung
   * selbst weg - schnelles Nachsammeln stoesst sie neu an.
   */
  gold.node.addEventListener('animationend', (event) => {
    // Nur die eigene Bewegung, nicht die der Zahl darin: Bewegungsereignisse blubbern
    // herauf, und der Schlusschlag der Ziffern (`gold-settle`) naehme dem Segment sonst
    // mitten im Puls seine Klasse - dieselbe Falle wie beim Cursor im Schriftzug.
    if (event.target === gold.node) gold.node.classList.remove('pulse')
  })
  gold.value.addEventListener('animationend', (event) => {
    if (event.animationName === GOLD_SETTLE) gold.value.classList.remove('settled')
  })

  // Die Lebensleiste zuckt mit dem Kern - derselbe Treffer, ueberall wo er ablesbar ist.
  const stopHitPulse = on('station.damaged', () => {
    restart(hp.node, 'hit')
    restart(metaHp.node, 'hit')
  })
  for (const node of [hp.node, metaHp.node]) {
    node.addEventListener('animationend', () => node.classList.remove('hit'))
  }

  /*
   * Der Schriftzug ueber dem Feld benennt jede Zaesur einmal und geht von selbst wieder -
   * kein Hinweisfenster (GDD 13 Abschnitt 12).
   *
   * `announced` haelt die zuletzt angesagte Welle fest. Ein verlorener Anlauf startet
   * dieselbe Welle sofort neu, und ohne diese Sperre uebermalte die Ansage "Wave 12" im
   * selben Augenblick die Meldung "Wave 12 lost" - ausgerechnet die wichtigere von beiden.
   *
   * Auch er **schreibt sich** (`ui/typewriter.ts`), aber im doppelten Takt und damit
   * spuerbar anders als alles andere. Das ist keine Laune, sondern hat zwei Gruende:
   *
   * **Sein Zeitfenster ist knapp.** Die Auftrittsbewegung im Stilblatt ist erst nach einem
   * Fuenftel scharf und faengt nach drei Vierteln an zu verblassen; dazwischen liegt alles,
   * was gelesen werden kann. Im Normaltakt braeuchte "Wave 12 lost — try 2" laenger als
   * dieses Fenster - der Schriftzug verbluehte mitten im Wort. Der Vorlauf wartet
   * ausserdem, bis die Unschaerfe weg ist: getippte Zeichen hinter einem Weichzeichner
   * liest niemand.
   *
   * **Er teilt sich die Zaesur mit dem Ausgang in der Feldmitte.** Bei einem verlorenen
   * Anlauf schreiben beide gleichzeitig. Zwei Anschlaege im selben Takt laesen sich wie ein
   * Stottern; zwei in verschiedenen Takten wie eine Maschine, die zwei Dinge meldet. Die
   * Rollenverteilung bleibt dabei die alte: Hier steht die Einzelheit, dort der Ausgang.
   */
  let announced = -1

  const bannerWriter = createTypewriter({ speed: BANNER_TYPE_MS, delay: BANNER_LEAD_MS })

  function announce(text: string): void {
    restart(banner, 'show')
    // Vergessen, was zuletzt stand: Sonst bliebe eine wiederholte Meldung stumm stehen.
    bannerWriter.reset()
    bannerWriter.write({ node: banner, text })
  }

  const stopBanner = on('wave.started', ({ wave }) => {
    if (wave === announced) return
    announced = wave
    banner.classList.toggle('boss', isBossWave(wave))
    banner.classList.remove('lost')
    announce(t('hud.wave', { wave }))
  })

  const stopLost = on('wave.lost', ({ wave, attempt }) => {
    announced = wave
    banner.classList.remove('boss')
    banner.classList.add('lost')
    announce(t('hud.waveLost', { wave, attempt }))
  })

  /*
   * Nur die Bewegung des Schriftzugs raeumt sich hier weg, nicht die des Cursors darin:
   * Der blinkt endlos und meldet deshalb nie ein Ende. Ein Ereignis, das aus dem Cursor
   * heraufblubberte, naehme dem Schriftzug mitten im Wort seine Klasse.
   */
  banner.addEventListener('animationend', (event) => {
    if (event.target === banner) banner.classList.remove('show')
  })

  // Zahlen, die auf ihren neuen Stand zulaufen. Gold springt sonst bei jedem Stapel um
  // Hunderte - man sieht dann, dass sich etwas geaendert hat, aber nicht wie viel.
  //
  // Das Gold laeuft **langsamer** zu als der Schaden (GOLD_CLIMB gegen den Vorgabewert):
  // Es ist die einzige Zahl, auf die etwas zufliegt, und sie soll noch laufen, waehrend die
  // Muenzen ankommen. Mit dem alten Tempo stand sie nach zwei Zehntelsekunden - also lange
  // bevor die erste Muenze da war -, und der Flug fuehrte sichtbar zu nichts.
  const goldCount = counter(gold.value, GOLD_CLIMB)
  const damageCount = counter(damage.value)

  /*
   * Ob die Goldzahl gerade laeuft. Der Zustand steht hier und nicht im Zaehler, weil er
   * **eine Flanke** ist: Die Klasse darf nur beim Wechsel gesetzt und genommen werden. Jedes
   * Bild `classList.toggle` aufzurufen hiesse, dem Browser jedes Bild dieselbe Aenderung zu
   * melden - und der Schlussschlag ("settled") ist ohne Flanke ueberhaupt nicht zu haben.
   */
  let goldClimbing = false

  let last = ''

  return {
    update(frameSeconds: number) {
      // Vor der Signaturpruefung: Die Zahlen laufen weiter, auch wenn sich sonst nichts regt.
      goldCount.step(frameSeconds)
      damageCount.step(frameSeconds)

      /*
       * Die Goldzahl sagt selbst an, dass sie laeuft: Solange sie steigt, glueht sie und
       * traegt einen Glanz, der ueber die Ziffern wandert (`style.css`); wenn sie steht,
       * schlaegt sie einmal zu und ist wieder ruhig.
       *
       * Das ist mehr als Zierde. Eine Zahl, die sich in Zehntelsekunden von 1.204 auf 1.337
       * bewegt, ist von einer, die dasteht, im Augenwinkel nicht zu unterscheiden - man
       * sieht **dass** sich etwas geaendert hat, sobald man hinschaut, aber nie, dass es
       * gerade jetzt geschieht. Der Zustand ist auch der einzige Weg, den Zuwachs aus
       * anderen Quellen sichtbar zu machen: Wellenlohn und Verkauf loesen keinen Muenzflug
       * aus, laufen aber durch denselben Zaehler.
       *
       * `restart` erzwingt eine Layoutberechnung und steht deshalb hinter der Flanke: Es
       * laeuft einmal je Zuwachs und nicht einmal je Bild.
       */
      const climbing = goldCount.climbing()
      if (climbing !== goldClimbing) {
        goldClimbing = climbing
        gold.value.classList.toggle('counting', climbing)
        if (!climbing) restart(gold.value, 'settled')
      }

      /*
       * Ebenfalls davor: Eine Abklingzeit aendert sich in **jedem** Takt. Sie in die
       * Signatur aufzunehmen hiesse, dass sich die Signatur immer unterscheidet - dann
       * schriebe das HUD jedes Bild alles neu, und die Pruefung waere sinnlos.
       */
      buildAbilityRail()
      for (const slot of abilitySlots) {
        const left = cooldownLeft(state, slot.id)
        const ready = left <= 0

        slot.node.classList.toggle('ready', ready)
        // Zuenden geht nur in der Kampfansicht (GDD 09 Abschnitt 7) - der Knopf sagt das,
        // indem er sich dort abschaltet, statt den Klick still zu verschlucken.
        slot.node.disabled = !ready || state.runtime.view !== 'combat'
        // Der Schleier steht fuer die **verbleibende** Zeit: voll direkt nach dem Zuenden,
        // leer wenn wieder bereit.
        slot.sweep.style.height = ready ? '0%' : `${Math.min(100, (left / slot.cooldown) * 100)}%`
        slot.left.textContent = ready ? '' : Math.ceil(left).toString()
      }

      const combat = state.runtime.combat
      const boss = activeBoss(state)
      const field = goldOnField(state)
      const plan = combat.plan
      /*
       * Der Boss steht **ausserhalb** des Wellenplans: `spawnBoss` setzt ihn zu Beginn
       * seiner Welle, `plan.spawns` kennt ihn nicht (GDD 07 Abschnitt 7). Ohne ihn im
       * Nenner meldete die Leiste "12 / 12", waehrend er noch quer ueber dem Feld stand.
       *
       * Gezaehlt wird `bossId`, nicht die Wellennummer: Ist die Obergrenze gleichzeitiger
       * Gegner erreicht, erscheint er nicht - dann darf er auch nicht mitzaehlen.
       */
      const total = (plan ? plan.spawns.length : 0) + (combat.bossId !== null ? 1 : 0)

      const progression = levelProgress(state)

      const signature = [
        state.run.wave,
        Math.round(combat.stationHp),
        Math.round(state.run.gold),
        Math.round(field),
        progression.level,
        Math.round(progression.fraction * 200),
        // Die Prestigepunkte stehen jetzt in **jedem** Bereich - also muss auch jeder
        // Bereich merken, wenn sie sich aendern.
        state.permanent.prestigePoints,
        combat.phase,
        // Nur in der Pause laeuft die Uhr sichtbar - waehrend der Welle zaehlt derselbe
        // Wert die verstrichene Zeit, und die Anzeige schriebe sich in jedem Bild neu.
        combat.phase === 'pause' ? Math.round(combat.timer * 10) : 0,
        combat.killsThisWave,
        state.run.autoWaves,
        waveRecord(state),
        // Beide Zahlen der Ligazeile: welche Liga laeuft, und wie weit die Pfeile reichen.
        state.run.league,
        state.permanent.leagueUnlocked,
        JSON.stringify(state.run.upgrades),
        controls.speed(),
        boss ? Math.round(boss.hp) : 'none',
      ].join('|')
      if (signature === last) return
      last = signature

      goldCount.to(state.run.gold)
      metaWave.textContent = formatNumber(state.run.wave)

      /*
       * Das liegende Gold hat kein eigenes Segment: Es ist keine vierte Ressource, sondern
       * dieselbe an einem anderen Ort - und sichtbar ist es ohnehin, es liegt als Muenzen
       * im Feld. Als Zahl steht es in der Beschreibung des Goldsegments.
       *
       * Sie stand bis eben nur im `title` und damit praktisch nirgends. Jetzt geht sie beim
       * Darueberfahren auf - die Zeile faengt den Zeiger ohnehin, sie ist ein Kind von
       * `#overlay`.
       */
      describe(gold.node, t('hud.onField', { amount: formatNumber(Math.floor(field)) }))

      level.value.textContent = formatNumber(progression.level)
      level.node.setAttribute('aria-label', t('hud.level', { level: progression.level }))
      describe(
        level.node,
        progression.need > 0
          ? t('hud.xp', {
              into: formatNumber(Math.floor(progression.into)),
              need: formatNumber(progression.need),
            })
          : t('hud.xpMax'),
      )

      prestige.value.textContent = formatNumber(state.permanent.prestigePoints)

      speedValue.textContent = t('hud.speedShort', { factor: controls.speed() })
      const speeds = controls.speeds()
      slower.disabled = controls.speed() === speeds[0]
      faster.disabled = controls.speed() === speeds[speeds.length - 1]

      // Kampfwerte: der Schaden des Hauptturms und der Goldfaktor - dieselben zwei Zahlen,
      // an denen der Spieler ablesen soll, ob sich ein Upgrade gelohnt hat.
      const core = effectiveTowerStats(state, CORE_UID)
      damageCount.to(core ? core.damage : 0)
      describe(damage.node, t('status.damage'))
      goldFactor.value.textContent = t('hud.factor', {
        value: globalMultiplier(state, 'goldBonus').toFixed(2),
      })
      describe(goldFactor.node, t('status.goldFactor'))

      const hpFraction = combat.maxStationHp > 0 ? combat.stationHp / combat.maxStationHp : 0
      const hpText = `${formatNumber(Math.ceil(combat.stationHp))} / ${formatNumber(combat.maxStationHp)}`
      // Zwei Orte, ein Wert: die Rumpfleiste im Kampf und die Wellenkarte der Basis.
      for (const leiste of [hp, metaHp]) {
        leiste.set(hpFraction, hpText)
        leiste.fill.classList.toggle('low', hpFraction <= 0.3)
      }
      describe(hp.node, t('status.stationHp'))

      /*
       * Die Ligazeile. Der Farbton kommt aus dem Datensatz und faerbt Name und Rang -
       * damit ist die Liga auch dann ablesbar, wenn man den Namen nicht liest.
       */
      const league = leagueByIndex(state.run.league)
      leagueRow.hidden = state.permanent.leagueUnlocked <= 1
      leagueName.textContent = t(league.id)
      leagueRank.textContent = t('league.rank', { index: league.index })
      leagueRow.style.setProperty('--league-tint', LEAGUE_TINT[league.tint])
      leagueDown.disabled = !canEnterLeague(state, league.index - 1)
      leagueUp.disabled = !canEnterLeague(state, league.index + 1)

      waveLabel.textContent =
        combat.phase === 'pause'
          ? t('hud.wavePause', { wave: upcomingWave(state) })
          : t('hud.wave', { wave: state.run.wave })

      waveDamage.value.textContent = plan ? plan.damageScale.toFixed(2) : formatNumber(1)
      waveHp.value.textContent = plan ? plan.hpScale.toFixed(2) : formatNumber(1)

      // In der Welle zeigt die Leiste, wie viel geschafft ist; in der Pause, wie lange sie
      // noch dauert. Sie laeuft dabei leer statt voll zu bleiben - aus toter Zeit wird
      // eine sichtbare Frist, und der Wechsel ist auch ohne Blick auf den Text erkennbar.
      const pausing = combat.phase === 'pause'
      progress.node.classList.toggle('pause', pausing)

      if (pausing) {
        // Die Uhr laeuft in beiden Modi - ohne Auto kommt dieselbe Welle wieder, und auch
        // das ist eine Frist und kein Warten auf den Spieler.
        const left = Math.max(0, combat.timer)
        progress.set(left / WAVE_PAUSE_SECONDS, t('status.nextWave', { seconds: left.toFixed(1) }))
      } else {
        const done = Math.min(combat.killsThisWave, total)
        progress.set(total > 0 ? done / total : 0, t('status.progress', { done, total }))
      }

      previous.disabled = !canSkipTo(state, state.run.wave - 1)
      next.disabled = state.run.wave + 1 > waveRecord(state) + 1
      auto.classList.toggle('active', state.run.autoWaves)
      describe(auto, state.run.autoWaves ? t('hud.autoOn') : t('hud.autoOff'))

      bossBar.hidden = boss === null
      if (boss) {
        const def = enemyById(boss.defId)
        const fraction = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0

        // Die Leiste traegt seine Farbe, nicht eine eigene - dieselbe Regel wie beim
        // Lebensbalken am Gegner: Die Anzeige gehoert sichtbar zu dem Ding auf dem Feld.
        bossBar.style.setProperty('--boss', def.color)
        bossName.textContent = def.name
        bossFill.style.width = `${clamp(fraction) * 100}%`
        bossText.textContent = `${formatNumber(Math.ceil(boss.hp))} / ${formatNumber(Math.ceil(boss.maxHp))}`
      }
    },
    goldTarget: gold.mark,
    goldArrived() {
      restart(gold.node, 'pulse')
    },
    detach() {
      stopHitPulse()
      stopBanner()
      stopLost()
      bannerWriter.reset()
      for (const node of [
        resources,
        waveCard,
        bossBar,
        speedBar,
        banner,
        hullBar,
        abilityRail,
        metaCard,
      ]) {
        node.remove()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/**
 * Knoten mit Klassen. Als Liste statt als eine Zeichenkette - der Selbsttest sucht in
 * `ui/` nach Spielertexten im Code, und "card wave-card" liest sich fuer ihn wie ein Satz.
 */
function div(...classes: string[]): HTMLDivElement {
  const node = document.createElement('div')
  node.classList.add(...classes)
  return node
}

/** Symbol plus Zahl - die Grundform jeder Anzeige. */
function figure(
  name: IconName,
  size: number,
  ...classes: string[]
): { node: HTMLElement; value: HTMLElement; mark: HTMLElement } {
  const node = document.createElement('span')
  node.classList.add(...classes)
  node.innerHTML = icon(name, size)

  // Das Symbol wird wieder greifbar: `icon` liefert es als Auszeichnung, und wer es bewegen
  // will, braucht den Knoten. Die Muenzen im Anflug zielen darauf (`ui/coinflight.ts`).
  const mark = node.firstElementChild as HTMLElement

  const value = document.createElement('b')
  node.appendChild(value)
  return { node, value, mark }
}

/** Leiste mit Fuellung und mittiger Beschriftung. */
function bar(className: string): {
  node: HTMLElement
  fill: HTMLElement
  set(fraction: number, text: string): void
} {
  const node = div('bar', className)
  const fill = document.createElement('i')
  const text = document.createElement('span')
  node.append(fill, text)

  return {
    node,
    fill,
    set(fraction, label) {
      fill.style.width = `${clamp(fraction) * 100}%`
      text.textContent = label
    },
  }
}

/**
 * Wie schnell eine Zahl ihrem Stand nachlaeuft. Groesser heisst schneller; die Haelfte des
 * Abstands ist nach `ln 2 / rate` Sekunden weg.
 */
const CLIMB_RATE = 14

/**
 * Der Takt der Goldzahl - langsamer als der Vorgabewert, und zwar aus einem Grund, der
 * ausserhalb dieser Datei liegt.
 *
 * Auf das Goldschild fliegen Muenzen zu (`ui/coinflight.ts`). Von der Uebergabe bis zum
 * Einschlag vergehen rund acht Zehntelsekunden. Mit dem Vorgabetakt stand die Zahl nach
 * knapp zweien - die Muenzen kamen also bei einer Anzeige an, die den Zuwachs laengst
 * verbucht hatte, und der ganze Flug fuehrte sichtbar zu nichts. Mit 5 ist die Haelfte
 * nach 0,14 s und der Rest nach gut einer halben Sekunde weg: Die Zahl laeuft, waehrend
 * die Muenzen einschlagen, und steht kurz nachdem die letzte da ist.
 */
const GOLD_CLIMB = 5

/**
 * Zahl, die auf ihren neuen Stand zulaeuft statt zu springen.
 *
 * Der Schritt haengt an der vergangenen Zeit, nicht an der Bildrate - bei 30 und bei 120
 * Bildern dauert derselbe Anstieg gleich lang. Nahe am Ziel wird aufgesetzt, sonst zappelt
 * die letzte Stelle ewig weiter.
 */
function counter(
  node: HTMLElement,
  rate = CLIMB_RATE,
): { to(value: number): void; step(dt: number): void; climbing(): boolean } {
  let shown = 0
  let target = 0
  let running = true

  return {
    to(value) {
      if (value === target) return
      target = value
      running = true
    },
    step(dt) {
      if (!running) return
      const diff = target - shown
      if (Math.abs(diff) < 0.5) {
        shown = target
        running = false
      } else {
        shown += diff * (1 - Math.exp(-dt * rate))
      }
      node.textContent = formatNumber(Math.floor(shown))
    },
    /**
     * Laeuft die Zahl gerade **nach oben**?
     *
     * Nur nach oben, und das ist keine Kleinigkeit: Ein Kauf zieht den Stand nach unten,
     * und derselbe Zaehler laeuft dann genauso. Das Gleissen der Zahl waere dort die
     * falsche Auskunft - es sagt "es kommt etwas dazu", nicht "es bewegt sich etwas".
     */
    climbing() {
      return running && target > shown
    },
  }
}

function metaRow(root: HTMLElement, label: string): HTMLElement {
  const row = div('meta-row')
  const name = document.createElement('span')
  name.textContent = label
  const value = document.createElement('b')
  row.append(name, value)
  root.appendChild(row)
  return value
}

/**
 * Eine Quittungsbewegung neu anstossen.
 *
 * Der Zwischenschritt ueber `offsetWidth` erzwingt einen Umbruch - ohne ihn setzt der
 * Browser dieselbe Klasse fort, und der zweite Treffer bliebe unsichtbar.
 */
function restart(node: HTMLElement, className: string): void {
  node.classList.remove(className)
  void node.offsetWidth
  node.classList.add(className)
}

function stepButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  setSlideLabel(element, text)
  describe(element, title)
  element.addEventListener('click', onClick)
  return element
}

/**
 * Schaltflaeche, deren Inhalt ein Symbol ist.
 *
 * Vorher waren die beiden Wellenpfeile fertige Bilddateien mit eigenem Rahmen - sie fielen
 * dadurch aus der Formensprache heraus und liessen sich nicht mitfaerben. Jetzt tragen sie
 * denselben Rahmen wie jeder andere Knopf, und das Zeichen darin nimmt die Farbe seines
 * Zustands an.
 */
function iconButton(name: IconName, title: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = 'icon-button'
  element.innerHTML = icon(name, 18)
  element.setAttribute('aria-label', title)
  describe(element, title)
  element.addEventListener('click', onClick)
  return element
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
