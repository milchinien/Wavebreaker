/**
 * Eingesammelte Muenzen fliegen ins Goldschild (GDD 13 Abschnitt 10).
 *
 * Auf dem Feld fahren die Muenzen dem Zeiger nach - das rechnet die Simulation
 * (`sim/combat.ts`, `Pickup`) und zeichnet die Kampfebene. Dort endet die Bewegung aber:
 * Die Muenze verglimmt unter dem Zeiger, und die Zahl oben links wird im selben Augenblick
 * groesser. Zwei Dinge geschehen gleichzeitig an zwei Orten, und der Spieler muss selbst
 * herstellen, dass sie zusammengehoeren.
 *
 * Diese Ebene schliesst die Luecke: Ab dem Zeiger fliegt eine sichtbare Muenze im Bogen ins
 * Goldschild und schlaegt dort ein. Erst dadurch **fuehrt** die Bewegung irgendwohin.
 *
 * Fuenf Entscheidungen:
 *
 * **Es ist eine Staffel, kein Nebeneinander.** Der wichtigste Punkt, und der, an dem es
 * lange falsch war: Die Muenze hier startet **erst dann**, wenn die Muenze auf dem Feld am
 * Zeiger ankommt - nicht im selben Augenblick, in dem sie dort losfaehrt. Vorher liefen
 * beide Bewegungen gleichzeitig: Unten hob die Muenze gerade erst vom Boden ab, waehrend
 * oben schon eine ins Schild flog. Der Spieler sah zwei Muenzen an zwei Orten und keine
 * einzige, die einen Weg nimmt - es wirkte, als komme die fliegende Muenze aus dem Nichts
 * und habe mit der aufgehobenen nichts zu tun. Die Uebergabe sitzt deshalb an
 * `PICKUP_LIFE` (`sim/combat.ts`), und zwar knapp davor: Die Feldmuenze verblasst auf den
 * letzten Pixeln, und die beiden Bewegungen sollen sich ueberlappen statt aneinander zu
 * stossen. Eine sichtbare Naht waere derselbe Bruch, nur kuerzer.
 *
 * **Der Browser bewegt sie, nicht die Schleife.** Dieselbe Regel wie bei den Funken in
 * `ui/motes.ts`: Der Flug gehoert dem Spieler und nicht der Welle, also darf er bei Tempo x4
 * nicht viermal so schnell sein. Die Bewegung laeuft deshalb ueber die Bildschirmuhr
 * (`Element.animate`) und nicht ueber `core/loop.ts`.
 *
 * **Der Bogen ist gerechnet, nicht gezeichnet** - und er hat seit dem Umbau eine Decke.
 * Siehe `coinArc`: Der Bogen steigt hoechstens bis auf die Hoehe der Anzeige, in die er
 * faellt. Vorher stieg er um einen Anteil der Flugstrecke, und das ging schief, sobald die
 * Zeile in die obere linke Ecke gewandert ist: Ueber einem Schild, das 14 Bildpunkte unter
 * der Fensterkante sitzt, ist kein Platz mehr fuer einen Bogen. Die Muenzen verliessen das
 * Bild nach oben (`body` beschneidet) und tauchten erst kurz vor dem Ziel wieder auf -
 * genau der Bruch, den diese Ebene beseitigen sollte.
 *
 * **Das Ziel wird gereicht, nicht gesucht.** `ui/hud.ts` gibt den Knoten des Muenzsymbols
 * heraus. Ein Waehler von hier aus griffe beim naechsten Umbau des Schilds stillschweigend
 * ins Leere - die Muenzen floegen dann in die linke obere Ecke des Fensters, und niemand
 * saehe, dass etwas kaputt ist.
 *
 * **Es gibt eine Obergrenze.** Wer den Zeiger ueber ein volles Feld zieht, loest zehn
 * Meldungen je Sekunde aus. Ohne Deckel haengen dann dreihundert Knoten in der Ebene, und
 * die Bildrate faellt genau in dem Augenblick, in dem es sich gut anfuehlen soll.
 */

