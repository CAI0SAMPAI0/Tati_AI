// js/voice.js
const API    = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000';

// ── Auth guard ─────────────────────────────────────────────────────
const token  = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
if (!token || !userRaw) { window.location.href = '/'; }

// ── Theme ──────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}
document.getElementById('theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';

// ── State ──────────────────────────────────────────────────────────
let ws            = null;
let currentConvId = null;
let isRecording   = false;
let isProcessing  = false;
let mediaRecorder = null;
let audioChunks   = [];
let currentAudio  = null;
let lastAudioB64  = null;

// bolha de usuário pendente (criada ao iniciar gravação,
// preenchida com o texto transcrito quando o servidor responde)
let pendingUserBubble = null;

// ── DOM refs ───────────────────────────────────────────────────────
const avatarWrap = document.getElementById('avatar-wrap');
const statusText = document.getElementById('status-text');
const micBtn     = document.getElementById('mic-btn');
const micHint    = document.getElementById('mic-hint');
const history    = document.getElementById('voice-history');
const vtyping    = document.getElementById('vtyping');
const transcEl   = document.getElementById('voice-transcription'); // mantido mas oculto via CSS

// Audio controls
const vacPlayBtn = document.getElementById('vac-play-btn');
const vacRewBtn  = document.getElementById('vac-rewind-btn');
const vacVol     = document.getElementById('vac-vol');
const vacVolVal  = document.getElementById('vac-vol-val');
const vacSpd     = document.getElementById('vac-spd');
const vacSpdVal  = document.getElementById('vac-spd-val');

// ── Avatar states ──────────────────────────────────────────────────
function setAvatarState(state) {
  avatarWrap.className = 'avatar-wrap ' + state;
  switch (state) {
    case 'listening':
      statusText.textContent = '🎙 Ouvindo…';
      micHint.textContent    = 'Toque para parar';
      break;
    case 'processing':
      statusText.textContent = '⏳ Processando…';
      micHint.textContent    = 'Aguarde…';
      break;
    case 'speaking':
      statusText.textContent = '🗣 Falando…';
      micHint.textContent    = 'Toque para falar';
      break;
    default:
      statusText.textContent = 'Online';
      micHint.textContent    = 'Toque para falar';
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
  setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type:'ping'})); }, 20000);
}

function handleWSMessage(msg) {
  switch (msg.type) {
    case 'pong': break;

    case 'transcription':
      // FIX: preenche a bolha do usuário que foi criada ao iniciar a gravação
      if (pendingUserBubble) {
        const bub = pendingUserBubble.querySelector('.vbubble.user');
        if (bub) bub.textContent = msg.text;
        pendingUserBubble = null;
      } else {
        // fallback: cria bolha nova caso não haja pendente
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
      isProcessing = false;
      micBtn.disabled = false;
      micBtn.classList.remove('processing');
      micBtn.textContent = '🎤';
      addBubble('bot', '⚠️ ' + (msg.detail || 'Erro'));
      break;
  }
}

async function ensureConversation() {
  if (currentConvId) return;
  try {
    const res = await fetch(`${API}/chat/conversations`, { headers:{ Authorization:`Bearer ${token}` } });
    if (res.ok) {
      const convs = await res.json();
      if (convs.length) { currentConvId = convs[0].id; return; }
    }
    const res2 = await fetch(`${API}/chat/conversations`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ title:'Modo Voz' })
    });
    const conv = await res2.json();
    currentConvId = conv.id;
  } catch(e) { console.error(e); }
}

// ── Mic ────────────────────────────────────────────────────────────
micBtn.addEventListener('click', async () => {
  if (isProcessing) return;
  if (isRecording) {
    stopRecording();
  } else {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; setAvatarState('idle'); }
    await startRecording();
  }
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = sendAudio;
    mediaRecorder.start();
    isRecording = true;
    micBtn.classList.add('recording');
    micBtn.textContent = '⏹';
    setAvatarState('listening');

    // FIX: cria a bolha do usuário imediatamente com placeholder
    // será preenchida com o texto real quando a transcrição chegar
    pendingUserBubble = addBubble('user', '🎙 transcrevendo…');
    scrollBottom();
  } catch(e) {
    alert('Microfone não disponível: ' + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder) mediaRecorder.stop();
  isRecording = false;
  micBtn.classList.remove('recording');
  micBtn.classList.add('processing');
  micBtn.textContent = '⏳';
  micBtn.disabled = true;
  isProcessing = true;
  setAvatarState('processing');
}

async function sendAudio() {
  if (!currentConvId) await ensureConversation();
  const blob   = new Blob(audioChunks, { type:'audio/webm' });
  const reader = new FileReader();
  reader.onload = () => {
    const b64 = reader.result.split(',')[1];
    showTyping();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:'audio', audio:b64, conversation_id: currentConvId }));
    }
  };
  reader.readAsDataURL(blob);
}

// ── Bubbles ────────────────────────────────────────────────────────
let currentBotWrap   = null;
let currentBotBubble = null;
let botBuffer        = '';

// Retorna o wrap criado (para permitir referência futura)
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

  if (role === 'bot' && window.WordTooltip) WordTooltip.makeClickable(wrap);

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
  if (currentBotBubble) {
    currentBotBubble.innerHTML = formatMarkdown(botBuffer);
    scrollBottom();
  }
}

