/* Redirect se já autenticado */
if (getToken()) window.location.href = '/chat.html';

window.addEventListener('DOMContentLoaded', () => {
  _initGoogleAuth();
});

// ── Abas ──────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('form-forgot').style.display   = tab === 'forgot'   ? 'block' : 'none';
  document.querySelector('.tabs').style.display          = tab === 'forgot'   ? 'none'  : 'flex';
  _clearMessages();
}

// ── Mensagens ─────────────────────────────────────────────────────────────────

function _showError(msg)   { _setMsg('error-msg',   msg, true);  }
function _showSuccess(msg) { _setMsg('success-msg', msg, true);  }
function _clearMessages()  { _setMsg('error-msg',   '',  false); _setMsg('success-msg', '', false); }

function _setMsg(id, msg, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', show);
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  _clearMessages();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { _showError(typeof t === 'function' ? await t('auth.err_fields') : 'Fields required.'); return; }

  await _withBtn('btn-login', typeof t === 'function' ? await t('auth.logging_in') : 'Logging in...', typeof t === 'function' ? await t('auth.btn_login') : 'Login', async () => {
    const body = new URLSearchParams({ username, password });
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) { _showError(data.detail || (typeof t === 'function' ? await t('auth.err_login') : 'Login error.')); return; }
    saveSession(data.access_token, data.user);
    window.location.href = '/chat.html';
  });
}

// ── Registro ──────────────────────────────────────────────────────────────────

async function handleRegister(e) {
  e.preventDefault();
  _clearMessages();

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const level    = document.getElementById('reg-level').value;

  if (!name || !email || !username || !password) { _showError(typeof t === 'function' ? await t('auth.err_fields') : 'Required fields.'); return; }
  if (password.length < 6) { _showError(typeof t === 'function' ? await t('auth.err_password') : 'Password too short.'); return; }

  await _withBtn('btn-register', typeof t === 'function' ? await t('auth.registering') : 'Registering...', typeof t === 'function' ? await t('auth.btn_register') : 'Register', async () => {
    const { ok, data } = await apiPost('/auth/register', { name, email, username, password, level });
    if (!ok) { _showError(data.detail || (typeof t === 'function' ? await t('auth.err_register') : 'Error creating account.')); return; }
    _showSuccess(typeof t === 'function' ? await t('auth.success_register') : 'Success!');
    setTimeout(() => switchTab('login'), 1500);
  });
}

// ── Forgot password ───────────────────────────────────────────────────────────

function showForgotForm() {
  switchTab('forgot');
  document.getElementById('forgot-identifier').value = '';
  document.getElementById('forgot-result').style.display = 'none';
}

function backToLogin() { switchTab('login'); }

async function handleForgotPassword(e) {
  e.preventDefault();
  _clearMessages();

  const identifier = document.getElementById('forgot-identifier').value.trim();
  const resultEl   = document.getElementById('forgot-result');
  if (!identifier) { _showError(typeof t === 'function' ? await t('auth.err_forgot_identifier') : 'Enter identifier.'); return; }

  await _withBtn('btn-forgot', typeof t === 'function' ? await t('auth.sending_temp_pass') : 'Sending...', typeof t === 'function' ? await t('auth.btn_forgot_password') : 'Reset', async () => {
    resultEl.style.display = 'none';
    const { ok, data } = await apiPost('/auth/forgot-password', { identifier });

    if (!ok) { _showError(data.detail || (typeof t === 'function' ? await t('auth.err_forgot_request') : 'Error.')); return; }
    if (data.ok === false) {
      _showForgotResult(resultEl, 'error', `🔵 ${data.message || (typeof t === 'function' ? await t('auth.err_message_unknown') : 'Unknown error')}`);
      return;
    }
    if (data.dev_mode) {
      _showForgotResult(resultEl, 'dev', `
        <strong>⚙️ ${typeof t === 'function' ? await t('auth.dev_mode_title') : 'Dev Mode'}</strong><br><br>
        ${typeof t === 'function' ? await t('auth.temp_password') : 'Temp Password'}:<br>
        <code style="font-size:1.3rem;letter-spacing:0.1em;color:var(--primary);">${data.temp_password}</code><br><br>
        <span style="color:var(--danger);font-size:0.82rem;">${typeof t === 'function' ? await t('auth.warning_new_password') : 'Change it!'}</span>
      `);
      return;
    }
    _showForgotResult(resultEl, 'success',
      `✅ <strong>${typeof t === 'function' ? await t('auth.email_sent') : 'Sent!'}</strong><br>${typeof t === 'function' ? await t('auth.check_email') : 'Check your email.'}`
    );
  });
}

function _showForgotResult(el, type, html) {
  el.className = `forgot-result ${type}`;
  el.innerHTML = html;
  el.style.display = 'block';
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

window.handleGoogleCredential = async function (response) {
  _clearMessages();
  const wrap = document.getElementById('google-btn-wrap');
  if (wrap) wrap.style.opacity = '0.5';

  try {
    const { ok, data } = await apiPost('/auth/google', { token: response.credential });
    if (!ok) { _showError(data.detail || (typeof t === 'function' ? await t('auth.err_google_auth') : 'Error authenticating with Google.')); return; }
    saveSession(data.access_token, data.user);
    window.location.href = '/chat.html';
  } catch {
    _showError(typeof t === 'function' ? await t('auth.err_connection') : 'Connection error.');
  } finally {
    if (wrap) wrap.style.opacity = '0.001';
  }
};

function _initGoogleAuth() {
  const clientId = document.querySelector('meta[name="google-client-id"]')?.content || '';
  if (!clientId || typeof google === 'undefined' || !google?.accounts?.id) {
      console.warn("Google Identity Services client not available. Skipping initialization.");
      return;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: window.handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    ux_mode: 'popup',
  });

  const wrap = document.getElementById('google-btn-wrap');
  if (wrap) {
    google.accounts.id.renderButton(wrap, {
      type: 'standard', shape: 'rectangular',
      theme: 'filled_black', text: 'continue_with',
      size: 'large', width: wrap.clientWidth || 320,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _withBtn(btnId, loadingLabel, resetLabel, fn) {
  const btn  = document.getElementById(btnId);
  const span = btn?.querySelector('span');
  if (btn) btn.disabled = true;
  if (span) span.textContent = loadingLabel;
  try { await fn(); }
  catch (err) {
    const errMsg = typeof t === 'function' ? await t('auth.err_connection') : `An error occurred: ${err.message}`;
    _showError(errMsg);
  }
  finally {
    if (btn) btn.disabled = false;
    if (span) span.textContent = resetLabel;
  }
}