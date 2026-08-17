# Ligensystem

> Planungsdokument, Fassung 1 vom 10.08.2026. Noch kein Code.
>
> Der Plan führt eine zweite Achse neben der Welle ein: die **Liga**. Der Spieler steigt auf,
> wenn er will, behält alles, was er hat, und beginnt in der neuen Liga bei Welle 1 gegen
> deutlich stärkere Gegner.
>
> Der Plan ändert sechs Kapitel des GDD (Abschnitt 13). Solange das nicht geschehen ist,
> widerspricht dieser Plan dem GDD und nicht umgekehrt.
>
> Alle Zahlen in diesem Dokument sind **am Modell gerechnet, nicht am Spiel gemessen**.
> Verbindlich sind die Verhältnisse, nicht die Beträge.

---

## 1. Befund

Das Spiel hat heute genau **eine** Achse, auf der es schwerer wird: die Wellennummer. Alles
andere — Prestige, Level, Upgrades — macht den Spieler stärker, nichts macht die Welt anders.
Daraus folgen drei Dinge, die alle im Code nachweisbar sind.

### 1.1 Tiefe zahlt sich schlechter aus als Breite

In `src/data/balance.ts` stehen zwei Wachstumsfaktoren nebeneinander:

```
WAVE_SCALING   = 1,10    Gegner-HP je Welle
REWARD_SCALING = 1,06    Gold je Welle
```

Gold je Lebenspunkt fällt damit mit `(1,06/1,10)^Welle = 0,964^Welle`. Bei Welle 60 bekommt
der Spieler für dieselbe verrechnete Lebensenergie **elfmal weniger** Gold als bei Welle 1.
Die Wellenkurve bestraft ihren eigenen Fortschritt.

Aufgefangen wird das heute nur dadurch, dass eine Welle mindestens
`WAVE_SPAWN_WINDOW_SECONDS = 20` Sekunden dauert und die Gegnerzahl linear wächst
(`8 + 1,5 × (Welle − 1)`). Gold **je Sekunde** steigt deshalb trotzdem — aber nur, solange
der Bau die Welle innerhalb des Fensters räumt. Danach bricht es ein.

### 1.2 Zurückskippen ist die richtige Antwort, und das ist ein Symptom

GDD 07 §9 erlaubt ausdrücklich, auf eine niedrigere Welle zurückzugehen; `canSkipTo` in
`src/sim/waves.ts` setzt es um. Das ist als Sicherheitsoption gedacht. Weil aber die
Belohnung an der gespielten Welle hängt und die Wellenkurve wie oben verläuft, ist
Zurückgehen an der Wand die einzige sinnvolle Handlung — man farmt unten, wo es sich lohnt.
Das Spiel hat damit bereits eine „wo spiele ich"-Entscheidung, nur ohne Aufstiegsseite.

### 1.3 Der gebaute Inhalt liegt hinter Wellen, die niemand erreicht

`src/data/enemies.ts` schaltet Gegner nach Wellennummer frei:

| Gegner | ab Welle | | Boss | ab Welle |
|---|---|---|---|---|
| Drone / Runner / Heavy | 1 / 3 / 8 | | Titan Core | 10 |
| Bullion / Data Core | 40 | | Swarm Mother | 50 |
| Swarm / Shielded / Healer | 50 / 55 / 70 | | Plasma Behemoth | 100 |
| Berserker / Spawner / Overseer | 90 / 120 / 150 | | Void Entity | 200 |
| Phantom / Blink / Reflector | 210 / 230 / 260 | | Overlord Machine | 400 |

Wer bei Welle 60 an die Wand läuft, sieht **sieben von vierzehn** Gegnerarten und **zwei von
fünf** Bossen. Der Rest ist gebaut und unerreichbar.

**Die Liga löst alle drei Punkte mit einem einzigen Begriff.**

---

## 2. Das Grundprinzip: die effektive Welle

> **Eine Liga entspricht einem festen Vorsprung an Wellen.**

Statt eigener Faktoren für HP, Schaden, Tempo, Gegnerauswahl, Boss und Elite bekommt die Liga
**einen** Wert: um wie viele Wellen sie die Welt vorrückt.

```
effektiveWelle(welle, liga) = welle + LEAGUE_WAVE_OFFSET × (liga − 1)
```

Alles, was heute `wave` liest, liest künftig `effectiveWave`. Damit rücken in einem Zug mit:

| Was | Funktion heute | wirkt danach |
|---|---|---|
| Gegner-HP, Schaden, Tempo, Belohnung | `scaleFor(wave, faktor)` | mit dem Ligaversatz |
| Welche Gegnerarten erscheinen | `enemiesForWave(wave)` | höhere Liga = neue Gegner |
| Welcher Boss erscheint | `bossForWave(wave)` | höhere Liga = neuer Boss |
| Elitechance | `eliteChance(wave)` | höhere Liga = früher Elite |
| Ereignis- und Kapselwert | `eventRewardFor(wave)` | zieht mit |

**Das ist der Kern dieses Plans.** Eine Liga ist keine parallele Zahlenwelt, sondern derselbe
Verlauf, weiter vorn begonnen. Sie kostet dadurch fast keinen neuen Balancingaufwand, und
der gebaute Inhalt aus 1.3 wird ohne eine Zeile neuer Gegnerdaten erreichbar.

Die Wellennummer, die der Spieler **sieht**, bleibt die kleine: In Liga 3 steht „Wave 12" da,
auch wenn intern effektiv 62 gerechnet wird. Das ist Absicht — die Wellennummer misst den
Fortschritt *innerhalb* der Liga, die Liga misst den Rest.

### 2.1 Was die Liga zusätzlich mitbringt

Wäre der Versatz alles, wäre die Liga ein reiner Sprung nach vorn ohne Grund, ihn zu machen —
man käme auch durch Weiterspielen dorthin. Deshalb gibt es **genau einen** zweiten Wert:

```
ligaBelohnung(liga) = LEAGUE_REWARD_BONUS ^ (liga − 1)
```

Er multipliziert Gold und XP **zusätzlich** zum Versatz. Er ist der einzige Grund
aufzusteigen, und weil er einzeln steht, ist er auch der einzige Wert, an dem man den Reiz
des Aufstiegs justiert.

### 2.2 Die drei Werte