function finalizeBotBubble() {
  if (currentBotBubble && window.WordTooltip) {
    WordTooltip.makeClickable(currentBotWrap);
  }

  // Adiciona controles de áudio sob a bolha
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
  micBtn.disabled  = false;
  micBtn.classList.remove('processing');
  micBtn.textContent = '🎤';
}

// ── Audio playback ─────────────────────────────────────────────────
function playAudio(b64) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const audio = new Audio('data:audio/mp3;base64,' + b64);
  audio.volume       = parseFloat(vacVol.value);
  audio.playbackRate = parseFloat(vacSpd.value);
  currentAudio = audio;

  setAvatarState('speaking');
  vacPlayBtn.textContent = '⏹ Parar';

  audio.onended = () => { currentAudio = null; setAvatarState('idle'); vacPlayBtn.textContent = '▶ Ouvir'; };
  audio.onerror = () => { currentAudio = null; setAvatarState('idle'); vacPlayBtn.textContent = '▶ Ouvir'; };

  audio.play().catch(() => { setAvatarState('idle'); vacPlayBtn.textContent = '▶ Ouvir'; });

  // Anexa controles à última bolha de áudio
  const rows = document.querySelectorAll('.vbubble-audio');
  if (rows.length) {
    const lastRow = rows[rows.length - 1];
    lastRow.style.display = 'flex';
    attachBubbleAudio(lastRow, b64);
  }
}

function attachBubbleAudio(row, b64) {
  row.innerHTML = `
    <button class="btn-tts-play" title="Play/Pause">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </button>
    <button class="btn-tts-rewind" title="Voltar 5s">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg>
    </button>
    <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="${vacVol.value}">
    <select class="msg-spd-select">
      <option value="0.75">0.75×</option>
      <option value="1" ${vacSpd.value === '1' ? 'selected' : ''}>1×</option>
      <option value="1.25">1.25×</option>
      <option value="1.5">1.5×</option>
      <option value="2">2×</option>
    </select>
  `;

  const playB = row.querySelector('.btn-tts-play');
  const rewB  = row.querySelector('.btn-tts-rewind');
  const volS  = row.querySelector('.msg-vol-slider');
  const spdS  = row.querySelector('.msg-spd-select');

  let bubAudio = currentAudio;

  function updateIcon(playing) {
    playB.innerHTML = playing
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  }

  if (bubAudio) {
    bubAudio.addEventListener('ended', () => updateIcon(false));
    bubAudio.addEventListener('pause', () => updateIcon(false));
    bubAudio.addEventListener('play',  () => updateIcon(true));
  }

  playB.onclick = () => {
    if (!bubAudio || bubAudio.ended) {
      bubAudio = new Audio('data:audio/mp3;base64,' + b64);
      bubAudio.volume = parseFloat(volS.value);
      bubAudio.playbackRate = parseFloat(spdS.value);
      bubAudio.addEventListener('ended', () => updateIcon(false));
      currentAudio = bubAudio;
    }
    if (bubAudio.paused) {
      if (currentAudio && currentAudio !== bubAudio) { currentAudio.pause(); }
      bubAudio.play(); updateIcon(true); setAvatarState('speaking');
      vacPlayBtn.textContent = '⏹ Parar';
      bubAudio.onended = () => { setAvatarState('idle'); vacPlayBtn.textContent = '▶ Ouvir'; updateIcon(false); };
    } else {
      bubAudio.pause(); updateIcon(false); setAvatarState('idle');
      vacPlayBtn.textContent = '▶ Ouvir';
    }
  };

  rewB.onclick = () => { if (bubAudio) bubAudio.currentTime = Math.max(0, bubAudio.currentTime - 5); };
  volS.oninput = () => { if (bubAudio) bubAudio.volume = parseFloat(volS.value); };
  spdS.onchange = () => { if (bubAudio) bubAudio.playbackRate = parseFloat(spdS.value); };
}

// ── Global audio controls ──────────────────────────────────────────
vacPlayBtn.addEventListener('click', () => {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    vacPlayBtn.textContent = '▶ Ouvir';
    setAvatarState('idle');
  } else if (lastAudioB64) {
    playAudio(lastAudioB64);
  }
});

vacRewBtn.addEventListener('click', () => {
  if (currentAudio) currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 5);
});

vacVol.addEventListener('input', () => {
  vacVolVal.textContent = Math.round(vacVol.value * 100) + '%';
  if (currentAudio) currentAudio.volume = parseFloat(vacVol.value);
});

vacSpd.addEventListener('input', () => {
  vacSpdVal.textContent = parseFloat(vacSpd.value).toFixed(1) + '×';
  if (currentAudio) currentAudio.playbackRate = parseFloat(vacSpd.value);
});

// ── Typing indicator ───────────────────────────────────────────────
function showTyping() { vtyping.style.display = 'flex'; scrollBottom(); }
function hideTyping() { vtyping.style.display = 'none'; }

function scrollBottom() { history.scrollTop = history.scrollHeight; }

// ── Markdown ───────────────────────────────────────────────────────
function formatMarkdown(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

// ── Init ───────────────────────────────────────────────────────────
connectWS();