<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { ArrowLeft } from 'lucide-vue-next';
import { fetchSecureAccess, type SecureViewerAccess } from '@tati/hub-core';
import { useAuthStore } from '@/stores/auth';
import SecureDocumentViewer from '@/components/secure/SecureDocumentViewer.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const contentId = computed(() => route.params.id as string);

// Se a pessoa tentar entrar deslogada, redireciona imediatamente para a home informando a necessidade de compra
watch(
  () => [authStore.isLoaded, authStore.user],
  ([loaded, user]) => {
    if (loaded && !user) {
      router.replace({
        path: '/materiais',
        query: {
          error: 'need_purchase',
          material: contentId.value,
        },
      });
    }
  },
  { immediate: true }
);

const { data: access, error, isLoading } = useQuery<SecureViewerAccess>({
  queryKey: computed(() => ['hub-secure-access', contentId.value, authStore.user?.id || authStore.user?.username]),
  queryFn: async () => {
    try {
      const data = await fetchSecureAccess(contentId.value);
      // Se não for visualizador seguro e não tiver url (ou seja, sem acesso adquirido)
      if (!data.is_secure_viewer && !data.url) {
        throw new Error('Você precisa comprar este material para acessá-lo.');
      }
      if (!data.is_secure_viewer && data.url) {
        window.location.replace(data.url);
      }
      return data;
    } catch (err: any) {
      // Se a pessoa tentar entrar sem ter comprado (erro 403 / não autorizado), redireciona para a home
      router.replace({
        path: '/materiais',
        query: {
          error: 'need_purchase',
          material: contentId.value,
        },
      });
      throw err;
    }
  },
  enabled: computed(() => authStore.isLoaded && Boolean(authStore.token) && Boolean(authStore.user)),
  refetchInterval: (query: any) => {
    const res = query.state.data as any;
    if (res?.is_secure_viewer && (!res.pages || res.pages.length === 0 || res.processing_status === 'processing')) {
      return 2000;
    }
    return false;
  },
  retry: false,
});

// Watch adicional: se houver erro na query, garante o redirecionamento imediato
watch(error, (err) => {
  if (err) {
    router.replace({
      path: '/materiais',
      query: {
        error: 'need_purchase',
        material: contentId.value,
      },
    });
  }
});

const watermarkText = computed(() =>
  authStore.user?.email ? `${authStore.user.email} · Taty's Materials` : "Taty's Materials · Uso exclusivo"
);
</script>

<template>
  <div class="mx-auto max-w-5xl p-4 md:p-8">
    <router-link
      to="/meus-materiais"
      class="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary"
    >
      <ArrowLeft :size="16" />
      Voltar para meus materiais
    </router-link>

    <div v-if="isLoading" class="flex min-h-[40vh] items-center justify-center">
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>

    <div v-else-if="error" class="card-surface p-8 text-center">
      <p class="text-danger font-semibold">
        Você precisa comprar este material para acessá-lo.
      </p>
      <router-link to="/materiais" class="btn-primary mt-6 inline-block">
        Ver catálogo e adquirir
      </router-link>
    </div>

    <div v-else-if="access">
      <h1 class="section-title mb-6 text-2xl">{{ access.title || 'Material' }}</h1>
      <SecureDocumentViewer :access="access" :watermark-text="watermarkText" />
    </div>
  </div>
</template>
