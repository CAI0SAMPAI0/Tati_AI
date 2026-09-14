'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, FileText, ExternalLink, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';

export function LgpdConsentModal() {
  const { user, token, isLoaded, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded || !token || !user) {
    return null;
  }

  // Verifica se o consentimento já foi aceito na versão atual (2.2)
  const consent = (user?.profile as any)?.lgpd_consent;
  const hasAccepted = Boolean(consent?.accepted_terms && consent?.terms_version === '2.2');

  // Se já aceitou, não exibe o modal
  if (hasAccepted) {
    return null;
  }

  const handleRefuse = () => {
    toast.error('Você recusou os termos. Para utilizar a plataforma educacional, é necessário aceitá-los. Você pode entrar e aceitar a qualquer momento.', {
      duration: 6000,
    });
    logout();
    router.replace('/login');
  };

  const handleAccept = async () => {
    if (!acceptedTerms || !parentalConsent) return;
    setIsSubmitting(true);
    try {
      await apiPost('/auth/consent', {
        accepted_terms: true,
        parental_consent: true,
      });
      toast.success('✔ Termos e consentimento registrados com sucesso! Bem-vindo(a) de volta!');
      await refreshUser();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao registrar consentimento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Backdrop escuro e não clicável para forçar decisão */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm"
        />

        {/* Card do Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-surface dark:bg-[#121424] border border-border/80 dark:border-white/10 rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col z-10 max-h-[92vh] overflow-hidden"
        >
          {/* Header com ícone e badge */}
          <div className="flex items-start gap-3.5 pb-4 border-b border-border/50 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Shield size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[0.65rem] font-bold border border-primary/20">
                  LGPD • Lei nº 13.709/2018
                </span>
                <span className="text-[0.65rem] text-text-muted font-medium">
                  Versão 2.2
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-text tracking-tight mt-1">
                Termos de Uso e Proteção de Dados
              </h2>
            </div>
          </div>

          {/* Conteúdo com rolagem suave */}
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 py-4 space-y-4 custom-scrollbar text-xs sm:text-sm text-text-muted leading-relaxed">
            <p className="text-text font-medium">
              Olá, <strong className="text-primary">{user.name || user.username}</strong>!
            </p>
            <p>
              Para continuar utilizando a plataforma <strong>Teacher Tati AI</strong>, precisamos do seu consentimento expresso para o tratamento educacional de dados, em cumprimento à legislação vigente.
            </p>

            {/* Destaques didáticos */}
            <div className="space-y-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-bg-secondary/40 border border-border/60 flex items-start gap-2.5">
                <FileText size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="text-xs">
                  <strong className="text-text block mb-0.5">Finalidade Estritamente Educacional:</strong>
                  <span>Seu nome, e-mail e histórico de exercícios são utilizados unicamente para liberar suas aulas, personalizar a IA pedagógica e acompanhar sua evolução.</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-bg-secondary/40 border border-border/60 flex items-start gap-2.5">
                <Lock size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <strong className="text-text block mb-0.5">Segurança & Criptografia:</strong>
                  <span>Seus dados são protegidos por criptografia de ponta a ponta e nunca são comercializados com terceiros sob nenhuma hipótese.</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-bg-secondary/40 border border-border/60 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <strong className="text-text block mb-0.5">Alunos Menores de Idade (Art. 14 da LGPD):</strong>
                  <span>Para alunos menores de 18 anos, a utilização requer a ciência e autorização prévia de ao menos um dos pais ou responsável legal.</span>
                </div>
              </div>
            </div>

            {/* Checkboxes de consentimento */}
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3 pt-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-xs text-text leading-snug">
                  Li e concordo com os{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-bold underline inline-flex items-center gap-1 hover:opacity-80"
                  >
                    Termos de Uso e Política de Privacidade (LGPD) <ExternalLink size={11} />
                  </a>.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={parentalConsent}
                  onChange={(e) => setParentalConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span className="text-xs text-text leading-snug">
                  Declaro que sou maior de 18 anos ou possuo autorização expressa dos meus pais ou responsáveis legais (Art. 14 da LGPD).
                </span>
              </label>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              onClick={handleRefuse}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-danger hover:bg-danger/10 hover:text-danger border-danger/20 text-xs py-2 h-auto gap-1.5"
            >
              <LogOut size={14} />
              Recusar e Sair
            </Button>

            <Button
              onClick={handleAccept}
              disabled={!acceptedTerms || !parentalConsent || isSubmitting}
              className="w-full sm:flex-1 text-xs py-2 h-auto gap-2"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Aceitar e Continuar</span>
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
