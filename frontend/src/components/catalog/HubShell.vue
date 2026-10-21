<script setup lang="ts">
import { ref } from 'vue';
import HubSidebar from './HubSidebar.vue';
import HubHeader from './HubHeader.vue';

const sidebarOpen = ref(false);

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebar() {
  sidebarOpen.value = false;
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg text-text md:flex-row overflow-x-hidden">
    <HubSidebar :is-open="sidebarOpen" @close="closeSidebar" />

    <div class="flex min-w-0 flex-1 flex-col transition-all duration-300 md:ml-64">
      <HubHeader :on-toggle-menu="toggleSidebar" />
      <main class="mx-auto w-full max-w-7xl flex-1 pb-20">
        <slot />
      </main>
    </div>
  </div>
</template>