| Wert | Vorschlag | Was er festlegt |
|---|---|---|
| `LEAGUE_WAVE_OFFSET` | **25** | Eine Liga = 25 Wellen Vorsprung = ×10,8 Gegner-HP |
| `LEAGUE_REWARD_BONUS` | **1,5** | Gold und XP je Liga zusätzlich ×1,5 |
| `LEAGUE_ADVANCE_WAVE` | **50** | Welle, ab der die nächste Liga freigeschaltet wird |

---

## 3. Die Kurve, durchgerechnet

Alle Goldangaben in **Vielfachen des Grundwerts eines Gegners in Liga 1, Welle 1** — es sind
Verhältnisse, keine Goldmünzen.

### 3.1 Die Ligen im Überblick

| Liga | eff. W1 | HP bei W1 | Schaden bei W1 | eff. W50 | HP bei W50 | Gold/Welle bei W1 | bei W50 |
|---|---|---|---|---|---|---|---|
| 1 | 1 | ×1 | ×1 | 50 | ×107 | 8 | 1,4k |
| 2 | 26 | ×10,8 | ×5,4 | 75 | ×1,2k | 52 | 9,2k |
| 3 | 51 | ×117 | ×29,5 | 100 | ×12,5k | 332 | 59,1k |
| 4 | 76 | ×1,3k | ×160 | 125 | ×136k | 2,1k | 380k |
| 5 | 101 | ×13,8k | ×868 | 150 | ×1,5M | 13,7k | 2,45M |
| 6 | 126 | ×149k | ×4,7k | 175 | ×15,9M | 88,5k | 15,8M |
| 7 | 151 | ×1,6M | ×25,6k | 200 | ×173M | 570k | 101M |
| 8 | 176 | ×17,5M | ×139k | 225 | ×1,87B | 3,7M | 653M |
| 9 | 201 | ×190M | ×753k | 250 | ×20,3B | 23,6M | 4,20B |
| 10 | 226 | ×2,06B | ×4,1M | 275 | ×220B | 152M | 27,1B |

### 3.2 Die Antwort auf „warum sollte ich aufsteigen?"

Der Aufstieg kostet erst einmal Einkommen und zahlt es danach zurück:

| | Gold je Welle |
|---|---|
| Liga L, Welle 50 (dort, wo man steht) | 1,4k · Ligafaktor |
| Liga L+1, Welle 1 (dort, wo man landet) | 52 · Ligafaktor — **27-mal weniger** |
| Liga L+1, Welle 28 | wieder gleichauf |
| Liga L+1, Welle 50 | **6,5-mal mehr** als vorher |

Die **Einholwelle ist 28** — und zwar in jeder Liga dieselbe. Das ist kein Zufall, sondern
folgt daraus, dass Versatz und Schwelle konstant sind: Die Leiter ist selbstähnlich, jeder
Aufstieg fühlt sich gleich an.

### 3.3 Die Antwort auf „warum sollte ich bleiben?"

Weil der alte Bau die neue Liga nur bis zu einem bestimmten Punkt trägt:

| | |
|---|---|
| In Liga L geschafft | Welle 50 (effektiv `50 + 25(L−1)`) |
| Dieselbe Härte liegt in Liga L+1 bei | **Welle 25** |
| Freilauf nach dem Aufstieg | Wellen 1–25, praktisch geschenkt |
| Echtes Wachstum bis zur nächsten Schwelle | **25 Wellen** |

Konkret heißt das: Nach dem Wechsel läuft man rund 25 Wellen × 20 Sekunden ≈ **8 Minuten**
mit vermindertem Einkommen, bis man wieder gleichauf ist. Das ist der Preis. Wer gerade
kurz vor einem teuren Kauf steht, bleibt und holt ihn sich zuerst.

> **Ehrlich benannt:** Das ist eine Entscheidung über den **Zeitpunkt**, nicht über die
> Richtung. Langfristig ist Aufsteigen immer richtig. Ein System, in dem eine niedrige Liga
> dauerhaft konkurrenzfähig bliebe, wäre eine Lüge über den Fortschritt — der Spieler würde
> sie nach zwei Stunden durchschauen. Was die niedrige Liga dauerhaft behält, ist ihre
> Rolle als **Rückfallebene** (Abschnitt 4.3), nicht als Alternative.

### 3.4 Was in jeder Liga neu erscheint

Weil `enemiesForWave` und `bossForWave` die effektive Welle lesen, bringt jede Liga aus dem
vorhandenen Bestand Nachschub:

| Liga | Boss | neue Gegnerarten |
|---|---|---|
| 1 | Titan Core → Swarm Mother | Drone, Runner, Heavy, Bullion, Data Core, Swarm |
| 2 | Swarm Mother | Shielded, Healer |
| 3 | Plasma Behemoth | Berserker |
| 4 | Plasma Behemoth | Spawner |
| 5 | Plasma Behemoth | Overseer |
| 6 | Plasma Behemoth | — |
| 7 | Void Entity | — |
| 8 | Void Entity | Phantom |
| 9 | Void Entity | Blink Drone |
| 10 | Void Entity | Reflector |

**Zwei Befunde daraus, beide vor E1 zu entscheiden:**

1. **Die Bossleiter hat ein Loch.** Der Plasma Behemoth deckt die Ligen 3 bis 6 ab, das Void
   Entity die Ligen 7 bis 10. Nötig sind zwei weitere Bosse mit `bossFrom` bei 130 und 260,
   oder eine Verschiebung der vorhandenen. Das ist je ein Datensatz in `data/enemies.ts`.
2. **Die Ligen 6 und 7 bringen keine neue Gegnerart.** Ebenfalls eine Frage der Schwellen,
   nicht des Codes: Ein Verschieben von `empowerer` (150 → 160) und `phantom` (210 → 185)
   füllt beide Lücken.

### 3.5 Elite

`eliteChance` beginnt bei `ELITE_FROM_WAVE = 50` und wächst mit `0,001` je Welle bis
`ELITE_MAX_CHANCE = 0,45`. Über die effektive Welle gerechnet:

| Liga | Elite ab Welle | Chance bei Welle 1 | Chance bei Welle 50 |
|---|---|---|---|
| 1 | 50 | 0 % | 0 % |
| 2 | 25 | 0 % | 2,5 % |
| 3 | 1 | 0,1 % | 5,0 % |
| 5 | 1 | 5,1 % | 10,0 % |
| 10 | 1 | 17,6 % | 22,5 % |

