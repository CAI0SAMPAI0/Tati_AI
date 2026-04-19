if (!requireAuth()) throw new Error('Unauthenticated');

let activityChart = null;
let currentTab = 'weekly';

window.addEventListener('DOMContentLoaded', () => {
    loadTopbarUser();
    setupTabs();
    loadReport('weekly');
    loadXP();
    loadTrophies();
    loadRanking();
});

async function loadXP() {
    try {
        const data = await apiGet('/users/xp');
        if (data) {
            const levelEl = document.getElementById('xp-level');
            const valueEl = document.getElementById('xp-value');
            const barEl = document.getElementById('xp-bar-fill');
            
            if (levelEl) levelEl.textContent = `Nível ${data.level || 'A1'}`;
            if (valueEl) valueEl.textContent = `${data.xp || 0} / ${data.xp_to_next || 500} XP`;
            if (barEl) {
                const pct = Math.min(100, Math.round((data.xp / data.xp_to_next) * 100));
                barEl.style.width = `${pct}%`;
            }
        }
    } catch (e) { console.error('Erro ao carregar XP:', e); }
}

async function loadTrophies() {
    const grid = document.getElementById('trophies-grid');
    const countEl = document.getElementById('trophies-count');
    if (!grid) return;

    grid.innerHTML = '<div class="ranking-loading">Carregando conquistas...</div>';

    try {
        const data = await apiGet('/users/trophies/all');

        // Suporta dois formatos: { medals, earned, total } ou array direto
        let medals = [];
        let earned = 0;
        let total = 0;

        if (data && Array.isArray(data.medals)) {
            medals = data.medals;
            earned = data.earned || 0;
            total  = data.total  || medals.length;
        } else if (Array.isArray(data)) {
            // Formato antigo: array de troféus conquistados
            medals = data.map(t => ({
                name: t.title || t.name,
                description: t.description,
                icon: t.icon || '🏆',
                unlocked: true,
                progress: t.earned_at ? new Date(t.earned_at).toLocaleDateString('pt-BR') : 'Conquistado'
            }));
            earned = medals.length;
            total  = medals.length;
        }

        if (countEl) countEl.textContent = `${earned}/${total}`;

        if (!medals.length) {
            grid.innerHTML = '<div class="ranking-loading">Nenhuma conquista ainda. Continue estudando! 🎯</div>';
            return;
        }

        grid.innerHTML = medals.map(m => `
            <div class="trophy-item ${m.unlocked ? 'earned' : ''}" title="${m.description || ''}">
                <span class="trophy-icon">${m.icon || '🏆'}</span>
                <span class="trophy-name">${m.name || ''}</span>
                <span class="trophy-date">${m.unlocked
                    ? (m.progress || 'Conquistado')
                    : (m.progress || 'Bloqueado')}</span>
            </div>
        `).join('');

    } catch (e) {
        console.error('Erro ao carregar troféus:', e);
        grid.innerHTML = '<div class="ranking-loading">Erro ao carregar conquistas.</div>';
    }
}

