// ── Auth guard ─────────────────────────────────────────────────────
if (!requireAuth()) { window.location.href = '/index.html'; }

const user = getUser();
const token = getToken();

// ── Estado global ──────────────────────────────────────────────────
let ws               = null;
let currentConvId    = null; // Será definido em ensureConversation
let isRecording      = false;
let isProcessing     = false;
let mediaRecorder    = null;
let audioChunks      = [];
let currentAudio     = null;
let lastAudioB64     = null;
let pendingUserBubble = null;

// URL params
const urlParams    = new URLSearchParams(window.location.search);
const urlConvId    = urlParams.get('conv_id');
const isNewConv    = urlParams.get('new') === 'true';

// ── Avatar: frames e estado ────────────────────────────────────────
const FRAMES = {
  normal:     '',
  meio:       '',
  bem_aberta: '',
  ouvindo:    '',
  piscando:   '',
  has_frames: false,
};

const VISEME_MAP = {
  'A': 'frame_A',
  'B': 'frame_B',
  'C': 'frame_C',
  'D': 'frame_D',
  'E': 'frame_E',
  'F': 'frame_F',
  'X': 'frame_A'
};

let _avatarState   = 'idle';     // idle | listening | processing | speaking
let _lastFrame     = '';
let _blinkTimer    = null;
let _mouthTimer    = null;
let _audioCtx      = null;
let _analyser      = null;

// ── DOM refs ───────────────────────────────────────────────────────
const avatarImg  = document.getElementById('avatar-img');
const avatarEmoji = document.getElementById('avatar-emoji');
const avatarWrap = document.getElementById('avatar-wrap');
const statusText = document.getElementById('status-text');
const micBtn     = document.getElementById('mic-btn');
const micHint    = document.getElementById('mic-hint');
const historyEl  = document.getElementById('voice-history');
const vtypingEl  = document.getElementById('vtyping');

const vacPlayBtn = document.getElementById('vac-play-btn');
const vacRewBtn  = document.getElementById('vac-rewind-btn');
const vacVol     = document.getElementById('vac-vol');
const vacVolVal  = document.getElementById('vac-vol-val');
const vacSpd     = document.getElementById('vac-spd');
const vacSpdVal  = document.getElementById('vac-spd-val');

// ══════════════════════════════════════════════════════════════════
// AVATAR — carregamento e controle de frames
// ══════════════════════════════════════════════════════════════════

async function loadAvatarFrames() {
  try {
    const data = await apiGet('/avatar/frames');
    Object.assign(FRAMES, data);

    if (FRAMES.has_frames && FRAMES.normal) {
      _setFrame(FRAMES.normal);
      console.log('[Avatar] Frames carregados com sucesso.');
    } else {
      console.warn('[Avatar] Frames não encontrados — usando fallback emoji.');
      _showEmojiAvatar();
    }
  } catch (e) {
    console.warn('[Avatar] Erro ao carregar frames:', e.message);
    _showEmojiAvatar();
  }
}

function _setFrame(src) {
  if (!src || src === _lastFrame) return;
  _lastFrame = src;

  if (avatarImg && avatarEmoji) {
    avatarImg.src = src;
    avatarImg.style.display   = 'block';
    avatarEmoji.style.display = 'none';
  }
}

function _showEmojiAvatar() {
  if (!avatarImg || !avatarEmoji) return;
  avatarImg.style.display   = 'none';
  avatarEmoji.style.display = 'flex';
}

function _stopAnimations() {
  if (_blinkTimer) { clearTimeout(_blinkTimer); clearInterval(_blinkTimer); _blinkTimer = null; }
  if (_mouthTimer) { clearInterval(_mouthTimer); _mouthTimer = null; }
}

