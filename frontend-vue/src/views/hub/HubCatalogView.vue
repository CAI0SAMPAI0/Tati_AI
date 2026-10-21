<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Search, Loader2 } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import HubShell from '@/components/catalog/HubShell.vue';
import HeroBanner from '@/components/catalog/HeroBanner.vue';
import FilterChips from '@/components/catalog/FilterChips.vue';
import ProductCard from '@/components/catalog/ProductCard.vue';
import {
  type CatalogMaterial,
  type FilterId,
  filterMaterials,
  searchMaterials,
} from '@/types/catalog';

const { user } = useAuth();
const materials = ref<CatalogMaterial[]>([]);
const userAccesses = ref<Map<string, boolean>>(new Map());
const isLoading = ref(true);
const isError = ref(false);

const activeFilter = ref<FilterId>('all');
const searchQuery = ref('');

async function loadCatalog() {
  isLoading.value = true;
  isError.value = false;
  try {
    const [catRes, userRes] = await Promise.all([
      apiGet<CatalogMaterial[]>('/catalog').catch(() => []),
      user.value ? apiGet<any[]>('/activities/hub').catch(() => []) : Promise.resolve([]),
    ]);

    const accessMap = new Map<string, boolean>();
    if (Array.isArray(userRes)) {
      userRes.forEach((item) => {
        if (item.id) accessMap.set(item.id, Boolean(item.has_access));
      });
    }
    userAccesses.value = accessMap;

    materials.value = (catRes || []).map((m) => ({
      ...m,
      has_access: accessMap.get(m.id) ?? m.has_access ?? false,
    }));
  } catch (err) {
    console.error('Error loading hub catalog:', err);
    isError.value = true;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadCatalog();
});

const filteredMaterials = computed(() => {
  const byCategory = filterMaterials(materials.value, activeFilter.value);
  return searchMaterials(byCategory, searchQuery.value);
});

const featuredMaterials = computed(() => {
  return filteredMaterials.value.filter(
    (m) => m.is_featured && activeFilter.value === 'all' && !searchQuery.value.trim()
  );
});

const showSections = computed(() => {
  return activeFilter.value === 'all' && !searchQuery.value.trim();
});

function handleAccessGranted(id?: string) {
  if (id) {
    const item = materials.value.find((m) => m.id === id);
    if (item) item.has_access = true;
  }
  loadCatalog();
}
</script>

<template>
  <HubShell>
    <div class="space-y-8 p-4 md:p-8">
      <HeroBanner />

      <!-- Controls: Filter Chips + Search -->
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <FilterChips v-model:active="activeFilter" />

        <div class="relative w-full md:w-72">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            v-model="searchQuery"
            type="search"
            class="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-2 text-xs text-text focus:border-primary focus:outline-hidden transition-colors"
            placeholder="Search materials..."
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex min-h-[40vh] items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="animate-spin text-primary" :size="36" />
          <p class="text-xs font-semibold text-text-muted">Loading materials catalog...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="isError" class="p-10 text-center text-text-muted rounded-2xl border border-border bg-surface">
        <p class="text-sm">Could not load the catalog. Please verify that the backend service is running.</p>
        <button
          @click="loadCatalog"
          class="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          Try Again
        </button>
      </div>

      <!-- Catalog Sections -->
      <div v-else class="space-y-10">
        <!-- Featured Section -->
        <section v-if="showSections && featuredMaterials.length > 0" class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-black text-text tracking-tight">Em destaque</h2>
          </div>
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <ProductCard
              v-for="item in featuredMaterials"
              :key="item.id"
              :item="item"
              @access-granted="handleAccessGranted(item.id)"
            />
          </div>
        </section>

        <!-- All Materials / Search Results -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-black text-text tracking-tight">
              {{ showSections ? 'Todos os materiais' : 'Resultados da busca' }}
            </h2>
            <span class="text-xs font-bold text-text-muted">
              {{ filteredMaterials.length }} material(s)
            </span>
          </div>

          <div
            v-if="filteredMaterials.length === 0"
            class="text-center py-20 text-text-muted border-2 border-dashed border-border rounded-2xl bg-surface/50"
          >
            <p class="text-sm font-semibold">No materials found matching your filters.</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <ProductCard
              v-for="item in filteredMaterials"
              :key="item.id"
              :item="item"
              @access-granted="handleAccessGranted(item.id)"
            />
          </div>
        </section>
      </div>
    </div>
  </HubShell>
</template>
