<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Menu,
  Search,
  Users,
  MessageSquare,
  ShoppingBag,
  Zap,
  ChevronRight,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuth } from '@/composables/useAuth';
import { canAccessDashboard, formatLastActive, isUserActiveNow } from '@/utils';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import DashboardSidebar, { type DashSection } from '@/components/dashboard/DashboardSidebar.vue';
import StatCard from '@/components/dashboard/StatCard.vue';
import StudentModal from '@/components/dashboard/StudentModal.vue';
import ReportsSection from '@/components/dashboard/ReportsSection.vue';
import FlashcardsSection from '@/components/dashboard/FlashcardsSection.vue';
import SimulationsSection from '@/components/dashboard/SimulationsSection.vue';
import GamesSection from '@/components/dashboard/GamesSection.vue';
import NewsSection from '@/components/dashboard/NewsSection.vue';
import FeedbacksSection from '@/components/dashboard/FeedbacksSection.vue';
import WhatsappSection from '@/components/dashboard/WhatsappSection.vue';
import CefrSection from '@/components/dashboard/CefrSection.vue';
import ExamSection from '@/components/dashboard/ExamSection.vue';
import PremiumSection from '@/components/dashboard/PremiumSection.vue';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { user, isLoaded } = useAuth();

// Permissions check
const hasAccess = computed(() => {
  return canAccessDashboard(user.value);
});

watch([isLoaded, hasAccess], ([loaded, access]) => {
  if (loaded && !access) {
    router.replace('/chat');
  }
});

// Sincronização da seção ativa com a URL
const validSections: DashSection[] = [
  'overview',
  'students',
  'reports',
  'flashcards',
  'simulations',
  'games',
  'news',
  'cefr',
  'exams',
  'premium',
  'feedbacks',
  'whatsapp',
];

function getInitialSection(): DashSection {
  const queryTab = route.query.tab as DashSection;
  if (queryTab && validSections.includes(queryTab)) {
    return queryTab;
  }
  const saved = localStorage.getItem('tati_last_dashboard_tab') as DashSection;
  if (saved && validSections.includes(saved)) {
    return saved;
  }
  return 'overview';
}

const activeSection = ref<DashSection>(getInitialSection());
const isSidebarOpen = ref(true);

function handleSetSection(section: DashSection) {
  activeSection.value = section;
  localStorage.setItem('tati_last_dashboard_tab', section);
  router.replace({ query: { ...route.query, tab: section } });
}

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && validSections.includes(newTab as DashSection) && newTab !== activeSection.value) {
      activeSection.value = newTab as DashSection;
    }
  }
);

onMounted(() => {
  if (!route.query.tab) {
    router.replace({ query: { ...route.query, tab: activeSection.value } });
  }
});

// Carregamento de dados
const stats = ref<any>(null);
const students = ref<any[]>([]);
const searchQuery = ref('');
const selectedStudent = ref<any>(null);
const isStudentModalOpen = ref(false);
const isLoadingData = ref(true);
const currentNow = ref(Date.now());

let pollInterval: any = null;
let clockInterval: any = null;

function handleRevalidate() {
  loadDashboardData(true);
}

async function loadDashboardData(isSilent = false) {
  if (!isSilent) {
    isLoadingData.value = true;
  }
  try {
    const cacheBuster = `_t=${Date.now()}`;
    const statsUrl = ENDPOINTS.DASHBOARD_STATS.includes('?') ? `${ENDPOINTS.DASHBOARD_STATS}&${cacheBuster}` : `${ENDPOINTS.DASHBOARD_STATS}?${cacheBuster}`;
    const studentsUrl = ENDPOINTS.DASHBOARD_STUDENTS.includes('?') ? `${ENDPOINTS.DASHBOARD_STUDENTS}&${cacheBuster}` : `${ENDPOINTS.DASHBOARD_STUDENTS}?${cacheBuster}`;

    const [statsRes, studentsRes] = await Promise.all([
      apiGet<any>(statsUrl).catch(() => null),
      apiGet<any[]>(studentsUrl).catch(() => []),
    ]);
    if (statsRes) stats.value = statsRes;
    if (studentsRes) {
      students.value = studentsRes;
      if (selectedStudent.value) {
        const freshSelected = studentsRes.find((s: any) => s.username === selectedStudent.value.username);
        if (freshSelected) {
          selectedStudent.value = { ...selectedStudent.value, ...freshSelected };
        }
      }
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err);
  } finally {
    if (!isSilent) {
      isLoadingData.value = false;
    }
  }
}

onMounted(() => {
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
  loadDashboardData();

  // Atualiza o relógio a cada 10s para o indicador reativo 'Using now'
  clockInterval = setInterval(() => {
    currentNow.value = Date.now();
  }, 10000);

  // Atualiza a cada 10 segundos para presença e métricas em tempo real
  pollInterval = setInterval(() => {
    loadDashboardData(true);
  }, 10000);

  // Revalida imediatamente ao focar / reconectar / aba visível
  window.addEventListener('focus', handleRevalidate);
  window.addEventListener('online', handleRevalidate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleRevalidate();
    }
  });
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
  if (clockInterval) clearInterval(clockInterval);
  window.removeEventListener('focus', handleRevalidate);
  window.removeEventListener('online', handleRevalidate);
});

