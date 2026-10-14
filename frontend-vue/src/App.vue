<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

onMounted(() => {
  authStore.init();
});
</script>

<template>
  <div class="min-h-screen bg-bg text-text font-body selection:bg-primary/20 selection:text-primary">
    <router-view />
  </div>
</template>
