# 02 — Kern-Spielschleife und Spielerfahrung

> **Neufassung vom 07.08.2026.** Das ursprüngliche Kapitel 02 ist beim PC-Reset am
> 05.08.2026 verloren gegangen und war in keinem Sitzungsverlauf erhalten — anders als die
> übrigen vierzehn Kapitel ließ es sich nicht wiederherstellen.
>
> Dies ist deshalb **kein wiederhergestellter Text, sondern ein neu geschriebener.**
> Er erfindet nichts hinzu: Jede Festlegung darin ist entweder im Inhaltsverzeichnis
> (`README.md`), in einem anderen Kapitel oder im umgesetzten Code belegt. Die Belegstellen
> stehen jeweils dabei. Wo das Original mehr gesagt haben mag, sagt dieser Text weniger —
> das ist gewollt.

---

## 1. Was der Spieler eigentlich tut

WAVEBREAKER ist ein Verteidigungsspiel, in dem **nicht der Spieler schießt**. Er baut eine
Station, und die Station kämpft. Seine Arbeit ist die Vorbereitung: Welchen Turm kaufe ich,
wohin docke ich ihn, welchen Wert hebe ich als nächstes an.

Daraus folgt die wichtigste Eigenschaft der Schleife: **Sie läuft weiter, während man
nachdenkt.** Es gibt keinen Zug, keine Pause, keinen Moment, in dem das Spiel auf eine
Eingabe wartet. Wer nichts tut, kommt langsamer voran — aber er kommt voran.

## 2. Die Hauptschleife

```
   Welle läuft        →   Gegner sterben      →   Gold fällt
        ↑                                              ↓
   nächste Welle      ←   Umbau / Upgrade     ←   Gold einsammeln
```

Vier Schritte, die ineinandergreifen:

| Schritt | Wer handelt | Was der Spieler entscheidet |
|---|---|---|
| Gegner laufen an und docken an die Station | Spiel | nichts |
| Türme schießen | Spiel | nichts — die Vorbereitung wirkt jetzt |
| Gold fällt und bleibt liegen | Spiel | wann er es einsammelt |
| Gold wird ausgegeben | Spieler | **neuer Turm oder stärkere vorhandene?** |

Der letzte Schritt ist die eigentliche Entscheidung des Spiels. Sie wiederholt sich in jeder
Welle und wird mit steigenden Turmkosten (Faktor 1,5 je Kauf, → [06](06-turmerwerb-inventar-raritaeten.md))
von Mal zu Mal schwerer.

## 3. Die zwei Spielzustände

Es gibt **Kampf** und **Basis** — und beide laufen gleichzeitig.

| | Kampf | Basis |
|---|---|---|
| Was man sieht | die Station im Feld, Gegner, Schüsse | Lager, Bauplatz, Handel |
| Was man tut | zusehen, Gold einsammeln, Upgrades kaufen | Türme kaufen, andocken, umbauen, schmelzen |
| Was das Spiel tut | alles | **alles — der Kampf läuft weiter** |

Der zweite Punkt ist eine bewusste Entscheidung und keine Nachlässigkeit: Wer in der Basis
umbaut, **sieht am Rand, wie es der Station währenddessen ergeht**. Die Lebensleiste steht
deshalb auch in der Basisansicht (`ui/hud.ts`). Ein Umbau ist damit selbst eine Handlung mit
Risiko — man nimmt sich die Zeit, die man sich leisten kann.

