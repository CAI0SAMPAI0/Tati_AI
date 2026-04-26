if (!requireAuth()) throw new Error('Unauthenticated');
const _dashUser = getUser();

async function _ensureDashboardAccess() {
  const fallback = isStaff(_dashUser);
  try {
    const access = await apiGet('/users/permissions/access');
    return canAccessDashboard(_dashUser, access);
  } catch (_) {
    return fallback;
  }
}

let allStudents = [];
let currentModalUsername = null;
let reportsChartInstance = null;


// botão do menu lateral
function toggleDashSidebar() {
  const sidebar = document.querySelector('.dash-sidebar');
  const overlay = document.querySelector('.dash-sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');

  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('active', !isOpen);
}

function closeDashSidebar() {
  document.querySelector('.dash-sidebar')?.classList.remove('open');
  document.querySelector('.dash-sidebar-overlay')?.classList.remove('active');
}

// Fecha ao clicar em qualquer item de nav no mobile
document.querySelectorAll('.dash-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 768) closeDashSidebar();
  });
});

// ── Seções ────────────────────────────────────────────────────────────────────
const SECTIONS = {
  overview: { title: () => t('dash.overview'), sub: () => t('dash.overview_sub') },
  students: { title: () => t('dash.students'), sub: () => t('dash.students_sub') },
  reports: { title: () => t('dash.reports'), sub: () => t('dash.reports_sub') },
  modules: { title: () => t('mod.title'), sub: () => t('mod.subtitle') },
  flashcards: { title: () => t('mod.section_flashcards'), sub: () => t('mod.fc_manage_sub') },
  submissions: { title: () => t('dash.submissions'), sub: () => t('dash.submissions_sub') },
  simulations: { title: () => '🎭 ' + (t('dash.simulations') || 'Simulações'), sub: () => t('dash.simulations_sub') },
};

window.addEventListener('DOMContentLoaded', async () => {
  const allowed = await _ensureDashboardAccess();
  if (!allowed) {
    showToast('Acesso negado. Área restrita a professores.', 'error');
    setTimeout(() => { window.location.href = '/chat.html'; }, 120);
    return;
  }

  _loadStats();
  _loadStudents();
  
  // Recupera seção do hash ou do localStorage
  const hash = window.location.hash.replace('#', '');
  const target = SECTIONS[hash] ? hash : 'overview';

  const navItem = document.querySelector(`.dash-nav-item[href="#${target}"]`);
  setSection(target, navItem);
});

window.addEventListener('langchange', () => {
  const active = document.querySelector('.dash-nav-item.active');
  if (!active) return;
  const name = (active.getAttribute('href') || '').replace('#', '');
  if (SECTIONS[name]) {
    document.getElementById('page-title').textContent = SECTIONS[name].title();
    document.getElementById('page-sub').textContent = SECTIONS[name].sub();
  }
  if (typeof I18n !== 'undefined') I18n.applyToDOM();
});

function setSection(name, el) {
  document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
  if (!el) el = document.querySelector(`.dash-nav-item[href="#${name}"]`);
  if (el) el.classList.add('active');

  localStorage.setItem('dash_active_section', name);
  if (window.location.hash !== `#${name}`) {
    history.replaceState(null, null, `#${name}`);
  }

  if (name === 'modules' && typeof initModulesSection === 'function') {
    initModulesSection();
  }

  document.querySelectorAll('.dash-section').forEach(s => {
      s.style.display = 'none';
      s.style.opacity = '0';
  });

  const sectionEl = document.getElementById(`section-${name}`);
  if (sectionEl) {
      sectionEl.style.display = 'block';
      sectionEl.style.opacity = '0';
      sectionEl.style.transform = 'translateY(10px)';
      sectionEl.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      
      requestAnimationFrame(() => {
          sectionEl.style.opacity = '1';
          sectionEl.style.transform = 'translateY(0)';
      });
  }

  document.getElementById('page-title').textContent = SECTIONS[name]?.title() || name;
  document.getElementById('page-sub').textContent = SECTIONS[name]?.sub() || '';
  
  if (name === 'reports') _loadReports();
  if (name === 'overview') _loadOverview();
  if (name === 'submissions') _loadSubmissions();
  if (name === 'flashcards') _loadFlashcards();
  if (name === 'simulations') _loadSimulations();
}

