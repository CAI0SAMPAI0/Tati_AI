<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookOpen,
  MessageCircle,
  Plane,
  Briefcase,
  PenLine,
  Library,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-vue-next';
import {
  type CatalogMaterial,
  type MaterialCategory,
  categoryLabel,
  categoryStyles,
  normalizeCategory,
  resolvePrice,
  formatPrice,
} from '@/types/catalog';
import { useAuth } from '@/composables/useAuth';
import CheckoutFlow from './CheckoutFlow.vue';

const props = defineProps<{
  item: CatalogMaterial;
  showOwned?: boolean;
}>();

const emit = defineEmits<{
  (e: 'accessGranted'): void;
}>();

const router = useRouter();
const { user } = useAuth();
const imageError = ref(false);
const isCheckoutOpen = ref(false);

const category = computed<MaterialCategory>(() => normalizeCategory(props.item.category));
const styles = computed(() => categoryStyles(category.value));

const price = computed(() => resolvePrice(props.item, user.value?.role));
const priceLabel = computed(() => formatPrice(price.value));

const preview = computed(() => {
  const rawPreview = props.item.preview_url || props.item.thumbnail_url;
  if (!rawPreview) return null;
  if (rawPreview.startsWith('http')) return rawPreview;
  const storageUrl = 'https://gkziqqjswecteekanwnv.supabase.co/storage/v1/object/public/hub-secure-pages';
  return `${storageUrl}/${rawPreview.replace(/^\/+/, '')}`;
});

function handleCardClick() {
  if (props.showOwned || props.item.has_access) {
    router.push(`/activities/hub/${props.item.id}/ler`);
  } else {
    isCheckoutOpen.value = true;
  }
}

function handleAccessGranted() {
  emit('accessGranted');
}
</script>

<template>
  <article
    class="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
    @click="handleCardClick"
  >
    <!-- Card Category & Price Banner -->
    <div :class="['flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider', styles.header]">
      <span>{{ categoryLabel(category) }}</span>
      <span>{{ priceLabel }}</span>
    </div>

    <!-- Thumbnail / Preview -->
    <div class="relative mx-4 mt-4 aspect-4/3 overflow-hidden rounded-xl bg-bgSecondary">
      <img
        v-if="preview && !imageError"
        :src="preview"
        :alt="item.title"
        class="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        @error="imageError = true"
      />
      <div v-else :class="['flex h-full w-full items-center justify-center', styles.icon]">
        <BookOpen v-if="category === 'grammar'" :size="36" :stroke-width="1.5" />
        <MessageCircle v-else-if="category === 'speaking'" :size="36" :stroke-width="1.5" />
        <Plane v-else-if="category === 'travel'" :size="36" :stroke-width="1.5" />
        <Briefcase v-else-if="category === 'business'" :size="36" :stroke-width="1.5" />
        <Library v-else-if="category === 'vocabulary'" :size="36" :stroke-width="1.5" />
        <PenLine v-else-if="category === 'writing'" :size="36" :stroke-width="1.5" />
        <Sparkles v-else :size="36" :stroke-width="1.5" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 flex-col justify-between p-4">
      <div>
        <h3 class="font-bold text-text text-base line-clamp-2">{{ item.title }}</h3>
        <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
          {{ item.description || "Exclusive material curated by Teacher Tati's English Method." }}
        </p>
      </div>

      <div class="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <span v-if="showOwned || item.has_access" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <span>Read Material</span>
          <ArrowRight :size="14" />
        </span>
        <span v-else class="text-xs font-bold text-primary flex items-center gap-1">
          <Lock :size="12" />
          <span>Acquire ({{ priceLabel }})</span>
        </span>
      </div>
    </div>

    <!-- Checkout Modal Portal -->
    <CheckoutFlow
      :item="{ id: item.id, title: item.title, price: price }"
      :is-open="isCheckoutOpen"
      @close="isCheckoutOpen = false"
      @access-granted="handleAccessGranted"
    />
  </article>
</template>
