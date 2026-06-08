'use client';

import React, { useState, useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  PenLine,
  Eye,
  EyeOff,
  Trash2,
  BookOpen,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Youtube,
  Music,
  ImagePlus,
  FileText,
  File,
  Presentation,
  FileSpreadsheet,
  UploadCloud
} from 'lucide-react';

import { apiGet, apiPut, apiDelete, apiPost, apiUpload } from '@/lib/api/client';

import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';
import { DialogModal } from '@/components/ui/dialog-modal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface ModuleRow {
  id: string;
  title: string;
  description?: string;
  is_published: boolean;
  level?: string;
  levels?: string[];
  order?: number;
  ai_prompt?: string;
  youtube_url?: string;
  spotify_url?: string;
  image_url?: string;
  file_url?: string;
  quizzes?: Array<{
    id: string;
    title: string;
    questions?: any[];
  }>;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

interface GeneratedContent {
  quiz_title: string;
  questions: QuizQuestion[];
}

interface FormState {
  title: string;
  description: string;
  ai_prompt: string;
  youtube_url: string;
  spotify_url: string;
  image_url: string;
  file_url: string;
  level: string;
  num_questions: number;
  is_published: boolean;
  generated_content: GeneratedContent | null;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  ai_prompt: '',
  youtube_url: '',
  spotify_url: '',
  image_url: '',
  file_url: '',
  level: 'all',
  num_questions: 5,
  is_published: false,
  generated_content: null,
};

