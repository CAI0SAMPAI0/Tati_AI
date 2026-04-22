/* profile_activities.js — Tati AI Activities (Progress, Settings) */

if (!requireAuth()) throw new Error('Unauthenticated');

let activityChart = null;

window.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    
    await loadInitialData();
    
    if (tab) {
        switchActivityTab(tab);
    }
});

async function loadInitialData() {
    try {
        await Promise.all([
            loadUserData(),
            _loadProgressTab(),
            _loadProfileData(),
            _loadPlanAction()
        ]);
        I18n.applyToDOM();
    } catch (e) { console.error('Erro carregando dados:', e); }
}

async function loadUserData() {
    const user = getUser();
    if (!user) return;
    const displayName = user.name || user.username || t('act.user_fallback');
    document.getElementById('header-user-name').textContent = displayName;

    const avatarImg = document.getElementById('header-user-avatar-img');
    const avatarFallback = document.getElementById('header-user-avatar');
    
    const setAvatars = (url) => {
        const heroImg = document.getElementById('profile-avatar-img');
        const heroFallback = document.getElementById('profile-avatar');
        
        [avatarImg, heroImg].forEach(img => {
            if (img) {
                img.src = url;
                img.style.display = 'block';
            }
        });
        [avatarFallback, heroFallback].forEach(fb => {
            if (fb) fb.style.display = 'none';
        });
    };

    if (user.avatar_url) {
        setAvatars(user.avatar_url);
    } else {
        const initials = displayName.charAt(0).toUpperCase();
        if (avatarFallback) avatarFallback.textContent = initials;
        document.getElementById('profile-avatar').textContent = initials;
    }

    try {
        const streakData = await apiGet('/users/streak');
        document.getElementById('streak-count-text').textContent = streakData.current_streak || 0;
        document.getElementById('trophy-count-text').textContent = `${streakData.trophies_earned || 0}/50`;
    } catch (e) { }
}

function switchActivityTab(tabName) {
    document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById(`tab-content-${tabName}`);
    if (target) target.classList.add('active');
    
    const btns = document.querySelectorAll('.sub-tabs .tab-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('onclick')?.includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    if (tabName === 'progress' && !document.getElementById('profile-progress-container').dataset.loaded) {
        _loadProgressTab();
    } else if (tabName === 'settings') {
        _loadProfileData();
    }
}

// ── SETTINGS LOGIC ──────────────────────────────────────────────────────────

async function _loadProfileData() {
    try {
        const data = await apiGet('/profile/');
        document.getElementById('profile-display-name').textContent = data.name || data.username;
        document.getElementById('profile-display-username').textContent = '@' + data.username;
        
        _setField('field-name', data.name);
        _setField('field-email', data.email);
        _setField('field-level', data.level);
        _setField('field-focus', data.focus);
        _setField('field-nickname', data.profile?.nickname);
        _setField('field-occupation', data.profile?.occupation);
        
        document.getElementById('badge-level').textContent = data.level || 'Beginner';
        document.getElementById('badge-role').textContent = data.role || 'Student';

    } catch (e) { console.error(e); }
}

async function saveAllSettings() {
    const btn = document.getElementById('btn-save');
    if (btn) btn.disabled = true;

    const body = {
        name: document.getElementById('field-name')?.value.trim(),
        email: document.getElementById('field-email')?.value.trim(),
        level: document.getElementById('field-level')?.value,
        focus: document.getElementById('field-focus')?.value,
        nickname: document.getElementById('field-nickname')?.value.trim(),
        occupation: document.getElementById('field-occupation')?.value.trim(),
    };

    try {
        const res = await apiPut('/profile/', body);
        if (res.ok) {
            showToast('Perfil atualizado!', 'success');
            _loadProfileData();
            loadUserData();
        } else {
            showToast(res.data?.detail || 'Erro ao salvar.', 'error');
        }
    } catch (e) { showToast('Erro de conexão.', 'error'); }
    
    if (btn) btn.disabled = false;
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast('Enviando foto...', 'info');
        const { ok, data } = await apiUpload('/profile/avatar', formData);
        if (ok) {
            showToast('Foto atualizada!', 'success');
            const current = getUser() || {};
            saveSession(getToken(), { ...current, avatar_url: data.avatar_url });
            loadUserData();
            _loadProfileData();
        }
    } catch (e) { showToast('Erro no upload.', 'error'); }
}

async function _loadPlanAction() {
    const container = document.getElementById('profile-plan-action');
    if (!container) return;
    try {
        const sub = await apiGet('/payments/status');
        if (!sub || !sub.has_subscription || sub.status === 'expired') {
            container.innerHTML = `<button class="btn-save" style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;" onclick="window.location.href='payment.html'"><i class="fa-solid fa-crown"></i> Upgrade</button>`;
        }
    } catch (e) { }
}

