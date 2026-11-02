// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Camera sharing with Multi-device on (the mesh shells; docs: specs/mesh-camera.md). The one-to-one
// CamShare (camshare.js) as it is, one per connected computer, each on a link of its own made here
// from the hub's bus: it hears only that device's cam.* messages and sends only to it, so the
// protocol is the one-to-one app's (a device in either mode can be on the other end).
//   - Viewing: Start runs the SELECTED computer's camera here (the Camera tab, the virtual camera).
//     One at a time (the virtual camera takes one picture): starting another stops the one running.
//     It keeps running when another device is selected; the tab then shows that one (state.camera's
//     peerId / peerName) until it is stopped.
//   - Sharing: "Let your other devices see this camera" (settings.camera.share) is one switch for
//     every device; each one that asks gets the camera from a sender window of its own (several may
//     watch at once), with the popup naming it.
// The tab's state (state.camera) is the shape camshare.js gives, plus peerId, peerName (the device
// it is about) and sendingTo (who is viewing ours).
//
// bus: the hub's bus (on(type, fn(msg, fromId)), onPeer('welcome'|'closed'|'transport', fn(id, info)),
//   send(id, msg), connectedIds(), selectedId()); peer(id) → {name, os, ble} | null for a connected
//   device; cfg() → settings.camera; save(); popup(kind, text); onChange().
'use strict';

const P = require('./protocol.js');
const { CamShare } = require('./camshare.js');

const T = P.T;
const TYPES = [T.CAM_POLICY, T.CAM_OPEN, T.CAM_CLOSE, T.CAM_OFFER, T.CAM_ANSWER, T.CAM_ICE, T.CAM_STATE];

class MeshCamShare {
  constructor({ bus, peer, cfg, save, popup, onChange }) {
    Object.assign(this, { bus, peer, cfg, save, popup, onChange });
    this.units = new Map(); // device id -> {cam: CamShare, fns: Map(type -> [fn])}
    this.shareError = '';
    this.lister = null; // the CamShare whose sender window listed this computer's cameras
    for (const t of TYPES) bus.on(t, (m, from) => this._emit(from, t, m, true));
    bus.onPeer('welcome', (id, info) => {
      if (info && info.os === P.OS.ANDROID) return;
      const had = this.units.has(id);
      const u = this._unit(id);
      if (u && had) this._emit(id, 'welcome', info, false); // a new one asked already (_unit)
    });
    bus.onPeer('closed', (id) => this._emit(id, 'closed', {}, false));
    for (const id of bus.connectedIds()) this._unit(id); // Camera turned on with devices connected
  }

  _computer(id) {
    const p = id ? this.peer(id) : null;
    return !!p && p.os !== P.OS.ANDROID;
  }

  // The CamShare for one computer, made the first time it's needed (kept: the bus has no off()).
  _unit(id) {
    let u = this.units.get(id);
    if (u || !this._computer(id)) return u || null;
    const fns = new Map();
    const add = (type, fn) => {
      if (!fns.has(type)) fns.set(type, []);
      fns.get(type).push(fn);
    };
    const link = {
      on: add,
      send: (m) => this.bus.send(id, m),
      connected: () => this.bus.connectedIds().includes(id) && this._computer(id),
      ble: () => !!(this.peer(id) || {}).ble,
      closed: (fn) => add('closed', fn),
    };
    u = { id, fns, cam: null };
    this.units.set(id, u);
    u.cam = new CamShare({
      link,
      cfg: this.cfg,
      save: this.save,
      popup: this.popup,
      peerName: () => this._name(id),
      onChange: () => this._changed(u),
    });
    u.cam.sendPolicy(true); // ours, and theirs asked for: it may have said it before this existed
    return u;
  }

  _emit(id, type, arg, create) {
    const u = create ? this._unit(id) : this.units.get(id);
    const fns = u && u.fns.get(type);
    if (fns) for (const fn of fns) fn(arg);
  }

  _changed(u) {
    if (u.cam.devices.length) this.lister = u.cam;
    this.onChange();
  }

  _name(id) {
    return ((this.peer(id) || {}).name) || 'the other computer';
  }

  _cams() {
    return [...this.units.values()].map((u) => u.cam);
  }

  // The one the tab shows: the computer whose camera runs here, else the selected one.
  _focus() {
    const v = [...this.units.values()].find((u) => u.cam.viewer);
    if (v) return v;
    const id = this.bus.selectedId();
    return this._unit(id);
  }

  get share() {
    return this.cfg().share === true && this.cfg().on !== false;
  }

  sendPolicy() {
    for (const c of this._cams()) c.sendPolicy();
  }

  // The tab's switch, for every device. askFirst (the Mac): macOS asks for the camera the first time.
  async setShare(on, askFirst) {
    this.shareError = '';
    if (on && askFirst && !(await askFirst())) {
      this.shareError = 'The camera isn’t allowed for DenaDesk: allow it in System Settings › Privacy & Security › Camera';
      return this.onChange();
    }
    this.cfg().share = !!on;
    this.save();
    for (const c of this._cams()) {
      c.shareError = '';
      if (!on) c.stopSending(true);
      c.sendPolicy();
    }
    this.onChange();
  }

  setDevice(id) {
    this.cfg().device = typeof id === 'string' ? id.slice(0, 200) : '';
    this.save();
    this.onChange();
  }

  listDevices() {
    const u = this._focus() || this.units.values().next().value;
    if (u) u.cam.listDevices();
  }

  // Start: the selected computer's camera here (one at a time).
  view(show = false) {
    const id = this.bus.selectedId();
    const u = this._unit(id);
    if (!u) return this.popup('home', 'Select a computer first');
    for (const o of this.units.values()) if (o !== u && o.cam.viewer) o.cam.closeView();
    u.cam.view(show);
  }

  get viewing() {
    return this._cams().some((c) => !!c.viewer);
  }

  closeView() {
    for (const c of this._cams()) c.closeView();
  }

  // Stop on the tab: nobody sees this camera any more.
  stopSending(tell = true) {
    for (const c of this._cams()) c.stopSending(tell);
  }

  // For the Camera tab (state.camera).
  get state() {
    const u = this._focus();
    const base = u ? u.cam.state : {
      connected: false, ble: false, peerShares: false, viewing: false, viewShown: false, viewStatus: '', viewError: '',
    };
    const watchers = [...this.units.values()].filter((x) => x.cam.sender && x.cam.sender.status);
    return {
      ...base,
      mesh: true, // the tab words it for every device (shared/ui-camera.js)
      share: this.share,
      device: this.cfg().device || '',
      devices: this.lister ? this.lister.devices : [],
      shareError: this.shareError || base.shareError || '',
      sending: watchers.length > 0,
      sendLive: watchers.some((x) => x.cam.sender.status === 'live'),
      sendingTo: watchers.map((x) => this._name(x.id)).join(', '),
      peerId: u ? u.id : '',
      peerName: u ? this._name(u.id) : '',
    };
  }
}

module.exports = { MeshCamShare };
