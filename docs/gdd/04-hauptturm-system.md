# 04 – Hauptturm-System

> Teil 4 von 16 der Game-Design-Dokumentation.

---

## 1. Bedeutung des Hauptturms

Der Hauptturm ist das Herzstück jeder Kampfstation.

Er ist nicht einfach ein stärkerer normaler Turm — er bestimmt den **grundlegenden Spielstil** eines gesamten Runs.

Grundregeln:

- steht immer im Zentrum der Basis
- kann nicht entfernt oder verkauft werden
- besitzt eigene Angriffssysteme und Fähigkeiten
- wird nicht während eines laufenden Runs gewechselt
- ist ein **Hexagon mit sechs Anschlusskanten** und liefert damit die ersten sechs Bauplätze
- **erhält Buffs von angrenzenden Buff-Türmen** wie jedes andere Modul

Der letzte Punkt ist keine Nebensache: Weil der Hauptturm mit Abstand den höchsten Einzelschaden
der Station liefert, sind die sechs Kernkanten die wertvollsten Bauplätze überhaupt — und ein
Buff-Turm direkt am Kern erreicht als viertes Ziel den Kern selbst. Ohne diese Regel wären
Buff-Türme in kleinen Basen rechnerisch wertlos (→ [03, Abschnitt 9](03-modulare-basis-und-bauregeln.md)).

---

## 2. Auswahl des Hauptturms

Nach jedem Prestige wählt der Spieler aus den freigeschalteten Kernen.

```
Wähle deinen Hauptkern:

  Sentinel Core        Vulcan Core            Prism Core
  Ausgewogen           Extrem schnelles Feuer  Energielaser
```

Die Auswahl beeinflusst den kompletten nächsten Fortschritt und ist damit eine gewichtige Entscheidung.

Beispiel: Wer den Vulcan Core wählt, macht Angriffstempo-Builds, Maschinengewehre und Tempo-Buffs besonders wertvoll.

Haupttürme besitzen **keine normale Rarität** — sie sind eigene Klassen und werden über Prestige freigeschaltet und verbessert.

---

## 3. Übersicht der Kerne

| Kern | Rolle | Freischaltung | Kosten (Prestige-Punkte) |
|---|---|---|---|
| Sentinel Core (Wächter-Kern) | Ausgeglichen | Start | — |
| Vulcan Core (Vulkan-Kern) | Schnellfeuer | Prestige-Baum | 500 |
| Rail Core | Schwerer Einzelschaden | Prestige-Baum | 1.000 |
| Prism Core (Prisma-Kern) | Laser | Prestige-Baum | 2.500 |
| Tesla Core | Elektrische Ketten | Prestige-Baum | 5.000 |
| Fortress Core (Festungs-Kern) | Verteidigung | Prestige-Baum | 7.500 |
| Inferno Core | Feuer / Schaden über Zeit | Prestige-Baum | — |
| Drone Core (Drohnen-Kern) | Automatisierung | später Prestige-Baum | 15.000 |
| Plasma Core | Endgame-Universalist | sehr später Prestige-Baum | — |

---

## 4. Die Kerne im Detail

### Sentinel Core — der Standard-Kern

**Form:** Hexagon · **Spielstil:** ausgewogen

| Wert | Ausprägung |
|---|---|
| Schaden | mittel |
| Angriffstempo | mittel |
| Reichweite | mittel |
| HP | mittel |

Stabiler Allround-Kern ohne extreme Schwäche. Unterstützt viele verschiedene Builds und ist der Startkern für die ersten Spielstunden.

**Fähigkeit: Energieüberladung** — für kurze Zeit +50 % Angriffstempo und +25 % Schaden. Cooldown 60 Sekunden.

**Geeignet für:** neue Spieler, flexible Builds.

---

### Vulcan Core — der Schnellfeuer-Kern

**Form:** Hexagon mit mehreren Lauf-Modulen · **Spielstil:** extremes Angriffstempo

