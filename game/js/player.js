// Emberline — the keeper. Moves with WASD/arrows, aims at the mouse, fires
// ember bolts while the button is held, and drops a bomb with Space.
// Upgrades mutate `stats`; hearts and embers live here too.

import { TAU, clamp } from './utils.js';
import { Bolt } from './projectiles.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.angle = -Math.PI / 2;
    this.speed = 235;
    this.stats = {
      damage: 1,
      fireRate: 4.2,
      multishot: 1,
      pierce: 0,
      maxHearts: 3,
      bombMax: 1,
    };
    this.hearts = 3;
    this.embers = 0;
    this.bombs = 1;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.muzzle = 0;
    this.walkPhase = 0;
    this.moving = false;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.stats = {
      damage: 1,
      fireRate: 4.2,
      multishot: 1,
      pierce: 0,
      maxHearts: 3,
      bombMax: 1,
    };
    this.hearts = 3;
    this.embers = 0;
    this.bombs = 1;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.muzzle = 0;
  }

  update(dt, input, game) {
    const mv = input.moveVector();
    this.moving = mv.x !== 0 || mv.y !== 0;
    this.x = clamp(this.x + mv.x * this.speed * dt, 20, game.W - 20);
    this.y = clamp(this.y + mv.y * this.speed * dt, 20, game.H - 20);
    if (this.moving) this.walkPhase += dt * 11;

    this.angle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
    this.fireCooldown -= dt;
    this.invuln -= dt;
    this.muzzle -= dt;

    if (input.mouse.down && this.fireCooldown <= 0) {
      this.fire(game);
    }
    if (input.wasPressed('Space')) game.useBomb();
  }

  fire(game) {
    const s = this.stats;
    this.fireCooldown = 1 / s.fireRate;
    this.muzzle = 0.07;
    const spread = 0.14;
    const count = s.multishot;
    for (let i = 0; i < count; i += 1) {
      const off = (i - (count - 1) / 2) * spread;
      const a = this.angle + off;
      const speed = 540;
      const bx = this.x + Math.cos(a) * 22;
      const by = this.y + Math.sin(a) * 22;
      game.bolts.push(new Bolt(bx, by, Math.cos(a) * speed, Math.sin(a) * speed, s.damage, s.pierce));
    }
    game.sfx.shoot();
    game.addShake(0.6);
  }

  /** Take a hit. Returns true when the keeper actually loses a heart. */
  hurt(game) {
    if (this.invuln > 0) return false;
    this.hearts -= 1;
    this.invuln = 1.4;
    game.sfx.hurt();
    game.addShake(7);
    game.spawnBurst(this.x, this.y, '#ff6b6b', 14, 160);
    if (this.hearts <= 0) game.gameOver(false);
    return true;
  }

  draw(ctx) {
    const blink = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;

    // Ground shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 14, 13, 5, 0, 0, TAU);
    ctx.fill();

    // Lantern glow in hand.
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 46);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.5)');
    glow.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 46, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Cloak (hooded keeper): a teal cloak with an amber hood.
    const bob = this.moving ? Math.sin(this.walkPhase) * 1.5 : 0;
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(this.angle + Math.PI / 2);
    ctx.fillStyle = '#1f7a6d';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(13, -4, 11, 12);
    ctx.quadraticCurveTo(0, 16, -11, 12);
    ctx.quadraticCurveTo(-13, -4, 0, -14);
    ctx.fill();
    ctx.fillStyle = '#159a86';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(7, -6, 6, 8);
    ctx.quadraticCurveTo(0, 11, -6, 8);
    ctx.quadraticCurveTo(-7, -6, 0, -14);
    ctx.fill();
    // Hood.
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(0, -4, 7.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a1a08';
    ctx.beginPath();
    ctx.arc(0, -5, 5, 0, TAU);
    ctx.fill();
    // Little lantern swinging at the side.
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(12, 4, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(12, 4, 6.5, 0, TAU);
    ctx.stroke();
    // Muzzle flash.
    if (this.muzzle > 0) {
      ctx.fillStyle = 'rgba(255, 230, 150, 0.95)';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-5, -30);
      ctx.lineTo(0, -26);
      ctx.lineTo(5, -30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
