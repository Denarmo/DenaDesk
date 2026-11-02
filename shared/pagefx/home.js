// DenaDesk — PageFX, Home group: Overview, Connection, Multi-device, General, About. Based on DenaDesk —
// Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Each page gets its own quiet header (styles: home.css), built on shared/pagefx/core.js. Minimal art
// direction: monochrome hairlines, one light figure in Geist, mono captions, ONE accent on the one thing
// that moves. Each page is told apart by its composition and its single motif:
//   overview    .pg-vitals        round trip as a figure, a hairline heartbeat (one accent pulse), battery, now
//   connection  .pg-radar         this desk, then a sonar field: one dot per device found, the live line
//   multi       .pg-constellation the number that could join; dots on an ellipse, one pulse walks the links
//   general     .pg-gauges        a one-line verdict, then quiet status cells that take you to the row
//   about       .pg-orbits        hairline orbits around the icon, a dot per platform, the update line
// Never rebuilds or relabels a page's own controls: decorations sit beside them, classes are toggled.
// Every state access is guarded: the same file runs on Windows, Linux and the Mac (s.client, s.paired[])
// and in the mesh shells (s.peers[]).
// CSP: no style attributes, no innerHTML; positions go through CSS custom properties (ctx.css).
// Under prefers-reduced-motion nothing is placed with `transform` (core.css clears it there).
'use strict';

