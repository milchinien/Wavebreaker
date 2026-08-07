# 13 – UI und visuelles Design

> Teil 13 von 16 der Game-Design-Dokumentation.

---

## 1. Zielbild

Die Oberfläche soll vermitteln:

> "Ich kontrolliere eine futuristische Maschine."

Nicht: *"Ich verwalte Zahlen."*

Der Spieler soll jederzeit verstehen:

- Was passiert gerade?
- Wie stark bin ich?
- Was kann ich verbessern?
- Was ist mein nächstes Ziel?

Das Interface soll komplexe Systeme einfach darstellen, nicht überladen wirken und langfristige Motivation unterstützen.

---

## 2. Grafikstil

**Stilrichtung:** futuristisch, clean, modern, dunkel, neonbeleuchtet — orientiert an einer High-Tech-Kommandozentrale.

| Element | Gestaltung |
|---|---|
| Grundfarben | Dunkelblau / Schwarz |
| Akzente | Neonfarben |
| Panels | holografisch, leuchtende Rahmen |
| Linien | dünn, klar, geometrisch |

### Hintergrund

- dunkelblau, minimalistisch
- dezente geometrische Formen, überwiegend Rechtecke
- leichte Linien und technische Muster

**Regel:** Der Hintergrund soll nur auffallen, wenn man bewusst darauf achtet. Er darf niemals vom Gameplay ablenken.

---

## 3. Navigation

Es gibt keine klassische Weltkarte. Die Navigation erfolgt über eine Kommandozentrale mit festen Hauptbereichen:

| Bereich | Zweck |
|---|---|
| **Kampf** | aktive Schlacht |
| **Basis** | Türme verwalten und bauen |
| **Upgrades** | Verbesserungen des aktuellen Runs |
| **Prestige** | permanenter Fortschritt |
| **Einstellungen** | Grafik, Lautstärke, Sprache, Animationen, Effekte |

---

## 4. Kampfansicht

### Layout

```
┌──────────────────────────────────────────────────────┐
│ [🪙 Gold]        [Boss-Lebensleiste]    ┌ WELLE 15 ┐ │
│ [🪙 auf dem Feld]                       │ ▓▓▓░░ 8/23│ │
│                                         │ (<) AUTO (>)│
│                  ▣  Hauptturm                        │
│              angebaute Module · Angriffskreis        │
│              Gegner · Geschosse · Effekte            │
│              liegende Goldmünzen                     │
│                                                      │
│  ⚔ 250 │ Stations-HP ████████░░ │ 🪙 x1.24           │
├──────────────────────────────────────────────────────┤
│  [Navi ×4]  │  Upgrade-Kacheln                       │
└──────────────────────────────────────────────────────┘
```

