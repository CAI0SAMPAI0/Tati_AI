const API    = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000';

// ── Auth guard ─────────────────────────────────────────────────────
const token  = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }

// ── Apply theme from settings ──────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── Settings helpers ───────────────────────────────────────────────
function getSettings() {
  try { return JSON.parse(localStorage.getItem('tati_settings') || '{}'); } catch { return {}; }
}

// ── Read conv_id from URL
const urlParams    = new URLSearchParams(window.location.search);
const urlConvId    = urlParams.get('conv_id') || null;

// ── State ──────────────────────────────────────────────────────────
let ws            = null;
let currentConvId = urlConvId;
let isRecording   = false;
let isProcessing  = false;
let mediaRecorder = null;
let audioChunks   = [];
let currentAudio  = null;
let lastAudioB64  = null;
let pendingUserBubble = null;

// ── DOM refs — FIX: guard against null to prevent crash ───────────
const avatarWrap = document.getElementById('avatar-wrap');
const statusText = document.getElementById('status-text');
const micBtn     = document.getElementById('mic-btn');
const micHint    = document.getElementById('mic-hint');
const history    = document.getElementById('voice-history');
const vtyping    = document.getElementById('vtyping');

const vacPlayBtn = document.getElementById('vac-play-btn');
const vacRewBtn  = document.getElementById('vac-rewind-btn');
const vacVol     = document.getElementById('vac-vol');
const vacVolVal  = document.getElementById('vac-vol-val');
const vacSpd     = document.getElementById('vac-spd');
const vacSpdVal  = document.getElementById('vac-spd-val');

// FIX: Check that all critical DOM elements exist before proceeding
if (!micBtn || !history || !vtyping) {
  console.error('[Voice] Critical DOM elements missing. Aborting.');
}

// ── Avatar states — FIX: use i18n for status labels ───────────────
function setAvatarState(state) {
  if (!avatarWrap || !statusText || !micHint) return;
  avatarWrap.className = 'avatar-wrap ' + state;
  switch (state) {
    case 'listening':
      statusText.textContent = (typeof t === 'function') ? t('voice.listening')  : '🎙 Ouvindo…';
      micHint.textContent    = (typeof t === 'function') ? t('voice.tap_stop')   : 'Toque para parar';
      break;
    case 'processing':
      statusText.textContent = (typeof t === 'function') ? t('voice.processing') : '⏳ Processando…';
      micHint.textContent    = (typeof t === 'function') ? t('voice.wait')       : 'Aguarde…';
      break;
    case 'speaking':
      statusText.textContent = (typeof t === 'function') ? t('voice.speaking')   : '🗣 Falando…';
      micHint.textContent    = (typeof t === 'function') ? t('voice.tap_speak')  : 'Toque para falar';
      break;
    default:
      statusText.textContent = (typeof t === 'function') ? t('voice.online')     : 'Online';
      micHint.textContent    = (typeof t === 'function') ? t('voice.tap_speak')  : 'Toque para falar';
  }
}

// ── WebSocket ──────────────────────────────────────────────────────
function connectWS() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
  ws = new WebSocket(`${WS_URL}/chat/ws?token=${token}`);
  ws.onopen    = () => { console.log('[Voice WS] connected'); ensureConversation(); };
  ws.onmessage = e => handleWSMessage(JSON.parse(e.data));
  ws.onerror   = e => console.error('[Voice WS]', e);
  ws.onclose   = () => { ws = null; setTimeout(connectWS, 3000); };
  setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'ping' })); }, 20000);
}

