// js/chat.js
const API = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000';

// ── Auth guard ────────────────────────────────────────────────────
const token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }
const user = JSON.parse(userRaw);

// ── Tema ──────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}
window.addEventListener('DOMContentLoaded', () => {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    initUserInfo();
    loadConversations();
    setupFileInput();
});

// ── User info ─────────────────────────────────────────────────────
function initUserInfo() {
    const nameEl = document.getElementById('sidebar-user-name');
    const levelEl = document.getElementById('sidebar-user-level');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    if (nameEl) nameEl.textContent = user.name || user.username;
    if (levelEl) levelEl.textContent = user.level || 'Student';
    if (avatarEl) {
        const initials = (user.name || user.username).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials;
    }
}

// ── Sidebar ───────────────────────────────────────────────────────
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

// ── State ─────────────────────────────────────────────────────────
let currentConvId = null;
let ws = null;
let isStreaming = false;
let streamingBubble = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let pendingFile = [];   // { name, b64, size, type } e envia mais que 1 arquivo
let streamBuffer = '';

// ── Audio player state ─────────────────────────────────────────────
let currentMsgAudio = null;

// ── WebSocket ─────────────────────────────────────────────────────
function connectWS() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    ws = new WebSocket(`${WS_URL}/chat/ws?token=${token}`);
    ws.onopen = () => console.log('[WS] connected');
    ws.onmessage = e => handleWSMessage(JSON.parse(e.data));
    ws.onerror = e => console.error('[WS] error', e);
    ws.onclose = () => { ws = null; setTimeout(connectWS, 3000); };
    setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20000);
}

function handleWSMessage(msg) {
    switch (msg.type) {
        case 'pong': break;
        case 'transcription':
            document.getElementById('message-input').value = msg.text;
            autoResize(document.getElementById('message-input'));
            break;
        case 'status': appendStatus(msg.text); break;
        case 'stream_start':
            hideTyping();
            streamBuffer = '';
            streamingBubble = appendStreamBubble();
            break;
        case 'stream_token':
            if (streamingBubble) appendToken(streamingBubble, msg.token);
            break;
        case 'stream_end':
            if (streamingBubble) finalizeStreamBubble(streamingBubble);
            streamingBubble = null;
            isStreaming = false;
            setInputEnabled(true);
            loadConversations();
            break;
        case 'audio_response':
            attachAudioToLastBubble(msg.audio);
            break;
        case 'error':
            hideTyping();
            isStreaming = false;
            setInputEnabled(true);
            appendErrorMsg(msg.detail || 'Erro desconhecido');
            break;
    }
}

// ── Conversations ──────────────────────────────────────────────────
async function loadConversations() {
    try {
        const res = await fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { if (res.status === 401) logout(); return; }
        const convs = await res.json();
        renderConversations(convs);
    } catch (e) { console.error(e); }
}

function renderConversations(convs) {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '';
    if (!convs.length) {
        list.innerHTML = '<p class="list-empty">Nenhuma conversa ainda</p>'; return;
    }
    const groups = groupByDate(convs);
    for (const [label, items] of Object.entries(groups)) {
        const lbl = document.createElement('p');
        lbl.className = 'list-label'; lbl.textContent = label;
        list.appendChild(lbl);
        items.forEach(c => list.appendChild(buildConvItem(c)));
    }
}

function groupByDate(convs) {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const g = { 'Hoje': [], 'Ontem': [], 'Anteriores': [] };
    convs.forEach(c => {
        const d = new Date(c.updated_at).toDateString();
        if (d === today) g['Hoje'].push(c);
        else if (d === yesterday) g['Ontem'].push(c);
        else g['Anteriores'].push(c);
    });
    return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length));
}

function buildConvItem(c) {
    const div = document.createElement('div');
    div.className = 'conv-item' + (c.id === currentConvId ? ' active' : '');
    div.dataset.id = c.id;
    div.innerHTML = `
    <svg class="conv-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="conv-title">${escHtml(c.title)}</span>
    <button class="conv-delete" title="Deletar" onclick="deleteConv(event,'${c.id}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>`;
    div.addEventListener('click', () => openConversation(c.id, c.title));
    return div;
}

async function newChat() {
    try {
        const res = await fetch(`${API}/chat/conversations`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Nova conversa' })
        });
        const conv = await res.json();
        await loadConversations();
        openConversation(conv.id, conv.title);
    } catch (e) { console.error(e); }
}

async function openConversation(id, title) {
    currentConvId = id;
    document.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    document.querySelector('.topbar-title').textContent = title;
    await loadMessages(id);
    connectWS();
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('collapsed');
}

