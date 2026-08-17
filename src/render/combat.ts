/**
 * Gegner, Geschosse und Treffer.
 *
 * Der Spieler soll **ohne Text** erkennen, was auf ihn zukommt (GDD 07 Abschnitt 3):
 * Form, Farbe und Groesse zeigen die Rolle. Wie weit ein Gegner schon herunter ist, zeigt
 * sein Lebensbalken - und zwar bei jedem, der ueberhaupt getroffen wurde.
 */

import { formatNumber } from '../core/format.ts'
import { t } from '../data/strings.ts'
import { dist, type Vec2 } from '../core/vec.ts'
import { enemyById, type EnemyShape } from '../data/enemies.ts'
import { podById } from '../data/events.ts'
import { TRADER_STAY_SECONDS } from '../data/balance.ts'
import type { Helper, Pod, Trader } from '../app/state.ts'
import type { Beam, Burst, DamageNumber, Gain, Hit, Muzzle, Pickup, Shard } from '../sim/combat.ts'
import type { Drone } from '../sim/drones.ts'
import { meanCoinValue, type Coin } from '../sim/economy.ts'
import type { Enemy } from '../sim/enemies.ts'
import type { Projectile } from '../sim/projectiles.ts'
import type { RangeCircle } from '../sim/towers.ts'
import { viewZoom, worldToScreen, type Camera } from './camera.ts'
import { drawFrame, SPRITES } from './sprites.ts'
import { PALETTE, RARITY_COLOR, RGB, THEME } from './theme.ts'

/*
 * Der Lebensbalken, in **Bildschirmpixeln** und fuer jeden Gegner in denselben Massen.
 *
 * Frueher hing er an zwei Bedingungen: erst ab 60 Lebenspunkten ueberhaupt, und dann so
 * breit wie der Gegner (`max(16, radius * 2,2)`) und in dessen Farbe. Beides war falsch.
 *
 * Die Schwelle liess die Mehrheit der frueheren Wellen ohne Balken - nachgemessen in Welle
 * 12 mit Pulk: vier angeschlagene Gegner im Bild, drei davon ohne jede Anzeige. Man sah an
 * ihnen nicht, ob sie beim naechsten Schuss fallen oder gerade erst gestreift wurden. Ein
 * Zustand, den nur ein Teil der Objekte zeigt, ist kein Zustand, sondern ein Sonderfall.
 *
 * Breite und Farbe je Gegner waren der zweite Fehler. Vierzig verschiedene Balkenlaengen in
 * vierzig Farben sind vierzig Einzelzeichnungen, die der Blick nacheinander abgehen muss.
 * Ein und derselbe Strich an jedem - gleich lang, gleich hoch, gleich gefaerbt - liest sich
 * dagegen als **eine** Front, und die Fuellung darin ist die einzige Groesse, die sich
 * unterscheidet. Nur der Boss weicht ab, und nur in der Laenge: Er ist ein Ziel, kein Teil
 * der Masse.
 *
 * Feste Pixelmasse, nicht mit dem Zoom skaliert: Zwei Balken duerfen sich nie in der Laenge
 * unterscheiden, auch nicht um den halben Pixel, den eine Rundung auf krummen Koordinaten
 * hinterliesse. Deshalb auch `fillRect` auf ganzen Zahlen statt runder Strichenden.
 */
const HP_BAR_WIDTH = 18
const HP_BAR_WIDTH_BOSS = 54
const HP_BAR_HEIGHT = 3
/** Abstand zwischen Scheitel des Gegners und Unterkante des Balkens. */
const HP_BAR_GAP = 5

/** Abstand des Muendungsfeuers von der Modulmitte, in Welteinheiten. */
const MUZZLE_OFFSET = 13
const MUZZLE_LENGTH = 16

/*
 * Der Schweif eines Geschosses, in **Bildschirmpixeln**.
 *
 * Frueher stand hier eine Flugzeit (0,05 s). Das klang richtig - ein schnelles Geschoss
 * zoege einen laengeren Schweif -, ergab aber nachgemessen 26 Welteinheiten, bei Zoom 0,6
 * also sechzehn Pixel hinter einem Kopf von gut einem Pixel. Im Standbild war schlicht nicht
 * zu sehen, dass ueberhaupt geschossen wird. Ein Effekt, den man nur in Bewegung bemerkt,
 * ist fuer ein Bild kein Effekt.
 *
 * Deshalb jetzt eine Bildschirmlaenge: Der Keil ist so lang, wie er im Bild gelesen werden
 * muss, unabhaengig davon, wie weit die Kamera draussen steht. `MAX` ist die Obergrenze,
 * `MIN` der kuerzeste Keil, der noch als Keil und nicht als Klecks gelesen wird - faellt der
 * Platz darunter, wird gar keiner gezeichnet.
 */
const TRAIL_MIN_PX = 14
const TRAIL_MAX_PX = 104

/*
 * Zuschlag auf den Umkreis des abfeuernden Moduls (`Projectile.reach`), in **Welteinheiten**.
 * Zusammen ergeben beide den Abstand, den das Ende des Keils von der Modulmitte haelt.
 *
 * Frueher lief der Keil die vollen 104 Pixel bis in das abfeuernde Modul hinein. Er wird mit
 * `source-over` und hoechstens 0,5 Deckkraft gezeichnet, und darunter liegen die hellste
 * Kante der Station und ihr Muendungsfeuer - beide schienen also durch ihn hindurch. Damit
 * war das eine kaputt, was den Keil zur Richtungsangabe macht: der stetige Abfall vom Kopf
 * zum Ende. Nachgemessen in Welle 12 bei 18 Sekunden, entlang der Achse des ersten
 * Geschosses: von 38,8 auf 62,0 und weiter auf 136,7 Luminanz, wo der Keil die Modulkante
 * ueberquerte - ein Schweif, der hinten heller ist als vorn, zeigt nach hinten.
 *
 * Deshalb endet der Keil jetzt **vor** dem Modul. Der Zuschlag deckt den Neonschein der
 * Modulkante ab: Nachgemessen entlang derselben Achse, in Welteinheiten ab Modulmitte,
 * steht die Kante bei 24 bis 27, ihr Schein reicht bis 33, ab 34 liegt wieder Untergrund -
 * bei einem Viereck mit Umkreis 39,6 also gut sechs Einheiten ueber den Umkreis hinaus.
 */
const TRAIL_CLEAR_HALO = 7

/*
 * Halbe Breite des Keils, in **Bildschirmpixeln** - vorn am Kopf und hinten am Ende.
 *
 * Frueher wurde die Breite als Vielfaches des Kopfradius gerechnet (Faktor 0,62) und das
 * Dreieck lief hinten auf null zu. Nachgemessen blieben davon 3,75 px bei einem Fuenftel der
 * Laenge, 2,75 px bei der Haelfte und 1,25 px bei vier Fuenfteln: ein Haar, kein Keil. Der
 * Schweif verschwand nicht durch das Ausblenden, sondern weil ihm der Koerper fehlte.
 *
 * Jetzt ist es ein Trapez mit fester Bildschirmbreite - 8 px am Kopf, 10 px am Ende, in jedem
 * Zoom gleich. Es wird also nach hinten sogar minimal *breiter*, so wie ein Nachzieher sich
 * aufloest, statt sich zuzuspitzen. Das Ausblenden macht danach allein `trailGradient`, nicht
 * mehr die Geometrie: Deckkraft faellt monoton, Querschnitt bleibt.
 */
const TRAIL_HALF_HEAD_PX = 4
const TRAIL_HALF_TAIL_PX = 5

/*
 * Der Geschosskopf in Bildschirmpixeln - Grundradius, Aufschlag fuer den kritischen Treffer
 * und die Untergrenze, unter die kein Zoom ihn druecken darf.
 *
 * Acht Pixel quer ist keine willkuerliche Zahl, sondern die Grenze, ab der ein Ring mit Kern
 * ueberhaupt als Ring gelesen wird. Darunter fliessen Kern, Ring und Hof zu einem Punkt
 * zusammen, und der Unterschied zwischen Geschoss und Staubkorn verschwindet.
 */
const HEAD_PX = 4.4
const HEAD_CRIT_PX = 5.4
const HEAD_MIN_PX = 4

/** Abstand der Randmarke vom Bildrand, ihre Groesse und ihr Deckel, in Bildschirmpixeln. */
const APPROACH_INSET = 13
const APPROACH_SIZE = 9
/** Ab dieser Entfernung ausserhalb des Bildes ist die Marke verschwunden. */
const APPROACH_FADE = 210
/** Mehr Marken als das braucht niemand - der Rand soll kein Zeichenkranz werden. */
const APPROACH_MAX = 24

/** Wie weit die eingesammelte Zahl aufsteigt, in Welteinheiten. */
const GAIN_RISE = 26

/*
 * Die Schadenszahl ueber dem Feld.
 *
 * `RISE` ist ihr Weg nach oben und `DRIFT` ihr seitlicher Ausschlag, beides in
 * Welteinheiten. Nach oben begrenzt beides dasselbe: Die Zahl gehoert dem Gegner, ueber dem
 * sie steht, und eine, die quer durchs Bild zieht, gehoert am Ende niemandem mehr. Nach
 * unten begrenzt sie das Gedraenge. Ein Turm mit acht Schuessen je Sekunde setzt acht Zahlen
 * an denselben Gegner; stieg jede in ihrer Frist nur 22 Einheiten - bei ausgezoomter Kamera
 * keine anderthalb Zeilenhoehen -, dann lagen drei aufeinanderfolgende Treffer als ein
 * einziger Ziffernklumpen uebereinander. Nachgemessen im Standbild von Welle 12: siebzehn
 * lebende Zahlen ergaben fuenf lesbare Bloecke im Bild, mit dem laengeren Weg dreizehn.
 * Aus dem Klumpen wird dabei eine Saeule, wie sie ueber einem beschossenen Gegner auch
 * stehen soll - unten die frische, darueber die aelteren.
 *
 * `SIZE` ist etwas kleiner als die Gewinnzahl (18) - der Gewinn ist die Belohnung und darf
 * lauter sein als die laufende Auskunft. Ein kritischer Treffer bekommt die groessere
 * Schrift und **keine eigene Farbe**: Farbe ist im Feld belegt (Gegner, Muenzen, Reichweite),
 * Groesse ist frei. Man sieht den Ausreisser, ohne dass eine siebte Leitfarbe entsteht.
 *
 * `SIZE_MIN` ist der Boden unter der Groesse. Die Schrift schrumpft mit dem Zoom, und eine
 * Pixelschrift, deren Strich unter einen Bildschirmpixel faellt, ist keine Schrift mehr,
 * sondern ein grauer Fleck. Eine gewachsene Station zoomt weit heraus - ohne den Boden waere
 * genau dann nichts mehr zu lesen, wenn am meisten los ist.
 *
 * `OUTLINE` ist die Breite der schwarzen Kontur als **Anteil der Schrifthoehe**. Nicht als
 * feste Pixelzahl, weil die Schrift mit dem Zoom mitgeht und eine feste Kontur die Glyphe
 * beim Herauszoomen zuschmieren wuerde.
 *
 * Der Anteil ist nachgemessen und nicht geschaetzt: Bei dieser Pixelschrift sind die Striche
 * einer Ziffer rund ein Achtel der Schrifthoehe breit und die Luecken - innerhalb einer
 * Ziffer wie zwischen zwei Ziffern - bis zu einem Drittel. Die Kontur liegt je zur Haelfte
 * innen und aussen, ein Drittel Breite traegt also ein Sechstel von jeder Seite in die Luecke
 * hinein und schliesst sie gerade. Nachgemessen an "111.5K" vor einem hellen Grund
 * RGB(180,150,60): quer durch die Zeile liegen neun Striche und acht Luecken, und in jeder
 * einzelnen Luecke steht RGB(0,0,0) - vom Untergrund kommt zwischen den Ziffern nichts
 * durch.
 *
 * `FADED_ALPHA` ist die Deckkraft der aelteren Zahlen im Augenblick, in dem sie alt werden.
 * Deutlich unter eins, und das ist der Sinn der Sache: Der Sprung von der frischen zur alten
 * Zahl ist die **Rangfolge**. Ohne ihn liegen zwanzig gleich helle Zahlen im Bild, und keine
 * sagt mehr, was gerade eben passiert ist. Nach unten ist sie durch die Lesbarkeit begrenzt:
 * Eine alte Zahl soll zuruecktreten, nicht verschwinden - sonst waere sie nur noch Schmutz
 * auf dem Bild.
 */
const DAMAGE_RISE = 68
const DAMAGE_DRIFT = 26
/**
 * Hoehenversatz aufeinanderfolgender Zahlen, in Welteinheiten.
 *
 * Der seitliche Ausschlag allein reicht nicht: Zwei Tuerme treffen denselben Gegner im
 * selben Takt, und zwei Zahlen auf gleicher Hoehe stossen dann Ziffer an Ziffer. Drei
 * Stufen aus der laufenden Nummer versetzen sie gegeneinander - ohne Zufall, ohne
 * gespeicherten Zustand, und aufeinanderfolgende Treffer landen nie auf derselben Stufe.
 *
 * Die Stufen gehen ausschliesslich nach OBEN (0, 1, 2 mal diesen Wert). Frueher war es eine
 * Stufe nach unten, keine, eine nach oben - und die nach unten fuehrte die Zahl zurueck in
 * das Balkenband, das der Startpunkt gerade erst freigeraeumt hat. Der Abstand zwischen zwei
 * Stufen ist derselbe geblieben; nur ihre Lage insgesamt ist es nicht mehr.
 */
const DAMAGE_STAGGER = 12
const DAMAGE_SIZE = 20
const DAMAGE_SIZE_CRIT = 27
/**
 * Untergrenze der Schriftgroesse, in Bildpunkten.
 *
 * Bei weit herausgezogener Kamera schrumpft die Zahl mit dem Zoom, und unter dieser Grenze
 * ist eine Pixelschrift keine Schrift mehr: Ihre Striche sind einen Punkt breit, die
 * schwarze Kontur frisst sie von beiden Seiten auf. Siebzehn ist der Wert, bei dem die
 * Kontur (ein Drittel der Groesse, also knapp sechs Punkte) noch zwischen zwei Striche
 * passt.
 */
const DAMAGE_SIZE_MIN = 17
const DAMAGE_OUTLINE = 1 / 3
const DAMAGE_FADED_ALPHA = 0.62
/**
 * Anteil der Lebenszeit, den eine alte Zahl **ruhig** steht, bevor sie ausblendet.
 *
 * Eine Zahl, die vom ersten Augenblick ihres Alters an dunkler wird, ist die halbe Zeit
 * schon zu blass zum Lesen - nachgemessen blieben von sechzehn lebenden Zahlen nur drei
 * ueber der Schwelle, ab der man Ziffern ueberhaupt auseinanderhaelt. Die alte Zahl soll
 * aber stehen bleiben und erst am Ende gehen: flaches Mittelgrau, und die letzte
 * Vierteldrehung ihrer Frist blendet sie weg.
 */
const DAMAGE_HOLD = 0.75

/**
 * Wie weit eine Ziffer unter ihren eigenen Ankerpunkt reicht - als Anteil der Schriftgroesse.
 *
 * Gesetzt wird mit `textBaseline = 'middle'`, der Anker liegt also in der Mitte der Zeile.
 * Eine Ziffer dieser Schrift reicht von dort rund 0,36 Schrifthoehen nach unten; ein halbes
 * Geviert deckt das mit Rand ab und bleibt auch dann richtig, wenn die Ersatzschrift greift,
 * weil das Geviert die Obergrenze jeder Glyphe ist.
 *
 * Gebraucht wird die Zahl nur an einer Stelle: Die aufsteigende Schadenszahl muss **ueber**
 * dem Lebensbalken beginnen, und "ueber dem Balken" heisst "ihre Unterkante ueber seiner
 * Oberkante" - nicht ihr Ankerpunkt.
 */