function handleWSMessage(msg) {
  switch (msg.type) {
    case 'pong': break;

    case 'transcription':
      if (pendingUserBubble) {
        const bub = pendingUserBubble.querySelector('.vbubble.user');
        if (bub) bub.textContent = msg.text;
        pendingUserBubble = null;
      } else {
        addBubble('user', msg.text);
      }
      scrollBottom();
      break;

    case 'stream_start':
      hideTyping();
      startBotBubble();
      setAvatarState('processing');
      break;

    case 'stream_token':
      appendBotToken(msg.token);
      break;

    case 'stream_end':
      finalizeBotBubble();
      break;

    case 'audio_response':
      lastAudioB64 = msg.audio;
      playAudio(msg.audio);
      break;

    case 'error':
      hideTyping();
      setAvatarState('idle');
      isProcessing    = false;
      if (micBtn) {
        micBtn.disabled = false;
        micBtn.classList.remove('processing');
        micBtn.textContent = '🎤';
      }
      addBubble('bot', '⚠️ ' + (msg.detail || 'Erro'));
      break;
  }
}

async function ensureConversation() {
  if (currentConvId) {
    loadExistingMessages(currentConvId);
    return;
  }

  try {
    const res = await fetch(`${API}/chat/conversations`, { headers:{ Authorization:`Bearer ${token}` } });
    if (res.ok) {
      const convs = await res.json();
      if (convs.length) { currentConvId = convs[0].id; loadExistingMessages(currentConvId); return; }
    }
    const res2 = await fetch(`${API}/chat/conversations`, {
      method: 'POST',
      headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ title: 'Modo Voz' })
    });
    const conv = await res2.json();
    currentConvId = conv.id;
  } catch(e) { console.error('[Voice] ensureConversation error:', e); }
}

async function loadExistingMessages(convId) {
  try {
    const res = await fetch(`${API}/chat/conversations`, { headers:{ Authorization:`Bearer ${token}` } });
    if (res.ok) {
      const convs = await res.json();
      const conv  = convs.find(c => c.id === convId);
      if (conv) {
        const titleEl = document.getElementById('voice-conv-title');
        if (titleEl) titleEl.textContent = conv.title || 'Voice Mode';
      }
    }
  } catch(e) {}

  try {
    const res = await fetch(`${API}/chat/conversations/${convId}/messages`, {
      headers: { Authorization:`Bearer ${token}` }
    });
    if (!res.ok) return;
    const msgs = await res.json();
    msgs.forEach(m => addBubble(m.role === 'user' ? 'user' : 'bot', m.content));
    scrollBottom();
  } catch(e) { console.error('[Voice] loadExistingMessages error:', e); }
}

// ── Mic ────────────────────────────────────────────────────────────
if (micBtn) {
  micBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; setAvatarState('idle'); }
      await startRecording();
    }
  });
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks   = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = sendAudio;
    mediaRecorder.start();
    isRecording = true;
    if (micBtn) { micBtn.classList.add('recording'); micBtn.textContent = '⏹'; }
    setAvatarState('listening');
    pendingUserBubble = addBubble('user', '🎙 transcrevendo…');
    scrollBottom();
  } catch(e) {
    alert('Microfone não disponível: ' + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder) mediaRecorder.stop();
  isRecording = false;
  if (micBtn) {
    micBtn.classList.remove('recording');
    micBtn.classList.add('processing');
    micBtn.textContent  = '⏳';
    micBtn.disabled     = true;
  }
  isProcessing = true;
  setAvatarState('processing');
}

async function sendAudio() {
  if (!currentConvId) await ensureConversation();
  const blob   = new Blob(audioChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  reader.onload = () => {
    const b64 = reader.result.split(',')[1];
    showTyping();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:'audio', audio:b64, conversation_id:currentConvId }));
    } else {
      // FIX: If WS not ready, reconnect and retry once
      connectWS();
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type:'audio', audio:b64, conversation_id:currentConvId }));
        }
      }, 1500);
    }
  };
  reader.readAsDataURL(blob);
}

// ── Bubbles ────────────────────────────────────────────────────────
let currentBotWrap   = null;
let currentBotBubble = null;
let botBuffer        = '';

