/**
 * Alle Spielertexte an einer Stelle.
 *
 * Spielsprache ist Englisch (GDD 16 Abschnitt 1), Dokumentationssprache Deutsch. Kein
 * Text steht im Code von `ui/` oder `render/` - jeder laeuft ueber `t()`. Eine deutsche
 * Fassung ist damit spaeter eine zweite Tabelle, keine Codeaenderung.
 *
 * Platzhalter in geschweiften Klammern: `t('hud.wave', { wave: 12 })`.
 */

export const STRINGS = {
  'game.title': 'WAVEBREAKER',

  /* Startbildschirm (`ui/boot.ts`). Zwei Zustaende, zwei Texte - mehr steht dort nicht. */
  'boot.loading': 'LOADING',
  'boot.press': 'PRESS TO START',
  'boot.tagline': 'MODULAR COMBAT STATION',

  'hud.gold': 'Gold',
  'hud.wave': 'Wave {wave}',
  'hud.waveShort': 'Wave',
  'hud.wavePause': 'Wave {wave} incoming',
  'hud.level': 'LV {level}',
  'hud.speed': 'Speed x{factor}',
  'hud.speedShort': 'x{factor}',
  'hud.factor': 'x{value}',
  'hud.league': 'League',
  'hud.prevLeague': 'Drop to the league below',
  'hud.nextLeague': 'Move up to the next league',
  /* Der Rang als Kuerzel neben dem Namen - "L3" passt, wo "League 3" die Zeile sprengt. */
  'league.rank': 'L{index}',

  /*
   * Das Aufstiegsfenster. Es haelt den Kampf **nicht** an (GDD 02 Abschnitt 6) - beide
   * Antworten schalten die Liga frei, der Knopf entscheidet nur, ob jetzt gewechselt wird.
   */
  'league.title': 'NEW LEAGUE',
  'league.hint': 'Enemies x{power} tougher · rewards x{reward} · begins at wave 1',
  'league.enter': 'Enter now',
  'league.stay': 'Stay here',

  /*
   * Die zehn Ligen (`data/leagues.ts`, docs/liga-system.md).
   *
   * Der Schluessel **ist** die Kennung der Liga - `t(def.id)` liefert ihren Namen. Damit
   * steht kein Spielertext im Datensatz, anders als bei den Turmarten, wo der englische
   * Name heute noch als Literal danebensteht.
   *
   * Die Namen steigern sich mit der Leiter: Die ersten klingen nach Ort, die letzten nach
   * Zustand. Wer in "The Breach" steht, soll nicht mehr das Gefuehl haben, irgendwohin
   * gereist zu sein.
   */
  'league.drift': 'Outer Drift',
  /*
   * "Shard Belt" und nicht "Shattered Belt": Der laengere Name passte als einziger nicht in
   * die Ligazeile (Waechter in `selftest/guards.ts`), und er war ohnehin der Ausreisser -
   * alle uebrigen sind zwei kurze Woerter.
   */
  'league.belt': 'Shard Belt',
  'league.ember': 'Ember Reach',
  'league.verge': 'Iron Verge',
  'league.span': 'Crimson Span',
  'league.tide': 'Hollow Tide',
  'league.deep': 'Starless Deep',
  'league.spiral': 'Ashen Spiral',
  'league.maw': 'Radiant Maw',
  'league.breach': 'The Breach',

  'view.combat': 'Combat',
  'view.base': 'Base',
  'view.upgrades': 'Upgrades',
  'view.prestige': 'Prestige',
  'view.settings': 'Settings',

  /*
   * Was hinter den fuenf Navigationsknoepfen liegt.
   *
   * Die Knoepfe tragen ein Zeichen und sonst nichts - wer das Spiel zum ersten Mal sieht,
   * kann aus fuenf Piktogrammen nicht ablesen, dass hinter einem davon die einzige
   * Bauanleitung steht. Ein Wort als Marke reicht dafuer nicht: "Base" sagt, wie der Bereich
   * heisst, nicht was man dort tut.
   *
   * Je ein Satz, der mit einem Verb anfaengt. Was man dort TUT, nicht was es IST.
   */
  'view.base.about': 'Place modules on the station and manage your inventory.',
  'view.combat.about': 'Watch the fight, collect gold, and start the next wave.',
  'view.upgrades.about': 'Spend gold on permanent stat upgrades for your towers.',
  'view.prestige.about': 'Reset the run for prestige points and lasting unlocks.',
  'view.settings.about': 'Sound, effects and everything else you can switch off.',

  'upgrades.title': 'Upgrades',
  'upgrades.core': 'Core',
  'upgrades.global': 'Station',
  /*
   * Die vier Upgrade-Fenster (`docs/upgrade-umbau.md`). Sie sind **Tiefenstufen, keine
   * Themen** - deshalb heissen sie nicht "Core" und "Towers", sondern nach dem, was ein
   * Spieler in ihnen aufbaut. Das vierte ist ein angekuendigter Platz und traegt darum kein
   * Versprechen, sondern nur sein Schloss.
   */
  'upgrades.window1': 'Foundation',
  'upgrades.window2': 'Systems',
  'upgrades.window3': 'Doctrine',
  'upgrades.window4': 'Sealed',
  /* Was hinter den Reitern liegt - sie tragen ein Zeichen und sonst nichts. */
  'upgrades.window1.about': 'The upgrades every run starts with.',
  'upgrades.window2.about': 'Deeper systems. Unlock them with Second Array.',
  'upgrades.window3.about': 'Endgame doctrines. Unlock them with Third Array.',
  'upgrades.window4.about': 'Sealed. Nothing here yet.',
  'upgrades.locked': 'Locked',
  /* Warum eine Kachel nicht kaufbar ist. Vier Gruende, vier Saetze - "kein Preis" allein
     sagt keinen davon (siehe `describe` in `ui/upgrades.ts`). */
  'upgrades.needs': 'Requires {name}',
  'upgrades.blocked': 'Blocked by {name}',
  'upgrades.level': 'Lv {level}',
  'upgrades.max': 'Max',
  'upgrades.section': '{name} upgrades',
  'upgrades.none': 'No level yet',
  'upgrades.tipLevel': 'Lv {level} / {max}',
  'upgrades.tipTitle': '{group} - {path}',
  /*
   * Der Wert auf einer Upgrade-Kachel traegt **immer** seine Einheit (`ui/upgrades.ts`).
   * Daneben steht der Preis, und der traegt das Waehrungszeichen: Zwei nackte Zahlen
   * nebeneinander liessen den Spieler raten, welche davon das Gold kostet.
   */
  'upgrades.unitDamage': '{value} dmg',
  'upgrades.unitRate': '{value}/sec',
  'upgrades.unitRange': '{value} m',
  'upgrades.unitSpeed': '{value} m/s',
  'upgrades.unitHp': '{value} HP',
  'upgrades.unitGold': '{value} gold',
  'upgrades.unitSeconds': '{value}s',
  'upgrades.unitHops': '{value} hops',
  'upgrades.unitDrones': '{value} drones',
  'upgrades.unitSlots': '{value} slots',
  'upgrades.unitRegen': '{value} HP/sec',
  'upgrades.unitPlain': '{value}',
  /* Die vier Arten, wie sie im Hinweis oben rechts stehen (`docs/upgrade-umbau.md` §3). */
  'upgrades.kindEndless': 'Endless',
  'upgrades.kindExtension': 'Upgrade',
  'upgrades.kindCharge': 'Charge',
  'upgrades.kindDirective': 'Directive',
  /* Die Zeilen des Hinweises. */
  'upgrades.perLevel': 'Per level',
  'upgrades.total': 'Total',
  'upgrades.levelRow': 'Level',
  'upgrades.costRow': 'Cost',
  'upgrades.sealed': 'Not available yet',
  'hud.costs': '$ {amount}',
  'hud.gain': '+{amount}',
  /* Die Schadenszahl ueber dem Feld. Nur der Betrag - kein Vorzeichen, keine Einheit:
     Bei zwanzig Zahlen gleichzeitig ist jedes zusaetzliche Zeichen ein Zeichen zu viel. */
  'hud.damage': '{amount}',

  'status.damage': 'Damage',
  'status.goldFactor': 'Gold factor',
  'status.stationHp': 'Station hull',
  'status.waveHp': 'Enemy hull this wave',
  'status.waveDamage': 'Enemy damage this wave',
  'status.progress': '{done} / {total} down',
  'status.nextWave': 'Next wave in {seconds}s',

  'shop.buyTower': 'Buy tower',
  'shop.price': '$ {amount}',
  'shop.tooPoor': 'Not enough gold',
  'shop.melt': 'Melt {count} / {need}',
  'shop.meltHint': 'Pick three towers in storage to melt them into a free draw.',
  'shop.meltShort': 'Melt',
  'shop.cancel': 'Cancel',

  'offer.title': 'Choose a tower',
  'offer.meltTitle': 'Melted — choose a tower',
  'offer.discard': 'Discard',
  'offer.noTraits': 'No modifiers',
  'offer.boost': 'Every neighbour gets',
  'offer.gain': '({base} +{gain})',
  'offer.hint': 'One draw · one module',
  'offer.take': 'Take it',

  'prestige.title': 'Prestige',
  'prestige.points': 'Prestige points',
  'prestige.earn': 'This run is worth {points}',
  'prestige.locked': 'Needs {amount} gold earned this run',
  'prestige.confirm': 'Reset the run',
  'prestige.warnGold': '{amount} gold will be lost',
  'prestige.resets': 'Resets: waves, gold, towers, upgrades, level, perks, abilities',
  'prestige.keeps': 'Keeps: prestige points and everything unlocked here',
  'prestige.bought': 'Owned',
  'prestige.count': 'Prestige {count}',
  'prestige.tipTitle': '{area} - {node}',
  'prestige.needs': 'Needs {names}',
  'prestige.cost': '{amount} points',
  'prestige.blocked': 'Locked',

  'area.economy': 'Economy',
  'area.towers': 'Towers',
  'area.speed': 'Game speed',
  'area.rarity': 'Rarities',
  'area.traits': 'Modifiers',

  'settings.speed': 'Game speed',
  'settings.buffLines': 'Buff lines',
  'settings.camera': 'Reset camera',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.reset': 'Reset',
  'settings.hint': 'Keyboard: 1/2/4 speed · B buff lines · M mute · F reset camera · +/- zoom',

  'hud.onField': '{amount} on field',
  'hud.auto': 'AUTO',
  'hud.autoOn': 'Auto waves on — a cleared wave moves you up',
  'hud.autoOff': 'Auto waves off — this wave repeats',
  'hud.prevWave': 'Previous wave',
  'hud.nextWave': 'Next wave',
  'hud.boss': 'BOSS',
  'hud.waveLost': 'Wave {wave} lost — try {attempt}',
  /* Der Ausgang einer Welle, gross in der Mitte des Feldes. Ein Wort, damit er sich in der
     Zeit, die er steht, auch lesen laesst. */
  'hud.victory': 'VICTORY',
  'hud.defeat': 'DEFEAT',

  'base.inventory': 'Storage',
  'base.station': 'Station',
  /* Nur die Zahlen - was sie bedeuten, steht als Ueberschrift darueber (`base.docking`). */
  'base.slots': '{used} / {total}',
  /*
   * Die Dockanzeige der Basis (`ui/base.ts`).
   *
   * "Docking points" und nicht "slots": Das Wort steht neben einer Reihe Punkte, von denen
   * jeder eine Kante der Station ist - und die Station hat Kanten, keine Faecher.
   *
   * Der Nachsatz nennt die Ausbauten **beim Namen**, und die Namen kommen aus dem Katalog
   * statt aus diesem Text: Wer im Katalog einen Pfad umbenennt oder einen vierten eintraegt,
   * soll das hier nicht nachpflegen muessen - ein Hinweis, der auf ein Upgrade zeigt, das es
   * nicht mehr gibt, ist schlimmer als keiner.
   */
  'base.docking': 'Docking points',
  'base.dockingFree': '{count} free',
  'base.dockingFull': 'All taken',
  'base.dockingMore': 'More points: {names}',
  'base.empty': 'No modules in storage.',
  'base.emptyHint': 'Buy your first tower below.',
  'base.placeHint': 'Pick a module, then click a glowing edge.',
  'base.building': 'Placing {name} — right click or Esc to cancel',
  'base.placed': 'placed',
  'base.edges': '{count} edges',

  'detail.none': 'Select a module to inspect it.',
  'detail.neighbours': 'Neighbours {count} / {max}',
  'detail.boosting': 'Boosting {count} modules',
  'detail.boostingNone': 'Boosting nothing — build around it',
  'detail.sources': 'Buffs',
  'detail.traits': 'Modifiers',
  'detail.capped': 'capped',
  'detail.core': 'Cannot be moved or removed.',

  'stat.damage': 'Damage',
  'stat.attackSpeed': 'Attack rate',
  'stat.range': 'Range',
  'stat.critChance': 'Crit chance',
  'stat.projectileSpeed': 'Projectile speed',

  'rarity.common': 'Common',
  'rarity.rare': 'Rare',
  'rarity.epic': 'Epic',
  'rarity.legendary': 'Legendary',
  'rarity.mythic': 'Mythic',

  'error.overlap': 'No room — would clip another module',
  'error.no_slots': 'All tower slots taken',
  'error.not_owned': 'Module is not in storage',
  'error.no_edge': 'No docking edge nearby',
  'error.not_placed': 'Module is not on the station',
  'error.is_core': 'The core cannot be removed',
  'error.would_disconnect': 'Would cut the station apart — remove it instead',

  'detach.warning': 'Removing takes {count} more modules with it',
  'detach.warningOne': 'Removing takes 1 more module with it',

  'hud.xp': '{into} / {need} XP',
  'hud.xpMax': 'Max level',

  'levelup.title': 'Level {level}',
  'levelup.hint': 'Choose one upgrade',
  'levelup.more': '{count} more waiting',
  'levelup.taken': 'owned x{count}',
  'levelup.take': 'Take it',

  /*
   * Die ausfuehrliche Auskunft zu einer Perk-Karte - sie steht auf deren **Rueckseite** und
   * kommt, sobald der Zeiger die Karte umdreht (`ui/cards.ts`). Vorn steht nur der Betrag
   * ("Range +14%"); hier steht, **was** dieser Wert im Spiel tut. Ein bis zwei Saetze, denn
   * der Kampf laeuft daneben weiter.
   *
   * Ein Schluessel je Kampfwert und je Run-Groesse, gebildet aus dem Feld des Perk-Effekts.
   * Ein neuer Perk mit einer neuen Wirkung braucht deshalb genau eine Zeile hier - der
   * Selbsttest in `selftest/suites/progression.ts` besteht darauf.
   */
  'perk.info.damage': 'Raises the damage of every module on the station. Adds up with tower upgrades and neighbour buffs.',
  'perk.info.attackSpeed': 'Every module fires more often — the same shot lands more times per second.',
  'perk.info.range': 'Every module reaches further and opens fire earlier, so enemies spend longer under it.',
  'perk.info.critChance': 'Chance for a shot to land as a critical hit and deal double damage.',
  'perk.info.projectileSpeed': 'Shots travel faster and lose less of their damage to a target that has already moved on.',
  'perk.info.stationHp': 'Raises the hull of the station. It takes more hits before the run is over.',
  'perk.info.goldBonus': 'Every enemy leaves more gold behind — towers and upgrades come sooner.',
  'perk.info.collectRadius': 'Coins are picked up from further away, so less of a wave is left lying on the field.',
  'perk.info.xpBonus': 'Every kill grants more experience. Levels — and the next choice — come sooner.',
  'perk.info.now': 'Now',
  'perk.info.after': 'With this pick',

  'abilities.title': 'Abilities',
  'abilities.unlock': 'Unlock',
  'abilities.equip': 'Equip',
  'abilities.equipped': 'Equipped',
  'abilities.slots': '{used} / {total} slots',
  'abilities.locked': 'Locked — unlock with gold',
  'abilities.ready': 'Ready',
  'abilities.combatOnly': 'Only in combat',
  'abilities.none': 'No ability equipped yet.',
  'abilities.short': 'ABL',
  'abilities.empty': 'Empty slot — equip an ability in Upgrades',

  'area.tech': 'Special towers',
  'area.helpers': 'Helpers',

  'event.title': 'Event',
  'event.dismiss': 'Walk away',
  'event.choose': 'Choose',
  // Wo bei den anderen Karten die Seltenheit steht, steht bei einer Ereignisoption ihre
  // Art. Eine Option hat keinen Rang - aber sie hat eine Folge, und die ist hier das,
  // was die drei ausliegenden Karten voneinander unterscheidet.
  'event.kind.reward': 'Payout',
  'event.kind.boon': 'Boost',
  'event.kind.hazard': 'Risk',
  'event.kind.spawn': 'Ambush',

  'trader.title': 'Supply Drone',
  'trader.hint': 'It lifts off when you close this. Nothing here comes back.',
  'trader.leave': 'Send it off',
  'trader.buy': 'Buy',
  'trader.sold': 'Bought',
  'trader.tooPoor': 'Not enough gold',
  'trader.perk': 'Permanent this run: {name}',
  'trader.upgrade': '{levels}x {name}',

  'offline.title': 'While you were away',
  'offline.time': 'Time away',
  'offline.counted': 'Counted',
  'offline.kills': 'Enemies destroyed',
  'offline.waves': 'Wave {from} to {to}',
  'offline.gold': 'Gold',
  'offline.xp': 'Experience',
  'offline.level': 'Levels',
  'offline.levels': '{count} gained — pick your perks',
  'offline.close': 'Continue',
  'offline.locked': 'Offline production is not unlocked yet.',

  'hint.gotIt': 'Got it',
  // Die acht Hinweise aus GDD 14 Abschnitt 4a. Ein bis zwei Saetze, kein Fliesstext -
  // sie stehen neben dem Spielfeld und halten nichts an.
  'hint.collect': 'Move the mouse over coins to collect them.',
  'hint.upgrade': 'Upgrade your core in the menu below.',
  'hint.buyTower': 'Buy a tower and dock it to your station.',
  'hint.buff':
    'Buff towers boost every module they share an edge with — place them early and build around them.',
  'hint.level': 'Every level lets you pick an upgrade.',
  'hint.boss': 'Bosses are tough — the wave keeps coming while you fight one.',
  'hint.melt': 'Melt three spare towers into a free draw.',
  'hint.prestige': 'Prestige resets this run and makes you permanently stronger.',

  'settings.effects': 'Combat effects',
  'settings.motion': 'Menu animation',
  'settings.volume': 'Volume',
  'settings.volumeStep': '{value}%',
  'settings.mute': 'Mute',
  'settings.unmute': 'Unmute',
  /* Die drei Klanggruppen (`app/mixer.ts`). "Music" meint hier die Zaesuren - Wellen,
     Boss, Aufstieg, Prestige; eine durchlaufende Schleife gibt es nicht. */
  'settings.busMusic': 'Music',
  'settings.busSfx': 'Sound effects',
  'settings.busUi': 'Interface',
  'settings.hints': 'Replay hints',
  'settings.hintsDone': 'Hints reset',

  'save.restored': 'Progress restored.',
  'save.fresh': 'New station initialised.',
  'save.corrupt': 'Saved game could not be read. Starting fresh.',

  // [REKONSTRUIERT] Gruppe fehlte in der rekonstruierten Tabelle. Schluessel und
  // Texte stammen woertlich aus dem Sitzungsmaterial, nicht aus eigener Erfindung.
  'category.area': 'Area',
  'category.attack': 'Attack',
  'category.buff': 'Amplifier',
  'category.special': 'Special',
  'category.support': 'Support',
} as const

export type StringKey = keyof typeof STRINGS
export type StringParams = Record<string, string | number>

export function t(key: StringKey, params?: StringParams): string {
  const template: string = STRINGS[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/** Existiert der Schluessel? Fuer den Selbsttest, der die UI gegen Tippfehler absichert. */
export function hasString(key: string): key is StringKey {
  return Object.prototype.hasOwnProperty.call(STRINGS, key)
}