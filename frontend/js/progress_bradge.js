/**
 * progress-badge.js — Badge flutuante de progresso no chat
 *
 * Exibe um indicador colapsável no canto da tela com:
 *   - Palavras novas aprendidas no dia
 *   - Mensagens enviadas na semana
 *
 * Uso:
 *   ProgressBadge.init()   → inicializa (chamar após DOMContentLoaded)
 *   ProgressBadge.bump()   → chama após enviar mensagem para +1 no contador semanal
 *   ProgressBadge.addWord(word) → registra nova palavra aprendida
 */

const ProgressBadge = (() => {
  // ─── Config ──────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'tati_progress_badge';
  const POLL_INTERVAL = 60_000; // atualiza do server a cada 60s

  // ─── State ────────────────────────────────────────────────────────────────
  let _state = {
    wordsToday: 0,
    msgsWeek: 0,
    seenWordsToday: new Set(),
    lastWordDate: null,
    expanded: false,
  };

  let _el = null;
  let _pollTimer = null;

  // ─── i18n helpers ─────────────────────────────────────────────────────────
  function _t(key, fallback) {
    return (typeof t === 'function') ? t(key) || fallback : fallback;
  }

  // ─── Storage helpers ──────────────────────────────────────────────────────
  function _todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const today = _todayStr();

      // Reset palavras se for um novo dia
      if (saved.lastWordDate !== today) {
        saved.wordsToday = 0;
        saved.seenWordsToday = [];
      }

      _state.wordsToday     = saved.wordsToday || 0;
      _state.msgsWeek       = saved.msgsWeek || 0;
      _state.lastWordDate   = saved.lastWordDate || today;
      _state.seenWordsToday = new Set(saved.seenWordsToday || []);
    } catch (_) { /* usa defaults */ }
  }

  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        wordsToday:     _state.wordsToday,
        msgsWeek:       _state.msgsWeek,
        lastWordDate:   _state.lastWordDate,
        seenWordsToday: [..._state.seenWordsToday],
      }));
    } catch (_) {}
  }

  // ─── DOM ──────────────────────────────────────────────────────────────────
  function _buildDOM() {
    if (document.getElementById('progress-badge')) return;

    _el = document.createElement('div');
    _el.id = 'progress-badge';
    _el.innerHTML = `
      <div id="progress-badge-panel" class="pb-hidden">
        <div class="pb-header">
          <span class="pb-title" id="pb-panel-title">${_t('pb.title', 'Progresso')}</span>
          <button class="pb-close" id="pb-close-btn" aria-label="${_t('pb.close', 'Fechar')}">✕</button>
        </div>
        <div class="pb-metrics">
          <div class="pb-metric">
            <div class="pb-metric-icon">📚</div>
            <div class="pb-metric-info">
              <div class="pb-metric-label" id="pb-words-label">${_t('pb.words_today', 'Palavras novas hoje')}</div>
              <div class="pb-metric-value" id="pb-words-val">0</div>
            </div>
          </div>
          <div class="pb-divider"></div>
          <div class="pb-metric">
            <div class="pb-metric-icon">💬</div>
            <div class="pb-metric-info">
              <div class="pb-metric-label" id="pb-msgs-label">${_t('pb.msgs_week', 'Mensagens esta semana')}</div>
              <div class="pb-metric-value" id="pb-msgs-val">0</div>
            </div>
          </div>
        </div>
      </div>
      <button id="progress-badge-trigger" aria-label="${_t('pb.see_progress', 'Ver progresso')}">
        <span class="pb-trigger-icon">⚡</span>
        <span id="pb-trigger-text" class="pb-trigger-label">0 ${_t('pb.words_today_short', 'palavras hoje')}</span>
      </button>
    `;

    document.body.appendChild(_el);

    // Eventos
    document.getElementById('progress-badge-trigger').addEventListener('click', _togglePanel);
    document.getElementById('pb-close-btn').addEventListener('click', _closePanel);
  }

  function _togglePanel() {
    _state.expanded = !_state.expanded;
    const panel = document.getElementById('progress-badge-panel');
    if (_state.expanded) {
      panel.classList.remove('pb-hidden');
    } else {
      panel.classList.add('pb-hidden');
    }
  }

  function _closePanel() {
    _state.expanded = false;
    document.getElementById('progress-badge-panel')?.classList.add('pb-hidden');
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function _render(animate = false) {
    const wordsEl   = document.getElementById('pb-words-val');
    const msgsEl    = document.getElementById('pb-msgs-val');
    const triggerEl = document.getElementById('pb-trigger-text');

    if (!wordsEl) return;

    const words = _state.wordsToday;
    const msgs  = _state.msgsWeek;

    wordsEl.textContent   = words;
    msgsEl.textContent    = msgs;

    const wordLabel = _t('pb.words_today_short', 'palavras hoje');
    const wordLabelSingular = _t('pb.word_today_short', 'palavra hoje');
    triggerEl.textContent = words === 1
      ? `1 ${wordLabelSingular}`
      : `${words} ${wordLabel}`;

    if (animate) {
      wordsEl.classList.remove('pb-updated');
      // Force reflow
      void wordsEl.offsetWidth;
      wordsEl.classList.add('pb-updated');
    }
  }

  /** Re-render all i18n labels */
  function _updateLabels() {
    const titleEl = document.getElementById('pb-panel-title');
    const wordsLabelEl = document.getElementById('pb-words-label');
    const msgsLabelEl  = document.getElementById('pb-msgs-label');

    if (titleEl)      titleEl.textContent      = _t('pb.title', 'Progresso');
    if (wordsLabelEl) wordsLabelEl.textContent  = _t('pb.words_today', 'Palavras novas hoje');
    if (msgsLabelEl)  msgsLabelEl.textContent   = _t('pb.msgs_week', 'Mensagens esta semana');

    _render(false);
  }

  // ─── Fetch do servidor ────────────────────────────────────────────────────
  async function _fetchFromServer() {
    try {
      if (typeof apiGet !== 'function') return;
      const data = await apiGet('/users/progress/daily-summary');
      if (data) {
        _state.wordsToday = data.words_today ?? _state.wordsToday;
        _state.msgsWeek   = data.messages_week ?? _state.msgsWeek;
        _save();
        _render(false);
      }
    } catch (_) { /* usa estado local */ }
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  function init() {
    _load();
    _buildDOM();
    _render(false);
    _fetchFromServer();

    // Poll periódico
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(_fetchFromServer, POLL_INTERVAL);

    // Listen for language changes
    window.addEventListener('langchange', _updateLabels);
  }

  /** Chamado após enviar mensagem */
  function bump() {
    _state.msgsWeek = (_state.msgsWeek || 0) + 1;
    _save();
    _render(true);
  }

  /**
   * Registra nova palavra aprendida (chamado pelo word_tooltip ou ao receber resposta)
   * @param {string} word - A palavra aprendida (case-insensitive)
   */
  function addWord(word) {
    const clean = (word || '').toLowerCase().trim();
    if (!clean || _state.seenWordsToday.has(clean)) return;

    _state.seenWordsToday.add(clean);
    _state.wordsToday = (_state.wordsToday || 0) + 1;
    _state.lastWordDate = _todayStr();
    _save();
    _render(true);
  }

  /** Reseta contador local (usado em testes ou debug) */
  function reset() {
    _state = {
      wordsToday: 0,
      msgsWeek: 0,
      seenWordsToday: new Set(),
      lastWordDate: _todayStr(),
      expanded: false,
    };
    _save();
    _render(false);
  }

  return { init, bump, addWord, reset };
})();