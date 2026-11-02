// DuoDesk — Tip and Feedback (main process). Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The two support pages (shared/ui-support.js) ask the main process for everything, so the page itself
// never talks to the network or opens a link on its own:
//   profile()                  GET  https://beyond-media.ai/api/tips?creator=beyond-apps
//                              → {ok, profile:{name, tagline, bio, avatar(data: URL), site, currency, presets[], min, max},
//                                 supporters:[{name, amount(major units), currency, monthly, message, at}], count, monthly}
//                              cached for 10 minutes; offline → {ok:false, error, stale?}
//   createTip({amount, monthly, name?, message?})
//                              POST https://beyond-media.ai/api/tips {creator, amount, name, message, monthly, returnUrl}
//                              → {url} (a Stripe Checkout page; nothing is paid until the person pays there).
//                              The fields are the tips page's own (beyond-media.ai/tips/tips.js): amount in major
//                              units, name and message (≤ 280) shown on the supporters list, both optional.
//   startTip(same)             createTip, then opens the url in the browser, only if it is https on Stripe
//   info()                     what feedback can include: {app, version, os, osVersion, arch}
//   feedback({kind, message, email, includeInfo, via})
//                              via 'mail' (default): a mailto: to contact@beyond-media.ai, opened by the mail app
//                              via 'github': a new issue on github.com/0xCodez/DuoDesk, pre-filled
//                              via 'copy': the same email as text on the clipboard (no mail app)
//   preview(same as feedback)  the subject and body Send would use, for the page to show
// ipc(ipcMain) registers 'support:info', 'support:profile', 'support:tip', 'support:feedback', 'support:preview'
// (invoke) once; every shell's ipc.js calls it, every preload exposes them as supportInfo() … supportPreview().
// No keys or secrets: the tips API is public; Stripe Checkout runs in the browser.
'use strict';

const os = require('os');

const API = 'https://beyond-media.ai/api/tips';
const ORIGIN = 'https://beyond-media.ai';
const CREATOR = 'beyond-apps';
const RETURN_URL = 'https://beyond-media.ai/tips?creator=beyond-apps'; // an origin the tips API returns to
const CONTACT = 'contact@beyond-media.ai';
const ISSUES = 'https://github.com/0xCodez/DuoDesk/issues/new';
const APP_NAME = 'DenaDesk';
const KINDS = { bug: 'Bug', idea: 'Idea', love: 'Love it' };
const TTL = 10 * 60 * 1000;
const TIMEOUT = 10000;
const MAX_MESSAGE = 5000;
const MAILTO_MAX = 1900; // ShellExecute and some mail apps stop near 2 KB
const ISSUE_MAX = 7000;

// Electron, loaded when first used (the module is also required by plain-Node tests).
let E = null;
const electron = () => {
  if (E) return E;
  try { const m = require('electron'); E = typeof m === 'object' ? m : {}; } catch { E = {}; }
  return E;
};
let deps = {};
// Tests: setDeps({ fetch, openExternal, clipboard, version })
const setDeps = (d) => { deps = Object.assign({}, deps, d || {}); };

// read(r) reads the body inside the same timeout: a server that sends headers and then stalls can't
// leave the page waiting.
function doFetch(url, opts, read) {
  const f = deps.fetch || (electron().net && electron().net.fetch ? electron().net.fetch.bind(electron().net) : globalThis.fetch);
  const ctl = new AbortController();
  let t = null;
  const late = new Promise((_, no) => {
    t = setTimeout(() => { ctl.abort(); const e = new Error('timed out'); e.name = 'AbortError'; no(e); }, TIMEOUT);
  });
  const work = Promise.resolve(f(url, Object.assign({ signal: ctl.signal }, opts))).then((r) => (read ? read(r) : r));
  return Promise.race([work, late]).finally(() => clearTimeout(t));
}
const openExternal = (url) => (deps.openExternal || electron().shell.openExternal)(url);

