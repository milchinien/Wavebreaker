# 10 – Prestige-System

> Teil 10 von 16 der Game-Design-Dokumentation.

---

## 1. Ziel des Prestige-Systems

Prestige ist der wichtigste langfristige Fortschrittsmechanismus.

Ohne Prestige würde das Spiel irgendwann nur noch aus höheren Zahlen bestehen. Prestige sorgt dafür, dass jeder Reset einen Sinn hat, neue Systeme freischaltet und neue Spielweisen eröffnet.

**Prestige soll niemals wie ein Verlust wirken.** Der Spieler gibt kurzfristigen Fortschritt auf, um langfristig stärker zu werden:

> "Ich verliere meinen aktuellen Aufbau, aber ich komme stärker zurück."

---

## 2. Prestige-Währung

**Prestige-Punkte** sind dauerhaft und werden niemals zurückgesetzt.

---

## 3. Voraussetzung und Ablauf

**Voraussetzung:** mindestens **1.000 gesammeltes Gold**.

Der Spieler kann jederzeit freiwillig länger spielen — je mehr Fortschritt, desto höher die Belohnung.

```
Prestige auswählen
        ↓
Bestätigungsfenster: erhaltene Punkte, zurückgesetzte Inhalte, dauerhafte Boni
        ↓
Bestätigen
        ↓
Run wird zurückgesetzt
        ↓
Hauptturm für den nächsten Run wählen
```

> Nicht eingesammeltes Gold auf dem Spielfeld verfällt beim Prestige mit. Das Bestätigungsfenster weist darauf hin, wenn noch nennenswerte Mengen herumliegen — damit niemand versehentlich Ertrag verschenkt.

---

## 4. Was zurückgesetzt wird — und was bleibt

| Zurückgesetzt | Bleibt erhalten |
|---|---|
| aktuelle Welle **und der Wellenrekord** (Start bei Welle 1, Skip-Grenze zurückgesetzt → [07, Abschnitt 10](07-gegner-bosse-und-wellen.md)) | Prestige-Punkte |
| Gold — auch nicht eingesammelte Münzen auf dem Spielfeld | Prestige-Baum-Upgrades |
| alle Türme (platziert und im Inventar) | freigeschaltete Raritäten |
| normale Upgrades und Turm-Upgrades | freigeschaltete Spezialtürme |
| Spielerlevel und XP | freigeschaltete Haupttürme |
| Level-Perks | freigeschaltete Eigenschaften |
| Fähigkeiten | freigeschaltete Helfer und Systeme |

---

## 5. Prestige-Punkte-Berechnung

Die Belohnung basiert auf:

- höchster erreichter Welle
- insgesamt gesammeltem Gold
- besiegten Bossen
- allgemeinem Run-Fortschritt

Richtwerte:

| Erreichte Welle | Prestige-Punkte |
|---|---|
| 100 | 5–10 |
| 500 | ~125 |
| 1.000 | 500 |
| 2.000 | 500+ |
| 10.000 | massive Belohnung |

> Die exakte Formel ist ein Balancing-Wert. Grundprinzip: je weiter der Spieler kommt, desto überproportional mehr Punkte.

**Die 500er-Zeile stand bis zur Messung auf 50–100 und war unerfüllbar.** Die drei mittleren
Zeilen sind untereinander unvereinbar: Der Sprung von 500 auf 1.000 verlangt einen Exponenten
zwischen 2,32 und 3,32, der Sprung von 100 auf 500 einen zwischen 1,00 und 1,86 — die beiden
Bereiche überschneiden sich nicht, **kein Potenzgesetz trifft alle drei**. Eine Parabel durch
(100 → 5) und (1.000 → 500) muss bei Welle 500 auf rund 125 kommen; das ist keine Abweichung
der Formel, sondern ihre Folge.

Korrigiert wurde deshalb die Zeile und nicht die Formel. Die beiden Alternativen sind gemessen
und verworfen: Eine auf 50–100 geeichte Parabel verfehlt **beide** anderen Zeilen (Welle 100
gibt 3, Welle 1.000 gibt 300). Eine Kurve mit steigendem Exponent trifft alle drei, ist bei
Welle 100 aber mit Exponent 0,52 *unter*proportional — das Gegenteil des Grundprinzips —, und
bei Welle 10.000 kauft ein einziger Lauf den ganzen Prestige-Baum 170-mal.

