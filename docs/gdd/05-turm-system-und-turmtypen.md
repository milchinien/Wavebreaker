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

Jeder Turm trägt **zwei** Einordnungen, und sie beantworten verschiedene Fragen. Sie
auseinanderzuhalten ist wichtig genug für einen eigenen Abschnitt: Wer sie zusammenlegt,
ändert eine Balanceregel, sobald er ein Upgrade umbenennt.

### 3.1 Kategorie — die Kampfregel

Sie entscheidet, **wer buffen darf und wer gebufft wird** (→ [03, Abschnitt 9](03-modulare-basis-und-bauregeln.md)).

| Kategorie | Aufgabe | Beispiele |
|---|---|---|
| Angriffstürme | direkter Schaden | Maschinengewehr, Kanone, Sniper, Laser, Tesla |
| Flächenschaden-Türme | viele Gegner gleichzeitig | Raketen, Plasma, Flammen |
| Spezialtürme | besondere Mechaniken | Laser, Drohnen, Kontrolle |
| Buff-Türme | andere Türme verbessern | Buff-Modul |
| Unterstützungs-Türme | Utility | Schildgenerator, XP-/Gold-Boni |

### 3.2 Klasse — die Vokabel des Spielers

> **Neu am 10.08.2026**, mit dem Upgrade-Katalog (→ [08, Abschnitt 5.2](08-ressourcen-oekonomie-und-upgrades.md)).

Sie steht in Upgrades und Hinweisen und **sonst nirgends**. Jeder Turm gehört genau einer an.

| Klasse | Türme | Was sie eint |
|---|---|---|
| **Kinetic** | Autocannon, Siege Cannon, Marksman, Rocket Battery | verschießt Materie |
| **Elemental** | Laser, Tesla, Flammen, Cryo, Plasma, Void | verschießt Energie |
| **Support** | Verstärker, Schildgenerator, Drohnenbucht | schießt gar nicht |

Sie ist der Grund, warum das Upgrade-Menü nicht in sechzig Einzelpfade zerfällt: *„Alle
Elemental-Türme +5 % Schaden"* verbindet sechs Turmarten zu **einer** Entscheidung.

**Die beiden sind bewusst nicht deckungsgleich.** Der Flammenturm ist ein
Flächenschaden-Turm und elementar; der Laser ein Spezialturm und ebenso elementar. Gäbe es zu
jeder Klasse genau eine Kategorie, wäre die Klasse nur eine Umbenennung — und wer sie später
änderte, verschöbe unbemerkt, wer wen buffen darf.

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
> sind. Es gibt genau drei Formen: Dreieck 3, Quadrat 4, Hexagon 6. Warum kein Pentagon, und warum
> die Kantenzahl der **Raritätsuntergrenze** folgt (Common → Dreieck, Rare/Epic → Quadrat,
> Legendary/Mythic → Hexagon), steht in → [03, Abschnitt 7](03-modulare-basis-und-bauregeln.md).
> Die Form eines neuen Turms ist deshalb eine Balance-Entscheidung, keine Geschmacksfrage — und sie
> ist keine freie Wahl mehr, sondern ergibt sich aus der Rarität.

> **Hinweis zu den Upgrade-Pfaden:** Alle folgenden Upgrades gelten **pro Turmtyp**, nicht pro einzelnem Turm. Wer den Maschinengewehr-Pfad ausbaut, verstärkt damit alle seine Maschinengewehre gleichzeitig. Individualität entsteht über Rarität und zufällige Eigenschaften → [06](06-turmerwerb-inventar-raritaeten.md), [08, Abschnitt 5.2](08-ressourcen-oekonomie-und-upgrades.md).

### Maschinengewehr

**Form:** Dreieck · **Kategorie:** Angriff · **Rarität:** Common – Mythic

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

**Form:** Dreieck · **Kategorie:** Angriff · **Rarität:** Common – Legendary

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

