/* DenaDesk website: the features bento comes alive (partials/bento.html, showcase-bento.css).
   Each card holds one hairline SVG picture that is already complete without JS (and is the still for
   prefers-reduced-motion). This script runs one gesture per card, slow and eased, and lets the visitor take
   over: the pointer becomes the shared cursor, the window can be dragged onto the tablet, the file line can be
   plucked, the call answered, the document scrolled. One requestAnimationFrame loop drives only the cards on
   screen and stops when none is, or when the tab is hidden. CSP-safe: no inline styles or eval; it only
   sets SVG attributes, classes and two CSS custom properties through the CSSOM. */
(() => {
  'use strict';

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const n2 = (v) => (Math.round(v * 100) / 100).toString();
  const $ = (r, s) => r.querySelector(s);
  const $$ = (r, s) => [...r.querySelectorAll(s)];
  const at = (el, k, v) => { if (el) el.setAttribute(k, v); };
  const op = (el, v) => at(el, 'opacity', n2(clamp(v, 0, 1)));
  const tr = (el, x, y, s) => at(el, 'transform', `translate(${n2(x)} ${n2(y)})${s !== undefined && s !== 1 ? ` scale(${Math.round(s * 1e4) / 1e4})` : ''}`);
  // Scale k about the point (cx, cy).
  const about = (el, cx, cy, k, dx = 0, dy = 0) => at(el, 'transform', `translate(${n2(cx * (1 - k) + dx)} ${n2(cy * (1 - k) + dy)}) scale(${Math.round(k * 1e4) / 1e4})`);
  const toSvg = (svg, e) => {
    const m = svg.getScreenCTM();
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
  };
  const textLen = (el) => { try { return el.getComputedTextLength(); } catch { return 0; } };
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ================= One mouse and keyboard =================
     A Windows PC and a Mac. The two screens are one desktop: the pointer runs across both, jumping the seam
     between them (a violet hairline marks the crossing), and the keyboard follows it: where the cursor rests,
     that machine's field takes the typing. On a mouse the visitor's own pointer drives it. */
  function kvm(svg) {
    const cur = $(svg, '.sx-cur');
    const trail = $(svg, '.sx-trail');
    const edges = [$(svg, '.sx-edge-a'), $(svg, '.sx-edge-b')];
    const bridge = $(svg, '.sx-bridge');
    const caret = $(svg, '.sx-caret');
    const glow = $(svg, '.sx-kglow');
    const lbl = [$(svg, '.sx-lbl-a'), $(svg, '.sx-lbl-b')];
    const ldots = [$(svg, '.sx-ldot-a'), $(svg, '.sx-ldot-b')];
    const res = $(svg, '.sx-res');
    const cell = $(svg, '.sx-cell');
    const sent = $(svg, '.sx-sent');
    const bub = $(svg, '.sx-bub');
    const bubt = $(svg, '.sx-bubt');
    const S = [
      { x0: 38, x1: 251, y0: 52, y1: 172, cx: 144, field: $(svg, '.sx-ty-a'), text: '=SUM(B2:B9)', cy: 77.6 },
      { x0: 326, x1: 521, y0: 134, y1: 244, cx: 424, field: $(svg, '.sx-ty-b'), text: 'Meet at 5?', cy: 226.8 },
    ];
    const LW = S[0].x1 - S[0].x0;
    const TW = LW + S[1].x1 - S[1].x0;
    const segs = [];
    for (let i = 0; i < 14; i++) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('class', 'sx-acc-stroke');
      l.setAttribute('stroke-linecap', 'round');
      l.setAttribute('opacity', '0');
      trail.appendChild(l);
      segs.push(l);
    }
    const proj = (u, v) => {
      const s = u <= LW ? 0 : 1;
      const d = S[s];
      return { s, x: s ? d.x0 + (u - LW) : d.x0 + u, y: d.y0 + v * (d.y1 - d.y0) };
    };
    const st = { u: 300, v: 0.82, tu: 300, tv: 0.82, side: 1, dwell: 0, flash: [0, 0], bridge: 0, pts: [], user: false, idle: 0 };
    const F = [{ n: 0, mode: 'empty', t: 0 }, { n: 0, mode: 'empty', t: 0 }];
    // The autoplay route, in desktop units (u across both screens, v down): [u, v, seconds to rest there].
    const ROUTE = [[120, 0.72, 0.7], [92, 0.26, 2.2], [168, 0.5, 0.1], [292, 0.86, 2.9], [350, 0.4, 0.8], [140, 0.62, 0.6]];
    let leg = 0;
    let legT = 0;
    let from = { u: st.u, v: st.v };
    let resting = 0;

    function setField(i, n) {
      const f = F[i];
      f.n = n;
      S[i].field.textContent = S[i].text.slice(0, n);
    }
    function clearField(i) {
      setField(i, 0);
      F[i].mode = 'empty';
      if (i === 0) { op(res, 0); at(cell, 'stroke-opacity', '0.5'); }
      else op(sent, 0);
    }
    function enter(i) {
      F[i].mode = 'done';
      if (i === 0) { F[i].t = 0; }
      else {
        // Send: the reply rises from the field into the thread.
        F[i].t = 0;
        bubt.textContent = S[1].text;
        const w = textLen(bubt) + 9;
        at(bub, 'x', n2(498 - w));
        at(bub, 'width', n2(w));
      }
    }
    function reset() {
      clearField(0); clearField(1);
      leg = 0; legT = 0; resting = 0;
      st.u = st.tu = 300; st.v = st.tv = 0.82;
      from = { u: st.u, v: st.v };
      st.pts = [];
      st.side = 1;
      lbl[0].classList.remove('on'); lbl[1].classList.add('on');
      placeDot(1);
    }
    function still() {
      setField(0, S[0].text.length); setField(1, 0);
      op(res, 1); op(sent, 1); tr(sent, 0, 0);
      bubt.textContent = S[1].text;
      const w = textLen(bubt) + 9;
      if (w > 9) { at(bub, 'x', n2(498 - w)); at(bub, 'width', n2(w)); }
      const p = proj(300, 0.82);
      tr(cur, p.x, p.y);
      at(caret, 'x', n2(S[1].field.getAttribute('x') * 1 + 0.5)); at(caret, 'y', n2(S[1].cy));
      lbl[0].classList.remove('on'); lbl[1].classList.add('on');
      placeDot(1);
      segs.forEach((l) => op(l, 0));
      op(edges[0], 0); op(edges[1], 0); op(bridge, 0);
    }
    let dotsPlaced = false;
    function placeDot(s) {
      if (!dotsPlaced) {
        try {
          lbl.forEach((l, i) => { const b = l.getBBox(); if (b.width) { at(ldots[i], 'cx', n2(b.x - 7.5)); dotsPlaced = true; } });
        } catch { /* not rendered yet */ }
      }
      op(ldots[0], s === 0 ? 1 : 0);
      op(ldots[1], s === 1 ? 1 : 0);
    }
    function tick(dt) {
      // Where the cursor wants to be: the visitor's pointer, or the next stop of the route.
      if (!st.user) {
        if (resting > 0) {
          resting -= dt;
          if (resting <= 0) { from = { u: st.u, v: st.v }; legT = 0; leg = (leg + 1) % ROUTE.length; if (leg === 0) { clearField(0); clearField(1); } }
        } else {
          const [tu, tv, hold] = ROUTE[leg];
          const dist = Math.hypot((tu - from.u) / TW, tv - from.v);
          const dur = 0.7 + dist * 1.8;
          legT += dt / dur;
          const k = ease(clamp(legT, 0, 1));
          st.tu = lerp(from.u, tu, k);
          st.tv = lerp(from.v, tv, k) - Math.sin(k * Math.PI) * 0.06;
          if (legT >= 1) resting = hold;
        }
      }
      const kk = st.user ? 1 - Math.exp(-dt * 16) : 1;
      const pu = st.u;
      st.u = lerp(st.u, st.tu, kk);
      st.v = lerp(st.v, st.tv, kk);
      const p = proj(st.u, st.v);
      const speed = Math.abs(st.u - pu) / Math.max(dt, 1e-3);
      tr(cur, p.x, p.y);
      // Crossing the seam: the edge it leaves through flashes, a dotted hairline bridges the gap.
      if (p.s !== st.side) {
        const yA = S[0].y0 + st.v * (S[0].y1 - S[0].y0);
        const yB = S[1].y0 + st.v * (S[1].y1 - S[1].y0);
        at(bridge, 'd', `M252 ${n2(yA)}Q288 ${n2(Math.min(yA, yB) - 26)} 325 ${n2(yB)}`);
        st.bridge = 1;
        st.flash = [1, 1];
        st.side = p.s;
        st.dwell = 0;
        st.pts = [];
        lbl[0].classList.toggle('on', p.s === 0);
        lbl[1].classList.toggle('on', p.s === 1);
        placeDot(p.s);
        if (F[p.s].mode === 'done') { F[p.s].mode = 'reset'; F[p.s].t = 0; }
      }
      st.flash = st.flash.map((v) => Math.max(0, v - dt * 1.6));
      st.bridge = Math.max(0, st.bridge - dt * 1.3);
      const nearA = st.side === 0 ? clamp(1 - (S[0].x1 - p.x) / 46, 0, 1) : 0;
      const nearB = st.side === 1 ? clamp(1 - (p.x - S[1].x0) / 46, 0, 1) : 0;
      op(edges[0], Math.max(st.flash[0], nearA * 0.55));
      op(edges[1], Math.max(st.flash[1], nearB * 0.55));
      op(bridge, st.bridge * 0.9);
      // The violet light under the machine that has the keyboard.
      const gx = lerp(+glow.getAttribute('cx'), S[st.side].cx, 1 - Math.exp(-dt * 3));
      at(glow, 'cx', n2(gx));
      // Trail: the last quarter second of the cursor, fading.
      const now = performance.now();
      st.pts.unshift({ x: p.x, y: p.y, t: now });
      while (st.pts.length > 15 || (st.pts.length && now - st.pts[st.pts.length - 1].t > 260)) st.pts.pop();
      segs.forEach((l, i) => {
        const a = st.pts[i];
        const b = st.pts[i + 1];
        if (!a || !b) { op(l, 0); return; }
        at(l, 'x1', n2(a.x)); at(l, 'y1', n2(a.y)); at(l, 'x2', n2(b.x)); at(l, 'y2', n2(b.y));
        op(l, (1 - i / segs.length) * 0.7 * clamp(Math.hypot(a.x - b.x, a.y - b.y) / 3, 0, 1));
      });
      // Typing follows the cursor: rest on a machine and its field takes the keys.
      st.dwell = speed < 30 ? st.dwell + dt : 0;
      const f = F[st.side];
      f.t += dt;
      if (f.mode === 'reset' && f.t > 0.2) clearField(st.side);
      if (f.mode === 'empty' && st.dwell > 0.35) { f.mode = 'typing'; f.t = 0; }
      if (f.mode === 'typing' && f.t > 0.085 + ((f.n * 37) % 5) * 0.012) {
        f.t = 0;
        setField(st.side, f.n + 1);
        if (f.n >= S[st.side].text.length) { f.mode = 'typed'; }
      }
      if (f.mode === 'typed' && f.t > 0.55) enter(st.side);
      // After Enter: the sum appears in its cell / the reply rises into the thread.
      const d0 = F[0];
      if (d0.mode === 'done') { op(res, easeOut(seg(d0.t, 0, 0.4))); at(cell, 'stroke-opacity', n2(0.5 + 0.4 * Math.max(0, 1 - d0.t * 2))); }
      const d1 = F[1];
      if (d1.mode === 'done') {
        const k = easeOut(seg(d1.t, 0, 0.6));
        op(sent, k); tr(sent, 0, (1 - k) * 30);
        if (d1.t < 0.05) setField(1, 0);
      }
      const fe = S[st.side].field;
      at(caret, 'x', n2(+fe.getAttribute('x') + textLen(fe) + 0.8));
      at(caret, 'y', n2(S[st.side].cy));
    }
    return {
      reset, still, tick,
      move(p) {
        if (!FINE.matches) return;
        st.user = true;
        st.tu = clamp((p.x - 40) / 480, 0, 1) * TW;
        st.tv = clamp((p.y - 60) / 190, 0, 1);
      },
      leave() { st.user = false; from = { u: st.u, v: st.v }; legT = 0; resting = 0.8; },
    };
  }

  /* ================= A second screen =================
     A Mac and a tablet beside it. The tablet is the Mac's second display: a window drifts across the seam (it is
     drawn twice, clipped to each screen, so it splits over the gap like a real extended desktop) and the tablet
     lights softly as it arrives. The visitor can drag the window themselves. */
  function screen2(svg, stageEl) {
    const ws = $$(svg, '.sx-w');
    const grab = $(svg, '.sx-grab');
    const cur = $(svg, '.sx-cur');
    const light = $(svg, '.sx-light');
    const d2 = $(svg, '.sx-d2');
    const tglow = $(svg, '.sx-tglow');
    const LAP = { x: 80, y: 58 };
    const TAB = { x: 212, y: 137 };
    const TS = { x0: 189, x1: 319, y0: 123, y1: 211 };
    const st = { x: TAB.x, y: TAB.y, ax: 0, ay: 0, t: 0, tw: null, drag: null, hover: false, cx: 0, cy: 0, side: 1, hold: 1.8 };
    function place() {
      ws.forEach((w) => tr(w, st.x, st.y));
      at(grab, 'x', n2(st.x)); at(grab, 'y', n2(st.y));
      const ov = (clamp(Math.min(st.x + 84, TS.x1) - Math.max(st.x, TS.x0), 0, 84) / 84) * (clamp(Math.min(st.y + 56, TS.y1) - Math.max(st.y, TS.y0), 0, 56) / 56);
      st.ov = ov;
      op(light, 0.12 + ov * 0.8);
      op(d2, (1 - ov) * 0.9);
      op(tglow, 0.15 + ov * 0.6);
    }
    function goTo(p, dur) { st.tw = { fx: st.x, fy: st.y, tx: p.x, ty: p.y, t: 0, dur }; }
    function reset() { st.x = LAP.x; st.y = LAP.y; st.side = 0; st.hold = 1.6; st.tw = null; st.cx = LAP.x + 60; st.cy = LAP.y + 38; place(); }
    function still() { st.x = TAB.x; st.y = TAB.y; place(); tr(cur, st.x + 60, st.y + 38); op(cur, 1); }
    function tick(dt) {
      if (st.drag) {
        st.x = lerp(st.x, st.drag.tx, 1 - Math.exp(-dt * 22));
        st.y = lerp(st.y, st.drag.ty, 1 - Math.exp(-dt * 22));
      } else if (st.tw) {
        const w = st.tw;
        w.t += dt / w.dur;
        const k = w.spring ? easeBack(clamp(w.t, 0, 1)) : ease(clamp(w.t, 0, 1));
        st.x = lerp(w.fx, w.tx, k);
        st.y = lerp(w.fy, w.ty, k) - (w.spring ? 0 : Math.sin(clamp(w.t, 0, 1) * Math.PI) * 10);
        if (w.t >= 1) { st.tw = null; st.hold = 2.6; }
      } else if (!st.hover) {
        st.hold -= dt;
        if (st.hold <= 0) { st.side = st.ov > 0.35 ? 0 : 1; goTo(st.side ? TAB : LAP, 2.6); }
      }
      place();
      // The autoplay cursor: rests nearby, then takes the title bar just before a move.
      const moving = st.tw && !st.tw.spring;
      const near = moving || (st.hold < 0.6 && !st.hover);
      const tx = st.x + (near ? 44 : 60);
      const ty = st.y + (near ? 4.5 : 38);
      st.cx = lerp(st.cx, tx, 1 - Math.exp(-dt * (moving ? 30 : 5)));
      st.cy = lerp(st.cy, ty, 1 - Math.exp(-dt * (moving ? 30 : 5)));
      tr(cur, st.cx, st.cy);
      op(cur, st.hover || st.drag ? 0 : 1);
    }
    return {
      reset, still, tick,
      move(p) {
        st.hover = true;
        if (st.drag) {
          st.drag.tx = clamp(p.x - st.drag.ox, 0, 290);
          st.drag.ty = clamp(p.y - st.drag.oy, 26, 190);
        }
      },
      leave() { st.hover = false; st.hold = 1.2; },
      down(p, e) {
        if (e.target !== grab) return false;
        st.tw = null;
        st.drag = { ox: p.x - st.x, oy: p.y - st.y, tx: st.x, ty: st.y };
        stageEl.classList.add('sx-drag');
        return true;
      },
      up() {
        if (!st.drag) return;
        st.drag = null;
        stageEl.classList.remove('sx-drag');
        // Snap: wholly onto whichever screen holds more of the window.
        const onTab = st.ov > 0.3;
        const tgt = onTab ? { x: clamp(st.x, TS.x0 + 2, TS.x1 - 86), y: clamp(st.y, TS.y0 + 2, TS.y1 - 58) } : { x: clamp(st.x, 31, 165), y: clamp(st.y, 42, 112) };
        st.tw = { fx: st.x, fy: st.y, tx: tgt.x, ty: tgt.y, t: 0, dur: 0.55, spring: true };
        st.side = onTab ? 1 : 0;
      },
    };
  }

  /* ================= Apps in windows =================
     The phone's Photos app lifts off the phone (its shadow grows as it rises), flies across and lands on the PC
     as an ordinary window, the amber edge marking it active. Hover to send it now; it floats toward the pointer. */
  function apps(svg) {
    const fly = $(svg, '.sx-fly');
    const shadow = $(svg, '.sx-shadow');
    const frame = $(svg, '.sx-frame');
    const src = $(svg, '.sx-src');
    const glow = $(svg, '.sx-aglow');
    const FX = 140;
    const FY = 34;
    const s0 = 50 / 106;
    const X0 = 28 - 6 * s0;
    const Y0 = 121 - 15 * s0;
    const L = 9.2;
    const st = { t: 0, px: 0, py: 0, hover: false, mx: 0, my: 0 };
    function pose(t) {
      if (t < 1.4) { op(fly, 0); op(src, 1); op(glow, 0.12); return; }
      op(fly, 1);
      let x;
      let y;
      let s;
      let lift;
      let fr;
      if (t < 1.9) {
        const k = easeOut(seg(t, 1.4, 1.9));
        s = s0 * (1 + 0.08 * k); x = X0 - 2 * k; y = Y0 - 7 * k; lift = k * 0.5; fr = 0;
        op(src, 1 - 0.75 * k);
      } else if (t < 3.5) {
        const r = seg(t, 1.9, 3.5);
        const k = ease(r);
        s = lerp(s0 * 1.08, 1.03, k);
        x = lerp(X0 - 2, FX, k);
        y = lerp(Y0 - 7, FY - 4, k) - Math.sin(r * Math.PI) * 34;
        lift = 0.5 + Math.sin(r * Math.PI) * 0.5;
        fr = seg(r, 0.35, 0.85);
        op(src, 0.25);
      } else {
        const k = easeBack(seg(t, 3.5, 4.05));
        s = lerp(1.03, 1, k); x = FX; y = lerp(FY - 4, FY, k); lift = lerp(0.5, 0.12, seg(t, 3.5, 4.1)); fr = 1;
        op(src, t > 7.7 ? 0.25 + 0.75 * seg(t, 7.7, 8.4) : 0.25);
      }
      if (t >= 3.5) {
        // Landed: it floats a hair toward the pointer, its shadow the other way.
        x += st.px; y += st.py;
      }
      const out = t > 7.6 ? ease(seg(t, 7.6, 8.3)) : 0;
      if (out) { s *= 1 - 0.06 * out; x += 4 * out; y += 6 * out; }
      tr(fly, x, y, s);
      op(frame, fr);
      op(fly, 1 - out);
      const bx = lerp(8, -4, fr);
      const by = lerp(17, 8, fr);
      const bw = lerp(102, 158, fr);
      const bh = lerp(77, 104, fr);
      at(shadow, 'x', n2(bx - st.px * 1.6)); at(shadow, 'y', n2(by + 3 + lift * 20 - st.py));
      at(shadow, 'width', n2(bw)); at(shadow, 'height', n2(bh)); at(shadow, 'rx', n2(lerp(6, 12, fr)));
      op(shadow, 0.3 + lift * 0.45);
      op(glow, 0.12 + 0.5 * fr * (1 - out));
    }
    return {
      reset() { st.t = 0; pose(0); },
      still() { st.px = st.py = 0; pose(5); op(src, 1); },
      tick(dt) {
        st.t += dt;
        if (st.hover && st.t < 1.4) st.t = 1.4;
        if (st.t > L) st.t = 0;
        st.px = lerp(st.px, st.hover ? st.mx : 0, 1 - Math.exp(-dt * 4));
        st.py = lerp(st.py, st.hover ? st.my : 0, 1 - Math.exp(-dt * 4));
        pose(st.t);
      },
      move(p) { st.hover = true; st.mx = clamp((p.x - 215) / 30, -3, 3); st.my = clamp((p.y - 85) / 30, -3, 3); },
      leave() { st.hover = false; },
      click() { if (st.t > 3.9) st.t = 7.6; },
    };
  }

  /* ================= Clipboard and files =================
     A file is picked on the PC, rides a hairline arc to the Mac (the mint line fills behind it as it copies)
     and lands in the Mac's folder with a check drawn in. The arc is a string: the pointer plucks it. */
  function clipScene(svg) {
    const arc = $(svg, '.sx-arc');
    const prog = $(svg, '.sx-prog');
    const chip = $(svg, '.sx-chip');
    const chipt = $(svg, '.sx-chipt');
    const chipbg = $(svg, '.sx-chipbg');
    const meter = $(svg, '.sx-meter');
    const rows = [$(svg, '.sx-r1'), $(svg, '.sx-r2'), $(svg, '.sx-r3')];
    const land = $(svg, '.sx-land');
    const newRow = $(svg, '.sx-new');
    const check = $(svg, '.sx-check');
    const tick = $(svg, '.sx-tick');
    const glow = $(svg, '.sx-cglow');
    const ITEMS = [['Keynote.pdf', 4.8, 'MB'], ['IMG_2041.heic', 2.1, 'MB'], ['notes.txt', 3, 'KB']];
    const L = 7.2;
    const st = { t: 0, item: 0, pk: 52, vel: 0, target: 52, hover: false };
    const EX = 404;
    const EY = 182;
    function path() {
      const sy = 152 + st.item * 15;
      return `M150 ${sy}C190 ${n2(st.pk + (sy - 152) * 0.4)} 360 ${n2(st.pk)} ${EX} ${EY}`;
    }
    function setItem(i) {
      st.item = i;
      const [name, size, unit] = ITEMS[i];
      chipt.textContent = name;
      const w = textLen(chipt) + 28;
      at(chipbg, 'x', n2(-w / 2)); at(chipbg, 'width', n2(w));
      at(chipt, 'x', n2(-w / 2 + 19));
      at($(chip, 'g'), 'transform', `translate(${n2(-w / 2 + 7)} -5.5) scale(0.9)`);
      $(newRow, '.sx-fn').textContent = name;
      $(newRow, '.sx-fs').textContent = `${size} ${unit}`;
      st.size = size; st.unit = unit; st.name = name;
    }
    function pose(t) {
      const d = path();
      at(arc, 'd', d); at(prog, 'd', d);
      const r = rows[st.item];
      const sel = $(r, '.sx-sel');
      const selK = t < 0.2 ? 0 : t < 6.4 ? easeOut(seg(t, 0.2, 0.6)) : 1 - seg(t, 6.4, 7);
      at(sel, 'fill-opacity', n2(0.075 * selK));
      // The chip: pops out of the row, rides the arc, sinks into the Mac's folder.
      const k = ease(seg(t, 1.2, 3.4));
      const len = prog.getTotalLength();
      const pt = prog.getPointAtLength(len * k);
      const pop = easeBack(seg(t, 0.8, 1.2));
      const sink = seg(t, 3.35, 3.7);
      tr(chip, pt.x, pt.y, (t < 1.2 ? 0.6 + 0.4 * pop : 1) * (1 - 0.3 * sink));
      op(chip, t < 0.8 ? 0 : t < 3.35 ? pop : 1 - sink);
      at(prog, 'stroke-dashoffset', n2(1 - k));
      op(prog, t < 1.2 ? 0 : t < 3.4 ? 0.9 : t < 6.2 ? 0.9 - 0.55 * seg(t, 3.6, 4.4) : 0.35 * (1 - seg(t, 6.2, 6.8)));
      op(arc, 1);
      const landK = easeOut(seg(t, 3.45, 3.95));
      const gone = seg(t, 6.3, 6.9);
      op(land, landK * (1 - gone));
      tr(land, 0, (1 - landK) * -4);
      at(tick, 'stroke-dashoffset', n2(1 - easeOut(seg(t, 3.7, 4.1))));
      at(check, 'transform', `translate(459 182) scale(${n2(0.6 + 0.4 * easeBack(seg(t, 3.6, 3.95)))})`);
      op(glow, 0.15 + 0.45 * landK * (1 - gone));
      // The quiet meter at the top of the arc.
      let m = '';
      if (t >= 1.2 && t < 3.45) m = `Copying ${st.name} · ${(st.size * k).toFixed(st.unit === 'KB' ? 0 : 1)} / ${st.size} ${st.unit}`;
      else if (t >= 3.45 && t < 6.4) m = `${st.name} · ${st.size} ${st.unit} · on Studio-Mac`;
      else m = t < 1.2 && t > 0.3 ? `${st.name} · ready` : '';
      if (meter.textContent !== m) meter.textContent = m;
      op(meter, t > 6.4 ? 1 - seg(t, 6.4, 6.8) : 1);
    }
    return {
      reset() { st.t = 0; setItem(0); pose(0); },
      still() { setItem(0); st.pk = 52; pose(5); },
      tick(dt) {
        st.t += dt;
        if (st.t > L) { st.t = 0; setItem((st.item + 1) % ITEMS.length); }
        // A plucked string: a damped spring toward where the pointer pulls it.
        const target = st.hover ? st.target : 52;
        st.vel += (target - st.pk) * 90 * dt;
        st.vel *= Math.exp(-dt * 5.5);
        st.pk += st.vel * dt;
        pose(st.t);
      },
      move(p) {
        st.hover = true;
        const near = clamp(1 - Math.abs(p.x - 280) / 170, 0, 1);
        st.target = 52 + clamp(p.y - 52, -30, 120) * 0.65 * near;
      },
      leave() { st.hover = false; },
      click() { if (st.t > 4 || st.t < 0.8) { st.t = st.t > 4 ? 0 : 0.8; if (st.t === 0) setItem((st.item + 1) % ITEMS.length); } },
    };
  }

  /* ================= Your phone, on the computer =================
     The phone rings; the call slides off it and onto the Mac as a banner; the cursor answers it there and the
     call carries on at the desk. On a mouse, the visitor answers it themselves. */
  function phoneScene(svg) {
    const phoneG = $(svg, '.sx-phone');
    const lock = $(svg, '.sx-ph-lock');
    const ring = $(svg, '.sx-ph-ring');
    const moved = $(svg, '.sx-ph-moved');
    const ban = $(svg, '.sx-ban');
    const bin = $(svg, '.sx-b-in');
    const bon = $(svg, '.sx-b-on');
    const flyb = $(svg, '.sx-flyb');
    const cur = $(svg, '.sx-cur');
    const tm = $(svg, '.sx-tm');
    const tm2 = $(svg, '.sx-tm2');
    const glow = $(svg, '.sx-pglow');
    const answer = $(svg, '.sx-answer');
    const BW = 132;
    const BX = 209 + 242 - BW - 8;
    const BY = 107 + 13;
    const ANS = { x: BX + BW - 22, y: BY + 15 };
    const REST = { x: 330, y: 214 };
    const L = 12.5;
    const st = { t: 0, hover: false, answered: false, at: 0, cx: REST.x, cy: REST.y, pressed: 0 };
    function pose(t, dt) {
      const ringing = t >= 1.5 && !st.answered;
      svg.classList.toggle('sx-ringing', ringing);
      const callOn = st.answered && t < 10;
      svg.classList.toggle('sx-oncall', callOn);
      // The phone: lock, ringing, then "on Studio-Mac".
      const end = seg(t, 10, 10.6);
      op(lock, t < 1.9 ? 1 - seg(t, 1.5, 1.9) : end);
      op(ring, t < 1.5 ? 0 : st.answered ? 1 - seg(t, st.at, st.at + 0.3) : seg(t, 1.5, 1.9));
      op(moved, st.answered ? seg(t, st.at + 0.15, st.at + 0.45) * (1 - end) : 0);
      // A short buzz, twice.
      const bz = (t > 1.6 && t < 1.95) || (t > 2.5 && t < 2.85) ? Math.sin(t * 190) * 0.7 : 0;
      tr(phoneG, bz, 0);
      op(glow, ringing ? 0.55 : callOn ? 0.15 : 0);
      // The banner flies from the phone to the Mac's corner.
      const fk = ease(seg(t, 2.3, 3.1));
      if (t > 2.3 && t < 3.1) {
        const sx = 62 + 37 - BW * 0.18;
        const sy = 114 + 60;
        const x = lerp(sx, BX, fk);
        const y = lerp(sy, BY, fk) - Math.sin(fk * Math.PI) * 40;
        tr(flyb, x, y, lerp(0.36, 1, fk));
        op(flyb, Math.min(1, seg(t, 2.3, 2.45) * 1) * (1 - seg(t, 3.0, 3.1)));
      } else op(flyb, 0);
      const showB = t >= 3.05 && t < 10.4;
      op(ban, showB ? (t < 10 ? seg(t, 3.0, 3.15) : 1 - seg(t, 10, 10.4)) : 0);
      tr(ban, BX, BY - (t > 10 ? seg(t, 10, 10.4) * 6 : 0));
      op(bin, st.answered ? 1 - seg(t, st.at, st.at + 0.3) : 1);
      op(bon, st.answered ? seg(t, st.at + 0.15, st.at + 0.45) : 0);
      if (st.answered) {
        const s = mmss(Math.max(0, t - st.at));
        if (tm.textContent !== s) { tm.textContent = s; tm2.textContent = s; }
      }
      // The cursor: to Answer, click, then away.
      let tx = REST.x;
      let ty = REST.y;
      if (!st.hover && t > 3.2 && !st.answered) { tx = ANS.x - 1; ty = ANS.y + 1; }
      st.cx = lerp(st.cx, tx, 1 - Math.exp(-dt * 3.2));
      st.cy = lerp(st.cy, ty, 1 - Math.exp(-dt * 3.2));
      tr(cur, st.cx, st.cy);
      op(cur, st.hover ? 0 : 1);
      if (!st.hover && !st.answered && t > 4.6) doAnswer();
      if (st.pressed > 0) { st.pressed -= dt; if (st.pressed <= 0) answer.classList.remove('sx-press'); }
    }
    function doAnswer() {
      if (st.answered) return;
      st.answered = true;
      st.at = st.t;
      answer.classList.add('sx-press');
      st.pressed = 0.2;
    }
    return {
      reset() { st.t = 0; st.answered = false; tm.textContent = '00:00'; tm2.textContent = '00:00'; pose(0, 0.016); },
      still() {
        svg.classList.remove('sx-ringing'); svg.classList.remove('sx-oncall');
        op(lock, 0); op(ring, 0); op(moved, 1); op(flyb, 0); op(ban, 1); tr(ban, BX, BY); op(bin, 0); op(bon, 1);
        tr(cur, REST.x, REST.y); op(cur, 1); tr(phoneG, 0, 0); op(glow, 0.15);
      },
      tick(dt) {
        st.t += dt;
        // Waiting for the visitor to answer: hold the ringing a while.
        if (st.hover && !st.answered && st.t > 6.5) st.t = 6.5;
        if (st.t > L) { st.t = 0; st.answered = false; tm.textContent = '00:00'; tm2.textContent = '00:00'; }
        pose(st.t, dt);
      },
      move() { st.hover = FINE.matches; },
      leave() { st.hover = false; },
      click(p) {
        const inBanner = st.t > 3.1 && st.t < 10 && p.x > BX + BW - 40 && p.x < BX + BW && p.y > BY && p.y < BY + 30;
        const onPhone = st.t > 1.5 && st.t < 10 && p.x > 62 && p.x < 136 && p.y > 114;
        if (!st.answered && (inBanner || onPhone)) { if (st.t < 3.1) st.t = 3.1; doAnswer(); }
      },
    };
  }

  /* ================= ReZume =================
     Reading on the phone; a handoff appears on the laptop (a thin spectrum line on it); Open, and the document is
     there at the same paragraph. The two stay in step: on a mouse, the pointer scrolls them both. */
  function rezume(svg) {
    const docP = $(svg, '.sx-doc-p');
    const docL = $(svg, '.sx-doc-l');
    const rwin = $(svg, '.sx-rwin');
    const pill = $(svg, '.sx-pill');
    const open = $(svg, '.sx-open');
    const beam = $(svg, '.sx-beam');
    const cur = $(svg, '.sx-cur');
    const hls = $$(svg, '.sx-doc-l .sx-hl');
    const pb = (docP.getAttribute('transform').match(/[-\d.]+/g) || [0, 0]).map(Number);
    const lb = (docL.getAttribute('transform').match(/[-\d.]+/g) || [0, 0, 1]).map(Number);
    const pp = (pill.getAttribute('transform').match(/[-d.]+/g) || [184, 226]).map(Number);
    const PX = pp[0];
    const PY = pp[1];
    const OPEN = { x: PX + 42, y: PY };
    const REST = { x: 250, y: 214 };
    const L = 11.5;
    const st = { t: 0, s: 0, ts: 0, hover: false, hs: 0, cx: REST.x, cy: REST.y, isOpen: false, at: 0 };
    function scroll(s, ls) {
      tr(docP, pb[0], pb[1] - s);
      at(docL, 'transform', `translate(${n2(lb[0])} ${n2(lb[1] - ls * lb[2])}) scale(${lb[2]})`);
    }
    function pose(t, dt) {
      // Reading: the phone scrolls to page 4, paragraph 3.
      let s = t < 2.6 ? 40 * ease(seg(t, 0.2, 2.6)) : 40;
      if (st.isOpen) s = 40 + Math.sin((t - st.at) * 0.55) * 14 * seg(t, st.at + 1.2, st.at + 2.4) * (1 - seg(t, 9.6, 10.3));
      if (t > 10.3) s = 40 * (1 - ease(seg(t, 10.3, 11.3)));
      st.ts = st.hover ? st.hs : s;
      st.s = lerp(st.s, st.ts, 1 - Math.exp(-dt * (st.hover ? 6 : 14)));
      // The handoff: a spectrum hairline from the phone draws the pill onto the laptop.
      const b = seg(t, 2.6, 3.3);
      at(beam, 'stroke-dashoffset', n2(1 - ease(b)));
      op(beam, t < 2.6 ? 0 : t < 3.6 ? 1 : 1 - seg(t, 3.6, 4.2));
      const pk = easeOut(seg(t, 3.0, 3.5));
      const pOut = st.isOpen ? seg(t, st.at, st.at + 0.35) : 0;
      op(pill, t < 3.0 || t > 10.3 ? 0 : pk * (1 - pOut));
      tr(pill, PX, PY + (1 - pk) * 8);
      if (!st.hover && !st.isOpen && t > 4.6) doOpen();
      // The window opens out of the pill, at the same place in the document.
      const wk = st.isOpen ? easeOut(seg(t, st.at, st.at + 0.7)) : 0;
      const close = seg(t, 9.8, 10.3);
      op(rwin, wk * (1 - close));
      about(rwin, PX, PY, 0.25 + 0.75 * wk * (1 - 0.04 * close));
      const flash = st.isOpen ? Math.max(0, 1 - Math.abs(t - st.at - 0.9) / 0.5) : 0;
      hls.forEach((h) => at(h, 'fill-opacity', n2(0.3 + 0.35 * flash)));
      scroll(st.s, st.isOpen ? st.s : 40);
      // The cursor: to Open, click, away.
      let tx = REST.x;
      let ty = REST.y;
      if (!st.isOpen && t > 3.4) { tx = OPEN.x - 1; ty = OPEN.y + 1; }
      st.cx = lerp(st.cx, tx, 1 - Math.exp(-dt * 3.2));
      st.cy = lerp(st.cy, ty, 1 - Math.exp(-dt * 3.2));
      tr(cur, st.cx, st.cy);
      op(cur, st.hover ? 0 : 1);
    }
    function doOpen() {
      if (st.isOpen) return;
      st.isOpen = true;
      st.at = st.t;
      open.classList.add('sx-press');
      setTimeout(() => open.classList.remove('sx-press'), 180);
    }
    return {
      reset() { st.t = 0; st.s = 0; st.isOpen = false; pose(0, 0.016); },
      still() { st.isOpen = true; st.at = -10; scroll(40, 40); op(rwin, 1); at(rwin, 'transform', ''); op(pill, 0); op(beam, 0); tr(cur, REST.x, REST.y); op(cur, 1); },
      tick(dt) {
        st.t += dt;
        if (st.hover && !st.isOpen && st.t > 8) st.t = 8;
        if (st.t > L) { st.t = 0; st.isOpen = false; }
        pose(st.t, dt);
      },
      move(p) { st.hover = FINE.matches; st.hs = clamp((p.y - 120) / 130, 0, 1) * 62; },
      leave() { st.hover = false; },
      click() { if (!st.isOpen && st.t > 3.0) doOpen(); else if (st.isOpen && st.t > st.at + 1) st.t = Math.max(st.t, 9.8); },
    };
  }

  const SCENES = { kvm, screen: screen2, apps, clip: clipScene, phone: phoneScene, rezume };

  /* ================= the conductor ================= */
  function init() {
    const section = document.querySelector('.sx');
    if (!section) return;
    const cards = [];
    for (const card of $$(section, '.sx-card')) {
      const stage = $(card, '.sx-stage');
      const svg = stage && $(stage, 'svg');
      const make = stage && SCENES[stage.dataset.sx];
      if (!make) continue;
      const scene = make(svg, stage);
      const c = { card, stage, svg, scene, tilt: $(card, '.sx-tilt'), shines: $$(svg, '.sx-nohit'), sw: $(card, '.sx-sw'), seen: false, visible: false, on: true, live: false,
        rx: 0, ry: 0, trx: 0, try: 0 };
      cards.push(c);
    }
    if (!cards.length) return;
    section.classList.add('sx-ready');

    let raf = 0;
    let last = 0;
    const running = (c) => c.live && c.on && c.visible && !RM.matches;
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      let any = false;
      for (const c of cards) {
        if (!running(c)) continue;
        any = true;
        c.scene.tick(dt);
        // Depth: the picture leans a few degrees toward the pointer.
        const k = 1 - Math.exp(-dt * 6);
        c.rx = lerp(c.rx, c.trx, k);
        c.ry = lerp(c.ry, c.try, k);
        if (Math.abs(c.rx - c.trx) > 0.005 || Math.abs(c.ry - c.try) > 0.005 || c.tiltSet) {
          c.tilt.style.setProperty('--rx', `${n2(c.rx)}deg`);
          c.tilt.style.setProperty('--ry', `${n2(c.ry)}deg`);
          c.tiltSet = Math.abs(c.rx) > 0.005 || Math.abs(c.ry) > 0.005;
          const sh = `translate(${n2(-c.ry * 9)} ${n2(c.rx * 6)})`;
          for (const el of c.shines) el.setAttribute('transform', sh);
        }
      }
      if (any && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (raf || document.hidden || RM.matches) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function wake(c) {
      if (c.live) return;
      c.live = true;
      if (RM.matches) c.scene.still(); else c.scene.reset();
      c.card.classList.add('sx-live');
      kick();
    }
    function applyMotionPref() {
      for (const c of cards) {
        if (RM.matches) { c.scene.still(); c.card.classList.add('sx-live'); c.tilt.style.setProperty('--rx', '0deg'); c.tilt.style.setProperty('--ry', '0deg'); } else if (c.live) { c.scene.reset(); }
      }
      kick();
    }

    for (const c of cards) {
      c.sw.addEventListener('click', () => {
        c.on = !c.on;
        c.sw.setAttribute('aria-pressed', String(c.on));
        c.card.classList.toggle('sx-off', !c.on);
        if (c.on) { if (!c.live) wake(c); kick(); }
      });
      c.stage.addEventListener('pointermove', (e) => {
        if (!running(c)) return;
        const p = toSvg(c.svg, e);
        if (p && c.scene.move) c.scene.move(p, e);
        if (FINE.matches) {
          const r = c.stage.getBoundingClientRect();
          c.trx = -((e.clientY - r.top) / r.height - 0.5) * 4;
          c.try = ((e.clientX - r.left) / r.width - 0.5) * 5;
        }
      });
      c.stage.addEventListener('pointerleave', () => {
        c.trx = 0; c.try = 0;
        if (c.scene.leave) c.scene.leave();
        if (c.scene.up) c.scene.up();
      });
      c.stage.addEventListener('pointerdown', (e) => {
        if (!running(c) || !c.scene.down) return;
        const p = toSvg(c.svg, e);
        if (p && c.scene.down(p, e)) { try { c.stage.setPointerCapture(e.pointerId); } catch { /* ignore */ } e.preventDefault(); }
      });
      const up = (e) => {
        if (c.scene.up) c.scene.up(e);
        if (e.pointerType !== 'mouse' && c.scene.leave) c.scene.leave();
      };
      c.stage.addEventListener('pointerup', up);
      c.stage.addEventListener('pointercancel', up);
      c.stage.addEventListener('click', (e) => {
        if (!running(c) || !c.scene.click) return;
        const p = toSvg(c.svg, e);
        if (p) c.scene.click(p, e);
      });
    }

    if (RM.matches) applyMotionPref();
    if ('IntersectionObserver' in window) {
      // Wake a card the first time most of its picture is in view; run it only while any of it is.
      const wakeIo = new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const c = cards.find((x) => x.stage === e.target);
          if (c && !c.seen) { c.seen = true; setTimeout(() => { if (c.on) wake(c); }, 380); wakeIo.unobserve(e.target); }
        }
      }, { threshold: 0.45 });
      const visIo = new IntersectionObserver((es) => {
        for (const e of es) {
          const c = cards.find((x) => x.stage === e.target);
          if (c) c.visible = e.isIntersecting;
        }
        kick();
      }, { rootMargin: '80px 0px' });
      for (const c of cards) { wakeIo.observe(c.stage); visIo.observe(c.stage); }
    } else {
      for (const c of cards) { c.visible = true; c.seen = true; wake(c); }
    }
    document.addEventListener('visibilitychange', kick);
    if (RM.addEventListener) RM.addEventListener('change', applyMotionPref);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
