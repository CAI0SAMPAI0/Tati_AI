'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { Download, Lock, Zap, CheckCircle } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api/client';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { CheckoutModal } from '@/components/payment/checkout-modal';
import { PixModal } from '@/components/payment/pix-modal';
import { RedirectModal } from '@/components/payment/redirect-modal';
import toast from 'react-hot-toast';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface PremiumContent {
  id: string;
  title: string;
  description?: string;
  price: number;
  type: string;
  thumbnail_url?: string;
  emoji?: string;
  has_access: boolean;
}

interface CheckoutResponse {
  paymentId: string;
  invoiceUrl: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  value: number;
  title: string;
  billingType?: string; // Adicionado para facilitar o modal
}

export default function HubPage() {
  const { user, isLoaded } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PremiumContent | null>(null);
  const [pixData, setPixData] = useState<CheckoutResponse | null>(null);
  const [redirectData, setRedirectData] = useState<{ url: string, value: number, title: string, method: any } | null>(null);

  const { data: contents = [], isLoading, refetch } = useQuery<PremiumContent[]>({
    queryKey: ['hub-contents'],
    queryFn: () => apiGet<PremiumContent[]>('/activities/hub'),
  });

  useEffect(() => {
    if (isLoaded && user) {
      const isAdmin = user.role === 'admin';
      const isBlockedUser = user.username === 'caio.sampaio';
      
      if (!isAdmin || isBlockedUser) {
        toast.error('Acesso restrito apenas para administradores.');
        router.push('/chat');
      }
    }
  }, [user, isLoaded, router]);

  if (!isLoaded || !user || user.role !== 'admin' || user.username === 'caio.sampaio') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const checkoutMutation = useMutation({
    mutationFn: async ({ contentId, doc, method }: { contentId: string, doc: string, method: string }) => {
      // 1. Atualiza CPF se necessário
      await apiPut('/profile/', { cpf: doc, cpf_cnpj: doc });
      // 2. Checkout Hub
      return await apiPost<CheckoutResponse>('/activities/hub/checkout', { 
        content_id: contentId,
        billingType: method
      }).then(res => {
        if (res.ok) return { ...res.data, billingType: method };
        throw res;
      });
    },
    onSuccess: (res: any) => {
      setSelectedItem(null);
      if (res.pixQrCode) {
        setPixData(res);
      } else if (res.invoiceUrl) {
        setRedirectData({
          url: res.invoiceUrl,
          value: res.value,
          title: res.title,
          method: res.billingType
        });
      }
    },
    onError: (err: any) => {
      const detail = err?.data?.detail || err.response?.data?.detail || 'Erro ao processar pagamento.';
      toast.error(detail);
    }
  });

  const handleAction = async (item: PremiumContent) => {
    if (!item.has_access) {
      setSelectedItem(item);
      return;
    }

    try {
      // Usamos o endpoint de download que retorna o stream com o nome correto do arquivo
      const { API_BASE } = await import('@/lib/api/client');
      const token = localStorage.getItem('token');
      const downloadUrl = `${API_BASE}/activities/hub/${item.id}/download?token=${token}`;
      window.open(downloadUrl, '_blank');
    } catch (err: any) {
      toast.error('Erro ao preparar o download.');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <header className="mb-8">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-text mb-2 flex items-center gap-3">
              <Zap className="text-primary" /> Hub de Conteúdos
            </h2>
            <p className="text-text-muted text-sm md:text-base max-w-2xl">
              Download de materiais exclusivos, e-books e exercícios avançados preparados pela Tati.
            </p>
          </header>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {contents.map((item) => (
                <div 
                  key={item.id}
                  className={cn(
                    "group relative bg-surface border rounded-3xl p-5 transition-all hover:shadow-xl hover:scale-[1.02]",
                    item.has_access ? "border-success/30 bg-success/5" : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-bg-secondary flex items-center justify-center text-2xl shadow-inner">
                      {item.emoji || '📄'}
                    </div>
                    {item.has_access ? (
                      <span className="bg-success/20 text-success text-[0.6rem] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle size={10} /> Released
                      </span>
                    ) : (
                      <span className="bg-primary text-white text-[0.7rem] font-black px-2 py-1 rounded-lg">
                        R$ {item.price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-lg text-text mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-text-muted text-sm line-clamp-2 mb-6 h-10">
                    {item.description || 'Material exclusivo para download.'}
                  </p>

                  <button
                    onClick={() => handleAction(item)}
                    disabled={checkoutMutation.isPending}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all",
                      item.has_access 
                        ? "bg-success text-white hover:bg-success-dark shadow-success/20"
                        : "bg-surface-hover text-text border border-border hover:border-primary/50",
                      checkoutMutation.isPending && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {item.has_access ? (
                      <><Download size={18} /> Download File</>
                    ) : (
                      <>
                        {checkoutMutation.isPending && selectedItem?.id === item.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <Lock size={16} className="opacity-50" />
                        )}
                        Buy now
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {contents.length === 0 && !isLoading && (
            <div className="text-center py-20 bg-surface border border-dashed border-border rounded-[2rem]">
              <p className="text-text-muted">Nenhum conteúdo disponível no momento.</p>
            </div>
          )}
        </main>
      </div>

      {selectedItem && (
        <CheckoutModal 
          title="Comprar Conteúdo"
          plan={{
            id: selectedItem.id,
            name: selectedItem.title,
            price: selectedItem.price,
            description: selectedItem.description || '',
            features: []
          }}
          onClose={() => setSelectedItem(null)}
          isProcessing={checkoutMutation.isPending}
          onConfirm={(doc, method) => checkoutMutation.mutate({ contentId: selectedItem.id, doc, method })}
        />
      )}

      {pixData && (
        <PixModal 
          qrCode={pixData.pixQrCode || ''}
          payload={pixData.pixCopyPaste || ''}
          value={pixData.value}
          title={pixData.title}
          invoiceUrl={pixData.invoiceUrl}
          onClose={() => {
            setPixData(null);
            refetch();
          }}
        />
      )}

      {redirectData && (
        <RedirectModal 
          method={redirectData.method}
          url={redirectData.url}
          value={redirectData.value}
          title={redirectData.title}
          onClose={() => {
            setRedirectData(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
