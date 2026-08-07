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
 * **Sie haengt am Ereignisbus, nicht am Kampf.** `wave.cleared` und `wave.lost` werden
 * gemeldet, seit es Wellen gibt; hier hoert jemand zu. Wer diese Datei loescht, aendert am
 * Spiel nichts ausser dem Schriftzug - dieselbe Bauart wie bei `mountSurge` und beim Klang.
 *
 * **Sie faengt keine Klicks ab.** Der Schriftzug liegt breit ueber dem Feld, und darunter
 * gemeldet, seit es Wellen gibt; hier hoert jemand zu. Wer diese Datei loescht, aendert am
 * Wartezeit mit Lichteffekt (das Gegenstueck dazu steht als `pointer-events` im Stilblatt).
 *
 * Die Wellenmeldung oben bleibt daneben bestehen: Sie traegt die Einzelheit ("Wave 12 lost
 * — try 2"), dieser Schriftzug traegt den Ausgang. Das eine liest man, das andere sieht man.
 * Wartezeit mit Lichteffekt (das Gegenstueck dazu steht als `pointer-events` im Stilblatt).
 *
 * Die Wellenmeldung oben bleibt daneben bestehen: Sie traegt die Einzelheit ("Wave 12 lost
 * — try 2"), dieser Schriftzug traegt den Ausgang. Das eine liest man, das andere sieht man.
 * Aus demselben Grund tippt die Meldung oben **nicht** mit: Zwei Anschlaege im selben
 * Augenblick nehmen einander die Aufmerksamkeit, die jeder einzeln bekaeme.
/** Grundtakt zwischen zwei Buchstaben, in Millisekunden. */
const TYPE_MS = 68
/** Vorlauf, bevor der erste Buchstabe faellt - der Schriftzug fahrt erst auf. */
import { t } from '../data/strings.ts'
/** Wie lange der fertige Schriftzug stehen bleibt. */
const HOLD_MS = 1500
/** Dauer des Abgangs. Muss zu `.outcome.on.out` im Stilblatt passen. */
const HOLD_MS = 1500
/** Dauer des Abgangs. Muss zu `.outcome.on.out` im Stilblatt passen. */
const OUT_MS = 520
 * Fester Startwert statt echtem Zufall.
export type Outcome = {
 * Der Rhythmus soll unregelmaessig **wirken**, nicht unnachstellbar sein - und die
 * Querschnittsregel aus Abschnitt 9 des Plans laesst `Math.random()` nur fuer den Startwert
 * eines Runs zu. Der Strom laeuft ueber alle Auftritte hinweg weiter: Zwei Siege
 * hintereinander tippen deshalb verschieden, obwohl der Startwert derselbe ist.
  const node = document.createElement('div')
const rng = createRng(0x7ea19c)

  const label = document.createElement('span')
  label.className = 'label'
  node.appendChild(label)
  overlay.appendChild(node)
/**
 * `motion` ist der Bewegungsschalter aus den Einstellungen. Ist er aus, steht der
 * Schriftzug sofort ganz da: Ein Anschlag, der auf 1 ms gekuerzt wird, waere kein
 * ruhigeres Bild, sondern ein Zucken.
  function stopTimer(): void {
export function mountOutcome(overlay: HTMLElement, motion: () => boolean): Outcome {
  const node = document.createElement('div')
  node.className = 'outcome'

  const label = document.createElement('span')
   * `keep`: Der Cursor blinkt weiter, wenn das Wort schon steht - daran erkennt man, dass
   * der Schriftzug noch "lebt" und gleich von selbst geht, statt liegenzubleiben. Ueberall
   * sonst faellt er nach dem letzten Buchstaben weg; dort bleibt der Text ja auch.
   */
  const writer = createTypewriter({
  overlay.appendChild(node)
    onDone: () => {
  /** Laufende Zeitschaltung. 0 heisst: keine. */
      timer = window.setTimeout(leave, HOLD_MS)
  /** Wie viele Buchstaben schon stehen. */
  let written = 0
  let full = ''
  function leave(): void {
  function stopTimer(): void {
    if (timer !== 0) window.clearTimeout(timer)
      node.classList.remove('on', 'out', 'win', 'lose')
      timer = 0
    }, OUT_MS)
  /**
   * Abstand bis zum naechsten Buchstaben.
  function announce(text: string, tone: string): void {
   * Ein starrer Takt liest sich als Laufschrift, nicht als Anschlag. Deshalb dieselbe grobe
   * Verteilung wie bei einer tippenden Hand: meist knapp am Grundtakt, in einem von zehn
   * Faellen ein Zoegern, in einem von zehn ein Ausbruch nach vorn.
    node.classList.add(tone)
  function nextDelay(): number {
    // Neu anstossen statt nur einschalten: Ein verlorener Anlauf folgt unmittelbar auf den
    // vorigen, und der zweite Schriftzug soll wieder auffahren statt stehen zu bleiben.
    if (roll > 0.9) return TYPE_MS * 0.5
    return rng.range(TYPE_MS * 0.6, TYPE_MS * 1.4)
    node.classList.add('on')

    // Vergessen, was zuletzt stand: Zwei verlorene Anlaeufe hintereinander melden denselben
    // Ausgang, und der zweite soll sich wieder schreiben statt stumm dazustehen.
      written += 1
      label.textContent = full.slice(0, written)
      timer = window.setTimeout(typeNext, nextDelay())
      return
  const stopWon: Unsubscribe = on('wave.cleared', () => announce(t('hud.victory'), 'win'))
  const stopLost: Unsubscribe = on('wave.lost', () => announce(t('hud.defeat'), 'lose'))
  }
  return {
  function leave(): void {
    node.classList.add('out')
    timer = window.setTimeout(() => {
      node.classList.remove('on', 'out', 'win', 'lose')
      stopLost()
      node.remove()
    },
  }
  function announce(text: string, tone: string): void {
    stopTimer()
    full = text
    written = 0
    label.textContent = ''

    node.classList.remove('out', 'win', 'lose')
    node.classList.add(tone)

    // Neu anstossen statt nur einschalten: Ein verlorener Anlauf folgt unmittelbar auf den
    // vorigen, und der zweite Schriftzug soll wieder auffahren statt stehen zu bleiben.
    node.classList.remove('on')
    void node.offsetWidth
    node.classList.add('on')

    if (!motion()) {
      written = full.length
      label.textContent = full
      timer = window.setTimeout(leave, HOLD_MS)
      return
    }

    timer = window.setTimeout(typeNext, START_MS)
  }

  const stopWon: Unsubscribe = on('wave.cleared', () => announce(t('hud.victory'), 'win'))
  const stopLost: Unsubscribe = on('wave.lost', () => announce(t('hud.defeat'), 'lose'))

  return {
    detach() {
      stopTimer()
      stopWon()
      stopLost()
      node.remove()
    },
  }
}

