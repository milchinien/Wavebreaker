# Umbau des Upgrade-Systems

> Planungsdokument, Fassung 2 vom 10.08.2026. Noch kein Code.
>
> Fassung 1 war eine Skizze. Diese Fassung ist **umsetzungsreif**: Jedes der 60 Upgrades hat
> Kennung, Name, Art, Betrag, Preis und Bildmotiv; jede Etappe nennt Dateien, Signaturen und
> Abnahmebedingung. Wo Fassung 1 falsch lag, steht die Korrektur in Abschnitt 13.
>
> Der Plan ändert vier Kapitel des GDD (Abschnitt 12). Solange das nicht geschehen ist,
> widerspricht dieser Plan dem GDD und nicht umgekehrt.

---

## 1. Befund

`src/data/upgrades.ts` erzeugt seine Pfade in einer Schleife: drei Kampfwerte × (Kern + jede
Turmart) + vier globale Pfade. Alles, was am heutigen System stört, folgt daraus zwangsläufig:

| Symptom | Ursache im Code |
|---|---|
| Jedes Upgrade heißt „Damage" | `label` ist der Kampfwert, nicht das Upgrade (`COMBAT_PATHS`) |
| Alles wirkt gleich | Ein einziger Effekt: `base[key] * (1 + def.amount * level)` in `applyUpgrades` |
| Alles ist prozentual | `amount` **ist** ein Prozentsatz — eine andere Form existiert nicht |
| Nichts verknüpft sich | Ein Pfad kennt genau ein Ziel: `scope` + `defId` |
| Alles ist von Anfang an da | `UPGRADES` ist eine Konstante; nur `global.collector` hat ein `unlock` |
| 100 Stufen überall | `maxLevel` folgt dem Kampfwert (`damage: 100`), nicht der Rolle |

Ein System, das seine Inhalte generiert, kann keine Inhalte haben. Der Kern des Umbaus ist
deshalb: **die Schleife durch eine von Hand geschriebene Liste ersetzen.**

---

## 2. Vokabular

### 2.1 Core und Turrets

| Begriff | Bedeutung | Warum |
|---|---|---|
| **Core** | der Turm in der Mitte | Steht bereits so in Code und GDD — kein Umlernen |
| **Turret** | jeder angebaute Turm | Sammelbegriff für alles, was nicht der Core ist |
| **Module** | Core + Turrets zusammen | bleibt der technische Oberbegriff der Basisansicht |

Ein Upgrade liest sich damit als „All Turrets: +6 % damage" und braucht keine Erklärung.
*Module* bleibt der Bauklotz, *Turret* die Waffe.

### 2.2 Die drei Turmklassen

Damit Upgrades sich verknüpfen können, ohne dass jeder Turm eigene bekommt, gehört jeder
Turm **genau einer** sichtbaren Klasse an:

| Klasse | Türme | Was sie eint |
|---|---|---|
| **Kinetic** | `autocannon`, `cannon`, `sniper`, `rocket` | verschießt Materie |
| **Elemental** | `laser`, `tesla`, `flamer`, `cryo`, `plasma`, `void` | verschießt Energie |
| **Support** | `amplifier`, `bulwark`, `dronebay` | schießt gar nicht |

Die Klasse ist ein **neues Feld `class` an `TowerDef`** und ausdrücklich **nicht** die
vorhandene `category`. Der Unterschied ist wichtig genug für eine eigene Zeile:

- `category` (`attack`/`area`/`special`/`buff`/`support`) ist eine **Kampfregel** — sie
  entscheidet in `sim/buffs.ts::computeBuffs`, wer buffen darf und wer gebufft wird
  (GDD 03 §9).
- `class` ist eine **Vokabel für den Spieler** und steht nur in Upgrades und Tooltips.

Wer beides vermischt, ändert eine Balanceregel, sobald er ein Upgrade umbenennt. Der
Selbsttest hält die Trennung nach (Abschnitt 11).

### 2.3 Overdrive

Ein Turret, das einen Gegner tötet, kann in **Overdrive** gehen: einige Sekunden lang feuert
es sichtbar härter. Vier Eigenschaften machen ihn zum richtigen Träger für dieses Vorhaben:

- **selbstauslösend** — man kauft keine Wirkung, sondern eine *Chance*,
- **kurz** — er läuft ab, es gibt nichts zu verwalten,
- **sichtbar** — das Modul glüht, sonst existiert er für den Spieler nicht,
- **verzweigt** — Auslöser, Dauer, Stärke, Stapeln und Ausbreitung sind fünf verschiedene
  Upgrades in drei verschiedenen Fenstern.

Ein einziger Zustand trägt damit **zwölf** Upgrades, und keines davon ist „+5 % Schaden".
Die vollständige Mechanik steht in Abschnitt 6.

Overdrive existiert im Spiel **erst**, nachdem `First Spark` gekauft wurde — vorher keine
Anzeige, kein grauer Balken, kein Glühen.

---

## 3. Die vier Arten von Upgrades

Die Kaufanzahl ist keine Zahl, sondern eine **Rolle**. Sie legt Wirkungsgröße, Preis und
Kostenkurve gemeinsam fest:

| Art | Stufen | Wirkung je Stufe | Kurve | Rolle im Spiel |
|---|---|---|---|---|
| **Endless** | ∞ | klein | `base × Lv^1,25` | Was man kauft, wenn nichts anderes geht |
| **Extension** | 15 oder 20 | spürbar | `base × Lv^1,15` | Der Rücken des Runs |
| **Charge** | 3 oder 5 | groß | `base × Lv^1,60` | Eine bewusste Investition |
| **Directive** | 1 | ändert eine **Regel** | fester Preis | Der Run sieht danach anders aus |

Drei Festlegungen:

1. **Endless ist pro Stufe billiger *und* schwächer als Charge** — ausdrückliche Vorgabe.
   Der steilere Exponent (1,25 gegen 1,15) sorgt dafür, dass ein endloser Pfad sich selbst
   deckelt: Er bleibt attraktiv, bis er es nicht mehr ist, ohne dass eine Obergrenze
   danebenstünde.
2. **Ein Directive ist keine Zahl.** Ein Einmal-Upgrade, das +200 Schaden gibt, ist ein
   Extension mit einer Stufe. Ein Directive ändert eine Regel: Der Core schießt zwei
   Projektile. Explosionen zünden nach. Verstärker reichen eine Kante weiter. Wer hier eine
   Zahl hinschreibt, hat die Art verfehlt — der Selbsttest prüft das (`kind: 'rule'`).
3. **Die Art bestimmt die Rahmenfarbe der Kachel** (Abschnitt 8.2). Man sieht beim
   Überfliegen, wo die teuren Entscheidungen liegen, bevor man einen Namen liest.

### 3.1 Kostenformel

```
cost(def, nextLevel) =
  max(1, round( def.baseCost × GOLD_SCALE × WINDOW_FACTOR[def.window] × nextLevel ^ EXP[def.kind] ))

GOLD_SCALE     = 0,2                    (unverändert, data/balance.ts)
WINDOW_FACTOR  = { 1: 1, 2: 3, 3: 8 }
EXP            = { endless: 1,25, extension: 1,15, charge: 1,60, directive: 1 }
```

Die bestehende `upgradeCost(base, nextLevel)` in `data/balance.ts` wird dadurch ersetzt; der
Exponent `UPGRADE_COST_EXPONENT` geht in `EXP.extension` auf.

Beispielrechnungen — sie sind der Sinn der Formel, nicht Zierde:

| Upgrade | Art | base | Fenster | Stufe 1 | Stufe 5 | Stufe 20 | Stufe 100 |
|---|---|---|---|---|---|---|---|
| Hammerfall | Endless | 30 | ×1 | **6** | 45 | 254 | 1.897 |
| Drumfire | Extension | 120 | ×1 | **24** | 149 | 754 | — |
| Killing Blow | Charge 5 | 550 | ×1 | **110** | 1.444 | — | — |
| Second Array | Directive | 4.000 | ×1 | **800** | — | — | — |
| Resonance | Extension | 150 | ×3 | **90** | 559 | 2.826 | — |
| Third Array | Directive | 8.000 | ×3 | **4.800** | — | — | — |
| Focal Lens | Extension | 180 | ×8 | **288** | 1.789 | 9.043 | — |
| Ascendant | Directive | 5.000 | ×8 | **8.000** | — | — | — |

Alle Zahlen sind **Startwerte für das Justieren**, keine Messergebnisse. Verbindlich sind die
Verhältnisse: Endless billiger als Charge, Fenster 2 dreimal Fenster 1, Fenster 3 achtmal.

### 3.2 Flach oder Prozent — die Regel

Die Vorgabe lautet: größtenteils weg von Prozenten. Die Umsetzung braucht ein Kriterium,
sonst wird sie beliebig. Es gibt **drei** Fälle, und nur der zweite ist eine Entscheidung:

> **1. Flach, wo ein fester Bezugswert existiert.**
> **2. Prozent, wo eine Gruppe gemeint ist.**
> **3. Prozent, wo der Wert selbst ein Faktor ist.**

**Zu 1 und 2** — der Grund ist rechnerisch, nicht ästhetisch. Nach `GLOBAL_DAMAGE_SCALE = 0,28`
macht die Autocannon **2,2** Schaden je Schuss und der Marksman **61,6**. Ein Upgrade
„All Turrets: +2 damage" verdoppelte die eine und ließe den anderen kalt — eine flache Zahl
auf eine gemischte Gruppe ist eine Lüge über ihre Wirkung. Auf den Core, eine einzelne
Turmart oder eine Größe mit Einheit angewandt ist dieselbe Zahl exakt und nachprüfbar.