import { on } from '../core/events.ts'
import { createRng } from '../core/rng.ts'
import { PICKUP_LIFE } from '../sim/combat.ts'

export type CoinFlight = {
  detach(): void
}

/** Ein Punkt in der Ebene, in Koordinaten der Flugebene. */
export type Point = { x: number; y: number }

/** Anfang, Kontrollpunkt und Ende einer Flugbahn - eine quadratische Bezierkurve. */
export type CoinArc = { start: Point; control: Point; end: Point }

/**
 * Wie viele Muenzen ein einzelnes Aufheben hoechstens losschickt.
 *
 * Losgeschickt wird, was der Spieler wirklich aufgehoben hat - die Zahl steht in
 * `gold.collected`. Vorher standen hier feste drei, und zwar unabhaengig davon: Wer eine
 * einzelne Muenze aufhob, sah drei ins Schild fliegen. Das ist genau die Art von Luege,
 * die der Ebene ihren Sinn nimmt, denn sie soll ja zeigen, **wohin das Aufgehobene geht**.
 *
 * Der Deckel bleibt trotzdem stehen: Ein Zug ueber ein volles Feld hebt schon mal zwanzig
 * Stapel auf einmal auf, und zwanzig Muenzen aus demselben Punkt sind kein Schwung mehr,
 * sondern ein Klumpen. Was darueber liegt, faellt weg - der Betrag oben stimmt ohnehin.
 */
const MAX_PER_PICKUP = 6

/**
 * Wie viele Muenzen hoechstens gleichzeitig fliegen duerfen.
 *
 * Der Wert ist kein Geschmack, sondern eine Rechnung: Bei rund einer halben Sekunde
 * Flugdauer und der Sperre von 90 ms zwischen zwei Muenztoenen (`app/audio.ts`) sind gut
 * zwanzig Muenzen unterwegs, wenn der Spieler durchgehend sammelt. Achtzig laesst Spitzen
 * zu und deckelt trotzdem, bevor es zaeh wird.
 */
const MAX_LIVE = 80

/**
 * Flugdauer in Millisekunden, samt Streuung - ohne sie fliegen alle im Gleichschritt.
 *
 * Von 900 auf 640 gesenkt, zusammen mit der neuen Beschleunigung (`EASING`). Die 900 waren
 * fuer eine Kurve gedacht, die vorne zieht und hinten auslaeuft; mit dem Auslaufen am Ende
 * brauchte der letzte Zentimeter ein Drittel der Zeit, und die Muenze schlich ins Schild.
 * Jetzt liegt die Beschleunigung hinten - die Muenze faellt in die Anzeige, statt sich
 * hineinzutasten -, und dieselbe Strecke braucht dafuer weniger Zeit.
 */
const DURATION_MS = 640
const DURATION_JITTER_MS = 180

/** Stuetzstellen der Bahn. Weniger lassen den Bogen eckig werden, mehr merkt niemand. */
const STEPS = 16

/**
 * Wie hoch der Bogen ueber der Verbindungslinie stehen **moechte** - als Anteil der
 * Flugstrecke plus einen festen Sockel, damit auch ein kurzer Flug einen sichtbaren Bogen
 * hat. Was daraus wird, entscheidet die Decke in `coinArc`.
 */
const ARC_SHARE = 0.28
const ARC_BASE_PX = 46

/**
 * Halbe Kantenlaenge der Muenze im Bild.
 *
 * Die Bahn ist eine Linie, die Muenze ist eine Flaeche: Ein Startpunkt genau auf der
 * Fensterkante haette immer noch eine halb abgeschnittene Muenze. Um diesen Betrag wird der
 * Startpunkt nach innen geholt (`coinArc`).
 */
const COIN_HALF_PX = 12

