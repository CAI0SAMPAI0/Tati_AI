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
  onConfirm: (doc: string) => void;
  isProcessing: boolean;
}

export function CheckoutModal({ plan, onClose, onConfirm, isProcessing }: CheckoutModalProps) {
  
  const [doc, setDoc] = useState('');

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text">{'Upgrade to Premium'}</h2>
          <p className="text-sm text-text-muted">{plan.name}</p>
        </div>

        <Input
          label={'CPF or CNPJ'}
          placeholder="000.000.000-00"
          value={doc}
          onChange={(e) => setDoc(formatDoc(e.target.value))}
          className="bg-bg"
        />

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isProcessing}>
            {'Cancel'}
          </Button>
          <Button 
            className="flex-1" 
            onClick={() => onConfirm(doc.replace(/\D/g, ''))}
            loading={isProcessing}
          >
            {'Pay Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