**Form:** Quadrat · **Kategorie:** Spezial · **Rarität:** Epic+ · **Freischaltung:** Prestige-Baum (250 Punkte)

Feuert einen konzentrierten Energielaser mit kontinuierlichem Schaden.

**Stärken:** extrem hoher Einzelzielschaden, Bosse, Tanks
**Schwächen:** weniger effektiv gegen Massen, hohe Kosten

**Besondere Werte / Upgrades:** Laserbreite, Laserdauer, Laserstärke, Durchdringung, Mehrfachstrahl, Energiekosten

---

### Raketen-Turm

**Form:** Quadrat · **Kategorie:** Flächenschaden · **Rarität:** Rare+ · **Freischaltung:** Prestige-Baum (150 Punkte)

Feuert explosive Raketen.

**Stärken:** große Gegnergruppen
**Schwächen:** langsame Angriffe, einzelne starke Ziele

**Upgrades:** Explosionsradius, Raketenanzahl, Explosionsschaden, Nachbrenner

---

### Tesla-Turm

**Form:** Quadrat · **Kategorie:** Spezial · **Rarität:** Epic+ · **Freischaltung:** Prestige-Baum (500 Punkte)

Elektrische Energie springt zwischen Gegnern.

**Stärken:** Gruppen, schnelle Gegner
**Schwächen:** geringer Schaden pro Einzelziel, einzelne Bosse

**Upgrades:** mehr Ketten/Sprünge, mehr Reichweite, mehr Schaden

---

### Flammen-Turm

**Form:** Quadrat · **Kategorie:** Schaden über Zeit · **Rarität:** Rare+

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

**Form:** Quadrat · **Kategorie:** Support · **Rarität:** Epic+

Verstärkt die Verteidigung der gesamten Station.

**Effekte:** mehr Stations-HP, Schadensreduzierung, Regeneration, zusätzliche Schilde — alles wirkt auf die gemeinsame Lebensleiste → [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md)

---

### Plasma-Turm

**Form:** Spezialform (Grundfläche Hexagon, 6 Kanten) · **Kategorie:** Endgame · **Rarität:** Legendary+ · **Freischaltung:** Prestige-Baum (10.000 Punkte)

Feuert instabile Plasmaenergie; Projektile explodieren.

**Effekte:** Explosion, Flächenschaden, Durchschlag

---

### Void-Turm

**Form:** Hexagon · **Kategorie:** Spezial · **Rarität:** Mythic

Erzeugt schwarze Energiekugeln. Besonderheit: verlangsamt Gegner.

---

### Buff-Turm

**Form:** Hexagon · **Kategorie:** Support · **Rarität:** Common – Mythic

Verursacht keinen oder nur minimalen Schaden, verstärkt stattdessen angrenzende Türme.

**Mögliche Buffs:** Angriffstempo, Schaden, Reichweite, kritische Trefferchance, Projektilgeschwindigkeit

**Eigene Eigenschaften/Upgrades:** Buffstärke, Anzahl beeinflusster Türme

> **Hexagon ist kein Zufall — und die einzige Ausnahme von der Formleiter.** Der Buff-Turm fällt ab
> Common und wäre nach → [03, Abschnitt 7.2](03-modulare-basis-und-bauregeln.md) ein Dreieck. Bei
> ihm sind Kanten aber keine Stärke, sondern Funktion: Sechs Anschlusskanten heißt bis zu sechs
> verstärkte Nachbarn. Da ein Buff-Turm einen vollen Turmplatz kostet, muss seine Stärke über der
> Schwelle `b > 1/k` liegen — bei 6 erreichten Modulen also über 16,7 %, bei 4 über 25 %. Ein
> Buff-Turm, der nur ein Modul erreicht, ist immer die schlechtere Wahl gegenüber einem weiteren
> Kampfturm.
>
> Er war ein Pentagon, und das war der schlechteste Platz für diese Form: Weil er zuerst gesetzt und
> umbaut wird, begann **jede** Station mit den 108°, die keine Ecke schließen.
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
