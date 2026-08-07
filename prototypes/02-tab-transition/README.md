# Prototyp 02 — Bereichswechsel mit `createLayout`

## Leitfrage

Kann ein Panel, das es in zwei Bereichen gibt, beim Wechsel an seinen neuen Platz
**fahren**, statt abzutreten und neu aufzufahren?

Das Spiel macht heute das Zweite (`src/ui/shell.ts`, `goTo`): `data-leaving` lässt alles
Sichtbare abtreten, nach 160 ms wechselt der Bereich, dann fährt alles Neue gestaffelt auf.
Das sieht gut aus, hat aber eine Lücke — ein Panel, das **bleibt**, weiß davon nichts. Die
Goldanzeige verschwindet oben links und erscheint oben rechts wieder; dass es dieselbe
Anzeige ist, muss der Spieler sich denken.

`createLayout` aus anime.js 4.5 ist ein FLIP-Verfahren: messen, wechseln lassen, wieder
messen, die Differenz animieren.

## Nicht Teil des Prototyps

- **Kein Spielinhalt.** Die Panels sind leere Kästen mit dem richtigen Namen an der richtigen
  Stelle. Es geht um Wege und Größen, nicht um Inhalte.
- **Kein Canvas.** Das Spielfeld ist hier ein Panel wie jedes andere. Die Kamerabewegung
  (`nudgeCamera`) fehlt bewusst — sie ist im Spiel schon gelöst und würde die Frage
  verwässern.
- **Keine Entscheidung über anime.js als Abhängigkeit.** Der Prototyp beantwortet, ob das
  Verfahren trägt. Ob dafür eine Bibliothek ins Spiel kommt, ist eine zweite Frage
  (siehe unten).

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Klick auf die Navileiste | Bereich wechseln |
| `←` / `→` | einen Bereich zurück / weiter — zeigt beide Staffelrichtungen |
| `1` … `5` | direkt zu einem Bereich springen |
| Kopfleiste: **anime.js Layout** / **Jetziges Verfahren** | zwischen beiden Verfahren umschalten |
| Kopfleiste: **Zeitlupe** | alle Dauern ×4 — nur so ist die Staffelung einzeln zu sehen |
| Anzeige rechts oben | `bleibt · neu · weg` und die gemessene Gesamtdauer |

Start: `npm run dev` in `prototypes/`, dann `http://localhost:5174/02-tab-transition/`.

## Ergebnis

**Das Verfahren trägt.** Nachgemessen, indem die Zeitleiste angehalten und das Rechteck des
Panels an mehreren Stellen abgelesen wurde (`window.proto.sample(selector, anteil)`):

| Wechsel | bleibt | neu | weg |
|---|---|---|---|
| Kampf → Basis | 3 | 2 | 2 |
| Basis → Prestige | 1 | 1 | 4 |
| Prestige → Einstellungen | 1 | 1 | 1 |
| Einstellungen → Kampf | 1 | 4 | 1 |
| Kampf → Upgrades | 5 | 0 | 0 |

Zwei Wege im Einzelnen:

- **Goldschild, Kampf → Basis:** `x` läuft von 10 auf 855, die Breite von 309 auf 415. Ein
  echter Weg quer über das Bild, nicht zwei Auftritte an zwei Orten.
- **Upgrade-Panel, Kampf → Upgrades:** aus dem Streifen (`y 613, Höhe 43`) wird das halbe
  Bild (`y 409, Höhe 247`). Derselbe Knoten, kein Neuaufbau.
- **Kampf → Upgrades ist der stärkste Fall:** `neu 0 · weg 0`. Das jetzige Verfahren lässt
  hier **fünf** Panels abtreten und wieder auffahren, obwohl kein einziges verschwindet.

Was dabei aufgefallen ist:

- Die Wurzel muss das Feld sein, nicht `#app`. Mit `#app` als Wurzel vermisst sich die
  Navileiste mit und wandert bei jedem Wechsel mit.
