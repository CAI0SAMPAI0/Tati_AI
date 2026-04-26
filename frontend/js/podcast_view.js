/* podcast_view.js - Tati AI */

let currentPodcastId = null;
let podcastData = null;
let exercises = [];
let selectedOptions = {};
let recognition = null;
let isRecording = false;
let activeVoiceIdx = -1;
let transcriptMode = 'source';
let podcastRecommendations = [];
let uiLang = 'pt-BR';
let triedPodcastIds = new Set();
let isAutoSwitchingUnavailableMedia = false;

const YOUTUBE_UNAVAILABLE_ERROR_CODES = new Set([2, 5, 100, 101, 150]);

const ALLOWED_EMBED_HOSTS = new Set([
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
    'open.spotify.com',
    'w.soundcloud.com',
    'embed.ted.com',
    'www.dailymotion.com'
]);

window.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    currentPodcastId = params.get('id');
    triedPodcastIds = parseTriedPodcastIds(params.get('tried'));
    if (currentPodcastId) triedPodcastIds.add(String(currentPodcastId));
    uiLang = params.get('lang')
        || ((typeof I18n !== 'undefined' && typeof I18n.getLang === 'function')
            ? I18n.getLang()
            : (localStorage.getItem('tati_lang') || 'pt-BR'));
    if (!currentPodcastId) {
        window.location.href = 'activities.html';
        return;
    }

    if (typeof I18n !== 'undefined' && typeof I18n.setLang === 'function' && params.get('lang')) {
        I18n.setLang(uiLang);
    } else if (typeof I18n !== 'undefined') {
        I18n.applyToDOM();
    }

    window.addEventListener('message', handleEmbeddedPlayerMessage);

    await loadPodcastDetails();
    await loadExercises();
    initSpeechRec();
    initRevealBlocks();
});

async function loadPodcastDetails() {
    try {
        const recommendations = await apiGet(`/activities/podcasts/recommendations?lang=${encodeURIComponent(uiLang)}`);
        podcastRecommendations = Array.isArray(recommendations) ? recommendations : [];
        podcastData = podcastRecommendations.length
            ? podcastRecommendations.find((podcast) => podcast.id === currentPodcastId)
            : null;

        if (!podcastData) throw new Error('Podcast not found');

        const titleEl = document.getElementById('p-title');
        const descEl = document.getElementById('p-desc');
        titleEl.textContent = podcastData.title || t('act.podcast_loading');
        descEl.textContent = podcastData.description || t('act.podcast_loading_sub');
        titleEl.removeAttribute('data-i18n');
        descEl.removeAttribute('data-i18n');

        toggleTranscriptVisibility();
        renderPodcastMeta();
        renderMedia();
        if (hasFullTranscript()) renderTranscript();
    } catch (error) {
        console.error(error);
        showToast(t('act.podcast_details_error') || 'Erro ao carregar detalhes do podcast.', 'error');
    }
}

function hasFullTranscript() {
    return Boolean(podcastData?.has_full_transcript)
        && Array.isArray(podcastData?.transcript_segments)
        && podcastData.transcript_segments.length > 0;
}

function toggleTranscriptVisibility() {
    const transcriptCard = document.getElementById('p-transcript-card');
    const contentGrid = document.getElementById('podcast-content-grid');
    if (!transcriptCard || !contentGrid) return;

    const visible = hasFullTranscript();
    transcriptCard.style.display = visible ? '' : 'none';
    contentGrid.classList.toggle('is-single-column', !visible);
}

function renderPodcastMeta() {
    const metaEl = document.getElementById('p-meta');
    const sourceName = escapeHtml(podcastData.source_name || 'Web');
    const level = escapeHtml(podcastData.level || 'A1');
    const duration = escapeHtml(podcastData.duration || '--:--');
    const category = escapeHtml(podcastData.category || 'General');

    const hasTranscript = hasFullTranscript();

    metaEl.innerHTML = `
        <span class="hero-chip is-primary"><i class="fa-solid fa-globe"></i> ${sourceName}</span>
        <span class="hero-chip"><i class="fa-solid fa-signal"></i> ${level}</span>
        <span class="hero-chip"><i class="fa-solid fa-clock"></i> ${duration}</span>
        <span class="hero-chip"><i class="fa-solid fa-tag"></i> ${category}</span>
        ${hasTranscript ? `<span class="hero-chip"><i class="fa-solid fa-language"></i> ${escapeHtml(t('act.translation_ready') || 'Tradução PT-BR')}</span>` : ''}
    `;
}

function sanitizeEmbedUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return null;
        if (!ALLOWED_EMBED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
        return parsed.toString();
    } catch (_) {
        return null;
    }
}

function parseTriedPodcastIds(rawValue) {
    if (!rawValue) return new Set();
    const parsed = String(rawValue)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    return new Set(parsed);
}

function detectEmbedProvider(embedUrl) {
    try {
        const host = new URL(embedUrl).hostname.toLowerCase();
        if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) return 'youtube';
        if (host.includes('vimeo.com')) return 'vimeo';
        return 'other';
    } catch (_) {
        return 'other';
    }
}

function buildEmbedUrl(embedUrl) {
    try {
        const parsed = new URL(embedUrl);
        const provider = detectEmbedProvider(embedUrl);
        if (provider === 'youtube') {
            parsed.searchParams.set('enablejsapi', '1');
            parsed.searchParams.set('origin', window.location.origin);
            parsed.searchParams.set('playsinline', '1');
        }
        return parsed.toString();
    } catch (_) {
        return embedUrl;
    }
}

function nextFallbackPodcast() {
    const candidates = (podcastRecommendations || []).filter((item) => {
        if (!item?.id || String(item.id) === String(currentPodcastId)) return false;
        if (triedPodcastIds.has(String(item.id))) return false;
        return Boolean(sanitizeEmbedUrl(item.embed_url || ''));
    });

    if (!candidates.length) return null;
    const nextVideo = candidates.find((item) => String(item.media_type || '').toLowerCase() !== 'audio');
    return nextVideo || candidates[0];
}

function triggerUnavailableMediaFallback(reason = 'unavailable') {
    if (isAutoSwitchingUnavailableMedia) return;
    const fallbackPodcast = nextFallbackPodcast();
    if (!fallbackPodcast) return;

    isAutoSwitchingUnavailableMedia = true;
    const warningMsg = String(uiLang || '').toLowerCase().startsWith('en')
        ? 'This media is unavailable. Switching to another recommended item...'
        : 'Este conteúdo está indisponível. Abrindo outro item recomendado...';
    showToast(warningMsg, 'warning');

    const triedParam = Array.from(new Set([...triedPodcastIds, String(currentPodcastId)])).join(',');
    const nextUrl = `podcast_view.html?id=${encodeURIComponent(fallbackPodcast.id)}&lang=${encodeURIComponent(uiLang)}&tried=${encodeURIComponent(triedParam)}`;
    console.warn(`[podcast] auto-fallback (${reason}) -> ${fallbackPodcast.id}`);
    setTimeout(() => { window.location.href = nextUrl; }, 350);
}

function parseProviderMessagePayload(data) {
    if (!data) return null;
    if (typeof data === 'object') return data;
    if (typeof data !== 'string') return null;
    try {
        return JSON.parse(data);
    } catch (_) {
        return null;
    }
}

function handleEmbeddedPlayerMessage(event) {
    const iframe = document.getElementById('podcast-embed-frame');
    if (!iframe || event.source !== iframe.contentWindow) return;

    const provider = iframe.dataset.provider || '';
    if (provider !== 'youtube') return;

    let originHost = '';
    try {
        originHost = new URL(event.origin).hostname.toLowerCase();
    } catch (_) {
        return;
    }
    if (!originHost.includes('youtube.com') && !originHost.includes('youtube-nocookie.com')) return;

    const payload = parseProviderMessagePayload(event.data);
    if (!payload || payload.event !== 'onError') return;

    const code = Number(payload.info);
    if (!YOUTUBE_UNAVAILABLE_ERROR_CODES.has(code)) return;
    triggerUnavailableMediaFallback(`youtube_error_${code}`);
}

