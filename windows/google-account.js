// DenaDesk — GPL-3.0. Main-process Google identity; never grants remote-device access.
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { EventEmitter } = require('events');

function desktopConfig(json) {
  const c = json && json.installed;
  if (!c || typeof c.client_id !== 'string' || !/^[a-zA-Z0-9_-]{8,200}\.apps\.googleusercontent\.com$/.test(c.client_id)
      || typeof c.client_secret !== 'string' || !c.client_secret || c.client_secret.length > 500) {
    throw new Error('Choose the Desktop app JSON downloaded from Google Auth Platform.');
  }
  // Ignore endpoints and redirect URIs in imported files. Only Google's built-in endpoints are used.
  return { clientId: c.client_id, clientSecret: c.client_secret, projectId: String(c.project_id || '').slice(0, 120) };
}

function encryptedStore(file, safeStorage) {
  let queue = Promise.resolve();
  const available = async () => {
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows encrypted storage is unavailable.');
  };
  return {
    async read() {
      await available();
      let bytes;
      try { bytes = await fs.readFile(file); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
      if (bytes.length > 100000) throw new Error('Stored Google account data is invalid.');
      const decrypted = await safeStorage.decryptStringAsync(bytes);
      if (!decrypted || typeof decrypted.result !== 'string') throw new Error('Stored Google account data is invalid.');
      const value = JSON.parse(decrypted.result);
      if (decrypted.shouldReEncrypt) await this.write(value);
      return value;
    },
    write(value) {
      // Serialize writes so signing out cannot be overwritten by an earlier sign-in save.
      queue = queue.catch(() => {}).then(async () => {
        await available();
        const bytes = await safeStorage.encryptStringAsync(JSON.stringify(value));
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file + '.tmp', bytes, { mode: 0o600 });
        await fs.rename(file + '.tmp', file);
      });
      return queue;
    },
  };
}