export function ModulesSection() {

  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const queryClient = useQueryClient();
  const { data: rawModules = [], isLoading } = useQuery<any>({
    queryKey: ['admin-modules'],
    queryFn: () => apiGet<any>('/activities/modules/admin/all'),
  });

  const modules = Array.isArray(rawModules)
    ? rawModules
    : (rawModules as any)?.modules || (rawModules as any)?.data || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleRow | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploadingFile(true);
    const toastId = toast.loading('Uploading file...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiUpload<{ url: string }>('/activities/modules/admin/upload', form);
      if (res.ok && res.data.url) {
        setFormData(prev => ({ ...prev, file_url: res.data.url }));
        toast.success('File uploaded!', { id: toastId });
      } else {
        toast.error('Error uploading file.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading file.', { id: toastId });
    } finally {
      setIsUploadingFile(false);
    }
  };
  const filteredModules = (modules as ModuleRow[]).filter((m: ModuleRow) => {
    if (filter === 'published') return m.is_published;
    if (filter === 'draft') return !m.is_published;
    return true;
  });

  const invalidateModules = () => queryClient.invalidateQueries({ queryKey: ['admin-modules'] });

  const handleTogglePublish = async (id: string, current: boolean) => {
    try {
      const mod = (modules as ModuleRow[]).find((m: ModuleRow) => m.id === id);
      await apiPut(`/activities/modules/admin/${id}`, { ...mod, is_published: !current });
      toast.success(current ? 'Module unpublished' : 'Module published!');
      invalidateModules();
    } catch {
      toast.error('Error updating status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this module?')) return;

    const toastId = toast.loading('Deleting...');
    try {
      const res = await apiDelete(`/activities/modules/admin/${id}`);
      if (res.ok) {
        toast.success('Module deleted.', { id: toastId });
        invalidateModules();
      } else {
        toast.error('Error deleting module.', { id: toastId });
      }
    } catch {
      toast.error('Error deleting.', { id: toastId });
    }
  };

  const openModal = async (mod?: ModuleRow) => {
    if (mod) {
      setEditingModule(mod);
      try {
        const details = await apiGet<any>(`/activities/modules/${mod.id}`);
        setFormData({
          title: details.title ?? mod.title,
          description: details.description ?? '',
          ai_prompt: details.ai_prompt ?? '',
          youtube_url: details.youtube_url ?? '',
          spotify_url: details.spotify_url ?? '',
          image_url: details.image_url ?? '',
          file_url: details.file_url ?? '',
          level: details.level ?? mod.level ?? 'all',
          num_questions: (details.quizzes?.[0]?.questions?.length) || 5,
          is_published: details.is_published ?? mod.is_published ?? false,
          generated_content: details.quizzes?.[0] ? {
            quiz_title: details.quizzes[0].title,
            questions: details.quizzes[0].questions
          } : null
        });
      } catch (err) {
        console.error('[ModulesSection] Error loading module details:', err);
        setFormData({
          title: mod.title,
          description: mod.description ?? '',
          ai_prompt: mod.ai_prompt ?? '',
          youtube_url: mod.youtube_url ?? '',
          spotify_url: mod.spotify_url ?? '',
          image_url: mod.image_url ?? '',
          file_url: mod.file_url ?? '',
          level: mod.level ?? 'all',
          num_questions: 5,
          is_published: mod.is_published ?? false,
          generated_content: null
        });
      }
    } else {
      setEditingModule(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };
  const handleGenerateWithAI = async () => {
    if (!formData.ai_prompt.trim()) {
      toast.error('Informe um prompt para gerar com IA.');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiPost<{ success: boolean; task_id?: string }>(ENDPOINTS.ADMIN_MODULE_GENERATE_QUIZ, {
        title: formData.title || 'New Module',
        description: formData.description || formData.ai_prompt,
        level: formData.level,
        content_titles: formData.ai_prompt,
        num_questions: formData.num_questions,
        preview_mode: true
      });

      if (res.ok && res.data.success && res.data.task_id) {
        const taskId = res.data.task_id;
        toast.loading('Generating quiz with AI...', { id: taskId });
        
        // Poll status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await apiGet<{status: string; result?: any; error?: string}>(`/tasks/status/${taskId}`);
            if (statusRes) {
              if (statusRes.status === 'success') {
                clearInterval(pollInterval);
                setIsGenerating(false);
                toast.success('Quiz generated successfully!', { id: taskId });
                
                const raw = statusRes.result;
                if (raw) {
                  const normalized: GeneratedContent = {
                    quiz_title: raw.quiz_title || raw.title || formData.title,
                    questions: (raw.questions || []).map((q: any) => ({
                      question: q.question,
                      options: q.options || [],
                      correct_index: typeof q.correct_index === 'number' ? q.correct_index : 0,
                      explanation: q.explanation || '',
                    }))
                  };
                  setFormData(prev => ({ ...prev, generated_content: normalized }));
                  setIsReviewOpen(true);
                }
              } else if (statusRes.status === 'failed') {
                clearInterval(pollInterval);
                setIsGenerating(false);
                toast.error(`Failed to generate: ${statusRes.error || 'Unknown error'}`, { id: taskId });
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
        toast.error('Error generating with AI.');
      }
    } catch {
      setIsGenerating(false);
      toast.error('Connection error with AI.');
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Use data URL as image_url (works without external storage)
        setFormData(prev => ({ ...prev, image_url: reader.result as string }));
        toast.success('Image loaded!');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Error loading image.');
      setIsUploadingImage(false);
    }
  };


  const handleSaveWithReview = async () => {
    if (!formData.generated_content) return;
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        quiz: {
          title: formData.generated_content.quiz_title,
          questions: formData.generated_content.questions
        }
      };

      const res = editingModule
        ? await apiPut(`/activities/modules/admin/${editingModule.id}`, payload)
        : await apiPost('/activities/modules/admin', payload);

      if (res.ok) {
        toast.success('Module saved successfully!');
        invalidateModules();
        setIsReviewOpen(false);
        setIsModalOpen(false);
      } else {
        toast.error('Error saving module.');
      }
    } catch (err) {
      console.error('[ModulesSection] Error saving module:', err);
      toast.error('Error connecting to the server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Inform a module title.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        ...(formData.generated_content ? {
          quiz: {
            title: formData.generated_content.quiz_title,
            questions: formData.generated_content.questions
          }
        } : {})
      };

      const res = editingModule
        ? await apiPut(`/activities/modules/admin/${editingModule.id}`, payload)
        : await apiPost('/activities/modules/admin', payload);

      if (res.ok) {
        toast.success(editingModule ? 'Module updated successfully!' : 'Module created successfully!');
        invalidateModules();
        setIsModalOpen(false);
      } else {
        toast.error('Erro ao salvar.');
      }
    } catch (err) {
      console.error('[ModulesSection] Error saving module:', err);
      toast.error('Error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const updateQuestion = (idx: number, field: keyof QuizQuestion, value: any) => {
    if (!formData.generated_content) return;
    const newQuestions = [...formData.generated_content.questions];
    newQuestions[idx] = { ...newQuestions[idx], [field]: value };
    setFormData(prev => ({
      ...prev,
      generated_content: { ...prev.generated_content!, questions: newQuestions }
    }));
  };

  const addManualQuestion = () => {
    setFormData(prev => {
      const current = prev.generated_content || { quiz_title: prev.title || 'Quiz', questions: [] };
      return {
        ...prev,
        generated_content: {
          ...current,
          questions: [
            ...current.questions,
            { question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }
          ]
        }
      };
    });
  };

  const removeQuestion = (idx: number) => {
    if (!formData.generated_content) return;
    const newQuestions = formData.generated_content.questions.filter((_, i) => i !== idx);
    setFormData(prev => ({
      ...prev,
      generated_content: { ...prev.generated_content!, questions: newQuestions }
    }));
  };

  const getYoutubeEmbedId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const getSpotifyEmbedUrl = (url: string) => {
    return url.replace('open.spotify.com/', 'open.spotify.com/embed/').replace(/\/si=.*$/, '');
  };

  if (isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-surface border border-border p-1 rounded-xl w-fit">
          {(['all', 'pub', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f === 'pub' ? 'published' : f === 'all' ? 'all' : 'draft')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                (filter === 'published' && f === 'pub') || (filter === f)
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              )}
            >
              {{
                all: 'All',
                pub: 'Published',
                draft: 'Drafts'
              }[f] || f}
            </button>
          ))}
        </div>
        <Button className="gap-2" onClick={() => openModal()}>
          <Plus size={18} />
          <span>{'New Module'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.length > 0 ? filteredModules.map((m: ModuleRow) => (
          <div key={m.id} className="bg-surface border border-border p-5 rounded-2xl flex flex-col gap-4 group hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                <BookOpen size={20} />
              </div>
              <div className="flex gap-1.5">
                {m.level && m.level !== 'all' && (
                  <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full border bg-bg-secondary text-text-subtle uppercase tracking-wider">
                    {m.level}
                  </span>
                )}
                <span className={cn("text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  m.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                )}>
                  {m.is_published ? 'Published' : 'Drafts'}
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-text truncate mb-1">{m.title}</h3>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8 mb-2">
                {m.description || 'No description provided.'}
              </p>
              {m.quizzes && m.quizzes.length > 0 && (
                <div className="flex items-center gap-1.5 text-[0.65rem] text-primary font-bold bg-primary/10 w-fit px-2 py-0.5 rounded-md border border-primary/20">
                  <HelpCircle size={12} />
                  <span>{m.quizzes[0].title || 'Quiz'}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-auto pt-2">
              <button onClick={() => openModal(m)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle">
                <PenLine size={16} />
              </button>
              <button onClick={() => handleTogglePublish(m.id, m.is_published)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle">
                {m.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => handleDelete(m.id)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl bg-surface/30">
            <BookOpen size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-text-muted font-medium">No modules found.</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingModule ? 'Edit Module' : 'New Module'}
      >
        <div className="space-y-3">
          <Input label="Module title" value={formData.title} onChange={set('title')} />

          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              className="w-full min-h-[80px] px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all resize-none"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Module description..."
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Cover Image</label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                placeholder="Paste image URL or upload file..."
                value={formData.image_url.startsWith('data:') ? '' : formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
              />
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploadingImage}
                className="px-3 py-2 bg-surface border border-border rounded-md hover:border-primary/50 transition-all text-text-muted hover:text-primary"
              >
                <ImagePlus size={18} />
              </button>
            </div>
            {formData.image_url && (
              <div className="relative mt-2 inline-block">
                <img src={formData.image_url} alt="Preview" className="h-20 rounded-xl object-cover border border-border" />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                  className="absolute -top-2 -right-2 bg-danger text-white p-1 rounded-full shadow-sm hover:bg-danger-dark"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}          </div>

          {/* YouTube URL */}
          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Youtube size={13} className="text-red-500" /> YouTube Video (optional)
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                placeholder="https://youtube.com/watch?v=..."
                value={formData.youtube_url}
                onChange={(e) => setFormData(prev => ({ ...prev, youtube_url: e.target.value }))}
              />
              {formData.youtube_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, youtube_url: '' }))}
                  className="px-3 py-2 bg-danger/10 text-danger border border-danger/20 rounded-md hover:bg-danger/20 transition-all"
                  title="Remove link"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {formData.youtube_url && getYoutubeEmbedId(formData.youtube_url) && (
              <div className="mt-2 rounded-xl overflow-hidden border border-border aspect-video">
                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYoutubeEmbedId(formData.youtube_url)}`} allowFullScreen />
              </div>
            )}
          </div>

          {/* Spotify URL */}
          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Music size={13} className="text-green-500" /> Spotify (optional)
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                placeholder="https://open.spotify.com/track/..."
                value={formData.spotify_url}
                onChange={(e) => setFormData(prev => ({ ...prev, spotify_url: e.target.value }))}
              />
              {formData.spotify_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, spotify_url: '' }))}
                  className="px-3 py-2 bg-danger/10 text-danger border border-danger/20 rounded-md hover:bg-danger/20 transition-all"
                  title="Remove link"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {formData.spotify_url && (
              <iframe
                className="mt-2 rounded-xl border border-border"
                src={getSpotifyEmbedUrl(formData.spotify_url)}
                width="100%" height="80"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              />
            )}
          </div>
          {/* File Upload */}
          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Document (PDF, Docx, PPTX, etc)</label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                placeholder="File URL..."
                value={formData.file_url}
                onChange={(e) => setFormData(prev => ({ ...prev, file_url: e.target.value }))}
              />
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile}
                className="px-3 py-2 bg-surface border border-border rounded-md hover:border-primary/50 transition-all text-text-muted hover:text-primary"
              >
                <UploadCloud size={18} />
              </button>
            </div>
            {formData.file_url && (
              <div className="mt-2 flex items-center justify-between gap-2 p-3 bg-surface rounded-xl border border-border">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={20} className="text-primary shrink-0" />
                  <a href={formData.file_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline truncate">View uploaded document</a>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, file_url: '' }))}
                  className="text-danger hover:text-danger-dark p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}          </div>

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

            <div className="mb-4">
              <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Status</label>
              <select
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                value={formData.is_published ? 'true' : 'false'}
                onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.value === 'true' }))}
              >
                <option value="false">Drafts</option>
                <option value="true">Published</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-primary flex-1 flex items-center gap-2">
                <HelpCircle size={16} /> Quiz Questions
              </h4>
              <Button variant="secondary" size="sm" onClick={addManualQuestion} className="h-8 gap-1.5 text-[0.7rem]">
                <Plus size={14} /> Add Question
              </Button>
            </div>

            {formData.generated_content && formData.generated_content.questions.length > 0 ? (
               <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {formData.generated_content.questions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 bg-surface border border-border rounded-xl space-y-3 relative group">
                      <button 
                        onClick={() => removeQuestion(qIdx)}
                        className="absolute top-2 right-2 p-1 text-text-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                      
                      <div className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[0.65rem] shrink-0 mt-2">
                          {qIdx + 1}
                        </span>
                        <input 
                          className="flex-1 bg-transparent border-b border-border text-sm py-1 outline-none focus:border-primary transition-all"
                          placeholder="Question text..."
                          value={q.question}
                          onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pl-7">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="relative">
                            <input 
                              className={cn(
                                "w-full pl-2 pr-6 py-1.5 bg-bg/50 border rounded-lg text-xs outline-none transition-all",
                                q.correct_index === oIdx ? "border-success bg-success/5" : "border-border"
                              )}
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                newOpts[oIdx] = e.target.value;
                                updateQuestion(qIdx, 'options', newOpts);
                              }}
                            />
                            <button 
                              onClick={() => updateQuestion(qIdx, 'correct_index', oIdx)}
                              className={cn("absolute right-1.5 top-1/2 -translate-y-1/2", q.correct_index === oIdx ? "text-success" : "text-text-subtle")}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
            ) : (
              <p className="text-[0.65rem] text-text-muted italic text-center py-2">No manual questions added yet.</p>
            )}

            <div className="border-t border-primary/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <Sparkles size={16} /> AI Generation
                </h4>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-16 h-8 text-xs"
                    label='Count'
                    type="number"
                    value={String(formData.num_questions)}
                    onChange={set('num_questions')}
                  />
                </div>
              </div>
              <textarea
                placeholder="E.g.: Create a quiz about verbs..."
                className="w-full min-h-[60px] p-3.5 bg-surface border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all resize-none mb-3"
                value={formData.ai_prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, ai_prompt: e.target.value }))}
              ></textarea>
        <div className="flex gap-2 w-full">
          <Button
            variant="secondary"
            className="flex-1 gap-2 h-9 text-xs"
            onClick={handleGenerateWithAI}
            loading={isGenerating}
            disabled={!formData.ai_prompt.trim()}
          >
            <Sparkles size={14} />
            AI Quiz
          </Button>
        </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={isSaving}>Save</Button>
          </div>
        </div>
      </DialogModal>

      {/* MODAL DE REVISÃO DA IA */}
      <DialogModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        title="AI Content Review"
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center gap-3">
            <CheckCircle2 className="text-success" size={24} />
            <div>
              <p className="text-sm font-bold">Content ready for review</p>
              <p className="text-xs text-text-muted">The AI has already marked the correct answers (green). Edit if needed, then save.</p>
            </div>
          </div>

          {formData.generated_content && (
            <div className="space-y-8">
              <Input
                label="Quiz Title"
                value={formData.generated_content.quiz_title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  generated_content: { ...prev.generated_content!, quiz_title: e.target.value }
                }))}
              />

              <div className="space-y-6">
                <h4 className="font-bold flex items-center gap-2 border-b border-border pb-2">
                  <HelpCircle size={18} className="text-primary" />
                  Questions ({formData.generated_content.questions.length})
                </h4>

                {formData.generated_content.questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-5 bg-surface border border-border rounded-2xl space-y-4 relative">
                    <span className="absolute -top-3 -left-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shadow-md">
                      {qIdx + 1}
                    </span>

                    <Input
                      label="Question"
                      value={q.question}
                      onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correct_index;
                        return (
                          <div key={oIdx} className="relative">
                            <input
                              className={cn(
                                "w-full pl-3 pr-10 py-2.5 bg-bg border rounded-lg text-sm outline-none transition-all",
                                isCorrect ? "border-success bg-success/5 ring-1 ring-success/20 font-medium" : "border-border focus:border-primary/50"
                              )}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                newOpts[oIdx] = e.target.value;
                                updateQuestion(qIdx, 'options', newOpts);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => updateQuestion(qIdx, 'correct_index', oIdx)}
                              title="Mark as correct answer"
                              className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all",
                                isCorrect ? "text-success" : "text-text-subtle hover:text-primary"
                              )}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <textarea
                      placeholder="Explanation (English)..."
                      className="w-full min-h-[80px] p-3.5 bg-bg border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all resize-none"
                      value={q.explanation || ''}
                      onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsReviewOpen(false)}>{'Cancel'}</Button>
          <Button onClick={handleSaveWithReview} loading={isSaving} className="gap-2">
            <Sparkles size={16} />
            {'Save'}
          </Button>
        </div>
      </DialogModal>
    </div>
  );
}
