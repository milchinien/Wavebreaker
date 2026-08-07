# 09 – Level-System und Fähigkeiten

> Teil 9 von 16 der Game-Design-Dokumentation.

---

# TEIL A – LEVEL-SYSTEM UND PERKS

## 1. Zweck

Jeder Run besitzt ein eigenes Level-System. Während Gold für Käufe verwendet wird, entwickelt sich der Spieler zusätzlich durch Erfahrungspunkte.

```
Gegner besiegen → XP erhalten → Level aufsteigen → Level-Perk auswählen
```

---

## 2. Erfahrung und Levelaufstieg

XP kommt von normalen Gegnern, Elite-Gegnern und Bossen — je stärker der Gegner, desto mehr XP.

Eine XP-Leiste zeigt den Fortschritt. Jedes Level kostet mehr XP:

| Level | benötigte XP (Richtwert) |
|---|---|
| 1 | 100 |
| 10 | 5.000 |
| 50 | 100.000 |

Bei jedem Levelaufstieg erhält der Spieler **drei zufällige Perks zur Auswahl** und wählt einen.

```
Levelaufstieg — Wähle eine Verbesserung:

  A) +10% Schaden
  B) +1 Projektil-Durchschuss
  C) +15% Angriffstempo
```

---

## 3. Level-Perks

Perks sind **temporäre Verbesserungen für den aktuellen Run**. Sie wirken auf die gesamte Basis und verschwinden beim Prestige.

### Perk-Kategorien

| Kategorie | Beispiele |
|---|---|
| **Offensiv** | +5 % / +10 % Schaden, +Kritchance, +kritischer Schaden |
| **Angriffstempo** | schnellere Angriffe, schnellere Projektile, weniger Cooldown |
| **Projektil** | Durchschuss, Abpraller, mehr Projektile, höhere Projektilgeschwindigkeit |
| **Elementar** | Feuerschuss, Blitz-Schuss, Plasma-Schuss, Verbrennung, Explosion bei Treffer, Giftgeschoss |
| **Defensiv** | +10 % Stations-HP, Schadensreduzierung, Schildstärke |
| **Wirtschaft** | mehr Gold, mehr XP, größerer Sammelradius |

### Besondere Perks

| Perk | Effekt |
|---|---|
| **Durchschuss** | Projektile treffen zusätzliche Gegner dahinter |
| **Abpraller** | Projektile springen von Wänden zurück |
| **Feuerschuss** | Chance auf zusätzlichen Brandschaden |
| **Explosivgeschoss** | Treffer verursachen Flächenschaden |
| **Kettenenergie** | Angriffe können weitere Gegner treffen |

### Perk-Seltenheiten

| Stufe | Wirkung | Beispiel |
|---|---|---|
| Normal | kleine Boni | +10 % Schaden |
| Selten | stärkere Werte | +25 % Schaden |
| Episch | starke Änderungen | zusätzliche Mechanik |
| Legendär | verändert den ganzen Build | alle Projektile erhalten Durchschuss |

Stärkere Effekte erscheinen seltener.

### Perk-Synergien

Starke Builds entstehen durch Kombination:

| Kombination | Ergebnis |
|---|---|
| Durchschuss + Explosion | mehrere Explosionen pro Schuss |
| Abpraller + mehr Projektile | sehr viele Treffer gegen Gruppen |
| Feuerschuss + Angriffstempo | sehr viele brennende Projektile |
| Goldbonus + Sammelradius | deutlich schnellerer Fortschritt |

---

## 4. Perks vs. Upgrades

| | Turm-Upgrade | Level-Perk |
|---|---|---|
| Erwerb | mit Gold gekauft | bei Levelaufstieg gewählt |
| Zufall | keiner | zufällige Auswahl |
| Wirkung | ein bestimmter Turm | die gesamte Basis / der ganze Run |
| Beispiel | +20 % Schaden für ein Maschinengewehr | alle Türme +10 % Schaden |

Beide Systeme existieren gleichzeitig und ergänzen sich.

---

## 5. Reset

Beim Prestige werden zurückgesetzt: Spielerlevel, gesammelte XP, alle Level-Perks.
Nicht zurückgesetzt: Prestige-Punkte und Prestige-Freischaltungen.

---

# TEIL B – FÄHIGKEITEN

## 6. Zweck

Das Spiel läuft automatisch — trotzdem soll der Spieler in wichtigen Momenten eingreifen können.

> "Meine Basis funktioniert automatisch, aber ich kann den perfekten Moment nutzen, um noch weiter zu kommen."

Fähigkeiten ersetzen keine Türme. Sie verstärken oder verändern kurzfristig die Situation: Schaden erhöhen, Gegner kontrollieren, Verteidigung verbessern, schwierige Situationen retten.

---

## 7. Grundregeln

- Fähigkeiten sind **nicht** von Anfang an vorhanden.
- Sie werden über normale **Gold-Upgrades** freigeschaltet (teils auch über Prestige/Forschung).
- Sie werden mit Gold verbessert.
- Sie können **nur in der Kampfansicht** eingesetzt werden.

### Der Einsatz selbst kostet nichts

Eine Fähigkeit ist **immer einsetzbar, sobald ihr Cooldown abgelaufen ist**. Es gibt weder Goldkosten pro Einsatz noch eine Energie-Ressource.

Gold kostet nur:

1. das **einmalige Freischalten** der Fähigkeit
2. das **Verbessern** ihrer Stufen

Damit gibt es keinen Grund, eine bereitstehende Fähigkeit aus Sparsamkeit ungenutzt zu lassen — der Spieler soll sie im richtigen Moment zünden, nicht horten.

