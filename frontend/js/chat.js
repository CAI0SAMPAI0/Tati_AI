if (!requireAuth()) throw new Error('Unauthenticated');
const user = getUser();

// ── State ─────────────────────────────────────────────────────────────────────
let currentConvId = null;
let ws = null;
let isStreaming = false;
let streamingBubble = null;
let streamingMsgEl = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let pendingFiles = [];
let streamBuffer = '';
let pendingAudioB64 = null;
let currentAudio = null;
let chatRecognition = null;

// ── Speech Recognition ─────────────────────────────────────────────
function initChatSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const input = document.getElementById('message-input');
    const teleContent = document.getElementById('tele-content');
    const text = finalTranscript + interimTranscript;

    if (input) {
      input.value = text;
      input.dispatchEvent(new Event('input')); 
      _autoResize(input);
    }
    if (teleContent) {
      teleContent.textContent = text || '...';
    }
  };

  rec.onerror = (e) => console.warn('[ChatSpeechRec] Error:', e.error);
  return rec;
}

// Weekly Plan Status Constants
const _STATUS_ICON = { done: '✅', partial: '🌓', not_started: '○' };
const _STATUS_LABEL = { done: 'Concluído', partial: 'Em andamento', not_started: 'Não iniciado' };

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  _initUserInfo();
  _setupFileInput();
  _connectWS();
  loadWeeklyPlan();
  if (typeof initOnboardingIfNeeded === 'function') initOnboardingIfNeeded();

  document.getElementById('btn-send')?.addEventListener('click', sendMessage);
  document.getElementById('btn-mic')?.addEventListener('click', toggleMic);

  const textarea = document.getElementById('message-input');
  if (textarea) {
    textarea.addEventListener('keydown', _handleKey);
    textarea.addEventListener('input', () => _autoResize(textarea));
  }

  _loadConversations();

  // Mobile: sidebar sempre começa fechada
  if (window.innerWidth <= 768) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.add('collapsed');
  }

  // Overlay fecha sidebar ao clicar fora
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      const sb = document.getElementById('sidebar');
      if (sb) sb.classList.add('collapsed');
      overlay.classList.remove('active');
    });
  }

  // Summary and Modal setup
  document.getElementById('btn-switch-summary')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-switch-summary');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Gerando...';
    btn.disabled = true;
    try {
      const data = await apiGet(`/chat/conversations/${currentConvId}/summary?lang=${I18n.getLang()}`);
      window._lastSummaryMarkdown = data.summary; // Store for PDF generation
      document.getElementById('summary-text').innerHTML = marked.parse(data.summary);
      document.getElementById('summary-modal').style.display = 'flex';
    } catch (e) {
      showToast('Erro ao gerar resumo. Tente novamente.', 'error');
    } finally {
      btn.innerHTML = orig;
      btn.disabled = false;
    }
  });

  document.getElementById('download-pdf-btn')?.addEventListener('click', async () => {
    if (!window._lastSummaryMarkdown) return;
    await _downloadReportPDF(window._lastSummaryMarkdown, `Tati_Report_${new Date().toISOString().slice(0, 10)}.pdf`, 'download-pdf-btn');
  });

  document.getElementById('close-modal-btn')?.addEventListener('click', () => {
    document.getElementById('summary-modal').style.display = 'none';
  });
  document.getElementById('summary-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });
  document.addEventListener('keydown', e => {
    const modal = document.getElementById('summary-modal');
    if (e.key === 'Escape' && modal?.style.display === 'flex') modal.style.display = 'none';
  });
});

// ── User info ─────────────────────────────────────────────────────────────────
async function _initUserInfo() {
  const el = id => document.getElementById(id);
  const nameEl = el('sidebar-user-name');
  const levelEl = el('sidebar-user-level');
  const avatarEl = el('sidebar-user-avatar');

  if (nameEl) nameEl.textContent = user.name || user.username;
  if (levelEl) levelEl.textContent = user.level || 'Student';
  if (avatarEl) _renderSidebarAvatar(avatarEl, user);

  if (!user.avatar_url) {
    try {
      const data = await apiGet('/profile/');
      saveSession(getToken(), { ...user, avatar_url: data.avatar_url || null });
      user.avatar_url = data.avatar_url || null;
      if (avatarEl) _renderSidebarAvatar(avatarEl, user);
    } catch (e) { /* silencioso */ }
  }

  const isTeacher = isStaff(user);
  const isPremium = user.plan_type === 'full' || user.is_premium_active;
  const isFreeWindowFallback = _isActivitiesFreeWindowFallback();
  let access = null;

  try {
    access = await apiGet('/users/permissions/access');
  } catch (_) {
    access = null;
  }

  const canSeeDashboard = canAccessDashboard(user, access);

  const dashBtn = el('btn-dashboard');
  if (dashBtn) dashBtn.style.display = canSeeDashboard ? 'flex' : 'none';

  // Botão de atividades: visível para professores E usuários premium
  const actBtn = document.querySelector('a[href="activities.html"], a[href="/activities.html"]');
  if (actBtn) {
    if (access) {
      const canSeeActivities = isTeacher || access.free_mode || access.can_access_activities;
      actBtn.style.display = canSeeActivities ? 'flex' : 'none';
    } else {
      const canSeeActivitiesFallback = isTeacher || isPremium || isFreeWindowFallback;
      actBtn.style.display = canSeeActivitiesFallback ? 'flex' : 'none';
    }
  }

  const badgeEl = document.getElementById('sidebar-premium-badge');
  if (badgeEl) {
    const isSpecial = Boolean(user?.is_exempt) || Boolean(access?.is_admin && !isTeacher);
    // Se for especial ou professor, mostra badge Premium fixo ou verifica assinatura
    if (isSpecial || isTeacher) {
      badgeEl.style.display = 'inline-block';
      badgeEl.textContent = 'Premium';
    } else {
      apiGet('/payments/status').then(sub => {
        if (sub && sub.has_subscription && sub.status === 'active') {
          badgeEl.style.display = 'inline-block';
          badgeEl.textContent = sub.plan_type === 'full' ? 'Premium' : 'Basic';
        } else {
          badgeEl.style.display = 'none';
        }
      }).catch(() => { badgeEl.style.display = 'none'; });
    }
  }
}

