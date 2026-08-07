# 06 – Turmerwerb, Inventar und Raritäten

> Teil 6 von 16 der Game-Design-Dokumentation.

---

## 1. Turmerwerb

Der Spieler kauft keine festen Türme direkt. Er kauft einen **Turmslot** und erhält dafür eine Auswahl.

```
Spieler bezahlt Gold
        ↓
2 zufällige Turmoptionen erscheinen
        ↓
Spieler wählt einen Turm
        ↓
Turm landet im Inventar
        ↓
Turm kann in der Basis platziert werden
```

### Beispiel

```
NEUER TURM ERHALTEN — Wähle einen Turm:

  Option 1                    Option 2
  Maschinengewehr             Kanone
  Common                      Rare
  Schneller Angriff           Hoher Schaden
```

Welche Türme erscheinen können, hängt ab von freigeschalteten Technologien, verfügbaren Raritäten und Prestige-Upgrades.

---

## 2. Turmkosten

Der Preis steigt nach **jedem** Kauf.

**Formel:** `Neuer Preis = Grundpreis × 1,5 pro bereits gekauftem Turm`

| Kauf | Preis |
|---|---|
| 1. Turm | 100 Gold |
| 2. Turm | 150 Gold |
| 3. Turm | 225 Gold |
| 4. Turm | 337 Gold |

> In einem früheren Entwurf war eine steilere Kurve genannt (100 / 250 / 600 / 1500). Verbindlich ist der Faktor **1,5**; die genaue Kurve ist ein Tuning-Wert.

Dadurch entsteht die Kernentscheidung:

> "Kaufe ich jetzt einen neuen Turm oder investiere ich mein Gold in meine vorhandenen Türme?"

---

## 3. Turm-Anzahl

**Zielgröße: 8–15 aktive Türme.**

Der Spieler soll keine hunderten Türme besitzen. Ein seltener Turm verändert den gesamten Build. Zusätzliche Turmplätze gibt es über den Prestige-Baum (100 Punkte pro Platz).

---

## 4. Inventar

Das Inventar befindet sich links in der Basis. **Jeder Turm wird einzeln angezeigt — es gibt keine Stapelung.**

Falsch:

```
Maschinengewehr x20
```

Richtig:

```
Turm 1:  Legendary Maschinengewehr   +20% Angriffstempo
Turm 2:  Rare Maschinengewehr        +10% Schaden
Turm 3:  Epic Laser                  +15% Reichweite
```

Jeder Eintrag zeigt: Form, Farbe/Rarität, Name, Vorschau und die individuellen Eigenschaften des Turms.

> Turm-**Upgrades** erscheinen nicht am einzelnen Turm, weil sie pro Turmtyp gekauft werden → [08, Abschnitt 5.2](08-ressourcen-oekonomie-und-upgrades.md). Was einen einzelnen Turm im Inventar unterscheidet, sind ausschließlich **Rarität und Eigenschaften**.

**Sortierung:** Rarität, Typ, Name, Stärke.
**Filter:** Common, Rare, Epic, Legendary, Mythic.

### Verwaltung

Mit einem Turm kann der Spieler: auswählen, Informationen ansehen, platzieren, verschieben, entfernen, schmelzen.

Platzieren, Verschieben und Entfernen sind **kostenlos** — freies Experimentieren ist erwünscht. Ein entfernter Turm wandert zurück ins Inventar und geht nie verloren.

> **Türme können nicht gegen Gold verkauft werden.** Der einzige Weg, überschüssige Türme loszuwerden, ist das Schmelzsystem. Damit bleibt Schmelzen die relevante Entscheidung — ein Verkauf gegen Gold würde es überflüssig machen.

---

## 5. Schmelzsystem

Schlechte oder nicht benötigte Türme werden recycelt statt wertlos zu werden.

```
3 Türme auswählen
        ↓
Schmelzen bestätigen
        ↓
2 neue Turmoptionen erscheinen (kostenlos)
        ↓
1 Turm auswählen
```

### Beispiel

| Eingesetzt | Ergebnis (Auswahl) |
|---|---|
| Common Maschinengewehr, Common Kanone, Rare Maschinengewehr | Epic Sniper **oder** Rare Laser |

---

## 6. Raritätssystem

Jeder Turm besitzt eine Rarität. Sie beeinflusst Grundwerte, mögliche Eigenschaften, Stärke der Boni und das Aussehen (Neon-Umrandung).

| Rarität | Farbe | Charakter |
|---|---|---|
| Common | Grau | Basiswerte, keine Eigenschaften |
| Rare | Grün | bessere Werte, stärkere Eigenschaften |
| Epic | Blau | deutlich bessere Werte, seltene Modifikatoren |
| Legendary | Gold | sehr starke Werte, besondere Effekte |
| Mythic | Rot | maximale Seltenheit, außergewöhnliche Effekte |

Diese Farben gelten durchgängig für Turmrahmen, Anzeigen und Auswahlfelder. Je höher die Rarität, desto stärker das Leuchten und desto aufwendiger die Animation (Common: leichter Rand; Mythic: pulsierende Neonenergie).

