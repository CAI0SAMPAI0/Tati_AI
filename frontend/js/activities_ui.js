/* activities_ui.js - Tati AI */

const PERSONALIZED_MODULE_ID = '00000000-0000-0000-0000-000000000001';
const FLASHCARD_PROGRESS_KEY = 'tati_flashcard_progress_v2';
const flashcardsState = {
  decks: [],
  deckMap: {},
  activeDeckId: null,
  activeFilter: 'all',
  activeIndex: 0,
  revealed: false
};
let isNotifPanelOpen = false;
let notifRefreshTimer = null;
let activitiesPushSetupDone = false;

const ACTIVITY_NOTIF_ICONS = {
  correction: '[OK]',
  new_activity: '[NEW]',
  reminder: '[REM]',
  ranking: '[RANK]',
  streak: '[STREAK]',
  streak_reminder: '[STREAK]',
  streak_broken: '[ALERT]',
  trophy: '[TROPHY]',
  welcome: '[HELLO]'
};

window.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  const hasAccess = await _ensureActivitiesPageAccess();
  if (!hasAccess) return;
  initActivitiesNotifications();


  await loadInitialData();

  const savedSubTab = localStorage.getItem('last_subtab') || 'quiz';
  switchSubTab(savedSubTab);
});

async function _ensureActivitiesPageAccess() {
  const user = getUser();
  const isTeacher = isStaff(user);
  const isFreeWindow = _isActivitiesFreeWindowFallback();

  try {
    const access = await apiGet('/users/permissions/access');
    const allowed = isTeacher || isFreeWindow || access.free_mode || access.can_access_activities;
    if (allowed) return true;

    showToast(t('act.restricted_activities'), 'warning');
    setTimeout(() => { window.location.href = 'chat.html'; }, 250);
    return false;
  } catch (e) {
    // Resilient fallback if permissions request fails.
    const fallbackAllowed = isTeacher || isFreeWindow || user?.plan_type === 'full' || user?.is_premium_active;
    if (fallbackAllowed) return true;

    showToast(t('act.restricted_activities'), 'warning');
    setTimeout(() => { window.location.href = 'chat.html'; }, 250);
    return false;
  }
}

function _isActivitiesFreeWindowFallback() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (year < 2026) return true;
  if (year > 2026) return false;
  if (month < 6) return true;
  if (month > 6) return false;
  return day <= 30;
}
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const mainContent = document.querySelector('.main-content');
  if (sidebar) {
    sidebar.classList.add('open');
    sidebar.classList.remove('closed');
  }
  if (overlay) overlay.classList.add('visible');
  if (mainContent) mainContent.classList.remove('expanded');
}

function closeSidebarNav() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const mainContent = document.querySelector('.main-content');
  if (sidebar) {
    sidebar.classList.remove('open');
    sidebar.classList.add('closed');
  }
  if (overlay) overlay.classList.remove('visible');
  if (mainContent) mainContent.classList.add('expanded');
}

function switchSubTab(tabName) {
  document.querySelectorAll('.sub-panel').forEach((panel) => panel.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));

  const panel = document.getElementById(`sub-content-${tabName}`);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.sub-tabs .tab-btn').forEach((btn) => {
    if (btn.getAttribute('onclick')?.includes(`'${tabName}'`)) {
      btn.classList.add('active');
    }
  });

  localStorage.setItem('last_subtab', tabName);

  if (tabName === 'flashcards' && flashcardsState.activeDeckId) {
    renderFlashcardStudy();
  }
}

async function loadInitialData() {
  try {
    const modules = await apiGet('/activities/modules');
    await Promise.all([
      loadUserData(),
      loadQuizzes(modules),
      loadActivities(modules),
      loadFlashcards(modules),
      loadSimulations(),
      loadPodcasts(),
      applyAccessControl()
    ]);
    updateTabCounts(modules);
    I18n.applyToDOM();
  } catch (error) {
    console.error('Erro carregando dados:', error);
  }
}

