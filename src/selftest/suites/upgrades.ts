/**
 * **Jedes Upgrade wirkt** - die Abnahmebedingung von Etappe E2 (`docs/upgrade-umbau.md`).
 *
 * Der Katalog aus E1 war eine Liste; `selftest/suites/catalog.ts` prueft, dass sie
 * wohlgeformt ist. Diese Sammlung prueft das Gegenstueck und die eigentliche Zusage: dass ein
 * Kauf tatsaechlich **etwas veraendert** - und zwar das, was auf der Kachel steht.
 *
 * Das ist die Pruefung, die es fuer die alte Fassung nie gab, und ihr Fehlen war teuer: Dort
 * entstanden die Pfade in einer Schleife, also wirkte per Bauart jeder - bis auf die, die
 * auf einen Wert zielten, den ihr Turm gar nicht hatte ("0 dmg", nahm aber Gold). Bei einer
 * Handliste mit sechzig Eintraegen und sechs Wirkungsarten ist das kein Randfall mehr,
 * sondern der wahrscheinlichste Fehler ueberhaupt: ein Schluessel, den niemand liest.
 *
 * Der Kern ist deshalb **eine** Pruefung, die ueber alle sechzig laeuft und fuer jede
 * Wirkungsart eine passende Messung anstellt. Was sie nicht messen kann, zaehlt sie auf -
 * eine Liste von Ausnahmen, die man beim Lesen erkennt, statt einer stillen Luecke.
 *
 * Was hier **nicht** steht: wie das Panel aussieht. Die vorherige Fassung dieser Datei hat
 * genau das geprueft (Wert samt Einheit, Breitenbudget, Gruppengroessen) - und all das gibt
 * es nicht mehr. Das neue Panel kommt in E5 und bringt seine eigenen Pruefungen mit.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import { TOWERS } from '../../data/towers.ts'
import {
  targetTowers,
  upgradeById,
  UPGRADES,
  upgradesInWindow,
  windowOpen,
  type UpgradeDef,
  type UpgradeWindow,
} from '../../data/upgrades.ts'
import { STAT_KEYS } from '../../data/types.ts'
import {
  buyUpgrade,
  nextUpgradeCost,
  performPrestige,
  upgradeBlock,
} from '../../app/actions.ts'
import { createInitialState, type GameState } from '../../app/state.ts'
import { invalidateStationView, resetStationViewCache, stationView } from '../../app/view.ts'
import { syncStation } from '../../sim/battle.ts'
import { createCombatState } from '../../sim/combat.ts'
import { towerSlots } from '../../sim/prestige.ts'
import { collectRadius } from '../../sim/economy.ts'
import {
  globalMultiplier,
  globalValue,
  hasRule,
  maxStationHp,
  moduleStats,
  specialValue,
  upgradeLevel,
} from '../../sim/stats.ts'
import { freeEdges, newModule, place, type FreeEdge } from '../../sim/station.ts'

function sync(state: GameState): void {
  invalidateStationView(state)
  const view = stationView(state)
  syncStation(state, view.modules, view.buffs)
}

/**
 * Ein Zustand mit **je einem Turm jeder Klasse** am Kern.
 *
 * Ohne gebaute Tuerme waeren alle Klassen-Upgrades unpruefbar - ihr Ziel traefe kein Modul.
 * Die drei stehen stellvertretend fuer ihre Klasse; welcher es genau ist, spielt keine
 * Rolle, solange er Kampfwerte hat.
 */
function rig(): GameState {
  resetStationViewCache()
  const state = createInitialState(4711)
  state.runtime.combat = createCombatState()
  state.run.gold = 1e12
  sync(state)
  return state
}

/** Einen Turm andocken und die Sicht gleichziehen. Gibt seine Kennung zurueck. */
function build(state: GameState, defId: string): string {
  const station = state.run.station
  station.slots = Math.max(station.slots, station.placed.length + 1)
  const module = newModule(station, defId, 'common')
  station.inventory.push(module)
  const edge = freeEdges(station)[0] as FreeEdge
  place(station, module.uid, edge)
  sync(state)
  return module.uid
}

/** Ein Modul aus der Kampfsicht - die Fassung, auf der `moduleStats` rechnet. */
function moduleOf(state: GameState, uid: string) {
  const module = state.runtime.combat.modules.find((entry) => entry.uid === uid)
  assert(module !== undefined, `Modul ${uid} fehlt in der Kampfsicht`)
  return module
}

