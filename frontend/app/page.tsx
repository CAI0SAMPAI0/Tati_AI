import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Mic,
  BookOpen,
  Award,
  ShieldCheck,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  Clock,
  Layers,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Teacher Tati AI | Aprenda Inglês com Inteligência Artificial Humanizada',
  description:
    'Pratique conversação em inglês 24/7 com a Teacher Tati AI. Teste seu nível CEFR gratuitamente no chat, receba correções imediatas e acelere sua fluência.',
  openGraph: {
    title: 'Teacher Tati AI | Plataforma Inteligente de Inglês',
    description: 'Faça o teste de nivelamento CEFR gratuito e pratique conversação 24/7.',
    url: 'https://tati-ai.vercel.app',
    siteName: 'Teacher Tati AI',
    locale: 'pt_BR',
    type: 'website',
  },
  verification: {
    google: '2pUtbPwWrV8Q1kdAj8fmkYUIY7a-BI0NRj_WKjAHoLM',
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-text antialiased selection:bg-primary/20 selection:text-primary">
      {/* ── HEADER PRINCIPAL ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/20">
              <span className="font-display text-lg font-black text-white">T</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base font-extrabold tracking-tight text-text">
                Teacher Tati <span className="text-primary">AI</span>
              </span>
              <span className="text-[10px] font-medium tracking-wide text-text-subtle">
                Taty's English Class
              </span>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#cefr" className="text-xs font-semibold text-text-muted transition-colors hover:text-text">
              Teste CEFR
            </a>
            <a href="#metodo" className="text-xs font-semibold text-text-muted transition-colors hover:text-text">
              O Método
            </a>
            <a href="#recursos" className="text-xs font-semibold text-text-muted transition-colors hover:text-text">
              Recursos
            </a>
            <Link href="/hub" className="text-xs font-semibold text-text-muted transition-colors hover:text-text">
              Hub de Materiais
            </Link>
          </nav>

          {/* Botões do Header (Login, Criar Conta, Teste CEFR) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/teste-cefr"
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:border-primary/50"
            >
              <Sparkles size={14} className="animate-pulse" />
              <span className="hidden sm:inline">Fazer</span> Teste CEFR
            </Link>

            <Link
              href="/login"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              Entrar
            </Link>

            <Link
              href="/login?tab=register"
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-surface/40 to-bg py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Texto Hero */}
            <div className="flex flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary mb-6 shadow-sm">
                <Sparkles size={14} />
                <span>Inteligência Artificial Humanizada para Fluência</span>
              </div>

              <h1 className="font-display text-4xl font-extrabold tracking-tight text-text sm:text-5xl lg:text-6xl">
                Pratique inglês real com a{' '}
                <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent">
                  Teacher Tati AI
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
                Destrave sua fala e escrita através de conversas interativas 24 horas por dia. Receba correções imediatas de gramática e pronúncia, avalie seu nível CEFR oficial e ganhe confiança para falar de verdade.
              </p>

              {/* Botões de Ação Hero */}
              <div className="mt-8 flex flex-col w-full gap-3 sm:flex-row sm:w-auto">
                <Link
                  href="/teste-cefr"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles size={16} />
                  Fazer Teste CEFR Gratuito
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="/login?tab=register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-bold text-text transition-all hover:bg-surface-hover hover:border-text-subtle"
                >
                  Criar Minha Conta
                </Link>
              </div>

              {/* Badges de garantia */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-text-muted sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-success" />
                  Teste sem login prévio
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-success" />
                  Relatório completo em PDF
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-success" />
                  Conforme o padrão CEFR (A1 a B2)
                </span>
              </div>
            </div>

            {/* Mockup Interativo da Teacher Tati */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md rounded-3xl border border-border bg-surface p-5 shadow-2xl shadow-primary/10 sm:p-6">
                {/* Header do Chat Mockup */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
                      TT
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text">Teacher Tati AI</div>
                      <div className="flex items-center gap-1 text-[11px] text-success">
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        Online agora para ensinar
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                    CEFR Tutor
                  </span>
                </div>

                {/* Balões de conversa de demonstração */}
                <div className="my-5 space-y-4 text-xs">
                  {/* Tati */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      T
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-bg-secondary p-3.5 text-text leading-relaxed">
                      <p className="font-semibold text-primary mb-1">Hello! Let's practice English!</p>
                      Tell me: what do you usually like to do when you have free time on the weekend?
                    </div>
                  </div>

                  {/* Aluno */}
                  <div className="flex items-start justify-end gap-2.5">
                    <div className="rounded-2xl rounded-tr-sm bg-primary p-3.5 text-white leading-relaxed">
                      I usually like reading books and listen music with my friends.
                    </div>
                  </div>

                  {/* Feedback didático da Tati */}
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      T
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/5 p-3.5 text-text leading-relaxed">
                      <p className="font-bold text-primary flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={13} /> Dica gramatical rápida:
                      </p>
                      Para manter o paralelismo com <em>reading</em>, o ideal é dizer: <span className="font-semibold text-primary">"and listening to music"</span>. Excelente vocabulário! What kind of books do you enjoy most?
                    </div>
                  </div>
                </div>

                {/* Barra inferior do mockup */}
                <div className="rounded-xl border border-border bg-bg p-3 text-center">
                  <Link
                    href="/teste-cefr"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    Experimente uma sessão ao vivo agora mesmo
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BARRA DE ESTATÍSTICAS ── */}
      <section className="border-b border-border bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="font-display text-2xl font-extrabold text-primary sm:text-3xl">+25.000</div>
              <div className="mt-1 text-xs text-text-muted">Mensagens e Práticas Didáticas</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-extrabold text-primary sm:text-3xl">4 Níveis</div>
              <div className="mt-1 text-xs text-text-muted">Mapeamento Oficial CEFR (A1-B2)</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-extrabold text-primary sm:text-3xl">24/7</div>
              <div className="mt-1 text-xs text-text-muted">Disponível Sem Restrições</div>
            </div>
            <div className="text-center">
              <div className="font-display text-2xl font-extrabold text-primary sm:text-3xl">PDF Oficial</div>
              <div className="mt-1 text-xs text-text-muted">Relatório Diagnóstico por E-mail</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO CEFR EM DESTAQUE ── */}
      <section id="cefr" className="border-b border-border bg-gradient-to-b from-bg to-surface/40 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-4">
              <Award size={14} />
              Quadro Comum Europeu de Referência (CEFR)
            </div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              Descubra seu Nível Real de Inglês
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
              Nosso teste diagnóstico é conduzido de forma dinâmica no chat pela Teacher Tati AI. Responda perguntas reais de conversação e receba seu diagnóstico detalhado por nível.
            </p>
          </div>

          {/* Cards dos 4 níveis */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 font-extrabold text-sm mb-4">
                A1
              </div>
              <h3 className="font-display font-bold text-base text-text">Iniciante</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Capaz de compreender e usar expressões familiares e frases básicas cotidianas para necessidades concretas.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500 font-extrabold text-sm mb-4">
                A2
              </div>
              <h3 className="font-display font-bold text-base text-text">Básico</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Capaz de se comunicar em tarefas simples e rotineiras que exigem troca direta de informações do dia a dia.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 font-extrabold text-sm mb-4">
                B1
              </div>
              <h3 className="font-display font-bold text-base text-text">Intermediário</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Compreende os pontos principais de assuntos familiares e lida com a maioria das situações de viagens e trabalho.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 font-extrabold text-sm mb-4">
                B2
              </div>
              <h3 className="font-display font-bold text-base text-text">Independente</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Compreende ideias principais de textos complexos e se comunica com fluência e espontaneidade com falantes nativos.
              </p>
            </div>
          </div>

          {/* Banner de CTA do Teste */}
          <div className="mt-10 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 text-center sm:p-10">
            <h3 className="font-display text-2xl font-bold text-text">
              Pronto para saber em qual nível você se encontra?
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-text-muted">
              O teste é 100% gratuito e não exige login prévio. Ao finalizar, basta informar seu nome e e-mail para receber o relatório completo em PDF.
            </p>
            <div className="mt-6">
              <Link
                href="/teste-cefr"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles size={16} />
                Iniciar Teste CEFR Agora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO RECURSOS & DIFERENCIAIS ── */}
      <section id="metodo" className="border-b border-border bg-surface py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-4">
              <Layers size={14} />
              Metodologia de Alta Performance
            </div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              Por que aprender com a Teacher Tati AI?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-text-muted sm:text-base">
              Combinamos a expertise pedagógica de professores de inglês com a potência de modelos avançados de IA para criar uma experiência de aprendizado dinâmica e livre de julgamentos.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-bg p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
                <Mic size={24} />
              </div>
              <h3 className="font-display font-bold text-lg text-text">Áudio & Pronúncia Natural</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Ouça pronúncia britânica ou americana nativa e envie seus próprios áudios. A Teacher Tati avalia ritmo, fluência e clareza da sua fala.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-bg p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
                <MessageSquare size={24} />
              </div>
              <h3 className="font-display font-bold text-lg text-text">Correção Gramatical Gentil</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Errar faz parte do aprendizado. A IA detecta seus desvios gramaticais e explica o porquê de cada correção de maneira construtiva e didática.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-bg p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
                <BookOpen size={24} />
              </div>
              <h3 className="font-display font-bold text-lg text-text">Hub de Materiais & SRS</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Revise seu vocabulário com o algoritmo de Repetição Espaçada (SRS), acesse exercícios práticos e e-books didáticos no catálogo de materiais.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="border-b border-border bg-gradient-to-b from-surface to-bg py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white font-bold text-xl shadow-lg shadow-primary/25">
              T
            </div>
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
            Pronto para transformar seu aprendizado de inglês?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
            Comece pelo teste CEFR gratuito ou crie sua conta para acessar exercícios, flashcards e todo o poder da Teacher Tati AI.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/teste-cefr"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={16} />
              Fazer Teste CEFR Gratuito
            </Link>

            <Link
              href="/login?tab=register"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-6 py-3.5 text-sm font-bold text-text transition-all hover:bg-surface-hover"
            >
              Criar Conta Gratuita
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-surface py-12 text-xs text-text-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-xs">
                T
              </div>
              <span className="font-display font-bold text-text">Teacher Tati AI</span>
              <span className="text-text-subtle">• Taty's English Class</span>
            </div>

            {/* Links rápidos */}
            <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
              <Link href="/teste-cefr" className="hover:text-text transition-colors">
                Teste CEFR
              </Link>
              <Link href="/hub" className="hover:text-text transition-colors">
                Hub de Materiais
              </Link>
              <Link href="/login" className="hover:text-text transition-colors">
                Entrar
              </Link>
              <Link href="/login?tab=register" className="hover:text-text transition-colors">
                Criar Conta
              </Link>
              <Link href="/politica-de-privacidade" className="hover:text-text transition-colors font-semibold text-primary">
                Política de Privacidade
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6 text-center text-[11px] text-text-subtle">
            © {new Date().getFullYear()} Teacher Tati AI. Todos os direitos reservados. Em conformidade com a LGPD e regulamentações educacionais.
          </div>
        </div>
      </footer>
    </div>
  );
}
