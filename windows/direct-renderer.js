// DenaDesk — GPL-3.0. Direct WebRTC video/input only. No network signaling API here.
'use strict';
const api = window.denaDirect, policy = window.DenaDirectPolicy, T = window.MacShareProtocol.T;
const video = document.getElementById('screen'), status = document.getElementById('status');
let pc, stream, data, role, mode, stopped = false, live = false, checking = false, timer, monitor, commands = Promise.resolve(), pending = [];
const keys = new Set(), buttons = new Set();
function out(kind, payload) { if (!stopped) api.send({ type: 'signal', kind, payload }); }
function fail(error) { if (stopped) return; console.warn('Direct session ended:', error instanceof Error ? error.name + ': ' + error.message : 'connection unavailable'); cleanup(); api.send({ type: 'state', status: 'failed' }); }
function cleanup() {
  if (stopped) return; release(); stopped = true; live = false; clearTimeout(timer); clearInterval(monitor);
  if (stream) stream.getTracks().forEach((t) => t.stop()); if (pc) pc.close(); video.srcObject = null;
}
function input(value) {
  if (live && mode === 'control' && role === 'guest' && data?.readyState === 'open') {
    if (data.bufferedAmount >= 32000) return fail();
    data.send(JSON.stringify(value));
  }
}
function release() { if (data?.readyState === 'open' && role === 'guest' && mode === 'control') data.send(JSON.stringify({ release: true })); keys.clear(); buttons.clear(); }
async function checkPair() {
  if (stopped || checking || !pc || pc.connectionState !== 'connected') return;
  checking = true;
  try {
    if (!policy.selectedPair(await pc.getStats())) throw new Error('Non-direct candidate pair');
    if (!live) { live = true; clearTimeout(timer); status.textContent = mode === 'control' ? 'Connected directly · control enabled' : 'Connected directly · view only'; api.send({ type: 'state', status: 'live' });
      if (role === 'guest') { video.srcObject = stream || new MediaStream(); await video.play().catch(() => {}); } }
  } catch { fail(); } finally { checking = false; }
}
function channel(dc) {
  if (data || dc.label !== 'denadesk-input' || dc.protocol !== 'denadesk-direct-v1' || !dc.ordered) { dc.close(); return fail(); }
  data = dc;
  dc.onmessage = (e) => {
    if (role !== 'host' || !live || mode !== 'control' || typeof e.data !== 'string' || e.data.length > 512) return;
    try { const value = JSON.parse(e.data); if (value.release === true) api.send({ type: 'release' }); else api.send({ type: 'input', value }); } catch { fail(); }
  };
  dc.onclose = () => { if (!stopped) fail(); };
}
async function start(m) {
  if (pc || stopped) throw new Error('Already started');
  role = m.role; mode = m.mode; document.getElementById('peer').textContent = m.name;
  document.body.classList.toggle('host', role === 'host');
  if (role === 'host') {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: false, video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } } });
    if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
  }
  pc = new RTCPeerConnection(policy.config());
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const c = e.candidate.toJSON(); if (!policy.candidate(c)) return fail();
    out('ice', { candidate: c.candidate, sdpMid: c.sdpMid ?? null, sdpMLineIndex: c.sdpMLineIndex ?? null });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') checkPair();
    else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && !stopped) fail();
  };
  pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'checking') live = false; };
  pc.ontrack = (e) => {
    if (role !== 'guest') { e.track.stop(); return fail(); }
    if (!stream) stream = new MediaStream(); stream.addTrack(e.track);
    // The picture remains detached until getStats confirms a direct selected pair.
    if (live) video.srcObject = stream;
  };
  pc.ondatachannel = (e) => { if (role !== 'guest') return fail(); channel(e.channel); };
  timer = setTimeout(fail, 40000); monitor = setInterval(checkPair, 1000);
  if (role === 'host') {
    for (const track of stream.getTracks()) {
      track.onended = fail; pc.addTrack(track, stream);
    }
  }
  // The host offers the screen; the guest's data channel is negotiated by the host as well.
  if (role === 'host') {
    channel(pc.createDataChannel('denadesk-input', { ordered: true, protocol: 'denadesk-direct-v1' }));
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    for (const sender of pc.getSenders()) if (sender.track?.kind === 'video') {
      const p = sender.getParameters(); if (!p.encodings?.length) p.encodings = [{}];
      Object.assign(p.encodings[0], { maxBitrate: 5000000, maxFramerate: 30 }); p.degradationPreference = 'maintain-framerate'; await sender.setParameters(p);
    }
    if (!policy.sdp(pc.localDescription.sdp)) throw new Error('Invalid direct offer');
    out('offer', { sdp: pc.localDescription.sdp });
  }
}
async function signal(kind, payload) {
  if (!pc || stopped) throw new Error('No approved session');
  if (kind === 'ice') {
    if (!policy.candidate(payload.candidate)) throw new Error('Relay candidate rejected');
    if (pc.remoteDescription) await pc.addIceCandidate(payload); else if (pending.length < 64) pending.push(payload); else throw new Error('Too many candidates');
    return;
  }
  if (!policy.sdp(payload.sdp) || kind === 'offer' && role !== 'guest' || kind === 'answer' && role !== 'host') throw new Error('Invalid negotiation');
  await pc.setRemoteDescription({ type: kind, sdp: payload.sdp });
  for (const c of pending.splice(0)) await pc.addIceCandidate(c);
  if (kind === 'offer') { const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); if (!policy.sdp(pc.localDescription.sdp)) throw new Error('Invalid direct answer'); out('answer', { sdp: pc.localDescription.sdp }); }
}
api.on((m) => { commands = commands.then(() => m.type === 'start' ? start(m) : m.type === 'signal' ? signal(m.kind, m.payload) : undefined).catch(fail); });
document.getElementById('disconnect').onclick = () => { cleanup(); api.send({ type: 'close' }); };
window.addEventListener('beforeunload', cleanup); window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
video.addEventListener('contextmenu', (e) => e.preventDefault());
function point(e) {
  const b = video.getBoundingClientRect(), w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(b.width / w, b.height / h), dx = (b.width - w * scale) / 2, dy = (b.height - h * scale) / 2;
  const x = (e.clientX - b.left - dx) / (w * scale), y = (e.clientY - b.top - dy) / (h * scale);
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
let lastMove = 0;
video.onpointermove = (e) => { if (performance.now() - lastMove < 16) return; const p = point(e); if (p) { lastMove = performance.now(); input({ t: T.IN_MOVE, ...p }); } };
video.onpointerdown = (e) => { const p = point(e); if (!p) return; e.preventDefault(); video.focus(); video.setPointerCapture(e.pointerId); buttons.add(e.button); input({ t: T.IN_DOWN, ...p, b: e.button }); };
video.onpointerup = (e) => { const p = point(e); if (!p) return release(); buttons.delete(e.button); input({ t: T.IN_UP, ...p, b: e.button }); };
video.onpointercancel = release;
video.addEventListener('wheel', (e) => { if (mode !== 'control') return; e.preventDefault(); const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 200 : 1; input({ t: T.IN_WHEEL, dx: Math.max(-1000, Math.min(1000, e.deltaX * k)), dy: Math.max(-1000, Math.min(1000, e.deltaY * k)) }); }, { passive: false });
video.onkeydown = (e) => { if (mode !== 'control' || e.code === 'Escape') { if (e.code === 'Escape') release(); return; } e.preventDefault(); keys.add(e.code); input({ t: T.IN_KEY_DOWN, code: e.code }); };
video.onkeyup = (e) => { if (mode !== 'control') return; e.preventDefault(); keys.delete(e.code); input({ t: T.IN_KEY_UP, code: e.code }); };
api.ready();
