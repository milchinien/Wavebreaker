# 08 – Ressourcen, Ökonomie und Upgrades

> Teil 8 von 16 der Game-Design-Dokumentation.

---

## 1. Die drei Ressourcen

| Ressource | Rolle | Frage, die sie beantwortet |
|---|---|---|
| **Gold** | kurzfristiger Fortschritt | "Was mache ich in diesem Run?" |
| **XP** | Entwicklung innerhalb eines Runs | "Wie stark werde ich in diesem Versuch?" |
| **Prestige-Punkte** | langfristige Entwicklung | "Wie verändert sich mein gesamtes Spiel?" |

**Designregel:** Jede Ressource braucht einen klaren Zweck und regelmäßige Verwendung. Keine unnötigen Zusatzwährungen. Weitere Ressourcen (Event-Ressourcen, Forschungsobjekte, saisonale Inhalte) sind später möglich, aber nicht Teil der Grundversion.

---

## 2. Gold

Gold ist die wichtigste aktive Spielwährung.

### Erhalt

- besiegte Gegner
- Bosse und Elite-Gegner
- Versorgungskapseln und Events

### Manuelles Einsammeln

Gold wird **nicht automatisch** gutgeschrieben. Besiegte Gegner lassen leuchtende Münzen fallen, die sichtbar auf dem Spielfeld liegen bleiben.

**Münzen verfallen nicht.** Nicht eingesammeltes Gold bleibt unbegrenzt liegen — auch über Wellenwechsel und verlorene Wellen hinweg. Der Spieler verliert nie Gold, nur weil er lange in der Basis war. Aus Performance-Gründen werden dicht beieinanderliegende Münzen visuell zu Stapeln zusammengefasst (ein Objekt, angezeigter Gesamtwert), statt tausende Einzelmünzen zu zeichnen.

Der Spieler sammelt sie durch Mausbewegung/Hover ein. Beim Einsammeln laufen eine kurze Animation und ein sichtbarer Zahlenanstieg.

Daraus entsteht die zentrale aktive Entscheidung:

> Bleibe ich im Menü und optimiere meine Basis — oder gehe ich zurück in den Kampf und sammle mein Gold ein?

Der Sammelkomfort lässt sich verbessern (größerer Sammelradius, schnelleres Einsammeln), später übernehmen Helfer das automatische Sammeln.
→ [12 – Offline-Fortschritt und Helfer](12-offline-fortschritt-und-helfer.md)

### Verwendung

- Turmkauf
- Upgrades aus den vier Fenstern (Abschnitt 5)
- Fähigkeiten freischalten
- Helfer kaufen und verbessern

### Gold-Werte und Skalierung

| Gegner | Gold (Welle 1) |
|---|---|
| normaler Gegner | 5 |
| schneller Gegner | 7 |
| Tank | 25 |
| Spezialgegner | 50–100 |
| Boss | 500+ |

Gold skaliert mit Welle, Gegnerstärke und Gegnerart:

| Welle | Gold pro Gegner (Richtwert) |
|---|---|
| 1 | 5 |
| 100 | 500 |
| 1.000 | mehrere tausend |

---

## 3. Erfahrungspunkte (XP)

XP erhält der Spieler durch besiegte Gegner, Elite-Gegner und Bosse — je stärker der Gegner, desto mehr XP.

XP wird automatisch gesammelt (kein manuelles Aufheben) und führt zu Levelaufstiegen mit Perk-Auswahl.
→ [09 – Level-System und Fähigkeiten](09-level-system-und-faehigkeiten.md)

Nach Prestige werden Level, XP und Perks zurückgesetzt.

---

## 4. Prestige-Punkte

Werden beim Prestige vergeben, abhängig von gesammeltem Gold, erreichter Welle, besiegten Bossen und Run-Leistung.
→ [10 – Prestige-System](10-prestige-system.md)

---

## 5. Das Upgrade-System

Upgrades werden mit Gold gekauft und verbessern die Station **innerhalb eines Runs**.

