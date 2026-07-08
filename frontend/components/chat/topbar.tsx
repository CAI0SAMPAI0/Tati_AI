'use client';

import { Menu, FileText, Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ChatTopbarProps {
  title: string;
  onToggleSidebar: () => void;
  onShowSummary: () => void;
  onSwitchToVoice: () => void;
  showSummaryBtn: boolean;
}

export function ChatTopbar({
  title,
  onToggleSidebar,
  onShowSummary,
  onSwitchToVoice,
  showSummaryBtn,
}: ChatTopbarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg shrink-0">
      <div className="flex items-center gap-3 overflow-hidden">
        <button aria-label="Abrir menu"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-[0.875rem] font-bold text-text truncate">
          {title || 'Teacher Tati'}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {showSummaryBtn && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowSummary}
            className="flex gap-1.5 px-3 py-1.5 h-auto text-xs font-bold"
            title="Summary"
          >
            <FileText size={14} className="text-primary" />
            <span className="hidden sm:inline">Summary</span>
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onSwitchToVoice}
          className="flex gap-1.5 px-3 py-1.5 h-auto text-xs font-bold"
          title="Voice Mode"
        >
          <Mic size={14} className="text-primary" />
          <span className="hidden sm:inline">Voice Mode</span>
        </Button>
      </div>
    </header>
  );
}
