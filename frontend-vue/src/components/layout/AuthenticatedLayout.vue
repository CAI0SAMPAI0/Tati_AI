<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import MainHeader from './MainHeader.vue';
import SidebarActivities from './SidebarActivities.vue';
import ToastContainer from '../ui/ToastContainer.vue';

const route = useRoute();
const { isLoaded } = useAuth();
const isSidebarOpen = ref(true);

const isStandaloneLayout = computed(() => {
  return (
    route.path === '/chat' ||
    route.path.startsWith('/chat/') ||
    route.path === '/dashboard' ||
    route.path === '/voice' ||
    route.path.startsWith('/voice') ||
    route.path.startsWith('/activities/hub') ||
    route.path.startsWith('/flashcards/') ||
    route.path === '/payment' ||
    route.path.startsWith('/payment') ||
    route.path === '/receipt' ||
    route.path.startsWith('/receipt') ||
    route.path === '/shop' ||
    route.path === '/profile' ||
    route.path.startsWith('/profile') ||
    route.path === '/settings' ||
    route.path.startsWith('/settings') ||
    route.path === '/exams/doing' ||
    route.path.startsWith('/exams/doing')
  );
});
</script>

<template>
  <div class="min-h-screen bg-bg text-text flex flex-col transition-colors">
    <ToastContainer />

    <!-- Loading Screen while checking auth -->
    <div
      v-if="!isLoaded"
      class="fixed inset-0 bg-bg flex flex-col items-center justify-center z-50"
    >
      <div class="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4"></div>
      <p class="font-display font-bold text-sm text-text-muted">Carregando Teacher Taty...</p>
    </div>

    <!-- Main Authenticated View -->
    <div v-else class="flex-1 flex flex-col h-screen overflow-hidden">
      <!-- 1. Dedicated layout pages (Chat & Dashboard have their own sidebars & headers) -->
      <router-view v-if="isStandaloneLayout" />

      <!-- 2. Hub / Activities pages (Exams, Activities, History, Progress, Goals, Achievements, Vocab, Profile) -->
      <div v-else class="flex-1 flex overflow-hidden relative">
        <SidebarActivities
          :is-open="isSidebarOpen"
          @close="isSidebarOpen = false"
        />

        <div
          class="flex-1 flex flex-col min-w-0 transition-all duration-300 h-screen overflow-hidden"
          :class="isSidebarOpen ? 'md:ml-[280px]' : 'md:ml-0'"
        >
          <MainHeader @toggle-menu="isSidebarOpen = !isSidebarOpen" />

          <main class="flex-1 overflow-y-auto relative bg-bg custom-scrollbar flex flex-col">
            <router-view />
          </main>
        </div>
      </div>
    </div>
  </div>
</template>