function _isActivitiesFreeWindowFallback() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (year < 2026) return true;
  if (year > 2026) return false;
  if (month < 6) return true;
  if (month > 6) return false;
  return day <= 30;
}

function _renderSidebarAvatar(el, u) {
  if (u.avatar_url) {
    el.innerHTML = `<img src="${u.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top;" alt="">`;
  } else {
    el.textContent = (u.name || u.username).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('collapsed');
  if (overlay) overlay.classList.toggle('active', !sidebar?.classList.contains('collapsed'));
}

function switchToVoice() {
  const isNew = !currentConvId; // Se não tem conversa atual, é nova
  const url = isNew ? '/voice.html?new=true' :
    currentConvId ? `/voice.html?conv_id=${currentConvId}` : '/voice.html';
  window.location.href = url;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function _connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const currentToken = getToken();
  if (!currentToken) { authLogout(); return; }

  // Envia token via subprotocolo para evitar que apareça na URL nos logs do servidor
  ws = new WebSocket(`${WS_BASE}/chat/ws`, ["access_token", currentToken]);
  ws.onopen = () => console.log('[WS] connected');
  ws.onmessage = e => _handleWSMessage(JSON.parse(e.data));
  ws.onerror = e => console.error('[WS] error', e);
  ws.onclose = (e) => {
    ws = null;
    if (e.code === 4001) { authLogout(); return; }
    setTimeout(_connectWS, 3000);
  };

  const keepAlive = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) { clearInterval(keepAlive); return; }
    ws.send(JSON.stringify({ type: 'ping' }));
  }, 20000);
}

function _waitForWS(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (ws?.readyState === WebSocket.OPEN) { resolve(); return; }
    const start = Date.now();
    const iv = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) { clearInterval(iv); resolve(); }
      else if (Date.now() - start > timeout) { clearInterval(iv); reject(new Error('WS timeout')); }
    }, 100);
  });
}

