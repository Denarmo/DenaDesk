// DenaDesk site: showcase behaviour (class prefix sc-). Loaded with defer after app.js; no dependencies.
// CSP-safe: no inline styles or eval; only classes and CSSOM custom properties (el.style.setProperty).
// Everything pauses offscreen (IntersectionObserver) and while the tab is hidden; reduced motion gets
// still frames: no autoplay, no tilt, no drifting light.
'use strict';

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const hasIO = 'IntersectionObserver' in window;

  // ======================================================================
  // App shot: crossfade between the real screenshots, a lift as it scrolls in,
  // a slight tilt and glass sheen under the pointer, the glow follows the view.
  // ======================================================================
  function appShot(stage) {
    const section = stage.closest('section') || stage.parentElement;
    const tablist = section.querySelector('.sc-tabs');
    const tabs = tablist ? [...tablist.querySelectorAll('.sc-tab')] : [];
    const tilt = stage.querySelector('.sc-tilt');
    const win = stage.querySelector('.sc-win');
    const imgOf = (view) => document.getElementById('sc-img-' + view);
    if (!tabs.length || !tilt || !win) return;

    const DUR = 7; // seconds per view
    tablist.style.setProperty('--sc-dur', DUR + 's');
    let current = tabs.findIndex((t) => t.classList.contains('on'));
    if (current < 0) current = 0;
    let inView = false;
    let near = false;
    let hovering = false;
    let focused = false;
    let switching = 0;

    // ----- views -----
    const ready = (img) => (img.complete && img.naturalWidth ? Promise.resolve() : (img.decode ? img.decode() : new Promise((r) => { img.onload = r; img.onerror = r; })));
    function warm() { // fetch the others once the section is close, so a switch never shows an empty frame
      for (const t of tabs) { const img = imgOf(t.dataset.view); if (img && img.loading === 'lazy') img.loading = 'eager'; }
    }
    async function show(i, focus) {
      i = (i + tabs.length) % tabs.length;
      if (i === current) { if (focus) tabs[i].focus(); return; }
      const id = ++switching;
      const prevTab = tabs[current];
      const nextTab = tabs[i];
      const prev = imgOf(prevTab.dataset.view);
      const next = imgOf(nextTab.dataset.view);
      current = i;
      for (const t of tabs) {
        const on = t === nextTab;
        t.classList.toggle('on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      }
      if (focus) nextTab.focus();
      section.dataset.view = nextTab.dataset.view;
      win.dataset.view = nextTab.dataset.view;
      restartProgress(nextTab);
      if (!next) return;
      next.loading = 'eager';
      try { await Promise.race([ready(next), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* show it anyway */ }
      if (id !== switching) return;
      for (const t of tabs) {
        const img = imgOf(t.dataset.view);
        if (!img) continue;
        const on = img === next;
        img.classList.toggle('on', on);
        img.classList.toggle('leave', img === prev && !on);
        img.setAttribute('aria-hidden', on ? 'false' : 'true');
      }
      if (prev && prev !== next) setTimeout(() => { if (id === switching) prev.classList.remove('leave'); }, 1000);
    }
    function restartProgress(tab) {
      const p = tab.querySelector('.sc-prog');
      if (!p) return;
      p.style.setProperty('animation', 'none');
      void p.offsetWidth; // restart the fill from zero
      p.style.removeProperty('animation');
    }
    for (const t of tabs) {
      const img = imgOf(t.dataset.view);
      if (img) img.setAttribute('aria-hidden', t.classList.contains('on') ? 'false' : 'true');
    }
    section.dataset.view = tabs[current].dataset.view;

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { show(i); restartProgress(tabs[i]); });
      t.addEventListener('animationend', (e) => {
        if (e.target.classList.contains('sc-prog') && t.classList.contains('on') && running()) show(current + 1);
      });
    });
    tablist.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown') show(current + 1, true);
      else if (k === 'ArrowLeft' || k === 'ArrowUp') show(current - 1, true);
      else if (k === 'Home') show(0, true);
      else if (k === 'End') show(tabs.length - 1, true);
      else return;
      e.preventDefault();
    });

    // ----- autoplay: only while seen, the tab visible, nobody reading or using it -----
    const running = () => inView && !document.hidden && !hovering && !focused && !reduce.matches;
    function sync() {
      tablist.classList.toggle('sc-run', running());
      tablist.classList.toggle('sc-manual', reduce.matches);
      stage.classList.toggle('sc-off', !inView || document.hidden);
    }
    const holdOn = () => { hovering = true; sync(); };
    const holdOff = () => { hovering = false; sync(); };
    stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') holdOn(); });
    stage.addEventListener('pointerleave', holdOff);
    tablist.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') holdOn(); });
    tablist.addEventListener('pointerleave', holdOff);
    tablist.addEventListener('focusin', () => { focused = tablist.matches(':focus-within') && document.activeElement.matches(':focus-visible'); sync(); });
    tablist.addEventListener('focusout', () => { setTimeout(() => { focused = tablist.contains(document.activeElement) && document.activeElement.matches(':focus-visible'); sync(); }); });
    document.addEventListener('visibilitychange', () => { sync(); if (!document.hidden) kick(); });

    // ----- motion: one rAF loop that runs only while something is easing -----
    let raf = 0;
    let lift = 0, liftGoal = 0;
    let rx = 0, ry = 0, rxGoal = 0, ryGoal = 0;
    const set = (k, v) => stage.style.setProperty(k, v);
    function measureLift() {
      if (reduce.matches || innerWidth < 720) { liftGoal = 0; return; }
      const r = stage.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (r.top - innerHeight * .1) / (innerHeight * .8)));
      liftGoal = k * 12;
    }
    function tick() {
      raf = 0;
      lift += (liftGoal - lift) * .16;
      rx += (rxGoal - rx) * .08;
      ry += (ryGoal - ry) * .08;
      const done = Math.abs(liftGoal - lift) < .01 && Math.abs(rxGoal - rx) < .005 && Math.abs(ryGoal - ry) < .005;
      if (done) { lift = liftGoal; rx = rxGoal; ry = ryGoal; }
      set('--sc-lift', lift.toFixed(3) + 'deg');
      set('--sc-rx', rx.toFixed(3) + 'deg');
      set('--sc-ry', ry.toFixed(3) + 'deg');
      if (!done) kick();
    }
    function kick() { if (!raf && !document.hidden && (near || inView)) raf = requestAnimationFrame(tick); }

    addEventListener('scroll', () => { if (!near) return; measureLift(); kick(); }, { passive: true });
    addEventListener('resize', () => { measureLift(); kick(); }, { passive: true });

    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduce.matches || !finePointer.matches) return;
      const r = win.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      rxGoal = (.5 - y) * 2.4;
      ryGoal = (x - .5) * 3.2;
      set('--sc-gx', (x * 100).toFixed(1) + '%');
      set('--sc-gy', (y * 100).toFixed(1) + '%');
      stage.classList.add('sc-hover');
      kick();
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { rxGoal = 0; ryGoal = 0; stage.classList.remove('sc-hover'); kick(); });

    reduce.addEventListener && reduce.addEventListener('change', () => { measureLift(); sync(); kick(); });

    // ----- in view / near / active window -----
    if (hasIO) {
      new IntersectionObserver((es) => { for (const e of es) { near = e.isIntersecting; if (near) { warm(); measureLift(); kick(); } } }, { rootMargin: '600px 0px' }).observe(stage);
      new IntersectionObserver((es) => { for (const e of es) { inView = e.isIntersecting; sync(); } }, { threshold: .25 }).observe(stage);
      new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) stage.classList.add('sc-act'); }, { threshold: .55 }).observe(win);
    } else {
      near = inView = true;
      warm();
      stage.classList.add('sc-act');
    }
    measureLift();
    lift = liftGoal;
    tick();
    sync();
  }

  function init() {
    document.querySelectorAll('[data-sc-shot]').forEach(appShot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
