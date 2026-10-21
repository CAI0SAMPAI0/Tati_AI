<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
</script>

<template>
  <div class="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
    <h1 class="font-display text-6xl font-extrabold text-primary mb-2">404</h1>
    <h2 class="text-xl font-bold text-text mb-2">Page Not Found</h2>
    <p class="text-xs sm:text-sm text-text-muted max-w-sm mb-6">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <Button @click="router.push('/chat')">
      <ArrowLeft class="w-4 h-4 mr-2" />
      <span>Back to Chat</span>
    </Button>
  </div>
</template>

