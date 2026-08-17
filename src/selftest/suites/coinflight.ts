/**
 * Die Flugbahn der eingesammelten Muenzen (`ui/coinflight.ts`).
 *
 * Diese Suite gibt es, weil hier genau **ein** Fehler moeglich war und er zweimal
 * passiert ist: Die Muenzen verliessen das Bild. Der Bogen stieg um einen Anteil der
 * Flugstrecke, das Goldschild wanderte spaeter in die obere linke Ecke - und ueber einer
 * Anzeige, die 14 Bildpunkte unter der Fensterkante sitzt, ist fuer einen Bogen von
 * zweihundert Bildpunkten kein Platz. Sichtbar war davon nichts Auffaelliges: Die Muenze
 * flog los, war weg, und die Zahl oben wurde groesser. Also genau der Bruch, den die
 * Flugebene beseitigen sollte, nur mit mehr Aufwand.
 *
 * Am Bild laesst sich das nicht festhalten - eine Bewegung, die 640 ms dauert, steht auf
 * keinem Standbild. An der Rechnung dagegen schon, und sie ist der Grund, warum `coinArc`
 * eine eigene, reine Funktion ist: Sie kennt weder Knoten noch Fenster, nur zwei Punkte
 * und eine Flaeche.
 *
 * Geprueft wird die Zusage aus `coinArc`: **Die ganze Bahn liegt im Rechteck zwischen
 * Aufhebepunkt und Anzeige.** Beide Ecken sind sichtbar - also ist es der Flug auch.
 */

import { assert, assertClose, assertEqual, check, suite } from '../../core/assert.ts'
import { arcPoint, coinArc, type Point } from '../../ui/coinflight.ts'

/** Ein Fenster in der Groesse, in der das Spiel gespielt wird. */
const AREA: Point = { x: 1280, y: 720 }

/**
 * Wo das Muenzsymbol im Goldschild wirklich sitzt - nachgemessen im laufenden Spiel.
 *
 * Der Wert steht hier als Zahl und nicht als Rechnung: Er ist der **schlimmste Fall**, um
 * den es geht. Eine Anzeige weiter unten hat immer mehr Luft nach oben, eine weiter oben
 * gibt es nicht.
 */
const SHIELD: Point = { x: 84, y: 14 }

/** Wie fein die Bahn abgetastet wird. Der Scheitel liegt selten auf einer runden Stelle. */
const SAMPLES = 200

/** Alle Punkte der Bahn, von Absprung bis Einschlag. */
function walk(arc: ReturnType<typeof coinArc>): Point[] {
  const points: Point[] = []
  for (let step = 0; step <= SAMPLES; step++) points.push(arcPoint(arc, step / SAMPLES))
  return points
}

/**
 * Aufhebepunkte quer ueber das ganze Feld - der Zeiger kann ueberall stehen.
 *
 * Die Reihe geht bewusst bis dicht an die obere Kante und bis links neben das Schild:
 * Genau dort war der alte Bogen am schlimmsten, weil `midY` dann schon knapp unter null
 * lag und die Steighoehe trotzdem aus der Flugstrecke kam.
 */
const PICKUPS: Point[] = []
for (let x = 40; x <= 1240; x += 100) {
  for (let y = 20; y <= 700; y += 68) PICKUPS.push({ x, y })
}

