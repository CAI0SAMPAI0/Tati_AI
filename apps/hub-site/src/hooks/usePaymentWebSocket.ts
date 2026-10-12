import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';
import { getStoredSession } from '@tati/hub-core';
import { resolveApiUrl } from '@/lib/catalog';

export interface PaymentStatusMessage {
  type: 'payment_status';
  status: 'confirmed' | 'refused';
  payment_id: string;
  content_id?: string;
  title?: string;
  reason?: string;
  event?: string;
}

export interface UsePaymentWebSocketOptions {
  onConfirmed?: (data: PaymentStatusMessage) => void;
  onRefused?: (data: PaymentStatusMessage) => void;
  enabled?: Ref<boolean> | boolean;
}

export function usePaymentWebSocket(options: UsePaymentWebSocketOptions = {}) {
  const socketRef = ref<WebSocket | null>(null);
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let isComponentMounted = true;

  function cleanup() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (socketRef.value) {
      socketRef.value.onclose = null;
      socketRef.value.close();
      socketRef.value = null;
    }
  }

  function connect() {
    const isEnabled = typeof options.enabled === 'object' ? options.enabled.value : (options.enabled ?? true);
    if (!isComponentMounted || !isEnabled) return;

    const session = getStoredSession();
    if (!session?.token) return;

    const apiUrl = resolveApiUrl();
    const wsBase = apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
    const url = `${wsBase}/payments/ws?token=${session.token}`;

    try {
      const socket = new WebSocket(url);
      socketRef.value = socket;

      socket.onopen = () => {
        if (!isComponentMounted) return;
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('ping');
          }
        }, 30_000);
      };

      socket.onmessage = (event) => {
        if (!isComponentMounted || event.data === 'pong') return;
        try {
          const data = JSON.parse(event.data) as PaymentStatusMessage;
          if (data.type !== 'payment_status') return;

          if (data.status === 'confirmed') {
            options.onConfirmed?.(data);
          } else if (data.status === 'refused') {
            options.onRefused?.(data);
          }
        } catch {
          // mensagem não-JSON ignorada
        }
      };

      socket.onclose = () => {
        if (!isComponentMounted) return;
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        reconnectTimeout = setTimeout(() => {
          if (isComponentMounted) connect();
        }, 5_000);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      // Ignora erro em ambientes sem suporte
    }
  }

  if (typeof options.enabled === 'object') {
    watch(options.enabled, (newVal) => {
      if (newVal) {
        connect();
      } else {
        cleanup();
      }
    });
  }

  onMounted(() => {
    isComponentMounted = true;
    const isEnabled = typeof options.enabled === 'object' ? options.enabled.value : (options.enabled ?? true);
    if (isEnabled) connect();
  });

  onUnmounted(() => {
    isComponentMounted = false;
    cleanup();
  });

  return {
    cleanup,
    connect,
  };
}