function renderMedia() {
    const mediaContainer = document.getElementById('p-video-container');
    const mediaFooter = document.getElementById('p-media-footer');

    const safeEmbed = sanitizeEmbedUrl(podcastData.embed_url || '');
    const embedProvider = safeEmbed ? detectEmbedProvider(safeEmbed) : 'other';
    const sourceUrl = escapeHtml(podcastData.external_url || '#');
    const sourceLabel = escapeHtml(t('act.podcast_open_source') || 'Abrir fonte original');

    mediaContainer.classList.toggle('media-audio', podcastData.media_type === 'audio');
    mediaContainer.classList.toggle('media-video', podcastData.media_type !== 'audio');

    if (!safeEmbed) {
        mediaContainer.innerHTML = `
            <div class="embed-fallback">
                <div>
                    <p>${escapeHtml(t('act.podcast_invalid_embed') || 'Não foi possível carregar o player deste conteúdo.')}</p>
                    ${podcastData.external_url ? `<a class="btn-open-source" href="${sourceUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${sourceLabel}</a>` : ''}
                </div>
            </div>
        `;
        triggerUnavailableMediaFallback('invalid_embed');
    } else {
        mediaContainer.innerHTML = `
            <iframe
                id="podcast-embed-frame"
                data-provider="${embedProvider}"
                src="${buildEmbedUrl(safeEmbed)}"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
                title="${escapeHtml(podcastData.title || 'Podcast player')}"
            ></iframe>
        `;
    }

    mediaFooter.innerHTML = `
        <span class="hero-chip"><i class="fa-solid ${podcastData.media_type === 'audio' ? 'fa-wave-square' : 'fa-circle-play'}"></i> ${escapeHtml(podcastData.media_type === 'audio' ? (t('act.podcast_audio_mode') || 'Modo áudio') : (t('act.podcast_video_mode') || 'Modo vídeo'))}</span>
        ${podcastData.external_url ? `<a class="btn-open-source" href="${sourceUrl}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${sourceLabel}</a>` : ''}
    `;
}

function renderTranscript() {
    const transcriptListEl = document.getElementById('transcript-list');
    if (!transcriptListEl || !hasFullTranscript()) return;

    const segments = Array.isArray(podcastData?.transcript_segments)
        ? podcastData.transcript_segments
        : [];

    if (!segments.length) {
        transcriptListEl.innerHTML = `<div class="transcript-empty">${escapeHtml(t('act.podcast_no_transcript') || 'Sem transcrição disponível para este conteúdo.')}</div>`;
        return;
    }

    const contentField = transcriptMode === 'translated' ? 'translated_text' : 'source_text';
    transcriptListEl.innerHTML = segments.map((segment) => `
        <article class="transcript-line">
            <span class="transcript-time">${escapeHtml(segment.start || '--:--')}</span>
            <p>${escapeHtml(segment[contentField] || '')}</p>
        </article>
    `).join('');
}

function switchTranscriptMode(mode) {
    transcriptMode = mode === 'translated' ? 'translated' : 'source';

    document.querySelectorAll('.transcript-tab').forEach((buttonEl) => {
        const isActive = buttonEl.getAttribute('data-mode') === transcriptMode;
        buttonEl.classList.toggle('is-active', isActive);
    });

    renderTranscript();
}

window.switchTranscriptMode = switchTranscriptMode;

async function loadExercises() {
    const container = document.getElementById('exercises-container');
    try {
        const data = await apiGet(`/activities/podcasts/${currentPodcastId}/exercises?lang=${encodeURIComponent(uiLang)}`);
        exercises = Array.isArray(data?.exercises) ? data.exercises : [];
        renderExercises(container);
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p>${escapeHtml(t('act.exercise_error') || 'Erro ao gerar exercícios. Tente recarregar a página.')}</p>`;
    }
}

