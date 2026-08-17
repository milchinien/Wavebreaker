/**
 * Einstellungen des Geraets (GDD 13 Abschnitt 3).
 *
 * Sie liegen **nicht im Spielstand**, sondern in einer eigenen Ablage. Der Grund ist keine
 * Bequemlichkeit: Lautstaerke, Effektstufe und Bewegungsdaempfung sagen etwas ueber das
 * Geraet aus, an dem gerade gespielt wird - nicht ueber den Fortschritt. Ein Spielstand,
 * der spaeter auf ein anderes Geraet wandert, soll dessen Regler nicht ueberschreiben.
 *
 * Sie ueberleben deshalb auch das Loeschen des Spielstands und jedes Prestige.
 *
 * Ein fehlender oder kaputter Eintrag faellt auf den Startwert zurueck. Einstellungen sind
 * die Stelle, an der ein Fehler am wenigsten kosten darf: Wer den Ton leiser gestellt hat
 * und beim naechsten Start volle Lautstaerke bekommt, aergert sich - wer nichts hat, dem
 * fehlt nur eine Bequemlichkeit.
 */

import { BUSES, clampLevel, defaultMix, type MixLevels } from './mixer.ts'

export type Settings = {
  /** Buff-Linien dauerhaft zeigen, nicht nur bei Auswahl. */
  buffLines: boolean
  /** Kampfeffekte zeichnen: Splitter, Druckwellen, Muendungsfeuer (GDD 13 Abschnitt 10). */
  effects: boolean
  /** Bewegte Uebergaenge zwischen den Bereichen. Aus fuer wen sie stoeren. */
  motion: boolean
  /** Ein Pegel je Klanggruppe, jeweils 0 bis 1 (`app/mixer.ts`). */
  mix: MixLevels
}

export const SETTINGS_KEY = 'wavebreaker.settings'

export function defaultSettings(): Settings {
  return { buffLines: true, effects: true, motion: true, mix: defaultMix() }
}

type Storage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function loadSettings(): Settings {
  const base = defaultSettings()
  const store = storage()
  if (!store) return base

  let raw: unknown
  try {
    const text = store.getItem(SETTINGS_KEY)
    if (text === null) return base
    raw = JSON.parse(text)
  } catch {
    return base
  }

  if (typeof raw !== 'object' || raw === null) return base
  const entry = raw as Record<string, unknown>

  return {
    buffLines: readBoolean(entry['buffLines'], base.buffLines),
    effects: readBoolean(entry['effects'], base.effects),
    motion: readBoolean(entry['motion'], base.motion),
    mix: readMix(entry, base.mix),
  }
}

export function saveSettings(settings: Settings): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Speicher gesperrt oder voll - das Spiel laeuft weiter, nur ohne gemerkte Regler.
  }
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Die drei Pegel lesen - und einen alten Eintrag mitnehmen.
 *
 * Bis es die Busse gab, stand hier ein einziges Feld `volume`. Wer damals leise gestellt
 * hat, bekommt seinen Wert auf alle drei Gruppen uebertragen statt auf den Startwert
 * zurueckgesetzt. Das ist kein Luxus: Ein Spiel, das nach einer Aktualisierung ungefragt
 * wieder auf volle Lautstaerke springt, macht genau einmal einen sehr schlechten Eindruck.
 *
 * Der neue Eintrag hat Vorrang. Sind beide da, ist `volume` ein Ueberbleibsel.
 */
function readMix(entry: Record<string, unknown>, fallback: MixLevels): MixLevels {
  const legacy = entry['volume']
  const inherited = typeof legacy === 'number' ? clampLevel(legacy, fallback.music) : null

  const raw = entry['mix']
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null

  const mix = { ...fallback }
  for (const bus of BUSES) {
    mix[bus] = clampLevel(stored?.[bus], inherited ?? fallback[bus])
  }
  return mix
}
