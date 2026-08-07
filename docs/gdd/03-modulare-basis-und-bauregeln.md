# 03 – Modulare Basis und Bauregeln

> Teil 3 von 16 der Game-Design-Dokumentation.

> **Hinweis zur Quellenlage:** Der ursprüngliche GDD-Teil 18 („Modulares Basissystem, Turmplatzierung, Formen und Bauregeln") wurde nie vollständig übermittelt. Dieses Dokument fasst alles zusammen, was in den anderen Teilen zum Bausystem steht, ergänzt um die Geometrieentscheidung (Abschnitt 3).

> **Stand nach Prototyp 01.** Abschnitt 3 beschrieb bis dahin ein Hex-Raster, auf dem alle Module
> eine Zelle belegten und die Formen bloße Optik waren. Das widersprach Abschnitt 2 und dem
> Zielbild. Der Prototyp hat das **Kantensystem** umgesetzt und vermessen; die Abschnitte 3, 7, 9
> und 10 geben jetzt dessen Ergebnisse wieder.
> Messwerte und Begründungen: [`prototypes/01-tower-building/README.md`](../../prototypes/01-tower-building/README.md)

---

## 1. Ziel des modularen Systems

Das modulare Bausystem ist das wichtigste Alleinstellungsmerkmal des Spiels.

Der Spieler baut keine feste Verteidigungslinie — er erschafft eine zusammenhängende futuristische Kampfstation.

Das System soll:

- kreative Builds ermöglichen
- unterschiedliche Layouts erzeugen
- strategische Entscheidungen fördern
- jede Basis einzigartig machen

---

## 2. Grundprinzip

Der **Hauptturm befindet sich immer im Zentrum**. Er kann nicht entfernt oder verschoben werden.

Um ihn herum werden Module angebaut — entweder direkt am Hauptturm oder an bereits platzierten Türmen.

Jedes Modul besitzt:

- feste Seitenlänge (bei allen Modulen identisch)
- definierte Form
- Anschlussflächen

Dadurch passen alle Module geometrisch zusammen und rasten sauber ein.

**Zwischenräume gehören dazu.** Dreiecke, Vierecke, Fünfecke und Sechsecke kacheln die Ebene nicht
lückenlos: An vielen Ecken bleiben Keile offen — besonders dort, wo Fünfecke beteiligt sind
(Innenwinkel 108°, drei davon ergeben nie 360°). Diese Keile sind Teil des Erscheinungsbilds und
kein Fehler. Die Station soll wie eine gewachsene Maschine aussehen, nicht wie eine Fliesenwand.

---

## 3. Geometrie: Kantensystem

**Entscheidung:** Es gibt **kein Raster**. Jedes Modul ist ein **regelmäßiges Vieleck mit
einheitlicher Seitenlänge**, und neue Module docken an eine **freie Kante** eines bereits
platzierten Moduls an.

Der Hauptturm ist ein festes Sechseck im Zentrum und liefert die ersten sechs Andockkanten.

### Der Andockvorgang

Der Spieler wählt zwei Dinge: **welches Modul** und **an welche freie Kante**.

Position und Drehung ergeben sich daraus vollständig. Weil ein regelmäßiges Vieleck
rotationssymmetrisch ist, gibt es pro Kante genau **eine** mögliche Lage — keine Drehauswahl,
keine Feinpositionierung, keine Mehrdeutigkeit. Deshalb rastet immer alles sauber ein.

```
                    freie Kante
                   ╱          ╲
        Fünfeck ──┤   HEXAGON   ├── Dreieck
                   ╲   (Kern)  ╱
                    └──────────┘
                       Viereck
```

### Grundfläche und Anschlusskanten

Es gibt vier Grundflächen. Ihre Kantenzahl ist **Spielmechanik**, nicht Optik — sie bestimmt,
wie viele Nachbarn ein Modul höchstens haben kann und damit, wie viele Buff-Verbindungen möglich sind.

| Grundfläche | Anschlusskanten | Rolle |
|---|---|---|
| Dreieck | 3 | wenig Anschluss, kompakt, gut für den Rand |
| Viereck | 4 | ausgewogen |
| Fünfeck | 5 | viel Anschluss — die natürliche Form für Buff-Türme |
| Hexagon | 6 | maximaler Anschluss, Hauptturm und Spezialmodule |

Formen, die geometrisch nicht andocken können (Kreis, Spezialform aus Abschnitt 7), werden als
**Grundfläche plus Emblem** dargestellt: Das Drohnen-Modul ist ein Hexagon mit Kreis-Emblem, der
Plasma-Turm ein Fünfeck mit Stern-Emblem. Die Formsprache bleibt erhalten, die Geometrie bleibt schlüssig.

### Zwei Regeln, die daraus folgen

**Überlappung ist verboten.** Anders als auf einem Raster kann eine geometrisch korrekte Andockung
trotzdem in ein anderes Modul hineinragen — etwa ein Hexagon in einem 60°-Keil. Jede Platzierung
wird deshalb gegen alle bestehenden Module geprüft und bei Überschneidung abgelehnt.

**Nicht jede freie Kante nimmt jedes Modul auf.** Im Prototyp passte an **27,7 %** der freien
Kanten gar kein Modul mehr, und im Schnitt nur 2,24 der 4 Grundflächen. Ein Dreieck fand an 72 %
der Kanten Platz, ein Hexagon nur an 46 %.

Das ist gewollt: Große Module brauchen Raum, kleine füllen Lücken. Es muss dem Spieler aber
**sichtbar** sein — ungültige Ziele werden markiert, nicht versteckt, sonst wirkt die Regel wie ein Fehler.

**Vorteile dieser Wahl:**

- die Modulform wird zu einer echten Entscheidung statt zu reiner Dekoration
- die Station sieht aus wie zusammengesetzte Technik, nicht wie ein Spielbrett
- unterschiedliche Kantenzahlen erzeugen von selbst unterschiedliche Stationsformen
- der Zusammenhang zur Station ist beim Bauen automatisch gegeben

---

## 4. Aufbau-System

Der Spieler kann Türme **jederzeit** platzieren, verschieben und entfernen.

**Das Platzieren kostet kein Gold.** Einzige Voraussetzung: Der Spieler muss den Turm besitzen.

Damit sind freies Experimentieren und komplette Umbauten ausdrücklich erwünscht.

Beim Platzieren:

- freie Andockkanten werden hervorgehoben
- Module verbinden sich automatisch
- Formen rasten ein

### Entfernen zerteilt die Station

Die Anbauregel sichert den Zusammenhang nur beim *Bauen*. Wird ein Modul aus der Mitte entfernt,
kann der Rest auseinanderfallen:

```
    [A]—[Kern]—[B]        B entfernen  →  Rest bleibt verbunden   ✓
    [A]—[B]—[Kern]        B entfernen  →  A hängt in der Luft     ✗
```

**Regel:** Das Entfernen ist **immer erlaubt**. Module, die dadurch den Anschluss verlieren,
wandern automatisch mit ins Inventar zurück.

**Pflicht dazu: die Vorschau.** Schon beim Zeigen auf ein Modul leuchtet auf, was mit ihm
zusammen zurückwandern würde, samt Anzahl. Ohne diese Vorschau ist die Regel eine Falle.

*Warum nicht blockieren?* Die Alternative — Entfernen verbieten, solange die Station zerfiele —
wurde im Prototyp gemessen: Bei 15 Modulen sind rund **50 %** aller Module Brückenmodule. Jedes
zweite Modul wäre dauerhaft festgenagelt, was dem Grundsatz „komplette Umbauten sind erwünscht"
widerspricht.

**Verschieben ist strenger als Entfernen:** Ein Brückenmodul lässt sich nicht umsetzen, denn ein
Zug ist kein Abriss. Wer es versetzen will, entfernt es bewusst und baut neu.

---

## 5. Stations-HP — eine gemeinsame Lebensleiste

Die Station besitzt **eine einzige Lebensleiste**, die für alle Module zusammen gilt.

- Es gibt **keine** getrennte Hauptturm-HP und **keine** HP pro Modul.
- Sobald **irgendein Teil** der Station getroffen wird, geht der Schaden auf diese eine gemeinsame Leiste.
- Einzelne Module können **nicht zerstört werden**. Ein Modul geht nie verloren, egal wie weit außen es steht.
- Fällt die Stations-HP auf 0, ist die Welle verloren und startet erneut — ohne Verlust von Türmen oder Fortschritt (→ [02](02-kern-spielschleife-und-spielerfahrung.md)).
- **Nach jeder abgeschlossenen Welle wird die Station vollständig geheilt.** Jede Welle beginnt mit voller HP, auch nach einer Niederlage (→ [07, Abschnitt 12](07-gegner-bosse-und-wellen.md)).

### Konsequenzen für das Design

**Bauen bleibt risikofrei.** Der Spieler muss beim Platzieren nicht überlegen, welche Türme er „opfert". Er kann seine Station frei gestalten.

**Die Station ist eine Einheit, kein Verbund von Einzelteilen.** Das unterstützt die Spielfantasie: nicht viele Türme nebeneinander, sondern *eine* Maschine.

**Verteidigung ist ein globaler Wert.** Alles, was HP, Schadensreduzierung oder Schilde erhöht (Fortress Core, Schildgenerator, defensive Perks, globale Upgrades), wirkt auf diese eine Leiste.

> Wo im GDD von „Hauptturm-HP" die Rede ist, ist immer diese gemeinsame **Stations-HP** gemeint.

---

## 6. Begrenzung der Basis

Die Basis kann theoretisch weiter wachsen, praktisch gelten aber Grenzen:

- maximale sinnvolle Modulanzahl
- begrenzte Anzahl aktiver Turmplätze
- steigende Turmkosten (→ [06](06-turmerwerb-inventar-raritaeten.md))

### Turmplätze

| | Anzahl |
|---|---|
| **Start** | **4 Turmplätze** (zusätzlich zum Hauptturm) |
| Ausbau | +1 pro Prestige-Upgrade *Zusätzlicher Turmplatz* (100 Punkte) |
| Zielspanne im späteren Spiel | 8–15 aktive Türme |

Der Start mit nur vier Plätzen macht jeden weiteren Platz zu einem spürbaren Fortschritt und zwingt früh zu bewussten Entscheidungen: Vier Plätze reichen nicht für alles.

### Was einen Turmplatz belegt

| Belegt einen Platz | Belegt keinen Platz |
|---|---|
| Kampftürme | der Hauptturm (steht immer im Zentrum) |
| Buff-Türme | Drohnen (vom Drone Core oder Drohnen-Modul erzeugt) |
| Support-Türme (Schildgenerator) | Helfer wie der Goldsammler |
| Spezialtürme (Laser, Tesla, Plasma …) | |

**Buff-Türme kosten also einen vollen Turmplatz.** Bei nur vier Startplätzen ist die Entscheidung „drei Angriffstürme plus ein Buff-Turm oder vier Angriffstürme" eine echte, spürbare Abwägung — genau so ist es gewollt.

Drohnen und Helfer sind bewegliche Einheiten, keine Module: Sie belegen keine Grundfläche, docken an keiner Kante an und können von Gegnern nicht angegriffen werden.

### Inventar

Das **Inventar ist unbegrenzt**. Der Spieler kann beliebig viele nicht platzierte Türme besitzen.

Begrenzt ist nur, wie viele Türme gleichzeitig *aktiv* (platziert) sein können. Überschüssige Türme sind kein Problem, sondern Rohstoff für das Schmelzsystem (→ [06, Abschnitt 5](06-turmerwerb-inventar-raritaeten.md)).

Das Designziel lautet: **Qualität statt Masse.** Jeder einzelne Turm soll wichtig sein.

---

## 7. Modulformen

Die Form leistet zweierlei: Sie macht das Modul auf einen Blick erkennbar **und** legt über die
Kantenzahl fest, wie viele Nachbarn es haben kann (Abschnitt 3).

| Form | Anschlusskanten | Typische Rolle | Beispiele |
|---|---|---|---|
| Hexagon | 6 | Hauptturm, wichtige Spezialmodule | Hauptturm-Kerne, Tesla-Turm, Schildgenerator |
| Quadrat | 4 | Standard-Kampftürme | Maschinengewehr, Kanone/Geschütz |
| Dreieck | 3 | spezialisierte Angriffstürme | Sniper, Laser, Raketen, Flammen |
| Pentagon | 5 | Unterstützung | Buff-Turm |
| Kreis | 6 (Hexagon + Kreis-Emblem) | autonome Systeme | Drohnen-Modul |
| Spezialform | 5 (Pentagon + Stern-Emblem) | Endgame-Module | Plasma-Turm |

Kreis und Spezialform können geometrisch nicht andocken. Sie werden als Grundfläche plus Emblem
dargestellt (Abschnitt 3) — die Wiedererkennung bleibt, die Geometrie bleibt schlüssig.

**Die Formzuordnung ist damit eine Balance-Entscheidung.** Ein Buff-Turm als Pentagon erreicht bis
zu 5 Module, als Dreieck nur 3 — bei gleichem Turmplatz-Preis. Neue Türme dürfen deshalb nicht nach
Optik, sondern nach gewünschter Anschlussfähigkeit eine Form bekommen.

*Gemessen:* Über 60 Stationen mit je 15 Modulen lag die Kantenauslastung bei allen Formen zwischen
40 % und 51 % — im Schnitt 1,52 Nachbarn beim Dreieck, 1,98 beim Fünfeck, 2,65 beim Hexagon.
Die Form wirkt also, der Unterschied ist im normalen Wachstum aber eher Nuance. Wer gezielt
kompakt um ein Buff-Modul herum baut, holt deutlich mehr heraus (Abschnitt 9).

---

## 8. Turmplatzierung und ihre Wirkung

Die Position eines Turms beeinflusst:

- welche Türme angrenzen
- welche Buffs aktiv sind
- wie die Basis aussieht

Es gibt bewusst **keine komplizierten Platzierungsboni**. Der einzige wirklich relevante Faktor ist die **direkte Verbindung zu Buff-Türmen**.

---

## 9. Buff-Türme

Buff-Türme verursachen keinen oder nur minimalen Schaden. Ihre Aufgabe ist es, angrenzende Türme zu verstärken.

```
      [Buff-Turm]
           ↓
      [Laser-Turm]     ← erhält den Bonus
```

### Buff-Regeln

- Ein Buff-Turm verstärkt nur Module, mit denen er eine **ganze gemeinsame Kante** teilt.
  Eine bloße **Eckberührung reicht nicht** — dann fehlt auch die Buff-Linie, die Regel ist also sichtbar.
- Ein Buff-Turm erreicht damit höchstens so viele Module, wie seine Grundfläche Kanten hat (Abschnitt 7).
- Mehrere Buff-Türme können denselben Turm verstärken.
- **Buffs stapeln sich additiv**, nicht multiplikativ: +20 % und +25 % ergeben +45 %.
- Erst nach dem Aufsummieren greift die **Obergrenze** je Wert (z. B. maximal +100 % Angriffstempo).
- **Buff-Türme verstärken sich nicht gegenseitig.**
- **Der Hauptturm wird mitgebufft.** Er ist ein Modul mit gemeinsamen Kanten wie jedes andere.
  Das macht die sechs Kernkanten zum wertvollsten Bauplatz der Station — und trägt die Rechnung
  im nächsten Absatz.

> **Warum additiv?** Multiplikatives Stapeln macht die Obergrenze wirkungslos und explodiert, sobald
> mehrere Buff-Türme an einem Modul hängen. Additiv plus Deckel ist vorhersagbar und im
> Turm-Detailfenster erklärbar.

### Balance-Schwelle: wann sich ein Buff-Turm überhaupt lohnt

Ein Buff-Turm belegt denselben Turmplatz wie ein Kampfturm (Abschnitt 6). Er verstärkt `k` Module
um jeweils `b`. Er schlägt einen zusätzlichen gleichwertigen Kampfturm genau dann, wenn

> **b > 1 / k**

| verstärkte Module | nötige Buffstärke |
|---|---|
| 1 | > 100 % |
| 2 | > 50 % |
| 3 | > 33 % |
| 4 | > 25 % |
| 5 | > 20 % |

**Diese Formel ist bindend fürs Balancing** (→ [15](15-balancing-und-skalierung.md)). Ein Buff-Turm,
dessen Stärke unter `1/k` liegt, ist rechnerisch tot — der Spieler fährt immer besser damit, einen
weiteren Kampfturm zu setzen.

### Die Folge fürs Spielgefühl: Buff-Türme brauchen Voraussicht

Ein neu angestecktes Modul teilt sich per Konstruktion **genau eine** Kante mit der Station. Ein
Buff-Turm, der an eine fertige Station angebaut wird, erreicht deshalb praktisch **immer nur ein
einziges Modul** — und ist nach obiger Formel damit immer die schlechtere Wahl.

Wird derselbe Buff-Turm dagegen **zuerst** gesetzt und werden die Kampftürme an *seine* freien
Kanten gebaut, erreicht er vier Module (drei Türme plus den Hauptturm) und gewinnt deutlich.

| Vier Turmplätze | reine Kampftürme | mit Buff-Turm im Zentrum |
|---|---|---|
| Epic-Buffturm | 100 % | **+4 bis +6 %** |
| Legendary | 100 % | **+8 bis +10 %** |
| Mythic | 100 % | **+15 bis +17 %** |

Das ist ausdrücklich erwünscht — es belohnt Planung statt Nachrüsten. Es stellt aber eine
**Anforderung an die Spielerführung** (→ [14](14-progression-und-freischaltungen.md)): Wer den
Zusammenhang nicht kennt, baut den Buff-Turm zuletzt an den Rand und erlebt ihn als Fehlkauf.
Die Buff-Linien auf der Baufläche sind dafür das wichtigste Mittel.

### Beispiel

| Quelle | Effekt auf das Maschinengewehr |
|---|---|
| Buff-Turm 1 | +20 % Angriffstempo |
| Buff-Turm 2 | +15 % Schaden |
| **Ergebnis** | beide Boni aktiv |

### Mögliche Buff-Arten

| Modul | Effekt auf angrenzende Türme |
|---|---|
| Angriffstempo-Modul | schnellere Schüsse |
| Schadens-Modul | mehr Schaden |
| Reichweiten-Modul | größerer Angriffsradius |
| Krit-Modul | höhere kritische Trefferchance |
| Projektil-Modul | höhere Projektilgeschwindigkeit |
| XP-Modul | mehr Erfahrung |
| Gold-Modul | bessere Gold-Einnahmen |

Buff-Türme besitzen eigene Upgrades: **Buff-Stärke** und **Anzahl unterstützter Türme**.

> Ein „Buff-Radius" ist im Kantensystem gegenstandslos — Reichweite gibt es hier nicht, nur
> gemeinsame Kanten. Wer die Wirkung ausdehnen will, erhöht die Zahl der unterstützten Türme oder
> setzt den Buff-Turm auf eine Grundfläche mit mehr Kanten.

---

## 10. Technische Anforderungen an das Bausystem

Das System benötigt:

**Positionierung** – Weltkoordinaten (Mittelpunkt + Drehung), abgeleitet aus der gewählten
Andockkante. Kein Raster, keine Koordinatenzellen.

**Andocken** – freie Kanten bestimmen (Kanten ohne deckungsgleiche Gegenkante), nächstgelegene
Kante unter dem Mauszeiger wählen, Modul dort einrasten, **Überlappung gegen alle Module prüfen**.

**Verbindungen** – Nachbarschaft über deckungsgleiche Kanten, Buff-Verbindungen, Zusammenhang zum
Hauptturm per Breitensuche.

**Verwaltung** – hinzufügen, verschieben, entfernen (inklusive Rückwanderung abgetrennter Module).

**Buff-Berechnung:**

```
Station verändert
      ↓
Kantennachbarschaft neu bestimmen
      ↓
Buff-Türme wirken auf ihre Kantennachbarn (außer auf andere Buff-Türme)
      ↓
Boni je Wert addieren, dann deckeln
      ↓
Effektivwerte anwenden
```

**Vollständig neu rechnen, nicht fortschreiben.** Bei der Zielgröße von 8–15 Modulen kostet die
komplette Neuberechnung von Nachbarschaft und Buffs zusammen unter einer Millisekunde, und sie
läuft nur bei Änderungen, nicht pro Bild. Inkrementelle Buff-Updates sind eine bekannte
Fehlerquelle und hier nicht nötig.

Details zur Umsetzung: → [16 – Technische Umsetzung](16-technische-umsetzung.md)

---

## 11. Ziel des Systems

> "Jeder Spieler baut seine eigene einzigartige Kampfmaschine."

Die Stärke entsteht nicht nur aus Zahlen, sondern aus Auswahl, Platzierung, Kombination, Raritäten und Eigenschaften.

---

## 12. Geklärte Detailfragen

Diese Punkte waren in den Quelldokumenten offen und sind inzwischen entschieden:

| Frage | Regel |
|---|---|
| Grenze der Ausdehnung | keine feste Grenze — begrenzt wird allein über die Anzahl freigeschalteter Turmplätze (Abschnitt 6) |
| Entfernte Türme | wandern zurück ins Inventar und gehen nie verloren (→ [06](06-turmerwerb-inventar-raritaeten.md)) |
| Reichweitenmessung | ab dem **eigenen** Modul des Turms, nicht ab dem Zentrum (→ [05, Abschnitt 4](05-turm-system-und-turmtypen.md)) |
| Buff-Türme und Turmplätze | Buff- und Support-Türme belegen normale Turmplätze (Abschnitt 6) |
| Drohnen und Helfer | belegen keine Plätze, docken an keiner Kante an, sind nicht angreifbar (Abschnitt 6) |
| Geometrie der Basis | Kantensystem statt Raster; Formen sind echte Grundflächen (Abschnitt 3) |
| Zwischenräume | Keile zwischen Modulen sind Teil des Erscheinungsbilds, kein Fehler (Abschnitt 2) |
| Entfernen mit Stationsbruch | erlaubt; abgetrennte Module wandern mit zurück, Vorschau ist Pflicht (Abschnitt 4) |
| Verschieben eines Brückenmoduls | nicht erlaubt — erst entfernen, dann neu bauen (Abschnitt 4) |
| Nachbarschaft | nur ganze gemeinsame Kanten; Eckberührung zählt nicht (Abschnitt 9) |
| Buff-Stapelung | additiv, danach Deckel je Wert (Abschnitt 9) |
| Hauptturm und Buffs | der Hauptturm wird mitgebufft (Abschnitt 9) |
| Mindeststärke eines Buffs | `b > 1/k` bei `k` verstärkten Modulen, sonst wertlos (Abschnitt 9) |
