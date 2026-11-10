import { apiGet, apiPost, apiPatch, apiDelete, apiFetch } from './client';
import { ENDPOINTS } from './endpoints';
import type { Conversation, Message } from './types';

export async function getConversations(limit: number = 20, offset: number = 0): Promise<Conversation[]> {
  return apiGet<Conversation[]>(`${ENDPOINTS.CONVERSATIONS}?limit=${limit}&offset=${offset}`);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(conversationId));
}

export const getConversationMessages = getMessages;

export async function createConversation(title: string = 'Nova Conversa com a Teacher Tati'): Promise<Conversation> {
  return apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, { title });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  return apiDelete(`${ENDPOINTS.CONVERSATIONS}/${conversationId}`);
}

export async function deleteAllConversations(): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(ENDPOINTS.CONVERSATIONS);
}

export interface SendMessageResponse {
  ok: boolean;
  reply: string;
  role: string;
  audio?: string;
  audio_b64?: string;
  correction?: string | null;
  conversation_id?: string;
  id?: string;
  user_message_id?: string;
}

export async function sendChatMessage(
  conversationId: string,
  message: string,
  audioB64?: string,
  accent: string = 'en-US',
  origin?: string
): Promise<SendMessageResponse> {
  return apiPost<SendMessageResponse>(ENDPOINTS.CHAT_MESSAGE, {
    conversation_id: conversationId,
    message,
    audio_b64: audioB64,
    user_audio_b64: audioB64,
    accent,
    origin: origin || (audioB64 ? 'voice' : 'chat'),
    synthesize_audio: true,
  });
}

export async function streamChatMessage(
  conversationId: string,
  message: string,
  onToken?: (token: string) => void,
  audioB64?: string,
  accent: string = 'en-US',
  origin?: string
): Promise<SendMessageResponse> {
  const payload = {
    conversation_id: conversationId,
    message,
    audio_b64: audioB64,
    user_audio_b64: audioB64,
    accent,
    origin: origin || (audioB64 ? 'voice' : 'chat'),
    synthesize_audio: true,
  };

  try {
    const resp = await apiFetch(`${ENDPOINTS.CHAT_MESSAGE}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok || !resp.body) {
      return sendChatMessage(conversationId, message, audioB64, accent, origin);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalRes: SendMessageResponse | null = null;
    let accumulatedReply = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        const line = block.trim();
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.replace(/^data:\s*/, '');
        try {
          const ev = JSON.parse(jsonStr);
          if (ev.type === 'token' && typeof ev.token === 'string') {
            accumulatedReply += ev.token;
            if (onToken) onToken(ev.token);
          } else if (ev.type === 'done') {
            finalRes = {
              ok: true,
              reply: ev.reply || accumulatedReply,
              role: 'assistant',
              audio: ev.audio_b64 || ev.audio,
              audio_b64: ev.audio_b64 || ev.audio,
              id: ev.id,
              user_message_id: ev.user_message_id,
              conversation_id: conversationId,
            };
          } else if (ev.type === 'error') {
            throw new Error(ev.message || 'Stream error');
          }
        } catch (err: any) {
          if (err?.message === 'Stream error') throw err;
        }
      }
    }

    if (finalRes) {
      return finalRes;
    }
    if (accumulatedReply) {
      return {
        ok: true,
        reply: accumulatedReply,
        role: 'assistant',
        conversation_id: conversationId,
      };
    }
  } catch (err) {
    console.warn('[Chat Stream] Fallback to standard POST:', err);
  }

  return sendChatMessage(conversationId, message, audioB64, accent, origin);
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  content: string,
  accent: string = 'en-US'
): Promise<any> {
  return apiPatch(ENDPOINTS.EDIT_MESSAGE(conversationId, messageId), {
    content,
    accent,
  });
}

export async function getChatTts(text: string, accent: string = 'en-US'): Promise<{ audio?: string; audio_b64?: string }> {
  return apiPost<{ audio?: string; audio_b64?: string }>(ENDPOINTS.CHAT_TTS, { text, accent });
}

export interface WordLookupResult {
  word: string;
  lemma?: string;
  partOfSpeech?: string;
  phonetic?: string;
  translation: string;
  english_definition?: string;
  portuguese_explanation?: string;
  example?: string;
  example_pt?: string;
  audio?: string;
  audio_b64?: string;
}

export async function lookupWord(word: string, accent: string = 'en-US'): Promise<WordLookupResult> {
  return apiPost<WordLookupResult>(ENDPOINTS.WORD_LOOKUP, { word, accent });
}

export async function startLeveling(totalQuestions: number = 8, accent: string = 'en-US'): Promise<any> {
  return apiPost(ENDPOINTS.LEVELING_START, { total_questions: totalQuestions, accent });
}

export async function getLevelingStatus(): Promise<{ active?: boolean; has_completed?: boolean; never_taken?: boolean }> {
  return apiGet(ENDPOINTS.LEVELING_STATUS);
}

export async function getConversationSummary(conversationId: string, lang: string = 'pt'): Promise<{ summary: string }> {
  return apiGet(ENDPOINTS.CONVERSATION_SUMMARY(conversationId) + `?lang=${lang}`);
}

