<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  ArrowLeft,
  User as UserIcon,
  Trophy,
  MessageSquareHeart,
  Lock,
  Camera,
  TrendingUp,
  Medal,
  Sparkles,
  Flame,
  Award,
  Target,
  CheckCircle2,
  Clock,
  RefreshCw,
  Star,
  Trash2,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Bell,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { apiGet, apiPut, apiPost, apiDelete, apiUpload } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { LEVEL_OPTIONS, normalizeLevel } from '@/constants/levels';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';

type Tab = 'personal' | 'achievements' | 'feedbacks' | 'security';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'personal', label: 'Personal Info', icon: UserIcon },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'feedbacks', label: "Tatiana's Replies", icon: MessageSquareHeart },
  { id: 'security', label: 'Security', icon: Lock },
];

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { user, logout, updateUserData } = useAuth();

const tab = ref<Tab>('personal');

// Check URL query for tab param
onMounted(() => {
  const qTab = route.query.tab as string;
  if (qTab && ['personal', 'achievements', 'feedbacks', 'security'].includes(qTab)) {
    tab.value = qTab as Tab;
  }
});

// Form Data for Personal Tab
const formData = ref({
  name: user.value?.name || '',
  nickname: (user.value as any)?.nickname || '',
  email: user.value?.email || '',
  occupation: (user.value as any)?.occupation || '',
  level: normalizeLevel(user.value?.level),
  focus: (user.value as any)?.focus || 'General Conversation',
  responsible_email: (user.value as any)?.profile?.responsible_email || '',
  whatsapp_number: (user.value as any)?.profile?.whatsapp_number || (user.value as any)?.phone || '',
  allow_whatsapp_notifications: (user.value as any)?.profile?.allow_whatsapp_notifications ?? true,
});

const isSaving = ref(false);
const autoSaveTimer = ref<any>(null);

// Password Data
const pwData = ref({
  new_pw: '',
  confirm_pw: '',
});

// Delete Account Modal
const isDeleteModalOpen = ref(false);
const deleteConfirmInput = ref('');
const isDeleting = ref(false);

// Ranking & Score Data
const positionData = ref<{ position: number; score: number; total_students: number; is_staff?: boolean } | null>(null);
const streakData = ref<{ current_streak: number; longest_streak: number } | null>(null);
const achievements = ref<any[]>([]);

// Feedbacks Data
const myFeedbacks = ref<any[]>([]);
const loadingFeedbacks = ref(false);

const isStaff = computed(() => {
  return Boolean(
    positionData.value?.is_staff ||
    user.value?.role === 'admin' ||
    user.value?.role === 'programmer' ||
    user.value?.role === 'programador' ||
    user.value?.role === 'teacher' ||
    user.value?.role === 'professor'
  );
});

const userScore = computed(() => {
  if (positionData.value?.score && positionData.value.score > 0) {
    return positionData.value.score;
  }
  return (user.value as any)?.total_xp || (user.value as any)?.xp || 0;
});

const userRank = computed(() => {
  if (isStaff.value) return 'Staff';
  if (positionData.value?.position && positionData.value.position > 0) {
    return `#${positionData.value.position}`;
  }
  return '#-';
});

const currentStreak = computed(() => {
  return streakData.value?.current_streak ?? user.value?.streak ?? 0;
});

const avatarUrl = computed(() => {
  const raw = user.value?.avatar_url || (user.value as any)?.profile?.avatar_url;
  if (!raw || (raw.includes('/avatar/avatar_tati') && (user.value as any)?.role !== 'teacher')) {
    return DEFAULT_AVATAR_URL;
  }
  return raw;
});

const recentAchievements = computed(() => {
  return (achievements.value || [])
    .filter((a: any) => a.is_unlocked || a.unlocked)
    .slice(0, 5);
});

async function fetchStats() {
  try {
    const pos = await apiGet<any>('/users/progress/ranking/position');
    positionData.value = pos;
  } catch (_) {}

  try {
    const stk = await apiGet<any>(ENDPOINTS.STREAK);
    streakData.value = stk;
  } catch (_) {}

  try {
    const achs = await apiGet<any[]>('/activities/achievements/my');
    achievements.value = Array.isArray(achs) ? achs : [];
  } catch (_) {}
}

