// DenaDesk — GPL-3.0. Atomic metadata registry. Never stores OAuth tokens or private keys.
'use strict';
const fs = require('fs/promises');
const path = require('path');
const P = require('../shared/remote-protocol');
class Registry {
  constructor(file = null) { this.file = file; this.rows = new Map(); this.queue = Promise.resolve(); }
  async load() {
    if (!this.file) return;
    let data;
    try { data = await fs.readFile(this.file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    if (data.length > 2000000) throw new Error('Registry is too large');
    const rows = JSON.parse(data);
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Invalid registry');
    for (const row of rows) {
      if (!/^[0-9]{6,100}$/.test(row.sub) || P.deviceId(row.publicKey) !== row.id || typeof row.name !== 'string' || row.name.length > 80) throw new Error('Invalid registry');
      this.rows.set(row.sub + ':' + row.id, row);
    }
  }
  list(sub) { return [...this.rows.values()].filter((r) => r.sub === sub).map(({ sub: _, ...row }) => row); }
  get(sub, id) { return this.rows.get(sub + ':' + id); }
  async put(sub, device) {
    if (!this.get(sub, device.id) && this.list(sub).length >= 20) throw new Error('Device limit reached');
    if (!this.get(sub, device.id) && this.rows.size >= 1000) throw new Error('Registry limit reached');
    this.rows.set(sub + ':' + device.id, { ...device, sub }); await this.save();
  }
  async remove(sub, id) { this.rows.delete(sub + ':' + id); await this.save(); }
  save() {
    if (!this.file) return Promise.resolve();
    const bytes = JSON.stringify([...this.rows.values()]);
    this.queue = this.queue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file + '.tmp', bytes, { mode: 0o600 });
      await fs.rename(this.file + '.tmp', this.file);
    });
    return this.queue;
  }
}
module.exports = { Registry };
