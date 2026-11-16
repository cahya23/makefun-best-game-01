// Emberline — everything that flies: the keeper's ember bolts, enemy orbs,
// pickup embers, particles and floating score text. Plain data + step/draw
// functions; the Game owns the arrays and steps them each frame.

import { TAU, clamp, rand } from './utils.js';

/** A bolt the keeper fires. Pierces `pierce` enemies before it dies. */
export class Bolt {
  constructor(x, y, vx, vy, damage, pierce) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.pierce = pierce;
    this.life = 1.1;
    this.radius = 5;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 14);
    g.addColorStop(0, 'rgba(255, 220, 130, 0.95)');
    g.addColorStop(0.4, 'rgba(255, 150, 50, 0.55)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 14, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3.5, 0, TAU);
    ctx.fill();
  }
}

/** A slow orb a spitter or the boss fires. */
export class Orb {
  constructor(x, y, vx, vy, damage) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.life = 6;
    this.radius = 7;
    this.dead = false;
    this.phase = Math.random() * TAU;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.phase += dt * 6;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const pulse = 6 + Math.sin(this.phase) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 18);
    g.addColorStop(0, 'rgba(200, 120, 255, 0.9)');
    g.addColorStop(0.5, 'rgba(140, 70, 220, 0.45)');
    g.addColorStop(1, 'rgba(120, 50, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 18, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#d9a7ff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, pulse, 0, TAU);
    ctx.fill();
  }
}

/** An ember pickup: drifts, gets magneted to the player, then pays out. */
export class Ember {
  constructor(x, y, value, rng) {
    this.x = x;
    this.y = y;
    const a = rng() * TAU;
    const s = rand(rng, 20, 70);
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.value = value;
    this.life = 18;
    this.radius = 7;
    this.dead = false;
    this.phase = rng() * TAU;
  }

  update(dt, player) {
    this.phase += dt * 8;
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    // Friction, then magnet toward the player when close.
    this.vx *= 1 - Math.min(1, 3 * dt);
    this.vy *= 1 - Math.min(1, 3 * dt);
    if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 180 && d > 1) {
        const pull = 900 * (1 - d / 200);
        this.vx += (dx / d) * pull * dt;
        this.vy += (dy / d) * pull * dt;
      }
      if (d < player.radius + 10) {
        this.dead = true;
        player.embers += this.value;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, 12, 948);
    this.y = clamp(this.y, 12, 588);
  }

  draw(ctx) {
    const bob = Math.sin(this.phase) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y + bob, 0, this.x, this.y + bob, 12);
    g.addColorStop(0, 'rgba(255, 210, 110, 0.95)');
    g.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y + bob, 12, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + bob - 5);
    ctx.lineTo(this.x + 3.5, this.y + bob);
    ctx.lineTo(this.x, this.y + bob + 5);
    ctx.lineTo(this.x - 3.5, this.y + bob);
    ctx.closePath();
    ctx.fill();
  }
}

/** One spark of a burst: position, velocity, fade. */
export class Particle {
  constructor(x, y, vx, vy, life, size, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 1 - Math.min(1, 2.5 * dt);
    this.vy *= 1 - Math.min(1, 2.5 * dt);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * a + 0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Floating text: "+30", "WAVE 3", damage numbers. Rises and fades. */
export class Floater {
  constructor(x, y, text, color, size) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size || 14;
    this.life = 1.1;
    this.dead = false;
  }

  update(dt) {
    this.y -= 34 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / 0.6, 0, 1);
    ctx.font = `bold ${this.size}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10, 8, 30, 0.8)';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

/** Step an array of updatable things and drop the dead ones. */
export function stepAll(list, dt, extra) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const it = list[i];
    if (extra !== undefined) it.update(dt, extra);
    else it.update(dt);
    if (it.dead) list.splice(i, 1);
  }
}

/** Draw every item of a list. */
export function drawAll(list, ctx) {
  for (const it of list) it.draw(ctx);
}
