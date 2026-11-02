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
//   - a dock of connected-phone shortcuts at the bottom
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
  const topbar = h('div', 'au-topbar', [crumb, h('span', 'au-sp'), peerPill, routePill, secPill]);
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
  if (window.ResourceWidget) window.ResourceWidget.mount(home, api);
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
        qr.onclick = () => UI.go('connection');
        acts.push(qr);
      }
      const find = h('button', 'btn small' + (acts.length ? '' : ' primary'), null, { text: 'Find nearby', type: 'button' });
      find.onclick = () => { UI.go('connection'); call('refreshFound'); };
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
  }

  let last = null;
  const phoneDock = window.PhoneDock.mount({ document, parent: content, api });

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
      renderTitle();
      phoneDock.update(s);
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

  if (typeof api.onState === 'function') api.onState((s) => onState(s));
  if (UI.state) onState(UI.state);
  else if (typeof api.getState === 'function') Promise.resolve(api.getState()).then((s) => onState(UI.state || s), () => {});

  // For the console and tests: what the shell knows.
  window.AuroraShell = { render: onState, devices: () => devicesOf(UI.state || last) };
})();
