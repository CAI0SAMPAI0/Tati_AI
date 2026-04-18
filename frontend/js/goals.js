if (!requireAuth()) throw new Error('Unauthenticated');

let goalsData = { goals: [] };

window.addEventListener('DOMContentLoaded', () => {
    loadTopbarUser();
    loadGoals();
});

async function loadTopbarUser() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const avatarEl = document.getElementById('topbar-avatar');
    const usernameEl = document.getElementById('topbar-username');
    
    if (avatarEl) {
        if (user.profile?.avatar_url) {
            avatarEl.innerHTML = `<img src="${user.profile.avatar_url}" alt="">`;
        } else {
            avatarEl.textContent = (user.name || user.username || '?').slice(0, 2).toUpperCase();
        }
    }
    if (usernameEl) {
        usernameEl.textContent = user.name || user.username || '...';
    }
}

async function loadGoals() {
    try {
        goalsData = await apiGet('/users/goals');
        renderGoals();
        updateSummary();
    } catch (e) {
        console.error('Erro ao carregar metas:', e);
    }
}

function updateSummary() {
    const goals = goalsData.goals || [];
    const active = goals.filter(g => !g.achieved).length;
    const achieved = goals.filter(g => g.achieved).length;
    
    document.getElementById('goals-total').textContent = active;
    document.getElementById('goals-achieved').textContent = achieved;
    document.getElementById('goals-streak').textContent = '0'; // Será integrado com streaks
}

function renderGoals() {
    const container = document.getElementById('goals-list');
    if (!container) return;
    
    const goals = goalsData.goals || [];
    
    if (goals.length === 0) {
        container.innerHTML = `
            <div class="goals-empty">
                <i class="fa-solid fa-bullseye"></i>
                <p data-i18n="goals.empty_text">Nenhuma meta definida. Crie sua primeira meta!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = goals.map(goal => `
        <div class="goal-card ${goal.achieved ? 'achieved' : ''}">
            <div class="goal-header">
                <span class="goal-icon">${getGoalIcon(goal.type)}</span>
                <span class="goal-title">${getGoalTitle(goal.type)}</span>
                <div class="goal-status">
                    ${goal.achieved ? '<span style="color: #10b981;">✓</span>' : ''}
                    <button class="btn-delete-goal" onclick="deleteGoal('${goal.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="goal-progress-bar">
                <div class="goal-progress-fill" style="width: ${getProgressPercent(goal)}%"></div>
            </div>
            <div class="goal-stats">
                <span><span class="current">${goal.current || 0}</span> / ${goal.target}</span>
                <span>${getPeriodLabel(goal.period)}</span>
            </div>
        </div>
    `).join('');
}

function getProgressPercent(goal) {
    if (!goal.target || goal.target === 0) return 0;
    return Math.min(100, ((goal.current || 0) / goal.target) * 100);
}

function getGoalIcon(type) {
    const icons = {
        daily_minutes: '⏱️',
        daily_messages: '💬',
        weekly_conversations: '📚',
        weekly_words: '🔤'
    };
    return icons[type] || '🎯';
}

function getGoalTitle(type) {
    const titles = {
        daily_minutes: 'Minutos por dia',
        daily_messages: 'Mensagens por dia',
        weekly_conversations: 'Conversas por semana',
        weekly_words: 'Palavras novas por semana'
    };
    return titles[type] || 'Meta';
}

function getPeriodLabel(period) {
    return period === 'daily' ? '📅 Diário' : '📆 Semanal';
}

function showAddGoalModal() {
    document.getElementById('goal-modal').style.display = 'flex';
}

function hideAddGoalModal() {
    document.getElementById('goal-modal').style.display = 'none';
}

async function createGoal() {
    const type = document.getElementById('goal-type').value;
    const target = parseInt(document.getElementById('goal-target').value);
    const period = document.getElementById('goal-period').value;
    
    if (!target || target < 1) {
        showToast('Por favor, insira uma quantidade válida.', 'warning');
        return;
    }
    
    try {
        await apiPost('/users/goals', { type, target, period });
        hideAddGoalModal();
        loadGoals();
    } catch (e) {
        console.error('Erro ao criar meta:', e);
        showToast('Erro ao criar meta. Tente novamente.', 'error');
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
    
    try {
        await apiDelete(`/users/goals/${goalId}`);
        loadGoals();
    } catch (e) {
        console.error('Erro ao excluir meta:', e);
    }
}
