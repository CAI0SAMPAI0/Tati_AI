/* activities_ui.js — Tati AI English Learning */

window.addEventListener('DOMContentLoaded', async () => {
  // Notificações
  const notifBtn = document.querySelector('.btn-notif');
  const notifModal = document.getElementById('notif-modal');
  if (notifBtn && notifModal) {
    notifBtn.onclick = () => notifModal.classList.toggle('active');
  }

  await loadInitialData();

  // Restore subtab from localStorage
  const savedSubTab = localStorage.getItem('last_subtab') || 'quiz';
  switchSubTab(savedSubTab);
});

// ── NAVIGATION ──────────────────────────────────────────────────────────────

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

async function loadInitialData() {
  try {
    await Promise.all([
      loadUserData(),
      loadQuizzes(),
      loadActivities(),
      loadFlashcards(),
      loadSimulations()
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
  }
  else if (avatarFallback) {
    avatarFallback.textContent = displayName.charAt(0).toUpperCase();
    avatarFallback.style.display = 'flex';
  }

  try {
    const streakData = await apiGet('/users/streak');
    document.getElementById('streak-count-text').textContent = streakData.current_streak || 0;
    document.getElementById('trophy-count-text').textContent = `${streakData.trophies_earned || 0}/50`;
  } catch (e) { }
}

async function loadQuizzes() {
  const modules = await apiGet('/activities/modules');
  const container = document.getElementById('quiz-list-container');
  if (!container) return;

  let allQuizzes = [];
  modules.forEach(m => {
    // Pula o módulo personalizado aqui (ele vai para a aba Exercícios)
    if (m.id === "00000000-0000-0000-0000-000000000001") return;
    if (m.quizzes) {
      m.quizzes.forEach(q => {
        allQuizzes.push({ ...q, attempts: q.attempts || 0 });
      });
    }
  });

  const MAX_ATTEMPTS = 3;

  container.innerHTML = allQuizzes.length ? allQuizzes.map(q => {
    const attempts = q.attempts || 0;
    const blocked = (MAX_ATTEMPTS - attempts) <= 0;
    const done = attempts > 0;

    return `
    <div class="quiz-card ${blocked ? 'blocked' : ''}" onclick="${!blocked ? `startQuiz('${q.id}', '${escHtml(q.title)}')` : ''}">
      <h3>${escHtml(q.title)}</h3>
      <p class="quiz-desc">${escHtml(q.description || '')}</p>
      <div class="quiz-meta-row">
        <span class="quiz-meta-item"><i class="fa-solid fa-rotate-right"></i> ${attempts}/${MAX_ATTEMPTS} ${t('act.quiz_attempts') || 'tentativas'}</span>
      </div>
      <button class="quiz-btn ${blocked ? 'quiz-btn-blocked' : done ? 'quiz-btn-redo' : ''}" ${blocked ? 'disabled' : ''}>
        ${blocked ? '🔒 ' + (t('act.quiz_limit_reached') || 'Limite') : done ? t('act.quiz_redo') || 'Revisar' : t('act.quiz_start') || 'Iniciar'}
      </button>
    </div>`;
  }).join('') : `<p>Nenhum quiz disponível.</p>`;
}

async function loadActivities() {
  try {
    const container = document.getElementById('sub-content-atividades');
    if (!container) return;

    const modules = await apiGet('/activities/modules');
    const persModule = modules.find(m => m.id === "00000000-0000-0000-0000-000000000001");
    const pendingQuizzes = persModule ? (persModule.quizzes || []).filter(q => (q.attempts || 0) === 0) : [];
    const flashcards = persModule ? (persModule.flashcards || []) : [];

    const subs = await apiGet('/activities/submissions/my');

    let html = '';  // ← DEVE estar aqui, fora de qualquer if

    if (pendingQuizzes.length > 0 || flashcards.length > 0) {
      html += pendingQuizzes.map(q => `
                <div class="profile-card act-card pending-task" onclick="startQuiz('${q.id}', '${escHtml(q.title)}')" style="border-left: 4px solid var(--primary); cursor: pointer;">
                    <div class="act-header">
                        <h4><i class="fa-solid fa-circle-question"></i> ${escHtml(q.title)}</h4>
                        <span class="act-status pending">${t('act.status_pending') || 'Pendente'}</span>
                    </div>
                    <p class="act-desc">${escHtml(q.description || t('act.personalized_desc') || 'Baseado nos seus erros recentes.')}</p>
                    <small><i class="fa-solid fa-play"></i> ${t('act.quiz_start') || 'Clique para começar'}</small>
                </div>
            `).join('');

      if (flashcards.length > 0) {
        html += `
                    <div class="profile-card act-card pending-task" onclick="switchSubTab('flashcards')" style="border-left: 4px solid var(--secondary); cursor: pointer;">
                        <div class="act-header">
                            <h4><i class="fa-solid fa-layer-group"></i> ${t('act.personalized_fc') || 'Revisão de Vocabulário'}</h4>
                            <span class="act-status pending">${flashcards.length} ${t('act.items') || 'itens'}</span>
                        </div>
                        <p class="act-desc">${t('act.personalized_fc_desc') || 'Palavras que você errou ou está aprendendo.'}</p>
                        <small><i class="fa-solid fa-arrow-right"></i> ${t('act.view_flashcards') || 'Ver Flashcards'}</small>
                    </div>
                `;
      }

      html += `
                <div class="profile-card act-card pending-task" onclick="openWritingModal()" style="border-left: 4px solid #10b981; cursor: pointer; background: rgba(16, 185, 129, 0.05);">
                    <div class="act-header">
                        <h4><i class="fa-solid fa-pen"></i> ${t('act.personalized_writing') || 'Exercício de Escrita'}</h4>
                        <span class="act-status bonus">NEW</span>
                    </div>
                    <p class="act-desc">${t('act.personalized_writing_desc') || 'Pratique sua escrita e receba feedback da Tati IA.'}</p>
                    <small><i class="fa-solid fa-plus"></i> ${t('act.start_exercise') || 'Criar novo exercício'}</small>
                </div>
            `;
    } else {
      // Aluno ainda não tem exercícios
      html += `
                <div style="text-align:center; padding: 2rem;">
                    <h4 class="act-section-title"><i class="fa-solid fa-star"></i> ${t('act.personalized_pending') || 'Prática Personalizada'}</h4>
                    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
                        ${t('act.no_exercises_yet') || 'A Tati está analisando seu progresso. Exercícios personalizados aparecerão aqui em breve!'}
                    </p>
                </div>
            `;
    }

    if (subs.length > 0) {
      html += `<h4 class="act-section-title"><i class="fa-solid fa-history"></i> ${t('act.history') || 'Histórico de Atividades'}</h4>`;
      html += subs.map(sub => {
        const modTitle = sub.modules?.title || 'Atividade';
        const score = sub.score != null ? `<div class="act-score-label">${sub.score}/100</div>` : '';
        const statusLabel = sub.status === 'corrected' ? t('act.status_corrected') : t('act.status_pending');
        return `
                    <div class="profile-card act-card">
                        <div class="act-header">
                            <h4>${escHtml(modTitle)}</h4>
                            <span class="act-status ${sub.status}">${statusLabel || sub.status}</span>
                        </div>
                        ${score}
                        <p class="act-answer">${escHtml(sub.student_answer)}</p>
                        <span class="act-date">${new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                `;
      }).join('');
    }

    container.innerHTML = html || '<div class="empty-view"><i class="fa-solid fa-notebook"></i><h3>Nenhuma atividade</h3></div>';
    I18n.applyToDOM(container);

  } catch (e) { console.error(e); }
}

async function loadFlashcards() {
  const modules = await apiGet('/activities/modules');
  const container = document.getElementById('sub-content-flashcards');
  if (!container) return;
  let all = modules.flatMap(m => m.flashcards || []);
  if (all.length) {
    container.innerHTML = `
      <div class="flashcard-grid">
        ${all.map(f => `
          <div class="flashcard-item" onclick="this.classList.toggle('flipped')">
            <div class="fc-inner">
              <div class="fc-front"><strong>${escHtml(f.word)}</strong></div>
              <div class="fc-back"><p>${escHtml(f.translation)}</p></div>
            </div>
          </div>`).join('')}
      </div>`;
  }
}

const SIM_KEY_MAP = {
  'Check-in no Aeroporto': 'airport_checkin',
  'Entrevista de Emprego': 'job_interview',
  'Fazendo Compras': 'shopping',
  'No Aeroporto': 'at_airport',
  'No Hotel': 'at_hotel',
  'No Médico': 'at_doctor',
  'No Restaurante': 'at_restaurant',
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
      const diff = getDiffLabel(s.difficulty);
      return `
        <div class="sim-card" onclick="window.location.href='simulation.html?id=${s.id}'">
          <div class="scenario-icon">${s.icon || '🎭'}</div>
          <h3>${escHtml(title)}</h3>
          <p>${escHtml(desc || '')}</p>
          <span class="scenario-difficulty ${diff}">${diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
        </div>
      `;
    }).join('')}</div>`;
  } catch (e) { console.error(e); }
}

function getDiffLabel(d) {
  const key = d?.toLowerCase().replace('-', '_');
  return t(`level.${key}`) || d;
}

// ── UTILS ──────────────────────────────────────────────────────────────
function openWritingModal() { document.getElementById('writing-modal')?.classList.add('active'); }
function closeWritingModal() { document.getElementById('writing-modal')?.classList.remove('active'); }

async function handleWritingSubmit(e) {
  e.preventDefault();
  const theme = document.getElementById('writing-theme')?.value?.trim();
  const content = document.getElementById('writing-content')?.value?.trim();
  if (!theme || !content) return;

  try {
    const res = await apiPost('/activities/submissions/submit', {
      module_id: '00000000-0000-0000-0000-000000000001', // IA Module
      activity_type: 'writing',
      student_answer: content
    });
    if (res.ok) {
      showToast('Enviado com sucesso!', 'success');
      closeWritingModal();
      loadActivities();
    }
  } catch (err) { showToast('Erro ao enviar.', 'error'); }
}

function openFeedbackModal() { document.getElementById('feedback-modal')?.classList.add('active'); }
function closeFeedbackModal() { document.getElementById('feedback-modal')?.classList.remove('active'); }

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const type = document.querySelector('input[name="fb-type"]:checked')?.value;
  const title = document.getElementById('fb-title')?.value;
  const desc = document.getElementById('fb-desc')?.value;

  try {
    await apiPost('/validation/feedback', { type, title, description: desc });
    showToast('Feedback enviado! Obrigado.', 'success');
    closeFeedbackModal();
  } catch (e) { showToast('Erro ao enviar feedback.', 'error'); }
}

// ── Lógica de Quiz (Modal) ──────────────────────────────────────────────────
let currentQuizState = { questions: [], currentQ: 0, answers: [], quizId: null, title: '' };

function startQuiz(quizId, title) {
  currentQuizState = { questions: [], currentQ: 0, answers: [], quizId, title };
  const overlay = document.getElementById('quiz-overlay');
  const titleEl = document.getElementById('qm-title');
  const footer = document.querySelector('.qm-footer');
  const btnNext = document.getElementById('btn-next');
  if (footer) footer.style.display = 'flex';
  if (btnNext) {
    btnNext.disabled = true;
    btnNext.textContent = t('act.quiz_next') || 'Próxima';
  }
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
    showToast('Erro ao carregar quiz.', 'error');
  }
}

function renderCurrentQuestion() {
  const { questions, currentQ, answers } = currentQuizState;
  if (currentQ >= questions.length) { finishQuiz(); return; }

  const q = questions[currentQ];
  const body = document.getElementById('qm-body');
  if (!body) return;

  // Header progress
  document.getElementById('qm-sub').textContent = t('act.quiz_progress', currentQ + 1, questions.length);
  const progBar = document.getElementById('qm-prog-bar');
  if (progBar) progBar.style.width = `${((currentQ) / questions.length) * 100}%`;

  // Back button visibility
  const btnPrev = document.getElementById('btn-prev');
  if (btnPrev) btnPrev.style.display = currentQ > 0 ? 'inline-block' : 'none';

  // Question render
  body.innerHTML = `
    <div class="question-text">${escHtml(q.question)}</div>
    <div class="question-options">
      ${(q.options || []).map((opt, idx) => {
    const selected = answers[currentQ] === idx;
    return `<button class="option-btn ${selected ? 'selected' : ''}" onclick="selectOption(this, ${idx})">${escHtml(opt)}</button>`;
  }).join('')}
    </div>
  `;

  // Next button label
  const btnNext = document.getElementById('btn-next');
  if (btnNext) {
    btnNext.textContent = (currentQ === questions.length - 1) ? (t('act.quiz_finish') || 'Finalizar') : (t('act.quiz_next') || 'Próxima');
    btnNext.disabled = answers[currentQ] === undefined;
  }
}

function selectOption(el, idx) {
  el.parentElement.querySelectorAll('.option-btn').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  currentQuizState.answers[currentQuizState.currentQ] = idx;
  document.getElementById('btn-next').disabled = false;
}

function nextQ() {
  if (currentQuizState.currentQ < currentQuizState.questions.length - 1) {
    currentQuizState.currentQ++;
    renderCurrentQuestion();
  } else {
    finishQuiz();
  }
}

function prevQ() {
  if (currentQuizState.currentQ > 0) {
    currentQuizState.currentQ--;
    renderCurrentQuestion();
  }
}

async function finishQuiz() {
  try {
    const res = await apiPost(`/activities/quizzes/${currentQuizState.quizId}/submit`, {
      answers: currentQuizState.answers
    });
    const d = res.data;
    const correct = d.correct ?? 0;
    const total = d.total ?? 0;
    const pct = Math.round((correct / total) * 100);

    const footer = document.querySelector('.qm-footer');
    if (footer) footer.style.display = 'none';

    document.getElementById('qm-body').innerHTML = `
      <div class="quiz-result">
        <div class="result-icon">${pct >= 70 ? '🎉' : '💪'}</div>
        <h3>${pct >= 70 ? 'Excelente!' : 'Bom trabalho!'}</h3>
        <p>${correct} de ${total} acertos (${pct}%)</p>
        <button class="quiz-btn" onclick="closeQuiz()">Fechar</button>
      </div>
    `;

    // Update global streak/trophies
    loadUserData();

  } catch (e) {
    console.error(e);
    showToast('Erro ao finalizar quiz.', 'error');
  }
}

async function requestNewExercises(btn) {
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
  try {
    const res = await apiPost('/activities/modules/personalized/generate', {});
    if (res.ok) {
      showToast('Exercícios gerados com sucesso!', 'success');
      await loadActivities();
    } else if (res.status === 429) {
      showToast('Você já gerou exercícios hoje. Volte amanhã!', 'info');
    } else {
      showToast(res.data?.detail || 'Erro ao gerar.', 'error');
    }
  } catch (e) {
    showToast('Erro de conexão.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gerar Novos';
  }
}

function closeQuiz() {
  document.getElementById('quiz-overlay')?.classList.remove('active');
  const footer = document.querySelector('.qm-footer');
  if (footer) footer.style.display = 'none';
  loadQuizzes();
  loadActivities();
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
