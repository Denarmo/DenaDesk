// DenaDesk — GPL-3.0. Shared by the broker, Electron main and WebRTC window.
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.DenaDirectPolicy = value;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const config = () => ({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], iceTransportPolicy: 'all', iceCandidatePoolSize: 0 });
  function candidate(value) {
    const text = typeof value === 'string' ? value : value && value.candidate;
    if (typeof text !== 'string' || text.length > 2048 || /[\r\n]/.test(text)) return false;
    if (text === '') return true;
    // Recognized non-relay ICE types only. Reject malformed/unknown types and extra typ fields.
    const fields = text.trim().split(/\s+/);
    return /^candidate:[A-Za-z0-9+/]+$/.test(fields[0]) && fields[6] === 'typ'
      && ['host', 'srflx', 'prflx'].includes(fields[7]) && fields.filter((x) => x === 'typ').length === 1;
  }
  function sdp(text) {
    if (typeof text !== 'string' || text.length > 100000 || !text.startsWith('v=0\r\n')) return false;
    const lines = text.split(/\r?\n/);
    return !lines.some((l) => /^a=candidate:/i.test(l) && !candidate(l.slice(2)))
      && lines.some((l) => /^a=fingerprint:sha-256 (?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(l));
  }
  function selectedPair(stats) {
    let pair;
    stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
    if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) pair = r; });
    if (!pair) return false;
    const local = stats.get(pair.localCandidateId), remote = stats.get(pair.remoteCandidateId);
    return !!local && !!remote && [local, remote].every((r) => ['host', 'srflx', 'prflx'].includes(r.candidateType));
  }
  return { config, candidate, sdp, selectedPair };
});