| Wert | Ausprägung |
|---|---|
| Schaden | niedrig |
| Angriffstempo | extrem hoch |
| Reichweite | mittel |
| HP | mittel |

Zerstört Gegner mit einer sehr großen Zahl an Projektilen.

**Fähigkeit: Überhitzung** — kurzzeitig extrem erhöhte Feuerrate, danach kurze Abkühlung.

**Eigene Upgrades:** mehr Feuerfrequenz, mehr Projektile, kürzere Nachladezeit / weniger Überhitzung.

**Synergien:** Maschinengewehre, Buff-Türme, Angriffstempo, kritische Treffer.
**Schwäche:** sehr starke Tanks und Einzelziele.

---

### Rail Core — der Präzisions-Kern

**Spielstil:** extremer Einzelzielschaden

| Wert | Ausprägung |
|---|---|
| Schaden | extrem hoch |
| Angriffstempo | sehr niedrig |
| Reichweite | sehr hoch |
| Projektilgeschwindigkeit | hoch |

Feuert extrem starke Energiegeschosse mit hoher Durchschlagskraft.

**Fähigkeit: Rail Shot / Durchbruchsschuss** — ein Schuss durchdringt mehrere Gegner hintereinander.

**Eigene Upgrades:** mehr Schaden, mehr Durchschlag, größere Explosionen.

**Synergien:** Kanonen, Laser, Durchschuss, kritische Treffer.
**Schwäche:** große Gegnergruppen.

---

### Prism Core — der Laser-Kern

**Spielstil:** Laser und Energiewaffen

| Wert | Ausprägung |
|---|---|
| Schaden | hoch |
| Angriffstempo | mittel |
| Reichweite | sehr hoch |

Nutzt konzentrierte Lichtenergie und liefert konstanten Schaden über große Distanz.

**Fähigkeit: Prism Burst / Solarstrahl** — mehrere Laserstrahlen gleichzeitig bzw. ein besonders starker Laserangriff.

**Eigene Upgrades:** längerer Laser, stärkerer Laser, mehrere Strahlen, Durchdringung.

**Synergien:** Laser-Türme, Energie-Buffs, Reichweite.
**Schwäche:** hohe Upgrade-Kosten, weniger effektiv gegen Massen.

---

### Tesla Core — der Energie-Ketten-Kern

**Spielstil:** Gruppenschaden und Kontrolle

| Wert | Ausprägung |
|---|---|
| Schaden | mittel |
| Angriffstempo | mittel |
| Flächenschaden | sehr hoch |

Verbindet Gegner durch elektrische Energie; Blitze springen über mehrere Ziele.

**Fähigkeit: Kettenreaktion / Sturmentladung** — ein Blitz springt über viele Gegner.

**Synergien:** Tesla-Türme, Flächenschaden, Verlangsamung.
**Schwäche:** einzelne, sehr starke Ziele.

---

### Fortress Core — der Verteidigungs-Kern

**Spielstil:** Überleben

| Wert | Ausprägung |
|---|---|
| Schaden | niedrig |
| Angriffstempo | niedrig |
| Stations-HP | extrem hoch |

Massiver Kern mit sehr hoher Lebensenergie und defensiven Boni — er erhöht die gemeinsame Stations-HP der gesamten Basis.

**Fähigkeit: Notfallschild / Energieschild** — reduziert für kurze Zeit eingehenden Schaden.

**Eigene Upgrades:** mehr HP, mehr Schild, Schadensreduzierung.

**Synergien:** Schildgeneratoren, Buff-Türme, Kanonen.
**Schwäche:** langsamer Fortschritt durch geringen Schaden.

---

### Inferno Core — der Feuer-Kern

**Spielstil:** Schaden über Zeit

| Wert | Ausprägung |
|---|---|
| Schaden | mittel |
| Flächenschaden | hoch |

Verbrennt und kontrolliert Gegner.

**Fähigkeit: Sonneneruption** — eine große Explosion verbrennt Gegner im Umfeld.

