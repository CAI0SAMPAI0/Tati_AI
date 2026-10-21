<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { isApkOrStandalone } from '@/router';
import {
  Sparkles,
  Volume2,
  Check,
  BookOpen,
  MessageSquare,
  Menu,
  X,
  Loader2,
  Star,
} from 'lucide-vue-next';

const router = useRouter();
const mobileOpen = ref(false);
const isRedirecting = ref(false);
const selectedAccent = ref<'US' | 'UK'>('US');
const logoError = ref(false);
const HUB_URL = 'https://tati-hub.vercel.app/';

const NAV_LINKS = [
  { label: 'Teste CEFR', href: '#cefr', isRoute: false },
  { label: 'O Método', href: '#metodo', isRoute: false },
  { label: 'Recursos', href: '#recursos', isRoute: false },
  { label: "Taty's Materials", href: HUB_URL, isRoute: true },
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
    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: 'Expressões básicas do cotidiano e necessidades imediatas.',
  },
  {
    code: 'A2',
    name: 'Básico',
    bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    desc: 'Comunicação em tarefas simples e rotineiras do dia a dia.',
  },
  {
    code: 'B1',
    name: 'Intermediário',
    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    desc: 'Pontos principais em situações de viagem e trabalho.',
  },
  {
    code: 'B2',
    name: 'Independente',
    bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    desc: 'Textos complexos e fluência com falantes nativos.',
  },
];

const FEATURES = [
  {
    icon: Volume2,
    title: 'Áudio & Pronúncia Natural',
    desc: 'Ouça pronúncia britânica ou americana nativa e envie seus próprios áudios. A Teacher Tati avalia ritmo, fluência e clareza da sua fala em tempo real.',
  },
  {
    icon: MessageSquare,
    title: 'Correção Gramatical Gentil',
    desc: 'Errar faz parte do aprendizado. A IA detecta seus desvios e explica o porquê de cada correção de maneira construtiva e didática, sem julgamentos.',
  },
  {
    icon: BookOpen,
    title: 'Hub de Materiais & SRS',
    desc: 'Revise vocabulário com o algoritmo de Repetição Espaçada, acesse exercícios práticos e e-books didáticos organizados por nível CEFR.',
    route: HUB_URL,
    linkText: 'Acessar Catálogo de Materiais →',
  },
];

const HERO_CHECKS = [
  'Teste sem login prévio',
  'Relatório completo em PDF',
  'Padrão CEFR (A1 a B2)',
];

onMounted(() => {
  if (typeof window !== 'undefined') {
    // 1. Limpar parâmetro _v da URL imediatamente caso exista
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('_v')) {
        url.searchParams.delete('_v');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    } catch { }

    // 2. Detecta modo PWA ou APK (Standalone, TWA, WebView)
    const isPwaOrApk = isApkOrStandalone();

    if (isPwaOrApk) {
      try {
        document.cookie = 'is_pwa=1; path=/; max-age=31536000; SameSite=Lax';
      } catch { }
    }

    const token = localStorage.getItem('token');

    // No modo PWA ou APK: NUNCA mostrar a landing page
    if (isPwaOrApk) {
      isRedirecting.value = true;
      router.replace(token ? '/chat' : '/login');
      return;
    }

    // Se o usuário estiver logado na web comum, redireciona sempre para o chat
    if (token) {
      isRedirecting.value = true;
      router.replace('/chat');
      return;
    }
  }
});
</script>