/**
 * Wann diese Ebene uebernimmt, als Anteil der Flugzeit der Feldmuenze.
 *
 * `PICKUP_LIFE` steht in Simulationssekunden, dauert aber in **echter** Zeit immer gleich
 * lang: `sim/combat.ts` dehnt die Lebensdauer optischer Effekte mit dem Spieltempo, damit
 * x4 sie nicht viermal so schnell macht. Der Wert laesst sich hier also direkt in
 * Millisekunden umrechnen, ohne das eingestellte Tempo zu kennen.
 *
 * Knapp darunter statt genau darauf: Die Feldmuenze verblasst auf den letzten Pixeln vor
 * dem Zeiger (`drawPickups`). Uebernaehme diese Ebene erst danach, klaffte dort ein Loch.
 */
const HANDOVER_SHARE = 0.85
const HANDOVER_MS = PICKUP_LIFE * 1000 * HANDOVER_SHARE

/**
 * Abstand zwischen zwei Muenzen desselben Aufhebens.
 *
 * Sie sollen nacheinander abheben und nicht als Block. Klein gehalten: Bei sechs Muenzen
 * sind das 150 ms vom ersten bis zum letzten Absprung - genug fuer eine Kette, zu wenig,
 * um als Warteschlange aufzufallen.
 */
const STAGGER_MS = 30

/**
 * Wie weit die Muenzen beim Absprung auseinandergehen.
 *
 * **Quer zur Flugrichtung**, nicht dagegen. Vorher sprangen sie entgegen der Flugrichtung
 * weg, damit das Aufheben einen Anschlag hat - das ergab Sinn, solange die Muenze hier aus
 * dem Stand loslegte. Seit sie die Bewegung der Feldmuenze uebernimmt, kommt sie in Fahrt
 * an, und ein Satz nach hinten ist dann kein Anschlag mehr, sondern ein Stolpern.
 */
const SPREAD_PX = 15

/**
 * Groesse beim Absprung und beim Einschlag.
 *
 * Gross los, klein an: Die Muenze verschwindet **im** Schild, statt davor stehen zu
 * bleiben. Sie behaelt dabei ihre volle Deckkraft bis zum letzten Bild - vorher verblasste
 * sie ueber die letzten vierzehn Prozent der Strecke auf null, und zusammen mit dem
 * Schrumpfen war sie eine Handbreit vor der Anzeige praktisch weg. Was ankommt, soll man
 * ankommen sehen; das Verschwinden uebernimmt der Einschlag (`land`).
 */
const POP_SCALE = 1.28
const SINK_SCALE = 0.46

/** Wie weit sich eine Muenze auf dem ganzen Flug dreht, in Grad. */
const SPIN_DEG = 220

/**
 * Fester Startwert fuer die Streuung der Flugdauer.
 *
 * Der Zufall dieser Ebene ist reine Optik und darf deshalb nicht am Wuerfel des Laufs
 * ziehen, aus dem Beute und Perks gezogen werden - er bekommt einen eigenen Strom mit
 * eigenem Startwert. Dass er dadurch in jeder Sitzung dieselbe Folge liefert, faellt bei
 * einer Flugdauer niemandem auf und macht den Lauf im Zweifel nachstellbar.
 */
const SEED = 0x3fa17c

/**
 * Die Bausteine der Bewegung. Sie stehen **ohne Leerzeichen** da, und zwar nicht aus
 * Geschmack: Der Selbsttest sucht in `ui/` nach Spielertexten im Code und liest jede
 * Zeichenkette mit zwei Woertern darin als Satz. Eine Stilangabe aus einem Stueck
 * ("translate(...) scale(...) rotate(...)") liest sich fuer ihn wie einer.
 */
const SHIFT_HALF = 'translate(-50%,-50%)'
const DEG = 'deg'

