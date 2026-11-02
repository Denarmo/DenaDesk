// DenaDesk — GPL-3.0. Only authenticated, signed setup messages pass through here.
'use strict';
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const P = require('../shared/remote-protocol');
const { Registry } = require('./registry');
function attachSignaling(server, { authenticate, registry = new Registry(), now = Date.now }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 120000, perMessageDeflate: false });
  const online = new Map(), sessions = new Map(), used = new Map();
  let activeAuth = 0, authCount = 0, authUntil = 0;
  const key = (sub, id) => sub + ':' + id;
  const send = (ws, value) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 256000) return ws.terminate();
    ws.send(JSON.stringify(value));
  };
  function broadcast(sub) {
    const devices = registry.list(sub).map((d) => ({ ...d, online: online.has(key(sub, d.id)) }));
    for (const c of online.values()) if (c.sub === sub) send(c.ws, { type: 'devices', devices });
  }
  function end(sid) {
    const s = sessions.get(sid); if (!s) return;
    sessions.delete(sid);
    for (const id of [s.host, s.guest]) send(online.get(key(s.sub, id))?.ws || { readyState: -1 }, { type: 'closed', sid });
  }
  server.on('upgrade', (req, socket, head) => {
    // No cookies, URL credentials, browser origins or arbitrary WebSocket paths.
    if (req.url !== '/v1/link' || req.headers.origin || wss.clients.size >= 40) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    const nonce = crypto.randomBytes(32).toString('base64url');
    const c = { ws, alive: true, bucket: 0, until: 0, auth: false };
    const authTimer = setTimeout(() => ws.terminate(), 30000); authTimer.unref();
    let busy = false;
    send(ws, { type: 'challenge', nonce });
    ws.on('pong', () => { c.alive = true; });
    ws.on('error', () => {});
    ws.on('message', async (bytes, binary) => {
      try {
        if (binary) return ws.close(1008, 'Metadata only');
        if (now() >= c.until) { c.until = now() + 10000; c.bucket = 0; }
        if (++c.bucket > 120) return ws.close(1008, 'Rate limit');
        const m = JSON.parse(bytes.toString());
        if (!c.auth) {
          if (busy || m.type !== 'auth' || typeof m.token !== 'string' || m.token.length > 16000
              || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 80 || /[\x00-\x1f\x7f]/.test(m.name)
              || !P.verify({ nonce, publicKey: m.publicKey, name: m.name }, m.signature, m.publicKey)) return ws.close(1008, 'Authentication required');
          if (now() >= authUntil) { authUntil = now() + 60000; authCount = 0; }
          if (++authCount > 60 || activeAuth >= 4) return ws.close(1013, 'Try later');
          busy = true; activeAuth++;
          let p;
          try { p = await authenticate(m.token); } finally { activeAuth--; }
          if (ws.readyState !== WebSocket.OPEN) return;
          c.sub = p.sub; c.id = P.deviceId(m.publicKey); c.expires = Math.min(p.exp * 1000, now() + 3600000);
          await registry.put(c.sub, { id: c.id, publicKey: m.publicKey, name: m.name.trim(), lastSeen: now() });
          if (ws.readyState !== WebSocket.OPEN) return;
          const previous = online.get(key(c.sub, c.id));
          if (previous) { for (const [sid, s] of sessions) if (s.sub === c.sub && [s.host, s.guest].includes(c.id)) end(sid); previous.ws.terminate(); }
          c.auth = true; clearTimeout(authTimer); online.set(key(c.sub, c.id), c);
          send(ws, { type: 'ready', id: c.id, expires: c.expires }); broadcast(c.sub); return;
        }
        if (c.expires <= now()) return ws.close(1008, 'Sign in again');
        if (m.type === 'remove' && P.idOK(m.id)) {
          if (m.id !== c.id) return ws.close(1008, 'Only this device can unlink itself');
          for (const [sid, s] of sessions) if (s.sub === c.sub && [s.host, s.guest].includes(c.id)) end(sid);
          await registry.remove(c.sub, c.id); broadcast(c.sub); ws.close(1000, 'Unlinked'); return;
        }
        if (m.type !== 'signal' || !P.envelope(m.value, now()) || m.value.from !== c.id) return ws.close(1008, 'Invalid setup message');
        const v = m.value, self = registry.get(c.sub, c.id), peer = registry.get(c.sub, v.to);
        if (!self || !peer || !P.verify(v, m.signature, self.publicKey)) return ws.close(1008, 'Invalid signature');
        if (!online.has(key(c.sub, v.to))) return send(ws, { type: 'unavailable', sid: v.sid });
        let s = sessions.get(v.sid);
        if (v.kind === 'request') {
          if (v.seq !== 0 || s || used.has(v.sid) || sessions.size >= 20 || used.size >= 2048
              || [...sessions.values()].some((x) => x.sub === c.sub && [x.host, x.guest].some((id) => [c.id, v.to].includes(id)))) return send(ws, { type: 'unavailable', sid: v.sid });
          s = { sub: c.sub, guest: c.id, host: v.to, mode: v.payload.mode, accepted: false, deadline: now() + 90000, sequences: new Map([[c.id, 0]]) };
          sessions.set(v.sid, s); used.set(v.sid, now() + 240000);
        } else {
          if (!s || s.sub !== c.sub || ![s.host, s.guest].includes(c.id) || ![s.host, s.guest].includes(v.to)
              || v.seq <= (s.sequences.get(c.id) ?? -1)) return ws.close(1008, 'Invalid session');
          if (v.kind === 'accept') {
            if (c.id !== s.host || s.accepted || v.payload.mode === 'control' && s.mode !== 'control') return ws.close(1008, 'Invalid approval');
            s.accepted = true; s.mode = v.payload.mode; s.deadline = now() + 3600000;
          } else if (v.kind !== 'end' && !s.accepted) return ws.close(1008, 'Approval required');
          if (v.kind === 'offer' && (c.id !== s.host || s.offered) || v.kind === 'answer' && (c.id !== s.guest || !s.offered || s.answered)) return ws.close(1008, 'Invalid negotiation');
          if (v.kind === 'offer') s.offered = true;
          if (v.kind === 'answer') s.answered = true;
          s.sequences.set(c.id, v.seq);
        }
        send(online.get(key(c.sub, v.to)).ws, { type: 'signal', value: v, signature: m.signature, peer: self });
        if (v.kind === 'end') end(v.sid);
      } catch { ws.close(1008, 'Setup failed'); }
    });
    ws.on('close', () => {
      clearTimeout(authTimer);
      if (c.auth && online.get(key(c.sub, c.id)) === c) {
        online.delete(key(c.sub, c.id));
        for (const [sid, s] of sessions) if (s.sub === c.sub && [s.host, s.guest].includes(c.id)) end(sid);
        broadcast(c.sub);
      }
    });
  });
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      const c = [...online.values()].find((x) => x.ws === ws);
      if (!c) continue;
      if (!c.alive || c.expires <= now()) ws.terminate();
      else { c.alive = false; ws.ping(); }
    }
    for (const [sid, s] of sessions) if (s.deadline <= now()) end(sid);
    for (const [sid, expiry] of used) if (expiry <= now()) used.delete(sid);
  }, 10000); timer.unref();
  function close() { clearInterval(timer); for (const ws of wss.clients) ws.terminate(); wss.close(); }
  server.on('close', close);
  return { close, registry };
}
module.exports = { attachSignaling };