(() => {
  const FX = window.PageFX;
  if (!FX) return;
  const G = FX.get;
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const titleOf = (wrap) => { const t = wrap && wrap.querySelector(':scope > .card-title > span:first-child'); return t ? t.textContent.trim() : ''; };
  const wrapByTitle = (body, re) => (body ? [...body.querySelectorAll('.card-wrap')].find((w) => re.test(titleOf(w))) : null) || null;
  const rowByLabel = (root, re) => (root ? [...root.querySelectorAll('.row')].find((r) => { const l = r.querySelector(':scope > .text > .label'); return l && re.test(l.textContent.trim()); }) : null) || null;
  const hexLum = (hex) => {
    const m = String(hex || '').match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i);
    if (!m) return 0;
    const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const osOf = (os) => (/mac|darwin/i.test(os || '') ? 'mac' : /win/i.test(os || '') ? 'win' : /linux/i.test(os || '') ? 'linux' : /android/i.test(os || '') ? 'android' : os || 'win');
  // a kicker / figure / caption column, the typographic unit every header here is made of
  const col = (ctx, cls, kids) => ctx.el('div', 'pg-col ' + cls, kids);

  // ==================================================================================================
  // Overview — the device in your hand: round trip, one heartbeat, battery, what just happened
  // ==================================================================================================
  const OS_ACC = { mac: ['#a98bff', '#7a6bd6'], win: ['#64b5ff', '#3d8bdb'], linux: ['#ffc46b', '#d99a3d'], android: ['#7fe0b5', '#4fb88e'] };
  const GREY = ['#c7c7cc', '#8e8e93'];
  (function overview() {
    let V = null;
    let primed = false;
    // one beat in the middle of a flat line, drawn at the strip's real width (1 user unit = 1 px), so the
    // hairline never stretches and the dash lengths below mean the same at every width
    const beatPath = (w) => {
      const a = Math.round(w / 2 - 42);
      const X = (x) => a + x;
      return `M0 24H${a}C${X(4)} 24 ${X(6)} 19 ${X(10)} 19C${X(14)} 19 ${X(16)} 24 ${X(20)} 24H${X(26)}L${X(30)} 28L${X(36)} 6L${X(42)} 34L${X(47)} 24H${X(56)}`
        + `C${X(61)} 24 ${X(64)} 16 ${X(70)} 16C${X(76)} 16 ${X(79)} 24 ${X(84)} 24H${Math.max(w, X(90))}`;
    };
    function fitBeat(ctx, w) {
      w = Math.max(120, Math.round(w));
      if (!V || V.beatW === w) return;
      V.beatW = w;
      const d = beatPath(w);
      V.svg.setAttribute('viewBox', `0 0 ${w} 40`);
      V.base.setAttribute('d', d);
      V.trace.setAttribute('d', d);
      // the walking segment is ~64 px long; at rest (reduced motion) the accent lies on the beat itself
      let len = w + 120;
      try { len = V.trace.getTotalLength() || len; } catch (e) { /* estimate */ }
      const flat = Math.round(w / 2 - 42);
      const beatLen = Math.max(84, len - w + 84); // both flat runs are straight: the rest is the beat
      ctx.css(V.pulse, { '--pg-seg': (64 / len).toFixed(4), '--pg-b0': (flat / len).toFixed(4), '--pg-bl': (beatLen / len).toFixed(4) });
    }
    function build(ctx) {
      const { el, svg, svgRoot } = ctx;
      const h = ctx.hdr({ cls: 'pg-vitals' });
      if (!h) return null;
      if (V && V.h === h) return V;
      h.replaceChildren();
      // round trip: the figure
      const viaT = el('span');
      const rttN = el('span');
      const rttFig = el('div', 'pg-fig', [rttN, el('small', null, 'ms')]);
      const rtt = col(ctx, 'pg-v-rtt', [el('div', 'pg-kick', [el('span', null, 'Round trip · '), viaT]), rttFig]);
      // the heartbeat: a grey hairline, one accent pulse that walks it and rests
      const trace = svg('path', { class: 'pg-v-trace', d: beatPath(600), pathLength: '1' });
      const base = svg('path', { class: 'pg-v-base', d: beatPath(600), pathLength: '1' });
      const beatSvg = svgRoot('0 0 600 40', 'pg-v-svg', [base, trace], { preserveAspectRatio: 'xMidYMid meet' });
      const pulse = el('div', 'pg-v-pulse', [beatSvg]);
      // battery: figure + hairline meter
      const battK = el('div', 'pg-kick', 'Battery');
      const battN = el('span');
      const meter = el('div', 'pg-meter', [el('i')]);
      const batt = col(ctx, 'pg-v-batt', [battK, el('div', 'pg-fig pg-v-small', [battN, el('small', null, '%')]), meter]);
      // now: what just happened, in one line
      const nowK = el('div', 'pg-kick');
      const nowEq = el('span', 'pg-eq', [el('i'), el('i'), el('i'), el('i'), el('i')]);
      const nowT = el('span', 'pg-v-nowt');
      const nowSub = el('div', 'pg-v-nowsub pg-mono');
      const now = col(ctx, 'pg-v-now', [nowK, el('div', 'pg-row', [nowEq, nowT]), nowSub]);
      const vr1 = el('span', 'pg-vr');
      const vr2 = el('span', 'pg-vr');
      h.append(rtt, pulse, vr1, batt, vr2, now);
      [rtt, pulse, batt, now].forEach((e, i) => { e.classList.add('pg-stagger'); ctx.css(e, '--i', i); });
      try { new ResizeObserver((es) => { const r = es[0] && es[0].contentRect; if (r && r.width) fitBeat(ctx, r.width); }).observe(pulse); } catch (e) { /* stays 600 wide */ }
      V = { h, viaT, rttN, rtt, pulse, svg: beatSvg, base, trace, beatW: 0, battK, battN, meter, batt, vr1, vr2, nowK, nowEq, nowT, nowSub, now };
      return V;
    }
    function tagCards(page) {
      const two = page.querySelector('.dv-two');
      if (two && !two._pgTagged) {
        const map = [[/notification/i, 'notifs'], [/clipboard/i, 'clip'], [/most used|apps/i, 'apps'], [/send files|files/i, 'drop']];
        let n = 0;
        for (const w of two.querySelectorAll('.card-wrap')) {
          const hit = map.find(([re]) => re.test(titleOf(w)));
          if (hit && !w.dataset.pg) { w.dataset.pg = hit[1]; n++; }
        }
        if (n) two._pgTagged = true;
      }
      const hero = page.querySelector('.dv-hero');
      if (hero && !hero.querySelector(':scope > .pg-ov-halo')) {
        hero.prepend(FX.el('div', 'pg-ov-halo pg-fx', [FX.el('i'), FX.el('i')], { 'aria-hidden': 'true' }));
      }
      // QS tiles fade in from the centre: |i - mid| × 30 ms (order fixed by PHONE_QS; hidden tiles stay)
      const tiles = page.querySelectorAll('.dv-qs > .dv-qs-tile');
      tiles.forEach((t, i) => FX.css(t, '--pg-qd', Math.round(Math.abs(i - (tiles.length - 1) / 2) * 30) + 'ms'));
    }
    // centre the halo on the device picture (one layout read, only when the page shows)
    function placeHalo(page, ctx) {
      const hero = page.querySelector('.dv-hero');
      const dev = hero && hero.querySelector('.device.big');
      const halo = hero && hero.querySelector(':scope > .pg-ov-halo');
      if (!halo) return;
      ctx.cls(halo, 'pg-gone', !dev || !dev.offsetWidth);
      if (!dev || !dev.offsetWidth) return;
      ctx.css(halo, { '--pg-hx': Math.round(dev.offsetLeft + dev.offsetWidth / 2) + 'px', '--pg-hy': Math.round(dev.offsetTop + dev.offsetHeight / 2) + 'px' });
    }
    function accentFor(s) {
      const pf = G.phoneFirst(s);
      const ph = pf ? G.phone(s) : null;
      if (ph && ph.colors.length) {
        const a = ph.colors[0];
        const b = ph.colors[1] || ph.colors[0];
        // a black or very dark phone would vanish on the dark window: keep its hue family readable
        if (hexLum(a) > 0.12) return [a, hexLum(b) > 0.08 ? b : a];
        if (hexLum(b) > 0.12) return [b, b];
      }
      if (pf) return OS_ACC.android;
      if (!G.linked(s)) return GREY;
      return OS_ACC[osOf(G.peerOs(s))] || GREY;
    }
    function pickNow(s) {
      const nf = s.notifs || {};
      const cb = s.clipboard || {};
      const n0 = nf.receive ? arr(nf.history)[0] : null;
      const c0 = cb.enabled ? arr(cb.history)[0] : null;
      const media = G.isPhone(s) || G.phoneFirst(s) ? G.get(s, 'phoneMedia.now') : null;
      const cands = [n0 && { k: 'n', x: n0, at: num(n0.at) || 0 }, c0 && { k: 'c', x: c0, at: num(c0.at) || 0 }].filter(Boolean).sort((a, b) => b.at - a.at);
      const newest = cands[0] || null;
      const m = media && media.title ? { k: 'm', x: media, at: 0 } : null;
      if (newest && Date.now() - newest.at < 20000) return newest;
      if (m && m.x.playing) return m;
      return newest || m;
    }
    function paintNow(ctx, s, p) {
      ctx.cls(V.now, 'pg-gone', !p);
      ctx.cls(V.vr2, 'pg-gone', !p);
      if (!p) return;
      const x = p.x;
      ctx.cls(V.nowEq, 'pg-gone', p.k !== 'm');
      ctx.cls(V.nowEq, 'paused', p.k === 'm' && !x.playing);
      const peer = G.peerName(s) || 'the other device';
      if (p.k === 'm') {
        ctx.text(V.nowK, x.playing ? 'Now playing' : 'Paused');
        ctx.text(V.nowT, x.title);
        ctx.text(V.nowSub, x.artist || x.appName || '');
      } else if (p.k === 'n') {
        ctx.text(V.nowK, 'Notification');
        ctx.text(V.nowT, x.title || x.appName || x.app || 'Notification');
        ctx.text(V.nowSub, [x.appName || x.app, G.ago(x.at)].filter(Boolean).join(' · '));
      } else {
        ctx.text(V.nowK, 'Clipboard');
        ctx.text(V.nowT, x.image ? (x.dir === 'out' ? 'Picture sent' : 'Picture received') : (x.dir === 'out' ? 'Copied to ' : 'Copied from ') + peer);
        ctx.text(V.nowSub, G.ago(x.at));
      }
      ctx.attr(V.now, 'data-k', p.k);
    }
    FX.register('overview', {
      mount(page, ctx) { build(ctx); tagCards(page); },
      enter(page, ctx) {
        build(ctx);
        tagCards(page);
        primed = false;
        ctx.forget();
        ctx.stagger(page.querySelectorAll('.dv-actions > .btn'), '--pg-bi');
        ctx.after(40, () => placeHalo(page, ctx));
      },
      update(s, page, ctx) {
        if (!build(ctx)) return;
        tagCards(page);
        const on = G.linked(s);
        ctx.cls(V.h, 'pg-gone', !on);
        const ab = accentFor(s);
        if (ctx.changed('acc', ab)) ctx.accent(ab[0], ab[1]);
        if (!on) { primed = false; return; }
        // round trip and the beat: a slower link walks the line more slowly (3.5–7 s, then rests)
        const rtt = G.rtt(s);
        ctx.text(V.viaT, G.via(s));
        ctx.cls(V.h, 'no-rtt', rtt == null);
        ctx.count(V.rttN, rtt);
        ctx.css(V.pulse, '--pg-beat', rtt == null ? null : Math.round(clamp(3500 + rtt * 25, 3500, 7000) / 100) * 100 + 'ms');
        // battery
        const b = G.battery(s);
        ctx.cls(V.batt, 'pg-gone', !b);
        ctx.cls(V.vr1, 'pg-gone', !b);
        if (b) {
          const lvl = clamp(Math.round(b.level), 0, 100);
          ctx.count(V.battN, lvl);
          ctx.css(V.meter, '--v', (lvl / 100).toFixed(3));
          ctx.cls(V.batt, 'low', lvl <= 20 && !b.charging);
          ctx.cls(V.batt, 'charging', !!b.charging);
          ctx.text(V.battK, b.charging ? 'Charging' : 'Battery');
        }
        // now
        const p = pickNow(s);
        paintNow(ctx, s, p);
        const key = p ? p.k + ':' + (p.x.id || p.x.at || p.x.title || '') : '';
        if (ctx.changed('now', key) && primed && p) ctx.pop(V.now, 'pg-pop', 700);
        // inserts: halo strength from the battery, charging, the newest notification
        const hero = page.querySelector('.dv-hero');
        ctx.css(hero, '--pg-batt', b ? clamp(b.level, 0, 100) : 60);
        ctx.cls(page.querySelector('.dv-batt'), 'pg-charging', !!(b && b.charging));
        const n0 = (s.notifs && s.notifs.receive) ? arr(s.notifs.history)[0] : null;
        const nid = n0 ? String(n0.id || n0.at || '') : '';
        if (ctx.changed('nid', nid) && primed && nid) {
          const row = page.querySelector('[data-pg="notifs"] .card > div > .row');
          if (row) ctx.pop(row, 'pg-new', 1400);
        }
        if (!primed) placeHalo(page, ctx);
        primed = true;
      },
    });
  })();

  // ==================================================================================================
  // Connection — this desk, and a quiet sonar of what it can see
  // ==================================================================================================
  (function connection() {
    let RY = 0.4; // vertical squash, fitted to the field's height (a label above / below the outer ring fits)
    let RX = 2.3; // horizontal stretch of the sonar, fitted to the field's width
    let R = null;
    const devKey = (d) => String(d.id || d.address || d.name || '');
    function build(ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr({ cls: 'pg-radar' });
      if (!h) return null;
      if (R && R.h === h) return R;
      h.replaceChildren();
      const name = el('div', 'pg-fig pg-rd-name');
      const addr = el('div', 'pg-rd-addr pg-mono');
      const dot = el('span', 'pg-dot');
      const cap = el('span', 'pg-rd-cap');
      const code = el('span', 'pg-rd-code pg-mono');
      const info = col(ctx, 'pg-rd-info pg-stagger', [el('div', 'pg-kick', 'This desk'), name, addr, el('div', 'pg-row pg-rd-status', [dot, cap, code])]);
      const beams = svg('g', { class: 'pg-rd-beams' });
      const grid = [36, 60, 84].map((r, i) => svg('ellipse', { class: 'pg-rd-grid', cx: '0', cy: '0', rx: String(r * RX), ry: String(r * RY), pathLength: '1', data: { i, r } }));
      const plot = svg('svg', { class: 'pg-rd-plot', width: '1', height: '1', 'aria-hidden': 'true', focusable: 'false' }, [...grid, beams]);
      const ring = el('span', 'pg-rd-ring');
      const me = el('div', 'pg-rd-me');
      const layer = el('div', 'pg-rd-blips');
      const field = el('div', 'pg-rd-field pg-stagger', [ring, plot, me, layer], { css: { '--i': 1 } });
      h.append(info, field);
      R = { h, name, addr, dot, cap, code, beams, me, layer, field, grid, ring, blips: new Map(), beam: null };
      const fit = (w, hgt) => {
        const rx = Math.round(clamp((w / 2 - 36) / 84, 1.3, 2.3) * 20) / 20;
        const ry = Math.round(clamp((hgt / 2 - 21) / 84, 0.3, 0.5) * 100) / 100;
        if (rx === RX && ry === RY && R.fitted) return;
        RX = rx;
        RY = ry;
        R.fitted = true;
        for (const e of grid) { e.setAttribute('rx', String(Number(e.dataset.r) * RX)); e.setAttribute('ry', String(Number(e.dataset.r) * RY)); }
        ctx.css(ring, { '--pg-rw': Math.round(168 * RX) + 'px', '--pg-rh': Math.round(168 * RY) + 'px' });
        if (ctx.active()) ctx.refresh();
      };
      try { new ResizeObserver((es) => { const r = es[0] && es[0].contentRect; if (r && r.width && r.height) fit(r.width, r.height); }).observe(field); } catch (e) { /* default size */ }
      return R;
    }
    function blipFor(ctx, dev) {
      const k = devKey(dev);
      let b = R.blips.get(k);
      if (!b) {
        const { el } = ctx;
        const dotEl = el('span', 'pg-blip-dot');
        const nm = el('span', 'pg-blip-name');
        const tag = el('span', 'pg-blip-tag');
        const orbit = el('span', 'pg-blip-orbit', [el('i')]);
        const node = el('div', 'pg-blip', [orbit, dotEl, el('span', 'pg-blip-lbl', [nm, tag])]);
        b = { node, dotEl, nm, tag, isNew: true };
        R.blips.set(k, b);
        R.layer.append(node);
      }
      return b;
    }
    function tag(page) {
      const body = page.querySelector(':scope > .page-body');
      if (!body || body._pgTagged) return;
      const kids = [...body.children].filter((c) => !c.classList.contains('pg-hdr'));
      const hero = kids.find((c) => c.matches('.card.hero'));
      if (!hero) return;
      body._pgTagged = true;
      hero.dataset.pg = 'hero';
      const after = hero.nextElementSibling;
      if (after && !after.dataset.pg && after.matches('.card-wrap')) after.dataset.pg = 'adb';
      for (const c of kids) {
        if (c.dataset.pg) continue;
        if (c.querySelector('.value.addr, input[aria-label="Address"]')) c.dataset.pg = 'addr';
        else if (/found|nearby/i.test(titleOf(c))) c.dataset.pg = 'found';
        else if (/paired/i.test(titleOf(c))) c.dataset.pg = 'paired';
        else if (c.querySelector('.qr-box')) c.dataset.pg = 'qr';
      }
      if (!body.querySelector('[data-pg="found"]') && kids[1] && !kids[1].dataset.pg) kids[1].dataset.pg = 'found';
      const last = kids[kids.length - 1];
      if (last && !last.dataset.pg) last.dataset.pg = 'paired';
    }
    // Found rows map to s.found by index (foundList keeps that order); paired rows to [s.paired, ...s.guests].
    function decorateLists(page, s) {
      if (!s) return;
      const found = arr(s.found);
      const list = page.querySelector('[data-pg="found"] .card > div:not(.row)');
      if (list) {
        const rows = [...list.children].filter((r) => r.classList.contains('row'));
        rows.forEach((r, i) => FX.cls(r, 'pg-invited', !!(found.length === rows.length && found[i] && found[i].invited)));
      }
      const plist = page.querySelector('[data-pg="paired"] .card > div:not(.row)');
      if (plist) {
        const ids = [...(s.paired && !Array.isArray(s.paired) ? [s.paired.macId] : arr(s.paired).map((p) => p && p.id)), ...arr(s.guests).map((g) => g && g.id)];
        const waking = G.get(s, 'wake.waking', '');
        const rows = [...plist.children].filter((r) => r.classList.contains('row'));
        rows.forEach((r, i) => FX.cls(r, 'pg-waking', !!(waking && ids.length === rows.length && ids[i] === waking)));
      }
    }
    let watched = null;
    FX.register('connection', {
      mount(page, ctx) { build(ctx); tag(page); },
      enter(page, ctx) {
        build(ctx);
        tag(page);
        let i = 0;
        for (const b of R.blips.values()) { b.isNew = false; ctx.css(b.node, '--i', i++); }
        const list = page.querySelector('[data-pg="found"] .card > div:not(.row)');
        const plist = page.querySelector('[data-pg="paired"] .card > div:not(.row)');
        if (list && watched !== list) {
          watched = list;
          ctx.observe(list, { childList: true }, () => decorateLists(page, ctx.s()));
          if (plist) ctx.observe(plist, { childList: true }, () => decorateLists(page, ctx.s()));
        }
      },
      update(s, page, ctx) {
        if (!build(ctx)) return;
        tag(page);
        const linkState = G.get(s, 'link.state', '');
        const connected = (linkState === 'connected' && !G.isPhone(s)) || !!(s.client && s.client.os !== 'android') || arr(s.peers).some((p) => p && (p.connected || p.state === 'connected'));
        const found = arr(s.found);
        const disc = s.discovery || {};
        const fw = s.firewall || {};
        const blocked = disc.on === false || (fw.ok === false && !fw.checking);
        // the typographic column
        ctx.text(R.name, G.myName(s));
        const addrs = arr(s.addresses);
        ctx.text(R.addr, addrs[0] || s.address || 'No network');
        const pairing = s.pairing && s.pairing.role !== 'host' ? s.pairing : null;
        let st = 'off';
        let capT;
        if (blocked) { st = 'bad'; capT = 'Can’t look on this network'; }
        else if (linkState === 'identity_changed') { st = 'bad'; capT = 'Identity changed: pair again'; }
        else if (connected) { st = 'on'; capT = 'Linked with ' + (G.peerName(s) || 'a device'); }
        else if (pairing) { st = pairing.phase === 'failed' ? 'bad' : 'busy'; capT = pairing.phase === 'code' ? 'Same code on both?' : pairing.phase === 'failed' ? 'Pairing didn’t finish' : 'Pairing…'; }
        else if (found.length) { capT = found.length + (found.length === 1 ? ' device nearby' : ' devices nearby'); }
        else { st = 'busy'; capT = 'Looking…'; }
        ctx.attr(R.dot, 'data-st', st);
        ctx.text(R.cap, capT);
        // the pairing code, large and mono, read-only ("Codes match" stays in the row)
        const code = pairing && pairing.phase === 'code' && pairing.code ? String(pairing.code) : '';
        ctx.text(R.code, code ? code.slice(0, 3) + ' ' + code.slice(3) : '');
        ctx.cls(R.code, 'pg-gone', !code);
        ctx.cls(R.h, 'blocked', blocked);
        ctx.cls(R.h, 'linked', connected);
        // the blips: every device found, plus the live peer when it isn't in the list
        const devs = found.slice(0, 9).map((d) => Object.assign({}, d));
        const mp = G.meshPeer(s);
        const peer = s.peer || (s.client && s.client.os !== 'android' ? s.client : null) || mp || null;
        if (connected && peer && !devs.some((d) => d.id && d.id === peer.id)) devs.push({ id: peer.id || 'peer', name: peer.name || G.peerName(s), os: peer.os, live: true });
        const known = new Set([...(s.paired && !Array.isArray(s.paired) ? [s.paired.macId, s.paired.id] : []), ...arr(s.paired).map((p) => p && p.id), ...arr(s.guests).map((g) => g && g.id)].filter(Boolean));
        const liveId = connected && peer ? peer.id : '';
        const quiet = devs.length > 3; // many devices: names only on the ones that matter
        const seen = new Set();
        let beam = null;
        let pop = 0;
        devs.forEach((dev, i) => {
          const k = devKey(dev);
          if (!k || seen.has(k)) return;
          seen.add(k);
          const b = blipFor(ctx, dev);
          // evenly spread (stable order: s.found's), alternating the two outer rings
          const a = ((-150 + (360 / Math.max(devs.length, 1)) * i) * Math.PI) / 180;
          const r = i % 2 ? 60 : 84;
          const dx = Math.round(r * RX * Math.cos(a));
          const dy = Math.round(r * RY * Math.sin(a));
          ctx.css(b.node, { '--dx': dx + 'px', '--dy': dy + 'px' });
          ctx.cls(b.node, 'above', dy < 0);
          ctx.text(b.nm, dev.name || 'Device');
          ctx.attr(b.node, 'title', dev.name || null);
          const live = dev.live || (liveId && dev.id === liveId);
          const target = !!pairing && (pairing.id ? pairing.id === dev.id : !!(pairing.address && pairing.address === dev.address));
          const invited = !!dev.invited && !live;
          ctx.cls(b.node, 'known', known.has(dev.id));
          ctx.cls(b.node, 'invited', invited);
          ctx.cls(b.node, 'live', !!live);
          ctx.cls(b.node, 'pairing', target && pairing.phase !== 'failed');
          ctx.cls(b.node, 'failed', target && pairing.phase === 'failed');
          ctx.cls(b.node, 'named', !quiet || !!live || target || invited);
          if (b.isNew) { b.isNew = false; ctx.css(b.node, '--i', pop++); }
          // the live one carries its round trip beside its name (a label on the line collides with names)
          const rt = live ? G.rtt(s) : null;
          ctx.text(b.tag, live ? (rt != null ? rt + ' ms' : G.via(s)) : '');
          if (live) beam = { dx, dy };
        });
        for (const [k, b] of R.blips) if (!seen.has(k)) { b.node.remove(); R.blips.delete(k); }
        // the live line: centre → the peer
        if (beam) {
          if (!R.beam) { R.beam = ctx.svg('line', { class: 'pg-rd-beam', pathLength: '1' }); R.beams.append(R.beam); }
          ctx.attr(R.beam, 'x1', 0); ctx.attr(R.beam, 'y1', 0); ctx.attr(R.beam, 'x2', beam.dx); ctx.attr(R.beam, 'y2', beam.dy);
        } else if (R.beam) { R.beam.remove(); R.beam = null; }
        // inserts: the hero's direction and hand-over, invited and waking rows
        const hero = page.querySelector('.card.hero');
        if (hero) {
          ctx.cls(hero, 'pg-dir-out', connected && s.input === 'driving');
          ctx.cls(hero, 'pg-dir-in', connected && s.input === 'driven');
          ctx.cls(hero, 'pg-moving', connected && ['asking', 'hosting', 'joining', 'hotspot'].includes(G.get(s, 'net.state')));
        }
        decorateLists(page, s);
      },
    });
  })();

  // ==================================================================================================
  // Multi-device — a constellation: every device this desk knows, one pulse walking the links
  // ==================================================================================================
  (function multi() {
    let M = null;
    function build(ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr({ cls: 'pg-constellation' });
      if (!h) return null;
      if (M && M.h === h) return M;
      h.replaceChildren();
      const big = el('span');
      const capT = el('span', 'pg-cs-cap');
      const sub = el('div', 'pg-cs-sub');
      const kick = el('div', 'pg-kick', 'Mesh preview');
      const info = col(ctx, 'pg-cs-info pg-stagger', [kick, el('div', 'pg-row pg-cs-line', [el('div', 'pg-fig', [big]), capT]), sub]);
      const links = svg('g', { class: 'pg-cs-links' });
      const pulse = svg('line', { class: 'pg-cs-pulse' });
      const plot = svg('svg', { class: 'pg-cs-plot', width: '1', height: '1', 'aria-hidden': 'true', focusable: 'false' }, [links, pulse]);
      const nodes = el('div', 'pg-cs-nodes');
      const field = el('div', 'pg-cs-field pg-stagger', [plot, nodes], { css: { '--i': 1 } });
      h.append(info, field);
      M = { h, kick, big, capT, sub, links, pulse, nodes, field, rx: 200, ry: 34, nodeEls: new Map(), lineEls: [], pts: [], key: '', restarting: false, step: 0, timer: null };
      try {
        new ResizeObserver((es) => {
          const w = es[0] && es[0].contentRect.width;
          if (!w) return;
          const rx = Math.round(clamp(w / 2 - 64, 70, 230));
          if (rx !== M.rx) { M.rx = rx; M.key = ''; if (ctx.active()) ctx.refresh(); }
        }).observe(field);
      } catch (e) { /* no ResizeObserver: the default size */ }
      return M;
    }
    function devices(s) {
      const out = [];
      const add = (id, name, os, live) => {
        if (!name) return;
        const k = String(id || name);
        const have = out.find((d) => d.k === k || (d.name === name && d.os === osOf(os)));
        if (have) { if (live) have.live = true; return; }
        out.push({ k, name, os: osOf(os), live: !!live });
      };
      const link = s.link || {};
      const peerId = link.state === 'connected' && s.peer ? s.peer.id : '';
      // the Mac's live client (s.client) may carry no id: then it is the paired entry with its name
      const cl = s.client && s.client.os !== 'android' ? s.client : null;
      const isClient = (p) => !!(cl && (cl.id ? cl.id === p.id : !!cl.name && cl.name === (p.name || p.macName)));
      const phoneId = G.get(s, 'phone.connected.id', '');
      if (s.paired && !Array.isArray(s.paired)) add(s.paired.macId, s.paired.macName, s.paired.os, s.paired.macId && s.paired.macId === peerId);
      for (const p of arr(s.paired)) if (p) add(p.id, p.name || p.macName, p.os || (isClient(p) && cl.os), isClient(p));
      for (const g of arr(s.guests)) if (g) add(g.id, g.name || g.macName, g.os, g.id && g.id === peerId);
      for (const p of arr(s.peers)) if (p) add(p.id, p.name, p.os, p.connected || p.state === 'connected');
      for (const d of arr(G.get(s, 'phone.nearby'))) if (d) add(d.id, d.name || 'Phone', 'android', d.id && d.id === phoneId);
      if (G.get(s, 'phone.connected')) add(phoneId, G.get(s, 'phone.connected.name', 'Phone'), 'android', true);
      for (const d of arr(s.found)) if (d) add(d.id, d.name, d.os, d.id && d.id === peerId);
      if (cl && !out.some((d) => d.live && d.os !== 'android')) add(cl.id, cl.name, cl.os, true);
      if (peerId && s.peer && !out.some((d) => d.live && d.os !== 'android')) add(peerId, s.peer.name, s.peer.os, true);
      return out.slice(0, 5);
    }
    function layout(ctx, s) {
      const devs = devices(s);
      const pull = M.restarting ? 0.9 : 1;
      const n = devs.length;
      const pts = [{ k: '__me', name: G.myName(s), os: G.platform, me: true, x: 0, y: 0 }];
      devs.forEach((d, i) => {
        const a = (-90 + (360 / Math.max(n, 1)) * i + (n <= 2 ? 90 : n === 4 ? 45 : 0)) * Math.PI / 180;
        pts.push(Object.assign({}, d, { x: Math.round(M.rx * pull * Math.cos(a)), y: Math.round(M.ry * pull * Math.sin(a)) }));
      });
      const key = JSON.stringify([pts.map((p) => [p.k, p.name, p.os, !!p.live, p.x, p.y]), M.restarting]);
      if (key === M.key) return devs;
      M.key = key;
      M.pts = pts;
      const keep = new Set();
      pts.forEach((p, i) => {
        keep.add(p.k);
        let e = M.nodeEls.get(p.k);
        if (!e) {
          const nm = ctx.el('span', 'pg-cs-name');
          e = { node: ctx.el('div', 'pg-cs-node' + (p.me ? ' me' : ''), [ctx.el('span', 'pg-cs-dot'), nm]), nm };
          M.nodeEls.set(p.k, e);
          M.nodes.append(e.node);
        }
        ctx.text(e.nm, p.me ? p.name : p.name);
        ctx.css(e.node, { '--x': p.x + 'px', '--y': p.y + 'px', '--i': i });
        ctx.cls(e.node, 'live', !!p.live);
        ctx.cls(e.node, 'above', p.y < 0 && !p.me);
      });
      for (const [k, e] of M.nodeEls) if (!keep.has(k)) { e.node.remove(); M.nodeEls.delete(k); }
      // links, kept few: a spoke from this desk to each device (the live ones solid), and a quiet ring
      // through the devices' neighbours once there are three or more (not every pair: that's a thicket)
      for (const ln of M.lineEls) ln.remove();
      M.lineEls = [];
      const me = pts[0];
      const others = pts.slice(1);
      const pairs = others.map((b) => [me, b, !!b.live]);
      if (others.length >= 3) others.forEach((a, i) => pairs.push([a, others[(i + 1) % others.length], false]));
      pairs.forEach(([a, b, live], li) => {
        const ln = ctx.svg('line', { class: 'pg-cs-link' + (live ? ' live' : '') + (a.me ? '' : ' ring'), x1: a.x, y1: a.y, x2: b.x, y2: b.y, pathLength: '1' });
        ctx.css(ln, '--i', li);
        M.lineEls.push(ln);
        M.links.append(ln);
      });
      return devs;
    }
    // one pulse at a time walks a link (this desk's first, then the others): a short accent segment that
    // travels the hairline in 2.4 s, then a long rest. Driven by a tween (paused with the page; a reduced
    // motion jumps it to the end, where it is invisible).
    function walk(ctx) {
      if (!M) return;
      if (M.walking) { M.walking(); M.walking = null; }
      ctx.css(M.pulse, 'opacity', 0);
      if (!M.lineEls.length || M.restarting || ctx.reduced) return;
      const ln = M.lineEls[M.step % M.lineEls.length];
      M.step++;
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(ln.getAttribute(k)) || 0);
      const SEG = 0.22;
      M.walking = ctx.tween(0, 1, 2400, (k) => {
        const head = Math.min(1, k * (1 + SEG));
        const tail = Math.max(0, head - SEG);
        FX.attr(M.pulse, 'x1', (x1 + (x2 - x1) * tail).toFixed(1));
        FX.attr(M.pulse, 'y1', (y1 + (y2 - y1) * tail).toFixed(1));
        FX.attr(M.pulse, 'x2', (x1 + (x2 - x1) * head).toFixed(1));
        FX.attr(M.pulse, 'y2', (y1 + (y2 - y1) * head).toFixed(1));
        FX.css(M.pulse, 'opacity', k >= 1 ? 0 : (0.9 * Math.min(1, k * 6, (1 - k) * 5)).toFixed(3));
      }, { ease: 'inOut' });
    }
    let stopObs = null;
    function watchTurnOn(page, ctx) {
      const btn = page.querySelector(':scope > .page-body > .card-wrap .btn.primary');
      if (!btn || btn._pgWatched) return;
      btn._pgWatched = true;
      const sync = () => {
        const on = !!btn.disabled;
        if (on !== M.restarting) { M.restarting = on; M.key = ''; ctx.cls(M.h, 'pg-restarting', on); ctx.refresh(); }
      };
      if (stopObs) stopObs();
      stopObs = ctx.observe(btn, { attributes: true, attributeFilter: ['disabled'] }, sync);
      sync();
    }
    FX.register('multi', {
      mount(page, ctx) { build(ctx); watchTurnOn(page, ctx); },
      enter(page, ctx) {
        build(ctx);
        watchTurnOn(page, ctx);
        M.key = '';
        M.step = 0;
        if (!M.timer) M.timer = ctx.every(5200, () => walk(ctx));
        ctx.after(1400, () => walk(ctx));
      },
      update(s, page, ctx) {
        if (!build(ctx)) return;
        const devs = layout(ctx, s);
        const n = devs.length;
        // the mesh shells (s.peers[]) are already in mesh mode: say what's in it, not what could join
        const mesh = Array.isArray(s.peers);
        const live = devs.filter((d) => d.live).length;
        ctx.count(M.big, n, { ms: 600 });
        ctx.text(M.kick, mesh ? 'Mesh' : 'Mesh preview');
        ctx.text(M.capT, mesh ? (n === 1 ? 'device in the mesh' : 'devices in the mesh') : n === 1 ? 'device could join' : 'devices could join');
        ctx.text(M.sub, M.restarting ? (mesh ? 'Restarting…' : 'Restarting into mesh mode…')
          : mesh ? (n ? live + ' connected now' : 'Pair devices first; they show up here')
          : n ? 'One clipboard and one set of notifications for all of them' : 'Pair devices first; they show up here');
        ctx.cls(M.h, 'empty', !n);
      },
      leave() { if (!M) return; if (M.walking) M.walking(); M.walking = null; FX.css(M.pulse, 'opacity', 0); },
    });
  })();

  // ==================================================================================================
  // General — the workshop: a one-line verdict, then quiet status cells that take you to the row
  // ==================================================================================================
  (function general() {
    let Gx = null;
    const LAMPS = [
      ['fw', 'Firewall', (s) => { const f = s.firewall; if (!f) return null; return f.checking ? ['busy', 'Checking…'] : f.ok ? ['good', 'OK'] : f.ok === false ? ['bad', 'Needs a fix'] : ['busy', 'Unknown']; }],
      ['helper', 'Helper', (s) => { const k = s.kvmState; if (!k || !('helper' in k)) return null; const h = k.helper; return !h ? ['good', 'Running'] : h === 'starting' ? ['busy', 'Starting…'] : ['bad', 'Not running']; }],
      ['bt', 'Bluetooth', (s) => { const n = s.net; if (!n || !('radio' in n)) return null; const r = n.radio; return r === 'off' ? ['bad', 'Off'] : r === 'unsupported' ? ['bad', 'No LE'] : r ? ['good', 'On'] : ['off', 'Unknown']; }],
      ['vdd', 'Display driver', (s) => { const v = s.pcScreen && s.pcScreen.vdd; if (!v) return null; return !v.checked ? ['busy', 'Checking…'] : v.busy ? ['busy', v.busy === 'remove' ? 'Removing…' : 'Installing…'] : v.installed ? ['good', 'Installed'] : ['bad', 'Not installed']; }],
      ['start', 'Startup', (s) => (typeof s.startup !== 'boolean' ? null : s.startup ? ['good', 'On'] : ['off', 'Off'])],
    ];
    function rowFor(page, k) {
      const body = page.querySelector(':scope > .page-body');
      if (!body) return null;
      const near = (sel) => { const e = body.querySelector(sel); return e ? e.closest('.row') : null; };
      switch (k) {
        case 'fw': return rowByLabel(body, /^firewall$/i) || [...body.querySelectorAll('.row .btn')].map((b) => /check again/i.test(b.textContent) && b.closest('.row')).find(Boolean) || null;
        case 'helper': return rowByLabel(body, /helper/i);
        case 'bt': return near('input.switch[aria-label="Bluetooth with phones"]') || rowByLabel(body, /^bluetooth/i);
        case 'vdd': return rowByLabel(body, /display driver/i);
        case 'start': return near('input.switch[aria-label^="Start with"]') || near('input.switch[aria-label*="login" i]') || rowByLabel(body, /^start (with|at)/i);
        default: return null;
      }
    }
    function build(ctx) {
      const { el } = ctx;
      const h = ctx.hdr({ cls: 'pg-gauges', interactive: true, label: 'Status of this computer' });
      if (!h) return null;
      if (Gx && Gx.h === h) return Gx;
      h.replaceChildren();
      const lamps = LAMPS.map(([k, label], i) => {
        const dot = el('span', 'pg-dot');
        const val = el('span', 'pg-g-val pg-mono');
        const btn = el('button', 'pg-lamp pg-stagger', [el('span', 'pg-g-lbl', [dot, el('span', null, label)]), val], { data: { k }, css: { '--i': i + 1 } });
        btn.addEventListener('click', () => {
          const row = rowFor(ctx.page, k);
          if (!row) return;
          try { row.scrollIntoView({ block: 'center', behavior: FX.reduced() ? 'auto' : 'smooth' }); } catch (e) { row.scrollIntoView(); }
          ctx.pop(row, 'pg-flash', 1400);
        });
        return { k, label, btn, dot, val };
      });
      const sumT = el('div', 'pg-fig pg-g-sumt');
      const sumSub = el('div', 'pg-kick pg-g-sumsub');
      const sum = col(ctx, 'pg-g-sum pg-stagger', [sumSub, sumT]);
      h.append(sum, el('div', 'pg-g-lamps', lamps.map((l) => l.btn)));
      Gx = { h, lamps, sum, sumT, sumSub };
      return Gx;
    }
    function ensureMap(page) {
      const sw = page.querySelector('input.switch[aria-label="Quick actions"]');
      const wrap = (sw && sw.closest('.card-wrap')) || wrapByTitle(page, /^overview$/i);
      if (!wrap) return null;
      let map = wrap.querySelector(':scope > .pg-ovmap');
      if (!map) {
        const blk = (k) => FX.el('i', null, null, { data: { k } });
        const frame = FX.el('div', 'pg-ovmap-frame', ['hero', 'media', 'qs', 'notifs', 'clipboard', 'apps', 'files'].map(blk));
        const txt = FX.el('div', 'pg-ovmap-txt', [FX.el('span', 'pg-ovmap-n pg-mono'), FX.el('span', 'pg-ovmap-sub', 'What the Overview shows. Each part is drawn while it’s on.')]);
        map = FX.el('div', 'pg-ovmap', [frame, txt], { 'aria-hidden': 'true' });
        const card = wrap.querySelector(':scope > .card');
        wrap.insertBefore(map, card || null);
      }
      return map;
    }
    FX.register('general', {
      mount(page, ctx) { build(ctx); ensureMap(page); },
      enter(page, ctx) {
        build(ctx);
        ensureMap(page);
        for (const l of Gx.lamps) l.btn.disabled = !rowFor(page, l.k);
        ctx.forget();
      },
      update(s, page, ctx) {
        if (!build(ctx)) return;
        let bad = 0;
        let shown = 0;
        let busy = 0;
        Gx.lamps.forEach((l, i) => {
          const r = LAMPS[i][2](s);
          ctx.cls(l.btn, 'pg-gone', !r);
          if (!r) return;
          shown++;
          const [st, txt] = r;
          if (st === 'bad') bad++;
          if (st === 'busy') busy++;
          ctx.attr(l.btn, 'data-st', st);
          ctx.attr(l.dot, 'data-st', st === 'good' ? 'good' : st === 'busy' ? 'busy' : st === 'bad' ? 'bad' : 'off');
          ctx.text(l.val, txt);
          ctx.attr(l.btn, 'aria-label', l.label + ': ' + txt + (l.btn.disabled ? '' : '. Go to the setting'));
        });
        ctx.attr(Gx.sum, 'data-st', bad ? 'bad' : busy ? 'busy' : 'good');
        ctx.text(Gx.sumT, bad ? bad + (bad === 1 ? ' needs a fix' : ' need a fix') : busy ? 'Checking…' : 'All good');
        ctx.text(Gx.sumSub, shown + ' checks · ' + G.myName(s));
        // the Overview mini-map
        const map = ensureMap(page);
        if (map) {
          const ov = (s.ui && s.ui.overview) || {};
          let onN = 0;
          for (const b of map.querySelectorAll('.pg-ovmap-frame > i')) {
            const k = b.dataset.k;
            const on = k === 'hero' || ov[k] !== false;
            if (k !== 'hero' && on) onN++;
            const was = b.classList.contains('on');
            ctx.cls(b, 'on', on);
            if (ctx.changed('ov:' + k, on) && was !== on) ctx.pop(b, 'pg-ov-flip', 600);
          }
          ctx.text(map.querySelector('.pg-ovmap-n'), onN + ' of 6 on');
        }
      },
    });
  })();

  // ==================================================================================================
  // About — hairline orbits around the icon, one dot per platform (this one in the accent), the update line
  // ==================================================================================================
  (function about() {
    let A = null;
    const ORB = [
      { rx: 120, ry: 36, rot: -6, t: 80 },
      { rx: 190, ry: 56, rot: 4, t: 120 },
      { rx: 268, ry: 80, rot: -3, t: 180 },
    ];
    const SATS = [['mac', 0, 0.1], ['win', 1, 0.6], ['android', 1, 0.15], ['linux', 2, 0.42]];
    const W = 640;
    const H = 260;
    const ellPath = (o) => {
      const cx = W / 2;
      const cy = H / 2;
      const a = (o.rot * Math.PI) / 180;
      const f = (n) => n.toFixed(1);
      const x1 = cx - o.rx * Math.cos(a);
      const y1 = cy - o.rx * Math.sin(a);
      const x2 = cx + o.rx * Math.cos(a);
      const y2 = cy + o.rx * Math.sin(a);
      return `M${f(x1)} ${f(y1)}A${o.rx} ${o.ry} ${o.rot} 1 1 ${f(x2)} ${f(y2)}A${o.rx} ${o.ry} ${o.rot} 1 1 ${f(x1)} ${f(y1)}Z`;
    };
    function build(ctx, page) {
      const hero = page.querySelector(':scope > .page-body > .about-hero');
      if (!hero) return null;
      if (A && A.hero === hero && hero.contains(A.wrap)) return A;
      const { el, svg, svgRoot } = ctx;
      const paths = ORB.map((o) => ellPath(o));
      const scan = svg('path', { class: 'pg-ab-scan', d: paths[2], pathLength: '1' });
      const orbits = svgRoot(`0 0 ${W} ${H}`, 'pg-ab-orbits', [...paths.map((d, i) => svg('path', { class: 'pg-ab-orbit', d, pathLength: '1', data: { i } })), scan], { width: String(W), height: String(H) });
      const sats = SATS.map(([os, oi, d0], i) => {
        // not data-os: the Mac shell turns every [data-os] element into its OS icon (control.js)
        const s = el('span', 'pg-sat', null, { data: { plat: os } });
        ctx.css(s, { 'offset-path': `path('${paths[oi]}')`, '--d0': (d0 * 100).toFixed(1) + '%', '--t': ORB[oi].t + 's', '--i': i });
        return s;
      });
      const stage = el('div', 'pg-ab-stage', [orbits, ...sats]);
      const wrap = el('div', 'pg-orbits pg-fx', [stage], { 'aria-hidden': 'true' });
      hero.prepend(wrap);
      // the update line, beside (not inside) the version line
      const ver = hero.querySelector('.about-ver');
      const chipT = el('span', 'pg-verchip-t');
      const dot = el('span', 'pg-verchip-dot');
      const chip = el('div', 'pg-verchip pg-mono pg-fx', [dot, chipT], { 'aria-hidden': 'true' });
      if (ver) ver.after(chip); else hero.append(chip);
      A = { hero, wrap, stage, scan, sats, chip, chipT, dot, cores: null, coresN: -1 };
      return A;
    }
    function place(ctx) {
      const icon = A.hero.querySelector('.about-icon');
      if (!icon || !icon.offsetHeight) return;
      ctx.css(A.wrap, '--pg-icy', Math.round(icon.offsetTop + icon.offsetHeight / 2) + 'px');
    }
    function cores(page, ctx, s) {
      const n = clamp(num(G.get(s, 'about.pc.cores')) || 0, 0, 32);
      const wrap = wrapByTitle(page.querySelector(':scope > .page-body'), /this computer/i);
      const row = (wrap && (rowByLabel(wrap, /processor|cpu|chip/i) || wrap.querySelectorAll('.card > .row')[3])) || null;
      if (!row || row.hidden) return;
      const controls = row.querySelector(':scope > .controls');
      if (!controls) return;
      if (!A.cores || !controls.contains(A.cores)) { A.cores = ctx.el('span', 'pg-cores pg-fx', null, { 'aria-hidden': 'true' }); controls.append(A.cores); A.coresN = -1; }
      if (n !== A.coresN) {
        A.coresN = n;
        A.cores.replaceChildren(...Array.from({ length: n }, (_, i) => ctx.el('i', null, null, { css: { '--i': i } })));
        ctx.cls(A.cores, 'pg-gone', !n);
      }
    }
    FX.register('about', {
      mount(page, ctx) { build(ctx, page); },
      enter(page, ctx) { if (!build(ctx, page)) return; place(ctx); ctx.forget(); },
      update(s, page, ctx) {
        if (!build(ctx, page)) return;
        if (!A.wrap.style.getPropertyValue('--pg-icy')) place(ctx);
        const ab = s.about || {};
        const app = ab.app || {};
        const pc = ab.pc || {};
        // this machine's dot carries the accent
        const html = document.documentElement;
        const me = /mac|darwin/i.test(pc.os || '') ? 'mac' : /win/i.test(pc.os || '') ? 'win' : /linux/i.test(pc.os || '') ? 'linux'
          : html.classList.contains('au-mac') ? 'mac' : html.classList.contains('au-linux') ? 'linux' : G.platform;
        for (const sat of A.sats) ctx.cls(sat, 'me', sat.dataset.plat === me);
        // the update line: arch · what the updater knows
        const arch = String(app.arch || '');
        const archShort = (arch.match(/\(([^)]+)\)/) || [])[1] || arch;
        const u = s.updates;
        const avail = !!(u && u.available);
        const skipped = avail && !!(u.skipped || (u.skippedVersion && u.skippedVersion === u.latest));
        let st = '';
        let msg = '';
        if (u && u.checking) { st = 'busy'; msg = 'Checking for updates…'; }
        else if (avail) { st = skipped ? 'off' : 'on'; msg = (u.latest || 'A new version') + (skipped ? ' skipped' : ' available'); }
        else if (u && u.error) { st = 'off'; msg = 'Couldn’t check for updates'; }
        else if (u && u.checkedAt) { st = ''; msg = 'Up to date'; }
        ctx.text(A.chipT, [archShort, msg].filter(Boolean).join(' · '));
        ctx.attr(A.chip, 'data-st', st || null);
        ctx.cls(A.chip, 'pg-gone', !archShort && !msg);
        ctx.cls(A.wrap, 'checking', !!(u && u.checking));
        ctx.cls(A.wrap, 'error', !!(u && u.error));
        if (avail && !skipped && ctx.changed('avail', u.latest)) ctx.pop(A.chip, 'pg-pop', 900);
        cores(page, ctx, s);
      },
    });
  })();
})();