> **Neufassung vom 10.08.2026.** Die ursprüngliche Fassung beschrieb drei Kategorien
> (Hauptturm, Türme, global) mit je denselben drei Werten — Schaden, Tempo, Reichweite. Das
> hat sich als der Kern des Problems erwiesen und nicht als seine Lösung: Ein System, das
> seine Inhalte aus einer Schleife erzeugt, kann keine Inhalte haben. Jedes Upgrade hieß
> „Damage", jedes wirkte gleich, keines hatte mit einem anderen zu tun.
>
> Die vollständige Begründung und der Katalog stehen in `docs/upgrade-umbau.md`.

> **Wichtig, unverändert:** Türme besitzen keine Level und werden nicht automatisch stärker.
> Jede Verbesserung ist ein bewusst gekauftes Upgrade.

---

### 5.1 Vier Arten von Upgrades

Die Kaufanzahl ist keine Zahl, sondern eine **Rolle**. Sie legt Wirkungsgröße, Preis und
Kostenkurve gemeinsam fest.

| Art | Stufen | Wirkung je Stufe | Rolle im Spiel |
|---|---|---|---|
| **Endless** | unbegrenzt | klein, billig | Was man kauft, wenn nichts anderes geht |
| **Extension** | 15 oder 20 | spürbar, mittlerer Preis | Der Rücken des Runs |
| **Charge** | 3 oder 5 | großer Sprung, teuer | Eine bewusste Investition |
| **Directive** | genau 1 | ändert eine **Regel** | Der Run sieht danach anders aus |

**Ein Directive ist keine Zahl.** Ein Einmal-Upgrade, das +200 Schaden gibt, ist ein
Extension mit einer Stufe. Ein Directive ändert eine Regel: Der Core verschießt zwei
Projektile. Explosionen zünden nach. Verstärker reichen eine Kante weiter. Wer hier eine Zahl
hinschreibt, hat die Art verfehlt.

**Endless ist pro Stufe billiger *und* schwächer als Charge.** Seine steilere Kostenkurve
sorgt dafür, dass er sich selbst deckelt — er bleibt attraktiv, bis er es nicht mehr ist,
ohne dass eine Obergrenze danebenstünde.

---

### 5.2 Wer verbessert wird — Core, Turrets, Klassen

Zwei Begriffe, und sie stehen so im Spiel:

| Begriff | Bedeutung |
|---|---|
| **Core** | der Turm in der Mitte |
| **Turret** | jeder angebaute Turm |

**Turm-Upgrades gelten für einen ganzen Turmtyp, nicht für einzelne Türme.**

Beispiel: *„Rally — Autocannon +2 damage"* wirkt auf **alle** Autocannons zugleich.

| Vorteil | Wirkung |
|---|---|
| kein Mikromanagement | bei 15 Türmen bleibt das Menü überschaubar |
| klare Build-Entscheidung | in welche Turmtypen investiere ich? |
| Individualität bleibt erhalten | einzelne Türme unterscheiden sich weiterhin über Rarität und zufällige Eigenschaften |

Ein einzelner Legendary-Turm ist also nicht deshalb stark, weil er separat aufgerüstet wurde,
sondern weil seine Rarität und seine Eigenschaften die typweiten Upgrades multiplizieren.

**Darüber liegen die Turmklassen** (→ [05, Abschnitt 3](05-turm-system-und-turmtypen.md)):
Kinetic, Elemental und Support. Sie sind der Grund, warum das Menü nicht in sechzig
Einzelpfade zerfällt — ein Upgrade wie *„Warhead — alle Kinetic-Türme +4 % Schaden"* verbindet
vier Turmarten zu einer Entscheidung.

Ein Upgrade zielt damit auf genau eines von sechs Dingen:

```
Core · alle Turrets · eine Klasse · einzelne Turmarten · die Station · alle Module
```

---

### 5.3 Flach oder Prozent

