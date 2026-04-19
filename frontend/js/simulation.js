if (!requireAuth()) throw new Error('Unauthenticated');

const API = API_BASE; // Usa a constante do api.js
const user = getUser(); // Usa helper do api.js
const token = getToken(); // Usa helper do api.js

let scenarios = [];
let currentScenario = null;
let simMessages = [];
let simConversationId = null;
let simMode = 'text'; // text, voice, both
let simVoiceMode = 'text'; // current active mode in modal
let simMediaRecorder = null;
let simAudioChunks = [];
let simIsRecording = false;
let simCurrentAudio = null; // Rastrear áudio atual para parar ao sair

// Para áudio ao sair da página
window.addEventListener('beforeunload', stopAllSimAudio);

window.addEventListener('DOMContentLoaded', () => {
    loadTopbarUser();
    loadScenarios();
    const params = new URLSearchParams(window.location.search);
    const scenarioId = params.get('id');
    if (scenarioId) {
        const waitForScenarios = setInterval(() => {
            if (scenarios.length > 0) {
                clearInterval(waitForScenarios);
                openScenario(scenarioId);
            }
        }, 100);
        setTimeout(() => clearInterval(waitForScenarios), 5000);
    }
});

async function loadTopbarUser() {
    const avatarEl = document.getElementById('topbar-avatar');
    const usernameEl = document.getElementById('topbar-username');
    
    if (avatarEl) {
        const avatarUrl = user.avatar_url || user.profile?.avatar_url;
        if (avatarUrl) {
            avatarEl.innerHTML = `<img src="${avatarUrl}" alt="">`;
        } else {
            avatarEl.textContent = (user.name || user.username || '?').slice(0, 2).toUpperCase();
        }
    }
    if (usernameEl) {
        usernameEl.textContent = user.name || user.username || '...';
    }
}

function stopAllSimAudio() {
    if (simCurrentAudio) {
        simCurrentAudio.pause();
        simCurrentAudio = null;
    }
    stopSimRecording();
}

function setSimMode(mode) {
    simMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
}

async function loadScenarios() {
    try {
        const res = await apiGet('/simulation/scenarios');
        // A API retorna array direto, não um objeto com chave scenarios
        scenarios = Array.isArray(res) ? res : (res.scenarios || []);
        renderScenarios();
    } catch (e) {
        console.error('Erro ao carregar cenários:', e);
    }
}

const SIM_KEY_MAP = {
  'Check-in no Aeroporto': 'airport_checkin',
  'Entrevista de Emprego': 'job_interview',
  'Fazendo Compras':       'shopping',
  'No Aeroporto':          'at_airport',
  'No Hotel':              'at_hotel',
  'No Médico':             'at_doctor',
  'No Restaurante':        'at_restaurant',
  'Pedido no Restaurante': 'restaurant_order'
};

