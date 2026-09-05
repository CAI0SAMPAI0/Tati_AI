export type WsMessageType =
  | 'pong'
  | 'transcription'
  | 'status'
  | 'stream_start'
  | 'stream_token'
  | 'stream_end'
  | 'audio_response'
  | 'drill_start'
  | 'drill_result'
  | 'free_warning'
  | 'new_title'
  | 'pdf_generated'
  | 'document_generated'
  | 'simulation_state'
  | 'message_id_update'
  | 'error';

export type WsOrigin = 'chat' | 'voice';

export interface WsIncomingMessage {
  type: WsMessageType;
  content?: string;
  token?: string; // for stream_token
  text?: string; // for transcription
  title?: string;
  audio?: string; // base64
  pdf_b64?: string; // base64
  filename?: string;
  document?: {
    id: string;
    title: string;
    filename: string;
    format: string;
    url: string;
    preview_url?: string;
    size: string;
    pdf_b64?: string;
  };
  format?: string;
  url?: string;
  preview_url?: string;
  size?: string;
  result?: unknown;
  message?: string;
  completed_objectives?: string[];
  real_id?: string | number;
  role?: 'user' | 'assistant';
}

export interface WsOutgoingMessage {
  type: 'text' | 'message' | 'audio' | 'file' | 'files' | 'ping' | 'stop';
  content?: string;
  audio?: string; // base64
  filename?: string;
  files?: Array<{ filename: string; base64: string; type?: string }>;
  file?: string;
  caption?: string;
  origin?: WsOrigin;
  conv_id?: string | null;
  conversation_id?: string | null;
  new_conversation?: boolean;
  accent?: string;
}

export interface WsConnectionConfig {
  origin: WsOrigin;
  simulationId?: string;
  onMessage: (msg: WsIncomingMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}
