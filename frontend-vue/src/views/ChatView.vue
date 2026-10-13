<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loader2, AudioLines, Mic, BookMarked, ArrowRight, ClipboardCheck, Sparkles } from 'lucide-vue-next';
import ChatSidebar, { type ChatConversation } from '../components/chat/ChatSidebar.vue';
import ChatTopbar from '../components/chat/ChatTopbar.vue';
import MessageBubble, { type ChatMessage } from '../components/chat/MessageBubble.vue';
import ChatInput from '../components/chat/ChatInput.vue';
import LevelingModal from '../components/chat/LevelingModal.vue';
import WordTooltip from '../components/chat/WordTooltip.vue';
import { useAuthStore } from '../stores/auth';
import { getStoredAccent } from '../constants/accents';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeTooltipWord = ref<string | null>(null);
const tooltipPosition = ref<{ x: number; y: number } | null>(null);

function handleWordClick(word: string, x: number, y: number) {
  activeTooltipWord.value = word;
  tooltipPosition.value = { x, y };
}

function closeWordTooltip() {
  activeTooltipWord.value = null;
  tooltipPosition.value = null;
}

const isSidebarOpen = ref(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
const conversations = ref<ChatConversation[]>([]);
const activeConvId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const isLoadingConversations = ref(false);
const isLoadingMessages = ref(false);
const isSending = ref(false);

const isLevelingModalOpen = ref(false);
const isStartingLeveling = ref(false);

const messagesContainerRef = ref<HTMLDivElement | null>(null);

const activeConversation = computed(() => {
  return conversations.value.find((c) => c.id === activeConvId.value) || null;
});

const convTitle = computed(() => {
  return activeConversation.value?.title || "Taty's Hub";
});

const isLevelingActive = computed(() => {
  const title = (convTitle.value || '').toLowerCase();
  return title.includes('leveling') || title.includes('nivelamento');
});

const hasChatStarted = computed(() => {
  return messages.value.length > 0 || isSending.value;
});

async function scrollToBottom() {
  await nextTick();
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
  }
}

// Watch query param conv_id to handle browser back / forward / returns from pronunciation practice
watch(
  () => route.query.conv_id,
  (newId) => {
    if (newId && typeof newId === 'string' && newId !== activeConvId.value) {
      selectConversation(newId);
    }
  }
);

