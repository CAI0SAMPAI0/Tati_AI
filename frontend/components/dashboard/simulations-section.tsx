'use client';

import React, { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  PenLine,
  Play,
  Sparkles,
  RotateCcw,
  Clapperboard
} from 'lucide-react';

import { apiGet, apiDelete, apiPost, apiPut } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogModal } from '@/components/ui/dialog-modal';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface SimulationRow {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  is_published: boolean;
  system_prompt?: string;
  emoji?: string;
}


interface FormState {
  name: string;
  description: string;
  difficulty: string;
  system_prompt: string;
  emoji: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  difficulty: 'all',
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


  const [filterLevel, setFilterLevel] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSim, setEditingSim] = useState<SimulationRow | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredSimulations = simulations.filter((s: any) => {
    if (filterLevel === 'all') return true;
    const simDiff = (s.difficulty || '').toLowerCase();
    const targetDiff = filterLevel.toLowerCase();
    
    // Mostra se o nível for o selecionado OU se for para todos ('all'/'todos')
    return simDiff === targetDiff || simDiff === 'all' || simDiff === 'todos';
  });

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

  const openModal = (sim?: SimulationRow) => {
    if (sim) {
      setEditingSim(sim);
      setFormData({
        name: sim.name || '',
        description: sim.description || '',
        difficulty: (sim.difficulty || 'beginner').toLowerCase(),
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
    if (!formData.system_prompt.trim()) {
      toast.error('Please provide a context or instructions first.');
      return;
    }
    setIsGenerating(true);
    try {
      const payload = {
        topic: formData.name || 'New Simulation',
        level: formData.difficulty,
        instructions: formData.system_prompt,
        use_ai_generation: true
      };

      const res = await apiPost(ENDPOINTS.ADMIN_SIMULATIONS, payload);

      if (res.ok && res.data) {
        toast.success('AI improved the scenario!');

        const updatedSim = res.data as SimulationRow;

        setFormData({
          name: updatedSim.name,
          description: updatedSim.description || '',
          difficulty: updatedSim.difficulty || 'all',
          system_prompt: updatedSim.system_prompt || '',
        });

        await invalidateSimulations();
        if (!editingSim) setEditingSim(updatedSim);
      } else {
        toast.error('Error generating with AI.');
      }
    } catch {
      toast.error('Connection error with AI.');
    } finally {
      setIsGenerating(false);
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
        difficulty: formData.difficulty,
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
        title: "Simulation: " + s.name,
        is_simulation: true,
        simulation_id: s.id
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




        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clapperboard size={22} className="text-primary" />
            Simulations


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
          Create Simulation

        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSimulations.length > 0 ? filteredSimulations.map((s: any) => (
          <div key={s.id} className="bg-surface border border-border p-5 rounded-2xl flex flex-col gap-4 group hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary font-black uppercase text-xs">
                {s.difficulty === 'all' || s.difficulty === 'todos' ? 'A' : (s.difficulty?.[0] || 'B')}
              </div>
              <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border uppercase tracking-widest text-text-subtle">
                {s.difficulty === 'all' || s.difficulty === 'todos' ? 'All Levels' : (s.difficulty || 'Beginner')}
              </span>
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
              >
                <Play size={14} /> Play

              </button>
              <button onClick={() => openModal(s)} className="p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border">
                <PenLine size={14} />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-3xl bg-surface/30">
            <Clapperboard size={40} className="mx-auto mb-4 opacity-20" />

            <p className="text-text-muted font-medium">{'No simulations created yet.'}</p>
          </div>
        )}
      </div>

      <DialogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSim ? 'Edit Simulation' : 'Create Simulation'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <Input
                label={'Simulation Name'}
                value={formData.name}
                onChange={setField('name')}
                placeholder="Ex: Job Interview at Google"
              />
            </div>
            <div>
              <Input
                label={'Emoji'}
                value={formData.emoji}
                onChange={setField('emoji')}
                placeholder="🎭"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Level</label>
            <select
              className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none focus:border-border-focus transition-all"
              value={formData.difficulty}
              onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
            >
              <option value="all">All Levels </option>
              <option value="beginner">Beginner</option>
              <option value="pre-intermediate">Pre-Intermediate</option>
              <option value="intermediate">Intermediate</option>
              <option value="business english">Business English</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <Input
            label={'Description'}
            value={formData.description}
            onChange={setField('description')}
            placeholder="Brief description of the scenario"
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[0.73rem] font-semibold text-text-muted uppercase tracking-wider">System Prompt (IA Instructions)</label>
              <button 
                onClick={handleGenerateWithAI}
                disabled={isGenerating || !formData.system_prompt.trim()}
                className="flex items-center gap-1.5 text-[0.65rem] font-black uppercase text-primary hover:text-primary/80 disabled:opacity-50 transition-all"
              >
                {isGenerating ? <RotateCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isGenerating ? 'Improving...' : 'Improve with IA'}
              </button>
            </div>
            <textarea
              placeholder={'You are Tati, a friendly receptionist at a hotel...'}
              className="w-full min-h-[160px] p-4 bg-input border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all font-mono leading-relaxed"
              value={formData.system_prompt}
              onChange={setField('system_prompt')}
            ></textarea>
            <p className="text-[0.65rem] text-text-muted italic">
              Write the instructions for the AI here. Use the button above to let Tati improve your prompt.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{'Cancel'}</Button>
            <Button onClick={handleSave} loading={isSaving}>{'Save'}</Button>
          </div>
        </div>
      </DialogModal>
    </section>
  );
}



