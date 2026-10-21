'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

const HUB_URL = 'https://tati-hub.vercel.app/materiais';

const NAV_LINKS = [
  { label: 'Teste CEFR', href: '#cefr' },
  { label: 'O Método', href: '#metodo' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Hub de Materiais', href: HUB_URL, external: true },
];

const STATS = [
  { value: '+2.000', label: 'Mensagens e práticas didáticas' },
  { value: '4 Níveis', label: 'Mapeamento oficial CEFR (A1–B2)' },
  { value: '24/7', label: 'Disponível sem restrições' },
  { value: 'PDF', label: 'Relatório diagnóstico por e-mail' },
];

const CEFR_LEVELS = [
  {
    code: 'A1',
    name: 'Iniciante',
    color: '#059669',
    bg: '#ecfdf5',
    desc: 'Expressões básicas do cotidiano e necessidades imediatas.',
  },
  {
    code: 'A2',
    name: 'Básico',
    color: '#0284c7',
    bg: '#f0f9ff',
    desc: 'Comunicação em tarefas simples e rotineiras do dia a dia.',
  },
  {
    code: 'B1',
    name: 'Intermediário',
    color: '#d97706',
    bg: '#fffbeb',
    desc: 'Pontos principais em situações de viagem e trabalho.',
  },
  {
    code: 'B2',
    name: 'Independente',
    color: '#6d28d9',
    bg: '#f5f3ff',
    desc: 'Textos complexos e fluência com falantes nativos.',
  },
];

const FEATURES = [
  {
    icon: (
      <svg
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
        />
      </svg>
    ),
    title: 'Áudio & Pronúncia Natural',
    desc: 'Ouça pronúncia britânica ou americana nativa e envie seus próprios áudios. A Teacher Tati avalia ritmo, fluência e clareza da sua fala em tempo real.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>
    ),
    title: 'Correção Gramatical Gentil',
    desc: 'Errar faz parte do aprendizado. A IA detecta seus desvios e explica o porquê de cada correção de maneira construtiva e didática, sem julgamentos.',
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
    title: 'Hub de Materiais & SRS',
    desc: 'Revise vocabulário com o algoritmo de Repetição Espaçada, acesse exercícios práticos e e-books didáticos organizados por nível CEFR.',
    link: HUB_URL,
    linkText: 'Acessar Catálogo de Materiais →',
  },
];

function ChatMockup() {
  return (
    <div className="landing-chat-wrap relative w-full max-w-md mx-auto">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #e8e5f0',
          boxShadow:
            '0 20px 60px rgba(26,24,38,0.1), 0 4px 16px rgba(26,24,38,0.06)',
        }}
      >
        {/* Header do Mockup */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid #f0edf8', background: '#faf9fd' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
              style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}
            >
              <Image
                src="/images/tati_logo.jpg"
                alt="Teacher Tati AI"
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <div>
              <p
                className="text-sm font-semibold leading-tight"
                style={{ color: '#1a1826' }}
              >
                Teacher Tati AI
              </p>
              <p
                className="text-xs flex items-center gap-1"
                style={{ color: '#059669' }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                Online agora para ensinar
              </p>
            </div>
          </div>
          <span
            className="landing-cefr-badge px-2 py-0.5 rounded-md"
            style={{ background: '#f5f3ff', color: '#6d28d9' }}
          >
            CEFR TUTOR
          </span>
        </div>

        {/* Mensagens de Exemplo */}
        <div className="p-4 space-y-3" style={{ background: '#fdfcfe' }}>
          {/* Tati */}
          <div className="flex gap-2.5 items-start">
            <div
              className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5"
              style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}
            >
              <Image
                src="/images/tati_logo.jpg"
                alt=""
                fill
                sizes="24px"
                className="object-contain"
              />
            </div>
            <div
              className="rounded-xl rounded-tl-none px-3.5 py-2.5 text-sm max-w-xs"
              style={{
                background: '#f5f3ff',
                border: '1px solid #e9d5ff',
                color: '#3d3058',
              }}
            >
              <p className="font-medium mb-1" style={{ color: '#6d28d9' }}>
                Hello! Let&apos;s practice English!
              </p>
              <p className="leading-relaxed">
                Tell me: what do you usually like to do when you have free time on the weekend?
              </p>
            </div>
          </div>

          {/* Usuário */}
          <div className="flex justify-end">
            <div
              className="rounded-xl rounded-tr-none px-3.5 py-2.5 text-sm max-w-xs"
              style={{
                background: '#f4f3f8',
                border: '1px solid #e8e5f0',
                color: '#3d3a52',
              }}
            >
              I usually like reading books and listen music with my friends.
            </div>
          </div>

          {/* Feedback didático da Tati */}
          <div className="flex gap-2.5 items-start">
            <div
              className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5"
              style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}
            >
              <Image
                src="/images/tati_logo.jpg"
                alt=""
                fill
                sizes="24px"
                className="object-contain"
              />
            </div>
            <div
              className="rounded-xl rounded-tl-none px-3.5 py-2.5 text-sm max-w-xs"
              style={{
                background: '#f5f3ff',
                border: '1px solid #e9d5ff',
                color: '#3d3058',
              }}
            >
              <p className="font-medium mb-1" style={{ color: '#d97706' }}>
                💡 Dica gramatical rápida:
              </p>
              <p className="leading-relaxed">
                Para manter o paralelismo com <em>reading</em>, use{' '}
                <span className="font-medium" style={{ color: '#6d28d9' }}>
                  &quot;and listening to music&quot;
                </span>
                . Excelente vocabulário! What kind of books do you enjoy most?
              </p>
            </div>
          </div>
        </div>

        {/* CTA do Mockup */}
        <div className="px-4 pb-4" style={{ background: '#fdfcfe' }}>
          <Link
            href="/teste-cefr"
            className="block w-full text-center text-sm py-2.5 rounded-xl font-medium transition-all hover:opacity-90"
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
            }}
          >
            Experimente uma sessão ao vivo agora →
          </Link>
        </div>
      </div>

      {/* Blobs decorativos no fundo */}
      <div
        className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full -z-10 pointer-events-none"
        style={{ background: '#ede9fe', filter: 'blur(40px)' }}
      />
      <div
        className="absolute -top-6 -left-6 w-24 h-24 rounded-full -z-10 pointer-events-none"
        style={{ background: '#ecfdf5', filter: 'blur(32px)' }}
      />
    </div>
  );
}

