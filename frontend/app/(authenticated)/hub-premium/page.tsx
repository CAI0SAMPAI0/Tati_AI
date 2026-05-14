'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Lock,
  Download,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { apiGet, apiPost } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { PixModal } from '@/components/payment/pix-modal';
import { RedirectModal } from '@/components/payment/redirect-modal';
import { CheckoutModal } from '@/components/payment/checkout-modal';
import { cn } from '@/lib/utils';
import { HUB_ENDPOINTS, type PremiumCatalogItem } from '@tati/hub-core';

interface PremiumContent {
  id: string;
  title: string;
  description: string;
  price: number;
  type: 'pdf' | 'link' | 'article' | 'video';
  content_source: string | null;
  emoji: string;
  is_purchased: boolean;
}

interface PaymentInfo {
  paymentId: string;
  invoiceUrl: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  value: number;
  title: string;
  billingType?: string;
}

function mapCatalogItem(item: PremiumCatalogItem): PremiumContent {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? '',
    price: item.price,
    type: item.type as PremiumContent['type'],
    content_source: item.content_source ?? null,
    emoji: item.emoji ?? '📚',
    is_purchased: item.has_access,
  };
}

export default function PremiumHubPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<PremiumContent | null>(null);
  const [pixData, setPixData] = useState<PaymentInfo | null>(null);
  const [redirectData, setRedirectData] = useState<PaymentInfo | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

  const { data: contents = [], isLoading } = useQuery<PremiumContent[]>({
    queryKey: ['premium-contents'],
    queryFn: async () => {
      const items = await apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC);
      return items.map(mapCatalogItem);
    },
  });

  const handleAccess = async (item: PremiumContent) => {
    if (!item.is_purchased && item.price > 0) {
      setSelectedItem(item);
      setShowCheckout(true);
      return;
    }

    try {
      const res = await apiGet<{ url: string }>(HUB_ENDPOINTS.HUB_ACCESS(item.id));
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error accessing content.');
    }
  };

  const handleBuy = async (_doc: string, method: string) => {
    if (!selectedItem) return;
    setIsInitiatingPayment(true);

    try {
      const res = await apiPost<PaymentInfo>(HUB_ENDPOINTS.HUB_CHECKOUT, {
        content_id: selectedItem.id,
        billingType: method,
      });

      if (res.ok && res.data) {
        setShowCheckout(false);
        if (method === 'PIX' && res.data.pixQrCode) {
          setPixData({ ...res.data, billingType: 'PIX' });
        } else {
          setRedirectData({ ...res.data, billingType: method });
        }
      } else {
        toast.error('Error generating payment. Please try again.');
      }
    } catch {
      toast.error('Connection error.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-secondary/30 pb-20">
      <header className="bg-bg border-b border-border sticky top-0 z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-surface border border-border text-text-muted hover:text-primary hover:border-primary/50 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary shadow-glow">
                <Zap size={22} fill="currentColor" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text">Premium Hub</h1>
                <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
                  Exclusive Materials & Tools
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <section className="mb-12 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 rounded-3xl border border-primary/10 relative overflow-hidden group">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl font-black text-text mb-4 leading-tight">
              Unlock Your <span className="text-primary italic">Full Potential</span> with Premium Content
            </h2>
            <p className="text-text-subtle mb-6 leading-relaxed">
              Access curated PDFs, interactive NotebookLM links, and specialized guides created by Tatiana to
              accelerate your English journey.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-bg bg-bg-secondary flex items-center justify-center text-[10px] font-bold"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-text-muted">Join hundreds of students leveling up.</p>
            </div>
          </div>
          <Sparkles className="absolute top-1/2 -right-10 -translate-y-1/2 text-primary/10 w-64 h-64 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {contents.map((item) => (
            <div
              key={item.id}
              className={cn(
                'bg-surface border border-border rounded-3xl overflow-hidden flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 group',
                item.is_purchased ? 'border-success/30' : 'hover:border-primary/40',
              )}
            >
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                    {item.emoji}
                  </div>
                  {item.is_purchased ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full text-[0.65rem] font-black uppercase tracking-widest border border-success/20">
                      <CheckCircle2 size={12} /> Unlocked
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[0.65rem] font-black uppercase tracking-widest border border-primary/20">
                      R$ {item.price}
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-text mb-2 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed line-clamp-3 mb-6">{item.description}</p>

                <div className="mt-auto">
                  <Button
                    variant={item.is_purchased ? 'secondary' : 'primary'}
                    className="w-full justify-between group/btn"
                    onClick={() => handleAccess(item)}
                    loading={isInitiatingPayment && selectedItem?.id === item.id}
                  >
                    <span className="flex items-center gap-2">
                      {item.is_purchased ? (
                        item.type === 'link' ? <ExternalLink size={16} /> : <Download size={16} />
                      ) : (
                        <Lock size={16} />
                      )}
                      {item.is_purchased ? 'Access Content' : 'Unlock Now'}
                    </span>
                    <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showCheckout && selectedItem && (
        <CheckoutModal
          plan={{
            id: selectedItem.id,
            name: selectedItem.title,
            price: selectedItem.price,
            description: selectedItem.description,
            features: [],
          }}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleBuy}
          isProcessing={isInitiatingPayment}
        />
      )}

      {pixData && (
        <PixModal
          qrCode={pixData.pixQrCode || ''}
          payload={pixData.pixCopyPaste || ''}
          value={pixData.value}
          title={pixData.title}
          paymentId={pixData.paymentId}
          onClose={() => {
            setPixData(null);
            queryClient.invalidateQueries({ queryKey: ['premium-contents'] });
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['premium-contents'] });
          }}
        />
      )}

      {redirectData && (
        <RedirectModal
          method={redirectData.billingType as any}
          url={redirectData.invoiceUrl}
          value={redirectData.value}
          title={redirectData.title}
          paymentId={redirectData.paymentId}
          onClose={() => {
            setRedirectData(null);
            queryClient.invalidateQueries({ queryKey: ['premium-contents'] });
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['premium-contents'] });
          }}
        />
      )}
    </div>
  );
}
