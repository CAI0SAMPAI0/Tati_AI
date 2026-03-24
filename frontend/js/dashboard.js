// js/dashboard.js
const API = 'http://127.0.0.1:8000';

const token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }
const userLocal = JSON.parse(userRaw);

// Staff role check
const STAFF_ROLES = ['professor', 'professora', 'programador', 'Tatiana', 'Tati'];
if (!STAFF_ROLES.includes(userLocal.role)) {
    alert('Acesso negado. Esta área é restrita a professores.');
    window.location.href = '/chat.html';
}

// Tema
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    loadStats();
    loadStudents();
});

// ── Navigation ────────────────────────────────────────────────────
const sections = {
    overview: { title: 'Visão Geral', sub: 'Resumo da plataforma' },
    students: { title: 'Alunos', sub: 'Gerenciamento de alunos' },
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
    document.getElementById('page-title').textContent = sections[name]?.title || name;
    document.getElementById('page-sub').textContent = sections[name]?.sub || '';
}

// ── Load stats ────────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch(`${API}/dashboard/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { console.error('stats error', res.status); return; }
        const data = await res.json();
        document.getElementById('stat-total-students').textContent = data.total_students ?? '—';
        document.getElementById('stat-total-messages').textContent = data.total_messages ?? '—';
        document.getElementById('stat-active-today').textContent = data.active_today ?? '—';
    } catch (e) { console.error('loadStats', e); }
}

// ── Load students ─────────────────────────────────────────────────
async function loadStudents() {
    try {
        const res = await fetch(`${API}/dashboard/students`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { console.error('students error', res.status); return; }
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
    if (!students.length) {
        container.innerHTML = '<p class="empty-state">Nenhum aluno encontrado.</p>';
        return;
    }
    const rows = students.map(s => `
        <tr>
            <td>
                <div class="student-name-cell">
                    <div class="student-avatar">${getInitials(s.name || s.username)}</div>
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
                        <th>Aluno</th>
                        <th>Nível</th>
                        ${!compact ? '<th>Foco</th>' : ''}
                        <th>Último acesso</th>
                        ${!compact ? '<th>Msgs</th>' : ''}
                        <th>Cadastro</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
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