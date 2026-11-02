// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Multi-device tab, one-to-one app: what it is and the button that turns it on (multi.js). DenaDesk
// restarts into mesh/main.js, whose own page (mesh/ui-multi.js) has the settings for several devices.
'use strict';

UI.tab({
  id: 'multi',
  order: 95,
  title: 'Multi-device',
  color: 'linear-gradient(#5e5ce6, #3634a3)',
  desc: 'Several computers and phones connected at once',
  bottom: true,
  build(body) {
    const { api } = UI;
    // The popup says what it is (shared/mesh-intro.js) before it restarts.
    const turnOn = UI.button('Turn on', () => MeshIntro.confirm(() => {
      turnOn.disabled = true;
      turnOn.textContent = 'Restarting…';
      api.setMulti(true);
    }), 'small primary');

    body.append(
      UI.card('Mesh mode', [
        UI.row('Use several devices at once',
          'Computers and phones connected at the same time: one clipboard and one set of notifications for all, each screen edge leading to another device, a phone and a computer together',
          [turnOn]),
      ]),
      UI.note('info', 'DenaDesk restarts when you turn it on or off.'),
      MeshIntro.art(),
    );

    return () => {};
  },
});
