# Prototyp 01 — Turmbau (modulares Ansteck-System)

**Status:** geplant, noch nicht implementiert → [PLAN.md](PLAN.md)

| Etappe | Inhalt | Stand |
|---|---|---|
| M0 | Gerüst, Canvas, feste Zeitschritte | ✓ |
| M1 | Geometrie, `attachTo`, Überlappungsprüfung, Selbsttests | ✓ |
> Fühlt sich das Anstecken verschiedener Turmformen an den Hauptturm und aneinander gut an —
| M3 | Andocken an freie Kanten, Ghost, Platzlimit | ✓ |
| M4 | Entfernen, Verschieben, Zusammenhang | offen |
| M5 | Buff-System, Detailpanel, DPS-Kennzahl | offen |
| M6 | Optik, Auto-Zoom-Politur, Reichweitenkreise | offen |
Jedes Modul ist ein regelmäßiges Polygon mit **einheitlicher Seitenlänge** — Dreieck, Viereck,
Fünfeck oder Hexagon. Der Hauptturm ist ein festes Hexagon im Zentrum; neue Module docken an eine
**freie Kante** eines bereits platzierten Moduls an, wodurch Position und Drehung eindeutig
festliegen. Nachbarschaft — und damit jeder Buff — entsteht über **gemeinsame Kanten**, weshalb die
Form eines Moduls (3 bis 6 Anschlusskanten) eine echte Spielmechanik ist und nicht nur Optik.
npm --prefix prototypes run dev
> **Achtung:** Das weicht bewusst von [GDD 03 § 3](../../docs/gdd/03-modulare-basis-und-bauregeln.md)
> (Hex-Raster, Formen nur als Signatur) ab und folgt stattdessen § 2 und der Zielskizze.
> Begründung und Folgen: [PLAN.md, Abschnitt 0](PLAN.md).
Selbsttests laufen automatisch mit `?selftest` in der Adresszeile oder über den Knopf im rechten Panel.
## Nicht Teil des Prototyps
---
Kampf, Gegner, Gold, Upgrades, Prestige, Raritäts-Auswürfelung, Speicherstand-Kompatibilität, Audio.
Statt echtem Kampf dient eine theoretische Stations-DPS-Kennzahl zum Vergleich zweier Builds.

> Fühlt sich das Anstecken verschiedener Turmformen an den Hauptturm und aneinander gut an —
> und bleibt eine gewachsene Station lesbar und baubar?
*Wird mit der Implementierung ausgefüllt — geplante Belegung siehe [PLAN.md, Abschnitt 6.2](PLAN.md).*
## Grundidee in drei Sätzen
## Ergebnis
Jedes Modul ist ein regelmäßiges Polygon mit **einheitlicher Seitenlänge** — Dreieck, Viereck,
*Nach dem Experiment ausfüllen — die Fragen F1–F9 aus [PLAN.md, Abschnitt 10](PLAN.md) beantworten.*
**freie Kante** eines bereits platzierten Moduls an, wodurch Position und Drehung eindeutig
festliegen. Nachbarschaft — und damit jeder Buff — entsteht über **gemeinsame Kanten**, weshalb die
Form eines Moduls (3 bis 6 Anschlusskanten) eine echte Spielmechanik ist und nicht nur Optik.
| F1 | Fühlt sich das Einrasten an Kanten gut an? | |
> **Achtung:** Das weicht bewusst von [GDD 03 § 3](../../docs/gdd/03-modulare-basis-und-bauregeln.md)
| F3 | Wie stark begrenzt die Geometrie den Bau? | |
| F4 | Bleiben Module bei Auto-Zoom unterscheidbar? | |
| F5 | Ist die Formwahl eine interessante Entscheidung? | |
| F6 | Buff-Linien dauerhaft oder nur bei Auswahl? | |
| F7 | Ab wie vielen Nachbarn schlägt ein Buff-Turm einen Kampfturm? | |
| F8 | Ist die vollständige Neuberechnung schnell genug? | |
| F9 | Sind die entstehenden Lücken schön oder wirken sie kaputt? | |

## Übernahme ins Spiel

*Nach dem Experiment ausfüllen — Vorgabe siehe [PLAN.md, Abschnitt 11](PLAN.md).*

