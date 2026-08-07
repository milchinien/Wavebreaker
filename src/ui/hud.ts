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
import { formatNumber } from '../core/format.ts'
import type { SpeedFactor } from '../core/loop.ts'
import { WAVE_PAUSE_SECONDS } from '../data/balance.ts'
import { t } from '../data/strings.ts'
import { fireAbility, goToNextWave, goToPreviousWave, toggleAutoWaves } from '../app/actions.ts'
import type { GameState } from '../app/state.ts'
import { enemyById } from '../data/enemies.ts'
import { activeBoss } from '../sim/enemies.ts'
import { cooldownLeft, equippedAbilities } from '../sim/abilities.ts'
import { goldOnField } from '../sim/economy.ts'
import { levelProgress } from '../sim/progression.ts'
import { CORE_UID } from '../sim/station.ts'
import { effectiveTowerStats, globalMultiplier } from '../sim/stats.ts'
import { canSkipTo, isBossWave } from '../sim/waves.ts'
import { abilityIcon, icon, type IconName } from './icons.ts'
import type { SettingsControls } from './settings.ts'
import { setSlideLabel } from './slide.ts'
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

export type HudTargets = {
  /** Schwebende Anzeigen ueber dem Spielfeld. Die einzige Ebene, die das HUD benutzt. */
  overlay: HTMLElement
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
  detach(): void
}

