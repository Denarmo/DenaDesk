// DenaDesk — Aurora feature pictures: Second screen (share), Screen sharing (mirror), Remote screen (view) and
// Camera sharing (camera). Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Each sets window.AuroraArt[<scene>] = (id, K) => the inner markup of a 400 x 240 picture, drawn with the art kit
// (shared/art/kit.js, K); shared/feature-art.js puts K.defs(id) in the picture's <defs> first. CSP-safe: SVG
// presentation attributes and classes only (no style=""), no scripts; every motion is SMIL, so the reduced-motion
// pause of feature-art.js (svg.pauseAnimations at 1.6 s) stills all of it on a frame that tells the story.
// Minimal: hairline monochrome devices, dark screens, the feature's colour on ONE thing, one slow gesture a loop.
//   share  — the two computers side by side, the other one's screen and this one's blank: one window is drawn
//            across the gap onto this screen (it vanishes in the gap, one desktop over both), outlined in the colour
//   mirror — this computer in front, the other one further back: two hairlines draw out from this screen to a
//            window over there, and this screen appears in it, the window outlined in the colour
//   view   — one computer, close: a window on it holds the other device's whole screen; the pointer goes in (the
//            window's frame takes the colour while it's in there), clicks a window there, and comes back out
//   camera — a macro of the other device's camera (a phone's camera island, a Mac's notch, a PC's bezel) and the
//            video window here: its focus ring turns, the picture comes sharp, focus brackets in the colour settle
(function () {
  'use strict';
  const A = (window.AuroraArt = window.AuroraArt || {});

  const f = (v) => Math.round(v * 100) / 100;
  const t4 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000;
  const REP = 'repeatCount="indefinite"';
  const EASE = '0.65 0 0.35 1'; // in and out
  const OUT = '0.2 0.8 0.3 1'; // fast, then settling
  const LIN = '0 0 1 1';
  const rect = (x, y, w, h, rx, attrs = '', inner = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}${inner ? `>${inner}</rect>` : '/>'}`;
  const circ = (cx, cy, r, attrs = '', inner = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}${inner ? `>${inner}</circle>` : '/>'}`;

  // ---- eased SMIL from keyframes [[t 0..1, value], …]; ks: one spline for every step, or a list ----
  const splines = (fr, ks) => (Array.isArray(ks) ? ks : Array(fr.length - 1).fill(ks)).join(';');
  const keys = (fr, ks) => `values="${fr.map((k) => k[1]).join(';')}" keyTimes="${fr.map((k) => t4(k[0])).join(';')}" calcMode="spline" keySplines="${splines(fr, ks)}"`;
  const kf = (attr, D, fr, ks = EASE) => `<animate attributeName="${attr}" dur="${D}s" ${REP} ${keys(fr, ks)}/>`;
  const kfT = (type, D, fr, ks = EASE) => `<animateTransform attributeName="transform" type="${type}" dur="${D}s" ${REP} ${keys(fr, ks)}/>`;
  const op = (D, fr, ks = LIN) => kf('opacity', D, fr, ks);

  // ---- placing the kit's devices ----
  const KIND = { win: 'winPc', mac: 'macBook', linux: 'linuxPc', android: 'phone', tablet: 'tablet' };
  const ASPECT = { win: 1.27, mac: 1.57, linux: 1.48, android: 0.5, tablet: 1.45 };
  const NAME = { win: 'Windows PC', mac: 'MacBook', linux: 'Linux PC', android: 'Phone', tablet: 'Tablet' };
  const kindOf = (os) => KIND[os] || 'laptop';
  const aspect = (os) => ASPECT[os] || 1.48;
  const big = (os) => os === 'win' || os === 'mac' || os === 'linux';
  const winOs = (os) => (big(os) ? os : 'plain');
  // A device of that OS, w wide (its height from its shape) at x, y: its screen's content area and whole screen.
  function place(K, os, x, y, w, o = {}) {
    const h = w / aspect(os);
    const kind = kindOf(os);
    return {
      os, kind, x, y, w, h,
      scr: K.screen(kind, x, y, w, h, o),
      full: K.screenRect(kind, x, y, w, h, o),
      draw: (more = {}) => K.computer(os, x, y, w, h, Object.assign({}, o, more)),
    };
  }
  // The same, standing on `floor`, centred on cx.
  const stand = (K, os, cx, floor, w, o) => place(K, os, cx - w / 2, floor - w / aspect(os), w, o);
  // How wide a device of that OS is when its whole screen is sh high.
  const widthFor = (K, os, sh, o = {}) => (100 * sh) / K.screenRect(kindOf(os), 0, 0, 100, 100 / aspect(os), o).h;
  // A hairline floor, clear at both ends.
  const floorLine = (K, x, y, w, o = 0.3) => rect(x, y + 0.2, w, 0.6, 0, `fill="${K.ref('edge')}" opacity="${o}"`);
  const clipTo = (K, shapes) => {
    const id = K.uid('c');
    return { url: `url(#${id})`, def: `<clipPath id="${id}">${shapes}</clipPath>` };
  };
  const winRx = (os, w, h) => Math.max(1, Math.min(8, Math.min(w, h) * (os === 'win' ? 0.04 : 0.055)));
  // A window w wide whose body (under its title bar, inside its padding) is `asp` wide per high: its height.
  function windowFor(K, w, asp) {
    let h = w / asp + 8;
    for (let i = 0; i < 6; i++) {
      const b = K.windowBody(0, 0, w, h);
      h += b.w / asp - b.h;
    }
    return h;
  }
  // The other device's whole screen, `screen` (a K.screenRect) of the markup `dev`, drawn into the box b.
  function screenInto(K, dev, screen, b, rx = 1.2) {
    const sx = b.w / screen.w;
    const sy = b.h / screen.h;
    const c = clipTo(K, rect(b.x, b.y, b.w, b.h, rx));
    return {
      markup: c.def + `<g clip-path="${c.url}"><g transform="translate(${f(b.x - screen.x * sx)} ${f(b.y - screen.y * sy)}) scale(${f(sx)} ${f(sy)})">${dev}</g></g>`,
      map: (x, y) => [b.x + (x - screen.x) * sx, b.y + (y - screen.y) * sy],
      sx, sy,
    };
  }

  // ======================================================================================================
  // Second screen: the other computer on the left, this one on the right with a blank screen; one window is
  // drawn across. Both screens clip it, so it disappears into the gap and comes out the other side: one desktop.
  A.share = (id, K) => {
    const o = K.os();
    const me = big(o.me) ? o.me : 'win';
    const peer = big(o.peer) && o.peer !== me ? o.peer : me === 'win' ? 'mac' : 'win';
    const D = 8;
    const floor = 192;
    const SH = 86;
    const gap = 14;
    const wl = widthFor(K, peer, SH);
    const wr = widthFor(K, me, SH);
    const x0 = 200 - (wl + gap + wr) / 2;
    const L = place(K, peer, x0, floor - wl / aspect(peer), wl);
    const R = place(K, me, x0 + wl + gap, floor - wr / aspect(me), wr);
    const la = L.scr;
    const ra = R.scr;
    // The window: from the middle of that screen to the middle of this one.
    const w = Math.min(la.w, ra.w) * 0.5;
    const h = w * 0.66;
    const p0 = [la.x + (la.w - w) * 0.5, la.y + (la.h - h) * 0.42];
    const p1 = [ra.x + (ra.w - w) * 0.5, ra.y + (ra.h - h) * 0.42];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const th = Math.max(3.5, Math.min(14, h * 0.12));
    // A round: rest, drawn across (0.06-0.36), rest there, fade (0.82-0.88), back unseen, fade in (0.92-0.98).
    const G0 = 0.06;
    const G1 = 0.36;
    const move = kfT('translate', D, [[0, '0 0'], [G0, '0 0'], [G1, `${f(dx)} ${f(dy)}`], [0.89, `${f(dx)} ${f(dy)}`], [0.9, '0 0'], [1, '0 0']], [LIN, EASE, LIN, LIN, LIN]);
    const fade = op(D, [[0, 1], [0.82, 1], [0.88, 0], [0.92, 0], [0.98, 1], [1, 1]], [LIN, EASE, LIN, EASE, LIN]);
    const both = clipTo(K, rect(L.full.x, L.full.y, L.full.w, L.full.h, L.full.rx) + rect(R.full.x, R.full.y, R.full.w, R.full.h, R.full.rx));
    // The pointer holds its title bar while it goes, then lets go and drifts off a little.
    const grip = [p0[0] + w * 0.6, p0[1] + th * 0.55];
    const pointer = `<g>${kfT('translate', D, [[0, '0 0'], [G1 + 0.04, '0 0'], [G1 + 0.16, '7 9'], [1, '7 9']], [LIN, EASE, LIN])}`
      + `<g transform="translate(${f(grip[0])} ${f(grip[1])})"><g>${kfT('scale', D, [[0, '1'], [G0 - 0.02, '1'], [G0, '0.88'], [G1 + 0.01, '0.88'], [G1 + 0.03, '1'], [1, '1']], [LIN, OUT, LIN, OUT, LIN])}`
      + `${K.cursor(0, 0, { s: 0.72 })}</g></g></g>`;
    const glow = `<ellipse cx="${f(p0[0] + w / 2)}" cy="${f(p0[1] + h / 2)}" rx="${f(w * 0.9)}" ry="${f(h * 0.9)}" fill="${K.ref('r-f1')}" opacity="0">`
      + op(D, [[0, 0], [G0, 0], [(G0 + G1) / 2, 0.55], [G1 + 0.08, 0], [1, 0]], [LIN, EASE, EASE, LIN]) + '</ellipse>';
    const win = K.window(p0[0], p0[1], w, h, { os: peer, body: 'lines' })
      + rect(p0[0], p0[1], w, h, winRx(peer, w, h), `fill="none" class="ka-st1" stroke-width="${K.SW.hair}" opacity="0.75"`);
    return floorLine(K, x0 - 18, floor, wl + gap + wr + 36)
      + L.draw({ apps: false }) + R.draw({ apps: false, chrome: false })
      + `<g>${move}${fade}${glow}</g>`
      + both.def + `<g clip-path="${both.url}"><g>${move}${fade}${win}${pointer}</g></g>`;
  };

  // ======================================================================================================
  // Screen sharing: this computer in front, the other further back; two hairlines draw out from this screen to a
  // window over there, and this screen appears in it.
  A.mirror = (id, K) => {
    const { me: me0, peer } = K.os();
    const me = big(me0) ? me0 : 'win';
    const D = 8;
    const phone = !big(peer);
    // This one: in front, on the left.
    const mw = Math.min(176, widthFor(K, me, 100));
    const M = stand(K, me, 34 + mw / 2, 210, mw);
    // The other: further back, on the right, smaller.
    const pw = phone ? 50 : widthFor(K, peer, 54);
    const pf = phone ? 168 : 146;
    const P = stand(K, peer, phone ? 318 : 302, pf, pw);
    // The window there, the shape of this screen.
    const S = M.full;
    const asp = S.w / S.h;
    const ar = P.scr;
    const ww = ar.w * (phone ? 0.9 : 0.66);
    const wh = windowFor(K, ww, asp);
    const wx = ar.x + (ar.w - ww) / 2;
    const wy = phone ? ar.y + ar.h * 0.3 : ar.y + (ar.h - wh) * 0.44;
    const B = K.windowBody(wx, wy, ww, wh);
    const meId = K.uid('me');
    const copy = screenInto(K, `<use href="#${meId}"/>`, S, B, 0.6);
    // A round: the lines draw out (0.03-0.16), the window comes in (0.13-0.2); the lines go (0.34-0.5); the
    // window stays, then goes (0.88-0.95).
    const shown = op(D, [[0, 0], [0.13, 0], [0.2, 1], [0.88, 1], [0.95, 0], [1, 0]], [LIN, EASE, LIN, EASE, LIN]);
    const win = `<g opacity="0">${shown}`
      + K.window(wx, wy, ww, wh, { os: winOs(peer), body: 'blank' }) + copy.markup
      + rect(wx, wy, ww, wh, winRx(winOs(peer), ww, wh), `fill="none" class="ka-st1" stroke-width="${K.SW.fine}" opacity="0.9"`) + '</g>';
    // The two outer lines between the screen here and the window there (top and bottom, or the two sides).
    const sc = [[S.x, S.y], [S.x + S.w, S.y], [S.x + S.w, S.y + S.h], [S.x, S.y + S.h]];
    const bc = [[wx, wy], [wx + ww, wy], [wx + ww, B.y + B.h], [wx, B.y + B.h]];
    const pairs = phone ? [[1, 1], [2, 2]] : [[1, 1], [2, 2]];
    let lines = '';
    pairs.forEach(([i, j], n) => {
      const a = sc[i];
      const b = bc[j];
      const gid = K.uid('pl');
      lines += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}">`
        + '<stop offset="0" stop-color="#fff" stop-opacity="0.04"/><stop offset="1" stop-color="#fff" stop-opacity="0.4"/></linearGradient>'
        + `<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" pathLength="1" fill="none" stroke="url(#${gid})" stroke-width="${K.SW.hair}" stroke-dasharray="1 1" stroke-dashoffset="1">`
        + kf('stroke-dashoffset', D, [[0, 1], [0.03 + n * 0.015, 1], [0.16 + n * 0.015, 0], [1, 0]], [LIN, EASE, LIN])
        + kf('opacity', D, [[0, 1], [0.34, 1], [0.5, 0], [1, 0]], [LIN, EASE, LIN]) + '</path>';
    });
    const glow = `<ellipse cx="${f(wx + ww / 2)}" cy="${f(wy + wh / 2)}" rx="${f(ww * 1.1)}" ry="${f(wh * 1.1)}" fill="${K.ref('r-f1')}" opacity="0">${op(D, [[0, 0], [0.14, 0], [0.24, 0.45], [0.86, 0.45], [0.95, 0], [1, 0]], [LIN, EASE, LIN, EASE, LIN])}</ellipse>`;
    return floorLine(K, P.x - 14, pf, P.w + 28, 0.18) + glow
      + P.draw({ apps: false, content: phone ? '' : undefined }) + win
      + lines
      + floorLine(K, M.x - 16, 210, M.w + 32)
      + `<g id="${meId}">${M.draw()}</g>`;
  };

  // ======================================================================================================
  // Remote screen: this computer, close; a window on it holds the other device's whole screen. The pointer goes
  // in — the window's frame takes the feature's colour while it's in there — clicks a window there, comes back.
  A.view = (id, K) => {
    const { me: me0, peer } = K.os();
    const me = big(me0) ? me0 : 'win';
    const D = 8;
    const phone = !big(peer);
    const floor = 212;
    const H = me === 'win' ? 176 : 170;
    const W = Math.min(272, H * aspect(me));
    const M = stand(K, me, 200, floor, W);
    const ar = M.scr;
    // The other device, drawn once at a working size: its screen, and the window on it the pointer clicks.
    const pk = kindOf(peer);
    const PW = phone ? 60 : 200;
    const PH = PW / aspect(peer);
    const pscr = K.screen(pk, 0, 0, PW, PH);
    const full = K.screenRect(pk, 0, 0, PW, PH);
    let tg;
    let pcontent;
    if (phone) {
      tg = { x: pscr.x + pscr.w * 0.1, y: pscr.y + pscr.h * 0.08, w: pscr.w * 0.8, h: pscr.h * 0.24, rx: pscr.w * 0.08 };
      const t = Math.max(0.6, pscr.w * 0.035);
      pcontent = rect(tg.x, tg.y, tg.w, tg.h, tg.rx, 'fill="#fff" fill-opacity="0.04" stroke="#fff" stroke-opacity="0.1" stroke-width="0.55"')
        + rect(tg.x, pscr.y + pscr.h * 0.42, tg.w * 0.7, t, t / 2, 'fill="#fff" fill-opacity="0.14"')
        + rect(tg.x, pscr.y + pscr.h * 0.42 + t * 2.6, tg.w * 0.45, t, t / 2, 'fill="#fff" fill-opacity="0.08"');
    } else {
      tg = { x: pscr.x + pscr.w * 0.36, y: pscr.y + pscr.h * 0.16, w: pscr.w * 0.5, h: pscr.h * 0.6 };
      tg.rx = winRx(peer, tg.w, tg.h);
      pcontent = peer === 'linux'
        ? K.terminal(tg.x, tg.y, tg.w, tg.h, { lines: [[['', 0.08], ['', 0.4]], [['', 0.28]]], cursor: false })
        : K.window(tg.x, tg.y, tg.w, tg.h, { os: peer, body: 'lines' });
    }
    const pdev = K.computer(peer, 0, 0, PW, PH, { apps: false, content: pcontent, anim: false });
    // The window here that holds it.
    const asp = full.w / full.h;
    let ww;
    if (phone) {
      const bh = ar.h * 0.74;
      ww = bh * asp + 4;
    } else ww = ar.w * 0.6;
    const wh = windowFor(K, ww, asp);
    const wx = phone ? ar.x + ar.w * 0.34 : ar.x + ar.w * 0.1;
    const wy = ar.y + (ar.h - wh) * 0.42;
    const B = K.windowBody(wx, wy, ww, wh);
    const rem = screenInto(K, pdev, full, B, Math.max(0.8, full.rx * (B.w / full.w)));
    const t0 = rem.map(tg.x, tg.y);
    const t1 = rem.map(tg.x + tg.w, tg.y + tg.h);
    const T = { x: t0[0], y: t0[1], w: t1[0] - t0[0], h: t1[1] - t0[1], rx: (tg.rx || 1) * rem.sx };
    // A round: rest on this desktop; in (0.06-0.2); click (0.25); rest; out (0.68-0.8); rest.
    const IN0 = 0.06;
    const IN1 = 0.2;
    const TC = 0.25;
    const OUT0 = 0.68;
    const OUT1 = 0.8;
    const home = [ar.x + ar.w * (phone ? 0.82 : 0.86), ar.y + ar.h * 0.7];
    const hit = [T.x + T.w * 0.42, T.y + T.h * 0.58];
    const ctl = [(home[0] + hit[0]) / 2, Math.max(hit[1], home[1]) + 6];
    const path = `M${f(home[0])} ${f(home[1])}Q${f(ctl[0])} ${f(ctl[1])} ${f(hit[0])} ${f(hit[1])}`;
    const motion = `<animateMotion dur="${D}s" ${REP} path="${path}" keyPoints="0;0;1;1;0;0" keyTimes="0;${IN0};${IN1};${OUT0};${OUT1};1" calcMode="spline" keySplines="${[LIN, EASE, LIN, EASE, LIN].join(';')}"/>`;
    const pointer = `<g>${motion}<g>${kfT('scale', D, [[0, '1'], [TC - 0.006, '1'], [TC + 0.006, '0.86'], [TC + 0.03, '1'], [1, '1']], [LIN, LIN, OUT, LIN])}${K.cursor(0, 0, { s: 0.9 })}</g></g>`;
    // When the pointer is in there: the frame takes the colour; the click: a ring, and the window there focuses.
    const IN = IN0 + (IN1 - IN0) * 0.7;
    const frame = rect(wx, wy, ww, wh, winRx(winOs(me), ww, wh), `fill="none" class="ka-st1" stroke-width="${K.SW.hair}" opacity="0"`,
      op(D, [[0, 0], [IN - 0.03, 0], [IN + 0.03, 0.7], [OUT0 + 0.03, 0.7], [OUT0 + 0.08, 0], [1, 0]], [LIN, EASE, LIN, EASE, LIN]));
    const focus = rect(T.x, T.y, T.w, T.h, T.rx, 'fill="none" stroke="#fff" stroke-width="0.7" opacity="0"',
      op(D, [[0, 0], [TC, 0], [TC + 0.03, 0.4], [0.88, 0.4], [0.94, 0], [1, 0]], [LIN, EASE, LIN, EASE, LIN]));
    const ring = circ(hit[0], hit[1], 2, 'fill="none" stroke="#fff" stroke-width="0.7" opacity="0"',
      kf('r', D, [[0, 2], [TC, 2], [TC + 0.1, 11], [1, 11]], [LIN, OUT, LIN]) + op(D, [[0, 0], [TC, 0], [TC + 0.01, 0.6], [TC + 0.1, 0], [1, 0]]));
    const content = () => K.window(wx, wy, ww, wh, { os: winOs(me), body: 'blank' }) + rem.markup + focus + ring + frame + pointer;
    return floorLine(K, M.x - 24, floor, M.w + 48) + M.draw({ content });
  };

  // ======================================================================================================
  // Camera sharing: a macro of the other device's camera and the video window here. The focus ring turns, the
  // picture comes sharp and the focus brackets (the feature's colour) settle on it; later it lets go again.
  function lens(K, cx, cy, r, D, F0, F1) {
    const glass = K.uid('lg');
    const turn = kfT('rotate', D, [[0, `0 ${f(cx)} ${f(cy)}`], [F0, `0 ${f(cx)} ${f(cy)}`], [F1, `28 ${f(cx)} ${f(cy)}`], [0.86, `28 ${f(cx)} ${f(cy)}`], [0.96, `0 ${f(cx)} ${f(cy)}`], [1, `0 ${f(cx)} ${f(cy)}`]], [LIN, EASE, LIN, EASE, LIN]);
    return `<radialGradient id="${glass}" cx="0.4" cy="0.36" r="0.75"><stop offset="0" stop-color="#1a1a20"/><stop offset="0.6" stop-color="#0a0a0d"/><stop offset="1" stop-color="#030304"/></radialGradient>`
      + circ(cx, cy, r, `fill="${K.ref('body')}" stroke="${K.ref('rim')}" stroke-width="${K.SW.hair}"`)
      + circ(cx, cy, r * 0.9, `fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="${K.SW.fine}"`)
      // The focus ring: one hairline, its index dot turning a little as it focuses (no ring of ticks).
      + `<g>${turn}${circ(cx, cy, r * 0.8, `fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="${K.SW.fine}"`)}`
      + circ(cx, cy - r * 0.8, Math.max(0.6, r * 0.035), 'fill="#fff" fill-opacity="0.55"') + '</g>'
      + circ(cx, cy, r * 0.66, `fill="url(#${glass})" stroke="#fff" stroke-opacity="0.16" stroke-width="${K.SW.fine}"`)
      + circ(cx, cy, r * 0.42, `fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="${K.SW.fine}"`)
      + circ(cx, cy, r * 0.2, 'fill="#000" stroke="#fff" stroke-opacity="0.08" stroke-width="0.5"')
      // A reflection: one thin arc and a point.
      + `<path d="M${f(cx - r * 0.5)} ${f(cy - r * 0.16)}A${f(r * 0.53)} ${f(r * 0.53)} 0 0 1 ${f(cx - r * 0.12)} ${f(cy - r * 0.52)}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="${f(Math.max(0.7, r * 0.03))}" stroke-linecap="round"/>`
      + circ(cx + r * 0.22, cy + r * 0.24, Math.max(0.5, r * 0.025), 'fill="#fff" fill-opacity="0.4"');
  }
  A.camera = (id, K) => {
    const { me: me0, peer } = K.os();
    const me = big(me0) ? me0 : 'win';
    const D = 8;
    const F0 = 0.06; // focusing …
    const F1 = 0.19; // … in focus
    const cx = 114;
    const cy = 118;
    let house = '';
    let r;
    if (!big(peer)) {
      // The back of the phone: its camera island, the lens in it, a flash.
      r = 34;
      const s = 112;
      house = rect(cx - s / 2, cy - s / 2, s, s, 30, `fill="${K.ref('body')}" stroke="${K.ref('rim')}" stroke-width="${K.SW.hair}"`)
        + rect(cx - s / 2 + 30, cy - s / 2, s - 60, 0.7, 0, `fill="${K.ref('edge')}" opacity="0.6"`)
        + circ(cx + s * 0.32, cy - s * 0.32, 4, `fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="${K.SW.fine}"`)
        + circ(cx + s * 0.32, cy + s * 0.32, 1.6, 'fill="#fff" fill-opacity="0.18"');
    } else if (peer === 'mac') {
      // The top of the MacBook's screen: the notch, the camera in it.
      r = 22;
      const nw = 112;
      const nh = 58;
      const top = cy - nh / 2 - 6;
      const fade = K.uid('nf');
      const mask = K.uid('nm');
      house = `<linearGradient id="${fade}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.22" stop-color="#fff"/><stop offset="0.78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="240"><rect x="${f(cx - 100)}" y="0" width="200" height="240" fill="url(#${fade})"/></mask>`
        + `<g mask="url(#${mask})">${rect(cx - 100, top - 14, 200, 14.5, 0, `fill="${K.ref('body')}"`)}${rect(cx - 100, top - 14, 200, 0.7, 0, `fill="${K.ref('edge')}" opacity="0.7"`)}`
        // The menu bar either side of it.
        + rect(cx - 100, top + 12, 200, 0.5, 0, 'fill="#fff" fill-opacity="0.06"')
        + rect(cx - 92, top + 5.2, 12, 1.6, 0.8, 'fill="#fff" fill-opacity="0.2"') + rect(cx - 76, top + 5.2, 7, 1.6, 0.8, 'fill="#fff" fill-opacity="0.1"')
        + rect(cx + 72, top + 5.2, 18, 1.6, 0.8, 'fill="#fff" fill-opacity="0.14"')
        + `<path d="M${f(cx - 100)} ${f(top)}H${f(cx - nw / 2 - 10)}Q${f(cx - nw / 2)} ${f(top)} ${f(cx - nw / 2)} ${f(top + 10)}V${f(top + nh - 16)}Q${f(cx - nw / 2)} ${f(top + nh)} ${f(cx - nw / 2 + 16)} ${f(top + nh)}`
        + `H${f(cx + nw / 2 - 16)}Q${f(cx + nw / 2)} ${f(top + nh)} ${f(cx + nw / 2)} ${f(top + nh - 16)}V${f(top + 10)}Q${f(cx + nw / 2)} ${f(top)} ${f(cx + nw / 2 + 10)} ${f(top)}H${f(cx + 100)}`
        + `" fill="${K.ref('body')}" stroke="#fff" stroke-opacity="0.22" stroke-width="${K.SW.hair}"/></g>`
        + circ(cx + 34, cy - 4, 1.4, 'fill="#fff" fill-opacity="0.16"');
    } else {
      // The top of the PC's screen: a slim bezel, the webcam in it.
      r = 20;
      const bh = 52;
      const fade = K.uid('bf');
      const mask = K.uid('bm');
      house = `<linearGradient id="${fade}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.25" stop-color="#fff"/><stop offset="0.75" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
        + `<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="240"><rect x="${f(cx - 104)}" y="0" width="208" height="240" fill="url(#${fade})"/></mask>`
        + `<g mask="url(#${mask})">${rect(cx - 104, cy - bh / 2, 208, bh, 0, `fill="${K.ref('body')}"`)}`
        + rect(cx - 104, cy - bh / 2, 208, 0.7, 0, `fill="${K.ref('edge')}" opacity="0.7"`)
        + rect(cx - 104, cy + bh / 2 - 0.3, 208, 0.6, 0, 'fill="#fff" fill-opacity="0.14"') + '</g>'
        + circ(cx + 32, cy, 1.4, 'fill="#fff" fill-opacity="0.16"');
    }
    // The video window here: something on a table, soft, then sharp.
    const wx = 214;
    const wy = 58;
    const ww = 160;
    const wh = 124;
    const body = (b) => {
      const c = clipTo(K, rect(b.x, b.y, b.w, b.h, 1.5));
      const bg = K.uid('vb');
      const sp = K.uid('vs');
      const bl = K.uid('vf');
      const hz = b.y + b.h * 0.7;
      const ox = b.x + b.w * 0.5;
      const orr = b.h * 0.2;
      const oy = hz - orr;
      const scene = rect(b.x, hz, b.w, 0.6, 0, 'fill="#fff" fill-opacity="0.14"')
        + `<ellipse cx="${f(ox)}" cy="${f(hz + 1.5)}" rx="${f(orr * 1.2)}" ry="${f(orr * 0.16)}" fill="#000" fill-opacity="0.6"/>`
        + circ(ox, oy, orr, `fill="url(#${sp})" stroke="#fff" stroke-opacity="0.3" stroke-width="${K.SW.fine}"`)
        + `<path d="M${f(ox - orr * 0.62)} ${f(oy - orr * 0.2)}A${f(orr * 0.66)} ${f(orr * 0.66)} 0 0 1 ${f(ox - orr * 0.2)} ${f(oy - orr * 0.62)}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="0.7" stroke-linecap="round"/>`;
      // The focus brackets, closing in on it.
      const fb = { x: ox - orr * 1.6, y: oy - orr * 1.5, w: orr * 3.2, h: orr * 3.1 };
      const k = orr * 0.45;
      const br = `<path d="M${f(fb.x)} ${f(fb.y + k)}V${f(fb.y)}H${f(fb.x + k)}M${f(fb.x + fb.w - k)} ${f(fb.y)}H${f(fb.x + fb.w)}V${f(fb.y + k)}`
        + `M${f(fb.x + fb.w)} ${f(fb.y + fb.h - k)}V${f(fb.y + fb.h)}H${f(fb.x + fb.w - k)}M${f(fb.x + k)} ${f(fb.y + fb.h)}H${f(fb.x)}V${f(fb.y + fb.h - k)}" fill="none" class="ka-st1" stroke-width="0.9" stroke-linecap="round"/>`;
      const fcx = fb.x + fb.w / 2;
      const fcy = fb.y + fb.h / 2;
      return `<radialGradient id="${sp}" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.2"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#fff" stop-opacity="0.02"/></radialGradient>`
        + `<linearGradient id="${bg}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0c10"/><stop offset="0.7" stop-color="#08080a"/><stop offset="1" stop-color="#0b0b0e"/></linearGradient>`
        + `<filter id="${bl}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>`
        + c.def + `<g clip-path="${c.url}">${rect(b.x, b.y, b.w, b.h, 0, `fill="url(#${bg})"`)}`
        + `<g filter="url(#${bl})">${op(D, [[0, 1], [F0, 1], [F1, 0], [0.86, 0], [0.96, 1], [1, 1]], [LIN, EASE, LIN, EASE, LIN])}${scene}</g>`
        + `<g opacity="0">${op(D, [[0, 0], [F0, 0], [F1, 1], [0.86, 1], [0.96, 0], [1, 0]], [LIN, EASE, LIN, EASE, LIN])}${scene}</g>`
        + `<g transform="translate(${f(fcx)} ${f(fcy)})"><g opacity="0">${op(D, [[0, 0], [F0 - 0.03, 0], [F0, 1], [0.84, 1], [0.9, 0], [1, 0]], [LIN, EASE, LIN, EASE, LIN])}`
        + `${kfT('scale', D, [[0, '1.3'], [F0, '1.3'], [F1, '1'], [1, '1']], [LIN, EASE, LIN])}<g transform="translate(${f(-fcx)} ${f(-fcy)})">${br}</g></g></g></g>`;
    };
    const win = K.window(wx, wy, ww, wh, { os: winOs(me), title: `${NAME[peer] || 'Phone'} camera`, body });
    // The field of view: two faint hairlines from the lens to the window.
    const lw = K.uid('fv');
    const fov = `<linearGradient id="${lw}" gradientUnits="userSpaceOnUse" x1="${f(cx)}" y1="0" x2="${wx}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/></linearGradient>`
      + `<path d="M${f(cx + r * 0.5)} ${f(cy - r * 0.5)}L${wx - 6} ${wy + 4}M${f(cx + r * 0.5)} ${f(cy + r * 0.5)}L${wx - 6} ${wy + wh - 4}" fill="none" stroke="url(#${lw})" stroke-width="${K.SW.fine}"/>`;
    return house + fov + lens(K, cx, cy, r, D, F0, F1) + win;
  };
})();
