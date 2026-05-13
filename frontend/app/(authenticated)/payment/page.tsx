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

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

interface SubscribeResponse {
  invoiceUrl?: string;
}

export default function PaymentPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => apiGet('/payments/plans'),
  });

  const subscribeMutation = useMutation({
    mutationFn: async ({ planId, doc }: { planId: string, doc: string }) => {
      // 1. Update profile CPF
      await apiPut('/profile/', { cpf: doc, cpf_cnpj: doc });
      // 2. Subscribe
      return await apiPost<SubscribeResponse>('/payments/subscribe', { 
        planType: planId,
        billingType: 'PIX' // Default para PIX como no legado
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success('Saved successfully!');
        if (res.data.invoiceUrl) window.open(res.data.invoiceUrl, '_blank');
        setSelectedPlan(null);
      }
    },
    onError: () => toast.error('Error. Please try again.'),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse delay-1000" />
      </div>

      <header className="p-6 flex justify-between items-center relative z-10">
        <div className="text-xl font-bold tracking-tight">
          Teacher <span className="text-blue-400">Tati</span>
        </div>
        <Link href="/chat" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={20} />
          <span>Voltar</span>
        </Link>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center relative z-10">
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-700">
          <header className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-purple-200">
              {'Unlock Premium'}
            </h1>
            <p className="text-white/60 text-lg max-w-lg mx-auto">{'Elevate your learning experience with unlimited access.'}</p>
          </header>

          <div className="flex justify-center">
            <div className="grid grid-cols-1 gap-6 max-w-sm w-full">
              {plans?.filter(p => p.id === 'full').map(plan => (
                <div key={plan.id} className="relative group p-8 rounded-[2rem] bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:scale-[1.02] hover:border-blue-500/50">
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent opacity-50" />
                  
                  <div className="relative space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-bold tracking-tight">{plan.name}</h3>
                      <div className="p-2 rounded-full bg-blue-500/10 text-blue-400">
                        <Zap size={20} fill="currentColor" />
                      </div>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{plan.description}</p>
                    <div className="space-y-3">
                      {plan.features?.map(f => (
                        <div key={f} className="flex items-center gap-3 text-sm font-medium">
                          <Check size={18} className="text-blue-400" /> {f}
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-blue-50 hover:text-blue-900 transition-all" 
                      onClick={() => setSelectedPlan(plan)}
                    >
                      {'Upgrade Now'}
                    </Button>
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
          onConfirm={(doc) => subscribeMutation.mutate({ planId: selectedPlan.id, doc })}
          isProcessing={subscribeMutation.isPending}
        />
      )}
    </div>
  );
}