const DAMAGE_TEXT_HALF = 0.5

/** Deckkraft des liegenden Goldes ausserhalb der Kampfansicht. */
const COIN_DIM_IDLE = 0.45

/**
 * Groesse einer Muenze in Welteinheiten: Grundwert plus Zuschlag nach ihrem Anteil.
 *
 * Der Grundwert haelt auch den kleinsten Krumen sichtbar, die Spanne haelt den groessten
 * Stapel klein genug, dass er die Station nicht zudeckt (GDD 13 Abschnitt 10).
 */
const COIN_RADIUS_BASE = 6
const COIN_RADIUS_SPAN = 9

/**
 * Ab dem Wievielfachen des Durchschnitts eine Muenze ihre volle Groesse erreicht.
 *
 * Rund zehnfach (die Wurzel aus 10 ist 3,2): Ein Stapel, der zehnmal so schwer ist wie der
 * Durchschnitt, ist der dickste Brocken auf dem Feld - darueber muss nichts mehr wachsen.
 */
const COIN_SIZE_SPREAD = 3.2

/**
 * Wertstufen der Muenzbilder: Reihe 0 bronze, 1 silber, 2 gold (`docs/anlagen.md`).
 *
 * Die Schwellen sind Vielfache des Durchschnitts, nicht feste Betraege - dieselbe Regel wie
 * bei der Groesse. Was in Welle 3 ein Vermoegen ist, ist in Welle 300 Staub; ein fester
 * Grenzwert faerbte spaeter jede Muenze gold und saegte die Aussage wieder ab.
 */
const COIN_TIER_SILVER = 0.8
const COIN_TIER_GOLD = 2.2

/**
 * Die Landung einer eingesammelten Muenze auf dem Zeiger.
 *
 * `PICKUP_LANDING` ist die Strecke, auf der sie schrumpft und verblasst - gemessen in ihren
 * eigenen Radien, damit ein Krumen und ein Stapel gleich weit vor dem Zeiger anfangen zu
 * verschwinden. `PICKUP_MIN_SCALE` ist, was am Zeiger uebrig bleibt: nicht null, sonst
 * verschwindet die Muenze in einem Punkt, statt in der Anzeige anzukommen.
 *
 * `PICKUP_POP` ist der Stupser im Augenblick des Aufhebens, `PICKUP_POP_SHARE` sein Anteil
 * an der Flugzeit.
 */
/*
 * Groesse der Einschlag- und Zerfallsbilder.
 *
 * Sie standen vorher als nackte Zahlen mitten im Zeichnen, und sie waren zu klein: Ein
 * Gegner mit acht Weltradien zerfiel in einem Bild von sechsunddreissig Bildschirmpixeln -
 * kleiner als der Gegner selbst kurz davor. Der Abschuss, also der Augenblick, auf den das
 * ganze Spiel hinauslaeuft, war damit das Unauffaelligste auf dem Feld.
 *
 * Der Zerfall misst in **Vielfachen des Gegners**, der Einschlag in festen Pixeln: Der
 * Zerfall gehoert dem Gegner und soll mit ihm wachsen, ein Treffer gehoert dem Geschoss und
 * ist bei einem Titanen derselbe wie bei einem Krumen.
 */
const DEATH_SPRITE_SCALE = 9
const DEATH_RING_GROWTH = 2.6
const HIT_SPRITE_PX = 40
const CRIT_SPRITE_PX = 66

/**
 * Der Kranz des Abschusses (GDD 13 Abschnitt 10).
 *
 * Ein einzelner duenner Ring ist als Todesanzeige zu wenig. Nachgemessen hob der ganze
 * Zerfall - Ring plus Splitter - 42 Bildpunkte ueber Helligkeit 150, waehrend eine einzelne
 * herumliegende Muenze 97 hebt: Der Abschuss war weniger wert als ein Geldstueck, das
 * niemand aufgehoben hat. Zwei Gruende dafuer, beide hier behoben:
 *
 *   *Kein Hof.* `drawBursts` war die einzige Effektfunktion dieser Datei ohne `shadowBlur`.
 *               Ein Strich ohne Streuung ist in einem Bild aus brennenden Roehren ein
 *               Fremdkoerper - und vor allem ist er duenn: Ein Haarstrich traegt ein paar
 *               Dutzend Bildpunkte, ein Hof traegt die Flaeche darum mit.
 *
 *   *Ein Ring.* Die Vorlage zeigt keinen Ring, sondern einen **Kranz**: zehn bis vierzehn
 *               kleine hohle Kreise auf dem wachsenden Ring, jeder mit eigenem Hof. Das ist
 *               der Unterschied zwischen "hier war eine Welle" und "hier ist einer
 *               zerplatzt" - der Koerper zerfaellt in Stuecke, statt sich aufzuloesen.
 *
 * Die Zahl der Kreise waechst mit dem Gegner: Ein Krumen zerplatzt in zehn Stuecke, ein Boss
 * in vierzehn. Mehr waeren bei kleinem Radius eine geschlossene Linie und damit wieder ein
 * Ring; weniger waeren bei grossem Radius verlorene Punkte.
 */
const DEATH_BLUR = 18
const DEATH_NODES_MIN = 10
const DEATH_NODES_MAX = 14
const DEATH_NODE_PX = 2.6

/**
 * Streuung des Einschlags im Augenblick des Treffers, in Pixeln.
 *
 * Nicht groesser: Bei hohem Angriffstempo stehen mehrere Einschlaege gleichzeitig im Bild,
 * und ein Hof, der breiter ist als der Ring selbst, macht aus einer Reihe von Treffern eine
 * Nebelbank. Der Wert reicht genau so weit, dass die Kante des Rings weich in den Grund
 * laeuft - mehr will er nicht.
 */
const HIT_BLUR = 12

const PICKUP_LANDING = 2.6
const PICKUP_MIN_SCALE = 0.45
const PICKUP_POP = 0.22
const PICKUP_POP_SHARE = 0.3

/**
 * Der Glanzlauf einer Muenze: `GLINT_PERIOD` Sekunden Ruhe, dann ein kurzer Lauf ueber alle
 * Bilder. Der Versatz kommt aus dem Ort der Muenze - dieselbe Muenze glaenzt immer gleich,
 * zwei nebeneinander aber nie im Takt. Ein Feld voller Gold soll leben, nicht blinken.
 */
const GLINT_PERIOD = 3.4
const GLINT_FPS = 14

/**
 * Die Kante des Wirkungsbereichs: Strichbreite in Bildpunkten, abhaengig vom Radius.
 *
 * Sie ist bewusst **keine feste Zahl**. Das optische Gewicht einer Linie ist ihre Breite im
 * Verhaeltnis zu dem, was sie umschliesst: Derselbe Strich, der um eine kleine Station
 * angemessen wirkt, ist um eine weit ausgebaute nur noch ein Haar, das im Bild verschwindet.
 * Ein Zwanzigstel des Bildradius haelt das Gewicht ueber den ganzen Ausbau gleich.
 *
 * Der untere Deckel steht bei zehn, nicht bei sechs: Darunter faellt die Kante durch die
 * Kurvenglaettung und die Kantenweichzeichnung auf weniger als acht durchgehende Punkte
 * zusammen, und ab da liest das Auge sie wieder als Haarstrich statt als Durchgang.
 */
const RANGE_EDGE_SHARE = 0.05
const RANGE_EDGE_MIN = 10
const RANGE_EDGE_MAX = 16

/**
 * Der Wirkungsbereich in seiner urspruenglichen Fassung: cyan, fein, leuchtend.
 *
 * Deckkraft der Kante, Deckkraft der Flaeche am Aussenrand, Strichbreite und Leuchthof. Die
 * Flaeche laeuft zur Mitte hin auf null - unter der Station bleibt das Bild frei.
 */
const RANGE_RING_ALPHA = 0.3
const RANGE_RING_FILL = 0.05
const RANGE_RING_WIDTH = 1.5
const RANGE_RING_BLUR = 12
/**
 * Wie stark zwei Reichweitenkreise sich anziehen, in Welteinheiten.
 *
 * Das ist die Oberflaechenspannung des Wirkungsbereichs: Kommen sich zwei Kreisraender naeher
 * als dieser Abstand, waechst zwischen ihnen ein Hals, statt dass sie sich in einer Spitze
 * schneiden - zwei Tropfen, die zu einem werden. Weiter auseinander merken sie nichts
 * voneinander und bleiben zwei.
 *
 * Der Preis steht fest und ist klein: Am Hals traegt der Zusammenschluss hoechstens
 * `merge / 4` nach aussen auf, hier also 11 von rund 250 Einheiten. Das ist eine bewusst
 * gekaufte Unschaerfe - genau dort, wo ohnehin zwei Tuerme decken, und nirgends sonst. Der
 * Kampf selbst rechnet unveraendert mit den echten Kreisen (`inCoverage` in `sim/enemies.ts`);
 * was hier weicher wird, ist die Zeichnung, nicht die Regel.
 */
const RANGE_BLOB_MERGE = 44
/**
 * Kantenlaenge einer Abtastzelle in Welteinheiten und die Obergrenze der Gitterweite.
 *
 * Das Feld wird auf einem Gitter abgetastet und die Nulllinie daraus gezogen (Marching
 * Squares). Die Kosten wachsen mit dem Quadrat der Feinheit mal der Turmzahl, und zwar bei
 * jedem **Neuaufbau** - der faellt beim Bauen an, bei einem Reichweiten-Upgrade und wenn ein
 * Buff an- oder ausgeht, nie im Ruhezustand. Im Browser gemessen, volle Station aus fuenfzehn
 * Modulen: 6,5 ms bei 8 Einheiten, 3,4 ms bei 12. Gewaehlt sind 12 - eine Modulkante ist 56
 * Einheiten lang, der Umriss bekommt damit alle 12 Einheiten einen Punkt, und die
 * Kurvenglaettung in `traceBlob` macht daraus eine runde Linie. Ein einzelnes Bild soll durch
 * einen Bauklick nicht ins Rutschen kommen.
 *
 * Der Deckel begrenzt das Gitter auf 160 x 160 Stuetzstellen, damit eine sehr weit ausgebaute
 * Station die Rechnung nicht ins Quadratische zieht; dann wird die Zelle groesser statt das
 * Gitter.
 */
const RANGE_BLOB_CELL = 12
const RANGE_BLOB_MAX_STEPS = 160

/**
 * Die Kapsel: Groesse in Welteinheiten, dazu Weite und Tempo ihres Schwebens.
 *
 * Deutlich groesser als die groesste Muenze - sie ist ein Gegenstand und kein Krumen, und
 * der Spieler soll sie ueber das halbe Feld hinweg sehen.
 */
const POD_RADIUS = 13
const POD_BOB = 3.5
const POD_BOB_SPEED = 2.2

/** Groesse eines Goldsammlers in Welteinheiten. */
const HELPER_SIZE = 6

/**
 * Groesse der Haendler-Drohne in Welteinheiten.
 *
 * Deutlich groesser als eine Kapsel: Sie ist die seltenste Gelegenheit im Feld und muss
 * ueber die ganze Arena hinweg auffallen, auch wenn gerade fuenfzig Gegner anlaufen.
 */
const TRADER_RADIUS = 17

/**
 * Streuung der Gegnerlinie beim Einzelstueck - Elite und Boss, sonst niemand.
 *
 * Ein Canvas-Schatten streut in JEDE Richtung, auch in den Spalt zum Nachbarn. Solange
 * das Einzelstueck allein steht, ist das genau richtig: seine Roehre brennt sichtbar aus.
 * Sobald aber jeder Gegner einen Schatten traegt, addieren sich in einem dichten Band die
 * Auslaeufer zweihundert Mal uebereinander, und die Taeler zwischen den Konturen steigen
 * messbar an - selbst bei kleinem Blur (nachgemessen: bei vier Pixeln Streuung lag der
 * Talwert im 200er-Band bei Hintergrund + 14, ohne Streuung bei Hintergrund - 1).
 * Deshalb bekommt die Masse gar keinen Schatten; ihr Brennen kommt aus HOT_EDGE_MIX.
 */
const ENEMY_SINGULAR_BLUR = 10

/**
 * Wie weit der Innenstrich eines Normalgegners zu Weiss hin aufgehellt wird.
 *
 * Das Brennen einer Neonroehre ist kein Hof, sondern ein Verlauf ueber die Roehre selbst:
 * aussen die Glasfarbe, innen der ueberbelichtete Kern. Genau das baut ein zweiter,
 * schmalerer Strich auf derselben Kontur nach - und weil er deckungsgleich auf der Linie
 * liegt, addiert er anders als ein Schatten nichts in den Zwischenraum zweier Nachbarn.
 * Der Wert ist an der Vorlage abgelesen: Dort erreicht ein Normalgegner im Scheitel
 * RGB(255, 182, 192), also die Gegnerfarbe knapp zur Haelfte nach Weiss verschoben.
 */
const HOT_EDGE_MIX = 0.6

/**
 * Gemerkte Aufhellungen. Es gibt eine Handvoll Gegnerfarben und sechzig Bilder je Sekunde -
 * die Zeichenkette wird einmal je Farbe gebaut und danach nur noch nachgeschlagen.
 */
const hotEdgeCache = new Map<string, string>()

/**
 * Wie weit die Innenschulter eines Normalgegners hinter der Kontur liegt, in Pixeln.
 *
 * Zusammen mit ihrer eigenen Strichbreite ergibt das den Querschnitt, den die Vorlage an
 * einem Normalgegner zeigt: vom Grund ueber einen Bildpunkt hinauf zum Scheitel und ueber
 * rund vier weitere wieder herunter ins Innere. Groesser darf der Versatz nicht werden -
 * ab etwa drei Pixeln loest sich die Schulter von der Kontur und wird ein zweiter Ring.
 */
const INNER_SHOULDER = 1.7

/**
 * Deckkraft, mit der die Flaeche eines eben getroffenen Gegners im Scheitel angehoben wird.
 *
 * Der Wert ist gegen den Einschlag gemessen und nicht gegen den leeren Grund: Ueber dem
 * getroffenen Gegner liegt das Trefferbild, und was dieses Bild deckt, kann keine Fuellung
 * darunter mehr anheben. Bei 0,55 blieb der Koerper des Getroffenen nur 33 Helligkeitsstufen
 * ueber demselben Gegner ohne Treffer - sichtbar, wenn man es weiss, und unsichtbar, wenn
 * man es nicht weiss. Erst hier steht der Unterschied ueber vierzig Stufen und traegt damit
 * auch unter dem Einschlag.
 *
 * Nach oben ist trotzdem eine Grenze: Volle Deckung waere ein weisser Fleck, und die Form
 * nennt die Gegnerart - sie darf auch im Augenblick des Treffers nicht ausfallen.
 */
const HIT_FLASH_FILL = 0.8

/**
 * Streuung des Trefferrings im Scheitel, in Pixeln. Klingt mit der Quittung aus.
 *
 * Sie traegt mehr als nur Stimmung: Die Fuellung endet an der Kontur, der Gegner sitzt aber
 * in einem Feld aus Nachbarn. Erst der Hof hebt auch den Rand um ihn herum an und macht aus
 * dem aufgehellten Umriss eine Stelle, die man im Pulk **findet**, statt sie zu suchen.
 */
const HIT_FLASH_BLUR = 16