/* ### FEHLENDE ZEILE 53 ### */
/* ### FEHLENDE ZEILE 54 ### */
/* ### FEHLENDE ZEILE 55 ### */
/* ### FEHLENDE ZEILE 56 ### */
/* ### FEHLENDE ZEILE 57 ### */
/* ### FEHLENDE ZEILE 58 ### */
/* ### FEHLENDE ZEILE 59 ### */
/* ### FEHLENDE ZEILE 60 ### */
/* ### FEHLENDE ZEILE 61 ### */
/* ### FEHLENDE ZEILE 62 ### */
/* ### FEHLENDE ZEILE 63 ### */
/* ### FEHLENDE ZEILE 64 ### */
/* ### FEHLENDE ZEILE 65 ### */
/* ### FEHLENDE ZEILE 66 ### */
/* ### FEHLENDE ZEILE 67 ### */
/* ### FEHLENDE ZEILE 68 ### */
/* ### FEHLENDE ZEILE 69 ### */
/* ### FEHLENDE ZEILE 70 ### */
/* ### FEHLENDE ZEILE 71 ### */
/* ### FEHLENDE ZEILE 72 ### */
/* ### FEHLENDE ZEILE 73 ### */
/* ### FEHLENDE ZEILE 74 ### */
/* ### FEHLENDE ZEILE 75 ### */
/* ### FEHLENDE ZEILE 76 ### */
/* ### FEHLENDE ZEILE 77 ### */
/* ### FEHLENDE ZEILE 78 ### */
/* ### FEHLENDE ZEILE 79 ### */
/* ### FEHLENDE ZEILE 80 ### */
/* ### FEHLENDE ZEILE 81 ### */
/* ### FEHLENDE ZEILE 82 ### */
/* ### FEHLENDE ZEILE 83 ### */
/* ### FEHLENDE ZEILE 84 ### */
/* ### FEHLENDE ZEILE 85 ### */
/* ### FEHLENDE ZEILE 86 ### */
/* ### FEHLENDE ZEILE 87 ### */
/* ### FEHLENDE ZEILE 88 ### */
/* ### FEHLENDE ZEILE 89 ### */
/* ### FEHLENDE ZEILE 90 ### */
/* ### FEHLENDE ZEILE 91 ### */
/* ### FEHLENDE ZEILE 92 ### */
/* ### FEHLENDE ZEILE 93 ### */
/* ### FEHLENDE ZEILE 94 ### */
/* ### FEHLENDE ZEILE 95 ### */
/* ### FEHLENDE ZEILE 96 ### */
/* ### FEHLENDE ZEILE 97 ### */
/* ### FEHLENDE ZEILE 98 ### */
/* ### FEHLENDE ZEILE 99 ### */
/* ### FEHLENDE ZEILE 100 ### */
/* ### FEHLENDE ZEILE 101 ### */
/* ### FEHLENDE ZEILE 102 ### */
/* ### FEHLENDE ZEILE 103 ### */
/* ### FEHLENDE ZEILE 104 ### */
/* ### FEHLENDE ZEILE 105 ### */
/* ### FEHLENDE ZEILE 106 ### */
/* ### FEHLENDE ZEILE 107 ### */
/* ### FEHLENDE ZEILE 108 ### */
/* ### FEHLENDE ZEILE 109 ### */
/* ### FEHLENDE ZEILE 110 ### */
/* ### FEHLENDE ZEILE 111 ### */
/* ### FEHLENDE ZEILE 112 ### */
/* ### FEHLENDE ZEILE 113 ### */
/* ### FEHLENDE ZEILE 114 ### */
/* ### FEHLENDE ZEILE 115 ### */
/* ### FEHLENDE ZEILE 116 ### */
/* ### FEHLENDE ZEILE 117 ### */
/* ### FEHLENDE ZEILE 118 ### */
/* ### FEHLENDE ZEILE 119 ### */
auch im Spiel die richtige Wahl — kein Cache, keine Invalidierung.

### Beobachtung zu F5 (lohnt sich die Formwahl?)

In derselben 21-Modul-Station: **Ø 2,0 Nachbarn pro Modul**, nur 4 Module überhaupt gebufft.
Ein Fünfeck-Amplifier könnte 5 Module erreichen — real erreicht er meist 1–2.

Das ist ein Warnsignal für die Formmechanik: Wenn der Unterschied zwischen 3 und 5 Anschlusskanten
in der Praxis nie zum Tragen kommt, ist die Formwahl keine Entscheidung. Auch hier gilt die
Einschränkung, dass zufällig gewachsene Stationen verzweigter sind als ein bewusst kompakter Bau —
handgebaute Layouts in M7 müssen das prüfen.