function _enterIdle() {
  _stopAnimations();
  _avatarState = 'idle';

  if (avatarWrap) avatarWrap.className = 'avatar-wrap';
  if (statusText) statusText.textContent = t('voice.online');
  if (micHint)    micHint.textContent = t('voice.tap_speak');

  if (FRAMES.has_frames && FRAMES.normal) _setFrame(FRAMES.normal);

  if (!FRAMES.has_frames) return;

  ;(function scheduleBlink() {
    const delay = 3200 + Math.random() * 2000;
    _blinkTimer = setTimeout(() => {
      if (_avatarState !== 'idle') return;
      _setFrame(FRAMES.piscando || FRAMES.normal);
      setTimeout(() => {
        if (_avatarState !== 'idle') return;
        _setFrame(FRAMES.normal);
        scheduleBlink();
      }, 150);
    }, delay);
  })();
}

function _enterListening() {
  _stopAnimations();
  _avatarState = 'listening';

  if (avatarWrap) avatarWrap.className = 'avatar-wrap listening';
  if (statusText) statusText.textContent = t('voice.listening');
  if (micHint)    micHint.textContent = t('voice.tap_stop');

  if (FRAMES.has_frames) _setFrame(FRAMES.ouvindo || FRAMES.normal);
}

function _enterProcessing() {
  _stopAnimations();
  _avatarState = 'processing';

  if (avatarWrap) avatarWrap.className = 'avatar-wrap processing';
  if (statusText) statusText.textContent = t('voice.processing');
  if (micHint)    micHint.textContent = t('voice.wait');

  if (FRAMES.has_frames) {
    _setFrame(FRAMES.normal);
    let _blink = false;
    _blinkTimer = setInterval(() => {
      if (_avatarState !== 'processing') return;
      _blink = !_blink;
      _setFrame(_blink ? (FRAMES.piscando || FRAMES.normal) : FRAMES.normal);
    }, 2200);
  }
}

function _enterSpeaking(audioElement) {
  _stopAnimations();
  _avatarState = 'speaking';

  if (avatarWrap) avatarWrap.className = 'avatar-wrap speaking';
  if (statusText) statusText.textContent = t('voice.speaking');
  if (micHint)    micHint.textContent = t('voice.tap_speak');

  if (!FRAMES.has_frames) return;

  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 256;
    _analyser.smoothingTimeConstant = 0.2;

    const source = _audioCtx.createMediaElementSource(audioElement);
    source.connect(_analyser);
    _analyser.connect(_audioCtx.destination);

    const freqData = new Uint8Array(_analyser.frequencyBinCount);

    _mouthTimer = setInterval(() => {
      if (_avatarState !== 'speaking' || audioElement.paused) {
        _setFrame(FRAMES.normal);
        return;
      }

      _analyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) sum += freqData[i];
      const avgVolume = sum / freqData.length;

      if (avgVolume < 15) { 
        _setFrame(FRAMES.normal);
      } else if (avgVolume < 70) { 
        _setFrame(FRAMES.meio || FRAMES.frame_C);
      } else { 
        _setFrame(FRAMES.bem_aberta || FRAMES.frame_E);
      }
    }, 50);

  } catch (err) {
    console.warn('[Avatar] Web Audio API falhou, usando fallback cego:', err.message);
    let _f = false;
    _mouthTimer = setInterval(() => {
      if (_avatarState !== 'speaking') return;
      _setFrame(_f ? (FRAMES.meio || FRAMES.frame_C) : (FRAMES.normal || FRAMES.frame_A));
      _f = !_f;
    }, 250);
  }
}

function _onSpeakingEnded() {
  _stopAnimations();
  _analyser = null;
  if (FRAMES.has_frames) _setFrame(FRAMES.normal);
  setTimeout(_enterIdle, 200);
}

// ══════════════════════════════════════════════════════════════════
// WEBSOCKET
// ══════════════════════════════════════════════════════════════════