**Synergien:** Flammen-Türme, Gift-Effekte, Flächenschaden.
**Schwäche:** sehr schnelle Gegner.

---

### Drone Core — der autonome Kern

**Spielstil:** automatisierte Unterstützung

| Wert | Ausprägung |
|---|---|
| Direkter Schaden | mittel |
| Unterstützung | sehr hoch |

Produziert eigene Kampfdrohnen statt klassischer Projektile.

**Fähigkeit: Drohnenschwarm** — beschwört temporär zusätzliche Drohnen.

**Synergien:** Drohnen-Modul, Buff-Türme, XP-Boni.
**Schwäche:** benötigt viele Upgrades und gute Unterstützung durch andere Türme.

---

### Plasma Core — der Endgame-Kern

**Spielstil:** universeller Endgame-Schaden

| Wert | Ausprägung |
|---|---|
| Schaden | sehr hoch |
| Angriffstempo | mittel |
| Spezialeffekte | sehr hoch |

Eine experimentelle, instabile Energiequelle.

**Fähigkeit: Plasma Collapse** — große Energieexplosion.

**Synergien:** alle Spezialtürme.
**Schwäche:** extrem teuer.

---

## 5. Hauptturm-Upgrades

Der Hauptturm wird **innerhalb eines Runs mit Gold** verbessert — nicht über Prestige-Punkte.

Allgemeine Upgrades:

- Schaden
- Angriffstempo
- Reichweite
- maximale Stations-HP (gemeinsame Lebensleiste → [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md))
- kritische Trefferchance
- Projektil-Upgrades (Anzahl, Geschwindigkeit, Durchschlag)

Zusätzlich besitzt jeder Kern **eigene Spezialisierungen**, die seinen Stil verstärken (siehe Abschnitt 4).

Details zur Kostenstruktur: → [08 – Ressourcen, Ökonomie und Upgrades](08-ressourcen-oekonomie-und-upgrades.md)

---

## 6. Hauptturm-Fähigkeiten

Fähigkeiten sind nicht automatisch vorhanden — sie werden über normale Gold-Upgrades freigeschaltet und verbessert und nur in der Kampfansicht eingesetzt.

Allgemeine Fähigkeiten stehen jedem Kern offen (Überladung, Notfallschild, Energieentladung, Reparaturimpuls). Zusätzlich besitzt jeder Kern eine eigene, exklusive Fähigkeit (siehe Abschnitt 4).

Vollständige Beschreibung: → [09 – Level-System und Fähigkeiten](09-level-system-und-faehigkeiten.md)

---

## 7. Visuelles Design

Der Hauptturm unterscheidet sich sichtbar von normalen Türmen:

- zentrale Position
- größere Form
- stärkere Beleuchtung
- besondere Animationen

Jeder Kern besitzt eigene visuelle Merkmale — Prism Core: Energielinien und Lichtstrahlen; Tesla Core: elektrische Effekte; Fortress Core: Schutzfelder.

---

## 8. Balance-Regeln

**Kein Hauptturm darf alle anderen ersetzen.** Jeder benötigt eine passende Strategie:

| Kern-Typ | benötigt |
|---|---|
| schneller Kern | Buff-Türme, Schadensverstärkung |
| Verteidigungs-Kern | zusätzliche Schadensquellen |
| Laser-Kern | Energie-Verbesserungen, Reichweite |

---

## 9. Ziel des Hauptturm-Systems

Der Hauptturm sorgt dafür, dass jeder Prestige-Run anders gespielt werden kann.

Der Spieler entscheidet nicht nur *"Wie stark werde ich?"*, sondern *"Welche Art von Basis möchte ich diesmal bauen?"*

| Spieler | Kern | Build |
|---|---|---|
| A | Vulcan Core | viele Maschinengewehre, Angriffstempo |
| B | Fortress Core | Schildtürme, Kanonen, Überleben |
| C | Prism Core | Laser und Spezialtürme |

Alle spielen dasselbe Spiel — mit völlig anderer Strategie.
