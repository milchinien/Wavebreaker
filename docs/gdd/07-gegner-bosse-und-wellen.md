# 07 – Gegner, Bosse und Wellen

> Teil 7 von 16 der Game-Design-Dokumentation.

---

## 1. Ziel des Gegner-Systems

Gegner sind nicht nur Hindernisse. Jede Gegnerart soll den Spieler zwingen, seinen Build anzupassen.

Der Spieler soll **nicht** denken: *"Ich brauche einfach mehr Schaden."*
Sondern: *"Mein aktueller Build hat eine Schwäche."*

| Bedrohung | Antwort |
|---|---|
| viele schnelle Gegner | mehr Angriffstempo, mehr Reichweite |
| viele Tanks | mehr Einzelziel-Schaden |
| große Gruppen | Flächenschaden |
| Schilde | hohe Einzelangriffe, Durchschuss |

**Grundsatz:** Neue Gegnermechaniken sind wichtiger als reine Zahlen.

---

## 2. Spawn und Angriffsverhalten

### Spawn: rundum

Gegner erscheinen auf einem **Ring rund um die Station** — aus allen Richtungen, nicht aus festen Korridoren. Sie bewegen sich automatisch auf die Station zu.

Daraus folgt: Die Station muss in alle Richtungen verteidigt werden. Wo ein Turm steht, bestimmt, welche Seite er gut abdeckt (→ [05, Abschnitt 4](05-turm-system-und-turmtypen.md)).

### Spawn-Takt: gestaffelt

Die Gegner einer Welle erscheinen **nicht auf einmal**, sondern strömen in kurzen Abständen nach, bis das Kontingent der Welle aufgebraucht ist.

| Eigenschaft | Regel |
|---|---|
| Verteilung | gleichmäßig über die Welle, mit zufälliger Position auf dem Ring |
| Abstand | kurz — es soll nie Leerlauf entstehen |
| Ende der Welle | wenn alle gespawnten Gegner zerstört sind (→ Abschnitt 9) |

**Warum gestaffelt:** Erschiene die ganze Welle auf einmal, wären Flächenschaden-Türme unverhältnismäßig stark und der Kampf bestünde aus Stillstand und plötzlichen Massen. Der stetige Zustrom hält den Kampf lesbar und macht Einzelziel- wie Flächenschaden gleichermaßen sinnvoll.

Ein Boss erscheint direkt zu Beginn seiner Welle, während die normalen Gegner weiter nachströmen.

### Angriff: Gegner bleiben und schlagen weiter

Erreicht ein Gegner die Station, **bleibt er dort stehen und verursacht fortlaufend Schaden**, bis er getötet wird. Er verschwindet nicht nach einem einmaligen Treffer.

| | Bedeutung |
|---|---|
| Schadensquelle | Kontakt an der äußersten erreichten Stelle der Station |
| Schadensziel | immer die gemeinsame **Stations-HP** → [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md) |
| Modulverlust | keiner — Module gehen nie kaputt |
| Dauer | bis der Gegner zerstört ist |

**Konsequenz für das Balancing:** Durchgekommene Gegner sammeln sich an und der Schaden pro Sekunde steigt, solange sie leben. Das erzeugt echten Druck und sichtbare Krisenmomente — kann aber zu Todesspiralen führen, wenn zu viele gleichzeitig andocken.

Gegensteuernde Mechaniken, die deshalb wichtig sind:

- Türme greifen **angedockte Gegner bevorzugt** an (sie sind das nächste Ziel und stehen still)
- Flächenschaden wird gegen Ansammlungen an der Station besonders wertvoll
- Verlangsamung und Kontrolle (Tesla, Zeitverzerrung) verhindern, dass viele gleichzeitig ankommen
- die volle Heilung nach jeder Welle (Abschnitt 11) verhindert, dass sich Schaden über den ganzen Run aufstaut

---

## 3. Visuelle Identität

Gegner erscheinen am äußeren Rand der Arena und bewegen sich automatisch auf die Station zu.

Der Spieler soll **ohne Text** erkennen, was auf ihn zukommt. Form, Farbe, Größe und Bewegung zeigen die Rolle.

### Farbcode

| Farbe | Bedeutung |
|---|---|
| Rot | normale, aggressive Gegner |
| Gelb | schnelle Gegner |
| Blau | Energie- und Schildgegner |
| Grün | Heil- und Giftgegner |
| Violett | Spezialgegner |
| Orange | Schwarm- und Elite-Gegner |
| Gold | seltene Belohnungsgegner |
| Silber | Reflektoren |

Regeln: Jeder Gegnertyp hat eine feste Farbe, Farben ändern sich nicht zufällig, seltene Gegner erhalten zusätzliche Effekte.