> Wo im GDD bei der Fähigkeitsanzeige von „Kosten" die Rede ist, sind immer diese Freischalt- und Upgrade-Kosten gemeint, nicht Kosten pro Einsatz.

Während der Spieler in der Basis ist, läuft der Kampf weiter — Fähigkeiten werden dort aber nicht aktiviert. Die Basis bleibt Management-Bereich, die Kampfansicht der Ort für direkte Eingriffe.

---

## 8. Fähigkeitenslots

| Zeitpunkt | Slots |
|---|---|
| Start | **1** |
| 2. Slot | über Prestige-Baum freischaltbar |
| 3. Slot | über Prestige-Baum freischaltbar |
| **Maximum** | **3 gleichzeitig aktiv** |

Bei sieben verfügbaren Fähigkeiten und nur drei Slots bleibt die Auswahl dauerhaft eine echte Entscheidung — kein Spieler kann alles gleichzeitig mitnehmen.

Das erzeugt Build-Identität: Ein defensiver Fortress-Build belegt seine drei Slots anders als ein offensiver Vulcan-Build.

Die Zuordnung der Fähigkeiten zu den Slots kann jederzeit außerhalb des Kampfes geändert werden — nur die Anzahl ist begrenzt, nicht die Wahl.

---

## 9. Fähigkeit-Upgrades

Verbesserbar sind: Stärke, Dauer, Cooldown, Reichweite und zusätzliche Effekte.

Beispiel Energieüberladung:

| Stufe | Effekt |
|---|---|
| 1 | +25 % Angriffstempo, +10 % Schaden |
| 5 | +100 % Angriffstempo, +25 % Schaden |
| 10 | +100 % Angriffstempo, +50 % Schaden |

---

## 10. Fähigkeitenliste

### Energieüberladung
**Kategorie:** offensive Verstärkung
Erhöht Angriffstempo und Schaden des Hauptturms.
Dauer 10 s · Cooldown 60 s · gut gegen Bosse, schwere Wellen, Elite-Gegner.

### Energieschild / Notfallschild
**Kategorie:** Verteidigung
Erzeugt eine Schutzbarriere und reduziert Schaden am Hauptturm.
Dauer 15 s · Cooldown 90 s.

### Orbitaler Angriff / Energieexplosion
**Kategorie:** Flächenschaden
Ein Satellit greift einen Bereich der Arena an; große Explosion. Besonders gegen Schwärme.
Verbesserungen: größere Explosion, mehr Schaden, mehrere Einschläge.

### Zeitverzerrung
**Kategorie:** Gegnerkontrolle
Ein Energiefeld verlangsamt Gegner. Besonders gegen schnelle Gegner und gefährliche Kombinationen.
Verbesserungen: stärkere Verlangsamung, größere Fläche, längere Dauer.

### Reparaturdrohnen / Reparaturimpuls
**Kategorie:** Unterstützung
Stellt einen Teil der Stations-HP wieder her.
Verbesserungen: mehr Heilung, mehr Drohnen, kürzerer Cooldown.

### Drohnenschwarm
**Kategorie:** zusätzlicher Schaden
Aktiviert temporäre Kampfdrohnen. Freischaltung über späteren Prestige-Fortschritt.
Verbesserungen: Anzahl, Schaden, Dauer.

### Plasmaexplosion
**Kategorie:** Endgame
Der Hauptkern entlädt eine große Energiemenge — sehr hoher Flächenschaden. Besonders gegen Bosse und Elite-Gegner. Freischaltung sehr spät.

---

## 11. Hauptturm-spezifische Fähigkeiten

Jeder Kern besitzt zusätzlich eine exklusive Fähigkeit:

| Kern | Fähigkeit | Effekt |
|---|---|---|
| Sentinel Core | Energieüberladung | +50 % Angriffstempo, +25 % Schaden |
| Vulcan Core | Überhitzung | kurzzeitig extreme Feuerrate |
| Rail Core | Durchbruchsschuss / Rail Shot | ein Schuss durchdringt viele Gegner |
| Prism Core | Prism Burst / Solarstrahl | mehrere bzw. extrem starke Laserstrahlen |
| Tesla Core | Kettenreaktion / Sturmentladung | Blitz springt über viele Gegner |
| Fortress Core | Notfallschild | temporärer Schutzschild |
| Inferno Core | Sonneneruption | große Explosion, verbrennt Gegner |
| Drone Core | Drohnenschwarm | mehrere Drohnen greifen automatisch an |
| Plasma Core | Plasma Collapse | große Energieexplosion |

→ [04 – Hauptturm-System](04-hauptturm-system.md)

---

## 12. Fähigkeitssynergien

| Kern | besonders starke Fähigkeit |
|---|---|
| Vulcan Core | Energieüberladung |
| Fortress Core | Energieschild |
| Prism Core | Orbitaler Angriff |
| Drone Core | Drohnenschwarm |

---

## 13. Ziel des Systems

Level-Perks und Fähigkeiten verhindern, dass jeder Run gleich aussieht.

Ein Run kann werden: schnelle Projektile mit vielen Durchschüssen — oder defensive Basis mit Schilden und hoher HP — oder Laser, Energie und Flächenschaden.

Das Spielgefühl bleibt: **80 % automatischer Fortschritt, 20 % aktive Entscheidungen.**

Der Spieler entscheidet: Wann benutze ich Fähigkeiten? Welche Perks nehme ich? Welche Türme kaufe ich? Wann gehe ich in die Basis? Wann sammle ich Gold?
