// Emberline — the shades that hunt the lantern. Each kind has its own
// shape, speed, target and trick; all of them drift toward the lantern
// unless the keeper gets close enough to distract them. The boss is its
// own class: a big crowned shade with radial bursts and summons.

import { TAU, clamp, rand, pick } from './utils.js';

/** Per-kind tuning. hp scales a little with the wave (see spawnEnemy). */
export const KINDS = {
  wisp: { hp: 2, speed: 96, radius: 13, lanternDps: 4, ember: 3, score: 10, color: '#a78bfa' },
  mote: { hp: 1, speed: 155, radius: 8, lanternDps: 3, ember: 1, score: 5, color: '#c4b5fd' },
  spitter: { hp: 3, speed: 62, radius: 14, lanternDps: 0, ember: 5, score: 15, color: '#f472b6' },
  splitter: { hp: 4, speed: 56, radius: 17, lanternDps: 7, ember: 6, score: 20, color: '#7dd3fc' },
  brute: { hp: 16, speed: 44, radius: 24, lanternDps: 12, ember: 12, score: 40, color: '#fb923c' },
};

export class Enemy {
  constructor(kind, x, y, wave, rng) {
    const k = KINDS[kind];
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.radius = k.radius;
    this.speed = k.speed * rand(rng, 0.9, 1.1);
    this.maxHp = Math.round(k.hp * (1 + (wave - 1) * 0.09));
    this.hp = this.maxHp;
    this.lanternDps = k.lanternDps;
    this.ember = k.ember;
    this.score = k.score;
    this.color = k.color;
    this.dead = false;
    this.wobble = rng() * TAU;
    this.wobbleSpeed = rand(rng, 1.5, 3);
    this.attackCd = 0;
    this.shootCd = rand(rng, 1, 2.4);
    this.flash = 0;
    this.kx = 0;
    this.ky = 0;
    this.hitTimer = 0;
  }

