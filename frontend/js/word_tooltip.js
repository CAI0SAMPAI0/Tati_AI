// js/word-tooltip.js
// Shared: click a word → tooltip with translation + EN-US/EN-UK pronunciation
// Uses Free Dictionary API (no key needed) + MyMemory for translation

(function () {
  'use strict';

  // ── Tooltip DOM ────────────────────────────────────────────────
  const tooltip = document.createElement('div');
  tooltip.id = 'word-tooltip';
  tooltip.innerHTML = `
    <div class="wt-header">
      <span class="wt-word"></span>
      <span class="wt-pos"></span>
      <button class="wt-close" title="Fechar">✕</button>
    </div>
    <div class="wt-phonetics">
      <button class="wt-pron" data-accent="us" title="Pronúncia US">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        EN-US
      </button>
      <button class="wt-pron" data-accent="uk" title="Pronúncia UK">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        EN-UK
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

  // ── State ──────────────────────────────────────────────────────
  let currentWord = '';
  let audioUS = null;
  let audioUK = null;
  let currentAudio = null;
  const cache = {};

  // ── Position tooltip near click ────────────────────────────────
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

  // ── Fetch dictionary data ──────────────────────────────────────
  async function lookupWord(word) {
    if (cache[word]) return cache[word];
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) return null;
      const data = await res.json();
      cache[word] = data[0];
      return data[0];
    } catch { return null; }
  }

  async function translateWord(word) {
    const key = 'tr_' + word;
    if (cache[key]) return cache[key];
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|pt-BR`);
      const data = await res.json();
      const t = data?.responseData?.translatedText;
      if (t && t.toLowerCase() !== word.toLowerCase()) {
        cache[key] = t;
        return t;
      }
      return null;
    } catch { return null; }
  }

  // ── Populate tooltip ───────────────────────────────────────────
  async function showTooltip(word, x, y) {
    word = word.toLowerCase().replace(/[^a-z'-]/g, '');
    if (!word || word.length < 2) return;
    currentWord = word;
    audioUS = null;
    audioUK = null;

    // Reset UI
    tooltip.querySelector('.wt-word').textContent = word;
    tooltip.querySelector('.wt-pos').textContent  = '';
    tooltip.querySelector('.wt-phonetic-text').textContent = '';
    tooltip.querySelector('.wt-trans-text').textContent = 'Carregando...';
    tooltip.querySelector('.wt-definition').textContent = '';
    tooltip.querySelectorAll('.wt-pron').forEach(b => b.classList.remove('playing', 'no-audio'));

    positionTooltip(x, y);

    // Fetch in parallel
    const [dictData, translation] = await Promise.all([
      lookupWord(word),
      translateWord(word)
    ]);

    if (currentWord !== word) return; // stale

    // Translation
    const transEl = tooltip.querySelector('.wt-trans-text');
    transEl.textContent = translation || '(sem tradução)';

    if (!dictData) {
      tooltip.querySelector('.wt-definition').textContent = 'Palavra não encontrada no dicionário.';
      return;
    }

    // POS
    const meanings = dictData.meanings || [];
    if (meanings[0]) {
      tooltip.querySelector('.wt-pos').textContent = meanings[0].partOfSpeech || '';
    }

    // Definition (first)
    const def = meanings[0]?.definitions?.[0]?.definition;
    if (def) {
      const defEl = tooltip.querySelector('.wt-definition');
      defEl.textContent = def.length > 120 ? def.slice(0, 120) + '…' : def;
    }

    // Phonetics & audio
    const phonetics = dictData.phonetics || [];
    let phonTextSet = false;

    phonetics.forEach(ph => {
      const src = ph.audio || '';
      const txt = ph.text || '';
      if (!phonTextSet && txt) {
        tooltip.querySelector('.wt-phonetic-text').textContent = txt;
        phonTextSet = true;
      }
      if (src.includes('-us.') || src.includes('_us') || src.includes('/us')) {
        audioUS = src;
      } else if (src.includes('-uk.') || src.includes('_uk') || src.includes('/uk')) {
        audioUK = src;
      } else if (src && !audioUS) {
        audioUS = src; // fallback: use whatever we get
      }
    });

    // Mark buttons with/without audio
    tooltip.querySelector('[data-accent="us"]').classList.toggle('no-audio', !audioUS);
    tooltip.querySelector('[data-accent="uk"]').classList.toggle('no-audio', !audioUK);

    positionTooltip(x, y); // reposition after content loaded
  }

  // ── Audio playback ─────────────────────────────────────────────
  function playAudio(src, btn) {
    if (!src) return;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    tooltip.querySelectorAll('.wt-pron').forEach(b => b.classList.remove('playing'));

    const vol = parseFloat(tooltip.querySelector('.wt-vol').value);
    const audio = new Audio(src);
    audio.volume = vol;
    currentAudio = audio;
    btn.classList.add('playing');

    audio.onended = () => { btn.classList.remove('playing'); currentAudio = null; };
    audio.onerror = () => { btn.classList.remove('playing'); currentAudio = null; };
    audio.play().catch(() => btn.classList.remove('playing'));
  }

  // ── Event: pronunciation buttons ───────────────────────────────
  tooltip.querySelectorAll('.wt-pron').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const accent = btn.dataset.accent;
      const src = accent === 'us' ? audioUS : audioUK;
      if (src) playAudio(src, btn);
    });
  });

  // ── Event: volume slider ───────────────────────────────────────
  tooltip.querySelector('.wt-vol').addEventListener('input', function () {
    if (currentAudio) currentAudio.volume = parseFloat(this.value);
    const icon = tooltip.querySelector('.wt-vol-icon');
    icon.textContent = this.value > 0.5 ? '🔊' : this.value > 0 ? '🔉' : '🔇';
  });

  // ── Event: close ──────────────────────────────────────────────
  tooltip.querySelector('.wt-close').addEventListener('click', e => {
    e.stopPropagation();
    hideTooltip();
  });

  function hideTooltip() {
    tooltip.style.display = 'none';
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    currentWord = '';
  }

  // ── Click outside to close ─────────────────────────────────────
  document.addEventListener('click', e => {
    if (!tooltip.contains(e.target)) hideTooltip();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideTooltip();
  });

  // ── Make message bubbles word-clickable ────────────────────────
  // Called after new messages are rendered
  function makeClickable(container) {
    // Only process text nodes inside .message-bubble
    const bubbles = container
      ? container.querySelectorAll('.message-bubble')
      : document.querySelectorAll('.message-bubble:not([data-wt-ready])');

    bubbles.forEach(bubble => {
      if (bubble.dataset.wtReady) return;
      bubble.dataset.wtReady = '1';

      // Wrap each word in a span
      wrapWords(bubble);
    });
  }

  function wrapWords(el) {
    // Only wrap text in leaf text nodes, skip code/pre
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

  // ── Delegated click on word spans ─────────────────────────────
  document.addEventListener('click', e => {
    const span = e.target.closest('.wt-word-span');
    if (!span) return;
    e.stopPropagation();
    const word = span.textContent.trim();
    showTooltip(word, e.clientX, e.clientY);
  });

  // ── Public API ─────────────────────────────────────────────────
  window.WordTooltip = { makeClickable, hide: hideTooltip };

})();*/