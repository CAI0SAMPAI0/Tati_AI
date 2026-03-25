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
    const name     = data.name || data.username;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    // Avatar: photo takes priority, then initials
    const photoImg  = document.getElementById('profile-avatar-img');
    const initialsEl = document.getElementById('profile-avatar');

    if (data.avatar_url) {
        photoImg.src = data.avatar_url;
        photoImg.style.display = 'block';
        initialsEl.style.display = 'none';
    } else {
        initialsEl.textContent  = initials;
        initialsEl.style.display = 'flex';
        photoImg.style.display  = 'none';
    }

    // Also update sidebar avatar on this page if present
    document.getElementById('profile-name').textContent     = name;
    document.getElementById('profile-username').textContent = '@' + data.username;
    document.getElementById('badge-level').textContent      = data.level || 'Beginner';
    document.getElementById('badge-role').textContent       = data.role  || 'student';

    setVal('field-name',       data.name);
    setVal('field-email',      data.email);
    setVal('field-level',      data.level);
    setVal('field-focus',      data.focus);
    if (data.profile) {
        setVal('field-nickname',   data.profile.nickname);
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
        const convRes = await fetch(`${API}/chat/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const convs = convRes.ok ? await convRes.json() : [];
        document.getElementById('stat-conversations').textContent = convs.length;

        const userData = await fetch(`${API}/profile/`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (userData.ok) {
            const d = await userData.json();
            if (d.created_at) {
                const days = Math.floor((Date.now() - new Date(d.created_at)) / 86400000);
                document.getElementById('stat-days').textContent = days;
            }
        }
        document.getElementById('stat-messages').textContent = '—';
    } catch (e) { console.error('loadStats error', e); }
}

// ── Save profile ──────────────────────────────────────────────────
async function saveProfile() {
    const btn      = document.getElementById('btn-save');
    const feedback = document.getElementById('save-feedback');
    btn.disabled   = true;
    const labelSpan = btn.querySelector('span');
    if (labelSpan) labelSpan.textContent = t('profile.saving');

    const body = {
        name:       document.getElementById('field-name').value.trim()       || undefined,
        email:      document.getElementById('field-email').value.trim()      || undefined,
        level:      document.getElementById('field-level').value             || undefined,
        focus:      document.getElementById('field-focus').value             || undefined,
        nickname:   document.getElementById('field-nickname').value.trim()   || undefined,
        occupation: document.getElementById('field-occupation').value.trim() || undefined,
    };

    try {
        const res = await fetch(`${API}/profile/`, {
            method:  'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            showFeedback(feedback, t('profile.saved'), 'success');
            const updated = { ...userLocal, ...body };
            localStorage.setItem('user', JSON.stringify(updated));
            loadProfile();
        } else {
            showFeedback(feedback, data.detail || 'Erro ao salvar.', 'error');
        }
    } catch {
        showFeedback(feedback, 'Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
        if (labelSpan) labelSpan.textContent = t('profile.save');
    }
}

// ── Avatar upload ─────────────────────────────────────────────────
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('avatar-upload-status');
    statusEl.textContent = 'Enviando foto...';
    statusEl.className   = 'avatar-status uploading';
    statusEl.style.display = 'block';

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        const photoImg   = document.getElementById('profile-avatar-img');
        const initialsEl = document.getElementById('profile-avatar');
        photoImg.src = e.target.result;
        photoImg.style.display = 'block';
        initialsEl.style.display = 'none';
    };
    reader.readAsDataURL(file);

    // Upload to backend
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API}/profile/avatar`, {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}` },
            body:    formData
        });
        const data = await res.json();
        if (res.ok) {
            statusEl.textContent = '✓ Foto atualizada!';
            statusEl.className   = 'avatar-status success';
            // Update cached user
            const updated = { ...JSON.parse(localStorage.getItem('user') || '{}'), avatar_url: data.avatar_url };
            localStorage.setItem('user', JSON.stringify(updated));
        } else {
            statusEl.textContent = data.detail || 'Erro ao enviar foto.';
            statusEl.className   = 'avatar-status error';
        }
    } catch {
        statusEl.textContent = 'Erro de conexão.';
        statusEl.className   = 'avatar-status error';
    } finally {
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
        // Reset input so same file can be re-selected
        event.target.value = '';
    }
}

// ── Password eye toggle ───────────────────────────────────────────
function togglePwVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
        input.type    = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        input.type    = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}

// ── Change password ───────────────────────────────────────────────
async function changePassword() {
    const btn      = document.getElementById('btn-pw');
    const feedback = document.getElementById('pw-feedback');
    const current  = document.getElementById('field-current-pw').value;
    const newPw    = document.getElementById('field-new-pw').value;

    if (!current || !newPw) {
        showFeedback(feedback, 'Preencha os dois campos.', 'error'); return;
    }
    if (newPw.length < 6) {
        showFeedback(feedback, 'A nova senha deve ter pelo menos 6 caracteres.', 'error'); return;
    }

    btn.disabled = true;
    try {
        const res = await fetch(`${API}/auth/password`, {
            method:  'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ current_password: current, new_password: newPw })
        });
        const data = await res.json();
        if (res.ok) {
            showFeedback(feedback, 'Senha atualizada com sucesso! ✓', 'success');
            document.getElementById('field-current-pw').value = '';
            document.getElementById('field-new-pw').value     = '';
        } else {
            showFeedback(feedback, data.detail || 'Erro ao atualizar senha.', 'error');
        }
    } catch {
        showFeedback(feedback, 'Erro de conexão.', 'error');
    } finally {
        btn.disabled = false;
    }
}

// ── Helpers ───────────────────────────────────────────────────────
function showFeedback(el, msg, type) {
    el.textContent  = msg;
    el.className    = 'save-feedback show ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('show'); }, 4000);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}