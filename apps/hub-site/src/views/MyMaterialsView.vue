<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { BookOpen } from 'lucide-vue-next';
import { apiGet, HUB_ENDPOINTS, type PremiumCatalogItem } from '@tati/hub-core';
import { useAuthStore } from '@/stores/auth';
import ProductCard from '@/components/catalog/ProductCard.vue';
import type { CatalogMaterial } from '@/lib/catalog';

const authStore = useAuthStore();

const query = useQuery<CatalogMaterial[]>({
  queryKey: computed(() => ['hub-my-materials', authStore.user?.id || authStore.user?.username]),
  queryFn: () =>
    apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC).then((catalog) =>
      catalog
        .filter((entry) => entry.has_access)
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          description: entry.description,
          price: entry.price,
          thumbnail_url: entry.thumbnail_url,
          preview_url: entry.preview_url ?? entry.thumbnail_url,
          category: entry.category,
          is_featured: entry.is_featured,
          has_access: true,
        }))
    ),
  enabled: computed(() => authStore.isLoaded && Boolean(authStore.token) && Boolean(authStore.user)),
});

const items = computed<CatalogMaterial[]>(() => query.data.value ?? []);
const isLoading = computed(() => query.isLoading.value);
</script>

<template>
  <div v-if="!authStore.isLoaded || isLoading" class="flex min-h-[50vh] items-center justify-center p-10">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>

  <div v-else-if="!authStore.user" class="mx-auto max-w-lg p-10 text-center">
    <h1 class="section-title mb-3">Meus Materiais</h1>
    <p class="mb-6 text-muted">Entre na sua conta para ver sua biblioteca de estudos.</p>
    <router-link to="/login" class="btn-primary inline-block">
      Entrar
    </router-link>
  </div>

  <div v-else-if="!items.length" class="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
    <div>
      <h1 class="section-title text-3xl">Meus Materiais</h1>
      <p class="mt-2 text-muted">Sua biblioteca pessoal de conteúdos exclusivos.</p>
    </div>
    <div class="card-surface flex flex-col items-center p-10 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-hub bg-primarySoft text-primary">
        <BookOpen :size="32" />
      </div>
      <h2 class="font-display text-xl font-bold text-ink">Sua biblioteca está vazia</h2>
      <p class="mt-2 max-w-md text-sm text-muted">
        Você ainda não adquiriu nenhum material. Explore a galeria para começar.
      </p>
      <router-link to="/materiais" class="btn-primary mt-6">
        Explorar galeria
      </router-link>
    </div>
  </div>

  <div v-else class="space-y-8 p-6 md:p-10">
    <div>
      <h1 class="section-title text-3xl">Meus Materiais</h1>
      <p class="mt-2 text-muted">{{ items.length }} material(is) disponível(is)</p>
    </div>
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <ProductCard v-for="item in items" :key="item.id" :item="item" :show-owned="true" />
    </div>
  </div>
</template>
