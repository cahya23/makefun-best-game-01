// Emberline — keyboard and mouse input, translated into canvas space.
// Keys are tracked by code (KeyW, ArrowUp, Space, ...). `pressed` holds
// keys that went down since the last frame so the game can react once per
// tap (pause, restart, card picks); `down` holds keys currently held.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this._onKeyUp = (e) => this.down.delete(e.code);
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * this.canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * this.canvas.height;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
        this._onMouseMove(e);
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.down.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    // Touch: one finger aims and fires, a second finger's tap is a bomb.
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((t.clientX - r.left) / r.width) * this.canvas.width;
      this.mouse.y = ((t.clientY - r.top) / r.height) * this.canvas.height;
      this.mouse.down = true;
      this.mouse.clicked = true;
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((t.clientX - r.left) / r.width) * this.canvas.width;
      this.mouse.y = ((t.clientY - r.top) / r.height) * this.canvas.height;
    }, { passive: false });
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (e.touches.length === 0) this.mouse.down = false;
    }, { passive: false });
  }

  /** True while the key is held. Accepts several codes (aliases). */
  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  /** True only on the frame the key went down. */
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Movement vector from WASD/arrows, normalized. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    if (this.isDown('KeyW', 'ArrowUp')) y -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** Call at the end of each frame: one-tap state is consumed. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
