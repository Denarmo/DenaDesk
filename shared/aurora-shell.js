// DuoDesk — Aurora shell. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The main window's frame after the Aurora concept (concepts/2-aurora.html), for the six main pages
// (windows/linux app.html, mac/control.html and their mesh/ variants). Loaded as the LAST script, after
// the shell (app.js / ui-start.js) built the sidebar and the pages. It only ADDS things and works
// through what every shell already exposes: UI.tabs (each page's def, its master switch), UI.go(id)
// (the 'macshare-go' event every shell listens to), UI.api.onState (a second listener is fine), and the
// shells' own ids (#sidebar, #nav, #content, #pages, #peer-dot, #peer-text). Styles: aurora-shell.css.
//   - a living aurora behind the window (.au-sky), paused while the window is hidden
//   - group labels in the sidebar, a "this desk" card at its bottom
//   - a top bar: the page's title, the link (peer · ping), the route, "encrypted"
//   - Home: a greeting and one card per device with its features' switches, in the first page
//     (Overview when something is linked, else Connection), above that page's own content
//   - a command bar docked at the bottom: real actions only (open a page, turn a feature on or off,
//     connect to an address, refresh, pair a phone, send files…)
// CSP: no inline styles; only CSSOM (el.style.setProperty) and classes.
'use strict';

