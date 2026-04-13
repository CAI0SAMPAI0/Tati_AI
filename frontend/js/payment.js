if (!requireAuth()) throw new Error('Unauthenticated');

// ── State ─────────────────────────────────────────────────────────
let selectedMethod = 'PIX';
let selectedPlan   = 'full';
let _detailPlan    = null;

// ── Init ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const cpfInput = document.getElementById('user-cpf');

  // Adiciona a máscara automática ao digitar
  if (cpfInput) {
    cpfInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
      if (v.length > 14) v = v.substring(0, 14); // Limita a 14 caracteres
      
      if (v.length <= 11) {
        // Máscara CPF: 000.000.000-00
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else {
        // Máscara CNPJ: 00.000.000/0000-00
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
      }
      e.target.value = v;
    });
  }

  // Pré-carrega CPF se já existir no perfil
  try {
    const userProfile = await apiGet('/profile/');
    if (cpfInput && (userProfile.cpf || userProfile.cpf_cnpj)) {
      const val = userProfile.cpf || userProfile.cpf_cnpj;
      cpfInput.value = val;
      // Dispara o evento input para aplicar a máscara no valor carregado
      cpfInput.dispatchEvent(new Event('input'));
    }
  } catch (e) {
    console.warn("Erro ao buscar perfil para pré-preencher CPF:", e);
  }
});

// ── Toast ─────────────────────────────────────────────────────────
function showToast(text, type = 'info') {
  Toastify({
    text,
    duration: 3500,
    gravity: 'top',
    position: 'right',
    style: { background: type === 'error' ? '#ff4d4d' : '#7c3aed' }
  }).showToast();
}

// ── Seleção de plano e método ─────────────────────────────────────
function selectPlan(plan, element) {
  selectedPlan = plan;
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
}

function selectMethod(method, element) {
  selectedMethod = method;
  document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  // Oculta resultado pix anterior ao trocar método
  const pixResult = document.getElementById('pix-result');
  if (pixResult) { pixResult.classList.remove('visible'); pixResult.style.display = 'none'; }
}

// ── Modal detalhes do plano ───────────────────────────────────────
function showPlanDetails(e, plan) {
  if (e) e.stopPropagation();
  _detailPlan = plan;

  const isBasic  = plan === 'basic';
  const nameKey  = isBasic ? 'plan.basic'       : 'plan.full';
  const priceKey = isBasic ? 'plan.basic_price'  : 'plan.full_price';
  const count    = isBasic ? 4 : 9;
  const features = Array.from({ length: count }, (_, i) =>
    t(`plan.${isBasic ? 'basic' : 'full'}_feature_${i + 1}`)
  );

  document.getElementById('detail-name').textContent  = t(nameKey);
  document.getElementById('detail-price').innerHTML   =
    `${t(priceKey)}<small>${t('plan.per_month')}</small>`;

  const ul = document.getElementById('detail-features');
  ul.innerHTML = features.map(f =>
    `<li><i class="fa-solid fa-check" style="color:#a78bfa;font-size:0.7rem;width:14px;"></i>${f}</li>`
  ).join('');

  document.getElementById('plan-detail-modal').classList.add('visible');
}

function closePlanDetail() {
  document.getElementById('plan-detail-modal').classList.remove('visible');
}

function choosePlanFromModal() {
  if (_detailPlan) {
    selectPlan(_detailPlan, document.getElementById(`plan-${_detailPlan}`));
  }
  closePlanDetail();
}

// ── Modal sucesso ─────────────────────────────────────────────────
function showSuccessModal(planType) {
  const planName = planType === 'full' ? t('plan.full') : t('plan.basic');
  const badge    = document.getElementById('success-plan-name');
  if (badge) badge.textContent = `Plano ${planName}`;
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.add('visible');
}

// ── Pagamento ─────────────────────────────────────────────────────
async function handlePayment() {
  const btn       = document.getElementById('btn-generate');
  const loading   = document.getElementById('loading');
  const pixResult = document.getElementById('pix-result');
  const cpfInput  = document.getElementById('user-cpf');

  const cpfValue = cpfInput ? cpfInput.value.replace(/\D/g, '') : '';
  
  if (!cpfValue || (cpfValue.length !== 11 && cpfValue.length !== 14)) {
    showToast("Por favor, informe um CPF ou CNPJ válido.", "error");
    if (cpfInput) cpfInput.focus();
    return;
  }

  pixResult.classList.remove('visible');
  pixResult.style.display = 'none';
  btn.disabled    = true;
  loading.style.display = 'block';

  try {
    // 1. Salva o CPF no perfil do usuário no Supabase primeiro
    try {
        const updateRes = await apiPut('/profile/', { cpf: cpfValue, cpf_cnpj: cpfValue });
        if (!updateRes.ok) console.warn("Aviso: Falha ao salvar CPF no perfil, mas tentando prosseguir com pagamento...", updateRes.data);
    } catch (profileErr) {
        console.error("Erro ao atualizar perfil:", profileErr);
        // Não bloqueia o pagamento se apenas o save no profile falhar (o Asaas pode ter sucesso se o CPF já estiver lá)
    }

    // 2. Cria a cobrança no Asaas
    const value   = selectedPlan === 'basic' ? 19.90 : 39.90;
    const payload = {
      billingType: selectedMethod,
      planType:    selectedPlan,
      value,
      description: `Assinatura Teacher Tati — Plano ${selectedPlan}`
    };

    const res = await apiPost('/payments/create', payload);
    if (!res.ok) throw new Error(res.data?.detail || t('gen.error'));

    const data = res.data;

    if (selectedMethod === 'PIX') {
      // Exibe QR Code
      document.getElementById('qr-code-img').src     = `data:image/png;base64,${data.pixQrCode}`;
      document.getElementById('pix-copy-paste').textContent = data.pixCopyPaste;
      document.getElementById('invoice-link').href   = data.invoiceUrl;
      pixResult.classList.add('visible');
      pixResult.style.display = 'flex';

      // Inicia polling para confirmar pagamento
      _pollPaymentStatus(data.paymentId, selectedPlan);

    } else {
      // Boleto ou Cartão → abre fatura do Asaas
      showToast(t('payment.invoice_opening'));
      window.open(data.invoiceUrl, '_blank');

      // Polling após abrir a fatura
      _pollPaymentStatus(data.paymentId, selectedPlan);
    }

  } catch (err) {
    showToast((t('gen.error') || 'Erro') + ': ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

// ── Polling de status ─────────────────────────────────────────────
let _pollTimer = null;

async function _pollPaymentStatus(paymentId, planType, attempts = 0) {
  if (attempts > 40) return; // desiste após ~3 minutos

  try {
    const res = await apiGet('/payments/status');
    if (res?.status === 'active') {
      clearTimeout(_pollTimer);
      showSuccessModal(planType);
      return;
    }
  } catch (_) { /* silencioso */ }

  _pollTimer = setTimeout(() => _pollPaymentStatus(paymentId, planType, attempts + 1), 5000);
}

async function copyPix() {
  const text = document.getElementById('pix-copy-paste').textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('payment.pix_copied'));
  } catch {
    showToast('Erro ao copiar. Copie manualmente.', 'error');
  }
}