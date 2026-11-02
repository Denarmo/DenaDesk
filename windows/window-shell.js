// DenaDesk — GPL-3.0. The tray owns the lifetime; hiding the UI never stops a session.
'use strict';

const chrome = {
  titleBarStyle: 'hidden',
  titleBarOverlay: { color: '#202024', symbolColor: '#f1c40f', height: 46 },
};

function keepInTray(win, { quitting, saveBounds }) {
  const hide = () => {
    saveBounds();
    win.hide();
    win.setSkipTaskbar(true);
  };
  win.on('minimize', hide);
  win.on('close', (e) => {
    if (quitting()) return;
    e.preventDefault();
    hide();
  });
  win.on('show', () => win.setSkipTaskbar(false));
}

module.exports = { chrome, keepInTray };
