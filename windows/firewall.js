// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Portions adapted from Beamer (https://github.com/kalkman-code/beamer), Copyright (C) Kalkman Code,
// GPL-3.0. Changed: JS port of win_app/firewall_win.py (status script + interpret), simplified to
// one program rule and no ports.
// Firewall self-check: require a trusted network and an app allow rule.
// Repair never changes network classifications or overrides administrator blocks.
const { script, scriptElevated } = require('./ps');

// scripts/firewall-status.ps1: the rules for this exe, the networks, whether this account is an admin.

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const profilesOf = (s) => (/^any$/i.test(s) ? null : String(s || '').split(/,\s*/));
const category = (s) => s === 'DomainAuthenticated' ? 'Domain' : s;
const touches = (set, wanted) => set === null || wanted.some((w) => set.includes(w));

// Same reading as Beamer's interpret(): a block rule on a connected profile wins over allows.
function interpret(payload) {
  const rules = arr(payload.rules).filter((r) => /true/i.test(r.enabled) && /^(any|udp)$/i.test(r.protocol || 'Any'));
  const nets = arr(payload.networks);
  // The LAN is the internet-connected interface(s); else every connected one.
  const lan = nets.some((n) => /internet/i.test(n.ipv4)) ? nets.filter((n) => /internet/i.test(n.ipv4)) : nets;
  const lanProfiles = [...new Set(lan.map((n) => category(n.category)).filter(Boolean))];
  const active = [...new Set(nets.map((n) => category(n.category)).filter(Boolean))];
  const allows = rules.filter((r) => /allow/i.test(r.action)).map((r) => profilesOf(r.profile));
  const blocks = rules.filter((r) => /block/i.test(r.action)).map((r) => profilesOf(r.profile));
  const blocked = blocks.some((p) => touches(p, active.length ? active : ['Domain', 'Private', 'Public']));
  // An unreadable firewall must be reported as unknown, never assumed safe.
  const unread = payload.readable === false;
  const covered = !unread && allows.length > 0 && lanProfiles.length > 0 && lanProfiles.every((name) => allows.some((p) => touches(p, [name])));
  const publicNets = lan.filter((n) => n.category === 'Public').map((n) => ({ index: n.index, alias: n.alias }));
  let message = 'OK';
  if (!lan.length) message = 'No network connection.';
  else if (publicNets.length) message = 'The network "' + publicNets[0].alias + '" is Public. Use a trusted Private network for sharing. DenaDesk will not change its trust level.';
  else if (unread) message = 'Couldn’t read Windows Firewall rules. Ask your administrator to check access.';
  else if (blocked) message = 'A Windows Firewall block rule applies to DenaDesk. Repair preserves it; ask your administrator to review it.';
  else if (!covered) message = 'DenaDesk isn’t allowed through Windows Firewall on this network.';
  return { ok: lan.length > 0 && !publicNets.length && !blocked && covered, message, publicNets, blocked, covered, admin: payload.admin !== false, unread };
}

async function check(exe = process.execPath) {
  try {
    return { ...interpret(JSON.parse(await script('firewall-status', { Exe: exe }) || '{}')), checkedAt: Date.now() };
  } catch (e) {
    return { ok: false, message: 'Couldn’t check the firewall: ' + e.message, error: true, checkedAt: Date.now() };
  }
}

// One elevated PowerShell repairs app allow rules on Private/Domain LocalSubnet only.
async function fix(status, exe = process.execPath) {
  status = await check(exe); // Don't act on a stale renderer snapshot.
  if (status.error || status.unread || status.blocked || (status.publicNets || []).length) throw new Error(status.message);
  try {
    await scriptElevated('firewall-fix', { Exe: exe });
  } catch (e) {
    if (status && status.admin === false) throw new Error('it needs an administrator’s password. Ask your administrator to review the app’s Private/Domain local-subnet allow rules');
    throw e;
  }
  return check(exe);
}

module.exports = { check, fix, interpret };