function _setField(id, val) { const el = document.getElementById(id); if (el && val != null) el.value = val; }

// ── PROGRESS TAB ─────────────────────────────────────────────────────────────

async function _loadProgressTab() {
    const container = document.getElementById('profile-progress-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="stats-summary">
            <div class="stat-box"><span class="stat-label" data-i18n="profile.msgs">Mensagens</span><span class="stat-value" id="stat-messages">—</span></div>
            <div class="stat-box"><span class="stat-label" data-i18n="profile.convs">Conversas</span><span class="stat-value" id="stat-conversations">—</span></div>
            <div class="stat-box"><span class="stat-label" data-i18n="profile.days">Dias ativo</span><span class="stat-value" id="stat-days">—</span></div>
            <div class="stat-box"><span class="stat-label" data-i18n="profile.words">Palavras</span><span class="stat-value" id="stat-words">—</span></div>
        </div>
        <div class="chart-section">
            <div class="chart-header">
                <h3 data-i18n="progress.activity_title">Atividade de Estudo</h3>
                <div class="chart-tabs">
                    <button class="chart-tab-btn active" onclick="loadStatsPeriod('weekly', this)" data-i18n="progress.weekly">Semana</button>
                    <button class="chart-tab-btn" onclick="loadStatsPeriod('monthly', this)" data-i18n="progress.monthly">Mês</button>
                </div>
            </div>
            <div class="chart-wrapper"><canvas id="activity-chart"></canvas></div>
        </div>
    `;
    
    await loadStatsPeriod('weekly');
    container.dataset.loaded = "true";
    I18n.applyToDOM(container);
}

// ── CACHE & UI HELPERS ──────────────────────────────────────────────────────
const statsCache = {};

async function loadStatsPeriod(period, btn) {
    if (btn) {
        document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    if (statsCache[period]) {
        updateStatsUI(statsCache[period]);
        _renderChart(statsCache[period]);
        return;
    }

    try {
        const data = await apiGet(period === 'weekly' ? '/users/reports/weekly' : '/users/reports/monthly');
        statsCache[period] = data;
        updateStatsUI(data);
        _renderChart(data);
    } catch (e) { console.error(e); }
}

function updateStatsUI(data) {
    document.getElementById('stat-messages').textContent = data.total_messages || 0;
    document.getElementById('stat-conversations').textContent = data.total_conversations || 0;
    document.getElementById('stat-days').textContent = data.study_days || 0;
    document.getElementById('stat-words').textContent = data.unique_words_used || 0;
}

function _renderChart(data) {
    const ctx = document.getElementById('activity-chart');
    if (!ctx || typeof Chart === 'undefined') return;

    const labels = data.period === 'weekly' ? (data.days_of_week || ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) : ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
    const values = data.period === 'weekly' ? (data.messages_by_day || [0,0,0,0,0,0,0]) : (data.messages_by_week || [0,0,0,0]);

    if (activityChart) {
        activityChart.data.labels = labels;
        activityChart.data.datasets[0].data = values;
        activityChart.update(); 
    } else {
        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Mensagens',
                    data: values,
                    backgroundColor: '#7c3aed',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1000, easing: 'easeOutQuart' },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// ── UI HELPERS ───────────────────────────────────────────────────────────────
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mainContent = document.querySelector('.main-content');
    if (sidebar) { sidebar.classList.add('open'); sidebar.classList.remove('closed'); }
    if (overlay) overlay.classList.add('visible');
    if (mainContent) mainContent.classList.remove('expanded');
}

function closeSidebarNav() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mainContent = document.querySelector('.main-content');
    if (sidebar) { sidebar.classList.remove('open'); sidebar.classList.add('closed'); }
    if (overlay) overlay.classList.remove('visible');
    if (mainContent) mainContent.classList.add('expanded');
}

function openFeedbackModal() { document.getElementById('feedback-modal')?.classList.add('active'); }
function closeFeedbackModal() { document.getElementById('feedback-modal')?.classList.remove('active'); }

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('fb-title')?.value;
    const desc = document.getElementById('fb-desc')?.value;
    try {
        await apiPost('/validation/feedback', { type: 'suggestion', title, description: desc });
        showToast('Feedback enviado!', 'success');
        closeFeedbackModal();
    } catch (e) { showToast('Erro ao enviar.', 'error'); }
}

function escHtml(str) { const div = document.createElement('div'); div.textContent = str || ''; return div.innerHTML; }
