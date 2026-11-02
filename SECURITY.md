# Security changes in this fork

The reviewed Windows build is `2.5.1-security.1`. It is a separate build of
[Denarmo/DuoDesk](https://github.com/Denarmo/DuoDesk), not the flagged upstream installer.

- Phone connection no longer grants Android permissions, disables ADB authorization
  expiry, exempts the app from battery policy, or activates legacy ADB TCP port 5555.
  Choose permissions in the Android app and system settings. Automatic wireless
  debugging reactivation and some elevated phone controls are consequently unavailable.
  Existing permissions or manually enabled debugging are not silently revoked.
- Firewall rules cover only Private/Domain profiles and the local subnet. Repair
  preserves block rules and never makes a Public network Private. Use a network
  you trust; managed policies may require your administrator. Routed subnets and
  Public networks are not automatically opened.
- Setup no longer raises Windows' global WebDAV file-size limit. Large WebDAV
  transfers may be limited by the existing Windows configuration.
- Setup and optional display-driver installation do not add certificate trust.
  This unsigned local build omits the Bluetooth call-audio MSIX. Calls can still
  use the phone's sound. Building that package requires an existing trusted signing
  certificate through `DUODESK_CALLS_CERT_SHA1`; no self-signed certificate is made.
  The TLS pairing identity remains a per-device key; it is not a trusted publisher.
- Optional display/gamepad/camera driver installation still requires an explicit
  action and administrator approval. Driver downloads retain hash and signature
  checks. Building the app does not install these drivers.
- Fresh installs do not check for updates automatically. Manual/opt-in checks use
  this fork's GitHub releases. Existing explicit update preferences are preserved.
  The Tip page requires Load tip service before contacting beyond-media.ai. Checkout
  and feedback disclose their external destinations; no payment data is processed
  by the desktop app. See the README privacy section.
- Desktop runtime dependencies and tool versions are pinned in the manifests and
  lockfiles. Windows builds use `npm ci`; ADB's archive and executable hashes and
  the bundled scrcpy-server hash are checked. Packaging requires a clean committed
  tree and includes `build-info.json` identifying that commit and the lockfile hash.

## Build and validate Windows x64

Use Node.js 24 or later, the Windows SDK and Visual Studio C++ Build Tools:

```powershell
cd windows
npm ci
node --test test/security.test.js
powershell -NoProfile -File test/firewall-policy.ps1
npm run dist -- x64
```

The C#/C++ helpers are compiled locally. No old helper from an upstream installer
is required. No paid signing certificate is configured by default; the Windows
installer is therefore unsigned and can still show reputation warnings.

## Remaining limits

No static review or antivirus result proves software harmless. Keep a file
quarantined if Defender reports malware; do not add exclusions or disable protection.
The original upstream `2.5.0` Malgent detection is not resolved by these changes.

The refreshed runtime dependency audit has no reported vulnerabilities. Upstream
packaging tools still depend on older minimatch versions affected by
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
These development dependencies do not ship in the installer. The build uses only
reviewed, committed local patterns, not patterns supplied over the network or by
an app user. Audit results and this limitation must accompany the build; forcing
incompatible major dependency overrides is not a validated fix.

Android, macOS, Linux, device pairing and optional driver features need platform
integration testing. The Windows build does not bundle an unreviewed Android APK.
