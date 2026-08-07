# Plan: Lücken schließen in WAVEBREAKER

Stand 07.08.2026. Ausgangslage: 161 Dateien aus 21 Sitzungsverläufen rekonstruiert,
40 755 Zeilen, davon 929 fehlend (2,3 %). Verteilt auf fünf Dateien plus zwei ganz
fehlende GDD-Kapitel.

## Leitgedanke

**Erst suchen, dann schreiben.** Jede Zeile, die sich aus dem Rohmaterial belegen lässt,
ist einer selbst geschriebenen vorzuziehen — auch wenn meine Fassung „besser" aussähe.
Das Ziel ist *dein* Spiel, nicht meine Auslegung davon.

Alles, was ich am Ende doch selbst schreibe, bekommt eine Markierung:

```ts
/* [REKONSTRUIERT] Nicht im Verlauf enthalten, aus Umgebung und GDD hergeleitet. */
```

So bleibt für immer unterscheidbar, was original ist und was nicht.

---

## Phase 0 — Absichern, bevor irgendetwas angefasst wird

Der Verlust ist einmal passiert; er darf nicht zweimal passieren.

1. **Git-Repo anlegen** und den jetzigen Rekonstruktionsstand als ersten Commit sichern.
   Ab da ist jede Änderung nachvollziehbar und rücknehmbar.
2. **Auf GitHub pushen** — in das bestehende, leere Repo. Damit ist der Stand aus deiner
   Wohnung heraus gesichert, und der ursprüngliche Fehler ist geheilt.
3. **Node.js installieren** (dein Schritt, LTS von nodejs.org). Ohne Node kann ich nichts
   prüfen — weder Typecheck noch die 443 Selbsttests. Alles danach hängt daran.

Reihenfolge ist Absicht: Erst sichern, dann verändern.

---

## Phase 1 — Das Rohmaterial ausschöpfen

Bevor ich eine einzige Zeile erfinde, hole ich alles aus den 7 MB Verlauf, was noch drin
steckt. Vier Quellen, die die bisherige Rekonstruktion **nicht** ausgewertet hat:

| Quelle | Was drinsteckt | Wie ich rankomme |
|---|---|---|
| `Edit`-Vorgänge | `old_string` und `new_string` sind wörtlicher Dateiinhalt | Textabgleich gegen die Lückenränder |
| Bash-Ausgaben | `cat`, `sed -n`, `grep -A/-B` haben Dateien ausgegeben | liegen schon in `_rettung\bash-ausgaben` |
| Fließtext der Antworten | Code wird in Erklärungen oft wörtlich zitiert | Codeblöcke aus den `texts` ziehen |
| Rohsuche im JSON | gezielt nach Markern der Lückenregion | z. B. `stepCrowd`, `SPIN_GAIN`, `.inventory-panel` |

**Vorgehen:** Ein Skript `_rettung\luecken-fuellen.ps1`, das für jede Lücke die
Nachbarzeilen als Suchanker nimmt und im gesamten Rohmaterial nach passenden Fundstellen
sucht. Treffer werden **vorgeschlagen, nicht automatisch eingesetzt** — ich sehe jeden
einzeln an, bevor er in die Datei geht.

Erwartung: Damit lässt sich ein spürbarer Teil der 929 Zeilen im Original wiederherstellen.
Wie groß der Teil ist, weiß ich erst danach — deshalb steht dieser Schritt vor allen
anderen.

---

## Phase 2 — Lücken schließen, nach Risiko sortiert

### 2a. `src/sim/enemies.ts` — 103 Zeilen (höchste Priorität)

Das Einzige, was echte Spiellogik betrifft. Zwei Blöcke:

**Lücke A, Zeilen 537–551 (15 Zeilen).** Eine Hilfsfunktion, deren Rumpf ab 552 sichtbar
ist: Sie läuft über `def.abilities`, prüft `'interval' in ability` und gibt das kleinste
Intervall zurück. Fehlend sind Kommentar, Signatur und die Initialisierung von `shortest`.
Das ist praktisch determiniert — die Aufrufstelle im übrigen Code legt Name und Typ fest.

**Lücke B, Zeilen 612–699 (88 Zeilen).** Das Ende von `stepEnemies` und der Anfang von
`stepCrowd` — die Physik, mit der sich Gegner gegenseitig wegdrücken und ins Trudeln
bringen. Ab Zeile 700 ist der Kern des Paarvergleichs sichtbar und benutzt `nx`, `ny`,
`force`, `shareA`, `shareB`, `a.vel`, `b.radius`, `SPIN_GAIN`. Fehlend ist also genau
das, was diese Größen herstellt: die Paarbildung, der Abstandstest gegen die Radiensumme,
die Normale der Berührung und die Massenaufteilung.

**Belege außerhalb des Codes:** GDD 07 (Gegner, Bosse und Wellen, 219 Zeilen) und sechs
Selbsttest-Suiten, die aus `sim/enemies` importieren — `combat`, `encounters`, `economy`,
`events`, `abilities`, `content`. Die Tests schreiben das erwartete Verhalten fest; sie
sind mein Prüfstein und zugleich meine beste Quelle für die Signaturen.