/**
 * Kleinster Halbmesser, mit dem ein Gegner im Bild gezeichnet wird, in Bildpunkten.
 *
 * Der Zoom rechnet Welteinheiten in Bildpunkte um, und er richtet sich nach der **Station**,
 * nicht nach dem Gegner: Was die Station gross macht, macht den Gegner klein. Nachgemessen
 * im Belastungsfall (Welle 12, 194 Gegner, Zoom 0,908): Ein Schwarmgegner mit Halbmesser 6
 * wird 5,45 Bildpunkte gross und misst quer zehn Punkte - davon sind drei die Kontur selbst.
 * Zweihundert solcher Stuecke sind keine Masse, sondern ein Nadelstreifen; das Auge liest
 * eine duenne Kette, weil jedes Glied unter der Groesse liegt, ab der es eine Form hat.
 *
 * Deshalb ein Boden - und zwar ein weicher: `Math.hypot` mittelt quadratisch, hebt also das
 * Kleine deutlich und laesst das Grosse in Ruhe. Bei Zoom 0,908 wird aus dem Schwarm-Halb-
 * messer 5,45 dadurch 11,4 (quer gemessen 21 statt 10 Punkte), aus einer Drohne mit 10,0
 * werden 14,1, aus einer schweren Einheit mit 15,4 werden 18,4 - und ein Boss mit 47,2
 * bleibt 48,2, also praktisch er selbst. Die Reihenfolge der Groessen bleibt erhalten, Form
 * UND Groesse nennen weiter die Gegnerart (GDD 07 Abschnitt 3), aber keine Art faellt mehr
 * unter die Lesbarkeit.
 *
 * Ein harter Boden (`Math.max`) waere hier falsch: Er machte Schwarm und Drohne bei kleinem
 * Zoom exakt gleich gross und naehme der Groesse ihre Aussage.
 *
 * Nach oben ist der Wert durch die Zaehlprobe gedeckelt: Bei 11 fing das Band an, ein
 * Geflecht zu werden.
 *
 * DIESE ZAHL HAT EIN GEGENSTUECK IN DER SIMULATION. Solange sie allein hier stand, war das
 * Bild breiter als die Regel: Der Umriss mass 22,8 Bildpunkte, die Gegner drueckten sich
 * aber nur auf gemessene 7,1 auseinander, weil `stepCrowd` mit `enemy.radius` rechnete.
 * Jeder Umriss spannte damit ueber drei Nachbarn, und aus zweihundert Gegnern wurde eine
 * einlagige Kette statt eines Bandes. `CROWD_MIN_RADIUS` in `sim/enemies.ts` traegt
 * dieselbe Zahl in Welteinheiten; wer hier etwas aendert, aendert sie dort mit.
 */
const ENEMY_MIN_DRAW = 10

/**
 * Halbmesser, mit dem ein Gegner gezeichnet wird - nicht der, mit dem er rechnet.
 *
 * Die Simulation behaelt ihren eigenen Halbmesser: Treffer, Reichweite, Beruehrung mit einem
 * Modul und das Auseinanderdruecken der Nachbarn rechnen weiter mit der Zahl aus
 * `data/enemies.ts`. Hier geht es allein darum, wie viel Bild ein Gegner bekommt - das
 * Gedraenge ist eine Frage der Darstellung, nicht der Regeln.
 */
function drawnRadius(worldRadius: number, zoom: number): number {
  return Math.hypot(worldRadius * zoom, ENEMY_MIN_DRAW)
}

/** Aufgehellte Fassung einer Gegnerfarbe - dieselbe Farbe, nur naeher an Weiss. */
function hotEdge(color: string): string {
  const cached = hotEdgeCache.get(color)
  if (cached !== undefined) {
    return cached
  }
  const value = Number.parseInt(color.replace('#', ''), 16)
  const lift = (channel: number): number => Math.round(channel + (255 - channel) * HOT_EDGE_MIX)
  const hot = `rgb(${lift((value >> 16) & 255)}, ${lift((value >> 8) & 255)}, ${lift(value & 255)})`
  hotEdgeCache.set(color, hot)
  return hot
}

