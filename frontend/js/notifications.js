/* notifications.js — Lógica para notificações e feedback */

let _notifOpen = false;

// Ícones mapeados por tipo de notificação
const NOTIF_ICONS = {
    correction:   { emoji: '✏️', cls: 'correction' },
    new_activity: { emoji: '📚', cls: 'new_activity' },
    reminder:     { emoji: '⏰', cls: 'reminder' },
    ranking:      { emoji: '🏆', cls: 'ranking' },
    streak:       { emoji: '🔥', cls: 'streak' },
    welcome:      { emoji: '👋', cls: 'new_activity' },
};

function toggleNotifPanel(e) {
    if (e) e.stopPropagation();
    _notifOpen = !_notifOpen;
    const panel = document.getElementById('notif-panel');
    if (!panel) return;

    if (_notifOpen) {
        panel.classList.add('open');
        loadNotifications();
    } else {
        panel.classList.remove('open');
    }
}

// Fechar ao clicar fora
document.addEventListener('click', function(e) {
    const wrapper = document.getElementById('notif-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('notif-panel')?.classList.remove('open');
        _notifOpen = false;
    }
});

function _timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('act.notif_time_now');
    if (m < 60) return t('act.notif_time_min', m);
    const h = Math.floor(m / 60);
    if (h < 24) return t('act.notif_time_hour', h);
    return new Date(dateStr).toLocaleDateString(I18n.getLang());
}

async function loadNotifications() {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');

    try {
        const data = await apiGet('/notifications/');

        // Atualiza Badge
        if (badge) {
            const count = data.unread || 0;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        }

        if (!list) return;

        const notifs = data.notifications || [];
        if (notifs.length === 0) {
            list.innerHTML = `
                <div class="notif-empty">
                    <i class="fa-regular fa-bell-slash"></i>
                    <span data-i18n="act.notif_empty">${t('act.notif_empty')}</span>
                </div>`;
            return;
        }

        list.innerHTML = notifs.map(n => {
            const info = NOTIF_ICONS[n.type] || { emoji: '🔔', cls: '' };
            const notifTitle = t(n.title) !== n.title ? t(n.title) : n.title;
            const notifMsg = t(n.message) !== n.message ? t(n.message) : n.message;
            return `
            <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}', this)" data-id="${n.id}">
                <div class="notif-icon-wrap ${info.cls}">${info.emoji}</div>
                <div class="notif-body">
                    <p class="notif-body-title">${escHtml(notifTitle)}</p>
                    <p class="notif-body-msg">${escHtml(notifMsg)}</p>
                    <span class="notif-body-time">${_timeAgo(n.created_at)}</span>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('Erro ao carregar notificações:', e);
        if (list) list.innerHTML = `<div class="notif-empty">${t('act.notif_error')}</div>`;
    }
}

async function markNotifRead(id, el) {
    if (!el.classList.contains('unread')) return;
    try {
        await apiPost(`/notifications/${id}/read`, {});
        el.classList.remove('unread');
        // Atualiza badge localmente
        const badge = document.getElementById('notif-badge');
        if (badge) {
            const current = parseInt(badge.textContent) || 0;
            const newCount = Math.max(0, current - 1);
            if (newCount === 0) {
                badge.classList.remove('visible');
            } else {
                badge.textContent = newCount;
            }
        }
    } catch(e) { console.error(e); }
}

async function markAllRead(e) {
    if (e) e.stopPropagation();
    try {
        await apiPost('/notifications/read-all', {});
        document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
        const badge = document.getElementById('notif-badge');
        if (badge) badge.classList.remove('visible');
    } catch(e) { console.error(e); }
}

function escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/* ── FEEDBACK MODAL LOGIC ── */

function openFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) modal.classList.add('active');
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) modal.classList.remove('active');
}

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const type = document.querySelector('input[name="fb-type"]:checked')?.value;
    const title = document.getElementById('fb-title')?.value;
    const description = document.getElementById('fb-desc')?.value;

    if (!title || !description) {
        return showToast(t('act.fb_fill_all') || 'Preencha todos os campos.', 'error');
    }

    try {
        const { ok } = await apiPost('/notifications/feedback', { type, title, description });
        if (ok) {
            showToast(t('act.fb_success') || 'Feedback enviado com sucesso!', 'success');
            closeFeedbackModal();
            e.target.reset();
        } else {
            showToast(t('act.fb_error') || 'Erro ao enviar.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast(t('act.fb_conn_error') || 'Erro de conexão.', 'error');
    }
}

// Carregar notificações ao iniciar (apenas o badge)
window.addEventListener('DOMContentLoaded', () => {
    loadNotifications();
    // Refresh a cada 5 minutos
    setInterval(loadNotifications, 5 * 60 * 1000);
    
    // Usa o mesmo Service Worker do PWA para evitar registros duplicados.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration('/')
            .then(registration => {
                if (registration) {
                    requestNotificationPermission();
                    return;
                }
                return navigator.serviceWorker.register('/sw.js')
                    .then(() => requestNotificationPermission());
            })
            .catch(err => console.error('Falha ao registrar Service Worker:', err));
    }
});

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Permissão de notificação concedida!');
            }
        });
    }
}
