// DenaDesk — GPL-3.0. Connected-phone shortcuts, independent of the mesh selection.
(function (root) {
  'use strict';
  function mount({ document: doc, parent, api }) {
    const el = (tag, text, cls) => {
      const e = doc.createElement(tag);
      if (text) e.textContent = text;
      if (cls) e.className = cls;
      return e;
    };
    const dock = el('section', '', 'au-phone-dock');
    dock.setAttribute('aria-label', 'Connected phone shortcuts');
    const head = el('div', '', 'au-phone-head');
    const label = el('b', 'Your phone');
    const pick = el('select');
    pick.setAttribute('aria-label', 'Phone for shortcuts');
    const route = el('small');
    head.append(label, pick, route);
    const actions = el('div', '', 'au-phone-actions');
    const note = el('div', 'Connect a phone to use its shortcuts.', 'au-phone-note');
    note.setAttribute('role', 'status');
    dock.append(head, actions, note);
    parent.append(dock);
    let phones = [], selected = '', busy = false, key = '';
    const buttons = [];
    const defs = [
      ['screen', 'View screen'], ['lock', 'Screen off'], ['wifi', 'Wi-Fi'],
      ['bluetooth', 'Bluetooth'], ['notifications', 'Notifications'], ['dnd', 'Do not disturb'], ['ring', 'Find phone'],
    ];
    for (const [action, name] of defs) {
      const b = el('button', name);
      b.type = 'button';
      b.dataset.action = action;
      b.onclick = async () => {
        const p = phones.find((x) => x.id === selected);
        if (!p || busy || typeof api.phoneAction !== 'function') return;
        const qs = p.ctl && p.ctl.qs;
        const toggle = ['wifi', 'bluetooth', 'dnd'].includes(action);
        const on = toggle ? !qs[action] : undefined;
        // Turning off the only network path needs a deliberate second click.
        if (action === 'wifi' && !on && !p.usb && !(qs.panel && qs.panel.wifi)) {
          if (b.dataset.confirm !== p.id) {
            b.dataset.confirm = p.id;
            note.textContent = 'Wi-Fi off may disconnect this phone. Click Wi-Fi again to continue, or choose another shortcut.';
            return;
          }
        }
        for (const x of buttons) delete x.dataset.confirm;
        busy = true;
        paint();
        note.textContent = 'Sending to ' + p.name + '…';
        try {
          const r = await api.phoneAction({ id: p.id, action, ...(toggle ? { on } : {}) });
          note.textContent = r && r.ok ? (qs && qs.panel && qs.panel[action] ? 'Complete this setting on your phone.' : 'Sent to ' + p.name + '.') : (r && r.error) || 'Phone action unavailable.';
        } catch (e) { note.textContent = e.message || 'Phone action failed.'; }
        busy = false;
        paint();
      };
      actions.append(b);
      buttons.push(b);
    }
    function paint() {
      const p = phones.find((x) => x.id === selected);
      const qs = p && p.ctl && p.ctl.qs;
      label.textContent = p ? p.name : 'Your phone';
      pick.hidden = phones.length < 2;
      route.textContent = p ? (p.usb ? 'USB connected' : 'Wireless connected') : 'Not connected';
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i], [action, name] = defs[i];
        const toggle = ['wifi', 'bluetooth', 'dnd'].includes(action);
        const value = qs && qs[action];
        b.disabled = busy || !p || typeof api.phoneAction !== 'function' || (toggle && typeof value !== 'boolean');
        b.textContent = toggle && typeof value === 'boolean' ? name + (value ? ' · On' : ' · Off') : name;
        b.title = toggle && qs && qs.panel && qs.panel[action] ? 'Open ' + name + ' settings on the phone' : name;
        if (toggle) b.setAttribute('aria-pressed', String(value === true));
      }
    }
    pick.onchange = () => { selected = pick.value; note.textContent = ''; paint(); };
    return {
      update(s) {
        phones = (s.phone && Array.isArray(s.phone.quick) ? s.phone.quick : []).filter((p) => p && typeof p.id === 'string');
        if (!phones.some((p) => p.id === selected)) {
          selected = phones[0] ? phones[0].id : '';
          note.textContent = selected ? 'Quick controls for your connected phone.' : 'Connect a phone to use its shortcuts.';
        }
        const k = JSON.stringify(phones.map((p) => [p.id, p.name]));
        if (k !== key) {
          key = k;
          pick.replaceChildren(...phones.map((p) => { const o = el('option', p.name); o.value = p.id; return o; }));
        }
        pick.value = selected;
        paint();
      },
    };
  }
  if (typeof module === 'object' && module.exports) module.exports = { mount };
  else root.PhoneDock = { mount };
})(typeof window === 'object' ? window : globalThis);
