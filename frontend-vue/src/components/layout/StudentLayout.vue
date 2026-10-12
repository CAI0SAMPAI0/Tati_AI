<script setup lang="ts">
import { ref } from 'vue';
import SidebarActivities from './SidebarActivities.vue';
import MainHeader from './MainHeader.vue';

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

const isSidebarOpen = ref(false);

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function closeSidebar() {
  isSidebarOpen.value = false;
}
</script>

<template>
  <div class="flex min-h-screen bg-bg">
    <!-- Shared Sidebar -->
    <SidebarActivities
      :is-open="isSidebarOpen"
      @close="closeSidebar"
    />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
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
