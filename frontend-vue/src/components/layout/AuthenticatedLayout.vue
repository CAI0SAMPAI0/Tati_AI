<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import MainHeader from './MainHeader.vue';
import Sidebar from './Sidebar.vue';
import SidebarActivities from './SidebarActivities.vue';
import ToastContainer from '../ui/ToastContainer.vue';

const route = useRoute();
const { isAuthenticated, isLoaded } = useAuth();
const isSidebarOpen = ref(false);

const isActivitiesArea = computed(() => {
  return (
    route.path.startsWith('/activities') ||
    route.path.startsWith('/exams') ||
    route.path.startsWith('/history') ||
    route.path.startsWith('/progress') ||
    route.path.startsWith('/goals') ||
    route.path.startsWith('/achievements') ||
    route.path.startsWith('/competitions')
  );
});

const isChatPage = computed(() => route.path === '/chat' || route.path.startsWith('/chat/'));

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}
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

    <!-- Main Authenticated Layout -->
    <div v-else class="flex-1 flex flex-col h-screen overflow-hidden">
      <!-- Top Header for non-chat pages or pages requiring global header -->
      <MainHeader v-if="!isChatPage" @toggle-menu="toggleSidebar" />

      <!-- Body Area with Sidebar and Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar for Activities -->
        <SidebarActivities
          v-if="isActivitiesArea && !isChatPage"
          :is-open="isSidebarOpen"
          @close="isSidebarOpen = false"
        />

        <!-- General Sidebar for Dashboard/Profile -->
        <Sidebar
          v-else-if="!isChatPage"
          :is-open="isSidebarOpen"
          @close="isSidebarOpen = false"
        />

        <!-- Main Content View -->
        <main class="flex-1 overflow-y-auto relative bg-bg flex flex-col">
          <router-view />
        </main>
      </div>
    </div>
  </div>
</template>
