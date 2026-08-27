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
  CheckSquare,
  Square,
  CheckCircle2,
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
    refetchInterval: 30_000,
  });

  const games: GameRow[] = Array.isArray(rawGames)
    ? rawGames
    : (rawGames as any)?.data || [];

  const invalidateGames = () => queryClient.invalidateQueries({ queryKey: ['admin-games'] });

  const [filterLevel, setFilterLevel] = useState('all');
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<GameRow | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const filteredGames = games.filter((g) => {
    if (filterLevel === 'all') return true;
    const gLevels = (g.levels || []).map((l) => l.toUpperCase());
    return gLevels.includes('ALL') || gLevels.includes(filterLevel.toUpperCase());
  });

  const handleSelectAll = () => {
    if (selectedGameIds.length === filteredGames.length) {
      setSelectedGameIds([]);
    } else {
      setSelectedGameIds(filteredGames.map((g) => g.id));
    }
  };

  const toggleSelectGame = (id: string) => {
    setSelectedGameIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedGameIds.length === 0) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading(publish ? 'Publishing selected games...' : 'Moving selected games to drafts...');
    try {
      await Promise.all(
        selectedGameIds.map((id) => apiPut(`${ENDPOINTS.ADMIN_GAMES}/${id}`, { is_published: publish }))
      );
      toast.success(publish ? `${selectedGameIds.length} game(s) published!` : `${selectedGameIds.length} game(s) moved to drafts!`, { id: toastId });
      setSelectedGameIds([]);
      invalidateGames();
    } catch {
      toast.error('Error updating selected games.', { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedGameIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedGameIds.length} selected game(s)?`)) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading('Deleting selected games...');
    try {
      await Promise.all(
        selectedGameIds.map((id) => apiDelete(`${ENDPOINTS.ADMIN_GAMES}/${id}`))
      );
      toast.success(`${selectedGameIds.length} game(s) deleted!`, { id: toastId });
      setSelectedGameIds([]);
      invalidateGames();
    } catch {
      toast.error('Error deleting selected games.', { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

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

  const handleToggleLevel = (levelValue: string) => {
    setFormData((prev) => {
      const current = prev.levels.map((l) => l.toUpperCase());
      const target = levelValue.toUpperCase();
      const isCurrentlySelected = current.includes(target);

      let newLevels: string[];
      if (isCurrentlySelected) {
        newLevels = prev.levels.filter((l) => l.toUpperCase() !== target);
      } else {
        newLevels = [...prev.levels, levelValue];
      }

      return { ...prev, levels: newLevels };
    });
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
        <div className="flex items-center gap-4 flex-wrap">
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
          {filteredGames.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all px-2.5 py-1 rounded-lg border border-border bg-surface"
            >
              {selectedGameIds.length === filteredGames.length ? (
                <CheckSquare size={15} className="text-primary" />
              ) : (
                <Square size={15} />
              )}
              <span>
                {selectedGameIds.length === filteredGames.length ? 'Deselect All' : `Select All (${filteredGames.length})`}
              </span>
            </button>
          )}
        </div>
        <Button className="gap-2" onClick={() => openModal()}>
          <Plus size={18} />
          Create Game
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedGameIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedGameIds.length} selected
            </span>
            <span className="text-xs text-text-muted">of {filteredGames.length} visible games</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBulkPublish(true)}
              disabled={isBulkProcessing}
              className="px-3.5 py-1.5 bg-success text-white hover:bg-success/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Publish Selected
            </button>
            <button
              onClick={() => handleBulkPublish(false)}
              disabled={isBulkProcessing}
              className="px-3.5 py-1.5 bg-warning text-white hover:bg-warning/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <EyeOff size={14} />
              Move to Draft
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkProcessing}
              className="px-3.5 py-1.5 bg-danger text-white hover:bg-danger/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedGameIds([])}
              className="px-2.5 py-1.5 text-xs text-text-muted hover:text-text font-bold transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.length > 0 ? (
          filteredGames.map((g) => {
            const isSelected = selectedGameIds.includes(g.id);
            return (
              <div
                key={g.id}
                className={cn(
                  "bg-surface border p-5 rounded-2xl flex flex-col gap-4 group transition-all relative",
                  isSelected ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelectGame(g.id)}
                      className="text-text-muted hover:text-primary transition-all p-0.5"
                      title={isSelected ? "Deselect" : "Select"}
                    >
                      {isSelected ? <CheckSquare size={17} className="text-primary" /> : <Square size={17} />}
                    </button>
                    <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                      <Gamepad2 size={20} />
                    </div>
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
            );
          })
        ) : (
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
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface text-text-muted border-border hover:border-primary/40'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_published_game"
              checked={formData.is_published}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_published: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="is_published_game" className="text-xs text-text-muted font-medium cursor-pointer">
              Publish immediately (visible to students)
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingGame ? 'Save Changes' : 'Create Game'}
            </Button>
          </div>
        </div>
      </DialogModal>
    </section>
  );
}