function addBubble(role, text) {
  const wrap = document.createElement('div');
  wrap.className = 'vbubble-wrap';

  const label = document.createElement('div');
  label.className = 'vbubble-label' + (role === 'user' ? ' right' : '');
  label.textContent = role === 'user' ? 'Você' : 'Teacher Tati';

  const bub = document.createElement('div');
  bub.className = 'vbubble ' + role;
  bub.innerHTML = formatMarkdown(text);

  wrap.appendChild(label);
  wrap.appendChild(bub);
  history.insertBefore(wrap, vtyping);

  const s = getSettings();
  if (role === 'bot' && s.wordTooltip !== false && window.WordTooltip) WordTooltip.makeClickable(wrap);

  scrollBottom();
  return wrap;
}

function startBotBubble() {
  botBuffer = '';
  const wrap = document.createElement('div');
  wrap.className = 'vbubble-wrap';
  const label = document.createElement('div');
  label.className = 'vbubble-label';
  label.textContent = 'Teacher Tati';
  const bub = document.createElement('div');
  bub.className = 'vbubble bot';
  wrap.appendChild(label);
  wrap.appendChild(bub);
  history.insertBefore(wrap, vtyping);
  currentBotWrap   = wrap;
  currentBotBubble = bub;
  scrollBottom();
}

function appendBotToken(token) {
  botBuffer += token;
  if (currentBotBubble) { currentBotBubble.innerHTML = formatMarkdown(botBuffer); scrollBottom(); }
}

function finalizeBotBubble() {
  const s = getSettings();
  if (currentBotWrap && s.wordTooltip !== false && window.WordTooltip) {
    WordTooltip.makeClickable(currentBotWrap);
  }
  if (currentBotWrap) {
    const audioRow = document.createElement('div');
    audioRow.className = 'vbubble-audio msg-audio-controls';
    audioRow.id = 'bot-audio-' + Date.now();
    currentBotWrap.appendChild(audioRow);
  }
  currentBotBubble = null;
  currentBotWrap   = null;
  botBuffer        = '';
  isProcessing     = false;
  if (micBtn) {
    micBtn.disabled  = false;
    micBtn.classList.remove('processing');
    micBtn.textContent = '🎤';
  }
}

// ── Audio playback ─────────────────────────────────────────────────
function playAudio(b64) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const s     = getSettings();
  const speed = parseFloat(s.defaultSpeed || (vacSpd ? vacSpd.value : '1') || '1');
  const audio = new Audio('data:audio/mp3;base64,' + b64);
  audio.volume       = vacVol ? parseFloat(vacVol.value) : 1;
  audio.playbackRate = speed;
  currentAudio       = audio;

  setAvatarState('speaking');
  if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.stop') : '⏹ Parar';

  audio.onended = () => {
    currentAudio = null;
    setAvatarState('idle');
    if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.play') : '▶ Ouvir';
  };
  audio.onerror = () => {
    currentAudio = null;
    setAvatarState('idle');
    if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.play') : '▶ Ouvir';
  };
  audio.play().catch(() => {
    setAvatarState('idle');
    if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.play') : '▶ Ouvir';
  });

  // Attach controls to last bubble's audio row
  const rows = document.querySelectorAll('.vbubble-audio');
  if (rows.length) {
    const lastRow = rows[rows.length - 1];
    lastRow.style.display = 'flex';
    attachBubbleAudio(lastRow, b64);
  }
}

