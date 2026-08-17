/**
 * Farben, Linienstaerken und Leuchtstaerken an einem Ort (GDD 13 Abschnitt 2 und 7).
 *
 * Der praegende Look entsteht aus den **hellen Fugen** zwischen den Modulen - also aus den
 * geteilten Kanten, nicht aus den Fuellflaechen. Aussenkanten bleiben dunkel. So liest sich
 * eine gewachsene Station als eine zusammenhaengende Maschine statt als Haufen Vielecke
 * (Befund aus Prototyp 01).
 */

import type { LeagueTint } from '../data/leagues.ts'
import type { Category, Rarity } from '../data/types.ts'

/*
 * Die Grundfarben stammen aus dem Referenzbild des Auftraggebers: fast schwarzes Marineblau,
 * deckende dunkelblaue Panels mit hellem Rahmen, darauf wenige kraeftige Neonfarben. Jede
 * Farbe hat genau eine Rolle - wer eine neue braucht, prueft erst, ob eine der bisherigen
 * passt. `LIFE` ist die einzige, die diese Pruefung bestanden hat; warum, steht dort.
 *
 * `src/style.css` fuehrt dieselben Werte als CSS-Variablen. Aendert sich hier etwas, gehoert
 * es dort ebenfalls geaendert; Canvas und DOM liegen direkt uebereinander und duerfen nicht
 * auseinanderlaufen.
 */
const INK = '#070a18'
const INK_DEEP = '#03050d'
const PANEL = '#10204e'
const PANEL_DEEP = '#0a1436'
const EDGE = '#7fd8ff'
const CYAN = '#46c8ff'
const TEAL = '#2ee0c0'
const LIME = '#7fe83f'
const MAGENTA = '#ff2d78'
const GOLD = '#ffcc33'
const VIOLET = '#b45cff'
const SECTION = '#29a3f5'
/**
 * Leben eines Gegners - und sonst nichts.
 *
 * Die siebte Farbe, und die einzige, die nicht aus dem Referenzbild stammt. Bevor sie
 * dazukam, wurde die Frage aus dem Kopf dieser Datei gestellt: Passt eine der sechs? Nein,
 * und der Grund ist genau der Fehler, den sie behebt. `MAGENTA` trug bisher zwei Rollen
 * zugleich - "Gegner" und "Leben". Solange beide dieselbe Farbe haben, liegt der
 * Lebensbalken eines `drone` (`#ff2d78`, byteidentisch) unsichtbar auf seinem Traeger, und
 * ueber dem Pulk aus 188 `swarm` (`#ff7aa8`, nur 91 von 441 RGB-Einheiten entfernt) liest
 * man keine Reihe von Balken, sondern mehr Gegnerfarbe.
 *
 * Ein Balken ist aber keine Zeichnung AM Gegner, sondern eine Auskunft UEBER ihn. Auskunft
 * braucht einen Ton, den kein Gegner tragen kann - sonst muss man vor dem Ablesen erst
 * herausfinden, wo der Gegner aufhoert und die Auskunft anfaengt.
 *
 * Warum ausgerechnet reines Rot: Es ist nachgerechnet der Ton mit dem groessten Abstand zur
 * naechsten Gegnerfarbe, den ein gesaettigtes Warmrot ueberhaupt erreichen kann - 112 von
 * 441 Einheiten, naechster Nachbar `heavy` (`#c8215c`, 112) und `berserker` (`#a01340`,
 * 116). Jede Abtoenung ins Dunklere oder Rosige verliert dabei: `#e0402a` faellt auf 64,
 * `#c8352b` auf 53. Mehr als 112 gaebe es im ganzen RGB-Wuerfel nur im tiefen Blau (Maximum
 * 202) - dort steht aber `CYAN` fuer Angriff und `EDGE` fuer Kaelte, und ein blauer
 * Lebensbalken tauschte eine Kollision gegen die naechste.
 *
 * Gehalten wird der Abstand von der Pruefung "kein Gegner traegt die Farbe des
 * Lebensbalkens" in `selftest/suites/content.ts` - sie faengt den naechsten Gegner ab, der
 * sich in diese Ecke des Wuerfels legen will.
 */
const LIFE = '#ff0000'

/** Dieselben Farben als Zahlentripel - fuer Glanz und Schleier mit eigener Deckkraft. */
const CYAN_RGB = '70, 200, 255'
const LIME_RGB = '127, 232, 63'
const MAGENTA_RGB = '255, 45, 120'
const EDGE_RGB = '127, 216, 255'
const GOLD_RGB = '255, 204, 51'
const VIOLET_RGB = '180, 92, 255'

/**
 * Die Palette als Zahlentripel, damit ein Aufrufer eine eigene Deckkraft anhaengen kann.
 * Dieselben Farben wie in `PALETTE` - wer hier etwas aendert, aendert es dort mit.
 */
