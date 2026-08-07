Datei : prototypes\01-tower-building\README.md
Luecke: Zeilen 170 bis 227  (58 Zeilen)

---- Anker davor ----
### Entscheidungen im Buff-System (M5)
Punkte, die das GDD offenlässt und die der Prototyp so beantwortet:
| Frage | Umsetzung im Prototyp | Begründung |
|---|---|---|

---- Anker danach ----
2. **Das Spiel muss es vermitteln.** Ein Spieler, der den Zusammenhang nicht kennt, baut den
   Amplifier zuletzt an den Rand und erlebt ihn als Fehlkauf.
*Einschränkung:* Die DPS-Kennzahl bewertet nur Schaden pro Sekunde. Dass „4 × Marksman" hier
gewinnt, ist ein Artefakt davon — gegen Gegnermassen wäre der Build schlecht. Belastbar ist der

======== Fundstelle 1  |  vorwaerts ab Anker davor  |  Anker 2 Zeilen  |  44 Inhaltszeilen  |  018RDq5T9duERXFFvNSz72Y1/Bash/Ergebnis ========
| Stapeln Buffs additiv oder multiplikativ? | **additiv**, danach gedeckelt | Multiplikativ macht die Obergrenze aus GDD 03 §9 wirkungslos und explodiert bei mehreren Amplifiern. Additiv ist im Panel erklärbar: „+29 % +32 %" |
| Wirkt Rarität auf Buff-Module? | ja, sie erhöht die **Buffstärke** | Buff-Module haben keine eigenen Kampfwerte — ohne das wäre Rarität dort wirkungslos |
| Erhält der **Hauptturm** Buffs? | **ja** | Er ist ein Modul mit gemeinsamen Kanten wie jedes andere. Macht die sechs Kernkanten zum wertvollsten Bauplatz → neue offene Frage **F10** im Plan |
| Zählt Eckberührung als Nachbarschaft? | **nein**, nur ganze gemeinsame Kanten | Sonst wäre die Regel visuell nicht ablesbar; so fehlt einfach die Buff-Linie |
| Neuberechnung | **vollständig** bei jeder Änderung | Bei ≤ 20 Modulen kostenlos; inkrementelle Buff-Updates sind eine klassische Fehlerquelle |

## Ergebnis

Alles Messbare ist gemessen. Was übrig bleibt, sind **Urteile am Bild**, die nur am laufenden
Prototyp zu fällen sind — sie sind hier bewusst offen gelassen statt geraten.

| # | Frage | Antwort |
|---|---|---|
| F1 | Fühlt sich das Einrasten an Kanten gut an? | **offen — Urteilsfrage.** Mechanik steht: Ghost rastet auf die nächste freie Kante, Fangradius 2,5 × Seitenlänge |
| F2 | Entfernen mit Stationsbruch: blockieren oder zurückgeben? | **Variante B mit Vorschau.** Bei 15 Modulen sind 50 % Brückenmodule — A würde jedes zweite Modul festnageln. B ist nur zumutbar, weil die Vorschau vorher zeigt, was mitgeht |
| F3 | Wie stark begrenzt die Geometrie den Bau? | **27,7 % tote Kanten**, Ø 2,24 von 4 Formen passen. An der Frustgrenze, aber als Mechanik lesbar |
| F4 | Bleiben Module bei Auto-Zoom unterscheidbar? | **Größe ja** (45 px bei 41 Modulen). **Mit Reichweiten-Zoom nein** (24 px) → Konflikt mit GDD 13 §4 |
| F5 | Ist die Formwahl eine interessante Entscheidung? | **Ja, aber schwach.** Kantenauslastung 40–51 %; Dreieck 1,52 gegen Fünfeck 1,98 Nachbarn |
| F6 | Buff-Linien dauerhaft oder nur bei Auswahl? | **offen — Urteilsfrage.** Beides per `B` umschaltbar |
| F7 | Ab wie vielen Nachbarn schlägt ein Buff-Turm einen Kampfturm? | **Buff > 1/k.** Am Rand angebaut erreicht ein Amplifier nie mehr als k = 1 und verliert immer. Zuerst gesetzt und umbaut erreicht er k = 4 und gewinnt um 4–17 % |
| F8 | Ist die vollständige Neuberechnung schnell genug? | **Ja.** 0,65 ms pro Änderung bei 21 Modulen, nur bei Änderungen |
| F9 | Sind die entstehenden Lücken schön oder wirken sie kaputt? | **offen — Urteilsfrage.** Grundplatte per `P` gegen offene Keile vergleichbar |
| F10 | Soll der Hauptturm selbst Buffs erhalten? | **Ja — und es ist nicht kosmetisch.** Ohne den Kern als viertes Buff-Ziel wäre der Epic-Amplifier rechnerisch wertlos (F7) |

