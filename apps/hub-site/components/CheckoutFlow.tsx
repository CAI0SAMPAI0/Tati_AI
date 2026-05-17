'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingCart, CheckCircle, Lock, X, Loader2, XCircle, RefreshCw, Clock } from 'lucide-react';
import { resolveApiUrl } from '@/lib/catalog';
import { useHubAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { loginWithCredentials, getStoredSession } from '@tati/hub-core';

interface CheckoutFlowProps {
  item: {
    id: string;
    title: string;
    price: number;
  };
  onAccessGranted?: () => void;
}

export default function CheckoutFlow({ item, onAccessGranted }: CheckoutFlowProps) {
  const { user, token, saveSession } = useHubAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'payment' | 'confirmed' | 'cancelled'>('form');
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'confirmed' | 'error'>('idle');
  const [contentIsProcessing, setContentIsProcessing] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cpf, setCpf] = useState(user?.cpf || (user as any)?.cpf_cnpj || '');
  const [billingType, setBillingType] = useState('PIX');

  const [checkoutResult, setCheckoutResult] = useState<{
    paymentId?: string;
    pix?: { qrCode: string; copyPaste: string };
    invoiceUrl?: string;
    username?: string;
  } | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 60; // 5 minutos checando a cada 5s

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || '');
      setEmail((prev) => prev || user.email || '');
      setCpf((prev: string) => prev || (user as { cpf?: string; cpf_cnpj?: string }).cpf || (user as { cpf_cnpj?: string }).cpf_cnpj || '');
    }
  }, [user]);

  // Limpeza do polling ao fechar a modal
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const handleClose = useCallback(() => {
    stopPolling();
    setIsOpen(false);
    // Reseta para próxima abertura
    setTimeout(() => {
      setStep('form');
      setCheckoutResult(null);
      setPollingStatus('idle');
    }, 300);
  }, [stopPolling]);

  // Polling: verifica se o acesso foi liberado no backend
  const startPolling = useCallback((paymentId: string) => {
    setPollingStatus('polling');
    pollCountRef.current = 0;

    pollingRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > MAX_POLLS) {
        stopPolling();
        setPollingStatus('error');
        return;
      }

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const currentSession = getStoredSession();
        const activeToken = token || currentSession?.token;
        if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

        const res = await fetch(`${resolveApiUrl()}/activities/hub/${item.id}/access`, {
          headers,
        });

        if (res.ok) {
          // 200 = acesso liberado e conteúdo pronto
          stopPolling();
          setContentIsProcessing(false);
          setPollingStatus('confirmed');
          setStep('confirmed');
          onAccessGranted?.();
          return;
        }

        if (res.status === 409) {
          // 409 = pagamento confirmado mas material ainda processando
          stopPolling();
          setContentIsProcessing(true);
          setPollingStatus('confirmed');
          setStep('confirmed');
          onAccessGranted?.();
          return;
        }

        // 403 = ainda não pago, continua polling
        // Outros erros: continua tentando
      } catch {
        // Erro de rede, tenta de novo no próximo ciclo
      }
    }, 5000);
  }, [item.id, token, stopPolling, onAccessGranted]);


  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        .substring(0, 14);
    }
    return digits
      .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      .substring(0, 18);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const res = await fetch(`${resolveApiUrl()}/catalog/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: item.id,
          name,
          email,
          cpf,
          billingType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao processar checkout');
      }

      const data = await res.json();
      setCheckoutResult(data);

      // Se um novo usuário com senha temporária foi gerado, realiza o login automático imediatamente
      if (data.username && data.password) {
        try {
          const loginRes = await loginWithCredentials(data.username, data.password);
          if (loginRes?.data?.access_token && loginRes?.data?.user) {
            saveSession(loginRes.data.access_token, loginRes.data.user);
          }
        } catch (loginErr) {
          console.error("Erro ao autenticar automaticamente o novo usuário:", loginErr);
        }
      }

      setStep('payment');

      // Inicia o polling para detectar confirmação automática
      if (data.paymentId) {
        startPolling(data.paymentId);
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Erro no checkout');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!checkoutResult?.paymentId) return;
    setCancelling(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${resolveApiUrl()}/catalog/checkout/${checkoutResult.paymentId}/cancel`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erro ao cancelar pedido');
      }

      stopPolling();
      setStep('cancelled');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally {
      setCancelling(false);
    }
  };

  // ── Conteúdo do passo "aguardando pagamento" ───────────────────────────────
  const PaymentStep = () => (
    <div className="py-2 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        {pollingStatus === 'polling' ? (
          <Loader2 size={32} className="animate-spin" />
        ) : pollingStatus === 'error' ? (
          <RefreshCw size={32} />
        ) : (
          <CheckCircle size={32} />
        )}
      </div>

      <h4 className="font-display text-xl font-bold text-ink">Pedido gerado!</h4>
      <p className="mt-2 text-sm text-muted">
        {pollingStatus === 'polling'
          ? 'Aguardando confirmação do pagamento...'
          : pollingStatus === 'error'
          ? 'Tempo esgotado. Recarregue a página após pagar.'
          : 'Finalize o pagamento para liberar o acesso.'}
      </p>

      {pollingStatus === 'polling' && (
        <p className="mt-1 text-xs text-subtle">A liberação é automática. Esta tela vai atualizar sozinha ✓</p>
      )}

      {checkoutResult?.pix ? (
        <div className="mt-6 space-y-4">
          <div className="inline-block rounded-hub border border-line bg-white p-3">
            <img
              src={`data:image/png;base64,${checkoutResult.pix.qrCode}`}
              alt="QR Code PIX"
              className="h-44 w-44"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(checkoutResult.pix!.copyPaste);
              alert('Código PIX copiado!');
            }}
            className="btn-secondary w-full"
          >
            Copiar código PIX
          </button>
        </div>
      ) : (
        <a
          href={checkoutResult?.invoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6 inline-block w-full py-3 text-center"
        >
          Ver boleto / fatura
        </a>
      )}

      {checkoutResult?.username && (
        <p className="mt-4 rounded-hub border border-line bg-primarySoft p-4 text-left text-xs text-muted">
          Conta: <strong className="text-ink">{checkoutResult.username}</strong>.
          Após a confirmação do pagamento, acesse com o e-mail informado.
        </p>
      )}

      {/* Botão de cancelar */}
      <button
        type="button"
        disabled={cancelling || pollingStatus === 'confirmed'}
        onClick={handleCancel}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-hub border border-line py-2.5 text-xs font-bold text-error transition hover:bg-error/5 disabled:opacity-40"
      >
        {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
        {cancelling ? 'Cancelando...' : 'Cancelar pedido'}
      </button>
    </div>
  );

  // ── Passo: pagamento confirmado ────────────────────────────────────────────
  const ConfirmedStep = () => (
    <div className="py-4 text-center">
      <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
        contentIsProcessing ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
      }`}>
        {contentIsProcessing ? <Clock size={40} /> : <CheckCircle size={40} />}
      </div>

      <h4 className="font-display text-2xl font-bold text-ink">
        {contentIsProcessing ? 'Pagamento confirmado!' : 'Acesso liberado!'}
      </h4>

      <p className="mt-3 text-sm text-muted">
        {contentIsProcessing
          ? 'Seu pagamento foi aprovado! O material está sendo preparado e ficará disponível em breve na sua biblioteca.'
          : 'Pagamento confirmado. O material já está disponível na sua biblioteca.'}
      </p>

      {contentIsProcessing && (
        <p className="mt-3 rounded-hub border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          ⏳ O arquivo ainda está sendo processado pelo servidor. Volte em alguns minutos.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          handleClose();
          router.push('/materiais');
        }}
        className="btn-primary mt-8 w-full py-3"
      >
        Ir para meus materiais
      </button>
    </div>
  );

  // ── Passo: pedido cancelado ────────────────────────────────────────────────
  const CancelledStep = () => (
    <div className="py-4 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
        <XCircle size={32} />
      </div>
      <h4 className="font-display text-xl font-bold text-ink">Pedido cancelado</h4>
      <p className="mt-2 text-sm text-muted">
        O pedido foi cancelado com sucesso. Você pode fazer um novo pedido a qualquer momento.
      </p>
      <button
        type="button"
        onClick={() => {
          setStep('form');
          setCheckoutResult(null);
          setPollingStatus('idle');
        }}
        className="btn-primary mt-6 w-full py-3"
      >
        Fazer novo pedido
      </button>
    </div>
  );

  const modalContent = isOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm cursor-default"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg overflow-hidden rounded-hub border border-line bg-surface shadow-card animate-fade-in"
      >
        <div className="flex items-start justify-between border-b border-line p-6">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">{item.title}</h3>
            <p className="mt-1 text-lg font-bold text-primary">
              R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-muted hover:bg-bgSecondary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {step === 'form' && (
            <form onSubmit={handleCheckout} className="space-y-5">
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-subtle">
                  Identificação
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-hub"
                  placeholder="Nome completo"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={!!user?.email}
                    className={`input-hub ${user?.email ? 'opacity-70 cursor-not-allowed' : ''}`}
                    placeholder="E-mail"
                  />
                  <input
                    required
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    className="input-hub"
                    placeholder="CPF / CNPJ"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-subtle">
                  Forma de pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['PIX', 'BOLETO', 'CREDIT_CARD'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBillingType(type)}
                      className={`rounded-hub border py-2.5 text-[10px] font-bold uppercase tracking-wide transition ${
                        billingType === type
                          ? 'border-primary bg-primary text-white'
                          : 'border-line bg-bgSecondary text-muted hover:border-primary'
                      }`}
                    >
                      {type === 'CREDIT_CARD' ? 'Cartão' : type}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="btn-primary flex w-full items-center justify-center gap-2 py-4"
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Finalizar pedido
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'payment' && <PaymentStep />}
          {step === 'confirmed' && <ConfirmedStep />}
          {step === 'cancelled' && <CancelledStep />}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base shadow-glow"
      >
        <ShoppingCart size={20} />
        Comprar agora
      </button>

      {mounted && isOpen && createPortal(modalContent, document.body)}
    </>
  );
}
