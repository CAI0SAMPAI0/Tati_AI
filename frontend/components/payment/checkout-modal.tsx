'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Zap, Check } from 'lucide-react';
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
    { id: 'PIX', label: 'PIX', icon: Zap },
    { id: 'CREDIT_CARD', label: 'Cartão', icon: CreditCard },
    { id: 'BOLETO', label: 'Boleto', icon: Check },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text">{title}</h2>
          <p className="text-sm text-text-muted">{plan.name} • R$ {plan.price.toFixed(2)}</p>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Forma de Pagamento</label>
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                disabled={isProcessing}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all",
                  method === m.id 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-border hover:border-primary/50 text-text-muted"
                )}
              >
                <m.icon size={20} />
                <span className="text-[10px] font-bold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Input
          label={'CPF ou CNPJ'}
          placeholder="000.000.000-00"
          value={doc}
          onChange={(e) => setDoc(formatDoc(e.target.value))}
          className="bg-bg"
          disabled={isProcessing}
        />

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isProcessing}>
            {'Cancelar'}
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => {
              if (doc.replace(/\D/g, '').length < 11) {
                toast.error('Informe um CPF/CNPJ válido.');
                return;
              }
              onConfirm(doc.replace(/\D/g, ''), method);
            }}
            loading={isProcessing}
          >
            {'Pagar Agora'}
          </Button>
        </div>
      </div>
    </div>
  );
}
