'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GoogleAccount, desktopConfig, encryptedStore } = require('../google-account');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const config = { installed: { client_id: 'test-client.apps.googleusercontent.com', client_secret: 'test-only', project_id: 'test-project' } };

function setup(options = {}) {
  let saved = {}, auth, exchange = 0;
  const store = { read: async () => saved, write: async (v) => { saved = structuredClone(v); } };
  const account = new GoogleAccount({ store, timeoutMs: 1000,
    clientFactory: (c) => ({
      generateCodeVerifierAsync: async () => ({ codeVerifier: 'private-verifier', codeChallenge: 'public-challenge' }),
      generateAuthUrl: (a) => { auth = { ...a, redirectUri: c.redirectUri }; return 'https://accounts.google.com/o/oauth2/v2/auth'; },
      getToken: async (args) => { exchange++; assert.equal(args.codeVerifier, 'private-verifier');
        if (options.exchange) await options.exchange();
        return { tokens: { id_token: 'test-identity', refresh_token: 'test-refresh', access_token: 'test-access' } }; },
      verifyIdToken: async () => ({ getPayload: () => ({ sub: 'test-subject', email: 'owner@example.com', email_verified: true,
        nonce: options.badNonce ? 'wrong' : auth.nonce }) }),
    }),
    openExternal: async (url) => { assert.equal(new URL(url).hostname, 'accounts.google.com'); await options.open?.(auth, account); },
  });
  return { account, saved: () => saved, exchanges: () => exchange, store };
}
async function callback(a, changes = {}) {
  const u = new URL(a.redirectUri);
  u.search = new URLSearchParams({ code: 'authorization-code', state: a.state, ...changes });
  return fetch(u);
}

test('imports only desktop client fields and ignores imported endpoints', () => {
  assert.throws(() => desktopConfig({ web: config.installed }));
  assert.throws(() => desktopConfig({ installed: { ...config.installed, client_id: 'https://attacker.example' } }));
  assert.deepEqual(desktopConfig({ installed: { ...config.installed, token_uri: 'https://attacker.example' } }),
    { clientId: config.installed.client_id, clientSecret: 'test-only', projectId: 'test-project' });
});
test('PKCE sign-in uses a loopback callback, validates state and nonce, exposes no tokens', async () => {
  const t = setup({ open: async (auth) => {
    assert.equal(new URL(auth.redirectUri).hostname, '127.0.0.1');
    assert.equal(auth.code_challenge_method, 'S256'); assert.equal(auth.code_challenge, 'public-challenge');
    assert.deepEqual(auth.scope, ['openid', 'email']);
    assert.equal((await callback(auth, { state: 'wrong' })).status, 400);
    assert.equal((await callback(auth, { state: 'é'.repeat(43) })).status, 400);
    const badHost = new URL(auth.redirectUri); badHost.search = new URLSearchParams({ state: auth.state, code: 'ignored' });
    const status = await new Promise((resolve, reject) => {
      const req = require('http').get(badHost, { headers: { Host: 'untrusted.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
    });
    assert.equal(status, 400);
    assert.equal((await callback(auth)).status, 200);
  } });
  await t.account.configure(config);
  const s = await t.account.signIn();
  assert.equal(s.phase, 'signed-in'); assert.equal(s.account.email, 'owner@example.com'); assert.equal(s.remoteReady, false);
  assert.equal(t.exchanges(), 1); assert.equal(t.saved().tokens.refresh_token, 'test-refresh');
  assert(!JSON.stringify(s).includes('test-refresh')); assert(!JSON.stringify(s).includes('test-only'));
  await t.account.signOut(); assert.equal(t.saved().tokens, null);
});
test('nonce mismatch never persists an authenticated account', async () => {
  const t = setup({ badNonce: true, open: (a) => callback(a) }); await t.account.configure(config);
  const s = await t.account.signIn(); assert.equal(s.account, null); assert.equal(s.error, 'Google identity verification failed.');
  assert.equal(t.saved().tokens, null);
});
test('cancellation closes the callback and keeps tokens out of storage', async () => {
  const t = setup({ open: async (_auth, account) => account.cancel() }); await t.account.configure(config);
  const s = await t.account.signIn(); assert.equal(s.phase, 'signed-out'); assert.equal(t.exchanges(), 0); assert.equal(t.saved().tokens, null);
});
test('timed-out sign-in closes its loopback listener', async () => {
  let redirect;
  const t = setup({ open: async (auth) => { redirect = auth.redirectUri; } });
  t.account.timeoutMs = 30;
  await t.account.configure(config);
  const s = await t.account.signIn();
  assert.equal(s.phase, 'signed-out'); assert.match(s.error, /timed out/);
  await assert.rejects(fetch(redirect));
});
test('sign-out during code exchange cannot restore the account', async () => {
  let unblock, started;
  const wait = new Promise((r) => { started = r; });
  const t = setup({ open: (a) => callback(a), exchange: () => new Promise((r) => { unblock = r; started(); }) });
  await t.account.configure(config); const attempt = t.account.signIn(); await wait;
  await t.account.signOut(); unblock(); await attempt;
  assert.equal(t.account.view().account, null); assert.equal(t.saved().tokens, null);
});
test('token-exchange errors are sanitized', async () => {
  const t = setup({ open: (a) => callback(a), exchange: async () => { throw new Error('secret-token-and-request-body'); } });
  await t.account.configure(config); const s = await t.account.signIn();
  assert(!JSON.stringify(s).includes('secret-token')); assert.equal(s.phase, 'signed-out');
});
test('encrypted storage fails closed and serializes sign-out writes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'denadesk-account-test-'));
  const file = path.join(dir, 'account.bin');
  const unavailable = encryptedStore(file, { isAsyncEncryptionAvailable: async () => false });
  await assert.rejects(unavailable.write({ refresh_token: 'secret' }));
  await assert.rejects(fs.readFile(file));
  const safe = { isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s) => Buffer.from('test-encrypted:' + Buffer.from(s).toString('base64')),
    decryptStringAsync: async (b) => ({ result: Buffer.from(b.toString().slice(15), 'base64').toString(), shouldReEncrypt: false }) };
  const store = encryptedStore(file, safe);
  await Promise.all([store.write({ token: 'test-secret' }), store.write({ token: null })]);
  assert.deepEqual(await store.read(), { token: null });
  assert(!(await fs.readFile(file, 'utf8')).includes('test-secret'));
  await fs.unlink(file); await fs.rmdir(dir);
});
