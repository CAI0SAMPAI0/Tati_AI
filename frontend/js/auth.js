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
  if (!username || !password) { _showError(t('auth.err_fields')); return; }

  await _withBtn('btn-login', t('auth.logging_in'), t('auth.btn_login'), async () => {
    const body = new URLSearchParams({ username, password });
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) { _showError(data.detail || 'Erro ao fazer login.'); return; }
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

  if (!name || !email || !username || !password) { _showError(t('auth.err_fields')); return; }
  if (password.length < 6) { _showError(t('auth.err_password')); return; }

  await _withBtn('btn-register', t('auth.registering'), t('auth.btn_register'), async () => {
    const { ok, data } = await apiPost('/auth/register', { name, email, username, password, level });
    if (!ok) { _showError(data.detail || 'Erro ao criar conta.'); return; }
    _showSuccess(t('auth.success_register'));
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
  if (!identifier) { _showError('Informe seu username ou e-mail.'); return; }

  await _withBtn('btn-forgot', 'Enviando...', 'Enviar senha temporária', async () => {
    resultEl.style.display = 'none';
    const { ok, data } = await apiPost('/auth/forgot-password', { identifier });

    if (!ok)             { _showError(data.detail || 'Erro ao processar pedido.'); return; }
    if (data.ok === false) {
      _showForgotResult(resultEl, 'error', `🔵 ${data.message}`);
      return;
    }
    if (data.dev_mode) {
      _showForgotResult(resultEl, 'dev', `
        <strong>⚙️ Modo desenvolvimento</strong><br><br>
        Senha temporária:<br>
        <code style="font-size:1.3rem;letter-spacing:0.1em;color:var(--primary);">${data.temp_password}</code><br><br>
        <span style="color:var(--danger);font-size:0.82rem;">⚠️ Crie uma nova senha após entrar.</span>
      `);
      return;
    }
    _showForgotResult(resultEl, 'success',
      '✅ <strong>E-mail enviado!</strong><br>Verifique sua caixa de entrada (e o spam).'
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
    if (!ok) { _showError(data.detail || 'Erro ao autenticar com Google.'); return; }
    saveSession(data.access_token, data.user);
    window.location.href = '/chat.html';
  } catch {
    _showError(t('auth.err_connection'));
  } finally {
    if (wrap) wrap.style.opacity = '0.001';
  }
};

function _initGoogleAuth() {
  const clientId = document.querySelector('meta[name="google-client-id"]')?.content || '';
  if (!clientId || typeof google === 'undefined' || !google?.accounts?.id) return;

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
  catch { _showError(t('auth.err_connection')); }
  finally {
    if (btn) btn.disabled = false;
    if (span) span.textContent = resetLabel;
  }
}