function renderScenarios() {
    const container = document.getElementById('scenarios-grid');
    if (!container) return;
    
    if (scenarios.length === 0) {
        container.innerHTML = `
            <div class="sim-loading">
                <i class="fa-solid fa-exclamation-circle"></i>
                <p>${t('act.sim_none')}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = scenarios.map(s => {
        const key = SIM_KEY_MAP[s.name];
        const title = key ? t(`sim.title_${key}`) : s.name;
        const desc = key ? t(`sim.desc_${key}`) : s.description;

        return `
        <div class="scenario-card" onclick="openScenario('${s.id}')">
            <div class="scenario-icon">${s.icon}</div>
            <div class="scenario-name">${title}</div>
            <div class="scenario-desc">${desc}</div>
            <span class="scenario-difficulty ${s.difficulty}">${getDifficultyLabel(s.difficulty)}</span>
        </div>
        `;
    }).join('');
}

function getDifficultyLabel(diff) {
    const key = diff?.toLowerCase().replace('-', '_');
    return t(`level.${key}`) || diff;
}

function startRandomSimulation() {
    if (scenarios.length === 0) return;
    const random = scenarios[Math.floor(Math.random() * scenarios.length)];
    openScenario(random.id);
}

async function openScenario(scenarioId) {
    currentScenario = scenarios.find(s => s.id === scenarioId);
    if (!currentScenario) return;
    
    simMessages = [];
    simConversationId = null;
    simVoiceMode = simMode === 'both' ? 'text' : simMode;
    
    const key = SIM_KEY_MAP[currentScenario.name];
    document.getElementById('sim-icon').textContent = currentScenario.icon;
    document.getElementById('sim-title').textContent = key ? t(`sim.title_${key}`) : currentScenario.name;
    document.getElementById('sim-diff').textContent = getDifficultyLabel(currentScenario.difficulty);
    document.getElementById('sim-diff').className = `sim-diff ${currentScenario.difficulty}`;
    
    // Mostra info do usuário
    const userInfo = document.getElementById('sim-user-info');
    if (userInfo) {
        const avatarEl = userInfo.querySelector('.sim-user-avatar');
        const nameEl = userInfo.querySelector('.sim-user-name');
        if (avatarEl) {
            const avatarUrl = user.avatar_url || user.profile?.avatar_url;
            if (avatarUrl) {
                avatarEl.innerHTML = `<img src="${avatarUrl}" alt="">`;
            } else {
                avatarEl.textContent = (user.name || user.username || '?').slice(0, 2).toUpperCase();
            }
        }
        if (nameEl) {
            nameEl.textContent = user.name || user.username || '';
        }
    }
    
    // Reset UI
    const chatArea = document.getElementById('sim-chat-area');
    chatArea.innerHTML = `
        <div class="sim-welcome">
            <i class="fa-solid fa-comments"></i>
            <p data-i18n="sim.chat_welcome">${t('sim.chat_welcome')}</p>
        </div>
    `;
    
    // Hide input areas
    document.getElementById('sim-input-area').style.display = 'none';
    document.getElementById('sim-voice-area').style.display = 'none';
    
    // Show/hide buttons
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-end').style.display = 'none';
    
    showSimInputMode();
    
    document.getElementById('sim-modal').style.display = 'flex';
}

function updateSimModeUI() {
    const inputArea = document.getElementById('sim-input-area');
    const voiceArea = document.getElementById('sim-voice-area');
    const modeBtn = document.getElementById('btn-sim-mode');
    
    if (simVoiceMode === 'text') {
        inputArea.style.display = 'flex';
        voiceArea.style.display = 'none';
        modeBtn.innerHTML = '<i class="fa-solid fa-keyboard"></i>';
        modeBtn.title = 'Mudar para voz';
    } else {
        inputArea.style.display = 'none';
        voiceArea.style.display = 'flex';
        modeBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        modeBtn.title = 'Mudar para chat';
    }
}

function toggleSimMode() {
    if (simMode === 'text' || simMode === 'voice') return; // Modo fixo
    
    simVoiceMode = simVoiceMode === 'text' ? 'voice' : 'text';
    updateSimModeUI();
}

function closeSimulation() {
    stopAllSimAudio();
    document.getElementById('sim-modal').style.display = 'none';
    currentScenario = null;
    simMessages = [];
}

async function startSimulation() {
    if (!currentScenario) return;
    
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-end').style.display = 'block';
    
    // Cria nova conversa
    try {
        const res = await fetch(`${API}/chat/conversations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: `🎭 ${currentScenario.name}`,
                scenario: currentScenario.id,
                is_simulation: true
            })
        });
        
        if (res.ok) {
            const conv = await res.json();
            simConversationId = conv.id;
        }
    } catch (e) {
        console.error('Erro ao criar conversa:', e);
    }
    
    // Limpa chat
    const chatArea = document.getElementById('sim-chat-area');
    chatArea.innerHTML = '';
    
    // Mostra controles baseados no modo
    showSimInputMode();
    
    // Primeira mensagem do bot com variação aleatória
    addSimMessage('bot', getRandomGreeting());
}

function showSimInputMode() {
    const inputArea = document.getElementById('sim-input-area');
    const voiceArea = document.getElementById('sim-voice-area');
    
    // Esconde ambos primeiro
    inputArea.style.display = 'none';
    voiceArea.style.display = 'none';
    
    // Mostra baseado no modo
    if (simMode === 'text' || simMode === 'both') {
        inputArea.style.display = 'flex';
    }
    if (simMode === 'voice' || simMode === 'both') {
        voiceArea.style.display = 'flex';
    }
    if (simMode === 'both') {
        // No modo ambos, mostra texto por padrão com botão para alternar
        inputArea.style.display = 'flex';
        voiceArea.style.display = 'flex';
    }
}

