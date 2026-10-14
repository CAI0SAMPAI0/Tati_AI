<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Plus,
  ClipboardCheck,
  ChevronRight,
  LayoutGrid,
  Settings,
  BookMarked,
  Trash2,
  LogOut,
  X,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { canAccessDashboard } from '@/utils/permissions';

export interface ChatConversation {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

const props = defineProps<{
  isOpen: boolean;
  conversations: ChatConversation[];
  activeConvId: string | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'newChat'): void;
  (e: 'startLeveling'): void;
  (e: 'selectConv', id: string): void;
  (e: 'deleteConv', id: string): void;
  (e: 'deleteAll'): void;
}>();

const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const avatarUrl = computed(() => (user.value as any)?.avatar_url || '/images/tati_logo.jpg');
const userLevel = computed(() => {
  const lvl = user.value?.level || 'B2';
  const map: Record<string, string> = {
    A1: 'A1 – Beginner',
    A2: 'A2 – Pre-Intermediate',
    B1: 'B1 – Intermediate',
    B2: 'B2 – Upper-Intermediate',
    C1: 'C1 – Advanced',
    C2: 'C2 – Proficiency',
  };
  return map[lvl.toUpperCase()] || `${lvl} – Intermediate`;
});
const canSeeDashboard = computed(() => canAccessDashboard(authStore.user));

