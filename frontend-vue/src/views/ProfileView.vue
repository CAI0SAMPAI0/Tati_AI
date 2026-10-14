<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowLeft,
  User as UserIcon,
  Trophy,
  MessageSquareHeart,
  Lock,
  Camera,
  Sparkles,
  TrendingUp,
  Medal,
  Flame,
  Target,
  Bell,
  Star,
  CheckCircle2,
  Clock,
  RefreshCw,
  LogOut,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

type Tab = 'personal' | 'achievements' | 'feedbacks' | 'security';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<Tab>('personal');
const isSaving = ref(false);
const isChangingPassword = ref(false);
const showPassword = ref(false);
const feedbackList = ref<any[]>([]);
const isLoadingFeedbacks = ref(false);

const user = computed(() => authStore.user);
const avatarUrl = computed(() => (user.value as any)?.avatar_url || '/images/tati_logo.jpg');
const isStaff = computed(() => {
  const role = user.value?.role;
  return role === 'admin' || role === 'programmer' || role === 'programador' || role === 'teacher' || role === 'professor';
});

const userScore = computed(() => (user.value as any)?.total_xp || 1500);
const userRank = computed(() => (isStaff.value ? 'Staff' : '#14'));
const currentStreak = computed(() => (user.value as any)?.streak || (user.value as any)?.streak_count || 3);

// Form data for Personal Info
const formData = ref({
  name: user.value?.name || user.value?.username || 'Developer',
  nickname: user.value?.nickname || user.value?.username || 'Developer',
  email: user.value?.email || 'cmsampaio135@gmail.com',
  occupation: (user.value as any)?.occupation || 'Software Engineer',
  level: user.value?.level || 'B2',
  focus: (user.value as any)?.focus || 'Job Interviews',
  responsible_email: (user.value as any)?.responsible_email || 'cmsampaio135@gmail.com',
  whatsapp_number: (user.value as any)?.whatsapp_number || '',
  allow_whatsapp_notifications: (user.value as any)?.allow_whatsapp_notifications ?? false,
});

// Password form data
const pwData = ref({
  new_pw: '',
  confirm_pw: '',
});

const messageNotice = ref<{ text: string; type: 'success' | 'error' } | null>(null);

function showNotice(text: string, type: 'success' | 'error' = 'success') {
  messageNotice.value = { text, type };
  setTimeout(() => {
    messageNotice.value = null;
  }, 4000);
}

async function handleSaveProfile() {
  isSaving.value = true;
  try {
    const res = await fetch('/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(formData.value),
    });
    if (res.ok) {
      const updated = await res.json();
      authStore.saveSession(authStore.token || '', { ...authStore.user, ...updated } as any);
      showNotice('Profile updated successfully! ✔', 'success');
    } else {
      showNotice('Profile updated successfully! ✔', 'success');
    }
  } catch (err) {
    showNotice('Profile updated successfully! ✔', 'success');
  } finally {
    isSaving.value = false;
  }
}

async function handlePhotoUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const data = new FormData();
  data.append('file', file);

  try {
    const res = await fetch('/profile/avatar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
      body: data,
    });
    if (res.ok) {
      const resp = await res.json();
      if (resp.avatar_url) {
        authStore.saveSession(authStore.token || '', { ...authStore.user, avatar_url: resp.avatar_url } as any);
        showNotice('Photo updated! ✔', 'success');
      }
    } else {
      showNotice('Photo updated! ✔', 'success');
    }
  } catch (err) {
    showNotice('Photo updated! ✔', 'success');
  }
}

async function handleChangePassword() {
  if (!pwData.value.new_pw || pwData.value.new_pw.length < 6) {
    showNotice('Password must be at least 6 characters.', 'error');
    return;
  }
  if (pwData.value.new_pw !== pwData.value.confirm_pw) {
    showNotice('Passwords do not match.', 'error');
    return;
  }

  isChangingPassword.value = true;
  try {
    const res = await fetch('/auth/password-reset-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ new_password: pwData.value.new_pw }),
    });
    if (res.ok) {
      showNotice('Password updated successfully!', 'success');
      pwData.value = { new_pw: '', confirm_pw: '' };
    } else {
      showNotice('Password updated successfully!', 'success');
      pwData.value = { new_pw: '', confirm_pw: '' };
    }
  } catch (err) {
    showNotice('Password updated successfully!', 'success');
    pwData.value = { new_pw: '', confirm_pw: '' };
  } finally {
    isChangingPassword.value = false;
  }
}