### F4: Größe ist nicht das Problem — der Reichweiten-Zoom schon

Ansichtsfläche 750 × 680, Auto-Zoom, gemessen an Zufallsstationen:

| Module | Zoom | Kantenlänge | Emblem-Durchmesser |
|---|---|---|---|
| 5 | 1,34 | 75 px | 34 px |
| 9 | 1,37 | 77 px | 35 px |
| 16 | 1,19 | 67 px | 30 px |
| 26 | 0,99 | 55 px | 25 px |
| 41 | 0,80 | 45 px | 20 px |

Selbst bei 41 Modulen — weit über der Zielspanne 8–15 — bleiben Kanten 45 px und Embleme 20 px groß.
**Aus reinen Größengründen kippt die Lesbarkeit nicht.** Ob Form und Emblem inhaltlich
unterscheidbar sind, bleibt eine Beurteilungsfrage, die nur am Bild zu klären ist.

Kritisch wird es dagegen, sobald die Reichweitenkreise mitzoomen:

| Module | Zoom ohne Reichweiten | Zoom mit Reichweiten | Kantenlänge mit |
|---|---|---|---|
| 9 | 1,37 | 0,53 | 29 px |
| 16 | 1,19 | 0,43 | 24 px |

Ein Marksman erreicht bei Epic 432 Reichweite. Nimmt der Auto-Zoom das mit auf, schrumpft die
gesamte Station auf ein Drittel — Embleme landen bei 11 px.

> **Konflikt mit [GDD 13 §4](../../docs/gdd/13-ui-und-visuelles-design.md).** Dort steht, der Zoom
> solle „zusätzlich die maximale Turmreichweite" berücksichtigen. Das ist mit den hier gemessenen
> Werten nicht verträglich. Vorschlag: Reichweiten nur transient bei Auswahl/Hover zeigen, **ohne**
> den Zoom zu ändern — oder nur einen Bruchteil der Maximalreichweite in die Box aufnehmen.
> Im Prototyp ist der Effekt über `R` direkt vorführbar.

### Entscheidungen im Buff-System (M5)

Punkte, die das GDD offenlässt und die der Prototyp so beantwortet:

| Frage | Umsetzung im Prototyp | Begründung |
|---|---|---|
/* ### FEHLENDE ZEILE 170 ### */
/* ### FEHLENDE ZEILE 171 ### */
/* ### FEHLENDE ZEILE 172 ### */
/* ### FEHLENDE ZEILE 173 ### */
/* ### FEHLENDE ZEILE 174 ### */
/* ### FEHLENDE ZEILE 175 ### */
/* ### FEHLENDE ZEILE 176 ### */
/* ### FEHLENDE ZEILE 177 ### */
/* ### FEHLENDE ZEILE 178 ### */
/* ### FEHLENDE ZEILE 179 ### */
/* ### FEHLENDE ZEILE 180 ### */
/* ### FEHLENDE ZEILE 181 ### */
/* ### FEHLENDE ZEILE 182 ### */
/* ### FEHLENDE ZEILE 183 ### */
/* ### FEHLENDE ZEILE 184 ### */
/* ### FEHLENDE ZEILE 185 ### */
/* ### FEHLENDE ZEILE 186 ### */
/* ### FEHLENDE ZEILE 187 ### */
/* ### FEHLENDE ZEILE 188 ### */
/* ### FEHLENDE ZEILE 189 ### */
/* ### FEHLENDE ZEILE 190 ### */
/* ### FEHLENDE ZEILE 191 ### */
/* ### FEHLENDE ZEILE 192 ### */
/* ### FEHLENDE ZEILE 193 ### */
/* ### FEHLENDE ZEILE 194 ### */
/* ### FEHLENDE ZEILE 195 ### */
/* ### FEHLENDE ZEILE 196 ### */
/* ### FEHLENDE ZEILE 197 ### */
/* ### FEHLENDE ZEILE 198 ### */
/* ### FEHLENDE ZEILE 199 ### */
/* ### FEHLENDE ZEILE 200 ### */
/* ### FEHLENDE ZEILE 201 ### */
/* ### FEHLENDE ZEILE 202 ### */
/* ### FEHLENDE ZEILE 203 ### */
/* ### FEHLENDE ZEILE 204 ### */
/* ### FEHLENDE ZEILE 205 ### */
/* ### FEHLENDE ZEILE 206 ### */
/* ### FEHLENDE ZEILE 207 ### */
/* ### FEHLENDE ZEILE 208 ### */
/* ### FEHLENDE ZEILE 209 ### */
/* ### FEHLENDE ZEILE 210 ### */
/* ### FEHLENDE ZEILE 211 ### */
/* ### FEHLENDE ZEILE 212 ### */
/* ### FEHLENDE ZEILE 213 ### */
/* ### FEHLENDE ZEILE 214 ### */
/* ### FEHLENDE ZEILE 215 ### */
/* ### FEHLENDE ZEILE 216 ### */
/* ### FEHLENDE ZEILE 217 ### */
/* ### FEHLENDE ZEILE 218 ### */
/* ### FEHLENDE ZEILE 219 ### */
/* ### FEHLENDE ZEILE 220 ### */
/* ### FEHLENDE ZEILE 221 ### */
/* ### FEHLENDE ZEILE 222 ### */
/* ### FEHLENDE ZEILE 223 ### */
/* ### FEHLENDE ZEILE 224 ### */
/* ### FEHLENDE ZEILE 225 ### */
/* ### FEHLENDE ZEILE 226 ### */
/* ### FEHLENDE ZEILE 227 ### */
2. **Das Spiel muss es vermitteln.** Ein Spieler, der den Zusammenhang nicht kennt, baut den
   Amplifier zuletzt an den Rand und erlebt ihn als Fehlkauf.

