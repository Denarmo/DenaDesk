// DuoDesk — Aurora art kit, minimal. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The drawing kit of the feature pictures (shared/feature-art.js): Apple-grade restraint. Devices are hairline
// monochrome glass on near-black — white strokes at 18-45 %, a brighter key edge at the top, near-black glass fills,
// dark screens with two to four quiet shapes. Colour is kept for ONE thing per picture (the feature's colour,
// --fa1 through the ka-f1 / ka-st1 classes, or white); the spectrum only as a thin line or a faint small glow.
// Plain script (no modules), CSP-safe: it only builds SVG strings — no style="" attributes (classes and
// presentation attributes only), no scripts. Loaded by shared/feature-art.js together with shared/aurora-art.css
// and one file per scene group, shared/art/scenes-*.js, which set window.AuroraArt[<scene>] = (id, K) => '<svg
// inner markup>' (a 400 x 240 picture; K is this kit; feature-art.js puts K.defs(id) in the picture's <defs> first).
//
// Every drawer returns an SVG markup string. Boxes are (x, y, w, h): the whole device, stand / base included, in
// the picture's units. Colours: the feature's two (--fa1 / --fa2) through the "f1" / "f2" names and the ka-s1 /
// ka-s2 / ka-f1 / ka-f2 / ka-st1 / ka-st2 classes; the spectrum's through pink violet cyan mint amber (K.C).
//
//   K.defs(id)                              -> <defs> content (no <defs> tag) for one picture. Ids are "ka-<id>-…";
//                                              call it once per picture, before its drawers. Defines, for K.ref():
//                                              glass (white sheen, top to bottom) · body (near-black glass fill) ·
//                                              alu (a device's base) · rim (the hairline stroke, brighter at the top)
//                                              · edge (a key-edge highlight, clear - white - clear, across) · scr (a
//                                              dark screen) · shine (a faint diagonal reflection) · spec / specd (the
//                                              spectrum across / diagonal: thin lines only) · feat (the feature's two
//                                              colours) · r-<colour> (a faint radial light: pink violet cyan mint
//                                              amber white f1 f2) · filters glow (blur 4: the one soft glow), soft
//                                              (blur 1.5), blur (10), bloom (the shape plus a little glow)
//   K.ref(name)                             -> 'url(#ka-<id>-<name>)' for fill= / stroke= / filter=
//   K.uid(name?)                            -> a new unique id in this picture (for your own clipPath / gradient)
//   K.C                                     -> hex colours: pink violet cyan mint amber red (the spectrum), ink
//                                              (#f1f1f3), muted, dim, bg, glass (#0f0f12), line (a hairline's white)
//   K.SW                                    -> { hair: 0.75, fine: 0.55 }: the stroke widths everything uses
//   K.PTR                                   -> the pointer arrow's path, tip at 0,0, 14 x 20
//   K.a                                     -> SMIL helpers (each returns an <animate…/> string): fade(dur, values,
//                                              keyTimes, calcMode?) opacity; shift(dur, values, keyTimes?) translate;
//                                              spin(…) rotate; grow(dur, values, keyTimes?, begin?) scale; along(dur,
//                                              values, keyTimes) animateMotion; from(dur, t, until?) shown from t
//
//   Devices (each: o.glow = a colour name for a faint light under it — default none; o.chrome = false: no dock /
//   menu bar / panel; o.apps = false: no sample window; o.content = a string, or a function(area) -> string,
//   drawn on the screen (clipped to it) in place of the sample window, where area = K.screen(...) below;
//   o.anim = false: nothing moves; o.wall is accepted and ignored — screens are always dark):
//   K.winPc(x, y, w, h, o?)                 -> a Windows PC: a thin-bezel monitor on a slim stand (o.form = 'laptop':
//                                              a laptop); a centred row of five dock dots, one window outline
//   K.macBook(x, y, w, h, o?)               -> a MacBook: notch, hairline menu bar, a window with three grey dots;
//                                              the base is the full width, the lid ~86 % of it
//   K.linuxPc(x, y, w, h, o?)               -> a Linux laptop (o.form = 'desktop': a monitor): a hairline top panel and
//                                              a small two-line terminal
//   K.laptop(x, y, w, h, o?)                -> a generic laptop, nothing on its screen
//   K.phone(x, y, w, h, o?)                 -> a phone: punch-hole dot, home-indicator line, a widget and two lines.
//                                              Best at about w:h = 1:2
//   K.tablet(x, y, w, h, o?)                -> a tablet, landscape when w > h, two panes
//   K.computer(os, x, y, w, h, o?)          -> winPc / macBook / linuxPc / phone ('android') / tablet / laptop by os;
//                                              a phone is fitted into the box at 1:2, centred
//   K.screen(kind, x, y, w, h, o?)          -> { x, y, w, h, rx }: where content goes on that device ('winPc' |
//                                              'macBook' | 'linuxPc' | 'laptop' | 'phone' | 'tablet'), below / above
//                                              its bars
//   K.screenRect(kind, x, y, w, h, o?)      -> the whole screen of that device { x, y, w, h, rx }
//   K.os()                                  -> { me, peer }: me 'win' | 'mac' | 'linux' (this computer, from the
//                                              browser), peer from UI.state ('win' | 'mac' | 'linux' | 'android'),
//                                              else the other big OS (win -> mac, else win)
//
//   Parts:
//   K.window(x, y, w, h, o?)                -> an app window: hairline outline on near-black. o.os 'win' (– □ × on the
//                                              right) | 'mac' (three grey dots) | 'linux' (one dot) | 'plain'; o.title
//                                              a tiny label at 40 %; o.body 'lines' (default) | 'media' | 'grid' |
//                                              'code' | 'chat' | 'blank' | a string | function(area) -> string;
//                                              o.active: its top edge in the feature's colour
//   K.windowBody(x, y, w, h)                -> { x, y, w, h } inside that window, under its title bar
//   K.terminal(x, y, w, h, o?)              -> a terminal: o.lines = [[colour, width 0..1], …] (abstract runs, drawn
//                                              in white whatever the colour), o.text = [string, …] real mono text,
//                                              o.cursor (true): a slowly breathing block
//   K.cursor(x, y, o?)                      -> the pointer, tip at x, y: white with a dark hairline; o.s scale (1 =
//                                              14 x 20); o.glow a colour name for a faint halo (default none)
//   K.file(x, y, kind, o?)                  -> a file centred on x, y (26 x 32 at o.s = 1), hairline glass: kind 'doc'
//                                              | 'pdf' | 'img' | 'zip' | 'code' | 'music' | 'video' | 'folder';
//                                              o.accent: its outline in the feature's colour
//   K.glowOrb(x, y, r, colour?, o?)         -> a faint radial light (colour name, default 'f1'); o.core: a small white
//                                              dot in it; o.pulse (default true) slow breathing, o.dur seconds (6)
//   K.sparkles(...)                         -> '' (no sparkles in this style; kept so older scenes still run)
//   K.beam(x1, y1, x2, y2, o?)              -> a link between two points: a hairline arc in the spectrum (faint) with
//                                              one soft white pulse travelling along it. o.bend (-0.22), o.dur (3 s),
//                                              o.dots (1) pulses, o.back: every other one comes back, o.dim: waiting
//                                              (a dotted hairline, nothing moving)
//   K.beamPath(x1, y1, x2, y2, bend?)       -> that beam's path d (for animateMotion along it)
//   K.glass(x, y, w, h, o?)                 -> a glass card: hairline, near-clear fill, key edge; o.rx (10)
//   K.svg(inner, o?)                        -> a whole <svg> (with defs): o.id, o.w (400), o.h (240) — for still
//                                              images (gallery, CSS data: URIs)
(function () {
  'use strict';

  const C = { pink: '#e2b52f', violet: '#f1c40f', cyan: '#f7dd77', mint: '#3dffa8', amber: '#ffb340', red: '#ff5c7a',
    ink: '#f1f1f3', muted: '#b7b7c2', dim: '#a0a0aa', bg: '#202024', glass: '#0f0f12', line: '#ffffff' };
  const SPEC = [[0, C.pink], [0.3, C.violet], [0.55, C.cyan], [0.75, C.mint], [1, C.amber]];
  const HUES = ['pink', 'violet', 'cyan', 'mint', 'amber'];
  const UI_FONT = 'Geist, system-ui, Segoe UI, sans-serif';
  const MONO_FONT = 'Geist Mono, ui-monospace, Consolas, monospace';
  const SW = { hair: 0.75, fine: 0.55 };

  const f = (v) => Math.round(v * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  let P = 'ka-x';
  let N = 0;
  const ref = (name) => `url(#${P}-${name})`;
  const uid = (name = 'u') => `${P}-${name}${++N}`;
  const hex = (c) => (c === 'f1' ? C.violet : c === 'f2' ? C.cyan : C[c] || c);

  const rect = (x, y, w, h, rx, attrs = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}/>`;
  const circ = (cx, cy, r, attrs = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
  const ell = (cx, cy, rx, ry, attrs = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs}/>`;
  // Strokes: a white hairline at that opacity.
  const st = (op, w = SW.hair) => `stroke="#fff" stroke-opacity="${op}" stroke-width="${w}"`;
  const hair = (op, w = SW.hair) => `fill="none" ${st(op, w)}`;
  // A short bar (a line of text, abstract): white at that opacity.
  const bar = (x, y, w, t, op = 0.12) => rect(x, y, w, t, t / 2, `fill="#fff" fill-opacity="${op}"`);
  // The key edge: a highlight along the top of a shape, clear at both ends.
  const edge = (x, y, w, op = 1) => rect(x, y - 0.35, w, 0.7, 0, `fill="${ref('edge')}"${op !== 1 ? ` opacity="${op}"` : ''}`);

  // ---- SMIL helpers ----
  const REP = 'repeatCount="indefinite"';
  const a = {
    fade: (dur, values, times, calc = 'linear') => `<animate attributeName="opacity" dur="${dur}s" ${REP} calcMode="${calc}" values="${values}" keyTimes="${times}"/>`,
    shift: (dur, values, times = '') => `<animateTransform attributeName="transform" type="translate" dur="${dur}s" ${REP} values="${values}"${times ? ` keyTimes="${times}"` : ''}/>`,
    spin: (dur, values, times = '') => `<animateTransform attributeName="transform" type="rotate" dur="${dur}s" ${REP} values="${values}"${times ? ` keyTimes="${times}"` : ''}/>`,
    grow: (dur, values, times = '', begin = '0s') => `<animateTransform attributeName="transform" type="scale" dur="${dur}s" ${REP} begin="${begin}" values="${values}"${times ? ` keyTimes="${times}"` : ''}/>`,
    along: (dur, values, times) => `<animateMotion dur="${dur}s" ${REP} calcMode="linear" values="${values}" keyTimes="${times}"/>`,
  };
  a.from = (dur, t, until = 0.94) => a.fade(dur, '0;1;0', `0;${t};${until}`, 'discrete');

  // ---- defs ----
  function defs(id) {
    P = 'ka-' + String(id == null ? 'x' : id).replace(/[^A-Za-z0-9_-]/g, '_');
    N = 0;
    const stop = (o, c, op = 1, cls = '') => `<stop offset="${o}" stop-color="${c}"${op !== 1 ? ` stop-opacity="${f(op)}"` : ''}${cls ? ` class="${cls}"` : ''}/>`;
    const lin = (name, stops, dir = 'x1="0" y1="0" x2="0" y2="1"') => `<linearGradient id="${P}-${name}" ${dir}>${stops.map((s) => stop(...s)).join('')}</linearGradient>`;
    const rad = (name, c, op = 0.42, cls = '') => `<radialGradient id="${P}-r-${name}">${stop(0, c, op, cls)}${stop(0.45, c, op * 0.32, cls)}${stop(1, c, 0, cls)}</radialGradient>`;
    const blur = (name, sd) => `<filter id="${P}-${name}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
    const across = 'x1="0" y1="0" x2="1" y2="0"';
    return lin('spec', SPEC, across)
      + lin('specd', SPEC, 'x1="0" y1="0" x2="1" y2="1"')
      + lin('feat', [[0, C.violet, 1, 'ka-s1'], [1, C.cyan, 1, 'ka-s2']], 'x1="0" y1="0" x2="0.4" y2="1"')
      + lin('glass', [[0, '#fff', 0.06], [1, '#fff', 0.012]])
      + lin('body', [[0, '#17171b'], [1, '#0c0c0f']])
      + lin('alu', [[0, '#1b1b20'], [1, '#0e0e11']])
      + lin('rim', [[0, '#fff', 0.46], [0.35, '#fff', 0.26], [1, '#fff', 0.16]])
      + lin('edge', [[0, '#fff', 0], [0.25, '#fff', 0.72], [0.75, '#fff', 0.72], [1, '#fff', 0]], across)
      + lin('scr', [[0, '#0b0b0e'], [1, '#060608']])
      + lin('shine', [[0, '#fff', 0.045], [0.5, '#fff', 0.008], [0.5, '#fff', 0], [1, '#fff', 0]], 'x1="0" y1="0" x2="1" y2="1"')
      + HUES.map((h) => rad(h, C[h])).join('')
      + rad('white', '#fff', 0.32) + rad('f1', C.violet, 0.42, 'ka-s1') + rad('f2', C.cyan, 0.42, 'ka-s2')
      + blur('glow', 4) + blur('soft', 1.5) + blur('blur', 10)
      + `<filter id="${P}-bloom" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>`
      + '<feComponentTransfer in="b" result="c"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>'
      + '<feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  }

  // ---- screens ----
  // Where content goes on a screen of that OS (below its menu bar, above its dock …).
  function area(os, s) {
    if (os === 'win') {
      const tb = Math.max(4, s.h * 0.1);
      return { x: s.x, y: s.y, w: s.w, h: s.h - tb, rx: 0 };
    }
    if (os === 'mac') {
      const mb = Math.max(3, s.h * 0.055);
      return { x: s.x, y: s.y + mb, w: s.w, h: s.h - mb, rx: 0 };
    }
    if (os === 'linux') {
      const ph = Math.max(3, s.h * 0.06);
      return { x: s.x, y: s.y + ph, w: s.w, h: s.h - ph, rx: 0 };
    }
    if (os === 'android') {
      const sb = s.h * 0.07;
      const nav = s.h * 0.05;
      return { x: s.x, y: s.y + sb, w: s.w, h: s.h - sb - nav, rx: 0 };
    }
    if (os === 'tablet') {
      const sb = Math.max(3, s.h * 0.06);
      return { x: s.x, y: s.y + sb, w: s.w, h: s.h - sb - s.h * 0.05, rx: 0 };
    }
    return { x: s.x, y: s.y, w: s.w, h: s.h, rx: s.rx };
  }

  // The OS's own cues, hairline-quiet, drawn over the content.
  function chrome(os, s) {
    let out = '';
    if (os === 'win') { // a centred row of five dock dots
      const tb = Math.max(4, s.h * 0.1);
      const cy = s.y + s.h - tb / 2;
      const r = Math.max(0.45, tb * 0.11);
      const gap = r * 4.2;
      for (let i = 0; i < 5; i++) out += circ(s.x + s.w / 2 + (i - 2) * gap, cy, r, `fill="#fff" fill-opacity="${i === 0 ? 0.42 : 0.2}"`);
    } else if (os === 'mac') { // a hairline menu bar
      const mb = Math.max(3, s.h * 0.055);
      const t = Math.max(0.4, mb * 0.24);
      out += rect(s.x, s.y + mb - 0.25, s.w, 0.5, 0, 'fill="#fff" fill-opacity="0.06"')
        + bar(s.x + s.w * 0.04, s.y + (mb - t) / 2, s.w * 0.06, t, 0.22) + bar(s.x + s.w * 0.12, s.y + (mb - t) / 2, s.w * 0.04, t, 0.1)
        + bar(s.x + s.w * 0.88, s.y + (mb - t) / 2, s.w * 0.08, t, 0.16);
    } else if (os === 'linux') { // a hairline top panel, its clock in the middle
      const ph = Math.max(3, s.h * 0.06);
      const t = Math.max(0.4, ph * 0.24);
      out += rect(s.x, s.y + ph - 0.25, s.w, 0.5, 0, 'fill="#fff" fill-opacity="0.06"')
        + bar(s.x + s.w / 2 - s.w * 0.05, s.y + (ph - t) / 2, s.w * 0.1, t, 0.22)
        + circ(s.x + s.w * 0.04, s.y + ph / 2, t * 0.75, 'fill="#fff" fill-opacity="0.22"')
        + circ(s.x + s.w * 0.96, s.y + ph / 2, t * 0.75, 'fill="#fff" fill-opacity="0.16"');
    } else if (os === 'android') {
      const sb = s.h * 0.07;
      const t = Math.max(0.5, sb * 0.2);
      out += bar(s.x + s.w * 0.12, s.y + sb * 0.55 - t / 2, s.w * 0.12, t, 0.3)
        + bar(s.x + s.w * 0.76, s.y + sb * 0.55 - t / 2, s.w * 0.12, t, 0.18)
        + bar(s.x + s.w * 0.36, s.y + s.h - s.h * 0.026, s.w * 0.28, Math.max(0.5, s.h * 0.008), 0.4);
    } else if (os === 'tablet') {
      out += bar(s.x + s.w * 0.42, s.y + s.h - s.h * 0.03, s.w * 0.16, Math.max(0.5, s.h * 0.012), 0.4);
    }
    return out;
  }

  // The one quiet sample on each OS's screen, when the scene puts nothing else there.
  function apps(os, ar, o) {
    if (os === 'win') return windowEl(ar.x + ar.w * 0.17, ar.y + ar.h * 0.14, ar.w * 0.66, ar.h * 0.72, { os: 'win', body: 'lines' });
    if (os === 'mac') return windowEl(ar.x + ar.w * 0.17, ar.y + ar.h * 0.13, ar.w * 0.66, ar.h * 0.74, { os: 'mac', body: 'lines' });
    if (os === 'linux') {
      return terminal(ar.x + ar.w * 0.2, ar.y + ar.h * 0.2, ar.w * 0.6, ar.h * 0.58, { cursor: o.anim !== false, anim: o.anim,
        lines: [[[C.ink, 0.08], [C.ink, 0.4]], [[C.ink, 0.28]]] });
    }
    if (os === 'android') {
      const x = ar.x + ar.w * 0.1;
      const w = ar.w * 0.8;
      const t = Math.max(0.6, ar.w * 0.035);
      return rect(x, ar.y + ar.h * 0.08, w, ar.h * 0.24, Math.min(w, ar.h) * 0.08, `fill="#fff" fill-opacity="0.04" ${st(0.09, SW.fine)}`)
        + bar(x, ar.y + ar.h * 0.42, w * 0.7, t, 0.14) + bar(x, ar.y + ar.h * 0.42 + t * 2.6, w * 0.45, t, 0.08);
    }
    if (os === 'tablet') {
      const g = ar.w * 0.04;
      return windowEl(ar.x + g, ar.y + g, ar.w * 0.36 - g, ar.h - g * 2, { os: 'plain', body: 'lines' })
        + windowEl(ar.x + ar.w * 0.36 + g, ar.y + g, ar.w * 0.64 - g * 2, ar.h - g * 2, { os: 'plain', body: 'media' });
    }
    return '';
  }

  // The screen: dark glass, content, the OS's cues, a faint reflection, clipped to the screen.
  function screenEl(s, os, o) {
    const cid = uid('clip');
    const ar = area(os, s);
    let content = '';
    if (o.content) content = typeof o.content === 'function' ? o.content(ar) : String(o.content);
    else if (o.apps !== false) content = apps(os, ar, o);
    return `<clipPath id="${cid}">${rect(s.x, s.y, s.w, s.h, s.rx)}</clipPath><g clip-path="url(#${cid})">`
      + rect(s.x, s.y, s.w, s.h, 0, `fill="${ref('scr')}"`) + content + (o.chrome === false ? '' : chrome(os, s))
      + rect(s.x, s.y, s.w, s.h, 0, `fill="${ref('shine')}"`) + '</g>'
      + rect(s.x, s.y, s.w, s.h, s.rx, hair(0.07, SW.fine));
  }

  // A faint light under a device, only when asked for (o.glow = a colour name).
  function underGlow(x, y, w, h, o) {
    if (!o.glow) return '';
    return ell(x + w / 2, y + h, w * 0.46, Math.max(3, h * 0.08), `fill="${ref('r-' + o.glow)}" opacity="0.5"`);
  }

  // ---- geometry of each device: its screen ----
  function geomMonitor(x, y, w, h) {
    const sh = h * 0.2;
    const mh = h - sh;
    const b = Math.max(1.3, w * 0.014);
    const rx = Math.max(1.5, w * 0.018);
    return { mh, sh, b, rx, scr: { x: x + b, y: y + b, w: w - b * 2, h: mh - b * 2.6, rx: Math.max(0.6, rx - b * 0.7) } };
  }
  function geomLaptop(x, y, w, h, lidPart, bezel, chin) {
    const bh = Math.max(2, h * 0.065);
    const lh = h - bh;
    const lw = w * lidPart;
    const lx = x + (w - lw) / 2;
    const b = Math.max(1.3, lw * bezel);
    return { bh, lh, lw, lx, b, scr: { x: lx + b, y: y + b, w: lw - b * 2, h: lh - b - b * chin, rx: Math.max(0.6, lw * 0.01) } };
  }
  function geomPhone(x, y, w, h) {
    const rx = w * 0.18;
    const b = Math.max(1, w * 0.042);
    return { rx, b, scr: { x: x + b, y: y + b, w: w - b * 2, h: h - b * 2, rx: rx - b } };
  }
  function geomTablet(x, y, w, h) {
    const m = Math.min(w, h);
    const rx = m * 0.075;
    const b = Math.max(1.4, m * 0.05);
    return { rx, b, scr: { x: x + b, y: y + b, w: w - b * 2, h: h - b * 2, rx: Math.max(0.8, rx - b) } };
  }
  const MAC = [0.86, 0.022, 1.1];
  const LAP = [0.84, 0.026, 1.5];
  const OS_OF = { winPc: 'win', macBook: 'mac', linuxPc: 'linux', laptop: 'plain', phone: 'android', tablet: 'tablet' };
  function screenRect(kind, x, y, w, h, o = {}) {
    if (kind === 'phone') return geomPhone(x, y, w, h).scr;
    if (kind === 'tablet') return geomTablet(x, y, w, h).scr;
    if (kind === 'macBook') return geomLaptop(x, y, w, h, ...MAC).scr;
    if (kind === 'winPc' && o.form !== 'laptop') return geomMonitor(x, y, w, h).scr;
    if (kind === 'linuxPc' && o.form === 'desktop') return geomMonitor(x, y, w, h).scr;
    return geomLaptop(x, y, w, h, ...LAP).scr;
  }

  // ---- devices: one family — near-black glass, a hairline rim, a key edge on top ----
  const shell = (x, y, w, h, rx) => rect(x, y, w, h, rx, `fill="${ref('body')}" stroke="${ref('rim')}" stroke-width="${SW.hair}"`);

  function monitorBody(x, y, w, h, g, style) {
    const cx = x + w / 2;
    const foot = Math.max(1.4, g.sh * 0.13);
    const neckW = w * (style === 'linux' ? 0.05 : 0.065);
    const footW = w * (style === 'linux' ? 0.24 : 0.3);
    return rect(cx - neckW / 2, y + g.mh - 0.5, neckW, h - g.mh - foot + 0.5, 0, `fill="${ref('alu')}" ${st(0.18)}`)
      + rect(cx - footW / 2, y + h - foot, footW, foot, foot / 2, `fill="${ref('alu')}" stroke="${ref('rim')}" stroke-width="${SW.hair}"`)
      + edge(cx - footW / 2 + foot, y + h - foot, footW - foot * 2, 0.5)
      + shell(x, y, w, g.mh, g.rx) + edge(x + g.rx, y, w - g.rx * 2);
  }

  function winPc(x, y, w, h, o = {}) {
    if (o.form === 'laptop') return laptopBody(x, y, w, h, o, 'win');
    const g = geomMonitor(x, y, w, h);
    return `<g class="ka-dev ka-win">${underGlow(x, y, w, h, o)}${monitorBody(x, y, w, h, g, 'win')}${screenEl(g.scr, 'win', o)}</g>`;
  }

  // A laptop's base: a slim slab, wider than the lid, a key edge where the lid meets it.
  function base(x, by, w, bh, lx, lw, notch) {
    const r = bh * 0.5;
    let out = `<path d="M${f(x)} ${f(by)}H${f(x + w)}V${f(by + bh - r)}Q${f(x + w)} ${f(by + bh)} ${f(x + w - r * 2)} ${f(by + bh)}H${f(x + r * 2)}Q${f(x)} ${f(by + bh)} ${f(x)} ${f(by + bh - r)}Z" fill="${ref('alu')}" stroke="${ref('rim')}" stroke-width="${SW.hair}"/>`
      + edge(x + w * 0.04, by, w * 0.92, 0.9);
    if (notch) out += rect(x + w / 2 - w * 0.06, by + 0.35, w * 0.12, Math.max(0.6, bh * 0.28), bh * 0.14, 'fill="#000" fill-opacity="0.5"');
    return out;
  }

  function macBook(x, y, w, h, o = {}) {
    const g = geomLaptop(x, y, w, h, ...MAC);
    const cx = x + w / 2;
    const rx = Math.max(1.6, g.lw * 0.03);
    let out = `<g class="ka-dev ka-mac">${underGlow(x, y, w, h, o)}`;
    out += shell(g.lx, y, g.lw, g.lh + 0.5, rx) + edge(g.lx + rx, y, g.lw - rx * 2);
    out += screenEl(g.scr, 'mac', o);
    // The notch: black, in the bezel's colour, over the top of the screen.
    const nw = g.lw * 0.12;
    const nh = Math.max(1.4, g.b * 1.25);
    const nr = nh * 0.42;
    out += `<path d="M${f(cx - nw / 2)} ${f(g.scr.y - 0.2)}h${f(nw)}v${f(nh - nr)}q0 ${f(nr)} ${f(-nr)} ${f(nr)}h${f(-(nw - nr * 2))}q${f(-nr)} 0 ${f(-nr)} ${f(-nr)}z" fill="#0c0c0f"/>`;
    out += base(x, y + g.lh, w, g.bh, g.lx, g.lw, true);
    return out + '</g>';
  }

  function laptopBody(x, y, w, h, o, os) {
    const g = geomLaptop(x, y, w, h, ...LAP);
    const cx = x + w / 2;
    const rx = Math.max(1.4, g.lw * (os === 'linux' ? 0.018 : 0.026));
    let out = `<g class="ka-dev ka-${os === 'plain' ? 'laptop' : os}">${underGlow(x, y, w, h, o)}`;
    out += shell(g.lx, y, g.lw, g.lh + 0.5, rx) + edge(g.lx + rx, y, g.lw - rx * 2);
    out += screenEl(g.scr, os, o);
    out += circ(cx, y + g.b / 2, Math.max(0.3, g.b * 0.14), 'fill="#fff" fill-opacity="0.12"');
    out += base(x, y + g.lh, w, g.bh, g.lx, g.lw, os !== 'linux');
    return out + '</g>';
  }

  function linuxPc(x, y, w, h, o = {}) {
    if (o.form === 'desktop') {
      const g = geomMonitor(x, y, w, h);
      return `<g class="ka-dev ka-linux">${underGlow(x, y, w, h, o)}${monitorBody(x, y, w, h, g, 'linux')}${screenEl(g.scr, 'linux', o)}</g>`;
    }
    return laptopBody(x, y, w, h, o, 'linux');
  }

  function laptop(x, y, w, h, o = {}) {
    return laptopBody(x, y, w, h, Object.assign({ apps: false }, o), 'plain');
  }

  function phone(x, y, w, h, o = {}) {
    const g = geomPhone(x, y, w, h);
    const cx = x + w / 2;
    let out = `<g class="ka-dev ka-phone">${underGlow(x, y, w, h, o)}`;
    out += rect(x + w - 0.2, y + h * 0.22, Math.max(0.6, w * 0.02), h * 0.1, 0.3, 'fill="#fff" fill-opacity="0.22"');
    out += shell(x, y, w, h, g.rx) + edge(x + g.rx, y, w - g.rx * 2);
    out += screenEl(g.scr, 'android', o);
    out += circ(cx, g.scr.y + Math.max(1.6, g.scr.w * 0.075), Math.max(0.55, w * 0.026), `fill="#000" ${st(0.16, SW.fine)}`);
    return out + '</g>';
  }

  function tablet(x, y, w, h, o = {}) {
    const g = geomTablet(x, y, w, h);
    let out = `<g class="ka-dev ka-tablet">${underGlow(x, y, w, h, o)}`;
    out += shell(x, y, w, h, g.rx) + edge(x + g.rx, y, w - g.rx * 2);
    out += screenEl(g.scr, 'tablet', o);
    out += w > h ? circ(x + w / 2, y + g.b / 2, Math.max(0.35, g.b * 0.14), 'fill="#fff" fill-opacity="0.14"')
      : circ(x + g.b / 2, y + h / 2, Math.max(0.35, g.b * 0.14), 'fill="#fff" fill-opacity="0.14"');
    return out + '</g>';
  }

  function computer(os, x, y, w, h, o = {}) {
    if (os === 'win') return winPc(x, y, w, h, o);
    if (os === 'mac') return macBook(x, y, w, h, o);
    if (os === 'linux') return linuxPc(x, y, w, h, o);
    if (os === 'android' || os === 'phone') {
      const pw = Math.min(w, h * 0.5);
      return phone(x + (w - pw) / 2, y + (h - pw * 2) / 2, pw, pw * 2, o);
    }
    if (os === 'tablet') return tablet(x, y, w, h, o);
    return laptop(x, y, w, h, o);
  }

  function screen(kind, x, y, w, h, o = {}) {
    const os = kind === 'winPc' && o.form === 'laptop' ? 'win' : OS_OF[kind] || 'plain';
    return area(os, screenRect(kind, x, y, w, h, o));
  }

  // ---- parts ----
  const titleH = (h) => clamp(h * 0.12, 3.5, 14);
  function windowBody(x, y, w, h) {
    const th = titleH(h);
    const p = Math.max(1.6, th * 0.55);
    return { x: x + p, y: y + th + p, w: w - p * 2, h: h - th - p * 2 };
  }

  function windowEl(x, y, w, h, o = {}) {
    const os = o.os || 'mac';
    const th = titleH(h);
    const rx = clamp(Math.min(w, h) * (os === 'win' ? 0.04 : 0.055), 1, 8);
    const sw = th < 6 ? SW.fine : SW.hair;
    let out = '<g class="ka-window">'
      + rect(x, y, w, h, rx, `fill="${C.glass}" stroke="#fff" stroke-opacity="0.15" stroke-width="${sw}"`)
      + rect(x + 0.4, y + th, w - 0.8, 0.45, 0, 'fill="#fff" fill-opacity="0.05"');
    if (o.active) out += `<path d="M${f(x + rx)} ${f(y)}H${f(x + w - rx)}" class="ka-st1" fill="none" stroke-width="${sw}" stroke-linecap="round" opacity="0.85"/>`;
    const cy = y + th / 2;
    const dot = Math.max(0.35, th * 0.11);
    if (os === 'mac') {
      for (let i = 0; i < 3; i++) out += circ(x + th * 0.6 + i * dot * 3.2, cy, dot, 'fill="#fff" fill-opacity="0.2"');
    } else if (os === 'win') {
      const s = Math.max(0.5, th * 0.13);
      const xr = x + w - th * 0.6;
      const st = `fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="${f(SW.fine * 0.8)}"`;
      out += `<path d="M${f(xr - s)} ${f(cy - s)}l${f(s * 2)} ${f(s * 2)}M${f(xr + s)} ${f(cy - s)}l${f(-s * 2)} ${f(s * 2)}" ${st}/>`
        + rect(xr - s * 5.4, cy - s, s * 2, s * 2, 0, st)
        + `<path d="M${f(xr - s * 9.8)} ${f(cy)}h${f(s * 2)}" ${st}/>`;
    } else if (os === 'linux') {
      out += circ(x + w - th * 0.6, cy, dot * 1.2, 'fill="#fff" fill-opacity="0.2"');
    }
    if (o.title) {
      const left = os === 'win';
      out += `<text x="${f(left ? x + th * 0.6 : x + w / 2)}" y="${f(cy + th * 0.15)}" font-family="${UI_FONT}" font-size="${f(th * 0.42)}" fill="#fff" fill-opacity="0.4"${left ? '' : ' text-anchor="middle"'}>${esc(o.title)}</text>`;
    }
    const b = windowBody(x, y, w, h);
    const body = o.body == null ? 'lines' : o.body;
    if (typeof body === 'function') out += body(b);
    else if (BODY[body]) out += BODY[body](b, o);
    else if (body !== 'blank') out += String(body);
    return out + '</g>';
  }

  const BODY = {
    lines: (b) => {
      const t = clamp(b.h * 0.07, 0.6, 3);
      return bar(b.x, b.y + t * 0.4, b.w * 0.42, t, 0.22) + bar(b.x, b.y + t * 3, b.w * 0.86, t, 0.1)
        + bar(b.x, b.y + t * 5.2, b.w * 0.7, t, 0.1) + bar(b.x, b.y + t * 7.4, b.w * 0.5, t, 0.1);
    },
    media: (b) => {
      const mh = b.h * 0.66;
      const r = Math.min(b.w, mh) * 0.06;
      const t = clamp(b.h * 0.06, 0.6, 2.6);
      return rect(b.x, b.y, b.w, mh, r, `fill="#fff" fill-opacity="0.03" ${st(0.08, SW.fine)}`)
        + `<path d="M${f(b.x + b.w * 0.08)} ${f(b.y + mh * 0.8)}L${f(b.x + b.w * 0.36)} ${f(b.y + mh * 0.46)}L${f(b.x + b.w * 0.52)} ${f(b.y + mh * 0.64)}L${f(b.x + b.w * 0.68)} ${f(b.y + mh * 0.5)}L${f(b.x + b.w * 0.92)} ${f(b.y + mh * 0.8)}" ${hair(0.22, SW.fine)} stroke-linejoin="round"/>`
        + bar(b.x, b.y + mh + t * 2, b.w * 0.6, t, 0.16) + bar(b.x, b.y + mh + t * 4.2, b.w * 0.36, t, 0.08);
    },
    grid: (b) => {
      let out = '';
      const gap = Math.min(b.w, b.h) * 0.06;
      const gw = (b.w - gap * 2) / 3;
      const gh = (b.h - gap) / 2;
      for (let i = 0; i < 6; i++) {
        out += rect(b.x + (i % 3) * (gw + gap), b.y + Math.floor(i / 3) * (gh + gap), gw, gh, Math.min(gw, gh) * 0.12,
          `fill="#fff" fill-opacity="0.03" ${st(0.09, SW.fine)}`);
      }
      return out;
    },
    code: (b) => {
      const t = clamp(b.h * 0.07, 0.6, 2.6);
      return [[0, 0.3, 0.22], [1, 0.46, 0.1], [2, 0.36, 0.1], [2, 0.28, 0.1], [1, 0.4, 0.1], [0, 0.18, 0.16]]
        .map(([ind, w, op], i) => bar(b.x + ind * t * 2.4, b.y + i * t * 2.3, b.w * w, t, op)).join('');
    },
    chat: (b) => {
      const h = b.h * 0.15;
      let out = '';
      for (let i = 0; i < 4; i++) {
        const mine = i % 2 === 1;
        const w = b.w * (0.46 + (i % 3) * 0.1);
        out += rect(mine ? b.x + b.w - w : b.x, b.y + i * h * 1.5, w, h, h / 2, `fill="#fff" fill-opacity="${mine ? 0.12 : 0.06}"`);
      }
      return out;
    },
    blank: () => '',
  };

  function terminal(x, y, w, h, o = {}) {
    const th = titleH(h);
    const rx = clamp(Math.min(w, h) * 0.05, 1, 8);
    let out = '<g class="ka-terminal">'
      + rect(x, y, w, h, rx, `fill="#09090b" stroke="#fff" stroke-opacity="0.15" stroke-width="${th < 6 ? SW.fine : SW.hair}"`)
      + rect(x + 0.4, y + th, w - 0.8, 0.45, 0, 'fill="#fff" fill-opacity="0.05"')
      + circ(x + w - th * 0.6, y + th / 2, Math.max(0.35, th * 0.13), 'fill="#fff" fill-opacity="0.2"');
    const pad = Math.max(1.6, th * 0.6);
    const lh = clamp((h - th - pad) / 5, 1.6, 16);
    if (o.text) {
      o.text.forEach((s, i) => {
        out += `<text x="${f(x + pad)}" y="${f(y + th + pad + lh * (i + 0.75))}" font-family="${MONO_FONT}" font-size="${f(lh * 0.62)}" fill="#fff" fill-opacity="${i === 0 ? 0.6 : 0.36}" xml:space="preserve">${esc(s)}</text>`;
      });
      return out + '</g>';
    }
    const rows = o.lines || [[[C.ink, 0.06], [C.ink, 0.42]], [[C.ink, 0.6]], [[C.ink, 0.5]], [[C.ink, 0.06], [C.ink, 0.22]]];
    const t = lh * 0.34;
    let lastX = x + pad;
    let lastY = y + th + pad;
    rows.forEach((row, i) => {
      let rx2 = x + pad;
      const ry = y + th + pad + i * lh;
      (Array.isArray(row[0]) ? row : [row]).forEach(([, part], j) => {
        out += bar(rx2, ry, (w - pad * 2) * part, t, j === 0 && i === 0 ? 0.42 : 0.14);
        rx2 += (w - pad * 2) * part + t * 0.9;
      });
      lastX = rx2;
      lastY = ry;
    });
    if (o.cursor !== false) {
      out += rect(lastX, lastY - t * 0.4, t * 0.9, t * 1.8, 0, 'fill="#fff" fill-opacity="0.5"')
        .replace('/>', `>${o.anim === false ? '' : `<animate attributeName="opacity" dur="2.4s" ${REP} values="1;0.15;1" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>`}</rect>`);
    }
    return out + '</g>';
  }

  const PTR = 'M0 0V17l4.6-4.2 3 6.8 3-1.3-3-6.7H14z';
  function cursor(x, y, o = {}) {
    const s = o.s || 1;
    return `<g class="ka-cursor" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">`
      + (o.glow ? `<path d="${PTR}" fill="${hex(o.glow)}" opacity="0.35" filter="${ref('glow')}"/>` : '')
      + `<path d="${PTR}" transform="translate(0.4 0.9)" fill="#000" opacity="0.55" filter="${ref('soft')}"/>`
      + `<path d="${PTR}" fill="#f4f4f6" stroke="#000" stroke-opacity="0.85" stroke-width="0.9" stroke-linejoin="round"/></g>`;
  }

  function file(x, y, kind = 'doc', o = {}) {
    const s = o.s || 1;
    const line = o.accent ? 'class="ka-st1" fill="none" stroke-width="0.8"' : `fill="none" stroke="#fff" stroke-opacity="0.42" stroke-width="0.8"`;
    const g = `fill="none" stroke="#fff" stroke-opacity="0.38" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"`;
    let out = `<g class="ka-file" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">`;
    if (kind === 'folder') {
      return out + `<path d="M-15 -11.5h8.5l2.6 2.8H15V12H-15z" fill="${ref('body')}" ${line} stroke-linejoin="round"/>`
        + `<path d="M-15 -5H15" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="0.6"/>`
        + rect(-14.5, -11.85, 7, 0.7, 0, `fill="${ref('edge')}"`) + '</g>';
    }
    out += `<path d="M-13 -16h17l9 9v23h-26z" fill="${ref('body')}" ${line} stroke-linejoin="round"/>`
      + `<path d="M4 -16v9h9" ${line} stroke-linejoin="round" stroke-opacity="0.3"/>`
      + rect(-12, -16.35, 15, 0.7, 0, `fill="${ref('edge')}"`);
    if (kind === 'img') {
      out += `<path d="M-8 7l5-6 3.5 3.5 2.5-2.5 5 5" ${g}/>` + circ(3.5, -3, 1.8, g);
    } else if (kind === 'code') {
      out += `<path d="M-4 -2l-3.5 3.5 3.5 3.5M3 -2l3.5 3.5-3.5 3.5" ${g}/>`;
    } else if (kind === 'zip') {
      for (let i = 0; i < 4; i++) out += rect(i % 2 ? -0.4 : -2.6, -14 + i * 3, 3, 1.2, 0.4, 'fill="#fff" fill-opacity="0.3"');
      out += rect(-2.6, -1, 5.2, 6, 1.4, g);
    } else if (kind === 'music') {
      out += `<path d="M-2 6V-5l7-1.6v10" ${g}/>` + circ(-3.8, 6, 1.9, g) + circ(3.2, 4.4, 1.9, g);
    } else if (kind === 'video') {
      out += `<path d="M-3 -4v9l7.5-4.5z" ${g}/>`;
    } else if (kind === 'pdf') {
      out += bar(-8, -6, 10, 1.2, 0.3) + bar(-8, -2.6, 16, 1.2, 0.14) + bar(-8, 0.8, 13, 1.2, 0.14)
        + `<text x="0" y="11.5" font-family="${UI_FONT}" font-size="4.6" font-weight="500" letter-spacing="0.4" text-anchor="middle" fill="#fff" fill-opacity="0.4">PDF</text>`;
    } else {
      out += bar(-8, -7, 10, 1.2, 0.32) + bar(-8, -3, 16, 1.2, 0.14) + bar(-8, 1, 14, 1.2, 0.14) + bar(-8, 5, 9, 1.2, 0.14);
    }
    return out + '</g>';
  }

  function glowOrb(x, y, r, colour = 'f1', o = {}) {
    const pulse = o.pulse !== false && o.anim !== false;
    const dur = o.dur || 6;
    let out = `<circle class="ka-orb" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${ref('r-' + colour)}" opacity="0.7">`
      + (pulse ? `<animate attributeName="opacity" dur="${dur}s" ${REP} values="0.5;0.8;0.5" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>` : '') + '</circle>';
    if (o.core) out += circ(x, y, Math.max(1, r * 0.06), 'fill="#fff" fill-opacity="0.9"');
    return out;
  }

  // No sparkles, stars or confetti in this style; kept so older scenes still run.
  function sparkles() { return ''; }

  function beamPath(x1, y1, x2, y2, bend = -0.22) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = (x1 + x2) / 2 + (-dy / len) * len * bend;
    const cy = (y1 + y2) / 2 + (dx / len) * len * bend;
    return `M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`;
  }
  function beam(x1, y1, x2, y2, o = {}) {
    const d = beamPath(x1, y1, x2, y2, o.bend == null ? -0.22 : o.bend);
    const dur = Math.max(2.4, o.dur || 3);
    if (o.dim) return `<g class="ka-beam ka-dim"><path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="${SW.hair}" stroke-dasharray="0.6 3.4" stroke-linecap="round"/></g>`;
    const gid = uid('bg');
    let out = `<g class="ka-beam"><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}">`
      + SPEC.map(([of, c]) => `<stop offset="${of}" stop-color="${c}"/>`).join('') + '</linearGradient>'
      + `<path d="${d}" fill="none" stroke="url(#${gid})" stroke-opacity="0.4" stroke-width="${SW.hair}" stroke-linecap="round"/>`;
    if (o.anim !== false) {
      const n = o.dots == null ? 1 : Math.max(1, Math.min(2, o.dots));
      for (let i = 0; i < n; i++) {
        const back = o.back && i % 2 === 1;
        const begin = f((i * dur) / n);
        // A short white run of light, fading in and out along the way.
        out += `<path d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="0.16 1.2" stroke-dashoffset="${back ? -1 : 0.16}" opacity="0">`
          + `<animate attributeName="stroke-dashoffset" dur="${dur}s" ${REP} begin="-${begin}s" values="${back ? '-1;0.16' : '0.16;-1'}" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1"/>`
          + `<animate attributeName="opacity" dur="${dur}s" ${REP} begin="-${begin}s" values="0;0.85;0.85;0" keyTimes="0;0.2;0.75;1"/></path>`;
      }
    }
    return out + '</g>';
  }

  function glassEl(x, y, w, h, o = {}) {
    const rx = o.rx == null ? 10 : o.rx;
    return `<g class="ka-glass">${rect(x, y, w, h, rx, `fill="${ref('glass')}" stroke="#fff" stroke-opacity="0.13" stroke-width="${SW.hair}"`)}${edge(x + rx, y, w - rx * 2, 0.7)}</g>`;
  }

  function svg(inner, o = {}) {
    const w = o.w || 400;
    const h = o.h || 240;
    const d = defs(o.id || 'svg');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${d}</defs>${typeof inner === 'function' ? inner() : inner}</svg>`;
  }

  // ---- which computers: this one and the other ----
  const OS_NAME = (v) => {
    const s = String(v || '').toLowerCase();
    if (!s) return null;
    if (/android|phone/.test(s)) return 'android';
    if (/mac|darwin|os x|ios/.test(s)) return 'mac';
    if (/win/.test(s)) return 'win';
    if (/linux|x11|cros|ubuntu|fedora/.test(s)) return 'linux';
    return null;
  };
  function os() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const me = OS_NAME((nav.userAgentData && nav.userAgentData.platform) || nav.platform || nav.userAgent) || 'win';
    let peer = null;
    try {
      const s = typeof window !== 'undefined' && window.UI && window.UI.state;
      if (s) {
        peer = OS_NAME((s.peer && s.peer.os) || (s.client && s.client.os));
        if (!peer && Array.isArray(s.peers) && s.peers.length) peer = OS_NAME(s.peers[0] && s.peers[0].os);
        if (!peer && Array.isArray(s.paired) && s.paired.length) {
          const last = [...s.paired].sort((x, y) => (y.lastSeen || 0) - (x.lastSeen || 0))[0];
          peer = OS_NAME(last && last.os);
        }
      }
    } catch (e) { /* the state isn't there yet */ }
    return { me, peer: peer || (me === 'win' ? 'mac' : 'win') };
  }

  // html.ka-me-<os> / html.ka-peer-<os>, for aurora-art.css (the Connection page's two devices).
  function tagRoot() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const { me, peer } = os();
    const want = ['ka-me-' + me, 'ka-peer-' + peer];
    const cl = document.documentElement.classList;
    if (want.every((c) => cl.contains(c))) return;
    [...cl].filter((c) => /^ka-(me|peer)-/.test(c)).forEach((c) => cl.remove(c));
    want.forEach((c) => cl.add(c));
  }
  if (typeof document !== 'undefined' && typeof setInterval === 'function') {
    tagRoot();
    setInterval(tagRoot, 3000);
  }

  const K = {
    C, SW, PTR, a, defs, ref, uid,
    winPc, macBook, linuxPc, laptop, phone, tablet, computer, screen, screenRect, os,
    window: windowEl, windowBody, terminal, cursor, file, glowOrb, sparkles, beam, beamPath, glass: glassEl, svg,
  };
  if (typeof window !== 'undefined') {
    window.AuroraKit = K;
    window.AuroraArt = window.AuroraArt || {};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = K;
})();