/**
 * Erst ein Satz, dann ein Schweben, dann der Sturz.
 *
 * Die Kurve ist gegenueber der alten umgedreht. Vorher stand hier `cubic-bezier(0.34,0.02,0.3,1)`
 * mit dem Kommentar "langsam los, schnell ins Ziel" - gemessen tat sie das Gegenteil: Nach
 * vier Fuenfteln der Zeit waren siebenundneunzig Prozent der Strecke zurueckgelegt, das
 * letzte Fuenftel der Zeit verteilte sich auf drei Prozent Weg. Die Muenze kroch die letzte
 * Handbreit, und weil sie dabei auch noch verblasste, kam sichtbar nichts an.
 *
 * Jetzt liegt es andersherum: die ersten zehn Prozent der Zeit tragen dreizehn Prozent der
 * Strecke (der Absprung), in der Mitte haengt die Muenze fast, und das letzte Zehntel der
 * Zeit frisst ein Fuenftel des Wegs. Das liest sich als Einschlag.
 */
const EASING = 'cubic-bezier(0.2,0.6,0.75,0.1)'

/**
 * Wie lange ein Einschlagsring lebt und wie viele gleichzeitig stehen duerfen.
 *
 * Der Deckel ist zugleich die Bremse, und zwar ohne eine einzige Uhr: Bei einem Schwung
 * kommen zehn Muenzen in derselben Zehntelsekunde an, zehn Ringe uebereinander sind ein
 * Fleck. Sind schon drei unterwegs, faellt der vierte aus - und weil jeder 320 ms lebt,
 * geht daraus von selbst rund alle 110 ms einer auf. Das ist derselbe Abstand, den der
 * Muenzton haelt (`app/audio.ts`), nur dass ihn hier niemand nachrechnen muss.
 *
 * Eine Sperre nach der Uhr waere der naheliegende Weg gewesen und ist der falsche: Zeit
 * kommt in diesem Projekt aus `core/loop.ts` (Selbsttest "Zeit kommt nur aus
 * core/loop.ts"), und die gehoert der Simulation - der Ring gehoert dem Bildschirm.
 */
const FLASH_MS = 320
const MAX_FLASH = 3

/** Ort, Groesse und Drehung einer Muenze als eine Stilangabe. */
function motion(x: number, y: number, scale: number, spin: number): string {
  return [
    `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`,
    SHIFT_HALF,
    `scale(${scale.toFixed(3)})`,
    `rotate(${spin.toFixed(0)}${DEG})`,
  ].join(' ')
}

function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value
}

/**
 * Die Bahn einer einzelnen Muenze - und die Zusage, dass sie im Bild bleibt.
 *
 * Der Kontrollpunkt steht **senkrecht** ueber der Mitte der Verbindungslinie. Das ist mehr
 * als eine Formsache: Weil er waagerecht genau in der Mitte liegt, kuerzt sich der
 * quadratische Anteil in x weg, und die Muenze legt die Breite gleichmaessig zurueck. Es
 * bewegt sich also nur die Hoehe im Bogen - ein Wurf, keine Schleife.
 *
 * **Die Decke ist der eigentliche Umbau.** Der Bogen darf hoechstens die halbe Hoehendifferenz
 * zwischen Absprung und Ziel hoch stehen. Genau bei diesem Wert beruehrt die Kurve die Hoehe
 * des hoeher liegenden Punktes - also die des Goldschilds -, ohne sie zu ueberschreiten:
 * Der Scheitel wandert dann auf das Ende der Bahn, und die Muenze kommt flach von der Seite
 * herein, statt von oben hereinzufallen. Ueber der Zeile ist kein Platz zum Hereinfallen; sie
 * sitzt 14 Bildpunkte unter der Fensterkante.
 *
 * Daraus folgt die pruefbare Zusage (`selftest/suites/interaction.ts`): **Die ganze Bahn
 * liegt im Rechteck zwischen Aufhebepunkt und Anzeige.** Beide Ecken sind sichtbar, also ist
 * es der Flug auch - ohne dass diese Rechnung das Fenster kennen muss.
 *
 * @param from  Uebergabepunkt: wo die Feldmuenze beim Zeiger ankommt.
 * @param to    Mitte des Muenzsymbols im Goldschild.
 * @param index Die wievielte Muenze desselben Aufhebens - streut den Absprung quer zur Bahn.
 * @param area  Groesse der Flugebene; haelt den gestreuten Absprung im Bild.
 */
