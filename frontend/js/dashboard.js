const API = 'http://127.0.0.1:8000';

const token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }
const userLocal = JSON.parse(userRaw);

const STAFF_ROLES = ['professor', 'professora', 'programador', 'Tatiana', 'Tati'];
if (!STAFF_ROLES.includes(userLocal.role)) {
    alert('Acesso negado. Esta área é restrita a professores.');
    window.location.href = '/chat.html';
}

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

window.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadStudents();
    loadOverview();
});

// ── Navigation ────────────────────────────────────────────────────
const sections = {
    overview: { title: () => t('dash.overview'), sub: () => t('dash.overview_sub') },
    students: { title: () => t('dash.students'), sub: () => t('dash.students_sub') },
    reports: { title: () => t('dash.reports'), sub: () => t('dash.reports_sub') },
};
let allStudents = [];

function setSection(name, el) {
    if (el && el.tagName === 'A') {
        document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
    }
    document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
    const sec = document.getElementById('section-' + name);
    if (sec) sec.style.display = 'block';
    document.getElementById('page-title').textContent = sections[name]?.title() || name;
    document.getElementById('page-sub').textContent = sections[name]?.sub() || '';

    if (name === 'reports') {
        loadReports();
    } else if (name === 'overview') {
        loadOverview();
    }
}

window.addEventListener('langchange', () => {
    const active = document.querySelector('.dash-nav-item.active');
    if (active) {
        const href = active.getAttribute('href') || '';
        const name = href.replace('#', '');
        if (sections[name]) {
            document.getElementById('page-title').textContent = sections[name].title();
            document.getElementById('page-sub').textContent = sections[name].sub();
        }
    }
});

