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
  X
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

interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  card_count?: number;
  level?: string;
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
  ai_theme: string;
  ai_with_images: boolean;
  flashcards: Array<Flashcard>;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  card_count: 10,
  level: 'all',
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
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredDecks = (decks as FlashcardDeck[]).filter((d: FlashcardDeck) => {
    if (filterLevel === 'all') return true;
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

  const openModal = async (deck?: FlashcardDeck) => {
    if (deck) {
      setEditingDeck(deck);
      // Busca detalhes completos para pegar os cards
      try {
        const details = await apiGet<any>(`/activities/modules/${deck.id}`);
        setFormData({
          title: details.title || deck.title,
          description: details.description || deck.description || '',
          card_count: details.flashcards?.length || deck.card_count || 10,
          level: details.level || deck.level || 'all',
          ai_theme: '',
          ai_with_images: false,
          flashcards: details.flashcards || []
        });
      } catch (err) {
        setFormData({
          title: deck.title,
          description: deck.description || '',
          card_count: deck.card_count || 10,
          level: deck.level || 'all',
          ai_theme: '',
          ai_with_images: false,
          flashcards: []
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
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

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
    // Prevent re-uploading if it's already a Cloudinary URL
    if (url.includes('res.cloudinary.com')) return;
    
    setUploadingImages(prev => ({ ...prev, [idx]: true }));
    setImageErrors(prev => ({ ...prev, [idx]: false }));
    
    try {
      console.log(`[Flashcards] Uploading image from URL for card ${idx}...`);
      const res = await apiPost<{ url: string }>('/flashcard-assets/upload-image-from-url', { url });
      
      if (res.ok && res.data?.url) {
        setImageErrors(prev => ({ ...prev, [idx]: false }));
        updateCard(idx, 'image_url', res.data.url);
        toast.success('Image saved securely!');
      } else {
        console.error(`[Flashcards] URL upload failed:`, res);
      }
    } catch (err) {
      console.error(`[Flashcards] URL upload error:`, err);
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
      console.log(`[Flashcards] Generating image for: ${prompt}`);
      const res = await apiPost<{ url: string }>('/flashcard-assets/ai-image', { prompt });
      console.log(`[Flashcards] Generation result:`, res);
      
      if (res.ok && res.data?.url) {
        setImageErrors(prev => ({ ...prev, [idx]: false })); // Reset error
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
        level: formData.level,
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
        level: formData.level,
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
              {LEVEL_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
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
                <span className={cn(
                  "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  d.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                )}>
                  {d.is_published ? 'Published' : 'Draft'}
                </span>
                <span className="text-[0.55rem] font-black uppercase text-text-subtle tracking-tighter">
                  {d.level === 'all' || d.level === 'todos' ? 'All Levels' : levelLabel(d.level)}
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
                  {LEVEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Target Card Count"
                type="number"
                value={String(formData.card_count)}
                onChange={set('card_count')}
                min="1"
                max="100"
              />
            </div>

            <Input
              label={'Description'}
              value={formData.description}
              onChange={set('description')}
              placeholder="Optional description"
            />

            {/* Manual Cards Section */}
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <Layers size={16} /> Manual Cards ({formData.flashcards.length})
                </h4>
                <Button variant="secondary" size="sm" onClick={addManualCard} className="h-7 text-[0.65rem] gap-1">
                  <Plus size={12} /> Add Card
                </Button>
              </div>

              {formData.flashcards.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                  {formData.flashcards.map((card, idx) => (
                    <div key={idx} className="grid grid-cols-[50px,1fr,1fr,auto] gap-2 items-center bg-surface p-2 rounded-xl border border-border group">
                      {/* Image Preview / Upload */}
                      <div 
                        className="w-[50px] h-[50px] rounded-lg bg-input border border-border overflow-hidden flex items-center justify-center relative cursor-pointer group/img"
                        onClick={() => document.getElementById(`file-upload-${idx}`)?.click()}
                        title="Click to upload image"
                      >
                        {card.image_url ? (
                          <>
                            <img 
                              key={card.image_url}
                              src={card.image_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                              onError={() => {
                                console.error(`[Flashcards] Error loading image for card ${idx}: ${card.image_url}`);
                                setImageErrors(prev => ({ ...prev, [idx]: true }));
                              }}
                              onLoad={() => {
                                setImageErrors(prev => ({ ...prev, [idx]: false }));
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedImageUrl(card.image_url || null);
                              }}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center"
                              title="Expand image"
                            >
                              <Eye size={14} className="text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={16} className="text-text-muted opacity-30" />
                          </div>
                        )}
                        
                        {/* Overlay with Upload Icon */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center">
                          <Upload size={14} className="text-white" />
                        </div>

                        {(generatingImages[idx] || uploadingImages[idx]) && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
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
                            if (file) handleImageUpload(idx, file);
                            e.target.value = ''; // Reset for same file re-upload
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <input 
                          className="bg-transparent border-b border-border text-xs py-1 outline-none focus:border-primary transition-all"
                          placeholder="Front (term)"
                          value={card.front}
                          onChange={(e) => updateCard(idx, 'front', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <input 
                          className="bg-transparent border-b border-border text-xs py-1 outline-none focus:border-primary transition-all"
                          placeholder="Back (meaning)"
                          value={card.back}
                          onChange={(e) => updateCard(idx, 'back', e.target.value)}
                        />
                        <div className="flex items-center gap-2 mt-1">
                           <input 
                            className="flex-1 bg-transparent border-b border-border text-[0.6rem] py-0.5 outline-none focus:border-primary transition-all opacity-70"
                            placeholder="Image URL"
                            value={card.image_url || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Basic fix for Google Search links: try to extract the original URL or at least prevent the direct imgres link
                              if (val.includes('imgres?q=')) {
                                const urlParams = new URLSearchParams(val.split('?')[1]);
                                const imgUrl = urlParams.get('imgurl');
                                if (imgUrl) {
                                  setImageErrors(prev => ({ ...prev, [idx]: false }));
                                  updateCard(idx, 'image_url', decodeURIComponent(imgUrl));
                                  return;
                                }
                              }
                              setImageErrors(prev => ({ ...prev, [idx]: false }));
                              updateCard(idx, 'image_url', val);
                            }}
                            onBlur={(e) => {
                              handleUrlUpload(idx, e.target.value);
                            }}
                          />
                          <button 
                            onClick={() => generateCardImage(idx)}
                            disabled={generatingImages[idx]}
                            className={`p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-all ${generatingImages[idx] ? 'animate-pulse' : ''}`}
                            title="Generate/Search Image"
                          >
                            <Sparkles size={10} />
                          </button>
                        </div>
                      </div>
                      <button onClick={() => removeCard(idx)} className="text-text-subtle hover:text-danger p-1 self-center">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.65rem] text-text-muted italic text-center py-1">No manual cards added yet.</p>
              )}
            </div>

            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                <Sparkles size={16} /> {'AI Generation'}
              </h4>
              <textarea
                placeholder={'E.g.: Verbs of Movement, Travel...'}
                className="w-full min-h-[60px] p-3.5 bg-surface border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all resize-none mb-2"
                value={formData.ai_theme}
                onChange={(e) => setFormData(prev => ({ ...prev, ai_theme: e.target.value }))}
              />
              <div className="flex items-center gap-2 mb-2 px-1">
                <input 
                  type="checkbox" 
                  id="ai_with_images"
                  checked={formData.ai_with_images}
                  onChange={(e) => setFormData(prev => ({ ...prev, ai_with_images: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="ai_with_images" className="text-xs font-medium text-text-muted cursor-pointer">
                  Generate images for all cards (Slower)
                </label>
              </div>
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

      {/* Image Preview Modal */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExpandedImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setExpandedImageUrl(null)}
              className="absolute -top-3 -right-3 bg-white text-black p-2 rounded-full shadow-lg hover:bg-gray-100 z-10"
            >
              <X size={20} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedImageUrl}
              alt="Preview"
              className="w-full h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

