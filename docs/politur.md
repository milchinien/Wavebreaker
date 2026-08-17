# Politur — Spielgefühl und Optik (E18)

> Arbeitsliste für die Politur nach GDD 13 §10. **Ein Durchlauf = ein Punkt.**
> Sortiert nach Wirkung pro Aufwand, nicht nach Thema.

## Regeln für jeden Punkt

- Farben nur aus `PALETTE` (`src/render/theme.ts`) bzw. den CSS-Variablen in `src/style.css`.
- Spielertexte nur über `t()` aus `src/data/strings.ts`.
- Zufall nur aus `core/rng.ts`, Zeit nur aus `core/loop.ts`. `sim/` und `core/` fassen kein
  DOM und kein Canvas an — Effekte leben in `render/` und `ui/`.
- Partikel gedeckelt und wiederverwendet. Bei Tempo ×2/×4 werden Effekte **ausgedünnt**,
  nicht beschleunigt.
- Dezent statt überladen: Verdeckt ein Effekt die Station oder lenkt von ihr ab, ist er falsch.
- Jeder Effekt hängt an einem Ereignis aus `core/events.ts`, damit Audio später ohne Umbau
  andocken kann (GDD 13 §11).
- Vorhandene Anlagen aus `assets/raw` nutzen, wo sie passen.

## Offen

5. **Das Gedränge hat kein Gewicht** — Die vier gestellten Punkte halten: 27 Konturspitzen auf
   der dichtesten Bildzeile statt 8, ein Schwarmgegner misst 20–21 px quer statt rund 7,
   zwischen zwei Nachbarn fällt der Wert auf Grund + 1,0 zurück (Median über 3771 Lücken 0,0),
   und 194 Gegner kosten 0,84 ms je Bild. Größte Lücke: Der Umriss ist halb so groß wie der der
   Latte — 20–21 px quer und 122–136 helle Pixel je Gegner gegen 34–35 px und 454–460. Daraus
   folgen 4,63 Prozent rosa Fläche im Kreis statt 22,44 und 8 von 180 Radialstrahlen ohne einen
   einzigen Gegner. Nötig: `ENEMY_MIN_DRAW` in `src/render/combat.ts` von 10 auf 17 heben, das
   damit verkoppelte `CROWD_MIN_RADIUS` in `src/sim/enemies.ts` von 11 auf 18,7 Welteinheiten
   mitziehen, damit der Nachbarabstand mit dem Umriss wächst, und die Strichbreite der Masse von
   1,6 auf 3,0 setzen. Anmerkung: Geändert wurde bereits auch die Simulation
   (`CROWD_MIN_RADIUS`, Stoßstärke `CROWD_PACK` von 3 auf 9). Anzahl, HP, Schaden und Belohnung
   sind unangetastet, die Positionen nicht — das gehört beim nächsten Balancing nachgeprüft.

6. **Die Upgrade-Kachel rechnet gegen die falsche Kachelzahl** — Name, getrennte Zellen für Wert
   und Preis, genau ein Währungszeichen und Einheiten aus `strings.ts` stehen; die neue Leiter
   990/1300/1600/1910/2210 px trägt für drei Kacheln je Gruppe (engste Kachel 90,1 px,
   Kapazität 11,33 Zeichen gegen ein Budget von 11). Größte Lücke: Die Gruppe „Station" hat
   **vier** Kacheln, sobald der Prestige-Knoten `helper.collector` gekauft ist — die
   Breitenrechnung in `src/style.css` und die Wächterregel in `src/selftest/guards.ts`
   (`card = (column - GROUP_INSET) / 3`) unterstellen drei. K4 = (S − 27)/4 fällt auf 66,58 px
   bei 2210 px und selbst bei 2560 px nur auf 81,17 px; auf 1422 der 1661 Breiten von 900 bis
   2560 px (86 Prozent) liegt die Kachel unter dem 90-px-Minimum, das der Kommentar daneben
   selbst festlegt. Dem Wertfeld bleiben 48,58 px = 8,1 Zeichen, und „393.6 m/s" der Kachel
   „Gold collector" wird mit Ellipse gekappt, während der Wächter grün meldet. Dazu ist die
   sichtbare Kachelüberschrift `def.label` aus `src/data/upgrades.ts` ein englisches Literal,
   das nie durch `t()` läuft — die Textregel durchsucht `data/` gar nicht.

