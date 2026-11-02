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
    function render(s) {
      const busy = s.phase === 'signing-in';
      status.setHint(busy ? 'Finish signing in using your browser.' : s.account ? 'Signed in as ' + s.account.email
        : s.configured ? 'Google project: ' + s.projectId : 'Import the Desktop app JSON from Google Auth Platform.');
      imported.disabled = busy; signin.disabled = busy || !s.configured;
      cancel.hidden = !busy; signout.hidden = !s.account; signout.disabled = busy;
      error.textContent = s.error || '';
    }
    async function act(name) {
      try { render(await api[name]()); } catch { error.textContent = 'Google account setup could not finish. Try again.'; }
    }
    api.onGoogleAccount(render);
    act('googleAccountGet');
    return UI.card('Google account and remote access', [status,
      UI.row('Desktop sign-in configuration', 'Sign-in identifies your account. Linked devices and direct remote connections are still in development.', [imported]), error]);
  },
};
