<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  BookOpen,
  MessageCircle,
  Plane,
  Briefcase,
  PenLine,
  Library,
  Sparkles,
} from 'lucide-vue-next';
import CheckoutFlow from '@/components/CheckoutFlow.vue';
import {
  type CatalogMaterial,
  type MaterialCategory,
  categoryLabel,
  categoryStyles,
  normalizeCategory,
  resolvePrice,
  formatPrice,
} from '@/lib/catalog';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  item: CatalogMaterial;
  showOwned?: boolean;
}>();

const emit = defineEmits<{
  (e: 'accessGranted'): void;
}>();

const authStore = useAuthStore();
const imageError = ref(false);

const category = computed(() => normalizeCategory(props.item.category));
const styles = computed(() => categoryStyles(category.value));

const categoryIcons = {
  grammar: BookOpen,
  speaking: MessageCircle,
  travel: Plane,
  business: Briefcase,
  vocabulary: Library,
  writing: PenLine,
  other: Sparkles,
};

const currentIcon = computed(() => categoryIcons[category.value] || Sparkles);

// Somente usuários logados e que realmente possuem acesso adquirido podem ler diretamente.
// Se deslogado ou não comprou, o botão SEMPRE será o de Comprar (CheckoutFlow).
const canRead = computed(() => {
  return Boolean(authStore.user) && Boolean(props.item.has_access || props.showOwned);
});

// Resolve o preço:
// - Deslogado: valor de comprador / hub (ex: R$ 9,99)
// - Aluno: valor de aluno (ex: R$ 5,00)
// - Usuário apenas do Hub: valor de hub (ex: R$ 9,99)
const price = computed(() => resolvePrice(props.item, authStore.user));
const priceLabel = computed(() => formatPrice(price.value));

const preview = computed(() => {
  const rawPreview = props.item.preview_url || props.item.thumbnail_url;
  if (!rawPreview) return null;
  if (rawPreview.startsWith('http')) return rawPreview;
  const storageUrl = 'https://gkziqqjswecteekanwnv.supabase.co/storage/v1/object/public/hub-secure-pages';
  return `${storageUrl}/${rawPreview.replace(/^\/+/, '')}`;
});
</script>

<template>
  <article class="card-surface flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-glow">
    <!-- Header -->
    <div :class="['flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider', styles.header]">
      <span>{{ categoryLabel(category) }}</span>
      <span>{{ priceLabel }}</span>
    </div>

    <!-- Content (Link para ler apenas se canRead for true) -->
    <router-link
      v-if="canRead"
      :to="`/materiais/${item.id}/ler`"
      class="block cursor-pointer transition-opacity hover:opacity-90"
    >
      <div class="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-primarySoft">
        <img
          v-if="preview && !imageError"
          :src="preview"
          :alt="item.title"
          class="h-full w-full object-cover"
          @error="imageError = true"
        />
        <div v-else :class="['flex h-full items-center justify-center', styles.icon]">
          <component :is="currentIcon" :size="40" :stroke-width="1.5" />
        </div>
      </div>
      <div class="px-4 pb-4 pt-3">
        <h3 class="font-display text-lg font-bold text-ink line-clamp-2">{{ item.title }}</h3>
        <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {{ item.description || "Material exclusivo curado por Taty's Materials." }}
        </p>
      </div>
    </router-link>

    <!-- Content (Estático se não comprou ou deslogado) -->
    <div v-else class="block cursor-default">
      <div class="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-primarySoft">
        <img
          v-if="preview && !imageError"
          :src="preview"
          :alt="item.title"
          class="h-full w-full object-cover"
          @error="imageError = true"
        />
        <div v-else :class="['flex h-full items-center justify-center', styles.icon]">
          <component :is="currentIcon" :size="40" :stroke-width="1.5" />
        </div>
      </div>
      <div class="px-4 pb-4 pt-3">
        <h3 class="font-display text-lg font-bold text-ink line-clamp-2">{{ item.title }}</h3>
        <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {{ item.description || "Material exclusivo curado por Taty's Materials." }}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-auto flex items-center justify-between border-t border-line px-4 py-3">
      <span class="text-sm font-bold text-ink">{{ priceLabel }}</span>

      <!-- Se comprou e está logado: Ler agora -->
      <router-link
        v-if="canRead"
        :to="`/materiais/${item.id}/ler`"
        class="rounded-hub bg-success/10 px-3 py-1.5 text-xs font-bold text-success transition hover:bg-success/20"
      >
        Ler agora
      </router-link>

      <!-- Se NÃO comprou ou deslogado: Botão de Compra -->
      <div v-else class="flex-shrink-0">
        <CheckoutFlow
          :item="{ id: item.id, title: item.title, price }"
          @access-granted="emit('accessGranted')"
        />
      </div>
    </div>
  </article>
</template>