- `layout.animating` zählt **jeden** Knoten unter der Wurzel, auch jedes Kästchen in einem
  Panel, und enthält zusätzlich die Panels, die in beiden Bereichen unsichtbar sind. Für eine
  brauchbare Zahl muss doppelt gefiltert werden (`.panel` **und** sichtbar).
- `stagger(…, { from: 'first' | 'last' })` je nach Richtung durch die Navileiste ist genau
  der Griff aus der Vorlage. Der Unterschied ist deutlich: Nach rechts läuft die Staffel von
  links los, nach links von rechts — der Wechsel bekommt eine Richtung.
- Ein `filter: blur(…)` in `enterFrom` wurde **nicht** versucht; `opacity`, `scale` und `y`
  reichen und sind sicher animierbar.

**Offen — nur am laufenden Bild zu beantworten:** Ob das Wandern eines Panels quer über das
Bild angenehmer ist als das jetzige Abtreten, oder ob es unruhig wirkt. Der Prototyp wurde in
einer Umgebung ohne Bildaufbau geprüft (kein `requestAnimationFrame`), die Wege sind also
**gemessen, nicht gesehen**. Diese Frage ist der eigentliche Grund für den Prototyp und muss
von Hand entschieden werden.

## Übernahme ins Spiel

**Übernommen — ohne die Bibliothek** (`src/ui/flip.ts`, 2026-08-03).

Das Verfahren ist ins Spiel gewandert, anime.js nicht. Gebraucht wurden davon rund 130 Zeilen:
messen, `data-view` umschreiben, wieder messen, die Differenz per WAAPI als `translate`
weganimieren. Das Spiel hat weiterhin **null** Laufzeit-Abhängigkeiten, und das ist eine
bewusste Entscheidung.

Was der Prototyp beigetragen hat und was im Spiel anders wurde:

| Prototyp | Spiel | Warum |
|---|---|---|
| `stagger` je nach Richtung | keine Staffelung | Im Spiel wandern nur drei bis vier Panels, und sie hängen räumlich zusammen. Eine Staffelung machte daraus eine Reihenfolge, die es nicht gibt. |
| Größe wird mitanimiert | Größe springt, nur der Ort wandert | Genau ein Panel ändert seine Größe (die Upgrade-Kacheln), und dessen Inhalt fährt ohnehin gestaffelt neu auf. Es wandert jetzt nur mit seiner Oberkante nach oben in die schon fertige Leiste — wie eine Schublade. |
| `ease: outExpo`, 520 ms | `--ease-out` aus dem Stilblatt, 420 ms | Die Kurve liegt im Spiel schon an einer Stelle. Sie dort zu holen statt sie zu wiederholen, war die einzige Änderung, die der Prototyp nicht vorweggenommen hat. |
| Ein- und Austritte vom Motor | Ein- und Austritte aus dem Stilblatt | Die Richtung eines Auf- oder Abtritts ist Gestaltung. Das Spiel hatte sie schon, und sie ist besser als eine allgemeine. |

Zwei Dinge kamen erst beim Einbau heraus:

- **Nicht jeder gemessene Unterschied ist ein Weg.** Die mittig gesetzte Bereichsüberschrift
  rückt schon dann zur Seite, wenn das nächste Wort länger ist. Sie hat ihren Platz nicht
  gewechselt, nur ihre Breite — sie bestellt die Wanderung deshalb im Stilblatt ab
  (`--flip: 0`) und bekommt stattdessen ihren eigenen Auftritt, wenn ihr Text wechselt.
- **WAAPI weiß nichts von `prefers-reduced-motion`.** Die Antwort auf „läuft Bewegung?" steht
  jetzt als `--motion` an einer Stelle im Stilblatt, und beide Ebenen lesen sie. Vorher hätte
  es zwei gegeben, und eine davon wäre irgendwann vergessen worden.

Der Prototyp bleibt als Vergleichsstück liegen: Der Schalter in seiner Kopfleiste zeigt
weiterhin beide Verfahren nebeneinander.
