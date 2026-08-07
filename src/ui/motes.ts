/**
 * Schwebende Funken hinter einem Fenster (GDD 13 Abschnitt 10: Neon, aber ruhig).
 *
 * Das Aufstiegsfenster hatte bisher einen leeren, weichgezeichneten Hintergrund. Das ist
 * ehrlich - dahinter laeuft der Kampf weiter -, aber es ist auch tot: Der Augenblick, in
 * dem der Spieler seine Stufe abholt, sah aus wie ein Dialogfeld ueber einem Standbild.
 * Die Funken geben ihm eine **Dauer**. Sie steigen langsam von unten auf, driften seitlich
 * weg und verglimmen, bevor sie oben ankommen.
 *
 * Drei Entscheidungen:
 *
 * **Der Browser bewegt sie, nicht die Schleife.** Jeder Funke ist ein Knoten mit einer
 * endlosen CSS-Bewegung. Eine Ebene, die pro Bild ueber `requestAnimationFrame` gezeichnet
 * wuerde, haenge an der Spielzeit - und die kommt laut Querschnittsregel nur aus
 * `core/loop.ts`. Ein Fenster, dessen Hintergrund bei Tempo x4 viermal so schnell flimmert,
 * waere ausserdem falsch: Der Aufstieg gehoert dem Spieler, nicht der Welle.
 *
 * **Die Lage ist gewuerfelt, aber immer gleich.** Der Generator bekommt einen festen
 * Startwert und laeuft nur beim Aufbau. Damit sind die Funken ueber die Breite verstreut,
 * ohne dass ein Bild vom naechsten abweicht - und ohne dass sie am Zufall des Runs ziehen,
 * aus dem das Perk-Angebot gezogen wird.
 *
 * **Ein Teil traegt die Farbe des Angebots.** Jeder dritte Funke glimmt in der Seltenheit
 * einer der ausliegenden Karten. Bei einem legendaeren Angebot liegt damit Gold in der
 * Luft, bevor man die Karten gelesen hat - dieselbe Sprache wie der Kartenrahmen, nur
 * eine Stufe leiser.
 */

import { createRng } from '../core/rng.ts'

export type Motes = {
  /** Die Ebene. Vor das Fenster haengen, damit sie dahinter liegt. */
  node: HTMLElement
  /**
   * Die Farben, in denen ein Teil der Funken glimmt. Eine leere Liste laesst allen die
   * Grundfarbe der Oberflaeche.
   */
  setTones(tones: readonly string[]): void
}

/**
 * Wie viele Funken. Genug, dass die Flaeche nie ganz leer ist, wenig genug, dass die Ebene
 * nicht zum Sternenhimmel wird - der Blick gehoert den drei Karten.
 */
const COUNT = 26

/** Jeder wievielte Funke die Farbe einer Karte traegt. */
const TONED_EVERY = 3

/** Fester Startwert - siehe Kopf: gewuerfelt, aber immer dasselbe Bild. */
const SEED = 0x7e1a3b

export function createMotes(): Motes {
  const node = document.createElement('div')
  node.className = 'mote-field'
  node.setAttribute('aria-hidden', 'true')

  const rng = createRng(SEED)
  const motes: HTMLElement[] = []

  for (let i = 0; i < COUNT; i++) {
    const mote = document.createElement('i')
    mote.style.setProperty('--x', `${rng.range(1, 99).toFixed(1)}%`)
    mote.style.setProperty('--size', `${rng.range(1.6, 5).toFixed(1)}px`)
    // Wie weit er kommt, bevor er verglimmt. Die kurzen bleiben unten und geben der Ebene
    // Tiefe; die langen ziehen bis in die Hoehe des Fensters.
    mote.style.setProperty('--rise', `${rng.int(170, 640)}px`)
    mote.style.setProperty('--drift', `${rng.int(-52, 52)}px`)
    mote.style.setProperty('--dur', `${rng.range(7, 16).toFixed(1)}s`)
    // Negativ: Die Bewegung startet mittendrin. Ohne das waere die Ebene in der ersten
    // Sekunde nach dem Aufgehen des Fensters leer - also genau dann, wenn man hinsieht.
    mote.style.setProperty('--delay', `-${rng.range(0, 16).toFixed(1)}s`)
    mote.style.setProperty('--peak', rng.range(0.2, 0.62).toFixed(2))
    motes.push(mote)
    node.appendChild(mote)
  }

  return {
    node,
    setTones(tones) {
      motes.forEach((mote, index) => {
        const tone = tones.length > 0 ? tones[index % tones.length] : undefined
        if (tone === undefined || index % TONED_EVERY !== 0) mote.style.removeProperty('--tone')
        else mote.style.setProperty('--tone', tone)
      })
    },
  }
}
