import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ClickableTextProps {
  content: string;
  isMarkdown?: boolean;
  onWordClick: (word: string, x: number, y: number) => void;
  className?: string;
}

export function splitIntoSentences(input: string): string[] {
  if (!input) return [];
  const regex = /(?<!\b(?:e\.g|i\.e|etc|vs|dr|mr|mrs|ms|prof|st|\d)\.)(?<=[.!?]["'”’»\)]*)\s+|\n+/i;
  return input.split(regex).map(s => s.trim()).filter(Boolean);
}

export function formatSentenceForTranslation(sentenceText: string): string {
  let clean = sentenceText.trim();
  if (!clean) return '';
  // Se toda a frase estiver entre aspas ou parênteses externos (ex: "The weather is nice today."), desempacota
  if (
    (/^["'“‘]/.test(clean) && /["'”’]$/.test(clean)) ||
    (/^\(/.test(clean) && /\)$/.test(clean)) ||
    (/^\[/.test(clean) && /\]$/.test(clean))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  return clean || sentenceText.trim();
}

export const ClickableText = React.memo(function ClickableText({
  content,
  isMarkdown = true,
  onWordClick,
  className,
}: ClickableTextProps) {
  const [tooltipMode, setTooltipMode] = useState<'sentence' | 'word'>('sentence');
  const [wordTooltipEnabled, setWordTooltipEnabled] = useState(true);

  useEffect(() => {
    const loadSettings = () => {
      try {
        const raw = localStorage.getItem('tati_settings');
        if (raw) {
          const s = JSON.parse(raw);
          if (s.tooltipMode) {
            setTooltipMode(s.tooltipMode);
          }
          if (typeof s.wordTooltip === 'boolean') {
            setWordTooltipEnabled(s.wordTooltip);
          }
        }
      } catch (_) {}
    };

    loadSettings();
    window.addEventListener('tati_settings_changed', loadSettings);
    window.addEventListener('storage', loadSettings);
    return () => {
      window.removeEventListener('tati_settings_changed', loadSettings);
      window.removeEventListener('storage', loadSettings);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (!wordTooltipEnabled) return;
    const target = e.target as HTMLElement;

    if (tooltipMode === 'sentence') {
      const sentenceEl = target.closest('.clickable-sentence') as HTMLElement | null;
      if (sentenceEl) {
        const fullSentence = sentenceEl.getAttribute('data-sentence') || sentenceEl.textContent || '';
        const resolved = formatSentenceForTranslation(fullSentence);
        if (resolved && resolved.length > 1) {
          onWordClick(resolved, e.clientX, e.clientY);
          return;
        }
      }
    }

    if (target.classList.contains('clickable-word')) {
      const word = target.textContent?.trim();
      if (word && word.length > 1) {
        onWordClick(word, e.clientX, e.clientY);
      }
    }
  };

  const rawContent = content || '';

  if (!wordTooltipEnabled) {
    if (!isMarkdown) {
      return <div className={cn("whitespace-pre-wrap", className)}>{rawContent}</div>;
    }
    return (
      <div className={cn("prose-container", className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  if (!isMarkdown) {
    if (tooltipMode === 'sentence') {
      const sentences = splitIntoSentences(rawContent);
      return (
        <div className={cn("whitespace-pre-wrap", className)} onClick={handleClick}>
          {sentences.map((sent, i) => {
            if (!sent.trim()) return sent;
            return (
              <span
                key={i}
                data-sentence={sent}
                className="clickable-sentence cursor-pointer hover:bg-primary/10 hover:text-primary rounded px-0.5 transition-all"
              >
                {sent}{' '}
              </span>
            );
          })}
        </div>
      );
    }

    const parts = rawContent.split(/(\s+)/);
    return (
      <div className={cn("whitespace-pre-wrap", className)} onClick={handleClick}>
        {parts.map((part, i) => {
          if (/\s+/.test(part)) return part;
          if (/[a-zA-Z]/.test(part)) {
            return (
              <span key={i} className="clickable-word cursor-pointer hover:text-primary hover:underline transition-colors decoration-dotted">
                {part}
              </span>
            );
          }
          return part;
        })}
      </div>
    );
  }

  return (
    <div className={cn("prose-container", className)} onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }: any) => <p>{wrapChildren(children, tooltipMode)}</p>,
          li: ({ children }: any) => <li>{wrapChildren(children, tooltipMode)}</li>,
          h1: ({ children }: any) => <h1>{wrapChildren(children, tooltipMode)}</h1>,
          h2: ({ children }: any) => <h2>{wrapChildren(children, tooltipMode)}</h2>,
          h3: ({ children }: any) => <h3>{wrapChildren(children, tooltipMode)}</h3>,
          span: ({ children }: any) => <span>{wrapChildren(children, tooltipMode)}</span>,
          em: ({ children }: any) => <em>{wrapChildren(children, tooltipMode)}</em>,
          strong: ({ children }: any) => <strong>{wrapChildren(children, tooltipMode)}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function wrapChildren(children: React.ReactNode, mode: 'sentence' | 'word'): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      if (mode === 'sentence') {
        const sentences = splitIntoSentences(child);
        return sentences.map((sent, i) => {
          if (!sent.trim()) return sent;
          return (
            <span
              key={i}
              data-sentence={sent}
              className="clickable-sentence cursor-pointer hover:bg-primary/10 hover:text-primary rounded px-0.5 transition-all decoration-dotted underline-offset-4"
            >
              {sent}{' '}
            </span>
          );
        });
      }

      const parts = child.split(/(\s+|[.,!?;:()])/);
      return parts.map((part, i) => {
        if (/[a-zA-Z]/.test(part) && part.length > 1) {
          return (
            <span
              key={i}
              className="clickable-word cursor-pointer hover:text-primary hover:underline transition-all decoration-dotted underline-offset-4 decoration-primary/30"
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }
    return child;
  });
}