**Zu 3** — Kritschaden, Buffstärke, Explosionsanteil, Verlangsamungsfaktor, Goldfaktor und
Overdrive-Stärke *sind* Faktoren. „+25 % crit damage" ist keine Designentscheidung, sondern
die Einheit dieses Werts. Diese Upgrades zählen deshalb nicht gegen die Vorgabe.

Was daraus folgt — die Bilanz über alle 60 Upgrades, **nachgezählt am gebauten Katalog**
(`selftest/suites/catalog.ts`):

| Form | Anzahl |
|---|---|
| **Directives** — Regeln und Tore, ganz ohne Betrag | **18** |
| **Zählwerte** — Schaden, Meter, Sekunden, Sprünge, Drohnen, Plätze, Gold | **26** |
| **Faktor-Werte** (Fall 3 — Kritschaden, Buffstärke, Goldfaktor …) | **12** |
| **Gruppen-Prozente** (Fall 2 — die echte Entscheidung) | **4** |

Von 42 Upgrades mit Betrag sind 26 Zählwerte — der Zählwert ist die Mehrheit, und genau das
prüft der Selbsttest. Gruppen-Prozente gibt es **vier**: `Warhead`, `Iron Rain`, `Resonance`
und `Overclock`.

> **Eine Falle beim Nachzählen**, die in der ersten Fassung dieses Plans zugeschnappt ist:
> „Ganze Zahl" ist keine Eigenschaft des gespeicherten Betrags. Ein Kritschaden-Zuschlag
> steht als `0,25` im Datensatz und erscheint dem Spieler als „+25 %"; eine Overdrive-Chance
> steht als `0,01` und erscheint als „+1 %". Beide sind ganze Zahlen für den, der sie liest,
> und gebrochene für den, der sie speichert. Maßgeblich ist deshalb die **Form der Wirkung** —
> zählbar oder anteilig —, und die beantwortet `isFactor()` in `data/upgrades.ts`. Dieselbe
> Auskunft braucht ab E2 die Rechenkette (addieren oder multiplizieren?) und ab E5 die
> Anzeige („+15 m" oder „+8 %").

### 3.3 Ganze Zahlen in der Anzeige

Entschieden: **nur die Anzeige rundet.** Die Rechenkette bleibt in Fließkomma — das schützt
die in `data/balance.ts` ausführlich dokumentierte Kante bei 0,28, die bei einer Rundung im
Kern neu zu vermessen wäre.

Praktisch:

- `core/format.ts` bekommt `formatInt(value)` — dieselben Regeln wie `formatNumber`, aber
  ohne Nachkommastelle unterhalb der Abkürzungsschwelle.
- Schadenszahlen über dem Feld (`hud.damage`), Werte im Tooltip und im Moduldetail laufen
  über `formatInt`.
- Nachkommastellen bleiben nur, wo die Einheit sie erzwingt: `1,2/sec`.

---

## 4. Die vier Fenster

Die Fenster sind **Tiefenstufen, keine Themen.** Ausdrückliche Vorgabe: Fenster 1 ist nicht
„der Core" und Fenster 2 nicht „die Türme". Jedes Fenster mischt Core, Turrets, Klassen,
Station und Overdrive. Was sich zwischen ihnen ändert, ist der Preis — und wie weit ein
Upgrade in die Zukunft greift.

| Fenster | Name | Faktor | Charakter | Verteilung der Arten |
|---|---|---|---|---|
| 1 | **Foundation** | ×1 | Was in den ersten zwanzig Minuten wirkt | 5 Endless · 8 Ext · 4 Charge · 3 Directive |
| 2 | **Systems** | ×3 | Verknüpfung: Klassen, Support, Overdrive-Ausbau | 3 Endless · 7 Ext · 4 Charge · 6 Directive |
| 3 | **Doctrine** | ×8 | Endspiel: Synergien, Umschalter, ausschließende Wege | 2 Endless · 6 Ext · 3 Charge · 9 Directive |
| 4 | *(gesperrt)* | — | Platzhalter | — |

Die steigende Zahl der Directives ist die eigentliche Aussage der Tabelle: In Fenster 1 kauft
man Zahlen, in Fenster 3 trifft man Entscheidungen.

Der Fensterfaktor ist ein **Durchschnitt, kein Deckel**. In jedem Fenster stehen bewusst zwei
bis drei Ausreißer nach unten (etwas, das man sofort mitnimmt) und einer nach oben (etwas,
worauf man den halben Run spart).

### 4.1 Freischaltung

- **Fenster 1** ist ab Sekunde null offen.
- **Fenster 2** öffnet das Directive `Second Array` — ein Upgrade auf **Platz 20 von
  Fenster 1**, gekauft wie jedes andere. 800 Gold.
- **Fenster 3** entsprechend `Third Array` auf Platz 20 von Fenster 2. 4.800 Gold.
- **Beides wird beim Prestige zurückgesetzt**, weil es in `run.upgrades` steht — ohne dass
  dafür ein Feld im Spielstand dazukommt.

**Fenster 4 bleibt leer und dauerhaft gesperrt.** Der Reiter steht sichtbar in der Leiste,
trägt ein Schloss und lässt sich nicht öffnen. Es gibt in Fenster 3 **kein** `Fourth Array`:
Ein Tor, das man bezahlt und hinter dem nichts ist, wäre ein gebrochenes Versprechen. Ein
sichtbarer, verschlossener Reiter ist dagegen genau das, was er ist — ein angekündigter Platz.

### 4.2 Warum Freischaltung im Run zulässig ist

GDD 14 §5 verbietet heute Freischaltungen innerhalb eines Runs, mit zwei Begründungen. Beide
treffen hier nicht zu, und der Unterschied gehört ins GDD:

| Einwand aus GDD 14 §5 | Warum er hier nicht greift |
|---|---|
| „macht die Startsituation unvergleichbar" | Jeder Run beginnt mit demselben Fenster 1 und findet dieselben Tore zu denselben Preisen vor. Was ein späterer Run anders macht, ist **wann** er das Tor erreicht — nicht **was** er vorfindet. |
| „nimmt dem Prestige-Baum seine Aufgabe" | Der Baum bleibt das Einzige, was **über** einen Run hinaus wirkt. Die Tore sind kein zweiter Baum, sondern eine Kurve **innerhalb** der Stunde: Sie geben einem Run eine Mitte statt nur einen Anfang. |

---

## 5. Der Upgrade-Katalog

60 Upgrades, drei Fenster zu je 20 Plätzen, alle belegt.

**Spalten:** `#` Platz im Raster · **Name** wie er im Spiel steht · `Art` (E = Endless,
X = Extension, C = Charge, D = Directive) · **Wirkung** je Stufe · `base` Grundpreis vor
`GOLD_SCALE` und Fensterfaktor · **Bild** Motiv der Zeichnung.

### 5.1 Fenster 1 — Foundation (×1)

| # | Kennung / Name | Art | Wirkung je Stufe | base | Bild |
|---|---|---|---|---|---|
| 1 | `f1.hammerfall` **Hammerfall** | E | Core `+2 damage` | 30 | fallender Hammer über Amboss |
| 2 | `f1.drumfire` **Drumfire** | X 20 | Core `+0,1 shots/sec` | 120 | drei Mündungsblitze in Reihe |
| 3 | `f1.longsight` **Longsight** | X 15 | Core `+8 m range` | 100 | Visier mit Entfernungsstrichen |
| 4 | `f1.bulkhead` **Bulkhead** | E | Station `+25 hull` | 40 | genietetes Schott |
| 5 | `f1.magnetglove` **Magnet Glove** | X 15 | Sammelradius `+20 m` | 110 | Handschuh mit Feldlinien |
| 6 | `f1.tithe` **Tithe** | E | `+1 gold` je Gegner | 50 | Münze mit Kerbe |
| 7 | `f1.scrapperseye` **Scrapper's Eye** | C 5 | `+8 % gold` | 500 | Auge über Schrotthaufen |
| 8 | `f1.hairtrigger` **Hair Trigger** | X 20 | Core `+1 % crit chance` | 130 | gespannter Abzug |
| 9 | `f1.killingblow` **Killing Blow** | C 5 | Core `+25 % crit damage` | 550 | zersplitternder Panzer |
| 10 | `f1.twinbarrel` **Twin Barrel** | D | **Der Core verschießt zwei Projektile statt einem** | 3.000 | Doppellauf von vorn |
| 11 | `f1.warhead` **Warhead** | X 20 | Kinetic `+4 % damage` | 140 | Sprengkopfspitze |
| 12 | `f1.ironrain` **Iron Rain** | X 15 | Kinetic `+3 % attack rate` | 120 | fallende Geschossreihe |
| 13 | `f1.firstspark` **First Spark** | D | **Overdrive existiert.** Kills lösen ihn mit 5 % Chance aus | 1.500 | Zündfunke am Kontakt |
| 14 | `f1.redline` **Redline** | E | Overdrive-Chance `+1 %` | 60 | Drehzahlmesser im roten Feld |
| 15 | `f1.afterburn` **Afterburn** | C 5 | Overdrive-Dauer `+1 s` | 600 | Nachbrennerkegel |
| 16 | `f1.foreman` **Foreman** | C 3 | `+1 tower slot` | 900 | Bauhelm über Grundriss |
| 17 | `f1.fieldrepair` **Field Repair** | X 20 | `+1 hull/sec` Regeneration im Gefecht | 130 | Schweißbrenner mit Funken |
| 18 | `f1.packmule` **Pack Mule** | E | `+3 hull` je gebautem Turret | 45 | beladene Traggestelle |
| 19 | `f1.rally` **Rally** | X 20 | Autocannon `+2 damage` | 90 | Signalfahne |
| 20 | `f1.secondarray` **Second Array** | D | **Öffnet Fenster 2** | 4.000 | zweiter Ring um einen Kern |