---

## 7. Freischaltung der Raritäten

Raritäten sind **nicht von Anfang an verfügbar**. Sie werden im Prestige-Baum freigeschaltet:

```
Common (Start) → Rare → Epic → Legendary → Mythic
```

| Freischaltung | Kosten (Prestige-Punkte) |
|---|---|
| Rare | 50 |
| Epic | 250 |
| Legendary | 1.000 |
| Mythic | 5.000 |

---

## 8. Raritäts-Wahrscheinlichkeiten

Die Chancen hängen vom Prestige-Fortschritt ab:

| Freigeschaltet bis | Common | Rare | Epic | Legendary |
|---|---|---|---|---|
| — (Start) | 100 % | — | — | — |
| Rare | 80 % | 20 % | — | — |
| Epic | 65 % | 25 % | 10 % | — |
| Legendary | 55 % | 25 % | 15 % | 5 % |

**Mythic** bleibt bewusst extrem selten und soll ein besonderes Ereignis darstellen.

---

## 9. Raritätsgrenzen je Turmtyp

Nicht jeder Turm kann jede Rarität besitzen. Spezialtürme bleiben selten.

| Turm | möglicher Bereich |
|---|---|
| Maschinengewehr | Common – Mythic |
| Kanone | Common – Legendary |
| Buff-Turm | Common – Mythic |
| Raketen, Flammen | Rare+ |
| Laser, Tesla, Schildgenerator | Epic+ |
| Drohnen-Modul, Plasma | Legendary+ |
| Void-Turm | Mythic |

---

## 10. Turm-Eigenschaften

Zusätzlich zur Rarität besitzt jeder Turm individuelle, zufällige Eigenschaften. Dadurch wird jeder Turm einzigartig.

### Beispiel: zwei Legendary-Maschinengewehre

| Turm A | Turm B |
|---|---|
| +20 % Angriffstempo | +30 % Schaden |
| +15 % Projektilgeschwindigkeit | +10 % kritische Trefferchance |

Gleicher Typ, gleiche Rarität — unterschiedliches Spielgefühl.

### Anzahl der Eigenschaften

Die Rarität bestimmt, **wie viele** zufällige Eigenschaften ein Turm besitzt:

| Rarität | Anzahl Eigenschaften |
|---|---|
| Common | **0** |
| Rare | **1** |
| Epic | **2** |
| Legendary | **3** |
| Mythic | **4** |

Ein Common-Turm ist damit die reine Basisversion des Turmtyps — ohne Zusätze. Jede Raritätsstufe fügt genau einen weiteren Eigenschaftsplatz hinzu, wodurch der Sprung zwischen den Stufen sofort spürbar und leicht vergleichbar ist.

### Stärke nach Rarität

Zusätzlich zur Anzahl steigt auch die **Qualität** der möglichen Eigenschaften:

| Rarität | typische Eigenschaften |
|---|---|
| Common | keine — nur die Basiswerte des Turmtyps |
| Rare | spürbare Boni (+10 % Schaden, +10 % Reichweite) |
| Epic | starke Boni (+20 % Schaden, +15 % Angriffstempo) |
| Legendary | Mechaniken: Projektile explodieren, +1 Durchschuss, Chance auf Spezialangriff |
| Mythic | einzigartige Effekte, veränderte Angriffe, neue Mechaniken |

Welche Qualitätsstufen überhaupt auftreten können, wird zusätzlich im Prestige-Baum freigeschaltet (Rare → Epic → Legendary → Mythic Eigenschaften). Ein Legendary-Turm mit drei Plätzen zieht also nur dann Legendary-Effekte, wenn diese Stufe freigeschaltet ist — sonst füllt er seine Plätze mit schwächeren Eigenschaften.

> Dass Common keine Eigenschaften besitzt, macht das frühe Spiel bewusst schlicht: Der Spieler lernt zuerst die Turmtypen selbst kennen, bevor mit der ersten Rare-Freischaltung die Ebene der Eigenschaften dazukommt.

### Eigenschaften nach Turmtyp

Die möglichen Eigenschaften hängen vom Turm ab:

| Turm | mögliche Eigenschaften |
|---|---|
| Maschinengewehr | Angriffstempo, Schaden, Kritchance, Projektilgeschwindigkeit, Magazingröße |
| Kanone | Schaden, Explosionsradius, Durchschlag, kritischer Schaden |
| Laser | Reichweite, Strahlbreite, Schaden, Energiekosten |
| Buff-Turm | Buffstärke, Anzahl beeinflusster Türme |

Auch die **Qualität der Eigenschaften** wird über den Prestige-Baum freigeschaltet (Rare → Epic → Legendary → Mythic Eigenschaften).

---

## 11. Reset durch Prestige

Türme, Inventar und alle Turm-Upgrades werden beim Prestige zurückgesetzt. Erhalten bleiben die freigeschalteten Raritäten, Eigenschaften und Turmtypen.
→ [10 – Prestige-System](10-prestige-system.md)
