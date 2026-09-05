'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatSocket } from '@/lib/ws/chat-socket';
import type { WsIncomingMessage } from '@/lib/ws/types';
import type { Message } from '@/lib/api/types';
import { useAuth } from './useAuth';
import { useErrorCountStore } from '@/store/error-store';
import { useChatSocketInstance } from '@/providers/chat-socket-provider';
import { apiPost } from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useChatSocket(conversationId: string | null) {
  const { token } = useAuth();
  const { socket } = useChatSocketInstance();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef('');
  const [isConnected, setIsConnected] = useState(false);
  
  const errorCount = useErrorCountStore(s => s.errorCount);
  const increment = useErrorCountStore(s => s.increment);
  const reset = useErrorCountStore(s => s.reset);
  
  const convIdRef = useRef<string | null>(conversationId);
  const pendingPdfRef = useRef<{ pdf_b64: string; filename: string } | null>(null);
  const pendingAudioRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    convIdRef.current = conversationId;
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
            }).catch(err => console.error('IndexedDB sync error in useChatSocket:', err));
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

  const handleTriggerExercise = useCallback(async () => {
    // Reset ANTES da chamada (fail-safe)
    reset();
    
    try {
      toast.loading('Identifying areas for improvement... Generating personalized exercise.', { id: 'gen-exercise' });
      const res = await apiPost('/activities/exercises/generate', {
        conversation_id: convIdRef.current
      });
      
      if (res.ok) {
        toast.success('New exercise generated! Check your activities.', { id: 'gen-exercise' });
      } else {
        toast.error('Could not generate exercise right now.', { id: 'gen-exercise' });
      }
    } catch (err) {
      toast.error('Connection error while generating exercise.', { id: 'gen-exercise' });
    }
  }, [reset]);

  const handleMessage = useCallback((msg: WsIncomingMessage) => {
    const currentId = convIdRef.current;
    switch (msg.type) {
      case 'stream_start':
        setIsStreaming(true);
        setStreamingContent('');
        streamingRef.current = '';
        pendingPdfRef.current = null;
        break;
      case 'stream_token':
        const tok = msg.token || msg.content || '';
        streamingRef.current += tok;
        setStreamingContent(streamingRef.current);
        break;
      case 'stream_end':
        setIsStreaming(false);
        const finalContent = streamingRef.current;
        if (finalContent) {
          const newAssistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            conversation_id: currentId || '',
            role: 'assistant',
            content: finalContent,
            audio_b64: pendingAudioRef.current || null,
            created_at: new Date().toISOString(),
            pdf_b64: pendingPdfRef.current?.pdf_b64 || null,
            pdf_filename: pendingPdfRef.current?.filename || null,
          };
          pendingAudioRef.current = null;
          
          setMessages((prev) => {
            // Avoid duplicates by ID
            if (prev.some(m => m.id === newAssistantMsg.id)) return prev;
            // Avoid duplicates by content (echo suppression)
            if (prev.length > 0 && 
                prev[prev.length - 1].content === finalContent && 
                prev[prev.length - 1].role === 'assistant') {
              return prev;
            }
            return [...prev, newAssistantMsg];
          });

          // Error Detection Logic
          if (msg.result && (msg.result as any).has_linguistic_error) {
            increment();
            // Trigger when reaching 3 errors
            if (errorCount + 1 === 3) {
              handleTriggerExercise();
            }
          }

          setStreamingContent('');
          streamingRef.current = '';
          pendingPdfRef.current = null;
        }
        break;
      case 'transcription':
        const userText = msg.text || msg.content;
        if (userText) {
          setMessages((prev) => {
            // Se existir a mensagem temporária de áudio, substitui ela
            const hasTemp = prev.some(m => m.id === 'user-audio-temp');
            if (hasTemp) {
              return prev.map(m => 
                m.id === 'user-audio-temp' 
                  ? { ...m, content: userText, id: `user-${Date.now()}` } 
                  : m
              );
            }

            const newUserMsg: Message = {
              id: `user-${Date.now()}`,
              conversation_id: currentId || '',
              role: 'user',
              content: userText,
              created_at: new Date().toISOString(),
            };
            if (prev.some(m => m.id === newUserMsg.id)) return prev;
            if (prev.length > 0 && prev[prev.length - 1].content === userText && prev[prev.length - 1].role === 'user') return prev;
            return [...prev, newUserMsg];
          });
        }
        break;
      case 'audio_response':
        if (msg.audio) {
          pendingAudioRef.current = msg.audio;
          setMessages((prev) => {
            const last = [...prev];
            for (let i = last.length - 1; i >= 0; i--) {
              if (last[i].role === 'assistant') {
                last[i] = { ...last[i], audio_b64: msg.audio };
                break;
              }
            }
            return last;
          });
        }
        break;
      case 'pdf_generated':
        pendingPdfRef.current = {
          pdf_b64: msg.pdf_b64 || '',
          filename: msg.filename || 'Documento.pdf',
        };
        if (msg.text) {
          streamingRef.current = msg.text;
          setStreamingContent(msg.text);
        }
        break;
      case 'message_id_update':
        if (msg.real_id && msg.role) {
          setMessages((prev) => {
            const last = [...prev];
            for (let i = last.length - 1; i >= 0; i--) {
              if (last[i].role === msg.role) {
                last[i] = { ...last[i], id: String(msg.real_id) };
                break;
              }
            }
            return last;
          });
        }
        break;
      case 'error':
        setIsStreaming(false);
        console.error('WS Error:', msg.message);
        break;
    }
  }, [errorCount, increment, handleTriggerExercise]);

  useEffect(() => {
    if (!socket) return;

    socket.updateConfig({
      onEvent: handleMessage,
      onOpen: () => setIsConnected(true),
      onClose: () => setIsConnected(false),
      onError: () => setIsConnected(false),
      onUnauthorized: () => setIsConnected(false),
    });

    // We set initial state if socket is already open
    if (socket.readyState === WebSocket.OPEN) {
      setIsConnected(true);
    }

    return () => {
      // No need to disconnect here anymore, 
      // but we could reset handlers if we wanted.
      socket.updateConfig({ onEvent: () => {} });
    };
  }, [socket, handleMessage]);

  const sendMessage = useCallback(async (text: string, overrideConvId?: string) => {
    if (!socket) return;
    
    pendingPdfRef.current = null;
    try {
      await socket.waitUntilOpen();
    } catch (e) {
      console.error('Socket not ready:', e);
      return;
    }

    const currentId = overrideConvId ?? convIdRef.current;
    if (overrideConvId) {
      convIdRef.current = overrideConvId;
    }

    const sent = socket.send({
      type: 'text',
      content: text,
      conversation_id: currentId,
      origin: 'chat',
    });
    if (!sent) return;

    // Ativa animação das reticências (...) imediatamente ao enviar a mensagem
    setIsStreaming(true);
    setStreamingContent('');
    streamingRef.current = '';

    const newUserMsg: Message = {
      id: `user-sent-${Date.now()}`,
      conversation_id: currentId || '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => {
      if (prev.some(m => m.id === newUserMsg.id)) return prev;
      return [...prev, newUserMsg];
    });
  }, [socket]);

  const sendAudio = useCallback(async (base64: string, overrideConvId?: string) => {
    if (!socket) return;
    
    pendingPdfRef.current = null;
    try {
      await socket.waitUntilOpen();
    } catch (e) {
      console.error('Socket not ready:', e);
      return;
    }

    const currentId = overrideConvId ?? convIdRef.current;
    if (overrideConvId) {
      convIdRef.current = overrideConvId;
    }
    
    // We send 'audio' type as per the websocket protocol
    const sent = socket.send({
      type: 'audio',
      audio: base64,
      conversation_id: currentId,
      origin: 'chat',
    });
    
    if (sent) {
      setIsStreaming(true);
      setStreamingContent('');
      streamingRef.current = '';

      const newUserMsg: Message = {
        id: `user-audio-temp`,
        conversation_id: currentId || '',
        role: 'user',
        content: 'Voice message',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newUserMsg]);
    }
  }, [socket]);

  const sendFile = useCallback(async (filename: string, base64: string, caption?: string, overrideConvId?: string) => {
    if (!socket) return;

    pendingPdfRef.current = null;
    try {
      await socket.waitUntilOpen();
    } catch (e) {
      console.error('Socket not ready:', e);
      return;
    }

    const currentId = overrideConvId ?? convIdRef.current;
    if (overrideConvId) {
      convIdRef.current = overrideConvId;
    }
    
    const sent = socket.send({
      type: 'file',
      filename,
      content: base64, // backend expects base64 content in 'content' field
      caption,
      conversation_id: currentId,
      origin: 'chat',
    });
    
    if (sent) {
      setIsStreaming(true);
      setStreamingContent('');
      streamingRef.current = '';

      const displayContent = caption 
        ? `${caption}\n\n📎 [Arquivo: ${filename}]` 
        : `📎 [Arquivo: ${filename}]`;
        
      const newUserMsg: Message = {
        id: `user-file-${Date.now()}`,
        conversation_id: currentId || '',
        role: 'user',
        content: displayContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newUserMsg]);
    }
  }, [socket]);

  return {
    messages,
    setMessages,
    isStreaming,
    streamingContent,
    isConnected,
    sendMessage,
    sendAudio,
    sendFile,
  };
}
