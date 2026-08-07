# 14 — Progression und Freischaltungen

> **Neufassung vom 07.08.2026.** Das ursprüngliche Kapitel 14 ist beim PC-Reset am
> 05.08.2026 verloren gegangen und war in keinem Sitzungsverlauf erhalten.
>
> Dies ist deshalb **kein wiederhergestellter Text, sondern ein neu geschriebener.** Er
> erfindet nichts hinzu: Die Startwerte stammen aus `src/data/balance.ts`, die Hinweise aus
> `src/sim/hints.ts` und `src/data/strings.ts`, die Freischaltungen aus
> [10](10-prestige-system.md). Wo andere Kapitel oder Selbsttests auf einen Abschnitt dieses
> Dokuments verweisen, ist die Nummerierung so gewählt, dass die Verweise stimmen —
> insbesondere **§1 Startzustand**, **§3 Startwerte** und **§4a Die acht Hinweise**.

---

## 1. Startzustand

Ein neuer Spielstand beginnt mit einer **funktionsfähigen, aber kahlen Station**: einem Kern,
vier freien Turmplätzen und drei Türmen im Lager. Der Spieler kann sofort bauen, muss aber
nichts bauen — Welle 1 fällt auch mit dem Kern allein.

Diese Zusammenstellung ist keine Bequemlichkeit, sondern eine Lehrentscheidung. Sie zeigt in
den ersten Minuten alle drei Turmarten, die das Spiel unterscheidet:

| Starturm | Art | Was er dem Spieler zeigt |
|---|---|---|
| `autocannon` | Angriff, schnell | Feuerrate wirkt anders als Schaden |
| `cannon` | Angriff, schwer | ein langsamer Turm kann mehr leisten |
| `amplifier` | Verstärker | **ein Turm, der selbst nicht schießt** |

Der Verstärker ist bewusst von Anfang an dabei — siehe §4a.

Umgesetzt in `app/state.ts::createInitialState`.

## 2. Die ersten Minuten

| Zeit | Was der Spieler erlebt | Was er dabei lernt |
|---|---|---|
| 0:00 | Welle 1 läuft an, der Kern schießt von allein | Das Spiel läuft ohne mich weiter |
| 0:20 | erstes Gold liegt im Feld, Hinweis erscheint | Gold kommt nicht von allein zu mir |
| 0:40 | erstes Kern-Upgrade bezahlbar | Gold wird zu Stärke |
| 1:30 | erster Turmkauf bezahlbar | Es gibt eine zweite Verwendung für Gold |
| 2:00 | erster Turm angedockt | Wohin ich baue, ist eine Entscheidung |
| 3:00+ | Verstärker im Lager fällt auf | Nachbarschaft zählt |

Die Reihenfolge ist nicht erzählt, sondern **erzwungen durch Kosten**: Das erste Upgrade ist
billiger als der erste Turm, der erste Turm billiger als der zweite. Der Spieler läuft die
Lernkurve entlang, weil sie zugleich die günstigste Route ist.

## 3. Startwerte

Verbindlich, umgesetzt in `src/data/balance.ts`:

| Wert | Festlegung | Konstante |
|---|---|---|
| Kern | `sentinel` | `START_CORE_ID` |
| Türme im Lager | `autocannon`, `cannon`, `amplifier` | `START_TOWER_IDS` |
| Turmplätze (zusätzlich zum Kern) | 4 | `START_TOWER_SLOTS` |
| Fähigkeiten-Slots | 1 (höchstens 3) | `START_ABILITY_SLOTS`, `MAX_ABILITY_SLOTS` |
| Welle | 1 | `START_WAVE` |
| Gold | 0 | `START_GOLD` |
| Level | 1 | `START_LEVEL` |

**Gold beginnt bei 0.** Der Spieler bekommt kein Startkapital: Die erste Handlung des Spiels
soll das Einsammeln sein, nicht das Ausgeben.

## 4. Spielerführung

