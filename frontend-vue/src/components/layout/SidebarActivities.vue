<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  BookOpen,
  GraduationCap,
  History,
  TrendingUp,
  Goal,
  Trophy,
  BarChart2,
  Zap,
  X,
  MessageSquare,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { canAccessExams } from '@/utils';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const route = useRoute();
const { user } = useAuth();

const showExams = computed(() => canAccessExams(user.value));

function handleItemClick() {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    emit('close');
  }
}

const navItems = computed(() => [
  { path: '/activities', icon: BookOpen, label: 'Activities' },
  ...(showExams.value ? [{ path: '/exams', icon: GraduationCap, label: 'Exams' }] : []),
  { path: '/history', icon: History, label: 'History' },
  { path: '/activities/hub', icon: Zap, label: 'Hub' },
  { path: '/progress', icon: TrendingUp, label: 'Progress' },
  { path: '/goals', icon: Goal, label: 'Goals' },
  { path: '/achievements', icon: Trophy, label: 'Achievements' },
  { path: '/competitions', icon: BarChart2, label: 'Competitions' },
]);

function isItemActive(path: string) {
  if (path === '/activities') return route.path === '/activities';
  return route.path.startsWith(path);
}
</script>

<template>
  <div>
    <!-- Mobile Overlay -->
    <div
      class="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 md:hidden"
      :class="isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      @click="emit('close')"
    ></div>

    <!-- Aside Container -->
    <aside
      class="fixed inset-y-0 left-0 w-[280px] bg-bg-secondary border-r border-border z-50 flex flex-col transition-transform duration-300 shadow-2xl"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 px-6 shrink-0 mb-2">
        <div class="flex items-center gap-2.5">
          <div class="flex flex-col">
            <span class="font-display text-sm font-bold tracking-tight text-text">
              Teacher <span class="text-primary">Taty</span>
            </span>
            <span class="text-[0.62rem] font-bold text-text-subtle uppercase tracking-widest">
              Activities Hub
            </span>
          </div>
        </div>

        <button
          aria-label="Close menu"
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors md:hidden"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>

      <!-- Nav Items -->
      <nav class="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        <router-link
          v-for="item in navItems"
          :key="item.path + item.label"
          :to="item.path"
          @click="handleItemClick"
          class="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group"
          :class="
            isItemActive(item.path)
              ? 'bg-primary text-white shadow-glow'
              : 'text-text-muted hover:bg-primary/10 hover:text-primary'
          "
        >
          <component
            :is="item.icon"
            class="w-5 h-5 shrink-0"
            :class="isItemActive(item.path) ? 'text-white' : 'text-text-subtle group-hover:text-primary'"
          />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- Back to Chat footer -->
      <div class="p-4 border-t border-border">
        <router-link
          to="/chat"
          @click="handleItemClick"
          class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all"
        >
          <MessageSquare class="w-5 h-5" />
          <span>Back to chat</span>
        </router-link>
      </div>
    </aside>
  </div>
</template>

