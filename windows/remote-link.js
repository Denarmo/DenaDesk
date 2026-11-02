// DenaDesk — GPL-3.0. Main-process device linking and signed direct-session setup.
'use strict';
const { EventEmitter } = require('events');
const crypto = require('crypto');
const WebSocket = require('ws');
const P = require('../shared/remote-protocol');
const fingerprint = (id) => id.match(/.{1,8}/g).join(' ');
class RemoteLink extends EventEmitter {
  constructor({ account, store, name, approve, startSession, endpoint = 'wss://denadesk-broker.onrender.com/v1/link', WebSocketClass = WebSocket }) {
    super(); Object.assign(this, { account, store, name, approve, startSession, endpoint, WebSocketClass });
    if (endpoint !== 'wss://denadesk-broker.onrender.com/v1/link' && !/^ws:\/\/127\.0\.0\.1:\d+\/v1\/link$/.test(endpoint)) throw new Error('Invalid connection service');
    this.identity = null; this.pins = {}; this.enabledFor = null; this.devices = []; this.status = 'off'; this.error = ''; this.generation = 0;
    this.used = new Map();
    this.account.on('change', () => {
      if (!this.account.account || this.enabledFor && this.account.account.sub !== this.enabledFor) this.disable().catch(() => {});
    });
  }
  async load() {
    const saved = await this.store.read();
    this.identity = saved.identity || P.generate();
    if (P.deviceId(this.identity.publicKey) !== this.identity.id || !P.verify({ check: true }, P.sign({ check: true }, this.identity.privateKey), this.identity.publicKey)) throw new Error('Device key is invalid');
    this.pins = saved.pins && typeof saved.pins === 'object' ? saved.pins : {};
    this.enabledFor = saved.enabledFor || null;
    await this.save();
    if (this.enabledFor && this.account.account?.sub === this.enabledFor) this.connect();
    else { this.enabledFor = null; await this.save(); }
    return this.view();
  }
  save() { return this.store.write({ identity: this.identity, pins: this.pins, enabledFor: this.enabledFor }); }
  view() {
    return { enabled: !!this.enabledFor, status: this.status, error: this.error, fingerprint: this.identity ? fingerprint(this.identity.id) : '',
      devices: this.devices.filter((d) => d.id !== this.identity?.id).map((d) => ({ id: d.id, name: d.name, online: d.online, fingerprint: fingerprint(d.id), trusted: this.isTrusted(d) })),
      session: this.session ? { name: this.session.peer.name, role: this.session.role, mode: this.session.mode, status: this.session.status } : null };
  }
  changed() { this.emit('change', this.view()); }
  isTrusted(peer) { return this.pins[this.enabledFor + ':' + peer.id] === peer.publicKey; }
  async trust(peer) {
    if (this.isTrusted(peer)) return true;
    const sub = this.enabledFor, generation = this.generation;
    if (!await this.approve({ type: 'trust', name: peer.name, fingerprint: fingerprint(peer.id) })) return false;
    if (!sub || this.enabledFor !== sub || generation !== this.generation) return false;
    this.pins[sub + ':' + peer.id] = peer.publicKey; await this.save(); this.changed(); return true;
  }
  async enable() {
    if (!this.identity || !this.account.account) {
      this.error = !this.identity ? 'Secure device keys are unavailable. Restart DenaDesk and try again.'
        : !this.account.config ? 'Import your Google Desktop app JSON, then sign in before linking this PC.'
        : 'Sign in with Google before linking this PC.';
      this.changed(); return this.view();
    }
    this.error = '';
    this.enabledFor = this.account.account.sub; await this.save(); this.connect(); return this.view();
  }
  async disable(unlink = false) {
    this.enabledFor = null; this.generation++; clearTimeout(this.retry); clearTimeout(this.renew);
    this.end(); if (this.socket) { if (unlink && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'remove', id: this.identity.id })); this.socket.close(); this.socket = null; }
    this.status = 'off'; this.devices = []; if (this.identity) await this.save(); this.changed(); return this.view();
  }
  async connect() {
    if (!this.enabledFor || this.socket || this.connecting) return;
    const generation = this.generation; this.connecting = true; this.status = 'connecting'; this.error = ''; this.changed();
    try {
      const token = await this.account.getIdToken();
      if (!this.enabledFor || generation !== this.generation) return;
      const ws = new this.WebSocketClass(this.endpoint, { handshakeTimeout: 15000, perMessageDeflate: false, maxPayload: 120000 });
      this.socket = ws; let queued = 0, chain = Promise.resolve();
      const authTimer = setTimeout(() => { if (this.socket === ws && this.status !== 'online') ws.terminate(); }, 35000); authTimer.unref?.();
      ws.on('error', () => { if (this.socket === ws) { this.error = 'The connection service is unavailable. Retrying shortly.'; this.changed(); } });
      ws.on('message', (data, binary) => {
        if (this.socket !== ws) return;
        if (binary || ++queued > 64) return ws.close(1008, 'Invalid setup stream');
        chain = chain.then(async () => {
          if (this.socket !== ws) return;
          const m = JSON.parse(data.toString());
          if (m.type === 'challenge') {
            if (ws.authSent || !/^[A-Za-z0-9_-]{43}$/.test(m.nonce)) throw new Error('Invalid authentication challenge');
            ws.authSent = true;
            const value = { nonce: m.nonce, publicKey: this.identity.publicKey, name: this.name };
            ws.send(JSON.stringify({ type: 'auth', ...value, token, signature: P.sign(value, this.identity.privateKey) }));
          } else if (m.type === 'ready') {
            if (m.id !== this.identity.id || !Number.isFinite(m.expires) || m.expires <= Date.now()) throw new Error('Invalid device registration');
            clearTimeout(authTimer); this.status = 'online'; this.error = ''; this.changed();
            clearTimeout(this.renew);
            this.renew = setTimeout(() => { if (this.socket === ws) ws.close(1000, 'Renew identity'); }, Math.max(1000, Math.min(3500000, m.expires - Date.now() - 60000))); this.renew.unref?.();
          } else if (m.type === 'devices') {
            if (!Array.isArray(m.devices) || m.devices.length > 20) throw new Error('Invalid device list');
            this.devices = m.devices.map((d) => {
              if (P.deviceId(d.publicKey) !== d.id || typeof d.name !== 'string' || d.name.length > 80 || /[\x00-\x1f\x7f]/.test(d.name)) throw new Error('Invalid device');
              return { id: d.id, publicKey: d.publicKey, name: d.name, online: d.online === true };
            }); this.changed();
          } else if (m.type === 'signal') await this.signalIn(m);
          else if (['closed', 'unavailable'].includes(m.type) && this.session?.sid === m.sid) this.end(false, m.type === 'unavailable' ? 'That device is unavailable or busy.' : 'The remote session ended.');
        }).catch(() => { this.error = 'Connection setup was rejected.'; this.end(); ws.close(1008, 'Invalid setup'); }).finally(() => { queued--; });
      });
      ws.on('close', () => {
        clearTimeout(authTimer);
        if (this.socket !== ws) return;
        this.socket = null; clearTimeout(this.renew); this.end(false); this.devices = [];
        this.status = this.enabledFor ? 'reconnecting' : 'off'; this.changed();
        if (this.enabledFor) { this.retry = setTimeout(() => this.connect(), 10000); this.retry.unref?.(); }
      });
    } catch {
      this.error = 'Google session or connection service is unavailable. Sign in again if this continues.'; this.status = 'offline'; this.changed();
      if (this.enabledFor && generation === this.generation) { this.retry = setTimeout(() => this.connect(), 30000); this.retry.unref?.(); }
    } finally { this.connecting = false; }
  }
  async request(id, mode) {
    if (!P.idOK(id) || !['view', 'control'].includes(mode) || this.status !== 'online' || this.session || this.requesting) throw new Error('Device is unavailable.');
    const peer = this.devices.find((d) => d.id === id && d.online);
    if (!peer) throw new Error('Device is offline.');
    this.requesting = true;
    try {
      if (!await this.trust(peer) || this.session || this.status !== 'online') return this.view();
      this.session = { sid: crypto.randomBytes(16).toString('hex'), peer, role: 'guest', mode, sendSeq: 0, receiveSeq: -1, status: 'waiting for host approval' };
      this.session.timeout = setTimeout(() => this.end(true, 'The host did not approve in time.'), 90000);
      this.send('request', { mode }); this.changed(); return this.view();
    } finally { this.requesting = false; }
  }
  send(kind, payload) {
    const s = this.session;
    if (!s || this.socket?.readyState !== WebSocket.OPEN) return;
    const value = { v: 1, sid: s.sid, from: this.identity.id, to: s.peer.id, seq: s.sendSeq++, expires: Date.now() + 120000, kind, payload };
    if (!P.envelope(value)) { this.end(false, 'Direct connection setup was rejected.'); return; }
    if (this.socket.bufferedAmount > 256000) return this.socket.terminate();
    this.socket.send(JSON.stringify({ type: 'signal', value, signature: P.sign(value, this.identity.privateKey) }));
  }
  async signalIn(m) {
    const v = m.value;
    if (!P.envelope(v) || v.to !== this.identity.id || !m.peer || P.deviceId(m.peer.publicKey) !== v.from || !P.verify(v, m.signature, m.peer.publicKey)) throw new Error('Invalid peer signature');
    if (v.kind === 'request') {
      for (const [sid, expiry] of this.used) if (expiry <= Date.now()) this.used.delete(sid);
      if (this.session || this.requesting || v.seq !== 0 || this.used.has(v.sid) || this.used.size >= 1024) return;
      this.used.set(v.sid, Date.now() + 240000);
      const peer = this.devices.find((d) => d.id === v.from && d.publicKey === m.peer.publicKey && d.online);
      if (!peer) throw new Error('Unknown peer');
      const s = this.session = { sid: v.sid, peer, role: 'host', mode: v.payload.mode, sendSeq: 0, receiveSeq: 0, status: 'awaiting your approval' };
      s.timeout = setTimeout(() => this.end(true, 'Approval timed out.'), 90000); this.changed();
      const trusted = await this.trust(peer);
      if (this.session !== s) return;
      const approved = trusted && await this.approve({ type: 'session', name: peer.name, mode: s.mode });
      if (this.session !== s) return;
      if (!approved) return this.end();
      this.send('accept', { mode: s.mode }); this.start(s); return;
    }
    const s = this.session;
    if (!s || v.sid !== s.sid || v.from !== s.peer.id || m.peer.publicKey !== s.peer.publicKey || v.seq <= s.receiveSeq) throw new Error('Unexpected session message');
    s.receiveSeq = v.seq;
    if (v.kind === 'end') return this.end(false);
    if (v.kind === 'accept') {
      if (s.role !== 'guest' || s.worker || v.payload.mode === 'control' && s.mode !== 'control') throw new Error('Invalid session approval');
      s.mode = v.payload.mode; this.start(s); return;
    }
    if (!s.worker || !this.isTrusted(s.peer) || v.kind === 'offer' && s.role !== 'guest' || v.kind === 'answer' && s.role !== 'host') throw new Error('Unapproved negotiation');
    s.worker.signal(v.kind, v.payload);
  }
  start(s) {
    clearTimeout(s.timeout); s.status = 'connecting directly';
    s.timeout = setTimeout(() => this.end(true, 'No direct connection was possible. Check the devices’ networks; relay fallback is disabled.'), 45000);
    s.worker = this.startSession({ role: s.role, mode: s.mode, name: s.peer.name,
      send: (kind, payload) => { if (this.session === s) this.send(kind, payload); },
      state: (status) => { if (this.session !== s) return; if (status === 'live') { clearTimeout(s.timeout); s.timeout = setTimeout(() => this.end(true, 'Session time limit reached.'), 3500000); s.status = 'live'; this.changed(); }
        else if (status === 'failed') this.end(true, 'The direct connection failed. Relay fallback is disabled.'); },
      close: () => { if (this.session === s) this.end(); } }); this.changed();
  }
  end(tell = true, error = '') {
    const s = this.session;
    if (s) { if (tell) this.send('end', {}); this.session = null; clearTimeout(s.timeout); s.worker?.stop(); }
    if (error) this.error = error; this.changed();
  }
  async forget(id) {
    if (!P.idOK(id)) throw new Error('Invalid device');
    if (this.session?.peer.id === id) this.end();
    delete this.pins[this.enabledFor + ':' + id]; await this.save(); this.changed(); return this.view();
  }
}
module.exports = { RemoteLink, fingerprint };