// ── Stats 
async function loadStats() {
    try {
        const res = await fetch(`${API}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('stat-total-students').textContent = data.total_students ?? '—';
        document.getElementById('stat-total-messages').textContent = data.total_messages ?? '—';
        document.getElementById('stat-active-today').textContent = data.active_today ?? '—';
    } catch (e) { console.error('loadStats', e); }
}

// ── Students 
async function loadStudents() {
    try {
        const res = await fetch(`${API}/dashboard/students`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        allStudents = await res.json();
        renderStudentsTable('students-table', allStudents);
        renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
    } catch (e) { console.error('loadStudents', e); }
}

function filterStudents() {
    const q = document.getElementById('student-search').value.toLowerCase();
    const filtered = allStudents.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q) ||
        s.level?.toLowerCase().includes(q)
    );
    renderStudentsTable('students-table', filtered);
}

function renderStudentsTable(containerId, students, compact = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!students.length) {
        container.innerHTML = `<p class="empty-state">${t('dash.no_students')}</p>`;
        return;
    }
    const rows = students.map(s => `
        <tr onclick="openStudentModal('${esc(s.username)}')" style="cursor:pointer">
            <td>
                <div class="student-name-cell">
                    ${s.avatar_url
            ? `<img src="${s.avatar_url}" class="student-avatar-img" alt="">`
            : `<div class="student-avatar">${getInitials(s.name || s.username)}</div>`}
                    <div>
                        <div class="student-name">${esc(s.name || s.username)}</div>
                        <div class="student-username">@${esc(s.username)}</div>
                    </div>
                </div>
            </td>
            <td><span class="level-badge">${esc(s.level || '—')}</span></td>
            ${!compact ? `<td class="td-muted">${esc(s.focus || '—')}</td>` : ''}
            <td class="td-muted">${esc(s.last_active || '—')}</td>
            ${!compact ? `<td class="td-num">${s.total_messages ?? 0}</td>` : ''}
            <td class="td-muted td-sm">${formatDate(s.created_at)}</td>
        </tr>
    `).join('');

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

// ── Student Modal ─────────────────────────────────────────────────
let currentModalUsername = null;

function openStudentModal(username) {
    currentModalUsername = username;
    const student = allStudents.find(s => s.username === username);
    if (!student) return;

    document.getElementById('student-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'student-modal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeStudentModal()"></div>
        <div class="modal-panel">

            <div class="modal-header">
                <div class="modal-student-info">
                    ${student.avatar_url
            ? `<img src="${student.avatar_url}" class="modal-avatar-img" alt="">`
            : `<div class="modal-avatar">${getInitials(student.name || student.username)}</div>`}
                    <div>
                        <div class="modal-student-name">${esc(student.name || student.username)}</div>
                        <div class="modal-student-meta">@${esc(student.username)} · ${esc(student.level || '—')} · ${student.total_messages ?? 0} msgs</div>
                    </div>
                </div>
                <button class="modal-close" onclick="closeStudentModal()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="modal-tabs">
                <button class="modal-tab active" onclick="switchModalTab('edit', this)">${t('dash.edit')}</button>
                <button class="modal-tab"        onclick="switchModalTab('prompt', this)">${t('dash.prompt')}</button>
                <button class="modal-tab"        onclick="switchModalTab('insight', this)">${t('dash.insight')}</button>
                <button class="modal-tab"        onclick="switchModalTab('interests', this)">${t('dash.interests')}</button>
            </div>

            <!-- Tab: Edit -->
            <div class="modal-tab-content" id="tab-edit">
                <div class="modal-field">
                    <label>${t('dash.col_level')}</label>
                    <select id="modal-level">
                        <option value="Beginner"         ${student.level === 'Beginner' ? 'selected' : ''}>${t('level.beginner')}</option>
                        <option value="Pre-Intermediate" ${student.level === 'Pre-Intermediate' ? 'selected' : ''}>${t('level.pre_int')}</option>
                        <option value="Intermediate"     ${student.level === 'Intermediate' ? 'selected' : ''}>${t('level.intermediate')}</option>
                        <option value="Business English" ${student.level === 'Business English' ? 'selected' : ''}>${t('level.business')}</option>
                        <option value="Advanced"         ${student.level === 'Advanced' ? 'selected' : ''}>${t('level.advanced')}</option>
                    </select>
                </div>
                <div id="modal-edit-feedback" class="modal-feedback" style="display:none"></div>
                <div class="modal-actions">
                    <button class="btn-modal-save" onclick="saveStudentLevel()">
                        <i class="fa-solid fa-floppy-disk"></i> ${t('dash.save_level')}
                    </button>
                    <button class="btn-modal-danger" onclick="confirmDeleteStudent('${esc(username)}')">
                        <i class="fa-solid fa-trash-can"></i> ${t('dash.delete_student')}
                    </button>
                </div>
            </div>

            <!-- Tab: Custom Prompt -->
            <div class="modal-tab-content" id="tab-prompt" style="display:none">
                <p class="modal-hint">${t('dash.prompt_hint')}
                </p>
                <textarea id="modal-prompt" class="modal-textarea"
                    placeholder="Ex: This student is preparing for a job interview at a tech company..."
                >${esc(student.custom_prompt || '')}</textarea>
                <div id="modal-prompt-feedback" class="modal-feedback" style="display:none"></div>
                <div class="modal-actions">
                    <button class="btn-modal-save" onclick="saveStudentPrompt()">
                        <i class="fa-solid fa-floppy-disk"></i> ${t('dash.save_prompt')}
                    </button>
                    <button class="btn-modal-secondary" onclick="clearStudentPrompt()">
                        <i class="fa-solid fa-eraser"></i> ${t('dash.clear_prompt')}
                    </button>
                </div>
            </div>

            <!-- Tab: Insight -->
            <div class="modal-tab-content" id="tab-insight" style="display:none">
                <div id="insight-content">
                    <div class="insight-placeholder">
                        <i class="fa-solid fa-brain" style="font-size:1.5rem;color:var(--primary);margin-bottom:0.75rem;display:block;"></i>
                        <p>${t('dash.click')}</p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-modal-save" id="btn-generate-insight" onclick="generateInsight()">
                        ${t('dash.generate_insight')}
                    </button>
                    <button class="btn-modal-secondary" id="btn-generate-grammar" onclick="generateGrammarErrors()">
                       🧩 ${t('dash.grammar_errors')}
                    </button>
                </div>
            </div>

            <div class="modal-tab-content" id="tab-insight" style="display:none">
                </div>

            <div class="modal-tab-content" id="tab-interests" style="display:none">
                <div class="modal-actions" style="justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">
                        ${t('dash.interests_hint')}
                    </p>
                    <button class="btn-modal-save" id="btn-generate-interests" onclick="fetchStudentInterests()">
                        ${t('dash.analyze_interests')}
                    </button>
                </div>
                
                <div id="interests-feedback" class="modal-feedback" style="display:none"></div>

                <div id="interests-content">
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--primary);">${t('dash.interests_focus')}</h4>
                        <div id="interests-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">${t('dash.click_to_load')}</span>
                        </div>
                    </div>

                    <div>
                        <h4 style="margin-bottom: 0.5rem; color: var(--primary);">${t('dash.practical_rec')}</h4>
                        <div id="recommendations-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <span style="color: var(--text-muted); font-size: 0.85rem;">${t('dash.click_to_load')}</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.querySelector('.modal-panel').classList.add('modal-panel-open'));
}

// refazer analise
async function fetchStudentInterests() {
    const btn = document.getElementById('btn-generate-interests');
    const feedback = document.getElementById('interests-feedback');
    const intContainer = document.getElementById('interests-container');
    const recContainer = document.getElementById('recommendations-container');

    if (!currentModalUsername) return;

    // Estado de Loading
    btn.disabled = true;
    btn.innerHTML = `${t('dash.analyzing')}`;
    feedback.style.display = 'none';

    try {
        const res = await fetch(`${API}/dashboard/students/${currentModalUsername}/recommendations`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok) {
            // Limpa as mensagens padrão
            intContainer.innerHTML = `<span style="color: var(--text-muted);">${t('dash.no_interests')}</span>`;
            recContainer.innerHTML = '';

            // 1. Renderiza os Interesses (Tags)
            if (data.interests && data.interests.length > 0) {
                data.interests.forEach(interest => {
                    // Criei um estilo inline de badge para ficar bonito rápido, 
                    // mas o ideal é jogar essa classe pro seu CSS depois!
                    const badge = document.createElement('span');
                    badge.textContent = interest;
                    badge.style.cssText = 'background: var(--surface-hover); color: var(--text); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.85rem; border: 1px solid var(--border);';
                    intContainer.appendChild(badge);
                });
            } else {
                intContainer.innerHTML = '<span style="color: var(--text-muted);">Nenhum interesse mapeado ainda.</span>';
            }

            // 2. Renderiza as Recomendações (Lista)
            if (data.recommendations && data.recommendations.length > 0) {
                data.recommendations.forEach(rec => {
                    const item = document.createElement('div');
                    item.innerHTML = `<strong>${t('dash.action')}</strong> ${rec}`;
                    item.style.cssText = 'background: var(--surface); padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; border-left: 3px solid var(--primary);';
                    recContainer.appendChild(item);
                });
            } else {
                recContainer.innerHTML = '<span style="color: var(--text-muted);">Nenhuma recomendação disponível.</span>';
            }

        } else {
            showModalFeedback(feedback, data.detail || 'Erro ao gerar análise.', 'error');
        }

    } catch (e) {
        showModalFeedback(feedback, 'Erro de conexão.', 'error');
    } finally {
        // Restaura o botão
        btn.disabled = false;
        btn.innerHTML = '🎯 Refazer Análise';
    }
}

function closeStudentModal() {
    const modal = document.getElementById('student-modal');
    if (!modal) return;
    modal.querySelector('.modal-panel')?.classList.remove('modal-panel-open');
    setTimeout(() => modal.remove(), 200);
    currentModalUsername = null;
}

function switchModalTab(tab, btn) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('tab-' + tab).style.display = 'block';
}

// ── Save level ────────────────────────────────────────────────────
async function saveStudentLevel() {
    const level = document.getElementById('modal-level').value;
    const feedback = document.getElementById('modal-edit-feedback');
    try {
        const res = await fetch(`${API}/dashboard/students/${encodeURIComponent(currentModalUsername)}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ level })
        });
        if (!res.ok) throw new Error();
        showModalFeedback(feedback, t('dash.level_updated'), 'success');
        const s = allStudents.find(s => s.username === currentModalUsername);
        if (s) s.level = level;
        renderStudentsTable('students-table', allStudents);
        renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
    } catch {
        showModalFeedback(feedback, t('dash.err_save'), 'error');
    }
}