// Fetch conversations list
async function loadConversations() {
  if (!authStore.token) return;
  isLoadingConversations.value = true;
  try {
    const res = await fetch('/chat/conversations', {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    if (res.ok) {
      const data: ChatConversation[] = await res.json();
      conversations.value = data;

      // Select conversation if query param exists or restore last active conversation
      const queryConvId = (route.query.conv_id || route.query.id) as string;
      const lastSavedId = sessionStorage.getItem('tati_last_chat_conv_id');
      const targetId =
        queryConvId && data.some((c) => c.id === queryConvId)
          ? queryConvId
          : lastSavedId && data.some((c) => c.id === lastSavedId)
            ? lastSavedId
            : null;

      if (targetId) {
        selectConversation(targetId);
      }
    }
  } catch (err) {
    console.error('Failed to load conversations:', err);
  } finally {
    isLoadingConversations.value = false;
  }
}

// Fetch messages for a conversation
async function selectConversation(id: string) {
  activeConvId.value = id;
  sessionStorage.setItem('tati_last_chat_conv_id', id);

  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
  router.replace({ query: { conv_id: id } });

  isLoadingMessages.value = true;
  try {
    const res = await fetch(`/chat/conversations/${id}/messages`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      messages.value = data.map((m: any) => ({
        id: m.id || String(Math.random()),
        role: m.role || 'assistant',
        content: m.content || m.text || '',
        created_at: m.created_at,
        audio_b64: m.audio_b64 || m.audio,
      }));
      await scrollToBottom();
    }
  } catch (err) {
    console.error('Failed to load messages:', err);
  } finally {
    isLoadingMessages.value = false;
  }
}

// Create a new blank chat
function createNewChat() {
  activeConvId.value = null;
  sessionStorage.removeItem('tati_last_chat_conv_id');
  messages.value = [];
  router.replace({ query: {} });
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
}

// Start CEFR Leveling Assessment
async function handleStartLevelingAssessment(totalQuestions: number, mode: 'chat' | 'voice') {
  isStartingLeveling.value = true;
  try {
    const accent = getStoredAccent();
    const res = await fetch('/chat/leveling/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        total_questions: totalQuestions,
        accent,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const newConvId = data.conversation_id;
      isLevelingModalOpen.value = false;
      await loadConversations();

      if (mode === 'voice') {
        router.push(`/voice?conv_id=${newConvId}`);
      } else {
        activeConvId.value = newConvId;
        sessionStorage.setItem('tati_last_chat_conv_id', newConvId);
        router.replace({ query: { conv_id: newConvId } });
        messages.value = [
          {
            id: `leveling-init-${Date.now()}`,
            role: 'assistant',
            content: data.reply || data.message || '',
            audio_b64: data.audio_b64,
            created_at: new Date().toISOString(),
          },
        ];
        await scrollToBottom();
      }
    }
  } catch (err) {
    console.error('Failed to start leveling assessment:', err);
  } finally {
    isStartingLeveling.value = false;
  }
}

// Delete conversation
async function deleteConversation(id: string) {
  try {
    const res = await fetch(`/chat/conversations/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    if (res.ok) {
      conversations.value = conversations.value.filter((c) => c.id !== id);
      if (activeConvId.value === id) {
        createNewChat();
      }
    }
  } catch (err) {
    console.error('Failed to delete conversation:', err);
  }
}

// Delete all conversations
async function deleteAllConversations() {
  if (!confirm('⚠️ Deseja realmente excluir TODAS as suas conversas?')) return;
  try {
    for (const c of conversations.value) {
      await fetch(`/chat/conversations/${c.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      });
    }
    conversations.value = [];
    createNewChat();
  } catch (err) {
    console.error('Failed to delete all conversations:', err);
  }
}

// Send user message
async function handleSendMessage(content: string) {
  if (!content.trim() || isSending.value) return;

  let currentId = activeConvId.value;

  // If starting new conversation
  if (!currentId) {
    try {
      const newRes = await fetch('/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          title: content.slice(0, 30) || 'Conversa com a Teacher Tati',
        }),
      });
      if (newRes.ok) {
        const newConv = await newRes.json();
        currentId = newConv.id;
        activeConvId.value = newConv.id;
        sessionStorage.setItem('tati_last_chat_conv_id', newConv.id);
        conversations.value.unshift(newConv);
        router.replace({ query: { conv_id: newConv.id } });
      }
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  }

  const userMsg: ChatMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content,
    created_at: new Date().toISOString(),
  };

  messages.value.push(userMsg);
  await scrollToBottom();

  isSending.value = true;
  try {
    const accent = getStoredAccent();
    const res = await fetch('/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        conversation_id: currentId,
        message: content,
        accent,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: data.id || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.content || data.response || '',
        audio_b64: data.audio_b64 || data.audio,
        created_at: new Date().toISOString(),
      };
      messages.value.push(assistantMsg);
      await scrollToBottom();

      // Refresh conversations list in case title was updated
      await loadConversations();
    } else {
      messages.value.push({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Tive uma breve instabilidade na conexão. Poderia enviar novamente?',
      });
    }
  } catch (err) {
    console.error('Send message failed:', err);
    messages.value.push({
      id: `error-${Date.now()}`,
      role: 'assistant',
      content: 'Não foi possível conectar ao servidor. Por favor, verifique sua conexão.',
    });
  } finally {
    isSending.value = false;
    await scrollToBottom();
  }
}

// Send audio message recorded from ChatInput
async function handleSendAudio(base64: string) {
  if (isSending.value) return;
  isSending.value = true;

  try {
    const trRes = await fetch('/chat/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ audio: base64 }),
    });

    if (trRes.ok) {
      const trData = await trRes.json();
      const transcription = trData.transcription || trData.text;
      if (transcription) {
        isSending.value = false;
        await handleSendMessage(transcription);
        return;
      }
    }

    isSending.value = false;
    await handleSendMessage('🎙 [Mensagem de Áudio]');
  } catch (err) {
    console.error('Audio message send error:', err);
    isSending.value = false;
  }
}

onMounted(() => {
  loadConversations();
});
</script>