async function fetchNotificationPrefs() {
  try {
    const data = await apiGet<any>('/users/notification-preferences');
    if (data) {
      if (data.whatsapp_number) {
        formData.value.whatsapp_number = data.whatsapp_number;
      }
      if (typeof data.allow_whatsapp_notifications === 'boolean') {
        formData.value.allow_whatsapp_notifications = data.allow_whatsapp_notifications;
      }
    }
  } catch (_) {}
}

async function fetchFeedbacks() {
  loadingFeedbacks.value = true;
  try {
    const res = await apiGet<any[]>('/activities/my-feedbacks');
    myFeedbacks.value = Array.isArray(res) ? res : [];
  } catch (_) {
    myFeedbacks.value = [];
  } finally {
    loadingFeedbacks.value = false;
  }
}

watch(tab, (newTab) => {
  if (newTab === 'feedbacks' && myFeedbacks.value.length === 0) {
    fetchFeedbacks();
  }
});

async function fetchUserProfile() {
  try {
    const fresh = await apiGet<any>(ENDPOINTS.PROFILE);
    if (fresh) {
      updateUserData(fresh);
    }
  } catch (_) {}
}

onMounted(() => {
  fetchUserProfile();
  fetchStats();
  fetchNotificationPrefs();
  if (tab.value === 'feedbacks') {
    fetchFeedbacks();
  }
});

// Sync user into formData when user updates
watch(
  user,
  (u) => {
    if (u) {
      const savedPhone = (u?.profile as any)?.whatsapp_number || (u as any)?.phone || '';
      formData.value = {
        ...formData.value,
        name: u.name || formData.value.name,
        nickname: (u as any).nickname || formData.value.nickname,
        email: u.email || formData.value.email,
        occupation: (u as any).occupation || formData.value.occupation,
        level: normalizeLevel(u.level || formData.value.level),
        focus: (u as any).focus || formData.value.focus,
        responsible_email: (u?.profile as any)?.responsible_email || formData.value.responsible_email,
        whatsapp_number: savedPhone || formData.value.whatsapp_number,
        allow_whatsapp_notifications:
          (u?.profile as any)?.allow_whatsapp_notifications ??
          formData.value.allow_whatsapp_notifications ??
          true,
      };
    }
  },
  { immediate: true }
);

async function autoSaveProfile(dataToSave: typeof formData.value) {
  try {
    const payload: Record<string, any> = {
      name: dataToSave.name,
      nickname: dataToSave.nickname,
      email: dataToSave.email,
      occupation: dataToSave.occupation,
      level: dataToSave.level,
      focus: dataToSave.focus,
      responsible_email: dataToSave.responsible_email,
      allow_whatsapp_notifications: dataToSave.allow_whatsapp_notifications,
    };

    if (dataToSave.whatsapp_number) {
      const clean = dataToSave.whatsapp_number.replace(/\D/g, '');
      const formatted =
        (clean.length === 10 || clean.length === 11) && !clean.startsWith('55')
          ? `55${clean}`
          : clean;
      payload.whatsapp_number = formatted || '';
    }

    const res = await apiPut<any>('/profile/', payload);
    if (res) {
      updateUserData({
        ...res,
        level: dataToSave.level,
        profile: {
          ...(user.value?.profile || {}),
          whatsapp_number: payload.whatsapp_number,
          allow_whatsapp_notifications: dataToSave.allow_whatsapp_notifications,
        },
      });

      if (dataToSave.whatsapp_number !== undefined) {
        const clean = (dataToSave.whatsapp_number || '').replace(/\D/g, '');
        const formatted =
          (clean.length === 10 || clean.length === 11) && !clean.startsWith('55')
            ? `55${clean}`
            : clean;
        apiPut('/users/notification-preferences', {
          whatsapp_number: formatted || null,
          allow_whatsapp_notifications: dataToSave.allow_whatsapp_notifications,
          whatsapp_enabled: dataToSave.allow_whatsapp_notifications,
        }).catch(() => {});
      }

      toast.success('Alterações salvas! ✔');
    }
  } catch (e) {
    console.error('Failed to auto-save profile:', e);
  }
}

