'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2, X } from 'lucide-react';
import { apiGet, apiDelete } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Conversation } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  currentId: string | null;
  onSelect: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
}

export function ConversationList({ currentId, onSelect, onDelete }: ConversationListProps) {
  
  const queryClient = useQueryClient();
  const {
    data: conversations,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiGet<Conversation[]>(ENDPOINTS.CONVERSATIONS),
    staleTime: 15_000,
  });

  const groups = useMemo(() => {
    if (!conversations || !conversations.length) return null;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const grouped = {
      ['Today']: [] as Conversation[],
      ['Yesterday']: [] as Conversation[],
      ['Earlier']: [] as Conversation[],
    };

    conversations.forEach((c) => {
      const d = new Date(c.updated_at).toDateString();
      if (d === today) grouped['Today'].push(c);
      else if (d === yesterday) grouped['Yesterday'].push(c);
      else grouped['Earlier'].push(c);
    });

    return grouped;
  }, [conversations]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    
    try {
      await apiDelete(`${ENDPOINTS.CONVERSATIONS}/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (onDelete) onDelete(id);
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  if (error) {
    return (
      <div className="p-4 text-center text-xs text-danger">
        {'Error loading conversations.'}
      </div>
    );
  }

  if (isLoading || !conversations) {
    return (
      <div className="p-4 text-center text-xs text-text-muted animate-pulse">
        {'Loading...'}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-text-muted">
        {'No conversations yet'}
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      {groups && Object.entries(groups).map(([label, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={label} className="mb-4">
            <h3 className="px-2 mb-1 text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">
              {label}
            </h3>
            <div className="space-y-0.5">
              {items.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id, c.title)}
                  className={cn(
                    'group relative flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors',
                    c.id === currentId
                      ? 'bg-primary/15 text-text'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text'
                  )}
                >
                  <MessageSquare size={14} className="shrink-0 text-text-subtle" />
                  <span className="flex-1 text-[0.82rem] truncate leading-tight">
                    {c.title}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity"
                    title={'Delete'}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
