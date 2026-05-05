'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TatiWebSocket } from '@/lib/ws/socket';
import type { WsIncomingMessage, WsOutgoingMessage } from '@/lib/ws/types';
import type { Message } from '@/lib/api/types';
import { useAuth } from './useAuth';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export function useVoiceSocket(conversationId: string | null, simulationId?: string | null) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [lastAudio, setLastAudio] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const socketRef = useRef<TatiWebSocket | null>(null);

  // Carregar histórico inicial se houver convId
  useEffect(() => {
    if (conversationId) {
      apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(conversationId))
        .then(history => {
          setMessages(history);
          // Se a última mensagem for da IA e tiver áudio, toca ela (saudação inicial de simulação)
          const lastMsg = history[history.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.audio_b64) {
            setLastAudio(lastMsg.audio_b64);
            setState('speaking');
          }
        })
        .catch(err => console.error('Error fetching voice history:', err));
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const handleMessage = useCallback((msg: WsIncomingMessage) => {
    switch (msg.type) {
      case 'transcription':
        if (msg.text) {
          setState('processing');
          setTranscription(msg.text);
          const newUserMsg: Message = {
            id: `user-${Date.now()}`,
            conversation_id: conversationId || '',
            role: 'user',
            content: msg.text,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, newUserMsg]);
        }
        break;
      
      case 'stream_start':
        setState('processing');
        setTranscription('');
        break;

      case 'stream_token':
        setState('processing');
        if (msg.content) {
          const tokenContent = msg.content;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              const updated = { ...last, content: last.content + tokenContent };
              return [...prev.slice(0, -1), updated];
            }
            return [...prev, {
              id: `ai-${Date.now()}`,
              conversation_id: conversationId || '',
              role: 'assistant',
              content: tokenContent,
              created_at: new Date().toISOString(),
            }];
          });
        }
        break;
      
      case 'audio_response':
        if (msg.audio) {
          setLastAudio(msg.audio);
          setState('speaking');
          if (msg.content) {
            setMessages((prev) => {
               const last = prev[prev.length - 1];
               if (last && last.role === 'assistant') {
                 if (last.content === msg.content) {
                   return [...prev.slice(0, -1), { ...last, audio_b64: msg.audio }];
                 }
                 return [...prev.slice(0, -1), { ...last, content: msg.content || '', audio_b64: msg.audio }];
               }
               return [...prev, {
                  id: `ai-${Date.now()}`,
                  conversation_id: conversationId || '',
                  role: 'assistant',
                  content: msg.content || '',
                  created_at: new Date().toISOString(),
                  audio_b64: msg.audio
               }];
            });
          }
        }
        break;

      case 'stream_end':
        setState((curr) => curr === 'processing' ? 'idle' : curr);
        break;

      case 'error':
        setState('idle');
        console.error('Voice WS Error:', msg.message);
        break;
    }
  }, [conversationId]);

  // Re-conecta o WebSocket sempre que o token ou a função de mensagem mudar (que depende do convId)
  useEffect(() => {
    if (!token) return;

    // Se não tivermos conversationId e não for simulação, esperamos
    // Mas no caso de simulação, o backend pode precisar do simulation_id no query param
    const ws = new TatiWebSocket({
      origin: 'voice',
      simulationId: simulationId || undefined,
      onMessage: handleMessage,
    });

    socketRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [token, handleMessage, simulationId]);

  const sendAudio = useCallback((base64: string) => {
    if (!socketRef.current) return;
    
    // Se ainda não temos conversationId, não enviamos para evitar erro no banco
    if (!conversationId) {
      console.warn('Attempted to send audio without conversationId');
      return;
    }

    setState('processing');
    const msg: WsOutgoingMessage = {
      type: 'audio',
      audio: base64,
      conversation_id: conversationId,
      origin: 'voice',
    };
    socketRef.current.send(msg);
  }, [conversationId]);

  return {
    messages,
    setMessages,
    state,
    setState,
    lastAudio,
    transcription,
    sendAudio,
  };
}
