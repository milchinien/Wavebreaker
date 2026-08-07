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
| 02 | [tab-transition](02-tab-transition/) | Kann ein Panel, das es in zwei Bereichen gibt, beim Wechsel an seinen neuen Platz *fahren*, statt abzutreten und neu aufzufahren? | **abgeschlossen** → [Übernahme](02-tab-transition/README.md#übernahme-ins-spiel) (ohne die Bibliothek) |
