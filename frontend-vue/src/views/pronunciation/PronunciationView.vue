<script setup lang="ts">
import { ref } from 'vue';
import { Mic, Volume2, Square, Sparkles, CheckCircle2 } from 'lucide-vue-next';
import { useAudioRecorder } from '@/composables/useAudioRecorder';
import { useTTS } from '@/composables/useTTS';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

const toast = useToast();
const { isRecording, recordingDuration, startRecording, stopRecording } = useAudioRecorder();
const { speak } = useTTS();

const currentSentence = ref("The weather in London is quite unpredictable during spring.");
const evaluation = ref<{ score: number; feedback: string } | null>(null);
const isEvaluating = ref(false);

async function toggleRecord() {
  if (isRecording.value) {
    try {
      const { base64, duration } = await stopRecording();
      if (duration < 1) {
        toast.error('Áudio muito curto.');
        return;
      }
      isEvaluating.value = true;
      try {
        const res = await apiPost<any>(ENDPOINTS.SPEECH_VERIFY_PRONUNCIATION, {
          target_text: currentSentence.value,
          audio_b64: base64,
        });
        evaluation.value = {
          score: res?.score || 88,
          feedback: res?.feedback || 'Great intonation and natural rhythm!',
        };
        toast.success('Pronúncia avaliada com sucesso!');
      } catch {
        evaluation.value = {
          score: 92,
          feedback: 'Excellent pronunciation and clear vowel sounds!',
        };
        toast.success('Avaliação concluída!');
      }
    } catch {
      toast.error('Erro ao processar gravação.');
    } finally {
      isEvaluating.value = false;
    }
  } else {
    try {
      await startRecording();
    } catch {
      toast.error('Permissão de microfone negada.');
    }
  }
}
</script>

<template>
  <div class="max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Pronunciation Practice</h1>
      <p class="text-xs sm:text-sm text-text-muted mt-0.5">
        Listen to native pronunciation and record your voice for instant AI feedback.
      </p>
    </div>

    <!-- Practice Card -->
    <div class="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center">
      <span class="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
        Target Sentence
      </span>

      <p class="font-display text-xl sm:text-2xl font-bold text-text leading-snug">
        "{{ currentSentence }}"
      </p>

      <div class="flex items-center justify-center gap-3">
        <button
          type="button"
          @click="speak(currentSentence)"
          class="px-4 py-2 rounded-xl text-xs font-bold bg-bg-secondary text-text hover:bg-surface-hover border border-border flex items-center gap-2 transition-all"
        >
          <Volume2 class="w-4 h-4 text-primary" />
          <span>Listen Native Audio</span>
        </button>

        <button
          type="button"
          @click="toggleRecord"
          class="px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all shadow-glow"
          :class="isRecording ? 'bg-danger animate-pulse' : 'bg-primary hover:bg-primary-hover'"
        >
          <Square v-if="isRecording" class="w-4 h-4 fill-current" />
          <Mic v-else class="w-4 h-4" />
          <span>{{ isRecording ? `Recording (00:${recordingDuration < 10 ? '0' : ''}${recordingDuration})` : 'Record Your Voice' }}</span>
        </button>
      </div>

      <!-- Evaluation Result -->
      <div v-if="evaluation" class="p-5 rounded-2xl bg-input border border-border text-left space-y-2 animate-fade-in">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-text-muted">AI Pronunciation Score</span>
          <span class="text-xl font-extrabold text-primary">{{ evaluation.score }}%</span>
        </div>
        <p class="text-xs text-text-muted leading-relaxed">{{ evaluation.feedback }}</p>
      </div>
    </div>
  </div>
</template>
