'use client';

import { ExternalLink, X, CreditCard, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RedirectModalProps {
  method: 'CREDIT_CARD' | 'BOLETO';
  url: string;
  value: number;
  title: string;
  onClose: () => void;
}

export function RedirectModal({ method, url, value, title, onClose }: RedirectModalProps) {
  
  const isCard = method === 'CREDIT_CARD';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-bg/90 backdrop-blur-md animate-fade-in">
      <div className="bg-surface border border-border rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center bg-surface-hover">
          <div>
            <h2 className="text-xl font-bold text-text">Pagamento Gerado</h2>
            <p className="text-xs text-text-muted">{title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-bg text-text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
            {isCard ? <CreditCard size={40} /> : <Receipt size={40} />}
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-text-muted">Valor a pagar</p>
            <p className="text-3xl font-display font-black text-primary">R$ {value.toFixed(2)}</p>
          </div>

          <div className="w-full space-y-4">
            <p className="text-sm text-text-muted text-center">
              {isCard 
                ? 'Clique no botão abaixo para preencher os dados do seu cartão no ambiente seguro do Asaas.'
                : 'Clique no botão abaixo para visualizar e pagar o seu boleto bancário.'}
            </p>

            <Button 
              className="w-full h-14 text-lg font-bold gap-3 shadow-lg shadow-primary/20"
              onClick={() => {
                window.open(url, '_blank');
              }}
            >
              {isCard ? 'Pagar com Cartão' : 'Ver Boleto Bancário'}
              <ExternalLink size={20} />
            </Button>

            <Button variant="ghost" className="w-full text-text-muted" onClick={onClose}>
              Fechar
            </Button>
          </div>

          <p className="text-[0.7rem] text-text-subtle text-center max-w-xs leading-relaxed">
            O acesso será liberado automaticamente após a confirmação do pagamento.
          </p>
        </div>
      </div>
    </div>
  );
}