### Was ins GDD musste — eingearbeitet

Alle Punkte sind übernommen. Geänderte Dokumente: **03** (Abschnitte 2, 3, 4, 7, 9, 10, 12),
**04** (§1), **05** (§4, §5), **06** (§7), **08** (§5), **13** (§4, §5, §6, §12), **14** (§4a),
**15** (§8, §16), **16** (§1, §7, §15) sowie die GDD-Übersicht.

| Änderung | Betrifft |
|---|---|
| § 3 (Hex-Raster) durch das Kantensystem ersetzen; „hinterlassen keine Lücken" streichen | [GDD 03](../../docs/gdd/03-modulare-basis-und-bauregeln.md) |
| Entfern-Regel festhalten: Inseln wandern zurück, mit Vorschau vor dem Klick | GDD 03 |
| Buff-Regel ergänzen: Nachbarschaft = **geteilte Kante**, Eckberührung zählt nicht | GDD 03 § 9 |
| Buffstärke an die Schwelle `b > 1/k` binden — sonst sind Buff-Türme rechnerisch tot | GDD 03 § 9, [GDD 15](../../docs/gdd/15-balancing-und-skalierung.md) |
| Hauptturm ist buffbar | GDD 03 § 9, [GDD 04](../../docs/gdd/04-hauptturm-system.md) |
| Buffs stapeln **additiv**, danach Deckel | GDD 03 § 9 |
| Zoom darf die maximale Turmreichweite **nicht** vollständig einschließen | [GDD 13 § 4](../../docs/gdd/13-ui-und-visuelles-design.md) |
| Modulform bestimmt die Anzahl der Anschlusskanten und ist damit Mechanik, nicht Optik | GDD 03 § 7 |

## Übernahme ins Spiel

| Was | Wie |
|---|---|
| [`geometry.ts`](geometry.ts) | praktisch unverändert übernehmen — reine Mathematik, im Spiel identisch |
| [`station.ts`](station.ts), [`buffs.ts`](buffs.ts) | als Vorlage; im Spiel gegen den echten Zustand neu schreiben. Die Regeln stimmen, die Struktur ist bewährt |
| Katalogstruktur (Footprint + Emblem) | Struktur ja, Werte nein — Balancing kommt aus GDD 15 |
| [`persist.ts`](persist.ts) | Format bestätigt: 11 Module + Inventar = 1,4 KB, Rundung auf 3 Nachkommastellen unkritisch |
| Rendering, Eingabe, UI | nur Referenz; im Spiel gegen die echte Kampfansicht neu bauen |
| [`devtools.ts`](devtools.ts), [`selftest.ts`](selftest.ts) | bleiben hier |

Der Prototyp wird ab hier nicht mehr gepflegt.

======== Fundstelle 2  |  vorwaerts ab Anker davor  |  Anker 2 Zeilen  |  5 Inhaltszeilen  |  013z6F6uM52Mbkutjk2RkKtu/Edit/neu ========
| Stapeln Buffs additiv oder multiplikativ? | **additiv**, danach gedeckelt | Multiplikativ macht die Obergrenze aus GDD 03 §9 wirkungslos und explodiert bei mehreren Amplifiern. Additiv ist im Panel erklärbar: „+29 % +32 %" |
| Wirkt Rarität auf Buff-Module? | ja, sie erhöht die **Buffstärke** | Buff-Module haben keine eigenen Kampfwerte — ohne das wäre Rarität dort wirkungslos |
| Erhält der **Hauptturm** Buffs? | **ja** | Er ist ein Modul mit gemeinsamen Kanten wie jedes andere. Macht die sechs Kernkanten zum wertvollsten Bauplatz → neue offene Frage **F10** im Plan |
| Zählt Eckberührung als Nachbarschaft? | **nein**, nur ganze gemeinsame Kanten | Sonst wäre die Regel visuell nicht ablesbar; so fehlt einfach die Buff-Linie |
| Neuberechnung | **vollständig** bei jeder Änderung | Bei ≤ 20 Modulen kostenlos; inkrementelle Buff-Updates sind eine klassische Fehlerquelle |

======== Fundstelle 3  |  vorwaerts ab Anker davor  |  Anker 2 Zeilen  |  21 Inhaltszeilen  |  013z6F6uM52Mbkutjk2RkKtu/Read/Ergebnis ========
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


======== Fundstelle 4  |  rueckwaerts ab Anker danach  |  Anker 2 Zeilen  |  107 Inhaltszeilen  |  018RDq5T9duERXFFvNSz72Y1/Bash/Ergebnis ========
deren Entfernung also unter Variante A blockiert würde bzw. unter Variante B andere mitreißt.

