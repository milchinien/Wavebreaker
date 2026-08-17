/**
 * Ereignisse und Versorgungskapseln (GDD 11).
 *
 * Diese Datei ist der **einzige Ort**, an dem Ereignisse ausgeloest, entschieden und
 * ausgezahlt werden, und der einzige, an dem Kapseln entstehen und aufgehen. Sie kennt
 * dafuer nur Datensaetze - welches Ereignis kommt und was es bewirkt, steht in
 * `data/events.ts`.
 *
 * Drei Entscheidungen praegen den Aufbau:
 *
 * **1. Die Wirkung wird geschrieben, nicht erfragt.** Laufende Boni landen als fertige
 * Zahlen in `runtime.combat` (`eventBonus`, `enemyPower`); Kampf und Werte lesen sie dort
 * ab. Dieselbe Regel wie bei den Faehigkeiten - und aus demselben Grund: Sonst entstuende
 * ein Abhaengigkeitskreis zwischen Werten, Kampf und dieser Datei.
 *
 * **2. Diese Datei bindet `sim/combat.ts` nicht ein.** `killEnemy` dort laesst Kapseln
 * fallen und ruft also hierher; die Gegenrichtung waere ein Kreis. Alles, was Ereignisse
 * am Feld tun, laeuft deshalb ueber `sim/enemies.ts` und `sim/shop.ts`.
 *
 * **3. Das offene Ereignis liegt im Spielstand, seine Wirkung nicht.** Ein Neuladen darf
 * kein neues Ereignis wuerfeln (sonst waere die Entscheidung beliebig wiederholbar), aber
 * eine Wirkung, die in Simulationssekunden misst, darf keinen Programmstart ueberdauern.
 */

import { emit } from '../core/events.ts'
import type { Rng } from '../core/rng.ts'
import {
  EVENT_WAVE_MAX,
  EVENT_WAVE_MIN,
  MAX_PODS,
  POD_COLLECT_RADIUS,
  POD_DROP_CHANCE,
  POD_DROP_CHANCE_BOSS,
  POD_DROP_CHANCE_ELITE,
  eventRewardFor,
} from '../data/balance.ts'
import {
  eventById,
  eventsForWave,
  isKnownEvent,
  isKnownPod,
  podById,
  podsForWave,
  type EventEffect,
  type GameEventDef,
  type PodDef,
} from '../data/events.ts'
import { eliteById } from '../data/enemies.ts'
import { giftableUpgrades } from '../data/upgrades.ts'
import type { StatKey } from '../data/types.ts'
import { grantReward } from '../app/rewards.ts'
import { markDirty, type Boon, type GameState, type Pod } from '../app/state.ts'
import { applyEliteModifier, spawnEnemy, type Enemy } from './enemies.ts'
import { rollTowerOffer } from './shop.ts'
import { upgradeLevel } from './stats.ts'

// ---------------------------------------------------------------------------
// Ereignisse: ausloesen
// ---------------------------------------------------------------------------

/** Das Ereignis, das gerade auf eine Entscheidung wartet - oder `null`. */
export function currentEvent(state: GameState): GameEventDef | null {
  const id = state.run.eventId
  if (id === null || !isKnownEvent(id)) return null
  return eventById(id)
}

/** Die naechste Ereigniswelle wuerfeln (GDD 11 Abschnitt 2: alle 15 bis 25 Wellen). */
function rollNextEventWave(from: number, rng: Rng): number {
  return Math.max(1, Math.floor(from) + rng.int(EVENT_WAVE_MIN, EVENT_WAVE_MAX))
}

/**
 * Ein Ereignis ausloesen, wenn die faellige Welle erreicht ist.
 *
 * Gibt das Ereignis zurueck oder `null`. Es wird **nichts** entschieden - die Wahl trifft
 * der Spieler, und bis dahin laeuft der Kampf normal weiter (GDD 11 Abschnitt 3).
 *
 * Steht schon ein Ereignis offen, passiert nichts: Zwei Fenster uebereinander waeren keine
 * Abwechslung, sondern ein Stau.
 */
