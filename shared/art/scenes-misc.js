// DenaDesk — Aurora feature pictures: Sound sharing (audio), Remote terminal (terminal) and ReZume (rezume).
// Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Each sets window.AuroraArt[<scene>] = (id, K) => the inner markup of a 400 x 240 picture, drawn with the art kit
// (shared/art/kit.js, K); shared/feature-art.js puts K.defs(id) in the picture's <defs> first. CSP-safe: SVG
// presentation attributes and classes only (no style=""), no scripts; every motion is SMIL, so the reduced-motion
// pause of feature-art.js (svg.pauseAnimations) stills all of it.
// Minimal: hairline monochrome devices, two or three objects, one accent (the feature's colour, or white), one
// slow gesture per round.
//   audio    — the other device plays; one thin sound wave in the feature's colour runs across into a pair of
//              hairline headphones, rings there for a while, and runs out
//   terminal — a terminal window in front of the other computer: a command is typed here, and the other
//              computer's own prompt answers (in white, the one accent); its screen wakes behind
//   rezume   — the page read on the other device (in front) opens on this computer (behind) in a window, at
//              the same line; that line's marker, in the feature's colour, is the one accent
(function () {
  'use strict';
  const A = (window.AuroraArt = window.AuroraArt || {});

  const f = (v) => Math.round(v * 100) / 100;
  const f3 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const REP = 'repeatCount="indefinite"';
  const MONO = 'Geist Mono, ui-monospace, Consolas, monospace';
  const EASE = '0.65 0 0.35 1'; // in and out
  const OUT = '0.2 0.8 0.3 1'; // fast, then settling
  const LIN = '0 0 1 1';
  const rect = (x, y, w, h, rx, attrs = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}/>`;
  const circ = (cx, cy, r, attrs = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
  const bar = (x, y, w, t, op) => rect(x, y, w, t, t / 2, `fill="#fff" fill-opacity="${op}"`);
  const hair = (op, w = 0.75) => `fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="${w}"`;

  // ---- placing the kit's devices ----
  const KIND = { win: 'winPc', mac: 'macBook', linux: 'linuxPc', android: 'phone', tablet: 'tablet' };
  const ASPECT = { win: 1.27, mac: 1.57, linux: 1.48, android: 0.5, tablet: 1.45 };
  const isPc = (os) => os === 'win' || os === 'mac' || os === 'linux';
  const kindOf = (os) => KIND[os] || 'laptop';
  const aspect = (os) => ASPECT[os] || 1.48;
  // A device of that OS, w wide (its height from its shape) at x, y: its screen's content area and whole screen.
  function place(K, os, x, y, w, o = {}) {
    const h = w / aspect(os);
    const kind = kindOf(os);
    const draw = (more = {}) => {
      const opt = Object.assign({}, o, more);
      return os === 'android' ? K.phone(x, y, w, h, opt) : K.computer(os, x, y, w, h, opt);
    };
    return { os, kind, x, y, w, h, scr: K.screen(kind, x, y, w, h, o), full: K.screenRect(kind, x, y, w, h, o), draw };
  }

  // ---- SMIL ----
  const splines = (list) => ` calcMode="spline" keySplines="${list.join(';')}"`;
  function anim(attr, dur, values, times, o = {}) {
    return `<animate attributeName="${attr}" dur="${dur}s" ${REP} values="${values}" keyTimes="${times}"`
      + (o.ks ? splines(o.ks) : ` calcMode="${o.calc || 'linear'}"`) + '/>';
  }
  function animT(type, dur, values, times, o = {}) {
    return `<animateTransform attributeName="transform" type="${type}" dur="${dur}s" ${REP} values="${values}" keyTimes="${times}"`
      + (o.ks ? splines(o.ks) : ` calcMode="${o.calc || 'linear'}"`) + (o.add ? ' additive="sum"' : '') + '/>';
  }
  const opac = (dur, values, times, o) => anim('opacity', dur, values, times, o);
  // Faded in over [a, b], held, faded out over [c, d] (parts of a round), eased.
  const inOut = (dur, a, b, c, d, hi = 1, lo = 0) => opac(dur, `${lo};${lo};${hi};${hi};${lo};${lo}`,
    `0;${f3(a)};${f3(b)};${f3(c)};${f3(d)};1`, { ks: [LIN, EASE, LIN, EASE, LIN] });
  // Reduced motion: feature-art.js pauses the picture at 1.6 s. Shift this scene's round (every animation of
  // dur T) so that still frame is the moment that tells the story (part `at` of the round), not its start.
  function still(out, T, at) {
    let reduced = false;
    try { reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* no media queries */ }
    if (!reduced) return out;
    return out.replace(new RegExp(`dur="${T}s" `, 'g'), `dur="${T}s" begin="${f(1.6 - at * T)}s" `);
  }

  // =====================================================================================================
  // Sound sharing: the other device on the left plays; one thin wave in the feature's colour runs across
  // into a pair of hairline headphones on the right, rings there a while (its phase flowing, its ends still),
  // then runs out into them. A faint light behind the headphones while they play.
  // =====================================================================================================
  // A sound wave from x1 to x2 at y: still at both ends, at phase ph.
  function wavePath(x1, x2, y, amp, len, ph) {
    const n = Math.round((x2 - x1) / 1.6);
    let d = '';
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = x1 + (x2 - x1) * u;
      const env = Math.pow(Math.sin(Math.PI * u), 1.6);
      d += `${i ? 'L' : 'M'}${f(x)} ${f(y + amp * env * Math.sin((2 * Math.PI * (x - x1)) / len - ph))}`;
    }
    return d;
  }
  // Its phase flowing from left to right, frame by frame (the same points in each, so they interpolate).
  function flowingWave(x1, x2, y, amp, len, dur, attrs) {
    const frames = [];
    for (let i = 0; i <= 12; i++) frames.push(wavePath(x1, x2, y, amp, len, (i / 12) * 2 * Math.PI));
    return `<path d="${frames[0]}" ${attrs}><animate attributeName="d" dur="${dur}s" ${REP} values="${frames.join(';')}"/></path>`;
  }
  // Hairline headphones (an SF Symbols-like glyph), centred on x, their cups' middle at y.
  function headphones(K, x, y, s = 1) {
    const R = 27 * s;
    const cw = 11 * s;
    const ch = 25 * s;
    const top = y - ch / 2 + 3 * s; // where the band meets the cups
    const band = (r, op, w) => `<path d="M${f(x - r)} ${f(top)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(top)}" ${hair(op, w)} stroke-linecap="round"/>`;
    let out = '<g class="ka-headphones">';
    out += band(R, 0.42, 0.85) + band(R - 3 * s, 0.14, 0.6);
    // The key edge: the top of the band catching the light.
    out += `<path d="M${f(x - R * 0.62)} ${f(top - R * 0.78)}A${f(R)} ${f(R)} 0 0 1 ${f(x + R * 0.62)} ${f(top - R * 0.78)}" fill="none" stroke="${K.ref('edge')}" stroke-width="0.9" stroke-linecap="round"/>`;
    [-1, 1].forEach((side) => {
      const cx = x + side * R;
      out += rect(cx - cw / 2, y - ch / 2, cw, ch, cw * 0.46, `fill="${K.ref('body')}" stroke="${K.ref('rim')}" stroke-width="0.75"`);
      // The cushion: a hairline on the inner side.
      out += rect(side < 0 ? cx + cw / 2 - 2.2 * s : cx - cw / 2 + 1.2 * s, y - ch * 0.32, 1 * s, ch * 0.64, 0.5 * s, 'fill="#fff" fill-opacity="0.14"');
    });
    return out + '</g>';
  }
  // A now-playing card in the area b: artwork, title, artist, a progress line that moves on through the round.
  function nowPlaying(K, b, D, phone) {
    let out = '';
    const t = Math.max(0.7, Math.min(b.w, b.h) * 0.035);
    if (phone) {
      const s = b.w * 0.7;
      const ax = b.x + (b.w - s) / 2;
      const ay = b.y + b.h * 0.1;
      out += rect(ax, ay, s, s, s * 0.08, `fill="#fff" fill-opacity="0.035" stroke="#fff" stroke-opacity="0.1" stroke-width="0.55"`);
      out += note(ax + s / 2, ay + s / 2, s * 0.2);
      const ty = ay + s + b.h * 0.07;
      out += bar(ax, ty, s * 0.62, t, 0.24) + bar(ax, ty + t * 2.6, s * 0.4, t, 0.1);
      out += progress(ax, ty + t * 6.4, s, D);
      return out;
    }
    const s = Math.min(b.h * 0.86, b.w * 0.34);
    const ay = b.y + (b.h - s) / 2;
    out += rect(b.x, ay, s, s, s * 0.08, `fill="#fff" fill-opacity="0.035" stroke="#fff" stroke-opacity="0.1" stroke-width="0.55"`);
    out += note(b.x + s / 2, ay + s / 2, s * 0.2);
    const tx = b.x + s + b.w * 0.08;
    const tw = b.x + b.w - tx;
    out += bar(tx, ay + s * 0.12, tw * 0.7, t, 0.24) + bar(tx, ay + s * 0.12 + t * 2.6, tw * 0.45, t, 0.1);
    out += progress(tx, ay + s * 0.8, tw, D);
    return out;
  }
  const note = (x, y, r) => `<path d="M${f(x - r * 0.25)} ${f(y + r * 0.7)}V${f(y - r)}l${f(r * 0.9)} ${f(-r * 0.25)}v${f(r * 1.45)}" ${hair(0.24, 0.6)} stroke-linecap="round" stroke-linejoin="round"/>`
    + circ(x - r * 0.55, y + r * 0.72, r * 0.32, hair(0.24, 0.6)) + circ(x + r * 0.33, y + r * 0.46, r * 0.32, hair(0.24, 0.6));
  function progress(x, y, w, D) {
    return rect(x, y - 0.3, w, 0.6, 0.3, 'fill="#fff" fill-opacity="0.12"')
      + `<rect x="${f(x)}" y="${f(y - 0.3)}" width="${f(w * 0.34)}" height="0.6" fill="#fff" fill-opacity="0.5">`
      + anim('width', D, `${f(w * 0.34)};${f(w * 0.52)}`, '0;1') + '</rect>';
  }

  A.audio = (id, K) => {
    const { peer } = K.os();
    const D = 8;
    const wy = 122; // the wave's line, the device's screen middle and the cups' middle
    let src = peer;
    if (!isPc(src) && src !== 'tablet') src = 'android';
    const DW = { android: 54, tablet: 118, win: 128, mac: 146, linux: 138 };
    const dw = DW[src];
    const waveLen = src === 'android' ? 104 : 80;
    const gap = 14;
    const hw = 27 * 2 + 11; // the headphones, cup to cup
    const x0 = 200 - (dw + gap + waveLen + gap + hw) / 2;
    // The device: its screen's middle on the wave's line.
    const probe = place(K, src, 0, 0, dw);
    const dev = place(K, src, x0, wy - (probe.full.y + probe.full.h / 2), dw);
    const hx = x0 + dw + gap + waveLen + gap + hw / 2;
    const x1 = dev.full.x + dev.full.w + gap - (src === 'android' ? 0 : 4);
    const x2 = hx - hw / 2 - 8;

    let out = '';
    // The device, playing.
    const content = (ar) => {
      if (src === 'android') return nowPlaying(K, { x: ar.x + ar.w * 0.08, y: ar.y, w: ar.w * 0.84, h: ar.h }, D, true);
      if (src === 'tablet') return nowPlaying(K, { x: ar.x + ar.w * 0.14, y: ar.y + ar.h * 0.2, w: ar.w * 0.72, h: ar.h * 0.6 }, D, false);
      const ww = ar.w * 0.72;
      const wh = ar.h * 0.56;
      return K.window(ar.x + (ar.w - ww) / 2, ar.y + (ar.h - wh) / 2, ww, wh, { os: src, body: (b) => nowPlaying(K, b, D, false) });
    };
    out += dev.draw({ content });
    out += headphones(K, hx, wy);
    // The wave: drawn on from the device to the headphones, ringing, then running out into them.
    const cid = K.uid('wc');
    const W = x2 - x1;
    out += `<clipPath id="${cid}"><rect x="${f(x1 - 2)}" y="${f(wy - 24)}" width="0" height="48">`
      + anim('x', D, `${f(x1 - 2)};${f(x1 - 2)};${f(x1 - 2)};${f(x1 - 2)};${f(x2 + 2)};${f(x2 + 2)}`, '0;0.06;0.26;0.74;0.9;1', { ks: [LIN, EASE, LIN, EASE, LIN] })
      + anim('width', D, `0;0;${f(W + 4)};${f(W + 4)};0;0`, '0;0.06;0.26;0.74;0.9;1', { ks: [LIN, EASE, LIN, EASE, LIN] })
      + '</rect></clipPath>';
    out += `<g clip-path="url(#${cid})">`
      + flowingWave(x1, x2, wy, 4.2, 23, 6, 'fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="0.6" stroke-linecap="round"')
      + flowingWave(x1, x2, wy, 8, 16, 4, 'class="ka-st1" fill="none" stroke-opacity="0.72" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"')
      + '</g>';
    return still(out, D, 0.5);
  };

  // =====================================================================================================
  // Remote terminal: the other computer stands behind; a terminal window floats in front of it, on this
  // computer. A command is typed, the link answers, and the other computer's own prompt comes up (white, the
  // one accent) while its screen wakes behind. A long rest, and the round begins again.
  // =====================================================================================================
  const HOST = { mac: 'macbook', win: 'windows-pc', linux: 'linux-box' };
  const LOCAL = { mac: '~ %', win: 'PS C:\\>', linux: '~ $' };
  const REMOTE = { mac: 'macbook ~ %', win: 'PS C:\\Users\\you>', linux: 'you@linux-box:~$' };

  A.terminal = (id, K) => {
    const { me, peer } = K.os();
    const D = 10;
    const here = isPc(me) ? me : 'win';
    const there = isPc(peer) ? peer : here === 'mac' ? 'win' : 'mac';
    const floor = 188;
    // The other computer, behind, on the right.
    const RW = { win: 150, mac: 176, linux: 166 };
    const rw = RW[there];
    const R = place(K, there, 372 - rw, floor - rw / aspect(there), rw);
    // The terminal window, in front, on the left, over the other computer's left edge.
    const tx = 30;
    const ty = 66;
    const tw = 198;
    const th = 104;

    let out = '';
    out += `<rect x="40" y="${f(floor + 0.2)}" width="330" height="0.6" fill="${K.ref('edge')}" opacity="0.26"/>`;
    // Its screen: a quiet shell window on the right, waking (brighter) once connected.
    const ra = R.scr;
    const rwin = [ra.x + ra.w * 0.42, ra.y + ra.h * 0.16, ra.w * 0.5, ra.h * 0.6];
    const rContent = `<g opacity="0.45">${inOut(D, 0.46, 0.54, 0.88, 0.95, 1, 0.45)}`
      + K.terminal(...rwin, { lines: [[[0, 0.1], [0, 0.42]], [[0, 0.3]]], cursor: false }) + '</g>';
    out += R.draw({ content: rContent });
    // The window's shadow, so it stands off the computer behind it.
    out += rect(tx + 4, ty + 8, tw - 8, th, 10, `fill="#000" opacity="0.7" filter="${K.ref('blur')}"`);
    const title = `${HOST[there]} — ssh`;
    const fs = 8.4;
    const cw = fs * 0.6;
    const body = (b) => {
      const lx = b.x + 4;
      const ly = (i) => b.y + 12 + i * 15;
      const text = (x, y, s, op, extra = '') => `<text class="ka-mono" x="${f(x)}" y="${f(y)}" font-family="${MONO}" font-size="${fs}" fill="#fff" fill-opacity="${op}" xml:space="preserve"${extra}>${esc(s)}</text>`;
      const local = LOCAL[here] + ' ';
      const cmd = 'ssh ' + HOST[there];
      const remote = REMOTE[there] + ' ';
      let o = text(lx, ly(0), local, 0.3);
      // The command, typed a letter at a time.
      const cx = lx + local.length * cw;
      const t0 = 0.1;
      const t1 = 0.32;
      const n = cmd.length;
      const widths = [0];
      const times = [0];
      for (let i = 0; i <= n; i++) {
        widths.push(f(i * cw + (i === n ? 2 : 0)));
        times.push(f3(t0 + ((t1 - t0) * i) / n));
      }
      widths.push(0);
      times.push(0.95);
      const clip = K.uid('ty');
      o += `<clipPath id="${clip}"><rect x="${f(cx)}" y="${f(ly(0) - fs)}" width="0" height="${f(fs * 1.5)}">`
        + anim('width', D, widths.join(';'), times.join(';'), { calc: 'discrete' }) + '</rect></clipPath>';
      o += `<g clip-path="url(#${clip})">${text(cx, ly(0), cmd, 0.56)}</g>`;
      // The answer, and the other computer's prompt: the one accent, white.
      o += `<g opacity="0">${inOut(D, 0.38, 0.42, 0.9, 0.95)}${text(lx, ly(1), 'connected · 4 ms', 0.26)}</g>`;
      o += `<g opacity="0">${inOut(D, 0.46, 0.5, 0.9, 0.95)}${text(lx, ly(2), remote, 0.95, ' font-weight="500"')}</g>`;
      // The cursor: after the command while it's typed, then after the other computer's prompt.
      const cy0 = ly(0) - fs * 0.78;
      const cy2 = ly(2) - fs * 0.78;
      const xs = [cx];
      const ys = [cy0];
      const ct = [0];
      for (let i = 1; i <= n; i++) { xs.push(f(cx + i * cw)); ys.push(f(cy0)); ct.push(times[i + 1]); }
      xs.push(f(lx + remote.length * cw)); ys.push(f(cy2)); ct.push(0.5);
      xs.push(f(cx)); ys.push(f(cy0)); ct.push(0.95);
      o += `<rect x="${f(cx)}" y="${f(cy0)}" width="${f(cw * 0.9)}" height="${f(fs * 1.02)}" rx="0.6" fill="#fff" fill-opacity="0.62">`
        + anim('x', D, xs.join(';'), ct.join(';'), { calc: 'discrete' }) + anim('y', D, ys.join(';'), ct.join(';'), { calc: 'discrete' })
        + `<animate attributeName="opacity" dur="2.4s" ${REP} values="1;0.25;1" keyTimes="0;0.5;1" calcMode="spline" keySplines="${EASE};${EASE}"/>`
        + '</rect>';
      return o;
    };
    out += K.window(tx, ty, tw, th, { os: here, title, body });
    return still(out, D, 0.6);
  };

  // =====================================================================================================
  // ReZume: the other device stands in front, a page open on it, the line you were at marked in the
  // feature's colour (the one accent). The page opens on this computer behind — a window rising gently into
  // place — at the same line, while the device in front dims. A long rest; it closes; again.
  // =====================================================================================================
  // A page in the area b: a heading, a picture, lines; the marked line is `at` (index), its marker shown by `mark`.
  function page(K, b, at, mark, o = {}) {
    const t = Math.max(0.7, Math.min(3, b.w * (o.phone ? 0.032 : 0.018)));
    const lh = t * (o.phone ? 2.9 : 2.8);
    let y = b.y + b.h * 0.06;
    let out = bar(b.x, y, b.w * 0.58, t * 1.2, 0.26);
    y += t * 3.2;
    const ph = o.phone ? b.w * 0.5 : b.h * 0.3;
    out += rect(b.x, y, b.w, ph, Math.min(b.w, ph) * 0.06, 'fill="#fff" fill-opacity="0.03" stroke="#fff" stroke-opacity="0.08" stroke-width="0.55"');
    y += ph + lh * 0.9;
    const W = [0.94, 0.86, 0.9, 0.62, 0.88, 0.8, 0.92, 0.7];
    let my = 0;
    for (let i = 0; i < W.length && y + t < b.y + b.h; i++, y += lh) {
      out += bar(b.x, y, b.w * W[i], t, i === at ? 0.3 : 0.1);
      if (i === at) my = y;
    }
    // The marker: a short bar in the feature's colour, left of the line.
    out += `<rect x="${f(b.x - t * 2.6)}" y="${f(my - t * 0.9)}" width="${f(Math.max(0.9, t * 0.9))}" height="${f(t * 2.8)}" rx="${f(t * 0.45)}" class="ka-f1" opacity="0">${mark}</rect>`;
    return out;
  }

  A.rezume = (id, K) => {
    const { me, peer } = K.os();
    const D = 9;
    const here = isPc(me) ? me : 'win';
    let front = peer;
    if (!isPc(front) && front !== 'tablet') front = 'android';
    const floor = 192;
    // This computer, behind, on the right.
    const BW = { win: 176, mac: 204, linux: 192 };
    const bw = BW[here];
    const FW = { android: 58, tablet: 124, win: 116, mac: 130, linux: 124 };
    const fw = FW[front];
    const fh = fw / aspect(front);
    const over = front === 'android' ? 14 : 22; // how far the device in front stands over the computer
    const x0 = 200 - (fw + bw - over) / 2;
    const B = place(K, here, x0 + fw - over, floor - 8 - bw / aspect(here), bw);
    const F = place(K, front, x0, floor - fh + (front === 'android' ? 6 : 4), fw);

    // Timeline (parts of a round): the window rises 0.3-0.44, its marker 0.44-0.5; the device in front dims
    // 0.32-0.44; rest; the window goes 0.84-0.92 and the device in front comes back 0.88-0.96.
    let out = '';
    out += `<rect x="36" y="${f(floor + 0.2)}" width="328" height="0.6" fill="${K.ref('edge')}" opacity="0.26"/>`;
    // This computer: an empty desk, then the window.
    const ar = B.scr;
    const ww = ar.w * 0.62;
    const wh = ar.h * 0.76;
    const wx = ar.x + (ar.w - ww) / 2;
    const wy = ar.y + (ar.h - wh) / 2 + ar.h * 0.02;
    const at = 2;
    const winEl = K.window(wx, wy, ww, wh, { os: here, body: (b) => page(K, { x: b.x + b.w * 0.08, y: b.y, w: b.w * 0.84, h: b.h }, at,
      inOut(D, 0.44, 0.5, 0.84, 0.9, 0.9)) });
    const bContent = `<g opacity="0">${inOut(D, 0.3, 0.42, 0.84, 0.92)}`
      + `<g>${animT('translate', D, `0 6;0 6;0 0;0 0;0 3;0 6`, `0;0.3;0.44;0.84;0.92;1`, { ks: [LIN, OUT, LIN, EASE, LIN] })}${winEl}</g></g>`;
    out += B.draw({ content: bContent, apps: false });
    // The one faint light, under the device in front.
    out += `<ellipse cx="${f(F.x + fw / 2)}" cy="${f(F.y + fh)}" rx="${f(fw * 0.7)}" ry="5" fill="${K.ref('r-f1')}" opacity="0.22"/>`;
    // The device in front: the page, the line marked; it dims once the page has gone over.
    const fContent = (a) => `<g>${inOut(D, 0.32, 0.44, 0.88, 0.96, 0.4, 1)}`
      + page(K, front === 'android' ? { x: a.x + a.w * 0.16, y: a.y + a.h * 0.02, w: a.w * 0.72, h: a.h * 0.9 } : { x: a.x + a.w * 0.2, y: a.y + a.h * 0.08, w: a.w * 0.62, h: a.h * 0.84 },
        at, inOut(D, 0.32, 0.42, 0.88, 0.96, 0, 0.9), { phone: front === 'android' })
      + '</g>';
    out += F.draw({ content: fContent, apps: false });
    return still(out, D, 0.6);
  };
})();
