# DenaDesk

DenaDesk connects Windows, Android, macOS and Linux devices for screen, input,
clipboard and file sharing. This personal fork is maintained by
[Denarmo](https://github.com/Denarmo/DuoDesk), based on
[DuoDesk by 0xCodez](https://github.com/0xCodez/DuoDesk) and
[TwinDesk by Inuka Asith](https://github.com/InukaAsith/TwinDesk).
Original copyright and GPL-3.0 terms are retained.

The desktop and Android apps use Dena.emu's gold (`#F1C40F`) and dark anthracite
(`#202024`) palette with a new DenaDesk icon. Windows app identity is
`org.denarmo.denadesk`; Android package is `com.denarmo.denadesk`.
DenaDesk keeps its own pairing profile, so pair devices again after installing.

## Reviewed builds

The local Windows x64 installer is `DenaDesk-Setup-2.7.0.exe`. Android packages
are `DenaDesk-2.7.0.apk` (standard) and `DenaDesk-2.7.0-full.apk` (optional
notification, SMS and Accessibility services). Both Android variants use the
same private release key, and Android asks the owner to grant sensitive access.
Android 10 or later is required; wireless debugging requires Android 11 or later.

Build instructions, signing requirements and theme reference: [BRANDING.md](BRANDING.md).
Security changes, omitted optional Windows call-audio package and remaining
limitations: [SECURITY.md](SECURITY.md). Each package records its committed
source revision in `build-info.json`. A Defender result applies to the scanned
bytes and definitions; it is not a guarantee that software is free of all flaws.

Use this fork's reviewed packages. Upstream DuoDesk/TwinDesk installers are
separate builds. No DenaDesk public release or website has been published by
this local build process. macOS/Linux source branding is updated, but those
platforms have not been built or tested in this Windows session.

## Behavior and permissions

Automatic update checks default off. The app does not change Public networks
to Private, remove firewall blocks, import trusted certificates, or grant
Android debugging/security privileges. Firewall allow rules are limited to
Private/Domain networks and LocalSubnet. Existing explicit settings remain
under the owner's control.

The [historical upstream manual](docs/upstream-manual.md) explains the original
feature set. Its older permission and download instructions do not override
this fork's security policy.

## Windows 2.7 behavior

Minimize and Close keep DenaDesk in the notification area; use Quit in its tray
menu to stop it. Mesh/input timers keep running while UI redraws pause. Shift
held before crossing an edge is carried to the destination. The Home/Overview
resource widget samples every three seconds only while visible. It includes
Electron and known active native helpers; shared ADB server memory is excluded.

Phone windows keep navigation centered below the picture, including fullscreen.
The dashboard phone shortcuts target their named phone independently of the
selected PC. Photo viewing hides those shortcuts. The photo context menu copies
or saves the displayed preview; Save original transfers the full file to Downloads.
Thumbnail cache size is bounded. Mesh notification history keeps the last 100
received items for this running session; Clear removes it. Android resends active
notifications after connection and notification access must be enabled by the owner.

Cellular call audio using the PC microphone/speakers over USB or Wi-Fi remains
unsupported on stock Android: capture requires system privileges. Google linking
and Internet access are **design only** in [the remote access design](docs/remote-access-design.md).
No cloud service is deployed and no Google account is connected by this release.

## Windows 2.8 Google remote access

Windows 2.8.1 provides one-click Google sign-in and linked devices under General, using
a system browser, PKCE and encrypted local storage. `cloud-broker/` supplies an
account-isolated device registry and signed connection setup. Both PCs approve
first-time device trust, and the host approves each viewing/control session.
Official builds include the Google Desktop public-client settings. Click Sign in
with Google on each PC; no JSON import or separate linking step is needed. After
sign-in the account row offers only Sign out on this PC, which removes this PC
from the live directory and disconnects its remote session.
Screen and optional keyboard/mouse traffic travels directly between peers,
without a TURN relay. Close either session window or lock the PC to disconnect.
Some networks cannot establish a direct path; those attempts fail without a relay.
Android Google linking, sound, clipboard/files and unattended Internet control are
not included. The existing installed 2.7.0 packages do not contain this milestone.
Render Free can lose offline registry records at restart; device keys and trust
remain protected locally. See [setup and limits](docs/remote-access-design.md).

## License

[GPL-3.0](LICENSE). See [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) and `licenses/`
for bundled components and original attribution.
