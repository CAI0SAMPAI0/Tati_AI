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
const userLevel = computed(() => (user.value?.level || 'B2').toUpperCase());
const canSeeDashboard = computed(() => canAccessDashboard(authStore.user));

// Agrupar conversas por Hoje, Ontem, Anteriores
const groupedConversations = computed(() => {
  const convs = props.conversations || [];
  if (convs.length === 0) return null;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const groups: Record<string, ChatConversation[]> = {
    Hoje: [],
    Ontem: [],
    Anteriores: [],
  };

  convs.forEach((c) => {
    const d = c.updated_at ? new Date(c.updated_at).toDateString() : today;
    if (d === today) groups.Hoje.push(c);
    else if (d === yesterday) groups.Ontem.push(c);
    else groups.Anteriores.push(c);
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
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60] transition-opacity md:hidden"
      @click="emit('close')"
    />

    <!-- Sidebar Aside -->
    <aside
      class="fixed inset-y-0 left-0 w-[280px] bg-bgSecondary border-r border-line z-[70] flex flex-col transition-transform duration-300"
      :class="isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg overflow-hidden bg-primarySoft flex items-center justify-center text-primary">
            <img src="/images/tati_logo.jpg" alt="Tati" class="w-full h-full object-cover rounded-lg" />
          </div>
          <span class="font-display text-[0.9rem] font-bold tracking-tight text-ink">
            Taty's Hub
          </span>
        </div>

        <button
          type="button"
          aria-label="Fechar menu"
          class="p-1.5 rounded-md hover:bg-surface text-muted md:hidden cursor-pointer"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- User Card -->
      <router-link
        to="/profile"
        class="mx-3 mb-3 p-2.5 bg-surface border border-line rounded-lg flex items-center gap-3 hover:bg-primarySoft/40 hover:border-primary/30 transition-all group"
      >
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-800 flex items-center justify-center text-[0.7rem] font-bold text-white shrink-0 overflow-hidden shadow-xs">
          <img
            :src="avatarUrl"
            alt="Avatar"
            class="w-full h-full object-cover"
            @error="(e: any) => { e.currentTarget.src = '/images/tati_logo.jpg'; }"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[0.82rem] font-semibold truncate leading-none mb-1 text-ink">
            {{ user?.name || user?.username || 'Student' }}
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[0.68rem] text-muted truncate">
              {{ userLevel }}
            </span>
            <span class="px-1.5 py-0.5 rounded-full bg-primarySoft text-primary text-[0.6rem] font-bold border border-primary/20">
              Premium
            </span>
          </div>
        </div>
        <ChevronRight :size="12" class="text-muted group-hover:text-primary transition-colors" />
      </router-link>

      <!-- New Conversation Button -->
      <button
        type="button"
        class="mx-3 mb-1.5 flex items-center gap-2.5 px-3.5 py-2.5 bg-primarySoft border border-primary/30 rounded-lg text-primary text-[0.85rem] font-bold hover:bg-primary/20 hover:border-primary transition-all active:translate-y-[1px] cursor-pointer"
        @click="emit('newChat')"
      >
        <Plus :size="16" :stroke-width="2.5" />
        <span>Nova conversa</span>
      </button>

      <!-- Leveling Assessment Button -->
      <button
        type="button"
        class="mx-3 mb-2 flex items-center justify-between gap-3 px-3.5 py-2 bg-gradient-to-r from-purple-500/10 via-primarySoft to-purple-500/10 border border-primary/40 rounded-lg text-primary hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px] shadow-xs text-left cursor-pointer"
        title="Iniciar Desafio de Nivelamento de Inglês CEFR"
        @click="emit('startLeveling')"
      >
        <div class="flex items-center gap-3">
          <ClipboardCheck :size="18" class="text-primary shrink-0" :stroke-width="2.2" />
          <span class="flex flex-col items-start leading-tight">
            <span class="text-[0.82rem] font-bold truncate">
              Teste de Nivelamento (CEFR)
            </span>
            <span class="text-[0.7rem] font-normal opacity-80 hidden md:block">
              A1 ao B2 • Teste CEFR
            </span>
          </span>
        </div>
        <span class="ml-auto text-[0.65rem] font-extrabold tracking-wider bg-purple-500/20 text-purple-600 px-1.5 py-0.5 rounded-xl uppercase border border-purple-500/30 animate-pulse">
          NOVO
        </span>
      </button>

      <div class="h-px bg-line mx-3 my-2 shrink-0" />

      <!-- Scrollable Conversation Groups -->
      <div class="flex-1 overflow-y-auto px-2 py-1 no-scrollbar space-y-4">
        <template v-if="groupedConversations">
          <div
            v-for="(items, label) in groupedConversations"
            :key="label"
            v-show="items.length > 0"
          >
            <h3 class="px-2 mb-1 text-[0.65rem] font-bold text-muted uppercase tracking-wider">
              {{ label }}
            </h3>
            <div class="space-y-0.5">
              <div
                v-for="c in items"
                :key="c.id"
                class="group relative flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors"
                :class="
                  c.id === activeConvId
                    ? 'bg-primary text-white font-bold'
                    : 'text-muted hover:bg-surface hover:text-ink'
                "
                @click="emit('selectConv', c.id)"
              >
                <span class="flex-1 text-[0.82rem] truncate leading-tight">
                  {{ c.title }}
                </span>
                <button
                  type="button"
                  class="opacity-20 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity cursor-pointer"
                  title="Excluir conversa"
                  @click.stop="emit('deleteConv', c.id)"
                >
                  <X :size="12" :stroke-width="2.5" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <div
          v-else
          class="p-4 text-center text-xs text-muted"
        >
          Nenhuma conversa ainda
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="mt-auto border-t border-line p-3 flex items-center gap-1.5">
        <router-link
          v-if="canSeeDashboard"
          to="/dashboard"
          class="p-2 rounded-lg border border-line text-muted hover:bg-primarySoft hover:text-primary hover:border-primary/50 transition-all cursor-pointer"
          title="Painel do Professor"
        >
          <LayoutGrid :size="18" />
        </router-link>

        <router-link
          to="/settings"
          class="p-2 rounded-lg border border-line text-muted hover:bg-primarySoft hover:text-primary hover:border-primary/50 transition-all cursor-pointer"
          title="Configurações"
        >
          <Settings :size="18" />
        </router-link>

        <router-link
          to="/activities"
          class="p-2 rounded-lg border border-line text-muted hover:bg-primarySoft hover:text-primary hover:border-primary/50 transition-all cursor-pointer"
          title="Minhas Atividades"
        >
          <BookMarked :size="18" />
        </router-link>

        <div class="flex-1" />

        <button
          type="button"
          aria-label="Apagar todas as conversas"
          class="p-2 rounded-lg border border-line text-muted hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/50 transition-all cursor-pointer"
          title="Apagar todas as conversas"
          @click="emit('deleteAll')"
        >
          <Trash2 :size="18" />
        </button>

        <button
          type="button"
          aria-label="Sair da conta"
          class="p-2 rounded-lg border border-line text-muted hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/50 transition-all cursor-pointer"
          title="Sair da conta"
          @click="handleLogout"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </aside>
  </div>
</template>
