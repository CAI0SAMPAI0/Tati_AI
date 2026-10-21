<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import {
  getMessages,
  createConversation,
  sendChatMessage,
  editMessage,
  startLeveling,
} from '@/api/chat';
import type { Message, Conversation } from '@/api/types';
import { getMessagesLocal, saveMessagesLocal } from '@/api/indexedDB';
import Sidebar from '@/components/chat/Sidebar.vue';
import ChatTopbar from '@/components/chat/ChatTopbar.vue';
import MessageList from '@/components/chat/MessageList.vue';
import ChatInput from '@/components/chat/ChatInput.vue';
import LevelingModal from '@/components/chat/LevelingModal.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { accent } = useAuth();

const isSidebarOpen = ref(true);
const isLevelingModalOpen = ref(false);
const isStartingLeveling = ref(false);
const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);

const messages = ref<Message[]>([]);
const convTitle = ref("Taty's Hub");
const isSending = ref(false);
const isCreatingConv = ref(false);

const currentConvId = computed(() => {
  return ((route.query.conv_id || route.query.id) as string) || null;
});

const activeConvId = ref<string | null>(currentConvId.value);
const memoryMessagesCache = new Map<string, Message[]>();

watch(
  currentConvId,
  (newId) => {
    activeConvId.value = newId;
    if (isCreatingConv.value) return;
    if (newId) {
      loadConversationMessages(newId);
    } else {
      messages.value = [];
      convTitle.value = "Taty's Hub";
    }
  },
  { immediate: true }
);

async function loadConversationMessages(id: string) {
  // 1. Instant load from memory cache (0ms delay)
  const memCached = memoryMessagesCache.get(id);
  if (memCached && memCached.length > 0) {
    messages.value = memCached;
  } else {
    // 2. Fast load from indexedDB
    getMessagesLocal(id).then((localMsgs) => {
      if (localMsgs && localMsgs.length > 0 && activeConvId.value === id) {
        messages.value = localMsgs;
        memoryMessagesCache.set(id, localMsgs);
      }
    }).catch(() => {});
  }

  // 3. Network revalidation in background
  try {
    const list = await getMessages(id);
    if (activeConvId.value === id) {
      if (list && list.length > 0) {
        messages.value = list;
        memoryMessagesCache.set(id, list);
        saveMessagesLocal(id, list).catch(() => {});
      } else if (!isSending.value && !isCreatingConv.value) {
        messages.value = [];
        memoryMessagesCache.set(id, []);
      }
    }
  } catch (err) {
    console.error('Error loading messages for conv:', id, err);
  }
}

function handleSelectConv(id: string, title: string) {
  convTitle.value = title || "Taty's Hub";
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
  router.push({ path: '/chat', query: { conv_id: id } });
}

function handleNewChat() {
  messages.value = [];
  convTitle.value = "Taty's Hub";
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
  router.push('/chat');
}

async function handleSend(text: string) {
  let convId = currentConvId.value;

  if (!convId) {
    try {
      isCreatingConv.value = true;
      const newConv = await createConversation('Nova Conversa com a Teacher Tati');
      convId = newConv.id;
      activeConvId.value = newConv.id;
      convTitle.value = newConv.title;
      sidebarRef.value?.addConversation(newConv);
      await router.replace({ path: '/chat', query: { conv_id: convId } });
    } catch (err) {
      isCreatingConv.value = false;
      console.error('Error creating conversation:', err);
      toast.error('Could not start conversation.');
      return;
    }
  }

  // Push optimistic user message
  const userMsg: Message = {
    id: `user-temp-${Date.now()}`,
    conversation_id: convId,
    role: 'user',
    content: text,
    created_at: new Date().toISOString(),
  };
  messages.value.push(userMsg);

  isSending.value = true;
  try {
    const res = await sendChatMessage(convId, text, undefined, accent.value || 'en-US');
    if (res && res.reply) {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        conversation_id: convId,
        role: 'assistant',
        content: res.reply,
        audio_b64: res.audio_b64 || res.audio,
        created_at: new Date().toISOString(),
      };
      messages.value.push(assistantMsg);
      memoryMessagesCache.set(convId, [...messages.value]);
      saveMessagesLocal(convId, messages.value).catch(() => {});
    }
    // Synchronize DB UUIDs for all messages
    loadConversationMessages(convId);
  } catch (err: any) {
    console.error('Error sending message:', err);
    toast.error('Failed to send message. Please try again.');
  } finally {
    isSending.value = false;
    isCreatingConv.value = false;
  }
}

async function handleSendAudio(base64: string) {
  let convId = currentConvId.value;

  if (!convId) {
    try {
      isCreatingConv.value = true;
      const newConv = await createConversation('Conversa de Áudio com a Teacher Tati');
      convId = newConv.id;
      activeConvId.value = newConv.id;
      convTitle.value = newConv.title;
      sidebarRef.value?.addConversation(newConv);
      await router.replace({ path: '/chat', query: { conv_id: convId } });
    } catch (err) {
      isCreatingConv.value = false;
      console.error('Error creating conversation for audio:', err);
      toast.error('Could not start conversation for audio.');
      return;
    }
  }

  const userMsg: Message = {
    id: `user-audio-temp-${Date.now()}`,
    conversation_id: convId,
    role: 'user',
    content: '🎤 Audio message',
    audio_b64: base64,
    created_at: new Date().toISOString(),
  };
  messages.value.push(userMsg);

  isSending.value = true;
  try {
    const res = await sendChatMessage(convId, '', base64, accent.value || 'en-US');
    if (res && res.reply) {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        conversation_id: convId,
        role: 'assistant',
        content: res.reply,
        audio_b64: res.audio_b64 || res.audio,
        created_at: new Date().toISOString(),
      };
      messages.value.push(assistantMsg);
      memoryMessagesCache.set(convId, [...messages.value]);
      saveMessagesLocal(convId, messages.value).catch(() => {});
    }
    // Synchronize DB UUIDs for all messages
    loadConversationMessages(convId);
  } catch (err: any) {
    console.error('Error sending audio message:', err);
    toast.error('Failed to send audio message.');
  } finally {
    isSending.value = false;
    isCreatingConv.value = false;
  }
}