export function coinArc(from: Point, to: Point, index: number, area: Point): CoinArc {
  const runX = to.x - from.x
  const runY = to.y - from.y
  const span = Math.hypot(runX, runY) || 1

  /*
   * Der Faecher beim Absprung, **quer** zur Flugrichtung: Die Muenzen gehen zu beiden
   * Seiten der Bahn auseinander, statt gegen sie anzuspringen. Die erste bleibt genau auf
   * der Linie, die zweite geht nach links, die dritte nach rechts, und der Ausschlag
   * waechst dabei nur langsam - so bleibt der Schwung der ankommenden Feldmuenze erhalten
   * und der Pulk faechert trotzdem auf.
   */
  const sideX = -runY / span
  const sideY = runX / span
  const swing = Math.ceil(index / 2) * (index % 2 === 0 ? 1 : -1) * SPREAD_PX

  // Der Faecher darf den Absprung nicht aus dem Bild schieben - sonst hinge die Zusage
  // dieser Funktion an einem Zufall.
  const start: Point = {
    x: clamp(from.x + sideX * swing, COIN_HALF_PX, Math.max(COIN_HALF_PX, area.x - COIN_HALF_PX)),
    y: clamp(from.y + sideY * swing, COIN_HALF_PX, Math.max(COIN_HALF_PX, area.y - COIN_HALF_PX)),
  }

  const wish = ARC_BASE_PX + span * ARC_SHARE
  const ceiling = Math.abs(start.y - to.y) / 2
  const lift = Math.min(wish, ceiling)

  return {
    start,
    control: { x: (start.x + to.x) / 2, y: (start.y + to.y) / 2 - lift },
    end: { x: to.x, y: to.y },
  }
}

/** Ein Punkt auf der Bahn, `t` von 0 (Absprung) bis 1 (Einschlag). */
export function arcPoint(arc: CoinArc, t: number): Point {
  const inv = 1 - t
  return {
    x: inv * inv * arc.start.x + 2 * inv * t * arc.control.x + t * t * arc.end.x,
    y: inv * inv * arc.start.y + 2 * inv * t * arc.control.y + t * t * arc.end.y,
  }
}