// ── Flashcards ──────────────────────────────────────────────────────────────
async function _loadFlashcards() {
  const grid = document.getElementById('flashcards-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
  
  try {
    const data = await apiGet('/activities/modules/admin/all');
    // Filtra apenas módulos que possuem pacotes de flashcards (coluna flashcards não vazia)
    const packs = data.filter(m => Array.isArray(m.flashcards) && m.flashcards.length > 0);
    _renderFlashcardsGrid(grid, packs);
  } catch (e) {
    grid.innerHTML = `<div class="mod-empty">${t('gen.error')}</div>`;
  }
}

function _renderFlashcardsGrid(grid, packs) {
  if (!packs.length) {
    grid.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-layer-group"></i> ${t('mod.fc_none')}</div>`;
    return;
  }

  grid.innerHTML = packs.map(m => `
    <div class="module-card">
      <div class="module-card-top">
        <div class="module-card-title">${escHtml(m.title)}</div>
        <span class="mod-badge mod-badge-pub">${t('mod.fc_count', m.flashcards?.length || 0)}</span>
      </div>
      <div class="module-card-desc">${escHtml(m.description || '—')}</div>
      <div class="module-card-actions">
        <button class="btn-mod-edit" onclick="openModModal('${m.id}')"><i class="fa-solid fa-pen"></i> ${t('mod.edit')}</button>
        <button class="btn-mod-del" onclick="deleteModule('${m.id}', '${m.title}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

// ── Submissions ──────────────────────────────────────────────────────────────
async function _loadSubmissions() {
  const container = document.getElementById('submissions-table-container');
  if (!container) return;
  container.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
  
  try {
    const data = await apiGet('/activities/submissions/admin/submissions');
    _renderSubmissionsTable(container, data);
  } catch (e) {
    container.innerHTML = `<div class="mod-empty">${t('gen.error')}</div>`;
  }
}

function _renderSubmissionsTable(container, submissions) {
  if (!submissions.length) {
    container.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-file-circle-check"></i> ${t('dash.no_submissions')}</div>`;
    return;
  }

  const rows = submissions.map(s => `
    <tr>
      <td class="td-muted td-sm">${_formatDate(s.created_at)}</td>
      <td><strong>${escHtml(s.users?.name || s.username)}</strong><br><small class="td-muted">@${s.username}</small></td>
      <td class="td-muted">${escHtml(s.modules?.title || s.module_id)}</td>
      <td><div style="max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escHtml(s.student_answer)}">${escHtml(s.student_answer)}</div></td>
      <td><span class="mod-badge ${s.status === 'corrected' ? 'mod-badge-pub' : 'mod-badge-draft'}">${s.status}</span></td>
      <td class="td-num">${s.score !== null ? s.score : '—'}</td>
      <td>
        <button class="btn-mod-edit" onclick="openCorrectionModal('${s.id}')"><i class="fa-solid fa-pen-nib"></i> ${t('dash.btn_feedback')}</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('dash.col_date')}</th>
            <th>${t('dash.col_student')}</th>
            <th>${t('dash.col_activity')}</th>
            <th>${t('dash.col_response')}</th>
            <th>Status</th>
            <th>${t('dash.col_score')}</th>
            <th>${t('dash.col_actions')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

let currentSubmissionId = null;

async function openCorrectionModal(subId) {
  currentSubmissionId = subId;
  document.getElementById('correction-modal')?.remove();

  try {
    const subs = await apiGet('/activities/submissions/admin/submissions');
    const s = subs.find(item => item.id === subId);
    if (!s) return;

    const modal = document.createElement('div');
    modal.id = 'correction-modal';
    modal.className = 'mod-modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="mod-modal" style="max-width:600px;">
        <div class="mod-modal-header">
          <h2>${t('dash.correction_title')} ${escHtml(s.users?.name || s.username)}</h2>
          <button onclick="this.closest('.mod-modal-overlay').remove()" class="mod-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="mod-modal-body">
          <div class="mod-field">
            <label>${t('dash.student_answer')}</label>
            <div style="background:var(--bg); padding:1rem; border-radius:8px; border:1px solid var(--border); font-size:0.9rem; line-height:1.5;">${escHtml(s.student_answer).replace(/\n/g, '<br>')}</div>
          </div>
          
          <div style="display:flex; gap:1rem; margin-top:1rem;">
            <button class="btn-gen-quiz" id="btn-ai-correct" onclick="aiCorrectSubmission('${subId}')">
              <i class="fa-solid fa-wand-magic-sparkles"></i> ${t('dash.ai_suggest')}
            </button>
          </div>

          <div class="mod-field" style="margin-top:1rem;">
            <label>${t('dash.ai_feedback')}</label>
            <textarea id="sub-ai-feedback" rows="4" readonly style="opacity:0.8; background:var(--bg);">${escHtml(s.ai_feedback || '')}</textarea>
          </div>

          <div class="mod-field" style="margin-top:1rem;">
            <label>${t('dash.teacher_feedback')}</label>
            <textarea id="sub-teacher-feedback" rows="4" placeholder="${t('dash.teacher_feedback_ph')}">${escHtml(s.teacher_feedback || '')}</textarea>
          </div>

          <div class="mod-field" style="margin-top:1rem; width:100px;">
            <label>${t('dash.score_label')}</label>
            <input type="number" id="sub-score" min="0" max="100" value="${s.score !== null ? s.score : ''}">
          </div>
        </div>
        <div class="mod-modal-footer">
          <div id="sub-save-msg"></div>
          <button class="btn-mod-secondary" onclick="this.closest('.mod-modal-overlay').remove()">${t('gen.cancel')}</button>
          <button class="btn-mod-primary" onclick="saveCorrection('${subId}')"><i class="fa-solid fa-check"></i> ${t('dash.save_correction')}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  } catch (e) { showToast('Erro ao carregar submissão.', 'error'); }
}

async function aiCorrectSubmission(subId) {
  const btn = document.getElementById('btn-ai-correct');
  const aiText = document.getElementById('sub-ai-feedback');
  const scoreInput = document.getElementById('sub-score');
  
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('mod.generating')}`;
  
  try {
    const lang = I18n.getLang();
    const res = await apiPost(`/activities/submissions/admin/submissions/${subId}/ai-correct?lang=${lang}`);
    if (res.ok) {
      aiText.value = res.data.ai_feedback;
      scoreInput.value = res.data.score;
    }
  } catch (e) { showToast('Erro ao corrigir com IA.', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t('dash.ai_suggest')}`;
  }
}

async function saveCorrection(subId) {
  const teacher_feedback = document.getElementById('sub-teacher-feedback').value;
  const score = parseInt(document.getElementById('sub-score').value);
  const msg = document.getElementById('sub-save-msg');
  
  try {
    const res = await apiPost(`/activities/submissions/admin/submissions/${subId}/correct`, {
      teacher_feedback,
      score
    });
    if (res.ok) {
      msg.textContent = '✅ ' + t('gen.success');
      msg.className = 'mod-save-msg ok';
      _loadSubmissions();
      setTimeout(() => document.getElementById('correction-modal')?.remove(), 1000);
    }
  } catch (e) { msg.textContent = '❌ ' + (t('gen.error')); msg.className = 'mod-save-msg err'; }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function _loadStats() {
  try {
    const data = await apiGet('/dashboard/stats');
    document.getElementById('stat-total-students').textContent = data.total_students ?? '—';
    document.getElementById('stat-total-messages').textContent = data.total_messages ?? '—';
    document.getElementById('stat-active-today').textContent = data.active_today ?? '—';
  } catch (e) { console.error(e); }
}

// ── Students ──────────────────────────────────────────────────────────────────
async function _loadStudents() {
  try {
    allStudents = await apiGet('/dashboard/students');
    _renderStudentsTable('students-table', allStudents);
    _renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
  } catch (e) { console.error(e); }
}

function filterStudents() {
  const q = document.getElementById('student-search').value.toLowerCase();
  _renderStudentsTable('students-table', allStudents.filter(s =>
    [s.name, s.username, s.level].some(v => (v || '').toLowerCase().includes(q))
  ));
}

function _renderStudentsTable(containerId, students, compact = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!students.length) { container.innerHTML = `<p class="empty-state">${t('dash.no_students')}</p>`; return; }

  const rows = students.map(s => `
    <tr onclick="openStudentModal('${escHtml(s.username)}')" style="cursor:pointer">
      <td>
        <div class="student-name-cell">
          ${s.avatar_url
      ? `<img src="${s.avatar_url}" class="student-avatar-img" alt="">`
      : `<div class="student-avatar">${_initials(s.name || s.username)}</div>`}
          <div>
            <div class="student-name">${escHtml(s.name || s.username)}</div>
            <div class="student-username">@${escHtml(s.username)}</div>
          </div>
        </div>
      </td>
      <td><span class="level-badge">${escHtml(s.level || '—')}</span></td>
      ${!compact ? `<td class="td-muted">${escHtml(s.focus || '—')}</td>` : ''}
      <td class="td-muted">${s.last_active ? _formatDate(s.last_active) : '—'}</td>
      ${!compact ? `<td class="td-num">${s.total_messages ?? 0}</td>` : ''}
      <td class="td-muted td-sm">${_formatDate(s.created_at)}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('dash.col_student')}</th>
            <th>${t('dash.col_level')}</th>
            ${!compact ? `<th>${t('dash.col_focus')}</th>` : ''}
            <th>${t('dash.col_last')}</th>
            ${!compact ? `<th>${t('dash.col_msgs')}</th>` : ''}
            <th>${t('dash.col_since')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openStudentModal(username) {
  currentModalUsername = username;
  const s = allStudents.find(s => s.username === username);
  if (!s) return;
  document.getElementById('student-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'student-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeStudentModal()"></div>
    <div class="modal-panel">
      <div class="modal-header">
        <div class="modal-student-info">
          ${s.avatar_url
      ? `<img src="${s.avatar_url}" class="modal-avatar-img" alt="">`
      : `<div class="modal-avatar">${_initials(s.name || s.username)}</div>`}
          <div>
            <div class="modal-student-name">${escHtml(s.name || s.username)}</div>
            <div class="modal-student-meta">@${escHtml(s.username)} · ${escHtml(s.level || '—')} · ${s.total_messages ?? 0} msgs</div>
          </div>
        </div>
        <button class="modal-close" onclick="closeStudentModal()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="modal-tabs">
        <button class="modal-tab active" onclick="switchModalTab('edit',this)">${t('dash.edit')}</button>
        <button class="modal-tab" onclick="switchModalTab('prompt',this)">${t('dash.prompt')}</button>
        <button class="modal-tab" onclick="switchModalTab('insight',this)">${t('dash.insight')}</button>
        <button class="modal-tab" onclick="switchModalTab('interests',this)">${t('dash.interests')}</button>
      </div>

      <!-- Edit -->
      <div class="modal-tab-content" id="tab-edit">
        <div class="modal-field">
          <label>${t('dash.col_level')}</label>
          <select id="modal-level">
            ${[
              {v:'Beginner', k:'level.beginner'},
              {v:'Pre-Intermediate', k:'level.pre_int'},
              {v:'Intermediate', k:'level.intermediate'},
              {v:'Business English', k:'level.business'},
              {v:'Advanced', k:'level.advanced'}
            ].map(item =>
              `<option value="${item.v}" ${s.level === item.v ? 'selected' : ''} data-i18n="${item.k}">${t(item.k)}</option>`
            ).join('')}
          </select>
        </div>
        <div id="modal-edit-feedback" class="modal-feedback" style="display:none"></div>
        <div class="modal-actions">
          <button class="btn-modal-save" onclick="saveStudentLevel()"><i class="fa-solid fa-floppy-disk"></i> ${t('dash.save_level')}</button>
          <button class="btn-modal-danger" onclick="confirmDeleteStudent('${escHtml(username)}')"><i class="fa-solid fa-trash-can"></i> ${t('dash.delete_student')}</button>
        </div>
      </div>

      <!-- Prompt -->
      <div class="modal-tab-content" id="tab-prompt" style="display:none">
        <p class="modal-hint">${t('dash.prompt_hint')}</p>
        <textarea id="modal-prompt" class="modal-textarea" placeholder="Ex: This student is preparing for a job interview...">${escHtml(s.custom_prompt || '')}</textarea>
        <div id="modal-prompt-feedback" class="modal-feedback" style="display:none"></div>
        <div class="modal-actions">
          <button class="btn-modal-save" onclick="saveStudentPrompt()"><i class="fa-solid fa-floppy-disk"></i> ${t('dash.save_prompt')}</button>
          <button class="btn-modal-secondary" onclick="clearStudentPrompt()"><i class="fa-solid fa-eraser"></i> ${t('dash.clear_prompt')}</button>
        </div>
      </div>

      <!-- Insight -->
      <div class="modal-tab-content" id="tab-insight" style="display:none">
        <div id="insight-content"><div class="insight-placeholder"><i class="fa-solid fa-brain" style="font-size:1.4rem;color:var(--primary);display:block;margin-bottom:0.75rem;"></i><p>${t('dash.click')}</p></div></div>
        <div class="modal-actions">
          <button class="btn-modal-save" id="btn-generate-insight" onclick="generateInsight()">${t('dash.generate_insight')}</button>
          <button class="btn-modal-secondary" id="btn-generate-grammar" onclick="generateGrammarErrors()">🧩 ${t('dash.grammar_errors')}</button>
        </div>
      </div>

      <!-- Interests -->
      <div class="modal-tab-content" id="tab-interests" style="display:none">
        <div class="modal-actions">
          <p style="margin:0;font-size:0.875rem;color:var(--text-muted);">${t('dash.interests_hint')}</p>
          <button class="btn-modal-save" id="btn-generate-interests" onclick="fetchStudentInterests()">${t('dash.analyze_interests')}</button>
        </div>
        <div id="interests-feedback" class="modal-feedback" style="display:none"></div>
        <div style="margin-top:1rem">
          <h4 style="margin-bottom:0.5rem;color:var(--primary);font-size:0.875rem;">${t('dash.interests_focus')}</h4>
          <div id="interests-container" style="display:flex;flex-wrap:wrap;gap:0.5rem;"><span style="color:var(--text-muted);font-size:0.85rem;">${t('dash.click_to_load')}</span></div>
          <h4 style="margin:1rem 0 0.5rem;color:var(--primary);font-size:0.875rem;">${t('dash.practical_rec')}</h4>
          <div id="recommendations-container" style="display:flex;flex-direction:column;gap:0.5rem;"><span style="color:var(--text-muted);font-size:0.85rem;">${t('dash.click_to_load')}</span></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.querySelector('.modal-panel').classList.add('modal-panel-open'));
}

function closeStudentModal() {
  const modal = document.getElementById('student-modal');
  modal?.querySelector('.modal-panel')?.classList.remove('modal-panel-open');
  setTimeout(() => modal?.remove(), 200);
  currentModalUsername = null;
}

function switchModalTab(tab, btn) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(`tab-${tab}`).style.display = 'block';
}

// ── Save / Delete ─────────────────────────────────────────────────────────────
async function saveStudentLevel() {
  const level = document.getElementById('modal-level').value;
  const feedback = document.getElementById('modal-edit-feedback');
  const { ok, data } = await apiPut(`/dashboard/students/${encodeURIComponent(currentModalUsername)}`, { level });
  if (ok) {
    _showModalFeedback(feedback, t('dash.level_updated'), 'success');
    const s = allStudents.find(s => s.username === currentModalUsername);
    if (s) s.level = level;
    _renderStudentsTable('students-table', allStudents);
    _renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
  } else {
    _showModalFeedback(feedback, data.detail || t('dash.err_save'), 'error');
  }
}

async function saveStudentPrompt() {
  const custom_prompt = document.getElementById('modal-prompt').value.trim();
  const feedback = document.getElementById('modal-prompt-feedback');
  const { ok, data } = await apiPut(`/dashboard/students/${encodeURIComponent(currentModalUsername)}`, { custom_prompt });
  if (ok) {
    _showModalFeedback(feedback, t('dash.prompt_saved'), 'success');
    const s = allStudents.find(s => s.username === currentModalUsername);
    if (s) s.custom_prompt = custom_prompt;
  } else {
    _showModalFeedback(feedback, data.detail || t('dash.err_save'), 'error');
  }
}

async function clearStudentPrompt() {
  document.getElementById('modal-prompt').value = '';
  await saveStudentPrompt();
}

function confirmDeleteStudent(username) {
  document.getElementById('delete-confirm')?.remove();
  const popup = document.createElement('div');
  popup.id = 'delete-confirm';
  Object.assign(popup.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    background: 'var(--surface)', border: '1px solid hsla(355,78%,60%,0.4)',
    borderRadius: '14px', padding: '1.5rem', zIndex: '10000',
    display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '280px',
    boxShadow: 'var(--shadow-lg)',
  });
  popup.innerHTML = `
    <p style="font-size:0.9rem;font-weight:700;margin:0;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);margin-right:0.4rem;"></i>${t('gen.delete')} @${escHtml(username)}?</p>
    <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">${t('dash.confirm_delete_msg')}</p>
    <div style="display:flex;gap:0.5rem;">
      <button id="del-yes" style="flex:1;padding:0.5rem;background:var(--danger);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;">${t('dash.confirm_delete')}</button>
      <button id="del-no"  style="flex:1;padding:0.5rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">${t('gen.cancel')}</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById('del-no').onclick = () => popup.remove();
  document.getElementById('del-yes').onclick = async () => { popup.remove(); await _deleteStudent(username); };
}

async function _deleteStudent(username) {
  const { ok } = await apiDelete(`/dashboard/students/${encodeURIComponent(username)}`);
  if (!ok) { showToast('Erro ao excluir aluno. Tente novamente.', 'error'); return; }
  closeStudentModal();
  allStudents = allStudents.filter(s => s.username !== username);
  _renderStudentsTable('students-table', allStudents);
  _renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
  _loadStats();
}

// ── Insight / Grammar / Interests ─────────────────────────────────────────────
async function generateInsight() {
  const btn = document.getElementById('btn-generate-insight');
  const content = document.getElementById('insight-content');
  btn.disabled = true;
  btn.textContent = t('dash.analyzing');
  content.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2rem;color:var(--text-muted);"><div class="insight-spinner"></div><p style="font-size:0.85rem;">${t('dash.analyzing')}</p></div>`;

  try {
    const lang = I18n.getLang();
    const data = await apiGet(`/dashboard/students/${encodeURIComponent(currentModalUsername)}/insight?lang=${encodeURIComponent(lang)}`);
    content.innerHTML = `<div class="insight-text">${_formatInsight(data.insight)}</div>`;
  } catch (e) {
    content.innerHTML = `<div class="modal-feedback error" style="display:block;">❌ ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = t('dash.regenerate');
  }
}

async function generateGrammarErrors() {
  const btn = document.getElementById('btn-generate-grammar');
  const content = document.getElementById('insight-content');
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('dash.analyzing');
  content.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2rem;color:var(--text-muted);"><div class="insight-spinner"></div><p style="font-size:0.85rem;">${t('dash.mapping_errors')}</p></div>`;

  try {
    const lang = I18n.getLang();
    const data = await apiGet(`/dashboard/students/${encodeURIComponent(currentModalUsername)}/grammar-errors?lang=${encodeURIComponent(lang)}`);
    const errors = Array.isArray(data?.errors) ? data.errors : [];

    if (!errors.length) {
      content.innerHTML = `<div class="insight-placeholder"><i class="fa-solid fa-circle-check" style="font-size:1.4rem;color:var(--success);display:block;margin-bottom:0.75rem;"></i><p>${t('dash.no_grammar_errors')}</p></div>`;
      return;
    }

    const items = errors.sort((a, b) => b.count - a.count).map((e, i) => `
      <div style="padding:0.75rem 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;gap:1rem;">
          <strong>${i + 1}. ${escHtml(e.category || 'Unknown')}</strong>
          <span class="level-badge">${Number(e.count || 0)}×</span>
        </div>
        ${e.example ? `<div style="margin-top:0.4rem;font-size:0.875rem;color:var(--text-muted);"><em>${t('dash.exemples')}:</em> ${escHtml(e.example)}</div>` : ''}
      </div>`).join('');

    content.innerHTML = `<div class="insight-text"><h4>🧩 ${t('dash.grammar_errors')}</h4>${items}</div>`;
  } catch (e) {
    content.innerHTML = `<div class="modal-feedback error" style="display:block;">❌ ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

async function fetchStudentInterests() {
  const btn     = document.getElementById('btn-generate-interests');
  const feedback = document.getElementById('interests-feedback');
  const intCont  = document.getElementById('interests-container');
  const recCont  = document.getElementById('recommendations-container');
  btn.disabled = true;
  btn.textContent = t('dash.analyzing');
  feedback.style.display = 'none';

  try {
    const lang = I18n.getLang();  // ← passa o idioma do app
    const data = await apiGet(
      `/dashboard/students/${encodeURIComponent(currentModalUsername)}/recommendations?lang=${encodeURIComponent(lang)}`
    );
    intCont.innerHTML = '';
    recCont.innerHTML = '';

    (data.interests || []).forEach(interest => {
      const badge = document.createElement('span');
      badge.textContent = interest;
      badge.style.cssText = 'background:var(--surface-hover);color:var(--text);padding:0.2rem 0.6rem;border-radius:4px;font-size:0.85rem;border:1px solid var(--border);';
      intCont.appendChild(badge);
    });
    if (!data.interests?.length) {
      intCont.innerHTML = `<span style="color:var(--text-muted);font-size:0.85rem;">${t('dash.no_interests')}</span>`;
    }

    (data.recommendations || []).forEach(rec => {
      const item = document.createElement('div');
      item.innerHTML = `<strong>${t('dash.action')}</strong> ${escHtml(rec)}`;
      item.style.cssText = 'background:var(--surface);padding:0.75rem;border-radius:6px;font-size:0.875rem;border-left:3px solid var(--primary);';
      recCont.appendChild(item);
    });
    if (!data.recommendations?.length) {
      recCont.innerHTML = `<span style="color:var(--text-muted);font-size:0.85rem;">${t('dash.no_recs')}</span>`;
    }

  } catch (e) {
    _showModalFeedback(feedback, t('gen.error'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('dash.redo_analysis');
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────
async function _loadReports() {
  try {
    await _loadStudents();
    const data = await apiGet('/dashboard/reports/overview');

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? '—';
    };

    setEl('val-students', data.total_students ?? 0);
    setEl('val-msgs',     data.total_messages ?? 0);
    setEl('val-active',   data.active_today ?? 0);

    // ── Barras semanais ───────────────────────────────────────────
    const dayKeys   = ['day1','day2','day3','day4','day5','day6','day7'];
    const dayLabels = dayKeys.map(k => t(`dash.${k}`));
    const vals = Array.isArray(data.weekly_activity) && data.weekly_activity.length === 7
      ? data.weekly_activity
      : [0,0,0,0,0,0,0];

    const maxVal = Math.max(...vals, 1);
    const total  = vals.reduce((a, b) => a + b, 0);
    const avg    = Math.round(total / vals.length);

    setEl('stat-avg',        avg);
    setEl('stat-peak',       maxVal);
    setEl('stat-total-week', total);

    const todayIdx = new Date().getDay();          // 0=Dom … 6=Sáb
    const todayBar = todayIdx === 0 ? 6 : todayIdx - 1; // converte pra seg=0

    const barsEl = document.getElementById('bars');
    if (barsEl) {
      // Escala dinâmica: teto mínimo de 10 msgs para evitar barras gigantes
      // quando os valores são baixos (ex: máx=4 → escala como se fosse 10)
      const scaleMax = Math.max(maxVal, 10);
      const MAX_H = 80;
      barsEl.innerHTML = vals.map((v, i) => {
        const isToday = i === todayBar;
        const h = v === 0 ? 3 : Math.max(6, Math.round((v / scaleMax) * MAX_H));
        return `
          <div class="chart-bar-wrap">
            <div style="font-size:10px;color:var(--text-muted);text-align:center;min-height:16px;line-height:16px;">
              ${v > 0 ? v : ''}
            </div>
            <div class="bar${isToday ? ' today' : ''}" style="height:${h}px"
                 title="${dayLabels[i]}: ${v} msgs"></div>
            <div class="bar-label" style="${isToday ? 'color:var(--primary);font-weight:600' : ''}">
              ${dayLabels[i]}
            </div>
          </div>`;
      }).join('');
    }

    // ── Donut — distribuição de níveis ────────────────────────────
    const rawDist = data.level_distribution || {};
    const totalStudents = Object.values(rawDist).reduce((a, b) => a + b, 0);

    const LEVEL_COLORS = {
      'Beginner':         '#7c3aed',
      'Pre-Intermediate': '#a855f7',
      'Intermediate':     '#c084fc',
      'Business English': '#34d399',
      'Advanced':         '#f59e0b',
    };

    const levels = Object.entries(rawDist)
      .filter(([, v]) => v > 0)
      .map(([name, count]) => ({
        name,
        count,
        pct: totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0,
        color: LEVEL_COLORS[name] || '#6b7280',
      }));

    setEl('donut-center-num', totalStudents || '—');

    // Desenha o SVG do donut
    const svg = document.getElementById('donut-svg');
    const legend = document.getElementById('legend');
    if (svg) {
      const cx = 70, cy = 70, r = 52, stroke = 22;
      const circ = 2 * Math.PI * r;
      svg.innerHTML = '';

      if (!levels.length) {
        // Anel vazio estilizado quando não há dados
        svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}"
          fill="none" stroke="var(--border)" stroke-width="${stroke}"/>`;
      } else {
        let offset = 0;
        // Pequena rotação para começar do topo (−90°)
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);

        levels.forEach(lv => {
          const dash = (lv.pct / 100) * circ;
          const gap  = circ - dash;
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', cx);
          circle.setAttribute('cy', cy);
          circle.setAttribute('r', r);
          circle.setAttribute('fill', 'none');
          circle.setAttribute('stroke', lv.color);
          circle.setAttribute('stroke-width', stroke);
          circle.setAttribute('stroke-dasharray', `${dash} ${gap}`);
          circle.setAttribute('stroke-dashoffset', -offset);
          circle.setAttribute('stroke-linecap', 'butt');
          circle.setAttribute('cursor', 'pointer');
          circle.addEventListener('click', () => showStudentsByLevel(lv.name));
          circle.addEventListener('mouseenter', () => { circle.setAttribute('stroke-width', stroke + 4); });
          circle.addEventListener('mouseleave', () => { circle.setAttribute('stroke-width', stroke); });
          // Tooltip nativo
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = `${lv.name}: ${lv.count} (${lv.pct}%)`;
          circle.appendChild(title);
          g.appendChild(circle);
          offset += dash;
        });
        svg.appendChild(g);
      }
    }

    // Legenda clicável
    if (legend) {
      legend.innerHTML = levels.length
        ? levels.map(lv => `
            <div class="legend-item legend-item-btn" onclick="showStudentsByLevel('${lv.name}')"
                 style="cursor:pointer;" title="${t('dash.col_level')}: ${lv.name}">
              <span class="legend-dot" style="background:${lv.color}"></span>
              <span class="legend-label">${lv.name}</span>
              <span class="legend-val">${lv.count} <span style="color:var(--text-muted);font-size:0.72rem;">(${lv.pct}%)</span></span>
              <i class="fa-solid fa-chevron-right" style="font-size:0.65rem;color:var(--text-muted);margin-left:auto;"></i>
            </div>`).join('')
        : `<p style="color:var(--text-muted);font-size:0.8rem;">Sem dados de nível.</p>`;
    }

    // Heatmap removido

  } catch (e) { console.error('[Reports]', e); }
}

