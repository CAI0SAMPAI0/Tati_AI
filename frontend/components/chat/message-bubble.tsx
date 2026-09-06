'use client';

import Image from 'next/image';
import { formatTime } from '@/lib/utils';
import type { Message } from '@/lib/api/types';
import { cn, parseAIResponse } from '@/lib/utils';
import { ClickableText } from './clickable-text';
import { AudioPlayer } from './audio-player';
import React, { useState, useMemo } from 'react';
import { Pencil, Check, X, Copy, RotateCcw, FileText, Download, ExternalLink, Presentation, FileCode2, File } from 'lucide-react';
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
    if (parsed.document) {
      return {
        ...parsed.document,
        pdf_b64: parsed.document.pdf_b64 || message.pdf_b64 || '',
      };
    }
    if (message.document_url) {
      return {
        id: message.id,
        filename: message.document_filename || 'Teacher_Tati_Document',
        format: message.document_format || 'pdf',
        url: message.document_url,
        preview_url: message.preview_url || message.document_url,
        size: message.document_size || '',
        title: message.document_filename || 'Material de Estudo',
        pdf_b64: message.pdf_b64 || '',
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
        pdf_b64: message.pdf_b64,
      };
    }
    return null;
  }, [parsed.document, message]);

  // Extrai anexos enviados pelo usuário para exibir em cards elegantes de pré-visualização
  const userAttachmentData = useMemo(() => {
    if (!isUser || !message.content) return { cleanText: message.content || '', attachments: [] };

    let content = message.content;
    const attachments: Array<{ name: string; type?: string }> = [];

    const structuredMatches = content.matchAll(/\[USER_ATTACHMENT:(.*?)\]/g);
    for (const m of structuredMatches) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed && parsed.name) {
          attachments.push(parsed);
        }
      } catch {
        if (m[1]) {
          attachments.push({ name: m[1] });
        }
      }
    }
    content = content.replace(/\[USER_ATTACHMENT:.*?\]/g, '').trim();

    // Padrão legado: 📎 [Arquivo: Nome.pdf] ou [Arquivo: Nome.pdf] ou [X arquivos anexados: ...]
    const legacyMatch = content.match(/(?:📎\s*)?\[(?:Arquivo:\s*([^\]]+)|(?:\d+)\s*arquivos anexados:\s*([^\]]+))\]/);
    if (legacyMatch) {
      const single = legacyMatch[1];
      const multiple = legacyMatch[2];
      if (single) {
        attachments.push({ name: single.trim() });
      } else if (multiple) {
        multiple.split(',').forEach(fn => attachments.push({ name: fn.trim() }));
      }
      content = content.replace(/(?:📎\s*)?\[(?:Arquivo:\s*[^\]]+|(?:\d+)\s*arquivos anexados:\s*[^\]]+)\]/, '').trim();
    }

    return {
      cleanText: content,
      attachments,
    };
  }, [isUser, message.content]);

  // Verifica configuração de autoplay de áudio no chat
  const isAutoplay = useMemo(() => {
    if (isUser || typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('tati_settings');
      if (raw) {
        const s = JSON.parse(raw);
        return Boolean(s.autoplayChatAudio);
      }
    } catch (_) {}
    return false;
  }, [isUser]);

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

  // Helper para resolver URLs de documentos (evita 404 em URLs relativas no domínio do frontend)
  const resolveDocUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || /^https?:\/\//i.test(url)) {
      return url;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (apiBase) {
      return `${apiBase.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
    }
    return url;
  };

  const handleOpenDoc = () => {
    if (!docData) return;
    if (docData.pdf_b64) {
      try {
        const cleanB64 = docData.pdf_b64.replace(/^data:application\/pdf;base64,/, '').trim();
        const byteCharacters = atob(cleanB64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        return;
      } catch (err) {
        console.error('Error opening base64 PDF:', err);
      }
    }
    const targetUrl = resolveDocUrl(docData.preview_url || docData.url);
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadDoc = () => {
    if (!docData) return;
    if (docData.pdf_b64) {
      try {
        const cleanB64 = docData.pdf_b64.replace(/^data:application\/pdf;base64,/, '').trim();
        const byteCharacters = atob(cleanB64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const fn = docData.filename.toLowerCase().endsWith('.pdf') ? docData.filename : `${docData.filename}.pdf`;
        a.download = fn;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        return;
      } catch (err) {
        console.error('Error downloading base64 PDF:', err);
      }
    }
    const targetUrl = resolveDocUrl(docData.url);
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = docData.filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
                <div className="flex flex-col gap-2">
                  {userAttachmentData.cleanText && (
                    <p className="whitespace-pre-wrap">{userAttachmentData.cleanText}</p>
                  )}
                  {userAttachmentData.attachments.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      {userAttachmentData.attachments.map((att, idx) => {
                        const ext = att.name.split('.').pop()?.toLowerCase() || '';
                        const isPdf = ext === 'pdf' || att.type?.includes('pdf');
                        const isDoc = ['doc', 'docx'].includes(ext) || att.type?.includes('word') || att.type?.includes('officedocument');
                        const isPpt = ['ppt', 'pptx'].includes(ext) || att.type?.includes('presentation') || att.type?.includes('powerpoint');

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm shadow-sm text-left max-w-full"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                              {isPdf ? (
                                <FileText size={16} className="text-white" />
                              ) : isDoc ? (
                                <FileCode2 size={16} className="text-white" />
                              ) : isPpt ? (
                                <Presentation size={16} className="text-white" />
                              ) : (
                                <File size={16} className="text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate" title={att.name}>
                                {att.name}
                              </p>
                              <p className="text-[0.65rem] text-white/70 uppercase tracking-wider font-medium">
                                {isPdf ? 'PDF Document' : isDoc ? 'Word Document' : isPpt ? 'Presentation' : ext ? `${ext.toUpperCase()} File` : 'Attachment'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                  onClick={handleOpenDoc}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-primary text-white text-[0.75rem] font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-98"
                >
                  <ExternalLink size={12} />
                  Open in browser
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDoc}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-bg-secondary border border-border hover:bg-surface text-text text-[0.75rem] font-bold transition-all active:scale-98"
                  title="Download file"
                >
                  <Download size={12} />
                  Download
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AudioPlayer shows automatically when audio is present, never for PDF messages */}
        {hasAudio && !isStreaming && (
          <AudioPlayer url={message.audio_url || undefined} base64={message.audio_b64 || undefined} autoPlay={isAutoplay} />
        )}

        <span className="text-[0.7rem] text-text-subtle px-1 mt-0.5 opacity-70">
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
});
