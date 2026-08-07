/**
 * Der Hinweiszettel (GDD 14 Abschnitt 4a).
 *
 * Bewusst **kein Fenster**: Er liegt am Rand, haelt nichts an und faengt keine Klicks ab.
 * Das ist die zentrale Regel des Abschnitts - im Idle-Genre wollen Spieler sofort spielen,
 * und ein Hinweis, der den Ablauf unterbricht, ist ein kleines Tutorial und damit genau
 * das, was das GDD ausschliesst.
 *
 * Er sitzt in der Overlay-Ebene und ist deshalb in jedem Bereich zu sehen: Ein Hinweis
 * faellt im Augenblick der Relevanz, und der kann in der Basis liegen ("Buff-Tuerme
 * verstaerken ihre Nachbarn") oder im Kampf ("Fahre mit der Maus ueber Muenzen").
 *
 * Er baut sich nur neu auf, wenn ein **anderer** Hinweis faellig ist. Sonst setzte der
 * Browser die Auftrittsbewegung in jedem Bild neu an, und der Zettel zitterte.
 */

import { t } from '../data/strings.ts'
import type { GameState } from '../app/state.ts'
import { markHintSeen, pendingHint } from '../sim/hints.ts'
import { setSlideLabel } from './slide.ts'
import { createTypewriter } from './typewriter.ts'

export type HintPanel = {
  /** Pro Bild aufrufen - prueft nur, ob sich der faellige Hinweis geaendert hat. */
  update(): void
  detach(): void
}

export function mountHints(state: GameState, overlay: HTMLElement): HintPanel {
  const card = document.createElement('aside')
  card.className = 'hint-card'
  card.hidden = true

  const text = document.createElement('p')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'chip'
  setSlideLabel(button, t('hint.gotIt'))

  card.append(text, button)
  overlay.appendChild(card)

  /*
   * Der Hinweis **schreibt sich** (`ui/typewriter.ts`).
   *
   * Er ist der einzige Text im Spiel, der ungefragt kommt: Niemand hat ein Fenster
   * geoeffnet, niemand hat geklickt - er faellt mitten in eine Handlung hinein. Genau
   * deshalb faellt er sonst leicht durch. Der Zettel faehrt auf, und **dann** laeuft der
   * Satz an; die Bewegung im Text sagt "hier steht etwas Neues", ohne dass der Zettel
   * groesser, lauter oder aufdringlicher werden muesste. Das ist das Gegenteil dessen, was
   * GDD 14 Abschnitt 4a ausschliesst - er unterbricht nichts, er faellt nur auf.
   */
  const writer = createTypewriter()

  let shownId = ''

  button.addEventListener('click', () => {
    if (shownId === '') return
    markHintSeen(state, shownId)
    // Sofort verstecken statt auf das naechste Bild zu warten: Ein Knopf, der erst
    // sechzehn Millisekunden spaeter wirkt, fuehlt sich taub an.
    shownId = ''
    card.hidden = true
    // Der naechste Hinweis kann derselbe sein - nach dem Zuruecksetzen in den Einstellungen
    // faellt die ganze Reihe noch einmal. Ohne dieses Vergessen stuende er dann stumm da.
    writer.reset()
  })

  return {
    update() {
      const hint = pendingHint(state)
      const id = hint?.id ?? ''
      if (id === shownId) return
      shownId = id

      card.hidden = hint === null
      if (!hint) {
        writer.reset()
        return
      }

      // Die Auftrittsbewegung neu anstossen, falls unmittelbar ein zweiter Hinweis folgt.
      card.classList.remove('enter')
      void card.offsetWidth
      card.classList.add('enter')

      writer.write({ node: text, text: t(hint.key) })
    },
    detach() {
      writer.reset()
      card.remove()
    },
  }
}