async function loadRanking() {
    const list = document.getElementById('ranking-list');
    if (!list) return;
    
    try {
        const top15 = await apiGet('/users/ranking/top15');
        const myPos = await apiGet('/users/ranking/position').catch(() => null);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (Array.isArray(top15)) {
            list.innerHTML = top15.map((r, i) => {
                const isMe = r.username === currentUser.username;
                const initials = (r.name || r.username || '?').slice(0, 2).toUpperCase();
                
                return `
                    <div class="ranking-item ${isMe ? 'me' : ''} rank-${i + 1}">
                        <div class="rank-num">${i + 1}</div>
                        <div class="rank-avatar">${initials}</div>
                        <div class="rank-info">
                            <div class="rank-name">${r.name || r.username}</div>
                            <div class="rank-xp">${r.score} pts</div>
                        </div>
                        ${i < 3 ? `<div class="rank-medal">${['🥇','🥈','🥉'][i]}</div>` : ''}
                    </div>
                `;
            }).join('');
            
            // Se eu não estiver no top 15, mostrar minha posição no final
            const isInTop15 = top15.some(r => r.username === currentUser.username);
            if (!isInTop15 && myPos && myPos.position > 15) {
                list.innerHTML += `
                    <div class="ranking-divider" style="text-align:center; padding: 0.5rem; color: var(--text-muted);">...</div>
                    <div class="ranking-item me">
                        <div class="rank-num">${myPos.position}</div>
                        <div class="rank-avatar">${(currentUser.name || currentUser.username || '?').slice(0, 2).toUpperCase()}</div>
                        <div class="rank-info">
                            <div class="rank-name">${currentUser.name || currentUser.username} (Você)</div>
                            <div class="rank-xp">${myPos.score} pts</div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error('Erro ao carregar ranking:', e);
        list.innerHTML = '<div class="ranking-loading">Erro ao carregar ranking.</div>';
    }
}

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

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            loadReport(currentTab);
        });
    });
}

async function loadReport(period) {
    try {
        const endpoint = period === 'weekly' ? '/users/reports/weekly' : '/users/reports/monthly';
        const data = await apiGet(endpoint);
        
        if (!data) return;
        
        updateStats(data);
        renderChart(data);
        loadStreak();
        renderTips(data);
    } catch (e) {
        console.error('Erro ao carregar relatório:', e);
    }
}

function updateStats(data) {
    document.getElementById('stat-messages').textContent = data.total_messages || 0;
    document.getElementById('stat-conversations').textContent = data.total_conversations || 0;
    document.getElementById('stat-days').textContent = data.study_days || 0;
    document.getElementById('stat-words').textContent = data.unique_words_used || 0;
}

function renderChart(data) {
    const ctx = document.getElementById('activity-chart');
    if (!ctx) return;
    
    if (activityChart) {
        activityChart.destroy();
    }
    
    let labels, values, label;
    
    if (data.period === 'weekly') {
        labels = data.days_of_week;
        values = data.messages_by_day;
        label = 'Mensagens por dia';
    } else {
        labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
        values = data.messages_by_week;
        label = 'Mensagens por semana';
    }
    
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: 'rgba(124, 58, 237, 0.6)',
                borderColor: 'rgba(124, 58, 237, 1)',
                borderWidth: 2,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: 'var(--text-muted)' },
                    grid: { color: 'var(--border)' }
                },
                x: {
                    ticks: { color: 'var(--text-muted)' },
                    grid: { display: false }
                }
            }
        }
    });
}

async function loadStreak() {
    try {
        const streak = await apiGet('/users/streak');
        if (streak) {
            document.getElementById('streak-current').textContent = streak.current_streak || 0;
            document.getElementById('streak-longest').textContent = streak.longest_streak || 0;
        }
    } catch (e) {
        console.error('Erro ao carregar streak:', e);
    }
}

function renderTips(data) {
    const tipsList = document.getElementById('tips-list');
    if (!tipsList) return;
    
    const tips = [];
    
    if (data.total_messages < 5) {
        tips.push({ icon: '💬', text: 'Pratique mais! Tente enviar pelo menos 5 mensagens por semana.' });
    }
    if (data.study_days < 3) {
        tips.push({ icon: '📅', text: 'Estude em dias diferentes para manter seu streak ativo.' });
    }
    if (data.unique_words_used < 50) {
        tips.push({ icon: '🔤', text: 'Tente usar palavras novas para expandir seu vocabulário.' });
    }
    if ((data.current_streak || 0) > 0) {
        tips.push({ icon: '🔥', text: `Seu streak está em ${data.current_streak} dias! Continue assim!` });
    }
    
    tips.push({ icon: '🎯', text: 'Defina metas diárias de estudo para manter a consistência.' });
    tips.push({ icon: '🎙️', text: 'Use o Modo Voz para praticar pronúncia e fluência.' });
    
    tipsList.innerHTML = tips.map(tip => `
        <li>
            <span class="tip-icon">${tip.icon}</span>
            <span class="tip-text">${tip.text}</span>
        </li>
    `).join('');
}
