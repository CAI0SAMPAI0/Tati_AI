<script setup lang="ts">
import SidebarActivities from './SidebarActivities.vue';
import MainHeader from './MainHeader.vue';
import { useSidebarState } from '@/utils/useSidebarState';

withDefaults(
  defineProps<{
    hideStats?: boolean;
    hideStreakAndTrophies?: boolean;
  }>(),
  {
    hideStats: false,
    hideStreakAndTrophies: false,
  }
);

const { sidebarOpen, toggleSidebar, closeSidebar } = useSidebarState();
</script>

<template>
  <div class="flex min-h-screen bg-bg">
    <!-- Shared Sidebar -->
    <SidebarActivities
      :is-open="sidebarOpen"
      @close="closeSidebar"
    />

    <!-- Main Content Area -->
    <div
      class="flex-1 flex flex-col min-w-0 transition-all duration-300"
      :class="sidebarOpen ? 'md:ml-[280px]' : 'md:ml-0'"
    >
      <MainHeader
        :hide-stats="hideStats"
        :hide-streak-and-trophies="hideStreakAndTrophies"
        @toggle-menu="toggleSidebar"
      />

      <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
