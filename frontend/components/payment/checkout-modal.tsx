'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Zap, X, ShieldCheck, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '@/providers/auth-provider';

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

export function CheckoutModal({ plan, onClose, onConfirm, isProcessing, title = 'Concluir Pagamento' }: CheckoutModalProps) {
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState('');
  const [method, setMethod] = useState('PIX');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      // Tenta pegar o CPF se o backend retornar no objeto de usuário
      if ((user as any).cpf || (user as any).cpf_cnpj) {
        setDoc(formatDoc((user as any).cpf || (user as any).cpf_cnpj));
      }
    }
  }, [user]);

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
    { id: 'PIX', label: 'PIX', icon: Zap, sub: 'Aprovação na hora' },
    { id: 'CREDIT_CARD', label: 'Cartão', icon: CreditCard, sub: 'Crédito' },
    { id: 'BOLETO', label: 'Boleto', icon: Landmark, sub: '1 a 2 dias úteis' },
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
      <div className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
          <div>
            <h2 className="text-xl font-bold text-text">{title}</h2>
            <p className="text-sm text-text-muted mt-1">{plan.name}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-bg text-text-muted transition-colors"
            disabled={isProcessing}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Price Tag */}
          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-2xl border border-primary/20">
            <span className="text-sm font-semibold text-text-muted">Total a pagar:</span>
            <span className="text-3xl font-display font-black text-primary">R$ {plan.price.toFixed(2).replace('.', ',')}</span>
          </div>

          <div className="space-y-4">
            {/* User Data (Autocompleted) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider ml-1">Nome Completo</label>
                <Input
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-bg h-12 rounded-xl border-border"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider ml-1">E-mail</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-bg h-12 rounded-xl border-border"
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Document Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider ml-1">CPF ou CNPJ</label>
              <Input
                placeholder="000.000.000-00"
                value={doc}
                onChange={(e) => setDoc(formatDoc(e.target.value))}
                className="bg-bg h-12 font-mono rounded-xl border-border"
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider ml-1">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-3">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  disabled={isProcessing}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300",
                    method === m.id
                      ? "border-primary bg-primary/10 text-primary shadow-sm scale-105"
                      : "border-border hover:border-primary/30 text-text-muted bg-surface"
                  )}
                >
                  <m.icon size={20} strokeWidth={method === m.id ? 2.5 : 2} />
                  <div className="text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider">{m.label}</p>
                    <p className={cn("text-[9px] mt-0.5", method === m.id ? "text-primary/80" : "text-text-muted opacity-0")}>{m.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4 pt-4">
            <Button
              className="w-full h-14 text-base font-bold rounded-xl shadow-lg shadow-primary/20 gap-2 group transition-all"
              onClick={handleConfirm}
              loading={isProcessing}
            >
              Concluir Compra
              <Zap size={18} fill="currentColor" className="group-hover:scale-110 transition-transform" />
            </Button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
              <ShieldCheck size={16} className="text-green-500" />
              Pagamento 100% Seguro (Asaas)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
