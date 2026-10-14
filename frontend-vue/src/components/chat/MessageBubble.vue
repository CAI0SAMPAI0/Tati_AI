<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Mic, Volume2 } from 'lucide-vue-next';
import AudioPlayer from './AudioPlayer.vue';
import ClickableText from './ClickableText.vue';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  audio_b64?: string | null;
  audio_url?: string | null;
}

const props = defineProps<{
  message: ChatMessage;
  conversationId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'word-click', word: string, x: number, y: number): void;
}>();

const router = useRouter();
const route = useRoute();

function openPracticePronunciation() {
  const cleanText = props.message.content.replace(/[#*`_]/g, '').trim();
  const firstSentence = cleanText.split(/[.!?]/)[0] || cleanText;
  const currentConvId = props.conversationId || (route.query.conv_id as string) || (route.query.id as string) || '';
  router.push({
    path: '/pronunciation-reader',
    query: {
      phrase: firstSentence.slice(0, 120),
      ...(currentConvId ? { conv_id: currentConvId } : {}),
    },
  });
}

function formatTime(isoStr?: string) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
}
</script>

<template>
  <div
    class="flex gap-3 max-w-[85%] animate-fade-in group"
    :class="message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'"
  >
    <!-- Assistant Avatar -->
    <div
      v-if="message.role !== 'user'"
      class="w-7 h-7 rounded-full border border-line overflow-hidden shrink-0 mt-1 shadow-xs bg-surface"
    >
      <img
        src="/images/tati_logo.jpg"
        alt="Teacher Tati"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Bubble Content Column -->
    <div
      class="flex flex-col gap-1"
      :class="message.role === 'user' ? 'items-end' : 'items-start'"
    >
      <div
        class="relative px-4 py-3 rounded-2xl text-[0.9375rem] leading-relaxed break-words shadow-xs transition-all"
        :class="
          message.role === 'user'
            ? 'bg-primary text-white rounded-br-xs font-normal'
            : 'bg-surface border border-line text-ink rounded-bl-xs hover:border-primary/25'
        "
      >
        <p v-if="message.role === 'user'" class="whitespace-pre-wrap">{{ message.content }}</p>
        <ClickableText
          v-else
          :content="message.content"
          @word-click="(word, x, y) => $emit('word-click', word, x, y)"
        />
      </div>

      <!-- AudioPlayer for Assistant messages -->
      <AudioPlayer
        v-if="message.role !== 'user'"
        :base64="message.audio_b64 || undefined"
        :url="message.audio_url || undefined"
        :text="message.content"
      />

      <!-- Action buttons & Timestamp under message -->
      <div class="flex items-center gap-2 px-1 mt-0.5">
        <span class="text-[0.7rem] text-muted opacity-70">
          {{ formatTime(message.created_at) }}
        </span>

        <!-- Practice Pronunciation shortcut -->
        <button
          v-if="message.role !== 'user'"
          type="button"
          class="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer ml-1"
          title="Praticar pronúncia com esta resposta"
          @click="openPracticePronunciation"
        >
          <Mic :size="12" />
          <span>Practice the pronunciation</span>
        </button>
      </div>
    </div>
  </div>
</template>