export function maybeTriggerEvent(state: GameState, rng: Rng): GameEventDef | null {
  const run = state.run

  // Erster Aufruf eines Runs: Der Abstand wird von der aktuellen Welle aus gewuerfelt.
  if (run.nextEventWave <= 0) {
    run.nextEventWave = rollNextEventWave(run.wave, rng)
    return null
  }

  if (run.eventId !== null) return null
  if (run.wave < run.nextEventWave) return null

  const candidates = eventsForWave(run.wave)
  // Die faellige Welle wird auch dann weitergesetzt, wenn kein Ereignis passt - sonst
  // haengt der Zaehler fest und prueft von da an in jedem Takt.
  run.nextEventWave = rollNextEventWave(run.wave, rng)
  if (candidates.length === 0) return null

  const event = rng.pick(candidates)
  run.eventId = event.id
  markDirty(state)
  emit('event.triggered', { eventId: event.id, wave: run.wave })
  return event
}

// ---------------------------------------------------------------------------
// Ereignisse: entscheiden
// ---------------------------------------------------------------------------

/**
 * Eine Option waehlen. Gibt `false` zurueck, wenn kein Ereignis offensteht oder die Option
 * nicht dazugehoert - dann aendert sich nichts.
 *
 * Die Wirkungen laufen **in der Reihenfolge des Datensatzes** ab. Das ist wichtig fuer
 * Optionen, die zugleich verstaerken und belohnen: Erst steht die Gefahr, dann die
 * Belohnung - so ist auf der Karte und im Ablauf dieselbe Reihenfolge.
 */
export function resolveEvent(state: GameState, choiceId: string): boolean {
  const event = currentEvent(state)
  if (!event) return false

  const choice = event.choices.find((entry) => entry.id === choiceId)
  if (!choice) return false

  // **Vor** dem Anwenden loeschen: Eine Wirkung, die einen Gegner erscheinen laesst, kann
  // ihrerseits Kapseln und Belohnungen ausloesen, und dabei darf kein halb entschiedenes
  // Ereignis mehr im Spielstand stehen.
  state.run.eventId = null

  for (const effect of choice.effects) applyEffect(state, event.id, effect)

  markDirty(state)
  emit('event.resolved', { eventId: event.id, choiceId })
  return true
}

/**
 * Ein Ereignis verwerfen, ohne zu waehlen.
 *
 * Es gibt keine Belohnung - die haengt an der Entscheidung. Der Ausweg steht trotzdem
 * offen, weil ein Fenster, das sich nicht schliessen laesst, die Oberflaeche blockiert
 * (dieselbe Ueberlegung wie beim Turmangebot).
 */
export function dismissEvent(state: GameState): void {
  if (state.run.eventId === null) return
  state.run.eventId = null
  markDirty(state)
}

function applyEffect(state: GameState, sourceId: string, effect: EventEffect): void {
  switch (effect.kind) {
    case 'reward': {
      const base = eventRewardFor(state.run.wave)
      grantReward(
        state,
        { gold: (effect.gold ?? 0) * base, xp: (effect.xp ?? 0) * base },
        'event',
      )
      return
    }

    case 'boon':
      addBoon(state, { sourceId, stats: { ...effect.stats }, power: 1, left: effect.duration })
      return

    case 'hazard':
      addBoon(state, { sourceId, stats: {}, power: effect.power, left: effect.duration })
      return

    case 'spawn': {
      const rng = state.runtime.rng
      for (let i = 0; i < effect.count; i++) {
        const enemy = spawnEnemy(state, effect.defId, rng.range(0, Math.PI * 2))
        if (!enemy) break // Obergrenze erreicht - der Rest faellt aus, nicht das Ereignis
        for (const id of effect.elite ?? []) applyEliteModifier(enemy, eliteById(id))
      }
      return
    }
  }
}

