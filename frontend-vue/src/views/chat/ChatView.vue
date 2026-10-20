<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import {
  Send,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  User as UserIcon,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useAudioRecorder } from '@/composables/useAudioRecorder';
import { useTTS } from '@/composables/useTTS';
import { useToast } from '@/composables/useToast';
import {
  getConversations,
  getMessages,
  createConversation,
  deleteConversation,
  sendMessage,
} from '@/api/chat';
import type { Conversation, Message } from '@/api/types';
import Sidebar from '@/components/layout/Sidebar.vue';
import ChatTopbar from '@/components/layout/ChatTopbar.vue';
import ToastContainer from '@/components/ui/ToastContainer.vue';

const { user, accent } = useAuth();
const toast = useToast();
const { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording } =
  useAudioRecorder();
const { speak, isPlaying, stop: stopTTS } = useTTS();

const isSidebarOpen = ref(false);
const conversations = ref<Conversation[]>([]);
const currentConvId = ref<string | null>(null);
const messages = ref<Message[]>([]);
const inputText = ref('');
const isSending = ref(false);
const messagesContainer = ref<HTMLDivElement | null>(null);

async function loadConversations() {
  try {
    const list = await getConversations();
    conversations.value = list || [];
    if (list && list.length > 0 && !currentConvId.value) {
      selectConversation(list[0].id);
    }
  } catch (err) {
    console.error('Error loading conversations:', err);
  }
}

async function selectConversation(id: string) {
  currentConvId.value = id;
  try {
    const msgs = await getMessages(id);
    messages.value = msgs || [];
    scrollToBottom();
  } catch {
    toast.error('Erro ao carregar mensagens.');
  }
}

async function handleNewChat() {
  try {
    const newConv = await createConversation('New Conversation');
    conversations.value.unshift(newConv);
    currentConvId.value = newConv.id;
    messages.value = [];
  } catch {
    toast.error('Erro ao criar conversa.');
  }
}