class GoogleAccount extends EventEmitter {
  constructor({ store, openExternal, clientFactory, timeoutMs = 300000 }) {
    super();
    this.store = store;
    this.openExternal = openExternal;
    this.clientFactory = clientFactory || ((config) => {
      const { OAuth2Client } = require('google-auth-library');
      return new OAuth2Client({ ...config, transporterOptions: { timeout: 15000, retry: false } });
    });
    this.timeoutMs = timeoutMs;
    this.config = null; this.account = null; this.tokens = null; this.attempt = null; this.error = '';
  }
  async load() {
    try {
      const saved = await this.store.read();
      if (saved.config) this.config = desktopConfig({ installed: { client_id: saved.config.clientId,
        client_secret: saved.config.clientSecret, project_id: saved.config.projectId } });
      if (this.config && saved.account && typeof saved.account.sub === 'string' && saved.tokens && saved.tokens.id_token) {
        this.account = saved.account; this.tokens = saved.tokens;
      }
    } catch { this.error = 'Google account data could not be opened. Import the Desktop app JSON again.'; }
    return this.view();
  }
  view() {
    return { configured: !!this.config, projectId: this.config ? this.config.projectId : '',
      phase: this.attempt ? 'signing-in' : this.account ? 'signed-in' : 'signed-out',
      account: this.account ? { email: this.account.email, verifiedAt: this.account.verifiedAt } : null,
      error: this.error, remoteReady: false };
  }
  changed() { this.emit('change', this.view()); }
  save() { return this.store.write({ config: this.config, account: this.account, tokens: this.tokens }); }
  async configure(json) {
    const config = desktopConfig(json);
    this.cancel(); this.config = config; this.account = null; this.tokens = null; this.error = '';
    await this.save(); this.changed(); return this.view();
  }
  cancel() {
    if (this.attempt) { const a = this.attempt; this.attempt = null; a.cancel(); }
    this.changed();
  }
  async signOut() {
    this.cancel(); this.account = null; this.tokens = null; this.error = '';
    await this.save(); this.changed(); return this.view();
  }
  // Main process only. Never expose an ID/access/refresh token through renderer IPC.
  async getIdToken() {
    if (this.refreshing) return this.refreshing;
    const config = this.config, account = this.account, original = this.tokens;
    if (!config || !account || !original) throw new Error('Sign in with Google first.');
    this.refreshing = (async () => {
      const client = this.clientFactory(config);
      let tokens = original, exp = 0;
      try { exp = JSON.parse(Buffer.from(original.id_token.split('.')[1], 'base64url')).exp * 1000; } catch { /* Refresh or fail closed below. */ }
      if (!Number.isFinite(exp) || exp < Date.now() + 90000) {
        if (!original.refresh_token) throw new Error('Sign in with Google again.');
        client.setCredentials(original);
        const result = await client.refreshAccessToken();
        if (!result.credentials.id_token) throw new Error('Sign in with Google again.');
        tokens = { ...original, ...result.credentials, refresh_token: result.credentials.refresh_token || original.refresh_token };
      }
      const p = (await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId })).getPayload();
      if (!p || p.sub !== account.sub || p.email_verified !== true || p.exp * 1000 <= Date.now()
          || this.config !== config || this.account !== account || this.tokens !== original) throw new Error('Sign in with Google again.');
      if (tokens !== original) { this.tokens = tokens; await this.save(); }
      return tokens.id_token;
    })();
    try { return await this.refreshing; } catch { throw new Error('Google session expired. Sign in again.'); }
    finally { this.refreshing = null; }
  }
  async signIn() {
    if (!this.config) throw new Error('Import your Google Desktop app JSON first.');
    if (this.attempt) throw new Error('A Google sign-in is already open.');
    const state = crypto.randomBytes(32).toString('base64url'), nonce = crypto.randomBytes(32).toString('base64url');
    const server = http.createServer();
    const a = { cancel: () => {} };
    this.attempt = a; this.error = ''; this.changed();
    let timer, rejectCode;
    const code = new Promise((resolve, reject) => {
      rejectCode = reject;
      a.cancel = () => reject(new Error('Sign-in cancelled.'));
      server.on('request', (req, res) => {
        const answer = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' }); res.end(text); };
        const host = '127.0.0.1:' + server.address()?.port;
        if (req.method !== 'GET' || req.headers.host !== host || (req.url || '').length > 10000) return answer(400, 'Invalid callback.');
        const u = new URL(req.url, 'http://' + host);
        if (u.pathname !== '/oauth2/callback') return answer(404, 'Not found.');
        const received = u.searchParams.get('state') || '';
        if (u.searchParams.getAll('state').length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(received) || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(state))) return answer(400, 'Invalid sign-in state. Return to DenaDesk.');
        if (this.attempt !== a || a.used) return answer(410, 'This sign-in has ended.');
        if (u.searchParams.has('error')) { answer(400, 'Google sign-in was not completed. Return to DenaDesk.'); reject(new Error('Google sign-in was declined.')); }
        else if (u.searchParams.getAll('code').length === 1 && u.searchParams.get('code')) {
          a.used = true;
          answer(200, 'Completing Google sign-in. You can close this tab and return to DenaDesk.'); resolve(u.searchParams.get('code'));
        } else return answer(400, 'Missing authorization code.');
        server.close();
      });
      server.on('error', () => reject(new Error('The local Google sign-in callback could not start.')));
      timer = setTimeout(() => reject(new Error('Google sign-in timed out. Try again.')), this.timeoutMs);
    });
    // Attach a rejection handler before starting asynchronous setup.
    code.catch(() => {});
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      if (this.attempt !== a) throw new Error('Sign-in cancelled.');
      const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2/callback`;
      const client = this.clientFactory({ ...this.config, redirectUri });
      const pkce = await client.generateCodeVerifierAsync();
      if (this.attempt !== a) throw new Error('Sign-in cancelled.');
      await this.openExternal(client.generateAuthUrl({ access_type: 'offline', scope: ['openid', 'email'],
        prompt: 'select_account', state, nonce, code_challenge: pkce.codeChallenge, code_challenge_method: 'S256' }));
      const authCode = await code;
      const { tokens } = await client.getToken({ code: authCode, codeVerifier: pkce.codeVerifier });
      if (!tokens.id_token) throw new Error('Google did not return an identity token.');
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.clientId });
      const payload = ticket.getPayload();
      if (!payload || payload.nonce !== nonce || !payload.sub || payload.email_verified !== true || !payload.email) throw new Error('Google identity verification failed.');
      if (this.attempt !== a) throw new Error('Sign-in cancelled.');
      const prior = this.account && this.account.sub === payload.sub ? this.tokens : null;
      this.tokens = { id_token: tokens.id_token, access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || (prior && prior.refresh_token) || undefined, expiry_date: tokens.expiry_date };
      this.account = { sub: payload.sub, email: payload.email, verifiedAt: Date.now() };
      await this.save();
    } catch (e) {
      if (this.attempt === a) {
        // Gaxios errors can contain request bodies, codes and tokens. Never expose them to logs/UI.
        this.error = ['Sign-in cancelled.', 'Google sign-in was declined.', 'Google identity verification failed.',
          'Google sign-in timed out. Try again.', 'Google did not return an identity token.'].includes(e.message)
          ? e.message : 'Google sign-in failed. Check the OAuth client and Google test-user settings, then try again.';
      }
    } finally {
      rejectCode(new Error('Sign-in ended.')); clearTimeout(timer); server.close(); server.closeAllConnections();
      if (this.attempt === a) this.attempt = null;
      this.changed();
    }
    return this.view();
  }
}
module.exports = { GoogleAccount, desktopConfig, encryptedStore };
