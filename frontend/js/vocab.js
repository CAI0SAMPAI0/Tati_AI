if (!requireAuth()) throw new Error('Unauthenticated');

let allWords = [];
let currentFilter = 'all';

window.addEventListener('DOMContentLoaded', () => {
    loadTopbarUser();
    setupFilters();
    setupSearch();
    loadVocabulary();
});

async function loadTopbarUser() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const avatarEl = document.getElementById('topbar-avatar');
    const usernameEl = document.getElementById('topbar-username');
    
    if (avatarEl) {
        if (user.profile?.avatar_url) {
            avatarEl.innerHTML = `<img src="${user.profile.avatar_url}" alt="">`;
        } else {
            avatarEl.textContent = (user.name || user.username || '?').slice(0, 2).toUpperCase();
        }
    }
    if (usernameEl) {
        usernameEl.textContent = user.name || user.username || '...';
    }
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderWords();
        });
    });
}

function setupSearch() {
    const input = document.getElementById('vocab-search-input');
    if (input) {
        input.addEventListener('input', () => renderWords());
    }
}

async function loadVocabulary() {
    try {
        // Busca vocabulário do backend (se implementado) ou gera do histórico
        const response = await apiGet('/users/vocabulary');
        allWords = response.words || [];
        
        updateStats();
        renderWords();
    } catch (e) {
        console.log('Vocabulário não disponível no backend ainda');
        allWords = [];
        updateStats();
        renderWords();
    }
}

function updateStats() {
    document.getElementById('vocab-total').textContent = allWords.length;
    document.getElementById('vocab-learned').textContent = allWords.filter(w => w.status === 'learned').length;
    document.getElementById('vocab-learning').textContent = allWords.filter(w => w.status === 'learning').length;
}

function renderWords() {
    const container = document.getElementById('vocab-list');
    if (!container) return;
    
    const searchTerm = document.getElementById('vocab-search-input')?.value.toLowerCase() || '';
    
    let filtered = allWords;
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(w => w.status === currentFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(w => 
            w.term.toLowerCase().includes(searchTerm) ||
            (w.translation && w.translation.toLowerCase().includes(searchTerm))
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="vocab-empty">
                <i class="fa-solid fa-book-open"></i>
                <p data-i18n="vocab.empty_text">Nenhuma palavra encontrada.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(word => `
        <div class="vocab-word">
            <div class="vocab-word-info">
                <div class="vocab-word-term">${word.term}</div>
                ${word.translation ? `<div class="vocab-word-translation">${word.translation}</div>` : ''}
                ${word.example ? `<div class="vocab-word-example">"${word.example}"</div>` : ''}
            </div>
            <div class="vocab-word-status">
                <span class="vocab-badge ${word.status}">${getStatusLabel(word.status)}</span>
            </div>
        </div>
    `).join('');
}

function getStatusLabel(status) {
    const labels = {
        learned: '✓ Aprendida',
        learning: '📖 Aprendendo',
        new: '🆕 Nova'
    };
    return labels[status] || status;
}

async function exportVocab() {
    if (allWords.length === 0) {
        showToast('Nenhuma palavra para exportar.', 'warning');
        return;
    }
    
    const csv = [
        'Word,Translation,Status,Example',
        ...allWords.map(w => `"${w.term}","${w.translation || ''}","${w.status}","${w.example || ''}"`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teacher-tati-vocabulary.csv';
    a.click();
    URL.revokeObjectURL(url);
}