function handleFieldChange(field: keyof typeof formData.value, val: any) {
  formData.value = { ...formData.value, [field]: val };
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  autoSaveTimer.value = setTimeout(() => {
    autoSaveProfile(formData.value);
  }, 1000);
}

function handleFieldBlur() {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  autoSaveProfile(formData.value);
}

async function handleManualSave() {
  isSaving.value = true;
  try {
    await autoSaveProfile(formData.value);
    toast.success('Profile updated successfully!');
  } finally {
    isSaving.value = false;
  }
}

async function handlePhotoUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return toast.error('File too large (max 5MB)');
  }

  const uploadFormData = new FormData();
  uploadFormData.append('file', file);

  try {
    const result = await apiUpload<{ ok: boolean; avatar_url: string }>('/profile/avatar', uploadFormData);
    if (result && result.avatar_url) {
      updateUserData({ avatar_url: result.avatar_url });
      toast.success('Photo updated! ✔');
    } else {
      toast.error('Error uploading photo');
    }
  } catch (err: any) {
    console.error('Upload error:', err);
    toast.error(err?.message || 'Connection error');
  }
}

async function handleChangePassword() {
  if (!pwData.value.new_pw || pwData.value.new_pw.length < 6) {
    return toast.error('Password must be at least 6 characters.');
  }
  if (pwData.value.new_pw !== pwData.value.confirm_pw) {
    return toast.error('Passwords do not match.');
  }
  try {
    await apiPost<{ detail?: string }>('/auth/password-reset-profile', {
      new_password: pwData.value.new_pw,
    });
    toast.success('Password updated successfully!');
    pwData.value = { new_pw: '', confirm_pw: '' };
  } catch (err: any) {
    toast.error(err?.message || 'Error saving password.');
  }
}

function handleSignOut() {
  logout();
  router.replace('/login');
}

