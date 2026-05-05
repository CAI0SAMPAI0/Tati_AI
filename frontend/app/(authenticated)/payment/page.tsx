'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { CheckoutModal } from '@/components/payment/checkout-modal';

import { Check, Zap, Crown } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="text-center space-y-2">
              <h1 className="text-3xl font-display font-bold text-text">{'Upgrade to Premium'}</h1>
              <p className="text-text-muted">{'Choose your plan'}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans?.map(plan => (
                <div key={plan.id} className="bg-surface border border-border p-6 rounded-3xl space-y-6 shadow-sm">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    {plan.highlight && <Crown className="text-primary" />}
                  </div>
                  <p className="text-text-muted text-sm">{plan.description}</p>
                  <div className="space-y-3">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-text">
                        <Check size={16} className="text-success" /> {f}
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" onClick={() => setSelectedPlan(plan)}>
                    {'Select'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

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
