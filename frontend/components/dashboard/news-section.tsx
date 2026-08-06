'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  PenLine,
  Eye,
  EyeOff,
  Newspaper,
  ExternalLink,
  ImageOff,
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

interface NewsRow {
  id: string;
  title: string;
  url: string;
  description: string;
  levels: string[];
  thumbnail_url: string | null;
  is_published: boolean;
  created_at: string;
}

interface FormState {
  title: string;
  description: string;
  url: string;
  levels: string[];
  is_published: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  url: '',
  levels: ['all'],
  is_published: true,
};

export default function NewsSection() {
  const queryClient = useQueryClient();
  const { data: rawNews = [], isLoading } = useQuery({
    queryKey: ['admin-news'],
    queryFn: () => apiGet(ENDPOINTS.ADMIN_NEWS),
    refetchInterval: 30_000,
  });

  const news: NewsRow[] = Array.isArray(rawNews)
    ? rawNews
    : (rawNews as any)?.data || [];

  const invalidateNews = () => queryClient.invalidateQueries({ queryKey: ['admin-news'] });

  const [filterLevel, setFilterLevel] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsRow | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const filteredNews = news.filter((n) => {
    if (filterLevel === 'all') return true;
    const nLevels = (n.levels || []).map((l) => l.toUpperCase());
    return nLevels.includes('ALL') || nLevels.includes(filterLevel.toUpperCase());
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this news item?')) return;
    const toastId = toast.loading('Deleting...');
    try {
      await apiDelete(`${ENDPOINTS.ADMIN_NEWS}/${id}`);
      toast.success('News deleted.', { id: toastId });
      invalidateNews();
    } catch {
      toast.error('Error deleting.', { id: toastId });
    }
  };

  const handleTogglePublish = async (id: string, current: boolean) => {
    try {
      await apiPut(`${ENDPOINTS.ADMIN_NEWS}/${id}`, { is_published: !current });
      toast.success(current ? 'News returned to drafts' : 'News published!');
      invalidateNews();
    } catch {
      toast.error('Error updating status.');
    }
  };

  const openModal = (item?: NewsRow) => {
    if (item) {
      setEditingNews(item);
      setFormData({
        title: item.title || '',
        description: item.description || '',
        url: item.url || '',
        levels: item.levels || ['all'],
        is_published: item.is_published,
      });
    } else {
      setEditingNews(null);
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
    const url = formData.url || '';
    if (!url.trim()) {
      toast.error('Please provide the news URL.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: (formData.title || '').trim(),
        description: (formData.description || '').trim(),
        url: url.trim(),
        levels: formData.levels,
        is_published: formData.is_published,
      };

      const res = editingNews
        ? await apiPut(`${ENDPOINTS.ADMIN_NEWS}/${editingNews.id}`, payload)
        : await apiPost(ENDPOINTS.ADMIN_NEWS, payload);

      if (res.ok) {
        toast.success(editingNews ? 'News updated!' : 'News created!');
        await invalidateNews();
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
            <Newspaper size={22} className="text-primary" />
            News
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
          Create News
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.length > 0 ? filteredNews.map((n) => (
          <div key={n.id} className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col group hover:border-primary/40 transition-all">
            <div className="h-32 bg-bg-secondary relative overflow-hidden">
              {n.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={n.thumbnail_url}
                  alt={n.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/40">
                  <Newspaper size={36} />
                </div>
              )}
              <span className={cn(
                'absolute top-2 right-2 text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shadow backdrop-blur-sm',
                n.is_published ? 'bg-success/90 text-white border-success' : 'bg-warning/90 text-white border-warning'
              )}>
                {n.is_published ? 'Published' : 'Draft'}
              </span>
            </div>

            <div className="p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-text truncate flex-1">{n.title}</h4>
                <div className="flex flex-wrap gap-1 justify-end shrink-0">
                  {(n.levels || ['all']).map((l) => (
                    <span key={l} className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border uppercase tracking-widest text-text-subtle">
                      {l === 'all' || l === 'ALL' ? 'All' : l.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
              {n.description && (
                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{n.description}</p>
              )}
            </div>

            <div className="px-5 pb-5 flex items-center gap-2 mt-auto">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all text-xs font-bold border border-primary/20"
                title="Open link"
              >
                <ExternalLink size={14} /> Open
              </a>
              <button onClick={() => openModal(n)} className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                <PenLine size={14} />
              </button>
              <button
                onClick={() => handleTogglePublish(n.id, !!n.is_published)}
                className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border"
                title={n.is_published ? 'Unpublish (Draft)' : 'Publish'}
              >
                {n.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={() => handleDelete(n.id)}
                className="p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl bg-surface/30">
            <Newspaper size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-text-muted font-medium">No news created yet.</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingNews ? 'Edit News' : 'Create News'}
      >
        <div className="space-y-4">
          <Input
            label="News URL"
            value={formData.url}
            onChange={setField('url')}
            placeholder="https://www.instagram.com/reels/... or https://news-site.com/..."
          />
          <div className="space-y-1.5">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Title</label>
            <Input
              value={formData.title}
              onChange={setField('title')}
              placeholder="Leave empty to fetch automatically from the link"
            />
            <p className="text-[0.65rem] text-text-muted italic">
              Optional — if empty, the backend gets the title (and thumbnail) from the link automatically.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              placeholder="Optional short description"
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
              Select which levels can see this news. If none selected, it shows for all.
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