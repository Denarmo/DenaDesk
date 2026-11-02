// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Fetches adb for Windows (Android platform-tools: adb.exe and its two DLLs) into a folder,
// windows/vendor/adb by default. installer/build.js runs it for the installer; run it once
// (`npm run fetch-adb`) for a dev copy that has no Android SDK. Needs tar (Windows 10 and later,
// macOS) to unpack the zip.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ZIP_URL = 'https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip';
const ZIP_SHA256 = '45f4d63113e895ebde0c90f194099a4676b6ac653bd28d54314a9e022bbc1a99';
const HASHES = {
  'adb.exe': 'b4a6b455702684652cccf7b46258b29e653538904359a58fd4931cf3ef286b3f',
  'AdbWinApi.dll': 'c1d653030b4bde65d3e07e4d0b0979e17be56df1436cdd15528630f27808050d',
  'AdbWinUsbApi.dll': '0710e894d9b40f71a670c13c694079d564c92c1279da382cfe4850983aaebe1b',
};
const FILES = ['adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll'];
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verifyFiles(dest) {
  for (const f of FILES) if (hash(path.join(dest, f)) !== HASHES[f]) throw new Error('adb checksum mismatch: ' + f);
}

function download(url, to, hops = 5) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'dl.google.com') return reject(new Error('Unexpected adb download origin'));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops > 0) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, to, hops - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('Download failed: HTTP ' + res.statusCode + ' for ' + url));
      }
      const out = fs.createWriteStream(to);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchAdb(dest = path.join(__dirname, '..', 'vendor', 'adb')) {
  if (FILES.every((f) => fs.existsSync(path.join(dest, f)))) { verifyFiles(dest); return dest; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'twindesk-adb-'));
  try {
    const zip = path.join(tmp, 'platform-tools.zip');
    console.log('Downloading adb (Android platform-tools)…');
    await download(ZIP_URL, zip);
    if (hash(zip) !== ZIP_SHA256) throw new Error('adb archive checksum mismatch');
    execFileSync('tar', ['-xf', zip, '-C', tmp], { stdio: 'inherit' });
    verifyFiles(path.join(tmp, 'platform-tools'));
    fs.mkdirSync(dest, { recursive: true });
    for (const f of FILES) fs.copyFileSync(path.join(tmp, 'platform-tools', f), path.join(dest, f));
    for (const f of ['NOTICE.txt', 'source.properties']) {
      const from = path.join(tmp, 'platform-tools', f);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, f));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return dest;
}

module.exports = { fetchAdb, verifyFiles };

if (require.main === module) {
  fetchAdb(process.argv[2]).then((d) => console.log('adb is in ' + d), (e) => { console.error(e.message); process.exit(1); });
}
