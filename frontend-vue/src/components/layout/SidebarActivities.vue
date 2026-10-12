<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  BookOpen,
  Trophy,
  BarChart3,
  MessageSquare,
  X,
  TrendingUp,
  Zap,
  History,
  Target,
  GraduationCap,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isHubOnly = computed(() => (authStore.user as any)?.is_hub_only);
const isProgramador = computed(() => authStore.user?.username === 'programador');

const navItems = computed(() => {
  if (isHubOnly.value) {
    return [{ href: '/activities/hub', icon: Zap, label: 'Hub' }];
  }
  return [
    { href: '/activities', icon: BookOpen, label: 'Activities' },
    ...(isProgramador.value ? [{ href: '/exams', icon: GraduationCap, label: 'Quarterly Exam' }] : []),
    { href: '/history', icon: History, label: 'History' },
    { href: '/activities/hub', icon: Zap, label: 'Hub' },
    { href: '/progress', icon: TrendingUp, label: 'Progress' },
    { href: '/goals', icon: Target, label: 'Goals' },
    { href: '/achievements', icon: Trophy, label: 'Achievements' },
    { href: '/competitions', icon: BarChart3, label: 'Competitions' },
  ];
});

function isItemActive(href: string): boolean {
  const currentPath = route.path;
  if (currentPath === href) return true;
  if (href === '/exams' && currentPath.startsWith('/exams')) return true;
  if (
    href === '/achievements' &&
    (currentPath === '/achievements' || currentPath.startsWith('/activities/achievements'))
  ) {
    return true;
  }
  if (href === '/activities' && currentPath === '/activities') return true;
  if (href === '/activities/hub' && currentPath.startsWith('/activities/hub')) return true;
  return false;
}

function handleNavClick() {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    emit('close');
  }
}
</script>

<template>
  <div>
    <!-- Mobile Overlay -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 md:hidden"
      @click="emit('close')"
    />

    <!-- Sidebar Aside -->
    <aside
      class="fixed inset-y-0 left-0 w-[280px] bg-bgSecondary border-r border-line z-50 flex flex-col transition-transform duration-300 shadow-2xl md:static md:translate-x-0 md:shadow-none"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 px-6 shrink-0 mb-2">
        <div class="flex items-center gap-2.5">
          <div class="flex flex-col">
            <span class="font-display text-sm font-bold tracking-tight text-ink">
              Teacher <span class="text-primary">Taty</span>
            </span>
            <span class="text-[0.62rem] font-bold text-muted uppercase tracking-widest">
              Activities Hub
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close menu"
          class="p-1.5 rounded-md hover:bg-surface text-muted transition-colors md:hidden cursor-pointer"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Navigation links -->
      <nav class="flex-1 px-4 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.href"
          :to="item.href"
          class="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group"
          :class="
            isItemActive(item.href)
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:bg-primary/10 hover:text-primary'
          "
          @click="handleNavClick"
        >
          <component
            :is="item.icon"
            :size="20"
            :class="isItemActive(item.href) ? 'text-white' : 'text-muted group-hover:text-primary'"
          />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- Bottom: Back to Chat button -->
      <div class="p-4 border-t border-line">
        <router-link
          to="/chat"
          class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer"
          @click="handleNavClick"
        >
          <MessageSquare :size="20" />
          <span>Back to chat</span>
        </router-link>
      </div>
    </aside>
  </div>
</template>
