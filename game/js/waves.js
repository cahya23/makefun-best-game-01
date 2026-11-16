// Emberline — wave composition and the spawn schedule. Ten waves; the
// tenth is the boss. Each wave is a shuffled queue of kinds with a spawn
// timer, so the pressure ramps up instead of arriving all at once.

import { shuffle } from './utils.js';
import { edgeSpawnPoint, spawnEnemy } from './enemies.js';

export const TOTAL_WAVES = 10;

/** Kind counts per wave. Boss wave is handled specially. */
export function waveComp(n) {
  const comp = [];
  const add = (kind, count) => {
    for (let i = 0; i < count; i += 1) comp.push(kind);
  };
  if (n === 10) {
    add('wisp', 6);
    return comp;
  }
  add('wisp', 6 + 2 * n);
  if (n >= 2) add('spitter', 1 + Math.floor(n / 2));
  if (n >= 3) add('splitter', 1 + Math.floor((n - 1) / 2));
  if (n >= 4) add('brute', Math.floor((n - 2) / 2));
  return comp;
}

export class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.queue = [];
    this.spawnTimer = 0;
    this.active = false;
    this.betweenTimer = 0;
  }

  get remaining() {
    return this.queue.length + this.game.enemies.length;
  }

  startWave(n) {
    this.wave = n;
    this.queue = shuffle(this.game.rng, waveComp(n).slice());
    this.spawnTimer = 0.5;
    this.active = true;
    if (n === 10) {
      const p = edgeSpawnPoint(this.game.rng, this.game.W, this.game.H);
      this.game.enemies.push(spawnEnemy('boss', p.x, p.y, n, this.game.rng));
      this.game.spawnFloater(this.game.W / 2, 140, 'THE GLOOM HERALD AWAKENS', '#e9d5ff', 22);
      this.game.sfx.horn();
    } else {
      this.game.spawnFloater(this.game.W / 2, 140, `WAVE ${n}`, '#ffd76a', 24);
      this.game.sfx.horn();
    }
  }

  update(dt) {
    if (!this.active) return;
    if (this.queue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const interval = Math.max(0.32, 0.75 - this.wave * 0.04);
        this.spawnTimer = interval;
        // Small bursts late in the wave keep the pressure on.
        const burst = this.wave >= 5 && this.game.rng() < 0.25 ? 2 : 1;
        for (let i = 0; i < burst && this.queue.length > 0; i += 1) {
          const kind = this.queue.pop();
          const p = edgeSpawnPoint(this.game.rng, this.game.W, this.game.H);
          this.game.enemies.push(spawnEnemy(kind, p.x, p.y, this.wave, this.game.rng));
        }
      }
    } else if (this.game.enemies.length === 0) {
      this.active = false;
      this.game.onWaveCleared();
    }
  }
}
