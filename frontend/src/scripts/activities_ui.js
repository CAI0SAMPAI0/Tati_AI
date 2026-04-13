/* activities_ui.js — Lógica da página de atividades do aluno */

if (!requireAuth()) throw new Error('Unauthenticated');
let _user = getUser();

// ── Estado ─────────────────────────────────────────────────────
let allModules = [];
let allProgress = {};   // quiz_id → {score, correct_q, total_q}
let currentTab = 'quiz';
let filteredMods = [];

// Quiz state
let activeQuiz = null;
let questions = [];
let currentQIdx = 0;
let answers = [];
let selectedOption = null;
let answered = false;
let currentModDetail = null;

// Flashcard state
let fcCards = [];
let fcIdx = 0;
let fcKnown = 0;

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    _initUserBadge();
    
    // Aplica traduções iniciais
    if (window.I18n) I18n.applyToDOM();

    await Promise.all([loadModules(), loadProgress(), loadTrophies()]);
    initTabs();
});

function _initUserBadge() {
    const badge = document.getElementById('user-level-badge');
    const avatar = document.getElementById('topbar-avatar');
    _user = getUser();
    if (_user) {
        const levelKey = `level.${(_user.level || '').toLowerCase().replace('-', '_').replace(' ', '_')}`;
        badge.textContent = t(levelKey) !== levelKey ? t(levelKey) : (_user.level || 'Student');
        
        if (_user.avatar_url || _user.image) {
            const imgUrl = _user.avatar_url || _user.image;
            avatar.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            avatar.style.background = 'none';
        } else {
            const nameParts = (_user.name || _user.username || '??').split(' ');
            const initials = nameParts.length > 1 
                ? (nameParts[0][0] + nameParts[nameParts.length-1][0]).toUpperCase()
                : (nameParts[0][0] + (nameParts[0][1] || '')).toUpperCase();
            avatar.textContent = initials;
        }
    }
}

async function loadModules() {
    try {
        allModules = await apiGet('/activities/modules');
        // A filtragem do dropdown acontece dentro do renderCurrentTab agora
    } catch (e) { 
        console.error('Erro ao carregar módulos:', e);
        allModules = []; 
    }
}

function updateFilterDropdown() {
    const sel = document.getElementById('filter-course');
    if (!sel) return;

    const currentVal = sel.value;
    sel.innerHTML = `<option value="">${t('act.all_modules')}</option>`;

    let relevantModules = [];
    if (currentTab === 'quiz') relevantModules = allModules.filter(m => m.has_quiz);
    else if (currentTab === 'flashcards') relevantModules = allModules.filter(m => m.has_flashcards);
    else relevantModules = allModules.filter(m => !m.title.toLowerCase().includes('flashcard')); // Filtra pacotes de IA da aba exercícios

    relevantModules.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id; opt.textContent = m.title;
        if (m.id === currentVal) opt.selected = true;
        sel.appendChild(opt);
    });
}

async function loadProgress() {
    try {
        const prog = await apiGet('/activities/quizzes/my/progress');
        prog.forEach(p => { allProgress[p.quiz_id] = p; });
    } catch (e) { }
}

