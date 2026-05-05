import { useState, useEffect, useRef } from 'react';
import type { Message } from '@/lib/api/types';
import { MessageBubble } from './message-bubble';

import WordTooltip from './word-tooltip';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
}

export function MessageList({ messages, isStreaming, streamingContent }: MessageListProps) {
  
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, streamingContent]);

  const handleWordClick = (word: string, x: number, y: number) => {
    setActiveWord(word);
    setTooltipPos({ x, y });
  };

  const showWelcome = messages.length === 0 && !isStreaming;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
      {showWelcome && (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full border-[3px] border-primary/40 shadow-glow overflow-hidden mb-4">
            <img src="/images/tati_logo.jpg" alt="Tati" className="w-full h-full object-cover" />
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

      {messages.map((m, i) => (
        <MessageBubble 
          key={`${m.id}-${i}`} 
          message={m} 
          onWordClick={handleWordClick}
        />
      ))}

      {isStreaming && (
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

      {/* Typing indicator (only shown if isStreaming is true but streamingContent is empty) */}
      {isStreaming && !streamingContent && (
        <div key="typing-indicator" className="flex gap-3 animate-fade-in">
          <div className="w-7 h-7 rounded-full border border-border bg-surface overflow-hidden shrink-0 mt-1 shadow-sm">
             <img src="/images/tati_logo.jpg" alt="Tati" className="w-full h-full object-cover" />
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
