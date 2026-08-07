# GAME DESIGN DOCUMENT v1.0

## Arbeitstitel:
Noch nicht festgelegt

---

# TEIL 1: SPIELVISION, GRUNDKONZEPT UND KERNSYSTEME

---

# 1. Spielübersicht

## Genre

Das Spiel ist ein futuristisches:

- Idle Incremental Game
- Auto-Battle Spiel
- Modular Base Builder
- Progressionsspiel

Das Spiel kombiniert:

- automatische Kämpfe gegen endlose Gegnerwellen
- langfristige Meta-Progression
- modulare Kampfstation-Erweiterung
- zufällige Turmauswahl
- Raritätensystem
- Prestige-System
- aktive Entscheidungen während eines automatisierten Kampfes

---

# 2. High Concept

Der Spieler kontrolliert keine Figur und keine Armee.

Der Spieler kontrolliert eine futuristische Kampfstation mit einem zentralen Hauptturm.

Dieser Hauptturm kämpft automatisch gegen immer stärker werdende Gegnerwellen.

Während des Spiels baut der Spieler seine Kampfstation weiter aus:

- neue Kampftürme
- Buff-Türme
- Spezialtürme
- bessere Raritäten
- stärkere Haupttürme
- permanente Prestige-Upgrades

Das langfristige Ziel ist:

Die höchste mögliche Welle erreichen und eine immer stärkere, individuelle Kampfmaschine erschaffen.

---

# 3. Design-Philosophie

Das Spiel basiert auf fünf Hauptsäulen.

---

## Säule 1: Endlose Progression

Der Spieler soll immer das Gefühl haben, dass es noch weitergeht.

Es gibt:

- unendlich viele Wellen
- immer stärkere Gegner
- neue Gegnerarten
- neue Turmtypen
- neue Haupttürme
- neue Prestige-Upgrades
- bessere Raritäten

Eine Niederlage bedeutet nicht das Ende.

Eine Niederlage zeigt nur:

"Dieser Punkt ist meine aktuelle Grenze."

Der Spieler verbessert seine Kampfstation und versucht erneut, diese Grenze zu überwinden.

---

## Säule 2: Die eigene Kampfstation

Das wichtigste Alleinstellungsmerkmal des Spiels ist der modulare Aufbau der Basis.

Der Spieler baut nicht einfach einzelne Türme auf einer Karte.

Er erschafft eine zusammenhängende futuristische Kampfstation.

Jede Station kann unterschiedlich aussehen und unterschiedlich funktionieren.

Beispiel:

Spieler A:

- viele schnelle Angriffstürme
- Fokus auf Angriffstempo
- offensive Spielweise

Spieler B:

- wenige starke Spezialtürme
- viele Buff-Türme
- Fokus auf Effizienz

Beide Spieler können dieselben Systeme besitzen, aber völlig unterschiedliche Builds erstellen.

---

## Säule 3: Automatisierung mit aktiven Entscheidungen

Der Kampf läuft automatisch.

Der Spieler muss nicht dauerhaft eingreifen.

Trotzdem trifft der Spieler wichtige Entscheidungen:

- Wann kaufe ich neue Türme?
- Welche Türme verwende ich?
- Wann mache ich Prestige?
- Welche Upgrades kaufe ich?
- Welche Fähigkeit nutze ich?
- Wie optimiere ich meine Kampfstation?

---

## Säule 4: Jeder Turm ist einzigartig

Türme sind keine einfachen Kopien.

Jeder einzelne Turm besitzt:

- einen eigenen Turmtyp
- eine eigene Rarität
- eigene Eigenschaften
- eigene Werte

Beispiel:

Nicht:

"Maschinengewehr"

Sondern:

"Legendäres Maschinengewehr MK-04"

mit:

- erhöhtem Schaden
- höherem Angriffstempo
- spezieller Eigenschaft

---

## Säule 5: Langfristige Motivation

Das Spiel soll über viele Stunden und viele Prestiges motivieren.

Der Spieler erlebt:

Anfang:

"Ich kämpfe um jede Münze."

Mitte:

"Meine Kampfstation wird immer größer und stärker."

Später:

"Ich optimiere jeden einzelnen Turm."

Endgame:

"Ich erschaffe eine extrem seltene und mächtige Kampfmaschine."

---

# 4. Kern-Spielschleife

Die komplette Hauptspielschleife:

Gegnerwellen bekämpfen

↓

Gegner besiegen

↓

Gold und XP erhalten

↓

Gold einsammeln

↓

Turm-Upgrades kaufen

↓

Neue Türme erhalten

↓

Kampfstation verbessern

↓

Höhere Wellen erreichen

↓

Neue Grenze erreichen

↓

Prestige durchführen

↓

Permanente Verbesserungen kaufen

↓

Stärker zurückkehren

---

# 5. Die zwei Hauptansichten

Das Spiel besitzt zwei zentrale Bereiche.

---

# 5.1 Kampfansicht

Die Kampfansicht zeigt die aktive Schlacht.

Der Spieler sieht:

- Hauptturm
- angebaute Türme
- Gegner
- Geschosse
- Schaden
- XP
- fallende Münzen
- Wellenanzeige
- Boss-Lebensleiste

---

## Funktionen der Kampfansicht

### Gold sammeln