// ── Modal: alunos por nível ───────────────────────────────────────
function showStudentsByLevel(level) {
  document.getElementById('level-modal')?.remove();

  const students = allStudents.filter(s => s.level === level);

  const overlay = document.createElement('div');
  overlay.id = 'level-modal';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9000;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,0.65); backdrop-filter:blur(6px); padding:1rem;
  `;

  const rows = students.length
    ? students.map(s => `
        <tr onclick="closeStudentModal();document.getElementById('level-modal')?.remove();openStudentModal('${s.username}')"
            style="cursor:pointer;">
          <td>
            <div class="student-name-cell">
              ${s.avatar_url
                ? `<img src="${s.avatar_url}" class="student-avatar-img" alt="">`
                : `<div class="student-avatar">${_initials(s.name || s.username)}</div>`}
              <div>
                <div class="student-name">${escHtml(s.name || s.username)}</div>
                <div class="student-username">@${escHtml(s.username)}</div>
              </div>
            </div>
          </td>
          <td class="td-muted">${escHtml(s.focus || '—')}</td>
          <td class="td-num">${s.total_messages ?? 0}</td>
          <td class="td-muted td-sm">${s.last_active ? _formatDate(s.last_active) : '—'}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" style="padding:2rem;text-align:center;color:var(--text-muted);">${t('dash.no_students')}</td></tr>`;

  overlay.innerHTML = `
    <div style="
      background:var(--surface); border:1px solid var(--border);
      border-radius:16px; width:100%; max-width:600px;
      max-height:80vh; display:flex; flex-direction:column;
      box-shadow:0 24px 64px rgba(0,0,0,0.4);
      animation:modalIn 0.2s ease;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);">
        <div>
          <h2 style="margin:0;font-size:1rem;font-weight:700;color:var(--text);">
            ${level}
          </h2>
          <p style="margin:0.2rem 0 0;font-size:0.78rem;color:var(--text-muted);">
            ${students.length} ${students.length === 1 ? t('dash.al_dis') : t('dash.al_dis') + 's'}
          </p>
        </div>
        <button onclick="document.getElementById('level-modal').remove()" style="
          width:32px;height:32px;border-radius:8px;border:1px solid var(--border);
          background:none;color:var(--text-muted);cursor:pointer;font-size:1rem;
          display:flex;align-items:center;justify-content:center;
        ">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1;">
        <table class="data-table" style="width:100%;">
          <thead>
            <tr>
              <th>${t('dash.col_student')}</th>
              <th>${t('dash.col_focus')}</th>
              <th>${t('dash.col_msgs')}</th>
              <th>${t('dash.col_last')}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Overview difficulties ─────────────────────────────────────────────────────
async function _loadOverview() {
  const tbody = document.getElementById('difficulties-tbody');
  if (!tbody) return;
  try {
    const data = await apiGet('/dashboard/difficulties');
    const alerts = data.alerts || [];
    tbody.innerHTML = '';
    if (!alerts.length) {
      tbody.innerHTML = `<tr><td colspan="2" style="padding:2rem;text-align:center;color:var(--success);"><i class="fa-solid fa-check-circle" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>${t('dash.no_alerts')}</td></tr>`;
      return;
    }
    alerts.forEach(s => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid var(--border)';
      row.innerHTML = `<td style="padding:1rem;font-weight:500;">${escHtml(s.username)}</td><td style="padding:1rem;color:var(--warning);">${escHtml(s.current_difficulty)}</td>`;
      tbody.appendChild(row);
    });
  } catch (e) { tbody.innerHTML = `<tr><td colspan="2" style="padding:1rem;text-align:center;color:var(--danger);">${t('gen.error')}</td></tr>`; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _showModalFeedback(el, msg, type) {
  el.textContent = msg;
  el.className = `modal-feedback ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function _formatInsight(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<h4>$1</h4>').replace(/\n/g, '<br>');
}

