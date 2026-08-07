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
  'upgrades.tipTitle': '{group} - {path}',
  'upgrades.tipLevel': 'Lv {level} / {max}',
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
  'prestige.blocked': 'Locked',
  'prestige.count': 'Prestige {count}',

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

