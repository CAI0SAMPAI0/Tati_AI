'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui/spinner';
import {
  apiGet,
  apiPost,
  HUB_ENDPOINTS,
  type GuestCheckoutResponse,
  type PremiumCatalogItem,
} from '@tati/hub-core';

export default function PublicHubPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [billingType, setBillingType] = useState('PIX');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: contents = [], isLoading } = useQuery<PremiumCatalogItem[]>({
    queryKey: ['public-hub-contents'],
    queryFn: () => apiGet(HUB_ENDPOINTS.HUB_PUBLIC),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const res = await apiPost<GuestCheckoutResponse>(HUB_ENDPOINTS.HUB_CHECKOUT_GUEST, {
        content_id: contentId,
        billingType,
        name,
        email,
        cpf,
      }, { auth: false });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.pixCopyPaste) {
        navigator.clipboard.writeText(data.pixCopyPaste).catch(() => null);
        toast.success('PIX copiado. Finalize o pagamento no banco.');
      }
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
      }
    },
    onError: (err: any) => {
      const detail = err?.detail || 'Erro ao iniciar checkout.';
      toast.error(detail);
    },
  });

  return (
    <main className="min-h-screen bg-bg text-text p-6 md:p-10">
      <section className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Tati Hub Premium</h1>
        <p className="text-text-muted mb-8">
          Entre ou crie sua conta Tati AI. Quem já estuda com a Tati usa a mesma conta. 
          Quem ainda não tem acesso pode criar agora ou entrar com Google para aproveitar os materiais do Hub.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <input className="bg-surface border border-border rounded-xl px-3 py-2" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="bg-surface border border-border rounded-xl px-3 py-2" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="bg-surface border border-border rounded-xl px-3 py-2" placeholder="CPF/CNPJ" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        </div>

        <div className="flex gap-2 mb-8">
          {['PIX', 'CREDIT_CARD', 'BOLETO'].map((m) => (
            <button key={m} onClick={() => setBillingType(m)} className={`px-3 py-2 rounded-lg border ${billingType === m ? 'border-primary bg-primary/10' : 'border-border'}`}>
              {m}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contents.map((item) => (
              <article key={item.id} className="bg-surface border border-border rounded-2xl p-5">
                <p className="text-2xl mb-2">{item.emoji || '📦'}</p>
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm text-text-muted mb-4">{item.description || 'Material premium'}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold">R$ {item.price.toFixed(2)}</span>
                  <button
                    onClick={() => {
                      if (!name || !email || !cpf) {
                        toast.error('Preencha nome, e-mail e CPF/CNPJ.');
                        return;
                      }
                      setSelectedId(item.id);
                      checkoutMutation.mutate(item.id);
                    }}
                    disabled={checkoutMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-60"
                  >
                    {checkoutMutation.isPending && selectedId === item.id ? 'Processando...' : 'Comprar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