function renderExercises(container) {
    if (!exercises.length) {
        container.innerHTML = `<p>${escapeHtml(t('act.exercise_error') || 'Erro ao gerar exercícios. Tente recarregar a página.')}</p>`;
        return;
    }

    let html = `
        <div class="practice-head">
            <h2>${escapeHtml(t('act.practice_title') || 'Prática do Podcast')}</h2>
            <p>${escapeHtml(t('act.practice_sub') || 'Assista ao conteúdo acima e responda às questões da Teacher Tati.')}</p>
        </div>
    `;

    exercises.forEach((exercise, idx) => {
        html += `<div class="ex-card" id="ex-card-${idx}">`;

        if (exercise.type === 'writing') {
            html += `
                <div class="ex-title"><i class="fa-solid fa-pen-nib"></i> ${escapeHtml(t('act.podcast_writing_title') || 'Writing Practice')}</div>
                <p class="question-text">${escapeHtml(exercise.question || '')}</p>
                <div class="writing-area">
                    <textarea id="ans-writing-${idx}" placeholder="${escapeHtml(t('act.write_placeholder') || 'Escreva sua resposta em inglês aqui...')}"></textarea>
                </div>
                ${exercise.translation_hint ? `<p class="translation-note"><i class="fa-solid fa-lightbulb"></i> ${escapeHtml(exercise.translation_hint)}</p>` : ''}
                <button class="btn-submit-ex" onclick="submitExercise(${idx}, 'writing', this)">${escapeHtml(t('gen.send') || 'Enviar')}</button>
            `;
        } else if (exercise.type === 'choice') {
            html += `
                <div class="ex-title"><i class="fa-solid fa-list-check"></i> ${escapeHtml(t('act.podcast_choice_title') || 'Multiple Choice')}</div>
                <p class="question-text">${escapeHtml(exercise.question || '')}</p>
                <div class="question-options">
                    ${(exercise.options || []).map((option, optionIdx) => `
                        <button class="option-btn" onclick="selectChoiceOption(this, ${idx}, ${optionIdx})">${escapeHtml(option)}</button>
                    `).join('')}
                </div>
                <button class="btn-submit-ex" id="btn-submit-choice-${idx}" onclick="submitExercise(${idx}, 'choice', this)" disabled>${escapeHtml(t('gen.send') || 'Enviar')}</button>
            `;
        } else if (exercise.type === 'voice') {
            html += `
                <div class="ex-title"><i class="fa-solid fa-microphone"></i> ${escapeHtml(t('act.podcast_voice_title') || 'Pronunciation')}</div>
                <p class="question-text">${escapeHtml(t('act.repeat_phrase') || 'Repita a frase abaixo:')}</p>
                <div class="voice-area">
                    <div class="phrase-to-say">"${escapeHtml(exercise.phrase || '')}"</div>
                    ${exercise.translation_hint ? `<p class="translation-note">${escapeHtml(exercise.translation_hint)}</p>` : ''}
                    <button class="btn-mic-rec" id="btn-voice-rec-${idx}" onclick="toggleVoiceRec(${idx})">
                        <i class="fa-solid fa-microphone"></i>
                    </button>
                    <p id="voice-status-${idx}">${escapeHtml(t('act.click_mic') || 'Clique no microfone para falar.')}</p>
                    <div id="voice-transcript-${idx}" style="font-style: italic; color: var(--text-muted); min-height: 1.2em;"></div>
                </div>
                <button class="btn-submit-ex" id="btn-submit-voice-${idx}" onclick="submitExercise(${idx}, 'voice', this)" disabled>${escapeHtml(t('act.evaluate') || 'Avaliar')}</button>
            `;
        }

        html += `<div class="feedback-box" id="fb-${idx}"></div></div>`;
    });

    container.innerHTML = html;
    initRevealBlocks();
}

function selectChoiceOption(buttonEl, exIdx, optionIdx) {
    selectedOptions[exIdx] = optionIdx;
    const parent = buttonEl.parentElement;
    parent.querySelectorAll('.option-btn').forEach((btn) => btn.classList.remove('selected'));
    buttonEl.classList.add('selected');

    const submitBtn = document.getElementById(`btn-submit-choice-${exIdx}`);
    if (submitBtn) submitBtn.disabled = false;
}

