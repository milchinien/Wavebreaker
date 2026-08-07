/**
 * Erfahrung, Stufen und Perks (GDD 09 Teil A).
 *
 * Die eine Entscheidung dieser Datei: **Erfahrung wird nie verbraucht.**
 *
 * `run.xp` ist die Summe aller je erhaltenen Erfahrungspunkte, und die erreichte Stufe ist
 * daraus *abgeleitet*. `run.level` zaehlt daneben nur, bis wohin der Spieler seinen Perk
 * bereits **abgeholt** hat. Die Differenz sind die offenen Aufstiege.
 *
 * Der naheliegende Weg waere gewesen, bei jedem Aufstieg XP abzuziehen und die Stufe
 * hochzuzaehlen. Dann gaebe es aber zwei Zahlen, die dasselbe wissen, und jede Stelle, die
 * XP vergibt, muesste an den Aufstieg denken. Genau dort entstehen die Fehler, die man
 * spaeter nicht mehr findet: eine Belohnung, die die Stufe vergisst, ein Wellenneustart,
 * der doppelt zaehlt. Abgeleitet kann das nicht auseinanderlaufen - `grantReward` bleibt
 * dieselbe eine Zeile, und ein Aufstieg ist nur noch die Feststellung, dass eine Schwelle
 * ueberschritten wurde.
 *
 * Nebenbei loest das auch das Stapeln: Wer waehrend einer Bosswelle drei Stufen aufsteigt,
 * hat drei offene Auswahlen - ohne dass irgendwo eine Warteschlange gefuehrt wird.
 */

import { MAX_LEVEL, PERK_CHOICES, XP_BASE, XP_EXPONENT } from '../data/balance.ts'
import { isKnownPerk, PERKS, perkById, type PerkDef, type PerkGlobal } from '../data/perks.ts'
import type { StatKey } from '../data/types.ts'
import type { Rng } from '../core/rng.ts'
import type { GameState } from '../app/state.ts'

/** Erfahrung fuer den Aufstieg **von** Stufe `level` auf `level + 1`. */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return XP_BASE
  return Math.round(XP_BASE * Math.pow(Math.floor(level), XP_EXPONENT))
}

/**
 * Gesamte Erfahrung, die noetig ist, um Stufe `level` zu **erreichen**. Stufe 1 kostet
 * nichts - dort beginnt jeder Run.
 *
 * Gepuffert und wachsend: Die Schwellen aendern sich nie, also wird jede genau einmal
 * gerechnet. Ohne den Puffer summierte die Anzeige in jedem Bild erneut ueber alle Stufen.
 */
const cumulative: number[] = [0, 0]

export function cumulativeXp(level: number): number {
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  while (cumulative.length <= target) {
    const previous = cumulative.length - 1
    cumulative.push((cumulative[previous] as number) + xpForLevel(previous))
  }
  return cumulative[target] as number
}

/** Hoechste Stufe, die mit dieser Erfahrung erreicht ist. */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1
  let level = 1
  while (level < MAX_LEVEL && xp >= cumulativeXp(level + 1)) level += 1
  return level
}

/** Bereits erreichte Stufe - unabhaengig davon, ob der Perk schon gewaehlt wurde. */
export function currentLevel(state: GameState): number {
  return levelFromXp(state.run.xp)
}

/**
 * Wie viele Aufstiege noch auf ihre Auswahl warten (GDD 09 Abschnitt 2: mehrere Aufstiege
 * stapeln sich). Null bedeutet: alles abgeholt.
 */
export function pendingLevelUps(state: GameState): number {
  return Math.max(0, currentLevel(state) - claimedLevel(state))
}

/** Bis hierhin ist der Perk abgeholt. Gegen kaputte Spielstaende abgesichert. */
function claimedLevel(state: GameState): number {
  const level = state.run.level
  if (!Number.isFinite(level) || level < 1) return 1
  return Math.min(MAX_LEVEL, Math.floor(level))
}

export type LevelProgress = {
  /** Erreichte Stufe. */
  level: number
  /** Erfahrung innerhalb dieser Stufe. */
  into: number
  /** Erfahrung, die diese Stufe insgesamt verlangt. */
  need: number
  /** Anteil 0..1 - fuer die Leiste. */
  fraction: number
}

export function levelProgress(state: GameState): LevelProgress {
  const level = currentLevel(state)
  const base = cumulativeXp(level)
  const need = level >= MAX_LEVEL ? 0 : cumulativeXp(level + 1) - base
  const into = Math.max(0, state.run.xp - base)
  return {
    level,
    into,
    need,
    fraction: need > 0 ? Math.min(1, into / need) : 1,
  }
}

// ---------------------------------------------------------------------------
// Auswahl
// ---------------------------------------------------------------------------

