if (!requireAuth()) throw new Error('Unauthenticated');

window.addEventListener('DOMContentLoaded', () => {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = (localStorage.getItem('theme') || 'dark') === 'dark' ? '☀️' : '🌙';
  _loadProfile();
  _loadStats();
});

// ── Profile ───────────────────────────────────────────────────────────────────

async function _loadProfile() {
  try {
    const data = await apiGet('/profile/');
    _populateProfile(data);
    const current = getUser() || {};
    saveSession(getToken(), { ...current, name: data.name, level: data.level, role: data.role, avatar_url: data.avatar_url || null });
  } catch (e) { console.error(e); }
}

function _populateProfile(data) {
  const name     = data.name || data.username;
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  const photoImg   = document.getElementById('profile-avatar-img');
  const initialsEl = document.getElementById('profile-avatar');

  if (data.avatar_url) {
    photoImg.src          = data.avatar_url;
    photoImg.style.display   = 'block';
    initialsEl.style.display = 'none';
  } else {
    initialsEl.textContent   = initials;
    initialsEl.style.display = 'flex';
    photoImg.style.display   = 'none';
  }

  _setVal('profile-name',     name);
  _setVal('profile-username', '@' + data.username, 'textContent');
  _setVal('badge-level',      data.level || 'Beginner', 'textContent');
  _setVal('badge-role',       data.role  || 'student',  'textContent');

  _setField('field-name',       data.name);
  _setField('field-email',      data.email);
  _setField('field-level',      data.level);
  _setField('field-focus',      data.focus);
  _setField('field-nickname',   data.profile?.nickname);
  _setField('field-occupation', data.profile?.occupation);
}

function _setVal(id, val, prop = 'textContent') {
  const el = document.getElementById(id);
  if (el && val != null) el[prop] = val;
}

function _setField(id, val) {
  const el = document.getElementById(id);
  if (el && val != null) el.value = val;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function _loadStats() {
  try {
    const convs = await apiGet('/chat/conversations');
    _setVal('stat-conversations', convs.length, 'textContent');

    const data = await apiGet('/profile/');
    if (data.created_at) {
      const days = Math.floor((Date.now() - new Date(data.created_at)) / 86400000);
      _setVal('stat-days', days, 'textContent');
    }
    _setVal('stat-messages', '—', 'textContent');
  } catch (e) { console.error(e); }
}

// ── Save all ──────────────────────────────────────────────────────────────────

async function saveAll() {
  const btn       = document.getElementById('btn-save');
  const feedback  = document.getElementById('save-feedback');
  const labelSpan = btn?.querySelector('span');
  if (btn) btn.disabled = true;
  if (labelSpan) labelSpan.textContent = t('profile.saving');

  let profileOk = false;
  let pwOk      = true;

  // Save profile
  const body = {
    name:       document.getElementById('field-name')?.value.trim()       || undefined,
    email:      document.getElementById('field-email')?.value.trim()      || undefined,
    level:      document.getElementById('field-level')?.value             || undefined,
    focus:      document.getElementById('field-focus')?.value             || undefined,
    nickname:   document.getElementById('field-nickname')?.value.trim()   || undefined,
    occupation: document.getElementById('field-occupation')?.value.trim() || undefined,
  };

  try {
    const { ok, data } = await apiPut('/profile/', body);
    if (ok) {
      profileOk = true;
      const current = getUser() || {};
      saveSession(getToken(), { ...current, ...body });
    } else {
      _showFeedback(feedback, data.detail || 'Erro ao salvar perfil.', 'error');
    }
  } catch { _showFeedback(feedback, 'Erro de conexão.', 'error'); }

  // Change password (if filled)
  const currentPw = document.getElementById('field-current-pw')?.value;
  const newPw     = document.getElementById('field-new-pw')?.value;

  if (currentPw || newPw) {
    pwOk = false;
    if (!currentPw || !newPw) {
      _showFeedback(feedback, 'Para alterar a senha, preencha os dois campos.', 'error');
    } else if (newPw.length < 6) {
      _showFeedback(feedback, 'A nova senha deve ter pelo menos 6 caracteres.', 'error');
    } else {
      try {
        const { ok, data } = await apiPut('/auth/password', { current_password: currentPw, new_password: newPw });
        if (ok) {
          pwOk = true;
          if (document.getElementById('field-current-pw')) document.getElementById('field-current-pw').value = '';
          if (document.getElementById('field-new-pw'))     document.getElementById('field-new-pw').value     = '';
        } else {
          _showFeedback(feedback, data.detail || 'Erro ao atualizar senha.', 'error');
        }
      } catch { _showFeedback(feedback, 'Erro de conexão ao atualizar senha.', 'error'); }
    }
  }

  if (profileOk && pwOk) {
    _showFeedback(feedback, t('profile.saved'), 'success');
    _loadProfile();
  }

  if (btn) btn.disabled = false;
  if (labelSpan) labelSpan.textContent = t('profile.save');
}

// ── Avatar upload ─────────────────────────────────────────────────────────────

async function handleAvatarUpload(event) {
  const file     = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('avatar-upload-status');
  statusEl.textContent    = 'Enviando foto...';
  statusEl.className      = 'avatar-status uploading';
  statusEl.style.display  = 'block';

  // Preview imediato
  const reader = new FileReader();
  reader.onload = e => {
    const photoImg   = document.getElementById('profile-avatar-img');
    const initialsEl = document.getElementById('profile-avatar');
    photoImg.src          = e.target.result;
    photoImg.style.display   = 'block';
    initialsEl.style.display = 'none';
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const { ok, data } = await apiUpload('/profile/avatar', formData);
    if (ok) {
      statusEl.textContent = '✓ Foto atualizada!';
      statusEl.className   = 'avatar-status success';
      const current = getUser() || {};
      saveSession(getToken(), { ...current, avatar_url: data.avatar_url });
      _loadProfile();
    } else {
      statusEl.textContent = data.detail || 'Erro ao enviar foto.';
      statusEl.className   = 'avatar-status error';
    }
  } catch {
    statusEl.textContent = 'Erro de conexão.';
    statusEl.className   = 'avatar-status error';
  } finally {
    setTimeout(() => { statusEl.style.display = 'none'; }, 3500);
    event.target.value = '';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _showFeedback(el, msg, type) {
  el.textContent   = msg;
  el.className     = `save-feedback show ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; el.classList.remove('show'); }, 4000);
}

function togglePwVisibility(inputId, btn) { togglePw(inputId, btn); }
function logout() { authLogout(); }