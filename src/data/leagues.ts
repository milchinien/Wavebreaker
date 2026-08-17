/**
 * Die zehn Ligen (docs/liga-system.md Abschnitt 5).
 *
 * Eine Liga ist **ein Ort, kein Besitz**. Sie sagt, *wo* gespielt wird; was der Spieler
 * besitzt, sagt der Prestige-Baum. Ohne diese Trennung waeren es zwei Systeme, die
 * dasselbe tun, und eines von beiden wuerde das andere verdraengen.
 *
 * Was hier steht, ist deshalb **nur Identitaet**: Kennung, Farbton und die vier Werte, die
 * den Hintergrund je Liga aufdrehen. Die Rechnung selbst - Versatz und Belohnungsfaktor -
 * steht in `data/balance.ts`, weil sie ein Balancewert ist und kein Inhalt. Eine elfte Liga
 * ist damit ein Eintrag in dieser Liste und keine Zeile Code.
 *
 * **Der Farbton ist ein Name, kein Farbwert.** `data/` kennt `render/` nicht; die Aufloesung
 * nach `PALETTE` geschieht in `render/theme.ts` (`LEAGUE_TINT`). Stuende hier ein `#rrggbb`,
 * haenge die Simulation an der Darstellung.
 *
 * Der **angezeigte Name** steht in `data/strings.ts` unter der Kennung dieser Liga und laeuft
 * damit durch `t()` - anders als bei Turmarten, wo der englische Name heute noch als Literal
 * im Datensatz steht. Das ist bewusst der neue Weg und nicht der alte (GDD 16 Abschnitt 1).
 */

/**
 * Erlaubte Farbtoene. Bewusst nur die sechs aus `PALETTE`, die als Ligafarbe taugen.
 *
 * `life` fehlt und darf nie dazukommen: Es ist der Ton des Gegnerlebens und laut
 * `render/theme.ts` der einzige, den kein Gegner tragen darf. Eine Liga, die ihn traegt,
 * faerbte den Grund in der Farbe, an der der Spieler Lebensbalken erkennt.
 */
export type LeagueTint = 'cyan' | 'teal' | 'lime' | 'gold' | 'violet' | 'magenta'

/**
 * Die Kennungen als Union und nicht als `string`.
 *
 * Damit ist die Kennung zugleich ein gueltiger Textschluessel: `t(def.id)` uebersetzt, ohne
 * dass irgendwo eine Umwandlung stuende. Eine Liga ohne Text faellt beim Uebersetzen auf,
 * nicht erst im Bild als roher Schluessel.
 */
export type LeagueId =
  | 'league.drift'
  | 'league.belt'
  | 'league.ember'
  | 'league.verge'
  | 'league.span'
  | 'league.tide'
  | 'league.deep'
  | 'league.spiral'
  | 'league.maw'
  | 'league.breach'

export type LeagueDef = {
  /** 1-basiert - dieselbe Zahl, die in `run.league` steht. */
  index: number
  /** Kennung **und** Textschluessel des angezeigten Namens (`data/strings.ts`). */
  id: LeagueId
  tint: LeagueTint
  /** Faktor auf `THEME.glowCore` - der Schein, in dem die Station steht. */
  glow: number
  /** Faktor auf die Deckkraft des Rasters. */
  grid: number
  /** Bahnenzahl in `render/backdrop.ts`. Der Grundwert dort ist 14. */
  bands: number
  /** Langsame Driftpartikel hinter dem Raster. Erst ab der Mitte der Leiter. */
  drift: boolean
}

/*
 * Die Intensitaet steigt ueber Farbe, Schein und Kontrast des **Grundes** - nicht ueber
 * mehr Bewegung im Vordergrund. Die Regel dahinter steht in `docs/politur.md`: "Verdeckt
 * ein Effekt die Station oder lenkt von ihr ab, ist er falsch." Liga 10 darf intensiv sein,
 * aber die Station muss dort so gut ablesbar bleiben wie in Liga 1.
 *
 * Die Ligen 7 bis 10 wiederholen Farbtoene. Das ist kein Versehen: Ein elfter Ton, der
 * weder `life` noch einer der vorhandenen ist, waere eine Erweiterung von `PALETTE` - und
 * die ist eine eigene Entscheidung, keine Nebenwirkung des Ligensystems.
 */
export const LEAGUES: readonly LeagueDef[] = [
  { index: 1, id: 'league.drift', tint: 'cyan', glow: 1.0, grid: 1.0, bands: 14, drift: false },
  { index: 2, id: 'league.belt', tint: 'teal', glow: 1.1, grid: 1.05, bands: 15, drift: false },
  { index: 3, id: 'league.ember', tint: 'lime', glow: 1.2, grid: 1.1, bands: 16, drift: false },
  { index: 4, id: 'league.verge', tint: 'gold', glow: 1.3, grid: 1.15, bands: 17, drift: false },
  { index: 5, id: 'league.span', tint: 'violet', glow: 1.45, grid: 1.2, bands: 18, drift: true },
  { index: 6, id: 'league.tide', tint: 'magenta', glow: 1.6, grid: 1.25, bands: 19, drift: true },
  { index: 7, id: 'league.deep', tint: 'violet', glow: 1.75, grid: 1.3, bands: 20, drift: true },
  { index: 8, id: 'league.spiral', tint: 'magenta', glow: 1.9, grid: 1.35, bands: 21, drift: true },
  { index: 9, id: 'league.maw', tint: 'gold', glow: 2.05, grid: 1.4, bands: 22, drift: true },
  { index: 10, id: 'league.breach', tint: 'magenta', glow: 2.25, grid: 1.5, bands: 24, drift: true },
]

/** Die hoechste Liga, die es gibt. Ueber sie hinaus schaltet nichts mehr frei. */
export const MAX_LEAGUE = LEAGUES.length

const BY_INDEX = new Map(LEAGUES.map((league) => [league.index, league]))

export function leagueByIndex(index: number): LeagueDef {
  const def = BY_INDEX.get(index)
  if (!def) throw new Error(`Unbekannte Liga: ${index}`)
  return def
}

export function isKnownLeague(index: number): boolean {
  return BY_INDEX.has(index)
}

/**
 * Auf den gueltigen Bereich ziehen.
 *
 * Steht hier und nicht bei jedem Aufrufer, weil ein Ligaindex aus drei Richtungen kommt,
 * die man nicht alle im Griff hat: aus einem alten Spielstand, aus der Bedienung und aus
 * einer Rechnung. Ein `leagueByIndex` mit einer 0 waere ein Absturz an der Stelle, an der
 * er am wenigsten hilft.
 */
export function clampLeague(index: number): number {
  if (!Number.isFinite(index)) return 1
  return Math.min(MAX_LEAGUE, Math.max(1, Math.floor(index)))
}