Das läuft von selbst richtig — kein Sonderfall nötig. In Liga 3 erscheinen Elitegegner ab
Welle 1, aber mit derselben geringen Chance wie heute bei Welle 51.

### 3.6 Was aus dem Tempo wird

`speedScale` ist mit `MAX_SPEED_SCALE = 3` gedeckelt. Bei einem Zuwachs von 1 % je Welle ist
das ab **effektiver Welle 111** erreicht, also ab Liga 5 in fast jeder Welle. Das ist richtig
so und braucht keine Änderung: Gegnertempo ist keine Achse, auf der das Spiel wachsen soll.

---

## 4. Die Regeln des Wechsels

### 4.1 Was bleibt, was zurückgesetzt wird

| | beim Ligenwechsel |
|---|---|
| Türme im Bau und im Lager | **bleiben** |
| Gold, Level, Perks, Upgrades, Fähigkeiten | **bleiben** |
| Prestige-Punkte und -Knoten | **bleiben** |
| Gespielte Welle | **auf 1** |
| Wellenrekord der neuen Liga | eigener Zähler, beginnt bei 1 |
| Wellenrekord der alten Liga | **bleibt erhalten** |
| Münzen und Kapseln auf dem Feld | bleiben (sie verfallen nie, GDD 08 §2) |

Ein Ligenwechsel ist damit **kein Reset**. Er ist ein Ortswechsel.

### 4.2 Wann der Aufstieg möglich wird

`waveRecords[liga] ≥ LEAGUE_ADVANCE_WAVE` **und** `liga == permanent.leagueUnlocked`.

Dann steigt `permanent.leagueUnlocked` um eins — **einmalig und dauerhaft** — und ein Fenster
fragt: jetzt wechseln oder bleiben. Beides ist folgenlos; wer bleibt, wechselt später über
die Wellenleiste.

Die Schwelle ist ausdrücklich **keine Goldschwelle.** Gold wird ausgegeben; eine Goldschwelle
zwänge zum Horten und bestrafte damit genau das Spielen, das sie belohnen soll. Der
Wellenrekord wird ohnehin schon geführt.

### 4.3 Der Rückweg

**Jede freigeschaltete Liga ist jederzeit betretbar, aufwärts wie abwärts.** Es gibt keine
Kosten, keine Sperre, keine Abklingzeit.

Der Grund ist derselbe wie beim Wellen-Skip (GDD 07 §9) und beim Wellenverlust (GDD 02 §5):
Eine Entscheidung, die den Spieler einsperren kann, macht aus dem Experiment ein Risiko.

Weil der Wellenrekord **je Liga** geführt wird, landet man beim Rückweg sofort wieder in der
Tiefe, die man dort erreicht hatte. Die niedrige Liga bleibt dadurch eine funktionierende
Einkommensquelle, wenn man **jetzt** Gold braucht — und genau das ist ihre bleibende Rolle.

### 4.4 Ligen und Prestige

Die beiden Systeme dürfen sich nicht ersetzen. Die Trennung:

> **Prestige ist, *was* man besitzt. Die Liga ist, *wo* man spielt.**

Daraus folgen drei Festlegungen:

| Feld | Ort | Warum |
|---|---|---|
| `leagueUnlocked` | `permanent` | Müsste man die Ligen nach jedem Prestige neu erklettern, wäre die Liga eine zweite Prestige-Schleife — und würde die erste verdrängen |
| `league` (gespielt) | `run` | Nach dem Prestige steht ein frischer Bau in Liga 1. Er hält Liga 5 nicht aus, und das muss er auch nicht |
| `waveRecords` | `run` | Wie `waveRecord` heute: Die Skip-Grenze gehört zum Run (GDD 07 §10) |

Nach einem Prestige beginnt man also in Liga 1 bei Welle 1, **darf aber sofort in jede
freigeschaltete Liga wechseln**. Ob der neue Bau das trägt, ist die erste interessante Frage
jedes Runs — und sie ist selbstbegrenzend: Wer zu hoch einsteigt, tötet nichts und bekommt
folglich nichts. Ein Missbrauch ist damit nicht möglich, ohne dass eine Regel ihn verbieten
müsste.

### 4.5 Prestige-Punkte

`prestigePoints` in `src/sim/prestige.ts` rechnet heute:

```
(waveRecord / 45)² + goldEarned / GOLD_PER_PRESTIGE_POINT
```

Beide Terme brauchen die Liga, aber aus entgegengesetzten Gründen:

**Der Wellenterm** muss die Liga **einbeziehen** — sonst wäre Welle 50 in Liga 8 so viel wert
wie Welle 50 in Liga 1. Er liest künftig die **effektive** Rekordwelle:

```
fromWave = (effektiverRekord / PRESTIGE_WAVE_DIVISOR) ^ PRESTIGE_WAVE_EXPONENT
```

Liga 1 Welle 50 → 1,23 Punkte · Liga 5 Welle 50 → 11,1 · Liga 10 Welle 50 → 37,3.

**Der Goldterm** muss die Liga **herausrechnen** — und das ist eine Altlast, die die Liga nur
sichtbar macht: Gold wächst exponentiell mit der Welle (`1,06^w`), der Wellenterm nur
quadratisch. Schon heute dominiert das Gold in tiefen Wellen; mit Ligen dominiert es total
(Liga 5 bringt je Welle 2,45M gegen 1,4k in Liga 1). Vorschlag:

```
fromGold = goldEarned / (GOLD_PER_PRESTIGE_POINT × rewardScale(effektiverRekord))
```

Damit misst der Term, **wie gründlich** jemand gefarmt hat, statt **wie tief** er gekommen ist
— das misst schon der erste Term. Das ist eine Änderung an GDD 10 §5 und braucht eine eigene
Messung; sie gehört zu diesem Plan, weil die Ligen sie erzwingen, nicht weil sie sie
verursachen.

---

## 5. Die zehn Ligen

Namen englisch (Spielsprache, GDD 16 §1). Der Farbton ist ein **Name aus `PALETTE`**, kein
Farbwert — `data/` kennt `render/` nicht (Abschnitt 7.2).

