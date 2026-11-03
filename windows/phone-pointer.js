// DenaDesk — GPL-3.0. Touch is the default; mouse hover/buttons require an explicit opt-in.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhonePointer = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const DOWN = 0, UP = 1, MOVE = 2, HOVER = 7, EXIT = 10;
  class PhonePointer {
    constructor(send, timers = { setTimeout, clearTimeout }) {
      this.send = send; this.timers = timers; this.mouseMode = false;
      this.active = new Map(); this.hover = null; this.gesture = null;
    }
    touch(action, pointer, p, actionButton = 0, buttons = 0) {
      this.send({ t: 'touch', action, pointer, x: p.x, y: p.y, actionButton, buttons });
    }
    setMouseMode(on) {
      this.release();
      this.mouseMode = !!on;
    }
    down(e, p) {
      this.endGesture();
      const mouse = this.mouseMode && e.pointerType !== 'touch';
      if (!mouse && e.button === 1) return this.send({ t: 'nav', key: 'home' });
      if (!mouse && e.button !== 0 && e.button !== 2) return;
      let pointer = mouse ? -1 : -2;
      if (e.pointerType === 'touch') {
        pointer = Array.from({ length: 8 }, (_, i) => i + 2).find((id) => ![...this.active.values()].some((v) => v.pointer === id));
        if (pointer === undefined) return;
      } else if (this.active.has(e.pointerId)) return;
      const button = mouse ? ({ 0: 1, 1: 4, 2: 2 }[e.button] || 0) : 0;
      if (mouse && !button) return;
      const v = { pointer, p, button, buttons: mouse ? e.buttons : 0,
        right: !mouse && e.button === 2, dragging: false, sx: e.clientX, sy: e.clientY };
      this.active.set(e.pointerId, v);
      if (!v.right) this.touch(DOWN, pointer, p, button, v.buttons);
    }
    move(e, p) {
      const v = this.active.get(e.pointerId);
      if (v) {
        if (v.right && !v.dragging) {
          if (Math.hypot(e.clientX - v.sx, e.clientY - v.sy) <= 5) return;
          v.dragging = true;
          this.touch(DOWN, v.pointer, v.p);
        }
        v.p = p; v.buttons = v.pointer === -1 ? e.buttons : 0;
        this.touch(MOVE, v.pointer, p, 0, v.buttons);
      } else if (this.mouseMode && e.pointerType !== 'touch') {
        this.hover = p;
        this.touch(HOVER, -1, p);
      }
    }
    up(e, p, cancelled = false) {
      const v = this.active.get(e.pointerId);
      if (!v) return;
      this.active.delete(e.pointerId);
      if (v.right && !v.dragging) {
        if (!cancelled) this.send({ t: 'nav', key: 'back' });
      } else this.touch(UP, v.pointer, p || v.p, v.button, v.pointer === -1 && !cancelled ? e.buttons : 0);
    }
    leave(p) {
      if (this.hover && !this.active.size) {
        this.touch(EXIT, -1, p || this.hover); this.hover = null;
      }
    }
    release() {
      for (const [pointerId, v] of this.active) this.up({ pointerId }, v.p, true);
      this.endGesture(); this.leave();
    }
    endGesture() {
      const g = this.gesture;
      if (!g) return;
      this.timers.clearTimeout(g.timer);
      for (const [id, p] of g.points) this.touch(UP, id, p);
      this.gesture = null;
    }
    stepSwipe(g) {
      if (this.gesture !== g) return;
      const old = g.points.get(-2);
      const point = { x: old.x + (g.target.x - old.x) / g.steps, y: old.y + (g.target.y - old.y) / g.steps };
      g.points.set(-2, point);
      this.touch(MOVE, -2, point);
      // Lift at the last moving sample, so Android can recognize a fling. There is no idle hold.
      if (--g.steps === 0 || Math.hypot(g.target.x - point.x, g.target.y - point.y) < .5) this.endGesture();
      else g.timer = this.timers.setTimeout(() => this.stepSwipe(g), 16);
    }
    wheel(e, p, size, view = size) {
      if (this.active.size || !size.width || !size.height) return;
      if (!e.deltaX && !e.deltaY) return;
      const kind = e.ctrlKey ? 'pinch' : this.mouseMode ? 'mouse' : 'swipe';
      if (this.gesture && this.gesture.kind !== kind) this.endGesture();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.height : 1;
      if (kind === 'mouse') return this.send({ t: 'scroll', ...p, hs: -e.deltaX * k / 100, vs: -e.deltaY * k / 100 });
      const clamp = (p) => ({ x: Math.max(0, Math.min(size.width - 1, p.x)), y: Math.max(0, Math.min(size.height - 1, p.y)) });
      let g = this.gesture;
      if (kind === 'swipe') {
        // Wheel deltas are CSS pixels; Android coordinates are video pixels (usually 2x).
        const limit = (v, n) => Math.max(-n * .6, Math.min(n * .6, v));
        const dx = limit(e.deltaX * k * size.width / view.width, size.width);
        const dy = limit(e.deltaY * k * size.height / view.height, size.height);
        // Re-anchor at an edge, on reversal or after a resize instead of dragging a stuck finger.
        if (g && (g.width !== size.width || g.height !== size.height || g.dx * dx < 0 || g.dy * dy < 0 ||
          (dx && (g.target.x === 0 || g.target.x === size.width - 1)) ||
          (dy && (g.target.y === 0 || g.target.y === size.height - 1)))) {
          this.endGesture(); g = null;
        }
        if (!g) {
          const anchor = (v, d, n) => Math.max(n * .1 + Math.max(0, d), Math.min(n * .9 + Math.min(0, d), v));
          const start = clamp({ x: anchor(p.x, dx, size.width), y: anchor(p.y, dy, size.height) });
          g = this.gesture = { kind, width: size.width, height: size.height, points: new Map([[-2, start]]), target: start };
          this.touch(DOWN, -2, start);
        }
        g.dx = dx; g.dy = dy; g.steps = 5;
        g.target = clamp({ x: g.target.x - dx, y: g.target.y - dy });
        // Coalesce wheel bursts into one animation, with no idle polling.
        if (!g.timer) g.timer = this.timers.setTimeout(() => this.stepSwipe(g), 16);
        return;
      }
      if (!g) {
        g = this.gesture = { kind, cx: p.x, cy: p.y, d: size.width * .08, points: new Map() };
        g.points = new Map([[0, clamp({ x: g.cx - g.d, y: g.cy })], [1, clamp({ x: g.cx + g.d, y: g.cy })]]);
        for (const [id, point] of g.points) this.touch(DOWN, id, point);
      }
      g.d = Math.max(10, Math.min(size.width * .45, g.d * Math.exp(Math.max(-2, Math.min(2, -e.deltaY * k / 60)))));
      g.points.set(0, clamp({ x: g.cx - g.d, y: g.cy }));
      g.points.set(1, clamp({ x: g.cx + g.d, y: g.cy }));
      for (const [id, point] of g.points) this.touch(MOVE, id, point);
      this.timers.clearTimeout(g.timer);
      g.timer = this.timers.setTimeout(() => this.endGesture(), 160);
    }
  }
  return PhonePointer;
});
