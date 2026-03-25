// js/chat.js
const API    = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000';

// ── Auth guard ────────────────────────────────────────────────────
const token  = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }
const user = JSON.parse(userRaw);

// ── Apply theme from settings (no toggle in this page) ────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── Settings helpers ──────────────────────────────────────────────
function getSettings() {
    try { return JSON.parse(localStorage.getItem('tati_settings') || '{}'); } catch { return {}; }
}

// ── Staff roles (dashboard access) ───────────────────────────────
const STAFF_ROLES = ['professor', 'professora', 'programador', 'Tatiana', 'Tati', 'admin'];

// ── State ─────────────────────────────────────────────────────────
let currentConvId   = null;
let ws              = null;
let isStreaming     = false;
let streamingBubble = null;
let mediaRecorder   = null;
let audioChunks     = [];
let isRecording     = false;
let pendingFiles    = [];
let streamBuffer    = '';

// ── DOMContentLoaded ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    initUserInfo();
    loadConversations();
    setupFileInput();
    connectWS();

    document.getElementById('btn-send').addEventListener('click', sendMessage);
    document.getElementById('btn-mic').addEventListener('click', toggleMic);

    const textarea = document.getElementById('message-input');
    textarea.addEventListener('keydown', handleKey);
    textarea.addEventListener('input', () => autoResize(textarea));

    // Load most recent conversation on startup
    loadConversations().then(() => {
        const firstConv = document.querySelector('.conv-item');
        if (firstConv) firstConv.click();
        else showWelcome();
    });
});

// ── User info & dashboard visibility ─────────────────────────────
function initUserInfo() {
    const nameEl   = document.getElementById('sidebar-user-name');
    const levelEl  = document.getElementById('sidebar-user-level');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl)   nameEl.textContent  = user.name || user.username;
    if (levelEl)  levelEl.textContent = user.level || 'Student';
    if (avatarEl) {
        const initials = (user.name || user.username).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials;
    }

    // Show dashboard link only for staff
    if (STAFF_ROLES.includes(user.role)) {
        const dashBtn = document.getElementById('btn-dashboard');
        if (dashBtn) dashBtn.style.display = 'flex';
    }
}

// ── Sidebar ───────────────────────────────────────────────────────
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

// ── Voice mode switch ─────────────────────────────────────────────
function switchToVoice() {
    if (!currentConvId) return;
    window.location.href = `voice.html?conv_id=${currentConvId}`;
}

// ── WebSocket ─────────────────────────────────────────────────────
function connectWS() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    ws = new WebSocket(`${WS_URL}/chat/ws?token=${token}`);
    ws.onopen    = () => console.log('[WS] connected');
    ws.onmessage = e => handleWSMessage(JSON.parse(e.data));
    ws.onerror   = e => console.error('[WS] error', e);
    ws.onclose   = () => { ws = null; setTimeout(connectWS, 3000); };
    setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20000);
}

function waitForWS(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (ws && ws.readyState === WebSocket.OPEN) { resolve(); return; }
        const start = Date.now();
        const iv = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) { clearInterval(iv); resolve(); }
            else if (Date.now() - start > timeout) { clearInterval(iv); reject(new Error('WS timeout')); }
        }, 100);
    });
}

