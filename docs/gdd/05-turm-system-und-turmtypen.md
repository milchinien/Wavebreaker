# 05 – Turm-System und Turmtypen

> Teil 5 von 16 der Game-Design-Dokumentation.

---

## 1. Ziel des Turm-Systems

Jeder Turm soll eine klare Identität besitzen. **Kein Turm ist nur eine stärkere Version eines anderen.**

Jeder Turm hat:

- eine eigene Aufgabe
- eigene Stärken
- eigene Schwächen
- eigene Build-Möglichkeiten

Geplant sind **wenige, aber stark unterschiedliche Türme** — Richtwert: rund 10 Turmtypen bis zum Endgame.

---

## 2. Turm-Datenstruktur

Jeder Turm besteht aus:

**Grundinformationen** — Name, Form, Kategorie, Raritätsbereich, Beschreibung

**Kampfwerte** — Schaden, Angriffstempo, Reichweite, Projektilgeschwindigkeit, Zielanzahl, kritische Trefferchance

**Spezialmechanik** — z. B. Explosion, Durchschuss, Verbrennung, Kettenblitz, Verlangsamung, Buff

**Upgrade-Bereich** — turmspezifische Verbesserungen

---

## 3. Turm-Kategorien

| Kategorie | Aufgabe | Beispiele |
|---|---|---|
| Angriffstürme | direkter Schaden | Maschinengewehr, Kanone, Sniper, Laser, Tesla |
| Flächenschaden-Türme | viele Gegner gleichzeitig | Raketen, Plasma, Flammen |
| Spezialtürme | besondere Mechaniken | Laser, Drohnen, Kontrolle |
| Buff-Türme | andere Türme verbessern | Buff-Modul |
| Unterstützungs-Türme | Utility | Schildgenerator, XP-/Gold-Boni |

---

## 4. Reichweite und Zielerfassung

### Reichweite als Kreis um das eigene Modul

Jeder Turm schießt **rundum** — es gibt keine Schussrichtung und kein begrenztes Schussfeld. Seine Reichweite ist ein Kreis **um sein eigenes Modul**, nicht um das Zentrum der Station.

Daraus folgt der wichtigste taktische Effekt der Platzierung:

| Position | Wirkung |
|---|---|
| weit außen | deckt diese Seite früher ab, greift Gegner eher an, ist aber näher am Kontakt |
| nah am Zentrum | gleichmäßigere Abdeckung, aber weniger Vorwarnzeit an den Rändern |

Weil Gegner **aus allen Richtungen** kommen (→ [07, Abschnitt 2](07-gegner-bosse-und-wellen.md)), entsteht daraus eine echte Entscheidung: gleichmäßig rundum verteidigen oder Schwerpunkte setzen und dafür anderswo Lücken lassen.

### Zielprioritäten

Standard: Gegner in Reichweite → nächster Gegner.

**An der Station angedockte Gegner werden bevorzugt angegriffen** — sie verursachen fortlaufend Schaden und stehen still, sind also das dringendste und einfachste Ziel.

Spezielle Türme können abweichen:

| Turm | Priorität |
|---|---|
| Sniper | stärkster Gegner zuerst |
| Raketen | größte Gegnergruppe |
| Laser | Boss-Fokus |

---

## 5. Turmliste

> **Hinweis zur Form:** Die angegebene Form ist keine reine Optik. Sie legt über ihre Kantenzahl
> fest, wie viele Nachbarn ein Turm haben kann — und damit, wie viele Buff-Verbindungen möglich
> sind. Dreieck 3, Quadrat 4, Pentagon 5, Hexagon 6 → [03, Abschnitt 7](03-modulare-basis-und-bauregeln.md).
> Die Form eines neuen Turms ist deshalb eine Balance-Entscheidung, keine Geschmacksfrage.

> **Hinweis zu den Upgrade-Pfaden:** Alle folgenden Upgrades gelten **pro Turmtyp**, nicht pro einzelnem Turm. Wer den Maschinengewehr-Pfad ausbaut, verstärkt damit alle seine Maschinengewehre gleichzeitig. Individualität entsteht über Rarität und zufällige Eigenschaften → [06](06-turmerwerb-inventar-raritaeten.md), [08, Abschnitt 5.2](08-ressourcen-oekonomie-und-upgrades.md).

