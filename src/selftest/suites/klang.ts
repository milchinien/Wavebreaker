/**
 * Der Klang, soweit er sich ohne Ohr pruefen laesst.
 *
 * **Was hier geprueft wird.** Nicht, wie es klingt - das entscheidet niemand in einem Test.
 * Geprueft wird, ob ueberhaupt etwas klingt, wie oft es hoechstens kommt und in welchem
 * Verhaeltnis die Pegel zueinander stehen. Das sind die drei Fehler, die man einem Spiel
 * anhoert, ohne sie benennen zu koennen: Eine Handlung bleibt stumm, ein Klang wird zur
 * Belaestigung, und die Quittung ist lauter als der Augenblick, den sie quittiert.
 *
 * **Warum das ohne Browser geht.** Der Klangplan (`app/soundplan.ts`) ist eine Tabelle und
 * haengt sich mit derselben Schleife an den Ereignisbus, die auch `app/audio.ts` benutzt -
 * nur dass hier statt eines Tons ein Strich auf einem Zettel entsteht. Die gemessene
 * Abdeckung ist damit die wirkliche und nicht eine nachgebaute.
 *
 * **Was hier nicht geprueft wird.** Der Klangapparat selbst: `AudioContext`, Aufnahmen,
 * Stimmenzahl. Den gibt es nur im Browser, und was sich dort messen laesst - Spitzenpegel,
 * Uebersteuerung -, misst `public/klangmessung.html` mit einem `OfflineAudioContext`.
 */

import { assert, assertEqual, check, suite } from '../../core/assert.ts'
import {
  emit,
  EVENT_NAMES,
  listenerCount,
  type EventMap,
  type EventName,
} from '../../core/events.ts'
import {
  attachCues,
  busOfCue,
  createGate,
  LOUDNESS,
  plannedEventCount,
  SAMPLES,
  SILENT_EVENTS,
  SOUND_PLAN,
  THROTTLE,
  toneOf,
  type SoundCue,
} from '../../app/soundplan.ts'

/**
 * So viele Ereignisse muessen mindestens zu hoeren sein.
 *
 * Die Zahl ist kein Wunsch, sondern der Stand nach dem Aufraeumen minus einem Puffer: Wer
 * kuenftig ein Ereignis stumm stellt, soll das begruenden muessen und nicht nur tun
 * koennen. Vorher hatten von sechsundvierzig Ereignissen zwanzig einen Zuhoerer.
 */
const MINIMUM_COVERED = 38

/**
 * Alle Klaenge des Plans, auch die von der Nutzlast abhaengigen.
 *
 * Der kritische Schuss ist der einzige Fall, in dem ein Ereignis zwei Klaenge hat - eine
 * Liste, die ihn auslaesst, prueft die Haelfte der Schuesse nicht.
 */
function allCues(): { name: EventName; cue: SoundCue }[] {
  const found: { name: EventName; cue: SoundCue }[] = []
  for (const [name, entry] of Object.entries(SOUND_PLAN) as [
    EventName,
    SoundCue | ((payload: unknown) => SoundCue),
  ][]) {
    if (typeof entry !== 'function') {
      found.push({ name, cue: entry })
      continue
    }
    const shot = entry({ uid: 'x', defId: 'x', crit: false } satisfies EventMap['tower.fired'])
    const crit = entry({ uid: 'x', defId: 'x', crit: true } satisfies EventMap['tower.fired'])
    found.push({ name, cue: shot }, { name, cue: crit })
  }
  return found
}

