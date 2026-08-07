# 12 – Offline-Fortschritt und Helfer

> Teil 12 von 16 der Game-Design-Dokumentation.

---

# TEIL A – OFFLINE-FORTSCHRITT

## 1. Zweck

Das Spiel soll auch dann Fortschritt ermöglichen, wenn der Spieler nicht aktiv spielt.

> "Meine Basis arbeitet weiter, auch wenn ich nicht da bin."

Das Offline-System ist der Kern des Idle-Aspekts.

**Freischaltung:** über den Prestige-Baum (Bereich Wirtschaft, *Offline-Produktion*, 100 Punkte). Die Effizienz lässt sich später steigern (*Verbesserte Simulation*, 500 Punkte).

---

## 2. Grundprinzip

Während der Spieler nicht im Spiel ist:

- kämpft die Basis weiter
- werden Gegnerwellen simuliert
- greifen Türme automatisch an
- entstehen Gold und XP

---

## 3. Unterschied zum aktiven Spiel

| | Aktiv | Offline |
|---|---|---|
| Gold | manuell einsammeln | wird direkt gutgeschrieben |
| Fähigkeiten | einsetzbar | werden nicht berücksichtigt |
| Entscheidungen | jederzeit möglich | keine |
| Basisumbau | jederzeit | nicht möglich |

Offline-Gold wird direkt gutgeschrieben, weil kein Spieler zum Einsammeln anwesend ist. Das manuelle Einsammeln betrifft ausschließlich die aktive Kampfansicht.

---

## 4. Berechnung

Beim erneuten Öffnen des Spiels wird ermittelt:

- vergangene Zeit
- simuliert besiegte Gegner
- erhaltenes Gold und XP
- erreichte Wellen

Die Simulation nutzt die aktuellen Werte der Basis: Hauptturm, platzierte Türme, Upgrades, Buffs und freigeschaltete Helfer. Aktive Spielerfähigkeiten fließen **nicht** ein.

---

## 5. Rückkehr-Zusammenfassung

```
OFFLINE-FORTSCHRITT

Zeit abwesend:            8 Stunden
Besiegte Gegner:          …
Höchste erreichte Welle:  530
Gold erhalten:            +250.000
XP erhalten:              +35.000 (40 Level)
Besondere Ereignisse:     …
```

Erhaltene Levelaufstiege werden gutgeschrieben — die zugehörigen **Level-Perks muss der Spieler weiterhin selbst auswählen**.

---

## 6. Wellenfortschritt offline

Die Simulation berücksichtigt die steigende Schwierigkeit. Schafft die Basis eine Welle nicht mehr, stoppt die Simulation dort.

```
Start bei Welle 300 → simuliert bis Welle 420 → scheitert dort dauerhaft
Beim Zurückkehren: Spieler startet bei Welle 420
```

---

## 7. Grenzen

Offline-Fortschritt ist begrenzt (Richtwert: mehrere Stunden Simulationszeit) und **darf nie stärker sein als aktives Spielen**.

| | Aktiv | Offline |
|---|---|---|
| Vorteil | Gold sammeln, Fähigkeiten, Reaktion, Käufe | sichere Grundproduktion |
| Effizienz | höher | niedriger |

Es findet keine automatische Build-Optimierung statt.

---

## 8. Offline und Prestige

Nach einem Prestige nutzt die Offline-Berechnung die neuen Basiswerte, Prestige-Upgrades und Freischaltungen.

---

# TEIL B – HELFER-SYSTEM

## 9. Zweck

Helfer automatisieren bestimmte Aufgaben. Sie sind **keine Kampfeinheiten** und ersetzen keine Türme — ihre Aufgabe ist Komfort und Effizienz.

---

## 10. Zweistufige Freischaltung

Helfer werden nicht automatisch aktiv:

```
1. Prestige-Baum: Helfer freischalten
        ↓
2. Normales Upgrade-Menü: Helfer mit Gold kaufen
        ↓
3. Helfer ist aktiv
        ↓
4. Helfer verbessern
```

Dadurch behält der Spieler die Kontrolle darüber, wann Automatisierung eingeführt wird. Der Helfer-Bereich im Upgrade-Menü ist erst sichtbar, wenn er im Prestige-Baum freigeschaltet wurde.

---

## 11. Goldsammler

Der erste und wichtigste Helfer.

**Aufgabe:** sammelt automatisch heruntergefallenes Gold auf dem Spielfeld ein. Ohne Helfer sammelt der Spieler selbst; mit Helfer bewegt sich dieser über das Feld und sammelt für ihn.

### Upgrades

| Upgrade | Effekt |
|---|---|
| **Sammelradius** | größere Entfernung, aus der Gold eingesammelt wird (Stufe 1: klein → Stufe 10: groß) |
| **Bewegungsgeschwindigkeit** | Helfer erreicht Münzen schneller |
| **Sammelpriorität** | bevorzugt nahes Gold oder seltene Drops |
| **Anzahl der Helfer** | spätere Upgrades ermöglichen mehrere Helfer (z. B. einer links, einer rechts) |

Offline erhöht der Goldsammler die Goldausbeute.

---

## 12. Weitere mögliche Helfer

| Helfer | Aufgabe | Effekte |
|---|---|---|
| **Reparaturdrohne** | Verteidigung | automatische Reparatur, höhere Überlebensfähigkeit |
| **Wartungsdrohne** | Basisverwaltung | Boni auf Upgrade-Kosten, bessere Effizienz |
| **Forschungseinheit** | langfristige Entwicklung | XP-Boni, Forschungsboni |

---

## 13. Design-Regeln

Helfer sollen:

- den Komfort verbessern
- kleine strategische Vorteile geben
- **nicht stärker sein als Türme**
- keine aktive Entscheidung ersetzen

---

## 14. Visuelles Design

Kleine schwebende Drohnen mit Neonbeleuchtung, klaren Formen und dezenten Animationen. Der Spieler soll sofort erkennen: *"Das arbeitet für meine Basis."*

---

## 15. Ziel

Der Spieler beginnt aktiv — Gold sammeln, alles verwalten. Mit dem Fortschritt kommen mehr Automatisierung, effizientere Abläufe und eine größere Basisverwaltung.
