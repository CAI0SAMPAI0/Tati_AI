/**
 * quiz.js - Tati AI
 * MentorIA-style inline feedback: Check → Explain → Next
 */

if (typeof requireAuth === 'function') requireAuth();

// ── State ──────────────────────────────────────────────────────────────────
let currentQuiz       = null;
let currentQuestionIndex = 0;
let userAnswers       = [];    // stores selected index per question
let isChecked         = false; // has the current question been verified?
let isTransitioning   = false;
let currentExerciseStatus = null;

const urlParams = new URLSearchParams(window.location.search);
const quizId    = urlParams.get('id');

function getCurrentLang() {
    if (typeof I18n !== 'undefined' && typeof I18n.getLang === 'function') {
        return I18n.getLang();
    }
    return localStorage.getItem('tati_lang') || 'pt-BR';
}

function isEnglishLang(lang = getCurrentLang()) {
    return String(lang).toLowerCase().startsWith('en');
}

function getStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'corrected') return t('act.status_corrected') || (isEnglishLang() ? 'Corrected' : 'Corrigido');
    if (normalized === 'done') return t('act.status_done') || (isEnglishLang() ? 'Done' : 'Feito');
    return t('act.status_pending') || (isEnglishLang() ? 'Pending' : 'Pendente');
}

function renderExerciseStatus(status) {
    const badge = document.getElementById('exercise-status-badge');
    const icon = document.getElementById('exercise-status-icon');
    const text = document.getElementById('exercise-status-text');
    if (!badge || !icon || !text) return;

    const normalized = String(status || '').toLowerCase();
    if (!normalized) {
        badge.style.display = 'none';
        return;
    }

    badge.classList.remove('status-pending', 'status-done', 'status-corrected');
    if (normalized === 'corrected') {
        badge.classList.add('status-corrected');
        icon.className = 'fa-solid fa-circle-check';
    } else if (normalized === 'done') {
        badge.classList.add('status-done');
        icon.className = 'fa-solid fa-list-check';
    } else {
        badge.classList.add('status-pending');
        icon.className = 'fa-regular fa-clock';
    }

    text.textContent = getStatusLabel(normalized);
    badge.style.display = 'inline-flex';
}

// ── Init ───────────────────────────────────────────────────────────────────
async function initQuiz() {
    if (!quizId) { window.location.href = 'activities.html'; return; }
    showSection('loading');

    try {
        // Envia idioma do app para o backend gerar explicações no idioma certo
        const lang = getCurrentLang();
        console.log('Quiz idioma:', lang);
        currentQuiz = await apiFetch(`/activities/quizzes/${quizId}`, {
            headers: { 'Accept-Language': lang }
        }).then(r => r.json());
        if (!currentQuiz?.questions?.length) { handleEmptyQuiz(); return; }
        setupIntro();
    } catch (e) {
        console.error('Failed to load quiz:', e);
        handleError();
    }
}

// ── Intro ──────────────────────────────────────────────────────────────────
function setupIntro() {
    document.getElementById('quiz-title').textContent    = currentQuiz.title || 'Quiz';
    document.getElementById('intro-title').textContent   = isEnglishLang() ? 'Ready to practice?' : 'Pronto para praticar?';
    document.getElementById('intro-desc').textContent    = currentQuiz.description || (isEnglishLang() ? 'Review your recent mistakes and improve your next attempts.' : 'Revise seus erros recentes e melhore nas proximas tentativas.');
    document.getElementById('quiz-progress-text').textContent = isEnglishLang() ? 'Ready' : 'Pronto';
    currentExerciseStatus = currentQuiz.status || null;
    renderExerciseStatus(currentExerciseStatus);
    showSection('intro');
    updateProgress(0);
}

// ── Start ──────────────────────────────────────────────────────────────────
window.startQuiz = () => {
    currentQuestionIndex = 0;
    userAnswers          = [];
    isChecked            = false;

    document.getElementById('progress-wrapper').style.display = 'block';
    document.getElementById('quiz-footer').style.display      = 'flex';
    showSection('question');
    renderQuestion();
};

