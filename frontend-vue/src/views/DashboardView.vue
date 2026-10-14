<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  Users,
  MessageSquare,
  ShoppingBag,
  Zap,
  Search,
  Menu,
  PieChart,
  LineChart,
  Layers,
  Drama,
  Gamepad2,
  Newspaper,
  BookOpen,
  ArrowRight,
  X,
  RotateCcw,
  Settings,
  Plus,
  Trash2,
  PenLine,
  ExternalLink,
  Star,
  CheckCircle2,
  Send,
  Loader2,
  Flame,
  Smartphone,
  QrCode,
  Check,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { canAccessDashboard } from '@/utils/permissions';

type DashSection =
  | 'overview'
  | 'students'
  | 'reports'
  | 'flashcards'
  | 'simulations'
  | 'games'
  | 'news'
  | 'cefr'
  | 'premium'
  | 'feedbacks'
  | 'whatsapp';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// Access check: students (especially caio.sampaio) are forbidden
if (!canAccessDashboard(authStore.user)) {
  router.replace('/chat');
}

const activeSection = ref<DashSection>(
  (route.query.tab as DashSection) || 'overview'
);
const isSidebarOpen = ref(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
const searchQuery = ref('');
const isLoading = ref(false);

const stats = ref({
  total_students: 59,
  total_messages: 1240,
  total_buyers: 14,
  active_today: 18,
});

const students = ref<any[]>([
  {
    id: '1',
    username: 'cris.rezende',
    name: 'Cristiane Rezende Fernandes',
    level: 'B1',
    last_active: 'Hoje 16:23',
    msgs: 42,
    joined: '08/09/2026',
    email: 'cris@exemplo.com',
  },
  {
    id: '2',
    username: 'lenterner',
    name: 'Raissa Lenterne',
    level: 'A2',
    last_active: 'Hoje 10:04',
    msgs: 19,
    joined: '12/09/2026',
    email: 'raissa@exemplo.com',
  },
  {
    id: '3',
    username: 'luis.alvares',
    name: 'Luis Alvares',
    level: 'B2',
    last_active: 'Hoje 09:53',
    msgs: 154,
    joined: '01/09/2026',
    email: 'luis@exemplo.com',
  },
  {
    id: '4',
    username: 'caio.sampaio',
    name: 'Caio Sampaio',
    level: 'B1',
    last_active: 'Ontem 22:22',
    msgs: 87,
    joined: '15/08/2026',
    email: 'caio@exemplo.com',
  },
  {
    id: '5',
    username: 'romullojoga10',
    name: 'Romullo Silva',
    level: 'B1',
    last_active: 'Ontem 08:55',
    msgs: 33,
    joined: '02/10/2026',
    email: 'romullo@exemplo.com',
  },
]);

// Simulations State
const simulations = ref<any[]>([
  { id: '1', name: 'Check-in no Aeroporto', difficulty: 'A2', description: 'Pratique perguntas sobre bagagem, passaporte e portão de embarque.', is_published: true },
  { id: '2', name: 'Entrevista de Emprego', difficulty: 'B2', description: 'Apresente suas experiências profissionais e pontos fortes para o recrutador.', is_published: true },
  { id: '3', name: 'Pedindo Comida em Restaurante', difficulty: 'A1', description: 'Faça pedidos, tire dúvidas sobre o menu e peça a conta em inglês.', is_published: true },
  { id: '4', name: 'Resolução de Problema no Hotel', difficulty: 'B1', description: 'Comunique problemas no quarto e solicite troca de toalhas na recepção.', is_published: true },
]);

// Games State
const games = ref<any[]>([
  { id: '1', title: 'Phrasal Verbs Challenge', levels: ['B1', 'B2'], wordwall_url: 'https://wordwall.net/resource/12345', is_published: true },
  { id: '2', title: 'Food & Drinks Vocabulary Match', levels: ['A1', 'A2'], wordwall_url: 'https://wordwall.net/resource/67890', is_published: true },
  { id: '3', title: 'Business English Acronyms Quiz', levels: ['B2', 'C1'], wordwall_url: 'https://wordwall.net/resource/54321', is_published: true },
]);

// News State
const newsItems = ref<any[]>([
  { id: '1', title: 'How Artificial Intelligence is Changing Language Learning', levels: ['B1', 'B2'], url: 'https://bbc.com', description: 'Artigo sobre as novas ferramentas de conversação adaptativa.', is_published: true },
  { id: '2', title: '10 Essential Tips for Travel in London', levels: ['A2', 'B1'], url: 'https://theguardian.com', description: 'Guia prático de viagem com vocabulário de transporte público.', is_published: true },
]);

// Flashcards State
const flashcardDecks = ref<any[]>([
  { id: '1', title: 'Top 50 Phrasal Verbs', level: 'B1', card_count: 50, desc: 'Verbos compostos mais utilizados no dia a dia corporativo.' },
  { id: '2', title: 'Travel Essentials', level: 'A2', card_count: 35, desc: 'Vocabulário chave para alfândega, hotel e transporte.' },
  { id: '3', title: 'Daily Routine Idioms', level: 'B2', card_count: 40, desc: 'Expressões idiomáticas nativas sobre rotina e trabalho.' },
]);

// Feedbacks State
const feedbacks = ref<any[]>([
  { id: '1', student_name: 'Cristiane Rezende', rating: 5, area: 'Conversação com IA', comment: 'A pronúncia da Teacher Tati é fantástica, sinto que perdi o medo de falar!', date: 'Hoje às 14:20' },
  { id: '2', student_name: 'Luis Alvares', rating: 5, area: 'Simulações', comment: 'A simulação de entrevista de emprego foi super realista.', date: 'Ontem às 18:10' },
  { id: '3', student_name: 'Raissa Lenterne', rating: 4, area: 'Flashcards', comment: 'Gostei muito dos baralhos, ajudou a memorizar palavras novas.', date: '11/10/2026' },
]);

// WAHA Session State
const whatsappSession = ref({
  status: 'CONNECTED',
  phone: '+55 11 98765-4321',
  name: "Teacher Tati Bot (WAHA)",
});

const navItems: Array<{ id: DashSection; icon: any; label: string }> = [
  { id: 'overview', icon: PieChart, label: 'Visão Geral' },
  { id: 'students', icon: Users, label: 'Alunos' },
  { id: 'reports', icon: LineChart, label: 'Relatórios' },
  { id: 'flashcards', icon: Layers, label: 'Flashcards' },
  { id: 'simulations', icon: Drama, label: 'Simulações' },
  { id: 'games', icon: Gamepad2, label: 'Jogos' },
  { id: 'news', icon: Newspaper, label: 'Notícias' },
  { id: 'cefr', icon: BookOpen, label: 'Materiais CEFR' },
  { id: 'premium', icon: Zap, label: 'Materiais Premium' },
  { id: 'feedbacks', icon: MessageSquare, label: 'Feedbacks' },
  { id: 'whatsapp', icon: Smartphone, label: 'Conexão WhatsApp' },
];

const filteredStudents = computed(() => {
  if (!searchQuery.value.trim()) return students.value;
  const q = searchQuery.value.toLowerCase();
  return students.value.filter(
    (s) =>
      s.username.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.level.toLowerCase().includes(q)
  );
});

async function fetchDashboardStats() {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    const res = await fetch('/dashboard/stats', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.total_students === 'number') stats.value.total_students = data.total_students;
      if (typeof data.total_messages === 'number') stats.value.total_messages = data.total_messages;
    }
  } catch (_) {
  } finally {
    isLoading.value = false;
  }
}