async function loadTrophies() {
    try {
        const trophies = await apiGet('/activities/trophies/');
        if (trophies.length) {
            document.getElementById('trophy-count').style.display = 'flex';
            document.getElementById('trophy-num').textContent = trophies.length;
        }
    } catch (e) { }
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.act-tab').forEach(b => b.classList.remove('active'));
    
    const targetBtn = btn || document.querySelector(`.act-tab[onclick*="'${tab}'"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    sessionStorage.setItem('tati_activities_tab', tab);
    
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);

    document.getElementById('panel-quiz').style.display = tab === 'quiz' ? 'block' : 'none';
    document.getElementById('panel-flashcards').style.display = tab === 'flashcards' ? 'block' : 'none';
    document.getElementById('panel-exercises').style.display = tab === 'exercises' ? 'block' : 'none';
    
    updateFilterDropdown();
    renderCurrentTab();
}

function initTabs() {
    const params = new URLSearchParams(window.location.search);
    const saved = params.get('tab') || sessionStorage.getItem('tati_activities_tab') || 'quiz';
    switchTab(saved);
}

function renderCurrentTab() {
    applyFilters();
}

function applyFilters() {
    const course = document.getElementById('filter-course')?.value;
    const searchInput = document.getElementById('search-input');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    
    filteredMods = allModules.filter(m =>
        (!course || m.id === course) &&
        (!search || m.title.toLowerCase().includes(search) || (m.description || '').toLowerCase().includes(search))
    );

    // Contadores baseados no conteúdo real
    document.getElementById('tab-count-quiz').textContent = allModules.filter(m => m.has_quiz).length;
    document.getElementById('tab-count-flashcards').textContent = allModules.filter(m => m.has_flashcards).length;
    document.getElementById('tab-count-exercises').textContent = allModules.filter(m => !m.title.toLowerCase().includes('flashcard')).length;

    if (currentTab === 'quiz') renderQuizTab();
    if (currentTab === 'flashcards') renderFlashcardsTab();
    if (currentTab === 'exercises') renderExercisesTab();
}

// ── Quiz tab ──────────────────────────────────────────────────
async function renderQuizTab() {
    const container = document.getElementById('quiz-list');
    if (!container) return;
    
    const quizMods = filteredMods.filter(m => m.has_quiz);

    if (!quizMods.length) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-question"></i><p>${t('act.no_quizzes')}</p></div>`;
        return;
    }

    container.innerHTML = quizMods.map(mod => {
        // Tenta pegar o ID do quiz da lista (se veio) ou espera o openModule
        const quizId = mod.quizzes && mod.quizzes[0] ? mod.quizzes[0].id : null;
        const prog = quizId ? allProgress[quizId] : null;
        const done = !!prog;
        const score = prog?.score ?? null;

        return `
        <div class="act-card" onclick="openModule('${mod.id}')">
            ${done && score !== null ? `<div class="score-badge">${score}%</div>` : ''}
            <div class="act-card-top">
                <div class="act-category">QUIZ</div>
                <div class="card-ai-badge" style="font-size:0.65rem;background:var(--primary-dim);color:var(--primary);padding:2px 6px;border-radius:4px;font-weight:700;">IA</div>
            </div>
            <h3 style="margin:0.5rem 0;">${mod.title}</h3>
            <p style="margin-bottom:1rem;flex:1;">${mod.description || t('act.quiz_desc_fallback') + mod.title}</p>
            <div class="act-card-footer">
                <div class="act-meta">
                    <i class="fa-regular fa-circle-question"></i> 5 ${t('act.questions')}
                </div>
                <button class="btn-check" style="width:auto;padding:0.5rem 1rem;">
                    ${done ? t('act.btn_redo') : t('act.btn_start')}
                </button>
            </div>
        </div>`;
    }).join('');
}

// ── Flashcards tab ────────────────────────────────────────────
function renderFlashcardsTab() {
    const container = document.getElementById('flashcard-section');
    if (!container) return;
    
    const fcMods = filteredMods.filter(m => m.has_flashcards);
    
    fcCards = [];
    fcMods.forEach(m => {
        if (Array.isArray(m.flashcards)) {
            m.flashcards.forEach(f => fcCards.push({ ...f, moduleId: m.id }));
        }
    });

    if (!fcCards.length) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-layer-group"></i><p>${t('act.no_fc')}</p></div>`;
        return;
    }
    
    fcIdx = 0; fcKnown = 0;
    renderFlashcard(container);
}

function renderFlashcard(container) {
    if (!fcCards.length) return;
    const card = fcCards[fcIdx];
    container.innerHTML = `
<div class="flashcard-section">
    <div class="flashcard-wrap">
      <div class="flashcard" id="fc-card" onclick="flipCard()">
        <div class="flashcard-face">
          <div class="flashcard-label">${t('act.fc_label_word')}</div>
          <div class="flashcard-word" style="font-size:2.2rem;font-weight:800;">${card.word}</div>
          <div class="flashcard-hint">${t('act.fc_reveal')}</div>
        </div>
        <div class="flashcard-face flashcard-back">
          <div class="flashcard-label">${t('act.fc_label_translation')}</div>
          <div class="flashcard-translation" style="font-size:1.8rem;color:var(--primary);font-weight:700;">${card.translation}</div>
          ${card.example ? `<div class="flashcard-example" style="margin-top:1.5rem;font-style:italic;color:var(--text-muted);font-size:0.9rem;">"${card.example}"</div>` : ''}
        </div>
      </div>
    </div>
    <div class="flashcard-controls">
      <button class="btn-fc btn-fc-review" onclick="fcNext(false)"><i class="fa-solid fa-rotate-left"></i> ${t('act.fc_review')}</button>
      <button class="btn-fc btn-fc-flip" onclick="flipCard()"><i class="fa-solid fa-rotate"></i> ${t('act.fc_flip')}</button>
      <button class="btn-fc btn-fc-know" onclick="fcNext(true)"><i class="fa-solid fa-check"></i> ${t('act.fc_know')}</button>
    </div>
    <div class="fc-counter">${t('act.fc_counter', fcIdx + 1, fcCards.length, fcKnown)}</div>
</div>`;
}

function flipCard() {
    document.getElementById('fc-card')?.classList.toggle('flipped');
}

function fcNext(knew) {
    if (knew) fcKnown++;
    fcIdx = (fcIdx + 1) % fcCards.length;
    renderFlashcard(document.getElementById('flashcard-section'));
}

