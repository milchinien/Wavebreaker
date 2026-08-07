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

  'hud.gold': 'Gold',
  'hud.wave': 'Wave {wave}',
  'hud.waveShort': 'Wave',
  'hud.wavePause': 'Wave {wave} incoming',
  'hud.level': 'LV {level}',
  'hud.speed': 'Speed x{factor}',
  'hud.speedShort': 'x{factor}',
  'hud.factor': 'x{value}',

  'view.combat': 'Combat',
  'view.base': 'Base',
  'view.upgrades': 'Upgrades',
  'view.prestige': 'Prestige',
  'view.settings': 'Settings',

  'upgrades.title': 'Upgrades',
  'upgrades.core': 'Core',
  'upgrades.global': 'Station',
  'upgrades.level': 'Lv {level}',
  'upgrades.max': 'Max',
  'upgrades.section': '{name} upgrades',
  'hud.costs': '$ {amount}',
  'hud.gain': '+{amount}',

  'status.damage': 'Damage',
  'status.goldFactor': 'Gold factor',
  'status.stationHp': 'Station hull',
  'status.waveHp': 'Enemy hull this wave',
  'status.waveDamage': 'Enemy damage this wave',
  'status.progress': '{done} / {total} down',
  'status.nextWave': 'Next wave in {seconds}s',
  'status.waveReady': 'Next wave on your call',

  'shop.title': 'Management',
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
  'settings.hint': 'Keyboard: 1/2/4 speed · B buff lines · F reset camera · +/- zoom',

  'hud.onField': '{amount} on field',
  'hud.auto': 'AUTO',
  'hud.autoOn': 'Auto waves on',
  'hud.autoOff': 'Auto waves off',
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
  'base.slots': '{used} / {total} slots',
  'base.empty': 'No modules in storage.',
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

  /*
   * Die ausfuehrliche Auskunft zu einer Perk-Karte - sie kommt, wenn der Zeiger drei
   * Sekunden auf der Karte steht. Auf der Karte selbst steht nur der Betrag ("Range +14%");
   * hier steht, **was** dieser Wert im Spiel tut. Ein bis zwei Saetze, denn der Kampf laeuft
   * daneben weiter.
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
  'perk.info.stacks': 'Perks of the same kind add up — you hold {count}.',
  'perk.info.first': 'Your first perk of this kind.',

  'abilities.title': 'Abilities',
  'abilities.unlock': 'Unlock',
  'abilities.equip': 'Equip',
  'abilities.equipped': 'Equipped',
  'abilities.slots': '{used} / {total} slots',
  'abilities.locked': 'Locked — unlock with gold',
  'abilities.ready': 'Ready',
  'abilities.combatOnly': 'Only in combat',
  'abilities.none': 'No ability equipped yet.',

  'area.tech': 'Special towers',
  'area.helpers': 'Helpers',

  'event.title': 'Event',
  'event.dismiss': 'Walk away',

  'trader.title': 'Supply Drone',
  'trader.hint': 'It lifts off when you close this. Nothing here comes back.',
  'trader.leave': 'Send it off',
  'trader.sold': 'Bought',
  'trader.tooPoor': 'Not enough gold',
  'trader.perk': 'Permanent this run: {name}',

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
  'settings.hints': 'Replay hints',
  'settings.hintsDone': 'Hints reset',

  'save.restored': 'Progress restored.',
  'save.fresh': 'New station initialised.',
  'save.corrupt': 'Saved game could not be read. Starting fresh.',
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
