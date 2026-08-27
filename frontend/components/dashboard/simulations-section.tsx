'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  PenLine,
  Play,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  Clapperboard,
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
import { useRouter } from 'next/navigation';
import { LEVEL_OPTIONS, LEVEL_FILTER_OPTIONS, normalizeLevel, levelLabel } from '@/lib/constants/levels';

interface SimulationRow {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  levels?: string[];
  is_published: boolean;
  system_prompt?: string;
  emoji?: string;
}

interface FormState {
  name: string;
  description: string;
  difficulty: string;
  levels: string[];
  system_prompt: string;
  emoji: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  difficulty: 'all',
  levels: [],
  system_prompt: '',
  emoji: '🎭',
};

export default function SimulationsSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: rawSimulations = [], isLoading } = useQuery({
    queryKey: ['admin-simulations'],
    queryFn: () => apiGet(ENDPOINTS.ADMIN_SIMULATIONS),
  });

  const simulations = Array.isArray(rawSimulations)
    ? rawSimulations
    : (rawSimulations as any)?.simulations || (rawSimulations as any)?.data || [];

  const invalidateSimulations = () => queryClient.invalidateQueries({ queryKey: ['admin-simulations'] });

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

  const [filterLevel, setFilterLevel] = useState('all');
  const [selectedSimIds, setSelectedSimIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSim, setEditingSim] = useState<SimulationRow | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredSimulations = simulations.filter((s: any) => {
    if (filterLevel === 'all') return true;
    const simLevels = s.levels || (s.difficulty && s.difficulty !== 'all' && s.difficulty !== 'todos' ? [s.difficulty] : []);
    if (Array.isArray(simLevels) && simLevels.length > 0) {
      return simLevels.some((l: string) => normalizeLevel(l) === normalizeLevel(filterLevel));
    }
    const simDiff = normalizeLevel(s.difficulty);
    const targetDiff = normalizeLevel(filterLevel);
    
    return simDiff === targetDiff || s.difficulty === 'all' || s.difficulty === 'todos';
  });

  const handleSelectAll = () => {
    if (selectedSimIds.length === filteredSimulations.length) {
      setSelectedSimIds([]);
    } else {
      setSelectedSimIds(filteredSimulations.map((s: any) => s.id));
    }
  };

  const toggleSelectSim = (id: string) => {
    setSelectedSimIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedSimIds.length === 0) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading(publish ? 'Publishing selected simulations...' : 'Moving selected simulations to drafts...');
    try {
      await Promise.all(
        selectedSimIds.map((id) => apiPut(`${ENDPOINTS.ADMIN_SIMULATIONS}/${id}`, { is_published: publish, is_active: publish }))
      );
      toast.success(publish ? `${selectedSimIds.length} simulation(s) published!` : `${selectedSimIds.length} simulation(s) moved to drafts!`, { id: toastId });
      setSelectedSimIds([]);
      invalidateSimulations();
    } catch {
      toast.error('Error updating selected simulations.', { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSimIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedSimIds.length} selected simulation(s)?`)) return;
    setIsBulkProcessing(true);
    const toastId = toast.loading('Deleting selected simulations...');
    try {
      await Promise.all(
        selectedSimIds.map((id) => apiDelete(`${ENDPOINTS.ADMIN_SIMULATIONS}/${id}`))
      );
      toast.success(`${selectedSimIds.length} simulation(s) deleted!`, { id: toastId });
      setSelectedSimIds([]);
      invalidateSimulations();
    } catch {
      toast.error('Error deleting selected simulations.', { id: toastId });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this simulation?')) return;
    const toastId = toast.loading('Deleting...');
    try {
      await apiDelete(`${ENDPOINTS.ADMIN_SIMULATIONS}/${id}`);
      toast.success('Simulation deleted.', { id: toastId });
      invalidateSimulations();
    } catch {
      toast.error('Error deleting.', { id: toastId });
    }
  };

  const handleTogglePublish = async (id: string, current: boolean) => {
    try {
      await apiPut(`${ENDPOINTS.ADMIN_SIMULATIONS}/${id}`, { is_published: !current, is_active: !current });
      toast.success(current ? 'Simulation returned to drafts' : 'Simulation published!');
      invalidateSimulations();
    } catch {
      toast.error('Error updating status.');
    }
  };

  const openModal = (sim?: SimulationRow) => {
    if (sim) {
      setEditingSim(sim);
      const simLevels = sim.levels || (sim.difficulty && sim.difficulty !== 'all' ? [sim.difficulty] : []);
      setFormData({
        name: sim.name || '',
        description: sim.description || '',
        difficulty: sim.difficulty || 'all',
        levels: Array.isArray(simLevels) ? simLevels : [],
        system_prompt: sim.system_prompt || '',
        emoji: sim.emoji || '🎭',
      });
    } else {
      setEditingSim(null);
      setFormData(EMPTY_FORM);
    }
    setIsModalOpen(true);
  };

  const handleGenerateWithAI = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter at least a topic name to generate.');
      return;
    }
    setIsGenerating(true);
    const toastId = toast.loading('Teacher Tati AI is crafting this simulation...');
    try {
      const res = await apiPost<{ task_id?: string; detail?: string; simulation_id?: string }>(
        ENDPOINTS.ADMIN_SIMULATIONS,
        {
          name: formData.name,
          description: formData.description,
          difficulty: formData.difficulty,
          levels: formData.levels,
          use_ai_generation: true,
          is_ai_generated: true,
        }
      );

      if (res.ok) {
        toast.dismiss(toastId);
        toast.success('Simulation generated successfully!');
        setIsGenerating(false);
        await invalidateSimulations();
        setIsModalOpen(false);
      } else {
        setIsGenerating(false);
        toast.error('Error generating with AI.', { id: toastId });
      }
    } catch {
      setIsGenerating(false);
      toast.error('Connection error with AI.', { id: toastId });
    }
  };

  const handleSave = async () => {
    const name = formData.name || '';
    if (!name.trim()) {
      toast.error('Please provide a name for the simulation.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: (formData.description || '').trim(),
        levels: formData.levels,
        system_prompt: formData.system_prompt,
        emoji: formData.emoji,
      };

      const res = editingSim
        ? await apiPut(`${ENDPOINTS.ADMIN_SIMULATIONS}/${editingSim.id}`, payload)
        : await apiPost(ENDPOINTS.ADMIN_SIMULATIONS, payload);

      if (res.ok) {
        toast.success(editingSim ? 'Simulation updated!' : 'Simulation created!');
        await invalidateSimulations();
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

  const handleStartSimulation = async (s: SimulationRow) => {
    const toastId = toast.loading('Starting simulation...');
    try {
      const res = await apiPost(ENDPOINTS.CONVERSATIONS, {
        title: 'Simulation: ' + s.name,
        is_simulation: true,
        simulation_id: s.id,
      });
      if (res.ok && (res.data as any)?.id) {
        toast.dismiss(toastId);
        router.push(`/voice?conv_id=${(res.data as any).id}&simulation_id=${s.id}`);
      } else {
        toast.error('Error starting.', { id: toastId });
      }
    } catch (err) {
      toast.error('Connection error.', { id: toastId });
    }
  };

  const setField = (field: keyof FormState) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
            <Clapperboard size={22} className="text-primary" />
            Simulations
          </h3>
          <select
            className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-primary/50 transition-all"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            {LEVEL_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {filteredSimulations.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all px-2.5 py-1 rounded-lg border border-border bg-surface"
            >
              {selectedSimIds.length === filteredSimulations.length ? (
                <CheckSquare size={15} className="text-primary" />
              ) : (
                <Square size={15} />
              )}
              <span>
                {selectedSimIds.length === filteredSimulations.length ? 'Deselect All' : `Select All (${filteredSimulations.length})`}
              </span>
            </button>
          )}
        </div>
        <Button className="gap-2" onClick={() => openModal()}>
          <Plus size={18} />
          Create Simulation
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedSimIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedSimIds.length} selected
            </span>
            <span className="text-xs text-text-muted">of {filteredSimulations.length} visible simulations</span>
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
              onClick={() => setSelectedSimIds([])}
              className="px-2.5 py-1.5 text-xs text-text-muted hover:text-text font-bold transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSimulations.length > 0 ? (
          filteredSimulations.map((s: any) => {
            const isSelected = selectedSimIds.includes(s.id);
            return (
              <div
                key={s.id}
                className={cn(
                  "bg-surface border p-5 rounded-2xl flex flex-col gap-4 group transition-all relative",
                  isSelected ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelectSim(s.id)}
                      className="text-text-muted hover:text-primary transition-all p-0.5"
                      title={isSelected ? "Deselect" : "Select"}
                    >
                      {isSelected ? <CheckSquare size={17} className="text-primary" /> : <Square size={17} />}
                    </button>
                    <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary font-black uppercase text-xs">
                      {(() => {
                        const simLevels = s.levels || (s.difficulty && s.difficulty !== 'all' && s.difficulty !== 'todos' ? [s.difficulty] : []);
                        if (Array.isArray(simLevels) && simLevels.length > 0) {
                          return simLevels[0]?.[0] || 'B';
                        }
                        return s.difficulty === 'all' || s.difficulty === 'todos' ? 'A' : (s.difficulty?.[0] || 'B');
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn(
                      "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                      s.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                    )}>
                      {s.is_published ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border uppercase tracking-widest text-text-subtle">
                      {(() => {
                        const simLevels = s.levels || (s.difficulty && s.difficulty !== 'all' && s.difficulty !== 'todos' ? [s.difficulty] : []);
                        if (Array.isArray(simLevels) && simLevels.length > 0) {
                          return simLevels.map((l: string) => levelLabel(l)).join(', ');
                        }
                        return s.difficulty === 'all' || s.difficulty === 'todos' ? 'All Levels' : levelLabel(s.difficulty);
                      })()}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-text mb-1 truncate">{s.name}</h4>
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8">
                    {s.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-auto pt-2">
                  <button
                    onClick={() => handleStartSimulation(s)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all text-xs font-bold border border-primary/20"
                    title="Start simulation"
                  >
                    <Play size={14} /> Play
                  </button>
                  <button onClick={() => openModal(s)} className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                    <PenLine size={14} />
                  </button>
                  <button
                    onClick={() => handleTogglePublish(s.id, !!s.is_published)}
                    className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border"
                    title={s.is_published ? 'Unpublish (Draft)' : 'Publish'}
                  >
                    {s.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
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
            <Clapperboard size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-text-muted font-medium">No simulations created yet.</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSim ? 'Edit Simulation' : 'Create Simulation'}
      >
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Topic / Situation"
                value={formData.name}
                onChange={setField('name')}
                placeholder="Ex: Job interview for an international company"
              />
            </div>
            {!editingSim && (
              <Button
                type="button"
                variant="secondary"
                className="gap-2 shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                onClick={handleGenerateWithAI}
                disabled={isGenerating || !formData.name.trim()}
              >
                <Sparkles size={16} />
                {isGenerating ? 'Generating...' : 'Generate with AI'}
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Description (Context for the student)</label>
            <textarea
              placeholder="Ex: You are applying for a Senior Developer position..."
              className="w-full min-h-[80px] p-3 bg-input border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all leading-relaxed"
              value={formData.description}
              onChange={setField('description')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">System Prompt (AI Persona & Instructions)</label>
            <textarea
              placeholder="Ex: You are the interviewer, Mr. Smith. Be formal and ask 3 technical questions..."
              className="w-full min-h-[100px] p-3 bg-input border border-border rounded-xl text-sm font-mono text-xs outline-none focus:border-primary/50 transition-all leading-relaxed"
              value={formData.system_prompt}
              onChange={setField('system_prompt')}
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

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingSim ? 'Save Changes' : 'Create Simulation'}
            </Button>
          </div>
        </div>
      </DialogModal>
    </section>
  );
}
