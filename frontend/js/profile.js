if (!requireAuth()) throw new Error('Unauthenticated');

window.addEventListener('DOMContentLoaded', () => {
    _loadProfile();
    _loadStats();
    _loadSubscription();
    _loadPlanAction();
    loadUserData();
});

async function loadUserData() {
    const user = getUser();
    if (!user) return;
    
    try {
        const streakData = await apiGet('/users/streak');
        const streakEl = document.getElementById('streak-count-text');
        if (streakEl) streakEl.textContent = streakData.current_streak || 0;
        
        const trophyEl = document.getElementById('trophy-count-text');
        if (trophyEl) trophyEl.textContent = `${streakData.trophies_earned || 0}/50`;
        
        const displayName = user.name || user.username || (typeof t === 'function' ? t('act.user_fallback') : 'User');
        const headerNameEl = document.getElementById('header-user-name');
        if (headerNameEl) headerNameEl.textContent = displayName;

        const avatarImg = document.getElementById('header-user-avatar-img');
        const avatarFallback = document.getElementById('header-user-avatar');
        if (user.avatar_url && avatarImg) {
            avatarImg.src = user.avatar_url;
            avatarImg.style.display = 'block';
            if (avatarFallback) avatarFallback.style.display = 'none';
        } else if (avatarFallback) {
            avatarFallback.textContent = displayName.charAt(0).toUpperCase();
            avatarFallback.style.display = 'flex';
        }
    } catch (e) { }
}

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
    if (photoImg) {
      photoImg.src             = data.avatar_url;
      photoImg.style.display   = 'block';
    }
    if (initialsEl) initialsEl.style.display = 'none';
  } else {
    if (initialsEl) {
      initialsEl.textContent   = initials;
      initialsEl.style.display = 'flex';
    }
    if (photoImg) photoImg.style.display = 'none';
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
  let container = document.getElementById('subscription-section');
  if (!container) {
    container = document.createElement('section');
    container.id        = 'subscription-section';
    container.className = 'profile-section';

    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
      btnSave.parentElement.insertBefore(container, btnSave);
    } else {
      const sections = document.querySelector('.profile-sections');
      if (sections) sections.appendChild(container);
    }
  }

  container.innerHTML = `
    <h2 class="section-title">
      <i class="fa-solid fa-crown" style="color:#a78bfa;"></i>
      <span>${t('sub.assinatura')}</span>
    </h2>
    <div id="sub-content" style="font-size:0.88rem;color:var(--text-muted);">${t('gen.loading')}</div>
  `;

  try {
    const sub = await apiGet('/payments/status');
    const el  = document.getElementById('sub-content');
    if (!el) return;

    const user = getUser();
    const SPECIAL_USERNAMES = ["tati", "tati.ai", "admin", "Professora", "Tatiana", "programador", "Programador", "caio.sampaio", "professor"];
    const isSpecialByUsername = SPECIAL_USERNAMES.includes(user?.username) || user?.is_exempt;

    if (isSpecialByUsername) {
        el.innerHTML = `
          <div class="subscription-card">
            <div class="sub-header">
              <div class="sub-plan-label">${t('sub.plan_full')}</div>
              <span class="sub-status-badge" style="background:#4ade8022; color:#4ade80; border:1px solid #4ade8055;">
                ${t('sub.status_active')}
              </span>
            </div>
            <div class="sub-meta-row">
              <div class="sub-meta-item">
                <div class="sub-meta-label">${t('sub.vencimento')}</div>
                <div class="sub-meta-value">31/12/2099</div>
              </div>
              <div class="sub-meta-item">
                <div class="sub-meta-label">${t('sub.days_remaining')}</div>
                <div class="sub-meta-value">9999</div>
              </div>
            </div>
          </div>
        `;
        return;
    }

    if (!sub || !sub.has_subscription || sub.status === 'expired' || sub.status === 'cancelled') {
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
          <div>
            <div style="font-weight:600;color:var(--text);">${t('sub.no_active')}</div>
            <div style="font-size:0.82rem;margin-top:0.2rem;">${t('sub.no_active_desc')}</div>
          </div>
          <a href="payment.html" style="
            padding:0.55rem 1.1rem;
            background:linear-gradient(135deg,#a78bfa,#60a5fa);
            color:#fff;border:none;border-radius:8px;
            font-weight:700;font-size:0.85rem;
            text-decoration:none;white-space:nowrap;
          ">${t('sub.subscribe_now')}</a>
        </div>
      `;
      return;
    }

    const planLabel   = sub.plan_type === 'full' ? t('sub.plan_full') : t('sub.plan_basic');
    const statusLabel = _subStatusLabel(sub.status);
    const statusColor = sub.status === 'active' ? '#4ade80' : sub.status === 'grace' ? '#fbbf24' : '#f87171';
    const expiresDate = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString(I18n.getLang() === 'pt-BR' ? 'pt-BR' : 'en-US') : '—';

    // Hide actions for special users
    const isSpecialSub = sub.expires_at === '2099-12-31' || sub.days_left === 9999;
    const actionsHtml = isSpecialSub ? '' : `
        <div class="sub-actions">
          <a href="payment.html" class="sub-link">
            <i class="fa-solid fa-rotate"></i> ${t('sub.renew_change')}
          </a>
          <button type="button" class="btn-cancel-subscription" onclick="cancelSubscription()">
            <i class="fa-solid fa-ban"></i> ${t('sub.cancel_button')}
          </button>
        </div>
    `;

    el.innerHTML = `
      <div class="subscription-card">
        <div class="sub-header">
          <div class="sub-plan-label">${planLabel}</div>
          <span class="sub-status-badge" style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}55;">
            ${statusLabel}
          </span>
        </div>
        <div class="sub-meta-row">
          <div class="sub-meta-item">
            <div class="sub-meta-label">${t('sub.vencimento')}</div>
            <div class="sub-meta-value">${expiresDate}</div>
          </div>
          <div class="sub-meta-item">
            <div class="sub-meta-label">${t('sub.days_remaining')}</div>
            <div class="sub-meta-value">${sub.days_left ?? '—'}</div>
          </div>
        </div>
        ${actionsHtml}
      </div>
    `;
  } catch (e) {
    const el = document.getElementById('sub-content');
    if (el) el.textContent = t('sub.load_error');
    console.error(e);
  }
}

function _subStatusLabel(status) {
  const map = {
    active:    t('sub.status_active'),
    grace:     t('sub.status_grace'),
    pending:   t('sub.status_pending'),
    expired:   t('sub.status_expired'),
    cancelled: t('sub.status_cancelled'),
  };
  return map[status] || status;
}

async function _loadPlanAction() {
  const container = document.getElementById('profile-plan-action');
  if (!container) return;

  try {
    const sub = await apiGet('/payments/status');
    if (!sub || !sub.has_subscription || sub.status === 'expired' || sub.status === 'cancelled') {
      container.innerHTML = `
        <a href="payment.html" class="btn-save" style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; text-decoration: none;">
          <i class="fa-solid fa-crown"></i>
          <span>Upgrade to Premium</span>
        </a>
      `;
      return;
    }

    if (sub.status === 'active' || sub.status === 'grace') {
      if (sub.plan_type === 'basic') {
        container.innerHTML = `
          <a href="payment.html" class="btn-save" style="background: linear-gradient(135deg, #a78bfa, #60a5fa); color: #fff; text-decoration: none;">
            <i class="fa-solid fa-arrow-up-right-dots"></i>
            <span>Upgrade to Full</span>
          </a>
        `;
        return;
      }
      if (sub.plan_type === 'full') {
        container.innerHTML = '';
        return;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar ação do plano:', e);
  }
}

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
    if (photoImg) {
      photoImg.src             = e.target.result;
      photoImg.style.display   = 'block';
    }
    if (initialsEl) initialsEl.style.display = 'none';
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const { ok, data } = await apiUpload('/profile/avatar', formData);
    if (ok) {
      statusEl.textContent = 'âœ“ Foto atualizada!';
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

function _showFeedback(el, msg, type) {
  if (!el) return;
  el.textContent   = msg;
  el.className     = `save-feedback show ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; el.classList.remove('show'); }, 4000);
}

