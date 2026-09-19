import type { Message } from '@/lib/api/types';
import { ArrowRight, BookOpen, Target } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from './message-bubble';

import WordTooltip from './word-tooltip';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  conversationId?: string | null;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onResend?: (content: string) => void;
  onSendMessage?: (text: string) => void;
  onStartLeveling?: () => void;
}

export function MessageList({ messages, isStreaming, streamingContent, conversationId, onEdit, onResend, onStartLeveling }: MessageListProps) {
  const router = useRouter();

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [visibleCount, setVisibleCount] = useState(20);
  const prevLengthRef = useRef(messages.length);
  const isInitialScrollRef = useRef(true);
  const prevConvIdRef = useRef<string | null | undefined>(conversationId);

  // Reset scroll initial state when switching conversation
  useEffect(() => {
    if (conversationId !== prevConvIdRef.current) {
      prevConvIdRef.current = conversationId;
      isInitialScrollRef.current = true;
      setVisibleCount(20);
    }
  }, [conversationId]);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const diff = messages.length - prevLengthRef.current;
      setVisibleCount((prev) => prev + diff);
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Instant scroll on entry / conversation load, smooth only for newly added messages
  useEffect(() => {
    if (messages.length === 0 && !isStreaming) return;

    if (isInitialScrollRef.current) {
      // Abre DIRETAMENTE na última mensagem sem animação de scroll
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
      isInitialScrollRef.current = false;
      return;
    }

    if (isStreaming) {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      return;
    }

    // Novas mensagens enviadas/recebidas rolam automaticamente para o final da conversa
    const scrollTimer = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    return () => clearTimeout(scrollTimer);
  }, [messages.length, isStreaming, streamingContent]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop } = containerRef.current;

    if (scrollTop < 10 && visibleCount < messages.length) {
      const scrollHeightBefore = containerRef.current.scrollHeight;

      setVisibleCount((prev) => {
        const next = Math.min(messages.length, prev + 20);

        setTimeout(() => {
          if (containerRef.current) {
            const diff = containerRef.current.scrollHeight - scrollHeightBefore;
            containerRef.current.scrollTop = diff;
          }
        }, 0);

        return next;
      });
    }
  }, [visibleCount, messages.length]);

  const handleWordClick = (word: string, x: number, y: number) => {
    setActiveWord(word);
    setTooltipPos({ x, y });
  };

  const showWelcome = messages.length === 0 && !isStreaming;
  const paginatedMessages = messages.slice(-visibleCount);

  // Identifica a última mensagem do assistente para controlar autoplay isolado
  let lastAssistantIdx = -1;
  for (let i = paginatedMessages.length - 1; i >= 0; i--) {
    if (paginatedMessages[i].role === 'assistant') {
      lastAssistantIdx = i;
      break;
    }
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
      {showWelcome && (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full border-[3px] border-primary/40 shadow-glow overflow-hidden mb-4">
            <Image src="/images/tati_logo.jpg" alt="Tati" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">
            Welcome to Taty&apos;s Hub
          </h2>
          <p className="text-sm text-text-muted max-w-[320px] mb-6">
            Your AI English learning hub. Let&apos;s practice together?
          </p>

          {onStartLeveling && (
            <div className="w-full max-w-sm mb-5 p-4 bg-gradient-to-br from-primary/15 via-surface to-purple-500/10 border border-primary/40 rounded-2xl text-left shadow-lg hover:border-primary transition-all">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                  <Target size={16} />
                </span>
                <span className="font-bold text-sm text-text">CEFR Leveling Test</span>
                <span className="ml-auto text-[0.65rem] font-black uppercase px-2 py-0.5 rounded-full bg-primary text-white">New</span>
              </div>
              <p className="text-xs text-text-muted mb-3 leading-relaxed">
                Discover your exact English level (A1 to B2) in a quick conversational challenge with Taty's Hub. You'll receive your score and diagnostic report by email!
              </p>
              <button
                onClick={onStartLeveling}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Start Leveling Challenge</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <button
            onClick={() => router.push('/pronunciation-reader')}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-dim border border-primary/30 rounded-full text-[0.8rem] text-primary font-semibold hover:bg-primary hover:text-white transition-all cursor-pointer"
          >
            <BookOpen size={14} />
            Pronunciation Practice
          </button>
        </div>
      )}

      {visibleCount < messages.length && (
        <div className="text-center text-xs text-text-subtle py-2 opacity-60">
          Scroll up to load older messages...
        </div>
      )}

      {paginatedMessages.map((m, i) => (
        <MessageBubble
          key={`${m.id}-${i}`}
          message={m}
          onWordClick={handleWordClick}
          onEdit={onEdit}
          onResend={onResend}
          isLastAssistant={!isStreaming && i === lastAssistantIdx}
        />
      ))}

      {isStreaming && (
        <MessageBubble
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent ?? '',
            created_at: new Date().toISOString(),
            conversation_id: 'streaming',
          }}
          isStreaming
          onWordClick={handleWordClick}
        />
      )}

      <div ref={bottomRef} className="h-2" />

      {/* Global Word Tooltip */}
      <WordTooltip
        word={activeWord}
        position={tooltipPos}
        onClose={() => setActiveWord(null)}
      />
    </div>
  );
}
