'use client';

import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface PixModalProps {
  qrCode: string;
  payload: string;
  value: number;
  title: string;
  invoiceUrl?: string;
  onClose: () => void;
}

export function PixModal({ qrCode, payload, value, title, invoiceUrl, onClose }: PixModalProps) {
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(payload);
    toast.success('Copiado com sucesso!');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-bg/90 backdrop-blur-md animate-fade-in">
      <div className="bg-surface border border-border rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-hover">
          <div>
            <h2 className="text-xl font-bold text-text">Pagamento PIX</h2>
            <p className="text-xs text-text-muted">{title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-bg text-text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 flex flex-col items-center">
          <div className="text-center space-y-1">
            <p className="text-sm text-text-muted">Valor a pagar</p>
            <p className="text-4xl font-display font-black text-primary">R$ {value.toFixed(2)}</p>
          </div>

          <div className="relative p-4 bg-white rounded-3xl shadow-inner group">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={`data:image/png;base64,${qrCode}`} 
                alt="QR Code PIX" 
                className="w-56 h-56 md:w-64 md:h-64 object-contain"
              />
            ) : (
              <div className="w-56 h-56 md:w-64 md:h-64 flex items-center justify-center bg-bg-secondary text-text-muted text-center p-4">
                QR Code não disponível. Use o código abaixo ou o link de fatura.
              </div>
            )}
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-subtle uppercase tracking-wider ml-1">Código Copia e Cola</label>
              <div className="flex gap-2">
                <input 
                  readOnly 
                  value={payload}
                  className="flex-1 bg-bg-secondary border border-border rounded-xl px-4 py-3 text-xs font-mono truncate"
                />
                <Button variant="secondary" onClick={copyToClipboard} className="shrink-0">
                  <Copy size={18} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2">
              {invoiceUrl && (
                <Button 
                  variant="secondary" 
                  className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => window.open(invoiceUrl, '_blank')}
                >
                  <ExternalLink size={18} /> Outras formas de pagamento
                </Button>
              )}
              <Button className="w-full bg-success hover:bg-success-dark" onClick={onClose}>
                <Check size={18} /> Já realizei o pagamento
              </Button>
            </div>
          </div>

          <p className="text-[0.7rem] text-text-subtle text-center max-w-xs leading-relaxed">
            O acesso será liberado automaticamente após a confirmação do pagamento pelo banco.
          </p>
        </div>
      </div>
    </div>
  );
}
