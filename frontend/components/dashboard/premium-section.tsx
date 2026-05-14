'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  PenLine,
  Eye,
  EyeOff,
  Trash2,
  Zap,
  FileText,
  Link as LinkIcon,
  Video,
  FileDigit,
  UploadCloud,
  CheckCircle2,
  DollarSign,
  SmilePlus
} from 'lucide-react';

import { apiGet, apiPut, apiDelete, apiPost, apiUpload } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogModal } from '@/components/ui/dialog-modal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface PremiumContent {
  id: string;
  title: string;
  description: string;
  price: number;
  type: 'pdf' | 'link' | 'article' | 'video';
  content_source: string;
  thumbnail_url?: string;
  emoji?: string;
  is_active: boolean;
  created_at?: string;
}

const EMPTY_FORM: Partial<PremiumContent> = {
  title: '',
  description: '',
  price: 0,
  type: 'pdf',
  content_source: '',
  thumbnail_url: '',
  emoji: '✨',
  is_active: true
};

export function PremiumSection() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingContent, setEditingContent] = useState<PremiumContent | null>(null);
  const [formData, setFormData] = useState<Partial<PremiumContent>>(EMPTY_FORM);

  const { data: contents = [], isLoading } = useQuery<PremiumContent[]>({
    queryKey: ['admin-premium-contents'],
    queryFn: () => apiGet<PremiumContent[]>(ENDPOINTS.ADMIN_PREMIUM),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-premium-contents'] });

  const openModal = (item?: PremiumContent) => {
    if (item) {
      setEditingContent(item);
      setFormData({ ...item });
    } else {
      setEditingContent(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const toastId = toast.loading('Uploading material...');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiUpload<{ file_path: string }>(ENDPOINTS.ADMIN_PREMIUM_UPLOAD, form);
      if (res.ok && res.data.file_path) {
        setFormData(prev => ({ ...prev, content_source: res.data.file_path }));
        toast.success('File uploaded!', { id: toastId });
      } else {
        toast.error('Error uploading file.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error uploading file.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) return toast.error('Title is required');
    if (!formData.content_source?.trim()) return toast.error('Content source/file is required');

    setIsSaving(true);
    try {
      const res = editingContent
        ? await apiPut(`${ENDPOINTS.ADMIN_PREMIUM}/${editingContent.id}`, formData)
        : await apiPost(ENDPOINTS.ADMIN_PREMIUM, formData);

      if (res.ok) {
        toast.success(editingContent ? 'Content updated!' : 'Content created!');
        invalidate();
        setIsModalOpen(false);
      } else {
        toast.error('Error saving content.');
      }
    } catch (err) {
      toast.error('Server error.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this content permanently?')) return;
    try {
      const res = await apiDelete(`${ENDPOINTS.ADMIN_PREMIUM}/${id}`);
      if (res.ok) {
        toast.success('Deleted.');
        invalidate();
      }
    } catch {
      toast.error('Error deleting.');
    }
  };

  const handleToggleActive = async (item: PremiumContent) => {
    try {
      await apiPut(`${ENDPOINTS.ADMIN_PREMIUM}/${item.id}`, { ...item, is_active: !item.is_active });
      invalidate();
    } catch {
      toast.error('Error toggling status.');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={20} />;
      case 'link': return <LinkIcon size={20} />;
      case 'video': return <Video size={20} />;
      default: return <FileDigit size={20} />;
    }
  };

  if (isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-text flex items-center gap-2">
          <Zap className="text-primary" /> Premium Hub Management
        </h2>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus size={18} /> New Premium Material
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contents.map((item) => (
          <div key={item.id} className="bg-surface border border-border p-5 rounded-2xl flex flex-col gap-4 group hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                  {getIcon(item.type)}
                </div>
                <div className="text-2xl">{item.emoji}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  item.is_active ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                )}>
                  {item.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs font-bold text-primary">
                  {item.price === 0 ? 'FREE' : `R$ ${item.price}`}
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-text truncate mb-1">{item.title}</h3>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-auto pt-2 border-t border-border">
              <button onClick={() => openModal(item)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle group/edit" title="Edit content">
                <PenLine size={16} />
              </button>
              <button onClick={() => handleToggleActive(item)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-warning/10 hover:text-warning transition-all text-text-subtle group/toggle" title={item.is_active ? 'Inactivate content' : 'Activate content'}>
                {item.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => handleDelete(item.id)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle group/delete" title="Delete content permanently">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingContent ? 'Edit Material' : 'New Premium Material'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input label="Title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div>
              <Input label="Theme Emoji" value={formData.emoji} placeholder="🚀" onChange={(e) => setFormData(prev => ({ ...prev, emoji: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              className="w-full min-h-[80px] px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all resize-none"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What is this material about?..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Type</label>
              <select
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              >
                <option value="pdf">PDF Document</option>
                <option value="link">External Link</option>
                <option value="article">Article/Text</option>
                <option value="video">Video URL</option>
              </select>
            </div>
            <div>
              <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <DollarSign size={12} /> Price (BRL)
              </label>
              <Input type="number" step="0.01" value={String(formData.price)} onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div>
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              {formData.type === 'link' || formData.type === 'video' ? 'URL Link' : 'File / Content Source'}
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
                placeholder={formData.type === 'link' ? "https://notebooklm.google.com/..." : "File path or URL..."}
                value={formData.content_source}
                onChange={(e) => setFormData(prev => ({ ...prev, content_source: e.target.value }))}
              />
              {formData.type !== 'link' && formData.type !== 'video' && (
                <>
                  <input ref={fileInputRef} type="file" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-2 bg-surface border border-border rounded-md hover:border-primary/50 transition-all text-text-muted hover:text-primary"
                  >
                    <UploadCloud size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={isSaving}>Save Material</Button>
          </div>
        </div>
      </DialogModal>
    </div>
  );
}
