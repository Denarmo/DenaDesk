'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const audience = 'test-client.apps.googleusercontent.com';
test('cloud identity fails closed, limits accounts and never enables remote control', async () => {
  assert.throws(() => createServer({ audience, allowedSubjects: [] }));
  let verified = 0, fail = false;
  const payload = { aud: audience, iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 300, email_verified: true, sub: '123456789', email: 'owner@example.com' };
  const server = createServer({ audience, allowedSubjects: ['123456789'], verify: async () => { verified++; if (fail) throw new Error('private-token'); return { ...payload }; } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const post = (options = {}) => fetch(url + '/v1/identity', { method: 'POST', headers: { Authorization: 'Bearer aaa.bbb.ccc' }, ...options });
    assert.equal((await (await fetch(url + '/healthz')).json()).remoteReady, false);
    assert.equal((await post({ headers: {} })).status, 401); assert.equal(verified, 0);
    assert.equal((await post({ body: 'token-in-body' })).status, 400);
    let r = await post(); assert.equal(r.status, 200); assert.equal((await r.json()).remoteReady, false);
    payload.sub = '987654321'; assert.equal((await post()).status, 403); payload.sub = '123456789';
    payload.aud = 'wrong'; assert.equal((await post()).status, 403); payload.aud = audience;
    payload.exp = 1; assert.equal((await post()).status, 403); payload.exp = Date.now() / 1000 + 300;
    payload.email_verified = false; assert.equal((await post()).status, 403); payload.email_verified = true;
    fail = true; r = await post(); assert.equal(r.status, 401); assert(!(await r.text()).includes('private-token'));
    assert.equal((await fetch(url + '/v1/devices')).status, 404);
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
});
