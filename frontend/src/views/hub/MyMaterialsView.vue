<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { BookOpen, Loader2 } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import HubShell from '@/components/catalog/HubShell.vue';
import ProductCard from '@/components/catalog/ProductCard.vue';
import type { CatalogMaterial } from '@/types/catalog';

const { user } = useAuth();
const items = ref<CatalogMaterial[]>([]);
const isLoading = ref(true);

async function loadMyMaterials() {
  if (!user.value) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const list = await apiGet<CatalogMaterial[]>('/activities/hub');
    items.value = (list || []).filter((item) => item.has_access);
  } catch (err) {
    console.error('Error fetching my materials:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadMyMaterials();
});
</script>

<template>
  <HubShell>
    <div class="space-y-8 p-4 md:p-8">
      <div>
        <h1 class="text-3xl font-black text-text tracking-tight">My Materials</h1>
        <p class="mt-1 text-sm text-text-muted">Your personal library of exclusive content.</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex min-h-[40vh] items-center justify-center">
        <Loader2 class="animate-spin text-primary" :size="36" />
      </div>

      <!-- Not Logged In State -->
      <div v-else-if="!user" class="mx-auto max-w-lg p-10 text-center rounded-2xl border border-border bg-surface">
        <h2 class="text-xl font-bold text-text mb-2">My Materials</h2>
        <p class="text-sm text-text-muted mb-6">Sign in to your account to view your library.</p>
        <RouterLink to="/login" class="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md">
          Sign in
        </RouterLink>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="items.length === 0"
        class="flex flex-col items-center rounded-2xl border border-border bg-surface p-12 text-center"
      >
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen :size="32" />
        </div>
        <h2 class="text-xl font-bold text-text">Your library is empty</h2>
        <p class="mt-2 max-w-md text-xs text-text-muted">
          You haven't acquired any materials yet. Explore the gallery to get started.
        </p>
        <RouterLink
          to="/activities/hub"
          class="mt-6 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          Explore Gallery
        </RouterLink>
      </div>

      <!-- Materials Grid -->
      <div v-else class="space-y-4">
        <p class="text-xs font-bold text-text-muted">{{ items.length }} material(s) available</p>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <ProductCard
            v-for="item in items"
            :key="item.id"
            :item="item"
            :show-owned="true"
          />
        </div>
      </div>
    </div>
  </HubShell>
</template>
