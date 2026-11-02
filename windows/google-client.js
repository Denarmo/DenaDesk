// DenaDesk — GPL-3.0. Google Desktop public-client configuration, supplied at build time.
'use strict';
const fs = require('fs');
const path = require('path');
const { desktopConfig } = require('./google-account');
const CLIENT_ID = '309637203825-2nikn9hu4p2bm58k95rcvduc3lt4gpb1.apps.googleusercontent.com';
function validate(json) {
  const config = desktopConfig(json);
  if (config.clientId !== CLIENT_ID) throw new Error('Google Desktop client does not match the DenaDesk service.');
  return { installed: { client_id: config.clientId, client_secret: config.clientSecret, project_id: config.projectId } };
}
function bundled() {
  try { return validate(JSON.parse(fs.readFileSync(path.join(__dirname, 'oauth-desktop.json'), 'utf8'))); }
  catch { return null; } // Local/USB features still work in an unconfigured development build.
}
module.exports = { validate, bundled };