function endSimulation() {
    if (simMessages.length < 2) {
        closeSimulation();
        return;
    }

    apiPost('/simulation/evaluate', simMessages).then(result => {
        const d = result.data;
        if (d?.score !== undefined) {
            addSimMessage('bot', `\n📊 **Score: ${d.score}/100**\n\n${d.feedback || ''}`);
        }
    }).catch(() => {});

    setTimeout(() => {
        if (confirm('Finalizar simulação?')) {
            closeSimulation();
        }
    }, 500);
}

function getRandomGreeting() {
    // Usa o greeting do banco de dados se existir
    if (currentScenario.greeting) {
        return currentScenario.greeting;
    }

    // Fallback: saudações por slug (quando o banco não tem greeting customizado)
    const greetingsBySlug = {
        'airport': [
            "Good morning! Welcome to JFK Airport. May I see your passport and ticket, please?",
            "Hello! Checking in today? Where are you flying to?",
            "Hi there! Do you have any bags to check, or just carry-on?",
        ],
        'restaurant': [
            "Good evening! Welcome to Mario's Restaurant. Can I get you started with something to drink?",
            "Hi! My name is Sarah and I'll be your server tonight. Are you ready to order?",
            "Welcome! We have a special today: grilled salmon with roasted vegetables. Sounds good?",
        ],
        'doctor': [
            "Hi, I'm Dr. Smith. What brings you in today?",
            "Good morning! How have you been feeling? Any symptoms I should know about?",
            "Hello! Let's start with your vitals. Have you had any headaches or fever?",
        ],
        'job_interview': [
            "Good morning! Thanks for coming in. Tell me a bit about yourself.",
            "Hi! I'm David, the hiring manager. What interests you about this position?",
            "Welcome! Let's dive right in. What's your greatest strength?",
        ],
        'shopping': [
            "Hi! Welcome to our store. Looking for anything specific?",
            "Hey there! We have a sale going on. Can I help you find a size?",
            "Hello! Let me know if you want to try anything on.",
        ],
        'hotel': [
            "Good afternoon! Welcome to the Oceanview Hotel. Checking in?",
            "Hi! Do you have a reservation under your name?",
            "Welcome! We have a room ready for you. Would you like breakfast included?",
        ]
    };

    const scenarioSlug = (currentScenario.slug || currentScenario.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const scenarioGreetings = greetingsBySlug[scenarioSlug] || ["Hello! Let's practice English together."];
    return scenarioGreetings[Math.floor(Math.random() * scenarioGreetings.length)];
}

// ── Chat Mode ─────────────────────────────────────────────────────────────────

async function sendSimMessage() {
    const input = document.getElementById('sim-text-input');
    if (!input || !input.value.trim()) return;
    sendSimMessageText(input.value.trim());
    input.value = '';
}

async function sendSimMessageText(text) {
    addSimMessage('user', text);
    showSimTyping(true);
    
    try {
        const res = await fetch(`${API}/simulation/message`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: text,
                conversation_id: simConversationId,
                scenario: currentScenario.id
            })
        });
        
        showSimTyping(false);
        
        if (res.ok) {
            const data = await res.json();
            if (data.reply) {
                const msgEl = addSimMessage('bot', data.reply);
                
                // Reproduz áudio TTS se disponível
                if (data.audio_b64) {
                    _attachAudioToSimMsg(msgEl, data.audio_b64);
                }
            } else {
                addSimMessage('bot', `(Erro: ${data.error || 'Resposta vazia'})`);
            }
        } else {
            addSimMessage('bot', '(Erro ao processar resposta. Tente novamente.)');
        }
    } catch (e) {
        console.error('Erro na simulação:', e);
        showSimTyping(false);
        addSimMessage('bot', '(Erro de conexão)');
    }
}

