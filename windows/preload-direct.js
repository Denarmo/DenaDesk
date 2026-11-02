// DenaDesk — GPL-3.0. No credentials, filesystem or general application IPC.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('denaDirect', {
  on: (fn) => ipcRenderer.on('direct-command', (_e, value) => fn(value)),
  send: (value) => ipcRenderer.send('direct-out', value),
  ready: () => ipcRenderer.send('direct-ready'),
});