Die Leitregel, und sie hat drei Fälle:

> **1. Flach, wo ein fester Bezugswert existiert.**
> **2. Prozent, wo eine Gruppe gemeint ist.**
> **3. Prozent, wo der Wert selbst ein Faktor ist.**

Der Grund für 1 und 2 ist rechnerisch. Eine Autocannon macht rund 2 Schaden je Schuss, ein
Marksman rund 62. Ein Upgrade „alle Turrets +2 Schaden" verdoppelte die eine und ließe den
anderen kalt — **eine flache Zahl auf eine gemischte Gruppe ist eine Lüge über ihre
Wirkung.** Auf den Core, eine einzelne Turmart oder eine Größe mit Einheit angewandt ist
dieselbe Zahl exakt und nachprüfbar.

Fall 3 ist keine Entscheidung, sondern die Einheit des Werts: Kritschaden, Buffstärke,
Explosionsanteil, Verlangsamung und der Goldfaktor *sind* Faktoren.

Daraus folgt, was ganze Zahlen trägt — und es ist die Mehrheit:

| Ganze Zahl | Beispiele |
|---|---|
| Der Core | `+2 damage`, `+0,1 Schuss/sec`, `+8 m Reichweite` |
| Eine einzelne Turmart | `+1 Drohne`, `+1 s Brandzeit` |
| Alles mit Einheit | Sekunden, Meter, Kettensprünge, Schüsse |
| Zählbares | `+1 Turmplatz`, `+25 Hülle`, `+1 Gold je Gegner` |

---

### 5.4 Overdrive

Ein Turret, das einen Gegner tötet, kann kurz in **Overdrive** gehen: einige Sekunden lang
feuert es sichtbar härter.

Vier Eigenschaften machen ihn zu dem, was das System gebraucht hat:

- **selbstauslösend** — man kauft keine Wirkung, sondern eine *Chance*,
- **kurz** — er läuft ab, es gibt nichts zu verwalten,
- **sichtbar** — das Modul glüht; ohne das existiert er für den Spieler nicht,
- **verzweigt** — Auslöser, Dauer, Stärke, Stapeln und Ausbreitung sind fünf verschiedene
  Upgrades in drei verschiedenen Fenstern.

Ein einziger Zustand trägt damit zwölf Upgrades, und keines davon ist „+5 % Schaden".

**Er existiert erst nach dem Directive `First Spark`.** Vorher gibt es ihn im Spiel nicht —
kein Glimmen, keine Anzeige, kein grauer Balken.

Drei seiner Regeln haben eine Grenze, und jede ist ihre eigentliche Aussage:

| Grenze | Warum |
|---|---|
| Auslösechance gedeckelt bei 50 % | Ein Zustand, der immer gilt, ist keiner, sondern ein Bonus mit Umweg |
| Treffer-Auslöser gedämpft | Eine Autocannon feuert sechsmal je Sekunde — ungedämpft wäre es ein Schalter |
| Hüllen-Auslöser einmal je Welle | Die Hülle schwankt um die Schwelle; sonst pulst der Zustand an dieser Kante |

---

## 6. Upgrade-Kosten

**Formel:** `Preis = Grundpreis × Goldmaßstab × Fensterfaktor × Stufe^Steigung`

Die **Steigung folgt der Art** — das ist die Änderung gegenüber der alten Fassung, die für
alles denselben Exponenten benutzte:

| Art | Steigung |
|---|---|
| Endless | 1,25 |
| Extension | 1,15 |
| Charge | 1,60 |
| Directive | fester Preis |

Ein endloser Pfad braucht eine steilere Kurve als einer mit zwanzig Stufen — nicht weil er
teurer sein soll, sondern weil ihn sonst nichts bremst. Ein Charge mit drei Stufen braucht
sie, damit die dritte Stufe eine Entscheidung bleibt und nicht das Auffüllen einer Leiste.

