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
  const [completedObjectives, setCompletedObjectives] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [lastAudio, setLastAudio] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const socketRef = useRef<TatiWebSocket | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId)
  const convIdRef = useRef<string | null>(conversationId);

  // Sync ref with state
  useEffect(() => {
    convIdRef.current = activeConvId;
  }, [activeConvId]);

  // Criar nova conversa se não houver conversationId e o usuário tentar gravar
  const ensureConversation = useCallback(async () => {
    if (convIdRef.current) return convIdRef.current;

    try {
      const { apiPost } = await import('@/lib/api/client');
      const res = await apiPost<any>('/chat/conversations', {
        title: 'Voice Conversation',
        is_simulation: !!simulationId,
        simulation_id: simulationId || undefined,
      });

      if (res.ok && res.data?.id) {
        const newConvId = res.data.id;
        convIdRef.current = newConvId;
        setActiveConvId(newConvId);
        // Tenta atualizar a URL se possível para manter o estado
        if (typeof window !== 'undefined') {
           const url = new URL(window.location.href);
           url.searchParams.set('conv_id', newConvId);
           window.history.replaceState({}, '', url.toString());
        }
        console.log('[VoiceSocket] Nova conversa criada:', newConvId);
        return newConvId;
      }
    } catch (err) {
      console.error('[VoiceSocket] Erro ao criar conversa:', err);
    }
    return null;
  }, [simulationId]);


  // Carregar histórico inicial se houver convId
  useEffect(() => {
    setCompletedObjectives([]);
    if (conversationId) {
      setActiveConvId(conversationId);
      convIdRef.current = conversationId;

      // 1. Carrega do Cache Local (IndexedDB) para abertura instantânea
      import('@/lib/db/indexedDB').then(({ getMessagesLocal }) => {
        getMessagesLocal(conversationId).then((cachedMsgs) => {
          if (cachedMsgs.length > 0) {
            setMessages(cachedMsgs);
          }
        });
      }).catch(err => console.error('IndexedDB load error in voice hook:', err));

      // 2. SWR - Busca do backend e sincroniza
      apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(conversationId))
        .then(history => {
          // Só atualiza se houver histórico real para não sobrescrever a mensagem inicial das simulações
          if (history && history.length > 0) {
            setMessages(history);
            
            // Salva no cache local
            import('@/lib/db/indexedDB').then(({ saveMessagesLocal }) => {
              saveMessagesLocal(conversationId, history);
            }).catch(err => console.error('IndexedDB save error in voice hook:', err));

            // Se a última mensagem for da IA e tiver áudio, toca ela (saudação inicial de simulação)
            const lastMsg = history[history.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.audio_b64) {
              setLastAudio(lastMsg.audio_b64);
              setState('speaking');
            }
          }
        })
        .catch(err => console.error('Error fetching voice history:', err));
    } else {
      setMessages([]);
      setActiveConvId(null);
      convIdRef.current = null;
    }
  }, [conversationId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ conversationId: string; messages: Message[] } | null>(null);

  useEffect(() => {
    if (conversationId && messages && messages.length > 0) {
      pendingSaveRef.current = { conversationId, messages };
      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null;
          const pending = pendingSaveRef.current;
          if (pending) {
            import('@/lib/db/indexedDB').then(({ saveMessagesLocal }) => {
              saveMessagesLocal(pending.conversationId, pending.messages);
            }).catch(err => console.error('IndexedDB sync error in useVoiceSocket:', err));
            pendingSaveRef.current = null;
          }
        }, 1000);
      }
    }
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [messages, conversationId]);

  const handleMessage = useCallback((msg: WsIncomingMessage) => {
    const currentId = convIdRef.current;
    switch (msg.type) {
      case 'transcription':
        if (msg.text) {
          setState('processing');
          setTranscription(msg.text);
          setMessages((prev) => {
            // Remove apenas as mensagens que EXPLICITAMENTE começam com o prefixo temporário
            // Mensagens sem ID ou com IDs normais são mantidas
            const filtered = prev.filter(m => {
              if (m.id && typeof m.id === 'string' && m.id.startsWith('voice-temp-')) {
                return false;
              }
              return true;
            });
            const newUserMsg: Message = {
              id: `user-${Date.now()}`,
              conversation_id: currentId || '',
              role: 'user',
              content: msg.text || '',
              created_at: new Date().toISOString(),
            };
            return [...filtered, newUserMsg];
          });
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
              conversation_id: currentId || '',
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
          if (msg.completed_objectives) {
            setCompletedObjectives(msg.completed_objectives);
          }
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
                conversation_id: currentId || '',
                role: 'assistant',
                content: msg.content || '',
                created_at: new Date().toISOString(),
                audio_b64: msg.audio
              }];
            });
          }
        }
        break;

      case 'simulation_state':
        if (msg.completed_objectives) {
          setCompletedObjectives(msg.completed_objectives);
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
  }, []);

  // Re-conecta o WebSocket sempre que o token ou a função de mensagem mudar
  // Agora handleMessage é estável, então só reconecta se simulationId mudar ou token
  useEffect(() => {
    if (!token) return;

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

  const sendAudio = useCallback(async (base64: string, accent?: string) => {
    if (!socketRef.current) return;

    // Garante que tem uma conversationId antes de enviar
    let convId = convIdRef.current;
    if (!convId) {
      convId = await ensureConversation();
      if (!convId) {
        console.error('[VoiceSocket] Não foi possível criar conversa');
        setState('idle');
        return;
      }
    }

    try {
      await socketRef.current.waitUntilOpen();
    } catch (e) {
      console.error('[VoiceSocket] Socket not ready:', e);
      setState('idle');
      return;
    }

    setState('processing');

    // Add optimistic user message
    const tempUserMsg: Message = {
      id: `voice-temp-${Date.now()}`,
      conversation_id: convId,
      role: 'user',
      content: '🎙 Recording...',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const msg: WsOutgoingMessage = {
      type: 'audio',
      audio: base64,
      conversation_id: convId,
      origin: 'voice',
      accent: accent || (typeof window !== 'undefined' ? localStorage.getItem('tati_voice_accent') || 'en-US' : 'en-US'),
    } as any;
    socketRef.current.send(msg);
  }, [ensureConversation]);

  return {
    messages,
    setMessages,
    state,
    setState,
    lastAudio,
    transcription,
    sendAudio,
    activeConvId,
    completedObjectives,
    setCompletedObjectives
  };
}
