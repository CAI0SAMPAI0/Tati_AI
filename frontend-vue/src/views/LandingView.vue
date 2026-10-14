<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Volume2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BookOpen,
  Mic,
  GraduationCap,
  Layers,
  Clock,
  Award,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-vue-next';

const router = useRouter();
const mobileMenuOpen = ref(false);

const HUB_URL = 'http://localhost:3001/materiais';

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
  { value: 'PDF', label: 'Relatório diagnóstico detalhado' },
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
    desc: 'Pontos principais em situações de trabalho, lazer e viagens.',
  },
  {
    code: 'B2',
    name: 'Independente',
    color: '#6d28d9',
    bg: '#f5f3ff',
    desc: 'Textos complexos, argumentação sólida e fluência com falantes nativos.',
  },
];

const FEATURES = [
  {
    icon: Mic,
    title: 'Áudio & Pronúncia Natural',
    desc: 'Ouça pronúncia britânica ou americana nativa e envie seus próprios áudios. A Teacher Tati avalia ritmo, fluência e clareza da sua fala em tempo real.',
  },
  {
    icon: CheckCircle2,
    title: 'Correção Gramatical Gentil',
    desc: 'Errar faz parte do aprendizado. A IA detecta seus desvios e explica o porquê de cada correção de maneira construtiva e didática, sem julgamentos.',
  },
  {
    icon: BookOpen,
    title: 'Hub de Materiais & SRS',
    desc: 'Revise vocabulário com o algoritmo de Repetição Espaçada, acesse exercícios práticos e e-books didáticos organizados por nível CEFR.',
    link: HUB_URL,
    linkText: 'Acessar Catálogo de Materiais →',
  },
  {
    icon: Award,
    title: 'Exames Trimestrais CEFR',
    desc: 'Avalie sua evolução formalmente com exames completos divididos em Reading, Listening, Speaking e Grammar com nota de 0 a 100.',
  },
];
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-bg text-text">
    <!-- Navbar Superior -->
    <header class="sticky top-0 z-50 border-b border-line bg-surface/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-3">
          <div class="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primarySoft shadow-sm">
            <img src="/images/tati_logo.jpg" alt="Teacher Tati Logo" class="h-full w-full object-cover" />
          </div>
          <div>
            <span class="font-display text-lg font-bold tracking-tight text-ink">Teacher Tati</span>
            <span class="ml-1.5 rounded bg-primarySoft px-1.5 py-0.5 text-[10px] font-bold text-primary">AI</span>
          </div>
        </router-link>

        <!-- Desktop Nav Links -->
        <nav class="hidden md:flex items-center gap-7 text-sm font-medium text-muted">
          <template v-for="link in NAV_LINKS" :key="link.label">
            <a
              v-if="link.external"
              :href="link.href"
              target="_blank"
              rel="noopener noreferrer"
              class="transition hover:text-primary"
            >
              {{ link.label }}
            </a>
            <a
              v-else
              :href="link.href"
              class="transition hover:text-primary"
            >
              {{ link.label }}
            </a>
          </template>
        </nav>

        <!-- Right CTA / Auth -->
        <div class="hidden md:flex items-center gap-3">
          <router-link
            to="/login"
            class="px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink"
          >
            Entrar
          </router-link>
          <router-link
            to="/login?tab=register"
            class="btn-primary px-5 py-2.5 text-xs shadow-sm"
          >
            Começar Grátis
          </router-link>
        </div>

        <!-- Mobile Menu Toggle -->
        <button
          type="button"
          class="rounded-lg p-2 text-muted md:hidden hover:bg-bgSecondary"
          aria-label="Abrir menu"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <X v-if="mobileMenuOpen" :size="22" />
          <Menu v-else :size="22" />
        </button>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div v-if="mobileMenuOpen" class="border-t border-line bg-surface p-4 md:hidden animate-fadeIn">
        <nav class="flex flex-col gap-3 pb-3">
          <template v-for="link in NAV_LINKS" :key="link.label">
            <a
              :href="link.href"
              class="py-1 text-sm font-semibold text-muted hover:text-primary"
              @click="mobileMenuOpen = false"
            >
              {{ link.label }}
            </a>
          </template>
        </nav>
        <div class="flex flex-col gap-2 border-t border-line pt-3">
          <router-link
            to="/login"
            class="btn-secondary w-full py-2.5 text-xs"
            @click="mobileMenuOpen = false"
          >
            Entrar
          </router-link>
          <router-link
            to="/login?tab=register"
            class="btn-primary w-full py-2.5 text-xs"
            @click="mobileMenuOpen = false"
          >
            Começar Grátis
          </router-link>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:pb-28">
      <!-- Background Glow Details -->
      <div class="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div class="mx-auto max-w-6xl">
        <div class="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <!-- Text Col -->
          <div class="text-center lg:col-span-7 lg:text-left">
            <!-- Badge -->
            <div class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primarySoft px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Sparkles :size="14" />
              <span>Plataforma Inteligente de Inglês</span>
            </div>

            <!-- Heading -->
            <h1 class="font-display mt-6 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl lg:leading-[1.12]">
              Aprenda Inglês Falando com uma <span class="text-primary">IA Humanizada</span>
            </h1>

            <!-- Subtitle -->
            <p class="mt-6 text-base leading-relaxed text-muted sm:text-lg">
              Pratique conversação 24/7 com a Teacher Tati. Correções gentis, sotaques britânico e americano, nivelamento CEFR oficial e materiais didáticos interativos para acelerar sua fluência.
            </p>

            <!-- Action Buttons -->
            <div class="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row lg:justify-start">
              <router-link
                to="/login?tab=register"
                class="btn-primary flex w-full items-center justify-center gap-2 px-7 py-3.5 text-sm sm:w-auto"
              >
                <span>Fazer Teste CEFR Gratuito</span>
                <ArrowRight :size="16" />
              </router-link>

              <a
                href="#metodo"
                class="btn-secondary flex w-full items-center justify-center gap-2 px-6 py-3.5 text-sm sm:w-auto"
              >
                Conhecer o Método
              </a>
            </div>

            <!-- Trust Points -->
            <div class="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-medium text-muted lg:justify-start">
              <div class="flex items-center gap-1.5">
                <CheckCircle2 :size="15" class="text-success" />
                <span>Sem cartão de crédito</span>
              </div>
              <div class="flex items-center gap-1.5">
                <CheckCircle2 :size="15" class="text-success" />
                <span>Diagnóstico em 5 minutos</span>
              </div>
              <div class="flex items-center gap-1.5">
                <CheckCircle2 :size="15" class="text-success" />
                <span>Metodologia CEFR internacional</span>
              </div>
            </div>
          </div>

          <!-- Mockup Col -->
          <div class="lg:col-span-5">
            <div class="relative mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-4 shadow-card">
              <!-- Mockup Header -->
              <div class="flex items-center justify-between border-b border-line pb-3">
                <div class="flex items-center gap-2.5">
                  <div class="h-9 w-9 overflow-hidden rounded-full border border-primary/20 bg-primarySoft">
                    <img src="/images/tati_logo.jpg" alt="Teacher Tati" class="h-full w-full object-cover" />
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-ink">Teacher Tati AI</h4>
                    <p class="flex items-center gap-1 text-[11px] text-success font-medium">
                      <span class="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      Online agora
                    </p>
                  </div>
                </div>
                <span class="rounded-md bg-primarySoft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  CEFR TUTOR
                </span>
              </div>

              <!-- Mockup Chat Messages -->
              <div class="space-y-3.5 py-4 text-xs">
                <!-- Tati Msg -->
                <div class="flex items-start gap-2.5">
                  <div class="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-primary/20">
                    <img src="/images/tati_logo.jpg" alt="Tati" class="h-full w-full object-cover" />
                  </div>
                  <div class="max-w-[85%] rounded-2xl rounded-tl-sm bg-bgSecondary p-3 leading-relaxed text-ink">
                    <p>Hello! Welcome to your daily practice! What did you do yesterday evening? ✨</p>
                    <div class="mt-2 flex items-center gap-1.5 text-[11px] text-primary font-semibold">
                      <Volume2 :size="13" />
                      <span>Audio (en-US)</span>
                    </div>
                  </div>
                </div>

                <!-- Student Msg -->
                <div class="flex justify-end">
                  <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary p-3 leading-relaxed text-white">
                    <p>I have went to the supermarket and bought some groceries.</p>
                  </div>
                </div>

                <!-- Tati Correction & Encouragement -->
                <div class="flex items-start gap-2.5">
                  <div class="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-primary/20">
                    <img src="/images/tati_logo.jpg" alt="Tati" class="h-full w-full object-cover" />
                  </div>
                  <div class="max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm border border-line bg-surface p-3 leading-relaxed text-ink shadow-sm">
                    <div class="rounded-lg bg-primarySoft p-2 text-[11px]">
                      <span class="font-bold text-primary">💡 Dica rápida de Gramática:</span>
                      <p class="mt-0.5 text-muted">
                        Para ações com tempo específico no passado ("yesterday"), usamos o Simple Past: <strong>"I went"</strong> em vez de "I have went".
                      </p>
                    </div>
                    <p class="text-ink">Great effort! What groceries did you pick up? 🛒</p>
                  </div>
                </div>
              </div>

              <!-- Input bar fake -->
              <div class="flex items-center gap-2 rounded-xl border border-line bg-bg p-2 text-muted">
                <span class="flex-1 text-xs">Type your response in English...</span>
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
                  <Mic :size="14" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Bar -->
    <section class="border-y border-line bg-surface py-10">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          <div v-for="stat in STATS" :key="stat.value" class="space-y-1">
            <p class="font-display text-3xl font-extrabold text-primary sm:text-4xl">{{ stat.value }}</p>
            <p class="text-xs font-semibold text-muted">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CEFR Levels Section -->
    <section id="cefr" class="py-20 sm:py-24">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Quadro Comum Europeu</span>
          <h2 class="font-display mt-2 text-3xl font-bold text-ink sm:text-4xl">
            Descubra seu Nível Real de Inglês
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            Nosso algoritmo avalia vocabulário, estrutura frasal e compreensão auditiva para situar você com precisão nos padrões internacionais.
          </p>
        </div>

        <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="lvl in CEFR_LEVELS"
            :key="lvl.code"
            class="card-surface flex flex-col justify-between"
          >
            <div>
              <div
                class="inline-flex h-12 w-12 items-center justify-center rounded-xl font-display text-xl font-bold"
                :style="{ backgroundColor: lvl.bg, color: lvl.color }"
              >
                {{ lvl.code }}
              </div>
              <h3 class="font-display mt-4 text-lg font-bold text-ink">{{ lvl.name }}</h3>
              <p class="mt-2 text-xs leading-relaxed text-muted">{{ lvl.desc }}</p>
            </div>
            <div class="mt-6 border-t border-line pt-4">
              <router-link
                to="/login?tab=register"
                class="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <span>Fazer diagnóstico {{ lvl.code }}</span>
                <ArrowRight :size="13" />
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- O Método Section -->
    <section id="metodo" class="border-y border-line bg-surface py-20 sm:py-24">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Metodologia Exclusiva</span>
          <h2 class="font-display mt-2 text-3xl font-bold text-ink sm:text-4xl">
            Como Você Chega à Fluência
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            O método combina imersão ativa diária com correção imediata e neurociência da memória.
          </p>
        </div>

        <div class="mt-14 grid gap-8 md:grid-cols-3">
          <div class="space-y-4 rounded-2xl border border-line bg-bg p-6 text-center sm:text-left">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary sm:mx-0">
              <span class="font-display text-lg font-bold">1</span>
            </div>
            <h3 class="font-display text-lg font-bold text-ink">Prática Diária Sem Julgamento</h3>
            <p class="text-xs leading-relaxed text-muted">
              Perca a vergonha de falar. Converse sobre seus hobbies, trabalho ou dia a dia em um ambiente seguro e sempre encorajador.
            </p>
          </div>

          <div class="space-y-4 rounded-2xl border border-line bg-bg p-6 text-center sm:text-left">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary sm:mx-0">
              <span class="font-display text-lg font-bold">2</span>
            </div>
            <h3 class="font-display text-lg font-bold text-ink">Correção Explicada e Prática</h3>
            <p class="text-xs leading-relaxed text-muted">
              Receba correções pontuais sem cortar o fluxo da conversa. Entenda as nuances entre inglês formal e expressões cotidianas.
            </p>
          </div>

          <div class="space-y-4 rounded-2xl border border-line bg-bg p-6 text-center sm:text-left">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary sm:mx-0">
              <span class="font-display text-lg font-bold">3</span>
            </div>
            <h3 class="font-display text-lg font-bold text-ink">Retenção de Longo Prazo</h3>
            <p class="text-xs leading-relaxed text-muted">
              Vocabulários novos são organizados no sistema SRS e avaliados periodicamente em exames trimestrais estruturados.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Recursos Section -->
    <section id="recursos" class="py-20 sm:py-24">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Ferramentas Integradas</span>
          <h2 class="font-display mt-2 text-3xl font-bold text-ink sm:text-4xl">
            Tudo o que Você Precisa para Aprender
          </h2>
        </div>

        <div class="mt-12 grid gap-6 sm:grid-cols-2">
          <div
            v-for="feat in FEATURES"
            :key="feat.title"
            class="card-surface flex gap-4"
          >
            <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primarySoft text-primary">
              <component :is="feat.icon" :size="24" />
            </div>
            <div class="space-y-1">
              <h3 class="font-display text-base font-bold text-ink">{{ feat.title }}</h3>
              <p class="text-xs leading-relaxed text-muted">{{ feat.desc }}</p>
              <div v-if="feat.link" class="pt-2">
                <a
                  :href="feat.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs font-bold text-primary hover:underline"
                >
                  {{ feat.linkText }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Final -->
    <section class="border-t border-line bg-surface py-20">
      <div class="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primarySoft text-primary">
          <GraduationCap :size="32" />
        </div>
        <h2 class="font-display mt-6 text-3xl font-bold text-ink sm:text-4xl">
          Pronto para falar inglês com confiança?
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Crie sua conta agora, faça o teste de nivelamento gratuito e comece sua jornada com a Teacher Tati.
        </p>
        <div class="mt-8 flex justify-center">
          <router-link
            to="/login?tab=register"
            class="btn-primary flex items-center gap-2 px-8 py-3.5 text-sm shadow-md"
          >
            <span>Começar Agora Gratuitamente</span>
            <ArrowRight :size="16" />
          </router-link>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-line bg-bg py-10 text-xs text-muted">
      <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div class="flex items-center gap-2">
          <span class="font-display font-bold text-ink">Teacher Tati AI</span>
          <span>© 2026. Todos os direitos reservados.</span>
        </div>
        <div class="flex items-center gap-5">
          <router-link to="/privacy" class="hover:text-ink">Privacidade</router-link>
          <a :href="HUB_URL" target="_blank" rel="noopener noreferrer" class="hover:text-ink">Hub de Materiais</a>
          <router-link to="/login" class="hover:text-ink">Área do Aluno</router-link>
        </div>
      </div>
    </footer>
  </div>
</template>
