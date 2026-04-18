/* admin_modules.js — Painel de gerenciamento de módulos para admin/professora */

// ── Estado ────────────────────────────────────────────────────────────────────
let allModules   = [];
let activeFilter = 'all';
let editingModId = null;

let contentRows  = []; // Lista de IDs de div das linhas de conteúdo
let questionRows = []; // Lista de IDs de div das linhas de questão
let flashcardRows = []; // Lista de IDs de div das linhas de flashcard

let _contentIdx  = 0;
let _questionIdx = 0;
let _flashIdx    = 0;

// ── Inicialização ─────────────────────────────────────────────────────────────
function initModulesSection() {
  loadAllModules();
}

async function loadAllModules() {
  const grid = document.getElementById('modules-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-spinner fa-spin"></i> ${t('mod.loading')}</div>`;

  try {
    allModules = await apiGet('/activities/modules/admin/all');
    renderModulesGrid();
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="mod-empty">${t('gen.error')}</div>`;
  }
}

function filterModules(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.mod-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderModulesGrid();
}

function renderModulesGrid() {
  const grid = document.getElementById('modules-grid');
  if (!grid) return;
  let mods = allModules;
  if (activeFilter === 'published') mods = mods.filter(m => m.is_published);
  else if (activeFilter === 'draft') mods = mods.filter(m => !m.is_published);

  if (!mods.length) {
    grid.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-box-open"></i>${t('mod.empty')}</div>`;
    return;
  }

  grid.innerHTML = mods.map(m => `
    <div class="module-card">
      <div class="module-card-top">
        <div class="module-card-title">${escHtml(m.title)}</div>
        <span class="mod-badge ${m.is_published ? 'mod-badge-pub' : 'mod-badge-draft'}">
          ${m.is_published ? t('mod.filter_pub') : t('mod.filter_draft')}
        </span>
      </div>
      <div class="module-card-desc">${escHtml(m.description || '—')}</div>
      <div class="module-card-meta">
        <span class="mod-badge mod-badge-level">${escHtml(m.levels ? m.levels.join(', ') : (m.level || ''))}</span>
        <span style="font-size:.72rem;color:var(--text-muted)">${t('mod.order')} ${m.order}</span>
      </div>
      <div class="module-card-actions">
        <button class="btn-mod-edit" onclick="openModModal('${m.id}')"><i class="fa-solid fa-pen"></i> ${t('mod.edit')}</button>
        <button class="btn-mod-publish ${m.is_published ? 'unpublish' : 'publish'}" onclick="togglePublish('${m.id}', ${m.is_published})">
          <i class="fa-solid fa-${m.is_published ? 'eye-slash' : 'eye'}"></i> ${m.is_published ? t('mod.unpublish') : t('mod.publish')}
        </button>
        <button class="btn-mod-del" onclick="deleteModule('${m.id}', '${m.title}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

async function togglePublish(id, currentlyPublished) {
  const mod = allModules.find(m => m.id === id);
  if (!mod) return;
  try {
    const res = await apiPut(`/activities/modules/admin/${id}`, {
      title: mod.title,
      levels: mod.levels || [mod.level],
      is_published: !currentlyPublished
    });
    if (res.ok) {
      mod.is_published = !currentlyPublished;
      renderModulesGrid();
    }
  } catch (e) { showToast('Erro ao publicar módulo.', 'error'); }
}

// ── Linhas de Conteúdo ──────────────────────────────────────────────────────
function addContentRow(data = {}) {
  const id = `cr-${_contentIdx++}`;
  contentRows.push(id);
  const wrap = document.createElement('div');
  wrap.className = 'content-row';
  wrap.id = id;
  const isSupabase = data.url && data.url.includes('module-contents');
  wrap.innerHTML = `
    <div class="content-row-top">
      <select class="content-type" data-field="type">
        <option value="video" ${data.type==='video'?'selected':''}>🎬 Vídeo</option>
        <option value="pdf" ${data.type==='pdf'?'selected':''}>📄 PDF</option>
        <option value="slide" ${data.type==='slide'?'selected':''}>📊 Slide</option>
        <option value="text" ${data.type==='text'?'selected':''}>📝 Texto</option>
      </select>
      <input type="text" class="content-title" data-field="title" placeholder="${t('mod.field_title')}" value="${data.title||''}">
      <button class="btn-del-row" onclick="removeRow('${id}', 'content')"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="content-row-source">
      <div class="content-source-tabs">
        <button class="csrc-tab ${!isSupabase?'active':''}" onclick="switchContentSource('${id}','link',this)">🔗 Link</button>
        <button class="csrc-tab ${isSupabase?'active':''}" onclick="switchContentSource('${id}','file',this)">📁 ${t('mod.upload').split(' ')[1]}</button>
      </div>
      <div class="csrc-link" id="csrc-link-${id}" style="display:${isSupabase?'none':'block'}">
        <input type="text" data-field="url" class="url-input" placeholder="URL" value="${data.url||''}">
      </div>
      <div class="csrc-file" id="csrc-file-${id}" style="display:${isSupabase?'flex':'none'}">
        <label class="btn-file-upload" for="file-in-${id}"><i class="fa-solid fa-upload"></i> ${t('mod.upload')}</label>
        <input type="file" id="file-in-${id}" style="display:none" onchange="handleContentFile('${id}', this)">
        <input type="hidden" class="file-url" id="file-url-${id}" value="${data.url||''}">
        <span class="file-name-label" id="file-label-${id}">${data.url?t('mod.upload_ok'):t('gen.no_data')}</span>
      </div>
    </div>
  `;
  document.getElementById('mod-contents-list').appendChild(wrap);
}

function addFlashcardRow(data = {}) {
  const id = `fc-${_flashIdx++}`;
  flashcardRows.push(id);
  const wrap = document.createElement('div');
  wrap.className = 'question-row';
  wrap.id = id;
  wrap.innerHTML = `
    <div class="question-row-header">
      <span class="question-num">Flashcard</span>
      <button class="btn-del-row" onclick="removeRow('${id}', 'flashcard')"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
      <input type="text" class="fc-word" placeholder="${t('mod.fc_word_ph')}" value="${data.word||''}">
      <input type="text" class="fc-trans" placeholder="${t('mod.fc_trans_ph')}" value="${data.translation||''}">
    </div>
    <input type="text" class="fc-ex" placeholder="${t('mod.fc_ex_ph')}" value="${data.example||''}">
  `;
  document.getElementById('mod-flashcards-list').appendChild(wrap);
}

function addQuestionRow(data = {}) {
  const id = `qr-${_questionIdx++}`;
  questionRows.push(id);
  const wrap = document.createElement('div');
  wrap.className = 'question-row';
  wrap.id = id;
  const opts = data.options || ["", "", "", ""];
  const corr = data.correct_index ?? 0;

  wrap.innerHTML = `
    <div class="question-row-header">
      <span class="question-num">${t('mod.question_label')}</span>
      <button class="btn-del-row" onclick="removeRow('${id}', 'question')"><i class="fa-solid fa-trash"></i></button>
    </div>
    <textarea class="q-text" placeholder="Pergunta...">${data.question||''}</textarea>
    <div class="options-grid">
      ${opts.map((o, i) => `
        <div class="option-wrap ${i===corr?'is-correct':''}">
          <input type="radio" name="corr-${id}" value="${i}" ${i===corr?'checked':''}>
          <input type="text" class="q-opt" placeholder="${t('mod.option_label')} ${i+1}" value="${o}">
        </div>
      `).join('')}
    </div>
    <div class="field-explanation">
      <label>${t('mod.explanation_label')}</label>
      <input type="text" class="q-expl" placeholder="${t('mod.explanation_ph')}" value="${data.explanation||''}">
    </div>
  `;
  document.getElementById('mod-questions-list').appendChild(wrap);
}

function removeRow(id, type) {
  document.getElementById(id)?.remove();
  if (type === 'content') contentRows = contentRows.filter(i => i !== id);
  if (type === 'question') questionRows = questionRows.filter(i => i !== id);
  if (type === 'flashcard') flashcardRows = flashcardRows.filter(i => i !== id);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
async function openModModal(id = null) {
  editingModId = id;
  document.getElementById('mod-id').value = id || '';
  document.getElementById('mod-title').value = '';
  document.getElementById('mod-desc').value = '';
  document.getElementById('mod-order').value = '0';
  document.getElementById('quiz-title').value = '';
  document.getElementById('mod-contents-list').innerHTML = '';
  document.getElementById('mod-questions-list').innerHTML = '';
  document.getElementById('mod-flashcards-list').innerHTML = '';
  document.getElementById('mod-save-msg').textContent = '';

  document.querySelectorAll('input[name="mod-level"]').forEach(cb => cb.checked = false);
  contentRows = []; questionRows = []; flashcardRows = [];

  document.getElementById('mod-modal-title').textContent = id ? t('mod.modal_edit') : t('mod.modal_new');
  document.getElementById('mod-modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (id) {
    try {
      const data = await apiGet(`/activities/modules/${id}`);
      document.getElementById('mod-title').value = data.title;
      document.getElementById('mod-desc').value = data.description || '';
      document.getElementById('mod-order').value = data.order || 0;

      const lvls = data.levels || [data.level];
      document.querySelectorAll('input[name="mod-level"]').forEach(cb => {
        if (lvls.includes(cb.value)) cb.checked = true;
      });

      data.contents?.forEach(c => addContentRow(c));
      data.flashcards?.forEach(f => addFlashcardRow(f));

      if (data.quizzes?.length) {
        const q = data.quizzes[0];
        document.getElementById('quiz-title').value = q.title;
        q.questions?.forEach(quest => addQuestionRow(quest));
      }
    } catch (e) { showToast('Erro ao carregar módulo.', 'error'); }
  }
}

async function openQuizModal(quizId) {
    const modal = document.getElementById('quiz-modal');
    modal.style.display = 'flex';
    document.getElementById('quiz-title').value = '';
    clearQuestionRows();
    if (quizId) {
        try {
            const q = await apiGet(`/dashboard/modules/quizzes/${quizId}`);
            if (q) {
                document.getElementById('quiz-title').value = q.title;
                q.questions?.forEach(quest => addQuestionRow(quest));
            }
        } catch (e) { showToast('Erro ao carregar quiz.', 'error'); }
    }
}

function closeModModal() {
  document.getElementById('mod-modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

async function saveModule() {
  const msg = document.getElementById('mod-save-msg');
  msg.textContent = t('gen.loading');
  msg.className = 'mod-save-msg';

  try {
    const levels = Array.from(document.querySelectorAll('input[name="mod-level"]:checked')).map(cb => cb.value);
    
    const contents = contentRows.map((id, idx) => {
      const row = document.getElementById(id);
      return {
        type: row.querySelector('.content-type').value,
        title: row.querySelector('.content-title').value,
        url: row.querySelector('.url-input')?.value || row.querySelector('.file-url')?.value,
        order: idx
      };
    });

    const flashcards = flashcardRows.map((id, idx) => {
      const row = document.getElementById(id);
      return {
        word: row.querySelector('.fc-word').value,
        translation: row.querySelector('.fc-trans').value,
        example: row.querySelector('.fc-ex').value,
        order: idx
      };
    });

    const questions = questionRows.map((id, idx) => {
      const row = document.getElementById(id);
      return {
        question: row.querySelector('.q-text').value,
        options: Array.from(row.querySelectorAll('.q-opt')).map(i => i.value),
        correct_index: parseInt(row.querySelector('input[type="radio"]:checked')?.value || 0),
        explanation: row.querySelector('.q-expl').value,
        order: idx
      };
    });

    const payload = {
      title: document.getElementById('mod-title').value,
      description: document.getElementById('mod-desc').value,
      levels, order: parseInt(document.getElementById('mod-order').value),
      contents, flashcards,
      quiz: questions.length ? { title: document.getElementById('quiz-title').value || "Quiz", questions } : null
    };

    if (editingModId) await apiPut(`/activities/modules/admin/${editingModId}`, payload);
    else await apiPost('/activities/modules/admin', payload);

    msg.textContent = '✅ ' + (editingModId ? t('mod.save_ok_update') : t('mod.save_ok_create'));
    msg.className = 'mod-save-msg ok';
    loadAllModules();
    setTimeout(closeModModal, 1500);
  } catch (e) { msg.textContent = t('gen.error'); msg.className = 'mod-save-msg err'; }
}

async function generateQuizAI() {
  const btn = document.getElementById('btn-gen-quiz');
  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('mod.generating')}`;
  try {
    const levels = Array.from(document.querySelectorAll('input[name="mod-level"]:checked')).map(cb => cb.value);
    const titles = contentRows.map(id => document.getElementById(id).querySelector('.content-title').value).join(', ');
    const res = await apiPost('/activities/modules/admin/generate-quiz', {
      title: document.getElementById('mod-title').value,
      description: document.getElementById('mod-desc').value,
      level: levels[0] || 'Beginner',
      content_titles: titles
    });
    if (res.ok) {
      document.getElementById('quiz-title').value = res.data.quiz_title;
      res.data.questions.forEach(q => addQuestionRow(q));
      res.data.flashcards.forEach(f => addFlashcardRow(f));
    }
  } catch (e) { showToast('Erro ao gerar quiz com IA.', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t('mod.gen_ai')}`; }
}

async function deleteModule(id, title) {
  if (confirm(t('mod.confirm_del', title))) {
    await apiDelete(`/activities/modules/admin/${id}`);
    loadAllModules();
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

// ── Flashcard Packs (IA) ──────────────────────────────────────────────────────
function openFlashcardPackModal() {
  document.getElementById('fc-theme').value = '';
  document.getElementById('fc-instructions').value = '';
  document.getElementById('fc-save-msg').textContent = '';
  document.getElementById('fc-pack-modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeFcPackModal() {
  document.getElementById('fc-pack-modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

async function generateFlashcardsByTheme() {
  const theme = document.getElementById('fc-theme').value.trim();
  const instructions = document.getElementById('fc-instructions').value.trim();
  const level = document.getElementById('fc-level').value;
  const msg = document.getElementById('fc-save-msg');

  if (!theme) { showToast('Preencha o tema do flashcard.', 'warning'); return; }

  msg.textContent = t('mod.generating');
  msg.className = 'mod-save-msg';

  try {
    const res = await apiPost('/activities/modules/admin/generate-flashcards', {
      theme, instructions, level
    });
    
    if (res.ok) {
      msg.textContent = '✅ ' + t('gen.success');
      msg.className = 'mod-save-msg ok';
      loadAllModules();
      setTimeout(closeFcPackModal, 1500);
    }
  } catch (e) {
    msg.textContent = '❌ ' + t('gen.error');
    msg.className = 'mod-save-msg err';
  }
}