<template>
  <div class="flex h-screen bg-bg overflow-hidden selection:bg-primary/20 relative">
    <!-- Canonical Sidebar -->
    <ChatSidebar
      :is-open="isSidebarOpen"
      :conversations="conversations"
      :active-conv-id="activeConvId"
      @close="isSidebarOpen = false"
      @new-chat="createNewChat"
      @start-leveling="isLevelingModalOpen = true"
      @select-conv="selectConversation"
      @delete-conv="deleteConversation"
      @delete-all="deleteAllConversations"
    />

    <!-- Main Chat Workspace with Responsive Padding -->
    <div
      class="flex-1 flex flex-col min-w-0 relative bg-bg transition-all duration-300 h-screen"
      :class="isSidebarOpen ? 'md:pl-[280px]' : 'md:pl-0'"
    >
      <!-- Topbar -->
      <ChatTopbar
        :title="convTitle"
        :has-chat-started="hasChatStarted"
        :show-summary-btn="messages.length >= 3"
        @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
        @switch-to-voice="router.push(activeConvId ? `/voice?conv_id=${activeConvId}` : '/voice')"
      />

      <!-- Message History / Welcome Area Container -->
      <div
        ref="messagesContainerRef"
        class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-5 scroll-smooth"
      >
        <!-- Leveling in progress banner -->
        <div
          v-if="isLevelingActive"
          class="max-w-3xl mx-auto p-3 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 text-xs shadow-xs animate-fade-in"
        >
          <div class="flex items-center gap-2.5">
            <ClipboardCheck :size="18" class="text-primary shrink-0" />
            <span class="text-ink">
              Desafio de Nivelamento CEFR em andamento. Digite <strong class="font-mono text-primary font-bold">/finish</strong> a qualquer momento para concluir e receber sua nota.
            </span>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoadingMessages" class="flex h-full items-center justify-center">
          <div class="flex flex-col items-center gap-2 text-primary">
            <Loader2 :size="32" class="animate-spin" />
            <p class="text-xs font-semibold text-muted">Carregando conversa...</p>
          </div>
        </div>

        <!-- Canonical Welcome Screen (when no messages) -->
        <div
          v-else-if="messages.length === 0"
          class="flex flex-col items-center justify-center py-8 md:py-16 text-center animate-fade-in max-w-2xl mx-auto px-4 w-full"
        >
          <div class="w-16 h-16 rounded-full border-[3px] border-primary/40 shadow-glow overflow-hidden mb-5 flex items-center justify-center">
            <img
              src="/images/tati_logo.jpg"
              alt="Logo da Tatiana"
              class="w-full h-full object-cover rounded-full"
            />
          </div>

          <header class="space-y-3 mb-8">
            <h1 class="font-editorial text-[32px] md:text-[36px] leading-tight text-primary font-normal">
              Bem-vindo ao Taty's Hub
            </h1>

            <p class="text-[15px] leading-relaxed text-muted max-w-md mx-auto">
              Seu hub completo de aprendizado de inglês com inteligência artificial. Vamos praticar juntos?
            </p>
          </header>

          <!-- Action Buttons -->
          <div class="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 via-primarySoft to-primary/10 border border-primary/40 rounded-xl text-xs text-primary hover:bg-primary/20 transition-all font-bold shadow-xs cursor-pointer"
              @click="isLevelingModalOpen = true"
            >
              <ClipboardCheck :size="14" />
              <span>Teste de Nivelamento (CEFR)</span>
            </button>

            <router-link
              to="/pronunciation-reader"
              class="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line rounded-xl text-xs text-muted hover:text-ink hover:border-primary/40 transition-all font-medium shadow-xs"
            >
              <AudioLines :size="14" class="text-primary" />
              <span>Treinar Pronúncia</span>
            </router-link>

            <router-link
              to="/voice"
              class="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line rounded-xl text-xs text-muted hover:text-ink hover:border-primary/40 transition-all font-medium shadow-xs"
            >
              <Mic :size="14" class="text-primary" />
              <span>Modo de Voz</span>
            </router-link>

            <router-link
              to="/activities"
              class="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line rounded-xl text-xs text-muted hover:text-ink hover:border-primary/40 transition-all font-medium shadow-xs"
            >
              <BookMarked :size="14" class="text-primary" />
              <span>Atividades</span>
            </router-link>
          </div>
        </div>

        <!-- Messages List -->
        <template v-else>
          <MessageBubble
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            :conversation-id="activeConvId"
            @word-click="handleWordClick"
          />

          <!-- Assistant Streaming / Typing Indicator -->
          <div v-if="isSending" class="flex items-start gap-3">
            <div class="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-primary/20 bg-primarySoft shadow-sm mt-0.5">
              <img src="/images/tati_logo.jpg" alt="Teacher Tati" class="h-full w-full object-cover" />
            </div>
            <div class="rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3 text-sm text-muted shadow-sm flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span class="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span class="h-2 w-2 rounded-full bg-primary animate-bounce" />
            </div>
          </div>
        </template>
      </div>

      <!-- Chat Input Area -->
      <ChatInput
        :is-streaming="isSending"
        @send="handleSendMessage"
        @send-audio="handleSendAudio"
      />
    </div>

    <!-- Leveling Modal -->
    <LevelingModal
      :is-open="isLevelingModalOpen"
      :loading="isStartingLeveling"
      @close="isLevelingModalOpen = false"
      @start="handleStartLevelingAssessment"
    />

    <!-- Word / Sentence Click Tooltip -->
    <WordTooltip
      :word="activeTooltipWord"
      :position="tooltipPosition"
      @close="closeWordTooltip"
    />
  </div>
</template>