async function handleDeleteAccount() {
  isDeleting.value = true;
  try {
    await apiDelete('/profile/');
    toast.success('Your account has been deleted.');
    isDeleteModalOpen.value = false;
    handleSignOut();
  } catch (e) {
    toast.error('Could not delete account. Please try again.');
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <div class="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6 animate-fade-in">
      <!-- Top header with back button -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="router.push('/chat')"
          class="w-10 h-10 rounded-xl bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors shrink-0 cursor-pointer"
          aria-label="Back to chat"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <h1 class="text-xl md:text-2xl font-display font-bold text-text">My Profile</h1>
          <p class="text-xs text-text-muted">
            <span v-if="tab === 'personal'">Personal Information</span>
            <span v-else-if="tab === 'achievements'">Competition Score & Achievements</span>
            <span v-else-if="tab === 'feedbacks'">Teacher Tatiana's Replies</span>
            <span v-else-if="tab === 'security'">Security & Account Management</span>
          </p>
        </div>
      </div>

      <!-- Profile Hero Card -->
      <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xs">
        <div class="relative group shrink-0">
          <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-accent p-0.5 overflow-hidden flex items-center justify-center shadow-md">
            <img
              :src="avatarUrl"
              alt="Profile avatar"
              class="w-full h-full rounded-full object-cover"
            />
          </div>
          <label class="absolute bottom-0 right-0 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-primary-hover transition-colors border-2 border-surface">
            <Camera class="w-3.5 h-3.5" />
            <input type="file" class="hidden" accept="image/*" @change="handlePhotoUpload" />
          </label>
        </div>

        <div class="flex-1 text-center md:text-left min-w-0 space-y-1">
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h2 class="text-xl font-bold text-text truncate">
              {{ user?.name || (user as any)?.nickname || user?.username || 'Student' }}
            </h2>
            <span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[0.7rem] font-bold tracking-wider uppercase border border-primary/20">
              {{ formData.level || 'A1' }} · INTERMEDIATE
            </span>
          </div>
          <p class="text-xs text-text-muted truncate">
            {{ (user as any)?.occupation ? `${(user as any).occupation} · ` : '' }}{{ user?.email }}
          </p>
        </div>

        <!-- Competition Stats Badges or Staff Badge -->
        <div v-if="isStaff" class="flex items-center gap-2.5 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl shrink-0">
          <Sparkles class="w-4 h-4 text-primary" />
          <div class="flex flex-col">
            <span class="text-xs font-black uppercase tracking-wider text-primary">
              {{ user?.role ? user.role.toUpperCase() : 'STAFF' }}
            </span>
            <span class="text-[0.65rem] text-text-muted">Educational Team</span>
          </div>
        </div>

        <div v-else class="flex items-center gap-3 shrink-0">
          <div class="flex flex-col items-center px-4 py-2.5 bg-primary/5 border-l-4 border-primary rounded-xl border border-primary/10">
            <div class="flex items-center gap-1.5 text-primary text-[0.65rem] font-bold uppercase tracking-wider mb-0.5">
              <TrendingUp class="w-3 h-3" />
              <span>Score</span>
            </div>
            <span class="text-xl font-black text-text leading-tight tabular-nums">
              {{ userScore.toLocaleString('pt-BR') }}
            </span>
            <span class="text-[0.6rem] text-text-muted">competition pts</span>
          </div>

          <div class="flex flex-col items-center px-4 py-2.5 bg-orange-500/5 border-l-4 border-orange-500 rounded-xl border border-orange-500/10">
            <div class="flex items-center gap-1.5 text-orange-500 text-[0.65rem] font-bold uppercase tracking-wider mb-0.5">
              <Medal class="w-3 h-3" />
              <span>Rank</span>
            </div>
            <span class="text-xl font-black text-text leading-tight tabular-nums">
              {{ userRank }}
            </span>
            <span class="text-[0.6rem] text-text-muted">global position</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex gap-1 p-1 bg-surface border border-border rounded-2xl overflow-x-auto scrollbar-none">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          @click="tab = t.id"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
          :class="
            tab === t.id
              ? 'bg-primary text-white shadow-glow'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
          "
        >
          <component :is="t.icon" class="w-4 h-4" />
          <span>{{ t.label }}</span>
        </button>
      </div>

      <!-- TAB 1: PERSONAL INFO -->
      <div v-if="tab === 'personal'" class="space-y-6">
        <!-- Personal Information Section -->
        <section class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-primary font-bold text-base">
              <UserIcon class="w-4 h-4" />
              <h2>Personal Information</h2>
            </div>
            <span class="text-[0.65rem] font-medium text-primary">Automatically saves</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Full Name</label>
              <Input
                :model-value="formData.name"
                @update:model-value="(val) => handleFieldChange('name', val)"
                @blur="handleFieldBlur"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Nickname</label>
              <Input
                :model-value="formData.nickname"
                @update:model-value="(val) => handleFieldChange('nickname', val)"
                @blur="handleFieldBlur"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Email</label>
              <Input
                :model-value="formData.email"
                @update:model-value="(val) => handleFieldChange('email', val)"
                @blur="handleFieldBlur"
              />
            </div>
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Occupation</label>
              <Input
                :model-value="formData.occupation"
                @update:model-value="(val) => handleFieldChange('occupation', val)"
                @blur="handleFieldBlur"
              />
            </div>
          </div>
        </section>

        <!-- Study Preferences Section -->
        <section class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-primary font-bold text-base">
              <Target class="w-4 h-4" />
              <h2>Study Preferences</h2>
            </div>
            <span class="text-[0.65rem] font-medium text-primary">Automatically saves</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">English Level</label>
              <Select
                :model-value="formData.level"
                @update:model-value="(val) => handleFieldChange('level', normalizeLevel(val))"
                :options="LEVEL_OPTIONS"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Learning Focus</label>
              <Select
                :model-value="formData.focus"
                @update:model-value="(val) => handleFieldChange('focus', val)"
                :options="[
                  { value: 'General Conversation', label: 'General Conversation' },
                  { value: 'Business English', label: 'Business English' },
                  { value: 'Job Interviews', label: 'Job Interviews' },
                  { value: 'Travel English', label: 'Travel English' },
                  { value: 'Academic English', label: 'Academic English' },
                ]"
              />
            </div>

            <div class="space-y-1.5 md:col-span-2">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">
                Guardian / Supervisor Email (Weekly Reports)
              </label>
              <Input
                type="email"
                placeholder="guardian@example.com"
                :model-value="formData.responsible_email"
                @update:model-value="(val) => handleFieldChange('responsible_email', val)"
                @blur="handleFieldBlur"
              />
            </div>

            <div class="space-y-1.5 md:col-span-2">
              <div class="flex items-center justify-between">
                <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">
                  WhatsApp Number
                </label>
                <span class="text-[0.65rem] font-medium text-primary">Automatically saves</span>
              </div>
              <Input
                type="tel"
                placeholder="5511999999999"
                :model-value="formData.whatsapp_number"
                @update:model-value="(val) => handleFieldChange('whatsapp_number', val)"
                @blur="handleFieldBlur"
              />
            </div>

            <div class="md:col-span-2 flex items-start gap-3 bg-bg-secondary/40 p-4 rounded-2xl border border-border/50">
              <input
                type="checkbox"
                id="allow_whatsapp_notifications"
                v-model="formData.allow_whatsapp_notifications"
                @change="handleFieldBlur"
                class="mt-0.5 accent-primary w-4 h-4 rounded shrink-0 cursor-pointer"
              />
              <label for="allow_whatsapp_notifications" class="space-y-0.5 cursor-pointer">
                <div class="text-xs font-bold text-text flex items-center gap-1.5">
                  <Bell class="w-3.5 h-3.5 text-primary" />
                  <span>Allow notifications via WhatsApp</span>
                </div>
                <div class="text-[0.7rem] text-text-muted leading-normal">
                  Receive study materials, quiz alerts and reminders directly on WhatsApp.
                </div>
              </label>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
            <div class="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 class="w-4 h-4" />
              <span>All changes are saved automatically</span>
            </div>
            <Button class="px-6 font-bold" @click="handleManualSave" :loading="isSaving">
              Save everything now
            </Button>
          </div>
        </section>
      </div>

      <!-- TAB 2: ACHIEVEMENTS -->
      <div v-if="tab === 'achievements'" class="space-y-6">
        <!-- 3 Metric Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp class="w-5 h-5 text-primary" />
            </div>
            <div>
              <div class="text-2xl font-black text-text tabular-nums">
                {{ userScore.toLocaleString('pt-BR') }}
              </div>
              <div class="text-[0.7rem] text-text-muted uppercase tracking-wider font-semibold">
                Competition pts
              </div>
            </div>
          </div>

          <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Medal class="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div class="text-2xl font-black text-text tabular-nums">{{ userRank }}</div>
              <div class="text-[0.7rem] text-text-muted uppercase tracking-wider font-semibold">
                Global position
              </div>
            </div>
          </div>

          <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              :class="currentStreak > 0 ? 'bg-orange-500/10' : 'bg-muted/10'"
            >
              <img
                :src="currentStreak > 0 ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
                alt="Streak"
                class="w-6 h-6 object-contain transition-transform hover:scale-110"
                :class="{ 'opacity-40 grayscale': currentStreak === 0 }"
              />
            </div>
            <div>
              <div class="text-2xl font-black text-text tabular-nums">{{ currentStreak }} days</div>
              <div class="text-[0.7rem] text-text-muted uppercase tracking-wider font-semibold">
                Current streak
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Achievements List -->
        <section class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-primary font-bold text-base">
              <Trophy class="w-4 h-4" />
              <h2>Recent Achievements</h2>
            </div>
            <button
              type="button"
              @click="router.push('/achievements')"
              class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="space-y-3 pt-2">
            <template v-if="recentAchievements.length > 0">
              <div
                v-for="ach in recentAchievements"
                :key="ach.id"
                class="p-4 rounded-2xl bg-bg-secondary/40 border border-border flex items-center gap-4 hover:border-primary/30 transition-all"
              >
                <div class="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-xl shrink-0">
                  <Flame v-if="ach.category === 'streak'" class="w-5 h-5 text-orange-500" />
                  <Sparkles v-else-if="ach.category === 'messages'" class="w-5 h-5 text-yellow-500" />
                  <Target v-else-if="ach.category === 'activities'" class="w-5 h-5 text-primary" />
                  <Award v-else-if="ach.category === 'simulations'" class="w-5 h-5 text-purple-500" />
                  <Trophy v-else class="w-5 h-5 text-yellow-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-text truncate">{{ ach.name || ach.title }}</p>
                  <p class="text-xs text-text-muted truncate">{{ ach.description }}</p>
                </div>
                <div class="text-right shrink-0">
                  <span class="inline-block px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    +{{ ach.target || 10 }} pts
                  </span>
                </div>
              </div>
            </template>

            <div v-else class="text-center py-10 border border-dashed border-border rounded-2xl space-y-3">
              <Trophy class="w-8 h-8 mx-auto text-text-subtle" />
              <p class="text-xs text-text-muted">No unlocked achievements yet.</p>
              <Button variant="secondary" size="sm" @click="router.push('/achievements')">
                Explore Achievements
              </Button>
            </div>
          </div>
        </section>
      </div>

      <!-- TAB 3: RESPOSTAS DA TATIANA (FEEDBACKS) -->
      <div v-if="tab === 'feedbacks'" class="space-y-6">
        <section class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MessageSquareHeart class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-text">Teacher Tatiana's Replies</h2>
                <p class="text-xs text-text-muted">
                  Track the feedback you submitted and the teacher's pedagogical response.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              @click="fetchFeedbacks"
              class="gap-2 shrink-0 self-end sm:self-auto"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingFeedbacks }" />
              <span>Refresh</span>
            </Button>
          </div>

          <div v-if="loadingFeedbacks" class="h-48 flex items-center justify-center">
            <div class="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>

          <div v-else-if="myFeedbacks.length === 0" class="bg-bg border border-border rounded-2xl p-8 text-center space-y-3">
            <MessageSquareHeart class="w-9 h-9 mx-auto text-text-muted/40" />
            <h3 class="text-sm font-bold text-text">No feedback submitted yet</h3>
            <p class="text-xs text-text-muted max-w-sm mx-auto">
              When practicing activities or simulations, click the feedback icon to send comments and questions directly to Tatiana.
            </p>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="item in myFeedbacks"
              :key="item.id"
              class="bg-bg border rounded-2xl p-5 space-y-4 transition-all"
              :class="
                item.teacher_reply && item.teacher_reply.trim()
                  ? 'border-primary/40 ring-1 ring-primary/10 shadow-xs'
                  : 'border-border/80'
              "
            >
              <!-- Top: Badges & Status -->
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-surface border border-border text-text">
                    {{ item.area ? item.area.toUpperCase() : 'GENERAL' }}
                  </span>
                  <span
                    v-if="item.activity_title"
                    class="px-2.5 py-1 rounded-xl text-xs bg-surface border border-border text-text-muted truncate max-w-[220px]"
                  >
                    {{ item.activity_title }}
                  </span>
                  <span class="px-2 py-0.5 rounded-lg text-xs font-black bg-primary/10 text-primary border border-primary/20">
                    {{ item.cefr_level || 'A1' }}
                  </span>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-0.5">
                    <Star
                      v-for="star in 5"
                      :key="star"
                      class="w-3.5 h-3.5"
                      :class="
                        star <= item.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-border fill-transparent'
                      "
                    />
                  </div>
                  <span
                    class="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border"
                    :class="
                      item.teacher_reply && item.teacher_reply.trim()
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    "
                  >
                    <CheckCircle2 v-if="item.teacher_reply && item.teacher_reply.trim()" class="w-3 h-3" />
                    <Clock v-else class="w-3 h-3" />
                    <span>{{ item.teacher_reply && item.teacher_reply.trim() ? 'Replied' : 'Pending' }}</span>
                  </span>
                </div>
              </div>

              <!-- Student Comment -->
              <div class="text-sm text-text leading-relaxed bg-surface/50 border border-border/60 rounded-xl p-3.5 italic">
                &ldquo;{{ item.comment }}&rdquo;
              </div>

              <!-- Teacher Reply -->
              <div
                v-if="item.teacher_reply && item.teacher_reply.trim()"
                class="bg-primary/5 border border-primary/25 rounded-2xl p-4 space-y-2"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent text-white font-bold flex items-center justify-center text-xs shadow-xs">
                    T
                  </div>
                  <div>
                    <span class="text-xs font-bold text-primary block leading-tight">Teacher Tatiana</span>
                    <span class="text-[10px] text-text-muted">Teacher & Pedagogical Team</span>
                  </div>
                </div>
                <p class="text-xs md:text-sm text-text leading-relaxed whitespace-pre-wrap pl-10">
                  {{ item.teacher_reply }}
                </p>
              </div>
              <div v-else class="text-xs text-text-muted italic flex items-center gap-1.5 pt-1">
                <Clock class="w-3 h-3 text-amber-400" />
                <span>Teacher Tatiana will review your message soon!</span>
              </div>

              <!-- Date -->
              <div v-if="item.created_at" class="text-[11px] text-text-muted/60 text-right pt-1">
                Submitted on {{ new Date(item.created_at).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }) }}
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- TAB 4: SECURITY -->
      <div v-if="tab === 'security'" class="space-y-6">
        <section class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6">
          <div class="flex items-center gap-2 text-primary font-bold text-base">
            <Lock class="w-4 h-4" />
            <h2>Security</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">New Password</label>
              <Input
                type="password"
                auto-complete="new-password"
                v-model="pwData.new_pw"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Confirm New Password</label>
              <Input
                type="password"
                auto-complete="new-password"
                v-model="pwData.confirm_pw"
              />
            </div>
          </div>

          <Button class="w-full font-bold" @click="handleChangePassword">
            Update password
          </Button>
        </section>

        <!-- Danger Zone -->
        <section class="bg-danger/5 border border-danger/20 rounded-3xl p-6 md:p-8 space-y-4">
          <div class="flex items-center gap-2 text-danger font-bold text-base">
            <Trash2 class="w-4 h-4" />
            <h2>Danger Zone</h2>
          </div>
          <p class="text-xs text-text-muted">
            These actions are irreversible. Proceed with care.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="secondary" class="flex-1 font-bold gap-2" @click="handleSignOut">
              <LogOut class="w-4 h-4" />
              Sign out
            </Button>
            <Button
              variant="danger"
              class="flex-1 font-bold gap-2"
              @click="() => { deleteConfirmInput = ''; isDeleteModalOpen = true; }"
            >
              <Trash2 class="w-4 h-4" />
              Delete Account
            </Button>
          </div>
        </section>
      </div>
    </div>

    <!-- Delete Account Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="isDeleteModalOpen"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div class="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
          <div class="flex items-start gap-3.5 p-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger">
            <AlertTriangle class="shrink-0 mt-0.5 w-5 h-5" />
            <div class="text-xs space-y-1">
              <p class="font-bold text-sm">Warning: This action is permanent!</p>
              <p class="text-text-muted leading-relaxed">
                By deleting your account, all your study history, chat conversations, CEFR assessments, trophies, and XP points will be permanently purged. This action cannot be undone.
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-bold text-text">
              To confirm, type <span class="font-black text-danger underline">{{ user?.username || 'DELETE' }}</span> below:
            </label>
            <input
              type="text"
              v-model="deleteConfirmInput"
              :placeholder="user?.username || 'DELETE'"
              class="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-text text-sm font-mono focus:outline-none focus:border-danger focus:ring-2 focus:ring-danger/20 transition-all"
              autofocus
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              variant="secondary"
              @click="isDeleteModalOpen = false"
              :disabled="isDeleting"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              :disabled="deleteConfirmInput.trim() !== (user?.username || 'DELETE') || isDeleting"
              :loading="isDeleting"
              @click="handleDeleteAccount"
              class="gap-2 font-bold"
            >
              <Trash2 class="w-4 h-4" />
              Permanently Delete Account
            </Button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
