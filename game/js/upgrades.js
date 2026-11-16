// Emberline — the upgrade cards offered between waves. One pick per
// cleared wave, paid in embers. Cards the keeper cannot afford are shown
// dimmed; maxed-out cards leave the pool.

import { shuffle } from './utils.js';

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Ember Shot',
    glyph: '✦',
    color: '#ffb347',
    desc: '+1 bolt damage',
    cost: 20,
    can(player) { return true; },
    apply(player) { player.stats.damage += 1; },
  },
  {
    id: 'rapid',
    name: 'Rapid Wick',
    glyph: '≫',
    color: '#7dd3fc',
    desc: '+25% fire rate',
    cost: 20,
    can(player) { return true; },
    apply(player) { player.stats.fireRate *= 1.25; },
  },
  {
    id: 'twin',
    name: 'Twin Flame',
    glyph: '✳',
    color: '#f472b6',
    desc: '+1 bolt per shot',
    cost: 45,
    can(player) { return player.stats.multishot < 3; },
    apply(player) { player.stats.multishot += 1; },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    glyph: '➶',
    color: '#c4b5fd',
    desc: 'Bolts pierce +1 enemy',
    cost: 35,
    can(player) { return player.stats.pierce < 3; },
    apply(player) { player.stats.pierce += 1; },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    glyph: '▲',
    color: '#86efac',
    desc: '+15% move speed',
    cost: 15,
    can(player) { return player.speed < 340; },
    apply(player) { player.speed *= 1.15; },
  },
  {
    id: 'heart',
    name: 'Warm Heart',
    glyph: '♥',
    color: '#ff6b6b',
    desc: '+1 max heart, heal 1',
    cost: 30,
    can(player) { return player.stats.maxHearts < 6; },
    apply(player) {
      player.stats.maxHearts += 1;
      player.hearts = Math.min(player.stats.maxHearts, player.hearts + 1);
    },
  },
  {
    id: 'mend',
    name: 'Mend the Lantern',
    glyph: '✚',
    color: '#ffd76a',
    desc: 'Repair lantern +40 HP',
    cost: 15,
    can(player, game) { return game.lantern.hp < game.lantern.maxHp; },
    apply(player, game) {
      game.lantern.hp = Math.min(game.lantern.maxHp, game.lantern.hp + 40);
    },
  },
  {
    id: 'bomb',
    name: 'Flash Bomb',
    glyph: '◉',
    color: '#fde68a',
    desc: '+1 bomb (Space)',
    cost: 25,
    can(player) { return player.stats.bombMax < 3; },
    apply(player) {
      player.stats.bombMax += 1;
      player.bombs += 1;
    },
  },
];

/** Roll `count` distinct affordable-or-not choices from the pool. */
export function rollChoices(rng, player, game, count) {
  const pool = UPGRADES.filter((u) => u.can(player, game));
  shuffle(rng, pool);
  return pool.slice(0, count);
}

/** Apply a chosen card: pay, mutate, chime. */
export function applyUpgrade(choice, player, game) {
  player.embers -= choice.cost;
  choice.apply(player, game);
  game.sfx.upgrade();
}
