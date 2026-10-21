import { apiGet, apiPost, apiPatch, apiDelete } from './client';
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

