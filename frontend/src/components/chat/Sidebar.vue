<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  X,
  ChevronRight,
  Plus,
  ClipboardCheck,
  LayoutGrid,
  Settings,
  BookMarked,
  Trash2,
  LogOut,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import { levelLabel } from '@/constants/levels';
import { canAccessDashboard } from '@/utils';
import TatiLogo from '../ui/TatiLogo.vue';
import ConversationList from './ConversationList.vue';
import { deleteConversation, deleteAllConversations, getConversations } from '@/api/chat';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  currentConvId: string | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'newChat'): void;
  (e: 'selectConv', id: string, title: string): void;
  (e: 'startLeveling'): void;
}>();

const router = useRouter();
const { user, logout } = useAuth();
const toast = useToast();
const convListRef = ref<InstanceType<typeof ConversationList> | null>(null);

const avatarUrl = computed(() => {
  const raw = user.value?.avatar_url || (user.value as any)?.profile?.avatar_url;
  return (!raw || (raw.includes('/avatar/avatar_tati') && (user.value as any)?.role !== 'teacher'))
    ? DEFAULT_AVATAR_URL
    : raw;
});

const showDashboard = computed(() => canAccessDashboard(user.value));

const isPremium = computed(() => {
  const u = user.value as any;
  return Boolean(u?.plan_type && u.plan_type !== 'free') || Boolean(u?.is_special_access) || (u?.role === 'programador' || u?.role === 'teacher' || u?.role === 'admin');
});

async function handleDeleteAll() {
  if (!confirm('⚠️ Delete ALL conversations?')) return;
  try {
    try {
      await deleteAllConversations();
    } catch (bulkErr) {
      console.warn('Bulk delete failed, falling back to batch delete:', bulkErr);
      const list = await getConversations(100, 0);
      await Promise.all(list.map((c) => deleteConversation(c.id)));
    }
    toast.success('All conversations deleted.');
    emit('newChat');
    convListRef.value?.load();
  } catch (err) {
    console.error('Error deleting all conversations:', err);
    toast.error('Could not delete all conversations.');
  }
}

function handleSignOut() {
  logout();
  router.push('/login');
}

defineExpose({
  reloadConversations: () => convListRef.value?.load(),
  addConversation: (conv: any) => convListRef.value?.addConversation(conv),
});
</script>

<template>
  <div>
    <!-- Overlay for mobile -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60] transition-opacity md:hidden"
      :class="isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      @click="emit('close')"
    ></div>

    <!-- Sidebar Aside -->
    <aside
      class="fixed inset-y-0 left-0 w-[280px] bg-bg-secondary border-r border-border z-[70] flex flex-col transition-transform duration-300"
      :class="isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center text-primary">
            <TatiLogo :size="28" class="w-full h-full object-cover rounded-lg" />
          </div>
          <span class="font-display text-[0.9rem] font-bold tracking-tight text-text">
            Taty's Hub
          </span>
        </div>
        <button
          aria-label="Fechar menu"
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-md hover:bg-surface-hover text-text-muted md:hidden transition-colors"
        >
          <X class="w-4 h-4" />
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
            @error="(e: any) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[0.82rem] font-semibold truncate leading-none mb-1 text-text">
            {{ user?.name || user?.username }}
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[0.68rem] text-text-muted truncate">
              {{ user?.level ? levelLabel(user.level) : 'Student' }}
            </span>
            <span
              v-if="isPremium"
              class="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[0.6rem] font-bold border border-primary/30"
            >
              Premium
            </span>
          </div>
        </div>
        <ChevronRight class="w-3.5 h-3.5 text-text-subtle group-hover:text-primary transition-colors" />
      </router-link>

      <!-- New Chat Button -->
      <button
        type="button"
        @click="emit('newChat')"
        class="mx-3 mb-1.5 flex items-center gap-2.5 px-3.5 py-2.5 bg-primary/15 border border-primary/30 rounded-lg text-primary text-[0.85rem] font-bold hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px] cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        <span>New conversation</span>
      </button>

      <!-- Leveling Assessment Button -->
      <button
        type="button"
        @click="emit('startLeveling')"
        class="mx-3 mb-2 flex items-center justify-between gap-3 px-3.5 py-2 bg-gradient-to-r from-purple-500/10 via-primary/15 to-purple-500/10 border border-primary/40 rounded-lg text-primary hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px] shadow-sm text-left min-w-[240px] cursor-pointer"
        title="Start your CEFR English Leveling Challenge"
      >
        <div class="flex items-center gap-3">
          <ClipboardCheck class="w-4 h-4 text-primary shrink-0" />
          <span class="flex flex-col items-start leading-tight">
            <span class="text-[0.82rem] font-bold truncate">Leveling Assessment</span>
            <span class="text-[0.7rem] font-normal opacity-80 hidden md:block">A1 to B2 · CEFR Test</span>
          </span>
        </div>
        <span class="ml-auto text-[0.65rem] font-extrabold tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-xl uppercase border border-purple-500/30 animate-pulse">
          NEW
        </span>
      </button>

      <div class="h-px bg-border mx-3 my-2 shrink-0"></div>

      <!-- Scrollable Conversation List -->
      <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
        <ConversationList
          ref="convListRef"
          :current-id="currentConvId"
          @select="(id, title) => emit('selectConv', id, title)"
          @delete="() => emit('newChat')"
        />
      </div>

      <!-- Footer Buttons -->
      <div class="mt-auto border-t border-border p-3 flex items-center gap-1.5 shrink-0">
        <router-link
          v-if="showDashboard"
          to="/dashboard"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          title="Dashboard"
        >
          <LayoutGrid class="w-4.5 h-4.5" />
        </router-link>

        <router-link
          to="/settings"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          title="Settings"
        >
          <Settings class="w-4.5 h-4.5" />
        </router-link>

        <router-link
          to="/activities"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
          title="My Activities"
        >
          <BookMarked class="w-4.5 h-4.5" />
        </router-link>

        <div class="flex-1"></div>

        <button
          type="button"
          aria-label="Apagar todas as conversas"
          @click="handleDeleteAll"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/50 transition-all"
          title="Delete all"
        >
          <Trash2 class="w-4.5 h-4.5" />
        </button>

        <button
          type="button"
          aria-label="Sair da conta"
          @click="handleSignOut"
          class="p-2 rounded-lg border border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/50 transition-all"
          title="Sign out"
        >
          <LogOut class="w-4.5 h-4.5" />
        </button>
      </div>
    </aside>
  </div>
</template>

