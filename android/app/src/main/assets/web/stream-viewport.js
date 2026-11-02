// DenaDesk — GPL-3.0. Local video magnification and inverse input mapping; never sends PC input.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StreamViewport = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  return class StreamViewport {
    constructor() { this.width = this.height = this.vw = this.vh = 0; this.reset(); }
    reset() { this.scale = 1; this.tx = this.ty = 0; }
    base() {
      if (!this.vw || !this.vh || !this.width || !this.height) return null;
      const k = Math.min(this.width / this.vw, this.height / this.vh);
      return { x: (this.width - this.vw * k) / 2, y: (this.height - this.vh * k) / 2, w: this.vw * k, h: this.vh * k };
    }
    rect() {
      const b = this.base();
      return b && { x: b.x * this.scale + this.tx, y: b.y * this.scale + this.ty, w: b.w * this.scale, h: b.h * this.scale };
    }
    resize(width, height, vw, vh) {
      if (width === this.width && height === this.height && vw === this.vw && vh === this.vh) return false;
      const old = this.rect();
      const cx = old ? (this.width / 2 - old.x) / old.w : .5, cy = old ? (this.height / 2 - old.y) / old.h : .5;
      Object.assign(this, { width, height, vw, vh });
      const b = this.base();
      if (b) { this.tx = width / 2 - (b.x + cx * b.w) * this.scale; this.ty = height / 2 - (b.y + cy * b.h) * this.scale; this.bound(); }
      return true;
    }
    bound() {
      const b = this.base(); if (!b) return;
      const fit = (pos, start, size, screen) => size <= screen ? (screen - size) / 2 - start : clamp(pos, screen - start - size, -start);
      this.tx = fit(this.tx, b.x * this.scale, b.w * this.scale, this.width);
      this.ty = fit(this.ty, b.y * this.scale, b.h * this.scale, this.height);
    }
    zoomAt(factor, fromX, fromY, toX = fromX, toY = fromY) {
      if (!Number.isFinite(factor) || factor <= 0 || !this.base()) return;
      const next = clamp(this.scale * factor, 1, 8), ratio = next / this.scale;
      this.tx = toX - (fromX - this.tx) * ratio;
      this.ty = toY - (fromY - this.ty) * ratio;
      this.scale = next;
      this.bound();
    }
    norm(x, y, bounded = false) {
      const r = this.rect(); if (!r) return null;
      x = (x - r.x) / r.w; y = (y - r.y) / r.h;
      if (!bounded && (x < 0 || x > 1 || y < 0 || y > 1)) return null;
      return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    }
    reveal(x, y) {
      const r = this.rect(); if (!r || this.scale === 1) return;
      const px = r.x + x * r.w, py = r.y + y * r.h;
      this.tx += clamp(px, 24, this.width - 24) - px;
      this.ty += clamp(py, 24, this.height - 24) - py;
      this.bound();
    }
    transform() { return `matrix(${this.scale},0,0,${this.scale},${this.tx},${this.ty})`; }
  };
});