7. **Der Lebensbalken kommt nicht überall an** — Länge und Höhe sind mit 18 × 3 px auf 0 px
   genau einheitlich, unabhängig vom Gegnerradius; die Füllung ist für alle dieselbe
   (100 Prozent der Pixel exakt #ff0000 auf #03050d, keine Gegnerfarbe), und der Boss weicht mit
   54 × 3 px nachweislich nur in der Länge ab. Größte Lücke: Die Balkenschleife sitzt noch
   innerhalb von `drawEnemies` (`src/render/combat.ts`, Schleife über `hpBars`), und in
   `src/render/scene.ts` pinseln danach zehn Ebenen darüber. Von vier angeschlagenen Gegnern im
   Standbild kommen zwei Balken unversehrt an (54 von 54 Pixeln), einem fehlen 19 von 54, und
   einer hat 0 von 54 — er liegt unter einem Blitz aus `drawHits`, also ausgerechnet an dem
   Gegner, der gerade getroffen wurde. Die Schleife gehört als eigene Funktion zwischen
   `drawHits` und `drawDamageNumbers`, damit der Balken über jedem Effekt und weiter unter den
   Schadenszahlen liegt. Nebenbefund: Beim Schwarmgegner ist der Balken mit 18 px um 64 Prozent
   breiter als der 11 px breite Gegner, den er beschreibt.

8. **Die Hinweisreihe kann blockieren** — Verfallsbedingungen je Zettel, eine Frist in gespielter
   Zeit (20 Minuten je Hinweis) und der Abgleich geladener Spielstände über `settleHints` stehen;
   ein alter Spielstand löst die Reihe nicht neu aus. Größte Lücke: Der stehende Zettel hat keine
   Frist — `pendingHint` in `src/sim/hints.ts` gibt ihn zurück, bevor `when`, `gone` oder
   `hintExpired` überhaupt geprüft werden. Wer nie auf „Got it" klickt, sieht über 200.000 Bilder
   = 55 Stunden gespielter Zeit genau 1 von 8 Hinweisen. Der mitgelieferte Zufallslauf kann das
   nicht sehen, weil seine Klickwahrscheinlichkeit bei mindestens 0,02 liegt und er kein
   Einschmelzen kennt; ein Lauf mit 20 Prozent Nie-Klickern und 5 Prozent Einschmelzen je Bild
   zeigt nur in 292 von 500 Läufen alle acht. 109 von 400 klickenden Läufen verlieren `hint.buff`
   stumm, weil `gone: !ownsBuff(state)` ein „noch nicht" statt eines „vorbei" ist — `amplifier`
   trägt in `src/data/towers.ts` kein `unlock` und bleibt dauerhaft im Angebotstopf. Dazu: „Hinweise
   zurücksetzen" bringt beim Veteranen nur 6 von 8 Zetteln zurück, und `runtime.hintId` liegt
   nicht im Spielstand — wer neu lädt, während ein Zettel steht, verliert ihn ungelesen.

0. **Die Randmarke unterscheidet Boss und Drohne nicht** — `drawApproach` zeichnet für jeden
   Gegner dasselbe Winkelzeichen in derselben Größe. Ein anrollender Boss ist damit optisch
   so laut wie ein Schwarmkrümel, obwohl sein Radius das Vierfache ist.
   (War Punkt 4; die Punkte 2 und 3 sind mit dem Münzbild hinfällig geworden — Münzen auf
   dem Feld tragen keine Zahl mehr, also gibt es weder zwei Schriftgrade noch eine
   springende Beschriftungsschwelle.)

1. ~~**Gegner erscheinen aus dem Nichts**~~ — **hinfällig, nicht umgesetzt (2026-08-03).**
   Nachgemessen: Der Erscheinungsring liegt bei `SPAWN_RING_MARGIN` = 420 Einheiten, das Bild
   reicht nur `FIT_MARGIN` = 90 über die Station hinaus. Sichtbar sind je nach Fenster ±138
   bis ±436 Einheiten, der Ring liegt bei 476 bis 555 — in **jeder** gemessenen Konfiguration
   außerhalb. Ein Aufziehen am Erscheinungsort sähe niemand. Was hier fehlt, ist etwas
   anderes: ein Hinweis am Bildrand, aus welcher Richtung etwas kommt.
2. ~~**Zahlen auf dem Feld haben zwei Größen**~~ — hinfällig: Münzen tragen keine Zahl mehr,
   damit steht auf dem Feld nur noch ein Schriftgrad.
3. ~~**Beim Einsammeln springen die Beschriftungen an**~~ — hinfällig aus demselben Grund.

## Erledigt

- **Ein kritischer Treffer bleibt vorn** (2026-08-07) — Die zwei Plätze mit Kontur und voller
  Deckkraft in `drawDamageNumbers` (`src/render/combat.ts`) hängen nicht mehr an `seq` allein,
  sondern am Paar (`crit`, `seq`): Ein Durchgang sammelt die beiden jüngsten Zahlen **und** den
  jüngsten lebenden Krit; liegt der Krit nicht ohnehin vorn, verdrängt er die ältere der beiden,
  und es bleiben in jedem Fall genau zwei. Nachgemessen im Standbild (Welle 12, 18 s, Krit mit
  acht jüngeren Zahlen dahinter): 78 reinweiße Pixel im ganzen Bild, 69 davon in genau zwei
  umrandeten Clustern — dem Krit und der jüngsten Zahl; die übrigen 15 Zahlen tragen 0 reinweiße
  und 0 reinschwarze Pixel. Der Kontrast des Krits steigt von 3,38:1 auf 19,0:1. Im Belastungsfall
  mit 194 Gegnern dasselbe Ergebnis. Im selben Zug endet der Geschossschweif vor dem abfeuernden
  Modul statt mitten hindurch: Das Geschoss trägt über das neue Feld `Projectile.reach` den
  Umkreis seines Schützen mit, die Zeichenebene schneidet die Länge darauf zu — gemessene
  Keillängen 60/52/44/21 px statt 104, kein Keil mehr im Modul. Typecheck fehlerfrei,
  521/521 Selbsttests.
  Vorher fiel ein Krit hinter jeden späteren Kleckerschaden zurück: Im Standbild stand die 192
  blass bei 3,38:1 ohne Kontur, während zwei 3-Schaden-Ticks in reinem Weiß mit schwarzer Kontur
  davor lagen. Die Zahl, die den seltenen Treffer meldet, war damit die unauffälligste im Bild.
  Offen bleibt der Schweif selbst: Er wird weiter mit `source-over` und höchstens 0,5 Deckkraft
  gezeichnet, deshalb bestimmt nicht der Verlauf seine Helligkeit, sondern was darunter liegt —
  die Gitterlinien heben ihn um bis zu +3,14 Luminanz an, ein Gegner im Gedränge um +25,22.

- **Der Reichweitenring ist eine dunkle Zone** (2026-08-07) — `drawRangeRing` füllt die Fläche
  jetzt additiv mit einem flachen `rgb(9,9,9)` statt mit einem Cyan-Verlauf und zieht die Kante
  in `THEME.rangeEdge` = RGB(43,49,56); das Atmen und `shadowBlur 12` sind ersatzlos weg.
  Nachgemessen: Ringdurchgang 15 bis 17 px breit statt 2 (Median 16 über 308 Winkel), max − min
  der Kanäle 13 statt 58, Sprung an der Kante 10,10 Einheiten bei SD 0,68 über 298 Winkel und
  unabhängig vom Radius (10,09 innen gegen 10,14 außen). Mit Leuchtdichte 48,23 liegt der Ring
  unter jeder der 194 Gegnerspitzen (dunkelste 148,4), unter jeder Schadenszahl (ab 204) und
  jedem Geschosskopf (255); im instrumentierten Zeichenaufruf `shadowBlur` 0 und ein flacher
  `fillStyle` statt eines Verlaufs. Kosten 0,03 ms je Bild, Typecheck fehlerfrei,
  524/524 Selbsttests.
  Vorher war der Wirkungsbereich ein leuchtender Cyan-Haarstrich mit Streuhof, der über die ganze
  Bildbreite lag und im Sekundentakt pulste — dauerhafte Geometrie in derselben Sprache wie eine
  Fähigkeit mit Laufzeit. Er nahm Turm, Geschosskopf und Bauhilfe fortwährend Aufmerksamkeit weg
  und trug trotzdem keine ablesbare Zone, sondern nur eine Linie.
  Offen bleibt das optische Gewicht: Die Strichbreite wird einmal aus dem äußersten Punkt
  gerechnet statt aus dem örtlichen Radius (gemessen 15,55 px bei Kantenradius 307 und 15,51 px
  bei 436), deshalb belegt der Ring 2,986 Prozent des Bildes gegen 0,634 bis 0,769 bei der Latte.

- **Der Abschuss liegt über den Gegnern, und der Getroffene hellt auf** (2026-08-07) — In
  `src/render/scene.ts` zeichnen `drawBursts` und `drawShards` nach `drawEnemies`, und
  `drawBursts` hat einen Hof bekommen (`shadowBlur` = 18 × Restlaufzeit × Zoom) samt einem Kranz
  aus 10 bis 14 schrumpfenden Kreisen in **einem** Pfad statt eines heruntergedimmten Einzelrings.
  Nachgemessen über drei kontrollierte Renderdurchgänge im Belastungsfall (194 Gegner): 474 Pixel
  Überlappung zwischen Wolke und Gegnern, an allen 474 ist der Endwert der der Wolke, an 0 Pixeln
  übermalt ein lebender Gegner sie. `drawHits` setzt an genau den fünf Einschlägen des Bildes
  `shadowBlur` 4,0 bis 11,6. Derselbe Gegner ist mit Treffer über seine 166 Körperpixel um 41,9
  Leuchtstufen heller als ohne, Spitze +168,5. Die Wolke belegt 2434 Pixel = 0,24 Prozent des
  Bildes, davon 0 im Stationsrahmen. Typecheck fehlerfrei, 553/553 Selbsttests, dazu eine neue
  Querschnittsregel „jeder Kampfeffekt trägt einen Hof".
  Vorher war der Tod eines Gegners das leiseste Ereignis im Bild: Die Ablation der Ebenen
  `bursts` und `shards` hob ganze 42 Pixel über Helligkeit 150 — schwächer als eine liegende
  Münze —, und lebende Gegner malten die Druckwelle zu, weil sie danach gezeichnet wurden. Der
  Effekt, der einen Abschluss meldet, verschwand hinter dem, was noch da war.
  Offen bleibt die Sicht auf die neue Aufhellung: Die Schadenszahl deckt 69,3 Prozent der
  Körperfläche des aufgehellten Gegners zu, das Einschlagsprite weitere 49,4 Prozent.

- **Die Ressourcenzeile steht in allen fünf Bereichen an derselben Stelle** (2026-08-07) —
  `.resource-bar` ist eine mittig an der Oberkante hängende Pille aus drei Segmenten — Stufe,
  Gold, Prestigepunkte —, jedes mit Piktogramm und Zahl und ohne Wortlabel; die Bedeutung steht
  nur im `aria-label`, weil unter der Zeile Gold eingesammelt wird. Nachgerechnet: `.resource-bar`
  kommt in keiner `[data-view]`-Regel mehr vor und fehlt in der elfgliedrigen `display: none`-
  Sammelliste; genau **eine** Regel im ganzen Stilblatt setzt ihren Ort (`src/style.css`
  1191–1219, `top: 0; left: 50%; translateX(-50%)`), Bezugsrahmen ist `#overlay` mit `inset: 0`
  in einem Feld, dessen Oberkante in jedem Bereich auf y = 0 liegt — Versatz 0. Drei eigene
  Farben in `:root`: `--res-level` #f0b86e, `--res-gold` #f5dd49, `--res-prestige` #e894b8,
  paarweise verschieden. Typecheck fehlerfrei, 524/524 Selbsttests, darunter drei neue Regeln,
  die das Stilblatt zerlegen und nachweislich anschlagen.
  Vorher hing der Kontostand an zwei Bereichen: Wer in Basis, Prestige oder Einstellungen stand,
  sah sein Gold nicht, obwohl dort gekauft wird. Gleichzeitig stand dieselbe Zahl doppelt im Bild
  — einmal im Goldschild, einmal auf der Meta-Karte. Eine Ressource, die je nach Bereich da oder
  weg ist, zwingt zum Hin- und Herschalten, nur um zu wissen, ob man sich etwas leisten kann.
  Offen bleibt die Stapelfolge: `.levelup-backdrop` trägt `z-index` 10 gegen `z-index` 6 der
  Zeile, beide sind Geschwister in `#overlay` — fünf Dialoge, darunter der Händler, legen sich
  mit Schleier und Weichzeichnung über den Goldstand.

- **Das Geschoss ist ein Kopf mit Schweif** (2026-08-07) — Der Schweif in
  `src/render/combat.ts` hat einen Körper bekommen: statt eines Dreiecks, dessen Halbbreite aus
  dem Kopfradius kam und hinten auf null zulief, steht dort ein Trapez mit fester
  Bildschirmbreite — 8 px am Kopf, 10 px am hinteren Ende, in jedem Zoom gleich; das Ausblenden
  macht allein der Verlauf. Nachgemessen an einem Standbild mit zwei fliegenden Geschossen: Kopf
  quer 12 und 11 px bei geforderten 6, mit dreilagigem Querschnitt (Ring L = 176, weißer Kern
  L = 255, Ring L = 176); Schweiflänge 96 und 100 px bei geforderten 60; der Violett-Überschuss
  fällt über die ersten 60 px streng von 108 auf 54; die Schweifspitze bleibt mit 73,7 unter dem
  Gegnerumriss im selben Bild (Median 137,7), Verhältnis 0,54; die Verlängerung jedes Keils
  trifft den Mittelpunkt des abfeuernden Moduls auf 0,00 Welteinheiten, weil über `origin` und
  nicht über `dir` gedreht wird. Typecheck fehlerfrei, 495/495 Selbsttests.
  Vorher zerfiel der Schuss in zwei Teile, die nicht zusammengehörten: Bei 20, 50 und 80 Prozent
  der Länge maß der Keil nur noch 3,75, 2,75 und 1,25 px, war also schon auf halber Strecke
  dünner als ein Strich und riss zwischen Kopf und Bahn eine Lücke. Ein Geschoss, dessen Spur
  hinter dem Kopf verschwindet, zeigt nicht, woher es kam.

- **Der erste Hinweis steht fest und der Zettel pendelt nicht mehr** (2026-08-07) —
  `pendingHint()` in `src/sim/hints.ts` prüft nicht mehr alle acht Einträge und nimmt den ersten
  passenden, sondern schaut auf genau einen: den nächsten ungesehenen. Der Zeiger wird aus
  `permanent.seenHints` abgeleitet und kann nicht zurückfallen. Die Bedingungen beschreiben
  jetzt Geschehenes statt Augenblicke — `goldEarned` statt Kontostand, `waveRecord` neben
  `bossId`, eingesammelte Münze zählt weiter —, und ein Zettel, dessen Augenblick nachweislich
  vorbei ist, wird abgelegt, statt die Reihe zu blockieren. Nachgemessen: 0 Verletzungen der
  Monotonie in 4000 zufälligen Ereignisfolgen zu je 60 Ereignissen bei Klickquoten 0, 50 und
  100 Prozent, einschließlich Abdocken, Lager leeren, Einschmelzen und Run-Reset; erster
  nicht-leerer Satz ist in allen Läufen `hint.collect`; 8 von 8 Hinweisen ohne Vorgriff im
  Wortschatz. Typecheck fehlerfrei, 488/488 Selbsttests statt 481, darunter die neue Sammlung
  `src/selftest/suites/hints.ts` mit 14 Zusicherungen.
  Vorher war die Liste ein Suchlauf: Der Rand zeigte den ersten Eintrag, dessen Bedingung gerade
  zutraf, also wechselte der Zettel mit jedem Zustand hin und her und kam nach dem Einsammeln
  zurück. Der allererste Satz des Spiels sprach von Modul und Kante, weil der Verstärker im
  Startlager liegt — erklärt wurde damit etwas, das der Spieler noch nie gesehen hatte.
  Offen bleibt die Gegenrichtung: `hint.buff` und `hint.melt` haben keine Frist und können die
  Reihe dauerhaft anhalten; in 1178 von 1334 Zufallsläufen erreichten nicht alle acht Hinweise
  den Spieler.

- **Die Karten haben Kartenmaß** (2026-08-07) — Sie waren als Kacheln geraten: 168×224, zu
  klein, um sich wie etwas anzufühlen, das man in die Hand nimmt. Jetzt sind es 229×320 —
  das Seitenverhältnis 5:7 einer echten Sammelkarte, in allen vier Fenstern dasselbe.
  Dahinter steht **eine** Zahl: `--card-h`. Die Breite ist ihr Verhältnis, die Schrift ein
  Bruchteil davon, und jede Zeile auf der Karte steht in `em` statt in Pixeln. Eine Karte,
  die kleiner wird, nimmt ihren Inhalt mit — sonst wäre sie beim Verkleinern nicht dieselbe
  Karte, sondern dieselbe Schrift in einem kleineren Rahmen, und der Text liefe über. Die
  Höhe führt, weil sie die knappe Richtung ist: Neben dem Fenster ist Platz, darunter sitzt
  die Leiste. `clamp(200px, 100vh - 340px, 320px)` ist genau das, was nach Leiste,
  Überschrift und Rand übrig bleibt. Damit fallen auch die vier verschiedenen Fensterbreiten
  weg — vier Breiten waren sinnvoll, solange jedes Fenster eigene Kacheln hatte.

- **Alle vier Auswahlfenster legen dieselben Karten aus** (2026-08-07) — Levelaufstieg,
  Turmauswahl, Ereignis und Händler-Drohne nutzen denselben Baustein (`src/ui/cards.ts`).
  Das Ereignis färbt seine Optionen nicht mehr alle violett, sondern nach ihrer **Folge**:
  Gold für eine Auszahlung, Türkis für einen Bonus, Magenta für ein Risiko, Violett für den
  Hinterhalt — bei mehreren Wirkungen zählt die schwerste, wer Gold bekommt und dabei einen
  Titanen ruft, wählt keinen Zahltag. Wo bei den anderen Karten der Rang steht, steht dort
  diese Art in Worten; eine Ereignisoption hat keine Seltenheit, und der Platz wäre sonst
  leer. Bei der Drohne steht der Preis vorn unter dem Rang statt hinten am Rand — drei
  Preise vergleicht man, ohne jede Karte einzeln umzudrehen. Was zu teuer ist, wird blass,
  dreht sich aber weiter um: Was man sich noch nicht leisten kann, will man erst recht
  genau ansehen. Dafür ist der gesperrte Posten kein `disabled` mehr, sondern eine Klasse —
  ein gesperrter Knopf bekommt keine Zeigerereignisse und läge tot unter der Hand.

- **Die Auswahlkarten sind Karten geworden** (2026-08-07) — Levelaufstieg und Turmauswahl
  legen keine beschrifteten Rahmen mehr aus, sondern Karten mit zwei Seiten (`src/ui/cards.ts`).
  Vorn steht, was es ist — Zeichen im Raritätsrahmen, Name, Rang, dahinter ein Puls aus
  Ringen in der Farbe der Seltenheit. Wer den Zeiger daraufstellt, dreht die Karte um und
  liest, was sie tut: beim Perk die Wirkung mit „jetzt" und „danach", beim Turm die
  Beschreibung mit den gewürfelten Eigenschaften. Dazu drei Kleinigkeiten, die zusammen den
  Unterschied machen: Die Karte neigt sich zum Zeiger, ein Lichtfleck folgt ihm über die
  Fläche, und die beiden anderen Karten treten zurück, solange eine betrachtet wird.
  Damit fällt das Hinweisfenster weg, das dieselbe Auskunft nach drei Sekunden Stehenbleiben
  daneben aufgehen ließ. Drei Sekunden sind lang genug, dass man sie nie abwartet — die
  Auskunft war da, aber sie fand niemand. Auf der Rückseite steht sie dort, wo der Blick
  ohnehin ist. Am Finger, wo kein Zeiger schweben kann, dreht das Zeichen in der Ecke.

- **Knöpfe antworten mit einer rollenden Beschriftung** (2026-08-03) — Unter dem Zeiger fährt
  die Beschriftung eines Knopfes eine Zeile nach oben aus dem Rahmen heraus, während dieselbe
  Beschriftung von unten nachrückt; der Rahmen schneidet ab, was dabei herausfährt. Auf dem
  Kaufknopf rollt nur die Beschriftung, der Preis bleibt stehen. Gesperrte Knöpfe rühren sich
  nicht. Die Zweitfassung steht in `data-slide` und wird vom Stilblatt geholt — im Baum steht
  der Text genau einmal.
  Vorher sagte ein berührter Knopf dasselbe wie ein gewählter: heller werden. Farbe ist in
  dieser Oberfläche aber schon vergeben — sie trennt „gewählt" von „gesperrt". Die Bewegung
  stellt sich nicht in diese Reihe und nimmt keiner Farbe ihre Bedeutung weg.

- **Der Angriffsradius steht um die Station, der Sammelradius verschwindet** (2026-08-03) —
  Um die Station liegt jetzt dauerhaft der Reichweitenkreis des Hauptturms: eine sehr blasse
  Fläche mit klarer Kante, die langsam atmet. Der Kreis am Zeiger, der den Sammelradius
  zeigte, ist ersatzlos weg, und der Sammelradius selbst ist von 90 auf 34 Einheiten
  geschrumpft — genau die Größe eines Stapels.
  Vorher hießen zwei Anzeigen „Reichweite" und meinten Verschiedenes: Die eine sagte etwas
  über die Maus, die andere über das Spiel. Jetzt gibt es nur noch die zweite, und
  Einsammeln ist wieder eine Bewegung, die man ausführen muss, statt eines Radius, der
  ohnehin schon über allem lag.

- **Das Bild ist herausgezoomt** (2026-08-03) — In den Bildausschnitt geht jetzt ein
  gedeckelter Bruchteil der Hauptturm-Reichweite ein (0,9, höchstens 260 Einheiten), der
  feste Rand fiel von 90 auf 70, die Zoom-Obergrenze von 2,2 auf 1,35.
  Nachgemessen auf 420 × 660: Zoom 0,66 statt 1,44, ein Modul 37 px statt 80. Der
  Angriffskreis passt damit ins Bild, und Gegner sind zu sehen, bevor sie an der Station
  stehen — vorher füllte die Startstation aus einem einzigen Sechseck das halbe Bild.

- **Die untere Leiste gibt das Spielfeld frei** (2026-08-03) — Die beiden Statuskarten sind
  aus der Leiste verschwunden; ihre Zahlen stehen jetzt als schmale Schilder über dem Feld
  (Gold oben links, Welle oben rechts, Stations-HP als Leiste direkt über der Bedienung).
  Das Upgrade-Panel hat eine feste Höhe statt 32 vh.
  Nachgemessen auf 960 × 640 nimmt die Leiste 22,7 Prozent der Bildhöhe ein statt 44 — das
  Spielfeld hat sich von gut der Hälfte auf gut drei Viertel vergrößert. Die
  Navischaltflächen sind dabei nicht kleiner geworden, sondern größer (62 statt 56 px):
  Zwischen Basis und Kampf wird ständig gewechselt.

- **Münzen sind Münzen** (2026-08-03) — Liegendes Gold wird als Bild aus dem Münzsatz
  gezeichnet, in drei Wertstufen (bronze, silber, gold) und mit einem Glanzlauf, dessen
  Versatz aus dem Ort der Münze kommt. Die aufgedruckte Zahl ist weg.
  Der Wert steht damit in Größe **und** Metall, beide nach demselben Maß — dem Vielfachen
  des Durchschnitts. Eine Zahl auf einer 14 Pixel großen Scheibe war ohnehin nur bei wenigen
  lesbar und machte aus liegendem Gold eine Tabelle.

- **Treffer und Tod tragen Bilder** (2026-08-03) — Der Einschlag am Gegner ist ein blauer
  Aufschlag, ein kritischer Treffer ein goldener Funkenwurf, der Zerfall eine violette
  Explosion — alle drei aus dem Effektsatz, alle drei an bestehende Ereignisse gehängt.
  Der Treffer auf die eigene Station behält bewusst den gezeichneten Magenta-Ring: Blau und
  Gold ließen einen Schlag gegen das eigene Haus wie einen Erfolg aussehen. Fehlt ein Bild
  noch, bleibt überall die gezeichnete Fassung stehen — ein fehlender Anlagenteil darf nie
  ein leeres Feld ergeben.

- **Bereichswechsel sind Bewegungen** (2026-08-03) — Das Alte tritt erst ab (150 ms, in
  seine eigene Richtung, mit Weichzeichnung), dann wechselt der Bereich, dann fahren die
  neuen Panels gestaffelt auf (~40 ms je Nachbar). Gleichzeitig tritt das Spielfeld über die
  Kamera einen Wimpernschlag zurück und kommt von selbst wieder.
  Der Wechsel wirkt dadurch wie eine Maschine, die umschaltet, statt wie zwei Bilder
  hintereinander — auch die Ebene, die eigentlich stehen bliebe, bewegt sich mit. Ein
  zweiter Tipp während des Wechsels startet keinen zweiten, schreibt aber das Ziel um.

- **Neon statt blau** (2026-08-03) — Der Grund ist tiefer geworden und trägt jetzt einen
  Schein um die Mitte und eine Abdunklung zu den Ecken; jede Kante in der Oberfläche hat
  einen äußeren und einen inneren Schein, festgelegt in drei Stufen an einer Stelle
  (`--glow-*`). Rahmen, Leisten und Symbole kommen aus dem Anlagensatz (`docs/anlagen.md`).
  Erst der **innere** Schein macht aus einem Rahmen eine Leuchtröhre — ohne ihn ist Neon nur
  ein blauer Strich.

- **Die Größe einer Münze bleibt beim Einsammeln stehen** (2026-08-03) — Der Radius folgt
  jetzt dem Vielfachen des Durchschnitts statt dem Anteil an der Summe; nachgemessen bleibt
  die erste von zehn gleichen Münzen bei Radius 6,2, ganz gleich ob noch zehn oder nur noch
  eine liegt — vorher wuchs sie auf 11.
  Das Feld wird beim Abräumen ruhig, statt dass die Reste unter dem Zeiger nachquellen; die
  Verhältnisse bleiben trotzdem lesbar (30 Krümel gegen einen Riesen: 5,1 gegen 11).

- **Der Sichtbarkeitsrand der Münzen ist abgeleitet statt geraten** (2026-08-03) —
  **Ohne sichtbare Wirkung; die Annahme im Punkt war falsch.** Nachgemessen deckte der alte
  feste Rand von 30 Pixeln den breitesten Fall bereits ab: Die längste Zahl misst bei Zoom
  1,7 rund 61 Pixel, ragt also 30 zur Seite. Ein Aufblitzen an der Kante gab es nicht.
  Der Rand richtet sich jetzt trotzdem nach dem, was eine Münze tatsächlich einnimmt —
  Radius, und bei Beschriftung deren halbe Breite. Das bleibt richtig, wenn sich Schrift,
  Größenformel oder Zahlenformat ändern; heute ändert es am Bild nichts.

- **Im Upgrades-Bereich läuft der Kampf mit** (2026-08-03) — Gegner, Geschosse, Mündungsfeuer
  und alle Kampfeffekte werden jetzt überall gezeichnet, wo das Feld zu sehen ist; nur die
  Basis bleibt ruhig, weil dort die Bauhilfen liegen. Der Sammelradius bleibt der
  Kampfansicht vorbehalten, weil nur dort die Mausbewegung wirklich einsammelt.
  Ein gekauftes Upgrade zeigt seine Wirkung damit sofort im selben Bild — vorher kaufte man
  Verbesserungen vor einer eingefrorenen Station, während die Welle weiterlief.

- **Die Größe einer Münze sagt auf jeder Stufe dasselbe** (2026-08-03) — Der Radius folgt
  jetzt dem Anteil am liegenden Gold statt dem absoluten Wert; nachgemessen sehen fünf
  gleiche Münzen zu je 5 und fünf zu je 900 identisch aus, und ein Riese zwischen dreißig
  Krumen misst 10,1 gegen 4,6 — früher lag ab siebenhundert Gold alles flach auf dem Deckel.
  Man erkennt damit im späten Run wieder, wo die Masse liegt, statt auf ein Feld gleich
  großer Punkte zu schauen.

- **Pixelschrift sitzt auf ganzen Pixeln** (2026-08-03) — Münzbeschriftungen und aufsteigende
  Beträge werden über die linke Kante auf ganze Pixel gesetzt, nicht über den Mittelpunkt;
  nachgemessen landen Münzen an krummen Weltpositionen jetzt auf 450/321 statt irgendwo
  dazwischen.
  Die Zahlen sind dadurch scharf statt verwaschen — bei einer Pixelschrift ist das der
  Unterschied zwischen gewollt und kaputt.

- **Liegendes Gold ist überall sichtbar** (2026-08-03) — Münzen werden jetzt in jedem Bereich
  gezeichnet, außerhalb des Kampfes auf 45 Prozent gedämpft; nachgemessen 1,00 und 0,73 im
  Kampf gegen 0,45 und 0,33 in Basis und Upgrades.
  Beim Bauen sieht man, wo noch etwas liegt, ohne dass das Gold mit den Bauhilfen um
  Aufmerksamkeit streitet — dort ist es Auskunft, im Kampf Aufforderung.

- **Münzen zeigen ihren Wert, nicht ihre Anzahl** (2026-08-03) — Größe und Beschriftung
  folgen jetzt beide dem Wert; beschriftet wird, was mindestens ein Zwölftel des liegenden
  Goldes ausmacht, also immer nur das, was sich zu holen lohnt.
  Ein dicker Stapel zwischen lauter Krumen fällt sofort ins Auge — vorher trug ein Häufchen
  aus zwei Pfennigen eine Zahl und eine Münze über fünftausend keine.
  Der Punkt „Größe folgt der Anzahl" ist damit **mit erledigt**: Beide Symptome kamen
  daher, dass die Anzahl entschied, wo der Wert hingehört.

- **Jede Münze glimmt für sich** (2026-08-03) — Der Helligkeitsversatz kommt aus dem Ort der
  Münze, nicht aus einer gemeinsamen Uhr; nachgemessen streuen fünf Münzen im selben Bild
  über 0,44 der Deckkraft, während jede einzelne weiteratmet.
  Ein Feld voller Gold lebt dadurch, statt im Takt zu blinken — vorher zuckte das ganze
  Feld wie eine einzige Lampe.

- **Münzen liegen unter der Station** (2026-08-03) — Liegendes Gold wird jetzt vor den
  Modulen gezeichnet und deckt sie damit nicht mehr zu; fliegende Münzen bleiben oben, weil
  sie Bewegung sind und keine Kulisse.
  Die Station bleibt sichtbar, auch wenn direkt an ihrer Kante ein Dutzend Gegner gefallen
  ist — vorher legte sich genau dort ein Goldteppich über das, was man sehen soll.

- **Die aufsteigende Zahl beim Einsammeln** (2026-08-03) — Was eingesammelt wird, steigt als
  Betrag am Zeiger auf und verblasst; kommt kurz darauf mehr dazu, wächst dieselbe Zahl
  weiter, statt dass eine zweite daneben steht.
  Damit ist die Belohnungskette geschlossen: Münze fliegt, Zahl steigt, Anzeige pulst und
  zählt hoch — man sieht in einem Zug, *wie viel* der Griff gebracht hat.

- **Zahlen sprechen eine Schrift** (2026-08-03) — Münzstapel auf dem Feld stehen jetzt in
  derselben Pixelschrift wie jede Zahl im HUD; nachgemessen ist die Ziffernhöhe bei 16 px
  identisch zur vorherigen Schrift bei 9 px, es ändert sich also nur das Schriftbild.
  Feld und Leiste wirken dadurch wie ein Gerät statt wie zwei Programme — dieselbe Art
  Zahl sieht überall gleich aus.

- **In der Basis ist der Kampf sichtbar** (2026-08-03) — Die Wellenkarte oben rechts trägt
  jetzt auch die Stations-HP, samt Farbwechsel unter 30 Prozent und demselben Zucken bei
  jedem Treffer wie die Leiste im Kampf.
  Bauen und Kämpfen laufen gleichzeitig (GDD 02) — man sieht beim Umbauen, wie es der
  Station geht, statt es erst beim Zurückwechseln zu erfahren.

- **Der Sammelradius reagiert** (2026-08-03) — Liegt Gold in Reichweite, wird der Kreis
  heller und kräftiger, bekommt ein Leuchten und seine Striche wandern um ihn herum;
  ist nichts zu holen, bleibt er ein blasser Hinweis auf die eigene Reichweite.
  Man sieht jetzt, *wann* sich das Hinfahren lohnt — vorher sah ein Kreis über vollem Feld
  genauso aus wie einer über leerem.

- **Marken am Bildrand für anfliegende Gegner** (2026-08-03) — Wer noch außerhalb läuft,
  wirft ein kleines Winkelzeichen an den Bildrand, in seiner eigenen Farbe und umso
  deutlicher, je näher er kommt; drinnen verschwindet es wieder.
  Gegner tauchen nicht mehr unvermittelt am Rand auf — man sieht gut drei Sekunden vorher,
  aus welcher Richtung und in welcher Farbe etwas anrollt, und kann den Zeiger dorthin
  führen, statt überrascht zu werden.

- **Die Boss-Leiste nennt ihren Boss** (2026-08-03) — Sie trägt jetzt eine Marke „BOSS", den
  Namen des Gegners und färbt Rahmen, Balken und Schrift in seiner eigenen Farbe statt in
  einem festen Magenta.
  Der Boss auf dem Feld und seine Leiste im HUD gehören sichtbar zusammen — und sobald es in
  E15 mehrere gibt, sagt die Leiste nicht nur *dass*, sondern *welcher*.

- **Der verlorene Anlauf ist sichtbar** (2026-08-03) — Fällt die Station, zittert der Kern
  dreimal so lange nach wie bei einem einzelnen Treffer, und über dem Feld steht kurz in
  Magenta, welche Welle verloren ging und der wievielte Anlauf jetzt beginnt.
  Der Neuversuch hat damit eine Zäsur statt einfach weiterzulaufen — vorher war das Feld
  plötzlich leer, die Leiste wieder voll, und nichts sagte, dass gerade etwas schiefging.

- **Der Lebensbalken der Gegner spricht die neue Sprache** (2026-08-03) — Statt eines flachen
  Rechtecks liegt jetzt ein leuchtender Faden in einem dunklen Bett, beide mit runden Enden,
  und die Füllung trägt die Farbe des Gegners statt einer eigenen.
  Der Balken gehört damit sichtbar zum Gegner und nicht zur Oberfläche — er fällt nicht mehr
  als Fremdkörper zwischen Modulen und Splittern auf, die längst runden und leuchten.

- **Der Boss zählt im Wellenfortschritt mit** (2026-08-03) — Der Nenner der
  Fortschrittsleiste enthält jetzt den Boss, sofern einer erschienen ist; auf Welle 10 steht
  „22 / 23 down", solange er lebt, und erst sein Tod macht daraus „23 / 23".
  Die Leiste lügt damit nicht mehr im entscheidenden Moment — vorher meldete sie
  Vollständigkeit, während der größte Gegner der Welle noch quer über dem Feld stand.

- **Wellenpause zeigt, wie lange sie dauert** (2026-08-03) — Dieselbe Leiste, die während
  der Welle den Fortschritt füllt, läuft in der Pause leer und wechselt dabei von Cyan auf
  Grün; ohne Auto-Modus steht sie leer und sagt, dass es auf den Spieler ankommt.
  Die Pause fühlt sich dadurch wie eine Frist an statt wie ein Hänger — man weiß ohne
  Textlesen, ob gerade gekämpft oder gewartet wird.

- **Angedockte Gegner beißen sichtbar** (2026-08-03) — Wer an der Station hängt, stößt bei
  jedem Schlag auf das Modul zu, an dem er hängt, und kommt auf einem Sinusbogen zurück;
  bei hohem Tempo wird daraus ein durchgehendes Kauen statt vieler Sprünge.
  Man sieht jetzt auf einen Blick, *wer* gerade an der Station frisst — vorher zuckte nur
  die Lebensleiste, und die Angreifer standen ununterscheidbar herum.

- **Geschosse ziehen eine Spur** (2026-08-03) — Jedes Geschoss zieht jetzt die Strecke der
  letzten 50 Millisekunden als Schweif hinter sich her, der aus dem Rohr herauswächst statt
  im ersten Bild hinter dem Turm zu beginnen; ein schnelles Geschoss zieht dadurch einen
  längeren Schweif als ein langsames.
  Schüsse haben zum ersten Mal eine sichtbare Bahn statt zwischen zwei Bildern zu springen,
  und die Lücke zwischen Mündungsfeuer und Einschlag ist geschlossen.

- **Buff-Linien mit fließender Energie** (2026-08-03) — Auf einer gedämpften Grundlinie
  laufen jetzt helle Striche vom Verstärker zum Ziel, jede Verbindung mit eigenem Versatz,
  damit nichts im Gleichschritt marschiert.
  Die Nachbarschaftsregel ist damit gerichtet ablesbar: Man sieht nicht nur, *dass* zwei
  Module verbunden sind, sondern *wer wem* hilft — ohne einen Satz Text.

- **Was bleibt, wandert** (2026-08-03) — Der Bereichswechsel schaltet jetzt in einem einzigen
  Bild um; bewegt wird danach nur noch die Optik. Panels, die es in beiden Bereichen gibt,
  fahren von ihrem alten an ihren neuen Platz (FLIP, `src/ui/flip.ts`, ~130 Zeilen ohne
  Abhängigkeit), und nur was wirklich verschwindet, tritt ab — dafür an seinen letzten Ort
  genagelt, damit es beim Gehen nichts mehr verschiebt.
  Zwischen Kampf und Upgrades verschwindet kein einziges Panel; vorher ließ das Spiel trotzdem
  alle fünf abtreten und wieder auffahren und behauptete damit einen Wechsel, den es nicht
  gab. Nachgemessen wandern dort Rumpfleiste, Temporegler, Navileiste und Upgrade-Panel je
  195 Pixel nach oben, statt zu blinken. Nebenbei fiel die Wartezeit von 160 ms zwischen Klick
  und Wechsel weg, und mit ihr die Buchhaltung für den zweiten Klick.

- **Der Ausgang schreibt sich selbst** (2026-08-03) — Eine geschaffte Welle setzt VICTORY in
  grünem Neon in die Mitte des Feldes, eine verlorene DEFEAT in Magenta samt Ruck; der
  Schriftzug tippt sich Buchstabe für Buchstabe mit ungleichmäßigem Anschlag und blinkendem
  Cursor, steht anderthalb Sekunden und geht von selbst wieder.
  Eine Welle endete bisher in einem einzigen Bild — der Zähler sprang, das Feld war leer.
  Der laufende Anschlag gibt dem Ausgang eine *Dauer* und zieht das Auge in die Mitte,
  während die Wellenmeldung oben weiter die Einzelheit trägt.

- **Wellenübergang** (2026-08-03) — Jede neue Welle wird einmal groß über dem Feld benannt
  und verschwindet von selbst wieder, in Bosswellen in Magenta; die Boss-Leiste fährt mit
  Anlauf auf, und ein gefallener Boss hallt in drei Ringen nach, die verschieden schnell
  aufgehen.
  Wellen fühlen sich zum ersten Mal wie Abschnitte an statt wie ein durchlaufender Strom,
  und der Bosstod ist eine Zäsur statt eines Gegners weniger.

- **Station lebt** (2026-08-03) — Der Kern atmet jetzt langsamer und tiefer, sein Leuchten
  schlägt bei einem Treffer auf das Doppelte des Atemgipfels auf und beruhigt sich
  quadratisch; die Lebensleiste zuckt im selben Augenblick um zwei Pixel mit.
  Die Station wirkt dadurch wie ein laufender Apparat statt wie ein Standbild, und ein
  Treffer ist zu sehen, ohne dass man auf die Zahlen schaut.

- **Gold springt und fliegt** (2026-08-03) — Beim Tod springen Goldfunken aus dem Gegner
  heraus und rollen langsamer aus als seine Trümmer; beim Einsammeln fliegt jede Münze
  sichtbar zum Zeiger und die Goldanzeige quittiert mit einem kurzen Puls.
  Einsammeln fühlt sich zum ersten Mal wie Aufheben an statt wie ein Verschwinden, und man
  sieht am Flug, *wie viel* Gold gerade den Weg in die Anzeige gefunden hat.

- **Gegner zerfallen** (2026-08-03) — Ein sterbender Gegner wirft sechs Splitter in seiner
  eigenen Farbe aus und schlägt eine kurze Druckwelle, statt einfach zu verschwinden;
  Splitter und Wellen liegen hinter den lebenden Gegnern, damit der Zerfall zurücktritt.
  Eine geräumte Welle sieht dadurch nach Arbeit aus statt nach Verschwinden, und man
  erkennt an der Farbe der Splitter, *was* man gerade zerlegt hat.

- **Trefferfeedback am Ziel** (2026-08-03) — Jedes Modul schlägt beim Schuss kurz zurück und
  wirft ein Mündungsfeuer in Schussrichtung aus seiner Kante; der Einschlag am Gegner hat
  jetzt einen hellen Kern, und ein kritischer Treffer blitzt deutlich weiter auf.
  Man sieht damit zum ersten Mal, *welcher* Turm gerade feuert und *wohin* — vorher tauchten
  Geschosse einfach in der Mitte auf, und ein Krit war nur an der Lebensleiste zu erkennen.

- **Tiefe in den Menüs** (2026-08-03) — Panels und Karten liegen jetzt auf zwei
  Schattenebenen, Karten heben sich unter dem Zeiger an und drücken sich beim Klick
  wieder herunter, ein gekauftes Upgrade quittiert mit einem grünen Aufleuchten, und Gold
  und Schaden laufen auf ihren neuen Stand zu statt zu springen.
  Ein Kauf fühlt sich dadurch wie eine Handlung an und nicht wie ein Zahlenwechsel — man
  sieht am Hochlaufen, *wie viel* dazugekommen ist, nicht nur *dass* sich etwas geändert hat.

- **Weiche Bereichswechsel** (2026-08-03) — Panels fahren beim Sichtbarwerden aus der
  Richtung auf, in der sie sitzen: das Lager von links, die rechte Spalte von rechts, die
  untere Leiste von unten; der gewählte Reiter quittiert mit einem kurzen Stupser.
  Der Wechsel zwischen Kampf und Basis wirkt dadurch wie ein Umschalten derselben Maschine
  statt wie ein Bildwechsel, und das Auge findet nach dem Klick sofort wieder, wo es war.