  /** Damage from a bolt. Returns true when this hit kills it. */
  damage(amount, game) {
    this.hp -= amount;
    this.flash = 0.09;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  update(dt, game) {
    this.flash -= dt;
    this.attackCd -= dt;
    this.shootCd -= dt;
    this.wobble += dt * this.wobbleSpeed;
    const lantern = game.lantern;
    const player = game.player;

    // Target: the lantern, unless the keeper is close (then chase them).
    let tx = lantern.x;
    let ty = lantern.y;
    if (this.kind !== 'spitter') {
      const dPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (dPlayer < 170) {
        tx = player.x;
        ty = player.y;
      }
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const wob = Math.sin(this.wobble) * 0.35;
    const px = -dy / d;
    const py = dx / d;
    let vx = (dx / d) * this.speed + px * wob * this.speed * 0.5;
    let vy = (dy / d) * this.speed + py * wob * this.speed * 0.5;

    if (this.kind === 'spitter') {
      // Hold a ring around the lantern and shoot at the keeper.
      const dLantern = Math.hypot(lantern.x - this.x, lantern.y - this.y);
      const want = 250;
      const radial = dLantern < want - 20 ? -1 : dLantern > want + 20 ? 1 : 0;
      vx = (dx / d) * this.speed * radial + px * 30;
      vy = (dy / d) * this.speed * radial + py * 30;
      if (this.shootCd <= 0) {
        this.shootCd = 2.8;
        const target = Math.hypot(player.x - this.x, player.y - this.y) < 420 ? player : lantern;
        const a = Math.atan2(target.y - this.y, target.x - this.x);
        game.fireOrb(this.x, this.y, Math.cos(a) * 125, Math.sin(a) * 125, 1);
        game.sfx.tone(300, 0.12, 'sine', 0.1, 160);
      }
    }

    // Knockback decay.
    this.x += (vx + this.kx) * dt;
    this.y += (vy + this.ky) * dt;
    this.kx *= 1 - Math.min(1, 6 * dt);
    this.ky *= 1 - Math.min(1, 6 * dt);
    this.x = clamp(this.x, -30, game.W + 30);
    this.y = clamp(this.y, -30, game.H + 30);

    // Gnawing the lantern.
    const dL = Math.hypot(lantern.x - this.x, lantern.y - this.y);
    if (dL < lantern.radius + this.radius + 2 && this.lanternDps > 0) {
      game.damageLantern(this.lanternDps * dt, this.x, this.y);
    }

    // Touching the keeper hurts them and shoves the shade away. Small
    // shades burn out on the keeper's light when they touch it.
    const dP = Math.hypot(player.x - this.x, player.y - this.y);
    if (dP < player.radius + this.radius - 2) {
      if (player.hurt(game)) {
        const a = Math.atan2(this.y - player.y, this.x - player.x);
        this.kx += Math.cos(a) * 320;
        this.ky += Math.sin(a) * 320;
        if ((this.kind === 'wisp' || this.kind === 'mote') && this.damage(999, game)) {
          game.onEnemyKilled(this);
        }
      }
    }
  }

  draw(ctx) {
    const c = this.color;
    ctx.save();
    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.radius * 0.85, this.radius * 0.8, this.radius * 0.3, 0, 0, TAU);
    ctx.fill();
    // Glow.
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.2);
    g.addColorStop(0, c + 'aa');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2.2, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const r = this.radius;
    const wob = Math.sin(this.wobble * 2) * 1.5;
    if (this.kind === 'wisp' || this.kind === 'mote') {
      // Ghost flame: a teardrop with a wavy tail.
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : c;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - r);
      ctx.quadraticCurveTo(this.x + r, this.y - r * 0.3, this.x + r * 0.7, this.y + r * 0.5);
      ctx.quadraticCurveTo(this.x + r * 0.3, this.y + r + wob, this.x, this.y + r * 0.7);
      ctx.quadraticCurveTo(this.x - r * 0.3, this.y + r + wob, this.x - r * 0.7, this.y + r * 0.5);
      ctx.quadraticCurveTo(this.x - r, this.y - r * 0.3, this.x, this.y - r);
      ctx.fill();
    } else if (this.kind === 'spitter') {
      // Spiky orb.
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : c;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + this.wobble * 0.4;
        const rr = i % 2 === 0 ? r : r * 0.62;
        const px = this.x + Math.cos(a) * rr;
        const py = this.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (this.kind === 'splitter') {
      // Two-lobed blob.
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : c;
      ctx.beginPath();
      ctx.arc(this.x - r * 0.45, this.y, r * 0.62, 0, TAU);
      ctx.arc(this.x + r * 0.45, this.y, r * 0.62, 0, TAU);
      ctx.fill();
    } else {
      // Brute: a big rocky shade.
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : c;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - r);
      ctx.lineTo(this.x + r * 0.8, this.y - r * 0.4);
      ctx.lineTo(this.x + r, this.y + r * 0.5);
      ctx.lineTo(this.x, this.y + r);
      ctx.lineTo(this.x - r, this.y + r * 0.5);
      ctx.lineTo(this.x - r * 0.8, this.y - r * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes: two white dots with dark pupils, always facing the target.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x - r * 0.32, this.y - r * 0.15, r * 0.16, 0, TAU);
    ctx.arc(this.x + r * 0.32, this.y - r * 0.15, r * 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1033';
    ctx.beginPath();
    ctx.arc(this.x - r * 0.32, this.y - r * 0.15, r * 0.08, 0, TAU);
    ctx.arc(this.x + r * 0.32, this.y - r * 0.15, r * 0.08, 0, TAU);
    ctx.fill();

    // HP bar for tougher shades.
    if (this.maxHp >= 4 && this.hp < this.maxHp) {
      const w = r * 1.8;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(this.x - w / 2, this.y - r - 9, w, 4);
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(this.x - w / 2, this.y - r - 9, w * (this.hp / this.maxHp), 4);
    }
    ctx.restore();
  }
}

/** The wave-10 boss: the Gloom Herald. Slow, huge, radial bursts, summons. */
export class Boss {
  constructor(x, y) {
    this.kind = 'boss';
    this.x = x;
    this.y = y;
    this.radius = 36;
    this.speed = 36;
    this.maxHp = 130;
    this.hp = 130;
    this.ember = 100;
    this.score = 500;
    this.color = '#c026d3';
    this.dead = false;
    this.flash = 0;
    this.burstCd = 2.6;
    this.summoned66 = false;
    this.summoned33 = false;
    this.wobble = 0;
  }