// ── Exercises tab ─────────────────────────────────────────────
function renderExercisesTab() {
    const container = document.getElementById('exercise-list');
    if (!container) return;
    
    // Filtra módulos de "pacote de flashcard" da IA para não aparecerem aqui como atividade de escrita
    const exerciseMods = filteredMods.filter(m => !m.title.toLowerCase().includes('flashcard'));

    if (!exerciseMods.length) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-pen-to-square"></i><p>${t('act.ex_empty')}</p></div>`;
        return;
    }

    container.innerHTML = exerciseMods.map(mod => `
<div class="exercise-card">
    <div class="exercise-type">${t('act.tab_exercises')}</div>
    <div class="exercise-prompt"><strong>${mod.title}</strong>: ${mod.description || 'Pratique este tema.'}</div>
    <textarea class="exercise-input" id="ex-input-${mod.id}" rows="3" placeholder="${t('act.ex_ph_textarea')}"></textarea>
    <button class="btn-check" id="btn-submit-${mod.id}" onclick="submitExercise('${mod.id}')">
        <i class="fa-solid fa-paper-plane"></i> ${t('chat.send')}
    </button>
    <div id="ex-feedback-${mod.id}" style="margin-top:0.75rem;"></div>
</div>`).join('');
    
    loadMySubmissions();
}

async function submitExercise(modId) {
    const input = document.getElementById(`ex-input-${modId}`);
    const btn = document.getElementById(`btn-submit-${modId}`);
    const val = input.value?.trim();
    if (!val) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('gen.loading')}`;

    try {
        const res = await apiPost('/activities/submissions/submit', { module_id: modId, student_answer: val });
        if (res.ok) {
            document.getElementById(`ex-feedback-${modId}`).innerHTML = `<div class="explanation-box" style="color:var(--success);border-color:var(--success);background:rgba(0,255,0,0.05);">✅ ${t('act.ex_sent')}</div>`;
            input.disabled = true; btn.style.display = 'none';
        }
    } catch (e) {
        btn.disabled = false; btn.innerHTML = t('chat.send');
        alert(t('gen.error'));
    }
}

async function loadMySubmissions() {
    try {
        const subs = await apiGet('/activities/submissions/my-submissions');
        subs.forEach(s => {
            const feedback = document.getElementById(`ex-feedback-${s.module_id}`);
            const input = document.getElementById(`ex-input-${s.module_id}`);
            const btn = document.getElementById(`btn-submit-${s.module_id}`);
            if (feedback && input) {
                input.value = s.student_answer; input.disabled = true;
                if (btn) btn.style.display = 'none';
                if (s.status === 'corrected') {
                    feedback.innerHTML = `<div class="explanation-box" style="background:var(--primary-dim); border-color:var(--primary);"><strong>Score: ${s.score}/100</strong><br>${s.ai_feedback || ''}<br><em>${s.teacher_feedback || ''}</em></div>`;
                } else {
                    feedback.innerHTML = `<div class="explanation-box" style="opacity:0.7;">⏳ ${t('dash.loading')}</div>`;
                }
            }
        });
    } catch (e) { }
}

// ── Modais ────────────────────────────────────────────────────
async function openModule(modId) {
    try {
        currentModDetail = await apiGet(`/activities/modules/${modId}`);
        document.getElementById('module-modal-title').textContent = currentModDetail.title;
        const body = document.getElementById('module-modal-body');
        body.innerHTML = '';

        if (!currentModDetail.contents || !currentModDetail.contents.length) {
            body.innerHTML = `<div class="empty-state">Nenhum conteúdo disponível.</div>`;
        } else {
            currentModDetail.contents.forEach(c => {
                const item = document.createElement('div');
                item.style.marginBottom = '1.5rem';
                let contentHtml = '';

                if (c.type === 'video') {
                    const videoId = extractYoutubeId(c.url);
                    if (videoId) {
                        contentHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" allowfullscreen frameborder="0"></iframe></div>`;
                    } else {
                        contentHtml = `<a href="${c.url}" target="_blank" class="btn-check" style="text-decoration:none;display:inline-flex;width:auto;"><i class="fa-solid fa-play"></i> Assistir Vídeo</a>`;
                    }
                } else if (c.type === 'text') {
                    contentHtml = `<div class="explanation-box" style="margin:0;">${c.body || ''}</div>`;
                } else {
                    contentHtml = `<a href="${c.url}" target="_blank" class="btn-check" style="text-decoration:none;display:inline-flex;width:auto;background:var(--surface);color:var(--text);border:1px solid var(--border);"><i class="fa-solid fa-file-export"></i> ${t('act.view_file')}</a>`;
                }

                item.innerHTML = `<div style="font-weight:700;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;"><i class="fa-solid fa-circle-play" style="color:var(--primary)"></i> ${c.title}</div>${contentHtml}`;
                body.appendChild(item);
            });
        }

        const hasQuiz = currentModDetail.quizzes && currentModDetail.quizzes.length;
        document.getElementById('btn-start-quiz-from-mod').style.display = hasQuiz ? 'flex' : 'none';

        document.getElementById('module-overlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if (window.I18n) I18n.applyToDOM(document.getElementById('module-overlay'));
    } catch (e) { console.error(e); }
}

function extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function startQuizFromModule() {
    if (!currentModDetail || !currentModDetail.quizzes.length) return;
    const quiz = currentModDetail.quizzes[0];
    closeModule();
    startQuiz(quiz.id, quiz.title);
}

function closeModule() {
    document.getElementById('module-overlay').style.display = 'none';
    document.body.style.overflow = '';
}

async function startQuiz(quizId, title) {
    try {
        const data = await apiGet(`/activities/quizzes/${quizId}`);
        activeQuiz = { id: quizId, title };
        questions = data.questions || [];
        currentQIdx = 0; answers = []; selectedOption = null; answered = false;
        document.getElementById('quiz-modal-title').textContent = title;
        document.getElementById('quiz-overlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        renderQuestion();
    } catch (e) { alert(t('gen.error')); }
}

function renderQuestion() {
    const body = document.getElementById('quiz-modal-body');
    if (!body) return;
    if (currentQIdx >= questions.length) { showResult(); return; }
    const q = questions[currentQIdx];
    const total = questions.length;
    const pct = ((currentQIdx) / total) * 100;
    document.getElementById('quiz-progress-text').textContent = t('act.quiz_progress', currentQIdx + 1, total);
    document.getElementById('quiz-progress-fill').style.width = pct + '%';
    selectedOption = null; answered = false;
    document.getElementById('btn-next').disabled = true;
    body.innerHTML = `
<div class="quiz-q-num">${t('mod.question_label')} ${currentQIdx + 1}</div>
<div class="quiz-question">${q.question}</div>
<div class="quiz-options" id="options-wrap">
${(q.options || []).map((opt, i) => `
  <div class="quiz-opt" onclick="selectOption(${i})" id="opt-${i}">
    <div class="opt-letter">${String.fromCharCode(65 + i)}</div>
    <span>${opt}</span>
  </div>`).join('')}
</div>
<div id="explanation-wrap"></div>`;
}

function selectOption(idx) {
    if (answered) return;
    selectedOption = idx; answered = true; answers.push(selectedOption);
    const q = questions[currentQIdx];
    const correct = q.correct_index ?? 0;
    document.querySelectorAll('.quiz-opt').forEach((btn, i) => {
        btn.classList.toggle('selected', i === idx);
        if (i === correct) btn.classList.add('correct');
        else if (i === selectedOption && selectedOption !== correct) btn.classList.add('wrong');
    });
    if (q.explanation) {
        document.getElementById('explanation-wrap').innerHTML = `
            <div class="explanation-box"><strong>${t('act.explanation_label')}</strong> ${q.explanation}</div>`;
    }
    document.getElementById('btn-next').disabled = false;
    if (currentQIdx < questions.length - 1) setTimeout(nextQuestion, 2000);
}

function nextQuestion() { currentQIdx++; renderQuestion(); }

async function showResult() {
    document.getElementById('quiz-progress-fill').style.width = '100%';
    document.getElementById('quiz-nav').style.display = 'none';
    let result = null;
    try {
        const res = await apiPost(`/activities/quizzes/${activeQuiz.id}/submit`, { answers });
        result = res.data;
        allProgress[activeQuiz.id] = { score: result.score, correct_q: result.correct, total_q: result.total };
    } catch (e) { }
    const score = result?.score ?? 0;
    const correct = result?.correct ?? 0;
    const total = questions.length;
    document.getElementById('quiz-modal-body').innerHTML = `
<div class="quiz-result">
    <div class="result-score">${score}%</div>
    <div class="result-msg">${score >= 70 ? t('act.quiz_perfect') : t('act.quiz_keep_practicing')}</div>
    <div class="result-stats">
        <div class="res-stat-card"><div class="res-stat-val">${correct}</div><div class="res-stat-label">CORRETAS</div></div>
        <div class="res-stat-card"><div class="res-stat-val">${total}</div><div class="res-stat-label">TOTAL</div></div>
    </div>
    <button class="btn-check" onclick="closeQuiz()">${t('act.quiz_close')}</button>
</div>`;
}

function closeQuiz() {
    document.getElementById('quiz-overlay').style.display = 'none';
    document.body.style.overflow = '';
    activeQuiz = null;
    renderCurrentTab();
}
