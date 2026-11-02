// Security regression tests. No application, helper or device connection is started.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { interpret } = require('../firewall');
const { Updates } = require('../../shared/updates');
const support = require('../../shared/support');

const allow = { enabled: 'True', action: 'Allow', profile: 'Private, Domain', protocol: 'Any' };
const net = (category) => ({ category, alias: 'Test network', index: 1, ipv4: 'Internet' });
test('Public networks and unreadable rules are not treated as safe', () => {
  assert.equal(interpret({ networks: [net('Private')], rules: [allow] }).ok, true);
  assert.equal(interpret({ networks: [net('DomainAuthenticated')], rules: [allow] }).ok, true);
  assert.equal(interpret({ networks: [net('Public')], rules: [{ ...allow, profile: 'Any' }] }).ok, false);
  assert.equal(interpret({ networks: [net('Private')], readable: false }).ok, false);
  assert.equal(interpret({ networks: [net('Private')], rules: [allow, { ...allow, action: 'Block' }] }).blocked, true);
});

test('phone setup never grants privileges or changes ADB security settings', async () => {
  for (const platform of ['windows', 'linux', 'mac']) for (const mode of ['', 'mesh/']) {
    const { PhoneBridge } = require(path.join('../..', platform, mode, 'phone-bridge.js'));
    const commands = [];
    const obj = { setupDone: new Set(), adb: { shell: async (...args) => commands.push(args) }, server: { sendToClient() {} } };
    await PhoneBridge.prototype._setup.call(obj, 'test-phone');
    await PhoneBridge.prototype._setup.call(obj, 'test-phone');
    assert.equal(commands.length, 0, platform + '/' + mode);
    assert.equal(obj.setupDone.has('test-phone'), true);
  }
});

test('automatic updates require an explicit saved opt-in', () => {
  for (const settings of [{}, { updates: {} }, { updates: { auto: false } }]) {
    const u = new Updates({ current: '2.5.1-security.1', platform: 'win', getSettings: () => settings });
    u.start();
    assert.equal(u.first, null);
    assert.equal(u.timer, null);
  }
});

test('support endpoints do not send requests without consent, including through IPC', async () => {
  let requests = 0;
  support.setDeps({ fetch: async () => { requests++; throw new Error('Test prevents networking'); } });
  assert.equal((await support.profile()).ok, false);
  assert.equal((await support.createTip({ amount: 5 })).ok, false);
  const handlers = {};
  support.ipc({ handle: (name, handler) => { handlers[name] = handler; } });
  await handlers['support:profile']({}, {});
  await handlers['support:tip']({}, { amount: 5 });
  assert.equal(requests, 0);
  await handlers['support:profile']({}, { consent: true });
  assert.equal(requests, 1);
});

test('opening the Tip page sends no request; the Load button explicitly opts in', async () => {
  class Element {
    constructor(text) { this.textContent = text; this.children = []; this.classList = { add() {}, toggle() {} }; this.dataset = {}; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    setAttribute() {}
  }
  const buttons = [], tabs = [], calls = [];
  const el = (_tag, props = {}, children = []) => { const e = new Element(props.text); Object.assign(e, props); e.append(...children); return e; };
  const UI = {
    el, tab: (t) => tabs.push(t), card: (_name, children) => el('div', {}, children),
    button: (label, fn) => { const e = new Element(label); e.onclick = fn; buttons.push(e); return e; },
    segmented: () => ({ el: el('div'), set() {} }),
    api: { supportProfile: async (o) => { calls.push(o); return { ok: false, error: 'offline in test' }; } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../shared/ui-support.js'), 'utf8'), {
    UI, window: { dispatchEvent() {} }, CustomEvent: class {}, setTimeout,
  });
  const activate = tabs.find((t) => t.id === 'tip').build(el('body'));
  activate();
  await Promise.resolve();
  assert.equal(calls.length, 0);
  buttons.find((b) => b.textContent === 'Load tip service').onclick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].consent, true);
});

test('cached ADB executables with changed bytes are rejected', async () => {
  const { fetchAdb } = require('../scripts/fetch-adb');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duodesk-adb-test-'));
  try {
    for (const f of ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll']) fs.writeFileSync(path.join(dir, f), 'tampered');
    await assert.rejects(fetchAdb(dir), /checksum mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
