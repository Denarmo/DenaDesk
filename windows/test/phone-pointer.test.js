'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const PhonePointer = require('../phone-pointer');
const e = (overrides = {}) => ({ pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 20, clientY: 20, ...overrides });
const p = { x: 50, y: 60 }, size = { width: 400, height: 800 };
function setup() {
  const sent = [], timers = new Map(); let id = 0;
  const delays = [];
  const input = new PhonePointer((m) => sent.push(m), { setTimeout(fn, ms) { delays.push(ms); timers.set(++id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  const tick = () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); };
  return { input, sent, timers, delays, tick };
}
test('touch is the default: hover is silent and click/drag inject only a finger', () => {
  const { input, sent } = setup();
  input.move(e(), p); input.leave(p); assert.equal(sent.length, 0);
  input.down(e(), p); input.move(e(), { x: 80, y: 90 }); input.up(e({ buttons: 0 }), p);
  assert.deepEqual(sent.map((v) => [v.action, v.pointer, v.buttons]), [[0, -2, 0], [2, -2, 0], [1, -2, 0]]);
});
test('mouse mode opts into Android mouse hover and real button masks; switching mode releases held input', () => {
  const { input, sent } = setup();
  input.setMouseMode(true); input.move(e({ buttons: 0 }), p);
  input.down(e({ button: 2, buttons: 2 }), p);
  input.setMouseMode(false);
  assert.deepEqual(sent.map((v) => [v.action, v.pointer, v.actionButton, v.buttons]), [[7, -1, 0, 0], [0, -1, 2, 2], [1, -1, 2, 0], [10, -1, 0, 0]]);
  sent.length = 0; input.move(e(), p); assert.equal(sent.length, 0);
});
test('physical multitouch keeps independent finger IDs even in mouse mode', () => {
  const { input, sent } = setup(); input.setMouseMode(true);
  input.down(e({ pointerType: 'touch', pointerId: 40 }), p);
  input.down(e({ pointerType: 'touch', pointerId: 41 }), p);
  input.move(e({ pointerType: 'touch', pointerId: 41 }), p); input.release();
  assert.deepEqual(sent.map((v) => [v.action, v.pointer]), [[0, 2], [0, 3], [2, 3], [1, 2], [1, 3]]);
  assert.equal(input.active.size, 0);
});
test('touch wheel swipes and Ctrl+wheel pinches stay bounded and release every finger on blur', () => {
  const { input, sent, timers } = setup();
  input.wheel({ deltaY: 30, deltaX: 0, deltaMode: 0 }, p, size);
  assert.deepEqual(sent.map((v) => [v.t, v.action, v.pointer, v.y]), [['touch', 0, -2, 110]]);
  input.wheel({ ctrlKey: true, deltaY: -100, deltaX: 0, deltaMode: 0 }, p, size);
  assert.equal(sent[1].action, 1, 'swipe lifts before pinch');
  assert.equal(timers.size, 1);
  input.release();
  assert.equal(timers.size, 0);
  assert.deepEqual(sent.slice(-2).map((v) => [v.action, v.pointer]), [[1, 0], [1, 1]]);
  assert(sent.every((v) => v.x >= 0 && v.x < size.width && v.y >= 0 && v.y < size.height));
});

test('wheel movement follows the displayed scale, spans real frames and lifts while moving', () => {
  const run = (width, height) => {
    const t = setup();
    t.input.wheel({ deltaY: 120, deltaX: 0, deltaMode: 0 }, { x: width / 2, y: height / 2 }, { width, height }, { width: 400, height: 800 });
    assert.equal(t.sent.length, 1, 'DOWN is not immediately followed by MOVE');
    while (t.timers.size) t.tick();
    assert.deepEqual(t.sent.map(v => v.action), [0, 2, 2, 2, 2, 2, 1]);
    assert(t.delays.every(ms => ms === 16));
    assert.equal(t.sent.at(-1).y, t.sent.at(-2).y, 'UP follows the final moving sample with no hold');
    assert(t.sent.at(-2).y < t.sent.at(-3).y);
    return (t.sent[0].y - t.sent.at(-1).y) * 800 / height;
  };
  assert.equal(run(400, 800), 120); assert.equal(run(800, 1600), 120);
});

test('wheel bursts stay bounded, resume at edges, reverse immediately and leave no running timer', () => {
  const t = setup(), wheel = (dy) => t.input.wheel({ deltaY: dy, deltaX: 0, deltaMode: 0 }, { x: 200, y: 1 }, size);
  for (let i = 0; i < 30; i++) { wheel(120); t.tick(); assert.equal(t.timers.size, 1); }
  wheel(-120);
  const start = t.sent.at(-1); assert.equal(start.action, 0);
  while (t.timers.size) t.tick();
  assert(t.sent.at(-1).y > start.y, 'reversal swipes down');
  assert(t.sent.filter(v => v.action === 0).length > 1, 'edge-bound fingers are re-anchored');
  assert(t.sent.every(v => v.x >= 0 && v.x < size.width && v.y >= 0 && v.y < size.height));
  assert.equal(t.sent.filter(v => v.action === 0).length, t.sent.filter(v => v.action === 1).length);
  assert.equal(t.input.gesture, null);
});

test('line, page and horizontal wheels use CSS units; zero deltas never create a touch', () => {
  const t = setup(); t.input.wheel({ deltaX: 0, deltaY: 0 }, p, size); assert.equal(t.sent.length, 0);
  t.input.wheel({ deltaX: 2, deltaY: 0, deltaMode: 1 }, { x: 200, y: 400 }, size, { width: 200, height: 400 });
  while (t.timers.size) t.tick();
  assert.equal(t.sent[0].x - t.sent.at(-1).x, 64);
  assert.equal(t.sent[0].y, t.sent.at(-1).y);
  t.input.wheel({ deltaX: 0, deltaY: 1, deltaMode: 2 }, p, size, { width: 200, height: 400 });
  while (t.timers.size) t.tick();
  assert(t.sent.at(-1).y < t.sent.at(-7).y);
});
test('mouse wheel remains scrolling and cancelled right-click never navigates Back', () => {
  const { input, sent } = setup(); input.setMouseMode(true);
  input.wheel({ deltaY: 100, deltaX: 0, deltaMode: 0 }, p, size);
  assert.deepEqual(sent.pop(), { t: 'scroll', ...p, hs: -0, vs: -1 });
  input.setMouseMode(false); input.down(e({ button: 2 }), p); input.release();
  assert.equal(sent.length, 0);
  input.down(e({ button: 2 }), p); input.up(e({ button: 2 }), p);
  assert.deepEqual(sent.pop(), { t: 'nav', key: 'back' });
});
