// js/profile.js
const API = 'http://127.0.0.1:8000';

const token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }
const userLocal = JSON.parse(userRaw);

// ── Tema ──────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    loadProfile();
    loadStats();
});

// ── Load profile ──────────────────────────────────────────────────
async function loadProfile() {
    try {
        const res = await fetch(`${API}/profile/`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { logout(); return; }
        const data = await res.json();
        populateProfile(data);
    } catch (e) {
        console.error('loadProfile error', e);
    }
}

function populateProfile(data) {
    const name = data.name || data.username;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-username').textContent = '@' + data.username;
    document.getElementById('badge-level').textContent = data.level || 'Beginner';
    document.getElementById('badge-role').textContent = data.role || 'student';

    // Fill fields
    setVal('field-name', data.name);
    setVal('field-email', data.email);
    setVal('field-level', data.level);
    setVal('field-focus', data.focus);
    if (data.profile) {
        setVal('field-nickname', data.profile.nickname);
        setVal('field-occupation', data.profile.occupation);
    }
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
}

// ── Load stats ────────────────────────────────────────────────────
async function loadStats() {
    try {
        const [convRes] = await Promise.all([
            fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const convs = convRes.ok ? await convRes.json() : [];
        document.getElementById('stat-conversations').textContent = convs.length;

        // Days since account creation
        const userData = await fetch(`${API}/profile/`, { headers: { Authorization: `Bearer ${token}` } });
        if (userData.ok) {
            const d = await userData.json();
            if (d.created_at) {
                const days = Math.floor((Date.now() - new Date(d.created_at)) / 86400000);
                document.getElementById('stat-days').textContent = days;
            }
        }
        // Messages count (we don't have a dedicated endpoint, approximate)
        document.getElementById('stat-messages').textContent = '—';
    } catch (e) { console.error('loadStats error', e); }
}

// ── Save profile ──────────────────────────────────────────────────
async function saveProfile() {
    const btn = document.getElementById('btn-save');
    const feedback = document.getElementById('save-feedback');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const body = {
        name: document.getElementById('field-name').value.trim() || undefined,
        email: document.getElementById('field-email').value.trim() || undefined,
        level: document.getElementById('field-level').value || undefined,
        focus: document.getElementById('field-focus').value || undefined,
        nickname: document.getElementById('field-nickname').value.trim() || undefined,
        occupation: document.getElementById('field-occupation').value.trim() || undefined,
    };

    try {
        const res = await fetch(`${API}/profile/`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            showFeedback(feedback, 'Perfil atualizado com sucesso! ✓', 'success');
            // Update local user cache
            const updated = { ...userLocal, ...body };
            localStorage.setItem('user', JSON.stringify(updated));
            loadProfile();
        } else {
            showFeedback(feedback, data.detail || 'Erro ao salvar.', 'error');
        }
    } catch (e) {
        showFeedback(feedback, 'Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar alterações`;
    }
}

// ── Change password ───────────────────────────────────────────────
async function changePassword() {
    const btn = document.getElementById('btn-pw');
    const feedback = document.getElementById('pw-feedback');
    const current = document.getElementById('field-current-pw').value;
    const newPw = document.getElementById('field-new-pw').value;

    if (!current || !newPw) {
        showFeedback(feedback, 'Preencha os dois campos.', 'error');
        return;
    }
    if (newPw.length < 6) {
        showFeedback(feedback, 'A nova senha deve ter pelo menos 6 caracteres.', 'error');
        return;
    }

    btn.disabled = true;
    try {
        const res = await fetch(`${API}/auth/password`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: current, new_password: newPw })
        });
        const data = await res.json();
        if (res.ok) {
            showFeedback(feedback, 'Senha atualizada com sucesso! ✓', 'success');
            document.getElementById('field-current-pw').value = '';
            document.getElementById('field-new-pw').value = '';
        } else {
            showFeedback(feedback, data.detail || 'Erro ao atualizar senha.', 'error');
        }
    } catch (e) {
        showFeedback(feedback, 'Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
    }
}

// ── Helpers ───────────────────────────────────────────────────────
function showFeedback(el, msg, type) {
    el.textContent = msg;
    el.className = 'save-feedback show ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('show'); }, 4000);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}