// ── Restart ────────────────────────────────────────────────────────────────
window.restartQuiz = () => {
    document.getElementById('quiz-result').style.display  = 'none';
    document.getElementById('quiz-content').style.display = 'block';
    window.startQuiz();
};

// ── Render Question ────────────────────────────────────────────────────────
function renderQuestion() {
    isChecked = false;

    const q     = currentQuiz.questions[currentQuestionIndex];
    const total = currentQuiz.questions.length;
    const idx   = currentQuestionIndex;

    // Progress labels
    const pct = Math.round(((idx + 1) / total) * 100);
    const questionLabel = t('act.quiz_question_of') || (isEnglishLang() ? 'Question' : 'Pergunta');
    const ofLabel = t('act.quiz_de') || (isEnglishLang() ? 'of' : 'de');
    document.getElementById('progress-label').textContent = `${questionLabel} ${idx + 1} ${ofLabel} ${total}`;
    document.getElementById('progress-pct').textContent   = `${pct}%`;
    document.getElementById('quiz-progress-text').textContent = `${idx + 1} / ${total}`;
    updateProgress(pct);

    const questionArea = document.getElementById('question-area');
    questionArea.classList.add('fade-out');

    setTimeout(() => {
        // Question text
        document.getElementById('question-text').textContent = q.question;

        // Options
        const optionsList = document.getElementById('options-list');
        optionsList.innerHTML = '';

        (q.options || []).forEach((opt, i) => {
            const btn       = document.createElement('button');
            btn.className   = 'option-btn';
            btn.innerHTML   = `<span>${escHtml(opt)}</span>`;
            btn.onclick     = () => selectOption(i);
            if (userAnswers[idx] === i) btn.classList.add('selected');
            optionsList.appendChild(btn);
        });

        // Hide explanation
        const expBlock = document.getElementById('explanation-block');
        expBlock.style.display = 'none';
        expBlock.className     = 'explanation-box animated fadeIn';

        // Footer button: "Verificar" until answered+checked, then "Próxima / Finalizar"
        setFooterButton('verify');

        questionArea.classList.remove('fade-out');
        questionArea.classList.add('fade-in');
        setTimeout(() => {
            questionArea.classList.remove('fade-in');
            isTransitioning = false;
        }, 400);
    }, isTransitioning ? 300 : 0);
}

// ── Select Option ──────────────────────────────────────────────────────────
window.selectOption = (index) => {
    if (isChecked) return; // locked after verification

    userAnswers[currentQuestionIndex] = index;

    document.querySelectorAll('.option-btn').forEach((btn, i) => {
        btn.classList.toggle('selected', i === index);
    });

    // Enable "Verificar" button
    const btnNext = document.getElementById('btn-next');
    btnNext.disabled = false;
};

// ── Handle Next / Verify ───────────────────────────────────────────────────
window.handleNext = async () => {
    if (isTransitioning) return;

    if (!isChecked) {
        // Step 1: Reveal answer + explanation
        revealAnswer();
    } else {
        // Step 2: Advance to next or finish
        const total = currentQuiz.questions.length;
        if (currentQuestionIndex < total - 1) {
            isTransitioning = true;
            currentQuestionIndex++;
            renderQuestion();
        } else {
            await submitQuiz();
        }
    }
};

