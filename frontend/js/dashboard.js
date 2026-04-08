if (!requireAuth()) throw new Error('Unauthenticated');
const _dashUser = getUser();
if (!isStaff(_dashUser)) {
  alert('Acesso negado. Área restrita a professores.');
  window.location.href = '/chat.html';
}

let allStudents = [];
let currentModalUsername = null;
let reportsChartInstance = null;

// usando modo claro ou escuro
(function () {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = (localStorage.getItem('theme') || 'dark') === 'dark' ? '☀️' : '🌙';
})();
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
    document.getElementById('page-sub').textContent = SECTIONS[name].sub();
  }
});

function setSection(name, el) {
  document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
  if (el?.tagName === 'A') el.classList.add('active');
  document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
  document.getElementById(`section-${name}`)?.setAttribute('style', 'display:block');
  document.getElementById('page-title').textContent = SECTIONS[name]?.title() || name;
  document.getElementById('page-sub').textContent = SECTIONS[name]?.sub() || '';
  if (name === 'reports') _loadReports();
  if (name === 'overview') _loadOverview();
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
            ${['Beginner', 'Pre-Intermediate', 'Intermediate', 'Business English', 'Advanced'].map(l =>
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
    <p style="font-size:0.9rem;font-weight:700;margin:0;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);margin-right:0.4rem;"></i>Excluir @${escHtml(username)}?</p>
    <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Esta ação é irreversível.</p>
    <div style="display:flex;gap:0.5rem;">
      <button id="del-yes" style="flex:1;padding:0.5rem;background:var(--danger);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;">${t('dash.confirm_delete')}</button>
      <button id="del-no"  style="flex:1;padding:0.5rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">Cancelar</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById('del-no').onclick = () => popup.remove();
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
  const btn = document.getElementById('btn-generate-insight');
  const content = document.getElementById('insight-content');
  btn.disabled = true;
  btn.textContent = t('dash.analyzing');
  content.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2rem;color:var(--text-muted);"><div class="insight-spinner"></div><p style="font-size:0.85rem;">Analisando...</p></div>`;

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
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

async function fetchStudentInterests() {
  const btn = document.getElementById('btn-generate-interests');
  const feedback = document.getElementById('interests-feedback');
  const intCont = document.getElementById('interests-container');
  const recCont = document.getElementById('recommendations-container');
  btn.disabled = true;
  btn.textContent = t('dash.analyzing');
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
    btn.disabled = false;
    btn.textContent = '🎯 Refazer Análise';
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────
async function _loadReports() {
  try {
    // Garante dados atualizados de alunos antes de montar o gráfico redondo
    await _loadStudents();
    // ── Métricas do topo ──────────────────────────────────────────
    const data = await apiGet('/dashboard/reports/overview');

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? '—';
    };

    setEl('val-students', data.total_students ?? 0);
    setEl('val-msgs', data.total_messages ?? 0);
    setEl('val-active', data.active_today ?? 0);

    // ── Bar chart (atividade semanal) ─────────────────────────────
    // Espera: data.weekly_activity = [28, 34, 22, 41, 19, 18, 12] (Dom→Sáb ou Seg→Dom)
    const dayKeys = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
    const dayLabels = dayKeys.map(k => t(`dash.${k}`));
    const vals = Array.isArray(data.weekly_activity) && data.weekly_activity.length === 7
      ? data.weekly_activity
      : [0, 0, 0, 0, 0, 0, 0];

    const maxVal = Math.max(...vals, 1);
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / vals.length);
    const peak = maxVal;

    setEl('stat-avg', avg);
    setEl('stat-peak', peak);
    setEl('stat-total-week', total);

    const todayIdx = new Date().getDay();           // 0=Dom
    const todayBar = todayIdx === 0 ? 6 : todayIdx - 1; // ajusta para Seg=0

    const barsEl = document.getElementById('bars');
    if (barsEl) {
      barsEl.innerHTML = vals.map((v, i) => {
        const h = v === 0 ? 4 : Math.max(8, Math.round((v / maxVal) * 120));
        const isToday = i === todayBar;
        return `<div class="chart-bar-wrap">
          <div style="font-size:10px;color:var(--text-muted);text-align:center;min-height:14px">${v}</div>
          <div class="bar${isToday ? ' today' : ''}" data-val="${v} msgs" style="height:${h}px" title="${dayLabels[i]}: ${v} msgs"></div>
          <div class="bar-label" style="${isToday ? 'color:var(--primary);font-weight:600' : ''}">${dayLabels[i]}</div>
        </div>`;
      }).join('');
    }

    // ── Donut (distribuição de níveis) ────────────────────────────
    // Constrói a partir de allStudents (já carregados) ou de data.level_distribution
    const LEVEL_MAP = {
      'beginner': 'Beginner',
      'pre-intermediate': 'Pre-Intermediate',
      'pre intermediate': 'Pre-Intermediate',
      'intermediate': 'Intermediate',
      'business english': 'Business English',
      'business': 'Business English',
      'advanced': 'Advanced',
    };
    const COLORS = {
      'Beginner': '#7c3aed',
      'Pre-Intermediate': '#0ea5e9',
      'Intermediate': '#8b5cf6',
      'Business English': '#d946ef',
      'Advanced': '#f59e0b',
      'Outros': '#64748b',
    };

    // USA SEMPRE a API — sem fallback em allStudents
    const rawDist = data.level_distribution || {};
    const levels = Object.entries(rawDist)
      .filter(([, v]) => v > 0)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / Math.max(1, Object.values(rawDist).reduce((a, b) => a + b, 0))) * 100),
        color: COLORS[name] || '#64748b',
      }));

    const totalStudents = levels.reduce((a, l) => a + l.count, 0);
    setEl('donut-center-num', totalStudents);

    // Redesenha o SVG donut
    const svg = document.getElementById('donut-svg');
    if (svg) {
      const R = 50, cx = 70, cy = 70, strokeW = 20;
      const circumference = 2 * Math.PI * R;
      svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none"
        stroke="hsla(258,40%,55%,0.1)" stroke-width="${strokeW}"/>`;

      let offset = 0;
      levels.forEach(l => {
        const dash = (l.pct / 100) * circumference;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', R);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', l.color);
        circle.setAttribute('stroke-width', strokeW);
        circle.setAttribute('stroke-linecap', 'round');
        circle.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
        circle.setAttribute('stroke-dashoffset', `${-offset}`);
        circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
        svg.appendChild(circle);
        offset += dash;
      });
    }

    // Redesenha a legenda
    const legendEl = document.getElementById('legend');
    if (legendEl) {
      legendEl.innerHTML = levels.length
        ? levels.map(l => `
            <div class="legend-item" onclick="openLevelModal('${l.name}')" style="cursor:pointer">
              <div class="legend-dot" style="background:${l.color}"></div>
              <span class="legend-name" style="font-size:12px">${l.name}</span>
              <span class="legend-pct">${l.pct}%</span>
              <span class="legend-count">${l.count}</span>
            </div>`).join('')
        : `<p style="font-size:0.8rem;color:var(--text-muted)">Sem dados de nível.</p>`;
    }

    // ── Heatmap ───────────────────────────────────────────────────
    // Espera: data.heatmap = array de 28 números (4 semanas × 7 dias, Seg→Dom)
    const heatData = Array.isArray(data.heatmap) && data.heatmap.length === 28
      ? data.heatmap
      : new Array(28).fill(0);

    const levelClass = v => {
      if (!v) return '';
      if (v <= 1) return 'l1';
      if (v <= 2) return 'l2';
      if (v <= 3) return 'l3';
      return 'l4';
    };

    const weeks = [t('dash.week4') || 'Sem 4', t('dash.week3') || 'Sem 3',
    t('dash.week2') || 'Sem 2', t('dash.week1') || 'Esta sem'];

    const weekHeaderEl = document.getElementById('week-header');
    if (weekHeaderEl) {
      weekHeaderEl.innerHTML = dayLabels.map(d =>
        `<span class="week-label">${d}</span>`).join('');
    }

    const heatmapEl = document.getElementById('heatmap');
    if (heatmapEl) {
      heatmapEl.innerHTML = heatData.map((v, i) => {
        const lc = levelClass(v);
        return `<div class="heat-cell${lc ? ' ' + lc : ''}"
          title="${weeks[Math.floor(i / 7)]}, ${dayLabels[i % 7]}: ${v * 10} msgs"></div>`;
      }).join('');
    }

    const heatDaysEl = document.getElementById('heat-days');
    if (heatDaysEl) {
      heatDaysEl.innerHTML = dayLabels.map(d =>
        `<div style="font-size:10px;color:var(--text-subtle);text-align:center">${d}</div>`).join('');
    }

  } catch (e) {
    console.error('[Reports]', e);
  }
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
  el.className = `modal-feedback ${type}`;
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

function openLevelModal(levelName) {
  document.getElementById('level-modal')?.remove();

  const filtered = allStudents.filter(s =>
    (s.level || '').trim().toLowerCase() === levelName.trim().toLowerCase()
  );

  const modal = document.createElement('div');
  modal.id = 'level-modal';

  // overlay fixo que centraliza
  Object.assign(modal.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)',
  });

  modal.innerHTML = `
    <div class="modal-panel" style="max-width:480px;width:90%;margin:0;">
      <div class="modal-header">
        <div>
          <div class="modal-student-name">Nível: ${escHtml(levelName)}</div>
          <div class="modal-student-meta">${filtered.length} aluno(s)</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('level-modal').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="padding:1rem;display:flex;flex-direction:column;gap:0.5rem;max-height:400px;overflow-y:auto">
        ${filtered.length ? filtered.map(s => `
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem;
                      background:var(--bg);border-radius:10px;border:1px solid var(--border);cursor:pointer"
               onclick="document.getElementById('level-modal').remove(); openStudentModal('${escHtml(s.username)}')">
            ${s.avatar_urlf
      ? `<img src="${s.avatar_url}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
      : `<div class="student-avatar">${_initials(s.name || s.username)}</div>`}
            <div>
              <div style="font-size:0.875rem;font-weight:600">${escHtml(s.name || s.username)}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">@${escHtml(s.username)} · ${s.total_messages ?? 0} msgs</div>
            </div>
          </div>`).join('')
      : `<p style="color:var(--text-muted);text-align:center;padding:1rem">Nenhum aluno neste nível.</p>`}
      </div>
    </div>`;

  document.body.appendChild(modal);

  // fecha ao clicar no backdrop
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  requestAnimationFrame(() => modal.querySelector('.modal-panel').classList.add('modal-panel-open'));
}

function _initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
function _formatDate(iso) { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso || '—'; } }
function logout() { authLogout(); }