function attachBubbleAudio(row, b64) {
  const s = getSettings();
  const defaultSpeed = s.defaultSpeed || '1';
  row.innerHTML = `
    <button class="btn-tts-play" title="Play/Pause">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </button>
    <button class="btn-tts-rewind" title="Voltar 5s">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg>
    </button>
    <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="${vacVol ? vacVol.value : 1}">
    <select class="msg-spd-select">
      <option value="0.75">0.75×</option>
      <option value="1" ${defaultSpeed === '1' ? 'selected' : ''}>1×</option>
      <option value="1.25" ${defaultSpeed === '1.25' ? 'selected' : ''}>1.25×</option>
      <option value="1.5" ${defaultSpeed === '1.5' ? 'selected' : ''}>1.5×</option>
      <option value="2" ${defaultSpeed === '2' ? 'selected' : ''}>2×</option>
    </select>
  `;

  const playB = row.querySelector('.btn-tts-play');
  const rewB  = row.querySelector('.btn-tts-rewind');
  const volS  = row.querySelector('.msg-vol-slider');
  const spdS  = row.querySelector('.msg-spd-select');
  let bubAudio = currentAudio;

  function updateIcon(playing) {
    if (!playB) return;
    playB.innerHTML = playing
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  }

  if (bubAudio) {
    bubAudio.addEventListener('ended', () => updateIcon(false));
    bubAudio.addEventListener('pause', () => updateIcon(false));
    bubAudio.addEventListener('play',  () => updateIcon(true));
  }

  if (playB) playB.onclick = () => {
    if (!bubAudio || bubAudio.ended) {
      bubAudio = new Audio('data:audio/mp3;base64,' + b64);
      bubAudio.volume = parseFloat(volS.value);
      bubAudio.playbackRate = parseFloat(spdS.value);
      bubAudio.addEventListener('ended', () => updateIcon(false));
      currentAudio = bubAudio;
    }
    if (bubAudio.paused) {
      if (currentAudio && currentAudio !== bubAudio) currentAudio.pause();
      bubAudio.play(); updateIcon(true); setAvatarState('speaking');
      if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.stop') : '⏹ Parar';
      bubAudio.onended = () => {
        setAvatarState('idle');
        if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.play') : '▶ Ouvir';
        updateIcon(false);
      };
    } else {
      bubAudio.pause(); updateIcon(false); setAvatarState('idle');
      if (vacPlayBtn) vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.play') : '▶ Ouvir';
    }
  };
  if (rewB)  rewB.onclick  = () => { if (bubAudio) bubAudio.currentTime = Math.max(0, bubAudio.currentTime - 5); };
  if (volS)  volS.oninput  = () => { if (bubAudio) bubAudio.volume = parseFloat(volS.value); };
  if (spdS)  spdS.onchange = () => { if (bubAudio) bubAudio.playbackRate = parseFloat(spdS.value); };
}

// ── Global audio controls ──────────────────────────────────────────
if (vacPlayBtn) {
  vacPlayBtn.addEventListener('click', () => {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      vacPlayBtn.textContent = (typeof t === 'function') ? t('voice.play') : '▶ Ouvir';
      setAvatarState('idle');
    } else if (lastAudioB64) {
      playAudio(lastAudioB64);
    }
  });
}

if (vacRewBtn) {
  vacRewBtn.addEventListener('click', () => {
    if (currentAudio) currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 5);
  });
}

if (vacVol) {
  vacVol.addEventListener('input', () => {
    if (vacVolVal) vacVolVal.textContent = Math.round(vacVol.value * 100) + '%';
    if (currentAudio) currentAudio.volume = parseFloat(vacVol.value);
  });
}

if (vacSpd) {
  vacSpd.addEventListener('input', () => {
    if (vacSpdVal) vacSpdVal.textContent = parseFloat(vacSpd.value).toFixed(1) + '×';
    if (currentAudio) currentAudio.playbackRate = parseFloat(vacSpd.value);
  });
}

// ── Typing indicator ───────────────────────────────────────────────
function showTyping()  { if (vtyping) { vtyping.style.display = 'flex'; scrollBottom(); } }
function hideTyping()  { if (vtyping) vtyping.style.display = 'none'; }
function scrollBottom() { if (history) history.scrollTop = history.scrollHeight; }

function formatMarkdown(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

// ── Apply i18n to static elements ─────────────────────────────────
function applyVoiceI18n() {
  if (typeof I18n === 'undefined') return;
  if (vacPlayBtn) vacPlayBtn.textContent = t('voice.play');
  if (vacRewBtn)  vacRewBtn.textContent  = t('voice.rewind');
  if (micHint)    micHint.textContent    = t('voice.tap_speak');
  if (statusText) statusText.textContent = t('voice.online');
  I18n.applyToDOM();
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyVoiceI18n();
  // Apply i18n when language changes
  window.addEventListener('langchange', applyVoiceI18n);
});

connectWS();