| # | Name | Farbton | Schein | Rasterdichte | Bahnen | Drift |
|---|---|---|---|---|---|---|
| 1 | Outer Drift | `cyan` | 1,00 | 1,00 | 14 | — |
| 2 | Shattered Belt | `teal` | 1,10 | 1,05 | 15 | — |
| 3 | Ember Reach | `lime` | 1,20 | 1,10 | 16 | — |
| 4 | Iron Verge | `gold` | 1,30 | 1,15 | 17 | — |
| 5 | Crimson Span | `violet` | 1,45 | 1,20 | 18 | ✓ |
| 6 | Hollow Tide | `magenta` | 1,60 | 1,25 | 19 | ✓ |
| 7 | Starless Deep | `violet` | 1,75 | 1,30 | 20 | ✓ |
| 8 | Ashen Spiral | `magenta` | 1,90 | 1,35 | 21 | ✓ |
| 9 | Radiant Maw | `gold` | 2,05 | 1,40 | 22 | ✓ |
| 10 | The Breach | `magenta` | 2,25 | 1,50 | 24 | ✓ |

Zwei Regeln, die nicht verhandelbar sind:

- **`life` darf nie Ligafarbe werden.** Es ist der Ton des Gegnerlebens und der einzige, den
  kein Gegner tragen darf (`render/theme.ts`).
- **Die Station bleibt lesbar.** Aus `docs/politur.md`: *„Verdeckt ein Effekt die Station oder
  lenkt von ihr ab, ist er falsch."* Die Intensität steigt über Farbe, Schein und Kontrast
  des **Grundes** — nicht über mehr Bewegung im Vordergrund. Der Drift ab Liga 5 ist
  weichgezeichnet und läuft hinter dem Raster.

Die Ligen 7 bis 10 wiederholen Farbtöne. Das ist bewusst: Ein elfter Farbton, der weder
`life` noch einer der vorhandenen ist, wäre eine Erweiterung von `PALETTE` — und die ist eine
eigene Entscheidung, keine Nebenwirkung dieses Plans.

---

## 6. Die Oberfläche

### 6.1 Die Wellenleiste bekommt eine zweite Zeile

Die vorhandene Karte in `src/ui/hud.ts` (`waveCard` mit `wave-jump` und `wave-controls`)
wird zweizeilig:

```
┌────────────────────────────────┐
│  EMBER REACH            LEAGUE │   ← Ligazeile, in Ligafarbe
│  (<)        3          (>)     │
├────────────────────────────────┤
│  Wave 27                  ●    │   ← unverändert
│  (<)      AUTO         (>)     │
└────────────────────────────────┘
```

- `(>)` in der Ligazeile ist aktiv bis `permanent.leagueUnlocked`, `(<)` bis Liga 1.
- Ein Ligenwechsel startet Welle 1 der Zielliga — außer man war dort schon, dann die dort
  zuletzt gespielte Welle. (Ein Rückweg, der einen bei Welle 1 absetzt, wäre eine Strafe.)
- Kein Bestätigungsfenster. Der Wechsel ist folgenlos und darf sich auch so anfühlen.

### 6.2 Das Aufstiegsfenster

Erscheint **einmal je Liga**, wenn die Schwelle fällt. Es folgt der Regel aus GDD 14 §4a und
der 80/20-Regel: **Es pausiert nicht.** Der Kampf läuft weiter, das Fenster wartet.

Inhalt: Name der neuen Liga, ihr Farbton, drei Zeilen Fakten (Gegner ×10,8 stärker · Gold
×1,5 · beginnt bei Welle 1), zwei Knöpfe (*Enter* / *Stay*). Beide Antworten schalten die
Liga frei — der Knopf entscheidet nur, ob jetzt gewechselt wird.

### 6.3 Sonst

- Ein Ligaabzeichen neben der Wellennummer im HUD, in Ligafarbe.
- Das Rückkehrfenster nach Offline-Zeit nennt die Liga mit.
- Der Prestige-Bildschirm zeigt den effektiven Rekord, damit der Punktebetrag nachvollziehbar
  bleibt.

---

## 7. Datenmodell

### 7.1 Neue Datei `src/data/leagues.ts`

```ts
export type LeagueTint = 'cyan' | 'teal' | 'lime' | 'gold' | 'violet' | 'magenta'

export type LeagueDef = {
  /** 1-basiert. Entspricht dem Index in LEAGUES + 1. */
  index: number
  id: string                 // 'league.drift'
  name: string               // 'Outer Drift' - englisch, Spielsprache
  tint: LeagueTint           // Name, kein Farbwert
  glow: number               // Faktor auf THEME.glowCore
  grid: number               // Faktor auf THEME.grid
  bands: number              // Bahnenzahl in render/backdrop.ts
  drift: boolean
}

export const LEAGUES: readonly LeagueDef[] = [ /* zehn Einträge, Abschnitt 5 */ ]

export function leagueByIndex(index: number): LeagueDef
export function isKnownLeague(index: number): boolean
export const MAX_LEAGUE: number          // LEAGUES.length
```

### 7.2 Schichtregel

`data/leagues.ts` nennt Farben **nur beim Namen**. Die Auflösung nach `PALETTE` geschieht in
`render/theme.ts` über eine Tabelle `LEAGUE_TINT: Record<LeagueTint, string>`. Ohne diese
Trennung importierte `data/` aus `render/`, und die Simulation hinge an der Darstellung.

### 7.3 Die Rechenfunktionen (`src/data/balance.ts`)

Die drei Werte gehören zu den übrigen Balancewerten, nicht in den Katalog:

```ts
export const LEAGUE_WAVE_OFFSET = 25
export const LEAGUE_REWARD_BONUS = 1.5
export const LEAGUE_ADVANCE_WAVE = 50

/** Die Welle, mit der die Welt rechnet. Die Anzeige zeigt weiter `wave`. */
export function effectiveWave(wave: number, league: number): number {
  return wave + LEAGUE_WAVE_OFFSET * Math.max(0, league - 1)
}

/** Zusaetzlicher Gold- und XP-Faktor dieser Liga. */
export function leagueRewardFactor(league: number): number {
  return Math.pow(LEAGUE_REWARD_BONUS, Math.max(0, league - 1))
}
```

### 7.4 Zustand

