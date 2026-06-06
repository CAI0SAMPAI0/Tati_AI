'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getStoredSession } from '@tati/hub-core';
import { resolveApiUrl } from '@/lib/catalog';

interface PaymentStatusMessage {
  type: 'payment_status';
  status: 'confirmed' | 'refused';
  payment_id: string;
  content_id?: string;
  title?: string;
  reason?: string;
  event?: string;
}

interface UsePaymentWebSocketOptions {
  onConfirmed?: (data: PaymentStatusMessage) => void;
  onRefused?: (data: PaymentStatusMessage) => void;
  enabled?: boolean;
}

export function usePaymentWebSocket({
  onConfirmed,
  onRefused,
  enabled = true,
}: UsePaymentWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Estabiliza as callbacks para não reconectar a cada render
  const onConfirmedRef = useRef(onConfirmed);
  const onRefusedRef = useRef(onRefused);
  useEffect(() => { onConfirmedRef.current = onConfirmed; }, [onConfirmed]);
  useEffect(() => { onRefusedRef.current = onRefused; }, [onRefused]);

  const cleanup = useCallback(() => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // evita reconexão no cleanup intencional
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    const session = getStoredSession();
    if (!session?.token) return;

    // Converte http(s) → ws(s)
    const apiUrl = resolveApiUrl();
    const wsBase = apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
    const url = `${wsBase}/payments/ws?token=${session.token}`;

    try {
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) return;
        // Ping a cada 30s para manter a conexão viva
        pingRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('ping');
          }
        }, 30_000);
      };

      socket.onmessage = (event) => {
        if (!mountedRef.current) return;
        if (event.data === 'pong') return;

        try {
          const data = JSON.parse(event.data) as PaymentStatusMessage;
          if (data.type !== 'payment_status') return;

          if (data.status === 'confirmed') {
            onConfirmedRef.current?.(data);
          } else if (data.status === 'refused') {
            onRefusedRef.current?.(data);
          }
        } catch {
          // mensagem inesperada, ignora
        }
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        if (pingRef.current) {
          clearInterval(pingRef.current);
          pingRef.current = null;
        }
        // Reconecta após 5s
        reconnectRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 5_000);
      };

      socket.onerror = () => {
        // onclose será chamado em seguida, reconexão acontece lá
        socket.close();
      };
    } catch {
      // WebSocket não disponível (SSR), ignora
    }
  }, [enabled, cleanup]);

  useEffect(() => {
    mountedRef.current = true;

    if (enabled) connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup]);
}