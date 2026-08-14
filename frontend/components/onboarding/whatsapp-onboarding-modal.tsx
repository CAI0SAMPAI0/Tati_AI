'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Bell, ArrowRight, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiPut } from '@/lib/api/client';
import { registerUnauthorizedHandler } from '@/lib/api/client';
import toast from 'react-hot-toast';

export function WhatsAppOnboardingModal() {
  const { user, updateProfile, token } = useAuth();
  const [phone, setPhone] = useState('');
  const [allowNotifications, setAllowNotifications] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Regra de exibição: somente para alunos que ainda não passaram pelo onboarding do WhatsApp
  const isStaff = ['admin', 'professor', 'professora', 'programador'].includes(user?.role?.toLowerCase() || '');
  const showModal = user && !isStaff && !user.profile?.whatsapp_onboarded;

  if (!showModal) return null;

  // Remove o handler global de logout não autorizado durante a operação do modal
  useEffect(() => {
    registerUnauthorizedHandler(null);
    return () => {
      registerUnauthorizedHandler(() => {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
      });
    };
  }, [user?.role, token]);

  const handleSave = async (skip = false) => {
    setIsSubmitting(true);
    try {
      const payload = {
        whatsapp_number: skip ? null : phone.trim(),
        allow_whatsapp_notifications: skip ? false : allowNotifications,
        whatsapp_onboarded: true,
      };

      const res = await apiPut<any>('/profile/', payload);

      if (res.ok) {
        // Atualiza o estado local do auth provider
        const updatedUser = {
          ...user,
          profile: {
            ...user.profile,
            whatsapp_number: skip ? undefined : phone.trim(),
            allow_whatsapp_notifications: skip ? false : allowNotifications,
            whatsapp_onboarded: true,
          },
        };
        updateProfile(updatedUser);
        toast.success(skip ? 'Onboarding finalizado!' : 'WhatsApp configurado com sucesso! 🎉');
      } else {
        toast.error('Erro ao salvar configurações do WhatsApp.');
      }
    } catch (error: any) {
      console.error('Error saving WhatsApp settings:', error);
      if (error instanceof ApiClientError && error.status === 401) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
      } else {
        toast.error('Ocorreu uma falha de conexão.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-bg/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative z-10 w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8"
        >
          {/* Close button (acts as skip) */}
          <button
            onClick={() => handleSave(true)}
            className="absolute top-4 right-4 p-2 hover:bg-surface-hover rounded-full transition-colors text-text-muted hover:text-text"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mt-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-500 shadow-lg shadow-emerald-500/5 animate-pulse">
              <MessageSquare size={32} className="stroke-[1.5]" />
            </div>
            <h2 className="text-2xl font-black text-text font-display tracking-tight mb-2">
              WhatsApp Notifications!
            </h2>
            <p className="text-sm text-text-muted leading-relaxed max-w-xs">
              Receba seus materiais, revisões e alertas de estudo diretamente no seu WhatsApp.
            </p>
          </div>

          {/* Form */}
          <div className="mt-8 space-y-5">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-text-subtle mb-2">
                Número do WhatsApp
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
                  +55
                </span>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-bg border border-border rounded-2xl text-sm font-bold text-text placeholder-text-muted/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-[0.65rem] text-text-subtle mt-1.5 leading-normal">
                Informe o número com DDD (ex: 11999999999).
              </p>
            </div>

            {/* Toggle switch for allowance */}
            <label className="flex items-start gap-3 bg-bg-secondary/40 p-4 rounded-2xl border border-border/50 cursor-pointer hover:bg-bg-secondary/60 transition-colors select-none">
              <input
                type="checkbox"
                checked={allowNotifications}
                onChange={(e) => setAllowNotifications(e.target.checked)}
                className="mt-1 accent-emerald-500 w-4 h-4 rounded"
                disabled={isSubmitting}
              />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-text flex items-center gap-1.5">
                  <Bell size={12} className="text-emerald-500" />
                  Permitir notificações
                </div>
                <div className="text-[0.65rem] text-text-subtle leading-normal">
                  Desejo receber mensagens sobre quizzes liberados, correções e lembretes de estudos.
                </div>
              </div>
            </label>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={isSubmitting || !phone.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-glow shadow-emerald-500/10"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span>Ativar WhatsApp</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="w-full py-3 hover:bg-surface-hover text-xs font-bold text-text-muted hover:text-text rounded-2xl transition-all"
            >
              Agora não, configurar depois
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