**Warum Fenster 1 so aussieht.** Es enthält genau zwei Upgrades, die auch Türme treffen, die
man zu Beginn nicht hat (11 und 12 wirken auf Marksman und Rocket Battery mit) — die Vorgabe
lautet *weniger*, nicht *keine*. Der Verstärker fehlt hier ganz, obwohl er im Startlager
liegt: Sein Upgrade steht in Fenster 2, weil es erst zählt, wenn die Station gebaut ist.
`Rally` ist das einzige Upgrade auf eine einzelne Turmart in diesem Fenster — die Autocannon
ist der eine Turm, den jeder Spieler ab Sekunde null hat.

### 5.2 Fenster 2 — Systems (×3)

| # | Kennung / Name | Art | Wirkung je Stufe | base | Bild |
|---|---|---|---|---|---|
| 1 | `f2.resonance` **Resonance** | X 20 | Elemental `+5 % damage` | 150 | konzentrische Schwingungen |
| 2 | `f2.wildfire` **Wildfire** | X 15 | Flame Projector: Branddauer `+1 s` | 130 | übergreifende Flammenzunge |
| 3 | `f2.emberkeeper` **Ember Keeper** | E | Flame Projector: Brandschaden `+2/sec` | 50 | glimmende Kohle |
| 4 | `f2.deepfreeze` **Deep Freeze** | X 15 | Cryo Emitter + Void Sphere: Verlangsamung `+1 s` | 130 | Eiskristall mit Rissen |
| 5 | `f2.arccascade` **Arc Cascade** | C 3 | Tesla Coil `+1 hop` | 700 | dreifach verzweigter Blitz |
| 6 | `f2.fragmentation` **Fragmentation** | X 20 | Rocket + Plasma: Explosionsradius `+15 m` | 160 | berstender Ring aus Splittern |
| 7 | `f2.sympathetic` **Sympathetic Detonation** | D | **Jede Explosion zündet ein zweites Mal, halb so stark** | 2.200 | zwei versetzte Druckwellen |
| 8 | `f2.choir` **Choir** | X 20 | Power Amplifier `+6 % Buffstärke` | 170 | drei aufsteigende Bögen |
| 9 | `f2.widechorus` **Wide Chorus** | D | **Verstärker wirken eine Kante weiter** | 2.500 | Ring um Ring um eine Wabe |
| 10 | `f2.aegis` **Aegis** | E | Shield Generator `+25 hull` | 65 | Rundschild mit Nabe |
| 11 | `f2.swarm` **Swarm** | C 3 | Drone Bay `+1 drone` | 800 | drei kleine Rümpfe im Dreieck |
| 12 | `f2.huntingpack` **Hunting Pack** | E | Drohnen `+3 damage` | 55 | Rudel auf gemeinsamer Bahn |
| 13 | `f2.relay` **Relay** | X 20 | Jedes Support-Modul gibt jedem Nachbar-Turret `+2 damage` | 180 | Knotenpunkt mit vier Linien |
| 14 | `f2.secondwind` **Second Wind** | D | **Overdrive stapelt zweifach** | 2.400 | doppelte Spirale |
| 15 | `f2.contagion` **Contagion** | D | **Overdrive springt auf ein Nachbarmodul über** | 2.000 | Funke, der eine Kante überspringt |
| 16 | `f2.runaway` **Runaway** | X 20 | Overdrive-Stärke `+4 %` | 160 | Zeiger über das Skalenende hinaus |
| 17 | `f2.laststand` **Last Stand** | D | **Hülle unter 30 % setzt die ganze Station in Overdrive** | 2.600 | Station mit Riss und Glut |
| 18 | `f2.brink` **Brink** | C 3 | *Last Stand* löst schon bei 40 % / 50 % / 60 % aus | 900 | Kante über einem Abgrund |
| 19 | `f2.pathfinder` **Pathfinder** | C 3 | `+1 tower slot` | 1.000 | Wegzeichen mit Abzweig |
| 20 | `f2.thirdarray` **Third Array** | D | **Öffnet Fenster 3** | 8.000 | dritter Ring um einen Kern |

`Brink` setzt `Last Stand` voraus (`requires`) — der erste Fall einer Kachel, die gesperrt
bleibt, bis ihr Elternteil steht.

### 5.3 Fenster 3 — Doctrine (×8)

| # | Kennung / Name | Art | Wirkung je Stufe | base | Bild |
|---|---|---|---|---|---|
| 1 | `f3.focallens` **Focal Lens** | X 20 | Laser Lance `+8 damage/sec` auf gehaltenem Ziel | 180 | Sammellinse mit Brennpunkt |
| 2 | `f3.executioner` **Executioner** | X 15 | Marksman `+6 % damage` gegen das stärkste Ziel | 170 | Fadenkreuz auf einer Krone |
| 3 | `f3.overpressure` **Overpressure** | C 5 | Plasma Cannon `+5 %` Explosionsanteil | 1.200 | berstendes Ventil |
| 4 | `f3.riftwalk` **Riftwalk** | X 20 | Void Sphere `+3 %` Verlangsamung | 170 | aufreißender Spalt |
| 5 | `f3.ashfall` **Ashfall** | D | **Brennende Gegner nehmen +20 % aus allen Quellen** | 3.000 | fallende Asche über Glut |
| 6 | `f3.shatterpoint` **Shatterpoint** | D | **Verlangsamte Gegner nehmen +50 % kritischen Schaden** | 3.000 | Bruchstern im Eis |
| 7 | `f3.conduit` **Conduit** | D | **Elemental-Türme springen auf einen nahen Gegner über** | 3.500 | Leiterbahn zwischen zwei Punkten |
| 8 | `f3.irondoctrine` **Iron Doctrine** | D | **Kinetic +40 %, Elemental −15 %** — schließt 9 aus | 4.000 | Eisensiegel |
| 9 | `f3.stormdoctrine` **Storm Doctrine** | D | **Elemental +40 %, Kinetic −15 %** — schließt 8 aus | 4.000 | Sturmsiegel |
| 10 | `f3.vanguard` **Vanguard** | D | **Der Core teilt ein Viertel seiner flachen Upgrades mit allen Turrets** | 4.500 | Kern mit Strahlen nach außen |
| 11 | `f3.crown` **Crown** | X 20 | Je gebautem Turret: Core `+2 damage` | 190 | Zackenkrone aus Modulen |
| 12 | `f3.overclock` **Overclock** | C 5 | Core `+8 % attack rate` | 1.300 | Taktgeber über der Marke |
| 13 | `f3.endlessspring` **Endless Spring** | D | **Overdrive läuft nicht ab, solange ein Boss lebt** | 3.200 | Feder, die nicht entspannt |
| 14 | `f3.perpetual` **Perpetual** | D | **Overdrive löst auch bei Treffern aus, nicht nur bei Kills** | 3.600 | geschlossener Kreislauf |
| 15 | `f3.warlord` **Warlord** | E | Overdrive-Stärke `+2 Prozentpunkte` | 70 | Feldherrnwimpel |
| 16 | `f3.bastion` **Bastion** | X 20 | Station `+5 % hull` | 180 | Bollwerk mit Strebe |
| 17 | `f3.tollofwar` **Toll of War** | E | `+5 gold` je abgeschlossener Welle | 60 | Waage mit Münzen |
| 18 | `f3.architect` **Architect** | C 3 | `+1 tower slot` | 1.400 | Zirkel über Grundriss |
| 19 | `f3.ascendant` **Ascendant** | D | **Fähigkeiten kommen doppelt so schnell zurück** | 5.000 | aufsteigender Pfeil im Ring |
| 20 | `f3.tribute` **Tribute** | X 15 | `+10 % gold` von Bossen und Eliten | 160 | Krone auf gestapelten Münzen |

**Das Herzstück sind die Plätze 8 und 9: zwei Directives, die einander ausschließen.** Wer
eines kauft, kann das andere in diesem Run nie mehr kaufen. Das ist die erste Stelle des
Spiels, an der ein Upgrade eine *Entscheidung* ist statt einer Ausgabe — und sie steht
bewusst dort, wo der Spieler seine Station längst kennt.

`Overclock` (12) ist das **einzige Prozent-Upgrade auf den Core** und ein bewusster Bruch der
Regel aus 3.2. Es existiert, um `Drumfire` zu belohnen: Was Fenster 1 zwanzig Stufen lang
addiert hat, multipliziert Fenster 3 in fünf. Genau diese Verzahnung über die Fenster hinweg
ist der Zweck der Aufteilung.

---

## 6. Overdrive im Detail

### 6.1 Zustand

```ts
// in CombatState (runtime, nicht im Spielstand)
overdrive: Map<string /* uid */, { left: number; stacks: number }>
```

Nicht im Spielstand, aus demselben Grund wie Abklingzeiten (`RuntimeState.abilities`): Nach
dem Laden beginnt die Welle ohnehin neu, und eine Restzeit in Simulationssekunden über einen
Programmstart zu tragen hieße, sie an die echte Uhr zu binden.

### 6.2 Auslöser

| Auslöser | Bedingung | Wahrscheinlichkeit | Freigeschaltet durch |
|---|---|---|---|
| **Kill** | Ein Turret tötet einen Gegner | `min(0,50 ; 0,05 + 0,01 × Lv(redline))` | `First Spark` |
| **Treffer** | Ein Turret trifft, ohne zu töten | dieselbe Chance, **gedrittelt** | `Perpetual` |
| **Hülle** | Stationshülle unterschreitet die Schwelle | sicher, **einmal je Welle** | `Last Stand` |

Drei Festlegungen mit Begründung:

- **Deckel bei 50 %.** `Redline` ist endlos; ohne Deckel wäre Overdrive ab Stufe 95 der
  Normalzustand — und ein Zustand, der immer gilt, ist keiner, sondern ein Bonus.
- **Treffer-Auslöser gedrittelt.** Eine Autocannon feuert 6× pro Sekunde. Ungedrittelt wäre
  `Perpetual` kein Upgrade, sondern ein Schalter für „Overdrive immer an".
- **Hüllen-Auslöser einmal je Welle.** Sonst pulst er an der Schwelle, sobald die Hülle
  darum herum schwankt.

Schwelle für `Last Stand`: 30 %, mit `Brink` Stufe 1/2/3 auf 40 % / 50 % / 60 %.

### 6.3 Dauer und Wirkung

```
Dauer   = 4 s + 1 s × Lv(afterburn)                      →  4 bis 9 s
Wirkung = 50 + 4 × Lv(runaway) + 2 × Lv(warlord)          Prozentpunkte
          auf damage UND attackSpeed
Stapel  = 1, mit `Second Wind` bis 2 (Wirkung addiert, Dauer wird neu gesetzt)
```

`Endless Spring`: Solange ein Boss im Feld ist, wird `left` nicht heruntergezählt.

`Contagion`: Beim Auslösen springt Overdrive auf **ein** kantenbenachbartes Modul über, mit
**halber** Restdauer. Es springt von dort nicht weiter — eine Kettenreaktion über eine
gebaute Station wäre nicht mehr zu lesen und in einer dichten Bauform sofort flächendeckend.

### 6.4 Einbau in die Rechenkette

Overdrive wirkt **pro Modul**, nicht global — anders als `abilityBonus` und `eventBonus`, die
als fertige Zahl in `runtime.combat` liegen. Er kann deshalb **nicht** in `applyTimed`
einfließen, sondern muss dort ansetzen, wo das Modul bekannt ist: in `moduleStats`.

Er sitzt als **letzte** Schicht, nach den Buffs. Das folgt der bereits dokumentierten Regel
aus `sim/stats.ts`: Je kurzfristiger eine Quelle wirkt, desto später setzt sie auf.

### 6.5 Sichtbarkeit

Ohne sichtbaren Zustand existiert Overdrive für den Spieler nicht. `render/combat.ts` zeigt
am Modul:

- einen pulsierenden Ring in einem eigenen Ton (Vorschlag: das Orange `#ff6a2d`, das heute
  der Flame Projector trägt — es ist im Feld sonst nur punktuell besetzt),
- helleres Mündungsfeuer,
- beim Auslösen einen kurzen Aufschlag nach außen.

Bei `Last Stand` glüht die **ganze Station** — das ist der Moment, für den dieses Directive
gekauft wurde, und er muss aussehen wie eine Wende.

---

## 7. Datenmodell

### 7.1 Der neue `UpgradeDef`

```ts
export type UpgradeKind = 'endless' | 'extension' | 'charge' | 'directive'
export type UpgradeWindow = 1 | 2 | 3 | 4

export type UpgradeDef = {
  id: string                    // 'f1.hammerfall'
  window: UpgradeWindow
  slot: number                  // 0 – 19, Position im Raster
  kind: UpgradeKind
  maxLevel: number              // Infinity | 20 | 15 | 5 | 3 | 1
  effect: UpgradeEffect
  icon: string                  // Dateiname ohne Endung, siehe 10.
  baseCost: number              // vor GOLD_SCALE und Fensterfaktor
  requires?: string             // Upgrade-Id, die gekauft sein muss
  excludes?: string             // Upgrade-Id, die dann gesperrt ist
}
```

**Name und Beschreibung stehen im Datensatz** (`name`, `info`) — anders als in Fassung 1
geplant. Der Bestand hat entschieden: `data/perks.ts`, `data/trader.ts` und
`data/prestige.ts` halten ihre Texte alle drei direkt am Eintrag, und der Wächter in
`selftest/guards.ts` verbietet Spielertexte in `ui/` und `render/`, nicht in `data/`. Eine
vierte Bauweise einzuführen — Schlüssel in `data/strings.ts`, aufgelöst über einen Cast, weil
`StringKey` 60 abgeleitete Schlüssel nicht typisieren kann — wäre schlechter gewesen als die
vorhandene. Beim Justieren will man ohnehin Name, Betrag und Preis in einer Zeile sehen.

Die Prüfung „englisch und nicht leer", die `selftest/suites/strings.ts` für die Texttabelle
macht, steht deshalb ein zweites Mal in `selftest/suites/catalog.ts` — sonst sähe sie den
Katalog nicht.

### 7.2 Die Effekt-Union

```ts
export type UpgradeTarget =
  | { kind: 'core' }
  | { kind: 'turrets' }
  | { kind: 'class'; class: TowerClass }
  | { kind: 'towers'; ids: readonly string[] }   // Deep Freeze trifft cryo UND void
  | { kind: 'station' }

export type UpgradeEffect =
  | { kind: 'flat';    target: UpgradeTarget; stat: StatKey; amount: number }
  | { kind: 'percent'; target: UpgradeTarget; stat: StatKey; amount: number }
  | { kind: 'global';  key: GlobalKey;  amount: number }
  | { kind: 'special'; key: SpecialKey; amount: number }
  | { kind: 'rule';    id: RuleId }
```

```ts
type GlobalKey =
  | 'stationHp' | 'goldBonus' | 'collectRadius' | 'xpBonus'      // vorhanden
  | 'goldPerKill' | 'goldPerWave' | 'bossGold'
  | 'towerSlots'
  | 'hullPerTurret' | 'waveRepair'

type SpecialKey =
  | 'overdriveChance' | 'overdriveDuration' | 'overdrivePower'
  | 'critDamage'
  | 'burnDuration' | 'burnDps' | 'chillDuration' | 'chillFactor'
  | 'chainHops' | 'blastRadius' | 'blastShare'
  | 'buffPower' | 'hullPerShield' | 'droneCount' | 'droneDamage'
  | 'beamRamp' | 'strongestBonus'
  | 'coreDamagePerTurret' | 'supportNeighbourDamage'

type RuleId =
  | 'twinBarrel' | 'firstSpark' | 'sympatheticDetonation' | 'wideChorus'
  | 'secondWind' | 'contagion' | 'lastStand'
  | 'ashfall' | 'shatterpoint' | 'conduit'
  | 'ironDoctrine' | 'stormDoctrine' | 'vanguard'
  | 'endlessSpring' | 'perpetual' | 'ascendant'
```

Dazu kommt ein sechster Effekt, den Fassung 1 übersehen hatte: `{ kind: 'window'; opens }`
für die beiden Tore. Sie als `rule` zu führen wäre schief gewesen — ein Tor ändert keine
Kampfregel, es öffnet ein Menü, und `windowGate()` findet es genau daran.

Beide Aufzählungen sind **geschlossen**. Jeder `SpecialKey` und jede `RuleId` braucht genau
eine Leseseite im Simulationscode — und genau das prüft der Selbsttest, sonst entstünde
wieder ein Upgrade, das Gold nimmt und nichts tut.

### 7.3 Zugriff

```ts
export const UPGRADES: readonly UpgradeDef[]
export function upgradeById(id: string): UpgradeDef
export function isKnownUpgrade(id: string): boolean
export function upgradesInWindow(window: UpgradeWindow): UpgradeDef[]   // nach slot sortiert
export function windowGate(window: UpgradeWindow): string | null        // 'f1.secondarray'
```

`upgradesForCore`, `upgradesForTower`, `globalUpgrades`, `upgradeGroupSizes` und
`largestUpgradeGroup` entfallen ersatzlos.

---

## 8. Die Oberfläche

### 8.1 Die Kachel

Auf der Kachel steht **nichts außer Bild und Rahmen** — kein Wert, kein Preis, keine Stufe.
Alles Lesbare steht im Tooltip.

> Vorbild ist der gelieferte Screenshot (Orc Incremental). Übernommen wird die **Bauform der
> Kachel**, nicht die Anordnung des Panels: Wavebreaker ist radial aufgebaut, das Panel
> bleibt unten. Vorbilder sind Vorschläge, keine Urteile — siehe die zurückgesetzte
> Ressourcenzeile in `docs/politur.md`.

### 8.2 Die fünf Rahmenzustände

`.up-tile[data-state]`:

| Zustand | Rahmen | Bild | Klick |
|---|---|---|---|
| `locked` | dunkel, geschlossen | Silhouette | wirkungslos, Tooltip nennt die Voraussetzung |
| `unaffordable` | schlicht, matt | gedimmt | wirkungslos, Tooltip zeigt den Preis |
| `ready` | leuchtet in der **Farbe der Art** | voll | kauft |
| `partial` | leuchtet, mit Fortschrittskerben am Rand | voll | kauft |
| `maxed` | **golden**, geschlossener Ring | voll | wirkungslos, Tooltip zeigt „Max" |

Die Rahmenfarbe ist die **Art**, nicht das Ziel. Damit sieht man beim Überfliegen, wo die
vier teuren Entscheidungen eines Fensters liegen — und das ist die Information, die man
beim Überfliegen braucht.

Kein `disabled` am Knopf: Ein gesperrter Knopf bekommt keine Zeigerereignisse, und damit
fände ausgerechnet die Kachel keinen Tooltip, die man sich noch nicht leisten kann. Diese
Regel steht heute schon in `ui/upgrades.ts` und bleibt.

### 8.3 Der Tooltip

```
HAMMERFALL                                    Endless
Adds flat damage to the core.

Now      12 dmg   →   14 dmg
Level    7 / ∞
Cost     $ 340
```