export const RGB = {
  cyan: CYAN_RGB,
  lime: LIME_RGB,
  magenta: MAGENTA_RGB,
  edge: EDGE_RGB,
  gold: GOLD_RGB,
  violet: VIOLET_RGB,
} as const

export const PALETTE = {
  /** Hintergrund der gesamten Ansicht. */
  ink: INK,
  inkDeep: INK_DEEP,
  /** Deckende Panelflaeche - im Referenzbild bewusst nicht durchscheinend. */
  panel: PANEL,
  panelDeep: PANEL_DEEP,
  /** Heller Panelrahmen. */
  edge: EDGE,
  /** Angriff, Hauptturm, Kosten. */
  cyan: CYAN,
  /** Fortschrittsbalken. */
  teal: TEAL,
  /** Zustimmung, Geschwindigkeit, Goldtropfen. */
  lime: LIME,
  /** Gegner, Verteidigung, Ablehnung. Fuer das Leben eines Gegners steht `life`. */
  magenta: MAGENTA,
  /** Leben eines Gegners - der einzige Ton, den kein Gegner tragen darf. */
  life: LIFE,
  /** Muenzen, Utility, Legendary. */
  gold: GOLD,
  /** Verstaerkung und Bosse - im Referenzbild die Farbe der Geschossspur. */
  violet: VIOLET,
  /** Sektionsbalken ueber Listen - bislang nur im DOM verwendet. */
  section: SECTION,
} as const

/**
 * Der Farbton einer Liga (`data/leagues.ts`).
 *
 * Die Tabelle steht hier und nicht dort, weil `data/` keine Farbwerte kennt - eine Liga
 * traegt nur den **Namen** eines Tons. Ohne diese Trennung importierte die Simulation aus
 * der Darstellung.
 *
 * `life` fehlt und darf nie dazukommen: Ein Grund in der Farbe des Lebensbalkens naehme
 * genau den Abstand zurueck, den `LIFE` oben mit 112 von 441 Einheiten erkauft.
 */
export const LEAGUE_TINT: Record<LeagueTint, string> = {
  cyan: CYAN,
  teal: TEAL,
  lime: LIME,
  gold: GOLD,
  violet: VIOLET,
  magenta: MAGENTA,
}

