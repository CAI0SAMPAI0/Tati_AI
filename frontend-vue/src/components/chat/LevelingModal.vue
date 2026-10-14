<script setup lang="ts">
import { ref } from 'vue';
import {
  ClipboardCheck,
  Clock,
  MessageSquare,
  Mic,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Loader2,
} from 'lucide-vue-next';

interface OptionCard {
  count: number;
  label: string;
  time: string;
  desc: string;
  recommended?: boolean;
}

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'start', totalQuestions: number, mode: 'chat' | 'voice'): void;
}>();

const QUESTION_OPTIONS: OptionCard[] = [
  {
    count: 4,
    label: '4 Perguntas',
    time: '~3 min',
    desc: 'Expresso • 1 pergunta por nível (A1, A2, B1, B2)',
  },
  {
    count: 8,
    label: '8 Perguntas',
    time: '~6 min',
    desc: 'Rápido • 2 perguntas por nível (A1, A2, B1, B2)',
    recommended: true,
  },
  {
    count: 12,
    label: '12 Perguntas',
    time: '~10 min',
    desc: 'Padrão • 3 perguntas por nível (A1, A2, B1, B2)',
  },
  {
    count: 16,
    label: '16 Perguntas',
    time: '~15 min',
    desc: 'Completo • 4 perguntas por nível (A1, A2, B1, B2)',
  },
  {
    count: 20,
    label: '20 Perguntas',
    time: '~20 min',
    desc: 'Aprofundado • 5 perguntas por nível (A1, A2, B1, B2)',
  },
];

const selectedCount = ref<number>(8);
const customValue = ref<string>('');
const isCustom = ref<boolean>(false);
const mode = ref<'chat' | 'voice'>('chat');

function handleSelect(count: number) {
  selectedCount.value = count;
  isCustom.value = false;
}

function handleCustomChange(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  customValue.value = val;
  const num = parseInt(val, 10);
  if (!isNaN(num) && num >= 4 && num <= 24) {
    selectedCount.value = num;
  }
}