**Ziel:** frühe Verbesserungen sind häufig und günstig, späte werden langfristige
Investitionen. Daraus entsteht die Entscheidung: viele kleine Verbesserungen oder wenige
starke?

---

## 7. Upgrade-Maximum

Die Höchststufe **folgt der Art** und ist keine eigene Angabe mehr:

| Art | Maximum |
|---|---|
| Endless | unbegrenzt |
| Extension | 15 oder 20 |
| Charge | 3 oder 5 |
| Directive | 1 |

---

## 8. Verfügbarkeit — die vier Fenster

Nicht alle Upgrades sind sofort verfügbar. Sie liegen in **vier Fenstern**, und die sind
**Tiefenstufen, keine Themen**: Fenster 1 ist nicht „der Core" und Fenster 2 nicht „die
Türme". Jedes mischt Core, Turrets, Klassen, Station und Overdrive. Was sich zwischen ihnen
ändert, ist der Preis — und wie weit ein Upgrade in die Zukunft greift.

| Fenster | Name | Preisfaktor | Was darin überwiegt |
|---|---|---|---|
| 1 | **Foundation** | ×1 | Was in den ersten zwanzig Minuten wirkt |
| 2 | **Systems** | ×3 | Verknüpfung: Klassen, Support, Overdrive-Ausbau |
| 3 | **Doctrine** | ×8 | Endspiel: Synergien, Umschalter, sich ausschließende Wege |
| 4 | *(versiegelt)* | — | Angekündigter Platz, noch ohne Inhalt |

Die steigende Zahl der Directives ist die eigentliche Aussage: **In Fenster 1 kauft man
Zahlen, in Fenster 3 trifft man Entscheidungen.**

### Freischaltung

- **Fenster 1** ist ab Sekunde null offen.
- **Fenster 2** öffnet das Directive `Second Array` — ein Upgrade auf dem letzten Platz von
  Fenster 1, gekauft wie jedes andere.
- **Fenster 3** entsprechend `Third Array` in Fenster 2.
- **Beides wird beim Prestige zurückgesetzt**, wie jedes andere Gold-Upgrade.

**Fenster 4 bleibt versiegelt.** Der Reiter steht sichtbar in der Leiste und trägt ein
Schloss. Es gibt kein Tor dorthin zu kaufen: Ein Tor, das man bezahlt und hinter dem nichts
ist, wäre ein gebrochenes Versprechen. Ein sichtbarer, verschlossener Reiter ist dagegen
genau das, was er ist — ein angekündigter Platz.

### Zwei weitere Sperren

| Sperre | Bedeutung |
|---|---|
| **Voraussetzung** | Ein Upgrade wartet auf ein anderes (`Brink` braucht `Last Stand`) |
| **Ausschluss** | Zwei Upgrades schließen einander aus (`Iron Doctrine` / `Storm Doctrine`) |

Der Ausschluss ist die erste Stelle des Spiels, an der ein Upgrade eine **Entscheidung** ist
statt einer Ausgabe. Wer eines kauft, kann das andere in diesem Run nie mehr kaufen.

Dazu kommt die zweistufige Freischaltung des Goldsammlers: Der Prestige-Baum macht ihn
*kaufbar*, gekauft wird er mit Gold (→ [12, Abschnitt 10](12-offline-fortschritt-und-helfer.md)).

---

## 9. Reset

Alle Gold-Upgrades sind **temporär**. Nach Prestige verschwinden Gold, Türme und sämtliche gekauften Upgrades — **einschließlich der freigeschalteten Fenster**. Der Spieler beginnt den nächsten Run erneut, mit besseren Grundlagen.

---

## 10. Design-Regeln für Upgrades

Upgrades sollen:

- verständlich sein
- sofort spürbare Auswirkungen haben
- langfristige Ziele bieten
- keine sinnlosen Werte besitzen
- **einen eigenen Namen tragen**, den kein anderes Upgrade hat

Jede Verbesserung soll dem Spieler zeigen: *"Meine Basis wird stärker."*
