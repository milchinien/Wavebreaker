/**
 * Ereignisbus.
 *
 * Jedes bedeutsame Spielereignis wird gemeldet, auch wenn zunaechst niemand zuhoert
 * (Implementierungsplan Abschnitt 3). In E18 haengt sich der Klang daran - das ist dann
 * ein Anschluss, kein Umbau (GDD 13 Abschnitt 11).
 *
 * `EventMap` ist bewusst die einzige Stelle, an der die Ereignisnamen samt Nutzlast
 * stehen. Wer ein Ereignis meldet, das hier fehlt, bekommt einen Typfehler.
 */

/** Nutzlast einer Belohnung. `app/rewards.ts` leitet seinen `Reward`-Typ hiervon ab. */
export type RewardPayload = {
  gold?: number
  xp?: number
  prestigePoints?: number
}

export type EventMap = {
  'loop.speedChanged': { factor: 1 | 2 | 4 }
  'reward.granted': { reward: RewardPayload; source: string }
  'save.written': { bytes: number }
  'save.loaded': { fresh: boolean; version: number }
  'save.cleared': Record<string, never>
  'save.corrupt': { reason: string }
  'view.changed': { view: 'combat' | 'base' | 'upgrades' | 'prestige' | 'settings' }
  'module.placed': { uid: string; defId: string }
  'module.moved': { uid: string }
  /** `alsoDetached` sind die Module, die den Anschluss verloren haben und mitgewandert sind. */
  'module.removed': { uid: string; alsoDetached: number }

  'wave.started': { wave: number }
  'wave.cleared': { wave: number }
  /** Die Station ist gefallen. Dieselbe Welle beginnt erneut - kein Game Over. */
  'wave.lost': { wave: number; attempt: number }
  'station.damaged': { amount: number; remaining: number }
  'station.destroyed': { wave: number }
  /** Ein Modul hat geschossen. Jeder Schuss wird gemeldet - der Klang duennt sich selbst aus. */
  'tower.fired': { uid: string; defId: string; crit: boolean }
  /** `x`/`y` ist der Ort des Todes - der Klang soll spaeter von dort kommen koennen. */
  'enemy.killed': { defId: string; gold: number; xp: number; x: number; y: number }
  'gold.spent': { amount: number }
  'gold.collected': { amount: number }
  'upgrade.bought': { path: string; level: number; cost: number }
  'wave.autoModeChanged': { on: boolean }
  'boss.spawned': { wave: number }
  /** Der Boss dieser Welle ist gefallen - eigene Zaesur, nicht nur ein Gegner weniger. */
  'boss.killed': { wave: number }

  /** Eine Stufe ist erreicht. Wird je Stufe einmal gemeldet, auch wenn mehrere zugleich fallen. */
  'level.up': { level: number }
  /** Ein Perk wurde angenommen. `level` ist die Stufe, fuer die er gewaehlt wurde. */
  'perk.chosen': { perkId: string; level: number }
  /** Eine Faehigkeit wurde mit Gold freigeschaltet (GDD 09 Abschnitt 7). */
  'ability.unlocked': { id: string; cost: number }
  /** Eine Faehigkeit liegt jetzt auf einem Slot - oder wurde von ihm genommen. */
  'ability.equipped': { id: string; slot: number }
  /** Eine Faehigkeit wurde gezuendet. `x`/`y` ist der Ort, an dem sie wirkt. */
  'ability.activated': { id: string; x: number; y: number }
  /** Ihre Abklingzeit ist abgelaufen - sie steht wieder bereit. */
  'ability.ready': { id: string }

  /** Ein Turmangebot liegt vor. Bezahlt ist der **Wurf**, nicht der Turm (GDD 06 §1). */
  'tower.offered': { cost: number; count: number }
  'tower.bought': { defId: string; rarity: string; uid: string }
  /** Tuerme sind endgueltig eingeschmolzen - der Einsatz fuer ein kostenloses Angebot. */
  'tower.melted': { count: number }

  /** Ein Ereignis steht zur Entscheidung an (GDD 11 Abschnitt 3). */
  'event.triggered': { eventId: string; wave: number }
  /** Der Spieler hat gewaehlt. `choiceId` ist die genommene Option. */
  'event.resolved': { eventId: string; choiceId: string }
  /** Eine Versorgungskapsel liegt im Feld. `x`/`y` ist ihr Ort. */
  'pod.dropped': { defId: string; x: number; y: number }
  'pod.collected': { defId: string }

  /** Die Haendler-Drohne ist gelandet (GDD 11 Abschnitt 7). */
  'trader.arrived': { wave: number; count: number }
  /** Der Spieler hat sie erreicht - ab jetzt wartet sie. */
  'trader.opened': { count: number }
  'trader.bought': { defId: string; price: number }
  /** Sie fliegt weiter. `bought` ist, was sie losgeworden ist. */
  'trader.left': { bought: number }

  /** Ein einmaliger Hinweis wurde gezeigt und weggeklickt (GDD 14 Abschnitt 4a). */
  'hint.seen': { id: string }

  /**
   * Die Abwesenheit ist verrechnet (GDD 12 Abschnitt 5). `seconds` ist die angerechnete
   * Zeit, nicht die tatsaechlich verstrichene.
   */
  'offline.resolved': { seconds: number; gold: number; xp: number; waves: number }

  'prestige.spent': { amount: number }
  'prestige.nodeBought': { nodeId: string; cost: number }
  /** Der Run wurde zurueckgesetzt. `points` ist, was er eingebracht hat. */
  'prestige.done': { points: number; wave: number; coreId: string }
}

export type EventName = keyof EventMap
export type EventHandler<K extends EventName> = (payload: EventMap[K]) => void
export type Unsubscribe = () => void

type HandlerSet = Set<(payload: unknown) => void>

const handlers = new Map<EventName, HandlerSet>()

/**
 * Ein Fehler in einem Zuhoerer darf niemals das Bild anhalten. Er wird gemeldet und
 * der naechste Zuhoerer laeuft weiter. Tests koennen die Meldung umlenken.
 */
let reportError: (name: EventName, error: unknown) => void = (name, error) => {
  console.error(`[events] Zuhoerer fuer "${name}" ist gescheitert:`, error)
}

export function on<K extends EventName>(name: K, handler: EventHandler<K>): Unsubscribe {
  let set = handlers.get(name)
  if (!set) {
    set = new Set()
    handlers.set(name, set)
  }
  const erased = handler as (payload: unknown) => void
  set.add(erased)
  return () => {
    set.delete(erased)
  }
}

export function emit<K extends EventName>(name: K, payload: EventMap[K]): void {
  const set = handlers.get(name)
  if (!set || set.size === 0) return
  // Kopie: ein Zuhoerer darf sich waehrend der Zustellung abmelden.
  for (const handler of [...set]) {
    try {
      handler(payload)
    } catch (error) {
      reportError(name, error)
    }
  }
}

export function listenerCount(name: EventName): number {
  return handlers.get(name)?.size ?? 0
}

/** Alle Zuhoerer entfernen. Wird zwischen Selbsttests gebraucht. */
export function resetEvents(): void {
  handlers.clear()
}

/** Fehlerbehandlung umlenken - im Selbsttest, damit erwartete Fehler nicht die Konsole fluten. */
export function setEventErrorReporter(reporter: (name: EventName, error: unknown) => void): void {
  reportError = reporter
}
