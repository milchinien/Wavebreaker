# WELLENBRECHER — Game Design Document

**Titel:** WELLENBRECHER (deutsch) · **WAVEBREAKER** (englisch, Titel im Spiel)

Ein futuristisches Idle-Incremental-Verteidigungsspiel mit modularer Turmbasis.

Diese 16 Dokumente beschreiben das gesamte Spiel. Sie sind aufeinander abgestimmt und überschneidungsfrei — jedes Thema wird an genau einer Stelle definiert, andere Dokumente verweisen darauf.

---

## Dokumente

### Grundlagen

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 01 | [Spielvision und Grundkonzept](01-spielvision-und-grundkonzept.md) | Genre, High Concept, Spielfantasie, die fünf Design-Säulen, übergeordnete Prinzipien |
| 02 | [Kern-Spielschleife und Spielerfahrung](02-kern-spielschleife-und-spielerfahrung.md) | Hauptschleife, die zwei Spielzustände, typischer Run, Niederlage-System, Langzeitmotivation |

### Die Kampfstation

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 03 | [Modulare Basis und Bauregeln](03-modulare-basis-und-bauregeln.md) | Bausystem, Modulformen, Platzierung, Buff-Türme und Buff-Regeln |
| 04 | [Hauptturm-System](04-hauptturm-system.md) | Alle neun Kerne mit Werten, Fähigkeiten, Synergien und Freischaltkosten |
| 05 | [Turm-System und Turmtypen](05-turm-system-und-turmtypen.md) | Turmkategorien, komplette Turmliste, Upgrade-Pfade, Zielprioritäten |
| 06 | [Turmerwerb, Inventar und Raritäten](06-turmerwerb-inventar-raritaeten.md) | Kaufsystem, Kostenkurve, Inventar, Schmelzen, Raritäten, Turm-Eigenschaften |

### Gegner und Kampf

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 07 | [Gegner, Bosse und Wellen](07-gegner-bosse-und-wellen.md) | Alle Gegnerklassen mit Werten, Spezialgegner, Elite-Modifikatoren, Bosse, Wellenaufbau |

### Fortschrittssysteme

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 08 | [Ressourcen, Ökonomie und Upgrades](08-ressourcen-oekonomie-und-upgrades.md) | Gold, XP, Prestige-Punkte, alle Upgrade-Kategorien, Kostenformeln |
| 09 | [Level-System und Fähigkeiten](09-level-system-und-faehigkeiten.md) | XP, Level-Perks und Synergien, aktive Fähigkeiten, Slots |
| 10 | [Prestige-System](10-prestige-system.md) | Reset-Regeln, Punkte-Berechnung, kompletter Prestige-Baum mit Kosten |
| 11 | [Events und Versorgungskapseln](11-events-und-versorgungskapseln.md) | Risiko- und Entscheidungs-Events, Händler-Drohne, Kapselarten |
| 12 | [Offline-Fortschritt und Helfer](12-offline-fortschritt-und-helfer.md) | Hintergrundsimulation, Rückkehr-Zusammenfassung, Helfer-System |

### Präsentation und Steuerung des Fortschritts

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 13 | [UI und visuelles Design](13-ui-und-visuelles-design.md) | Grafikstil, Kampf- und Basis-Layout, alle Fenster, Raritätsfarben, Animationen |
| 14 | [Progression und Freischaltungen](14-progression-und-freischaltungen.md) | Startzustand, erste Spielminuten, Freischaltungs-Reihenfolge, Spielphasen |
| 15 | [Balancing und Skalierung](15-balancing-und-skalierung.md) | Skalierungsregeln, Turm- und Gegner-Balance, Build-Vielfalt, offene Tuning-Werte |

### Umsetzung

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 16 | [Technische Umsetzung](16-technische-umsetzung.md) | Systemarchitektur, Datenstrukturen, Entwicklungsphasen, MVP, Performance |

---

## Wichtigste Zahlen auf einen Blick