async function loadPodcasts() {
  const container = document.getElementById('podcast-list-container');
  if (!container) return;

  try {
    const uiLang = (typeof I18n !== 'undefined' && typeof I18n.getLang === 'function')
      ? I18n.getLang()
      : (localStorage.getItem('tati_lang') || 'pt-BR');
    const podcasts = await apiGet(`/activities/podcasts/recommendations?lang=${encodeURIComponent(uiLang)}`);
    if (!podcasts || !podcasts.length) {
      container.innerHTML = `<div class="empty-view"><i class="fa-solid fa-podcast"></i><h3>${t('act.no_podcasts') || 'Nenhum podcast recomendado ainda.'}</h3></div>`;
      return;
    }

    container.innerHTML = podcasts.map((p, index) => `
      <article class="activity-card podcast-card podcast-card-enter" style="--podcast-delay:${index * 80}ms" onclick="openPodcastPage('${p.id}')">
        <div class="podcast-thumb">
          <img src="${p.thumbnail || '/assets/images/podcast_placeholder.jpg'}" alt="${escHtml(p.title)}">
          <div class="podcast-play-overlay"><i class="fa-solid fa-play"></i></div>
        </div>
        <div class="activity-card-body">
          <div class="activity-card-head">
            <h3 class="activity-card-title">${escHtml(p.title)}</h3>
            <span class="activity-chip ${p.level.toLowerCase()}">${p.level}</span>
          </div>
          <p class="activity-card-desc">${escHtml(p.description)}</p>
          ${p.recommendation_reason ? `<p class="activity-card-desc podcast-reason"><i class="fa-solid fa-wand-magic-sparkles"></i> ${escHtml(t('act.podcast_reason_prefix') || 'Sugestão IA')}: ${escHtml(p.recommendation_reason)}</p>` : ''}
          <div class="podcast-badges-row">
            <span class="podcast-source-badge"><i class="fa-solid ${p.media_type === 'audio' ? 'fa-wave-square' : 'fa-circle-play'}"></i> ${escHtml(p.source_name || 'Web')}</span>
            ${p.has_full_transcript ? `<span class="podcast-source-badge is-translation">${t('act.translation_ready') || 'Tradução completa'}</span>` : ''}
          </div>
          <div class="activity-card-meta">
            <span><i class="fa-solid fa-clock"></i> ${p.duration || '--:--'}</span>
            <span><i class="fa-solid fa-tag"></i> ${escHtml(p.category)}</span>
          </div>
        </div>
      </article>
    `).join('');
  } catch (e) {
    console.error('Erro ao carregar podcasts:', e);
  }
}

function openPodcastPage(id) {
  const uiLang = (typeof I18n !== 'undefined' && typeof I18n.getLang === 'function')
    ? I18n.getLang()
    : (localStorage.getItem('tati_lang') || 'pt-BR');
  window.location.href = `podcast_view.html?id=${id}&lang=${encodeURIComponent(uiLang)}`;
}

async function loadUserData() {
  const user = getUser();
  if (!user) return;

  const displayName = user.name || user.username || t('act.user_fallback') || 'Usuario';
  const nameEl = document.getElementById('header-user-name');
  if (nameEl) nameEl.textContent = displayName;

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
    const streakEl = document.getElementById('streak-count-text');
    const trophyEl = document.getElementById('trophy-count-text');
    if (streakEl) streakEl.textContent = streakData.current_streak || 0;
    if (trophyEl) trophyEl.textContent = `${streakData.trophies_earned || 0}/50`;
  } catch (_) {
    // non-blocking
  }
}

function isEnglishUI() {
  try {
    const lang = typeof I18n !== 'undefined' && typeof I18n.getLang === 'function'
      ? I18n.getLang()
      : (localStorage.getItem('tati_lang') || 'pt-BR');
    return String(lang).toLowerCase().startsWith('en');
  } catch (_) {
    return false;
  }
}

function updateTabCounts(modules) {
  const quizCount = modules.reduce((sum, moduleItem) => {
    if (moduleItem.id === PERSONALIZED_MODULE_ID) return sum;
    return sum + (moduleItem.quizzes?.length || 0);
  }, 0);

  const flashcardsCount = modules.reduce((sum, moduleItem) => sum + (moduleItem.flashcards?.length || 0), 0);

  const personalized = modules.find((moduleItem) => moduleItem.id === PERSONALIZED_MODULE_ID);
  const exercisesCount = personalized?.quizzes?.length || 0;

  setTabCount('quiz', quizCount);
  setTabCount('flashcards', flashcardsCount);
  setTabCount('atividades', exercisesCount);
}

function setTabCount(tabName, value) {
  const tabBtn = Array.from(document.querySelectorAll('.sub-tabs .tab-btn')).find((buttonEl) =>
    buttonEl.getAttribute('onclick')?.includes(`'${tabName}'`)
  );
  if (!tabBtn) return;

  let badge = tabBtn.querySelector('.tab-count-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tab-count-badge';
    tabBtn.appendChild(badge);
  }

  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  badge.textContent = String(safeValue);
  badge.style.display = safeValue > 0 ? 'inline-flex' : 'none';
}

function openQuizPage(quizId) {
  if (!quizId) return;
  window.location.href = `quiz.html?id=${encodeURIComponent(quizId)}`;
}

