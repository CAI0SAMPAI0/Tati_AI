'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  PenLine,
  Eye,
  EyeOff,
  Gamepad2,
  ExternalLink,
} from 'lucide-react';

import { apiGet, apiDelete, apiPost, apiPut } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogModal } from '@/components/ui/dialog-modal';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';

interface GameRow {
  id: string;
  title: string;
  description: string;
  wordwall_url: string;
  levels: string[];
  is_published: boolean;
  created_at: string;
}

interface FormState {
  title: string;
  description: string;
  wordwall_url: string;
  levels: string[];
  is_published: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  wordwall_url: '',
  levels: ['all'],
  is_published: true,
};

export default function GamesSection() {
  const queryClient = useQueryClient();
  const { data: rawGames = [], isLoading } = useQuery({
    queryKey: ['admin-games'],
    queryFn: () => apiGet(ENDPOINTS.ADMIN_GAMES),
  });

  const games: GameRow[] = Array.isArray(rawGames)
    ? rawGames
    : (rawGames as any)?.data || [];

  const invalidateGames = () => queryClient.invalidateQueries({ queryKey: ['admin-games'] });

  const [filterLevel, setFilterLevel] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameRow | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const filteredGames = games.filter((g) => {
    if (filterLevel === 'all') return true;
    const gLevels = (g.levels || []).map((l) => l.toUpperCase());
    return gLevels.includes('ALL') || gLevels.includes(filterLevel.toUpperCase());
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this game?')) return;
    const toastId = toast.loading('Deleting...');
    try {
      await apiDelete(`${ENDPOINTS.ADMIN_GAMES}/${id}`);
      toast.success('Game deleted.', { id: toastId });
      invalidateGames();
    } catch {
      toast.error('Error deleting.', { id: toastId });
    }
  };

  const handleTogglePublish = async (id: string, current: boolean) => {
    try {
      await apiPut(`${ENDPOINTS.ADMIN_GAMES}/${id}`, { is_published: !current });
      toast.success(current ? 'Game returned to drafts' : 'Game published!');
      invalidateGames();
    } catch {
      toast.error('Error updating status.');
    }
  };

  const openModal = (game?: GameRow) => {
    if (game) {
      setEditingGame(game);
      setFormData({
        title: game.title || '',
        description: game.description || '',
        wordwall_url: game.wordwall_url || '',
        levels: game.levels || ['all'],
        is_published: game.is_published,
      });
    } else {
      setEditingGame(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleToggleLevel = (level: string) => {
    setFormData((prev) => {
      const current = prev.levels;
      if (level === 'all') {
        return { ...prev, levels: ['all'] };
      }
      const filtered = current.filter((l) => l !== 'all' && l !== 'ALL');
      if (filtered.includes(level)) {
        const next = filtered.filter((l) => l !== level);
        return { ...prev, levels: next.length === 0 ? ['all'] : next };
      }
      return { ...prev, levels: [...filtered, level] };
    });
  };

  const handleSave = async () => {
    const title = formData.title || '';
    if (!title.trim()) {
      toast.error('Please provide a title for the game.');
      return;
    }
    const url = formData.wordwall_url || '';
    if (!url.trim()) {
      toast.error('Please provide a WordWall URL.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: (formData.description || '').trim(),
        wordwall_url: url.trim(),
        levels: formData.levels,
        is_published: formData.is_published,
      };

      const res = editingGame
        ? await apiPut(`${ENDPOINTS.ADMIN_GAMES}/${editingGame.id}`, payload)
        : await apiPost(ENDPOINTS.ADMIN_GAMES, payload);

      if (res.ok) {
        toast.success(editingGame ? 'Game updated!' : 'Game created!');
        await invalidateGames();
        setIsModalOpen(false);
      } else {
        toast.error('Error saving.');
      }
    } catch {
      toast.error('Error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (field: keyof FormState) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Gamepad2 size={22} className="text-primary" />
            Games
          </h3>
          <select
            className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-primary/50 transition-all"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="all">All Levels</option>
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Button className="gap-2" onClick={() => openModal()}>
          <Plus size={18} />
          Create Game
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.length > 0 ? filteredGames.map((g) => (
          <div key={g.id} className="bg-surface border border-border p-5 rounded-2xl flex flex-col gap-4 group hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                <Gamepad2 size={20} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn(
                  "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  g.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                )}>
                  {g.is_published ? 'Published' : 'Draft'}
                </span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {(g.levels || ['all']).map((l) => (
                    <span key={l} className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border uppercase tracking-widest text-text-subtle">
                      {l === 'all' || l === 'ALL' ? 'All Levels' : l.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-text mb-1 truncate">{g.title}</h4>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8">
                {g.description}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-auto pt-2">
              <a
                href={g.wordwall_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all text-xs font-bold border border-primary/20"
                title="Open game"
              >
                <ExternalLink size={14} /> Open
              </a>
              <button onClick={() => openModal(g)} className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                <PenLine size={14} />
              </button>
              <button
                onClick={() => handleTogglePublish(g.id, !!g.is_published)}
                className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border"
                title={g.is_published ? 'Unpublish (Draft)' : 'Publish'}
              >
                {g.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={() => handleDelete(g.id)}
                className="p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl bg-surface/30">
            <Gamepad2 size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-text-muted font-medium">No games created yet.</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGame ? 'Edit Game' : 'Create Game'}
      >
        <div className="space-y-4">
          <Input
            label="Game Title"
            value={formData.title}
            onChange={setField('title')}
            placeholder="Ex: Vocabulary Match - Animals"
          />
          <Input
            label="WordWall URL"
            value={formData.wordwall_url}
            onChange={setField('wordwall_url')}
            placeholder="https://wordwall.net/resource/..."
          />
          <div className="space-y-1.5">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              placeholder="Brief description of the game"
              className="w-full min-h-[80px] p-3 bg-input border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all leading-relaxed"
              value={formData.description}
              onChange={setField('description')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Levels</label>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((opt) => {
                const isActive = formData.levels.map((l) => l.toUpperCase()).includes(opt.value.toUpperCase());
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggleLevel(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                      isActive
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface border-border text-text-muted hover:border-primary/50'
                    )}
                  >
                    {opt.value}
                  </button>
                );
              })}
            </div>
            <p className="text-[0.65rem] text-text-muted italic">
              Select which levels can see this game. If none selected, it shows for all.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[0.73rem] font-semibold text-text-muted uppercase tracking-wider">Published</label>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, is_published: !prev.is_published }))}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                formData.is_published ? 'bg-primary' : 'bg-border'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                formData.is_published && 'translate-x-5'
              )} />
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={isSaving}>Save</Button>
          </div>
        </div>
      </DialogModal>
    </section>
  );
}
