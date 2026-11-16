// Emberline — small math and random helpers shared by every module.
// Nothing here touches the DOM; the game stays deterministic when a seeded
// generator is passed in (the ?shot= scenes rely on that).

export const TAU = Math.PI * 2;

/** Clamp v into [lo, hi]. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Squared distance between two points (avoids a sqrt in hot loops). */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * mulberry32: a tiny fast seeded PRNG. Returns a function producing
 * numbers in [0, 1). Same seed => same sequence, every run.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [lo, hi) from rng. */
export function rand(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** Random integer in [lo, hi] inclusive from rng. */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Pick one element of arr with rng. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher-Yates shuffle, in place, driven by rng. Returns the array. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Format an integer with a thousands separator (for the HUD score). */
export function fmt(n) {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
