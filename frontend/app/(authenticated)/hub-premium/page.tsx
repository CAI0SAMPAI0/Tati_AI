'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Lock,
  Download,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CreditCard,
  QrCode,
  CheckCircle2,
  Clock
} from 'lucide-react';

import { apiGet, apiPost } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { DialogModal } from '@/components/ui/dialog-modal';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

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
}

export default function PremiumHubPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // O acesso agora está liberado para todos os usuários logados.
  const [selectedItem, setSelectedItem] = useState<PremiumContent | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);

  const { data: contents = [], isLoading } = useQuery<PremiumContent[]>({
    queryKey: ['premium-contents'],
    queryFn: () => apiGet<PremiumContent[]>(ENDPOINTS.PREMIUM_HUB),
  });

  const handleAccess = async (item: PremiumContent) => {
    if (!item.is_purchased && item.price > 0) {
      handleBuy(item);
      return;
    }

    try {
      const res = await apiGet<{ url: string }>(ENDPOINTS.PREMIUM_ACCESS(item.id));
      if (res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error accessing content.');
    }
  };

  const handleBuy = async (item: PremiumContent) => {
    setSelectedItem(item);
    setIsInitiatingPayment(true);
    try {
      const res = await apiPost<PaymentInfo>(ENDPOINTS.PREMIUM_BUY(item.id), { billingType: 'PIX' });
      if (res.ok && res.data) {
        setPaymentInfo(res.data);
        setIsPaymentModalOpen(true);
      } else {
        toast.error('Error generating payment. Please try again.');
      }
    } catch {
      toast.error('Connection error.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const copyPix = () => {
    if (paymentInfo?.pixCopyPaste) {
      navigator.clipboard.writeText(paymentInfo.pixCopyPaste);
      toast.success('PIX code copied!');
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-bg"><Spinner size="lg" /></div>;

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
                <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Exclusive Materials & Tools</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero Section */}
        <section className="mb-12 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 rounded-3xl border border-primary/10 relative overflow-hidden group">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl font-black text-text mb-4 leading-tight">
              Unlock Your <span className="text-primary italic">Full Potential</span> with Premium Content
            </h2>
            <p className="text-text-subtle mb-6 leading-relaxed">
              Access curated PDFs, interactive NotebookLM links, and specialized guides created by Tatiana to accelerate your English journey.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-bg bg-bg-secondary flex items-center justify-center text-[10px] font-bold">
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
                "bg-surface border border-border rounded-3xl overflow-hidden flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 group",
                item.is_purchased ? "border-success/30" : "hover:border-primary/40"
              )}
            >
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform">{item.emoji}</div>
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

                <h3 className="text-lg font-bold text-text mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed line-clamp-3 mb-6">
                  {item.description}
                </p>

                <div className="mt-auto">
                  <Button 
                    variant={item.is_purchased ? "secondary" : "primary"}
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

      {/* Payment Modal */}
      <DialogModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Unlock Premium Material"
      >
        {paymentInfo && (
          <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-center">
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest mb-1">Item to unlock</p>
              <h4 className="text-lg font-black text-text">{paymentInfo.title}</h4>
              <p className="text-2xl font-black text-primary mt-2">R$ {paymentInfo.value}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
                <div className="bg-success/10 p-2 rounded-lg text-success">
                  <QrCode size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text">Payment via PIX</p>
                  <p className="text-[0.7rem] text-text-muted">Instant confirmation & access</p>
                </div>
              </div>

              {paymentInfo.pixQrCode ? (
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="bg-white p-4 rounded-3xl border-4 border-primary/20 shadow-xl">
                    <img src={`data:image/png;base64,${paymentInfo.pixQrCode}`} alt="PIX QR Code" className="w-48 h-48" />
                  </div>
                  <Button variant="secondary" className="w-full gap-2" onClick={copyPix}>
                    Copy PIX Code
                  </Button>
                </div>
              ) : (
                <div className="py-4 text-center space-y-4">
                  <div className="p-4 bg-warning/10 text-warning border border-warning/20 rounded-2xl text-xs font-medium">
                    PIX QR Code is currently unavailable in this environment. 
                    Please use the secure checkout link below.
                  </div>
                  <Button className="w-full gap-2" onClick={() => window.open(paymentInfo.invoiceUrl, '_blank')}>
                    <ExternalLink size={18} /> Open Secure Checkout
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 justify-center text-text-muted bg-bg-secondary/50 py-3 rounded-xl border border-border border-dashed">
                <Clock size={14} />
                <p className="text-[0.7rem] font-medium">Valid for 30 minutes</p>
              </div>

              <div className="pt-2">
                <a 
                  href={paymentInfo.invoiceUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="block text-center text-xs font-bold text-text-muted hover:text-primary transition-colors underline underline-offset-4"
                >
                  Prefer other payment methods (Card/Boleto)? Click here.
                </a>
              </div>
            </div>

            <Button className="w-full mt-6" onClick={() => {
              toast.success("We'll unlock it as soon as we receive the confirmation!");
              setIsPaymentModalOpen(false);
            }}>
              I've paid, close this
            </Button>
          </div>
        )}
      </DialogModal>
    </div>
  );
}
