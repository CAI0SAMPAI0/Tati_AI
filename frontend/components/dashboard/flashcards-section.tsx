'use client';

import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Trash2,
  PenLine,
  Eye,
  FileBox,
  Sparkles
} from 'lucide-react';
import { apiGet, apiDelete, apiPost, apiPut } from '@/lib/api/client';

import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogModal } from '@/components/ui/dialog-modal';
import toast from 'react-hot-toast';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  card_count?: number;
  level?: string;
}

interface FormState {
  title: string;
  description: string;
  card_count: number;
  level: string;
  ai_theme: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  card_count: 10,
  level: 'all',
  ai_theme: '',
};

export function FlashcardsSection() {
  
  const queryClient = useQueryClient();
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const { data: rawDecks = [], isLoading } = useQuery<any>({
    queryKey: ['admin-flashcards'],
    queryFn: () => apiGet<any>('/dashboard/flashcards'),
  });

  const decks = Array.isArray(rawDecks) 
    ? rawDecks 
    : (rawDecks as any)?.decks || (rawDecks as any)?.data || [];


  const invalidateDecks = () => queryClient.invalidateQueries({ queryKey: ['admin-flashcards'] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredDecks = (decks as FlashcardDeck[]).filter((d: FlashcardDeck) => filterLevel === 'all' || d.level === filterLevel);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this deck?')) return;
    const toastId = toast.loading('Deleting...');
    try {
      const res = await apiDelete(`/dashboard/flashcards/${id}`);
      if (res.ok) {
        toast.success('Deck deleted.', { id: toastId });
        invalidateDecks();
      } else {
        toast.error('Error deleting deck.', { id: toastId });
      }
    } catch {
      toast.error('Error deleting deck.', { id: toastId });
    }
  };

  const openModal = (deck?: FlashcardDeck) => {
    if (deck) {
      setEditingDeck(deck);
      setFormData({
        title: deck.title,
        description: deck.description || '',
        card_count: deck.card_count || 20,
        level: deck.level || 'all',
        ai_theme: '',
      });
    } else {
      setEditingDeck(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleGenerateWithAI = async () => {
    if (!formData.ai_theme.trim()) {
      toast.error('Informe um tema para gerar com IA.');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiPost<{ ok: boolean }>(ENDPOINTS.ADMIN_MODULE_GENERATE_FLASHCARDS, {
        theme: formData.ai_theme,
        instructions: '',
        level: formData.level,
        card_count: formData.card_count,
        module_id: editingDeck?.id
      });
      if (res.ok) {
        toast.success('Flashcards generated with AI successfully!');
        await invalidateDecks();
        setIsModalOpen(false);
      } else {
        toast.error('Error generating flashcards with AI.');
      }
    } catch {
      toast.error('Error connecting with AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        card_count: Number(formData.card_count) || 20,
        level: formData.level,
      };

      let res;
      if (editingDeck) {
        res = await apiPut(`/dashboard/flashcards/${editingDeck.id}`, payload);
      } else {
        res = await apiPost('/dashboard/flashcards', payload);
      }

      if (res.ok) {
        toast.success('Saved successfully!');
        await invalidateDecks();
        setIsModalOpen(false);
      } else {
        toast.error('Error saving deck.');
      }
    } catch {
      toast.error('Error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  if (isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <Layers size={22} className="text-primary" />
                {'Flashcard Decks'}
            </h3>
            <select 
              className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-primary/50 transition-all"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="Beginner">Beginner</option>
              <option value="Pre-Intermediate">Pre-Intermediate</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Business English">Business English</option>
              <option value="Advanced">Advanced</option>
            </select>
         </div>
         <Button className="gap-2" onClick={() => openModal()}>
            <Plus size={18} />
            {'New Deck'}
         </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDecks.length > 0 ? filteredDecks.map((d: FlashcardDeck) => (
          <div key={d.id} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 group hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                 <FileBox size={20} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-primary">
                  {d.card_count || 0} cards
                </span>
                <span className="text-[0.55rem] font-black uppercase text-text-subtle tracking-tighter">
                  {d.level === 'all' || d.level === 'todos' ? 'All Levels' : (d.level || 'Intermediate')}
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-text mb-1 truncate">{d.title}</h4>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8">
                {d.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-auto pt-2">
               <button onClick={() => openModal(d)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border">
                  <PenLine size={16} />
               </button>
               <button className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border">
                  <Eye size={16} />
               </button>
               <button
                  onClick={() => handleDelete(d.id)}
                  className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
               >
                  <Trash2 size={16} />
               </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl">
             <p className="text-text-muted">{'No decks found.'}</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDeck ? 'Edit Deck' : 'New Deck'}
      >
        <div className="space-y-4">
            <Input
              label={'Deck Title'}
              value={formData.title}
              onChange={set('title')}
              placeholder="Ex: Business Vocabulary"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Level</label>
                <select 
                  className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                  value={formData.level}
                  onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="pre-intermediate">Pre-Intermediate</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="business english">Business English</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <Input
                label="Card count"
                type="number"
                value={String(formData.card_count)}
                onChange={set('card_count')}
                min="5"
                max="100"
              />
            </div>

            <Input
              label={'Description'}
              value={formData.description}
              onChange={set('description')}
              placeholder="Optional description"
            />

            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                <Sparkles size={16} /> {'Generate with AI'}
              </h4>
              <textarea
                placeholder={'E.g.: Verbs of Movement, Travel...'}
                className="w-full min-h-[80px] p-3.5 bg-surface border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all resize-none"
                value={formData.ai_theme}
                onChange={(e) => setFormData(prev => ({ ...prev, ai_theme: e.target.value }))}
              />
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={handleGenerateWithAI}
                loading={isGenerating}
                disabled={!formData.ai_theme.trim()}
              >
                <Sparkles size={14} />
                {'Generate Cards'}
              </Button>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{'Cancel'}</Button>
                <Button onClick={handleSave} loading={isSaving}>{'Save'}</Button>
            </div>
        </div>
      </DialogModal>
    </div>
  );
}