export default function LandingClient() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 1. Limpar parâmetro _v da URL imediatamente caso exista
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('_v')) {
          url.searchParams.delete('_v');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch { }

      // 2. Detecta modo PWA ou APK (Standalone, TWA, WebView)
      const isPwaOrApk =
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as any).standalone) ||
        document.referrer.includes('android-app://') ||
        /wv|Android.*Version\/[\d.]+/i.test(navigator.userAgent) ||
        new URLSearchParams(window.location.search).get('mode') === 'standalone' ||
        new URLSearchParams(window.location.search).get('mode') === 'pwa' ||
        new URLSearchParams(window.location.search).get('source') === 'pwa' ||
        new URLSearchParams(window.location.search).has('apk');

      if (isPwaOrApk) {
        try {
          document.cookie = 'is_pwa=1; path=/; max-age=31536000; SameSite=Lax';
        } catch { }
      }

      const token = localStorage.getItem('token');

      // No modo PWA ou APK: NUNCA mostrar a landing page
      if (isPwaOrApk) {
        setIsRedirecting(true);
        router.replace(token ? '/chat' : '/login');
        return;
      }

      // Se o usuário estiver logado na web comum, redireciona sempre para o chat
      if (token) {
        setIsRedirecting(true);
        router.replace('/chat');
        return;
      }
    }
  }, [router]);

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className="landing-bg landing-text"
      style={{
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/*     NAV     */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(249, 248, 246, 0.94)',
          borderBottom: '1px solid #e8e5f0',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div
              className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
              style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}
            >
              <Image
                src="/images/tati_logo.jpg"
                alt="Teacher Tati AI logo"
                fill
                sizes="36px"
                className="object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none" style={{ color: '#1a1826' }}>
                Teacher Tati <span style={{ color: '#6d28d9' }}>AI</span>
              </p>
              <p className="text-xs leading-none mt-1" style={{ color: '#9d9ab0' }}>
                Tati&apos;s English Class
              </p>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-nav-link text-sm font-medium"
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="landing-nav-link text-sm font-medium"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          {/* Botões de Ação Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/teste-cefr"
              className="landing-btn-outline text-sm px-3.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
            >
              <svg
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              Teste CEFR
            </Link>
            <Link
              href="/login"
              className="landing-btn-outline text-sm px-4 py-1.5 rounded-lg font-medium"
            >
              Entrar
            </Link>
            <Link
              href="/login?tab=register"
              className="landing-btn-primary text-sm px-4 py-1.5 rounded-lg font-medium"
            >
              Criar Conta
            </Link>
          </div>

          {/* Botão Mobile */}
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-black/5"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Abrir menu de navegação"
            style={{ color: '#6b6880' }}
          >
            <svg
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  mobileOpen
                    ? 'M6 18L18 6M6 6l12 12'
                    : 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'
                }
              />
            </svg>
          </button>
        </div>

        {/* Menu Mobile Expansível */}
        {mobileOpen && (
          <div
            className="md:hidden px-6 pb-5 space-y-2"
            style={{ borderTop: '1px solid #e8e5f0', background: '#f9f8f6' }}
          >
            {NAV_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm py-2 landing-nav-link font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm py-2 landing-nav-link font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              )
            )}
            <div className="flex flex-col gap-2 pt-3">
              <Link
                href="/teste-cefr"
                className="landing-btn-primary text-sm px-4 py-2.5 rounded-lg font-medium text-center flex items-center justify-center gap-2"
                onClick={() => setMobileOpen(false)}
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
                Fazer Teste CEFR Gratuito
              </Link>
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="landing-btn-outline text-sm px-4 py-2 rounded-lg flex-1 text-center font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Entrar
                </Link>
                <Link
                  href="/login?tab=register"
                  className="landing-btn-primary text-sm px-4 py-2 rounded-lg font-medium flex-1 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Criar Conta
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/*     HERO     */}
      <section className="relative overflow-hidden" style={{ padding: '80px 0 96px' }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <div className="space-y-7">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                color: '#6d28d9',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Inteligência Artificial Humanizada para Fluência
            </div>

            <h1
              className="font-display-serif leading-tight"
              style={{
                fontSize: 'clamp(2.4rem, 5vw, 3.75rem)',
                letterSpacing: '-0.02em',
                color: '#1a1826',
              }}
            >
              Pratique inglês real
              <br />
              com a{' '}
              <span style={{ color: '#6d28d9' }}>Teacher Tati AI</span>
            </h1>

            <p
              className="text-base leading-relaxed max-w-lg"
              style={{ color: '#6b6880' }}
            >
              Destrave sua fala e escrita através de conversas interativas 24 horas por dia.
              Receba correções imediatas de gramática e pronúncia, avalie seu nível CEFR
              oficial e ganhe confiança para falar de verdade.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/teste-cefr"
                className="landing-btn-primary flex items-center gap-2 px-6 py-3.5 rounded-xl font-medium text-sm"
              >
                <svg
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
                Fazer Teste CEFR Gratuito
              </Link>
              <Link
                href="/login?tab=register"
                className="landing-btn-outline flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium"
              >
                Criar Minha Conta
              </Link>
            </div>

            <div className="flex flex-wrap gap-5 text-xs" style={{ color: '#9d9ab0' }}>
              {[
                'Teste sem login prévio',
                'Relatório completo em PDF',
                'Padrão CEFR (A1 a B2)',
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg
                    width="13"
                    height="13"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <ChatMockup />
        </div>
      </section>

      {/*     STATS     */}
      <section
        style={{
          background: '#ffffff',
          borderTop: '1px solid #e8e5f0',
          borderBottom: '1px solid #e8e5f0',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div
              key={s.value}
              className="text-center py-5 px-4 rounded-xl"
              style={{ border: '1px solid #ede9fe' }}
            >
              <p className="font-display-serif landing-stat-num text-3xl mb-1">
                {s.value}
              </p>
              <p className="text-xs" style={{ color: '#9d9ab0' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/*     CEFR     */}
      <section id="cefr" style={{ padding: '96px 0', background: '#f9f8f6' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                color: '#6d28d9',
              }}
            >
              Quadro Comum Europeu de Referência (CEFR)
            </span>
            <h2
              className="font-display-serif leading-tight"
              style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)', color: '#1a1826' }}
            >
              Descubra seu Nível Real de Inglês
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Nosso teste diagnóstico é conduzido em conversa natural com a Teacher Tati AI.
              Responda perguntas reais e receba seu diagnóstico detalhado por nível.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {CEFR_LEVELS.map((l) => (
              <div
                key={l.code}
                className="landing-card p-5 rounded-2xl cursor-default"
              >
                <div
                  className="inline-block landing-cefr-badge px-2.5 py-1 rounded-md mb-4"
                  style={{ background: l.bg, color: l.color }}
                >
                  {l.code}
                </div>
                <h3
                  className="font-semibold text-sm mb-2"
                  style={{ color: '#1a1826' }}
                >
                  {l.name}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#9d9ab0' }}>
                  {l.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-8 md:p-10 text-center"
            style={{
              background: '#ffffff',
              border: '1px solid #ede9fe',
              boxShadow: '0 4px 24px rgba(109,40,217,0.06)',
            }}
          >
            <h3
              className="font-display-serif text-2xl mb-3"
              style={{ color: '#1a1826' }}
            >
              Pronto para saber em qual nível você se encontra?
            </h3>
            <p className="text-sm mb-7 max-w-md mx-auto" style={{ color: '#6b6880' }}>
              O teste é 100% gratuito e não exige login prévio. Ao finalizar, informe seu
              nome e e-mail para receber o relatório completo em PDF.
            </p>
            <Link
              href="/teste-cefr"
              className="landing-btn-primary inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-sm"
            >
              <svg
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              Iniciar Teste CEFR Agora
            </Link>
          </div>
        </div>
      </section>

      {/*     FEATURES / MÉTODO / RECURSOS     */}
      <section
        id="metodo"
        style={{
          background: '#ffffff',
          borderTop: '1px solid #e8e5f0',
          padding: '96px 0',
        }}
      >
        <div id="recursos" className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
              }}
            >
              Metodologia de Alta Performance
            </span>
            <h2
              className="font-display-serif leading-tight"
              style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)', color: '#1a1826' }}
            >
              Por que aprender com a Teacher Tati AI?
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Combinamos expertise pedagógica com modelos avançados de IA para criar uma
              experiência de aprendizado dinâmica e livre de julgamentos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="landing-card p-7 rounded-2xl cursor-default flex flex-col justify-between"
                style={{ background: '#fdfcfe' }}
              >
                <div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: '#f5f3ff', color: '#6d28d9' }}
                  >
                    {f.icon}
                  </div>
                  <h3
                    className="font-semibold text-sm mb-2.5"
                    style={{ color: '#1a1826' }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#9d9ab0' }}>
                    {f.desc}
                  </p>
                </div>
                {f.link && (
                  <div className="mt-5 pt-4" style={{ borderTop: '1px solid #f0edf8' }}>
                    <a
                      href={f.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold transition-colors hover:underline flex items-center gap-1.5"
                      style={{ color: '#6d28d9' }}
                    >
                      {f.linkText}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*     FINAL CTA     */}
      <section
        style={{
          background: '#f9f8f6',
          borderTop: '1px solid #e8e5f0',
          padding: '96px 0',
        }}
      >
        <div className="max-w-xl mx-auto px-6 text-center">
          <div
            className="relative w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-6"
            style={{
              background: '#f5f3ff',
              border: '1.5px solid #ddd6fe',
              boxShadow: '0 4px 16px rgba(109,40,217,0.12)',
            }}
          >
            <Image
              src="/images/tati_logo.jpg"
              alt="Teacher Tati AI"
              fill
              sizes="56px"
              className="object-contain"
            />
          </div>
          <h2
            className="font-display-serif mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: '#1a1826' }}
          >
            Pronto para transformar seu aprendizado de inglês?
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: '#6b6880' }}>
            Comece pelo teste CEFR gratuito ou crie sua conta para acessar exercícios,
            flashcards e todo o poder da Teacher Tati AI.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/teste-cefr"
              className="landing-btn-primary flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-sm"
            >
              <svg
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              Fazer Teste CEFR Gratuito
            </Link>
            <Link
              href="/login?tab=register"
              className="landing-btn-outline flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-medium"
            >
              Criar Conta Gratuita
            </Link>
          </div>
        </div>
      </section>

      {/*     FOOTER     */}
      <footer
        style={{ background: '#ffffff', borderTop: '1px solid #e8e5f0' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div
                className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}
              >
                <Image
                  src="/images/tati_logo.jpg"
                  alt="Teacher Tati AI"
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold leading-none"
                  style={{ color: '#1a1826' }}
                >
                  Teacher Tati <span style={{ color: '#6d28d9' }}>AI</span>
                </p>
                <p
                  className="text-xs leading-none mt-1"
                  style={{ color: '#c4c1d4' }}
                >
                  Tati&apos;s English Class
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-5">
              <Link href="/teste-cefr" className="landing-nav-link text-xs font-medium">
                Teste CEFR
              </Link>
              <a
                href={HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-nav-link text-xs font-medium"
              >
                Hub de Materiais
              </a>
              <Link href="/login" className="landing-nav-link text-xs font-medium">
                Entrar
              </Link>
              <Link
                href="/login?tab=register"
                className="landing-nav-link text-xs font-medium"
              >
                Criar Conta
              </Link>
              <Link
                href="/politica-de-privacidade"
                className="landing-nav-link text-xs font-medium"
              >
                Política de Privacidade
              </Link>
            </nav>
          </div>

          <div style={{ borderTop: '1px solid #f0edf8', paddingTop: '1.5rem' }}>
            <p className="text-xs text-center" style={{ color: '#c4c1d4' }}>
              © {new Date().getFullYear()} Teacher Tati AI. Todos os direitos reservados.
              Em conformidade com a LGPD e regulamentações educacionais.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
