/**
 * Der Upgrade-Katalog als Pruefung (`docs/upgrade-umbau.md`, Etappe E1).
 *
 * Die Abnahmebedingung der Etappe lautet: "Alle 60 Upgrades stehen als Datensatz da, jeder
 * mit Name, Beschreibung, Bild und Effekt." Das ist keine Aussage ueber Code, sondern ueber
 * **Daten** - und Daten kann man nachzaehlen. Genau das steht unten.
 *
 * Die Pruefungen sind nach dem Muster gebaut, das sich im Projekt bewaehrt hat: Nicht "die
 * heutigen Werte stimmen", sondern "ein bestimmter Fehler kann nicht entstehen". Eine
 * Handliste mit 60 Eintraegen hat andere Fehler als eine Schleife - Tippfehler in einer
 * Kennung, ein Name zweimal vergeben, ein `requires` ins Leere, eine Turmart, die von keinem
 * Gruppen-Upgrade erfasst wird. Keiner davon faellt beim Spielen auf; jeder faellt hier auf.
 *
 * Was hier **nicht** steht: ob ein Effekt tatsaechlich wirkt. Das kann er noch gar nicht -
 * `sim/stats.ts` liest den Katalog erst ab E2. Diese Pruefung kommt dort dazu.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { upgradeStepCost, UPGRADE_WINDOW_FACTOR } from '../../data/balance.ts'
import { TOWERS, towerById } from '../../data/towers.ts'
import { TOWER_CLASSES } from '../../data/types.ts'
import {
  isFactor,
  targetTowers,
  upgradeById,
  upgradeIcon,
  UPGRADES,
  upgradesInWindow,
  WINDOW_SLOTS,
  windowGate,
  type UpgradeDef,
} from '../../data/upgrades.ts'

/** Die drei Fenster, die Inhalt haben. Fenster 4 ist gesperrt und bleibt leer. */
const FILLED = [1, 2, 3] as const

