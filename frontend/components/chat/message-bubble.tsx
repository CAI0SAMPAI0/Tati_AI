'use client';

import Image from 'next/image';
import { formatTime } from '@/lib/utils';
import type { Message } from '@/lib/api/types';
import { cn, parseAIResponse } from '@/lib/utils';
import { ClickableText } from './clickable-text';
import { AudioPlayer } from './audio-player';
import React, { useState, useMemo } from 'react';
import { Pencil, Check, X, Copy, RotateCcw, FileText, Download, ExternalLink, Presentation, FileCode2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onWordClick?: (word: string, x: number, y: number) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onResend?: (content: string) => void;
}

export const MessageBubble = React.memo(function MessageBubble({ message, isStreaming, onWordClick, onEdit, onResend }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => parseAIResponse(message.content), [message.content]);

  // Metadados de documento gerado (persistido na mensagem ou recebido via stream)
  const docData = useMemo(() => {
    if (parsed.document) return parsed.document;
    if (message.document_url) {
      return {
        id: message.id,
        filename: message.document_filename || 'Teacher_Tati_Document',
        format: message.document_format || 'pdf',
        url: message.document_url,
        preview_url: message.preview_url || message.document_url,
        size: message.document_size || '',
        title: message.document_filename || 'Material de Estudo',
      };
    }
    if (message.pdf_b64) {
      return {
        id: message.id,
        filename: message.pdf_filename || 'Teacher_Tati_Document.pdf',
        format: 'pdf',
        url: `data:application/pdf;base64,${message.pdf_b64}`,
        preview_url: `data:application/pdf;base64,${message.pdf_b64}`,
        size: '',
        title: message.pdf_filename || 'Documento PDF',
      };
    }
    return null;
  }, [parsed.document, message]);

  // Has a file attachment (PDF, DOCX, PPTX) — no audio for these messages
  const hasFile = !!docData;
  // Has audio from the message itself (e.g. voice mode responses)
  const hasAudio = !hasFile && !!(message.audio_url || message.audio_b64);

  const handleCopy = () => {
    const textToCopy = isUser ? message.content : parsed.reply;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
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
            <div className="flex flex-col gap-2 w-full min-w-[260px] sm:min-w-[400px] md:min-w-[500px] max-w-full">
              <textarea
                className="w-full min-h-[100px] max-h-[300px] bg-white/10 text-white border border-white/20 rounded-xl p-3 text-sm outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30 resize-y"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-1">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(message.content);
                  }}
                  className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/80 transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 bg-white text-primary hover:bg-white/90 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* While streaming with no content yet, show animated dots */}
                  {isStreaming && !parsed.reply ? (
                    <div className="flex items-center gap-1.5 py-1 px-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" />
                    </div>
                  ) : (
                    <>
                      <ClickableText
                        content={parsed.reply}
                        onWordClick={onWordClick || (() => { })}
                      />
                      {/* Show animated dots at the end of text while streaming */}
                      {isStreaming && (
                        <span className="inline-flex gap-1 items-center ml-1.5 align-middle">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                        </span>
                      )}
                    </>
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

              {isUser && onResend && !isStreaming && (
                <button
                  onClick={() => onResend(message.content)}
                  className="absolute -left-16 top-1/2 -translate-y-1/2 p-1.5 text-text-subtle hover:text-primary opacity-0 group-hover:opacity-100 transition-all bg-surface border border-border rounded-lg shadow-sm"
                  title="Resend message"
                >
                  <RotateCcw size={12} />
                </button>
              )}

              {!isStreaming && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 p-1.5 text-text-subtle hover:text-primary opacity-0 group-hover:opacity-100 transition-all bg-surface border border-border rounded-lg shadow-sm z-10",
                    isUser ? (onEdit ? (onResend ? "-left-24" : "-left-16") : "-left-8") : "-right-8"
                  )}
                  title="Copy message"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              )}
            </>
          )}
        </div>

        {docData && !isStreaming && (
          <div className="mt-2 w-full max-w-[340px]">
            <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-md flex flex-col gap-2.5 hover:border-primary/40 transition-all group/doc">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-black text-xs uppercase",
                  docData.format.toLowerCase() === 'pdf'
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : (docData.format.toLowerCase().includes('doc') || docData.format.toLowerCase().includes('word'))
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                )}>
                  {docData.format.toLowerCase() === 'pdf' ? (
                    <FileText size={20} />
                  ) : (docData.format.toLowerCase().includes('doc') || docData.format.toLowerCase().includes('word')) ? (
                    <FileCode2 size={20} />
                  ) : (
                    <Presentation size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[0.6rem] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                      docData.format.toLowerCase() === 'pdf'
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : (docData.format.toLowerCase().includes('doc') || docData.format.toLowerCase().includes('word'))
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    )}>
                      {docData.format.toUpperCase()}
                    </span>
                    {docData.size && (
                      <span className="text-[0.66rem] text-text-subtle font-mono">
                        {docData.size}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.85rem] font-bold text-text truncate mt-0.5 group-hover/doc:text-primary transition-colors">
                    {docData.filename}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    const viewUrl = docData.preview_url || docData.url;
                    window.open(viewUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-primary text-white text-[0.75rem] font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-98"
                >
                  <ExternalLink size={12} />
                  Abrir no navegador
                </button>
                <a
                  href={docData.url}
                  download={docData.filename}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-bg-secondary border border-border hover:bg-surface text-text text-[0.75rem] font-bold transition-all active:scale-98"
                  title="Baixar arquivo"
                >
                  <Download size={12} />
                  Baixar
                </a>
              </div>
            </div>
          </div>
        )}

        {/* AudioPlayer shows automatically when audio is present, never for PDF messages */}
        {hasAudio && !isStreaming && (
          <AudioPlayer url={message.audio_url || undefined} base64={message.audio_b64 || undefined} />
        )}

        <span className="text-[0.7rem] text-text-subtle px-1 mt-0.5 opacity-70">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
});