export function drawEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: readonly Enemy[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  // Runde Ecken: Die breite Schein-Linie stellt sonst an jeder Spitze einen Zacken auf,
  // der laenger ist als der halbe Gegner.
  ctx.lineJoin = 'round'
  hpBarCount = 0
  for (const enemy of enemies) {
    const def = enemyById(enemy.defId)
    const center = worldToScreen(camera, enemy.pos, width, height)
    const radius = drawnRadius(enemy.radius, viewZoom(camera))

    // Der Biss: ein Stoss zum Modul hin und zurueck. Ein Sinusbogen geht weich hin und
    // weich zurueck - der Gegner beisst, er springt nicht.
    if (enemy.biteLife > 0) {
      const lunge =
        Math.min(6, enemy.radius * 0.35) *
        Math.sin(Math.PI * Math.min(1, enemy.bite / enemy.biteLife)) *
        viewZoom(camera)
      center.x += enemy.biteDir.x * lunge
      center.y += enemy.biteDir.y * lunge
    }

    // Ausserhalb des Bildes gar nicht erst zeichnen.
    if (center.x < -radius || center.y < -radius || center.x > width + radius || center.y > height + radius) {
      continue
    }

    /*
     * Eine getarnte Einheit wird durchscheinend statt unsichtbar (GDD 07 Abschnitt 5).
     *
     * Ganz zu verschwinden waere regelgetreu, aber unspielbar: Der Spieler saehe einen
     * Gegner, der aus dem Nichts an seiner Station steht, und haette keine Erklaerung.
     * Ein Schemen sagt "der ist da, aber deine Tuerme sehen ihn nicht" - und genau das
     * ist die Aussage.
     */
    const hidden = enemy.cloak < 0
    const alpha = hidden ? 0.28 : 1

    /*
     * Gegner sind leuchtende Umrisse, keine gefuellten Klumpen: Die Aussage traegt die
     * Kante. So bleiben auch dichte Wellen lesbar, und der Blick faellt weiter auf die
     * helle Station statt auf den Gegnerteppich.
     *
     * DAS GLIMM-BUDGET (GDD 13 Abschnitt 7): Schein ist eine **knappe** Groesse und gehoert
     * dem Einzelstueck. Vorher bekam jeder Gegner einen breiten blassen Scheinstrich unter
     * die Linie gelegt; bei zweihundert Gegnern legten sich zweihundert solcher Hoefe
     * uebereinander und summierten sich zu einer deckenden Milchflaeche, in der die
     * Konturen aufhoerten, Konturen zu sein. Ein Schein, den jeder hat, sagt nichts mehr.
     *
     * Deshalb: Der Normalgegner ist **eine** scharfe Linie mit gerade so viel Streuung, dass
     * die Roehre brennt statt gezeichnet zu sein - zwischen zwei Nachbarn faellt der Wert
     * wieder auf den Grund zurueck. Den breiten Hof und den weissen Kern bekommen nur Elite
     * und Boss, und weil es davon wenige gibt, ist der hellste Punkt im Gegnerfeld auch
     * wieder einer, auf den man zeigen kann.
     */
    // Ein Elite traegt einen zusaetzlichen Neon-Effekt und bleibt sonst er selbst -
    // "verstaerkter Tank", nicht neuer Gegnertyp (GDD 07 Abschnitt 6). Der Boss ist ohnehin
    // die Zaesur der Welle. Beide sind Einzelstuecke - alle anderen sind Masse.
    const singular = enemy.elite.length > 0 || def.isBoss === true

    /*
     * Und deshalb ist die Masse HOHL - buchstaeblich, ohne jede Fuellung.
     *
     * Solange die Gegner nur klein genug waren, um einander nie zu beruehren, war eine
     * angedeutete Fuellung folgenlos. Sobald sie Gewicht bekommen, ueberlappen sie - und
     * eine Fuellung, die einmal sechs Prozent deckt, deckt bei drei uebereinander schon
     * siebzehn. Das ist der Punkt, an dem aus zweihundert Umrissen eine Flaeche wird und
     * das Zaehlen aufhoert. Ein Umriss ohne Fuellung kann sich mit beliebig vielen
     * Nachbarn ueberlagern und bleibt trotzdem ein Umriss.
     *
     * Das Einzelstueck behaelt seine Fuellung: Davon stehen selten mehr als eine Handvoll
     * im Bild, sie ueberlagern einander nicht, und die Fuellung ist Teil dessen, was sie
     * aus der Masse heraushebt.
     */
    tracePolygon(ctx, def.shape, center, radius, enemy.dockedTo !== null, enemy.spin + enemy.tilt)
    if (singular) {
      ctx.fillStyle = def.color
      ctx.globalAlpha = 0.06 * alpha
      ctx.fill()
    }

    ctx.strokeStyle = def.color
    ctx.shadowColor = def.color

    // Der Schein. Er sitzt unter der Linie, damit die Kante scharf bleibt - und er wird nur
    // fuer das Einzelstueck gezogen. Die Zahl der breiten Scheinstriche je Bild ist damit
    // die Zahl der Elites plus Bosse, nicht die Zahl der Gegner.
    if (singular) {
      ctx.globalAlpha = 0.4 * alpha
      ctx.lineWidth = 6
      ctx.shadowBlur = 22
      ctx.stroke()
    }

    // Die Linie. Streuung traegt nur das Einzelstueck - die Masse bekommt shadowBlur 0.
    ctx.globalAlpha = alpha
    ctx.lineWidth = singular ? 2.4 : 1.6
    ctx.shadowBlur = singular ? ENEMY_SINGULAR_BLUR : 0
    ctx.stroke()

    /*
     * Das Brennen der Roehre beim Normalgegner.
     *
     * Kein Schatten, sondern ein zweiter, schmalerer und hellerer Strich auf derselben
     * Kontur: Er sitzt mitten in der ersten Linie und macht aus dem flachen Strich einen
     * Querschnitt - aussen Glasfarbe, innen ueberbelichteter Kern. Ein Schatten wuerde
     * dasselbe erzaehlen, aber eben auch in den Spalt zum Nachbarn hinein; dieser Strich
     * kann das nicht, weil er die Kontur nirgends verlaesst.
     */
    if (!singular) {
      ctx.strokeStyle = hotEdge(def.color)
      ctx.lineWidth = 0.7
      ctx.stroke()

      /*
       * Und die Schulter, auf der der Kern absitzt - **nach innen** gelegt.
       *
       * Ohne sie faellt der Wert einen Bildpunkt neben dem Scheitel auf den Grund, und der
       * Gegner ist eine Strichzeichnung statt einer Roehre. Nach aussen darf diese Schulter
       * nicht: Dort liegt der Spalt zum Nachbarn, und alles, was dort landet, addiert sich
       * im dichten Band zweimal. Innen liegt der eigene Koerper - dieselbe weiche Flanke,
       * aber niemand teilt sie sich mit jemandem.
       */
      ctx.strokeStyle = def.color
      ctx.globalAlpha = 0.3 * alpha
      ctx.lineWidth = 1.6
      tracePolygon(
        ctx,
        def.shape,
        center,
        Math.max(radius * 0.5, radius - INNER_SHOULDER),
        enemy.dockedTo !== null,
        enemy.spin + enemy.tilt,
      )
      ctx.stroke()
      ctx.globalAlpha = alpha
    }

    /*
     * Der weisse Kern des Einzelstuecks.
     *
     * Er ist der eigentliche Zeigefinger: Ein Elite unterscheidet sich vom Normalgegner
     * nicht durch mehr Farbe - die haetten beide - sondern dadurch, dass seine Kante
     * durchbrennt. Der Hof darum bleibt in seiner Gegnerfarbe, sonst waere es ein weisser
     * Fleck statt einer glaubwuerdig ueberlasteten Roehre.
     */
    if (singular) {
      ctx.strokeStyle = THEME.enemyCoreHot
      ctx.lineWidth = 1.1
      ctx.shadowBlur = 5
      ctx.stroke()
      ctx.strokeStyle = def.color
    }
    ctx.shadowBlur = 0

    /*
     * Die Trefferquittung: Der eben getroffene Gegner brennt durch (GDD 13 Abschnitt 10).
     *
     * Der Einschlag allein sagt nur, dass irgendwo etwas eingeschlagen ist. Im dichten Pulk
     * stehen fuenf Gegner in derselben Handbreit, und ein Blitz zwischen ihnen zeigt auf
     * keinen davon. Erst wenn **der Getroffene selbst** hell wird, hat der Schuss ein Ziel.
     *
     * Zwei Striche und eine Fuellung, alle in derselben kurzen Zeit:
     *
     *   *Fuellung*  hebt die ganze Flaeche an. Sie ist der Teil, der den Gegner auch dann
     *               noch aus der Reihe holt, wenn seine Kontur zwischen Nachbarn liegt -
     *               eine hellere Linie allein geht in einem Band aus Linien unter.
     *
     *   *Kontur*    dick und heiss, damit die Form erkennbar bleibt. Eine reine Aufhellung
     *               ohne Kante waere ein Fleck und keine Einheit mehr.
     *
     *   *Streuung*  nur hier, und nur fuer diesen Wimpernschlag. Das Glimm-Budget (GDD 13
     *               Abschnitt 7) gehoert dem Einzelstueck - und ein Gegner, der gerade
     *               getroffen wird, **ist** in diesem Augenblick das Einzelstueck. Die Zahl
     *               der Hoefe je Bild ist die Zahl der Treffer, nicht die Zahl der Gegner.
     *
     * Sie klingt linear aus und faellt damit sichtbar ab, statt zu blinken. Getarnte Gegner
     * bekommen sie ueber `alpha` gedaempft mit: Wer trifft, was er nicht sieht, soll das
     * ruhig sehen.
     */
    const flash = enemy.flashLife > 0 ? Math.max(0, 1 - enemy.flash / enemy.flashLife) : 0
    if (flash > 0) {
      ctx.fillStyle = THEME.enemyHitFlash
      ctx.globalAlpha = HIT_FLASH_FILL * flash * alpha
      tracePolygon(ctx, def.shape, center, radius, enemy.dockedTo !== null, enemy.spin + enemy.tilt)
      ctx.fill()

      ctx.strokeStyle = THEME.enemyHitFlash
      ctx.shadowColor = THEME.enemyHitFlash
      ctx.shadowBlur = HIT_FLASH_BLUR * flash
      ctx.globalAlpha = flash * alpha
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.strokeStyle = def.color
      ctx.globalAlpha = alpha
    }

    // Ein Schild liegt als zweiter Ring aussen herum - man soll sehen, warum die Treffer
    // wenig bewirken, statt es an der Lebensleiste zu erraten.
    if (enemy.shield > 0) {
      ctx.globalAlpha = 0.4 * alpha
      ctx.strokeStyle = PALETTE.cyan
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 1.35, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Brennt er, glimmt er von innen.
    if (enemy.burnLeft > 0) {
      ctx.globalAlpha = 0.35 * alpha
      ctx.fillStyle = PALETTE.gold
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius * 0.7, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ist er verlangsamt, legt sich ein kalter Schleier darueber.
    if (enemy.chillLeft > 0) {
      ctx.globalAlpha = 0.3 * alpha
      ctx.fillStyle = PALETTE.edge
      tracePolygon(ctx, def.shape, center, radius, enemy.dockedTo !== null, enemy.spin + enemy.tilt)
      ctx.fill()
    }

    ctx.globalAlpha = alpha
    // Getroffen heisst Balken - ohne Ausnahme und ohne Schwelle. Wer noch unversehrt ist,
    // traegt keinen: Ein leerer Rahmen an jedem der zweihundert Anmarschierenden waere
    // Rauschen, und "voll" sagt die unversehrte Kontur selbst.
    //
    // Gezeichnet wird er hier noch nicht, nur vorgemerkt - siehe `hpBars` und `drawHpBars`.
    if (enemy.hp < enemy.maxHp) {
      const slot = hpBarSlot()
      slot.x = center.x
      slot.y = center.y
      slot.radius = radius
      slot.fraction = enemy.hp / enemy.maxHp
      slot.boss = def.isBoss === true
    }
  }

  ctx.restore()
}

/*
 * Die vorgemerkten Balken - eine Liste, die mitwaechst und dann liegen bleibt.
 *
 * Sie wird je Bild auf Laenge null zurueckgesetzt, aber nie geleert: Ihre Eintraege sind
 * die immer gleichen Objekte, die nur neu beschrieben werden. Bei zweihundert
 * angeschlagenen Gegnern und sechzig Bildern in der Sekunde waeren frisch erzeugte
 * Eintraege zwoelftausend Wegwerfobjekte je Sekunde - dieselbe Ueberlegung wie bei den
 * Effektlisten in `sim/`.
 */
type HpBarSlot = { x: number; y: number; radius: number; fraction: number; boss: boolean }
const hpBars: HpBarSlot[] = []
let hpBarCount = 0

function hpBarSlot(): HpBarSlot {
  let slot = hpBars[hpBarCount]
  if (slot === undefined) {
    slot = { x: 0, y: 0, radius: 0, fraction: 0, boss: false }
    hpBars.push(slot)
  }
  hpBarCount++
  return slot
}

/**
 * Die Lebensbalken aller angeschlagenen Gegner - alle zusammen, ganz zum Schluss.
 *
 * Die Reihenfolge steht in `render/scene.ts`, wie jede Ebene: Diese hier gehoert **hinter**
 * den letzten Kampfeffekt und **vor** die Schadenszahlen.
 *
 * Warum ueberhaupt eine eigene Ebene: Ein Balken, der im Gegnerdurchlauf entsteht, wird von
 * allem uebermalt, was danach kommt - erst vom spaeter gezeichneten Nachbarn, dann von
 * Druckwelle, Splittern, Geschossen, Drohnen, Strahlen und Trefferblitzen. Nachgemessen in
 * Welle 12 mit Pulk: von fuenf angeschlagenen Gegnern trug einer 0 von 54 Bildpunkten
 * seines Balkens, drei weitere zwischen 27 und 31; ein einzelner Trefferblitz genuegte, um
 * eine Lebensanzeige vollstaendig auszuloeschen.
 *
 * Der Balken ist keine Zeichnung AM Gegner, sondern eine Auskunft UEBER ihn. Auskunft haengt
 * nicht davon ab, wo in einer Liste ihr Traeger steht oder ob gerade jemand neben ihm
 * getroffen wurde. Ueber den Zahlen liegt sie trotzdem nicht: Die Zahl ist die Quittung des
 * Augenblicks und flieht nach oben aus dem Bild, der Balken ist Dauerzustand.
 *
 * Ohne Kamera und ohne Bildmasse: Was hier gezeichnet wird, steht in `hpBars` bereits in
 * Bildschirmkoordinaten - `drawEnemies` hat sie eben umgerechnet, samt Biss-Versatz und
 * gezeichnetem Halbmesser. Ein zweites Mal umzurechnen hiesse, dieselbe Zahl aus zwei
 * Quellen zu holen.
 */
export function drawHpBars(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.globalAlpha = 1
  for (let i = 0; i < hpBarCount; i++) {
    const bar = hpBars[i]
    if (bar === undefined) break
    drawHpBar(ctx, bar, bar.radius, bar.fraction, bar.boss)
  }
  ctx.restore()
}

/**
 * Laserstrahlen (GDD 05: Laser-Turm).
 *
 * Ein heller Kern in einem breiteren Schein - so liest sich eine Linie als Energie und
 * nicht als gezogener Strich. Sie leben einen Wimpernschlag; bei sechs Schuessen je Sekunde
 * ergibt das den Dauerstrahl, den das GDD beschreibt.
 */
export function drawBeams(
  ctx: CanvasRenderingContext2D,
  beams: readonly Beam[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'

  for (const beam of beams) {
    if (!beam.active) continue

    const fade = Math.max(0, 1 - beam.age / beam.life)
    const from = worldToScreen(camera, beam.from, width, height)
    const to = worldToScreen(camera, beam.to, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))

    ctx.strokeStyle = beam.color
    ctx.shadowColor = beam.color

    ctx.globalAlpha = 0.35 * fade
    ctx.shadowBlur = 12
    ctx.lineWidth = 6 * zoom
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()

    ctx.globalAlpha = fade
    ctx.shadowBlur = 6
    ctx.lineWidth = 2 * zoom
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Kampfdrohnen (GDD 05: Drohnen-Modul).
 *
 * Kleine leuchtende Rauten auf ihrer Kreisbahn. Bewusst schlicht: Sie sind zu dritt bis zu
 * sechst gleichzeitig unterwegs, und alles Aufwendigere waere in dieser Groesse Rauschen.
 */
export function drawDrones(
  ctx: CanvasRenderingContext2D,
  drones: readonly Drone[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (drones.length === 0) return
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  for (const drone of drones) {
    const center = worldToScreen(camera, drone.pos, width, height)
    // Ein leichtes Pulsen aus der eigenen Bahnlage - so blinken nicht alle im Takt.
    const pulse = 0.75 + 0.25 * Math.sin(time * 5 + drone.angle * 3)
    const size = 4.2 * zoom

    ctx.globalAlpha = pulse
    ctx.fillStyle = drone.color
    ctx.shadowColor = drone.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(center.x, center.y - size)
    ctx.lineTo(center.x + size, center.y)
    ctx.lineTo(center.x, center.y + size)
    ctx.lineTo(center.x - size, center.y)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Versorgungskapseln im Feld (GDD 11 Abschnitt 8).
 *
 * Sie sollen sich vom Gold **auf den ersten Blick** unterscheiden: Gold ist rund und liegt,
 * eine Kapsel ist kantig und schwebt. Deshalb ein Sechseck statt einer Scheibe, ein
 * langsames Auf und Ab statt einer festen Lage, und ein Ring darum, den es beim Gold nicht
 * gibt.
 *
 * Die Farbe kommt aus der Seltenheit der Kapsel - dieselbe Sprache wie bei Tuermen und
 * Perks (GDD 13 Abschnitt 7). Ein blaues Leuchten ist die normale Kapsel, ein goldenes die
 * seltene, ein magentafarbenes der Gluecksfall.
 */
export function drawPods(
  ctx: CanvasRenderingContext2D,
  pods: readonly Pod[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
  active = true,
): void {
  if (pods.length === 0) return

  const zoom = Math.max(0.6, viewZoom(camera))
  const dim = active ? 1 : COIN_DIM_IDLE

  ctx.save()
  ctx.lineJoin = 'round'

  for (const pod of pods) {
    const color = RARITY_COLOR[podById(pod.defId).rarity]
    const center = worldToScreen(camera, { x: pod.x, y: pod.y }, width, height)
    const size = POD_RADIUS * zoom

    if (
      center.x < -size * 2 ||
      center.y < -size * 2 ||
      center.x > width + size * 2 ||
      center.y > height + size * 2
    ) {
      continue
    }

    // Der Versatz kommt aus dem Ort, nicht aus einem Zufall: Dieselbe Kapsel schwebt immer
    // gleich, zwei nebeneinander aber nie im Takt - genau wie beim Glanz der Muenzen.
    const phase = time * POD_BOB_SPEED + pod.x * 0.02 + pod.y * 0.02
    const y = center.y + Math.sin(phase) * POD_BOB * zoom
    const pulse = 0.72 + 0.28 * Math.sin(phase * 1.7)

    ctx.globalAlpha = dim
    ctx.shadowColor = color
    ctx.shadowBlur = 16 * pulse

    // Der Koerper: ein stehendes Sechseck.
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
      const px = center.x + Math.cos(angle) * size
      const py = y + Math.sin(angle) * size
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = PALETTE.panelDeep
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    // Der Kern - er traegt die Farbe voll, der Rahmen nur als Kante.
    ctx.globalAlpha = dim * pulse
    ctx.beginPath()
    ctx.arc(center.x, y, size * 0.36, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    // Der Ring darunter sagt "hier liegt etwas" - er atmet mit und macht die Kapsel auch
    // dann sichtbar, wenn Gegner darueber laufen.
    ctx.globalAlpha = dim * 0.3 * pulse
    ctx.beginPath()
    ctx.arc(center.x, center.y + size * 0.9, size * (1.1 + 0.25 * pulse), 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Die Haendler-Drohne (GDD 11 Abschnitt 7).
 *
 * Sie muss **drei Dinge auf einen Blick** sagen, und jedes hat seine eigene Form:
 *
 *   *hier ist etwas zu holen*      ein deutlich groesserer Koerper als bei einer Kapsel,
 *                                  in Gold - der Farbe des Handels
 *   *es eilt*                      ein Ring, der sich leert. Eine Zahl waere genauer und
 *                                  schlechter: Man liest sie, statt sie zu sehen
 *   *du hast sie erreicht*         der Ring wird voll und ruhig, das Blinken hoert auf
 *
 * Ohne den leerlaufenden Ring waere die Drohne ein Gegenstand, der irgendwann verschwindet -
 * und ein Verschwinden ohne Ankuendigung liest sich als Fehler, nicht als Frist.
 */
export function drawTrader(
  ctx: CanvasRenderingContext2D,
  trader: Trader | null,
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (!trader) return

  const zoom = Math.max(0.6, viewZoom(camera))
  const center = worldToScreen(camera, { x: trader.x, y: trader.y }, width, height)
  const size = TRADER_RADIUS * zoom

  // Eine erreichte Drohne wartet - also hoert sie auch auf zu draengen.
  const share = trader.visited ? 1 : Math.max(0, Math.min(1, trader.left / TRADER_STAY_SECONDS))
  // Je knapper die Zeit, desto schneller das Pochen. Unter einem Viertel wird es dringlich.
  const urgency = trader.visited ? 1.4 : 1.4 + (1 - share) * 7
  const pulse = 0.7 + 0.3 * Math.sin(time * urgency)

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Der Fristring. Er laeuft von oben aus im Uhrzeigersinn ab, wie jede Uhr.
  ctx.globalAlpha = 0.85
  ctx.strokeStyle = PALETTE.gold
  ctx.lineWidth = 3
  ctx.shadowColor = PALETTE.gold
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(center.x, center.y, size * 1.7, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2)
  ctx.stroke()

  // Der Koerper: eine liegende Raute mit Ladeflaeche - deutlich anders als das Sechseck
  // der Kapsel und der Ring des Goldsammlers.
  const bob = Math.sin(time * 1.8) * 2.5 * zoom
  const y = center.y + bob

  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(center.x, y - size)
  ctx.lineTo(center.x + size * 1.35, y)
  ctx.lineTo(center.x, y + size)
  ctx.lineTo(center.x - size * 1.35, y)
  ctx.closePath()
  ctx.fillStyle = PALETTE.panelDeep
  ctx.fill()
  ctx.lineWidth = 2
  ctx.stroke()

  // Die Ladung im Inneren - sie pulst, solange die Drohne wartet.
  ctx.globalAlpha = pulse
  ctx.fillStyle = PALETTE.gold
  ctx.beginPath()
  ctx.arc(center.x, y, size * 0.34, 0, Math.PI * 2)
  ctx.fill()

  // Zwei Triebwerke unter der Raute: Sie machen aus einem Zeichen ein Fahrzeug.
  ctx.globalAlpha = 0.45 * pulse
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(center.x + side * size * 0.8, y + size * 0.72, size * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Goldsammler (GDD 12 Abschnitt 14: "kleine schwebende Drohnen mit Neonbeleuchtung").
 *
 * Sie tragen die Goldfarbe und nicht die Leitfarbe der Station: Was ein Helfer tut, ist
 * Gold aufheben, und der Spieler soll ohne Text erkennen, wofuer die Drohne da ist. Die
 * Form ist bewusst ein anderes Zeichen als bei den Kampfdrohnen - ein Ring statt einer
 * Raute -, damit man beide nicht verwechselt.
 */
export function drawHelpers(
  ctx: CanvasRenderingContext2D,
  helpers: readonly Helper[],
  radius: number,
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  if (helpers.length === 0) return

  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  for (const [index, helper] of helpers.entries()) {
    const center = worldToScreen(camera, { x: helper.x, y: helper.y }, width, height)
    const pulse = 0.7 + 0.3 * Math.sin(time * 3 + index * 2)
    const size = HELPER_SIZE * zoom

    // Der Sammelradius als sehr blasse Scheibe - er erklaert, warum Muenzen verschwinden,
    // ohne mit dem Angriffskreis der Station um Aufmerksamkeit zu streiten.
    ctx.globalAlpha = 0.1 * pulse
    ctx.fillStyle = PALETTE.gold
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius * zoom, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.strokeStyle = PALETTE.gold
    ctx.shadowColor = PALETTE.gold
    ctx.shadowBlur = 10
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.arc(center.x, center.y, size, 0, Math.PI * 2)
    ctx.stroke()

    // Ein kurzer Strich in Fahrtrichtung: Er sagt, wohin der Helfer gerade unterwegs ist.
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(center.x + Math.cos(helper.angle) * size * 1.9, center.y + Math.sin(helper.angle) * size * 1.9)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Marken am Bildrand fuer Gegner, die noch ausserhalb laufen.
 *
 * Der Erscheinungsring liegt immer ausserhalb des Bildausschnitts - nachgemessen liegt er
 * bei 476 bis 555 Einheiten, sichtbar sind je nach Fenster 138 bis 436. Gegner erscheinen
 * also grundsaetzlich ungesehen und tauchen unvermittelt am Rand auf. Die Marke schliesst
 * diese Luecke: Sie zeigt die Richtung, aus der etwas kommt, in der Farbe dessen, was
 * kommt (GDD 07 Abschnitt 3).
 *
 * Dezent bleibt sie durch die Entfernung: Je weiter ein Gegner draussen ist, desto blasser
 * und kleiner steht seine Marke. Wer eben erscheint, ist kaum zu sehen; wer gleich eintritt,
 * ist deutlich. Damit wird aus zwanzig Gegnern am Ring kein Kranz aus Zeichen.
 */
export function drawApproach(
  ctx: CanvasRenderingContext2D,
  enemies: readonly Enemy[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const centerX = width / 2
  const centerY = height / 2
  let drawn = 0

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const enemy of enemies) {
    if (drawn >= APPROACH_MAX) break

    const point = worldToScreen(camera, enemy.pos, width, height)
    const radius = enemy.radius * viewZoom(camera)
    const inside =
      point.x >= -radius && point.y >= -radius && point.x <= width + radius && point.y <= height + radius
    if (inside) continue

    const x = Math.min(width - APPROACH_INSET, Math.max(APPROACH_INSET, point.x))
    const y = Math.min(height - APPROACH_INSET, Math.max(APPROACH_INSET, point.y))
    const fade = 1 - Math.min(1, Math.hypot(point.x - x, point.y - y) / APPROACH_FADE)
    if (fade <= 0.02) continue

    // Der Gegner laeuft auf die Station zu, also zeigt die Marke ins Bild hinein.
    const dx = centerX - x
    const dy = centerY - y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const size = APPROACH_SIZE * (0.6 + 0.4 * fade)

    const color = enemyById(enemy.defId).color
    ctx.globalAlpha = 0.25 + 0.55 * fade
    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 6 * fade
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - ux * size * 0.4 - uy * size * 0.7, y - uy * size * 0.4 + ux * size * 0.7)
    ctx.lineTo(x + ux * size * 0.6, y + uy * size * 0.6)
    ctx.lineTo(x - ux * size * 0.4 + uy * size * 0.7, y - uy * size * 0.4 - ux * size * 0.7)
    ctx.stroke()

    drawn += 1
  }

  ctx.restore()
}

/**
 * Mittig gesetzte Zahl auf ganzen Pixeln.
 *
 * Eine Pixelschrift verwischt, sobald sie auf gebrochenen Koordinaten sitzt - und die
 * kommen aus jeder Weltumrechnung. Gerundet wird die **linke Kante**, nicht der Mittelpunkt:
 * Bei mittiger Ausrichtung landet eine ungerade Textbreite sonst wieder auf einem halben
 * Pixel.
 *
 * `measureText` ist hier bezahlbar, weil nur wenige Zahlen gleichzeitig stehen - beschriftet
 * wird ein Zwoelftel der Muenzen, und Beträge gibt es hoechstens zwoelf. Gemessen kostet
 * ein Aufruf rund zwei Mikrosekunden.
 */
/*
 * `outline` ist die Breite einer harten schwarzen Kontur unter der Fuellung, 0 heisst keine.
 *
 * Sie wird als **Linie** gezogen und nicht als Schatten: Ein Schatten waere weich, und weich
 * heisst, dass zwischen zwei Ziffernstrichen ein Grau steht statt Schwarz - genau dort, wo
 * das Auge die Ziffer trennt. Die Linie liegt je zur Haelfte innen und aussen; ist sie so
 * breit wie der Zwischenraum einer Ziffer, faellt der Zwischenraum auf Schwarz, und die Zahl
 * traegt ihren eigenen Grund mit sich, egal was darunter liegt.
 *
 * Runde Ecken sind dabei Pflicht: Eine Pixelschrift besteht aus rechten Winkeln, und ein
 * spitzer Stossverbund stellte an jedem davon eine Nadel auf.
 */
function writePixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  outline = 0,
): void {
  const width = ctx.measureText(text).width
  const x = Math.round(centerX - width / 2)
  const y = Math.round(centerY)
  if (outline > 0) {
    ctx.lineWidth = outline
    ctx.strokeText(text, x, y)
  }
  ctx.fillText(text, x, y)
}

/**
 * Der Umriss eines Gegners.
 *
 * `spin` ist sein Wanken aus den Beruehrungen mit Nachbarn (`sim/enemies.ts`). Es kommt
 * **auf** die feste Lage der Form obendrauf und ist dort auf rund 20 Grad begrenzt: Die Form
 * nennt die Gegnerart (GDD 07 Abschnitt 3), und ein Quadrat, das sich frei drehen duerfte,
 * waere bei 45 Grad eine Raute - also eine andere Art.
 */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  center: Vec2,
  radius: number,
  docked: boolean,
  spin = 0,
): void {
  const sides = sidesOfShape(shape)
  // Angedockte Gegner stehen still - eine leichte Drehung macht sie trotzdem lesbar.
  // Die Raute ist ein gedrehtes Quadrat - daher der feste Versatz.
  const rotation = (docked ? Math.PI / sides : 0) + (shape === 'diamond' ? Math.PI / 4 : 0) + spin

  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides - Math.PI / 2
    const point = { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
    if (i === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  }
  ctx.closePath()
}

/** Kantenzahl einer Gegnerform. Die Raute ist ein Quadrat, nur gedreht. */
function sidesOfShape(shape: EnemyShape): number {
  switch (shape) {
    case 'triangle':
      return 3
    case 'square':
    case 'diamond':
      return 4
    case 'pentagon':
      return 5
    case 'hexagon':
      return 6
  }
}

/**
 * Lebensbalken eines Gegners - fuer alle derselbe.
 *
 * Ein fast schwarzes Bett fester Laenge, darin ein Faden in `THEME.hpBar`. Das Bett ist
 * die eigentliche Leistung: Ohne es waere der sichtbare Balken die Fuellung selbst, und
 * ein Gegner bei 44 Prozent traege einen sichtbar kuerzeren Strich als einer bei 63. Vier
 * verschieden lange Striche sind vier Objekte; vier gleich lange Betten mit verschieden
 * gefuellten Faeden sind eine Reihe mit einer ablesbaren Groesse darin.
 *
 * Die Fuellung traegt bewusst **nicht** die Gegnerfarbe. Sie sagt "Leben", und Leben hat
 * im ganzen Spiel genau eine Farbe (GDD 13 Abschnitt 2, `PALETTE.life`). Trueg sie die
 * Farbe des Traegers, muesste man vor dem Ablesen erst herausfinden, welcher Ton hier
 * gerade "voll" bedeutet.
 *
 * `PALETTE.life` und nicht `PALETTE.magenta`: Magenta ist selbst eine Gegnerfarbe - der
 * `drone` traegt sie byteidentisch. Ein Balken in der Farbe seines Traegers ist kein
 * Balken. Nachgerechnet ist der Abstand bei `LIFE` in `theme.ts`; gehalten wird er von der
 * Pruefung "kein Gegner traegt die Farbe des Lebensbalkens" in `selftest/suites/content.ts`.
 *
 * Zwei `fillRect` auf gerundeten Koordinaten statt zweier Striche mit runden Enden: Runde
 * Enden setzen an jedes Balkenende einen halben Pixel Weichzeichnung, und die faellt bei
 * krummen Mittelpunkten mal so und mal so aus. Ein Balken, dessen Laenge vom Unterpixel
 * seines Gegners abhaengt, ist nicht mehr fuer alle derselbe.
 */
function drawHpBar(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  fraction: number,
  boss: boolean,
): void {
  const barWidth = boss ? HP_BAR_WIDTH_BOSS : HP_BAR_WIDTH
  const left = Math.round(center.x - barWidth / 2)
  const top = Math.round(center.y - radius - HP_BAR_GAP - HP_BAR_HEIGHT)
  const filled = Math.max(0, Math.min(1, fraction))

  ctx.save()
  ctx.globalAlpha = 1
  // Kein Hof. Der Faden liegt gesaettigt auf fast schwarzem Bett und traegt sich selbst;
  // ein Schatten an jedem angeschlagenen Gegner streute ueber das Bett hinaus und legte
  // die Taeler zwischen zwei Konturen zu (Glimm-Budget, GDD 13 Abschnitt 7).
  ctx.shadowBlur = 0

  ctx.fillStyle = PALETTE.inkDeep
  ctx.fillRect(left, top, barWidth, HP_BAR_HEIGHT)

  if (filled > 0) {
    // Mindestens ein Pixel: Der letzte Rest Leben ist die Auskunft, auf die es ankommt -
    // er darf nicht dadurch verschwinden, dass er unter die Rundung faellt.
    ctx.fillStyle = THEME.hpBar
    ctx.fillRect(left, top, Math.max(1, Math.round(barWidth * filled)), HP_BAR_HEIGHT)
  }

  ctx.restore()
}

/*
 * Der Verlauf des Schweifs, einmal angelegt und wiederverwendet.
 *
 * Bei 600 gleichzeitigen Geschossen (`MAX_PROJECTILES`) waere ein eigener Verlauf je Geschoss
 * und Bild 36 000 Wegwerfobjekte je Sekunde. Der Verlauf ist aber fuer alle derselbe: Er
 * laeuft in einem Einheitsraum von 0 (Kopf) nach 1 (Ende), und jedes Geschoss legt ihn ueber
 * eine gedrehte und gestreckte Leinwand auf seine eigene Bahn. Gehalten wird er zusammen mit
 * der Leinwand, fuer die er gebaut wurde - wechselt sie, wird er neu angelegt.
 */
let trailFade: CanvasGradient | null = null
let trailFadeCtx: CanvasRenderingContext2D | null = null

function trailGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (trailFade && trailFadeCtx === ctx) return trailFade

  const gradient = ctx.createLinearGradient(0, 0, 1, 0)
  const rgb = THEME.bulletTrailRgb
  const peak = THEME.bulletTrailAlpha
  /*
   * Die Stuetzstellen fallen streng monoton - das ist die Eigenschaft, an der man den
   * Schweif als Richtungsangabe liest und nicht als Strich.
   *
   * Sie sind bewusst **flach** gehalten und stuerzen erst am letzten Zwanzigstel ab. Ein
   * schneller Abfall sah zwar weicher aus, liess vom Keil aber nur die vordere Haelfte
   * ueber dem Grund stehen - nachgemessen war der Rest bei Zoom 0,9 keine zwei
   * Helligkeitsstufen vom Hintergrund entfernt. Die Laenge, die den Schuss lesbar macht,
   * muss auch gemessen werden koennen.
   *
   * Seit der Keil vor dem Modul endet, ist er kuerzer, und dieselben Stuetzstellen liegen
   * damit auf weniger Pixeln - in der Mitte des Keils blieb nur noch 0,28 Deckkraft ueber
   * dem Grund. Dort, wo ein Reichweitenkreis unter ihm durchlief, hob der Grund die Zahl
   * nachgemessen um 3,0 Luminanz an: ein Wiederanstieg, der nicht vom Schweif kam, ihn aber
   * genauso zerbricht. Die Stuetzstellen halten die Deckkraft in der Mitte deshalb jetzt bei
   * 0,37 - hoch genug, dass der Keil dort bestimmt, was zu sehen ist, und mit unveraendert
   * fallendem Verlauf.
   */
  gradient.addColorStop(0, `rgba(${rgb}, ${peak})`)
  gradient.addColorStop(0.45, `rgba(${rgb}, ${(peak * 0.8).toFixed(3)})`)
  gradient.addColorStop(0.78, `rgba(${rgb}, ${(peak * 0.5).toFixed(3)})`)
  gradient.addColorStop(0.95, `rgba(${rgb}, ${(peak * 0.16).toFixed(3)})`)
  gradient.addColorStop(1, `rgba(${rgb}, 0)`)

  trailFade = gradient
  trailFadeCtx = ctx
  return gradient
}

/**
 * Geschosse: heller Kopf, dunkler Keil dahinter.
 *
 * Der Kopf ist zweiteilig - ein Ring in der Turmfarbe mit weissem Kern und einem schwachen
 * Hof. Erst diese drei Lagen machen aus dem Geschoss ein *Objekt*: Ein einfarbiger Punkt in
 * der Groesse, in der ein Geschoss stehen darf, ist im Standbild nicht von einem Rest eines
 * Effekts zu unterscheiden. Der Ring traegt die Auskunft (welcher Turm), der Kern die
 * Helligkeit (da ist etwas), der Hof den Neonton.
 *
 * Der Keil dahinter zeigt **zum Rohr zurueck**, nicht entgegen der Flugrichtung: Geschosse
 * verfolgen ihr Ziel, `dir` dreht also unterwegs weg. Gezeichnet wird deshalb ueber
 * `projectile.origin`, und damit trifft die Verlaengerung jedes Keils das Modul, das ihn
 * abgefeuert hat. Im Standbild liest man daran ab, welche Tuerme gerade arbeiten und wohin -
 * eine Auskunft, die eine Punktwolke nicht geben kann.
 *
 * Alle Keile zuerst, alle Koepfe danach: Sonst legte der Keil eines spaeteren Geschosses
 * seinen Schleier ueber den Kopf eines frueheren, und in einem dichten Feld saehen einzelne
 * Koepfe stumpfer aus als andere.
 */
export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: readonly Projectile[],
  camera: Camera,
  width: number,
  height: number,
): void {
  if (projectiles.length === 0) return

  const zoom = Math.max(0.6, viewZoom(camera))
  ctx.save()

  // Der Abstand zum Modul steht in Welteinheiten und wird deshalb mit dem **ungedeckelten**
  // Zoom umgerechnet: Er muss dieselbe Strecke abdecken, die auch das Modul einnimmt.
  const worldZoom = viewZoom(camera)

  const fade = trailGradient(ctx)
  ctx.shadowBlur = 0
  ctx.fillStyle = fade

  for (const projectile of projectiles) {
    const center = worldToScreen(camera, projectile.pos, width, height)
    const from = worldToScreen(camera, projectile.origin, width, height)

    const backX = from.x - center.x
    const backY = from.y - center.y
    const flown = Math.hypot(backX, backY)

    // Der Keil endet vor dem Modul, statt hineinzulaufen. Wer noch keinen Platz dafuer hat,
    // steckt eben noch im eigenen Rohr - dort steht das Muendungsfeuer und sagt dasselbe.
    const clear = (projectile.reach + TRAIL_CLEAR_HALO) * worldZoom
    const length = Math.min(TRAIL_MAX_PX, flown - clear)
    if (length < TRAIL_MIN_PX) continue

    // Der Einheitsverlauf wird auf die Bahn gelegt: Ursprung am Kopf, x-Achse nach hinten,
    // Laenge 1 entspricht dem Ende des Keils. Gestreckt wird nur die Laenge - die y-Werte
    // stehen deshalb unveraendert in Bildschirmpixeln.
    ctx.save()
    ctx.translate(center.x, center.y)
    ctx.rotate(Math.atan2(backY, backX))
    ctx.scale(length, 1)
    ctx.beginPath()
    ctx.moveTo(0, -TRAIL_HALF_HEAD_PX)
    ctx.lineTo(1, -TRAIL_HALF_TAIL_PX)
    ctx.lineTo(1, TRAIL_HALF_TAIL_PX)
    ctx.lineTo(0, TRAIL_HALF_HEAD_PX)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  for (const projectile of projectiles) {
    const center = worldToScreen(camera, projectile.pos, width, height)
    const head = Math.max(HEAD_MIN_PX, (projectile.crit ? HEAD_CRIT_PX : HEAD_PX) * zoom)

    // Hof: der einzige Teil des Geschosses, der leuchtet - und zwar nur so weit, wie ein
    // Neonpunkt eben ausstrahlt. Er liegt unter Ring und Kern, damit er sie nicht aufweicht.
    ctx.globalAlpha = 0.22
    ctx.fillStyle = projectile.color
    ctx.shadowColor = projectile.color
    ctx.shadowBlur = head * 2
    ctx.beginPath()
    ctx.arc(center.x, center.y, head * 0.95, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.strokeStyle = projectile.color
    ctx.lineWidth = head * 0.46
    ctx.beginPath()
    ctx.arc(center.x, center.y, head * 0.68, 0, Math.PI * 2)
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.fillStyle = THEME.bulletCore
    ctx.beginPath()
    ctx.arc(center.x, center.y, head * 0.34, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Liegendes Gold (GDD 08 Abschnitt 2). Muenzen verfallen nie, deshalb sind sie dauerhaft
 * sichtbar.
 *
 * Sie tragen **keine Zahl**. Der Wert steht in drei Dingen, die man ohne Lesen erfasst:
 * Groesse, Metall (bronze, silber, gold) und - solange man hinsieht - der Glanzlauf. Eine
 * aufgedruckte Zahl auf einer 14 Pixel grossen Scheibe war ohnehin nur bei wenigen lesbar
 * und machte aus liegendem Gold eine Tabelle.
 */
export function drawCoins(
  ctx: CanvasRenderingContext2D,
  coins: readonly Coin[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
  active = true,
): void {
  if (coins.length === 0) return

  const mean = meanCoinValue(coins)

  // Ausserhalb des Kampfes ist Gold Auskunft, keine Aufforderung: Es liegt weiter da
  // (GDD 08 Abschnitt 2), aufheben laesst es sich aber nur im Kampf. Gedaempft tritt es
  // hinter die Bauhilfen zurueck, statt mit ihnen um Aufmerksamkeit zu streiten.
  const dim = active ? 1 : COIN_DIM_IDLE
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  ctx.globalAlpha = dim

  for (const coin of coins) {
    const center = worldToScreen(camera, { x: coin.x, y: coin.y }, width, height)
    const { radius, tier } = coinLook(coin.value, mean, zoom)

    if (
      center.x < -radius ||
      center.y < -radius ||
      center.x > width + radius ||
      center.y > height + radius
    ) {
      continue
    }

    if (SPRITES.coins.ready()) {
      drawFrame(ctx, SPRITES.coins, glintFrame(time, coin.x, coin.y), tier, center.x, center.y, radius * 2)
    } else {
      // Bis das Bild da ist, bleibt die gezeichnete Scheibe. Ein fehlendes Bild darf nie
      // ein leeres Feld ergeben.
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = PALETTE.gold
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Wie eine Muenze aussieht: Groesse und Metall - beide aus **einem** Mass.
 *
 * Das Mass ist das Vielfache des Durchschnitts auf dem Feld, nicht der absolute Wert und
 * nicht der Anteil an der Summe.
 *
 * Ein absolutes Mass braucht einen Deckel, sonst deckt ein spaeter Stapel die halbe Station
 * zu - und ueber dem Deckel sehen wieder alle gleich aus. Der Anteil an der Summe wiederum
 * waechst, waehrend man einsammelt: Von zehn gleichen Muenzen wuchs die letzte von Radius
 * 6,2 auf 11, obwohl sich an ihr nichts geaendert hatte.
 *
 * Das Vielfache des Durchschnitts ist gegen beides fest. Gleich schwere Muenzen bleiben
 * gleich gross, egal wie viele davon noch liegen, und ein Stapel, der zehnmal so schwer ist
 * wie der Durchschnitt, sieht auf jeder Wellenhoehe gleich aus.
 *
 * Die Wurzel spreizt das untere Ende: Ein Krumen unter vielen bleibt sichtbar, statt auf den
 * Grundwert zusammenzufallen.
 *
 * Groesse und Metall kommen aus **derselben** Zahl und koennen sich deshalb nicht
 * widersprechen. Und sie stehen an einer Stelle, weil zwei Ebenen sie brauchen: das
 * liegende Gold und die aufgehobene Muenze auf ihrem Flug zum Zeiger.
 */
function coinLook(value: number, mean: number, zoom: number): { radius: number; tier: number } {
  const times = mean > 0 ? value / mean : 1
  const radius =
    (COIN_RADIUS_BASE + COIN_RADIUS_SPAN * Math.min(1, Math.sqrt(times) / COIN_SIZE_SPREAD)) * zoom
  const tier = times >= COIN_TIER_GOLD ? 2 : times >= COIN_TIER_SILVER ? 1 : 0
  return { radius, tier }
}

/**
 * Welches Bild des Glanzlaufs eine Muenze gerade zeigt.
 *
 * Der Versatz kommt aus ihrem Ort und braucht deshalb weder Zufall noch gespeicherten
 * Zustand. Ausserhalb des Laufs steht Bild 0 - die ruhende Muenze.
 */
function glintFrame(time: number, x: number, y: number): number {
  const offset = Math.abs(Math.sin(x * 0.013 + y * 0.017)) * GLINT_PERIOD
  const phase = (time + offset) % GLINT_PERIOD
  const frame = Math.floor(phase * GLINT_FPS)
  return frame < SPRITES.coins.frames ? frame : 0
}

/**
 * Der Wirkungsbereich der Station (GDD 13 Abschnitt 4).
 *
 * Er ersetzt den frueher gezeigten Sammelradius am Zeiger. Das ist ein Tausch von zwei
 * Anzeigen, die beide "Reichweite" hiessen und Verschiedenes meinten: Der Sammelradius
 * haftete am Zeiger und sagte etwas ueber die Maus, dieser Umriss haftet an der Station und
 * sagt, wohin sie schiesst. Nur der zweite ist eine Aussage ueber das Spiel.
 *
 * **Es ist kein Kreis, sondern die Vereinigung vieler Kreise** - je einer um jeden Turm, der
 * schiesst (`rangeCircles` in `sim/towers.ts`). Ein einzelner Kreis um den Kern waere in
 * beide Richtungen falsch: Nimmt er die kleinste Reichweite, sterben Gegner sichtbar
 * ausserhalb; nimmt er die groesste, verspricht er Deckung auf der Seite, wo gar kein Turm
 * steht.
 *
 * Sie werden **wie Tropfen zusammengefuehrt**, nicht wie Scheiben uebereinandergelegt: Wo
 * zwei Kreise einander nahe kommen, waechst zwischen ihnen ein Hals, und aus zwei Formen wird
 * eine (`RANGE_BLOB_MERGE`). Der Bereich liest sich dadurch als **ein** Koerper mit Beulen -
 * und jede Beule gehoert sichtbar einem Turm.
 *
 * Vorher wurde radial ab dem Kern abgetastet: eine Reichweite je Winkel, dann ueber die
 * Winkel geglaettet. Das kann gar keine Beule zeigen, die schmaler ist als das Glaettungs-
 * fenster, und liefert grundsaetzlich nur sternfoermige Umrisse - jeder Turm verschwand darin
 * zu einer sanften Welle, und man sah dem Bereich nicht mehr an, aus wie vielen Tuermen er
 * besteht. Der Kern der Aenderung ist deshalb der Wechsel des Verfahrens: Der Umriss ist jetzt
 * die Nulllinie eines Feldes (`rangeBlobs`) und an keinen Mittelpunkt mehr gebunden.
 *
 * Gezeichnet als flach angehobene Flaeche mit einer breiten, stumpfen Kante - beides in
 * einem unbunten Blaugrau und ohne Leuchthof. Damit ist der Wirkungsbereich das **dunkelste**
 * Element des Bildes: Er liegt in jedem einzelnen Bild da und reicht ueber die ganze
 * Bildbreite, waehrend Gegner, Zahlen und Geschosse kommen und gehen. Was immer da ist, darf
 * nicht leuchten, sonst leuchtet nichts mehr.
 *
 * Die Flaeche wird **additiv** aufgetragen (`THEME.rangeLift`) statt als durchscheinender
 * Verlauf. Ein Verlauf zur Mitte hin laesst die Zone genau dort verschwinden, wo die Station
 * steht, und macht aus einer Grenze eine Beleuchtung; die gleichmaessige Anhebung dagegen
 * traegt die Aussage "hier wird geschossen" auch da noch, wo ein Pulk die Kante zudeckt.
 */
export function drawRangeRing(
  ctx: CanvasRenderingContext2D,
  origin: Vec2,
  circles: readonly RangeCircle[],
  camera: Camera,
  width: number,
  height: number,
): void {
  if (circles.length === 0) return

  // Die weiteste Ecke des Umrisses. Sie entscheidet, ob ueberhaupt gezeichnet wird, und gibt
  // der Kante ihre Strichbreite - die soll mit dem Bild mitwachsen.
  let outer = 0
  for (const circle of circles) {
    outer = Math.max(outer, dist(origin, circle.center) + circle.range)
  }

  const zoom = viewZoom(camera)
  if (outer * zoom < 8) return

  const loops = cachedBlobs(circles)
  if (loops.length === 0) return

  ctx.save()

  // Alle Schleifen in **einen** Pfad. Fuellen mit der Gerade-Ungerade-Regel: Damit wird ein
  // Loch im Bereich - etwa ein Ring aus Tuermen mit einer Luecke in der Mitte - zum Loch und
  // nicht zur Flaeche, ohne dass der Umlaufsinn der Schleifen stimmen muesste.
  ctx.beginPath()
  for (const loop of loops) traceBlob(ctx, loop, camera, width, height)

  /*
   * Die Flaeche: ein cyanfarbener Verlauf, der zur Mitte hin auf null laeuft.
   *
   * ENTSCHEIDUNG DES SPIELERS (2026-08-07), nicht der Messlatte.
   *
   * Zwischenzeitlich stand hier eine unbunte Zone nach dem Vorbild von "The Tower": breite
   * blaugraue Kante, gleichmaessige additive Anhebung, kein Hof. Sie war streng nach der dort
   * gemessenen Regel gebaut - unbunt gleich dauerhafte Geometrie, gesaettigt gleich Faehigkeit
   * mit Laufzeit - und sie war nachweislich besser lesbar. Sie hat sich trotzdem nicht richtig
   * angefuehlt: Der Ring ist in diesem Spiel nicht nur eine Grenze, er ist der leuchtende
   * Koerper, in dem die Station lebt, und grau genommen war er nur noch eine Markierung.
   *
   * Eine Regel, die aus einem fremden Bild abgelesen ist, schlaegt nicht das Gefuehl fuer das
   * eigene. Wer hier wieder auf unbunt umstellen will, braucht dafuer einen anderen Grund als
   * "die Latte macht es so".
   */
  ctx.globalCompositeOperation = 'source-over'
  const mitte = worldToScreen(camera, origin, width, height)
  const flaeche = ctx.createRadialGradient(mitte.x, mitte.y, 0, mitte.x, mitte.y, outer * zoom)
  flaeche.addColorStop(0, 'rgba(0,0,0,0)')
  flaeche.addColorStop(1, `rgba(${RGB.cyan}, ${RANGE_RING_FILL})`)
  ctx.fillStyle = flaeche
  ctx.fill('evenodd')

  // Die Kante: ein feiner leuchtender Strich in der Leitfarbe. `lineJoin` rund, damit die
  // Beulen des Umrisses keine Zipfel nach aussen werfen.
  ctx.globalAlpha = RANGE_RING_ALPHA
  ctx.strokeStyle = PALETTE.cyan
  ctx.shadowColor = PALETTE.cyan
  ctx.shadowBlur = RANGE_RING_BLUR
  ctx.lineWidth = RANGE_RING_WIDTH
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.restore()
}

/*
 * Zwischenspeicher des Umrisses.
 *
 * `rangeBlobs` rechnet **rein in Weltkoordinaten** - kein Zoom, keine Kamera, keine Zeit
 * gehen ein. Sein Ergebnis aendert sich also nur, wenn sich die Kreise aendern: wenn gebaut
 * wird, ein Reichweiten-Upgrade faellt oder ein Buff an- oder ausgeht. Zwischendurch bleibt
 * es minutenlang dasselbe - und es ist deutlich teurer als das fruehere Strahlenverfahren:
 * ein Gitter statt einer Linie. Ohne diesen Zwischenspeicher waere der Wechsel nicht
 * bezahlbar.
 *
 * Dass er traegt, haengt daran, dass Reichweiten **stufig** sind: Faehigkeiten und Ereignisse
 * legen ihren Bonus als feste Zahl ab, solange sie laufen (`sim/stats.ts`, `applyTimed`).
 * Ein Wert, der je Takt ein wenig anders waere, liesse den Schluessel in jedem Bild
 * verfehlen - dann muesste hier gerundet werden.
 *
 * Der Schluessel ist die Kreisliste selbst - Ort und Reichweite je Kreis, flach
 * hintereinander. Ihn Zahl fuer Zahl zu vergleichen kostet drei Vergleiche je Kreis; das ist
 * gegen die Neurechnung nichts. Eine Zeichenkette als Schluessel waere kuerzer zu schreiben
 * und wuerde je Bild eine neue anlegen - genau die Art Muell, die hier weg soll.
 */
let blobKey: number[] = []
let blobValue: BlobLoop[] = []

function cachedBlobs(circles: readonly RangeCircle[]): BlobLoop[] {
  let same = blobKey.length === circles.length * 3
  for (let i = 0; same && i < circles.length; i++) {
    const circle = circles[i] as RangeCircle
    same =
      blobKey[i * 3] === circle.center.x &&
      blobKey[i * 3 + 1] === circle.center.y &&
      blobKey[i * 3 + 2] === circle.range
  }
  if (same) return blobValue

  blobKey = []
  for (const circle of circles) {
    blobKey.push(circle.center.x, circle.center.y, circle.range)
  }
  blobValue = rangeBlobs(circles, RANGE_BLOB_MERGE, RANGE_BLOB_CELL)
  return blobValue
}

/**
 * Eine Schleife auf den Bildschirm rechnen und als weiche Kurve in den **laufenden** Pfad
 * legen - ohne `beginPath`, weil mehrere Schleifen zusammen einen Pfad ergeben muessen.
 *
 * Die Kurve laeuft nicht durch die Abtastpunkte, sondern durch die **Mitten** zwischen je
 * zwei benachbarten; der Punkt dazwischen wird zum Kontrollpunkt. Das ist der uebliche Griff
 * fuer eine glatte geschlossene Kurve und kostet nichts - ohne ihn zeigte der Umriss die
 * Treppenstufen seines Gitters.
 *
 * Gerechnet wird Punkt fuer Punkt und ohne Zwischenfeld: Eine Schleife hat einige hundert
 * Punkte, und ebenso viele frische Objekte je Bild sind Muell, den der Speicherbereiniger
 * spaeter in einem Stueck wegraeumt - dieses eine Stueck sieht man als Ruckler.
 */
function traceBlob(
  ctx: CanvasRenderingContext2D,
  loop: BlobLoop,
  camera: Camera,
  width: number,
  height: number,
): void {
  const count = loop.length / 2
  if (count < 3) return

  const zoom = viewZoom(camera)
  const offsetX = width / 2 - camera.center.x * zoom
  const offsetY = height / 2 - camera.center.y * zoom

  const screenX = (i: number): number => (loop[(i % count) * 2] as number) * zoom + offsetX
  const screenY = (i: number): number => (loop[(i % count) * 2 + 1] as number) * zoom + offsetY

  ctx.moveTo((screenX(count - 1) + screenX(0)) / 2, (screenY(count - 1) + screenY(0)) / 2)
  for (let i = 0; i < count; i++) {
    const cx = screenX(i)
    const cy = screenY(i)
    ctx.quadraticCurveTo(cx, cy, (cx + screenX(i + 1)) / 2, (cy + screenY(i + 1)) / 2)
  }
  ctx.closePath()
}

/** Ein geschlossener Umriss in Weltkoordinaten, flach: x0, y0, x1, y1, ... */
export type BlobLoop = number[]

/**
 * Der Wirkungsbereich als geschlossene Umrisse - die Kreise zu Tropfen zusammengefuehrt.
 *
 * Der Bereich ist die Nulllinie eines Feldes: Jeder Kreis stiftet seinen vorzeichenbehafteten
 * Abstand (`|p - Mitte| - Reichweite`, innen negativ), und die Kreise werden mit einem
 * **weichen Minimum** verbunden. Das weiche Minimum ist der ganze Unterschied zum blossen
 * Uebereinanderlegen: Sind zwei Raender weiter als `merge` voneinander entfernt, liefert es
 * genau das gewoehnliche Minimum und damit die exakte Vereinigung; kommen sie sich naeher,
 * zieht es die Flaeche zwischen ihnen zusammen - der Hals eines Tropfens. Mehr als
 * `merge / 4` traegt es nirgends auf, und das nur genau am Hals.
 *
 * Gezogen wird die Nulllinie mit Marching Squares: Das Feld wird auf einem Gitter abgetastet,
 * je Zelle entstehen aus dem Vorzeichenmuster der vier Ecken null bis zwei Streckenstuecke,
 * und diese Stuecke werden ueber ihre **Gitterkante** verkettet. Die Kante als Schluessel ist
 * der Grund, warum das ohne Toleranzen auskommt: Zwei Nachbarzellen rechnen denselben
 * Durchstoss aus denselben zwei Eckwerten, treffen sich also exakt und nicht nur beinahe.
 *
 * Ein Sattel - zwei gegenueberliegende Ecken innen, die beiden anderen aussen - laesst zwei
 * Verkettungen zu. Entschieden wird er ueber den Mittelwert der vier Ecken: Liegt die
 * Zellmitte innen, haengen die beiden inneren Ecken zusammen, sonst nicht.
 *
 * Das Ergebnis ist eine Liste: Tuerme, die niemanden beruehren, ergeben eigene Tropfen. In
 * der Praxis haengt alles am Kern, aber die Rechnung setzt das nicht voraus.
 *
 * Rein rechnerisch und ohne Kamera - deshalb liegt die Funktion offen und wird im Selbsttest
 * geprueft. Was gezeichnet wird, ist eine Aussage ueber das Spiel; sie darf nicht nur gut
 * aussehen, sie muss stimmen.
 */
export function rangeBlobs(
  circles: readonly RangeCircle[],
  merge: number,
  cell: number,
  maxSteps: number = RANGE_BLOB_MAX_STEPS,
): BlobLoop[] {
  if (circles.length === 0) return []

  /*
   * Der Kasten um alle Kreise, plus Rand. Der Rand ist Pflicht und nicht Vorsicht: Der
   * Zusammenschluss traegt bis zu `merge / 4` nach aussen auf, und der Umriss muss **ganz**
   * im Gitter liegen. Eine Nulllinie, die den Gitterrand erreicht, bliebe offen - und eine
   * offene Linie laesst sich nicht zu einer Schleife schliessen.
   */
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const circle of circles) {
    minX = Math.min(minX, circle.center.x - circle.range)
    minY = Math.min(minY, circle.center.y - circle.range)
    maxX = Math.max(maxX, circle.center.x + circle.range)
    maxY = Math.max(maxY, circle.center.y + circle.range)
  }

  const pad = merge + cell
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  const step = Math.max(cell, (maxX - minX) / maxSteps, (maxY - minY) / maxSteps)
  const nx = Math.max(1, Math.ceil((maxX - minX) / step))
  const ny = Math.max(1, Math.ceil((maxY - minY) / step))

  // Stuetzstellen: eine mehr als Zellen, in beiden Richtungen.
  const field = new Float64Array((nx + 1) * (ny + 1))
  for (let j = 0; j <= ny; j++) {
    const y = minY + j * step
    for (let i = 0; i <= nx; i++) {
      field[j * (nx + 1) + i] = blobField(circles, minX + i * step, y, merge)
    }
  }

  /*
   * Kennungen der Gitterkanten. Waagerechte zuerst, senkrechte dahinter - so ist jede Kante
   * eine Zahl, und zwei Nachbarzellen benennen dieselbe Kante gleich.
   */
  const horizontal = nx * (ny + 1)
  const points = new Map<number, Vec2>()
  const links = new Map<number, number[]>()

  const crossH = (i: number, j: number): number => {
    const id = j * nx + i
    if (!points.has(id)) {
      const a = field[j * (nx + 1) + i] as number
      const b = field[j * (nx + 1) + i + 1] as number
      points.set(id, { x: minX + (i + a / (a - b)) * step, y: minY + j * step })
    }
    return id
  }

  const crossV = (i: number, j: number): number => {
    const id = horizontal + j * (nx + 1) + i
    if (!points.has(id)) {
      const a = field[j * (nx + 1) + i] as number
      const b = field[(j + 1) * (nx + 1) + i] as number
      points.set(id, { x: minX + i * step, y: minY + (j + a / (a - b)) * step })
    }
    return id
  }

  const link = (a: number, b: number): void => {
    const one = links.get(a)
    if (one) one.push(b)
    else links.set(a, [b])
    const other = links.get(b)
    if (other) other.push(a)
    else links.set(b, [a])
  }

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const topLeft = field[j * (nx + 1) + i] as number
      const topRight = field[j * (nx + 1) + i + 1] as number
      const bottomRight = field[(j + 1) * (nx + 1) + i + 1] as number
      const bottomLeft = field[(j + 1) * (nx + 1) + i] as number

      let code = 0
      if (topLeft < 0) code |= 1
      if (topRight < 0) code |= 2
      if (bottomRight < 0) code |= 4
      if (bottomLeft < 0) code |= 8
      if (code === 0 || code === 15) continue

      // Ein Muster und sein Gegenstueck ergeben dieselbe Trennlinie - innen und aussen sind
      // vertauscht, die Kante bleibt. Deshalb steht jeder Fall nur einmal da.
      switch (code) {
        case 1:
        case 14:
          link(crossV(i, j), crossH(i, j))
          break
        case 2:
        case 13:
          link(crossH(i, j), crossV(i + 1, j))
          break
        case 3:
        case 12:
          link(crossV(i, j), crossV(i + 1, j))
          break
        case 4:
        case 11:
          link(crossV(i + 1, j), crossH(i, j + 1))
          break
        case 6:
        case 9:
          link(crossH(i, j), crossH(i, j + 1))
          break
        case 7:
        case 8:
          link(crossV(i, j), crossH(i, j + 1))
          break
        default: {
          // Sattel (5 und 10): Die Zellmitte entscheidet, ob die beiden gleichseitigen Ecken
          // zusammenhaengen oder jede fuer sich abgeschnitten wird.
          const middle = (topLeft + topRight + bottomRight + bottomLeft) / 4
          const joined = middle < 0
          const mainDiagonal = code === 5
          if (joined === mainDiagonal) {
            link(crossH(i, j), crossV(i + 1, j))
            link(crossV(i, j), crossH(i, j + 1))
          } else {
            link(crossV(i, j), crossH(i, j))
            link(crossV(i + 1, j), crossH(i, j + 1))
          }
        }
      }
    }
  }

  /*
   * Aus den Verkettungen Schleifen laufen. Jede Kante hat genau zwei Nachbarn - eine je
   * angrenzender Zelle -, also fuehrt jeder Weg zurueck zu seinem Anfang.
   *
   * Gelaufen wird **ungerichtet**: Der Umlaufsinn spielt keine Rolle, weil gefuellt wird,
   * ohne ihn zu befragen (Gerade-Ungerade). Das erspart es, im Marching-Squares-Fall auch
   * noch die Richtung mitzufuehren, und die haette an einem Sattel ohnehin gekippt.
   */
  const loops: BlobLoop[] = []
  const done = new Set<number>()

  for (const start of links.keys()) {
    if (done.has(start)) continue

    const loop: BlobLoop = []
    let current: number | undefined = start
    let previous = -1

    while (current !== undefined && !done.has(current)) {
      done.add(current)
      const point = points.get(current) as Vec2
      loop.push(point.x, point.y)

      let next: number | undefined
      for (const candidate of links.get(current) as number[]) {
        if (candidate !== previous && !done.has(candidate)) {
          next = candidate
          break
        }
      }
      previous = current
      current = next
    }

    // Unter drei Punkten ist es keine Flaeche, sondern ein Rest aus einer Zelle.
    if (loop.length >= 6) loops.push(loop)
  }

  return loops
}

/**
 * Das Feld an einer Stelle: der weich verbundene Abstand zu allen Kreisen, innen negativ.
 *
 * Der Deckel am Ende ist der Grund, warum die Zusage aus `RANGE_BLOB_MERGE` unabhaengig von
 * der Turmzahl gilt. Das weiche Minimum wird **paarweise gefaltet**, und jede Faltung darf
 * bis zu `merge / 4` abziehen - wo sich drei oder vier Reichweiten stapeln, summierte sich
 * das auf. Nachgemessen an einer Station aus fuenf Modulen waren es 15 statt 11 Einheiten,
 * und mit fuenfzehn Modulen waere daraus ein Vielfaches geworden.
 *
 * Gegen den harten Abstand gedeckelt bleibt es bei einem Viertel, egal wie viele Kreise sich
 * treffen: Der Umriss liegt damit nachweisbar zwischen der echten Vereinigung und ihr plus
 * `merge / 4` - genau das prueft der Selbsttest.
 */
function blobField(
  circles: readonly RangeCircle[],
  x: number,
  y: number,
  merge: number,
): number {
  let hard = Infinity
  let soft = Infinity

  for (let i = 0; i < circles.length; i++) {
    const circle = circles[i] as RangeCircle
    const dx = x - circle.center.x
    const dy = y - circle.center.y
    const distance = Math.sqrt(dx * dx + dy * dy) - circle.range
    if (distance < hard) hard = distance
    soft = i === 0 ? distance : softMin(soft, distance, merge)
  }

  return Math.max(soft, hard - merge / 4)
}

/**
 * Weiches Minimum zweier Abstaende.
 *
 * Ausserhalb der Naht - wenn die beiden Werte weiter als `k` auseinanderliegen - ist es
 * **exakt** das gewoehnliche Minimum: Ein Turm, der ganz im Bereich eines anderen liegt,
 * veraendert den Umriss dann um nichts. Erst innerhalb von `k` mischt es die beiden und zieht
 * dabei um bis zu `k / 4` nach innen, was am Rand als Auswoelbung nach aussen ankommt.
 */
function softMin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k))
  return b + (a - b) * h - k * h * (1 - h)
}

/**
 * Eingesammelte Muenzen auf dem Weg zum Zeiger.
 *
 * Sie bleiben **dieselbe Muenze**: dasselbe Bild, dasselbe Metall, dieselbe Groesse wie
 * eben noch im Feld (`coinLook`). Vorher flog hier ein kleiner goldener Punkt los, der
 * sofort zu schrumpfen begann - das sah aus, als loese sich das Gold auf, und nicht, als
 * hebe man es auf.
 *
 * Wohin sie fliegt, entscheidet die Simulation (`sim/combat.ts`): Sie faehrt dem Zeiger
 * nach und bleibt dabei erst zurueck. Diese Ebene zeichnet nur noch die **Landung** - auf
 * den letzten Pixeln vor dem Zeiger schrumpft die Muenze und verblasst. Das Schrumpfen
 * haengt am Abstand und nicht am Alter: Eine Muenze, die frueh ankommt, soll auch frueh
 * verschwinden, und eine, die lange hinterherfliegt, soll dabei nicht unterwegs zerfallen.
 */
export function drawPickups(
  ctx: CanvasRenderingContext2D,
  pickups: readonly Pickup[],
  camera: Camera,
  width: number,
  height: number,
  time: number,
): void {
  const zoom = Math.max(0.6, viewZoom(camera))

  ctx.save()
  for (const pickup of pickups) {
    if (!pickup.active) continue

    const center = worldToScreen(camera, pickup.pos, width, height)
    const { radius, tier } = coinLook(pickup.value, pickup.mean, zoom)

    // Wie weit die Muenze noch vom Zeiger weg ist, gemessen in ihren eigenen Radien: Eine
    // dicke Muenze darf spaeter schrumpfen als ein Krumen, sonst zerfaellt der Krumen
    // gefuehlt schon auf halber Strecke.
    const gap = dist(pickup.pos, pickup.to) * zoom
    const landing = Math.min(1, gap / (radius * PICKUP_LANDING))

    // Ein kurzer Stupser beim Aufheben. Er sagt nichts ueber den Wert - er trifft jede
    // Muenze gleich und ist nach einem Wimpernschlag vorbei -, also stoert er die Regel
    // nicht, dass die Groesse einer Muenze ihr Vielfaches des Durchschnitts nennt.
    const pop = 1 + PICKUP_POP * Math.max(0, 1 - pickup.age / (pickup.life * PICKUP_POP_SHARE))
    const size = radius * 2 * pop * (PICKUP_MIN_SCALE + (1 - PICKUP_MIN_SCALE) * landing)
    if (size < 1) continue

    ctx.globalAlpha = landing
    if (SPRITES.coins.ready()) {
      // Derselbe Glanzlauf wie im Liegen, gerechnet aus dem **Fundort**: Das Bild springt
      // beim Aufheben nicht um, sondern laeuft weiter.
      drawFrame(
        ctx,
        SPRITES.coins,
        glintFrame(time, pickup.from.x, pickup.from.y),
        tier,
        center.x,
        center.y,
        size,
      )
    } else {
      ctx.fillStyle = PALETTE.gold
      ctx.shadowColor = PALETTE.gold
      ctx.shadowBlur = 9 * landing
      ctx.beginPath()
      ctx.arc(center.x, center.y, size / 2, 0, Math.PI * 2)
      /* [REKONSTRUIERT] Ab hier war die Leseausgabe abgeschnitten (Zeile 1207 ff.).
         Nachgebaut nach dem gleichlaufenden Ersatzzweig fuer liegende Muenzen weiter
         oben: beginPath, arc, fillStyle, fill. Ein Zuruecksetzen von `shadowBlur`
         braucht es nicht - `SPRITES.coins.ready()` faellt fuer alle Muenzen eines
         Bildes gleich aus, der Ersatzzweig kann also nicht in den Sprite-Zweig
         durchschlagen, und `ctx.restore()` raeumt am Ende ohnehin auf. */
      ctx.fill()
    }
  }
  ctx.restore()
}

/* ============================================================================
 * [REKONSTRUIERT] Aus einer aelteren Fassung uebernommen.
 *
 * Die letzte vollstaendige Leseausgabe dieser Datei endete bei Zeile 1207 - dort
 * greift die Laengengrenze fuer Werkzeugausgaben. Was danach stand, ist in keiner
 * Sitzung erfasst. Die folgenden Funktionen stammen deshalb aus dem Stand vom
 * 03.08.2026; `render/scene.ts` fuehrt sie unveraendert im Import, sie gehoeren
 * also weiterhin hierher. Spaetere Aenderungen an ihnen koennen fehlen.
 * ==========================================================================*/
/**
 * Der Zerfall eines Gegners - der hellste Augenblick im Feld nach Turm und Muenze.
 *
 * Drei Ebenen: die Druckwelle als Ring in **seiner** Farbe, der Kranz aus zerplatzten
 * Stuecken darauf, und das Explosionsbild aus dem Anlagensatz darueber. Die Farbe sagt, wen
 * es getroffen hat - ein zerplatzter Schwarm sieht damit weiter anders aus als ein
 * gefallener Boss, obwohl beide dasselbe Bild benutzen (GDD 07 Abschnitt 3).
 *
 * Der Ring wird **nicht** gedaempft, wenn das Bild vorliegt. Genau das war der Fehler: Das
 * Sprite laeuft im ersten Drittel hell auf und ist danach fast weg, der heruntergedimmte
 * Ring trug den Rest der Lebensdauer allein - und trug ihn mit anderthalb Bildpunkten
 * Strichbreite. Beides zusammen ergab ein Todesereignis, das schwaecher war als eine
 * liegende Muenze. Bild und Ring erzaehlen dasselbe und duerfen sich addieren.
 *
 * Liegt das Bild noch nicht vor, bleiben Ring und Kranz allein stehen - so fehlt nie der
 * ganze Effekt, nur seine Fuellung.
 */
export function drawBursts(
  ctx: CanvasRenderingContext2D,
  bursts: readonly Burst[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const hasSprite = SPRITES.death.ready()

  ctx.save()
  for (const burst of bursts) {
    if (!burst.active) continue

    const progress = Math.min(1, burst.age / burst.life)
    const center = worldToScreen(camera, burst.pos, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))
    // Schnell auf, langsam aus: Die Welle soll schlagen, nicht wachsen.
    const radius = burst.radius * (1 + DEATH_RING_GROWTH * Math.sqrt(progress)) * zoom
    const fade = 1 - progress

    /*
     * Der Hof von Ring und Kranz.
     *
     * Die Streuung ist das, was aus gezogenen Linien einen Austritt von Energie macht - ohne
     * sie ist der Zerfall ein mit dem Lineal gezogener Kreis zwischen lauter leuchtenden
     * Koerpern. Sie klingt mit dem Zerfall aus; ein Hof, der bleibt, waere ein Fleck.
     *
     * Das **Bild** bekommt sie nicht (siehe unten): Es bringt sein Leuchten mit, und eine
     * Streuung darauf kostet ein Vielfaches von allem anderen in dieser Datei.
     */
    ctx.shadowColor = burst.color
    ctx.shadowBlur = DEATH_BLUR * fade * zoom

    ctx.globalAlpha = fade * 0.85
    ctx.strokeStyle = burst.color
    ctx.lineWidth = Math.max(1.6, 3.2 * fade * zoom)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    /*
     * Der Kranz: die Stuecke, in die der Gegner zerfaellt.
     *
     * Alle Kreise liegen in **einem** Pfad und werden in einem Zug gezogen. Das ist kein
     * Geiz, sondern die einzige Fassung, die im Belastungsfall traegt: Ein eigener Strich je
     * Kreis waere bei sechzehn Druckwellen mal vierzehn Stuecken auch zweihundert
     * Streuungsdurchgaenge je Bild. Der Hof folgt trotzdem jedem einzelnen Kreis - die
     * Streuung kennt die Form des Pfades, nicht die Zahl der Aufrufe.
     *
     * Der Versatz kommt aus dem Ort des Todes: Derselbe Zerfall sieht immer gleich aus,
     * zwei nebeneinander aber nie gleich ausgerichtet. Zufall braucht es dafuer nicht, und
     * das Zeichnen zieht ohnehin keinen (`core/rng.ts` gehoert der Simulation).
     */
    const nodes = Math.min(
      DEATH_NODES_MAX,
      Math.max(DEATH_NODES_MIN, Math.round(DEATH_NODES_MIN + burst.radius / 8)),
    )
    const phase = burst.pos.x * 0.11 + burst.pos.y * 0.17
    const nodeRadius = DEATH_NODE_PX * (1 - 0.25 * progress) * zoom

    ctx.beginPath()
    for (let i = 0; i < nodes; i++) {
      const angle = phase + (i / nodes) * Math.PI * 2
      const x = center.x + Math.cos(angle) * radius
      const y = center.y + Math.sin(angle) * radius
      ctx.moveTo(x + nodeRadius, y)
      ctx.arc(x, y, nodeRadius, 0, Math.PI * 2)
    }
    // Erst der weiche Aussenstrich, dann der heisse Kern auf derselben Kontur - dieselbe
    // Roehre wie beim Gegner, nur zerrissen. Der Kern haelt laenger durch als der Ring:
    // Das Stueck glueht noch, wenn die Welle schon verlaufen ist.
    ctx.globalAlpha = fade
    ctx.lineWidth = Math.max(1.4, 1.8 * zoom)
    ctx.stroke()

    ctx.strokeStyle = THEME.enemyCoreHot
    ctx.shadowColor = THEME.enemyCoreHot
    ctx.globalAlpha = Math.pow(fade, 0.4)
    ctx.lineWidth = Math.max(1.5, 1.4 * zoom)
    ctx.stroke()

    ctx.strokeStyle = burst.color
    ctx.shadowColor = burst.color

    if (hasSprite) {
      /*
       * Das Bild laeuft ueber seine Lebensdauer genau einmal durch - es ist der Zerfall
       * selbst, nicht eine Schleife, die zufaellig endet.
       *
       * Und es laeuft **ohne** Streuung. Nicht aus Geschmack: Der Blast am Wellenende setzt
       * Druckwellen mit Radius 660, das Bild misst davon das Neunfache, und eine Streuung
       * auf einer Flaeche dieser Groesse laesst das Bild von 1,2 auf 48 Millisekunden
       * fallen - nachgemessen im Belastungsfall mit sechzehn gleichzeitigen Druckwellen.
       * Der Effekt, der den Abschuss feiern soll, wuerde das Spiel genau in dem Augenblick
       * anhalten, in dem am meisten stirbt. Verloren geht dabei nichts: Das Leuchten steckt
       * im Bild selbst, und der Hof des Ereignisses steht schon unter ihm.
       */
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      drawFrame(
        ctx,
        SPRITES.death,
        progress * SPRITES.death.frames,
        0,
        center.x,
        center.y,
        burst.radius * DEATH_SPRITE_SCALE * zoom,
      )
    }
  }
  ctx.restore()
}

/**
 * Der eingesammelte Betrag steigt auf und verblasst.
 *
 * Er steht dort, wo eingesammelt wurde, und wandert nach oben aus dem Geschehen heraus -
 * so verdeckt er nichts, was gerade wichtig ist. Die Bewegung ist am Anfang schnell und
 * wird langsamer: Die Zahl springt ins Auge und legt sich dann hin.
 */
export function drawGains(
  ctx: CanvasRenderingContext2D,
  gains: readonly Gain[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const zoom = Math.max(0.6, camera.zoom)

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(18 * zoom)}px ${THEME.numberFont}`

  for (const gain of gains) {
    if (!gain.active) continue

    const progress = Math.min(1, gain.age / gain.life)
    const rise = GAIN_RISE * (1 - (1 - progress) * (1 - progress))
    const point = worldToScreen(camera, { x: gain.pos.x, y: gain.pos.y - rise }, width, height)

    ctx.globalAlpha = 1 - progress * progress
    ctx.fillStyle = PALETTE.gold
    ctx.shadowColor = PALETTE.gold
    ctx.shadowBlur = 8 * (1 - progress)
    writePixelText(ctx, t('hud.gain', { amount: formatNumber(Math.floor(gain.value)) }), point.x, point.y)
  }

  ctx.restore()
}

/**
 * Schadenszahlen ueber dem Feld (GDD 13 Abschnitt 10).
 *
 * Sie sind die Rueckmeldung, ohne die ein Turm-Upgrade eine Behauptung im Menue bleibt: Man
 * sieht am Einschlag, **wie viel** er gebracht hat, und nicht nur, dass ein Balken kuerzer
 * wird. Bis zu vierundsechzig stehen gleichzeitig - das ist viel Text ueber einem Bild, das
 * lesbar bleiben soll. Drei Griffe halten ihn im Zaum, und jeder loest ein anderes Problem:
 *
 *   *Kuerze*      Jede Zahl laeuft ueber `formatNumber` und ist damit hoechstens sieben
 *                 Zeichen lang - "111.5K" statt "111543". Ohne die Abkuerzung waere eine
 *                 Zahl in der spaeten Wellenhoehe breiter als die Station.
 *
 *   *Kontur*      Eine harte schwarze Linie unter jeder Glyphe. Sie ist der Grund, warum die
 *                 Zahl ueber einem Gegner, einem Muenzstapel und dem hellen Kern gleich gut
 *                 lesbar ist. Ein Kasten darunter taete dasselbe und deckte das Feld zu.
 *
 *   *Rangfolge*   Nur **zwei** Zahlen tragen diese Kontur und volle Deckkraft. Alle uebrigen
 *                 stehen unbunt und blass dahinter. Damit hat das Bild einen Vordergrund -
 *                 das, was gerade eben passiert ist - und einen Hintergrund, der sagt, dass
 *                 es weitergeht. Ohne diese zwei Stufen waeren zwanzig gleich helle Zahlen
 *                 ein Teppich, in dem keine mehr etwas bedeutet.
 *
 * Ueber die zwei Plaetze entscheidet nicht `seq` allein, sondern das Paar (`crit`, `seq`).
 * Nach dem Alter allein fiel ausgerechnet der kritische Treffer zurueck, sobald danach ein
 * paar gewoehnliche Ticks einschlugen - und der Krit ist die einzige Zahl, die eine
 * Entscheidung des Spielers belohnt. Nachgemessen im Standbild von Welle 12: Die Zahl des
 * Krits stand blass bei RGB(112,122,137) ueber Untergrund RGB(19,40,74), Kontrast 3,38:1 und
 * ohne Kontur, waehrend zwei Ticks von je 3 Schaden in Weiss mit schwarzer Kontur davor
 * lagen. Ein Ausreisser, den man suchen muss, ist keiner.
 *
 * Deshalb: Solange ein kritischer Treffer lebt, haelt er einen der beiden Plaetze - bei
 * mehreren der juengste von ihnen. Der zweite Platz geht an die juengste Zahl ueberhaupt.
 * Ohne Krit im Bild sind es wie bisher die zwei juengsten. Es bleiben in jedem Fall genau
 * zwei.
 *
 * Das Alter kommt aus `seq` und nicht aus `age`: Zwei Zahlen desselben Ticks haben dasselbe
 * Alter, aber nie dieselbe laufende Nummer.
 *
 * Gezeichnet wird in zwei Durchgaengen, damit die frischen oben liegen, ohne dass dafuer
 * sortiert werden muesste - Sortieren hiesse, je Bild eine Liste anzulegen.
 */
export function drawDamageNumbers(
  ctx: CanvasRenderingContext2D,
  numbers: readonly DamageNumber[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const zoom = Math.max(0.6, camera.zoom)

  // Ein Durchgang, drei Zahlen: die beiden juengsten und der juengste lebende Krit. Mehr
  // braucht die Rangfolge nicht, und mehr als drei Vergleiche je Zahl kostet sie nicht.
  let firstSeq = -1
  let secondSeq = -1
  let critSeq = -1
  for (const number of numbers) {
    if (!number.active) continue
    if (number.crit && number.seq > critSeq) critSeq = number.seq
    if (number.seq > firstSeq) {
      secondSeq = firstSeq
      firstSeq = number.seq
    } else if (number.seq > secondSeq) {
      secondSeq = number.seq
    }
  }
  if (firstSeq < 0) return

  // Die zwei Plaetze. Steht der Krit ohnehin schon vorn, bleibt alles wie gehabt; sonst
  // verdraengt er die aeltere der beiden - die juengste Zahl behaelt ihren Platz.
  let frontSeq = firstSeq
  let backSeq = secondSeq
  if (critSeq >= 0 && critSeq !== firstSeq && critSeq !== secondSeq) {
    frontSeq = critSeq
    backSeq = firstSeq
  }

  const size = Math.max(DAMAGE_SIZE_MIN, Math.round(DAMAGE_SIZE * zoom))
  const sizeCrit = Math.round((size * DAMAGE_SIZE_CRIT) / DAMAGE_SIZE)
  const fontPlain = `${size}px ${THEME.numberFont}`
  const fontCrit = `${sizeCrit}px ${THEME.numberFont}`
  // Die Kontur waechst mit der Schrift, nicht mit dem Zoom: Sie muss zur Strichbreite der
  // Glyphe passen, und die haengt an der gesetzten Schriftgroesse.
  const outlinePlain = DAMAGE_OUTLINE * size
  const outlineCrit = DAMAGE_OUTLINE * sizeCrit

  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  // Kein Schein: Ein weicher Rand um die Glyphe hellte genau die Zwischenraeume auf, die
  // die Kontur schwarz halten soll - der Schein hebt die Kontur auf.
  ctx.shadowBlur = 0
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = THEME.damageOutline

  let font = ''
  for (let pass = 0; pass < 2; pass++) {
    const drawFresh = pass === 1
    for (const number of numbers) {
      if (!number.active) continue
      const fresh = number.seq === frontSeq || number.seq === backSeq
      if (fresh !== drawFresh) continue

      const progress = Math.min(1, number.age / number.life)
      // Schnell hoch, dann langsamer: Die Zahl springt ins Auge und legt sich hin -
      // dieselbe Bewegung wie beim Gewinn, damit beide zusammengehoeren.
      const eased = 1 - (1 - progress) * (1 - progress)
      const point = worldToScreen(
        camera,
        {
          x: number.pos.x + number.drift * DAMAGE_DRIFT * eased,
          y: number.pos.y - DAMAGE_RISE * eased + ((number.seq % 3) - 1) * DAMAGE_STAGGER,
        },
        width,
        height,
      )

      const next = number.crit ? fontCrit : fontPlain
      if (next !== font) {
        ctx.font = next
        font = next
      }

      const faded = DAMAGE_FADED_ALPHA * Math.min(1, (1 - progress) / (1 - DAMAGE_HOLD))
      ctx.globalAlpha = fresh ? 1 : faded
      ctx.fillStyle = fresh ? THEME.damageFresh : THEME.damageFaded
      writePixelText(
        ctx,
        t('hud.damage', { amount: formatNumber(Math.round(number.value)) }),
        point.x,
        point.y,
        fresh ? (number.crit ? outlineCrit : outlinePlain) : 0,
      )
    }
  }

  ctx.restore()
}

/**
 * Kurzes Aufblitzen dort, wo Schaden ankam.
 *
 * Drei Faelle, drei Bilder - der Spieler soll am Einschlag sehen, was passiert ist, ohne
 * auf eine Leiste zu schauen:
 *
 *   Treffer am Gegner   blauer Einschlag  - eigener Schaden
 *   kritischer Treffer  goldener Funken   - der Ausreisser nach oben
 *   Treffer an der Station  magenta Ring  - Schaden am eigenen Haus
 *
 * Die Station behaelt bewusst die gezeichnete Fassung: Magenta ist die Farbe der Bedrohung,
 * und beide Bilder aus dem Anlagensatz sind blau und gold - sie wuerden einen Treffer auf
 * die eigene Station wie einen Erfolg aussehen lassen.
 */
export function drawHits(
  ctx: CanvasRenderingContext2D,
  hits: readonly Hit[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  for (const hit of hits) {
    const progress = Math.min(1, hit.age / hit.life)
    const center = worldToScreen(camera, hit.pos, width, height)
    const zoom = Math.max(0.6, viewZoom(camera))
    const color = hit.kind === 'station' ? THEME.hitStation : THEME.hitEnemy

    /*
     * Der Einschlag leuchtet, statt gezeichnet zu sein.
     *
     * Ohne Streuung ist ein Treffer ein matter Strich mit harter Kante - ein Ring, der
     * aussieht, als waere er mit dem Lineal gezogen worden, und in einem Bild aus
     * brennenden Neonroehren wie ein Fremdkoerper wirkt. Der Hof ist genau das, was aus
     * dem Strich einen **Aufschlag** macht: Energie, die an einer Stelle austritt.
     *
     * Er klingt mit dem Blitz aus. Ein Hof, der bleibt, waere ein Fleck.
     */
    ctx.shadowColor = color
    ctx.shadowBlur = HIT_BLUR * (1 - progress * 0.7)

    const strip = hit.crit ? SPRITES.spark : SPRITES.impact
    if (hit.kind === 'enemy' && strip.ready()) {
      ctx.globalAlpha = 1
      drawFrame(
        ctx,
        strip,
        progress * strip.frames,
        0,
        center.x,
        center.y,
        (hit.crit ? CRIT_SPRITE_PX : HIT_SPRITE_PX) * zoom,
      )
      continue
    }

    const scale = hit.crit ? 1.7 : 1
    const radius = (4 + progress * 12) * scale * zoom

    ctx.globalAlpha = 1 - progress
    ctx.strokeStyle = color
    ctx.lineWidth = hit.crit ? 3 : 2
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Der Kern verlischt schneller als der Ring - der Einschlag hat dadurch einen Anfang.
    if (progress < 0.45) {
      ctx.globalAlpha = (1 - progress / 0.45) * 0.9
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(center.x, center.y, (hit.crit ? 3.4 : 2.2) * zoom, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Muendungsfeuer: ein kurzer Strich, der aus der Modulkante in Schussrichtung schlaegt.
 *
 * Er beginnt bewusst **ausserhalb** der Flaeche - laege der Anfang in der Mitte, malte der
 * Blitz das Modul zu, und genau das Modul ist der Teil, den man sehen soll.
 */
export function drawMuzzles(
  ctx: CanvasRenderingContext2D,
  muzzles: readonly Muzzle[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'

  for (const muzzle of muzzles) {
    if (!muzzle.active) continue

    const fade = Math.max(0, 1 - muzzle.age / muzzle.life)
    const dx = Math.cos(muzzle.angle)
    const dy = Math.sin(muzzle.angle)
    const start = worldToScreen(
      camera,
      { x: muzzle.pos.x + dx * MUZZLE_OFFSET, y: muzzle.pos.y + dy * MUZZLE_OFFSET },
      width,
      height,
    )
    const length = MUZZLE_LENGTH * Math.max(0.6, camera.zoom) * fade

    ctx.globalAlpha = fade
    ctx.strokeStyle = muzzle.color
    ctx.shadowColor = muzzle.color
    ctx.shadowBlur = 10 * fade
    ctx.lineWidth = Math.max(1.4, 3.2 * Math.max(0.6, camera.zoom) * fade)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(start.x + dx * length, start.y + dy * length)
    ctx.stroke()
  }

  ctx.restore()
}

export function drawShards(
  ctx: CanvasRenderingContext2D,
  shards: readonly Shard[],
  camera: Camera,
  width: number,
  height: number,
): void {
  ctx.save()
  for (const shard of shards) {
    if (!shard.active) continue

    const progress = Math.min(1, shard.age / shard.life)
    const center = worldToScreen(camera, shard.pos, width, height)
    const zoom = Math.max(0.6, camera.zoom)
    const radius = shard.radius * (1 - 0.45 * progress) * zoom
    if (radius < 0.4) continue

    // Goldfunken holen ihre Farbe aus der Palette - die Simulation kennt keine Farben,
    // die nicht von einem Gegner oder einem Turm kommen.
    const color = shard.kind === 'muenze' ? PALETTE.gold : shard.color

    ctx.globalAlpha = 1 - progress * progress
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, 1.4 * zoom)
    ctx.shadowColor = color
    ctx.shadowBlur = 6 * (1 - progress)
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}
