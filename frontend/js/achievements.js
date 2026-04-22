/* achievements.js — Tati AI Achievements */

window.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
});

async function loadInitialData() {
    try {
        await Promise.all([
            loadUserData(),
            loadAchievements()
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

async function loadAchievements() {
    try {
        const streakData = await apiGet('/users/streaks/detail');
        document.getElementById('streak-val').textContent = streakData.current_streak ?? 0;
        document.getElementById('streak-longest').textContent = `${streakData.longest_streak || 0} ${t('profile.streak_days')}`;
        document.getElementById('streak-questions').textContent = streakData.total_questions || 0;
        document.getElementById('streak-hours').textContent = `${(streakData.hours_saved || 0).toFixed(1)}h`;

        if (streakData.current_streak > 0) {
            const statusLabel = document.getElementById('streak-status-label');
            statusLabel.textContent = t('act.streak_active');
            statusLabel.classList.add('active');
        }

        const data = await apiGet('/users/trophies/all');
        const medals = data.medals || [];


        // Progress bar
        const earned = medals.filter(m => m.unlocked).length;
        document.getElementById('trophy-count').textContent = earned;
        const pct = Math.round((earned / 50) * 100);
        document.getElementById('trophy-percent').textContent = `${pct}%`;
        document.getElementById('trophy-progress-bar').style.width = `${pct}%`;

        // Mapa: nome PT -> chave i18n
        const MEDAL_I18N = {
            'Primeiro Quiz': { title: 'act.title_first_quiz', desc: 'act.desc_first_quiz' },
            'Primeiro Dia': { title: 'act.title_first_day', desc: 'act.desc_first_day' },
            'Primeira Mensagem': { title: 'act.title_first_message', desc: 'act.desc_first_message' },
            'Quizzer': { title: 'act.title_quizzer', desc: 'act.desc_quizzer' },
            'Quizzer Iniciante': { title: 'act.title_beginner_quizzer', desc: 'act.desc_beginner_quizzer' },
            'Ofensiva de 30 Dias': { title: 'act.title_30_day_streak', desc: 'act.desc_30_day_streak' },
            '100 Mensagens': { title: 'act.title_100_messages', desc: 'act.desc_100_messages' },
            'Ofensiva de 7 Dias': { title: 'act.title_7_day_streak', desc: 'act.desc_7_day_streak' },
            'Mestre dos Quizzes': { title: 'act.title_quiz_master', desc: 'act.desc_quiz_master' },
            'Quizzer Avançado': { title: 'act.title_advanced_quizzer', desc: 'act.desc_advanced_quizzer' },
            'Mestre Supremo': { title: 'act.title_supreme_master', desc: 'act.desc_supreme_master' },
            'Ofensiva de 3 Dias': { title: 'act.title_3_day_streak', desc: 'act.desc_3_day_streak' },
            'Ofensiva de 14 Dias': { title: 'act.title_14_day_streak', desc: 'act.desc_14_day_streak' },
            'Ofensiva de 60 Dias': { title: 'act.title_60_day_streak', desc: 'act.desc_60_day_streak' },
            'Ofensiva de 100 Dias': { title: 'act.title_100_day_streak', desc: 'act.desc_100_day_streak' },
            'Ofensiva de 365 Dias': { title: 'act.title_365_day_streak', desc: 'act.desc_365_day_streak' },
            'Popular': { title: 'act.title_popular', desc: 'act.desc_popular' },
            'Comunicador': { title: 'act.title_communicator', desc: 'act.desc_communicator' },
            '500 Mensagens': { title: 'act.title_500_messages', desc: 'act.desc_500_messages' },
            'Falante': { title: 'act.title_speaker', desc: 'act.desc_speaker' },
            'Primeira Simulação': { title: 'act.title_first_simulation', desc: 'act.desc_first_simulation' },
            'Ator Iniciante': { title: 'act.title_beginner_actor', desc: 'act.desc_beginner_actor' },
            'Estrela de Simulação': { title: 'act.title_simulation_star', desc: 'act.desc_simulation_star' },
            'Primeiro Crédito': { title: 'act.title_first_credit', desc: 'act.desc_first_credit' },
            'Economizador': { title: 'act.title_saver', desc: 'act.desc_saver' },
            'Colecionador': { title: 'act.title_collector', desc: 'act.desc_collector' },
            'Rico': { title: 'act.title_rich', desc: 'act.desc_rich' },
            'Magnata': { title: 'act.title_magnate', desc: 'act.desc_magnate' },
            'Primeira Hora': { title: 'act.title_first_hour', desc: 'act.desc_first_hour' },
            'Mestre do Tempo': { title: 'act.title_time_master', desc: 'act.desc_time_master' },
            'Tempo Supremo': { title: 'act.title_supreme_time', desc: 'act.desc_supreme_time' },
            'Viajante do Tempo': { title: 'act.title_time_traveler', desc: 'act.desc_time_traveler' },
            'Vocabulário 10': { title: 'act.title_vocabulary_10', desc: 'act.desc_vocabulary_10' },
            'Vocabulário 50': { title: 'act.title_vocabulary_50', desc: 'act.desc_vocabulary_50' },
            'Vocabulário 100': { title: 'act.title_vocabulary_100', desc: 'act.desc_vocabulary_100' },
            'Poliglota': { title: 'act.title_polyglot', desc: 'act.desc_polyglot' },
            'Dicionário Vivo': { title: 'act.title_living_dictionary', desc: 'act.desc_living_dictionary' },
            'Primeira Meta': { title: 'act.title_first_goal', desc: 'act.desc_first_goal' },
            'Focado': { title: 'act.title_focused', desc: 'act.desc_focused' },
            'Objetivo': { title: 'act.title_objective', desc: 'act.desc_objective' },
            'Top 10': { title: 'act.title_top_10', desc: 'act.desc_top_10' },
            'Top 3': { title: 'act.title_top_3', desc: 'act.desc_top_3' },
            'Campeão': { title: 'act.title_champion', desc: 'act.desc_champion' },
            'Social': { title: 'act.title_social', desc: 'act.desc_social' },
            'Explorador': { title: 'act.title_explorer', desc: 'act.desc_explorer' },
            'Sempre Alerta': { title: 'act.title_always_alert', desc: 'act.desc_always_alert' },
            'Madrugador': { title: 'act.title_early_bird', desc: 'act.desc_early_bird' },
            'Coruja': { title: 'act.title_owl', desc: 'act.desc_owl' },
            'Final de Semana': { title: 'act.title_weekend', desc: 'act.desc_weekend' },
            'Perfeccionista': { title: 'act.title_perfectionist', desc: 'act.desc_perfectionist' },
        };

        const grid = document.getElementById('medals-grid');
        if (grid) {
            grid.innerHTML = medals.map(m => {
                const keys = MEDAL_I18N[m.name];
                const title = keys ? t(keys.title) : m.name;
                const desc = keys ? t(keys.desc) : m.description;

                return `
        <div class="medal-card ${m.unlocked ? 'unlocked' : 'locked'}" data-category="${m.category || 'all'}">
            <div class="medal-icon">${m.icon || '🏆'}</div>
            <div class="medal-name">${title}</div>
            <div class="medal-desc">${desc}</div>
        </div>`;
            }).join('');
        }

        // Filter counts
        document.getElementById('filter-all-count').textContent = medals.length;
        document.getElementById('filter-questions-count').textContent = medals.filter(m => m.category === 'questions').length;
        document.getElementById('filter-streak-count').textContent = medals.filter(m => m.category === 'streak').length;
        document.getElementById('filter-milestones-count').textContent = medals.filter(m => m.category === 'milestones').length;
        document.getElementById('filter-credits-count').textContent = medals.filter(m => m.category === 'credits').length;
        document.getElementById('filter-time-count').textContent = medals.filter(m => m.category === 'time').length;
        document.getElementById('filter-social-count').textContent = medals.filter(m => m.category === 'social').length;
        document.getElementById('filter-vocabulary-count').textContent = medals.filter(m => m.category === 'vocabulary').length;
        document.getElementById('filter-goals-count').textContent = medals.filter(m => m.category === 'goals').length;
        document.getElementById('filter-ranking-count').textContent = medals.filter(m => m.category === 'ranking').length;

    } catch (e) { console.error(e); }
}

function filterMedals(category, btn) {
    document.querySelectorAll('.medal-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.medal-card').forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
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
