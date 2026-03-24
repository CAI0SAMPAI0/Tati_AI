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

let currentTab = 'login';

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
    clearMessages();
}

// ── Mensagens de erro/sucesso ─────────────────────────────────────

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

    if (!username || !password) {
        showError('Preencha todos os campos.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || 'Erro ao fazer login.');
            return;
        }

        localStorage.setItem('token', data.token);
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

    if (!name || !email || !username || !password) {
        showError('Preencha todos os campos.');
        return;
    }

    if (password.length < 6) {
        showError('Senha deve ter pelo menos 6 caracteres.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Criando conta...';

    try {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, username, password, level }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || 'Erro ao criar conta.');
            return;
        }

        showSuccess('Conta criada! Fazendo login...');
        setTimeout(() => switchTab('login'), 1500);

    } catch (err) {
        showError('Erro de conexão.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar Conta';
    }
}

// ── Google OAuth (placeholder) ────────────────────────────────────

function handleGoogle() {
    // implementar depois com Google Identity Services
    alert('Google OAuth em breve!');
}

// ── Redireciona se já logado ──────────────────────────────────────

if (localStorage.getItem('token')) {
    window.location.href = '/chat.html';
}

// ── Ícone do tema no carregamento ─────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const theme = localStorage.getItem('theme') || 'dark';
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
});