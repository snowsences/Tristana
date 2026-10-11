/** Keep the private interface hidden from first paint until auth is confirmed. */
export function applyAuthGate(document, authenticated) {
  const app = document.getElementById('app-shell');
  const splash = document.getElementById('signin-panel');
  if(!authenticated)for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close('cancel');
  app.hidden = !authenticated;
  app.toggleAttribute('inert', !authenticated);
  splash.hidden = authenticated;
  document.body.dataset.auth = authenticated ? 'signed-in' : 'signed-out';
}
