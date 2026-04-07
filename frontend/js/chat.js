if (!requireAuth()) throw new Error('Unauthenticated');
const user = getUser();

// ── State ─────────────────────────────────────────────────────────────────────
let currentConvId   = null;
let ws              = null;
let isStreaming     = false;
let streamingBubble = null;
let streamingMsgEl  = null;
let mediaRecorder   = null;
let audioChunks     = [];
let isRecording     = false;
let pendingFiles    = [];
let streamBuffer    = '';
let pendingAudioB64 = null;
let currentAudio    = null;

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  _initUserInfo();
  _setupFileInput();
  _connectWS();

  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('btn-mic').addEventListener('click', toggleMic);

  const textarea = document.getElementById('message-input');
  textarea.addEventListener('keydown', _handleKey);
  textarea.addEventListener('input', () => _autoResize(textarea));

  _loadConversations();
});

// ── User info ─────────────────────────────────────────────────────────────────
function _initUserInfo() {
  const el = id => document.getElementById(id);
  const nameEl   = el('sidebar-user-name');
  const levelEl  = el('sidebar-user-level');
  const avatarEl = el('sidebar-user-avatar');

  if (nameEl)  nameEl.textContent  = user.name || user.username;
  if (levelEl) levelEl.textContent = user.level || 'Student';
  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.innerHTML = `<img src="${user.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:top;" alt="">`;
    } else {
      avatarEl.textContent = (user.name || user.username).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    }
  }
  if (isStaff(user)) {
    const dashBtn = el('btn-dashboard');
    if (dashBtn) dashBtn.style.display = 'flex';
  }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }
function switchToVoice()  { if (currentConvId) window.location.href = `/voice.html?conv_id=${currentConvId}`; }

// ── WebSocket ─────────────────────────────────────────────────────────────────
function _connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(`${WS_BASE}/chat/ws?token=${getToken()}`);
  ws.onopen    = () => console.log('[WS] connected');
  ws.onmessage = e => _handleWSMessage(JSON.parse(e.data));
  ws.onerror   = e => console.error('[WS] error', e);
  ws.onclose   = () => { ws = null; setTimeout(_connectWS, 3000); };
  setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20000);
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
    pong:           () => {},
    transcription:  () => { _renderMessage('user', msg.text); document.getElementById('message-input').value = ''; _autoResize(document.getElementById('message-input')); },
    status:         () => _appendStatus(msg.text),
    stream_start:   () => {
      _hideTyping();
      streamBuffer = '';
      pendingAudioB64 = null;
      const r = _appendStreamBubble();
      streamingBubble = r.bubble;
      streamingMsgEl  = r.msgEl;
    },
    stream_token:   () => { if (streamingBubble) _appendToken(streamingBubble, msg.token); },
    stream_end:     () => {
      if (streamingMsgEl) {
        const meta = _finalizeStreamBubble(streamingMsgEl, streamingBubble);
        if (pendingAudioB64 && meta) { _buildAudioControls(meta, pendingAudioB64); pendingAudioB64 = null; }
      }
      streamingBubble = null; streamingMsgEl = null;
      isStreaming = false;
      _setInputEnabled(true);
      const active = document.querySelector('.conv-item.active .conv-title');
      if (!active || active.textContent === 'Nova conversa') _loadConversations();
    },
    audio_response: () => { streamingMsgEl ? (pendingAudioB64 = msg.audio) : _attachAudioToLastMsg(msg.audio); },
    error:          () => { _hideTyping(); isStreaming = false; _setInputEnabled(true); _appendErrorMsg(msg.detail || 'Erro desconhecido'); },
  };
  (handlers[msg.type] || (() => {}))();
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function _loadConversations() {
  try {
    const convs = await apiGet('/chat/conversations');
    _renderConversationList(convs);
    if (!currentConvId) _showWelcome();
  } catch (e) { console.error(e); }
}

