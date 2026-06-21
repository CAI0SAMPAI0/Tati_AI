import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import type { Message } from '@/lib/api/types';
import { MessageBubble } from './message-bubble';

import WordTooltip from './word-tooltip';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
}

export function MessageList({ messages, isStreaming, streamingContent, onEdit }: MessageListProps) {
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [visibleCount, setVisibleCount] = useState(20);
  const prevLengthRef = useRef(messages.length);

  // Se o total de mensagens aumentar (nova mensagem enviada/recebida), aumenta a contagem visível correspondente
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const diff = messages.length - prevLengthRef.current;
      setVisibleCount((prev) => prev + diff);
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Sempre rola para o final quando uma nova mensagem está sendo escrita/transmitida
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming, streamingContent]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop } = containerRef.current;

    // Se rolar para o topo e houver mais mensagens para carregar
    if (scrollTop < 10 && visibleCount < messages.length) {
      const scrollHeightBefore = containerRef.current.scrollHeight;
      
      setVisibleCount((prev) => {
        const next = Math.min(messages.length, prev + 20);
        
        // Restaura a ancoragem do scroll para evitar pulo visual
        setTimeout(() => {
          if (containerRef.current) {
            const diff = containerRef.current.scrollHeight - scrollHeightBefore;
            containerRef.current.scrollTop = diff;
          }
        }, 0);
        
        return next;
      });
    }
  };

  const handleWordClick = (word: string, x: number, y: number) => {
    setActiveWord(word);
    setTooltipPos({ x, y });
  };

  const showWelcome = messages.length === 0 && !isStreaming;
  const paginatedMessages = messages.slice(-visibleCount);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
      {showWelcome && (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full border-[3px] border-primary/40 shadow-glow overflow-hidden mb-4">
            <Image src="/images/tati_logo.jpg" alt="Tati" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">
            Hi! I'm Teacher Tati 👋
          </h2>
          <p className="text-sm text-text-muted max-w-[320px] mb-6">
            Your AI English teacher. Let's practice together?
          </p>
          <div className="bg-surface border border-border px-3 py-2 rounded-lg text-xs text-text-subtle mb-6">
            💡 Click any English word to see the translation and hear the pronunciation
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {[
              { key: 'chat.sugg_1', label: 'How do I introduce myself?' },
              { key: 'chat.sugg_2', label: 'Correct my English, please' },
              { key: 'chat.sugg_3', label: "Let's practice conversation" },
              { key: 'chat.sugg_4', label: 'Explain past tense to me' }
            ].map((sugg) => (
              <button
                key={sugg.key}
                className="px-3 py-1.5 bg-surface border border-border rounded-full text-[0.8rem] text-text-muted hover:bg-primary-dim hover:text-primary hover:border-primary/50 transition-all"
              >
                {sugg.label}
              </button>
            ))}
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
        />
      ))}

      {isStreaming && streamingContent && (
        <MessageBubble
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            created_at: new Date().toISOString(),
            conversation_id: 'streaming',
          }}
          isStreaming
          onWordClick={handleWordClick}
        />
      )}

      {isStreaming && !streamingContent && (
        <div key="typing-indicator" className="flex gap-3 animate-fade-in">
          <div className="w-7 h-7 rounded-full border border-border bg-surface overflow-hidden shrink-0 mt-1 shadow-sm">
             <Image src="/images/tati_logo.jpg" alt="Tati" className="w-full h-full object-cover" width={28} height={28} />
          </div>
          <div className="bg-surface border border-border px-4 py-3 rounded-xl rounded-bl-sm flex gap-1.5 items-center shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
          </div>
        </div>
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
