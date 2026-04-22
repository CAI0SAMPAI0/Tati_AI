/* quiz.js - Tati AI */
console.log("DEBUG: quiz.js foi carregado com sucesso!");
if (typeof requireAuth === 'function') requireAuth();

let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];

const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('id');

async function initQuiz() {
    if (!quizId) {
        window.location.href = 'activities.html';
        return;
    }

    try {
        currentQuiz = await apiGet(`/activities/quizzes/${quizId}`);
        console.log("DEBUG: Quiz recebido:", currentQuiz);
        
        if (!currentQuiz.questions || currentQuiz.questions.length === 0) {
            console.error("DEBUG: Quiz sem perguntas. API retornou:", currentQuiz);
            document.getElementById('quiz-title').textContent = "Quiz vazio";
            showToast("Este quiz não possui perguntas configuradas.", "warning");
            return;
        }
        renderQuestion();
    } catch (e) {
        console.error("DEBUG: Erro de API:", e);
        document.getElementById('quiz-title').textContent = "Erro ao carregar";
        showToast("Não foi possível carregar o quiz.", "error");
    }
}

function renderQuestion() {
    if (currentQuestionIndex >= currentQuiz.questions.length) return;

    const q = currentQuiz.questions[currentQuestionIndex];
    const total = currentQuiz.questions.length;

    document.getElementById('quiz-title').textContent = currentQuiz.title;
    document.getElementById('quiz-progress-text').textContent = `${t('act.quiz_progress', currentQuestionIndex + 1, total)}`;
    
    const progress = ((currentQuestionIndex + 1) / total) * 100;
    document.getElementById('quiz-progress-bar').style.width = `${progress}%`;

    const content = document.getElementById('quiz-content');
    content.innerHTML = `
        <div class="question-text">${escHtml(q.question)}</div>
        <div class="options-list">
            ${(q.options || []).map((opt, i) => `
                <button class="option-btn" onclick="selectOption(${i})">${escHtml(opt)}</button>
            `).join('')}
        </div>
    `;

    const btnNext = document.getElementById('btn-next');
    btnNext.disabled = true;
    btnNext.textContent = (currentQuestionIndex === total - 1) ? (t('act.quiz_finish') || 'Finalizar') : (t('act.quiz_next') || 'Próxima');
}

window.selectOption = (index) => {
    userAnswers[currentQuestionIndex] = index;
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((b, i) => b.classList.toggle('selected', i === index));
    document.getElementById('btn-next').disabled = false;
};

window.handleNext = async () => {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        await submitQuiz();
    }
};

async function submitQuiz() {
    const btn = document.getElementById('btn-next');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
        const res = await apiPost(`/activities/quizzes/${quizId}/submit`, {
            answers: userAnswers
        });

        showResult(res.data);
    } catch (e) {
        console.error(e);
        showToast("Erro ao enviar respostas.", "error");
        btn.disabled = false;
        btn.textContent = "Tentar novamente";
    }
}

function showResult(res) {
    document.getElementById('quiz-content').style.display = 'none';
    document.querySelector('.quiz-footer').style.display = 'none';
    document.getElementById('quiz-progress-text').style.display = 'none';

    const resultCard = document.getElementById('quiz-result');
    resultCard.style.display = 'block';

    const total = res.total ?? 0;
    const scorePct = total > 0 ? Math.round(((res.correct ?? 0) / total) * 100) : 0;
    
    document.getElementById('result-icon').textContent = scorePct >= 70 ? '🏆' : '💪';
    document.getElementById('result-title').textContent = scorePct >= 70 ? 'Excelente!' : 'Bom trabalho!';
    document.getElementById('result-score').textContent = `Você acertou ${res.correct ?? 0} de ${total} questões (${scorePct}%).`;

    if (res.results) {
        const fbArea = document.getElementById('result-feedback');
        fbArea.innerHTML = '<h3 style="margin-top:20px; font-size:1rem;">Revisão:</h3>';
        res.results.forEach((r, i) => {
            fbArea.innerHTML += `
                <div style="text-align:left; margin-bottom:15px; padding:10px; background:rgba(0,0,0,0.05); border-radius:8px;">
                    <strong>Q${i+1}:</strong> ${r.is_correct ? '✅' : '❌'}<br>
                    <small>${r.explanation || ''}</small>
                </div>
            `;
        });
    }
}

document.addEventListener('DOMContentLoaded', initQuiz);
