'use client';

import { useState } from 'react';
import { ExternalLink, X, CreditCard, Receipt, Loader2, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePaymentWebSocket } from '@/hooks/usePaymentWebSocket';
import toast from 'react-hot-toast';

interface RedirectModalProps {
  method: 'CREDIT_CARD' | 'BOLETO';
  url: string;
  value: number;
  title: string;
  paymentId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RedirectModal({ method, url, value, title, paymentId, onClose, onSuccess }: RedirectModalProps) {
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const isCard = method === 'CREDIT_CARD';

  const { status: wsStatus } = usePaymentWebSocket((data) => {
    if (paymentId && data.payment_id !== paymentId) return;
    
    setPaymentConfirmed(true);
    toast.success('Pagamento confirmado!');
    
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 3000);
  }, (data) => {
    toast.error('Pagamento recusado: ' + (data.reason || 'Erro desconhecido'));
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className={cn(
        "bg-surface border border-border rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden transition-all duration-500",
        paymentConfirmed ? "scale-105 border-success/50 shadow-success/20" : "scale-100"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-hover/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={22} fill="currentColor" className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Pagamento</h2>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{title}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-bg text-text-muted transition-colors"
            disabled={paymentConfirmed}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          {paymentConfirmed ? (
            <div className="py-6 flex flex-col items-center space-y-6 animate-in zoom-in fade-in duration-500">
              <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center text-success relative">
                <div className="absolute inset-0 rounded-full border-4 border-success animate-ping opacity-20" />
                <Check size={48} strokeWidth={3} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-text">Tudo Pronto!</h3>
                <p className="text-sm text-text-muted">Seu pagamento foi aprovado e o acesso liberado.</p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary mx-auto shadow-inner">
                  {isCard ? <CreditCard size={44} /> : <Receipt size={44} />}
                </div>
                {/* Status indicator */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface border border-border px-3 py-1 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
                  {wsStatus === 'connected' ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-text">Monitorando...</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-2.5 h-2.5 text-primary animate-spin" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-text">Conectando...</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Valor a pagar</p>
                <p className="text-4xl font-display font-black text-primary">
                  <span className="text-lg font-bold mr-1">R$</span>
                  {value.toFixed(2)}
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-text-muted leading-relaxed">
                  {isCard 
                    ? 'Preencha os dados do cartão no ambiente seguro do Asaas para liberar seu acesso instantaneamente.'
                    : 'Acesse seu boleto bancário abaixo. O acesso será liberado assim que o pagamento for compensado.'}
                </p>

                <Button 
                  className="w-full h-16 text-lg font-black gap-3 shadow-xl shadow-primary/20 rounded-2xl group transition-all hover:scale-[1.02]"
                  onClick={() => {
                    window.open(url, '_blank');
                  }}
                >
                  {isCard ? 'Pagar com Cartão' : 'Ver Boleto Bancário'}
                  <ExternalLink size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Button>

                <Button variant="ghost" className="w-full text-text-muted text-xs font-bold" onClick={onClose}>
                  Fechar Janela
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted bg-surface-hover/50 py-3 rounded-2xl border border-border border-dashed">
                <ShieldCheck size={14} className="text-success" />
                Processado com segurança pelo Asaas
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
