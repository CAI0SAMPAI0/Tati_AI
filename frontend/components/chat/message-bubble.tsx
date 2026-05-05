'use client';

import { formatTime } from '@/lib/utils';
import type { Message } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ClickableText } from './clickable-text';
import { AudioPlayer } from './audio-player';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onWordClick?: (word: string, x: number, y: number) => void;
}

export function MessageBubble({ message, isStreaming, onWordClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[85%] animate-fade-in',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full border border-border overflow-hidden shrink-0 mt-1 shadow-sm bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/tati_logo.jpg" alt="Tati" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl text-[0.9375rem] leading-relaxed break-words shadow-sm transition-all',
            isUser
              ? 'bg-primary text-white rounded-br-sm'
              : 'bg-surface border border-border text-text rounded-bl-sm hover:border-primary/20'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ClickableText 
              content={message.content} 
              onWordClick={onWordClick || (() => {})} 
            />
          )}
        </div>

        {message.pdf_b64 && !isStreaming && (
          <div className="mt-1 w-full max-w-[280px]">
            <a
              href={`data:application/pdf;base64,${message.pdf_b64}`}
              download={message.pdf_filename || 'Teacher_Tati_Document.pdf'}
              className="flex items-center gap-3 bg-surface border border-border hover:border-primary/50 hover:bg-primary/5 rounded-xl p-3 text-text transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
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