function handleWSMessage(msg) {
    switch (msg.type) {
        case 'pong': break;
        case 'transcription':
            document.getElementById('message-input').value = msg.text;
            autoResize(document.getElementById('message-input'));
            break;
        case 'status':
            appendStatus(msg.text);
            break;
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

// ── Conversations ─────────────────────────────────────────────────
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
    const today     = new Date().toDateString();
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
    document.getElementById('topbar-title').textContent = title;

    // Show "Modo Voz" button in topbar
    const voiceBtn = document.getElementById('btn-switch-voice');
    if (voiceBtn) voiceBtn.style.display = 'flex';

    await loadMessages(id);
    connectWS();
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('collapsed');
}

async function loadMessages(convId) {
    const area      = document.getElementById('chat-messages');
    const typingEl  = document.getElementById('typing-indicator');
    const welcomeEl = document.getElementById('chat-welcome');

    [...area.children].forEach(el => {
        if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove();
    });
    typingEl.style.display = 'none';

    if (!convId) { showWelcome(); return; }
    if (welcomeEl) welcomeEl.style.display = 'none';

    try {
        const res = await fetch(`${API}/chat/conversations/${convId}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const msgs = await res.json();
        msgs.forEach(m => renderMessage(m.role, m.content));
    } catch (e) { console.error(e); }
    scrollBottom();
}

function showWelcome() {
    const welcomeEl = document.getElementById('chat-welcome');
    if (welcomeEl) welcomeEl.style.display = 'flex';
    const voiceBtn = document.getElementById('btn-switch-voice');
    if (voiceBtn) voiceBtn.style.display = 'none';
    document.getElementById('topbar-title').textContent = 'Teacher Tati';
}

async function deleteConv(e, id) {
    e.stopPropagation();
    showConfirmPopup(
        'Deletar esta conversa?',
        async () => {
            await fetch(`${API}/chat/conversations/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (currentConvId === id) { currentConvId = null; clearMessages(); showWelcome(); }
            await loadConversations();
        }
    );
}

async function deleteAllConversations() {
    showConfirmPopup(
        '⚠️ Deletar TODAS as conversas?',
        async () => {
            const res  = await fetch(`${API}/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return;
            const convs = await res.json();
            await Promise.all(convs.map(c =>
                fetch(`${API}/chat/conversations/${c.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                })
            ));
            currentConvId = null;
            clearMessages();
            showWelcome();
            await loadConversations();
        }
    );
}