Besiegte Gegner lassen Münzen fallen.

Der Spieler sammelt diese durch:

- Mausbewegung
- Hover über die Münzen

---

### Fähigkeiten benutzen

Der Spieler kann aktive Fähigkeiten verwenden.

Beispiele:

- Spezialangriffe
- Schadensverstärkung
- Verteidigungsfähigkeiten

---

### Turm-Upgrades kaufen

Während des Kampfes können Türme verbessert werden.

Beispiele:

Maschinengewehr:

- Schaden erhöhen
- Angriffstempo erhöhen
- Reichweite erhöhen

---

# 5.2 Basisansicht

Die Basis ist der Verwaltungsbereich.

Der Kampf läuft währenddessen weiter.

Der Spieler kann:

- Türme kaufen
- Türme platzieren
- Türme entfernen
- Inventar verwalten
- Prestige durchführen
- dauerhafte Upgrades kaufen

Das zentrale Gefühl:

"Meine Kampfstation kämpft weiter, während ich sie verbessere."

---

# 6. Spielstart

Der Spieler beginnt mit:

- einem einfachen Hauptturm
- wenigen Möglichkeiten
- einfachen Gegnern

Der Spieler lernt:

1. Gegner erscheinen.
2. Der Hauptturm greift automatisch an.
3. Gegner lassen Gold fallen.
4. Gold wird gesammelt.
5. Erste Upgrades werden gekauft.

Die ersten Minuten sollen schnell zeigen:

"Meine Maschine wird stärker."

---

# 7. Kampf-System

Der Kampf läuft vollständig automatisch.

Türme:

- suchen automatisch Ziele
- greifen automatisch an
- verwenden ihre eigenen Angriffsmuster

---

## Zielprioritäten

Standard:

1. Gegner in Reichweite
2. nächster Gegner

Spezielle Türme können andere Prioritäten besitzen.

Beispiele:

Sniper:

- stärkster Gegner zuerst

Raketen:

- größte Gegnergruppe

Laser:

- Boss-Fokus

---

# 8. Wellen-System

Das Spiel besitzt unendlich viele Wellen.

Jede Welle erhöht:

- Gegner-HP
- Gegner-Schaden
- Gegneranzahl
- Belohnungen

---

## Wellenstruktur

Beispiel:

Welle 1-10:

Normale Gegner

Welle 10:

Mini-Boss

Welle 20:

Mini-Boss

Welle 50:

Elite-Gegner

Welle 100:

Boss

Danach wiederholt sich das System mit steigender Schwierigkeit.

---

# 9. Niederlage-System

Das Spiel besitzt kein klassisches Game Over.

Wenn der Hauptturm zerstört wird:

- die aktuelle Welle startet erneut
- der Spieler verliert keinen permanenten Fortschritt
- der Spieler kann seine Station verbessern

Beispiel:

Der Spieler verliert bei Welle 250.

Danach:

- Welle 250 beginnt erneut
- bessere Upgrades können gekauft werden
- neue Türme können eingesetzt werden

---

# 10. Boss-System

Alle 10 Wellen erscheint ein Mini-Boss.

---

## Eigenschaften:

Bosse sind:

- deutlich größer
- langsamer
- besitzen viel mehr HP
- besitzen eine eigene Boss-Lebensleiste
- optisch einzigartig

Während des Bosskampfes erscheinen weiterhin normale Gegner.

Der Spieler muss also gleichzeitig den Boss und die normale Gegnerwelle überleben.

---

## Boss-Belohnungen:

Bosse geben:

- mehr Gold
- mehr XP

Bosse geben keine exklusiven Gegenstände.

---

# 11. Gegner-System

Gegner werden hauptsächlich durch Form und Farbe unterschieden.

Der Spieler soll sofort erkennen können, welche Gefahr auf ihn zukommt.

---

## Normaler Gegner

Form:

Quadrat

Farbe:

Rot

Eigenschaften:

- normale Geschwindigkeit
- normale Lebenspunkte

---

## Schneller Gegner

Form:

Quadrat

Farbe:

Gelb

Eigenschaften:

- hohe Geschwindigkeit
- weniger Lebenspunkte

---

## Tank-Gegner

Form:

Hexagon

Eigenschaften:

- sehr viele Lebenspunkte
- langsame Bewegung

---

## Weitere Gegner im späteren Spiel:

- Schildgegner
- Heiler
- Flieger
- Teleporter
- Tarngegner
- Beschwörer
- Elitevarianten

Neue Gegner werden durch höhere Wellenabschnitte eingeführt.

---

# 12. Grafikstil

## Allgemeiner Stil

Futuristisch.

Die Optik soll sein:

- clean
- modern
- dunkel
- neonbeleuchtet

---

## Hintergrund

Grundfarbe:

Dunkelblau

Der Hintergrund enthält:

- sehr dezente geometrische Formen
- hauptsächlich Rechtecke
- technische Muster

Der Hintergrund soll nur auffallen, wenn man bewusst darauf achtet.

---

## Neon-Raritätssystem

Die Rarität eines Turms beeinflusst seine Umrandung und Leuchteffekte.

Common:

Grau

Rare:

Grün

Epic:

Blau

Legendary:

Gold

Mythic:

Rot

---

# Ende Teil 1