function connectWS() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
  ws = new WebSocket(`${WS_BASE}/chat/ws`, ["access_token", token]);
  ws.onopen = () => {
    console.log('[Voice WS] conectado');
    ensureConversation();
  };
  ws.onmessage = e => handleWSMessage(JSON.parse(e.data));
  ws.onerror   = e => console.error('[Voice WS]', e);
  ws.onclose   = () => { ws = null; setTimeout(connectWS, 3000); };

  setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
  }, 20000);
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
      _enterProcessing();
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
      _enterIdle();
      isProcessing = false;
      _resetMicBtn();
      addBubble('bot', '⚠️ ' + (msg.detail || 'Erro'));
      break;
  }
}

// ══════════════════════════════════════════════════════════════════
// CONVERSA
// ══════════════════════════════════════════════════════════════════

async function ensureConversation() {
  // 1. Se já temos currentConvId (e não é forçada nova), apenas carrega
  if (currentConvId && !isNewConv) {
    await loadExistingMessages(currentConvId);
    return;
  }

  // 2. Se temos um conv_id na URL e não é "new", usa ele
  if (urlConvId && !isNewConv) {
    currentConvId = urlConvId;
    await loadExistingMessages(currentConvId);
    return;
  }

  // 3. Se é "new", cria uma nova obrigatoriamente
  if (isNewConv) {
    try {
      const { ok, data } = await apiPost('/chat/conversations', { title: 'Voice Mode' });
      if (ok) {
        currentConvId = data.id;
        console.log('[Voice] Nova conversa criada:', currentConvId);
        // Limpa mensagens anteriores do DOM se houver
        const bubbles = historyEl.querySelectorAll('.vbubble-wrap');
        bubbles.forEach(b => b.remove());
      }
    } catch (e) {
      console.error('[Voice] Erro ao criar nova conversa:', e);
    }
    return;
  }

  // 4. Se não tem ID nenhum, tenta buscar a última ou cria
  try {
    const convs = await apiGet('/chat/conversations');
    if (convs.length > 0) {
      currentConvId = convs[0].id;
      await loadExistingMessages(currentConvId);
    } else {
      const { ok, data } = await apiPost('/chat/conversations', { title: 'Voice Mode' });
      if (ok) currentConvId = data.id;
    }
  } catch (e) {
    console.error('[Voice] Erro em ensureConversation:', e);
  }
}

async function loadExistingMessages(convId) {
  try {
    const convs = await apiGet('/chat/conversations');
    const conv  = convs.find(c => c.id === convId);
    if (conv) {
      const titleEl = document.getElementById('voice-conv-title');
      if (titleEl) titleEl.textContent = conv.title || 'Voice Mode';
    }
  } catch (_) {}

  try {
    const msgs = await apiGet(`/chat/conversations/${convId}/messages`);
    
    // Limpa DOM antes de carregar histórico
    const bubbles = historyEl.querySelectorAll('.vbubble-wrap');
    bubbles.forEach(b => b.remove());

    const audioMsgs = [];
    msgs.forEach(m => {
      const wrap = addBubble(m.role === 'user' ? 'user' : 'bot', m.content);
      if (m.role === 'assistant' && m.audio_b64) {
        audioMsgs.push({ wrap, b64: m.audio_b64 });
      }
    });

    requestAnimationFrame(() => {
      audioMsgs.forEach(({ wrap, b64 }) => {
        if (wrap) {
          const audioRow = wrap.querySelector('.vbubble-audio');
          if (audioRow) {
            audioRow.style.display = 'flex';
            _attachBubbleAudio(audioRow, b64);
          }
        }
      });
    });

    scrollBottom();
  } catch (e) {
    console.error('[Voice] loadExistingMessages:', e);
  }
}

// ══════════════════════════════════════════════════════════════════
// MICROFONE
// ══════════════════════════════════════════════════════════════════

if (micBtn) {
  micBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        _onSpeakingEnded();
      }
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
    micBtn.classList.add('recording');
    micBtn.textContent = '⏹';
    _enterListening();

    pendingUserBubble = addBubble('user', '');
    scrollBottom();
  } catch (e) {
    showToast('Microfone não disponível: ' + e.message, 'error');
  }
}

