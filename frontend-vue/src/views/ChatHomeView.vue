<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  MessageSquare,
  Award,
  BookOpen,
  LogOut,
  Sparkles,
  Shield,
  Volume2,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const roleBadge = computed(() => {
  if (authStore.isProgrammer) return { label: 'Programador / Admin', color: 'bg-primary text-white' };
  if (authStore.isStudent) return { label: 'Estudante', color: 'bg-success/15 text-success' };
  return { label: 'Usuário Hub', color: 'bg-bgSecondary text-muted' };
});

function handleLogout() {
  authStore.clearSession();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <!-- Authenticated Header -->
    <header class="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <!-- Logo -->
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 overflow-hidden rounded-full border border-primary/20 bg-primarySoft shadow-sm">
            <img src="/images/tati_logo.jpg" alt="Teacher Tati Logo" class="h-full w-full object-cover" />
          </div>
          <div>
            <h1 class="font-display text-sm font-bold text-ink">Teacher Tati AI</h1>
            <p class="text-[10px] text-muted">Portal do Aluno • Vue 3</p>
          </div>
        </div>

        <!-- User Info & Actions -->
        <div class="flex items-center gap-3 sm:gap-4">
          <!-- User Profile Chip -->
          <div class="hidden sm:flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-xs">
            <span class="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span class="font-semibold text-ink">{{ user?.name || user?.username }}</span>
            <span class="rounded px-1.5 py-0.5 text-[10px] font-bold" :class="roleBadge.color">
              {{ roleBadge.label }}
            </span>
          </div>

          <!-- Hub Link -->
          <a
            href="http://localhost:3001/materiais"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-secondary hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          >
            <BookOpen :size="13" />
            <span>Hub de Materiais</span>
            <ExternalLink :size="11" class="text-muted" />
          </a>

          <!-- Logout Button -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-line p-2 text-xs font-semibold text-muted hover:bg-bgSecondary hover:text-danger transition"
            title="Sair da conta"
            @click="handleLogout"
          >
            <LogOut :size="15" />
            <span class="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <!-- Welcome Hero Card -->
      <div class="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10 shadow-card">
        <div class="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[80px]" />

        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-1.5 rounded-full bg-primarySoft px-3 py-1 text-xs font-bold text-primary">
            <Sparkles :size="13" />
            <span>Sessão Autenticada com Sucesso</span>
          </div>

          <h2 class="font-display mt-4 text-2xl font-extrabold text-ink sm:text-3xl">
            Olá, {{ user?.name || user?.username }}! 👋
          </h2>

          <p class="mt-2 text-sm leading-relaxed text-muted">
            Bem-vindo à nova versão do frontend migrada para <strong>Vue 3 + Vite + Pinia</strong>. Sua autenticação com a conta de programador foi validada com sucesso no backend Django.
          </p>

          <!-- User status badges -->
          <div class="mt-6 flex flex-wrap gap-2 text-xs">
            <span class="rounded-lg border border-line bg-bg px-3 py-1.5 font-medium text-muted">
              Nível Atual: <strong class="text-ink">{{ user?.level || 'A1' }}</strong>
            </span>
            <span class="rounded-lg border border-line bg-bg px-3 py-1.5 font-medium text-muted">
              Papel no Sistema: <strong class="text-ink">{{ user?.role }}</strong>
            </span>
            <span class="rounded-lg border border-line bg-bg px-3 py-1.5 font-medium text-muted">
              Sotaque: <strong class="text-ink">{{ user?.preferred_accent || 'en-US' }}</strong>
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Action Modules -->
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Module 1: Chat -->
        <div class="card-surface flex flex-col justify-between">
          <div>
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primarySoft text-primary">
              <MessageSquare :size="24" />
            </div>
            <h3 class="font-display mt-4 text-base font-bold text-ink">Conversação com IA</h3>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              Pratique conversação diária com a Teacher Tati em inglês com feedback pedagógico instantâneo.
            </p>
          </div>
          <div class="mt-6 border-t border-line pt-4">
            <button type="button" class="btn-primary w-full py-2.5 text-xs">
              Iniciar Conversa
            </button>
          </div>
        </div>

        <!-- Module 2: Exams -->
        <div class="card-surface flex flex-col justify-between">
          <div>
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
              <Award :size="24" />
            </div>
            <h3 class="font-display mt-4 text-base font-bold text-ink">Exames Trimestrais</h3>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              Avaliações CEFR estruturadas (Reading, Listening, Speaking e Grammar) com nota de 0 a 100.
            </p>
          </div>
          <div class="mt-6 border-t border-line pt-4">
            <button type="button" class="btn-secondary w-full py-2.5 text-xs">
              Ver Exames Disponíveis
            </button>
          </div>
        </div>

        <!-- Module 3: Hub -->
        <div class="card-surface flex flex-col justify-between">
          <div>
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
              <BookOpen :size="24" />
            </div>
            <h3 class="font-display mt-4 text-base font-bold text-ink">Hub de Materiais</h3>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              Acesse e-books interativos protegidos, Guias Gramaticais e cadernos de estudo.
            </p>
          </div>
          <div class="mt-6 border-t border-line pt-4">
            <a
              href="http://localhost:3001/materiais"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-secondary flex items-center justify-center gap-1.5 w-full py-2.5 text-xs"
            >
              <span>Acessar o Hub</span>
              <ExternalLink :size="12" />
            </a>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