export function mountHud(state: GameState, targets: HudTargets, controls: SettingsControls): Hud {
  const { overlay } = targets

  // --- Goldschild, oben links ---
  // Ein eigenes Schild statt nackter Zahlen: Gold ist die Waehrung, in der jede Entscheidung
  // dieses Spiels bezahlt wird, und war vorher als einzige Anzeige ohne Rahmen kaum als
  // Anzeige zu erkennen.
  const resources = div('plate', 'resource-bar')
  const gold = figure('coin', 22, 'res')
  const onField = figure('coin', 14, 'res', 'dim')
  onField.node.title = t('hud.onField', { amount: '' })

  /*
   * Stufe und Erfahrung schliessen das Schild nach unten ab (GDD 13 Abschnitt 4).
   *
   * Sie stehen bewusst beim Gold und nicht bei der Welle: Gold und Erfahrung sind beides
   * Fortschritt **des Spielers**, die Welle ist der Gegner. Wer wissen will, wie stark er
   * geworden ist, schaut damit an eine Stelle.
   */
  const levelRow = div('level-row')
  const levelLabel = document.createElement('span')
  levelLabel.className = 'level-label'
  const xpBar = div('xp-bar')
  const xpFill = document.createElement('i')
  xpBar.appendChild(xpFill)
  levelRow.append(levelLabel, xpBar)

  resources.append(gold.node, onField.node, levelRow)

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
  const waveHead = div('head')
  const waveLabel = document.createElement('span')
  waveLabel.className = 'wave-label'
  const scales = div('scales', 'enemy')
  const waveDamage = figure('damage', 16, 'fig')
  const waveHp = figure('hull', 16, 'fig')
  waveDamage.node.title = t('status.waveDamage')
  waveHp.node.title = t('status.waveHp')
  scales.append(waveDamage.node, waveHp.node)
  waveHead.append(waveLabel, scales)

  const progress = bar('progress')

  const waveControls = div('wave-controls')
  const previous = iconButton('prev', t('hud.prevWave'), () => goToPreviousWave(state))
  const auto = stepButton(t('hud.auto'), t('hud.autoOn'), () => toggleAutoWaves(state))
  auto.classList.add('auto-button')
  const next = iconButton('next', t('hud.nextWave'), () => goToNextWave(state))
  waveControls.append(previous, auto, next)

  waveCard.append(waveHead, progress.node, waveControls)

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
   * --- Faehigkeitenleiste, unten rechts im Feld (GDD 13 Abschnitt 4) ---
   *
   * Sie zeigt nur die belegten Slots - was nicht belegt ist, ist im Kampf auch nicht
   * einsetzbar, und ein Kranz grauer Platzhalter saehe nach fehlendem Inhalt aus statt nach
   * einer Entscheidung. Belegt wird im Upgrades-Bereich.
   *
   * Die Knoepfe entstehen nur neu, wenn sich die Belegung aendert; Abklingzeit und
   * Bereitschaft werden in jedem Bild nur **beschrieben**. Sonst spraenge der Zeiger bei
   * jedem Bild von einer neuen Schaltflaeche.
   */
  const abilityBar = div('ability-bar')
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

  function buildAbilityBar(): void {
    const equipped = equippedAbilities(state)
    const signature = equipped.map((ability) => ability.id).join(',')
    if (signature === abilitySignature) return
    abilitySignature = signature

    abilitySlots = []
    abilityBar.replaceChildren()

    for (const ability of equipped) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ability-button'
      button.style.setProperty('--accent', ability.accent)
      button.title = ability.name
      button.setAttribute('aria-label', ability.name)

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

      abilityBar.appendChild(button)
      abilitySlots.push({ id: ability.id, cooldown: ability.cooldown, node: button, sweep, left })
    }
  }

  // --- Wellenkarte der Basis, oben rechts ---
  // Sie traegt auch die Stations-HP: Der Kampf laeuft in der Basis weiter (GDD 02), und
  // wer dort baut, soll nicht erst beim Zurueckwechseln merken, dass die Station faellt.
  const metaCard = div('panel', 'meta-card')
  const metaWave = metaRow(metaCard, t('hud.waveShort'))
  const metaGold = metaRow(metaCard, t('hud.gold'))
  const metaHp = bar('hp')
  metaHp.node.title = t('status.stationHp')
  metaCard.appendChild(metaHp.node)

  overlay.append(resources, waveCard, bossBar, speedBar, banner, hullBar, abilityBar, metaCard)

  function stepSpeed(direction: number): void {
    // Nur die freigeschalteten Stufen - der Knopf soll nichts anbieten, was der Prestige-
    // Baum noch nicht hergibt (GDD 10, Bereich 2b).
    const available = controls.speeds()
    const index = available.indexOf(controls.speed())
    const target = available[Math.min(available.length - 1, Math.max(0, index + direction))]
    if (target !== undefined) controls.setSpeed(target as SpeedFactor)
  }

  // Eingesammeltes Gold quittiert die Anzeige mit einem kurzen Puls. Die Klasse raeumt
  // das Ende der Bewegung selbst weg - schnelles Nachsammeln stoesst sie neu an.
  const stopPulse = on('gold.collected', () => restart(gold.node, 'pulse'))
  gold.node.addEventListener('animationend', () => gold.node.classList.remove('pulse'))

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
  const goldCount = counter(gold.value)
  const metaGoldCount = counter(metaGold)
  const damageCount = counter(damage.value)

  let last = ''

  return {
    update(frameSeconds: number) {
      // Vor der Signaturpruefung: Die Zahlen laufen weiter, auch wenn sich sonst nichts regt.
      goldCount.step(frameSeconds)
      metaGoldCount.step(frameSeconds)
      damageCount.step(frameSeconds)

      /*
       * Ebenfalls davor: Eine Abklingzeit aendert sich in **jedem** Takt. Sie in die
       * Signatur aufzunehmen hiesse, dass sich die Signatur immer unterscheidet - dann
       * schriebe das HUD jedes Bild alles neu, und die Pruefung waere sinnlos.
       */
      buildAbilityBar()
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
        combat.phase,
        // Nur in der Pause laeuft die Uhr sichtbar - waehrend der Welle zaehlt derselbe
        // Wert die verstrichene Zeit, und die Anzeige schriebe sich in jedem Bild neu.
        combat.phase === 'pause' ? Math.round(combat.timer * 10) : 0,
        combat.killsThisWave,
        state.run.autoWaves,
        state.run.waveRecord,
        JSON.stringify(state.run.upgrades),
        controls.speed(),
        boss ? Math.round(boss.hp) : 'none',
      ].join('|')
      if (signature === last) return
      last = signature

      goldCount.to(state.run.gold)
      metaGoldCount.to(state.run.gold)
      onField.value.textContent = formatNumber(Math.floor(field))
      metaWave.textContent = formatNumber(state.run.wave)

      levelLabel.textContent = t('hud.level', { level: formatNumber(progression.level) })
      xpFill.style.width = `${progression.fraction * 100}%`
      levelRow.title =
        progression.need > 0
          ? t('hud.xp', {
              into: formatNumber(Math.floor(progression.into)),
              need: formatNumber(progression.need),
            })
          : t('hud.xpMax')

      speedValue.textContent = t('hud.speedShort', { factor: controls.speed() })
      const speeds = controls.speeds()
      slower.disabled = controls.speed() === speeds[0]
      faster.disabled = controls.speed() === speeds[speeds.length - 1]

      // Kampfwerte: der Schaden des Hauptturms und der Goldfaktor - dieselben zwei Zahlen,
      // an denen der Spieler ablesen soll, ob sich ein Upgrade gelohnt hat.
      const core = effectiveTowerStats(state, CORE_UID)
      damageCount.to(core ? core.damage : 0)
      damage.node.title = t('status.damage')
      goldFactor.value.textContent = t('hud.factor', {
        value: globalMultiplier(state, 'goldBonus').toFixed(2),
      })
      goldFactor.node.title = t('status.goldFactor')

      const hpFraction = combat.maxStationHp > 0 ? combat.stationHp / combat.maxStationHp : 0
      const hpText = `${formatNumber(Math.ceil(combat.stationHp))} / ${formatNumber(combat.maxStationHp)}`
      // Zwei Orte, ein Wert: die Rumpfleiste im Kampf und die Wellenkarte der Basis.
      for (const leiste of [hp, metaHp]) {
        leiste.set(hpFraction, hpText)
        leiste.fill.classList.toggle('low', hpFraction <= 0.3)
      }
      hp.node.title = t('status.stationHp')

      waveLabel.textContent =
        combat.phase === 'pause'
          ? t('hud.wavePause', { wave: state.run.wave + 1 })
          : t('hud.wave', { wave: state.run.wave })
      waveDamage.value.textContent = plan ? plan.damageScale.toFixed(2) : formatNumber(1)
      waveHp.value.textContent = plan ? plan.hpScale.toFixed(2) : formatNumber(1)

      // In der Welle zeigt die Leiste, wie viel geschafft ist; in der Pause, wie lange sie
      // noch dauert. Sie laeuft dabei leer statt voll zu bleiben - aus toter Zeit wird
      // eine sichtbare Frist, und der Wechsel ist auch ohne Blick auf den Text erkennbar.
      const pausing = combat.phase === 'pause'
      progress.node.classList.toggle('pause', pausing)

      if (pausing) {
        const left = Math.max(0, combat.timer)
        // Ohne Auto-Modus wartet das Spiel auf den Spieler - dann laeuft keine Uhr mehr.
        const waiting = !state.run.autoWaves || left <= 0
        progress.set(
          waiting ? 0 : left / WAVE_PAUSE_SECONDS,
          waiting ? t('status.waveReady') : t('status.nextWave', { seconds: left.toFixed(1) }),
        )
      } else {
        const done = Math.min(combat.killsThisWave, total)
        progress.set(total > 0 ? done / total : 0, t('status.progress', { done, total }))
      }

      previous.disabled = !canSkipTo(state, state.run.wave - 1)
      next.disabled = state.run.wave + 1 > state.run.waveRecord + 1
      auto.classList.toggle('active', state.run.autoWaves)
      auto.title = state.run.autoWaves ? t('hud.autoOn') : t('hud.autoOff')

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
    detach() {
      stopPulse()
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
        abilityBar,
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
 * Zahl, die auf ihren neuen Stand zulaeuft statt zu springen.
 *
 * Der Schritt haengt an der vergangenen Zeit, nicht an der Bildrate - bei 30 und bei 120
 * Bildern dauert derselbe Anstieg gleich lang. Nahe am Ziel wird aufgesetzt, sonst zappelt
 * die letzte Stelle ewig weiter.
 */
function counter(node: HTMLElement): { to(value: number): void; step(dt: number): void } {
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
        shown += diff * (1 - Math.exp(-dt * 14))
      }
      node.textContent = formatNumber(Math.floor(shown))
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
  element.title = title
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
  element.title = title
  element.setAttribute('aria-label', title)
  element.addEventListener('click', onClick)
  return element
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
