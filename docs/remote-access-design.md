# DenaDesk remote access: setup design

Status, 2 November 2026: the Windows development source implements Google desktop identity setup. Real browser sign-in and the deployed owner-restricted Render identity endpoint have been verified. Device enrollment, Internet signaling and remote sessions remain to be implemented. Installed 2.7.0 packages do not include these development changes. Local pairing and USB continue to work without an account.

Owner requirement: remote-session traffic travels directly between host and guest. Google identifies the account used to list linked devices. The DenaDesk broker stores approved-device records and exchanges connection-setup messages; it never forwards screen, audio, input, clipboard or file traffic. No Cloudflare setup or TURN relay is part of this design.

## Connection architecture

```mermaid
flowchart LR
  A[Windows or Android client] -->|System browser sign-in| G[Google identity]
  A -->|HTTPS / WSS: device registration and session offers| B[DenaDesk device broker]
  B <-->|Authenticated signaling| H[Approved remote host]
  A <-->|WebRTC encrypted media and data channels| H
  A -.->|Address discovery only| S[STUN service]
  H -.->|Address discovery only| S
```

Use WebRTC and ICE for direct peer connections, with STUN for public-address discovery. STUN does not relay remote-session traffic. This is a DenaDesk service design; it does not claim compatibility with Google's private remote-desktop signaling service or Chromoting wire protocol. Google sign-in provides identity, not a device registry or remote-desktop tunnel. Reuse the existing local WebRTC and input helpers where suitable, with a separate Internet connection configuration that excludes their existing local TURN settings.

Direct connections cannot be guaranteed across all NATs, carrier networks and firewalls. If ICE cannot establish a direct path, end the attempt with an actionable error; never silently fall back to a relay. A reachable IPv6 route or an owner-configured network change may help. Do not automatically open router ports, weaken firewalls or change network profiles. Render still handles device discovery and connection setup, so this design is not independent of third-party services during sign-in and discovery.

## Owner setup

1. Create a Google Cloud project and configure Google Auth Platform branding, audience and test users. Create a **Desktop app** OAuth client for Windows. Android needs a separate platform client registered with `com.denarmo.denadesk` and the release signing certificate. Desktop client identifiers are public configuration; never treat an installed app's client secret as a security boundary.
2. Use the deployed Render HTTPS hostname for the DenaDesk broker. Extend the identity-only service with a persistent approved-device registry, expiring presence records and session-offer delivery over authenticated HTTPS/WSS. Keep secrets in the hosting provider's secret store. Start with one region and bounded session/message limits.
3. Configure STUN address discovery without TURN credentials or relay URLs. Google sign-in does not itself provide the linked-device list; DenaDesk's authenticated registry supplies that list for the verified account.
4. Configure client IDs, broker URL, STUN discovery and token verification audiences. Publish a privacy policy describing device names, public addressing/ICE metadata, account identifiers and retention. Review Google's publication requirements before opening sign-in beyond configured test users.
5. Test two Windows devices on different networks before enabling Android remote viewing. Android screen capture still requires the phone's normal MediaProjection consent and foreground-service behavior. Remote access does not bypass Android permissions or Windows secure desktop/UAC.

## Authentication and device trust

- On desktop use the system browser, authorization code flow with PKCE, a random state and nonce, and a short-lived loopback callback bound only to loopback. Request `openid email`; request profile only if the UI needs it. Do not request Drive/Gmail access. Use the supported Android identity flow for Android.
- The desktop verifies the sign-in transaction's nonce; the broker independently verifies ID-token signature, issuer, audience, expiry and account authorization. Use Google's stable `sub` claim as account identity, rather than email. Exchange successful authentication for a short-lived, device-bound DenaDesk session. Keep any long-lived device credential in OS-protected storage; never in renderer localStorage or logs.
- Generate a per-device key and retain the app's pinned pairing model. Account membership alone may list devices but must not grant input control. Enrolling a new controller requires explicit approval on the host (or an already trusted local enrollment path). Remote hosting starts disabled.
- Bind each session offer, peer keys, requested capabilities and WebRTC certificate fingerprints to signed session transcripts with nonces and expiry. A signaling-service compromise must not silently substitute a remote peer. Reject replay, revoked devices, mismatched accounts and unexpected fingerprints.
- Ask the host to approve viewing/control, show the remote peer and a persistent session indicator, and provide immediate disconnect and per-device revocation. Treat unattended access as a separate future opt-in feature. Revocation terminates active sessions and expires device tokens.

## Session setup and application integration

1. A signed-in client registers its public device key and minimal capability/presence record. The broker returns only devices authorized for that account/controller.
2. The controller requests a capability-scoped session (view, input, clipboard or files). The host approves locally and both endpoints verify the signed session transcript.
3. Exchange SDP and trickled ICE candidates over the broker. Configure no TURN URLs; reject relay candidates in local and remote signaling and check the selected candidate pair before allowing session traffic. Accept only a direct peer connection. Encrypt media with WebRTC SRTP and data channels with DTLS. Signaling and STUN expose connection metadata, but receive no remote-session content. Keep candidate filtering in the main-process signaling boundary as well as the peer-connection code.
4. Bridge the approved channels into the existing native capture/input and file APIs with bounded queues, frame-rate/bitrate limits, input-release handling and backpressure. Separate interactive input from bulk transfers. Keep session ownership in the main process so minimizing the UI cannot terminate it.
5. On disconnect, timeout, host lock or revocation, release held input and close streams promptly. Reconnection requires a valid authorization, never a blind replay of an earlier session. If a direct path is unavailable, display that reason and end the attempt; linked-device visibility does not guarantee reachability.

## Delivery stages and acceptance checks

First deliver account/device enrollment and view-only Windows sessions; then input and optional clipboard/files; then Android viewing with normal on-device consent. Do not add a sign-in button that appears operational before the backend exists.

Acceptance requires direct sessions across separate networks and explicit failure when restrictive NAT or firewalls prevent them. Test IPv4/IPv6 paths, network switches, expired credentials, lost signaling, revoked peers, host lock, minimize-to-tray, and stale held Shift/mouse buttons. Inject relay candidates and verify rejection; check selected candidate pairs and network captures to confirm that session traffic flows only between peers. Verify that another account cannot enumerate devices, unauthorized signaling cannot request input, and a compromised broker cannot swap pinned keys. Measure peer bandwidth, broker metadata volume and idle resource use before public deployment.

## Primary references

- [Google OAuth for desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app): installed-app authorization and PKCE.
- [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections): ICE servers, peer connections and application-defined signaling.
- [Chromium remoting transport architecture](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/remoting/protocol/GEMINI.md): WebRTC transport, authentication and signaling in Chrome Remote Desktop.
- [Android audio sources](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource): cellular call audio capture requires system-only privileges; this design does not enable cellular PC microphone/speaker calling over USB or Wi-Fi.
