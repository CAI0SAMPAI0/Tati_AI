<script setup lang="ts">
import { ref, watch } from 'vue';
import { Star, MessageSquareHeart, Send, Loader2, X } from 'lucide-vue-next';
import { apiPost } from '@/api/client';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    defaultArea?: string;
    activityId?: string;
    activityTitle?: string;
    cefrLevel?: string;
  }>(),
  {
    defaultArea: 'general',
    activityId: '',
    activityTitle: '',
    cefrLevel: 'A1',
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const toast = useToast();
const area = ref(props.defaultArea);
const rating = ref(5);
const comment = ref('');
const hoverRating = ref<number | null>(null);
const isSubmitting = ref(false);

const AREAS = [
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'games', label: 'Jogos / Games' },
  { id: 'grammar', label: 'Gramática' },
  { id: 'listening', label: 'Listening / Áudio' },
  { id: 'reading', label: 'Reading / Leituras' },
  { id: 'simulations', label: 'Simulações com IA' },
  { id: 'music', label: 'Músicas / LingoClip' },
  { id: 'general', label: 'Geral / Aulas' },
];

watch(
  () => props.defaultArea,
  (newArea) => {
    if (newArea) area.value = newArea;
  }
);

async function handleSubmit() {
  if (!comment.value.trim()) {
    toast.error('Por favor, escreva uma mensagem ou sugestão.');
    return;
  }

  isSubmitting.value = true;
  try {
    await apiPost('/activities/student-feedback', {
      area: area.value,
      activity_id: props.activityId,
      activity_title: props.activityTitle,
      rating: rating.value,
      comment: comment.value.trim(),
      cefr_level: props.cefrLevel,
    });

    toast.success('Feedback enviado para a Professora Tatiana! Obrigado!');
    comment.value = '';
    emit('close');
  } catch (err) {
    toast.error('Erro ao enviar feedback. Tente novamente.');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      @click="emit('close')"
    >
      <div
        class="relative w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border/40 pb-3">
          <div class="flex items-center gap-2">
            <MessageSquareHeart class="w-5 h-5 text-primary" />
            <h3 class="font-bold text-base text-text">Enviar Feedback para a Tatiana</h3>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <MessageSquareHeart class="w-4 h-4" />
            </div>
            <p class="text-xs text-text-subtle leading-relaxed">
              Sua opinião é fundamental para a Teacher Tatiana personalizar seus conteúdos e atividades!
            </p>
          </div>

          <!-- Area -->
          <div>
            <label class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Área / Categoria
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="a in AREAS"
                :key="a.id"
                type="button"
                @click="area = a.id"
                class="px-3 py-2 rounded-xl text-xs font-bold border text-left transition-all"
                :class="
                  area === a.id
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-bg border-border text-text-muted hover:text-text hover:border-primary/40'
                "
              >
                {{ a.label }}
              </button>
            </div>
          </div>

          <!-- Star Rating -->
          <div>
            <label class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Sua Avaliação (1 a 5 estrelas)
            </label>
            <div class="flex items-center gap-2">
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                @click="rating = star"
                @mouseenter="hoverRating = star"
                @mouseleave="hoverRating = null"
                class="p-1 text-amber-400 hover:scale-110 active:scale-95 transition-all"
              >
                <Star
                  class="w-6 h-6"
                  :class="[
                    (hoverRating !== null ? star <= hoverRating : star <= rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-border fill-transparent'
                  ]"
                />
              </button>
            </div>
          </div>

          <!-- Comment input -->
          <div>
            <label class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Mensagem ou sugestão
            </label>
            <textarea
              v-model="comment"
              rows="3"
              placeholder="Conte o que achou ou deixe sugestões para a Tatiana..."
              class="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text text-xs outline-none focus:border-primary transition-colors resize-none"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="ghost" size="sm" type="button" @click="emit('close')">
              Cancelar
            </Button>
            <Button size="sm" type="submit" :loading="isSubmitting" class="gap-1.5">
              <Send class="w-3.5 h-3.5" />
              <span>Enviar Feedback</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
