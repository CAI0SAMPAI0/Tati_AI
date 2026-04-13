if (!requireAuth()) throw new Error('Unauthenticated');

window.addEventListener('DOMContentLoaded', () => {
    _loadProfile();
    _loadStats();
    _loadSubscription();
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
    photoImg.src             = data.avatar_url;
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

// ── Subscription card ─────────────────────────────────────────────────────────

async function _loadSubscription() {
  // Injeta o card antes da danger zone se ainda não existir
  let container = document.getElementById('subscription-section');
  if (!container) {
    container = document.createElement('section');
    container.id        = 'subscription-section';
    container.className = 'profile-section';

    // Insere antes do botão salvar
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
      btnSave.parentElement.insertBefore(container, btnSave);
    } else {
      document.querySelector('.profile-sections')?.appendChild(container);
    }
  }

  container.innerHTML = `
    <h2 class="section-title">
      <i class="fa-solid fa-crown" style="color:#a78bfa;"></i>
      <span>Assinatura</span>
    </h2>
    <div id="sub-content" style="font-size:0.88rem;color:var(--text-muted);">Carregando...</div>
  `;

  try {
    const sub = await apiGet('/payments/status');
    const el  = document.getElementById('sub-content');
    if (!el) return;

    if (!sub || !sub.has_subscription || sub.status === 'expired' || sub.status === 'cancelled') {
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
          <div>
            <div style="font-weight:600;color:var(--text);">Sem assinatura ativa</div>
            <div style="font-size:0.82rem;margin-top:0.2rem;">Assine um plano para ter acesso completo.</div>
          </div>
          <a href="payment.html" style="
            padding:0.55rem 1.1rem;
            background:linear-gradient(135deg,#a78bfa,#60a5fa);
            color:#fff;border:none;border-radius:8px;
            font-weight:700;font-size:0.85rem;
            text-decoration:none;white-space:nowrap;
          ">Assinar agora</a>
        </div>
      `;
      return;
    }

    const planLabel   = sub.plan_type === 'full' ? '👑 Plano Completo' : '💬 Chat & Voice';
    const statusLabel = _subStatusLabel(sub.status);
    const statusColor = sub.status === 'active' ? '#4ade80' : sub.status === 'grace' ? '#fbbf24' : '#f87171';
    const expiresDate = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('pt-BR') : '—';

    el.innerHTML = `
      <div style="
        background:rgba(167,139,250,0.06);
        border:1px solid rgba(167,139,250,0.2);
        border-radius:12px;padding:1rem 1.25rem;
        display:flex;flex-direction:column;gap:0.75rem;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
          <div style="font-size:1rem;font-weight:700;color:var(--text);">${planLabel}</div>
          <span style="
            background:${statusColor}22;
            color:${statusColor};
            border:1px solid ${statusColor}55;
            border-radius:99px;padding:0.2rem 0.75rem;
            font-size:0.75rem;font-weight:700;
          ">${statusLabel}</span>
        </div>
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
          <div>
            <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:0.2rem;">Vencimento</div>
            <div style="font-weight:600;color:var(--text);">${expiresDate}</div>
          </div>
          <div>
            <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:0.2rem;">Dias restantes</div>
            <div style="font-weight:600;color:var(--text);">${sub.days_left ?? '—'}</div>
          </div>
        </div>
        <a href="payment.html" style="
          display:inline-flex;align-items:center;gap:0.4rem;
          font-size:0.82rem;color:#a78bfa;text-decoration:none;font-weight:600;
        "><i class="fa-solid fa-rotate"></i> Renovar / Trocar plano</a>
      </div>
    `;
  } catch (e) {
    const el = document.getElementById('sub-content');
    if (el) el.textContent = 'Erro ao carregar assinatura.';
    console.error(e);
  }
}

function _subStatusLabel(status) {
  const map = {
    active:    '✓ Ativa',
    grace:     '⚠️ Em atraso',
    pending:   '⏳ Pendente',
    expired:   '✗ Expirada',
    cancelled: '✗ Cancelada',
  };
  return map[status] || status;
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
          document.getElementById('field-current-pw').value = '';
          document.getElementById('field-new-pw').value     = '';
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
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('avatar-upload-status');
  statusEl.textContent   = 'Enviando foto...';
  statusEl.className     = 'avatar-status uploading';
  statusEl.style.display = 'block';

  const reader = new FileReader();
  reader.onload = e => {
    const photoImg   = document.getElementById('profile-avatar-img');
    const initialsEl = document.getElementById('profile-avatar');
    photoImg.src             = e.target.result;
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