function stopRecording() {
  if (mediaRecorder) mediaRecorder.stop();
  isRecording  = false;
  isProcessing = true;

  micBtn.classList.remove('recording');
  micBtn.classList.add('processing');
  micBtn.textContent  = '⏳';
  micBtn.disabled     = true;

  _enterProcessing();
}

async function sendAudio() {
  if (!currentConvId) {
    await ensureConversation();
  }
  
  // Se mesmo após ensureConversation não temos ID, aborta
  if (!currentConvId) {
    showToast('Erro ao inicializar conversa', 'error');
    _resetMicBtn();
    _enterIdle();
    return;
  }

  const blob   = new Blob(audioChunks, { type: 'audio/webm' });
  const reader = new FileReader();

  reader.onload = () => {
    const b64 = reader.result.split(',')[1];
    showTyping();

    const payload = JSON.stringify({ type: 'audio', audio: b64, conversation_id: currentConvId });

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      connectWS();
      setTimeout(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(payload);
      }, 1500);
    }
  };
  reader.readAsDataURL(blob);
}

function _resetMicBtn() {
  if (!micBtn) return;
  micBtn.disabled  = false;
  micBtn.classList.remove('processing', 'recording');
  micBtn.textContent = '🎤';
}

// ══════════════════════════════════════════════════════════════════
// BOLHAS DE CONVERSA
// ══════════════════════════════════════════════════════════════════

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

  if (role === 'bot') {
    const audioRow = document.createElement('div');
    audioRow.className = 'vbubble-audio';
    audioRow.id = 'bot-audio-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    audioRow.style.display = 'none';
    wrap.appendChild(audioRow);
  }

  historyEl.insertBefore(wrap, vtypingEl);

  const s = getSettings();
  if (role === 'bot' && s.wordTooltip !== false && window.WordTooltip) {
    WordTooltip.makeClickable(wrap);
  }

  scrollBottom();
  return wrap;
}

function startBotBubble() {
  botBuffer = '';
  const wrap  = document.createElement('div');
  wrap.className = 'vbubble-wrap';

  const label = document.createElement('div');
  label.className = 'vbubble-label';
  label.textContent = 'Teacher Tati';

  const bub = document.createElement('div');
  bub.className = 'vbubble bot';

  wrap.appendChild(label);
  wrap.appendChild(bub);

  const audioRow = document.createElement('div');
  audioRow.className = 'vbubble-audio';
  audioRow.id = 'bot-audio-' + Date.now();
  audioRow.style.display = 'none';
  wrap.appendChild(audioRow);

  historyEl.insertBefore(wrap, vtypingEl);

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
  const s = getSettings();
  if (currentBotWrap && s.wordTooltip !== false && window.WordTooltip) {
    WordTooltip.makeClickable(currentBotWrap);
  }

  currentBotBubble = null;
  currentBotWrap   = null;
  botBuffer        = '';
  isProcessing     = false;
  _resetMicBtn();
}

// ══════════════════════════════════════════════════════════════════
// REPRODUÇÃO DE ÁUDIO
// ══════════════════════════════════════════════════════════════════

function playAudio(b64) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  _analyser = null;

  const s     = getSettings();
  const speed = parseFloat(s.defaultSpeed || (vacSpd ? vacSpd.value : '1') || '1');
  const vol   = vacVol ? parseFloat(vacVol.value) : 1;

  const audio = new Audio('data:audio/mp3;base64,' + b64);
  audio.volume       = vol;
  audio.playbackRate = speed;
  currentAudio       = audio;

  if (vacPlayBtn) {
    vacPlayBtn.textContent = t('voice.stop');
  }

  audio.onplay = () => _enterSpeaking(audio);

  audio.onended = () => {
    currentAudio = null;
    if (vacPlayBtn) vacPlayBtn.textContent = t('voice.play');
    _onSpeakingEnded();
  };

  audio.onerror = () => {
    currentAudio = null;
    if (vacPlayBtn) vacPlayBtn.textContent = t('voice.play');
    _enterIdle();
  };

  audio.play().catch(() => {
    currentAudio = null;
    _enterIdle();
  });

  const rows = document.querySelectorAll('.vbubble-audio');
  if (rows.length) {
    const lastRow = rows[rows.length - 1];
    lastRow.style.display = 'flex';
    _attachBubbleAudio(lastRow, b64);
  }
}

