'use client';

import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function DialogModal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // Bloquear scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const maxWidthClasses = {
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden">
          {/* Overlay com Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/60 backdrop-blur-md"
          />

          {/* Conteúdo do Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full bg-surface border border-border rounded-3xl shadow-2xl p-4 md:p-6 flex flex-col z-10 max-h-[92vh] md:max-h-[84vh]",
              maxWidthClasses[size]
            )}
          >
            <div className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
              <h2 className="text-xl font-bold text-text">{title}</h2>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-surface-hover rounded-full transition-colors text-text-muted hover:text-text"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Helper local para cn (já que não queremos importar de fora para um componente UI simples se possível)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