// ── Reveal Answer ──────────────────────────────────────────────────────────
function revealAnswer() {
    if (userAnswers[currentQuestionIndex] === undefined) return;

    const q            = currentQuiz.questions[currentQuestionIndex];
    const selectedIdx  = userAnswers[currentQuestionIndex];
    const correctIdx   = q.correct_index ?? q.correctIndex ?? q.correct ?? 0;
    const isCorrect    = selectedIdx === correctIdx;
    const total        = currentQuiz.questions.length;

    isChecked = true;

    // Style options
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn, i) => {
        btn.disabled = true;
        btn.classList.remove('selected');

        if (i === correctIdx) {
            btn.classList.add('correct');
        } else if (i === selectedIdx && !isCorrect) {
            btn.classList.add('wrong');
        } else {
            btn.classList.add('disabled');
        }
    });

    // Show explanation block
    const expBlock  = document.getElementById('explanation-block');
    const expIcon   = document.getElementById('explanation-icon');
    const expStatus = document.getElementById('explanation-status');
    const expText   = document.getElementById('explanation-text');

    expBlock.className = `explanation-box animated fadeIn ${isCorrect ? 'is-correct' : 'is-wrong'}`;
    expIcon.className  = isCorrect
        ? 'fa-solid fa-circle-check fs-18'
        : 'fa-solid fa-circle-xmark fs-18';
    expStatus.textContent = isCorrect
        ? (t('act.quiz_correct')  || 'Correto!')
        : (t('act.quiz_wrong')    || 'Incorreto.');
    const explanation = q.explanation?.trim() || (
        isEnglishLang()
            ? `The correct answer is: ${q.options[correctIdx]}`
            : `A alternativa correta é: ${q.options[correctIdx]}`
    );
     expText.textContent   = explanation;
    expBlock.style.display = 'block';

    // Switch footer button
    const isLast = currentQuestionIndex === total - 1;
    setFooterButton(isLast ? 'finish' : 'next');
}

// ── Footer Button Helper ───────────────────────────────────────────────────
function setFooterButton(mode) {
    const btnNext     = document.getElementById('btn-next');
    const btnNextText = document.getElementById('btn-next-text');
    const btnNextIcon = document.getElementById('btn-next-icon');

    if (mode === 'verify') {
        btnNextText.textContent     = t('act.quiz_check') || 'Verificar';
        btnNextIcon.className       = 'fa-solid fa-check';
        btnNext.disabled            = userAnswers[currentQuestionIndex] === undefined;
        btnNext.className           = 'btn btn-primary btn-lg px-5 fw-bold d-flex align-items-center gap-2';
    } else if (mode === 'next') {
        btnNextText.textContent     = t('act.quiz_next') || 'Próxima';
        btnNextIcon.className       = 'fa-solid fa-arrow-right';
        btnNext.disabled            = false;
        btnNext.className           = 'btn btn-primary btn-lg px-5 fw-bold d-flex align-items-center gap-2';
    } else if (mode === 'finish') {
        btnNextText.textContent     = t('act.quiz_finish') || 'Ver Resultado';
        btnNextIcon.className       = 'fa-solid fa-flag-checkered';
        btnNext.disabled            = false;
        btnNext.className           = 'btn btn-success btn-lg px-5 fw-bold d-flex align-items-center gap-2';
    }
}

// ── Submit ─────────────────────────────────────────────────────────────────
async function submitQuiz() {
    const btnNext = document.getElementById('btn-next');
    btnNext.disabled  = true;
    btnNext.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin me-2"></i> ${t('gen.loading') || 'Enviando...'}`;

    try {
        const res = await apiPost(`/activities/quizzes/${quizId}/submit`, {
            answers: userAnswers
        });
        showResult(res.data);
    } catch (e) {
        console.error('Submission error:', e);
        if (typeof showToast === 'function') showToast(t('gen.error') || 'Erro ao enviar.', 'error');
        btnNext.disabled = false;
        setFooterButton('finish');
    }
}