function _attachBubbleAudio(row, b64) {
  const s = getSettings();
  const defaultSpeed = s.defaultSpeed || '1';

  row.innerHTML = `
    <button class="btn-tts-play" title="Play/Pause">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>
    </button>
    <button class="btn-tts-rewind" title="Voltar 5s">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 1 0 .49-3.56"/>
      </svg>
    </button>
    <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05"
           value="${vacVol ? vacVol.value : 1}">
    <select class="msg-spd-select">
      <option value="0.75">0.75×</option>
      <option value="1"    ${defaultSpeed === '1'    ? 'selected' : ''}>1×</option>
      <option value="1.25" ${defaultSpeed === '1.25' ? 'selected' : ''}>1.25×</option>
      <option value="1.5"  ${defaultSpeed === '1.5'  ? 'selected' : ''}>1.5×</option>
      <option value="2"    ${defaultSpeed === '2'    ? 'selected' : ''}>2×</option>
    </select>`;

  const playB = row.querySelector('.btn-tts-play');
  const rewB  = row.querySelector('.btn-tts-rewind');
  const volS  = row.querySelector('.msg-vol-slider');
  const spdS  = row.querySelector('.msg-spd-select');
  let bubAudio = currentAudio;

  function updateIcon(playing) {
    if (!playB) return;
    playB.innerHTML = playing
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
           <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
         </svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
           <polygon points="5 3 19 12 5 21 5 3"/>
         </svg>`;
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
      bubAudio.addEventListener('ended', () => { updateIcon(false); _onSpeakingEnded(); });
      currentAudio = bubAudio;
    }
    if (bubAudio.paused) {
      if (currentAudio && currentAudio !== bubAudio) currentAudio.pause();
      bubAudio.play();
      updateIcon(true);
      _enterSpeaking(bubAudio);
      if (vacPlayBtn) vacPlayBtn.textContent = t('voice.stop');
    } else {
      bubAudio.pause();
      updateIcon(false);
      _onSpeakingEnded();
      if (vacPlayBtn) vacPlayBtn.textContent = t('voice.play');
    }
  };

  rewB.onclick  = () => { if (bubAudio) bubAudio.currentTime = Math.max(0, bubAudio.currentTime - 5); };
  volS.oninput  = () => { if (bubAudio) bubAudio.volume = parseFloat(volS.value); };
  spdS.onchange = () => { if (bubAudio) bubAudio.playbackRate = parseFloat(spdS.value); };
}

// ── Controles globais de áudio ─────────────────────────────────────
if (vacPlayBtn) {
  vacPlayBtn.addEventListener('click', () => {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
      vacPlayBtn.textContent = t('voice.play');
      _onSpeakingEnded();
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

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

function showTyping()  { if (vtypingEl) { vtypingEl.style.display = 'flex'; scrollBottom(); } }
function hideTyping()  { if (vtypingEl) vtypingEl.style.display = 'none'; }
function scrollBottom() { if (historyEl) historyEl.scrollTop = historyEl.scrollHeight; }

// ── i18n ───────────────────────────────────────────────────────────
function applyVoiceI18n() {
  if (typeof I18n === 'undefined') return;
  if (vacPlayBtn) vacPlayBtn.textContent = t('voice.play');
  if (vacRewBtn)  vacRewBtn.textContent  = t('voice.rewind');
  if (micHint)    micHint.textContent    = t('voice.tap_speak');
  if (statusText) statusText.textContent = t('voice.online');
  I18n.applyToDOM();
}

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  applyVoiceI18n();
  window.addEventListener('langchange', applyVoiceI18n);
  await loadAvatarFrames();
  _enterIdle();
  connectWS();
});