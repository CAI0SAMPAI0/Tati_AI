
import { WS_BASE } from '../api/client';

export interface NotificationMessage {
  type: string;
  data: Record<string, unknown>;
}

const RECONNECT_DELAY_MS = 3000;

export class NotificationWebSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  constructor(
    private readonly onMessage: (message: NotificationMessage) => void
  ) {}

  connect(): void {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      console.warn('[NotificationWS] Token não encontrado.');
      return;
    }

    const base = WS_BASE.replace(/\/+$/, '');
    const url = `${base}/notifications/ws/?token=${encodeURIComponent(token)}`;

    this.shouldReconnect = true;

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        console.info('[NotificationWS] Conectado.');
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const message: NotificationMessage = JSON.parse(event.data);
          this.onMessage(message);
        } catch (error) {
          console.error('[NotificationWS] Erro ao interpretar mensagem:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('[NotificationWS] Erro na conexão:', error);
      };

      socket.onclose = (event) => {
        console.warn(
          '[NotificationWS] Conexão encerrada:',
          event.code,
          event.reason
        );

        if (this.socket === socket) {
          this.socket = null;
        }

        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[NotificationWS] Falha ao criar conexão:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.close();
    }
  }
}