/**
 * Eine zeitlich begrenzte Wirkung von aussen eintragen.
 *
 * Die Haendler-Drohne verkauft dieselben Boni, die ein Ereignis verschenkt (GDD 11
 * Abschnitt 7). Sie laufen deshalb durch **dieselbe** Leiste und nicht durch eine zweite
 * daneben: Zwei Systeme mit eigenen Boni haetten zwei Uhren, zwei Ablaufregeln und zwei
 * Stellen, an denen ein Bonus haengen bleiben kann.
 *
 * `sourceId` ist die Herkunft - sie entscheidet, was sich verlaengert und was danebensteht.
 */
export function addEventBoon(
  state: GameState,
  sourceId: string,
  stats: Partial<Record<StatKey, number>>,
  duration: number,
): void {
  addBoon(state, { sourceId, stats: { ...stats }, power: 1, left: duration })
}

/**
 * Eine Wirkung eintragen. Dieselbe Quelle zweimal **verlaengert** und nimmt den staerkeren
 * Wert, statt sich zu stapeln - dieselbe Regel wie bei Brand und Frost (`sim/combat.ts`).
 * Sonst koennte dasselbe Ereignis zweimal hintereinander die Werte verdoppeln.
 */
function addBoon(state: GameState, boon: Boon): void {
  const existing = state.runtime.boons.find((entry) => entry.sourceId === boon.sourceId)
  if (!existing) {
    state.runtime.boons.push(boon)
    refreshEventEffects(state)
    return
  }

  for (const [key, amount] of Object.entries(boon.stats)) {
    const current = existing.stats[key] ?? 0
    existing.stats[key] = Math.max(current, amount ?? 0)
  }
  existing.power = Math.max(existing.power, boon.power)
  existing.left = Math.max(existing.left, boon.left)
  refreshEventEffects(state)
}

// ---------------------------------------------------------------------------
// Takt
// ---------------------------------------------------------------------------

/**
 * Wirkungen altern lassen und die abgeleiteten Zahlen setzen.
 *
 * Laeuft in `sim/battle.ts` **vor** den Faehigkeiten - nicht weil die Reihenfolge der
 * beiden etwas ausmachte (sie schreiben verschiedene Felder), sondern damit eine ablaufende
 * Wirkung noch in diesem Takt verschwindet und nicht erst im naechsten.
 */
export function stepEvents(state: GameState, dt: number): void {
  const boons = state.runtime.boons
  if (boons.length === 0) {
    // Auch dann setzen: Der letzte abgelaufene Bonus muss die Zahlen zuruecknehmen.
    if (state.runtime.combat.enemyPower !== 1) refreshEventEffects(state)
    return
  }

  for (let i = boons.length - 1; i >= 0; i--) {
    const boon = boons[i] as Boon
    boon.left -= dt
    if (boon.left <= 0) boons.splice(i, 1)
  }
  refreshEventEffects(state)
}

/**
 * Die beiden Zahlen setzen, die Kampf und Werte lesen.
 *
 * Sie werden **jedes Mal neu aufgebaut** statt fortgeschrieben - dieselbe Begruendung wie
 * bei `refreshDerived` in `sim/abilities.ts`: Fortschreiben hiesse, beim Ablaufen genau den
 * Betrag wieder abzuziehen, den man beim Eintragen addiert hat, und das geht bei jeder
 * Rundung schief.
 */
function refreshEventEffects(state: GameState): void {
  const combat = state.runtime.combat

  const bonus: Partial<Record<StatKey, number>> = {}
  let power = 1

  for (const boon of state.runtime.boons) {
    for (const [key, amount] of Object.entries(boon.stats)) {
      const stat = key as StatKey
      bonus[stat] = (bonus[stat] ?? 0) + (amount ?? 0)
    }
    // Zwei Gefahren multiplizieren sich: Jede sagt "anderthalbmal so stark", und das gilt
    // dann auf dem, was die andere schon angerichtet hat.
    power *= boon.power
  }

  combat.eventBonus = bonus
  combat.enemyPower = power
}

