// Emberline — the Game: state machine, fixed-step loop, collisions and
// scoring. The keeper defends the lantern through ten waves; the tenth
// ends with the Gloom Herald, and beating it brings the dawn.

import { TAU, clamp, mulberry32, rand } from './utils.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Player } from './player.js';
import { Orb, Ember, Particle, Floater, stepAll, drawAll } from './projectiles.js';
import { spawnEnemy, randomSmallKind } from './enemies.js';
import { WaveManager, TOTAL_WAVES } from './waves.js';
import { rollChoices, applyUpgrade } from './upgrades.js';
import {
  drawBackground, drawLantern, drawHUD, drawTitleScreen,
  drawUpgradeScreen, drawEndScreen, drawPauseScreen, cardRects,
} from './render.js';
import { runShot } from './shots.js';

export const W = 960;
export const H = 600;
const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = W;
    this.H = H;
    this.rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    this.input = new Input(canvas);
    this.sfx = new Sfx();
    this.player = new Player(W / 2, H - 120);
    this.lantern = { x: W / 2, y: H / 2 - 10, hp: 140, maxHp: 140, radius: 26 };
    this.waves = new WaveManager(this);
    this.enemies = [];
    this.bolts = [];
    this.orbs = [];
    this.embers = [];
    this.particles = [];
    this.floaters = [];
    this.pendingSpawns = [];
    this.state = 'title';
    this.prevState = 'title';
    this.score = 0;
    this.kills = 0;
    this.playTime = 0;
    this.time = 0;
    this.shake = 0;
    this.won = false;
    this.endReason = '';
    this.upgradeChoices = [];
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('emberline-best') || 0) || 0;
    } catch (_e) {
      this.best = 0;
    }
    this.stars = [];
    for (let i = 0; i < 90; i += 1) {
      this.stars.push({
        x: rand(this.rng, 0, W),
        y: rand(this.rng, 0, H * 0.6),
        r: rand(this.rng, 0.6, 1.8),
        speed: rand(this.rng, 0.5, 2),
        phase: rand(this.rng, 0, TAU),
        alpha: rand(this.rng, 0.4, 1),
      });
    }
    this.lanternHitCd = 0;
    this.ambientTimer = 0;
    this.acc = 0;
    this.last = 0;
  }

  // ----- run control -------------------------------------------------------

  start() {
    this.player.reset(W / 2, H - 120);
    this.lantern.hp = this.lantern.maxHp;
    this.enemies = [];
    this.bolts = [];
    this.orbs = [];
    this.embers = [];
    this.particles = [];
    this.floaters = [];
    this.pendingSpawns = [];
    this.score = 0;
    this.kills = 0;
    this.playTime = 0;
    this.state = 'playing';
    this.waves.startWave(1);
  }

  gameOver(won, reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.won = won;
    this.endReason = reason || '';
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('emberline-best', String(this.best));
      } catch (_e) { /* storage unavailable; best is session-only */ }
    }
    if (won) this.sfx.win();
    else this.sfx.lose();
    this.spawnBurst(this.lantern.x, this.lantern.y - 40, won ? '#ffd76a' : '#a78bfa', 40, 260);
  }

  onWaveCleared() {
    if (this.waves.wave >= TOTAL_WAVES) {
      this.gameOver(true);
      return;
    }
    this.score += 100 * this.waves.wave;
    this.state = 'upgrade';
    this.upgradeChoices = rollChoices(this.rng, this.player, this, 3);
  }

  // ----- combat helpers ----------------------------------------------------

  addShake(amount) {
    this.shake = Math.min(12, this.shake + amount);
  }

  addScore(n) {
    this.score += n;
  }

  spawnBurst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng() * TAU;
      const s = rand(this.rng, speed * 0.3, speed);
      this.particles.push(new Particle(
        x, y, Math.cos(a) * s, Math.sin(a) * s,
        rand(this.rng, 0.3, 0.8), rand(this.rng, 1.5, 3.5), color,
      ));
    }
  }

  spawnFloater(x, y, text, color, size) {
    this.floaters.push(new Floater(x, y, text, color, size));
  }

  fireOrb(x, y, vx, vy, damage) {
    this.orbs.push(new Orb(x, y, vx, vy, damage));
  }

  queueEnemy(enemy) {
    this.pendingSpawns.push(enemy);
  }

  summonWisps(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const kind = randomSmallKind(this.rng);
      this.queueEnemy(spawnEnemy(kind, x + rand(this.rng, -40, 40), y + rand(this.rng, -40, 40), this.waves.wave, this.rng));
    }
    this.spawnBurst(x, y, '#c4b5fd', 16, 140);
  }

  damageLantern(amount, x, y) {
    if (this.state !== 'playing') return;
    this.lantern.hp -= amount;
    if (this.rng() < 0.06) {
      this.particles.push(new Particle(x, y, rand(this.rng, -40, 40), rand(this.rng, -60, -10), 0.4, 2, '#ff8c42'));
    }
    if (this.lantern.hp <= 0) {
      this.lantern.hp = 0;
      this.gameOver(false, 'The lantern shattered — the night swallows the vale.');
    }
  }

  onEnemyKilled(enemy) {
    this.kills += 1;
    this.score += enemy.score;
    this.spawnBurst(enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 60 : 12, enemy.kind === 'boss' ? 300 : 170);
    // Embers scatter in 1-3 pickups.
    let left = enemy.ember;
    while (left > 0) {
      const v = Math.min(left, 5);
      this.embers.push(new Ember(enemy.x, enemy.y, v, this.rng));
      left -= v;
    }
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        this.queueEnemy(spawnEnemy('mote', enemy.x + rand(this.rng, -14, 14), enemy.y + rand(this.rng, -14, 14), this.waves.wave, this.rng));
      }
    }
    if (enemy.kind === 'brute') this.spawnFloater(enemy.x, enemy.y - 20, `+${enemy.score}`, '#ffd76a', 15);
    if (enemy.kind === 'boss') this.spawnFloater(enemy.x, enemy.y - 50, `+${enemy.score}`, '#ffd76a', 20);
    this.sfx.enemyDie();
    this.addShake(enemy.kind === 'boss' ? 10 : 2);
  }

  useBomb() {
    if (this.state !== 'playing' || this.player.bombs <= 0) return;
    this.player.bombs -= 1;
    this.sfx.bomb();
    this.addShake(11);
    this.spawnBurst(this.player.x, this.player.y, '#ffe9b0', 46, 340);
    for (const e of [...this.enemies]) {
      if (e.dead) continue;
      if (e.kind === 'boss') {
        if (e.damage(30, this)) this.onEnemyKilled(e);
      } else if (e.damage(999, this)) {
        this.onEnemyKilled(e);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  // ----- update ------------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    this.lanternHitCd -= dt;
    const input = this.input;

    if (input.wasPressed('KeyM')) {
      this.sfx.setMuted(!this.sfx.muted);
    }

    if (this.state === 'title') {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 0.25;
        this.particles.push(new Particle(
          rand(this.rng, 40, W - 40), H + 6, rand(this.rng, -8, 8), rand(this.rng, -34, -16),
          rand(this.rng, 2, 3.5), rand(this.rng, 1.5, 3), '#ffb347',
        ));
      }
      stepAll(this.particles, dt);
      if (input.wasPressed('Enter', 'NumpadEnter') || input.mouse.clicked) {
        this.sfx.ensure();
        this.sfx.click();
        this.start();
      }
      return;
    }

    if (this.state === 'over') {
      stepAll(this.particles, dt);
      stepAll(this.floaters, dt);
      if (input.wasPressed('KeyR', 'Enter', 'NumpadEnter') || input.mouse.clicked) {
        this.sfx.ensure();
        this.sfx.click();
        this.start();
      }
      return;
    }

    if (this.state === 'upgrade') {
      stepAll(this.particles, dt);
      // Keys 1-3 pick a card; Enter skips.
      for (let i = 0; i < this.upgradeChoices.length; i += 1) {
        if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) {
          this.pickUpgrade(i);
          return;
        }
      }
      if (input.mouse.clicked) {
        const rects = cardRects(W, H);
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w
            && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
            this.pickUpgrade(i);
            return;
          }
        }
      }
      if (input.wasPressed('Enter', 'NumpadEnter')) this.nextWave();
      return;
    }

    // Playing (or paused).
    if (input.wasPressed('KeyP', 'Escape')) {
      if (this.state === 'playing') {
        this.prevState = 'playing';
        this.state = 'paused';
      } else if (this.state === 'paused') {
        this.state = 'playing';
      }
      return;
    }
    if (this.state === 'paused') return;

    this.playTime += dt;
    this.player.update(dt, input, this);
    this.waves.update(dt);

    // Enemies.
    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => !e.dead);
    // Merge anything queued during the enemy step (splits, summons).
    if (this.pendingSpawns.length > 0) {
      this.enemies.push(...this.pendingSpawns);
      this.pendingSpawns = [];
    }

    // Bolts vs enemies.
    for (const b of this.bolts) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = b.radius + e.radius;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < rr * rr) {
          if (e.damage(b.damage, this)) this.onEnemyKilled(e);
          else this.sfx.hit();
          this.spawnBurst(b.x, b.y, '#ffd76a', 3, 90);
          b.pierce -= 1;
          if (b.pierce < 0) {
            b.dead = true;
            break;
          }
        }
      }
    }
    stepAll(this.bolts, dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.pendingSpawns.length > 0) {
      this.enemies.push(...this.pendingSpawns);
      this.pendingSpawns = [];
    }

    // Orbs vs keeper and lantern.
    for (const o of this.orbs) {
      if (o.dead) continue;
      const p = this.player;
      const dxp = o.x - p.x;
      const dyp = o.y - p.y;
      const rp = o.radius + p.radius;
      if (dxp * dxp + dyp * dyp < rp * rp) {
        o.dead = true;
        p.hurt(this);
        continue;
      }
      const dxl = o.x - this.lantern.x;
      const dyl = o.y - this.lantern.y;
      const rl = o.radius + this.lantern.radius;
      if (dxl * dxl + dyl * dyl < rl * rl) {
        o.dead = true;
        this.damageLantern(6, o.x, o.y);
        this.spawnBurst(o.x, o.y, '#c4b5fd', 6, 120);
      }
    }
    stepAll(this.orbs, dt);

    stepAll(this.embers, dt, this.player);
    stepAll(this.particles, dt);
    stepAll(this.floaters, dt);

    // Lantern gnawing sound, throttled.
    if (this.lanternHitCd <= 0 && this.enemies.some((e) => {
      const d = Math.hypot(e.x - this.lantern.x, e.y - this.lantern.y);
      return d < this.lantern.radius + e.radius + 2 && e.lanternDps > 0;
    })) {
      this.lanternHitCd = 0.5;
      this.sfx.lanternHit();
    }
  }

  pickUpgrade(i) {
    const choice = this.upgradeChoices[i];
    if (!choice) return;
    if (this.player.embers < choice.cost) {
      this.sfx.tone(140, 0.12, 'square', 0.12);
      this.spawnFloater(this.W / 2, this.H / 2 - 200, 'Not enough embers', '#ff8c8c', 16);
      return;
    }
    applyUpgrade(choice, this.player, this);
    this.nextWave();
  }

  nextWave() {
    this.state = 'playing';
    this.waves.startWave(this.waves.wave + 1);
  }

  // ----- render ------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(this.rng, -this.shake, this.shake) * 0.5, rand(this.rng, -this.shake, this.shake) * 0.5);
    }
    drawBackground(ctx, this);
    drawLantern(ctx, this);
    drawAll(this.embers, ctx);
    drawAll(this.enemies, ctx);
    if (this.state !== 'title') this.player.draw(ctx);
    drawAll(this.bolts, ctx);
    drawAll(this.orbs, ctx);
    drawAll(this.particles, ctx);
    drawAll(this.floaters, ctx);
    ctx.restore();

    if (this.state === 'playing' || this.state === 'paused') drawHUD(ctx, this);
    if (this.state === 'title') drawTitleScreen(ctx, this);
    if (this.state === 'upgrade') drawUpgradeScreen(ctx, this);
    if (this.state === 'over') drawEndScreen(ctx, this);
    if (this.state === 'paused') drawPauseScreen(ctx, this);
  }

  // ----- main loop ---------------------------------------------------------

  frame(now) {
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.update(STEP);
      this.acc -= STEP;
      steps += 1;
    }
    if (steps === 5) this.acc = 0;
    this.render();
    this.input.endFrame();
  }

  run() {
    const loop = (now) => {
      this.frame(now);
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }
}

// Boot: a ?shot= URL renders one deterministic scene for screenshots
// (see shots.js) instead of starting the interactive loop.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const canvas = document.getElementById('game');
const game = new Game(canvas);
if (shot) {
  const seed = Number(params.get('seed') || 7);
  runShot(game, shot, seed);
} else {
  game.run();
}