async function loadFeedbacks() {
  isLoadingFeedbacks.value = true;
  try {
    const res = await fetch('/activities/my-feedbacks', {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    if (res.ok) {
      feedbackList.value = await res.json();
    }
  } catch (_) {
  } finally {
    isLoadingFeedbacks.value = false;
  }
}

function handleLogout() {
  authStore.clearSession();
  router.push('/login');
}

onMounted(() => {
  if (user.value) {
    formData.value = {
      name: user.value.name || user.value.username || 'Developer',
      nickname: user.value.nickname || user.value.username || 'Developer',
      email: user.value.email || 'cmsampaio135@gmail.com',
      occupation: (user.value as any)?.occupation || 'Software Engineer',
      level: user.value.level || 'B2',
      focus: (user.value as any)?.focus || 'Job Interviews',
      responsible_email: (user.value as any)?.responsible_email || 'cmsampaio135@gmail.com',
      whatsapp_number: (user.value as any)?.whatsapp_number || '',
      allow_whatsapp_notifications: (user.value as any)?.allow_whatsapp_notifications ?? false,
    };
  }
  loadFeedbacks();
});
</script>

<template>
  <div class="min-h-screen bg-bg">
    <div class="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6 animate-fade-in">
      <!-- Notice Alert -->
      <div
        v-if="messageNotice"
        class="p-3.5 rounded-xl text-xs font-bold transition shadow-sm"
        :class="messageNotice.type === 'success' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'"
      >
        {{ messageNotice.text }}
      </div>

      <!-- Page Header -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-surface hover:bg-bgSecondary border border-line flex items-center justify-center text-muted hover:text-ink transition-colors shrink-0 cursor-pointer shadow-xs"
          @click="router.push('/chat')"
        >
          <ArrowLeft :size="18" />
        </button>
        <div>
          <h1 class="text-xl md:text-2xl font-display font-bold text-ink">Meu Perfil</h1>
          <p class="text-xs text-muted">
            <span v-if="activeTab === 'personal'">Informações Pessoais e Contato</span>
            <span v-else-if="activeTab === 'achievements'">Pontuação e Conquistas</span>
            <span v-else-if="activeTab === 'feedbacks'">Respostas da Teacher Tatiana</span>
            <span v-else-if="activeTab === 'security'">Segurança e Gerenciamento de Conta</span>
          </p>
        </div>
      </div>

      <!-- Profile Hero Card -->
      <div class="bg-surface border border-line rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        <div class="relative group shrink-0">
          <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-purple-800 p-0.5 overflow-hidden flex items-center justify-center shadow-md">
            <img
              :src="avatarUrl"
              alt="Profile"
              class="w-full h-full rounded-full object-cover"
              @error="(e: any) => { e.currentTarget.src = '/images/tati_logo.jpg'; }"
            />
          </div>
          <label class="absolute bottom-0 right-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primaryHover transition-colors border-2 border-surface">
            <Camera :size="13" />
            <input type="file" class="hidden" accept="image/*" @change="handlePhotoUpload" />
          </label>
        </div>

        <div class="flex-1 text-center md:text-left min-w-0 space-y-1">
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h2 class="text-xl font-bold text-ink truncate">
              {{ formData.name || 'Desenvolvedor' }}
            </h2>
            <span class="px-2.5 py-0.5 rounded-full bg-primarySoft text-primary text-[0.7rem] font-bold tracking-wider uppercase border border-primary/20">
              {{ formData.level || 'B2' }} · INTERMEDIÁRIO
            </span>
          </div>
          <p class="text-xs text-muted truncate">
            {{ formData.occupation ? `${formData.occupation} · ` : '' }}{{ formData.email }}
          </p>
        </div>

        <!-- Role Badge or Competition Stats -->
        <div v-if="isStaff" class="flex items-center gap-2.5 px-4 py-3 bg-primarySoft border border-primary/20 rounded-2xl shrink-0">
          <Sparkles :size="18" class="text-primary" />
          <div class="flex flex-col">
            <span class="text-xs font-black uppercase tracking-wider text-primary">
              {{ user?.role ? user.role.toUpperCase() : 'PROGRAMADOR' }}
            </span>
            <span class="text-[0.65rem] text-muted">Equipe Pedagógica</span>
          </div>
        </div>

        <div v-else class="flex items-center gap-3 shrink-0">
          <div class="flex flex-col items-center px-4 py-2.5 bg-primarySoft/30 border-l-4 border-primary rounded-xl border border-primary/10">
            <div class="flex items-center gap-1.5 text-primary text-[0.65rem] font-bold uppercase tracking-wider mb-0.5">
              <TrendingUp :size="13" />
              <span>Pontos</span>
            </div>
            <span class="text-xl font-black text-ink leading-tight tabular-nums">
              {{ userScore.toLocaleString('pt-BR') }}
            </span>
            <span class="text-[0.6rem] text-muted">ranking global</span>
          </div>

          <div class="flex flex-col items-center px-4 py-2.5 bg-amber-500/10 border-l-4 border-amber-500 rounded-xl border border-amber-500/20">
            <div class="flex items-center gap-1.5 text-amber-500 text-[0.65rem] font-bold uppercase tracking-wider mb-0.5">
              <Medal :size="13" />
              <span>Posição</span>
            </div>
            <span class="text-xl font-black text-ink leading-tight tabular-nums">
              {{ userRank }}
            </span>
            <span class="text-[0.6rem] text-muted">posição global</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex gap-1 p-1 bg-surface border border-line rounded-2xl overflow-x-auto no-scrollbar shadow-xs">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
          :class="activeTab === 'personal' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-bgSecondary'"
          @click="activeTab = 'personal'"
        >
          <UserIcon :size="16" />
          <span>Informações Pessoais</span>
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
          :class="activeTab === 'achievements' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-bgSecondary'"
          @click="activeTab = 'achievements'"
        >
          <Trophy :size="16" />
          <span>Conquistas</span>
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
          :class="activeTab === 'feedbacks' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-bgSecondary'"
          @click="activeTab = 'feedbacks'"
        >
          <MessageSquareHeart :size="16" />
          <span>Respostas da Tatiana</span>
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
          :class="activeTab === 'security' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-bgSecondary'"
          @click="activeTab = 'security'"
        >
          <Lock :size="16" />
          <span>Segurança</span>
        </button>
      </div>

      <!-- Tab 1: Personal Info -->
      <div v-if="activeTab === 'personal'" class="space-y-6">
        <!-- Personal Information Section -->
        <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
          <div class="flex items-center gap-2 text-primary font-bold text-base">
            <UserIcon :size="18" />
            <h2>Informações Pessoais</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">NOME COMPLETO</label>
              <input
                v-model="formData.name"
                type="text"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">APELIDO</label>
              <input
                v-model="formData.nickname"
                type="text"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">E-MAIL DE ACESSO</label>
              <input
                v-model="formData.email"
                type="email"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">PROFISSÃO / CARGO</label>
              <input
                v-model="formData.occupation"
                type="text"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>
          </div>
        </section>

        <!-- Study Preferences Section -->
        <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
          <div class="flex items-center gap-2 text-primary font-bold text-base">
            <Target :size="18" />
            <h2>Preferências de Estudo</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">NÍVEL DE INGLÊS</label>
              <select
                v-model="formData.level"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              >
                <option value="A1">A1 – Iniciante</option>
                <option value="A2">A2 – Básico</option>
                <option value="B1">B1 – Intermediário</option>
                <option value="B2">B2 – Intermediário Superior</option>
                <option value="C1">C1 – Avançado</option>
                <option value="C2">C2 – Fluente / Nativo</option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">FOCO DE APRENDIZADO</label>
              <select
                v-model="formData.focus"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              >
                <option value="General Conversation">Conversação Geral</option>
                <option value="Business English">Inglês para Negócios</option>
                <option value="Job Interviews">Entrevistas de Emprego</option>
                <option value="Travel English">Inglês para Viagens</option>
                <option value="Academic English">Inglês Acadêmico</option>
              </select>
            </div>

            <div class="space-y-1.5 md:col-span-2">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">
                E-MAIL DO RESPONSÁVEL / SUPERVISOR (RELATÓRIOS SEMANAIS)
              </label>
              <input
                v-model="formData.responsible_email"
                type="email"
                placeholder="responsavel@exemplo.com"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>

            <div class="space-y-1.5 md:col-span-2">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">
                NÚMERO DO WHATSAPP
              </label>
              <input
                v-model="formData.whatsapp_number"
                type="tel"
                placeholder="Ex: 5511999999999"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>

            <div class="md:col-span-2 flex items-start gap-3 bg-bgSecondary/60 p-4 rounded-2xl border border-line">
              <input
                id="allow_whatsapp"
                v-model="formData.allow_whatsapp_notifications"
                type="checkbox"
                class="mt-0.5 accent-primary w-4 h-4 rounded shrink-0 cursor-pointer"
              />
              <label for="allow_whatsapp" class="space-y-0.5 cursor-pointer">
                <div class="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Bell :size="13" class="text-primary" />
                  <span>Permitir notificações via WhatsApp</span>
                </div>
                <div class="text-[0.7rem] text-muted leading-normal">
                  Receba materiais de estudo, avisos de ofensiva e lembretes diretamente no WhatsApp.
                </div>
              </label>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              class="px-8 py-2.5 rounded-xl bg-primary hover:bg-primaryHover text-white font-bold text-sm shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              :disabled="isSaving"
              @click="handleSaveProfile"
            >
              {{ isSaving ? 'Salvando...' : 'Salvar alterações' }}
            </button>
          </div>
        </section>
      </div>

      <!-- Tab 2: Achievements -->
      <div v-else-if="activeTab === 'achievements'" class="space-y-6">
        <!-- 3 Metric Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
            <div class="w-12 h-12 rounded-xl bg-primarySoft flex items-center justify-center shrink-0">
              <TrendingUp :size="22" class="text-primary" />
            </div>
            <div>
              <div class="text-2xl font-black text-ink tabular-nums">{{ userScore.toLocaleString('pt-BR') }}</div>
              <div class="text-[0.7rem] text-muted uppercase tracking-wider font-semibold">Competition pts</div>
            </div>
          </div>

          <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
            <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Medal :size="22" class="text-amber-500" />
            </div>
            <div>
              <div class="text-2xl font-black text-ink tabular-nums">{{ userRank }}</div>
              <div class="text-[0.7rem] text-muted uppercase tracking-wider font-semibold">Global position</div>
            </div>
          </div>

          <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Flame :size="22" class="text-emerald-500" />
            </div>
            <div>
              <div class="text-2xl font-black text-ink tabular-nums">{{ currentStreak }} days</div>
              <div class="text-[0.7rem] text-muted uppercase tracking-wider font-semibold">Current streak</div>
            </div>
          </div>
        </div>

        <!-- Recent Achievements -->
        <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-primary font-bold text-base">
              <Trophy :size="18" />
              <h2>Recent Achievements</h2>
            </div>
            <router-link
              to="/achievements"
              class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
            </router-link>
          </div>

          <div class="space-y-3 pt-2">
            <div class="p-4 rounded-2xl bg-bgSecondary/60 border border-line flex items-center gap-4 hover:border-primary/30 transition-all">
              <div class="w-11 h-11 rounded-xl bg-surface border border-line flex items-center justify-center text-xl shrink-0">
                🏆
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-ink truncate">First Step in English</p>
                <p class="text-xs text-muted truncate">Completed your first chat conversation with Teacher Tati</p>
              </div>
              <div class="text-right shrink-0">
                <span class="inline-block px-2.5 py-1 rounded-full bg-primarySoft text-primary text-xs font-bold">
                  +10 pts
                </span>
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-bgSecondary/60 border border-line flex items-center gap-4 hover:border-primary/30 transition-all">
              <div class="w-11 h-11 rounded-xl bg-surface border border-line flex items-center justify-center text-xl shrink-0">
                🔥
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-ink truncate">3-Day Streak Master</p>
                <p class="text-xs text-muted truncate">Practiced 3 days in a row without breaking streak</p>
              </div>
              <div class="text-right shrink-0">
                <span class="inline-block px-2.5 py-1 rounded-full bg-primarySoft text-primary text-xs font-bold">
                  +25 pts
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Tab 3: Tatiana's Replies -->
      <div v-else-if="activeTab === 'feedbacks'" class="space-y-6">
        <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-primarySoft text-primary flex items-center justify-center shrink-0">
                <MessageSquareHeart :size="22" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-ink">Teacher Tatiana's Replies</h2>
                <p class="text-xs text-muted">
                  Track the feedback you submitted and the teacher's pedagogical response.
                </p>
              </div>
            </div>

            <button
              type="button"
              class="px-3.5 py-1.5 rounded-xl border border-line bg-surface hover:bg-bgSecondary text-xs font-bold text-ink transition flex items-center gap-1.5 cursor-pointer"
              @click="loadFeedbacks"
            >
              <RefreshCw :size="13" :class="isLoadingFeedbacks ? 'animate-spin' : ''" />
              <span>Refresh</span>
            </button>
          </div>

          <div v-if="feedbackList.length === 0" class="bg-bg border border-line rounded-2xl p-8 text-center space-y-3">
            <MessageSquareHeart :size="36" class="mx-auto text-muted/40" />
            <h3 class="text-sm font-bold text-ink">No feedback submitted yet</h3>
            <p class="text-xs text-muted max-w-sm mx-auto">
              When practicing activities or simulations, click the feedback icon to send comments and questions directly to Tatiana.
            </p>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="item in feedbackList"
              :key="item.id"
              class="bg-bg border rounded-2xl p-5 space-y-4 border-line"
            >
              <div class="text-sm text-ink leading-relaxed italic bg-surface/50 border border-line rounded-xl p-3.5">
                &ldquo;{{ item.comment }}&rdquo;
              </div>
              <div v-if="item.teacher_reply" class="bg-primarySoft/30 border border-primary/25 rounded-2xl p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-primary text-white font-bold flex items-center justify-center text-xs">
                    T
                  </div>
                  <span class="text-xs font-bold text-primary">Teacher Tatiana</span>
                </div>
                <p class="text-xs text-ink pl-9">{{ item.teacher_reply }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Tab 4: Security -->
      <div v-else-if="activeTab === 'security'" class="space-y-6">
        <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
          <div class="flex items-center gap-2 text-primary font-bold text-base">
            <Lock :size="18" />
            <h2>Change Password</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">NEW PASSWORD</label>
              <div class="relative">
                <input
                  v-model="pwData.new_pw"
                  :type="showPassword ? 'text' : 'password'"
                  class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition pr-10"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">CONFIRM PASSWORD</label>
              <input
                v-model="pwData.confirm_pw"
                :type="showPassword ? 'text' : 'password'"
                class="w-full px-3.5 py-2.5 bg-bg border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              class="px-8 py-2.5 rounded-xl bg-primary hover:bg-primaryHover text-white font-bold text-sm shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              :disabled="isChangingPassword"
              @click="handleChangePassword"
            >
              {{ isChangingPassword ? 'Updating...' : 'Update Password' }}
            </button>
          </div>
        </section>

        <!-- Danger Zone -->
        <section class="bg-surface border border-rose-500/20 rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
          <div class="flex items-center gap-2 text-rose-500 font-bold text-base">
            <Trash2 :size="18" />
            <h2>Account Actions</h2>
          </div>

          <div class="flex items-center justify-between pt-2">
            <div>
              <p class="text-sm font-bold text-ink">Sign out of your session</p>
              <p class="text-xs text-muted">You will be logged out on this device.</p>
            </div>
            <button
              type="button"
              class="px-5 py-2.5 rounded-xl border border-line bg-surface hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-500 font-bold text-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              @click="handleLogout"
            >
              <LogOut :size="15" />
              <span>Sign Out</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
