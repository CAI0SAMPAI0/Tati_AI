  async function _downloadReportPDF(content, filename, clickedBtn = null) {
    const btn = clickedBtn;
    const orig = btn ? btn.innerHTML : null;
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t('act.generating_pdf') || 'Gerando PDF...'}` ;
      btn.disabled = true;
      btn.style.opacity = '0.8';
    }

    try {
      const response = await fetch(`${API_BASE}/chat/download_report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ content, filename })
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || 'Falha ao gerar PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      if (btn) btn.innerHTML = `<i class="fa-solid fa-check"></i> PDF Baixado!`;
      setTimeout(() => { if (btn) { btn.innerHTML = orig; btn.disabled = false; btn.style.opacity = ''; } }, 2500);
    } catch (e) {
      console.error(e);
      showToast('Erro ao gerar PDF. Tente novamente.', 'error');
      if (btn) { btn.innerHTML = orig; btn.disabled = false; btn.style.opacity = ''; }
    }
  }

  // ── Modais e UI Helpers ────────────────────────────────────────────────────────
  function openFeedbackModal() {
    document.getElementById('feedback-modal').classList.add('active');
  }
  function closeFeedbackModal() {
    document.getElementById('feedback-modal').classList.remove('active');
  }

  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    feedbackForm.onsubmit = async (e) => {
      e.preventDefault();
      const type = document.getElementById('fb-type').value;
      const message = document.getElementById('fb-message').value;
      if (!message) return;
      try {
        await apiPost('/validation/feedback', { type, message });
        showToast(t('act.fb_success') || 'Feedback enviado!', 'success');
        closeFeedbackModal();
        feedbackForm.reset();
      } catch (err) {
        showToast(t('act.fb_error') || 'Erro ao enviar.', 'error');
      }
    };
  }

  // ── Inicialização ──────────────────────────────────────────────────────────────
  (async function init() {
    applyChatI18n();
    window.addEventListener('langchange', applyChatI18n);

    const convs = await loadConversations();
    const lastId = localStorage.getItem('tati_last_conv');

    if (urlConvId) {
      await openConversation(urlConvId);
    } else if (lastId && convs.some(c => c.id === lastId)) {
      await openConversation(lastId);
    } else if (convs.length > 0) {
      await openConversation(convs[0].id);
    } else {
      _showWelcome();
    }
    
    // Conecta WS
    connectWS();
  })();
})();
