'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { keepInTray } = require('../window-shell');
const { phoneAction, scopedControls } = require('../phone-actions');
const { mount } = require('../../shared/phone-dock');
const { Server } = require('../mesh/server');
const Link = require('../mesh/link');
const P = require('../../shared/protocol');

test('minimize and close preserve the window; tray reopen restores taskbar presence; Quit can close', () => {
  const w = new EventEmitter();
  let hidden = false, skip = false, quitting = false, saved = 0, prevented = 0;
  w.hide = () => { hidden = true; };
  w.setSkipTaskbar = (v) => { skip = v; };
  keepInTray(w, { quitting: () => quitting, saveBounds: () => saved++ });
  w.emit('minimize');
  assert.equal(hidden && skip, true);
  w.emit('show');
  assert.equal(skip, false);
  w.emit('close', { preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  assert.equal(saved, 2);
  quitting = true;
  w.emit('close', { preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
});

test('server and guest allow an idle link one active timeout after selection, then close silent peers', () => {
  let now = 100000, busy = false, closed = 0;
  const ws = { transport: 'net', readyState: 1, OPEN: 1, lastRx: now, lastTx: now, terminate() { closed++; }, send() {} };
  const ctx = { authed: true, ws, lastRx: now, lastTx: now };
  const server = { sockets: [ctx], _isBusy: () => busy, blePorts: new Map(), send() {}, _raw() {} };
  Server.prototype.liveness.call(server, now);
  now += 4500; busy = true;
  Server.prototype.liveness.call(server, now);
  assert.equal(closed, 0, 'selection must ping a healthy idle link instead of terminating it');
  Server.prototype.liveness.call(server, now + P.TIMEOUT_MS + 1);
  assert.equal(closed, 1, 'an unresponsive selected peer still times out');

  delete ws.wasBusy; delete ws.busySince; closed = 0; busy = false; now = 200000;
  ws.lastRx = ws.lastTx = now;
  const guest = { ws, alt: null, busy: () => busy, _tryResume() {} };
  const original = Date.now;
  try {
    Date.now = () => now;
    Link.prototype._keepalive.call(guest);
    now += 4500; busy = true;
    Link.prototype._keepalive.call(guest);
    assert.equal(closed, 0);
    now += P.TIMEOUT_MS + 1;
    Link.prototype._keepalive.call(guest);
    assert.equal(closed, 1);
  } finally { Date.now = original; }
});

test('phone shortcuts reject stale or computer IDs and send only to the chosen phone', async () => {
  const sent = [], shell = [];
  const phone = { id: 'phone-A', connected: true, ctl: { sessionUp: true, view: { qs: { wifi: true, panel: {} }, can: {} }, do: async (c) => sent.push(c) }, bridge: { serial: 'usb-A', adb: { shell: async (...a) => { shell.push(a); return { code: 0 }; } } }, views: { openScreen() {} } };
  const resolve = (id) => id === phone.id ? phone : null;
  for (const id of ['computer', 'old-phone', '', null]) assert.equal((await phoneAction(resolve, { id, action: 'lock' })).ok, false);
  assert.equal(sent.length, 0);
  assert.equal((await phoneAction(resolve, { id: phone.id, action: 'wifi', on: false })).ok, true);
  assert.deepEqual(sent, [{ do: 'qs', id: 'wifi', on: false }]);
  await phoneAction(resolve, { id: phone.id, action: 'notifications' });
  assert.deepEqual(shell[0].slice(0, 2), ['usb-A', 'cmd statusbar expand-notifications']);
  phone.connected = false;
  assert.equal((await phoneAction(resolve, { id: phone.id, action: 'lock' })).ok, false);
  assert.equal(sent.length, 1);
});

test('scoped phone state and controls remain independent of computer selection', async () => {
  const link = new EventEmitter();
  const sent = [];
  link.sendToClient = (m) => sent.push(m);
  const ctl = scopedControls(link, {});
  try {
    link.emit('client');
    link.emit('t:dev.state', { can: { qs: true }, qs: { bluetooth: true, panel: {} } });
    await ctl.do({ do: 'qs', id: 'bluetooth', on: false });
    assert.deepEqual(sent, [{ t: 'dev.do', do: 'qs', id: 'bluetooth', on: false }]);
    link.emit('closed');
    assert.equal(ctl.view, null);
    await ctl.do({ do: 'lock' });
    assert.equal(sent.length, 1);
  } finally { ctl.stop(); }
});

class Element {
  constructor() { this.children = []; this.dataset = {}; this.attrs = {}; }
  append(...x) { this.children.push(...x); }
  replaceChildren(...x) { this.children = x; }
  setAttribute(k, v) { this.attrs[k] = v; }
}
test('phone dock pins its phone while a computer is selected and handles disconnects', async () => {
  const parent = new Element(), sent = [];
  const ui = mount({ document: { createElement: () => new Element() }, parent, api: { phoneAction: async (r) => { sent.push(r); return { ok: true }; } } });
  const phone = { id: 'phone', name: 'POCO', usb: true, ctl: { qs: { wifi: true, panel: {} } } };
  ui.update({ mesh: { selectedId: 'laptop' }, phone: { quick: [phone] } });
  const actions = parent.children[0].children[1].children;
  await actions.find((b) => b.dataset.action === 'wifi').onclick();
  assert.deepEqual(sent, [{ id: 'phone', action: 'wifi', on: false }]);
  ui.update({ phone: { quick: [] } });
  assert.ok(actions.every((b) => b.disabled));
  await actions[0].onclick();
  assert.equal(sent.length, 1);
});


test('resource samples are cached, sum app/helper memory, normalize CPU, and use no background timer', async () => {
  const { create } = require('../resource-usage');
  let now = 100000, cpu = 10, reads = 0;
  const sample = create({ now: () => now, cores: 4,
    app: { getAppMetrics: () => { reads++; return [{ pid: 1, cpu: { cumulativeCPUUsage: cpu }, memory: { workingSetSize: 1024 } }]; } },
    nativePids: () => [2, 2, 1], helper: () => ({ running: true, request: async (_name, args) => { assert.deepEqual(args.pids, ['2']); return { processes: [{ pid: 2, cpuSeconds: cpu, workingSet: 1048576 }] }; } }),
  });
  const first = await sample();
  assert.equal(first.cpu, null);
  assert.equal(first.memoryBytes, 2097152);
  assert.equal(first.processes, 2);
  await sample(); assert.equal(reads, 1);
  now += 3000; cpu += 0.3;
  assert.ok(Math.abs((await sample()).cpu - 5) < 0.001);
  now += 20000;
  assert.equal((await sample()).cpu, null, 'resume starts a fresh CPU measurement window');
});

test('Mesh notification history survives disabled toasts, separates devices, and clears', () => {
  const Notifs = require('../mesh/notifs');
  const { Mesh } = require('../../shared/mesh');
  const bus = new EventEmitter();
  bus.onPeer = () => {}; bus.connectedIds = () => ['phone-A', 'phone-B']; bus.send = () => true;
  const helper = new EventEmitter(); helper.running = false;
  const n = new Notifs({ bus, mesh: new Mesh({ selfId: 'pc' }), helper,
    settings: { notifs: { receive: true, send: false, muted: [] } }, save() {}, onChange() {}, selfIds: [],
    Notification: { isSupported: () => false },
  });
  const msg = { t: 'notif', id: 'same-key', app: 'chat', title: 'Message', body: 'Same text', at: 123, reply: true };
  n._show(msg, 'phone-A');
  n._show(msg, 'phone-B');
  assert.equal(n.view().history.length, 2);
  assert.deepEqual(new Set(n.view().history.map((h) => h.originId)), new Set(['phone-A', 'phone-B']));
  assert.equal(n.reply('same-key', 'Hi', 'unknown'), false);
  assert.equal(n.reply('same-key', 'Hi', 'phone-A'), true);
  n.clearHistory();
  assert.equal(n.view().history.length, 0);
  assert.equal(n.historyIcons.size, 0);
});


test('photo menu rejects untrusted formats, bounds previews and sanitizes filenames', () => {
  const { preview } = require('../photo-menu');
  assert.equal(preview({ data: 'https://example.com/photo.png' }), null);
  assert.equal(preview({ data: 'data:image/svg+xml;base64,PHN2Zz4=' }), null);
  assert.equal(preview({ data: 'data:image/png;base64,' + 'A'.repeat(12000000) }), null);
  const p = preview({ data: 'data:image/png;base64,aGVsbG8=', name: '../phone\\image?.png' });
  assert.equal(p.extension, 'png');
  assert.equal(p.bytes.toString(), 'hello');
  assert.ok(!/[\\/?:]/.test(p.name));
});
