const API = 'http://127.0.0.1:8000';

// ── Tema ──────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}

// ── Password eye toggle ───────────────────────────────────────────
function togglePw(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
        input.type     = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        input.type     = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}

// ── Abas login / cadastro / forgot ────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('form-forgot').style.display   = tab === 'forgot'   ? 'block' : 'none';

    // Esconde/mostra as abas principais quando está em "forgot"
    document.querySelector('.tabs').style.display = tab === 'forgot' ? 'none' : 'flex';

    clearMessages();
}

// ── Mensagens ─────────────────────────────────────────────────────
function showError(msg) {
    const el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.add('show');
}
function showSuccess(msg) {
    const el = document.getElementById('success-msg');
    el.textContent = msg;
    el.classList.add('show');
}
function clearMessages() {
    document.getElementById('error-msg').classList.remove('show');
    document.getElementById('success-msg').classList.remove('show');
}

// ── Login ─────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    clearMessages();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('btn-login');
    const btnSpan  = btn.querySelector('span');

    if (!username || !password) { showError(t('auth.err_fields')); return; }

    btn.disabled = true;
    if (btnSpan) btnSpan.textContent = t('auth.logging_in');

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res  = await fetch(`${API}/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    formData.toString(),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.detail || 'Erro ao fazer login.'); return; }

        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user',  JSON.stringify(data.user));
        window.location.href = '/chat.html';
    } catch {
        showError(t('auth.err_connection'));
    } finally {
        btn.disabled = false;
        if (btnSpan) btnSpan.textContent = t('auth.btn_login');
    }
}

// ── Registro ──────────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    clearMessages();

    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const level    = document.getElementById('reg-level').value;
    const btn      = document.getElementById('btn-register');
    const btnSpan  = btn.querySelector('span');

    if (!name || !email || !username || !password) { showError(t('auth.err_fields')); return; }
    if (password.length < 6) { showError(t('auth.err_password')); return; }

    btn.disabled = true;
    if (btnSpan) btnSpan.textContent = t('auth.registering');

    try {
        const res  = await fetch(`${API}/auth/register`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, email, username, password, level }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.detail || 'Erro ao criar conta.'); return; }
        showSuccess(t('auth.success_register'));
        setTimeout(() => switchTab('login'), 1500);
    } catch {
        showError(t('auth.err_connection'));
    } finally {
        btn.disabled = false;
        if (btnSpan) btnSpan.textContent = t('auth.btn_register');
    }
}

// ── Esqueci minha senha ───────────────────────────────────────────
function showForgotForm() {
    switchTab('forgot');
    document.getElementById('forgot-identifier').value = '';
    document.getElementById('forgot-result').style.display = 'none';
}

function backToLogin() {
    switchTab('login');
}

async function handleForgotPassword(e) {
    e.preventDefault();
    clearMessages();

    const identifier = document.getElementById('forgot-identifier').value.trim();
    const btn        = document.getElementById('btn-forgot');
    const btnSpan    = btn.querySelector('span');
    const resultEl   = document.getElementById('forgot-result');

    if (!identifier) { showError('Informe seu username ou e-mail.'); return; }

    btn.disabled = true;
    if (btnSpan) btnSpan.textContent = 'Enviando...';
    resultEl.style.display = 'none';

    try {
        const res  = await fetch(`${API}/auth/forgot-password`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ identifier }),
        });
        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || 'Erro ao processar pedido.');
            return;
        }

        // Conta Google
        if (data.ok === false) {
            resultEl.className = 'forgot-result error';
            resultEl.innerHTML = `🔵 ${data.message}`;
            resultEl.style.display = 'block';
            return;
        }

        // Modo dev: SMTP não configurado, mostra senha na tela
        if (data.dev_mode) {
            resultEl.className = 'forgot-result dev';
            resultEl.innerHTML = `
                <strong>⚙️ Modo desenvolvimento (SMTP não configurado)</strong><br><br>
                Sua senha temporária:<br>
                <code style="font-size:1.3rem;letter-spacing:0.1em;color:#7c3aed;">
                    ${data.temp_password}
                </code><br><br>
                <span style="color:#f87171;font-size:0.82rem;">
                    ⚠️ Após entrar, vá em Perfil → Segurança e crie uma nova senha.
                </span>
            `;
            resultEl.style.display = 'block';
            return;
        }

        // Sucesso: e-mail enviado
        resultEl.className = 'forgot-result success';
        resultEl.innerHTML = `
            ✅ <strong>E-mail enviado!</strong><br>
            Verifique sua caixa de entrada (e o spam).<br>
            <span style="font-size:0.82rem;color:#9ca3af;">
                A senha temporária expira quando você criar uma nova.
                Após entrar, vá em <strong>Perfil → Segurança</strong> e atualize sua senha.
            </span>
        `;
        resultEl.style.display = 'block';

    } catch {
        showError(t('auth.err_connection'));
    } finally {
        btn.disabled = false;
        if (btnSpan) btnSpan.textContent = 'Enviar senha temporária';
    }
}

// ── Google OAuth ──────────────────────────────────────────────────
window.handleGoogleCredential = async function(response) {
    clearMessages();
    setGoogleLoading(true);
    try {
        const res  = await fetch(`${API}/auth/google`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.detail || 'Erro ao autenticar com Google.'); return; }
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user',  JSON.stringify(data.user));
        window.location.href = '/chat.html';
    } catch {
        showError(t('auth.err_connection'));
    } finally {
        setGoogleLoading(false);
    }
};

function setGoogleLoading(loading) {
    const wrap = document.getElementById('google-btn-wrap');
    if (wrap) wrap.style.opacity = loading ? '0.5' : '1';
}

function initGoogleAuth() {
    const clientId = document.querySelector('meta[name="google-client-id"]')?.content || '';
    if (!clientId || clientId.startsWith('SEU_GOOGLE')) {
        const btn = document.querySelector('.btn-google');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
        return;
    }
    if (typeof google === 'undefined' || !google?.accounts?.id) return;

    google.accounts.id.initialize({
        client_id:    clientId,
        callback:     window.handleGoogleCredential,
        auto_select:  false,
        cancel_on_tap_outside: true,
        ux_mode:      'popup',
    });

    const wrap = document.getElementById('google-btn-wrap');
    if (wrap) {
        google.accounts.id.renderButton(wrap, {
            type:  'standard', shape: 'rectangular',
            theme: 'filled_black', text: 'continue_with',
            size:  'large', width: wrap.clientWidth || 340,
        });
    }
}

// ── Redirect if already logged in ────────────────────────────────
if (localStorage.getItem('token')) { window.location.href = '/chat.html'; }

window.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = (localStorage.getItem('theme') || 'dark') === 'dark' ? '☀️' : '🌙';

    if (typeof google !== 'undefined' && google?.accounts?.id) {
        initGoogleAuth();
    } else {
        window.onGoogleLibraryLoad = initGoogleAuth;
    }
});