const filteredStudents = computed(() => {
  if (!searchQuery.value.trim()) return students.value;
  const q = searchQuery.value.toLowerCase();
  return students.value.filter(
    (s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
  );
});

function handleOpenStudent(student: any) {
  selectedStudent.value = student;
  isStudentModalOpen.value = true;
}

const sectionTitles: Record<DashSection, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Platform summary' },
  students: { title: 'Students', subtitle: 'Student management' },
  reports: { title: 'Reports', subtitle: 'Overview and class metrics' },
  flashcards: { title: 'Flashcards', subtitle: 'Study decks' },
  simulations: { title: 'Simulations', subtitle: 'Real-world scenarios' },
  games: { title: 'Games', subtitle: 'WordWall games for students' },
  news: { title: 'News', subtitle: 'News, reels and links for students' },
  cefr: { title: 'CEFR Materials', subtitle: 'Diagnose and generate from PDFs' },
  exams: { title: 'Exams', subtitle: 'Review questions, AI improvements & student answers by level' },
  premium: { title: "Taty's Materials", subtitle: 'Premium materials & payments' },
  feedbacks: { title: 'Student Feedback', subtitle: 'Opinions and reviews submitted by students' },
  whatsapp: { title: 'WhatsApp Connection', subtitle: 'Connect and manage WhatsApp WAHA sessions' },
};


</script>