async function loadMessages(convId) {
    const area = document.getElementById('chat-messages');
    const typingEl = document.getElementById('typing-indicator');
    [...area.children].forEach(el => { if (el.id !== 'typing-indicator') el.remove(); });
    area.appendChild(typingEl);
    typingEl.style.display = 'none';

    if (!convId) { document.getElementById('chat-welcome').style.display = 'flex'; return; }
    const welcomeEl = document.getElementById('chat-welcome');
    if (welcomeEl) welcomeEl.style.display = 'none';

    try {
        const res = await fetch(`${API}/chat/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const msgs = await res.json();
        msgs.forEach(m => renderMessage(m.role, m.content));
    } catch (e) { }
    scrollBottom();
}

async function deleteConv(e, id) {
    e.stopPropagation();

    // Cria confirm inline (evita bloqueio do navegador)
    const existing = document.getElementById('confirm-delete-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'confirm-delete-popup';
    popup.style.cssText = `
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    background:var(--card); border:1px solid rgba(239,68,68,0.4);
    border-radius:12px; padding:1rem 1.25rem; z-index:999;
    display:flex; flex-direction:column; gap:0.5rem; min-width:220px;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
  `;
    popup.innerHTML = `
    <p style="font-size:0.85rem;color:var(--text);margin:0;">Deletar esta conversa?</p>
    <div style="display:flex;gap:0.5rem;">
      <button id="confirm-yes" style="flex:1;padding:0.4rem;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">Deletar</button>
      <button id="confirm-no" style="flex:1;padding:0.4rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">Cancelar</button>
    </div>
  `;
    document.body.appendChild(popup);

    document.getElementById('confirm-no').onclick = () => popup.remove();
    document.getElementById('confirm-yes').onclick = async () => {
        popup.remove();
        await fetch(`${API}/chat/conversations/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (currentConvId === id) {
            currentConvId = null;
            clearMessages();
        }
        await loadConversations();
    };
}

// ── File handling ──────────────────────────────────────────────────
function setupFileInput() {
    const attachBtn = document.querySelector('.btn-attach');
    if (attachBtn) attachBtn.addEventListener('click', () => triggerFileInput());
}

function triggerFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md,.pptx,.xlsx,png,jpg,webm'; // tipos permitidos
    input.multiple = true; // permitir vários arquivos por vez
    input.onchange = async () => {
        const files = Array.from(input.files);
        if (!files.length) return;

        const MAX = 10 * 1024 * 1024; // 10MB
        for (const file of files) {
            if (file.size > MAX) {
                appendErrorMsg(`${file.name} muito grande (máx 10MB).`); continue;
            }
        }

        await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => {
                const b64 = reader.result.split(',')[1];
                const ext = file.name.split('.').pop().toLowerCase();
                const previewText = (ext === 'txt' || ext === 'md')
                    ? atob(b64).substring(0, 300)
                    : `Arquivo ${ext.toUpperCase()} — conteúdo extraído pela Tati.`;
                pendingFiles.push({ name: file.name, b64, size: file.size, type: file.type });
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }
    renderFilePreviewBar();
};


function renderFilePreviewBar() {
    const old = document.getElementById('file-preview-bar');
    if (old) old.remove();
    if (!pendingFiles.length) return;

    const bar = document.createElement('div');
    bar.id = 'file-preview-bar';

    const itemsHtml = pendingFiles.map((f, i) => `
        <div class="file-preview-inner" style="margin-bottom:${i < pendingFiles.length - 1 ? '0.4rem' : '0'}">
            <div class="file-preview-icon">${getFileIcon(f.name)}</div>
            <div class="file-preview-info">
                <span class="file-preview-name">${escHtml(f.name)}</span>
                <span class="file-preview-size">${formatFileSize(f.size)}</span>
            </div>
            <button class="file-preview-remove" title="Remover" onclick="removePendingFile(${i})">✕</button>
        </div>
    `).join('');

    bar.innerHTML = `
        ${itemsHtml}
        <p class="file-preview-hint">📎 ${pendingFiles.length} arquivo(s) serão enviados com sua próxima mensagem</p>
    `;

    const inputArea = document.querySelector('.chat-input-area');
    inputArea.insertBefore(bar, inputArea.firstChild);
}

// mantém compatibilidade com chamadas antigas
function showFilePreview(name, size, extractedText = '') {
    renderFilePreviewBar();
}

function removePendingFile(index) {
    if (index === undefined) {
        pendingFiles = [];
    } else {
        pendingFiles.splice(index, 1);
    }
    renderFilePreviewBar();
}

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', docx: '📝', doc: '📝', txt: '📃', md: '📋' };
    return icons[ext] || '📎';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Send message ───────────────────────────────────────────────────
async function sendMessage() {
    if (isStreaming) return;
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text && !pendingFile) return;
    if (!currentConvId) { await newChat(); }
    if (!ws || ws.readyState !== WebSocket.OPEN) { connectWS(); await sleep(500); }

    if (pendingFiles.length) {
        const files = [...pendingFiles];
        removePendingFile(); // limpa tudo

        for (const file of files) {
            appendFileMsg(file.name, file.size);
        }
        showTyping();
        isStreaming = true;
        setInputEnabled(false);
        scrollBottom();

        // Envia cada arquivo sequencialmente
        for (const file of files) {
            ws.send(JSON.stringify({
                type: 'file',
                filename: file.name,
                content: file.b64,
                conversation_id: currentConvId,
                caption: text || ''
            }));
            await sleep(100); // pequena pausa entre arquivos
        }

        input.value = '';
        autoResize(input);
        return;
    }

    renderMessage('user', text);
    input.value = '';
    autoResize(input);
    showTyping();
    isStreaming = true;
    setInputEnabled(false);
    scrollBottom();

    ws.send(JSON.stringify({ type: 'text', content: text, conversation_id: currentConvId }));
}