function showSimTyping(show) {
    const ti = document.getElementById('sim-typing');
    if (ti) {
        ti.style.display = show ? 'flex' : 'none';
        if (show) {
            const chatArea = document.getElementById('sim-chat-area');
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }
}

function _attachAudioToSimMsg(msgEl, b64) {
    if (!msgEl) return;
    const bubble = msgEl.querySelector('.msg-bubble');
    if (!bubble) return;
    
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    bubble.appendChild(meta);
    
    _buildAudioControls(meta, b64);
}

function _buildAudioControls(meta, b64) {
    const s = getSettings();
    const defaultSpeed = parseFloat(s.defaultSpeed || '1');

    const controls = document.createElement('div');
    controls.className = 'msg-audio-controls';
    controls.innerHTML = `
      <button class="btn-tts-play" title="Play">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <div class="msg-vol-control">
        <input type="range" class="msg-vol-slider" min="0" max="1" step="0.05" value="1" title="Volume">
      </div>
      <div class="msg-spd-control">
        <select class="msg-spd-select">
          <option value="0.75">0.75×</option>
          <option value="1" ${defaultSpeed === 1 ? 'selected' : ''}>1×</option>
          <option value="1.25" ${defaultSpeed === 1.25 ? 'selected' : ''}>1.25×</option>
          <option value="1.5" ${defaultSpeed === 1.5 ? 'selected' : ''}>1.5×</option>
        </select>
      </div>`;
    meta.appendChild(controls);

    const playBtn = controls.querySelector('.btn-tts-play');
    const volSlider = controls.querySelector('.msg-vol-slider');
    const spdSelect = controls.querySelector('.msg-spd-select');

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
      if (simCurrentAudio && simCurrentAudio !== audio) {
        simCurrentAudio.pause();
      }
      simCurrentAudio = audio;
      audio.play().catch(() => { });
    };

    if (s.autoPlay === true || s.autoPlay === 'true') {
        setTimeout(playThis, 300);
    }

    playBtn?.addEventListener('click', e => { 
        e.stopPropagation(); 
        audio.paused ? playThis() : audio.pause(); 
    });
    
    volSlider?.addEventListener('input', e => { 
        e.stopPropagation(); 
        audio.volume = parseFloat(volSlider.value); 
    });
    
    spdSelect?.addEventListener('change', e => { 
        e.stopPropagation(); 
        audio.playbackRate = parseFloat(spdSelect.value); 
    });
    
    audio.addEventListener('ended', () => setPlayIcon(false));
    audio.addEventListener('pause', () => setPlayIcon(false));
    audio.addEventListener('play', () => setPlayIcon(true));
}

// ── Voice Mode ────────────────────────────────────────────────────────────────

async function toggleSimRecording() {
    const btn = document.getElementById('btn-sim-mic');
    if (simIsRecording) {
        stopSimRecording();
    } else {
        startSimRecording(btn);
    }
}

async function toggleSimRecordingInline() {
    const btn = document.getElementById('btn-sim-mic-inline');
    if (simIsRecording) {
        stopSimRecording();
    } else {
        startSimRecording(btn);
    }
}

async function startSimRecording(btn) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        simMediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        simAudioChunks = [];
        
        simMediaRecorder.ondataavailable = e => simAudioChunks.push(e.data);
        simMediaRecorder.onstop = sendSimAudio;
        
        simMediaRecorder.start();
        simIsRecording = true;
        
        if (btn) btn.classList.add('recording');
    } catch (e) {
        showToast('Microfone não disponível: ' + e.message, 'error');
    }
}

function stopSimRecording() {
    if (simMediaRecorder && simIsRecording) {
        simMediaRecorder.stop();
        simIsRecording = false;
        
        document.querySelectorAll('.btn-sim-mic').forEach(b => b.classList.remove('recording'));
    }
}