*Einschränkung:* Die DPS-Kennzahl bewertet nur Schaden pro Sekunde. Dass „4 × Marksman" hier
gewinnt, ist ein Artefakt davon — gegen Gegnermassen wäre der Build schlecht. Belastbar ist der
**relative** Vergleich zwischen Buff-Turm und Kampfturm, nicht die Turmauswahl.

### Entscheidungen im Buff-System (M5)

Punkte, die das GDD offenlässt und die der Prototyp so beantwortet:

| Frage | Umsetzung im Prototyp | Begründung |
|---|---|---|
| Stapeln Buffs additiv oder multiplikativ? | **additiv**, danach gedeckelt | Multiplikativ macht die Obergrenze aus GDD 03 §9 wirkungslos und explodiert bei mehreren Amplifiern. Additiv ist im Panel erklärbar: „+29 % +32 %" |
| Wirkt Rarität auf Buff-Module? | ja, sie erhöht die **Buffstärke** | Buff-Module haben keine eigenen Kampfwerte — ohne das wäre Rarität dort wirkungslos |
| Erhält der **Hauptturm** Buffs? | **ja** | Er ist ein Modul mit gemeinsamen Kanten wie jedes andere. Macht die sechs Kernkanten zum wertvollsten Bauplatz → neue offene Frage **F10** im Plan |
| Zählt Eckberührung als Nachbarschaft? | **nein**, nur ganze gemeinsame Kanten | Sonst wäre die Regel visuell nicht ablesbar; so fehlt einfach die Buff-Linie |
| Neuberechnung | **vollständig** bei jeder Änderung | Bei ≤ 20 Modulen kostenlos; inkrementelle Buff-Updates sind eine klassische Fehlerquelle |

## Ergebnis

*Nach dem Experiment ausfüllen — die Fragen F1–F9 aus [PLAN.md, Abschnitt 10](PLAN.md) beantworten.*

| # | Frage | Antwort |
|---|---|---|
| F1 | Fühlt sich das Einrasten an Kanten gut an? | |
| F2 | Entfernen mit Stationsbruch: blockieren oder zurückgeben? | |
| F3 | Wie stark begrenzt die Geometrie den Bau? | |
| F4 | Bleiben Module bei Auto-Zoom unterscheidbar? | Größe ja (45 px bei 41 Modulen); mit Reichweiten-Zoom nein |
| F5 | Ist die Formwahl eine interessante Entscheidung? | |
| F6 | Buff-Linien dauerhaft oder nur bei Auswahl? | |
| F7 | Ab wie vielen Nachbarn schlägt ein Buff-Turm einen Kampfturm? | |
| F8 | Ist die vollständige Neuberechnung schnell genug? | |
| F9 | Sind die entstehenden Lücken schön oder wirken sie kaputt? | Beide Varianten per `P` vergleichbar — Bewertung offen |
| F10 | Soll der Hauptturm selbst Buffs erhalten? | im Prototyp: ja — noch zu bewerten |

## Übernahme ins Spiel

*Nach dem Experiment ausfüllen — Vorgabe siehe [PLAN.md, Abschnitt 11](PLAN.md).*