- Bei `locked`: statt der Preiszeile die Voraussetzung im Klartext („Requires Last Stand"),
  bei `excludes` der Grund („Blocked by Iron Doctrine").
- Bei `maxed`: „Max", keine Zahl mit `$`.
- Bei Directives entfällt die Vorher/Nachher-Zeile — sie ändern keine Zahl.

Der Tooltip hängt wie heute am **Panel**, nicht an der Kachel: In einer Kachelwand ohne
Zwischenraum verdeckte er sonst die Nachbarn und verhinderte genau den Vergleich, für den man
ihn aufschlägt.

### 8.4 Das Raster

**Feste 2 × 10 Plätze, niemals eine Rollleiste.** Quadratische Kacheln, die mit der
Fensterbreite mitschrumpfen; die Spaltenzahl ändert sich nie.

Der Breitenvertrag — er ersetzt den heutigen in `guards.ts`:

```
Kachelkante = (Panelbreite − 2×Polsterung − 9×Lücke) / 10
Mindestkante = 44 px
Lücke = 6 px, Polsterung = 9 px
```

Bei 1280 px Fensterbreite und 6 Navischaltflächen bleiben rund 860 px für das Panel →
**78 px** Kachel. Unterschreitet die Rechnung 44 px, bricht die Navileiste **unter** das
Panel um (die Medienabfrage dafür existiert bereits in `style.css`) und gibt rund 400 px
zurück. Darunter skaliert das Panel als Ganzes.

Ein leerer Platz ist ein sichtbar leerer Platz und keine Lücke — er zeigt, dass das Fenster
noch Raum hat. Das Raster ist zugleich eine **Fessel für den Inhalt**: Wer ein 21. Upgrade
erfinden will, muss ein anderes streichen.

### 8.5 Die Leiste

Sechs Reiter, etwas weiter rechts als heute:

```
[ Base ] [ Foundation ] [ Systems 🔒 ] [ Doctrine 🔒 ] [ 🔒 ] [ Prestige ]
```

- **Die vier Upgrade-Reiter *sind* die Kampfansicht.** Wer einen wählt, sieht oben das
  Spielfeld und unten das gewählte Fenster. Der eigene *Combat*-Knopf entfällt ersatzlos —
  er wäre der Reiter „Kampfansicht ohne Upgrades".
- **Settings** wandert als Zahnrad in die Ressourcenzeile (`ui/hud.ts`). Es ist der einzige
  Bereich, den man während des Spiels nie braucht.
- **Gesperrte Fenster stehen sichtbar in der Leiste**, mit Schloss. Was man noch nicht hat,
  muss man sehen können, sonst ist das Tor keine Belohnung.
- Der `View`-Typ in `app/state.ts` wird zu
  `'base' | 'combat' | 'prestige' | 'settings'`, und **welches Fenster offen ist**, wird ein
  eigenes Feld `runtime.upgradeWindow`. Der Reiterwechsel zwischen Fenstern ist damit **kein**
  Bereichswechsel und löst keine Wanderung aus (`ui/flip.ts`) — er tauscht nur die Kacheln.

Der bisher freie Platz links unter den Symbolen verschwindet dadurch von selbst: sechs Reiter
statt fünf, und das Panel beginnt direkt daneben.

---

## 9. Die Rechenkette

### 9.1 Neue Reihenfolge

```
Grundwert × Rarität × Traits
  + Σ flache Upgrades           (alle Ziele, die auf dieses Modul passen)
  × (1 + Σ Prozent-Upgrades + Perks + Prestige)
  × (1 + Fähigkeiten) × (1 + Ereignisse)        [global,    runtime.combat]
  × (1 + Buffs)                                  [pro Modul, Bauform]
  × (1 + Overdrive)                              [pro Modul, Kampf]
```

**Flach vor Prozent** — das ist die wichtigste Zeile. Andernfalls wären die endlosen
Ein-Punkt-Upgrades im Spätspiel wertlos; so sind sie die Grundlage, die alles andere
multipliziert.

### 9.2 Was sich in `sim/stats.ts` ändert

| Funktion | Änderung |
|---|---|
| `applyUpgrades(base, module, upgrades)` | **ersetzt** durch `applyUpgrades(base, module, state)` — sammelt flache und prozentuale Beträge über alle passenden Ziele |
| `globalMultiplier(state, key)` | erweitert um die neuen `GlobalKey` |
| `maxStationHp(state)` | zusätzlich `hullPerTurret` × Zahl der Turrets und `hullPerShield` |
| `moduleStats(module, buffs, state)` | zusätzlich die Overdrive-Schicht als letzter Faktor |
| **neu** `hasRule(state, id)` | die eine Abfrage für alle Directives |
| **neu** `specialValue(state, key)` | der eine Zugriff auf alle `SpecialKey` |

`sim/combat.ts`, `sim/buffs.ts` und `sim/drones.ts` fragen ausschließlich `hasRule` und
`specialValue`. Kein `if (upgradeLevel(...) > 0)` im Kampfcode — dieselbe Regel, die
`sim/prestige.ts::isUnlocked` seit E13 durchsetzt.

### 9.3 Zwei Stellen, die eine neue Signatur brauchen

Beim Lesen des Bestands sind zwei Funktionen aufgefallen, die den Zustand heute gar nicht
kennen und ihn künftig brauchen:

- **`sim/buffs.ts::computeBuffs(station)`** kennt nur die Station. `Choir` (Buffstärke) und
  `Wide Chorus` (eine Kante weiter) brauchen die Upgrades. Die Signatur wird
  `computeBuffs(station, ctx)` mit einem schmalen Kontext `{ buffPower: number; wide: boolean }`
  — **nicht** der ganze `GameState`, damit `sim/buffs.ts` weiterhin ohne Run testbar bleibt.
  Aufrufer ist `app/view.ts`.
- **`sim/prestige.ts::towerSlots(state)`** bildet die Turmplätze allein aus Prestige-Knoten.
  `Foreman`, `Pathfinder` und `Architect` addieren dazu. Weil `station.slots` beim Prestige
  gesetzt wird, muss `buyUpgrade` bei `towerSlots` denselben Sofort-Abgleich machen, den es
  heute für `maxStationHp` schon tut (`app/actions.ts:200`).

---

## 10. Bilder

60 eigene SVGs unter `public/icons/upgrades/`, gezeichnet auf demselben 24er-Raster wie die
acht bestehenden Symbole (gleiche Strichstärke, gleiche Rundungen, gleicher Rand). Die Motive
stehen in den Tabellen von Abschnitt 5.

Die Zuordnung läuft über **eine Tabelle** in `ui/icons.ts`:

```ts
const UPGRADE_ICON: Record<string, string>   // Upgrade-Id -> Dateiname
```

Damit lässt sich ein einzelnes Bild später gegen ein gemaltes tauschen, ohne Code anzufassen —
und der Selbsttest prüft, dass zu jeder Kennung eine Datei existiert.

Die Symbole werden wie bisher **als Maske** benutzt, nicht als Bild: Die Datei liefert die
Form, die Farbe kommt aus der Palette. Ein gemaltes Bild, das später an dieselbe Stelle
tritt, braucht dann eine zweite Darstellungsart in `icon()` — das ist vorgesehen, aber nicht
Teil dieses Umbaus.

---

## 11. Die Etappen

Zehn Etappen. Jede endet mit fehlerfreiem Typecheck und grünen Selbsttests, und nach jeder
ist das Spiel spielbar — das ist die Bedingung, unter der der Umbau überhaupt in Etappen
zerfällt.

### E1 — Datenmodell ✅ erledigt

**Gebaut:**

| Datei | Was |
|---|---|
| `data/upgrades.ts` | **neu** — der Katalog: Typen, 60 Einträge in drei Listen, Zugriff |
| `data/upgrades-alt.ts` | die alte Liste, umbenannt. Sie trägt das laufende Spiel bis E2 und ist als Zwischenstand gekennzeichnet |
| `data/types.ts` | `TowerClass`, `TOWER_CLASSES` |
| `data/towers.ts` | Feld `class` an allen 13 Türmen, `towersOfClass()` |
| `data/balance.ts` | `UPGRADE_KIND_EXPONENT`, `UPGRADE_WINDOW_FACTOR`, `upgradeStepCost()` |
| `selftest/suites/catalog.ts` | **neu** — 21 Prüfungen auf den Katalog |

Zehn Importstellen zeigen jetzt auf `upgrades-alt.ts`. Die alte Datei umzubenennen statt die
neue anders zu nennen war die richtige Richtung: Am Ende soll `data/upgrades.ts` der Katalog
sein, und ein Zwischenname für genau eine Etappe ist billiger als ein falscher Name für immer.

**Abnahme erreicht:** Typecheck fehlerfrei, **612/612 Selbsttests** headless, das Spiel läuft
unverändert (Konsole und Server-Log ohne Fehler). Der Katalog wird noch von niemandem gelesen —
`sim/stats.ts` bekommt die neue Wirkungskette in E2.

**Position ist Reihenfolge.** `window` und `slot` stehen an keinem Eintrag, sondern entstehen
beim Bauen aus der Liste. Ein doppelt belegter Platz und eine Lücke im Raster sind damit keine
Fehler, die man prüfen müsste, sondern Zustände, die es nicht geben kann — die geplante
Prüfung „kein Platz doppelt" ist dadurch überflüssig geworden und misst jetzt nur noch, dass
die Plätze lückenlos von 0 bis 19 laufen.

**Zwei Fehler im Katalog hat der eigene Selbsttest gefunden**, bevor eine Zeile Spiellogik
darauf zugriff — siehe Abschnitt 13.

### E2 — Rechenkette und Kauf ✅ erledigt

**Gebaut:**

| Datei | Was |
|---|---|
| `sim/stats.ts` | `applyUpgrades` ersetzt: flach vor Prozent, `Vanguard`, die Doktrinen, `Crown`. Dazu `hasRule`, `specialValue`, `globalValue` als dünne Hüllen |
| `data/upgrades.ts` | Umkehrtabellen (Regel → Pfad), `levelOf`/`ruleActive`/`specialSum`/`globalSum`/`windowOpen`/`giftableUpgrades`, `isFactor`, Feld `requiresNode` |
| `app/actions.ts` | `upgradeBlock` mit fünf Sperrgründen, `nextUpgradeCost`, `buyUpgrade` mit drei Nachzügen |
| `sim/buffs.ts` | `computeBuffs(station, ctx)` — `Choir` und `Wide Chorus` |
| `sim/prestige.ts` | `towerSlots` zählt die mit Gold gekauften Plätze mit |
| `sim/economy.ts` | `goldPerKill`, `collectRadiusFlat` — flach vor Faktor |
| `sim/helpers.ts` | Goldsammler über `collectorLevel` statt über eine Pfadkennung |
| `ui/upgrades.ts` | Überbrückung — die neuen Upgrades kaufbar, im alten Raster |
| `selftest/suites/upgrades.ts` | neu: **Wirkungs-Suite** statt Panel-Suite |
| `selftest/guards.ts` | `upgradeGridRule` entfernt, `catalogWiringRule` neu |
| `data/upgrades-alt.ts` | **gelöscht** |

**Abnahme erreicht:** Typecheck fehlerfrei, **613/613 Selbsttests**, im Browser 20 Kacheln
mit den Preisen aus Abschnitt 3.1 (Hammerfall 6, Drumfire 24, Longsight 20, Bulkhead 8 Gold).

**Der Schnitt dieser Etappe** — wichtig für das, was folgt: E2 hat die **Kette** und den
**Kauf**. Was ein Upgrade in `run.upgrades` einträgt, wird korrekt gesammelt, summiert und
gesperrt. Was noch fehlt, sind die **Leseseiten in der Simulation**: Ob ein höherer
`chainHops` wirklich einen Blitz weiterspringen lässt, entscheidet `sim/combat.ts` — und dort
ist noch nichts angeschlossen. Von 60 Upgrades wirken damit **30 vollständig**; die anderen
30 sind kaufbar, ihre Summen stehen bereit, und niemand liest sie.

Das ist genau der Fehler, den E1 bei `Ascendant` beanstandet hat, nur größer. Er ist deshalb
**abgesichert statt notiert**: `catalogWiringRule` in `selftest/guards.ts` durchsucht `sim/`,
`app/`, `render/` und `ui/` nach jedem `SpecialKey` und jeder `RuleId` des Katalogs. Was noch
fehlt, steht in einer Ausnahmeliste — und die Regel meldet **beides**: einen neuen toten
Schlüssel, der nicht darin steht, und einen längst verdrahteten, der überflüssig darin
geblieben ist. Eine Ausnahmeliste, die man nur ergänzen und nie leeren kann, wäre in einem
Jahr eine Sammlung von Behauptungen.

### E3 — Overdrive und die Leseseiten ✅ erledigt

**Gebaut:**

| Datei | Was |
|---|---|
| `sim/overdrive.ts` | **neu** — Auslöser, Dauer, Stärke, Stapeln, Ausbreitung, `Last Stand` |
| `sim/combat.ts` | Zustand in `CombatState`, Auslöser in `applyDamage`, `critDamage`/`ashfall`/`shatterpoint`, `sympatheticDetonation`, `regenStation` |
| `sim/towers.ts` | `blastRadius`, `blastShare`, `chainHops`, `burnDuration`, `chillDuration`, `chillFactor`, `strongestBonus`, `beamRamp`, `twinBarrel`, `conduit` |
| `sim/projectiles.ts` | `sourceUid` — der Durchstich, ohne den „wer hat getötet" nicht zu beantworten ist |
| `sim/drones.ts` | `droneCount`, `droneDamage` |
| `sim/buffs.ts` | `supportNeighbourDamage` über ein neues Feld `flatDamage` am `BuffResult` |
| `sim/waves.ts` | `goldPerWave`, `resetOverdrive` beim Wellenstart |
| `sim/economy.ts` | `bossGold` |
| `sim/abilities.ts` | `ascendant` |
| `sim/stats.ts` | Overdrive als **letzte** Schicht in `moduleStats`, flach vor Prozent in `applyBuffs` |
| `render/station.ts` | pulsierender Umriss für Module im Overdrive |
| `selftest/suites/overdrive.ts` | **neu** — 18 Prüfungen |

**Abnahme erreicht:** Typecheck fehlerfrei, **631/631 Selbsttests**, und `catalogWiringRule`
läuft mit **leerer** Ausnahmeliste — jeder Sonderwert und jede Regel des Katalogs wird
gelesen. Damit wirken alle 60 Upgrades.

**Der `sourceUid`-Durchstich** war die eine Änderung, die sich nicht umgehen ließ: Der Schaden
kannte bis dahin nur sein Ziel, nie seinen Urheber. „Ein Turret, das tötet, geht in Overdrive"
ist ohne diese Auskunft nicht auszudrücken. Sie ist bewusst **freiwillig** — Verbrennung,
die Explosion eines Volatile-Elites und der Rückstrahl eines Reflektors haben keinen
Schützen, und ein Pflichtfeld zwänge dort zu einer erfundenen Antwort.

### E4 — Fenster, Tore, Voraussetzungen ✅ erledigt

Die Sperren selbst hat bereits E2 gebaut und geprüft (`upgradeBlock` mit fünf Gründen).
Offen war nur der **Reiter-Zustand**:

| Datei | Was |
|---|---|
| `app/state.ts` | `runtime.upgradeWindow` — neben `view`, nicht darin |
| `app/actions.ts` | `setUpgradeWindow` (weist gesperrte Fenster ab), `ensureOpenWindow` |

**`View` wurde nicht verkleinert**, anders als geplant. `'upgrades'` bleibt — es ist der
Bereich, in dem die **Fähigkeiten** verwaltet werden, erreichbar über die Fähigkeitenschiene.
Ihn zu streichen hätte sieben Stellen in `style.css`, `main.ts` und zwei Testsammlungen
angefasst, um einen Bereich zu entfernen, der eine eigene Aufgabe hat.

**Abnahme erreicht:** Ein gesperrtes Fenster lässt sich weder über die Leiste noch über
`setUpgradeWindow` öffnen; ein Prestige stellt den Reiter auf Fenster 1 zurück.

### E5 — Oberfläche ✅ erledigt

| Datei | Was |
|---|---|
| `ui/upgrades.ts` | **neu geschrieben** — 2×10-Raster, Kachel aus Bild und Rahmen, fünf Zustände |
| `ui/upgradetext.ts` | **neu** — Beträge mit Einheit für alle 60 Wirkungen |
| `ui/shell.ts` | sechs Reiter; ein Fensterwechsel ist **kein** Bereichswechsel |
| `ui/hud.ts` | Zahnrad am rechten Ende der Ressourcenzeile |
| `core/format.ts` | `formatInt` |
| `style.css` | Raster, Rahmenzustände, Reiter mit Schloss — die alten Gruppenregeln entfallen |
| `selftest/guards.ts` | `upgradeTileRule` — der Nachfolger der in E2 entfallenen Regel |

**Der Tooltip zeigt den Zuwachs, nicht den Endwert.** Der Endwert wäre ehrlicher gewesen und
war es im alten Menü auch („467 HP") — aber er ist nur dort zu bilden, wo genau *ein* Wert
gemeint ist. „Alle Kinetic-Türme +4 %" hat keinen Endwert, sondern je Turm einen anderen. Ein
Hinweis, der bei einem Drittel der Kacheln eine Zeile weglässt, ist schlechter als einer, der
überall dasselbe sagt.

### E6 — Bilder ✅ erledigt

60 SVGs in `public/icons/upgrades/`, gezeichnet auf demselben 24er-Raster wie die
bestehenden Symbole (`fill="none" stroke-width="2"`, runde Enden). Sie werden als **Maske**
benutzt — die Datei liefert die Form, die Farbe kommt aus dem Zustand der Kachel. Damit
trägt eine gesperrte Kachel dieselbe Zeichnung wie eine kaufbare, nur als Schattenriss, und
man erkennt sie wieder, sobald sie aufgeht.

`upgradeIconRule` in `selftest/guards.ts` prüft, dass zu jeder Kennung eine Datei existiert:
Seit auf der Kachel nichts als das Bild steht, sieht ein fehlendes aus wie ein **freier
Platz** — der Fehler wäre nicht bloß hässlich, sondern irreführend.

**Abnahme erreicht:** Typecheck fehlerfrei, **633/633 Selbsttests**, im Browser 20
quadratische Kacheln zu 75 px, alle 60 Bilder mit 200 geladen, Tooltip vollständig, gesperrte
Reiter reagieren nicht.
### E7 — Perks, Händler und Prestige anschließen ✅ erledigt

| System | Was daraus wurde |
|---|---|
| **Perks** | `PerkEffect` **ist** jetzt `UpgradeEffect`. Ein Kampfwert-Perk zielt auf `modules` — Kern und Turrets zugleich. Dafür kam ein neues Ziel in die Union; mit der alten Perk-Form war „alle Module" gar nicht ausdrückbar. |
| **Händler** | `TraderOffer` trägt ein `upgradeId`, gewürfelt **beim Landen**. Die Karte nennt das Upgrade beim Namen („3x Bulkhead") statt „eine Stufe auf einem Stations-Upgrade". Ist gerade nichts zu verschenken, fällt der Posten aus dem Sortiment. |
| **Prestige-Baum** | `PrestigeNode` bekam ein **optionales** `effect`. `prestigeGlobalBonus` ist damit eine Schleife über die Daten statt einer Kette von `if`s mit doppelt gepflegten Zahlen. |

**Der Prestige-Baum wurde bewusst nur teilweise umgestellt.** Das Feld ist optional, und das
ist die Aussage: Die große Mehrheit seiner Knoten hebt gar keine Zahl, sondern *schaltet
frei* — eine Turmart, eine Seltenheitsstufe, ein Spieltempo, einen Helfer. Das sind reine
Datenabfragen (`isUnlocked`), und ein erfundener Effekt daneben würde nur behaupten, sie
seien dasselbe wie ein Goldbonus. Vier Knoten haben einen Effekt, zwanzig nicht.

> Der Goldsammler war der Sonderfall dieser Etappe — er ist bereits in **E2** gelöst worden,
> weil er dort ohne Katalogplatz unkaufbar geworden wäre (siehe die Fundtabelle zu E2).

### E8 — Spielstand ✅ erledigt

`SAVE_VERSION` steht auf **9**, mit einer Migration `8 → 9`. Sie ist die erste, die etwas
**wegnimmt**: Die gekauften Upgrades werden vollständig verworfen. Eine Umrechnung wäre eine
Schätzung — `core.damage` verteilt sich auf `Hammerfall` und `Overclock`, die verschieden
wirken und verschieden viel kosten. Sie stehenzulassen wäre schlimmer gewesen:
`applyUpgrades` ignoriert unbekannte Pfade, sie würden also mitgespeichert, nichts bewirken
und beim nächsten Blick in den Spielstand wie ein Fehler aussehen.

Alles andere bleibt: Prestigepunkte, Freischaltungen, Statistik, Station, Inventar, Level und
Perks. Dazu bekommt eine liegende Händlerware ihr leeres `upgradeId`.

### E9 — Selbsttests ✅ erledigt

Die Prüfungen sind über die Etappen entstanden, in denen sie gebraucht wurden — jede dort, wo
sie etwas absichert, statt gesammelt am Ende:

| Wo | Was |
|---|---|
| `suites/catalog.ts` (E1) | 21 Prüfungen auf den Katalog: Namen, Bilder, Arten, Ziele, Voraussetzungen, Tore, Preise, Form der Wirkung |
| `suites/upgrades.ts` (E2, E9) | Kauf und Sperren; **jedes** der 60 Upgrades bewegt die Größe, die es verspricht; flach vor Prozent; Prestige nimmt Fenster zurück; Perk, Knoten und Upgrade addieren sich |
| `suites/overdrive.ts` (E3) | 18 Prüfungen, darunter die drei Grenzen (Deckel, Dämpfung, einmal je Welle) |
| `suites/save.ts` (E8) | die Migration nimmt nur die Upgrades und lässt alles andere stehen |
| `suites/encounters.ts` (E7) | die Händlerware liefert **das benannte** Upgrade |
| `guards.ts` (E2, E6) | jeder Sonderwert und jede Regel wird gelesen; jede Kachel hat ihr Bild; die Kachel bleibt ≥ 44 px |

**Entfallen ersatzlos:** alle Prüfungen zu `largestUpgradeGroup`, `upgradeGroupSizes` und
`VALUE_BUDGET_CHARS` — es gibt keine Gruppen mehr und keinen Wert auf der Kachel.

**Stand: 638 Selbsttests**, headless alle grün; im Browser 633 von 638 (die fünf bekannten
`app/settings`-Fehler aus dem localStorage-Fund, ohne Bezug zum Umbau).

### E10 — GDD nachziehen ✅ erledigt

| Kapitel | Was daraus wurde |
|---|---|
| **08** §5–§8 | Neu geschrieben: vier Arten, Core/Turret/Klassen, die Regel *flach / Prozent / Faktor*, Overdrive, die neue Kostenformel mit Steigung je Art, die vier Fenster samt Toren und Sperren |
| **14** §5 | Neuer Abschnitt **§5a** — die Aussage „Innerhalb eines Runs schaltet nichts frei" ist eingeschränkt und begründet. §7 nennt die Ausnahme jetzt ausdrücklich |
| **13** §6 | Das Upgrade-Menü neu: Raster, Kachel ohne Text, fünf Rahmenzustände, der Hinweis samt Beispiel, die sechs Reiter |
| **05** §3 | In **3.1 Kategorie** (Kampfregel) und **3.2 Klasse** (Spielervokabel) geteilt, mit der ausgeschriebenen Begründung, warum beide nicht deckungsgleich sind |
| **09** §4 | Die Gegenüberstellung Perk/Upgrade stimmt wieder — und hält fest, dass beide seit E7 dieselbe Form benutzen |

**Die Abschnittsnummern sind absichtlich erhalten geblieben**: `5.2` heißt weiterhin
„Turm-Upgrades gelten pro Turmtyp", `6` weiterhin „Kosten", `8` weiterhin „Verfügbarkeit".
Ein Dutzend Verweise aus dem Code zeigen darauf, und eine Umnummerierung hätte sie stumm
falsch werden lassen — der einzige veraltete Verweis (`sim/economy.ts` auf §5.3) ist
mitgezogen.

### E10 — ursprünglicher Plan

Siehe Abschnitt 12.

---

## 12. Änderungen am GDD

| Kapitel | Was sich ändert |
|---|---|
| **08** §5–§8 | „Das Upgrade-System" wird neu geschrieben: vier Arten statt drei Kategorien, die Regel *flach / Prozent / Faktor*, die vier Fenster, die Tore, die neue Kostenformel |
| **14** §5 | Die Aussage „Innerhalb eines Runs schaltet nichts frei" wird eingeschränkt und begründet (Abschnitt 4.2). Der Prestige-Baum bleibt das Einzige, was **über** einen Run hinaus wirkt |
| **13** §6 | Das Upgrade-Panel: 2×10-Raster, Kachel ohne Text, fünf Rahmenzustände, sechs Reiter, Settings in der Ressourcenzeile |
| **05** | Turmklassen (Kinetic / Elemental / Support) als Spielervokabel, ausdrücklich abgegrenzt von `category` |
| **09** | Perks, sobald E7 ihre Darstellung ändert |

---

## 13. Was gegenüber Fassung 1 korrigiert ist

Der Vollständigkeit halber, weil Fassung 1 bereits gelesen wurde:

| Fassung 1 | Korrektur |
|---|---|
| „57 Upgrades, drei freie Plätze" — die Tabellen ergaben 59 | **60**, alle drei Fenster voll belegt |
| Fenster 3 hatte ein Tor auf Platz 20 | Es gibt kein `Fourth Array`; Platz 20 trägt `Tribute` |
| Overdrive sollte in `applyTimed` einfließen | Geht nicht — er wirkt **pro Modul**. Er sitzt jetzt in `moduleStats` als letzte Schicht (6.4) |
| `computeBuffs` wurde als unverändert angenommen | Braucht eine neue Signatur, sonst wirken `Choir` und `Wide Chorus` nicht (9.3) |
| Turmplätze als einfaches `global`-Upgrade | `towerSlots` kommt aus dem Prestige-Baum und braucht einen Sofort-Abgleich wie `maxStationHp` (9.3) |
| „Kostenkurve `Lv^1,15`" pauschal | Vier Kurven, eine je Art, plus Fensterfaktor (3.1) |
| Prozent-Anteil unklar | Drei Formen sauber getrennt; **4** echte Gruppen-Prozente von 60 (3.2) |
| Texte als Schlüssel in `data/strings.ts` | Sie stehen im Datensatz — wie bei Perks, Händler und Prestige (7.1) |

### Was beim Bauen von E1 aufgefallen ist

| Fund | Wie er auffiel | Korrektur |
|---|---|---|
| **`Ascendant` war „+1 ability slot"** | Prüfung „Directives ändern eine Regel" | Ein Slot ist ein Betrag, kein Regelwechsel — es wäre ein Ausbau mit einer Stufe gewesen. Schlimmer: Fähigkeiten-Slots sind bei drei gedeckelt und werden bereits vom Prestige-Baum vergeben (`towers.ability2/3`); wer beide Knoten hat, hätte hier Gold für nichts ausgegeben. `Ascendant` halbiert jetzt die Abklingzeiten — wirkt immer und auf das, was der Spieler ohnehin ausgesucht hat. `abilitySlots` fällt als `GlobalKey` weg. |
| **Die Bilanz „43 ganze Zahlen"** | Prüfung „die meisten Upgrades tragen eine ganze Zahl" schlug fehl (25 von 60) | Die Prüfung selbst war falsch gestellt, nicht der Katalog — siehe den Kasten in 3.2. Ersetzt durch `isFactor()`, das ab E2 und E5 ohnehin gebraucht wird. |
| **Zwei tote Ziel-Konstanten** | beim Schreiben | `turrets` und die Klasse `support` werden vom Katalog nicht gebraucht: Support-Module haben `NO_STATS`, ein Schadenszuschlag auf sie wäre null mal einem Aufschlag. Was sie stärker macht, sind Sonderwerte ohne Ziel. Die Union kennt beide Fälle weiterhin — Perks brauchen `turrets` in E7. |
| **Fünf rote Tests im Browser** | Browser-Lauf über `?selftest` | **Nicht vom Umbau.** `fakeStorage()` in `selftest/suites/mixer.ts:48` setzt `globalThis.localStorage` per Zuweisung; im Browser ist das ein Getter, die Attrappe greift nicht. Headless grün, Browser rot — als eigene Aufgabe ausgelagert. |

### Was beim Bauen von E2 aufgefallen ist

| Fund | Wie er auffiel | Korrektur |
|---|---|---|
| **Der Goldsammler war nicht mehr kaufbar** | rote Tests in `sim/helpers` | Er hing am alten Pfad `global.collector`, den der Katalog nicht kennt — der Prestige-Knoten `helper.collector` für 500 Punkte wäre wertlos gewesen. Er hat jetzt einen Platz in Fenster 2 und ein neues Feld `requiresNode`, das ihn hinter seinem Knoten hält. Er ersetzt `Ember Keeper`: Zwei Upgrades für den Flame Projector in einem Fenster waren die schwächere Verwendung des Platzes. Der Schlüssel `burnDps` entfällt. |
| **Drohender Importzyklus** | beim Verdrahten von `towerSlots` | `sim/stats.ts` zieht die Prestige-Faktoren aus `sim/prestige.ts`; hätte diese für die Turmplätze `globalValue` zurückgezogen, wäre ein Kreis entstanden. Gelöst, ohne acht Importe umzuschreiben: Die Summen nehmen die **Upgrade-Tabelle** statt des `GameState` und liegen deshalb in `data/upgrades.ts`; `sim/stats.ts` legt nur eine dünne Hülle darüber. |
| **Ein Kauf zog die Buffs nicht nach** | eigene Prüfung | Die Stationssicht hängt an `runtime.revision`. Seit `Choir` und `Wide Chorus` die Buffs verändern, muss `buyUpgrade` sie ungültig machen — sonst zeigte ein gekaufter Buff erst Wirkung, wenn das nächste Modul gesetzt wird. |
| **`upgradeGridRule` musste ersatzlos fallen** | Typecheck | Der aufwendigste Wächter des Projekts rechnete Kachelbreiten gegen ein Wertfeld, das es nicht mehr gibt. Die Lücke steht als Kommentar an seiner Stelle, samt der Rechnung, die ihn in E5 ersetzt — nach seiner eigenen Lehre: „Ein Wächter, der den schlimmsten Fall nicht kennt, ist schlimmer als keiner." |
| **Ein Testfehler, kein Codefehler** | `Choir` wirkte scheinbar nicht | Der Testaufbau hängt jedes Modul an eine freie Kante des **Kerns**. Verstärker und Autocannon sind damit beide Nachbarn des Kerns, aber nicht Nachbarn voneinander — sie teilen keine Kante, und genau daran hängt der Buff (GDD 03 §9). Gemessen wird jetzt am Kern. |

### Was beim Bauen von E3 aufgefallen ist

| Fund | Wie er auffiel | Korrektur |
|---|---|---|
| **`Field Repair` war wirkungslos** | beim Suchen der Leseseite | „Die Hülle flickt sich zwischen zwei Wellen" — aber `healStationFull` in `sim/waves.ts` setzt sie nach **jeder** Welle auf den Höchstwert, auch nach einer verlorenen. Es gab schlicht keinen Augenblick, in dem die Reparatur etwas zu tun gehabt hätte. Jetzt ist es eine laufende Regeneration im Gefecht (`hullRegen`), und damit wirkt sie dort, wo es zählt: gegen angedockte Gegner. |
| **Der Schaden kannte seinen Urheber nicht** | beim Bau des Kill-Auslösers | `applyDamage` trug nur Ziel und Betrag. Ein `sourceUid` musste durch `ProjectileSpec`, `Projectile` und `DamageFlags` gezogen werden — die einzige nicht umgehbare Strukturänderung dieser Etappe. |
| **`Relay` passte in keine Schicht** | beim Verdrahten | Es gibt einen **festen** Schadenszuschlag über die Nachbarschaft; `BuffResult.applied` trägt aber Anteile. Ein eigenes Feld `flatDamage` löst das, und `applyBuffs` rechnet jetzt `(Wert + flach) × (1 + Anteile)` — dieselbe Reihenfolge wie die große Kette. |
| **Zwei Testfehler, kein Codefehler** | rote Overdrive-Tests | Erstens kaufte der Test-Helfer Voraussetzungen doppelt (ein Directive hat eine Stufe, der zweite Kauf schlägt fehl). Zweitens setzte er die Hülle **vor** den Käufen — und `buyUpgrade` zieht `maxStationHp` korrekt nach, wodurch die Testwerte überschrieben wurden. Beides im Test behoben. |

---

## 14. Risiken

Der Reihe nach, wie sie wahrscheinlich zuschlagen:

1. **E7 ist die gefährliche Etappe.** Perks, Händler und Prestige greifen an sieben Stellen
   in dieselben Werte. Wenn etwas an diesem Umbau kippt, dann dort — deshalb steht sie hinter
   allem, was ohne sie schon läuft.
2. **Die Preise der Tore sind geraten.** 800 und 4.800 Gold sind an der heutigen Goldkurve
   geschätzt, nicht gemessen. Fällt `Second Array` erst nach Welle 40, ist Fenster 2 für die
   meisten Runs nicht vorhanden — und der halbe Umbau unsichtbar.
3. **Overdrive kann zu selten oder zu oft sein.** 5 % Grundchance ist ein Startwert. Zu
   selten heißt unsichtbar, zu oft heißt dauerhaft — und dann ist es kein Zustand, sondern
   ein Bonus.
4. **20 Kacheln können zu viele sein.** Es kann gut sein, dass 16 größere sich besser lesen.
   Das entscheidet der erste Blick auf das gebaute Panel, nicht diese Tabelle.
5. **Die Startwerte für 60 Upgrades sind eine große ungeprüfte Fläche.** Kein Selbsttest kann
   „fühlt sich richtig an" prüfen. Nach E5 gespielt zu werden ist deshalb kein Vorschlag,
   sondern Teil des Plans.

---

### Was beim Bauen von E4–E6 aufgefallen ist

| Fund | Wie er auffiel | Korrektur |
|---|---|---|
| **Zehn Spalten passen nicht immer** | `upgradeTileRule` | Bei 320 px Fensterbreite wäre die Kachel 21 px gewesen, bei 781 px noch 24 px — die Navileiste nimmt dem Panel rund 470 px. Unter 1000 px bricht das Raster jetzt auf **fünf Spalten und vier Reihen** um. Die Vorgabe „zwei Reihen" ist eine Aussage über den Schreibtisch; was bleibt, ist die eigentliche Zusage: alle zwanzig gleichzeitig sichtbar, nirgends gerollt. |
| **Das Raster fiel auf 54 px zusammen** | Messung im Browser | Ein Flex-Kind nimmt sich nur seine Inhaltsbreite, und die eines Rasters aus lauter `1fr` ist **null** — die Spalten haben keine eigene Größe, sie teilen nur auf, was da ist. Ohne `width: 100%` blieben von 842 px Panel genau die neun Lücken übrig. Am Typecheck und an allen Tests vorbei; nur im Browser zu sehen. |
| **Ein Klassenname als Spielertext** | `textRule` | Durch einen Zeilenumbruch stand `nav-button nav-` ohne `className` in seiner Zeile, und die Heuristik prüft je Zeile. In eine Zeile gezogen. |
| **Die Einstellungen waren unerreichbar** | beim Umbau der Leiste | Der Reiter war weg, das Zahnrad noch nicht da. Es sitzt jetzt am rechten Ende der Ressourcenzeile — hinter den drei Zahlen, weil die Reihenfolge dort die des Fortschritts ist und Einstellungen keiner sind. |

### Was beim Bauen von E7–E9 aufgefallen ist

| Fund | Wie er auffiel | Korrektur |
|---|---|---|
| **Perks konnten „alle Module" nicht ausdrücken** | beim Umstellen auf die Union | `UpgradeTarget` kannte `core` und `turrets` einzeln, aber nichts für beides. Ein neues Ziel `modules` löst das — und es ist bewusst **nur** für Perks: Ein Kaufpfad, der alles trifft, wäre die eine Kachel, die jede andere überflüssig macht. |
| **Die Händlerkarte konnte nichts versprechen** | beim Lesen von `applyPurchase` | Gewürfelt wurde erst beim **Kauf**; auf der Karte stand „eine Stufe auf einem Stations-Upgrade", und man erfuhr erst hinterher, welche. Jetzt steht das Upgrade beim Landen fest — dieselbe Bauweise, die `perkId` seit E16 hat. |
| **Der Prestige-Baum trug seine Zahlen doppelt** | beim Umstellen | `prestigeGlobalBonus` hatte für jeden Goldknoten eine eigene Zeile mit *seiner* Zahl — die Zahl also zweimal, in `data/` und in `sim/`. Ein fünfter Goldknoten wäre zwei Änderungen gewesen, und die zweite konnte man vergessen: gekauft, sichtbar, wirkungslos. |

## 15. Offen — bewusst nicht entschieden

- **Der zweite dynamische Zustand.** Vorgesehen für Fenster 4, noch nicht entworfen. Er
  sollte anders gebaut sein als Overdrive (der ist rein positiv und turmweit) — etwa ein
  Stationswert mit einer Kehrseite.
- **Ob der Goldsammler in Fenster 2 bleibt** oder einen eigenen Platz bekommt (E7).
- **Ob Directives eine eigene Kachelgröße verdienen.** Sie sind die einzigen Upgrades, die
  eine Regel ändern; eine doppelt breite Kachel wäre ehrlich, bricht aber das 2×10-Raster.
- **Wie hoch das Panel auf schmalen Fenstern sein darf.** Bei 900 px Breite steht es in vier
  Reihen und wird 373 px hoch — bei 760 px Fensterhöhe ist das die halbe Ansicht. Auf
  Desktop-Breite sind es 176 px. Solange alle zwanzig Kacheln sichtbar bleiben sollen, gibt
  es dazu keine bessere Lösung als eine kleinere Kachel; ob die den Bildern noch gerecht
  wird, entscheidet der Blick.
