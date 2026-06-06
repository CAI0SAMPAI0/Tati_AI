'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ClickableTextProps {
  content: string;
  isMarkdown?: boolean;
  onWordClick: (word: string, x: number, y: number) => void;
  className?: string;
}

export function ClickableText({ content, isMarkdown = true, onWordClick, className }: ClickableTextProps) {
  const [Markdown, setMarkdown] = useState<any>(null);
  const [gfm, setGfm] = useState<any>(null);

  useEffect(() => {
    if (!isMarkdown) return;
    Promise.all([
      import('react-markdown'),
      import('remark-gfm')
    ]).then(([mdModule, gfmModule]) => {
      setMarkdown(() => mdModule.default);
      setGfm(() => gfmModule.default);
    });
  }, [isMarkdown]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('clickable-word')) {
      const word = target.textContent?.trim();
      if (word && word.length > 1) {
        onWordClick(word, e.clientX, e.clientY);
      }
    }
  };

  const processedContent = useMemo(() => {
    // This is a simplified way to wrap words. 
    // For real markdown, we might need a custom renderer.
    // However, we can use a custom component for 'p', 'li', etc. in ReactMarkdown.
    return content;
  }, [content]);

  if (!isMarkdown) {
    const parts = content.split(/(\s+)/);
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

  if (!Markdown || !gfm) {
    return <div className={cn("prose-container", className)}>{content}</div>;
  }

  return (
    <div className={cn("prose-container", className)} onClick={handleClick}>
      <Markdown 
        remarkPlugins={[gfm]}
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
        {processedContent}
      </Markdown>
    </div>
  );
}

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