Der Stand der umgesetzten Formel ist bei `prestigePoints` in `src/sim/prestige.ts` notiert und
wird von einer Regel in `src/selftest/guards.ts` gegen diese Tabelle gehalten.

---

## 6. Der Prestige-Baum

Der Baum besteht aus verbundenen Knoten mit Symbol, Name, Kosten und Status (gesperrt / verfügbar / gekauft) und ist in acht Bereiche unterteilt.

**Zu den Kosten.** Die Tabellen der folgenden Bereiche nennen sechzehn Knoten, und keiner davon
kostet mehr als 500. Die übrigen vierzehn — die tieferen Glieder jeder Kette — nennt dieses
Dokument nicht; sie sind Fortschreibungen der Umsetzung. Für sie gilt seit der Messung eine
Regel, die in `src/data/prestige.ts` steht und in `src/selftest/suites/prestige.ts` geprüft wird:

- Ein Kettenglied kostet über 500 ungefähr **das Doppelte** seines Vorgängers, nicht das Vier-
  bis Fünffache. Vorher lief die Reihe auf 25.000 Punkte hinaus — das entspricht Welle 7.116,
  also dem Doppelten dessen, wofür das Spiel je eine Zahl erhoben hat.
- **Kein Knoten kostet mehr als zwei Läufe auf Welle 2.000** — der tiefsten Welle, zu der
  [Abschnitt 5](#5-prestige-punkte-berechnung) noch eine Zahl nennt.
- Ein Knoten ist **teurer als jeder, den er voraussetzt.** Sonst wäre die Voraussetzung totes
  Kapital: gekauft nur, um an den billigeren Knoten dahinter zu kommen.

Der Baum kostet damit zusammen **21.000** Punkte statt 81.550, und die vier teuersten Knoten
tragen 40 Prozent davon statt 62.

---

### Bereich 1 – Wirtschaft

| Upgrade | Kosten | Effekt |
|---|---|---|
| Goldverstärkung | 10 | +10 % Gold von Gegnern |
| Erweiterte Wirtschaft | 50 | +25 % Gold |
| Offline-Produktion | 100 | schaltet Offline-Fortschritt frei |
| Reichtumssystem | 250 | +50 % Gold |
| Verbesserte Simulation | 500 | höhere Offline-Effizienz |

Weitere Ziele dieses Bereichs: mehr XP, bessere Gold-Drops, bessere Versorgungskapseln.

---

### Bereich 2 – Türme

| Upgrade | Kosten | Effekt |
|---|---|---|
| Zusätzlicher Turmplatz | 100 | +1 maximaler Turmplatz (Start: 1) |
| Fähigkeiten-Slot II | 400 | schaltet den 2. Fähigkeiten-Slot frei |
| Fähigkeiten-Slot III | 2.000 | schaltet den 3. und letzten Fähigkeiten-Slot frei |
| Erweiterte Auswahl | 250 | bessere Optionen beim Turmkauf |
| Meisterhafte Konstruktion | 1.000 | höhere Chance auf besondere Türme |

---

### Bereich 2b – Spielgeschwindigkeit

Das Spiel startet mit fester Geschwindigkeit (×1). Höhere Stufen werden im Prestige-Baum freigeschaltet und lassen sich danach jederzeit umschalten.

| Upgrade | Kosten (Richtwert) | Effekt |
|---|---|---|
| Beschleunigung I | 300 | schaltet ×2 frei |
| Beschleunigung II | 3.000 | schaltet ×4 frei |

Das ist eine der befriedigendsten Freischaltungen des Spiels: Späte Wellen fühlen sich bei ×1 zäh an, und der Sprung auf ×2 verändert das Spieltempo sofort spürbar.

**Wichtig für die Umsetzung:** Die Geschwindigkeit skaliert die Simulationszeit, nicht die Erträge — ×2 bedeutet doppelt so schnell, nicht doppelt so viel Gold pro Gegner. Die Simulation muss bei hohen Faktoren stabil bleiben (feste Zeitschritte, kein Frame-abhängiges Rechnen) → [16](16-technische-umsetzung.md).

---

### Bereich 3 – Raritäten

| Freischaltung | Kosten | Farbe |
|---|---|---|
| Rare | 50 | Grün |
| Epic | 250 | Blau |
| Legendary | 1.000 | Gold |
| Mythic | 5.000 | Rot |

Ohne diese Upgrades können die entsprechenden Raritäten nicht erscheinen.
→ [06 – Turmerwerb, Inventar und Raritäten](06-turmerwerb-inventar-raritaeten.md)

---

### Bereich 4 – Spezialtürme

| Technologie | Kosten | Schaltet frei |
|---|---|---|
| Raketen-Technologie | 150 | Raketen-Turm |
| Laser-Technologie | 250 | Laser-Turm |
| Tesla-Technologie | 500 | Tesla-Turm |
| Drohnen-Technologie | 2.000 | Drohnen-Modul |
| Plasma-Technologie | 10.000 | Plasma-Turm |

Diese Türme erscheinen erst nach Freischaltung im normalen Turmkauf.

---

### Bereich 5 – Haupttürme

| Kern | Kosten |
|---|---|
| Vulcan Core | 500 |
| Rail Core | 1.000 |
| Prism Core | 2.500 |
| Tesla Core | 5.000 |
| Fortress Core | 7.500 |
| Drone Core | 15.000 |

Inferno Core und Plasma Core folgen im späten Baum.
→ [04 – Hauptturm-System](04-hauptturm-system.md)

---

### Bereich 6 – Turm-Eigenschaften

| Freischaltung | Kosten | Effekt |
|---|---|---|
| Rare Eigenschaften | 200 | Rare Modifikatoren möglich |
| Epic Eigenschaften | 1.000 | stärkere Effekte |
| Legendary Eigenschaften | 5.000 | besondere Mechaniken |
| Mythic Eigenschaften | 25.000 | einzigartige Turmveränderungen |

---

### Bereich 7 – Helfer

| Upgrade | Kosten | Effekt |
|---|---|---|
| Gold-Sammler | 500 | Helfer wird kaufbar |
| Verbesserter Sammler | 2.000 | größerer Sammelradius |
| Schneller Sammler | 5.000 | höhere Laufgeschwindigkeit |
| Elite-Sammler | 15.000 | sammelt automatisch größere Bereiche |

**Wichtig:** Freischalten aktiviert den Helfer nicht.

```
Prestige-Baum: Helfer freischalten → Upgrade-Menü: Helfer kaufen → Helfer aktiv → Helfer verbessern
```

→ [12 – Offline-Fortschritt und Helfer](12-offline-fortschritt-und-helfer.md)

---

### Bereich 8 – Basisverbesserungen

| Upgrade | Effekt |
|---|---|
| Erweiterte Basis | mehr Platz für Module |
| Verbesserte Energieversorgung | mehr aktive Turmkapazität |
| Verstärkte Verbindung | bessere Unterstützungssysteme |

---

## 7. Kostenstufen im Überblick

| Phase | Größenordnung |
|---|---|
| frühe Upgrades | 10–100 Punkte |
| mittlere Upgrades | 100–1.000 Punkte |
| Endgame-Upgrades | 5.000–100.000 Punkte |

---

## 8. Prestige-Strategie

Der Spieler muss priorisieren:

| Weg | Wirkung |
|---|---|
| Wirtschaft zuerst | schnellere Runs, schnellere Folge-Prestiges |
| Spezialtürme zuerst | stärkere und andersartige Builds |
| Raritäten zuerst | bessere Türme pro Kauf |

Dadurch entstehen unterschiedliche Prestige-Wege statt einer optimalen Reihenfolge.

---

## 9. Beispielhafter Fortschritt

| Prestige | Freischaltung |
|---|---|
| 1 | neue Raritäten, mehr Gold |
| 5 | Spezialtürme, bessere Eigenschaften |
| 10 | neue Haupttürme |

---

## 10. Designprinzip

**Prestige soll nicht nur Zahlen erhöhen.** Jede größere Freischaltung soll neue Entscheidungen ermöglichen:

- neuer Hauptturm → anderer Spielstil
- neue Rarität → andere Jagd nach Türmen
- neue Spezialtechnologie → andere Builds

---

## 11. Langzeit-Ziel

Nach vielen Prestiges sollen zwei Spieler völlig unterschiedliche Kampfstationen besitzen:

| Spieler | Aufbau |
|---|---|
| A | Vulcan Core, viele Maschinengewehre, Angriffstempo-Build |
| B | Fortress Core, Schildtürme, Kanonen-Build |
| C | Prism Core, Laser und Spezialtürme |

Alle spielen dasselbe Spiel — mit völlig anderer Strategie.