/** Endwerte eines Moduls, ohne Buffs - nur Grundwert, Eigenschaften und Upgrades. */
function statsOf(state: GameState, uid: string) {
  return moduleStats(moduleOf(state, uid), undefined, state).upgraded
}

/**
 * Ein Upgrade kaufbar machen und kaufen - **ohne** die Sperren zu umgehen.
 *
 * Voraussetzungen werden mitgekauft, das Fenster ueber sein Tor geoeffnet. Nur so prueft die
 * Messung den Weg, den auch der Spieler geht; ein direkt in `run.upgrades` geschriebener
 * Eintrag bewiese nur, dass die Rechnung Zahlen addieren kann.
 */
function acquire(state: GameState, def: UpgradeDef, times = 1): void {
  // Der Prestige-Knoten ist die einzige Sperre, die ein Run nicht selbst aufheben kann -
  // hier wird er gesetzt, wie ihn ein Spieler ueber viele Runs gekauft haette.
  if (def.requiresNode !== undefined && !state.permanent.prestigeNodes.includes(def.requiresNode)) {
    state.permanent.prestigeNodes.push(def.requiresNode)
  }
  if (!windowOpen(state.run.upgrades, def.window)) {
    // Die Kette von unten aufrollen: Fenster 3 braucht das Tor in Fenster 2, und das
    // wiederum das in Fenster 1.
    for (const window of [2, 3] as const) {
      if (window > def.window) break
      const gate = upgradesInWindow((window - 1) as UpgradeWindow).find(
        (entry) => entry.effect.kind === 'window' && entry.effect.opens === window,
      )
      assert(gate !== undefined, `Fenster ${window} hat kein Tor`)
      if (upgradeLevel(state.run.upgrades, gate.id) === 0) {
        assert(buyUpgrade(state, gate.id), `das Tor ${gate.id} liess sich nicht kaufen`)
      }
    }
  }
  if (def.requires !== undefined && upgradeLevel(state.run.upgrades, def.requires) === 0) {
    acquire(state, upgradeById(def.requires))
  }
  for (let i = 0; i < times; i++) {
    assert(buyUpgrade(state, def.id), `${def.id} liess sich nicht kaufen`)
  }
}

