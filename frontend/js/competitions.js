/* competitions.js — Tati AI Competitions */

window.addEventListener('DOMContentLoaded', async () => {
    setRankingMonth();
    await loadInitialData();
});

async function loadInitialData() {
    try {
        await Promise.all([
            loadUserData(),
            loadRanking(),
            loadWinners()
        ]);
        startCountdown();
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
    if (user.avatar_url && avatarImg) {
        avatarImg.src = user.avatar_url;
        avatarImg.style.display = 'block';
        if (avatarFallback) avatarFallback.style.display = 'none';
    } else if (avatarFallback) {
        avatarFallback.textContent = displayName.charAt(0).toUpperCase();
        avatarFallback.style.display = 'flex';
    }

    try {
        const streakData = await apiGet('/users/streak');
        document.getElementById('streak-count-text').textContent = streakData.current_streak || 0;
        document.getElementById('trophy-count-text').textContent = `${streakData.trophies_earned || 0}/50`;
    } catch (e) { }
}

async function loadRanking() {
    try {
        const data = await apiGet('/users/ranking/top15');
        const tbody = document.getElementById('ranking-body');
        if (!tbody) return;
        const user = getUser();
        tbody.innerHTML = data.map((entry, i) => `
            <tr class="${entry.username === user?.username ? 'current-user' : ''}">
                <td class="rank-pos">${i + 1}</td>
                <td class="rank-name">${entry.name || entry.username}</td>
                <td class="rank-score">${entry.score} pts</td>
                <td class="rank-stat">${entry.messages || 0}</td>
                <td class="rank-stat">${entry.quizzes || 0}</td>
                <td class="rank-stat">${entry.flashcards || 0}</td>
                <td class="rank-stat">${entry.exercises || 0}</td>
            </tr>
        `).join('');

        const pos = await apiGet('/users/ranking/position');
        document.getElementById('user-rank').textContent = `#${pos.position || '—'}`;
        document.getElementById('user-rank-name').textContent = pos.name || '...';
        document.getElementById('user-rank-score').textContent = `${pos.score || 0} pontos`;
        document.getElementById('user-msgs').textContent = pos.messages || 0;
        document.getElementById('user-quizzes').textContent = pos.quizzes || 0;
        document.getElementById('user-flashcards').textContent = pos.flashcards || 0;
        document.getElementById('user-exercises').textContent = pos.exercises || 0;

        const now = new Date();
        document.getElementById('top15-month').textContent = `${now.getMonth() + 1}/${now.getFullYear()}`;

    } catch (e) { console.error(e); }
}

async function loadWinners() {
    try {
        const data = await apiGet('/users/ranking/winners');
        const winners = data.winners || [];
        const lastMonth = data.month || '...';
        document.getElementById('winners-month').textContent = lastMonth;

        const setWinner = (pos, name, score) => {
            const nameEl = document.getElementById(`winner-${pos}-name`);
            const posEl = document.getElementById(`winner-${pos}-position`);
            if (nameEl) nameEl.textContent = name || '—';
            if (posEl) posEl.textContent = score ? `${score} pts` : '0 pts';
        };

        const w1 = winners.find(w => w.position === 1);
        const w2 = winners.find(w => w.position === 2);
        const w3 = winners.find(w => w.position === 3);

        setWinner(1, w1?.name || w1?.username, w1?.score);
        setWinner(2, w2?.name || w2?.username, w2?.score);
        setWinner(3, w3?.name || w3?.username, w3?.score);

    } catch (e) { }
}

function setRankingMonth() {
    const now = new Date();
    const label = `${now.getMonth() + 1}/${now.getFullYear()}`;
    const el = document.getElementById('ranking-month');
    if (el) el.textContent = label;
}

function startCountdown() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    function update() {
        const diff = nextMonth - new Date();
        if (diff <= 0) return;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);

        document.getElementById('cd-days').textContent = d.toString().padStart(2, '0');
        document.getElementById('cd-hours').textContent = h.toString().padStart(2, '0');
        document.getElementById('cd-minutes').textContent = m.toString().padStart(2, '0');
        document.getElementById('cd-seconds').textContent = s.toString().padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
}

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