function selectSection(id: DashSection) {
  activeSection.value = id;
  router.replace({ query: { tab: id } });
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
}

onMounted(() => {
  fetchDashboardStats();
});
</script>

<template>
  <div class="flex h-screen bg-bg overflow-hidden relative">
    <!-- Mobile Overlay -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 bg-black/60 z-[60] md:hidden transition-opacity"
      @click="isSidebarOpen = false"
    />

    <!-- Canonical Dashboard Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-[70] w-[280px] bg-surface border-r border-line flex flex-col h-screen shrink-0 transition-transform duration-300"
      :class="isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <div class="p-6 shrink-0 flex items-center justify-between border-b border-line">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg overflow-hidden bg-primarySoft flex items-center justify-center shrink-0 border border-primary/20">
            <img src="/images/tati_logo.jpg" alt="Tati" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <div class="font-display text-[0.9rem] font-bold tracking-tight text-ink truncate">Taty's Hub</div>
            <div class="text-[0.65rem] font-bold text-primary uppercase tracking-widest leading-none">Painel do Professor</div>
          </div>
        </div>

        <button
          type="button"
          class="p-1.5 rounded-md hover:bg-bgSecondary text-muted md:hidden cursor-pointer"
          @click="isSidebarOpen = false"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Navigation links -->
      <nav class="flex-1 px-4 py-3 space-y-1 overflow-y-auto no-scrollbar">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left"
          :class="
            activeSection === item.id
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:bg-primarySoft/40 hover:text-primary'
          "
          @click="selectSection(item.id)"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <!-- Footer action links -->
      <div class="p-4 border-t border-line space-y-2 shrink-0">
        <router-link
          to="/chat"
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-primary bg-primarySoft hover:bg-primary/20 transition-all cursor-pointer"
        >
          <MessageSquare :size="18" />
          <span>Ir para o Chat</span>
        </router-link>

        <router-link
          to="/settings"
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-muted hover:bg-bgSecondary transition-all cursor-pointer"
        >
          <Settings :size="18" />
          <span>Configurações</span>
        </router-link>
      </div>
    </aside>

    <!-- Main Content Container with Responsive Padding -->
    <div
      class="flex-1 flex flex-col min-w-0 relative bg-bg transition-all duration-300 h-screen"
      :class="isSidebarOpen ? 'md:pl-[280px]' : 'md:pl-0'"
    >
      <!-- Top header -->
      <header class="h-16 border-b border-line bg-surface/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="p-2 rounded-xl border border-line hover:bg-bgSecondary text-muted hover:text-ink transition cursor-pointer"
            @click="isSidebarOpen = !isSidebarOpen"
          >
            <Menu :size="20" />
          </button>
          <div>
            <h2 class="text-base font-bold text-ink leading-tight">
              {{ navItems.find((n) => n.id === activeSection)?.label || 'Painel' }}
            </h2>
            <p class="text-[0.65rem] font-bold text-muted uppercase tracking-wider">
              Administração e Métricas da Plataforma
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="p-2 rounded-xl border border-line hover:bg-bgSecondary text-muted hover:text-ink transition cursor-pointer"
            title="Atualizar dados"
            @click="fetchDashboardStats"
          >
            <RotateCcw :size="16" />
          </button>
        </div>
      </header>

      <!-- Main Body -->
      <main class="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in overflow-y-auto no-scrollbar space-y-6">
        <!-- 1. ABA: VISÃO GERAL (OVERVIEW) -->
        <template v-if="activeSection === 'overview'">
          <!-- 4 Stat Cards in a row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Card 1: Students -->
            <div class="bg-surface border border-line rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <Users :size="22" class="text-muted" />
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[0.65rem] font-bold border border-emerald-500/20">
                  ↑ Ativos
                </span>
              </div>
              <div class="mt-4">
                <div class="text-3xl font-black text-ink tracking-tight">{{ stats.total_students }}</div>
                <div class="text-[0.65rem] font-bold text-muted uppercase tracking-wider mt-1">ALUNOS MATRICULADOS</div>
              </div>
            </div>

            <!-- Card 2: Messages -->
            <div class="bg-surface border border-line rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <MessageSquare :size="22" class="text-muted" />
              </div>
              <div class="mt-4">
                <div class="text-3xl font-black text-ink tracking-tight">{{ stats.total_messages }}</div>
                <div class="text-[0.65rem] font-bold text-muted uppercase tracking-wider mt-1">MENSAGENS HOJE</div>
              </div>
            </div>

            <!-- Card 3: Buyers -->
            <div class="bg-surface border border-line rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <ShoppingBag :size="22" class="text-muted" />
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[0.65rem] font-bold border border-emerald-500/20">
                  Clientes
                </span>
              </div>
              <div class="mt-4">
                <div class="text-3xl font-black text-ink tracking-tight">{{ stats.total_buyers }}</div>
                <div class="text-[0.65rem] font-bold text-muted uppercase tracking-wider mt-1">COMPRADORES DE MATERIAIS</div>
              </div>
            </div>

            <!-- Card 4: Active Today -->
            <div class="bg-surface border border-line rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div class="flex items-center justify-between">
                <div class="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-primary">
                  <Zap :size="18" />
                </div>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[0.65rem] font-bold border border-emerald-500/20">
                  Hoje
                </span>
              </div>
              <div class="mt-4">
                <div class="text-3xl font-black text-ink tracking-tight">{{ stats.active_today }}</div>
                <div class="text-[0.65rem] font-bold text-muted uppercase tracking-wider mt-1">ALUNOS ATIVOS HOJE</div>
              </div>
            </div>
          </div>

          <!-- Quick Access Pill Banners -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="p-4 rounded-2xl border border-line bg-surface flex items-center gap-3 text-xs font-semibold text-ink shadow-xs">
              <Users :size="18" class="text-primary shrink-0" />
              <span>Taty's Hub — Plataforma de aprendizado com IA adaptativa</span>
            </div>

            <div class="p-4 rounded-2xl border border-line bg-surface flex items-center gap-3 text-xs font-semibold text-ink shadow-xs">
              <ShoppingBag :size="18" class="text-emerald-500 shrink-0" />
              <span class="text-emerald-600 dark:text-emerald-400">Taty's Materials — Loja de apostilas e e-books premium</span>
            </div>
          </div>

          <!-- Recent Students Card & Table -->
          <section class="bg-surface border border-line rounded-3xl overflow-hidden shadow-xs">
            <div class="p-6 border-b border-line flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Users :size="18" class="text-primary" />
                <h3 class="font-bold text-ink text-sm">Alunos Recentes</h3>
              </div>

              <button
                type="button"
                class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                @click="activeSection = 'students'"
              >
                <span>Ver todos</span>
                <ArrowRight :size="13" />
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead class="bg-bgSecondary/60 text-[0.65rem] font-bold text-muted uppercase tracking-widest border-b border-line">
                  <tr>
                    <th class="px-6 py-3">ALUNO</th>
                    <th class="px-6 py-3">NÍVEL</th>
                    <th class="px-6 py-3">ÚLTIMO ACESSO</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line text-xs">
                  <tr
                    v-for="s in students.slice(0, 4)"
                    :key="s.username"
                    class="hover:bg-bgSecondary/40 transition-colors"
                  >
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primarySoft text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {{ s.name.charAt(0) }}
                        </div>
                        <div>
                          <div class="font-bold text-ink">{{ s.name }}</div>
                          <div class="text-[0.7rem] text-muted">@{{ s.username }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2 py-0.5 rounded-md bg-bgSecondary border border-line text-[0.65rem] font-bold text-muted">
                        {{ s.level }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-muted">
                      {{ s.last_active }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <!-- 2. ABA: ALUNOS (STUDENTS) -->
        <template v-else-if="activeSection === 'students'">
          <div class="bg-surface border border-line rounded-3xl overflow-hidden shadow-xs">
            <div class="p-6 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 class="font-bold text-ink text-base">Gerenciamento de Alunos</h3>
                <p class="text-xs text-muted">Lista completa de estudantes matriculados</p>
              </div>

              <div class="relative max-w-sm w-full">
                <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  v-model="searchQuery"
                  placeholder="Pesquisar por nome, usuário ou nível..."
                  class="w-full pl-10 pr-4 py-2 bg-bg border border-line rounded-xl text-xs sm:text-sm outline-none focus:border-primary transition"
                />
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead class="bg-bgSecondary/60 text-[0.65rem] font-bold text-muted uppercase tracking-widest border-b border-line">
                  <tr>
                    <th class="px-6 py-3">ALUNO</th>
                    <th class="px-6 py-3">NÍVEL</th>
                    <th class="px-6 py-3">MENSAGENS</th>
                    <th class="px-6 py-3">ÚLTIMA ATIVIDADE</th>
                    <th class="px-6 py-3">MATRÍCULA</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line text-xs">
                  <tr
                    v-for="s in filteredStudents"
                    :key="s.username"
                    class="hover:bg-bgSecondary/40 transition-colors"
                  >
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primarySoft text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {{ s.name.charAt(0) }}
                        </div>
                        <div>
                          <div class="font-bold text-ink">{{ s.name }}</div>
                          <div class="text-[0.7rem] text-muted">@{{ s.username }} • {{ s.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[0.65rem] font-bold text-primary">
                        {{ s.level }}
                      </span>
                    </td>
                    <td class="px-6 py-4 font-semibold text-ink">
                      {{ s.msgs }}
                    </td>
                    <td class="px-6 py-4 text-muted">
                      {{ s.last_active }}
                    </td>
                    <td class="px-6 py-4 text-muted">
                      {{ s.joined }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- 3. ABA: RELATÓRIOS (REPORTS) -->
        <template v-else-if="activeSection === 'reports'">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-surface border border-line p-6 rounded-3xl shadow-xs">
              <h3 class="font-bold text-sm text-ink mb-4 flex items-center gap-2">
                <div class="w-1.5 h-4 bg-primary rounded-full" />
                <span>Atividade Semanal de Conversação</span>
              </h3>
              <div class="h-48 flex items-end justify-between gap-3 pt-6 px-4 border-b border-line pb-4">
                <div v-for="(day, idx) in ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']" :key="day" class="flex-1 flex flex-col items-center gap-2">
                  <div class="w-full bg-primary/20 hover:bg-primary rounded-t-lg transition-all" :style="{ height: `${[40, 65, 85, 70, 95, 50, 60][idx]}%` }" />
                  <span class="text-[10px] font-bold text-muted">{{ day }}</span>
                </div>
              </div>
            </div>

            <div class="bg-surface border border-line p-6 rounded-3xl shadow-xs">
              <h3 class="font-bold text-sm text-ink mb-4 flex items-center gap-2">
                <div class="w-1.5 h-4 bg-primary rounded-full" />
                <span>Distribuição de Níveis CEFR</span>
              </h3>
              <div class="space-y-3">
                <div v-for="lvl in [{ name: 'A1 - Iniciante', count: 12, pct: '20%' }, { name: 'A2 - Básico', count: 18, pct: '30%' }, { name: 'B1 - Intermediário', count: 21, pct: '35%' }, { name: 'B2 - Independente', count: 8, pct: '15%' }]" :key="lvl.name" class="space-y-1">
                  <div class="flex items-center justify-between text-xs font-semibold">
                    <span class="text-ink">{{ lvl.name }}</span>
                    <span class="text-muted">{{ lvl.count }} alunos ({{ lvl.pct }})</span>
                  </div>
                  <div class="w-full h-2 bg-bgSecondary rounded-full overflow-hidden">
                    <div class="h-full bg-primary rounded-full" :style="{ width: lvl.pct }" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 4. ABA: FLASHCARDS -->
        <template v-else-if="activeSection === 'flashcards'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-base text-ink">Baralhos de Flashcards</h3>
              <p class="text-xs text-muted">Gerencie os baralhos de repetição espaçada</p>
            </div>
            <button type="button" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primaryHover transition cursor-pointer">
              <Plus :size="15" />
              <span>Novo Baralho</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div v-for="d in flashcardDecks" :key="d.id" class="bg-surface border border-line p-5 rounded-2xl shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{{ d.level }}</span>
                  <span class="text-xs text-muted font-semibold">{{ d.card_count }} cartas</span>
                </div>
                <h4 class="font-bold text-sm text-ink mb-1">{{ d.title }}</h4>
                <p class="text-xs text-muted leading-relaxed">{{ d.desc }}</p>
              </div>
              <div class="flex items-center gap-2 pt-3 border-t border-line/60">
                <button type="button" class="text-xs font-bold text-primary hover:underline">Editar cartas</button>
              </div>
            </div>
          </div>
        </template>

        <!-- 5. ABA: SIMULAÇÕES -->
        <template v-else-if="activeSection === 'simulations'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-base text-ink">Cenários de Simulação</h3>
              <p class="text-xs text-muted">Práticas imersivas de conversação no mundo real</p>
            </div>
            <button type="button" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primaryHover transition cursor-pointer">
              <Plus :size="15" />
              <span>Novo Cenário</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="s in simulations" :key="s.id" class="bg-surface border border-line p-5 rounded-2xl shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">{{ s.difficulty }}</span>
                  <span class="text-[0.65rem] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">Publicado</span>
                </div>
                <h4 class="font-bold text-sm text-ink mb-1">{{ s.name }}</h4>
                <p class="text-xs text-muted leading-relaxed">{{ s.description }}</p>
              </div>
              <div class="flex items-center gap-3 pt-3 border-t border-line/60 text-xs font-bold text-primary">
                <button type="button" class="hover:underline">Editar prompt</button>
                <button type="button" class="hover:underline">Testar modo voz</button>
              </div>
            </div>
          </div>
        </template>

        <!-- 6. ABA: JOGOS -->
        <template v-else-if="activeSection === 'games'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-base text-ink">Jogos WordWall</h3>
              <p class="text-xs text-muted">Jogos interativos integrados para engajar os alunos</p>
            </div>
            <button type="button" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primaryHover transition cursor-pointer">
              <Plus :size="15" />
              <span>Adicionar Jogo</span>
            </button>
          </div>

          <div class="bg-surface border border-line rounded-3xl overflow-hidden shadow-xs">
            <table class="w-full text-left border-collapse">
              <thead class="bg-bgSecondary/60 text-[0.65rem] font-bold text-muted uppercase tracking-widest border-b border-line">
                <tr>
                  <th class="px-6 py-3">JOGO</th>
                  <th class="px-6 py-3">NÍVEIS</th>
                  <th class="px-6 py-3">STATUS</th>
                  <th class="px-6 py-3">AÇÃO</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line text-xs">
                <tr v-for="g in games" :key="g.id" class="hover:bg-bgSecondary/40">
                  <td class="px-6 py-4 font-bold text-ink">{{ g.title }}</td>
                  <td class="px-6 py-4 text-muted">{{ g.levels.join(', ') }}</td>
                  <td class="px-6 py-4 text-emerald-600 font-semibold">Ativo</td>
                  <td class="px-6 py-4">
                    <a :href="g.wordwall_url" target="_blank" class="text-primary hover:underline flex items-center gap-1 font-bold">
                      <span>Abrir</span>
                      <ExternalLink :size="12" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- 7. ABA: NOTÍCIAS -->
        <template v-else-if="activeSection === 'news'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-base text-ink">Notícias e Artigos</h3>
              <p class="text-xs text-muted">Leituras reais com vocabulário contextual</p>
            </div>
            <button type="button" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primaryHover transition cursor-pointer">
              <Plus :size="15" />
              <span>Publicar Artigo</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="n in newsItems" :key="n.id" class="bg-surface border border-line p-5 rounded-2xl shadow-xs space-y-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{{ n.levels.join(', ') }}</span>
              <h4 class="font-bold text-sm text-ink">{{ n.title }}</h4>
              <p class="text-xs text-muted">{{ n.description }}</p>
            </div>
          </div>
        </template>

        <!-- 8. ABA: CEFR -->
        <template v-else-if="activeSection === 'cefr'">
          <div class="bg-surface border border-line p-6 rounded-3xl shadow-xs space-y-4">
            <h3 class="font-bold text-base text-ink flex items-center gap-2">
              <BookOpen :size="18" class="text-primary" />
              <span>Gerador e Diagnóstico CEFR de PDFs</span>
            </h3>
            <p class="text-xs text-muted leading-relaxed">
              Faça upload de materiais de aula, exercícios ou questionários em formato PDF para diagnosticar o nível CEFR ou extrair baralhos de vocabulário e exercícios de gramática automaticamente com IA.
            </p>
            <div class="border-2 border-dashed border-line rounded-2xl p-8 text-center bg-bgSecondary/40 hover:border-primary/50 transition cursor-pointer">
              <BookOpen :size="32" class="text-primary mx-auto mb-2 opacity-70" />
              <p class="text-xs font-bold text-ink">Clique para selecionar um arquivo PDF ou arraste até aqui</p>
              <p class="text-[0.7rem] text-muted mt-1">Formatos aceitos: PDF até 25MB</p>
            </div>
          </div>
        </template>

        <!-- 9. ABA: PREMIUM -->
        <template v-else-if="activeSection === 'premium'">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-base text-ink">Materiais Premium da Tatiana</h3>
              <p class="text-xs text-muted">Apostilas, e-books e conteúdos pagos para alunos e compradores</p>
            </div>
            <button type="button" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-primaryHover transition cursor-pointer">
              <Plus :size="15" />
              <span>Novo Material</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-surface border border-line p-5 rounded-2xl shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs">PDF</span>
                <span class="text-xs font-bold text-ink">R$ 29,90</span>
              </div>
              <h4 class="font-bold text-sm text-ink">Guia Definitivo de Tempos Verbais em Inglês</h4>
              <p class="text-xs text-muted">Apostila ilustrada com mais de 120 exercícios e gabarito comentado.</p>
            </div>

            <div class="bg-surface border border-line p-5 rounded-2xl shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs">E-book</span>
                <span class="text-xs font-bold text-ink">R$ 39,90</span>
              </div>
              <h4 class="font-bold text-sm text-ink">Manual de Inglês para Viagens e Emergências</h4>
              <p class="text-xs text-muted">Tudo o que você precisa falar no aeroporto, imigração e alfândega.</p>
            </div>
          </div>
        </template>

        <!-- 10. ABA: FEEDBACKS -->
        <template v-else-if="activeSection === 'feedbacks'">
          <div class="mb-4">
            <h3 class="font-bold text-base text-ink">Feedbacks dos Alunos</h3>
            <p class="text-xs text-muted">Avaliações e comentários enviados após os treinos</p>
          </div>

          <div class="space-y-3">
            <div v-for="f in feedbacks" :key="f.id" class="bg-surface border border-line p-5 rounded-2xl shadow-xs space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-ink">{{ f.student_name }}</span>
                  <span class="text-xs text-muted">• {{ f.area }}</span>
                </div>
                <div class="flex items-center gap-1 text-amber-500">
                  <Star v-for="i in f.rating" :key="i" :size="14" class="fill-current" />
                </div>
              </div>
              <p class="text-xs text-ink leading-relaxed">"{{ f.comment }}"</p>
              <div class="text-[0.65rem] text-muted">{{ f.date }}</div>
            </div>
          </div>
        </template>

        <!-- 11. ABA: WHATSAPP -->
        <template v-else-if="activeSection === 'whatsapp'">
          <div class="bg-surface border border-line p-6 rounded-3xl shadow-xs space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-base text-ink flex items-center gap-2">
                  <Smartphone :size="18" class="text-emerald-500" />
                  <span>Conexão WhatsApp (WAHA)</span>
                </h3>
                <p class="text-xs text-muted mt-1">Gerencie a sessão da Teacher Tati para envio de lembretes e notificações</p>
              </div>

              <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-bold">
                <CheckCircle2 :size="14" />
                <span>{{ whatsappSession.status === 'CONNECTED' ? 'Conectado' : 'Desconectado' }}</span>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="p-4 rounded-2xl bg-bgSecondary border border-line space-y-1">
                <div class="text-[0.65rem] font-bold text-muted uppercase">Número Conectado</div>
                <div class="text-sm font-bold text-ink">{{ whatsappSession.phone }}</div>
              </div>
              <div class="p-4 rounded-2xl bg-bgSecondary border border-line space-y-1">
                <div class="text-[0.65rem] font-bold text-muted uppercase">Sessão</div>
                <div class="text-sm font-bold text-ink">{{ whatsappSession.name }}</div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>