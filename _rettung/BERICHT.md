# Waverbreaker - Rekonstruktionsbericht (Abspielverfahren)

Quelle: 21 Sitzungsverlaeufe vom 02. bis 04.08.2026 aus dem Claude-Konto.
Urspruenglicher Projektpfad: `E:\spiele\Desktop\The Tower`

Verfahren: Die Aenderungsgeschichte jeder Datei wird abgespielt - ein `Write` setzt
den Stand, jedes `Edit` aendert ihn woertlich. Das entspricht dem, was damals
tatsaechlich geschah. Am Ende wird das Ergebnis gegen den letzten `Read` geprueft.

**Guete** = Anteil der Zeilen, die mit dem letzten bekannten Schnappschuss
uebereinstimmen. 100 % heisst: Das Ergebnis ist nachweislich der Originalstand.

| Datei | Zeilen | Basis | Edits ok | Edits offen | geprueft | Guete |
|---|---:|---|---:|---:|---:|---:|
| `.gitattributes` | 2 | Write | 0 | 0 | 0 | - |
| `docs\anlagen.md` | 103 | Write | 3 | 0 | 0 | - |
| `docs\gdd\01-vision-grundkonzept-kernsysteme.md` | 604 | Write | 0 | 0 | 0 | - |
| `prototypes\.gitignore` | 5 | Write | 0 | 0 | 0 | - |
| `prototypes\_template\index.html` | 15 | Write | 0 | 0 | 0 | - |
| `prototypes\_template\main.ts` | 79 | Write | 0 | 0 | 0 | - |
| `prototypes\_template\README.md` | 33 | Write | 0 | 0 | 0 | - |
| `prototypes\_template\style.css` | 38 | Write | 0 | 0 | 0 | - |
| `prototypes\01-tower-building\app.ts` | 136 | Write | 14 | 0 | 0 | - |
| `prototypes\01-tower-building\devtools.ts` | 51 | Write | 1 | 0 | 0 | - |
| `prototypes\01-tower-building\index.html` | 74 | Write | 10 | 0 | 0 | - |
| `prototypes\01-tower-building\input.ts` | 254 | Write | 10 | 0 | 0 | - |
| `prototypes\01-tower-building\persist.ts` | 108 | Write | 0 | 0 | 0 | - |
| `prototypes\01-tower-building\PLAN.md` | 617 | Write | 3 | 0 | 0 | - |
| `prototypes\01-tower-building\style.css` | 204 | Write | 2 | 0 | 0 | - |
| `prototypes\02-tab-transition\style.css` | 335 | Write | 0 | 0 | 0 | - |
| `prototypes\index.html` | 79 | Write | 7 | 0 | 0 | - |
| `prototypes\tsconfig.json` | 19 | Write | 0 | 0 | 0 | - |
| `prototypes\vite.config.ts` | 36 | Write | 0 | 0 | 0 | - |
| `src\app\audio.ts` | 267 | Write | 7 | 0 | 0 | - |
| `src\core\assert.ts` | 92 | Write | 0 | 0 | 0 | - |
| `src\core\format.ts` | 100 | Write | 0 | 0 | 0 | - |
| `src\core\vec.ts` | 39 | Write | 0 | 0 | 0 | - |
| `src\data\abilities.ts` | 118 | Write | 0 | 0 | 0 | - |
| `src\data\events.ts` | 305 | Write | 0 | 0 | 0 | - |
| `src\data\rarities.ts` | 111 | Write | 1 | 0 | 0 | - |
| `src\data\trader.ts` | 159 | Write | 0 | 0 | 0 | - |
| `src\data\traits.ts` | 133 | Write | 0 | 0 | 0 | - |
| `src\render\emblems.ts` | 81 | Write | 0 | 0 | 0 | - |
| `src\selftest\cli.ts` | 38 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\abilities.ts` | 321 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\buffs.ts` | 321 | Write | 1 | 0 | 0 | - |
| `src\selftest\suites\economy.ts` | 452 | Write | 5 | 0 | 0 | - |
| `src\selftest\suites\encounters.ts` | 672 | Write | 4 | 0 | 0 | - |
| `src\selftest\suites\events.ts` | 425 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\format.ts` | 82 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\geometry.ts` | 186 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\idle.ts` | 373 | Write | 2 | 0 | 0 | - |
| `src\selftest\suites\loop.ts` | 179 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\progression.ts` | 274 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\rewards.ts` | 90 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\rng.ts` | 132 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\shop.ts` | 324 | Write | 0 | 0 | 0 | - |
| `src\selftest\suites\station.ts` | 531 | Write | 1 | 0 | 0 | - |
| `src\selftest\suites\waves.ts` | 130 | Write | 1 | 0 | 0 | - |
| `src\sim\drones.ts` | 144 | Write | 0 | 0 | 0 | - |
| `src\sim\events.ts` | 473 | Write | 3 | 0 | 0 | - |
| `src\sim\helpers.ts` | 165 | Write | 0 | 0 | 0 | - |
| `src\sim\hints.ts` | 129 | Write | 3 | 0 | 0 | - |
| `src\sim\offline.ts` | 184 | Write | 8 | 0 | 0 | - |
| `src\sim\station.ts` | 466 | Write | 6 | 0 | 0 | - |
| `src\sim\trader.ts` | 301 | Write | 1 | 0 | 0 | - |
| `src\ui\motes.ts` | 89 | Write | 0 | 0 | 0 | - |
| `src\ui\surge.ts` | 49 | Write | 0 | 0 | 0 | - |
| `src\ui\typewriter.ts` | 242 | Write | 0 | 0 | 0 | - |
| `tsconfig.json` | 21 | Write | 0 | 0 | 0 | - |
| `docs\implementierungsplan.md` | 872 | Write | 22 | 0 | 32 | 0 % |
| `prototypes\01-tower-building\main.ts` | 157 | Write | 20 | 1 | 50 | 0 % |
| `src\sim\combat.ts` | 1232 | Write | 43 | 9 | 85 | 0 % |
| `src\sim\enemies.ts` | 755 | Write | 29 | 8 | 55 | 0 % |
| `src\ui\dialogs.ts` | 711 | Write | 37 | 1 | 20 | 0 % |
| `src\ui\settings.ts` | 201 | Write | 6 | 0 | 100 | 0 % |
| `src\style.css` | 3353 | Write | 76 | 6 | 100 | 2 % |
| `src\ui\prestige.ts` | 403 | Write | 3 | 0 | 230 | 2.6 % |
| `src\render\camera.ts` | 181 | Write | 3 | 0 | 121 | 3.3 % |
| `prototypes\01-tower-building\ui.ts` | 200 | Write | 18 | 0 | 50 | 4 % |
| `src\app\save.ts` | 680 | Write | 36 | 0 | 614 | 6.8 % |
| `docs\gdd\README.md` | 154 | Read | 6 | 0 | 37 | 8.1 % |
| `prototypes\01-tower-building\README.md` | 296 | Write | 31 | 0 | 40 | 10 % |
| `docs\politur.md` | 310 | Read | 5 | 1 | 225 | 10.7 % |
| `src\ui\flip.ts` | 243 | Write | 14 | 0 | 236 | 11.9 % |
| `src\sim\prestige.ts` | 262 | Write | 5 | 0 | 257 | 12.8 % |
| `src\selftest\suites\combat.ts` | 652 | Write | 12 | 2 | 100 | 13 % |
| `src\ui\outcome.ts` | 113 | Read | 0 | 0 | 113 | 13.3 % |
| `src\render\combat.ts` | 1232 | Write | 26 | 1 | 1207 | 14.3 % |
| `docs\gdd\04-hauptturm-system.md` | 312 | Read | 1 | 0 | 305 | 18 % |
| `docs\gdd\07-gegner-bosse-und-wellen.md` | 352 | Read | 2 | 0 | 338 | 18.6 % |
| `src\data\enemies.ts` | 490 | Write | 13 | 0 | 158 | 19.6 % |
| `src\selftest\suites\save.ts` | 426 | Write | 14 | 0 | 50 | 26 % |
| `src\ui\hints.ts` | 95 | Write | 3 | 0 | 74 | 27 % |
| `src\sim\projectiles.ts` | 200 | Write | 7 | 0 | 138 | 27.5 % |
| `src\sim\economy.ts` | 199 | Write | 4 | 0 | 170 | 28.8 % |
| `src\data\towers.ts` | 288 | Write | 19 | 0 | 270 | 31.1 % |
| `prototypes\README.md` | 97 | Write | 9 | 0 | 3 | 33.3 % |
| `src\sim\shop.ts` | 268 | Write | 5 | 0 | 249 | 38.6 % |
| `src\main.ts` | 384 | Write | 42 | 0 | 382 | 40.6 % |
| `.claude\launch.json` | 19 | Write | 1 | 1 | 12 | 41.7 % |
| `vite.config.ts` | 20 | Write | 1 | 0 | 18 | 44.4 % |
| `src\data\cores.ts` | 46 | Write | 3 | 0 | 43 | 46.5 % |
| `index.html` | 25 | Write | 0 | 0 | 15 | 60 % |
| `src\data\strings.ts` | 252 | Write | 23 | 0 | 50 | 68 % |
| `src\sim\stats.ts` | 294 | Write | 20 | 1 | 293 | 76.1 % |
| `src\sim\progression.ts` | 269 | Write | 3 | 0 | 100 | 78 % |
| `prototypes\02-tab-transition\README.md` | 112 | Write | 1 | 0 | 96 | 87.5 % |
| `src\sim\battle.ts` | 122 | Write | 9 | 4 | 58 | 98.3 % |
| `.gitignore` | 10 | Write | 0 | 0 | 6 | 100 % |
| `docs\gdd\03-modulare-basis-und-bauregeln.md` | 416 | Read | 10 | 0 | 416 | 100 % |
| `docs\gdd\05-turm-system-und-turmtypen.md` | 312 | Read | 5 | 0 | 312 | 100 % |
| `docs\gdd\06-turmerwerb-inventar-raritaeten.md` | 250 | Read | 0 | 1 | 250 | 100 % |
| `docs\gdd\08-ressourcen-oekonomie-und-upgrades.md` | 222 | Read | 0 | 1 | 222 | 100 % |
| `docs\gdd\09-level-system-und-faehigkeiten.md` | 257 | Read | 0 | 0 | 257 | 100 % |
| `docs\gdd\10-prestige-system.md` | 270 | Read | 0 | 0 | 270 | 100 % |
| `docs\gdd\11-events-und-versorgungskapseln.md` | 181 | Read | 0 | 0 | 181 | 100 % |
| `docs\gdd\12-offline-fortschritt-und-helfer.md` | 180 | Read | 0 | 0 | 180 | 100 % |
| `docs\gdd\13-ui-und-visuelles-design.md` | 430 | Read | 10 | 0 | 430 | 100 % |
| `docs\gdd\16-technische-umsetzung.md` | 328 | Read | 3 | 0 | 328 | 100 % |
| `package.json` | 23 | Write | 1 | 0 | 23 | 100 % |
| `prototypes\01-tower-building\buffs.ts` | 144 | Write | 0 | 0 | 144 | 100 % |
| `prototypes\01-tower-building\camera.ts` | 85 | Write | 2 | 0 | 85 | 100 % |
| `prototypes\01-tower-building\catalog.ts` | 190 | Write | 3 | 0 | 150 | 100 % |
| `prototypes\01-tower-building\geometry.ts` | 169 | Write | 0 | 0 | 169 | 100 % |
| `prototypes\01-tower-building\model.ts` | 51 | Write | 0 | 0 | 51 | 100 % |
| `prototypes\01-tower-building\render.ts` | 408 | Write | 13 | 0 | 408 | 100 % |
| `prototypes\01-tower-building\selftest.ts` | 556 | Write | 10 | 0 | 556 | 100 % |
| `prototypes\01-tower-building\shapes.ts` | 129 | Write | 0 | 0 | 129 | 100 % |
| `prototypes\01-tower-building\station.ts` | 226 | Write | 2 | 0 | 226 | 100 % |
| `prototypes\02-tab-transition\index.html` | 98 | Write | 0 | 0 | 98 | 100 % |
| `prototypes\02-tab-transition\main.ts` | 239 | Write | 6 | 0 | 239 | 100 % |
| `prototypes\package.json` | 22 | Write | 0 | 0 | 22 | 100 % |
| `src\app\actions.ts` | 417 | Write | 22 | 2 | 417 | 100 % |
| `src\app\rewards.ts` | 78 | Write | 3 | 0 | 78 | 100 % |
| `src\app\settings.ts` | 91 | Write | 0 | 0 | 91 | 100 % |
| `src\app\state.ts` | 461 | Write | 25 | 0 | 461 | 100 % |
| `src\app\view.ts` | 50 | Write | 0 | 0 | 50 | 100 % |
| `src\core\events.ts` | 155 | Write | 11 | 0 | 155 | 100 % |
| `src\core\geometry.ts` | 197 | Write | 2 | 0 | 197 | 100 % |
| `src\core\loop.ts` | 206 | Write | 2 | 0 | 206 | 100 % |
| `src\core\rng.ts` | 101 | Write | 0 | 0 | 101 | 100 % |
| `src\data\balance.ts` | 508 | Write | 14 | 3 | 508 | 100 % |
| `src\data\perks.ts` | 146 | Write | 1 | 0 | 146 | 100 % |
| `src\data\prestige.ts` | 340 | Write | 7 | 0 | 340 | 100 % |
| `src\data\types.ts` | 56 | Write | 0 | 0 | 56 | 100 % |
| `src\data\upgrades.ts` | 158 | Write | 2 | 0 | 158 | 100 % |
| `src\render\backdrop.ts` | 223 | Write | 6 | 0 | 223 | 100 % |
| `src\render\overlays.ts` | 210 | Write | 2 | 2 | 210 | 100 % |
| `src\render\scene.ts` | 325 | Write | 22 | 0 | 325 | 100 % |
| `src\render\sprites.ts` | 128 | Write | 0 | 0 | 128 | 100 % |
| `src\render\station.ts` | 365 | Write | 12 | 0 | 365 | 100 % |
| `src\render\theme.ts` | 204 | Write | 12 | 0 | 204 | 100 % |
| `src\selftest\guards.ts` | 239 | Write | 9 | 0 | 239 | 100 % |
| `src\selftest\index.ts` | 83 | Write | 17 | 0 | 83 | 100 % |
| `src\selftest\suites\camera.ts` | 219 | Write | 1 | 0 | 219 | 100 % |
| `src\selftest\suites\content.ts` | 502 | Write | 0 | 0 | 60 | 100 % |
| `src\selftest\suites\interaction.ts` | 418 | Write | 3 | 0 | 60 | 100 % |
| `src\selftest\suites\prestige.ts` | 354 | Write | 3 | 0 | 70 | 100 % |
| `src\selftest\suites\strings.ts` | 41 | Write | 0 | 0 | 41 | 100 % |
| `src\sim\abilities.ts` | 250 | Write | 0 | 0 | 250 | 100 % |
| `src\sim\buffs.ts` | 160 | Write | 2 | 0 | 160 | 100 % |
| `src\sim\targeting.ts` | 91 | Write | 2 | 0 | 91 | 100 % |
| `src\sim\towers.ts` | 268 | Write | 5 | 0 | 120 | 100 % |
| `src\sim\waves.ts` | 266 | Write | 9 | 0 | 266 | 100 % |
| `src\ui\abilities.ts` | 114 | Write | 3 | 0 | 114 | 100 % |
| `src\ui\base.ts` | 364 | Write | 17 | 0 | 364 | 100 % |
| `src\ui\hud.ts` | 667 | Write | 21 | 0 | 667 | 100 % |
| `src\ui\icons.ts` | 289 | Write | 9 | 0 | 28 | 100 % |
| `src\ui\input.ts` | 203 | Write | 2 | 0 | 45 | 100 % |
| `src\ui\shell.ts` | 294 | Write | 34 | 1 | 294 | 100 % |
| `src\ui\slide.ts` | 43 | Write | 0 | 0 | 43 | 100 % |
| `src\ui\tooltip.ts` | 73 | Write | 0 | 0 | 73 | 100 % |
| `src\ui\upgrades.ts` | 306 | Write | 7 | 0 | 306 | 100 % |

**Summe:** 160 Dateien. Nachweislich original: 65. Ohne Pruefmoeglichkeit: 56.
Edits angewandt: 1017, nicht anwendbar: 45.