// Group conversations by Today, Yesterday, Earlier
const groupedConversations = computed(() => {
  const convs = props.conversations || [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const groups = {
    Today: [] as ChatConversation[],
    Yesterday: [] as ChatConversation[],
    Earlier: [] as ChatConversation[],
  };

  convs.forEach((c) => {
    const d = c.updated_at ? new Date(c.updated_at).toDateString() : today;
    if (d === today) groups.Today.push(c);
    else if (d === yesterday) groups.Yesterday.push(c);
    else groups.Earlier.push(c);
  });

  return groups;
});

function handleLogout() {
  authStore.clearSession();
  router.push('/login');
}
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60] transition-opacity md:hidden opacity-100"
      @click="emit('close')"
    />

    <!-- Sidebar Aside -->
    <aside
      class="fixed inset-y-0 left-0 w-[280px] bg-bg-secondary border-r border-border z-[70] flex flex-col transition-transform duration-300"
      :class="isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center text-primary">
            <img
              src="/images/tati_logo.jpg"
              alt="Tati"
              class="object-cover shrink-0 w-full h-full rounded-lg"
            />
          </div>
          <span class="font-display text-[0.9rem] font-bold tracking-tight">
            Taty's Hub
          </span>
        </div>

        <button
          type="button"
          aria-label="Fechar menu"
          class="p-1.5 rounded-md hover:bg-surface-hover text-text-muted md:hidden cursor-pointer"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- User Card -->
      <router-link
        to="/profile"
        class="mx-3 mb-3 p-2.5 bg-surface border border-border rounded-lg flex items-center gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all group"
      >
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(270,60%,32%)] flex items-center justify-center text-[0.7rem] font-bold text-white shrink-0 overflow-hidden">
          <img
            :src="avatarUrl"
            alt="Avatar"
            class="w-full h-full object-cover"
            @error="(e: any) => { e.currentTarget.src = '/images/tati_logo.jpg'; }"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[0.82rem] font-semibold truncate leading-none mb-1">
            {{ user?.name || user?.username || 'Developer' }}
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[0.68rem] text-text-muted truncate">
              {{ userLevel }}
            </span>
            <span class="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[0.6rem] font-bold border border-primary/30">
              Premium
            </span>
          </div>
        </div>
        <ChevronRight :size="12" class="text-text-subtle group-hover:text-primary transition-colors" />
      </router-link>

      <!-- New Conversation Button -->
      <button
        type="button"
        class="mx-3 mb-1.5 flex items-center gap-2.5 px-3.5 py-2.5 bg-primary/15 border border-primary/30 rounded-lg text-primary text-[0.85rem] font-bold hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px] cursor-pointer"
        @click="emit('newChat')"
      >
        <Plus :size="16" :stroke-width="2.5" />
        <span>New conversation</span>
      </button>

      <!-- Leveling Assessment Button -->
      <button
        type="button"
        class="mx-3 mb-2 flex items-center justify-between gap-3 px-3.5 py-2 bg-gradient-to-r from-purple-500/10 via-primary/15 to-purple-500/10 border border-primary/40 rounded-lg text-primary hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px] shadow-sm text-left min-w-[240px] cursor-pointer"
        title="Start your CEFR English Leveling Challenge"
        @click="emit('startLeveling')"
      >
        <div class="flex items-center gap-3">
          <ClipboardCheck :size="18" :stroke-width="2.2" class="text-primary shrink-0" />
          <span class="flex flex-col items-start leading-tight">
            <span class="text-[0.82rem] font-bold truncate">Leveling Assessment</span>
            <span class="text-[0.7rem] font-normal opacity-80 hidden md:block">A1 to B2 · CEFR Test</span>
          </span>
        </div>
        <span class="ml-auto text-[0.65rem] font-extrabold tracking-wider bg-purple-500/20 text-purple-600 px-1.5 py-0.5 rounded-xl uppercase border border-purple-500/30 animate-pulse">
          NEW
        </span>
      </button>

      <div class="h-px bg-border mx-3 my-2 shrink-0" />

      <!-- Scrollable conversations list -->
      <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
        <div class="flex-1">
          <div class="px-2 py-1">
            <!-- Today -->
            <div v-if="groupedConversations.Today.length > 0" class="mb-4">
              <h3 class="px-2 mb-1 text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">
                Today
              </h3>
              <div class="space-y-0.5">
                <div
                  v-for="c in groupedConversations.Today"
                  :key="c.id"
                  class="group relative flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors"
                  :class="c.id === activeConvId ? 'bg-primary/15 text-primary font-medium' : 'text-text-muted hover:bg-surface-hover-list-chat hover:text-text'"
                  @click="emit('selectConv', c.id)"
                >
                  <span class="flex-1 text-[0.82rem] truncate leading-tight">{{ c.title }}</span>
                  <button
                    type="button"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity"
                    title="Delete"
                    @click.stop="emit('deleteConv', c.id)"
                  >
                    <X :size="12" :stroke-width="2.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Yesterday -->
            <div v-if="groupedConversations.Yesterday.length > 0" class="mb-4">
              <h3 class="px-2 mb-1 text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">
                Yesterday
              </h3>
              <div class="space-y-0.5">
                <div
                  v-for="c in groupedConversations.Yesterday"
                  :key="c.id"
                  class="group relative flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors"
                  :class="c.id === activeConvId ? 'bg-primary/15 text-primary font-medium' : 'text-text-muted hover:bg-surface-hover-list-chat hover:text-text'"
                  @click="emit('selectConv', c.id)"
                >
                  <span class="flex-1 text-[0.82rem] truncate leading-tight">{{ c.title }}</span>
                  <button
                    type="button"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity"
                    title="Delete"
                    @click.stop="emit('deleteConv', c.id)"
                  >
                    <X :size="12" :stroke-width="2.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Earlier -->
            <div v-if="groupedConversations.Earlier.length > 0" class="mb-4">
              <h3 class="px-2 mb-1 text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">
                Earlier
              </h3>
              <div class="space-y-0.5">
                <div
                  v-for="c in groupedConversations.Earlier"
                  :key="c.id"
                  class="group relative flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors"
                  :class="c.id === activeConvId ? 'bg-primary/15 text-primary font-medium' : 'text-text-muted hover:bg-surface-hover-list-chat hover:text-text'"
                  @click="emit('selectConv', c.id)"
                >
                  <span class="flex-1 text-[0.82rem] truncate leading-tight">{{ c.title }}</span>
                  <button
                    type="button"
                    class="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity"
                    title="Delete"
                    @click.stop="emit('deleteConv', c.id)"
                  >
                    <X :size="12" :stroke-width="2.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Empty indicator -->
            <div
              v-if="conversations.length === 0"
              class="text-center py-8 text-xs text-text-muted"
            >
              No conversations yet
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-auto border-t border-border p-3 flex items-center gap-1.5">
        <router-link
          v-if="canSeeDashboard"
          to="/dashboard"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          title="Dashboard"
        >
          <LayoutGrid :size="18" />
        </router-link>

        <router-link
          to="/settings"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          title="Settings"
        >
          <Settings :size="18" />
        </router-link>

        <router-link
          to="/activities"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          title="My Activities"
        >
          <BookMarked :size="18" />
        </router-link>

        <div class="flex-1" />

        <button
          type="button"
          aria-label="Apagar todas as conversas"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/50 transition-all cursor-pointer"
          title="Delete all"
          @click="emit('deleteAll')"
        >
          <Trash2 :size="18" />
        </button>

        <button
          type="button"
          aria-label="Sair da conta"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/50 transition-all cursor-pointer"
          title="Sign out"
          @click="handleLogout"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </aside>
  </div>
</template>
