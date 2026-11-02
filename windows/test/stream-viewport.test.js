'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Viewport = require('../../android/app/src/main/assets/web/stream-viewport');
const near = (a, b) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test('local magnification keeps the remote point beneath a moving pinch midpoint', () => {
  const v = new Viewport(); v.resize(800, 600, 1920, 1080);
  const before = v.norm(400, 300);
  v.zoomAt(2.5, 400, 300, 440, 320);
  const after = v.norm(440, 320);
  near(before.x, after.x); near(before.y, after.y); near(v.scale, 2.5);
});
test('letterboxed video rejects taps outside the picture and maps zoomed mouse/pen/touch points exactly', () => {
  const v = new Viewport(); v.resize(400, 800, 1920, 1080);
  assert.equal(v.norm(200, 100), null);
  near(v.norm(200, 400).x, .5); near(v.norm(200, 400).y, .5);
  v.zoomAt(5, 200, 400); const r = v.rect();
  for (const [x, y] of [[.45, .4], [.5, .5], [.55, .6]]) {
    const hit = v.norm(r.x + r.w * x, r.y + r.h * y);
    near(hit.x, x); near(hit.y, y);
  }
});
test('magnified content stays bounded, and reset returns to its fitted geometry', () => {
  const v = new Viewport(); v.resize(800, 600, 800, 600);
  v.zoomAt(100, 400, 300); assert.equal(v.scale, 8);
  v.zoomAt(1, 400, 300, 100000, -100000);
  const r = v.rect(); near(r.x, 0); near(r.y + r.h, 600);
  v.zoomAt(.0001, 100, 100); assert.equal(v.scale, 1);
  assert.deepEqual(v.rect(), { x: 0, y: 0, w: 800, h: 600 });
  v.zoomAt(3, 400, 300); v.reset(); assert.equal(v.transform(), 'matrix(1,0,0,1,0,0)');
});
test('rotation and incoming video size changes preserve the visible remote center and correct input mapping', () => {
  const v = new Viewport(); v.resize(800, 600, 1600, 1200);
  v.zoomAt(3, 300, 250);
  const before = v.norm(400, 300);
  v.resize(600, 800, 1600, 1200);
  const after = v.norm(300, 400);
  near(after.x, before.x); near(after.y, before.y); near(v.scale, 3);
  v.resize(600, 800, 1920, 1080);
  const updated = v.norm(300, 400); near(updated.x, after.x); near(updated.y, after.y);
});
test('relative pointer movement can reveal the controlled point without exposing empty image edges', () => {
  const v = new Viewport(); v.resize(800, 600, 800, 600); v.zoomAt(4, 400, 300);
  v.reveal(.9, .1); const r = v.rect();
  near(r.x + r.w * .9, 776); near(r.y + r.h * .1, 24);
  assert(r.x <= 0 && r.y <= 0 && r.x + r.w >= 800 && r.y + r.h >= 600);
});
