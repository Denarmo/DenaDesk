'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
function open(display, phone) {
  const file = path.resolve(__dirname, '../phoneview.js'), mod = { exports: {} }, realRequire = createRequire(file);
  const electron = { app: { on() {} }, screen: { getCursorScreenPoint: () => ({ x: 10, y: 10 }), getDisplayNearestPoint: () => display } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: mod, exports: mod.exports, require: id => id === 'electron' ? electron : realRequire(id), __dirname: path.dirname(file) });
  let result;
  mod.exports.PhoneViews.prototype.openApp.call({ views: new Map(), phone, _chrome: () => ({ w: 0, h: 120 }),
    bridge: { sessionOpts: (_kind, opts) => opts }, _open: opts => { result = opts; } }, 'example.app', 'Example');
  return result;
}
test('new phone app windows follow the phone aspect and fit the chosen monitor work area', () => {
  for (const workAreaSize of [{ width: 1920, height: 1080 }, { width: 768, height: 600 }, { width: 360, height: 800 }]) {
    const result = open({ workAreaSize, scaleFactor: 1.25 }, { info: { display: { w: 1440, h: 3200 } } });
    assert(Math.abs(result.width / (result.height - 120) - 1440 / 3200) < .002);
    assert(result.height <= workAreaSize.height - 80); assert(result.width <= workAreaSize.width - 80);
    assert.equal(result.opts.newDisplay, `${result.width * 2}x${(result.height - 120) * 2}/320`);
    assert.equal(result.displayScale, 2);
  }
});
test('app virtual pixel density and renderer scale agree on high-DPI monitors', () => {
  const result = open({ workAreaSize: { width: 1600, height: 1000 }, scaleFactor: 2.5 }, {});
  assert.equal(result.displayScale, 2.5); assert(result.opts.newDisplay.endsWith('/400'));
  assert.equal(result.opts.newDisplay, `${Math.round(result.width * 2.5)}x${Math.round((result.height - 120) * 2.5)}/400`);
});
