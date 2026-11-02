'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../shared/remote-protocol');
const D = require('../../shared/direct-policy');
const sdp = 'v=0\r\na=fingerprint:sha-256 ' + Array(32).fill('AB').join(':') + '\r\n';
test('direct policy rejects relay candidates, malformed SDP and non-direct selected pairs', () => {
  const host = 'candidate:1234 1 udp 2122260223 192.0.2.1 49999 typ host generation 0';
  const relay = host.replace('typ host', 'typ relay');
  assert(D.candidate(host)); assert(!D.candidate(relay)); assert(!D.candidate(host + ' typ relay'));
  assert(!D.candidate(host + '\r\na=anything')); assert(!D.candidate({ candidate: 5 }));
  assert(D.sdp(sdp)); assert(!D.sdp(sdp + 'a=' + relay + '\r\n')); assert(!D.sdp('v=0\r\n'));
  assert(!JSON.stringify(D.config()).includes('turn:'));
  const stats = new Map([['transport', { type: 'transport', selectedCandidatePairId: 'pair' }], ['pair', { localCandidateId: 'a', remoteCandidateId: 'b' }], ['a', { candidateType: 'srflx' }], ['b', { candidateType: 'host' }]]);
  assert(D.selectedPair(stats)); stats.get('b').candidateType = 'relay'; assert(!D.selectedPair(stats)); stats.delete('b'); assert(!D.selectedPair(stats));
});
test('peer signatures bind the session, capabilities, expiry, sequence and SDP', () => {
  const a = P.generate(), b = P.generate();
  const value = { v: 1, sid: 'a'.repeat(32), from: a.id, to: b.id, kind: 'offer', payload: { sdp }, seq: 2, expires: Date.now() + 30000 };
  const signature = P.sign(value, a.privateKey);
  assert(P.envelope(value)); assert(P.verify(value, signature, a.publicKey));
  assert(!P.verify({ ...value, to: a.id }, signature, a.publicKey)); assert(!P.verify(value, signature, b.publicKey));
  assert(!P.envelope({ ...value, expires: Date.now() - 1 })); assert(!P.envelope({ ...value, seq: -1 }));
  assert(!P.envelope({ ...value, extra: true })); assert(!P.envelope({ ...value, kind: 'clipboard', payload: {} }));
});
module.exports = { sdp };
