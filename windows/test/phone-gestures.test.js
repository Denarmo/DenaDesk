'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TwoFinger = require('../../android/app/src/main/assets/web/two-finger');
const PhonePointer = require('../phone-pointer');
const RemoteInput = require('../remote-input');
function element() {
  const listeners = {}, classes = new Set();
  return { listeners, style: {}, dataset: {}, children: [], hidden: false, value: '', clientWidth: 800, clientHeight: 600,
    videoWidth: 800, videoHeight: 600, width: 400, height: 800,
    classList: { add: (...a) => a.forEach((v) => classes.add(v)), remove: (...a) => a.forEach((v) => classes.delete(v)), contains: (v) => classes.has(v), toggle(v, on) { const yes = on === undefined ? !classes.has(v) : on; if (yes) classes.add(v); else classes.delete(v); return yes; } },
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    emit(t, e = {}) { for (const fn of listeners[t] || []) fn({ preventDefault() {}, stopPropagation() {}, ...e }); },
    append(...a) { this.children.push(...a); }, replaceChildren(...a) { this.children = a; },
    setAttribute(k, v) { this[k] = v; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }),
    querySelector: () => element(), querySelectorAll: () => [],
    focus() {}, blur() {}, setPointerCapture() {}, hasPointerCapture: () => false,
    getContext: () => ({ drawImage() {} }), play: async () => {},
  };
}
function page(name) {
  const nodes = new Map(), sent = [], frames = [], timers = new Map(); let id = 0;
  const get = (id) => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const document = Object.assign(element(), { body: element(), documentElement: element(), getElementById: get, createElement: element });
  get('map').hidden = true;
  const window = Object.assign(element(), { innerWidth: 800, innerHeight: 600 });
  const opts = {};
  window.phoneview = { send: (m) => sent.push(JSON.parse(JSON.stringify(m))), on: (t, fn) => { opts[t] = fn; } };
  const context = { window, document, console, TwoFinger, PhonePointer, URLSearchParams, location: { search: '?kind=screen' }, devicePixelRatio: 1,
    ResizeObserver: class { observe() {} }, performance: { now: () => 1000 },
    TD: { send: (json) => sent.push(JSON.parse(json)), ready() {}, haptic() {}, tick() {}, playing() {} },
    setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, requestAnimationFrame(fn) { frames.push(fn); return frames.length; } };
  window.TD = context.TD;
  window.requestAnimationFrame = context.requestAnimationFrame;
  window.cancelAnimationFrame = () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, name), 'utf8'), context);
  return { get, window, document, sent, timers, frames, opts };
}
const source = (name) => `../../android/app/src/main/assets/web/${name}.js`;
const finger = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y });
function pinch(target) {
  target.emit('pointerdown', finger(1, 100, 200)); target.emit('pointerdown', finger(2, 200, 200));
  target.emit('pointermove', finger(1, 70, 200)); target.emit('pointermove', finger(2, 230, 200));
  target.emit('pointerup', finger(1, 70, 200)); target.emit('pointerup', finger(2, 230, 200));
}
test('recognizer distinguishes steady two-finger scrolling from spread/contract pinches', () => {
  const scroll = [], zoom = [];
  const s = new TwoFinger({ x: 100, y: 100 }, { x: 200, y: 100 }, (...v) => scroll.push(v), (v) => zoom.push(v));
  s.update({ x: 100, y: 120 }, { x: 200, y: 120 });
  assert.equal(s.mode, 'scroll'); assert.deepEqual(scroll, [[0, -40]]); assert.equal(zoom.length, 0);
  const z = new TwoFinger({ x: 100, y: 100 }, { x: 200, y: 100 }, (...v) => scroll.push(v), (v) => zoom.push(v));
  z.update({ x: 80, y: 100 }, { x: 220, y: 100 }); z.update({ x: 110, y: 100 }, { x: 190, y: 100 });
  assert.equal(z.mode, 'zoom'); assert(zoom[0] > 0 && zoom[1] < 0); assert.equal(scroll.length, 1);
});
for (const name of ['viewer', 'remote']) {
  test(`Android ${name}: separate pointer reports for a sideways two-finger scroll never zoom`, () => {
    const t = page(source(name)), target = name === 'viewer' ? t.window : t.get('pad');
    target.emit('pointerdown', finger(1, 100, 200)); target.emit('pointerdown', finger(2, 200, 200));
    target.emit('pointermove', finger(1, 130, 200)); target.emit('pointermove', finger(2, 230, 200));
    target.emit('pointerup', finger(1, 130, 200)); target.emit('pointerup', finger(2, 230, 200));
    for (const fn of t.frames) fn();
    assert(t.sent.some((v) => v.t.endsWith('.wh') && v.dx < 0));
    assert(!t.sent.some((v) => v.code === 'ControlLeft'));
  });
  test(`Android ${name}: actual pointer handlers emit Ctrl+wheel zoom without accidental click/scroll`, () => {
    const t = page(source(name)); const target = name === 'viewer' ? t.window : t.get('pad');
    pinch(target);
    assert(t.sent.some((v) => v.t.endsWith('.wh') && v.dy < 0));
    assert.equal(t.sent.filter((v) => v.t.endsWith('.md') || v.t.endsWith('.mu')).length, 0);
    const zooms = t.sent.filter((v) => !v.t.endsWith('.mm'));
    for (let i = 0; i < zooms.length; i += 3) {
      assert.equal(zooms[i].code, 'ControlLeft'); assert(zooms[i].t.endsWith('.kd'));
      assert(zooms[i + 1].t.endsWith('.wh')); assert(zooms[i + 2].t.endsWith('.ku'));
    }
    assert.equal(t.timers.size, 0, 'hold timer removed on the second finger');
  });
  test(`Android ${name}: zoom preserves a Ctrl key already held by the user`, () => {
    const t = page(source(name)); t.window.emit('keydown', { code: 'ControlLeft' }); t.sent.length = 0;
    pinch(name === 'viewer' ? t.window : t.get('pad'));
    assert(t.sent.some((v) => v.t.endsWith('.wh')));
    assert(!t.sent.some((v) => v.code === 'ControlLeft'));
    t.window.emit('keyup', { code: 'ControlLeft' }); assert(t.sent.at(-1).t.endsWith('.ku'));
  });
  test(`Android ${name}: cancelled touches never produce a tap`, () => {
    const t = page(source(name)), target = name === 'viewer' ? t.window : t.get('pad');
    target.emit('pointerdown', finger(1, 100, 200)); target.emit('pointercancel', finger(1, 100, 200));
    assert(!t.sent.some((v) => v.t.endsWith('.md') || v.t.endsWith('.mu')));
  });
}
test('Android viewer zoom reaches the Windows input helper as Ctrl + wheel up + Ctrl release', () => {
  const t = page(source('viewer')); pinch(t.window);
  const injected = [];
  const input = new RemoteInput({ settings: { pcScreen: { input: true }, keys: {} }, inputAllowed: () => true, link: { peerOs: 'android' }, helper: { send: (cmd, data) => injected.push(data.ev) } });
  for (const m of t.sent) input.handle(m, () => {});
  assert.equal(injected[0].t, 'k.kd'); assert.equal(injected[0].code, 'ControlLeft');
  assert.equal(injected[1].t, 'k.wh'); assert(injected[1].dy < 0);
  assert.equal(injected[2].t, 'k.ku');
});
test('Windows viewer keeps fullscreen and mouse mode in bottom tools, shows exit notice and ignores held F11 repeats', () => {
  const t = page('../phoneview-renderer.js'), tools = t.get('panel').children;
  const full = tools.find((v) => v.title === 'Fullscreen (F11)'), mouse = tools.find((v) => v.title.startsWith('Mouse mode'));
  assert(full && mouse); assert.equal(mouse['aria-pressed'], 'false');
  mouse.onclick(); assert.equal(mouse['aria-pressed'], 'true'); mouse.onclick(); assert.equal(mouse['aria-pressed'], 'false');
  full.onclick(); assert.equal(t.sent.at(-1).t, 'full');
  t.opts.opts({ full: true }); assert.equal(t.get('notice').textContent, 'Press F11 to exit fullscreen'); assert.equal(t.get('notice').hidden, false);
  t.window.emit('keydown', { key: 'F11', code: 'F11', repeat: true });
  assert.equal(t.sent.filter((v) => v.t === 'full').length, 1);
  t.opts.opts({ full: false }); assert.equal(t.get('notice').hidden, true); assert.equal(full['aria-pressed'], 'false');
});