<template>
  <div class="flex h-screen bg-bg overflow-hidden relative">
    <!-- Dashboard Sidebar -->
    <DashboardSidebar
      :active-section="activeSection"
      :is-open="isSidebarOpen"
      @set-section="handleSetSection"
      @close="isSidebarOpen = false"
    />

    <!-- Main Content Area -->
    <div
      class="flex-1 flex flex-col min-w-0 bg-bg-secondary/30 relative h-screen transition-all duration-300"
      :class="isSidebarOpen ? 'md:pl-[280px]' : 'md:pl-0'"
    >
      <!-- Dashboard Top Header -->
      <header class="h-16 border-b border-border bg-surface sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-4">
          <button
            type="button"
            @click="isSidebarOpen = !isSidebarOpen"
            class="p-2 rounded-md hover:bg-surface-hover text-text-muted transition-colors cursor-pointer"
          >
            <Menu class="w-5 h-5" />
          </button>

          <div>
            <h1 class="text-lg font-bold text-text leading-tight capitalize">
              {{ sectionTitles[activeSection]?.title || activeSection }}
            </h1>
            <p class="text-[0.7rem] text-text-muted font-medium uppercase tracking-wider">
              {{ sectionTitles[activeSection]?.subtitle || 'Dashboard' }}
            </p>
          </div>
        </div>
      </header>

      <!-- Scrollable Main Content -->
      <main class="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in overflow-y-auto custom-scrollbar">
        <!-- 1. OVERVIEW SECTION -->
        <div v-if="activeSection === 'overview'" class="space-y-8">
          <!-- Stat Cards Grid -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            <StatCard
              :icon="Users"
              :value="stats?.total_students ?? '—'"
              label="Students (Taty's Hub)"
              trend="↑ Active"
              :trend-up="true"
            />
            <StatCard
              :icon="MessageSquare"
              :value="stats?.total_messages ?? '—'"
              label="Messages Today"
            />
            <StatCard
              :icon="ShoppingBag"
              :value="stats?.total_buyers ?? '—'"
              label="Buyers (Taty's Materials)"
              trend="Materials clients"
              :trend-up="true"
            />
            <StatCard
              :icon="Zap"
              :value="stats?.active_today ?? '—'"
              label="Active Today"
              :highlight="true"
              trend="Today"
              :trend-up="true"
            />
          </div>

          <!-- Product Banner Dividers -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <Users class="w-4 h-4 text-primary shrink-0" />
              <span class="text-xs font-semibold text-primary">
                Taty's Hub — English learning app (role: student / staff)
              </span>
            </div>
            <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-success/5 border border-success/15">
              <ShoppingBag class="w-4 h-4 text-success shrink-0" />
              <span class="text-xs font-semibold text-success">
                Taty's Materials — Material store (role: buyer)
              </span>
            </div>
          </div>

          <!-- Recent Students Table -->
          <div class="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
            <div class="p-5 border-b border-border flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Users class="w-4 h-4 text-primary" />
                <h3 class="font-bold text-text text-sm">Recent Students</h3>
                <span class="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                  Taty's Hub
                </span>
              </div>
              <button
                type="button"
                @click="handleSetSection('students')"
                class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                See all <ChevronRight class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead class="bg-bg-secondary/50 text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                  <tr>
                    <th class="px-5 py-3">Student</th>
                    <th class="px-5 py-3">Level</th>
                    <th class="px-5 py-3">Last active</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="s in students.slice(0, 5)"
                    :key="s.username"
                    @click="handleOpenStudent(s)"
                    class="hover:bg-bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.7rem] font-bold text-primary shrink-0 overflow-hidden">
                          <img
                            v-if="s.avatar_url && s.avatar_url !== DEFAULT_AVATAR_URL"
                            :src="s.avatar_url"
                            :alt="s.name || s.username"
                            class="w-full h-full rounded-full object-cover"
                            @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
                          />
                          <span v-else>{{ (s.name || s.username || '?').charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="text-sm font-semibold truncate text-text">{{ s.name || s.username }}</span>
                            <span
                              v-if="s.role === 'lead'"
                              class="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[0.55rem] font-bold"
                            >
                              Lead
                            </span>
                          </div>
                          <div class="text-[0.65rem] text-text-muted truncate">@{{ s.username }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-5 py-3">
                      <span class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-subtle">
                        {{ s.level || '—' }}
                      </span>
                    </td>
                    <td class="px-5 py-3 text-text-muted">
                      <span
                        v-if="isUserActiveNow(s.last_active, currentNow)"
                        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.7rem] font-bold bg-success/15 text-success border border-success/30"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        Using now
                      </span>
                      <span v-else>
                        {{ s.last_active ? formatLastActive(s.last_active, currentNow) : '—' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 2. STUDENTS SECTION -->
        <div v-else-if="activeSection === 'students'" class="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs space-y-0">
          <div class="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 class="font-bold text-text text-base">All Students ({{ filteredStudents.length }})</h3>
            <div class="relative max-w-md w-full">
              <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search student by name, username or email..."
                class="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-text"
              />
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-bg-secondary/50 text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                <tr>
                  <th class="px-5 py-3">Student</th>
                  <th class="px-5 py-3">Level</th>
                  <th class="px-5 py-3">Focus</th>
                  <th class="px-5 py-3">Last active</th>
                  <th class="px-5 py-3">Msgs</th>
                  <th class="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr
                  v-for="s in filteredStudents"
                  :key="s.username"
                  @click="handleOpenStudent(s)"
                  class="hover:bg-bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.7rem] font-bold text-primary shrink-0 overflow-hidden">
                        <img
                          v-if="s.avatar_url && s.avatar_url !== DEFAULT_AVATAR_URL"
                          :src="s.avatar_url"
                          :alt="s.name || s.username"
                          class="w-full h-full rounded-full object-cover"
                          @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
                        />
                        <span v-else>{{ (s.name || s.username || '?').charAt(0).toUpperCase() }}</span>
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="text-sm font-semibold truncate text-text">{{ s.name || s.username }}</span>
                          <span
                            v-if="s.role === 'lead'"
                            class="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[0.55rem] font-bold"
                          >
                            Lead
                          </span>
                        </div>
                        <div class="text-[0.65rem] text-text-muted truncate">@{{ s.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    <span class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-subtle">
                      {{ s.level || '—' }}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-text-muted">
                    {{ s.focus || 'General Conversation' }}
                  </td>
                  <td class="px-5 py-3 text-text-muted">
                    <span
                      v-if="isUserActiveNow(s.last_active, currentNow)"
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.7rem] font-bold bg-success/15 text-success border border-success/30"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Using now
                    </span>
                    <span v-else>
                      {{ s.last_active ? formatLastActive(s.last_active, currentNow) : '—' }}
                    </span>
                  </td>
                  <td class="px-5 py-3 font-semibold text-text">
                    {{ s.messages_count || s.total_messages || s.msgs || 0 }}
                  </td>
                  <td class="px-5 py-3 text-text-muted">
                    {{ s.joined || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. REPORTS SECTION -->
        <ReportsSection v-else-if="activeSection === 'reports'" />

        <!-- 4. FLASHCARDS SECTION -->
        <FlashcardsSection v-else-if="activeSection === 'flashcards'" />

        <!-- 5. SIMULATIONS SECTION -->
        <SimulationsSection v-else-if="activeSection === 'simulations'" />

        <!-- 6. GAMES SECTION -->
        <GamesSection v-else-if="activeSection === 'games'" />

        <!-- 7. NEWS SECTION -->
        <NewsSection v-else-if="activeSection === 'news'" />

        <!-- 8. CEFR MATERIALS SECTION -->
        <CefrSection v-else-if="activeSection === 'cefr'" />

        <!-- 8.5 EXAMS VERIFICATION & STUDENT ANSWERS SECTION -->
        <ExamSection v-else-if="activeSection === 'exams'" />

        <!-- 9. PREMIUM MATERIALS SECTION -->
        <PremiumSection v-else-if="activeSection === 'premium'" />

        <!-- 10. FEEDBACKS SECTION -->
        <FeedbacksSection v-else-if="activeSection === 'feedbacks'" />

        <!-- 11. WHATSAPP CONFIG SECTION -->
        <WhatsappSection v-else-if="activeSection === 'whatsapp'" />
      </main>
    </div>

    <!-- Student Details Modal -->
    <StudentModal
      :is-open="isStudentModalOpen"
      :student="selectedStudent"
      @close="isStudentModalOpen = false"
      @update="loadDashboardData"
    />
  </div>
</template>

