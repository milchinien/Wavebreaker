# 16 – Technische Umsetzung und Entwicklungsplan

> Teil 16 von 16 der Game-Design-Dokumentation.

Dieses Dokument beschreibt keinen Programmcode, sondern die Struktur und Denkweise, mit der das Spiel gebaut werden soll: **ein modulares System, das später einfach erweitert werden kann.**

---

## 1. Technische Rahmenentscheidungen

| Thema | Entscheidung |
|---|---|
| **Titel** | WELLENBRECHER (deutsch) / **WAVEBREAKER** (im Spiel) → [01, Abschnitt 1a](01-spielvision-und-grundkonzept.md) |
| **Plattform** | Web — läuft im Browser, keine Installation |
| **Sprache/Technik** | TypeScript mit HTML5-Canvas, keine Game-Engine |
| **UI** | HTML/CSS für Menüs und Panels, Canvas für Kampfansicht und Baufläche |
| **Bausystem-Geometrie** | Kantensystem: regelmäßige Vielecke mit einheitlicher Seitenlänge, Andockung an freie Kanten, kein Raster → [03](03-modulare-basis-und-bauregeln.md) |
| **Spielsprache** | **Englisch** (UI, Turmnamen, alle Spielertexte) |
| **Dokumentationssprache** | Deutsch (dieses GDD) |
| **Monetarisierung** | im Prototyp keine — Architektur hält sie sich aber offen (siehe Abschnitt 2) |

**Begründung Canvas statt Engine:** Das Spiel besteht aus geometrischen Neon-Formen ohne Sprites, Physik oder Szenengraph. Eine Engine bringt hier mehr Overhead als Nutzen, während direkter Canvas-Zugriff schnelles Iterieren und volle Kontrolle über Rendering und Object-Pooling erlaubt. Eine spätere Desktop-Verpackung (z. B. Tauri oder Electron) bleibt jederzeit möglich.

**Sprachtrennung:** Da die Spielsprache Englisch ist, das GDD aber Deutsch, gilt: Alle im GDD deutsch benannten Konzepte bekommen im Code englische Bezeichner. Beispiele: Buff-Turm → `SupportModule` / "Amplifier", Hauptturm → `Core`, Welle → `Wave`, Versorgungskapsel → `Supply Pod`, Maschinengewehr → `Autocannon` oder `Machine Gun`. Die Kernnamen (Sentinel Core, Vulcan Core, …) sind bereits englisch und bleiben unverändert.

Alle Spielertexte laufen von Anfang an über eine zentrale Textdatei, damit später eine deutsche Fassung nachgerüstet werden kann, ohne Code anzufassen.

---

## 2. Vorbereitung auf spätere Monetarisierung

Der Prototyp enthält **keine** Werbung, keine Käufe und kein Tracking. Die Architektur wird aber so gebaut, dass eine spätere Monetarisierung nachrüstbar ist, ohne das Spiel umzubauen.

Konkret bedeutet das:

