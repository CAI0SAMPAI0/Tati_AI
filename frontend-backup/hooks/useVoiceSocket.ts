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
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId);
  const convIdRef = useRef<string | null>(conversationId);
  const pendingAudioWsRef = useRef<(() => void) | null>(null);

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
        title: 'Nova Conversa com a Teacher Tati',
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


  const voicePollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopVoicePolling = useCallback(() => {
    if (voicePollTimerRef.current) {
      clearInterval(voicePollTimerRef.current);
      voicePollTimerRef.current = null;
    }
  }, []);

  const checkAndPollPendingVoice = useCallback((history: Message[]) => {
    stopVoicePolling();
    const convId = convIdRef.current;
    if (!convId || !history || history.length === 0) return;

    const lastMsg = history[history.length - 1];
    const ageMs = Date.now() - new Date(lastMsg.created_at).getTime();
    if (lastMsg.role === 'user' && !isNaN(ageMs) && ageMs < 30000) {
      setState('processing');
      let attempts = 0;
      const maxAttempts = 18;

      voicePollTimerRef.current = setInterval(async () => {
        attempts++;
        try {
          const fresh = await apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(convId));
          if (fresh && fresh.length > 0) {
            const freshLast = fresh[fresh.length - 1];
            if (freshLast.role === 'assistant') {
              setMessages(fresh);
              setState('idle');
              if (freshLast.audio_b64) {
                setLastAudio(freshLast.audio_b64);
              }
              stopVoicePolling();
              import('@/lib/db/indexedDB').then(({ saveMessagesLocal }) => {
                saveMessagesLocal(convId, fresh);
              });
              return;
            }
          }
        } catch (_) {}

        if (attempts >= maxAttempts) {
          stopVoicePolling();
          setState('idle');
        }
      }, 1500);
    }
  }, [stopVoicePolling]);

  useEffect(() => {
    return () => {
      stopVoicePolling();
    };
  }, [stopVoicePolling]);

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
            checkAndPollPendingVoice(cachedMsgs);
            const lastAssistantMsg = [...cachedMsgs].reverse().find(m => m.role === 'assistant' && m.audio_b64);
            if (lastAssistantMsg?.audio_b64) {
              setLastAudio(lastAssistantMsg.audio_b64);
            }
          }
        });
      }).catch(err => console.error('IndexedDB load error in voice hook:', err));

      // 2. SWR - Busca do backend e sincroniza
      apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(conversationId))
        .then(history => {
          // Só atualiza se houver histórico real para não sobrescrever a mensagem inicial das simulações
          if (history && history.length > 0) {
            setMessages(history);
            checkAndPollPendingVoice(history);
            const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant' && m.audio_b64);
            if (lastAssistantMsg?.audio_b64) {
              setLastAudio(lastAssistantMsg.audio_b64);
            }
            
            // Salva no cache local
            import('@/lib/db/indexedDB').then(({ saveMessagesLocal }) => {
              saveMessagesLocal(conversationId, history);
            }).catch(err => console.error('IndexedDB save error in voice hook:', err));
          }
        })
        .catch(err => console.error('Error fetching voice history:', err));
    } else {
      stopVoicePolling();
      setMessages([]);
      setActiveConvId(null);
      convIdRef.current = null;
    }
  }, [conversationId, checkAndPollPendingVoice, stopVoicePolling]);

  // Revalidação em segundo plano ao retornar para a aba (Visibility / Focus)
  useEffect(() => {
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible' && convIdRef.current) {
        apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(convIdRef.current))
          .then((history) => {
            if (history && history.length > 0) {
              setMessages(history);
              checkAndPollPendingVoice(history);
              import('@/lib/db/indexedDB').then(({ saveMessagesLocal }) => {
                if (convIdRef.current) saveMessagesLocal(convIdRef.current, history);
              });
            }
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleRevalidate);
    window.addEventListener('focus', handleRevalidate);
    return () => {
      document.removeEventListener('visibilitychange', handleRevalidate);
      window.removeEventListener('focus', handleRevalidate);
    };
  }, [checkAndPollPendingVoice]);

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
    if (
      msg.type === 'transcription' ||
      msg.type === 'stream_start' ||
      msg.type === 'audio_response' ||
      msg.type === 'error'
    ) {
      if (pendingAudioWsRef.current) {
        pendingAudioWsRef.current();
        pendingAudioWsRef.current = null;
      }
    }

    switch (msg.type) {
      case 'transcription':
        if (msg.text) {
          setState('processing');
          setTranscription(msg.text);
          setMessages((prev) => {
            const tempMsg = prev.find(
              (m) =>
                m.id &&
                typeof m.id === 'string' &&
                (m.id.startsWith('voice-temp-') || m.id.startsWith('live-temp-'))
            );
            const prevAudio = tempMsg?.audio_b64;

            const filtered = prev.filter((m) => {
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
            return [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                conversation_id: currentId || '',
                role: 'assistant',
                content: tokenContent,
                created_at: new Date().toISOString(),
              },
            ];
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
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: msg.content || '', audio_b64: msg.audio },
                ];
              }
              return [
                ...prev,
                {
                  id: `ai-${Date.now()}`,
                  conversation_id: currentId || '',
                  role: 'assistant',
                  content: msg.content || '',
                  created_at: new Date().toISOString(),
                  audio_b64: msg.audio,
                },
              ];
            });
          }
        }
        break;

      case 'simulation_state':
        if (msg.completed_objectives) {
          setCompletedObjectives(msg.completed_objectives);
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
        setMessages((prev) =>
          prev.filter(
            (m) =>
              !m.id ||
              (!m.id.startsWith('voice-temp-') &&
                !m.id.startsWith('live-temp-'))
          )
        );
        break;

      case 'error':
        setMessages((prev) =>
          prev.filter(
            (m) =>
              !m.id ||
              (!m.id.startsWith('voice-temp-') &&
                !m.id.startsWith('live-temp-') &&
                !m.content?.includes('Transcribing'))
          )
        );
        setState('idle');
        console.error('Voice WS Error:', msg.message);
        break;
    }
  }, []);

  // Re-conecta o WebSocket sempre que o token ou a função de mensagem mudar
  useEffect(() => {
    if (!token) return;

    const ws = new TatiWebSocket({
      origin: 'voice',
      simulationId: simulationId || undefined,
      onMessage: handleMessage,
      onClose: () => {
        if (pendingAudioWsRef.current) {
          pendingAudioWsRef.current();
          pendingAudioWsRef.current = null;
        }
        setState((curr) => {
          if (curr === 'processing') {
            setMessages((prev) =>
              prev.filter(
                (m) =>
                  !m.id ||
                  (!m.id.startsWith('voice-temp-') &&
                    !m.id.startsWith('live-temp-') &&
                    !m.content?.includes('Transcribing'))
              )
            );
            return 'idle';
          }
          return curr;
        });
      },
    });

    socketRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [token, handleMessage, simulationId]);

  // Robust HTTP Fallback for sending audio
  const sendAudioHttp = useCallback(
    async (base64: string, convId: string, accent?: string, tempId?: string) => {
      const activeTempId = tempId || `voice-temp-${Date.now()}`;
      const resolvedAccent =
        accent ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('tati_voice_accent') || 'en-US'
          : 'en-US');

      setState('processing');

      // 1. Transcribe via POST /chat/transcribe
      let transcribedText = '';
      try {
        const { apiPost } = await import('@/lib/api/client');
        const trRes = await apiPost<{ text?: string; transcription?: string }>(
          '/chat/transcribe',
          { audio: base64 }
        );
        if (trRes.ok && trRes.data) {
          transcribedText = (
            trRes.data.transcription ||
            trRes.data.text ||
            ''
          ).trim();
        }
      } catch (err) {
        console.error('[VoiceSocket] HTTP Transcribe error:', err);
      }

      if (!transcribedText) {
        // Clean up temp message and reset state
        setMessages((prev) => prev.filter((m) => m.id !== activeTempId));
        setState('idle');
        import('react-hot-toast').then(({ default: toast }) => {
          toast.error('Could not understand audio. Please speak clearly and try again.', {
            id: 'voice-stt-empty',
          });
        });
        return;
      }

      // Update the temporary message with the recognized transcription
      setTranscription(transcribedText);
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === activeTempId);
        if (exists) {
          return prev.map((m) =>
            m.id === activeTempId
              ? {
                  ...m,
                  id: `user-${Date.now()}`,
                  content: transcribedText,
                }
              : m
          );
        }
        return [
          ...prev,
          {
            id: `user-${Date.now()}`,
            conversation_id: convId,
            role: 'user',
            content: transcribedText,
            audio_b64: base64,
            created_at: new Date().toISOString(),
          },
        ];
      });

      // 2. Send message & get neural reply with accent via POST /chat/message
      try {
        const { apiPost } = await import('@/lib/api/client');
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

        if (replyRes.ok && replyRes.data) {
          const replyText =
            replyRes.data.reply || replyRes.data.content || '';
          const replyAudio =
            replyRes.data.audio_b64 || replyRes.data.audio || '';
          if (replyRes.data.completed_objectives) {
            setCompletedObjectives(replyRes.data.completed_objectives);
          }

          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            conversation_id: convId,
            role: 'assistant',
            content: replyText,
            audio_b64: replyAudio,
            created_at: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, aiMsg]);

          if (replyAudio) {
            setLastAudio(replyAudio);
            setState('speaking');
          } else {
            setState('idle');
          }
        } else {
          setState('idle');
        }
      } catch (err) {
        console.error('[VoiceSocket] HTTP Reply error:', err);
        setState('idle');
      }
    },
    []
  );

  // Robust HTTP Fallback for sending text
  const sendMessageHttp = useCallback(
    async (text: string, convId: string, accent?: string) => {
      const resolvedAccent =
        accent ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('tati_voice_accent') || 'en-US'
          : 'en-US');
      setState('processing');
      try {
        const { apiPost } = await import('@/lib/api/client');
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
        if (replyRes.ok && replyRes.data) {
          const replyText =
            replyRes.data.reply || replyRes.data.content || '';
          const replyAudio =
            replyRes.data.audio_b64 || replyRes.data.audio || '';
          if (replyRes.data.completed_objectives) {
            setCompletedObjectives(replyRes.data.completed_objectives);
          }
          const aiMsg: Message = {
            id: `ai-${Date.now()}`,
            conversation_id: convId,
            role: 'assistant',
            content: replyText,
            audio_b64: replyAudio,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMsg]);
          if (replyAudio) {
            setLastAudio(replyAudio);
            setState('speaking');
          } else {
            setState('idle');
          }
        } else {
          setState('idle');
        }
      } catch (err) {
        console.error('[VoiceSocket] HTTP send message error:', err);
        setState('idle');
      }
    },
    []
  );

  const sendAudio = useCallback(
    async (base64: string, accent?: string) => {
      if (!base64 || !base64.trim()) {
        console.warn('[VoiceSocket] sendAudio ignorado: base64 vazio');
        setState('idle');
        return;
      }

      let convId = convIdRef.current;
      if (!convId) {
        convId = await ensureConversation();
        if (!convId) {
          console.error('[VoiceSocket] Não foi possível criar conversa');
          setState('idle');
          return;
        }
      }

      setState('processing');

      const tempId = `voice-temp-${Date.now()}`;
      const tempUserMsg: Message = {
        id: tempId,
        conversation_id: convId,
        role: 'user',
        content: '🎙 Transcribing...',
        audio_b64: base64,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      // Check if WebSocket is open and connected
      let isWsOpen = false;
      try {
        if (socketRef.current) {
          await socketRef.current.waitUntilOpen(2000);
          isWsOpen = true;
        }
      } catch (_) {
        isWsOpen = false;
      }

      if (!isWsOpen) {
        console.log('[VoiceSocket] WebSocket unavailable, falling back to HTTP REST');
        await sendAudioHttp(base64, convId, accent, tempId);
        return;
      }

      // WebSocket is connected, attempt WS send with watchdog fallback
      let answered = false;
      const wsWatchdog = setTimeout(async () => {
        if (!answered) {
          console.warn('[VoiceSocket] WebSocket transcription timed out after 6s. Falling back to HTTP REST...');
          await sendAudioHttp(base64, convId!, accent, tempId);
        }
      }, 6000);

      pendingAudioWsRef.current = () => {
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
        } as any;
        socketRef.current?.send(msg);
      } catch (e) {
        clearTimeout(wsWatchdog);
        console.error('[VoiceSocket] WS send error, falling back to HTTP:', e);
        await sendAudioHttp(base64, convId, accent, tempId);
      }
    },
    [ensureConversation, sendAudioHttp]
  );

  const sendMessage = useCallback(
    async (text: string, accent?: string) => {
      let convId = convIdRef.current;
      if (!convId) {
        convId = await ensureConversation();
        if (!convId) {
          console.error('[VoiceSocket] Could not create conversation');
          return;
        }
      }

      setState('processing');

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        conversation_id: convId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      let isWsOpen = false;
      try {
        if (socketRef.current) {
          await socketRef.current.waitUntilOpen(2000);
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
      } as any;
      socketRef.current?.send(msg);
    },
    [ensureConversation, sendMessageHttp]
  );

  return {
    messages,
    setMessages,
    state,
    setState,
    lastAudio,
    transcription,
    sendAudio,
    sendMessage,
    activeConvId,
    completedObjectives,
    setCompletedObjectives
  };
}
