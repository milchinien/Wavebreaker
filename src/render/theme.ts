/**
 * Farben, Linienstaerken und Leuchtstaerken an einem Ort (GDD 13 Abschnitt 2 und 7).
 *
 * Der praegende Look entsteht aus den **hellen Fugen** zwischen den Modulen - also aus den
 * geteilten Kanten, nicht aus den Fuellflaechen. Aussenkanten bleiben dunkel. So liest sich
 * eine gewachsene Station als eine zusammenhaengende Maschine statt als Haufen Vielecke
 * (Befund aus Prototyp 01).
 */

import type { Category, Rarity } from '../data/types.ts'

/*
 * Die Grundfarben stammen aus dem Referenzbild des Auftraggebers: fast schwarzes Marineblau,
 * deckende dunkelblaue Panels mit hellem Rahmen, darauf wenige kraeftige Neonfarben. Jede
 * Farbe hat genau eine Rolle - wer eine neue braucht, prueft erst, ob eine der sechs passt.
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
  /** Gegner, Leben, Verteidigung, Ablehnung. */
  magenta: MAGENTA,
  /** Muenzen, Utility, Legendary. */
  gold: GOLD,
  /** Verstaerkung und Bosse - im Referenzbild die Farbe der Geschossspur. */
  violet: VIOLET,
  /** Sektionsbalken ueber Listen - bislang nur im DOM verwendet. */
  section: SECTION,
} as const

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

  /** Kampf. */
  hpBar: MAGENTA,
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