function _handleWSMessage(msg) {
  const handlers = {
    pong: () => { },
    transcription: () => { 
      const input = document.getElementById('message-input');
      if (input) {
        input.value = ''; // Limpa após envio bem sucedido
        _autoResize(input);
      }
      // Remove placeholder if exists
      document.getElementById('stt-placeholder')?.remove();
      _renderMessage('user', msg.text); 
    },
    status: () => {
      if (msg.text.startsWith('SUMMARY_CACHE_')) return; // Bloqueia exibição de cache no chat
      _appendStatus(msg.text);
    },
    stream_start: () => {
      _hideTyping();
      streamBuffer = '';
      pendingAudioB64 = null;
      const r = _appendStreamBubble();
      streamingBubble = r.bubble;
      streamingMsgEl = r.msgEl;
    },
    stream_token: () => { if (streamingBubble) _appendToken(streamingBubble, msg.token); },
    stream_end: () => {
      if (streamingMsgEl) {
        const meta = _finalizeStreamBubble(streamingMsgEl, streamingBubble);
        // Áudio só é anexado aqui, após stream terminar
        if (pendingAudioB64 && meta && !window._lastStreamIsReport) {
          _buildAudioControls(meta, pendingAudioB64);
        }
        pendingAudioB64 = null;
      }
      streamingBubble = null; streamingMsgEl = null;
      isStreaming = false;
      _setInputEnabled(true);
      // Atualiza só o título na sidebar se necessário, sem resetar mensagens
      const active = document.querySelector('.conv-item.active .conv-title');
      if (!active) {
        _loadConversations().catch(() => { });
      } else if (active.textContent === 'Nova conversa' || active.textContent === t('nav.new_chat')) {
        // Só recarrega a lista de conversas (sem abrir conversa = sem limpar mensagens)
        apiGet('/chat/conversations').then(convs => _renderConversationList(convs)).catch(() => { });
      }
    },
    audio_response: () => {
      // Durante streaming, salva para usar depois
      if (streamingMsgEl) {
        pendingAudioB64 = msg.audio;
      } else {
        // Fora de streaming, anexa imediatamente
        _attachAudioToLastMsg(msg.audio);
      }
    },
    free_warning: () => {
      _showFreeMessagesBadge(msg.remaining);
    },
    new_title: () => {
      if (msg.conversation_id === currentConvId) {
        const tb = document.getElementById('topbar-title');
        if (tb) tb.textContent = msg.title;
        const item = document.querySelector(`.conv-item[data-id="${msg.conversation_id}"] .conv-title`);
        if (item) item.textContent = msg.title;
      }
    },
    error: () => {
      _hideTyping();
      isStreaming = false;
      _setInputEnabled(true);
      if (msg.code === 402 || msg.detail === 'free_limit_reached') {
        _showPaywall();
        return;
      }
      _appendErrorMsg(msg.detail || t('chat.err_unknown'));
    },
  };
  (handlers[msg.type] || (() => { }))();
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function _loadConversations() {
  try {
    const convs = await apiGet('/chat/conversations');
    _renderConversationList(convs);

    // Sempre começa na tela de boas-vindas
    if (!currentConvId) {
      _showWelcome();
    }
  } catch (e) { console.error(e); }
}

function _renderConversationList(convs) {
  const list = document.getElementById('conversations-list');
  if (!list) return;
  if (!convs.length) {
    list.innerHTML = `<p class="list-empty">${t('chat.no_convs')}</p>`;
    localStorage.removeItem('last_conv_id');
    return;
  }
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = { [t('chat.today')]: [], [t('chat.yesterday')]: [], [t('chat.older')]: [] };

  convs.forEach(c => {
    const d = new Date(c.updated_at).toDateString();
    if (d === today) groups[t('chat.today')].push(c);
    else if (d === yesterday) groups[t('chat.yesterday')].push(c);
    else groups[t('chat.older')].push(c);
  });

  list.innerHTML = '';
  Object.entries(groups).filter(([, v]) => v.length).forEach(([label, items]) => {
    const lbl = document.createElement('p');
    lbl.className = 'list-label';
    lbl.textContent = label;
    list.appendChild(lbl);
    items.forEach(c => list.appendChild(_buildConvItem(c)));
  });
}

function _buildConvItem(c) {
  const div = document.createElement('div');
  div.className = 'conv-item' + (c.id === currentConvId ? ' active' : '');
  div.dataset.id = c.id;
  div.innerHTML = `
    <svg class="conv-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="conv-title">${escHtml(c.title)}</span>
    <button class="conv-delete" data-i18n-title="gen.delete" title="${t('gen.delete')}" onclick="deleteConv(event,'${c.id}')">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>`;
  div.addEventListener('click', () => _openConversation(c.id, c.title));
  return div;
}

async function newChat() {
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  _showWelcome();
}

async function _openConversation(id, title) {
  currentConvId = id;
  localStorage.setItem('last_conv_id', id);
  document.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  const tb = document.getElementById('topbar-title');
  if (tb) tb.textContent = title;
  document.getElementById('chat-welcome')?.style.setProperty('display', 'none');
  await _loadMessages(id);
  _connectWS();
  if (window.innerWidth < 768) {
    document.getElementById('sidebar')?.classList.add('collapsed');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  }
}

async function _loadMessages(convId) {
  const area = document.getElementById('chat-messages');
  if (!area) return;
  const typingEl = document.getElementById('typing-indicator');
  const welcomeEl = document.getElementById('chat-welcome');
  const voiceBtn = document.getElementById('btn-switch-voice');

  // Limpa mensagens anteriores
  [...area.children].forEach(el => {
    if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove();
  });

  if (typingEl) typingEl.style.display = 'none';
  if (welcomeEl) welcomeEl.style.display = 'none';
  if (voiceBtn) voiceBtn.style.display = 'flex';

  if (!convId) { _showWelcome(); return; }

  try {
    const msgs = await apiGet(`/chat/conversations/${convId}/messages`);
    console.log(`[Chat] Carregadas ${msgs.length} mensagens`);

    if (!msgs.length) {
      if (welcomeEl) welcomeEl.style.display = 'flex';
    } else {
      for (const m of msgs) {
        const el = _renderMessage(m.role, m.content, true, m.created_at);
        if (m.role === 'assistant' && m.audio_b64) {
          // Passamos isHistory=true para NÃO auto-reproduzir
          _attachAudioToElement(el, m.audio_b64, true);
        }
      }
    }
  } catch (e) {
    console.error('[Chat] Erro ao carregar mensagens:', e);
  }
  _checkSummaryBtn();
  _scrollBottom();
}

function _showWelcome() {
  const area = document.getElementById('chat-messages');
  if (!area) return;
  const welcomeEl = document.getElementById('chat-welcome');
  const voiceBtn = document.getElementById('btn-switch-voice');
  const typing = document.getElementById('typing-indicator');

  [...area.children].forEach(el => { if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove(); });
  if (typing) typing.style.display = 'none';
  if (welcomeEl) { welcomeEl.style.display = 'flex'; if (area.firstChild !== welcomeEl) area.insertBefore(welcomeEl, area.firstChild); }
  if (voiceBtn) voiceBtn.style.display = 'flex';
  _checkSummaryBtn();
  const tb = document.getElementById('topbar-title');
  if (tb) tb.textContent = 'Teacher Tati';
  currentConvId = null;
}

async function deleteConv(e, id) {
  e.stopPropagation();
  _showConfirmPopup(t('chat.delete_conv'), async () => {
    await apiDelete(`/chat/conversations/${id}`);
    if (currentConvId === id) { currentConvId = null; _showWelcome(); }
    await _loadConversations();
  });
}

async function deleteAllConversations() {
  _showConfirmPopup(t('chat.delete_all_conv'), async () => {
    const convs = await apiGet('/chat/conversations');
    await Promise.all(convs.map(c => apiDelete(`/chat/conversations/${c.id}`)));
    currentConvId = null; _showWelcome(); await _loadConversations();
  });
}

function _showConfirmPopup(message, onConfirm) {
  document.getElementById('confirm-popup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'confirm-popup';
  Object.assign(popup.style, {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    background: 'var(--surface)', border: '1px solid hsla(355,78%,60%,0.4)',
    borderRadius: '12px', padding: '1rem 1.25rem', zIndex: '999',
    display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '240px',
    boxShadow: 'var(--shadow-lg)',
  });
  popup.innerHTML = `
    <p style="font-size:0.85rem;color:var(--text);margin:0;font-weight:600;">${message}</p>
    <div style="display:flex;gap:0.5rem;">
      <button id="pop-yes" style="flex:1;padding:0.4rem;background:var(--danger);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">${t('gen.confirm')}</button>
      <button id="pop-no"  style="flex:1;padding:0.4rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">${t('gen.cancel')}</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById('pop-no').onclick = () => popup.remove();
  document.getElementById('pop-yes').onclick = async () => { popup.remove(); await onConfirm(); };
}

// ── File handling ─────────────────────────────────────────────────────────────
function _setupFileInput() {
  document.querySelector('.btn-attach')?.addEventListener('click', _triggerFileInput);
}

function _triggerFileInput() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.docx,.txt,.md,.pptx,.xlsx,image/*,audio/*';
  input.multiple = true;
  input.onchange = async () => {
    for (const file of Array.from(input.files)) {
      if (file.size > 10 * 1024 * 1024) { _appendErrorMsg(`${file.name} muito grande (máx 10MB).`); continue; }
      const b64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });
      pendingFiles.push({ name: file.name, b64, size: file.size });
    }
    _renderFilePreviewBar();
  };
  input.click();
}

function _renderFilePreviewBar() {
  document.getElementById('file-preview-bar')?.remove();
  if (!pendingFiles.length) return;
  const bar = document.createElement('div');
  bar.id = 'file-preview-bar';
  bar.innerHTML = pendingFiles.map((f, i) => `
    <div class="file-preview-inner">
      <div class="file-preview-icon">${_getFileIcon(f.name)}</div>
      <div class="file-preview-info">
        <span class="file-preview-name">${escHtml(f.name)}</span>
        <span class="file-preview-size">${_formatFileSize(f.size)}</span>
      </div>
      <button class="file-preview-remove" onclick="removePendingFile(${i})">✕</button>
    </div>`).join('') +
    `<p class="file-preview-hint">📎 ${pendingFiles.length} arquivo(s) prontos</p>`;
  document.querySelector('.chat-input-area')?.insertBefore(bar, document.querySelector('.chat-input-area').firstChild);
}

function removePendingFile(i) { pendingFiles.splice(i, 1); _renderFilePreviewBar(); }
function _getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ({ pdf: '📄', docx: '📝', doc: '📝', txt: '📃', md: '📋', xlsx: '📊', pptx: '📽️' }[ext]) || '📎';
}
function _formatFileSize(b) {
  return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isStreaming) return;
  const input = document.getElementById('message-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text && !pendingFiles.length) return;

  const welcome = document.getElementById('chat-welcome');
  if (welcome) welcome.style.display = 'none';

  if (!currentConvId) {
    try {
      const { data } = await apiPost('/chat/conversations', { title: t('nav.new_chat') });
      currentConvId = data.id;
      localStorage.setItem('last_conv_id', data.id);
      // Adiciona na sidebar sem recarregar mensagens
      apiGet('/chat/conversations').then(convs => _renderConversationList(convs)).catch(() => { });
    } catch { _appendErrorMsg('Erro ao criar conversa.'); return; }
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) _connectWS();
  try { await _waitForWS(6000); } catch { _appendErrorMsg('Não foi possível conectar ao servidor.'); return; }

  input.value = '';
  _autoResize(input);

  if (pendingFiles.length) {
    const files = [...pendingFiles];
    pendingFiles = [];
    _renderFilePreviewBar();
    if (text) _renderMessage('user', text);
    files.forEach(f => _appendFileMsg(f.name, f.size));
    _showTyping(); isStreaming = true; _setInputEnabled(false); _scrollBottom();
    for (const file of files) {
      ws.send(JSON.stringify({ type: 'file', filename: file.name, content: file.b64, conversation_id: currentConvId, caption: '' }));
      await sleep(100);
    }
    return;
  }

  _renderMessage('user', text);
  _showTyping(); isStreaming = true; _setInputEnabled(false); _scrollBottom();
  ws.send(JSON.stringify({ type: 'text', content: text, conversation_id: currentConvId, origin: 'chat' }));
}

function _handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey && getSettings().enterSend !== false) { e.preventDefault(); sendMessage(); }
}
function _autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
function _setInputEnabled(on) {
  const b = document.getElementById('btn-send');
  const i = document.getElementById('message-input');
  if (b) b.disabled = !on;
  if (i) i.disabled = !on;
}
function useSuggestion(btn) {
  const i = document.getElementById('message-input');
  if (i) { i.value = btn.textContent; sendMessage(); }
}

// ── Audio recording ───────────────────────────────────────────────────────────
let teleTimerInterval = null;

async function toggleMic() {
  if (isRecording) return _stopRecording();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = _sendAudio;
    mediaRecorder.start();

    // Teleprompter
    const tele = document.getElementById('teleprompter-overlay');
    const teleContent = document.getElementById('tele-content');
    const teleTimer = document.getElementById('tele-timer');
    if (tele) tele.classList.add('active');
    if (teleContent) teleContent.textContent = '...';
    
    let seconds = 0;
    if (teleTimer) {
      teleTimer.textContent = '00:00';
      teleTimerInterval = setInterval(() => {
        seconds++;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        teleTimer.textContent = `${m}:${s}`;
      }, 1000);
    }

    if (!chatRecognition) chatRecognition = initChatSpeechRecognition();
    if (chatRecognition) {
      try { chatRecognition.start(); } catch(e) {}
    }

    isRecording = true;
    document.getElementById('btn-mic')?.classList.add('recording');
  } catch (e) { showToast('Microfone não disponível: ' + e.message, 'error'); }
}
function _stopRecording() {
  mediaRecorder?.stop();
  if (chatRecognition) {
    try { chatRecognition.stop(); } catch(e) {}
  }
  isRecording = false;
  document.getElementById('btn-mic')?.classList.remove('recording');
  
  const tele = document.getElementById('teleprompter-overlay');
  if (tele) tele.classList.remove('active');
  if (teleTimerInterval) {
    clearInterval(teleTimerInterval);
    teleTimerInterval = null;
  }
}
async function _sendAudio() {
  if (!currentConvId) {
    const { data } = await apiPost('/chat/conversations', { title: t('nav.new_chat') });
    currentConvId = data.id;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) { _connectWS(); await _waitForWS(5000).catch(() => { }); }
  
  // Render placeholder message immediately
  const placeholder = _renderMessage('user', '🎤 Transcribing...', true);
  placeholder.id = 'stt-placeholder';

  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  reader.onload = () => {
    // Note: Typing indicator only shown AFTER we send to WS
    ws.send(JSON.stringify({ type: 'audio', audio: reader.result.split(',')[1], conversation_id: currentConvId, origin: 'chat' }));
  };
  reader.readAsDataURL(blob);
}

// ── Render helpers ────────────────────────────────────────────────────────────
function _renderMessage(role, content, returnElement = false, isoString = null) {
  const el = role === 'user' ? _appendUserMsg(content, returnElement, isoString) : _appendAssistantMsg(content, returnElement, isoString);
  return el;
}

function _appendUserMsg(text, returnElement = false, isoString = null) {
  const div = document.createElement('div');
  div.className = 'message message-user';
  div.innerHTML = `<div class="message-body"><div class="message-bubble"><p>${escHtml(text)}</p></div><span class="message-time">${nowTime(isoString)}</span></div>`;
  _insertBeforeTyping(div); _scrollBottom(); _checkSummaryBtn();
  return returnElement ? div : null;
}

function _appendFileMsg(name, size) {
  const div = document.createElement('div');
  div.className = 'message message-user';
  div.innerHTML = `<div class="message-body"><div class="message-bubble file-bubble"><div class="file-attach-preview"><div class="file-attach-icon">${_getFileIcon(name)}</div><div class="file-attach-info"><span class="file-attach-name">${escHtml(name)}</span><span class="file-attach-size">${_formatFileSize(size)}</span></div></div></div><span class="message-time">${nowTime()}</span></div>`;
  _insertBeforeTyping(div); _scrollBottom();
}

function _appendAssistantMsg(text, returnElement = false, isoString = null) {
  const div = document.createElement('div');
  div.className = 'message message-assistant';
  div.innerHTML = `
    <div class="message-avatar"><img src="/assets/images/tati_logo.jpg" alt="Tati" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-fallback" style="display:none">T</div></div>
    <div class="message-body">
      <div class="message-bubble">${DOMPurify.sanitize(marked.parse(text))}</div>
      <div class="message-meta"><span class="message-time">${nowTime(isoString)}</span></div>
    </div>`;
  _insertBeforeTyping(div);
  
  // Check for PDF report button
  const isReport = _checkAndAddReportButton(div, text);

  if (getSettings().wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(div);
  _scrollBottom();
  
  // Return info if it's a report to block audio later if needed
  div.dataset.isReport = isReport ? 'true' : 'false';
  
  return returnElement ? div : null;
}

function _checkAndAddReportButton(container, text) {
  if (text.includes('STUDY REPORT') || text.includes('📊 STUDY REPORT')) {
    const bubble = container.querySelector('.message-bubble');
    if (bubble) {
      bubble.style.display = 'none';
      const reportCard = document.createElement('div');
      reportCard.className = 'report-card';
      reportCard.innerHTML = `
        <div class="report-card-icon"><i class="fa-solid fa-file-pdf"></i></div>
        <div class="report-card-info">
          <h4>${t('chat.report_ready') || 'Relatório de Estudo Pronto!'}</h4>
          <p>${t('chat.report_desc') || 'Clique abaixo para baixar seu resumo personalizado em PDF.'}</p>
          <button class="btn-download-pdf" onclick="downloadReport('${currentConvId}')">
            <i class="fa-solid fa-download"></i> ${t('chat.download_pdf') || 'Baixar PDF'}
          </button>
        </div>
      `;
      bubble.parentNode.insertBefore(reportCard, bubble);
      return true;
    }
  }
  return false;
}

function _appendStreamBubble() {
  const div = document.createElement('div');
  div.className = 'message message-assistant';
  div.innerHTML = `
    <div class="message-avatar"><img src="/assets/images/tati_logo.jpg" alt="Tati" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-fallback" style="display:none">T</div></div>
    <div class="message-body"><div class="message-bubble stream-bubble"></div></div>`;
  _insertBeforeTyping(div); _scrollBottom();
  return { bubble: div.querySelector('.stream-bubble'), msgEl: div };
}

function _appendToken(bubble, token) {
  streamBuffer += token;
  // Se for um relatório, não exibe o markdown durante o streaming
  if (streamBuffer.includes('# 📊 STUDY REPORT')) {
    bubble.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:var(--primary);font-weight:600;">
      <i class="fa-solid fa-file-lines fa-lg"></i>
      <span>${t('act.generating_report') || 'Gerando relatório pedagógico...'}</span>
    </div>`;
  } else {
    bubble.innerHTML = formatMarkdown(streamBuffer);
  }
  _scrollBottom();
}

function _finalizeStreamBubble(msgEl, bubble) {
  if (getSettings().wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(msgEl);
  const text = streamBuffer; // Capture content before clearing
  window._lastStreamIsReport = text.includes('# 📊 STUDY REPORT');

  // Re-render final content with marked for better quality
  bubble.innerHTML = DOMPurify.sanitize(marked.parse(text));
  bubble.classList.remove('stream-bubble');

  const body = msgEl.querySelector('.message-body');
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `<span class="message-time">${nowTime()}</span>`;
  body?.appendChild(meta);

  if (window._lastStreamIsReport) {
    _checkAndAddReportButton(msgEl, text);
  }

  streamBuffer = '';
  return meta;
}

// Anexa áudio a um elemento específico de mensagem (para histórico)
function _attachAudioToElement(msgEl, b64, isHistory = false) {
  if (!msgEl) return;
  
  // BLOQUEIO CRÍTICO: Se a mensagem for um relatório, nunca anexa áudio
  if (msgEl.dataset.isReport === 'true' || msgEl.querySelector('.report-card-container')) {
    return;
  }

  let meta = msgEl.querySelector('.message-meta');
  if (!meta) {
    const body = msgEl.querySelector('.message-body');
    if (body) {
      meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.innerHTML = `<span class="message-time">${nowTime()}</span>`;
      body.appendChild(meta);
    }
  }
  if (meta && !meta.querySelector('.msg-audio-controls')) {
    _buildAudioControls(meta, b64, isHistory);
  }
}

function _attachAudioToLastMsg(b64) {
  const msgs = document.querySelectorAll('.message-assistant');
  if (!msgs.length) return;
  _attachAudioToElement(msgs[msgs.length - 1], b64, false); // Nova mensagem = autoPlay OK
}

function _buildAudioControls(meta, b64, isHistory = false) {
  if (meta.querySelector('.msg-audio-controls')) return;
  
  // Verifica novamente se o pai é um relatório por segurança
  const msgEl = meta.closest('.message-assistant');
  if (msgEl && (msgEl.dataset.isReport === 'true' || msgEl.querySelector('.report-card-container'))) {
    return;
  }

  const s = getSettings();
  const defaultSpeed = parseFloat(s.defaultSpeed || '1');

  const controls = document.createElement('div');
  controls.className = 'msg-audio-controls';
  controls.innerHTML = `
    <button class="btn-tts-play" title="${t('audio.play') || 'Play'}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
    <button class="btn-tts-rewind" title="${t('audio.rewind') || '↩5s'}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg>
    </button>
    <div class="msg-vol-control">
      <label>${t('audio.vol') || 'Vol'}</label>
      <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="1">
      <span class="msg-vol-value">100%</span>
    </div>
    <div class="msg-spd-control">
      <label>${t('audio.speed') || 'Vel'}</label>
      <select class="msg-spd-select">
        <option value="0.75">0.75×</option>
        <option value="1" ${defaultSpeed === 1 ? 'selected' : ''}>1×</option>
        <option value="1.25" ${defaultSpeed === 1.25 ? 'selected' : ''}>1.25×</option>
        <option value="1.5" ${defaultSpeed === 1.5 ? 'selected' : ''}>1.5×</option>
        <option value="2" ${defaultSpeed === 2 ? 'selected' : ''}>2×</option>
      </select>
    </div>`;
  meta.appendChild(controls);

  const playBtn = controls.querySelector('.btn-tts-play');
  const rewBtn = controls.querySelector('.btn-tts-rewind');
  const volSlider = controls.querySelector('.msg-vol-slider');
  const spdSelect = controls.querySelector('.msg-spd-select');
  const volValue = controls.querySelector('.msg-vol-value');

  const audio = new Audio(`data:audio/mp3;base64,${b64}`);
  audio.volume = 1;
  audio.playbackRate = defaultSpeed;

  const setPlayIcon = playing => {
    if (!playBtn) return;
    playBtn.innerHTML = playing
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  };

  const playThis = () => {
    if (currentAudio && currentAudio !== audio) {
      currentAudio.pause();
      document.querySelectorAll('.btn-tts-play').forEach(b => {
        if (b !== playBtn) b.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      });
    }
    currentAudio = audio;
    audio.play().catch(() => { });
    setPlayIcon(true);
  };

  // SÓ REPRODUZ SE NÃO FOR HISTÓRICO
  if (!isHistory && (s.autoPlay === true || s.autoPlay === 'true' || s.autoPlay === undefined)) {
    playThis();
  }

  playBtn?.addEventListener('click', e => { e.stopPropagation(); audio.paused ? playThis() : (audio.pause(), setPlayIcon(false)); });
  rewBtn?.addEventListener('click', e => { e.stopPropagation(); audio.currentTime = Math.max(0, audio.currentTime - 5); });
  volSlider?.addEventListener('input', e => { e.stopPropagation(); audio.volume = parseFloat(volSlider.value); if (volValue) volValue.textContent = Math.round(audio.volume * 100) + '%'; });
  spdSelect?.addEventListener('change', e => { e.stopPropagation(); audio.playbackRate = parseFloat(spdSelect.value); });
  audio.addEventListener('ended', () => { setPlayIcon(false); if (currentAudio === audio) currentAudio = null; });
  audio.addEventListener('pause', () => setPlayIcon(false));
  audio.addEventListener('play', () => setPlayIcon(true));
}

// ── Summary ───────────────────────────────────────────────────────────────────
function _checkSummaryBtn() {
  const btn = document.getElementById('btn-switch-summary');
  if (!btn) return;
  btn.style.display = document.querySelectorAll('.message-user').length >= 3 ? 'flex' : 'none';
}

// ── Misc ──────────────────────────────────────────────────────────────────────
function _appendStatus(text) { const d = document.createElement('div'); d.className = 'status-msg'; d.textContent = text; _insertBeforeTyping(d); }
function _appendErrorMsg(text) { const d = document.createElement('div'); d.className = 'error-banner'; d.textContent = '⚠️ ' + text; _insertBeforeTyping(d); _scrollBottom(); }
function _insertBeforeTyping(el) {
  const a = document.getElementById('chat-messages');
  const ti = document.getElementById('typing-indicator');
  if (a) a.insertBefore(el, ti);
}
function _showTyping() {
  const ti = document.getElementById('typing-indicator');
  if (ti) ti.style.display = 'flex';
  _scrollBottom();
}
function _hideTyping() {
  const ti = document.getElementById('typing-indicator');
  if (ti) ti.style.display = 'none';
}
function _scrollBottom() {
  const a = document.getElementById('chat-messages');
  if (a) a.scrollTop = a.scrollHeight;
}
function logout() { authLogout(); }

function _showFreeMessagesBadge(remaining) {
  document.getElementById('free-msg-badge')?.remove();
  if (remaining > 3) return;

  const badge = document.createElement('div');
  badge.id = 'free-msg-badge';
  badge.style.cssText = `
        position: fixed; bottom: 90px; left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        border: 1px solid ${remaining === 0 ? 'var(--danger)' : 'hsla(45,100%,58%,0.5)'};
        border-radius: 12px; padding: 0.65rem 1rem;
        z-index: 999; display: flex; align-items: center;
        gap: 0.75rem; box-shadow: var(--shadow-lg);
        max-width: 360px; width: 90%; font-size: 0.82rem;
    `;
  badge.innerHTML = `
        <span style="font-size:1.1rem;">${remaining === 0 ? '🔒' : '💬'}</span>
        <span style="flex:1;color:var(--text);">${t('paywall.messages_left', remaining)}</span>
        <button onclick="document.getElementById('free-msg-badge').remove()"
            style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;">✕</button>
    `;
  document.body.appendChild(badge);
}

function _showPaywall() {
  _setInputEnabled(false);
  document.getElementById('free-msg-badge')?.remove();

  const area = document.getElementById('chat-messages');
  const wall = document.createElement('div');
  wall.id = 'paywall-banner';
  wall.style.cssText = `
        display: flex; flex-direction: column; align-items: center;
        gap: 1rem; padding: 2rem 1.5rem; text-align: center;
        background: var(--surface);
        border: 1px solid hsla(355,78%,60%,0.3);
        border-radius: 16px; margin: 1rem;
    `;
  wall.innerHTML = `
        <span style="font-size:2.5rem;">🔒</span>
        <h3 style="margin:0;color:var(--text);font-size:1rem;">${t('paywall.limit_reached')}</h3>
        <p style="margin:0;color:var(--text-muted);font-size:0.85rem;">${t('paywall.upgrade_desc')}</p>
        <a href="payment.html" style="
            padding: 0.65rem 1.5rem;
            background: var(--primary); color: white;
            border-radius: 10px; font-weight: 700;
            text-decoration: none; font-size: 0.9rem;
        ">${t('paywall.upgrade')} →</a>
    `;
  _insertBeforeTyping(wall);
  _scrollBottom();
}

async function _downloadReportPDF(content, filename, clickedBtn = null) {
  const btn = clickedBtn;
  const orig = btn ? btn.innerHTML : null;
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('act.generating_pdf') || 'Gerando PDF...'}`;
    btn.disabled = true;
    btn.style.opacity = '0.8';
  }

  try {
    const response = await fetch(`${API_BASE}/chat/download_report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ content, filename })
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || 'Falha ao gerar PDF');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    if (btn) btn.innerHTML = `<i class="fa-solid fa-check"></i> PDF Baixado!`;
    setTimeout(() => { if (btn) { btn.innerHTML = orig; btn.disabled = false; btn.style.opacity = ''; } }, 2500);
  } catch (e) {
    console.error(e);
    showToast('Erro ao gerar PDF. Tente novamente.', 'error');
    if (btn) { btn.innerHTML = orig; btn.disabled = false; btn.style.opacity = ''; }
  }
}

