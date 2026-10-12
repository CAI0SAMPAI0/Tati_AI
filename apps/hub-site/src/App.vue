<script setup lang="ts">
import { onMounted } from 'vue';
import HubLayoutWrapper from '@/components/HubLayoutWrapper.vue';
import LgpdConsentModal from '@/components/LgpdConsentModal.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

onMounted(() => {
  authStore.initAuth();
});
</script>

<template>
  <HubLayoutWrapper>
    <router-view />
    <LgpdConsentModal />
  </HubLayoutWrapper>
</template>