async function loadQuizzes(modulesInput = null) {
  const modules = modulesInput || await apiGet('/activities/modules');
  const container = document.getElementById('quiz-list-container');
  if (!container) return;

  const quizzes = [];
  modules.forEach((moduleItem) => {
    if (moduleItem.id === PERSONALIZED_MODULE_ID) return;
    (moduleItem.quizzes || []).forEach((quizItem) => {
      quizzes.push({
        ...quizItem,
        attempts: quizItem.attempts || 0,
        module_title: moduleItem.title || ''
      });
    });
  });

  if (!quizzes.length) {
    container.innerHTML = `<div class="empty-view"><i class="fa-solid fa-circle-question"></i><h3>${isEnglishUI() ? 'No quizzes yet' : 'Nenhum quiz disponivel'}</h3></div>`;
    return;
  }

  container.innerHTML = quizzes.map((quizItem) => {
    const done = quizItem.attempts > 0;
    const statusLabel = done
      ? (t('act.quiz_done') || (isEnglishUI() ? 'Completed' : 'Concluido'))
      : (t('act.quiz_new') || (isEnglishUI() ? 'New' : 'Novo'));
    const actionLabel = done
      ? (t('act.quiz_redo') || (isEnglishUI() ? 'Redo Quiz' : 'Refazer Quiz'))
      : (t('act.quiz_start') || (isEnglishUI() ? 'Start Quiz' : 'Iniciar Quiz'));
    const questionCountRaw = Array.isArray(quizItem.questions)
      ? quizItem.questions.length
      : Number(quizItem.question_count || quizItem.total_questions || 0);
    const questionCount = Number.isFinite(questionCountRaw) ? Math.max(0, questionCountRaw) : 0;

    return `
      <article class="activity-card quiz-activity-card" onclick="openQuizPage('${quizItem.id}')">
        <div class="activity-card-head">
          <h3 class="activity-card-title">${escHtml(quizItem.title || 'Quiz')}</h3>
          <span class="activity-chip ${done ? 'done' : 'new'}">${statusLabel}</span>
        </div>
        <p class="activity-card-desc">${escHtml(quizItem.description || (isEnglishUI() ? 'Practice your mistakes and consolidate the topic.' : 'Pratique seus erros e consolide o conteudo.'))}</p>
        <div class="activity-card-meta">
          ${questionCount > 0 ? `<span><i class="fa-regular fa-circle-question"></i> ${questionCount} ${t('act.quiz_questions') || (isEnglishUI() ? 'questions' : 'perguntas')}</span>` : ''}
          <span><i class="fa-solid fa-check"></i> ${quizItem.attempts} ${t('act.quiz_attempts') || (isEnglishUI() ? 'attempts' : 'tentativas')}</span>
          ${quizItem.module_title ? `<span><i class="fa-solid fa-book-open"></i> ${escHtml(quizItem.module_title)}</span>` : ''}
        </div>
        <button class="activity-primary-btn ${done ? 'is-outline' : ''}" onclick="event.stopPropagation(); openQuizPage('${quizItem.id}')">
          <i class="fa-solid fa-play"></i> ${actionLabel}
        </button>
      </article>
    `;
  }).join('');
}

