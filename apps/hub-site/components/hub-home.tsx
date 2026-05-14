'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  apiGet,
  apiPost,
  clearStoredSession,
  getAccessToken,
  HUB_ENDPOINTS,
  resolveApiBase,
  type AuthenticatedCheckoutPayload,
  type HubPaymentStatusResponse,
  type GuestCheckoutPayload,
  type GuestCheckoutResponse,
  type PremiumCatalogItem,
  type PremiumCheckoutResponse,
} from '@tati/hub-core';

import {
  CheckCircle,
  Download,
  Lock,
  Zap,
} from 'lucide-react';

import Link from 'next/link';

import { useHubAuth } from '@/components/auth-provider';
import { HubSidebar } from '@/components/hub-sidebar';

type BillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

type CheckoutResult = {
  paymentId: string;
  status: string;
  billingType: BillingType;
  invoiceUrl?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  title: string;
  value: number;
};

const billingOptions: BillingType[] = ['PIX', 'CREDIT_CARD', 'BOLETO'];

function normalizeDocument(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14);
}

function formatDocument(value: string): string {
  const digits = normalizeDocument(value);

  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function resolveCheckoutUrl(result: CheckoutResult | null): string | null {
  if (!result) return null;
  return result.invoiceUrl || null;
}

function resolvePixImageSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
}