export const THEME = {
  /** Hintergrund: dunkelblau, minimalistisch. Faellt nur auf, wenn man hinsieht. */
  bgTop: INK,
  bgBottom: INK_DEEP,
  grid: `rgba(${CYAN_RGB}, 0.045)`,
  gridSpacing: 64,

  /**
   * Der Schein, in dem die Station steht.
   *
   * Ohne ihn haengt sie in einem gleichmaessig schwarzen Feld und wirkt aufgeklebt. Der
   * Schein gibt ihr einen Ort: Zur Mitte hin wird der Grund merklich heller, und das Auge
   * liest die Station als Quelle dieses Lichts statt als Zeichnung darauf. Er ist bewusst
   * sehr schwach - man soll ihn nicht sehen, sondern die Mitte als Mitte empfinden.
   */
  glowCore: `rgba(${CYAN_RGB}, 0.1)`,
  /** Wie weit der Schein reicht, als Anteil der kuerzeren Bildkante. */
  glowRadius: 0.72,

  /**
   * Abdunklung zu den Ecken hin. Sie schliesst das Bild und schiebt alles Wichtige zur
   * Mitte - dieselbe Wirkung, die in der Vorlage die dunklen Raender haben.
   */
  vignette: 'rgba(3, 5, 13, 0.55)',

  /** Fuellflaeche des Hauptturms - dieselbe Flaeche wie die Panels im DOM. */
  fillCore: PANEL,

  /** Geteilte Kante zweier Module - hell und leicht leuchtend. */
  edgeShared: EDGE,
  edgeSharedGlow: `rgba(${EDGE_RGB}, 0.75)`,
  edgeSharedWidth: 2,
  edgeSharedBlur: 7,

  /** Freie Aussenkante - dunkel und duenn. */
  edgeFree: '#27407e',
  edgeFreeWidth: 1.2,

  /** Innenrahmen: leicht nach innen versetzt, damit die Fugen unberuehrt bleiben. */
  frameInset: 0.86,
  frameWidthCore: 2.2,
  frameWidthModule: 1.4,

  /** Emblemgroesse als Anteil des Umkreisradius. */
  emblemRadiusFactor: 0.32,

  /** Fliesstext auf dem Canvas - dieselbe Schrift wie im DOM. Derzeit ungenutzt. */
  labelFont: "'Segoe UI', system-ui, sans-serif",

  /**
   * Zahlen auf dem Feld. Dieselbe Pixelschrift wie `--font-pixel` im Stilblatt: Ein
   * Muenzstapel und die Goldanzeige zeigen dasselbe, also sollen sie auch gleich aussehen.
   *
   * Nachgemessen sind die Ziffern bei 16 px genauso hoch wie die bisherige Schrift bei
   * 9 px - die Groesse im Aufruf traegt deshalb diesen Faktor.
   */
  numberFont: "'monogram', ui-monospace, 'Cascadia Mono', 'Consolas', monospace",

  hoverOutline: 'rgba(255, 255, 255, 0.35)',
  selectOutline: '#ffffff',

  /** Bauhilfen (GDD 13 Abschnitt 12). */
  buildEdge: CYAN,
  /** Nicht eingerastete Kanten pulsieren - die Deckkraft setzt die Animation ein. */
  buildEdgeRgb: CYAN_RGB,
  ghostOk: LIME,
  ghostBlocked: MAGENTA,
  ghostFillOk: `rgba(${LIME_RGB}, 0.16)`,
  ghostFillBlocked: `rgba(${MAGENTA_RGB}, 0.16)`,

  /** Abriss-Vorschau - gold, weil nichts verloren geht, aber etwas mitgeht. */
  detachWarn: GOLD,

  /*
   * Schadenszahlen ueber dem Feld - die einzige Stelle, an der unbunte Toene stehen.
   *
   * Das ist kein Verstoss gegen die Neonpalette, sondern ihre Voraussetzung: Zwanzig Zahlen
   * in einer der sechs Leitfarben laegen im selben Bild wie die Gegner, die Muenzen und die
   * Reichweitenkante und wuerden mit ihnen verwechselt. Weiss und Grau tragen keine
   * Bedeutung, also nehmen sie keiner Farbe ihre.
   *
   * Die Kontur ist **reines Schwarz**, nicht das dunkle Blau des Grundes: Sie muss auch ueber
   * einem hellen Gegner, einem Muenzstapel oder dem Kern stehen, und ein farbiger Rand
   * verschwaemme dort. Sie ist der Grund, warum die Zahl auf jedem Untergrund lesbar bleibt,
   * ohne dass darunter ein Kasten liegen muesste - ein Kasten deckte das Feld zu.
   */
  damageFresh: '#ffffff',
  damageOutline: '#000000',
  damageFaded: '#c0c0c0',

  /*
   * Das Geschoss: heller Kopf, dunkler Schweif.
   *
   * Der Kern ist weiss, weil ein Kopf von acht Pixeln nur dann als Objekt gelesen wird, wenn
   * er einen Punkt hat, der heller ist als alles ringsum - ein durchgefaerbter Kreis in der
   * Turmfarbe verschwimmt bei ausgezoomter Kamera zum Fleck. Weiss traegt hier keine
   * Bedeutung, sondern ist ein Helligkeitswert, dieselbe Ueberlegung wie bei `enemyCoreHot`.
   * Die Rolle - welcher Turm geschossen hat - steht im Ring darum, und der hat die Turmfarbe.
   *
   * Der Schweif dagegen ist **dunkel**, ein gedaempftes Mauve knapp ueber Grundniveau. Das
   * ist der Punkt, an dem sich diese Loesung von einer leuchtenden Spur unterscheidet: In
   * einem vollen Bild liegen hunderte Schweife gleichzeitig im Feld. Leuchteten sie, hoebe
   * sich die Gesamthelligkeit der Szene, und Gegner, Muenzen und Reichweitenkante - alles,
   * was Auskunft gibt - saessen in einem hellen Schleier. Dunkel gehalten kann derselbe
   * Schweif beliebig oft im Bild stehen, ohne einer Leitfarbe Aufmerksamkeit zu nehmen.
   * Violett ist im Referenzbild ohnehin die Farbe der Geschossspur.
   */
  bulletCore: '#ffffff',
  bulletTrailRgb: VIOLET_RGB,
  /** Deckkraft des Schweifs am Kopf. Am Ende laeuft er auf null aus. */
  bulletTrailAlpha: 0.5,

  /*
   * Der Wirkungsbereich - die dunkelste Zeichnung im ganzen Bild.
   *
   * Im Bild gilt durchgehend: **unbunt heisst dauerhafte Geometrie, gesaettigt heisst
   * Faehigkeit mit Laufzeit.** Der Wirkungsbereich liegt immer da, in jedem Bild, ueber die
   * ganze Bildbreite - er ist der Boden und keine Meldung. Cyan war deshalb an dieser Stelle
   * die falsche Farbe: Es ist dieselbe Farbe wie Turm, Geschosskopf und Bauhilfe, und ein
   * dauerhafter Ring in einer Leitfarbe nimmt allen dreien Aufmerksamkeit weg, jede Sekunde.
   * Ein blaugrauer Ton mit R, G und B dicht beieinander traegt keine Bedeutung und kann
   * deshalb auch keiner Bedeutungsfarbe ihre nehmen - dieselbe Ueberlegung wie bei
   * `damageFaded`.
   *
   * Er ist zugleich der einzige Strich ohne Leuchthof. Leuchten heisst im Bild "hier ist
   * gerade etwas passiert"; am Wirkungsbereich passiert nie etwas. Der Hof machte die Kante
   * ausserdem breit und weich, und eine Grenze, die man auf zehn Pixel genau nicht angeben
   * kann, ist als Grenze wertlos.
   */
  rangeEdge: '#2b3138',
  /**
   * Wie viel heller der Grund **innerhalb** des Bereichs liegt, je Kanal.
   *
   * Additiv aufgetragen, nicht als durchscheinende Flaeche: Der Abstand nach aussen ist damit
   * ueberall genau derselbe - am Rand wie in der Mitte, ueber dem Gitter wie daneben. Ein
   * Verlauf zur Mitte hin (so war es vorher) macht aus der Zone eine Beleuchtung; sie soll
   * aber eine Flaeche sein, die man auch dort noch liest, wo Gegner die Kante verdecken.
   *
   * Neun Einheiten sind knapp ueber der Schwelle, ab der zwei Flaechen als verschieden gelten,
   * und weit unter allem, was Auskunft traegt.
   */
  rangeLift: 9,

  /** Kampf. */
  /**
   * Die Fuellung des Lebensbalkens - fuer jeden Gegner dieselbe, Boss eingeschlossen.
   *
   * `LIFE` und nicht `MAGENTA`: Herleitung samt Nachrechnung steht bei `LIFE` oben. Kurz -
   * eine Reihe von Strichen in der Farbe der Dinge, auf denen sie liegen, ist keine Reihe.
   */
  hpBar: LIFE,
  /**
   * Der durchgebrannte Kern von Elite und Boss - der einzige weisse Ton auf dem Spielfeld
   * ausserhalb der Schadenszahlen.
   *
   * Er steht hier und nicht in `PALETTE`, weil er keine Bedeutungsfarbe ist, sondern ein
   * Helligkeitswert: die Spitze des Glimm-Budgets. Der leichte Stich ins Rosa (statt reinem
   * Weiss) haelt ihn mit dem magentafarbenen Hof zusammen, in dem er liegt - reines Weiss
   * saehe daneben aus wie ein Loch.
   */
  enemyCoreHot: '#fffcff',
  /**
   * Der getroffene Gegner im Augenblick des Einschlags.
   *
   * Derselbe Ton wie der Kern von Elite und Boss, und aus demselben Grund kein reines
   * Weiss: Er liegt in der Gegnerfarbe und soll durchbrennen, nicht ausgeschnitten wirken.
   * Dass er sich den Ton mit dem Elite teilt, ist kein Zufall - beide sagen dasselbe: hier
   * ist die Roehre gerade ueberlastet. Beim Elite dauerhaft, beim Treffer fuer einen
   * Wimpernschlag.
   */
  enemyHitFlash: '#fffcff',
  hitEnemy: '#ffffff',
  hitStation: MAGENTA,
  stationHpFull: TEAL,
  stationHpLow: MAGENTA,
} as const

