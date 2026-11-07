import { WS_BASE } from '../api/client';

export interface NotificationMessage {
  type: string;
  data: Record<string, unknown>;
}

const RECONNECT_DELAY_MS = 3000;
const IS_DEBUG = false; // Mudo por padrão para não poluir o DevTools

export class NotificationWebSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private beforeUnloadHandler: (() => void) | null = null;

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

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) {
      return;
    }

    const base = WS_BASE.replace(/\/+$/, '');
    const url = `${base}/notifications/ws/?token=${encodeURIComponent(token)}`;

    this.shouldReconnect = true;

    // Garante fechamento limpo ao recarregar/descarregar a página
    if (typeof window !== 'undefined' && !this.beforeUnloadHandler) {
      this.beforeUnloadHandler = () => {
        this.shouldReconnect = false;
        if (this.socket) {
          try {
            this.socket.close(1000, 'Page unloaded');
          } catch {}
          this.socket = null;
        }
      };
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
      window.addEventListener('pagehide', this.beforeUnloadHandler);
    }

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        if (IS_DEBUG) console.debug('[NotificationWS] Conectado.');
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const message: NotificationMessage = JSON.parse(event.data);
          this.onMessage(message);
        } catch {
          // Silencioso em caso de erro de parse para não travar
        }
      };

      socket.onerror = () => {
        // Silencioso no console para evitar poluição no DevTools
      };

      socket.onclose = (event) => {
        if (this.socket === socket) {
          this.socket = null;
        }

        // Se o fechamento foi normal (ex: logout ou unload), não reconecta
        if (event.code === 1000 || !this.shouldReconnect) {
          return;
        }

        this.scheduleReconnect();
      };
    } catch {
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

  send(data: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.socket.send(payload);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('pagehide', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        socket.close(1000, 'Client disconnected');
      } catch {}
    }
  }
}

let globalNotificationSocket: NotificationWebSocket | null = null;

export function setGlobalNotificationSocket(socket: NotificationWebSocket | null): void {
  globalNotificationSocket = socket;
}

export function getGlobalNotificationSocket(): NotificationWebSocket | null {
  return globalNotificationSocket;
}
