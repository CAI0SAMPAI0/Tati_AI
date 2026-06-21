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
  | 'simulation_state'
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
  result?: unknown;
  message?: string;
  completed_objectives?: string[];
}

export interface WsOutgoingMessage {
  type: 'text' | 'message' | 'audio' | 'file' | 'ping' | 'stop';
  content?: string;
  audio?: string; // base64
  filename?: string;
  caption?: string;
  origin?: WsOrigin;
  conv_id?: string | null;
  conversation_id?: string | null;
  new_conversation?: boolean;
}

export interface WsConnectionConfig {
  origin: WsOrigin;
  simulationId?: string;
  onMessage: (msg: WsIncomingMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}