```ts
// PermanentState — ueberlebt Prestige
leagueUnlocked: number          // Start 1

// RunState — wird bei Prestige zurueckgesetzt
league: number                  // Start 1
waveRecords: number[]           // Index = liga - 1, Start [1]
leagueWaves: number[]           // wo jede Liga verlassen wurde, Start [1]
```

`leagueWaves` ist beim Bauen von E4 dazugekommen und im Plan oben noch nicht vorgesehen —
die Begründung steht in Abschnitt 12b, Punkt 1.

`run.waveRecord` **entfällt** und wird durch `waveRecords[league − 1]` ersetzt. Ein Feld, das
in zwei Bedeutungen weiterlebte, wäre die wahrscheinlichste Fehlerquelle des ganzen Umbaus.

`permanent.bestWaveEver` bleibt, bekommt aber die **effektive** Welle — sonst wäre der
persönliche Rekord ligenblind.

---

## 8. Die Rechenkette

Was `effectiveWave` liest, und was nicht:

| Datei | Funktion | Änderung |
|---|---|---|
| `sim/waves.ts` | `buildWave(wave, rng)` | → `buildWave(wave, league, rng)`; alle vier `scaleFor`-Aufrufe und `enemiesForWave` über die effektive Welle |
| `sim/waves.ts` | `startWave(state, wave)` | schreibt `waveRecords[league−1]`, ruft `spawnBoss` mit effektiver Welle |
| `sim/waves.ts` | `canSkipTo`, `nextWave` | lesen `waveRecords[league−1]` |
| `sim/waves.ts` | `enemyCount(wave)` | **unverändert** — die Gegnerzahl folgt der angezeigten Welle |
| `sim/enemies.ts` | `maybeMakeElite(state, enemy, wave)` | Aufrufer übergibt die effektive Welle |
| `sim/prestige.ts` | `prestigePoints(state)` | Abschnitt 4.5 |
| `sim/offline.ts` | `simulateOffline` | rechnet in der Liga weiter, in der der Spieler war |
| `sim/events.ts`, `sim/trader.ts` | Zeitpunkte | **unverändert** — sie hängen an der angezeigten Welle, damit jede Liga ihren eigenen Rhythmus hat |
| `sim/events.ts` | Belohnungshöhe | `eventRewardFor(effektiveWelle)` × `leagueRewardFactor` |
| `sim/economy.ts` | Goldmenge je Gegner | × `leagueRewardFactor(league)` |
| `sim/progression.ts` | XP je Gegner | × `leagueRewardFactor(league)` |

**`enemyCount` bleibt bewusst an der kleinen Welle.** Sonst begänne Liga 5 mit 158 Gegnern in
Welle 1 — das wäre eine Bildlast ohne Spielgewinn, und die Gegnerzahl ist laut Kommentar in
`waves.ts` ausdrücklich nicht der Ort, an dem die Härte wächst.

---

## 9. Spielstand

`SAVE_VERSION` 9 → **10**. Die Migration ist einfach und verlustfrei:

```ts
// MIGRATIONS[9]: Ligen eingefuehrt
permanent.leagueUnlocked = 1
run.league = 1
run.waveRecords = [run.waveRecord ?? 1]
delete run.waveRecord
```

Jeder bestehende Spielstand landet in Liga 1 mit seinem bisherigen Rekord — genau dort, wo er
heute steht. `readRun` und `readPermanent` bekommen die neuen Felder mit Rückfallwerten,
`migrationChainComplete` deckt die neue Stufe ab.

---

## 10. Zahlen und Anzeige

`core/format.ts` kürzt bis `T` und geht ab `1e15` in wissenschaftliche Schreibweise. Liga 10
bei Welle 50 bringt 27 Milliarden Grundwerte je Welle; das Gesamtgold eines langen Runs
erreicht die Größenordnung `1e12` bis `1e13` und bleibt damit im Suffixbereich.

Das reicht — aber es reicht **knapp**, und GDD 16 §15 führt „Zahlentyp für Endgame-Werte"
ohnehin als offenen Punkt. Die Ligen machen ihn dringend, lösen ihn aber nicht. Vorschlag:
`SUFFIXES` um `Qa` und `Qi` erweitern, sobald Liga 8 spielbar ist — nicht vorher.

---

## 11. Was ausdrücklich **nicht** dazugehört

| Idee | Warum nicht |
|---|---|
| Raritätsdecke je Liga | GDD 06 §7 macht die Raritäten zur **Prestige**-Freischaltung. Ein zweites Tor daneben verwischt beide |
| Eigene Währung je Liga | Eine zweite Währung ist ein eigenes System mit eigener Ökonomie, nicht ein Anhängsel |
| Liga-exklusive Türme | Türme hängen am Prestige-Baum (`unlock`). Dieselbe Begründung wie bei den Raritäten |
| Automatischer Aufstieg | Der Spieler soll wählen — das ist der Kern des Vorschlags |
| Ligen-Bestenliste | Braucht einen Server. GDD 16 §2 hält das offen, dieser Plan berührt es nicht |

---

## 12. Die Etappen

Jede Etappe endet lauffähig und mit grünen Selbsttests.

### E1 — Zahlen, Katalog, effektive Welle ✅ erledigt

**Dateien:** `data/balance.ts` (drei Werte, `effectiveWave`, `leagueRewardFactor`),
`data/leagues.ts` (neu), `render/theme.ts` (`LEAGUE_TINT`), `data/strings.ts` (Liganamen).

**Abnahme:** `effectiveWave(1, 3) === 51`, `leagueRewardFactor(3) === 2.25`, zehn Ligen mit
eindeutigen Kennungen, jeder Farbton in `LEAGUE_TINT` aufgelöst und keiner davon `life`.
Noch keine Wirkung im Spiel.

### E2 — Zustand und Migration ✅ erledigt

**Dateien:** `app/state.ts` (`leagueUnlocked`, `league`, `waveRecords`; `waveRecord` entfernt),
`app/save.ts` (`SAVE_VERSION = 10`, `MIGRATIONS[9]`, `readRun`, `readPermanent`).

**Abnahme:** Ein Spielstand der Version 9 lädt, landet in Liga 1 und behält seinen Rekord.
`migrationChainComplete()` ist wahr. Alle Aufrufer von `waveRecord` sind umgestellt —
der Typprüfer erzwingt das, weil das Feld weg ist.

### E3 — Die Welt rechnet mit der Liga ✅ erledigt

