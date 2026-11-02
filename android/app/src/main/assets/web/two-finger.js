// DenaDesk — GPL-3.0. Recognize a pinch separately from a two-finger scroll.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TwoFinger = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const sample = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) });
  return class TwoFinger {
    constructor(a, b, scroll, zoom, frames = null, initialMode = null) {
      this.start = this.last = sample(a, b);
      this.scroll = scroll; this.zoom = zoom;
      this.frames = frames; this.frame = 0; this.pending = null;
      this.mode = initialMode; this.moved = false;
    }
    queue(a, b) {
      if (!this.frames) return this.update(a, b);
      this.pending = [{ ...a }, { ...b }];
      if (!this.frame) this.frame = this.frames.requestAnimationFrame(() => { this.frame = 0; this.flush(); });
    }
    flush() {
      if (!this.pending) return;
      const [a, b] = this.pending; this.pending = null;
      this.update(a, b);
    }
    finish(cancelled = false) {
      if (this.frame) this.frames.cancelAnimationFrame(this.frame);
      this.frame = 0;
      if (cancelled) { this.pending = null; this.moved = true; }
      else this.flush();
    }
    update(a, b) {
      const c = sample(a, b), s = this.start;
      if (!this.mode) {
        const spread = Math.abs(c.d - s.d), travel = Math.hypot(c.x - s.x, c.y - s.y);
        if (spread > 6 && Math.abs(Math.log(c.d / s.d)) > .055 && spread > travel * 1.2) this.mode = 'zoom';
        else if (travel > 8) this.mode = 'scroll';
        else return;
        this.moved = true;
      }
      if (this.mode === 'zoom') {
        this.zoom(c.d / this.last.d, c, this.last);
      } else this.scroll((this.last.x - c.x) * 2, (this.last.y - c.y) * 2);
      this.last = c;
    }
  };
});