**Es gibt kein Tutorial.** Keine geführte Runde, keine gesperrten Knöpfe, keine
Zeigefinger-Pfeile. Das ist eine Festlegung, keine Auslassung
([13, Abschnitt 12](13-ui-und-visuelles-design.md), README „Rahmenentscheidungen").

Der Grund liegt in der Schleife: Ein Tutorial pausiert, und
[02, Abschnitt 6](02-kern-spielschleife-und-spielerfahrung.md) verlangt, dass nichts pausiert.
Ein Spiel, das zu 80 % von selbst läuft, kann seine Erklärung nicht in den Weg stellen.

Stattdessen: **einmalige Hinweise, die auffallen, aber nichts anhalten.**

Drei Regeln gelten für jeden davon:

1. **Er unterbricht nicht.** Kein Fenster, keine Pause, kein Abblenden. Er fällt nur auf.
2. **Er erscheint genau einmal** — beim ersten Erreichen seines Auslösers. Danach nie wieder.
3. **Er ist zurücksetzbar**, in den Einstellungen, für alle Hinweise gemeinsam.

Umgesetzt in `sim/hints.ts` (Auslöser und Merkzettel), `ui/hints.ts` (Anzeige) und
`ui/settings.ts` (Zurücksetzen). Gemerkt wird im **dauerhaften** Teil des Spielstands: Wer
prestigt, bekommt die Hinweise nicht noch einmal.

### 4a. Die acht Hinweise

In der Reihenfolge, in der sie normalerweise erscheinen. Der Auslöser ist eine Bedingung am
Spielzustand, kein Zeitpunkt — wer schneller spielt, sieht sie früher.

| # | Kennung | Auslöser | Was er sagt |
|---|---|---|---|
| 1 | `hint.collect` | erstes Gold liegt im Feld | Gold wird durch Darüberfahren eingesammelt |
| 2 | `hint.upgrade` | erstes Kern-Upgrade bezahlbar | Upgrades stehen im Menü darunter |
| 3 | `hint.buyTower` | Gold reicht für den ersten Turmkauf | Türme werden gekauft und angedockt |
| 4 | `hint.buff` | ein Verstärker liegt im Lager | **Verstärker wirken auf Nachbarn mit gemeinsamer Kante** |
| 5 | `hint.level` | Level 4 erreicht | Jedes Level bringt einen Perk zur Wahl |
| 6 | `hint.boss` | erster Boss im Feld | Der Boss hält lange, und die Welle läuft weiter |
| 7 | `hint.melt` | genug überzählige Türme im Lager | Drei Türme werden zu einem freien Zug |
| 8 | `hint.prestige` | Prestige erstmals möglich | Zurücksetzen macht dauerhaft stärker |

Die Texte selbst stehen in `data/strings.ts` unter denselben Kennungen — hier steht die
Auslösebedingung, dort der Wortlaut. Ein Spielertext gehört nie in ein Dokument und nie in
den Code ([16, Abschnitt 1](16-technische-umsetzung.md)).

**Hinweis 4 ist der wichtigste.** Der Zeitpunkt des Buff-Turms ist das **größte
Verständnisrisiko des Spiels**: Ein Verstärker sieht aus wie ein Turm, schießt aber nicht,
und wer ihn spät oder an den Rand baut, verschenkt seine Wirkung — anders als bei jedem
anderen Turm lässt sich das später nur durch Umbau heilen. Der Text muss deshalb den
**Zeitpunkt** ausdrücklich ansprechen („place them early and build around them") und nicht
nur die Wirkung beschreiben.

> Diese Anforderung ist als Selbsttest festgehalten: *„der Hinweis zum Buff-Turm nennt den
> Zeitpunkt"* in `selftest/suites/idle.ts`. Wer den Text ändert und den Zeitpunkt
> herausnimmt, bekommt einen roten Test.

Aus demselben Grund liegt der Verstärker schon im **Startlager** (§1): Der Hinweis kann nur
erscheinen, wenn es etwas zu erklären gibt.

## 5. Freischaltungs-Reihenfolge

Innerhalb eines Runs schaltet nichts frei — ein Run beginnt immer gleich (§3). **Alles
Dauerhafte kommt aus dem Prestige-Baum** ([10](10-prestige-system.md)). Das hält die
Startsituation vergleichbar und macht Fortschritt sichtbar: Was ein neuer Run anders kann als
der vorige, hat man bewusst gekauft.

Die Reihenfolge, in der ein Spieler die Äste üblicherweise öffnet:

| Reihenfolge | Ast | Warum zuerst |
|---|---|---|
| 1 | Wirtschaft (Gold) | wirkt sofort und in jedem Run |
| 2 | Turmplätze | mehr Bau heißt mehr Möglichkeiten |
| 3 | Tempo (×2) | verkürzt die Wiederholung |
| 4 | Seltenheiten | macht die Züge besser statt zahlreicher |
| 5 | Helfer, Technologien, Eigenschaften | Feinschliff und neue Turmarten |

Das ist eine **Beobachtung, keine Vorschrift**: Der Baum lässt jede Reihenfolge zu. Er sollte
so bepreist sein, dass diese Reihenfolge sich natürlich ergibt, ohne die anderen zu
bestrafen.

## 6. Spielphasen

| Phase | Zeitraum | Woran der Spieler arbeitet | Woran er scheitert |
|---|---|---|---|
| **Erste Stunde** | bis zum ersten Prestige | „Wie funktioniert das?" | an der Gegnerkurve, unvorbereitet |
| **Aufbau** | Prestige 1 – 10 | Wirtschaft und Turmplätze | an fehlenden dauerhaften Werten |
| **Feinbau** | Prestige 10 – 30 | Seltenheiten, Eigenschaften, Bauformen | an der Bauform, nicht an den Zahlen |
| **Endspiel** | danach | Spezialtürme, Synergien, Rekorde | an sich selbst |

Der Übergang von „an den Zahlen scheitern" zu „an der Bauform scheitern" ist der Punkt, an
dem WAVEBREAKER aufhört, ein Idle-Spiel zu sein, und anfängt, ein Aufbauspiel zu werden. Er
sollte früh genug kommen, dass der Spieler ihn erreicht — und spät genug, dass er die Regeln
bis dahin kennt.

## 7. Was diese Progression nicht verträgt

- **Freischaltungen innerhalb eines Runs.** Sie machen die Startsituation unvergleichbar und
  nehmen dem Prestige-Baum seine Aufgabe.
- **Hinweise, die pausieren.** Siehe §4 — das bricht die Schleife.
- **Ein Startkapital.** Es nimmt der ersten Handlung ihren Sinn.
- **Ein neunter Hinweis für jede Kleinigkeit.** Acht sind eine Liste, zwanzig sind ein
  Tutorial durch die Hintertür.