export function coinflightSuite(): void {
  suite('ui/coinflight')

  check('die Bahn bleibt im Rechteck zwischen Aufhebepunkt und Anzeige', () => {
    for (const from of PICKUPS) {
      for (let index = 0; index < 6; index++) {
        const arc = coinArc(from, SHIELD, index, AREA)
        const low = { x: Math.min(arc.start.x, SHIELD.x), y: Math.min(arc.start.y, SHIELD.y) }
        const high = { x: Math.max(arc.start.x, SHIELD.x), y: Math.max(arc.start.y, SHIELD.y) }

        for (const point of walk(arc)) {
          const where = `Aufheben ${from.x}/${from.y}, Muenze ${index}`
          // Eine Zehntel Toleranz gegen die Rundung der Gleitkommazahlen, mehr nicht:
          // Ein Bogen, der eine ganze Muenzbreite herausragt, ist der Fehler selbst.
          assert(point.x >= low.x - 0.1 && point.x <= high.x + 0.1, `waagerecht - ${where}`)
          assert(point.y >= low.y - 0.1 && point.y <= high.y + 0.1, `senkrecht - ${where}`)
        }
      }
    }
  })

  check('die Bahn bleibt im Fenster', () => {
    // Folgt aus der Regel darueber, sobald beide Ecken im Fenster liegen - aber das ist
    // die Zusage, um die es geht, und sie soll dastehen und nicht hergeleitet werden.
    for (const from of PICKUPS) {
      for (let index = 0; index < 6; index++) {
        for (const point of walk(coinArc(from, SHIELD, index, AREA))) {
          assert(point.x >= 0 && point.x <= AREA.x, `waagerecht bei ${from.x}/${from.y}`)
          assert(point.y >= 0 && point.y <= AREA.y, `senkrecht bei ${from.x}/${from.y}`)
        }
      }
    }
  })

  check('der Faecher schiebt keinen Absprung aus dem Bild', () => {
    // Der Ausschlag quer zur Bahn geht bei sechs Muenzen bis 45 Bildpunkte. Am Rand des
    // Feldes zeigt er nach draussen, und ohne die Klemme in `coinArc` startete die
    // Aussenste halb hinter der Fensterkante.
    for (const from of [
      { x: 6, y: 8 },
      { x: 1274, y: 712 },
      { x: 640, y: 4 },
    ]) {
      for (let index = 0; index < 6; index++) {
        const { start } = coinArc(from, SHIELD, index, AREA)
        assert(start.x >= 0 && start.x <= AREA.x, `waagerecht, Muenze ${index}`)
        assert(start.y >= 0 && start.y <= AREA.y, `senkrecht, Muenze ${index}`)
      }
    }
  })

  check('die erste Muenze faengt genau am Uebergabepunkt an', () => {
    // Sie ist die Fortsetzung der Feldmuenze und darf deshalb keinen Versatz haben - der
    // Faecher fasst erst ab der zweiten zu.
    const from = { x: 700, y: 400 }
    const { start } = coinArc(from, SHIELD, 0, AREA)
    assertClose(start.x, from.x, 1e-9)
    assertClose(start.y, from.y, 1e-9)
  })

  check('Anfang und Ende der Bahn sind Absprung und Ziel', () => {
    const arc = coinArc({ x: 700, y: 400 }, SHIELD, 3, AREA)
    const first = arcPoint(arc, 0)
    const last = arcPoint(arc, 1)
    assertClose(first.x, arc.start.x, 1e-9)
    assertClose(first.y, arc.start.y, 1e-9)
    assertClose(last.x, SHIELD.x, 1e-9)
    assertClose(last.y, SHIELD.y, 1e-9)
  })

  check('die Breite wird gleichmaessig zurueckgelegt', () => {
    /*
     * Der Kontrollpunkt liegt waagerecht **genau** in der Mitte, und dadurch kuerzt sich
     * der quadratische Anteil in x weg: Die Muenze legt die Breite linear zurueck, nur die
     * Hoehe geht im Bogen. Das ist der Unterschied zwischen einem Wurf und einer Schleife -
     * und es ist zugleich der Grund, warum die Bahn waagerecht nie ueber ihre Ecken
     * hinauslaeuft.
     */
    const from = { x: 900, y: 500 }
    const arc = coinArc(from, SHIELD, 0, AREA)
    for (let step = 0; step <= 10; step++) {
      const t = step / 10
      assertClose(arcPoint(arc, t).x, from.x + (SHIELD.x - from.x) * t, 1e-9, `bei t=${t}`)
    }
  })

  check('der Bogen steigt nie ueber die Anzeige', () => {
    /*
     * Die Decke selbst: Der hoechste Punkt der Bahn liegt nie ueber dem hoeher liegenden
     * ihrer beiden Enden. Bei einem Aufheben unterhalb der Zeile - also praktisch immer -
     * ist das die Zeile, und die Muenze kommt flach von der Seite herein, statt von oben
     * hereinzufallen. Ueber der Zeile ist kein Platz zum Hereinfallen.
     */
    for (const from of PICKUPS) {
      const arc = coinArc(from, SHIELD, 0, AREA)
      let top = Number.POSITIVE_INFINITY
      for (const point of walk(arc)) top = Math.min(top, point.y)
      assert(top >= Math.min(from.y, SHIELD.y) - 0.1, `Aufheben ${from.x}/${from.y}: ${top}`)
    }
  })

  check('ein weiter Flug bekommt einen sichtbaren Bogen', () => {
    // Die Decke darf den Bogen nicht wegkuerzen: Ein Aufheben unten im Feld hat reichlich
    // Hoehendifferenz, und ohne Bogen waere der Flug eine Ueberweisung.
    const arc = coinArc({ x: 900, y: 600 }, SHIELD, 0, AREA)
    const straight = (600 + SHIELD.y) / 2
    assert(arc.control.y < straight - 100, `Steighoehe zu klein: ${straight - arc.control.y}`)
  })

  check('ein Aufheben auf Hoehe der Anzeige fliegt gerade', () => {
    // Kein Platz, kein Bogen - und vor allem kein Bogen nach oben aus dem Bild heraus.
    const arc = coinArc({ x: 900, y: SHIELD.y }, SHIELD, 0, AREA)
    assertEqual(arc.control.y, SHIELD.y)
  })
}