/** Laufende Wirkungen loeschen. Beim Prestige und beim Laden - siehe `resetAbilities`. */
export function resetBoons(state: GameState): void {
  state.runtime.boons.length = 0
  refreshEventEffects(state)
}

/** Restlaufzeit einer Wirkung in Sekunden. 0 heisst: wirkt gerade nicht. */
export function boonLeft(state: GameState, sourceId: string): number {
  const boon = state.runtime.boons.find((entry) => entry.sourceId === sourceId)
  return boon ? Math.max(0, boon.left) : 0
}

// ---------------------------------------------------------------------------
// Versorgungskapseln (GDD 11 Abschnitt 8)
// ---------------------------------------------------------------------------

/**
 * Wie wahrscheinlich dieser Gegner eine Kapsel fallen laesst.
 *
 * Bosse **immer**, Elites deutlich haeufiger, alle anderen selten - genau die Staffelung
 * aus GDD 11 Abschnitt 2. Die Abfrage laeuft ueber Felder am Gegner, nicht ueber seine Art:
 * Ein neuer Elite-Modifikator veraendert diese Zeilen nicht.
 */
export function podChanceFor(enemy: Enemy, isBoss: boolean): number {
  if (isBoss) return POD_DROP_CHANCE_BOSS
  if (enemy.elite.length > 0) return POD_DROP_CHANCE_ELITE
  return POD_DROP_CHANCE
}

/**
 * Eine Kapsel ins Feld legen.
 *
 * Ist der Platz voll, weicht die **aelteste**: Kapseln verfallen nicht, also muss - wie bei
 * den Muenzen - die Zahl der Gegenstaende begrenzt bleiben. Die aelteste weicht und nicht
 * die neue, weil eine Kapsel, die gerade gefallen ist, noch im Blick des Spielers liegt.
 */
export function dropPod(state: GameState, pos: { x: number; y: number }, defId: string): Pod | null {
  if (!isKnownPod(defId)) return null

  const pods = state.run.pods
  const pod: Pod = {
    id: state.runtime.combat.nextId++,
    defId,
    x: pos.x,
    y: pos.y,
  }
  pods.push(pod)
  while (pods.length > MAX_PODS) pods.shift()

  markDirty(state)
  emit('pod.dropped', { defId, x: pod.x, y: pod.y })
  return pod
}

/**
 * Eine Kapselart fuer diese Welle wuerfeln. `null`, wenn es fuer die Welle noch keine gibt.
 */
export function rollPodKind(wave: number, rng: Rng): PodDef | null {
  const candidates = podsForWave(wave)
  if (candidates.length === 0) return null

  let total = 0
  for (const pod of candidates) total += pod.weight

  let roll = rng.range(0, total)
  for (const pod of candidates) {
    roll -= pod.weight
    if (roll <= 0) return pod
  }
  return candidates[candidates.length - 1] as PodDef
}

/**
 * Beim Tod eines Gegners wuerfeln, ob eine Kapsel faellt. Wird aus `killEnemy` gerufen -
 * der einen Stelle, an der ein Gegner stirbt.
 */
export function maybeDropPod(state: GameState, enemy: Enemy, isBoss: boolean): void {
  const chance = podChanceFor(enemy, isBoss)
  if (chance <= 0) return
  if (!state.runtime.rng.chance(chance)) return

  const kind = rollPodKind(state.run.wave, state.runtime.rng)
  if (!kind) return
  dropPod(state, enemy.pos, kind.id)
}

/**
 * Alle Kapseln aufheben, die im Umkreis dieses Punktes liegen.
 *
 * Gibt zurueck, wie viele es waren. Anders als Muenzen laufen Kapseln **einzeln** auf: Jede
 * ist ein eigener Fund, und eine Turmkapsel oeffnet ein Auswahlfenster, das nicht zweimal
 * zugleich aufgehen kann.
 */
