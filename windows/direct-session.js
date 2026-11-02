// DenaDesk — GPL-3.0. Each approved session owns its sandboxed WebRTC window.
'use strict';
const { BrowserWindow, ipcMain, desktopCapturer, screen, session: electronSession } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const RemoteInput = require('./remote-input');
const P = require('../shared/protocol');
function createSession(ctx, options) {
  const { role, mode, send, state, close } = options;
  const url = pathToFileURL(path.join(__dirname, 'direct-remote.html')).href;
  const partition = electronSession.fromPartition('denadesk-direct-' + role, { cache: false });
  // This page has no need to issue HTTP requests or navigate to external content.
  partition.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('devtools:') }));
  partition.setPermissionRequestHandler((wc, permission, callback) => callback(role === 'host' && wc === win.webContents && wc.getURL() === url && permission === 'display-capture'));
  partition.setPermissionCheckHandler((wc, permission) => role === 'host' && wc === win.webContents && wc.getURL() === url && permission === 'display-capture');
  partition.setDisplayMediaRequestHandler((request, callback) => {
    if (!stopped && role === 'host' && source && request.frame === win.webContents.mainFrame && request.frame.url === url && request.videoRequested && !request.audioRequested) callback({ video: source });
    else callback({});
  });
  const win = new BrowserWindow({ width: role === 'host' ? 650 : 1100, height: role === 'host' ? 165 : 730, show: true, alwaysOnTop: role === 'host', minimizable: role !== 'host',
    title: role === 'guest' ? 'DenaDesk — ' + options.name : 'DenaDesk — screen sharing',
    autoHideMenuBar: true, backgroundColor: '#101017', webPreferences: { session: partition, preload: path.join(__dirname, 'preload-direct.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  const input = new RemoteInput({ helper: ctx.kvm.helper, link: { peerOs: P.OS.WIN }, settings: { pcScreen: { input: mode === 'control' }, keys: { swapCtrlCmd: false } }, inputAllowed: () => ctx.kvm.mode === 'home' });
  let stopped = false, ready = false, pending = [], source, rect, live = false, count = 0, until = 0;
  const trusted = (e) => !stopped && !win.isDestroyed() && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame && e.senderFrame.url === url;
  const toWindow = (m) => { if (stopped || win.isDestroyed()) return; if (ready) win.webContents.send('direct-command', m); else if (pending.length < 64) pending.push(m); else close(); };
  const onReady = async (e) => {
    if (!trusted(e) || ready) return;
    ready = true;
    try {
      if (role === 'host') {
        const primary = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
        if (stopped) return;
        source = sources.find((s) => s.display_id === String(primary.id));
        if (!source) throw new Error('No capture source');
        rect = screen.dipToScreenRect(null, primary.bounds);
      }
      toWindow({ type: 'start', role, mode, name: options.name });
      for (const m of pending.splice(0)) toWindow(m);
    } catch { state('failed'); }
  };
  const onOut = (e, m) => {
    if (!trusted(e) || !m || typeof m !== 'object') return;
    if (m.type === 'signal' && ['offer', 'answer', 'ice'].includes(m.kind)) send(m.kind, m.payload);
    else if (m.type === 'state' && ['live', 'failed'].includes(m.status)) { live = m.status === 'live'; state(m.status); }
    else if (m.type === 'close') close();
    else if (m.type === 'release' && role === 'host') input.release();
    else if (m.type === 'input' && role === 'host' && mode === 'control' && live && rect) {
      if (Date.now() >= until) { until = Date.now() + 1000; count = 0; }
      if (++count > 500) { input.release(); state('failed'); return; }
      const v = m.value;
      if (!v || !RemoteInput.TYPES.includes(v.t)) return;
      const allowedKeys = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Left|Right|Up|Down)|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right)|Meta(?:Left|Right)|Space|Enter|Tab|Backspace|Delete|Escape|Home|End|PageUp|PageDown|Insert|CapsLock|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|Numpad[0-9]|Numpad(?:Add|Subtract|Multiply|Divide|Decimal|Enter))$/;
      if (v.t === P.T.IN_KEY_DOWN || v.t === P.T.IN_KEY_UP) { if (!allowedKeys.test(v.code)) return; }
      if ([P.T.IN_MOVE, P.T.IN_DOWN, P.T.IN_UP].includes(v.t) && (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1)) return;
      if ([P.T.IN_DOWN, P.T.IN_UP].includes(v.t) && (!Number.isInteger(v.b) || v.b < 0 || v.b > 4)) return;
      if (v.t === P.T.IN_WHEEL && (!Number.isFinite(v.dx) || !Number.isFinite(v.dy) || Math.abs(v.dx) > 1000 || Math.abs(v.dy) > 1000)) return;
      input.handle(v, (x, y) => ctx.kvm.helper.send('moveTo', { x: Math.round(rect.x + x * (rect.width - 1)), y: Math.round(rect.y + y * (rect.height - 1)) }));
    }
  };
  ipcMain.on('direct-ready', onReady); ipcMain.on('direct-out', onOut);
  win.on('closed', () => { cleanup(); close(); });
  win.webContents.on('render-process-gone', () => close());
  function cleanup() { stopped = true; input.release(); ipcMain.removeListener('direct-ready', onReady); ipcMain.removeListener('direct-out', onOut); pending = []; }
  win.loadURL(url).catch(() => state('failed'));
  return {
    signal: (kind, payload) => toWindow({ type: 'signal', kind, payload }),
    stop: () => { if (stopped) return; cleanup(); if (!win.isDestroyed()) win.destroy(); },
  };
}
module.exports = { createSession };