### Maschinengewehr

**Form:** Quadrat · **Kategorie:** Angriff · **Rarität:** Common – Mythic

Automatisches Schnellfeuer-Geschütz, der Standardturm für hohes Angriffstempo.

| Wert | Ausprägung |
|---|---|
| Schaden | niedrig |
| Angriffstempo | sehr hoch |
| Reichweite | mittel |

**Stärken:** viele kleine Gegner, schnelle Gegner, günstige Upgrades
**Schwächen:** geringer Einzelzielschaden, schlecht gegen Bosse

**Mögliche Eigenschaften:** Angriffstempo, Schaden, kritische Trefferchance, Projektilgeschwindigkeit, Magazingröße/Projektilanzahl

**Upgrade-Pfad:**

| Stufe | Verbesserung |
|---|---|
| 1 | +Schaden |
| 2 | +Angriffstempo |
| 3 | +Projektile |
| 4 | +Kritische Treffer |
| 5 | Spezialisierung: **A) Sturm-Modus** (noch schneller) oder **B) Panzerbrecher** (mehr Schaden gegen starke Gegner) |

---

### Kanone / Geschütz

**Form:** Quadrat · **Kategorie:** Angriff · **Rarität:** Common – Legendary

Langsames Geschütz mit hoher Feuerkraft.

| Wert | Ausprägung |
|---|---|
| Schaden | sehr hoch |
| Angriffstempo | niedrig |
| Reichweite | hoch |

**Stärken:** Bosse, Tanks, starke Einzelgegner
**Schwächen:** große Gegnergruppen

**Mögliche Eigenschaften:** Schaden, Explosionsradius, Durchschlag, kritischer Schaden, Reichweite

**Upgrade-Pfad:**

| Stufe | Verbesserung |
|---|---|
| 1 | mehr Schaden |
| 2 | mehr Projektilgeschwindigkeit |
| 3 | Explosion |
| 4 | Durchschuss |
| 5 | Spezialisierung: **A) Schwere Munition** (mehr Schaden) oder **B) Explosive Munition** (mehr Flächenschaden) |

---

### Sniper / Scharfschütze

**Form:** Dreieck · **Kategorie:** Angriff · **Rolle:** Langstreckenangriff

| Wert | Ausprägung |
|---|---|
| Schaden | sehr hoch |
| Angriffstempo | sehr niedrig |
| Reichweite | sehr hoch |

**Mögliche Eigenschaften:** Reichweite, Durchschuss, Schaden

---

### Laser-Turm

**Form:** Dreieck / Spezialform · **Kategorie:** Spezial · **Rarität:** Epic+ · **Freischaltung:** Prestige-Baum (250 Punkte)

Feuert einen konzentrierten Energielaser mit kontinuierlichem Schaden.

**Stärken:** extrem hoher Einzelzielschaden, Bosse, Tanks
**Schwächen:** weniger effektiv gegen Massen, hohe Kosten

**Besondere Werte / Upgrades:** Laserbreite, Laserdauer, Laserstärke, Durchdringung, Mehrfachstrahl, Energiekosten

---

### Raketen-Turm

**Form:** Dreieck / Spezialform · **Kategorie:** Flächenschaden · **Rarität:** Rare+ · **Freischaltung:** Prestige-Baum (150 Punkte)

Feuert explosive Raketen.

**Stärken:** große Gegnergruppen
**Schwächen:** langsame Angriffe, einzelne starke Ziele

**Upgrades:** Explosionsradius, Raketenanzahl, Explosionsschaden, Nachbrenner

---

### Tesla-Turm

**Form:** Hexagon · **Kategorie:** Spezial · **Rarität:** Epic+ · **Freischaltung:** Prestige-Baum (500 Punkte)

Elektrische Energie springt zwischen Gegnern.

**Stärken:** Gruppen, schnelle Gegner
**Schwächen:** geringer Schaden pro Einzelziel, einzelne Bosse

**Upgrades:** mehr Ketten/Sprünge, mehr Reichweite, mehr Schaden

---

### Flammen-Turm