export function klangSuite(): void {
  suite('app/soundplan')

  check('jedes Ereignis ist entschieden - Klang oder begruendete Stille', () => {
    // Der eigentliche Ertrag: Vorher war stumm, woran niemand gedacht hatte. Jetzt ist
    // stumm, was stumm sein soll - und jedes davon mit einem Satz daneben.
    const planned = new Set<string>(Object.keys(SOUND_PLAN))
    const silent = new Map<string, string>(Object.entries(SILENT_EVENTS))
    const undecided: string[] = []
    const both: string[] = []

    for (const name of EVENT_NAMES) {
      const hasSound = planned.has(name)
      const isSilent = silent.has(name)
      if (!hasSound && !isSilent) undecided.push(name)
      if (hasSound && isSilent) both.push(name)
    }

    assertEqual(undecided.join(', '), '', 'ohne Entscheidung')
    assertEqual(both.join(', '), '', 'klingt und schweigt zugleich')

    // Eine Begruendung ist ein Satz, kein Wort. Wer "spaeter" schreibt, hat nichts begruendet.
    for (const [name, reason] of silent) {
      assert(reason.length >= 40, `die Begruendung fuer ${name} ist keine: "${reason}"`)
    }
  })

  check('die Abdeckung ist gezaehlt und liegt ueber der Untergrenze', () => {
    const covered = plannedEventCount()
    const silent = Object.keys(SILENT_EVENTS).length
    // Die Zahl steht hier ausdruecklich als Zahl: Sie ist die Messlatte dieses Stuecks.
    assertEqual(covered + silent, EVENT_NAMES.length, 'Klang plus Stille ergibt nicht alle')
    assert(
      covered >= MINIMUM_COVERED,
      `nur ${covered} von ${EVENT_NAMES.length} Ereignissen klingen, gefordert sind ${MINIMUM_COVERED}`,
    )
  })

  check('der Plan haengt wirklich am Bus - gezaehlt an den Zuhoerern', () => {
    // Nicht die Tabelle wird gezaehlt, sondern was nach dem Anmelden am Bus haengt. Genau
    // dieselbe Schleife laeuft in `app/audio.ts`; eine Abweichung kann es nicht geben.
    const before = new Map<EventName, number>()
    for (const name of EVENT_NAMES) before.set(name, listenerCount(name))

    const stops = attachCues(() => {})
    try {
      let covered = 0
      const missing: string[] = []
      for (const name of EVENT_NAMES) {
        const added = listenerCount(name) - (before.get(name) ?? 0)
        if (added > 0) covered += 1
        else if (!(name in SILENT_EVENTS)) missing.push(name)
        // Genau ein Zuhoerer je Ereignis - zwei waeren jeder Ton doppelt.
        assert(added <= 1, `${name} hat ${added} Zuhoerer bekommen`)
      }
      assertEqual(missing.join(', '), '', 'geplant, aber nicht angemeldet')
      assertEqual(covered, plannedEventCount(), 'Zuhoerer und Plan zaehlen verschieden')
      assert(covered >= MINIMUM_COVERED, `nur ${covered} Ereignisse haben einen Zuhoerer`)
    } finally {
      for (const stop of stops) stop()
    }
  })

  check('das Abhaengen laesst keinen Zuhoerer stehen', () => {
    // Ein Zuhoerer, der einen Klangapparat ueberlebt, spielt in einen geschlossenen Kontext.
    const before = EVENT_NAMES.map((name) => listenerCount(name))
    const stops = attachCues(() => {})
    for (const stop of stops) stop()
    EVENT_NAMES.forEach((name, index) => {
      assertEqual(listenerCount(name), before[index] ?? 0, name)
    })
  })

  check('kein Klang ohne Aufnahme, ohne Sperre und ohne Ersatzton', () => {
    for (const { name, cue } of allCues()) {
      assert(SAMPLES[cue.sample] !== undefined, `${name}: die Aufnahme "${cue.sample}" gibt es nicht`)
      assert((SAMPLES[cue.sample] ?? 0) >= 1, `${name}: "${cue.sample}" hat keine Variante`)
      // Ohne Sperre kommt der Klang so oft, wie das Ereignis faellt - und Ereignisse fallen
      // in Buendeln. Das ist der Unterschied zwischen Klang und Belaestigung.
      assert((THROTTLE[cue.kind] ?? 0) > 0, `${name}: die Klangart "${cue.kind}" hat keine Sperre`)
      assert(cue.gain > 0 && cue.gain <= 0.7, `${name}: Pegel ${cue.gain} ist ausserhalb`)
      // Ohne gemessene Lautheit ist der Pegel eine Zahl ohne Massstab: Die Aufnahmen sind
      // alle auf dieselbe Spitze ausgesteuert, also sagt `gain` fuer sich genommen nicht,
      // wie laut der Klang ankommt.
      assert(
        LOUDNESS[cue.sample] !== undefined,
        `${name}: fuer "${cue.sample}" ist keine Lautheit gemessen - ` +
          `node tools/klang-messen.mjs --schreiben`,
      )
      // Der Ersatzton haengt am selben Regler wie die Aufnahme, die er vertritt.
      const spec = toneOf(cue)
      assert(spec.seconds > 0 && spec.peak > 0, `${name}: kein brauchbarer Ersatzton`)
    }
  })

  check('die Quittung bleibt leiser als das, was sie quittiert', () => {
    // **Gerechnet wird `gain` mal Lautheit - und das ist der ganze Unterschied.**
    //
    // Der Klangbauplan steuert jede Aufnahme auf dieselbe Spitze aus: 0,89, alle
    // sechsundfuenfzig. Ein Vergleich zweier `gain`-Werte vergleicht deshalb zwei Zahlen,
    // die mit derselben Konstanten multipliziert werden - er kann diese Regel gar nicht
    // pruefen. Er hat sie jahrelang gruen gemeldet, waehrend der Abflug der Drohne
    // (`depart`, 1,40 s, gain 0,34) zwei Dezibel ueber dem Stufenaufstieg lag
    // (`level`, gain 0,50), den keine Quittung uebertoenen darf: gleiche Spitze, doppelte
    // Lautheit. Erst `LOUDNESS` macht die Zusage messbar.
    const cues = allCues()
    const heard = (cue: SoundCue): number => {
      const loud = LOUDNESS[cue.sample]
      assert(loud !== undefined, `fuer "${cue.sample}" ist keine Lautheit gemessen`)
      return cue.gain * (loud ?? 0)
    }
    /** Was der Spieler von einer Aufnahme hoert, unabhaengig davon, wer sie ausloest. */
    const of = (sample: string): number => {
      const found = cues.find((entry) => entry.cue.sample === sample)
      assert(found !== undefined, `im Plan kommt "${sample}" nicht vor`)
      return found ? heard(found.cue) : Number.NaN
    }
    const dB = (value: number): string => `${(20 * Math.log10(value)).toFixed(1)} dB`

    let loudestUi = 0
    let loudestUiName = ''
    let quietestMusic = Number.POSITIVE_INFINITY
    let quietestMusicName = ''
    for (const { cue } of cues) {
      const bus = busOfCue(cue)
      const level = heard(cue)
      if (bus === 'ui' && level > loudestUi) {
        loudestUi = level
        loudestUiName = cue.sample
      }
      if (bus === 'music' && level < quietestMusic) {
        quietestMusic = level
        quietestMusicName = cue.sample
      }
    }

    // 1. Keine Quittung uebertoent die leiseste Zaesur.
    assert(
      loudestUi < quietestMusic,
      `lauteste Quittung "${loudestUiName}" ${dB(loudestUi)}, ` +
        `leiseste Zaesur "${quietestMusicName}" ${dB(quietestMusic)}`,
    )
    // 2. Die Muenze ist leiser als der Abschuss, der sie fallen liess.
    assert(of('coin') <= of('kill'), `Muenze ${dB(of('coin'))}, Abschuss ${dB(of('kill'))}`)
    // 3. Der Schuss ist leiser als das, was er erreicht.
    assert(of('shot') <= of('kill'), `Schuss ${dB(of('shot'))}, Abschuss ${dB(of('kill'))}`)
  })

  check('der Perk begleitet den Stufenaufstieg - unter ihm, aber in Hoerweite', () => {
    // Die Perkwahl ist die einzige Quittung, die *im selben Augenblick* faellt wie die
    // Zaesur, die sie quittiert: `level.up` oeffnet die Auswahl, `perk.chosen` schliesst
    // sie. Deshalb ist sie die einzige, fuer die eine Untergrenze Sinn ergibt - eine
    // Quittung, die vierzig Dezibel unter dem Augenblick liegt, ist keine Quittung mehr,
    // sondern ein Versehen. Genau dort stand sie: `pick` ist die zweitleiseste Aufnahme des
    // Satzes (-24,8 dB), und mit gain 0,40 lag die Wahl 8,6 dB unter dem Aufstieg.
    const perk = SOUND_PLAN['perk.chosen']
    const level = SOUND_PLAN['level.up']
    const heardPerk = perk.gain * (LOUDNESS[perk.sample] ?? 0)
    const heardLevel = level.gain * (LOUDNESS[level.sample] ?? 0)
    const gap = 20 * Math.log10(heardLevel / heardPerk)
    assert(gap > 0, `die Perkwahl ist ${(-gap).toFixed(1)} dB lauter als der Aufstieg`)
    assert(gap <= 6, `die Perkwahl liegt ${gap.toFixed(1)} dB unter dem Aufstieg, erlaubt sind 6`)
  })

  check('der weggeklickte Hinweis bleibt der leiseste Klang des Spiels', () => {
    // Der Klangplan sagt es woertlich ueber `hint.seen`: "Der leiseste Klang im Spiel."
    // Ohne diesen Test ist das eine Behauptung im Kommentar. Mit ihm ist es eine Zusage,
    // die beim ersten Griff an die Aufnahme bricht: Wer `hint.seen` auf `depart` legt,
    // laesst denselben `gain` von 0,16 um 10,3 dB lauter werden - der Vergleich zweier
    // `gain`-Werte sieht davon nichts, der Vergleich zweier Lautheiten sofort.
    const hint = SOUND_PLAN['hint.seen']
    const heardHint = hint.gain * (LOUDNESS[hint.sample] ?? 0)
    for (const { name, cue } of allCues()) {
      if (name === 'hint.seen') continue
      const level = cue.gain * (LOUDNESS[cue.sample] ?? 0)
      assert(
        heardHint < level,
        `der Hinweis (${(20 * Math.log10(heardHint)).toFixed(1)} dB) ist nicht leiser als ` +
          `${name} (${(20 * Math.log10(level)).toFixed(1)} dB)`,
      )
    }
  })

  check('jede Aufnahme des Satzes ist gemessen, nicht nur die benutzten', () => {
    // `SAMPLES` und `LOUDNESS` muessen dieselbe Liste sein. Waeren sie es nicht, koennte ein
    // neuer Klang eingebaut werden, ohne dass je jemand gemessen haette, wie laut er ist -
    // und der Pegel daneben waere wieder geraten.
    const gemessen = Object.keys(LOUDNESS).sort().join(', ')
    const vorhanden = Object.keys(SAMPLES).sort().join(', ')
    assertEqual(gemessen, vorhanden, 'gemessene und vorhandene Aufnahmen')
    for (const [name, value] of Object.entries(LOUDNESS)) {
      assert(value > 0 && value < 1, `${name}: Lautheit ${value} ist keine`)
    }
  })

  check('was denselben Augenblick meldet, teilt sich die Sperre', () => {
    // Der Fall der Station und der Verlust der Welle laufen im selben Takt (`sim/battle.ts`).
    // Zwei Sperren hiessen: zwei Explosionen uebereinander.
    const plan = SOUND_PLAN
    assertEqual(plan['station.destroyed'].kind, plan['wave.lost'].kind, 'Zusammenbruch')
    // Schuss und kritischer Schuss sind derselbe Vorgang.
    const shot = plan['tower.fired']({ uid: 'x', defId: 'x', crit: false })
    const crit = plan['tower.fired']({ uid: 'x', defId: 'x', crit: true })
    assertEqual(shot.kind, crit.kind, 'Schuss')
    assert(shot.sample !== crit.sample, 'kritischer Schuss klingt wie ein gewoehnlicher')
  })

  suite('app/soundplan: Wiederholsperre')

  check('hundert schnelle Ereignisse ergeben vierzehn Toene', () => {
    // Die Messung, an der die Zusage haengt: hundert Meldungen in einer Sekunde - so kommen
    // Schuesse bei Tempo x4 - gegen eine Sperre von 0,07 s.
    const gate = createGate()
    const gap = THROTTLE['shot'] ?? 0
    let played = 0
    for (let i = 0; i < 100; i++) {
      if (gate.allow('shot', i * 0.01)) played += 1
    }

    // Der erste kommt immer, danach hoechstens einer je Sperrenlaenge - rechnerisch also
    // fuenfzehn. Gemessen sind es vierzehn, und das ist kein Fehler, sondern das Raster:
    // Die Meldungen sitzen auf Zehnteln einer Zehntelsekunde, die Sperre ist sieben davon
    // lang, und wo beides nicht aufgeht, wartet der Klang bis zur naechsten Meldung. Die
    // Sperre gibt eine Obergrenze, keine Taktvorgabe.
    assert(played <= Math.floor(0.99 / gap) + 1, `${played} Toene, rechnerisch hoechstens 15`)
    assertEqual(played, 14, 'durchgelassene Schuesse')
    assert(played < 100, 'die Sperre hat gar nichts gehalten')
  })

  check('jede Klangart haelt ihre eigene Sperre ein, auch im Gedraenge', () => {
    // Alle Arten gleichzeitig, hundert Runden lang - eine Art darf keiner anderen den Platz
    // wegnehmen, und keine darf enger kommen als ihre eigene Zahl.
    const gate = createGate()
    const kinds = Object.keys(THROTTLE)
    const lastPlayed = new Map<string, number>()
    const counts = new Map<string, number>()

    for (let i = 0; i < 100; i++) {
      const now = i * 0.01
      for (const kind of kinds) {
        if (!gate.allow(kind, now)) continue
        const previous = lastPlayed.get(kind)
        if (previous !== undefined) {
          const gap = THROTTLE[kind] ?? 0
          assert(
            now - previous >= gap - 1e-9,
            `${kind}: ${(now - previous).toFixed(3)}s Abstand, erlaubt sind ${gap}s`,
          )
        }
        lastPlayed.set(kind, now)
        counts.set(kind, (counts.get(kind) ?? 0) + 1)
      }
    }

    for (const kind of kinds) {
      const gap = THROTTLE[kind] ?? 0
      const most = Math.floor(0.99 / gap) + 1
      assert((counts.get(kind) ?? 0) <= most, `${kind} kam ${counts.get(kind)}-mal statt ${most}-mal`)
    }
  })

  check('hundert schnelle Ereignisse am echten Bus ergeben dieselben vierzehn', () => {
    // Dieselbe Messung eine Ebene hoeher: nicht die Sperre allein, sondern der ganze Weg -
    // Ereignis, Plan, Sperre. Die Uhr ist gestellt, weil im Test niemand wartet.
    const gate = createGate()
    let now = 0
    let played = 0
    const stops = attachCues((cue) => {
      if (gate.allow(cue.kind, now)) played += 1
    })
    try {
      for (let i = 0; i < 100; i++) {
        now = i * 0.01
        emit('tower.fired', { uid: 'a', defId: 'autocannon', crit: i % 5 === 0 })
      }
    } finally {
      for (const stop of stops) stop()
    }
    // Dieselbe Zahl wie in der Messung darueber: Der Weg ueber den Bus aendert nichts an
    // der Sperre - und der kritische Schuss, jeder fuenfte, kommt nicht zusaetzlich durch.
    assertEqual(played, 14, 'Schuesse in einer Sekunde')
  })

  check('der kritische Schuss reisst keine zweite Sperre auf', () => {
    // Bei hoher Kritchance liesse eine eigene Sperre fuer den kritischen Schuss doppelt so
    // viel durch wie gewollt. Deshalb hier die Gegenprobe: nur Krits, gleiche Zahl.
    const gate = createGate()
    let now = 0
    let played = 0
    const stops = attachCues((cue) => {
      if (gate.allow(cue.kind, now)) played += 1
    })
    try {
      for (let i = 0; i < 100; i++) {
        now = i * 0.01
        emit('tower.fired', { uid: 'a', defId: 'autocannon', crit: true })
      }
    } finally {
      for (const stop of stops) stop()
    }
    assertEqual(played, 14, 'kritische Schuesse in einer Sekunde')
  })
}
