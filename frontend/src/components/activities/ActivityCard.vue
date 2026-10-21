<script setup lang="ts">
import { computed } from 'vue';
import { Play } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  description: string;
  type?: 'flashcard' | 'exercise' | 'simulation' | 'podcast';
  status?: 'new' | 'done' | 'corrected' | 'pending';
  meta?: Array<{ icon?: any; label: string }>;
  imageUrl?: string;
  emoji?: string;
  actionLabel?: string;
  isOutline?: boolean;
  score?: number;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const statusConfig = {
  new: { label: 'New', className: 'bg-primary/15 text-primary border-primary/30' },
  done: { label: 'Completed', className: 'bg-success/15 text-success border-success/30' },
  corrected: { label: 'Corrected', className: 'bg-info/15 text-info border-info/30' },
  pending: { label: 'Pending', className: 'bg-warning/15 text-warning border-warning/30' },
} as const;

const currentStatusStyle = computed(() => {
  if (!props.status) return null;
  return statusConfig[props.status] || statusConfig.new;
});
</script>

<template>
  <article
    @click="emit('click')"
    class="group bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-primary/50 transition-all cursor-pointer hover:-translate-y-1 shadow-sm hover:shadow-md"
  >
    <!-- Image preview if available -->
    <div
      v-if="imageUrl"
      class="relative aspect-video rounded-xl overflow-hidden bg-bg-secondary mb-1 border border-border/40"
    >
      <img
        :src="imageUrl"
        :alt="title"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div
        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs"
      >
        <div class="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-glow">
          <Play class="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>
    </div>

    <!-- Header & Badges -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-bold text-text leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {{ title }}
        </h3>
        <div v-if="status" class="flex items-center gap-1.5 shrink-0">
          <span
            v-if="score !== undefined"
            class="text-[0.65rem] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-lg shrink-0"
          >
            {{ score }}/100
          </span>
          <span
            v-if="currentStatusStyle"
            class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wider"
            :class="currentStatusStyle.className"
          >
            {{ currentStatusStyle.label }}
          </span>
        </div>
      </div>

      <div v-if="emoji" class="text-3xl py-1 animate-in zoom-in-50 duration-500">
        {{ emoji }}
      </div>
    </div>

    <!-- Description -->
    <p class="text-[0.8rem] text-text-muted line-clamp-2 leading-relaxed">
      {{ description }}
    </p>

    <!-- Meta Details Tags -->
    <div v-if="meta && meta.length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-auto pt-2 border-t border-border/40">
      <div
        v-for="(item, idx) in meta"
        :key="idx"
        class="flex items-center gap-1.5 text-[0.7rem] text-text-subtle font-medium"
      >
        <component v-if="item.icon" :is="item.icon" class="w-3.5 h-3.5 text-text-muted" />
        <span>{{ item.label }}</span>
      </div>
    </div>
  </article>
</template>
