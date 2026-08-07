# 11 – Events und Versorgungskapseln

> Teil 11 von 16 der Game-Design-Dokumentation.

---

## 1. Ziel des Event-Systems

Das Hauptspiel besteht aus endlosen Gegnerwellen. Damit lange Spielzeiten abwechslungsreich bleiben, braucht es zusätzliche Ereignisse.

Events sorgen für:

- besondere Momente während eines Runs
- neue Entscheidungen
- zusätzliche Belohnungen
- Abwechslung zwischen normalen Wellen

**Events ersetzen niemals den Hauptfortschritt.** Der Kern bleibt: Kämpfen → Gold sammeln → Türme verbessern → Basis ausbauen → höhere Wellen erreichen.

---

## 2. Häufigkeit

Events und Versorgungskapseln folgen **zwei unterschiedlichen Mechanismen** — das hält beide besonders.

| | Auslöser | Rhythmus |
|---|---|---|
| **Versorgungskapseln** | Drop-Chance von besiegten Gegnern | kleine Wahrscheinlichkeit pro Gegner; Bosse und Elite-Gegner deutlich häufiger |
| **Events** | wellenbasiert | in größeren Abständen, Richtwert **alle 15–25 Wellen** |

**Warum getrennt:** Kapseln sollen sich wie ein Glücksfall im laufenden Kampf anfühlen — dafür eignet sich eine Drop-Chance. Events unterbrechen den Ablauf und verlangen eine Entscheidung; sie dürfen deshalb nicht ständig kommen, sondern brauchen Abstand, damit sie ein Moment bleiben.

Beides ist an **Fortschritt** gekoppelt, nicht an verstrichene Zeit. Wer aktiv spielt und schneller Wellen schafft, erlebt entsprechend mehr — reines Warten wird nicht belohnt.

> Die konkreten Drop-Chancen und Wellenabstände sind Tuning-Werte → [15, Abschnitt 16](15-balancing-und-skalierung.md).

---

## 3. Ablauf eines Events

Events erscheinen während eines laufenden Runs. Der Kampf läuft dabei normal weiter.

```
--------------------------------
ENERGIE-ANOMALIE ENTDECKT
Unbekannte Technologie wurde gefunden.
--------------------------------
```

Danach kann der Spieler reagieren.

---

## 4. Event-Arten

| Art | Beschreibung |
|---|---|
| **Risiko-Events** | Der Spieler geht ein Risiko ein und erhält dafür eine bessere Belohnung. |
| **Belohnungs-Events** | Der Spieler erhält eine kostenlose Belohnung. |
| **Entscheidungs-Events** | Der Spieler wählt zwischen mehreren Möglichkeiten. |
| **Kampf-Events** | Besondere Gegner oder Herausforderungen erscheinen. |

---

## 5. Risiko-Events

### Schwarzes Loch

Ein instabiles Schwarzes Loch erscheint in der Nähe der Basis.

| Option | Effekt | Belohnung |
|---|---|---|
| **Stabilisieren** | Kampf läuft normal weiter | normale Belohnung |
| **Absorbieren** | Gegner werden stärker | deutlich mehr Gold und XP |
| **Überladen** | ein besonderer Gegner erscheint | Chance auf seltene Belohnung |

### Überlastete Energiequelle

Eine unbekannte Energiequelle kann genutzt werden.

| Option | Effekt | Belohnung |
|---|---|---|
| **Sicher verwenden** | kleiner Bonus | gering |
| **Energie überladen** | +50 % Angriffstempo, aber +50 % Gegnerstärke | mehr Gold und XP |

---

## 6. Entscheidungs-Events

### Fremde Technologie

Eine alte Technologie wurde gefunden.

| Option | Belohnung |
|---|---|
| Analysieren | XP |
| Verkaufen | Gold |
| Einbauen | zufälliger temporärer Bonus |

### Gegnerische Mutation

Eine ungewöhnliche Gegnergruppe wurde entdeckt.

| Option | Effekt | Belohnung |
|---|---|---|
| Ignorieren | — | normale Belohnung |
| Bekämpfen | mehr Gegner erscheinen | mehr XP |
| Jagen | stärkerer Gegner erscheint | hohe Goldbelohnung |

---

## 7. Händler-Drohne

Während eines Runs kann eine Händler-Drohne erscheinen. Sie landet kurzzeitig in der Arena und bietet zufällige Angebote:

- Gold-Upgrades
- temporäre Boni
- seltene Verbesserungen
- spezielle Turmangebote

---

## 8. Versorgungskapseln

Versorgungskapseln sind physische Objekte in der Kampfansicht. Sie fallen während des Kampfes in die Arena und müssen **manuell eingesammelt** werden.

Das passt zum Kernprinzip: Der Turm kämpft automatisch, der Spieler entscheidet, wann er eingreift.

### Aussehen

Die Kapseln leuchten in Neonfarben mit futuristischen Animationen und unterscheiden sich nach Seltenheit:

| Seltenheit | Optik |
|---|---|
| normal | blaues Leuchten |
| selten | goldenes Leuchten |
| legendär | starker Energieeffekt |

### Arten

| Kapsel | Inhalt |
|---|---|
| **Gold-Kapsel** | große Menge Gold |
| **XP-Kapsel** | zusätzliche Erfahrung |
| **Upgrade-Kapsel** | ein kostenloses Upgrade (z. B. +10 % Schaden oder +10 % Angriffstempo) |
| **Turm-Kapsel** | ein kostenloser Turmkauf — zwei zufällige Türme zur Auswahl |
| **Seltene Turm-Kapsel** | erhöhte Chance auf Rare, Epic, Legendary oder Mythic |

### Kapsel-Seltenheiten

| Stufe | Belohnung |
|---|---|
| Common | normale Belohnungen |
| Rare | größere Belohnungen |
| Epic | besondere Boni |
| Legendary | sehr seltene Belohnungen |
| Mythic | extrem seltene Ereignisse |

Bosse können später eine Chance auf seltene Versorgungskapseln erhalten.

---

## 9. Events und Balance

**Events dürfen niemals stärker sein als gute Planung.**

- Ein schlechter Build soll nicht durch Zufall gerettet werden.
- Ein guter Spieler soll durch seine Entscheidungen profitieren.

Events unterstützen das Hauptspiel — sie ersetzen nicht Turmbau, Upgrades, Prestige oder Strategie.

---

## 10. Zielgefühl

Ein langer Run soll sich nicht wie eine Wiederholung anfühlen. Der Spieler erlebt normale Wellen, Bosskämpfe, besondere Gegner, Versorgungskapseln, Entscheidungen und seltene Momente.

Der Spieler soll denken: *"Interessant, was bekomme ich?"* oder *"Gehe ich dieses Risiko ein?"*

Jeder Run entwickelt sich dadurch etwas anders.

