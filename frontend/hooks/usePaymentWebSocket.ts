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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onConfirmedRef = useRef(onConfirmed);
  const onRefusedRef = useRef(onRefused);
  onConfirmedRef.current = onConfirmed;
  onRefusedRef.current = onRefused;

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
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as PaymentStatusMessage;
          if (data.type === 'payment_status') {
            if (data.status === 'confirmed') {
              onConfirmedRef.current?.(data);
            } else if (data.status === 'refused') {
              onRefusedRef.current?.(data);
            }
          }
        } catch (e) {
          if (event.data === 'pong') return;
        }
      };

      socket.onclose = () => {
        setStatus('disconnected');
        reconnectTimerRef.current = setTimeout(() => {
          if (ws.current?.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 5000);
      };

      socket.onerror = () => {};
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return { status };
}
