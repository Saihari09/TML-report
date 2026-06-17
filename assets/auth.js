// TML report generator — client-side auth gate.
//
// This is a SPEED BUMP, not real security. The hash is in JS the user receives.
// What it does:
//   - Keeps casual / accidental viewers out of the generator.
//   - Gives a per-user audit trail (the username is stamped on each report).
// What it does NOT do:
//   - Prevent a motivated attacker from reading the source and brute-forcing hashes.
//   - Replace a real backend. Move to proper auth when TML hosts on its own infra.
//
// Password hashing: SHA-256( username + ":" + password + ":" + SALT )

(function () {
  const SALT = 'TML-2026-report-generator';
  const SESSION_KEY = 'tml_session_v1';
  const SESSION_HOURS = 12;

  async function hashCreds(username, password) {
    const enc = new TextEncoder().encode(`${username}:${password}:${SALT}`);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadUsers() {
    if (window.__TML_USERS) return window.__TML_USERS;
    // All callers load auth.js with a relative path that resolves to ./assets/users.json.
    const resp = await fetch('./assets/users.json').catch(() => fetch('../assets/users.json'));
    const data = await resp.json();
    window.__TML_USERS = data;
    return data;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      if (!sess.exp || Date.now() > sess.exp) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return sess;
    } catch { return null; }
  }

  function setSession(username) {
    const sess = { user: username, exp: Date.now() + SESSION_HOURS * 3600 * 1000, at: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    return sess;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function tryLogin(username, password) {
    if (!username || !password) return { ok: false, error: 'Enter username and password' };
    const users = await loadUsers();
    const want = users[username.trim().toLowerCase()];
    if (!want) return { ok: false, error: 'Unknown user or wrong password' };
    const got = await hashCreds(username.trim().toLowerCase(), password);
    if (got !== want) return { ok: false, error: 'Unknown user or wrong password' };
    const sess = setSession(username.trim().toLowerCase());
    return { ok: true, session: sess };
  }

  // Gate the current page: if no valid session, redirect to login.html.
  function requireAuth(loginUrl = './login.html') {
    const sess = getSession();
    if (!sess) {
      // Preserve where they came from so login can bounce back.
      const back = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace(loginUrl + '?back=' + back);
      return null;
    }
    return sess;
  }

  // Wire a logout button anywhere on the page (data-tml-logout).
  function bindLogoutControls() {
    document.querySelectorAll('[data-tml-logout]').forEach(btn => {
      btn.addEventListener('click', () => { clearSession(); location.href = './login.html'; });
    });
  }

  // Show the current username in any element with [data-tml-username].
  function showUsername(sess) {
    const u = sess && sess.user;
    if (!u) return;
    document.querySelectorAll('[data-tml-username]').forEach(el => { el.textContent = u; });
  }

  window.TML_AUTH = { hashCreds, loadUsers, getSession, setSession, clearSession, tryLogin, requireAuth, bindLogoutControls, showUsername };
})();