| Stationsgröße | Brückenmodule | Ø mitgerissene Module (B) | schlimmster Fall |
|---|---|---|---|
| 4 Module | 30 % | 1,4 | — |
| 8 Module | 42,6 % | 2,2 | — |
| 12 Module | 48,3 % | 2,7 | — |
| 15 Module | 50,2 % | 3,0 | 13 Module auf einen Schlag |

**Vorläufige Lesart — beide Varianten haben ein Problem.** Bei Zielgröße 8–15 Modulen wäre unter
Variante A rund jedes zweite Modul unentfernbar; unter Variante B reißt ein Klick im Schnitt drei
weitere Module mit, im Extremfall die halbe Station.

*Einschränkung:* Die Stationen sind zufällig gewachsen und dadurch verzweigter als das, was ein
Spieler bewusst kompakt um den Kern baut. Die Zahlen sind eher eine Obergrenze. Eine belastbare
Antwort braucht Messungen an echten, von Hand gebauten Layouts (M7).

**Umgesetzt:** die Abriss-Vorschau. Wer auf ein Modul zeigt, sieht sofort, was daran hängt —
rot unter Variante A („Entfernen blockiert — N Module würden abreißen"), bernstein unter
Variante B („Entfernen nimmt N weitere Module mit"). Damit überrascht B niemanden mehr, und
unter A ist der Grund für die Sperre sichtbar statt nur behauptet.

### F8 beantwortet: Neuberechnung ist billig

Station mit 21 Modulen, je 400 Durchläufe:

| Aufruf | Zeit |
|---|---|
| `computeStation` (alle Buffs + DPS + HP) | 0,29 ms |
| `freeEdges` | 0,35 ms |
| **zusammen pro Änderung** | **0,65 ms** |

Beides läuft nur bei Änderungen, nicht pro Frame. Die vollständige Neuberechnung bleibt damit
auch im Spiel die richtige Wahl — kein Cache, keine Invalidierung.

### F5: die Formwahl wirkt — aber schwach

60 Stationen mit je 15 Modulen, Nachbarn pro Grundfläche:

| Grundfläche | Module | Ø Nachbarn | Auslastung der Kanten |
|---|---|---|---|
| Dreieck (3) | 271 | 1,52 | 51 % |
| Viereck (4) | 226 | 1,74 | 44 % |
| Fünfeck (5) | 196 | 1,98 | 40 % |
| Hexagon (6) | 267 | 2,65 | 44 % |

Mehr Kanten bringen tatsächlich mehr Nachbarn, und die Auslastung liegt bei allen Formen bei
40–51 % — die Mechanik funktioniert also wie gedacht. **Der absolute Unterschied ist aber klein:**
zwischen Dreieck und Fünfeck liegen 0,46 Nachbarn. Wer bewusst kompakt baut, holt mehr heraus
(siehe F7), aber im normalen Wachstum ist die Formwahl eher Nuance als Entscheidung.

### F3: gut ein Viertel der Kanten ist unbebaubar

60 Stationen mit je 15 Modulen, 2.397 freie Kanten, geprüft gegen alle vier Grundflächen
(Turmplatz-Limit ausgeklammert — das ist eine Spielregel, keine Geometrie):

| Messgröße | Wert |
|---|---|
| Kanten, an die **gar nichts** passt | **27,7 %** |
| Ø passende Formen je Kante (von 4) | 2,24 |
| Dreieck passt an | 72 % der Kanten |
| Viereck | 57 % |
| Fünfeck | 48 % |
| Hexagon | 46 % |

Das liegt genau an der Schwelle, die der Plan als Frustgrenze angesetzt hatte (~30 %). Die
Geometrie schränkt spürbar ein, und zwar ungleich: Ein Hexagon findet nur an knapp der Hälfte
der Kanten Platz, ein Dreieck fast überall. **Das ist keine Störung, sondern eine Mechanik** —
große Module brauchen Platz, kleine füllen Lücken. Es muss aber im Spiel sichtbar sein, sonst
wirkt es wie ein Fehler: Der Prototyp markiert deshalb ungültige Ziele rot statt sie zu verstecken.

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

### F7: Buff-Türme lohnen sich nur mit Voraussicht — das ist der wichtigste Befund

**Die Faustformel.** Ein Buff-Turm belegt denselben Platz wie ein Kampfturm. Er verstärkt `k`
Module um `b`. Er schlägt einen zusätzlichen gleichwertigen Kampfturm genau dann, wenn

> **b > 1 / k**

| gebuffte Module | nötiger Buff |
|---|---|
| 1 | > 100 % |
| 2 | > 50 % |
| 3 | > 33 % |
| 4 | > 25 % |
| 5 | > 20 % |

**Warum das entscheidend ist.** Ein neu angestecktes Modul teilt sich per Konstruktion **genau eine**
Kante mit der Station. In 659 gemessenen Platzierungen an gewachsenen Stationen hatte ein frisch
gesetzter Amplifier **nie mehr als einen** verstärkbaren Nachbarn. Bei k = 1 wäre ein Buff über
100 % nötig — der Amplifier verliert entsprechend in 95–100 % der Fälle gegen einen weiteren
Kampfturm (Ø +18–28 DPS gegen +49–128 DPS).

> **Wer einen Buff-Turm an eine fertige Station anbaut, macht immer einen Fehler.**

**Umgekehrt funktioniert es.** Wird der Amplifier **zuerst** gesetzt und werden die Kampftürme an
*seine* freien Kanten gebaut, erreicht er 4 Module (drei Türme plus den Hauptturm) — vier Plätze,
gleicher Preis:

| Aufbau | Amplifier Epic | Legendary | Mythic |
|---|---|---|---|
| 4 × Autocannon = 538,7 DPS | 569,3 (**+5,7 %**) | 591,7 (**+9,8 %**) | 627,5 (**+16,5 %**) |
| 4 × Marksman = 654,1 DPS | 679,2 (**+3,8 %**) | 705,9 (**+7,9 %**) | 748,7 (**+14,5 %**) |

**Antwort auf F7:** Der Buff-Turm ist tragfähig, aber nur mit Planung. Das ist gutes Design —
es belohnt Voraussicht statt Nachrüsten. Zwei Bedingungen hängen daran:

1. **F10 trägt die Rechnung.** Der Amplifier kommt nur auf k = 4, weil der **Hauptturm mitgebufft
   wird**. Ohne das wären es 3 Nachbarn, die Schwelle läge bei 33 %, und ein Epic-Amplifier (27 %)
   würde verlieren. Die Entscheidung „Kern ist buffbar" ist also nicht kosmetisch.

======== Fundstelle 5  |  rueckwaerts ab Anker danach  |  Anker 2 Zeilen  |  29 Inhaltszeilen  |  013z6F6uM52Mbkutjk2RkKtu/Edit/neu ========
### F7: Buff-Türme lohnen sich nur mit Voraussicht — das ist der wichtigste Befund

**Die Faustformel.** Ein Buff-Turm belegt denselben Platz wie ein Kampfturm. Er verstärkt `k`
Module um `b`. Er schlägt einen zusätzlichen gleichwertigen Kampfturm genau dann, wenn

> **b > 1 / k**

| gebuffte Module | nötiger Buff |
|---|---|
| 1 | > 100 % |
| 2 | > 50 % |
| 3 | > 33 % |
| 4 | > 25 % |
| 5 | > 20 % |

**Warum das entscheidend ist.** Ein neu angestecktes Modul teilt sich per Konstruktion **genau eine**
Kante mit der Station. In 659 gemessenen Platzierungen an gewachsenen Stationen hatte ein frisch
gesetzter Amplifier **nie mehr als einen** verstärkbaren Nachbarn. Bei k = 1 wäre ein Buff über
100 % nötig — der Amplifier verliert entsprechend in 95–100 % der Fälle gegen einen weiteren
Kampfturm (Ø +18–28 DPS gegen +49–128 DPS).

> **Wer einen Buff-Turm an eine fertige Station anbaut, macht immer einen Fehler.**

**Umgekehrt funktioniert es.** Wird der Amplifier **zuerst** gesetzt und werden die Kampftürme an
*seine* freien Kanten gebaut, erreicht er 4 Module (drei Türme plus den Hauptturm) — vier Plätze,
gleicher Preis:

| Aufbau | Amplifier Epic | Legendary | Mythic |
|---|---|---|---|
| 4 × Autocannon = 538,7 DPS | 569,3 (**+5,7 %**) | 591,7 (**+9,8 %**) | 627,5 (**+16,5 %**) |
| 4 × Marksman = 654,1 DPS | 679,2 (**+3,8 %**) | 705,9 (**+7,9 %**) | 748,7 (**+14,5 %**) |

**Antwort auf F7:** Der Buff-Turm ist tragfähig, aber nur mit Planung. Das ist gutes Design —
es belohnt Voraussicht statt Nachrüsten. Zwei Bedingungen hängen daran:

1. **F10 trägt die Rechnung.** Der Amplifier kommt nur auf k = 4, weil der **Hauptturm mitgebufft
   wird**. Ohne das wären es 3 Nachbarn, die Schwelle läge bei 33 %, und ein Epic-Amplifier (27 %)
   würde verlieren. Die Entscheidung „Kern ist buffbar" ist also nicht kosmetisch.

