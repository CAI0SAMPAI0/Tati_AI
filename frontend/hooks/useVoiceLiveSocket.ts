'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { WS_BASE } from '@/lib/api/client';
import type { WsIncomingMessage } from '@/lib/ws/types';
import type { Message } from '@/lib/api/types';

export function useVoiceLiveSocket() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [lastAudio, setLastAudio] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!token || typeof window === 'undefined') return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const url = `${WS_BASE}/voice/live?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[LiveWS] Connected');
      setState('idle');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsIncomingMessage = JSON.parse(event.data);
        switch (msg.type) {
          case 'transcription':
            if (msg.text) {
              setTranscription(msg.text);
              setState('processing');
              setMessages((prev) => [
                ...prev.filter(m => !m.id.startsWith('live-temp-')),
                {
                  id: `user-${Date.now()}`,
                  conversation_id: 'live',
                  role: 'user',
                  content: msg.text || '',
                  created_at: new Date().toISOString(),
                }
              ]);
            }
            break;

          case 'stream_token':
            if (msg.content) {
              setState('processing');
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: last.content + msg.content }
                  ];
                }
                return [
                  ...prev,
                  {
                    id: `ai-${Date.now()}`,
                    conversation_id: 'live',
                    role: 'assistant',
                    content: msg.content || '',
                    created_at: new Date().toISOString(),
                  }
                ];
              });
            }
            break;

          case 'audio_response':
            if (msg.audio) {
              setLastAudio(msg.audio);
              setState('speaking');
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, audio_b64: msg.audio }
                  ];
                }
                return prev;
              });
            }
            break;

          case 'stream_end':
            setState('listening');
            break;
        }
      } catch (err) {
        console.error('[LiveWS] Message error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[LiveWS] Closed');
      reconnectTimerRef.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = (err) => {
      console.error('[LiveWS] Error:', err);
    };
  }, [token]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendAudioChunk = useCallback((base64: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'audio',
      audio: base64
    }));
  }, []);

  return {
    messages,
    setMessages,
    state,
    setState,
    lastAudio,
    transcription,
    connect,
    disconnect,
    sendAudioChunk
  };
}
