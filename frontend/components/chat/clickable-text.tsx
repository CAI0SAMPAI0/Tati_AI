import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface ClickableTextProps {
  content: string;
  isMarkdown?: boolean;
  onWordClick: (word: string, x: number, y: number) => void;
  className?: string;
}

export const ClickableText = React.memo(function ClickableText({ content, isMarkdown = true, onWordClick, className }: ClickableTextProps) {

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('clickable-word')) {
      const word = target.textContent?.trim();
      if (word && word.length > 1) {
        onWordClick(word, e.clientX, e.clientY);
      }
    }
  };

  const rawContent = content || '';

  if (!isMarkdown) {
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
          p: ({ children }: any) => <p>{wrapChildren(children)}</p>,
          li: ({ children }: any) => <li>{wrapChildren(children)}</li>,
          h1: ({ children }: any) => <h1>{wrapChildren(children)}</h1>,
          h2: ({ children }: any) => <h2>{wrapChildren(children)}</h2>,
          h3: ({ children }: any) => <h3>{wrapChildren(children)}</h3>,
          span: ({ children }: any) => <span>{wrapChildren(children)}</span>,
          em: ({ children }: any) => <em>{wrapChildren(children)}</em>,
          strong: ({ children }: any) => <strong>{wrapChildren(children)}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function wrapChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(/(\s+|[.,!?;:()])/);
      return parts.map((part, i) => {
        if (/[a-zA-Z]/.test(part) && part.length > 1) {
          return (
            <span key={i} className="clickable-word cursor-pointer hover:text-primary hover:underline transition-all decoration-dotted underline-offset-4 decoration-primary/30">
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