function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function setInputEnabled(enabled) {
    document.getElementById('btn-send').disabled = !enabled;
    document.getElementById('message-input').disabled = !enabled;
}

function useSuggestion(btn) {
    document.getElementById('message-input').value = btn.textContent;
    sendMessage();
}

// ── Audio recording ────────────────────────────────────────────────
async function toggleMic() {
    if (isRecording) return stopRecording();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = sendAudio;
        mediaRecorder.start();
        isRecording = true;
        document.getElementById('btn-mic').classList.add('recording');
    } catch (e) { alert('Microfone não disponível: ' + e.message); }
}

function stopRecording() {
    if (mediaRecorder) mediaRecorder.stop();
    isRecording = false;
    document.getElementById('btn-mic').classList.remove('recording');
}

async function sendAudio() {
    if (!currentConvId) await newChat();
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
        const b64 = reader.result.split(',')[1];
        showTyping();
        ws.send(JSON.stringify({ type: 'audio', audio: b64, conversation_id: currentConvId }));
    };
    reader.readAsDataURL(blob);
}

// ── Render messages ────────────────────────────────────────────────
function renderMessage(role, content) {
    if (role === 'user') appendUserMsg(content);
    else appendAssistantMsg(content);
}

function appendUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'message message-user';
    div.innerHTML = `
    <div class="message-body">
      <div class="message-bubble"><p>${escHtml(text)}</p></div>
      <span class="message-time">${nowTime()}</span>
    </div>`;
    insertBeforeTyping(div);
    scrollBottom();
}

function appendFileMsg(name, size) {
    const div = document.createElement('div');
    div.className = 'message message-user';
    const ext = name.split('.').pop().toUpperCase();
    div.innerHTML = `
    <div class="message-body">
      <div class="message-bubble file-bubble">
        <div class="file-attach-preview">
          <div class="file-attach-icon">${getFileIcon(name)}</div>
          <div class="file-attach-info">
            <span class="file-attach-name">${escHtml(name)}</span>
            <span class="file-attach-size">${formatFileSize(size)}</span>
            <span class="file-attach-type">${ext}</span>
          </div>
        </div>
      </div>
      <span class="message-time">${nowTime()}</span>
    </div>`;
    insertBeforeTyping(div);
    scrollBottom();
}

function appendAssistantMsg(text) {
    const div = document.createElement('div');
    div.className = 'message message-assistant';
    div.innerHTML = `
    <div class="message-avatar">
      <img src="images/tati_logo.jpg" alt="Tati" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="msg-avatar-fallback" style="display:none">T</div>
    </div>
    <div class="message-body">
      <div class="message-bubble">${formatMarkdown(text)}</div>
      <div class="message-meta">
        <span class="message-time">${nowTime()}</span>
        <div class="msg-audio-controls" style="display:none">
          <button class="btn-tts-play" title="Reproduzir">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button class="btn-tts-rewind" title="Voltar 5s">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg>
          </button>
          <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="1" title="Volume">
          <select class="msg-spd-select" title="Velocidade">
            <option value="0.75">0.75×</option>
            <option value="1" selected>1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </div>
      </div>
    </div>`;

    insertBeforeTyping(div);
    // Make words clickable
    if (window.WordTooltip) WordTooltip.makeClickable(div);
    scrollBottom();
}