**Dateien:** `sim/waves.ts`, `sim/enemies.ts`, `sim/economy.ts`, `sim/progression.ts`.

`buildWave(wave, league, rng)` mit allen vier Skalen über die effektive Welle;
`enemiesForWave`, `bossForWave`, `eliteChance` ebenso; Gold und XP mit
`leagueRewardFactor`.

**Abnahme:** Liga 3 / Welle 1 erzeugt dieselbe Gegnerliste und dieselben Skalen wie Liga 1 /
Welle 51 — **außer** bei der Gegnerzahl (8 statt 83) und der Belohnung (×2,25). Als
Selbsttest formuliert, nicht als Augenschein.

### E4 — Wechseln und Aufsteigen ✅ erledigt

**Dateien:** `app/actions.ts` (`goToLeague`, `canEnterLeague`), `sim/waves.ts`
(Freischaltprüfung in `startWave`), `core/events.ts` (`league.changed`, `league.unlocked`).

**Abnahme:** Aufstieg genau bei `waveRecords[liga−1] ≥ 50` und nur für die aktuell höchste
Liga; Wechsel abwärts jederzeit; Rückkehr setzt auf die dort zuletzt gespielte Welle;
`leagueUnlocked` übersteht `doPrestige`, `league` und `waveRecords` nicht.

### E5 — Prestige-Punkte ✅ erledigt

**Dateien:** `sim/prestige.ts`, `data/balance.ts`.

**Abnahme:** Wellenterm über die effektive Rekordwelle, Goldterm durch `rewardScale`
normalisiert. Der Selbsttest hält drei Stützstellen fest (Liga 1/5/10 bei Rekord 50) —
er prüft die **Formel**, nicht ihre Schönheit; die Beträge werden justiert.

### E6 — Oberfläche ✅ erledigt

**Dateien:** `ui/hud.ts` (Ligazeile), `ui/dialogs.ts` (Aufstiegsfenster), `style.css`,
`data/strings.ts`.

**Abnahme:** Ligazeile bedienbar, Grenzen richtig gesperrt, kein Fenster hält den Kampf an,
alle Texte über `t()`. Die Breitenwächter in `selftest/guards.ts` decken die neue Zeile ab.

### E7 — Hintergrund und Identität

**Dateien:** `render/backdrop.ts` (Bahnenzahl, Drift), `render/scene.ts` (Schein, Raster),
`render/theme.ts`.

**Abnahme:** Zehn unterscheidbare Gründe; die Station bleibt in Liga 10 so gut ablesbar wie
in Liga 1 (nachgemessen am Standbild wie in `docs/politur.md`); bei Tempo ×2/×4 werden
Effekte ausgedünnt, nicht beschleunigt.

### E8 — Offline, Ereignisse, Hinweise

**Dateien:** `sim/offline.ts`, `sim/events.ts`, `sim/trader.ts`, `sim/hints.ts`,
`ui/outcome.ts`.

**Abnahme:** Offline rechnet in der zuletzt gespielten Liga; das Rückkehrfenster nennt sie;
Ereignis- und Händlerzeitpunkte folgen der angezeigten Welle, ihre Beträge der effektiven;
ein einmaliger Hinweis erklärt die Ligazeile beim ersten Erscheinen.

### E9 — Selbsttests und Wächter

**Dateien:** `selftest/suites/waves.ts`, `progression.ts`, `save.ts`, `prestige.ts`,
`encounters.ts`, `economy.ts`, `content.ts`, `guards.ts`.

**Abnahme:** Neue Fälle für Versatz, Belohnungsfaktor, Freischaltschwelle, Rekord je Liga,
Migration 9→10, Prestige-Punkte je Liga, Bossleiter ohne Loch (Abschnitt 3.4), jede Liga mit
Namen und Farbton. Die Gesamtzahl steigt; keiner der vorhandenen Tests darf angepasst werden
müssen, außer denen, die `waveRecord` nennen.

### E10 — Bossleiter und Gegnerschwellen schließen

**Dateien:** `data/enemies.ts`.

Zwei neue Bosse bei `bossFrom` 130 und 260; `empowerer` 150 → 160; `phantom` 210 → 185.

**Abnahme:** Jede der zehn Ligen bringt entweder einen neuen Boss oder eine neue Gegnerart —
als Selbsttest über die Tabelle, nicht als Behauptung.

### E11 — GDD nachziehen

Abschnitt 13. Erst danach ist dieser Plan kein Widerspruch mehr.

---

## 12a. Was beim Bauen von E1–E3 aufgefallen ist

Sieben Stellen, an denen der Plan von oben ungenau oder schlicht falsch war. Sie stehen hier
und nicht stillschweigend im Code, weil der nächste Leser sonst den Plan glaubt.

**1. Der Ligafaktor gehört in den Wellenplan, nicht in vier Dateien.**
Der Plan nannte für E3 `sim/economy.ts` und `sim/progression.ts` als zu ändern. Beide bleiben
unangetastet: Gold und XP je Gegner lesen ausschließlich `plan.rewardScale` (`spawnEnemy` in
`sim/enemies.ts`), also trägt `rewardScale` den Faktor bereits — `scaleFor(effektiv, 1,06) ×
leagueRewardFactor(liga)`. Damit kann keine Stelle ihn vergessen, und Elite-Zuschläge,
Kapseln und Ereignisbeträge ziehen ohne Zutun mit. **Eine Rechnung an einem Ort schlägt vier
Rechnungen an vier.**

**2. Der Zufall wird aus der effektiven Welle abgeleitet.**
Der erste Versuch war `fork(welle + liga × 1000)` — er brach den Selbsttest „die Abwesenheit
verschenkt keine Welle", weil er **jede** Welle jeder Liga neu würfelt, auch die von Liga 1.
`fork(effektiveWelle)` leistet dasselbe und lässt Liga 1 Zeichen für Zeichen die von heute: ein
bestehender Spielstand findet seine Wellen unverändert vor. Dass Liga 2 Welle 1 dieselbe
Zusammensetzung hat wie Liga 1 Welle 26, ist dabei kein Nebeneffekt, sondern die Aussage des
Systems.

