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
  X,
  MessageSquare,
} from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const route = useRoute();

const navItems = [
  { path: '/activities', icon: BookOpen, label: 'Activities' },
  { path: '/exams', icon: GraduationCap, label: 'Exames Trimestrais' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/progress', icon: TrendingUp, label: 'Progress' },
  { path: '/goals', icon: Goal, label: 'Goals' },
  { path: '/achievements', icon: Trophy, label: 'Achievements' },
  { path: '/competitions', icon: BarChart2, label: 'Competitions' },
  { path: '/chat', icon: MessageSquare, label: 'Back to Chat' },
];

function isItemActive(path: string) {
  if (path === '/activities') return route.path === '/activities';
  return route.path.startsWith(path);
}
</script>

<template>
  <div>
    <!-- Mobile Overlay -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 md:hidden transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Sidebar Container -->
    <aside
      class="fixed md:static inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-300 md:translate-x-0"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <h2 class="font-display font-bold text-sm text-text">Activities Menu</h2>
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover md:hidden transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <nav class="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          @click="emit('close')"
          class="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all"
          :class="
            isItemActive(item.path)
              ? 'bg-primary text-white shadow-glow'
              : 'text-text-muted hover:bg-primary/10 hover:text-primary'
          "
        >
          <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
    </aside>
  </div>
</template>