function handleConfirm() {
  const finalCount = isCustom.value && customValue.value ? parseInt(customValue.value, 10) : selectedCount.value;
  const safeCount = Math.max(4, Math.min(24, isNaN(finalCount) ? 8 : finalCount));
  emit('start', safeCount, mode.value);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      @click="emit('close')"
    >
      <div
        class="relative w-full max-w-xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mx-auto animate-zoom-in"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-line bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-xs">
              <ClipboardCheck :size="22" :stroke-width="2.2" />
            </div>
            <div>
              <h2 class="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
                Desafio de Nivelamento CEFR
              </h2>
              <p class="text-xs text-muted">
                Avaliação oficial de proficiência (A1 a B2) com a Teacher Tati
              </p>
            </div>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgSecondary transition cursor-pointer"
            :disabled="loading"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto space-y-5 no-scrollbar">
          <!-- Formato da Avaliação -->
          <div>
            <label class="block text-sm font-semibold text-ink mb-1.5">
              Escolha o formato da avaliação
            </label>
            <p class="text-xs text-muted mb-3">
              Selecione se prefere digitar no chat ou falar ao vivo no modo de voz.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                class="relative text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer"
                :class="
                  mode === 'chat'
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-line bg-surface hover:bg-bgSecondary'
                "
                @click="mode = 'chat'"
              >
                <div
                  class="p-2 rounded-lg shrink-0"
                  :class="mode === 'chat' ? 'bg-primary text-white' : 'bg-bgSecondary text-muted'"
                >
                  <MessageSquare :size="18" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-ink">Modo Chat</span>
                    <span
                      v-if="mode === 'chat'"
                      class="text-[0.65rem] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded-full"
                    >
                      Selecionado
                    </span>
                  </div>
                  <p class="text-xs text-muted mt-1 leading-relaxed">
                    Chat interativo com suporte a texto e envio de áudio gravado.
                  </p>
                </div>
              </button>

              <button
                type="button"
                class="relative text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer"
                :class="
                  mode === 'voice'
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-line bg-surface hover:bg-bgSecondary'
                "
                @click="mode = 'voice'"
              >
                <div
                  class="p-2 rounded-lg shrink-0"
                  :class="mode === 'voice' ? 'bg-primary text-white' : 'bg-bgSecondary text-muted'"
                >
                  <Mic :size="18" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-ink">Modo de Voz</span>
                    <span
                      v-if="mode === 'voice'"
                      class="text-[0.65rem] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded-full"
                    >
                      Selecionado
                    </span>
                  </div>
                  <p class="text-xs text-muted mt-1 leading-relaxed">
                    Conversação falada ao vivo com áudio e reconhecimento em tempo real.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <!-- Quantidade de Perguntas -->
          <div>
            <label class="block text-sm font-semibold text-ink mb-1.5">
              Quantas perguntas você deseja responder?
            </label>
            <p class="text-xs text-muted mb-3">
              As perguntas são balanceadas entre os níveis CEFR (A1, A2, B1 e B2).
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                v-for="opt in QUESTION_OPTIONS"
                :key="opt.count"
                type="button"
                class="relative text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer"
                :class="
                  !isCustom && selectedCount === opt.count
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-line bg-surface hover:bg-bgSecondary'
                "
                @click="handleSelect(opt.count)"
              >
                <span
                  v-if="opt.recommended"
                  class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-primary text-white shadow-xs"
                >
                  Recomendado
                </span>
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="font-bold text-sm text-ink">{{ opt.label }}</span>
                  <span class="text-xs text-muted flex items-center gap-1">
                    <Clock :size="12" /> {{ opt.time }}
                  </span>
                </div>
                <p class="text-xs text-muted leading-relaxed">{{ opt.desc }}</p>
              </button>

              <!-- Custom number -->
              <div
                class="p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer"
                :class="
                  isCustom
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                    : 'border-line bg-surface hover:bg-bgSecondary'
                "
                @click="isCustom = true"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-sm text-ink">Personalizado</span>
                  <span class="text-xs text-muted">4 a 24</span>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="4"
                    max="24"
                    placeholder="Ex: 10"
                    :value="customValue"
                    class="w-full px-3 py-1.5 text-xs rounded-lg border border-line bg-bg text-ink focus:outline-none focus:border-primary"
                    @input="handleCustomChange"
                    @focus="isCustom = true"
                  />
                  <span class="text-xs text-muted shrink-0">perguntas</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Dicas e Instruções -->
          <div class="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            <div class="flex items-start gap-2.5 text-xs text-ink">
              <CheckCircle2 :size="16" class="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Direto e objetivo:</strong> A Teacher Tati avalia suas respostas com feedback gramatical rápido e avança para a próxima pergunta.
              </span>
            </div>
            <div class="flex items-start gap-2.5 text-xs text-ink">
              <AlertCircle :size="16" class="text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Comando /finish:</strong> Deseja encerrar mais cedo? Basta digitar ou falar <code class="px-1.5 py-0.5 rounded bg-bg border border-line font-mono font-bold text-primary">/finish</code> a qualquer momento. Suas respostas serão avaliadas até onde você respondeu.
              </span>
            </div>
            <div class="flex items-start gap-2.5 text-xs text-ink">
              <Sparkles :size="16" class="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Diagnóstico com CEFR oficial:</strong> Ao concluir, seu nível será calculado e você receberá as correções pedagógicas completas.
              </span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-line bg-surface flex items-center justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl border border-line hover:bg-bgSecondary text-muted hover:text-ink transition cursor-pointer"
            :disabled="loading"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primaryHover transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            :disabled="loading"
            @click="handleConfirm"
          >
            <Loader2 v-if="loading" :size="15" class="animate-spin" />
            <component :is="mode === 'voice' ? Mic : ClipboardCheck" v-else :size="15" />
            <span>
              {{ loading ? 'Iniciando teste...' : `Iniciar no ${mode === 'voice' ? 'Modo de Voz' : 'Modo Chat'} (${isCustom && customValue ? customValue : selectedCount} perguntas)` }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>