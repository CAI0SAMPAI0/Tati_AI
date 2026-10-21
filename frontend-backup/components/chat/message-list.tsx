import type { Message } from '@/lib/api/types';
import { ArrowRight, AudioLines, BookMarked, ClipboardCheck, Mic } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from './message-bubble';
import { TatiLogo } from '@/components/ui/tati-logo';

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
  onSwitchToVoice?: () => void;
  showLevelingCard?: boolean;
}

export function MessageList({
  messages,
  isStreaming,
  streamingContent,
  conversationId,
  onEdit,
  onResend,
  onStartLeveling,
  onSwitchToVoice,
  showLevelingCard = true,
}: MessageListProps) {
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
        <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center animate-fade-in max-w-2xl mx-auto px-4 w-full">
          <div className="w-16 h-16 rounded-full border-[3px] border-primary/40 shadow-glow overflow-hidden mb-5 flex items-center justify-center">
            <TatiLogo
              size={64}
              alt="Logo da Tatiana"
              className="w-full h-full object-cover rounded-full"
              priority
            />
          </div>

          <header className="space-y-3 mb-8">
            <h1 className="font-editorial text-[32px] md:text-[36px] leading-tight text-primary font-normal">
              Welcome to Taty&apos;s Hub
            </h1>

            <p className="text-[15px] leading-relaxed text-muted max-w-md mx-auto">
              Your AI English learning hub. Let&apos;s practice together?
            </p>
          </header>

          {onStartLeveling && showLevelingCard && (
            <article className="w-full md:max-w-xl xl:max-w-2xl h-auto rounded-2xl border border-border bg-surface p-6 text-left shadow-sm hover:border-primary/40 transition-all mb-6 mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <ClipboardCheck size={18} />
                  </span>
                  <h2 className="text-lg font-bold text-heading">CEFR Leveling Test</h2>
                </div>
                <span className="text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  NEW
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-muted">
                Discover your exact English level (A1 to B2) in a quick conversational challenge with Taty&apos;s Hub.. You'll receive your score and diagnostic report by email!
              </p>

              <button
                type="button"
                onClick={onStartLeveling}
                className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-primary/20"
              >
                <span>Start Leveling Challenge</span>
                <ArrowRight size={16} />
              </button>
            </article>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/pronunciation-reader')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs text-muted hover:text-foreground hover:border-primary/40 transition-all cursor-pointer font-medium shadow-xs"
            >
              <AudioLines size={14} className="text-primary" />
              Pronunciation Practice
            </button>

            <button
              type="button"
              onClick={() => (onSwitchToVoice ? onSwitchToVoice() : router.push('/voice'))}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs text-muted hover:text-foreground hover:border-primary/40 transition-all cursor-pointer font-medium shadow-xs"
            >
              <Mic size={14} className="text-primary" />
              Voice
            </button>

            <button
              type="button"
              onClick={() => router.push('/activities')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs text-muted hover:text-foreground hover:border-primary/40 transition-all cursor-pointer font-medium shadow-xs"
            >
              <BookMarked size={14} className="text-primary" />
              Activities
            </button>
          </div>
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