| Wert | Festlegung | Quelle |
|---|---|---|
| Aktive Türme pro Basis | 8–15 | [03](03-modulare-basis-und-bauregeln.md) |
| Turmkauf-Kosten | Grundpreis × 1,5 pro Kauf (Start 100 Gold) | [06](06-turmerwerb-inventar-raritaeten.md) |
| Upgrade-Kosten | Basiswert × Level^1,15 | [08](08-ressourcen-oekonomie-und-upgrades.md) |
| Gegner-HP-Skalierung | Start-HP × (1 + Wellenfaktor), nicht linear | [15](15-balancing-und-skalierung.md) |
| Boss-Intervall | alle 10 Wellen | [07](07-gegner-bosse-und-wellen.md) |
| Prestige-Voraussetzung | 1.000 gesammeltes Gold | [10](10-prestige-system.md) |
| Aktiv/Passiv-Verhältnis | 80 % automatisch, 20 % aktive Entscheidungen | [09](09-level-system-und-faehigkeiten.md) |
| Erstes Prestige nach | 30–60 Minuten Spielzeit | [15](15-balancing-und-skalierung.md) |

---

## Getroffene Rahmenentscheidungen

| Thema | Entscheidung | Detail |
|---|---|---|
| Plattform | Web (Browser) | [16, Abschnitt 1](16-technische-umsetzung.md) |
| Technik | TypeScript + HTML5-Canvas, keine Engine | [16, Abschnitt 1](16-technische-umsetzung.md) |
| Bausystem-Raster | Hex-Gitter, 6 Nachbarn pro Zelle | [03, Abschnitt 3](03-modulare-basis-und-bauregeln.md) |
| Lebenspunkte | **eine** gemeinsame Stations-HP, Module unzerstörbar | [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md) |
| Turm-Upgrades | pro Turmtyp, nicht pro einzelnem Turm | [08, Abschnitt 5.2](08-ressourcen-oekonomie-und-upgrades.md) |
| Gold-Drops | bleiben unbegrenzt liegen, verschmelzen zu Stapeln | [08, Abschnitt 2](08-ressourcen-oekonomie-und-upgrades.md) |
| Kamera | zoomt automatisch heraus, Station immer komplett sichtbar | [13](13-ui-und-visuelles-design.md) |
| Gegner-Spawn | rundum aus allen Richtungen | [07, Abschnitt 2](07-gegner-bosse-und-wellen.md) |
| Gegner-Angriff | docken an und schlagen weiter, bis sie sterben | [07, Abschnitt 2](07-gegner-bosse-und-wellen.md) |
| Turmreichweite | Kreis um die eigene Hex-Zelle, kein Schussfeld | [05, Abschnitt 4](05-turm-system-und-turmtypen.md) |
| Heilung | volle Stations-HP zu Beginn **jeder** Welle | [07, Abschnitt 12](07-gegner-bosse-und-wellen.md) |
| Wellensteuerung | `[(<) LEVEL 15 (+)(>)]` — vor/zurück skippen, Auto-Modus | [07, Abschnitt 9](07-gegner-bosse-und-wellen.md) |
| Fähigkeiten | nur Cooldown, kein Verbrauch pro Einsatz | [09, Abschnitt 7](09-level-system-und-faehigkeiten.md) |
| Spielgeschwindigkeit | ×1, später ×2/×4 über Prestige | [10, Bereich 2b](10-prestige-system.md) |
| Monetarisierung | keine im Prototyp, Architektur hält sie offen | [16, Abschnitt 2](16-technische-umsetzung.md) |
| Skip-Belohnungen | richten sich nach der gespielten Welle, nicht nach dem Rekord | [07, Abschnitt 9](07-gegner-bosse-und-wellen.md) |
| Türme abstoßen | nur schmelzen, kein Verkauf gegen Gold | [06, Abschnitt 4](06-turmerwerb-inventar-raritaeten.md) |
| Eigenschaften pro Turm | 0 / 1 / 2 / 3 / 4 nach Rarität | [06, Abschnitt 10](06-turmerwerb-inventar-raritaeten.md) |
| Audio | Prototyp stumm, Auslösepunkte vorbereitet | [13, Abschnitt 10](13-ui-und-visuelles-design.md) |
| Wellenende | wenn alle Gegner der Welle tot sind, kein Zeitlimit | [07, Abschnitt 9](07-gegner-bosse-und-wellen.md) |
| Wellenrekord | wird beim Prestige zurückgesetzt (Skip-Grenze) | [07, Abschnitt 10](07-gegner-bosse-und-wellen.md) |
| Turmplätze | Start 4, Ausbau über Prestige, Inventar unbegrenzt | [03, Abschnitt 6](03-modulare-basis-und-bauregeln.md) |
| Fähigkeiten-Slots | 1 zu Beginn, maximal 3 | [09, Abschnitt 8](09-level-system-und-faehigkeiten.md) |
| Spawn-Takt | gestaffelt über die Welle, nicht alles auf einmal | [07, Abschnitt 2](07-gegner-bosse-und-wellen.md) |
| Elite-Gegner | Chance pro Gegner, steigt mit der Welle | [07, Abschnitt 6](07-gegner-bosse-und-wellen.md) |
| Kapseln / Events | Drop-Chance / alle 15–25 Wellen | [11, Abschnitt 2](11-events-und-versorgungskapseln.md) |
| Tutorial | keines — einmalige Hinweise bei neuen Systemen | [14, Abschnitt 4a](14-progression-und-freischaltungen.md) |
| Titel | WELLENBRECHER / WAVEBREAKER | [01, Abschnitt 1a](01-spielvision-und-grundkonzept.md) |
| Spielsprache | Englisch (GDD bleibt Deutsch) | [16, Abschnitt 1](16-technische-umsetzung.md) |
| Pacing | erstes Prestige nach 30–60 Minuten | [15, Abschnitt 3](15-balancing-und-skalierung.md) |