async function loadActivities(modulesInput = null) {
  try {
    const container = document.getElementById('sub-content-atividades');
    if (!container) return;

    const modules = modulesInput || await apiGet('/activities/modules');
    const personalizedModule = modules.find((moduleItem) => moduleItem.id === PERSONALIZED_MODULE_ID);
    const personalizedQuizzes = personalizedModule ? [...(personalizedModule.quizzes || [])] : [];
    const flashcards = personalizedModule ? (personalizedModule.flashcards || []) : [];

    const statusOrder = { pending: 0, done: 1, corrected: 2 };
    personalizedQuizzes.sort((itemA, itemB) => {
      const statusA = String(itemA.status || ((itemA.attempts || 0) > 0 ? 'done' : 'pending')).toLowerCase();
      const statusB = String(itemB.status || ((itemB.attempts || 0) > 0 ? 'done' : 'pending')).toLowerCase();
      return (statusOrder[statusA] ?? 9) - (statusOrder[statusB] ?? 9);
    });

    const submissions = await apiGet('/activities/submissions/my');
    let html = '';

    if (personalizedQuizzes.length > 0 || flashcards.length > 0) {
      html += personalizedQuizzes.map((quizItem) => {
        const status = String(quizItem.status || ((quizItem.attempts || 0) > 0 ? 'done' : 'pending')).toLowerCase();
        const statusLabel =
          status === 'corrected' ? (t('act.status_corrected') || 'Corrigido') :
          status === 'done' ? (t('act.status_done') || 'Feito') :
          (t('act.status_pending') || 'Pendente');

        return `
          <div class="profile-card act-card pending-task" onclick="window.location.href='quiz.html?id=${quizItem.id}'" style="border-left: 4px solid var(--primary); cursor: pointer;">
            <div class="act-header">
              <h4><i class="fa-solid fa-circle-question"></i> ${escHtml(quizItem.title)}</h4>
              <span class="act-status ${status}">${statusLabel}</span>
            </div>
            <p class="act-desc">${escHtml(quizItem.description || t('act.personalized_desc') || 'Baseado nos seus erros recentes.')}</p>
            <small><i class="fa-solid fa-play"></i> ${t('act.quiz_start') || 'Clique para comecar'}</small>
          </div>
        `;
      }).join('');

      if (flashcards.length > 0) {
        html += `
          <div class="profile-card act-card pending-task" onclick="switchSubTab('flashcards')" style="border-left: 4px solid var(--secondary); cursor: pointer;">
            <div class="act-header">
              <h4><i class="fa-solid fa-layer-group"></i> ${t('act.personalized_fc') || 'Revisao de Vocabulario'}</h4>
              <span class="act-status pending">${flashcards.length} ${t('act.items') || 'itens'}</span>
            </div>
            <p class="act-desc">${t('act.personalized_fc_desc') || 'Palavras que voce errou ou esta aprendendo.'}</p>
            <small><i class="fa-solid fa-arrow-right"></i> ${t('act.view_flashcards') || 'Ver Flashcards'}</small>
          </div>
        `;
      }
    } else {
      html += `
        <div style="text-align:center; padding: 2rem;">
          <h4 class="act-section-title"><i class="fa-solid fa-star"></i> ${t('act.personalized_pending') || 'Pratica Personalizada'}</h4>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
            ${t('act.no_exercises_yet') || 'A Tati esta analisando seu progresso. Exercicios personalizados aparecerao aqui em breve!'}
          </p>
        </div>
      `;
    }

    if (submissions.length > 0) {
      html += `<h4 class="act-section-title"><i class="fa-solid fa-history"></i> ${t('act.history') || 'Historico de Atividades'}</h4>`;
      html += submissions.map((submission) => {
        const moduleTitle = submission.modules?.title || 'Atividade';
        const score = submission.score != null ? `<div class="act-score-label">${submission.score}/100</div>` : '';
        const status = String(submission.status || 'pending').toLowerCase();
        const statusLabel =
          status === 'corrected' ? t('act.status_corrected') :
          status === 'done' ? t('act.status_done') :
          t('act.status_pending');

        return `
          <div class="profile-card act-card">
            <div class="act-header">
              <h4>${escHtml(moduleTitle)}</h4>
              <span class="act-status ${status}">${statusLabel || status}</span>
            </div>
            ${score}
            <p class="act-answer">${escHtml(submission.student_answer)}</p>
            <span class="act-date">${new Date(submission.created_at).toLocaleDateString()}</span>
          </div>
        `;
      }).join('');
    }

    container.innerHTML = html || '<div class="empty-view"><i class="fa-solid fa-notebook"></i><h3>Nenhuma atividade</h3></div>';
    I18n.applyToDOM(container);
  } catch (error) {
    console.error(error);
  }
}

async function loadFlashcards(modulesInput = null) {
  const modules = modulesInput || await apiGet('/activities/modules');
  const container = document.getElementById('sub-content-flashcards');
  if (!container) return;

  const decks = modules
    .filter((moduleItem) => Array.isArray(moduleItem.flashcards) && moduleItem.flashcards.length > 0)
    .map((moduleItem) => ({
      id: String(moduleItem.id),
      title: moduleItem.title || (isEnglishUI() ? 'Flashcards' : 'Flashcards'),
      description: moduleItem.description || '',
      ai: moduleItem.id === PERSONALIZED_MODULE_ID,
      cards: (moduleItem.flashcards || []).map((item, index) => normalizeFlashcard(item, index))
    }));

  flashcardsState.decks = decks;
  flashcardsState.deckMap = Object.fromEntries(decks.map((deck) => [deck.id, deck]));

  if (!decks.length) {
    flashcardsState.activeDeckId = null;
    container.innerHTML = `
      <div class="empty-view">
        <i class="fa-solid fa-layer-group"></i>
        <h3>${t('act.fc_empty_title') || (isEnglishUI() ? 'No flashcards yet' : 'Flashcards personalizados')}</h3>
        <p>${t('act.fc_empty_sub') || (isEnglishUI() ? 'Your flashcards will appear here soon.' : 'Seus flashcards aparecerao aqui em breve.')}</p>
      </div>
    `;
    return;
  }

  if (flashcardsState.activeDeckId && flashcardsState.deckMap[flashcardsState.activeDeckId]) {
    renderFlashcardStudy();
    return;
  }

  renderFlashcardDeckList();
}

