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
