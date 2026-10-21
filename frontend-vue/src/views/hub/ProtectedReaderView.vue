<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { ArrowLeft, Loader2 } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import HubShell from '@/components/catalog/HubShell.vue';
import SecureDocumentViewer, {
  type SecureViewerAccess,
} from '@/components/activities/SecureDocumentViewer.vue';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();

const contentId = computed(() => route.params.id as string);
const access = ref<(SecureViewerAccess & { url?: string; processing_status?: string }) | null>(null);
const isLoading = ref(true);
const error = ref('');

let pollTimer: ReturnType<typeof setInterval> | null = null;

const watermarkText = computed(() => {
  return user.value?.email
    ? `${user.value.email} · Taty's Materials`
    : "Taty's Materials · Exclusive use";
});

async function fetchAccess() {
  if (!contentId.value) return;
  try {
    const data = await apiGet<SecureViewerAccess & { url?: string; processing_status?: string }>(
      `/activities/hub/${contentId.value}/access`
    );

    if (!data.is_secure_viewer && data.url) {
      window.location.replace(data.url);
      return;
    }

    access.value = data;
    error.value = '';

    // If still processing, poll every 2.5s
    if (
      data.is_secure_viewer &&
      (!data.pages || data.pages.length === 0 || data.processing_status === 'processing')
    ) {
      if (!pollTimer) {
        pollTimer = setInterval(fetchAccess, 2500);
      }
    } else {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  } catch (err: any) {
    console.error('Error opening protected material:', err);
    error.value = err?.data?.detail || err?.message || 'Could not open the material.';
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchAccess();
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template>
  <HubShell>
    <div class="mx-auto max-w-4xl p-4 md:p-8">
      <RouterLink
        to="/activities/hub/meus-materiais"
        class="mb-6 inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft :size="16" />
        <span>Back to my materials</span>
      </RouterLink>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Loader2 class="animate-spin text-primary" :size="36" />
        <p class="text-xs font-medium text-text-muted animate-pulse">Opening protected material...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
        <p class="font-bold text-danger text-sm">{{ error }}</p>
        <RouterLink
          to="/activities/hub"
          class="inline-block rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90"
        >
          Back to Taty's Materials
        </RouterLink>
      </div>

      <!-- Material Viewer -->
      <div v-else-if="access">
        <h1 class="mb-6 text-2xl font-black text-text tracking-tight">
          {{ access.title || 'Protected Material' }}
        </h1>
        <SecureDocumentViewer :access="access" :watermark-text="watermarkText" />
      </div>
    </div>
  </HubShell>
</template>
