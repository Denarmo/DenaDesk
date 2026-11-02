// DenaDesk — GPL-3.0. An idle link may legitimately be older than the busy timeout.
'use strict';
function lastLive(ws, busy, rx, now) {
  if (busy && ws.wasBusy === false) ws.busySince = now;
  ws.wasBusy = busy;
  return busy ? Math.max(rx, ws.busySince || 0) : rx;
}
module.exports = { lastLive };