function appendStreamBubble() {
    const div = document.createElement('div');
    div.className = 'message message-assistant';
    div.innerHTML = `
    <div class="message-avatar">
      <img src="images/tati_logo.jpg" alt="Tati" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="msg-avatar-fallback" style="display:none">T</div>
    </div>
    <div class="message-body">
      <div class="message-bubble stream-bubble"></div>
    </div>`;
    insertBeforeTyping(div);
    scrollBottom();
    return div.querySelector('.stream-bubble');
}

function appendToken(bubble, token) {
    streamBuffer += token;
    bubble.innerHTML = formatMarkdown(streamBuffer);
    scrollBottom();
}

function finalizeStreamBubble(bubble) {
    const fullText = streamBuffer;
    streamBuffer = '';
    const body = bubble.closest('.message-body');
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `
    <span class="message-time">${nowTime()}</span>
    <div class="msg-audio-controls" style="display:none">
      <button class="btn-tts-play" title="Reproduzir">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <button class="btn-tts-rewind" title="Voltar 5s">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg>
      </button>
      <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="1" title="Volume">
      <select class="msg-spd-select" title="Velocidade">
        <option value="0.75">0.75×</option>
        <option value="1" selected>1×</option>
        <option value="1.25">1.25×</option>
        <option value="1.5">1.5×</option>
        <option value="2">2×</option>
      </select>
    </div>`;
    body.appendChild(meta);

    // Make words clickable after stream finishes
    if (window.WordTooltip) WordTooltip.makeClickable(bubble.closest('.message'));
}

// ── Audio attached to message ──────────────────────────────────────
function attachAudioToLastBubble(b64) {
    // Find last assistant message
    const msgs = document.querySelectorAll('.message-assistant');
    if (!msgs.length) return;
    const last = msgs[msgs.length - 1];
    const controls = last.querySelector('.msg-audio-controls');
    if (!controls) return;

    controls.style.display = 'flex';

    const audioSrc = 'data:audio/mp3;base64,' + b64;
    let audio = new Audio(audioSrc);
    audio.volume = 1;

    const playBtn = controls.querySelector('.btn-tts-play');
    const rewBtn = controls.querySelector('.btn-tts-rewind');
    const volSlider = controls.querySelector('.msg-vol-slider');
    const spdSelect = controls.querySelector('.msg-spd-select');

    // Auto-play
    audio.play().catch(() => { });
    updatePlayBtn(playBtn, true);

    playBtn.onclick = () => {
        if (audio.paused) {
            audio.play();
            updatePlayBtn(playBtn, true);
        } else {
            audio.pause();
            updatePlayBtn(playBtn, false);
        }
    };

    rewBtn.onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 5); };

    volSlider.oninput = () => { audio.volume = parseFloat(volSlider.value); };

    spdSelect.onchange = () => { audio.playbackRate = parseFloat(spdSelect.value); };

    audio.onended = () => updatePlayBtn(playBtn, false);
    audio.onerror = () => updatePlayBtn(playBtn, false);
}

function updatePlayBtn(btn, playing) {
    btn.innerHTML = playing
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    btn.title = playing ? 'Pausar' : 'Reproduzir';
}

// ── Misc helpers ───────────────────────────────────────────────────
function appendStatus(text) {
    const div = document.createElement('div');
    div.className = 'status-msg'; div.textContent = text;
    insertBeforeTyping(div);
}

function appendErrorMsg(text) {
    const div = document.createElement('div');
    div.className = 'error-banner'; div.textContent = '⚠️ ' + text;
    insertBeforeTyping(div); scrollBottom();
}

function insertBeforeTyping(el) {
    const area = document.getElementById('chat-messages');
    const typing = document.getElementById('typing-indicator');
    area.insertBefore(el, typing);
}

function clearMessages() {
    const area = document.getElementById('chat-messages');
    const typing = document.getElementById('typing-indicator');
    const welcome = document.getElementById('chat-welcome');
    [...area.children].forEach(el => { if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove(); });
    if (welcome) welcome.style.display = 'flex'; typing.style.display = 'none';
    document.querySelector('.topbar-title').textContent = 'Teacher Tati';
}

function showTyping() { document.getElementById('typing-indicator').style.display = 'flex'; scrollBottom(); }
function hideTyping() { document.getElementById('typing-indicator').style.display = 'none'; }

function formatMarkdown(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function escHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function scrollBottom() { const a = document.getElementById('chat-messages'); a.scrollTop = a.scrollHeight; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function logout() {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    window.location.href = '/';
}

// ── Attach listeners ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send').addEventListener('click', sendMessage);
    document.getElementById('btn-mic').addEventListener('click', toggleMic);
    connectWS();
    loadConversations().then(() => {
        const convs = document.querySelectorAll('.conv-item');
        if (convs.length) convs[0].click();
        else document.getElementById('chat-welcome').style.display = 'flex';
    });
});