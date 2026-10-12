<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from '@/components/Sidebar.vue';
import HubHeader from '@/components/HubHeader.vue';

const route = useRoute();
const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
const sidebarOpen = ref(isDesktop);

const isLoginPage = computed(() => route.path === '/login');
</script>

<template>
  <main v-if="isLoginPage">
    <slot />
  </main>

  <div v-else class="flex min-h-screen flex-col bg-surface md:flex-row md:bg-bgSecondary">
    <Sidebar :is-open="sidebarOpen" @close="sidebarOpen = false" />

    <div
      :class="[
        'flex min-w-0 flex-1 flex-col transition-all duration-300',
        sidebarOpen ? 'md:ml-64' : 'md:ml-0',
      ]"
    >
      <HubHeader
        :is-sidebar-open="sidebarOpen"
        :on-toggle-menu="() => (sidebarOpen = !sidebarOpen)"
      />

      <main class="mx-auto w-full max-w-7xl flex-1 pb-20">
        <slot />
      </main>
    </div>
  </div>
</template>