// ── Save prompt ───────────────────────────────────────────────────
async function saveStudentPrompt() {
    const custom_prompt = document.getElementById('modal-prompt').value.trim();
    const feedback = document.getElementById('modal-prompt-feedback');
    try {
        const res = await fetch(`${API}/dashboard/students/${encodeURIComponent(currentModalUsername)}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ custom_prompt })
        });
        if (!res.ok) throw new Error();
        showModalFeedback(feedback, t('dash.prompt_saved'), 'success');
        const s = allStudents.find(s => s.username === currentModalUsername);
        if (s) s.custom_prompt = custom_prompt;
    } catch {
        showModalFeedback(feedback, t('dash.err_save'), 'error');
    }
}

async function clearStudentPrompt() {
    document.getElementById('modal-prompt').value = '';
    await saveStudentPrompt();
}

// ── Delete student ────────────────────────────────────────────────
function confirmDeleteStudent(username) {
    document.getElementById('delete-confirm')?.remove();
    const popup = document.createElement('div');
    popup.id = 'delete-confirm';
    popup.style.cssText = `
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        background:var(--card);border:1px solid rgba(239,68,68,0.4);
        border-radius:14px;padding:1.5rem;z-index:10000;
        display:flex;flex-direction:column;gap:0.75rem;min-width:280px;
        box-shadow:0 16px 40px rgba(0,0,0,0.5);`;
    popup.innerHTML = `
        <p style="font-size:0.9rem;font-weight:700;color:var(--text);margin:0;">
            <i class="fa-solid fa-triangle-exclamation" style="color:#f87171;margin-right:0.4rem;"></i>
            Excluir @${esc(username)}?
        </p>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Esta ação é irreversível.</p>
        <div style="display:flex;gap:0.5rem;">
            <button id="del-yes" style="flex:1;padding:0.5rem;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.85rem;">${t('dash.confirm_delete')}</button>
            <button id="del-no"  style="flex:1;padding:0.5rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">${t('chat.cancel')}</button>
        </div>`;
    document.body.appendChild(popup);
    document.getElementById('del-no').onclick = () => popup.remove();
    document.getElementById('del-yes').onclick = async () => { popup.remove(); await deleteStudent(username); };
}

async function deleteStudent(username) {
    try {
        const res = await fetch(`${API}/dashboard/students/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        closeStudentModal();
        allStudents = allStudents.filter(s => s.username !== username);
        renderStudentsTable('students-table', allStudents);
        renderStudentsTable('recent-students-table', allStudents.slice(0, 5), true);
        loadStats();
    } catch {
        alert('Erro ao excluir aluno. Tente novamente.');
    }
}

// ── AI Insight ────────────────────────────────────────────────────
// ── SUBSTITUIR a função generateInsight em frontend/js/dashboard.js ──────────

async function generateInsight() {
    const btn = document.getElementById('btn-generate-insight');
    const content = document.getElementById('insight-content');

    btn.disabled = true;
    btn.textContent = t('dash.analyzing');
    content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2rem;color:var(--text-muted);">
            <div class="insight-spinner"></div>
            <p style="font-size:0.85rem;">A IA está analisando o histórico de conversas...</p>
        </div>`;

    try {
        // Passa o idioma atual da interface para o backend
        const lang = I18n.getLang();  // ex: "pt-BR", "en-US", "en-UK"
        const url = `${API}/dashboard/students/${encodeURIComponent(currentModalUsername)}/insight?lang=${encodeURIComponent(lang)}`;
        console.log('[Insight] Chamando:', url);

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) {
            /*let userMsg = '';
            if (res.status === 429) {
                userMsg = '⏳ Cota esgotada. Aguarde 1 minuto e tente novamente.';
            } else if (res.status === 404) {
                userMsg = `❌ Aluno não encontrado: "${currentModalUsername}"`;
            } else if (res.status === 401) {
                userMsg = '🔑 Chave(s) da API inválida(s). Verifique o .env';
            } else if (res.status === 503) {
                userMsg = '⚙️ Nenhuma chave de API configurada no servidor.';
            } else {
                userMsg = `❌ Erro ${res.status}: ${data.detail || 'Tente novamente.'}`;
            }*/ // mensagens de erro detalhadas comentadas para evitar custo de chamadas durante desenvolvimento
            const userMsg = mapDashboardApiError(res.status, data?.detail);
            content.innerHTML = `<div class="modal-feedback error" style="display:block;">${userMsg}</div>`;
            return;
        }

        content.innerHTML = `<div class="insight-text">${formatInsight(data.insight)}</div>`;

    } catch (err) {
        console.error('[Insight] Erro de rede:', err);
        content.innerHTML = `
            <div class="modal-feedback error" style="display:block;">
                ❌ Erro de conexão: ${err.message}<br>
                <small style="opacity:0.7">API: ${API} · Verifique se o servidor está rodando</small>
            </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = t('dash.regenerate');
    }
}

