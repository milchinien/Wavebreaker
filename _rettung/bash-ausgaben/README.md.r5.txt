# Prototypen

Dieser Ordner enthält **isolierte Experimente** für WAVEBREAKER. Prototypen dienen dazu,
ein einzelnes Feature auszuprobieren, bevor es im eigentlichen Spiel gebaut wird.

> **Grundregel:** Nichts in diesem Ordner darf das Spiel beeinflussen — und das Spiel darf
> nichts aus diesem Ordner brauchen. Löscht man `prototypes/` komplett, muss das Spiel
> unverändert weiterlaufen.

---

## Isolationsregeln

| Regel | Bedeutung |
|---|---|
| **Kein Import aus dem Spiel** | Ein Prototyp importiert niemals aus `../src` o. ä. Braucht er Spielcode, wird er kopiert — bewusst als Kopie, nicht als Abhängigkeit. |
| **Kein Import in das Spiel** | Spielcode importiert niemals aus `prototypes/`. Übernommen wird nur durch bewusstes Portieren (siehe unten). |
| **Eigene Abhängigkeiten** | Dieser Ordner hat seine eigene `package.json`. Er teilt keine Abhängigkeiten mit dem Spielprojekt. |
| **Eigener Speicher** | Wer `localStorage` benutzt, verwendet den Präfix `proto:<ordnername>:`. Kein Prototyp fasst Spielstände an. |
| **Wegwerfcode ist erlaubt** | Prototypen müssen nicht schön, vollständig oder getestet sein. Sie müssen eine Frage beantworten. |

---

## Aufbau

```
prototypes/
├── README.md              ← diese Datei
├── package.json           ← Vite + TypeScript, gilt für alle Prototypen
├── tsconfig.json
├── vite.config.ts
├── index.html             ← Übersichtsseite mit Links zu allen Prototypen
├── _template/             ← Startvorlage für neue Prototypen (kein eigener Prototyp)
└── 01-tower-building/     ← Prototyp 1: modulares Bausystem
```

Jeder Prototyp ist ein Ordner mit `NN-kurzname/` und enthält mindestens:

| Datei | Zweck |
|---|---|
| `index.html` | Einstiegspunkt, wird von Vite direkt bedient |
| `main.ts` | Startcode |
| `README.md` | **Frage, Antwort, Ergebnis** — wofür war das Ding da, was kam raus? |

---

## Starten

Einmalig:

```bash
npm install
```

Dann:

```bash
npm run dev
```

Vite öffnet die Übersichtsseite. Von dort geht es zu den einzelnen Prototypen —
oder direkt über `http://localhost:5174/01-tower-building/`.

Typprüfung ohne Start:

```bash
npm run typecheck
```

---

## Neuen Prototypen anlegen

1. `_template/` nach `NN-kurzname/` kopieren
2. In `NN-kurzname/README.md` die **Leitfrage** eintragen, bevor Code entsteht
3. Auf `index.html` (Übersicht) einen Link ergänzen

---

## Übernahme ins Spiel

Ein Prototyp wird **nie** ins Spiel gemerged. Stattdessen:

1. Ergebnis im `README.md` des Prototyps festhalten (was funktioniert, was nicht, welche Werte)
2. Falls Regeln entschieden wurden: passendes GDD-Dokument in [`../docs/gdd/`](../docs/gdd/) aktualisieren
3. Die bewährten Teile im Spiel **neu und sauber** implementieren — mit dem Prototyp als Vorlage
4. Der Prototyp bleibt als Referenz liegen und wird nicht mehr gepflegt

---

## Vorhandene Prototypen

| Nr. | Prototyp | Leitfrage | Status |
|---|---|---|---|
| 01 | [tower-building](01-tower-building/) | Fühlt sich das Anstecken verschiedener Turmformen an den Hauptturm und aneinander gut an — und bleibt eine gewachsene Station lesbar und baubar? | **abgeschlossen** → [Ergebnis](01-tower-building/README.md#ergebnis) |
=== package.json ===
{
  "name": "wavebreaker-prototypes",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Isolierte Feature-Prototypen fuer WAVEBREAKER. Kein Teil des Spiels.",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.20.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.5"
  }
}
=== index.html ===
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WAVEBREAKER — Prototypen</title>
    <style>
      :root {
        --bg: #070b18;
        --panel: #0e1630;
        --line: #1e2a51;
        --text: #c8d4f5;
        --dim: #6b7ba6;
        --neon: #35e0ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 50% 0%, #10193a 0%, var(--bg) 60%);
        color: var(--text);
        font: 15px/1.6 "Segoe UI", system-ui, sans-serif;
        padding: 48px 24px;
      }
      main { max-width: 760px; margin: 0 auto; }
      h1 { font-size: 26px; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 4px; }
      h1 span { color: var(--neon); }
      p.sub { color: var(--dim); margin: 0 0 36px; }
      a.card {
        display: block;
        padding: 18px 20px;
        margin-bottom: 14px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s, transform 0.15s;
      }
      a.card:hover { border-color: var(--neon); transform: translateY(-2px); }
      .num { color: var(--neon); font-variant-numeric: tabular-nums; margin-right: 10px; }
      .title { font-weight: 600; }
      .desc { color: var(--dim); font-size: 13.5px; margin-top: 4px; }
      .status { float: right; font-size: 12px; color: var(--dim); border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; }
      footer { margin-top: 40px; color: var(--dim); font-size: 13px; border-top: 1px solid var(--line); padding-top: 16px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Wave<span>breaker</span> — Prototypen</h1>
      <p class="sub">Isolierte Experimente. Kein Bestandteil des Spiels.</p>

      <a class="card" href="/01-tower-building/">
        <span class="status">abgeschlossen</span>
        <div><span class="num">01</span><span class="title">Turmbau — modulares Ansteck-System</span></div>
        <div class="desc">
          Polygon-Module mit einheitlicher Seitenlänge an freie Kanten des Hauptturms und anderer Module
          anstecken. Buff-Nachbarschaft über gemeinsame Kanten, Platzieren/Verschieben/Entfernen.
        </div>
      </a>

      <footer>
        Neuen Prototypen anlegen: <code>_template/</code> kopieren, hier verlinken.
        Regeln siehe <code>prototypes/README.md</code>.
      </footer>
    </main>
  </body>
</html>
=== tree ===
01-tower-building:
PLAN.md
README.md
app.ts
buffs.ts
camera.ts
catalog.ts
devtools.ts
geometry.ts
index.html
input.ts
main.ts
model.ts
persist.ts
render.ts
selftest.ts
shapes.ts
station.ts
style.css
ui.ts

_template:
README.md
index.html
main.ts
style.css
