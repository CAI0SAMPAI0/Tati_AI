<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import {
  LayoutGrid,
  BookOpen,
  HelpCircle,
  X,
  ArrowLeft,
} from 'lucide-vue-next';
import TatiLogo from '@/components/ui/TatiLogo.vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const route = useRoute();

const menuItems = [
  { name: 'Gallery', icon: LayoutGrid, href: '/activities/hub' },
  { name: 'My Materials', icon: BookOpen, href: '/activities/hub/meus-materiais' },
];

const SUPPORT_EMAIL = 'cmsampaio135@gmail.com';
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
      @click="emit('close')"
    />

    <!-- Sidebar Aside -->
    <aside
      :class="[
        'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-surface shadow-lg md:shadow-none transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      ]"
    >
      <!-- Top Brand -->
      <div class="flex items-center justify-between border-b border-border p-5">
        <RouterLink to="/activities/hub" class="flex items-center gap-2.5" @click="emit('close')">
          <div class="h-9 w-9 rounded-xl overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 border border-primary/10">
            <TatiLogo :size="36" class="w-full h-full rounded-xl object-cover" />
          </div>
          <div>
            <h2 class="text-sm font-black text-text leading-tight">Taty's Hub</h2>
            <p class="text-[10px] text-text-muted font-bold uppercase tracking-widest">Materials</p>
          </div>
        </RouterLink>

        <button
          type="button"
          @click="emit('close')"
          class="rounded-xl p-1.5 text-text-muted hover:bg-bgSecondary hover:text-text md:hidden"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 overflow-y-auto p-3">
        <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Main Menu
        </p>

        <RouterLink
          v-for="item in menuItems"
          :key="item.name"
          :to="item.href"
          @click="emit('close')"
          :class="[
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors',
            route.path === item.href || (item.href !== '/activities/hub' && route.path.startsWith(item.href))
              ? 'bg-primary/10 text-primary'
              : 'text-text-muted hover:bg-bgSecondary hover:text-text'
          ]"
        >
          <component :is="item.icon" :size="16" />
          <span>{{ item.name }}</span>
        </RouterLink>

        <p class="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Support
        </p>

        <a
          :href="`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}`"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-text-muted hover:bg-bgSecondary hover:text-text transition-colors"
        >
          <HelpCircle :size="16" />
          <span>Email Support</span>
        </a>
      </nav>

      <!-- Bottom Card: Back to Activities -->
      <div class="p-3 border-t border-border">
        <RouterLink
          to="/activities"
          class="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all group shadow-xs"
        >
          <ArrowLeft :size="16" class="group-hover:-translate-x-0.5 transition-transform shrink-0" />
          <span>Back to activities</span>
        </RouterLink>
      </div>
    </aside>
  </div>
</template>