function _checkAndAddReportButton(msgEl, text) {
  // Regex mais robusto para detectar o marcador de relatório
  if (!/📊 STUDY REPORT/i.test(text)) return;

  const body = msgEl.querySelector('.message-body');
  const bubble = body?.querySelector('.message-bubble');
  if (!body || !bubble || body.querySelector('.btn-report-download')) return;

  // Extrai título se possível
  const lines = text.split('\n');
  const reportLine = lines.find(l => /📊 STUDY REPORT/i.test(l));
  const titleLine = lines.find(l => l.trim().startsWith('## ')) || reportLine;
  const cleanTitle = titleLine.replace(/#|📊/g, '').replace(/STUDY REPORT -/i, '').trim();

  // Esconde o conteúdo original COMPLETAMENTE (estilo e conteúdo)
  bubble.style.display = 'none';
  bubble.setAttribute('aria-hidden', 'true');

  // Cria o card de download
  const card = document.createElement('div');
  card.className = 'report-card-container';
  card.innerHTML = `
      <div class="report-card" style="
        padding: 10px 14px; 
        background: var(--surface-secondary, rgba(120, 40, 200, 0.05)); 
        border: 1px solid rgba(120, 40, 200, 0.2);
        border-left: 4px solid var(--primary); 
        border-radius: 10px;
        margin: 4px 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-width: 260px;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.1rem;">📄</span>
          <p style="margin: 0; font-weight: 700; color: var(--primary); font-size: 0.9rem; line-height: 1.2;">
            ${cleanTitle || 'Material de Estudo'}
          </p>
        </div>
        <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted); opacity: 0.8;">
          Relatório pedagógico pronto para baixar.
        </p>
        <button class="btn-report-download" style="
            display: flex; align-items: center; gap: 6px;
            margin-top: 8px; padding: 8px 16px;
            background: var(--primary); color: white;
            border: none; border-radius: 8px;
            font-size: 0.8rem; font-weight: 700;
            cursor: pointer; transition: all 0.2s ease;
            width: fit-content;
            box-shadow: 0 3px 10px rgba(120, 40, 200, 0.2);
        ">
          <i class="fa-solid fa-file-pdf"></i> ${t('act.download_pdf') || 'Baixar PDF'}
        </button>
      </div>
    `;

  const downloadBtn = card.querySelector('.btn-report-download');
  downloadBtn.onclick = (e) => {
    e.preventDefault();
    const slug = (cleanTitle || 'report').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 50);
    const filename = `Tati_Report_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`;
    _downloadReportPDF(text, filename, downloadBtn);
  };

  // Insere o card antes da bolha escondida
  body.insertBefore(card, bubble);
}

