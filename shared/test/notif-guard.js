// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
'use strict';

const assert = require('assert');
const { NotifGuard, isOwn } = require('../notif-guard');

let t = 1000;
const g = new NotifGuard({ windowMs: 15000, now: () => t });
assert.strictEqual(g.repeat('in', 'app', 'DenaDesk', 'x'), false, 'the first one goes');
for (let i = 0; i < 20; i++) assert.strictEqual(g.repeat('in', 'app', 'DenaDesk', 'x'), true, 'the same text again: dropped');
assert.strictEqual(g.repeat('out', 'app', 'DenaDesk', 'x'), false, 'incoming and outgoing are counted apart');
assert.strictEqual(g.repeat('in', 'app', 'DenaDesk', 'other'), false, 'other text goes');
t += 16000;
assert.strictEqual(g.repeat('in', 'app', 'DenaDesk', 'x'), false, 'after the window it goes again');
assert.ok(isOwn('org.denarmo.denadesk') && isOwn('', 'DenaDesk') && isOwn('', 'DenaDesk') && !isOwn('com.whatsapp', 'WhatsApp'));
console.log('notif-guard: passed');