function renderFlashcardDeckList() {
  const container = document.getElementById('sub-content-flashcards');
  if (!container) return;

  const html = flashcardsState.decks.map((deck) => {
    const progress = getDeckProgress(deck.id, deck.cards.length);
    const toReview = Math.max(deck.cards.length - progress.seenSet.size, 0);

    return `
      <article class="flash-deck-card">
        <div class="flash-deck-head">
          <h3 class="flash-deck-title">${escHtml(deck.title)}</h3>
          ${deck.ai ? '<span class="flash-ai-chip"><i class="fa-solid fa-microchip"></i> IA</span>' : ''}
        </div>
        <p class="flash-deck-sub">${escHtml(deck.description || (isEnglishUI() ? 'Review key concepts with spaced repetition.' : 'Revise conceitos importantes com repeticao inteligente.'))}</p>
        <div class="flash-deck-meta">
          <span><i class="fa-solid fa-layer-group"></i> ${deck.cards.length} ${isEnglishUI() ? 'cards' : 'cards'}</span>
          <span class="flash-review-pill">${toReview} ${isEnglishUI() ? 'to review' : 'p/ revisar'}</span>
        </div>
        <div class="flash-deck-actions">
          <button class="activity-primary-btn" onclick="startFlashcardsDeck('${deck.id}')">
            <i class="fa-solid fa-play"></i> ${isEnglishUI() ? 'Study' : 'Estudar'}
          </button>
          <button class="activity-icon-btn" title="${isEnglishUI() ? 'Reset progress' : 'Reiniciar progresso'}" onclick="resetFlashcardsDeck('${deck.id}')">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = `<div class="flash-decks-grid">${html}</div>`;
}

function startFlashcardsDeck(deckId) {
  if (!flashcardsState.deckMap[deckId]) return;
  flashcardsState.activeDeckId = deckId;
  flashcardsState.activeFilter = 'all';
  flashcardsState.revealed = false;

  const progress = getDeckProgress(deckId, flashcardsState.deckMap[deckId].cards.length);
  flashcardsState.activeIndex = Math.min(progress.lastIndex, Math.max(flashcardsState.deckMap[deckId].cards.length - 1, 0));

  renderFlashcardStudy();
}

function resetFlashcardsDeck(deckId) {
  resetDeckProgress(deckId);
  if (flashcardsState.activeDeckId === deckId) {
    flashcardsState.activeIndex = 0;
    flashcardsState.revealed = false;
    flashcardsState.activeFilter = 'all';
  }
  renderFlashcardDeckList();
}

function exitFlashcardStudy() {
  flashcardsState.activeDeckId = null;
  flashcardsState.activeIndex = 0;
  flashcardsState.revealed = false;
  renderFlashcardDeckList();
}

function setFlashcardFilter(filter) {
  flashcardsState.activeFilter = filter;
  flashcardsState.activeIndex = 0;
  flashcardsState.revealed = false;
  renderFlashcardStudy();
}

function getDeckProgressStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FLASHCARD_PROGRESS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveDeckProgressStore(store) {
  localStorage.setItem(FLASHCARD_PROGRESS_KEY, JSON.stringify(store));
}

function getDeckProgress(deckId, totalCards) {
  const store = getDeckProgressStore();
  const deckProgress = store[deckId] || {};
  const seen = Array.isArray(deckProgress.seen) ? deckProgress.seen : [];
  const validSeen = seen.filter((index) => Number.isInteger(index) && index >= 0 && index < totalCards);
  const seenSet = new Set(validSeen);

  return {
    seenSet,
    lastIndex: Number.isInteger(deckProgress.lastIndex) ? Math.min(Math.max(deckProgress.lastIndex, 0), Math.max(totalCards - 1, 0)) : 0
  };
}

function saveDeckCursor(deckId, index) {
  const store = getDeckProgressStore();
  const deckProgress = store[deckId] || {};
  store[deckId] = {
    ...deckProgress,
    seen: Array.isArray(deckProgress.seen) ? deckProgress.seen : [],
    lastIndex: index
  };
  saveDeckProgressStore(store);
}

function markDeckCardSeen(deckId, index) {
  const store = getDeckProgressStore();
  const deckProgress = store[deckId] || {};
  const seen = new Set(Array.isArray(deckProgress.seen) ? deckProgress.seen : []);
  seen.add(index);
  store[deckId] = {
    ...deckProgress,
    seen: Array.from(seen),
    lastIndex: deckProgress.lastIndex || 0
  };
  saveDeckProgressStore(store);
}

function resetDeckProgress(deckId) {
  const store = getDeckProgressStore();
  delete store[deckId];
  saveDeckProgressStore(store);
}

function getVisibleFlashcards(deck) {
  const progress = getDeckProgress(deck.id, deck.cards.length);
  if (flashcardsState.activeFilter !== 'review') {
    return deck.cards.map((card, index) => ({ card, index }));
  }

  return deck.cards
    .map((card, index) => ({ card, index }))
    .filter((item) => !progress.seenSet.has(item.index));
}

function renderFlashcardStudy() {
  const container = document.getElementById('sub-content-flashcards');
  const deck = flashcardsState.deckMap[flashcardsState.activeDeckId];
  if (!container || !deck) {
    renderFlashcardDeckList();
    return;
  }

  const visible = getVisibleFlashcards(deck);
  const progress = getDeckProgress(deck.id, deck.cards.length);
  const reviewCount = Math.max(deck.cards.length - progress.seenSet.size, 0);

  if (!visible.length) {
    container.innerHTML = `
      <div class="flash-study-shell">
        <div class="flash-study-toolbar">
          <button class="flash-filter-btn is-active" onclick="setFlashcardFilter('all')">${isEnglishUI() ? 'All' : 'Todos'}</button>
          <button class="flash-filter-btn" onclick="setFlashcardFilter('review')">${isEnglishUI() ? 'Review' : 'Revisar'} <span>0</span></button>
          <button class="flash-close-btn" onclick="exitFlashcardStudy()">${isEnglishUI() ? 'Back' : 'Voltar'}</button>
        </div>
        <div class="empty-view">
          <i class="fa-solid fa-circle-check"></i>
          <h3>${isEnglishUI() ? 'No cards pending review' : 'Sem cards pendentes para revisar'}</h3>
          <p>${isEnglishUI() ? 'Switch to ALL to continue studying this deck.' : 'Troque para TODOS para continuar estudando este deck.'}</p>
        </div>
      </div>
    `;
    return;
  }

  flashcardsState.activeIndex = Math.min(flashcardsState.activeIndex, visible.length - 1);
  flashcardsState.activeIndex = Math.max(flashcardsState.activeIndex, 0);

  const current = visible[flashcardsState.activeIndex];
  const { card, index } = current;
  const pct = Math.round(((flashcardsState.activeIndex + 1) / visible.length) * 100);
  const revealHint = isEnglishUI() ? 'Click to reveal' : 'Clique para revelar';

  saveDeckCursor(deck.id, index);

  container.innerHTML = `
    <div class="flash-study-shell">
      <div class="flash-study-toolbar">
        <button class="flash-filter-btn ${flashcardsState.activeFilter === 'all' ? 'is-active' : ''}" onclick="setFlashcardFilter('all')">${isEnglishUI() ? 'All' : 'Todos'}</button>
        <button class="flash-filter-btn ${flashcardsState.activeFilter === 'review' ? 'is-active' : ''}" onclick="setFlashcardFilter('review')">${isEnglishUI() ? 'Review' : 'Revisar'} <span>${reviewCount}</span></button>
        <button class="flash-close-btn" onclick="exitFlashcardStudy()">${isEnglishUI() ? 'Back' : 'Voltar'}</button>
      </div>

      <h3 class="flash-study-title">${escHtml(deck.title)}</h3>
      <p class="flash-study-subtitle">${escHtml(deck.description || '')}</p>

      <div class="flash-study-progress-label">${isEnglishUI() ? 'Card' : 'Card'} ${flashcardsState.activeIndex + 1} ${isEnglishUI() ? 'of' : 'de'} ${visible.length}</div>
      <div class="flash-study-progress-track">
        <div class="flash-study-progress-fill" style="width:${pct}%"></div>
      </div>

      <button class="flash-study-card ${flashcardsState.revealed ? 'is-revealed' : ''}" onclick="toggleFlashcardReveal()">
        <span class="flash-study-label">${flashcardsState.revealed ? (isEnglishUI() ? 'Answer' : 'Resposta') : (isEnglishUI() ? 'Concept' : 'Conceito')}</span>
        <h4>${escHtml(card.front)}</h4>
        ${flashcardsState.revealed ? `<p class="flash-study-back">${escHtml(card.back)}</p>` : ''}
        ${flashcardsState.revealed && card.hint ? `<p class="flash-study-hint">${escHtml(card.hint)}</p>` : ''}
        <div class="flash-study-tip"><i class="fa-solid fa-rotate-right"></i> ${flashcardsState.revealed ? (isEnglishUI() ? 'Click to hide' : 'Clique para ocultar') : revealHint}</div>
      </button>

      <div class="flash-study-nav">
        <button class="flash-nav-btn" onclick="prevFlashcardStudy()" ${flashcardsState.activeIndex === 0 ? 'disabled' : ''}>${isEnglishUI() ? 'Previous' : 'Anterior'}</button>
        <button class="flash-nav-btn is-primary" onclick="toggleFlashcardReveal()">${flashcardsState.revealed ? (isEnglishUI() ? 'Hide' : 'Ocultar') : (isEnglishUI() ? 'Reveal' : 'Revelar')}</button>
        <button class="flash-nav-btn" onclick="nextFlashcardStudy()" ${flashcardsState.activeIndex === visible.length - 1 ? 'disabled' : ''}>${isEnglishUI() ? 'Next' : 'Proximo'}</button>
      </div>
    </div>
  `;
}

function toggleFlashcardReveal() {
  const deck = flashcardsState.deckMap[flashcardsState.activeDeckId];
  if (!deck) return;

  const visible = getVisibleFlashcards(deck);
  const current = visible[flashcardsState.activeIndex];
  if (!current) return;

  flashcardsState.revealed = !flashcardsState.revealed;
  if (flashcardsState.revealed) {
    markDeckCardSeen(deck.id, current.index);
  }
  renderFlashcardStudy();
}

function prevFlashcardStudy() {
  const deck = flashcardsState.deckMap[flashcardsState.activeDeckId];
  if (!deck) return;
  const visible = getVisibleFlashcards(deck);
  if (!visible.length) return;

  flashcardsState.activeIndex = Math.max(0, flashcardsState.activeIndex - 1);
  flashcardsState.revealed = false;
  renderFlashcardStudy();
}

function nextFlashcardStudy() {
  const deck = flashcardsState.deckMap[flashcardsState.activeDeckId];
  if (!deck) return;
  const visible = getVisibleFlashcards(deck);
  if (!visible.length) return;

  flashcardsState.activeIndex = Math.min(visible.length - 1, flashcardsState.activeIndex + 1);
  flashcardsState.revealed = false;
  renderFlashcardStudy();
}

function normalizeFlashcard(item, orderIndex) {
  const front = item?.word || item?.front || item?.question || `${isEnglishUI() ? 'Card' : 'Card'} ${orderIndex + 1}`;
  const back = item?.translation || item?.back || item?.answer || '';
  const hint = item?.example || item?.hint || '';
  return { front, back, hint, order: item?.order || orderIndex };
}

const SIM_KEY_MAP = {
  'Check-in no Aeroporto': 'airport_checkin',
  'Entrevista de Emprego': 'job_interview',
  'Fazendo Compras': 'shopping',
  'No Aeroporto': 'at_airport',
  'No Hotel': 'at_hotel',
  'No Medico': 'at_doctor',
  'No Restaurante': 'at_restaurant',
  'Pedido no Restaurante': 'restaurant_order'
};

async function loadSimulations() {
  try {
    const data = await apiGet('/simulation/scenarios');
    const container = document.getElementById('sub-content-simulations');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = `<p class="empty-view">${t('act.sim_none') || 'Sem simulacoes'}</p>`;
      return;
    }

    container.innerHTML = `<div class="simulation-grid">${data.map((scenario) => {
      const key = SIM_KEY_MAP[scenario.name];
      const title = key ? t(`sim.title_${key}`) : scenario.name;
      const desc = key ? t(`sim.desc_${key}`) : scenario.description;
      const diff = getDiffLabel(scenario.difficulty);
      return `
        <div class="sim-card" onclick="window.location.href='simulation.html?id=${scenario.id}'">
          <div class="scenario-icon">${scenario.icon || 'Sim'}</div>
          <h3>${escHtml(title)}</h3>
          <p>${escHtml(desc || '')}</p>
          <span class="scenario-difficulty ${diff}">${diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
        </div>
      `;
    }).join('')}</div>`;
  } catch (error) {
    console.error(error);
  }
}

function getDiffLabel(difficulty) {
  const key = difficulty?.toLowerCase().replace('-', '_');
  return t(`level.${key}`) || difficulty;
}

function openFeedbackModal() { document.getElementById('feedback-modal')?.classList.add('active'); }
function closeFeedbackModal() { document.getElementById('feedback-modal')?.classList.remove('active'); }

async function handleFeedbackSubmit(event) {
  event.preventDefault();
  const type = document.querySelector('input[name="fb-type"]:checked')?.value;
  const title = document.getElementById('fb-title')?.value;
  const desc = document.getElementById('fb-desc')?.value;

  try {
    await apiPost('/validation/feedback', { type, title, description: desc });
    showToast('Feedback enviado! Obrigado.', 'success');
    closeFeedbackModal();
  } catch (_) {
    showToast('Erro ao enviar feedback.', 'error');
  }
}

function startQuiz(quizId) {
  openQuizPage(quizId);
}

function loadQuizFromAPI() {}
function renderCurrentQuestion() {}
function selectOption() {}
function nextQ() {}
function prevQ() {}
async function finishQuiz() {}

async function requestNewExercises(btn) {
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
  try {
    const res = await apiPost('/activities/modules/personalized/generate', {});
    if (res.ok) {
      showToast('Exercicios gerados com sucesso!', 'success');
      await loadInitialData();
    } else if (res.status === 429) {
      showToast('Voce ja gerou exercicios hoje. Volte amanha!', 'info');
    } else {
      showToast(res.data?.detail || 'Erro ao gerar.', 'error');
    }
  } catch (_) {
    showToast('Erro de conexao.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gerar Novos';
  }
}

function closeQuiz() {
  document.getElementById('quiz-overlay')?.classList.remove('active');
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}




function isNotificationKey(text) {
  return typeof text === 'string' && text.startsWith('notif.');
}

function resolveNotificationText(rawText, payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  if (isNotificationKey(rawText)) {
    const translated = t(rawText, safePayload);
    return translated === rawText ? rawText : translated;
  }
  return String(rawText || '');
}

function notificationTimeAgo(dateStr) {
  const created = new Date(dateStr).getTime();
  if (!Number.isFinite(created)) return '';

  const diff = Date.now() - created;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('act.notif_time_now');
  if (minutes < 60) return t('act.notif_time_min', minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('act.notif_time_hour', hours);

  const lang = (typeof I18n !== 'undefined' && typeof I18n.getLang === 'function')
    ? I18n.getLang()
    : (localStorage.getItem('tati_lang') || 'pt-BR');
  return new Date(dateStr).toLocaleDateString(lang);
}

function updateActivitiesNotifBadge(unreadCount) {
  const dot = document.querySelector('.btn-notif .notif-dot');
  if (!dot) return;
  dot.style.display = Number(unreadCount || 0) > 0 ? 'block' : 'none';
}

async function loadActivitiesNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  try {
    const res = await apiGet('/notifications/');
    const notifications = Array.isArray(res.notifications) ? res.notifications : [];
    const unread = Number(res.unread || 0);

    updateActivitiesNotifBadge(unread);

    if (!notifications.length) {
      list.innerHTML = '<div class="notif-empty">' + escHtml(t('act.notif_empty') || 'Nenhuma notificacao ainda.') + '</div>';
      return;
    }

    list.innerHTML = notifications.map((item) => {
      const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
      const icon = ACTIVITY_NOTIF_ICONS[item.type] || '[NOTIF]';
      const title = resolveNotificationText(item.title, payload);
      const message = resolveNotificationText(item.message, payload);
      const createdAt = notificationTimeAgo(item.created_at);
      const unreadClass = item.read ? '' : 'unread';

      return '<article class="notif-item ' + unreadClass + '" onclick="markActivitiesNotifRead(\'' + item.id + '\', this)">'
        + '<p class="notif-item-title">' + escHtml(icon) + ' ' + escHtml(title) + '</p>'
        + '<p class="notif-item-message">' + escHtml(message) + '</p>'
        + '<span class="notif-item-time">' + escHtml(createdAt) + '</span>'
        + '</article>';
    }).join('');
  } catch (error) {
    console.error('Erro ao carregar notificacoes:', error);
    list.innerHTML = '<div class="notif-empty">' + escHtml(t('act.notif_error') || 'Erro ao carregar notificacoes.') + '</div>';
  }
}

async function markActivitiesNotifRead(id, element) {
  if (!id || !element || !element.classList.contains('unread')) return;
  try {
    await apiPost('/notifications/' + id + '/read', {});
    element.classList.remove('unread');
    const remainingUnread = document.querySelectorAll('#notif-list .notif-item.unread').length;
    updateActivitiesNotifBadge(remainingUnread);
  } catch (error) {
    console.error('Erro ao marcar notificacao como lida:', error);
  }
}

async function markAllActivitiesNotifRead() {
  try {
    await apiPost('/notifications/read-all', {});
    document.querySelectorAll('#notif-list .notif-item.unread').forEach((el) => el.classList.remove('unread'));
    updateActivitiesNotifBadge(0);
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
  }
}

window.markAllActivitiesNotifRead = markAllActivitiesNotifRead;
window.markActivitiesNotifRead = markActivitiesNotifRead;

function toggleActivitiesNotifPanel(forceOpen = null) {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;

  if (forceOpen === true) {
    isNotifPanelOpen = true;
  } else if (forceOpen === false) {
    isNotifPanelOpen = false;
  } else {
    isNotifPanelOpen = !isNotifPanelOpen;
  }

  modal.classList.toggle('active', isNotifPanelOpen);
  if (isNotifPanelOpen) loadActivitiesNotifications();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeWebPushIfAvailable() {
  if (activitiesPushSetupDone) return;
  activitiesPushSetupDone = true;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  try {
    const config = await apiGet('/notifications/config');
    const publicKey = String(config?.vapid_public_key || '').trim();
    if (!publicKey) return;

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await apiPost('/notifications/subscribe', existing.toJSON());
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await apiPost('/notifications/subscribe', subscription.toJSON());
  } catch (error) {
    console.error('Falha ao registrar push notification:', error);
  }
}

function initActivitiesNotifications() {
  const notifBtn = document.querySelector('.btn-notif');
  const notifModal = document.getElementById('notif-modal');
  if (!notifBtn || !notifModal) return;

  notifBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleActivitiesNotifPanel();
  });

  notifModal.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('click', () => {
    if (!isNotifPanelOpen) return;
    toggleActivitiesNotifPanel(false);
  });

  loadActivitiesNotifications();
  if (notifRefreshTimer) clearInterval(notifRefreshTimer);
  notifRefreshTimer = setInterval(loadActivitiesNotifications, 5 * 60 * 1000);

  subscribeWebPushIfAvailable();
}
