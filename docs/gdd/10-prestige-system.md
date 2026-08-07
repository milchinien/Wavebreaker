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
| 500 | 50–100 |
| 1.000 | 500 |
| 2.000 | 500+ |
| 10.000 | massive Belohnung |

> Die exakte Formel ist ein Balancing-Wert. Grundprinzip: je weiter der Spieler kommt, desto überproportional mehr Punkte.

---

## 6. Der Prestige-Baum

Der Baum besteht aus verbundenen Knoten mit Symbol, Name, Kosten und Status (gesperrt / verfügbar / gekauft) und ist in acht Bereiche unterteilt.

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
| Zusätzlicher Turmplatz | 100 | +1 maximaler Turmplatz (Start: 4) |
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
