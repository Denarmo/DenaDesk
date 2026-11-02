/* DenaDesk website. Made by 0xCodez. Based on DenaDesk by Inuka Asith, GPL-3.0.
   Loaded in <head> without defer so the "js" class is on <html> before the first paint (reveal
   animations start hidden only when this script runs); everything else waits for the DOM. */
'use strict';
document.documentElement.classList.add('js');

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const skyBoost = { v: 0, target: 0 }; // the live demo brightens the sky while it works
// Stripe sends tippers back with ?tip=success, which the tips embed strips from the address, so read it now.
const tipStatus = new URLSearchParams(location.search).get('tip');

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ================= the living sky =================
     A small canvas (about 200 px wide) redrawn ~30 times a second and scaled up by CSS: the browser's
     smoothing turns it into soft light for almost no cost. Slow orbiting colour fields plus aurora
     curtains whose hue drifts with time and with how far down the page you are. Pauses when the tab
     is hidden; draws one still frame when the visitor prefers reduced motion. */
  const cv = $('#sky');
  const ctx = cv && cv.getContext('2d', { alpha: false });
  if (ctx) {
    let W = 0, H = 0, raf = 0, last = 0, pending = false, t0 = performance.now();
    let scrollP = 0, depth = 0, px = .5, py = .3, tpx = .5, tpy = .3;
    const blobs = [
      { h: 330, x: .18, y: .12, r: .55, sx: .11, sy: .07, ph: 0 },
      { h: 262, x: .55, y: .05, r: .62, sx: .07, sy: .05, ph: 1.7 },
      { h: 192, x: .86, y: .18, r: .5, sx: .09, sy: .08, ph: 3.1 },
      { h: 152, x: .3, y: .95, r: .5, sx: .08, sy: .05, ph: 4.4 },
      { h: 36, x: .78, y: .9, r: .45, sx: .1, sy: .06, ph: 5.2 },
    ];
    const curtains = [
      { h: 268, base: .1, amp: .07, len: .42, f: .021, sp: .16, a: .5 },
      { h: 188, base: .18, amp: .06, len: .36, f: .028, sp: -.12, a: .42 },
      { h: 330, base: .05, amp: .05, len: .3, f: .017, sp: .09, a: .3 },
    ];

    const resize = () => {
      const vw = innerWidth, vh = innerHeight;
      W = vw < 700 ? 120 : 200;
      H = Math.max(60, Math.round(W * vh / vw));
      cv.width = W; cv.height = H;
      draw(performance.now());
    };

    function draw(now) {
      const t = (now - t0) / 1000;
      // full strength behind the hero, quieter behind reading sections, back up for the finale
      const dim = Math.max(1 - depth * .58, Math.min(1, Math.max(0, (scrollP - .86) / .14)) * .85);
      const boost = (1 + skyBoost.v * .55) * dim;
      const hueShift = scrollP * 140 + Math.sin(t * .05) * 25;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#040405';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // colour fields
      for (const b of blobs) {
        const x = (b.x + Math.sin(t * b.sx + b.ph) * .16) * W;
        const y = (b.y + Math.cos(t * b.sy + b.ph) * .1) * H;
        const r = b.r * Math.max(W, H) * (1 + Math.sin(t * .2 + b.ph) * .08);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const h = b.h + hueShift;
        g.addColorStop(0, `hsla(${h},95%,58%,${.2 * boost})`);
        g.addColorStop(.5, `hsla(${h + 20},95%,50%,${.07 * boost})`);
        g.addColorStop(1, 'hsla(0,0%,0%,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // aurora curtains: vertical rays hanging from a waving edge, brightest at the bottom of each ray
      const step = W < 150 ? 2 : 3;
      for (const c of curtains) {
        for (let x = 0; x <= W; x += step) {
          const k = x / W;
          const edge = (c.base + .02 * scrollP + Math.sin(x * c.f + t * c.sp * 3) * c.amp + Math.sin(x * c.f * 2.7 - t * .21) * c.amp * .5) * H;
          const len = c.len * H * (.75 + .25 * Math.sin(x * .05 + t * .4));
          const ray = .55 + .45 * Math.sin(x * .11 + t * 1.1) * Math.sin(x * .045 - t * .6);
          const a = c.a * .62 * ray * boost * (.4 + .6 * Math.sin(Math.PI * Math.min(1, Math.max(0, k))));
          if (a <= .01) continue;
          const h = c.h + hueShift + k * 70 + Math.sin(t * .3 + k * 4) * 18;
          const top = edge, bot = edge + len;
          const g = ctx.createLinearGradient(0, top - len * .4, 0, bot);
          g.addColorStop(0, `hsla(${h},100%,60%,0)`);
          g.addColorStop(.7, `hsla(${h},100%,62%,${a * .35})`);
          g.addColorStop(.92, `hsla(${h + 25},100%,68%,${a})`);
          g.addColorStop(1, `hsla(${h + 25},100%,60%,0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - step / 2, top - len * .4, step * 2, len * 1.4);
        }
      }

      // a soft light that follows the pointer
      px += (tpx - px) * .04; py += (tpy - py) * .04;
      const g = ctx.createRadialGradient(px * W, py * H, 0, px * W, py * H, W * .32);
      g.addColorStop(0, `hsla(${200 + hueShift},100%,65%,.13)`);
      g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 32) return; // ~30 fps is plenty for slow light
      last = now;
      skyBoost.v += (skyBoost.target - skyBoost.v) * .05;
      draw(now);
    };
    const start = () => { if (!raf && !reduceMotion.matches && !document.hidden) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    addEventListener('resize', resize, { passive: true });
    addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollP = max > 0 ? scrollY / max : 0;
      depth = Math.min(1, scrollY / (innerHeight * .9));
      if (reduceMotion.matches && !pending) { pending = true; requestAnimationFrame((n) => { pending = false; draw(n); }); }
    }, { passive: true });
    addEventListener('pointermove', (e) => { tpx = e.clientX / innerWidth; tpy = e.clientY / innerHeight; }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reduceMotion.addEventListener('change', () => { stop(); start(); draw(performance.now()); });
    resize();
    requestAnimationFrame(() => cv.classList.add('ready'));
    start();
  }

  /* ================= nav, reveal, spotlight, offscreen pause ================= */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const reveals = $$('.reveal');
  // stagger siblings that enter together
  const groups = new Map();
  for (const el of reveals) {
    const p = el.parentElement;
    const i = groups.get(p) || 0;
    groups.set(p, i + 1);
    el.style.setProperty('--d', `${Math.min(i, 6) * .07}s`);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    reveals.forEach((el) => io.observe(el));

    const pauseIo = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('paused', !e.isIntersecting);
    }, { rootMargin: '100px' });
    $$('.card, .step, .privacy, .conn-panel, .stage, .final').forEach((el) => pauseIo.observe(el));
  } else reveals.forEach((el) => el.classList.add('in'));

  for (const card of $$('.card')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }

  // the app window lifts flat as it scrolls into view
  const win = $('#win'), stage = $('.stage');
  if (win && stage) {
    let ticking = false;
    const tilt = () => {
      ticking = false;
      if (reduceMotion.matches || innerWidth < 720) { win.style.setProperty('--tilt', '0deg'); return; }
      const r = stage.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (r.top - innerHeight * .12) / (innerHeight * .75)));
      win.style.setProperty('--tilt', `${(k * 14).toFixed(2)}deg`);
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
    addEventListener('resize', tilt, { passive: true });
    tilt();
  }

  /* ================= download: point at the visitor's system ================= */
  const OS = {
    win: { label: 'Download for Windows', icon: '#os-win' },
    mac: { label: 'Download for macOS', icon: '#os-mac' },
    linux: { label: 'Download for Linux', icon: '#os-linux' },
    android: { label: 'Download for Android', icon: '#os-android' },
  };
  const detectOS = () => {
    const ua = navigator.userAgent || '';
    const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(plat) && navigator.maxTouchPoints > 1)) return null; // no iOS app
    if (/Win/i.test(plat) || /Windows/i.test(ua)) return 'win';
    if (/Mac/i.test(plat) || /Mac OS X/i.test(ua)) return 'mac';
    if (/Linux|X11|CrOS/i.test(plat + ua)) return 'linux';
    return null;
  };
  const os = detectOS();
  if (os) {
    $('#dl-main-label').textContent = OS[os].label;
    $('#dl-main').setAttribute('href', '/api/download?os=' + os); // straight to the file for this system
    $('#dl-main-icon use').setAttribute('href', OS[os].icon);
    $$(`[data-os="${os}"]`).forEach((el) => el.classList.add('mine'));
  }

  /* ================= live app preview: the command bar ================= */
  const cmd = $('#cmd');
  if (cmd) {
    const layers = { idle: $('#l-idle'), rec: $('#l-rec'), exp: $('#l-exp') };
    const inp = $('#inp'), sugs = $('#sugs'), tx = $('#tx'), res = $('#res');
    let state = 'idle', amp = .3, target = .3, recStart = 0, recTimer = 0, runId = 0, touched = false;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    const hr = new Date().getHours();
    $('#greet').textContent = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';

    const setState = (s) => {
      state = s;
      cmd.classList.toggle('rec', s === 'rec');
      cmd.classList.toggle('exp', s === 'exp');
      for (const k in layers) layers[k].classList.toggle('off', k !== s);
      sugs.classList.toggle('hide', s !== 'idle');
      skyBoost.target = s === 'idle' ? 0 : 1;
      if (reduceMotion.matches) win.style.setProperty('--amp', s === 'idle' ? '.3' : '.75'); // no breathing, just the state
    };

    // recording (simulated: nothing is ever captured)
    const bars = $('#bars');
    for (let i = 0; i < 14; i++) bars.appendChild(document.createElement('i'));
    const barEls = [...bars.children];
    const SPOKEN = ['Send my screen to Workstation and sync the clipboard', 'Use Pixel 8 as a webcam', 'Mirror my phone and show its notifications', 'Continue what I was doing on Workstation'];
    let spokenIdx = 0;
    const startRec = () => {
      touched = true; runId++;
      setState('rec'); recStart = Date.now();
      clearInterval(recTimer);
      recTimer = setInterval(() => {
        const s = ((Date.now() - recStart) / 1000) | 0;
        $('#tm').textContent = `00:${String(s).padStart(2, '0')}`;
        if (s >= 3) stopRec();
      }, 200);
      $('#stop').focus({ preventScroll: true });
    };
    const stopRec = () => { clearInterval(recTimer); run(SPOKEN[spokenIdx++ % SPOKEN.length]); };
    $('#mic').addEventListener('click', startRec);
    $('#mic2').addEventListener('click', startRec);
    $('#stop').addEventListener('click', stopRec);

    // understanding a request: keyword matching is plenty for a preview
    const plan = (text) => {
      const t = text.toLowerCase(), out = [];
      const add = (dev, f, label) => out.push({ dev, f, label });
      const file = (text.match(/[\w-]+\.(pdf|docx?|xlsx?|pptx?|key|png|jpe?g|zip|mp4|txt)\b/i) || [])[0];
      if (/screen|extend|display|monitor/.test(t) && !/mirror|phone/.test(t)) add('pc', 'screen', 'Extending your screen onto Workstation');
      if (/mirror/.test(t) || /(phone|pixel( 8)?)('s)? screen/.test(t)) add('phone', 'screen', 'Mirroring Pixel 8 in a window');
      if (/clipboard|copy|paste/.test(t)) add('pc', 'clip', 'Clipboard syncing both ways');
      if (/webcam|camera|video call/.test(t)) add('phone', 'cam', 'Pixel 8 is now your webcam');
      if (/notif/.test(t)) add('phone', 'bell', 'Notifications from Pixel 8 on');
      if (/call|text|sms|message/.test(t)) add('phone', 'bell', 'Calls and texts from Pixel 8 on this desk');
      if (file || /file|pdf|photo/.test(t) || (/send|share/.test(t) && !/screen/.test(t))) add(/phone|pixel/.test(t) && !/workstation/.test(t) ? 'phone' : 'pc', 'files', `Sending ${file || 'Keynote.pdf'} · 4.8 MB`);
      if (/mouse|keyboard|cursor|control/.test(t)) add('pc', 'input', 'One mouse and keyboard for both');
      if (/continue|resume|rezume|left off|hand ?off/.test(t)) add('pc', 'clip', 'ReZume: opening Q3 plan.docx at page 4');
      if (!out.length) {
        if (/mac|windows|linux|android|phone|pixel|workstation/.test(t)) add('pc', 'input', 'Connected over Wi-Fi · encrypted');
        else out.push({ label: 'Try “mirror my phone” or “send a file”' });
      }
      return out.slice(0, 4);
    };

    async function run(text) {
      const id = ++runId;
      setState('exp');
      tx.textContent = ''; res.textContent = '';
      const said = document.createElement('span'); said.className = 'sr-only'; said.textContent = text;
      tx.appendChild(said); // words below are aria-hidden: screen readers read the request once, from here
      const words = text.split(/\s+/).filter(Boolean).slice(0, 18);
      for (const w of words) {
        if (id !== runId) return;
        const s = document.createElement('span');
        s.textContent = w; s.className = 'ghost'; s.setAttribute('aria-hidden', 'true');
        tx.appendChild(s);
        await wait(120);
        s.className = '';
      }
      await wait(320);
      for (const step of plan(text)) {
        if (id !== runId) return;
        const d = document.createElement('div');
        const sp = document.createElement('span'); sp.className = 'sp-ic'; sp.setAttribute('aria-hidden', 'true');
        d.append(sp, document.createTextNode(step.label));
        res.appendChild(d);
        await wait(650);
        if (id !== runId) return;
        const ok = document.createElement('span'); ok.className = 'ok'; ok.textContent = '✓'; ok.setAttribute('aria-hidden', 'true');
        sp.replaceWith(ok);
        if (step.dev) {
          const card = $(`.dev[data-dev="${step.dev}"]`);
          const ft = card && $(`.ft[data-f="${step.f}"]`, card);
          if (ft) { ft.classList.add('on'); ft.setAttribute('aria-pressed', 'true'); }
          if (card) {
            card.classList.add('live', 'flash');
            $('.st', card).classList.remove('off');
            setTimeout(() => card.classList.remove('flash'), 1600);
          }
        }
      }
    }

    const submit = () => {
      touched = true;
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      inp.value = '';
      run(v);
    };
    const close = () => { runId++; clearInterval(recTimer); setState('idle'); };
    $('#send').addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    $('#close').addEventListener('click', () => { close(); inp.focus({ preventScroll: true }); });
    $$('.sug').forEach((b) => b.addEventListener('click', () => { touched = true; run(b.textContent); }));
    cmd.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state !== 'idle') { close(); inp.focus({ preventScroll: true }); } });

    $$('.ft').forEach((f) => f.addEventListener('click', () => {
      touched = true;
      const on = f.classList.toggle('on');
      f.setAttribute('aria-pressed', String(on));
      const card = f.closest('.dev');
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 1200);
    }));

    // the aurora inside the bar: idle breathing, focus brightens, typing and "voice" drive it
    inp.addEventListener('focus', () => { touched = true; target = .55; });
    inp.addEventListener('blur', () => { target = .3; });
    inp.addEventListener('input', () => { amp = Math.min(1, amp + .15); });
    let raf = 0, visible = false;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      let goal = target;
      if (state === 'rec') {
        const v = (Math.sin(t / 90) * .5 + .5) * (Math.sin(t / 370) * .5 + .5);
        goal = .45 + v * .55 + Math.random() * .1;
        barEls.forEach((b, i) => { b.style.height = `${4 + Math.abs(Math.sin(t / 120 + i * .7)) * 18 * (.4 + Math.random() * .6)}px`; });
      } else if (state === 'exp') goal = .75 + Math.sin(t / 600) * .1;
      else goal += Math.sin(t / 900) * .06;
      amp += (goal - amp) * .08;
      win.style.setProperty('--amp', amp.toFixed(3));
    };
    const runLoop = () => { if (!raf && visible && !document.hidden && !reduceMotion.matches) raf = requestAnimationFrame(tick); };
    const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
    document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : runLoop()));
    reduceMotion.addEventListener('change', () => { stopLoop(); runLoop(); });

    // latency ticks like the real pill does
    setInterval(() => {
      if (!visible || document.hidden) return;
      const m = 9 + Math.round(Math.random() * 7);
      $('#ms').textContent = `${m} ms`;
      $('#ms2').textContent = m;
    }, 1400);

    // first time the preview is on screen and nobody has touched it: type a request by itself
    let demoed = false;
    const autoDemo = async () => {
      if (demoed || touched || reduceMotion.matches) return;
      demoed = true;
      await wait(1400);
      const text = 'Extend my screen to Workstation';
      for (const ch of text) {
        if (touched) { inp.value = ''; return; }
        inp.value += ch; amp = Math.min(1, amp + .08);
        await wait(45);
      }
      await wait(450);
      if (touched) return;
      inp.value = '';
      run(text);
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible) { runLoop(); if (e.intersectionRatio > .45) autoDemo(); } else stopLoop();
        }
      }, { threshold: [0, .5] }).observe(win);
    } else { visible = true; runLoop(); }
  }

  /* ================= connections: the link that's in use ================= */
  const panel = $('#conn');
  if (panel) {
    const btns = $$('.lk', panel);
    let auto = true, idx = 0, timer = 0, seen = false;
    const pick = (b) => {
      btns.forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      panel.dataset.k = b.dataset.k;
      $('#conn-name').textContent = $('b', b).textContent;
      $('#conn-ms').textContent = b.dataset.ms;
    };
    btns.forEach((b, i) => b.addEventListener('click', () => { auto = false; clearInterval(timer); idx = i; pick(b); }));
    const cycle = () => { if (!auto || document.hidden || !seen) return; idx = (idx + 1) % btns.length; pick(btns[idx]); };
    if (!reduceMotion.matches) timer = setInterval(cycle, 2800);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[0].isIntersecting; }).observe(panel);
    else seen = true;
  }

  /* ================= analytics for the private /dashboard =================
     Cookieless, no third party: one small POST to this site's /api/track per page view and per
     download click. The server keeps only daily counts (a visitor is a salted hash of IP + browser +
     day, never stored as is). Only the deploy and the local dev server have the API, so a page opened
     from a file sends nothing. */
  const tracking = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const track = (event) => {
    if (!tracking) return;
    const body = JSON.stringify(event);
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/track', body)) return; } catch { /* fall back to fetch */ }
    fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
  };
  const params = new URLSearchParams(location.search);
  track({ t: 'pv', p: location.pathname, r: document.referrer, u: params.get('utm_source') || params.get('ref') || undefined });
  if (tipStatus === 'success') track({ t: 'click', k: 'tips-paid' });

  // Which installer a click means. The links open the latest release page, so the asset is the one that
  // fits the visitor's system: CPU from Client Hints where the browser gives it (Chromium), otherwise the
  // common case (x64 Windows, Apple silicon Mac). A direct file link (…/download/DenaDesk-…) names it exactly.
  let arch = '';
  try {
    navigator.userAgentData?.getHighEntropyValues?.(['architecture'])
      .then((v) => { arch = String(v.architecture || ''); }, () => {});
  } catch { /* no client hints */ }
  const fromFile = (href) => {
    const m = href.match(/\/releases\/(?:latest\/)?download\/(?:[^/]+\/)?(DenaDesk[^/?#]*)$/i);
    if (!m || /mesh/i.test(m[1])) return null;
    const f = m[1];
    if (/\.exe$/i.test(f)) return /arm64|aarch64/i.test(f) ? 'windows-arm64' : 'windows-x64';
    if (/\.dmg$/i.test(f)) return /x64|intel/i.test(f) && !/arm64|universal/i.test(f) ? 'mac-x64' : 'mac-arm64';
    if (/\.AppImage$/i.test(f)) return 'linux-appimage';
    if (/\.deb$/i.test(f)) return 'linux-deb';
    if (/\.apk$/i.test(f)) return /-full\.apk$/i.test(f) ? 'android-full' : 'android';
    return null;
  };
  const fromOS = (o, link) => {
    const cpu = o === os ? arch : ''; // the CPU only says something about the visitor's own system
    if (o === 'win') return cpu === 'arm' ? 'windows-arm64' : 'windows-x64';
    if (o === 'mac') return cpu === 'x86' ? 'mac-x64' : 'mac-arm64';
    if (o === 'linux') return /\.deb\b/i.test(link.textContent) && !/AppImage/i.test(link.textContent) ? 'linux-deb' : 'linux-appimage';
    if (o === 'android') return 'android';
    return null;
  };
  const isRelease = (href) => /github\.com\/0xCodez\/DenaDesk\/releases\/(latest|download|tag)\b/i.test(href);
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    const href = link.href;
    const viaApi = /\/api\/download\?os=([a-z-]+)/.exec(href); // our redirect to the latest release file
    if (viaApi || isRelease(href)) {
      const holder = link.closest('[data-os]');
      const API = { 'win-arm64': 'windows-arm64', deb: 'linux-deb', 'android-full': 'android-full' };
      const asset = link.dataset.dl || (viaApi && (API[viaApi[1]] || fromOS(viaApi[1], link))) || fromFile(href) || fromOS(holder ? holder.dataset.os : link.id === 'dl-main' ? os : null, link);
      const place = link.closest('#top') ? 'hero' : link.closest('#download') ? 'download' : link.closest('.final, .foot') ? 'footer' : 'other';
      if (asset) track({ t: 'dl', k: asset, w: place });
      else track({ t: 'click', k: 'releases-latest' });
    } else if (/github\.com\/0xCodez\/DenaDesk\/releases\/?$/i.test(href)) track({ t: 'click', k: 'all-releases' });
    else if (/github\.com\/0xCodez\/DenaDesk\/?$/i.test(href)) track({ t: 'click', k: 'github' });
    else if (/beyond-media\.ai\/tips/.test(href)) track({ t: 'click', k: 'tips-page' });
    else if (link.getAttribute('href') === '#support') track({ t: 'click', k: 'support-link' });
  });
  // Which questions people open hints at what the page doesn't answer.
  $$('.faq details').forEach((d, i) => d.addEventListener('toggle', () => { if (d.open) track({ t: 'click', k: `faq-${i + 1}` }); }));
  // Whether people reach the tip card at all (counted once per page view).
  const tipsBox = $('#tips');
  if (tipsBox && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) { seen.disconnect(); track({ t: 'click', k: 'tips-seen' }); }
    }, { threshold: .4 });
    seen.observe(tipsBox);
  }
});