async function handleDeleteAll() {
  if (!confirm('Tem certeza de que deseja apagar todas as conversas?')) return;
  try {
    for (const conv of conversations.value) {
      await deleteConversation(conv.id);
    }
    conversations.value = [];
    currentConvId.value = null;
    messages.value = [];
    toast.success('Todas as conversas foram apagadas.');
  } catch {
    toast.error('Erro ao apagar conversas.');
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isSending.value) return;

  if (!currentConvId.value) {
    await handleNewChat();
  }

  const convId = currentConvId.value!;
  const userMsg: Message = {
    id: `temp-${Date.now()}`,
    conversation_id: convId,
    role: 'user',
    content: text,
    created_at: new Date().toISOString(),
  };

  messages.value.push(userMsg);
  inputText.value = '';
  scrollToBottom();

  isSending.value = true;
  try {
    const response = await sendMessage(convId, { content: text });
    messages.value.push(response);
    scrollToBottom();

    // Auto speak if enabled
    if (response.content) {
      speak(response.content, accent.value);
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao enviar mensagem.');
  } finally {
    isSending.value = false;
  }
}

async function toggleRecord() {
  if (isRecording.value) {
    try {
      const { base64, duration } = await stopRecording();
      if (duration < 1) {
        toast.error('Áudio muito curto. Fale um pouco mais.');
        return;
      }

      if (!currentConvId.value) {
        await handleNewChat();
      }

      const convId = currentConvId.value!;
      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: convId,
        role: 'user',
        content: '🎤 [Voice message]',
        created_at: new Date().toISOString(),
      };
      messages.value.push(userMsg);
      scrollToBottom();

      isSending.value = true;
      const response = await sendMessage(convId, {
        content: '',
        audio_b64: base64,
      });
      messages.value.push(response);
      scrollToBottom();

      if (response.content) {
        speak(response.content, accent.value);
      }
    } catch {
      toast.error('Erro ao processar gravação de voz.');
    } finally {
      isSending.value = false;
    }
  } else {
    try {
      await startRecording();
    } catch {
      toast.error('Permissão de microfone negada ou não suportada.');
    }
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function sendStarter(prompt: string) {
  inputText.value = prompt;
  handleSend();
}

onMounted(() => {
  loadConversations();
});
</script>

<template>
  <div class="h-screen flex overflow-hidden bg-bg text-text">
    <ToastContainer />

    <!-- Left Sidebar -->
    <Sidebar
      :is-open="isSidebarOpen"
      :conversations="conversations"
      :current-conv-id="currentConvId"
      @close="isSidebarOpen = false"
      @new-chat="handleNewChat"
      @select-conv="selectConversation"
      @delete-all="handleDeleteAll"
    />

    <!-- Main Chat Column -->
    <div class="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      <ChatTopbar
        title="Teacher Tatiana"
        @toggle-menu="isSidebarOpen = !isSidebarOpen"
      />

      <!-- Message Area -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar"
      >
        <!-- Empty State with Starters -->
        <div
          v-if="messages.length === 0"
          class="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 px-4"
        >
          <div class="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-glow">
            <Sparkles class="w-8 h-8" />
          </div>
          <h2 class="font-display text-xl font-bold text-text mb-2">
            Let's practice your English!
          </h2>
          <p class="text-xs sm:text-sm text-text-muted mb-8 leading-relaxed">
            I am Teacher Taty, your AI mentor. Send a voice note, ask a grammar question, or choose a topic below.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            <button
              type="button"
              @click="sendStarter('Hi Taty! Can we practice a job interview in English?')"
              class="p-3 text-left rounded-xl border border-border bg-surface hover:border-primary hover:bg-surface-hover transition-all text-xs font-semibold text-text shadow-sm"
            >
              💼 Practice Job Interview
            </button>
            <button
              type="button"
              @click="sendStarter('Help me correct my pronunciation for daily conversation.')"
              class="p-3 text-left rounded-xl border border-border bg-surface hover:border-primary hover:bg-surface-hover transition-all text-xs font-semibold text-text shadow-sm"
            >
              🗣️ Daily Conversation
            </button>
            <button
              type="button"
              @click="sendStarter('Explain the difference between Present Perfect and Past Simple.')"
              class="p-3 text-left rounded-xl border border-border bg-surface hover:border-primary hover:bg-surface-hover transition-all text-xs font-semibold text-text shadow-sm"
            >
              📖 Grammar Explanation
            </button>
            <button
              type="button"
              @click="sendStarter('Let\'s roleplay ordering coffee at a café in London.')"
              class="p-3 text-left rounded-xl border border-border bg-surface hover:border-primary hover:bg-surface-hover transition-all text-xs font-semibold text-text shadow-sm"
            >
              ☕ Cafe Roleplay
            </button>
          </div>
        </div>

        <!-- Messages List -->
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex gap-3 max-w-3xl"
          :class="msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'"
        >
          <!-- Avatar -->
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            :class="
              msg.role === 'user'
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-primary'
            "
          >
            <UserIcon v-if="msg.role === 'user'" class="w-4 h-4" />
            <Bot v-else class="w-4 h-4" />
          </div>

          <!-- Bubble -->
          <div
            class="rounded-2xl p-4 text-sm leading-relaxed max-w-[85%] sm:max-w-xl shadow-sm transition-all"
            :class="
              msg.role === 'user'
                ? 'bg-primary text-white rounded-tr-none'
                : 'bg-surface text-text border border-border rounded-tl-none'
            "
          >
            <div class="whitespace-pre-wrap">{{ msg.content }}</div>

            <!-- Audio play button for assistant -->
            <div
              v-if="msg.role === 'assistant' && msg.content"
              class="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between"
            >
              <button
                type="button"
                @click="speak(msg.content, accent)"
                class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors font-semibold"
              >
                <Volume2 class="w-3.5 h-3.5 text-primary" />
                <span>Hear pronunciation</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Sending indicator -->
        <div v-if="isSending" class="flex gap-3 max-w-3xl mr-auto">
          <div class="w-8 h-8 rounded-full bg-surface border border-border text-primary flex items-center justify-center flex-shrink-0">
            <Bot class="w-4 h-4" />
          </div>
          <div class="bg-surface border border-border rounded-2xl rounded-tl-none p-4 text-xs font-medium text-text-muted flex items-center gap-2 shadow-sm">
            <div class="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
            <div class="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></div>
            <div class="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></div>
            <span>Teacher Taty is thinking...</span>
          </div>
        </div>
      </div>

      <!-- Input Footer -->
      <div class="p-3 sm:p-4 border-t border-border bg-surface flex-shrink-0">
        <form
          @submit.prevent="handleSend"
          class="max-w-4xl mx-auto flex items-center gap-2"
        >
          <!-- Mic / Stop Recording Button -->
          <button
            type="button"
            @click="toggleRecord"
            class="w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0"
            :class="
              isRecording
                ? 'bg-danger text-white animate-pulse shadow-md'
                : 'bg-bg-secondary text-text-muted hover:text-text hover:bg-surface-hover border border-border'
            "
            :title="isRecording ? 'Stop recording' : 'Record voice note'"
          >
            <Square v-if="isRecording" class="w-4 h-4 fill-current" />
            <Mic v-else class="w-4 h-4" />
          </button>

          <!-- Duration pill during recording -->
          <span
            v-if="isRecording"
            class="text-xs font-bold text-danger px-2 animate-pulse"
          >
            00:{{ recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration }}
          </span>

          <!-- Text input -->
          <input
            v-model="inputText"
            type="text"
            placeholder="Type your message in English..."
            :disabled="isSending || isRecording"
            class="flex-1 px-4 py-2.5 rounded-full border border-border bg-input text-text text-sm placeholder:text-text-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />

          <!-- Send Button -->
          <button
            type="submit"
            :disabled="!inputText.trim() || isSending || isRecording"
            class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center transition-all shadow-glow hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 active:scale-95"
          >
            <Send class="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