**Regel:** Alles, was nur eine Zahl zeigt, schwebt als schmales Schild über dem Feld. Die
untere Leiste trägt ausschließlich das, was man anfasst. Sonst wächst sie auf die halbe
Bildhöhe, und der Spieler sieht seine Station nicht mehr — genau die zu sehen ist der Kern
der Spielfantasie (Abschnitt 4, „Kamera").

### Wellensteuerung (oben rechts, in der Wellenkarte)

```
[ (<)   AUTO   (>) ]
```

| Element | Funktion |
|---|---|
| `(<)` | eine Welle zurück |
| `WELLE 15` | aktuell gespielte Welle, in der Kopfzeile der Karte |
| `AUTO` | Auto-Wellen-Modus an/aus (hervorgehoben, wenn aktiv) |
| `(>)` | eine Welle vor |

Zwischen zwei Wellen liegt immer eine kurze Pause. Ist der Auto-Modus aus, wartet das Spiel auf `(>)`.
Vollständige Regeln → [07, Abschnitt 9](07-gegner-bosse-und-wellen.md)

### Weiteres oberes HUD

- Boss-Anzeige (nur bei aktivem Boss): Name, aktuelle und maximale HP
- **Stations-HP** — eine einzige Leiste für die gesamte Station, keine HP pro Modul → [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md)
- Spielerlevel und XP-Fortschritt

Wird die Station getroffen, sinkt diese eine Leiste — unabhängig davon, welches Modul getroffen wurde. Ein kurzer Aufblitz am Trefferort zeigt, wo der Schaden ankam.

### Oben rechts

- Gold
- Prestige-Informationen (optional)

### Unterer Bereich

Aktive Fähigkeiten mit Symbol, Cooldown und Bereitschaftsstatus. Aktivierung per Klick. Der Einsatz selbst kostet nichts — nur Freischalten und Verbessern kosten Gold (→ [09, Abschnitt 7](09-level-system-und-faehigkeiten.md)).

### Spielfeld

Zentrum: Hauptturm mit angebauten Modulen, Neon-Effekten und aktiven Buffs. Darum herum Gegner, Projektile, Effekte und liegende Goldmünzen.

### Kamera

Die Kamera **zoomt automatisch heraus, wenn die Station wächst**, sodass die komplette Station immer im Bild bleibt. Der Spieler soll seine Basis jederzeit als Ganzes sehen — das ist der Kern der Spielfantasie.

Der Zoom passt sich weich an (keine Sprünge).

**Die maximale Turmreichweite geht dabei _nicht_ vollständig in den Bildausschnitt ein.** Am
Prototyp gemessen: Eine Station mit 16 Modulen füllt das Bild bei Zoom 1,19 und behält 67 px
Kantenlänge. Nimmt die Kamera zusätzlich die volle Reichweite eines Scharfschützen auf (über 400
Einheiten), fällt der Zoom auf 0,43 — die Module schrumpfen auf 24 px, die Embleme auf 11 px. Die
Station ist dann nicht mehr lesbar, und genau ihr Anblick ist der Kern des Spiels.

**Regel:** Der Bildausschnitt richtet sich nach der Station plus einem festen Rand **plus einem
gedeckelten Bruchteil der Hauptturm-Reichweite** — nie der vollen. Reichweiten einzelner Türme
werden weiterhin **transient** gezeigt — beim Auswählen oder Überfahren — und verändern den Zoom
nicht.

Gemessen an der Startaufstellung: fester Rand 70, Reichweitenanteil 0,9 (gedeckelt bei 260). Auf
einem Feld von 420 × 660 ergibt das Zoom 0,66 — ein Modul ist 37 px breit, der Angriffskreis füllt
gut zwei Drittel der Bildbreite. Ohne den Reichweitenanteil lag der Zoom bei 1,44: Die Station
füllte das halbe Bild, und Gegner erschienen erst unmittelbar vor ihr.

### Wirkungsbereich

Um die Station liegt dauerhaft ihr Wirkungsbereich: eine sehr blasse Fläche mit klarer Kante, die
langsam atmet. Verbindlich sind vier Punkte:

| Punkt | Regel |
|---|---|
| Kein Kreis, sondern eine Vereinigung | Jedes Modul, das wirklich schießt, bringt **einen eigenen Kreis um seinen eigenen Standort** mit. Gezeigt wird deren Vereinigung. So misst der Kampf auch: ab dem Modul, nicht ab dem Kern. |
| Ein Turm zeigt sich erst, wenn er etwas beiträgt | Solange sein Kreis im bestehenden Umriss liegt, ist er unsichtbar. Erst wenn er darüber hinausragt, wächst dort eine Beule — und nur dort. |
| Runde Ecken | Wo zwei Kreise sich schneiden, entsteht eine Spitze. Spitzen sehen nach Fehler aus, nicht nach Reichweite: Der fertige Umriss wird geglättet. Die Glättung darf dabei **nie über die echte Vereinigung hinausragen**. |
| Nichts anderes wird als Reichweite gezeigt | Reichweiten einzelner Türme bleiben transient (Auswahl, Bauvorschau). Der Sammelradius wird gar nicht gezeigt. |

Ein einzelner Kreis um den Kern wäre in beide Richtungen falsch: Mit der kleinsten Reichweite
sterben Gegner sichtbar außerhalb, mit der größten verspricht er Deckung auf der Seite, wo kein
Turm steht.

Nachgemessen mit den Werten des Spiels: Kern 220. Eine Autokanone (140) ändert nichts — ihr Kreis
liegt ganz im Kern. Eine Kanone (200) beult auf 276 aus, ein Sniper (420) auf 508 — jeweils nur in
seiner Richtung.

### Gold einsammeln

Goldmünzen liegen als kleine leuchtende Objekte sichtbar auf dem Spielfeld. Fährt der Zeiger über
sie, werden sie eingesammelt — mit kurzer Animation und sichtbar steigender Zahl.

**Der Sammelradius wird nicht angezeigt.** Er ist so groß wie ein Stapel, und was der Zeiger
erreicht, merkt man daran, dass Münzen losfliegen. Ein zweiter Kreis neben dem Angriffskreis hieße
ebenfalls „Reichweite" und meinte etwas anderes — das eine ist eine Aussage über das Spiel, das
andere nur eine über die Maus.

**Münzen tragen keine Zahl.** Ihr Wert steht in Größe und Metall (bronze, silber, gold) — beides
folgt dem Vielfachen des Durchschnitts, sagt also dasselbe und kann sich nicht widersprechen.

**Münzen verfallen nie.** Sie bleiben unbegrenzt liegen, auch über Wellenwechsel hinweg. Damit das Feld bei langer Abwesenheit nicht zugestellt wird, verschmelzen dicht beieinanderliegende Münzen optisch zu **Stapeln** — ein Stapel wird mit einer Bewegung eingesammelt.

### Gegner-Anzeige

Starke Gegner besitzen einen Lebensbalken, Bosse eine große Leiste im oberen HUD. Beim Hover erscheinen Name, HP, Eigenschaften und Schwächen.

### Turm-Interaktion

Klick oder Hover auf einen Turm öffnet ein Informationsfenster: Turmname, Rarität, Werte, Eigenschaften, aktive Buffs und Upgrade-Möglichkeiten.

---

## 5. Basis-Menü

Die Basis ist der zentrale Verwaltungsbereich und ersetzt ein klassisches Inventarmenü.

### Dreiteiliges Layout

```
┌────────────┬───────────────────────────┬──────────────┐
│ INVENTAR   │        BAUFLÄCHE          │  VERWALTUNG  │
│            │                           │              │
│ Turm #1    │                           │ Turm kaufen  │
│ Turm #2    │        ▣ Hauptturm        │ Entfernen    │
│ Turm #3    │      + angebaute Module   │ Verbessern   │
│ …          │                           │ Schmelzen    │
│            │                           │ Statistiken  │
├────────────┴───────────────────────────┴──────────────┤
│      Basis  |  Upgrades  |  Prestige  |  Einstellungen│
└───────────────────────────────────────────────────────┘
```

### Linke Seite – Inventar

Jeder Turm wird **einzeln** angezeigt, keine Stapel:

```
Maschinengewehr #1      Legendary    +20% Angriffstempo
Maschinengewehr #2      Rare         +10% Schaden
Laser #1                Epic         +15% Reichweite
```

Jeder Eintrag zeigt Form, Farbe, Rarität, Name, kleine Vorschau, Eigenschaften und Upgrade-Status. Sortierung nach Rarität, Typ, Name oder Stärke; Filter nach Raritätsstufe.

### Mitte – Baufläche

Zeigt den Hauptturm im Zentrum und alle angebauten Module. Türme lassen sich platzieren, verschieben und entfernen.

Beim Platzieren leuchten die **freien Andockkanten** auf; das gewählte Modul rastet auf der Kante unter dem Mauszeiger ein und wird als Vorschau gezeigt — grün, wenn es passt, rot, wenn es ein anderes Modul schneiden würde. Beim Zeigen auf ein platziertes Modul leuchtet auf, **welche Module beim Entfernen mit zurückwandern würden** (→ [03, Abschnitt 4](03-modulare-basis-und-bauregeln.md)).

### Rechte Seite – Verwaltung

Turm kaufen, entfernen, verbessern, schmelzen, Informationen und Statistiken.

Es gibt bewusst **keinen Verkauf gegen Gold** — überschüssige Türme gehen ausschließlich über das Schmelzsystem (→ [06](06-turmerwerb-inventar-raritaeten.md)).

### Oberes HUD der Basis

Gold, Prestige-Punkte, aktueller Fortschritt, verfügbare Ressourcen.

---

## 6. Wichtige Fenster

### Turmkauf

```
Wähle einen Turm:

  ┌──────────────────┐        ┌──────────────────┐
  │ Laser            │        │ Kanone           │
  │ Epic             │  ODER  │ Rare             │
  │ Spezialturm      │        │ Schwerer Schaden │
  │ [Werte]          │        │ [Werte]          │
  └──────────────────┘        └──────────────────┘
```

Große Auswahlkarten mit Turmname, Form, Rarität, Werten und Beschreibung — der Spieler entscheidet bewusst.

### Turm-Detailfenster

```
Maschinengewehr — Rare        Nachbarn 3 / 4

Schaden:         250  →  305      +22 %
Angriffstempo:   3.5  →  4.4 /s   +25 %
Reichweite:      …

Eigenschaften:   +10% Reichweite · +8% Schaden
Aktive Buffs:    +25% Angriffstempo  ← Rate Amplifier
                 +22% Schaden        ← Power Amplifier
```

Jeder gebuffte Wert wird als **Basis → effektiv** mit Prozentangabe und Quelle gezeigt. Werte, die
an ihrer Obergrenze hängen, werden markiert. `Nachbarn 3 / 4` nennt belegte und mögliche
Anschlusskanten — daran erkennt der Spieler, ob ein Buff-Turm überhaupt etwas erreicht.

### Upgrade-Menü

Zeigt den aktuellen Turm, seine Werte und seine Verbesserungen mit Stufe und Effekt:

```
Schaden:        Level 5   +25%
Angriffstempo:  Level 3   +15%
Reichweite:     Level 4   +20%
```

Bereiche: Hauptturm · Türme · Fähigkeiten · Helfer (nur sichtbar, wenn freigeschaltet).

Upgrade-Kategorien: Offensive (Schaden, Angriffstempo, Krit) · Projektil (Durchschuss, Abpraller, Geschwindigkeit) · Elementar (Feuer, Gift, Explosion) · Utility (Reichweite, Goldbonus, XP-Bonus).

### Level-Up-Fenster

```
LEVEL 25 ERREICHT — Wähle eine Verbesserung:

  +10% Schaden   |   +1 Durchschuss   |   +5% Angriffstempo
```

### Prestige-Menü

Eigene große Ansicht:

| Bereich | Inhalt |
|---|---|
| Oben / links | aktuelle Prestige-Punkte |
| Mitte | Prestige-Baum aus verbundenen Knoten |
| Rechts | Details zum ausgewählten Upgrade: Name, Kosten, Effekt, Voraussetzungen |

Knoten-Status durch Farbe: **gesperrt** = dunkel · **verfügbar** = leuchtend · **gekauft** = aktiviert.

---

## 7. Raritäts-Darstellung

Die Neon-Umrandung zeigt die Seltenheit — durchgängig in Inventar, Baufläche, Kampfansicht und Auswahlfeldern:

| Rarität | Farbe | Leuchteffekt |
|---|---|---|
| Common | Grau | leichter Rand |
| Rare | Grün | deutlicher Rand |
| Epic | Blau | sichtbares Leuchten |
| Legendary | Gold | starkes Leuchten, Animation |
| Mythic | Rot | pulsierende Neonenergie |

---

## 8. Zahlendarstellung

Da die Werte im Endgame extrem groß werden, werden Zahlen **abgekürzt** dargestellt:

| Bereich | Darstellung |
|---|---|
| bis 9.999 | vollständig (`4.250`) |
| ab 10.000 | abgekürzt mit einer Nachkommastelle (`12.5K`, `3.8M`, `1.2B`) |
| sehr große Werte | wissenschaftliche Kurzform (`4.1e18`) |

Die Abkürzungen folgen der englischen Konvention (K, M, B, T …), passend zur englischen Spielsprache.

Prozentwerte werden immer als solche angezeigt (`+15 %`), nie als Multiplikator.

---

## 9. Informationssystem

Informationen erscheinen per **Hover**, nicht als Dauertext. Beim Überfahren eines Elements erscheint ein Fenster mit Erklärung, Werten und Effekten.

**Regel:** keine permanente Überladung mit Text.

---

## 10. Animationen und Effekte

Dezent statt überladen. Sichtbar sein müssen:

- Schüsse, Treffer, Explosionen, Laser
- Buff-Anzeigen
- Boss-Effekte
- Platzieren von Modulen
- Neon-Leuchten nach Rarität

Weitere Momente: Buttons pulsieren leicht, neue Freischaltungen erhalten einen Neon-Effekt, Prestige eine große Energieanimation.

### Bereichswechsel

Ein Wechsel zwischen Kampf, Basis, Upgrades und Einstellungen ist eine **Bewegung, kein Schnitt**.
Verbindlich sind fünf Punkte:

| Punkt | Regel |
|---|---|
| Mehrere Größen zugleich | Ort **und** Skalierung (0,985 → 1) **und** Weichzeichnung (6 → 0 px) **und** Deckkraft. Nur zu blenden liest sich als Bildwechsel. |
| Richtung | Jedes Panel fährt aus der Richtung auf, in der es sitzt, und zieht dorthin wieder ab. |
| Staffelung | Benachbarte Kacheln und Listeneinträge versetzt um ~40 ms, gedeckelt bei acht — sonst warten die letzten Einträge einer langen Liste spürbar. |
| Was bleibt, wandert | Ein Panel, das es in **beiden** Bereichen gibt, fährt von seinem alten an seinen neuen Platz (~420 ms), statt zu verschwinden und wiederzukommen. Zwischen Kampf und Upgrades verschwindet gar nichts — dort rückt alles nur, weil die untere Leiste höher wird. |
| Nur Verschwundenes tritt ab | Abtreten (~150 ms) darf, was der neue Bereich wirklich nicht mehr zeigt. Es wird dafür an seinen letzten Ort genagelt und aus dem Fluss genommen, damit es beim Gehen nichts mehr verschiebt. |
| Die Kamera geht mit | Das Spielfeld tritt einen Wimpernschlag zurück (Zoom ×0,97) und kommt von selbst wieder. Dadurch bewegt sich auch die Ebene, die eigentlich stehen bliebe — es wirkt wie **eine** Maschine, die umschaltet. |

Dauern und Kurven stehen als CSS-Variablen an einer Stelle (`--dur-*`, `--ease-*`). Nichts läuft
linear: `cubic-bezier(.22, 1, .36, 1)` trägt jede Bewegung, die etwas transportiert; eine leicht
überschwingende Kurve ist Quittungen vorbehalten — einem Knopf, der antwortet.

Der Wechsel selbst passiert **sofort und ganz**: In dem Augenblick, in dem der Klick ankommt,
steht der neue Bereich und hat das Spielfeld seine neue Größe. Bewegt wird danach nur noch die
Optik. Ein zweiter Klick während einer laufenden Bewegung braucht deshalb keine Sonderbehandlung —
er wechselt einfach wieder, und die Wanderung setzt dort an, wo die vorige gerade steht.

Wer die Bewegung abschaltet, bekommt den Wechsel ohne alles Weitere. Ob sie läuft, steht als
`--motion` an **einer** Stelle im Stilblatt und gilt für CSS und Skript gleichermaßen — der
Schalter im Spiel und die Einstellung des Betriebssystems führen dorthin zusammen.

---

## 11. Audio

**Der Prototyp bleibt stumm.** Ton wird erst ergänzt, wenn das Spielgefühl steht — zuerst Mechanik, dann Politur.

Damit Audio später ohne Umbau nachrüstbar ist, werden die **Auslösepunkte von Anfang an vorgesehen**: Das Spiel meldet die relevanten Ereignisse an eine zentrale Stelle, die zunächst nichts tut und später Sounds abspielt.

### Vorgesehene Auslösepunkte

| Kategorie | Ereignisse |
|---|---|
| Kampf | Schuss (pro Turmtyp unterschiedlich), Treffer, Gegner zerstört, Explosion, Laser |
| Bedrohung | Gegner dockt an der Station an, Stations-HP niedrig, Boss erscheint, Boss besiegt |
| Fortschritt | Gold eingesammelt, Level-Up, Turm gekauft, Modul platziert, Upgrade gekauft |
| Meta | Prestige ausgelöst, neue Rarität freigeschaltet, Versorgungskapsel eingesammelt |
| UI | Klick, Menüwechsel, Auswahlfenster |

### Grundsätze für später

- Bei sehr hohen Feuerraten dürfen Schussgeräusche nicht übereinanderstapeln — Begrenzung pro Zeitfenster nötig.
- Bei Spielgeschwindigkeit ×2/×4 muss Audio ausgedünnt statt beschleunigt werden.
- Der Lautstärkeregler in den Einstellungen bleibt bereits vorgesehen.

---

## 12. Spielerführung

Neue Systeme erscheinen erst, wenn sie gebraucht werden — neue Spieler sehen nur, was sie schon verstehen können.

**Es gibt kein geführtes Tutorial.** Stattdessen erscheint zu jedem neuen System einmalig ein kurzer, wegklickbarer Hinweis, der das Spiel nicht pausiert. Vollständige Liste → [14, Abschnitt 4a](14-progression-und-freischaltungen.md)
Audio-Auslösepunkte → Abschnitt 11

Unterstützend wirken visuelle Hilfen statt Text:

- **Buff-Verbindungen** werden auf der Baufläche als leuchtende Linie zwischen benachbarten Modulen dargestellt — die Nachbarschaftsregel muss man dann nicht lesen, man sieht sie.
- **Freie Andockkanten** werden beim Platzieren hervorgehoben; ungültige Ziele werden rot markiert statt versteckt, sonst wirkt die Geometrieregel wie ein Fehler.
- **Die Abriss-Vorschau** zeigt beim Zeigen auf ein Modul, was mit ihm zusammen ins Inventar zurückginge.
- **Reichweitenkreise** erscheinen beim Auswählen eines Turms — ohne den Zoom zu verändern (Abschnitt 4).
- **Das Turm-Detailfenster** zeigt „verstärkt *n* von *m* Nachbarn" und macht damit einen wirkungslosen Buff-Turm sofort sichtbar.

→ [14 – Progression und Freischaltungen](14-progression-und-freischaltungen.md)