/**
 * Drei Vorschlaege ziehen, gewichtet und **ohne Doppel** (GDD 09 Abschnitt 2).
 * Drei Vorschlaege ziehen, gewichtet und **ohne Doppel** (GDD 09 Abschnitt 2).
 * Ohne Doppel, weil drei gleiche Karten keine Wahl sind. Gezogen wird nach Gewicht, und der
 * Ohne Doppel, weil drei gleiche Karten keine Wahl sind. Gezogen wird nach Gewicht, und der
 * gezogene Eintrag faellt fuer dieses Angebot heraus - so bleiben seltene Perks selten,
 * ohne dass ein Angebot je aus einer einzigen Karte besteht.
 * Rein: Der Generator kommt von aussen, damit dasselbe Angebot bei gleichem Zustand
 * Rein: Der Generator kommt von aussen, damit dasselbe Angebot bei gleichem Zustand
 * reproduzierbar ist (Implementierungsplan Abschnitt 3).
export function offerPerks(rng: Rng, count = PERK_CHOICES): PerkDef[] {
export function offerPerks(rng: Rng, count = PERK_CHOICES): PerkDef[] {
  const chosen: PerkDef[] = []
  const chosen: PerkDef[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
  for (let i = 0; i < count && pool.length > 0; i++) {
    for (const perk of pool) total += perk.weight
    for (const perk of pool) total += perk.weight
    let roll = rng.next() * total
    let roll = rng.next() * total
    for (let k = 0; k < pool.length; k++) {
    for (let k = 0; k < pool.length; k++) {
      roll -= (pool[k] as PerkDef).weight
      if (roll <= 0) {
        index = k
        break
      }
    }
    chosen.push(pool[index] as PerkDef)
    chosen.push(pool[index] as PerkDef)
    pool.splice(index, 1)
  }
  return chosen
  return chosen
}
/**
 * Das offene Angebot - erzeugt es, falls noch keines steht.
 * Das offene Angebot - erzeugt es, falls noch keines steht.
 * Es liegt im Spielstand und nicht in den Laufzeitdaten: Sonst wuerde ein Neuladen ein
 * neues Angebot wuerfeln, und wer seine drei Karten nicht mag, drueckt F5. Eine Auswahl,
 * neues Angebot wuerfeln, und wer seine drei Karten nicht mag, drueckt F5. Eine Auswahl,
 * die man beliebig oft wiederholen kann, ist keine.
export function currentOffer(state: GameState): PerkDef[] {
export function currentOffer(state: GameState): PerkDef[] {
    if (state.run.perkOffer.length > 0) state.run.perkOffer = []
    if (state.run.perkOffer.length > 0) state.run.perkOffer = []
    return []
  }
  const stored = state.run.perkOffer.filter(isKnownPerk)
  const stored = state.run.perkOffer.filter(isKnownPerk)
    state.run.perkOffer = stored
    state.run.perkOffer = stored
    return stored.map(perkById)
  }
  const offer = offerPerks(state.runtime.rng)
  state.run.perkOffer = offer.map((perk) => perk.id)
  state.run.perkOffer = offer.map((perk) => perk.id)
  return offer
}
/**
 * Einen Perk annehmen. Gibt `false` zurueck, wenn gerade kein Aufstieg offen ist oder der
 * Perk nicht im aktuellen Angebot steht - beides waere sonst ein Weg, sich Perks zu holen,
 * Perk nicht im aktuellen Angebot steht - beides waere sonst ein Weg, sich Perks zu holen,
 * ohne dafuer aufzusteigen.
export function choosePerk(state: GameState, perkId: string): boolean {
export function choosePerk(state: GameState, perkId: string): boolean {
  if (pendingLevelUps(state) === 0) return false
  if (!state.run.perkOffer.includes(perkId)) return false
  if (!state.run.perkOffer.includes(perkId)) return false
  state.run.perks.push(perkId)
  state.run.level = claimedLevel(state) + 1
  // Das naechste Angebot wird beim naechsten Aufruf frisch gezogen.
  // Das naechste Angebot wird beim naechsten Aufruf frisch gezogen.
  state.run.perkOffer = []
  emit('perk.chosen', { perkId, level: state.run.level })
  return true
// ---------------------------------------------------------------------------
// Wirkung
// ---------------------------------------------------------------------------
 * Neue Stufen melden. Aus dem Takt aufrufen.
/**
 * Der Aufstieg selbst ist abgeleitet und passiert deshalb "von allein" - trotzdem braucht
 * es einen Augenblick, an dem er *gemeldet* wird: fuer die Anzeige jetzt und fuer den Klang
 * spaeter (GDD 13 Abschnitt 11). Gemeldet wird jede Stufe einzeln, auch wenn eine Bosswelle
 * Perks zu je acht Prozent ergeben +80 %, nicht +116 %. Multiplikativ waere jeder Deckel
 * wirkungslos und die Kurve nicht mehr zu ueberblicken.
export function stepProgression(state: GameState): void {
export function perkStatBonus(state: GameState, key: StatKey): number {
  const announced = state.runtime.announcedLevel
  for (const id of state.run.perks) {
  // Erster Takt nach dem Laden: stumm nachziehen, nicht nachtraeglich alles melden.
    const effect = perkById(id).effect
    if (effect.kind === 'stat' && effect.stat === key) total += effect.amount
    return
  return total
}
  if (level <= announced) return
  for (let reached = announced + 1; reached <= level; reached++) {
export function perkGlobalBonus(state: GameState, key: PerkGlobal): number {
  let total = 0
  state.runtime.announcedLevel = level
    if (!isKnownPerk(id)) continue
    const effect = perkById(id).effect
    if (effect.kind === 'global' && effect.global === key) total += effect.amount
  }
  return total
}

/** Wie oft ein bestimmter Perk bereits gewaehlt wurde - fuer die Anzeige. */
export function perkCount(state: GameState, perkId: string): number {
  let count = 0
  for (const id of state.run.perks) if (id === perkId) count += 1
  return count
}

