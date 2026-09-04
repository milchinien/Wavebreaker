# WAVEBREAKER

**Wellenbrecher** — ein futuristisches Idle-Incremental-Verteidigungsspiel für den Browser.

Du steuerst keine Figur und keine Armee, sondern eine modulare Kampfstation. Ihr Hauptturm
kämpft von allein gegen endlose Gegnerwellen — deine Arbeit ist der Ausbau: neue Türme,
bessere Raritäten, Buff-Felder an der richtigen Stelle, dauerhafte Prestige-Upgrades. Ziel
ist die höchste erreichbare Welle und eine Station, die niemand sonst so gebaut hätte.

---

## Starten

Vorausgesetzt wird **Node 22 oder neuer** (die Selbsttests laufen als TypeScript direkt in
Node, ohne Übersetzungsschritt).

```bash
npm install
```

```bash
npm run dev
```

Das Spiel liegt dann auf `http://localhost:5173`.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Hot Reload |
| `npm run build` | Auslieferungsstand nach `dist/` bauen |
| `npm run preview` | Den gebauten Stand probelaufen lassen |
| `npm run typecheck` | TypeScript prüfen, ohne etwas zu erzeugen |
| `npm run selftest` | Die komplette Selbsttestreihe (31 Suiten) |
| `npm run itch` | Bauen und als `wavebreaker-itch.zip` für itch.io schnüren |

---

## Aufbau

Der Quellcode ist nach **Zuständigkeit** getrennt, nicht nach Feature. Die Trennung ist
keine Empfehlung, sondern wird von den Selbsttests erzwungen.

```
src/
  core/      Grundlagen: Zeit, Zufall, Geometrie, Formatierung, Ereignisse
  data/      Reine Zahlen und Texte — Türme, Balancing, Perks, Ligen, Strings
  sim/       Die Simulation: Kampf, Gegner, Wellen, Wirtschaft, Prestige
  render/    Zeichnen auf das Canvas
  ui/        Bedienoberfläche im DOM
  app/       Klammer: Zustand, Speicherstand, Klang, Einstellungen
  selftest/  31 Testsuiten
```

**Die drei Regeln, über die die Selbsttests wachen:**

1. `sim/` und `core/` fassen **kein DOM und kein Canvas** an. Die Simulation läuft ohne
   Bildschirm — nur so ist sie testbar und der Offline-Fortschritt berechenbar.
2. Zeit kommt ausschließlich aus `core/loop.ts`, Zufall ausschließlich aus `core/rng.ts`.
   Kein `Date.now()`, kein `Math.random()` irgendwo sonst — sonst wären Testläufe nicht
   wiederholbar.
3. Belohnungen entstehen an genau einer Stelle: `app/rewards.ts`.

---

## Dokumentation

Das Spiel ist vollständig beschrieben, bevor es gebaut wurde. In [`docs/gdd/`](docs/gdd/)
liegen 16 aufeinander abgestimmte Kapitel — jedes Thema wird an genau einer Stelle
definiert, alles andere verweist darauf. Einstieg über
[`docs/gdd/README.md`](docs/gdd/README.md).

Daneben:

| Datei | Inhalt |
|---|---|
| [`docs/anlagen.md`](docs/anlagen.md) | Welche Grafik und welcher Klang benutzt wird und woher er stammt |
| [`docs/politur.md`](docs/politur.md) | Die Politurschleife: Messlatte, Messweise, Stand |
| [`docs/liga-system.md`](docs/liga-system.md) | Das Ligasystem |
| [`docs/upgrade-umbau.md`](docs/upgrade-umbau.md) | Der Umbau des Upgrade-Systems |
| [`docs/implementierungsplan.md`](docs/implementierungsplan.md) | Reihenfolge der Umsetzung |

---

## Anlagen

Was das Spiel wirklich lädt, liegt zugeschnitten in [`public/`](public/) und ist im
Repository enthalten — Symbole, Rahmen, Klänge, Vorspann.

Die **Rohpakete** unter `Assets/raw` sind es **nicht**. Zwei Gründe, beide in der
[`.gitignore`](.gitignore) festgehalten: Ihre Lizenz erlaubt keine Weitergabe, und mit
3,9 GB wäre das Repository weder klonbar noch von GitHub angenommen.

Für Spielen und Entwickeln braucht man sie nicht. Nur wer die Ausschnitte **neu
zuschneiden** will, legt die Pakete selbst dort ab — welche Datei aus welcher Quelle
stammt, steht lückenlos in [`docs/anlagen.md`](docs/anlagen.md).

---

## Stand

Das Spiel läuft. Typecheck fehlerfrei, 692 von 692 Selbsttests bestanden.

Es steckt in der **Politurphase**: Die Systeme stehen, gearbeitet wird am Spielgefühl —
Klang, Bildwirkung, Rückmeldung, Kurven. Wie dabei gemessen wird, steht in
[`docs/politur.md`](docs/politur.md).

---

## Technik

TypeScript und [Vite](https://vite.dev/) — sonst nichts. Kein Framework, keine
Spiel-Engine, keine Bibliothek im Spielcode. Gezeichnet wird auf ein Canvas, die
Bedienoberfläche ist gewöhnliches DOM, bewegt wird mit eigenen Kurven und CSS.
