// DenaDesk — GPL-3.0. Signed, bounded connection metadata; never session content.
'use strict';
const crypto = require('crypto');
const direct = require('./direct-policy');
const idOK = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
function publicKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{50,100}={0,2}$/.test(value)) throw new Error('Invalid device key');
  const key = crypto.createPublicKey({ key: Buffer.from(value, 'base64'), type: 'spki', format: 'der' });
  if (key.asymmetricKeyType !== 'ed25519' || key.export({ type: 'spki', format: 'der' }).toString('base64') !== value) throw new Error('Invalid device key');
  return key;
}
function deviceId(key) { publicKey(key); return crypto.createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex'); }
function generate() {
  const pair = crypto.generateKeyPairSync('ed25519');
  const pub = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return { id: deviceId(pub), publicKey: pub, privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function sign(value, key) { return crypto.sign(null, Buffer.from(canonical(value)), key).toString('base64'); }
function verify(value, signature, key) {
  try { return typeof signature === 'string' && signature.length === 88 && crypto.verify(null, Buffer.from(canonical(value)), publicKey(key), Buffer.from(signature, 'base64')); } catch { return false; }
}
function envelope(value, now = Date.now()) {
  if (!value || Object.keys(value).sort().join(',') !== 'expires,from,kind,payload,seq,sid,to,v' || value.v !== 1
      || !idOK(value.from) || !idOK(value.to) || value.from === value.to
      || typeof value.sid !== 'string' || !/^[a-f0-9]{32}$/.test(value.sid)
      || !Number.isSafeInteger(value.seq) || value.seq < 0 || value.seq > 2048
      || !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + 120000
      || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) return false;
  const p = value.payload, keys = Object.keys(p).sort().join(',');
  if (value.kind === 'request' || value.kind === 'accept') return keys === 'mode' && ['view', 'control'].includes(p.mode);
  if (value.kind === 'end') return keys === '';
  if (value.kind === 'offer' || value.kind === 'answer') return keys === 'sdp' && direct.sdp(p.sdp);
  if (value.kind === 'ice') return keys === 'candidate,sdpMLineIndex,sdpMid' && direct.candidate(p.candidate)
    && (p.sdpMid === null || typeof p.sdpMid === 'string' && p.sdpMid.length < 64)
    && (p.sdpMLineIndex === null || Number.isInteger(p.sdpMLineIndex) && p.sdpMLineIndex >= 0 && p.sdpMLineIndex < 16);
  return false;
}
module.exports = { idOK, publicKey, deviceId, generate, canonical, sign, verify, envelope };