// erros gramaticais

async function generateGrammarErrors() {
    const btn = document.getElementById('btn-generate-grammar');
    const content = document.getElementById('insight-content');
    if (!btn || !content) return;

    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = 'Analisando...';
    content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;padding:2rem;color:var(--text-muted);">
            <div class="insight-spinner"></div>
            <p style="font-size:0.85rem;">${t('dash.mapping_errors')}</p>
        </div>`;

    try {
        const lang = I18n.getLang();
        const url = `${API}/dashboard/students/${encodeURIComponent(currentModalUsername)}/grammar-errors?lang=${encodeURIComponent(lang)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();

        if (!res.ok) {
            const userMsg = mapDashboardApiError(res.status, data?.detail);
            content.innerHTML = `<div class="modal-feedback error" style="display:block;">${userMsg}</div>`;
            return;
        }

        const errors = Array.isArray(data?.errors) ? data.errors : [];
        if (!errors.length) {
            content.innerHTML = `
                <div class="insight-placeholder">
                    <i class="fa-solid fa-circle-check" style="font-size:1.4rem;color:#22c55e;margin-bottom:0.75rem;display:block;"></i>
                    <p>${t('dash.no_grammar_errors')}</p>
                </div>`;
            return;
        }

        const items = errors
            .sort((a, b) => (b.count || 0) - (a.count || 0))
            .map((e, idx) => `
                <div style="padding:0.75rem 0;border-bottom:1px solid var(--border);">
                    <div style="display:flex;justify-content:space-between;gap:1rem;">
                        <strong>${idx + 1}. ${esc(e.category || 'Unknown')}</strong>
                        <span class="level-badge">${Number(e.count || 0)}x</span>
                    </div>
                    ${e.example ? `<div style="margin-top:0.45rem;font-size:0.9rem;color:var(--text-muted);"><em>${t('dash.exemples')}:</em> ${esc(e.example)}</div>` : ''}
                </div>
            `)
            .join('');

        content.innerHTML = `
            <div class="insight-text">
                <h4>🧩 ${t('dash.grammar_errors')}</h4>
                ${items}
            </div>`;
    } catch (err) {
        console.error('[GrammarErrors] Erro de rede:', err);
        content.innerHTML = `
            <div class="modal-feedback error" style="display:block;">
                ❌ Erro de conexão: ${err.message}<br>
                <small style="opacity:0.7">API: ${API} · Verifique se o servidor está rodando</small>
            </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = oldLabel;
    }
}

function mapDashboardApiError(status, detail) {
    if (status === 429) return '⏳ Cota esgotada. Aguarde 1 minuto e tente novamente.';
    if (status === 404) return `❌ Aluno não encontrado: "${currentModalUsername}"`;
    if (status === 401) return '🔑 Chave(s) da API inválida(s). Verifique o .env';
    if (status === 503) return '⚙️ Nenhuma chave de API configurada no servidor.';
    return `❌ Erro ${status}: ${detail || 'Tente novamente.'}`;
}

function formatInsight(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^#{1,3} (.+)$/gm, '<h4>$1</h4>')
        .replace(/\n/g, '<br>');
}

// ── Modal feedback helper ─────────────────────────────────────────
function showModalFeedback(el, msg, type) {
    el.textContent = msg;
    el.className = `modal-feedback ${type}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Helpers ───────────────────────────────────────────────────────
function getInitials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}
function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// ── Aba de Relatórios ────────────────────────────────────────────────────────
let reportsChartInstance = null; 

async function loadReports() {
    try {
        // Mostra que está carregando os números de cima
        document.getElementById('metric-students').textContent = '...';
        document.getElementById('metric-messages').textContent = '...';
        document.getElementById('metric-active').textContent = '...';

        // Puxa as métricas do backend
        const response = await fetch(`${API}/dashboard/reports/overview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('metric-students').textContent = data.total_students ?? 0;
            document.getElementById('metric-messages').textContent = data.total_messages ?? 0;
            document.getElementById('metric-active').textContent = data.active_today ?? 0;
        } else {
            document.getElementById('metric-students').textContent = allStudents.length;
        }

        // CORREÇÃO: Conta os níveis a partir da lista local, ignorando maiúsculas/minúsculas
        const contagemNiveis = {
            'Beginner': 0,
            'Pre-Intermediate': 0,
            'Intermediate': 0,
            'Business English': 0,
            'Advanced': 0,
            'Sem Nível': 0
        };

        allStudents.forEach(aluno => {
            const nivel = (aluno.level || '').trim().toLowerCase();
            
            if (nivel === 'beginner') contagemNiveis['Beginner']++;
            else if (nivel === 'pre-intermediate' || nivel === 'pre intermediate') contagemNiveis['Pre-Intermediate']++;
            else if (nivel === 'intermediate') contagemNiveis['Intermediate']++;
            else if (nivel === 'business english' || nivel === 'business') contagemNiveis['Business English']++;
            else if (nivel === 'advanced') contagemNiveis['Advanced']++;
            else contagemNiveis['Sem Nível']++; 
        });

        // Prepara apenas os dados que têm número maior que 0
        const labels = [];
        const values = [];
        const backgroundColors = [];
        
        const cores = {
            'Beginner': '#3b82f6',
            'Pre-Intermediate': '#0ea5e9',
            'Intermediate': '#8b5cf6',
            'Business English': '#d946ef',
            'Advanced': '#f59e0b',
            'Sem Nível': '#64748b'
        };

        for (const [nivel, qtd] of Object.entries(contagemNiveis)) {
            if (qtd > 0) {
                labels.push(nivel);
                values.push(qtd);
                backgroundColors.push(cores[nivel]);
            }
        }

        // Se todo mundo for 0 (banco vazio), cria uma rosca falsa para não sumir
        if (values.length === 0) {
            labels.push('Sem Dados');
            values.push(1);
            backgroundColors.push('#3f3f46');
        }

        // Desenha o Gráfico Mágico
        const ctx = document.getElementById('levelChart').getContext('2d');
        if (reportsChartInstance) {
            reportsChartInstance.destroy(); // Apaga o velho para não bugar
        }

        reportsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#a1a1aa' } }
                }
            }
        });

    } catch (error) {
        console.error("Erro ao carregar relatórios:", error);
    }
}

// ── Aba de Overview ─────────────────────────────────────────────────────────
async function loadOverview() {
    const tbody = document.getElementById('difficulties-tbody');
    const token = localStorage.getItem('token');

    try {
        // Bate na sua rota nova do Python
        const response = await fetch(`${API}/dashboard/difficulties`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("Resposta recebida para overview:", response.status);
        if (!response.ok) throw new Error('Falha ao buscar alertas');

        const data = await response.json();
        const alerts = data.alerts || [];

        // Limpa a mensagem de "Carregando..."
        tbody.innerHTML = '';

        // Se ninguém tiver dificuldade, mostramos uma mensagem de sucesso!
        if (alerts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="2" style="padding: 2rem 1rem; text-align: center; color: #10b981;">
                        <i class="fa-solid fa-check-circle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                        Tudo certo! Nenhum aluno com dificuldade registrada no momento.
                    </td>
                </tr>`;
            return;
        }

        // Se tiver dificuldades, cria uma linha (tr) para cada aluno
        alerts.forEach(student => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--border)';

            // Aqui usamos um amarelo/laranja (#fbbf24) para dar cara de "Atenção"
            row.innerHTML = `
                <td style="padding: 1rem; font-weight: 500;">${student.username}</td>
                <td style="padding: 1rem; color: #fbbf24;">${student.current_difficulty}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error("Erro ao carregar overview:", error);
        tbody.innerHTML = `<tr><td colspan="2" style="padding: 1rem; text-align: center; color: #ef4444;">Erro ao carregar os dados.</td></tr>`;
    }
}