/**
 * Dezente Einfaerbung nach Aufgabe. Soll die Formsignatur unterstuetzen, nicht ersetzen -
 * deshalb liegen alle Toene dicht an der Panelflaeche und unterscheiden sich nur im Stich.
 */
export const FILL_BY_CATEGORY: Record<Category, string> = {
  attack: '#122455',
  area: '#1b1f52',
  special: '#0f2a58',
  buff: '#13284a',
  support: '#191d4e',
}

/** GDD 13 Abschnitt 7: die Neon-Umrandung zeigt die Seltenheit. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#93a7c8',
  rare: LIME,
  epic: CYAN,
  legendary: GOLD,
  mythic: MAGENTA,
}

/** Leuchtstaerke: von "leichter Rand" bis "pulsierende Neonenergie". */
export const RARITY_GLOW: Record<Rarity, number> = {
  common: 0,
  rare: 6,
  epic: 10,
  legendary: 15,
  mythic: 20,
}

/**
 * Der Hauptturm hat keine Raritaet, atmet aber (GDD 04 Abschnitt 2, GDD 13 Abschnitt 10).
 *
 * Langsam und tief: Ein schneller Puls wirkt wie eine Warnung, ein langsamer wie ein
 * laufender Apparat. Die Rate ist bewusst kein Vielfaches der Mythic-Pulsrate, sonst
 * geraten Kern und Raritaetsrahmen in Gleichschritt.
 */
export const CORE_GLOW_BASE = 13
export const CORE_GLOW_PULSE = 9
export const CORE_BREATH_RATE = 1.7

/** Zusaetzliches Leuchten im Augenblick eines Treffers auf die Station. */
export const CORE_HIT_GLOW = 26
