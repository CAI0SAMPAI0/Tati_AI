'use client';

import { WS_BASE } from '@/lib/api/client';
import type { WsIncomingMessage } from './types';

const PING_INTERVAL_MS = 15_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 8_000;

export type ChatSocketEventType =
  | 'pong'
  | 'transcription'
  | 'stream_start'
  | 'stream_token'
  | 'stream_end'
  | 'audio_response'
  | 'error';

interface ChatSocketConfig {
  onEvent: (message: WsIncomingMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onUnauthorized?: () => void;
}

interface ChatTextPayload {
  type: 'text';
  content: string;
  conversation_id?: string | null;
  origin?: 'chat';
}

interface ChatAudioPayload {
  type: 'audio';
  audio: string;
  conversation_id?: string | null;
  origin?: 'chat';
}

interface ChatFilePayload {
  type: 'file';
  filename: string;
  content: string;
  conversation_id?: string | null;
  caption?: string;
  origin?: 'chat';
}

interface ChatFilesPayload {
  type: 'files';
  files: Array<{ filename: string; base64: string; type?: string }>;
  file?: string;
  filename?: string;
  content?: string;
  conversation_id?: string | null;
  caption?: string;
  origin?: 'chat';
}

type OutgoingPayload = ChatTextPayload | ChatAudioPayload | ChatFilePayload | ChatFilesPayload | { type: 'ping' };

export class ChatSocket {
  private ws: WebSocket | null = null;
  private readonly config: ChatSocketConfig;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;
  private boundVisibilityHandler: (() => void) | null = null;
  private boundOnlineHandler: (() => void) | null = null;

  constructor(config: ChatSocketConfig) {
    this.config = { ...config };
    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners(): void {
    if (typeof document !== 'undefined') {
      this.boundVisibilityHandler = () => {
        if (document.visibilityState === 'visible' && !this.destroyed) {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connect();
          }
        }
      };
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }

    if (typeof window !== 'undefined') {
      this.boundOnlineHandler = () => {
        if (!this.destroyed && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.connect();
        }
      };
      window.addEventListener('online', this.boundOnlineHandler);
    }
  }

  updateConfig(newConfig: Partial<ChatSocketConfig>): void {
    Object.assign(this.config, newConfig);
  }

  connect(): void {
    if (this.destroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      this.config.onUnauthorized?.();
      return;
    }

    try {
      // Mantém compatibilidade com legado enviando token como subprotocolo.
      this.ws = new WebSocket(`${WS_BASE}/chat/ws`, ['access_token', token]);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.startPing();
      this.config.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as WsIncomingMessage;
        this.config.onEvent(message);
      } catch {
        // Ignora payload inválido para manter socket estável.
      }
    };

    this.ws.onerror = (event) => {
      this.config.onError?.(event);
    };

    this.ws.onclose = (event) => {
      this.stopPing();
      this.ws = null;
      this.config.onClose?.();

      if (event.code === 4001) {
        this.config.onUnauthorized?.();
        return;
      }

      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }
    if (this.boundOnlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(payload: OutgoingPayload): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  waitUntilOpen(timeoutMs = 6_000): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error('WebSocket timeout'));
        }
      }, 120);
    });
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(1.7, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
