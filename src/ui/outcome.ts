/**
 * Der Ausgang einer Welle, gross in der Mitte des Feldes: VICTORY oder DEFEAT.
 *
 * Der Schriftzug **schreibt sich selbst**, Buchstabe fuer Buchstabe, mit blinkendem Cursor
 * dahinter. Das ist kein Zierrat, sondern die Antwort auf ein Problem der Zaesur: Eine
 * Welle endet in einem einzigen Bild - der Zaehler springt, das Feld ist leer - und eine
 * Meldung, die im selben Augenblick fertig dasteht, ist vorbei, bevor der Blick sie
 * gefunden hat. Der laufende Anschlag gibt dem Ausgang eine **Dauer** und zieht das Auge
 * in die Mitte, wo gerade nichts mehr passiert.
 *
 * Der Anschlag selbst steht seit E18 in `ui/typewriter.ts` und ist von dort aus ueber die
 * ganze Oberflaeche verteilt - hier war er zuerst. Diese Datei sagt nur noch, **was** sich
 * schreibt und was danach damit geschieht.
 *
 * Zwei Entscheidungen praegen die Datei:
 *
 * **Sie haengt am Ereignisbus, nicht am Kampf.** `wave.cleared` und `wave.lost` werden
 * gemeldet, seit es Wellen gibt; hier hoert jemand zu. Wer diese Datei loescht, aendert am
 * Spiel nichts ausser dem Schriftzug - dieselbe Bauart wie bei `mountSurge` und beim Klang.
 *
 * **Sie faengt keine Klicks ab.** Der Schriftzug liegt breit ueber dem Feld, und darunter
 * wird Gold eingesammelt. Zwei Sekunden gesperrte Bedienung nach jeder Welle waeren eine
 * Wartezeit mit Lichteffekt (das Gegenstueck dazu steht als `pointer-events` im Stilblatt).
 *
 * Die Wellenmeldung oben bleibt daneben bestehen: Sie traegt die Einzelheit ("Wave 12 lost
 * — try 2"), dieser Schriftzug traegt den Ausgang. Das eine liest man, das andere sieht man.
 * Aus demselben Grund tippt die Meldung oben **nicht** mit: Zwei Anschlaege im selben
 * Augenblick nehmen einander die Aufmerksamkeit, die jeder einzeln bekaeme.
 */

import { on, type Unsubscribe } from '../core/events.ts'
import { t } from '../data/strings.ts'
import { createTypewriter } from './typewriter.ts'

/** Wie lange der fertige Schriftzug stehen bleibt. */
const HOLD_MS = 1500
/** Dauer des Abgangs. Muss zu `.outcome.on.out` im Stilblatt passen. */
const OUT_MS = 520

export type Outcome = {
  detach(): void
}

export function mountOutcome(overlay: HTMLElement): Outcome {
  const node = document.createElement('div')
  node.className = 'outcome'

  const label = document.createElement('span')
  label.className = 'label'
  node.appendChild(label)
  overlay.appendChild(node)

  /** Zeitschaltung fuer das Stehenbleiben und den Abgang. 0 heisst: keine. */
  let timer = 0

  function stopTimer(): void {
    if (timer !== 0) window.clearTimeout(timer)
    timer = 0
  }

  /*
   * `keep`: Der Cursor blinkt weiter, wenn das Wort schon steht - daran erkennt man, dass
   * der Schriftzug noch "lebt" und gleich von selbst geht, statt liegenzubleiben. Ueberall
   * sonst faellt er nach dem letzten Buchstaben weg; dort bleibt der Text ja auch.
   */
  const writer = createTypewriter({
    caret: 'keep',
    onDone: () => {
      stopTimer()
      timer = window.setTimeout(leave, HOLD_MS)
    },
  })

  function leave(): void {
    node.classList.add('out')
    timer = window.setTimeout(() => {
      node.classList.remove('on', 'out', 'win', 'lose')
      timer = 0
    }, OUT_MS)
  }

  function announce(text: string, tone: string): void {
    stopTimer()

    node.classList.remove('out', 'win', 'lose')
    node.classList.add(tone)

    // Neu anstossen statt nur einschalten: Ein verlorener Anlauf folgt unmittelbar auf den
    // vorigen, und der zweite Schriftzug soll wieder auffahren statt stehen zu bleiben.
    node.classList.remove('on')
    void node.offsetWidth
    node.classList.add('on')

    // Vergessen, was zuletzt stand: Zwei verlorene Anlaeufe hintereinander melden denselben
    // Ausgang, und der zweite soll sich wieder schreiben statt stumm dazustehen.
    writer.reset()
    writer.write({ node: label, text })
  }

  const stopWon: Unsubscribe = on('wave.cleared', () => announce(t('hud.victory'), 'win'))
  const stopLost: Unsubscribe = on('wave.lost', () => announce(t('hud.defeat'), 'lose'))

  return {
    detach() {
      stopTimer()
      writer.reset()
      stopWon()
      stopLost()
      node.remove()
    },
  }
}
