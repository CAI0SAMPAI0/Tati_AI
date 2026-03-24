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
});

// ── User info na sidebar ──────────────────────────────────────────
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

// ── Sidebar toggle ────────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── Estado global ─────────────────────────────────────────────────
let currentConvId = null;
let ws = null;
let isStreaming = false;
let streamingBubble = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ── WebSocket ─────────────────────────────────────────────────────
function connectWS() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    ws = new WebSocket(`${WS_URL}/chat/ws?token=${token}`);
    ws.onopen = () => console.log('[WS] connected');
    ws.onmessage = (e) => handleWSMessage(JSON.parse(e.data));
    ws.onerror = (e) => console.error('[WS] error', e);
    ws.onclose = () => { ws = null; setTimeout(connectWS, 3000); };
    // Keepalive
    setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20000);
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
            loadConversations(); // refresh title
            break;
        case 'audio_response':
            playAudio(msg.audio);
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
        const res = await fetch(`${API}/chat/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { if (res.status === 401) logout(); return; }
        const convs = await res.json();
        renderConversations(convs);
    } catch (e) { console.error('loadConversations error', e); }
}

function renderConversations(convs) {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '';
    if (!convs.length) {
        list.innerHTML = '<p class="list-empty">Nenhuma conversa ainda</p>';
        return;
    }
    const groups = groupByDate(convs);
    for (const [label, items] of Object.entries(groups)) {
        const lbl = document.createElement('p');
        lbl.className = 'list-label';
        lbl.textContent = label;
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
    // Update active
    document.querySelectorAll('.conv-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
    document.querySelector('.topbar-title').textContent = title;
    // Load messages
    try {
        const res = await fetch(`${API}/chat/conversations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        // load history via a dedicated call
        await loadMessages(id);
    } catch (e) { console.error(e); }
    connectWS();
    // Close sidebar on mobile
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('collapsed');
}

async function loadMessages(convId) {
    // Fetch messages from history endpoint (piggyback on conversations list for now)
    const messagesArea = document.getElementById('chat-messages');
    const typingEl = document.getElementById('typing-indicator');
    // Clear all except typing indicator
    [...messagesArea.children].forEach(el => {
        if (el.id !== 'typing-indicator') el.remove();
    });
    messagesArea.appendChild(typingEl);
    typingEl.style.display = 'none';

    // Show welcome if no conv
    if (!convId) {
        document.getElementById('chat-welcome').style.display = 'flex';
        return;
    }
    document.getElementById('chat-welcome').style.display = 'none';

    try {
        const res = await fetch(`${API}/chat/conversations/${convId}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return; // endpoint might not exist, that's fine
        const msgs = await res.json();
        msgs.forEach(m => renderMessage(m.role, m.content));
    } catch (e) {
        // History endpoint may not be implemented; start fresh
    }
    scrollBottom();
}

async function deleteConv(e, id) {
    e.stopPropagation();
    if (!confirm('Deletar esta conversa?')) return;
    await fetch(`${API}/chat/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (currentConvId === id) {
        currentConvId = null;
        clearMessages();
    }
    loadConversations();
}

// ── Send message ──────────────────────────────────────────────────
async function sendMessage() {
    if (isStreaming) return;
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;
    if (!currentConvId) { await newChat(); }
    if (!ws || ws.readyState !== WebSocket.OPEN) { connectWS(); await sleep(500); }

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
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
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

// ── Audio recording ───────────────────────────────────────────────
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

// ── File upload ───────────────────────────────────────────────────
function attachFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        if (!currentConvId) await newChat();
        const reader = new FileReader();
        reader.onload = () => {
            const b64 = reader.result.split(',')[1];
            appendStatus(`Enviando ${file.name}...`);
            ws.send(JSON.stringify({ type: 'file', filename: file.name, content: b64, conversation_id: currentConvId }));
        };
        reader.readAsDataURL(file);
    };
    input.click();
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
                <button class="btn-tts" title="Ouvir" onclick="speakText(this, ${JSON.stringify(text)})">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                </button>
            </div>
        </div>`;
    insertBeforeTyping(div);
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

let streamBuffer = '';
function appendToken(bubble, token) {
    streamBuffer += token;
    bubble.innerHTML = formatMarkdown(streamBuffer);
    scrollBottom();
}

function finalizeStreamBubble(bubble) {
    const fullText = streamBuffer;
    streamBuffer = '';
    // Add time + TTS button
    const body = bubble.closest('.message-body');
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `
        <span class="message-time">${nowTime()}</span>
        <button class="btn-tts" title="Ouvir" onclick="speakText(this, ${JSON.stringify(fullText)})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
        </button>`;
    body.appendChild(meta);
}

function appendStatus(text) {
    const div = document.createElement('div');
    div.className = 'status-msg';
    div.textContent = text;
    insertBeforeTyping(div);
}

function appendErrorMsg(text) {
    const div = document.createElement('div');
    div.className = 'error-banner';
    div.textContent = '⚠️ ' + text;
    insertBeforeTyping(div);
    scrollBottom();
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
    [...area.children].forEach(el => {
        if (el.id !== 'typing-indicator' && el.id !== 'chat-welcome') el.remove();
    });
    welcome.style.display = 'flex';
    typing.style.display = 'none';
    document.querySelector('.topbar-title').textContent = 'Teacher Tati';
}

// ── Typing indicator ──────────────────────────────────────────────
function showTyping() { document.getElementById('typing-indicator').style.display = 'flex'; scrollBottom(); }
function hideTyping() { document.getElementById('typing-indicator').style.display = 'none'; }

// ── TTS playback ──────────────────────────────────────────────────
function playAudio(b64) {
    const audio = new Audio('data:audio/mp3;base64,' + b64);
    audio.play().catch(e => console.warn('autoplay blocked', e));
}

function speakText(btn, text) {
    // Request TTS from backend via REST (simple approach)
    btn.disabled = true;
    fetch(`${API}/chat/tts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    }).then(r => r.json()).then(d => {
        if (d.audio) playAudio(d.audio);
    }).catch(() => {}).finally(() => { btn.disabled = false; });
}

// ── Markdown formatter ────────────────────────────────────────────
function formatMarkdown(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// ── Helpers ───────────────────────────────────────────────────────
function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function nowTime() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function scrollBottom() {
    const area = document.getElementById('chat-messages');
    area.scrollTop = area.scrollHeight;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// ── Attach listeners ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send').addEventListener('click', sendMessage);
    document.getElementById('btn-mic').addEventListener('click', toggleMic);
    const attachBtn = document.querySelector('.btn-attach');
    if (attachBtn) attachBtn.addEventListener('click', attachFile);
    connectWS();
    // Load last conversation or show welcome
    loadConversations().then(() => {
        const convs = document.querySelectorAll('.conv-item');
        if (convs.length) convs[0].click();
        else document.getElementById('chat-welcome').style.display = 'flex';
    });
});