// DenaDesk — GPL-3.0. Milestone 1: owner-only Google identity verification.
// This service exposes no device control, screen capture, relay or registration endpoints yet.
'use strict';
const http = require('http');

function createServer({ audience, allowedSubjects, verify, now = Date.now }) {
  if (!audience || !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(audience)) throw new Error('GOOGLE_CLIENT_ID is required.');
  if (!allowedSubjects || !allowedSubjects.length || allowedSubjects.some((s) => !/^[0-9]{6,100}$/.test(s))) throw new Error('ALLOWED_GOOGLE_SUBS is required.');
  const allowed = new Set(allowedSubjects);
  let active = 0, bucket = 0, until = 0;
  const server = http.createServer({ maxHeaderSize: 18000, requestTimeout: 10000, headersTimeout: 10000 }, async (req, res) => {
    const send = (status, value) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" });
      res.end(JSON.stringify(value));
    };
    if (req.url === '/healthz' && req.method === 'GET') return send(200, { ok: true, service: 'DenaDesk', stage: 'identity-only', remoteReady: false });
    if (req.url !== '/v1/identity' || req.method !== 'POST') return send(404, { error: 'Not found' });
    // Credentials are accepted only as a header, never in URLs, forms, cookies or logs.
    if (req.headers['content-length'] && req.headers['content-length'] !== '0' || req.headers['transfer-encoding']) return send(400, { error: 'Request body is not accepted' });
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '');
    if (!match || match[1].length > 16000) return send(401, { error: 'Google identity token required' });
    if (now() >= until) { until = now() + 60000; bucket = 0; }
    if (++bucket > 60 || active >= 4) return send(429, { error: 'Try again shortly' });
    active++;
    try {
      const p = await verify(match[1], audience);
      if (!p || p.aud !== audience || !['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)
          || !Number.isFinite(p.exp) || p.exp * 1000 <= now() || p.email_verified !== true
          || !allowed.has(p.sub)) return send(403, { error: 'Account is not authorized' });
      return send(200, { authenticated: true, subject: p.sub, email: p.email, remoteReady: false });
    } catch {
      // Verification errors may contain request metadata. Do not log or return the exception.
      return send(401, { error: 'Google identity verification failed' });
    } finally { active--; }
  });
  return server;
}

if (require.main === module) {
  const { OAuth2Client } = require('google-auth-library');
  const verifier = new OAuth2Client({ transporterOptions: { timeout: 15000, retry: false } });
  const server = createServer({ audience: process.env.GOOGLE_CLIENT_ID,
    allowedSubjects: (process.env.ALLOWED_GOOGLE_SUBS || '').split(',').map((s) => s.trim()).filter(Boolean),
    verify: async (token, audience) => (await verifier.verifyIdToken({ idToken: token, audience })).getPayload() });
  const port = Number(process.env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  server.listen(port, '0.0.0.0', () => console.log('DenaDesk identity service listening'));
  process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 10000).unref(); });
}
module.exports = { createServer };