// A cut never splits an emoji: a lone surrogate makes encodeURIComponent throw (the mailto link).
const cut = (t, max) => (t.length > max ? t.slice(0, max).replace(/[\ud800-\udbff]$/, '') : t);
const LONE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
const str = (v, max) => (typeof v === 'string' ? cut(v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(LONE, '').trim(), max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const MINOR = { jpy: 1, krw: 1, vnd: 1, clp: 1, isk: 1, huf: 1 }; // zero-decimal currencies (Stripe's minor units)
const minor = (c) => (MINOR[String(c || '').toLowerCase()] ? 1 : 100);

// Only links the support pages are allowed to open: https on Stripe Checkout / beyond-media.ai / GitHub, and mailto.
function safeUrl(u, kind) {
  let url;
  try { url = new URL(u); } catch { return null; }
  if (kind === 'mail') return url.protocol === 'mailto:' && url.pathname.toLowerCase() === CONTACT ? url.href : null;
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const h = url.hostname.toLowerCase();
  if (kind === 'checkout') return h === 'checkout.stripe.com' || h.endsWith('.stripe.com') || h === 'beyond-media.ai' ? url.href : null;
  if (kind === 'github') return h === 'github.com' && url.pathname === '/0xCodez/DuoDesk/issues/new' ? url.href : null;
  return null;
}

// ---------------------------------------------------------------------------------------------------
// The tip jar
// ---------------------------------------------------------------------------------------------------
let cache = null; // { at, value }
let avatarCache = null; // { src, data }
let inflight = null;

async function avatarData(src) {
  if (!src) return '';
  let url;
  try { url = new URL(src, ORIGIN); } catch { return ''; }
  if (url.protocol !== 'https:' || url.hostname !== 'beyond-media.ai') return '';
  if (avatarCache && avatarCache.src === url.href) return avatarCache.data;
  try {
    const got = await doFetch(url.href, undefined, async (r) => {
      const type = String((r.headers && r.headers.get && r.headers.get('content-type')) || '').split(';')[0].trim();
      if (!r.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type)) return null;
      return { type, buf: Buffer.from(await r.arrayBuffer()) };
    });
    if (!got) return '';
    const { type, buf } = got;
    if (!buf.length || buf.length > 400 * 1024) return '';
    const data = 'data:' + type + ';base64,' + buf.toString('base64');
    avatarCache = { src: url.href, data };
    return data;
  } catch { return ''; }
}

// The API's JSON → only the fields the page shows, checked.
function shape(j, avatar) {
  const c = (j && j.creator) || {};
  const currency = /^[a-z]{3}$/i.test(c.currency || '') ? c.currency.toLowerCase() : 'usd';
  const min = num(c.min) != null && c.min > 0 ? c.min : 1;
  const max = num(c.max) != null && c.max >= min ? c.max : 1000;
  const presets = (Array.isArray(c.presets) ? c.presets : []).filter((p) => num(p) != null && p >= min && p <= max).slice(0, 6);
  const supporters = (Array.isArray(j && j.supporters) ? j.supporters : []).slice(0, 12).map((s) => ({
    name: str(s && s.name, 60) || 'Someone',
    amount: num(s && s.amount) != null ? s.amount / minor((s && s.currency) || currency) : null,
    currency: /^[a-z]{3}$/i.test((s && s.currency) || '') ? s.currency.toLowerCase() : currency,
    monthly: !!(s && s.monthly),
    message: str(s && s.message, 280),
    at: (s && (typeof s.createdAt === 'number' || typeof s.createdAt === 'string')) ? s.createdAt : null,
  }));
  let site = '';
  try { const u = new URL(c.site); if (u.protocol === 'https:') site = u.href; } catch {}
  return {
    profile: {
      id: str(c.id, 60) || CREATOR,
      name: str(c.name, 80) || 'Beyond Apps',
      tagline: str(c.tagline, 140),
      bio: str(c.bio, 600),
      avatar: avatar || '',
      site,
      currency,
      presets: presets.length ? presets : [5, 10, 25, 50].filter((p) => p >= min && p <= max),
      min, max,
    },
    supporters,
    count: num(j && j.supporterCount) != null ? Math.max(0, Math.floor(j.supporterCount)) : supporters.length,
    monthly: num(j && j.monthlyCount) != null ? Math.max(0, Math.floor(j.monthlyCount)) : 0,
  };
}

async function profile(opts) {
  if (!opts || opts.consent !== true) return { ok: false, error: 'Choose Load tip service to contact beyond-media.ai.' };
  const force = !!(opts && opts.force);
  if (!force && cache && Date.now() - cache.at < TTL) return Object.assign({ ok: true, cached: true }, cache.value);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const j = await doFetch(API + '?creator=' + encodeURIComponent(CREATOR), { headers: { Accept: 'application/json' } }, async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'This tip jar isn’t available' : 'The tip service answered ' + r.status);
        try { return await r.json(); } catch { return null; } // a captive portal's HTML page, say
      });
      if (!j || typeof j !== 'object' || !j.creator || typeof j.creator !== 'object') throw new Error('The tip service sent something unexpected');
      const value = shape(j, await avatarData(j.creator.avatar));
      cache = { at: Date.now(), value };
      return Object.assign({ ok: true }, value);
    } catch (e) {
      const offline = e && (e.name === 'AbortError' || /fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|ERR_INTERNET|ERR_NAME|network/i.test(String(e.message || e)));
      const error = offline ? 'Can’t reach beyond-media.ai. Check your connection.' : String((e && e.message) || e);
      return cache ? Object.assign({ ok: false, error, offline, stale: true }, cache.value) : { ok: false, error, offline };
    } finally { inflight = null; }
  })();
  return inflight;
}