**3. Eine Migration darf `permanent` ergänzen, aber nicht erschaffen.**
Die erste Fassung von `MIGRATIONS[9]` legte den Block an, wenn er fehlte. Damit kam ein
Fragment wie `{"version":1}` durch `deserialize`, das nie ein Spielstand war — der Selbsttest
„kaputte Eingaben liefern null statt eines Absturzes" hat es sofort gefangen.

**4. `waveRecords` braucht Zugriffsfunktionen, keinen rohen Feldzugriff.**
30 Stellen lasen `run.waveRecord`. Statt überall `run.waveRecords[run.league - 1]` zu
schreiben, gibt es in `app/state.ts` jetzt `waveRecord`, `waveRecordOf` und `raiseWaveRecord`.
`raiseWaveRecord` füllt dabei Lücken auf: Ein Sprung in Liga 4 bei einelementiger Liste
hinterließe sonst ein Loch, und `JSON.stringify` macht daraus `null`, das beim Laden als Zahl
durchginge.

**5. Der Boss braucht beide Wellen.**
`spawnBoss(state, wave, effektiv)` — **dass** ein Boss kommt, entscheidet die angezeigte Welle
(jede Liga hat ihren eigenen Zehnerrhythmus), **welcher** kommt, die effektive. Mit nur einer
der beiden Zahlen ist eines von beidem falsch.

**6. Die Liganamen laufen durch `t()`.**
Anders als `towers.ts`, wo der englische Name als Literal im Datensatz steht. Die Kennung der
Liga **ist** der Textschlüssel; `data/leagues.ts` enthält keinen Spielertext. Das ist der neue
Weg und nicht der alte — `docs/politur.md` Punkt 6 kritisiert den alten ausdrücklich.

**7. Die Selbsttests sind mit E1–E3 entstanden, nicht erst in E9.**
`selftest/suites/leagues.ts`, 22 Prüfungen. Der Plan schob sie nach hinten; drei Etappen ohne
Netz zu bauen wäre in einem Projekt mit 640 bestehenden Prüfungen die falsche Reihenfolge
gewesen. E9 bleibt trotzdem stehen — dort kommen die Fälle für E4 bis E8 dazu.

**Stand nach E1–E3:** Typecheck fehlerfrei, 662/662 Selbsttests (vorher 640/640). Das Spiel
startet ohne Fehler in der Konsole. Sichtbar ist noch nichts: `run.league` steht auf 1 und
lässt sich bis E4 nicht ändern — genau wie geplant.

---

## 12b. Was beim Bauen von E4–E5 aufgefallen ist

**1. Der Rückweg braucht ein eigenes Feld.**
Abschnitt 4.3 verspricht, dass man beim Zurückwechseln „in der Tiefe landet, die man dort
erreicht hatte", Abschnitt 6.1 dagegen „auf der zuletzt gespielten Welle". Das ist nicht
dasselbe, und der Unterschied entscheidet über den einen Fall, für den die niedrige Liga
existiert: Wer dort auf Welle 12 zurückgegangen ist, um in Ruhe zu sammeln, will nach einem
Abstecher **auf Welle 12** weitermachen — nicht auf seinem Rekord bei 30. Deshalb gibt es
`run.leagueWaves` neben `run.waveRecords`. Der Rekord bleibt die Skip-Grenze, das neue Feld
ist der Rückweg.

**2. Die Ligensteuerung gehört in `sim/waves.ts`.**
Der Plan nannte keine Datei. Eine eigene `sim/leagues.ts` hätte `startWave` gebraucht und
`startWave` sie — ein Kreis zwischen zwei Dateien für einen Begriff, der ohnehin dorthin
gehört: Die Liga ist **die zweite Achse derselben Steuerung**, vor und zurück wie die Welle.

**3. Der Klangplan hat die neuen Ereignisse sofort eingefordert.**
`app/soundplan.ts` erzwingt über einen Typ, dass **jedes** Ereignis entweder einen Klang oder
eine begründete Stille hat. `league.unlocked` leiht sich den Prestige-Klang (dieselbe Aussage,
und neun Augenblicke im ganzen Spiel tragen keine eigene Aufnahme), `league.changed` bleibt
stumm, weil unmittelbar danach `wave.started` klingt.

**4. Der Belohnungsfaktor steht jetzt einmal in `data/balance.ts`.**
`rewardScaleFor(effektiveWelle, liga)` — `buildWave` legt ihn in den Wellenplan,
`prestigePoints` **teilt** durch ihn. Zwei Stellen mit demselben Bedarf und
entgegengesetztem Vorzeichen: Liefen sie auseinander, zahlte eine hohe Liga entweder doppelt
oder gar nicht.

**Stand nach E4–E5:** 679 Selbsttests, davon 677 bestanden. Die beiden Ausfälle gehören
**nicht** zu diesem Vorhaben (siehe unten). Ligenwechsel, Aufstiegsschwelle und die neue
Punkteformel sind vollständig abgedeckt.