// ─── Plano de Estudos Semanal ────────────────────────────────────────────────


async function loadWeeklyPlan() {
  try {
    const plan = await apiGet('/users/weekly-plan');
    const card = document.getElementById('weekly-plan-card');
    if (!card || !plan?.focuses) return;

    document.getElementById('wp-week').textContent = plan.week || '';
    document.getElementById('wp-greeting').textContent = plan.greeting || '';

    const progress = plan.progress || {};
    const overall = progress.overall || 'not_started';

    // Badge geral no header
    const badge = document.getElementById('wp-overall-badge');
    if (badge) {
      badge.textContent = _STATUS_ICON[overall] || '';
      badge.title = _STATUS_LABEL[overall] || '';
      badge.style.display = 'inline-block';
    }

    // Renderiza tópicos com indicador de progresso
    document.getElementById('wp-focuses').innerHTML = plan.focuses.map((f, i) => {
      // Busca status ignorando case e espaços para ser mais robusto com o retorno da IA
      const topicKey = Object.keys(progress).find(k => k.toLowerCase().trim() === f.topic.toLowerCase().trim());
      const topicStatus = topicKey ? progress[topicKey] : 'not_started';
      
      const icon = _STATUS_ICON[topicStatus] || '';
      return `
        <div class="wp-focus-item">
          <span class="wp-num">${i + 1}</span>
          <div class="wp-focus-content">
            <p class="wp-topic">${f.topic} <span class="wp-status-icon" title="${_STATUS_LABEL[topicStatus]}">${icon}</span></p>
            <p class="wp-detail" style="display:none;">${f.why}<br><em>💡 ${f.tip}</em></p>
          </div>
          <span class="wp-arrow">›</span>
        </div>`;
    }).join('');

    // Expandir ao clicar
    card.querySelectorAll('.wp-focus-item').forEach(item => {
      item.addEventListener('click', () => {
        const detail = item.querySelector('.wp-detail');
        const arrow = item.querySelector('.wp-arrow');
        const open = detail.style.display === 'block';
        detail.style.display = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(90deg)';
      });
    });

    // Botão "Get New Plan" — aparece se a semana acabou ou transição ainda não foi feita
    const newPlanBtn = document.getElementById('wp-new-plan-btn');
    if (newPlanBtn && !plan.transition_done) {
      // Verifica se já passou segunda-feira (semana nova) baseando-se no campo week
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=dom, 1=seg, ..., 6=sab
      // Mostra o botão a partir de quinta (dia 4) para o aluno saber que pode trocar
      if (dayOfWeek >= 4 || overall === 'done') {
        newPlanBtn.style.display = 'block';
      }
    }

    card.style.display = 'block';
  } catch (e) { console.error('[WeeklyPlan]', e); }
}