// The amount as the tips API takes it: major units, at most 2 decimals, inside the profile's range.
function checkTip(o) {
  const p = (cache && cache.value.profile) || { min: 1, max: 1000 };
  const amount = num(o && o.amount);
  if (amount == null) return { error: 'Enter an amount' };
  const a = Math.round(amount * 100) / 100;
  if (a < p.min || a > p.max) return { error: 'Enter an amount between ' + p.min + ' and ' + p.max };
  return { amount: a, monthly: !!(o && o.monthly), name: str(o && o.name, 60), message: str(o && o.message, 280) };
}

let lastTip = 0;
async function createTip(o) {
  if (!o || o.consent !== true) return { ok: false, error: 'Starting a tip requires your consent to contact the tip service.' };
  const t = checkTip(o);
  if (t.error) return { ok: false, error: t.error };
  if (Date.now() - lastTip < 2500) return { ok: false, error: 'One moment…' };
  lastTip = Date.now();
  try {
    const { r, j } = await doFetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ creator: CREATOR, amount: t.amount, name: t.name, message: t.message, monthly: t.monthly, returnUrl: RETURN_URL }),
    }, async (res) => { let body = null; try { body = await res.json(); } catch {} return { r: res, j: body }; });
    if (!r.ok) return { ok: false, error: str(j && j.error, 200) || 'The tip service answered ' + r.status };
    const url = safeUrl(j && j.url, 'checkout');
    if (!url) return { ok: false, error: 'The tip service sent a link DenaDesk won’t open' };
    return { ok: true, url };
  } catch (e) {
    lastTip = 0;
    return { ok: false, error: e && e.name === 'AbortError' ? 'The tip service took too long. Try again.' : 'Can’t reach beyond-media.ai. Check your connection.' };
  }
}

async function startTip(o) {
  const r = await createTip(o);
  if (!r.ok) return r;
  try { await openExternal(r.url); } catch { return { ok: false, error: 'Couldn’t open the browser' }; }
  return { ok: true, opened: new URL(r.url).hostname }; // the page only learns where it went, not the link
}

// ---------------------------------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------------------------------
function osName() {
  return process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : process.platform === 'linux' ? 'Linux' : process.platform;
}
function info() {
  const app = electron().app;
  let osVersion = '';
  try { osVersion = typeof process.getSystemVersion === 'function' ? process.getSystemVersion() : os.release(); } catch { osVersion = os.release(); }
  return {
    app: APP_NAME,
    version: deps.version || (app && app.getVersion ? app.getVersion() : ''),
    os: osName(),
    osVersion,
    arch: process.arch,
  };
}
const infoLines = (i) => [`App: ${i.app} ${i.version}`, `System: ${i.os} ${i.osVersion}`, `Architecture: ${i.arch}`];

function checkFeedback(o) {
  const kind = Object.hasOwn(KINDS, o && o.kind) ? o.kind : 'idea';
  const message = str(o && o.message, MAX_MESSAGE);
  const email = str(o && o.email, 200);
  if (email && !/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email)) return { error: 'That reply email doesn’t look right' };
  if (!message && kind !== 'love') return { error: 'Write a few words first' };
  return { kind, message, email, includeInfo: !!(o && o.includeInfo) };
}