> Belegt in: `app/state.ts` („Der Kampf läuft von selbst weiter — er ist der Ausgangspunkt"),
> `ui/hud.ts` („Der Kampf läuft in der Basis weiter"), `docs/politur.md` („Bauen und Kämpfen
> laufen gleichzeitig").

Ein Bereichswechsel ist deshalb **keine Unterbrechung, sondern ein Schwenk**. Wie er
aussieht, steht in [13, Abschnitt 4](13-ui-und-visuelles-design.md).

## 4. Ein typischer Run

| Phase | Wellen | Was passiert |
|---|---|---|
| Anlauf | 1 – 5 | Der Kern allein hält. Gold reicht für die ersten Upgrades. |
| Aufbau | 5 – 20 | Erste Türme, erste Buff-Nachbarschaften. Die Bauform beginnt zu zählen. |
| Tragfähigkeit | 20 – 50 | Der Bau steht. Es geht um Werte, Eigenschaften und Seltenheiten. |
| Grenze | 50+ | Die Gegnerkurve zieht an. Irgendwo hier endet der Run. |

Ein Run endet **nicht am Bildschirmtod**, sondern an der Einsicht, dass die nächste Welle
nicht mehr fällt. Dann setzt der Spieler zurück (→ [10](10-prestige-system.md)) und beginnt
mit dauerhaften Verbesserungen von vorn. Das erste Mal geschieht das nach **30 bis 60
Minuten** ([15, Abschnitt 3](15-balancing-und-skalierung.md)).

## 5. Niederlage

**Fällt die Stations-HP auf 0, ist die Welle verloren — und sonst nichts.**

| Was verloren geht | Was bleibt |
|---|---|
| die laufende Welle | alle Türme im Bau und im Lager |
| die Zeit dafür | Gold, Level, Upgrades, Fähigkeiten |
| | der erreichte Wellenstand |

Die Welle beginnt danach von vorn, mit voller Stations-HP — geheilt wird ohnehin zu Beginn
**jeder** Welle ([07, Abschnitt 12](07-gegner-bosse-und-wellen.md)).

Das ist die weichste Niederlage, die ein Verteidigungsspiel haben kann, und sie ist so
gewollt. Die Begründung steht im Code selbst:

> „Ein Verlust kostet nichts außer Zeit — und ein Trauermarsch wäre für einen Neuversuch zu
> viel." (`sim/combat.ts`)

Deshalb gibt es kein Niederlagenfenster, das den Spieler aufhält, keine Wertung und keine
Zusammenfassung. Die Welle startet neu, und man ist wieder drin. Umgesetzt in
`sim/waves.ts::restartWave` — „ohne Verlust von Türmen, Gold oder Fortschritt".

Wer will, überspringt zurück auf eine leichtere Welle und sammelt dort in Ruhe
([07, Abschnitt 9](07-gegner-bosse-und-wellen.md)). Die Belohnung richtet sich dabei nach der
**gespielten** Welle, nicht nach dem Rekord — Zurückgehen ist eine Möglichkeit, aber keine
Abkürzung.

## 6. Aktiv und passiv

Das Verhältnis ist festgelegt: **80 % läuft von selbst, 20 % sind Entscheidungen**
([09](09-level-system-und-faehigkeiten.md)).

Was in die 20 % fällt:

- Gold einsammeln — es bleibt liegen, aber es kommt nicht von allein
- kaufen, andocken, umbauen, schmelzen
- Level-Perks wählen
- Fähigkeiten zünden (nur Abklingzeit, kein Verbrauch)
- Ereignisse entscheiden
- prestigen

Alles andere — Zielwahl, Schüsse, Wellenwechsel im Auto-Modus, Offline-Fortschritt — läuft
ohne Zutun. Das Spiel ist damit **nebenbei spielbar, aber nicht ohne den Spieler besser**.

## 7. Langzeitmotivation

Drei Schleifen liegen übereinander, jede länger als die vorige:

| Schleife | Dauer | Antrieb |
|---|---|---|
| Welle | Sekunden bis Minuten | „Hält der Bau?" |
| Run | 30 – 60 Minuten | „Wie weit komme ich diesmal?" |
| Prestige | Stunden bis Tage | „Was schalte ich als nächstes frei?" |

Die kurze Schleife trägt die Aufmerksamkeit, die mittlere die Sitzung, die lange die
Rückkehr. Fällt eine aus, trägt das Spiel nicht mehr: Ohne Wellenspannung wird es zum
Zahlenschieben, ohne Runstruktur zum endlosen Grind, ohne Prestige zur einmaligen
Erfahrung.

Der Offline-Fortschritt ([12](12-offline-fortschritt-und-helfer.md)) bedient ausdrücklich die
lange Schleife: Er sorgt dafür, dass Zurückkommen sich lohnt, ohne dass Dableiben sich
weniger lohnt.

## 8. Woran diese Schleife scheitern würde

Zum Schluss, was sie nicht verträgt — als Prüfliste für spätere Änderungen:

- **Wartezeiten ohne Bild.** Wenn nichts passiert, während man nichts tut, ist die Schleife
  tot. Deshalb läuft der Kampf immer.
- **Harte Niederlagen.** Verlust von Türmen oder Gold macht aus dem Neuversuch eine Strafe,
  und aus dem Experiment ein Risiko. Beides bräuchte das Spiel nicht.
- **Erzwungene Aufmerksamkeit.** Ein Fenster, das pausiert, bricht die 80/20-Regel — das
  gilt auch für Hinweise ([14, Abschnitt 4a](14-progression-und-freischaltungen.md)).
- **Entscheidungen ohne Folgen.** Ist „neuer Turm oder Upgrade" einmal eindeutig
  beantwortbar, hört die Schleife auf, eine zu sein.
