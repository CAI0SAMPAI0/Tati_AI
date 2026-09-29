'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, FileText, ExternalLink, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useHubAuth } from '@/components/auth-provider';
import { recordConsent } from '@tati/hub-core';

export function LgpdConsentModal() {
  const { user, token, isLoaded, logout, refreshProfile } = useHubAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded || !token || !user) {
    return null;
  }

  // Verifica se o consentimento já foi aceito na versão atual (2.2)
  const consent = (user as any)?.profile?.lgpd_consent;
  const hasAccepted = Boolean(consent?.accepted_terms && consent?.terms_version === '2.2');

  // Se já aceitou ou foi dispensado localmente, não exibe o modal
  if (isDismissed || hasAccepted) {
    return null;
  }

  const handleRefuse = () => {
    logout();
    router.replace('/login');
  };

  const handleAccept = async () => {
    if (!acceptedTerms || !parentalConsent) return;
    setIsSubmitting(true);
    try {
      await recordConsent({
        accepted_terms: true,
        parental_consent: true,
      });
      setIsDismissed(true);
      await refreshProfile();
    } catch (err: any) {
      console.error('Erro ao registrar consentimento LGPD:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop escuro e não clicável para forçar decisão */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm" />

      {/* Card do Modal */}
      <div className="relative w-full max-w-xl bg-surface border border-line rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col z-10 max-h-[92vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header com ícone e badge */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-line shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-primarySoft text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Shield size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-primarySoft text-primary text-[0.65rem] font-bold border border-primary/20">
                LGPD • Lei nº 13.709/2018
              </span>
              <span className="text-[0.65rem] text-muted font-medium">
                Versão 2.2
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-ink tracking-tight mt-1">
              Termos de Uso e Proteção de Dados
            </h2>
          </div>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 py-4 space-y-4 text-xs sm:text-sm text-muted leading-relaxed">
          <p className="text-ink font-medium">
            Olá, <strong className="text-primary">{user.name || user.username}</strong>!
          </p>
          <p>
            Para continuar utilizando os materiais e a plataforma <strong>Teacher Tatiana</strong>, precisamos do seu consentimento expresso para o tratamento educacional de dados, em cumprimento à legislação vigente.
          </p>

          {/* Destaques didáticos */}
          <div className="space-y-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-bgSecondary/50 border border-line flex items-start gap-2.5">
              <FileText size={16} className="text-primary mt-0.5 shrink-0" />
              <div className="text-xs">
                <strong className="text-ink block mb-0.5">Finalidade Estritamente Educacional:</strong>
                <span>Seu nome, e-mail e histórico de materiais são utilizados unicamente para liberar seu acesso, personalizar seu aprendizado e acompanhar seus pedidos.</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-bgSecondary/50 border border-line flex items-start gap-2.5">
              <Lock size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <strong className="text-ink block mb-0.5">Segurança & Criptografia:</strong>
                <span>Seus dados são protegidos com segurança e nunca são comercializados com terceiros sob nenhuma hipótese.</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-bgSecondary/50 border border-line flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <strong className="text-ink block mb-0.5">Alunos Menores de Idade (Art. 14 da LGPD):</strong>
                <span>Para alunos menores de 18 anos, a utilização requer a ciência e autorização prévia de ao menos um dos pais ou responsável legal.</span>
              </div>
            </div>
          </div>

          {/* Checkboxes de consentimento */}
          <div className="p-4 rounded-2xl bg-primarySoft/50 border border-primary/20 space-y-3 pt-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <span className="text-xs text-ink leading-snug">
                Li e concordo com os{' '}
                <a
                  href="https://tati-ai.vercel.app/privacy"
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
                className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <span className="text-xs text-ink leading-snug">
                Declaro que sou maior de 18 anos ou possuo autorização expressa dos meus pais ou responsáveis legais (Art. 14 da LGPD).
              </span>
            </label>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRefuse}
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-hub border border-danger/30 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger/10 transition flex items-center justify-center gap-1.5"
          >
            <LogOut size={14} />
            Recusar e Sair
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!acceptedTerms || !parentalConsent || isSubmitting}
            className={`w-full sm:flex-1 rounded-hub py-2.5 text-xs font-bold text-white transition flex items-center justify-center gap-2 ${
              !acceptedTerms || !parentalConsent || isSubmitting
                ? 'bg-muted/40 cursor-not-allowed text-muted'
                : 'bg-primary hover:bg-primary/90 shadow-glow'
            }`}
          >
            {isSubmitting ? (
              <span>Registrando...</span>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Aceitar e Continuar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
