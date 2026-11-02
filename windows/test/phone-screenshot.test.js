'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
function setup(write) {
  const results = [], popups = [];
  const electron = { app: { on() {} }, clipboard: { write },
    nativeImage: { createFromBuffer: () => ({ isEmpty: () => false }) },
    ClipboardItem: class { constructor(items) { this.items = items; } } };
  function load(file, extra = {}) {
    const mod = { exports: {} }, realRequire = createRequire(file);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: mod, exports: mod.exports,
      require: (id) => id === 'electron' ? electron : extra[id] || realRequire(id),
      Buffer, Uint8Array, Blob, setTimeout, clearTimeout, console, __dirname: path.dirname(file) }, { filename: file });
    return mod.exports;
  }
  const image = load(path.resolve(__dirname, '../../shared/clipimage.js'));
  const { PhoneViews } = load(path.resolve(__dirname, '../phoneview.js'), { '../shared/clipimage.js': image });
  const views = { _send: (_v, ch, value) => results.push({ ch, ...value }), bridge: { emit: (...args) => popups.push(args) } };
  return { shot: (view, bytes) => PhoneViews.prototype._shot.call(views, view, bytes), results, popups };
}
test('phone screenshot writes the supplied phone PNG using the async clipboard API and acknowledges after commit', async () => {
  let release, started, received;
  const began = new Promise((r) => { started = r; });
  const t = setup(async (items) => { received = Buffer.from(await items[0].items['image/png'].arrayBuffer()); started(); await new Promise((r) => { release = r; }); });
  const view = {}, copying = t.shot(view, png); await began;
  assert.deepEqual(received, png); assert.equal(t.results.length, 0); assert.equal(t.popups.length, 0);
  release(); await copying;
  assert.equal(t.results[0].ch, 'phoneview:shotResult'); assert.equal(t.results[0].ok, true);
  assert.match(t.popups[0][2], /Phone screenshot copied/); assert.equal(view.copyingShot, false);
});
test('clipboard rejection reports failure without an uncaught exception or success acknowledgement', async () => {
  const t = setup(async () => { throw new Error('clipboard busy'); });
  await t.shot({}, png);
  assert.equal(t.results[0].ok, false); assert.match(t.results[0].error, /could not be copied/);
  assert(!t.popups.some((p) => /screenshot copied/.test(p[2])));
});
test('invalid phone screenshot payloads never write the clipboard', async () => {
  let writes = 0; const t = setup(async () => { writes++; });
  for (const value of [null, Buffer.alloc(100), new Uint8Array([1, 2]), { png }]) await t.shot({}, value);
  assert.equal(writes, 0); assert.equal(t.results.length, 4); assert(t.results.every((r) => r.ok === false));
});
