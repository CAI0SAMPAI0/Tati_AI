import { ref, watch, onMounted, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue';
import { TatiWebSocket } from '../ws/socket';
import type { WsIncomingMessage, WsOutgoingMessage } from '../ws/types';
import type { Message } from '../api/types';
import { useAuth } from './useAuth';
import { apiGet, apiPost } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { getMessagesLocal, saveMessagesLocal } from '../api/indexedDB';
import { useToast } from './useToast';

export function useVoiceSocket(
  conversationId: MaybeRefOrGetter<string | null>,
  simulationId?: MaybeRefOrGetter<string | null>
) {
  const { token } = useAuth();
  const toast = useToast();

  const messages = ref<Message[]>([]);
  const completedObjectives = ref<string[]>([]);
  const state = ref<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const lastAudio = ref<string | null>(null);
  const transcription = ref('');
  const activeConvId = ref<string | null>(toValue(conversationId));

  let socket: TatiWebSocket | null = null;
  let voicePollTimer: ReturnType<typeof setInterval> | null = null;
  let pendingAudioWsResolver: (() => void) | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let isAudioBusy = false;

  watch(
    () => toValue(conversationId),
    (newId) => {
      if (newId && newId !== activeConvId.value) {
        activeConvId.value = newId;
        loadInitialHistory(newId);
      } else if (!newId) {
        activeConvId.value = null;
        messages.value = [];
        lastAudio.value = null;
        transcription.value = '';
      }
    }
  );

  function stopVoicePolling() {
    if (voicePollTimer) {
      clearInterval(voicePollTimer);
      voicePollTimer = null;
    }
  }

  function checkAndPollPendingVoice(history: Message[]) {
    stopVoicePolling();
    const convId = activeConvId.value;
    if (!convId || !history || history.length === 0) return;

    const lastMsg = history[history.length - 1];
    const ageMs = Date.now() - new Date(lastMsg.created_at).getTime();
    if (lastMsg.role === 'user' && !isNaN(ageMs) && ageMs < 30000) {
      state.value = 'processing';
      let attempts = 0;
      const maxAttempts = 18;

      voicePollTimer = setInterval(async () => {
        attempts++;
        try {
          const fresh = await apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(convId));
          if (fresh && fresh.length > 0) {
            const freshLast = fresh[fresh.length - 1];
            if (freshLast.role === 'assistant') {
              messages.value = fresh;
              state.value = 'idle';
              if (freshLast.audio_b64) {
                lastAudio.value = freshLast.audio_b64;
              }
              stopVoicePolling();
              saveMessagesLocal(convId, fresh);
              return;
            }
          }
        } catch (_) {}

        if (attempts >= maxAttempts) {
          stopVoicePolling();
          state.value = 'idle';
        }
      }, 1500);
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (activeConvId.value) return activeConvId.value;

    const currentSimId = toValue(simulationId);
    try {
      const res = await apiPost<any>('/chat/conversations', {
        title: currentSimId ? 'Simulation Voice Session' : 'Nova Conversa com a Teacher Tati',
        is_simulation: !!currentSimId,
        simulation_id: currentSimId || undefined,
      });

      const newId = res?.id || res?.data?.id;
      if (newId) {
        activeConvId.value = newId;
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('conv_id', newId);
          window.history.replaceState({}, '', url.toString());
          window.dispatchEvent(
            new CustomEvent('tati_conversation_created', {
              detail: { id: newId, title: res?.title || 'Nova Conversa com a Teacher Tati' },
            })
          );
        }
        return newId;
      }
    } catch (err) {
      console.error('[VoiceSocket] Erro ao criar conversa:', err);
    }
    return null;
  }

  async function createNewConversation(customTitle?: string): Promise<string | null> {
    const currentSimId = toValue(simulationId);
    try {
      const res = await apiPost<any>('/chat/conversations', {
        title: customTitle || (currentSimId ? 'Simulation Voice Session' : 'Nova Conversa com a Teacher Tati'),
        is_simulation: !!currentSimId,
        simulation_id: currentSimId || undefined,
      });

      const newId = res?.id || res?.data?.id;
      if (newId) {
        activeConvId.value = newId;
        messages.value = [];
        lastAudio.value = null;
        transcription.value = '';
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('conv_id', newId);
          window.history.replaceState({}, '', url.toString());
          window.dispatchEvent(
            new CustomEvent('tati_conversation_created', {
              detail: { id: newId, title: res?.title || 'Nova Conversa com a Teacher Tati' },
            })
          );
        }
        return newId;
      }
    } catch (err) {
      console.error('[VoiceSocket] Erro ao criar nova conversa:', err);
    }
    return null;
  }

  function handleMessage(msg: WsIncomingMessage) {
    const currentId = activeConvId.value;
    if (
      msg.type === 'audio_received' ||
      msg.type === 'transcription' ||
      msg.type === 'stream_start' ||
      msg.type === 'stream_token' ||
      msg.type === 'audio_response' ||
      msg.type === 'error'
    ) {
      if (pendingAudioWsResolver) {
        pendingAudioWsResolver();
        pendingAudioWsResolver = null;
      }
    }

    if (msg.type === 'audio_response' || msg.type === 'error') {
      isAudioBusy = false;
    }

    switch (msg.type) {
      case 'transcription':
        if (msg.text) {
          state.value = 'processing';
          transcription.value = msg.text;
          const tempMsg = messages.value.find(
            (m) =>
              m.id &&
              typeof m.id === 'string' &&
              (m.id.startsWith('voice-temp-') || m.id.startsWith('live-temp-'))
          );
          const prevAudio = tempMsg?.audio_b64;

          const filtered = messages.value.filter((m) => {
            if (
              m.id &&
              typeof m.id === 'string' &&
              (m.id.startsWith('voice-temp-') || m.id.startsWith('live-temp-'))
            ) {
              return false;
            }
            if (m.role === 'user' && m.content?.includes('Transcribing')) {
              return false;
            }
            return true;
          });

          const newUserMsg: Message = {
            id: `user-${Date.now()}`,
            conversation_id: currentId || '',
            role: 'user',
            content: msg.text || '',
            audio_b64: prevAudio,
            created_at: new Date().toISOString(),
          };
          messages.value = [...filtered, newUserMsg];
        }
        break;

      case 'stream_start':
        state.value = 'processing';
        transcription.value = '';
        if (msg.conversation_id && (!activeConvId.value || activeConvId.value !== msg.conversation_id)) {
          activeConvId.value = msg.conversation_id;
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('conv_id', msg.conversation_id);
            window.history.replaceState({}, '', url.toString());
          }
        }
        break;

      case 'stream_token':
        state.value = 'processing';
        if (msg.content) {
          const tokenContent = msg.content;
          const last = messages.value[messages.value.length - 1];
          if (last && last.role === 'assistant') {
            last.content = (last.content || '') + tokenContent;
          } else {
            messages.value.push({
              id: `ai-${Date.now()}`,
              conversation_id: currentId || '',
              role: 'assistant',
              content: tokenContent,
              created_at: new Date().toISOString(),
            });
          }
        }
        break;

      case 'audio_response':
        if (msg.audio) {
          lastAudio.value = msg.audio;
          state.value = 'speaking';
          if (msg.completed_objectives) {
            completedObjectives.value = msg.completed_objectives;
          }
          if (msg.content) {
            const last = messages.value[messages.value.length - 1];
            if (last && last.role === 'assistant') {
              last.content = msg.content;
              last.audio_b64 = msg.audio;
            } else {
              messages.value.push({
                id: `ai-${Date.now()}`,
                conversation_id: currentId || '',
                role: 'assistant',
                content: msg.content || '',
                created_at: new Date().toISOString(),
                audio_b64: msg.audio,
              });
            }
          }
        }
        break;

      case 'simulation_state':
        if (msg.completed_objectives) {
          completedObjectives.value = msg.completed_objectives;
        }
        break;

      case 'new_title':
        if (msg.title) {
          const targetConvId = msg.conversation_id || currentId;
          try {
            window.dispatchEvent(
              new CustomEvent('tati_chat_title_updated', {
                detail: { conversation_id: targetConvId, title: msg.title },
              })
            );
          } catch (_) {}
        }
        break;

      case 'stream_end':
        messages.value = messages.value.filter(
          (m) =>
            !m.id ||
            (!String(m.id).startsWith('voice-temp-') &&
              !String(m.id).startsWith('live-temp-'))
        );
        break;

      case 'error':
        messages.value = messages.value.filter(
          (m) =>
            !m.id ||
            (!String(m.id).startsWith('voice-temp-') &&
              !String(m.id).startsWith('live-temp-') &&
              !m.content?.includes('Transcribing'))
        );
        state.value = 'idle';
        console.error('Voice WS Error:', msg.message);
        break;
    }
  }

  async function sendAudioHttp(
    base64: string,
    convId: string,
    accent?: string,
    tempId?: string
  ) {
    const activeTempId = tempId || `voice-temp-${Date.now()}`;
    const resolvedAccent =
      accent ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('tati_voice_accent') || 'en-US'
        : 'en-US');

    state.value = 'processing';

    let transcribedText = '';
    try {
      const trRes = await apiPost<{ text?: string; transcription?: string }>(
        '/chat/transcribe',
        { audio: base64 }
      );
      if (trRes) {
        transcribedText = (trRes.transcription || trRes.text || '').trim();
      }
    } catch (err) {
      console.error('[VoiceSocket] HTTP Transcribe error:', err);
    }

    if (!transcribedText) {
      messages.value = messages.value.filter((m) => m.id !== activeTempId);
      state.value = 'idle';
      toast.error('Could not understand audio. Please speak clearly and try again.');
      return;
    }

    transcription.value = transcribedText;
    const exists = messages.value.find((m) => m.id === activeTempId);
    if (exists) {
      exists.id = `user-${Date.now()}`;
      exists.content = transcribedText;
    } else {
      messages.value.push({
        id: `user-${Date.now()}`,
        conversation_id: convId,
        role: 'user',
        content: transcribedText,
        audio_b64: base64,
        created_at: new Date().toISOString(),
      });
    }

    try {
      const replyRes = await apiPost<{
        reply?: string;
        content?: string;
        audio?: string;
        audio_b64?: string;
        completed_objectives?: string[];
      }>('/chat/message', {
        conversation_id: convId,
        message: transcribedText,
        accent: resolvedAccent,
        origin: 'voice',
        user_audio_b64: base64,
      });

      if (replyRes) {
        const replyText = replyRes.reply || replyRes.content || '';
        const replyAudio = replyRes.audio_b64 || replyRes.audio || '';
        if (replyRes.completed_objectives) {
          completedObjectives.value = replyRes.completed_objectives;
        }

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          conversation_id: convId,
          role: 'assistant',
          content: replyText,
          audio_b64: replyAudio,
          created_at: new Date().toISOString(),
        };

        messages.value.push(aiMsg);

        if (replyAudio) {
          lastAudio.value = replyAudio;
          state.value = 'speaking';
        } else {
          state.value = 'idle';
        }
      } else {
        state.value = 'idle';
      }
    } catch (err) {
      console.error('[VoiceSocket] HTTP Reply error:', err);
      state.value = 'idle';
    } finally {
      isAudioBusy = false;
    }
  }

  async function sendMessageHttp(text: string, convId: string, accent?: string) {
    const resolvedAccent =
      accent ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('tati_voice_accent') || 'en-US'
        : 'en-US');
    state.value = 'processing';
    try {
      const replyRes = await apiPost<{
        reply?: string;
        content?: string;
        audio?: string;
        audio_b64?: string;
        completed_objectives?: string[];
      }>('/chat/message', {
        conversation_id: convId,
        message: text,
        accent: resolvedAccent,
        origin: 'voice',
      });
      if (replyRes) {
        const replyText = replyRes.reply || replyRes.content || '';
        const replyAudio = replyRes.audio_b64 || replyRes.audio || '';
        if (replyRes.completed_objectives) {
          completedObjectives.value = replyRes.completed_objectives;
        }
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          conversation_id: convId,
          role: 'assistant',
          content: replyText,
          audio_b64: replyAudio,
          created_at: new Date().toISOString(),
        };
        messages.value.push(aiMsg);
        if (replyAudio) {
          lastAudio.value = replyAudio;
          state.value = 'speaking';
        } else {
          state.value = 'idle';
        }
      } else {
        state.value = 'idle';
      }
    } catch (err) {
      console.error('[VoiceSocket] HTTP send message error:', err);
      state.value = 'idle';
    }
  }

  async function sendAudio(base64: string, accent?: string) {
    if (!base64 || !base64.trim()) {
      state.value = 'idle';
      return;
    }

    if (isAudioBusy) {
      console.warn('[VoiceSocket] Audio already in progress, ignoring duplicate send');
      return;
    }
    isAudioBusy = true;

    let convId = activeConvId.value;
    if (!convId) {
      convId = await ensureConversation();
      if (!convId) {
        state.value = 'idle';
        isAudioBusy = false;
        return;
      }
    }

    state.value = 'processing';

    const tempId = `voice-temp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempId,
      conversation_id: convId,
      role: 'user',
      content: '🎙 Transcribing...',
      audio_b64: base64,
      created_at: new Date().toISOString(),
    };
    messages.value.push(tempUserMsg);

    let isWsOpen = false;
    try {
      if (socket) {
        await socket.waitUntilOpen(2000);
        isWsOpen = true;
      }
    } catch (_) {
      isWsOpen = false;
    }

    if (!isWsOpen) {
      await sendAudioHttp(base64, convId, accent, tempId);
      return;
    }

    let answered = false;
    const wsWatchdog = setTimeout(async () => {
      if (!answered && state.value === 'processing') {
        console.warn('[VoiceSocket] WebSocket transcription timed out after 35s. Falling back to HTTP REST...');
        answered = true;
        await sendAudioHttp(base64, convId!, accent, tempId);
      }
    }, 35000);

    pendingAudioWsResolver = () => {
      answered = true;
      clearTimeout(wsWatchdog);
    };

    try {
      const msg: WsOutgoingMessage = {
        type: 'audio',
        audio: base64,
        conversation_id: convId,
        origin: 'voice',
        accent:
          accent ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('tati_voice_accent') || 'en-US'
            : 'en-US'),
      };
      socket?.send(msg);
    } catch (e) {
      clearTimeout(wsWatchdog);
      await sendAudioHttp(base64, convId, accent, tempId);
    }
  }

  async function sendMessage(text: string, accent?: string) {
    let convId = activeConvId.value;
    if (!convId) {
      convId = await ensureConversation();
      if (!convId) return;
    }

    state.value = 'processing';

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      conversation_id: convId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    messages.value.push(userMsg);

    let isWsOpen = false;
    try {
      if (socket) {
        await socket.waitUntilOpen(2000);
        isWsOpen = true;
      }
    } catch (_) {
      isWsOpen = false;
    }

    if (!isWsOpen) {
      await sendMessageHttp(text, convId, accent);
      return;
    }

    const resolvedAccent =
      accent ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('tati_voice_accent') || 'en-US'
        : 'en-US');

    const msg: WsOutgoingMessage = {
      type: 'text',
      content: text,
      conversation_id: convId,
      origin: 'voice',
      accent: resolvedAccent,
    };
    socket?.send(msg);
  }

  // Load history when conversationId changes
  async function loadInitialHistory(cId: string) {
    activeConvId.value = cId;
    completedObjectives.value = [];

    // 1. IndexedDB cache load
    try {
      const cached = await getMessagesLocal(cId);
      if (cached.length > 0) {
        messages.value = cached;
        checkAndPollPendingVoice(cached);
        const lastAssistant = [...cached].reverse().find((m) => m.role === 'assistant' && m.audio_b64);
        if (lastAssistant?.audio_b64) {
          lastAudio.value = lastAssistant.audio_b64;
        }
      }
    } catch (_) {}

    // 2. Fetch from backend
    try {
      const history = await apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(cId));
      if (history && history.length > 0) {
        messages.value = history;
        checkAndPollPendingVoice(history);
        const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant' && m.audio_b64);
        if (lastAssistant?.audio_b64) {
          lastAudio.value = lastAssistant.audio_b64;
        }
        saveMessagesLocal(cId, history);
      }
    } catch (err) {
      console.error('Error fetching voice history:', err);
    }
  }

  // Sync to IndexedDB on messages change
  watch(
    () => messages.value.length,
    () => {
      const cId = activeConvId.value;
      if (cId && messages.value.length > 0) {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveMessagesLocal(cId, messages.value);
        }, 1000);
      }
    }
  );

  function connectWs() {
    if (!token.value) return;
    if (socket) {
      socket.disconnect();
    }

    const currentSimId = toValue(simulationId);
    socket = new TatiWebSocket({
      origin: 'voice',
      simulationId: currentSimId || undefined,
      onMessage: handleMessage,
      onClose: () => {
        if (pendingAudioWsResolver) {
          pendingAudioWsResolver();
          pendingAudioWsResolver = null;
        }
        if (state.value === 'processing') {
          messages.value = messages.value.filter(
            (m) =>
              !m.id ||
              (!String(m.id).startsWith('voice-temp-') &&
                !String(m.id).startsWith('live-temp-') &&
                !m.content?.includes('Transcribing'))
          );
          state.value = 'idle';
        }
      },
    });

    socket.connect();
  }

  watch(
    () => token.value,
    (newToken) => {
      if (newToken && !socket) {
        connectWs();
      }
    }
  );

  onMounted(() => {
    const initialId = toValue(conversationId);
    if (initialId) {
      loadInitialHistory(initialId);
    }
    connectWs();
  });

  onUnmounted(() => {
    stopVoicePolling();
    if (saveTimer) clearTimeout(saveTimer);
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  });

  return {
    messages,
    completedObjectives,
    state,
    lastAudio,
    transcription,
    activeConvId,
    sendAudio,
    sendMessage,
    ensureConversation,
    createNewConversation,
  };
}