(() => {
  const UI = window.UI;
  const $ = (id) => document.getElementById(id);
  const content = $('content');
  const nav = $('nav');
  const sidebar = $('sidebar');
  if (!UI || !content || !nav || !sidebar) return;
  const api = UI.api || window.macshare || {};
  const html = document.documentElement;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ---------- small helpers ----------
  function h(tag, cls, kids, props) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (props) for (const [k, v] of Object.entries(props)) {
      if (k === 'text') e.textContent = v;
      else if (k === 'attrs') for (const [a, av] of Object.entries(v)) e.setAttribute(a, av);
      else e[k] = v;
    }
    for (const c of [].concat(kids || [])) if (c != null && c !== false) e.append(c);
    return e;
  }
  // The concept's line icons (24×24).
  const ICON = {
    scr: [['rect', { x: 3, y: 4, width: 18, height: 12, rx: 2 }], ['path', { d: 'M8 20h8M12 16v4' }]],
    lap: [['rect', { x: 4, y: 5, width: 16, height: 11, rx: 2 }], ['path', { d: 'M2 19h20' }]],
    ph: [['rect', { x: 7, y: 2, width: 10, height: 20, rx: 3 }], ['path', { d: 'M11 18h2' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    up: [['path', { d: 'M12 19V5M6 11l6-6 6 6' }]],
    chev: [['path', { d: 'M6 9l6 6 6-6' }]],
    lock: [['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]],
    wifi: [['path', { d: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01' }]],
    bt: [['path', { d: 'M7 7l10 10-5 4V3l5 4L7 17' }]],
    usb: [['path', { d: 'M12 3v15M12 18a2 2 0 1 0 0 .01M8 7l4-4 4 4M7 11v2l5 3M17 9v3l-5 3' }]],
  };
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of ICON[name] || []) {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.append(n);
    }
    return svg;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const safe = (fn, dflt) => { try { return fn(); } catch (e) { return dflt; } };
  const call = (name, ...args) => (typeof api[name] === 'function' ? api[name](...args) : undefined);

  // ---------- platform ----------
  // The six pages carry their OS class on <html> (first paint is right); the UA is only a fallback.
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent;
  const OS = html.classList.contains('au-mac') ? 'mac' : html.classList.contains('au-win') ? 'win' : html.classList.contains('au-linux') ? 'linux'
    : /mac/i.test(plat) ? 'mac' : /win/i.test(plat) ? 'win' : 'linux';
  const OS_NAME = { mac: 'macOS', win: 'Windows', windows: 'Windows', linux: 'Linux', android: 'Android' };
  html.classList.add('au-shell', 'au-' + OS);
  const isSetup = () => document.body.classList.contains('setup') || !!(UI.setup && UI.setup.page && !UI.setup.page.hidden);
  const MOD = OS === 'mac' ? '⌘' : 'Ctrl';

  // ======================================================================
  // Living background
  // ======================================================================
  const sky = h('div', 'au-sky', [h('div', 'au-hue', ['au-b au-b1', 'au-b au-b2', 'au-b au-b3', 'au-b au-b4', 'au-b au-b5', 'au-veil'].map((c) => h('div', c)))], { attrs: { 'aria-hidden': 'true' } });
  document.body.prepend(sky);
  // Nothing moves while the window is hidden (minimised, in the tray, covered: Chromium reports it hidden).
  // Visible but left alone beside another app, the sky keeps flowing, only slower and calmer.
  let awayT = 0;
  let rate = 1;
  const ambient = () => document.getAnimations().filter((a) => a.animationName && /^au-(drift|veil|band|breathe|halo|mark|live|spin|word-glow|hue)/.test(a.animationName) && a.playState !== 'finished');
  const setRate = (r) => { rate = r; for (const a of ambient()) if (a.playbackRate !== r) a.playbackRate = r; };
  const setPaused = () => {
    html.classList.toggle('au-paused', document.hidden);
    if (!document.hidden && rate !== 1) setRate(rate); // animations that (re)started meanwhile
  };
  document.addEventListener('visibilitychange', setPaused);
  window.addEventListener('blur', () => { clearTimeout(awayT); awayT = setTimeout(() => setRate(0.35), 45000); });
  window.addEventListener('focus', () => { clearTimeout(awayT); if (rate !== 1) setRate(1); });
  setPaused();

  // ======================================================================
  // Sidebar: group labels, "this desk"
  // ======================================================================
  const GROUP_NAME = {
    messages: 'Phone', calls: 'Phone', media: 'Phone', papps: 'Phone',
    mirror: 'Display', 'mac-pc': 'Display', 'pc-mac': 'Display', receive: 'Display', share: 'Display', display: 'Display', apps: 'Display',
    cursor: 'Input', keyboard: 'Input', remote: 'Input',
    clipboard: 'Sharing', notifications: 'Sharing', files: 'Sharing', pfiles: 'Sharing', mount: 'Sharing',
    audio: 'Media', camera: 'Media', rezume: 'Media', terminal: 'Media',
  };
  const idOf = (btn) => ((btn && btn.getAttribute('aria-controls')) || '').replace(/^page-/, '');
  // Two sections called "Apps" (the phone's and the other computer's): the phone's says so.
  const RELABEL = { papps: ['Apps', 'Phone apps'] };
  function labelGroups() {
    for (const [id, [from, to]] of Object.entries(RELABEL)) {
      const l = nav.querySelector('[aria-controls="page-' + id + '"] .label');
      if (l && l.textContent === from) l.textContent = to;
    }
    for (const li of nav.children) {
      if (li.classList.contains('sep')) { if (li.dataset.auLabel !== 'More') li.dataset.auLabel = 'More'; continue; }
      if (!li.classList.contains('gap')) continue;
      let name = '';
      for (let n = li.nextElementSibling; n && !n.classList.contains('gap') && !n.classList.contains('sep'); n = n.nextElementSibling) {
        const id = idOf(n.querySelector('.nav-item'));
        if (GROUP_NAME[id]) { name = GROUP_NAME[id]; break; }
      }
      if (name && li.dataset.auLabel !== name) li.dataset.auLabel = name;
    }
  }
  labelGroups();

  // One scrolling column for the devices and the sections (the mesh pages have #side-scroll already),
  // so "this desk" stays put at the bottom. #phones and #nav keep their ids: the shells find them by id.
  if (!$('side-scroll') && nav.parentElement === sidebar) {
    const scroll = h('div', 'au-scroll');
    const ph = $('phones');
    nav.before(scroll);
    if (ph && ph.parentElement === sidebar) scroll.append(ph);
    scroll.append(nav);
  }
  // The devices above the sections get a group label like the sections (mesh lists computers too).
  const phonesEl = $('phones');
  if (phonesEl) phonesEl.dataset.auLabel = $('side-scroll') ? 'Devices' : 'Phones';
  const sideCol = document.querySelector('#side-scroll, .au-scroll');
  if (sideCol) sideCol.classList.add('au-col');

  const meName = h('b');
  const meSub = h('small');
  const meCard = h('div', 'au-me', [h('span', 'au-av', [h('span')]), h('div', 'au-me-t', [meName, meSub])], { attrs: { 'aria-label': 'This computer' } });
  sidebar.append(meCard);

  // ======================================================================
  // Top bar
  // ======================================================================
  const crumb = h('div', 'au-t');
  const peerDot = h('span', 'au-dot');
  const peerTxt = h('span');
  const peerPill = h('span', 'au-pill au-peer', [peerDot, peerTxt]);
  const routeIc = h('span');
  const routeTxt = h('span');
  const routePill = h('span', 'au-pill au-route', [routeIc, routeTxt]);
  const secPill = h('span', 'au-pill au-sec', [icon('lock'), h('span', null, null, { text: 'encrypted' })], { title: 'TLS with a pinned certificate, on every route' });
  const kbd = h('button', 'au-kbd', null, { text: MOD + ' K', title: 'Ask DenaDesk (' + MOD + '+K)', type: 'button' });
  const topbar = h('div', 'au-topbar', [crumb, h('span', 'au-sp'), peerPill, routePill, secPill, kbd]);
  content.prepend(topbar);
  content.addEventListener('scroll', () => topbar.classList.toggle('scrolled', content.scrollTop > 4), { passive: true });
  // The shells' own sticky banners (pairing code, updates) stick just under the bar, not behind it.
  const setTopH = () => content.style.setProperty('--au-top-h', topbar.offsetHeight + 'px');
  if (window.ResizeObserver) new ResizeObserver(setTopH).observe(topbar);
  setTopH();

  // ======================================================================
  // State adapter: the devices, whatever shape the shell's state has
  // (Windows/Linux s.link + s.peer, Mac s.client + s.paired[], mesh s.peers[]; phones everywhere)
  // ======================================================================
  const isPhoneSession = (s) => !!safe(() => UI.isPhone && UI.isPhone(s), false);
  const linkedOf = (s) => !!(s && ((s.link && s.link.state === 'connected') || (s.phone && s.phone.connected) || s.client || (Array.isArray(s.peers) && s.peers.some((p) => p && (p.connected || p.state === 'connected')))));
  const viaOf = (s) => safe(() => (UI.via ? UI.via(s) : 'Wi-Fi'), 'Wi-Fi');

  // A phone's own numbers: per phone when the state lists them (mesh: s.phone.phones[]), else the active one's.
  function phoneNums(ph, id, on) {
    const pp = (Array.isArray(ph.phones) ? ph.phones : []).find((x) => x && x.id === id) || null;
    const active = on && (!ph.connected || !ph.connected.id || ph.connected.id === id);
    return {
      rtt: pp && pp.rttMs != null ? pp.rttMs : active && ph.connected ? ph.connected.rttMs : null,
      battery: pp && pp.battery != null ? pp.battery : active && ph.info ? ph.info.battery : null,
      charging: pp ? !!pp.charging : !!(active && ph.info && ph.info.charging),
    };
  }
  const notFailed = (p) => (p && p.phase !== 'failed' ? p : null);

  function devicesOf(s) {
    const list = [];
    const ph = (s && s.phone) || {};
    const myName = (s.device && s.device.name) || s.macName || safe(() => UI.peer(s).me, '') || 'This computer';
    list.push({ kind: 'me', key: 'me', name: myName, os: OS, live: true });
    const M = window.SidebarModel;
    if (Array.isArray(s.peers) && M && typeof M.buildTiles === 'function') {
      // Mesh: the sidebar's own model, so the cards are the sidebar's tiles (one per physical device,
      // the same selection and actions). Devices only another one reaches ('via') aren't cards.
      const nearby = Array.isArray(ph.nearby) ? ph.nearby : [];
      const phones = nearby.map((d) => ({ id: d.id, name: d.name, connected: !!d.connected, connecting: !!(ph.connecting && ph.connecting.id === d.id) }));
      const tiles = safe(() => M.buildTiles({ peers: s.peers, phones, transport: viaOf(s) }), []);
      for (const t of tiles) {
        if (!t || t.state === 'via') continue;
        const live = !!t.connected;
        const base = { id: t.id, name: t.name, live, wait: t.state === 'connecting', action: t.action, mesh: true };
        if (t.kind === 'phone') {
          const nb = nearby.find((d) => d && d.id === t.id);
          list.push(Object.assign(base, phoneNums(ph, t.id, live), {
            kind: 'phone', key: 'ph:' + t.id, selected: !!t.selected, // the sidebar's selection (a computer may hold it)
            usb: !!((nb && nb.usb) || (live && ph.connected && ph.connected.id === t.id && ph.connected.usb)),
          }));
        } else {
          const p = s.peers.find((x) => x && x.id === t.id) || {};
          list.push(Object.assign(base, { kind: 'pc', key: 'pc:' + t.id, os: t.os, rtt: live ? p.rtt : null, selected: !!t.selected }));
        }
      }
      return list;
    }
    if (Array.isArray(s.peers)) {
      for (const p of s.peers) {
        if (!p || p.os === 'android' || p.state === 'via') continue;
        list.push({ kind: 'pc', key: 'pc:' + p.id, id: p.id, name: p.name || 'Computer', os: p.os || 'win', live: !!(p.connected || p.state === 'connected'), wait: p.state === 'connecting', rtt: p.rtt, selected: !!p.selected, mesh: true });
      }
    } else if (s.link) {
      const st = s.link.state;
      const pairing = notFailed(s.pairing);
      const name = (s.peer && s.peer.name) || s.link.macName || (s.paired && s.paired.macName) || '';
      const phone = isPhoneSession(s);
      if (!phone && (name || st === 'connecting' || st === 'reconnecting' || pairing)) {
        list.push({ kind: 'pc', key: 'pc', name: name || (pairing && pairing.macName) || 'The other computer', os: (s.peer && s.peer.os) || (s.paired && s.paired.os) || 'mac', live: st === 'connected', wait: st === 'connecting' || st === 'reconnecting' || !!pairing, rtt: s.link.rtt, paired: !!s.paired });
      }
      if (phone && st === 'connected') list.push({ kind: 'phone', key: 'phone:session', name: name || 'Phone', live: true, rtt: s.link.rtt, battery: ph.info && ph.info.battery, charging: ph.info && ph.info.charging });
    } else if (s.client || s.paired || (s.guest && s.guest.hosts)) {
      // Mac: the session's client, else the most recent pairing either way (UI.peer merges s.paired and
      // s.guest.hosts by lastSeen; paired entries carry no os).
      const c = s.client;
      const paired = Array.isArray(s.paired) ? s.paired : s.paired ? [s.paired] : [];
      const hosts = s.guest && Array.isArray(s.guest.hosts) ? s.guest.hosts : [];
      const pr = safe(() => UI.peer(s), null);
      const g = s.guest || {};
      const wait = !c && (!!notFailed(s.pairing) || !!notFailed(g.pairing) || /connecting/.test((g.status && g.status.state) || ''));
      if (c && c.os === 'android') list.push({ kind: 'phone', key: 'phone:session', name: c.name || 'Phone', live: true, rtt: c.rttMs, battery: ph.info && ph.info.battery, charging: ph.info && ph.info.charging });
      else if (c || paired.length || hosts.length || wait) {
        const name = (c && c.name) || (pr && pr.name && pr.name !== 'the other computer' ? pr.name : '') || 'The other computer';
        list.push({ kind: 'pc', key: 'pc', name, os: (c && c.os) || (pr && pr.os) || 'win', live: !!c, wait, rtt: c && c.rttMs, paired: !!(paired.length || hosts.length) });
      }
    }
    const nearby = Array.isArray(ph.nearby) ? ph.nearby.slice() : Array.isArray(ph.phones) ? ph.phones.slice() : [];
    // The connected phone even when the nearby list doesn't carry it.
    if (ph.connected && ph.connected.id && !nearby.some((d) => d && d.id === ph.connected.id)) nearby.unshift({ id: ph.connected.id, name: ph.connected.name || (ph.info && ph.info.name) || 'Phone', connected: true });
    for (const d of nearby) {
      if (!d || list.some((x) => x.kind === 'phone' && (x.name === d.name || (x.id && x.id === d.id)))) continue;
      const on = !!(d.connected || (ph.connected && ph.connected.id === d.id));
      list.push(Object.assign({
        kind: 'phone', key: 'ph:' + d.id, id: d.id, name: d.name || 'Phone', live: on,
        wait: !!(ph.connecting && ph.connecting.id === d.id), usb: !!(d.usb || (on && ph.connected && ph.connected.usb)),
      }, phoneNums(ph, d.id, on)));
    }
    return list;
  }

  // Which card a page's switch goes on: what this computer gives, what the other computer does,
  // the phone's own things; Camera and ReZume follow whichever device is live.
  const ME_IDS = ['pc-mac', 'share', 'cursor', 'keyboard', 'clipboard', 'notifications', 'audio'];
  const PC_IDS = ['mac-pc', 'receive', 'apps', 'terminal'];
  const PHONE_IDS = ['mirror', 'calls', 'messages', 'media', 'pfiles', 'mount', 'remote', 'papps'];
  const FOLLOW_IDS = ['camera', 'rezume'];
  const COLORS = ['#ff3d9a', '#8a5cff', '#2fd6ff', '#3dffa8', '#ffb340'];
  const FREE = () => (window.FeatureArt && FeatureArt.FREE) || [];

  const masterDefs = () => UI.tabs.filter((d) => d && d.master && !d.navHidden && typeof d.master.get === 'function');
  const visible = (d, s) => !(d.hidden && safe(() => d.hidden(s), false));
  // The shells' "limited" rule (renderPage): macOnly pages are off and locked with a peer that can't do them.
  function limitedOf(def, s) {
    if (!def.macOnly || !s || !s.peer) return '';
    if (def.macOnly === 'linux') return s.peer.os === 'linux' ? 'not with Linux yet' : '';
    const l = safe(() => UI.peer(s).limited, '');
    return l ? 'not with this device' : '';
  }
  function featState(def, s) {
    const lim = limitedOf(def, s);
    if (lim) return { on: false, dis: true, why: lim };
    const on = !!safe(() => def.master.get(s), false);
    const dd = def.master.disabled;
    let dis = !!safe(() => (typeof dd === 'function' ? dd(s) : dd), false);
    let why = dis ? 'not available now' : '';
    if (!dis && document.body.classList.contains('no-peer') && !FREE().includes(def.id)) { dis = true; why = 'needs a connected device'; }
    return { on, dis, why };
  }

  // A phone's own pages, as buttons that open them (most have no on/off switch).
  const PHONE_LINKS = ['mirror', 'notifications', 'messages', 'pfiles', 'media', 'camera'];
  function assign(s, devs) {
    const cards = devs.map((d) => ({ dev: d, feats: [], links: [] }));
    const me = cards[0];
    const peers = cards.filter((c) => c.dev.kind !== 'me');
    const pcs = peers.filter((c) => c.dev.kind === 'pc');
    const phones = peers.filter((c) => c.dev.kind === 'phone');
    const pick = (arr) => arr.find((c) => c.dev.selected) || arr.find((c) => c.dev.live) || arr[0];
    for (const def of masterDefs()) {
      if (!visible(def, s)) continue;
      let card;
      if (ME_IDS.includes(def.id)) card = me;
      else if (PC_IDS.includes(def.id)) card = pick(pcs);
      else if (PHONE_IDS.includes(def.id)) card = pick(phones.filter((c) => c.dev.live)) || pick(phones);
      else if (FOLLOW_IDS.includes(def.id)) card = peers.find((c) => c.dev.live) || pick(peers) || me;
      else card = me;
      if (card) card.feats.push(def);
    }
    for (const c of phones) {
      const have = new Set(c.feats.map((d) => d.id));
      for (const id of PHONE_LINKS) {
        if (c.links.length + c.feats.length >= 6) break;
        const def = UI.tabs.find((d) => d && d.id === id && !d.navHidden);
        if (def && !have.has(id)) c.links.push(def);
      }
    }
    return cards;
  }

  // ======================================================================
  // Home dashboard
  // ======================================================================
  const greet = h('small');
  const hello = h('div', 'au-hello', [greet, h('h1', null, ['What should your ', h('span', null, null, { text: 'desks' }), ' do?'])]);
  const devsEl = h('div', 'au-devs');
  const subEl = h('div', 'au-sub');
  const home = h('section', 'au-home', [hello, devsEl, subEl], { attrs: { 'aria-label': 'Home' } });
  let hostPage = null;
  let cardsKey = '';
  let cardRefs = [];

  function firstPageId() {
    for (const li of nav.children) {
      if (li.hidden) continue;
      const b = li.querySelector('.nav-item');
      if (b) return idOf(b);
    }
    return 'connection';
  }
  function placeHome() {
    const id = firstPageId();
    const page = $('page-' + id);
    if (!page) return;
    if (hostPage !== page) {
      if (hostPage) hostPage.classList.remove('au-host', 'au-nohead');
      hostPage = page;
      const head = page.querySelector(':scope > .page-head');
      if (head) head.after(home); else page.prepend(home);
      page.classList.add('au-host');
      page.classList.toggle('au-nohead', !(head && head.querySelector('.switch')));
    }
    // What follows the cards: the open device's own page (Overview), or Connection's pairing and nearby list.
    const btn = nav.querySelector('[aria-controls="page-' + id + '"] .label');
    const live = id === 'overview' && last ? liveOne(devicesOf(last)) : null;
    subEl.textContent = live ? 'More on ' + live.name : btn ? btn.textContent : id;
  }

  function flash(card) {
    card.classList.add('flash');
    clearTimeout(card._flashT);
    card._flashT = setTimeout(() => card.classList.remove('flash'), 1600);
  }

  // Mesh: a device is picked the way its sidebar tile picks it (select it, then open its sections once the
  // selection arrives; a phone nearby connects; an offline one can't be picked): clicking the tile does
  // exactly that. Mac mesh calls the selector selectPeer, Windows/Linux mesh setActivePeer.
  const selectPeer = api.setActivePeer || api.selectPeer;
  const tileOf = (d) => (d && d.id ? [...document.querySelectorAll('#phones > .phone-tile')].find((b) => b.dataset.id === String(d.id)) : null);
  function openDevice(d) {
    if (d.kind === 'me') return UI.go('general');
    if (d.mesh) {
      const tile = tileOf(d);
      if (d.action === 'none' || (!d.live && d.kind === 'pc')) return UI.go('connection');
      if (tile && tile.getAttribute('aria-disabled') !== 'true') return tile.click();
      if (d.action === 'connect' && d.id) return call('connectPhone', d.id);
      if (d.live && !d.selected && d.id && typeof selectPeer === 'function') { Promise.resolve(selectPeer(d.id)).catch(() => {}); return setTimeout(() => UI.go('overview'), 600); }
      return UI.go(d.live ? 'overview' : 'connection');
    }
    if (d.live) return UI.go('overview');
    if (d.kind === 'phone' && d.id) return call('connectPhone', d.id);
    return UI.go('connection');
  }

  // The live card that a device's own features (and page links) act on: the selected one, else the only live one.
  function isTarget(dev, s) {
    if (!dev.live) return false;
    if (dev.kind === 'me') return true;
    if (dev.selected) return true;
    const same = devicesOf(s).filter((d) => d.kind === dev.kind && d.live);
    return same.length === 1 && !same.some((d) => d.selected) && !(dev.mesh && dev.kind === 'pc');
  }
  const canQr = () => typeof api.qrPair === 'function' && !!document.getElementById('page-connection');

  function buildCards(cards) {
    cardRefs = [];
    const els = cards.map(({ dev, feats, links }) => {
      const st = h('span', 'au-st');
      const name = h('b', null, null, { text: dev.name });
      const sub = h('small');
      const kindIcon = dev.kind === 'phone' ? 'ph' : (dev.os === 'mac' ? 'lap' : 'scr');
      const head = h(dev.kind === 'me' ? 'div' : 'button', 'au-h', [h('span', 'au-ic', [icon(kindIcon)]), h('div', 'au-n', [name, sub]), st]);
      if (dev.kind !== 'me') { head.type = 'button'; head.onclick = () => openDevice(cardRefs.find((r) => r.card === card).dev); }
      const num = h('div', 'au-ms');
      const row = h('div', 'au-feats');
      const card = h('div', 'au-dev', [h('div', 'au-ring', [h('i')], { attrs: { 'aria-hidden': 'true' } }), h('div', 'au-glow'), head, num, row]);
      card.dataset.dev = dev.key;
      const fts = feats.map((def, i) => {
        const b = h('button', 'au-ft', [safe(() => UI.icon(def.icon || def.id), null)], { type: 'button', attrs: { 'aria-label': def.title } });
        b.style.setProperty('--c', COLORS[i % COLORS.length]);
        b.onclick = () => {
          const s = UI.state || last;
          if (!s) return;
          const fs = featState(def, s);
          if (fs.dis) { UI.go(def.id); return; }
          Promise.resolve(safe(() => def.master.set(!fs.on))).catch(() => {});
          b.classList.toggle('on', !fs.on);
          flash(card);
        };
        return { def, b };
      });
      const lks = (links || []).map((def, i) => {
        const b = h('button', 'au-ft au-lk', [safe(() => UI.icon(def.icon || def.id), null)], { type: 'button', attrs: { 'aria-label': 'Open ' + def.title } });
        b.style.setProperty('--c', COLORS[(fts.length + i) % COLORS.length]);
        b.onclick = () => {
          const s = UI.state || last;
          const r = cardRefs.find((x) => x.card === card);
          const d = r ? r.dev : dev;
          if (s && isTarget(d, s) && visible(def, s)) UI.go(def.id);
          else openDevice(d);
        };
        return { def, b, link: true };
      });
      row.append(...fts.map((f) => f.b), ...lks.map((f) => f.b));
      let empty = null;
      if (!fts.length && !lks.length) {
        empty = h('div', 'au-empty');
        row.append(empty);
      }
      cardRefs.push({ dev, card, head, st, sub, num, fts, lks, empty });
      return card;
    });
    if (cards.length < 2) { // nothing paired yet: the way to add one
      const acts = [];
      if (canQr()) {
        const qr = h('button', 'btn small primary', null, { text: 'Pair a phone', type: 'button' });
        qr.onclick = () => run('Pair a phone with a QR code');
        acts.push(qr);
      }
      const find = h('button', 'btn small' + (acts.length ? '' : ' primary'), null, { text: 'Find nearby', type: 'button' });
      find.onclick = () => run('Refresh nearby devices');
      acts.push(find);
      els.push(h('div', 'au-dev au-add', [
        h('div', 'au-h', [h('span', 'au-ic', [icon('plus')]), h('div', 'au-n', [h('b', null, null, { text: 'Add a device' }), h('small', null, null, { text: 'Another computer or a phone' })])]),
        h('div', 'au-acts', acts),
      ]));
    }
    devsEl.replaceChildren(...els);
  }

  function setNum(el, n, unit) {
    if (el._n === n + '|' + unit) return;
    el._n = n + '|' + unit;
    el.replaceChildren(String(n), unit ? h('small', null, null, { text: unit }) : '');
  }

  function updateCards(s, cards) {
    for (const r of cardRefs) {
      const c = cards.find((x) => x.dev.key === r.dev.key);
      const d = c ? c.dev : r.dev;
      r.dev = d;
      r.card.classList.toggle('live', !!d.live);
      r.card.classList.toggle('wait', !d.live && !!d.wait);
      let onCount = 0;
      for (const f of r.fts) {
        const fs = featState(f.def, s);
        if (fs.on) onCount++;
        const tip = f.def.title + ' · ' + (fs.on ? 'on' : 'off') + (fs.dis ? ' · ' + fs.why : '');
        f.b.classList.toggle('on', fs.on);
        f.b.classList.toggle('dis', fs.dis);
        f.b.dataset.tip = tip;
        f.b.setAttribute('aria-pressed', fs.on ? 'true' : 'false');
        f.b.setAttribute('aria-disabled', fs.dis ? 'true' : 'false');
        f.b.setAttribute('aria-description', tip + (fs.dis ? ' (opens its page)' : ''));
      }
      const tgt = isTarget(d, s);
      for (const f of r.lks) {
        const ok = tgt && visible(f.def, s);
        f.b.classList.toggle('dis', !ok);
        const tip = ok ? 'Open ' + f.def.title : f.def.title + ' · ' + (d.live ? 'select ' + d.name + ' first' : 'connect ' + d.name + ' first');
        f.b.dataset.tip = tip;
        f.b.setAttribute('aria-description', tip);
      }
      r.head.title = d.kind === 'me' ? '' : d.live ? (tgt ? 'Open ' + d.name : 'Select ' + d.name) : d.action === 'none' || d.kind === 'pc' ? 'Open Connection' : 'Connect to ' + d.name;
      const via = d.usb ? 'USB' : viaOf(s);
      if (d.kind === 'me') {
        r.sub.textContent = 'this desk · ' + OS_NAME[OS];
        const screens = safe(() => (s.pcScreen && s.pcScreen.monitors && s.pcScreen.monitors.length) || (Array.isArray(s.displays) && s.displays.length)
          || (s.sharing && Array.isArray(s.sharing.displays) && s.sharing.displays.filter((x) => x && !x.virtual).length) || 0, 0);
        if (screens) setNum(r.num, screens, screens === 1 ? 'screen' : 'screens');
        else setNum(r.num, onCount, 'on');
      } else if (d.kind === 'pc') {
        r.sub.textContent = d.live ? (OS_NAME[d.os] || 'Computer') + ' · ' + via : d.wait ? 'Connecting…' : 'Paired · offline';
        if (d.live && d.rtt != null) setNum(r.num, d.rtt, 'ms');
        else setNum(r.num, d.live ? 'Live' : '—', d.live ? '' : d.wait ? 'connecting' : 'offline');
      } else {
        r.sub.textContent = d.live ? via + (d.rtt != null ? ' · ' + d.rtt + ' ms' : '') : d.wait ? 'Connecting…' : 'Nearby · click to connect';
        if (d.live && d.battery != null) setNum(r.num, d.battery, '% battery' + (d.charging ? ' ⚡' : ''));
        else if (d.live && d.rtt != null) setNum(r.num, d.rtt, 'ms');
        else setNum(r.num, '—', d.wait ? 'connecting' : 'nearby');
      }
      if (r.empty) r.empty.textContent = d.live ? (tgt ? 'Everything is on its own pages' : 'Select it to use its features') : d.kind === 'phone' ? 'Connect it to use its features' : 'Connect to use its features';
    }
  }

  function renderHome(s) {
    const hr = new Date().getHours();
    greet.textContent = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    placeHome();
    const cards = assign(s, devicesOf(s));
    const key = JSON.stringify(cards.map((c) => [c.dev.key, c.dev.kind, c.dev.name, c.dev.os, c.feats.map((d) => d.id), c.links.map((d) => d.id)]));
    if (key !== cardsKey) { cardsKey = key; buildCards(cards); }
    updateCards(s, cards);
  }

  // ======================================================================
  // Top bar + "this desk" from the state
  // ======================================================================
  function liveOne(devs) {
    const peers = devs.filter((d) => d.kind !== 'me');
    return peers.find((d) => d.live && d.selected) || peers.find((d) => d.live);
  }
  function renderBar(s, devs) {
    const live = liveOne(devs);
    if (live) {
      peerDot.className = 'au-dot good';
      peerTxt.replaceChildren(live.name + (live.rtt != null ? ' · ' : ''), live.rtt != null ? h('b', null, null, { text: live.rtt + ' ms' }) : '');
      const via = live.usb ? 'USB' : viaOf(s);
      routeIc.replaceChildren(icon(via === 'USB' ? 'usb' : via === 'Bluetooth' ? 'bt' : 'wifi'));
      routeTxt.textContent = via;
    } else {
      const dot = $('peer-dot');
      const cls = dot ? dot.className : '';
      peerDot.className = 'au-dot' + (/\bbad\b/.test(cls) ? ' bad' : /\b(warn|good)\b/.test(cls) ? ' warn' : '');
      const t = $('peer-text');
      peerTxt.textContent = (t && t.textContent) || 'Not paired';
    }
    routePill.hidden = !live;
    secPill.hidden = !live;
    meName.textContent = devs[0].name;
    meSub.textContent = 'this desk · ' + OS_NAME[OS];
    meCard.title = s.version ? 'DenaDesk ' + s.version : '';
  }
  let lastActive = null;
  function renderTitle() {
    const active = nav.querySelector('.nav-item.active .label') || nav.querySelector('.nav-item[aria-selected="true"] .label');
    let title = active ? active.textContent : '';
    if (!title) {
      const vis = document.querySelector('#pages > .page:not([hidden]) .page-head h1 span');
      title = vis ? vis.textContent : '';
    }
    // The section's own name (the first one hosts Home: same name as in the sidebar), "Set up" over setup.
    const setup = isSetup();
    html.classList.toggle('au-setup', setup);
    const key = setup ? 'Set up' : title || 'DenaDesk';
    if (crumb._k !== key) {
      crumb._k = key;
      crumb.replaceChildren(h('span', null, null, { text: 'DenaDesk' }), h('i', null, null, { text: '/' }), h('b', null, null, { text: key }));
    }
    // The open section stays in sight in the sidebar's scrolling column.
    const btn = active && active.closest('.nav-item');
    const col = btn && btn.closest('.au-scroll, #side-scroll');
    if (col && btn !== lastActive) {
      lastActive = btn;
      const a = btn.getBoundingClientRect();
      const c = col.getBoundingClientRect();
      if (a.top < c.top || a.bottom > c.bottom - 24) btn.scrollIntoView({ block: 'center' });
    }
    dockChips();
  }

  // ======================================================================
  // Command bar
  // ======================================================================
  const inp = h('input', 'au-inp', null, { type: 'text', placeholder: 'Ask DenaDesk anything…', spellcheck: false, autocomplete: 'off', attrs: { 'aria-label': 'Ask DenaDesk', enterkeyhint: 'send' } });
  const attach = h('button', 'au-cb', [icon('plus')], { type: 'button', title: 'Send files…', attrs: { 'aria-label': 'Send files' } });
  const agentName = h('span', null, null, { text: 'All devices' });
  const agent = h('button', 'au-agent', [agentName, icon('chev')], { type: 'button', title: 'Which device', attrs: { 'aria-haspopup': 'menu' } });
  const send = h('button', 'au-cb send', [icon('up')], { type: 'button', title: 'Send (Enter)', attrs: { 'aria-label': 'Send' } });
  const idle = h('div', 'au-layer au-idle', [inp, h('div', 'au-row', [attach, h('span', 'au-sp'), agent, send])]);
  const tx = h('div', 'au-tx', null, { attrs: { 'aria-live': 'polite' } });
  const res = h('div', 'au-res', null, { attrs: { role: 'list', 'aria-live': 'polite' } });
  const agent2Name = h('span', null, null, { text: 'All devices' });
  const agent2 = h('button', 'au-agent', [agent2Name, icon('chev')], { type: 'button', title: 'Which device', attrs: { 'aria-haspopup': 'menu' } });
  const again = h('button', 'au-cb', [icon('plus')], { type: 'button', title: 'Ask something else (' + MOD + '+K)', attrs: { 'aria-label': 'Ask something else' } });
  const close = h('button', 'au-cb', [icon('x')], { type: 'button', title: 'Close (Esc)', attrs: { 'aria-label': 'Close' } });
  const exp = h('div', 'au-layer au-exp off', [tx, res, h('div', 'au-row', [agent2, h('span', 'au-sp'), again, close])]);
  const cmd = h('div', 'au-cmd', [h('div', 'au-aur', [h('i'), h('i')], { attrs: { 'aria-hidden': 'true' } }), idle, exp]);
  const sugs = h('div', 'au-sugs');
  const dock = h('div', 'au-dock', [sugs, h('div', 'au-halo-w', [h('div', 'au-halo')], { attrs: { 'aria-hidden': 'true' } }), cmd], { attrs: { role: 'search', 'aria-label': 'Ask DenaDesk' } });
  content.append(dock);

  let state = 'idle';
  let focused = false;
  let runId = 0;
  let target = 'all';
  let last = null;
  let busy = false; // a request's steps are running

  // Aurora amplitude: brighter on focus, a jump with each key, high while working. The loop runs only
  // while the value is easing to its goal, then stops (the idle breathing and the 'working' pulse are
  // CSS keyframes on transform/opacity: .au-halo, .au-cmd.busy .au-aur).
  let amp = 0.3;
  let raf = 0;
  const goalAmp = () => (busy ? 0.75 : state === 'exp' ? 0.6 : focused ? 0.55 : 0.3);
  const kick = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); };
  function tick() {
    raf = 0;
    const goal = goalAmp();
    amp += (goal - amp) * 0.1;
    if (Math.abs(goal - amp) <= 0.004) amp = goal;
    dock.style.setProperty('--au-amp', amp.toFixed(3));
    if (amp !== goal) kick();
  }
  const setBusy = (b) => { busy = b; cmd.classList.toggle('busy', b); kick(); };
  inp.addEventListener('focus', () => { focused = true; kick(); dockChips(); });
  inp.addEventListener('blur', () => { focused = false; kick(); setTimeout(dockChips, 150); });
  inp.addEventListener('input', () => { amp = Math.min(1, amp + 0.15); kick(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); inp.blur(); }
  });
  send.onclick = submit;
  attach.onclick = () => run('Send files');
  close.onclick = collapse;
  again.onclick = () => { collapse(); inp.focus(); };

  function setState(s) {
    state = s;
    cmd.classList.toggle('exp', s === 'exp');
    idle.classList.toggle('off', s !== 'idle');
    exp.classList.toggle('off', s !== 'exp');
    idle.inert = s !== 'idle'; // a layer out of sight takes no focus
    exp.inert = s !== 'exp';
    if (s === 'idle') cmd.style.removeProperty('--h');
    dockChips();
    kick();
  }
  function collapse() {
    runId++;
    clearTimeout(autoT);
    closeMenu();
    setBusy(false);
    setState('idle');
  }
  // Done and left alone: the card folds back by itself after a while (not while it has the focus or the mouse).
  let autoT = 0;
  function autoCollapse() {
    clearTimeout(autoT);
    autoT = setTimeout(() => {
      if (state !== 'exp' || busy) return;
      if (cmd.matches(':hover') || cmd.contains(document.activeElement)) return autoCollapse();
      collapse();
    }, 12000);
  }
  function submit() {
    const v = inp.value.trim();
    if (!v) { inp.focus(); return; }
    inp.value = '';
    run(v);
  }
  // The open card grows to fit what it shows (CSSOM: the CSP allows no inline style attributes).
  function sizeCard() {
    if (state !== 'exp') return;
    const resTop = tx.offsetTop + tx.offsetHeight + 18;
    res.style.setProperty('top', resTop + 'px');
    let need = resTop + res.scrollHeight + 64;
    const room = content.clientHeight - topbar.offsetHeight - 40;
    const cap = content.clientHeight < 560 ? 220 : 460; // a small window keeps most of the page in sight
    need = Math.max(Math.min(190, room), Math.min(need, room, cap));
    cmd.style.setProperty('--h', need + 'px');
  }

  // Suggestion chips above the bar: from what this window can really do right now.
  function suggestions(s) {
    const out = [];
    if (!s) return out;
    const linked = linkedOf(s);
    if (!linked) {
      if (canQr()) out.push('Pair a phone with a QR code');
      out.push('Refresh nearby devices');
      const pc = devicesOf(s).find((d) => d.kind === 'pc' && !d.live);
      if (pc) out.push('Reconnect to ' + pc.name);
      out.push('Open General settings');
      return out.slice(0, 4);
    }
    for (const def of masterDefs()) {
      if (!visible(def, s)) continue;
      const fs = featState(def, s);
      if (!fs.on && !fs.dis) out.push('Turn on ' + def.title.toLowerCase());
      if (out.length >= 2) break;
    }
    if (s.files ? s.files.dropToMac !== false : true) out.push('Send files');
    out.push('Open clipboard');
    return out.slice(0, 4);
  }
  let sugKey = '';
  function dockChips() {
    const onHome = hostPage && !hostPage.hidden;
    const show = state === 'idle' && !isSetup() && (focused || (onHome && content.clientHeight >= 680));
    dock.classList.toggle('chips', !!show);
    sugs.inert = !show;
    const list = suggestions(UI.state || last);
    const key = list.join('|');
    if (key === sugKey) return;
    sugKey = key;
    sugs.replaceChildren(...list.map((t) => {
      const b = h('button', 'au-sug', null, { text: t, type: 'button' });
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input's focus (and the chips)
      b.onclick = () => { inp.value = ''; run(t); };
      return b;
    }));
  }

  // Target menu: all devices, or one of them.
  let menu = null;
  let menuOpener = null;
  function closeMenu(refocus) {
    if (!menu) return;
    menu.remove();
    menu = null;
    if (refocus && menuOpener && !menuOpener.closest('[inert]')) menuOpener.focus();
    menuOpener = null;
  }
  function openMenu(btn) {
    if (menu) { closeMenu(); return; }
    menuOpener = btn;
    const s = UI.state || last;
    const devs = s ? devicesOf(s) : [];
    const items = [{ key: 'all', name: 'All devices', kind: '' }].concat(devs.map((d) => ({ key: d.key, name: d.kind === 'me' ? d.name + ' (this desk)' : d.name, kind: d.kind === 'me' ? '' : d.kind === 'phone' ? 'phone' : d.live ? 'live' : 'offline' })));
    menu = h('div', 'au-menu', items.map((it) => {
      const b = h('button', it.key === target ? 'sel' : '', [h('span', null, null, { text: it.name }), it.kind ? h('small', null, null, { text: it.kind }) : null], { type: 'button', attrs: { role: 'menuitem' } });
      b.onclick = (e) => { e.stopPropagation(); target = it.key; setTargetLabel(); closeMenu(); inp.focus(); };
      return b;
    }), { attrs: { role: 'menu' } });
    dock.append(menu);
    const d = dock.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    menu.style.setProperty('left', Math.max(8, Math.min(r.left - d.left, d.width - menu.offsetWidth - 8)) + 'px');
    menu.style.setProperty('bottom', (d.bottom - r.top + 8) + 'px');
    const first = menu.querySelector('button.sel') || menu.querySelector('button');
    if (first) first.focus();
  }
  function targetDev() {
    if (target === 'all') return null;
    const s = UI.state || last;
    return s ? devicesOf(s).find((d) => d.key === target) || null : null;
  }
  function setTargetLabel() {
    const d = targetDev();
    if (!d) target = 'all';
    const t = d ? d.name : 'All devices';
    agentName.textContent = t;
    agent2Name.textContent = t;
  }
  agent.onclick = (e) => { e.stopPropagation(); openMenu(agent); };
  agent2.onclick = (e) => { e.stopPropagation(); openMenu(agent2); };
  document.addEventListener('click', (e) => { if (menu && !menu.contains(e.target)) closeMenu(); });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key && e.key.toLowerCase() === 'k') {
      if (document.querySelector('.keyrec.on, .btn.keyrec.on')) return; // a shortcut is being recorded
      if (isSetup()) return;
      e.preventDefault();
      if (state === 'exp') collapse();
      inp.focus();
      inp.select();
    } else if (e.key === 'Escape') {
      if (menu) { closeMenu(true); e.preventDefault(); return; }
      if (state !== 'exp' || e.defaultPrevented) return;
      // Escape meant for something else: a dialog or popup, or a field on the page.
      if (document.querySelector('.updater-overlay:not([hidden]), .pair-pop:not([hidden]), .pairpop:not([hidden]), dialog[open]')) return;
      const a = document.activeElement;
      if (a && a !== document.body && !dock.contains(a)) return;
      collapse();
      e.preventDefault();
    }
  });
  // Moving on through the sidebar folds the card away.
  sidebar.addEventListener('click', (e) => { if (state === 'exp' && !busy && e.target.closest('.nav-item, .phone-tile')) collapse(); });
  kbd.onclick = () => { if (state === 'exp') collapse(); inp.focus(); };

  // ---------- understanding a request: real actions only ----------
  const SYN = {
    overview: ['overview', 'home', 'dashboard', 'device page', 'battery'],
    connection: ['connection', 'connections', 'pairing', 'devices', 'nearby', 'paired'],
    'pc-mac': ['share screen', 'share my screen', 'extend my screen', 'extend', 'second screen', 'second monitor', 'my screen', 'screen sharing'],
    share: ['share screen', 'share my screen', 'extend my screen', 'extend', 'second screen', 'second monitor', 'my screen', 'screen sharing'],
    'mac-pc': ['receive screen', 'their screen', 'see screen', 'watch screen', 'remote screen', 'other screen', 'receive'],
    receive: ['receive screen', 'their screen', 'see screen', 'watch screen', 'remote screen', 'other screen', 'receive'],
    cursor: ['mouse', 'cursor', 'pointer', 'trackpad', 'kvm'],
    keyboard: ['keyboard', 'keys', 'typing', 'hotkey'],
    clipboard: ['clipboard', 'copy', 'paste', 'copied'],
    notifications: ['notifications', 'notification', 'alerts', 'notifs'],
    files: ['files', 'file sharing', 'file', 'shared folder', 'received files'],
    audio: ['audio', 'sound', 'speakers', 'music', 'volume'],
    camera: ['camera', 'webcam', 'cam', 'video'],
    rezume: ['rezume', 'resume', 'handoff', 'hand off', 'continue'],
    terminal: ['terminal', 'shell', 'ssh', 'console', 'command line'],
    apps: ['apps', 'applications', 'programs', 'app windows'],
    general: ['general', 'settings', 'preferences', 'startup', 'options', 'firewall'],
    about: ['about', 'version', 'updates', 'update', 'licence', 'license'],
    tip: ['tip', 'tips', 'donate', 'donation', 'support duodesk', 'sponsor'],
    feedback: ['feedback', 'report a bug', 'bug report', 'contact', 'suggestion'],
    multi: ['multi device', 'multidevice', 'mesh', 'multiple devices'],
    messages: ['messages', 'sms', 'texts', 'chats'],
    calls: ['calls', 'call', 'dial', 'phone call'],
    media: ['photos', 'gallery', 'pictures', 'images'],
    papps: ['phone apps'],
    mirror: ['mirror phone', 'phone screen', 'mirroring', 'mirror my phone', 'mirror'],
    pfiles: ['phone files', 'phone storage'],
    mount: ['mount', 'mount phone', 'phone drive'],
    remote: ['remote', 'gamepad', 'remote control'],
    phone: ['phone'],
  };
  // Words that name a page only when nothing more specific is said ("mouse settings" is Mouse).
  const WEAK = new Set(['settings', 'options', 'preferences', 'update', 'continue', 'file', 'call', 'receive', 'extend', 'mirror', 'video', 'copy', 'text', 'keys', 'devices', 'my screen']);
  const norm = (t) => ' ' + String(t).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9.:\-]+/g, ' ').trim() + ' ';
  const words = (t) => norm(t).trim().split(' ').filter(Boolean);
  function near(a, b) { // one edit apart (typos), for words of 4+ letters
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return a.length >= 4 && b.startsWith(a);
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  function bestPage(text, s, prefer) {
    const t = norm(text);
    const tw = words(text);
    let best = null;
    for (const def of UI.tabs) {
      if (!def || !def.id) continue;
      const cands = [def.title, def.heading && !/[{]/.test(def.heading) ? def.heading : null, def.id].concat(SYN[def.id] || []).filter(Boolean);
      let score = 0;
      for (const c of cands) {
        const cn = norm(c);
        if (t.includes(cn)) { score = Math.max(score, WEAK.has(cn.trim()) ? 5 : 10 + cn.length); continue; }
        const cw = words(c);
        const hit = cw.filter((w) => tw.some((x) => near(x, w))).length;
        if (hit) score = Math.max(score, (hit / cw.length) * 6 + hit);
      }
      if (!score) continue;
      if (s && !visible(def, s)) score -= 3; // a page that isn't there with this device: only if nothing else fits
      if (prefer && prefer.includes(def.id)) score += 2;
      if (def.navHidden) score -= 1;
      if (!best || score > best.score) best = { def, score };
    }
    return best;
  }

  const ADDR = /\b(\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?|[a-z0-9-]+\.(?:local|lan|home)(?::\d{1,5})?)\b/i;
  const ADDR_ONLY = /^\s*(\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?|[a-z0-9-]+\.(?:local|lan|home)(?::\d{1,5})?)\s*$/i;
  // "don't share the clipboard", "no more mouse", "never sync…": a negation means off, whatever the verb.
  const NEG = /\b(dont|do not|never|no|not|without)\b/;
  const VERB_OFF = /\b(turn|switch|set)\s+(it\s+|them\s+|that\s+)?off\b|\b(turn|switch)\s+\w+(\s+\w+)?\s+off\b|\bdisable\b|\bstop\b|\bdeactivate\b|\bpause\b|\boff\b|\bno more\b/;
  const VERB_ON = /\b(turn|switch|set)\s+(it\s+|them\s+|that\s+)?on\b|\b(turn|switch)\s+\w+(\s+\w+)?\s+on\b|\benable\b|\bstart\b|\bactivate\b|\bsync\b|\bshare\b|\bextend\b|\buse\b|\bon\b/;
  const VERB_OPEN = /\b(open|show|go to|goto|go|view|navigate|take me|settings for|where)\b/;

  function plan(text, s) {
    const steps = [];
    const dev = targetDev();
    const prefer = dev ? (assign(s, devicesOf(s)).find((c) => c.dev.key === dev.key) || { feats: [] }).feats.map((d) => d.id) : null;
    const clauses = text.split(/\s*(?:,|;|\.\s+|\band then\b|\bthen\b|\balso\b|\band\b|&|\+)\s*/i).map((c) => c.trim()).filter(Boolean);
    let verb = null; // carried to the next clause: "turn on mouse and keyboard"
    for (const raw of clauses) {
      const t = norm(raw);
      // An address only with a verb that means it ("update to 2.5.0.1" is no address), or on its own.
      const addr = raw.match(ADDR_ONLY) || (/\b(connect|pair|link|join|add|reach)\b/.test(t) ? raw.match(ADDR) : null);
      if (addr) { steps.push(stepConnect(addr[1])); continue; }
      if (/\b(refresh|rescan|re scan|scan|search|look for|find)\b/.test(t) && !/\b(file|photo|message)/.test(t)) { steps.push(stepRefresh()); continue; }
      if (/\bqr\b/.test(t) || (/\b(pair|add|link|set up)\b/.test(t) && /\b(phone|android|mobile)\b/.test(t))) { steps.push(stepPairPhone()); continue; }
      if (/\bdisconnect\b|\bunlink\b/.test(t)) { steps.push(stepDisconnect(s)); continue; }
      if (/\bsend\b/.test(t) && (/\b(files?|photos?|documents?|pictures?|pdf|it|something)\b/.test(t) || /\.\w{2,4}\b/.test(raw) || t.trim() === 'send')) { steps.push(stepSendFiles(s)); continue; }
      if (/\b(reconnect|take over|connect again)\b/.test(t) || (/\b(connect|switch to|use)\b/.test(t) && matchDevice(t, s))) {
        const d = matchDevice(t, s) || (dev && dev.kind !== 'me' ? dev : null);
        steps.push(stepConnectDevice(d, s));
        continue;
      }
      const off = NEG.test(t) || VERB_OFF.test(t);
      const on = !off && VERB_ON.test(t);
      const open = VERB_OPEN.test(t);
      let v = off ? false : on ? true : open ? null : verb;
      const best = bestPage(raw, s, prefer);
      if (!best || best.score < 3) {
        if (/\b(connect|pair)\b/.test(t)) { steps.push(stepOpen(s, UI.tabs.find((d) => d.id === 'connection'), 'Opening Connection to pick a device')); continue; }
        steps.push(stepHint());
        continue;
      }
      const def = best.def;
      if (open && !off && !/\b(turn|switch)\b/.test(t)) v = null;
      verb = v;
      if (v !== null && def.master) steps.push(stepToggle(def, v, s));
      else if (v !== null) steps.push(stepOpen(s, def, def.title + ' has no switch: opening it'));
      else steps.push(stepOpen(s, def));
    }
    if (!steps.length) steps.push(stepHint());
    return steps;
  }

  function matchDevice(t, s) {
    if (!s) return null;
    for (const d of devicesOf(s)) {
      if (d.kind === 'me') continue;
      const n = norm(d.name).trim();
      if (n && (t.includes(' ' + n + ' ') || words(d.name).some((w) => w.length >= 4 && words(t).includes(w)))) return d;
    }
    return null;
  }

  function stepHint() {
    return { hint: true, label: 'Try “turn on clipboard”, “open mouse”, “connect 192.168.1.20”, “refresh” or “pair a phone”.' };
  }
  function stepOpen(s, def, label) {
    return {
      label: label || 'Opening ' + def.title,
      run: () => {
        if (s && !visible(def, s)) return { no: def.title + ' isn’t available with this device' };
        UI.go(def.id);
        return { ok: label || def.title + ' is open' };
      },
    };
  }
  function stepToggle(def, v, s) {
    return {
      label: (v ? 'Turning on ' : 'Turning off ') + def.title,
      run: async () => {
        const cur = UI.state || s;
        if (!visible(def, cur)) return { no: def.title + ' isn’t available with this device' };
        const fs = featState(def, cur);
        if (fs.on === v) return { info: def.title + ' was already ' + (v ? 'on' : 'off') };
        if (fs.dis) { UI.go(def.id); return { no: def.title + ' ' + fs.why + ': opened it' }; }
        await Promise.race([Promise.resolve(def.master.set(v)), wait(3000)]);
        const card = devsEl.querySelector('.au-ft[aria-label="' + def.title.replace(/"/g, '') + '"]');
        if (card) flash(card.closest('.au-dev'));
        return { ok: def.title + (v ? ' is on' : ' is off') };
      },
    };
  }
  function stepConnect(addr) {
    return {
      label: 'Connecting to ' + addr,
      run: async () => {
        UI.go('connection');
        let err = '';
        const attempt = (p) => Promise.race([Promise.resolve(p).then((r) => { if (r && typeof r.error === 'string') err = r.error; }, (e) => { err = (e && e.message) || 'That didn’t work'; }), wait(4000)]);
        if (typeof api.connectAddress === 'function') await attempt(api.connectAddress(addr));
        else if (typeof api.pairWith === 'function') await attempt(api.pairWith(addr));
        else if (typeof api.pair === 'function') await attempt(api.pair(addr));
        else return { no: 'Connecting by address isn’t available here' };
        await wait(250);
        const p = (UI.state || {}).pairing;
        if (p && p.phase === 'failed') return { no: p.error || 'Couldn’t reach ' + addr };
        if (err) return { no: err };
        return { ok: 'Asked ' + addr + ' to connect: follow it on Connection' };
      },
    };
  }
  function stepRefresh() {
    return {
      label: 'Looking for devices nearby',
      run: async () => {
        UI.go('connection');
        const f = api.refreshFound || api.refreshDiscovery;
        if (typeof f !== 'function') return { no: 'Refresh isn’t available here' };
        await Promise.race([Promise.resolve(f()).catch(() => {}), wait(2500)]);
        return { ok: 'Refreshed the nearby list' };
      },
    };
  }
  function stepPairPhone() {
    return {
      label: 'Showing the pairing QR code',
      run: async () => {
        if (!canQr()) { UI.go('connection'); return { info: 'Pair phones from Connection › Nearby' }; }
        UI.go('connection');
        await wait(120);
        const page = $('page-connection');
        const btn = page && [...page.querySelectorAll('button')].find((b) => /qr code/i.test(b.textContent) && !b.disabled && b.offsetParent);
        if (!btn) return { info: 'Pair a phone from Connection (the QR card shows while no phone is connected)' };
        btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (!/hide/i.test(btn.textContent)) btn.click();
        return { ok: 'Scan the code with the phone’s camera' };
      },
    };
  }
  function stepDisconnect(s) {
    return {
      label: 'Disconnecting',
      run: () => {
        if (!linkedOf(UI.state || s)) return { info: 'Nothing is connected' };
        if (isPhoneSession(s) || (s.phone && s.phone.connected && !(s.link && s.link.state === 'connected'))) call(s.phone && s.phone.connected ? 'disconnectPhone' : 'disconnect');
        else call('disconnect');
        return { ok: 'Disconnected' };
      },
    };
  }
  function stepSendFiles(s) {
    return {
      label: 'Choosing files to send',
      run: () => {
        if (!linkedOf(UI.state || s)) return { no: 'Connect a device first to send files' };
        if (typeof api.chooseSendFiles !== 'function') { UI.go('files'); return { info: 'Drop files on the Overview to send them' }; }
        api.chooseSendFiles();
        return { ok: 'Pick the files in the window that opened' };
      },
    };
  }
  function stepConnectDevice(d, s) {
    if (!d) return { label: 'Reconnecting', run: () => { if (typeof api.connectAgain === 'function') { api.connectAgain(); return { ok: 'Reconnecting to the paired computer' }; } UI.go('connection'); return { info: 'Pick a device on Connection' }; } };
    return {
      label: 'Connecting to ' + d.name,
      run: () => {
        if (d.live && d.mesh && !d.selected) { openDevice(d); return { ok: 'Switched to ' + d.name }; }
        if (d.live) { UI.go('overview'); return { info: d.name + ' is already connected' }; }
        if (d.kind === 'phone' && d.id && typeof api.connectPhone === 'function') { api.connectPhone(d.id); return { ok: 'Connecting to ' + d.name }; }
        if (d.mesh && d.kind === 'pc') { UI.go('connection'); return { info: d.name + ' isn’t connected: it joins by itself once it’s on, or from Connection' }; }
        if (d.kind === 'pc' && typeof api.connectAgain === 'function') { api.connectAgain(); return { ok: 'Connecting to ' + d.name }; }
        UI.go('connection');
        return { info: 'Connect ' + d.name + ' from Connection' };
      },
    };
  }

  async function run(text) {
    const id = ++runId;
    closeMenu();
    inp.blur();
    setState('exp');
    tx.replaceChildren();
    res.replaceChildren();
    sizeCard();
    const ws = text.split(/\s+/).filter(Boolean);
    const step = Math.max(45, Math.min(140, 1500 / ws.length));
    for (const w of ws) {
      if (id !== runId) return;
      const sp = h('span', 'ghost', null, { text: w });
      tx.append(sp);
      sizeCard();
      await wait(step);
      sp.className = '';
    }
    await wait(300);
    const s = UI.state || last;
    if (!s || id !== runId) return;
    setBusy(true);
    try { await runSteps(id, text, s); } finally { if (id === runId) { setBusy(false); autoCollapse(); } }
  }
  async function runSteps(id, text, s) {
    for (const st of plan(text, s)) {
      if (id !== runId) return;
      if (st.hint) {
        res.append(h('div', 'hint', [h('span', 'au-info', null, { text: 'i' }), h('span', null, null, { text: st.label })], { attrs: { role: 'listitem' } }));
        sizeCard();
        continue;
      }
      const mark = h('span', 'au-spin');
      const label = h('span', null, null, { text: st.label });
      res.append(h('div', null, [mark, label], { attrs: { role: 'listitem' } }));
      sizeCard();
      let r;
      try { r = await st.run(); } catch (e) { r = { no: (e && e.message) || 'That didn’t work' }; }
      await wait(420);
      if (id !== runId) return;
      r = r || { ok: st.label };
      const kind = r.no ? 'no' : r.info ? 'info' : 'ok';
      mark.className = 'au-' + kind;
      mark.textContent = kind === 'ok' ? '✓' : kind === 'no' ? '!' : 'i';
      label.textContent = r[kind] || st.label;
      sizeCard();
    }
  }

  // ======================================================================
  // Wiring: every state push, every page change
  // ======================================================================
  function onState(s) {
    if (!s) return;
    last = s;
    try {
      const devs = devicesOf(s);
      renderBar(s, devs);
      renderHome(s);
      setTargetLabel();
      renderTitle();
      sizeCard();
    } catch (e) {
      console.error('aurora-shell:', e);
    }
  }
  let titleRaf = 0;
  new MutationObserver(() => {
    if (titleRaf) return;
    titleRaf = requestAnimationFrame(() => { titleRaf = 0; labelGroups(); renderTitle(); });
  }).observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  // Setup comes and goes with body.setup (every shell; Mac's UI.setup has no page).
  new MutationObserver(() => { renderTitle(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => { dockChips(); sizeCard(); }, { passive: true });

  if (typeof api.onState === 'function') api.onState((s) => onState(s));
  if (UI.state) onState(UI.state);
  else if (typeof api.getState === 'function') Promise.resolve(api.getState()).then((s) => onState(UI.state || s), () => {});

  // For the console and tests: what the shell knows.
  window.AuroraShell = { run, render: onState, devices: () => devicesOf(UI.state || last), plan: (t) => plan(t, UI.state || last).map((x) => x.label) };
})();
