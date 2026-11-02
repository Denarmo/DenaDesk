// DenaDesk — GPL-3.0. Identity setup is separate from enabling remote-device access.
'use strict';
window.GoogleAccountUI = {
  card() {
    const { api } = UI;
    if (!api.googleAccountGet) return null;
    const error = UI.el('p', { class: 'hint' });
    const imported = UI.button('Import Google configuration…', () => act('googleAccountImport'), 'small');
    const signin = UI.button('Sign in with Google', () => act('googleAccountSignIn'), 'small primary');
    const cancel = UI.button('Cancel sign-in', () => act('googleAccountCancel'), 'small');
    const signout = UI.button('Sign out on this PC', () => act('googleAccountSignOut'), 'small');
    const status = UI.row('Google account', 'Loading account settings…', [signin, cancel, signout]);
    const deviceList = UI.el('div');
    const linkError = UI.el('p', { class: 'hint', attrs: { role: 'status' } });
    let linked = {}, accountState = null;
    const enable = UI.button('Link this PC', () => remoteAct('remoteLinkEnable', !linked.enabled), 'small');
    const disconnect = UI.button('Disconnect', () => remoteAct('remoteLinkDisconnect'), 'small');
    const connection = UI.row('Linked devices', 'Direct connections only. The host approves each session.', [enable, disconnect]);
    const own = UI.row('This device fingerprint', 'Loading…');
    const current = UI.row('Remote session', 'No active session');
    function prerequisites() {
      enable.disabled = !linked.enabled && (!accountState?.account || accountState.phase === 'signing-in' || !linked.fingerprint);
      connection.setHint(!accountState ? 'Loading Google account settings…'
        : !accountState.configured ? 'First import your Google Desktop app JSON, then sign in and link this PC.'
        : !accountState.account ? 'Sign in with Google before linking this PC.'
        : !linked.fingerprint ? 'Secure device keys are unavailable. Restart DenaDesk and try again.'
        : 'Connection service: ' + (linked.status || 'off') + '. Session traffic goes directly between devices.');
      linkError.textContent = accountState?.account ? linked.error || '' : '';
    }
    function renderRemote(s) {
      linked = s;
      enable.textContent = s.enabled ? 'Unlink this PC' : 'Link this PC';
      prerequisites();
      own.setHint(s.fingerprint || 'Device keys are unavailable.');
      disconnect.hidden = !s.session;
      current.setHint(s.session ? s.session.name + ' · ' + s.session.role + ' · ' + s.session.mode + ' · ' + s.session.status : 'No active session');
      deviceList.replaceChildren(...(s.devices || []).map((d) => {
        const view = UI.button('View', () => remoteAct('remoteLinkConnect', d.id, 'view'), 'small');
        const control = UI.button('Control', () => remoteAct('remoteLinkConnect', d.id, 'control'), 'small');
        view.disabled = control.disabled = !d.online || !!s.session || s.status !== 'online';
        const forget = UI.button('Forget trust', () => remoteAct('remoteLinkForget', d.id), 'small'); forget.hidden = !d.trusted;
        return UI.row(d.name, (d.online ? 'Online' : 'Offline') + (d.trusted ? ' · trusted device' : ' · fingerprint verification required'), [view, control, forget]);
      }));
    }
    async function remoteAct(name, ...args) {
      try { renderRemote(await api[name](...args)); } catch { linkError.textContent = 'The linked-device action could not finish.'; }
    }
    function render(s) {
      accountState = s;
      const busy = s.phase === 'signing-in';
      status.setHint(busy ? 'Finish signing in using your browser.' : s.account ? 'Signed in as ' + s.account.email
        : s.configured ? 'Google project: ' + s.projectId : 'Import the Desktop app JSON from Google Auth Platform.');
      imported.disabled = busy; signin.disabled = busy || !s.configured;
      cancel.hidden = !busy; signout.hidden = !s.account; signout.disabled = busy;
      error.textContent = s.error || '';
      prerequisites();
    }
    async function act(name) {
      try { render(await api[name]()); } catch { error.textContent = 'Google account setup could not finish. Try again.'; }
    }
    signin.disabled = enable.disabled = true;
    api.onGoogleAccount(render);
    act('googleAccountGet');
    api.onRemoteLink(renderRemote);
    remoteAct('remoteLinkGet');
    return UI.card('Google account and remote access', [status,
      UI.row('Desktop sign-in configuration', 'Google identifies your account for the linked-device list. Remote access needs your approval.', [imported]), error,
      connection, own, current, deviceList, linkError,
      UI.row('Direct remote access', 'Windows screen viewing and optional keyboard/mouse control. No relay fallback; some networks cannot connect. Clipboard, files, sound and Android remote sessions are not included yet.')]);
  },
};