async function sendSimAudio() {
    if (!simAudioChunks.length) return;
    
    const blob = new Blob(simAudioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    
    reader.onload = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        showSimTyping(true);
        
        // Transcreve usando endpoint dedicado
        try {
            const res = await fetch(`${API}/simulation/transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ audio: base64Audio })
            });
            
            if (res.ok) {
                const data = await res.json();
                const text = data.text || '[Não foi possível transcrever]';
                if (text) {
                    // addSimMessage('user', ...) já foi removido daqui para não duplicar se chamarmos sendSimMessageText
                    // Envia texto transcrito para a simulação
                    await sendSimMessageText(text);
                } else {
                    showSimTyping(false);
                    addSimMessage('bot', '(Não consegui entender o áudio)');
                }
            } else {
                showSimTyping(false);
                addSimMessage('bot', '(Erro ao processar áudio)');
            }
        } catch (e) {
            console.error('Erro ao enviar áudio:', e);
            showSimTyping(false);
            addSimMessage('bot', '(Erro de conexão no áudio)');
        }
    };
    
    reader.readAsDataURL(blob);
}

// ── Feedback Modal ─────────────────────────────────────────────────────────────

function openFeedbackModal() {
    document.getElementById('feedback-modal').classList.add('active');
    document.getElementById('feedback-modal').style.display = 'flex';
    document.getElementById('feedback-category').value = 'feedback';
    document.getElementById('feedback-message').value = '';
    hideFeedbackStatus();
}

function closeFeedbackModal() {
    document.getElementById('feedback-modal').classList.remove('active');
    document.getElementById('feedback-modal').style.display = 'none';
}

function hideFeedbackStatus() {
    const status = document.getElementById('feedback-status');
    if (status) {
        status.style.display = 'none';
        status.className = 'feedback-status';
    }
}

function showFeedbackStatus(message, isSuccess) {
    const status = document.getElementById('feedback-status');
    if (!status) return;

    status.textContent = message;
    status.className = 'feedback-status ' + (isSuccess ? 'success' : 'error');
    status.style.display = 'block';
}

async function sendFeedback() {
    const category = document.getElementById('feedback-category').value;
    const message = document.getElementById('feedback-message').value.trim();

    if (!message) {
        showFeedbackStatus('Por favor, escreva uma mensagem.', false);
        return;
    }

    const sendBtn = document.querySelector('.btn-feedback-send');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Enviando...'; }

    try {
        const res = await apiPost('/feedback/send', { category, message });

        if (res.data?.success) {
            showFeedbackStatus('Feedback enviado com sucesso!', true);
            setTimeout(() => {
                closeFeedbackModal();
            }, 1500);
        } else {
            showFeedbackStatus(res.data?.message || 'Erro ao enviar feedback.', false);
        }
    } catch (e) {
        console.error('Erro ao enviar feedback:', e);
        showFeedbackStatus('Erro de conexão. Tente novamente.', false);
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Enviar Feedback'; }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formata texto com Markdown básico para HTML
 * Suporta: **negrito**, *itálico*, `código`, listas, quebras de linha
 */
function formatMarkdown(content) {
    if (!content) return '';

    let html = content
        // Escapa HTML básico para segurança
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Negrito: **texto**
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Itálico: *texto*
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Código inline: `texto`
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Quebras de linha
        .replace(/\n/g, '<br>');

    return html;
}

/**
 * Obtém configurações do usuário armazenadas em localStorage
 */
function getSettings() {
    try {
        const stored = localStorage.getItem('tati_settings');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Erro ao carregar settings:', e);
    }
    // Valores padrão
    return {
        autoPlay: false,
        defaultSpeed: '1'
    };
}

function addSimMessage(role, content) {
    const chatArea = document.getElementById('sim-chat-area');
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `sim-message ${role}`;
    
    let avatarHtml = '';
    if (role === 'bot') {
        avatarHtml = `<div class="msg-avatar bot"><img src="/assets/images/tati_logo.jpg" alt="Tati"></div>`;
    } else {
        const avatarUrl = user.avatar_url || user.profile?.avatar_url;
        const initials = (user.name || user.username || '?').slice(0, 2).toUpperCase();
        avatarHtml = `<div class="msg-avatar user">${avatarUrl ? `<img src="${avatarUrl}" alt="">` : initials}</div>`;
    }
    
    msgDiv.innerHTML = `
        ${avatarHtml}
        <div class="msg-bubble">${formatMarkdown(content)}</div>
    `;
    
    chatArea.appendChild(msgDiv);
    
    simMessages.push({ role, content });
    
    // Scroll to bottom
    chatArea.scrollTop = chatArea.scrollHeight;
    
    return msgDiv;
}
