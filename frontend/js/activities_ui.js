/* activities_ui.js — Tati AI English Learning */

window.addEventListener('DOMContentLoaded', async () => {
  // Notificações
  const notifBtn = document.querySelector('.btn-notif');
  const notifModal = document.getElementById('notif-modal');
  if (notifBtn && notifModal) {
    notifBtn.onclick = () => notifModal.classList.toggle('active');
  }

  setRankingMonth();
  await loadInitialData();
  restoreState(false); // não fecha sidebar na restauração
});

// ── NAVIGATION ──────────────────────────────────────────────────────────────
function switchSection(sectionId, closeSidebar = true) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add('active');

  const navItem = document.getElementById(`nav-${sectionId}`);
  if (navItem) navItem.classList.add('active');

  localStorage.setItem('last_section', sectionId);

  if (closeSidebar) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mainContent = document.querySelector('.main-content');
    if (sidebar) { sidebar.classList.remove('open'); sidebar.classList.add('closed'); }
    if (overlay) overlay.classList.remove('visible');
    if (mainContent) mainContent.classList.add('expanded');
  }
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

function switchSubTab(tabName) {
  document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

  const panel = document.getElementById(`sub-content-${tabName}`);
  if (panel) panel.classList.add('active');

  const btns = document.querySelectorAll('.sub-tabs .tab-btn');
  btns.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${tabName}'`)) {
      btn.classList.add('active');
    }
  });

  localStorage.setItem('last_subtab', tabName);
}

async function restoreState(closeSidebar = true) {
  const savedSection = localStorage.getItem('last_section') || 'activities';
  const savedSubTab = localStorage.getItem('last_subtab') || 'quiz';
  switchSection(savedSection, closeSidebar);
  if (savedSection === 'activities') switchSubTab(savedSubTab);
}

// ── QUIZ LOGIC ──────────────────────────────────────────────────────────────
let currentQuizState = { questions: [], currentQ: 0, answers: [], quizId: null, title: '' };

function startQuiz(quizId, title) {
  currentQuizState = { questions: [], currentQ: 0, answers: [], quizId, title };
  const overlay = document.getElementById('quiz-overlay');
  const titleEl = document.getElementById('qm-title');
  // Garante footer visível e btn-next habilitado ao iniciar
  const footer = document.querySelector('.qm-footer');
  const btnNext = document.getElementById('btn-next');
  if (footer) footer.style.display = '';
  if (btnNext) btnNext.disabled = true;
  if (overlay && titleEl) {
    titleEl.textContent = title;
    overlay.classList.add('active');
    loadQuizFromAPI(quizId);
  }
}

async function loadQuizFromAPI(quizId) {
  try {
    const quiz = await apiGet(`/activities/quizzes/${quizId}`);
    currentQuizState.questions = quiz.questions || [];
    currentQuizState.currentQ = 0;
    currentQuizState.answers = [];
    renderCurrentQuestion();
  } catch (e) {
    console.error('Erro ao carregar quiz:', e);
  }
}

function renderCurrentQuestion() {
  const { questions, currentQ } = currentQuizState;
  if (currentQ >= questions.length) { finishQuiz(); return; }
  const q = questions[currentQ];
  const body = document.getElementById('qm-body');
  if (!body) return;

  document.getElementById('qm-sub').textContent = `${t('act.quiz_question_of')} ${currentQ + 1} ${t('act.quiz_de')} ${questions.length}`;
  const progBar = document.getElementById('qm-prog-bar');
  if (progBar) progBar.style.width = `${((currentQ) / questions.length) * 100}%`;

  body.innerHTML = `
    <div class="question-text">${escHtml(q.question)}</div>
    <div class="question-options">
      ${(q.options || []).map((opt, idx) => `
        <button class="option-btn" onclick="selectOption(this, ${idx})">${escHtml(opt)}</button>
      `).join('')}
    </div>
  `;
  document.getElementById('btn-next').disabled = true;
}

function selectOption(el, idx) {
  el.parentElement.querySelectorAll('.option-btn').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  currentQuizState.answers[currentQuizState.currentQ] = idx;
  document.getElementById('btn-next').disabled = false;
}

function nextQ() {
  const { questions, currentQ } = currentQuizState;
  currentQuizState.currentQ++;
  renderCurrentQuestion();
}