export function collectPodsAt(
  state: GameState,
  pos: { x: number; y: number },
  radius = POD_COLLECT_RADIUS,
): number {
  const pods = state.run.pods
  if (pods.length === 0) return 0

  let taken = 0
  for (let i = pods.length - 1; i >= 0; i--) {
    const pod = pods[i] as Pod
    if (Math.hypot(pod.x - pos.x, pod.y - pos.y) > radius) continue
    pods.splice(i, 1)
    openPod(state, pod)
    taken += 1
  }
  return taken
}

/** Eine bestimmte Kapsel aufheben - fuer Klick und Selbsttest. */
export function collectPod(state: GameState, id: number): boolean {
  const index = state.run.pods.findIndex((pod) => pod.id === id)
  if (index < 0) return false

  const pod = state.run.pods[index] as Pod
  state.run.pods.splice(index, 1)
  openPod(state, pod)
  return true
}

/**
 * Den Inhalt einer Kapsel ausschuetten.
 *
 * Der Wert entsteht aus der Welle, auf der sie **eingesammelt** wird, nicht aus der, auf der
 * sie fiel. Sonst waere eine liegen gebliebene Kapsel eine Falle, und der Spieler muesste
 * jede sofort holen - genau das soll das freie Einsammeln nicht sein (GDD 08 Abschnitt 2).
 */
function openPod(state: GameState, pod: Pod): void {
  const def = podById(pod.defId)
  const effect = def.effect

  switch (effect.kind) {
    case 'gold':
      grantReward(state, { gold: effect.amount * eventRewardFor(state.run.wave) }, 'pod')
      break

    case 'xp':
      grantReward(state, { xp: effect.amount * eventRewardFor(state.run.wave) }, 'pod')
      break

    case 'upgrade':
      grantFreeUpgrade(state)
      break

    case 'tower':
      // Ein offenes Angebot wird nicht ueberschrieben - sonst verschwaende die Kapsel das,
      // was der Spieler eben bezahlt hat. Sie zahlt stattdessen in Gold aus.
      if (state.run.towerOffer.length > 0) {
        grantReward(state, { gold: 3 * eventRewardFor(state.run.wave) }, 'pod')
        break
      }
      state.run.towerOffer = rollTowerOffer(state, state.runtime.rng, undefined, effect.floor)
      break
  }

  markDirty(state)
  emit('pod.collected', { defId: pod.defId })
}

/**
 * Eine kostenlose Stufe auf einem Upgrade-Pfad (GDD 11 Abschnitt 8: "ein kostenloses
 * Upgrade").
 *
 * Gewuerfelt wird unter dem, was der Spieler gerade auch selbst kaufen koennte - die Auswahl
 * trifft `giftableUpgrades` (`data/upgrades.ts`), damit Kapsel und Haendler nicht zwei
 * verschiedene Vorstellungen davon haben. Sind alle voll, gibt es Gold: Eine Kapsel darf nie
 * leer aufgehen.
 */
function grantFreeUpgrade(state: GameState): void {
  const open = giftableUpgrades(state.run.upgrades)
  if (open.length === 0) {
    grantReward(state, { gold: 3 * eventRewardFor(state.run.wave) }, 'pod')
    return
  }

  const def = state.runtime.rng.pick(open)
  state.run.upgrades[def.id] = upgradeLevel(state.run.upgrades, def.id) + 1
  emit('upgrade.bought', { path: def.id, level: state.run.upgrades[def.id] as number, cost: 0 })
}

/** Fuer den Spielstand: eine gelesene Kapsel pruefen, statt ihr zu vertrauen. */
export function isValidPod(value: unknown): value is Pod {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  if (typeof entry['defId'] !== 'string' || !isKnownPod(entry['defId'])) return false
  for (const key of ['id', 'x', 'y']) {
    const number = entry[key]
    if (typeof number !== 'number' || !Number.isFinite(number)) return false
  }
  return true
}