Bei starken Gegnern ist ein Lebensbalken sichtbar. Beim Hover erscheinen Name, HP, Eigenschaften und Schwächen.

---

## 4. Standard-Gegner

Basiswerte (Standard-Gegner = 100 %):

| Gegner | Form | Farbe | HP | Tempo | Belohnung |
|---|---|---|---|---|---|
| **Standard-Drohne** | Quadrat | Rot | 100 % | normal | Standard |
| **Runner / Sprint-Drohne** | kleines Quadrat | Gelb | 40 % | 200 % | normal |
| **Heavy Unit / Tank** | Hexagon | Dunkelrot | 500 % | 50 % | erhöht |
| **Swarm Unit** | kleines Dreieck / Quadrat | Orange | 20 % | normal | pro Einheit gering, hohe Anzahl |

**Standard-Drohne** – Grundgegner, erzeugt den Grunddruck jeder Welle.
**Runner** – testet Angriffsgeschwindigkeit, Reichweite und schnelle Zielerfassung.
**Heavy Unit** – testet hohen Schaden, Durchschuss und Boss-Schaden.
**Swarm Unit** – testet Flächenschaden (Explosion, Tesla, Mehrfachschüsse).

Gold-Richtwerte auf Welle 1: normaler Gegner 5 Gold, schneller Gegner 7 Gold, Tank 25 Gold, Spezialgegner 50–100 Gold, Boss 500+ Gold. Alle Werte skalieren mit der Welle.

---

## 5. Spezialgegner

Spezialgegner werden mit höheren Wellenabschnitten eingeführt und verändern die Spielweise.

| Gegner | Form / Farbe | Eigenschaft | Konter |
|---|---|---|---|
| **Schild-Einheit** | Hexagon, Blau | Energieschild reduziert Schaden | hohe Einzelangriffe, Laser, Durchschuss |
| **Heiler** | Kreis, Grün | heilt andere Gegner | zuerst töten, hoher Fokus-Schaden |
| **Tarn-Einheit** | Dreieck/verzerrtes Polygon, Violett | zeitweise unsichtbar | größere Reichweite, Erkennungssysteme |
| **Teleporter** | Raute/Dreieck, Violett-Blau | überspringt kurze Distanzen | Burst-Schaden, Flächenschaden |
| **Spawner / Beschwörer** | großes Quadrat, Orange | erzeugt zusätzliche Gegner | Flächenschaden |
| **Reflektor** | Hexagon, Silber | reflektiert einen Teil des Schadens | unterschiedliche Schadensarten |
| **Verstärker** | Pentagon, Gelb-Grün | stärkt andere Gegner (HP, Tempo, Schaden) | Priorität ausschalten |
| **Berserker** | großes Dreieck, Rot-Schwarz | wird stärker, je weniger HP er hat | schneller hoher Burst-Schaden |
| **Flieger** | Dreieck | bewegt sich unabhängig vom Boden | spezielle Türme |

### Belohnungsgegner

| Gegner | Aussehen | Eigenschaft |
|---|---|---|
| **Ressourcen-Gegner** | normale Form, goldene Neon-Umrandung | erhöhte HP, sehr viel Gold |
| **Erfahrungs-Kern** | leuchtender Kern, Hellblau | weniger HP, sehr viel XP |

---

## 6. Elite-Gegner

Elite-Gegner sind verstärkte Varianten normaler Gegner. Sie erscheinen innerhalb normaler Wellen und sind **keine Bosse**.

Sie besitzen mehr HP, besondere Effekte und bessere Belohnungen.

### Entstehung

**Jeder normale Gegner kann beim Spawn zum Elite werden** — per Wahrscheinlichkeit, die mit der Wellennummer steigt.

| Wellenbereich | Elite-Chance (Richtwert) |
|---|---|
| vor Welle 50 | 0 % — Elites sind noch nicht eingeführt |
| ab Welle 50 | sehr gering, erste Begegnungen |
| mittlere Wellen | steigend |
| späte Wellen | häufig, teils mehrere Modifikatoren pro Gegner |

Ein Elite behält Form und Farbe seines Grundtyps und wird durch einen zusätzlichen Neon-Effekt kenntlich gemacht — der Spieler erkennt sofort *"das ist ein verstärkter Tank"*, nicht einen neuen Gegnertyp.

> Die konkreten Prozentwerte sind Tuning-Werte → [15, Abschnitt 16](15-balancing-und-skalierung.md).

### Elite-Modifikatoren

| Modifikator | Effekt |
|---|---|
| Geschwindigkeit | +50 % Bewegung |
| Verstärkt | deutlich mehr HP |
| Regeneration | heilt sich langsam |
| Explosiv | explodiert beim Tod |
| Gold-Einheit | gibt mehr Gold |
| XP-Einheit | gibt mehr Erfahrung |