async function finishQuiz() {
  try {
    const res = await apiPost(`/activities/quizzes/${currentQuizState.quizId}/submit`, {
      answers: currentQuizState.answers
    });
    const d = res.data;
    const score = d.score ?? 0;
    const correct = d.correct ?? 0;
    const total = d.total ?? 0;
    const trophies = d.trophies_earned ?? [];
    const pct = Math.round((correct / total) * 100);

    let trophyHtml = '';
    if (trophies.length) {
      trophyHtml = `<div class="quiz-trophies">
        <p class="trophy-label">${t('act.quiz_trophies_earned')}</p>
        ${trophies.map(t => `<span class="trophy-earned">${t.icon || '🏆'} ${t.title}</span>`).join(' ')}
      </div>`;
    }

    const strokeColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
    const circumference = 440;

    // Esconde o footer com botão Next e mostra só o botão de fechar no body
    const footer = document.querySelector('.qm-footer');
    if (footer) footer.style.display = 'none';

    document.getElementById('qm-body').innerHTML = `
      <div class="quiz-result">
        <div class="circular-progress">
          <svg viewBox="0 0 150 150" width="150" height="150" style="transform:rotate(-90deg)">
            <circle cx="75" cy="75" r="70" fill="none" stroke="#e0e0e0" stroke-width="12"/>
            <circle id="quiz-circle-fg" cx="75" cy="75" r="70" fill="none"
              stroke="${strokeColor}" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"
              style="transition: stroke-dashoffset 1.2s cubic-bezier(0.175,0.885,0.32,1.275)"/>
          </svg>
          <span class="percentage" style="color:${strokeColor}">${pct}%</span>
        </div>
        <p>${correct} ${t('act.quiz_de')} ${total} ${t('act.quiz_result_correct')}</p>
        ${trophyHtml}
        <button class="quiz-btn" onclick="closeQuiz()" style="margin-top:1.5rem">${t('act.quiz_close_btn')}</button>
      </div>
    `;
    // Dispara animação após o DOM renderizar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fg = document.getElementById('quiz-circle-fg');
        if (fg) fg.style.strokeDashoffset = circumference - (circumference * pct / 100);
      });
    });
  } catch (e) { console.error(e); }
}

function closeQuiz() {
  document.getElementById('quiz-overlay')?.classList.remove('active');
  const footer = document.querySelector('.qm-footer');
  if (footer) footer.style.display = '';
  loadQuizzes();
}

