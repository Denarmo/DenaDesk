'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
test('Google account flow offers sign-in then only sign-out and never asks for JSON or a link action', async () => {
  const buttons = [], listeners = {};
  const signedOut = { configured: true, phase: 'signed-out', account: null };
  const api = { googleAccountGet: async () => signedOut,
    remoteLinkGet: async () => ({ status: 'off', fingerprint: 'test-fingerprint', devices: [] }),
    onGoogleAccount: (fn) => { listeners.account = fn; }, onRemoteLink: (fn) => { listeners.remote = fn; } };
  const UI = { api, button: (label, action) => { const b = { label, action, hidden: false }; buttons.push(b); return b; },
    el: () => ({ replaceChildren() {} }), row: () => ({ setHint() {} }), card: () => ({}) };
  const context = { UI, window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ui-google-account.js'), 'utf8'), context);
  context.window.GoogleAccountUI.card(); await new Promise((r) => setImmediate(r));
  const accountButtons = () => buttons.filter((b) => /sign.in|sign.out/i.test(b.label) && !b.hidden).map((b) => b.label);
  assert.deepEqual(accountButtons(), ['Sign in with Google']);
  assert(!buttons.some((b) => /import|link this PC/i.test(b.label)));
  listeners.account({ configured: true, phase: 'signing-in', account: null });
  assert.deepEqual(accountButtons(), ['Cancel sign-in']);
  listeners.account({ configured: true, phase: 'signed-in', account: { email: 'owner@example.com' } });
  assert.deepEqual(accountButtons(), ['Sign out on this PC']);
  listeners.account(signedOut); assert.deepEqual(accountButtons(), ['Sign in with Google']);
});