// Subject "DenaDesk feedback · <version> · <os> <arch>". With the info box unticked nothing about the
// computer goes out, not even in the subject ("DenaDesk feedback · Bug").
function compose(f) {
  const i = info();
  const subject = f.includeInfo ? `${APP_NAME} feedback · ${i.version} · ${i.os} ${i.arch}` : `${APP_NAME} feedback · ${KINDS[f.kind]}`;
  const parts = [`[${KINDS[f.kind]}]`, '', f.message || (f.kind === 'love' ? 'Just wanted to say I like DenaDesk.' : '')];
  if (f.email) parts.push('', 'Reply to: ' + f.email);
  if (f.includeInfo) parts.push('', '—', ...infoLines(i));
  return { subject, body: parts.join('\n'), info: i };
}

const enc = encodeURIComponent;
function mailto(subject, body) {
  let b = body;
  let truncated = false;
  let href = `mailto:${CONTACT}?subject=${enc(subject)}&body=${enc(b)}`;
  while (href.length > MAILTO_MAX && b.length > 40) {
    truncated = true;
    b = cut(b, Math.floor(b.length * 0.85)) + '…';
    href = `mailto:${CONTACT}?subject=${enc(subject)}&body=${enc(b)}`;
  }
  return { href, truncated };
}

async function feedback(o) {
  const f = checkFeedback(o);
  if (f.error) return { ok: false, error: f.error };
  const via = o && (o.via === 'github' || o.via === 'copy') ? o.via : 'mail';
  const { subject, body } = compose(f);
  const copy = (text) => { (deps.clipboard || electron().clipboard).writeText(text); };
  if (via === 'copy') {
    copy(`To: ${CONTACT}\nSubject: ${subject}\n\n${body}`);
    return { ok: true, via, copied: true };
  }
  if (via === 'github') {
    const title = `[${KINDS[f.kind]}] ` + (f.message.split('\n')[0].slice(0, 80) || 'Feedback');
    const gb = (f.message ? f.message : '') + (f.includeInfo ? '\n\n---\n' + infoLines(info()).join('\n') : '');
    const q = new URLSearchParams({ title, body: gb.slice(0, ISSUE_MAX) });
    if (f.kind === 'bug') q.set('labels', 'bug'); else if (f.kind === 'idea') q.set('labels', 'enhancement');
    const url = safeUrl(ISSUES + '?' + q.toString(), 'github');
    if (!url) return { ok: false, error: 'Couldn’t make the GitHub link' };
    try { await openExternal(url); } catch { return { ok: false, error: 'Couldn’t open the browser' }; }
    return { ok: true, via };
  }
  const m = mailto(subject, body);
  const url = safeUrl(m.href, 'mail');
  if (!url) return { ok: false, error: 'Couldn’t make the email' };
  if (m.truncated) copy(`To: ${CONTACT}\nSubject: ${subject}\n\n${body}`); // the whole message, to paste over the cut one
  try { await openExternal(url); } catch { return { ok: false, error: 'No mail app answered. Use Copy and send it to ' + CONTACT + '.', noMail: true }; }
  return { ok: true, via, truncated: m.truncated, copied: m.truncated };
}

// ---------------------------------------------------------------------------------------------------
let registered = false;
function ipc(ipcMain) {
  if (registered || !ipcMain) return;
  registered = true;
  const handle = (name, fn) => ipcMain.handle(name, async (_e, arg) => {
    try { return await fn(arg && typeof arg === 'object' ? arg : {}); } catch (e) { console.error('support ' + name + ':', e); return { ok: false, error: 'Something went wrong' }; }
  });
  handle('support:info', () => Object.assign({ contact: CONTACT, issues: 'github.com/0xCodez/DuoDesk/issues' }, info()));
  handle('support:profile', (o) => profile({ consent: o.consent === true, force: !!o.force }));
  handle('support:tip', (o) => startTip({ consent: o.consent === true, amount: o.amount, monthly: o.monthly, name: o.name, message: o.message }));
  handle('support:feedback', (o) => feedback(o));
  // What Send would put in the email (the page shows it under the info box), without the checks.
  handle('support:preview', (o) => Object.assign({ ok: true, to: CONTACT }, compose({
    kind: Object.hasOwn(KINDS, o.kind) ? o.kind : 'idea', message: str(o.message, MAX_MESSAGE), email: str(o.email, 200), includeInfo: !!o.includeInfo,
  })));
}

module.exports = { ipc, profile, createTip, startTip, info, feedback, compose, checkFeedback, safeUrl, setDeps, CONTACT };