// ─── Modal de Transição de Plano ─────────────────────────────────────────────

let _ptExercises = [];
let _ptCurrentIndex = 0;
let _ptCorrect = 0;
let _ptAnswered = false;

async function openPlanTransitionModal() {
  // Reseta estado
  _ptExercises = [];
  _ptCurrentIndex = 0;
  _ptCorrect = 0;
  _ptAnswered = false;

  // Mostra overlay com loading
  const overlay = document.getElementById('plan-transition-overlay');
  overlay.style.display = 'flex';
  document.getElementById('pt-loading').style.display = 'flex';
  document.getElementById('pt-quiz').style.display = 'none';
  document.getElementById('pt-result').style.display = 'none';
  document.getElementById('pt-skip-btn').style.display = 'block';

  try {
    const res = await apiPost('/users/weekly-plan/transition', {});
    if (!res.ok || res.data.error) throw new Error(res.data?.error || 'Erro ao carregar exercícios');

    _ptExercises = res.data.exercises || [];
    document.getElementById('pt-title').textContent = res.data.title || 'Weekly Review';
    document.getElementById('pt-subtitle').textContent = res.data.description || '';

    document.getElementById('pt-loading').style.display = 'none';
    document.getElementById('pt-quiz').style.display = 'block';

    _ptRenderQuestion();
  } catch (e) {
    console.error('[PlanTransition]', e);
    document.getElementById('pt-loading').innerHTML =
      '<p style="color:var(--text-muted)">Could not load exercises. Try again later.</p>';
  }
}

