<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { Search, RefreshCw, WifiOff, PackageOpen, AlertCircle } from 'lucide-vue-next';
import { apiGet, HUB_ENDPOINTS, type PremiumCatalogItem } from '@tati/hub-core';
import { useAuthStore } from '@/stores/auth';
import HeroBanner from '@/components/catalog/HeroBanner.vue';
import FilterChips from '@/components/catalog/FilterChips.vue';
import ProductCard from '@/components/catalog/ProductCard.vue';
import CatalogSkeleton from '@/components/catalog/CatalogSkeleton.vue';
import {
  type CatalogMaterial,
  type FilterId,
  filterMaterials,
  searchMaterials,
} from '@/lib/catalog';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const filter = ref<FilterId>('all');
const searchQuery = ref('');
const accessOverrides = ref<Record<string, boolean>>({});
const purchaseError = ref(route.query.error === 'need_purchase');

watch(
  () => route.query.error,
  (err) => {
    purchaseError.value = err === 'need_purchase';
  }
);

function dismissPurchaseError() {
  purchaseError.value = false;
  router.replace({ path: '/materiais', query: {} });
}

const {
  data: catalogData,
  isLoading: isCatalogLoading,
  isError: isCatalogError,
  refetch: refetchCatalog,
} = useQuery({
  queryKey: ['hub-catalog'],
  queryFn: () => apiGet<CatalogMaterial[]>('/catalog'),
  staleTime: 5 * 60 * 1000,
});

const { data: authenticatedCatalog } = useQuery({
  queryKey: computed(() => ['hub-public-catalog', authStore.user?.id || authStore.user?.username]),
  queryFn: () => apiGet<PremiumCatalogItem[]>(HUB_ENDPOINTS.HUB_PUBLIC),
  enabled: computed(() => Boolean(authStore.token) && Boolean(authStore.user)),
  staleTime: 5 * 60 * 1000,
});

function mergeAccess(
  base: CatalogMaterial[] | null,
  authenticated: PremiumCatalogItem[] | null,
): CatalogMaterial[] {
  const safeBase = base || [];
  if (!authenticated) return safeBase;
  const accessMap = new Map(authenticated.map((item) => [item.id, item.has_access]));
  return safeBase.map((item) => ({
    ...item,
    has_access: accessMap.get(item.id) ?? item.has_access,
  }));
}

const items = computed(() => {
  const merged = mergeAccess(catalogData.value ?? [], authenticatedCatalog.value ?? null) || [];
  return merged.map((item) =>
    accessOverrides.value[item.id] ? { ...item, has_access: true } : item
  );
});

function handleAccessGranted(id: string) {
  accessOverrides.value = { ...accessOverrides.value, [id]: true };
}

const categoryFiltered = computed(() => filterMaterials(items.value, filter.value));
const searchFiltered = computed(() => searchMaterials(categoryFiltered.value, searchQuery.value));

const featured = computed(() =>
  searchFiltered.value.filter(
    (item) => item.is_featured && filter.value === 'all' && !searchQuery.value.trim()
  )
);

const owned = computed(() =>
  searchFiltered.value.filter((item) => item.has_access)
);

const remaining = computed(() => {
  if (filter.value === 'all' && !searchQuery.value.trim()) {
    const featuredIds = new Set(featured.value.map((f) => f.id));
    return searchFiltered.value.filter((item) => !featuredIds.has(item.id));
  }
  return searchFiltered.value;
});
</script>

<template>
  <div class="space-y-8 px-4 pt-6 md:px-8">
    <!-- Aviso de Acesso Restrito (Quando redirecionado de link de material não comprado) -->
    <div
      v-if="purchaseError"
      class="flex items-center justify-between rounded-hub border border-danger/30 bg-danger/10 p-4 text-danger animate-fade-in shadow-sm"
    >
      <div class="flex items-center gap-3">
        <AlertCircle :size="20" class="flex-shrink-0 text-danger" />
        <div>
          <p class="text-sm font-bold text-danger">Acesso restrito: você precisa adquirir este material para poder acessá-lo.</p>
          <p class="text-xs text-text-muted mt-0.5">Escolha o material desejado abaixo no catálogo para concluir sua compra com segurança.</p>
        </div>
      </div>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-bold text-danger hover:bg-danger/10 transition"
        aria-label="Fechar aviso"
        @click="dismissPurchaseError"
      >
        ✕ Fechar
      </button>
    </div>

    <!-- Banner de Destaque -->
    <HeroBanner />

    <!-- Busca e Filtros -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <FilterChips :active="filter" @change="filter = $event" />

      <div class="relative w-full sm:w-64">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
          :size="16"
          aria-hidden="true"
        />
        <input
          v-model="searchQuery"
          placeholder="Buscar no catálogo..."
          class="input-hub w-full pl-9 pr-3 text-xs"
          aria-label="Buscar materiais"
        />
      </div>
    </div>

    <!-- Estado de Carregamento -->
    <CatalogSkeleton v-if="isCatalogLoading" />

    <!-- Estado de Erro -->
    <div
      v-else-if="isCatalogError"
      class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center"
    >
      <WifiOff :size="40" class="mb-4 text-subtle" :stroke-width="1.5" />
      <p class="text-base font-semibold text-ink">Não foi possível carregar os materiais.</p>
      <p class="mt-1 text-sm text-muted">Verifique sua conexão e tente novamente.</p>
      <button
        type="button"
        class="btn-primary mt-5 flex items-center gap-2"
        @click="refetchCatalog()"
      >
        <RefreshCw :size="14" />
        Tentar novamente
      </button>
    </div>

    <!-- Catálogo Carregado -->
    <div v-else-if="searchFiltered.length" class="space-y-10">
      <!-- Seção: Meus Materiais Disponíveis (se logado e tiver acesso) -->
      <section v-if="owned.length && authStore.user" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Liberados para Você</h2>
          <router-link to="/meus-materiais" class="text-xs font-semibold text-primary hover:underline">
            Ver todos
          </router-link>
        </div>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <ProductCard
            v-for="item in owned.slice(0, 3)"
            :key="item.id"
            :item="item"
            :show-owned="true"
            @access-granted="handleAccessGranted(item.id)"
          />
        </div>
      </section>

      <!-- Seção: Destaques -->
      <section v-if="featured.length" class="space-y-4">
        <h2 class="section-title">Destaques da Tati</h2>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <ProductCard
            v-for="item in featured"
            :key="item.id"
            :item="item"
            :show-owned="Boolean(item.has_access)"
            @access-granted="handleAccessGranted(item.id)"
          />
        </div>
      </section>

      <!-- Seção: Todos os Materiais -->
      <section class="space-y-4">
        <h2 class="section-title">
          {{ filter === 'all' && !searchQuery.trim() ? 'Todos os Materiais' : 'Resultados' }}
        </h2>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <ProductCard
            v-for="item in remaining"
            :key="item.id"
            :item="item"
            :show-owned="Boolean(item.has_access)"
            @access-granted="handleAccessGranted(item.id)"
          />
        </div>
      </section>
    </div>

    <!-- Estado Vazio -->
    <div
      v-else
      class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-16 text-center"
    >
      <PackageOpen :size="40" class="mb-4 text-subtle" :stroke-width="1.5" />
      <p class="text-base font-semibold text-ink">Nenhum material encontrado com esses filtros.</p>
      <p class="mt-1 text-sm text-muted">Tente buscar por outro termo ou categoria.</p>
    </div>
  </div>
</template>
