'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { CheckoutModal } from '@/components/payment/checkout-modal';

import { Check, Zap, Crown, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { PixModal } from '@/components/payment/pix-modal';
import { RedirectModal } from '@/components/payment/redirect-modal';
import { useRouter } from 'next/navigation';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

interface SubscribeResponse {
  subscriptionId: string;
  paymentId: string;
  invoiceUrl: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  value: number;
  planName: string;
  billingType?: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [pixData, setPixData] = useState<SubscribeResponse | null>(null);
  const [redirectData, setRedirectData] = useState<SubscribeResponse | null>(null);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => apiGet('/payments/plans'),
  });

  const subscribeMutation = useMutation({
    mutationFn: async ({ planId, doc, method }: { planId: string, doc: string, method: string }) => {
      await apiPut('/profile/', { cpf: doc, cpf_cnpj: doc });
      return await apiPost<SubscribeResponse>('/payments/subscribe', { 
        planType: planId,
        billingType: method
      });
    },
    onSuccess: (res, variables) => {
      if (res.ok && res.data) {
        setSelectedPlan(null);
        if (variables.method === 'PIX' && res.data.pixQrCode) {
          setPixData({ ...res.data, billingType: 'PIX' });
        } else {
          setRedirectData({ ...res.data, billingType: variables.method });
        }
      }
    },
    onError: () => toast.error('Erro ao processar assinatura. Tente novamente.'),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-bg"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col relative overflow-hidden">
      <header className="p-6 flex justify-between items-center border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary shadow-glow">
            <Crown size={22} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Premium Plan</h1>
            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Upgrade your experience</p>
          </div>
        </div>
        <Link href="/chat" className="flex items-center gap-2 text-text-muted hover:text-primary transition-colors font-bold text-sm">
          <ArrowLeft size={18} />
          <span>Voltar ao Chat</span>
        </Link>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center">
        <div className="max-w-4xl w-full space-y-12 py-10">
          <header className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Acelere sua fluência com o <span className="text-primary italic">Plano Ilimitado</span>
            </h2>
            <p className="text-text-muted text-lg">Pratique sem limites, acesse conteúdos exclusivos e receba feedbacks pedagógicos detalhados.</p>
          </header>

          <div className="flex justify-center">
            <div className="grid grid-cols-1 gap-8 max-w-sm w-full">
              {plans?.filter(p => p.id === 'full').map(plan => (
                <div key={plan.id} className="relative group p-10 rounded-[2.5rem] bg-surface border-2 border-border shadow-2xl transition-all hover:scale-[1.02] hover:border-primary/50 overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                      <Zap size={24} fill="currentColor" />
                    </div>
                  </div>
                  
                  <div className="relative space-y-8">
                    <div>
                      <h3 className="text-3xl font-black mb-2">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-display font-black text-primary">R$ {plan.price.toFixed(2)}</span>
                        <span className="text-sm font-bold text-text-muted">/mês</span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border border-dashed">
                      {plan.features?.map(f => (
                        <div key={f} className="flex items-start gap-3 text-sm font-bold text-text/80">
                          <Check size={18} className="text-success shrink-0 mt-0.5" /> 
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    <Button 
                      className="w-full h-16 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all mt-4" 
                      onClick={() => setSelectedPlan(plan)}
                    >
                      Assinar Agora
                    </Button>

                    <p className="text-[10px] text-center text-text-subtle font-medium px-4">
                      Assinatura mensal recorrente. Cancele quando quiser diretamente no painel.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {selectedPlan && (
        <CheckoutModal 
          plan={selectedPlan} 
          onClose={() => setSelectedPlan(null)}
          onConfirm={(doc, method) => subscribeMutation.mutate({ planId: selectedPlan.id, doc, method })}
          isProcessing={subscribeMutation.isPending}
        />
      )}

      {pixData && (
        <PixModal 
          qrCode={pixData.pixQrCode || ''}
          payload={pixData.pixCopyPaste || ''}
          value={pixData.value}
          title={pixData.planName}
          paymentId={pixData.paymentId}
          onClose={() => setPixData(null)}
          onSuccess={() => {
            toast.success('Assinatura confirmada!');
            router.push('/chat');
          }}
        />
      )}

      {redirectData && (
        <RedirectModal 
          method={redirectData.billingType as any}
          url={redirectData.invoiceUrl}
          value={redirectData.value}
          title={redirectData.planName}
          paymentId={redirectData.paymentId}
          onClose={() => setRedirectData(null)}
          onSuccess={() => {
            toast.success('Assinatura confirmada!');
            router.push('/chat');
          }}
        />
      )}
    </div>
  );
}