---

## 7. Boss-System

**Alle 10 Wellen erscheint ein Boss.**

Eigenschaften:

- deutlich größer, eigene Form und Farbe
- extrem hohe HP
- langsamere Bewegung
- eigene Boss-Lebensleiste mit Name, aktueller und maximaler HP

**Der Boss ersetzt die Welle nicht — er ergänzt sie.** Während des Bosskampfes erscheinen weiterhin normale Gegner. Der Spieler muss gleichzeitig Boss-Schaden verursachen, die Welle kontrollieren und überleben.

### Boss-Balance

Ein guter Boss ist sichtbar gefährlich, braucht Vorbereitung und dauert mehrere Sekunden bis Minuten — er gewinnt nicht allein durch HP. Bosse skalieren mit der Welle (mehr HP, mehr Größe, stärkere Werte).

### Boss-Belohnungen

Bosse geben deutlich **mehr Gold und XP** — aber **keine exklusiven Gegenstände** und keine direkten Prestige-Punkte. Der Vorteil ist schnellerer Fortschritt. Optional später: Chance auf seltene Versorgungskapseln.

### Boss-Beispiele

| Boss | Form | Eigenschaft | Konter |
|---|---|---|---|
| **Titan Core** | riesiges Hexagon | extrem hohe HP, langsam | Kanonen, Laser |
| **Swarm Mother** | großer Kern mit Begleitern | erzeugt kleine Gegner | Flächenschaden |
| **Plasma Destroyer / Behemoth** | großes Dreieck/Polygon | Energieschild, hoher Schaden | hoher Einzelschaden |
| **Void Entity** | schwarzer Kern | teleportiert sich | Reichweite |
| **Guardian Engine** | massive Maschine | Schildmechanik | wechselnde Schadensarten |
| **Overlord Machine** | riesige Maschine | kombiniert mehrere Effekte | angepasster Build |

---

## 8. Wellenaufbau

Eine Welle besteht aus mehreren Gegnergruppen.

```
Welle 50:
  Gruppe 1: Normale Gegner
  Gruppe 2: Schnelle Gegner
  Gruppe 3: Tank-Gegner
  Gruppe 4: Elite-Gegner
```

Struktur:

```
Welle 1–9    normale Gegner
Welle 10     Boss
Welle 11–19  normale Gegner
Welle 20     Boss
…
```

Mit steigendem Fortschritt werden mehr Gegnerarten gemischt.

---

## 9. Wann eine Welle geschafft ist

Jede Welle spawnt eine **feste, vorher berechnete Gegnermenge**. Die Welle gilt als geschafft, sobald **alle Gegner dieser Welle zerstört sind**.

- Es gibt **kein Zeitlimit**. Eine zähe Welle dauert eben länger.
- Übrig gebliebene Gegner werden **nicht** in die nächste Welle übernommen — es gibt keinen Übertrag.
- Ein aktiver Boss zählt zu den Gegnern der Welle: Solange er lebt, ist die Welle nicht abgeschlossen.
- Von Spawnern erzeugte Gegner zählen ebenfalls dazu und müssen zerstört werden.

Danach folgt die kurze Pause vor der nächsten Welle (Abschnitt 10), und die Station wird vollständig geheilt (Abschnitt 13).

> Weil eine Welle erst mit dem letzten Gegner endet, kann der Spieler nie „durchgereicht" werden: Wenn seine Verteidigung nicht ausreicht, sammeln sich die Gegner an der Station und die Welle wird verloren — das ist die klare, lesbare Niederlagebedingung.

---

## 10. Wellensteuerung

Der Spieler steuert den Wellenfortschritt über eine Anzeige **oben links** in der Kampfansicht:

```
[ (<)   LEVEL 15   (+) (>) ]
```

| Element | Funktion |
|---|---|
| `(<)` | eine Welle zurück |
| `LEVEL 15` | aktuell gespielte Welle |
| `(+)` | Auto-Wellen-Modus an/aus |
| `(>)` | eine Welle vor |

### Verhalten

**Zwischen zwei Wellen liegt immer eine kurze Pause**, bevor die neuen Gegner spawnen. Sie gibt dem Spieler Zeit zum Umbauen, Einsammeln und Reagieren.

**Auto-Wellen-Modus an:** Nach der Pause startet die nächste Welle von selbst. Das ist der Idle-Standard — das Spiel läuft weiter, auch wenn der Spieler wegschaut.

**Auto-Wellen-Modus aus:** Der Spieler startet jede Welle selbst über `(>)`. Volle Kontrolle für gezieltes Optimieren zwischen den Wellen.

