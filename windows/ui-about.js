// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// About tab (same cards on all three apps): the app icon and version, update checks, the
// maker, this computer, the app's build and the licence with the original author's notice (GPLv3 §5d). Facts
// come from shared/about.js.
'use strict';

UI.tab({
  id: 'about',
  order: 110,
  title: 'About',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: '',
  bottom: true,
  badge: (s) => (s.updates && s.updates.available ? '1' : ''),
  build(body) {
    const { el, api } = UI;
    const link = (label, key) => UI.button(label, () => api.openLink(key), 'small');
    // A card of label → value rows; set({label: text}) fills them and hides the empty ones.
    const facts = (title, labels) => {
      const vals = {};
      const rows = labels.map((label) => {
        vals[label] = el('span', { class: 'value selectable' });
        return UI.row(label, '', [vals[label]]);
      });
      const card = UI.card(title, rows, { cls: 'keep-on' });
      card.set = (map) => labels.forEach((label, i) => {
        const t = map[label];
        vals[label].textContent = t == null ? '' : String(t);
        rows[i].hidden = t == null || t === '';
      });
      return card;
    };
    const nameEl = el('div', { class: 'about-name', text: 'DenaDesk' });
    const verEl = el('div', { class: 'about-ver' });
    const hero = el('div', { class: 'card about-hero keep-on' }, [
      el('div', { class: 'about-icon', attrs: { role: 'img', 'aria-label': 'DenaDesk icon' } }),
      nameEl,
      verEl,
      el('div', { class: 'about-tag', text: 'Use two computers as one desk' }),
    ]);

    // Updates: new releases of DenaDesk on GitHub.
    const updStatus = el('span', { class: 'value' });
    const updCheck = UI.button('Check now', () => api.checkUpdates(), 'small');
    const updNotes = UI.button('What’s New', () => window.UpdaterModal && window.UpdaterModal.show(), 'small');
    const updUnskip = UI.button('Don’t skip', () => api.unskipUpdate && api.unskipUpdate(), 'small');
    const updGet = UI.button('Download', () => api.openUpdate(), 'small primary');
    const updRow = UI.row('DenaDesk', '', [updStatus, updNotes, updUnskip, updGet, updCheck]);
    const updAuto = UI.switch((v) => api.setUpdates({ auto: v }), { label: 'Check for updates automatically' });

    const pc = facts('This computer', ['Computer name', 'System', 'Kernel', 'Processor', 'Memory', 'Architecture']);
    const build = facts('This app', ['Version', 'Built for', 'Electron', 'Chromium', 'Node.js']);
    const thanksRow = UI.row('Thanks', '');

    body.append(
      hero,
      UI.card('Updates', [
        updRow,
        UI.row('Check automatically', 'Looks for new releases on GitHub every few hours', [updAuto]),
      ], { cls: 'keep-on' }),
      UI.card('Made by', [
        UI.row('0xCodez', 'github.com/0xCodez', [link('Profile', 'author')]),
        UI.row('Website', 'getduodesk.vercel.app', [link('Open', 'website')]),
        UI.row('Source code', 'github.com/0xCodez/DuoDesk', [link('GitHub', 'github')]),
        UI.row('All releases', 'Downloads for macOS, Windows, Linux and Android', [link('Releases', 'releases')]),
        UI.row('Report a problem', 'Open an issue on GitHub', [link('Issues', 'issues')]),
        UI.row('Log files', 'What DenaDesk did and any crash, to attach to a bug report', [link('Open log folder', 'logs')]),
      ], { cls: 'keep-on' }),
      pc,
      build,
      UI.card('Licence', [
        UI.row('GNU General Public License v3', 'Free and open source. © 2026 0xCodez. Includes code © 2026 Inuka Asith.', [link('Read', 'licence')]),
        UI.row('Original source', 'The GPL-3.0 code DenaDesk is built on, by Inuka Asith', [link('Open', 'upstream')]),
        thanksRow,
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      const a = s.about || { app: {}, pc: {} };
      nameEl.textContent = a.app.name || 'DenaDesk';
      verEl.textContent = 'Version ' + (a.app.version || s.version || '');
      thanksRow.setHint(a.app.thanks || '');
      thanksRow.hidden = !a.app.thanks;
      pc.set({
        'Computer name': a.pc.host,
        System: a.pc.os,
        Kernel: a.pc.kernel,
        Processor: a.pc.cpu ? a.pc.cpu + (a.pc.cores ? ' · ' + a.pc.cores + ' cores' : '') : '',
        Memory: a.pc.memory,
        Architecture: a.pc.arch,
      });
      build.set({ Version: a.app.version, 'Built for': a.app.arch, Electron: a.app.electron, Chromium: a.app.chrome, 'Node.js': a.app.node });
      const u = s.updates;
      if (u) {
        updAuto.set(u.auto);
        updCheck.disabled = u.checking;
        updGet.hidden = !u.available;
        updNotes.hidden = !u.available;
        updUnskip.hidden = !u.available || !u.skipped;
        updStatus.textContent = u.checking ? 'Checking…'
          : u.available
            ? (u.skipped ? u.latest + ' is available (skipped)' : u.latest + ' is available')
            : u.checkedAt ? 'Up to date' : '';
        updRow.setHint(u.error ? 'Couldn’t check: ' + u.error
          : u.available ? 'You have ' + u.current + '. ' + (u.download ? 'Download ' + u.download.name : 'Opens the release page')
            : u.noReleases ? 'Version ' + u.current + '. No releases published yet'
              : 'Version ' + u.current + (u.checkedAt ? ' · checked ' + new Date(u.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''));
      }
    };
  },
});