  damage(amount, game) {
    this.hp -= amount;
    this.flash = 0.09;
    const frac = this.hp / this.maxHp;
    if (!this.summoned66 && frac < 0.66) {
      this.summoned66 = true;
      game.summonWisps(this.x, this.y, 3);
      game.spawnFloater(this.x, this.y - 44, 'THE HERALD CALLS!', '#e9d5ff', 18);
    }
    if (!this.summoned33 && frac < 0.33) {
      this.summoned33 = true;
      game.summonWisps(this.x, this.y, 4);
      game.spawnFloater(this.x, this.y - 44, 'THE HERALD RAGES!', '#e9d5ff', 18);
    }
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  update(dt, game) {
    this.flash -= dt;
    this.wobble += dt * 2;
    this.burstCd -= dt;
    const lantern = game.lantern;
    const dx = lantern.x - this.x;
    const dy = lantern.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const strafe = Math.sin(this.wobble) * 26;
    this.x += ((dx / d) * this.speed + (-dy / d) * strafe) * dt;
    this.y += ((dy / d) * this.speed + (dx / d) * strafe) * dt;

    if (this.burstCd <= 0) {
      this.burstCd = 3.1;
      const n = 10;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * TAU + this.wobble * 0.3;
        game.fireOrb(this.x, this.y, Math.cos(a) * 130, Math.sin(a) * 130, 1);
      }
      game.sfx.tone(140, 0.3, 'sawtooth', 0.16, 60);
      game.addShake(4);
    }

    const dL = Math.hypot(lantern.x - this.x, lantern.y - this.y);
    if (dL < lantern.radius + this.radius + 2) {
      game.damageLantern(18 * dt, this.x, this.y);
    }
    const p = game.player;
    const dP = Math.hypot(p.x - this.x, p.y - this.y);
    if (dP < p.radius + this.radius - 2) {
      if (p.hurt(game)) {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        p.x += Math.cos(a) * 40;
        p.y += Math.sin(a) * 40;
      }
    }
  }

  draw(ctx) {
    const r = this.radius;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + r * 0.85, r * 0.85, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.4);
    g.addColorStop(0, 'rgba(192, 38, 211, 0.55)');
    g.addColorStop(1, 'rgba(192, 38, 211, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Crown of thorns.
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      const rr = i % 2 === 0 ? r * 1.35 : r * 0.95;
      const px = this.x + Math.cos(a) * rr;
      const py = this.y - r * 0.55 + Math.sin(a) * rr * 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Body.
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#7e22ce';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.arc(this.x, this.y + r * 0.25, r * 0.72, 0, TAU);
    ctx.fill();
    // Three eyes.
    ctx.fillStyle = '#fff';
    for (const ex of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.arc(this.x + ex * r, this.y - r * 0.15, r * 0.13, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ff2d78';
    for (const ex of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.arc(this.x + ex * r, this.y - r * 0.15, r * 0.06, 0, TAU);
      ctx.fill();
    }
    // HP bar.
    const w = 120;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(this.x - w / 2, this.y - r - 16, w, 7);
    ctx.fillStyle = '#e879f9';
    ctx.fillRect(this.x - w / 2, this.y - r - 16, w * (this.hp / this.maxHp), 7);
    ctx.restore();
  }
}

/** A point just outside one of the four edges, for spawning. */
export function edgeSpawnPoint(rng, W, H) {
  const side = Math.floor(rng() * 4);
  if (side === 0) return { x: rand(rng, 0, W), y: -24 };
  if (side === 1) return { x: W + 24, y: rand(rng, 0, H) };
  if (side === 2) return { x: rand(rng, 0, W), y: H + 24 };
  return { x: -24, y: rand(rng, 0, H) };
}

/** Make one enemy of a kind, HP scaled by wave. */
export function spawnEnemy(kind, x, y, wave, rng) {
  if (kind === 'boss') return new Boss(x, y);
  return new Enemy(kind, x, y, wave, rng);
}

/** A random kind weighted for the early waves (used by the boss summons). */
export function randomSmallKind(rng) {
  return pick(rng, ['wisp', 'wisp', 'wisp', 'mote']);
}
