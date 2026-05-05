'use client';

import { WS_BASE } from '@/lib/api/client';
import type { WsConnectionConfig, WsIncomingMessage, WsOutgoingMessage } from './types';

const PING_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 3_000;

export class TatiWebSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private config: WsConnectionConfig;

  constructor(config: WsConnectionConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.destroyed) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const path = this.config.origin === 'voice' ? '/voice/ws' : '/chat/ws';
    const baseUrl = isLocal ? 'ws://127.0.0.1:8000' : WS_BASE.replace('http', 'ws');
    const wsUrl = baseUrl + path;

    let finalUrl = `${wsUrl}?token=${token}`;
    if (this.config.simulationId) {
      finalUrl += `&simulation_id=${this.config.simulationId}`;
    }

    try {
      this.ws = new WebSocket(finalUrl);
    } catch (e) {      console.error('Failed to create WebSocket:', e);
      return;
    }

    this.ws.onopen = () => {
      console.log('WS Connected');
      this.startPing();
      this.config.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsIncomingMessage = JSON.parse(event.data as string);
        this.config.onMessage(msg);
      } catch (e) {
        console.error('WS Parse Error:', e, event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WS Closed:', event.code, event.reason);
      this.stopPing();
      this.config.onClose?.();
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WS Error:', error);
      this.config.onError?.(error);
    };
  }

  send(message: WsOutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WS not open. State:', this.ws?.readyState);
    }
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}