window.selectChoiceOption = selectChoiceOption;

function initSpeechRec() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
}

function toggleVoiceRec(idx) {
    if (!recognition) {
        showToast(t('act.voice_not_supported') || 'Seu navegador não suporta reconhecimento de voz.', 'error');
        return;
    }

    if (isRecording && activeVoiceIdx === idx) {
        recognition.stop();
        return;
    }

    if (isRecording && activeVoiceIdx !== idx) {
        recognition.stop();
    }

    activeVoiceIdx = idx;
    isRecording = true;

    const micBtn = document.getElementById(`btn-voice-rec-${idx}`);
    const statusEl = document.getElementById(`voice-status-${idx}`);
    const transcriptEl = document.getElementById(`voice-transcript-${idx}`);

    if (micBtn) micBtn.classList.add('recording');
    if (statusEl) statusEl.textContent = t('act.listening') || 'Ouvindo...';
    if (transcriptEl) transcriptEl.textContent = '';

    recognition.onresult = (event) => {
        const text = Array.from(event.results).map((result) => result[0].transcript).join('');
        if (transcriptEl) transcriptEl.textContent = text;

        const hasFinalResult = Array.from(event.results).some((result) => result.isFinal);
        if (hasFinalResult) {
            const submitBtn = document.getElementById(`btn-submit-voice-${idx}`);
            if (submitBtn) submitBtn.disabled = false;
        }
    };

    recognition.onend = () => {
        isRecording = false;
        if (micBtn) micBtn.classList.remove('recording');
        if (statusEl) statusEl.textContent = t('act.rec_finished') || 'Gravação finalizada.';
    };

    recognition.start();
}

window.toggleVoiceRec = toggleVoiceRec;

async function submitExercise(idx, type, buttonEl) {
    const exercise = exercises[idx];
    if (!exercise) return;

    let answer = '';
    if (type === 'writing') {
        answer = document.getElementById(`ans-writing-${idx}`)?.value || '';
    } else if (type === 'choice') {
        const selectedIndex = selectedOptions[idx];
        answer = selectedIndex == null ? '' : (exercise.options?.[selectedIndex] || '');
    } else if (type === 'voice') {
        answer = document.getElementById(`voice-transcript-${idx}`)?.textContent || '';
    }

    if (!answer.trim()) {
        showToast(t('act.empty_answer') || 'Por favor, responda antes de enviar.', 'warning');
        return;
    }

    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = t('gen.evaluating') || 'Avaliando...';

    try {
        const res = await apiPost('/activities/podcasts/evaluate', {
            podcast_id: currentPodcastId,
            type,
            user_answer: answer
        });

        const score = Number(res?.data?.score ?? 0);
        const feedbackText = String(res?.data?.feedback || t('act.feedback_default') || 'Continue praticando para evoluir!');

        const feedbackEl = document.getElementById(`fb-${idx}`);
        if (!feedbackEl) return;

        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = `
            <div>
                <span class="score-badge">Score: ${Math.max(0, Math.min(100, score))}/100</span>
                <span>${escapeHtml(feedbackText)}</span>
            </div>
        `;

        if (type === 'choice' && score < 100 && Array.isArray(exercise.options)) {
            const correct = exercise.options[exercise.correct_index];
            feedbackEl.innerHTML += `<p style="margin-top:0.5rem"><strong>${escapeHtml(t('act.correct_ans') || 'Resposta correta')}:</strong> ${escapeHtml(correct || '')}</p>`;
        }
    } catch (error) {
        console.error(error);
        showToast(t('act.exercise_eval_error') || 'Erro ao avaliar exercício.', 'error');
    } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = originalText;
    }
}

window.submitExercise = submitExercise;

function initRevealBlocks() {
    const blocks = document.querySelectorAll('.reveal-block:not(.is-visible)');
    if (!blocks.length || typeof IntersectionObserver === 'undefined') {
        blocks.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, localObserver) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            localObserver.unobserve(entry.target);
        });
    }, { threshold: 0.14 });

    blocks.forEach((block) => observer.observe(block));
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

