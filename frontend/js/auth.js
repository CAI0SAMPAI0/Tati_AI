// js/auth.js

const API = 'http://127.0.0.1:8000';

// ── Tema claro/escuro ─────────────────────────────────────────────

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}

// ── Abas login / cadastro ─────────────────────────────────────────

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
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
    const btn = document.getElementById('btn-login');

    if (!username || !password) { showError('Preencha todos os campos.'); return; }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
        });

        const data = await res.json();
        if (!res.ok) { showError(data.detail || 'Erro ao fazer login.'); return; }

        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/chat.html';

    } catch (err) {
        showError('Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
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

    if (!name || !email || !username || !password) { showError('Preencha todos os campos.'); return; }
    if (password.length < 6) { showError('Senha deve ter pelo menos 6 caracteres.'); return; }

    btn.disabled = true;
    btn.textContent = 'Criando conta...';

    try {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, username, password, level }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.detail || 'Erro ao criar conta.'); return; }
        showSuccess('Conta criada! Faça login agora.');
        setTimeout(() => switchTab('login'), 1500);
    } catch (err) {
        showError('Erro de conexão.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar Conta';
    }
}

// ── Google OAuth ──────────────────────────────────────────────────

// Callback global chamado pelo GSI após o usuário escolher a conta
window.handleGoogleCredential = async function(response) {
    clearMessages();
    setGoogleLoading(true);

    try {
        const res = await fetch(`${API}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.detail || 'Erro ao autenticar com Google.'); return; }

        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/chat.html';
    } catch (err) {
        showError('Erro de conexão ao autenticar com Google.');
    } finally {
        setGoogleLoading(false);
    }
};

function setGoogleLoading(loading) {
    const wrap = document.getElementById('google-btn-wrap');
    if (wrap) wrap.style.opacity = loading ? '0.5' : '1';
}

// Chamado pelo botão customizado (.btn-google)
function handleGoogle() {
    if (typeof google === 'undefined' || !google?.accounts?.id) {
        showError('Serviço do Google não carregou. Verifique sua conexão e recarregue a página.');
        return;
    }

    // Tenta abrir o One Tap primeiro
    google.accounts.id.prompt((notification) => {
        // Se o One Tap foi suprimido, aciona o botão nativo renderizado
        if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
            const nativeBtn = document.querySelector('#google-btn-wrap div[role="button"]');
            if (nativeBtn) {
                nativeBtn.click();
            } else {
                showError('Popup do Google bloqueado. Verifique as configurações do navegador.');
            }
        }
    });
}

// ── Inicializa GSI ────────────────────────────────────────────────

function initGoogleAuth() {
    const clientId = document.querySelector('meta[name="google-client-id"]')?.content || '';

    if (!clientId || clientId.startsWith('SEU_GOOGLE')) {
        console.warn('[Auth] google-client-id não configurado. Botão Google desativado.');
        const btn = document.querySelector('.btn-google');
        if (btn) {
            btn.disabled = true;
            btn.title    = 'Configure o GOOGLE_CLIENT_ID no index.html';
            btn.style.opacity = '0.4';
            btn.style.cursor  = 'not-allowed';
        }
        return;
    }

    if (typeof google === 'undefined' || !google?.accounts?.id) {
        console.warn('[Auth] GSI script ainda não carregou.');
        return;
    }

    google.accounts.id.initialize({
        client_id: clientId,
        callback: window.handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',           // garante popup em vez de redirect
    });

    // Renderiza o botão nativo do Google dentro do #google-btn-wrap
    // Ele serve como fallback caso o One Tap seja suprimido
    const wrap = document.getElementById('google-btn-wrap');
    if (wrap) {
        google.accounts.id.renderButton(wrap, {
            type:            'standard',
            shape:           'rectangular',
            theme:           'filled_black',
            text:            'continue_with',
            size:            'large',
            width:           wrap.clientWidth || 340,
            logo_alignment:  'left',
        });
    }

    console.log('[Auth] Google Identity Services inicializado com sucesso.');
}

// ── Redireciona se já logado ──────────────────────────────────────

if (localStorage.getItem('token')) {
    window.location.href = '/chat.html';
}

// ── DOMContentLoaded ─────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = (localStorage.getItem('theme') || 'dark') === 'dark' ? '☀️' : '🌙';

    if (typeof google !== 'undefined' && google?.accounts?.id) {
        initGoogleAuth();
    } else {
        // Script GSI ainda carregando — usa o hook onGoogleLibraryLoad
        window.onGoogleLibraryLoad = initGoogleAuth;
    }
});