<template>
  <!-- Loading / Redirecting State -->
  <div v-if="isRedirecting" class="min-h-screen bg-bg flex items-center justify-center">
    <Loader2 class="w-8 h-8 text-primary animate-spin" />
  </div>

  <!-- Main Landing Page -->
  <div v-else class="min-h-screen bg-bg text-text selection:bg-primary/20">
    <!-- Top Navigation -->
    <header class="sticky top-0 z-50 border-b border-border/80 bg-surface/85 backdrop-blur-md">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <!-- Brand Logo -->
        <RouterLink to="/" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div
            class="w-9 h-9 rounded-full overflow-hidden bg-primary text-white font-black flex items-center justify-center shadow-sm shadow-primary/30 shrink-0 border border-primary/20">
            <img v-if="!logoError" src="/images/tati_logo.jpg" alt="Teacher Tati AI"
              class="w-full h-full object-contain" @error="logoError = true" />
            <span v-else>T</span>
          </div>
          <div>
            <p class="font-black text-sm leading-none tracking-tight">
              Teacher <span class="text-primary">Tati AI</span>
            </p>
            <p class="text-[11px] text-text-muted leading-none mt-1 font-medium">
              Tati's English Class
            </p>
          </div>
        </RouterLink>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center gap-6 text-xs font-bold text-text-muted">
          <template v-for="link in NAV_LINKS" :key="link.label">
            <RouterLink v-if="link.isRoute" :to="link.href" class="hover:text-primary transition-colors">
              {{ link.label }}
            </RouterLink>
            <a v-else :href="link.href" class="hover:text-primary transition-colors">
              {{ link.label }}
            </a>
          </template>
        </nav>

        <!-- Desktop Action Buttons -->
        <div class="hidden md:flex items-center gap-3">
          <RouterLink to="/cefr-test"
            class="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-text hover:bg-bgSecondary transition-colors flex items-center gap-1.5">
            <Sparkles :size="13" class="text-primary" />
            <span>Teste CEFR</span>
          </RouterLink>
          <RouterLink to="/login"
            class="rounded-xl border border-border px-4 py-2 text-xs font-bold text-text hover:bg-bgSecondary transition-colors">
            Entrar
          </RouterLink>
          <RouterLink to="/login?tab=register"
            class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 hover:opacity-90 transition-opacity">
            Criar Conta
          </RouterLink>
        </div>

        <!-- Mobile Menu Toggle -->
        <button class="md:hidden p-2 rounded-xl text-text-muted hover:bg-bgSecondary transition-colors"
          @click="mobileOpen = !mobileOpen" aria-label="Abrir menu de navegação">
          <X v-if="mobileOpen" :size="22" />
          <Menu v-else :size="22" />
        </button>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div v-if="mobileOpen" class="md:hidden px-6 pb-5 pt-2 space-y-2 border-t border-border bg-surface">
        <template v-for="link in NAV_LINKS" :key="link.label">
          <RouterLink v-if="link.isRoute" :to="link.href"
            class="block text-sm py-2 font-bold text-text-muted hover:text-primary transition-colors"
            @click="mobileOpen = false">
            {{ link.label }}
          </RouterLink>
          <a v-else :href="link.href"
            class="block text-sm py-2 font-bold text-text-muted hover:text-primary transition-colors"
            @click="mobileOpen = false">
            {{ link.label }}
          </a>
        </template>

        <div class="flex flex-col gap-2.5 pt-3 border-t border-border/60">
          <RouterLink to="/cefr-test"
            class="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white text-center flex items-center justify-center gap-2 shadow-sm shadow-primary/20"
            @click="mobileOpen = false">
            <Sparkles :size="14" />
            <span>Fazer Teste CEFR Gratuito</span>
          </RouterLink>
          <div class="flex gap-2">
            <RouterLink to="/login"
              class="rounded-xl border border-border px-4 py-2 text-xs font-bold text-text flex-1 text-center hover:bg-bgSecondary"
              @click="mobileOpen = false">
              Entrar
            </RouterLink>
            <RouterLink to="/login?tab=register"
              class="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary flex-1 text-center hover:bg-primary/20"
              @click="mobileOpen = false">
              Criar Conta
            </RouterLink>
          </div>
        </div>
      </div>
    </header>

    <main>
      <!-- HERO SECTION -->
      <section class="relative overflow-hidden py-16 md:py-24">
        <div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-center">
          <!-- Left Column -->
          <div class="space-y-7">
            <div
              class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
              <Star :size="13" class="fill-primary" />
              <span>Inteligência Artificial Humanizada para Fluência</span>
            </div>

            <h1 class="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Pratique inglês real
              <br />
              com a <span class="text-primary">Teacher Tati AI</span>
            </h1>

            <p class="text-base text-text-muted leading-relaxed max-w-lg">
              Destrave sua fala e escrita através de conversas interativas 24 horas por dia.
              Receba correções imediatas de gramática e pronúncia, avalie seu nível CEFR
              oficial e ganhe confiança para falar de verdade.
            </p>

            <div class="flex flex-wrap gap-3">
              <RouterLink to="/cefr-test"
                class="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 font-bold text-sm text-white shadow-lg shadow-primary/25 hover:opacity-95 transition-all">
                <Sparkles :size="16" />
                <span>Fazer Teste CEFR Gratuito</span>
              </RouterLink>
              <RouterLink to="/login?tab=register"
                class="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-3.5 font-bold text-sm text-text hover:bg-bgSecondary transition-all">
                <span>Criar Minha Conta</span>
              </RouterLink>
            </div>

            <div class="flex flex-wrap gap-5 text-xs font-semibold text-text-muted">
              <span v-for="item in HERO_CHECKS" :key="item" class="flex items-center gap-1.5">
                <Check :size="14" class="text-emerald-500 stroke-[2.5]" />
                {{ item }}
              </span>
            </div>
          </div>

          <!-- Right Column: Chat Mockup -->
          <div class="relative w-full max-w-md mx-auto">
            <div class="rounded-3xl border border-border bg-surface shadow-xl overflow-hidden">
              <!-- Mockup Header -->
              <div class="flex items-center justify-between px-4 py-3.5 border-b border-border bg-bgSecondary/50">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-9 h-9 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <img v-if="!logoError" src="/images/tati_logo.jpg" alt="Teacher Tati AI"
                      class="w-full h-full object-contain" />
                    <span v-else class="font-bold text-primary text-xs">TT</span>
                  </div>
                  <div>
                    <p class="text-xs font-bold text-text leading-tight">Teacher Tati AI</p>
                    <p
                      class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                      <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online agora para ensinar
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <div class="flex items-center gap-1 bg-bg p-1 rounded-xl border border-border text-[10px] font-bold">
                    <button @click="selectedAccent = 'US'" :class="[
                      'px-2 py-0.5 rounded-lg transition-colors',
                      selectedAccent === 'US' ? 'bg-primary text-white' : 'text-text-muted',
                    ]">
                      US 🇺🇸
                    </button>
                    <button @click="selectedAccent = 'UK'" :class="[
                      'px-2 py-0.5 rounded-lg transition-colors',
                      selectedAccent === 'UK' ? 'bg-primary text-white' : 'text-text-muted',
                    ]">
                      UK 🇬🇧
                    </button>
                  </div>
                </div>
              </div>

              <!-- Mockup Messages -->
              <div class="p-4 space-y-3.5 text-xs bg-surface">
                <!-- Tati Message -->
                <div class="flex gap-2.5 items-start">
                  <div
                    class="w-6 h-6 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <img v-if="!logoError" src="/images/tati_logo.jpg" alt="" class="w-full h-full object-contain" />
                    <span v-else class="font-bold text-primary text-[10px]">T</span>
                  </div>
                  <div
                    class="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-primary/10 border border-primary/20 text-text max-w-xs space-y-1">
                    <p class="font-bold text-primary">Hello! Let's practice English!</p>
                    <p class="leading-relaxed">
                      Tell me: what do you usually like to do when you have free time on the weekend?
                    </p>
                  </div>
                </div>

                <!-- User Message -->
                <div class="flex justify-end">
                  <div
                    class="rounded-2xl rounded-tr-xs px-3.5 py-2.5 bg-bgSecondary border border-border text-text max-w-xs font-medium">
                    I usually like reading books and listen music with my friends.
                  </div>
                </div>

                <!-- Tati Pedagogical Feedback -->
                <div class="flex gap-2.5 items-start">
                  <div
                    class="w-6 h-6 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <img v-if="!logoError" src="/images/tati_logo.jpg" alt="" class="w-full h-full object-contain" />
                    <span v-else class="font-bold text-primary text-[10px]">T</span>
                  </div>
                  <div
                    class="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-primary/10 border border-primary/20 text-text max-w-xs space-y-1.5">
                    <p class="font-bold text-amber-600 dark:text-amber-400">
                      💡 Dica gramatical rápida:
                    </p>
                    <p class="leading-relaxed">
                      Para manter o paralelismo com <em>reading</em>, use
                      <span class="font-bold text-primary">"and listening to music"</span>.
                      Excelente vocabulário! What kind of books do you enjoy most?
                    </p>
                    <div class="flex items-center gap-1.5 pt-1 text-[11px] text-primary font-bold">
                      <Volume2 :size="13" />
                      <span>Ouvir pronúncia nativa ({{ selectedAccent }})</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Mockup CTA Footer -->
              <div class="px-4 pb-4 bg-surface">
                <RouterLink to="/cefr-test"
                  class="block w-full text-center text-xs py-2.5 rounded-xl font-bold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-colors">
                  Experimente uma sessão ao vivo agora →
                </RouterLink>
              </div>
            </div>

            <!-- Decorative Blobs -->
            <div
              class="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-primary/15 blur-2xl -z-10 pointer-events-none" />
            <div
              class="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-emerald-500/15 blur-xl -z-10 pointer-events-none" />
          </div>
        </div>
      </section>

      <!-- STATS SECTION -->
      <section class="bg-surface border-y border-border">
        <div class="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div v-for="s in STATS" :key="s.value"
            class="text-center py-5 px-4 rounded-2xl border border-border bg-bg/50 shadow-2xs">
            <p class="text-2xl md:text-3xl font-black text-primary mb-1">
              {{ s.value }}
            </p>
            <p class="text-xs text-text-muted font-semibold">
              {{ s.label }}
            </p>
          </div>
        </div>
      </section>

      <!-- CEFR SECTION -->
      <section id="cefr" class="py-20 bg-bg">
        <div class="max-w-6xl mx-auto px-6 space-y-12">
          <div class="text-center max-w-xl mx-auto space-y-4">
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary">
              Quadro Comum Europeu de Referência (CEFR)
            </span>
            <h2 class="text-3xl md:text-4xl font-black tracking-tight">
              Descubra seu Nível Real de Inglês
            </h2>
            <p class="text-sm text-text-muted leading-relaxed">
              Nosso teste diagnóstico é conduzido em conversa natural com a Teacher Tati AI.
              Responda perguntas reais e receba seu diagnóstico detalhado por nível.
            </p>
          </div>

          <div class="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
            <div v-for="l in CEFR_LEVELS" :key="l.code"
              class="rounded-2xl border border-border bg-surface p-6 shadow-xs hover:shadow-md transition-shadow space-y-4">
              <div :class="[
                'inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-sm border',
                l.bg,
              ]">
                {{ l.code }}
              </div>
              <div>
                <h3 class="font-bold text-base text-text mb-1.5">{{ l.name }}</h3>
                <p class="text-xs text-text-muted leading-relaxed">{{ l.desc }}</p>
              </div>
            </div>
          </div>

          <!-- CEFR Callout Box -->
          <div
            class="rounded-3xl border border-primary/20 bg-surface p-8 md:p-10 text-center shadow-lg shadow-primary/5 space-y-4">
            <h3 class="text-xl md:text-2xl font-black text-text">
              Pronto para saber em qual nível você se encontra?
            </h3>
            <p class="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
              O teste é 100% gratuito e não exige login prévio. Ao finalizar, informe seu
              nome e e-mail para receber o relatório completo em PDF.
            </p>
            <div class="pt-2">
              <RouterLink to="/cefr-test"
                class="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm bg-primary text-white shadow-lg shadow-primary/25 hover:opacity-95 transition-opacity">
                <Sparkles :size="16" />
                <span>Iniciar Teste CEFR Agora</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </section>

      <!-- FEATURES / MÉTODO / RECURSOS -->
      <section id="metodo" class="py-20 bg-surface border-t border-border">
        <div id="recursos" class="max-w-6xl mx-auto px-6 space-y-12">
          <div class="text-center max-w-xl mx-auto space-y-4">
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              Metodologia de Alta Performance
            </span>
            <h2 class="text-3xl md:text-4xl font-black tracking-tight">
              Por que aprender com a Teacher Tati AI?
            </h2>
            <p class="text-sm text-text-muted leading-relaxed">
              Combinamos expertise pedagógica com modelos avançados de IA para criar uma
              experiência de aprendizado dinâmica e livre de julgamentos.
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-6">
            <div v-for="f in FEATURES" :key="f.title"
              class="rounded-2xl border border-border bg-bg/60 p-7 flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div>
                <div class="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <component :is="f.icon" :size="22" />
                </div>
                <h3 class="font-bold text-base text-text mb-2.5">
                  {{ f.title }}
                </h3>
                <p class="text-xs md:text-sm text-text-muted leading-relaxed">
                  {{ f.desc }}
                </p>
              </div>

              <div v-if="f.route" class="mt-6 pt-4 border-t border-border">
                <RouterLink :to="f.route"
                  class="text-xs font-bold text-primary hover:underline flex items-center gap-1.5">
                  {{ f.linkText }}
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FINAL CTA -->
      <section class="py-20 bg-bg border-t border-border text-center">
        <div class="max-w-xl mx-auto px-6 space-y-6">
          <div
            class="w-14 h-14 rounded-2xl overflow-hidden mx-auto bg-primary/10 border border-primary/20 flex items-center justify-center shadow-md shadow-primary/10">
            <img v-if="!logoError" src="/images/tati_logo.jpg" alt="Teacher Tati AI"
              class="w-full h-full object-contain" />
            <span v-else class="font-black text-primary text-xl">T</span>
          </div>

          <h2 class="text-3xl md:text-4xl font-black tracking-tight text-text leading-tight">
            Pronto para transformar seu aprendizado de inglês?
          </h2>

          <p class="text-sm text-text-muted leading-relaxed">
            Comece pelo teste CEFR gratuito ou crie sua conta para acessar exercícios,
            flashcards e todo o poder da Teacher Tati AI.
          </p>

          <div class="flex flex-wrap justify-center gap-3 pt-2">
            <RouterLink to="/cefr-test"
              class="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm bg-primary text-white shadow-lg shadow-primary/25 hover:opacity-95 transition-all">
              <Sparkles :size="16" />
              <span>Fazer Teste CEFR Gratuito</span>
            </RouterLink>
            <RouterLink to="/login?tab=register"
              class="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm border border-border bg-surface text-text hover:bg-bgSecondary transition-all">
              <span>Criar Conta Gratuita</span>
            </RouterLink>
          </div>
        </div>
      </section>
    </main>

    <!-- FOOTER -->
    <footer class="bg-surface border-t border-border">
      <div class="max-w-6xl mx-auto px-6 py-10">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div class="flex items-center gap-2.5">
            <div
              class="w-8 h-8 rounded-full overflow-hidden bg-primary text-white font-black flex items-center justify-center shrink-0">
              <img v-if="!logoError" src="/images/tati_logo.jpg" alt="Teacher Tati AI"
                class="w-full h-full object-contain" />
              <span v-else class="text-xs">T</span>
            </div>
            <div>
              <p class="text-sm font-black leading-none text-text">
                Teacher <span class="text-primary">Tati AI</span>
              </p>
              <p class="text-[11px] text-text-muted leading-none mt-1">
                Tati's English Class
              </p>
            </div>
          </div>

          <nav class="flex flex-wrap gap-5 text-xs font-bold text-text-muted">
            <RouterLink to="/cefr-test" class="hover:text-primary transition-colors">
              Teste CEFR
            </RouterLink>
            <RouterLink to="/activities/hub" class="hover:text-primary transition-colors">
              Taty's Materials
            </RouterLink>
            <RouterLink to="/login" class="hover:text-primary transition-colors">
              Entrar
            </RouterLink>
            <RouterLink to="/login?tab=register" class="hover:text-primary transition-colors">
              Criar Conta
            </RouterLink>
          </nav>
        </div>

        <div class="border-t border-border pt-6 text-center">
          <p class="text-xs text-text-muted">
            © {{ new Date().getFullYear() }} Teacher Tati AI. Todos os direitos reservados.
            Em conformidade com a LGPD e regulamentações educacionais.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>