export function upgradesSuite(): void {
  suite('sim/upgrades · Wirkung')

  // -------------------------------------------------------------------------
  // Der Kauf selbst
  // -------------------------------------------------------------------------

  check('ein Kauf kostet Gold und hebt die Stufe', () => {
    const state = rig()
    state.run.gold = 500
    const def = upgradeById('f1.hammerfall')
    const cost = nextUpgradeCost(state, def.id)
    assert(cost !== null, 'Hammerfall hat keinen Preis')

    assertEqual(buyUpgrade(state, def.id), true, 'der Kauf')
    assertEqual(upgradeLevel(state.run.upgrades, def.id), 1, 'die Stufe')
    assertEqual(state.run.gold, 500 - cost, 'das Gold')
  })

  check('ohne Gold kauft niemand', () => {
    const state = rig()
    state.run.gold = 0
    assertEqual(buyUpgrade(state, 'f1.hammerfall'), false, 'der Kauf')
    assertEqual(upgradeLevel(state.run.upgrades, 'f1.hammerfall'), 0, 'die Stufe')
  })

  check('jede Stufe kostet mehr als die vorige', () => {
    const state = rig()
    const def = upgradeById('f1.drumfire')
    let previous = 0
    for (let level = 1; level <= def.maxLevel; level++) {
      const cost = nextUpgradeCost(state, def.id)
      assert(cost !== null, `Stufe ${level} hat keinen Preis`)
      assert(cost > previous, `Stufe ${level} kostet nicht mehr als die vorige`)
      previous = cost
      buyUpgrade(state, def.id)
    }
    assertEqual(nextUpgradeCost(state, def.id), null, 'nach der Hoechststufe')
    assertEqual(upgradeBlock(state, def.id), 'max', 'der Grund')
  })

  // -------------------------------------------------------------------------
  // Die Sperren
  // -------------------------------------------------------------------------

  check('ein Fenster ist zu, bis sein Tor gekauft ist', () => {
    const state = rig()
    const inner = upgradesInWindow(2)[0] as UpgradeDef

    assertEqual(windowOpen(state.run.upgrades, 2), false, 'Fenster 2 zu Beginn')
    assertEqual(upgradeBlock(state, inner.id), 'window', 'der Grund')
    // Nicht nur unsichtbar, sondern unkaufbar: Die Regel sitzt in der Handlung, nicht in
    // ihrer Darstellung - ein Aufruf am Menue vorbei darf nichts bewirken.
    assertEqual(buyUpgrade(state, inner.id), false, 'der Kauf am Tor vorbei')
    assertEqual(upgradeLevel(state.run.upgrades, inner.id), 0, 'die Stufe')

    assert(buyUpgrade(state, 'f1.secondarray'), 'das Tor liess sich nicht kaufen')
    assertEqual(windowOpen(state.run.upgrades, 2), true, 'Fenster 2 nach dem Tor')
    assertEqual(upgradeBlock(state, inner.id), null, 'die Sperre nach dem Tor')
  })

  check('Fenster 4 laesst sich nicht oeffnen', () => {
    const state = rig()
    for (const def of UPGRADES) {
      if (def.effect.kind === 'window') assert(def.effect.opens !== 4, `${def.id} oeffnet Fenster 4`)
    }
    assertEqual(windowOpen(state.run.upgrades, 4), false, 'Fenster 4')
  })

  check('eine Voraussetzung sperrt, bis sie steht', () => {
    const state = rig()
    acquire(state, upgradeById('f2.resonance')) // oeffnet Fenster 2 gleich mit

    assertEqual(upgradeBlock(state, 'f2.brink'), 'requires', 'Brink ohne Last Stand')
    assertEqual(buyUpgrade(state, 'f2.brink'), false, 'der Kauf')

    // `Last Stand` haengt selbst an `First Spark` - die Kette wird von unten aufgeloest.
    acquire(state, upgradeById('f2.laststand'))
    assertEqual(upgradeBlock(state, 'f2.brink'), null, 'Brink mit Last Stand')
  })

  check('die beiden Doktrinen schliessen einander aus', () => {
    const state = rig()
    acquire(state, upgradeById('f3.irondoctrine'))

    assertEqual(hasRule(state, 'ironDoctrine'), true, 'Iron Doctrine')
    assertEqual(upgradeBlock(state, 'f3.stormdoctrine'), 'excluded', 'Storm Doctrine')
    assertEqual(buyUpgrade(state, 'f3.stormdoctrine'), false, 'der Kauf')
    assertEqual(hasRule(state, 'stormDoctrine'), false, 'Storm Doctrine bleibt aus')
  })

  // -------------------------------------------------------------------------
  // Die Wirkung - jedes einzelne Upgrade
  // -------------------------------------------------------------------------

  /*
   * Die zentrale Pruefung: Jeder der sechzig Eintraege wird gekauft, und **vorher/nachher**
   * muss sich eine dazu passende Groesse bewegt haben.
   *
   * Je Wirkungsart eine eigene Messung:
   *
   *   flat/percent  der Kampfwert eines Moduls, das dieses Ziel trifft
   *   global        die Run-Groesse selbst
   *   special       die Summe des Sonderwerts
   *   rule          `hasRule` schlaegt um
   *   window        das Fenster geht auf
   *
   * `global` und `special` messen die **Summe**, nicht ihre Auswirkung im Kampf: Ob ein
   * hoeherer `chainHops` wirklich einen Blitz weiterspringen laesst, gehoert zu der Mechanik
   * und nicht zum Katalog. Was diese Pruefung ausschliesst, ist der Fall, der bei einer
   * Handliste wirklich droht - ein Eintrag, dessen Betrag nirgends ankommt.
   */
  check('jedes Upgrade bewegt die Groesse, die es verspricht', () => {
    for (const def of UPGRADES) {
      const state = rig()
      const core = 'core'
      const turrets = new Map<string, string>()
      for (const tower of TOWERS) {
        // Nur Tuerme bauen, die dieses Upgrade auch meint - eine volle Station je Eintrag
        // waere sechzigmal derselbe Aufbau.
        const effect = def.effect
        if (effect.kind !== 'flat' && effect.kind !== 'percent') continue
        if (!targetTowers(effect.target).includes(tower.id)) continue
        if (tower.stats.damage <= 0 && tower.stats.attackSpeed <= 0) continue
        turrets.set(tower.id, build(state, tower.id))
      }

      const measure = (): string => {
        const effect = def.effect
        switch (effect.kind) {
          case 'flat':
          case 'percent': {
            if (effect.target.kind === 'core') return String(statsOf(state, core)[effect.stat])
            const uid = [...turrets.values()][0]
            return uid === undefined ? '-' : String(statsOf(state, uid)[effect.stat])
          }
          case 'global':
            return String(globalValue(state, effect.key))
          case 'special':
            return String(specialValue(state, effect.key))
          case 'rule':
            return String(hasRule(state, effect.id))
          case 'window':
            return String(windowOpen(state.run.upgrades, effect.opens))
        }
      }

      const before = measure()
      acquire(state, def)
      const after = measure()

      assert(
        before !== after,
        `${def.id} ("${def.name}") veraendert nichts: ${before} bleibt ${before}`,
      )
    }
  })

  // -------------------------------------------------------------------------
  // Die Reihenfolge der Kette
  // -------------------------------------------------------------------------

  /*
   * **Flach vor Prozent** - die wichtigste Zusage von `sim/stats.ts`.
   *
   * Gemessen wird sie nicht an einem Kommentar, sondern am Ergebnis: Wer beides kauft, muss
   * mehr bekommen als die Summe der Einzelwirkungen. Genau das ist der Unterschied zwischen
   * `(Basis + flach) x (1 + Prozent)` und `Basis x (1 + Prozent) + flach`.
   */
  check('flache Zuschlaege stehen vor den Prozenten', () => {
    const base = statsOf(rig(), 'core').attackSpeed

    const onlyFlat = rig()
    acquire(onlyFlat, upgradeById('f1.drumfire'), 10)
    const flat = statsOf(onlyFlat, 'core').attackSpeed

    const onlyPercent = rig()
    acquire(onlyPercent, upgradeById('f3.overclock'), 5)
    const percent = statsOf(onlyPercent, 'core').attackSpeed

    const both = rig()
    acquire(both, upgradeById('f1.drumfire'), 10)
    acquire(both, upgradeById('f3.overclock'), 5)
    const together = statsOf(both, 'core').attackSpeed

    assert(flat > base, 'Drumfire wirkt nicht')
    assert(percent > base, 'Overclock wirkt nicht')
    assert(
      together > flat + (percent - base) + 1e-9,
      `zusammen ${together} ist nicht mehr als die Summe der Einzelwirkungen`,
    )
  })

  /*
   * Ein flacher Zuschlag darf keinen Wert treffen, den das Modul gar nicht hat.
   *
   * `Vanguard` ist der Fall, an dem das auffaellt: Es gibt jedem Turret ein Viertel der
   * flachen Kern-Zuschlaege - **jedem**, auch dem Schildgenerator und dem Verstaerker. Ohne
   * die Regel schoessen die beiden danach.
   */
  check('ein flacher Zuschlag macht aus einem Support-Modul kein Geschuetz', () => {
    const state = rig()
    const shield = build(state, 'bulwark')
    const amplifier = build(state, 'amplifier')

    acquire(state, upgradeById('f1.hammerfall'), 20)
    acquire(state, upgradeById('f3.vanguard'))

    assertEqual(hasRule(state, 'vanguard'), true, 'Vanguard')
    for (const uid of [shield, amplifier]) {
      const stats = statsOf(state, uid)
      for (const key of STAT_KEYS) {
        assertEqual(stats[key], 0, `${uid} hat ${key} bekommen`)
      }
    }
  })

  check('Vanguard teilt die flachen Kern-Zuschlaege mit den Turrets', () => {
    const state = rig()
    const gun = build(state, 'autocannon')
    const before = statsOf(state, gun).damage

    acquire(state, upgradeById('f1.hammerfall'), 10)
    const shared = statsOf(state, gun).damage
    assertEqual(shared, before, 'ohne Vanguard bekommt das Turret nichts vom Kern')

    acquire(state, upgradeById('f3.vanguard'))
    const after = statsOf(state, gun).damage
    // Zehn Stufen zu je 2 Schaden, ein Viertel davon: genau 5.
    assertEqual(Math.round((after - before) * 1000) / 1000, 5, 'der geteilte Betrag')
  })

  check('die Doktrin hebt die eine Klasse und senkt die andere', () => {
    const state = rig()
    const gun = build(state, 'autocannon') // kinetic
    const flamer = build(state, 'flamer') // elemental

    const gunBefore = statsOf(state, gun).damage
    const flamerBefore = statsOf(state, flamer).damage

    acquire(state, upgradeById('f3.irondoctrine'))

    assert(statsOf(state, gun).damage > gunBefore, 'Kinetic wurde nicht staerker')
    assert(statsOf(state, flamer).damage < flamerBefore, 'Elemental wurde nicht schwaecher')
  })

  // -------------------------------------------------------------------------
  // Die Groessen der Station
  // -------------------------------------------------------------------------

  check('die Huelle waechst flach und wird danach vervielfacht', () => {
    const state = rig()
    const before = maxStationHp(state)

    acquire(state, upgradeById('f1.bulkhead'), 4) // 4 x 25 = 100 flach
    const flat = maxStationHp(state)
    assertEqual(flat - before, 100, 'der flache Zuschlag')

    acquire(state, upgradeById('f3.bastion'), 10) // +50 %
    const scaled = maxStationHp(state)
    // Der Faktor greift auf **alles**, auch auf den eben gekauften flachen Teil.
    assert(scaled > flat * 1.4, `${scaled} ist kein Vielfaches von ${flat}`)
  })

  check('Pack Mule zahlt je gebautem Turret', () => {
    const state = rig()
    acquire(state, upgradeById('f1.packmule'), 3) // 3 x 3 = 9 je Turret

    const empty = maxStationHp(state)
    build(state, 'autocannon')
    const one = maxStationHp(state)
    build(state, 'cannon')
    const two = maxStationHp(state)

    assert(one > empty, 'der erste Turm bringt nichts')
    assertEqual(two - one, one - empty, 'der zweite Turm bringt etwas anderes als der erste')
  })

  check('ein gekaufter Turmplatz steht sofort an der Station', () => {
    const state = rig()
    const before = state.run.station.slots
    assertEqual(towerSlots(state), before, 'die Rechnung stimmt vor dem Kauf nicht')

    acquire(state, upgradeById('f1.foreman'))

    assertEqual(towerSlots(state), before + 1, 'die Rechnung')
    // Der eigentliche Punkt: Er steht auch **in der Station** und nicht nur in der Formel.
    assertEqual(state.run.station.slots, before + 1, 'die Station')
  })

  check('der Sammelradius waechst flach', () => {
    const state = rig()
    const before = collectRadius(state)
    acquire(state, upgradeById('f1.magnetglove'), 3)
    assertEqual(collectRadius(state) - before, 60, 'drei Stufen zu je 20 m')
  })

  // -------------------------------------------------------------------------
  // Buffs
  // -------------------------------------------------------------------------

  /*
   * Gemessen wird am **Kern**, nicht an einem Turm.
   *
   * Der Grund ist die Bauform: `build` haengt jedes Modul an eine freie Kante des Kerns.
   * Verstaerker und Autocannon sind damit beide Nachbarn des Kerns, aber nicht Nachbarn
   * **voneinander** - sie teilen keine Kante, und genau daran haengt der Buff (GDD 03
   * Abschnitt 9). Der Kern ist das einzige Modul, das der Verstaerker in diesem Aufbau
   * sicher erreicht.
   */
  check('Choir macht den Verstaerker staerker', () => {
    const state = rig()
    build(state, 'amplifier')
    const before = stationView(state).buffs.get('core')?.applied.damage ?? 0
    assert(before > 0, 'der Verstaerker erreicht den Kern gar nicht')

    acquire(state, upgradeById('f2.choir'), 10)
    const after = stationView(state).buffs.get('core')?.applied.damage ?? 0

    assert(after > before, `der Buff wurde nicht staerker: ${before} bleibt ${after}`)
  })

  // -------------------------------------------------------------------------
  // Was ein Prestige mit dem Katalog macht
  // -------------------------------------------------------------------------

  /*
   * Der Grund, warum die Tore in `run.upgrades` stehen und nicht in einem eigenen Feld.
   *
   * Ein Fenster ist damit **kein Zustand, den jemand zuruecksetzen muss** - es verschwindet,
   * weil `doPrestige` den ganzen `run`-Block ersetzt. Diese Pruefung haelt fest, dass das
   * auch so bleibt: Wer die Freischaltung eines Tages doch in `permanent` schoebe, bekaeme
   * hier Rot - und zwar bevor ein Spieler ein Fenster behaelt, das er nicht bezahlt hat.
   */
  check('ein Prestige nimmt Upgrades und Fenster zurueck', () => {
    const state = rig()
    state.permanent.prestigePoints = 0
    acquire(state, upgradeById('f2.resonance'), 3)

    assertEqual(windowOpen(state.run.upgrades, 2), true, 'Fenster 2 ist offen')
    assert(upgradeLevel(state.run.upgrades, 'f2.resonance') > 0, 'Resonance steht')

    // Die Voraussetzungen fuer ein Prestige direkt setzen - geprueft wird die Folge, nicht
    // der Weg dorthin.
    state.run.goldEarned = 1e9
    state.run.wave = 60
    assertEqual(performPrestige(state), true, 'das Prestige')

    assertEqual(Object.keys(state.run.upgrades).length, 0, 'kein Upgrade ueberlebt')
    assertEqual(windowOpen(state.run.upgrades, 2), false, 'Fenster 2 ist wieder zu')
    assertEqual(state.runtime.upgradeWindow, 1, 'der Reiter steht wieder auf Fenster 1')
  })

  // -------------------------------------------------------------------------
  // Perks, Haendler und Prestige - dieselbe Union (E7)
  // -------------------------------------------------------------------------

  /*
   * Seit E7 beschreiben Katalog, Perks und die Zahlenknoten des Prestige-Baums ihre Wirkung
   * in **derselben** Form. Der Gewinn ist nicht die Ersparnis an Code, sondern dass es keine
   * zweite Stelle mehr gibt, an der ein Effekt anders gemeint sein koennte.
   *
   * Geprueft wird deshalb nicht die Form, sondern die Folge: dass alle drei durch dieselbe
   * Kette laufen und sich **addieren**.
   */
  check('Perk, Prestige-Knoten und Upgrade zahlen auf dieselbe Groesse ein', () => {
    const state = rig()
    assertEqual(globalMultiplier(state, 'goldBonus'), 1, 'ohne alles')

    acquire(state, upgradeById('f1.scrapperseye'))
    const withUpgrade = globalMultiplier(state, 'goldBonus')
    assert(withUpgrade > 1, 'das Upgrade wirkt nicht')

    state.run.perks.push('perk.gold.1')
    const withPerk = globalMultiplier(state, 'goldBonus')
    assert(withPerk > withUpgrade, 'der Perk legt nicht drauf')

    state.permanent.prestigeNodes.push('eco.gold1')
    const withNode = globalMultiplier(state, 'goldBonus')
    assert(withNode > withPerk, 'der Prestige-Knoten legt nicht drauf')

    // Additiv, nicht multiplikativ - dieselbe Regel wie ueberall (GDD 03 Abschnitt 9).
    assertEqual(Math.round((withNode - 1) * 100), 8 + 10 + 10, 'die Summe der drei Anteile')
  })

  check('ein Perk wirkt auf den Kern UND auf die Turrets', () => {
    // Sein Ziel ist `modules` - das war mit der alten Perk-Form gar nicht ausdrueckbar.
    const state = rig()
    const gun = build(state, 'autocannon')
    const coreBefore = statsOf(state, 'core').damage
    const gunBefore = statsOf(state, gun).damage

    state.run.perks.push('perk.damage.1')

    assert(statsOf(state, 'core').damage > coreBefore, 'der Kern bekommt nichts')
    assert(statsOf(state, gun).damage > gunBefore, 'das Turret bekommt nichts')
  })

  check('ein Kauf zieht die Stationssicht nach', () => {
    // Die Sicht haengt an einem Zaehler und nicht am Zustand - ohne `invalidateStationView`
    // in `buyUpgrade` zeigte `Choir` erst Wirkung, wenn das naechste Modul gesetzt wird.
    const state = rig()
    build(state, 'amplifier')

    const before = stationView(state).buffs.get('core')?.applied.damage ?? 0
    acquire(state, upgradeById('f2.choir'), 5)
    // Kein `sync` dazwischen: Genau das ist der Punkt der Pruefung.
    const after = stationView(state).buffs.get('core')?.applied.damage ?? 0

    assert(after > before, 'die Sicht wurde nach dem Kauf nicht neu gerechnet')
  })
}