function showConfirmPopup(message, onConfirm) {
    const existing = document.getElementById('confirm-popup');
    if (existing) existing.remove();
    const popup = document.createElement('div');
    popup.id = 'confirm-popup';
    popup.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:var(--card);border:1px solid rgba(239,68,68,0.4);
        border-radius:12px;padding:1rem 1.25rem;z-index:999;
        display:flex;flex-direction:column;gap:0.5rem;min-width:240px;
        box-shadow:0 8px 24px rgba(0,0,0,0.4);
    `;
    popup.innerHTML = `
        <p style="font-size:0.85rem;color:var(--text);margin:0;font-weight:600;">${message}</p>
        <div style="display:flex;gap:0.5rem;">
            <button id="pop-yes" style="flex:1;padding:0.4rem;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">Confirmar</button>
            <button id="pop-no" style="flex:1;padding:0.4rem;background:var(--border);color:var(--text);border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;">Cancelar</button>
        </div>
    `;
    document.body.appendChild(popup);
    document.getElementById('pop-no').onclick  = () => popup.remove();
    document.getElementById('pop-yes').onclick = async () => { popup.remove(); await onConfirm(); };
}

// ── File handling ─────────────────────────────────────────────────
function setupFileInput() {
    const attachBtn = document.querySelector('.btn-attach');
    if (attachBtn) attachBtn.addEventListener('click', triggerFileInput);
}

function triggerFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md,.pptx,.xlsx,image/*,audio/*';
    input.multiple = true;
    input.onchange = async () => {
        const files = Array.from(input.files);
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { appendErrorMsg(`${file.name} muito grande (máx 10MB).`); continue; }
            await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => {
                    pendingFiles.push({ name: file.name, b64: reader.result.split(',')[1], size: file.size, type: file.type });
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
        renderFilePreviewBar();
    };
    input.click();
}

function renderFilePreviewBar() {
    const old = document.getElementById('file-preview-bar');
    if (old) old.remove();
    if (!pendingFiles.length) return;
    const bar = document.createElement('div');
    bar.id = 'file-preview-bar';
    bar.innerHTML = pendingFiles.map((f, i) => `
        <div class="file-preview-inner">
            <div class="file-preview-icon">${getFileIcon(f.name)}</div>
            <div class="file-preview-info">
                <span class="file-preview-name">${escHtml(f.name)}</span>
                <span class="file-preview-size">${formatFileSize(f.size)}</span>
            </div>
            <button class="file-preview-remove" onclick="removePendingFile(${i})">✕</button>
        </div>
    `).join('') + `<p class="file-preview-hint">📎 ${pendingFiles.length} arquivo(s) prontos para envio</p>`;
    document.querySelector('.chat-input-area').insertBefore(bar, document.querySelector('.chat-input-area').firstChild);
}

function removePendingFile(i) { pendingFiles.splice(i, 1); renderFilePreviewBar(); }
function getFileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    return { pdf:'📄', docx:'📝', doc:'📝', txt:'📃', md:'📋', xlsx:'📊', pptx:'📽️' }[ext] || '📎';
}
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

// ── Send message ──────────────────────────────────────────────────
async function sendMessage() {
    if (isStreaming) return;
    const input = document.getElementById('message-input');
    const text  = input.value.trim();
    if (!text && !pendingFiles.length) return;

    if (!currentConvId) { await newChat(); await sleep(300); }
    if (!ws || ws.readyState !== WebSocket.OPEN) connectWS();
    try { await waitForWS(6000); } catch {
        appendErrorMsg('Não foi possível conectar ao servidor.'); return;
    }

    input.value = '';
    autoResize(input);

    if (pendingFiles.length) {
        const files = [...pendingFiles];
        pendingFiles = [];
        renderFilePreviewBar();
        files.forEach(f => appendFileMsg(f.name, f.size));
        showTyping(); isStreaming = true; setInputEnabled(false); scrollBottom();
        for (const file of files) {
            ws.send(JSON.stringify({ type:'file', filename:file.name, content:file.b64, conversation_id:currentConvId, caption:text||'' }));
            await sleep(100);
        }
        return;
    }

    renderMessage('user', text);
    showTyping(); isStreaming = true; setInputEnabled(false); scrollBottom();
    ws.send(JSON.stringify({ type:'text', content:text, conversation_id:currentConvId }));
}

function handleKey(e) {
    const s = getSettings();
    const enterSends = s.enterSend !== false; // default true
    if (e.key === 'Enter' && !e.shiftKey && enterSends) {
        e.preventDefault(); e.stopPropagation(); sendMessage();
    }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function setInputEnabled(enabled) {
    const btn   = document.getElementById('btn-send');
    const input = document.getElementById('message-input');
    if (btn)   btn.disabled   = !enabled;
    if (input) input.disabled = !enabled;
}

function useSuggestion(btn) {
    document.getElementById('message-input').value = btn.textContent;
    sendMessage();
}

// ── Audio recording ───────────────────────────────────────────────
async function toggleMic() {
    if (isRecording) return stopRecording();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks   = [];
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
    if (!ws || ws.readyState !== WebSocket.OPEN) { connectWS(); await waitForWS(5000).catch(() => {}); }
    const blob   = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
        const b64 = reader.result.split(',')[1];
        showTyping();
        ws.send(JSON.stringify({ type:'audio', audio:b64, conversation_id:currentConvId }));
    };
    reader.readAsDataURL(blob);
}

// ── Render messages ───────────────────────────────────────────────
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
    insertBeforeTyping(div); scrollBottom();
}

function appendFileMsg(name, size) {
    const div = document.createElement('div');
    div.className = 'message message-user';
    div.innerHTML = `
        <div class="message-body">
            <div class="message-bubble file-bubble">
                <div class="file-attach-preview">
                    <div class="file-attach-icon">${getFileIcon(name)}</div>
                    <div class="file-attach-info">
                        <span class="file-attach-name">${escHtml(name)}</span>
                        <span class="file-attach-size">${formatFileSize(size)}</span>
                    </div>
                </div>
            </div>
            <span class="message-time">${nowTime()}</span>
        </div>`;
    insertBeforeTyping(div); scrollBottom();
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
                ${audioControlsHTML()}
            </div>
        </div>`;
    insertBeforeTyping(div);
    const s = getSettings();
    if (s.wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(div);
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
    insertBeforeTyping(div); scrollBottom();
    return div.querySelector('.stream-bubble');
}

function appendToken(bubble, token) {
    streamBuffer += token;
    bubble.innerHTML = formatMarkdown(streamBuffer);
    scrollBottom();
}

function finalizeStreamBubble(bubble) {
    const fullText = streamBuffer;
    streamBuffer   = '';
    const body = bubble.closest('.message-body');
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `<span class="message-time">${nowTime()}</span>${audioControlsHTML()}`;
    body.appendChild(meta);
    const s = getSettings();
    if (s.wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(bubble.closest('.message'));
}

// ── Audio controls HTML ───────────────────────────────────────────
function audioControlsHTML() {
    return `
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
}

// ── Attach audio to last assistant bubble ─────────────────────────
function attachAudioToLastBubble(b64) {
    const msgs = document.querySelectorAll('.message-assistant');
    if (!msgs.length) return;
    const last     = msgs[msgs.length - 1];
    const controls = last.querySelector('.msg-audio-controls');
    if (!controls) return;

    controls.style.display = 'flex';

    const s     = getSettings();
    const speed = parseFloat(s.defaultSpeed || '1');
    const audio = new Audio('data:audio/mp3;base64,' + b64);
    audio.volume       = 1;
    audio.playbackRate = speed;

    const playBtn  = controls.querySelector('.btn-tts-play');
    const rewBtn   = controls.querySelector('.btn-tts-rewind');
    const volSlider = controls.querySelector('.msg-vol-slider');
    const spdSelect = controls.querySelector('.msg-spd-select');

    // Set speed selector to match setting
    if (spdSelect) spdSelect.value = String(speed);

    // Auto-play if enabled in settings
    if (s.autoPlay) {
        audio.play().catch(() => {});
        updatePlayBtn(playBtn, true);
    }

    playBtn.onclick = () => {
        if (audio.paused) { audio.play(); updatePlayBtn(playBtn, true); }
        else              { audio.pause(); updatePlayBtn(playBtn, false); }
    };
    rewBtn.onclick      = () => { audio.currentTime = Math.max(0, audio.currentTime - 5); };
    volSlider.oninput   = () => { audio.volume = parseFloat(volSlider.value); };
    spdSelect.onchange  = () => { audio.playbackRate = parseFloat(spdSelect.value); };
    audio.onended       = () => updatePlayBtn(playBtn, false);
    audio.onerror       = () => updatePlayBtn(playBtn, false);
}

function updatePlayBtn(btn, playing) {
    btn.innerHTML = playing
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    btn.title = playing ? 'Pausar' : 'Reproduzir';
}

// ── Misc helpers ──────────────────────────────────────────────────
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
    const area   = document.getElementById('chat-messages');
    const typing = document.getElementById('typing-indicator');
    area.insertBefore(el, typing);
}

function clearMessages() {
    const area    = document.getElementById('chat-messages');
    const typing  = document.getElementById('typing-indicator');
    [...area.children].forEach(el => {
        if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove();
    });
    if (typing) typing.style.display = 'none';
}

function showTyping()  { document.getElementById('typing-indicator').style.display = 'flex'; scrollBottom(); }
function hideTyping()  { document.getElementById('typing-indicator').style.display = 'none'; }

function formatMarkdown(text) {
    return text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.*?)\*/g,'<em>$1</em>')
        .replace(/`(.*?)`/g,'<code>$1</code>')
        .replace(/\n/g,'<br>');
}

function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function nowTime()    { return new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); }
function scrollBottom() { const a = document.getElementById('chat-messages'); a.scrollTop = a.scrollHeight; }
function sleep(ms)    { return new Promise(r => setTimeout(r, ms)); }

function logout() {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    window.location.href = '/';
}