**Form:** Dreieck · **Kategorie:** Schaden über Zeit · **Rarität:** Rare+

Verbrennt Gegner dauerhaft.

**Effekte:** Feuerschaden, Verlangsamung, Explosion bei Tod, Flächenschaden

**Upgrades:** Verbrennungsdauer, Feuerschaden, Flammenradius

---

### Element-Türme

Varianten: **Feuer, Eis, Blitz, Plasma**

Eigenschaften: Elementschaden, Effektchance, Effektstärke.

Der Fokus liegt auf besonderen Effekten statt auf reinem Mehrschaden.

---

### Drohnen-Modul

**Form:** Kreis (Grundfläche Hexagon, 6 Kanten) · **Kategorie:** Spezial · **Rarität:** Legendary+ · **Freischaltung:** Prestige-Baum (2.000 Punkte)

Erzeugt kleine Kampfdrohnen, die Gegner angreifen, den Hauptturm unterstützen und ggf. Ressourcen einsammeln.

**Upgrades:** mehr Drohnen, mehr Schaden, schnellere Drohnen

---

### Schildgenerator

**Form:** Hexagon · **Kategorie:** Support · **Rarität:** Epic+

Verstärkt die Verteidigung der gesamten Station.

**Effekte:** mehr Stations-HP, Schadensreduzierung, Regeneration, zusätzliche Schilde — alles wirkt auf die gemeinsame Lebensleiste → [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md)

---

### Plasma-Turm

**Form:** Spezialform (Grundfläche Pentagon, 5 Kanten) · **Kategorie:** Endgame · **Rarität:** Legendary+ · **Freischaltung:** Prestige-Baum (10.000 Punkte)

Feuert instabile Plasmaenergie; Projektile explodieren.

**Effekte:** Explosion, Flächenschaden, Durchschlag

---

### Void-Turm

**Rarität:** Mythic

Erzeugt schwarze Energiekugeln. Besonderheit: verlangsamt Gegner.

---

### Buff-Turm

**Form:** Pentagon · **Kategorie:** Support · **Rarität:** Common – Mythic

Verursacht keinen oder nur minimalen Schaden, verstärkt stattdessen angrenzende Türme.

**Mögliche Buffs:** Angriffstempo, Schaden, Reichweite, kritische Trefferchance, Projektilgeschwindigkeit

**Eigene Eigenschaften/Upgrades:** Buffstärke, Anzahl beeinflusster Türme

> **Pentagon ist kein Zufall.** Fünf Anschlusskanten heißt: bis zu fünf verstärkte Nachbarn. Da ein
> Buff-Turm einen vollen Turmplatz kostet, muss seine Stärke über der Schwelle `b > 1/k` liegen —
> bei 4 erreichten Modulen also über 25 %. Ein Buff-Turm, der nur ein Modul erreicht, ist immer die
> schlechtere Wahl gegenüber einem weiteren Kampfturm.
>
> Praktische Folge: Buff-Türme werden **früh** gesetzt und dann umbaut, nicht am Ende angeflanscht.

Regeln, Schwellenwerte und Beispiele: → [03, Abschnitt 9](03-modulare-basis-und-bauregeln.md)

---

## 6. Spezialtürme sind keine besseren Türme

Spezialtürme sind nicht einfach stärker — sie **verändern den Spielstil**.

| Turm | Stärke | Preis dafür |
|---|---|---|
| Laser | einzelne Ziele | hohe Kosten |
| Tesla | Gruppen | weniger Schaden pro Ziel |
| Raketen | Flächen | langsame Angriffe |

---

## 7. Turm-Kapazität

Der Spieler besitzt keine große Armee. Die Stärke entsteht durch:

- richtige Auswahl
- richtige Kombination
- gute Raritäten
- gute Eigenschaften

Jeder einzelne Turm ist wichtig.

---

## 8. Ziel des Turm-Systems

Das Ziel ist nicht *"den stärksten Turm besitzen"*, sondern:

> "Die perfekte Kombination aus Türmen, Eigenschaften und Buffs erschaffen."

Eine Basis kann bestehen aus vielen schnellen Türmen, wenigen extrem starken Spezialtürmen oder einer perfekten Buff-Struktur — alle Wege sollen funktionieren.