function _ptRenderQuestion() {
  if (_ptCurrentIndex >= _ptExercises.length) {
    _ptShowResult();
    return;
  }

  const q = _ptExercises[_ptCurrentIndex];
  const total = _ptExercises.length;
  _ptAnswered = false;

  // Progress bar
  const pct = (_ptCurrentIndex / total) * 100;
  document.getElementById('pt-progress-bar').style.width = `${pct}%`;
  document.getElementById('pt-counter').textContent = `Question ${_ptCurrentIndex + 1} of ${total}`;

  // Pergunta
  const qBlock = document.getElementById('pt-question-block');
  qBlock.innerHTML = `<p class="pt-question-text">${q.question}</p>`;

  // Opções
  const optContainer = document.getElementById('pt-options');
  optContainer.innerHTML = (q.options || []).map((opt, i) =>
    `<button class="pt-option" data-index="${i}" onclick="ptSelectOption(this, ${i})">${opt}</button>`
  ).join('');

  // Reset feedback e botão next
  const fb = document.getElementById('pt-feedback');
  fb.style.display = 'none';
  fb.innerHTML = '';
  document.getElementById('pt-next-btn').style.display = 'none';
}

function ptSelectOption(btn, selectedIndex) {
  if (_ptAnswered) return;
  _ptAnswered = true;

  const q = _ptExercises[_ptCurrentIndex];
  const correct = q.correct_index;
  const isCorrect = selectedIndex === correct;

  if (isCorrect) _ptCorrect++;

  // Marca opções
  document.querySelectorAll('.pt-option').forEach((b, i) => {
    b.disabled = true;
    if (i === correct) b.classList.add('pt-correct');
    if (i === selectedIndex && !isCorrect) b.classList.add('pt-wrong');
  });

  // Feedback
  const fb = document.getElementById('pt-feedback');
  fb.style.display = 'block';
  fb.className = `pt-feedback ${isCorrect ? 'pt-feedback-correct' : 'pt-feedback-wrong'}`;
  fb.innerHTML = `<strong>${isCorrect ? '✅ Correct!' : '❌ Not quite.'}</strong> ${q.explanation || ''}`;

  // Botão next ou finish
  const nextBtn = document.getElementById('pt-next-btn');
  nextBtn.style.display = 'block';
  const isLast = _ptCurrentIndex === _ptExercises.length - 1;
  nextBtn.textContent = isLast ? 'See results →' : 'Next →';
}