> **Achtung — parallele Arbeit im selben Arbeitsbaum.** Während E4 und E5 entstanden, hat
> eine zweite Sitzung `src/ui/hud.ts`, `src/style.css`, `src/ui/coinflight.ts` (neu),
> `src/sim/station.ts`, `src/sim/shop.ts` und `src/ui/shell.ts` bearbeitet. Die beiden
> fehlschlagenden Selbsttests („eine Platzierung in einen zu engen Keil", „Zeit kommt nur aus
> core/loop.ts") stammen daher. E6 wurde auf ausdrückliche Anweisung trotzdem gebaut.

---

## 12c. Was beim Bauen von E6 aufgefallen ist

**1. Die Ligazeile gehört in dieselbe Karte wie die Welle.**
Der Plan zeichnete zwei getrennte Blöcke. Gebaut ist eine Zeile **über** der Wellennummer,
in derselben Platte: Beide Achsen beantworten dieselbe Frage („wo spiele ich gerade"), und
zwei Karten übereinander behaupteten zwei Themen, wo eines ist. Die Ligazeile ist bewusst
die leisere — kleinerer Satz, schmalere Pfeile —, weil man die Welle ständig wechselt und
die Liga selten.

**2. Sie erscheint erst mit der zweiten Liga.**
Vorher wäre sie eine Zeile mit zwei toten Pfeilen um einen Namen, den niemand gewählt hat.
Dieselbe Regel, nach der auch der Sprunggriff der Wellennummer bei Rekord 1 verschwindet
(GDD 14 §4a).

**3. Das Aufstiegsfenster hängt am Ereignis, nicht an einem Feld.**
`league.unlocked` setzt in `ui/dialogs.ts` einen Merker; beide Antworten löschen ihn. Kein
neues Feld im Spielstand: Die Freischaltung ist eine **Nachricht**, und die meldet man, wenn
sie eintrifft. Beim nächsten Laden ist sie keine mehr — die Liga steht dann in der Ligazeile
und wartet dort, so lange der Spieler will.

**4. Der neue Breitenwächter hat sofort etwas gefunden.**
`selftest/guards.ts` rechnet aus dem Stilblatt und den echten Namen, ob der längste Liganame
in die 208 px breite Karte passt. Beim ersten Lauf: **„Shattered Belt" braucht 106,4 px, die
Zeile bietet 103,4.** Behoben durch zwei Änderungen, die beide für sich richtig sind — der
Name heißt jetzt **Shard Belt** (er war ohnehin der einzige aus drei Wörtern Länge, alle
anderen sind zwei kurze), und die Sperrung sinkt von 0,14 em auf 0,10 em, was bei 10 px
Pixelschrift ohnehin näher am Rest der Oberfläche liegt.

**5. `[hidden]` braucht im Stilblatt eine eigene Zeile.**
`display: flex` aus dem Stilblatt schlägt die Browserregel `[hidden] { display: none }`.
`.league-row[hidden]` steht deshalb ausdrücklich da — wie `.boss-bar`, `.tooltip`,
`.hint-card` und `.levelup-backdrop` es auch tun. **Nebenbefund:** `.wave-jump` hat diese
Zeile **nicht**, obwohl `ui/hud.ts` die Sprungzeile über `hidden` schaltet. Sie steht damit
dauerhaft im Bild statt erst auf Klick. Das ist ein Fehler von vor diesem Vorhaben und
separat notiert.

**Stand nach E6:** Typecheck fehlerfrei, 691/691 Selbsttests. Das Ligensystem ist damit
**spielbar**: Ligazeile bedienbar, Grenzen gesperrt, Aufstiegsfenster hält den Kampf nicht
an, alle Texte über `t()`.

> Nicht geprüft: das Bild im laufenden Spiel. Alle fünf Vorschau-Server des Ordners waren
> von der parallelen Sitzung belegt, und die Browser-Ansicht dieser Sitzung rendert nicht,
> solange sie ausgeblendet ist. Die Ligazeile und das Aufstiegsfenster sind damit
> **rechnerisch** abgesichert (Breitenwächter, Textregel, Typprüfer), aber noch von niemandem
> angesehen worden.

---

## 13. Änderungen am GDD

| Kapitel | Was sich ändert |
|---|---|
| **README** | Rahmenentscheidungen: Ligen, Aufstiegsschwelle, was beim Wechsel bleibt |
| **02** Kern-Spielschleife | Vierte Schleife zwischen Run und Prestige; Abschnitt 7 neu gefasst |
| **07** Gegner und Wellen | Wellensteuerung wird zweidimensional (§9); Rekord je Liga (§10); Elite über die effektive Welle (§6) |
| **10** Prestige | Was der Ligenwechsel *nicht* zurücksetzt (§2); neue Punkteformel (§5) |
| **13** UI | Ligazeile, Aufstiegsfenster, Hintergrund je Liga (§2, §4, §10) |
| **15** Balancing | Der Ligaversatz als neuer zentraler Balancewert neben `WAVE_SCALING` (§16) |

---

## 14. Risiken

**1. Vier Schleifen statt drei.** GDD 02 §7 begründet genau drei. Die Liga schiebt sich
zwischen Run und Prestige, und wenn Aufsteigen sich immer besser anfühlt als Zurücksetzen,
wird der Prestige-Baum zur Pflicht statt zum Ziel. Gegenmaßnahme ist die Punkteformel aus
4.5 — sie macht die hohe Liga zum **Zubringer** des Prestige. Zu prüfen ist trotzdem am
laufenden Spiel, ob der Spieler noch prestigt, oder nur noch klettert.

**2. Der Goldterm der Prestige-Formel.** Die Normalisierung in 4.5 ist eine Änderung an einer
Formel, die heute funktioniert. Sie ist begründet, aber unvermessen. Fällt sie durch, ist der
Rückfall: Goldterm ganz streichen und die Punkte allein an die effektive Rekordwelle hängen.

**3. Das Einholtal.** 27 Wellen mit vermindertem Einkommen sind am Modell acht Minuten. Fühlt
es sich länger an, ist `LEAGUE_REWARD_BONUS` der Stellknopf — nicht der Versatz. Der Versatz
zu ändern verschiebt gleichzeitig Gegner, Bosse und Elite und macht jede vorherige Messung
wertlos.

**4. Die Justierung des Upgrade-Umbaus wird ungültig.** `docs/upgrade-umbau.md` ist umgesetzt,
aber seine 60 Upgrades sind an der heutigen Wellenkurve gemessen. Nach den Ligen misst man
gegen einen bis zu 220-milliardenfachen HP-Bereich. **Deshalb gehört dieser Plan hinter die
Justierung des Upgrade-Systems, nicht davor.**

**5. Ein Feld in zwei Bedeutungen.** `waveRecord` → `waveRecords` ist der gefährlichste Schnitt
des Umbaus. Die Absicherung ist, das alte Feld **zu löschen** statt es liegenzulassen: Der
Typprüfer findet dann jede Stelle, ein stiller Rückfallwert fände keine.

---

## 15. Offen — bewusst nicht entschieden

| Offen | Art |
|---|---|
| `LEAGUE_WAVE_OFFSET`, `LEAGUE_REWARD_BONUS`, `LEAGUE_ADVANCE_WAVE` | Tuning am laufenden Spiel |
| Zehn Ligen oder mehr | folgt aus der Reichweite der Gegnerdaten, messbar erst ab Liga 6 |
| Ob die Aufstiegsschwelle je Liga steigt statt fest zu bleiben | erst zu beurteilen, wenn Liga 3 spielbar ist |
| Ob Liga 10 ein Ende hat oder endlos weiterläuft | Urteil am Spiel, nicht am Modell |
| Wie stark der Hintergrund je Liga wirklich zulegen darf | Urteil am Bild (wie die vier offenen Fragen in `docs/politur.md`) |