// ── Show Results ───────────────────────────────────────────────────────────
function showResult(data) {
    document.getElementById('quiz-content').style.display  = 'none';
    document.getElementById('quiz-footer').style.display   = 'none';
    document.getElementById('progress-wrapper').style.display = 'none';

    const resultCard = document.getElementById('quiz-result');
    resultCard.style.display = 'block';

    const total    = data.total   ?? currentQuiz.questions.length;
    const correct  = data.correct ?? 0;
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Circular progress ring (radius=60, circumference≈377)
    const circumference = 2 * Math.PI * 60;
    const offset        = circumference - (scorePct / 100) * circumference;
    const fgCircle      = document.getElementById('result-circle-fg');

    fgCircle.style.strokeDasharray  = circumference;
    fgCircle.style.strokeDashoffset = circumference; // start at 0

    // Determine color class by score
    if (scorePct >= 80) {
        fgCircle.classList.add('is-success');
    } else if (scorePct >= 50) {
        fgCircle.classList.add('is-warning');
    } else {
        fgCircle.classList.add('is-danger');
    }

    // Animate after paint
    setTimeout(() => {
        fgCircle.style.strokeDashoffset = offset;
    }, 100);

    document.getElementById('result-pct-text').textContent = `${scorePct}%`;

    // Emoji + message
    let emoji, title;
    if (scorePct >= 95) {
        emoji = '🏆'; title = t('act.quiz_perfect')        || 'Perfeito!';
    } else if (scorePct >= 85) {
        emoji = '🥇'; title = t('act.quiz_excellent')      || 'Excelente!';
    } else if (scorePct >= 75) {
        emoji = '🥈'; title = t('act.quiz_very_good')      || 'Muito bom!';
    } else if (scorePct >= 65) {
        emoji = '🥉'; title = t('act.quiz_good')           || 'Bom trabalho!';
    } else if (scorePct >= 55) {
        emoji = '💪'; title = t('act.quiz_satisfactory')   || 'Satisfatório, mas pode melhorar!';
    } else if (scorePct >= 45) {
        emoji = '📖'; title = t('act.quiz_needs_improvement') || 'Precisa de mais prática!';
    } else if (scorePct >= 35) {
        emoji = '📚'; title = t('act.quiz_poor')           || 'Resultado insuficiente, estude mais!';
    } else {
        emoji = '⚠️'; title = t('act.quiz_very_poor')     || 'Precisa revisar o conteúdo com urgência!';
    }

    document.getElementById('result-emoji').textContent  = emoji;
    document.getElementById('result-title').textContent  = title;
    document.getElementById('result-score').textContent  =
        `${correct} de ${total} acertos (${scorePct}%)`;

    // Refresh user data (XP, streak, etc.)
    if (typeof loadUserData === 'function') loadUserData();

    currentExerciseStatus = 'corrected';
    renderExerciseStatus(currentExerciseStatus);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function showSection(section) {
    const map = {
        loading : 'quiz-loading',
        intro   : 'quiz-intro',
        question: 'question-area',
    };
    Object.values(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(map[section]);
    if (target) {
        target.style.display = (section === 'question') ? 'block' : 'flex';
        if (section !== 'loading') target.classList.add('fade-in');
    }
}

function updateProgress(pct) {
    const bar = document.getElementById('quiz-progress-bar');
    if (bar) bar.style.width = `${pct}%`;
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Graceful fallback if i18n t() not loaded
if (typeof t === 'undefined') window.t = (key) => key;

function handleEmptyQuiz() {
    document.getElementById('quiz-title').textContent = 'Quiz Vazio';
    const intro = document.getElementById('quiz-intro');
    intro.innerHTML = `
        <div class="avatar-text avatar-xxl bg-soft-warning text-warning mx-auto mb-4">
            <i class="fa-solid fa-triangle-exclamation fs-30"></i>
        </div>
        <h2 class="fw-bold text-dark mb-3">Oops!</h2>
        <p class="text-muted mb-4">Este quiz ainda não tem perguntas.</p>
        <button class="btn btn-primary px-5" onclick="window.location.href='activities.html'">Voltar</button>
    `;
    showSection('intro');
}

function handleError() {
    document.getElementById('quiz-title').textContent = 'Erro';
    showSection('intro');
    const intro = document.getElementById('quiz-intro');
    intro.innerHTML = `
        <div class="avatar-text avatar-xxl bg-soft-danger text-danger mx-auto mb-4">
            <i class="fa-solid fa-xmark fs-30"></i>
        </div>
        <h2 class="fw-bold text-dark mb-3">Erro</h2>
        <p class="text-muted mb-4">Não foi possível carregar o quiz. Tente novamente.</p>
        <button class="btn btn-primary px-5" onclick="window.location.reload()">Recarregar</button>
    `;
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initQuiz);
