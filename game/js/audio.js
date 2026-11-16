// Emberline — all sound is synthesized with WebAudio. No audio files ship
// with the game, so nothing is fetched at run time. The context is created
// lazily on the first user gesture (browsers block audio before that) and
// every effect is a short oscillator envelope: a blip, a thud, a chime.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  /** Create (or resume) the audio context. Safe to call on every gesture. */
  ensure() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (_e) {
      // Audio is decoration; a failure must never break the game.
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
  }

  /** One oscillator note with an exponential decay. */
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (_e) {
      /* ignore */
    }
  }

  /** A short burst of filtered noise (hits, explosions). */
  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch (_e) {
      /* ignore */
    }
  }

  shoot() {
    this.tone(720, 0.08, 'square', 0.12, 240);
  }

  hit() {
    this.noise(0.05, 0.15, 2400);
  }

  enemyDie() {
    this.tone(320, 0.18, 'sawtooth', 0.14, 60);
    this.noise(0.12, 0.12, 1200);
  }

  pickup() {
    this.tone(880, 0.07, 'sine', 0.16);
    this.tone(1320, 0.1, 'sine', 0.12);
  }

  hurt() {
    this.tone(160, 0.25, 'sawtooth', 0.2, 70);
  }

  lanternHit() {
    this.tone(110, 0.2, 'triangle', 0.22, 55);
  }

  bomb() {
    this.noise(0.5, 0.3, 900);
    this.tone(90, 0.5, 'sine', 0.25, 30);
  }

  horn() {
    this.tone(196, 0.5, 'triangle', 0.2, 196);
    this.tone(294, 0.5, 'triangle', 0.14, 294);
  }

  upgrade() {
    this.tone(523, 0.12, 'sine', 0.16);
    this.tone(659, 0.12, 'sine', 0.16);
    this.tone(784, 0.2, 'sine', 0.16);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.35, 'triangle', 0.18), i * 130);
    });
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.4, 'sawtooth', 0.14), i * 160);
    });
  }

  click() {
    this.tone(600, 0.05, 'sine', 0.12);
  }
}
