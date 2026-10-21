<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  MessageSquare,
  GraduationCap,
  BookOpen,
  LayoutGrid,
  BookMarked,
  User,
  LogOut,
  Plus,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import { levelLabel } from '@/constants/levels';
import TatiLogo from '../ui/TatiLogo.vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    conversations?: Array<{ id: string; title: string }>;
    currentConvId?: string | null;
  }>(),
  {
    isOpen: false,
    conversations: () => [],
    currentConvId: null,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'newChat'): void;
  (e: 'selectConv', id: string): void;
  (e: 'deleteAll'): void;
}>();

const route = useRoute();
const router = useRouter();
const { user, logout, userLevel, isTeacher } = useAuth();

const avatarUrl = computed(() => {
  const raw = user.value?.avatar_url || (user.value as any)?.profile?.avatar_url;
  return (!raw || (raw.includes('/avatar/avatar_tati') && (user.value as any)?.role !== 'teacher'))
    ? DEFAULT_AVATAR_URL
    : raw;
});

const navLinks = computed(() => [
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/exams', label: 'Exames Trimestrais', icon: GraduationCap },
  { path: '/activities', label: 'Activities', icon: BookOpen },
  { path: '/vocab', label: 'Vocabulary', icon: BookMarked },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid, requireTeacher: true },
  { path: '/profile', label: 'Profile', icon: User },
]);

function handleLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 md:hidden transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Sidebar Container -->
    <aside
      class="fixed md:static inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border flex flex-col transition-transform duration-300 md:translate-x-0"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="h-16 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <div class="flex items-center gap-2.5">
          <TatiLogo :size="34" />
          <div>
            <h2 class="font-display font-bold text-sm text-text leading-tight">Teacher Taty</h2>
            <p class="text-[0.72rem] text-text-muted">AI English Mentor</p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover md:hidden transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- New Chat Button -->
      <div class="p-3 border-b border-border/60 flex items-center gap-2">
        <button
          type="button"
          @click="emit('newChat')"
          class="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-primary text-white text-xs font-bold rounded-xl shadow-glow hover:bg-primary-hover transition-all active:scale-[0.98]"
        >
          <Plus class="w-4 h-4" />
          <span>New Chat</span>
        </button>
        <button
          v-if="conversations.length > 0"
          type="button"
          @click="emit('deleteAll')"
          class="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          title="Delete all conversations"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

      <!-- Main Navigation Links -->
      <div class="p-3 border-b border-border/60 space-y-1">
        <template v-for="link in navLinks" :key="link.path">
          <router-link
            v-if="!link.requireTeacher || isTeacher"
            :to="link.path"
            @click="emit('close')"
            class="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            :class="
              route.path.startsWith(link.path)
                ? 'bg-primary/10 text-primary'
                : 'text-text-muted hover:text-text hover:bg-surface-hover'
            "
          >
            <component :is="link.icon" class="w-4 h-4" />
            <span>{{ link.label }}</span>
          </router-link>
        </template>
      </div>

      <!-- Recent Conversations Scrollable -->
      <div class="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        <p class="text-[0.7rem] uppercase tracking-wider font-bold text-text-subtle px-2 mb-2">
          Recent Conversations
        </p>

        <div v-if="conversations.length === 0" class="text-center py-6 px-3">
          <p class="text-xs text-text-muted">No conversations yet</p>
          <p class="text-[0.7rem] text-text-subtle mt-1">Start talking with Taty!</p>
        </div>

        <div v-else class="space-y-1">
          <button
            v-for="conv in conversations"
            :key="conv.id"
            type="button"
            @click="emit('selectConv', conv.id); emit('close')"
            class="w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs transition-colors group"
            :class="
              conv.id === currentConvId
                ? 'bg-primary text-white font-bold shadow-sm'
                : 'text-text-muted hover:bg-surface-hover hover:text-text font-medium'
            "
          >
            <span class="truncate flex-1">{{ conv.title || 'Conversation' }}</span>
            <ChevronRight
              class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
            />
          </button>
        </div>
      </div>

      <!-- User Profile & Level Badge Bottom -->
      <div class="p-3 border-t border-border bg-bg/40 flex-shrink-0">
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface border border-border/80">
          <router-link to="/profile" class="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
            <div class="w-8 h-8 rounded-full overflow-hidden border border-border bg-primary/10 flex-shrink-0">
              <img
                :src="avatarUrl"
                alt="Avatar"
                class="w-full h-full object-cover"
                @error="($event.target as HTMLImageElement).src = DEFAULT_AVATAR_URL"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-text truncate">
                {{ user?.name || user?.username || 'Aluno' }}
              </p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="px-1.5 py-0.5 rounded text-[0.65rem] font-extrabold bg-primary text-white">
                  {{ userLevel }}
                </span>
                <span class="text-[0.68rem] text-text-muted truncate">
                  {{ levelLabel(userLevel) }}
                </span>
              </div>
            </div>
          </router-link>

          <button
            type="button"
            @click="handleLogout"
            class="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
            title="Sair da conta"
          >
            <LogOut class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

