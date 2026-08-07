/**
 * Bausteine der Selbsttests.
 *
 * Bewusst kein Testframework: Die Pruefungen laufen im Spiel selbst ueber `?selftest`
 * (Implementierungsplan E0) und zusaetzlich headless ueber `npm run selftest`. Beide
 * Wege fuehren durch denselben Code.
 *
 * `check` faengt Fehler ab und schreibt das Ergebnis in eine Sammlung; ein gescheiterter
 * Test bricht den Durchlauf also nicht ab.
 */

export type TestResult = {
  suite: string
  name: string
  ok: boolean
  message?: string
}

let results: TestResult[] = []
let currentSuite = 'allgemein'

export class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

export function suite(name: string): void {
  currentSuite = name
}

export function check(name: string, fn: () => void): void {
  try {
    fn()
    results.push({ suite: currentSuite, name, ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({ suite: currentSuite, name, ok: false, message })
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message)
}

export function assertEqual<T>(actual: T, expected: T, message = ''): void {
  if (!Object.is(actual, expected)) {
    throw new AssertionError(
      `${message ? message + ': ' : ''}erwartet ${format(expected)}, war ${format(actual)}`,
    )
  }
}

export function assertClose(actual: number, expected: number, epsilon = 1e-9, message = ''): void {
  if (!(Math.abs(actual - expected) <= epsilon)) {
    throw new AssertionError(
      `${message ? message + ': ' : ''}erwartet ${expected} (+-${epsilon}), war ${actual}`,
    )
  }
}

export function assertDeepEqual(actual: unknown, expected: unknown, message = ''): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) {
    throw new AssertionError(`${message ? message + ': ' : ''}\n  erwartet ${b}\n  war      ${a}`)
  }
}

export function assertThrows(fn: () => unknown, message = 'sollte werfen'): void {
  try {
    fn()
  } catch {
    return
  }
  throw new AssertionError(message)
}

function format(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

/** Gesammelte Ergebnisse abholen und die Sammlung leeren. */
export function takeResults(): TestResult[] {
  const taken = results
  results = []
  currentSuite = 'allgemein'
  return taken
}