export function catalogSuite(): void {
  suite('data/upgrades')

  // --- Raster --------------------------------------------------------------

  check('drei Fenster mit je zwanzig Plaetzen, kein Platz doppelt oder leer', () => {
    assertEqual(UPGRADES.length, FILLED.length * WINDOW_SLOTS, 'Upgrades insgesamt')

    for (const window of FILLED) {
      const entries = upgradesInWindow(window)
      assertEqual(entries.length, WINDOW_SLOTS, `Fenster ${window}`)

      // Die Plaetze entstehen aus der Reihenfolge der Liste (`build` in data/upgrades.ts).
      // Diese Zeile haelt fest, dass das auch so bleibt: 0 bis 19, lueckenlos, in Ordnung.
      const slots = entries.map((entry) => entry.slot)
      assertEqual(slots.join(','), [...Array(WINDOW_SLOTS).keys()].join(','), `Fenster ${window}`)
    }

    assertEqual(upgradesInWindow(4).length, 0, 'Fenster 4 ist gesperrt und leer')
  })

  check('jede Kennung, jeder Name und jedes Bild kommt genau einmal vor', () => {
    const ids = new Set<string>()
    const names = new Set<string>()
    const icons = new Set<string>()

    for (const def of UPGRADES) {
      assert(!ids.has(def.id), `die Kennung ${def.id} steht zweimal im Katalog`)
      ids.add(def.id)

      // Ausdrueckliche Vorgabe: Jedes Upgrade traegt einen eigenen Namen. Zwei Kacheln mit
      // demselben Namen sind im Hinweis nicht auseinanderzuhalten.
      assert(!names.has(def.name), `der Name "${def.name}" ist zweimal vergeben`)
      names.add(def.name)

      const icon = upgradeIcon(def)
      assert(!icons.has(icon), `das Bild "${icon}" ist zweimal vergeben (${def.id})`)
      icons.add(icon)
    }
  })

  check('die Kennung nennt ihr Fenster', () => {
    for (const def of UPGRADES) {
      assert(
        def.id.startsWith(`f${def.window}.`),
        `${def.id} liegt in Fenster ${def.window}, sagt es aber nicht`,
      )
    }
  })

  // --- Texte ---------------------------------------------------------------

  check('jedes Upgrade traegt Name und Beschreibung im Klartext', () => {
    for (const def of UPGRADES) {
      assert(def.name.trim().length > 0, `${def.id} hat keinen Namen`)
      assert(def.info.trim().length > 0, `${def.id} hat keine Beschreibung`)
      // Ein Name, der wie eine Kennung aussieht, ist auf der Kachel so gut wie keiner.
      assert(!def.name.includes('.'), `${def.id} traegt eine Kennung statt eines Namens`)
      // Die Beschreibung ist ein Satz, kein Wort - sie steht allein im Hinweis.
      assert(def.info.trim().length >= 12, `${def.id}: die Beschreibung ist kein Satz`)
    }
  })

  check('alle Texte sind englisch', () => {
    // Dieselbe Regel wie fuer `data/strings.ts` (GDD 16 Abschnitt 1). Sie steht hier ein
    // zweites Mal, weil der Katalog seine Texte selbst traegt und die dortige Pruefung
    // ihn deshalb nicht sieht.
    for (const def of UPGRADES) {
      for (const [what, text] of [
        ['Name', def.name],
        ['Beschreibung', def.info],
      ] as const) {
        assert(
          !/[äöüßÄÖÜ]/.test(text),
          `${def.id}: ${what} enthaelt deutsche Zeichen`,
        )
      }
    }
  })

  // --- Arten ---------------------------------------------------------------

  check('die Hoechststufe passt zur Art', () => {
    for (const def of UPGRADES) {
      if (def.kind === 'endless') {
        assertEqual(def.maxLevel, Infinity, `${def.id}`)
      } else if (def.kind === 'directive') {
        assertEqual(def.maxLevel, 1, `${def.id}`)
      } else if (def.kind === 'extension') {
        assert([15, 20].includes(def.maxLevel), `${def.id} hat ${def.maxLevel} statt 15 oder 20`)
      } else {
        assert([3, 5].includes(def.maxLevel), `${def.id} hat ${def.maxLevel} statt 3 oder 5`)
      }
    }
  })

  /*
   * Die wichtigste Pruefung dieser Datei.
   *
   * "Ein Directive ist keine Zahl" ist die Regel, an der sich die vier Arten ueberhaupt
   * unterscheiden - ein Einmal-Upgrade mit einem Betrag waere ein Extension mit einer Stufe,
   * und die Art waere nur noch ein Wort. Umgekehrt gilt dasselbe: Was eine Regel umlegt,
   * darf nicht in Stufen kommen, denn eine halb umgelegte Regel gibt es nicht.
   */
  check('Directives aendern eine Regel, alles andere traegt einen Betrag', () => {
    for (const def of UPGRADES) {
      const changesRule = def.effect.kind === 'rule' || def.effect.kind === 'window'
      assertEqual(
        def.kind === 'directive',
        changesRule,
        `${def.id}: Art "${def.kind}" und Wirkung "${def.effect.kind}" passen nicht zusammen`,
      )
    }
  })

  check('kein Betrag ist null', () => {
    for (const def of UPGRADES) {
      const effect = def.effect
      if (effect.kind === 'rule' || effect.kind === 'window') continue
      // Ein Upgrade, das Gold nimmt und nichts bewegt, ist der Fehler, den man beim Spielen
      // nie bemerkt - der Preis steigt, der Wert nicht.
      assert(effect.amount !== 0, `${def.id} hat den Betrag 0`)
    }
  })

  // --- Ziele ---------------------------------------------------------------

  check('jedes Ziel trifft mindestens eine vorhandene Turmart', () => {
    for (const def of UPGRADES) {
      const effect = def.effect
      if (effect.kind !== 'flat' && effect.kind !== 'percent') continue
      // Der Kern ist keine Turmart - er ist immer da und braucht keine Aufloesung.
      if (effect.target.kind === 'core') continue

      const ids = targetTowers(effect.target)
      assert(ids.length > 0, `${def.id} zielt ins Leere`)
      for (const id of ids) {
        assert(towerById(id) !== undefined, `${def.id} zielt auf die unbekannte Turmart ${id}`)
      }
    }
  })

  /*
   * Die Gegenprobe: nicht "jedes Upgrade findet einen Turm", sondern "jeder Turm findet ein
   * Upgrade".
   *
   * Sie faengt den Fehler, den eine Handliste am ehesten macht - eine Turmart, die beim
   * Schreiben schlicht vergessen wurde. Support-Module sind ausgenommen, und zwar aus einem
   * pruefbaren Grund und nicht per Liste: Sie haben keine Kampfwerte (`NO_STATS`), ein
   * Schadenszuschlag auf sie waere null mal einem Aufschlag. Was sie staerker macht, sind
   * Sonderwerte ohne Ziel.
   */
  check('jede Turmart mit Kampfwerten wird von einem Gruppen-Upgrade erfasst', () => {
    const covered = new Set<string>()
    for (const def of UPGRADES) {
      const effect = def.effect
      if (effect.kind !== 'flat' && effect.kind !== 'percent') continue
      for (const id of targetTowers(effect.target)) covered.add(id)
    }

    for (const tower of TOWERS) {
      const fights = tower.stats.damage > 0 || tower.stats.attackSpeed > 0
      if (!fights) continue
      assert(covered.has(tower.id), `kein Upgrade erfasst ${tower.name}`)
    }
  })

  /*
   * Klasse und Kategorie sind zwei verschiedene Dinge (`data/types.ts`).
   *
   * Die Pruefung stellt sicher, dass das auch in den Daten so ist und nicht bloss im
   * Kommentar steht: Gaebe es zu jeder Klasse genau eine Kategorie, waere die Klasse eine
   * Umbenennung - und wer sie spaeter aendert, verschoebe unbemerkt eine Buff-Regel
   * (GDD 03 Abschnitt 9).
   */
  check('Turmklasse und Kategorie sind nicht dasselbe', () => {
    let mixed = 0
    for (const towerClass of TOWER_CLASSES) {
      const categories = new Set(
        TOWERS.filter((tower) => tower.class === towerClass).map((tower) => tower.category),
      )
      if (categories.size > 1) mixed += 1
    }
    assert(mixed > 0, 'jede Klasse deckt sich mit genau einer Kategorie - dann ist sie keine')

    for (const tower of TOWERS) {
      assert(
        TOWER_CLASSES.includes(tower.class),
        `${tower.name} hat die unbekannte Klasse ${tower.class}`,
      )
    }
  })

  // --- Voraussetzungen -----------------------------------------------------

  check('jede Voraussetzung zeigt auf ein vorhandenes Upgrade', () => {
    for (const def of UPGRADES) {
      for (const [what, id] of [
        ['requires', def.requires],
        ['excludes', def.excludes],
      ] as const) {
        if (id === undefined) continue
        assert(
          UPGRADES.some((entry) => entry.id === id),
          `${def.id}: ${what} nennt das unbekannte Upgrade ${id}`,
        )
        assert(id !== def.id, `${def.id}: ${what} zeigt auf sich selbst`)
      }
    }
  })

  check('eine Voraussetzung steht nie hinter dem, was sie voraussetzt', () => {
    // Sonst waere sie in ihrem eigenen Fenster nicht erreichbar, bevor das Tor faellt - und
    // damit nie. Ein Kreis ist derselbe Fehler, nur schwerer zu sehen.
    for (const def of UPGRADES) {
      if (def.requires === undefined) continue
      const parent = upgradeById(def.requires)
      assert(
        parent.window < def.window || (parent.window === def.window && parent.slot < def.slot),
        `${def.id} setzt ${parent.id} voraus, steht aber davor`,
      )
    }
  })

  check('Ausschluesse gelten gegenseitig', () => {
    // Einseitig waere die Reihenfolge des Kaufs entscheidend: Wer erst das eine nimmt, kaeme
    // an das andere nicht mehr heran - und wer erst das andere nimmt, an beide.
    for (const def of UPGRADES) {
      if (def.excludes === undefined) continue
      const other = upgradeById(def.excludes)
      assertEqual(other.excludes, def.id, `${def.id} und ${other.id} schliessen sich einseitig aus`)
    }
  })

  // --- Die Tore ------------------------------------------------------------

  check('jedes freischaltbare Fenster hat genau ein Tor, und es sitzt zuletzt', () => {
    assertEqual(windowGate(1), null, 'Fenster 1 ist von Anfang an offen')

    for (const window of [2, 3] as const) {
      const gate = windowGate(window)
      assert(gate !== null, `Fenster ${window} hat kein Tor`)
      assertEqual(gate.window, window - 1, `das Tor zu Fenster ${window} liegt im falschen Fenster`)
      assertEqual(gate.slot, WINDOW_SLOTS - 1, `das Tor zu Fenster ${window} sitzt nicht zuletzt`)
      assertEqual(gate.kind, 'directive', `das Tor zu Fenster ${window}`)
    }

    // Fenster 4 ist ein angekuendigter Platz, kein bezahltes Versprechen: Ein Tor, das man
    // kauft und hinter dem nichts ist, waere schlimmer als ein sichtbares Schloss.
    assertEqual(windowGate(4), null, 'Fenster 4 darf kein kaufbares Tor haben')
  })

  check('das Tor ist der teuerste Posten seines Fensters', () => {
    for (const window of [1, 2] as const) {
      const entries = upgradesInWindow(window)
      const gate = entries[WINDOW_SLOTS - 1]
      assert(gate !== undefined, `Fenster ${window} hat keinen letzten Platz`)
      for (const def of entries) {
        if (def.id === gate.id) continue
        assert(
          def.baseCost <= gate.baseCost,
          `in Fenster ${window} ist ${def.id} teurer als das Tor`,
        )
      }
    }
  })

  // --- Preise --------------------------------------------------------------

  check('jede Stufe kostet mehr als die davor', () => {
    for (const def of UPGRADES) {
      if (def.kind === 'directive') continue
      // Endlose Pfade werden bis Stufe 60 geprueft - weit ueber das hinaus, was ein Run
      // erreicht, und genau dort muss die Kurve noch steigen.
      const top = Number.isFinite(def.maxLevel) ? def.maxLevel : 60
      let previous = 0
      for (let level = 1; level <= top; level++) {
        const cost = upgradeStepCost(def, level)
        assert(cost > previous, `${def.id}: Stufe ${level} kostet nicht mehr als die davor`)
        previous = cost
      }
    }
  })

  check('das spaetere Fenster ist das teurere', () => {
    // Gleicher Grundpreis, gleiche Art, gleiche Stufe - dann trennt die beiden nur noch der
    // Fensterfaktor, und der ist die Aussage.
    const probe = (window: 1 | 2 | 3): number => {
      const def: UpgradeDef = {
        id: 'probe',
        window,
        slot: 0,
        kind: 'extension',
        name: 'Probe',
        info: 'Nur fuer die Pruefung.',
        effect: { kind: 'global', key: 'goldPerKill', amount: 1 },
        maxLevel: 20,
        baseCost: 100,
      }
      return upgradeStepCost(def, 1)
    }

    assert(probe(2) > probe(1), 'Fenster 2 ist nicht teurer als Fenster 1')
    assert(probe(3) > probe(2), 'Fenster 3 ist nicht teurer als Fenster 2')
    assertEqual(UPGRADE_WINDOW_FACTOR[1], 1, 'Fenster 1 ist der Massstab')
  })

  /*
   * Endlos ist billiger und schwaecher als knapp - ausdrueckliche Vorgabe.
   *
   * Geprueft wird der **Grundpreis**, nicht die Kurve: Was ein endloser Pfad auf Stufe 40
   * kostet, soll ruhig ueber einem Charge liegen, sonst haette er keine Bremse. Der Einstieg
   * aber muss klein sein, sonst ist er nicht das, was man kauft, wenn nichts anderes geht.
   */
  check('endlose Pfade sind billiger als knappe', () => {
    const cheapest = (kind: UpgradeDef['kind']): number =>
      Math.min(
        ...UPGRADES.filter((def) => def.kind === kind && def.window === 1).map(
          (def) => def.baseCost,
        ),
      )
    const dearest = (kind: UpgradeDef['kind']): number =>
      Math.max(
        ...UPGRADES.filter((def) => def.kind === kind && def.window === 1).map(
          (def) => def.baseCost,
        ),
      )

    assert(
      dearest('endless') < cheapest('charge'),
      'der teuerste endlose Pfad kostet mehr als der billigste knappe',
    )
    assert(
      dearest('endless') < cheapest('extension'),
      'der teuerste endlose Pfad kostet mehr als der billigste Ausbau',
    )
  })

  // --- Die Form der Wirkung ------------------------------------------------

  /*
   * "Groesstenteils weg von den Prozenten" war die Vorgabe. Sie hat nur dann Bestand, wenn
   * sie nachgezaehlt wird - sonst wandert bei jeder Erweiterung ein Prozentsatz mehr hinein,
   * und niemand merkt, wann es wieder das alte System ist.
   *
   * Geprueft wird der harte Fall: ein Anteil auf eine **Gruppe**. Faktor-Werte wie
   * Kritschaden oder Buffstaerke zaehlen nicht mit - sie sind keine Entscheidung, sondern
   * die Einheit ihres Werts.
   */
  check('nur wenige Upgrades wirken prozentual auf eine Gruppe', () => {
    const percent = UPGRADES.filter((def) => def.effect.kind === 'percent')
    assert(
      percent.length <= UPGRADES.length / 8,
      `${percent.length} von ${UPGRADES.length} Upgrades sind prozentual - erlaubt ist ein Achtel`,
    )
    // Und die Gegenprobe: ganz ohne waere die Form verloren, die eine gemischte Gruppe
    // ueberhaupt fair treffen kann.
    assert(percent.length > 0, 'kein einziges Upgrade wirkt prozentual')
  })

  /*
   * Die Vorgabe in ihrer allgemeinen Form: **Ein Betrag ist im Regelfall ein Zaehlwert.**
   *
   * Die erste Fassung dieser Pruefung fragte `Number.isInteger(amount)` - und lag damit
   * daneben. Ein Kritschaden-Zuschlag steht als 0,25 im Datensatz und erscheint dem Spieler
   * als "+25 %"; eine Overdrive-Chance steht als 0,01 und erscheint als "+1 %". Beide sind
   * ganze Zahlen fuer den, der sie liest, und gebrochene fuer den, der sie speichert. Was
   * die Vorgabe wirklich meint, ist die **Form der Wirkung**: zaehlbar oder anteilig - und
   * genau die beantwortet `isFactor`.
   */
  check('ein Betrag ist im Regelfall ein Zaehlwert und kein Anteil', () => {
    const withAmount = UPGRADES.filter(
      (def) => def.effect.kind !== 'rule' && def.effect.kind !== 'window',
    )
    const factors = withAmount.filter((def) => isFactor(def.effect))
    const counts = withAmount.length - factors.length

    assert(
      counts > factors.length,
      `${factors.length} von ${withAmount.length} Upgrades mit Betrag wirken anteilig - ` +
        'der Zaehlwert soll die Mehrheit sein',
    )
  })
}
