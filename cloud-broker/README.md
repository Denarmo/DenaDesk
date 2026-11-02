# DenaDesk connection service — first milestone

This version verifies Google identity for explicitly allowed Google subjects. It does not register devices or carry remote sessions yet. The Windows Google-account code and this service form the first integration checkpoint, not a complete remote desktop.

Render configuration:

- Workspace: the owner's confirmed workspace.
- Service: `denadesk-broker`, Node runtime, Frankfurt.
- Initial plan: Free, for development. Render may spin down idle free services and restart them; persistent unattended access needs a later hosting decision.
- Build command: `npm --prefix cloud-broker ci --omit=dev`
- Start command: `node cloud-broker/server.js`
- Environment: `GOOGLE_CLIENT_ID` (Desktop client ID), `ALLOWED_GOOGLE_SUBS` (comma-separated stable Google subject IDs, not emails). No OAuth client secret or refresh token belongs on this service.
- Repository: this fork, reviewed commit. Start with automatic deploys disabled.
- Health endpoint: `/healthz`.

`POST /v1/identity` accepts a Google ID token only as `Authorization: Bearer …`. The service verifies Google signature/issuer/audience/expiry, verified email and owner subject. It returns identity to that authenticated caller. It accepts no request body, enables no CORS, sets no cookies, stores no user database, and logs no tokens or account data. Verification concurrency and request volume are bounded for this personal development milestone.

The full flow still needs signed device enrollment, a persistent trusted-device registry, expiring session signaling, explicit host approval, peer-key verification and direct WebRTC channels. Google identifies the account; this service will supply its linked-device list and connection-setup messages. Screen, audio, input, clipboard and files must travel directly between approved peers. No TURN relay or Cloudflare setup is planned. STUN can discover public addresses without relaying session traffic; connections must fail clearly if a direct path cannot be established. No remote session should be enabled until those checks are implemented and tested.

## Local checks

Run `npm --prefix cloud-broker ci` and `npm --prefix cloud-broker test`.
The Windows sign-in implementation uses the Google Node authentication library, system browser, PKCE, random state/nonce, a temporary loopback-only callback and OS-encrypted storage. Imported Google JSON files and encrypted credentials stay outside Git.

Sources: [Render WebSockets](https://render.com/docs/websocket), [Render free limitations](https://render.com/docs/free), [Google desktop authorization](https://developers.google.com/identity/protocols/oauth2/native-app), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
