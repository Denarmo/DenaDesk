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

The local Windows x64 installer is `DenaDesk-Setup-2.6.0.exe`. Android packages
are `DenaDesk-2.6.0.apk` (standard) and `DenaDesk-2.6.0-full.apk` (optional
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

## License

[GPL-3.0](LICENSE). See [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) and `licenses/`
for bundled components and original attribution.