function togglePwVisibility(inputId, btn) { 
  if (typeof togglePw === 'function') {
    togglePw(inputId, btn); 
  } else {
    const input = document.getElementById(inputId);
    if (input) {
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) icon.className = isPw ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    }
  }
}

function logout() {
  if (typeof authLogout === 'function') {
    authLogout();
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  }
}

async function cancelSubscription() {
  if (!window._cancelSubscriptionConfirmUntil || Date.now() > window._cancelSubscriptionConfirmUntil) {
    window._cancelSubscriptionConfirmUntil = Date.now() + 5000;
    
    // Toastify instead of alert
    if (typeof Toastify === 'function') {
      Toastify({
        text: t('sub.cancel_confirm_toast') || 'Click again to confirm cancellation',
        duration: 5000,
        gravity: "top",
        position: "center",
        style: { background: "#fbbf24", color: "#000", borderRadius: "10px", fontWeight: "bold" }
      }).showToast();
    }
    return;
  }
  window._cancelSubscriptionConfirmUntil = 0;

  try {
    const { ok, data } = await apiPost('/payments/cancel', {});
    if (!ok) {
      showToast(data?.detail || t('sub.cancel_error'), 'error');
      return;
    }

    const current = getUser() || {};
    saveSession(getToken(), { ...current, plan_type: null, is_premium_active: false });

    showToast(t('sub.cancel_success'), 'success');
    await Promise.all([_loadSubscription(), _loadPlanAction(), _loadProfile()]);
  } catch (e) {
    showToast(t('sub.cancel_connection_error'), 'error');
  }
}

function startTour() {
    window.location.href = 'chat.html?tour=true';
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
}

function closeSidebarNav() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
}
