// DenaDesk — GPL-3.0. Copy/save the displayed preview; original files use the phone transfer.
'use strict';
const path = require('path');
const fs = require('fs');
function preview(r) {
  if (!r || typeof r.data !== 'string' || r.data.length > 12000000) return null;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(r.data);
  if (!m) return null;
  return { bytes: Buffer.from(m[2], 'base64'), extension: m[1] === 'jpeg' ? 'jpg' : m[1], name: String(r.name || 'Phone image').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 160) };
}
function register(ipcMain) {
  const { Menu, BrowserWindow, clipboard, nativeImage, dialog } = require('electron');
  ipcMain.handle('photoMenu', (e, req) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const url = e.senderFrame && e.senderFrame.url;
    if (!win || !url || !['app.html', 'mesh/app.html'].some((p) => url === require('url').pathToFileURL(path.join(__dirname, p)).href)) return;
    const p = preview(req);
    if (!p) return { error: 'No image preview is ready.' };
    return new Promise((resolve) => {
      let task = Promise.resolve({});
      const choose = (action) => { task = Promise.resolve().then(action).catch((error) => ({ error: error.message })); };
      Menu.buildFromTemplate([
        { label: 'Copy image', click: () => choose(() => {
          const image = nativeImage.createFromBuffer(p.bytes);
          if (image.isEmpty()) return { error: 'This image cannot be copied.' };
          clipboard.writeImage(image); return { action: 'copied' };
        }) },
        { label: 'Save image as…', click: () => choose(async () => {
          const name = p.name.replace(/\.[^.]*$/, '') + '.' + p.extension;
          const r = await dialog.showSaveDialog(win, { title: 'Save displayed image preview', defaultPath: name, filters: [{ name: 'Image preview', extensions: [p.extension] }] });
          if (r.canceled || !r.filePath) return {};
          await fs.promises.writeFile(r.filePath, p.bytes);
          return { action: 'saved' };
        }) },
        { label: 'Save original to Downloads', click: () => choose(() => ({ action: 'original' })) },
        { type: 'separator' },
        { label: 'Copy filename', click: () => choose(() => { clipboard.writeText(p.name); return { action: 'filename' }; }) },
      ]).popup({ window: win, callback: () => task.then(resolve) });
    });
  });
}
module.exports = { preview, register };
