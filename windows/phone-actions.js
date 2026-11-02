// DenaDesk — GPL-3.0. Phone shortcuts must never follow the selected computer.
'use strict';
const { EventEmitter } = require('events');
const { DevCtl } = require('../shared/devctl');

function scopedControls(link, bridge) {
  const adapter = new EventEmitter();
  adapter.send = (m) => link.sendToClient(m);
  link.on('client', () => adapter.emit('welcome'));
  link.on('closed', () => adapter.emit('closed'));
  link.on('t:dev.state', (m) => adapter.emit('dev.state', m));
  const ctl = new DevCtl({ link: adapter, local: null, adb: () => bridge.serial ? { adb: bridge.adb, serial: bridge.serial } : null });
  if (link.current) adapter.emit('welcome');
  return ctl;
}

async function phoneAction(resolve, req) {
  if (!req || typeof req.id !== 'string' || !req.id || typeof req.action !== 'string') return { ok: false, error: 'Choose a connected phone.' };
  const p = resolve(req.id);
  if (!p || p.id !== req.id || !p.connected) return { ok: false, error: 'That phone disconnected. Reconnect it and try again.' };
  try {
    if (req.action === 'screen') { p.views.openScreen(); return { ok: true }; }
    if (req.action === 'notifications') {
      if (!p.bridge.serial) return { ok: false, error: 'Opening the notification shade needs authorized USB or wireless debugging.' };
      const r = await p.bridge.adb.shell(p.bridge.serial, 'cmd statusbar expand-notifications', { timeout: 8000 });
      if (r.code) return { ok: false, error: 'Android could not open the notification shade.' };
      return { ok: true };
    }
    const ctl = p.ctl;
    if (!ctl || !ctl.sessionUp) return { ok: false, error: 'Phone controls are not ready yet.' };
    if (req.action === 'lock') {
      if (!(ctl.view && ctl.view.can.lock) && !p.bridge.serial) return { ok: false, error: 'Lock screen needs the phone’s Accessibility service or authorized debugging.' };
      await ctl.do({ do: 'lock' });
    } else if (req.action === 'ring') {
      await ctl.do({ do: ctl.view && ctl.view.ringing ? 'ringStop' : 'ring' });
    } else if (req.action === 'wifi' || req.action === 'bluetooth' || req.action === 'dnd') {
      const qs = ctl.view && ctl.view.qs;
      if (!qs || typeof qs[req.action] !== 'boolean') return { ok: false, error: 'This phone has not shared that control.' };
      // A stale UI must not reverse a radio toggle after the phone changes it itself.
      if (typeof req.on !== 'boolean') return { ok: false, error: 'Refresh the phone controls and try again.' };
      await ctl.do({ do: 'qs', id: req.action, on: req.on });
    } else return { ok: false, error: 'Unknown phone shortcut.' };
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message || 'The phone action failed.' }; }
}

module.exports = { scopedControls, phoneAction };
