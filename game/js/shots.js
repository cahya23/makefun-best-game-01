// Emberline — deterministic screenshot scenes. A ?shot=<name>&seed=<n> URL
// builds one fixed scene, runs it a fixed number of steps with a seeded
// RNG, renders once and sets window.__shotReady. The screenshots in
// screenshots/ are renders of exactly these scenes: nothing is edited or
// composited afterwards.
//
//   ?shot=title    the title screen over the sleeping vale
//   ?shot=play     wave 3 in full swing, keeper firing
//   ?shot=upgrade  the upgrade choice after wave 2
//   ?shot=victory  the dawn-returns screen after wave 10
//   ?shot=gameover the light-goes-out screen

import { mulberry32, rand } from './utils.js';
import { spawnEnemy } from './enemies.js';
import { Bolt, Ember, Particle } from './projectiles.js';
import { rollChoices } from './upgrades.js';

function seedAmbient(game, n) {
  for (let i = 0; i < n; i += 1) {
    game.particles.push(new Particle(
      rand(game.rng, 60, game.W - 60), rand(game.rng, game.H - 120, game.H + 6),
      rand(game.rng, -8, 8), rand(game.rng, -34, -16),
      rand(game.rng, 1.5, 3), rand(game.rng, 1.5, 3), '#ffb347',
    ));
  }
}

function seedBattlefield(game) {
  // A lively mid-wave scene: wisps closing in, a spitter at range, a
  // splitter and a brute, bolts in the air, embers on the ground.
  const place = [
    ['wisp', 640, 180],
    ['wisp', 300, 150],
    ['wisp', 720, 420],
    ['spitter', 800, 170],
    ['splitter', 210, 300],
    ['brute', 700, 480],
    ['wisp', 420, 90],
    ['mote', 520, 210],
  ];
  for (const [kind, x, y] of place) {
    game.enemies.push(spawnEnemy(kind, x, y, 3, game.rng));
  }
  game.bolts.push(new Bolt(430, 330, 380, -260, 1, 0));
  game.bolts.push(new Bolt(450, 310, 420, -180, 1, 0));
  game.bolts.push(new Bolt(400, 350, 300, -320, 1, 0));
  game.embers.push(new Ember(560, 420, 3, game.rng));
  game.embers.push(new Ember(380, 460, 5, game.rng));
  game.embers.push(new Ember(610, 300, 3, game.rng));
  game.spawnBurst(640, 200, '#a78bfa', 10, 150);
  game.spawnBurst(300, 170, '#ffd76a', 8, 120);
}

/** Build one shot scene on `game`, render it once, flag readiness. */
export function runShot(game, name, seed) {
  game.rng = mulberry32(seed >>> 0);
  game.time = 2.0;
  const STEP = 1 / 60;

  if (name === 'title') {
    game.state = 'title';
    seedAmbient(game, 26);
    for (let i = 0; i < 120; i += 1) game.update(STEP);
  } else if (name === 'play') {
    game.state = 'playing';
    game.waves.wave = 3;
    game.waves.active = true;
    game.score = 2480;
    game.kills = 31;
    game.playTime = 96;
    game.player.x = 400;
    game.player.y = 380;
    game.player.embers = 27;
    game.player.hearts = 3;
    game.input.mouse.x = 700;
    game.input.mouse.y = 200;
    game.input.mouse.down = true;
    seedBattlefield(game);
    for (let i = 0; i < 150; i += 1) game.update(STEP);
    game.input.mouse.down = false;
  } else if (name === 'upgrade') {
    game.state = 'playing';
    game.waves.wave = 2;
    game.score = 1930;
    game.kills = 22;
    game.playTime = 74;
    game.player.x = 420;
    game.player.y = 400;
    game.player.embers = 52;
    game.lantern.hp = 82;
    seedBattlefield(game);
    game.enemies = [];
    for (let i = 0; i < 60; i += 1) game.update(STEP);
    game.state = 'upgrade';
    game.upgradeChoices = rollChoices(game.rng, game.player, game, 3);
  } else if (name === 'victory') {
    game.state = 'over';
    game.won = true;
    game.score = 12480;
    game.kills = 96;
    game.waves.wave = 10;
    game.playTime = 382;
    game.best = 8930;
    seedAmbient(game, 30);
    game.spawnBurst(game.lantern.x, game.lantern.y - 40, '#ffd76a', 40, 260);
    for (let i = 0; i < 60; i += 1) game.update(STEP);
  } else if (name === 'gameover') {
    game.state = 'over';
    game.won = false;
    game.endReason = 'The lantern shattered — the night swallows the vale.';
    game.score = 3420;
    game.kills = 41;
    game.waves.wave = 6;
    game.playTime = 214;
    game.lantern.hp = 0;
    game.best = 8930;
    for (let i = 0; i < 60; i += 1) game.update(STEP);
  } else {
    game.state = 'title';
  }

  game.render();
  window.__shotReady = true;
}