function _initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
function _formatDate(iso) { 
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(I18n.getLang(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso || '—'; } 
}
function logout() { authLogout(); }

// ── Simulations Management ──────────────────────────────────────────────────

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

async function _loadSimulations() {
  const grid = document.getElementById('simulations-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="mod-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  
  try {
    const data = await apiGet('/dashboard/simulations');
    const sims = data.simulations || [];
    
    if (sims.length === 0) {
      grid.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-theater-masks"></i><p>${t('mod.fc_none')}</p></div>`;
      return;
    }
    
    grid.innerHTML = sims.map(s => {
      const key = SIM_KEY_MAP[s.name];
      const title = key ? t(`sim.title_${key}`) : s.name;
      const desc = key ? t(`sim.desc_${key}`) : s.description;
      const diffLabel = t(`level.${s.difficulty?.toLowerCase().replace('-', '_')}`) || s.difficulty;

      return `
      <div class="simulation-admin-card">
        <div class="sim-admin-icon">${s.icon || '🎭'}</div>
        <div class="sim-admin-info">
          <h4>${title}</h4>
          <p class="sim-admin-desc">${desc || ''}</p>
          <div class="sim-admin-meta">
            <span class="sim-diff-badge">${diffLabel}</span>
            <span class="sim-admin-by">${t('dash.col_since')} ${s.created_by || '—'}</span>
          </div>
        </div>
        <div class="sim-admin-actions">
          <button class="btn-sim-edit" onclick="openSimModal('${s.id}')" title="${t('dash.edit')}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-sim-delete" onclick="deleteSimulation('${s.id}')" title="${t('mod.delete')}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;}).join('');
  } catch (e) {
    grid.innerHTML = `<div class="mod-empty"><i class="fa-solid fa-exclamation-circle"></i><p>${t('gen.error')}</p></div>`;
  }
}

let editingSimId = null;

async function openSimModal(simId = null) {
  editingSimId = simId;
  const modal = document.getElementById('create-sim-modal');
  const modalTitle = document.getElementById('sim-modal-title');
  const saveBtn = document.getElementById('btn-save-sim');
  modal.style.display = 'flex';
  
  if (simId) {
    modalTitle.textContent = t('dash.edit_simulation');
    saveBtn.textContent = t('gen.save');
  } else {
    modalTitle.textContent = t('dash.new_simulation');
    saveBtn.textContent = t('mod.publish');
  }
  
  if (typeof I18n !== 'undefined') I18n.applyToDOM(modal);

  // Reset form
  document.getElementById('sim-name').value = '';
  document.getElementById('sim-desc').value = '';
  document.getElementById('sim-icon').value = '';
  document.getElementById('sim-difficulty').value = 'beginner';
  document.getElementById('sim-prompt').value = '';
  document.getElementById('sim-use-ai').checked = true;

  if (simId) {
    try {
      const data = await apiGet(`/dashboard/simulations/${simId}`);
      if (data) {
        document.getElementById('sim-name').value = data.name || '';
        document.getElementById('sim-desc').value = data.description || '';
        document.getElementById('sim-icon').value = data.icon || '';
        document.getElementById('sim-difficulty').value = data.difficulty || 'beginner';
        document.getElementById('sim-prompt').value = data.system_prompt || '';
        document.getElementById('sim-use-ai').checked = false; // Desativa por padrão ao editar para não sobrescrever
      }
    } catch (e) { console.error('Erro ao buscar simulação:', e); }
  }
}

async function saveSimulation() {
  const payload = {
    name: document.getElementById('sim-name').value.trim(),
    description: document.getElementById('sim-desc').value.trim(),
    icon: document.getElementById('sim-icon').value.trim() || '',
    difficulty: document.getElementById('sim-difficulty').value,
    system_prompt: document.getElementById('sim-prompt').value.trim(),
    use_ai_generation: document.getElementById('sim-use-ai').checked
  };

  if (!payload.name || !payload.description) {
    showToast(t('act.fb_fill_all'), 'warning');
    return;
  }

  try {
    if (editingSimId) {
      await apiPut(`/dashboard/simulations/${editingSimId}`, payload);
      showToast(t('gen.success'), 'success');
    } else {
      await apiPost('/dashboard/simulations', payload);
      showToast(t('gen.success'), 'success');
    }
    closeCreateSimulationModal();
    _loadSimulations();
  } catch (e) {
    showToast(t('gen.error'), 'error');
  }
}

function closeCreateSimulationModal() {
  document.getElementById('create-sim-modal').style.display = 'none';
  editingSimId = null;
}

async function deleteSimulation(simId) {
  if (!confirm('Tem certeza que deseja excluir esta simulação?')) return;
  try {
    await apiDelete(`/dashboard/simulations/${simId}`);
    _loadSimulations();
  } catch (e) {
    showToast('Erro ao excluir simulação.', 'error');
  }
}