function _renderConversationList(convs) {
  const list = document.getElementById('conversations-list');
  if (!convs.length) { list.innerHTML = '<p class="list-empty">Nenhuma conversa ainda</p>'; return; }
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups    = { 'Hoje': [], 'Ontem': [], 'Anteriores': [] };

  convs.forEach(c => {
    const d = new Date(c.updated_at).toDateString();
    if (d === today) groups['Hoje'].push(c);
    else if (d === yesterday) groups['Ontem'].push(c);
    else groups['Anteriores'].push(c);
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
    <button class="conv-delete" title="Deletar" onclick="deleteConv(event,'${c.id}')">
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
  document.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('chat-welcome')?.style.setProperty('display', 'none');
  await _loadMessages(id);
  _connectWS();
  if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('collapsed');
}

async function _loadMessages(convId) {
  const area      = document.getElementById('chat-messages');
  const typingEl  = document.getElementById('typing-indicator');
  const welcomeEl = document.getElementById('chat-welcome');
  const voiceBtn  = document.getElementById('btn-switch-voice');

  [...area.children].forEach(el => { if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove(); });
  if (typingEl)  typingEl.style.display  = 'none';
  if (welcomeEl) welcomeEl.style.display = 'none';
  if (!convId) { _showWelcome(); return; }

  try {
    const msgs = await apiGet(`/chat/conversations/${convId}/messages`);
    if (!msgs.length) {
      if (welcomeEl) { welcomeEl.style.display = 'flex'; if (area.firstChild !== welcomeEl) area.insertBefore(welcomeEl, area.firstChild); }
      if (voiceBtn) voiceBtn.style.display = 'none';
    } else {
      msgs.forEach(m => _renderMessage(m.role, m.content));
      if (voiceBtn) voiceBtn.style.display = 'flex';
    }
  } catch (e) { console.error(e); }
  _scrollBottom();
}

function _showWelcome() {
  const area      = document.getElementById('chat-messages');
  const welcomeEl = document.getElementById('chat-welcome');
  const voiceBtn  = document.getElementById('btn-switch-voice');
  const typing    = document.getElementById('typing-indicator');

  [...area.children].forEach(el => { if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove(); });
  if (typing)    typing.style.display    = 'none';
  if (welcomeEl) { welcomeEl.style.display = 'flex'; if (area.firstChild !== welcomeEl) area.insertBefore(welcomeEl, area.firstChild); }
  if (voiceBtn)  voiceBtn.style.display  = 'none';
  _checkSummaryBtn();
  document.getElementById('topbar-title').textContent = 'Teacher Tati';
  currentConvId = null;
}

async function deleteConv(e, id) {
  e.stopPropagation();
  _showConfirmPopup('Deletar esta conversa?', async () => {
    await apiDelete(`/chat/conversations/${id}`);
    if (currentConvId === id) { currentConvId = null; _showWelcome(); }
    await _loadConversations();
  });
}

async function deleteAllConversations() {
  _showConfirmPopup('⚠️ Deletar TODAS as conversas?', async () => {
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
    position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)',
    background:'var(--surface)', border:'1px solid hsla(355,78%,60%,0.4)',
    borderRadius:'12px', padding:'1rem 1.25rem', zIndex:'999',
    display:'flex', flexDirection:'column', gap:'0.5rem', minWidth:'240px',
    boxShadow:'var(--shadow-lg)',
  });
  popup.innerHTML = `
    <p style="font-size:0.85rem;color:var(--text);margin:0;font-weight:600;">${message}</p>
    <div style="display:flex;gap:0.5rem;">
      <button id="pop-yes" style="flex:1;padding:0.4rem;background:var(--danger);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">Confirmar</button>
      <button id="pop-no"  style="flex:1;padding:0.4rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">Cancelar</button>
    </div>`;
  document.body.appendChild(popup);
  document.getElementById('pop-no').onclick  = () => popup.remove();
  document.getElementById('pop-yes').onclick = async () => { popup.remove(); await onConfirm(); };
}

// ── File handling ─────────────────────────────────────────────────────────────
function _setupFileInput() {
  document.querySelector('.btn-attach')?.addEventListener('click', _triggerFileInput);
}

function _triggerFileInput() {
  const input = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.pdf,.docx,.txt,.md,.pptx,.xlsx,image/*,audio/*';
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
  document.querySelector('.chat-input-area').insertBefore(bar, document.querySelector('.chat-input-area').firstChild);
}

function removePendingFile(i) { pendingFiles.splice(i, 1); _renderFilePreviewBar(); }
function _getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ({ pdf:'📄', docx:'📝', doc:'📝', txt:'📃', md:'📋', xlsx:'📊', pptx:'📽️' }[ext]) || '📎';
}
function _formatFileSize(b) {
  return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isStreaming) return;
  const input = document.getElementById('message-input');
  const text  = input.value.trim();
  if (!text && !pendingFiles.length) return;

  if (!currentConvId) {
    try {
      const { data } = await apiPost('/chat/conversations', { title: 'Nova conversa' });
      currentConvId = data.id;
      await _loadConversations();
      document.querySelectorAll('.conv-item').forEach(el =>
        el.classList.toggle('active', el.dataset.id === data.id)
      );
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
  ws.send(JSON.stringify({ type: 'text', content: text, conversation_id: currentConvId }));
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
function useSuggestion(btn) { document.getElementById('message-input').value = btn.textContent; sendMessage(); }

// ── Audio recording ───────────────────────────────────────────────────────────
async function toggleMic() {
  if (isRecording) return _stopRecording();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks   = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = _sendAudio;
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('btn-mic').classList.add('recording');
  } catch (e) { alert('Microfone não disponível: ' + e.message); }
}
function _stopRecording() {
  mediaRecorder?.stop();
  isRecording = false;
  document.getElementById('btn-mic').classList.remove('recording');
}
async function _sendAudio() {
  if (!currentConvId) {
    const { data } = await apiPost('/chat/conversations', { title: 'Nova conversa' });
    currentConvId = data.id;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) { _connectWS(); await _waitForWS(5000).catch(() => {}); }
  const blob   = new Blob(audioChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  reader.onload = () => {
    _showTyping();
    ws.send(JSON.stringify({ type: 'audio', audio: reader.result.split(',')[1], conversation_id: currentConvId }));
  };
  reader.readAsDataURL(blob);
}

// ── Render helpers ────────────────────────────────────────────────────────────
function _renderMessage(role, content) {
  role === 'user' ? _appendUserMsg(content) : _appendAssistantMsg(content);
}

function _appendUserMsg(text) {
  const div = document.createElement('div');
  div.className = 'message message-user';
  div.innerHTML = `<div class="message-body"><div class="message-bubble"><p>${escHtml(text)}</p></div><span class="message-time">${nowTime()}</span></div>`;
  _insertBeforeTyping(div); _scrollBottom(); _checkSummaryBtn();
}

function _appendFileMsg(name, size) {
  const div = document.createElement('div');
  div.className = 'message message-user';
  div.innerHTML = `<div class="message-body"><div class="message-bubble file-bubble"><div class="file-attach-preview"><div class="file-attach-icon">${_getFileIcon(name)}</div><div class="file-attach-info"><span class="file-attach-name">${escHtml(name)}</span><span class="file-attach-size">${_formatFileSize(size)}</span></div></div></div><span class="message-time">${nowTime()}</span></div>`;
  _insertBeforeTyping(div); _scrollBottom();
}

function _appendAssistantMsg(text) {
  const div = document.createElement('div');
  div.className = 'message message-assistant';
  div.innerHTML = `
    <div class="message-avatar"><img src="images/tati_logo.jpg" alt="Tati" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-fallback" style="display:none">T</div></div>
    <div class="message-body">
      <div class="message-bubble">${formatMarkdown(text)}</div>
      <div class="message-meta"><span class="message-time">${nowTime()}</span></div>
    </div>`;
  _insertBeforeTyping(div);
  if (getSettings().wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(div);
  _scrollBottom();
}

function _appendStreamBubble() {
  const div = document.createElement('div');
  div.className = 'message message-assistant';
  div.innerHTML = `
    <div class="message-avatar"><img src="images/tati_logo.jpg" alt="Tati" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="msg-avatar-fallback" style="display:none">T</div></div>
    <div class="message-body"><div class="message-bubble stream-bubble"></div></div>`;
  _insertBeforeTyping(div); _scrollBottom();
  return { bubble: div.querySelector('.stream-bubble'), msgEl: div };
}

function _appendToken(bubble, token) {
  streamBuffer += token;
  bubble.innerHTML = formatMarkdown(streamBuffer);
  _scrollBottom();
}

function _finalizeStreamBubble(msgEl, bubble) {
  if (getSettings().wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(msgEl);
  const body = msgEl.querySelector('.message-body');
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.innerHTML = `<span class="message-time">${nowTime()}</span>`;
  body.appendChild(meta);
  streamBuffer = '';
  return meta;
}

function _attachAudioToLastMsg(b64) {
  const msgs = document.querySelectorAll('.message-assistant');
  if (!msgs.length) return;
  const meta = msgs[msgs.length - 1].querySelector('.message-meta');
  if (meta) _buildAudioControls(meta, b64);
}

function _buildAudioControls(meta, b64) {
  if (meta.querySelector('.msg-audio-controls')) return;
  const s = getSettings();
  const defaultSpeed = parseFloat(s.defaultSpeed || '1');

  const controls = document.createElement('div');
  controls.className = 'msg-audio-controls';
  controls.innerHTML = `
    <button class="btn-tts-play" title="Play">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
    <button class="btn-tts-rewind" title="↩5s">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg>
    </button>
    <div class="msg-vol-control">
      <label>Vol</label>
      <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="1">
      <span class="msg-vol-value">100%</span>
    </div>
    <div class="msg-spd-control">
      <label>Vel</label>
      <select class="msg-spd-select">
        <option value="0.75">0.75×</option>
        <option value="1" ${defaultSpeed === 1 ? 'selected' : ''}>1×</option>
        <option value="1.25" ${defaultSpeed === 1.25 ? 'selected' : ''}>1.25×</option>
        <option value="1.5" ${defaultSpeed === 1.5 ? 'selected' : ''}>1.5×</option>
        <option value="2" ${defaultSpeed === 2 ? 'selected' : ''}>2×</option>
      </select>
    </div>`;
  meta.appendChild(controls);

  const playBtn  = controls.querySelector('.btn-tts-play');
  const rewBtn   = controls.querySelector('.btn-tts-rewind');
  const volSlider = controls.querySelector('.msg-vol-slider');
  const spdSelect = controls.querySelector('.msg-spd-select');
  const volValue  = controls.querySelector('.msg-vol-value');

  const audio = new Audio(`data:audio/mp3;base64,${b64}`);
  audio.volume       = 1;
  audio.playbackRate = defaultSpeed;

  const setPlayIcon = playing => {
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
    audio.play().catch(() => {});
    setPlayIcon(true);
  };

  if (s.autoPlay === true || s.autoPlay === 'true') playThis();

  playBtn.addEventListener('click', e => { e.stopPropagation(); audio.paused ? playThis() : (audio.pause(), setPlayIcon(false)); });
  rewBtn.addEventListener('click', e => { e.stopPropagation(); audio.currentTime = Math.max(0, audio.currentTime - 5); });
  volSlider.addEventListener('input', e => { e.stopPropagation(); audio.volume = parseFloat(volSlider.value); volValue.textContent = Math.round(audio.volume * 100) + '%'; });
  spdSelect.addEventListener('change', e => { e.stopPropagation(); audio.playbackRate = parseFloat(spdSelect.value); });
  audio.addEventListener('ended', () => { setPlayIcon(false); if (currentAudio === audio) currentAudio = null; });
  audio.addEventListener('pause', () => setPlayIcon(false));
  audio.addEventListener('play',  () => setPlayIcon(true));
}

// ── Summary ───────────────────────────────────────────────────────────────────
function _checkSummaryBtn() {
  const btn = document.getElementById('btn-switch-summary');
  if (!btn) return;
  btn.style.display = document.querySelectorAll('.message-user').length > 5 ? 'flex' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-switch-summary')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-switch-summary');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Gerando...';
    btn.disabled  = true;
    try {
      const data = await apiGet(`/chat/conversations/${currentConvId}/summary`);
      document.getElementById('summary-text').innerHTML = marked.parse(data.summary);
      document.getElementById('summary-modal').style.display = 'flex';
    } catch {
      alert('Erro ao gerar resumo. Tente novamente.');
    } finally {
      btn.innerHTML = orig;
      btn.disabled  = false;
    }
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

// ── Misc ──────────────────────────────────────────────────────────────────────
function _appendStatus(text)   { const d = document.createElement('div'); d.className = 'status-msg'; d.textContent = text; _insertBeforeTyping(d); }
function _appendErrorMsg(text) { const d = document.createElement('div'); d.className = 'error-banner'; d.textContent = '⚠️ ' + text; _insertBeforeTyping(d); _scrollBottom(); }
function _insertBeforeTyping(el) { const a = document.getElementById('chat-messages'); a.insertBefore(el, document.getElementById('typing-indicator')); }
function _showTyping()  { document.getElementById('typing-indicator').style.display = 'flex'; _scrollBottom(); }
function _hideTyping()  { document.getElementById('typing-indicator').style.display = 'none'; }
function _scrollBottom() { const a = document.getElementById('chat-messages'); a.scrollTop = a.scrollHeight; }
function logout() { authLogout(); }