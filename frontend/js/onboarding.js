/**
 * onboarding.js — Tour guiado Tati AI
 */
const Onboarding = (() => {
  const STORAGE_KEY = 'tati_onboarding_done';

  // ─── Steps base (todos os alunos) ────────────────────────────────────────────
  const STEPS_STUDENT = [
    {
      target: null,
      position: 'center',
      icon: '👋',
      title: 'Welcome to Tati AI!',
      body: "I'm Teacher Tati, your personal English tutor. Let me show you around so you can get the most out of your studies.",
    },
    {
      target: '#chat-messages',
      position: 'top',
      icon: '💬',
      title: 'Your Chat with Tati',
      body: "This is where all the magic happens. Type in English and I'll correct you, explain grammar, and have real conversations with you. Every message helps me understand your level better.",
    },
    {
      target: '#message-input',
      position: 'top',
      icon: '✍️',
      title: 'Send a Message',
      body: 'Type your message here and press Enter or the send button. Ask questions, practice grammar, describe your day — anything goes!',
    },
    {
      target: '#btn-mic',
      position: 'top',
      icon: '🎤',
      title: 'Voice Recording',
      body: "When Voice Mode is active, you can click here to speak directly in English. I'll transcribe your speech and give you instant pronunciation feedback.",
      optional: true,
      condition: () => document.body.classList.contains('voice-mode-active') || (typeof isVoiceMode === 'function' && isVoiceMode())
    },
    {
      target: '#weekly-plan-card',
      position: 'right',
      icon: '📅',
      title: 'Your Weekly Study Plan',
      body: "Every week I generate a personalized study plan based on your mistakes and goals. It gives you 3 focus topics to practice during the week — follow it and your progress will skyrocket.",
    },
    {
      target: 'a[href="activities.html"]',
      position: 'top',
      icon: '🏋️',
      title: 'Activities & Exercises',
      body: "Practice with AI-generated exercises. We have three main types: \n1. **Quizzes**: Test your comprehension.\n2. **Vocabulary**: Build your word bank.\n3. **Writing**: Open-ended questions with personalized feedback. \nYour progress and XP are updated automatically!",
    },
    {
      target: '.sidebar-user-card',
      position: 'top',
      icon: '👤',
      title: 'Your Profile & Settings',
      body: "Manage your account here. You can update your English level, change your study goals, check your subscription plan, and see your trophies and history. You can also restart this tour anytime!",
    },
    {
      target: null,
      position: 'center',
      icon: '🚀',
      title: "You're all set!",
      body: "Start chatting with me now. Don't worry about making mistakes — they're literally how you learn! I'll be here every step of the way.",
      isFinal: true,
    },
  ];

  const STEPS_ADMIN = [
    ...STEPS_STUDENT.slice(0, -1),
    {
      target: '#btn-dashboard',
      position: 'top',
      icon: '📊',
      title: 'Admin Dashboard',
      body: 'Access detailed stats, student rankings, and manage the platform. This area is only visible to admins.',
    },
    STEPS_STUDENT[STEPS_STUDENT.length - 1],
  ];

  // ─── Estado ──────────────────────────────────────────────────────────────────
  let _currentStep = 0;
  let _steps = [];
  let _overlay = null;
  let _spotlight = null;
  let _tooltip = null;
  let _onDone = null;

  // ─── Privados ─────────────────────────────────────────────────────────────

  function _getSteps() {
    try {
      const u = typeof getUser === 'function' ? getUser() : null;
      if (u && (u.role === 'admin' || u.role === 'professor')) return STEPS_ADMIN;
    } catch (_) { }
    return STEPS_STUDENT;
  }

  async function _checkBackendFlag() {
    try {
      if (typeof apiGet !== 'function') return false;
      const data = await apiGet('/users/onboarding');
      if (data && data.has_seen_onboarding) {
        localStorage.setItem(STORAGE_KEY, '1');
        return true;
      }
      return false;
    } catch (_) { return false; }
  }

  async function _saveOnboardingFlag() {
    try {
      if (typeof apiFetch === 'function') {
        await apiFetch('/users/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ has_seen_onboarding: true }),
        });
      }
    } catch (_) { }
  }

  function _buildDOM() {
    document.getElementById('ob-overlay')?.remove();
    _overlay = document.createElement('div');
    _overlay.id = 'ob-overlay';
    _overlay.innerHTML = `
      <div id="ob-spotlight"></div>
      <div id="ob-tooltip">
        <div class="ob-tooltip-header">
          <span class="ob-icon" id="ob-icon"></span>
          <div class="ob-progress" id="ob-progress"></div>
        </div>
        <h3 class="ob-title" id="ob-title"></h3>
        <p class="ob-body" id="ob-body"></p>
        <div class="ob-footer">
          <button class="ob-btn-skip" id="ob-btn-skip">Skip tour</button>
          <div class="ob-nav">
            <button class="ob-btn-prev" id="ob-btn-prev">← Back</button>
            <button class="ob-btn-next" id="ob-btn-next">Next →</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(_overlay);

    _spotlight = document.getElementById('ob-spotlight');
    _tooltip = document.getElementById('ob-tooltip');

    document.getElementById('ob-btn-skip').onclick = () => Onboarding.skip();
    document.getElementById('ob-btn-prev').onclick = () => Onboarding.prev();
    document.getElementById('ob-btn-next').onclick = () => Onboarding.next();
  }

  function _showStep(index) {
    const step = _steps[index];
    if (!step) { _finish(); return; }

    if (step.condition && !step.condition()) {
      if (index + 1 < _steps.length) _showStep(index + 1);
      else _finish();
      return;
    }

    document.getElementById('ob-icon').textContent = step.icon;
    document.getElementById('ob-title').textContent = step.title;
    document.getElementById('ob-body').textContent = step.body;

    const prog = document.getElementById('ob-progress');
    prog.innerHTML = _steps.map((_, i) =>
      `<span class="ob-dot ${i === index ? 'active' : i < index ? 'done' : ''}"></span>`
    ).join('');

    document.getElementById('ob-btn-prev').style.visibility = index === 0 ? 'hidden' : 'visible';
    const nextBtn = document.getElementById('ob-btn-next');
    nextBtn.textContent = step.isFinal ? "Let's go! 🚀" : 'Next →';

    const targetEl = step.target ? document.querySelector(step.target) : null;
    if (step.optional && step.target && !targetEl) {
      _showStep(index + 1 < _steps.length ? index + 1 : index);
      return;
    }

    _positionSpotlight(step);
  }

  function _positionSpotlight(step) {
    const padding = 12;
    if (!step.target) {
      _spotlight.style.cssText = 'display:none';
      _positionTooltip(null, 'center');
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      _spotlight.style.cssText = 'display:none';
      _positionTooltip(null, 'center');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      _spotlight.style.cssText = `
        display: block;
        top:    ${rect.top - padding}px;
        left:   ${rect.left - padding}px;
        width:  ${rect.width + padding * 2}px;
        height: ${rect.height + padding * 2}px;
      `;
      _positionTooltip(rect, step.position);
    }, 250);
  }

  function _positionTooltip(rect, position) {
    const tt = _tooltip;
    const gap = 16;
    tt.className = 'ob-tooltip-' + position;

    if (!rect || position === 'center') {
      tt.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%);';
      return;
    }

    tt.style.cssText = 'position:fixed;';
    setTimeout(() => {
      const tw = tt.offsetWidth, th = tt.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      let top, left;
      switch (position) {
        case 'bottom': top = rect.bottom + gap; left = rect.left + rect.width / 2 - tw / 2; break;
        case 'top':    top = rect.top - th - gap; left = rect.left + rect.width / 2 - tw / 2; break;
        case 'right':  top = rect.top + rect.height / 2 - th / 2; left = rect.right + gap; break;
        case 'left':   top = rect.top + rect.height / 2 - th / 2; left = rect.left - tw - gap; break;
        default:       top = rect.bottom + gap; left = rect.left + rect.width / 2 - tw / 2;
      }
      top = Math.max(8, Math.min(top, vh - th - 8));
      left = Math.max(8, Math.min(left, vw - tw - 8));
      tt.style.top = top + 'px'; tt.style.left = left + 'px';
    }, 0);
  }

  function _finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    _overlay?.remove(); _overlay = null;
    _saveOnboardingFlag().catch(() => { });
    if (_onDone) _onDone();
  }

  // ─── API ───────────────────────────────────────────────────────────────────

  return {
    init: async function() {
      const urlParams = new URLSearchParams(window.location.search);
      const forceTour = urlParams.get('tour') === 'true';

      if (!forceTour && localStorage.getItem(STORAGE_KEY)) return;
      if (!forceTour) {
        const done = await _checkBackendFlag();
        if (done) return;
      }

      // Se forçar o tour, limpa o param da URL para não repetir no refresh
      if (forceTour) {
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }

      setTimeout(() => this.start(), 800);
    },

    start: function(onDone) {
      _currentStep = 0;
      _onDone = onDone || null;
      _steps = _getSteps();
      _buildDOM();
      _showStep(0);
    },

    next: () => {
      if (_currentStep < _steps.length - 1) { _currentStep++; _showStep(_currentStep); }
      else _finish();
    },

    prev: () => { if (_currentStep > 0) { _currentStep--; _showStep(_currentStep); } },

    skip: () => _finish(),
  };
})();

// Compatibilidade com chamadas globais antigas
window.initOnboardingIfNeeded = () => Onboarding.init();
window.startOnboarding = (onDone) => Onboarding.start(onDone);
window.onboardingNext = () => Onboarding.next();
window.onboardingPrev = () => Onboarding.prev();
window.skipOnboarding = () => Onboarding.skip();