async function handleEditMessage(messageId: string, newContent: string) {
  const convId = activeConvId.value || currentConvId.value;
  if (!convId) return;

  let targetId = messageId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = uuidRegex.test(targetId);

  // Optimistically update local message content immediately
  const localMsg = messages.value.find((m) => m.id === targetId || m.id === messageId);
  const prevContent = localMsg?.content;
  if (localMsg) {
    localMsg.content = newContent;
  }

  // Se o ID for temporário ou não for um UUID válido do banco, sincroniza do backend
  if (!isUuid) {
    try {
      const fresh = await getMessages(convId);
      if (fresh && fresh.length > 0) {
        messages.value = fresh;
        const userMsgs = fresh.filter((m) => m.role === 'user');
        const found = (prevContent ? userMsgs.find((m) => m.content === prevContent) : null) || userMsgs[userMsgs.length - 1];
        if (found && uuidRegex.test(found.id)) {
          targetId = found.id;
        }
      }
    } catch (_) {}
  }

  try {
    const res = await editMessage(convId, targetId, newContent, accent.value || 'en-US');
    toast.success('Message updated.');

    // Se a API retornou nova resposta da IA, atualiza diretamente a lista de mensagens
    if (res && res.reply) {
      const userIdx = messages.value.findIndex((m) => m.id === targetId || m.id === messageId);
      if (userIdx !== -1) {
        messages.value = messages.value.slice(0, userIdx + 1);
        messages.value.push({
          id: res.assistant_message_id || `assistant-${Date.now()}`,
          conversation_id: convId,
          role: 'assistant',
          content: res.reply,
          audio_b64: res.audio_b64,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Sincroniza do banco em segundo plano para persistência final
    await loadConversationMessages(convId);
  } catch (err: any) {
    console.error('Error editing message:', err);
    toast.error(err?.message || 'Failed to update message.');
  }
}

async function handleExecuteStartLeveling(totalQuestions: number, mode: 'chat' | 'voice') {
  isStartingLeveling.value = true;
  try {
    const res = await startLeveling(totalQuestions, accent.value || 'en-US');
    if (res && res.conversation_id) {
      toast.success(`Leveling challenge started! Answer in English.`);
      const newConvId = res.conversation_id;
      isLevelingModalOpen.value = false;
      if (mode === 'voice') {
        await router.push({ path: '/voice', query: { conv_id: newConvId } });
      } else {
        await router.push({ path: '/chat', query: { conv_id: newConvId } });
      }

      const initialMsg: Message = {
        id: `leveling-init-${Date.now()}`,
        conversation_id: newConvId,
        role: 'assistant',
        content: res.reply || res.message || '',
        audio_b64: res.audio_b64 || res.audio,
        created_at: new Date().toISOString(),
      };
      messages.value = [initialMsg];
      convTitle.value = res.title || 'CEFR Leveling Challenge';
      sidebarRef.value?.reloadConversations();
    }
  } catch (err) {
    console.error('Error starting leveling:', err);
    toast.error('Could not start leveling challenge.');
  } finally {
    isStartingLeveling.value = false;
  }
}

function handleSwitchToVoice() {
  if (currentConvId.value) {
    router.push({ path: '/voice', query: { conv_id: currentConvId.value } });
  } else {
    router.push('/voice');
  }
}

onMounted(() => {
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
});
</script>

<template>
  <div class="flex h-screen bg-bg overflow-hidden relative">
    <!-- Chat Sidebar -->
    <Sidebar
      ref="sidebarRef"
      :current-conv-id="currentConvId"
      :is-open="isSidebarOpen"
      @close="isSidebarOpen = false"
      @new-chat="handleNewChat"
      @select-conv="handleSelectConv"
      @start-leveling="isLevelingModalOpen = true"
    />

    <!-- Main Chat Column -->
    <div
      class="flex-1 flex flex-col min-w-0 relative bg-bg transition-all duration-300"
      :class="isSidebarOpen ? 'md:pl-[280px]' : 'md:pl-0'"
    >
      <!-- Chat Topbar -->
      <ChatTopbar
        :title="convTitle"
        :has-chat-started="messages.length > 0"
        @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
        @switch-to-voice="handleSwitchToVoice"
      />

      <!-- Message List -->
      <MessageList
        :messages="messages"
        :is-streaming="isSending"
        @start-leveling="isLevelingModalOpen = true"
        @switch-to-voice="handleSwitchToVoice"
        @edit-message="handleEditMessage"
      />

      <!-- Chat Input -->
      <ChatInput
        :disabled="isSending"
        :is-streaming="isSending"
        @send="handleSend"
        @send-audio="handleSendAudio"
      />
    </div>

    <!-- Leveling Modal -->
    <LevelingModal
      :is-open="isLevelingModalOpen"
      :loading="isStartingLeveling"
      @close="isLevelingModalOpen = false"
      @start="handleExecuteStartLeveling"
    />
  </div>
</template>