export function mountCoinFlight(
  /** Ebene, in die die Muenzen gehaengt werden - dieselbe wie die des Goldschilds. */
  layer: HTMLElement,
  /** Das Muenzsymbol im Goldschild (`ui/hud.ts` reicht es heraus). */
  target: HTMLElement,
  /** Flaeche, ueber der der Zeiger verfolgt wird - das Spielfeld. */
  field: HTMLElement,
  /**
   * Was beim Einschlag geschehen soll, ausserhalb dieser Ebene.
   *
   * Hier steht **wann** eine Muenze ankommt, im HUD steht, **was** die Anzeige daraufhin
   * tut. Vorher quittierte die Zeile schon das Aufheben - also gut eine halbe Sekunde
   * bevor die erste Muenze da war. Der Stupser gehoert an den Einschlag, sonst quittiert
   * er etwas, das noch unterwegs ist.
   */
  onLand?: () => void,
): CoinFlight {
  const rng = createRng(SEED)

  const stage = document.createElement('div')
  stage.className = 'coin-flight'
  stage.setAttribute('aria-hidden', 'true')
  layer.appendChild(stage)

  /** Letzter bekannter Ort des Zeigers, in Fensterkoordinaten. */
  let pointerX = 0
  let pointerY = 0
  let pointerSeen = false

  let live = 0

  /** Der laufende Stoss im Schild - siehe `land`. */
  let landing: Animation | null = null
  /** Wie viele Einschlagsringe gerade stehen - siehe `MAX_FLASH`. */
  let flashes = 0

  function trackPointer(event: PointerEvent): void {
    pointerX = event.clientX
    pointerY = event.clientY
    pointerSeen = true
  }

  /*
   * **Mitschneiden statt zuhoeren.** Das Einsammeln haengt selbst am Zeiger (`ui/input.ts`)
   * und meldet `gold.collected` noch waehrend derselben Bewegung. Ein gewoehnlicher
   * Zuhoerer liefe erst danach - die Muenze startete dann an der Stelle der **vorigen**
   * Bewegung, und beim allerersten Aufheben gaebe es ueberhaupt keinen Ort. In der
   * Erfassungsphase laeuft diese Zeile vorher, und der Ort stimmt ab der ersten Muenze.
   */
  const listen = { capture: true, passive: true } as const
  field.addEventListener('pointermove', trackPointer, listen)
  field.addEventListener('pointerdown', trackPointer, listen)

  /**
   * Eine Muenze losschicken. `index` streut Absprung, Dauer und Groesse - mehrere Muenzen
   * aus demselben Aufheben sollen nicht uebereinanderliegen.
   */
  function launch(from: Point, to: Point, area: Point, index: number): void {
    const arc = coinArc(from, to, index, area)
    const coin = document.createElement('i')

    const frames: Keyframe[] = []
    for (let step = 0; step <= STEPS; step++) {
      const t = step / STEPS
      const point = arcPoint(arc, t)
      // Das Schrumpfen liegt hinten (`t * t`): Die Muenze bleibt lange gross und faellt
      // erst auf den letzten Bildpunkten ins Schild.
      const scale = POP_SCALE - (POP_SCALE - SINK_SCALE) * t * t
      frames.push({ offset: t, transform: motion(point.x, point.y, scale, t * SPIN_DEG) })
    }

    // `live` ist hier bereits mitgezaehlt - der Platz wird beim Aufheben belegt und nicht
    // erst beim Abflug, sonst liesse der Deckel waehrend der Uebergabe beliebig viele durch.
    stage.appendChild(coin)

    const animation = coin.animate(frames, {
      duration: DURATION_MS + rng.range(0, DURATION_JITTER_MS),
      easing: EASING,
      fill: 'forwards',
    })

    animation.addEventListener('finish', () => {
      coin.remove()
      live -= 1
      land(to)
    })
  }

  /**
   * Der Einschlag: ein Stoss im Symbol, ein Ring an der Aufschlagstelle, und die Meldung
   * nach draussen.
   *
   * Der Stoss laeuft bewusst **nicht** ueber eine Klasse wie sonst im Projekt: Eine Klasse
   * muss zum Neuanstossen erst weg, und dazwischen braucht es ein erzwungenes Neuberechnen
   * des Layouts. Bei einem Schwung von vierzig Muenzen waeren das vierzig Zwangsberechnungen
   * innerhalb einer halben Sekunde - ausgerechnet dann, wenn ohnehin am meisten los ist.
   * Eine Bewegung laesst sich dagegen einfach abbrechen und neu starten.
   *
   * Der Stoss ist ein Ueberschwingen und kein Aufblasen: erst zu gross, dann eine Spur zu
   * klein, dann steht er. Das ist der Unterschied zwischen einem Symbol, das etwas
   * geschluckt hat, und einem, das jemand angeklickt hat.
   */
  function land(at: Point): void {
    landing?.cancel()
    landing = target.animate(
      [
        { transform: `scale(1)` },
        { offset: 0.24, transform: `scale(1.4)` },
        { offset: 0.56, transform: `scale(0.93)` },
        { transform: `scale(1)` },
      ],
      { duration: 260, easing: 'ease-out' },
    )

    flash(at)
    onLand?.()
  }

  /**
   * Der Ring an der Einschlagstelle.
   *
   * Er ist der Teil, der die Ankunft **sichtbar** macht: Die Muenze selbst ist im letzten
   * Bild nur noch halb so gross wie beim Absprung und liegt genau unter dem Symbol, das
   * gerade zuckt. Ohne den Ring bleibt vom ganzen Flug ein Verschwinden.
   *
   * Warum der Deckel eine Bremse ist und keine Uhr, steht bei `MAX_FLASH`.
   */
  function flash(at: Point): void {
    if (flashes >= MAX_FLASH) return
    flashes += 1

    const ring = document.createElement('u')
    stage.appendChild(ring)

    // Der Ort steht in **jedem** Bild der Bewegung: Eine Bewegung ersetzt die
    // Transformation des Knotens, sie ergaenzt sie nicht. Stuende der Ort nur am Knoten,
    // waere er waehrend der Bewegung weg, und der Ring liefe in der linken oberen Ecke
    // der Ebene auf.
    const place = `translate3d(${at.x.toFixed(1)}px,${at.y.toFixed(1)}px,0) ${SHIFT_HALF}`
    const animation = ring.animate(
      [
        { transform: `${place} scale(0.3)`, opacity: '0.95' },
        { transform: `${place} scale(2.1)`, opacity: '0' },
      ],
      { duration: FLASH_MS, easing: 'ease-out', fill: 'forwards' },
    )
    animation.addEventListener('finish', () => {
      ring.remove()
      flashes -= 1
    })
  }

  /** Wartende Uebergaben - `detach` muss sie abraeumen, sonst feuern sie ins Abgebaute. */
  const waiting = new Set<number>()

  const stop = on('gold.collected', ({ coins }) => {
    if (!pointerSeen) return
    if (live >= MAX_LIVE) return
    // Ein Aufheben ohne Muenze gibt es nicht - aber ein alter Aufrufer, der die Zahl nicht
    // mitschickt, soll eine sehen und nicht keine.
    const picked = Number.isFinite(coins) && coins > 0 ? Math.floor(coins) : 1

    /*
     * Der Uebergabepunkt wird **jetzt** gemerkt, nicht erst beim Abflug: Dorthin fliegt die
     * Feldmuenze, weil `spawnPickups` den Zeigerort im Augenblick des Aufhebens festhaelt.
     * Bis die Uebergabe faellig ist, steht der Zeiger laengst woanders - er bewegt sich ja,
     * sonst saehe er gar keine Muenze. Wer hier den dann aktuellen Ort naehme, liesse die
     * Muenze neben der ankommenden losfliegen, und der Bruch waere zurueck.
     */
    const handoverX = pointerX
    const handoverY = pointerY

    const count = Math.min(picked, MAX_PER_PICKUP, MAX_LIVE - live)
    // Die wartenden zaehlen mit: Sonst liesse der Deckel waehrend der Uebergabezeit
    // beliebig viele weitere zu, und der Schwung kaeme geballt an.
    live += count

    for (let index = 0; index < count; index++) {
      const timer = window.setTimeout(() => {
        waiting.delete(timer)

        /*
         * Erst hier messen: Zwischen zwei Wellen wandert das Schild mit der Ansicht, und
         * ein frueher gemerkter Ort zeigte danach ins Leere. Der Startpunkt dagegen steht
         * schon fest - er gehoert zum Aufheben, nicht zum Abflug.
         */
        const bounds = layer.getBoundingClientRect()
        const mark = target.getBoundingClientRect()
        if (mark.width <= 0) {
          live -= 1
          return
        }

        launch(
          { x: handoverX - bounds.left, y: handoverY - bounds.top },
          {
            x: mark.left + mark.width / 2 - bounds.left,
            y: mark.top + mark.height / 2 - bounds.top,
          },
          { x: bounds.width, y: bounds.height },
          index,
        )
      }, HANDOVER_MS + index * STAGGER_MS)

      waiting.add(timer)
    }
  })

  return {
    detach() {
      stop()
      for (const timer of waiting) window.clearTimeout(timer)
      waiting.clear()
      field.removeEventListener('pointermove', trackPointer, listen)
      field.removeEventListener('pointerdown', trackPointer, listen)
      stage.remove()
    },
  }
}
