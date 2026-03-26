(function () {
  'use strict';

  const API = 'http://127.0.0.1:8000';

  const tooltip = document.createElement('div');
  tooltip.id = 'word-tooltip';
  tooltip.innerHTML = `
    <div class="wt-header">
      <span class="wt-word"></span>
      <span class="wt-pos"></span>
      <button class="wt-close" title="Fechar">✕</button>
    </div>
    <div class="wt-phonetics">
      <button class="wt-pron" id="wt-btn-tati" title="Ouvir com a voz da Tati">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        Tati
      </button>
      <button class="wt-pron wt-pron-dict" id="wt-btn-dict" title="Pronúncia do dicionário (EN-US)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        Dict
      </button>
      <span class="wt-phonetic-text"></span>
    </div>
    <div class="wt-translation">
      <span class="wt-flag">🇧🇷</span>
      <span class="wt-trans-text">Carregando...</span>
    </div>
    <div class="wt-definition"></div>
    <div class="wt-audio-ctrl">
      <input type="range" class="wt-vol" min="0" max="1" step="0.1" value="1" title="Volume">
      <span class="wt-vol-icon">🔊</span>
    </div>
  `;
  document.body.appendChild(tooltip);

  let currentWord  = '';
  let dictAudioSrc = null;   // URL from Free Dictionary API
  let currentAudio = null;
  const cache = {};

  // ── Position ──────────────────────────────────────────────────────
  function positionTooltip(x, y) {
    tooltip.style.display = 'block';
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    let left = x + 10;
    let top  = y + 10;
    if (left + tw > ww - 12) left = x - tw - 10;
    if (top  + th > wh - 12) top  = y - th - 10;
    tooltip.style.left = Math.max(8, left) + 'px';
    tooltip.style.top  = Math.max(8, top)  + 'px';
  }

  // ── Dictionary lookup ─────────────────────────────────────────────
  async function lookupWord(word) {
    const key = 'dict_' + word;
    if (cache[key] !== undefined) return cache[key];
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) { cache[key] = null; return null; }
      const data = await res.json();
      cache[key] = data[0];
      return data[0];
    } catch { cache[key] = null; return null; }
  }

  // ── Translation ───────────────────────────────────────────────────
  async function translateWord(word) {
    const key = 'tr_' + word;
    if (cache[key] !== undefined) return cache[key];
    try {
      const res  = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|pt-BR`);
      const data = await res.json();
      const t    = data?.responseData?.translatedText;
      const result = (t && t.toLowerCase() !== word.toLowerCase()) ? t : null;
      cache[key] = result;
      return result;
    } catch { cache[key] = null; return null; }
  }

  // ── TTS via backend (same voice as Tati) ──────────────────────────
  async function fetchTatiAudio(word) {
    const key = 'tts_' + word;
    if (cache[key] !== undefined) return cache[key]; // could be null if failed

    const token = localStorage.getItem('token');
    if (!token) { cache[key] = null; return null; }

    try {
      const res = await fetch(`${API}/chat/tts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ text: word }),
      });
      if (!res.ok) { cache[key] = null; return null; }
      const data = await res.json();
      cache[key] = data.audio || null;
      return cache[key];
    } catch { cache[key] = null; return null; }
  }

  // ── Play helpers ──────────────────────────────────────────────────
  function stopCurrent() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    tooltip.querySelectorAll('.wt-pron').forEach(b => b.classList.remove('playing'));
  }

  function playAudio(src, isBase64, btn) {
    stopCurrent();
    const url   = isBase64 ? 'data:audio/mp3;base64,' + src : src;
    const audio = new Audio(url);
    audio.volume = parseFloat(tooltip.querySelector('.wt-vol').value);
    currentAudio = audio;
    btn.classList.add('playing');
    audio.onended = () => { btn.classList.remove('playing'); if (currentAudio === audio) currentAudio = null; };
    audio.onerror = () => { btn.classList.remove('playing'); if (currentAudio === audio) currentAudio = null; };
    audio.play().catch(() => btn.classList.remove('playing'));
  }

  // ── Show tooltip ──────────────────────────────────────────────────
  async function showTooltip(word, x, y) {
    word = word.toLowerCase().replace(/[^a-z'-]/g, '');
    if (!word || word.length < 2) return;
    currentWord  = word;
    dictAudioSrc = null;

    // Reset UI
    tooltip.querySelector('.wt-word').textContent        = word;
    tooltip.querySelector('.wt-pos').textContent         = '';
    tooltip.querySelector('.wt-phonetic-text').textContent = '';
    tooltip.querySelector('.wt-trans-text').textContent  = 'Carregando...';
    tooltip.querySelector('.wt-definition').textContent  = '';

    const tatiBtn = tooltip.querySelector('#wt-btn-tati');
    const dictBtn = tooltip.querySelector('#wt-btn-dict');
    tatiBtn.classList.remove('playing', 'no-audio', 'loading');
    dictBtn.classList.remove('playing', 'no-audio', 'loading');
    tatiBtn.classList.add('loading');
    dictBtn.classList.add('loading');

    positionTooltip(x, y);

    // Fetch all in parallel
    const [dictData, translation, tatiB64] = await Promise.all([
      lookupWord(word),
      translateWord(word),
      fetchTatiAudio(word),
    ]);

    if (currentWord !== word) return; // user clicked another word

    // Translation
    tooltip.querySelector('.wt-trans-text').textContent = translation || '(sem tradução)';

    // Dictionary data
    if (dictData) {
      const meanings = dictData.meanings || [];
      if (meanings[0]) tooltip.querySelector('.wt-pos').textContent = meanings[0].partOfSpeech || '';
      const def = meanings[0]?.definitions?.[0]?.definition || '';
      const defEl = tooltip.querySelector('.wt-definition');
      defEl.textContent = def.length > 120 ? def.slice(0, 120) + '…' : def;

      // Find dict audio URL
      const phonetics = dictData.phonetics || [];
      let phonText = '';
      phonetics.forEach(ph => {
        if (!phonText && ph.text) phonText = ph.text;
        const src = ph.audio || '';
        if (src && !dictAudioSrc) dictAudioSrc = src;
      });
      tooltip.querySelector('.wt-phonetic-text').textContent = phonText;
    }

    // Update button states
    tatiBtn.classList.remove('loading');
    dictBtn.classList.remove('loading');

    tatiBtn.classList.toggle('no-audio', !tatiB64);
    dictBtn.classList.toggle('no-audio', !dictAudioSrc);

    positionTooltip(x, y);
  }

  // ── Button handlers ───────────────────────────────────────────────
  tooltip.querySelector('#wt-btn-tati').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn   = tooltip.querySelector('#wt-btn-tati');
    if (btn.classList.contains('no-audio') || btn.classList.contains('loading')) return;

    const b64 = cache['tts_' + currentWord];
    if (b64) {
      playAudio(b64, true, btn);
    } else {
      // Shouldn't happen (loaded in showTooltip), but fetch on demand as fallback
      btn.classList.add('loading');
      const fetched = await fetchTatiAudio(currentWord);
      btn.classList.remove('loading');
      if (fetched) playAudio(fetched, true, btn);
      else btn.classList.add('no-audio');
    }
  });

  tooltip.querySelector('#wt-btn-dict').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = tooltip.querySelector('#wt-btn-dict');
    if (btn.classList.contains('no-audio') || btn.classList.contains('loading')) return;
    if (dictAudioSrc) playAudio(dictAudioSrc, false, btn);
  });

  tooltip.querySelector('.wt-vol').addEventListener('input', function () {
    if (currentAudio) currentAudio.volume = parseFloat(this.value);
    tooltip.querySelector('.wt-vol-icon').textContent = this.value > 0.5 ? '🔊' : this.value > 0 ? '🔉' : '🔇';
  });

  tooltip.querySelector('.wt-close').addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
  });

  // ── Hide ──────────────────────────────────────────────────────────
  function hideTooltip() {
    tooltip.style.display = 'none';
    stopCurrent();
    currentWord = '';
  }

  document.addEventListener('click', e => { if (!tooltip.contains(e.target)) hideTooltip(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTooltip(); });

  // ── Make words clickable ──────────────────────────────────────────
  function makeClickable(container) {
    const selector = '.message-bubble, .vbubble';
    const bubbles = container
      ? container.querySelectorAll(selector)
      : document.querySelectorAll(`${selector}:not([data-wt-ready])`);

    bubbles.forEach(bubble => {
      if (bubble.dataset.wtReady) return;
      bubble.dataset.wtReady = '1';
      wrapWords(bubble);
    });
  }

  function wrapWords(el) {
    if (el.tagName === 'CODE' || el.tagName === 'PRE') return;
    Array.from(el.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text.trim()) return;
        const frag = document.createDocumentFragment();
        text.split(/(\s+)/).forEach(part => {
          if (/\s+/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else if (/[a-zA-Z]/.test(part)) {
            const span = document.createElement('span');
            span.className = 'wt-word-span';
            span.textContent = part;
            frag.appendChild(span);
          } else {
            frag.appendChild(document.createTextNode(part));
          }
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        wrapWords(node);
      }
    });
  }

  document.addEventListener('click', e => {
    const span = e.target.closest('.wt-word-span');
    if (!span) return;
    e.stopPropagation();
    const word = span.textContent.trim();
    showTooltip(word, e.clientX, e.clientY);
  });

  window.WordTooltip = { makeClickable, hide: hideTooltip };

})();