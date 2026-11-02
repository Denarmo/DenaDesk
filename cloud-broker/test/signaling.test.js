'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once, EventEmitter } = require('events');
const fs = require('fs/promises'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const P = require('../../shared/remote-protocol');
const { createServer } = require('../server');
const { Registry } = require('../registry');
const { RemoteLink } = require('../../windows/remote-link');
const audience = 'test-client.apps.googleusercontent.com';
const subject = '123456789';
const sdp = 'v=0\r\na=fingerprint:sha-256 ' + Array(32).fill('AB').join(':') + '\r\n';
const sleep = (n) => new Promise((r) => setTimeout(r, n));
async function until(fn) { const end = Date.now() + 4000; while (!fn()) { if (Date.now() > end) throw new Error('Condition timed out'); await sleep(10); } }
async function setup() {
  const server = createServer({ audience, allowedSubjects: [subject, '987654321'], verify: async (token) => ({ aud: audience, iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 3600, email_verified: true, sub: token === 'other' ? '987654321' : subject }) });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, endpoint: `ws://127.0.0.1:${server.address().port}/v1/link`, close: async () => { server.signaling.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); } };
}
test('linking before setup gives actionable guidance without registering or connecting', async () => {
  const account = new EventEmitter(); let writes = 0, connections = 0;
  const link = new RemoteLink({ account, name: 'PC', store: { read: async () => ({}), write: async () => { writes++; } } });
  link.connect = () => { connections++; };
  await link.load(); const initialWrites = writes;
  assert.match((await link.enable()).error, /Google sign-in is unavailable in this build/);
  account.config = { clientId: 'test-client.apps.googleusercontent.com' };
  assert.match((await link.enable()).error, /Sign in with Google/);
  assert.equal(link.enabledFor, null); assert.equal(writes, initialWrites); assert.equal(connections, 0);
  account.account = { sub: subject };
  assert.equal((await link.enable()).error, '');
  assert.equal(link.enabledFor, subject); assert.equal(connections, 1);
  await link.disable();
});
async function client(endpoint, token = 'owner') {
  const identity = P.generate(), ws = new WebSocket(endpoint), events = new EventEmitter(), messages = [];
  ws.on('message', (raw) => { const m = JSON.parse(raw); messages.push(m); events.emit('message', m);
    if (m.type === 'challenge') { const v = { nonce: m.nonce, publicKey: identity.publicKey, name: 'Test PC' }; ws.send(JSON.stringify({ type: 'auth', ...v, signature: P.sign(v, identity.privateKey), token })); } });
  await until(() => messages.some((m) => m.type === 'ready'));
  return { identity, ws, messages, send(value) { ws.send(JSON.stringify({ type: 'signal', value, signature: P.sign(value, identity.privateKey) })); } };
}
function value(a, b, kind, seq = 0, sid = 'a'.repeat(32), payload = { mode: 'view' }) { return { v: 1, sid, from: a.identity.id, to: b.identity.id, seq, expires: Date.now() + 60000, kind, payload }; }
test('broker isolates accounts and requires host approval before exchanging SDP', async () => {
  const t = await setup();
  try {
    const a = await client(t.endpoint), b = await client(t.endpoint), outsider = await client(t.endpoint, 'other');
    assert(outsider.messages.filter((m) => m.type === 'devices').every((m) => m.devices.length === 1));
    a.send(value(a, b, 'request')); await until(() => b.messages.some((m) => m.type === 'signal'));
    const closed = once(a.ws, 'close'); a.send(value(a, b, 'offer', 1, 'a'.repeat(32), { sdp })); await closed;
    assert(!b.messages.some((m) => m.value?.kind === 'offer'));
  } finally { await t.close(); }
});
test('broker rejects relayed ICE and replayed approval messages', async () => {
  const t = await setup();
  try {
    const a = await client(t.endpoint), b = await client(t.endpoint);
    a.send(value(a, b, 'request')); await until(() => b.messages.some((m) => m.value?.kind === 'request'));
    b.send(value(b, a, 'accept')); await until(() => a.messages.some((m) => m.value?.kind === 'accept'));
    const closed = once(b.ws, 'close');
    b.send(value(b, a, 'ice', 1, 'a'.repeat(32), { candidate: 'candidate:123 1 udp 1 192.0.2.1 12345 typ relay', sdpMid: '0', sdpMLineIndex: 0 })); await closed;
    assert(!a.messages.some((m) => m.value?.kind === 'ice'));
  } finally { await t.close(); }
  const t2 = await setup();
  try {
    const a = await client(t2.endpoint), b = await client(t2.endpoint);
    a.send(value(a, b, 'request')); await until(() => b.messages.some((m) => m.value?.kind === 'request'));
    const accept = value(b, a, 'accept'); b.send(accept); await until(() => a.messages.some((m) => m.value?.kind === 'accept'));
    const closed = once(b.ws, 'close'); b.send(accept); await closed;
    assert.equal(a.messages.filter((m) => m.value?.kind === 'accept').length, 1);
  } finally { await t2.close(); }
});
test('registry survives reload without storing OAuth or private key material', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'denadesk-registry-'));
  try {
    const file = path.join(dir, 'registry.json'), registry = new Registry(file), identity = P.generate();
    await registry.load(); await registry.put(subject, { id: identity.id, publicKey: identity.publicKey, name: 'PC', lastSeen: Date.now() });
    const next = new Registry(file); await next.load(); assert.equal(next.list(subject)[0].id, identity.id); assert.equal(next.list('987654321').length, 0);
    const saved = await fs.readFile(file, 'utf8'); assert(!saved.includes('PRIVATE')); assert(!saved.includes('token'));
    await next.remove(subject, identity.id); assert.equal(next.list(subject).length, 0);
  } finally { await fs.unlink(path.join(dir, 'registry.json')).catch(() => {}); await fs.rmdir(dir); }
});
test('two desktop clients require local trust and host consent, verify signed negotiation, and end on revocation', async () => {
  const t = await setup(), links = [], workers = [];
  try {
    let approvals = 0;
    for (const name of ['Host', 'Guest']) {
      const account = new EventEmitter(); account.account = { sub: subject }; account.getIdToken = async () => 'owner';
      let saved = {};
      const link = new RemoteLink({ account, name, endpoint: t.endpoint, store: { read: async () => saved, write: async (v) => { saved = structuredClone(v); } },
        approve: async () => { approvals++; return true; }, startSession: (options) => {
          const worker = { options, messages: [], stopped: false, signal(kind, payload) { this.messages.push({ kind, payload }); }, stop() { this.stopped = true; } }; workers.push(worker); return worker;
        } });
      await link.load(); links.push(link); await link.enable();
    }
    const [host, guest] = links;
    await until(() => links.every((l) => l.status === 'online' && l.devices.length === 2));
    await guest.request(host.identity.id, 'control'); await until(() => workers.length === 2);
    assert.equal(approvals, 3); assert(host.isTrusted(guest.identity)); assert(guest.isTrusted(host.identity));
    const hostWorker = workers.find((w) => w.options.role === 'host'), guestWorker = workers.find((w) => w.options.role === 'guest');
    hostWorker.options.send('offer', { sdp }); await until(() => guestWorker.messages.length === 1);
    guestWorker.options.send('answer', { sdp }); await until(() => hostWorker.messages.length === 1);
    await host.forget(guest.identity.id); await until(() => !guest.session);
    assert(workers.every((w) => w.stopped)); assert(!host.isTrusted(guest.identity));
    const view = JSON.stringify(host.view()); assert(!view.includes('PRIVATE KEY')); assert(!view.includes('owner'));
  } finally { for (const link of links) await link.disable(); await t.close(); }
});

test('declined host consent never starts screen capture and account sign-out closes the link', async () => {
  const t = await setup(), links = []; let captures = 0;
  try {
    for (const name of ['Host', 'Guest']) {
      const account = new EventEmitter(); account.account = { sub: subject }; account.getIdToken = async () => 'owner'; let saved = {};
      const l = new RemoteLink({ account, name, endpoint: t.endpoint, store: { read: async () => saved, write: async (v) => { saved = structuredClone(v); } },
        approve: async (r) => r.type === 'trust', startSession: () => { captures++; throw new Error('Capture must not start'); } });
      links.push(l); await l.load(); await l.enable();
    }
    await until(() => links.every((l) => l.status === 'online' && l.devices.length === 2));
    await links[1].request(links[0].identity.id, 'view'); await until(() => !links[0].session && !links[1].session);
    assert.equal(captures, 0);
    links[0].account.account = null; links[0].account.emit('change'); await until(() => !links[0].enabledFor && !links[0].socket);
  } finally { for (const l of links) await l.disable(); await t.close(); }
});
