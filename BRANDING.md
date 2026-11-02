# DenaDesk

DenaDesk is Denarmo's reviewed personal fork of DuoDesk/TwinDesk. Original
copyright, authors and GPL-3.0 terms remain in the source and distribution.

The Dena.emu brand reference is `app/lib/src/ui/app_theme.dart`: gold `#F1C40F`
and dark anthracite `#202024`. DenaDesk applies those colors to its desktop and
Android interfaces and new vector icon (`shared/icon/denadesk.svg`). Status
colors retain their meaning. Gold primary controls use dark text.

Identity: Windows `org.denarmo.denadesk`, executable `DenaDesk.exe`, desktop
settings in `DenaDesk`, Android `com.denarmo.denadesk`. Pairing deep links use
`denadesk:`. The network protocol and native helper filenames remain compatible
with the upstream implementation. Re-pair devices in DenaDesk's new profile.

## Builds

Both installers and APKs embed `build-info.json` with the committed source
revision. Build from a clean commit. Windows: `npm --prefix windows run dist -- x64`.

Android: install JDK 21 and Android SDK platform 37.0/build tools 37.0.0, set
`android/local.properties` or `ANDROID_HOME`, then run `android/gradlew assembleRelease`
from `android`. Set these environment variables to a stable private release key:

- `DENADESK_KEYSTORE`: absolute keystore path
- `DENADESK_STORE_PASSWORD`
- `DENADESK_KEY_PASSWORD`
- `DENADESK_KEY_ALIAS`: `denadesk` by default

Signing files and passwords must stay outside Git. Keep a private backup: Android
updates require the same signing key. CI also requires `ANDROID_KEYSTORE` (base64),
`ANDROID_STORE_PASSWORD` and `ANDROID_KEY_PASSWORD` secrets, and fails without them.

Standard APK omits the notification listener, SMS and Accessibility services.
Full APK includes them for optional use. Installation does not grant these
permissions; the owner chooses them in Android's own settings. No protection,
permission restrictions or wireless debugging expiry are bypassed.