| Vorkehrung | Warum |
|---|---|
| **Belohnungen laufen über eine zentrale Stelle** (`grantReward`) statt verstreut im Code | Werbe-Belohnungen („doppelter Offline-Ertrag") lassen sich später anhängen, ohne die Spiellogik anzufassen |
| **Spielstand ist ein klar getrenntes, versioniertes Datenobjekt** | ermöglicht später Server-Sync, Wiederherstellung und Kaufvalidierung |
| **Alle Zeitwerte laufen über eine zentrale Zeitquelle** | Voraussetzung für Zeitraffer-Boosts und manipulationssichere Offline-Berechnung |
| **Freischaltungen sind Daten, keine Codeverzweigungen** | ein gekaufter Inhalt ist dann nur ein weiterer Flag-Eintrag |
| **Keine Design-Entscheidungen, die auf Frust bauen** | Wartezeiten, Energie-Systeme und künstliche Bremsen werden bewusst vermieden — das Spiel muss ohne Monetarisierung vollständig funktionieren |

**Wichtig:** Das Spiel wird als vollständiges, faires Spiel entworfen. Eine spätere Monetarisierung darf nur additiv sein (Komfort, optionale Boosts), nicht durch nachträgliches Einbremsen entstehen.

---

## 3. Grundprinzip

Das Spiel soll nicht als ein großes System gebaut werden, sondern aus einzelnen Modulen bestehen. Jedes große Feature ist ein eigenes System.

```
Gegner-System  →  Gegnerwerte, Bewegung, Belohnungen
Turm-System    →  Angriff, Werte, Upgrades
Prestige-System →  permanente Freischaltungen
```

---

## 4. Hauptsysteme

| System | Verantwortlich für |
|---|---|
| **Kampf-System** | Wellen, Gegner, Schaden, Angriffe, Bosskämpfe |
| **Turm-System** | Turmtypen, Platzierung, Angriffe, Eigenschaften, Upgrades |
| **Ressourcen-System** | Gold, XP, Prestige-Punkte |
| **Progressions-System** | Level, Perks, Prestige, Freischaltungen |
| **UI-System** | Menüs, Anzeigen, Buttons, Informationen |

---

## 5. Datenbasierte Entwicklung

Alle wichtigen Inhalte werden über **Daten** definiert, nicht im Code verdrahtet.

Ein neuer Turm soll allein durch Datenfelder hinzufügbar sein: Name, Form, Schaden, Angriffstempo, Reichweite, Seltenheit, Fähigkeiten.

**Regel:** Spielbalance wird über Werte geändert, nicht über Code.

---

## 6. Datenstrukturen

### Turm

| Gruppe | Felder |
|---|---|
| Grunddaten | Name, Form, Typ, Rarität, Beschreibung |
| Kampfwerte | Schaden, Angriffstempo, Reichweite, Projektilgeschwindigkeit, kritische Trefferchance, Zielanzahl |
| Spezialwerte | Explosion, Durchschuss, Element, Buff-Effekt |
| Upgrade-Daten | Kosten, Verbesserungen, Maximalwerte |

### Gegner

| Gruppe | Felder |
|---|---|
| Grunddaten | Name, Form, Farbe, Größe |
| Kampfwerte | HP, Geschwindigkeit, Widerstände, Schaden |
| Belohnungen | Gold, XP |
| Spezialfähigkeiten | Schild, Heilung, Teleport, Tarnung, Beschwörung |

### Welle

Wellen werden **dynamisch erzeugt**, nicht einzeln definiert.

| Feld | Beschreibung |
|---|---|
| Nummer | aktuelle Welle |
| Gegneranzahl | Gesamtzahl |
| Gegnerarten | welche Typen enthalten sind |
| Stärke-Multiplikator | Skalierungsfaktor |
| Bosschance / Boss-Flag | alle 10 Wellen |

Beispiel Welle 100: 50 Standard-Gegner, 10 schnelle Gegner, 3 Tanks, 1 Boss.

---

## 7. Modulares Bausystem

Benötigte Funktionen:

**Geometrie** — regelmäßige Vielecke mit einheitlicher Seitenlänge erzeugen, ein Vieleck an eine
vorgegebene Kante andocken, Überlappung zweier Vielecke prüfen
**Positionierung** — freie Kanten bestimmen, nächstgelegene Kante wählen, einrasten
**Verbindungen** — Nachbarschaft über deckungsgleiche Kanten, Buff-Verbindungen, Zusammenhang zum
Hauptturm per Breitensuche
**Verwaltung** — hinzufügen, verschieben, entfernen samt Rückwanderung abgetrennter Module

### Erprobte Umsetzungsdetails

Aus Prototyp 01 ([`prototypes/01-tower-building/`](../../prototypes/01-tower-building/)) übernehmbar:

| Punkt | Lösung |
|---|---|
| Andockung | Mittelpunkt = Kantenmitte + Außennormale × Inkreisradius; die Drehung folgt aus dem Kantenendpunkt. Pro Kante genau eine Lage, weil regelmäßige Vielecke rotationssymmetrisch sind |
| Gemeinsame Kante | Endpunktvergleich mit Toleranz (bewährt: Seitenlänge × 10⁻³). Kein Verschweißen der Ecken nötig, der Gleitkommafehler liegt Größenordnungen darunter |
| Überlappung | Separating-Axis-Test; beide Vielecke vorher um ~0,3 % zum Mittelpunkt schrumpfen, damit *Berührung* nicht als Überlappung zählt. Vorprüfung über Umkreisabstand |
| Zustand | Weltkoordinaten (Mittelpunkt + Drehung) als Wahrheit, nicht ein Andock-Baum. Entfernen bleibt dadurch trivial, Nachbarschaft wird rein geometrisch bestimmt |
| Speicherformat | `{ defId, rarity, cx, cy, rot }` je Modul, auf 3 Nachkommastellen gerundet. 11 Module plus Inventar ≈ 1,4 KB |

### Buff-Berechnung

```
Station verändert
      ↓
Kantennachbarschaft neu bestimmen
      ↓
Buff-Türme wirken auf ihre Kantennachbarn
      ↓
Boni je Wert addieren, dann deckeln
      ↓
Effektivwerte anwenden
```

Regeln im Code:

- Buff-Türme buffen keine Buff-Türme
- nur ganze gemeinsame Kanten zählen, Eckberührung nicht
- der Hauptturm wird mitgebufft
- **vollständig neu rechnen statt fortschreiben** — bei 21 Modulen zusammen mit der
  Kantenbestimmung unter 1 ms, und nur bei Änderungen, nicht pro Bild

→ [03 – Modulare Basis und Bauregeln](03-modulare-basis-und-bauregeln.md)

---

## 8. Speichersystem

### Speicherzeitpunkte

Das Spiel speichert **automatisch und fortlaufend** — es gibt keinen manuellen Speichern-Knopf und keine Speicherstände.

| Auslöser | Grund |
|---|---|
| alle paar Sekunden im Hintergrund | Absturzsicherheit ohne spürbare Last |
| bei jedem relevanten Ereignis (Kauf, Levelaufstieg, Wellenwechsel, Prestige) | wichtige Fortschritte gehen nie verloren |
| beim Schließen des Tabs / Fensters | sauberer Zeitstempel für die Offline-Berechnung |

Der Zeitstempel des letzten Speicherns ist zugleich die Grundlage der Offline-Simulation (Abschnitt 9).

### Datenumfang

| Permanente Daten | Run-Daten |
|---|---|
| Prestige-Punkte | aktuelle Welle **und Wellenrekord des Runs** |
| Prestige-Upgrades | Gold |
| freigeschaltete Türme | Türme (platziert + Inventar) |
| freigeschaltete Haupttürme | gekaufte Upgrades |
| freigeschaltete Raritäten und Eigenschaften | Level, XP, Perks, Fähigkeiten |

---

## 9. Offline-System

```
Gespeicherter Zeitpunkt des letzten Spielens
      ↓
Beim Start: Zeitdifferenz berechnen
      ↓
Fortschritt simulieren (mit aktuellen Basiswerten)
      ↓
Belohnung gutschreiben + Zusammenfassung anzeigen
```

→ [12 – Offline-Fortschritt und Helfer](12-offline-fortschritt-und-helfer.md)

---

## 10. Entwicklungsreihenfolge

### Phase 1 – Grundspiel (spielbarer Prototyp)

Hauptturm · Gegner · automatische Angriffe · Wellen · Gold · einfache Upgrades

### Phase 2 – Basis-System

Turmplatzierung · modulare Struktur · Inventar · Turmkauf

### Phase 3 – Progression

Level · XP · Level-Perks · Prestige

### Phase 4 – Erweiterte Systeme

Raritäten · Eigenschaften · Spezialtürme · Hauptturm-Auswahl

### Phase 5 – Komfortsysteme

Offline-Fortschritt · Helfer · zusätzliche UI · Effekte

---

## 11. Minimal spielbare Version (MVP)

**Enthalten:**

✓ Hauptturm
✓ Gegnerwellen
✓ automatische Angriffe
✓ Gold sammeln
✓ Upgrades
✓ einfache Türme
✓ Basis bauen

**Noch nicht nötig:**

✗ Mythic-Raritäten
✗ viele Spezialtürme
✗ komplexe Prestige-Bäume
✗ viele Gegnerarten

### Erweiterung nach dem MVP

| Update | Inhalt |
|---|---|
| 1 | mehr Türme |
| 2 | Prestige-System |
| 3 | Raritäten |
| 4 | Spezialtürme |
| 5 | Endgame-Systeme |

---

## 12. Simulation und Performance

### Feste Zeitschritte

Die Spielsimulation läuft mit **festen Zeitschritten** (z. B. 60 Ticks/s), entkoppelt vom Rendering.

Das ist Voraussetzung für:

- die **Spielgeschwindigkeit ×2 / ×4** (mehr Ticks pro Frame statt größerer Schritte) → [10](10-prestige-system.md)
- die **Offline-Simulation**, die dieselbe Logik im Schnelldurchlauf ausführt
- reproduzierbares Verhalten unabhängig von der Bildrate

### Performance

Da die Wellen theoretisch unendlich skalieren:

- Gegneranzahl begrenzen (Obergrenze gleichzeitiger Gegner)
- Objekte wiederverwenden (Object Pooling für Gegner und Projektile)
- **Goldmünzen zu Stapeln verschmelzen**, da sie nie verfallen → [08](08-ressourcen-oekonomie-und-upgrades.md)
- Animationen optimieren, unnötige Berechnungen vermeiden

---

## 13. Design-Prinzipien für die Umsetzung

1. Jedes System getrennt halten.
2. Keine fest verdrahteten Werte im Code verteilen.
3. Neue Türme und Gegner müssen einfach hinzufügbar sein.
4. UI und Gameplay trennen.
5. Spielbalance über Werte ändern, nicht über Code.

---

## 14. Prioritätenliste

| Priorität | Features |
|---|---|
| 1 | modulare Basis, automatischer Kampf, Turm-System |
| 2 | Gold-System, Upgrades, Wellen |
| 3 | Prestige, Raritäten, Eigenschaften |
| 4 | Spezialtürme, Helfer, Offline-Fortschritt |
| 5 | weitere Inhalte: neue Gegner, neue Bosse, neue Systeme |

---

## 15. Offene technische Entscheidungen

| Frage | Status |
|---|---|
| Umgang mit sehr großen Zahlen (Endgame-Skalierung) | offen — vermutlich eigener BigNumber-Typ (Mantisse + Exponent) statt `number` |
| Speicherformat und Cloud-Sync | offen — Start mit `localStorage`, Export/Import später |
| Rendering-Budget (max. gleichzeitige Gegner/Projektile) | offen — im Prototyp messen |

Plattform, Technik, Bausystem-Geometrie und Spielsprache sind in Abschnitt 1 festgelegt.

---

## 16. Endgültige Vision

Das Spiel soll sich anfühlen wie eine futuristische Kampfstation, die über viele Runs hinweg wächst.

Der Spieler baut nicht einfach eine Ansammlung von Türmen — er erschafft seine eigene einzigartige Maschine.

Jede Basis erzählt eine Geschichte: welche Türme gewählt wurden, welche Raritäten gefunden wurden, welche Entscheidungen getroffen wurden, welche Prestige-Upgrades erreicht wurden.
