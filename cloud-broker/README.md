# DenaDesk device registry and direct connection setup

This service verifies Google identity for explicitly allowed Google subjects, lists their linked devices and exchanges signed connection-setup metadata. Remote screen and input traffic travels directly between peers; the service is never a media/data relay.

Render configuration:

- Workspace: the owner's confirmed workspace.
- Service: `denadesk-broker`, Node runtime, Frankfurt.
- Initial plan: Free, for development. Render may spin down idle free services and restart them; persistent unattended access needs a later hosting decision.
- Build command: `npm --prefix cloud-broker ci --omit=dev`
- Start command: `node cloud-broker/server.js`
- Environment: `GOOGLE_CLIENT_ID` (Desktop client ID), `ALLOWED_GOOGLE_SUBS` (comma-separated stable Google subject IDs, not emails). No OAuth client secret or refresh token belongs on this service.
- Repository: this fork, reviewed commit. Start with automatic deploys disabled.
- Health endpoint: `/healthz`.
- WSS endpoint: `/v1/link`. Browser Origin headers and URL credentials are rejected.
- Optional `REGISTRY_FILE`: metadata file on persistent storage. Default `/tmp/denadesk-devices.json` is ephemeral on Render Free; offline records can disappear at restart. Online clients register again. Peer trust and private keys remain on each PC. No paid storage is configured automatically.

`POST /v1/identity` accepts a Google ID token only as `Authorization: Bearer …`. The service verifies Google signature/issuer/audience/expiry, verified email and owner subject. It returns identity to that authenticated caller. That endpoint accepts no request body, enables no CORS and sets no cookies. Neither endpoint logs tokens or account data. Verification concurrency, device counts, connections, message sizes and request volume are bounded.

WSS enrollment uses a fresh server nonce, a Google ID token and proof of possession of an Ed25519 device key. Device IDs are public-key hashes. Every session message is signed with sender/recipient IDs, session ID, sequence and expiry. The host must approve the requested capability before SDP is exchanged. Device lists are isolated by account. No OAuth token or device private key is saved in the registry.

Windows 2.8.0 supports primary-screen viewing and optional keyboard/mouse control with explicit trust and session approval. It verifies peer signatures locally and rejects relay candidates in the broker, main process and renderer. WebRTC uses STUN discovery with no TURN configuration and verifies the selected direct candidate pair. There is no Cloudflare setup. Incompatible networks fail clearly. Closing, locking, suspending, signing out or forgetting peer trust ends the session. Sound, clipboard/files, Android account linking and unattended control remain outside this milestone.

## Local checks

Run `npm --prefix cloud-broker ci` and `npm --prefix cloud-broker test`.
The Windows sign-in implementation uses the Google Node authentication library, system browser, PKCE, random state/nonce, a temporary loopback-only callback and OS-encrypted storage. Imported Google JSON files and encrypted credentials stay outside Git.

Sources: [Render WebSockets](https://render.com/docs/websocket), [Render free limitations](https://render.com/docs/free), [Google desktop authorization](https://developers.google.com/identity/protocols/oauth2/native-app), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
