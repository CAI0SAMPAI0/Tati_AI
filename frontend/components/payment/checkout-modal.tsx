'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Zap, Check, X, ShieldCheck, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

interface CheckoutModalProps {
  plan: Plan;
  onClose: () => void;
  onConfirm: (doc: string, method: string) => void;
  isProcessing: boolean;
  title?: string;
}

export function CheckoutModal({ plan, onClose, onConfirm, isProcessing, title = 'Upgrade to Premium' }: CheckoutModalProps) {
  const [doc, setDoc] = useState('');
  const [method, setMethod] = useState('PIX');

  const formatDoc = (value: string) => {
    let v = value.replace(/\D/g, '');
    if (v.length > 14) v = v.substring(0, 14);
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      v = v.replace(/^(\d{2})(\d)/, '$1.$2');
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
      v = v.replace(/(\d{4})(\d)/, '$1-$2');
    }
    return v;
  };

  const methods = [
    { id: 'PIX', label: 'PIX', icon: Zap, sub: 'Instantâneo' },
    { id: 'CREDIT_CARD', label: 'Cartão', icon: CreditCard, sub: 'Crédito' },
    { id: 'BOLETO', label: 'Boleto', icon: Landmark, sub: '1-2 dias' },
  ];

  const handleConfirm = () => {
    const rawDoc = doc.replace(/\D/g, '');
    if (rawDoc.length < 11) {
      toast.error('Por favor, informe um CPF ou CNPJ válido.');
      return;
    }
    onConfirm(rawDoc, method);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface border border-border rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-hover/50">
          <div>
            <h2 className="text-xl font-black text-text">{title}</h2>
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest">{plan.name}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-bg text-text-muted transition-colors"
            disabled={isProcessing}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Price Tag */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-3xl border border-primary/10">
            <span className="text-sm font-bold text-text-muted">Total a pagar:</span>
            <span className="text-3xl font-display font-black text-primary">R$ {plan.price.toFixed(2)}</span>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-3">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  disabled={isProcessing}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border-2 transition-all duration-300",
                    method === m.id
                      ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10 scale-105"
                      : "border-border hover:border-primary/30 text-text-muted bg-surface"
                  )}
                >
                  <m.icon size={24} strokeWidth={method === m.id ? 2.5 : 2} />
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider">{m.label}</p>
                    <p className={cn("text-[8px] font-bold", method === m.id ? "text-primary/70" : "text-text-subtle opacity-0")}>{m.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Document Input */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Seu CPF ou CNPJ (para nota fiscal)</label>
            <Input
              placeholder="000.000.000-00"
              value={doc}
              onChange={(e) => setDoc(formatDoc(e.target.value))}
              className="bg-bg-secondary h-14 text-lg font-mono rounded-2xl border-border focus:ring-primary/20"
              disabled={isProcessing}
            />
          </div>

          {/* Actions */}
          <div className="space-y-4 pt-2">
            <Button
              className="w-full h-16 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 gap-3 group transition-all hover:scale-[1.02]"
              onClick={handleConfirm}
              loading={isProcessing}
            >
              Confirmar Pagamento
              <Zap size={20} fill="currentColor" className="group-hover:animate-bounce" />
            </Button>
            
            <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted">
              <ShieldCheck size={14} className="text-success" />
              Ambiente Seguro & Criptografado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
