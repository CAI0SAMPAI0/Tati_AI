if (!requireAuth()) throw new Error('Unauthenticated');
const _dashUser = getUser();
if (!isStaff(_dashUser)) {
  alert('Acesso negado. Área restrita a professores.');
  window.location.href = '/chat.html';
}

let allStudents          = [];
let currentModalUsername = null;
let reportsChartInstance = null;

// ── Seções ────────────────────────────────────────────────────────────────────
const SECTIONS = {
  overview: { title: () => t('dash.overview'), sub: () => t('dash.overview_sub') },
  students: { title: () => t('dash.students'), sub: () => t('dash.students_sub') },
  reports:  { title: () => t('dash.reports'),  sub: () => t('dash.reports_sub')  },
};

window.addEventListener('DOMContentLoaded', () => {
  _loadStats();
  _loadStudents();
  _loadOverview();
});

window.addEventListener('langchange', () => {
  const active = document.querySelector('.dash-nav-item.active');
  if (!active) return;
  const name = (active.getAttribute('href') || '').replace('#', '');
  if (SECTIONS[name]) {
    document.getElementById('page-title').textContent = SECTIONS[name].title();
    document.getElementById('page-sub').textContent   = SECTIONS[name].sub();
  }
});

function setSection(name, el) {
  document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
  if (el?.tagName === 'A') el.classList.add('active');
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.getElementById(`section-${name}`)?.setAttribute('style', 'display:block');
  document.getElementById('page-title').textContent = SECTIONS[name]?.title() || name;
  document.getElementById('page-sub').textContent   = SECTIONS[name]?.sub()   || '';
  if (name === 'reports')  _loadReports();
  if (name === 'overview') _loadOverview();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function _loadStats() {
  try {
    const data = await apiGet('/dashboard/stats');
    document.getElementById('stat-total-students').textContent = data.total_students ?? '—';
    document.getElementById('stat-total-messages').textContent = data.total_messages ?? '—';
    document.getElementById('stat-active-today').textContent   = data.active_today   ?? '—';
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
      <td class="td-muted">${escHtml(s.last_active || '—')}</td>
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
            ${['Beginner','Pre-Intermediate','Intermediate','Business English','Advanced'].map(l =>
              `<option value="${l}" ${s.level === l ? 'selected' : ''}>${l}</option>`
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
  const level    = document.getElementById('modal-level').value;
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
  const feedback      = document.getElementById('modal-prompt-feedback');
  const { ok, data }  = await apiPut(`/dashboard/students/${encodeURIComponent(currentModalUsername)}`, { custom_prompt });
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
    position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
    background:'var(--surface)', border:'1px solid hsla(355,78%,60%,0.4)',
    borderRadius:'14px', padding:'1.5rem', zIndex:'10000',
    display:'flex', flexDirection:'column', gap:'0.75rem', minWidth:'280px',
    boxShadow:'var(--shadow-lg)',
  });
  popup.innerHTML = `
    <p style="font-size:0.9rem;font-weight:700;margin:0;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);margin-right:0.4rem;"></i>Excluir @${escHtml(username)}?</p>
    <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Esta ação é irreversível.</p>
    <div style="display:flex;gap:0.5rem;">
      <button id="del-yes" style="flex:1;padding:0.5rem;background:var(--danger);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;">${t('dash.confirm_delete')}</button>
      <button id="del-no"  style="flex:1;padding:0.5rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">Cancelar</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById('del-no').onclick  = () => popup.remove();
  document.getElementById('del-yes').onclick = async () => { popup.remove(); await _deleteStudent(username); };
}

async function _deleteStudent(username) {
  const { ok } = await apiDelete(`/dashboard/students/${encodeURIComponent(username)}`);
  if (!ok) { alert('Erro ao excluir aluno. Tente novamente.'); return; }
  closeStudentModal();
  allStudents = allStudents.filter(s => s.username !== username);
  _renderStudentsTable('students-table', allStudents);
  _renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
  _loadStats();
}

// ── Insight / Grammar / Interests ─────────────────────────────────────────────
async function generateInsight() {
  const btn     = document.getElementById('btn-generate-insight');
  const content = document.getElementById('insight-content');
  btn.disabled  = true;
  btn.textContent = t('dash.analyzing');
  content.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2rem;color:var(--text-muted);"><div class="insight-spinner"></div><p style="font-size:0.85rem;">Analisando...</p></div>`;

  try {
    const lang = I18n.getLang();
    const data = await apiGet(`/dashboard/students/${encodeURIComponent(currentModalUsername)}/insight?lang=${encodeURIComponent(lang)}`);
    content.innerHTML = `<div class="insight-text">${_formatInsight(data.insight)}</div>`;
  } catch (e) {
    content.innerHTML = `<div class="modal-feedback error" style="display:block;">❌ ${e.message}</div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = t('dash.regenerate');
  }
}

async function generateGrammarErrors() {
  const btn     = document.getElementById('btn-generate-grammar');
  const content = document.getElementById('insight-content');
  const oldLabel = btn.textContent;
  btn.disabled  = true;
  btn.textContent = 'Analisando...';
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
    btn.disabled    = false;
    btn.textContent = oldLabel;
  }
}

async function fetchStudentInterests() {
  const btn        = document.getElementById('btn-generate-interests');
  const feedback   = document.getElementById('interests-feedback');
  const intCont    = document.getElementById('interests-container');
  const recCont    = document.getElementById('recommendations-container');
  btn.disabled     = true;
  btn.textContent  = t('dash.analyzing');
  feedback.style.display = 'none';

  try {
    const data = await apiGet(`/dashboard/students/${encodeURIComponent(currentModalUsername)}/recommendations`);
    intCont.innerHTML = '';
    recCont.innerHTML = '';

    (data.interests || []).forEach(interest => {
      const badge = document.createElement('span');
      badge.textContent = interest;
      badge.style.cssText = 'background:var(--surface-hover);color:var(--text);padding:0.2rem 0.6rem;border-radius:4px;font-size:0.85rem;border:1px solid var(--border);';
      intCont.appendChild(badge);
    });
    if (!data.interests?.length) intCont.innerHTML = `<span style="color:var(--text-muted);">Nenhum mapeado ainda.</span>`;

    (data.recommendations || []).forEach(rec => {
      const item = document.createElement('div');
      item.innerHTML = `<strong>${t('dash.action')}</strong> ${escHtml(rec)}`;
      item.style.cssText = 'background:var(--surface);padding:0.75rem;border-radius:6px;font-size:0.875rem;border-left:3px solid var(--primary);';
      recCont.appendChild(item);
    });
    if (!data.recommendations?.length) recCont.innerHTML = `<span style="color:var(--text-muted);">Nenhuma disponível.</span>`;

  } catch (e) {
    _showModalFeedback(feedback, 'Erro de conexão.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '🎯 Refazer Análise';
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────
async function _loadReports() {
  try {
    ['metric-students','metric-messages','metric-active'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '...';
    });

    const data = await apiGet('/dashboard/reports/overview');
    document.getElementById('metric-students').textContent = data.total_students ?? 0;
    document.getElementById('metric-messages').textContent = data.total_messages ?? 0;
    document.getElementById('metric-active').textContent   = data.active_today   ?? 0;

    const LEVEL_MAP = {
      'beginner':'Beginner','pre-intermediate':'Pre-Intermediate','pre intermediate':'Pre-Intermediate',
      'intermediate':'Intermediate','business english':'Business English','business':'Business English','advanced':'Advanced',
    };
    const COLORS = {
      'Beginner':'#3b82f6','Pre-Intermediate':'#0ea5e9','Intermediate':'#8b5cf6',
      'Business English':'#d946ef','Advanced':'#f59e0b','Sem Nível':'#64748b',
    };
    const counts = {};
    allStudents.forEach(s => {
      const key = LEVEL_MAP[(s.level || '').trim().toLowerCase()] || 'Sem Nível';
      counts[key] = (counts[key] || 0) + 1;
    });

    const labels = [], values = [], bgColors = [];
    Object.entries(counts).forEach(([k, v]) => { if (v > 0) { labels.push(k); values.push(v); bgColors.push(COLORS[k] || '#64748b'); } });
    if (!values.length) { labels.push('Sem Dados'); values.push(1); bgColors.push('#3f3f46'); }

    const ctx = document.getElementById('levelChart')?.getContext('2d');
    if (!ctx) return;
    reportsChartInstance?.destroy();
    reportsChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: 'var(--text-muted)' } } } },
    });
  } catch (e) { console.error(e); }
}

// ── Overview difficulties ─────────────────────────────────────────────────────
async function _loadOverview() {
  const tbody = document.getElementById('difficulties-tbody');
  if (!tbody) return;
  try {
    const data   = await apiGet('/dashboard/difficulties');
    const alerts = data.alerts || [];
    tbody.innerHTML = '';
    if (!alerts.length) {
      tbody.innerHTML = `<tr><td colspan="2" style="padding:2rem;text-align:center;color:var(--success);"><i class="fa-solid fa-check-circle" style="font-size:2rem;display:block;margin-bottom:0.5rem;"></i>Nenhum aluno com dificuldade registrada.</td></tr>`;
      return;
    }
    alerts.forEach(s => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid var(--border)';
      row.innerHTML = `<td style="padding:1rem;font-weight:500;">${escHtml(s.username)}</td><td style="padding:1rem;color:var(--warning);">${escHtml(s.current_difficulty)}</td>`;
      tbody.appendChild(row);
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="2" style="padding:1rem;text-align:center;color:var(--danger);">Erro ao carregar dados.</td></tr>`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _showModalFeedback(el, msg, type) {
  el.textContent = msg;
  el.className   = `modal-feedback ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function _formatInsight(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<h4>$1</h4>')
    .replace(/\n/g, '<br>');
}

function _initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
function _formatDate(iso) { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso || '—'; } }
function logout() { authLogout(); }