// DenaDesk — GPL-3.0. On-demand sampling; no timer runs in the tray.
'use strict';
const os = require('os');
function create({ app, helper, nativePids = () => [], now = Date.now, cores = os.availableParallelism() }) {
  let cache, pending, sampled = 0, previous = new Map();
  async function sample() {
    const at = now(), metrics = app.getAppMetrics(), rows = [];
    let memory = 0, cpuSeconds = 0, haveBaseline = false;
    const add = (pid, seconds, bytes) => {
      const old = previous.get(pid);
      if (old && seconds >= old.cpu) { cpuSeconds += seconds - old.cpu; haveBaseline = true; }
      memory += Math.max(0, bytes || 0);
      rows.push([pid, { cpu: seconds }]);
    };
    for (const m of metrics) add(m.pid, m.cpu.cumulativeCPUUsage || 0, (m.memory && m.memory.workingSetSize || 0) * 1024);
    const electronIds = new Set(metrics.map((m) => m.pid));
    const ids = [...new Set(nativePids().filter((p) => Number.isInteger(p) && p > 0 && !electronIds.has(p)))].slice(0, 32);
    let native = false;
    const h = helper();
    if (h && h.running && ids.length) {
      try {
        const r = await h.request('resources', { pids: ids.map(String) }, 1500);
        for (const p of r.processes || []) if (ids.includes(p.pid)) { add(p.pid, p.cpuSeconds || 0, p.workingSet); native = true; }
      } catch { } // still report Electron if an optional helper is unavailable
    }
    const elapsed = at - sampled;
    cache = { at, cpu: haveBaseline && elapsed > 0 && elapsed <= 10000 ? Math.min(100, Math.max(0, cpuSeconds * 100000 / elapsed / cores)) : null,
      memoryBytes: memory, processes: rows.length, nativeIncluded: native,
      scope: 'Electron and known active native helpers; shared ADB server and Android processes excluded. Working sets may include shared memory.' };
    previous = new Map(rows); sampled = at;
    return cache;
  }
  return () => {
    if (cache && now() - sampled < 2500) return Promise.resolve(cache);
    if (!pending) pending = sample().finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { create };
