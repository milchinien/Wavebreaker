/**
 * Zahlendarstellung (GDD 13 Abschnitt 8).
 *
 * Diese Datei ist die einzige Stelle, an der aus einer Zahl ein Text wird. Das ist die
 * Absicherung fuer die Entscheidung "normales `number`" aus Abschnitt 3 des
 * Implementierungsplans: Sollte spaeter doch ein eigener Zahlentyp noetig werden,
 * aendert sich nur diese Datei.
 *
 * Regeln:
 *   bis 9.999      vollstaendig, englische Tausendertrennung -> "4,250"
 *   ab 10.000      abgekuerzt mit einer Nachkommastelle      -> "12.5K", "3.8M"
 *   ab 1e15        wissenschaftliche Kurzform                -> "4.1e18"
 * Prozentwerte immer als Prozent, nie als Multiplikator.
 */

const SUFFIXES = ['', 'K', 'M', 'B', 'T'] as const
const ABBREVIATE_FROM = 10_000
/** Ab hier reichen die Suffixe nicht mehr: 1000 * 1e12. */
const SCIENTIFIC_FROM = 1e15

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-'

  const sign = value < 0 ? '-' : ''
  const n = Math.abs(value)

  if (n < ABBREVIATE_FROM) {
    // Ganze Zahlen ohne Nachkommastelle, gebrochene mit einer.
    const rounded = Number.isInteger(n) ? n : Math.round(n * 10) / 10
    return sign + groupThousands(rounded)
  }

  if (n >= SCIENTIFIC_FROM) {
    return sign + toScientific(n)
  }

  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3))
  const scaled = n / Math.pow(1000, tier)
  // 999.95K wuerde sonst als "1000.0K" erscheinen statt als "1.0M".
  const shown = Math.floor(scaled * 10) / 10
  return `${sign}${shown.toFixed(1)}${SUFFIXES[tier]}`
}

function groupThousands(value: number): string {
  const [whole = '0', fraction] = String(value).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

function toScientific(value: number): string {
  const exponent = Math.floor(Math.log10(value))
  const mantissa = value / Math.pow(10, exponent)
  return `${(Math.floor(mantissa * 10) / 10).toFixed(1)}e${exponent}`
}

export type PercentOptions = {
  /** Vorzeichen auch bei positiven Werten zeigen: "+15%". */
  sign?: boolean
  /** Nachkommastellen, Standard 0. */
  decimals?: number
}

/** `value` ist ein Anteil: 0.15 -> "15%". Niemals ein Multiplikator wie "x1.15". */
export function formatPercent(value: number, options: PercentOptions = {}): string {
  if (!Number.isFinite(value)) return '-'
  const decimals = options.decimals ?? 0
  const percent = value * 100
  const body = `${percent.toFixed(decimals)}%`
  if (options.sign && percent > 0) return `+${body}`
  return body
}

/** Sekunden als Spielzeit: "8s", "1:05", "2:14:03". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const total = Math.floor(seconds)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)

  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  if (m > 0) return `${m}:${pad(s)}`
  return `${s}s`
}

/** Grobe Angabe fuer die Rueckkehr-Zusammenfassung: "2h 14m", "45m", "30s". */
export function formatDurationCoarse(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor(total / 60) % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${total}s`
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