**Reihenfolge:** erst Lücke A (klein, sicher), dann Typecheck, dann Lücke B, dann die
sechs Suiten laufen lassen.

### 2b. `src/style.css` — 448 Zeilen

Rein optisch, kein Verhalten. Zwei Blöcke:

- **2952–3239 (288 Zeilen):** zwischen dem Ende eines Media-Query-Blocks und dem Abschnitt
  „Prestige". Dazwischen gehören nach Aufbau der Datei die Regeln für Basis, Inventar,
  Moduldetail und Shop.
- **3440–3599 (160 Zeilen):** der Rest der Einstellungen ab `.setting .chips`, danach der
  Beginn eines Media-Querys für die untere Leiste.

**Prüfstein sind deine Screenshots 4 und 5** — die zeigen den echten Stand: dunkelblaues
Feld, Kreisarena mit Sechseck-Station, vier Navi-Knöpfe unten, Panels „DEINE TÜRME",
„WELLE", „GOLD", „TURM KAUFEN". Dazu GDD 13 (UI und visuelles Design, 291 Zeilen), das die
Gestaltungsregeln schriftlich festhält. Die Klassennamen stehen ohnehin fest, weil die
`ui/`-Dateien vollständig sind und sie setzen.

Das Original *The Tower* nehme ich hier **nur als Formsprache** (Kreisarena, radiale
Wellen, Upgrade-Karten in Spalten) — nicht als Vorlage zum Nachbauen. Dein Spiel hat eine
eigene Gestaltung, und die steht im GDD.

### 2c. Dokumentation — 378 Zeilen in drei Dateien

`docs\implementierungsplan.md` (37), `prototypes\01-tower-building\README.md` (125),
`docs\gdd\15-balancing-und-skalierung.md` (216). Niedrigstes Risiko: Fehler hier brechen
nichts. Rekonstruktion aus dem umgebenden Text und aus dem Code, den sie beschreiben —
bei GDD 15 also aus den tatsächlichen Zahlen in `src/data/balance.ts`.

### 2d. GDD-Kapitel 02 und 14 — vollständig fehlend

Diese beiden wurden in **keiner** Sitzung gelesen; es gibt kein einziges Bruchstück. Ich
werde sie **nicht erfinden** — ein ausgedachtes Designdokument, das aussieht wie deins,
wäre schlimmer als eine Lücke, weil man ihm später glaubt.

Stattdessen: eine Stelle mit dem Vermerk, dass das Kapitel fehlt, und eine Liste dessen,
was der Code darüber verrät. Kapitel 14 wird in `ui/settings.ts` als „GDD 14 Abschnitt 4a"
zu den einmaligen Hinweisen zitiert, es geht also um Spielerführung. Was Kapitel 02
behandelt, sage ich erst, wenn ich einen Verweis darauf gefunden habe.

Falls du die Kapitel doch brauchst, schreiben wir sie neu — dann aber bewusst als neuen
Text, nicht als angebliche Wiederherstellung.

---

## Phase 3 — Prüfen, nicht behaupten

Erst nach diesen drei Schritten sage ich, dass etwas fertig ist:

1. `npm install` — die Abhängigkeiten stehen fest (Vite 6, TypeScript 5.7, anime.js 4.5)
2. `npm run typecheck` — muss ohne Fehler durchlaufen
3. `npm run selftest` — im Verlauf standen zuletzt **443/443 grün**. Das ist die Messlatte.
   Jeder fehlgeschlagene Test zeigt auf eine Stelle, an der meine Rekonstruktion vom
   Original abweicht — genau dafür sind sie gut.

Danach `npm run dev` und ein Blick auf das laufende Bild, verglichen mit deinen
Screenshots.

**Wenn Tests fehlschlagen, sage ich das mit der Ausgabe** — nicht „im Wesentlichen
fertig".

---

## Phase 4 — Nie wieder

Commit und Push nach GitHub. Danach richte ich dir auf Wunsch ein, dass jeder Stand
automatisch gesichert wird.

---

## Was ich nicht tue

- **Keine Verbesserungen nebenbei.** Wenn mir im rekonstruierten Code etwas auffällt,
  notiere ich es, ändere es aber nicht. Erst ist der alte Stand wiederhergestellt, dann
  reden wir über Änderungen.
- **Nichts erfinden, wo Erfundenes wie Original aussähe.** Lieber eine markierte Lücke.
- **Keine Umbenennung** von Ordnern oder Modulen, solange nicht klar ist, ob etwas darauf
  verweist.

## Offene Fragen an dich

1. **Node.js installieren** — machst du das, oder soll ich dich durch die Installation führen?
2. **GDD 02 und 14** — neu schreiben oder als fehlend markiert lassen?
3. Der Ordner heißt `Wavebreaker`, das Original lag unter `The Tower`. Soll das so bleiben?
