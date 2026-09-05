'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import { Paperclip, Mic, Send, X } from 'lucide-react';
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

const MAX_ATTACHMENTS = 3;

export const ChatInput = memo(function ChatInput({ onSend, onSendAudio, onSendFile, onSendFiles, disabled, isStreaming }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [attachments, setAttachments] = useState<{name: string, base64: string, type?: string}[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Fix: Timer logic separated to avoid stale closures and premature cleanup
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
    if ((!trimmedText && attachments.length === 0) || disabled || isStreaming) return;
    
    if (attachments.length > 0) {
      if (onSendFiles) {
        onSendFiles(attachments.slice(0, MAX_ATTACHMENTS), trimmedText || undefined);
      } else if (onSendFile) {
        attachments.forEach((att, index) => {
          onSendFile(att.name, att.base64, index === 0 ? trimmedText || undefined : undefined);
        });
      }
      setAttachments([]);
    } else if (trimmedText) {
      onSend(trimmedText);
    }
    
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

  // --- File Attachment Logic (Máximo 3 arquivos) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`Você pode anexar no máximo ${MAX_ATTACHMENTS} arquivos por vez.`);
    }

    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const filesToRead = files.slice(0, availableSlots);

    filesToRead.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (base64) {
          setAttachments(prev => {
            if (prev.length >= MAX_ATTACHMENTS) return prev;
            return [...prev, { name: file.name, base64, type: file.type }];
          });
        }
      };
      reader.onerror = () => toast.error(`Erro ao ler ${file.name}`);
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAttachClick = () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      toast.error(`Limite de ${MAX_ATTACHMENTS} arquivos atingido.`);
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`Você pode anexar no máximo ${MAX_ATTACHMENTS} arquivos por vez.`);
    }

    const availableSlots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const filesToRead = files.slice(0, availableSlots);

    filesToRead.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (base64) {
          setAttachments(prev => {
            if (prev.length >= MAX_ATTACHMENTS) return prev;
            return [...prev, { name: file.name, base64, type: file.type }];
          });
          toast.success(`Arquivo ${file.name} adicionado!`);
        }
      };
      reader.onerror = () => toast.error(`Erro ao ler ${file.name}`);
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (base64) {
            const filename = `imagem_colada_${Date.now()}.png`;
            setAttachments(prev => {
              if (prev.length >= MAX_ATTACHMENTS) return prev;
              return [...prev, { name: filename, base64, type: 'image/png' }];
            });
            toast.success('Imagem colada adicionada!');
          }
        };
        reader.onerror = () => toast.error('Erro ao ler imagem colada');
        reader.readAsDataURL(file);
        
        e.preventDefault();
        break;
      }
    }
  };

  return (
    <div className="p-2 md:p-4 border-t border-border bg-bg shrink-0">
      <div className="max-w-4xl mx-auto relative">
        
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 p-2 px-3 bg-surface border border-border border-b-0 rounded-t-xl overflow-x-auto scrollbar-none">
            <span className="text-[0.68rem] font-bold text-text-muted uppercase tracking-wider shrink-0 mr-1">
              Arquivos ({attachments.length}/{MAX_ATTACHMENTS}):
            </span>
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-[0.82rem] whitespace-nowrap shadow-sm border border-primary/20">
                <Paperclip size={13} className="shrink-0" />
                <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                <button 
                  type="button" 
                  onClick={() => removeAttachment(i)} 
                  className="hover:bg-primary/20 p-0.5 rounded-full ml-1 transition-colors text-primary"
                  title="Remover anexo"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div 
          className={cn(
            "flex items-end gap-2 bg-surface border p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all",
            attachments.length > 0 ? "rounded-b-xl" : "rounded-xl",
            isDragging ? "border-dashed border-primary bg-primary/5" : "border-border"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.md,image/*"
            onChange={handleFileChange}
          />
          
          <button
            aria-label='Anexar arquivo'
            type="button"
            onClick={handleAttachClick}
            disabled={disabled || isStreaming || isRecording}
            className="p-2 rounded-lg text-text-subtle hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>

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
              onPaste={handlePaste}
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
                !text.trim() && attachments.length === 0 && "text-primary" 
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
              disabled={(!text.trim() && attachments.length === 0) || disabled || isStreaming}
              className={cn(
                'p-2.5 rounded-lg bg-primary text-white transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:pointer-events-none',
                (text.trim() || attachments.length > 0) && 'hover:bg-primary-hover shadow-glow'
              )}
              title="Send"
            >
              <Send size={20} />
            </button>
          )}
        </div>
        <p className="mt-2 text-[0.7rem] text-center text-text-subtle">
          Teacher Tati practices English with you · Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
});