export function HubHome() {
  const { isLoaded, logout, refreshProfile, user } = useHubAuth();

  const [items, setItems] = useState<PremiumCatalogItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PremiumCatalogItem | null>(null);
  const [previewItem, setPreviewItem] = useState<PremiumCatalogItem | null>(null);

  const [billingType, setBillingType] = useState<BillingType>('PIX');
  const [documentId, setDocumentId] = useState('');

  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCatalog() {
    try {
      setLoading(true);
      setError(null);

      const catalog = await apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC);
      setItems(catalog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar o catalogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    void loadCatalog();
  }, [isLoaded, user]);

  useEffect(() => {
    if (!checkoutResult?.paymentId || !user) return;

    let cancelled = false;

    const pollPaymentStatus = async () => {
      try {
        const status = await apiGet<HubPaymentStatusResponse>(
          HUB_ENDPOINTS.HUB_PAYMENT_STATUS(checkoutResult.paymentId),
        );

        if (cancelled) return;

        setCheckoutResult((current) => {
          if (!current || current.paymentId !== status.paymentId) {
            return current;
          }

          return {
            ...current,
            status: status.status,
            invoiceUrl: status.invoiceUrl ?? current.invoiceUrl,
            pixQrCode: status.pixQrCode ?? current.pixQrCode,
            pixCopyPaste: status.pixCopyPaste ?? current.pixCopyPaste,
          };
        });

        if (status.status === 'confirmed') {
          setFeedback('Pagamento confirmado. Seu acesso foi liberado.');

          setSelectedItem(null);
          setPreviewItem(null);
          setCheckoutResult(null);

          await refreshProfile();
          await loadCatalog();
        }
      } catch {
        // evita quebrar o polling
      }
    };

    void pollPaymentStatus();

    const interval = window.setInterval(() => {
      void pollPaymentStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkoutResult?.paymentId, refreshProfile, user]);

  async function handleAccess(item: PremiumCatalogItem) {
    try {
      const token = getAccessToken();
      const base = resolveApiBase();

      window.open(
        `${base}/activities/hub/${item.id}/download?token=${token}`,
        '_blank'
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Nao foi possivel abrir o material.');
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedItem) return;

    if (!user) {
    setFeedback('Faça login ou crie uma conta para continuar.');
    window.location.href = '/login?tab=register';
      return;
    }

    const cleanDoc = normalizeDocument(documentId);

    if (cleanDoc.length < 11) {
      setFeedback('Informe um CPF ou CNPJ válido.');
      return;
    }

    setProcessing(true);
    setFeedback(null);

    try {
      const payload: AuthenticatedCheckoutPayload = {
        content_id: selectedItem.id,
        billingType,
        cpf: cleanDoc,
      };

      const result = await apiPost<PremiumCheckoutResponse>(
        HUB_ENDPOINTS.HUB_CHECKOUT,
        payload,
      );

      const response = result.data;

      setCheckoutResult({
        paymentId: response.paymentId,
        status: 'pending',
        billingType,
        invoiceUrl: response.invoiceUrl ?? null,
        pixQrCode: response.pixQrCode ?? null,
        pixCopyPaste: response.pixCopyPaste ?? null,
        title: response.title,
        value: response.value,
      });

      setFeedback('Checkout criado com sucesso.');
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : 'Não foi possível iniciar o checkout.',
      );
    } finally {
      setProcessing(false);
    }
  }

  function handleLogout() {
    clearStoredSession();
    logout();
    void loadCatalog();
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#09040f] via-[#12081f] to-[#1b1031] text-white">
      {user ? (
        <HubSidebar
          userName={user.name}
          onLogout={handleLogout}
          activePage="hub"
        />
      ) : null}

      <main className="flex-1">
        {!user ? (
          <div className="border-b border-violet-500/10 bg-black/20 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <img
            src="/images/tati_logo.jpg"
            alt="Tati AI"
            className="h-8 w-8 rounded-lg object-cover"
          />
          Tati's Hub
        </div>

        <Link
          href="/login?tab=register"
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium transition hover:bg-violet-500"
        >
          Entrar
        </Link>
            </div>
          </div>
        ) : null}

        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
              <Zap size={14} />
              Biblioteca Premium
            </div>

            <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
              Materiais exclusivos da Tati AI
            </h1>

            <p className="max-w-2xl text-base leading-7 text-zinc-400">
              E-books, exercícios comentados, simulados e conteúdos premium.
            </p>
          </div>

          {feedback ? (
            <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-200">
              {feedback}
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-3xl border border-white/5 bg-white/5"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setPreviewItem(item)}
                  className={`group relative overflow-hidden rounded-3xl border border-violet-500/10 bg-gradient-to-br from-[#181028] via-[#140d20] to-[#0f0a18] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.25)] ${item.has_access ? 'ring-1 ring-emerald-500/30' : ''
                    }`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="relative z-10">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl backdrop-blur-sm">
                        {item.emoji || '📘'}
                      </div>

                      {item.has_access ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle size={11} />
                          Liberado
                        </span>
                      ) : (
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300">
                          R$ {item.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <h3 className="mb-2 line-clamp-1 text-lg font-semibold text-zinc-100">
                      {item.title}
                    </h3>

                    <p className="mb-5 line-clamp-3 text-sm leading-6 text-zinc-400">
                      {item.description || 'Material exclusivo para download.'}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();

                          if (item.has_access) {
                            void handleAccess(item);
                            return;
                          }

                          if (!user) {
                            window.location.href = '/login';
                            return;
                          }

                          setSelectedItem(item);
                          setCheckoutResult(null);
                          setFeedback(null);
                        }}
                        disabled={processing}
                        className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${item.has_access
                          ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
                          : 'bg-violet-600 text-white hover:bg-violet-500'
                          }`}
                      >
                        {item.has_access ? (
                          <span className="flex items-center justify-center gap-2">
                            <Download size={16} />
                            Baixar agora
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Lock size={14} />
                            Comprar agora
                          </span>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewItem(item);
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
                      >
                        Ver mais
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

  {previewItem ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
    <div className="w-full max-w-2xl overflow-y-auto max-h-[90vh] rounded-3xl border border-violet-500/20 bg-[#120d1d] shadow-[0_0_60px_rgba(139,92,246,0.25)]">
            <div className="relative border-b border-white/5 p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_70%)]" />

              <div className="relative z-10 flex items-start justify-between gap-6">
                <div>
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl">
                    {previewItem.emoji || '📘'}
                  </div>

                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-violet-400">
                    Material Premium
                  </p>

                  <h2 className="mb-3 text-3xl font-bold tracking-tight text-white">
                    {previewItem.title}
                  </h2>

                  <div className="inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1 text-sm font-semibold text-violet-300">
                    R$ {previewItem.price.toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => setPreviewItem(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="space-y-6 p-8">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-violet-400">
                  Sobre o material
                </h3>

                <p className="text-sm leading-7 text-zinc-300">
                  {previewItem.description ||
                    'Material exclusivo preparado para acelerar seus estudos e aprendizado.'}
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/5 bg-black/20 p-5 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
                    Formato
                  </p>

                  <p className="text-sm font-medium text-zinc-100">
                    PDF / Digital
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
                    Acesso
                  </p>

                  <p className="text-sm font-medium text-zinc-100">
                    Vitalício
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
                    Categoria
                  </p>

                  <p className="text-sm font-medium text-zinc-100">
                    Premium
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                {previewItem.has_access ? (
                  <button
                    onClick={() => {
                      void handleAccess(previewItem);
                    }}
                    className="flex-1 rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Download size={16} />
                      Baixar agora
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedItem(previewItem);
                      setPreviewItem(null);
                      setCheckoutResult(null);
                      setFeedback(null);
                    }}
                    className="flex-1 rounded-2xl bg-violet-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-violet-500"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Lock size={16} />
                      Comprar agora
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setPreviewItem(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-medium text-zinc-300 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

  {selectedItem ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
    <div className="w-full max-w-xl overflow-y-auto max-h-[90vh] rounded-3xl border border-violet-500/20 bg-[#120d1d] p-8 shadow-[0_0_60px_rgba(139,92,246,0.25)]">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-violet-400">
                  Checkout
                </p>

                <h2 className="text-2xl font-bold text-white">
                  {selectedItem.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCheckout} className="space-y-5">
              {!user ? (
                <>
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition focus:border-violet-500/50"
                  />

                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition focus:border-violet-500/50"
                  />
                </>
              ) : null}

              <input
                value={documentId}
                onChange={(e) => setDocumentId(formatDocument(e.target.value))}
                placeholder="CPF ou CNPJ"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition focus:border-violet-500/50"
              />

              <div className="grid grid-cols-3 gap-3">
                {billingOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBillingType(option)}
                    className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition ${billingType === option
                      ? 'border-violet-500/50 bg-violet-500/20 text-violet-200'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white'
                      }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full rounded-2xl bg-violet-600 py-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {processing ? 'Criando checkout...' : 'Continuar para pagamento'}
              </button>
            </form>

            {checkoutResult ? (
              <div className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-5">
                <p className="mb-3 text-sm font-semibold text-violet-200">
                  Pagamento criado
                </p>

                {checkoutResult.billingType === 'PIX' ? (
                  <div className="space-y-4">
                    {resolvePixImageSrc(checkoutResult.pixQrCode) ? (
                      <img
                        src={resolvePixImageSrc(checkoutResult.pixQrCode) as string}
                        alt="PIX"
                        className="mx-auto h-44 w-44 rounded-2xl bg-white p-2"
                      />
                    ) : null}

                    {checkoutResult.pixCopyPaste ? (
                      <div className="break-all rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-300">
                        {checkoutResult.pixCopyPaste}
                      </div>
                    ) : null}
                  </div>
                ) : resolveCheckoutUrl(checkoutResult) ? (
                  <a
                    href={resolveCheckoutUrl(checkoutResult) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                  >
                    Abrir cobrança
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
