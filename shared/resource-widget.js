// DenaDesk — GPL-3.0. Poll only while the dashboard is visible.
(function () {
  'use strict';
  window.ResourceWidget = {
    mount(parent, api) {
      if (typeof api.getResourceUsage !== 'function') return;
      const box = document.createElement('section');
      box.className = 'au-resources';
      box.setAttribute('aria-label', 'DenaDesk resource usage');
      const title = document.createElement('b'); title.textContent = 'DenaDesk resources';
      const values = document.createElement('span'); values.textContent = 'Measuring…';
      const detail = document.createElement('small'); detail.textContent = 'Updates every 3 seconds while this dashboard is visible';
      box.append(title, values, detail); parent.append(box);
      let timer = null, pending = false, intersecting = false;
      const visible = () => intersecting && !document.hidden && box.isConnected && !box.closest('.page[hidden], .page:not(.active)[style*="display: none"]') && box.getClientRects().length > 0;
      async function tick() {
        clearTimeout(timer); timer = null;
        if (pending || !visible()) return;
        pending = true;
        try {
          const r = await api.getResourceUsage();
          values.textContent = (r.cpu == null ? 'CPU measuring' : r.cpu.toFixed(1) + '% CPU') + ' · ' + (r.memoryBytes / 1048576).toFixed(0) + ' MB RAM · ' + r.processes + ' processes';
          box.title = r.scope;
          detail.textContent = r.nativeIncluded ? 'Includes active native helpers · CPU is a share of this PC’s total capacity' : 'Electron processes · native helper measurements unavailable';
        } catch { values.textContent = 'Resource measurements unavailable'; }
        pending = false;
        if (visible()) timer = setTimeout(tick, 3000);
      }
      document.addEventListener('visibilitychange', () => { clearTimeout(timer); timer = null; if (!document.hidden) tick(); });
      new IntersectionObserver((entries) => {
        intersecting = entries.some((e) => e.isIntersecting);
        if (intersecting) tick();
        else { clearTimeout(timer); timer = null; }
      }).observe(box);
    },
  };
})();
