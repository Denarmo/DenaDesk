// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The phone window: decodes the phone's H.264 (WebCodecs, Annex B with SPS/PPS in band) onto a
// canvas, plays its sound (raw 48 kHz stereo PCM through pcm-worklet.js), and turns this PC's
// mouse, touchpad and keyboard into the phone's touches, scrolls and keys (port of
// mac/phoneview-renderer.js):
//   touch by default: click / drag = a finger · right click = Back · middle click = Home
//   optional mouse mode: hover, clicks and wheel as an Android mouse
//   wheel / two-finger scroll = scroll · pinch = two fingers pinching · keys = keys
'use strict';

(() => {
  const api = window.phoneview;
  const q = new URLSearchParams(location.search);
  const kind = q.get('kind') || 'screen';
  // A camera's window opens hidden: its picture goes to the Camera tab, and to the virtual camera
  // while that's on (shared/vcam-feed.js); Camera › Rotate turns it here too.
  const vcam = kind === 'camera' && window.CamOut ? window.CamOut() : null;
  let turn = 0;
  document.body.classList.add(kind);
  document.getElementById('title').textContent = q.get('title') || 'Phone';
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const status = document.getElementById('status');
  let size = null; // video size
  let decoder = null;
  let config = null; // SPS/PPS, sent in front of the next key frame
  let waitingKey = true;
  let hasFrame = false, shotPending = false, shotTimer;
  let screenshotButton = null;
  // Skip to the next keyframe, and ask the phone for one now (it sends one only every ~10 s):
  // the frames in between build on each other, so drawing them on a gap smears the picture.
  let askedKey = 0;
  function needKey() {
    waitingKey = true;
    const now = performance.now();
    if (now - askedKey < 1000) return;
    askedKey = now;
    api.send({ t: 'resetVideo' });
  }

  const setStatus = (t) => {
    status.textContent = t || '';
    status.hidden = !t;
  };

  // ---- video ----

  function codecOf(sps) {
    // Annex B: find the SPS NAL (type 7); profile, constraints and level are the next three bytes.
    for (let i = 0; i + 4 < sps.length; i++) {
      if (sps[i] === 0 && sps[i + 1] === 0 && sps[i + 2] === 1 && (sps[i + 3] & 0x1f) === 7) {
        const h = (b) => b.toString(16).padStart(2, '0');
        return `avc1.${h(sps[i + 4])}${h(sps[i + 5])}${h(sps[i + 6])}`;
      }
    }
    return 'avc1.42e01f';
  }

  function makeDecoder(codec) {
    if (decoder && decoder.state !== 'closed') try { decoder.close(); } catch {}
    decoder = new VideoDecoder({
      output: (frame) => {
        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          fit();
        }
        ctx.drawImage(frame, 0, 0);
        hasFrame = true;
        if (screenshotButton && !shotPending) screenshotButton.disabled = false;
        if (vcam) vcam.push(frame, frame.displayWidth, frame.displayHeight);
        frame.close();
        if (!status.hidden) setStatus('');
      },
      error: (e) => {
        console.warn('decoder', e.message);
        needKey();
      },
    });
    decoder.configure({ codec, optimizeForLatency: true, hardwareAcceleration: 'prefer-hardware' });
  }

  api.on('video', (p) => {
    const data = p.data instanceof Uint8Array ? p.data : new Uint8Array(p.data);
    if (p.config) {
      config = data;
      makeDecoder(codecOf(data));
      waitingKey = true;
      return;
    }
    if (!decoder || decoder.state !== 'configured') return;
    if (waitingKey && !p.key) return needKey();
    // Behind (a slow decoder): drop up to a fresh keyframe rather than one frame, which smears.
    if (decoder.decodeQueueSize > 4 && !p.key) return needKey();
    let chunk = data;
    if (p.key && config) {
      chunk = new Uint8Array(config.length + data.length);
      chunk.set(config, 0);
      chunk.set(data, config.length);
    }
    waitingKey = false;
    decoder.decode(new EncodedVideoChunk({ type: p.key ? 'key' : 'delta', timestamp: p.pts, data: chunk }));
  });

  api.on('size', (s) => {
    if (size && (size.width !== s.width || size.height !== s.height)) pointer.release();
    size = s;
    fit();
  });

  api.on('status', (s) => {
    if (s.via) {
      const el = document.getElementById('via');
      el.textContent = s.via === 'usb' ? 'USB' : 'Wi-Fi';
      el.className = s.via;
      el.title = s.via === 'usb' ? 'Through the USB cable' : 'Through wireless debugging';
      el.hidden = false;
    }
    if (s.error) setStatus(s.error);
    else if (s.closed) setStatus(`The phone stopped sharing (${s.closed}).`);
    else if (s.ready && !size) setStatus('Waiting for the picture…');
  });

  // An app's virtual display has at least 2 pixels per point, like the Mac's: at 100% scaling a
  // 1-pixel display looks blurry. Same rule as phoneview.js's openApp.
  // A virtual display keeps the density it was created with, even across Windows DPI changes.
  const appScale = Math.max(2, Math.min(8, Number(q.get('displayScale')) || 2));
  let requestedSize = '';

  // Letterbox: the canvas keeps the phone's aspect inside the window.
  function fit() {
    const stage = document.getElementById('stage');
    const w = canvas.width || (size && size.width) || 9;
    const h = canvas.height || (size && size.height) || 19;
    const side = turn % 180 !== 0; // turned sideways: fitted by its turned size
    const k = Math.min(stage.clientWidth / (side ? h : w), stage.clientHeight / (side ? w : h));
    canvas.style.width = `${Math.floor(w * k)}px`;
    canvas.style.height = `${Math.floor(h * k)}px`;
    canvas.style.transform = turn ? `rotate(${turn}deg)` : '';
  }
  if (vcam) vcam.onRotate((deg) => { turn = deg; fit(); });
  new ResizeObserver(() => {
    fit();
    // An app window: its virtual display follows the window (device pixels).
    if (kind === 'app') {
      clearTimeout(fit.timer);
      const stage = document.getElementById('stage');
      fit.timer = setTimeout(() => {
        const w = Math.round(stage.clientWidth * appScale), h = Math.round(stage.clientHeight * appScale);
        const key = `${w}x${h}`;
        if (w < 51 || h < 51 || key === requestedSize) return;
        pointer.release(); // finish touches before changing Android's coordinate system
        requestedSize = key;
        api.send({ t: 'resize', w, h });
      }, 250);
    }
  }).observe(document.getElementById('stage'));

  // ---- sound ----

  let player = null;
  let actx = null;
  async function startAudio() {
    actx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    await actx.audioWorklet.addModule('pcm-worklet.js');
    player = new AudioWorkletNode(actx, 'pcm-player', { outputChannelCount: [2] });
    player.connect(actx.destination);
    if (actx.state === 'suspended') await actx.resume(); // never left waiting for a click
  }
  api.on('audio', (d) => {
    if (!player) {
      if (!startAudio.started) startAudio.started = startAudio().catch((e) => console.warn('audio', e.message));
      return;
    }
    const u8 = d instanceof Uint8Array ? d : new Uint8Array(d);
    const s16 = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1);
    const f = new Float32Array(s16.length);
    for (let i = 0; i < s16.length; i++) f[i] = s16[i] / 32768;
    player.port.postMessage(f, [f.buffer]);
  });

  // The phone's own capture (no wireless debugging): Opus packets through the session, 20 ms each
  // (or raw 48 kHz stereo s16le from a phone without an Opus encoder).
  let opusDec = null;
  let ts = 0;
  const play = (f) => player && player.port.postMessage(f, [f.buffer]);
  const fromOpus = (a) => {
    const n = a.numberOfFrames;
    const f = new Float32Array(n * 2);
    const ch = [];
    for (let c = 0; c < Math.min(2, a.numberOfChannels); c++) {
      const p = new Float32Array(n);
      a.copyTo(p, { planeIndex: c, format: 'f32-planar' });
      ch.push(p);
    }
    a.close();
    const [l, r = l] = ch;
    for (let i = 0; i < n; i++) { f[i * 2] = l[i]; f[i * 2 + 1] = r[i]; }
    play(f);
  };
  api.on('netaudio', (m) => {
    if (!player) {
      if (!startAudio.started) startAudio.started = startAudio().catch((e) => console.warn('audio', e.message));
      return;
    }
    for (const b64 of m.p) {
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      if (m.codec === 'pcm') {
        const s16 = new Int16Array(u8.buffer, 0, u8.byteLength >> 1);
        const f = new Float32Array(s16.length);
        for (let i = 0; i < s16.length; i++) f[i] = s16[i] / 32768;
        play(f);
        continue;
      }
      if (!opusDec || opusDec.state === 'closed') {
        opusDec = new AudioDecoder({ output: fromOpus, error: (e) => console.warn('opus', e.message) });
        opusDec.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2 });
        ts = 0;
      }
      opusDec.decode(new EncodedAudioChunk({ type: 'key', timestamp: ts, data: u8 }));
      ts += 20000;
    }
  });

  // ---- input ----

  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    const w = canvas.width;
    const h = canvas.height;
    return { x: Math.max(0, Math.min(w - 1, ((e.clientX - r.left) / r.width) * w)), y: Math.max(0, Math.min(h - 1, ((e.clientY - r.top) / r.height) * h)) };
  };

  const pointer = new PhonePointer((m) => api.send(m));
  const inputReady = () => size && canvas.width === size.width && canvas.height === size.height;
  canvas.addEventListener('pointerdown', (e) => {
    if (!inputReady()) return;
    e.preventDefault(); canvas.focus(); canvas.setPointerCapture(e.pointerId);
    pointer.down(e, at(e));
  });
  canvas.addEventListener('pointermove', (e) => { if (inputReady()) pointer.move(e, at(e)); });
  const lift = (e, cancelled) => {
    pointer.up(e, at(e), cancelled);
    try { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch {}
  };
  canvas.addEventListener('pointerup', (e) => lift(e, false));
  canvas.addEventListener('pointercancel', (e) => lift(e, true));
  canvas.addEventListener('lostpointercapture', (e) => pointer.up(e, at(e), true));
  canvas.addEventListener('pointerleave', (e) => pointer.leave(at(e)));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!inputReady()) return;
    pointer.wheel(e, at(e), size, canvas.getBoundingClientRect());
  }, { passive: false });

  // Keys go to the phone; Alt+F4 closes the window like any other. Enter in a chat app and the
  // arrows that swipe are worked out in phoneview.js (shared/phonechat.js).
  const onKey = (e) => {
    if (e.target && e.target.closest && e.target.closest('button, select, input')) return;
    if (e.code === 'F11') return;
    if (e.altKey && e.code === 'F4') return;
    e.preventDefault();
    api.send({ t: 'key', code: e.code, down: e.type === 'keydown', repeat: e.repeat });
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => {
    pointer.release();
    for (const code of ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']) api.send({ t: 'key', code, down: false });
  });

  // Files dragged onto the window go to the phone.
  document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drop'); });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('drop'); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('drop');
    // As an array: a FileList reaches the preload as a plain object, which can't be iterated.
    if (e.dataTransfer && e.dataTransfer.files.length) api.drop([...e.dataTransfer.files]);
  });

  // ---- controls ----
  // Quick controls below the picture, with Back/Home/Recents always centered beneath them.
  // An app window runs on a display
  // of its own, so what acts on the phone's main screen (Recents, the shade, Power) isn't there,
  // and its Rotate turns the window round. A camera window has the camera's own.
  const ICONS = {
    full: '<path d="M4 8V4h4 M12 4h4v4 M16 12v4h-4 M8 16H4v-4"/>',
    mouseMode: '<path d="M5 3l10 8-5 .5-2.5 5z"/>',
    back: '<path d="M12.5 4.5 7 10l5.5 5.5"/>',
    home: '<circle cx="10" cy="10" r="5.5"/>',
    recents: '<rect x="5" y="5" width="10" height="10" rx="1.5"/>',
    notifications: '<path d="M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5h-12z M8.5 16.5a1.5 1.5 0 0 0 3 0"/>',
    settings: '<path d="M4 6h12 M4 10h12 M4 14h12"/><circle cx="7.5" cy="6" r="1.6"/><circle cx="12.5" cy="10" r="1.6"/><circle cx="8.5" cy="14" r="1.6"/>',
    rotate: '<path d="M4.5 10a5.5 5.5 0 1 0 1.6-3.9 M4.5 3.5v3h3"/>',
    volumeUp: '<path d="M3.5 8h2.5l3.5-3v10l-3.5-3H3.5z M14 7.5v5 M11.5 10h5"/>',
    volumeDown: '<path d="M3.5 8h2.5l3.5-3v10l-3.5-3H3.5z M11.5 10h5"/>',
    mute: '<path d="M3.5 8h2.5l3.5-3v10l-3.5-3H3.5z M12 8l4 4 M16 8l-4 4"/>',
    power: '<path d="M10 3.5v6 M6.2 6a5.5 5.5 0 1 0 7.6 0"/>',
    screenOff: '<rect x="6" y="3" width="8" height="14" rx="1.5"/><path d="M3.5 3.5l13 13"/>',
    enterSends: '<path d="M3.5 10l13-5.5-4 11-2.5-4.5z M10 11l6.5-6.5"/>',
    arrowSwipe: '<path d="M10 3.5v13 M7.5 6 10 3.5 12.5 6 M7.5 14l2.5 2.5 2.5-2.5"/>',
    shot: '<path d="M3.5 6.5h3l1.5-2h4l1.5 2h3v9h-13z"/><circle cx="10" cy="11" r="2.8"/>',
    pin: '<path d="M8 3.5h4l-.5 5 2.5 2.5h-8l2.5-2.5z M10 11v5.5"/>',
    torch: '<path d="M7 3.5h6v3.5l-2 3v6.5H9v-6.5l-2-3z M7 7h6"/>',
    flip: '<path d="M3.5 7h11 M12 4.5 14.5 7 12 9.5 M16.5 13h-11 M8 10.5 5.5 13 8 15.5"/>',
    zoomIn: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l3.5 3.5 M9 6.5v5 M6.5 9h5"/>',
    zoomOut: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l3.5 3.5 M6.5 9h5"/>',
  };
  // in: the windows it shows in (default the screen and app windows); nav: Back, Home and Recents
  // (the side panel's foot, or the bottom bar); toggle: lit while on (phoneview.js says, 'opts').
  const PHONE = ['screen', 'app'];
  const CAMERA = ['torch', 'flip', 'zoomIn', 'zoomOut'];
  const CONTROLS = [
    { k: 'full', title: 'Fullscreen (F11)', in: ['screen', 'app', 'camera'], toggle: true },
    { k: 'mouseMode', title: 'Mouse mode (off: touch input)', toggle: true },
    { k: 'volumeUp', title: 'Volume up' },
    { k: 'volumeDown', title: 'Volume down' },
    { k: 'mute', title: 'Mute' },
    { k: 'rotate', title: kind === 'app' ? 'Rotate the window' : 'Rotate' },
    { k: 'torch', title: 'Light', in: ['camera'], toggle: true },
    { k: 'flip', title: 'Front or back camera', in: ['camera'] },
    { k: 'zoomIn', title: 'Zoom in', in: ['camera'] },
    { k: 'zoomOut', title: 'Zoom out', in: ['camera'] },
    { k: 'shot', title: 'Copy phone screenshot (paste with Ctrl+V)', in: ['screen', 'app', 'camera'] },
    { k: 'notifications', title: 'Notifications', in: ['screen'] },
    { k: 'settings', title: 'Quick settings', in: ['screen'] },
    { k: 'power', title: 'Power (lock or wake the phone)', in: ['screen'] },
    { k: 'screenOff', title: 'Phone screen off (it keeps showing here, and saves the battery)', in: ['screen'], toggle: true },
    { k: 'enterSends', title: 'Enter sends in WhatsApp, Instagram and Telegram (Shift+Enter: a new line)', toggle: true },
    { k: 'arrowSwipe', title: 'Arrow keys swipe the screen (feeds, Reels, Shorts)', toggle: true },
    { k: 'pin', title: 'Keep on top', in: ['screen', 'app', 'camera'], toggle: true },
    { k: 'back', title: 'Back (right click, Esc)', nav: true },
    { k: 'home', title: 'Home (middle click)', nav: true },
    { k: 'recents', title: 'Recent apps', nav: true, in: ['screen'] },
  ].filter((c) => (c.in || PHONE).includes(kind));
  // State returned by the main process updates each toggle; mouse mode stays local to this view.
  const OPT = { pin: 'pinned', screenOff: 'screenOff', enterSends: 'enterSends', arrowSwipe: 'arrowSwipe', torch: 'torch', full: 'full' };
  for (const c of CONTROLS) {
    c.el = document.createElement('button');
    c.el.className = 'ctl';
    c.el.title = c.title;
    c.el.setAttribute('aria-label', c.title);
    if (c.toggle) c.el.setAttribute('aria-pressed', 'false');
    if (c.k === 'shot') { screenshotButton = c.el; c.el.disabled = !hasFrame; }
    c.el.innerHTML = `<svg viewBox="0 0 20 20">${ICONS[c.k]}</svg>`;
    c.el.onclick = () => {
      if (c.k === 'shot') return shot();
      if (c.k === 'mouseMode') {
        pointer.setMouseMode(!pointer.mouseMode);
        document.body.classList.toggle('mouse-mode', pointer.mouseMode);
        c.el.classList.toggle('on', pointer.mouseMode);
        c.el.setAttribute('aria-pressed', String(pointer.mouseMode));
        canvas.focus(); return;
      }
      if (c.k === 'full') { api.send({ t: 'full' }); canvas.focus(); return; }
      if (c.k === 'pin') return api.send({ t: 'pin' });
      if (c.k === 'enterSends' || c.k === 'arrowSwipe') api.send({ t: 'toggle', what: c.k });
      else if (c.k === 'screenOff') api.send({ t: 'nav', key: 'screenPower' });
      else if (CAMERA.includes(c.k)) api.send({ t: 'camera', what: c.k });
      else api.send({ t: 'nav', key: c.k });
      canvas.focus();
    };
  }
  const els = (list) => list.map((c) => c.el);
  // The panel button: every phone window's controls on or off (phoneview.js keeps it).
  const panelBtn = document.getElementById('panelBtn');
  window.addEventListener('keydown', (e) => { if (e.key === 'F11') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) api.send({ t: 'full' }); } }, true);
  panelBtn.onclick = () => { api.send({ t: 'panel' }); canvas.focus(); };
  function layout(mode) {
    mode = mode === 'none' ? 'none' : 'bottom';
    panelBtn.classList.toggle('on', mode !== 'none');
    panelBtn.setAttribute('aria-pressed', String(mode !== 'none'));
    document.body.dataset.controls = mode;
    const panel = document.getElementById('panel');
    const navbar = document.getElementById('navbar');
    panel.replaceChildren(...els(CONTROLS.filter((c) => !c.nav)));
    navbar.replaceChildren(...els(CONTROLS.filter((c) => c.nav)));
    fit();
  }
  layout(q.get('controls'));
  let noticeTimer;
  const notice = document.getElementById('notice');
  api.on('opts', (m) => {
    if (!m) return;
    if (m.controls) layout(m.controls);
    if (typeof m.full === 'boolean') {
      const entered = m.full && !document.body.classList.contains('full');
      document.body.classList.toggle('full', m.full); fit();
      if (entered || !m.full) {
        clearTimeout(noticeTimer);
        notice.hidden = !m.full;
        notice.textContent = m.full ? 'Press F11 to exit fullscreen' : '';
        if (m.full) noticeTimer = setTimeout(() => { notice.hidden = true; }, 3500);
      }
    }
    for (const c of CONTROLS) if (c.toggle && typeof m[OPT[c.k]] === 'boolean') {
      c.el.classList.toggle('on', m[OPT[c.k]]);
      c.el.setAttribute('aria-pressed', String(m[OPT[c.k]]));
    }
  });

  // The picture as it is now, as a PNG (phoneview.js puts it on the clipboard).
  function shot() {
    if (!hasFrame || shotPending) return;
    shotPending = true; screenshotButton.disabled = true;
    const failed = () => shotResult({ ok: false, error: 'The phone frame could not be copied. Wait for the picture and try again.' });
    clearTimeout(shotTimer);
    shotTimer = setTimeout(failed, 15000);
    try {
      canvas.toBlob((blob) => {
        if (!blob) return failed();
        blob.arrayBuffer().then((b) => api.send({ t: 'shot', png: new Uint8Array(b) })).catch(failed);
      }, 'image/png');
    } catch { failed(); }
  }
  function shotResult(result) {
    clearTimeout(shotTimer); shotPending = false;
    if (screenshotButton) screenshotButton.disabled = !hasFrame;
    if (!result?.ok) setStatus(result?.error || 'The phone screenshot could not be copied. Try again.');
  }
  api.on('shotResult', shotResult);

  canvas.focus();
})();
