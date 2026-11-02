// DenaDesk — GPL-3.0. Only the trusted main window can manage Google account state.
'use strict';
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const { GoogleAccount, encryptedStore } = require('./google-account');
function register() {
  const { app, ipcMain, dialog, shell, safeStorage, BrowserWindow } = require('electron');
  const account = new GoogleAccount({ store: encryptedStore(path.join(app.getPath('userData'), 'google-account.bin'), safeStorage),
    openExternal: (url) => shell.openExternal(url) });
  const ready = account.load();
  const urls = ['app.html', 'mesh/app.html'].map((p) => pathToFileURL(path.join(__dirname, p)).href);
  const trusted = (e) => e.senderFrame === e.sender.mainFrame && urls.includes(e.senderFrame.url);
  account.on('change', (view) => {
    for (const win of BrowserWindow.getAllWindows()) if (urls.includes(win.webContents.getURL())) win.webContents.send('google-account', view);
  });
  const handle = (name, fn) => ipcMain.handle(name, async (e) => {
    if (!trusted(e)) throw new Error('Google account action is unavailable here.');
    await ready;
    try { return await fn(e); } catch { return { ...account.view(), error: 'The Google account action could not finish. Try again.' }; }
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
  handle('googleAccountSignOut', () => account.signOut());
  app.on('before-quit', () => account.cancel());
  return account;
}
module.exports = { register };
