'use client';

import { useEffect, useRef, useState } from 'react';
import { WS_BASE } from '@/lib/api/client';
import toast from 'react-hot-toast';

interface PaymentStatusMessage {
  type: 'payment_status';
  status: 'confirmed' | 'refused';
  payment_id: string;
  title?: string;
  reason?: string;
  content_id?: string;
}

export function usePaymentWebSocket(onConfirmed?: (data: PaymentStatusMessage) => void, onRefused?: (data: PaymentStatusMessage) => void) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const connect = () => {
      const url = `${WS_BASE}/payments/ws?token=${token}`;
      const socket = new WebSocket(url);
      ws.current = socket;
      setStatus('connecting');

      socket.onopen = () => {
        setStatus('connected');
        console.log('[PaymentWS] Connected');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as PaymentStatusMessage;
          if (data.type === 'payment_status') {
            if (data.status === 'confirmed') {
              onConfirmed?.(data);
            } else if (data.status === 'refused') {
              onRefused?.(data);
            }
          }
        } catch (e) {
          if (event.data === 'pong') return;
          console.error('[PaymentWS] Error parsing message', e);
        }
      };

      socket.onclose = () => {
        setStatus('disconnected');
        console.log('[PaymentWS] Disconnected');
        // Retry after 5 seconds if not explicitly closed
        setTimeout(() => {
          if (ws.current?.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 5000);
      };

      socket.onerror = (error) => {
        console.error('[PaymentWS] Error', error);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [onConfirmed, onRefused]);

  return { status };
}