async function loadInitialData() {
  try {
    await Promise.all([
      loadUserData(), loadQuizzes(), loadActivities(),
      loadStudyTime(), loadAchievements(), loadRanking(),
      loadFlashcards(), loadSimulations()
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
  if (user.avatar_url && avatarImg) { avatarImg.src = user.avatar_url; avatarImg.style.display = 'block'; if (avatarFallback) avatarFallback.style.display = 'none'; }
  else if (avatarFallback) { avatarFallback.textContent = displayName.charAt(0).toUpperCase(); }

  // Preenche mini card da sidebar
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarLevel = document.getElementById('sidebar-user-level');
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  if (sidebarName) sidebarName.textContent = displayName;
  if (sidebarLevel) sidebarLevel.textContent = user.level || 'Beginner';
  if (sidebarAvatar) sidebarAvatar.textContent = displayName.charAt(0).toUpperCase();

  try {
    const streakData = await apiGet('/users/streak');
    document.getElementById('streak-count-text').textContent = streakData.current_streak || 0;
    document.getElementById('trophy-count-text').textContent = `${streakData.trophies_earned || 0}/50`;
  } catch (e) { }
}

async function loadStudyTime() {
  try {
    const data = await apiGet('/users/progress/study-time');
    const fmt = m => m ? `${Math.floor(m / 60)}h ${m % 60}m` : null;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (val) { el.textContent = val; el.style.opacity = '1'; }
      else { el.textContent = '—'; el.style.opacity = '0.35'; el.title = 'Comece a estudar para ver seu tempo aqui'; }
    };
    set('study-week', fmt(data.this_week));
    set('study-month', fmt(data.this_month));
    set('study-last-month', fmt(data.last_month));
    set('study-3months', fmt(data.last_3_months));
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

    const winners = await apiGet('/users/ranking/winners');
    document.getElementById('winner-1-name').textContent = winners[0]?.name || '—';
    document.getElementById('winner-1-position').textContent = winners[0] ? `${winners[0].score} pts` : '0 pts';
    document.getElementById('winner-2-name').textContent = winners[1]?.name || '—';
    document.getElementById('winner-2-position').textContent = winners[1] ? `${winners[1].score} pts` : '0 pts';
    document.getElementById('winner-3-name').textContent = winners[2]?.name || '—';
    document.getElementById('winner-3-position').textContent = winners[2] ? `${winners[2].score} pts` : '0 pts';
  } catch (e) { console.error(e); }
}

async function loadQuizzes() {
  const modules = await apiGet('/activities/modules');
  const container = document.getElementById('quiz-list-container');
  if (!container) return;

  let allQuizzes = [];
  modules.forEach(m => {
    if (m.quizzes) {
      m.quizzes.forEach(q => {
        allQuizzes.push({ ...q, attempts: q.attempts || 0 });
      });
    }
  });

  const MAX_ATTEMPTS = 3;

  container.innerHTML = allQuizzes.length ? allQuizzes.map(q => {
    const attempts = q.attempts || 0;
    const remaining = MAX_ATTEMPTS - attempts;
    const blocked = remaining <= 0;
    const done = attempts > 0;

    const badgeHtml = blocked
      ? `<span class="quiz-badge badge-blocked">🔒 ${t('act.quiz_limit_reached') || 'Limite atingido'}</span>`
      : done
        ? `<span class="quiz-badge badge-done">✓ ${t('act.quiz_done') || 'Concluído'}</span>`
        : `<span class="quiz-badge badge-new">${t('act.quiz_new') || 'Novo'}</span>`;

    const dotsHtml = Array.from({ length: MAX_ATTEMPTS }, (_, i) =>
      `<span class="attempt-dot ${i < attempts ? 'used' : ''}"></span>`
    ).join('');

    const questionsHtml = q.questions?.length
      ? `<span class="quiz-meta-item"><i class="fa-solid fa-circle-question"></i> ${q.questions.length} ${t('act.quiz_questions') || 'perguntas'}</span>`
      : '';

    return `
    <div class="quiz-card ${blocked ? 'blocked' : ''}" ${!blocked ? `onclick="startQuiz('${q.id}', '${q.title}')"` : ''}>
      ${badgeHtml}
      <h3>${q.title}</h3>
      <p class="quiz-desc">${q.description || ''}</p>
      <div class="quiz-meta-row">
        ${questionsHtml}
        <span class="quiz-meta-item"><i class="fa-solid fa-rotate-right"></i> ${attempts}/${MAX_ATTEMPTS} ${t('act.quiz_attempts').toLowerCase()}</span>
      </div>
      <div class="attempt-dots-row">
        <span class="attempt-dots-label">${t('act.quiz_attempts')}:</span>
        <div class="attempt-dots">${dotsHtml}</div>
      </div>
      <button class="quiz-btn ${blocked ? 'quiz-btn-blocked' : done ? 'quiz-btn-redo' : ''}" ${blocked ? 'disabled' : ''}>
        ${blocked ? '🔒 Limite atingido' : done ? `<i class="fa-solid fa-rotate-right"></i> ${t('act.quiz_redo')}` : `<i class="fa-solid fa-play"></i> ${t('act.quiz_start')}`}
      </button>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="empty-state-icon">📝</div><h3>Nenhum quiz disponível</h3><p>Os quizzes aparecerão aqui quando sua professora adicionar conteúdo.</p></div>`;
}

async function loadFlashcards() {
  const modules = await apiGet('/activities/modules');
  const container = document.getElementById('sub-content-flashcards');
  if (!container) return;
  let all = modules.flatMap(m => m.flashcards || []);
  if (all.length) {
    container.innerHTML = `<div class="flashcard-grid">${all.map(f => `<div class="flashcard-item"><strong>${f.word}</strong><p>${f.translation}</p>${f.example ? `<span class="fc-example">${f.example}</span>` : ''}</div>`).join('')}</div>`;
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🃏</div>
        <h3>${t('act.fc_none')}</h3>
        <p>Os flashcards aparecerão aqui quando sua professora adicionar conteúdo.</p>
      </div>`;
  }
}

const SIM_KEY_MAP = {
  'Check-in no Aeroporto': 'airport_checkin',
  'Entrevista de Emprego': 'job_interview',
  'Fazendo Compras':       'shopping',
  'No Aeroporto':          'at_airport',
  'No Hotel':              'at_hotel',
  'No Médico':             'at_doctor',
  'No Restaurante':        'at_restaurant',
  'Pedido no Restaurante': 'restaurant_order'
};

async function loadSimulations() {
  try {
    const data = await apiGet('/simulation/scenarios');
    const container = document.getElementById('sub-content-simulations');
    if (!container) return;
    if (!data.length) { container.innerHTML = `<p class="empty-view">${t('act.sim_none')}</p>`; return; }
    
    container.innerHTML = `<div class="simulation-grid">${data.map(s => {
      const key = SIM_KEY_MAP[s.name];
      const title = key ? t(`sim.title_${key}`) : s.name;
      const desc = key ? t(`sim.desc_${key}`) : s.description;
      const diffLabel = getDiffLabel(s.difficulty);

      return `
      <div class="sim-card" onclick="window.location.href='/simulation.html?id=${s.id}'">
        <div class="sim-card-icon">${s.icon || '💬'}</div>
        <div class="sim-card-body">
          <h3>${escHtml(title)}</h3>
          <p>${escHtml(desc || '')}</p>
        </div>
        <span class="sim-card-difficulty ${s.difficulty}">${diffLabel}</span>
      </div>
      `;
    }).join('')}</div>`;
  } catch (e) { console.error(e); }
}

function getDiffLabel(d) {
  const key = d?.toLowerCase().replace('-', '_');
  return t(`level.${key}`) || d;
}

async function loadActivities() {
  try {
    const subs = await apiGet('/activities/submissions/my');
    const container = document.getElementById('sub-content-atividades');
    if (!container) return;
    if (!subs.length) return;

    const statusLabel = { pending: t('act.status_pending'), corrected: t('act.status_corrected') };
    container.innerHTML = subs.map(sub => {
      const modTitle = sub.modules?.title || sub.module_id || 'Atividade';
      const scoreVal = sub.score;
      const scoreColor = scoreVal >= 70 ? '#22c55e' : scoreVal >= 40 ? '#f59e0b' : '#ef4444';
      const score = scoreVal != null ? `
        <div class="act-score-bar">
          <div class="act-score-label" style="color:${scoreColor}">${scoreVal}/100</div>
          <div class="act-score-track">
            <div class="act-score-fill" style="width:${scoreVal}%;background:${scoreColor}"></div>
          </div>
        </div>` : '';
      const fb = sub.ai_feedback || sub.teacher_feedback;
      const feedbackHtml = fb ? `<p class="act-feedback">${escHtml(fb)}</p>` : '';
      return `<div class="profile-card act-card">
        <div class="act-header">
          <h4>${escHtml(modTitle)}</h4>
          <span class="act-status ${sub.status}">${statusLabel[sub.status] || sub.status}</span>
        </div>
        ${score}
        <p class="act-answer">${escHtml(sub.student_answer)}</p>
        ${feedbackHtml}
        <span class="act-date">${new Date(sub.created_at).toLocaleDateString(I18n.getLang() === 'pt-BR' ? 'pt-BR' : 'en-US')}</span>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

async function loadAchievements() {
  try {
    const streakData = await apiGet('/users/streaks/detail');
    const streak = streakData.current_streak ?? 0;
    const longest = streakData.longest_streak ?? 0;

    document.getElementById('streak-val').textContent = streak;
    document.getElementById('streak-longest').textContent = `${longest} ${t('profile.streak_days')}`;
    document.getElementById('streak-questions').textContent = streakData.total_questions ?? 0;
    document.getElementById('streak-hours').textContent = `${streakData.hours_saved ?? 0}h`;

    const badge = document.getElementById('streak-status-label');
    if (badge) {
      badge.textContent = streak > 0 ? 'ATIVO' : 'INATIVO';
      badge.style.background = streak > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)';
      badge.style.color = streak > 0 ? '#10b981' : '#f59e0b';
    }
  } catch (e) { console.error(e); }

  try {
    const data = await apiGet('/users/trophies/all');
    const earned = data.earned ?? 0;
    const total = data.total ?? 50;
    const medals = data.medals ?? [];
    const pct = Math.round((earned / total) * 100);

    document.getElementById('trophy-count').textContent = earned;
    document.getElementById('trophy-percent').textContent = `${pct}%`;
    const bar = document.getElementById('trophy-progress-bar');
    if (bar) bar.style.width = `${pct}%`;

    const TROPHY_KEY_MAP = {
      'Primeiro Quiz':       'first_quiz',
      'Quizzer Iniciante':   'quizzer_5',
      'Quizzer':             'quizzer_10',
      'Quizzer Avançado':    'quizzer_25',
      'Mestre dos Quizzes':  'quizzer_50',
      'Mestre Supremo':      'quizzer_100',
      'Primeiro Dia':        'streak_1',
      'Ofensiva de 3 Dias':  'streak_3',
      'Ofensiva de 7 Dias':  'streak_7',
      'Ofensiva de 14 Dias': 'streak_14',
      'Ofensiva de 30 Dias': 'streak_30',
      'Ofensiva de 60 Dias': 'streak_60',
      'Ofensiva de 100 Dias': 'streak_100',
      'Ofensiva de 365 Dias': 'streak_365',
      'Primeira Mensagem':   'first_msg',
      'Popular':             'msg_50',
      '100 Mensagens':       'msg_100',
      'Comunicador':         'msg_200',
      '500 Mensagens':       'msg_500',
      'Falante':             'msg_1000',
      'Primeira Simulação':  'sim_1',
      'Ator Iniciante':      'sim_5',
      'Estrela de Simulação':'sim_20',
      'Primeiro Crédito':    'credit_1',
      'Economizador':        'credit_10',
      'Colecionador':        'credit_50',
      'Rico':                'credit_100',
      'Magnata':             'credit_500',
      'Primeira Hora':       'time_1',
      'Mestre do Tempo':     'time_10',
      'Tempo Supremo':       'time_50',
      'Viajante do Tempo':   'time_100',
      'Vocabulário 10':      'vocab_10',
      'Vocabulário 50':      'vocab_50',
      'Vocabulário 100':     'vocab_100',
      'Poliglota':           'vocab_500',
      'Dicionário Vivo':     'vocab_1000',
      'Primeira Meta':       'goal_1',
      'Focado':              'goal_5',
      'Objetivo':            'goal_10',
      'Top 10':              'rank_10',
      'Top 3':               'rank_3',
      'Campeão':             'rank_1',
      'Social':              'social_1',
      'Explorador':          'explore',
      'Sempre Alerta':       'alert',
      'Madrugador':          'early',
      'Coruja':              'night',
      'Final de Semana':     'weekend',
      'Perfeccionista':      'perfect',
    };
    const grid = document.getElementById('medals-grid');
    if (grid) {
      grid.innerHTML = medals.map(m => {
        const pct = m.progress_pct ?? (m.unlocked ? 100 : 0);
        const cur = m.current_val ?? 0;
        const req = m.required_val ?? 1;
        const key = TROPHY_KEY_MAP[m.name];
        const medalName = key ? t(`act.title_${key}`) : m.name;
        const medalDesc = key ? t(`act.desc_${key}`) : m.description;
        const progressHtml = m.unlocked
          ? `<div class="medal-progress-bar-wrap done"><div class="medal-progress-bar" style="width:100%"></div></div>
             <div class="medal-progress-text">✓ ${t('act.quiz_done') || 'Concluído'}</div>`
          : `<div class="medal-progress-bar-wrap">
               <div class="medal-progress-bar" style="width:${pct}%"></div>
             </div>
             <div class="medal-progress-text">${cur}/${req}</div>`;

        return `
        <div class="medal-card ${m.unlocked ? 'unlocked' : 'locked'}" data-category="${m.category}">
          ${m.unlocked ? `<div class="medal-check"><i class="fa-solid fa-check"></i></div>` : ''}
          <div class="medal-icon">${m.icon || '🏆'}</div>
          <div class="medal-name">${medalName}</div>
          <div class="medal-desc">${medalDesc}</div>
          <div class="medal-progress">
            ${progressHtml}
          </div>
        </div>`;
      }).join('');
    }

    // Atualiza traduções dos filtros
    document.querySelectorAll('.medal-filter').forEach(btn => {
      const cat = btn.getAttribute('data-category');
      btn.textContent = t(`act.cat_${cat}`) || cat;
    });

    // Contadores por categoria
    const counts = { all: medals.length, questions: 0, streak: 0, milestones: 0 };
    medals.forEach(m => { if (counts[m.category] !== undefined) counts[m.category]++; });
    Object.keys(counts).forEach(cat => {
      const el = document.getElementById(`filter-${cat}-count`);
      if (el) el.textContent = counts[cat];
    });

    // Guarda medals globalmente para o filtro
    window._allMedals = medals;
  } catch (e) { console.error(e); }
}

// ── UTILS ──────────────────────────────────────────────────────────────
function filterMedals(cat, btn) {
  // Atualiza botão ativo
  document.querySelectorAll('.medal-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Filtra os cards
  const cards = document.querySelectorAll('.medal-card');
  cards.forEach(card => {
    const show = cat === 'all' || card.dataset.category === cat;
    card.style.display = show ? '' : 'none';
  });
}
function setRankingMonth() {
  const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(m => t(`act.month_${m}`));
  const now = new Date();
  const label = `${months[now.getMonth()]}/${now.getFullYear()}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevLabel = `${months[prev.getMonth()]}/${prev.getFullYear()}`;
  document.getElementById('ranking-month').textContent = label;
  document.getElementById('winners-month').textContent = prevLabel;
  document.getElementById('top15-month').textContent = label;
  startCountdown();
}

function startCountdown() {
  function update() {
    const now = new Date();
    // Último momento do mês atual
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0) - 1;
    const diff = endOfMonth - now;

    if (diff <= 0) { update(); return; }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = n => String(n).padStart(2, '0');
    const el = id => document.getElementById(id);
    if (el('cd-days')) el('cd-days').textContent = pad(days);
    if (el('cd-hours')) el('cd-hours').textContent = pad(hours);
    if (el('cd-minutes')) el('cd-minutes').textContent = pad(minutes);
    if (el('cd-seconds')) el('cd-seconds').textContent = pad(seconds);

    // Muda cor para vermelho nos últimos 3 dias
    const card = document.getElementById('countdown-card');
    if (card) card.classList.toggle('urgent', days < 3);
  }
  update();
  setInterval(update, 1000);
}
function openWritingModal() { document.getElementById('writing-modal')?.classList.add('active'); }
function closeWritingModal() { document.getElementById('writing-modal')?.classList.remove('active'); }
function openFeedbackModal() { document.getElementById('feedback-modal')?.classList.add('active'); }
function closeFeedbackModal() { document.getElementById('feedback-modal')?.classList.remove('active'); }

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const type = document.querySelector('input[name="fb-type"]:checked')?.value || 'bug';
  const title = document.getElementById('fb-title')?.value?.trim();
  const desc = document.getElementById('fb-desc')?.value?.trim();
  if (!title || !desc) { showToast(t('act.fb_fill_all'), 'warning'); return; }

  try {
    const res = await apiPost('/feedback/send', {
      category: type,
      title,
      message: desc,
      page: location.pathname
    });
    if (res.data?.success) {
      showToast(t('act.fb_success'), 'success');
      closeFeedbackModal();
      e.target.reset();
    } else {
      showToast(res.data?.message || t('act.fb_error'), 'error');
    }
  } catch (err) { console.error(err); showToast(t('act.fb_conn_error'), 'error'); }
}

async function handleWritingSubmit(e) {
  e.preventDefault();
  const theme = document.getElementById('writing-theme')?.value?.trim();
  const content = document.getElementById('writing-content')?.value?.trim();
  if (!theme || !content) { showToast(t('act.wr_fill_all'), 'warning'); return; }

  try {
    const res = await apiPost('/activities/submissions/submit', {
      module_id: 'writing-' + Date.now(),
      activity_type: 'writing',
      student_answer: `Tema: ${theme}\n\n${content}`
    });
    if (res.data?.ok) {
      showToast(t('act.wr_success'), 'success');
      closeWritingModal();
      e.target.reset();
      loadActivities();
    } else {
      showToast(t('act.wr_error'), 'error');
    }
  } catch (err) { console.error(err); showToast(t('act.wr_conn_error'), 'error'); }
}