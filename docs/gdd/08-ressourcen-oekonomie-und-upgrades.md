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
- Turm-Upgrades
- Hauptturm-Upgrades
- globale Upgrades
- Fähigkeiten freischalten und verbessern
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

Upgrades werden mit Gold gekauft und verbessern die Basis **innerhalb eines Runs**. Es gibt drei Kategorien.

> **Wichtig:** Türme besitzen keine Level und werden nicht automatisch stärker. Jede Verbesserung ist ein bewusst gekauftes Upgrade — und wirkt auf den gesamten Turmtyp, nicht auf ein einzelnes Exemplar (siehe 5.2).

---

### 5.1 Hauptturm-Upgrades

Gelten nur für den aktuell gewählten Hauptturm.

| Upgrade | Effekt |
|---|---|
| Schaden | erhöht den Schaden aller Angriffe (z. B. Stufe 1: +5 %, Stufe 10: +50 %) |
| Angriffstempo | reduziert die Zeit zwischen Angriffen |
| Reichweite | vergrößert den Angriffsradius — Gegner werden früher bekämpft |
| Maximale HP | erhöht die Stations-HP (gemeinsame Lebensleiste) |
| Kritische Treffer | erhöht Kritchance und Kritschaden |
| Projektil-Upgrades | Anzahl, Geschwindigkeit, Durchschlagskraft |

Dazu kommen kernspezifische Spezialisierungen → [04 – Hauptturm-System](04-hauptturm-system.md)

---

### 5.2 Turm-Upgrades — pro Turmtyp

**Turm-Upgrades gelten für einen ganzen Turmtyp, nicht für einzelne Türme.**

Beispiel: *„Maschinengewehr — Schaden +10 %"* wirkt auf **alle** Maschinengewehre in der Station gleichzeitig.

| Vorteil | Wirkung |
|---|---|
| kein Mikromanagement | bei 15 Türmen bleibt das Menü überschaubar |
| klare Build-Entscheidung | in welche Turmtypen investiere ich? |
| Individualität bleibt erhalten | einzelne Türme unterscheiden sich weiterhin über Rarität und zufällige Eigenschaften |

Ein einzelner Legendary-Turm ist also nicht deshalb stark, weil er separat aufgerüstet wurde, sondern weil seine Rarität und seine Eigenschaften die typweiten Upgrades multiplizieren.

**Allgemein pro Typ:** Schaden, Angriffstempo, Reichweite.

**Spezialwerte je Turmart:**

| Turm | Spezialwerte |
|---|---|
| Maschinengewehr | Magazin, Feuerrate, Projektilanzahl |
| Kanone | Explosion, Durchschuss, kritischer Schaden |
| Laser | Laserdauer, Laserstärke, Laserbreite, Cooldown |
| Raketen | Explosionsradius, Raketenanzahl, Explosionsschaden |
| Buff-Turm | Buffstärke, Anzahl unterstützter Türme |

Vollständige Upgrade-Pfade: → [05 – Turm-System und Turmtypen](05-turm-system-und-turmtypen.md)

---

### 5.3 Globale Upgrades

Verbessern die gesamte Basis statt einzelner Türme.

| Upgrade | Effekt |
|---|---|
| Stations-HP | erhöht die maximale HP der gemeinsamen Lebensleiste → [03, Abschnitt 5](03-modulare-basis-und-bauregeln.md) |
| Gold-Bonus | Gegner lassen mehr Gold fallen |
| XP-Bonus | Gegner geben mehr Erfahrung |
| Upgrade-Kostenreduzierung | normale Upgrades werden günstiger |
| Turmkauf-Kostenreduzierung | neue Türme kosten weniger |
| Gold-Sammelradius | größere Reichweite beim Einsammeln |

---

## 6. Upgrade-Kosten

Jedes Upgrade wird mit steigender Stufe teurer.

**Formel:** `Kosten = Basiswert × Level^1,15`

Beispielkurve:

| Stufe | Kosten |
|---|---|
| 1 | 100 Gold |
| 2 | 150 Gold |
| 3 | 225 Gold |
| 4 | 340 Gold |
| 5 | ~500 Gold |

> Eine steilere Beispielkurve (100 / 250 / 700 / 2000 / 6000) taucht in früheren Entwürfen auf. Verbindlich ist die Formel `Basiswert × Level^1,15`; die genaue Kurve ist ein Tuning-Wert.

**Ziel:** frühe Verbesserungen sind häufig und günstig, späte Verbesserungen werden langfristige Investitionen.

Daraus entsteht die Entscheidung: viele kleine Verbesserungen oder wenige starke?

---

## 7. Upgrade-Maximum

Nicht jedes Upgrade ist unendlich. Viele besitzen Maximalstufen.

| Upgrade | Maximum (Richtwert) |
|---|---|
| Schaden | 100 Stufen |
| Reichweite | 50 Stufen |
| Spezialwerte | abhängig vom Turm |

---

## 8. Verfügbarkeit

Nicht alle Upgrades sind sofort verfügbar.

**Start:** Schaden, Angriffstempo, HP.
**Später:** Spezialfähigkeiten, Elementeffekte, besondere Mechaniken, Helfer-Upgrades (nur sichtbar, wenn im Prestige-Baum freigeschaltet).

---

## 9. Reset

Alle Gold-Upgrades sind **temporär**. Nach Prestige verschwinden Gold, Türme und sämtliche gekauften Upgrades. Der Spieler beginnt den nächsten Run erneut — mit besseren Grundlagen.

---

## 10. Design-Regeln für Upgrades

Upgrades sollen:

- verständlich sein
- sofort spürbare Auswirkungen haben
- langfristige Ziele bieten
- keine sinnlosen Werte besitzen

Jede Verbesserung soll dem Spieler zeigen: *"Meine Basis wird stärker."*

