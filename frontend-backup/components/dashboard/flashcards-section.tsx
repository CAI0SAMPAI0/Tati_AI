'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Trash2,
  PenLine,
  Eye,
  EyeOff,
  Play,
  FileBox,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Loader2,
  CheckSquare,
  Square,
  CheckCircle2,
  Compass,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Award,
  Crown,
  ChevronRight,
  ChevronLeft,
  Info,
  Check,
  X,
  Sliders,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { apiGet, apiDelete, apiPost, apiPut, apiUpload } from '@/lib/api/client';

import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogModal } from '@/components/ui/dialog-modal';
import toast from 'react-hot-toast';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { LEVEL_OPTIONS, LEVEL_FILTER_OPTIONS, normalizeLevel, levelLabel } from '@/lib/constants/levels';
import { cn } from '@/lib/utils';

export const CEFR_LEVELS_METADATA = [
  {
    code: 'A1',
    label: 'Beginner',
    desc: 'Basic phrases & everyday expressions',
    icon: Compass,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    code: 'A2',
    label: 'Elementary',
    desc: 'Simple, routine daily exchanges',
    icon: BookOpen,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
  },
  {
    code: 'B1',
    label: 'Intermediate',
    desc: 'Work, school, leisure & travel topics',
    icon: MessageSquare,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    code: 'B2',
    label: 'Upper Intermediate',
    desc: 'Complex ideas & spontaneous discussion',
    icon: GraduationCap,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
  },
  {
    code: 'C1',
    label: 'Advanced',
    desc: 'Nuanced, flexible & fluent expression',
    icon: Award,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  {
    code: 'C2',
    label: 'Mastery',
    desc: 'Near-native precision & subtlety',
    icon: Crown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
];

interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  card_count?: number;
  level?: string;
  levels?: string[];
  is_published?: boolean;
  flashcards?: Array<{ front: string; back: string; image_url?: string }>;
}

interface Flashcard {
  front: string;
  back: string;
  image_url?: string;
}

interface FormState {
  title: string;
  description: string;
  card_count: number;
  level: string;
  levels: string[];
  ai_theme: string;
  ai_with_images: boolean;
  flashcards: Array<Flashcard>;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  card_count: 10,
  level: 'all',
  levels: [],
  ai_theme: '',
  ai_with_images: false,
  flashcards: [],
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
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [showAiGen, setShowAiGen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const filteredDecks = (decks as FlashcardDeck[]).filter((d: FlashcardDeck) => {
    if (filterLevel === 'all') return true;
    const deckLevels = (d as any).levels || (d.level ? [d.level] : []);
    if (Array.isArray(deckLevels) && deckLevels.length > 0) {
      return deckLevels.some((l: string) => normalizeLevel(l) === normalizeLevel(filterLevel));
    }
    return normalizeLevel(d.level) === normalizeLevel(filterLevel);
  });

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

  const handleTogglePublish = async (id: string, current: boolean) => {
    try {
      await apiPut(`/dashboard/flashcards/${id}`, { is_published: !current });
      toast.success(current ? 'Deck returned to drafts' : 'Deck published!');
      invalidateDecks();
    } catch {
      toast.error('Error updating status.');
    }
  };

  const toggleSelectDeck = (id: string) => {
    setSelectedDeckIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedDeckIds.length === filteredDecks.length) {
      setSelectedDeckIds([]);
    } else {
      setSelectedDeckIds(filteredDecks.map((d) => d.id));
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedDeckIds.length === 0) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading(publish ? 'Publishing selected decks...' : 'Moving to drafts...');
    try {
      await Promise.all(
        selectedDeckIds.map((id) => apiPut(`/dashboard/flashcards/${id}`, { is_published: publish }))
      );
      toast.success(publish ? `${selectedDeckIds.length} decks published successfully!` : `${selectedDeckIds.length} decks moved to drafts!`, { id: toastId });
      setSelectedDeckIds([]);
      invalidateDecks();
    } catch {
      toast.error('Error updating decks in bulk.', { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDeckIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedDeckIds.length} selected deck(s)?`)) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading('Deleting selected decks...');
    try {
      await Promise.all(selectedDeckIds.map((id) => apiDelete(`/dashboard/flashcards/${id}`)));
      toast.success(`${selectedDeckIds.length} deck(s) deleted successfully.`, { id: toastId });
      setSelectedDeckIds([]);
      invalidateDecks();
    } catch {
      toast.error('Error deleting selected decks.', { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const openModal = async (deck?: FlashcardDeck) => {
    setActiveStep(1);
    setShowAiGen(false);
    if (deck) {
      setEditingDeck(deck);
      try {
        const details = await apiGet<any>(`/activities/modules/${deck.id}`);
        const existingLevels = details.levels || (details.level ? [details.level] : []);
        const loadedFlashcards = (details.flashcards && details.flashcards.length > 0) 
          ? details.flashcards 
          : (deck.flashcards || []);

        setFormData({
          title: details.title || deck.title,
          description: details.description || deck.description || '',
          card_count: loadedFlashcards.length || deck.card_count || 10,
          level: details.level || deck.level || 'all',
          levels: Array.isArray(existingLevels) ? existingLevels : [],
          ai_theme: '',
          ai_with_images: false,
          flashcards: loadedFlashcards
        });
      } catch (err) {
        setFormData({
          title: deck.title,
          description: deck.description || '',
          card_count: deck.flashcards?.length || deck.card_count || 10,
          level: deck.level || 'all',
          levels: deck.level ? [deck.level] : [],
          ai_theme: '',
          ai_with_images: false,
          flashcards: deck.flashcards || []
        });
      }
    } else {
      setEditingDeck(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const addManualCard = () => {
    setFormData(prev => ({
      ...prev,
      flashcards: [...prev.flashcards, { front: '', back: '', image_url: '' }]
    }));
  };

  const handleToggleLevel = (levelValue: string) => {
    setFormData(prev => {
      const current = prev.levels.map(l => l.toUpperCase());
      const target = levelValue.toUpperCase();
      const isCurrentlySelected = current.includes(target);

      let newLevels: string[];
      if (isCurrentlySelected) {
        newLevels = prev.levels.filter(l => l.toUpperCase() !== target);
      } else {
        newLevels = [...prev.levels, levelValue];
      }

      return { ...prev, levels: newLevels };
    });
  };

  const removeCard = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      flashcards: prev.flashcards.filter((_, i) => i !== idx)
    }));
  };

  const updateCard = (idx: number, field: keyof Flashcard, value: string) => {
    const newCards = [...formData.flashcards];
    newCards[idx] = { ...newCards[idx], [field]: value };
    setFormData(prev => ({ ...prev, flashcards: newCards }));
  };

  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [uploadingImages, setUploadingImages] = useState<Record<number, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleImageUpload = async (idx: number, file: File) => {
    if (!file) return;
    
    setUploadingImages(prev => ({ ...prev, [idx]: true }));
    setImageErrors(prev => ({ ...prev, [idx]: false }));
    
    try {
      console.log(`[Flashcards] Uploading image for card ${idx}...`);
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      
      const res = await apiUpload<{ url: string }>('/flashcard-assets/upload-image', formDataUpload);
      console.log(`[Flashcards] Upload result:`, res);
      
      if (res.ok && res.data?.url) {
        setImageErrors(prev => ({ ...prev, [idx]: false })); // Reset error
        updateCard(idx, 'image_url', res.data.url);
        toast.success('Image uploaded!');
      } else {
        const errorMsg = (res.data as any)?.detail || 'Upload failed';
        toast.error(errorMsg);
        console.error(`[Flashcards] Upload failed:`, res);
      }
    } catch (err) {
      console.error(`[Flashcards] Upload error:`, err);
      toast.error('Upload error');
    } finally {
      setUploadingImages(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleUrlUpload = async (idx: number, url: string) => {
    if (!url || !url.startsWith('http')) return;
    if (url.includes('res.cloudinary.com')) return;

    setUploadingImages(prev => ({ ...prev, [idx]: true }));
    setImageErrors(prev => ({ ...prev, [idx]: false }));

    try {
      const res = await apiPost<{ url: string }>('/flashcard-assets/upload-image-from-url', { url });
      if (res.ok && res.data?.url) {
        setImageErrors(prev => ({ ...prev, [idx]: false }));
        updateCard(idx, 'image_url', res.data.url);
      }
    } catch (err) {
      console.warn(`[Flashcards] Keeping direct URL for card ${idx}:`, err);
    } finally {
      setUploadingImages(prev => ({ ...prev, [idx]: false }));
    }
  };

  const generateCardImage = async (idx: number) => {
    const card = formData.flashcards[idx];
    const prompt = card.front || card.back;
    if (!prompt) return toast.error('Front or Back required for AI');

    setGeneratingImages(prev => ({ ...prev, [idx]: true }));
    setImageErrors(prev => ({ ...prev, [idx]: false }));

    try {
      const res = await apiPost<{ url: string }>('/flashcard-assets/ai-image', {
        prompt,
        front: card.front,
        back: card.back,
        topic: formData.title,
      });

      if (res.ok && res.data?.url) {
        setImageErrors(prev => ({ ...prev, [idx]: false }));
        updateCard(idx, 'image_url', res.data.url);
        toast.success('Image ready!');
      } else {
        const errorMsg = (res.data as any)?.detail || 'Failed to generate image';
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error(`[Flashcards] Generation error:`, err);
      toast.error('Error generating image');
    } finally {
      setGeneratingImages(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleGenerateWithAI = async () => {
    if (!formData.ai_theme.trim()) {
      toast.error('Informe um tema para gerar com IA.');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiPost<{ success: boolean; task_id?: string }>(ENDPOINTS.ADMIN_MODULE_GENERATE_FLASHCARDS, {
        theme: formData.ai_with_images ? `IMG:${formData.ai_theme}` : formData.ai_theme,
        instructions: '',
        levels: formData.levels,
        card_count: formData.card_count,
        module_id: editingDeck?.id
      });
      if (res.ok && res.data.success && res.data.task_id) {
        const taskId = res.data.task_id;
        toast.loading('Generating flashcards with AI...', { id: taskId });
        
        const MAX_POLL_RETRIES = 60;
        let pollRetries = 0;
        const pollInterval = setInterval(async () => {
          try {
            pollRetries++;
            if (pollRetries > MAX_POLL_RETRIES) {
              clearInterval(pollInterval);
              setIsGenerating(false);
              toast.error('Generation timed out. Please try again.', { id: taskId });
              return;
            }
            const statusRes = await apiGet<{status: string; error?: string}>(`/tasks/status/${taskId}`);
            if (statusRes) {
              if (statusRes.status === 'success') {
                clearInterval(pollInterval);
                setIsGenerating(false);
                toast.success('Flashcards generated successfully!', { id: taskId });
                await invalidateDecks();
                setIsModalOpen(false);
              } else if (statusRes.status === 'failed') {
                clearInterval(pollInterval);
                setIsGenerating(false);
                toast.error(`Failed to generate flashcards: ${statusRes.error || 'Unknown error'}`, { id: taskId });
              }
            }
          } catch (err: any) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            toast.error(`Error checking status: ${err.message}`, { id: taskId });
          }
        }, 2000);
      } else {
        setIsGenerating(false);
        toast.error('Error generating flashcards with AI.');
      }
    } catch {
      setIsGenerating(false);
      toast.error('Error connecting with AI.');
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
        card_count: formData.flashcards.length || Number(formData.card_count) || 10,
        levels: formData.levels,
        flashcards: formData.flashcards
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

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  if (isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-4 flex-wrap">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <Layers size={22} className="text-primary" />
                {'Flashcard Decks'}
            </h3>
            <select 
              className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-primary/50 transition-all"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              {LEVEL_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {filteredDecks.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all px-2.5 py-1 rounded-lg border border-border bg-surface"
              >
                {selectedDeckIds.length === filteredDecks.length ? (
                  <CheckSquare size={15} className="text-primary" />
                ) : (
                  <Square size={15} />
                )}
                <span>
                  {selectedDeckIds.length === filteredDecks.length ? 'Deselect All' : `Select All (${filteredDecks.length})`}
                </span>
              </button>
            )}
         </div>
         <Button className="gap-2" onClick={() => openModal()}>
            <Plus size={18} />
            {'New Deck'}
         </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedDeckIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedDeckIds.length} selected
            </span>
            <span className="text-xs text-text-muted">of {filteredDecks.length} visible decks</span>
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
              onClick={() => setSelectedDeckIds([])}
              className="px-2.5 py-1.5 text-xs text-text-muted hover:text-text font-bold transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDecks.length > 0 ? filteredDecks.map((d: FlashcardDeck) => {
          const isSelected = selectedDeckIds.includes(d.id);
          return (
          <div
            key={d.id}
            className={cn(
              "bg-surface border rounded-2xl p-5 flex flex-col gap-4 group transition-all relative",
              isSelected ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border hover:border-primary/40"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSelectDeck(d.id)}
                  className="text-text-muted hover:text-primary transition-all p-0.5"
                  title={isSelected ? "Desmarcar" : "Selecionar"}
                >
                  {isSelected ? (
                    <CheckSquare size={20} className="text-primary" />
                  ) : (
                    <Square size={20} />
                  )}
                </button>
                <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                   <FileBox size={20} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-primary">
                  {d.card_count || 0} cards
                </span>
                <span className={cn(
                  "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  d.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                )}>
                  {d.is_published ? 'Published' : 'Draft'}
                </span>
                <span className="text-[0.55rem] font-black uppercase text-text-subtle tracking-tighter">
                  {(() => {
                    const deckLevels = (d as any).levels || (d.level ? [d.level] : []);
                    if (Array.isArray(deckLevels) && deckLevels.length > 0) {
                      return deckLevels.map((l: string) => levelLabel(l)).join(', ');
                    }
                    return d.level === 'all' || d.level === 'todos' ? 'All Levels' : levelLabel(d.level);
                  })()}
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-text mb-1 truncate">{d.title}</h4>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8">
                {d.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-auto pt-2">
               <button onClick={() => openModal(d)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                  <PenLine size={16} />
               </button>
               <button onClick={() => handleTogglePublish(d.id, !!d.is_published)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title={d.is_published ? "Unpublish (Draft)" : "Publish"}>
                  {d.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
               </button>
               <button
                  onClick={() => handleDelete(d.id)}
                  className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
                  title="Delete"
               >
                  <Trash2 size={16} />
               </button>
               <a
                  href={`/flashcards/${d.id}`}
                  className="flex items-center justify-center p-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all border border-transparent"
                  title="Start flashcard session"
               >
                  <Play size={16} />
               </a>
            </div>
          </div>
        );
        }) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl">
             <p className="text-text-muted">{'No decks found.'}</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="2xl"
        hideDefaultHeader={true}
        className="max-w-5xl"
        contentClassName="p-0"
        customHeader={
          <div className="flex flex-col gap-4 p-5 sm:p-6 pb-4 border-b border-border/60 shrink-0 bg-surface">
            {/* Top Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner shrink-0">
                  <Layers size={24} className="text-primary" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest text-primary uppercase block">
                    FLASHCARD DECK
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-text tracking-tight">
                    {editingDeck ? 'Edit deck' : 'New deck'}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Update deck name, category, CEFR level and flashcards
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-surface-hover rounded-full transition-colors text-text-muted hover:text-text cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer text-left",
                  activeStep === 1
                    ? "bg-primary/10 border border-primary/25"
                    : "hover:bg-surface-hover opacity-75"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all",
                    activeStep === 1
                      ? "bg-primary text-white shadow-sm shadow-primary/30"
                      : "bg-surface border border-border text-text-muted"
                  )}
                >
                  1
                </div>
                <div>
                  <span className={cn("text-xs font-bold block", activeStep === 1 ? "text-primary" : "text-text")}>
                    Basic details
                  </span>
                  <span className="text-[10px] text-text-muted block">
                    Title & CEFR Level
                  </span>
                </div>
              </button>

              <div className="w-8 sm:w-12 h-0.5 bg-border shrink-0" />

              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer text-left",
                  activeStep === 2
                    ? "bg-primary/10 border border-primary/25"
                    : "hover:bg-surface-hover opacity-75"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all",
                    activeStep === 2
                      ? "bg-primary text-white shadow-sm shadow-primary/30"
                      : "bg-surface border border-border text-text-muted"
                  )}
                >
                  2
                </div>
                <div>
                  <span className={cn("text-xs font-bold block", activeStep === 2 ? "text-primary" : "text-text")}>
                    Cards
                  </span>
                  <span className="text-[10px] text-text-muted block">
                    {formData.flashcards.length} cards added
                  </span>
                </div>
              </button>
            </div>
          </div>
        }
      >
        <div className="p-5 sm:p-6 space-y-6">
          {activeStep === 1 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Form Details & CEFR Level Selection */}
              <div className="lg:col-span-7 space-y-5">
                {/* Section 1: Deck Information */}
                <div className="bg-surface/60 border border-border/70 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <PenLine size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-text uppercase tracking-wider">
                        Deck Information
                      </h4>
                      <p className="text-[11px] text-text-muted">
                        Title, description and target settings for this deck
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-text">Deck Title</label>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    </div>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={set('title')}
                      placeholder="Ex: A1 Daily Routines"
                      className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-text">Description</label>
                      <span className="text-[10px] font-medium text-text-muted">
                        {formData.description.length}/200
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={set('description')}
                      maxLength={200}
                      placeholder="Essential vocabulary for everyday activities and conversations..."
                      className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-sm text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Section 2: Target CEFR Level */}
                <div className="bg-surface/60 border border-border/70 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <GraduationCap size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-text uppercase tracking-wider">
                        Target CEFR Level
                      </h4>
                      <p className="text-[11px] text-text-muted">
                        Select the proficiency level this deck is designed for
                      </p>
                    </div>
                  </div>

                  {/* 2x3 Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {CEFR_LEVELS_METADATA.map((lvl) => {
                      const isSelected = formData.levels.map(l => l.toUpperCase()).includes(lvl.code);
                      const Icon = lvl.icon;
                      return (
                        <button
                          key={lvl.code}
                          type="button"
                          onClick={() => handleToggleLevel(lvl.code)}
                          className={cn(
                            "rounded-2xl border p-3 flex flex-col justify-between text-left transition-all relative select-none cursor-pointer group",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/25"
                              : "border-border bg-surface hover:border-primary/40 hover:bg-surface-hover"
                          )}
                        >
                          <div className="flex items-start justify-between w-full mb-1">
                            <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center", lvl.bgColor, lvl.color)}>
                              <Icon size={14} />
                            </div>
                            {isSelected && (
                              <CheckCircle2 size={16} className="text-primary fill-primary/20" />
                            )}
                          </div>
                          <div>
                            <span className="font-extrabold text-xs text-text block">
                              {lvl.code} - {lvl.label}
                            </span>
                            <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2 leading-tight">
                              {lvl.desc}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-text-subtle">
                    <Info size={13} className="text-primary shrink-0" />
                    <span>Selected level determines vocabulary difficulty and sentence structure.</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Preview */}
              <div className="lg:col-span-5">
                <div className="bg-gradient-to-b from-surface via-surface/80 to-bg border border-border/80 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 shadow-sm sticky top-2">
                  {/* 3D Stack Graphic */}
                  <div className="relative pt-2 pb-1">
                    <div className="absolute w-32 h-24 bg-primary/20 rounded-2xl -rotate-6 transform -translate-y-1 -translate-x-1" />
                    <div className="absolute w-32 h-24 bg-violet-600/25 rounded-2xl rotate-3 transform translate-y-0.5 translate-x-1" />
                    <div className="relative w-36 h-26 bg-gradient-to-br from-primary via-violet-600 to-indigo-700 rounded-2xl shadow-xl shadow-primary/25 p-3 flex flex-col items-center justify-center text-white transition-all transform hover:scale-105">
                      <Layers size={24} className="text-white drop-shadow mb-1" />
                      <span className="text-[9px] font-black tracking-widest uppercase opacity-95">
                        FLASHCARD DECK
                      </span>
                      <span className="text-[9px] opacity-80 mt-0.5 font-bold">
                        {formData.flashcards.length} Cards
                      </span>
                    </div>
                  </div>

                  {/* Live Preview Info */}
                  <div className="space-y-1 w-full">
                    <span className="text-[10px] font-black tracking-widest text-primary uppercase bg-primary/10 px-2.5 py-0.5 rounded-full inline-block">
                      LIVE PREVIEW
                    </span>
                    <h3 className="text-base font-black text-text truncate max-w-full px-2">
                      {formData.title || 'Untitled Deck'}
                    </h3>
                    <p className="text-xs text-text-muted line-clamp-2 px-3">
                      {formData.description || 'No description provided yet.'}
                    </p>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
                    <div className="bg-surface border border-border/80 rounded-xl p-2.5 flex items-center gap-2 text-left">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileBox size={16} />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-text-muted uppercase block">Cards</span>
                        <span className="text-xs font-black text-text">{formData.flashcards.length}</span>
                      </div>
                    </div>

                    <div className="bg-surface border border-border/80 rounded-xl p-2.5 flex items-center gap-2 text-left">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <GraduationCap size={16} />
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-text-muted uppercase block">Level</span>
                        <span className="text-xs font-black text-text truncate max-w-[80px] block">
                          {formData.levels.length > 0 ? formData.levels.join(', ') : 'All'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action preview cards link */}
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="w-full py-2.5 px-4 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-bold text-primary flex items-center justify-between group transition-all cursor-pointer shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={14} />
                      Preview Cards ({formData.flashcards.length})
                    </span>
                    <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Cards Management */
            <div className="space-y-4">
              {/* Step 2 Header & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface/60 border border-border/70 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-text uppercase tracking-wider">
                      Cards Management
                    </h4>
                    <span className="text-[11px] text-text-muted">
                      {formData.flashcards.length} cards in this deck
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAiGen(!showAiGen)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                      showAiGen
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface hover:bg-surface-hover border-border text-primary"
                    )}
                  >
                    <Sparkles size={13} />
                    {showAiGen ? 'Hide AI' : 'Generate with AI'}
                  </button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addManualCard}
                    className="h-8 text-xs font-bold gap-1.5 rounded-xl"
                  >
                    <Plus size={14} /> Add Card
                  </Button>
                </div>
              </div>

              {/* Collapsible AI Gen Box */}
              {showAiGen && (
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles size={14} /> AI Flashcard Generator
                    </h5>
                    <span className="text-[10px] text-text-muted">
                      Generates balanced cards for selected levels
                    </span>
                  </div>
                  <textarea
                    placeholder="Enter theme or topic (e.g. Travel Vocabulary, Business Phrasal Verbs, Restaurant Food)..."
                    className="w-full min-h-[60px] p-3 bg-surface border border-border rounded-xl text-xs outline-none focus:border-primary transition-all resize-none"
                    value={formData.ai_theme}
                    onChange={(e) => setFormData(prev => ({ ...prev, ai_theme: e.target.value }))}
                  />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.ai_with_images}
                        onChange={(e) => setFormData(prev => ({ ...prev, ai_with_images: e.target.checked }))}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Generate realistic image for each card</span>
                    </label>
                    <Button
                      size="sm"
                      onClick={handleGenerateWithAI}
                      loading={isGenerating}
                      disabled={!formData.ai_theme.trim()}
                      className="gap-1.5 text-xs font-bold"
                    >
                      <Sparkles size={13} /> Generate Cards
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards List */}
              {formData.flashcards.length > 0 ? (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1.5 custom-scrollbar">
                  {formData.flashcards.map((card, idx) => (
                    <ManualCardItem
                      key={idx}
                      card={card}
                      idx={idx}
                      isGenerating={!!generatingImages[idx]}
                      isUploading={!!uploadingImages[idx]}
                      hasImageError={!!imageErrors[idx]}
                      onUpdate={updateCard}
                      onRemove={removeCard}
                      onImageUpload={handleImageUpload}
                      onGenerateImage={generateCardImage}
                      onUrlUpload={handleUrlUpload}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-border rounded-2xl bg-surface/30">
                  <Layers size={28} className="text-text-muted/40 mx-auto mb-2" />
                  <p className="text-xs font-bold text-text-muted">No flashcards in this deck yet</p>
                  <p className="text-[11px] text-text-subtle mt-0.5">Click "Add Card" or generate them using AI above</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={addManualCard}
                    className="mt-3 text-xs gap-1.5"
                  >
                    <Plus size={13} /> Add First Card
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/50 shrink-0">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[11px] font-medium hidden sm:inline">Changes are saved as draft</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-bold px-4"
              >
                Cancel
              </Button>

              {activeStep === 1 ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setActiveStep(2)}
                    className="text-xs font-bold gap-1 px-4 text-primary hover:bg-primary/10"
                  >
                    Next: Cards <ChevronRight size={14} />
                  </Button>
                  <Button
                    onClick={handleSave}
                    loading={isSaving}
                    className="text-xs font-bold gap-1.5 px-5 bg-primary shadow-sm shadow-primary/20"
                  >
                    <Check size={14} /> Save Deck
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setActiveStep(1)}
                    className="text-xs font-bold gap-1 px-4"
                  >
                    <ChevronLeft size={14} /> Back to Details
                  </Button>
                  <Button
                    onClick={handleSave}
                    loading={isSaving}
                    className="text-xs font-bold gap-1.5 px-5 bg-primary shadow-sm shadow-primary/20"
                  >
                    <Check size={14} /> Save Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogModal>
    </div>
  );
}

interface ManualCardItemProps {
  card: { front: string; back: string; image_url?: string };
  idx: number;
  isGenerating: boolean;
  isUploading: boolean;
  hasImageError: boolean;
  onUpdate: (idx: number, field: keyof Flashcard, value: string) => void;
  onRemove: (idx: number) => void;
  onImageUpload: (idx: number, file: File) => void;
  onGenerateImage: (idx: number) => void;
  onUrlUpload: (idx: number, url: string) => void;
}

const ManualCardItem = React.memo(function ManualCardItem({
  card,
  idx,
  isGenerating,
  isUploading,
  hasImageError,
  onUpdate,
  onRemove,
  onImageUpload,
  onGenerateImage,
  onUrlUpload,
}: ManualCardItemProps) {
  // Extrai URL limpa se o usuário colar link do Google Imagens
  const handleImageUrlChange = (rawUrl: string) => {
    let cleanUrl = rawUrl.trim();
    if (cleanUrl.includes('imgres?q=') || cleanUrl.includes('google.com/imgres')) {
      try {
        const urlObj = new URL(cleanUrl);
        const imgParam = urlObj.searchParams.get('imgurl');
        if (imgParam) {
          cleanUrl = decodeURIComponent(imgParam);
        }
      } catch {
        // Fallback para regex
        const match = cleanUrl.match(/[?&]imgurl=([^&]+)/);
        if (match && match[1]) {
          cleanUrl = decodeURIComponent(match[1]);
        }
      }
    }
    onUpdate(idx, 'image_url', cleanUrl);
  };

  return (
    <div className="p-3 bg-surface border border-border/80 rounded-2xl flex flex-col sm:flex-row gap-3 items-start sm:items-center group hover:border-primary/40 transition-all">
      {/* Number Badge */}
      <div className="w-5 text-[11px] font-black text-text-subtle text-center shrink-0 hidden sm:block">
        #{idx + 1}
      </div>

      {/* Image Preview / Upload */}
      <div 
        className="w-16 h-16 rounded-xl bg-input border border-border overflow-hidden flex items-center justify-center relative cursor-pointer group/img shrink-0"
        onClick={() => document.getElementById(`file-upload-${idx}`)?.click()}
        title="Click to upload image file"
      >
        {card.image_url && !hasImageError ? (
          <img 
            key={card.image_url}
            src={card.image_url} 
            alt="" 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/20">
            <ImageIcon size={18} className="text-text-muted opacity-40" />
          </div>
        )}
        
        {/* Overlay with Upload Icon */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center">
          <Upload size={14} className="text-white" />
        </div>

        {(isGenerating || isUploading) && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 size={16} className="text-primary animate-spin" />
          </div>
        )}
        
        <input 
          type="file" 
          id={`file-upload-${idx}`} 
          className="hidden" 
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImageUpload(idx, file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Text Inputs Column */}
      <div className="flex-1 w-full space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-text-subtle uppercase mb-0.5">
              Front (Term)
            </label>
            <input 
              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text outline-none focus:border-primary transition-all"
              placeholder="Word or phrase"
              value={card.front}
              onChange={(e) => onUpdate(idx, 'front', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-text-subtle uppercase mb-0.5">
              Back (Meaning / Translation)
            </label>
            <input 
              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text outline-none focus:border-primary transition-all"
              placeholder="Definition or meaning"
              value={card.back}
              onChange={(e) => onUpdate(idx, 'back', e.target.value)}
            />
          </div>
        </div>

        {/* Image URL Input & Action Buttons */}
        <div>
          <label className="block text-[10px] font-bold text-text-subtle uppercase mb-0.5">
            Image URL (paste any web link or generate with AI)
          </label>
          <div className="flex items-center gap-1.5">
            <input 
              type="text"
              className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-text outline-none focus:border-primary transition-all placeholder:text-[11px]"
              placeholder="Paste image URL from the internet..."
              value={card.image_url || ''}
              onChange={(e) => handleImageUrlChange(e.target.value)}
              onBlur={(e) => onUrlUpload(idx, e.target.value)}
            />
            {card.image_url && (
              <button
                type="button"
                onClick={() => onUpdate(idx, 'image_url', '')}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-surface-hover transition-all"
                title="Clear Image URL"
              >
                <X size={12} />
              </button>
            )}
            <button 
              type="button"
              onClick={() => onGenerateImage(idx)}
              disabled={isGenerating}
              className={cn(
                "p-1.5 px-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-bold flex items-center gap-1 shrink-0",
                isGenerating && "animate-pulse opacity-50"
              )}
              title="Search and generate specific image with AI"
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline text-[11px]">AI Search</span>
            </button>
            <button 
              type="button"
              onClick={() => document.getElementById(`file-upload-${idx}`)?.click()}
              className="p-1.5 px-2 rounded-lg bg-surface border border-border text-text hover:text-primary hover:border-primary transition-all text-xs font-bold flex items-center gap-1 shrink-0"
              title="Upload image from your device"
            >
              <Upload size={12} />
              <span className="hidden sm:inline text-[11px]">Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Action */}
      <button 
        type="button" 
        onClick={() => onRemove(idx)} 
        className="text-text-subtle hover:text-danger p-2 rounded-xl hover:bg-danger/10 transition-all self-end sm:self-center shrink-0 cursor-pointer"
        title="Remove Flashcard"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
});


