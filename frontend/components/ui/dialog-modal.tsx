'use client';

import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export function DialogModal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquear scroll do body e containers sem pular a rolagem
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const mainContainer = document.querySelector('main');
    const originalMainOverflow = mainContainer ? (mainContainer as HTMLElement).style.overflow : '';

    document.body.style.overflow = 'hidden';
    if (mainContainer) {
      (mainContainer as HTMLElement).style.overflow = 'hidden';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      if (mainContainer) {
        (mainContainer as HTMLElement).style.overflow = originalMainOverflow;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWidthClasses = {
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 dark:bg-black/85 cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div 
            layout={false}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full bg-surface dark:bg-[#121424] border border-border/80 dark:border-white/10 rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col z-10 max-h-[90vh] md:max-h-[86vh] overflow-hidden transform-gpu",
              maxWidthClasses[size]
            )}
          >
            <div className="flex justify-between items-center mb-3 sm:mb-4 pb-2 border-b border-border/40 shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-text tracking-tight">{title}</h2>
              <button 
                onClick={onClose} 
                className="p-1.5 sm:p-2 hover:bg-surface-hover dark:hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-text cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