**Zurückskippen** erlaubt es, bewusst auf eine niedrigere Welle zu wechseln — etwa um sicher Gold und XP zu farmen, statt an der aktuellen Grenzwelle zu scheitern.

**Vorwärtsskippen** überspringt Wellen, die der Spieler bereits sicher beherrscht.

### Belohnungsregel beim Skippen

**Belohnungen hängen immer an der aktuell gespielten Wellennummer**, niemals am erreichten Rekord.

Welle 20 gibt also immer Welle-20-Erträge — auch wenn der Spieler schon Welle 800 erreicht hat.

**Warum das wichtig ist:** Würden niedrige Wellen nach Rekordniveau ausschütten, wäre „auf eine leichte Welle zurückskippen und dort ewig farmen" die effizienteste Strategie des ganzen Spiels. Die gesamte Progression würde damit zusammenbrechen. Mit dieser Regel bleibt Zurückskippen eine **Sicherheitsoption** — nützlich, um in Ruhe aufzurüsten, aber nie besser als vorwärts zu kämpfen.

### Weitere Regeln

- **Vorwärts nur bis zur höchsten in diesem Run erreichten Welle** — kein Sprung in unerreichten Content.
- Die höchste erreichte Welle des laufenden Runs bestimmt die Prestige-Belohnung, unabhängig davon, welche Welle gerade gespielt wird.
- Auch beim Zurückskippen gelten die normalen Bossregeln: Auf Welle 20 erscheint wieder der Boss von Welle 20.

### Nach dem Prestige

**Der Wellenrekord wird beim Prestige zurückgesetzt.** Der neue Run startet bei Welle 1, und vorgeskippt werden kann nur bis zur Welle, die *in diesem Run* bereits erreicht wurde.

Ohne diese Regel wäre das Prestige-System wirkungslos: Der Spieler könnte sofort auf seine alte Grenzwelle springen und hätte den kompletten Wiederaufbau übersprungen — der aber genau der Kern der Schleife ist.

Der **persönliche Bestwert** bleibt als Statistik erhalten und wird weiterhin angezeigt. Er dient der Motivation („komme ich diesmal weiter?"), erlaubt aber kein Skippen.

Weil ein neuer Run mit permanenten Boni deutlich schneller vorankommt, fühlt sich das Wiederhochspielen nicht wie Wiederholung an, sondern wie ein spürbar schnellerer Durchlauf.

---

## 11. Einführung neuer Gegner

Neue Gegner erscheinen stufenweise, nicht alle auf einmal.

| Wellenbereich | neu eingeführt |
|---|---|
| 1–50 | Standard-Gegner, schnelle Gegner, erste Tanks |
| 50–200 | Schwärme, Schild-Einheiten, Heiler, Elite-Gegner |
| 200–500 | Tarnung, Teleporter, weitere Spezialgegner |
| 500+ | komplexe Kombinationen, Elite-Bosse, stärkere Varianten |

Beispiel für späte Wellen: Tank + Heiler + Schild + schnelle Gegner gleichzeitig.

---

## 12. Skalierung

Mit jeder Welle steigen HP, Schaden, Geschwindigkeit, Anzahl und Belohnungen.

**Grundform:** `Gegner-HP = Start-HP × (1 + Wellenfaktor)`

Die Skalierung ist bewusst **nicht linear** — lineare Steigerung würde in späteren Wellen zu langsam wirken. Frühe Wellen steigen langsam, mittlere deutlich, das Endgame extrem.

> Der konkrete Wellenfaktor ist noch nicht festgelegt und ein zentraler Tuning-Wert.
> → [15 – Balancing und Skalierung](15-balancing-und-skalierung.md)

---

## 13. Heilung und Niederlage

**Nach jeder abgeschlossenen Welle wird die Station vollständig geheilt.** Jede Welle beginnt mit voller Stations-HP.

Damit ist jede Welle eine in sich abgeschlossene Prüfung: Schaffe ich diese Welle mit meiner aktuellen Verteidigung? Angesammelter Schaden aus früheren Wellen zieht den Run nicht langsam nach unten.

**Kein Game Over.** Scheitert der Spieler an einer Welle, beginnt **dieselbe Welle erneut** — mit voller HP. Er verliert keinen Fortschritt, sammelt weiter Gold, kauft Upgrades und verbessert seinen Build.

> Weil jede Welle voll geheilt startet, entsteht die Schwierigkeit ausschließlich aus der Frage, ob die Verteidigung den Gegnerdruck **innerhalb einer Welle** aushält. Das macht das Balancing pro Welle berechenbar und passt zum Idle-Charakter.