---

| Pacing | erstes Prestige nach 30–60 Minuten | [15, Abschnitt 3](15-balancing-und-skalierung.md) |

**Alle Spielregeln sind festgelegt.** Offen sind nur noch Werte, die man am laufenden Spiel misst statt vorher zu bestimmen, sowie zwei technische Details:

| Offen | Art | Dokument |
|---|---|---|
**Alle Spielregeln sind festgelegt.** Offen sind nur noch Werte, die man am laufenden Spiel misst statt vorher zu bestimmen, sowie zwei technische Details:
| Zahlentyp für Endgame-Werte, Rendering-Budget | technische Messung | [16, Abschnitt 15](16-technische-umsetzung.md) |
| Offen | Art | Dokument |
> Hinweis zur Quellenlage: Der ursprüngliche GDD-Teil zum modularen Basissystem wurde nie vollständig übermittelt. Dokument 03 fasst alles zusammen, was in den übrigen Teilen dazu steht, ergänzt um die Hex-Raster-Entscheidung und die inzwischen geklärten Detailfragen.
| Wellenfaktor, Turm-Basiswerte, XP-Kurve, Prestige-Formel, Drop-Chancen | Tuning am Prototyp | [15, Abschnitt 16](15-balancing-und-skalierung.md) |
| Zahlentyp für Endgame-Werte, Rendering-Budget | technische Messung | [16, Abschnitt 15](16-technische-umsetzung.md) |

> Hinweis zur Quellenlage: Der ursprüngliche GDD-Teil zum modularen Basissystem wurde nie vollständig übermittelt. Dokument 03 fasst alles zusammen, was in den übrigen Teilen dazu steht, ergänzt um die Geometrieentscheidung und die inzwischen geklärten Detailfragen.

Diese Serie ist aus zwei vorherigen Dokumentreihen zusammengeführt worden (21 nummerierte Teile sowie 15 Abschlussdokumente plus Entwicklungs-Ergänzung). Sie ersetzt beide vollständig.

## Erprobt am Prototyp

Das Bausystem ist nicht nur beschrieben, sondern gebaut und vermessen:
[`prototypes/01-tower-building/`](../../prototypes/01-tower-building/) — isoliert vom Spiel,
38 Selbsttests, Messwerte und offene Urteilsfragen im
[Ergebnis](../../prototypes/01-tower-building/README.md#ergebnis).

Daraus geändert wurden: 03 (Abschnitte 2, 3, 4, 7, 9, 10, 12), 04 (Abschnitt 1),
05 (Abschnitte 4, 5), 13 (Abschnitt 4), 15 (Abschnitt 8), 16 (Abschnitte 1, 7).

Offen bleiben vier Fragen, die nur am laufenden Bild zu beantworten sind: Baugefühl beim Einrasten,
Unterscheidbarkeit der Formen, Buff-Linien dauerhaft oder nur bei Auswahl, und ob die Keile
zwischen den Modulen schön wirken.

---

## Hinweis zur Historie

Diese Serie ist aus zwei vorherigen Dokumentreihen zusammengeführt worden (21 nummerierte Teile sowie 15 Abschlussdokumente plus Entwicklungs-Ergänzung). Sie ersetzt beide vollständig.

