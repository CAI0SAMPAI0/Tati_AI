import { apiGet, apiPost, apiDelete } from './client';
import { ENDPOINTS } from './endpoints';
import type { Conversation, Message } from './types';

export async function getConversations(): Promise<Conversation[]> {
  return apiGet<Conversation[]>(ENDPOINTS.CONVERSATIONS);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(conversationId));
}

export async function createConversation(title: string = 'New Conversation'): Promise<Conversation> {
  return apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, { title });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  return apiDelete(`${ENDPOINTS.CONVERSATIONS}/${conversationId}`);
}

export async function sendMessage(
  conversationId: string,
  payload: { content: string; audio_b64?: string }
): Promise<Message> {
  return apiPost<Message>(ENDPOINTS.CONVERSATION_MESSAGES(conversationId), payload);
}

export async function getChatTts(text: string, accent: string = 'en-US'): Promise<{ audio_b64: string }> {
  return apiPost<{ audio_b64: string }>(ENDPOINTS.CHAT_TTS, { text, accent });
}
