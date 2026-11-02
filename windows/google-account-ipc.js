// DenaDesk — GPL-3.0. Only the trusted main window can manage Google account state.
'use strict';
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const { GoogleAccount, encryptedStore } = require('./google-account');
function register(ctx) {
  const { app, ipcMain, dialog, shell, safeStorage, BrowserWindow, powerMonitor } = require('electron');
  const account = new GoogleAccount({ store: encryptedStore(path.join(app.getPath('userData'), 'google-account.bin'), safeStorage),
    openExternal: (url) => shell.openExternal(url) });
  const { RemoteLink } = require('./remote-link');
  const remote = new RemoteLink({ account, name: require('os').hostname().slice(0, 80),
    store: encryptedStore(path.join(app.getPath('userData'), 'remote-device.bin'), safeStorage),
    approve: async (request) => {
      const trust = request.type === 'trust';
      const result = await dialog.showMessageBox({ type: 'question', title: trust ? 'Trust a linked device' : 'Allow remote access?',
        message: trust ? 'Compare this fingerprint on ' + request.name : request.name + ' requests ' + (request.mode === 'control' ? 'screen viewing and keyboard/mouse control' : 'screen viewing'),
        detail: trust ? request.fingerprint + '\n\nOn that device, open General → Google account and compare its “This device fingerprint”. Approve only if every group matches. Google sign-in alone does not grant control.'
          : 'Share your primary display for this session only. A visible sharing window stays open. Close it or lock this PC to disconnect. Clipboard, files and system audio are not shared.',
        buttons: ['Decline', trust ? 'Fingerprints match — trust device' : 'Allow this session'], defaultId: 0, cancelId: 0, noLink: true });
      return result.response === 1;
    }, startSession: (options) => require('./direct-session').createSession(ctx, options) });
  const ready = account.load().then(() => remote.load()).catch(() => { remote.error = 'Account or device keys could not be opened. Remote access is disabled.'; remote.status = 'off'; remote.enabledFor = null; remote.identity = null; });
  const urls = ['app.html', 'mesh/app.html'].map((p) => pathToFileURL(path.join(__dirname, p)).href);
  const trusted = (e) => e.senderFrame === e.sender.mainFrame && urls.includes(e.senderFrame.url);
  account.on('change', (view) => {
    for (const win of BrowserWindow.getAllWindows()) if (urls.includes(win.webContents.getURL())) win.webContents.send('google-account', view);
  });
  remote.on('change', (view) => {
    for (const win of BrowserWindow.getAllWindows()) if (urls.includes(win.webContents.getURL())) win.webContents.send('remote-link', view);
  });
  const handle = (name, fn, remoteAction = false) => ipcMain.handle(name, async (e, ...args) => {
    if (!trusted(e)) throw new Error('Google account action is unavailable here.');
    await ready;
    try { return await fn(e, ...args); } catch { return { ...(remoteAction ? remote.view() : account.view()), error: remoteAction ? 'The device action could not finish. Check sign-in and device availability.' : 'The Google account action could not finish. Try again.' }; }
  });
  handle('googleAccountGet', () => account.view());
  handle('googleAccountImport', async (e) => {
    if (account.attempt) return account.view();
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'Import Google Desktop app configuration', properties: ['openFile'], filters: [{ name: 'Google OAuth configuration', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return account.view();
    const f = await fs.open(result.filePaths[0], 'r');
    try {
      if ((await f.stat()).size > 20000) throw new Error('Configuration is too large.');
      return await account.configure(JSON.parse(await f.readFile('utf8')));
    } finally { await f.close(); }
  });
  handle('googleAccountSignIn', () => account.signIn());
  handle('googleAccountCancel', () => { account.cancel(); return account.view(); });
  handle('googleAccountSignOut', async () => { await remote.disable(); return account.signOut(); });
  handle('remoteLinkGet', () => remote.view(), true);
  handle('remoteLinkEnable', (_e, enabled) => enabled === true ? remote.enable() : remote.disable(true), true);
  handle('remoteLinkConnect', (_e, id, mode) => remote.request(id, mode), true);
  handle('remoteLinkDisconnect', () => { remote.end(); return remote.view(); }, true);
  handle('remoteLinkForget', (_e, id) => remote.forget(id), true);
  for (const event of ['lock-screen', 'suspend']) powerMonitor.on(event, () => remote.end(true, 'Session ended because this PC locked or suspended.'));
  app.on('before-quit', () => { account.cancel(); remote.disable().catch(() => {}); });
  return account;
}
module.exports = { register };
