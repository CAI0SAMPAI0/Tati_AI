'use client';

import { useState, useEffect } from 'react';
import { Check, Copy, ExternalLink, X, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { usePaymentWebSocket } from '@/hooks/usePaymentWebSocket';

interface PixModalProps {
  qrCode: string;
  payload: string;
  value: number;
  title: string;
  paymentId?: string;
  invoiceUrl?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PixModal({ qrCode, payload, value, title, paymentId, invoiceUrl, onClose, onSuccess }: PixModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  
  const { status: wsStatus } = usePaymentWebSocket((data) => {
    // If we have a specific paymentId, verify it matches
    if (paymentId && data.payment_id !== paymentId) return;
    
    setPaymentConfirmed(true);
    toast.success('Pagamento confirmado com sucesso!');
    
    // Auto-close after success animation
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 3000);
  }, (data) => {
    toast.error('Pagamento recusado: ' + (data.reason || 'Erro desconhecido'));
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(payload);
    setIsCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 dark:bg-black/85 animate-in fade-in duration-200">
      <div className={cn(
        "bg-surface border border-border rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden transition-all duration-300 transform-gpu",
        paymentConfirmed ? "scale-105 border-success/50 shadow-success/20" : "scale-100"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-hover/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={22} fill="currentColor" className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Pagamento PIX</h2>
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

        <div className="p-8 flex flex-col items-center">
          {paymentConfirmed ? (
            <div className="py-12 flex flex-col items-center space-y-6 animate-in zoom-in fade-in duration-500">
              <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center text-success relative">
                <div className="absolute inset-0 rounded-full border-4 border-success animate-ping opacity-20" />
                <Check size={48} strokeWidth={3} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-text">Pagamento Confirmado!</h3>
                <p className="text-sm text-text-muted">Seu acesso foi liberado. Redirecionando...</p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-8">
              {/* Price Tag */}
              <div className="text-center bg-primary/5 py-4 rounded-3xl border border-primary/10">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Valor Total</p>
                <p className="text-4xl font-display font-black text-primary">
                  <span className="text-lg font-bold mr-1">R$</span>
                  {value.toFixed(2)}
                </p>
              </div>

              {/* QR Code Area */}
              <div className="flex flex-col items-center">
                <div className="relative p-6 bg-white rounded-[2rem] shadow-xl group transition-all hover:scale-[1.02]">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-secondary rounded-[2.1rem] blur-sm opacity-20 group-hover:opacity-40 transition-opacity" />
                  <div className="relative bg-white p-2 rounded-2xl">
                    {qrCode ? (
                      <img 
                        src={`data:image/png;base64,${qrCode}`} 
                        alt="QR Code PIX" 
                        className="w-48 h-48 md:w-56 md:h-56 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-bg-secondary text-text-muted text-center p-4 rounded-xl">
                        Gerando QR Code...
                      </div>
                    )}
                  </div>
                  
                  {/* Real-time status indicator */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-surface border border-border px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
                    {wsStatus === 'connected' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="text-[10px] font-bold text-text">Aguardando pagamento...</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                        <span className="text-[10px] font-bold text-text">Conectando...</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Pix Copia e Cola</label>
                  <div className="relative group">
                    <input 
                      readOnly 
                      value={payload}
                      className="w-full bg-bg-secondary border border-border rounded-2xl pl-4 pr-14 py-4 text-xs font-mono truncate focus:outline-none"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      {isCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  {invoiceUrl && (
                    <Button 
                      variant="ghost" 
                      className="w-full gap-2 text-text-muted hover:text-primary transition-colors text-xs"
                      onClick={() => window.open(invoiceUrl, '_blank')}
                    >
                      <ExternalLink size={16} /> Ver outras formas de pagamento
                    </Button>
                  )}
                  <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted bg-surface-hover/50 py-3 rounded-2xl border border-border border-dashed">
                    <ShieldCheck size={14} className="text-success" />
                    Pagamento 100% seguro via Asaas
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
