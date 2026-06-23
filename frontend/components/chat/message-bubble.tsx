'use client';

import Image from 'next/image';
import { formatTime } from '@/lib/utils';
import type { Message } from '@/lib/api/types';
import { cn, parseAIResponse } from '@/lib/utils';
import { ClickableText } from './clickable-text';
import { AudioPlayer } from './audio-player';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { apiPost } from '@/lib/api/client';
import { useState } from 'react';
import { Pencil, Check, X, Copy, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onWordClick?: (word: string, x: number, y: number) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
}

export function MessageBubble({ message, isStreaming, onWordClick, onEdit }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);

  const parsed = parseAIResponse(message.content);

  const handleCopy = () => {
    const textToCopy = isUser ? message.content : parsed.reply;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTTS = async () => {
    if (ttsLoading) return;
    setTtsLoading(true);
    try {
      const res = await apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: parsed.reply });
      if (res.ok && res.data?.audio) {
        setTtsAudio(res.data.audio);
      }
    } catch (e) {
      console.error('Erro ao obter áudio TTS', e);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!onEdit || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(message.id, editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving message:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[85%] animate-fade-in group',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full border border-border overflow-hidden shrink-0 mt-1 shadow-sm bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src="/images/tati_logo.jpg" alt="Tati" width={28} height={28} className="w-full h-full object-cover" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative px-4 py-2.5 rounded-2xl text-[0.9375rem] leading-relaxed break-words shadow-sm transition-all',
            isUser
              ? 'bg-primary text-white rounded-br-sm'
              : 'bg-surface border border-border text-text rounded-bl-sm hover:border-primary/20'
          )}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                className="w-full bg-white/10 text-white border border-white/20 rounded-lg p-2 text-sm outline-none focus:border-white/40 resize-none"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                autoFocus
                rows={Math.max(2, editContent.split('\n').length)}
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content);
                  }}
                  className="p-1 hover:bg-white/10 rounded-md transition-colors"
                  disabled={isSaving}
                >
                  <X size={14} />
                </button>
                <button
                  onClick={handleSave}
                  className="p-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors flex items-center gap-1 px-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span className="text-[0.7rem] font-bold">Save</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <ClickableText
                    content={parsed.reply}
                    onWordClick={onWordClick || (() => { })}
                  />
                  {!isUser && (
                    <button
                      onClick={handleTTS}
                      disabled={ttsLoading}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-secondary border border-border text-[0.65rem] font-bold text-text-muted hover:bg-primary/10 hover:border-primary/20 transition-all w-fit"
                    >
                      <Volume2 size={12} />
                      {ttsLoading ? 'Carregando...' : 'Ouvir'}
                    </button>
                  )}
                  {parsed.correction && (
                    <div className="mt-2 text-xs bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl p-2.5 flex items-start gap-2 max-w-full text-left">
                      <span className="text-base select-none">💡</span>
                      <div className="flex-1">
                        <span className="font-bold text-amber-800 dark:text-amber-200">Tati noticed: </span>
                        <span className="italic">{parsed.correction}</span>
                      </div>
                    </div>
                  )}
                  {ttsAudio && (
                    <AudioPlayer base64={ttsAudio} className="mt-2" />
                  )}
                </div>
              )}

              {isUser && onEdit && !isStreaming && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-text-subtle hover:text-primary opacity-0 group-hover:opacity-100 transition-all bg-surface border border-border rounded-lg shadow-sm"
                  title="Edit message"
                >
                  <Pencil size={12} />
                </button>
              )}

              {!isStreaming && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 p-1.5 text-text-subtle hover:text-primary opacity-0 group-hover:opacity-100 transition-all bg-surface border border-border rounded-lg shadow-sm z-10",
                    isUser ? (onEdit ? "-left-16" : "-left-8") : "-right-8"
                  )}
                  title="Copy message"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              )}
            </>
          )}
        </div>

        {message.pdf_b64 && !isStreaming && (
          <div className="mt-1 w-full max-w-[280px]">
            <a
              href={`data:application/pdf;base64,${message.pdf_b64}`}
              download={message.pdf_filename || 'Teacher_Tati_Document.pdf'}
              className="flex items-center gap-3 bg-surface border border-border hover:border-primary/50 hover:bg-primary/5 rounded-xl p-3 text-text transition-all group/pdf"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h2" /><path d="M8 17h2" /><path d="M14 13h2" /><path d="M14 17h2" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate group-hover/pdf:text-primary transition-colors">
                  {message.pdf_filename || 'Teacher_Tati_Document.pdf'}
                </p>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                  Click to download
                </p>
              </div>
            </a>
          </div>
        )}

        {(message.audio_url || message.audio_b64) && !isStreaming && (
          <AudioPlayer url={message.audio_url || undefined} base64={message.audio_b64 || undefined} />
        )}

        <span className="text-[0.7rem] text-text-subtle px-1 mt-0.5 opacity-70">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}

