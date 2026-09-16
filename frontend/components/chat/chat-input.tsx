'use client';

import { Mic, Send } from 'lucide-react';
import React, { memo, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendAudio?: (base64: string) => void;
  onSendFile?: (filename: string, base64: string, caption?: string) => void;
  onSendFiles?: (files: Array<{ name: string; base64: string; type?: string }>, caption?: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export const ChatInput = memo(function ChatInput({ onSend, onSendAudio, disabled, isStreaming }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [text]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(p => p + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Clean up media recorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSend = () => {
    const trimmedText = text.trim();
    if (!trimmedText || disabled || isStreaming) return;
    onSend(trimmedText);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Audio Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (onSendAudio && base64) {
            onSendAudio(base64);
          }
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecordingTime(0);
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      toast.error('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-2 md:p-4 border-t border-border bg-bg shrink-0">
      <div className="max-w-4xl mx-auto relative">
        <div
          className={cn(
            "flex items-end gap-2 bg-surface border rounded-xl p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all border-border"
          )}
        >
          {isRecording ? (
            <div className="flex-1 flex items-center justify-center py-2 h-[40px] text-primary animate-pulse font-medium">
              Recording... {formatTime(recordingTime)}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-[0.9375rem] text-text py-2 resize-none min-h-[40px] max-h-[140px] scrollbar-none"
              disabled={disabled || isStreaming}
            />
          )}

          {isRecording ? (
            <button
              aria-label='Parar gravação'
              type="button"
              onClick={stopRecording}
              className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-glow-red"
              title="Stop recording"
            >
              <div className="w-5 h-5 rounded-sm bg-current" />
            </button>
          ) : (
            <button
              aria-label='Gravar áudio'
              type="button"
              onClick={startRecording}
              disabled={disabled || isStreaming}
              className={cn(
                "p-2 rounded-lg text-text-subtle hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40",
                !text.trim() && "text-primary"
              )}
              title="Record audio"
            >
              <Mic size={20} />
            </button>
          )}

          {!isRecording && (
            <button
              onClick={handleSend}
              aria-label="Enviar mensagem"
              disabled={!text.trim() || disabled || isStreaming}
              className={cn(
                'p-2.5 rounded-lg bg-primary text-white transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:pointer-events-none',
                text.trim() && 'hover:bg-primary-hover shadow-glow'
              )}
              title="Send"
            >
              <Send size={20} />
            </button>
          )}
        </div>
        <p className="mt-2 text-[0.7rem] text-center text-text-subtle">
          Taty's Hub practices English with you · Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
});