function ptNextQuestion() {
  _ptCurrentIndex++;
  _ptRenderQuestion();
}

function _ptShowResult() {
  document.getElementById('pt-quiz').style.display = 'none';
  document.getElementById('pt-result').style.display = 'flex';
  document.getElementById('pt-skip-btn').style.display = 'none';

  const total = _ptExercises.length;
  const pct = Math.round((_ptCorrect / total) * 100);

  let icon, title, sub;
  if (pct >= 80) {
    icon = '🏆'; title = `Excellent! ${_ptCorrect}/${total} correct`;
    sub = "You're ready for a new challenge. Let's keep growing!";
  } else if (pct >= 50) {
    icon = '💪'; title = `Good effort! ${_ptCorrect}/${total} correct`;
    sub = "Your new plan will reinforce what needs more practice.";
  } else {
    icon = '📚'; title = `${_ptCorrect}/${total} correct`;
    sub = "No worries — your new plan will focus on exactly these topics.";
  }

  document.getElementById('pt-result-icon').textContent = icon;
  document.getElementById('pt-result-title').textContent = title;
  document.getElementById('pt-result-sub').textContent = sub;
  document.getElementById('pt-progress-bar').style.width = '100%';
}

async function finishPlanTransition() {
  document.getElementById('plan-transition-overlay').style.display = 'none';
  // Recarrega o plano (já foi invalidado no backend, vai gerar novo)
  document.getElementById('weekly-plan-card').style.display = 'none';
  document.getElementById('wp-new-plan-btn').style.display = 'none';
  await loadWeeklyPlan();
}

function skipPlanTransition() {
  document.getElementById('plan-transition-overlay').style.display = 'none';
}
